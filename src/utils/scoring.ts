import type {
  FormData, DerivedVariables, OptionScore, OptionKey,
  FlowType, Results, ActionPlan, ConfidenceLevel,
  TimingAnalysis, TraitInput, AnalysisReport,
  ExpertInterpretation, ActionPlanDetailed,
  DirectionType, ExecutionMode, CareerDiagnosis,
  NarrativePersona, NarrativeState, NarrativeCoreStrategy,
  SajuTimingLayer, SajuRelationType, SajuUrgency,
  SajuTraitEstimate, PersonalityStory, OptionReadiness,
  DecisionStrategy, RankedOption, TimingAdvice,
  CareerDecisionClass, StateTimingLevel,
} from '../types';
import { classifyCareerDecision } from './classification';
import { estimateTraitsFromSaju } from './saju';
import { computeSajuPersonaMVP } from './sajuPersona';

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatKRW(amount: number): string {
  if (amount >= 100_000_000) {
    const e = amount / 100_000_000;
    return `${e % 1 === 0 ? e.toFixed(0) : e.toFixed(1)}억원`;
  }
  if (amount >= 10_000) return `${Math.round(amount / 10_000)}만원`;
  return `${amount.toLocaleString()}원`;
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const normTo100 = (v: number) => (v - 1) / 4 * 100;  // maps 1-5 → 0-100

// ─── Derived variables ───────────────────────────────────────────────────────

export function calculateDerivedVariables(form: FormData): DerivedVariables {
  const { basicProfile: bp, careerStatus: cs, traits } = form;
  const runwayMonths = bp.monthlyExpense > 0 ? bp.savings / bp.monthlyExpense : 0;
  const burnoutRisk = (cs.burnout + cs.organizationStress + (6 - cs.workLifeBalance)) / 3;
  const jobDissatisfaction =
    ((6 - cs.jobSatisfaction) + (6 - cs.growthPotential) + (6 - cs.salarySatisfaction)) / 3;
  const financialSafetyBase = clamp((runwayMonths / 12) * 100);

  const se = normTo100(traits.selfEfficacy);
  const nw = normTo100(traits.networking);
  const co = normTo100(traits.changeOrientation);
  const pl = normTo100(traits.planning);
  const cu = normTo100(traits.curiosity);
  const rt = normTo100(traits.riskTolerance);
  const rn = normTo100(traits.recoveryNeed);
  // SCCT inputs (Lent, Brown & Hackett 1994)
  const oe = normTo100(traits.outcomeExpectation);
  const pe = normTo100(traits.portfolioEvidence);

  // SCCT 이직 경쟁력: self-efficacy × 0.35 + outcome expectation × 0.25 + networking × 0.20 + portfolio × 0.20
  const marketReadinessPercent = se * 0.35 + oe * 0.25 + nw * 0.20 + pe * 0.20;
  const marketReadiness = marketReadinessPercent / 100 * 4 + 1;

  // Career Adaptability (Savickas 2012): concern(planning) + control(autonomy) + curiosity + confidence(self-efficacy)
  const careerAdaptability = pl * 0.25 + co * 0.25 + cu * 0.25 + se * 0.25;

  const readinessBehavior  = se * 0.4 + nw * 0.3 + co * 0.3;
  const explorationDrive   = cu * 0.4 + co * 0.3 + rt * 0.3;
  const stabilityPreference = (100 - co) * 0.4 + pl * 0.4 + (100 - rt) * 0.2;
  // burnoutPressure: 현재 상태(burnout/스트레스/워라밸) 70%, 회복 성향 30%.
  // recoveryNeed는 정적 성향이므로 게이트 분류는 현재 상태가 주도해야 함.
  const burnoutPressure    = normTo100(burnoutRisk) * 0.85 + rn * 0.15;

  return {
    runwayMonths, burnoutRisk, jobDissatisfaction,
    marketReadiness, marketReadinessPercent, financialSafetyBase,
    readinessBehavior, explorationDrive, stabilityPreference, burnoutPressure,
    careerAdaptability,
  };
}

// ─── Flow type ───────────────────────────────────────────────────────────────

export function calculateFlowType(form: FormData): FlowType {
  const { desireForChange, desireForStability, needForRest } = form.flow;
  const wantsExpansion = desireForChange >= 3.5;
  const wantsRest      = needForRest >= 3.5;
  const wantsStability = desireForStability >= 3.5;

  // 변화를 원하지만 안정/회복도 동시에 원하면 더 안전한 '내부 전환'으로 분류.
  // 변화만 원하면 외부 확장.
  if (wantsExpansion && !wantsRest && !wantsStability) return 'expansionExternal';
  if (wantsExpansion)                                   return 'expansionInternal';
  if (wantsRest)                                        return 'stabilityInternal';
  return 'stabilityExternal';
}

export const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  expansionExternal: '확장 탐색형 (이직/창업)',      // 변화 욕구 강함 + 안정/회복 욕구 낮음
  expansionInternal: '내부 전환형 (공부/직무전환)',   // 변화 욕구 강함 + 안정 또는 회복 욕구 동반
  stabilityExternal: '안정 유지형 (현직 유지)',       // 변화 욕구 낮음 + 회복 욕구도 낮음
  stabilityInternal: '잠시 충전이 필요한 사람 (휴식/재정비)',   // 변화 욕구 낮음 + 회복 욕구 강함
};

// 한 줄 미리보기용. InputForm 미리보기와 실제 분석이 동일 모델을 쓰도록 단일 source.
export function getFlowTypePreview(flow: FormData['flow']): string {
  const flowType = calculateFlowType({ flow } as FormData);
  const detail: Record<FlowType, string> = {
    expansionExternal: '확장 탐색형 — 이직 또는 창업/프리랜서 방향과 잘 맞습니다.',
    expansionInternal: '내부 전환형 — 기반을 유지하면서 공부·직무전환 방향이 잘 맞습니다.',
    stabilityExternal: '안정 유지형 — 현직 유지·내부 개선 방향과 잘 맞습니다.',
    stabilityInternal: '잠시 충전이 필요한 사람 — 지금은 충전이 먼저, 방향은 그 다음입니다.',
  };
  return detail[flowType];
}

// ─── Target event inference (replaces manual selection) ──────────────────────

export function inferTargetEvents(selectedOptions: OptionKey[]): string[] {
  const MAP: Record<OptionKey, string> = {
    stay: '현직 유지',
    jobChange: '이직 준비',
    careerSwitch: '직무 전환',
    restAfterQuit: '퇴사',
    startupFreelance: '창업',
    studyReskill: '공부/재정비',
  };
  const keys = selectedOptions.length > 0 ? selectedOptions : (['jobChange', 'stay'] as OptionKey[]);
  return keys.map(k => MAP[k]);
}

// ─── Trait fit score (0-20) ───────────────────────────────────────────────────

export function calculateTraitFitScore(
  key: OptionKey, derived: DerivedVariables, traits: TraitInput,
): number {
  const { readinessBehavior, explorationDrive, stabilityPreference, burnoutPressure } = derived;
  const co = normTo100(traits.changeOrientation);
  const cu = normTo100(traits.curiosity);
  const pl = normTo100(traits.planning);
  const rt = normTo100(traits.riskTolerance);
  const rn = normTo100(traits.recoveryNeed);
  const se = normTo100(traits.selfEfficacy);
  const nw = normTo100(traits.networking);
  const mo = normTo100(traits.meaningOrientation);

  // Career Anchors (Schein 1978) — derived from existing trait inputs
  const stabilityAnchor       = (100 - rt) * 0.5 + pl * 0.5;
  const autonomyAnchor        = rt * 0.4 + co * 0.4 + (100 - pl) * 0.2;
  const expertiseAnchor       = cu * 0.5 + mo * 0.5;
  const entrepreneurialAnchor = rt * 0.4 + se * 0.3 + cu * 0.3;
  const lifestyleAnchor       = rn * 0.5 + (100 - explorationDrive) * 0.5;

  let anchorBoost = 0;
  switch (key) {
    case 'stay':             anchorBoost = stabilityAnchor * 0.08; break;
    case 'jobChange':        anchorBoost = (expertiseAnchor * 0.6 + autonomyAnchor * 0.4) * 0.06; break;
    case 'careerSwitch':     anchorBoost = expertiseAnchor * 0.08; break;
    case 'restAfterQuit':    anchorBoost = lifestyleAnchor * 0.08; break;
    case 'startupFreelance': anchorBoost = (autonomyAnchor * 0.5 + entrepreneurialAnchor * 0.5) * 0.08; break;
    case 'studyReskill':     anchorBoost = expertiseAnchor * 0.08; break;
  }

  let raw = 0;
  switch (key) {
    case 'stay':           raw = stabilityPreference * 0.5 + (100 - explorationDrive) * 0.3 + (100 - burnoutPressure) * 0.2; break;
    case 'jobChange':      raw = readinessBehavior * 0.4 + explorationDrive * 0.4 + (100 - stabilityPreference) * 0.2; break;
    case 'careerSwitch':   raw = mo * 0.4 + cu * 0.3 + explorationDrive * 0.3; break;
    case 'restAfterQuit':  raw = burnoutPressure * 0.6 + rn * 0.4; break;
    case 'startupFreelance': raw = rt * 0.3 + se * 0.3 + explorationDrive * 0.3 + nw * 0.1; break;
    case 'studyReskill':   raw = cu * 0.4 + pl * 0.3 + mo * 0.3; break;
  }
  return Math.round(clamp(raw + anchorBoost) / 100 * 20);
}

// ─── Archetype labels ─────────────────────────────────────────────────────────

export function getArchetypeLabel(derived: DerivedVariables, bestKey: OptionKey): string {
  const { burnoutPressure, readinessBehavior, explorationDrive, stabilityPreference } = derived;
  if (burnoutPressure >= 60)                                         return '회복 우선형';
  if (bestKey === 'jobChange' && readinessBehavior >= 55)            return '재직 중 이동형';
  if (bestKey === 'jobChange')                                       return '이직 탐색형';
  if (bestKey === 'careerSwitch')                                    return '탐색 전환형';
  if (bestKey === 'studyReskill')                                    return '역량 강화형';
  if (bestKey === 'startupFreelance' && explorationDrive >= 60)      return '준비된 도전자형';
  if (bestKey === 'startupFreelance')                                return '독립 준비형';
  if (bestKey === 'restAfterQuit')                                   return '회복 우선형';
  if (stabilityPreference >= 60 && bestKey === 'stay')               return '내부 최적화형';
  return '균형 전략형';
}

export function getArchetypeInsight(label: string): string {
  const map: Record<string, string> = {
    // Gate-based labels (primary — from classifyCareerDecision)
    '현 직장 재설계형':       '이동보다 현재 역할을 재설계하는 것이 더 빠른 변화를 만들 수 있습니다. 역할 협상이나 직무 조정을 먼저 시도하세요.',
    '재직 중 이동형':         '지금 당장 나올 필요는 없습니다. 단, 지금 탐색하지 않으면 기회를 놓칩니다.',
    '도전 가속형':            '역량과 여건 모두 준비된 상태입니다. 이직·창업 등 적극적인 전환 도전이 가능합니다.',
    '회복 우선형':            '지금 무리한 전진보다 회복이 더 전략적인 선택일 수 있습니다.',
    '준비 후 전환형':         '변화 의지는 있지만 지금 이동하기엔 준비가 더 필요합니다. 재직 중 역량 강화로 경쟁력을 높인 후 전환하세요.',
    '사이드 프로젝트 검증형': '창업·프리랜서 성향이 강하지만 지금 당장 퇴사보다 재직 중 고객 검증이 더 전략적입니다.',
    '보류·점검형':            '재무 여건이나 피로도가 즉각적인 행동을 어렵게 만들고 있습니다. 기반 조건을 먼저 안정화하는 것이 현실적입니다.',
    // kept for backward-compatibility
    '안정 유지형': '지금은 이동보다 현재 환경을 최적화하는 것이 더 효과적입니다. 내부 조건 협상으로 빠르게 개선할 수 있습니다.',
    // Legacy score-based labels (kept for backward compatibility)
    '이직 탐색형':     '환경 전환 욕구가 준비도보다 앞서 있습니다. 역량 강화와 병행하세요.',
    '탐색 전환형':     '이직의 문제가 아닌 방향의 문제입니다. 직무 자체를 바꾸는 것을 우선 검토하세요.',
    '역량 강화형':     '지금 투자한 역량이 3년 후 선택지를 넓혀줄 가능성이 높습니다.',
    '준비된 도전자형': '탐구와 실행력이 갖춰져 있습니다. 검증된 가설로 시작하세요.',
    '독립 준비형':     '독립 의지는 있으나 검증이 먼저입니다. 재직 중 파일럿 테스트를 권장합니다.',
    '내부 최적화형':   '이동보다 협상이 더 빠른 길일 수 있습니다. 내부 조건을 먼저 점검하세요.',
    '균형 전략형':     '현재 입력값 기준 단일 방향보다 복수 전략을 병렬로 검토하는 것이 적합합니다.',
  };
  return map[label] ?? '현재 입력값 기준으로 다음 단계를 신중하게 검토하세요.';
}

export function getTraitProfile(derived: DerivedVariables): string {
  const { readinessBehavior, explorationDrive, stabilityPreference, burnoutPressure } = derived;
  if (burnoutPressure >= 65)                                return '회복 필요형';
  if (explorationDrive >= 65 && readinessBehavior >= 65)   return '탐구 실행형';
  if (explorationDrive >= 65)                              return '탐구 주도형';
  if (stabilityPreference >= 65)                           return '안정 추구형';
  if (readinessBehavior >= 65)                             return '실행 중심형';
  return '균형 전략형';
}

// ─── Flow fit scores ─────────────────────────────────────────────────────────

export function calculateFlowFitScore(key: OptionKey, flowType: FlowType): number {
  const table: Record<FlowType, Partial<Record<OptionKey, number>>> = {
    expansionExternal:  { jobChange: 15, startupFreelance: 12 },
    expansionInternal:  { careerSwitch: 15, studyReskill: 12 },
    stabilityExternal:  { stay: 15, jobChange: 6 },
    stabilityInternal:  { restAfterQuit: 15, stay: 8 },
  };
  return table[flowType][key] ?? 0;
}

// ─── Age-based opportunity cost weights ───────────────────────────────────────
// Career mobility narrows with age. Age weights nudge scores to reflect this:
// - Younger (20s-early 30s): exploration is cheap, learning has high upside
// - Mid (mid 30s-early 40s): pivots get expensive, opportunity cost rises sharply
// - Older (mid 40s+): stability premium, career switch much harder
//
// Returns a per-option score adjustment (-15 to +10).

function calcAgeAdjustment(key: OptionKey, age: number): number {
	// Bands
	const isYoung = age <= 32;
	const isMid   = age >= 33 && age <= 42;
// const isOlder = age >= 43;  // reserved

	switch (key) {
		case 'studyReskill':
			// Learning easier when young, opportunity cost higher when older
			if (isYoung) return +8;
			if (isMid)   return 0;
			return -10;
		case 'careerSwitch':
			// Switch costs rise sharply with age
			if (isYoung) return +6;
			if (isMid)   return -3;
			return -12;
		case 'startupFreelance':
			// Best in mid-30s (skills + still flexible); risky after 45
			if (age <= 28) return -3;       // too early, skills not ripe
			if (age <= 38) return +5;       // sweet spot
			if (age <= 45) return 0;
			return -8;
		case 'jobChange':
			// Job market narrows after 40
			if (isYoung) return +3;
			if (isMid)   return 0;
			return -6;
		case 'restAfterQuit':
			// Rest is cheap when young (more time to recover trajectory),
			// expensive when older (opportunity cost is high)
			if (isYoung) return +2;
			if (isMid)   return -2;
			return -8;
		case 'stay':
			// Stability becomes more valuable with age
			if (isYoung) return -2;
			if (isMid)   return +2;
			return +6;
	}
}

// ─── Option base score components ────────────────────────────────────────────

function calcOptionComponents(
  key: OptionKey, derived: DerivedVariables, cs: FormData['careerStatus'], traits: TraitInput,
) {
  const { runwayMonths, burnoutRisk, jobDissatisfaction, marketReadiness, explorationDrive } = derived;
  const { growthPotential, organizationStress } = cs;
  const mr = (marketReadiness - 1) / 4 * 100;

  switch (key) {
    case 'stay':
      return { careerUpside: growthPotential * 20, financialSafety: 85, mentalRecovery: (6 - burnoutRisk) * 20, executionDifficulty: 20, regretRisk: jobDissatisfaction * 18 + burnoutRisk * 10 };
    case 'jobChange':
      return { careerUpside: ((6 - growthPotential) + marketReadiness + jobDissatisfaction) / 3 * 20, financialSafety: runwayMonths >= 6 ? 75 : 55, mentalRecovery: organizationStress >= 4 ? 70 : 55, executionDifficulty: (6 - marketReadiness) * 18, regretRisk: marketReadiness < 3 ? 65 : 35 };
    case 'careerSwitch':
      return { careerUpside: jobDissatisfaction * 15 + (growthPotential < 3 ? 20 : 0), financialSafety: runwayMonths >= 9 ? 70 : 45, mentalRecovery: 65, executionDifficulty: 80 - marketReadiness * 8, regretRisk: runwayMonths < 6 ? 70 : 45 };
    case 'restAfterQuit': {
      // Burnout level boosts mental recovery value; low runway raises regret risk
      const burnoutBonus = burnoutRisk >= 4.5 ? 18 : burnoutRisk >= 4 ? 9 : 0;
      return {
        careerUpside: 35,
        financialSafety: clamp((runwayMonths / 12) * 100),
        mentalRecovery: clamp(burnoutRisk * 18 + burnoutBonus),
        executionDifficulty: runwayMonths >= 6 ? 35 : 70,
        regretRisk: runwayMonths < 3 ? 90 : runwayMonths < 6 ? 70 : 45,
      };
    }
    case 'startupFreelance': {
      const rt = normTo100(traits.riskTolerance);
      const se = normTo100(traits.selfEfficacy);
      const driveBonus = (rt >= 60 || explorationDrive >= 65) ? 10 : 0;
      const fs = runwayMonths >= 12 ? 70 : runwayMonths >= 6 ? 52 : runwayMonths >= 3 ? 35 : 18;
      const rr = runwayMonths >= 12 ? 40 : runwayMonths >= 6 ? 50 : 65;
      // High drive + self-efficacy: execution is less daunting for these people
      const execDiff = (rt >= 65 && se >= 55) ? 65 : (rt >= 55 || explorationDrive >= 65) ? 75 : 85;
      return { careerUpside: clamp(75 + driveBonus), financialSafety: fs, mentalRecovery: 50, executionDifficulty: execDiff, regretRisk: rr };
    }
    case 'studyReskill': {
      // Learning is most valuable when mobility is low — boost when market readiness is low
      const learningBonus = mr < 45 ? 15 : mr < 55 ? 8 : 0;
      // Study can be done while employed, so runway matters less
      const fs = runwayMonths >= 9 ? 65 : runwayMonths >= 4 ? 52 : 40;
      return { careerUpside: clamp(65 + learningBonus), financialSafety: fs, mentalRecovery: 55, executionDifficulty: 60, regretRisk: runwayMonths < 6 ? 60 : 40 };
    }
  }
}

function calcBaseScore(c: ReturnType<typeof calcOptionComponents>) {
  const { careerUpside, financialSafety, mentalRecovery, executionDifficulty, regretRisk } = c!;
  return careerUpside * 0.3 + financialSafety * 0.25 + mentalRecovery * 0.2
       - executionDifficulty * 0.1 - regretRisk * 0.15;
}

const OPTION_LABELS: Record<OptionKey, string> = {
  stay: '현 직장 재설계', jobChange: '이직 준비', careerSwitch: '직무 전환',
  restAfterQuit: '퇴사 후 휴식', startupFreelance: '창업/프리랜서', studyReskill: '공부/역량 강화',
};

const ALL_OPTIONS: OptionKey[] = ['stay', 'jobChange', 'careerSwitch', 'restAfterQuit', 'startupFreelance', 'studyReskill'];

// ─── Per-option comparison explanation ───────────────────────────────────────

function generateOptionComparison(
  key: OptionKey, derived: DerivedVariables, form: FormData,
): { matchReasons: string[]; mismatchRisks: string[]; bestCondition: string } {
  const { runwayMonths, jobDissatisfaction, marketReadiness,
          readinessBehavior, explorationDrive, stabilityPreference, burnoutPressure } = derived;
  const { growthPotential } = form.careerStatus;

  switch (key) {
    case 'stay':
      return {
        matchReasons: [
          stabilityPreference >= 55
            ? `안정 선호 성향(${Math.round(stabilityPreference)}/100)이 현 직장 유지와 맞습니다`
            : `런웨이(${runwayMonths.toFixed(1)}개월)와 번아웃 수준이 즉각적인 이탈을 불필요하게 만들고 있습니다`,
          marketReadiness < 3
            ? `이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 낮아 지금 이직보다 내부 개선이 더 현실적입니다`
            : `재무 여건이 내부 조건 개선을 먼저 시도하기에 충분합니다`,
        ],
        mismatchRisks: [
          jobDissatisfaction >= 3.5 ? `직무 불만족도(${jobDissatisfaction.toFixed(1)}/5)가 높아 유지 시 후회 가능성이 있습니다` : '',
          growthPotential <= 2 ? `성장 가능성(${growthPotential}/5)이 낮아 장기적 경쟁력이 약화될 수 있습니다` : '',
        ].filter(Boolean),
        bestCondition: '내부 역할 조정 또는 연봉 협상이 가능하고, 4~8주 내 개선 신호가 있을 때 최선입니다.',
      };
    case 'jobChange':
      return {
        matchReasons: [
          `불만족도(${jobDissatisfaction.toFixed(1)}/5)와 이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 이직 탐색의 근거를 만들고 있습니다`,
          readinessBehavior >= 50
            ? `행동 준비도(${Math.round(readinessBehavior)}/100)가 이직 프로세스를 뒷받침합니다`
            : '변화 욕구가 강한 시기로 탐색 에너지가 있습니다',
        ],
        mismatchRisks: [
          marketReadiness < 3 ? `이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 낮아 이직에 시간이 더 걸릴 수 있습니다` : '',
          runwayMonths < 6 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 즉시 퇴사 후 이직은 재정 위험이 있습니다` : '',
        ].filter(Boolean),
        bestCondition: '재직 중 탐색 8~12주 동안 면접 반응률을 확인한 후 퇴사 여부를 판단할 때 최선입니다.',
      };
    case 'careerSwitch':
      return {
        matchReasons: [
          `직무 불만족(${jobDissatisfaction.toFixed(1)}/5)과 의미 지향 성향(${Math.round(normTo100(form.traits.meaningOrientation))}/100)이 전환의 근거입니다`,
          growthPotential <= 2 ? '현 직무에서 성장 경로가 막혀 있어 방향 자체를 바꾸는 것이 합리적입니다' : '변화 탐색 성향가 새로운 직무 탐색을 자연스럽게 지지합니다',
        ],
        mismatchRisks: [
          runwayMonths < 9 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 전환 준비 기간 대비 짧을 수 있습니다` : '',
          '전환 직무 선택을 잘못하면 시간·비용이 손실됩니다. 사전 검증이 필수입니다',
        ].filter(Boolean),
        bestCondition: '목표 직무를 2~3개로 좁히고, 현업자 커피챗 3회 이상 후 전환을 결정할 때 최선입니다.',
      };
    case 'restAfterQuit':
      return {
        matchReasons: [
          burnoutPressure >= 55
            ? `현재 피로도(${Math.round(burnoutPressure)}/100)이 높아 의도적 회복이 전략적으로 필요합니다`
            : '장기 지속 가능성을 위해 회복 기간 투자가 효과적일 수 있습니다',
          runwayMonths >= 6 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 구조화된 휴식을 감당할 수 있는 여건입니다` : '회복 욕구가 강해 단기 재정비 기간이 도움이 될 수 있습니다',
        ],
        mismatchRisks: [
          runwayMonths < 6 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 경제적 압박이 빠르게 올 수 있습니다` : '',
          '구조화된 계획 없이 쉬면 복귀 시점이 계속 미뤄질 수 있습니다',
        ].filter(Boolean),
        bestCondition: '최소 6개월 런웨이가 확보되고, 복귀 목표 시점과 재취업 계획이 구체적일 때 최선입니다.',
      };
    case 'startupFreelance':
      return {
        matchReasons: [
          `변화 탐색 성향(${Math.round(explorationDrive)}/100)와 자기효능감이 독립 환경에서 성과를 낼 수 있는 기반입니다`,
          runwayMonths >= 12 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 초기 매출 검증 기간을 버틸 수 있습니다` : '변화 욕구가 강하고 자율적 업무 환경에서 동기가 높습니다',
        ],
        mismatchRisks: [
          runwayMonths < 12 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 창업 초기 생존 기간(12~18개월) 대비 짧습니다` : '',
          '고객 검증 없이 퇴사하면 수익 공백이 예상보다 길어집니다',
        ].filter(Boolean),
        bestCondition: '퇴사 전 유료 고객 1명 이상 확보 또는 사전 매출 테스트가 성공했을 때 최선입니다.',
      };
    case 'studyReskill':
      return {
        matchReasons: [
          `호기심(${Math.round(normTo100(form.traits.curiosity))}/100)과 계획성(${Math.round(normTo100(form.traits.planning))}/100)이 체계적 학습에 맞는 성향입니다`,
          marketReadiness < 3 ? `이직 경쟁력 강화가 외부 시장 경쟁력을 높이는 가장 직접적인 경로입니다` : '새로운 역량 투자가 장기 경력 방향을 넓혀줄 수 있습니다',
        ],
        mismatchRisks: [
          runwayMonths < 9 ? `런웨이(${runwayMonths.toFixed(1)}개월)가 학습 기간 중 재정 압박을 유발할 수 있습니다` : '',
          '학습 후 취업 연결까지 예상보다 오래 걸릴 수 있습니다',
        ].filter(Boolean),
        bestCondition: '재직 중 병행 학습이 가능하고, 목표 직무 취업 경로가 구체적으로 검증된 상태일 때 최선입니다.',
      };
  }
}

