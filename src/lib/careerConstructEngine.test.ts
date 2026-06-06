// Unit tests for the theory-grounded construct engine. Self-contained (run with `node`).

import type { ConstructProfile } from '../types/careerCompass.ts';
import {
  createEmptyConstructProfile,
  applyConstructEffects,
  normalizeConstructProfile,
  inferDecisionDifficultyPattern,
  calculateTheoryGroundedConfidence,
  inferActionReadiness,
  generateConstructBasedExplanation,
} from './careerConstructEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// Build a normalized (0–100) profile directly for inference/confidence tests.
function prof(partial: {
  scct?: Partial<ConstructProfile['scct']>;
  adaptability?: Partial<ConstructProfile['adaptability']>;
  difficulty?: Partial<ConstructProfile['difficulty']>;
  mcda?: Partial<ConstructProfile['mcda']>;
}): ConstructProfile {
  const p = createEmptyConstructProfile();
  return {
    scct: { ...p.scct, ...partial.scct },
    adaptability: { ...p.adaptability, ...partial.adaptability },
    difficulty: { ...p.difficulty, ...partial.difficulty },
    mcda: { ...p.mcda, ...partial.mcda },
  };
}

// normalization
const rawN = applyConstructEffects(createEmptyConstructProfile(), { scct: { selfEfficacy: 5 }, difficulty: { optionOverload: 20 } }, 1);
const norm = normalizeConstructProfile(rawN);
check('normalize keeps values within 0–100 (and saturates)', norm.scct.selfEfficacy === 50 && norm.difficulty.optionOverload === 100);

// 1. high selfEfficacy + outcomeExpectation increases confidence
const hi = prof({ scct: { selfEfficacy: 90, outcomeExpectation: 90, goalClarity: 70 }, adaptability: { concern: 70, control: 70, confidence: 70 } });
const lo = prof({ scct: { selfEfficacy: 10, outcomeExpectation: 10 } });
check('high SE+OE → higher confidence', calculateTheoryGroundedConfidence(hi, 1).score > calculateTheoryGroundedConfidence(lo, 1).score);

// 2. high contextualBarrier downgrades high-risk options (explanation)
const barrier = prof({ scct: { contextualBarrier: 90 } });
const exBarrier = generateConstructBasedExplanation(barrier, { inputCompleteness: 1 });
check('high contextualBarrier → downgrade high-risk note', exBarrier.whyThisRecommendation.some((s) => s.includes('리스크가 큰 선택') && s.includes('미루')));

// 3. high optionOverload produces priority-setting language
const overload = prof({ difficulty: { optionOverload: 90 } });
check('high optionOverload → primaryDifficulty optionOverload', inferDecisionDifficultyPattern(overload).primaryDifficulty === 'optionOverload');
check('high optionOverload → priority-setting language', generateConstructBasedExplanation(overload, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('우선순위')));

// 4. high valueConflict produces priority-setting language
// P3.7 — "트레이드오프" jargon replaced by plain Korean ("선택 기준" /
// "우선순위"). The construct-level "충돌" label still surfaces.
const conflict = prof({ difficulty: { valueConflict: 90 } });
check('high valueConflict → primaryDifficulty valueConflict', inferDecisionDifficultyPattern(conflict).primaryDifficulty === 'valueConflict');
check('high valueConflict → priority-setting language', generateConstructBasedExplanation(conflict, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('선택 기준') || s.includes('우선순위') || s.includes('충돌')));

// 4b. multi-difficulty inference + combination explanations
const single = prof({ difficulty: { optionOverload: 80 } });
check('single difficulty → no secondaries', inferDecisionDifficultyPattern(single).secondaryDifficulties.length === 0);

const mio = prof({ difficulty: { marketInformationGap: 80, optionOverload: 70 } });
const mioPat = inferDecisionDifficultyPattern(mio);
check('multi: returns primary + 1–2 secondaries', mioPat.primaryDifficulty !== null && mioPat.secondaryDifficulties.length >= 1 && mioPat.secondaryDifficulties.length <= 2);
check('combo: market info gap + option overload explained', generateConstructBasedExplanation(mio, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('선택지까지 많아')));

