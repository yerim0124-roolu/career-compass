// ─────────────────────────────────────────────────────────────────────────────
// resultContextEngine.ts — Career Compass v2 개인화 레이어 (조립부)
//
// 엔진 신호(vector / gates / construct / fit / 원답변)를 받아:
//   1. buildCareerProfile → CareerProfile (평탄 플래그)
//   2. getSubtype          → primary/secondary/confidence (subtypeFunctions.ts)
//   3. getReadinessLevel   → 행동 강도
//   4. getFrictions        → 1·2순위 마찰원
//   5. assembleNarrative   → 결과지 4섹션 중 1·2·3 (blended 분기 포함)
//   6. buildSignals        → "이렇게 판단한 이유" 3줄 (signalMap은 마지막에 주입)
// 를 묶어 ResultContext + 조립된 서사를 반환.
//
// 기존 엔진 파일은 건드리지 않는다. 입력은 ResultContextInput으로 좁게 받아
// 거대한 ResultSpine 타입과의 결합을 피한다(와이어링 단계에서 채워 호출).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CareerVector, ReadinessGates, ConstructProfile,
  RunwayGate, RiskGate, EnergyGate,
  FrictionSource, AssembledNarrative, ResultContext, ReadinessLevel,
} from '../types/careerCompass.ts';
import { RUNWAY_ORDER, RISK_ORDER } from '../types/careerCompass.ts';
// 타입의 정본은 careerCompass.ts. 기존 소비처(signalMap.ts 등) 호환을 위해 재export.
export type { FrictionSource, AssembledNarrative, ResultContext } from '../types/careerCompass.ts';
import {
  getSubtype, emptyCareerProfile, BLEND_THRESHOLD,
  type CareerProfile, type SubtypeResult,
} from './subtypeFunctions.ts';
import { narrativeTemplates, type SubtypeNarrative } from '../data/narrativeTemplates.ts';
import { intentByMainType, conditionBySubtype, responseByReadiness } from '../data/signalMap.ts';

// ── 임계값 (기존 엔진과 동일 스케일) ──
const V_HIGH = 60, V_MOD = 45;            // CareerVector
const C_HIGH = 66, C_PRESENT = 50, C_LOW = 33; // ConstructProfile
const STABILITY_FLOOR = 55;               // classifier가 restless/burnout에서 쓰는 값
const FIT_HIGH = 60;                       // fit 점수 '높음' 기준

// 와이어링 단계에서 buildResultSpine 내부값으로 채워 전달하는 좁은 입력.
export interface ResultContextInput {
  mainType: string;
  vector: CareerVector;
  gates: ReadinessGates;
  construct: ConstructProfile;
  /** fit 내림차순 정렬된 옵션들 (rankCareerOptions 결과). */
  optionFits: ReadonlyArray<{ optionKey: string; fit: number }>;
  /** ar_narrow → 'nr_explore' | 'nr_loss' | 'nr_safety' | 'nr_continuity' | 'nr_unsure' */
  narrowingReason?: string;
  /** ar_roles 선택 개수 */
  selectedRoleCount?: number;
  /** cv_values 선택 개수 */
  cvValueCount?: number;
  /** sc_outlook → 'sc_self_only' | 'sc_market_only' 등 */
  scOutlook?: string;
  /** cs_blocker → 'blk_*' (사회적 시선·되돌리기 어려움 등) */
  csBlocker?: string;
  /** strategicDirection?.optionKey ?? currentBestMove.optionKey (CareerOptionKey) */
  pullDirectionKey?: string;
  /** pullDirection을 노출해도 될 만큼 방향이 또렷한가 */
  pullConfident?: boolean;
}

// ── gate 서수 비교 유틸 ──
const idx = <T extends string>(order: readonly T[], v: T): number => order.indexOf(v);
const runwayAtMost = (g: RunwayGate, lvl: RunwayGate): boolean =>
  g !== 'unknown' && idx(RUNWAY_ORDER, g) <= idx(RUNWAY_ORDER, lvl);
const riskAtMost = (g: RiskGate, lvl: RiskGate): boolean => idx(RISK_ORDER, g) <= idx(RISK_ORDER, lvl);
const energyIs = (g: EnergyGate, lvl: EnergyGate): boolean => g === lvl;

