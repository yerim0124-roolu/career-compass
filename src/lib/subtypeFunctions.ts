// ─────────────────────────────────────────────────────────────────────────────
// subtypeFunctions.ts — Career Compass v2 개인화 레이어
//
// mainType 안에서 한 단계 더 내려가 primarySubtype / secondarySubtype 을 *점수 합산*으로
// 고른다. classifyMainType의 first-match 문제를 subtype에서 반복하지 않기 위함.
//
// 입력: CareerProfile — 엔진 신호(벡터·construct·게이트·fit·원답변)를 불린/숫자 플래그로 평탄화한 것.
//        (실제 채우기는 resultContextEngine.ts의 buildCareerProfile이 담당.)
// 출력: SubtypeResult — { primary, secondary, confidence(raw 점수차), scores(디버깅용), blended }
//
// 원칙:
//  - subtype은 score map 후 최고점 선택. 동점이면 tiebreaker 우선순위.
//  - subtypeConfidence = primaryScore − secondaryScore (raw). < BLEND_THRESHOLD 면 혼합 서사.
//  - subtype 간 max score 스케일을 비슷하게(대략 5~9) 맞춰 BLEND_THRESHOLD가 일관되게 작동.
//  - raw scores를 그대로 반환해, 특정 subtype 과발동 시 가중치 튜닝이 가능하게.
//  - leverageReady = pullDirection 단일 분기, emergingLeader = 단일 subtype.
// ─────────────────────────────────────────────────────────────────────────────

export const BLEND_THRESHOLD = 3; // primaryScore − secondaryScore < 3 → blended

export interface SubtypeResult {
  primary: string;
  secondary: string;
  /** primaryScore − secondaryScore (raw). 작을수록 두 subtype이 비슷하게 강함. */
  confidence: number;
  /** subtype별 raw 점수 — 디버깅·튜닝용. */
  scores: Record<string, number>;
  /** confidence < BLEND_THRESHOLD */
  blended: boolean;
}

// 엔진 신호를 평탄화한 입력. 전부 평탄 불린/숫자라 테스트 fixture를 손으로 만들기 쉽다.
export interface CareerProfile {
  // ── conflictedAtFork ──
  financialSafetyHigh: boolean;
  runwayTight: boolean;
  riskLow: boolean;
  nrSafety: boolean;
  expertiseHigh: boolean;
  nrContinuity: boolean;
  assetLeverageHigh: boolean;
  csBlockerSocialGaze: boolean;
  csBlockerIrreversible: boolean;
  autonomyHigh: boolean;
  creativityHigh: boolean;
  workModeOrg: boolean;
  mcdaConflict: boolean;
  top2ScoresClose: boolean;
  cvValuesMany: boolean;
  lossAversionHigh: boolean;
  // ── scatteredExplorer ──
  nrExplore: boolean;
  optionClosureResistanceHigh: boolean;
  marketInfoGapHigh: boolean;
  executionReadinessLow: boolean;
  recentBehaviorResearching: boolean;
  curiosityHigh: boolean;
  selectedRoleCount: number;
  cvValuesBroad: boolean;
  cvValues3: boolean; // 정확히 3개 선택 — valuePreservation 보조점 조건용
  goalClarityLow: boolean;
  // ── unvalidatedAspirant ──
  selfEfficacyHigh: boolean;
  outcomeExpectationLow: boolean;
  marketValidationUnvalidated: boolean;
  selfEfficacyLow: boolean;
  outcomeExpectationHigh: boolean;
  scMarketOnly: boolean;
  energyStrained: boolean;
  timeConstraintHigh: boolean;
  executionDriveLow: boolean;
  // ── overloadedBurnout ──
  energyDepleted: boolean;
  recoveryNeedHigh: boolean;
  readinessGapHigh: boolean;
  optionOverloadHigh: boolean;
  contextualBarrierHigh: boolean;
  stabilityHigh: boolean;
  // ── realityLocked ──
  runwayCritical: boolean;
  riskNone: boolean;
  riskTimeOnly: boolean;
  runwayModerate: boolean;
  // ── lowOptionVisibility ──
  selfInfoGapHigh: boolean;
  selfInfoGapLow: boolean;
  creativityLow: boolean;
  roleSelectionScattered: boolean;
  // ── plateauedPerformer ──
  assetLeverageLow: boolean;
  curiosityLow: boolean;
  marketPotentialLow: boolean;
  impactLow: boolean;
  contentBrandFitHigh: boolean;
  advisoryFitHigh: boolean;
  // ── restlessStabilizer ──
  autonomyLow: boolean;
  // ── leverageReady ──
  pullDirection: string; // CareerOptionKey: contentBrand | advisoryTeaching | investAnalysis | independent | startup | ...
  // ── friction/readiness 전용 (subtype 점수엔 미사용, resultContextEngine이 소비) ──
  marketValidationPartial: boolean;
  careerCapitalAnxiety: boolean;
}

