// Career Compass 2.0 — readiness gate decision logic.
// Deterministic, no LLM, no UI. Converts the four readiness gates + a per-option
// risk profile into a practical decision-timing label: now / prepareAfter /
// conditional / pause. This layer is what keeps the product a decision-support
// tool rather than a personality quiz.
//
// All thresholds are explicit constants documented inline.

import type {
  CareerOptionKey,
  RunwayGate,
  ReadinessGates,
  GateKey,
  OptionReadiness,
  ReversalRule,
  ReversalCondition,
  ReevaluationCriteria,
} from '../types/careerCompass.ts';
import { CAREER_OPTION_LABELS } from '../types/careerCompass.ts';

// ─── Per-option risk profile ──────────────────────────────────────────────────
// Used together with the readiness gates to classify timing. Maps the 7 product
// option concepts (current_role_redesign, job_change, expert_content, advisory,
// independent_work, venture_building, recovery_reset) onto CareerOptionKey, plus
// investAnalysis (투자/분석/리포트) which shares the content/advisory risk shape.

export type ProfileLevel = 'low' | 'medium' | 'high';
export type FeedbackSpeed = 'fast' | 'medium' | 'slow';

export interface CareerOptionRiskProfile {
  executionLoad: ProfileLevel;          // how demanding to execute
  financialRisk: ProfileLevel;          // income/capital exposure
  marketValidationRequired: ProfileLevel; // how much external validation it needs first
  reversibility: ProfileLevel;          // high = easy to back out of
  timeToFeedback: FeedbackSpeed;        // how fast you learn if it works
}

export const RISK_PROFILES = {
  // current_role_redesign — keep income, reshape the role
  stayRedesign:     { executionLoad: 'medium', financialRisk: 'low',    marketValidationRequired: 'low',    reversibility: 'high',   timeToFeedback: 'fast' },
  // job_change
  jobChange:        { executionLoad: 'medium', financialRisk: 'low',    marketValidationRequired: 'low',    reversibility: 'medium', timeToFeedback: 'medium' },
  // venture_building
  startup:          { executionLoad: 'high',   financialRisk: 'high',   marketValidationRequired: 'high',   reversibility: 'low',    timeToFeedback: 'slow' },
  // independent_work
  independent:      { executionLoad: 'high',   financialRisk: 'high',   marketValidationRequired: 'high',   reversibility: 'medium', timeToFeedback: 'medium' },
  // expert_content
  contentBrand:     { executionLoad: 'medium', financialRisk: 'low',    marketValidationRequired: 'high',   reversibility: 'high',   timeToFeedback: 'slow' },
  // advisory — P3.11: marketValidation medium→high. 자문/강의는 '내 전문성에 돈·시간을
  // 쓸 사람이 있나'가 본질이라 검증 의존도가 contentBrand(high)와 같다. medium이던 탓에
  // 검증 안 된 전문직에게 즉시 1순위로 튀어나오던 과잉 편향을 교정 — 검증 전엔 conditional.
  advisoryTeaching: { executionLoad: 'medium', financialRisk: 'low',    marketValidationRequired: 'high',   reversibility: 'high',   timeToFeedback: 'medium' },
  // investAnalysis (added; not in the original 7 — content/advisory-shaped)
  investAnalysis:   { executionLoad: 'medium', financialRisk: 'low',    marketValidationRequired: 'high',   reversibility: 'high',   timeToFeedback: 'slow' },
  // recovery_reset
  restRecover:      { executionLoad: 'low',    financialRisk: 'medium', marketValidationRequired: 'low',    reversibility: 'high',   timeToFeedback: 'fast' },
} as const satisfies Record<CareerOptionKey, CareerOptionRiskProfile>;

// ─── Gate thresholds (explicit & documented) ─────────────────────────────────
// energy / riskTolerance / marketValidation are 0–100 self-reports (higher = better);
// runway is in months. Cutoffs are inclusive of the lower bound.

export function evaluateEnergyGate(energy0to100: number) {
  if (energy0to100 < 20) return 'depleted' as const;  // severe burnout
  if (energy0to100 < 40) return 'strained' as const;
  if (energy0to100 < 60) return 'steady' as const;
  if (energy0to100 < 80) return 'capacity' as const;
  return 'high' as const;
}