// ─── buildCareerProfile: 엔진 신호 → 평탄 플래그 ────────────────────────────────
export function buildCareerProfile(input: ResultContextInput): CareerProfile {
  const v = input.vector;
  const { scct, adaptability, difficulty, mcda } = input.construct;
  const g = input.gates;
  const fitOf = (key: string): number => input.optionFits.find(o => o.optionKey === key)?.fit ?? 0;
  const top2Close = input.optionFits.length >= 2
    ? (input.optionFits[0].fit - input.optionFits[1].fit) <= 5
    : false;
  const nr = input.narrowingReason;
  const roleCount = input.selectedRoleCount ?? 0;
  const valueCount = input.cvValueCount ?? 0;

  const p = emptyCareerProfile();

  // ── 정체성/선호 (vector) ──
  p.expertiseHigh = v.expertise >= V_HIGH;
  p.autonomyHigh = v.autonomy >= V_HIGH;
  p.autonomyLow = v.autonomy < V_MOD;
  p.creativityHigh = v.creativity >= V_HIGH;
  p.creativityLow = v.creativity < V_MOD;
  p.stabilityHigh = v.stability >= STABILITY_FLOOR;
  p.impactLow = v.impactOrientation < V_MOD;
  p.recoveryNeedHigh = v.recoveryNeed >= V_HIGH;

  // ── 현실 제약 (gates) ──
  p.energyDepleted = energyIs(g.energy, 'depleted');
  p.energyStrained = energyIs(g.energy, 'strained');
  p.runwayCritical = g.runway === 'critical';
  p.runwayTight = runwayAtMost(g.runway, 'tight');     // critical|tight
  p.runwayModerate = g.runway === 'moderate';
  p.riskNone = g.risk === 'none';
  p.riskTimeOnly = riskAtMost(g.risk, 'timeOnly');     // none|timeOnly
  p.riskLow = riskAtMost(g.risk, 'timeOnly');
  p.marketValidationUnvalidated = g.marketValidation === 'unvalidated';
  p.marketValidationPartial = g.marketValidation === 'partial';

  // ── 심리·의사결정 (construct) ──
  p.financialSafetyHigh = mcda.financialSafety >= C_HIGH;
  p.assetLeverageHigh = mcda.assetLeverage >= C_HIGH;
  p.assetLeverageLow = mcda.assetLeverage <= C_LOW;
  p.marketPotentialLow = mcda.marketPotential <= C_LOW;
  p.selfEfficacyHigh = scct.selfEfficacy >= C_HIGH;
  p.selfEfficacyLow = scct.selfEfficacy <= C_LOW;
  p.outcomeExpectationHigh = scct.outcomeExpectation >= C_HIGH;
  p.outcomeExpectationLow = scct.outcomeExpectation <= C_LOW;
  p.goalClarityLow = scct.goalClarity <= C_LOW;
  p.contextualBarrierHigh = scct.contextualBarrier >= C_HIGH;
  p.timeConstraintHigh =
    input.csBlocker === 'blk_time' ||
    (scct.contextualBarrier >= C_HIGH && difficulty.readinessGap < C_HIGH); // blk_time 또는 외부제약 근사
  p.curiosityHigh = adaptability.curiosity >= V_HIGH; // classifier와 동일하게 60 기준
  p.curiosityLow = adaptability.curiosity <= C_LOW;
  p.readinessGapHigh = difficulty.readinessGap >= C_HIGH;
  p.optionOverloadHigh = difficulty.optionOverload >= C_HIGH;
  p.optionClosureResistanceHigh = difficulty.optionOverload >= C_HIGH;
  p.marketInfoGapHigh = difficulty.marketInformationGap >= C_PRESENT;
  p.selfInfoGapHigh = difficulty.selfInformationGap >= C_HIGH;
  p.selfInfoGapLow = difficulty.selfInformationGap <= C_LOW;
  p.mcdaConflict = difficulty.valueConflict >= C_PRESENT;
  p.executionReadinessLow = v.executionDrive < V_MOD;
  p.executionDriveLow = v.executionDrive < V_MOD;
  p.careerCapitalAnxiety = v.expertise >= V_HIGH && mcda.assetLeverage <= C_LOW; // 쌓았는데 못 쓰는 불안

  // ── 가치/마찰 ──
  p.top2ScoresClose = top2Close;
  p.cvValuesMany = valueCount >= 4;   // 3개는 흔해 과발동 → 4개부터 강한 신호
  p.cvValues3 = valueCount === 3;     // 3개는 top2Close && lossAversion 동반 시에만 보조점
  p.cvValuesBroad = valueCount >= 3;  // scattered/curiositySpread용은 그대로
  p.lossAversionHigh = nr === 'nr_loss';

  // ── 좁히기 반응 (ar_narrow → narrowingReason) ──
  p.nrSafety = nr === 'nr_safety';
  p.nrContinuity = nr === 'nr_continuity';
  p.nrExplore = nr === 'nr_explore';

  // ── 원답변 직접 신호 ──
  // sc_market_only = "결과는 따라올 것 같은데(outcome) 내가 잘 해낼지 모름(self-efficacy 약)" → selfFitUnknown 신호
  p.scMarketOnly = input.scOutlook === 'sc_market_only';
  p.csBlockerSocialGaze = input.csBlocker === 'blk_eyes';  // 주변 시선·기대
  p.csBlockerIrreversible = input.csBlocker === 'blk_fail'; // 되돌리기 어려움
  p.selectedRoleCount = roleCount;
  p.roleSelectionScattered = roleCount >= 3 && scct.goalClarity <= C_LOW;

  // ── leverage 방향 ──
  p.pullDirection = input.pullDirectionKey ?? input.optionFits[0]?.optionKey ?? '';

  // ── plateau fit 신호 ──
  p.contentBrandFitHigh = fitOf('contentBrand') >= FIT_HIGH;
  p.advisoryFitHigh = fitOf('advisoryTeaching') >= FIT_HIGH;

  return p;
}

