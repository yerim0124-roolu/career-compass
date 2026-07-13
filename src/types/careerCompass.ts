// Career Compass 2.0 — domain foundation (types only).
// No UI, no LLM, no scoring logic here. Pure deterministic model definitions.
// 1.0 types in ../types.ts are untouched; 2.0 lives in this dedicated namespace.

// ─── Career Vector ──────────────────────────────────────────────────────────
// Accumulated from card/slider choices. Raw values accumulate, then normalize to
// 0–100 in the engine (Step 3). 13 axes describing career disposition.

export interface CareerVector {
  expertise: number;
  autonomy: number;
  stability: number;
  marketOrientation: number;
  creativity: number;
  analysisOrientation: number;
  ventureOrientation: number;
  executionDrive: number;
  impactOrientation: number;
  recoveryNeed: number;
  riskTolerance: number;
  financialReadiness: number;
  marketValidationNeed: number;
}

export type CareerVectorKey = keyof CareerVector;

// ─── Readiness Gates ────────────────────────────────────────────────────────
// Ordinal levels derived (by the engine) from low-friction reality-check band cards.
// Gates classify each career option into now / prepareAfter / pause and never
// come from free-text. The `*_ORDER` arrays encode ordinality so the engine can
// evaluate thresholds like "runway 6개월 이상" or "번아웃 40 이하" deterministically.

export type EnergyGate = 'depleted' | 'strained' | 'steady' | 'capacity' | 'high';
export type RunwayGate =
  | 'critical'    // <1개월
  | 'tight'       // 1–3개월
  | 'moderate'    // 3–6개월
  | 'comfortable' // 6–12개월
  | 'extended'    // 1년+
  | 'unknown';
export type RiskGate =
  | 'none'        // 거의 없음
  | 'timeOnly'    // 시간 일부
  | 'smallCost'   // 작은 비용
  | 'experiment'  // 3개월 실험
  | 'incomeDrop'; // 일정 기간 수입 감소도 가능
export type MarketValidationGate =
  | 'unvalidated' // 시장 반응을 아직 확인 못함
  | 'early'       // 초기 신호만
  | 'partial'     // 부분 검증
  | 'validated';  // 유료 의향 등 확인됨

export const ENERGY_ORDER = ['depleted', 'strained', 'steady', 'capacity', 'high'] as const satisfies readonly EnergyGate[];
export const RUNWAY_ORDER = ['critical', 'tight', 'moderate', 'comfortable', 'extended'] as const satisfies readonly RunwayGate[];
export const RISK_ORDER = ['none', 'timeOnly', 'smallCost', 'experiment', 'incomeDrop'] as const satisfies readonly RiskGate[];
export const MARKET_VALIDATION_ORDER = ['unvalidated', 'early', 'partial', 'validated'] as const satisfies readonly MarketValidationGate[];

export interface ReadinessGates {
  energy: EnergyGate;
  runway: RunwayGate;
  risk: RiskGate;
  marketValidation: MarketValidationGate;
}

export type GateKey = keyof ReadinessGates;

// A reality-check band card assigns gate levels directly (rather than vector points).
export interface GateAssignment {
  energy?: EnergyGate;
  runway?: RunwayGate;
  risk?: RiskGate;
  marketValidation?: MarketValidationGate;
}

// ─── Career Options & Archetypes ──────────────────────────────────────────────

export type CareerOptionKey =
  | 'stayRedesign'     // 현 직무 유지·재설계
  | 'jobChange'        // 이직
  | 'startup'          // 창업
  | 'independent'      // 프리랜스/독립
  | 'contentBrand'     // 콘텐츠/퍼스널 브랜드
  | 'advisoryTeaching' // 전문 자문/강의
  | 'investAnalysis'   // 투자/분석/리포트
  | 'orgLeadership'    // 조직 내 리더십·매니지먼트
  | 'restRecover';     // 휴식/재정비

export const CAREER_OPTION_LABELS = {
  stayRedesign: '현 직무 유지·재설계',
  jobChange: '이직',
  startup: '창업',
  independent: '프리랜스/독립',
  contentBrand: '콘텐츠/퍼스널 브랜드',
  advisoryTeaching: '전문 자문/강의',
  investAnalysis: '투자/분석/리포트',
  orgLeadership: '조직 내 리더십',
  restRecover: '휴식/재정비',
} as const satisfies Record<CareerOptionKey, string>;

// Korean archetype labels are the canonical vocabulary; used only as secondary
// tags under the main one-line identity axis (never as a standalone "you are X" headline).
export type CareerArchetype =
  | 'expertExpander'
  | 'marketInterpreter'
  | 'careerComposer'
  | 'problemFounder'
  | 'expertBuilder'
  | 'knowledgeTranslator'
  | 'expertAdvisor'
  | 'executionOperator'
  | 'recoveryFirst'
  | 'stableRedesigner';

