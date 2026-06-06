// Career Compass 2.0 — theory-grounded construct engine.
// Deterministic, no LLM, no UI. Measures SCCT, Career Adaptability, CDDQ, and MCDA
// constructs in parallel to CareerVector, and turns them into an evidence layer
// (why this recommendation, confidence, what's missing). This is what makes the
// internal model trustworthy without making the UX a psychometric questionnaire.

import type {
  ConstructProfile,
  ConstructEffects,
  EvidenceLayer,
  ConstructSignal,
  ConfidenceDrivers,
  ConfidenceBand,
  ActionReadiness,
  ResultMode,
  MCDAWeights,
  MainTypeKey,
  CareerOptionKey,
  ReadinessGates,
} from '../types/careerCompass.ts';

// Natural Korean particles (avoid "이(가)" style placeholders in generated copy).
function hasBatchim(word: string): boolean {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
}
const objJosa = (w: string): string => (hasBatchim(w) ? '을' : '를');
const topicJosa = (w: string): string => (hasBatchim(w) ? '은' : '는');

const MCDA_LABELS: Record<keyof MCDAWeights, string> = {
  identityFit: '정체성 적합',
  assetLeverage: '성장·자산 활용',
  marketPotential: '시장성',
  energySustainability: '지속가능성',
  financialSafety: '수익·안정성',
  autonomy: '자율성',
  impact: '영향력',
};

function topPriorities(mcda: MCDAWeights, n = 2): string[] {
  const keys = Object.keys(mcda) as (keyof MCDAWeights)[];
  return keys
    .map((k) => ({ k, v: mcda[k] }))
    .filter((e) => e.v > 0)
    .sort((a, b) => b.v - a.v || keys.indexOf(a.k) - keys.indexOf(b.k))
    .slice(0, n)
    .map((e) => MCDA_LABELS[e.k]);
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const mean = (...xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const SATURATION = 10; // raw construct points that map to 100 after normalization

// Thresholds on the normalized 0–100 scale.
const HIGH = 66;
const LOW = 33;
const PRESENT = 50; // "notable enough to act on"

export function createEmptyConstructProfile(): ConstructProfile {
  return {
    scct: { selfEfficacy: 0, outcomeExpectation: 0, goalClarity: 0, contextualSupport: 0, contextualBarrier: 0 },
    adaptability: { concern: 0, control: 0, curiosity: 0, confidence: 0 },
    difficulty: { readinessGap: 0, selfInformationGap: 0, marketInformationGap: 0, valueConflict: 0, optionOverload: 0 },
    mcda: { identityFit: 0, assetLeverage: 0, marketPotential: 0, energySustainability: 0, financialSafety: 0, autonomy: 0, impact: 0 },
  };
}

// The construct sub-profiles are all-number records; cast to a numeric map to merge.
type NumMap = Record<string, number>;
const asMap = (group: object): NumMap => group as unknown as NumMap;

function addInto(target: NumMap, partial: Record<string, number | undefined>, weight: number): void {
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) target[key] = (target[key] ?? 0) + value * weight;
  }
}

export function applyConstructEffects(profile: ConstructProfile, effects: ConstructEffects, weight = 1): ConstructProfile {
  const out: ConstructProfile = {
    scct: { ...profile.scct },
    adaptability: { ...profile.adaptability },
    difficulty: { ...profile.difficulty },
    mcda: { ...profile.mcda },
  };
  if (effects.scct) addInto(asMap(out.scct), effects.scct, weight);
  if (effects.adaptability) addInto(asMap(out.adaptability), effects.adaptability, weight);
  if (effects.difficulty) addInto(asMap(out.difficulty), effects.difficulty, weight);
  if (effects.mcda) addInto(asMap(out.mcda), effects.mcda, weight);
  return out;
}

function saturate(group: NumMap): void {
  for (const k of Object.keys(group)) {
    group[k] = clamp(Math.round((group[k] / SATURATION) * 100), 0, 100);
  }
}

// Absolute saturation normalization → high/low thresholds stay meaningful.
export function normalizeConstructProfile(profile: ConstructProfile): ConstructProfile {
  const out: ConstructProfile = {
    scct: { ...profile.scct },
    adaptability: { ...profile.adaptability },
    difficulty: { ...profile.difficulty },
    mcda: { ...profile.mcda },
  };
  saturate(asMap(out.scct));
  saturate(asMap(out.adaptability));
  saturate(asMap(out.difficulty));
  saturate(asMap(out.mcda));
  return out;
}

// ─── Decision difficulty pattern (CDDQ) ───────────────────────────────────────
export type DecisionDifficultyKey =
  | 'optionOverload'
  | 'valueConflict'
  | 'readinessGap'
  | 'selfInformationGap'
  | 'marketInformationGap';

export interface DecisionDifficultyPattern {
  primaryDifficulty: DecisionDifficultyKey | null;  // null when no difficulty is notable
  secondaryDifficulties: DecisionDifficultyKey[];   // up to 2, in descending strength
}

const DIFFICULTY_THRESHOLD = 40;

