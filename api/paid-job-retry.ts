// api/paid-job-retry.ts — POST /api/paid-job-retry  body {jobId}. self-contained.
//
// failed job을 같은 input_json으로 재시도 가능하게: status failed → queued, retry_count 증가,
// result_json 초기화, 직전 error는 latest_error_json에 보존. 이후 프론트가 run(/api/paid-analysis
// {jobId})을 다시 호출한다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const JOBS_TABLE = 'paid_analysis_jobs';
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

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const includeDiag = process.env.VERCEL_ENV !== 'production';
  const sb = sbClient();
  if (!sb) { res.status(503).json({ error: 'not_configured', detail: 'supabase env missing' }); return; }

  const body = parseBody(req);
  const jobId = (body?.jobId ?? req.query?.id ?? '').toString();
  if (!jobId) { res.status(400).json({ error: 'missing_id' }); return; }

  const { data, error } = await sb.from(JOBS_TABLE).select().eq('id', jobId).maybeSingle();
  if (error) { res.status(500).json({ error: 'store_error', detail: includeDiag ? error.message : undefined }); return; }
  if (!data) { res.status(404).json({ error: 'not_found' }); return; }
  const job = data as any;
  if (job.status !== 'failed') { res.status(200).json({ jobId, status: job.status, note: 'not_failed_no_retry' }); return; }

  const nextRetry = (job.retry_count ?? 0) + 1;
  const { error: upErr } = await sb.from(JOBS_TABLE).update({
    status: 'queued', retry_count: nextRetry, result_json: null,
    latest_error_json: job.error_json ?? job.latest_error_json ?? null,
    completed_at: null, updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  if (upErr) { res.status(500).json({ error: 'store_error', detail: includeDiag ? upErr.message : undefined }); return; }
  // eslint-disable-next-line no-console
  console.log('[paid-job] RETRY', { jobId, retry_count: nextRetry });
  res.status(200).json({ jobId, status: 'queued', retry_count: nextRetry });
}