const num = (b: boolean, n: number): number => (b ? n : 0);

// 공통: scores → primary/secondary/confidence. 동점은 tiebreaker(앞쪽 우선).
function resolveSubtype(scores: Record<string, number>, tiebreaker: string[]): SubtypeResult {
  const sorted = [...tiebreaker].sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a];
    return tiebreaker.indexOf(a) - tiebreaker.indexOf(b); // 동점 → 우선순위 앞쪽
  });
  const primary = sorted[0];
  const secondary = sorted[1] ?? sorted[0];
  const confidence = scores[primary] - scores[secondary];
  return { primary, secondary, confidence, scores, blended: confidence < BLEND_THRESHOLD };
}

// 단일 subtype(leverage 분기·emergingLeader)용 — 혼합 없음.
function single(key: string): SubtypeResult {
  return { primary: key, secondary: key, confidence: Infinity, scores: { [key]: 1 }, blended: false };
}

// ─── conflictedAtFork ─────────────────────────────────────────────────────────
export function getConflictedSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    incomeRisk:
      num(p.financialSafetyHigh, 3) + num(p.runwayTight, 2) + num(p.riskLow, 2) + num(p.nrSafety, 2),
    careerCapitalContinuity:
      num(p.expertiseHigh, 3) + num(p.nrContinuity, 3) + num(p.assetLeverageHigh, 1),
    identityTransition:
      num(p.csBlockerSocialGaze || p.csBlockerIrreversible, 3) +
      num(p.autonomyHigh || p.creativityHigh, 2) + num(p.workModeOrg, 1),
    valuePreservation:
      num(p.mcdaConflict, 3) + num(p.top2ScoresClose, 2) + num(p.cvValuesMany, 2) + num(p.lossAversionHigh, 1)
      // 가치 정확히 3개는 그 자체로 약한 신호 — 두 방향이 팽팽(top2Close)하고 상실감(lossAversion)이
      // 동반될 때만 보조점 +1. (단독 3개로는 valuePreservation 과발동을 막음)
      + num(p.cvValues3 && p.top2ScoresClose && p.lossAversionHigh, 1),
  };
  return resolveSubtype(scores, ['incomeRisk', 'careerCapitalContinuity', 'identityTransition', 'valuePreservation']);
}

// ─── scatteredExplorer ────────────────────────────────────────────────────────
export function getScatteredSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    possibilityClosureAvoidance:
      num(p.nrExplore, 4) + num(p.optionClosureResistanceHigh, 3),
    researchLoop:
      num(p.marketInfoGapHigh, 3) + num(p.executionReadinessLow, 2) + num(p.recentBehaviorResearching, 2),
    curiositySpread:
      num(p.curiosityHigh, 2) + num(p.selectedRoleCount >= 3, 2) + num(p.cvValuesBroad, 2) + num(p.goalClarityLow, 1),
  };
  return resolveSubtype(scores, ['possibilityClosureAvoidance', 'researchLoop', 'curiositySpread']);
}

