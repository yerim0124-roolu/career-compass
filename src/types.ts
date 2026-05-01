export type OptionKey =
  | 'stay'
  | 'jobChange'
  | 'careerSwitch'
  | 'restAfterQuit'
  | 'startupFreelance'
  | 'studyReskill';

export type FlowType =
  | 'expansionExternal'
  | 'expansionInternal'
  | 'stabilityExternal'
  | 'stabilityInternal';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type CalendarType = 'solar' | 'lunar';
export type OptionReadiness = 'now' | 'prepareFirst' | 'conditional' | 'notRecommended';

export interface TraitInput {
  changeOrientation: number;
  planning: number;
  curiosity: number;
  riskTolerance: number;
  recoveryNeed: number;
  selfEfficacy: number;
  networking: number;
  meaningOrientation: number;
  outcomeExpectation: number;  // SCCT: 결과기대 — 외부 시장 반응 기대감
  portfolioEvidence: number;   // SCCT: 성과 증명 가능성
}

export interface BasicProfile {
  age: number;
  yearsOfExperience: number;
  currentRole: string;
  industry: string;
  annualSalary: number;
  monthlyExpense: number;
  savings: number;
}

export interface CareerStatus {
  jobSatisfaction: number;
  growthPotential: number;
  salarySatisfaction: number;
  workLifeBalance: number;
  organizationStress: number;
  burnout: number;
  jobSearchConfidence: number;
}

export interface FlowInput {
  desireForChange: number;
  desireForStability: number;
  needForRest: number;
}

export interface TimingInput {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthTime: string;
  calendarType: CalendarType;
}

export interface FormData {
  basicProfile: BasicProfile;
  careerStatus: CareerStatus;
  selectedOptions: OptionKey[];
  traits: TraitInput;
  flow: FlowInput;
  timing: TimingInput;
}

export interface DerivedVariables {
  runwayMonths: number;
  burnoutRisk: number;
  jobDissatisfaction: number;
  marketReadiness: number;        // 1-5 scale (SCCT: self-efficacy + outcome expectation + networking + portfolio)
  marketReadinessPercent: number; // 0-100 — same signal in percent. 비교/임계값 판정용 단일 표현.
  financialSafetyBase: number;    // 0-100
  readinessBehavior: number;      // 0-100
  explorationDrive: number;       // 0-100
  stabilityPreference: number;    // 0-100
  burnoutPressure: number;        // 0-100
  careerAdaptability: number;     // 0-100 (Savickas 2012: concern + control + curiosity + confidence)
}

export interface AnalysisReport {
  coreDiagnosis: string;
  whyTopChoice: string;
  keyRisks: string;
  nextSignals: string[];
  decisionStructure: string[];    // [확장신호, 실행신호, 리스크, 결론]
  tradeoffComparison: string[];   // [1위 vs 2위, 1위 vs 3위]
  changeConditions: string[];     // conditions that would flip the recommendation
}

// Three-block expert interpretation card
export interface ExpertInterpretation {
  signal: string;          // 현재 신호
  interpretation: string;  // 해석
  strategy: string;        // 전략
  evidenceTags: string[];  // e.g. ['SCCT: 자기효능감·결과기대', 'Career Anchors: 전문성']
}

// Weekly action plan with success metric
export interface ActionPlanWeek {
  task: string;
  metric: string;
}
export interface ActionPlanDetailed {
  week1: ActionPlanWeek;
  week2: ActionPlanWeek;
  week3: ActionPlanWeek;
  week4: ActionPlanWeek;
}

export interface OptionScore {
  key: OptionKey;
  label: string;
  careerUpside: number;
  financialSafety: number;
  mentalRecovery: number;
  executionDifficulty: number;
  regretRisk: number;
  baseScore: number;
  traitFitScore: number;
  flowFitScore: number;
  totalScore: number;
  warnings: string[];
  notes: string[];
  matchReasons: string[];
  mismatchRisks: string[];
  bestCondition: string;
  // Option readiness classification
  readinessStatus: OptionReadiness;
  mainFitReason: string;
  mainRiskReason: string;
  requiredConditions: string[];
  recommendedAction: string;
}

export interface TimingAnalysis {
  inferredEvents: string[];
  signals: string[];
  notes: string[];
}

export type SajuRelationType = 'self' | 'clash' | 'harmony' | 'neutral';
export type SajuUrgency = 'now' | 'soon' | 'wait';

export interface SajuTimingLayer {
  available: boolean;
  currentYearName: string;       // e.g. "병오년 (2026)"
  nextYearName: string;          // e.g. "정미년 (2027)"
  currentRelation: SajuRelationType;
  nextRelation: SajuRelationType;
  currentRelationLabel: string;  // e.g. "충(沖)의 해"
  nextRelationLabel: string;
  currentSignal: string;         // one-sentence timing signal
  nextSignal: string;
  timingConclusion: string;      // short "now / soon / wait" verdict
  combinedRecommendation: string; // data + saju merged
  urgency: SajuUrgency;
}

