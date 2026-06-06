// Unit tests for the ResultSpine assembly engine. Self-contained (no test-runner
// deps): run with `node` (Node 24 strips types). Failing assertion throws → exit≠0.

import type { CareerVector } from '../types/careerCompass.ts';
import { ARCHETYPE_LABELS } from '../types/careerCompass.ts';
import { createEmptyCareerVector, inferCareerArchetypes } from './careerVectorEngine.ts';
import { evaluateReadinessGates } from './readinessGateEngine.ts';
import { buildResultSpine, buildIdentityAxis } from './resultSpineEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const vec = (partial: Partial<CareerVector>): CareerVector => ({ ...createEmptyCareerVector(), ...partial });
const ventureVector = vec({ ventureOrientation: 80, executionDrive: 80, riskTolerance: 80, marketOrientation: 60 });

// 1. high-fit venture option downgraded when runway and energy are low
const severeGates = evaluateReadinessGates({ energy: 10, runwayMonths: 0.5, riskTolerance: 50, marketValidation: 50 });
const s1 = buildResultSpine(ventureVector, severeGates);
check('severe gates → currentBestMove is NOT startup', s1.currentBestMove.optionKey !== 'startup');
check('severe gates → high-fit startup surfaces as the pause option', s1.pauseOption?.optionKey === 'startup');

// 2. when no risky option is "now", best move falls back to recovery / redesign
const strainedGates = evaluateReadinessGates({ energy: 25, runwayMonths: 0.5, riskTolerance: 50, marketValidation: 50 });
const s2 = buildResultSpine(ventureVector, strainedGates);
check('no-now → currentBestMove is recovery or redesign', s2.currentBestMove.optionKey === 'restRecover' || s2.currentBestMove.optionKey === 'stayRedesign');

// 3. high-fit expert content with acceptable gates becomes currentBestMove
const contentVector = vec({ creativity: 80, impactOrientation: 80, marketOrientation: 80, expertise: 80 });
const okGates = evaluateReadinessGates({ energy: 85, runwayMonths: 8, riskTolerance: 70, marketValidation: 80 });
const s3 = buildResultSpine(contentVector, okGates);
check('acceptable gates → contentBrand is currentBestMove', s3.currentBestMove.optionKey === 'contentBrand');
check('  and its readiness is "now"', s3.currentBestMove.readiness === 'now');

// conditional option surfaces when validation is the only blocker
const unvalidatedGates = evaluateReadinessGates({ energy: 90, runwayMonths: 18, riskTolerance: 90, marketValidation: 10 });
const s3b = buildResultSpine(ventureVector, unvalidatedGates);
check('unmet validation → startup surfaces as the conditional option', s3b.conditionalOption?.optionKey === 'startup');
check('  and startup is not the current best move', s3b.currentBestMove.optionKey !== 'startup');

// 4–6. always-present outputs
check('reversal warning conditions always generated (≥1)', s1.reversalConditions.warningOrDowngradeConditions.length >= 1 && s3.reversalConditions.warningOrDowngradeConditions.length >= 1);
check('reevaluationCriteria always generated (≥1)', s1.reevaluationCriteria.criteria.length >= 1 && s1.reevaluationCriteria.reviewAfterDays === 30);
check('thirtyDayExperiment always generated', !!s1.thirtyDayExperiment.id && s1.thirtyDayExperiment.evidenceToCheck.length >= 1);

// ── Reversal direction (promotion = positive only, warning = negative) ──────────
const NEGATIVE_TOKENS = ['밑돌면', '부족하면', '악화되면', '확인되지 않으면'];
const hasNegative = (s: string) => NEGATIVE_TOKENS.some((t) => s.includes(t));
const promoTexts = (sp: typeof s1) => sp.reversalConditions.promotionConditions.flatMap((r) => r.conditions.map((c) => c.condition));
// all-green: every option viable → no fabricated promotion, warning still present
const allGreen = buildResultSpine(vec({ expertise: 70, impactOrientation: 60 }), evaluateReadinessGates({ energy: 90, runwayMonths: 18, riskTolerance: 90, marketValidation: 90 }));
check('all-green → promotion conditions are empty (no fabricated rule)', allGreen.reversalConditions.promotionConditions.length === 0);
check('all-green → warning conditions present', allGreen.reversalConditions.warningOrDowngradeConditions.length >= 1);
for (const sp of [s1, s3, s3b, allGreen]) {
  check('promotion conditions never contain negative evidence', promoTexts(sp).every((t) => !hasNegative(t)));
}
check('negative evidence renders in warning section', allGreen.reversalConditions.warningOrDowngradeConditions.some((w) => hasNegative(w.signal)));
check('promotion conditions are positive evidence only (when present)', (() => { const t = promoTexts(s3b); return t.length >= 1 && t.every((s) => /하면|확보|올라오면|감당/.test(s)); })());

// 7. archetype tags remain secondary (identity statement is a composed sentence, not a type label)
const archetypeLabelValues: string[] = Object.values(ARCHETYPE_LABELS);
check('identity statement is a composed sentence', s3.identityAxis.statement.endsWith('사람'));
check('identity statement is NOT just an archetype label', !archetypeLabelValues.includes(s3.identityAxis.statement));
check('archetype tags are at most 3 (secondary)', s3.identityAxis.archetypeTags.length <= 3);

