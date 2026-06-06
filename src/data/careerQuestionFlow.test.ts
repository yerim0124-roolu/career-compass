// Headless end-to-end fixture test: mock card selections → vector + gates → ResultSpine.
// Self-contained (no test-runner deps): run with `node` (Node 24 strips types).
// No UI is exercised. A failing assertion throws → non-zero exit.

import { assembleGatesFromSelections, assembleConstructProfile, CAREER_QUESTION_FLOW, EXPERIMENT_OPTION_BY_CARD, EXPERIMENT_LABEL_BY_CARD } from './careerQuestionFlow.ts';
import { MOCK_RESPONSE_SETS } from './careerQuestionFlow.examples.ts';
import {
  createEmptyCareerVector,
  applyChoiceEffects,
  applyMultipleChoiceEffects,
  applyRankingEffects,
  normalizeCareerVector,
} from '../lib/careerVectorEngine.ts';
import { applyConstructEffects, createEmptyConstructProfile } from '../lib/careerConstructEngine.ts';
import { buildResultSpine } from '../lib/resultSpineEngine.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Flow sanity: low-friction guarantees ──────────────────────────────────────
const choiceSteps = CAREER_QUESTION_FLOW.filter((s) => s.inputType !== 'optional_short_text');
const everyCardScored = choiceSteps.every((s) =>
  (s.options ?? []).every((c) => Object.keys(c.scoreEffects).length > 0 || c.gateAssignment !== undefined || c.constructEffects !== undefined),
);
check('every choice card has scoreEffects / gateAssignment / constructEffects', everyCardScored);

const shortTextSteps = CAREER_QUESTION_FLOW.filter((s) => s.inputType === 'optional_short_text');
check('at most one short-text field, and it is optional', shortTextSteps.length <= 1 && shortTextSteps.every((s) => s.optional === true));

const stages = new Set(CAREER_QUESTION_FLOW.map((s) => s.stage));
check('all 7 stages present', stages.size === 7);

const insightSteps = CAREER_QUESTION_FLOW.filter((s) => s.liveInsightTrigger).length;
check('live insight triggers exist (every 2–3 stages)', insightSteps >= 2);

// ─── End-to-end per mock response set ───────────────────────────────────────────
for (const set of MOCK_RESPONSE_SETS) {
  console.log(`\n[${set.name}]`);
  let v = applyMultipleChoiceEffects(createEmptyCareerVector(), set.cards);
  v = applyRankingEffects(v, set.rankedValues);
  const vector = normalizeCareerVector(v);
  const gates = assembleGatesFromSelections(set.cards);
  const constructProfile = assembleConstructProfile(set.cards, set.rankedValues);
  const spine = buildResultSpine(vector, gates, { preferredExperimentOptionKey: set.preferredExperimentOptionKey, constructProfile, inputCompleteness: 1 });

  check('  identityAxis present (composed sentence)', spine.identityAxis.statement.length > 0);
  check('  currentBestMove present', !!spine.currentBestMove && !!spine.currentBestMove.optionKey);
  check('  reversal warning conditions present (≥1)', spine.reversalConditions.warningOrDowngradeConditions.length >= 1);
  check('  reevaluationCriteria present (≥1, 30 days)', spine.reevaluationCriteria.criteria.length >= 1 && spine.reevaluationCriteria.reviewAfterDays === 30);
  check('  thirtyDayExperiment present and matches chosen action', spine.thirtyDayExperiment.id === `exp-${set.preferredExperimentOptionKey}`);
  check('  optional saju layer present but inactive', spine.optionalSajuLayer !== null && spine.optionalSajuLayer.available === false);
  check('  evidence layer present (why + confidence + cites SCCT)', spine.evidence.whyThisRecommendation.length >= 1 && spine.evidence.confidenceScore >= 0 && spine.evidence.theoryGroundedSummary.includes('SCCT'));
}

// Construct measurement is real: a confident profile (high self-efficacy/outcome
// expectation) scores higher confidence than a depleted/unsure one.
function spineFor(set: typeof MOCK_RESPONSE_SETS[number]) {
  let vv = applyMultipleChoiceEffects(createEmptyCareerVector(), set.cards);
  vv = applyRankingEffects(vv, set.rankedValues);
  return buildResultSpine(normalizeCareerVector(vv), assembleGatesFromSelections(set.cards), {
    preferredExperimentOptionKey: set.preferredExperimentOptionKey,
    constructProfile: assembleConstructProfile(set.cards, set.rankedValues),
    inputCompleteness: 1,
  });
}
const expertConfidence = spineFor(MOCK_RESPONSE_SETS[0]).evidence.confidenceScore;
const recoveryConfidence = spineFor(MOCK_RESPONSE_SETS[2]).evidence.confidenceScore;
check('confident profile scores > 0 confidence', expertConfidence > 0);
check('confident profile > depleted/unsure profile confidence', expertConfidence > recoveryConfidence);

