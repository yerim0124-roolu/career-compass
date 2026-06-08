// Career Compass 2.0 — solution module engine.
// Deterministic, no LLM, no UI. Classifies a "current-state intervention strategy"
// (MainType), infers support tags, and selects 1–2 concrete solution modules with a
// 30-day plan. This is the "what to do now" layer that sits ABOVE the recommendation.
//
// Hard principle (inherited from the gate engine): reality owns timing. Classification
// is priority-ordered so energy/runway constraints win before identity-state. The
// MainType never changes the core recommendation — it only frames and routes action.

import type {
  CareerVector,
  CareerVectorKey,
  ConstructProfile,
  ReadinessGates,
  ResultMode,
  ActionReadiness,
  CareerOptionKey,
  OptionReadiness,
  MainTypeKey,
  SupportTagKey,
  SolutionModuleKey,
  SolutionLayer,
  MeasuredSignals,
  ThirtyDayExperiment,
  ReevaluationCriteria,
  MoveRecommendation,
  ReversalRule,
  ReversalConditions,
  ExecutionPlan,
  ExecutionWeekStep,
  CoreExperiment,
  ActiveLenses,
  SafetyBridge,
  DirectionToValidate,
} from '../types/careerCompass.ts';
import { MAIN_TYPE_LABELS, SUPPORT_TAG_LABELS } from '../types/careerCompass.ts';
import { SOLUTION_MODULES, MAIN_TYPE_STRATEGY, MAIN_TYPE_CONTEXT_NOTE } from '../data/solutionModules.ts';
import { CONTEXT_REEVAL_CRITERIA } from './readinessGateEngine.ts';
import { resolveExternalSignalCopy } from './careerConstructEngine.ts';

// ─── Thresholds (aligned with the existing engines) ───────────────────────────
const V_HIGH = 60;   // vector axis "high" (normalized 0–100)
const V_MOD = 45;    // vector axis "moderately present"
const C_HIGH = 66;   // construct "high" (matches careerConstructEngine HIGH)
const C_PRESENT = 50;// construct "notable" (matches PRESENT)
const C_LOW = 33;    // construct "low" (matches LOW)

export interface SolutionOptionFit {
  optionKey: CareerOptionKey;
  fit: number;
}

export interface SolutionInputs {
  vector: CareerVector;
  construct: ConstructProfile;
  gates: ReadinessGates;
  optionFits: SolutionOptionFit[]; // fit-desc sorted (rankCareerOptions order)
  resultMode: ResultMode;
  actionReadiness: ActionReadiness;
  measured: MeasuredSignals;       // which ambiguous low-signals were actually probed
  // P1.2 — explicit-direction inputs for the lowOptionVisibility guards. Both default to
  // "not present" so older callers (tests with crafted construct profiles) keep working.
  preferredExperimentOptionKey?: CareerOptionKey; // user's chosen 30-day experiment (ap_* → option)
  noOptionsExplicit?: boolean;                    // true iff the user picked rc_opt_few on rc_options
}

// gate-level helpers
const energyLow = (g: ReadinessGates) => g.energy === 'depleted' || g.energy === 'strained';
const energyOk = (g: ReadinessGates) => g.energy === 'steady' || g.energy === 'capacity' || g.energy === 'high';
const runwayLow = (g: ReadinessGates) => g.runway === 'critical' || g.runway === 'tight' || g.runway === 'unknown';
const runwayOk = (g: ReadinessGates) => g.runway === 'moderate' || g.runway === 'comfortable' || g.runway === 'extended';
const riskLow = (g: ReadinessGates) => g.risk === 'none' || g.risk === 'timeOnly';
const validationLow = (g: ReadinessGates) => g.marketValidation === 'unvalidated' || g.marketValidation === 'early';

// ─── Identity-axis ordering (mirror of resultSpineEngine.IDENTITY_AXES) ──────
// Kept local to avoid a cross-engine import cycle. The two lists must stay in sync.
const IDENTITY_AXES: CareerVectorKey[] = [
  'expertise', 'autonomy', 'marketOrientation', 'creativity', 'analysisOrientation',
  'ventureOrientation', 'executionDrive', 'impactOrientation', 'stability',
];

// ─── P1: Active conditional theory lenses ────────────────────────────────────
// Each lens gates a slice of result copy. Derived from existing measurements only
// (vector / CDDQ / gates / mainType / bestMove); no new questions or constructs.
//
//   essentialism        → "줄이기/좁히기" copy + essentialist closing
//   range               → 2-axis identity statement + composer chip
//   plannedHappenstance → 선택지 발굴 / Hope-Theory framing + optionGeneration closing
//   jobCrafting         → 현직 재설계 / role-redesign module routing
export interface DeriveActiveLensesInputs {
  vector: CareerVector;
  construct: ConstructProfile;
  gates: ReadinessGates;
  mainTypeKey: MainTypeKey;
  bestMoveKey: CareerOptionKey;
  topFit: number;
}

