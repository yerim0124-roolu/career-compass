// Career Compass 3.0 — P3.0/P3.1 guided chat step model + script.
//
// PURE module: NO React, NO DOM, NO localStorage, NO engine calls.
// Defines the static chat script that wraps the existing UserProfile data +
// CAREER_QUESTION_FLOW so the guided chat UI can render purely from these
// definitions without re-implementing question logic.
//
// ─── HARD INVARIANTS (per user spec) ────────────────────────────────────────
//   • ChatStep is a PRESENTATION LAYER only.
//     - It maps to existing UserProfile + FlowResponses.
//     - It does NOT duplicate career engine logic.
//     - It does NOT create new scoring logic.
//     - It does NOT change question values.
//   • Profile collection populates UserProfile fields using the EXACT enum
//     values the existing ProfileFormView uses.
//   • Main collection reuses CAREER_QUESTION_FLOW data verbatim — every option
//     `value` is a canonical ChoiceOption.id.
//   • The engine call site is the existing buildResultFromResponses entry
//     point. The chat path is purely an alternate UI on top.

import type { UserProfile, QuestionStep, ChoiceOption } from '../types/careerCompass.ts';
import { CAREER_QUESTION_FLOW } from '../data/careerQuestionFlow.ts';

// ─── ChatStep union (user-spec) ─────────────────────────────────────────────
// Adopted verbatim from the user spec, with two presentation-layer extras
// (maxSelect / noneExclusive) so the renderer can enforce the existing
// UserProfile rules (concernTags max 2, constraintTags max 2 + `none`
// mutual exclusivity) without rewriting them.

export type ChatStep =
  | {
      id: string;
      phase: 'profile';
      message: string;
      answerType: 'single_select' | 'multi_select' | 'text';
      targetField: keyof UserProfile;
      options?: Array<{ label: string; value: string }>;
      required?: boolean;
      // Hard cap on multi_select (concernTags / constraintTags / desiredPaths = 2).
      maxSelect?: number;
      // Set on constraintTags only — tells the UI to apply the EXISTING
      // applyConstraintTagToggle helper (which enforces `none` exclusivity +
      // cap), instead of a plain toggle.
      noneExclusive?: boolean;
      // Placeholder hint for text inputs (e.g. jobRoleRaw).
      placeholder?: string;
    }
  | {
      id: string;
      phase: 'main';
      message: string;
      questionId: string;
      answerType: 'single_select' | 'multi_select';
      options: Array<{ label: string; value: string }>;
      required?: boolean;
    }
  | {
      id: string;
      phase: 'result_intro';
      message: string;
    };

// ─── Profile chat steps (10 fields, user-spec verbatim Korean wording) ───────
// Option `value`s are the canonical UserProfile enum literals — when the user
// picks an option, the chat container writes the value verbatim into the
// existing UserProfile structure. Labels are display strings.
//
// Per spec:
//   • Multi-select max 2 for concernTags / constraintTags / desiredPaths.
//   • constraintTags preserves the existing `none`-exclusive behavior via
//     applyConstraintTagToggle.
//   • Every profile step is `required: false` so the user can skip any of them.

const PROFILE_AGE_BAND: Array<{ label: string; value: string }> = [
  { label: '20대 초반',        value: '20_early' },
  { label: '20대 후반',        value: '20_late' },
  { label: '30대 초반',        value: '30_early' },
  { label: '30대 후반',        value: '30_late' },
  { label: '40대 초반',        value: '40_early' },
  { label: '40대 후반 이상',   value: '40_late_plus' },
];

const PROFILE_TOTAL_CAREER_STAGE: Array<{ label: string; value: string }> = [
  { label: '0~3년',                    value: 'total_0_3' },
  { label: '3~7년',                    value: 'total_3_7' },
  { label: '7~12년',                   value: 'total_7_12' },
  { label: '12년 이상',                value: 'total_12_plus' },
  { label: '아직 본격적인 경력은 없어요', value: 'no_fulltime_experience' },
];

const PROFILE_CURRENT_FIELD_STAGE: Array<{ label: string; value: string }> = [
  { label: '1년 미만',                                     value: 'current_under_1' },
  { label: '1~3년',                                        value: 'current_1_3' },
  { label: '3~7년',                                        value: 'current_3_7' },
  { label: '7년 이상',                                     value: 'current_7_plus' },
  { label: '여러 일을 병행 중이라 하나로 말하기 어려워요',   value: 'multiple_current_fields' },
];

