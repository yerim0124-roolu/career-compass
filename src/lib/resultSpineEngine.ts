// Career Compass 2.0 — ResultSpine assembly engine.
// Deterministic, no LLM, no UI, no backend. Combines the normalized CareerVector
// (identity + option fit), the readiness gates (timing authority), and inferred
// archetypes (secondary tags only) into the product's decision-support output.
//
// Core principle: the result must NOT stop at an archetype/personality label. It
// lands on a current best move, prepare-after / conditional / pause options, the
// conditions that would flip the recommendation, a 30-day experiment, and 30-day
// reevaluation criteria. Fit ranks candidates; gates decide timing and can
// downgrade a high-fit option. Copy is calm, condition-framed, no fortune-telling.

import type {
  CareerVector,
  CareerVectorKey,
  CareerOptionKey,
  ReadinessGates,
  OptionReadiness,
  IdentityAxis,
  MoveRecommendation,
  ReversalRule,
  ReversalConditions,
  WarningCondition,
  ThirtyDayExperiment,
  ReevaluationCriteria,
  SajuLayer,
  ResultSpine,
} from '../types/careerCompass.ts';
import type { ConstructProfile, ResultMode, MeasuredSignals, UserProfile } from '../types/careerCompass.ts';
import { inferCareerArchetypes, rankCareerOptions } from './careerVectorEngine.ts';
import type { ArchetypeMatch } from './careerVectorEngine.ts';
import { classifyDecisionTiming, generateReversalConditions, generateReevaluationCriteria } from './readinessGateEngine.ts';
import { createEmptyConstructProfile, generateConstructBasedExplanation, inferActionReadiness } from './careerConstructEngine.ts';
import { buildSolutionLayer, buildExecutionPlan } from './solutionModuleEngine.ts';

// ─── Identity axis (varies by vector combination, not just archetype) ──────────
// Built from the top two *identity* axes so two people with the same dominant
// archetype but different secondary axes get different one-line statements.

const IDENTITY_AXES: readonly CareerVectorKey[] = [
  'expertise', 'autonomy', 'marketOrientation', 'creativity', 'analysisOrientation',
  'ventureOrientation', 'executionDrive', 'impactOrientation', 'stability',
];

// Grounded, non-grandiose phrasing — the identity should read as "what fits you now",
// not a lofty title.
const AXIS_BASE: Record<CareerVectorKey, string> = {
  expertise: '전문성을 기반으로',
  autonomy: '내 방식대로 일하며',
  marketOrientation: '시장 감각을 살려',
  creativity: '창작을 중심에 두고',
  analysisOrientation: '분석을 바탕으로',
  ventureOrientation: '직접 만들어보며',
  executionDrive: '실행력을 살려',
  impactOrientation: '영향력을 조금씩 넓히며',
  stability: '안정적 기반 위에서',
  recoveryNeed: '지금은 재정비를 우선하며',
  riskTolerance: '리스크를 감수하며',
  financialReadiness: '재정 여력을 바탕으로',
  marketValidationNeed: '검증을 거치며',
};

const AXIS_CLAUSE: Record<CareerVectorKey, string> = {
  expertise: '전문성을 깊게 다지는',
  autonomy: '스스로 방향을 정하는',
  marketOrientation: '시장과 연결되는',
  creativity: '콘텐츠로 표현하는',
  analysisOrientation: '해석을 더하는',
  ventureOrientation: '새로운 판을 만드는',
  executionDrive: '실행으로 옮기는',
  impactOrientation: '영향력을 넓히는',
  stability: '기반을 다지는',
  recoveryNeed: '에너지를 회복하는',
  riskTolerance: '도전을 감내하는',
  financialReadiness: '현실을 함께 챙기는',
  marketValidationNeed: '검증을 쌓는',
};

