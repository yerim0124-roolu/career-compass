// Career Compass 2.0 — P2.6 30-day follow-up schema + question design.
//
// This module defines the SHAPE of a 30-day follow-up record, the question
// designs that map to its fields, and pure helpers that normalize raw input.
// It is intentionally SCHEMA-ONLY:
//
// ─── DELIBERATELY NOT IMPLEMENTED ────────────────────────────────────────────
//   • reminders / scheduled notifications / email sending
//   • server APIs / database writes / external storage
//   • telemetry / dashboards / paid data export
//   • automatic re-routing based on follow-up answers
//
// ─── DELIBERATELY NOT CHANGED ────────────────────────────────────────────────
//   • CAREER_QUESTION_FLOW, FlowResponses, mainTypeKey, sourceOptionKey,
//     planModule, activeLenses, bestMove, closingLine, P1.7 burnout invariant
//   • Profile context summary behavior
//   • jobRoleNormalizer behavior
//   • Analytics object existing fields (followUp30d is purely additive)
//
// ─── HARD INVARIANTS ────────────────────────────────────────────────────────
//   • normalizeFollowUp30d / isFollowUp30dEmpty / mergeFollowUp30d are PURE.
//     They never mutate inputs, never touch I/O, never call the engine.
//   • Routing and result computation never consume followUp30d. The session-
//     level routing fingerprint stays bit-identical with or without it.

// ─── Schema ──────────────────────────────────────────────────────────────────

export const FOLLOW_UP_30D_SCHEMA_VERSION = '1.0.0' as const;
export type FollowUp30dSchemaVersion = typeof FOLLOW_UP_30D_SCHEMA_VERSION;

export type CompletionRate = '0' | '25' | '50' | '75' | '100';

export type ActualActionTaken =
  | 'rest_recovery'
  | 'job_search'
  | 'internal_redesign'
  | 'portfolio_created'
  | 'content_published'
  | 'interviews_done'
  | 'market_test'
  | 'networking'
  | 'course_learning'
  | 'no_action'
  | 'other';

export type Trinary = 'down' | 'same' | 'up';

export type NextIntent =
  | 'continue'
  | 'pivot'
  | 'pause'
  | 'switch_direction'
  | 'need_help';

// The user-spec shape. All fields are optional so partial fills, ad-hoc
// patches, and "user skipped the form entirely" all encode as the same type.
export interface CareerCompassFollowUp30d {
  completedPlan?: boolean;
  completionRate?: CompletionRate;
  actualActionsTaken?: ActualActionTaken[];
  energyChange?: Trinary;
  clarityChange?: Trinary;
  confidenceChange?: Trinary;
  nextIntent?: NextIntent;
  freeTextReflection?: string;
  // ISO 8601 if provided. Schema accepts any non-empty string; downstream is
  // free to require Date.parse() validity. We don't auto-generate via
  // Date.now() — caller-injected timestamps keep this module pure.
  completedAt?: string;
}

// ─── Question definitions ────────────────────────────────────────────────────

export type FollowUp30dInputType =
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'short_text';

export interface FollowUp30dOption {
  id: string;
  label: string;
}

export interface FollowUp30dQuestion {
  id: string;
  field: keyof CareerCompassFollowUp30d;
  prompt: string;
  inputType: FollowUp30dInputType;
  options?: FollowUp30dOption[];
  // All follow-up answers are optional — skip-friendly form.
  required: false;
}

