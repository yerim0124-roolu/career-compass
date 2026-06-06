// Demo printer — renders the final ResultSpine text for each mock scenario.
// Run with `node src/data/careerQuestionFlow.demo.ts` to audit copy/result quality.
// Not a test (no assertions); it just prints what a user would see.

import { MOCK_RESPONSE_SETS } from './careerQuestionFlow.examples.ts';
import { assembleGatesFromSelections, assembleConstructProfile } from './careerQuestionFlow.ts';
import { createEmptyCareerVector, applyMultipleChoiceEffects, applyRankingEffects, normalizeCareerVector } from '../lib/careerVectorEngine.ts';
import { buildResultSpine } from '../lib/resultSpineEngine.ts';
import { ARCHETYPE_LABELS } from '../types/careerCompass.ts';

for (const set of MOCK_RESPONSE_SETS) {
  let v = applyMultipleChoiceEffects(createEmptyCareerVector(), set.cards);
  v = applyRankingEffects(v, set.rankedValues);
  const vector = normalizeCareerVector(v);
  const gates = assembleGatesFromSelections(set.cards);
  const constructProfile = assembleConstructProfile(set.cards, set.rankedValues);
  const spine = buildResultSpine(vector, gates, { preferredExperimentOptionKey: set.preferredExperimentOptionKey, constructProfile, inputCompleteness: 1 });

  console.log('\n================================================================');
  console.log('시나리오:', set.name);
  console.log('게이트:', JSON.stringify(gates));
  console.log('----------------------------------------------------------------');
  console.log('[중심축]', spine.identityAxis.statement);
  console.log('[성향 태그]', spine.identityAxis.archetypeTags.map((t) => ARCHETYPE_LABELS[t]).join(' · ') || '(없음)');
  console.log('[모드]', spine.resultMode, spine.strategicDirection ? `| 끌리는 방향: ${spine.strategicDirection.label} <${spine.strategicDirection.readiness}>` : '');
  console.log(`[지금의 한 수] ${spine.currentBestMove.label}  <${spine.currentBestMove.readiness}>`);
  console.log('   근거:', spine.currentBestMove.rationale);
  if (spine.prepareAfterOption) console.log(`[준비 후] ${spine.prepareAfterOption.label} — ${spine.prepareAfterOption.rationale}`);
  if (spine.conditionalOption) console.log(`[조건부] ${spine.conditionalOption.label} — ${spine.conditionalOption.rationale}`);
  if (spine.pauseOption) console.log(`[보류] ${spine.pauseOption.label} — ${spine.pauseOption.rationale}`);
  console.log('[결론을 뒤집는 조건 — 승격(긍정)]');
  if (spine.reversalConditions.promotionConditions.length === 0) console.log('   (해당 없음)');
  for (const r of spine.reversalConditions.promotionConditions) {
    console.log(`   ${r.conditions.length === 1 ? '다음 조건 충족 시' : `${r.ifMetCount}개 이상 충족 시`} → "${r.promoteToLabel}"`);
    for (const c of r.conditions) console.log(`      + ${c.condition}`);
  }
  console.log('[결론을 뒤집는 조건 — 경고/하향(부정)]');
  for (const w of spine.reversalConditions.warningOrDowngradeConditions) console.log(`      ! ${w.signal}`);
  console.log(`[30일 실험] ${spine.thirtyDayExperiment.label}`);
  for (const e of spine.thirtyDayExperiment.evidenceToCheck) console.log(`      확인: ${e}`);
  console.log(`[${spine.reevaluationCriteria.reviewAfterDays}일 후 재판정]`);
  for (const c of spine.reevaluationCriteria.criteria) console.log(`      □ ${c}`);
  console.log(`[근거·판단확실성] 실행 준비도: ${spine.evidence.actionReadiness} · 판단 확실성: ${spine.evidence.confidenceBand}(보조 ${spine.evidence.confidenceScore}점)`);
  console.log(`   내러티브: ${spine.evidence.narrative}`);
  console.log('   (자세히)');
  for (const w of spine.evidence.whyThisRecommendation) console.log(`      · ${w}`);
  console.log('   신호(사람말):');
  for (const sg of spine.evidence.constructSignals) console.log(`      [${sg.humanLabel} ${sg.level === 'high' ? '↑' : '↓'}] ${sg.note}`);
  console.log(`   확신↑: ${spine.evidence.confidenceDrivers.raised.join(', ') || '—'}`);
  console.log(`   확신↓: ${spine.evidence.confidenceDrivers.lowered.join(', ') || '—'}`);
  if (spine.evidence.contextualBarriers.length) console.log(`   현실 장벽: ${spine.evidence.contextualBarriers.join(', ')}`);
  if (spine.evidence.missingInformation.length) console.log(`   더 보면: ${spine.evidence.missingInformation.join(' / ')}`);
  console.log('[타이밍(선택)]', spine.optionalSajuLayer?.disclaimer);
}