// ─── frictionSource (우선순위 매칭) ─────────────────────────────────────────────
export function getFrictions(p: CareerProfile): [FrictionSource, FrictionSource] {
  const priority: Array<[boolean, FrictionSource]> = [
    [p.runwayTight || p.runwayCritical || (p.riskNone && p.financialSafetyHigh), 'income_uncertainty'],
    [p.nrContinuity || (p.expertiseHigh && p.careerCapitalAnxiety),               'career_capital_loss'],
    [p.csBlockerSocialGaze || p.csBlockerIrreversible,                            'identity_loss'],
    [p.nrExplore || p.optionClosureResistanceHigh,                                'too_many_live_options'],
    [p.marketValidationUnvalidated && p.outcomeExpectationLow,                     'low_market_signal'],
    [p.energyDepleted || p.energyStrained,                                         'low_energy'],
    [p.timeConstraintHigh,                                                          'time_constraint'],
  ];
  const matched = priority.filter(([cond]) => cond).map(([, val]) => val);
  return [matched[0] ?? 'tradeoff_pain', matched[1] ?? 'tradeoff_pain'];
}

// ─── readinessLevel (행동 강도) ─────────────────────────────────────────────────
export function getReadinessLevel(p: CareerProfile): ReadinessLevel {
  if (p.energyDepleted)                                          return 'pause';
  if (p.energyStrained || p.readinessGapHigh)                    return 'reflect_only';
  if (p.goalClarityLow || p.optionOverloadHigh)                  return 'tiny_test';
  if (p.selfEfficacyHigh && p.marketValidationUnvalidated)       return 'structured_test';
  if (p.marketValidationPartial && p.runwayModerate)             return 'commitment_test';
  return 'tiny_test';
}

// ─── 서사 조립 ──────────────────────────────────────────────────────────────────
// readinessLevel에 정확히 맞는 카피가 없으면 가까운 강도로 폴백.
const READINESS_ORDER: ReadinessLevel[] = ['pause', 'reflect_only', 'tiny_test', 'structured_test', 'commitment_test'];

function pickByReadiness(map: Partial<Record<ReadinessLevel, string>>, level: ReadinessLevel): string {
  if (map[level]) return map[level]!;
  const center = READINESS_ORDER.indexOf(level);
  // 가까운 강도부터 바깥으로 탐색
  for (let d = 1; d < READINESS_ORDER.length; d++) {
    const lo = READINESS_ORDER[center - d];
    const hi = READINESS_ORDER[center + d];
    if (lo && map[lo]) return map[lo]!;
    if (hi && map[hi]) return map[hi]!;
  }
  // 그래도 없으면 정의된 첫 값
  const first = Object.values(map)[0];
  return first ?? '';
}

