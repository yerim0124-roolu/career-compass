// api/paid-job.ts — POST(create) + GET(poll). self-contained (src 상대경로 import 없음).
//
// POST /api/paid-job            → job 생성(queued). body {freeContext, paidAnswers, userSessionId?, testResultId?}
//                                 결과 생성을 기다리지 않는다. {jobId, status} 반환.
// GET  /api/paid-job?id=<jobId> → polling. {status, result_json?(ready), error_json?(failed), payment_status}
//
// 극단 부족(결과 유형 없음 + 답변 거의 없음)일 때만 job 없이 422. 일반 완료자는 차단 안 함.
// evidence_pack은 run worker(/api/paid-analysis, jobId)에서 계산·저장한다(무거운 빌더는 그쪽에 있음).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const JOBS_TABLE = 'paid_analysis_jobs';
const STALE_PROCESSING_MS = 10 * 60 * 1000; // processing 10분 초과 → worker_stale_timeout으로 reap.
let _sb: SupabaseClient | null = null;
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
      quality, can_pay: canPay, has_result: hasResult, displayable: hasResult,
    };
    if (hasResult) out.result_json = job.result_json;
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

  const now = new Date().toISOString();
  const { data, error } = await sb.from(JOBS_TABLE).insert({
    user_session_id: body.userSessionId ?? null,
    test_result_id: body.testResultId ?? null,
    status: 'queued',
    input_json: { freeContext, paidAnswers },
    evidence_pack: null,
    result_json: null, error_json: null, latest_error_json: null,
    retry_count: 0, payment_status: 'unpaid',
    created_at: now, updated_at: now,
  }).select().single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[paid-job] create store_error:', error.message);
    res.status(500).json({ error: 'store_error', detail: includeDiag ? error.message : undefined });
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[paid-job] CREATED', { jobId: (data as any).id });
  res.status(201).json({ jobId: (data as any).id, status: 'queued' });
}