export const ARCHETYPE_LABELS = {
  expertExpander: '전문성 확장가',
  marketInterpreter: '시장 해석가',
  careerComposer: '커리어 조합가',
  problemFounder: '문제 해결형 창업가',
  expertBuilder: '전문성 구축가',
  knowledgeTranslator: '지식 번역가',
  expertAdvisor: '전문 자문가',
  executionOperator: '실행 운영가',
  recoveryFirst: '회복 우선형',
  stableRedesigner: '안정 재설계형',
} as const satisfies Record<CareerArchetype, string>;

// ─── Theory-grounded construct profiles ──────────────────────────────────────
// Measured in parallel to CareerVector. SCCT (Lent/Brown/Hackett), Career
// Adaptability (Savickas), CDDQ (Gati), and MCDA priority weights. Cards feed
// these via constructEffects (separate from scoreEffects). Values normalize 0–100.

export interface SCCTProfile {
  selfEfficacy: number;        // "내가 잘 해낼 수 있다"
  outcomeExpectation: number;  // "잘하면 시장이 알아줄 것이다"
  goalClarity: number;         // 목표·방향의 또렷함
  contextualSupport: number;   // 외부 지지·여건(런웨이 등)
  contextualBarrier: number;   // 외부 제약(시간·재정·환경)
}

export interface CareerAdaptabilityProfile {
  concern: number;     // 미래를 내다보고 준비하는 정도
  control: number;     // 내 커리어를 스스로 통제한다는 감각
  curiosity: number;   // 탐색·실험 성향
  confidence: number;  // 문제를 풀어낼 수 있다는 자신감
}

export interface DecisionDifficultyProfile {
  readinessGap: number;          // 결정 준비 부족(동기·에너지)
  selfInformationGap: number;    // 자기 정보 부족(강점·선호)
  marketInformationGap: number;  // 시장 정보 부족(수요·반응)
  valueConflict: number;         // 가치 충돌(돈 vs 의미 등)
  optionOverload: number;        // 선택지 과잉
}

export interface MCDAWeights {
  identityFit: number;
  assetLeverage: number;
  marketPotential: number;
  energySustainability: number;
  financialSafety: number;
  autonomy: number;
  impact: number;
}

export interface ConstructProfile {
  scct: SCCTProfile;
  adaptability: CareerAdaptabilityProfile;
  difficulty: DecisionDifficultyProfile;
  mcda: MCDAWeights;
}

// Partial nested updates a card contributes to the construct profiles.
export interface ConstructEffects {
  scct?: Partial<SCCTProfile>;
  adaptability?: Partial<CareerAdaptabilityProfile>;
  difficulty?: Partial<DecisionDifficultyProfile>;
  mcda?: Partial<MCDAWeights>;
}

// ─── Evidence layer (theory-grounded explanation surfaced in the result) ──────

export type ActionReadiness = 'ready' | 'explore-with-structure' | 'stabilize-first';

export interface ConstructSignal {
  construct: string;            // framework-native name, e.g. "자기효능감" (theory section only)
  humanLabel: string;           // plain main-UI label, e.g. "실행 자신감"
  framework: string;            // e.g. "SCCT" (theory section only)
  level: 'high' | 'low';
  note: string;                 // plain explanation of meaning + effect
}

export interface ConfidenceDrivers {
  raised: string[];   // what raised confidence
  lowered: string[];  // what lowered it
}

// Banded confidence — the main display (numeric score stays secondary/hidden).
export type ConfidenceBand = '낮음' | '중간' | '높음' | '매우 높음';

export interface EvidenceLayer {
  theoryGroundedSummary: string;     // cites SCCT / 적응성 / CDDQ — collapsible theory section only
  narrative: string;                 // connected counseling paragraph (the main explanation)
  whyThisRecommendation: string[];   // plain reasons (kept as "근거 자세히 보기" details)
  constructSignals: ConstructSignal[];
  uncertaintySignals: string[];
  confidenceScore: number;           // 0–100 (secondary; band is the primary display)
  confidenceBand: ConfidenceBand;    // primary display: 낮음 / 중간 / 높음 / 매우 높음
  confidenceDrivers: ConfidenceDrivers; // what raised / lowered confidence
  confidenceNote: string;            // what the band means (+ how to increase / ready-but-low)
  contextualBarriers: string[];      // practical barriers (runway/energy/validation/...)
  missingInformation: string[];      // what would raise confidence
  actionReadiness: ActionReadiness;
}

// ─── Card-based Question Flow ─────────────────────────────────────────────────
// Principle: users tap/select/slide/rank, not write. Only optional_short_text
// allows typing, and it is never required.

export type QuestionInputType =
  | 'single_select'
  | 'multi_select'
  | 'forced_choice'
  | 'ranking'
  | 'slider_group'
  | 'optional_short_text';