// ─── Option readiness classification ─────────────────────────────────────────

function calculateOptionReadiness(
  key: OptionKey, derived: DerivedVariables, traits: TraitInput,
): OptionReadiness {
  const { runwayMonths, burnoutPressure, marketReadiness, explorationDrive, readinessBehavior, jobDissatisfaction } = derived;
  const mr = (marketReadiness - 1) / 4 * 100;
  const rt = normTo100(traits.riskTolerance);
  const cu = normTo100(traits.curiosity);
  const se = normTo100(traits.selfEfficacy);

  switch (key) {
    case 'stay':
      if (burnoutPressure >= 80 && jobDissatisfaction >= 4) return 'notRecommended';
      return 'now'; // Job crafting is always executable in some form
    case 'jobChange':
      if (mr >= 45 && runwayMonths >= 4 && burnoutPressure < 70) return 'now';
      if (burnoutPressure >= 70) return 'conditional';
      if (mr < 35) return 'prepareFirst';
      return 'conditional';
    case 'careerSwitch':
      if (runwayMonths >= 6 && explorationDrive >= 45) return 'prepareFirst';
      if (runwayMonths < 3) return 'conditional';
      return 'prepareFirst';
    case 'restAfterQuit':
      if (burnoutPressure >= 65 && runwayMonths >= 6) return 'now';
      if (burnoutPressure >= 50 && runwayMonths >= 3) return 'conditional';
      if (runwayMonths < 3 && burnoutPressure >= 65) return 'conditional'; // Short recovery still valid
      if (runwayMonths < 3) return 'notRecommended';
      return 'conditional';
    case 'startupFreelance': {
      const hasStartupDrive = rt >= 55 || explorationDrive >= 65;
      if (!hasStartupDrive) return 'notRecommended';
      // Full execution: good runway + high execution readiness
      if (runwayMonths >= 12 && se >= 50 && readinessBehavior >= 50) return 'now';
      // Also 'now' for very high drive + solid runway (even if not 12mo)
      if (rt >= 70 && readinessBehavior >= 65 && runwayMonths >= 9) return 'now';
      if (runwayMonths >= 3) return 'prepareFirst'; // Side-project validation mode
      return 'conditional';
    }
    case 'studyReskill':
      if (cu >= 50 && mr < 50) return 'now'; // Clearly needed + learning drive
      if (cu >= 40 || explorationDrive >= 45) return 'prepareFirst';
      return 'conditional';
  }
}

function generateOptionReadinessFields(
  key: OptionKey, status: OptionReadiness, derived: DerivedVariables, traits: TraitInput,
): { mainFitReason: string; mainRiskReason: string; requiredConditions: string[]; recommendedAction: string } {
  const { runwayMonths, burnoutPressure, marketReadiness, explorationDrive, jobDissatisfaction } = derived;
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const bp = Math.round(burnoutPressure);
  const rt = normTo100(traits.riskTolerance);

  switch (key) {
    case 'stay': {
      const isHighBurnout = bp >= 60;
      return {
        mainFitReason: isHighBurnout
          ? `런웨이(${runwayMonths.toFixed(1)}개월)와 번아웃 수준이 즉각적인 이탈을 불필요하게 만들고 있습니다`
          : marketReadiness < 3
            ? `이직 경쟁력(${mr}/100)이 아직 충분하지 않아 내부 개선이 더 현실적입니다`
            : jobDissatisfaction < 3
              ? `현재 만족도가 낮지 않아 내부 재설계로 충분히 개선 가능한 상태입니다`
              : `재직 중 조건 협상이 이직보다 빠른 변화를 만들 수 있습니다`,
        mainRiskReason: isHighBurnout
          ? `번아웃 상태에서 협상이나 재설계를 시도하면 오히려 에너지가 더 소진됩니다. 회복이 먼저입니다`
          : `개선 기한 없이 유지하면 동일한 고민이 반복됩니다. 4~8주 기한 설정이 필수입니다`,
        requiredConditions: isHighBurnout
          ? ['업무 강도 조절 가능 여부 확인', '회복 후 4~8주 내 협상 시도']
          : ['역할 협상 또는 프로젝트 변경 가능성 확인', '4~8주 내 개선 신호 존재'],
        recommendedAction: isHighBurnout
          ? '업무 강도 조절 + 회복 루틴 먼저 — 협상은 회복 후'
          : '역할 재설계 또는 연봉 협상 — 4주 내 결과 확인',
      };
    }
    case 'jobChange':
      return {
        mainFitReason: `불만족도(${jobDissatisfaction.toFixed(1)}/5)와 이직 경쟁력(${mr}/100)이 이직 탐색의 근거를 만들고 있습니다`,
        mainRiskReason: mr < 45
          ? `이직 경쟁력(${mr}/100)이 낮아 탐색 기간이 길어질 수 있습니다. 포지셔닝 강화가 먼저입니다`
          : `런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 퇴사 없이 재직 중 탐색이 필수입니다`,
        requiredConditions: ['재직 중 8~12주 탐색', '면접 반응률 20% 이상 확인 후 퇴사 결정'],
        recommendedAction: '재직 중 이직 탐색 — 면접 반응 확인 후 퇴사 결정',
      };
    case 'careerSwitch':
      return {
        mainFitReason: `직무 방향 자체의 전환이 단순 이직보다 더 근본적인 해결책일 수 있습니다`,
        mainRiskReason: `전환 준비 기간(6~18개월)이 필요하며, 목표 직무 검증 없이 시작하면 비용만 발생합니다`,
        requiredConditions: ['목표 직무 현업자 3명 인터뷰', '재직 중 병행 학습 또는 사이드 프로젝트'],
        recommendedAction: '현업자 인터뷰 3회 후 전환 결정 — 재직 중 병행 시작',
      };
    case 'restAfterQuit':
      if (status === 'notRecommended')
        return {
          mainFitReason: `소진 신호가 있습니다`,
          mainRiskReason: `런웨이(${runwayMonths.toFixed(1)}개월)가 너무 짧아 장기 휴식은 재정 위기로 이어집니다`,
          requiredConditions: ['런웨이 6개월 이상 확보', '복귀 시점 사전 설정'],
          recommendedAction: '재정 안정화 먼저 — 소득 없이 장기 휴식은 현재 비추천',
        };
      if (runwayMonths < 6)
        return {
          mainFitReason: `피로도(${bp}/100)가 높아 어느 정도 회복이 필요한 상태입니다`,
          mainRiskReason: `런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 장기 휴식보다 회복 루틴 + 비용 점검이 현실적입니다`,
          requiredConditions: ['월 지출 20% 감축 계획', '단기 회복(1~2개월) 후 복귀 계획'],
          recommendedAction: '단기 회복 + 비용 구조 점검 — 장기 공백 없이 복귀',
        };
      return {
        mainFitReason: `피로도(${bp}/100)가 높고 런웨이(${runwayMonths.toFixed(1)}개월)가 구조화된 회복을 감당할 수 있습니다`,
        mainRiskReason: `복귀 계획 없이 쉬면 재취업 시점이 계속 미뤄질 수 있습니다`,
        requiredConditions: ['복귀 목표 시점 사전 설정', '최소 6개월 생활비 확인'],
        recommendedAction: '퇴사 전 복귀 날짜 확정 — 3개월 후 재탐색 시작 설정',
      };
    case 'startupFreelance':
      if (status === 'now')
        return {
          mainFitReason: `창업/독립 성향(위험 감수 ${Math.round(rt)}/100, 탐색 ${Math.round(explorationDrive)}/100)과 재무 여건이 갖춰져 있습니다`,
          mainRiskReason: `고객 검증 없이 퇴사하면 초기 수익 공백이 예상보다 길어집니다`,
          requiredConditions: ['퇴사 전 유료 고객 1명 이상 확보', '12개월 이상 런웨이 유지'],
          recommendedAction: '퇴사 전 유료 고객 확보 후 전환 — 재직 중 파일럿 테스트 먼저',
        };
      return {
        mainFitReason: `창업/독립 성향이 강하지만(위험 감수 ${Math.round(rt)}/100, 탐색 ${Math.round(explorationDrive)}/100) 재무 여건 확보가 먼저입니다`,
        mainRiskReason: `런웨이(${runwayMonths.toFixed(1)}개월)가 창업 초기 생존 기간(12~18개월)에 부족합니다. 즉시 퇴사는 비추천`,
        requiredConditions: ['재직 중 사이드 프로젝트로 유료 고객 검증', '런웨이 9개월 이상 확보'],
        recommendedAction: '재직 중 사이드 프로젝트로 고객 검증 — 즉시 퇴사 금지',
      };
    case 'studyReskill':
      return {
        mainFitReason: mr < 50
          ? `이직 경쟁력(${mr}/100)이 낮아 역량 강화가 다음 이동의 가장 직접적인 기반이 됩니다`
          : `역량 투자가 장기적으로 선택지를 넓혀줄 수 있습니다`,
        mainRiskReason: `학습 후 취업 연결 경로가 검증되지 않으면 시간·비용 ROI가 불확실합니다`,
        requiredConditions: ['목표 직무 공고 10개 분석 후 필요 역량 특정', '재직 중 병행 가능 여부 확인'],
        recommendedAction: '재직 중 병행 학습 — 3개월 내 핵심 역량 1개 확보',
      };
  }
}

// ─── Full option scoring ──────────────────────────────────────────────────────

export function calculateOptionScores(form: FormData): OptionScore[] {
  const derived = calculateDerivedVariables(form);
  const flowType = calculateFlowType(form);
  const keys = form.selectedOptions.length > 0 ? form.selectedOptions : ALL_OPTIONS;

  const scores = keys.map((key) => {
    const comp = calcOptionComponents(key, derived, form.careerStatus, form.traits)!;
    const baseScore = calcBaseScore(comp);
    const traitFitScore = calculateTraitFitScore(key, derived, form.traits);
    const flowFitScore  = calculateFlowFitScore(key, flowType);

    const warnings: string[] = [];
    const notes: string[] = [];
    let penalty = 0;

    // Graduated penalties — don't block options, just reflect realistic risk
    if (derived.runwayMonths < 3) {
      if (key === 'restAfterQuit') {
        warnings.push('런웨이 3개월 미만 — 장기 휴식은 재정 위험이 높습니다. 단기 회복 + 비용 점검이 현실적입니다.');
        penalty = 20;
      } else if (key === 'startupFreelance') {
        notes.push('런웨이가 짧아 즉시 퇴사는 위험합니다. 재직 중 사이드 프로젝트로 먼저 검증하세요.');
        penalty = 10; // Reduced — side-project mode is still viable
      } else if (key === 'studyReskill') {
        notes.push('재직 중 병행 학습으로 시작하면 런웨이 제약을 피할 수 있습니다.');
        penalty = 5; // Very small — study while employed is the right path anyway
      }
    }
    if (derived.burnoutRisk >= 4.5 && derived.runwayMonths >= 6 && key === 'restAfterQuit') {
      notes.push('번아웃 수준이 높고 런웨이가 6개월 이상이어서 구조화된 휴식을 우선 검토할 수 있습니다.');
    }
    if (form.careerStatus.growthPotential <= 2 && derived.marketReadiness >= 3.5 && key === 'jobChange') {
      notes.push('성장 가능성은 낮지만 이직 경쟁력이 있어 재직 중 이직 탐색이 합리적입니다.');
    }

    const readinessStatus = calculateOptionReadiness(key, derived, form.traits);
    const readinessFields = generateOptionReadinessFields(key, readinessStatus, derived, form.traits);
    const comparison = generateOptionComparison(key, derived, form);

    return {
      key,
      label: OPTION_LABELS[key],
      careerUpside:        clamp(comp.careerUpside),
      financialSafety:     clamp(comp.financialSafety),
      mentalRecovery:      clamp(comp.mentalRecovery),
      executionDifficulty: clamp(comp.executionDifficulty),
      regretRisk:          clamp(comp.regretRisk),
      baseScore:           clamp(baseScore),
      traitFitScore,
      flowFitScore,
      totalScore:          clamp(baseScore + traitFitScore + flowFitScore - penalty + calcAgeAdjustment(key, form.basicProfile.age)),
      warnings,
      notes,
      ...comparison,
      readinessStatus,
      ...readinessFields,
    };
  });

  // Anti-default: if jobChange tops only by middling score, surface high-trait-fit alternatives
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  if (sorted[0]?.key === 'jobChange') {
    const startup = scores.find(s => s.key === 'startupFreelance');
    const study   = scores.find(s => s.key === 'studyReskill');
    if (startup && startup.traitFitScore >= 12 && startup.readinessStatus !== 'notRecommended') {
      startup.notes.push('이직이 가장 안전하지만 창업 성향이 강해, 재직 중 사이드 프로젝트 검증도 함께 추천됩니다.');
    }
    if (study && study.traitFitScore >= 12 && sorted.indexOf(study) >= 2) {
      study.notes.push('이직보다 역량 보완 후 전환이 장기적으로 더 적합할 수 있습니다.');
    }
  }

  return scores;
}

// ─── Action plans ─────────────────────────────────────────────────────────────

export function generateActionPlan(best: OptionKey): ActionPlan {
  const plans: Record<OptionKey, ActionPlan> = {
    stay:             { week1: '현재 불만 요인 3가지 구체적으로 정리하기', week2: '업무 범위/역할 조정 가능성 상사와 확인하기', week3: '연봉 협상, 사내 이동, 프로젝트 변경 가능성 탐색하기', week4: '개선 신호가 없으면 이직 준비로 전환 결정하기' },
    jobChange:        { week1: '이력서와 링크드인 업데이트하기', week2: '관심 기업 20개 리스트업하기', week3: '최소 5개 지원 또는 커피챗 진행하기', week4: '면접 반응률 기준으로 퇴사 여부 재판단하기' },
    careerSwitch:     { week1: '전환하고 싶은 직무 2~3개 후보 선정하기', week2: '필요한 역량과 포트폴리오 갭 분석하기', week3: '현업자 인터뷰 또는 커피챗 3회 진행하기', week4: '3개월 전환 로드맵 작성하기' },
    restAfterQuit:    { week1: '월 지출 상한선 설정하기', week2: '최소 3~6개월 생활비 확보 여부 점검하기', week3: '회복 루틴과 재취업 시작일 설정하기', week4: '퇴사 전 인수인계 및 네트워크 정리하기' },
    startupFreelance: { week1: '서비스/제품 가설 1개 정의하기', week2: '잠재 고객 20명 리스트업하기', week3: '유료 고객 인터뷰 또는 사전 판매 테스트하기', week4: '매출 가능성이 없으면 퇴사 보류 재검토하기' },
    studyReskill:     { week1: '목표 직무와 필요한 역량 정의하기', week2: '학습 과정/부트캠프/자격증 비교하기', week3: '비용과 기간, 기대 연봉 변화 계산하기', week4: '학습 시작 전 재정 계획 확정하기' },
  };
  return plans[best];
}

// ─── Recommendation text ──────────────────────────────────────────────────────

const NUANCED_TITLES: Record<OptionKey, string> = {
  stay:             '현 직장 재설계 — 역할 협상 + 직무 조정 우선',
  jobChange:        '즉시 퇴사보다는 재직 중 이직 탐색',
  careerSwitch:     '현직 유지 중 직무 전환 준비',
  restAfterQuit:    '퇴사 후 회복, 단 구조화된 계획 필요',
  startupFreelance: '재직 중 고객 검증 후 창업/프리랜서 전환',
  studyReskill:     '지금 당장 이직보다 역량 보완 후 전환',
};

type SignalLevel = 'high' | 'medium' | 'low';

function computeTimingSignals(form: FormData, derived: DerivedVariables) {
  const { desireForChange, needForRest } = form.flow;
  const changeSignal: SignalLevel = desireForChange >= 4 ? 'high' : desireForChange >= 3 ? 'medium' : 'low';
  const restSignal: SignalLevel   = needForRest >= 4 ? 'high' : needForRest >= 3 ? 'medium' : 'low';
  const expansionSignal: SignalLevel =
    (derived.explorationDrive >= 70 && changeSignal === 'high') ? 'high' :
    (derived.explorationDrive >= 45 || changeSignal === 'high') ? 'medium' : 'low';
  return { changeSignal, restSignal, expansionSignal };
}

function getTraitLayerText(best: OptionKey, derived: DerivedVariables, traits: TraitInput): string {
  const rb = Math.round(derived.readinessBehavior);
  const ed = Math.round(derived.explorationDrive);
  const sp = Math.round(derived.stabilityPreference);
  const bp = Math.round(derived.burnoutPressure);
  const se = Math.round(normTo100(traits.selfEfficacy));
  const nw = Math.round(normTo100(traits.networking));
  const cu = Math.round(normTo100(traits.curiosity));
  const pl = Math.round(normTo100(traits.planning));
  const rt = Math.round(normTo100(traits.riskTolerance));
  const rn = Math.round(normTo100(traits.recoveryNeed));
  const mo = Math.round(normTo100(traits.meaningOrientation));

  switch (best) {
    case 'stay':
      if (sp >= 60) return `안정 지향 성향(선호도 ${sp}/100)이 현 직장 유지 전략과 잘 맞습니다. 변화 탐색 성향(${ed}/100)가 ${ed < 50 ? '낮아 급격한 전환보다 내부 최적화가 더 자연스럽습니다' : '있어도 현재 여건상 내부 개선부터 시도하는 것이 현실적입니다'}.`;
      return `행동 준비도(${rb}/100)와 계획성(${pl}/100)을 바탕으로 내부 조건 개선에 집중하는 전략이 성향에 맞을 수 있습니다.`;
    case 'jobChange':
      return `행동 준비도(${rb}/100)와 변화 탐색 성향(${ed}/100)가 이직 탐색에 유리한 성향입니다. 자기효능감(${se}/100)${se >= 50 ? '이 높아 탐색 과정에서 긍정적 동력이 됩니다' : '을 높이면 이직 성공 가능성을 끌어올릴 수 있습니다'}. 네트워킹 능력(${nw}/100)을 활용한 커피챗 탐색이 효과적입니다.`;
    case 'careerSwitch':
      return `의미 지향성(${mo}/100)과 호기심(${cu}/100)이 높아 직무 방향 전환이 장기적 만족도를 높일 가능성이 있습니다. 변화 탐색 성향(${ed}/100)가 새로운 분야 탐색을 자연스럽게 지지합니다.`;
    case 'restAfterQuit':
      return `회복 필요성(${rn}/100)과 현재 피로도(${bp}/100)이 높아 의도적인 휴식이 필요한 성향 상태입니다. 충분한 회복 없이 재출발하면 유사한 상황이 반복될 가능성이 있습니다.`;
    case 'startupFreelance':
      return `위험 감수성(${rt}/100)과 자기효능감(${se}/100)이 독립 환경에서의 도전을 지지합니다. 변화 탐색 성향(${ed}/100)와 네트워킹 능력(${nw}/100)이 사업 초기 탐색과 고객 확보에 도움이 될 수 있습니다.`;
    case 'studyReskill':
      return `호기심(${cu}/100)과 계획성(${pl}/100)이 체계적 학습 전략에 잘 맞는 성향입니다. 의미 지향성(${mo}/100)이 장기 목표 유지에 도움이 됩니다.`;
  }
}

function getTimingLayerText(
  changeSignal: SignalLevel, restSignal: SignalLevel,
  expansionSignal: SignalLevel, flowType: FlowType,
): string {
  const fl = FLOW_TYPE_LABELS[flowType];
  // Expansion language only when flow type actually reflects outward movement
  const isExpansionFlow = flowType === 'expansionExternal' || flowType === 'expansionInternal';
  if (expansionSignal === 'high' && isExpansionFlow)
    return `변화 탐색 성향과 변화 욕구가 모두 높아 지금은 확장·도전에 에너지가 맞춰진 시기입니다 (${fl}).`;
  if (changeSignal === 'high' && restSignal !== 'high')
    return `변화 욕구가 강한 시기로, 현재 에너지가 새로운 환경 탐색을 지지합니다 (${fl}). 단, 현실 준비도를 함께 점검하세요.`;
  if (restSignal === 'high' && changeSignal !== 'high')
    return `회복 필요성이 높은 시기입니다 (${fl}). 무리한 전진보다 재정비가 먼저일 수 있습니다.`;
  if (restSignal === 'high' && changeSignal === 'high')
    return `변화 욕구와 회복 필요성이 동시에 높습니다 (${fl}). 급격한 이동보다 방향 전환 후 단계적 전진이 맞을 수 있습니다.`;
  return `현재 흐름에서 특별히 강한 신호는 없습니다 (${fl}). 현실 지표와 성향 분석 중심으로 판단하세요.`;
}

export function generateRecommendationText(
  best: OptionKey, derived: DerivedVariables, flowType: FlowType, form: FormData,
): { title: string; reality: string; traitLayer: string; timingLayer: string; conclusion: string } {
  const { runwayMonths, burnoutRisk, marketReadiness, jobDissatisfaction } = derived;
  const { changeSignal, restSignal, expansionSignal } = computeTimingSignals(form, derived);

  const realities: Record<OptionKey, string> = {
    stay:             `현재 입력값 기준으로 번아웃 위험도(${burnoutRisk.toFixed(1)}/5)가 관리 가능한 수준이고, 런웨이(${runwayMonths.toFixed(1)}개월) 여건상 즉각적인 전환보다 내부 개선이 현실적입니다.`,
    jobChange:        `직무 불만족도(${jobDissatisfaction.toFixed(1)}/5)가 높고 이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 있는 편입니다. 런웨이(${runwayMonths.toFixed(1)}개월) 수준이라면 재직 중 탐색이 가능성이 높습니다.`,
    careerSwitch:     `직무 불만족도(${jobDissatisfaction.toFixed(1)}/5)가 높고 성장 가능성도 제한적입니다. 런웨이(${runwayMonths.toFixed(1)}개월) 여건이 있다면 전환 준비를 검토할 수 있습니다.`,
    restAfterQuit:    `번아웃 위험도(${burnoutRisk.toFixed(1)}/5)가 높고, 런웨이(${runwayMonths.toFixed(1)}개월)가 충분한 편입니다. 구조화된 휴식이 장기 커리어에 도움이 될 수 있습니다.`,
    startupFreelance: `런웨이(${runwayMonths.toFixed(1)}개월)와 이직 경쟁력(${marketReadiness.toFixed(1)}/5)를 함께 고려해야 합니다. 충분한 재정 버퍼가 있는 경우 검토할 수 있습니다.`,
    studyReskill:     `시장 경쟁력 강화가 필요하고, 런웨이(${runwayMonths.toFixed(1)}개월) 여건이 학습 투자를 허용하는 편입니다.`,
  };

  const conclusions: Record<OptionKey, string> = {
    stay:             '즉시 이직보다는 4~8주간 내부 조건 개선을 시도하고, 변화가 없으면 이직 탐색으로 전환하는 전략이 안전합니다.',
    jobChange:        '즉시 퇴사보다는 8~12주간 재직 중 이직 가능성을 테스트하는 전략이 가장 안전합니다.',
    careerSwitch:     '즉각 퇴사보다는 현직을 유지하면서 전환 준비를 3개월 단위로 검토하는 것이 현실적입니다.',
    restAfterQuit:    '퇴사 전 최소 6개월 생활비 확보를 확인하고, 3개월 내 재취업 목표를 설정하여 구조화된 휴식을 계획하는 것이 중요합니다.',
    startupFreelance: '최소 12개월 런웨이 확보 후 소규모 수익 테스트부터 시작하여 단계적으로 전환하는 전략을 검토하세요.',
    studyReskill:     '재직 중 학습부터 시작하되, 학습 비용·기간·기대 성과를 3개월 단위로 검증하며 진행하는 것이 현실적입니다.',
  };

  return {
    title:       NUANCED_TITLES[best],
    reality:     realities[best],
    traitLayer:  getTraitLayerText(best, derived, form.traits),
    timingLayer: getTimingLayerText(changeSignal, restSignal, expansionSignal, flowType),
    conclusion:  conclusions[best],
  };
}