export function inferDecisionDifficultyPattern(profile: ConstructProfile): DecisionDifficultyPattern {
  const d = profile.difficulty;
  const candidates: { key: DecisionDifficultyKey; value: number }[] = [
    { key: 'optionOverload', value: d.optionOverload },
    { key: 'valueConflict', value: d.valueConflict },
    { key: 'readinessGap', value: d.readinessGap },
    { key: 'selfInformationGap', value: d.selfInformationGap },
    { key: 'marketInformationGap', value: d.marketInformationGap },
  ];
  const present = candidates
    .filter((c) => c.value >= DIFFICULTY_THRESHOLD)
    .sort((a, b) => b.value - a.value || candidates.indexOf(a) - candidates.indexOf(b)); // deterministic tiebreak
  if (present.length === 0) return { primaryDifficulty: null, secondaryDifficulties: [] };
  return { primaryDifficulty: present[0].key, secondaryDifficulties: present.slice(1, 3).map((c) => c.key) };
}

const DIFFICULTY_PHRASE: Record<DecisionDifficultyKey, string> = {
  optionOverload: '선택지가 많아 흩어지기 쉬워요',
  // P1.3 — softened: read as a trade-off observation, not "your values are fighting".
  // P3.7 — replaced "트레이드오프" jargon with plain Korean ("선택 기준").
  valueConflict: '여러 우선순위 사이에서 선택 기준을 정해야 해요',
  // P1.3 — softened: less clinical than "결정 준비 신호".
  readinessGap: '큰 결정을 내리기엔 마음·여건이 덜 정돈됐어요',
  selfInformationGap: '내 강점·선호에 대한 정보가 부족해요',
  marketInformationGap: '선택지에 대한 정보가 부족해요', // default; context-resolved at call site
};

const DIFFICULTY_ACTION: Record<DecisionDifficultyKey, string> = {
  optionOverload: '우선순위를 좁히는 것부터',
  // P1.3 — softened, paired with the new valueConflict phrase.
  valueConflict: '어느 쪽을 먼저 둘지 한 번 명시하는 것부터',
  readinessGap: '큰 결정보다 준비·회복부터',
  selfInformationGap: '강점·성과를 정리해 보는 것부터',
  marketInformationGap: '후보별 정보를 채워보는 것부터', // default; context-resolved at call site
};

// ─── External-signal copy resolver (P1) ───────────────────────────────────────
// Internal CDDQ keys (marketInformationGap, marketInsightGap) stay unchanged. The
// user-facing surface copy is resolved per context so a stable/plateaued user no longer
// sees startup-flavored "시장 반응" framing.
export interface SignalCopy {
  shortLabel: string;        // confidence-drivers chip / executionPlan supportTagLabels
  difficultyPhrase: string;  // CDDQ primary phrase
  difficultyAction: string;  // CDDQ primary action verb-phrase
  uncertaintySignal: string; // uncertaintySignals item
  missingInformation: string;// missingInformation item
  narrativeReason: string;   // narrative "...때문에" clause for conditional_led mode
  shortMissing: string;      // short missing-info word ("실제 반응" / "외부 정보" / "선택지 정보")
}

export const SIGNAL_COPY_MARKET: SignalCopy = {
  shortLabel: '실제 반응 확인 필요',
  difficultyPhrase: '실제 반응에 대한 정보가 부족해요',
  difficultyAction: '작은 반응 확인부터',
  uncertaintySignal: '실제 반응 정보가 부족합니다.',
  missingInformation: '잠재 고객 인터뷰·유료 의향 등 실제 반응 데이터',
  narrativeReason: '아직 실제 반응이 확인되지 않았기 때문에',
  shortMissing: '실제 반응',
};
export const SIGNAL_COPY_EXTERNAL: SignalCopy = {
  shortLabel: '외부 정보 보강 필요',
  difficultyPhrase: '외부에서 가져올 정보가 부족해요',
  difficultyAction: '외부에서 사례·정보를 모아보는 것부터',
  uncertaintySignal: '외부 정보가 부족합니다.',
  missingInformation: '비슷한 사례·역할 모델에 대한 외부 정보',
  narrativeReason: '아직 외부 정보가 충분히 모이지 않았기 때문에',
  shortMissing: '외부 정보',
};
export const SIGNAL_COPY_DEFAULT: SignalCopy = {
  shortLabel: '선택지 정보 보강 필요',
  difficultyPhrase: '선택지에 대한 정보가 부족해요',
  difficultyAction: '후보별 정보를 채워보는 것부터',
  uncertaintySignal: '선택지에 대한 정보가 부족합니다.',
  missingInformation: '후보별로 어떤 경험·반응이 따라올지에 대한 정보',
  narrativeReason: '아직 후보별 정보가 충분히 모이지 않았기 때문에',
  shortMissing: '선택지 정보',
};

// Mirror of solutionModuleEngine.MARKET_VALIDATION_EXPERIMENTS / readinessGateEngine.MARKET_FACING_OPTIONS.
// Kept local to avoid cross-engine import cycles; the three sets are intentionally identical.
const MARKET_FACING_OPTIONS: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
  'startup', 'independent', 'contentBrand', 'advisoryTeaching', 'investAnalysis',
]);
const EXTERNAL_INFO_TYPES: ReadonlySet<MainTypeKey> = new Set<MainTypeKey>([
  'scatteredExplorer', 'conflictedAtFork', 'lowOptionVisibility',
]);
const validationLow = (g: ReadinessGates) => g.marketValidation === 'unvalidated' || g.marketValidation === 'early';

