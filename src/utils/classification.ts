/**
 * classification.ts — Gate-based career decision classification model
 *
 * Avoids over-recommending a single archetype by applying ordered decision gates.
 * Data and user answers are primary; saju is secondary timing reference only.
 */

import type {
  DerivedVariables,
  FormData,
  CareerDecisionClass,
  DecisionGateResult,
  GateScores,
} from '../types';

// ─── Archetype labels ─────────────────────────────────────────────────────────

const CLASS_LABELS: Record<CareerDecisionClass, string> = {
  'stable-maintain':         '현 직장 재설계형',
  'move-while-working':      '재직 중 이동형',
  'accelerate-challenge':    '도전 가속형',
  'recovery-first':          '회복 우선형',
  'prepare-then-switch':     '준비 후 전환형',
  'side-project-validation': '사이드 프로젝트 검증형',
  'hold-and-review':         '보류·점검형',
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

// ─── Individual gate scores (0–100) ──────────────────────────────────────────

/** Stay score: high when stability preference is high and situation is manageable */
export function scoreStay(derived: DerivedVariables, form: FormData): number {
  const { stabilityPreference, burnoutPressure, financialSafetyBase } = derived;
  const sat = ((form.careerStatus.jobSatisfaction + form.careerStatus.growthPotential) / 2 - 1) / 4 * 100;
  return clamp(
    stabilityPreference * 0.35 +
    (100 - burnoutPressure) * 0.25 +
    financialSafetyBase * 0.20 +
    sat * 0.20,
  );
}

/** Job-change score: high when market readiness + dissatisfaction + runway align */
export function scoreJobChange(derived: DerivedVariables, _form: FormData): number {
  const { readinessBehavior, explorationDrive, marketReadinessPercent, runwayMonths, burnoutPressure } = derived;
  const runway = Math.min(100, (runwayMonths / 12) * 100);
  return clamp(
    marketReadinessPercent * 0.35 +
    readinessBehavior * 0.25 +
    explorationDrive * 0.20 +
    runway * 0.10 +
    (100 - burnoutPressure) * 0.10,
  );
}

/** Startup/freelance score: high when exploration + risk tolerance + long runway */
export function scoreStartup(derived: DerivedVariables, form: FormData): number {
  const { explorationDrive, runwayMonths } = derived;
  const rt     = (form.traits.riskTolerance - 1) / 4 * 100;
  const se     = (form.traits.selfEfficacy  - 1) / 4 * 100;
  // 18개월을 100점 기준으로 한 단일 runway 항. financialSafetyBase는 같은 runwayMonths에서
  // 파생되므로 이중 카운트를 피하기 위해 제외.
  const runway = Math.min(100, (runwayMonths / 18) * 100);
  return clamp(
    explorationDrive * 0.30 +
    rt * 0.25 +
    se * 0.20 +
    runway * 0.25,
  );
}

/** Rest score: high when burnout is severe and financial runway permits it */
export function scoreRest(derived: DerivedVariables, _form: FormData): number {
  const { burnoutPressure, runwayMonths } = derived;
  // 6개월을 100점 기준으로 한 단일 runway 항. financialSafetyBase 중복 제외.
  const runway = Math.min(100, (runwayMonths / 6) * 100);
  return clamp(
    burnoutPressure * 0.50 +
    runway * 0.50,
  );
}

/** Prepare-first score: high when exploration drive exceeds current readiness */
export function scorePrepareFirst(derived: DerivedVariables, form: FormData): number {
  const { explorationDrive, marketReadinessPercent: mr, careerAdaptability } = derived;
  const cu          = (form.traits.curiosity - 1) / 4 * 100;
  const readinessGap = Math.max(0, explorationDrive - mr);
  return clamp(
    readinessGap * 0.40 +
    cu * 0.30 +
    careerAdaptability * 0.20 +
    (100 - mr) * 0.10,
  );
}

// ─── Gate classification ──────────────────────────────────────────────────────

/**
 * Applies ordered decision gates and returns a CareerDecisionClass.
 *
 * STRICT GATE ORDER:
 * 0. Financial crisis (runway < 2)           → hold-and-review   [absolute override]
 * 1. Fatigue >= 60                           → recovery-first     [strict pre-check, blocks all expansion gates]
 *    Fatigue >= 75 + no runway               → hold-and-review
 *    Fatigue >= 60 + no runway (2–3 months)  → hold-and-review
 * --- expansion gates only reachable when fatigue < 60 ---
 * 2. Accelerate-challenge — full readiness + high ambition + long runway
 * 3. Side-project-validation — startup drive + limited runway
 * 4. Move-while-working  — good market readiness + dissatisfaction
 * 5. Stable-maintain     — high stability preference + satisfied enough
 * 6. Prepare-then-switch — wants change but readiness gap
 * 7. Hold-and-review     — default fallback
 */
export function classifyByGate(derived: DerivedVariables, form: FormData): CareerDecisionClass {
  const {
    burnoutPressure, runwayMonths, marketReadinessPercent: mr,
    explorationDrive, readinessBehavior, stabilityPreference,
    jobDissatisfaction,
  } = derived;
  const rt = (form.traits.riskTolerance - 1) / 4 * 100;

  // ── STRICT PRE-GATE 0: financial crisis overrides everything ──────────────
  // 단, 월 지출이 100만원 미만(부모 동거·1인가구 저지출)인 경우는 절대 런웨이 의미가 작아
  // financial crisis로 분류하지 않음. 이 경우 다른 신호로 정상 분류 진행.
  if (runwayMonths < 2 && form.basicProfile.monthlyExpense >= 1_000_000) {
    return 'hold-and-review';
  }

  // ── STRICT FATIGUE GATE (checked before ALL expansion gates) ─────────────
  // This is the core enforcement: high fatigue cannot coexist with aggressive strategies.
  if (burnoutPressure >= 75) {
    return runwayMonths >= 3 ? 'recovery-first' : 'hold-and-review';
  }
  if (burnoutPressure >= 70) {
    // Moderate-high fatigue: recovery is needed, but check runway
    return runwayMonths >= 3 ? 'recovery-first' : 'hold-and-review';
  }

  // ── EXPANSION GATES ───────────────────────────────────────────────────────
  // Only reachable when burnoutPressure < 60. No fatigue guards needed below.

  // All cylinders firing → accelerate
  if (mr >= 70 && explorationDrive >= 70 && readinessBehavior >= 65 && runwayMonths >= 9) {
    return 'accelerate-challenge';
  }

  // Strong startup drive + limited runway → side-project validation
  if (rt >= 55 && explorationDrive >= 60 && runwayMonths < 9 && runwayMonths >= 2) {
    return 'side-project-validation';
  }

  // Mobley turnover process: actual search execution requires readiness, not just dissatisfaction.
  // Without readinessBehavior >= 45, the user is in stage 1-2 (dissatisfied, thinking of quitting)
  // but not yet at stage 3 (search intention) — fall through to prepare-then-switch instead.
  if (mr >= 45 && jobDissatisfaction >= 3 && runwayMonths >= 4 && readinessBehavior >= 45) {
    return 'move-while-working';
  }

  // Stable enough to redesign current role
  if (stabilityPreference >= 65 && jobDissatisfaction < 3) {
    return 'stable-maintain';
  }

  // Wants change but readiness gap exists
  if (explorationDrive >= 50 && (mr < 45 || readinessBehavior < 50)) {
    return 'prepare-then-switch';
  }

  return 'hold-and-review';
}

// ─── Context copy ─────────────────────────────────────────────────────────────

function buildPrimaryReason(cls: CareerDecisionClass, derived: DerivedVariables): string {
  const mr = Math.round(derived.marketReadinessPercent);
  const bp = Math.round(derived.burnoutPressure);
  const ed = Math.round(derived.explorationDrive);
  const rb = Math.round(derived.readinessBehavior);
  const sp = Math.round(derived.stabilityPreference);

  switch (cls) {
    case 'recovery-first':
      return `현재 피로도(${bp}/100)가 높아 다른 선택보다 회복이 먼저 필요한 상태입니다.`;
    case 'move-while-working':
      return `이직 경쟁력(${mr}/100)과 변화 의지(${ed}/100)가 재직 중 탐색을 실행할 수 있는 수준입니다.`;
    case 'accelerate-challenge':
      return `이직 경쟁력(${mr}/100), 변화 의지(${ed}/100), 행동 준비도(${rb}/100)가 모두 강해 적극적 전환이 가능한 상태입니다.`;
    case 'stable-maintain':
      return `안정 선호(${sp}/100)가 강하고 현재 상황이 즉각적 변화보다 내부 재설계를 먼저 시도하기에 적합한 상태입니다.`;
    case 'side-project-validation':
      return `창업/독립 성향이 강하지만 재무 여건상 지금 당장 퇴사보다 재직 중 사이드 프로젝트로 먼저 검증하는 것이 더 전략적인 상태입니다.`;
    case 'prepare-then-switch':
      return `변화 의지(${ed}/100)는 있지만, 이직 경쟁력(${mr}/100) 또는 행동 준비도(${rb}/100)를 먼저 높이면 더 유리한 이동이 가능합니다.`;
    case 'hold-and-review':
      return `현재 재무 여건 또는 피로도가 즉각적 행동을 어렵게 만드는 상태입니다. 먼저 기반 조건을 점검하는 것이 적합합니다.`;
  }
}

function buildConditions(cls: CareerDecisionClass, derived: DerivedVariables): string[] {
  const mr = Math.round(derived.marketReadinessPercent);
  const bp = Math.round(derived.burnoutPressure);

  switch (cls) {
    case 'recovery-first':
      return [
        `피로도가 50/100 이하로 낮아지면 이직 탐색 또는 직무 재설계로 전환할 수 있습니다.`,
        `런웨이가 6개월 이상 확보되면 구조화된 휴식도 선택지가 됩니다.`,
      ];
    case 'move-while-working':
      return [
        `이직 경쟁력이 70/100 이상으로 높아지면 더 유리한 조건으로 이동할 수 있습니다.`,
        `피로도가 ${bp >= 55 ? '지금보다 높아지면' : '65 이상으로 높아지면'} 이직 전 회복이 먼저 필요해질 수 있습니다.`,
        `런웨이가 3개월 이하로 줄면 소득 유지가 최우선이 됩니다.`,
      ];
    case 'accelerate-challenge':
      return [
        `런웨이가 9개월 이하로 줄면 창업보다 이직을 먼저 검토하는 것이 안전합니다.`,
        `피로도가 70 이상으로 높아지면 회복 후 실행이 더 효과적입니다.`,
      ];
    case 'stable-maintain':
      return [
        `역할 협상, 프로젝트 변경, 업무 방식 조정 등 내부 조건 개선을 4~8주 내에 시도해 보세요.`,
        `이직 경쟁력이 ${mr < 50 ? '50/100 이상으로 높아지고' : '현재 수준을 유지하면서'} 불만족이 지속되면 이직 탐색이 우선순위가 됩니다.`,
      ];
    case 'side-project-validation':
      return [
        `재직 중 사이드 프로젝트로 유료 고객 1명 이상을 확보하면 퇴사 타이밍을 확신할 수 있습니다.`,
        `런웨이가 9개월 이상 확보되면 창업/프리랜서 전환을 더 자신 있게 실행할 수 있습니다.`,
        `피로도가 지금보다 높아지면 사이드 프로젝트보다 회복이 먼저입니다.`,
      ];
    case 'prepare-then-switch':
      return [
        `이직 경쟁력이 50/100 이상으로 높아지면 재직 중 이동형으로 전환될 수 있습니다.`,
        `목표 직무 현업자 인터뷰 3회 이상이 완료되면 방향이 명확해집니다.`,
        `재직 중 병행 학습으로 포트폴리오를 쌓으면 탐색 성공 가능성이 높아집니다.`,
      ];
    case 'hold-and-review':
      return [
        `런웨이가 3개월 이상으로 늘어나면 탐색을 시작할 수 있습니다.`,
        `피로도가 낮아지면 상황을 재평가하는 것이 적합합니다.`,
      ];
  }
}

// ─── Full classification ──────────────────────────────────────────────────────

export function classifyCareerDecision(derived: DerivedVariables, form: FormData): DecisionGateResult {
  const cls = classifyByGate(derived, form);
  const gateScores: GateScores = {
    stay:         Math.round(scoreStay(derived, form)),
    jobChange:    Math.round(scoreJobChange(derived, form)),
    startup:      Math.round(scoreStartup(derived, form)),
    rest:         Math.round(scoreRest(derived, form)),
    prepareFirst: Math.round(scorePrepareFirst(derived, form)),
  };

  return {
    decisionClass: cls,
    archetypeLabel: CLASS_LABELS[cls],
    primaryReason: buildPrimaryReason(cls, derived),
    gateScores,
    conditions: buildConditions(cls, derived),
  };
}

export function mapDecisionClassToArchetype(cls: CareerDecisionClass): string {
  return CLASS_LABELS[cls];
}