const PROFILE_WORK_MODE: Array<{ label: string; value: string }> = [
  { label: '회사/조직에 소속되어 일하고 있어요',     value: 'organization' },
  { label: '전문직으로 일하고 있어요',               value: 'professional' },
  { label: '프리랜서/1인 사업자로 일하고 있어요',    value: 'freelance' },
  { label: '창업자/공동창업자로 일하고 있어요',      value: 'founder' },
  { label: '학생/취업 준비 중이에요',                value: 'student' },
  { label: '퇴사·휴직 후 다음 방향을 찾고 있어요',   value: 'career_break' },
  { label: '여러 일을 병행하고 있어요',              value: 'multi_work' },
];

const PROFILE_TRANSITION_TIMING: Array<{ label: string; value: string }> = [
  { label: '지금 바로 가능해요',           value: 'now' },
  { label: '1~3개월 안에는 가능해요',      value: 'within_1_3_months' },
  { label: '3~6개월 정도 준비가 필요해요', value: 'within_3_6_months' },
  { label: '6개월 이상은 현재 일을 유지해야 해요', value: 'after_6_months' },
  { label: '아직 모르겠어요',              value: 'unknown' },
];

const PROFILE_TRANSITION_INTENT: Array<{ label: string; value: string }> = [
  { label: '막연히 궁금한 정도예요',         value: 'curious' },
  { label: '준비는 해보고 싶어요',           value: 'preparing' },
  { label: '실제로 움직일 생각이 있어요',    value: 'actively_considering' },
  { label: '지금 바로 바꾸고 싶어요',        value: 'ready_to_switch' },
  { label: '당분간은 유지해야 해요',         value: 'must_stay' },
];

const PROFILE_CONCERN_TAGS: Array<{ label: string; value: string }> = [
  { label: '이직할지 고민 중',                     value: 'job_change' },
  { label: '지금 일을 계속해도 되는지 모르겠음',   value: 'stay_or_leave' },
  { label: '하고 싶은 게 너무 많음',               value: 'too_many_options' },
  { label: '뭘 하고 싶은지 잘 안 보임',            value: 'low_option_visibility' },
  { label: '지금 너무 지쳐 있음',                  value: 'burnout' },
  { label: '내 강점을 어떻게 써야 할지 모르겠음',  value: 'strength_unclear' },
  { label: '창업/사이드프로젝트를 해보고 싶음',    value: 'startup_side_project' },
  { label: '프리랜서/독립을 고민 중',              value: 'independent_work' },
  { label: '커리어 정체성이 헷갈림',               value: 'identity_confusion' },
];

const PROFILE_CONSTRAINT_TAGS: Array<{ label: string; value: string }> = [
  { label: '돈',                value: 'money' },
  { label: '시간',              value: 'time' },
  { label: '체력/번아웃',       value: 'energy_burnout' },
  { label: '가족/생활 책임',    value: 'family_responsibility' },
  { label: '자신감 부족',       value: 'low_confidence' },
  { label: '정보 부족',         value: 'information_gap' },
  { label: '주변 시선',         value: 'social_pressure' },
  { label: '경력 공백 걱정',    value: 'career_gap_risk' },
  { label: '딱히 큰 제약은 없음', value: 'none' },
];

const PROFILE_DESIRED_PATHS: Array<{ label: string; value: string }> = [
  { label: '이직',                       value: 'job_change' },
  { label: '현재 일 안에서 역할 조정',   value: 'internal_redesign' },
  { label: '프리랜서/독립',              value: 'freelance' },
  { label: '창업',                       value: 'startup' },
  { label: '사이드프로젝트',             value: 'side_project' },
  { label: '콘텐츠/개인브랜드',          value: 'content_brand' },
  { label: '강의/자문',                  value: 'advisory_teaching' },
  { label: '휴식/회복',                  value: 'rest_recover' },
  { label: '아직 모르겠음',              value: 'undecided' },
];