// Step 8: surfaced evidence in the high-venture/low-runway scenario
const ventureEv = spineFor(MOCK_RESPONSE_SETS[1]).evidence;
check('venture → ≥4 plain-language reasons', ventureEv.whyThisRecommendation.length >= 4);
check('venture → MCDA value priority appears in why', ventureEv.whyThisRecommendation.some((w) => w.includes('우선순위로 둔')));
check('venture → contextual barrier (런웨이) surfaced', ventureEv.contextualBarriers.some((b) => b.includes('런웨이')));
check('venture → blocker framed as runway/validation, not ability', ventureEv.whyThisRecommendation.some((w) => w.includes('의욕이나 실력이 아니라')));
check('venture → narrative distinguishes readiness vs evidence frame', ventureEv.narrative.length > 0 && ventureEv.narrative.includes('실행') && (ventureEv.narrative.includes('확실성') || ventureEv.narrative.includes('장기 방향으로 굳히기')));

// Scenario 5: creator-heavy / low validation — direction vs practical move must be separated.
const creator = spineFor(MOCK_RESPONSE_SETS[4]);
check('creator → resultMode is conditional_led or safety_bridge', creator.resultMode === 'conditional_led' || creator.resultMode === 'safety_bridge');
check('creator → strategicDirection is an identity-fit option (content/independent/startup)', !!creator.strategicDirection && ['contentBrand', 'independent', 'startup'].includes(creator.strategicDirection.optionKey));
check('creator → practical now move differs from the strategic direction', creator.currentBestMove.optionKey !== creator.strategicDirection?.optionKey);
check('creator → job change is NOT the identity-level direction', creator.strategicDirection?.optionKey !== 'jobChange');
check('creator → identityAxis mentions 콘텐츠/창작/표현', /콘텐츠|창작|표현/.test(creator.identityAxis.statement));
check('creator → narrative reads coherently (direction valid + validate/prep)', creator.evidence.narrative.includes('방향은 맞지만') || creator.evidence.narrative.includes('방향이 끌리지만') || creator.evidence.narrative.includes('방향은 맞고'));
check('venture → no framework abbreviation in the main why', ventureEv.whyThisRecommendation.every((w) => !w.includes('SCCT') && !w.includes('CDDQ')));
check('venture → confidence drivers populated', ventureEv.confidenceDrivers.raised.length + ventureEv.confidenceDrivers.lowered.length >= 1);

// Scenario-specific: low runway + high validation need must NOT make startup the best move.
const venture = MOCK_RESPONSE_SETS[1];
let vv = applyMultipleChoiceEffects(createEmptyCareerVector(), venture.cards);
vv = applyRankingEffects(vv, venture.rankedValues);
const ventureSpine = buildResultSpine(normalizeCareerVector(vv), assembleGatesFromSelections(venture.cards), { preferredExperimentOptionKey: venture.preferredExperimentOptionKey });
check('low runway/high validation → startup is NOT the current best move', ventureSpine.currentBestMove.optionKey !== 'startup');

// Scenario-specific: recovery-first reeval must center on recovery, not market signals.
const recovery = MOCK_RESPONSE_SETS[2];
let rv = applyMultipleChoiceEffects(createEmptyCareerVector(), recovery.cards);
rv = applyRankingEffects(rv, recovery.rankedValues);
const recoverySpine = buildResultSpine(normalizeCareerVector(rv), assembleGatesFromSelections(recovery.cards), { preferredExperimentOptionKey: recovery.preferredExperimentOptionKey });
const recCriteria = recoverySpine.reevaluationCriteria.criteria;
check('recovery-first → best move is restRecover', recoverySpine.currentBestMove.optionKey === 'restRecover');
check('recovery-first → reeval prioritizes recovery/energy', recCriteria.some((c) => c.includes('에너지') || c.includes('회복') || c.includes('의욕')));
check('recovery-first → market-signal criteria do NOT dominate (absent)', !recCriteria.some((c) => c.includes('시장 반응')));

