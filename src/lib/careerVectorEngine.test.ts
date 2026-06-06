// Unit tests for the career vector engine. Self-contained (no test-runner deps):
// run with `node` (Node 24 strips types). A failing assertion throws → non-zero exit.

import type { CareerVector } from '../types/careerCompass.ts';
import {
  createEmptyCareerVector,
  applyRankingEffects,
  normalizeCareerVector,
  inferCareerArchetypes,
  calculateOptionFit,
  rankCareerOptions,
  generateCareerOptionsFromVector,
} from './careerVectorEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// helper: build a normalized-scale (0–100) vector for inference/fit tests
const vec = (partial: Partial<CareerVector>): CareerVector => ({ ...createEmptyCareerVector(), ...partial });

// 1. high expertise + creativity + impact → 지식 번역가 / 전문성 확장가
const a1 = inferCareerArchetypes(vec({ expertise: 80, creativity: 80, impactOrientation: 80, autonomy: 20 }));
check('expertise+creativity+impact → top is 지식 번역가', a1[0]?.key === 'knowledgeTranslator');
check('  label is Korean (지식 번역가)', a1[0]?.label === '지식 번역가');
check('  전문성 확장가 also surfaced', a1.some((m) => m.key === 'expertExpander'));

// 2. high analysis + marketOrientation → 시장 해석가
const a2 = inferCareerArchetypes(vec({ analysisOrientation: 80, marketOrientation: 80 }));
check('analysis+market → top is 시장 해석가', a2[0]?.key === 'marketInterpreter' && a2[0]?.label === '시장 해석가');

// 3. high venture + execution + risk → 문제 해결형 창업가
const a3 = inferCareerArchetypes(vec({ ventureOrientation: 80, executionDrive: 80, riskTolerance: 80 }));
check('venture+execution+risk → top is 문제 해결형 창업가', a3[0]?.key === 'problemFounder' && a3[0]?.label === '문제 해결형 창업가');

// 4. high recoveryNeed suppresses high-execution fit, boosts recovery-friendly fit
const hiRec = vec({ ventureOrientation: 70, executionDrive: 70, riskTolerance: 70, recoveryNeed: 80 });
const loRec = vec({ ventureOrientation: 70, executionDrive: 70, riskTolerance: 70, recoveryNeed: 10 });
check('high recoveryNeed lowers startup fit', calculateOptionFit('startup', hiRec) < calculateOptionFit('startup', loRec));
check('high recoveryNeed raises restRecover fit', calculateOptionFit('restRecover', hiRec) > calculateOptionFit('restRecover', loRec));
check('high recoveryNeed raises stayRedesign fit', calculateOptionFit('stayRedesign', hiRec) > calculateOptionFit('stayRedesign', loRec));

// 5. high stability + low riskTolerance → 안정 재설계형
const a5 = inferCareerArchetypes(vec({ stability: 80, riskTolerance: 10 }));
check('stability+low risk → top is 안정 재설계형', a5[0]?.key === 'stableRedesigner' && a5[0]?.label === '안정 재설계형');

// 6. ranking applies stronger weight to higher-ranked choices
const optA = { id: 'a', label: 'A', tags: [], scoreEffects: { expertise: 5 } };
const optB = { id: 'b', label: 'B', tags: [], scoreEffects: { autonomy: 5 } };
const optC = { id: 'c', label: 'C', tags: [], scoreEffects: { stability: 5 } };
const ranked2 = applyRankingEffects(createEmptyCareerVector(), [optA, optB]);
check('rank1 outweighs rank2 (expertise > autonomy)', ranked2.expertise > ranked2.autonomy);
const ranked3 = applyRankingEffects(createEmptyCareerVector(), [optA, optB, optC]);
check('rank1 outweighs rank3 (expertise > stability)', ranked3.expertise > ranked3.stability);

// 7. normalization keeps values within 0–100 (and scales the max axis to 100)
const norm = normalizeCareerVector(vec({ expertise: 50, autonomy: -5, creativity: 10 }));
check('normalize: max axis → 100', norm.expertise === 100);
check('normalize: negatives → 0', norm.autonomy === 0);
const allInRange = (Object.keys(norm) as (keyof CareerVector)[]).every((k) => norm[k] >= 0 && norm[k] <= 100);
check('normalize: all axes within 0–100', allInRange);

// 8. same input → same output (determinism)
const dv = vec({ expertise: 70, marketOrientation: 60, analysisOrientation: 65 });
check('inferCareerArchetypes deterministic', JSON.stringify(inferCareerArchetypes(dv)) === JSON.stringify(inferCareerArchetypes(dv)));
check('rankCareerOptions deterministic', JSON.stringify(rankCareerOptions(dv)) === JSON.stringify(rankCareerOptions(dv)));

// generation surfaces fitting candidates
const gen = generateCareerOptionsFromVector(vec({ analysisOrientation: 80, marketOrientation: 80, expertise: 60 }));
check('generation surfaces investAnalysis for analyst profile', gen.includes('investAnalysis'));
check('generation always returns ≥1 candidate', gen.length >= 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
