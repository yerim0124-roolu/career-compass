// api/paid-analysis-runner.ts — QStash background worker.
//
// QStash가 POST로 { jobId }를 전달하면: 서명 검증 → atomic lease claim → 기존 생성 로직
// (generatePaidResult, 프롬프트/normalize/repair/quality 그대로) 실행 → result_json 저장.
// 브라우저는 이 엔드포인트를 직접 호출하지 않는다(오직 QStash). 프론트는 GET /api/paid-job 폴링.
//
// 재사용: 생성 코어는 api/paid-analysis.ts의 generatePaidResult/previewEvidence를 그대로 쓴다
//   (프롬프트·결과 schema·normalize/repair/quality 로직 변경 없음). ← 배포 후 이 sibling import가
//   번들되는지 1회 확인 필요(과거 ../src import에서 ERR_MODULE_NOT_FOUND 이력).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Receiver } from '@upstash/qstash';
import { randomUUID } from 'node:crypto';
// Vercel(@vercel/node) 번들은 각 .ts를 .js로 emit하므로 런타임 specifier는 '.js'여야 한다.
//   '.ts' specifier는 emit 후 존재하지 않아 모듈 로드 실패(FUNCTION_INVOCATION_FAILED)를 유발했다.
//   tsc(bundler resolution)는 '.js' → 형제 '.ts' 소스로 해석한다.
import { generatePaidResult, previewEvidence } from './paid-analysis.js';

// Vercel: 이 함수는 최대 300초까지 실행(Hobby 상한). Pro 전환 시 이 값 + vercel.json을 600~800으로.
export const maxDuration = 300;
// QStash 서명 검증에는 raw body가 필요하다. body parser를 끄고 스트림을 직접 읽는다.
//   (Next 스타일 config. @vercel/node가 무시하더라도 req.body를 참조하지 않고 스트림을 읽으므로 무해.)
export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 256 * 1024; // 서명 대상 body 상한(정상 payload는 수십 바이트).

// ── 타임아웃/리스 상수(한 곳에 모아 이유 주석) ────────────────────────────────
//   runner 300s > lease 360s? 아니다 — lease는 runner보다 '길어야' stale 오판을 막는다.
//   Claude 내부 timeout(callClaude: main 150s + repair 55s)은 runner 300s보다 짧아 DB 기록 여유 확보.
const RUNNER_MAX_DURATION_S = 300;      // Vercel 함수 상한(위 maxDuration과 동일). 참고용.
const LEASE_SECONDS = 360;              // runner(300s)보다 길게 → 실행 중 stale 재claim 방지. 초과 시 reclaim 허용.
const MAX_ATTEMPTS = 3;                 // QStash retries(2)와 정합(최초 1 + 재시도 2).
const JOBS_TABLE = 'paid_analysis_jobs';
// 일시적으로 간주해 재시도(release→queued)할 에러. 그 외(quality/schema/payload)는 terminal.
const RETRYABLE_ERROR_TYPES = new Set(['claude_abort_timeout', 'claude_network_error', 'claude_http_error']);