export function deriveActiveLenses(inp: DeriveActiveLensesInputs): ActiveLenses {
  const v = inp.vector, c = inp.construct, g = inp.gates;

  // Essentialism: only when there's something to subtract — overload or value conflict.
  const essentialism =
    c.difficulty.optionOverload >= C_PRESENT ||
    c.difficulty.valueConflict >= C_PRESENT;

  // Range: top two identity axes are both substantively present and close enough
  // (within 25 points), AND the first axis is itself genuinely high (≥ V_HIGH = 60),
  // AND the mainType isn't one where Range copy would be off-topic.
  // P1.1 — burnout users need energy framing, lowOpt users need option-generation framing;
  // a "you have multiple identities" lens distracts from the binding need in both.
  const sortedAxes = [...IDENTITY_AXES].sort((a, b) => v[b] - v[a] || IDENTITY_AXES.indexOf(a) - IDENTITY_AXES.indexOf(b));
  const firstVal = v[sortedAxes[0]];
  const secondVal = v[sortedAxes[1]];
  const axisRangeOk = firstVal >= V_HIGH && secondVal >= 50 && (firstVal - secondVal) < 25;
  const mainTypeAllowsRange = inp.mainTypeKey !== 'overloadedBurnout' && inp.mainTypeKey !== 'lowOptionVisibility';
  const range = axisRangeOk && mainTypeAllowsRange;

  // Planned Happenstance: follow the lowOptionVisibility classifier exactly. The earlier
  // soft-trio fallback (low goalClarity + low curiosity + low identity pull + low topFit)
  // was a hedge for cases the classifier might miss; P1.2 plumbed an explicit rc_opt_few
  // signal which makes the classifier authoritative. Falling back to the lens mirroring
  // the classifier keeps the closing-line / contextNote / lens reads consistent with the
  // assigned mainType.
  const plannedHappenstance = inp.mainTypeKey === 'lowOptionVisibility';

  // Job Crafting: the user has a stable base to redesign and isn't depleted.
  const energyForRedesign = g.energy === 'steady' || g.energy === 'capacity' || g.energy === 'high';
  const jobCrafting =
    inp.mainTypeKey === 'restlessStabilizer' ||
    inp.mainTypeKey === 'plateauedPerformer' ||
    (energyForRedesign && v.stability >= 55 && inp.bestMoveKey === 'stayRedesign');

  return { essentialism, range, plannedHappenstance, jobCrafting };
}

// ─── P1: Closing-line resolver (3 variants) ─────────────────────────────────
// Replaces the previously mainType-keyed MAIN_TYPE_CLOSING_LINE map. Variant pick
// order: plannedHappenstance → essentialist → actionType (default).
export const CLOSING_LINES = {
  essentialist: '이번 달은 더 늘리기보다, 중요한 후보를 2~3개로 정리하는 것만으로 충분합니다.',
  actionType: '이번 달은 완성보다, 작은 실험으로 한 줄의 신호를 남기면 충분합니다.',
  optionGeneration: '이번 달은 결론을 내리지 않아도 됩니다. 해볼 만한 후보가 2개만 생겨도 충분합니다.',
  // P1.5 — recovery variant. Used whenever the user's binding constraint is energy:
  // mainTypeKey === 'overloadedBurnout' OR planModule === 'recoveryFirst'. Takes priority
  // over essentialism lens (an option-overloaded burnt-out user gets the recovery closing,
  // not the "정리" closing).
  recovery: '이번 달은 새 판을 벌이지 않고, 에너지·생활 리듬부터 돌려놓으면 충분합니다.',
} as const;

// P1.4 — when the user is on a validation-strategy mainType (unvalidatedAspirant),
// the essentialist "subtract" framing fights the strategy ("validate first"). Force
// actionType ("작은 실험으로 한 줄의 신호") which matches the strategy. Validation users
// commonly trigger the essentialism lens via optionOverload from cs_between/cs_many, so
// the gate alone isn't enough.
//
// P1.5 — burnout/recovery invariant added at the TOP of the resolver: when the user's
// binding constraint is energy (mainType === 'overloadedBurnout' OR planModule ===
// 'recoveryFirst'), force the recovery closing regardless of any other lens. Previously
// a burnout user with high optionOverload (e.g. cs_many) would still fire essentialist;
// that contradicted both the strategy ("회복") and the weekly plan (recoveryFirst).
export function resolveClosingLine(
  lenses: ActiveLenses,
  mainTypeKey?: MainTypeKey,
  planModuleKey?: SolutionModuleKey,
): string {
  if (mainTypeKey === 'overloadedBurnout' || planModuleKey === 'recoveryFirst') return CLOSING_LINES.recovery;
  if (lenses.plannedHappenstance) return CLOSING_LINES.optionGeneration;
  if (mainTypeKey === 'unvalidatedAspirant') return CLOSING_LINES.actionType;
  if (lenses.essentialism) return CLOSING_LINES.essentialist;
  return CLOSING_LINES.actionType;
}

// P1.4 — module-aligned strategy statements. Used when the executionPlan's planModule
// differs from the mainType's primaryModule (e.g. P1.2 widening routed a plateaued user
// into roleRedesign because they picked ap_redesign). Pre-P1.4 the strategyStatement
// stayed mainType-keyed ("자산화"), which contradicted the now-roleRedesign plan.
// This map is only consulted when planModule overrides primaryModule; otherwise
// MAIN_TYPE_STRATEGY stays authoritative.
export const MODULE_STRATEGY: Partial<Record<SolutionModuleKey, string>> = {
  roleRedesign: '지금 자리에서 역할·방식을 작게 바꿔보고 효과를 볼 때예요.',
  portfolioConvert: '실력은 쌓였지만, 그걸 밖이 읽을 수 있는 자산으로 정리할 때예요.',
  runwayStabilizer: '런웨이를 먼저 안정화하고 다음 도전을 다시 그릴 때예요.',
  contentEngine: '콘텐츠를 작게 발행해 실제 반응을 확인할 때예요.',
  marketTest: '실제 반응부터 30일 안에 확인할 때예요.',
  independentPilot: '독립을 작은 파일럿 한 건으로 테스트할 때예요.',
  recoveryFirst: '지금은 새 판을 벌이기보다 에너지를 먼저 회복할 때예요.',
  optionNarrowing: '관심은 많지만 흩어져 있어, 후보를 좁히고 검증할 때예요.',
  opportunityGeneration: '지금은 선택지를 좁힐 때가 아니라, 보이지 않던 선택지를 더 보이게 할 때예요.',
};

// ─── 1. Main type classification (priority-ordered; first match wins) ──────────
// Order encodes the reality-first principle: gate constraints (burnout, runway) are
// evaluated before decision-difficulty, which is evaluated before identity-state.