export type FlowStage =
  | 'current_state'
  | 'attractive_roles'
  | 'core_values'
  | 'forced_choices'
  | 'reality_check'
  | 'option_reactions'
  | 'action_preferences';

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  tags: string[];
  // Points added to the career vector when chosen. Convention: small magnitudes
  // (~2–5) accumulate across choices; engine normalizes afterward.
  scoreEffects: Partial<CareerVector>;
  // Reality-check band cards set gate levels instead of (or alongside) vector points.
  gateAssignment?: GateAssignment;
  // Drives which career options this reaction nudges up/down (option_reactions stage).
  optionEffects?: Partial<Record<CareerOptionKey, number>>;
  // Theory-grounded construct contributions (SCCT / Adaptability / CDDQ / MCDA),
  // separate from scoreEffects so the construct model is measured independently.
  constructEffects?: ConstructEffects;
  followUpHint?: string;
}

export interface SliderDefinition {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  // Which vector axis this slider feeds (engine maps value → points). Optional
  // because some sliders feed gates/derived signals instead.
  vectorTarget?: CareerVectorKey;
  invert?: boolean; // true when a high slider value should lower the target axis
}

export interface QuestionStep {
  id: string;
  stage: FlowStage;
  inputType: QuestionInputType;
  title: string;                 // short heading (mobile-friendly)
  assistantPrompt: string;       // chat-style message shown above the cards
  helperText?: string;
  options?: ChoiceOption[];      // single_select / multi_select / forced_choice / ranking
  sliders?: SliderDefinition[];  // slider_group
  minSelect?: number;            // multi_select / ranking
  maxSelect?: number;            // multi_select
  optional?: boolean;            // optional_short_text (always skippable)
  // Live Insight: show a counseling-like interpretation after this step.
  // Target cadence is every 2–3 stages to avoid a dry-survey feel.
  liveInsightTrigger?: boolean;
}

// Captured answer for one step — the deterministic input the engine consumes.
export interface StepResponse {
  stepId: string;
  stage: FlowStage;
  selectedOptionIds?: string[];        // select / forced_choice / multi_select
  ranking?: string[];                  // ordered option ids (ranking)
  sliderValues?: Record<string, number>; // sliderId → value (slider_group)
  shortText?: string;                  // optional_short_text
}

// Mid-flow interpretation surfaced between steps (template-generated by the engine).
export interface LiveInsight {
  afterStepId: string;
  message: string;
}

// ─── Result Spine ─────────────────────────────────────────────────────────────
// The output must land on decision support, not a personality label. Identity is
// the hook; the bulk is options + reversal conditions + action + re-evaluation.

// 4 decision-timing labels (brief: 지금 / 준비 후 / 조건부 / 보류).
// 'conditional' = viable now only if specific conditions are met (drives reversalConditions).
export type OptionReadiness = 'now' | 'prepareAfter' | 'conditional' | 'pause';

export interface IdentityAxis {
  statement: string;            // main one-line center: "전문성을 시장 언어로 번역하는 사람"
  archetypeTags: CareerArchetype[]; // secondary tags only
}

export interface MoveRecommendation {
  optionKey: CareerOptionKey;
  label: string;
  readiness: OptionReadiness;
  rationale: string;            // deterministic, template-based "왜 지금 이 선택인지"
}

// One condition that, if met, pushes a different option toward #1.
export interface ReversalCondition {
  condition: string;            // e.g. "6개월 이상 생활비 runway 확보"
  gate?: GateKey;               // which gate this maps to (if any)
}

// "아래 조건 중 N개 이상 충족되면 X가 1순위로 올라갑니다" — positive evidence only.
export interface ReversalRule {
  ifMetCount: number;
  conditions: ReversalCondition[];   // positive evidence (metrics met, runway/energy improves, paid intent confirmed)
  promoteTo: CareerOptionKey;
  promoteToLabel: string;
}

// Negative evidence that should LOWER the current best move — never a promotion trigger.
export interface WarningCondition {
  signal: string;   // e.g. "선택한 30일 실험의 핵심 지표가 기대를 크게 밑돌면"
}

// Split so positive evidence can never be rendered under a downgrade sentence (or vice versa).
export interface ReversalConditions {
  promotionConditions: ReversalRule[];               // positive → an alternative rises to #1
  warningOrDowngradeConditions: WarningCondition[];  // negative → lower the current pick
}

export interface ThirtyDayExperiment {
  id: string;
  label: string;
  evidenceToCheck: string[];    // "30일 안에 확인할 증거"
}

// "30일 후 재판정 기준" — turns a one-shot result into a returnable loop (re-visit hook).
export interface ReevaluationCriteria {
  reviewAfterDays: number;      // default 30
  criteria: string[];           // what to re-check before re-running
}

// Optional, surfaced only AFTER the result if the user adds birth info.
// Hard rule: this never affects scoring or the recommendation.
export interface SajuLayer {
  available: boolean;
  timingPerspective: string;
  shareCardText: string;
  disclaimer: string;           // "핵심 추천 결과에는 영향을 주지 않습니다."
}

// How to frame the result:
//  - direct_now: the highest-fit option is also actionable now (no mismatch)
//  - conditional_led: highest-fit option is gated to 'conditional' (validate first); a safer bridge is the now move
//  - safety_bridge: highest-fit option needs more prep; a safer bridge is the now move
//  - recovery_first: recovery is the move
export type ResultMode = 'direct_now' | 'conditional_led' | 'recovery_first' | 'safety_bridge';