// Single-axis identity templates — used when the range lens is OFF (second axis is not
// substantively co-high). Avoids implying multi-identity integration the user didn't signal.
const AXIS_SINGLE: Record<CareerVectorKey, string> = {
  expertise: '전문성을 깊게 다지는 사람',
  autonomy: '내 방식대로 일하는 사람',
  marketOrientation: '시장 감각으로 일하는 사람',
  creativity: '창작을 중심에 둔 사람',
  analysisOrientation: '해석과 분석으로 일하는 사람',
  ventureOrientation: '직접 판을 만들어보는 사람',
  executionDrive: '실행으로 옮기는 사람',
  impactOrientation: '영향력을 넓혀가는 사람',
  stability: '안정적 기반 위에서 일하는 사람',
  recoveryNeed: '지금은 재정비가 먼저인 사람',
  riskTolerance: '리스크를 감내하며 일하는 사람',
  financialReadiness: '재정 여력을 바탕으로 일하는 사람',
  marketValidationNeed: '검증을 쌓아가는 사람',
};

// stable sort: value desc, then declared axis order (deterministic)
function sortedIdentityAxes(vector: CareerVector): CareerVectorKey[] {
  return [...IDENTITY_AXES].sort((a, b) => vector[b] - vector[a] || IDENTITY_AXES.indexOf(a) - IDENTITY_AXES.indexOf(b));
}

export interface IdentityContext {
  preferredExperimentKey?: CareerOptionKey;
  gates?: ReadinessGates;
  // P1.1 — composer chip suppression for mainTypes where multi-identity framing is off-topic.
  mainTypeKey?: import('../types/careerCompass.ts').MainTypeKey;
}

// P1.1 — composer chip should only surface when the user has genuinely broad signal:
// either the range lens is on (top two axes ≥ 50, diff < 25, first ≥ 60) OR three+
// distinct identity axes are at least moderately high (≥ V_MOD = 45). Without this
// guard, two-role users (e.g. venture + freelancer) get "커리어 조합가" they didn't earn.
function shouldKeepComposerChip(vector: CareerVector): boolean {
  const sorted = sortedIdentityAxes(vector);
  const first = vector[sorted[0]];
  const second = vector[sorted[1]];
  const rangeOn = first >= 60 && second >= 50 && (first - second) < 25;
  const broadAxes = IDENTITY_AXES.filter((k) => vector[k] >= 45).length;
  return rangeOn || broadAxes >= 3;
}

export function buildIdentityAxis(vector: CareerVector, archetypes: ArchetypeMatch[], ctx: IdentityContext = {}): IdentityAxis {
  const rawTags = archetypes.slice(0, 3).map((a) => a.key); // secondary tags only
  // P1.1 composer chip gating: suppress for mainTypes whose primary frame is not
  // multi-identity (burnout / lowOptionVisibility), AND for narrow vectors that don't
  // pass shouldKeepComposerChip. Both checks must allow the chip for it to survive.
  const mainTypeAllowsComposer = ctx.mainTypeKey !== 'overloadedBurnout' && ctx.mainTypeKey !== 'lowOptionVisibility';
  const archetypeTags = (shouldKeepComposerChip(vector) && mainTypeAllowsComposer)
    ? rawTags
    : rawTags.filter((t) => t !== 'careerComposer');
  const ordered = sortedIdentityAxes(vector);
  const maxIdentity = vector[ordered[0]];
  const lowRunway = ctx.gates ? (ctx.gates.runway === 'critical' || ctx.gates.runway === 'tight' || ctx.gates.runway === 'unknown') : false;
  const lowValidation = ctx.gates ? (ctx.gates.marketValidation === 'unvalidated' || ctx.gates.marketValidation === 'early') : false;

  let statement: string;
  if (maxIdentity <= 0 && vector.recoveryNeed <= 0) {
    statement = '아직 방향을 탐색하고 있는 사람';
  } else if (vector.recoveryNeed > maxIdentity) {
    // recovery dominates → recovery-framed identity (not a "type")
    statement = '지금은 방향보다 재정비가 먼저인 사람';
  } else if (vector.creativity >= 55 && ctx.preferredExperimentKey === 'contentBrand') {
    // creator-heavy + content experiment → keep 창작/콘텐츠/표현 in the identity
    statement = '콘텐츠와 표현으로 내 방식의 영향력을 실험해보고 싶은 사람';
  } else if (vector.ventureOrientation >= 55 && (lowRunway || lowValidation)) {
    // venture-leaning but constrained → acknowledge the pull, signal "validate first"
    statement = '직접 만들어보고 싶은 욕구가 크지만, 지금은 검증을 먼저 해야 하는 사람';
  } else {
    // P1 range-lens toggle: only compose a 2-axis identity when the FIRST axis is itself
    // high (≥ 60, V_HIGH) AND the second axis is substantively present (≥ 50) AND within
    // striking range (diff < 25). Otherwise the statement reads as single-axis. The
    // first-axis floor (added in P1.1) prevents lowOpt/burnout profiles whose normalized
    // axes drift up to ~50 from getting an unearned multi-identity statement.
    const primary = ordered[0];
    const second = ordered[1];
    const firstVal = vector[primary];
    const secondVal = vector[second];
    if (firstVal >= 60 && secondVal >= 50 && (firstVal - secondVal) < 25) {
      statement = `${AXIS_BASE[primary]} ${AXIS_CLAUSE[second]} 사람`;
    } else {
      statement = AXIS_SINGLE[primary];
    }
  }

  return { statement, archetypeTags };
}

