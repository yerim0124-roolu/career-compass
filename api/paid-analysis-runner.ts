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
import { generatePaidResult, previewEvidence } from './paid-analysis.ts';

// Vercel: 이 함수는 최대 300초까지 실행(Hobby 상한). Pro 전환 시 이 값 + vercel.json을 600~800으로.
export const maxDuration = 300;

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
async function readRawBody(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer);
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

  // ── 서명 검증(raw body). body를 변형하기 전에 검증한다. ──
  let raw: string;
  try { raw = await readRawBody(req); } catch { res.status(400).json({ error: 'bad_body' }); return; }
  const signature = (req.headers?.['upstash-signature'] ?? '').toString();
  if (!signature) { slog('runner_signature_missing', {}); res.status(401).json({ error: 'missing_signature' }); return; }
  let verified = false;
  try { verified = await new Receiver({ currentSigningKey: cur, nextSigningKey: nxt }).verify({ signature, body: raw }); }
  catch { verified = false; }
  if (!verified) { slog('runner_signature_invalid', {}); res.status(403).json({ error: 'invalid_signature' }); return; }

  let jobId = '';
  try { jobId = String(JSON.parse(raw)?.jobId ?? ''); } catch { /* below */ }
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
    // lease 해제 → status=queued. 다음 QStash delivery가 다시 claim해 실행. non-2xx로 retry 트리거.
    await sb.rpc('release_paid_analysis_lease', { p_job_id: jobId, p_lease_id: leaseId, p_error_code: errorType, p_error_message: String(outcome.errorJson.error ?? errorType) });
    slog('runner_failed', { jobId, retryable: true, errorType, attemptCount: attempt });
    res.status(503).json({ jobId, status: 'retry', errorType }); return;
  }
  // terminal(또는 attempts 소진): result 없을 때만 failed 기록. 2xx로 QStash retry 중단.
  const errPayload = { error: outcome.errorJson.error ?? 'failed', errorType, stage: 'runner', retryable: false, attemptCount: attempt };
  await sb.rpc('fail_paid_analysis_job', { p_job_id: jobId, p_lease_id: leaseId, p_error: errPayload, p_error_code: errorType, p_error_message: String(outcome.errorJson.error ?? errorType) });
  slog('runner_failed', { jobId, retryable: false, errorType, attemptCount: attempt, exhausted: retryable });
  res.status(200).json({ jobId, status: 'failed', errorType }); return;
}