export interface ExternalSignalContext {
  mainTypeKey?: MainTypeKey;
  bestMoveKey?: CareerOptionKey;
  // P1.1 — in conditional_led / safety_bridge modes, the bestMove is the safety bridge
  // (jobChange / stayRedesign — never market-facing). The user's actual market-facing
  // direction lives on strategicDirection / coreExperiment. The resolver checks ALL three
  // so a creator/startup user whose now-move is 이직 still gets "실제 반응 확인 필요" copy.
  strategicDirectionKey?: CareerOptionKey;
  coreExperimentSourceKey?: CareerOptionKey;
  gates?: ReadinessGates;
}

export function resolveExternalSignalCopy(ctx: ExternalSignalContext = {}): SignalCopy {
  const anyMarketFacing =
    (ctx.bestMoveKey && MARKET_FACING_OPTIONS.has(ctx.bestMoveKey)) ||
    (ctx.strategicDirectionKey && MARKET_FACING_OPTIONS.has(ctx.strategicDirectionKey)) ||
    (ctx.coreExperimentSourceKey && MARKET_FACING_OPTIONS.has(ctx.coreExperimentSourceKey));
  const valLow = ctx.gates ? validationLow(ctx.gates) : true; // unknown → treat as not-yet-validated
  if (anyMarketFacing && valLow) return SIGNAL_COPY_MARKET;
  if (ctx.mainTypeKey && EXTERNAL_INFO_TYPES.has(ctx.mainTypeKey)) return SIGNAL_COPY_EXTERNAL;
  return SIGNAL_COPY_DEFAULT;
}

// Combination notes keyed by the sorted pair. Pairs involving marketInformationGap branch
// on `signal === SIGNAL_COPY_MARKET` so the wording follows the user's actual context.
// P1.1 — templates are written cleanly instead of regex-replacing `부터$` (which produced
// "것를 진행"-style broken particles).
function buildCombinationNote(pair: string, signal: SignalCopy): string {
  const isMarket = signal === SIGNAL_COPY_MARKET;
  switch (pair) {
    case 'readinessGap|valueConflict':
      return '가치 충돌과 결정 준비 부족이 겹쳐 있어요 — 큰 결정보다, 무엇을 우선할지 정리하며 에너지를 회복하는 게 먼저예요.';
    case 'optionOverload|valueConflict':
      return '선택지도 많고 가치도 충돌해요 — 가치 우선순위로 후보를 먼저 걸러내세요.';
    case 'optionOverload|readinessGap':
      return '선택지가 많은데 결정 에너지는 낮아요 — 넓히기보다 후보를 좁히고 회복을 병행하세요.';
    case 'marketInformationGap|optionOverload':
      return isMarket
        ? '실제 반응이 부족한데 선택지까지 많아요 — 먼저 후보를 2~3개로 좁히고, 작은 반응 확인으로 가려내세요.'
        : '외부 정보가 부족한데 선택지까지 많아요 — 먼저 후보를 2~3개로 좁히고, 사례·정보를 모아 가려내세요.';
    case 'marketInformationGap|valueConflict':
      return isMarket
        ? '무엇을 우선할지와 실제 반응이 둘 다 불확실해요 — 가치 우선순위를 먼저 정하고, 그 기준으로 작은 반응 확인을 진행하세요.'
        : '무엇을 우선할지와 외부 정보가 둘 다 불확실해요 — 가치 우선순위를 먼저 정하고, 그 기준으로 사례·정보를 모아보세요.';
    case 'marketInformationGap|selfInformationGap':
      return isMarket
        ? '나에 대한 정보도, 실제 반응도 부족해요 — 강점 정리와 작은 반응 확인을 같이 해보세요.'
        : '나에 대한 정보도, 외부 정보도 부족해요 — 강점 정리와 사례·정보 수집을 같이 해보세요.';
    default:
      return '';
  }
}

const pairKey = (a: DecisionDifficultyKey, b: DecisionDifficultyKey): string => [a, b].sort().join('|');