const vrg = prof({ difficulty: { valueConflict: 80, readinessGap: 70 } });
check('combo: value conflict + readiness gap explained', generateConstructBasedExplanation(vrg, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('결정 준비 부족이 겹쳐')));

const sic = prof({ difficulty: { selfInformationGap: 80 }, adaptability: { control: 15 } });
check('combo: self information gap + low control explained', generateConstructBasedExplanation(sic, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('방향을 내가 끌고 가는 감각도 약한 편')));

// high ability + low runway → blocker attributed to runway/validation, not desire/ability
const constraintCase = generateConstructBasedExplanation(prof({ scct: { selfEfficacy: 85 } }), { inputCompleteness: 1, gateBarriers: ['재정 런웨이 부족', '시장 반응 미확인'] });
check('high ability + low runway → blocker is runway/validation (not ability)', constraintCase.whyThisRecommendation.some((w) => w.includes('의욕이나 실력이 아니라') && w.includes('재정 런웨이')));

// connected narrative paragraph (counseling-style) — market-facing context resolves to "실제 반응"
const narr = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 85 }, adaptability: { control: 70 }, difficulty: { marketInformationGap: 60 }, mcda: { financialSafety: 80, autonomy: 60 } }),
  {
    inputCompleteness: 0.8,
    bestMoveLabel: '이직',
    downgraded: { label: '창업', reason: '재정 런웨이 부족, 시장 검증 필요' },
    gateBarriers: ['재정 런웨이 부족', '시장 반응 미확인'],
    bestMoveKey: 'independent', gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' }, // P1 market-facing context
  },
);
check('narrative distinguishes 실행 준비도 and 판단 확실성 (or rephrased evidence wording)', narr.narrative.includes('실행') && (narr.narrative.includes('확실성') || narr.narrative.includes('장기 방향으로 굳히기')));
check('narrative is a connected paragraph (≥2 sentences)', narr.narrative.split('.').filter((s) => s.trim().length > 0).length >= 2);
check('P1 narrative: market-facing → uses "실제 반응" not "시장 반응"', narr.narrative.includes('장기 선택으로 확정하려면') && narr.narrative.includes('실제 반응') && !narr.narrative.includes('시장 반응'));
check('narrative does not use framework abbreviations', !narr.narrative.includes('SCCT') && !narr.narrative.includes('CDDQ') && !narr.narrative.includes('진로적응성'));

// mode-aware narrative: conditional_led frames "direction valid, validate first via a safe bridge"
const condLed = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80 }, difficulty: { marketInformationGap: 70 }, mcda: { autonomy: 60 } }),
  { inputCompleteness: 1, mode: 'conditional_led', strategicLabel: '콘텐츠/퍼스널 브랜드', practicalLabel: '이직', gateBarriers: ['시장 반응 미확인'] },
);
check('conditional_led narrative: direction valid but validate first', condLed.narrative.includes("'콘텐츠/퍼스널 브랜드' 방향은 맞지만") && condLed.narrative.includes('검증'));
check('conditional_led narrative: does not headline the bridge as identity', condLed.narrative.indexOf('콘텐츠/퍼스널 브랜드') < condLed.narrative.indexOf('이직'));

// 5. high concern/control/confidence supports action readiness
const ready = prof({ adaptability: { concern: 80, control: 80, confidence: 80 } });
check('high concern/control/confidence → ready', inferActionReadiness(ready) === 'ready');
check('ready → evidence.actionReadiness ready', generateConstructBasedExplanation(ready, { inputCompleteness: 1 }).actionReadiness === 'ready');