export function assembleNarrative(
  mainType: string,
  sub: SubtypeResult,
  readiness: ReadinessLevel,
): AssembledNarrative {
  const template = narrativeTemplates[mainType];
  // 안전 폴백: 템플릿이 없거나 subtype 키가 빠진 경우
  const primaryNarr: SubtypeNarrative | undefined = template?.subtypes[sub.primary];
  const safe: AssembledNarrative = {
    core: primaryNarr?.core ?? '',
    monthlyApproach: primaryNarr ? pickByReadiness(primaryNarr.monthlyApproach, readiness) : '',
    weeklyMove: primaryNarr ? pickByReadiness(primaryNarr.weeklyMove, readiness) : '',
    isBlended: false,
  };
  if (!template || !primaryNarr) return safe;

  // 혼합: primary의 따뜻한 core를 유지한 채 secondary 한 절만 덧붙인다 → core가 plan과 어긋나지 않음.
  if (sub.blended && sub.primary !== sub.secondary) {
    const note = template.blendNote[sub.secondary];
    if (note) return { ...safe, core: `${safe.core} ${note}`, isBlended: true };
  }
  return safe;
}

// ─── signals: "이렇게 판단한 이유" — 레이어별 3비트 해석형 (규칙 #4) ──────────────
// ① 의지(mainType) → ② 미완료 조건(subtype) → ③ 그래서 제안(friction).
// 각 레이어에서 한 줄씩 뽑아 "…했고, 다만 …하지 못했습니다. …이 핵심이라, 그래서 …".
// 플래그-우선순위 나열을 대체 → 레이어 중복("번아웃에 리스크 신호") 제거.
export function buildSignals(
  mainType: string,
  primarySubtype: string,
  readiness: ReadinessLevel,
): string[] {
  return [
    intentByMainType[mainType],
    conditionBySubtype[primarySubtype],
    responseByReadiness[readiness],
  ].filter(Boolean) as string[];
}

// ─── 최상위 조립 ────────────────────────────────────────────────────────────────
const NO_PULL_TYPES = new Set(['scatteredExplorer', 'lowOptionVisibility', 'overloadedBurnout']);

// 전문성 레버리지 계열 pullDirection. conflictedAtFork에서 이 방향이 또렷하면 subtype과 무관하게
// 첫 문단에 "전문성 끌림" 한 절을 동적 주입한다(전문성 맥락은 여기서만 살림 — 분류 점수엔 안 넣음).
const EXPERTISE_PULL_NOTE: Record<string, string> = {
  contentBrand: '한편으로는 그동안 쌓아온 전문성을 콘텐츠로 펼쳐보고 싶은 끌림도 함께 느껴집니다.',
  advisoryTeaching: '한편으로는 그동안 쌓아온 전문성을 자문·강의로 펼쳐보고 싶은 끌림도 함께 느껴집니다.',
  investAnalysis: '한편으로는 그동안 쌓아온 전문성을 분석·리포트로 펼쳐보고 싶은 끌림도 함께 느껴집니다.',
};

export function buildResultContext(input: ResultContextInput): ResultContext {
  const profile = buildCareerProfile(input);
  const sub = getSubtype(input.mainType, profile);
  const readiness = getReadinessLevel(profile);
  const [primaryFriction, secondaryFriction] = getFrictions(profile);
  let narrative = assembleNarrative(input.mainType, sub, readiness);

  const pullDirection = profile.pullDirection;
  const showPullDirection =
    (input.pullConfident ?? false) && !!pullDirection && !NO_PULL_TYPES.has(input.mainType);

  // 경계 케이스(conflictedAtFork)에서 전문성 레버리지 방향이 또렷하면 → primary+secondary 혼합 서사에
  // 전문성 끌림 한 절을 더해 "단일 subtype으로 누르지 않는" 혼합 서사를 만든다.
  if (input.mainType === 'conflictedAtFork' && (input.pullConfident ?? false)) {
    const pullNote = EXPERTISE_PULL_NOTE[pullDirection];
    if (pullNote) narrative = { ...narrative, core: `${narrative.core} ${pullNote}`, isBlended: true };
  }

  // 규칙 #4 — 레이어별 3비트 해석형: 의지(mainType) → 조건(subtype) → 그래서(행동 강도).
  const signals = buildSignals(input.mainType, sub.primary, readiness);

  return {
    mainType: input.mainType,
    primarySubtype: sub.primary,
    secondarySubtype: sub.secondary,
    subtypeConfidence: sub.confidence,
    subtypeScores: sub.scores,
    pullDirection,
    showPullDirection,
    primaryFriction,
    secondaryFriction,
    readinessLevel: readiness,
    narrative,
    signals,
  };
}

export { BLEND_THRESHOLD };