export function evaluateRunwayGate(runwayMonths: number | null): RunwayGate {
  if (runwayMonths === null) return 'unknown'; // not provided → treated conservatively downstream
  if (runwayMonths < 1) return 'critical';
  if (runwayMonths < 3) return 'tight';
  if (runwayMonths < 6) return 'moderate';
  if (runwayMonths < 12) return 'comfortable';
  return 'extended';
}

export function evaluateRiskGate(riskTolerance0to100: number) {
  if (riskTolerance0to100 < 20) return 'none' as const;
  if (riskTolerance0to100 < 40) return 'timeOnly' as const;
  if (riskTolerance0to100 < 60) return 'smallCost' as const;
  if (riskTolerance0to100 < 80) return 'experiment' as const;
  return 'incomeDrop' as const;
}

export function evaluateMarketValidationGate(validation0to100: number) {
  if (validation0to100 < 25) return 'unvalidated' as const;
  if (validation0to100 < 50) return 'early' as const;
  if (validation0to100 < 75) return 'partial' as const;
  return 'validated' as const;
}

export interface ReadinessSignals {
  energy: number;            // 0–100
  runwayMonths: number | null;
  riskTolerance: number;     // 0–100
  marketValidation: number;  // 0–100
}

export function evaluateReadinessGates(signals: ReadinessSignals): ReadinessGates {
  return {
    energy: evaluateEnergyGate(signals.energy),
    runway: evaluateRunwayGate(signals.runwayMonths),
    risk: evaluateRiskGate(signals.riskTolerance),
    marketValidation: evaluateMarketValidationGate(signals.marketValidation),
  };
}

// ─── Decision timing classification ───────────────────────────────────────────
// Constraints set a "ceiling" on how ready an option can be. The final timing is
// the most restrictive ceiling. Identity fit can never raise timing above a
// constraint ceiling (principle: fit must not override energy/runway reality).

const TIMING_ORDER = ['pause', 'prepareAfter', 'conditional', 'now'] as const satisfies readonly OptionReadiness[];
const timingIndex = (t: OptionReadiness): number => TIMING_ORDER.indexOf(t);

const GATE_BLOCK_TEXT: Record<GateKey, string> = {
  energy: '에너지 회복 필요',
  runway: '재정 런웨이 부족',
  risk: '리스크 감내 여력 부족',
  marketValidation: '시장 검증 필요',
};

export interface DecisionTimingResult {
  optionKey: CareerOptionKey;
  timing: OptionReadiness;
  bindingConstraints: GateKey[]; // gates that pulled timing below "now"
  rationale: string;
}

export function classifyDecisionTiming(
  optionKey: CareerOptionKey,
  gates: ReadinessGates,
  opts: { identityFit?: number } = {},
): DecisionTimingResult {
  // Recovery is the special case: low energy makes it the RIGHT move now, not a blocked one.
  if (optionKey === 'restRecover') return classifyRecovery(gates);

  const profile = RISK_PROFILES[optionKey];
  const ceilings: { gate: GateKey; cap: OptionReadiness }[] = [];

  // P1 — energy vs execution load. Severe burnout cannot host high-execution "now".
  if (gates.energy === 'depleted') {
    ceilings.push({ gate: 'energy', cap: profile.executionLoad === 'high' ? 'pause' : 'prepareAfter' });
  } else if (gates.energy === 'strained') {
    if (profile.executionLoad === 'high') ceilings.push({ gate: 'energy', cap: 'prepareAfter' });
    else if (profile.executionLoad === 'medium') ceilings.push({ gate: 'energy', cap: 'conditional' });
  }

  // P2 — runway vs financial risk. Low runway blocks resignation/founding/independent "now".
  // Unknown runway is treated as "tight" (conservative) and surfaced in reevaluation criteria.
  const runwayLevel: RunwayGate = gates.runway === 'unknown' ? 'tight' : gates.runway;
  if (profile.financialRisk !== 'low') {
    if (runwayLevel === 'critical') {
      ceilings.push({ gate: 'runway', cap: profile.financialRisk === 'high' ? 'pause' : 'prepareAfter' });
    } else if (runwayLevel === 'tight') {
      ceilings.push({ gate: 'runway', cap: profile.financialRisk === 'high' ? 'prepareAfter' : 'conditional' });
    } else if (runwayLevel === 'moderate' && profile.financialRisk === 'high') {
      ceilings.push({ gate: 'runway', cap: 'conditional' });
    }
  }

  // P3 — risk tolerance vs financial risk. Low tolerance downgrades high-risk options.
  if (profile.financialRisk !== 'low') {
    if (gates.risk === 'none') {
      ceilings.push({ gate: 'risk', cap: profile.financialRisk === 'high' ? 'pause' : 'prepareAfter' });
    } else if (gates.risk === 'timeOnly') {
      ceilings.push({ gate: 'risk', cap: profile.financialRisk === 'high' ? 'prepareAfter' : 'conditional' });
    } else if (gates.risk === 'smallCost' && profile.financialRisk === 'high') {
      ceilings.push({ gate: 'risk', cap: 'conditional' });
    }
  }

  // P4 — market validation need. Founding/independent/content/advisory monetization that
  // needs validation, when not yet validated, is "conditional" (not "now").
  // (P3.11: no option carries 'medium' anymore — advisory moved to 'high'.)
  if (profile.marketValidationRequired === 'high' && (gates.marketValidation === 'unvalidated' || gates.marketValidation === 'early')) {
    ceilings.push({ gate: 'marketValidation', cap: 'conditional' });
  }

  // Resolve: most restrictive ceiling wins. Identity fit cannot lift above it.
  let resultIdx = timingIndex('now');
  const binding: GateKey[] = [];
  for (const c of ceilings) {
    if (!binding.includes(c.gate)) binding.push(c.gate);
    const capIdx = timingIndex(c.cap);
    if (capIdx < resultIdx) resultIdx = capIdx;
  }
  const timing = TIMING_ORDER[resultIdx];

  return { optionKey, timing, bindingConstraints: binding, rationale: buildRationale(timing, binding, opts.identityFit) };
}