// ─── Solution Module layer ────────────────────────────────────────────────────
// A layer ABOVE the recommendation: "given the current state and constraints, what
// intervention strategy is valid right now". Distinct from CareerArchetype (which is
// a fixed-disposition identity tag) and from ResultMode (which only frames the
// recommendation). The main type is deliberately framed as a *current strategy*, not
// a personality verdict — the user-facing headline is a strategy statement, the type
// name is only a small secondary label. Gate reality (energy/runway) takes priority
// so this never overrides the timing authority of the readiness gates.

export type MainTypeKey =
  | 'overloadedBurnout'   // 과부하 소진형 — recovery first
  | 'realityLocked'       // 현실 조건 정비형 — runway/reality first
  | 'lowOptionVisibility' // 기회 탐색 부족형 — options not yet visible (PH/Strengths/Hope lens)
  | 'conflictedAtFork'    // 갈림길 결정형 — value tradeoff
  | 'scatteredExplorer'   // 탐색 과잉형 — narrow + test
  | 'unvalidatedAspirant' // 시장 미검증 도전형 — validate first
  | 'plateauedPerformer'  // 정체된 성실형 — asset conversion
  | 'restlessStabilizer'  // 안정 속 권태형 — low-risk redesign
  | 'emergingLeader'      // 조직 리더 성장형 — grow leadership within the org
  | 'leverageReady';      // 전문성 레버리지형 — ready to act (default fallback)

export const MAIN_TYPE_LABELS = {
  overloadedBurnout: '과부하 소진형',
  realityLocked: '현실 조건 정비형',
  lowOptionVisibility: '기회 탐색 부족형',
  conflictedAtFork: '갈림길 결정형',
  scatteredExplorer: '탐색 과잉형',
  unvalidatedAspirant: '시장 미검증 도전형',
  plateauedPerformer: '정체된 성실형',
  restlessStabilizer: '안정 속 권태형',
  emergingLeader: '조직 리더 성장형',
  leverageReady: '전문성 레버리지형',
} as const satisfies Record<MainTypeKey, string>;

export type SupportTagKey =
  | 'recognitionSensitive' // 가시적 성과 동력
  | 'independenceLeaning'  // 자기 방식 선호
  | 'marketOriented'       // 시장 감각 활용
  | 'creativeExpressive'   // 콘텐츠/표현 동력
  | 'riskAverse'           // 안전판 선호
  | 'externalConstraint'   // 현실 조건 점검
  | 'lowSelfTrust'         // 작은 성공 필요
  | 'selfInsightGap'       // 강점 정리 필요
  | 'marketInsightGap'     // 시장 반응 확인 필요
  | 'highDrive';           // 빠른 실행 가능

// User-facing labels are framed as *intervention directions* (what to lean into / check
// next), never as flaw labels or personality judgments. The internal keys above encode
// the trigger concept (e.g. riskAverse); the surface copy stays supportive.
export const SUPPORT_TAG_LABELS = {
  recognitionSensitive: '가시적 성과 동력',
  independenceLeaning: '자기 방식 선호',
  marketOriented: '시장 감각 활용',
  creativeExpressive: '콘텐츠/표현 동력',
  riskAverse: '안전판 선호',
  externalConstraint: '현실 조건 점검',
  lowSelfTrust: '작은 성공 필요',
  selfInsightGap: '강점 정리 필요',
  marketInsightGap: '시장 반응 확인 필요',
  highDrive: '빠른 실행 가능',
} as const satisfies Record<SupportTagKey, string>;

export type SolutionModuleKey =
  | 'portfolioConvert'    // 전문성 자산화
  | 'marketTest'          // 시장 검증 스프린트
  | 'recoveryFirst'       // 회복 우선
  | 'optionNarrowing'     // 선택지 좁히기
  | 'valueTradeoffMapping'// 선택 기준 정리 (internal key preserved; user-facing label is "선택 기준 정리")
  | 'roleRedesign'        // 현직 재설계
  | 'independentPilot'    // 독립 파일럿
  | 'contentEngine'       // 콘텐츠 엔진
  | 'runwayStabilizer'    // 런웨이 안정화
  | 'confidenceBuilder'   // 작은 성공 쌓기
  | 'opportunityGeneration' // 선택지 발굴 — Planned Happenstance
  | 'strengthsReflection'   // 강점 회고 — Strengths-based
  | 'leadershipGrowth';     // 리더십 확장 — grow scope/influence within the org

export interface SolutionWeekStep {
  week: string;    // e.g. "1주", "2-3주"
  action: string;
}