// 9 question slots — 8 user-facing + completedAt is auto-attached at save time
// by the caller, not asked as a UI question.
export const FOLLOW_UP_30D_QUESTIONS: readonly FollowUp30dQuestion[] = [
  {
    id: 'fu_completedPlan',
    field: 'completedPlan',
    prompt: '이번 달 추천된 실험을 완료하셨나요?',
    inputType: 'boolean',
    required: false,
  },
  {
    id: 'fu_completionRate',
    field: 'completionRate',
    // Q1: completionRate single-select. When the user picks an option here,
    // the UI should ALSO derive completedPlan from the chosen value (see
    // deriveCompletedPlanFromRate / normalizer auto-derivation).
    prompt: '지난 30일 동안 추천받은 실행계획을 어느 정도 해봤나요?',
    inputType: 'single_select',
    required: false,
    options: [
      { id: '0',   label: '거의 못 했어요' },
      { id: '25',  label: '25% 정도 해봤어요' },
      { id: '50',  label: '절반 정도 해봤어요' },
      { id: '75',  label: '대부분 해봤어요' },
      { id: '100', label: '거의 다 해봤어요' },
    ],
  },
  {
    id: 'fu_actualActionsTaken',
    field: 'actualActionsTaken',
    // Q2: actualActionsTaken multi-select. The UI should enforce no_action
    // exclusivity via applyActualActionToggle:
    //   • selecting no_action clears every other selected action,
    //   • selecting any other action removes no_action from the selection.
    prompt: '실제로 해본 행동은 무엇인가요? 모두 골라주세요.',
    inputType: 'multi_select',
    required: false,
    options: [
      { id: 'rest_recovery',     label: '회복/휴식 루틴' },
      { id: 'job_search',        label: '이직 준비' },
      { id: 'internal_redesign', label: '내부 역할 조정' },
      { id: 'portfolio_created', label: '포트폴리오/이력 정리' },
      { id: 'content_published', label: '콘텐츠 발행' },
      { id: 'interviews_done',   label: '사람 인터뷰/대화' },
      { id: 'market_test',       label: '시장 반응 확인' },
      { id: 'networking',        label: '네트워킹' },
      { id: 'course_learning',   label: '공부/교육' },
      { id: 'no_action',         label: '아무것도 못 했음' },
      { id: 'other',             label: '기타' },
    ],
  },
  {
    id: 'fu_energyChange',
    field: 'energyChange',
    prompt: '지금 에너지는 30일 전과 비교해 어떤가요?',
    inputType: 'single_select',
    required: false,
    options: [
      { id: 'down', label: '더 낮아짐' },
      { id: 'same', label: '비슷함' },
      { id: 'up',   label: '좋아짐' },
    ],
  },
  {
    id: 'fu_clarityChange',
    field: 'clarityChange',
    prompt: '커리어 방향의 선명도는 어떤가요?',
    inputType: 'single_select',
    required: false,
    options: [
      { id: 'down', label: '더 흐려짐' },
      { id: 'same', label: '비슷함' },
      { id: 'up',   label: '더 선명해짐' },
    ],
  },
  {
    id: 'fu_confidenceChange',
    field: 'confidenceChange',
    prompt: '실행할 자신감은 어떤가요?',
    inputType: 'single_select',
    required: false,
    options: [
      { id: 'down', label: '더 낮아짐' },
      { id: 'same', label: '비슷함' },
      { id: 'up',   label: '좋아짐' },
    ],
  },
  {
    id: 'fu_nextIntent',
    field: 'nextIntent',
    prompt: '다음 단계는 무엇에 가깝나요?',
    inputType: 'single_select',
    required: false,
    options: [
      { id: 'continue',         label: '같은 방향으로 계속해보고 싶음' },
      { id: 'pivot',            label: '방향을 조금 바꿔보고 싶음' },
      { id: 'pause',            label: '잠시 멈추고 싶음' },
      { id: 'switch_direction', label: '완전히 다른 방향을 보고 싶음' },
      { id: 'need_help',        label: '도움이 더 필요함' },
    ],
  },
  {
    id: 'fu_freeTextReflection',
    field: 'freeTextReflection',
    prompt: '남기고 싶은 메모가 있다면 적어주세요.',
    inputType: 'short_text',
    required: false,
  },
];

// ─── Internal valid-value sets (used by the normalizer) ──────────────────────

const VALID_COMPLETION_RATES: ReadonlySet<string> = new Set(['0', '25', '50', '75', '100']);
const VALID_ACTUAL_ACTIONS: ReadonlySet<string> = new Set([
  'rest_recovery', 'job_search', 'internal_redesign', 'portfolio_created',
  'content_published', 'interviews_done', 'market_test', 'networking',
  'course_learning', 'no_action', 'other',
]);
const VALID_TRINARY: ReadonlySet<string> = new Set(['down', 'same', 'up']);
const VALID_NEXT_INTENTS: ReadonlySet<string> = new Set([
  'continue', 'pivot', 'pause', 'switch_direction', 'need_help',
]);

// ─── Pure helpers ────────────────────────────────────────────────────────────

// P2.6.5 — Derive completedPlan from completionRate per user spec:
//   completedPlan = true   if completionRate ∈ {50, 75, 100}
//   completedPlan = false  if completionRate ∈ {0, 25}
// Returns undefined for any other / missing input so callers can distinguish
// "not derivable" from a definitive false.
export function deriveCompletedPlanFromRate(
  rate: CompletionRate | undefined | null,
): boolean | undefined {
  if (rate === '50' || rate === '75' || rate === '100') return true;
  if (rate === '0' || rate === '25') return false;
  return undefined;
}

// Shorter, user-spec-suggested alias for ergonomics. Same behavior — the two
// names point at the same function reference, so callers can use either.
export const deriveCompletedPlan = deriveCompletedPlanFromRate;

// P2.6.5 — Pure toggle helper for the Q2 multi-select. Mirrors the P2.2
// `applyConstraintTagToggle` pattern. Rules:
//   • Selecting `no_action` makes it EXCLUSIVE — wipes every other action.
//   • Selecting any other action while `no_action` is on REMOVES `no_action`
//     first, then adds the action.
//   • Deselecting always works; deselecting the only remaining action
//     returns undefined so the persisted field collapses cleanly.
export const ACTUAL_ACTION_NO_ACTION: ActualActionTaken = 'no_action';
export function applyActualActionToggle(
  current: ReadonlyArray<ActualActionTaken> | undefined,
  action: ActualActionTaken,
): ActualActionTaken[] | undefined {
  const arr = current ?? [];
  const isSelected = arr.includes(action);

  if (isSelected) {
    const next = arr.filter((a) => a !== action);
    return next.length === 0 ? undefined : next;
  }

  if (action === ACTUAL_ACTION_NO_ACTION) {
    // no_action is exclusive — wipe any prior selection.
    return [ACTUAL_ACTION_NO_ACTION];
  }

  // Selecting any non-`no_action` action: drop no_action if present, then add.
  const withoutNoAction = arr.filter((a) => a !== ACTUAL_ACTION_NO_ACTION);
  return [...withoutNoAction, action];
}