// ─── Deep analysis report (4 sections) ───────────────────────────────────────

function generateCoreDiagnosis(form: FormData, derived: DerivedVariables): string {
  const { runwayMonths, burnoutRisk, jobDissatisfaction, marketReadiness } = derived;
  const { organizationStress, growthPotential } = form.careerStatus;
  const parts: string[] = [];

  if (burnoutRisk >= 4 && organizationStress >= 4)
    parts.push(`조직 스트레스(${organizationStress}/5)와 번아웃(${burnoutRisk.toFixed(1)}/5)이 동시에 임계점에 가까워, 현 환경을 장기 유지할 경우 심리적 소진이 가속될 가능성이 큽니다`);
  else if (burnoutRisk >= 3.5)
    parts.push(`번아웃 위험(${burnoutRisk.toFixed(1)}/5)이 기준치를 넘어서고 있어 에너지 회복 전략이 필요한 시점입니다`);
  else if (jobDissatisfaction >= 3.5 && growthPotential <= 2)
    parts.push(`직무 불만족(${jobDissatisfaction.toFixed(1)}/5)과 성장 경로 부재(${growthPotential}/5)가 겹쳐, 현재 위치에서 장기 동기를 유지하기 어려운 상태입니다`);
  else if (jobDissatisfaction >= 3)
    parts.push(`직무 불만족도(${jobDissatisfaction.toFixed(1)}/5)가 높아 현재 입력값 기준으로 현 직장 유지 시 만족도 회복이 쉽지 않아 보입니다`);
  else
    parts.push(`현재 입력값 기준 긴급한 위기 신호는 없으나, 성장 정체와 장기 동기 관리가 핵심 과제로 확인됩니다`);

  if (runwayMonths < 3)
    parts.push(`단, 재무 런웨이가 ${runwayMonths.toFixed(1)}개월에 불과해 소득 단절이 동반되는 선택지는 현실적으로 위험합니다`);
  else if (runwayMonths < 6)
    parts.push(`재무 런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 즉시 퇴사보다 재직 중 이동 전략이 더 안전합니다`);
  else if (runwayMonths >= 12)
    parts.push(`재무 런웨이(${runwayMonths.toFixed(1)}개월)가 충분해 단기 소득 공백도 일정 수준 감당 가능한 여건입니다`);

  if (marketReadiness >= 3.5 && jobDissatisfaction >= 3)
    parts.push(`이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 갖춰진 상태에서 불만족도가 높아, 현재가 이직 탐색을 시작할 적합한 시점일 수 있습니다`);
  else if (marketReadiness < 2.5)
    parts.push(`이직 경쟁력(${marketReadiness.toFixed(1)}/5)가 낮아 즉각 이직보다 역량 강화가 먼저 필요합니다`);

  return parts.join('. ') + '.';
}

function generateWhyTopChoice(
  bestKey: OptionKey, form: FormData, derived: DerivedVariables, scores: OptionScore[],
): string {
  const gap = scores.length >= 2 ? Math.round(scores[0].totalScore - scores[1].totalScore) : 0;
  const { runwayMonths, jobDissatisfaction, marketReadiness, readinessBehavior, explorationDrive, burnoutPressure } = derived;
  const { growthPotential } = form.careerStatus;
  const ed = Math.round(explorationDrive);
  const rb = Math.round(readinessBehavior);
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const bp = Math.round(burnoutPressure);

  const gapNote = gap >= 10
    ? `현재 입력값 기준 점수 차이(${gap}점)가 명확해 이 방향이 유효합니다.`
    : `단, 점수 차이(${gap}점)가 작아 복수 전략 병렬 검토도 가능합니다.`;

  switch (bestKey) {
    case 'jobChange':
      return `직무 불만족(${jobDissatisfaction.toFixed(1)}/5)이 내부 개선만으로 해소되기 어려운 수준에서, 변화 탐색 성향(${ed}/100)와 행동 준비도(${rb}/100)가 환경 전환을 실제로 가능하게 합니다. 런웨이(${runwayMonths.toFixed(1)}개월)가 있어 재직 중 탐색으로 리스크 없이 시작할 수 있는 구조입니다. ${gapNote}`;
    case 'stay':
      return `${marketReadiness < 3 ? `이직 경쟁력(${mr}/100)이 아직 충분하지 않아 외부 탐색보다 내부 조건 개선의 기대 효과가 더 큽니다` : `번아웃 수준이 아직 관리 가능해 즉각적 전환보다 협상이 더 효율적입니다`}. 직무 불만족(${jobDissatisfaction.toFixed(1)}/5)이 ${jobDissatisfaction >= 3 ? '있지만 4~8주 내부 협상으로 확인할 개선 여지가 남아 있습니다' : '낮아 내부 최적화만으로도 충분히 개선 가능한 상태입니다'}. ${gapNote}`;
    case 'careerSwitch':
      return `직무 불만족(${jobDissatisfaction.toFixed(1)}/5)과 ${growthPotential <= 2 ? `성장 경로 부재(${growthPotential}/5)가 겹쳐, 단순 이직보다 방향 전환이 더 근본적인 해결책` : `의미 지향 성향(${Math.round(normTo100(form.traits.meaningOrientation))}/100)이 맞물려, 직무 방향 자체를 바꾸는 것이 장기 만족도에 더 효과적`}임을 나타냅니다. 변화 탐색 성향(${ed}/100)가 새로운 분야 탐색을 자연스럽게 지지합니다. ${gapNote}`;
    case 'restAfterQuit':
      return `현재 피로도(${bp}/100)이 임계점을 넘어, 지금 무리하게 전진하면 어떤 선택도 효과가 반감됩니다. 런웨이(${runwayMonths.toFixed(1)}개월)가 구조화된 회복을 감당할 수 있는 여건을 만들어, 지금 쉬는 것이 오히려 더 빠른 복귀를 가능하게 합니다. ${gapNote}`;
    case 'startupFreelance':
      return `변화 탐색 성향(${ed}/100)와 런웨이(${runwayMonths.toFixed(1)}개월)가 독립 환경에서 아이디어를 검증할 조건을 만들어 줍니다. 단, 고객 검증 없이 퇴사하면 수익 공백이 예상보다 길어질 수 있어, 사전 매출 테스트가 전략의 핵심입니다. ${gapNote}`;
    case 'studyReskill':
      return `이직 경쟁력(${mr}/100)이 낮은 상태에서 바로 탐색에 나서면 기대 이하 조건으로 이직하거나 프로세스가 길어집니다. 역량 강화가 향후 선택지의 질을 높이는 선행 투자입니다. 호기심(${Math.round(normTo100(form.traits.curiosity))}/100)과 계획성(${Math.round(normTo100(form.traits.planning))}/100)이 체계적 학습을 뒷받침합니다. ${gapNote}`;
  }
}

function generateKeyRisks(bestKey: OptionKey, form: FormData, derived: DerivedVariables): string {
  const { runwayMonths, marketReadiness, jobDissatisfaction } = derived;
  const { growthPotential } = form.careerStatus;
  const parts: string[] = [];

  switch (bestKey) {
    case 'stay':
      parts.push('불만 요인을 해결하지 않으면 6~12개월 후 동일한 고민이 반복됩니다. 유지 결정은 반드시 개선 기한(4~8주)과 조건을 설정해야 합니다');
      if (growthPotential <= 2) parts.push(`성장 가능성(${growthPotential}/5)이 낮아, 지금 시장 경쟁력 강화를 병행하지 않으면 2~3년 후 선택지가 좁아집니다`);
      if (jobDissatisfaction >= 3.5) parts.push('불만족도가 높은 상태로 장기 유지하면 번아웃 가능성이 높아져 나중에 더 급하게 퇴사하는 패턴으로 이어질 수 있습니다');
      break;
    case 'jobChange':
      if (marketReadiness < 3) parts.push(`이직 경쟁력이 낮은 상태에서 탐색하면 기대 이하 조건으로 이직하거나 프로세스가 예상보다 길어져 번아웃이 더 심화될 수 있습니다`);
      parts.push('이직 동기가 "현 회사 탈출"에 가까울 경우, 새 환경에서 동일한 문제를 다시 마주칠 가능성이 높습니다. 이동 방향을 명확히 해야 패턴 반복을 막습니다');
      if (runwayMonths < 6) parts.push(`런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 퇴사 후 탐색 시 재정 압박이 협상력을 약화시킵니다. 재직 중 탐색이 필수입니다`);
      break;
    case 'careerSwitch':
      parts.push('전환 준비에 6~18개월이 필요하며, 이 기간 소득이 감소하거나 런웨이가 소진될 수 있습니다. 재정 계획이 없으면 준비 도중 포기할 가능성이 높습니다');
      parts.push('목표 직무를 현업자 인터뷰 없이 결정하면, 준비 후 실제 환경이 기대와 달라 비용·시간만 소모하는 결과가 됩니다');
      break;
    case 'restAfterQuit':
      parts.push('복귀 시점과 재취업 계획을 퇴사 전 구체화하지 않으면, 쉬는 기간이 계속 늘어나고 재취업 압박이 커지면서 더 불리한 조건으로 복귀하게 됩니다');
      if (runwayMonths < 6) parts.push(`런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 경제적 압박이 빠르게 오면 충분히 회복하기 전에 급하게 복귀해야 하는 상황이 만들어집니다`);
      break;
    case 'startupFreelance':
      parts.push('고객 검증 없이 퇴사하면 자금 소진 후 더 열악한 조건으로 재취업해야 할 수 있습니다. 창업은 "퇴사 후 시작"이 아닌 "검증 후 전환" 순서로 진행해야 리스크가 낮습니다');
      if (runwayMonths < 12) parts.push(`런웨이(${runwayMonths.toFixed(1)}개월)가 창업 초기 생존 기간(12~18개월)보다 짧아, 초기 매출 없이 버티는 기간이 재정 위기로 이어질 수 있습니다`);
      break;
    case 'studyReskill':
      parts.push('학습 후 취업 연결까지의 경로가 구체적으로 검증되지 않으면, 비용과 시간 투자 대비 ROI가 불확실합니다. 과정 선택 전 목표 직무 채용 공고 10개를 먼저 분析해야 합니다');
      if (runwayMonths < 9) parts.push(`런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 학습 도중 재정 압박이 생기면 학습을 중단하고 급하게 취업을 결정하는 상황이 만들어질 수 있습니다`);
      break;
  }

  return parts.join('. ') + '.';
}

function generateNextSignals(bestKey: OptionKey, _form: FormData, derived: DerivedVariables): string[] {
  const { runwayMonths, marketReadiness, burnoutRisk } = derived;
  switch (bestKey) {
    case 'stay': return [
      '4주 후에도 업무 만족도가 개선되지 않는다면 이직 준비로 전환을 고려하세요',
      `이직 경쟁력를 ${marketReadiness.toFixed(1)}/5에서 3.5 이상으로 높일 수 있다면 이직 옵션이 더 강해집니다`,
      '연봉 협상 또는 역할 조정 가능성을 2주 내로 파악해야 합니다',
    ];
    case 'jobChange': return [
      '이직 지원 4주 후 면접 반응률이 20% 미만이라면 포지셔닝을 재점검하세요',
      `런웨이가 ${Math.max(0, runwayMonths - 2).toFixed(0)}개월 아래로 줄어들면 이직 탐색을 즉시 가속해야 합니다`,
      '커피챗 3회 이상 후 목표 업계의 현실적 조건을 파악하는 것이 먼저입니다',
    ];
    case 'careerSwitch': return [
      '목표 직무 현업자 인터뷰 3회 후 기대와 현실의 갭을 확인하세요',
      '전환 비용 대비 예상 연봉 변화를 3개월 단위로 계산해야 합니다',
      '재직 중 소규모 프로젝트로 전환 역량을 검증할 수 있는지 먼저 확인하세요',
    ];
    case 'restAfterQuit': return [
      '월 지출을 현재보다 20% 낮출 수 있는지 먼저 확인하세요',
      '3개월 후 재취업 활동 시작 시점을 지금 설정해야 합니다',
      `번아웃 수준이 ${burnoutRisk.toFixed(1)}/5에서 2.5 이하로 떨어지는 시점이 재취업 탐색 시작 신호입니다`,
    ];
    case 'startupFreelance': return [
      '퇴사 전 잠재 고객 20명과 대화하고, 유료 의향 3명 이상이 확인될 때 진행하세요',
      '4주 내 사전 판매 또는 파일럿 프로젝트로 매출 가능성을 검증해야 합니다',
      '현재 직장에서 프리랜서 프로젝트를 병행 테스트할 수 있는지 먼저 확인하세요',
    ];
    case 'studyReskill': return [
      '목표 직무 공고 10개를 분석해 필요 역량 목록을 먼저 정리하세요',
      '학습 비용 대비 3년 후 기대 연봉 변화를 계산해 ROI를 검증해야 합니다',
      '재직 중 1개 과정을 먼저 완료해 학습 지속 가능성을 테스트하세요',
    ];
  }
}

// ─── Decision structure (4 causal elements) ──────────────────────────────────

function generateDecisionStructure(
  bestKey: OptionKey, derived: DerivedVariables,
): string[] {
  const { explorationDrive, readinessBehavior, financialSafetyBase, burnoutPressure, runwayMonths, marketReadiness } = derived;
  const ed = Math.round(explorationDrive);
  const rb = Math.round(readinessBehavior);
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const bp = Math.round(burnoutPressure);
  const fs = Math.round(financialSafetyBase);

  const expansionSignal =
    explorationDrive >= 65
      ? `변화 탐색 성향(${ed}/100)와 변화 욕구가 모두 높아 현재 환경에서 지속할 동기가 줄어들고 있습니다. 확장이나 전환을 향한 에너지가 충분한 상태입니다.`
      : explorationDrive >= 45
        ? `변화를 향한 에너지(${ed}/100)가 중간 수준입니다. 변화 욕구가 있지만 방향이 아직 구체화되지 않은 상태입니다.`
        : `안정 지향 성향이 강하고 변화 에너지(${ed}/100)가 낮습니다. 지금은 전환보다 내부 최적화가 더 자연스러운 시기입니다.`;

  const executionSignal =
    readinessBehavior >= 65 && mr >= 50
      ? `행동 준비도(${rb}/100)와 이직 경쟁력(${mr}/100)이 모두 갖춰져 있어, 탐색을 실제 행동으로 옮길 수 있는 상태입니다.`
      : readinessBehavior >= 50
        ? `행동 준비도(${rb}/100)는 충분하지만 이직 경쟁력(${mr}/100) 강화가 탐색 성공률을 높일 수 있습니다.`
        : mr >= 50
          ? `이직 경쟁력(${mr}/100)은 있지만 자기효능감과 네트워킹 역량(행동 준비도 ${rb}/100)을 높이면 탐색 효과가 배가됩니다.`
          : `행동 준비도(${rb}/100)와 이직 경쟁력(${mr}/100) 모두 강화가 필요합니다. 역량 개발 후 탐색하는 것이 더 효과적입니다.`;

  const riskLevel =
    runwayMonths < 3
      ? `재무 런웨이가 ${runwayMonths.toFixed(1)}개월에 불과해 소득 단절이 동반되는 선택지는 즉시 생계 위험을 만듭니다. 소득 안정화가 최우선 과제입니다.`
      : runwayMonths < 6
        ? `재무 런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 퇴사 없이 재직 중 탐색만 안전합니다. 즉시 퇴사 전략은 이 여건에서 작동하지 않습니다.`
        : bp >= 70
          ? `현재 피로도(${bp}/100)이 매우 높아 지금 무리하게 전진하면 어떤 선택도 효과가 반감됩니다. 회복 전략을 병행해야 합니다.`
          : fs >= 60
            ? `재무 안전성(${fs}/100)이 충분해 단기 소득 공백도 일정 수준 감당 가능한 여건입니다.`
            : `재무 여건(안전성 ${fs}/100)이 보통 수준으로, 소득 단절 없이 탐색하는 전략이 안전합니다.`;

  const conclusionMap: Record<OptionKey, string> = {
    stay:             '세 요소를 종합하면, 지금은 즉각적인 전환보다 4~8주간 내부 조건 개선을 먼저 시도하고, 변화가 없을 때 이직 탐색으로 전환하는 단계적 전략이 가장 합리적입니다.',
    jobChange:        '세 요소를 종합하면, 지금 당장 퇴사가 아닌 재직 중 8~12주간 이직 탐색을 시작해 시장 반응을 확인한 후 퇴사 여부를 결정하는 것이 가장 안전하고 합리적인 전략입니다.',
    careerSwitch:     '세 요소를 종합하면, 현직을 유지하면서 목표 직무를 3개월 단위로 검증하는 병행 전환 전략이 리스크와 성과 가능성 모두에서 균형 잡힌 접근입니다.',
    restAfterQuit:    '세 요소를 종합하면, 최소 6개월 런웨이를 확인하고 복귀 시점을 설정한 구조화된 휴식이 단순 퇴사보다 전략적으로 더 효과적입니다.',
    startupFreelance: '세 요소를 종합하면, 퇴사 전 유료 고객 확보나 사전 매출 테스트로 가설을 검증한 후 단계적으로 전환하는 것이 가장 안전합니다.',
    studyReskill:     '세 요소를 종합하면, 재직 중 학습을 병행해 역량을 강화하고, 이를 토대로 이직 가능성을 높이는 단계적 전략이 현재 여건에 가장 적합합니다.',
  };

  return [expansionSignal, executionSignal, riskLevel, conclusionMap[bestKey]];
}

// ─── Trade-off comparison (why #1 > #2 and #1 > #3) ─────────────────────────

function explainWhyWinsOver(
  winner: OptionScore, loser: OptionScore, derived: DerivedVariables,
): string {
  const gap = Math.round(winner.totalScore - loser.totalScore);
  const { runwayMonths, explorationDrive, readinessBehavior, burnoutPressure } = derived;
  const ed = Math.round(explorationDrive);
  const rb = Math.round(readinessBehavior);
  const bp = Math.round(burnoutPressure);

  const key = `${winner.key}>${loser.key}`;
  const map: Record<string, string> = {
    'jobChange>stay':           `이직이 현직 유지보다 높은 이유(${gap}점 차): 직무 불만족이 내부 개선만으로 해소되기 어려운 수준에서, 변화 탐색 성향(${ed}/100)와 행동 준비도(${rb}/100)가 탐색을 실제로 가능하게 합니다. 현직 유지는 단기 안전하지만 성장 정체로 인한 장기 손실이 더 클 수 있습니다.`,
    'jobChange>careerSwitch':   `이직이 직무 전환보다 높은 이유(${gap}점 차): 이직 경쟁력이 갖춰진 상태라면 직무 전환보다 더 빠르게 실행할 수 있습니다. 전환은 준비 기간(6~18개월)이 더 길고 런웨이(${runwayMonths.toFixed(1)}개월) 소비가 큽니다.`,
    'jobChange>restAfterQuit':  `이직이 퇴사 후 휴식보다 높은 이유(${gap}점 차): 현재 피로도(${bp}/100)이 극단적이지 않은 상태에서 쉬는 것보다 환경 전환이 문제 해소에 더 직접적입니다. 퇴사 후 휴식은 소득 단절 리스크가 발생합니다.`,
    'jobChange>studyReskill':   `이직이 역량 강화보다 높은 이유(${gap}점 차): 이미 이직 경쟁력이 충분한 상태라면 추가 학습보다 지금 시장에서 반응을 확인하는 것이 더 효율적입니다. 학습은 탐색과 병행 가능합니다.`,
    'jobChange>startupFreelance': `이직이 창업보다 높은 이유(${gap}점 차): 창업은 런웨이(${runwayMonths.toFixed(1)}개월)와 고객 검증 없이 진행하면 리스크가 큽니다. 이직은 동일한 욕구를 훨씬 낮은 리스크로 해소할 수 있습니다.`,
    'stay>jobChange':           `현직 유지가 이직보다 높은 이유(${gap}점 차): 이직 경쟁력이 아직 충분하지 않은 상태에서 탐색하면 기대 이하 조건으로 이직하거나 프로세스가 길어질 수 있습니다. 내부 조건 개선을 먼저 시도하는 것이 손실이 더 작습니다.`,
    'stay>restAfterQuit':       `현직 유지가 퇴사 후 휴식보다 높은 이유(${gap}점 차): 런웨이(${runwayMonths.toFixed(1)}개월)가 충분한 회복을 보장하기 어렵습니다. 재직 중 회복 루틴을 도입하는 것이 소득을 유지하면서 번아웃을 완화하는 현실적 전략입니다.`,
    'stay>studyReskill':        `현직 유지가 역량 강화보다 높은 이유(${gap}점 차): 학습 투자보다 현재 역할에서 조건을 개선하는 것이 더 즉각적인 효과를 낼 수 있습니다. 학습은 현직 유지와 병행 가능합니다.`,
    'restAfterQuit>jobChange':  `퇴사 후 휴식이 이직보다 높은 이유(${gap}점 차): 현재 피로도(${bp}/100)이 매우 높아 지금 이직 탐색을 시작하면 면접 과정 자체가 에너지 소모를 가중시킵니다. 회복 후 탐색이 더 높은 성공률을 가져올 가능성이 큽니다.`,
    'careerSwitch>jobChange':   `직무 전환이 이직보다 높은 이유(${gap}점 차): 불만족의 원인이 회사보다 직무에 있을 가능성이 높습니다. 같은 직무로 이직하면 유사한 문제가 반복될 수 있어, 방향 자체를 바꾸는 것이 더 근본적인 해결책입니다.`,
    'studyReskill>jobChange':   `역량 강화가 이직보다 높은 이유(${gap}점 차): 이직 경쟁력이 충분하지 않은 상태에서 탐색하면 기대 이하 조건으로 이직하거나 프로세스가 길어집니다. 역량 강화가 이직 성공 가능성을 높이는 선행 투자입니다.`,
    'startupFreelance>jobChange': `창업이 이직보다 높은 이유(${gap}점 차): 변화 탐색 성향(${ed}/100)와 런웨이(${runwayMonths.toFixed(1)}개월)가 충분해, 고객 검증 후 단계적 전환이 이직보다 더 큰 성장 가능성을 제공합니다.`,
  };

  return map[key] ??
    `${winner.label}이 ${loser.label}보다 높은 이유(${gap}점 차): 현재 입력값 기준 성향 부합도와 현실 지표 조합이 ${winner.label}에 더 유리합니다.`;
}

function generateTradeoffComparison(scores: OptionScore[], derived: DerivedVariables): string[] {
  if (scores.length < 2) return [];
  const results: string[] = [explainWhyWinsOver(scores[0], scores[1], derived)];
  if (scores.length >= 3) results.push(explainWhyWinsOver(scores[0], scores[2], derived));
  return results;
}

// ─── Recommendation change conditions ────────────────────────────────────────