export interface SolutionModule {
  key: SolutionModuleKey;
  title: string;              // 전문성 자산화
  goal: string;               // one-line objective
  why: string;                // why this intervention works for the state
  // P3.16 — the single smallest next action. 행동과학(implementation intention,
  // tiny-habit): 4주 계획표보다 '오늘 부담 없이 할 수 있는 한 걸음' 하나가 실행을
  // 만든다. 결과지의 주인공으로 노출하고, plan(4주)은 접어 보조로 둔다.
  firstStep: string;
  plan: SolutionWeekStep[];   // the 30-day action plan
  successSignals: string[];   // what "it's working" looks like
  stopPivot: string[];        // when to stop or switch modules
}

// Which low-value-driven signals were actually probed by the user's answers. Lets the
// engine distinguish "measured low" from "unmeasured (0)", so it never infers a negative
// or inverse support tag from missing data. Risk/runway are read from gates (already
// measured-only); only the SCCT/adaptability axes whose 0 is ambiguous need this flag.
// Absent → false (conservative: do not infer negative tags from absence).
export interface MeasuredSignals {
  selfEfficacy: boolean; // a card contributing to SCCT self-efficacy was answered
  confidence: boolean;   // a card contributing to adaptability confidence was answered
}

// ─── Execution Plan ───────────────────────────────────────────────────────────
// One coherent monthly action plan that merges solutionLayer.primaryModule.plan,
// thirtyDayExperiment, reevaluationCriteria, currentBestMove and strategicDirection.
// The module dominates structure (why/weeks/success/stop); the user-chosen experiment
// becomes the single "core bet"; re-evaluation is attached at the end. The raw source
// fields stay on ResultSpine for backward compatibility — this is the display assembly.

export interface ExecutionWeekStep {
  week: string;    // "1주", "1-2주"
  action: string;
}

// The single measurable bet for the month — absorbs thirtyDayExperiment (no separate section).
export interface CoreExperiment {
  label: string;
  evidenceToCheck: string[];
  sourceOptionKey: CareerOptionKey; // which option this experiment instantiates
}

// Shown only when the now-move is a safety bridge while the identity-fit direction is gated.
export interface SafetyBridge {
  label: string;  // e.g. "이직"
  why: string;    // e.g. "수입·안정을 지키며"
}
export interface DirectionToValidate {
  label: string;          // e.g. "콘텐츠/퍼스널 브랜드"
  readinessLabel: string; // "조건부" | "준비 후"
}

export interface ExecutionPlan {
  // ① strategy header
  strategyStatement: string;
  mainTypeLabel: string;        // secondary label, not the headline
  supportTagLabels: string[];   // softened display labels

  // ② this month's core experiment (+ optional safety-bridge dual thread)
  coreExperiment: CoreExperiment;
  // bridge sentence shown when the strategy (e.g. "고를 기준 정하기") and the experiment
  // (e.g. "고객 인터뷰") differ in mode — explains why the experiment serves the strategy.
  coreExperimentBridge?: string;
  safetyBridge?: SafetyBridge;
  directionToValidate?: DirectionToValidate;

  // ③–⑤ from the dominant (plan) module
  weeklyActions: ExecutionWeekStep[];
  successSignals: string[];
  stopOrPivotCriteria: string[];

  // ⑥ re-evaluation (absorbs reevaluationCriteria)
  reevaluationDateLabel: string;   // "30일 후 (2026-06-28)"
  reevaluationChecklist: string[];

  // Option promotions worth surfacing (collapsed): only options already in context
  // (strategicDirection / prepareAfter / conditional / hint module), capped at 2.
  // Warning/downgrade conditions are NOT here — they live in stopOrPivotCriteria.
  promotionConditions: ReversalRule[];

  // ⑦ closing line + optional Hope-Theory context note (mainType-aware framing).
  // closingLine is now resolved by activeLenses (essentialist / actionType / optionGeneration),
  // not by mainType alone — so e.g. a plateaued single-axis expert no longer gets an
  // essentialist "여기까지면 충분" closing they don't need.
  closingLine: string;
  // Only set for mainTypes that need a non-default explanatory framing (e.g. lowOptionVisibility
  // gets a Hope-Theory pathways-not-deficiency note). Rendered under the strategy statement.
  mainTypeContextNote?: string;

  // ⑧ Active conditional theory lenses — derived from existing measurements (vector / CDDQ /
  // gates / mainType / bestMove). Each lens gates a slice of copy so theories don't over-apply:
  //   essentialism        → "줄이기 / 좁히기" copy + essentialist closing
  //   range               → 2-axis identity statement + composer chip
  //   plannedHappenstance → 선택지 발굴 / Hope-Theory framing + optionGeneration closing
  //   jobCrafting         → 현직 재설계 / role-redesign module routing
  // Always present (false when inactive) so UI doesn't have to null-check.
  activeLenses: ActiveLenses;

  // small optional hint — never a second full plan
  secondaryModuleHint?: string;
}

// Conditional theory lenses. Derived purely from existing measurements — no new questions,
// no new constructs, no new scoring. Used to gate copy so each theory applies only where it fits.
export interface ActiveLenses {
  essentialism: boolean;        // subtract-to-essence — applies when optionOverload/valueConflict is present
  range: boolean;               // multi-axis integration — applies when two top identity axes are co-high
  plannedHappenstance: boolean; // generate-options-then-meet — applies when options are not yet visible
  jobCrafting: boolean;         // redesign current role — applies when stable + suppressed axis OR roleRedesign-fit
}