function classifyRecovery(gates: ReadinessGates): DecisionTimingResult {
  // Low/very-low energy → recovery is the now-move; ample energy → recovery isn't the priority.
  let timing: OptionReadiness;
  let rationale: string;
  if (gates.energy === 'depleted' || gates.energy === 'strained') {
    timing = 'now';
    rationale = '에너지 회복이 지금 가장 현실적인 선택.';
  } else if (gates.energy === 'steady') {
    timing = 'conditional';
    rationale = '회복과 탐색을 병행할 수 있는 상태.';
  } else {
    timing = 'pause';
    rationale = '에너지에 여력이 있어 지금 회복이 최우선은 아님.';
  }
  return { optionKey: 'restRecover', timing, bindingConstraints: ['energy'], rationale };
}

function buildRationale(timing: OptionReadiness, binding: GateKey[], identityFit?: number): string {
  if (timing === 'now') return '지금 실행 가능 — 주요 제약 없음.';
  const verdict = timing === 'pause' ? '지금은 보류' : timing === 'prepareAfter' ? '준비 후 실행' : '조건부 가능';
  const causes = binding.map((g) => GATE_BLOCK_TEXT[g]).join(', ');
  const prefix = identityFit !== undefined && identityFit >= 70 ? '정체성 적합도는 높지만, ' : '';
  return `${prefix}${causes} → ${verdict}.`;
}

// ─── Reversal conditions ──────────────────────────────────────────────────────
// What would have to change for this option to become #1. The conditions are the
// gates currently blocking it; clearing all of them promotes the option.

const REVERSAL_CONDITION_TEXT: Record<GateKey, string> = {
  energy: "번아웃을 회복해 에너지가 '보통' 이상으로 올라오면",
  runway: '6개월 이상 생활비 runway를 확보하면',
  risk: '3개월 실험 정도의 손실을 감당할 수 있게 되면',
  marketValidation: '관심 있는 사람 10명 중 5명 이상이 돈·시간을 써서라도 해결하려 한다고 확인하면',
};

export function generateReversalConditions(optionKey: CareerOptionKey, gates: ReadinessGates): ReversalRule[] {
  const result = classifyDecisionTiming(optionKey, gates);
  if (result.timing === 'now' || result.bindingConstraints.length === 0) return [];
  const conditions: ReversalCondition[] = result.bindingConstraints.map((g) => ({
    condition: REVERSAL_CONDITION_TEXT[g],
    gate: g,
  }));
  return [
    {
      // Documented rule: clearing every currently-binding constraint promotes the option to #1.
      ifMetCount: conditions.length,
      conditions,
      promoteTo: optionKey,
      promoteToLabel: CAREER_OPTION_LABELS[optionKey],
    },
  ];
}