// Builds the CDDQ explanation: a primary line + up to 2 combination lines, and a
// cross-construct note when self-information gap meets low control (적응성).
// signal: context-resolved copy for the marketInformationGap construct.
function buildDifficultyExplanation(profile: ConstructProfile, pattern: DecisionDifficultyPattern, signal: SignalCopy): string[] {
  const { primaryDifficulty, secondaryDifficulties } = pattern;
  if (!primaryDifficulty) return ['의사결정을 막는 큰 장애는 보이지 않아요.'];

  const phraseOf = (k: DecisionDifficultyKey) => k === 'marketInformationGap' ? signal.difficultyPhrase : DIFFICULTY_PHRASE[k];
  const actionOf = (k: DecisionDifficultyKey) => k === 'marketInformationGap' ? signal.difficultyAction : DIFFICULTY_ACTION[k];

  const out: string[] = [`${phraseOf(primaryDifficulty)} — ${actionOf(primaryDifficulty)} 시작하는 게 좋아요.`];
  for (const sec of secondaryDifficulties) {
    const note = buildCombinationNote(pairKey(primaryDifficulty, sec), signal);
    out.push(note || `여기에 ${phraseOf(sec)} — ${actionOf(sec)}도 함께 보세요.`);
  }
  const hasSelfInfo = primaryDifficulty === 'selfInformationGap' || secondaryDifficulties.includes('selfInformationGap');
  if (hasSelfInfo && profile.adaptability.control <= LOW) {
    out.push("내가 뭘 잘하는지 정리도 덜 됐고, 방향을 내가 끌고 가는 감각도 약한 편이라 — 작게 통제 가능한 실험으로 '내가 뭘 잘하는지'부터 확인해보세요.");
  }
  return out;
}

// ─── Theory-grounded confidence ───────────────────────────────────────────────
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface TheoryGroundedConfidence {
  score: number;          // 0–100
  level: ConfidenceLevel;
  drivers: string[];      // short notes on what raised/lowered it
}

// inputCompleteness: 0–1 (how much of the flow was answered).
export function calculateTheoryGroundedConfidence(profile: ConstructProfile, inputCompleteness: number): TheoryGroundedConfidence {
  const s = profile.scct;
  const a = profile.adaptability;
  const d = profile.difficulty;

  const positives = mean(s.selfEfficacy, s.outcomeExpectation, s.goalClarity, a.concern, a.control, a.confidence);
  const difficultyAvg = mean(d.readinessGap, d.selfInformationGap, d.marketInformationGap, d.valueConflict, d.optionOverload);
  const base = clamp(positives - difficultyAvg * 0.5 - s.contextualBarrier * 0.2, 0, 100);
  const completeness = clamp(inputCompleteness, 0, 1);
  const score = Math.round(base * (0.55 + 0.45 * completeness)); // incomplete input caps confidence

  const drivers: string[] = [];
  if (s.selfEfficacy >= HIGH && s.outcomeExpectation >= HIGH) drivers.push('자기효능감·결과기대가 높음(SCCT)');
  if (difficultyAvg >= PRESENT) drivers.push('의사결정 난도가 높음(CDDQ)');
  if (s.contextualBarrier >= HIGH) drivers.push('외부 제약이 큼(SCCT)');
  if (completeness < 1) drivers.push('입력이 아직 완전하지 않음');

  const level: ConfidenceLevel = score >= 66 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score: clamp(score, 0, 100), level, drivers };
}

// ─── Action readiness (Career Adaptability) ───────────────────────────────────
export function inferActionReadiness(profile: ConstructProfile): ActionReadiness {
  const a = profile.adaptability;
  const barrier = profile.scct.contextualBarrier;
  const d = profile.difficulty;
  if (d.readinessGap >= HIGH || barrier >= HIGH) return 'stabilize-first';
  if (a.concern >= 60 && a.control >= 60 && a.confidence >= 60) return 'ready';
  if (a.curiosity >= 60 && a.control < 50) return 'explore-with-structure';
  if (a.control >= 60) return 'ready';
  return 'explore-with-structure';
}

// ─── Evidence layer ───────────────────────────────────────────────────────────
// Banded confidence so the result never reads like a quiz score.
function scoreToBand(score: number): ConfidenceBand {
  if (score >= 80) return '매우 높음';
  if (score >= 60) return '높음';
  if (score >= 35) return '중간';
  return '낮음';
}