// What the result surfaces to the user (main type 1 + tags 2–3 + modules 1–2 + actions).
export interface SolutionLayer {
  mainTypeKey: MainTypeKey;
  mainTypeLabel: string;        // small secondary label (e.g. 정체된 성실형)
  strategyStatement: string;    // the main headline — a strategy, not a personality
  supportTags: SupportTagKey[]; // 2–3, strongest first
  primaryModule: SolutionModule;
  secondaryModule: SolutionModule | null;
  nextActions: string[];        // first 3 concrete steps from the primary module
}

// ─── User Profile (P2.0) ──────────────────────────────────────────────────────
// Profile is meta-context: who the user is and how they reached this question.
// It is a SEPARATE object from FlowResponses and is NEVER fed into any of:
//   classifyMainType / selectSolutionModules / deriveActiveLenses /
//   resolveClosingLine / sourceOptionKey resolver / planModule routing /
//   bestMove selection / EXPERIMENT_HOME_MODULE / any P1.x invariant.
// It exists as a read-only pass-through on the result, for future copy
// personalization (P2.1+) and for audit/export. All fields are optional.
export interface UserProfile {
  ageBand?:
    | '20_early'
    | '20_late'
    | '30_early'
    | '30_late'
    | '40_early'
    | '40_late_plus';

  jobRoleRaw?: string;
  jobRoleCategory?: string;
  jobRoleSubcategory?: string;
  jobRoleSecondaryCategories?: string[];

  totalCareerStage?:
    | 'total_0_3'
    | 'total_3_7'
    | 'total_7_12'
    | 'total_12_plus'
    | 'no_fulltime_experience';

  currentFieldStage?:
    | 'current_under_1'
    | 'current_1_3'
    | 'current_3_7'
    | 'current_7_plus'
    | 'multiple_current_fields';

  priorFieldExperience?:
    | 'single_track'
    | 'has_prior_field'
    | 'multi_field';

  careerPattern?:
    | 'single_track'
    | 'domain_shift'
    | 'multi_track'
    | 'early_exploration';

  workMode?:
    | 'organization'
    | 'professional'
    | 'freelance'
    | 'founder'
    | 'student'
    | 'career_break'
    | 'multi_work';

  transitionTiming?:
    | 'now'
    | 'within_1_3_months'
    | 'within_3_6_months'
    | 'after_6_months'
    | 'unknown';

  transitionIntent?:
    | 'curious'
    | 'preparing'
    | 'actively_considering'
    | 'ready_to_switch'
    | 'must_stay';

  // ADR-001 — 사용자의 고민 한 문장 (자유 텍스트, 선택 입력).
  // 엔진은 절대 소비하지 않는다 (P2.0 패스스루 계약과 동일). LLM narrative
  // 페이로드 전용. 외부 API로 전송되므로 analytics 페이로드에는 넣지 않는다.
  concernFreeText?: string;

  concernTags?: Array<
    | 'job_change'
    | 'stay_or_leave'
    | 'too_many_options'
    | 'low_option_visibility'
    | 'burnout'
    | 'strength_unclear'
    | 'startup_side_project'
    | 'independent_work'
    | 'identity_confusion'
  >;

  constraintTags?: Array<
    | 'money'
    | 'time'
    | 'energy_burnout'
    | 'family_responsibility'
    | 'low_confidence'
    | 'information_gap'
    | 'social_pressure'
    | 'career_gap_risk'
    | 'none'
  >;

  desiredPaths?: Array<
    | 'job_change'
    | 'internal_redesign'
    | 'freelance'
    | 'startup'
    | 'side_project'
    | 'content_brand'
    | 'advisory_teaching'
    | 'rest_recover'
    | 'undecided'
  >;
}

// ─── P2.4 — Profile Context Summary ──────────────────────────────────────────
// A copy-only recap derived from (profile, result). Three fields:
//   • headline — one-line "who you are right now" or, when profile is empty,
//     a neutral framing built from the result's mainTypeKey label.
//   • body — short paragraph that combines the user's current state (from
//     profile) with the engine's recommended strategy (from result).
//   • tags — small chip list mixing strategy + direction + top concerns +
//     top constraint + job-category context. Capped at 5, deduped.
//
// HARD INVARIANT: this object is NEVER consumed by:
//   classifyMainType / selectSolutionModules / deriveActiveLenses /
//   resolveClosingLine / sourceOptionKey resolver / planModule routing /
//   bestMove selection / EXPERIMENT_HOME_MODULE / any P1.x invariant.
// It is purely additive UI copy. The session-level routing-fingerprint tests
// (P2.4 R1) prove that toggling profile data which DOES change the summary
// does NOT change any routing field. The builder is also pure and never
// mutates its inputs (P2.4 PURITY tests).
export interface ProfileContextSummary {
  headline: string;
  body: string;
  tags?: string[];
}