// ─── Output-format question reframe (less startup/freelance biased) ───────────────
const apStep = CAREER_QUESTION_FLOW.find((s) => s.id === 'ap_experiment')!;
const apLabels = (apStep.options ?? []).map((o) => o.label);
check('Q: prompt reframed to "부담 없이 남겨볼 수 있는 결과물"', apStep.assistantPrompt.includes('부담 없이 남겨볼 수 있는 결과물'));
check('Q: 8 output-format options, all with a one-line description', apLabels.length === 8 && (apStep.options ?? []).every((o) => !!o.description));
check('Q: visible labels updated to general output formats', ['글/리포트/메모', '짧은 콘텐츠', '포트폴리오/케이스', '사람과 대화/인터뷰', '내부 제안서/업무 개선안', '프로필/이력서', '회복 루틴', '아직 모르겠음'].every((l) => apLabels.includes(l)));
check('Q: startup/freelance-biased labels removed', !apLabels.some((l) => /고객 인터뷰|시장 리포트|유료 자문|제품 아이디어 설문|네트워크 미팅/.test(l)));
check('mapping: writing→investAnalysis, content→contentBrand, interview→startup, rest→restRecover', EXPERIMENT_OPTION_BY_CARD.ap_writing === 'investAnalysis' && EXPERIMENT_OPTION_BY_CARD.ap_content === 'contentBrand' && EXPERIMENT_OPTION_BY_CARD.ap_interview === 'startup' && EXPERIMENT_OPTION_BY_CARD.ap_rest === 'restRecover');
check('mapping: redesign→stayRedesign, profile→jobChange, portfolio→advisoryTeaching', EXPERIMENT_OPTION_BY_CARD.ap_redesign === 'stayRedesign' && EXPERIMENT_OPTION_BY_CARD.ap_profile === 'jobChange' && EXPERIMENT_OPTION_BY_CARD.ap_portfolio === 'advisoryTeaching');
check('mapping: 아직 모르겠음 forces no experiment (engine decides)', !('ap_unsure' in EXPERIMENT_OPTION_BY_CARD) && !!EXPERIMENT_LABEL_BY_CARD.ap_unsure);

// ─── Phase 1 audience-bias copy fixes (visible copy only; keys/gates unchanged) ───
const allOpts = CAREER_QUESTION_FLOW.flatMap((s) => s.options ?? []);
const opt = (id: string) => allOpts.find((o) => o.id === id)!;
const stepById2 = (id: string) => CAREER_QUESTION_FLOW.find((s) => s.id === id)!;
check('debias sc_outlook: no "시장" wording in any label', ['sc_both', 'sc_self_only', 'sc_market_only', 'sc_unsure'].every((id) => !opt(id).label.includes('시장')));
check('debias sc_outlook: sc_both broadened to 주변(조직·동료·고객)', opt('sc_both').label.includes('주변'));
check('debias rc_validation: title "지금 방향에 받은 반응"', stepById2('rc_validation').title === '지금 방향에 받은 반응');
check('debias rc_validation: labels drop 시장/유료 의향까지, gate keys intact', ['rc_val_none', 'rc_val_early', 'rc_val_partial', 'rc_val_done'].every((id) => !opt(id).label.includes('시장') && !opt(id).label.includes('유료 의향까지')) && opt('rc_val_none').gateAssignment?.marketValidation === 'unvalidated' && opt('rc_val_done').gateAssignment?.marketValidation === 'validated');
check('debias rc_validation: rc_val_none reads "혼자 생각만"', opt('rc_val_none').label.includes('혼자 생각만'));
check('debias fc_3: no "밖으로", uses "더 드러내고 싶다"', !opt('fc3_public').label.includes('밖으로') && opt('fc3_public').label.includes('더 드러내고 싶다'));
check('debias cs_between: broader label + description mentions 사내 이동', opt('cs_between').label.includes('여러 갈래') && (opt('cs_between').description ?? '').includes('사내 이동'));

// ─── or_internal probe (organization-internal reaction) ──────────────────────────
const orInternal = stepById2('or_internal');
check('or_internal: stage option_reactions, single_select, 5 options', orInternal.stage === 'option_reactions' && orInternal.inputType === 'single_select' && (orInternal.options ?? []).length === 5);
check('or_internal: option ids match spec', ['ori_energized', 'ori_meaning_slow', 'ori_stable_flat', 'ori_capable_flat', 'ori_unsure'].every((id) => !!opt(id)));
check('or_internal: labels match spec',
  opt('ori_energized').label === '해볼 만하고 에너지가 생긴다' &&
  opt('ori_meaning_slow').label === '의미는 있지만, 합의나 변화 속도가 걸릴 것 같다' &&
  opt('ori_stable_flat').label === '안정적이지만 성장감은 부족할 것 같다' &&
  opt('ori_capable_flat').label === '잘할 수는 있지만 크게 끌리지는 않는다' &&
  opt('ori_unsure').label === '아직은 잘 모르겠다');
