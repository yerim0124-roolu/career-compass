// Headless tests for P2.6 careerCompassFollowUp30d.
// Schema acceptance + helper purity + JSON serialization.

import {
  FOLLOW_UP_30D_SCHEMA_VERSION,
  FOLLOW_UP_30D_QUESTIONS,
  normalizeFollowUp30d,
  isFollowUp30dEmpty,
  mergeFollowUp30d,
  deriveCompletedPlanFromRate,
  deriveCompletedPlan,
  applyActualActionToggle,
  ACTUAL_ACTION_NO_ACTION,
} from './careerCompassFollowUp30d.ts';
import type { CareerCompassFollowUp30d, ActualActionTaken } from './careerCompassFollowUp30d.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Schema version ─────────────────────────────────────────────────────────
check('schemaVersion: exported constant equals "1.0.0"',
  FOLLOW_UP_30D_SCHEMA_VERSION === '1.0.0');

// ─── Question definitions sanity ────────────────────────────────────────────
check('questions: 8 user-facing slots defined (completedAt is auto-attached, not asked)',
  FOLLOW_UP_30D_QUESTIONS.length === 8);

{
  const fieldsCovered = new Set(FOLLOW_UP_30D_QUESTIONS.map((q) => q.field));
  const expectedFields = [
    'completedPlan', 'completionRate', 'actualActionsTaken',
    'energyChange', 'clarityChange', 'confidenceChange',
    'nextIntent', 'freeTextReflection',
  ];
  check('questions: each user-facing follow-up field has a question',
    expectedFields.every((f) => fieldsCovered.has(f as keyof CareerCompassFollowUp30d)));
}

check('questions: all are required=false (skip-friendly per spec)',
  FOLLOW_UP_30D_QUESTIONS.every((q) => q.required === false));

{
  const multi = FOLLOW_UP_30D_QUESTIONS.find((q) => q.field === 'actualActionsTaken');
  check('questions: actualActionsTaken is multi_select with 11 option ids',
    !!multi && multi.inputType === 'multi_select' && (multi.options?.length ?? 0) === 11);
}

{
  // Each select-type question must have options.
  const allSelectsHaveOptions = FOLLOW_UP_30D_QUESTIONS.every((q) => {
    if (q.inputType === 'single_select' || q.inputType === 'multi_select') {
      return Array.isArray(q.options) && q.options.length > 0;
    }
    return true;
  });
  check('questions: every select-type question carries an options array',
    allSelectsHaveOptions);
}

// ─── normalizeFollowUp30d — per-field happy paths ───────────────────────────
{
  const out = normalizeFollowUp30d({ completedPlan: true });
  check('normalize: completedPlan=true → preserved as boolean',
    out.completedPlan === true);
}
{
  const out = normalizeFollowUp30d({ completedPlan: false });
  check('normalize: completedPlan=false → preserved as boolean',
    out.completedPlan === false);
}
{
  const out = normalizeFollowUp30d({ completionRate: '50' });
  check('normalize: completionRate="50" → preserved',
    out.completionRate === '50');
}
{
  const out = normalizeFollowUp30d({
    actualActionsTaken: ['rest_recovery', 'interviews_done', 'networking'],
  });
  check('normalize: actualActionsTaken with 3 valid entries → all preserved',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['rest_recovery', 'interviews_done', 'networking']));
}
{
  const out = normalizeFollowUp30d({ energyChange: 'up' });
  check('normalize: energyChange="up" → preserved',
    out.energyChange === 'up');
}
{
  const out = normalizeFollowUp30d({ clarityChange: 'same' });
  check('normalize: clarityChange="same" → preserved',
    out.clarityChange === 'same');
}
{
  const out = normalizeFollowUp30d({ confidenceChange: 'down' });
  check('normalize: confidenceChange="down" → preserved',
    out.confidenceChange === 'down');
}
{
  const out = normalizeFollowUp30d({ nextIntent: 'pivot' });
  check('normalize: nextIntent="pivot" → preserved',
    out.nextIntent === 'pivot');
}
{
  const out = normalizeFollowUp30d({ freeTextReflection: '한 달 잘 회복했어요' });
  check('normalize: freeTextReflection (Korean) → preserved',
    out.freeTextReflection === '한 달 잘 회복했어요');
}
{
  const out = normalizeFollowUp30d({ completedAt: '2026-07-01T10:30:00Z' });
  check('normalize: completedAt ISO string → preserved verbatim',
    out.completedAt === '2026-07-01T10:30:00Z');
}

