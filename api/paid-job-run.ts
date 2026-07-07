// api/paid-job-run.ts — DEPRECATED. run worker는 /api/paid-analysis (POST {jobId})로 이전됨.
//
// 이 파일은 삭제 예정이나 샌드박스에서 삭제가 막혀 self-contained 스텁으로 남겨둔다.
// 상대경로 src import 없음 — 배포에 영향 없음. 호출 시 새 경로로 안내한다.
export default async function handler(_req: any, res: any): Promise<void> {
  res.status(410).json({ error: 'gone', use: 'POST /api/paid-analysis with { jobId }' });
}