export function generateConstructBasedExplanation(
  profile: ConstructProfile,
  opts: {
    inputCompleteness: number;
    bestMoveLabel?: string;
    gateBarriers?: string[];                       // practical barriers derived from readiness gates
    downgraded?: { label: string; reason: string }; // a higher-fit option pushed down (for MCDA link)
    mode?: ResultMode;                             // frames the narrative's opening sentence
    strategicLabel?: string;                       // the identity-aligned long-term direction
    practicalLabel?: string;                       // the safe bridge move to make now
    safePracticalMove?: boolean;                   // true when the now move is low financial risk
    // P1 — context for marketInformationGap surface copy resolution.
    mainTypeKey?: MainTypeKey;
    bestMoveKey?: CareerOptionKey;
    gates?: ReadinessGates;
    // P1.1 — also consider strategicDirection and coreExperiment when resolving signal copy.
    strategicDirectionKey?: CareerOptionKey;
    coreExperimentSourceKey?: CareerOptionKey;
  },
): EvidenceLayer {
  // Resolve external-signal surface copy once; reused across difficulty/uncertainty/missing-info/narrative.
  const signal = resolveExternalSignalCopy({
    mainTypeKey: opts.mainTypeKey,
    bestMoveKey: opts.bestMoveKey,
    strategicDirectionKey: opts.strategicDirectionKey,
    coreExperimentSourceKey: opts.coreExperimentSourceKey,
    gates: opts.gates,
  });
  const s = profile.scct;
  const a = profile.adaptability;
  const d = profile.difficulty;
  const confidence = calculateTheoryGroundedConfidence(profile, opts.inputCompleteness);
  const pattern = inferDecisionDifficultyPattern(profile);
  const readiness = inferActionReadiness(profile);

  // ── construct signals (human label + plain note + framework for the theory section) ──
  const constructSignals: ConstructSignal[] = [];
  const sig = (value: number, construct: string, humanLabel: string, framework: string, highNote: string, lowNote: string) => {
    if (value >= HIGH && highNote) constructSignals.push({ construct, humanLabel, framework, level: 'high', note: highNote });
    else if (value <= LOW && lowNote) constructSignals.push({ construct, humanLabel, framework, level: 'low', note: lowNote });
  };
  sig(s.selfEfficacy, '자기효능감', '실행 자신감', 'SCCT', '잘 해낼 수 있다는 믿음이 높아, 실행 동력이 됩니다.', '잘 해낼 수 있을지 확신이 낮아, 작은 성공 경험부터 쌓는 게 좋아요.');
  sig(s.outcomeExpectation, '결과기대', '기대 결과', 'SCCT', '노력하면 시장이 반응할 거란 기대가 높아요.', '시장이 반응할지에 대한 기대가 낮아, 시장 확인이 먼저예요.');
  sig(a.control, '통제감', '방향을 내가 끌고 가는 감각', '진로적응성', '커리어를 스스로 끌고 간다는 감각이 강해요.', '지금은 스스로 끌고 간다는 감각이 약해, 작은 통제 가능한 실험이 맞아요.');
  sig(a.curiosity, '호기심', '탐색 성향', '진로적응성', '새로운 길을 탐색하려는 성향이 높아요.', '');
  sig(d.optionOverload, '선택지 과잉', '선택지 과잉', 'CDDQ', '고려 중인 선택지가 많아, 우선순위를 좁히는 게 먼저예요.', '');
  sig(d.valueConflict, '가치 충돌', '가치 충돌', 'CDDQ', '원하는 우선순위들이 서로 부딪혀, 선택 기준 정리가 필요해요.', '');
  if (s.contextualBarrier >= HIGH) constructSignals.push({ construct: '외부 제약', humanLabel: '현실 장벽', framework: 'SCCT', level: 'high', note: '시간·재정·환경 제약이 커, 리스크가 큰 선택은 뒤로 미루는 편이 안전해요.' });

  // ── contextual barriers (practical, even if not the top chip) ──
  const contextualBarriers: string[] = [...(opts.gateBarriers ?? [])];
  if (s.contextualBarrier >= HIGH && !contextualBarriers.includes('시간·환경 제약')) contextualBarriers.push('시간·환경 제약');

  // ── why this recommendation: 자신감 → 기대결과 → 적응성 → 의사결정 난도 → 가치 우선순위 → 현실 장벽 ──
  const why: string[] = [];

  // SCCT (self-efficacy × outcome expectation) — P1.1 context-aware seHi/!oeHi branch.
  // The "잘 해낼 자신은 있지만…" line previously hardcoded "시장 확인을 먼저 권해요" and
  // leaked startup language into lowOptionVisibility and burnout. Now the line resolves per
  // mainType + signal context; for overloadedBurnout it's replaced with an energy-first line.
  const seHi = s.selfEfficacy >= HIGH, oeHi = s.outcomeExpectation >= HIGH;
  const isBurnout = opts.mainTypeKey === 'overloadedBurnout';
  const isLowOpt = opts.mainTypeKey === 'lowOptionVisibility';
  const isMarketSignal = signal === SIGNAL_COPY_MARKET;
  if (seHi && oeHi) {
    why.push(isMarketSignal
      ? '잘 해낼 자신과 실제 반응이 따라올 거란 기대가 모두 높아, 실행 동력이 충분해요.'
      : '잘 해낼 자신과 결과가 따라올 거란 기대가 모두 높아, 실행 동력이 충분해요.');
  } else if (seHi && !oeHi) {
    if (isBurnout) {
      // Burnout: energy-first replacement (drops information-gathering directives).
      why.push('지금은 반응을 확인하기보다 에너지 회복이 먼저예요.');
    } else if (isLowOpt) {
      why.push('해낼 수 있는 힘은 있지만 아직 선택지가 선명하지 않아, 먼저 후보를 보이게 만드는 편이 좋아요.');
    } else if (isMarketSignal) {
      why.push('잘 해낼 자신은 있지만 실제 반응은 아직 불확실해, 작게 확인해보는 편이 안전해요.');
    } else {
      why.push('잘 해낼 자신은 있지만 결과가 따라올지는 아직 불확실해, 작게 확인해보는 편이 안전해요.');
    }
  } else if (!seHi && oeHi) {
    why.push(isMarketSignal
      ? '실제 반응 신호는 있어 보이지만 스스로에 대한 확신이 낮아, 작은 성공 경험부터 쌓는 게 좋아요.'
      : '결과가 따라올 가능성은 보이지만 스스로에 대한 확신이 낮아, 작은 성공 경험부터 쌓는 게 좋아요.');
  } else {
    why.push('실행 자신감과 기대 결과가 아직 또렷하지 않아, 작게 시작해 신호를 모아보세요.');
  }

  // High ability + low runway → name the real blocker (not desire/ability, but runway/validation).
  const runwayBarrier = contextualBarriers.some((b) => b.includes('런웨이'));
  // P1.1 — gate-barrier copy is now context-aware ("실제 반응 미확인" / "외부 반응 미확인"
  // / "선택지 단서 부족" / "시장 반응 미확인" legacy). Detect any of them.
  const marketBarrier = contextualBarriers.some((b) =>
    b.includes('시장') || b.includes('실제 반응') || b.includes('외부 반응') || b.includes('선택지 단서'),
  );
  // When we attribute the blocker, surface the same label the user is reading.
  const marketBlockerLabel = isMarketSignal
    ? '실제 반응 확인'
    : isLowOpt
      ? '선택지 단서 확인'
      : '외부 반응 확인';
  if (seHi && runwayBarrier) {
    const parts = ['재정 런웨이'];
    if (marketBarrier) parts.push(marketBlockerLabel);
    const last = parts[parts.length - 1];
    why.push(`지금의 걸림돌은 의욕이나 실력이 아니라, ${parts.join('와 ')}${hasBatchim(last) ? '이에요' : '예요'}.`);
  }

  // Career Adaptability (via action readiness)
  // P1.3 — softer phrasing: drop "선택 통제감" / "구조 있는 탐색" jargon, use plain language.
  if (readiness === 'ready') why.push('미래 준비도·자신감·방향감각이 받쳐줘서, 지금은 실행에 무게를 둘 수 있어요.');
  else if (readiness === 'explore-with-structure') why.push("호기심은 있지만 지금 방향을 내가 끌고 간다는 감각이 약해, 기한과 범위를 정해놓고 작게 시도해보는 방식이 잘 맞아요.");
  else why.push('지금은 기반(에너지·여건)부터 다지는 편이 안전해요.');

  // CDDQ (decision difficulty) — primary + up to 2 combinations (context-resolved signal copy).
  // P1.1 burnout gating: when mainType is overloadedBurnout, the user's primary need is
  // energy recovery, not option/market information. Suppress the CDDQ lines whose primary
  // action would point the user back into evaluation work; keep readinessGap (which is
  // the burnout-aligned signal) so the evidence still surfaces a coherent reason.
  if (isBurnout) {
    // Build the CDDQ explanation but drop any line that would push the user back into
    // option/market/info-gathering work. Only readinessGap-aligned lines survive.
    const allLines = buildDifficultyExplanation(profile, pattern, signal);
    const INFO_TOKENS = ['후보별', '사례·정보', '작은 반응', '시장', '선택지', '강점·성과를 정리'];
    const energyAligned = allLines.filter((line) =>
      line.includes('결정 준비') ||
      line.includes('에너지') ||
      line.includes('큰 결정보다') ||
      line.includes('회복'),
    );
    if (energyAligned.length > 0) {
      for (const line of energyAligned) why.push(line);
    } else if (pattern.primaryDifficulty) {
      // None of the CDDQ lines aligned with energy → replace with an energy-first sentence.
      why.push('지금은 정보 정리보다, 에너지 회복이 다음 결정의 성공률을 높여요.');
    }
    // Also drop any non-energy line that leaked through (defensive — pattern matching).
    for (let i = why.length - 1; i >= 0; i--) {
      if (INFO_TOKENS.some((t) => why[i].includes(t)) && !why[i].includes('에너지') && !why[i].includes('회복')) {
        why.splice(i, 1);
      }
    }
  } else {
    for (const line of buildDifficultyExplanation(profile, pattern, signal)) why.push(line);
  }

  // MCDA (value priorities → option)
  const priorities = topPriorities(profile.mcda);
  if (priorities.length > 0) {
    const joined = priorities.join('·');
    if (opts.downgraded) {
      // P1.3 — resolver-aware MCDA attribution: strip legacy "시장 검증 필요" / "시장 검증"
      // from rationale strings so the MCDA bullet uses the same lexicon as the rest of the
      // result (e.g. "실제 반응 확인 필요" / "외부 정보 확인 필요" / "선택지 정보 확인 필요").
      const resolvedReason = opts.downgraded.reason
        .replace(/시장 검증 필요/g, `${signal.shortLabel}`)
        .replace(/시장 검증/g, `${marketBlockerLabel}`);
      why.push(`우선순위로 둔 ${joined}${objJosa(joined)} 기준으로 보면, ${opts.downgraded.label}${topicJosa(opts.downgraded.label)} 매력적이지만 ${resolvedReason} 때문에 우선순위에서 내려갔어요.`);
    } else {
      why.push(`우선순위로 둔 ${joined}${objJosa(joined)} 기준으로 보면, 지금 1순위가 그 기준에 가장 잘 맞아요.`);
    }
  }

  // Readiness gate constraint (practical barriers)
  if (contextualBarriers.length > 0) {
    why.push(`지금은 ${contextualBarriers.join(', ')} 같은 현실 제약이 있어, 리스크가 큰 선택은 뒤로 미루는 편이 안전해요.`);
  } else {
    why.push('지금 여건상 큰 현실 제약은 보이지 않아요.');
  }

  // ── confidence drivers (what raised / lowered) ──
  const raised: string[] = [];
  if (s.selfEfficacy >= HIGH) raised.push('실행 자신감이 높음');
  if (s.outcomeExpectation >= HIGH) raised.push('기대 결과가 높음');
  if (a.control >= HIGH) raised.push('방향을 내가 끌고 가는 감각이 강함');
  if (s.contextualSupport >= HIGH) raised.push('현실 여건의 지지');
  if (opts.inputCompleteness >= 1) raised.push('입력이 충분함');

  const lowered: string[] = [];
  if (d.marketInformationGap >= PRESENT) lowered.push(`${signal.shortMissing} 부족`);
  if (d.selfInformationGap >= PRESENT) lowered.push('자기 정보 부족');
  if (d.optionOverload >= PRESENT) lowered.push('선택지 과잉');
  if (d.valueConflict >= PRESENT) lowered.push('가치 충돌');
  if (d.readinessGap >= PRESENT) lowered.push('결정 준비 부족');
  if (s.contextualBarrier >= PRESENT) lowered.push('현실 장벽(시간·재정)');
  if (opts.inputCompleteness < 1) lowered.push('입력이 아직 완전하지 않음');
  const confidenceDrivers: ConfidenceDrivers = { raised, lowered };

  // ── confidence band + meaning note (band is primary; never lead with a raw score) ──
  const confidenceBand = scoreToBand(confidence.score);
  // '판단 확실성' = how much EVIDENCE supports treating this as a long-term direction.
  // Explicitly not about the user's capability or whether the move is safe.
  const confidenceNote = "'판단 확실성'은 내 능력이나 추천의 안전성이 아니라, 이 추천을 '장기 방향'으로 볼 만한 근거가 얼마나 모였는지를 뜻해요.";

  // ── uncertainty + missing info ──
  const uncertaintySignals: string[] = [];
  if (d.marketInformationGap >= PRESENT) uncertaintySignals.push(signal.uncertaintySignal);
  if (d.selfInformationGap >= PRESENT) uncertaintySignals.push('자기 강점·선호 정보가 더 필요합니다.');
  if (confidence.level === 'low') uncertaintySignals.push('전반적으로 확신이 낮은 편이라 단정은 이릅니다.');
  if (opts.inputCompleteness < 1) uncertaintySignals.push('아직 답하지 않은 질문이 있어요.');

  const missingInformation: string[] = [];
  if (d.marketInformationGap >= PRESENT) missingInformation.push(signal.missingInformation);
  if (d.selfInformationGap >= PRESENT) missingInformation.push('강점·성과 증거(포트폴리오 정리)');
  if (d.readinessGap >= PRESENT) missingInformation.push('에너지·재정 여건 점검');
  if (opts.inputCompleteness < 1) missingInformation.push('남은 질문에 대한 답');

  // ── narrative: a connected counseling paragraph (the main explanation) ──
  // Distinguishes 실행 준비도 (action readiness) from 추천 신뢰도 (confidence).
  const move = opts.bestMoveLabel ?? '지금 1순위';
  const euroJosa = (w: string): string => (hasBatchim(w) ? '으로' : '로');
  const practical = opts.practicalLabel ?? move;
  const sentences: string[] = [];

  if (opts.mode === 'conditional_led' && opts.strategicLabel) {
    // direction is valid; current conditions require validation first → safe bridge + experiment
    const valReason = d.marketInformationGap >= PRESENT ? signal.narrativeReason : '아직 조건이 다 갖춰지지 않아서';
    sentences.push(`'${opts.strategicLabel}' 방향은 맞지만, ${valReason} 지금은 '${practical}'${euroJosa(practical)} 수입 안전판을 두고 30일 실험으로 먼저 검증하는 편이 안전해요.`);
  } else if (opts.mode === 'safety_bridge' && opts.strategicLabel) {
    if (seHi && runwayBarrier) {
      const bp = ['재정 런웨이'];
      if (marketBarrier) bp.push(marketBlockerLabel); // P1.3 — replace "시장 검증" with context-resolved label
      sentences.push(`'${opts.strategicLabel}' 방향은 맞고 실력도 충분하지만, 지금의 걸림돌은 ${bp.join('와 ')}${hasBatchim(bp[bp.length - 1]) ? '이에요' : '예요'}. 그래서 지금은 '${practical}'${euroJosa(practical)} 발판을 먼저 다지는 편이 안전해요.`);
    } else {
      sentences.push(`'${opts.strategicLabel}' 방향이 끌리지만, 지금은 준비가 더 필요해 '${practical}'${euroJosa(practical)} 발판을 먼저 다지는 편이 안전해요.`);
    }
  } else {
    // direct_now / recovery_first → readiness framing + blocker/difficulty
    if (readiness === 'ready') sentences.push(`지금은 '${move}'${objJosa(move)} 작게 실행할 준비는 되어 있어요.`);
    // P1.3 — softer than "구조 있게 시작하기 좋은 때예요"
    else if (readiness === 'explore-with-structure') sentences.push(`지금은 '${move}'${objJosa(move)} 기한과 범위를 정해놓고 작게 시도해보기 좋은 때예요.`);
    else sentences.push(`지금은 새로 벌이기보다 기반을 먼저 다지며 '${move}'에 무게를 둘 때예요.`);

    if (seHi && runwayBarrier) {
      const bp = ['재정 런웨이'];
      if (marketBarrier) bp.push(marketBlockerLabel); // P1.3 — context-resolved label
      sentences.push(`잘 해낼 자신은 충분하지만, 지금의 걸림돌은 의욕이나 실력이 아니라 ${bp.join('와 ')}${hasBatchim(bp[bp.length - 1]) ? '이에요' : '예요'}.`);
    } else if (pattern.primaryDifficulty) {
      // Two full sentences — stripping the trailing '요' produced banmal mid-paragraph
      // (e.g. "…덜 정돈됐어, 큰 결정보다…"). Every DIFFICULTY_PHRASE ends in '요' and
      // reads cleanly as its own sentence.
      sentences.push(`${DIFFICULTY_PHRASE[pattern.primaryDifficulty]}. ${DIFFICULTY_ACTION[pattern.primaryDifficulty]} 풀어가는 게 좋아요.`);
    } else if (priorities.length > 0) {
      sentences.push(`우선순위로 둔 ${priorities.join('·')}${objJosa(priorities[priorities.length - 1])} 보면, 지금 1순위가 그 기준에 가장 잘 맞아요.`);
    }
  }

  // P1.3 — rephrase confidence sentence: avoid quiz-grade reading of "확실성 낮음".
  // The base line frames it as "evidence for long-term direction", not as a score on the user.
  // P3.9 — goal-gradient framing: "근거가 적다"(deficit) → "실험이 채운다"(progress).
  // The 30-day experiment is positioned as the thing that completes the evidence,
  // turning low confidence into an open loop instead of a verdict.
  let confidenceSentence: string;
  if (confidenceBand === '낮음') {
    confidenceSentence = '이 추천을 장기 방향으로 굳히기엔 근거가 더 필요한 단계예요 — 그 근거는 30일 실험이 채워 줍니다.';
  } else if (confidenceBand === '중간') {
    confidenceSentence = '이 추천을 장기 방향으로 굳히기엔 근거가 절반쯤 모였어요 — 나머지는 30일 실험이 채워 줍니다.';
  } else {
    confidenceSentence = `현재 판단의 확실성은 '${confidenceBand}'이에요.`;
  }
  // P1.3 — context-aware tail. Burnout / lowOpt users get a frame-aligned closing
  // *before* the generic "ready + 낮음" branch fires; otherwise high-curiosity burnout
  // users would still receive "장기 선택으로 확정하려면 선택지 정보 확인이 필요해요." which
  // contradicts the energy-first strategy.
  if (opts.mainTypeKey === 'overloadedBurnout' && (confidenceBand === '낮음' || confidenceBand === '중간')) {
    confidenceSentence += ' 이 선택 자체는 가장 안전한 길이고, 다음 결정은 에너지가 돌아온 뒤에 다시 보면 됩니다.';
  } else if (opts.mainTypeKey === 'lowOptionVisibility' && (confidenceBand === '낮음' || confidenceBand === '중간')) {
    confidenceSentence += ' 이 선택 자체는 안전한 편이고, 다음 달엔 새로 떠오른 후보를 기준으로 다시 판단하면 됩니다.';
  } else if (readiness === 'ready' && (confidenceBand === '낮음' || confidenceBand === '중간')) {
    const missing = d.marketInformationGap >= PRESENT ? signal.shortMissing : '추가 정보';
    confidenceSentence += ` 지금 작게 실행할 준비는 되어 있지만, 장기 선택으로 확정하려면 ${missing} 확인이 필요해요.`;
  } else if (confidenceBand === '낮음') {
    // low certainty on a safe move: reassure the move itself, flag the long-term direction.
    confidenceSentence += opts.safePracticalMove
      ? ' 이 선택 자체는 안전한 편이지만, 장기 방향을 확정하기에는 아직 모을 근거가 남아 있어요.'
      : ' 아래 정보를 채우면 확실성이 올라가요.';
  }
  sentences.push(confidenceSentence);
  const narrative = sentences.join(' ');

  // theory section only (collapsible) — frameworks named here, not in the main UI
  const theoryGroundedSummary =
    `이 결과는 SCCT(자기효능감·결과기대), 진로적응성(관심·통제·호기심·자신감), CDDQ(의사결정 난도)를 함께 반영했습니다. ` +
    `현재 모인 근거 수준은 '${confidenceBand}'이며, 점수가 아니라 무엇을 더 확인하면 좋은지를 함께 봅니다.`;

  return {
    theoryGroundedSummary,
    narrative,
    whyThisRecommendation: why,
    constructSignals,
    uncertaintySignals,
    confidenceScore: confidence.score,
    confidenceBand,
    confidenceDrivers,
    confidenceNote,
    contextualBarriers,
    missingInformation,
    actionReadiness: readiness,
  };
}
