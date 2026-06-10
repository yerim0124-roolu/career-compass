// resultContextEngine.test.ts — 실행: node --experimental-strip-types src/lib/resultContextEngine.test.ts
// 검증: 엔진 신호 → subtype 선택 → 서사 조립(4섹션), blended 실제 발동, showPullDirection 분기,
//       readiness 폴백으로 월간·주간 카피가 항상 채워지는지, signals 주입.

import assert from 'node:assert';
import type { CareerVector, ReadinessGates, ConstructProfile } from '../types/careerCompass.ts';
import {
  buildResultContext, buildCareerProfile, getFrictions, getReadinessLevel, assembleNarrative,
  type ResultContextInput,
} from './resultContextEngine.ts';
import { getSubtype } from './subtypeFunctions.ts';
import { narrativeTemplates } from '../data/narrativeTemplates.ts';

let passed = 0;
const ok = (cond: boolean, msg: string) => { assert.ok(cond, msg); passed++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.strictEqual(a, b, `${msg} (got ${JSON.stringify(a)})`); passed++; };

// ── 베이스 픽스처: 플래그가 거의 켜지지 않는 중립값 ──
const baseVector = (): CareerVector => ({
  expertise: 50, autonomy: 50, stability: 50, marketOrientation: 50, creativity: 50,
  analysisOrientation: 50, ventureOrientation: 50, executionDrive: 50, impactOrientation: 50,
  recoveryNeed: 50, riskTolerance: 50, financialReadiness: 50, marketValidationNeed: 50,
});
const baseConstruct = (): ConstructProfile => ({
  scct: { selfEfficacy: 50, outcomeExpectation: 50, goalClarity: 50, contextualSupport: 50, contextualBarrier: 50 },
  adaptability: { concern: 50, control: 50, curiosity: 50, confidence: 50 },
  difficulty: { readinessGap: 40, selfInformationGap: 40, marketInformationGap: 40, valueConflict: 40, optionOverload: 40 },
  mcda: { identityFit: 50, assetLeverage: 50, marketPotential: 50, energySustainability: 50, financialSafety: 50, autonomy: 50, impact: 50 },
});
const baseGates = (): ReadinessGates => ({ energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'early' });
const baseInput = (mainType: string, over: Partial<ResultContextInput> = {}): ResultContextInput => ({
  mainType, vector: baseVector(), gates: baseGates(), construct: baseConstruct(),
  optionFits: [{ optionKey: 'startup', fit: 70 }, { optionKey: 'independent', fit: 40 }],
  ...over,
});

// ════ 1. conflictedAtFork × incomeRisk (단독) ════
{
  const inp = baseInput('conflictedAtFork', {
    construct: { ...baseConstruct(), mcda: { ...baseConstruct().mcda, financialSafety: 80 } },
    gates: { ...baseGates(), runway: 'tight', risk: 'none' },
    narrowingReason: 'nr_safety',
  });
  const ctx = buildResultContext(inp);
  eq(ctx.primarySubtype, 'incomeRisk', 'incomeRisk primary');
  eq(ctx.narrative.isBlended, false, 'incomeRisk not blended');
  eq(ctx.narrative.core, narrativeTemplates.conflictedAtFork.subtypes.incomeRisk.core, 'incomeRisk core wired');
  ok(ctx.narrative.monthlyApproach.length > 0, 'incomeRisk monthly non-empty');
  ok(ctx.narrative.weeklyMove.length > 0, 'incomeRisk weekly non-empty');
  eq(ctx.primaryFriction, 'income_uncertainty', 'incomeRisk friction');
}