function generateChangeConditions(
  bestKey: OptionKey, derived: DerivedVariables,
): string[] {
  const { runwayMonths, marketReadiness, burnoutPressure } = derived;
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const bp = Math.round(burnoutPressure);

  switch (bestKey) {
    case 'jobChange': return [
      runwayMonths < 6
        ? `런웨이가 현재(${runwayMonths.toFixed(1)}개월)보다 더 줄어 3개월 이하가 되면, 탐색보다 소득 유지가 최우선이 됩니다. 현직 유지가 1위로 올라올 수 있습니다.`
        : `런웨이가 3개월 이하로 줄면 소득 단절형 선택지는 모두 위험해지고 현직 유지가 1위가 됩니다.`,
      mr < 50
        ? `이직 경쟁력이 현재(${mr}/100)보다 더 낮아져 30/100 이하가 되면, 역량 강화가 이직보다 먼저인 상태가 됩니다.`
        : `이직 경쟁력이 30/100 이하로 낮아지면 공부/역량 강화가 이직보다 우선 순위가 될 수 있습니다.`,
      bp < 70
        ? `현재 피로도가 80/100 이상으로 높아지면, 이직 탐색 전에 퇴사 후 회복이 먼저 필요한 상태가 됩니다.`
        : `현재 피로도(${bp}/100)이 이미 높아, 이직 탐색 중 회복 루틴을 병행하지 않으면 탐색 과정 자체가 에너지를 더 소모합니다.`,
    ];
    case 'stay': return [
      `이직 경쟁력이 50/100 이상으로 높아지고 직무 불만족이 지속된다면, 이직 탐색이 1위로 올라올 수 있습니다.`,
      `현재 피로도가 75/100 이상으로 높아지면, 내부 개선보다 회복이 더 필요한 상태가 됩니다.`,
      `4~8주 내 내부 조건(역할/연봉) 개선에 실패하면 이직 탐색으로 전환하는 것이 합리적입니다. 개선 기한이 없는 유지는 전략이 아닙니다.`,
    ];
    case 'restAfterQuit': return [
      `런웨이가 4개월 이하로 줄어들면 퇴사 후 휴식보다 재직 중 탐색으로 전략을 바꿔야 합니다.`,
      `현재 피로도가 회복 루틴을 통해 60/100 이하로 낮아진다면 퇴사 없이 이직 탐색을 시작하는 전략이 더 안전합니다.`,
      `복귀 목표 시점과 재취업 계획이 퇴사 전 구체화되지 않으면 쉬는 기간이 계속 늘어나 재정 압박이 커집니다.`,
    ];
    case 'careerSwitch': return [
      `런웨이가 6개월 이하로 줄면 전환 준비보다 재직 중 이직 탐색이 더 현실적인 선택이 됩니다.`,
      `목표 직무 현업자 인터뷰에서 전환 후 연봉이 크게 낮아진다는 것이 확인되면, 이직(동일 직무)이 더 나은 선택지일 수 있습니다.`,
      `현재 회사 내에서 원하는 직무로 이동이 가능하다면 외부 전환보다 사내 전환이 먼저입니다.`,
    ];
    case 'startupFreelance': return [
      `런웨이가 9개월 이하로 줄면 창업보다 이직을 먼저 탐색해 소득을 안정화하는 것이 현실적입니다.`,
      `4주 내 유료 고객 의향이 3명 미만으로 확인되면 창업보다 이직을 먼저 검토하는 것이 안전합니다.`,
      `현재 피로도가 높아질수록 창업 초기의 불확실성을 버티기 어려워지므로 번아웃 해소가 먼저입니다.`,
    ];
    case 'studyReskill': return [
      `이미 이직 경쟁력이 50/100 이상이라면 추가 학습보다 이직 탐색을 먼저 시도하는 것이 더 효율적입니다.`,
      `런웨이가 6개월 이하로 줄면 학습 기간 동안 재정 압박이 커져 재직 중 이직 탐색이 더 현실적입니다.`,
      `학습 후 취업 경로가 구체적으로 검증되지 않으면 시간·비용 투자 대비 효과가 불확실합니다. 과정 선택 전 목표 직무 채용 공고 10개를 먼저 분析하세요.`,
    ];
  }
}

export function generateAnalysisReport(
  bestKey: OptionKey, form: FormData, derived: DerivedVariables, scores: OptionScore[],
): AnalysisReport {
  return {
    coreDiagnosis:    generateCoreDiagnosis(form, derived),
    whyTopChoice:     generateWhyTopChoice(bestKey, form, derived, scores),
    keyRisks:         generateKeyRisks(bestKey, form, derived),
    nextSignals:      generateNextSignals(bestKey, form, derived),
    decisionStructure: generateDecisionStructure(bestKey, derived),
    tradeoffComparison: generateTradeoffComparison(scores, derived),
    changeConditions:  generateChangeConditions(bestKey, derived),
  };
}

// ─── Confidence explanation ───────────────────────────────────────────────────

export function generateConfidenceExplanation(scores: OptionScore[], derived: DerivedVariables): string {
  if (scores.length < 2) return '분석할 선택지가 충분하지 않습니다.';
  const gap = scores[0].totalScore - scores[1].totalScore;
  const alignment = scores[0].traitFitScore + scores[0].flowFitScore;

  // Genuine contradictions → low confidence
  if (derived.runwayMonths < 3)
    return `재무 런웨이(${derived.runwayMonths.toFixed(1)}개월)가 매우 짧아 재정 불안 요인이 결과 해석에 영향을 줍니다. 소득 안정화 후 재분석을 권장합니다.`;
  if (derived.burnoutRisk >= 4 && derived.runwayMonths < 6)
    return '심리적 소진과 재무 여건이 동시에 제약을 만들고 있습니다. 이 긴장이 결과 해석에 영향을 줍니다.';

  // Small gap: two valid paths, not a problem — rephrase as multi-strategy
  if (gap < 8)
    return `1·2위 점수 차이(${gap.toFixed(0)}점)가 작아 단일 정답보다 복합 전략이 더 적합합니다. 두 경로를 병렬로 탐색하거나 추가 정보 수집 후 재판단을 권장합니다.`;

  if (gap >= 15 && alignment >= 15)
    return `현실 지표와 성향 지표가 같은 방향을 가리키고, 선택지 간 점수 차이(${gap.toFixed(0)}점)도 명확합니다. 현재 입력값 기준으로 신뢰도 높은 결과입니다.`;
  return '현실 지표는 명확하지만 성향·타이밍 일치도가 부분적입니다. 추천 방향은 유효하나 실행 전 추가 검토를 권장합니다.';
}

// Returns the nuanced badge label shown in the UI.
// "신뢰도 낮음" is reserved for genuine contradictions, not merely small score gaps.
export function computeConfidenceLabel(
  confidence: ConfidenceLevel,
  gap: number,
  _derived: DerivedVariables,
): string {
  if (confidence === 'low') return '신뢰도 낮음';         // only genuine contradictions reach here
  if (confidence === 'high') return '신뢰도 높음';
  // medium: distinguish small-gap (multi-strategy) from normal medium
  if (gap < 8) return '복합 전략 권장';
  return '신뢰도 중간';
}

export function calculateConfidence(scores: OptionScore[], derived: DerivedVariables): ConfidenceLevel {
  if (scores.length < 2) return 'medium';
  const gap = scores[0].totalScore - scores[1].totalScore;
  const alignment = scores[0].traitFitScore + scores[0].flowFitScore;
  // 'low' only for genuine contradictions — short runway or burnout+runway conflict
  if (derived.runwayMonths < 3) return 'low';
  if (derived.burnoutRisk >= 4 && derived.runwayMonths < 6) return 'low';
  // Small gap is 'medium' (not low) — direction/execution layer handles nuance
  if (gap < 8) return 'medium';
  if (gap >= 15 && alignment >= 15) return 'high';
  return 'medium';
}

// ─── Timing analysis ──────────────────────────────────────────────────────────

export function generateTimingAnalysis(form: FormData, derived: DerivedVariables): TimingAnalysis {
  const { desireForStability } = form.flow;
  const { changeSignal, restSignal, expansionSignal } = computeTimingSignals(form, derived);

  const signals: string[] = [];
  if (changeSignal === 'high')    signals.push('변화/이동 욕구 강함');
  if (desireForStability >= 4)    signals.push('안정/축적 욕구 강함');
  if (restSignal === 'high')      signals.push('정리/회복 필요성 강함');
  if (expansionSignal === 'high') signals.push('확장 에너지 높음');

  const timingText = getTimingLayerText(changeSignal, restSignal, expansionSignal, calculateFlowType(form));

  return {
    inferredEvents: inferTargetEvents(form.selectedOptions),
    signals,
    notes: [timingText],
  };
}

// ─── Master calculate ─────────────────────────────────────────────────────────

// ─── Gauge score: career change readiness (0-100) ────────────────────────────
// 0 = very stable/no need to change, 100 = overdue for change/high risk

export function calculateGaugeScore(derived: DerivedVariables): number {
  const { jobDissatisfaction, explorationDrive, stabilityPreference, burnoutRisk, runwayMonths } = derived;
  let score = (jobDissatisfaction / 5) * 100 * 0.35
            + explorationDrive * 0.35
            + (100 - stabilityPreference) * 0.30;
  // Financial crisis + severe burnout → push toward overheated zone
  if (runwayMonths < 3 || (burnoutRisk >= 4.5 && runwayMonths < 6)) score = Math.max(score, 75);
  return Math.round(clamp(score));
}

// ─── One-line insight for hero card ──────────────────────────────────────────

export function generateOneLineInsight(bestKey: OptionKey, derived: DerivedVariables): string {
  const { financialSafetyBase, burnoutRisk, runwayMonths } = derived;
  const marketPct = Math.round((derived.marketReadiness - 1) / 4 * 100);
  switch (bestKey) {
    case 'jobChange':
      if (marketPct >= 50 && financialSafetyBase >= 50)
        return '변화 욕구와 이직 경쟁력은 충분하지만, 재무 안정성을 유지한 상태에서 움직이는 것이 안전합니다.';
      if (marketPct < 50)
        return '변화 욕구는 높지만 이직 경쟁력 강화가 선행되면 더 유리한 조건으로 이동할 수 있습니다.';
      return '이직 탐색은 가능하지만 런웨이가 짧아 재직 중 탐색 전략이 필수입니다.';
    case 'stay':
      return '아직 내부 개선의 여지가 있습니다. 4~8주간 조건 협상을 시도한 후 방향을 결정하세요.';
    case 'restAfterQuit':
      return `소진 수준(${burnoutRisk.toFixed(1)}/5)이 높아 지금 무리한 전진보다 회복이 더 전략적인 선택입니다.`;
    case 'careerSwitch':
      return '직무 자체의 방향 전환이 필요한 시점입니다. 목표 직무 검증 후 단계적으로 전환하세요.';
    case 'startupFreelance':
      return `런웨이(${runwayMonths.toFixed(1)}개월) 여건 확인 후, 독립 전 고객 검증이 퇴사보다 먼저입니다.`;
    case 'studyReskill':
      return '역량 강화가 다음 이동의 기반을 만들어 줄 가능성이 높습니다.';
  }
}

// ─── Expert interpretation (3-block consultant summary) ──────────────────────

export function generateExpertInterpretation(
  bestKey: OptionKey, _form: FormData, derived: DerivedVariables,
): ExpertInterpretation {
  const { burnoutRisk, jobDissatisfaction, explorationDrive, runwayMonths, burnoutPressure, marketReadiness } = derived;
  const ed = Math.round(explorationDrive);
  const bp = Math.round(burnoutPressure);
  const mr = Math.round((marketReadiness - 1) / 4 * 100);

  // Signal: diagnostic cause, not raw value reporting
  let signal: string;
  if (burnoutRisk >= 4 && jobDissatisfaction >= 3.5)
    signal = `번아웃과 직무 불만족이 동시에 높아, 현재 환경에서는 에너지 회복이 쉽지 않은 구조적 상태입니다. 단순 피로가 아닌 환경 미스매치의 신호일 수 있습니다.`;
  else if (explorationDrive >= 65 && jobDissatisfaction >= 3)
    signal = `변화 에너지(${ed}/100)와 직무 불만족이 함께 높아, 현 환경에서 지속적인 동기를 유지하기 어려운 상태입니다. 탐색을 향한 심리적 준비가 이미 시작된 시점입니다.`;
  else if (mr >= 55 && jobDissatisfaction >= 3)
    signal = `이직 경쟁력(${mr}/100)은 충분하지만 불만족이 지속되고 있어, 역량이 있음에도 활용하지 못하는 상태입니다. 행동할 조건이 갖춰졌지만 실행이 아직 시작되지 않았습니다.`;
  else if (burnoutRisk >= 3.5)
    signal = `번아웃 수준이 기준치를 넘어 에너지 관리가 필요한 시점입니다. 지금 무리하게 전진하면 어떤 선택도 효과가 반감될 수 있습니다.`;
  else
    signal = '성장 정체와 만족도 하락이 서서히 진행 중입니다. 급격한 변화보다 방향 조정이 필요한 단계입니다.';

  // Interpretation: causal and conditional, not generic
  const interpretations: Record<OptionKey, string> = {
    jobChange:        '불만족의 원인이 조직 문화나 성장 환경에 있다면 환경 전환이 가장 직접적인 해결책입니다. 반면 개인 소진이 더 큰 원인이라면 회복 후 탐색이 성공 가능성을 더 높입니다. 지금은 재직 중 탐색으로 두 가지 가능성을 동시에 확인할 수 있습니다.',
    stay:             '불만족 요인이 내부 협상이나 역할 조정으로 개선 가능하다면, 이직 리스크 없이 환경을 바꿀 수 있습니다. 단, 구조적으로 개선이 불가능하다고 확인되면 즉시 이직 탐색으로 전환해야 합니다. 4~8주가 검증의 기준 시간입니다.',
    restAfterQuit:    `번아웃 해소 없이 다음 선택을 해도 같은 패턴이 반복될 가능성이 높습니다. 현재 피로도(${bp}/100)이 높은 상태에서의 무리한 전진은 어떤 선택도 효과를 반감시킵니다. 지금 쉬는 것이 오히려 더 빠른 복귀를 가능하게 합니다.`,
    careerSwitch:     '이직(동일 직무)이 아닌 방향 전환이 더 근본적인 해결책인 상태입니다. 단, 전환 직무를 충분히 검증하지 않으면 비용만 발생하고 실패할 수 있습니다. 현업자 인터뷰 3회 이상이 결정 전 필수 단계입니다.',
    startupFreelance: '자율적 환경에서 동기가 회복될 가능성이 높지만, 수익 검증 없이 퇴사하면 자금이 소진된 후 더 열악한 조건으로 재취업해야 할 수 있습니다. 퇴사 전 고객 검증이 전략의 핵심입니다.',
    studyReskill:     '지금의 역량 투자가 2~3년 후 선택지를 크게 넓혀줄 수 있습니다. 단, 학습 후 취업 연결까지의 경로가 구체적으로 검증되지 않으면 ROI가 불확실해집니다. 과정 선택 전 목표 직무 채용 공고 10개를 먼저 분析하세요.',
  };

  // Strategy: specific numbers, conditional on financial reality
  const strategies: Record<OptionKey, string> = {
    jobChange:        runwayMonths >= 6
      ? `런웨이(${runwayMonths.toFixed(1)}개월)가 있으니 즉시 퇴사 없이 8~12주 재직 중 탐색이 가능합니다. 면접 반응률 20% 이상이 나오면 퇴사 시점을 결정하고, 그 이하라면 포지셔닝 재점검이 먼저입니다.`
      : `런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 퇴사 없이 탐색만 하세요. 소득 유지가 협상력을 지켜줍니다. 8주 내 시장 반응을 확인한 후 퇴사 여부를 결정하세요.`,
    stay:             '4~8주 내 역할/연봉 조정을 시도하고, 변화가 없으면 이직 탐색으로 전환하세요. 내부 개선 여지가 없다고 확인되는 순간이 이직 탐색 시작 신호입니다.',
    restAfterQuit:    '퇴사 전 최소 6개월 생활비 확보를 확인하고, 복귀 시점(3개월 후 재취업 탐색 시작)을 지금 설정하세요. 구조화된 휴식만이 소진 없는 복귀를 가능하게 합니다.',
    careerSwitch:     '재직 중 목표 직무 현업자 3명과 대화한 후 전환 결정을 내리세요. 인터뷰 전 퇴사나 학원 등록은 검증 없는 비용 발생입니다.',
    startupFreelance: '퇴사 전 유료 고객 1명 이상 확보 또는 사전 판매 테스트로 매출 가능성을 확인하세요. 재직 중 파일럿 테스트가 가능한지 먼저 검토하세요.',
    studyReskill:     '재직 중 1개 과정을 먼저 완료해 학습 지속 가능성을 테스트하세요. 비용·기간·기대 연봉 변화 ROI 계산 없이는 시작하지 마세요.',
  };

  const evidenceTagsMap: Record<OptionKey, string[]> = {
    jobChange:        ['SCCT: 자기효능감·결과기대', 'Career Adaptability: 탐색성·주도성', 'Planned Happenstance: 기회 생성 실험'],
    stay:             ['Job Crafting: 현 직무 재설계', 'Career Anchors: 안정성', 'Career Adaptability: 미래준비'],
    restAfterQuit:    ['Career Adaptability: 미래준비·자신감', 'Career Anchors: 라이프스타일'],
    careerSwitch:     ['SCCT: 결과기대', 'Career Anchors: 전문성', 'Planned Happenstance: 기회 창출'],
    startupFreelance: ['Career Anchors: 자율성·기업가정신', 'SCCT: 자기효능감', 'Planned Happenstance: 기회 생성 실험'],
    studyReskill:     ['SCCT: 자기효능감 강화', 'Career Anchors: 전문성', 'Career Adaptability: 탐색성'],
  };

  return {
    signal,
    interpretation: interpretations[bestKey],
    strategy: strategies[bestKey],
    evidenceTags: evidenceTagsMap[bestKey],
  };
}

// ─── Action plan with success metrics ────────────────────────────────────────

// Selects the appropriate job crafting strategy based on form inputs.
// Returns task / relational / cognitive variant with context-appropriate advice.
function selectJobCraftingPlan(form: FormData): ActionPlanDetailed {
  const orgStress      = form.careerStatus.organizationStress;   // 1–5
  const moRaw          = normTo100(form.traits.meaningOrientation); // 0–100
  const highOrgStress  = orgStress >= 4;
  const highMeaning    = moRaw >= 60;

  if (highOrgStress && highMeaning) {
    // Relational + Cognitive: redesign relationships AND reframe meaning
    return {
      week1: { task: '역할 경계 설정 — 현재 업무 범위에서 없애거나 줄일 항목 3가지 목록 작성', metric: '범위 조정 제안 문서 1장' },
      week2: { task: '협업 구조 재설계 — 스트레스 유발 업무 흐름을 바꿀 수 있는 관계자 1명과 대화', metric: '협업 방식 변경안 1개 합의 또는 시도' },
      week3: { task: '의미 재구성(Cognitive Crafting) — 현재 역할을 장기 커리어 스토리와 연결하는 문장 3개 작성', metric: '역할 재정의 문장 완성' },
      week4: { task: '4주 개선 신호 확인 — 스트레스 원인이 줄었는지 체크. 개선 없으면 사내 이동 또는 이직 탐색 결정', metric: '개선 확인 or 이직 결정 완료' },
    };
  }
  if (highOrgStress) {
    // Relational + Task: reduce stress through relationship and workload redesign
    return {
      week1: { task: '업무 강도 조정 — 현재 업무 중 위임·제거 가능한 항목 파악 및 상위 보고', metric: '업무 목록 정리 + 조정 요청 1건' },
      week2: { task: '협업 구조 재설계 — 부정적 상호작용이 많은 협업 방식 개선 방안 논의 (상사 아닌 동료/유관 부서 먼저)', metric: '개선 방안 1개 제안 완료' },
      week3: { task: '사내 이동 가능성 탐색 — HR 또는 신뢰할 수 있는 내부 네트워크를 통해 부서 이동 가능성 파악', metric: '이동 가능 포지션 1개 이상 확인' },
      week4: { task: '4주 후 스트레스 원인 재평가 — 개선됐으면 유지, 아니면 이직 탐색으로 전환 결정', metric: '유지 or 이직 결정 완료' },
    };
  }
  if (highMeaning) {
    // Cognitive + Task: reconnect work to meaning and reshape tasks
    return {
      week1: { task: '불만 요인 3가지 정리 + 현재 역할에서 의미 있는 부분 2가지 발견하기', metric: '의미 목록 + 불만 목록 작성 완료' },
      week2: { task: '의미 재구성 — 현재 역할을 장기 커리어 목표와 연결하는 서사 1개 작성', metric: '역할 재정의 문장 1개 완성' },
      week3: { task: '의미 있는 프로젝트 확보 시도 — 사내에서 관심 있는 프로젝트 또는 TF 참여 가능성 탐색', metric: '관심 프로젝트 1개 식별 + 참여 의향 전달' },
      week4: { task: '4~8주 내 변화 신호 확인 — 의미 회복됐으면 유지, 아니면 직무 전환 또는 이직 탐색으로 결정', metric: '유지 or 전환 결정 완료' },
    };
  }
  // Default: Task crafting — standard role adjustment
  return {
    week1: { task: '불만 요인 3가지 정리 + 직무 재설계 가능성 탐색 (업무 범위·역할 조정)', metric: '개선 요청 문서 1장 + 직무 조정 아이디어 3개' },
    week2: { task: '역할 조정 또는 프로젝트 변경 가능성 논의 — 상사가 아니라 업무 구조로 접근하기', metric: '피드백 1회 이상 확보' },
    week3: { task: '근무 방식 조정·업무 의미 재구성 등 직무 재설계 옵션 1가지 실행', metric: '실행 중인 변화 1개 이상 확인' },
    week4: { task: '개선 신호 없으면 이직 탐색 전환 결정 (내부 조건 개선 기한: 4~8주)', metric: '유지+재설계 or 이직 전환 결정 완료' },
  };
}

export function generateActionPlanDetailed(bestKey: OptionKey, form?: FormData, decisionClass?: CareerDecisionClass): ActionPlanDetailed {
  // ── Gate-class dispatch (takes priority over bestKey) ────────────────────────

  // Recovery gates: no execution, recovery routine only
  if (decisionClass === 'recovery-first' || decisionClass === 'hold-and-review') {
    return {
      week1: { task: '수면·업무 강도·회복 루틴 점검 — 지금 당장 줄일 수 있는 에너지 소모 1가지 찾기', metric: '회복 루틴 3일 이상 실행' },
      week2: { task: '업무 부담 요인 3가지 정리 + 위임·조정 가능한 항목 파악', metric: '조정 가능한 업무 1개 발견 및 실행 요청' },
      week3: { task: '저강도 탐색만 허용 — 관심 포지션 리스트업 or 커피챗 1회 (지원 금지)', metric: '커피챗 1회 or 관심 포지션 5개 저장' },
      week4: { task: '컨디션 회복 상태 재평가 — 피로도 50 이하면 이직 탐색 전환, 아니면 루틴 강화 반복', metric: '피로도 자가 평가 + 다음 단계 결정' },
    };
  }

  // Dual-track: side-project validation + job search as safety bridge
  if (decisionClass === 'side-project-validation') {
    return {
      week1: { task: '[트랙 A] 이력서·링크드인 업데이트 / [트랙 B] 서비스·제품 가설 1개 정의', metric: '이력서 완성 + 가설 문서 1장' },
      week2: { task: '[트랙 A] 관심 기업 10개 탐색 + 커피챗 1회 / [트랙 B] 잠재 고객 10명 인터뷰 시작', metric: '기업 리스트 확정 + 인터뷰 5명 이상' },
      week3: { task: '[트랙 A] 이력서 2~3곳 제출 — 시장 반응 확인 / [트랙 B] 유료 의향 고객 3명 이상 확인', metric: '이직 반응 신호 1개 이상 or 유료 의향 3명' },
      week4: { task: '4주 결과 비교 — 좋은 오퍼 도착 → 이직 집중 / 유료 고객 확보 → 사이드 프로젝트 확대', metric: '두 트랙 중 1개에서 명확한 신호 확인 + 다음 전략 결정' },
    };
  }

  // Dual-track: accelerate-challenge with job change as primary + startup as parallel option
  if (decisionClass === 'accelerate-challenge' && bestKey !== 'startupFreelance') {
    return {
      week1: { task: '[주전략] 이력서·링크드인 업데이트 + 관심 기업 20개 리스트업 / [병행] 창업·프리 아이디어 1개 정의', metric: '이력서 완성 + 기업 리스트 + 아이디어 문서 1장' },
      week2: { task: '[주전략] 5개 이상 지원 or 커피챗 2회 / [병행] 잠재 고객 5명 인터뷰', metric: '지원 5건 이상 + 인터뷰 3명 이상 완료' },
      week3: { task: '[주전략] 면접 반응률 분석 / [병행] 유료 의향 고객 확인 실험', metric: '이직 반응 데이터 + 고객 신호 수집' },
      week4: { task: '두 트랙 비교 — 이직 오퍼 우세 → 이직 집중 / 유료 고객 확보 → 창업 전환 검토', metric: '다음 4주 집중 경로 결정 완료' },
    };
  }

  // move-while-working: 이직 탐색을 연봉협상 레버리지로 활용하는 2트랙
  if (decisionClass === 'move-while-working') {
    return {
      week1: {
        task: '시장가 파악 — 크레딧잡·블라인드에서 동일 직군·연차 연봉 중간값 확인 (협상 근거 만들기)',
        metric: '내 연봉이 시장 대비 몇 % 낮은지 숫자로 파악 완료',
      },
      week2: {
        task: '이직 탐색 시작 (협상 레버리지 확보) — 관심 기업 10곳 리스트업 + 이력서 1개 제출',
        metric: '서류 지원 3곳 이상 or 커피챗 1회 완료',
      },
      week3: {
        task: '내부 협상 or 외부 반응 확인 — 면접 반응 있으면 현 회사 연봉협상 검토, 없으면 포지셔닝 수정 후 재지원',
        metric: '시장 반응 신호 1개 수집 or 협상 대화 시작',
      },
      week4: {
        task: '결과 기반 결정 — 오퍼 있으면 현 회사 협상 or 이직 결정, 없으면 역량 갭 파악 후 전략 수정',
        metric: '다음 3개월 방향 확정',
      },
    };
  }

  // Job crafting is context-sensitive; use form inputs when available.
  if (bestKey === 'stay' && form) return selectJobCraftingPlan(form);

  const plans: Record<OptionKey, ActionPlanDetailed> = {
    stay: {
      week1: { task: '불만 요인 3가지 정리 + 직무 재설계 가능성 탐색 (업무 범위·역할 조정)', metric: '개선 요청 문서 1장 + 직무 조정 아이디어 3개' },
      week2: { task: '역할 협상 또는 사내 이동·프로젝트 변경 가능성 상사와 논의 (Job Crafting)', metric: '피드백 1회 이상 확보' },
      week3: { task: '근무 방식 조정·업무 의미 재구성 등 직무 재설계 옵션 1가지 실행', metric: '실행 중인 변화 1개 이상 확인' },
      week4: { task: '개선 신호 없으면 이직 탐색 전환 결정 (내부 조건 개선 기한: 4~8주)', metric: '유지+재설계 or 이직 전환 결정 완료' },
    },
    jobChange: {
      week1: { task: '이력서·링크드인 업데이트 + 약한 연결(weak-tie) 네트워크 1명 연락', metric: '이력서 완성 + 현업자 1명 커피챗 예약' },
      week2: { task: '관심 기업 20개 리스트업 + 소규모 지원 실험 시작 (결정이 아닌 기회 생성)', metric: '5개 이상 지원 또는 커피챗 2회 완료' },
      week3: { task: '시장 반응 확인 실험 — 면접 초대 또는 커피챗 피드백 수집', metric: '시장 반응 신호 1회 이상 수집' },
      week4: { task: '반응률 기준 퇴사 여부 결정 (면접 반응률 20% 이상이면 지속)', metric: '데이터 기반 전략 조정 완료' },
    },
    careerSwitch: {
      week1: { task: '전환 직무 2~3개 후보 선정 (결정이 아닌 탐색 실험으로 접근)', metric: '후보 직무 목록 확정' },
      week2: { task: '현업자 커피챗 실험 — 1명의 대화가 10시간의 유튜브보다 가치 있음', metric: '현업자 2명 이상 연락 완료' },
      week3: { task: '소규모 프로젝트 또는 자원 활동으로 시장 반응 테스트 (기회 생성 실험)', metric: '시장 반응 신호 1개 이상 수집' },
      week4: { task: '3개월 전환 로드맵 작성 — 기회 창출 중심 행동 계획', metric: '첫 학습 과정 또는 사이드 프로젝트 시작' },
    },
    restAfterQuit: {
      week1: { task: '월 지출 상한선 설정',            metric: '현재 대비 20% 절감 계획 완성' },
      week2: { task: '생활비 6개월치 확보 여부 확인',   metric: '가용 자금 파악 완료' },
      week3: { task: '회복 루틴과 재취업 시작일 설정', metric: '복귀 날짜 확정' },
      week4: { task: '퇴사 준비 및 네트워크 정리',     metric: '인수인계 문서 완성' },
    },
    startupFreelance: {
      week1: { task: '서비스/제품 가설 1개 정의',     metric: '가설 문서 1장 완성' },
      week2: { task: '잠재 고객 20명 리스트업',       metric: '5명 이상 인터뷰 완료' },
      week3: { task: '유료 의향 고객 확인',          metric: '유료 의향 3명 이상 확인' },
      week4: { task: '매출 가능성으로 퇴사 여부 결정', metric: '첫 유료 계약 or 보류 결정' },
    },
    studyReskill: {
      week1: { task: '목표 직무와 필요 역량 정의',      metric: '필요 역량 목록 10개 이상' },
      week2: { task: '학습 과정/부트캠프 3개 이상 비교', metric: '비교 문서 완성' },
      week3: { task: '비용/기간/기대 연봉 ROI 계산',   metric: 'ROI 검증 완료' },
      week4: { task: '재정 계획 확정 후 학습 시작',    metric: '첫 강의 또는 과제 완료' },
    },
  };
  return plans[bestKey];
}