// 6. high curiosity but low control → exploration-with-structure
const explore = prof({ adaptability: { curiosity: 80, control: 20, concern: 50, confidence: 50 } });
check('high curiosity + low control → explore-with-structure', inferActionReadiness(explore) === 'explore-with-structure');
check('explore → why mentions 기한과 범위/작게 시도 (softened from 구조 있는 탐색)', generateConstructBasedExplanation(explore, { inputCompleteness: 1 }).whyThisRecommendation.some((s) => s.includes('기한과 범위') && s.includes('작게 시도')));

// 7. low input completeness lowers confidence
const p7 = prof({ scct: { selfEfficacy: 80, outcomeExpectation: 80, goalClarity: 60 }, adaptability: { concern: 60, control: 60, confidence: 60 } });
check('lower input completeness → lower confidence', calculateTheoryGroundedConfidence(p7, 0.3).score < calculateTheoryGroundedConfidence(p7, 1).score);

// 8. construct explanations include SCCT/Adaptability/CDDQ signals (theory section)
const ex8 = generateConstructBasedExplanation(prof({ scct: { selfEfficacy: 80 }, difficulty: { marketInformationGap: 60 } }), { inputCompleteness: 1 });
check('summary cites SCCT/적응성/CDDQ', ex8.theoryGroundedSummary.includes('SCCT') && ex8.theoryGroundedSummary.includes('적응성') && ex8.theoryGroundedSummary.includes('CDDQ'));
check('construct signals carry framework tags', ex8.constructSignals.length >= 1 && ex8.constructSignals.every((s) => typeof s.framework === 'string' && s.framework.length > 0));

// ── Step 8: surfaced evidence ──────────────────────────────────────────────────
const rich = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80, outcomeExpectation: 20 }, adaptability: { control: 70 }, difficulty: { marketInformationGap: 60 }, mcda: { financialSafety: 80, autonomy: 60 } }),
  { inputCompleteness: 0.8, downgraded: { label: '창업', reason: '재정 런웨이 부족, 시장 검증 필요' }, gateBarriers: ['재정 런웨이 부족', '시장 반응 미확인'] },
);
check('evidence has ≥4 plain-language reasons', rich.whyThisRecommendation.length >= 4);
check('construct signals carry human labels (not framework abbrev)', rich.constructSignals.length >= 1 && rich.constructSignals.every((s) => s.humanLabel.length > 0 && !s.humanLabel.includes('SCCT') && !s.humanLabel.includes('CDDQ')));
check('construct signals render plain notes', rich.constructSignals.every((s) => s.note.length > 0));
check('confidence drivers are populated', rich.confidenceDrivers.raised.length + rich.confidenceDrivers.lowered.length >= 1);
check('confidence note clarifies meaning (not ability/safety)', rich.confidenceNote.includes('판단 확실성') && rich.confidenceNote.includes('능력') && rich.confidenceNote.includes('안전'));
check('MCDA value priority appears in why', rich.whyThisRecommendation.some((w) => w.includes('우선순위로 둔') && w.includes('창업')));
check('contextual barriers surfaced', rich.contextualBarriers.includes('재정 런웨이 부족'));
check('framework abbreviations are NOT in the main why text', rich.whyThisRecommendation.every((w) => !w.includes('SCCT') && !w.includes('CDDQ') && !w.includes('진로적응성')));

// ready-but-low certainty reconciliation (in the narrative)
const readyLow = generateConstructBasedExplanation(prof({ adaptability: { concern: 70, control: 70, confidence: 70 }, difficulty: { marketInformationGap: 80 } }), { inputCompleteness: 0.6 });
check('ready-but-low certainty is explained', readyLow.actionReadiness === 'ready' && readyLow.narrative.includes('장기 선택으로 확정하려면'));