// ════ 2. conflictedAtFork blended (careerCapital 6 vs income 5 → conf 1) ════
{
  const inp = baseInput('conflictedAtFork', {
    vector: { ...baseVector(), expertise: 70 },
    construct: { ...baseConstruct(), mcda: { ...baseConstruct().mcda, financialSafety: 80 } },
    gates: { ...baseGates(), runway: 'tight' },
    narrowingReason: 'nr_continuity',
  });
  const ctx = buildResultContext(inp);
  eq(ctx.primarySubtype, 'careerCapitalContinuity', 'blended primary');
  eq(ctx.secondarySubtype, 'incomeRisk', 'blended secondary');
  ok(ctx.subtypeConfidence < 3, `blended conf < 3 (got ${ctx.subtypeConfidence})`);
  eq(ctx.narrative.isBlended, true, 'blended flag set');
  // 혼합 core = primary core + secondary blendNote (primary core 유지 → plan과 일치)
  const primaryCore = narrativeTemplates.conflictedAtFork.subtypes.careerCapitalContinuity.core;
  const note = narrativeTemplates.conflictedAtFork.blendNote['incomeRisk'];
  ok(!!note, 'blendNote 존재');
  ok(ctx.narrative.core.startsWith(primaryCore), '혼합 core가 primary core로 시작(plan 일치)');
  ok(ctx.narrative.core.endsWith(note), '혼합 core 끝에 secondary blendNote');
}

// ════ 3. scatteredExplorer — showPullDirection=false (제외 유형) ════
{
  const inp = baseInput('scatteredExplorer', {
    construct: { ...baseConstruct(), difficulty: { ...baseConstruct().difficulty, optionOverload: 80 } },
    narrowingReason: 'nr_explore',
    pullDirectionKey: 'contentBrand', pullConfident: true,
  });
  const ctx = buildResultContext(inp);
  eq(ctx.primarySubtype, 'possibilityClosureAvoidance', 'scattered primary');
  eq(ctx.showPullDirection, false, 'scattered hides pull direction');
  ok(ctx.narrative.core.length > 0, 'scattered core non-empty');
}

// ════ 4. leverageReady — pullDirection 매핑 + showPullDirection=true ════
{
  for (const [key, expect] of [
    ['contentBrand', 'contentLeverage'], ['advisoryTeaching', 'advisoryLeverage'],
    ['investAnalysis', 'analysisLeverage'], ['independent', 'independentPilot'],
    ['startup', 'startupPrep'], ['orgLeadership', 'generalLeverage'],
  ] as const) {
    const ctx = buildResultContext(baseInput('leverageReady', { pullDirectionKey: key, pullConfident: true }));
    eq(ctx.primarySubtype, expect, `leverage ${key}→${expect}`);
    ok(ctx.narrative.core.length > 0, `leverage ${expect} core non-empty`);
  }
  const ctxShow = buildResultContext(baseInput('leverageReady', { pullDirectionKey: 'startup', pullConfident: true }));
  eq(ctxShow.showPullDirection, true, 'leverage shows pull direction');
}

// ════ 5. emergingLeader — 단일 ════
{
  const ctx = buildResultContext(baseInput('emergingLeader'));
  eq(ctx.primarySubtype, 'default', 'emergingLeader default');
  ok(ctx.narrative.core.length > 0, 'emergingLeader core non-empty');
}