// ─── Saju timing layer ────────────────────────────────────────────────────────

const HEAVENLY_STEMS_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const EARTHLY_BRANCHES_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// 삼합 trine groups: each trio shares compatible energy
const TRINE_GROUPS_IDX = [[2, 6, 10], [5, 9, 1], [8, 0, 4], [11, 3, 7]];

function getBranchIdx(year: number): number { return ((year - 1900) % 12 + 12) % 12; }
function getStemIdx(year: number): number    { return ((year - 1900) % 10 + 10) % 10; }
function formatYearName(year: number): string {
  return `${HEAVENLY_STEMS_KR[getStemIdx(year)]}${EARTHLY_BRANCHES_KR[getBranchIdx(year)]}년`;
}

function getSajuRelation(birthIdx: number, yearIdx: number): SajuRelationType {
  if (birthIdx === yearIdx) return 'self';
  if ((birthIdx + 6) % 12 === yearIdx) return 'clash';
  for (const g of TRINE_GROUPS_IDX) {
    if (g.includes(birthIdx) && g.includes(yearIdx)) return 'harmony';
  }
  return 'neutral';
}

function sajuRelationLabel(rel: SajuRelationType): string {
  switch (rel) {
    case 'self':    return '본명년 (12년 전환점)';
    case 'clash':   return '충(충돌)의 해';
    case 'harmony': return '삼합 조화';
    case 'neutral': return '중립';
  }
}

function sajuYearSignal(rel: SajuRelationType, yearLabel: string, isCurrent: boolean): string {
  const w = isCurrent ? '올해' : '내년';
  switch (rel) {
    case 'self':    return `${w} ${yearLabel}는 12년 주기의 전환점입니다. 새 사이클의 시작으로, 방향 전환과 실행에 에너지가 맞아 있습니다.`;
    case 'clash':   return `${w} ${yearLabel}는 충(충돌)의 해로 변화 압력이 강합니다. 주도적으로 움직이면 이 에너지를 전환의 동력으로 활용할 수 있습니다.`;
    case 'harmony': return `${w} ${yearLabel}는 삼합 흐름으로 확장 에너지가 안정적입니다. 새 환경 진입이나 성장 투자에 유리한 시기입니다.`;
    case 'neutral': return `${w} ${yearLabel}는 특별한 흐름 신호 없이 중립적입니다. 준비도가 타이밍보다 더 중요한 시기입니다.`;
  }
}

export function calculateSajuTimingLayer(
  form: FormData, bestKey: OptionKey, _derived: DerivedVariables,
): SajuTimingLayer {
  const birthYearNum = parseInt(form.timing.birthYear, 10);
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const currentYearLabel = formatYearName(currentYear);
  const nextYearLabel    = formatYearName(nextYear);

  const empty: SajuTimingLayer = {
    available: false,
    currentYearName: `${currentYearLabel} (${currentYear})`,
    nextYearName:    `${nextYearLabel} (${nextYear})`,
    currentRelation: 'neutral',  nextRelation: 'neutral',
    currentRelationLabel: '',    nextRelationLabel: '',
    currentSignal: '',           nextSignal: '',
    timingConclusion: '',
    combinedRecommendation: '',
    urgency: 'wait',
  };

  if (!form.timing.birthYear || isNaN(birthYearNum) || birthYearNum < 1930 || birthYearNum > 2010)
    return empty;

  const birthBranchIdx = getBranchIdx(birthYearNum);
  const currentRel = getSajuRelation(birthBranchIdx, getBranchIdx(currentYear));
  const nextRel    = getSajuRelation(birthBranchIdx, getBranchIdx(nextYear));

  const isFav = (r: SajuRelationType) => r === 'self' || r === 'clash' || r === 'harmony';

  const actionLabels: Record<OptionKey, string> = {
    jobChange:        '이직 탐색',
    stay:             '내부 조건 개선',
    careerSwitch:     '직무 전환 준비',
    restAfterQuit:    '구조화된 회복',
    startupFreelance: '창업/독립 준비',
    studyReskill:     '역량 강화',
  };
  const action = actionLabels[bestKey];
  const curLbl = sajuRelationLabel(currentRel);
  const nxtLbl = sajuRelationLabel(nextRel);

  let urgency: SajuUrgency;
  let timingConclusion: string;
  let combinedRecommendation: string;

  if (isFav(currentRel)) {
    urgency = 'now';
    timingConclusion = `올해가 이동 에너지와 맞는 시기로 분석됩니다.`;
    combinedRecommendation = isFav(nextRel)
      ? `데이터 기준으로 ${action}이 가장 합리적입니다. 올해 시작해 내년 상반기까지 결과를 내는 전략이 유리합니다.`
      : `데이터 기준으로 ${action}이 가장 합리적입니다. 올해 안에 실행을 시작하는 방향이 유리합니다.`;
  } else if (isFav(nextRel)) {
    urgency = 'soon';
    timingConclusion = `올해보다 내년이 더 유리한 시기로 분석됩니다.`;
    combinedRecommendation = `데이터 기준으로 ${action}이 가장 합리적입니다. 올해는 준비를 탄탄히 하고 내년 상반기를 실행 목표로 설정하는 전략이 유리합니다.`;
  } else {
    urgency = 'wait';
    timingConclusion = '올해와 내년 모두 강한 타이밍 신호는 없습니다. 준비도가 갖춰지는 시점이 최선의 타이밍입니다.';
    combinedRecommendation = `데이터 기준으로 ${action}이 가장 합리적입니다. 이직 경쟁력·재무 여건 등 실질 준비도가 갖춰지는 시점이 최선의 타이밍입니다.`;
  }

  return {
    available: true,
    currentYearName: `${currentYearLabel} (${currentYear})`,
    nextYearName:    `${nextYearLabel} (${nextYear})`,
    currentRelation: currentRel,  nextRelation: nextRel,
    currentRelationLabel: curLbl, nextRelationLabel: nxtLbl,
    currentSignal: sajuYearSignal(currentRel, currentYearLabel, true),
    nextSignal:    sajuYearSignal(nextRel,    nextYearLabel,    false),
    timingConclusion,
    combinedRecommendation,
    urgency,
  };
}

// ─── Personality story — strategy-driven ─────────────────────────────────────
// Derived ONLY from primaryStrategy gate (decisionClass), executionMode, and
// stateTimingLevel. Never from raw trait scores or flowType directly.

interface BasePersona {
  archetypeLabel: string;
  oneLinePersonality: string;
  baseBullets: [string, string, string];
  baseDecisionStyle: string;
}

const STRATEGY_PERSONA: Record<CareerDecisionClass, BasePersona> = {
  'recovery-first': {
    archetypeLabel:    '잠시 충전이 필요한 사람',
    oneLinePersonality: '지금 에너지가 소진된 상태입니다. 회복이 전략이고, 방향은 그 다음입니다.',
    baseBullets: [
      '현재 피로도가 높아 어떤 결정을 내려도 실행력이 떨어질 수 있는 상태입니다.',
      '에너지가 회복되면 판단력과 실행력이 빠르게 돌아오는 타입입니다. 무리한 전진보다 회복이 더 전략적입니다.',
      '충분히 쉬고 난 후 내린 결정이 더 오래 지속됩니다.',
    ],
    baseDecisionStyle: '지금은 선택보다 회복이 우선입니다. 컨디션이 회복된 후 다시 상황을 평가하면 훨씬 명확한 방향이 보입니다.',
  },
  'hold-and-review': {
    archetypeLabel:    '상황 점검형',
    oneLinePersonality: '지금 당장 큰 결정을 내리기 어려운 조건입니다. 상황 점검과 기반 안정화가 먼저입니다.',
    baseBullets: [
      '재무 여건 또는 에너지 상태가 즉각적 실행보다 정보 수집을 먼저 하도록 요구합니다.',
      '기반이 안정될 때 내리는 결정이 더 좋은 결과로 이어집니다.',
      '지금은 모든 것을 결정하려 하지 말고, 다음 단계를 위한 정보를 모으는 것이 우선입니다.',
    ],
    baseDecisionStyle: '결정보다 정보 수집과 기반 안정화가 먼저입니다. 기반이 흔들릴 때 내린 결정은 좋은 결정이 되기 어렵습니다.',
  },
  'accelerate-challenge': {
    archetypeLabel:    '도전 가속형',
    oneLinePersonality: '역량·에너지·재무 여건이 동시에 갖춰진 드문 조합입니다. 지금이 실행할 때입니다.',
    baseBullets: [
      '새로운 기회를 탐색하려는 에너지가 높고, 행동에 옮기는 데 주저함이 적습니다.',
      '역량과 여건이 갖춰진 상태에서 실행을 미루면 "그때 했어야 했는데"가 됩니다.',
      '빠른 실행 앞에서 가설 검증을 건너뛰지 않는 것이 핵심입니다.',
    ],
    baseDecisionStyle: '지금은 탐색보다 실행의 타이밍입니다. 속도와 검증 사이의 균형을 잡는 것이 핵심입니다.',
  },
  'side-project-validation': {
    archetypeLabel:    '사이드 검증형',
    oneLinePersonality: '변화를 원하지만 무작정 뛰어들기보다 시장에서 먼저 검증하고 움직이는 타입입니다.',
    baseBullets: [
      '탐색 에너지와 현실 감각이 함께 있어, 무모하지 않게 도전할 수 있습니다.',
      '재직 중 검증으로 리스크를 최소화하면서 가능성을 확인하는 전략이 맞습니다.',
      '유료 고객 1명 확보가 사이드 프로젝트의 첫 번째 판단 기준입니다.',
    ],
    baseDecisionStyle: '작은 실험으로 가능성을 확인한 후 실행하는 접근이 지금 상황에 가장 잘 맞습니다.',
  },
  'move-while-working': {
    archetypeLabel:    '재직 중 이동형',
    oneLinePersonality: '이직 경쟁력과 변화 의지가 갖춰진 상태입니다. 지금 환경이 맞지 않는다는 신호를 이미 느끼고 있습니다.',
    baseBullets: [
      '재직 중 탐색으로 소득을 유지하면서 리스크 없이 시장 반응을 테스트할 수 있습니다.',
      '충동적 퇴사보다 시장 반응을 데이터로 확인한 후 결정하는 스타일이 잘 맞습니다.',
      '"탈출"이 아닌 "성장"이 이동의 목적이 되어야 새 환경에서도 만족도가 높아집니다.',
    ],
    baseDecisionStyle: '충동적 퇴사보다 시장 반응을 먼저 데이터로 확인하고, 반응률 기준으로 퇴사 여부를 결정하는 방식이 가장 잘 맞습니다.',
  },
  'stable-maintain': {
    archetypeLabel:    '안정 재설계형',
    oneLinePersonality: '지금 환경이 나쁘지 않습니다. 급격한 전환보다 내부 최적화가 더 빠를 수 있습니다.',
    baseBullets: [
      '역할 협상, 프로젝트 조정, 근무 방식 변경으로 더 빠르게 원하는 조건을 만들 수 있습니다.',
      '안정된 기반 위에서 조건을 개선하는 방식이 자연스럽게 맞는 타입입니다.',
      '변화 없이 유지하다 보면 성장 정체가 서서히 동기를 갉아먹습니다. 4~8주 기한을 설정하세요.',
    ],
    baseDecisionStyle: '안정된 기반 위에서 조건을 개선하는 방식이 가장 강점을 발휘합니다. 협상과 역할 조정이 주요 도구입니다.',
  },
  'prepare-then-switch': {
    archetypeLabel:    '준비 후 전환형',
    oneLinePersonality: '변화를 원하지만 지금 당장 움직이기에는 준비가 더 필요한 단계입니다.',
    baseBullets: [
      '역량이 높아지면 자연스럽게 자신감이 생기고 행동하게 되는 패턴을 가지고 있습니다.',
      '충분히 준비된 후 움직이는 타입입니다. 지금은 실행보다 역량 투자가 다음 단계를 여는 시기입니다.',
      '"완벽히 준비될 때까지"는 없습니다. 준비됐다는 기준을 작게 잡으세요.',
    ],
    baseDecisionStyle: '충분히 준비된 후 움직이는 타입입니다. 지금 준비에 투자하면 다음 선택의 폭이 넓어집니다.',
  },
};

// stateTimingLevel → extra bullet to append
function stateTimingBullet(level: StateTimingLevel): string {
  switch (level) {
    case '회복 우선':   return '지금 상태에서의 큰 결정은 피하고, 에너지 회복을 최우선 순위에 두세요.';
    case '저강도 탐색': return '확신 없이 실행하기보다 탐색하며 방향을 잡는 접근이 더 효과적입니다.';
    case '실행 가능':   return '지금은 탐색보다 실행으로 결과를 만들어야 할 타이밍입니다.';
  }
}

// executionMode → appended to decisionStyleSummary
function executionModeSuffix(mode: ExecutionMode): string {
  switch (mode) {
    case '즉시 실행':    return ' 지금 바로 시작해도 됩니다.';
    case '재직 중 검증': return ' 재직 상태를 유지하면서 탐색하는 것이 핵심입니다.';
    case '준비 후 전환': return ' 준비를 마친 후 전환 시점을 판단하세요.';
    case '회복 후 실행': return ' 회복 후 다시 평가하면 방향이 명확해집니다.';
    case '보류·점검':    return ' 기반이 안정된 후 재평가하는 것이 최선입니다.';
  }
}

export function generatePersonalityStory(
  decisionClass: CareerDecisionClass,
  executionMode: ExecutionMode,
  stateTimingLevel: StateTimingLevel,
  saju: SajuTraitEstimate | null,
): PersonalityStory {
  const base = STRATEGY_PERSONA[decisionClass];
  const bullets: string[] = [...base.baseBullets, stateTimingBullet(stateTimingLevel)];
  const decisionStyleSummary = base.baseDecisionStyle + executionModeSuffix(executionMode);

  let sajuNote: string | null = null;
  if (saju && saju.confidence === 'estimated') {
    const { dominantElement, explorationTendency, stabilityNeed, entrepreneurialDrive } = saju;
    const tendency =
      explorationTendency >= 60 ? '새로운 가능성을 탐색하는 에너지가 강하게 나타날 수 있습니다' :
      stabilityNeed >= 60      ? '안정을 중시하고 기반을 다지는 기질이 나타날 수 있습니다' :
      entrepreneurialDrive >= 60 ? '독립적으로 방향을 개척하는 기질이 나타날 수 있습니다' :
      '다양한 기질이 균형 있게 나타나는 경향이 있습니다';
    sajuNote = `사주 기반 성향 참고로는 ${dominantElement} 기운이 강해, ${tendency}. 현재 입력값과 함께 보면 이런 경향이 더 두드러질 수 있습니다.`;
  }

  const dataSource = saju
    ? '현재 입력값과 사주 기반 성향을 함께 보면'
    : '현재 입력값 기준으로 보면';

  return {
    archetypeLabel:    base.archetypeLabel,
    oneLinePersonality: base.oneLinePersonality,
    bullets,
    decisionStyleSummary,
    sajuNote,
    dataSource,
  };
}

// ─── Combined recommendation ─────────────────────────────────────────────────

function generateCombinedRecommendation(
  sorted: OptionScore[], derived: DerivedVariables, decisionClass: string,
): string {
  if (sorted.length === 0) return '';
  const top = sorted[0];
  const second = sorted[1];
  const { financialSafetyBase } = derived;

  // Gate-class overrides — archetype takes priority over raw rank
  if (decisionClass === 'side-project-validation')
    return '재직 중 사이드 프로젝트 검증 + 이직 탐색 병행';
  if (decisionClass === 'accelerate-challenge') {
    if (top.key === 'startupFreelance') return '창업/프리랜서 실행 검토 — 퇴사 전 고객 검증';
    return '적극적 전환 실행 — 이직 또는 창업 도전 가능';
  }
  if (decisionClass === 'stable-maintain')
    return '현 직장 재설계 + 역할 협상 우선';
  if (decisionClass === 'recovery-first' && financialSafetyBase < 40)
    return '재직 중 회복 + 비용 구조 점검';
  if (decisionClass === 'recovery-first' && top.key === 'restAfterQuit')
    return '구조화된 회복 후 재탐색 (번아웃 심각 + 런웨이 충분)';
  if (decisionClass === 'recovery-first')
    return '재직 중 회복 — 업무 강도 조절 우선';

  // Score-based combinations (when gate class is move-while-working / prepare-then-switch / hold-and-review)
  if (top.key === 'jobChange' && second?.key === 'startupFreelance' && second.readinessStatus !== 'notRecommended')
    return '재직 중 이직 탐색 + 사이드 프로젝트 검증';
  if (top.key === 'jobChange' && second?.key === 'studyReskill' && second.traitFitScore >= 10)
    return '역량 강화 병행 + 재직 중 이직 탐색';
  if (top.key === 'stay' && second?.key === 'jobChange')
    return '현 직장 재설계 + 4주 시장 반응 확인';
  if (top.key === 'restAfterQuit' && financialSafetyBase < 40)
    return '단기 회복 + 비용 구조 점검';
  if (top.key === 'restAfterQuit')
    return '구조화된 회복 후 재탐색';
  if (top.key === 'studyReskill' && second?.key === 'jobChange')
    return '역량 강화 후 이직 전환';
  if (top.key === 'careerSwitch' && second?.key === 'studyReskill')
    return '준비 후 직무 전환';
  if (top.key === 'startupFreelance' && top.readinessStatus === 'prepareFirst')
    return '재직 중 사이드 프로젝트 검증 후 전환';
  if (top.key === 'startupFreelance' && top.readinessStatus === 'now')
    return '창업/프리랜서 실행 가능 — 퇴사 전 고객 검증';
  return NUANCED_TITLES[top.key];
}

// 게이트 임계값 근방(±5)일 때 사용자가 경계 케이스임을 안내.
// 1점 차이로 archetype이 뒤집히는 부분의 사용자 신뢰도를 높이기 위함.
function detectBoundaryNote(decisionClass: string, derived: DerivedVariables): string {
  const { readinessBehavior: rb, marketReadiness, burnoutPressure: bp,
    explorationDrive: ed, stabilityPreference: sp, jobDissatisfaction: jd } = derived;
  const mr = (marketReadiness - 1) / 4 * 100;
  const near = (v: number, t: number) => Math.abs(v - t) <= 5;

  // move-while-working ↔ prepare-then-switch 경계 (rb 45 / 50, mr 45)
  if (decisionClass === 'move-while-working' && (near(rb, 45) || near(mr, 45))) {
    return '행동 준비도와 이직 경쟁력이 경계값 근처입니다. 점수가 조금만 낮아져도 "준비 후 전환" 전략이 더 적합해질 수 있습니다.';
  }
  if (decisionClass === 'prepare-then-switch' && (near(rb, 50) || near(mr, 45))) {
    return '준비도가 경계값 근처입니다. 경쟁력이 50/100을 넘으면 재직 중 이동형으로 전환할 수 있습니다.';
  }
  // recovery-first ↔ expansion 경계 (bp 60)
  if (decisionClass === 'recovery-first' && near(bp, 60)) {
    return '피로도가 회복 경계에 걸쳐 있습니다. 충분히 낮아지면 탐색 전략으로 전환할 수 있습니다.';
  }
  // stable-maintain ↔ prepare-then-switch 경계 (sp 65, jd 3)
  if (decisionClass === 'stable-maintain' && (near(sp, 65) || near(jd * 20, 60))) {
    return '안정 선호도와 불만족 수준이 경계 근처입니다. 불만족이 커지면 탐색 우선 전략으로 옮겨질 수 있습니다.';
  }
  // side-project-validation 경계 (ed 60)
  if (decisionClass === 'side-project-validation' && near(ed, 60)) {
    return '창업 드라이브가 경계 근처입니다. 더 명확해지면 본격 전환을 검토할 수 있습니다.';
  }
  return '';
}

function generateBridgeMessage(
  decisionClass: string,
  bestKey: OptionKey,
  sorted: OptionScore[],
  derived?: DerivedVariables,
): string {
  // No bridge when archetype and top option are naturally aligned
  const aligned: Partial<Record<string, OptionKey[]>> = {
    'move-while-working':      ['jobChange'],
    'stable-maintain':         ['stay'],
    'recovery-first':          ['restAfterQuit'],
    'prepare-then-switch':     ['studyReskill', 'careerSwitch'],
    'accelerate-challenge':    ['jobChange', 'startupFreelance'],
    'side-project-validation': ['startupFreelance'],
    'hold-and-review':         [],
  };

  const boundaryNote = derived ? detectBoundaryNote(decisionClass, derived) : '';

  if (aligned[decisionClass]?.includes(bestKey)) return boundaryNote;

  let core = '';
  if (decisionClass === 'side-project-validation' && bestKey === 'jobChange') {
    const startup = sorted.find(s => s.key === 'startupFreelance');
    const rank = startup ? sorted.indexOf(startup) + 1 : null;
    core = `점수상 가장 안전한 선택지는 이직 탐색이지만, 성향상 창업/프리랜서 적합도가 높아 사이드 프로젝트 검증을 함께 추천합니다.${rank ? ` (선택지 비교 ${rank}위 참고)` : ''}`;
  } else if (decisionClass === 'side-project-validation') {
    core = '창업·프리랜서 성향이 강합니다. 현재 여건상 즉시 퇴사보다 재직 중 검증 전략이 적합합니다.';
  } else if (decisionClass === 'prepare-then-switch' && bestKey === 'jobChange') {
    core = '준비도가 갖춰지기 전에 이직하면 기대 이하 조건으로 이동할 수 있습니다. 역량 강화 병행을 권장합니다.';
  }

  if (core && boundaryNote) return `${core} ${boundaryNote}`;
  return core || boundaryNote;
}

