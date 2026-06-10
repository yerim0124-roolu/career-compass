// subtypeFunctions.test.ts — 실행: node --experimental-strip-types src/lib/subtypeFunctions.test.ts
// 검증 목표: (1) 각 subtype이 최소 1회 단독 발동, (2) blended가 실제로 뜸,
//           (3) leverage pullDirection 6분기, (4) emergingLeader 단일.

import assert from 'node:assert';
import {
  getSubtype, getConflictedSubtype, getScatteredSubtype, getValidationSubtype,
  getBurnoutSubtype, getRealitySubtype, getVisibilitySubtype, getPlateauSubtype,
  getRestlessSubtype, getLeverageSubtype, emptyCareerProfile, BLEND_THRESHOLD,
  type CareerProfile,
} from './subtypeFunctions.ts';

let passed = 0;
const P = (): CareerProfile => emptyCareerProfile();
function check(label: string, r: { primary: string; blended: boolean; confidence: number; scores: Record<string, number> }, expectPrimary: string, expectBlended: boolean) {
  assert.strictEqual(r.primary, expectPrimary, `${label}: primary expected ${expectPrimary}, got ${r.primary} | scores=${JSON.stringify(r.scores)}`);
  assert.strictEqual(r.blended, expectBlended, `${label}: blended expected ${expectBlended}, got ${r.blended} (conf=${r.confidence}) | scores=${JSON.stringify(r.scores)}`);
  passed++;
}

// ── conflictedAtFork: 4 subtype 단독 ──
check('conflicted/incomeRisk', getConflictedSubtype({ ...P(), financialSafetyHigh: true, runwayTight: true, riskLow: true, nrSafety: true }), 'incomeRisk', false);
check('conflicted/careerCapital', getConflictedSubtype({ ...P(), expertiseHigh: true, nrContinuity: true }), 'careerCapitalContinuity', false);
check('conflicted/identity', getConflictedSubtype({ ...P(), csBlockerSocialGaze: true, creativityHigh: true }), 'identityTransition', false);
check('conflicted/value', getConflictedSubtype({ ...P(), mcdaConflict: true, top2ScoresClose: true, cvValuesMany: true }), 'valuePreservation', false);

// ── conflictedAtFork: blended (careerCapital 6 vs income 5 → conf 1 < 3) ──
{
  const r = getConflictedSubtype({ ...P(), financialSafetyHigh: true, nrSafety: true, expertiseHigh: true, nrContinuity: true });
  check('conflicted/blended', r, 'careerCapitalContinuity', true);
  assert.strictEqual(r.secondary, 'incomeRisk', `blended secondary expected incomeRisk, got ${r.secondary}`);
  assert.ok(r.confidence < BLEND_THRESHOLD, `blended conf ${r.confidence} should be < ${BLEND_THRESHOLD}`);
}

// ── scatteredExplorer: 3 subtype ──
check('scattered/closure', getScatteredSubtype({ ...P(), nrExplore: true, optionClosureResistanceHigh: true }), 'possibilityClosureAvoidance', false);
check('scattered/research', getScatteredSubtype({ ...P(), marketInfoGapHigh: true, executionReadinessLow: true, recentBehaviorResearching: true }), 'researchLoop', false);
check('scattered/curiosity', getScatteredSubtype({ ...P(), curiosityHigh: true, selectedRoleCount: 3, cvValuesBroad: true, goalClarityLow: true }), 'curiositySpread', false);

// ── unvalidatedAspirant: 3 subtype ──
check('validation/market', getValidationSubtype({ ...P(), selfEfficacyHigh: true, outcomeExpectationLow: true, marketValidationUnvalidated: true }), 'marketResponseUnknown', false);
check('validation/self', getValidationSubtype({ ...P(), selfEfficacyLow: true, outcomeExpectationHigh: true, scMarketOnly: true }), 'selfFitUnknown', false);
check('validation/sustain', getValidationSubtype({ ...P(), energyStrained: true, timeConstraintHigh: true, executionDriveLow: true }), 'sustainabilityUnknown', false);