// '판단 확실성' renamed + meaning clarified (not 신뢰도/확신도)
check('confidence band is one of the 4 bands', ['낮음', '중간', '높음', '매우 높음'].includes(rich.confidenceBand));
check('narrative does NOT use 추천 신뢰도; uses "장기 방향으로 굳히기" frame', !rich.narrative.includes('추천 신뢰도') && (rich.narrative.includes('장기 방향으로 굳히기') || rich.narrative.includes('판단의 확실성')));
check('confidenceNote clarifies it is not ability/safety', rich.confidenceNote.includes('능력') && rich.confidenceNote.includes('안전') && rich.confidenceNote.includes('장기 방향'));
const veryLow = generateConstructBasedExplanation(prof({ difficulty: { readinessGap: 95, marketInformationGap: 80 } }), { inputCompleteness: 0.3 });
check('very low → band 낮음 (not a "0점" headline)', veryLow.confidenceBand === '낮음');
check('low band explains how to raise certainty', veryLow.narrative.includes('올라가') || veryLow.missingInformation.length >= 1);
// low certainty but SAFE move → reassure the move, flag long-term direction
const safeLow = generateConstructBasedExplanation(prof({ difficulty: { readinessGap: 90 } }), { inputCompleteness: 0.5, safePracticalMove: true });
check('low certainty + safe move → reassures move, flags long-term', safeLow.narrative.includes('이 선택 자체는 안전한 편이지만') && safeLow.narrative.includes('장기 방향을 확정하기에는'));
const strong = generateConstructBasedExplanation(prof({ scct: { selfEfficacy: 100, outcomeExpectation: 100, goalClarity: 100, contextualSupport: 100 }, adaptability: { concern: 100, control: 100, curiosity: 100, confidence: 100 } }), { inputCompleteness: 1 });
check('strong profile → band 높음/매우 높음', strong.confidenceBand === '높음' || strong.confidenceBand === '매우 높음');

// ─── P1: marketInformationGap context-aware copy resolution ──────────────────
import { resolveExternalSignalCopy, SIGNAL_COPY_MARKET, SIGNAL_COPY_EXTERNAL, SIGNAL_COPY_DEFAULT } from './careerConstructEngine.ts';