// ─── Decision strategy ────────────────────────────────────────────────────────

// Gate bonus applied to totalScore to ensure the archetype's primary option ranks appropriately.
// Negative values act as strict penalties that prevent aggressive options from ranking #1
// when a recovery or hold gate is active.
const GATE_BONUS: Record<CareerDecisionClass, Partial<Record<OptionKey, number>>> = {
  'stable-maintain':         { stay: 15 },
  'move-while-working':      { jobChange: 12 },
  'accelerate-challenge':    { startupFreelance: 25, jobChange: 5 },
  // recovery-first: boost stay (recover while working = default), also boost restAfterQuit
  // for severe burnout, hard-penalise aggressive options so they CANNOT rank #1.
  // resolveRecoveryPrimary() below decides which of stay/restAfterQuit becomes primary.
  'recovery-first':          { stay: 15, restAfterQuit: 10, startupFreelance: -35, careerSwitch: -12, jobChange: -8 },
  'prepare-then-switch':     { studyReskill: 15, careerSwitch: 8 },
  'side-project-validation': { startupFreelance: 20 },
  // hold-and-review (financial crisis): also penalise high-effort options
  'hold-and-review':         { startupFreelance: -25, careerSwitch: -8 },
};

// Two-tier burnout execution gate applied after GATE_BONUS.
// Tier 1 (bp >= 80): hard block — aggressive execution CANNOT be primary.
// Tier 2 (bp 65–79): moderate downgrade — allow low-intensity exploration with 저강도/회복병행 labels.
// Tier 3 (bp > 50): caution zone — soft warning only.
function applyRecoveryModeOverrides(scores: OptionScore[], burnoutPressure: number): OptionScore[] {
  const isHardBlock  = burnoutPressure >= 80;   // tier 1: hard block
  const isModerate   = burnoutPressure >= 65 && burnoutPressure < 80; // tier 2: downgrade
  const isCaution    = burnoutPressure > 50  && burnoutPressure < 65; // tier 3: warn

  return scores.map(s => {
    if (isHardBlock) {
      switch (s.key) {
        case 'startupFreelance':
          return {
            ...s,
            readinessStatus: 'notRecommended' as const,
            notes: [...s.notes, '피로도 80+: 즉각적 창업·독립 실행은 완전 차단됩니다. 회복이 최우선이며 창업 계획은 피로도 60 이하로 회복된 후 재검토하세요.'],
            recommendedAction: '회복 완료 후 재검토 — 지금은 창업 실행 금지',
          };
        case 'jobChange':
          return {
            ...s,
            readinessStatus: (s.readinessStatus === 'now' ? 'conditional' : s.readinessStatus) as typeof s.readinessStatus,
            notes: [...s.notes, '피로도 80+: 적극적 이직 탐색(지원·면접)은 에너지를 더 소모합니다. 이력서 정비·약한 연결 유지 수준의 소극적 탐색만 권장합니다.'],
          };
        case 'careerSwitch':
          return {
            ...s,
            readinessStatus: (s.readinessStatus === 'now' ? 'prepareFirst' : s.readinessStatus) as typeof s.readinessStatus,
            notes: [...s.notes, '피로도 80+: 전환 준비는 현업자 리서치·자료 수집 수준으로만 제한하세요. 퇴사 후 전환은 회복 후로 미루세요.'],
          };
        default:
          return s;
      }
    } else if (isModerate) {
      switch (s.key) {
        case 'startupFreelance':
          return {
            ...s,
            readinessStatus: (s.readinessStatus === 'now' ? 'conditional' : s.readinessStatus) as typeof s.readinessStatus,
            notes: [...s.notes, '저강도 탐색만 가능 — 회복을 병행하면서 아이디어 리서치·소규모 실험 수준으로 접근하세요. 즉각적 퇴사 후 창업은 비추천입니다.'],
            recommendedAction: '회복 병행 저강도 사이드 테스트 — 즉시 퇴사 금지',
          };
        case 'jobChange':
          return {
            ...s,
            notes: [...s.notes, '회복 병행 재직 중 탐색 — 이직 준비(이력서·네트워킹)를 회복 루틴과 함께 낮은 강도로 진행하세요.'],
          };
        case 'careerSwitch':
          return {
            ...s,
            notes: [...s.notes, '저강도 탐색 — 현업자 커피챗·리서치 수준으로 탐색하되 지금 당장 퇴사 후 전환은 보류하세요.'],
          };
        default:
          return s;
      }
    } else if (isCaution && s.key === 'startupFreelance') {
      return {
        ...s,
        notes: [...s.notes, '피로도 주의 수준 — 창업 실행 전 에너지 여유를 먼저 확인하세요. 재직 중 소규모 실험부터 시작하는 것이 안전합니다.'],
      };
    }
    return s;
  });
}

// Hard financial gate: when runwayMonths < 3, income-interrupting strategies are blocked.
// This is non-linear — small penalties are not enough; these options need explicit overrides.
function applyFinancialGateOverrides(scores: OptionScore[], runwayMonths: number): OptionScore[] {
  if (runwayMonths >= 3) return scores;

  return scores.map(s => {
    switch (s.key) {
      case 'restAfterQuit':
        return {
          ...s,
          readinessStatus: 'notRecommended' as const,
          notes: [...s.notes, `런웨이(${runwayMonths.toFixed(1)}개월) < 3개월 — 퇴사 후 장기 휴식은 재정 위기로 이어집니다. 재직을 유지하면서 회복 루틴만 도입하세요.`],
          recommendedAction: `퇴사 없이 재직 유지 — 런웨이 6개월 이상 확보 후 휴식 재검토`,
        };
      case 'startupFreelance':
        if (s.readinessStatus === 'notRecommended') return s;
        return {
          ...s,
          readinessStatus: 'conditional' as const,
          notes: [...s.notes, `런웨이(${runwayMonths.toFixed(1)}개월) < 3개월 — 즉시 창업·퇴사는 불가. 재직 중 소규모 사이드 테스트(아이디어 검증·소액 매출 테스트)만 허용됩니다.`],
          recommendedAction: '재직 중 사이드 프로젝트로만 검증 — 퇴사 후 창업은 런웨이 9개월 확보 후',
        };
      case 'studyReskill':
        if (s.readinessStatus === 'notRecommended') return s;
        return {
          ...s,
          readinessStatus: 'conditional' as const,
          notes: [...s.notes, `런웨이(${runwayMonths.toFixed(1)}개월) < 3개월 — 재직 중 병행 학습만 가능. 퇴사 후 전업 학습은 재정 위험이 있어 비추천입니다.`],
        };
      case 'careerSwitch':
        if (s.readinessStatus === 'notRecommended') return s;
        return {
          ...s,
          readinessStatus: 'conditional' as const,
          notes: [...s.notes, `런웨이(${runwayMonths.toFixed(1)}개월) < 3개월 — 재직 유지 중 소규모 탐색(리서치·커피챗)만 권장합니다.`],
        };
      default:
        return s;
    }
  });
}

// Maps gate class + top option → archetype-aligned primary strategy text.
// burnoutPressure enables differentiated copy for the two recovery tiers.
function getArchetypePrimaryStrategy(
  cls: CareerDecisionClass,
  topKey: OptionKey,
  burnoutPressure = 0,
): string {
  switch (cls) {
    case 'move-while-working':
      return '재직 중 이직 탐색';
    case 'side-project-validation':
      return '재직 중 사이드 프로젝트 검증 + 이직 가능성 확인';
    case 'accelerate-challenge':
      return topKey === 'startupFreelance'
        ? '창업/프리랜서 실행 검토'
        : '적극적 이직 탐색 + 창업/프리랜서 병행 가능';
    case 'prepare-then-switch':
      // Mobley-aware: explicitly name the missing stage (search readiness)
      return '이직 준비도 강화 후 재직 중 탐색';
    case 'recovery-first':
      if (burnoutPressure >= 80) return '회복 + 상태 안정화 우선 (고강도 실행 차단)';
      if (burnoutPressure >= 65) return '회복 병행 저강도 탐색';
      return '회복 + 업무 강도 조절';
    case 'stable-maintain':
      return '현 직장 유지 + 직무 재설계';
    case 'hold-and-review':
      return '추가 정보 수집 후 결정';
  }
}

// Gate-based primary/secondary option assignment
const GATE_PRIMARY: Record<string, OptionKey | null> = {
  'stable-maintain':         'stay',
  'move-while-working':      'jobChange',
  'accelerate-challenge':    null,          // score determines
  'recovery-first':          null,          // resolved dynamically by resolveRecoveryPrimary()
  'prepare-then-switch':     null,          // study or careerSwitch by score
  'side-project-validation': 'startupFreelance',
  'hold-and-review':         null,
};

/**
 * Burnout does NOT automatically mean quitting. Default is "recover while employed".
 * Only recommend restAfterQuit when burnout is severe (75+) AND runway is sufficient (6+ months).
 */
function resolveRecoveryPrimary(burnoutPressure: number, runwayMonths: number): OptionKey {
  return (burnoutPressure >= 75 && runwayMonths >= 6) ? 'restAfterQuit' : 'stay';
}

/** Returns the gate-assigned primary option key, including dynamic resolution for recovery-first. */
function resolveGatePrimaryKey(
  cls: CareerDecisionClass | string,
  burnoutPressure = 0,
  runwayMonths = 12,
): OptionKey | null {
  if (cls === 'recovery-first') return resolveRecoveryPrimary(burnoutPressure, runwayMonths);
  return GATE_PRIMARY[cls] ?? null;
}

const GATE_SECONDARY: Record<string, OptionKey | null> = {
  'stable-maintain':         'jobChange',
  'move-while-working':      null,
  'accelerate-challenge':    null,
  'recovery-first':          'restAfterQuit',  // secondary: quitting is an option when burnout is high
  'prepare-then-switch':     'jobChange',
  'side-project-validation': 'jobChange',
  'hold-and-review':         null,
};

const GATE_SECONDARY_STRATEGY: Record<string, string> = {
  'side-project-validation': '재직 중 이직 탐색 (안전망으로 병행)',
  'stable-maintain':         '4주 내 개선 없으면 이직 탐색 전환',
  'prepare-then-switch':     '역량 강화 후 이직/직무 전환',
};

function assignOptionRoles(
	sorted: OptionScore[], decisionClass: string,
	selectedOptions: OptionKey[] = [],
	primaryKeyOverride?: OptionKey | null,  // injected by calculateResults for dynamic gates
): RankedOption[] {
	const hasSelection = selectedOptions.length > 0;
	const selectedSorted = hasSelection
		? sorted.filter(s => selectedOptions.includes(s.key))
		: sorted;

	const isRecoveryOrHold = decisionClass === 'recovery-first' || decisionClass === 'hold-and-review';
	// Use override when provided (e.g. dynamic recovery-first resolution), else static table.
	const gatePrimary = primaryKeyOverride !== undefined
		? primaryKeyOverride
		: GATE_PRIMARY[decisionClass];
	const primaryKey = isRecoveryOrHold
		? (gatePrimary ?? sorted[0]?.key ?? null)
		: hasSelection
			? (selectedSorted[0]?.key ?? null)
			: (gatePrimary ?? sorted[0]?.key ?? null);
	const secondaryKey = isRecoveryOrHold
		? (GATE_SECONDARY[decisionClass] ?? sorted[1]?.key ?? null)
		: hasSelection
			? (selectedSorted[1]?.key ?? null)
			: (GATE_SECONDARY[decisionClass] ?? sorted[1]?.key ?? null);

	return sorted.map((s) => {
		const isUnselected = hasSelection && !selectedOptions.includes(s.key);
		return {
			key: s.key,
			label: s.label,
			role: (s.key === primaryKey   ? 'primary'
				 : s.key === secondaryKey  ? 'secondary'
				 : isUnselected            ? 'conditional'
				 : s.readinessStatus === 'notRecommended' ? 'notRecommended'
				 : 'conditional') as RankedOption['role'],
			readinessStatus: s.readinessStatus,
			totalScore: Math.round(s.totalScore),
		};
	});
}

// ─── State-based timing engine ────────────────────────────────────────────────

/**
 * Primary timing verdict derived purely from measurable state.
 * Uses burnoutPressure (0-100), runwayMonths, and explorationDrive (0-100).
 * This is the authoritative layer — saju refines, never overrides.
 */
export function getStateTiming(
  burnoutPressure: number,
  runwayMonths: number,
  explorationDrive: number,
): StateTimingLevel {
  // Hard blocks: severe fatigue or financial crisis
  if (burnoutPressure >= 75 || runwayMonths < 3) return '회복 우선';
  // Caution zone: moderate fatigue or low exploration energy
  if (burnoutPressure >= 55 || explorationDrive < 40) return '저강도 탐색';
  return '실행 가능';
}

const STATE_TIMING_TEXT: Record<StateTimingLevel, string> = {
  '회복 우선':   '지금은 방향보다 에너지 회복이 먼저입니다. 이 상태에서의 결정은 후회로 이어질 가능성이 높습니다.',
  '저강도 탐색': '지금은 방향을 바꿀 수 있는 시기지만, 확신 기반 실행보다 탐색 기반 판단이 더 적합합니다.',
  '실행 가능':   '지금은 준비와 에너지가 동시에 갖춰진 시기입니다. 탐색이 아닌 실행으로 결과를 만들어야 할 타이밍입니다.',
};

/**
 * Merge state timing with optional secondary signal.
 * State timing is always primary and the sole output until real manse is connected.
 */
export function mergeTiming(
  stateLevel: StateTimingLevel,
  _sajuSignal: string | null,
): string {
  return STATE_TIMING_TEXT[stateLevel];
}

function buildTimingAdvice(
  timingAnalysis: TimingAnalysis,
  sajuTimingLayer: SajuTimingLayer,
  _sajuTraitEstimate: SajuTraitEstimate | null,
  decisionClass: CareerDecisionClass,
  derived: DerivedVariables,
): TimingAdvice {
  const stateTimingLevel = getStateTiming(
    derived.burnoutPressure,
    derived.runwayMonths,
    derived.explorationDrive,
  );

  // Recovery/hold gates hard-set the level to 회복 우선 regardless of exploration drive.
  const effectiveLevel: StateTimingLevel =
    (decisionClass === 'recovery-first' || decisionClass === 'hold-and-review')
      ? '회복 우선'
      : stateTimingLevel;

  const sajuSignal = sajuTimingLayer.available ? sajuTimingLayer.currentSignal : null;
  const stateText = STATE_TIMING_TEXT[effectiveLevel];
  const combinedInterpretation = mergeTiming(effectiveLevel, sajuSignal);

  return {
    stateText,
    stateTimingLevel: effectiveLevel,
    combinedInterpretation,
    signals:   timingAnalysis.signals,
    sajuConnected: false,
    sajuDisclaimer: '현재는 입력값 기반의 상태 타이밍만 표시됩니다. 장기 흐름 분석이 연결되면 연간 타이밍 참고 지표도 확인할 수 있습니다.',
    yearPillarAvailable: sajuTimingLayer.available,
    yearPillarData: sajuTimingLayer.available ? {
      currentYearName:      sajuTimingLayer.currentYearName,
      currentRelationLabel: sajuTimingLayer.currentRelationLabel,
      currentSignal:        sajuTimingLayer.currentSignal,
      nextYearName:         sajuTimingLayer.nextYearName,
      nextRelationLabel:    sajuTimingLayer.nextRelationLabel,
      nextSignal:           sajuTimingLayer.nextSignal,
    } : null,
    traitNote: null,
  };
}

function buildDecisionStrategy(
  sorted: OptionScore[],
  decisionClass: CareerDecisionClass,
  archetypeLabel: string,
  bridgeMessage: string,
  timingAnalysis: TimingAnalysis,
  sajuTimingLayer: SajuTimingLayer,
  sajuTraitEstimate: SajuTraitEstimate | null,
  confidence: ConfidenceLevel,
  confidenceExplanation: string,
  burnoutPressure = 0,
  derived?: DerivedVariables,
  selectedOptions: OptionKey[] = [],
  primaryKeyOverride?: OptionKey | null,   // dynamic resolution (e.g. recovery-first)
): DecisionStrategy {
  const primaryOptionKey = sorted[0]?.key ?? 'stay';
  const primaryStrategy = getArchetypePrimaryStrategy(decisionClass, primaryOptionKey, burnoutPressure);
  // Provide a fallback derived object if not passed (for audit scenarios)
  const safeDerived: DerivedVariables = derived ?? {
    runwayMonths: 12, burnoutRisk: 0, jobDissatisfaction: 2,
    marketReadiness: 3, marketReadinessPercent: 50,
    financialSafetyBase: 60, readinessBehavior: 50, explorationDrive: 50,
    stabilityPreference: 50, burnoutPressure, careerAdaptability: 50,
  };
  return {
    archetype:            archetypeLabel,
    archetypeInsight:     getArchetypeInsight(archetypeLabel),
    primaryStrategy,
    primaryOptionKey,
    secondaryStrategy:    GATE_SECONDARY_STRATEGY[decisionClass] ?? '',
    bridgeMessage,
    rankedOptions:        assignOptionRoles(sorted, decisionClass, selectedOptions, primaryKeyOverride),
    timingAdvice:         buildTimingAdvice(timingAnalysis, sajuTimingLayer, sajuTraitEstimate, decisionClass, safeDerived),
    confidence,
    confidenceExplanation,
  };
}