// ─── PROFILE_CHAT_STEPS (10 fields, in user-spec order) ─────────────────────
// NOTE: pc_concernText(고민 자유 입력)는 제거됨 — LLM 레이어 미연결 상태에선 수집해도
// 어디에도 안 쓰여 첫 화면의 죽은 입력이었다(사용자 피드백). concernFreeText 타입 필드와
// narrativePayload의 userConcern 매핑은 남겨둬, LLM 연결 시 이 스텝만 복원하면 되살아난다.
export const PROFILE_CHAT_STEPS: ChatStep[] = [
  {
    id: 'pc_ageBand', phase: 'profile',
    message: '안녕하세요! 시작 전에 현재 커리어 맥락을 가볍게 볼게요. 연령대는 어디에 가까우세요?',
    answerType: 'single_select', targetField: 'ageBand',
    options: PROFILE_AGE_BAND, required: false,
  },
  {
    id: 'pc_jobRoleRaw', phase: 'profile',
    message: '지금 하고 있는 일이나 직무를 짧게 적어주세요. 예: 회사원, 마케터, 개발자, 수의사, 투자심사역',
    answerType: 'text', targetField: 'jobRoleRaw',
    required: false,
    placeholder: '예: 회사원',
  },
  {
    id: 'pc_totalCareerStage', phase: 'profile',
    message: '전체 커리어 경력은 어느 정도인가요?',
    answerType: 'single_select', targetField: 'totalCareerStage',
    options: PROFILE_TOTAL_CAREER_STAGE, required: false,
  },
  {
    id: 'pc_currentFieldStage', phase: 'profile',
    message: '현재 분야나 직무에서는 어느 정도 일하셨나요?',
    answerType: 'single_select', targetField: 'currentFieldStage',
    options: PROFILE_CURRENT_FIELD_STAGE, required: false,
  },
  {
    id: 'pc_workMode', phase: 'profile',
    message: '현재 일하는 방식은 어디에 가까우세요?',
    answerType: 'single_select', targetField: 'workMode',
    options: PROFILE_WORK_MODE, required: false,
  },
  {
    id: 'pc_transitionTiming', phase: 'profile',
    message: '변화를 생각한다면, 시점은 어느 정도로 보고 계세요?',
    answerType: 'single_select', targetField: 'transitionTiming',
    options: PROFILE_TRANSITION_TIMING, required: false,
  },
  {
    id: 'pc_transitionIntent', phase: 'profile',
    message: '지금 변화에 대한 마음은 어디에 가까우세요?',
    answerType: 'single_select', targetField: 'transitionIntent',
    options: PROFILE_TRANSITION_INTENT, required: false,
  },
  {
    id: 'pc_concernTags', phase: 'profile',
    message: '요즘 가장 큰 커리어 고민은 무엇인가요? 최대 2개까지 골라주세요.',
    answerType: 'multi_select', targetField: 'concernTags',
    options: PROFILE_CONCERN_TAGS, required: false, maxSelect: 2,
  },
  {
    id: 'pc_constraintTags', phase: 'profile',
    message: '현실적으로 가장 걸리는 제약은 무엇인가요? 최대 2개까지 골라주세요.',
    answerType: 'multi_select', targetField: 'constraintTags',
    options: PROFILE_CONSTRAINT_TAGS, required: false,
    maxSelect: 2, noneExclusive: true,
  },
  {
    id: 'pc_desiredPaths', phase: 'profile',
    message: '관심 있는 방향은 무엇인가요? 최대 2개까지 골라주세요.',
    answerType: 'multi_select', targetField: 'desiredPaths',
    options: PROFILE_DESIRED_PATHS, required: false, maxSelect: 2,
  },
];

// ─── Main step assembly (presentation wrapper around CAREER_QUESTION_FLOW) ──
// We do NOT modify CAREER_QUESTION_FLOW or its option values. Each main chat
// step carries:
//   • message    — the existing step.assistantPrompt verbatim
//   • questionId — the existing step.id (the FlowResponses key)
//   • options    — mirror of step.options as {label, value} where value = id
//   • answerType — single_select | multi_select. Mapping:
//       single_select  → 'single_select'
//       forced_choice  → 'single_select'
//       multi_select   → 'multi_select'
//       ranking        → 'multi_select' (container detects via questionId and
//                        renders rank-by-tap; FlowResponses[questionId].ranking
//                        carries the order)
//       optional_short_text (ap_memo only) → NOT rendered in chat (the engine
//                        treats it as optional; skipping it does not affect
//                        the routing fingerprint)

function chatAnswerTypeFor(step: QuestionStep): 'single_select' | 'multi_select' | null {
  switch (step.inputType) {
    case 'single_select':
    case 'forced_choice':
      return 'single_select';
    case 'multi_select':
    case 'ranking':
      return 'multi_select';
    case 'slider_group':
      return 'multi_select'; // not currently used; safe fallback
    case 'optional_short_text':
      return null; // intentionally skipped from the chat MVP
  }
}

function buildMainChatStep(step: QuestionStep): ChatStep | null {
  const answerType = chatAnswerTypeFor(step);
  if (!answerType) return null;
  const options = (step.options ?? []).map((o: ChoiceOption) => ({
    label: o.label,
    value: o.id, // canonical ChoiceOption.id — engine reads this verbatim
  }));
  return {
    id: `mc_${step.id}`,
    phase: 'main',
    message: step.assistantPrompt,
    questionId: step.id,
    answerType,
    options,
    required: !step.optional,
  };
}

// ─── Script assembly ────────────────────────────────────────────────────────

export interface BuildChatScriptOpts {
  includeProfile?: boolean;
}