// ─── Option timing results (fit + gate timing combined) ────────────────────────

interface OptionTimingResult {
  optionKey: CareerOptionKey;
  label: string;
  fit: number;
  timing: OptionReadiness;
  bindingConstraints: ReturnType<typeof classifyDecisionTiming>['bindingConstraints'];
  rationale: string;
}

export function buildOptionTimingResults(vector: CareerVector, gates: ReadinessGates): OptionTimingResult[] {
  // rankCareerOptions is already sorted by fit desc (deterministic tiebreak by key).
  return rankCareerOptions(vector).map((o) => {
    const t = classifyDecisionTiming(o.optionKey, gates, { identityFit: o.fit });
    return { optionKey: o.optionKey, label: o.label, fit: o.fit, timing: t.timing, bindingConstraints: t.bindingConstraints, rationale: t.rationale };
  });
}

// ─── Move selection ─────────────────────────────────────────────────────────

const SAFE_FALLBACK: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>(['restRecover', 'stayRedesign']);

// "Why this, now + the first concrete nudge" — answers "그래서 뭘 하면 되나?".
// P3.12 — SAFE_DEFAULT_RESEARCH 적용: safe 옵션도 '존버'가 아니라 구체적 능동 행동으로.
// 도전 옵션이 now라는 건 게이트를 다 통과했다는 뜻 → 소심한 '작은 검증부터'가 아니라
// '지금이 움직이기 좋은 때'로. 단 과신·점쟁이 톤은 피하고 "~기 좋은 때/단계예요"로.
const NOW_RATIONALE: Record<CareerOptionKey, string> = {
  stayRedesign: '떠나기 전에 지금 자리에서 바꿀 수 있는 게 더 많아요. 못마땅한 1가지를 골라 상사에게 제안하거나 맡을 프로젝트를 바꿔, 수입을 지키며 변화를 만드는 것부터 시작해 보세요.',
  jobChange: '수입을 지키면서 환경을 바꾸는 길이에요. 이번 달엔 성과 케이스 2~3개를 정리해 시장이 어떻게 반응하는지부터 떠보세요.',
  startup: '여건이 받쳐주는 지금이 시작하기 좋은 때예요. 큰 베팅 전에 관심 있는 사람 10명과 대화로 문제·수요부터 확인해 보세요.',
  independent: '쌓은 전문성을 지금 바로 시장에 내놓을 수 있는 단계예요. 완벽한 준비보다 첫 유료 일감 한 건으로 실제 반응을 받아보세요.',
  contentBrand: '전문성을 바깥의 언어로 옮겨 반응을 확인하기 좋은 때예요. 만든 것 하나를 정리해 글로 내보내는 것부터.',
  advisoryTeaching: '쌓은 전문성을 수익·신뢰로 바꿔볼 수 있는 단계예요. 작은 유료 세션이나 자문 1회로 수요부터 확인해 보세요.',
  investAnalysis: '시장을 해석하는 강점을 눈에 보이는 결과물로 만들기 좋은 때예요. 분석 한 편을 공개해 반응을 받아보세요.',
  restRecover: '지금은 새 판을 벌이기보다 에너지를 먼저 회복하는 편이, 다음 선택의 성공률을 높여요. 2주 회복 루틴부터 시작해요.',
};

function moveRationale(r: OptionTimingResult): string {
  if (r.timing === 'now') return NOW_RATIONALE[r.optionKey];
  // gate rationale is already neutral and condition-framed (e.g. "… → 준비 후 실행.")
  return r.rationale;
}

