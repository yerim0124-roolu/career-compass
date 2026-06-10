// Unit tests for the solution module engine (via buildResultSpine integration).
// Self-contained (no test-runner deps): run with `node` (Node 24 strips types).
// A failing assertion throws → non-zero exit.

import type { CareerVector, ConstructProfile, ReadinessGates, MeasuredSignals, SupportTagKey } from '../types/careerCompass.ts';
import { MAIN_TYPE_LABELS } from '../types/careerCompass.ts';
import { createEmptyCareerVector } from './careerVectorEngine.ts';
import { buildResultSpine } from './resultSpineEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const vec = (partial: Partial<CareerVector>): CareerVector => ({ ...createEmptyCareerVector(), ...partial });

// Build a full normalized (0–100) construct profile from partials.
type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };
function cp(p: DeepPartial<ConstructProfile> = {}): ConstructProfile {
  return {
    scct: { selfEfficacy: 0, outcomeExpectation: 0, goalClarity: 0, contextualSupport: 0, contextualBarrier: 0, ...p.scct },
    adaptability: { concern: 0, control: 0, curiosity: 0, confidence: 0, ...p.adaptability },
    difficulty: { readinessGap: 0, selfInformationGap: 0, marketInformationGap: 0, valueConflict: 0, optionOverload: 0, ...p.difficulty },
    mcda: { identityFit: 0, assetLeverage: 0, marketPotential: 0, energySustainability: 0, financialSafety: 0, autonomy: 0, impact: 0, ...p.mcda },
  };
}

const build = (v: CareerVector, g: ReadinessGates, c: ConstructProfile, measured?: MeasuredSignals) =>
  buildResultSpine(v, g, { constructProfile: c, inputCompleteness: 1, ...(measured ? { measured } : {}) });
const tagsOf = (s: ReturnType<typeof build>): SupportTagKey[] => s.solutionLayer.supportTags;