// ─── v2 개인화 레이어 (ResultContext) ────────────────────────────────────────
// resultContextEngine가 산출하는 결과지 4섹션 + 메타. ADDITIVE 메타데이터로
// ResultSpine.resultContext에 부착된다. 엔진(분류·라우팅)은 이 필드를 읽지 않는다.
export type ReadinessLevel =
  | 'pause'
  | 'reflect_only'
  | 'tiny_test'
  | 'structured_test'
  | 'commitment_test';

export type FrictionSource =
  | 'income_uncertainty'
  | 'career_capital_loss'
  | 'identity_loss'
  | 'too_many_live_options'
  | 'low_market_signal'
  | 'low_energy'
  | 'time_constraint'
  | 'tradeoff_pain';

// 결과지 1·2·3섹션(지금 고민의 핵심 / 이번 달 접근 / 이번 주 한 수).
export interface AssembledNarrative {
  core: string;
  monthlyApproach: string;
  weeklyMove: string;
  isBlended: boolean;
}

export interface ResultContext {
  mainType: string;
  primarySubtype: string;
  secondarySubtype: string;
  subtypeConfidence: number;              // raw: primaryScore − secondaryScore
  subtypeScores: Record<string, number>;  // 디버깅·튜닝용
  pullDirection: string;                   // CareerOptionKey
  showPullDirection: boolean;
  primaryFriction: FrictionSource;
  secondaryFriction: FrictionSource;
  readinessLevel: ReadinessLevel;
  narrative: AssembledNarrative;
  signals: string[];                       // 4섹션: 이렇게 판단한 이유
}

// ─── Career Pattern v1 (ADDITIVE — 별도 계층) ─────────────────────────────────
// 16개 커리어 고민 패턴 분류(인지편향·정체성 축). 기존 mainType/subtype/friction과
// 다른 온톨로지이며 그 값을 대체·재해석하지 않는다. 엔진 라우팅·분류·게이트는 이 값을
// 절대 읽지 않는다(storyInsight/profileContext와 동일한 표시 전용 패스스루 계약).
// 설계 근거: docs/research/career-pattern-v1-spec.md. UserProfile.careerPattern(전환
// 패턴 문자열)과는 별개다 — 혼동을 피해 스파인 필드명은 patternProfile로 둔다.
export type PatternCategory =
  | 'instinctTrap'        // A. 본능의 덫
  | 'cognitiveOverload'   // B. 인지 과부하
  | 'avoidance'           // C. 회피 행동
  | 'identityConfusion';  // D. 정체성 혼란

export type PatternId =
  | 'lossAversion' | 'endowmentEffect' | 'sunkCost' | 'ambiguityAversion'
  | 'maximizer' | 'anticipatedRegret' | 'analysisParalysis' | 'noSelectionCriteria'
  | 'productiveProcrastination' | 'movingGoalposts' | 'experimentAvoidance'
  | 'liminality' | 'tyrannyOfShoulds' | 'identityForeclosure' | 'impostor' | 'lowSelfEfficacy';

export interface CareerPatternProfile {
  primaryPattern?: PatternId;
  secondaryPattern?: PatternId;
  category?: PatternCategory;
  confidence: 'low' | 'medium' | 'high';
  evidenceCodes: string[];  // 판정 기여 신호 토큰(재현·튜닝). 자유입력 원문·개인정보 미포함.
  resolution: 'pattern' | 'category_only' | 'insufficient_signal';
  version: 'pattern-v1';
}

