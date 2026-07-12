// api/paid-job.ts — POST(create) + GET(poll). self-contained (src 상대경로 import 없음).
//
// POST /api/paid-job            → job 생성(queued). body {freeContext, paidAnswers, userSessionId?, testResultId?}
//                                 결과 생성을 기다리지 않는다. {jobId, status} 반환.
// GET  /api/paid-job?id=<jobId> → polling. {status, result_json?(ready), error_json?(failed), payment_status}
//
// 극단 부족(결과 유형 없음 + 답변 거의 없음)일 때만 job 없이 422. 일반 완료자는 차단 안 함.
// evidence_pack은 run worker(/api/paid-analysis, jobId)에서 계산·저장한다(무거운 빌더는 그쪽에 있음).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client as QStashClient } from '@upstash/qstash';

const JOBS_TABLE = 'paid_analysis_jobs';
const STALE_PROCESSING_MS = 10 * 60 * 1000; // processing 10분 초과 → worker_stale_timeout으로 reap.
const RUNNER_PATH = '/api/paid-analysis-runner';
const QSTASH_RETRIES = 2; // endpoint delivery 재시도(최초 1 + 재시도 2 = 최대 3회 delivery).
const PROD_APP_URL = 'https://career-compass-rose.vercel.app';
let _sb: SupabaseClient | null = null;

// structured JSON log(민감정보 제외). Vercel/Supabase에서 event로 검색 가능.
function slog(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}

function hostBaseUrl(req: any): string {
  const proto = (req.headers?.['x-forwarded-proto'] ?? 'https').toString().split(',')[0];
  const host = (req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? '').toString().split(',')[0];
  return host ? `${proto}://${host}` : '';
}
// recoveryUrl 등 사용자 표시용 base URL(항상 안정적인 public 도메인 우선).
function displayBaseUrl(req: any): string {
  return (process.env.PUBLIC_APP_URL?.replace(/\/$/, '')) || hostBaseUrl(req) || PROD_APP_URL;
}
// QStash가 도달할 runner base URL. 환경별로 '자기 자신'을 향하게 해 교차환경 호출을 막는다.
//   - preview: VERCEL_URL(그 프리뷰 배포 자신). PUBLIC_APP_URL(=prod)을 쓰지 않는다.
//   - production/기타: PUBLIC_APP_URL 우선 → VERCEL_URL → 헤더 → prod.
function resolveRunnerBaseUrl(req: any): string {
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  if (vercelEnv === 'preview') return vercelUrl || hostBaseUrl(req) || PROD_APP_URL;
  return (process.env.PUBLIC_APP_URL?.replace(/\/$/, '')) || vercelUrl || hostBaseUrl(req) || PROD_APP_URL;
}
function sbClient(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}
function parseBody(req: any): any {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {}); }
  catch { return null; }
}