export function classifyMainType(inp: SolutionInputs): MainTypeKey {
  const { vector: v, construct: c, gates: g } = inp;
  const topOption = inp.optionFits[0]?.optionKey;

  // P1 — burnout / overload. Energy reality overrides everything else.
  if (energyLow(g) || v.recoveryNeed >= V_HIGH || c.difficulty.readinessGap >= C_HIGH) {
    return 'overloadedBurnout';
  }

  // P2 — reality-locked: a real desire to build/independent, blocked by runway/risk.
  const highDesire = topOption === 'startup' || topOption === 'independent' || v.ventureOrientation >= V_HIGH || v.autonomy >= V_HIGH;
  if ((runwayLow(g) || riskLow(g)) && c.scct.contextualBarrier >= C_HIGH && highDesire) {
    return 'realityLocked';
  }

  // P3 — low option visibility: the user doesn't have too many options; they don't see any. This
  // catches a state Essentialism/Working Identity can MISS (their action-first frame assumes options
  // exist). Triggered before identity-state types so we don't false-positive into plateaued/restless/
  // leverageReady. Gated on: goal-clarity low + option-overload low + recovery not high + NO suppressed
  // identity pull (creativity/impact/autonomy all under MOD — distinguishes from restlessStabilizer's
  // suppressed-axis state) + at least one signal of perceived no-options.
  //
  // P1.2 tightening: the original gate over-fired for stable/expertise-rooted users (job-changers,
  // office workers, licensed professionals) who picked an experiment that *implies* a visible
  // direction. Two guards block the false-positives:
  //   Guard 1 (explicit experiment): if the user chose an experiment whose home option is a
  //   direction-implying move (ap_redesign/profile/portfolio/writing/content/interview), don't
  //   classify as lowOpt UNLESS they ALSO said rc_opt_few (i.e. "even with this experiment in mind,
  //   I still see no clear options").
  //   Guard 2 (stability/expertise base): if v.stability ≥ 55 AND v.expertise ≥ V_MOD, only allow
  //   lowOpt when the user explicitly said rc_opt_few AND did NOT pick a visible-direction experiment.
  // ap_rest → restRecover and ap_unsure (no mapping) do NOT count as visible-direction.
  const lowIdentityPull = v.creativity < V_MOD && v.impactOrientation < V_MOD && v.autonomy < V_MOD;
  const topFit = inp.optionFits[0]?.fit ?? 0;
  const VISIBLE_DIRECTION_EXPERIMENTS: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
    'stayRedesign', 'jobChange', 'advisoryTeaching', 'investAnalysis', 'contentBrand', 'startup', 'independent',
  ]);
  const hasVisibleDirectionExperiment =
    !!inp.preferredExperimentOptionKey && VISIBLE_DIRECTION_EXPERIMENTS.has(inp.preferredExperimentOptionKey);
  const explicitNoOptions = inp.noOptionsExplicit === true;
  const stabilityBase = v.stability >= 55 && v.expertise >= V_MOD;

  // Guard 1: experiment with visible direction → only allow lowOpt when user explicitly said "no options".
  const guard1Blocks = hasVisibleDirectionExperiment && !explicitNoOptions;
  // Guard 2: stable/expert base → only allow lowOpt when explicit no-options AND no visible-direction experiment.
  const guard2Blocks = stabilityBase && !(explicitNoOptions && !hasVisibleDirectionExperiment);
  if (
    c.scct.goalClarity <= C_LOW &&
    c.difficulty.optionOverload <= C_LOW &&
    v.recoveryNeed < V_HIGH &&
    lowIdentityPull &&
    (topFit < 55 || c.difficulty.selfInformationGap >= C_PRESENT || c.adaptability.curiosity <= C_LOW) &&
    !guard1Blocks &&
    !guard2Blocks
  ) {
    return 'lowOptionVisibility';
  }

  // P4 — conflicted at a fork: the user can't set decision criteria between paths.
  // A *high* valueConflict (≥C_HIGH) is itself a direct, sufficient signal of a fork
  // conflict ("기준이 안 선다" + "의미 vs 돈" 류 반응이 쌓인 상태). The MCDA tradeoff is a
  // corroborator, not a hard gate: requiring it caused valueConflict=80 users whose
  // money/impact priorities weren't ranked top to fall through to unvalidatedAspirant,
  // skipping the "선택 기준 정리" solution they most need. So: high valueConflict alone,
  // OR a moderate valueConflict backed by a real MCDA tradeoff → conflictedAtFork.
  const mcdaConflict = c.mcda.financialSafety >= C_PRESENT && (c.mcda.impact >= C_PRESENT || c.mcda.autonomy >= C_PRESENT);
  // A strong, converged venture pull (ventureOrientation ≥ V_HIGH) is the unvalidatedAspirant
  // signature — they know WHAT they want to build, they just haven't validated it. That is
  // NOT a fork conflict even when valueConflict is high, so it must not capture the
  // high-valueConflict-alone branch (let it fall through to unvalidatedAspirant below).
  const convergedMakerPull = v.ventureOrientation >= V_HIGH;
  if (
    (c.difficulty.valueConflict >= C_HIGH && !convergedMakerPull) ||
    (c.difficulty.valueConflict >= C_PRESENT && mcdaConflict)
  ) {
    return 'conflictedAtFork';
  }

  // P4 — scattered explorer: too many options + high curiosity + unclear goal.
  if (c.difficulty.optionOverload >= C_HIGH && c.adaptability.curiosity >= 60 && c.scct.goalClarity <= C_LOW) {
    return 'scatteredExplorer';
  }

  // P5 — unvalidated aspirant: venture/creative/market pull but no market signal yet.
  const makerPull = v.ventureOrientation >= V_HIGH || v.creativity >= 55 || v.marketOrientation >= V_HIGH;
  if (makerPull && validationLow(g) && c.difficulty.marketInformationGap >= C_PRESENT) {
    return 'unvalidatedAspirant';
  }

  // P6 — plateaued performer: deep expertise + high self-efficacy, but low clarity / no option B.
  if (
    v.expertise >= V_HIGH &&
    c.scct.selfEfficacy >= C_HIGH &&
    (c.scct.goalClarity <= C_LOW || c.adaptability.curiosity <= C_LOW) &&
    c.difficulty.optionOverload <= C_LOW
  ) {
    return 'plateauedPerformer';
  }

  // P7 — restless stabilizer: stable & resourced, not burnt out, but a suppressed axis.
  const suppressedPull = v.creativity >= V_MOD || v.impactOrientation >= V_MOD || v.autonomy >= V_MOD;
  if (v.stability >= 55 && energyOk(g) && runwayOk(g) && c.scct.goalClarity <= C_LOW && suppressedPull) {
    return 'restlessStabilizer';
  }

  // P8 — default: leverage-ready (also the explicit "ready + validated" actionable case).
  return 'leverageReady';
}