// Dev audit utility — call from browser console: runDecisionAudit()
// Tests scenarios A–G to verify archetype ↔ primaryStrategy consistency.
export function runDecisionStrategyAudit(): void {
  const bp: FormData['basicProfile'] = {
    age: 30, yearsOfExperience: 5, currentRole: '개발자', industry: 'IT',
    annualSalary: 60_000_000, monthlyExpense: 3_000_000, savings: 9_000_000,
  };
  const bc: FormData['careerStatus'] = {
    jobSatisfaction: 3, growthPotential: 3, salarySatisfaction: 3,
    workLifeBalance: 3, organizationStress: 3, burnout: 3, jobSearchConfidence: 3,
  };
  const bt: FormData['traits'] = {
    changeOrientation: 3, planning: 3, curiosity: 3, riskTolerance: 3,
    recoveryNeed: 3, selfEfficacy: 3, networking: 3, meaningOrientation: 3,
    outcomeExpectation: 3, portfolioEvidence: 3,
  };
  const bf: FormData['flow'] = { desireForChange: 3, desireForStability: 3, needForRest: 3 };
  const bm: FormData['timing'] = { birthYear: '', birthMonth: '', birthDay: '', birthTime: '', calendarType: 'solar' };
  const make = (o: Partial<FormData>): FormData => ({
    basicProfile: bp, careerStatus: bc, selectedOptions: [],
    traits: bt, flow: bf, timing: bm, ...o,
  });

  type Scenario = { name: string; form: FormData; expectArchetype: string; expectPrimaryContains: string };
  const scenarios: Scenario[] = [
    // ── Compatibility tests (original A–G) ────────────────────────────────────
    {
      name: 'orig-A. startup high + 5mo runway → side-project, not full startup',
      form: make({
        basicProfile: { ...bp, savings: 15_000_000 },  // 5 months
        traits: { ...bt, riskTolerance: 5, curiosity: 5, changeOrientation: 5, selfEfficacy: 4 },
      }),
      expectArchetype: '사이드 프로젝트 검증형',
      expectPrimaryContains: '사이드 프로젝트',
    },
    {
      name: 'orig-B. startup high + 15mo runway + all traits max → accelerate/startup',
      form: make({
        basicProfile: { ...bp, savings: 45_000_000 },  // 15 months
        traits: { ...bt, riskTolerance: 5, curiosity: 5, changeOrientation: 5, selfEfficacy: 5, networking: 5, outcomeExpectation: 5, portfolioEvidence: 5 },
        careerStatus: { ...bc, jobSatisfaction: 2, growthPotential: 2 },
      }),
      expectArchetype: '도전 가속형',
      expectPrimaryContains: '창업',
    },
    {
      name: 'orig-C. learning high + mobility low → prepare-then-switch',
      form: make({
        traits: { ...bt, curiosity: 5, changeOrientation: 5, selfEfficacy: 2, networking: 2, outcomeExpectation: 2, portfolioEvidence: 2 },
        careerStatus: { ...bc, jobSatisfaction: 2 },
      }),
      expectArchetype: '준비 후 전환형',
      expectPrimaryContains: '이직 준비도',
    },
    {
      name: 'orig-D. burnout max → recovery-first',
      form: make({
        careerStatus: { ...bc, burnout: 5, organizationStress: 5, workLifeBalance: 1 },
        traits: { ...bt, recoveryNeed: 5 },
        basicProfile: { ...bp, savings: 18_000_000 },
      }),
      expectArchetype: '회복 우선형',
      expectPrimaryContains: '회복',
    },
    {
      name: 'orig-E. satisfaction high + change low → stable-maintain',
      form: make({
        careerStatus: { ...bc, jobSatisfaction: 5, growthPotential: 4, salarySatisfaction: 4 },
        traits: { ...bt, changeOrientation: 1, riskTolerance: 1, planning: 5 },
        flow: { ...bf, desireForChange: 1 },
      }),
      expectArchetype: '현 직장 재설계형',
      expectPrimaryContains: '현 직장',
    },
    {
      name: 'orig-F. mobility + change high + fatigue low → move-while-working',
      form: make({
        basicProfile: { ...bp, savings: 18_000_000 },
        traits: { ...bt, selfEfficacy: 4, networking: 4, changeOrientation: 4, curiosity: 4, outcomeExpectation: 4, portfolioEvidence: 3 },
        careerStatus: { ...bc, jobSatisfaction: 2, growthPotential: 2, burnout: 2 },
      }),
      expectArchetype: '재직 중 이동형',
      expectPrimaryContains: '이직',
    },
    {
      name: 'orig-G. all mediocre + 2mo runway → hold-and-review',
      form: make({
        basicProfile: { ...bp, savings: 6_000_000 },
        traits: { ...bt, curiosity: 2, changeOrientation: 2, riskTolerance: 2, selfEfficacy: 2, networking: 2 },
        careerStatus: { ...bc, burnout: 2, organizationStress: 2, workLifeBalance: 4 },
      }),
      expectArchetype: '보류·점검형',
      expectPrimaryContains: '추가 정보',
    },
    // ── New gate consistency tests ─────────────────────────────────────────────
    {
      // A: runway < 3 + startup traits high → side-project while employed, NOT full startup
      name: 'NEW-A. runway<3 + startup high → side-project (not full startup)',
      form: make({
        basicProfile: { ...bp, savings: 6_000_000 },  // 2 months runway
        traits: { ...bt, riskTolerance: 5, curiosity: 5, changeOrientation: 5, selfEfficacy: 4 },
      }),
      expectArchetype: '보류·점검형',        // financial crisis overrides startup gate
      expectPrimaryContains: '추가 정보',    // hold — no income-interruption strategies
    },
    {
      // B: burnout >= 80 + mobility high → recovery-first, NOT aggressive job change
      name: 'NEW-B. burnout>=80 + mobility high → recovery-first (not aggressive jobChange)',
      form: make({
        basicProfile: { ...bp, savings: 36_000_000 }, // 12 months runway
        careerStatus: { ...bc, burnout: 5, organizationStress: 5, workLifeBalance: 1, jobSatisfaction: 2 },
        traits: { ...bt, recoveryNeed: 5, selfEfficacy: 4, networking: 4, outcomeExpectation: 4, portfolioEvidence: 4 },
      }),
      expectArchetype: '회복 우선형',
      expectPrimaryContains: '상태 안정화',  // tier-1 (>=80) copy
    },
    {
      // C: dissatisfaction high + mobility low (Mobley stage 1) → prepare readiness first
      name: 'NEW-C. dissatisfaction high + mobility low → prepare readiness first',
      form: make({
        careerStatus: { ...bc, jobSatisfaction: 2, growthPotential: 2, burnout: 2 },
        traits: { ...bt, selfEfficacy: 2, networking: 2, outcomeExpectation: 2, portfolioEvidence: 2, curiosity: 4, changeOrientation: 4 },
        basicProfile: { ...bp, savings: 18_000_000 }, // 6 months
      }),
      expectArchetype: '준비 후 전환형',
      expectPrimaryContains: '이직 준비도',
    },
    {
      // D: satisfaction medium + orgStress high → job crafting (stable-maintain or crafting path)
      name: 'NEW-D. satisfaction medium + orgStress high → job crafting path',
      form: make({
        careerStatus: { ...bc, jobSatisfaction: 3, growthPotential: 4, salarySatisfaction: 3, organizationStress: 5, burnout: 3 },
        traits: { ...bt, changeOrientation: 2, riskTolerance: 2, planning: 4 },
      }),
      expectArchetype: '현 직장 재설계형',
      expectPrimaryContains: '현 직장',
    },
    {
      // E: startup traits high + runway>=12 + burnout low → startup can be primary
      name: 'NEW-E. startup high + runway>=12 + burnout low → startup primary',
      form: make({
        basicProfile: { ...bp, savings: 36_000_000 }, // 12 months runway
        traits: { ...bt, riskTolerance: 5, selfEfficacy: 5, curiosity: 5, changeOrientation: 5, networking: 5, outcomeExpectation: 5, portfolioEvidence: 5 },
        careerStatus: { ...bc, burnout: 1, jobSatisfaction: 2 },
      }),
      expectArchetype: '도전 가속형',
      expectPrimaryContains: '창업',
    },
  ];

  const rows = scenarios.map(sc => {
    const r = calculateResults(sc.form);
    const s = r.strategy;
    const archPass = s.archetype === sc.expectArchetype;
    const primPass = s.primaryStrategy.includes(sc.expectPrimaryContains);
    const top = r.scores[0];
    const startup = r.scores.find(s2 => s2.key === 'startupFreelance');
    return {
      Scenario:     sc.name,
      기대유형:     sc.expectArchetype,
      실제유형:     s.archetype,
      유형일치:     archPass ? '✓' : '✗',
      기대전략:     sc.expectPrimaryContains,
      실제전략:     s.primaryStrategy,
      전략일치:     primPass ? '✓' : '✗',
      '1위옵션':    `${top?.label}(${Math.round(top?.totalScore ?? 0)})`,
      '1위준비도':  top?.readinessStatus ?? '-',
      '창업준비도': startup?.readinessStatus ?? '없음',
      신뢰도:       s.confidence,
    };
  });

  console.table(rows);
  const passed = rows.filter(r => r.유형일치 === '✓' && r.전략일치 === '✓').length;
  console.log(`\n결과: ${passed}/${rows.length} 아키타입 시나리오 통과`);

  // ── Direction / Execution consistency tests ──────────────────────────────────
  type DEScenario = {
    name: string;
    form: FormData;
    expectDirection: string;   // contains check
    expectExecution: string;   // exact match
  };

  const deScenarios: DEScenario[] = [
    {
      name: 'DE-1. Startup high + runway>=12 + low fatigue → 독립창업형 / 즉시실행',
      form: make({
        basicProfile: { ...bp, savings: 36_000_000 },  // 12 months
        traits: { ...bt, riskTolerance: 5, selfEfficacy: 5, changeOrientation: 5, curiosity: 5, networking: 4 },
        careerStatus: { ...bc, burnout: 1, jobSatisfaction: 2 },
      }),
      expectDirection: '자기 길 만드는 사람',
      expectExecution: '즉시 실행',
    },
    {
      name: 'DE-2. Startup high + medium runway + medium fatigue → 독립창업형 / 재직중검증',
      form: make({
        basicProfile: { ...bp, savings: 18_000_000 },  // 6 months
        traits: { ...bt, riskTolerance: 5, selfEfficacy: 4, changeOrientation: 4, curiosity: 4, networking: 3 },
        careerStatus: { ...bc, burnout: 3, organizationStress: 3 },
      }),
      expectDirection: '자기 길 만드는 사람',
      expectExecution: '재직 중 검증',
    },
    {
      name: 'DE-3. High job mobility + dissatisfaction + low startup → 조직/전문가성장형 / 재직중검증',
      form: make({
        basicProfile: { ...bp, savings: 18_000_000 },
        traits: { ...bt, selfEfficacy: 4, networking: 4, changeOrientation: 4, curiosity: 3, riskTolerance: 2 },
        careerStatus: { ...bc, jobSatisfaction: 2, growthPotential: 2, burnout: 2 },
      }),
      expectDirection: '성장형',  // 같이 만들 때 잘하는 사람 or 한 우물 파는 사람
      expectExecution: '재직 중 검증',
    },
    {
      name: 'DE-4. High fatigue → direction stays (not erased), execution = 회복후실행',
      form: make({
        basicProfile: { ...bp, savings: 18_000_000 },
        traits: { ...bt, riskTolerance: 5, selfEfficacy: 4, changeOrientation: 4, curiosity: 4, recoveryNeed: 5 },
        careerStatus: { ...bc, burnout: 5, organizationStress: 5, workLifeBalance: 1 },
      }),
      expectDirection: '자기 길 만드는 사람',   // direction persists despite fatigue
      expectExecution: '회복 후 실행',
    },
    {
      name: 'DE-5. Learning high + mobility low → 학습전환형 / 준비후전환',
      form: make({
        traits: { ...bt, curiosity: 5, changeOrientation: 4, riskTolerance: 2, selfEfficacy: 2, networking: 2, meaningOrientation: 4 },
        careerStatus: { ...bc, jobSatisfaction: 2, burnout: 2 },
      }),
      expectDirection: '방향 바꾸고 싶은 사람',
      expectExecution: '준비 후 전환',
    },
  ];

  const deRows = deScenarios.map(sc => {
    const r = calculateResults(sc.form);
    const cd = r.careerDiagnosis;
    const dirPass = cd.directionType.includes(sc.expectDirection);
    const execPass = cd.executionMode === sc.expectExecution;
    return {
      Scenario:     sc.name,
      기대방향:     sc.expectDirection,
      실제방향:     cd.directionType,
      방향일치:     dirPass  ? '✓' : '✗',
      기대실행:     sc.expectExecution,
      실제실행:     cd.executionMode,
      실행일치:     execPass ? '✓' : '✗',
      통합전략요약: cd.integratedStrategy.slice(0, 30) + '…',
    };
  });

  console.log('\n── 방향성/실행방식 일관성 테스트 ────────────────────');
  console.table(deRows);
  const dePassed = deRows.filter(r => r.방향일치 === '✓' && r.실행일치 === '✓').length;
  console.log(`\n결과: ${dePassed}/${deRows.length} 방향/실행 시나리오 통과`);

  // ── Persona ↔ Strategy consistency check ────────────────────────────────────
  // Each decisionClass must produce an archetypeLabel that contains a strategy-aligned keyword.
  const ARCHETYPE_KEYWORDS: Record<CareerDecisionClass, string[]> = {
    'recovery-first':          ['회복'],
    'hold-and-review':         ['점검'],
    'accelerate-challenge':    ['가속', '도전'],
    'side-project-validation': ['검증'],
    'move-while-working':      ['이동', '탐색'],
    'stable-maintain':         ['재설계', '안정'],
    'prepare-then-switch':     ['전환', '준비'],
  };

  const personaRows = scenarios.map(sc => {
    const r = calculateResults(sc.form);
    const cls = r.decisionGate.decisionClass;
    const label = r.personalityStory.archetypeLabel;
    const expected = ARCHETYPE_KEYWORDS[cls] ?? [];
    const aligned = expected.some(kw => label.includes(kw));
    if (!aligned) {
      console.warn(`⚠ Persona mismatch: [${cls}] → archetypeLabel="${label}" (expected one of: ${expected.join(', ')})`);
    }
    return {
      Scenario:     sc.name.slice(0, 30),
      Gate:         cls,
      아키타입레이블: label,
      일치여부:     aligned ? '✓' : '✗ MISMATCH',
      전략:         r.strategy.primaryStrategy.slice(0, 25),
    };
  });

  console.log('\n── 페르소나 ↔ 전략 일관성 검증 ──────────────────────');
  console.table(personaRows);
  const personaPassed = personaRows.filter(r => r.일치여부 === '✓').length;
  console.log(`\n결과: ${personaPassed}/${personaRows.length} 페르소나 일관성 통과`);

  // ── End-to-end funnel consistency check (A-D) ────────────────────────────────
  // Verifies: directionType, executionMode, primaryStrategy, stateTiming, actionPlanType, alignment

  type E2EScenario = {
    name: string;
    form: FormData;
    // Alignment rules
    noExpansionCopy?: boolean;     // primaryStrategy must NOT contain 창업/사이드/이직
    expectStateTiming?: string;    // contains check on stateTimingLevel
    expectActionContains?: string; // week1.task must contain this string
    expectDirectionContains?: string;
  };

  const e2eScenarios: E2EScenario[] = [
    {
      name: 'E2E-A. Low change desire + high stability → stable/org direction, no expansion copy',
      form: make({
        flow: { desireForChange: 1, desireForStability: 5, needForRest: 2 },
        traits: { ...bt, changeOrientation: 1, riskTolerance: 1, planning: 5, curiosity: 2 },
        careerStatus: { ...bc, jobSatisfaction: 4, growthPotential: 4 },
        basicProfile: { ...bp, savings: 18_000_000 },
      }),
      noExpansionCopy: true,
      expectDirectionContains: '안정',
    },
    {
      name: 'E2E-B. High burnout → recovery timing + recovery-first action plan',
      form: make({
        careerStatus: { ...bc, burnout: 5, organizationStress: 5, workLifeBalance: 1 },
        traits: { ...bt, recoveryNeed: 5 },
        basicProfile: { ...bp, savings: 18_000_000 },
      }),
      expectStateTiming: '회복 우선',
      expectActionContains: '회복 루틴',
    },
    {
      name: 'E2E-C. High startup traits + 12mo runway + low burnout → startup-compatible direction',
      form: make({
        basicProfile: { ...bp, savings: 36_000_000 },
        traits: { ...bt, riskTolerance: 5, selfEfficacy: 5, changeOrientation: 5, curiosity: 5, networking: 5 },
        careerStatus: { ...bc, burnout: 1 },
        flow: { desireForChange: 5, desireForStability: 2, needForRest: 1 },
      }),
      expectStateTiming: '실행 가능',
      expectDirectionContains: '창업',
    },
    {
      name: 'E2E-D. Medium everything → no extreme labels (강함/위험 absent from direction)',
      form: make({
        flow: { desireForChange: 3, desireForStability: 3, needForRest: 3 },
        traits: { ...bt },
        careerStatus: { ...bc },
        basicProfile: { ...bp, savings: 12_000_000 },
      }),
      // No extreme strategy labels
    },
  ];

  // Derive actionPlanType from decisionClass
  function actionPlanType(decisionClass: string): string {
    if (decisionClass === 'recovery-first' || decisionClass === 'hold-and-review') return '회복형';
    if (decisionClass === 'side-project-validation')  return '사이드프로젝트+이직형';
    if (decisionClass === 'move-while-working')        return '이직탐색형';
    if (decisionClass === 'stable-maintain')           return '직무재설계형';
    if (decisionClass === 'prepare-then-switch')       return '준비후전환형';
    if (decisionClass === 'accelerate-challenge')      return '도전가속형';
    return '보류형';
  }

  const e2eRows = e2eScenarios.map(sc => {
    const r = calculateResults(sc.form);
    const cd = r.careerDiagnosis;
    const s = r.strategy;
    const ta = s.timingAdvice;
    const planType = actionPlanType(r.decisionGate.decisionClass);
    const week1Task = r.actionPlanDetailed.week1.task;

    const noExpPass   = sc.noExpansionCopy
      ? !s.primaryStrategy.includes('창업') && !s.primaryStrategy.includes('이직') && !s.primaryStrategy.includes('사이드')
      : true;
    const timingPass  = sc.expectStateTiming
      ? ta.stateTimingLevel === sc.expectStateTiming
      : true;
    const actionPass  = sc.expectActionContains
      ? week1Task.includes(sc.expectActionContains)
      : true;
    const dirPass     = sc.expectDirectionContains
      ? cd.directionType.includes(sc.expectDirectionContains)
      : true;

    const aligned = noExpPass && timingPass && actionPass && dirPass;

    return {
      Scenario:      sc.name.slice(0, 40),
      방향성:        cd.directionType,
      실행모드:      cd.executionMode,
      핵심전략:      s.primaryStrategy.slice(0, 25),
      타이밍:        ta.stateTimingLevel,
      실행계획유형:  planType,
      'Week1확인':   week1Task.slice(0, 28),
      일치여부:      aligned ? '✓ 일치' : '✗ 불일치',
    };
  });

  console.log('\n── E2E 일관성 검증 (A-D) ────────────────────────────');
  console.table(e2eRows);
  const e2ePassed = e2eRows.filter(r => r.일치여부.startsWith('✓')).length;
  console.log(`\n결과: ${e2ePassed}/${e2eRows.length} E2E 일관성 시나리오 통과`);
}

// ─── Direction / Execution diagnosis ─────────────────────────────────────────
// Direction = long-term identity (trait-based, stable).
// Execution = current path (state-based, temporary).
// They are computed independently so execution mode cannot erase direction identity.

const DIRECTION_DESCRIPTIONS: Record<DirectionType, string> = {
  '자기 길 만드는 사람':   '자율적 환경에서 자신의 방식으로 일하려는 성향이 강합니다. 장기적으로 독립적인 커리어 경로가 더 맞습니다.',
  '한 우물 파는 사람': '특정 분야에서 깊이 있는 전문성을 쌓는 방향이 맞습니다. 의미와 역량 성장이 동기의 핵심입니다.',
  '같이 만들 때 잘하는 사람':   '조직 내 네트워크와 영향력을 통해 성장하는 방향이 맞습니다. 협업과 기획 능력이 강점입니다.',
  '방향 바꾸고 싶은 사람':   '새로운 분야로 역량을 전환하며 성장하는 방향이 맞습니다. 학습을 통한 방향 전환이 자연스럽습니다.',
  '잠시 충전이 필요한 사람': '지금은 방향 설정보다 에너지 회복과 커리어 재정비가 먼저 필요한 상태입니다.',
  '차근차근 다지는 사람':   '안정적인 기반 위에서 장기적으로 커리어를 설계하는 방향이 맞습니다. 급격한 변화보다 최적화를 선호합니다.',
};

const EXECUTION_DESCRIPTIONS: Record<ExecutionMode, string> = {
  '즉시 실행':    '현재 여건이 적극적인 실행을 지지합니다. 지금 시작해도 됩니다.',
  '재직 중 검증': '재직을 유지하면서 방향을 검증·탐색하는 것이 지금 가장 안전합니다.',
  '준비 후 전환': '먼저 이직 경쟁력이나 역량을 높인 후 이동하는 것이 더 유리합니다.',
  '회복 후 실행': '지금 실행하면 에너지 부족으로 효과가 반감됩니다. 먼저 회복하세요.',
  '보류·점검':    '재무 여건이나 피로도가 즉각적인 행동을 어렵게 만들고 있습니다. 기반 조건을 먼저 안정화하세요.',
};

// direction × execution → concrete integrated strategy statement
// One-liner shown just below the direction label in the hero card.
// More personal than integratedStrategy — reads as the "context sentence" for direction×execution.
const ONE_LINE_SUMMARY: Record<DirectionType, Record<ExecutionMode, string>> = {
  '자기 길 만드는 사람': {
    '즉시 실행':    '독립적으로 일할 때 에너지가 살아나는 타입이고, 지금 조건도 시작하기에 충분합니다.',
    '재직 중 검증': '독립적으로 일할 때 에너지가 살아나는 타입이지만, 지금은 퇴사보다 작은 유료 실험으로 방향을 검증하는 단계입니다.',
    '준비 후 전환': '독립 창업 방향이지만, 먼저 시장 경쟁력을 높인 후 단계적으로 준비하는 것이 더 현실적입니다.',
    '회복 후 실행': '독립 창업 방향이지만, 지금 당장 실행하면 번아웃이 겹칩니다. 회복 후 차근차근 시작하세요.',
    '보류·점검':    '독립 창업 방향이지만, 지금은 기반 조건을 안정화하는 것이 먼저입니다.',
  },
  '한 우물 파는 사람': {
    '즉시 실행':    '전문성을 깊이 쌓는 것이 맞는 방향이고, 지금 조건도 적극적으로 움직이기에 충분합니다.',
    '재직 중 검증': '전문성을 심화할 수 있는 더 나은 환경을 재직 중 탐색하는 것이 지금 가장 합리적입니다.',
    '준비 후 전환': '전문가 성장 방향이지만, 먼저 역량 투자를 통해 더 유리한 조건으로 이동하는 것이 맞습니다.',
    '회복 후 실행': '전문가 성장 방향이지만, 지금 상태에서 움직이면 에너지가 반감됩니다. 먼저 회복하세요.',
    '보류·점검':    '전문가 성장 방향이지만, 지금은 기반 조건이 먼저입니다.',
  },
  '같이 만들 때 잘하는 사람': {
    '즉시 실행':    '조직 내 영향력을 키우는 방향이 맞고, 지금 바로 환경 전환을 실행할 수 있습니다.',
    '재직 중 검증': '조직 성장 방향에서 더 나은 환경을 재직 중 탐색하는 것이 가장 안전합니다.',
    '준비 후 전환': '조직 성장 방향이지만, 네트워크와 이직 준비를 먼저 탄탄히 하는 것이 더 유리합니다.',
    '회복 후 실행': '조직 성장 방향이지만, 지금은 회복이 우선입니다.',
    '보류·점검':    '조직 성장 방향이지만, 지금은 기반 조건을 점검하는 것이 먼저입니다.',
  },
  '방향 바꾸고 싶은 사람': {
    '즉시 실행':    '학습을 통한 방향 전환이 맞고, 지금 바로 시작할 수 있는 조건입니다.',
    '재직 중 검증': '학습 전환 방향에서 재직 중 역량 강화와 방향 탐색을 동시에 진행하는 것이 가장 효율적입니다.',
    '준비 후 전환': '학습을 통해 방향을 전환하는 것이 맞는 접근입니다. 목표 직무를 먼저 검증하고 역량을 쌓으세요.',
    '회복 후 실행': '학습 전환 방향이지만, 지금 시작하면 지속이 어렵습니다. 회복 후에 시작하세요.',
    '보류·점검':    '학습 전환 방향이지만, 지금은 재무·피로 조건을 먼저 안정화하세요.',
  },
  '잠시 충전이 필요한 사람': {
    '즉시 실행':    '지금 가장 먼저 필요한 것은 에너지 회복입니다. 회복 후 방향을 다시 설정하세요.',
    '재직 중 검증': '회복하면서 방향을 탐색하는 단계입니다. 낮은 강도로 시작하세요.',
    '준비 후 전환': '회복과 재정비 후 방향을 잡아가는 단계입니다. 지금 무리하지 마세요.',
    '회복 후 실행': '지금은 회복이 전략입니다. 회복 완료 후에 방향을 다시 정하세요.',
    '보류·점검':    '지금은 모든 결정을 보류하고 기반 조건을 안정화하는 것이 최선입니다.',
  },
  '차근차근 다지는 사람': {
    '즉시 실행':    '안정적인 기반에서 지금 바로 움직일 수 있는 조건입니다.',
    '재직 중 검증': '현재 환경을 최적화하면서 필요하면 안정적인 이직을 탐색하는 방식이 맞습니다.',
    '준비 후 전환': '안정 방향에서 충분히 준비된 후 안전하게 이동하는 전략이 맞습니다.',
    '회복 후 실행': '안정 설계 방향이지만, 지금은 회복이 먼저입니다.',
    '보류·점검':    '안정을 원하지만 지금은 기반 조건을 먼저 점검해야 합니다.',
  },
};

const INTEGRATED_MATRIX: Record<DirectionType, Record<ExecutionMode, string>> = {
  '자기 길 만드는 사람': {
    '즉시 실행':    '창업/프리랜서 실행 조건이 갖춰졌습니다. 퇴사 전 유료 고객 1명 확보를 첫 번째 기준으로 삼으세요.',
    '재직 중 검증': '소득을 유지하면서 유료 고객 반응을 먼저 확인하세요.',
    '준비 후 전환': '창업 방향이지만, 이직 경쟁력과 재무 여건을 먼저 높인 후 단계적으로 전환하는 것이 현실적입니다.',
    '회복 후 실행': '창업 방향이지만, 지금 당장 실행하면 번아웃이 겹쳐 실패 가능성이 높습니다. 회복 후 차근차근 준비하세요.',
    '보류·점검':    '창업 방향이지만, 재무 여건이나 피로도가 즉각적인 행동을 어렵게 만들고 있습니다. 기반 조건을 먼저 안정화하세요.',
  },
  '한 우물 파는 사람': {
    '즉시 실행':    '전문성 심화 방향에서 지금 움직일 조건이 됩니다. 더 나은 성장 환경으로 적극적으로 이동하세요.',
    '재직 중 검증': '전문가로 성장할 수 있는 더 나은 환경을 재직 중 탐색하면서, 이직 가능성을 데이터로 확인하세요.',
    '준비 후 전환': '전문성 심화 방향이지만, 이직 경쟁력 강화가 먼저입니다. 재직 중 역량 투자 후 탐색하세요.',
    '회복 후 실행': '전문가 성장 방향이지만, 지금 상태에서 움직이면 탐색의 질이 낮아집니다. 먼저 회복하세요.',
    '보류·점검':    '전문가 성장 방향이지만, 지금은 기반 조건을 안정화하는 것이 먼저입니다.',
  },
  '같이 만들 때 잘하는 사람': {
    '즉시 실행':    '조직 내 성장 또는 이직을 통한 환경 전환을 바로 실행할 수 있는 조건입니다.',
    '재직 중 검증': '조직 성장 방향에서 더 나은 환경을 재직 중 탐색하세요. 퇴사보다 탐색이 먼저입니다.',
    '준비 후 전환': '조직 성장 방향이지만, 네트워킹과 이직 경쟁력을 먼저 높이는 것이 더 유리한 이동을 만듭니다.',
    '회복 후 실행': '조직 내 성장 방향이지만, 지금은 회복이 우선입니다. 피로도 회복 후 탐색하세요.',
    '보류·점검':    '조직 성장 방향이지만, 지금은 기반 조건을 점검하는 것이 먼저입니다.',
  },
  '방향 바꾸고 싶은 사람': {
    '즉시 실행':    '학습 전환 방향에서 지금 바로 실행할 수 있는 조건입니다. 목표 역량 학습과 방향 탐색을 병행하세요.',
    '재직 중 검증': '학습 전환 방향에서, 재직 중 역량 강화와 방향 탐색을 병행하세요. 전환 목표 직무 현업자 인터뷰가 먼저입니다.',
    '준비 후 전환': '학습을 통한 전환 방향이 맞습니다. 목표 직무를 검증하고 필요 역량을 쌓아 유리한 조건으로 이동하세요.',
    '회복 후 실행': '학습 전환 방향이지만, 지금 상태에서 학습을 시작해도 지속 가능성이 낮습니다. 회복 후 시작하세요.',
    '보류·점검':    '학습 전환 방향이지만, 지금은 재무·피로 조건을 먼저 안정화하는 것이 현실적입니다.',
  },
  '잠시 충전이 필요한 사람': {
    '즉시 실행':    '재정비가 필요한 시점입니다. 지금 즉각 실행보다 회복과 방향 재설계를 먼저 실행하세요.',
    '재직 중 검증': '회복하면서 방향을 재정비하는 단계입니다. 낮은 강도로 탐색하면서 다음 방향을 찾으세요.',
    '준비 후 전환': '회복과 재정비 후 전환을 준비하는 단계입니다. 에너지가 회복되면 방향이 더 명확해집니다.',
    '회복 후 실행': '지금 가장 중요한 것은 회복입니다. 회복 후에 방향을 다시 설정하세요.',
    '보류·점검':    '지금은 모든 결정을 보류하고, 기반 조건(재무·피로)을 안정화하는 것이 최선입니다.',
  },
  '차근차근 다지는 사람': {
    '즉시 실행':    '안정적인 기반에서 지금 바로 움직일 수 있습니다. 현재 환경 최적화 또는 안정적 이동을 바로 시작하세요.',
    '재직 중 검증': '안정 설계 방향에서 현재 환경 개선을 먼저 시도하세요. 개선이 없으면 안정적 이직을 탐색하세요.',
    '준비 후 전환': '안정 방향에서, 충분히 준비된 후 안전하게 이동하는 전략이 맞습니다.',
    '회복 후 실행': '안정 설계 방향이지만, 지금은 회복이 먼저입니다. 회복 후 내부 재설계를 시작하세요.',
    '보류·점검':    '안정을 원하지만, 지금은 기반 조건을 점검하는 것이 먼저입니다.',
  },
};