// ─── Five Elements (오행) ──────────────────────────────────────────────────────

export interface ElementProfile {
  wood: number;   // 목(木): growth, exploration, flexibility
  fire: number;   // 화(火): passion, creativity, expression
  earth: number;  // 토(土): stability, planning, groundedness
  metal: number;  // 금(金): precision, discipline, structure
  water: number;  // 수(水): wisdom, adaptability, risk awareness
}

// Saju trait estimate — year pillar only (full 사주팔자 requires manse calendar)
export interface SajuTraitEstimate {
  explorationTendency: number;   // 0-100
  planningTendency: number;      // 0-100
  riskTolerance: number;         // 0-100
  autonomyDrive: number;         // 0-100
  learningDrive: number;         // 0-100
  organizationFit: number;       // 0-100
  entrepreneurialDrive: number;  // 0-100
  stabilityNeed: number;         // 0-100
  dominantElement: string;       // e.g. "목(木)"
  traitStory: string;
  confidence: 'estimated' | 'unavailable';
}

// ─── Saju persona MVP ────────────────────────────────────────────────────────

export type SajuElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water' | 'balanced';

export interface SajuPersonaMVP {
  status: 'estimated' | 'notAvailable';
  dominantElement: SajuElementKey;
  secondaryElement?: string;
  coreTemperament: string;
  decisionPattern: string;
  strengthPattern: string;
  vulnerabilityPattern: string;
  careerDirectionHint: string;
  timingHint: string;
  disclaimer: string;
}

// ─── Saju Timing (full 대운/세운 requires manse calendar) ─────────────────────

export interface LuckCycle {
  startAge: number;
  endAge: number;
  pillarName: string;    // e.g. "갑자"
  element: string;
  careerSignal: string;
  urgency: SajuUrgency;
}

export interface YearLuck {
  year: number;
  yearName: string;
  relation: SajuRelationType;
  relationLabel: string;
  careerSignal: string;
  urgency: SajuUrgency;
}

export interface CareerYearSignal {
  available: boolean;
  currentYear: YearLuck;
  nextYear: YearLuck;
  timingConclusion: string;
  urgency: SajuUrgency;
}

// ─── Career Decision Classification (Gate Model) ─────────────────────────────

export type CareerDecisionClass =
  | 'stable-maintain'          // 현 직장 재설계형
  | 'move-while-working'       // 재직 중 이동형
  | 'accelerate-challenge'     // 도전 가속형
  | 'recovery-first'           // 회복 우선형
  | 'prepare-then-switch'      // 준비 후 전환형
  | 'side-project-validation'  // 사이드 프로젝트 검증형
  | 'hold-and-review';         // 보류·점검형

export interface GateScores {
  stay: number;
  jobChange: number;
  startup: number;
  rest: number;
  prepareFirst: number;
}