function toMove(r: OptionTimingResult): MoveRecommendation {
  return { optionKey: r.optionKey, label: r.label, readiness: r.timing, rationale: moveRationale(r) };
}

// Inputs are fit-desc sorted, so the first match of a filter is the highest-fit one.
function topByTiming(results: OptionTimingResult[], timing: OptionReadiness, excludeKey?: CareerOptionKey): OptionTimingResult | null {
  return results.find((r) => r.timing === timing && r.optionKey !== excludeKey) ?? null;
}

// currentBestMove never returns a gate-downgraded high-risk option: gate timing
// already excludes those from "now", and the fallback chain prefers safe moves.
export function selectCurrentBestMove(results: OptionTimingResult[]): MoveRecommendation {
  const now = results.find((r) => r.timing === 'now');
  if (now) return toMove(now);
  const safe = results.find((r) => SAFE_FALLBACK.has(r.optionKey));
  if (safe) return toMove(safe);
  const prep = results.find((r) => r.timing === 'prepareAfter');
  if (prep) return toMove(prep);
  return toMove(results[0]);
}

export function selectPrepareAfterOption(results: OptionTimingResult[], excludeKey: CareerOptionKey): MoveRecommendation | null {
  const r = topByTiming(results, 'prepareAfter', excludeKey);
  return r ? toMove(r) : null;
}

export function selectConditionalOption(results: OptionTimingResult[], excludeKey: CareerOptionKey): MoveRecommendation | null {
  const r = topByTiming(results, 'conditional', excludeKey);
  return r ? toMove(r) : null;
}

export function selectPauseOption(results: OptionTimingResult[], excludeKey: CareerOptionKey): MoveRecommendation | null {
  const r = topByTiming(results, 'pause', excludeKey);
  return r ? toMove(r) : null;
}

// ─── 30-day experiment ─────────────────────────────────────────────────────────

const EXPERIMENT_TEMPLATES: Record<CareerOptionKey, { label: string; evidenceToCheck: string[] }> = {
  stayRedesign: { label: '현재 역할에서 바꾸고 싶은 1가지를 정해 2주간 재설계 실험', evidenceToCheck: ['업무 만족도가 달라졌는지', '팀/상사와 재설계 합의가 가능한지'] },
  jobChange: { label: '타깃 직무 공고 10개를 분석하고 이력서 1차 업데이트', evidenceToCheck: ['지원 가능한 공고 수', '서류 통과·연락 여부'] },
  startup: { label: '관심 있는 사람 10명과 대화로 문제·가설 확인', evidenceToCheck: ['돈·시간을 써서라도 해결하려는 반응', '핵심 문제가 반복해서 확인되는지'] },
  independent: { label: '유료 자문/프로젝트 1건을 작게 테스트 수주', evidenceToCheck: ['문의·계약 수', '제시한 단가가 수용되는지'] },
  contentBrand: { label: '콘텐츠 4개를 발행하고 반응 측정', evidenceToCheck: ['저장·공유·문의 수', '팔로우 증가 여부'] },
  advisoryTeaching: { label: '소규모 유료 세션/강의 1회 진행', evidenceToCheck: ['신청 수', '후속 문의·재요청 여부'] },
  investAnalysis: { label: '글·리포트로 생각을 정리해 한 편 공유', evidenceToCheck: ['조회·저장 수', '피드백·문의가 오는지'] },
  restRecover: { label: '2주 회복 루틴 + 1주 가벼운 탐색', evidenceToCheck: ['에너지가 회복되는지', '다시 떠오르는 관심 주제가 있는지'] },
};

export function buildThirtyDayExperiment(optionKey: CareerOptionKey): ThirtyDayExperiment {
  const t = EXPERIMENT_TEMPLATES[optionKey];
  return { id: `exp-${optionKey}`, label: t.label, evidenceToCheck: t.evidenceToCheck };
}

// ─── Reversal conditions (always ≥1) ───────────────────────────────────────────