check('or_internal: helperText present (org-internal hint)', !!orInternal.helperText && orInternal.helperText.includes('사내 이동'));
check('liveInsight trigger moved: or_internal=true, or_venture removed', orInternal.liveInsightTrigger === true && !stepById2('or_venture').liveInsightTrigger);
check('option_reactions stage count === 3', CAREER_QUESTION_FLOW.filter((s) => s.stage === 'option_reactions').length === 3);
check('CAREER_QUESTION_FLOW length === 19 (18 core + memo)', CAREER_QUESTION_FLOW.length === 19);

// ─── rc_options (perceived option visibility — Hope Theory pathways probe) ──────
const rcOptions = stepById2('rc_options');
const optIds = ['rc_opt_few', 'rc_opt_some', 'rc_opt_several', 'rc_opt_many'];
check('rc_options: stage reality_check, single_select, 4 options', rcOptions.stage === 'reality_check' && rcOptions.inputType === 'single_select' && (rcOptions.options ?? []).length === 4);
check('rc_options: title and assistantPrompt set', rcOptions.title === '떠오르는 선택지' && rcOptions.assistantPrompt.includes('떠오르는 다음 선택지'));
check('rc_options: helperText present', !!rcOptions.helperText && rcOptions.helperText.includes('막연한 방향'));
check('rc_options: minSelect=1, maxSelect=1', rcOptions.minSelect === 1 && rcOptions.maxSelect === 1);
check('rc_options: 4 option ids present', optIds.every((id) => !!opt(id)));
check('rc_options: labels match spec',
  opt('rc_opt_few').label === '거의 없다 — 무엇을 할 수 있을지 잘 보이지 않는다' &&
  opt('rc_opt_some').label === '1~2개는 있다 — 하지만 아직 구체적이지는 않다' &&
  opt('rc_opt_several').label === '3개 이상 있다 — 하지만 무엇을 골라야 할지 어렵다' &&
  opt('rc_opt_many').label === '너무 많다 — 정리하지 않으면 계속 분산될 것 같다');
check('rc_options: no scoreEffects on any card (CDDQ-only — no identity-axis perturbation)',
  optIds.every((id) => Object.keys(opt(id).scoreEffects).length === 0));
check('rc_options: rc_opt_few drives difficulty.selfInformationGap = 5',
  opt('rc_opt_few').constructEffects?.difficulty?.selfInformationGap === 5);
check('rc_options: rc_opt_some drives difficulty.selfInformationGap = 2 (default fixture value)',
  opt('rc_opt_some').constructEffects?.difficulty?.selfInformationGap === 2);
check('rc_options: rc_opt_several drives difficulty.valueConflict = 3 and goalClarity = 2',
  opt('rc_opt_several').constructEffects?.difficulty?.valueConflict === 3 &&
  opt('rc_opt_several').constructEffects?.scct?.goalClarity === 2);
check('rc_options: rc_opt_many drives difficulty.optionOverload = 5 and curiosity = 2',
  opt('rc_opt_many').constructEffects?.difficulty?.optionOverload === 5 &&
  opt('rc_opt_many').constructEffects?.adaptability?.curiosity === 2);
check('rc_options: NO new construct (no optionsVisibilityGap field — uses CDDQ only)',
  optIds.every((id) => {
    const ce = opt(id).constructEffects;
    // Only difficulty / adaptability / scct fields should appear — no new field family.
    if (!ce) return true;
    return Object.keys(ce).every((k) => k === 'difficulty' || k === 'adaptability' || k === 'scct' || k === 'mcda');
  }));
check('reality_check stage count === 6 (sc_outlook + rc_options + rc_runway + rc_energy + rc_risk + rc_validation)',
  CAREER_QUESTION_FLOW.filter((s) => s.stage === 'reality_check').length === 6);

const vEnergized = applyChoiceEffects(createEmptyCareerVector(), opt('ori_energized'));
check('ori_energized contributes stability+3 / executionDrive+3', vEnergized.stability === 3 && vEnergized.executionDrive === 3);
const cMeaningSlow = applyConstructEffects(createEmptyConstructProfile(), opt('ori_meaning_slow').constructEffects ?? {}, 1);
check('ori_meaning_slow increases difficulty.valueConflict (> 0)', cMeaningSlow.difficulty.valueConflict > 0);
const cEnergizedC = applyConstructEffects(createEmptyConstructProfile(), opt('ori_energized').constructEffects ?? {}, 1);
check('ori_energized increases outcomeExpectation/selfEfficacy/control (> 0)', cEnergizedC.scct.outcomeExpectation > 0 && cEnergizedC.scct.selfEfficacy > 0 && cEnergizedC.adaptability.control > 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