export function determineDirectionType(
  derived: DerivedVariables,
  form: FormData,
  saju: SajuTraitEstimate | null,
): DirectionType {
  const { explorationDrive, stabilityPreference, marketReadiness, burnoutPressure } = derived;
  const rt = normTo100(form.traits.riskTolerance);
  const se = normTo100(form.traits.selfEfficacy);
  const cu = normTo100(form.traits.curiosity);
  const co = normTo100(form.traits.changeOrientation);
  const mo = normTo100(form.traits.meaningOrientation);
  const nw = normTo100(form.traits.networking);
  const pl = normTo100(form.traits.planning);

  // Composite startup drive — checked first; burnout cannot erase this identity.
  const startupDrive = rt * 0.35 + se * 0.25 + explorationDrive * 0.25 + nw * 0.15;
  if (startupDrive >= 58) return '자기 길 만드는 사람';
  // Saju can amplify a borderline startup signal
  if (saju?.confidence === 'estimated' && saju.entrepreneurialDrive >= 65 && startupDrive >= 45) {
    return '자기 길 만드는 사람';
  }

  // Stability + low change = 차근차근 다지는 사람
  if (stabilityPreference >= 65 && co < 45 && mo < 55) return '차근차근 다지는 사람';

  // Learning drive + change desire + low risk = 방향 바꾸고 싶은 사람
  if (cu >= 60 && co >= 50 && rt < 55) return '방향 바꾸고 싶은 사람';

  // Deep expertise + meaning = 한 우물 파는 사람
  if (mo >= 60 && cu >= 50) return '한 우물 파는 사람';

  // Org networker + planner = 같이 만들 때 잘하는 사람
  if (nw >= 55 && pl >= 55) return '같이 만들 때 잘하는 사람';

  // No clear direction + high burnout = 잠시 충전이 필요한 사람 (temporary state)
  if (burnoutPressure >= 65) return '잠시 충전이 필요한 사람';

  // Default: high market readiness → org path; otherwise expertise path
  return (marketReadiness - 1) / 4 * 100 >= 50 ? '같이 만들 때 잘하는 사람' : '한 우물 파는 사람';
}

export function determineExecutionMode(derived: DerivedVariables): ExecutionMode {
  const { burnoutPressure, runwayMonths, marketReadiness, readinessBehavior } = derived;
  const mr = (marketReadiness - 1) / 4 * 100;

  // Hard blocks — same hierarchy as gate system
  if (runwayMonths < 2 || (burnoutPressure >= 75 && runwayMonths < 3)) return '보류·점검';
  if (burnoutPressure >= 60) return '회복 후 실행';
  if (burnoutPressure >= 55 && runwayMonths < 4) return '회복 후 실행';

  // Immediate execution: all conditions align
  if (mr >= 65 && readinessBehavior >= 55 && runwayMonths >= 9 && burnoutPressure < 45) return '즉시 실행';

  // In-employment exploration/validation
  if (mr >= 40 && readinessBehavior >= 40 && runwayMonths >= 3) return '재직 중 검증';

  // Readiness gap → prepare first
  return '준비 후 전환';
}

function buildBridgeNote(
  direction: DirectionType,
  execution: ExecutionMode,
  derived: DerivedVariables,
): string | null {
  const { runwayMonths, burnoutPressure } = derived;
  const bp  = Math.round(burnoutPressure);
  const rw  = runwayMonths.toFixed(1);

  // No bridge needed when direction and execution naturally align
  const naturalAlignments: Partial<Record<DirectionType, ExecutionMode[]>> = {
    '자기 길 만드는 사람':   ['즉시 실행'],
    '한 우물 파는 사람': ['즉시 실행', '재직 중 검증'],
    '같이 만들 때 잘하는 사람':   ['즉시 실행', '재직 중 검증'],
    '방향 바꾸고 싶은 사람':   ['준비 후 전환', '재직 중 검증'],
    '잠시 충전이 필요한 사람': ['회복 후 실행', '보류·점검', '재직 중 검증'],
    '차근차근 다지는 사람':   ['재직 중 검증', '준비 후 전환', '즉시 실행'],
  };
  if (naturalAlignments[direction]?.includes(execution)) return null;

  // Direction = startup but execution is more conservative
  if (direction === '자기 길 만드는 사람') {
    if (execution === '재직 중 검증')
      return `이직보다 창업이 장기 방향이지만, 지금은 재직 중 유료 고객 반응을 확인하는 것이 먼저입니다. 고객 검증이 성공하면 그것이 창업 실행 신호입니다.`;
    if (execution === '준비 후 전환')
      return `창업 DNA가 강하지만, 이직 경쟁력(${Math.round((derived.marketReadiness - 1) / 4 * 100)}/100)이나 재무 여건을 먼저 높인 후 창업 준비를 시작하는 것이 더 현실적입니다.`;
    if (execution === '회복 후 실행')
      return `창업 방향이지만 피로도(${bp}/100)가 높아 지금 실행하면 번아웃이 겹칩니다. 회복이 완료된 후 사이드 프로젝트로 시작하세요.`;
    if (execution === '보류·점검')
      return `창업 DNA가 강하지만 런웨이(${rw}개월)나 피로도가 즉각 실행을 막고 있습니다. 기반 안정화가 먼저이며, 창업은 그 다음입니다.`;
  }

  // Direction is growth-oriented but execution is constrained
  if (execution === '회복 후 실행')
    return `성장 방향은 맞지만 피로도(${bp}/100)가 높아 탐색의 질이 낮아집니다. 회복 후 탐색이 더 좋은 결과를 만듭니다.`;
  if (execution === '보류·점검')
    return `방향성은 있지만 런웨이(${rw}개월)나 피로도가 즉각적인 행동을 어렵게 만들고 있습니다. 기반 조건을 먼저 안정화하세요.`;

  return null;
}

export function generateCareerDiagnosis(
  derived: DerivedVariables,
  form: FormData,
  saju: SajuTraitEstimate | null,
): CareerDiagnosis {
  const directionType      = determineDirectionType(derived, form, saju);
  const executionMode      = determineExecutionMode(derived);
  const integratedStrategy = INTEGRATED_MATRIX[directionType][executionMode];
  const oneLineSummary     = ONE_LINE_SUMMARY[directionType][executionMode];
  const bridgeNote         = buildBridgeNote(directionType, executionMode, derived);

  return {
    directionType,
    directionLabel:       directionType,
    directionDescription: DIRECTION_DESCRIPTIONS[directionType],
    executionMode,
    executionLabel:       executionMode,
    executionDescription: EXECUTION_DESCRIPTIONS[executionMode],
    integratedStrategy,
    oneLineSummary,
    bridgeNote,
  };
}

// ─── Narrative generators ────────────────────────────────────────────────────
// Text assembly only — no scoring rules added here.

export function generateNarrativePersona(
  derived: DerivedVariables,
  form: FormData,
  decisionClass: CareerDecisionClass,
  sajuTraitEstimate: SajuTraitEstimate | null,
  _stateTimingLevel: StateTimingLevel = '실행 가능',
): NarrativePersona {
  const { explorationDrive, readinessBehavior, stabilityPreference, burnoutPressure, marketReadiness } = derived;
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const rb = Math.round(readinessBehavior);
  const sp = Math.round(stabilityPreference);
  const bp = Math.round(burnoutPressure);
  const cu = Math.round(normTo100(form.traits.curiosity));
  const rt = Math.round(normTo100(form.traits.riskTolerance));

  let headline: string;
  let decisionStyle: string;
  let motivationDriver: string;
  let strength: string;
  let watchOut: string;

  switch (decisionClass) {
    case 'recovery-first':
      headline = '지금 에너지가 소진된 상태입니다. 이건 의지의 문제가 아니라, 회복이 필요하다는 신호입니다.';
      decisionStyle = '지금 상태에서는 어떤 선택도 잘 될 것 같지 않다는 느낌이 들 수 있습니다. 그 느낌이 맞습니다 — 회복 후에 판단하는 것이 더 나은 결정을 만듭니다.';
      motivationDriver = `피로도(${bp}/100)가 높아 먼저 에너지를 회복한 뒤 다음을 준비하고 싶은 상태입니다`;
      strength = '회복 후에는 판단력과 실행력이 빠르게 돌아오는 타입입니다';
      watchOut = '지금 상태에서 큰 결정을 내리면 나중에 후회하기 쉽습니다. 결정보다 회복이 먼저입니다';
      break;
    case 'hold-and-review':
      headline = '지금 당장 큰 결정을 내리기 어려운 조건입니다. 이건 상황의 문제이지 능력의 문제가 아닙니다.';
      decisionStyle = '지금은 결정보다 정보 수집과 기반 안정화가 먼저입니다. 기반이 흔들릴 때 내린 결정은 좋은 결정이 되기 어렵습니다.';
      motivationDriver = '안정적인 기반을 만든 후 다음 단계를 준비하고 싶은 상태입니다';
      strength = '신중하게 행동을 보류하는 것도 하나의 전략입니다. 지금 상황을 정확히 파악하는 것이 먼저입니다';
      watchOut = '결정을 계속 미루면 기회 비용이 생깁니다. 지금 할 수 있는 가장 작은 행동 하나를 찾으세요';
      break;
    case 'accelerate-challenge':
      headline = '역량도, 에너지도, 재무 여건도 갖춰진 드문 조합입니다. 지금이 실행할 때입니다.';
      decisionStyle = '지금 움직이지 않으면 "그때 했어야 했는데"가 될 가능성이 있습니다. 빠른 실행 앞에서 검증을 건너뛰지 않는 것이 핵심입니다.';
      motivationDriver = '더 큰 가능성을 향해 적극적으로 나아가려는 드라이브가 강합니다';
      strength = mr >= 60
        ? `이직 경쟁력(${mr}/100)과 탐색 에너지가 동시에 갖춰져 있습니다`
        : `탐색 에너지(${Math.round(explorationDrive)}/100)와 행동 준비도(${rb}/100)가 실행을 뒷받침합니다`;
      watchOut = '확신이 강할수록 검증을 건너뛰기 쉽습니다. 빠른 실행 전 가설을 먼저 확인하세요';
      break;
    case 'side-project-validation':
      headline = '변화를 원하지만 무작정 뛰어드는 것은 자신에게 맞지 않는다는 걸 압니다.';
      decisionStyle = '검증하고 움직이는 방식이 강점입니다. 작은 실험으로 가능성을 확인한 후 실행하는 접근이 지금 상황에 가장 잘 맞습니다.';
      motivationDriver = rt >= 60
        ? '독립적인 커리어 경로에 대한 관심이 강하고, 이를 안전하게 검증하고 싶습니다'
        : '다양한 가능성을 탐색하면서도 현실적인 조건을 유지하고 싶습니다';
      strength = '탐색 에너지와 현실 감각이 함께 있어, 무모하지 않게 도전할 수 있습니다';
      watchOut = '검증을 너무 오래 하면 실행이 계속 미뤄집니다. "유료 고객 1명 확보"를 판단 기준으로 삼으세요';
      break;
    case 'move-while-working':
      headline = '지금 환경이 맞지 않는다는 신호를 이미 느끼고 있습니다. 그리고 이직 경쟁력도 갖춰져 있습니다.';
      decisionStyle = '충동적으로 퇴사하거나 무작정 버티는 것이 아닌, 시장 반응을 데이터로 확인한 후 결정하는 스타일이 잘 맞습니다.';
      motivationDriver = '더 맞는 환경에서 성장하고 싶은 욕구가 있습니다';
      strength = `이직 경쟁력(${mr}/100)이 갖춰져 있어 재직 중 탐색으로 리스크 없이 시작할 수 있습니다`;
      watchOut = '"탈출"이 목표가 되면 새 환경에서도 비슷한 문제를 마주칩니다. 이동 방향을 먼저 정의하세요';
      break;
    case 'stable-maintain':
      headline = '지금 환경이 나쁘지 않습니다. 급격한 변화보다 내부 최적화가 더 빠를 수 있습니다.';
      decisionStyle = '안정된 기반 위에서 조건을 개선하는 방식이 자연스럽게 맞는 타입입니다. 협상과 역할 조정이 강점입니다.';
      motivationDriver = sp >= 65
        ? '현재 환경에서 최선의 조건을 만들고 싶습니다'
        : '지금 위치를 유지하면서 성장 조건을 개선하고 싶습니다';
      strength = '내부 협상력과 역할 최적화 능력이 강점입니다';
      watchOut = '변화 없이 유지하다 보면 성장 정체가 서서히 동기를 갉아먹습니다. 4~8주 내 개선 기한을 설정하세요';
      break;
    case 'prepare-then-switch':
    default:
      headline = '변화를 원하지만 지금 당장 움직이기에는 준비가 더 필요합니다.';
      decisionStyle = '충분히 준비된 후 움직이는 타입입니다. 지금은 실행보다 역량 투자가 다음 단계를 여는 시기입니다.';
      motivationDriver = cu >= 60
        ? '탐구 욕구와 학습 에너지가 있어, 역량을 쌓으면서 방향을 찾아가는 방식이 맞습니다'
        : '역량을 키워 더 유리한 조건으로 이동하고 싶습니다';
      strength = '학습 지속 능력이 있어 준비를 시작하면 방향이 생깁니다';
      watchOut = '"완벽히 준비될 때까지"는 없습니다. 충분히 준비됐다의 기준을 작게 잡으세요';
      break;
  }

  let sajuInsight: string | null = null;
  if (sajuTraitEstimate && sajuTraitEstimate.confidence === 'estimated') {
    sajuInsight = sajuTraitEstimate.traitStory;
  }

  return { headline, decisionStyle, motivationDriver, strength, watchOut, sajuInsight };
}

export function generateNarrativeState(
  derived: DerivedVariables,
  form: FormData,
): NarrativeState {
  const { runwayMonths, burnoutRisk, jobDissatisfaction, marketReadiness, burnoutPressure, financialSafetyBase } = derived;
  const mr = Math.round((marketReadiness - 1) / 4 * 100);
  const bp = Math.round(burnoutPressure);
  const { growthPotential, organizationStress } = form.careerStatus;

  let headline: string;
  if (burnoutPressure >= 60)
    headline = `피로도(${bp}/100)가 높아 어떤 결정을 내려도 실행력이 떨어질 수 있는 상태입니다`;
  else if (jobDissatisfaction >= 3.5 && growthPotential <= 2)
    headline = `직무 불만족과 성장 경로 부재가 동시에 작용하고 있습니다`;
  else if (jobDissatisfaction >= 3.5)
    headline = `현재 환경에서의 만족도가 유지하기 어려운 수준까지 낮아졌습니다`;
  else if (jobDissatisfaction >= 3)
    headline = `현재 환경에 대한 만족도가 낮아지고 있는 시점입니다`;
  else if (marketReadiness < 2.5)
    headline = `변화 의지는 있지만 이직 경쟁력(${mr}/100)을 먼저 높이는 것이 필요한 상태입니다`;
  else
    headline = `지금은 급격한 변화보다 방향 조정이 필요한 시기입니다`;

  const parts: string[] = [];
  if (burnoutRisk >= 3.5 && organizationStress >= 4)
    parts.push(`조직 스트레스(${organizationStress}/5)와 번아웃이 함께 올라오는 것은 단순 피로가 아니라 환경 미스매치의 신호입니다 — 노력해도 에너지가 보충되지 않는 구조입니다`);
  else if (burnoutRisk >= 3.5)
    parts.push(`번아웃이 기준치를 넘고 있다는 것은 소모 속도가 회복 속도를 추월했다는 의미입니다. 더 열심히 해서 해결되는 문제가 아닙니다`);
  if (jobDissatisfaction >= 3 && growthPotential <= 2)
    parts.push(`직무 불만족과 성장 경로 부재가 겹치면 "노력해도 앞으로 나아가지 못한다"는 느낌이 쌓입니다 — 이건 환경 구조의 문제입니다`);
  else if (jobDissatisfaction >= 3)
    parts.push(`직무 만족도 저하는 단순 기분의 문제가 아닙니다. 현재 환경과의 맞지 않음이 누적되어 신호로 나타나는 것입니다`);
  if (runwayMonths < 3)
    parts.push(`재무 런웨이(${runwayMonths.toFixed(1)}개월)가 짧아 선택지에 현실적 제약이 생기는 상황입니다`);
  else if (financialSafetyBase >= 50)
    parts.push(`재무 여건(런웨이 ${runwayMonths.toFixed(1)}개월)은 확보되어 있어 조급하게 결정할 필요는 없습니다`);

  const rootCause = parts.length > 0
    ? parts.join('. ') + '.'
    : `현재 환경과의 맞지 않음이 서서히 쌓이고 있습니다. 긴급한 위기 신호는 없지만 방향을 점검하는 것이 중요한 시점입니다.`;

  // Implication describes what the current state MEANS — not what to DO (that is the Strategy section's role).
  const implication = burnoutPressure >= 60
    ? `에너지 소모 속도가 회복 속도를 추월한 상태입니다. 이 조건에서는 어떤 실행도 효과가 반감됩니다`
    : mr >= 50 && jobDissatisfaction >= 3
      ? `이직 경쟁력(${mr}/100)은 갖춰져 있는데 불만족이 지속되고 있습니다. 역량이 환경에 맞지 않는 상태일 가능성이 높습니다`
      : mr < 45
        ? `변화 의지가 있지만 현재 이직 경쟁력(${mr}/100)이 그 의지를 뒷받침하기에는 아직 부족한 상태입니다`
        : `지금은 급격한 변화보다 방향 조정이 더 필요한 시점입니다`;

  return { headline, rootCause, implication };
}

export function generateNarrativeCoreStrategy(
  strategy: DecisionStrategy,
  expertInterpretation: ExpertInterpretation,
  actionPlanDetailed: ActionPlanDetailed,
): NarrativeCoreStrategy {
  return {
    integrated:   strategy.primaryStrategy,
    rationale:    expertInterpretation.interpretation,
    keyAction:    actionPlanDetailed.week1.task,
    evidenceTags: expertInterpretation.evidenceTags,
  };
}

// ─── Master calculate ─────────────────────────────────────────────────────────

export function calculateResults(form: FormData): Results {
  const derived = calculateDerivedVariables(form);

  // Classify gate FIRST — needed to (a) resolve dynamic primary key and
  // (b) inject gate-mandatory options into scoring before calculateOptionScores runs.
  const decisionGate = classifyCareerDecision(derived, form);
  const flowType     = calculateFlowType(form);

  // Resolve the dynamic primary option for this gate + current state.
  // recovery-first: "recover while working" (stay) is default; restAfterQuit only
  // when burnout is severe (≥75) AND runway allows it (≥6 months).
  const resolvedPrimaryKey = resolveGatePrimaryKey(
    decisionGate.decisionClass,
    derived.burnoutPressure,
    derived.runwayMonths,
  );

  // Ensure gate-mandatory primary option is always scored even if user didn't select it.
  // Without this, assignOptionRoles can't assign 'primary' role and Step4 shows wrong option.
  const needsGateInjection =
    resolvedPrimaryKey != null &&
    form.selectedOptions.length > 0 &&
    !form.selectedOptions.includes(resolvedPrimaryKey);
  const rawScores = calculateOptionScores(
    needsGateInjection
      ? { ...form, selectedOptions: [...form.selectedOptions, resolvedPrimaryKey] as OptionKey[] }
      : form,
  );

  // Step 1 — apply gate bonuses (positive and negative).
  // Negative bonuses for recovery/hold gates hard-block aggressive options from ranking #1.
  const bonusMap = GATE_BONUS[decisionGate.decisionClass] ?? {};
  let scores: OptionScore[] = rawScores.map(s => {
    const bonus = bonusMap[s.key] ?? 0;
    return bonus !== 0 ? { ...s, totalScore: clamp(s.totalScore + bonus) } : s;
  });

  // Step 2 — apply two-tier burnout execution gate (hard block ≥80 / downgrade 65-79).
  scores = applyRecoveryModeOverrides(scores, derived.burnoutPressure);

  // Step 3 — apply non-linear financial gate for runway < 3 months.
  // This is the hardest constraint: small penalties alone are insufficient.
  scores = applyFinancialGateOverrides(scores, derived.runwayMonths);

  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  // bestKey is gate-adjusted: the archetype's primary option naturally ranks #1.
  const bestKey = sorted[0]?.key ?? 'stay';

  const globalWarnings: string[] = [];
  if (form.careerStatus.organizationStress === 5 && form.careerStatus.burnout === 5) {
    globalWarnings.push('현재 스트레스와 번아웃이 모두 매우 높습니다. 장기 지속보다는 회복 전략 또는 환경 전환 검토가 필요합니다.');
  }
  if (derived.runwayMonths < 3) {
    globalWarnings.push('재무 런웨이가 3개월 미만입니다. 퇴사·창업 등 소득 단절형 결정은 현재 시점에서 매우 위험합니다. 소득 유지가 최우선입니다.');
  }

  // Validation: if fatigue is "주의" or worse (burnoutPressure > 50) and the top option
  // is still an aggressive execution path, surface a guard warning.
  const AGGRESSIVE_OPTIONS: OptionKey[] = ['startupFreelance', 'careerSwitch'];
  if (derived.burnoutPressure > 50 && AGGRESSIVE_OPTIONS.includes(bestKey)) {
    globalWarnings.push('피로도가 주의 수준입니다. 높은 에너지가 필요한 전략은 상태 점검 후에 실행하세요.');
  }

  const birthYearNum = parseInt(form.timing.birthYear, 10);
  const sajuTraitEstimate: SajuTraitEstimate | null =
    !isNaN(birthYearNum) && birthYearNum >= 1930 && birthYearNum <= 2010
      ? estimateTraitsFromSaju(birthYearNum)
      : null;

  const timingAnalysis        = generateTimingAnalysis(form, derived);
  const sajuTimingLayer       = calculateSajuTimingLayer(form, bestKey, derived);
  const confidence            = calculateConfidence(sorted, derived);
  const confidenceExplanation = generateConfidenceExplanation(sorted, derived);
  const combinedRecommendation = generateCombinedRecommendation(sorted, derived, decisionGate.decisionClass);
  const bridgeMessage         = generateBridgeMessage(decisionGate.decisionClass, bestKey, sorted, derived);
  // Pass form and decisionClass so recovery/hold gates get the correct plan.
  const actionPlanDetailed    = generateActionPlanDetailed(bestKey, form, decisionGate.decisionClass);
  const expertInterpretation  = generateExpertInterpretation(bestKey, form, derived);

  // Build strategy first so stateTimingLevel is available for persona generation.
  const strategy = buildDecisionStrategy(
    sorted, decisionGate.decisionClass, decisionGate.archetypeLabel,
    bridgeMessage, timingAnalysis, sajuTimingLayer, sajuTraitEstimate,
    confidence, confidenceExplanation,
    derived.burnoutPressure, derived, form.selectedOptions,
    resolvedPrimaryKey,   // dynamic primary key (e.g. stay vs restAfterQuit for recovery-first)
  );

  // Compute careerDiagnosis before personality story so executionMode is available.
  const careerDiagnosis = generateCareerDiagnosis(derived, form, sajuTraitEstimate);
  const stateTimingLevel = strategy.timingAdvice.stateTimingLevel;

  // Personality story and narrative persona are now derived from strategy — not raw traits.
  const personalityStory = generatePersonalityStory(
    decisionGate.decisionClass,
    careerDiagnosis.executionMode,
    stateTimingLevel,
    sajuTraitEstimate,
  );

  return {
    derived,
    scores: sorted,
    flowType,
    globalWarnings,
    actionPlan:           generateActionPlan(bestKey),
    actionPlanDetailed,
    analysisReport:       generateAnalysisReport(bestKey, form, derived, sorted),
    confidence,
    confidenceExplanation,
    confidenceLabel: computeConfidenceLabel(confidence, sorted[0]?.totalScore - (sorted[1]?.totalScore ?? 0), derived),
    timingAnalysis,
    sajuTimingLayer,
    archetypeLabel:       decisionGate.archetypeLabel,
    gaugeScore:           calculateGaugeScore(derived),
    oneLineInsight:       generateOneLineInsight(bestKey, derived),
    expertInterpretation,
    decisionGate,
    sajuTraitEstimate,
    personalityStory,
    combinedRecommendation,
    bridgeMessage,
    strategy,
    narrativePersona:      generateNarrativePersona(derived, form, decisionGate.decisionClass, sajuTraitEstimate, stateTimingLevel),
    narrativeState:        generateNarrativeState(derived, form),
    narrativeCoreStrategy: generateNarrativeCoreStrategy(strategy, expertInterpretation, actionPlanDetailed),
    careerDiagnosis,
    sajuPersonaMVP:        computeSajuPersonaMVP(form, sajuTraitEstimate),
  };
}

// Expose audit utility in browser console (dev builds)
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.runDecisionAudit = runDecisionStrategyAudit;
}
