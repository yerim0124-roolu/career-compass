// api/paid-job-retry.ts — POST /api/paid-job-retry  [일시 비활성화]
//
// 기존 구현은 pre-QStash 설계였다: failed job의 result_json을 무조건 null로 지우고
// status를 queued로 되돌렸지만, QStash 재publish를 하지 않아 재시도된 job이 아무도
// 집어가지 않는 orphan queued가 됐다(docs/debug/qstash-production-readiness.md §7-F1).
// 완전한 QStash retry(재publish + result_json 보존)를 구현하기 전까지 이 endpoint는
// DB를 일절 건드리지 않고 503 retry_temporarily_disabled만 반환한다.
// 인증(ADMIN_RETRY_SECRET) 계약은 유지 — 미설정/불일치면 403(안전한 기본값 = 거부).

const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Expires': '0',
};
function applyNoStore(res: any): void {
  Object.entries(NO_STORE_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.removeHeader?.('ETag'); res.removeHeader?.('Last-Modified');
}

export default async function handler(req: any, res: any): Promise<void> {
  applyNoStore(res);
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  // 운영자 전용 인증 유지. secret 미설정이거나 불일치면 403.
  const secret = process.env.ADMIN_RETRY_SECRET;
  const provided = (req.headers?.['x-admin-retry-secret'] ?? '').toString();
  if (!secret || provided !== secret) { res.status(403).json({ error: 'forbidden' }); return; }

  // eslint-disable-next-line no-console
  console.warn('[paid-job] RETRY disabled — no DB mutation', { path: '/api/paid-job-retry' });
  res.status(503).json({
    error: 'retry_temporarily_disabled',
    detail: 'admin retry is disabled until QStash-aware retry (republish + result_json guard) is implemented',
  });
}
