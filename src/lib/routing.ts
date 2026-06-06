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
//   '#hybrid', '#v3',      '#/hybrid', '#/v3'         → 'hybrid' (P3.8 hybrid UX)
//   everything else (including '')                  → 'v1'     (original V1 landing)
//
// Adding a new route here is the only place that needs to change.

export type Route = 'v1' | 'v2' | 'chat' | 'hybrid';

export function resolveRoute(hash: string): Route {
  if (hash === '#v2' || hash === '#/v2') return 'v2';
  if (hash === '#chat' || hash === '#chat-v1' || hash === '#/chat' || hash === '#/chat-v1') return 'chat';
  if (hash === '#hybrid' || hash === '#v3' || hash === '#/hybrid' || hash === '#/v3') return 'hybrid';
  return 'v1';
}