// ════ 6. 전 mainType×대표 subtype 서사 커버리지 (core/monthly/weekly 항상 채워짐 = 폴백 검증) ════
{
  // 각 subtype을 단독 발동시키는 최소 입력
  const scenarios: Array<[string, Partial<ResultContextInput>, string]> = [
    ['unvalidatedAspirant', { construct: cc({ scct: { selfEfficacy: 80, outcomeExpectation: 20 }, }), gates: { ...baseGates(), marketValidation: 'unvalidated' } }, 'marketResponseUnknown'],
    ['unvalidatedAspirant', { construct: cc({ scct: { selfEfficacy: 20, outcomeExpectation: 80 } }), scOutlook: 'sc_market_only' }, 'selfFitUnknown'],
    ['unvalidatedAspirant', { gates: { ...baseGates(), energy: 'strained' }, vector: { ...baseVector(), executionDrive: 30 }, construct: cc({ scct: { contextualBarrier: 80 } }) }, 'sustainabilityUnknown'],
    ['restlessStabilizer', { vector: { ...baseVector(), impactOrientation: 30, stability: 60 } }, 'meaningDecline'],
    ['restlessStabilizer', { vector: { ...baseVector(), autonomy: 30, stability: 60, creativity: 70 } }, 'autonomyDeficit'],
    ['restlessStabilizer', { construct: cc({ mcda: { assetLeverage: 20 }, adaptability: { curiosity: 70 }, scct: { goalClarity: 20 } }) }, 'growthRoutineAbsent'],
    ['plateauedPerformer', { vector: { ...baseVector(), expertise: 70 }, construct: cc({ mcda: { assetLeverage: 20 }, adaptability: { curiosity: 20 } }) }, 'expertiseStagnation'],
    ['plateauedPerformer', { vector: { ...baseVector(), expertise: 70, impactOrientation: 30 }, construct: cc({ mcda: { marketPotential: 20 } }) }, 'recognitionGap'],
    ['plateauedPerformer', { vector: { ...baseVector(), expertise: 70, executionDrive: 30 }, optionFits: [{ optionKey: 'contentBrand', fit: 75 }, { optionKey: 'startup', fit: 40 }] }, 'assetUnleveraged'],
    ['overloadedBurnout', { gates: { ...baseGates(), energy: 'depleted' }, vector: { ...baseVector(), recoveryNeed: 70 } }, 'energyDepletion'],
    ['realityLocked', { gates: { ...baseGates(), runway: 'critical' } }, 'runwayShortage'],
    ['lowOptionVisibility', { construct: cc({ difficulty: { selfInformationGap: 80 }, scct: { goalClarity: 20 } }), vector: { ...baseVector(), creativity: 30 } }, 'selfInfoGap'],
  ];
  for (const [mainType, over, expectSub] of scenarios) {
    const ctx = buildResultContext(baseInput(mainType, over));
    eq(ctx.primarySubtype, expectSub, `${mainType}→${expectSub}`);
    ok(ctx.narrative.core.length > 0, `${mainType}/${expectSub} core`);
    ok(ctx.narrative.monthlyApproach.length > 0, `${mainType}/${expectSub} monthly (폴백 포함)`);
    ok(ctx.narrative.weeklyMove.length > 0, `${mainType}/${expectSub} weekly (폴백 포함)`);
  }
}

// ════ 7. signals — 3비트 해석형 (의지 → 조건 → 그래서) ════
{
  const inp = baseInput('conflictedAtFork', {
    construct: { ...baseConstruct(), mcda: { ...baseConstruct().mcda, financialSafety: 80 } },
    gates: { ...baseGates(), runway: 'tight', risk: 'none' },
    narrowingReason: 'nr_safety',
  });
  const ctx = buildResultContext(inp);
  eq(ctx.signals.length, 3, `signals 정확히 3비트 (got ${ctx.signals.length})`);
  ok(ctx.signals[0].endsWith('고,'), '①의지 비트는 "…고," 종결');
  ok(ctx.signals[1].startsWith('다만'), '②조건 비트는 "다만…" 시작');
  ok(ctx.signals[2].includes('그래서'), '③제안 비트는 "그래서" 연결');
  // mainType별로 ①의지 비트가 달라짐(레이어 다양성)
  const burnoutCtx = buildResultContext(baseInput('overloadedBurnout', { gates: { ...baseGates(), energy: 'depleted' }, vector: { ...baseVector(), recoveryNeed: 70 } }));
  ok(burnoutCtx.signals[0] !== ctx.signals[0], '의지 비트가 mainType마다 다름');
  ok(burnoutCtx.signals.length === 3, 'burnout도 3비트');
}

// 부분 construct 오버라이드 헬퍼
function cc(partial: { scct?: Partial<ConstructProfile['scct']>; adaptability?: Partial<ConstructProfile['adaptability']>; difficulty?: Partial<ConstructProfile['difficulty']>; mcda?: Partial<ConstructProfile['mcda']> }): ConstructProfile {
  const b = baseConstruct();
  return {
    scct: { ...b.scct, ...partial.scct },
    adaptability: { ...b.adaptability, ...partial.adaptability },
    difficulty: { ...b.difficulty, ...partial.difficulty },
    mcda: { ...b.mcda, ...partial.mcda },
  };
}

console.log(`✓ resultContextEngine: ${passed} checks passed`);
void getSubtype; void buildCareerProfile; void getFrictions; void getReadinessLevel; void assembleNarrative;