export interface DecisionGateResult {
  decisionClass: CareerDecisionClass;
  archetypeLabel: string;
  primaryReason: string;
  gateScores: GateScores;
  conditions: string[];
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface Results {
  derived: DerivedVariables;
  scores: OptionScore[];
  flowType: FlowType;
  globalWarnings: string[];
  actionPlan: ActionPlan;           // simple strings (legacy)
  actionPlanDetailed: ActionPlanDetailed; // with metrics
  analysisReport: AnalysisReport;
  confidence: ConfidenceLevel;
  confidenceExplanation: string;
  timingAnalysis: TimingAnalysis;
  sajuTimingLayer: SajuTimingLayer;
  archetypeLabel: string;
  gaugeScore: number;               // 0-100: readiness for change
  oneLineInsight: string;
  expertInterpretation: ExpertInterpretation;
  decisionGate: DecisionGateResult;
  sajuTraitEstimate: SajuTraitEstimate | null;
  personalityStory: PersonalityStory;
  combinedRecommendation: string;
  bridgeMessage: string;
  strategy: DecisionStrategy;
  narrativePersona: NarrativePersona;
  narrativeState: NarrativeState;
  narrativeCoreStrategy: NarrativeCoreStrategy;
  careerDiagnosis: CareerDiagnosis;
  confidenceLabel: string;  // nuanced badge text: "복합 전략 권장" | "병렬 검증 필요" | "신뢰도 높음" | etc.
  sajuPersonaMVP: SajuPersonaMVP;
}

export interface ActionPlan {
  week1: string;
  week2: string;
  week3: string;
  week4: string;
}

export type OptionRole = 'primary' | 'secondary' | 'conditional' | 'notRecommended';

export interface RankedOption {
  key: OptionKey;
  label: string;
  role: OptionRole;
  readinessStatus: OptionReadiness;
  totalScore: number;
}

export type StateTimingLevel = '회복 우선' | '저강도 탐색' | '실행 가능';

export interface TimingAdvice {
  stateText: string;
  stateTimingLevel: StateTimingLevel;  // primary timing verdict from state data
  combinedInterpretation: string;      // stateText + saju refinement merged into one sentence
  signals: string[];
  sajuConnected: false;        // always false until real manse engine is wired
  sajuDisclaimer: string;
  yearPillarAvailable: boolean;
  yearPillarData: {
    currentYearName: string; currentRelationLabel: string; currentSignal: string;
    nextYearName: string;    nextRelationLabel: string;    nextSignal: string;
  } | null;
  traitNote: string | null;    // ohaeng element trait summary
}

export interface DecisionStrategy {
  archetype: string;            // gate-based archetype label
  archetypeInsight: string;     // 1-sentence insight for the archetype
  primaryStrategy: string;      // aligned with archetype (source of truth for all UI sections)
  primaryOptionKey: OptionKey;  // gate-adjusted top option key (drives action plan, analysis, etc.)
  secondaryStrategy: string;    // optional secondary path (empty if none)
  bridgeMessage: string;        // explains divergence when raw score differs from archetype
  rankedOptions: RankedOption[];// all options with gate-assigned roles
  timingAdvice: TimingAdvice;
  confidence: ConfidenceLevel;
  confidenceExplanation: string;
}

// ─── Direction / Execution diagnosis ─────────────────────────────────────────

// "이 사람은 장기적으로 어떤 방향이 맞는 사람인가?" — determined mainly by traits.
export type DirectionType =
  | '독립 창업형'    // autonomous + entrepreneurial + risk-tolerant
  | '전문가 성장형'  // expertise-oriented + meaning-driven + deep learner
  | '조직 성장형'   // network-builder + planner + org-fit
  | '학습 전환형'   // high curiosity + change drive + low risk tolerance
  | '회복 재정비형'  // no clear direction; needs recovery before direction matters
  | '안정 설계형';  // stability-first + low change orientation

// "현재 상태에서는 그 방향을 어떻게 실행해야 하는가?" — determined by current state.
export type ExecutionMode =
  | '즉시 실행'    // all conditions align: low fatigue, good runway, high readiness
  | '재직 중 검증' // explore/validate while employed; don't quit yet
  | '준비 후 전환' // build readiness first (market readiness or self-efficacy gap)
  | '회복 후 실행' // recover first; launching now would be counterproductive
  | '보류·점검';   // financial crisis or extreme fatigue; hold everything

export interface CareerDiagnosis {
  directionType: DirectionType;
  directionLabel: string;         // same value as directionType
  directionDescription: string;   // 1-sentence "why this direction fits"
  executionMode: ExecutionMode;
  executionLabel: string;         // same value as executionMode
  executionDescription: string;   // 1-sentence "what this mode means right now"
  integratedStrategy: string;     // direction + execution → one concrete strategy statement
  oneLineSummary: string;         // direction×execution one-liner shown below the direction label
  bridgeNote: string | null;      // explains divergence when execution ≠ intuitive direction path
}

// ─── Narrative layer ─────────────────────────────────────────────────────────
// Assembled from existing scored data; no new scoring rules.

export interface NarrativePersona {
  headline: string;          // empathetic one-liner: "이런 사람입니다"
  decisionStyle: string;     // how this person makes career decisions
  motivationDriver: string;  // what's driving the discomfort or desire
  strength: string;          // what they can actually leverage right now
  watchOut: string;          // the one trap that's most likely for this type
  sajuInsight: string | null; // innate temperament from year-pillar; clearly labeled as estimated
}

export interface NarrativeState {
  headline: string;     // what's happening now (one punchy line)
  rootCause: string;    // WHY this situation exists (causal chain, not symptom list)
  implication: string;  // what this means for the decision
}

export interface NarrativeCoreStrategy {
  integrated: string;      // single strategy tag shown large
  rationale: string;       // 2-3 sentences: why this strategy fits this person
  keyAction: string;       // the single most important first concrete step
  evidenceTags: string[];  // theoretical anchors
}

export interface PersonalityStory {
  archetypeLabel: string;       // personality type label (e.g. "안정 기반 탐색형")
  oneLinePersonality: string;   // one-sentence character summary
  bullets: string[];            // 3 observable personality traits
  decisionStyleSummary: string; // how this person tends to make career decisions
  sajuNote: string | null;      // saju-based note if available, null otherwise
  dataSource: string;           // framing prefix ("현재 입력값 기준으로 보면" etc.)
}