let _sb: SupabaseClient | null = null;
function sbClient(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}
function slog(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}
// QStash 서명 검증을 위해 raw body가 필요하다. req.body를 건드리지 않고 스트림에서 직접 읽는다.
//   과대 body는 상한에서 중단(에러 throw). 빈 body는 호출부에서 처리.
async function readRawBody(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error('body_too_large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}
void RUNNER_MAX_DURATION_S;

export default async function handler(req: any, res: any): Promise<void> {
  const runnerStartedAt = Date.now();
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const cur = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nxt = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!apiKey || !cur || !nxt) { slog('runner_config_missing', { hasApiKey: !!apiKey, hasSigningKeys: !!(cur && nxt) }); res.status(503).json({ error: 'not_configured' }); return; }

  // ── 서명 검증(raw body). body를 변형(JSON.parse)하기 전에 검증한다. ──
  let raw: string;
  try { raw = await readRawBody(req); }
  catch (e) {
    const tooLarge = e instanceof Error && e.message === 'body_too_large';
    res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'body_too_large' : 'bad_body' }); return;
  }
  if (!raw) { res.status(400).json({ error: 'empty_body' }); return; }
  const signature = (req.headers?.['upstash-signature'] ?? '').toString();
  if (!signature) { slog('runner_signature_missing', {}); res.status(401).json({ error: 'missing_signature' }); return; }
  let verified = false;
  // Receiver.verify에는 raw body 문자열을 그대로 전달(변형 금지). url은 넘기지 않는다 —
  //   프록시/host/proto 차이로 URL 불일치 검증 실패를 피하기 위함(body+signature로 충분히 검증).
  try { verified = await new Receiver({ currentSigningKey: cur, nextSigningKey: nxt }).verify({ signature, body: raw }); }
  catch { verified = false; }
  if (!verified) { slog('runner_signature_invalid', {}); res.status(403).json({ error: 'invalid_signature' }); return; }

  // 서명 통과 후에만 JSON.parse.
  let jobId = '';
  try { jobId = String(JSON.parse(raw)?.jobId ?? ''); } catch { res.status(400).json({ error: 'malformed_json' }); return; }
  if (!jobId) { res.status(400).json({ error: 'missing_job_id' }); return; }
  slog('runner_signature_verified', { jobId });
  slog('runner_started', { jobId });

  const sb = sbClient();
  if (!sb) { slog('runner_config_missing', { supabase: false }); res.status(503).json({ error: 'not_configured' }); return; }

  // job 조회.
  const { data: job, error: getErr } = await sb.from(JOBS_TABLE).select().eq('id', jobId).maybeSingle();
  if (getErr) { slog('runner_failed', { jobId, stage: 'get', retryable: true, message: getErr.message }); res.status(503).json({ error: 'store_error' }); return; }
  if (!job) { slog('runner_claim_skipped', { jobId, reason: 'not_found' }); res.status(200).json({ jobId, skipped: 'not_found' }); return; }

  // 이미 result_json이 있으면 Claude 재호출 금지(멱등). status만 안전 정규화.
  if ((job as any).result_json != null) {
    if ((job as any).status !== 'ready') {
      await sb.from(JOBS_TABLE).update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', jobId).not('result_json', 'is', null);
    }
    slog('runner_claim_skipped', { jobId, reason: 'already_has_result' });
    res.status(200).json({ jobId, status: 'ready', skipped: 'already_has_result' }); return;
  }

  // ── atomic lease claim(RPC). 반환행 없으면 Claude 호출 금지. ──
  const leaseId = randomUUID();
  const { data: claimed, error: claimErr } = await sb.rpc('claim_paid_analysis_job', { p_job_id: jobId, p_lease_id: leaseId, p_lease_seconds: LEASE_SECONDS });
  if (claimErr) { slog('runner_failed', { jobId, stage: 'claim', retryable: true, message: claimErr.message }); res.status(503).json({ error: 'store_error' }); return; }
  const claimedRow: any = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!claimedRow) { slog('runner_claim_skipped', { jobId, reason: 'not_claimable' }); res.status(200).json({ jobId, skipped: 'not_claimable' }); return; }
  const attempt: number = claimedRow.attempt_count ?? 1;
  slog('runner_claim_succeeded', { jobId, attemptCount: attempt });

  const input = claimedRow.input_json as { freeContext?: any; paidAnswers?: any } | null;
  if (!input?.freeContext || !input?.paidAnswers) {
    // terminal: 입력이 없으면 재시도해도 소용없음.
    const errPayload = { error: 'invalid_input_json', stage: 'runner', retryable: false };
    await sb.rpc('fail_paid_analysis_job', { p_job_id: jobId, p_lease_id: leaseId, p_error: errPayload, p_error_code: 'invalid_input_json', p_error_message: 'missing freeContext/paidAnswers' });
    slog('runner_failed', { jobId, retryable: false, errorType: 'invalid_input_json', attemptCount: attempt });
    res.status(200).json({ jobId, status: 'failed', errorType: 'invalid_input_json' }); return;
  }

  // ── 기존 생성 로직 그대로 실행(프롬프트/normalize/repair/quality 변경 없음). ──
  slog('claude_request_started', { jobId, attemptCount: attempt });
  await sb.from(JOBS_TABLE).update({ claude_started_at: new Date().toISOString() }).eq('id', jobId).is('result_json', null);
  const claudeStartedAt = Date.now();
  let outcome: Awaited<ReturnType<typeof generatePaidResult>>;
  try {
    outcome = await generatePaidResult(apiKey, input.freeContext, input.paidAnswers, jobId);
  } catch (e) {
    outcome = { status: 'failed', errorJson: { error: 'runner_exception', errorType: 'unknown', elapsedMs: Date.now() - claudeStartedAt } } as any;
    slog('runner_exception', { jobId, message: e instanceof Error ? e.message : 'unknown' });
  }
  const claudeMs = Date.now() - claudeStartedAt;
  slog('claude_request_completed', { jobId, durationMs: claudeMs, status: outcome.status });
  const runnerMs = Date.now() - runnerStartedAt;

  // ── 성공: 현재 lease owner + result 미존재 조건으로만 저장(RPC). ──
  if (outcome.status === 'ready') {
    const pre = previewEvidence(input.freeContext, input.paidAnswers);
    const quality = { passed: outcome.meta.qualityPassed, displayable: true, repaired: outcome.meta.deterministicRepair,
      finalResultSource: outcome.meta.finalResultSource, blockers: outcome.meta.blockers, warnings: outcome.meta.qualityWarnings };
    const evidencePack = { structuredEvidenceCount: pre.structuredEvidenceCount, highSignalEvidenceCount: pre.highSignalEvidenceCount,
      missingSignals: pre.missingSignals, evidenceSourceBreakdown: pre.evidenceSourceBreakdown, freeTextChars: pre.freeTextChars, keywords: pre.keywords, quality };
    const { data: saved, error: saveErr } = await sb.rpc('save_paid_analysis_result', {
      p_job_id: jobId, p_lease_id: leaseId, p_result: outcome.resultJson, p_usage: outcome.meta.usage,
      p_model: outcome.meta.model, p_evidence: evidencePack, p_claude_ms: claudeMs, p_runner_ms: runnerMs,
    });
    if (saveErr) { slog('runner_failed', { jobId, stage: 'save', retryable: true, message: saveErr.message }); res.status(503).json({ error: 'store_error' }); return; }
    const savedRow = Array.isArray(saved) ? saved[0] : saved;
    if (!savedRow) { slog('result_save_skipped', { jobId, reason: 'lease_lost_or_already_saved' }); res.status(200).json({ jobId, status: 'ready', note: 'save_skipped' }); return; }
    slog('result_save_succeeded', { jobId, model: outcome.meta.model, claudeDurationMs: claudeMs, runnerDurationMs: runnerMs });
    slog('runner_completed', { jobId, durationMs: runnerMs, claudeDurationMs: claudeMs, attemptCount: attempt });
    res.status(200).json({ jobId, status: 'ready' }); return;
  }

  // ── 실패: retryable vs terminal 구분 ──
  const errorType = outcome.errorJson.errorType || outcome.errorJson.error || 'unknown';
  const retryable = RETRYABLE_ERROR_TYPES.has(errorType);
  if (retryable && attempt < MAX_ATTEMPTS) {
    // Claude 호출이 끝난 뒤에만 lease 해제 → status=queued. RPC는 (id + lease_id + status=processing +
    //   result_json IS NULL)일 때만 1행 반환.
    const { data: released, error: relErr } = await sb.rpc('release_paid_analysis_lease', { p_job_id: jobId, p_lease_id: leaseId, p_error_code: errorType, p_error_message: String(outcome.errorJson.error ?? errorType) });
    if (relErr) {
      // RPC 자체 오류 → 5xx(QStash retry로 회복 시도). lease는 만료되면 다른 delivery가 reclaim.
      slog('runner_failed', { jobId, stage: 'release', retryable: true, message: relErr.message, attemptCount: attempt });
      res.status(503).json({ error: 'store_error' }); return;
    }
    const releasedRow = Array.isArray(released) ? released[0] : released;
    if (releasedRow) {
      // release 성공(우리가 owner였고 result 없음) → 503으로 QStash 재delivery 유도.
      slog('runner_failed', { jobId, retryable: true, errorType, attemptCount: attempt });
      res.status(503).json({ jobId, status: 'retry', errorType }); return;
    }
    // 0행 → 재조회 후 분기(기존 결과/다른 lease owner를 덮어쓰지 않는다).
    const { data: cur } = await sb.from(JOBS_TABLE).select().eq('id', jobId).maybeSingle();
    const c: any = cur;
    if (!c) { slog('runner_release_noop', { jobId, reason: 'not_found' }); res.status(200).json({ jobId, note: 'release_noop' }); return; }
    if (c.result_json != null) { slog('runner_release_noop', { jobId, reason: 'already_saved' }); res.status(200).json({ jobId, status: 'ready', note: 'release_noop' }); return; }
    if (c.status === 'ready') { slog('runner_release_noop', { jobId, reason: 'ready' }); res.status(200).json({ jobId, status: 'ready', note: 'release_noop' }); return; }
    if (c.status === 'failed') { slog('runner_release_noop', { jobId, reason: 'failed_no_result' }); res.status(200).json({ jobId, status: 'failed', note: 'release_noop' }); return; }
    const leaseValid = c.lease_expires_at && Date.parse(c.lease_expires_at) > Date.now();
    if (c.status === 'processing' && c.lease_id && c.lease_id !== leaseId && leaseValid) {
      // 다른 runner가 유효 lease로 처리 중 → 우리는 조용히 종료.
      slog('runner_release_noop', { jobId, reason: 'other_valid_lease' }); res.status(200).json({ jobId, note: 'release_noop' }); return;
    }
    // 여전히 processing인데 우리 lease거나 원인 설명 불가 → 로그 후 5xx(안전하게 재시도 유도).
    slog('runner_failed', { jobId, stage: 'release_unexpected', retryable: true, status: c.status, sameLease: c.lease_id === leaseId, attemptCount: attempt });
    res.status(500).json({ error: 'release_unexpected' }); return;
  }
  // terminal(또는 attempts 소진): result 없을 때만 failed 기록. 2xx로 QStash retry 중단.
  const errPayload = { error: outcome.errorJson.error ?? 'failed', errorType, stage: 'runner', retryable: false, attemptCount: attempt };
  await sb.rpc('fail_paid_analysis_job', { p_job_id: jobId, p_lease_id: leaseId, p_error: errPayload, p_error_code: errorType, p_error_message: String(outcome.errorJson.error ?? errorType) });
  slog('runner_failed', { jobId, retryable: false, errorType, attemptCount: attempt, exhausted: retryable });
  res.status(200).json({ jobId, status: 'failed', errorType }); return;
}