// ─── normalizeFollowUp30d — invalid values dropped ──────────────────────────
{
  const out = normalizeFollowUp30d({ completedPlan: 'yes' as unknown as boolean });
  check('normalize: invalid completedPlan type (string) → field dropped',
    out.completedPlan === undefined);
}
{
  const out = normalizeFollowUp30d({ completionRate: '33' as unknown as '0' });
  check('normalize: invalid completionRate value "33" → field dropped',
    out.completionRate === undefined);
}
{
  const out = normalizeFollowUp30d({
    actualActionsTaken: ['rest_recovery', 'invalid_action', 'job_search'] as unknown as never[],
  });
  check('normalize: actualActionsTaken with one invalid entry → invalid dropped, valid kept',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['rest_recovery', 'job_search']));
}
{
  const out = normalizeFollowUp30d({
    actualActionsTaken: ['rest_recovery', 'rest_recovery', 'job_search'] as unknown as never[],
  });
  check('normalize: actualActionsTaken with duplicate → deduped',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['rest_recovery', 'job_search']));
}
{
  const out = normalizeFollowUp30d({ energyChange: 'higher' as unknown as 'up' });
  check('normalize: invalid energyChange value → field dropped',
    out.energyChange === undefined);
}
{
  const out = normalizeFollowUp30d({ nextIntent: 'quit' as unknown as 'continue' });
  check('normalize: invalid nextIntent value → field dropped',
    out.nextIntent === undefined);
}

// ─── normalizeFollowUp30d — free text trim + empty handling ─────────────────
{
  const out = normalizeFollowUp30d({ freeTextReflection: '  trimmed  ' });
  check('normalize: freeTextReflection trimmed of surrounding whitespace',
    out.freeTextReflection === 'trimmed');
}
{
  const out = normalizeFollowUp30d({ freeTextReflection: '   ' });
  check('normalize: whitespace-only freeTextReflection → field dropped',
    out.freeTextReflection === undefined);
}
{
  const out = normalizeFollowUp30d({ freeTextReflection: '' });
  check('normalize: empty freeTextReflection → field dropped',
    out.freeTextReflection === undefined);
}

// ─── normalizeFollowUp30d — null / undefined / empty inputs ─────────────────
{
  const out = normalizeFollowUp30d(null as unknown as CareerCompassFollowUp30d);
  check('normalize: null input → {}',
    JSON.stringify(out) === '{}');
}
{
  const out = normalizeFollowUp30d(undefined);
  check('normalize: undefined input → {}',
    JSON.stringify(out) === '{}');
}
{
  const out = normalizeFollowUp30d({});
  check('normalize: empty-object input → {}',
    JSON.stringify(out) === '{}');
}

// ─── normalizeFollowUp30d — emits NO undefined keys ─────────────────────────
{
  const out = normalizeFollowUp30d({ completedPlan: true });
  const keys = Object.keys(out);
  check('normalize: result has ONLY populated keys (no phantom undefined)',
    keys.length === 1 && keys[0] === 'completedPlan');
}

// ─── normalizeFollowUp30d — full kitchen-sink ───────────────────────────────
{
  const rich: CareerCompassFollowUp30d = {
    completedPlan: true,
    completionRate: '75',
    actualActionsTaken: ['rest_recovery', 'internal_redesign', 'course_learning'],
    energyChange: 'up',
    clarityChange: 'up',
    confidenceChange: 'same',
    nextIntent: 'continue',
    freeTextReflection: '회복부터 잘 했더니 자신감이 돌아왔어요.',
    completedAt: '2026-07-01T10:30:00Z',
  };
  const out = normalizeFollowUp30d(rich);
  check('normalize: kitchen-sink fully preserved',
    JSON.stringify(out) === JSON.stringify(rich));
}

// ─── isFollowUp30dEmpty ─────────────────────────────────────────────────────
check('isEmpty: undefined → true',
  isFollowUp30dEmpty(undefined) === true);