export interface ResultSpine {
  identityAxis: IdentityAxis;
  resultMode: ResultMode;
  // The identity-aligned long-term direction (highest fit), even if gated. null in direct_now/recovery_first.
  strategicDirection: MoveRecommendation | null;
  // The practical move to make now (safe bridge when the direction is gated).
  currentBestMove: MoveRecommendation;
  prepareAfterOption: MoveRecommendation | null;
  // 'conditional' option: viable now only if its reversal conditions are met.
  conditionalOption: MoveRecommendation | null;
  pauseOption: MoveRecommendation | null;
  reversalConditions: ReversalConditions;
  thirtyDayExperiment: ThirtyDayExperiment;
  reevaluationCriteria: ReevaluationCriteria;
  // Theory-grounded explanation: why this recommendation, confidence, what's missing.
  evidence: EvidenceLayer;
  // Current-state intervention strategy + concrete solution modules (the "what to do now" layer).
  solutionLayer: SolutionLayer;
  // One merged monthly action plan (module + experiment + reeval + bridge). Display assembly.
  executionPlan: ExecutionPlan;
  optionalSajuLayer: SajuLayer | null;
  // ─── P2.0 ──────────────────────────────────────────────────────────────────
  // Read-only pass-through of the user's profile metadata. Engines do NOT consume it
  // for classification / routing / lens / closingLine / sourceOptionKey decisions —
  // those are gated by P1.x invariants. When the caller supplies a profile through
  // `buildResultFromSession`, this field is populated (with `careerPattern` normalized).
  // When the caller uses the legacy `buildResultFromResponses` entry, the runtime still
  // defaults this to `{}` for downstream convenience; the type is optional to allow
  // a future direct caller of `buildResultSpine` to omit profile entirely.
  profile?: UserProfile;
  // ─── P2.4 ──────────────────────────────────────────────────────────────────
  // Copy-only summary of the user's current situation, derived from `profile`
  // via buildProfileContextSummary. Populated only when at least one summary
  // line could be produced; absent when profile is empty or has nothing to say.
  // Engines NEVER read this field — see the ProfileContextSummary type doc for
  // the routing-invariant contract.
  profileContext?: ProfileContextSummary;
  // The user's ORIGINAL ap_experiment selection, BEFORE any engine override.
  // The P1.7 burnout invariant remaps `executionPlan.coreExperiment.sourceOptionKey`
  // to 'restRecover' regardless of choice. This field preserves the original intent
  // for audit / "you chose X but the recovery invariant applied" disclosure.
  //   userSelectedExperimentKey                       = user's original ap_experiment
  //   executionPlan.coreExperiment.sourceOptionKey    = engine-resolved final key
  // These two values may diverge whenever an invariant overrides routing
  // (burnout being the canonical case). Consumers may compare them to surface the
  // override transparently — but the underlying invariant is NOT bypassable via
  // userSelectedExperimentKey. `undefined` here means the user picked ap_unsure
  // (no mapping) or didn't reach the experiment step.
  userSelectedExperimentKey?: CareerOptionKey;
  // P2.0 pass-through: 사용자가 랭킹한 우선순위(cv_priorities) 상위 라벨 (예: ['영향력','성장','돈']).
  // 엔진은 절대 읽지 않는다(라우팅·분류 무관). 솔루션 카드 개인화(표시 전용) 전용.
  topValueLabels?: string[];
  // P2.0 pass-through: 신호-교차 추론 한 줄(buildStoryInsight) — 고른 답이 아니라 그 답들이
  // 부딪히는 긴장을 짚는다. "당신의 이야기"에 표시(표시 전용). 적용 규칙 없으면 omit.
  storyInsight?: string;
  // ─── ADR-001 ───────────────────────────────────────────────────────────────
  // Pre-assembled input for the LLM narrative layer (built by narrativePayload.ts
  // from spine + profile + responses). ADDITIVE metadata, same contract as
  // profileContext: engines never read it; routing fingerprints exclude it.
  narrativeSeed?: NarrativePayload;
  // ─── v2 ────────────────────────────────────────────────────────────────────
  // 개인화 레이어(resultContextEngine) 산출 — subtype 기반 결과지 4섹션 + 신호.
  // ADDITIVE 메타데이터: 엔진은 읽지 않고, 라우팅 핑거프린트에서 제외된다.
  resultContext?: ResultContext;
  // ─── Career Pattern v1 (ADDITIVE) ──────────────────────────────────────────
  // 16개 커리어 고민 패턴 분류(biasPatternEngine). storyInsight/narrativeSeed와 동일한
  // 표시 전용 패스스루 계약: 엔진 라우팅·분류·게이트가 절대 읽지 않으며, 라우팅
  // 핑거프린트에서 제외된다. 구버전 세션·신규 문항 미응답이면 resolution이
  // category_only 또는 insufficient_signal일 수 있다. 무료 화면 전용(유료 미전달).
  patternProfile?: CareerPatternProfile;
}

// ─── ADR-001 — LLM narrative layer payload ────────────────────────────────────
// The exact JSON POSTed to /api/narrative. Facts only — the LLM may rephrase and
// cross-infer from these, never invent beyond them.
export interface NarrativePayload {
  profile: {
    jobRoleRaw?: string;
    jobRoleTraits?: string;       // e.g. '전문직(자격 기반)' — fuels life-history inference (A1)
    ageBand?: string;             // Korean label
    workMode?: string;            // Korean label
    totalCareerStage?: string;    // Korean label — A1 cross-reference material
    currentFieldStage?: string;   // Korean label — A1 cross-reference material
  };
  recommendation: {
    currentBestMove: string;
    strategicDirection?: string;  // includes readiness label when present
    coreExperiment: string;
    conditionalOption?: { label: string; blockedBy: string };
    pausedOption?: { label: string; blockedBy: string };
    confidenceBand: string;
    resultMode: string;
  };
  answerHighlights: string[];     // '질문 맥락: 선택 라벨' lines — provenance + A3~A7 material
  constructSignals: string[];     // e.g. '실행 자신감 높음'
  // Deterministically PRE-COMPUTED cross-signal candidates (INSIGHT-INFERENCE-
  // CATALOG A1/A3/A5). Observations only, never interpretations — the LLM picks
  // which to verbalize. Added because few-shot alone fired these unreliably.
  inferenceHints?: string[];
  userConcern?: string;           // free-text concern (pc_concernText)
}