// ─── unvalidatedAspirant ──────────────────────────────────────────────────────
export function getValidationSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    marketResponseUnknown:
      num(p.selfEfficacyHigh, 3) + num(p.outcomeExpectationLow, 3) + num(p.marketValidationUnvalidated, 2),
    selfFitUnknown:
      num(p.selfEfficacyLow, 3) + num(p.outcomeExpectationHigh, 2) + num(p.scMarketOnly, 2),
    sustainabilityUnknown:
      num(p.energyStrained, 3) + num(p.timeConstraintHigh, 2) + num(p.executionDriveLow, 2),
  };
  // 동점 우선순위: 에너지 문제(지속가능)가 다른 검증보다 선행
  return resolveSubtype(scores, ['sustainabilityUnknown', 'marketResponseUnknown', 'selfFitUnknown']);
}

// ─── overloadedBurnout ────────────────────────────────────────────────────────
export function getBurnoutSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    energyDepletion:
      num(p.energyDepleted, 5) + num(p.recoveryNeedHigh, 2),
    decisionOverload:
      num(p.readinessGapHigh, 3) + num(p.optionOverloadHigh, 2) + num(p.energyStrained, 2),
    environmentDrain:
      num(p.contextualBarrierHigh, 3) + num(p.energyStrained, 2) + num(p.stabilityHigh, 1),
  };
  return resolveSubtype(scores, ['energyDepletion', 'decisionOverload', 'environmentDrain']);
}

// ─── realityLocked ────────────────────────────────────────────────────────────
export function getRealitySubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    runwayShortage:
      num(p.runwayCritical, 5) + num(p.runwayTight, 3),
    lossIntolerance:
      num(p.riskNone || p.riskTimeOnly, 3) + num(p.lossAversionHigh, 3) + num(p.runwayModerate, 1),
    externalConstraint:
      num(p.contextualBarrierHigh, 4) + num(p.timeConstraintHigh, 2),
  };
  return resolveSubtype(scores, ['runwayShortage', 'externalConstraint', 'lossIntolerance']);
}

// ─── lowOptionVisibility ──────────────────────────────────────────────────────
export function getVisibilitySubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    selfInfoGap:
      num(p.selfInfoGapHigh, 4) + num(p.goalClarityLow, 2) + num(p.creativityLow, 1),
    marketInfoGap:
      num(p.marketInfoGapHigh, 4) + num(p.curiosityHigh, 2),
    roleLanguageGap:
      num(p.creativityHigh || p.autonomyHigh, 2) + num(p.roleSelectionScattered, 2) +
      num(p.goalClarityLow, 2) + num(p.selfInfoGapLow, 1), // 자기는 알지만 부를 언어가 없음
  };
  return resolveSubtype(scores, ['selfInfoGap', 'marketInfoGap', 'roleLanguageGap']);
}

// ─── plateauedPerformer ───────────────────────────────────────────────────────
export function getPlateauSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    expertiseStagnation:
      num(p.expertiseHigh, 2) + num(p.assetLeverageLow, 2) + num(p.curiosityLow, 2),
    recognitionGap:
      num(p.expertiseHigh, 2) + num(p.marketPotentialLow, 3) + num(p.impactLow, 2),
    assetUnleveraged:
      num(p.expertiseHigh, 2) + num(p.contentBrandFitHigh || p.advisoryFitHigh, 3) + num(p.executionDriveLow, 1),
  };
  return resolveSubtype(scores, ['assetUnleveraged', 'recognitionGap', 'expertiseStagnation']);
}