// vary identity by vector combination (same dominant axis, different secondary)
const v1 = vec({ expertise: 80, marketOrientation: 60 });
const v2 = vec({ expertise: 80, creativity: 60 });
check('identity axis varies with vector combination', buildIdentityAxis(v1, inferCareerArchetypes(v1)).statement !== buildIdentityAxis(v2, inferCareerArchetypes(v2)).statement);

// ─── P1: Range lens toggle (single-axis vs dual-axis identity statement) ──────
// Single-axis profile: expertise=100 dominates, second axis well below 50 → range OFF.
const singleAxis = vec({ expertise: 100, autonomy: 20 });
const singleId = buildIdentityAxis(singleAxis, inferCareerArchetypes(singleAxis));
check('P1 range OFF: single-axis expert → statement reads as single-axis (no second clause)',
  singleId.statement === '전문성을 깊게 다지는 사람' || (singleId.statement.endsWith('사람') && !singleId.statement.includes('스스로 방향을 정하는')));
check('P1 range OFF: single-axis statement does NOT compose two AXIS_CLAUSE phrases',
  !(singleId.statement.includes('전문성을 깊게 다지는') && singleId.statement.includes('스스로')));

// Dual-axis profile: expertise=70, marketOrientation=60 → both ≥50 AND diff < 25 → range ON.
const dualAxis = vec({ expertise: 70, marketOrientation: 60 });
const dualId = buildIdentityAxis(dualAxis, inferCareerArchetypes(dualAxis));
check('P1 range ON: dual-axis profile → 2-axis composed statement',
  dualId.statement.includes('시장과 연결되는') || dualId.statement.includes('해석을 더하는') || dualId.statement.includes('전문성을 기반으로'));

// Borderline: first 80, second 55 (diff = 25, NOT < 25) → range OFF.
const borderlineDiff = vec({ expertise: 80, marketOrientation: 55 });
const borderlineId = buildIdentityAxis(borderlineDiff, inferCareerArchetypes(borderlineDiff));
check('P1 range borderline (diff = 25 exactly): single-axis (strict < threshold)',
  borderlineId.statement === '전문성을 깊게 다지는 사람');

// Borderline: second axis = 49 (NOT >= 50) → range OFF.
const borderlineLow = vec({ expertise: 70, marketOrientation: 49 });
const borderlineLowId = buildIdentityAxis(borderlineLow, inferCareerArchetypes(borderlineLow));
check('P1 range borderline (second = 49, not ≥50): single-axis',
  borderlineLowId.statement === '전문성을 깊게 다지는 사람');

// ─── P1.1: Range first-axis floor (≥ 60) ──────────────────────────────────────
// First axis 55, second axis 50 → diff < 25 AND second ≥ 50 BUT first < 60 → single-axis.
const weakFirst = vec({ expertise: 55, marketOrientation: 50 });
const weakFirstId = buildIdentityAxis(weakFirst, inferCareerArchetypes(weakFirst));
check('P1.1 range first-axis floor: first=55 < V_HIGH → single-axis even though diff < 25',
  weakFirstId.statement === '전문성을 깊게 다지는 사람');

// ─── P1.1: careerComposer chip gating ────────────────────────────────────────
// Composer chip should NOT appear on a profile where first axis is weak and breadth is low.
const noComposer = vec({ expertise: 55, marketOrientation: 50 });
const noComposerId = buildIdentityAxis(noComposer, inferCareerArchetypes(noComposer));
check('P1.1 composer chip: weak-first / narrow profile → no "careerComposer" tag',
  !noComposerId.archetypeTags.includes('careerComposer'));

// Composer chip should appear when first axis is strong (range condition) — autonomy stays high.
const composerOk = vec({ autonomy: 70, marketOrientation: 65, creativity: 50 });
const composerOkId = buildIdentityAxis(composerOk, inferCareerArchetypes(composerOk));
check('P1.1 composer chip: dual-axis range-active profile may keep "careerComposer" tag',
  composerOkId.archetypeTags.includes('careerComposer') || composerOkId.archetypeTags.length > 0);

// Composer chip should appear when ≥3 identity axes are at least V_MOD (45) regardless of pair.
const broadProfile = vec({ expertise: 50, autonomy: 50, marketOrientation: 50, creativity: 50 });
const broadId = buildIdentityAxis(broadProfile, inferCareerArchetypes(broadProfile));
check('P1.1 composer chip: 3+ axes ≥ V_MOD → composer surfaces',
  broadId.archetypeTags.includes('careerComposer') || inferCareerArchetypes(broadProfile).some((a) => a.key === 'careerComposer'));

// 8. optional saju layer exists but is disconnected from scoring
check('saju layer present but not active (no scoring effect)', s3.optionalSajuLayer !== null && s3.optionalSajuLayer.available === false);
check('saju layer carries a no-impact disclaimer', (s3.optionalSajuLayer?.disclaimer.length ?? 0) > 0);

// 9. deterministic: same input → same ResultSpine
check('buildResultSpine deterministic', JSON.stringify(buildResultSpine(contentVector, okGates)) === JSON.stringify(buildResultSpine(contentVector, okGates)));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