// ─── 2. Support tags (orthogonal modifiers; strongest 2–3) ─────────────────────

interface TagCandidate { key: SupportTagKey; on: boolean; strength: number; }

export function inferSupportTags(inp: SolutionInputs, max = 3): SupportTagKey[] {
  const { vector: v, construct: c, gates: g, measured: m } = inp;

  const candidates: TagCandidate[] = [
    {
      key: 'recognitionSensitive',
      on: v.impactOrientation >= V_HIGH || c.mcda.impact >= C_HIGH,
      strength: Math.max(v.impactOrientation, c.mcda.impact),
    },
    {
      key: 'independenceLeaning',
      on: v.autonomy >= V_HIGH || c.mcda.autonomy >= C_HIGH,
      strength: Math.max(v.autonomy, c.mcda.autonomy),
    },
    {
      key: 'marketOriented',
      on: v.marketOrientation >= 55 && v.analysisOrientation >= 55,
      strength: Math.round((v.marketOrientation + v.analysisOrientation) / 2),
    },
    {
      key: 'creativeExpressive',
      on: v.creativity >= 55,
      strength: v.creativity,
    },
    {
      // measured-only: explicit low loss tolerance (gate) or a high financial-safety
      // priority (MCDA ranking). NOT inferred from a 0 riskTolerance score — 0 means
      // "no risk-seeking signal", which is unmeasured/neutral, not risk-averse.
      key: 'riskAverse',
      on: riskLow(g) || c.mcda.financialSafety >= C_HIGH,
      strength: Math.max(g.risk === 'none' ? 90 : g.risk === 'timeOnly' ? 70 : 0, c.mcda.financialSafety),
    },
    {
      // measured-only: an explicit barrier reading or an explicit low runway answer.
      // 'unknown' runway is absence of info (the default), not a constraint → excluded.
      key: 'externalConstraint',
      on: c.scct.contextualBarrier >= C_HIGH || g.runway === 'critical' || g.runway === 'tight',
      strength: Math.max(c.scct.contextualBarrier, g.runway === 'critical' ? 80 : g.runway === 'tight' ? 65 : 0),
    },
    {
      // measured-only: self-efficacy / confidence must have been actually probed AND read
      // low. A 0 from an unanswered question is unmeasured, not low — it never fires here.
      key: 'lowSelfTrust',
      on: (m.selfEfficacy && c.scct.selfEfficacy <= C_LOW) || (m.confidence && c.adaptability.confidence <= C_LOW),
      strength: Math.max(
        m.selfEfficacy && c.scct.selfEfficacy <= C_LOW ? 100 - c.scct.selfEfficacy : 0,
        m.confidence && c.adaptability.confidence <= C_LOW ? 100 - c.adaptability.confidence : 0,
      ),
    },
    {
      key: 'selfInsightGap',
      on: c.difficulty.selfInformationGap >= C_PRESENT,
      strength: c.difficulty.selfInformationGap,
    },
    {
      key: 'marketInsightGap',
      on: c.difficulty.marketInformationGap >= C_PRESENT,
      strength: c.difficulty.marketInformationGap,
    },
    {
      key: 'highDrive',
      on: v.executionDrive >= V_HIGH && (g.energy === 'capacity' || g.energy === 'high') && c.adaptability.control >= 60,
      strength: Math.round((v.executionDrive + c.adaptability.control) / 2),
    },
  ];

  const order = candidates.map((t) => t.key); // declared order = deterministic tiebreak
  return candidates
    .filter((t) => t.on)
    .sort((a, b) => b.strength - a.strength || order.indexOf(a.key) - order.indexOf(b.key))
    .slice(0, max)
    .map((t) => t.key);
}

// ─── 3. Solution module selection (1–2: primary + optional secondary) ──────────

const TYPE_MODULES: Record<MainTypeKey, [SolutionModuleKey, SolutionModuleKey]> = {
  overloadedBurnout: ['recoveryFirst', 'roleRedesign'],
  realityLocked: ['runwayStabilizer', 'roleRedesign'],
  lowOptionVisibility: ['opportunityGeneration', 'strengthsReflection'],
  conflictedAtFork: ['valueTradeoffMapping', 'optionNarrowing'],
  scatteredExplorer: ['optionNarrowing', 'marketTest'],
  unvalidatedAspirant: ['marketTest', 'contentEngine'],
  plateauedPerformer: ['portfolioConvert', 'contentEngine'],
  restlessStabilizer: ['roleRedesign', 'contentEngine'],
  leverageReady: ['independentPilot', 'marketTest'],
};

// Action-oriented types where a confidence gap warrants a small-wins secondary.
const ACTION_TYPES: ReadonlySet<MainTypeKey> = new Set<MainTypeKey>([
  'leverageReady', 'restlessStabilizer', 'unvalidatedAspirant', 'scatteredExplorer',
]);

export function selectSolutionModules(mainType: MainTypeKey, tags: SupportTagKey[]): SolutionModuleKey[] {
  let mods: SolutionModuleKey[] = [...TYPE_MODULES[mainType]];

  // Tag-driven adjustments (keep the primary's intent; bias the secondary).
  if (mainType === 'unvalidatedAspirant') {
    if (tags.includes('creativeExpressive')) mods = ['contentEngine', 'marketTest'];
    else if (tags.includes('independenceLeaning')) mods = ['marketTest', 'independentPilot'];
  }
  // A strong confidence gap on an action-type: surface small-wins as the secondary.
  if (tags.includes('lowSelfTrust') && ACTION_TYPES.has(mainType)) {
    mods = [mods[0], 'confidenceBuilder'];
  }

  // dedupe, keep at most 2
  const seen = new Set<SolutionModuleKey>();
  return mods.filter((m) => (seen.has(m) ? false : (seen.add(m), true))).slice(0, 2);
}