// Direct resolver tests
const marketCtx = resolveExternalSignalCopy({ bestMoveKey: 'startup', gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' } });
check('P1 resolver: market-facing + validation low → SIGNAL_COPY_MARKET',
  marketCtx === SIGNAL_COPY_MARKET && marketCtx.shortLabel === '실제 반응 확인 필요');

const externalCtx = resolveExternalSignalCopy({ mainTypeKey: 'scatteredExplorer' });
check('P1 resolver: scatteredExplorer → SIGNAL_COPY_EXTERNAL',
  externalCtx === SIGNAL_COPY_EXTERNAL && externalCtx.shortLabel === '외부 정보 보강 필요');

const conflictCtx = resolveExternalSignalCopy({ mainTypeKey: 'conflictedAtFork' });
check('P1 resolver: conflictedAtFork → SIGNAL_COPY_EXTERNAL',
  conflictCtx === SIGNAL_COPY_EXTERNAL);

const lowOptCtx = resolveExternalSignalCopy({ mainTypeKey: 'lowOptionVisibility' });
check('P1 resolver: lowOptionVisibility → SIGNAL_COPY_EXTERNAL',
  lowOptCtx === SIGNAL_COPY_EXTERNAL);

const plateauedCtx = resolveExternalSignalCopy({ mainTypeKey: 'plateauedPerformer', bestMoveKey: 'stayRedesign' });
check('P1 resolver: plateauedPerformer + stayRedesign (non-market) → SIGNAL_COPY_DEFAULT',
  plateauedCtx === SIGNAL_COPY_DEFAULT && plateauedCtx.shortLabel === '선택지 정보 보강 필요');

// Market-facing but validation already done → falls back to non-market (default).
const marketValidated = resolveExternalSignalCopy({ bestMoveKey: 'contentBrand', gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'validated' } });
check('P1 resolver: market-facing BUT validation done → not market copy',
  marketValidated !== SIGNAL_COPY_MARKET);

// Evidence-layer integration: lowered chip uses resolved label, not hardcoded "시장 정보"
const externalEvidence = generateConstructBasedExplanation(
  prof({ difficulty: { marketInformationGap: 70 } }),
  { inputCompleteness: 1, mainTypeKey: 'scatteredExplorer' },
);
check('P1 evidence: external context → lowered uses "외부 정보 부족" (not "시장 정보 부족")',
  externalEvidence.confidenceDrivers.lowered.includes('외부 정보 부족') && !externalEvidence.confidenceDrivers.lowered.includes('시장 정보 부족'));
check('P1 evidence: external context → uncertaintySignals uses external copy',
  externalEvidence.uncertaintySignals.some((s) => s.includes('외부 정보가 부족')) && !externalEvidence.uncertaintySignals.some((s) => s.includes('시장 반응 정보')));
check('P1 evidence: external context → missingInformation uses generic external copy',
  externalEvidence.missingInformation.some((s) => s.includes('비슷한 사례')) && !externalEvidence.missingInformation.some((s) => s.includes('잠재 고객 인터뷰')));

const defaultEvidence = generateConstructBasedExplanation(
  prof({ difficulty: { marketInformationGap: 70 } }),
  { inputCompleteness: 1, mainTypeKey: 'plateauedPerformer', bestMoveKey: 'stayRedesign' },
);
check('P1 evidence: default context (plateaued, stayRedesign) → "선택지 정보 부족"',
  defaultEvidence.confidenceDrivers.lowered.includes('선택지 정보 부족'));

const marketEvidence = generateConstructBasedExplanation(
  prof({ difficulty: { marketInformationGap: 70 } }),
  { inputCompleteness: 1, bestMoveKey: 'independent', gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' } },
);
check('P1 evidence: market context → "실제 반응 부족" + "잠재 고객 인터뷰" copy',
  marketEvidence.confidenceDrivers.lowered.includes('실제 반응 부족') &&
  marketEvidence.missingInformation.some((s) => s.includes('잠재 고객 인터뷰')));

// CDDQ primary line uses the resolved phrase/action
const externalDifficulty = generateConstructBasedExplanation(
  prof({ difficulty: { marketInformationGap: 70 } }),
  { inputCompleteness: 1, mainTypeKey: 'conflictedAtFork' },
);
check('P1 evidence: CDDQ primary line uses external phrase, not "시장 반응에 대한"',
  externalDifficulty.whyThisRecommendation.some((w) => w.includes('외부에서 가져올 정보')) &&
  !externalDifficulty.whyThisRecommendation.some((w) => w.includes('시장 반응에 대한 정보')));

// ─── P1.1: extended resolver context (strategicDirection + coreExperiment) ──────
// When the strategicDirection is market-facing but the bestMove is a non-market bridge,
// resolver should land on MARKET, not DEFAULT.
const condLedResolver = resolveExternalSignalCopy({
  bestMoveKey: 'jobChange',                          // safety bridge — non-market
  strategicDirectionKey: 'contentBrand',             // user's actual direction — market-facing
  gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' },
});
check('P1.1 resolver: market-facing strategicDirection wins over non-market bestMove → MARKET',
  condLedResolver === SIGNAL_COPY_MARKET);

const condLedViaExperiment = resolveExternalSignalCopy({
  bestMoveKey: 'stayRedesign',
  coreExperimentSourceKey: 'startup', // user picked startup interviews as experiment
  gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'early' },
});
check('P1.1 resolver: market-facing coreExperiment wins over non-market bestMove → MARKET',
  condLedViaExperiment === SIGNAL_COPY_MARKET);

// ─── P1.1: SCCT seHi/!oeHi line is context-aware ────────────────────────────────
const lowOptSCCT = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80, outcomeExpectation: 10 } }),
  { inputCompleteness: 1, mainTypeKey: 'lowOptionVisibility', bestMoveKey: 'stayRedesign' },
);
check('P1.1 SCCT seHi/!oeHi: lowOptionVisibility wording uses "선택지가 선명하지 않아"',
  lowOptSCCT.whyThisRecommendation.some((w) => w.includes('선택지가 선명하지 않아')) &&
  !lowOptSCCT.whyThisRecommendation.some((w) => w.includes('시장 확인을 먼저') || w.includes('시장 반응 기대')));