// Positive evidence only: what would make a gated alternative rise to #1.
function buildPromotionConditions(results: OptionTimingResult[], bestKey: CareerOptionKey, gates: ReadinessGates): ReversalRule[] {
  // restRecover is a fallback, never an aspirational "1순위로 올라갈" target — exclude it.
  const gatedAlternatives = results.filter((r) => r.optionKey !== bestKey && r.optionKey !== 'restRecover' && r.timing !== 'now');
  const rules: ReversalRule[] = [];
  const seenConditions = new Set<string>();
  for (const alt of gatedAlternatives) {
    for (const rule of generateReversalConditions(alt.optionKey, gates)) {
      const signature = rule.conditions.map((c) => c.condition).join('|');
      if (seenConditions.has(signature)) continue; // dedupe identical-condition rules (avoids canned feel)
      seenConditions.add(signature);
      rules.push(rule);
    }
    if (rules.length >= 2) break;
  }
  // No fabricated fallback: if nothing is gated, there is no positive condition that
  // would change the ranking. Negative evidence belongs in the warning section below.
  return rules.slice(0, 2);
}

const MARKET_FACING_FOR_WARNING: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
  'startup', 'independent', 'contentBrand', 'advisoryTeaching', 'investAnalysis',
]);

// Negative evidence only: signals that should LOWER the current best move. Always ≥1.
function buildWarningConditions(bestKey: CareerOptionKey, gates: ReadinessGates): WarningCondition[] {
  const warnings: WarningCondition[] = [{ signal: '선택한 30일 실험의 핵심 지표가 기대를 크게 밑돌면' }];
  if (MARKET_FACING_FOR_WARNING.has(bestKey)) {
    warnings.push({ signal: '잠재 고객의 유료 의향이 확인되지 않으면' });
  }
  if (bestKey === 'restRecover' || gates.energy === 'depleted' || gates.energy === 'strained') {
    warnings.push({ signal: '2주 회복 뒤에도 에너지가 돌아오지 않거나 더 악화되면' });
  } else {
    warnings.push({ signal: '에너지가 더 악화되거나 런웨이가 더 빠듯해지면' });
  }
  return warnings.slice(0, 3);
}

function buildReversalConditions(results: OptionTimingResult[], bestKey: CareerOptionKey, gates: ReadinessGates): ReversalConditions {
  return {
    promotionConditions: buildPromotionConditions(results, bestKey, gates),
    warningOrDowngradeConditions: buildWarningConditions(bestKey, gates),
  };
}

// ─── Optional saju layer (placeholder only — never affects scoring) ────────────

// Practical barriers derived from the readiness gates (human-readable noun phrases).
// P1.1 — marketValidation copy is context-aware: market-facing direction gets
// "실제 반응 미확인"; lowOptionVisibility gets "선택지 단서 부족"; burnout suppresses
// the validation barrier (energy is the binding constraint, not market signal); default
// gets "외부 반응 미확인". The gate keys themselves are unchanged.
interface GateBarrierContext {
  mainTypeKey?: import('../types/careerCompass.ts').MainTypeKey;
  bestMoveKey?: CareerOptionKey;
  strategicDirectionKey?: CareerOptionKey;
  coreExperimentSourceKey?: CareerOptionKey;
}
const MARKET_FACING_OPTIONS_LOCAL: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>([
  'startup', 'independent', 'contentBrand', 'advisoryTeaching', 'investAnalysis',
]);
function humanGateBarriers(gates: ReadinessGates, ctx: GateBarrierContext = {}): string[] {
  const barriers: string[] = [];
  if (gates.runway === 'critical' || gates.runway === 'tight') barriers.push('재정 런웨이 부족');
  else if (gates.runway === 'unknown') barriers.push('재정 런웨이 불확실');
  if (gates.energy === 'depleted' || gates.energy === 'strained') barriers.push('에너지 저하');
  if (gates.risk === 'none' || gates.risk === 'timeOnly') barriers.push('손실 감당 여력 부족');
  if (gates.marketValidation === 'unvalidated' || gates.marketValidation === 'early') {
    // P1.1 — burnout: skip the validation barrier (energy is the real blocker).
    if (ctx.mainTypeKey !== 'overloadedBurnout') {
      const marketFacing =
        (ctx.bestMoveKey && MARKET_FACING_OPTIONS_LOCAL.has(ctx.bestMoveKey)) ||
        (ctx.strategicDirectionKey && MARKET_FACING_OPTIONS_LOCAL.has(ctx.strategicDirectionKey)) ||
        (ctx.coreExperimentSourceKey && MARKET_FACING_OPTIONS_LOCAL.has(ctx.coreExperimentSourceKey));
      if (marketFacing) barriers.push('실제 반응 미확인');
      else if (ctx.mainTypeKey === 'lowOptionVisibility') barriers.push('선택지 단서 부족');
      else barriers.push('외부 반응 미확인');
    }
  }
  return barriers;
}