// ── restlessStabilizer: 3 subtype ──
check('restless/meaning', getRestlessSubtype({ ...P(), impactLow: true, stabilityHigh: true }), 'meaningDecline', false);
check('restless/autonomy', getRestlessSubtype({ ...P(), autonomyLow: true, stabilityHigh: true, creativityHigh: true }), 'autonomyDeficit', false);
check('restless/growth', getRestlessSubtype({ ...P(), assetLeverageLow: true, curiosityHigh: true, goalClarityLow: true }), 'growthRoutineAbsent', false);

// ── plateauedPerformer: 3 subtype ──
check('plateau/stagnation', getPlateauSubtype({ ...P(), expertiseHigh: true, assetLeverageLow: true, curiosityLow: true }), 'expertiseStagnation', false);
check('plateau/recognition', getPlateauSubtype({ ...P(), expertiseHigh: true, marketPotentialLow: true, impactLow: true }), 'recognitionGap', false);
check('plateau/asset', getPlateauSubtype({ ...P(), expertiseHigh: true, contentBrandFitHigh: true, executionDriveLow: true }), 'assetUnleveraged', false);

// ── overloadedBurnout / realityLocked / lowOptionVisibility: 커버리지 ──
check('burnout/energy', getBurnoutSubtype({ ...P(), energyDepleted: true, recoveryNeedHigh: true }), 'energyDepletion', false);
check('burnout/decision', getBurnoutSubtype({ ...P(), readinessGapHigh: true, optionOverloadHigh: true, energyStrained: true }), 'decisionOverload', false);
check('burnout/environment', getBurnoutSubtype({ ...P(), contextualBarrierHigh: true, energyStrained: true, stabilityHigh: true }), 'environmentDrain', false);
check('reality/runway', getRealitySubtype({ ...P(), runwayCritical: true, runwayTight: true }), 'runwayShortage', false);
check('reality/loss', getRealitySubtype({ ...P(), riskTimeOnly: true, lossAversionHigh: true, runwayModerate: true }), 'lossIntolerance', false);
check('reality/external', getRealitySubtype({ ...P(), contextualBarrierHigh: true, timeConstraintHigh: true }), 'externalConstraint', false);
check('visibility/self', getVisibilitySubtype({ ...P(), selfInfoGapHigh: true, goalClarityLow: true, creativityLow: true }), 'selfInfoGap', false);
check('visibility/market', getVisibilitySubtype({ ...P(), marketInfoGapHigh: true, curiosityHigh: true }), 'marketInfoGap', false);
check('visibility/role', getVisibilitySubtype({ ...P(), creativityHigh: true, roleSelectionScattered: true, goalClarityLow: true, selfInfoGapLow: true }), 'roleLanguageGap', false);

// ── leverageReady: pullDirection 6분기 (단일, blended 없음) ──
check('leverage/content', getLeverageSubtype({ ...P(), pullDirection: 'contentBrand' }), 'contentLeverage', false);
check('leverage/advisory', getLeverageSubtype({ ...P(), pullDirection: 'advisoryTeaching' }), 'advisoryLeverage', false);
check('leverage/analysis', getLeverageSubtype({ ...P(), pullDirection: 'investAnalysis' }), 'analysisLeverage', false);
check('leverage/independent', getLeverageSubtype({ ...P(), pullDirection: 'independent' }), 'independentPilot', false);
check('leverage/startup', getLeverageSubtype({ ...P(), pullDirection: 'startup' }), 'startupPrep', false);
check('leverage/general', getLeverageSubtype({ ...P(), pullDirection: 'somethingElse' }), 'generalLeverage', false);

// ── emergingLeader: 단일 ──
check('emergingLeader', getSubtype('emergingLeader', P()), 'default', false);

// ── dispatcher 라우팅 일관성 ──
assert.strictEqual(getSubtype('conflictedAtFork', { ...P(), nrSafety: true, financialSafetyHigh: true }).primary, 'incomeRisk', 'dispatcher → conflicted');
assert.strictEqual(getSubtype('leverageReady', { ...P(), pullDirection: 'startup' }).primary, 'startupPrep', 'dispatcher → leverage');
passed++;

console.log(`✓ subtypeFunctions: ${passed} checks passed`);
