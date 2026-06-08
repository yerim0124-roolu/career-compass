// ADR-001 — LLM narrative payload builder.
//
// PURE module: assembles the /api/narrative request body from the spine,
// profile, and raw responses. It is the ONLY place that decides what the LLM
// is allowed to see. Facts in → facts out; no engine logic, no scoring.
//
// Contract (same family as profileContext / personalizeNarrativeOpening):
//   • Engines never read NarrativePayload.
//   • This module never mutates its inputs and never affects routing.

import type { ResultSpine, UserProfile, NarrativePayload } from '../types/careerCompass.ts';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import { CAREER_QUESTION_FLOW } from '../data/careerQuestionFlow.ts';

// ─── Korean labels for profile enums (payload-local; display strings only) ───

const AGE_LABELS: Record<NonNullable<UserProfile['ageBand']>, string> = {
  '20_early': '20대 초반', '20_late': '20대 후반',
  '30_early': '30대 초반', '30_late': '30대 후반',
  '40_early': '40대 초반', '40_late_plus': '40대 후반 이상',
};

const TOTAL_STAGE_LABELS: Record<NonNullable<UserProfile['totalCareerStage']>, string> = {
  total_0_3: '총 경력 0~3년', total_3_7: '총 경력 3~7년',
  total_7_12: '총 경력 7~12년', total_12_plus: '총 경력 12년 이상',
  no_fulltime_experience: '본격적 경력 시작 전',
};

const CURRENT_STAGE_LABELS: Record<NonNullable<UserProfile['currentFieldStage']>, string> = {
  current_under_1: '현 분야 1년 미만', current_1_3: '현 분야 1~3년',
  current_3_7: '현 분야 3~7년', current_7_plus: '현 분야 7년 이상',
  multiple_current_fields: '여러 분야 병행 중',
};

const WORK_MODE_LABELS: Record<NonNullable<UserProfile['workMode']>, string> = {
  organization: '조직 소속', professional: '전문직 개업/소속', freelance: '프리랜서',
  founder: '창업/대표', student: '학생/구직', career_break: '커리어 휴식기', multi_work: '복수 일 병행',
};

// Credential-gated professions — switching into/out of these is a stronger
// life-history signal than ordinary role changes (A1 inference material).
const LICENSED_CATEGORIES = new Set([
  'veterinarian', 'vet_nurse', 'doctor', 'nurse', 'pharmacist',
  'healthcare_medical', 'legal_accounting', 'professor', 'teacher',
]);

// Question context labels — keep short; the LLM sees '맥락: 선택지' lines.
const QUESTION_CONTEXT: Record<string, string> = {
  cs_main: '현재 상태',
  ar_roles: '끌리는 역할',
  cv_values: '중요하게 느낀 가치',
  cv_priorities: '우선순위 랭킹(1위부터)',
  fc_1: '양자택일', fc_2: '양자택일', fc_3: '양자택일', fc_4: '양자택일',
  sc_outlook: '자신감·기대',
  rc_options: '지금 보이는 선택지',
  rc_runway: '재정 런웨이',
  rc_energy: '에너지',
  rc_risk: '감당 가능한 리스크',
  rc_validation: '시장 검증 경험',
  or_content: '콘텐츠 방향에 대한 반응',
  or_venture: '창업 방향에 대한 반응',
  or_internal: '사내 이동에 대한 반응',
  cs_blocker: '결정을 미루게 만드는 가장 큰 것',
  ap_experiment: '직접 고른 30일 실험',
};

function cleanBlocker(rationale: string): string {
  const head = rationale.split('→')[0].trim().replace(/[,，]\s*$/, '');
  return head;
}

// ─── Deterministic cross-signal detection (catalog A1 / A3 / A5) ─────────────
// Few-shot alone fired these unreliably (golden review: the vet career-change
// signal was skipped entirely). The engine now DETECTS candidates as plain
// observations; the LLM only decides which to verbalize and how.

const STAGE_RANK: Partial<Record<NonNullable<UserProfile['totalCareerStage']>, number>> = {
  total_0_3: 0, total_3_7: 1, total_7_12: 2, total_12_plus: 3,
};
const CURRENT_RANK: Partial<Record<NonNullable<UserProfile['currentFieldStage']>, number>> = {
  current_under_1: 0, current_1_3: 0, current_3_7: 1, current_7_plus: 2,
};

const CHALLENGE_EXPERIMENTS = new Set(['ap_interview', 'ap_content', 'ap_writing', 'ap_portfolio']);
const SAFETY_FIRST_RANKS = new Set(['pr_stability', 'pr_recovery']);