check('isEmpty: null → true',
  isFollowUp30dEmpty(null) === true);
check('isEmpty: {} → true',
  isFollowUp30dEmpty({}) === true);
check('isEmpty: { completedPlan: true } → false',
  isFollowUp30dEmpty({ completedPlan: true }) === false);

// ─── mergeFollowUp30d ───────────────────────────────────────────────────────
{
  const out = mergeFollowUp30d({ completedPlan: true }, { completionRate: '50' });
  check('merge: existing.completedPlan + patch.completionRate → both present',
    out.completedPlan === true && out.completionRate === '50');
}
{
  // Patch overrides existing on the same key
  const out = mergeFollowUp30d({ energyChange: 'down' }, { energyChange: 'up' });
  check('merge: patch overrides existing on conflicting key (energyChange)',
    out.energyChange === 'up');
}
{
  // Patch with invalid values is dropped (normalized away).
  const out = mergeFollowUp30d(
    { completedPlan: true, energyChange: 'up' },
    { energyChange: 'sideways' as unknown as 'up' },
  );
  check('merge: invalid patch value is dropped; existing value preserved',
    out.energyChange === 'up' && out.completedPlan === true);
}
{
  // null/undefined either side is safe.
  const a = mergeFollowUp30d(undefined, { completedPlan: true });
  const b = mergeFollowUp30d({ completedPlan: true }, undefined);
  const c = mergeFollowUp30d(null, null);
  check('merge: undefined existing + valid patch → patch only',
    a.completedPlan === true && Object.keys(a).length === 1);
  check('merge: valid existing + undefined patch → existing only',
    b.completedPlan === true && Object.keys(b).length === 1);
  check('merge: null + null → {}',
    Object.keys(c).length === 0);
}

// ─── Purity: input objects NOT mutated ──────────────────────────────────────
{
  const raw: CareerCompassFollowUp30d = {
    completedPlan: true,
    actualActionsTaken: ['rest_recovery'],
    freeTextReflection: '  trim me  ',
  };
  const before = JSON.stringify(raw);
  normalizeFollowUp30d(raw);
  check('PURITY: normalizeFollowUp30d does not mutate input',
    JSON.stringify(raw) === before);
}
{
  const existing: CareerCompassFollowUp30d = { completedPlan: true };
  const patch: Partial<CareerCompassFollowUp30d> = { energyChange: 'up' };
  const beforeE = JSON.stringify(existing);
  const beforeP = JSON.stringify(patch);
  mergeFollowUp30d(existing, patch);
  check('PURITY: mergeFollowUp30d does not mutate existing',
    JSON.stringify(existing) === beforeE);
  check('PURITY: mergeFollowUp30d does not mutate patch',
    JSON.stringify(patch) === beforeP);
}