// ─── Scenario 1: 정체된 성실형 + Portfolio Convert (expertise high, low goal clarity) ─
const s1 = build(
  vec({ expertise: 75, impactOrientation: 65, stability: 40 }),
  { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  cp({ scct: { selfEfficacy: 75, goalClarity: 20 }, mcda: { impact: 70 }, difficulty: { selfInformationGap: 55 } }),
);
check('S1 → mainType 정체된 성실형', s1.solutionLayer.mainTypeKey === 'plateauedPerformer');
check('S1 → primary module Portfolio Convert', s1.solutionLayer.primaryModule.key === 'portfolioConvert');
check('S1 → surfaces 가시적 성과 동력 (measured positive)', tagsOf(s1).includes('recognitionSensitive'));
check('S1 → NO spurious 안전판 선호 / 작은 성공 필요', !tagsOf(s1).includes('riskAverse') && !tagsOf(s1).includes('lowSelfTrust'));

// ─── Scenario 2: 현실 조건 정비형 + Runway Stabilizer (high autonomy, tight runway) ──
const s2 = build(
  vec({ autonomy: 75, expertise: 50, ventureOrientation: 50 }),
  { energy: 'steady', runway: 'tight', risk: 'smallCost', marketValidation: 'partial' },
  cp({ scct: { contextualBarrier: 70 } }),
);
check('S2 → mainType 현실 조건 정비형', s2.solutionLayer.mainTypeKey === 'realityLocked');
check('S2 → primary module Runway Stabilizer', s2.solutionLayer.primaryModule.key === 'runwayStabilizer');
check('S2 → surfaces 현실 조건 점검 (measured: tight runway/barrier)', tagsOf(s2).includes('externalConstraint'));
check('S2 → no riskAverse (risk gate is smallCost, not low)', !tagsOf(s2).includes('riskAverse'));

// ─── Scenario 3: 탐색 과잉형 + Option Narrowing (option overload, curiosity high) ───
const s3 = build(
  vec({ autonomy: 40, creativity: 40, expertise: 40, marketOrientation: 40 }),
  { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  cp({ difficulty: { optionOverload: 80, marketInformationGap: 55 }, adaptability: { curiosity: 70 }, scct: { goalClarity: 20, selfEfficacy: 50 } }),
);
check('S3 → mainType 탐색 과잉형', s3.solutionLayer.mainTypeKey === 'scatteredExplorer');
check('S3 → primary module Option Narrowing', s3.solutionLayer.primaryModule.key === 'optionNarrowing');
check('S3 → surfaces 시장 반응 확인 필요', tagsOf(s3).includes('marketInsightGap'));

// ─── Scenario 4: 시장 미검증 도전형 + Content/Market (creativity high, low validation) ─
const s4 = build(
  vec({ creativity: 75, impactOrientation: 60, expertise: 45 }),
  { energy: 'steady', runway: 'comfortable', risk: 'experiment', marketValidation: 'unvalidated' },
  cp({ difficulty: { marketInformationGap: 70 }, scct: { selfEfficacy: 50, goalClarity: 40 } }),
);
const s4mods = [s4.solutionLayer.primaryModule.key, s4.solutionLayer.secondaryModule?.key];
check('S4 → mainType 시장 미검증 도전형', s4.solutionLayer.mainTypeKey === 'unvalidatedAspirant');
check('S4 → modules include Content Engine or Market Test', s4mods.includes('contentEngine') || s4mods.includes('marketTest'));
check('S4 → surfaces 콘텐츠/표현 동력', tagsOf(s4).includes('creativeExpressive'));
check('S4 → NO spurious 안전판 선호 / 작은 성공 필요', !tagsOf(s4).includes('riskAverse') && !tagsOf(s4).includes('lowSelfTrust'));

// ─── Scenario 5: 안정 속 권태형 + Role Redesign (stable, low goal clarity, suppressed axis) ─
const s5 = build(
  vec({ stability: 68, creativity: 56, impactOrientation: 48, expertise: 50 }),
  { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  cp({ scct: { goalClarity: 25, selfEfficacy: 55 } }),
);
check('S5 → mainType 안정 속 권태형', s5.solutionLayer.mainTypeKey === 'restlessStabilizer');
check('S5 → primary module Role Redesign', s5.solutionLayer.primaryModule.key === 'roleRedesign');
check('S5 → surfaces 콘텐츠/표현 동력', tagsOf(s5).includes('creativeExpressive'));

// ─── Cross-scenario invariants ──────────────────────────────────────────────────
const all = [s1, s2, s3, s4, s5];
const typeLabels: string[] = Object.values(MAIN_TYPE_LABELS);

check('solutionLayer present for all 5 scenarios', all.every((s) => !!s.solutionLayer && !!s.solutionLayer.primaryModule));
check('every scenario surfaces at most 3 support tags', all.every((s) => tagsOf(s).length <= 3));
check('every scenario surfaces first 3 next actions', all.every((s) => s.solutionLayer.nextActions.length >= 1 && s.solutionLayer.nextActions.length <= 3));
// none of the 5 (no low-risk gate, none passed measured) should infer the negative tags
check('no scenario infers riskAverse/lowSelfTrust without measured evidence', all.every((s) => !tagsOf(s).includes('lowSelfTrust')) && all.every((s) => !tagsOf(s).includes('riskAverse')));

// labels do not dominate: headline is never a bare type label; strategy is a full sentence
check('headline (identity statement) is never a main-type label', all.every((s) => !typeLabels.includes(s.identityAxis.statement)));
check('strategy statement is a sentence, not the type label', all.every((s) =>
  s.solutionLayer.strategyStatement !== s.solutionLayer.mainTypeLabel &&
  s.solutionLayer.strategyStatement.endsWith('요.') &&
  s.solutionLayer.mainTypeLabel.endsWith('형'),
));

// gate priority preserved: an unvalidated market-facing recommendation is not a "now" startup
check('S4 unvalidated → currentBestMove is not a now-startup', !(s4.currentBestMove.optionKey === 'startup' && s4.currentBestMove.readiness === 'now'));

// ─── Measured-only guard (the focus of this change) ────────────────────────────
// G1. sparse input (no answers) must NOT produce riskAverse or lowSelfTrust.
const sparse = build(vec({}), { energy: 'steady', runway: 'unknown', risk: 'smallCost', marketValidation: 'unvalidated' }, cp({}));
check('G1 sparse input → no riskAverse', !tagsOf(sparse).includes('riskAverse'));
check('G1 sparse input → no lowSelfTrust', !tagsOf(sparse).includes('lowSelfTrust'));
check('G1 sparse input → no externalConstraint from unknown runway', !tagsOf(sparse).includes('externalConstraint'));
check('G1 sparse input → zero support tags (nothing measured)', tagsOf(sparse).length === 0);

// G2. explicit low loss tolerance (risk gate) → riskAverse fires.
const lowRisk = build(vec({}), { energy: 'steady', runway: 'comfortable', risk: 'none', marketValidation: 'partial' }, cp({}));
check('G2 explicit low-risk answer → riskAverse', tagsOf(lowRisk).includes('riskAverse'));

// G3. measured + low self-efficacy → lowSelfTrust fires.
const lowSE = build(vec({}), { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' }, cp({ scct: { selfEfficacy: 10 } }), { selfEfficacy: true, confidence: false });
check('G3 measured low self-efficacy → lowSelfTrust', tagsOf(lowSE).includes('lowSelfTrust'));

// G4. SAME low self-efficacy but UNMEASURED → lowSelfTrust must NOT fire.
const lowSEUnmeasured = build(vec({}), { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' }, cp({ scct: { selfEfficacy: 10 } }), { selfEfficacy: false, confidence: false });
check('G4 unmeasured low self-efficacy → NO lowSelfTrust', !tagsOf(lowSEUnmeasured).includes('lowSelfTrust'));

// G5. measured + low confidence → lowSelfTrust fires (confidence path).
const lowConf = build(vec({}), { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' }, cp({ adaptability: { confidence: 12 } }), { selfEfficacy: false, confidence: true });
check('G5 measured low confidence → lowSelfTrust', tagsOf(lowConf).includes('lowSelfTrust'));

// determinism
check('solution layer deterministic', JSON.stringify(build(
  vec({ expertise: 75, impactOrientation: 65 }),
  { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  cp({ scct: { selfEfficacy: 75, goalClarity: 20 }, mcda: { impact: 70 } }),
).solutionLayer) === JSON.stringify(build(
  vec({ expertise: 75, impactOrientation: 65 }),
  { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  cp({ scct: { selfEfficacy: 75, goalClarity: 20 }, mcda: { impact: 70 } }),
).solutionLayer));

// ─── Narrow copy polish (bridge / advisory title / energy-aware stop) ─────────────
const okGatesCap = { energy: 'capacity', runway: 'comfortable', risk: 'experiment', marketValidation: 'unvalidated' } as const;

// conflictedAtFork + interview experiment → bridge sentence + value-conflict stop, no energy copy
const cf = buildResultSpine(
  vec({ autonomy: 50, marketOrientation: 40 }),
  okGatesCap,
  { constructProfile: cp({ difficulty: { valueConflict: 80 }, mcda: { financialSafety: 60, autonomy: 60 } }), preferredExperimentOptionKey: 'startup', inputCompleteness: 1 },
);
check('copy1: scenario is 갈림길 결정형 (conflictedAtFork)', cf.solutionLayer.mainTypeKey === 'conflictedAtFork');
check('copy1: conflictedAtFork + interview → bridge sentence present', cf.executionPlan.coreExperimentBridge === '고를 기준을 머릿속에서만 정하지 말고, 실제 반응을 기준으로 좁혀보는 단계입니다.');
check('copy3: conflictedAtFork sufficient energy → no 에너지/회복 in stop', cf.executionPlan.stopOrPivotCriteria.every((s) => !/에너지|회복/.test(s)));
check('copy3: conflictedAtFork interview → value-conflict stop sentence', cf.executionPlan.stopOrPivotCriteria.some((s) => s.includes('우선순위 기준이나 가치 충돌')));

// expert advisory now-move + interview experiment → specific experiment title
const adv = buildResultSpine(
  vec({ expertise: 85, impactOrientation: 80, autonomy: 55 }),
  { energy: 'capacity', runway: 'comfortable', risk: 'experiment', marketValidation: 'partial' },
  { constructProfile: cp({ scct: { selfEfficacy: 70 } }), preferredExperimentOptionKey: 'startup', inputCompleteness: 1 },
);
check('copy2: now-move is 전문 자문/강의', adv.currentBestMove.optionKey === 'advisoryTeaching');
check('copy2: advisory + interview → specific experiment title', adv.executionPlan.coreExperiment.label === '전문 자문/강의 주제가 실제 수요가 있는지 10명에게 확인하기');

// content experiment + sufficient energy → energy copy removed from stop
const content = buildResultSpine(
  vec({ creativity: 75, impactOrientation: 60 }),
  okGatesCap,
  { constructProfile: cp({ difficulty: { marketInformationGap: 70 } }), preferredExperimentOptionKey: 'contentBrand', inputCompleteness: 1 },
);
check('copy3: content + sufficient energy → no 에너지/회복 in stop', content.executionPlan.stopOrPivotCriteria.every((s) => !/에너지|회복/.test(s)));

// recovery (restRecover) is exempt — recovery language stays "when actually relevant"
const rec = buildResultSpine(
  vec({ recoveryNeed: 85 }),
  { energy: 'depleted', runway: 'moderate', risk: 'smallCost', marketValidation: 'partial' },
  { constructProfile: cp({ difficulty: { readinessGap: 70 } }), preferredExperimentOptionKey: 'restRecover', inputCompleteness: 1 },
);
check('copy3: restRecover keeps recovery language in stop (relevant)', rec.currentBestMove.optionKey === 'restRecover' && rec.executionPlan.stopOrPivotCriteria.some((s) => /회복|에너지/.test(s)));
check('copy3: non-conflict experiment uses generic (not 인터뷰) value-conflict line', content.executionPlan.stopOrPivotCriteria.every((s) => !s.includes('인터뷰를 해도')));

// ─── lowOptionVisibility (기회 탐색 부족형) — Planned Happenstance / Hope Theory lens ──
const okGatesNeutral = { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' } as const;

// no-visible-options scenario: low goal-clarity, low option-overload, no suppressed identity pull,
// self-info gap moderate-high → must classify lowOptionVisibility and route to opportunity/strengths.
const noOptions = buildResultSpine(
  vec({ stability: 20, expertise: 30 }),
  okGatesNeutral,
  { constructProfile: cp({ scct: { goalClarity: 20, selfEfficacy: 40 }, difficulty: { optionOverload: 10, selfInformationGap: 60 }, adaptability: { curiosity: 20 } }), inputCompleteness: 1 },
);
check('lowOptionVisibility: classified for no-visible-options scenario', noOptions.solutionLayer.mainTypeKey === 'lowOptionVisibility');
check('lowOptionVisibility: label = 기회 탐색 부족형', noOptions.solutionLayer.mainTypeLabel === '기회 탐색 부족형');
check('lowOptionVisibility: primary = Opportunity Generation', noOptions.solutionLayer.primaryModule.key === 'opportunityGeneration');
check('lowOptionVisibility: secondary = Strengths Reflection', noOptions.solutionLayer.secondaryModule?.key === 'strengthsReflection');
check('lowOptionVisibility: closingLine uses option-generation wording (not narrow-down)',
  noOptions.executionPlan.closingLine.includes('답을 내지 않아도') && noOptions.executionPlan.closingLine.includes('두 개만 생겨도'));
check('lowOptionVisibility: Hope-Theory context note present (pathways not deficiency)',
  !!noOptions.executionPlan.mainTypeContextNote && noOptions.executionPlan.mainTypeContextNote.includes('경로가 충분히 만들어지지 않은 상태'));
check('lowOptionVisibility: reeval is module-aligned (후보·감각 변화)',
  noOptions.executionPlan.reevaluationChecklist.some((c) => c.includes('후보가 2개 이상')) &&
  noOptions.executionPlan.reevaluationChecklist.some((c) => c.includes('이 정도는 해볼 수 있다')));
check('lowOptionVisibility: stop/pivot ≤ 3 (cap preserved)', noOptions.executionPlan.stopOrPivotCriteria.length <= 3);
check('lowOptionVisibility: successSignals ≤ 3 (cap preserved)', noOptions.executionPlan.successSignals.length <= 3);

// regression: each pre-existing crafted scenario keeps its mainType after introducing lowOptionVisibility
check('regression: S1 (expertise-rich) remains plateauedPerformer (NOT lowOptionVisibility)', s1.solutionLayer.mainTypeKey === 'plateauedPerformer');
check('regression: S2 (autonomy + tight runway + barrier) remains realityLocked', s2.solutionLayer.mainTypeKey === 'realityLocked');
check('regression: S3 (optionOverload) remains scatteredExplorer', s3.solutionLayer.mainTypeKey === 'scatteredExplorer');
check('regression: S4 (creator low-validation) remains unvalidatedAspirant', s4.solutionLayer.mainTypeKey === 'unvalidatedAspirant');
check('regression: S5 (stable + suppressed creative) remains restlessStabilizer', s5.solutionLayer.mainTypeKey === 'restlessStabilizer');

// regression: burnout-energy scenario still gets recoveryFirst (P1 has priority over lowOptionVisibility)
const burnoutLowGoal = buildResultSpine(
  vec({ recoveryNeed: 80 }),
  { energy: 'depleted', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
  { constructProfile: cp({ scct: { goalClarity: 20 }, difficulty: { selfInformationGap: 60 } }), inputCompleteness: 1 },
);
check('regression: depleted-energy + low goal clarity still maps to overloadedBurnout / Recovery First',
  burnoutLowGoal.solutionLayer.mainTypeKey === 'overloadedBurnout' && burnoutLowGoal.solutionLayer.primaryModule.key === 'recoveryFirst');

// P1: non-lowOptionVisibility scenarios use the actionType OR essentialist closing,
// never the optionGeneration variant; no Hope-Theory context note either way.
check('non-low-option: S1 closing is NOT optionGeneration + no context note',
  !s1.executionPlan.closingLine.includes('답을 내지 않아도') && s1.executionPlan.mainTypeContextNote === undefined);
check('non-low-option: S5 (stable) closing is NOT optionGeneration + no context note',
  !s5.executionPlan.closingLine.includes('답을 내지 않아도') && s5.executionPlan.mainTypeContextNote === undefined);

// ─── P1: ActiveLenses activation ──────────────────────────────────────────────
// S1 plateaued (single-axis expertise=75, second axis impact=65 → range may toggle
// depending on the 25-pt window). With current values: 75 - 65 = 10 < 25 AND 65 >= 50 → range ON.
// S1 has no overload signal → essentialism OFF. mainType not lowOpt + identity pull present → plannedHappenstance OFF.
check('P1 S1 (plateaued): essentialism OFF (no overload/conflict)', s1.executionPlan.activeLenses.essentialism === false);
check('P1 S1 (plateaued): plannedHappenstance OFF (not lowOpt + identity pull)', s1.executionPlan.activeLenses.plannedHappenstance === false);
check('P1 S1 (plateaued): jobCrafting ON (plateauedPerformer trigger)', s1.executionPlan.activeLenses.jobCrafting === true);

// S3 scatteredExplorer (optionOverload=80) → essentialism ON. EXTERNAL_INFO_TYPES → "외부 정보 보강 필요".
check('P1 S3 (scattered): essentialism ON (optionOverload high)', s3.executionPlan.activeLenses.essentialism === true);
check('P1 S3 (scattered): plannedHappenstance OFF (has options)', s3.executionPlan.activeLenses.plannedHappenstance === false);
check('P1 S3 (scattered): supportTagLabels resolve marketInsightGap → "외부 정보 보강 필요"',
  s3.executionPlan.supportTagLabels.includes('외부 정보 보강 필요') && !s3.executionPlan.supportTagLabels.includes('시장 반응 확인 필요'));
check('P1 S3 (scattered): closingLine is essentialist variant',
  s3.executionPlan.closingLine.includes('붙잡으려') && s3.executionPlan.closingLine.includes('두세 개만 곁에'));

// S4 creator (creativity=75, impact=60) — two top identity axes close + both ≥50 → range ON.
check('P1 S4 (creator): range ON (creativity + impact both ≥50, close)', s4.executionPlan.activeLenses.range === true);

// S5 restless (stability=68, creativity=56) → range ON.
check('P1 S5 (restless): range ON (stability + creativity both ≥50, close)', s5.executionPlan.activeLenses.range === true);
check('P1 S5 (restless): jobCrafting ON (restlessStabilizer trigger)', s5.executionPlan.activeLenses.jobCrafting === true);

// ─── P1: SupportTagLabel context resolution for marketInsightGap ──────────────
// S3 scatteredExplorer (EXTERNAL_INFO_TYPES) → "외부 정보 보강 필요" (above).
// S4 unvalidated creator + low validation, but bestMove is jobChange (not market-facing) →
// FALLS BACK TO EXTERNAL (unvalidatedAspirant is not in EXTERNAL_INFO_TYPES) → DEFAULT "선택지 정보 보강 필요".
check('P1 S4 (creator, jobChange now): supportTagLabel uses default OR market label, never "시장 반응 확인 필요"',
  !s4.executionPlan.supportTagLabels.includes('시장 반응 확인 필요'));

// Burnout (recovery best move) → not market-facing, not external-info type → default copy.
check('P1 burnout: supportTagLabels never include "시장 반응 확인 필요"',
  !burnoutLowGoal.executionPlan.supportTagLabels.includes('시장 반응 확인 필요'));

// ─── P1: Closing-line variants ────────────────────────────────────────────────
// S3 scatteredExplorer → essentialist closing
check('P1 closing variant: scattered (overload) → essentialist',
  s3.executionPlan.closingLine === '다 붙잡으려 애쓰지 않아도 괜찮아요. 이번 달은 마음이 가는 두세 개만 곁에 남겨도, 충분히 잘 가고 있는 거예요.');
// S1 plateaued (no overload, has identity pull, no lowOpt) → actionType closing
check('P1 closing variant: plateaued → actionType',
  s1.executionPlan.closingLine === '완벽하지 않아도 괜찮아요. 이번 달은 작게 한 번 부딪혀 신호 한 줄만 남겨도, 그걸로 충분합니다.');
// noOptions (lowOptionVisibility) → optionGeneration closing (already asserted earlier; here we restate)
check('P1 closing variant: lowOptionVisibility → optionGeneration',
  noOptions.executionPlan.closingLine === '지금 답을 내지 않아도 괜찮아요. 해보고 싶은 길이 두 개만 생겨도, 이번 달은 충분히 의미 있어요.');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