function detectInferenceHints(profile: UserProfile, responses: FlowResponses): string[] {
  const hints: string[] = [];

  // A1 — large gap between total career and current-field tenure → switch history.
  const t = profile.totalCareerStage ? STAGE_RANK[profile.totalCareerStage] : undefined;
  const c = profile.currentFieldStage ? CURRENT_RANK[profile.currentFieldStage] : undefined;
  if (t !== undefined && c !== undefined && t - c >= 2) {
    const licensed = profile.jobRoleCategory && LICENSED_CATEGORIES.has(profile.jobRoleCategory);
    hints.push(
      `이력 신호: ${TOTAL_STAGE_LABELS[profile.totalCareerStage!]}이지만 ${CURRENT_STAGE_LABELS[profile.currentFieldStage!]} — 과거에 분야를 크게 바꾼 이력이 있을 가능성${licensed ? ' (자격이 필요한 전문직으로의 전환이라 신호가 더 강함)' : ''}`,
    );
  }
  if (profile.currentFieldStage === 'multiple_current_fields') {
    hints.push('이력 신호: 여러 분야를 병행 중 — 한 정체성으로 좁히지 않(못)하는 상태일 가능성');
  }

  // A3 — flat profile: broad value selection + long deliberate ranking.
  const valueCount = responses.cv_values?.selectedOptionIds?.length ?? 0;
  const rankingCount = responses.cv_priorities?.ranking?.length ?? 0;
  if (valueCount >= 4 || rankingCount >= 5) {
    hints.push('프로파일 신호: 가치 선택 폭이 넓음 — 선택지를 닫는 것을 손해로 느끼는 성향일 가능성');
  }

  // A3 — inconsistent profile: safety-first values alongside venture pull.
  const topRank = responses.cv_priorities?.ranking?.[0];
  const ventureRole = responses.ar_roles?.selectedOptionIds?.includes('ar_founder') ?? false;
  if (topRank === 'pr_stability' && ventureRole) {
    hints.push('프로파일 신호: 우선순위 1위는 안정인데 끌리는 역할은 창업가 — 원하는 것과 스스로 허락한 것이 다른 상태일 가능성');
  }

  // A5 — stated vs revealed: safety-first ranking but a challenge-type experiment chosen by hand.
  const chosenExperiment = responses.ap_experiment?.selectedOptionIds?.[0];
  if (topRank && SAFETY_FIRST_RANKS.has(topRank) && chosenExperiment && CHALLENGE_EXPERIMENTS.has(chosenExperiment)) {
    hints.push('선호 신호: 말로는 안정·회복이 1순위인데 직접 고른 실험은 도전형 — 손이 먼저 간 쪽이 진심일 가능성');
  }

  return hints;
}

function buildAnswerHighlights(responses: FlowResponses): string[] {
  const out: string[] = [];
  for (const step of CAREER_QUESTION_FLOW) {
    const ctx = QUESTION_CONTEXT[step.id];
    if (!ctx) continue;
    const r = responses[step.id];
    if (!r) continue;
    const optionLabel = (id: string): string =>
      step.options?.find((o) => o.id === id)?.label ?? id;
    if (r.ranking && r.ranking.length > 0) {
      out.push(`${ctx}: ${r.ranking.map(optionLabel).join(' > ')}`);
    } else if (r.selectedOptionIds && r.selectedOptionIds.length > 0) {
      out.push(`${ctx}: ${r.selectedOptionIds.map(optionLabel).join(', ')}`);
    }
  }
  return out;
}

export function buildNarrativePayload(
  spine: ResultSpine,
  profile: UserProfile,
  responses: FlowResponses,
): NarrativePayload {
  const traits = profile.jobRoleCategory
    ? (LICENSED_CATEGORIES.has(profile.jobRoleCategory) ? '전문직(자격 기반)' : '일반 직군')
    : undefined;

  const payload: NarrativePayload = {
    profile: {
      ...(profile.jobRoleRaw ? { jobRoleRaw: profile.jobRoleRaw } : {}),
      ...(traits ? { jobRoleTraits: traits } : {}),
      ...(profile.ageBand ? { ageBand: AGE_LABELS[profile.ageBand] } : {}),
      ...(profile.workMode ? { workMode: WORK_MODE_LABELS[profile.workMode] } : {}),
      ...(profile.totalCareerStage ? { totalCareerStage: TOTAL_STAGE_LABELS[profile.totalCareerStage] } : {}),
      ...(profile.currentFieldStage ? { currentFieldStage: CURRENT_STAGE_LABELS[profile.currentFieldStage] } : {}),
    },
    recommendation: {
      currentBestMove: spine.currentBestMove.label,
      ...(spine.strategicDirection
        ? { strategicDirection: `${spine.strategicDirection.label} (조건부 검증 중)` }
        : {}),
      coreExperiment: spine.executionPlan.coreExperiment.label,
      ...(spine.conditionalOption
        ? { conditionalOption: { label: spine.conditionalOption.label, blockedBy: cleanBlocker(spine.conditionalOption.rationale) } }
        : {}),
      ...(spine.pauseOption
        ? { pausedOption: { label: spine.pauseOption.label, blockedBy: cleanBlocker(spine.pauseOption.rationale) } }
        : {}),
      confidenceBand: spine.evidence.confidenceBand,
      resultMode: spine.resultMode,
    },
    answerHighlights: buildAnswerHighlights(responses),
    constructSignals: spine.evidence.constructSignals.map(
      (s) => `${s.humanLabel} ${s.level === 'high' ? '높음' : '낮음'}`,
    ),
  };

  const hints = detectInferenceHints(profile, responses);
  if (hints.length > 0) payload.inferenceHints = hints;

  const concern = (profile.concernFreeText ?? '').trim();
  if (concern.length > 0) payload.userConcern = concern.slice(0, 300);

  return payload;
}