// ─── JSON round-trip — every output is plain JSON ───────────────────────────
{
  const rich: CareerCompassFollowUp30d = {
    completedPlan: false,
    completionRate: '25',
    actualActionsTaken: ['interviews_done', 'networking'],
    energyChange: 'down',
    clarityChange: 'up',
    confidenceChange: 'same',
    nextIntent: 'need_help',
    freeTextReflection: '면접까지 갔지만 결정은 어려웠음.',
    completedAt: '2026-07-01T10:30:00Z',
  };
  const normalized = normalizeFollowUp30d(rich);
  const round = JSON.parse(JSON.stringify(normalized));
  check('JSON: rich follow-up survives stringify+parse equality',
    JSON.stringify(round) === JSON.stringify(normalized));
  check('JSON: no "undefined" literal anywhere in serialized output',
    !JSON.stringify(normalized).includes('undefined'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.5 — Q1 / Q2 user-spec wording verification
// ═══════════════════════════════════════════════════════════════════════════════
{
  const q1 = FOLLOW_UP_30D_QUESTIONS.find((q) => q.field === 'completionRate');
  check('Q1 wording: prompt matches user-spec verbatim',
    q1?.prompt === '지난 30일 동안 추천받은 실행계획을 어느 정도 해봤나요?');
  const labels = (q1?.options ?? []).map((o) => o.id + '→' + o.label).join(';');
  check('Q1 wording: 5 options with user-spec labels',
    labels === '0→거의 못 했어요;25→25% 정도 해봤어요;50→절반 정도 해봤어요;75→대부분 해봤어요;100→거의 다 해봤어요');
}
{
  const q2 = FOLLOW_UP_30D_QUESTIONS.find((q) => q.field === 'actualActionsTaken');
  check('Q2 wording: prompt matches user-spec verbatim',
    q2?.prompt === '실제로 해본 행동은 무엇인가요? 모두 골라주세요.');
  // Each action id maps to its user-spec label.
  const expected: Record<string, string> = {
    rest_recovery: '회복/휴식 루틴',
    job_search: '이직 준비',
    internal_redesign: '내부 역할 조정',
    portfolio_created: '포트폴리오/이력 정리',
    content_published: '콘텐츠 발행',
    interviews_done: '사람 인터뷰/대화',
    market_test: '시장 반응 확인',
    networking: '네트워킹',
    course_learning: '공부/교육',
    no_action: '아무것도 못 했음',
    other: '기타',
  };
  const allMatch = (q2?.options ?? []).every((o) => expected[o.id] === o.label);
  check('Q2 wording: all 11 option labels match user-spec',
    allMatch);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.5 — completedPlan derivation from completionRate
// ═══════════════════════════════════════════════════════════════════════════════
check('deriveCompletedPlanFromRate: "0"   → false',  deriveCompletedPlanFromRate('0')   === false);
check('deriveCompletedPlanFromRate: "25"  → false',  deriveCompletedPlanFromRate('25')  === false);
check('deriveCompletedPlanFromRate: "50"  → true',   deriveCompletedPlanFromRate('50')  === true);
check('deriveCompletedPlanFromRate: "75"  → true',   deriveCompletedPlanFromRate('75')  === true);
check('deriveCompletedPlanFromRate: "100" → true',   deriveCompletedPlanFromRate('100') === true);
check('deriveCompletedPlanFromRate: undefined → undefined',
  deriveCompletedPlanFromRate(undefined) === undefined);
check('deriveCompletedPlanFromRate: null → undefined',
  deriveCompletedPlanFromRate(null) === undefined);

// Normalizer auto-derivation
{
  const out = normalizeFollowUp30d({ completionRate: '0' });
  check('normalize auto-derive: completionRate="0" → completedPlan=false',
    out.completedPlan === false);
}
{
  const out = normalizeFollowUp30d({ completionRate: '25' });
  check('normalize auto-derive: completionRate="25" → completedPlan=false',
    out.completedPlan === false);
}
{
  const out = normalizeFollowUp30d({ completionRate: '50' });
  check('normalize auto-derive: completionRate="50" → completedPlan=true',
    out.completedPlan === true);
}
{
  const out = normalizeFollowUp30d({ completionRate: '75' });
  check('normalize auto-derive: completionRate="75" → completedPlan=true',
    out.completedPlan === true);
}
{
  const out = normalizeFollowUp30d({ completionRate: '100' });
  check('normalize auto-derive: completionRate="100" → completedPlan=true',
    out.completedPlan === true);
}

// Explicit completedPlan is preserved (preservation rule).
{
  const out = normalizeFollowUp30d({ completionRate: '100', completedPlan: false });
  check('normalize: explicit completedPlan=false preserved even with rate=100',
    out.completedPlan === false && out.completionRate === '100');
}
{
  const out = normalizeFollowUp30d({ completionRate: '0', completedPlan: true });
  check('normalize: explicit completedPlan=true preserved even with rate=0',
    out.completedPlan === true && out.completionRate === '0');
}

// completedPlan with no rate provided → preserved as-is, no derivation triggered.
{
  const out = normalizeFollowUp30d({ completedPlan: true });
  check('normalize: completedPlan alone (no rate) → preserved, no derivation',
    out.completedPlan === true && out.completionRate === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.5 — no_action exclusivity in the normalizer
// ═══════════════════════════════════════════════════════════════════════════════
{
  const out = normalizeFollowUp30d({ actualActionsTaken: ['no_action'] });
  check('normalize: ["no_action"] alone → preserved',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['no_action']));
}
{
  const out = normalizeFollowUp30d({
    actualActionsTaken: ['no_action', 'rest_recovery', 'job_search'],
  });
  check('normalize: no_action alongside other actions → no_action DROPPED (affirmative wins)',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['rest_recovery', 'job_search']));
}
{
  const out = normalizeFollowUp30d({
    actualActionsTaken: ['rest_recovery', 'no_action'],
  });
  check('normalize: order-insensitive — no_action dropped even when last',
    JSON.stringify(out.actualActionsTaken) === JSON.stringify(['rest_recovery']));
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.5 — applyActualActionToggle (pure toggle helper)
// ═══════════════════════════════════════════════════════════════════════════════
check('ACTUAL_ACTION_NO_ACTION constant === "no_action"',
  ACTUAL_ACTION_NO_ACTION === 'no_action');

// Empty → add a single action
{
  const out = applyActualActionToggle(undefined, 'rest_recovery');
  check('toggle: undefined + rest_recovery → [rest_recovery]',
    JSON.stringify(out) === JSON.stringify(['rest_recovery']));
}
{
  const out = applyActualActionToggle([], 'job_search');
  check('toggle: [] + job_search → [job_search]',
    JSON.stringify(out) === JSON.stringify(['job_search']));
}

// Add a second action
{
  const out = applyActualActionToggle(['rest_recovery'], 'job_search');
  check('toggle: [rest_recovery] + job_search → [rest_recovery, job_search]',
    JSON.stringify(out) === JSON.stringify(['rest_recovery', 'job_search']));
}

// Deselect
{
  const out = applyActualActionToggle(['rest_recovery', 'job_search'], 'rest_recovery');
  check('toggle: deselect existing action',
    JSON.stringify(out) === JSON.stringify(['job_search']));
}
{
  const out = applyActualActionToggle(['rest_recovery'], 'rest_recovery');
  check('toggle: deselecting the only action returns undefined (collapse)',
    out === undefined);
}

// no_action exclusivity in the toggle
{
  const out = applyActualActionToggle(['rest_recovery', 'job_search'], 'no_action');
  check('toggle: selecting no_action wipes every other action → ["no_action"]',
    JSON.stringify(out) === JSON.stringify(['no_action']));
}
{
  const out = applyActualActionToggle(['no_action'], 'rest_recovery');
  check('toggle: selecting a real action while no_action is on REMOVES no_action',
    JSON.stringify(out) === JSON.stringify(['rest_recovery']));
}
{
  const out = applyActualActionToggle(['no_action'], 'no_action');
  check('toggle: deselecting the only "no_action" returns undefined',
    out === undefined);
}

// Re-toggle from no_action back to no_action via interim selections
{
  const a = applyActualActionToggle(['no_action'], 'rest_recovery'); // → [rest_recovery]
  const b = applyActualActionToggle(a, 'no_action');                  // → [no_action] (wipes)
  check('toggle: round-trip no_action → real → no_action returns to exclusive no_action',
    JSON.stringify(b) === JSON.stringify(['no_action']));
}

// Purity — toggle does not mutate the input array
{
  const arr: ActualActionTaken[] = ['rest_recovery', 'job_search'];
  const before = JSON.stringify(arr);
  applyActualActionToggle(arr, 'no_action');
  check('toggle: PURITY — input array not mutated',
    JSON.stringify(arr) === before);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.6 — Q3–Q7 user-spec wording verification (verbatim match)
// ═══════════════════════════════════════════════════════════════════════════════

// Q3 — energyChange
{
  const q = FOLLOW_UP_30D_QUESTIONS.find((x) => x.field === 'energyChange');
  check('Q3 wording: prompt matches user-spec verbatim',
    q?.prompt === '지금 에너지는 30일 전과 비교해 어떤가요?');
  const expected: Record<string, string> = { down: '더 낮아짐', same: '비슷함', up: '좋아짐' };
  check('Q3 wording: 3 options (down/same/up) with user-spec labels',
    (q?.options ?? []).every((o) => expected[o.id] === o.label)
    && (q?.options ?? []).length === 3);
}

// Q4 — clarityChange
{
  const q = FOLLOW_UP_30D_QUESTIONS.find((x) => x.field === 'clarityChange');
  check('Q4 wording: prompt matches user-spec verbatim',
    q?.prompt === '커리어 방향의 선명도는 어떤가요?');
  const expected: Record<string, string> = { down: '더 흐려짐', same: '비슷함', up: '더 선명해짐' };
  check('Q4 wording: 3 options (down/same/up) with user-spec labels',
    (q?.options ?? []).every((o) => expected[o.id] === o.label)
    && (q?.options ?? []).length === 3);
}

// Q5 — confidenceChange
{
  const q = FOLLOW_UP_30D_QUESTIONS.find((x) => x.field === 'confidenceChange');
  check('Q5 wording: prompt matches user-spec verbatim',
    q?.prompt === '실행할 자신감은 어떤가요?');
  const expected: Record<string, string> = { down: '더 낮아짐', same: '비슷함', up: '좋아짐' };
  check('Q5 wording: 3 options (down/same/up) with user-spec labels (same down/up as Q3 per spec)',
    (q?.options ?? []).every((o) => expected[o.id] === o.label)
    && (q?.options ?? []).length === 3);
}

// Q6 — nextIntent
{
  const q = FOLLOW_UP_30D_QUESTIONS.find((x) => x.field === 'nextIntent');
  check('Q6 wording: prompt matches user-spec verbatim',
    q?.prompt === '다음 단계는 무엇에 가깝나요?');
  const expected: Record<string, string> = {
    continue:         '같은 방향으로 계속해보고 싶음',
    pivot:            '방향을 조금 바꿔보고 싶음',
    pause:            '잠시 멈추고 싶음',
    switch_direction: '완전히 다른 방향을 보고 싶음',
    need_help:        '도움이 더 필요함',
  };
  check('Q6 wording: 5 options with user-spec labels',
    (q?.options ?? []).every((o) => expected[o.id] === o.label)
    && (q?.options ?? []).length === 5);
}

// Q7 — freeTextReflection
{
  const q = FOLLOW_UP_30D_QUESTIONS.find((x) => x.field === 'freeTextReflection');
  check('Q7 wording: prompt matches user-spec verbatim',
    q?.prompt === '남기고 싶은 메모가 있다면 적어주세요.');
  check('Q7 wording: inputType is short_text (free text per spec)',
    q?.inputType === 'short_text');
  check('Q7 wording: no options (free text input)',
    q?.options === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.6 — deriveCompletedPlan alias parity
// ═══════════════════════════════════════════════════════════════════════════════
check('alias: deriveCompletedPlan exists',
  typeof deriveCompletedPlan === 'function');
check('alias: deriveCompletedPlan === deriveCompletedPlanFromRate (same function ref)',
  deriveCompletedPlan === deriveCompletedPlanFromRate);
check('alias parity: deriveCompletedPlan("0")   === false',
  deriveCompletedPlan('0') === false);
check('alias parity: deriveCompletedPlan("25")  === false',
  deriveCompletedPlan('25') === false);
check('alias parity: deriveCompletedPlan("50")  === true',
  deriveCompletedPlan('50') === true);
check('alias parity: deriveCompletedPlan("75")  === true',
  deriveCompletedPlan('75') === true);
check('alias parity: deriveCompletedPlan("100") === true',
  deriveCompletedPlan('100') === true);
check('alias parity: deriveCompletedPlan(undefined) === undefined',
  deriveCompletedPlan(undefined) === undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6.6 — Re-affirm: helpers DO NOT read/touch routing-relevant data
// The functions take only their declared args (CompletionRate, ActualActionTaken
// array/action, raw partial follow-up) — they have no access to result, profile,
// mainTypeKey, planModule, or sourceOptionKey at the type level. The most we
// can assert at runtime is the function arity + that they don't reach into
// any global. The compile-time signature already proves the contract.
{
  check('CONTRACT: deriveCompletedPlan takes exactly 1 arg (no result/profile/routing access)',
    deriveCompletedPlan.length === 1);
  check('CONTRACT: applyActualActionToggle takes exactly 2 args (current + action)',
    applyActualActionToggle.length === 2);
  check('CONTRACT: normalizeFollowUp30d takes exactly 1 arg (raw follow-up only)',
    normalizeFollowUp30d.length === 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
