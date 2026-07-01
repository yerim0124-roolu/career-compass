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

export type Route = 'v1' | 'v2' | 'chat' | 'hybrid' | 'paid';

export function resolveRoute(hash: string): Route {
  if (hash === '#v2' || hash === '#/v2') return 'v2';
  if (hash === '#chat' || hash === '#chat-v1' || hash === '#/chat' || hash === '#/chat-v1') return 'chat';
  if (hash === '#v1' || hash === '#/v1') return 'v1';
  // 유료 심화 분석(빈 라우트). 실제 접근 여부는 App.tsx에서 FEATURE_FLAGS로 게이팅.
  if (hash === '#paid-result' || hash === '#/paid-result') return 'paid';
  return 'hybrid';
}