// ─── 4. Next actions (first 3 concrete steps of the primary module) ────────────

export function buildNextActions(primaryKey: SolutionModuleKey): string[] {
  return SOLUTION_MODULES[primaryKey].plan.slice(0, 3).map((s) => s.action);
}

// ─── 5. Orchestration ──────────────────────────────────────────────────────────

export function buildSolutionLayer(inp: SolutionInputs): SolutionLayer {
  const mainTypeKey = classifyMainType(inp);
  const supportTags = inferSupportTags(inp);
  const moduleKeys = selectSolutionModules(mainTypeKey, supportTags);
  const primaryModule = SOLUTION_MODULES[moduleKeys[0]];
  const secondaryModule = moduleKeys[1] ? SOLUTION_MODULES[moduleKeys[1]] : null;

  return {
    mainTypeKey,
    mainTypeLabel: MAIN_TYPE_LABELS[mainTypeKey],
    strategyStatement: MAIN_TYPE_STRATEGY[mainTypeKey],
    supportTags,
    primaryModule,
    secondaryModule,
    nextActions: buildNextActions(moduleKeys[0]),
  };
}

// ─── 6. Execution plan assembly (merges module + experiment + reeval + bridge) ──
// Produces one coherent monthly plan. The (plan) module dominates structure; the
// user-chosen 30-day experiment becomes the single core bet; re-evaluation attaches at
// the end; a safety-bridge dual thread surfaces only when the now-move is a bridge.

// A chosen experiment option's "home" module, when one exists 1:1 (else diagnosed module leads).
const EXPERIMENT_HOME_MODULE: Record<CareerOptionKey, SolutionModuleKey | null> = {
  contentBrand: 'contentEngine',
  startup: 'marketTest',
  independent: 'independentPilot',
  restRecover: 'recoveryFirst',
  stayRedesign: 'roleRedesign',
  jobChange: 'runwayStabilizer',
  advisoryTeaching: null, // no 1:1 module → diagnosed module dominates, experiment folds in
  // P1.3 — investAnalysis (글·리포트·메모) now maps to portfolioConvert so a writing-oriented
  // user gets writing-aligned weekly steps (성과 추리기 → 케이스 정리 → 외부 공개)
  // instead of the interview-heavy marketTest fallback.
  investAnalysis: 'portfolioConvert',
};

const SAFETY_BRIDGE_KEYS: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>(['stayRedesign', 'jobChange', 'restRecover']);
const BRIDGE_WHY: Partial<Record<CareerOptionKey, string>> = {
  jobChange: '수입·안정을 지키며',
  stayRedesign: '지금 자리를 지키며',
  restRecover: '에너지를 회복하며',
};
const READINESS_LABEL: Record<OptionReadiness, string> = {
  now: '지금', prepareAfter: '준비 후', conditional: '조건부', pause: '보류',
};

const dedupe = (xs: string[]): string[] => {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
};

// P1.4 — reframe a success-signal noun phrase as a reeval question.
// Used when plan and experiment decouple so the reeval describes the actual planModule
// the user executed. Verbal nouns ("줄어듦", "생김", "완성") get past-tense + "~는지";
// quantified phrases ("1건 이상") get a soft "~인지" suffix.
function reframeAsReevalQuestion(signal: string): string {
  const t = signal.trim();
  if (t.endsWith('지') || t.endsWith('했나')) return t; // already a question
  // Verbal-noun patterns (most → past + 는지)
  if (t.endsWith('줄어듦')) return t.slice(0, -3) + '줄어들었는지';
  if (t.endsWith('늘어남')) return t.slice(0, -3) + '늘어났는지';
  if (t.endsWith('생김')) return t.slice(0, -2) + '생겼는지';
  if (t.endsWith('보임')) return t.slice(0, -2) + '보였는지';
  if (t.endsWith('바뀜')) return t.slice(0, -2) + '바뀌었는지';
  if (t.endsWith('됨')) return t.slice(0, -1) + '됐는지';
  // Sino-Korean verbal nouns (suffix '했는지')
  if (t.endsWith('착수')) return t + '했는지';
  if (t.endsWith('체감')) return t + '했는지';
  if (t.endsWith('점검')) return t + '했는지';
  if (t.endsWith('상승')) return t + '했는지';
  if (t.endsWith('진술')) return t + '했는지';
  // Sino-Korean verbal nouns (suffix '됐는지')
  if (t.endsWith('완성') || t.endsWith('확보') || t.endsWith('도출') || t.endsWith('확인')) return t + '됐는지';
  if (t.endsWith('축소') || t.endsWith('정리') || t.endsWith('확장')) return t + '됐는지';
  // Quantified phrases ("1건 이상", "3개 이상") → soft "인지"
  if (t.endsWith('이상')) return t + '인지';
  // Generic fallback
  return t + '인지';
}

// Semantic-ish dedupe: signals that fall into the same Korean keyword bucket are
// collapsed to one — the more concrete/actionable phrasing wins. Order-preserving.
// 'reaction' is listed before 'paid' so "저장·공유·문의" reads as a reaction, not a sale.
const SIGNAL_BUCKETS: { key: string; kws: string[] }[] = [
  { key: 'reaction',     kws: ['저장', '공유', '조회', '팔로우', '인용', '반응'] },
  { key: 'paid',         kws: ['유료', '결제', '가격', '단가', '계약', '수주', '문의'] },
  { key: 'pattern',      kws: ['반복', '패턴', '일관'] },
  { key: 'energy',       kws: ['에너지', '회복', '수면', '의욕', '기분'] },
  { key: 'satisfaction', kws: ['만족', '성장', '역할'] },
  { key: 'interview',    kws: ['인터뷰', '고객'] },
  { key: 'runway',       kws: ['런웨이', 'runway', '재정', '손실', '비상금', '저축'] },
  { key: 'job',          kws: ['공고', '면접', '이직'] },
];

const bucketOf = (s: string): string | null => {
  for (const b of SIGNAL_BUCKETS) if (b.kws.some((k) => s.includes(k))) return b.key;
  return null;
};