const burnoutSCCT = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80, outcomeExpectation: 10 } }),
  { inputCompleteness: 1, mainTypeKey: 'overloadedBurnout', bestMoveKey: 'restRecover' },
);
check('P1.1 SCCT seHi/!oeHi: burnout replaces line with energy-first wording',
  burnoutSCCT.whyThisRecommendation.some((w) => w.includes('에너지 회복이 먼저')) &&
  !burnoutSCCT.whyThisRecommendation.some((w) => w.includes('시장 확인을 먼저') || w.includes('시장 반응 기대')));

const marketSCCT = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80, outcomeExpectation: 10 }, difficulty: { marketInformationGap: 60 } }),
  {
    inputCompleteness: 1,
    bestMoveKey: 'independent',
    gates: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'unvalidated' },
  },
);
check('P1.1 SCCT seHi/!oeHi: market context uses "실제 반응" wording',
  marketSCCT.whyThisRecommendation.some((w) => w.includes('실제 반응은 아직 불확실')) &&
  !marketSCCT.whyThisRecommendation.some((w) => w.includes('시장 확인을 먼저')));

const defaultSCCT = generateConstructBasedExplanation(
  prof({ scct: { selfEfficacy: 80, outcomeExpectation: 10 } }),
  { inputCompleteness: 1, mainTypeKey: 'plateauedPerformer', bestMoveKey: 'stayRedesign' },
);
check('P1.1 SCCT seHi/!oeHi: default wording uses "결과가 따라올지" (no 시장 wording)',
  defaultSCCT.whyThisRecommendation.some((w) => w.includes('결과가 따라올지는')) &&
  !defaultSCCT.whyThisRecommendation.some((w) => w.includes('시장')));

// ─── P1.1: burnout evidence gating ──────────────────────────────────────────────
// CDDQ primary action lines that point at option/market work should be suppressed for burnout.
const burnoutEvidence = generateConstructBasedExplanation(
  prof({
    difficulty: { marketInformationGap: 70, selfInformationGap: 50 },
    scct: { selfEfficacy: 50 },
  }),
  { inputCompleteness: 1, mainTypeKey: 'overloadedBurnout', bestMoveKey: 'restRecover' },
);
check('P1.1 burnout: no "후보별 정보" / "사례·정보를 모아" / "작은 반응 확인" recommendation',
  !burnoutEvidence.whyThisRecommendation.some((w) =>
    w.includes('후보별 정보를 채워보는') || w.includes('사례·정보를 모아') || w.includes('작은 반응 확인')));
check('P1.1 burnout: evidence carries an energy-first alternative line',
  burnoutEvidence.whyThisRecommendation.some((w) =>
    w.includes('에너지 회복') || w.includes('정보 정리보다, 에너지')));
check('P1.1 burnout: no "시장" anywhere in why',
  burnoutEvidence.whyThisRecommendation.every((w) => !w.includes('시장')));

// ─── P1.1: combination note grammar bug fix ─────────────────────────────────────
const comboTest = generateConstructBasedExplanation(
  prof({ difficulty: { marketInformationGap: 60, valueConflict: 60 } }),
  { inputCompleteness: 1, mainTypeKey: 'conflictedAtFork' },
);
check('P1.1 combo: no "것를" malformed particle anywhere in why',
  comboTest.whyThisRecommendation.every((w) => !w.includes('것를')));
check('P1.1 combo: marketInformationGap|valueConflict uses clean phrasing',
  comboTest.whyThisRecommendation.some((w) =>
    w.includes('가치 우선순위를 먼저 정하고') && !w.includes('것를')));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