// ─── restlessStabilizer ───────────────────────────────────────────────────────
export function getRestlessSubtype(p: CareerProfile): SubtypeResult {
  const scores = {
    meaningDecline:
      num(p.impactLow, 3) + num(p.stabilityHigh, 2) + num(p.energyStrained, 1),
    autonomyDeficit:
      num(p.autonomyLow, 3) + num(p.stabilityHigh, 2) + num(p.creativityHigh, 2),
    growthRoutineAbsent:
      num(p.assetLeverageLow, 3) + num(p.curiosityHigh, 2) + num(p.goalClarityLow, 2),
  };
  return resolveSubtype(scores, ['autonomyDeficit', 'meaningDecline', 'growthRoutineAbsent']);
}

// ─── leverageReady (pullDirection 단일 분기) ──────────────────────────────────
const LEVERAGE_BY_PULL: Record<string, string> = {
  contentBrand: 'contentLeverage',
  advisoryTeaching: 'advisoryLeverage',
  investAnalysis: 'analysisLeverage',
  independent: 'independentPilot',
  startup: 'startupPrep',
};
export function getLeverageSubtype(p: CareerProfile): SubtypeResult {
  return single(LEVERAGE_BY_PULL[p.pullDirection] ?? 'generalLeverage');
}

// ─── dispatcher ───────────────────────────────────────────────────────────────
export function getSubtype(mainType: string, p: CareerProfile): SubtypeResult {
  switch (mainType) {
    case 'conflictedAtFork':    return getConflictedSubtype(p);
    case 'scatteredExplorer':   return getScatteredSubtype(p);
    case 'unvalidatedAspirant': return getValidationSubtype(p);
    case 'overloadedBurnout':   return getBurnoutSubtype(p);
    case 'realityLocked':       return getRealitySubtype(p);
    case 'lowOptionVisibility': return getVisibilitySubtype(p);
    case 'plateauedPerformer':  return getPlateauSubtype(p);
    case 'restlessStabilizer':  return getRestlessSubtype(p);
    case 'leverageReady':       return getLeverageSubtype(p);
    case 'emergingLeader':      return single('default');
    default:                    return single('default');
  }
}

// 테스트·소비처 편의용 — 전부 false/0/'' 기본값. fixture는 이걸 spread 후 필요한 플래그만 켠다.
export function emptyCareerProfile(): CareerProfile {
  return {
    financialSafetyHigh: false, runwayTight: false, riskLow: false, nrSafety: false,
    expertiseHigh: false, nrContinuity: false, assetLeverageHigh: false,
    csBlockerSocialGaze: false, csBlockerIrreversible: false, autonomyHigh: false, creativityHigh: false, workModeOrg: false,
    mcdaConflict: false, top2ScoresClose: false, cvValuesMany: false, lossAversionHigh: false,
    nrExplore: false, optionClosureResistanceHigh: false, marketInfoGapHigh: false, executionReadinessLow: false,
    recentBehaviorResearching: false, curiosityHigh: false, selectedRoleCount: 0, cvValuesBroad: false, cvValues3: false, goalClarityLow: false,
    selfEfficacyHigh: false, outcomeExpectationLow: false, marketValidationUnvalidated: false,
    selfEfficacyLow: false, outcomeExpectationHigh: false, scMarketOnly: false,
    energyStrained: false, timeConstraintHigh: false, executionDriveLow: false,
    energyDepleted: false, recoveryNeedHigh: false, readinessGapHigh: false, optionOverloadHigh: false,
    contextualBarrierHigh: false, stabilityHigh: false,
    runwayCritical: false, riskNone: false, riskTimeOnly: false, runwayModerate: false,
    selfInfoGapHigh: false, selfInfoGapLow: false, creativityLow: false, roleSelectionScattered: false,
    assetLeverageLow: false, curiosityLow: false, marketPotentialLow: false, impactLow: false,
    contentBrandFitHigh: false, advisoryFitHigh: false, autonomyLow: false,
    pullDirection: '',
    marketValidationPartial: false, careerCapitalAnxiety: false,
  };
}