// More concrete = has a number/threshold (인터뷰 10명 이상 > 인터뷰를 했는지).
const concreteness = (s: string): number => {
  let score = /\d/.test(s) ? 2 : 0;
  for (const m of ['이상', '건', '명', '개', '회', '단가', '계약']) if (s.includes(m)) score += 1;
  return score;
};

// Collapse same-bucket items to the most concrete; keep un-bucketed items as-is; cap.
function semanticDedupe(items: string[], max: number): string[] {
  const best = new Map<string, string>();
  for (const it of items) {
    const b = bucketOf(it);
    if (b === null) continue;
    const cur = best.get(b);
    if (!cur || concreteness(it) > concreteness(cur)) best.set(b, it);
  }
  const out: string[] = [];
  const usedBucket = new Set<string>();
  const seen = new Set<string>();
  for (const it of items) {
    const b = bucketOf(it);
    if (b === null) {
      if (!seen.has(it)) { out.push(it); seen.add(it); }
    } else if (!usedBucket.has(b)) {
      const pick = best.get(b)!;
      if (!seen.has(pick)) { out.push(pick); seen.add(pick); usedBucket.add(b); }
    }
  }
  return out.slice(0, max);
}

function formatReevalDate(now: Date, days: number): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${days}일 후 (${iso})`;
}

// Inverse of EXPERIMENT_HOME_MODULE: a module's representative option (cognitive modules
// like optionNarrowing/valueTradeoffMapping/confidenceBuilder/portfolioConvert have none).
const MODULE_TO_OPTION: Partial<Record<SolutionModuleKey, CareerOptionKey>> = {
  contentEngine: 'contentBrand',
  marketTest: 'startup',
  independentPilot: 'independent',
  recoveryFirst: 'restRecover',
  roleRedesign: 'stayRedesign',
  runwayStabilizer: 'jobChange',
};

export interface ExecutionPlanInputs {
  solutionLayer: SolutionLayer;
  thirtyDayExperiment: ThirtyDayExperiment;
  reevaluationCriteria: ReevaluationCriteria;
  currentBestMove: MoveRecommendation;
  strategicDirection: MoveRecommendation | null;
  prepareAfterOption: MoveRecommendation | null;
  conditionalOption: MoveRecommendation | null;
  reversalConditions: ReversalConditions;
  gates: ReadinessGates; // for energy-aware stop/pivot copy
  preferredExperimentLabel?: string; // general output-format label (de-biased coreExperiment copy)
  now?: Date; // injected for deterministic date labels in tests
  // P1 — lens inputs (vector + construct + topFit) so activeLenses can be derived inside.
  vector: CareerVector;
  construct: ConstructProfile;
  topFit: number; // fit score of the top-ranked option (0–100)
}

// Experiments that gather real market signal (interview / publish / sell / report).
const MARKET_VALIDATION_EXPERIMENTS: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
  'startup', 'independent', 'contentBrand', 'advisoryTeaching', 'investAnalysis',
]);

// P1.7 — burnout overrides for the execution plan. When the classifier landed on
// overloadedBurnout, the user's binding constraint is energy — any "do something now"
// experiment they picked (interview, content, portfolio, …) gets remapped to rest so
// strategy + plan + experiment + reeval all speak the same language. Without this, a
// burnt-out user who clicked ap_interview under pressure would still see 10-interview
// weekly steps next to a recovery bestMove and recovery closing — internally split.
const BURNOUT_CORE_EXPERIMENT_LABEL = '2주 회복 루틴으로 에너지·생활 리듬부터 회복하기';
const BURNOUT_CORE_EVIDENCE: ReadonlyArray<string> = ['에너지가 회복되는지', '다시 떠오르는 관심 주제가 있는지'];

export function buildExecutionPlan(inp: ExecutionPlanInputs): ExecutionPlan {
  const sl = inp.solutionLayer;
  const primaryModule = sl.primaryModule;
  // P1.7 — burnout invariant: remap sourceOptionKey to 'restRecover' so home routing
  // (→ recoveryFirst), reeval keying, and successSignals all flip to recovery semantics.
  // The user's original ap_experiment choice is honored only when burnout is NOT classified.
  const isBurnoutType = sl.mainTypeKey === 'overloadedBurnout';
  const sourceOptionKey: CareerOptionKey = isBurnoutType
    ? 'restRecover'
    : (inp.thirtyDayExperiment.id.replace(/^exp-/, '') as CareerOptionKey);

  // Rule 0 — planModule: honor the user-chosen experiment's home module when it's in the
  // diagnosed main-type's module family (user tactic leads); else the diagnosed primary.
  //
  // P1.2 widening: if the user's experiment matches the now-move (sourceOptionKey ===
  // bestMove.optionKey), trust the home module even when it's outside the type's default
  // family. This is what makes "I want to redesign my role" (ap_redesign → stayRedesign)
  // produce a roleRedesign weekly plan for a plateauedPerformer whose default family would
  // otherwise be portfolioConvert/contentEngine. The classifier and the best-move both agree
  // with the user's experiment, so the plan should follow.
  const home = EXPERIMENT_HOME_MODULE[sourceOptionKey];
  // P1.3 — routing layers (priority high → low):
  //   1. Decision-difficulty types (scatteredExplorer / conflictedAtFork): the binding
  //      constraint is narrowing / value clarification, regardless of what experiment the
  //      user picked. Force the type's primary module so the plan addresses the root cause.
  //   2. Otherwise honor the experiment's home module when set (widened from P1.2). This
  //      ensures e.g. ap_writing (investAnalysis → portfolioConvert) overrides the
  //      diagnosed marketTest family for unvalidatedAspirant — the user explicitly chose a
  //      writing-aligned experiment, so the weekly plan should be writing-aligned too.
  //   3. Fall back to the diagnosed primaryModule.
  // P1.4 — lowOptionVisibility is ALSO a decision-difficulty type. The user explicitly
  // said "no visible options" → forcing the type's primary (opportunityGeneration) prevents
  // a bestMove fallback (e.g. ap_unsure → stayRedesign → roleRedesign) from hijacking the
  // weekly plan with an irrelevant module.
  const DECISION_DIFFICULTY_TYPES: ReadonlySet<MainTypeKey> = new Set<MainTypeKey>([
    'scatteredExplorer', 'conflictedAtFork', 'lowOptionVisibility',
  ]);
  const planModuleKey: SolutionModuleKey =
    DECISION_DIFFICULTY_TYPES.has(sl.mainTypeKey)
      ? primaryModule.key
      : home
        ? home
        : primaryModule.key;
  const planModule = SOLUTION_MODULES[planModuleKey];

  // Rule 2 — core experiment = the user's chosen 30-day experiment (absorbs thirtyDayExperiment).
  const interviewExperiment = sourceOptionKey === 'startup';
  // Copy fix 2: when the now-move is expert advisory/lecture and the experiment is customer
  // interviews, retitle so the interview clearly serves advisory demand (not generic validation).
  // P1.7 — burnout overrides label/evidence to recovery semantics (the user's original
  // experiment choice is intentionally discarded; the binding constraint is energy).
  const coreLabel = isBurnoutType
    ? BURNOUT_CORE_EXPERIMENT_LABEL
    : inp.currentBestMove.optionKey === 'advisoryTeaching' && interviewExperiment
      ? '전문 자문/강의 주제가 실제 수요가 있는지 10명에게 확인하기'
      : inp.preferredExperimentLabel ?? inp.thirtyDayExperiment.label;
  const coreExperiment: CoreExperiment = {
    label: coreLabel,
    evidenceToCheck: isBurnoutType ? [...BURNOUT_CORE_EVIDENCE] : inp.thirtyDayExperiment.evidenceToCheck,
    sourceOptionKey,
  };
  // Copy fix 1: in 갈림길 결정형 (conflictedAtFork), the strategy is "decide your criteria" but the
  // experiment may be customer interviews — bridge the gap so the user sees why it helps.
  const coreExperimentBridge = sl.mainTypeKey === 'conflictedAtFork' && MARKET_VALIDATION_EXPERIMENTS.has(sourceOptionKey)
    ? '고를 기준을 머릿속에서만 정하지 말고, 실제 반응을 기준으로 좁혀보는 단계입니다.'
    : undefined;

  // Rule 4 — safety bridge + direction to validate (only when a gated direction exists and
  // the now-move is a low-risk bridge). They are complementary, not competing.
  let safetyBridge: SafetyBridge | undefined;
  let directionToValidate: DirectionToValidate | undefined;
  if (inp.strategicDirection && inp.currentBestMove.readiness === 'now' && SAFETY_BRIDGE_KEYS.has(inp.currentBestMove.optionKey)) {
    safetyBridge = { label: inp.currentBestMove.label, why: BRIDGE_WHY[inp.currentBestMove.optionKey] ?? '지금의 안정을 지키며' };
    directionToValidate = { label: inp.strategicDirection.label, readinessLabel: READINESS_LABEL[inp.strategicDirection.readiness] };
  }

  // Rule 5 — secondary hint: planModule == diagnosed primary → engine's secondary;
  // planModule overridden → surface the diagnosed primary as the alternative tactic. Never a 2nd plan.
  const hintKey: SolutionModuleKey | undefined =
    planModule.key === primaryModule.key ? sl.secondaryModule?.key : primaryModule.key;
  const secondaryModuleHint = hintKey
    ? `여력이 되면 '${SOLUTION_MODULES[hintKey].title}'도 이어볼 수 있어요.`
    : undefined;

  const weeklyActions: ExecutionWeekStep[] = planModule.plan.map((s) => ({ week: s.week, action: s.action }));

  // P2 — success signals: merge module signals + experiment evidence, then semantic-dedupe
  // (same-bucket → keep the most concrete), capped at 3. Stop/pivot capped at 3.
  const successSignals = semanticDedupe([...planModule.successSignals, ...coreExperiment.evidenceToCheck], 3);
  let stopOrPivotCriteria = dedupe(planModule.stopPivot).slice(0, 3);

  // Copy fix 3: when energy is fine and the move isn't recovery, stop/pivot copy shouldn't jump
  // to "에너지/회복 문제". Drop those clauses and, if removed, swap in decision-criteria language.
  const energyOk = inp.gates.energy === 'steady' || inp.gates.energy === 'capacity' || inp.gates.energy === 'high';
  if (energyOk && inp.currentBestMove.optionKey !== 'restRecover') {
    const cleaned = stopOrPivotCriteria.filter((s) => !/에너지|회복/.test(s));
    if (cleaned.length < stopOrPivotCriteria.length) {
      const valueConflictStop = interviewExperiment
        ? '인터뷰를 해도 선택지가 줄지 않으면, 정보 부족보다 우선순위 기준이나 가치 충돌을 다시 점검합니다.'
        : '실험을 해봐도 선택지가 줄지 않으면, 정보 부족보다 우선순위 기준이나 가치 충돌을 다시 점검합니다.';
      stopOrPivotCriteria = [...cleaned, valueConflictStop].slice(0, 3);
    }
  }

  // P1 — reevaluation aligned with the CORE EXPERIMENT (what the user is actually doing),
  // not the best move. Keyed by the chosen experiment's option. When a safety bridge exists,
  // the bridge contributes at most ONE secondary check. Capped at 4.
  //
  // P1.4 — when home(sourceOptionKey) decouples from planModule (e.g. A2 scatteredExplorer
  // + ap_unsure: sourceOptionKey=jobChange fallback, planModule=optionNarrowing via P1.3
  // override), the experiment's CONTEXT_REEVAL would describe jobChange ("공고·면접") even
  // though the actual plan is narrowing. Derive reeval from planModule.successSignals
  // (reframed as "~했는지") so reeval matches the plan the user is actually executing.
  const expHome = EXPERIMENT_HOME_MODULE[sourceOptionKey];
  const planDecoupledFromExperiment = expHome !== planModule.key && expHome !== null;
  const noHomeMatch = expHome === null && planModule.key !== primaryModule.key;
  let reevaluationChecklist: string[];
  if (sl.mainTypeKey === 'lowOptionVisibility') {
    // For lowOptionVisibility the user has no specific option to re-check yet; reuse the plan
    // module's success signals reframed as "~했는지" questions so the reeval matches reality.
    reevaluationChecklist = [
      '해볼 만한 후보가 2개 이상 생겼는지',
      '다음 달 작게 시도할 후보 1개가 보이는지',
      '"아무것도 없다"에서 "이 정도는 해볼 수 있다"로 감각이 바뀌었는지',
    ];
  } else if (planDecoupledFromExperiment || noHomeMatch) {
    // P1.4 — plan and experiment decoupled. Reframe planModule.successSignals as
    // reevaluation questions so what the user re-checks matches what they actually did.
    reevaluationChecklist = dedupe(planModule.successSignals.map(reframeAsReevalQuestion)).slice(0, 4);
  } else {
    const experimentReeval = CONTEXT_REEVAL_CRITERIA[sourceOptionKey] ?? [];
    if (safetyBridge) {
      const bridgeReeval = CONTEXT_REEVAL_CRITERIA[inp.currentBestMove.optionKey] ?? [];
      reevaluationChecklist = dedupe([...experimentReeval.slice(0, 3), ...bridgeReeval.slice(0, 1)]).slice(0, 4);
    } else {
      reevaluationChecklist = dedupe(experimentReeval).slice(0, 4);
    }
  }

  // P4 — promotion conditions: keep only options the user has already seen in context
  // (strategic direction / prepare-after / conditional / the hinted module's option), so a
  // contextless option never appears as a "would rise to #1" surprise. Capped at 2.
  const contextual = new Set<CareerOptionKey>();
  if (inp.strategicDirection) contextual.add(inp.strategicDirection.optionKey);
  if (inp.prepareAfterOption) contextual.add(inp.prepareAfterOption.optionKey);
  if (inp.conditionalOption) contextual.add(inp.conditionalOption.optionKey);
  const hintOption = hintKey ? MODULE_TO_OPTION[hintKey] : undefined;
  if (hintOption) contextual.add(hintOption);
  const promotionConditions: ReversalRule[] = inp.reversalConditions.promotionConditions
    .filter((r) => contextual.has(r.promoteTo))
    .slice(0, 2);

  // P1 — derive active lenses + resolve external-signal copy for the marketInsightGap support tag.
  const activeLenses = deriveActiveLenses({
    vector: inp.vector,
    construct: inp.construct,
    gates: inp.gates,
    mainTypeKey: sl.mainTypeKey,
    bestMoveKey: inp.currentBestMove.optionKey,
    topFit: inp.topFit,
  });
  const signal = resolveExternalSignalCopy({
    mainTypeKey: sl.mainTypeKey,
    bestMoveKey: inp.currentBestMove.optionKey,
    // P1.1: surface "실제 반응 확인 필요" when the user's strategic direction OR chosen
    // experiment is market-facing, even if the now-move is a non-market safety bridge.
    strategicDirectionKey: inp.strategicDirection?.optionKey,
    coreExperimentSourceKey: sourceOptionKey,
    gates: inp.gates,
  });
  // P1.3 — burnout users shouldn't see "선택지 정보 보강 필요" / "실제 반응 확인 필요" chips;
  // their binding constraint is energy, not information. Drop marketInsightGap entirely.
  // (P1.7 — isBurnoutType is now hoisted to the top of buildExecutionPlan; reuse it.)
  const supportTagLabels = sl.supportTags
    .filter((t) => !(isBurnoutType && t === 'marketInsightGap'))
    .map((t) => (t === 'marketInsightGap' ? signal.shortLabel : SUPPORT_TAG_LABELS[t]));

  // P1.4 — when planModule was widened (different from the type's primaryModule), use
  // a module-aligned strategy statement so the headline matches the weekly plan. The
  // mainType's strategy stays the default when planModule didn't override (no widening).
  //
  // Decision-difficulty types (scatteredExplorer / conflictedAtFork / lowOptionVisibility)
  // keep their mainType-specific strategy regardless — the framing matters for the user's
  // self-narrative (Hope Theory for lowOpt, optionNarrowing for scattered/conflicted) and
  // shouldn't be overridden by what their experiment happened to be.
  const planModuleWidened = planModule.key !== primaryModule.key;
  const preserveMainTypeStrategy = DECISION_DIFFICULTY_TYPES.has(sl.mainTypeKey);
  const moduleStrategy = (planModuleWidened && !preserveMainTypeStrategy) ? MODULE_STRATEGY[planModule.key] : undefined;
  let alignedStrategyStatement = moduleStrategy ?? sl.strategyStatement;

  // P1.6 — specific cross-product strategy for (unvalidatedAspirant × portfolioConvert).
  // This pair fires when an unvalidated user picks ap_writing → investAnalysis →
  // portfolioConvert home. Both the assetization frame (plan) and the validation frame
  // (mainType) matter — neither alone reads correctly. Combine them into one sentence.
  if (sl.mainTypeKey === 'unvalidatedAspirant' && planModule.key === 'portfolioConvert') {
    alignedStrategyStatement = '먼저 경험과 성과를 밖에서도 읽히는 형태로 정리하고, 그 결과물로 작은 반응을 확인할 때예요.';
  }

  return {
    strategyStatement: alignedStrategyStatement,
    mainTypeLabel: sl.mainTypeLabel,
    supportTagLabels,
    coreExperiment,
    coreExperimentBridge,
    safetyBridge,
    directionToValidate,
    weeklyActions,
    successSignals,
    stopOrPivotCriteria,
    reevaluationDateLabel: formatReevalDate(inp.now ?? new Date(), inp.reevaluationCriteria.reviewAfterDays),
    reevaluationChecklist,
    promotionConditions,
    closingLine: resolveClosingLine(activeLenses, sl.mainTypeKey, planModule.key),
    mainTypeContextNote: MAIN_TYPE_CONTEXT_NOTE[sl.mainTypeKey],
    activeLenses,
    secondaryModuleHint,
  };
}