// polling 응답이 CDN/브라우저 캐시로 304가 되면 프론트가 결과를 못 읽는다. 절대 캐시 금지.
const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
};
function applyNoStore(res: any): void {
  Object.entries(NO_STORE_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  // 조건부 요청이 304로 떨어지지 않도록 ETag/Last-Modified 검증 자체를 무력화.
  res.removeHeader?.('ETag');
  res.removeHeader?.('Last-Modified');
}

export default async function handler(req: any, res: any): Promise<void> {
  applyNoStore(res);
  const includeDiag = process.env.VERCEL_ENV !== 'production';
  const sb = sbClient();
  if (!sb) { res.status(503).json({ error: 'not_configured', detail: 'supabase env missing' }); return; }

  // ── GET: polling — 저장된 status만 반환. 프론트는 이것만 신뢰해 렌더한다. ──
  if (req.method === 'GET') {
    const id = (req.query?.id ?? '').toString();
    if (!id) { res.status(400).json({ error: 'missing_id' }); return; }
    const { data, error } = await sb.from(JOBS_TABLE).select().eq('id', id).maybeSingle();
    if (error) { res.status(500).json({ error: 'store_error', detail: includeDiag ? error.message : undefined }); return; }
    if (!data) { res.status(404).json({ error: 'not_found' }); return; }
    let job = data as any;

    // stale reap: processing이 STALE_MS(10분) 넘게 지속되면 worker가 죽은 것으로 보고 failed 처리.
    //   Vercel run worker는 request-bound라 함수가 죽으면 processing에 고착될 수 있다. retry로 회복 가능.
    if (job.status === 'processing') {
      const startedAt = Date.parse(job.updated_at ?? job.created_at ?? '') || 0;
      if (startedAt && Date.now() - startedAt > STALE_PROCESSING_MS) {
        const errorJson = { error: 'worker_stale', errorType: 'worker_stale_timeout' };
        const { data: reaped } = await sb.from(JOBS_TABLE)
          .update({ status: 'failed', error_json: errorJson, latest_error_json: errorJson, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id).eq('status', 'processing').select().maybeSingle();
        // eslint-disable-next-line no-console
        console.warn('[paid-job] STALE processing → failed(worker_stale_timeout)', { jobId: id });
        if (reaped) job = reaped as any;
      }
    }

    // result_json이 있으면 status(ready/failed/processing)와 무관하게 항상 반환한다.
    //   프론트는 result_json 존재를 status보다 우선해 렌더한다(생성 성공 후 상태 지연/오설정 방어).
    const hasResult = job.result_json != null;
    const quality = job.evidence_pack?.quality ?? null;
    const canPay = job.status === 'ready' && hasResult && quality?.passed === true;
    const out: Record<string, unknown> = {
      jobId: job.id, status: job.status, payment_status: job.payment_status, retry_count: job.retry_count,
      attempt_count: job.attempt_count ?? 0, updated_at: job.updated_at,
      quality, can_pay: canPay, has_result: hasResult, displayable: hasResult,
      recoveryUrl: `${displayBaseUrl(req)}/?paidJobId=${job.id}`,
    };
    if (hasResult) out.result_json = job.result_json;
    // 민감한 내부 오류/prompt/stack은 제외. error 코드/타입만 노출.
    if (job.status === 'failed') out.error_json = includeDiag ? job.error_json : { error: job.error_json?.error ?? 'failed', errorType: job.error_json?.errorType };
    res.status(200).json(out);
    return;
  }

  // ── POST: create ──
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const body = parseBody(req);
  if (!body) { res.status(400).json({ error: 'invalid_json' }); return; }
  const freeContext = body.freeContext;
  const paidAnswers = body.paidAnswers;
  if (!freeContext || !paidAnswers || typeof paidAnswers !== 'object') { res.status(400).json({ error: 'invalid_payload' }); return; }

  // 가벼운 극단-부족 게이트(무거운 evidence 빌더 없이): 결과 유형도 없고 답변도 거의 없을 때만.
  const answerVals = Object.values(paidAnswers).flatMap((v) => (Array.isArray(v) ? v : [v]));
  const answerCount = answerVals.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
  const hasResultSignal = (String(freeContext.mainType ?? '').trim().length > 0) || (String(freeContext.primarySubtype ?? '').trim().length > 0);
  const freeTextChars = String(freeContext.occupation ?? '').length + String(freeContext.userFreeText ?? '').length + String(paidAnswers.trigger ?? '').length + String(paidAnswers.flowMoment ?? '').length;
  // eslint-disable-next-line no-console
  console.log('[paid-job] CREATE PAYLOAD_SHAPE', { topLevelKeys: Object.keys(body), answerCount, hasResultSignal, freeTextChars, freeContextKeys: Object.keys(freeContext) });
  if (!hasResultSignal && answerCount < 3) {
    res.status(422).json(includeDiag ? { error: 'insufficient_input', answerCount } : { error: 'insufficient_input' });
    return;
  }

  // QStash 미설정이면 명확한 서버 오류(secret 값은 로그에 남기지 않는다).
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) { slog('qstash_not_configured', {}); res.status(503).json({ error: 'not_configured', detail: 'qstash token missing' }); return; }

  // ── background generation 가용 환경인지 insert 전에 확인 ──
  //   Production만 항상 publish. Preview는 ALLOW_PREVIEW_QSTASH=true일 때만. Local/dev(QStash가
  //   localhost에 도달 불가)는 차단. 여기서 막으면 orphan queued row가 생기지 않아 무한 폴링을 방지.
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | undefined(local)
  const publishDisabled =
    (vercelEnv === 'preview' && process.env.ALLOW_PREVIEW_QSTASH !== 'true') ||
    (vercelEnv !== 'production' && vercelEnv !== 'preview');
  if (publishDisabled) {
    slog('background_generation_disabled', { env: vercelEnv ?? 'local' });
    res.status(503).json({ error: 'background_generation_disabled', env: vercelEnv ?? 'local', detail: 'QStash background generation is disabled in this environment' });
    return;
  }

  // 제출 단위 idempotency 키(uuid). 프론트가 제출 1회당 1개 생성해 보낸다(구버전은 없을 수 있음).
  const clientRequestId: string | null = typeof body.clientRequestId === 'string' && body.clientRequestId ? body.clientRequestId : null;

  const now = new Date().toISOString();
  const { data, error } = await sb.from(JOBS_TABLE).insert({
    user_session_id: body.userSessionId ?? null,
    test_result_id: body.testResultId ?? null,
    client_request_id: clientRequestId,
    status: 'queued',
    input_json: { freeContext, paidAnswers },
    evidence_pack: null,
    result_json: null, error_json: null, latest_error_json: null,
    retry_count: 0, attempt_count: 0, payment_status: 'unpaid',
    created_at: now, updated_at: now,
  }).select().single();

  let jobRow: any = data;
  if (error) {
    // 23505 = unique 위반(같은 client_request_id 재요청). 새 row 만들지 않고 기존 job을 반환한다.
    if (error.code === '23505' && clientRequestId) {
      const { data: existing } = await sb.from(JOBS_TABLE).select().eq('client_request_id', clientRequestId).maybeSingle();
      if (existing) {
        slog('paid_job_dedup_hit', { jobId: (existing as any).id });
        jobRow = existing;
      } else { slog('paid_job_create_store_error', { message: error.message }); res.status(500).json({ error: 'store_error', detail: includeDiag ? error.message : undefined }); return; }
    } else {
      slog('paid_job_create_store_error', { message: error.message });
      res.status(500).json({ error: 'store_error', detail: includeDiag ? error.message : undefined });
      return;
    }
  }
  const jobId = jobRow.id as string;
  slog('paid_job_created', { jobId, dedup: jobRow !== data });

  // 이미 결과가 있으면 재publish 불필요.
  if (jobRow.result_json != null) { res.status(201).json({ jobId, status: jobRow.status }); return; }
  // 이미 enqueue된 job(재요청/새로고침)이면 중복 publish 금지.
  if (jobRow.enqueued_at || jobRow.qstash_message_id) { slog('qstash_publish_skipped', { jobId, reason: 'already_enqueued' }); res.status(201).json({ jobId, status: jobRow.status }); return; }

  // ── QStash publish: runner를 background로 실행. 프론트는 Claude 완료를 기다리지 않는다. ──
  const runnerUrl = `${resolveRunnerBaseUrl(req)}${RUNNER_PATH}`;
  slog('qstash_publish_started', { jobId, runnerUrl });
  try {
    const qstash = new QStashClient({ token: qstashToken });
    const pub = await qstash.publishJSON({
      url: runnerUrl,
      body: { jobId },
      retries: QSTASH_RETRIES,
      deduplicationId: `paid-analysis:${jobId}`,
    });
    const messageId = Array.isArray(pub) ? pub[0]?.messageId : (pub as any)?.messageId;
    await sb.from(JOBS_TABLE).update({ enqueued_at: new Date().toISOString(), qstash_message_id: messageId ?? null, updated_at: new Date().toISOString() }).eq('id', jobId);
    slog('qstash_publish_succeeded', { jobId, messageId });
    res.status(201).json({ jobId, status: 'queued' });
  } catch (e) {
    // publish 실패는 성공처럼 처리하지 않는다. job에 실패 기록 + 재시도 가능 정보 반환.
    const msg = e instanceof Error ? e.message : 'publish_error';
    slog('qstash_publish_failed', { jobId, message: msg });
    const errorJson = { error: 'enqueue_failed', stage: 'qstash_publish', retryable: true };
    await sb.from(JOBS_TABLE).update({
      status: 'failed', error_json: errorJson, latest_error_json: errorJson,
      failed_at: new Date().toISOString(), last_error_code: 'qstash_publish', last_error_message: msg, last_error_retryable: true,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId).is('result_json', null);
    res.status(201).json({ jobId, status: 'failed', enqueueError: 'qstash_publish', retryable: true });
  }
}