// ─── 30-day reevaluation criteria ─────────────────────────────────────────────
// Always returns at least one criterion (turns a one-shot result into a returnable loop).

export interface ReevaluationContext {
  bestMoveKey?: CareerOptionKey;   // current best move — drives which criteria lead
  experimentKey?: CareerOptionKey; // chosen 30-day experiment (may differ from the best move)
}

const MARKET_FACING_OPTIONS: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
  'startup', 'independent', 'contentBrand', 'advisoryTeaching', 'investAnalysis',
]);

// Context criteria keyed by a career option. Used both for the raw reevaluationCriteria
// (keyed by best move) and, in the execution plan, keyed by the chosen core experiment
// so the 30-day return loop matches what the user is actually doing.
export const CONTEXT_REEVAL_CRITERIA: Record<CareerOptionKey, string[]> = {
  restRecover: ['회복 루틴 2주 후 에너지가 회복되었는지', '다시 일에 대한 관심·의욕이 돌아왔는지'],
  stayRedesign: ['업무량·근무 시간이 감당 가능한 수준으로 조정됐는지', '바꾸고 싶던 역할 1가지가 실제로 재설계됐는지'],
  jobChange: ['지원 가능한 공고·연결이 늘었는지', '서류·면접에서 연락·통과가 있었는지'],
  contentBrand: ['콘텐츠를 꾸준히(주 1회 이상) 발행했는지', '저장·공유·문의 등 반응이 늘었는지', '다루는 주제가 일관되게 모였는지'],
  advisoryTeaching: ['돈·시간을 써서라도 해결하려는 문의가 있었는지', '실제 니즈가 있는(자격 있는) 문의가 들어왔는지', '반복 가능한 자문 주제가 잡혔는지'],
  investAnalysis: ['리포트 조회·저장이 늘었는지', '피드백·인용·문의가 들어왔는지'],
  independent: ['유료 일감 문의·계약이 있었는지', '제시한 단가가 수용됐는지'],
  startup: ['관심 있는 사람 10명 이상과 충분히 대화/인터뷰했는지', '돈·시간을 써서라도 해결하려는 반응이 있었는지', '작은 시도·가설에 대한 피드백이 모였는지', 'runway(생활비 여유)가 6개월 이상으로 늘었는지'],
};

export function generateReevaluationCriteria(gates: ReadinessGates, ctx: ReevaluationContext = {}): ReevaluationCriteria {
  const criteria: string[] = [];
  const add = (c: string) => { if (!criteria.includes(c)) criteria.push(c); };

  // 1. Context criteria for the current best move lead the list.
  if (ctx.bestMoveKey) for (const c of CONTEXT_REEVAL_CRITERIA[ctx.bestMoveKey]) add(c);

  // 2. Real constraints are worth re-checking regardless of the chosen path.
  if (gates.energy === 'depleted' || gates.energy === 'strained') add('회복 루틴 2주 후 에너지가 회복되었는지');
  if (gates.runway === 'unknown') add('정확한 생활비 runway(개월 수)를 확인했는지');
  else if (gates.runway === 'critical' || gates.runway === 'tight') add('runway가 6개월 이상으로 늘었는지');
  if (gates.risk === 'none' || gates.risk === 'timeOnly') add('감당 가능한 손실 범위가 넓어졌는지');

  // 3. Generic market-signal check only when the path is market-facing. A non-market
  //    best move (e.g. restRecover, stayRedesign) suppresses it unless the user explicitly
  //    chose a market-facing 30-day experiment.
  const bestIsMarketFacing = ctx.bestMoveKey ? MARKET_FACING_OPTIONS.has(ctx.bestMoveKey) : false;
  const experimentIsMarketFacing = ctx.experimentKey ? MARKET_FACING_OPTIONS.has(ctx.experimentKey) : false;
  if (!bestIsMarketFacing && experimentIsMarketFacing && (gates.marketValidation === 'unvalidated' || gates.marketValidation === 'early')) {
    add('30일 실험에서 실제 반응(저장·문의·연락) 신호가 나왔는지');
  }

  // 4. Always at least one.
  if (criteria.length === 0) add('선택한 30일 실험의 핵심 지표가 기준을 넘었는지');

  return { reviewAfterDays: 30, criteria };
}