// Produce the ordered list of ChatStep entries the UI walks through.
// Pure: same input → same output. No I/O. Does NOT call the engine.
//
// Layout: [profile×10, main×N, result_intro×1]
//   • The first profile step's message ("먼저 현재 커리어 맥락을…") doubles
//     as the opening, so no separate result_intro at the top.
//   • One result_intro right before the result render gives the chat a
//     natural pause before the answer cards arrive.
export function buildChatScript(opts: BuildChatScriptOpts = {}): ChatStep[] {
  const { includeProfile = true } = opts;
  const out: ChatStep[] = [];

  if (includeProfile) out.push(...PROFILE_CHAT_STEPS);

  for (const step of CAREER_QUESTION_FLOW) {
    const m = buildMainChatStep(step);
    if (m) out.push(m);
  }

  out.push({
    id: 'ri_to_result',
    phase: 'result_intro',
    message: '여기까지 답해주셨네요. 답변을 토대로 한 달 실험 계획을 정리해 드릴게요.',
  });

  return out;
}

// ─── UI helpers (pure) ──────────────────────────────────────────────────────

// Short Korean label for a selected `value` within a step that carries options.
export function optionLabelFor(
  step: ChatStep,
  value: string,
): string {
  if (step.phase === 'result_intro') return value;
  const opts = step.phase === 'profile' ? (step.options ?? []) : step.options;
  return opts.find((o) => o.value === value)?.label ?? value;
}

// Join multiple selected values into a human-readable answer string.
export function multiLabelFor(
  step: ChatStep,
  values: ReadonlyArray<string>,
): string {
  if (values.length === 0) return '없음';
  return values.map((v) => optionLabelFor(step, v)).join(', ');
}

// Apply a profile answer to a UserProfile object. Pure: returns a new object.
//
//   • single_select → writes the value verbatim (option values are authored to
//     match the UserProfile enum literals for `step.targetField`).
//   • multi_select  → writes the array. Empty array clears the field back to
//     undefined so persistence stays clean (mirrors V2 form behavior).
//   • text          → writes the trimmed string. Empty/whitespace-only clears
//     the field. (jobRoleRaw normalization runs separately via normalizeProfile.)
//
// NOTE: this function does NOT run normalizeJobRole / normalizeProfile. The
// chat container does that one level up — eagerly after every commit — so
// the derived fields (jobRoleCategory etc.) stay in sync.
export function applyProfileAnswer(
  profile: UserProfile,
  step: Extract<ChatStep, { phase: 'profile' }>,
  values: ReadonlyArray<string>,
): UserProfile {
  const next: UserProfile = { ...profile };
  const field = step.targetField;
  if (step.answerType === 'text') {
    const text = (values[0] ?? '').trim();
    if (text.length === 0) {
      delete (next as Record<string, unknown>)[field];
    } else {
      (next as Record<string, unknown>)[field] = text;
    }
    return next;
  }
  if (step.answerType === 'single_select') {
    const v = values[0];
    if (v === undefined) {
      delete (next as Record<string, unknown>)[field];
    } else {
      (next as Record<string, unknown>)[field] = v;
    }
    return next;
  }
  // multi_select
  if (values.length === 0) {
    delete (next as Record<string, unknown>)[field];
  } else {
    (next as Record<string, unknown>)[field] = [...values];
  }
  return next;
}

// Pure max-cap multi-select toggle. Used by the chat UI for concernTags +
// desiredPaths (max 2) — the rule the UI applies:
//   • If `value` is already in `current` → remove it.
//   • Else if `current.length >= max` → no-op (return the existing array).
//   • Else → append.
// `max === undefined` disables the cap. Returns a NEW array (never mutates).
//
// constraintTags uses session.applyConstraintTagToggle instead — that helper
// owns the `none`-exclusive rule and is already covered by session.test.ts.
export function applyCappedToggle(
  current: ReadonlyArray<string>,
  value: string,
  max?: number,
): string[] {
  const selected = current.includes(value);
  if (selected) return current.filter((v) => v !== value);
  if (max !== undefined && current.length >= max) return [...current];
  return [...current, value];
}

// Re-export existing predicates the chat container needs.
export { isStepComplete } from '../components/careerCompassV2/session.ts';

// ─── Progress accounting ────────────────────────────────────────────────────

// How many answer-requiring steps the script contains (used for the subtle
// progress indicator). result_intro steps are narration and don't count.
export function countAnswerSteps(script: ReadonlyArray<ChatStep>): number {
  return script.filter((s) => s.phase !== 'result_intro').length;
}

// Count of answer-requiring steps BEFORE the given cursor position.
export function answerStepsBefore(script: ReadonlyArray<ChatStep>, cursor: number): number {
  let n = 0;
  for (let i = 0; i < cursor && i < script.length; i++) {
    if (script[i].phase !== 'result_intro') n++;
  }
  return n;
}
