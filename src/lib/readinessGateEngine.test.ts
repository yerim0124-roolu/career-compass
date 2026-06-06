// Unit tests for the readiness gate engine. Self-contained (no test-runner deps):
// bundle with esbuild and run with node. A failing assertion throws → non-zero exit.

import {
  evaluateReadinessGates,
  classifyDecisionTiming,
  generateReversalConditions,
  generateReevaluationCriteria,
} from './readinessGateEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name);
  }
}

// 1. low energy + low runway blocks venture/founding as Now
const g1 = evaluateReadinessGates({ energy: 10, runwayMonths: 0.5, riskTolerance: 50, marketValidation: 50 });
const t1 = classifyDecisionTiming('startup', g1);
check('low energy + low runway → startup is NOT Now', t1.timing !== 'now');
check('low energy + low runway → startup is Pause', t1.timing === 'pause');

// 2. high energy + sufficient runway + moderate risk allows experiment as Conditional or Now
const g2 = evaluateReadinessGates({ energy: 85, runwayMonths: 8, riskTolerance: 50, marketValidation: 30 });
const t2 = classifyDecisionTiming('contentBrand', g2);
check('high energy + runway + moderate risk → content Conditional/Now', t2.timing === 'conditional' || t2.timing === 'now');
const g2b = evaluateReadinessGates({ energy: 85, runwayMonths: 8, riskTolerance: 70, marketValidation: 85 });
check('same but already validated → content Now', classifyDecisionTiming('contentBrand', g2b).timing === 'now');

// 3. high identity but high market-validation need becomes Conditional
const g3 = evaluateReadinessGates({ energy: 80, runwayMonths: 18, riskTolerance: 85, marketValidation: 10 });
const t3 = classifyDecisionTiming('startup', g3, { identityFit: 90 });
check('high identity + unmet validation need → Conditional', t3.timing === 'conditional');
check('high identity does NOT override constraint', t3.bindingConstraints.includes('marketValidation'));

// 4. low risk tolerance downgrades high-risk options
const g4 = evaluateReadinessGates({ energy: 80, runwayMonths: 18, riskTolerance: 10, marketValidation: 90 });
const t4 = classifyDecisionTiming('independent', g4);
check('low risk tolerance → independent NOT Now', t4.timing !== 'now');
check('low risk tolerance → downgraded to PrepareAfter or Pause', t4.timing === 'prepareAfter' || t4.timing === 'pause');
check('low risk tolerance binds the risk gate', t4.bindingConstraints.includes('risk'));

// 5. severe burnout produces Pause or PrepareAfter (and recovery becomes Now)
const g5 = evaluateReadinessGates({ energy: 5, runwayMonths: 12, riskTolerance: 80, marketValidation: 90 });
check('severe burnout → startup Pause/PrepareAfter', ['pause', 'prepareAfter'].includes(classifyDecisionTiming('startup', g5).timing));
check('severe burnout → jobChange PrepareAfter', classifyDecisionTiming('jobChange', g5).timing === 'prepareAfter');
check('severe burnout → recovery is the Now move', classifyDecisionTiming('restRecover', g5).timing === 'now');

// Always-present outputs
const rev = generateReversalConditions('startup', g3);
check('reversal conditions present for a conditional option', rev.length >= 1 && rev[0].conditions.length >= 1);
check('reversal rule promotes the intended option', rev.length >= 1 && rev[0].promoteTo === 'startup');
const reev = generateReevaluationCriteria(g5);
check('reevaluation always returns ≥1 criterion at 30 days', reev.reviewAfterDays === 30 && reev.criteria.length >= 1);

// Context-aware reeval: criteria match the current best move.
const recGates = evaluateReadinessGates({ energy: 5, runwayMonths: 4, riskTolerance: 10, marketValidation: 10 });
const recReev = generateReevaluationCriteria(recGates, { bestMoveKey: 'restRecover', experimentKey: 'restRecover' });
check('recovery best move → reeval has recovery/energy criterion', recReev.criteria.some((c) => c.includes('에너지') || c.includes('회복') || c.includes('의욕')));
check('recovery best move → market-signal criterion suppressed', !recReev.criteria.some((c) => c.includes('실제 반응')));
const recReevMktExp = generateReevaluationCriteria(recGates, { bestMoveKey: 'restRecover', experimentKey: 'startup' });
check('recovery + market-facing experiment → market-signal re-enabled', recReevMktExp.criteria.some((c) => c.includes('실제 반응')));
const startupReev = generateReevaluationCriteria(evaluateReadinessGates({ energy: 80, runwayMonths: 2, riskTolerance: 70, marketValidation: 10 }), { bestMoveKey: 'startup', experimentKey: 'startup' });
check('startup best move → prioritizes talk/interviews + demand + runway', startupReev.criteria.some((c) => c.includes('인터뷰')) && startupReev.criteria.some((c) => c.includes('돈·시간')) && startupReev.criteria.some((c) => c.includes('runway')));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
