// Career Compass — pure hash-route resolver.
//
// Lives in src/lib so it can be unit-tested headlessly. App.tsx imports
// `resolveRoute` and uses it inside a small useState/useEffect hook to drive
// which top-level page renders. The function itself is pure: same hash in →
// same Route out, no DOM access, no side effects.
//
// ─── Route map (the test of record) ─────────────────────────────────────────
//   '#v2',     '#/v2'                                → 'v2'     (Career Compass 2.0)
//   '#chat',   '#chat-v1', '#/chat',   '#/chat-v1'    → 'chat'   (Guided chat — experiment)
//   '#v1',     '#/v1'                                → 'v1'     (original V1 landing — legacy)
//   everything else (including '', '#hybrid', '#v3') → 'hybrid' (current product, default)
//
// Default route is now 'hybrid' so the bare URL (no hash) serves the current
// redesigned experience. The legacy V1 landing stays reachable at '#v1'.
// Adding a new route here is the only place that needs to change.

export type Route = 'v1' | 'v2' | 'chat' | 'hybrid' | 'paid' | 'paidPreview' | 'paidQuestions';

export function resolveRoute(hash: string, search = ''): Route {
  // ?paidJobId=<uuid>(조회 전용)가 hash-query 또는 search에 있으면 항상 결과 화면으로.
  //   예) /#paid-result?paidJobId=... , /?paidJobId=... 둘 다 지원.
  if (/[?&]paidJobId=/.test(hash) || /[?&]paidJobId=/.test(search)) return 'paid';
  // 쿼리 문자열(?...)을 떼고 경로부만 매칭한다(#paid-result?x=y → #paid-result).
  const path = hash.split('?')[0];
  if (path === '#v2' || path === '#/v2') return 'v2';
  if (path === '#chat' || path === '#chat-v1' || path === '#/chat' || path === '#/chat-v1') return 'chat';
  if (path === '#v1' || path === '#/v1') return 'v1';
  // 유료 퍼널 라우트. 실제 접근 여부는 App.tsx에서 FEATURE_FLAGS로 게이팅.
  if (path === '#paid-preview' || path === '#/paid-preview') return 'paidPreview';
  if (path === '#paid-questions' || path === '#/paid-questions') return 'paidQuestions';
  if (path === '#paid-result' || path === '#/paid-result') return 'paid';
  return 'hybrid';
}