// Normalize a raw partial follow-up payload into a clean, JSON-safe object.
//   • Drops fields whose value is invalid for their enum/type.
//   • Trims `freeTextReflection`; if the trimmed value is empty, omits the
//     field entirely.
//   • For `actualActionsTaken`, drops invalid entries and dedupes; if the
//     resulting array is empty, omits the field.
//   • Never mutates the input.
//   • Never sets a field to `undefined` explicitly — absent fields are simply
//     not present on the returned object (cleaner JSON.stringify shape).
export function normalizeFollowUp30d(
  raw: Partial<CareerCompassFollowUp30d> | null | undefined,
): CareerCompassFollowUp30d {
  if (!raw || typeof raw !== 'object') return {};
  const out: CareerCompassFollowUp30d = {};

  if (typeof raw.completedPlan === 'boolean') {
    out.completedPlan = raw.completedPlan;
  }

  if (typeof raw.completionRate === 'string' && VALID_COMPLETION_RATES.has(raw.completionRate)) {
    out.completionRate = raw.completionRate as CompletionRate;
  }

  if (Array.isArray(raw.actualActionsTaken)) {
    const seen = new Set<string>();
    const filtered: ActualActionTaken[] = [];
    for (const a of raw.actualActionsTaken) {
      if (typeof a === 'string' && VALID_ACTUAL_ACTIONS.has(a) && !seen.has(a)) {
        seen.add(a);
        filtered.push(a as ActualActionTaken);
      }
    }
    // P2.6.5 — no_action exclusivity: if no_action appears alongside any
    // other action, the affirmative actions win (the user did something).
    let resolved = filtered;
    if (resolved.includes(ACTUAL_ACTION_NO_ACTION) && resolved.length > 1) {
      resolved = resolved.filter((a) => a !== ACTUAL_ACTION_NO_ACTION);
    }
    if (resolved.length > 0) out.actualActionsTaken = resolved;
  }

  if (typeof raw.energyChange === 'string' && VALID_TRINARY.has(raw.energyChange)) {
    out.energyChange = raw.energyChange as Trinary;
  }
  if (typeof raw.clarityChange === 'string' && VALID_TRINARY.has(raw.clarityChange)) {
    out.clarityChange = raw.clarityChange as Trinary;
  }
  if (typeof raw.confidenceChange === 'string' && VALID_TRINARY.has(raw.confidenceChange)) {
    out.confidenceChange = raw.confidenceChange as Trinary;
  }

  if (typeof raw.nextIntent === 'string' && VALID_NEXT_INTENTS.has(raw.nextIntent)) {
    out.nextIntent = raw.nextIntent as NextIntent;
  }

  if (typeof raw.freeTextReflection === 'string') {
    const trimmed = raw.freeTextReflection.trim();
    if (trimmed.length > 0) out.freeTextReflection = trimmed;
  }

  if (typeof raw.completedAt === 'string' && raw.completedAt.length > 0) {
    out.completedAt = raw.completedAt;
  }

  // P2.6.5 — Auto-derive completedPlan from completionRate when the caller
  // did NOT explicitly set completedPlan (preservation rule — an explicit
  // boolean from the caller is always honored). This mirrors the Q1 ↔
  // completedPlan mapping the UI is expected to perform on click.
  if (out.completedPlan === undefined && out.completionRate !== undefined) {
    const derived = deriveCompletedPlanFromRate(out.completionRate);
    if (derived !== undefined) out.completedPlan = derived;
  }

  return out;
}

// A follow-up is "empty" when no field carries a value. Used to decide
// whether to attach it to an analytics submission at all.
export function isFollowUp30dEmpty(f: CareerCompassFollowUp30d | undefined | null): boolean {
  if (!f || typeof f !== 'object') return true;
  return Object.keys(f).length === 0;
}

// Merge a patch into an existing follow-up, then re-normalize. Useful when
// the user fills the form across multiple sessions. Patch wins on conflict
// for any field present in the patch; existing values are preserved
// otherwise. Both inputs and the output are pure.
export function mergeFollowUp30d(
  existing: CareerCompassFollowUp30d | undefined | null,
  patch: Partial<CareerCompassFollowUp30d> | undefined | null,
): CareerCompassFollowUp30d {
  const e = normalizeFollowUp30d(existing);
  const p = normalizeFollowUp30d(patch);
  return normalizeFollowUp30d({ ...e, ...p });
}