export function buildOptionalSajuLayerPlaceholder(): SajuLayer {
  return {
    available: false, // becomes true only if the user adds birth info after the result
    timingPerspective: '',
    shareCardText: '',
    disclaimer: '타이밍 해석은 선택 사항이며, 핵심 추천 결과에는 영향을 주지 않습니다.',
  };
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export function buildResultSpine(
  vector: CareerVector,
  gates: ReadinessGates,
  opts: {
    preferredExperimentOptionKey?: CareerOptionKey;
    preferredExperimentLabel?: string;   // general output-format label → executionPlan core experiment
    constructProfile?: ConstructProfile; // normalized 0–100; omitted → neutral/low confidence
    inputCompleteness?: number;          // 0–1 share of the flow answered
    measured?: MeasuredSignals;          // which ambiguous low-signals were probed; omitted → none
    now?: Date;                          // injected for deterministic execution-plan date labels
    // P1.2 — whether the user explicitly answered rc_options = rc_opt_few. Used by the
    // lowOptionVisibility classifier guards to require an explicit "no options visible"
    // signal before classifying stable/expert-rooted users as lowOpt.
    noOptionsExplicit?: boolean;
    // P2.0 — read-only pass-through metadata. Engines NEVER read these to alter
    // classification, routing, lenses, or any P1.x invariant. They only ride on the
    // returned ResultSpine so consumers (UI, export, future personalization) can use
    // them. Default to `{}` and `undefined` respectively when not supplied.
    profile?: UserProfile;
    userSelectedExperimentKey?: CareerOptionKey;
  } = {},
): ResultSpine {
  const archetypes = inferCareerArchetypes(vector);
  const results = buildOptionTimingResults(vector, gates);

  const currentBestMove = selectCurrentBestMove(results);
  const bestKey = currentBestMove.optionKey;

  // Strategic direction = the identity pull (highest-fit option), even if gated.
  // The user's chosen 30-day experiment marks their intended direction, so prefer it
  // when it's a near-top-fit, gated option (not already the now move).
  const topFit = results[0];
  const prefKey = opts.preferredExperimentOptionKey;
  const prefResult = prefKey ? results.find((r) => r.optionKey === prefKey) : undefined;
  const directionResult = (prefResult && prefResult.optionKey !== bestKey && prefResult.timing !== 'now' && prefResult.fit >= topFit.fit - 15)
    ? prefResult
    : topFit;

  let strategicDirection: MoveRecommendation | null = null;
  let resultMode: ResultMode;
  if (bestKey === 'restRecover') {
    resultMode = 'recovery_first';
  } else if (directionResult.optionKey === bestKey) {
    resultMode = 'direct_now'; // the strongest fit is already the now move
  } else if (directionResult.optionKey === 'restRecover') {
    resultMode = 'safety_bridge';
  } else {
    strategicDirection = toMove(directionResult);
    resultMode = directionResult.timing === 'conditional' ? 'conditional_led' : 'safety_bridge';
  }

  // P1.1 — compute solutionLayer FIRST so identityAxis can use mainTypeKey to gate
  // composer chip / range-style copy for mainTypes where multi-identity framing is off-topic.
  const constructProfile = opts.constructProfile ?? createEmptyConstructProfile();
  const actionReadinessHint = inferActionReadiness(constructProfile);
  const solutionLayer = buildSolutionLayer({
    vector,
    construct: constructProfile,
    gates,
    optionFits: results.map((r) => ({ optionKey: r.optionKey, fit: r.fit })),
    resultMode,
    actionReadiness: actionReadinessHint,
    measured: opts.measured ?? { selfEfficacy: false, confidence: false },
    // P1.2 — explicit-direction signals for the lowOpt classifier guards.
    preferredExperimentOptionKey: opts.preferredExperimentOptionKey,
    noOptionsExplicit: opts.noOptionsExplicit ?? false,
  });

  const identityAxis = buildIdentityAxis(vector, archetypes, {
    preferredExperimentKey: opts.preferredExperimentOptionKey,
    gates,
    mainTypeKey: solutionLayer.mainTypeKey,
  });
  const prepareAfterOption = selectPrepareAfterOption(results, bestKey);
  const conditionalOption = selectConditionalOption(results, bestKey);
  const pauseOption = selectPauseOption(results, bestKey);

  const reversalConditions = buildReversalConditions(results, bestKey, gates);
  // The user's chosen 30-day experiment (action_preferences) wins; else default to the best move.
  const thirtyDayExperiment = buildThirtyDayExperiment(opts.preferredExperimentOptionKey ?? bestKey);
  const reevaluationCriteria: ReevaluationCriteria = generateReevaluationCriteria(gates, {
    bestMoveKey: bestKey,
    experimentKey: opts.preferredExperimentOptionKey,
  });
  // A higher-fit option pushed down by a gate constraint — used to link value priorities (MCDA) to the recommendation.
  const gatedCandidates = [prepareAfterOption, conditionalOption, pauseOption].filter((m): m is MoveRecommendation => m !== null);
  const dgMove = gatedCandidates.find((m) => m.rationale.includes('→')) ?? null;
  // Keep only the blocker clause: rationales like "정체성 적합도는 높지만, 시장 검증 필요 → …"
  // would otherwise inject their own '…지만,' into the MCDA template ("…는 매력적이지만
  // {reason} 때문에…"), producing a double-지만 broken sentence.
  const downgraded = dgMove
    ? {
        label: dgMove.label,
        reason: dgMove.rationale.split('→')[0].trim().replace(/[,\s]+$/, '').replace(/^.*지만,\s*/, ''),
      }
    : undefined;

  const evidence = generateConstructBasedExplanation(constructProfile, {
    inputCompleteness: opts.inputCompleteness ?? 0.5,
    bestMoveLabel: currentBestMove.label,
    gateBarriers: humanGateBarriers(gates, {
      mainTypeKey: solutionLayer.mainTypeKey,
      bestMoveKey: bestKey,
      strategicDirectionKey: strategicDirection?.optionKey,
      coreExperimentSourceKey: opts.preferredExperimentOptionKey ?? bestKey,
    }),
    downgraded,
    mode: resultMode,
    strategicLabel: strategicDirection?.label,
    practicalLabel: currentBestMove.label,
    safePracticalMove: bestKey !== 'startup' && bestKey !== 'independent', // low financial risk
    // P1 context — drives marketInformationGap surface copy resolution.
    mainTypeKey: solutionLayer.mainTypeKey,
    bestMoveKey: bestKey,
    // P1.1: in conditional_led/safety_bridge the bestMove is the bridge; pass through
    // the strategic direction and the chosen experiment so the resolver lands on MARKET
    // copy when the user's actual direction is market-facing.
    strategicDirectionKey: strategicDirection?.optionKey,
    coreExperimentSourceKey: opts.preferredExperimentOptionKey ?? bestKey,
    gates,
  });

  // Merge module + experiment + reeval + bridge into one monthly execution plan (display assembly).
  const executionPlan = buildExecutionPlan({
    solutionLayer,
    thirtyDayExperiment,
    reevaluationCriteria,
    currentBestMove,
    strategicDirection,
    prepareAfterOption,
    conditionalOption,
    reversalConditions,
    gates,
    preferredExperimentLabel: opts.preferredExperimentLabel,
    now: opts.now,
    // P1 lens inputs.
    vector,
    construct: constructProfile,
    topFit: results[0]?.fit ?? 0,
  });

  const optionalSajuLayer = buildOptionalSajuLayerPlaceholder();

  return {
    identityAxis,
    resultMode,
    strategicDirection,
    currentBestMove,
    prepareAfterOption,
    conditionalOption,
    pauseOption,
    reversalConditions,
    thirtyDayExperiment,
    reevaluationCriteria,
    evidence,
    solutionLayer,
    executionPlan,
    optionalSajuLayer,
    // P2.0 — read-only pass-through. profile defaults to {} so consumers don't have to
    // null-check; userSelectedExperimentKey stays undefined when no ap_experiment chosen.
    profile: opts.profile ?? {},
    userSelectedExperimentKey: opts.userSelectedExperimentKey,
  };
}
