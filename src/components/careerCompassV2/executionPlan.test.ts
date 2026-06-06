// ExecutionPlan tests over the full flow (real FlowResponses → buildResultFromResponses).
// Self-contained (no test-runner deps): run with `node`. Verifies module + experiment +
// reeval + bridge merge into one coherent monthly plan (no competing/duplicate plans).

import type { FlowResponses } from './session.ts';
import { buildResultFromResponses } from './session.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const SCN: Record<string, FlowResponses> = {
  expert: { cs_main:{selectedOptionIds:['cs_expand']}, ar_roles:{selectedOptionIds:['ar_expert','ar_analyst','ar_advisor']}, cv_values:{selectedOptionIds:['cv_expertise','cv_impact','cv_knowledge','cv_money']}, cv_priorities:{ranking:['pr_growth','pr_meaning','pr_money','pr_influence','pr_stability']}, fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_interpreter']}, sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']}, rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']}, or_content:{selectedOptionIds:['orc_meaning_money']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']}, ap_experiment:{selectedOptionIds:['ap_writing']} },
  venture: { cs_main:{selectedOptionIds:['cs_between']}, ar_roles:{selectedOptionIds:['ar_founder','ar_freelancer']}, cv_values:{selectedOptionIds:['cv_autonomy','cv_money','cv_problem','cv_bigmarket']}, cv_priorities:{ranking:['pr_money','pr_freedom','pr_growth','pr_influence']}, fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']}, sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_some']}, rc_runway:{selectedOptionIds:['rc_runway_1to3']}, rc_energy:{selectedOptionIds:['rc_energy_capacity']}, rc_risk:{selectedOptionIds:['rc_risk_time']}, rc_validation:{selectedOptionIds:['rc_val_none']}, or_content:{selectedOptionIds:['orc_money_tiring']}, or_venture:{selectedOptionIds:['orv_energized']}, or_internal:{selectedOptionIds:['ori_unsure']}, ap_experiment:{selectedOptionIds:['ap_interview']} },
  recovery: { cs_main:{selectedOptionIds:['cs_rest']}, ar_roles:{selectedOptionIds:['ar_reset','ar_expert']}, cv_values:{selectedOptionIds:['cv_recovery','cv_stability','cv_expertise']}, cv_priorities:{ranking:['pr_recovery','pr_stability','pr_meaning']}, fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']}, sc_outlook:{selectedOptionIds:['sc_unsure']}, rc_options:{selectedOptionIds:['rc_opt_some']}, rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_rest']}, rc_risk:{selectedOptionIds:['rc_risk_none']}, rc_validation:{selectedOptionIds:['rc_val_none']}, or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']}, ap_experiment:{selectedOptionIds:['ap_rest']} },
  creator: { cs_main:{selectedOptionIds:['cs_many']}, ar_roles:{selectedOptionIds:['ar_creator','ar_freelancer','ar_founder']}, cv_values:{selectedOptionIds:['cv_creativity','cv_impact','cv_autonomy','cv_meaning']}, cv_priorities:{ranking:['pr_freedom','pr_meaning','pr_growth']}, fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']}, sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_some']}, rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_capacity']}, rc_risk:{selectedOptionIds:['rc_risk_exp']}, rc_validation:{selectedOptionIds:['rc_val_none']}, or_content:{selectedOptionIds:['orc_energized']}, or_venture:{selectedOptionIds:['orv_energized']}, or_internal:{selectedOptionIds:['ori_unsure']}, ap_experiment:{selectedOptionIds:['ap_content']} },
  stable: { cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_leader','ar_creator']}, cv_values:{selectedOptionIds:['cv_stability','cv_creativity','cv_growth']}, cv_priorities:{ranking:['pr_stability','pr_growth','pr_freedom']}, fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_interpreter']}, sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']}, rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']}, or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']}, ap_experiment:{selectedOptionIds:['ap_redesign']} },
};

const ep = (k: keyof typeof SCN) => buildResultFromResponses(SCN[k]).executionPlan;
const hasDup = (xs: string[]) => new Set(xs).size !== xs.length;

// ─── recovery-first: module and experiment merge without repetition ──────────────
{
  const p = ep('recovery');
  check('recovery: coreExperiment from chosen restRecover experiment', p.coreExperiment.sourceOptionKey === 'restRecover');
  check('recovery: weekly actions are the recovery module plan (1-2주 회복 루틴)', p.weeklyActions[0].week === '1-2주' && p.weeklyActions[0].action.includes('회복 루틴'));
  check('recovery: one plan, no duplicated success signals', !hasDup(p.successSignals));
  check('recovery: no safety bridge (recovery is the move, not a bridge)', p.safetyBridge === undefined && p.directionToValidate === undefined);
}

// ─── stable-but-bored: redesign module + redesign experiment merge ───────────────
{
  const p = ep('stable');
  check('stable: coreExperiment from chosen stayRedesign experiment', p.coreExperiment.sourceOptionKey === 'stayRedesign');
  check('stable: weekly actions are the role-redesign module plan', p.weeklyActions[0].action.includes('불만') || p.weeklyActions[0].action.includes('지루함'));
  check('stable: experiment + module collapse (no safety bridge)', p.safetyBridge === undefined);
  check('stable: no duplicated success signals', !hasDup(p.successSignals));
}

// ─── creator/low-validation: safetyBridge + directionToValidate ──────────────────
{
  const p = ep('creator');
  check('creator: shows safety bridge (이직)', !!p.safetyBridge && p.safetyBridge.label === '이직');
  check('creator: shows direction to validate (콘텐츠/퍼스널 브랜드, 조건부)', !!p.directionToValidate && p.directionToValidate.label.includes('콘텐츠') && p.directionToValidate.readinessLabel === '조건부');
  check('creator: planModule follows chosen content experiment (콘텐츠 발행)', p.coreExperiment.sourceOptionKey === 'contentBrand' && p.weeklyActions.some((w) => w.action.includes('콘텐츠') || w.action.includes('발행')));
  check('creator: diagnosed market-test preserved as a hint (not a 2nd plan)', !!p.secondaryModuleHint && (p.secondaryModuleHint.includes('30일 실제 반응 확인') || p.secondaryModuleHint.includes('실제 반응 확인')));
}

// ─── high-venture/low-runway: safetyBridge + market validation ───────────────────
{
  const p = ep('venture');
  check('venture: shows safety bridge (이직)', !!p.safetyBridge && p.safetyBridge.label === '이직');
  check('venture: direction to validate is 창업 (준비 후)', !!p.directionToValidate && p.directionToValidate.label === '창업' && p.directionToValidate.readinessLabel === '준비 후');
  check('venture: core experiment is market validation (인터뷰)', p.coreExperiment.sourceOptionKey === 'startup' && p.coreExperiment.label.includes('인터뷰'));
  check('venture: weekly actions are the validation-sprint plan', p.weeklyActions.some((w) => w.action.includes('인터뷰') || w.action.includes('가설')));
}

// ─── expert/interpreter: report + advisory + portfolio map into ONE plan ─────────
{
  const p = ep('expert');
  check('expert: weekly actions are the portfolio module (성과 정리)', p.weeklyActions[0].action.includes('성과'));
  check('expert: core experiment is the chosen report', p.coreExperiment.sourceOptionKey === 'investAnalysis' && p.coreExperiment.label.includes('리포트'));
  check('expert: reeval is one coherent expertise-output check (report/inquiry, not advisory split)', p.reevaluationChecklist.some((c) => c.includes('리포트') || c.includes('조회')) && !p.reevaluationChecklist.some((c) => c.includes('자문')));
  check('expert: single plan (no safety bridge, direct now)', p.safetyBridge === undefined);
}

// ─── secondaryModule is only a hint, never a second plan ─────────────────────────
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const p = ep(k);
  check(`${k}: exactly one weeklyActions array (no second plan)`, Array.isArray(p.weeklyActions) && p.weeklyActions.length >= 3 && p.weeklyActions.length <= 4);
  check(`${k}: secondaryModuleHint is a short hint string`, p.secondaryModuleHint === undefined || (typeof p.secondaryModuleHint === 'string' && p.secondaryModuleHint.startsWith('여력이 되면') && !p.secondaryModuleHint.includes('\n')));
  check(`${k}: reevaluationDateLabel is "30일 후 (YYYY-MM-DD)"`, /^30일 후 \(\d{4}-\d{2}-\d{2}\)$/.test(p.reevaluationDateLabel));
  check(`${k}: success signals deduped`, !hasDup(p.successSignals));
}

// ─── P1: reevaluation aligned with coreExperiment (not the bridge/best move) ──────
const jobCount = (xs: string[]) => xs.filter((c) => /공고|면접|이직/.test(c)).length;
{
  const cr = ep('creator');
  check('P1 creator: reeval leads with content/market, not job postings', /콘텐츠|저장|공유|주제|반응/.test(cr.reevaluationChecklist[0]));
  check('P1 creator: job-change safety bridge ≤ 1 item', jobCount(cr.reevaluationChecklist) <= 1);
}
{
  const ve = ep('venture');
  check('P1 venture: reeval focuses on interviews/paid intent', ve.reevaluationChecklist.some((c) => /인터뷰|유료|고객/.test(c)));
  check('P1 venture: job-change safety bridge ≤ 1 item', jobCount(ve.reevaluationChecklist) <= 1);
}
{
  const re = ep('recovery');
  check('P1 recovery: reeval has no market/interview primary item', !re.reevaluationChecklist.some((c) => /시장|유료|저장|공유|인터뷰/.test(c)));
  check('P1 recovery: reeval is energy/recovery focused', re.reevaluationChecklist.some((c) => /에너지|회복|의욕/.test(c)));
}
{
  const st = ep('stable');
  check('P1 stable: reeval focuses on role redesign', st.reevaluationChecklist.some((c) => /재설계|역할/.test(c)));
  check('P1 stable: reeval includes satisfaction/feasibility', st.reevaluationChecklist.some((c) => /업무|만족|조정/.test(c)));
}
{
  const ex = ep('expert');
  check('P1 expert: reeval is one coherent expertise-output (no advisory split)', !ex.reevaluationChecklist.some((c) => c.includes('자문')) && ex.reevaluationChecklist.some((c) => /리포트|조회|문의/.test(c)));
}

// ─── P2: semantic dedupe + limits ────────────────────────────────────────────────
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const p = ep(k);
  check(`P2 ${k}: successSignals ≤ 3`, p.successSignals.length <= 3);
  check(`P2 ${k}: stopOrPivotCriteria ≤ 3`, p.stopOrPivotCriteria.length <= 3);
  check(`P2 ${k}: reevaluationChecklist ≤ 4`, p.reevaluationChecklist.length <= 4);
}
{
  const cr = ep('creator');
  check('P2 creator: 저장·공유 reaction signal collapsed (not repeated)', cr.successSignals.filter((s) => s.includes('저장')).length <= 1);
}
{
  const ve = ep('venture');
  check('P2 venture: paid-intent signal collapsed (not repeated)', ve.successSignals.filter((s) => s.includes('유료')).length <= 1);
  check('P2 venture: keeps the concrete numbered signal (3명/10명)', ve.successSignals.some((s) => /\d명/.test(s)));
}

// ─── P4: promotion conditions filtered to context + capped; raw data preserved ────
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const sp = buildResultFromResponses(SCN[k]);
  check(`P4 ${k}: executionPlan.promotionConditions ≤ 2`, sp.executionPlan.promotionConditions.length <= 2);
  check(`P3 ${k}: raw option judgments still on ResultSpine`,
    Array.isArray(sp.reversalConditions.promotionConditions) &&
    sp.reversalConditions.warningOrDowngradeConditions.length >= 1 &&
    'prepareAfterOption' in sp && 'conditionalOption' in sp && 'pauseOption' in sp);
}
{
  const ex = buildResultFromResponses(SCN.expert);
  check('P4 expert: contextless 프리랜스/독립 promotion suppressed (raw had it)',
    ex.executionPlan.promotionConditions.length === 0 && ex.reversalConditions.promotionConditions.some((r) => r.promoteTo === 'independent'));
}
{
  const st = buildResultFromResponses(SCN.stable);
  check('P4 stable: contextless promotion suppressed', st.executionPlan.promotionConditions.length === 0);
}
{
  const ve = buildResultFromResponses(SCN.venture);
  const keys = ve.executionPlan.promotionConditions.map((r) => r.promoteTo);
  check('P4 venture: promotions are contextual (startup/advisory only)', keys.length >= 1 && keys.every((kk) => kk === 'startup' || kk === 'advisoryTeaching'));
}
{
  const cr = buildResultFromResponses(SCN.creator);
  const keys = cr.executionPlan.promotionConditions.map((r) => r.promoteTo);
  check('P4 creator: promotions are contextual', keys.length >= 1 && keys.every((kk) => kk === 'startup' || kk === 'advisoryTeaching' || kk === 'contentBrand'));
}
{
  const re = buildResultFromResponses(SCN.recovery);
  check('P4 recovery: advisory promotion suppressed (not contextual)', re.executionPlan.promotionConditions.every((r) => r.promoteTo !== 'advisoryTeaching'));
}

// ─── P5: recovery tag guard is display-only (internal signal preserved) ───────────
{
  const re = buildResultFromResponses(SCN.recovery);
  check('P5 recovery: marketInsightGap still inferred internally (raw solutionLayer)', re.solutionLayer.supportTags.includes('marketInsightGap'));
  check('P5 recovery: guard condition holds (burnout / restRecover now-move)', re.solutionLayer.mainTypeKey === 'overloadedBurnout' || re.currentBestMove.optionKey === 'restRecover');
}

// ─── Output-format reframe: coreExperiment uses the general label, no forced 이직 ──
check('reframe: creator coreExperiment uses general content label', ep('creator').coreExperiment.label === '짧은 콘텐츠 몇 개를 올려 가볍게 반응 보기');
check('reframe: expert(글/리포트) coreExperiment is general (not "시장 리포트")', ep('expert').coreExperiment.label === '글·리포트·메모로 생각이나 전문성을 한 편 정리해 남기기');
{
  // profile/resume chosen on an otherwise stable profile → must not force 이직 as the move
  const profileResume: FlowResponses = { ...SCN.stable, ap_experiment: { selectedOptionIds: ['ap_profile'] } };
  const pr = buildResultFromResponses(profileResume);
  check('profile/resume: coreExperiment uses general profile label', pr.executionPlan.coreExperiment.label === '경험을 밖에서도 읽히게 프로필·이력서로 정리하기');
  check('profile/resume: routes via jobChange key but label does not say 이직', pr.executionPlan.coreExperiment.sourceOptionKey === 'jobChange' && !pr.executionPlan.coreExperiment.label.includes('이직'));
  check('profile/resume: now-move not forced to 이직 (stable context stays redesign)', pr.currentBestMove.optionKey !== 'jobChange');
}

// ─── or_internal regression + roleRedesign tight alignment ───────────────────────
check('or_internal regression: all 5 SCN with ori_unsure remain stable (mainType + bestMove + sourceOptionKey present)',
  (Object.keys(SCN) as (keyof typeof SCN)[]).every((k) => {
    const sp = buildResultFromResponses(SCN[k]);
    return !!sp.solutionLayer.mainTypeKey && !!sp.currentBestMove.optionKey && !!sp.executionPlan.coreExperiment.sourceOptionKey;
  }));
{
  // stable + ori_energized + ap_redesign → role-redesign tight alignment (coreExperiment + module plan)
  const stableEnergized: FlowResponses = {
    ...SCN.stable,
    or_internal: { selectedOptionIds: ['ori_energized'] },
    ap_experiment: { selectedOptionIds: ['ap_redesign'] },
  };
  const sp = buildResultFromResponses(stableEnergized);
  check('stable + ori_energized + ap_redesign → coreExperiment uses internal-proposal general label',
    sp.executionPlan.coreExperiment.label === '지금 자리에서 역할·방식을 바꿀 내부 제안서 한 건 만들기');
  check('stable + ori_energized + ap_redesign → weeklyActions[0] is the role-redesign module step (불만/지루함)',
    /불만|지루함/.test(sp.executionPlan.weeklyActions[0].action));
  check('stable + ori_energized + ap_redesign → sourceOptionKey routes via stayRedesign',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'stayRedesign');
}

// ─── rc_options reachability for lowOptionVisibility (flow-based, not crafted) ──
// Profile: not burnt out (energy steady + runway comfortable + low readinessGap),
// identity axes all suppressed (no creator/impact/autonomy pull), and the perceived
// no-options signal comes from rc_opt_few + or_internal_unsure + ap_unsure.
//
// Avoided cards: ar_reset (readinessGap+2), sc_unsure (readinessGap+5), cs_stay alone
// drives readinessGap to ~40 which is safely below the C_HIGH (66) burnout gate.
const lowOptionResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_stay'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_leader'] },  // no readinessGap; impact small after normalize
  cv_values: { selectedOptionIds: ['cv_stability', 'cv_expertise'] },
  cv_priorities: { ranking: ['pr_stability', 'pr_growth'] },
  fc_1: { selectedOptionIds: ['fc1_expert'] },
  fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] },
  fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_market_only'] },        // no readinessGap; adds selfInformationGap+3
  rc_options: { selectedOptionIds: ['rc_opt_few'] },            // ← perceived: no visible options (+5 selfInfoGap)
  rc_runway: { selectedOptionIds: ['rc_runway_6to12'] },         // comfortable (NOT runway-locked)
  rc_energy: { selectedOptionIds: ['rc_energy_ok'] },            // steady (NOT burnt out)
  rc_risk: { selectedOptionIds: ['rc_risk_cost'] },
  rc_validation: { selectedOptionIds: ['rc_val_none'] },
  or_content: { selectedOptionIds: ['orc_capable_flat'] },
  or_venture: { selectedOptionIds: ['orv_capable_flat'] },
  or_internal: { selectedOptionIds: ['ori_unsure'] },
  ap_experiment: { selectedOptionIds: ['ap_unsure'] },           // ← "결과물 미정"
};
{
  const sp = buildResultFromResponses(lowOptionResponses);
  check('rc_options reachability: rc_opt_few + ap_unsure + low identity pull → mainType = lowOptionVisibility',
    sp.solutionLayer.mainTypeKey === 'lowOptionVisibility');
  check('rc_options reachability: opportunityGeneration is the primary module',
    sp.solutionLayer.primaryModule.key === 'opportunityGeneration');
  check('rc_options reachability: closingLine uses option-generation framing (not "narrow down")',
    sp.executionPlan.closingLine.includes('후보가 2개만 생겨도') && !sp.executionPlan.closingLine.includes('여기까지면'));
  check('rc_options reachability: Hope-Theory mainTypeContextNote present',
    !!sp.executionPlan.mainTypeContextNote && sp.executionPlan.mainTypeContextNote.includes('능력이나 의지가 부족하다는 뜻이 아닙니다'));
}

// ─── Option-rich protection: rc_opt_many should NOT trigger lowOptionVisibility ──
// Same low-identity profile but with rc_opt_many → optionOverload high → scatteredExplorer
// (or any other type) but never lowOptionVisibility.
const optionRichResponses: FlowResponses = { ...lowOptionResponses, rc_options: { selectedOptionIds: ['rc_opt_many'] } };
{
  const sp = buildResultFromResponses(optionRichResponses);
  check('option-rich protection: rc_opt_many → mainType ≠ lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
}
// And the canonical "many options" profile (cs_many + rc_opt_many + ap_unsure) — still not lowOptionVisibility.
const manyOptionsCanonical: FlowResponses = { ...SCN.creator, rc_options: { selectedOptionIds: ['rc_opt_many'] }, ap_experiment: { selectedOptionIds: ['ap_unsure'] } };
{
  const sp = buildResultFromResponses(manyOptionsCanonical);
  check('option-rich protection (creator + rc_opt_many): mainType ≠ lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
}

// ─── ap_unsure alone is NOT enough to trigger lowOptionVisibility ───────────────
// Picking "아직 모르겠음" on the output-format question only adds optionOverload+2 — it
// must NOT push a user with real identity pull (creator/venture/etc.) into
// lowOptionVisibility. The classifier's lowIdentityPull gate is the safeguard.
const apUnsureCreatorResponses: FlowResponses = { ...SCN.creator, ap_experiment: { selectedOptionIds: ['ap_unsure'] } };
{
  const sp = buildResultFromResponses(apUnsureCreatorResponses);
  check('ap_unsure alone (creator profile, high identity pull): mainType ≠ lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
}
const apUnsureVentureResponses: FlowResponses = { ...SCN.venture, ap_experiment: { selectedOptionIds: ['ap_unsure'] } };
{
  const sp = buildResultFromResponses(apUnsureVentureResponses);
  check('ap_unsure alone (venture profile, runway-locked): mainType ≠ lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
}

// ─── P1: activeLenses + closing-line + supportTag context resolution (full flow) ───
// Closing line variants are mutually exclusive per result.
const CLOSING_OPT = '이번 달은 결론을 내리지 않아도 됩니다. 해볼 만한 후보가 2개만 생겨도 충분합니다.';
const CLOSING_ESS = '이번 달은 더 늘리기보다, 중요한 후보를 2~3개로 정리하는 것만으로 충분합니다.';
const CLOSING_ACT = '이번 달은 완성보다, 작은 실험으로 한 줄의 신호를 남기면 충분합니다.';
// P1.5 — burnout/recovery variant added.
const CLOSING_REC = '이번 달은 새 판을 벌이지 않고, 에너지·생활 리듬부터 돌려놓으면 충분합니다.';
const isOneOf3 = (s: string) => s === CLOSING_OPT || s === CLOSING_ESS || s === CLOSING_ACT || s === CLOSING_REC;

for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const sp = buildResultFromResponses(SCN[k]);
  const p = sp.executionPlan;
  check(`P1 ${k}: activeLenses present (always set, never null)`,
    typeof p.activeLenses === 'object' && p.activeLenses !== null &&
    typeof p.activeLenses.essentialism === 'boolean' && typeof p.activeLenses.range === 'boolean' &&
    typeof p.activeLenses.plannedHappenstance === 'boolean' && typeof p.activeLenses.jobCrafting === 'boolean');
  check(`P1 ${k}: closingLine is exactly one of the 3 variants`, isOneOf3(p.closingLine));
  check(`P1 ${k}: supportTagLabels never contain "시장 반응 확인 필요" (replaced by context-resolved label)`,
    !p.supportTagLabels.includes('시장 반응 확인 필요'));
}

// Per-scenario lens assertions
{
  const expert = buildResultFromResponses(SCN.expert).executionPlan;
  check('P1 expert (plateauedPerformer): jobCrafting ON', expert.activeLenses.jobCrafting === true);
  check('P1 expert: closingLine NOT optionGeneration', expert.closingLine !== CLOSING_OPT);
}
{
  const venture = buildResultFromResponses(SCN.venture).executionPlan;
  check('P1 venture (unvalidatedAspirant): closingLine NOT optionGeneration', venture.closingLine !== CLOSING_OPT);
  check('P1 venture: plannedHappenstance OFF (has identity pull)', venture.activeLenses.plannedHappenstance === false);
}
{
  const recovery = buildResultFromResponses(SCN.recovery).executionPlan;
  check('P1 recovery (burnout): plannedHappenstance OFF', recovery.activeLenses.plannedHappenstance === false);
  check('P1 recovery: closingLine NOT optionGeneration', recovery.closingLine !== CLOSING_OPT);
}
{
  const creator = buildResultFromResponses(SCN.creator).executionPlan;
  check('P1 creator: closingLine NOT optionGeneration', creator.closingLine !== CLOSING_OPT);
  // creator (cs_many) has optionOverload from cs_many → essentialism likely ON
  check('P1 creator: essentialism ON (cs_many drives optionOverload)', creator.activeLenses.essentialism === true);
}
{
  const stable = buildResultFromResponses(SCN.stable).executionPlan;
  check('P1 stable (restlessStabilizer): jobCrafting ON', stable.activeLenses.jobCrafting === true);
  check('P1 stable: closingLine NOT optionGeneration', stable.closingLine !== CLOSING_OPT);
}

// lowOptionVisibility reach case → plannedHappenstance ON, optionGeneration closing.
{
  const sp = buildResultFromResponses(lowOptionResponses);
  const p = sp.executionPlan;
  check('P1 lowOpt: plannedHappenstance ON', p.activeLenses.plannedHappenstance === true);
  check('P1 lowOpt: closingLine === optionGeneration', p.closingLine === CLOSING_OPT);
}

// rc_opt_many (option overload) → essentialism ON.
{
  const sp = buildResultFromResponses(manyOptionsCanonical);
  const p = sp.executionPlan;
  check('P1 option-overload (rc_opt_many): essentialism ON', p.activeLenses.essentialism === true);
}

// ─── P1.1: end-to-end evidence/copy guards across mainTypes ────────────────────
// lowOptionVisibility evidence must have no "시장 확인" / "시장 반응" / "시장 반응 미확인".
{
  const sp = buildResultFromResponses(lowOptionResponses);
  const whyText = sp.evidence.whyThisRecommendation.join(' || ');
  check('P1.1 lowOpt: no "시장 확인" in evidence why',
    !whyText.includes('시장 확인'));
  check('P1.1 lowOpt: no "시장 반응" in evidence why',
    !whyText.includes('시장 반응'));
  check('P1.1 lowOpt: no "시장 반응 미확인" in contextualBarriers',
    !sp.evidence.contextualBarriers.some((b) => b.includes('시장 반응 미확인')));
  check('P1.1 lowOpt: marketValidation barrier surfaces as "선택지 단서 부족" (or omitted)',
    sp.evidence.contextualBarriers.every((b) => !b.includes('시장')));
}

// overloadedBurnout evidence must not recommend market validation / option-info as primary.
{
  const sp = buildResultFromResponses(SCN.recovery);
  const why = sp.evidence.whyThisRecommendation;
  const whyText = why.join(' || ');
  check('P1.1 burnout: no "시장 확인" / "시장 반응" anywhere in why',
    !whyText.includes('시장 확인') && !whyText.includes('시장 반응'));
  check('P1.1 burnout: no "후보별 정보를 채워보는" primary action',
    !whyText.includes('후보별 정보를 채워보는'));
  check('P1.1 burnout: no "사례·정보를 모아" recommendation',
    !whyText.includes('사례·정보를 모아'));
  check('P1.1 burnout: no "작은 반응 확인" market-validation action',
    !whyText.includes('작은 반응 확인'));
  check('P1.1 burnout: marketValidation gate barrier suppressed (energy is the binding constraint)',
    !sp.evidence.contextualBarriers.some((b) => b.includes('시장') || b.includes('실제 반응 미확인') || b.includes('외부 반응 미확인') || b.includes('선택지 단서 부족')));
}

// Conditional-led creator (cs_many + ap_content + ar_creator): strategicDirection is contentBrand,
// bestMove is jobChange (safety bridge) → resolver should land on MARKET copy.
{
  const sp = buildResultFromResponses(SCN.creator);
  const ev = sp.evidence;
  check('P1.1 creator (conditional_led): narrative uses "실제 반응" not "후보별 정보"',
    ev.narrative.includes('실제 반응') && !ev.narrative.includes('후보별 정보가 충분히 모이지'));
  check('P1.1 creator: missingInformation uses market-facing wording (잠재 고객 인터뷰)',
    ev.missingInformation.some((m) => m.includes('잠재 고객 인터뷰')));
  check('P1.1 creator: confidenceDrivers.lowered uses "실제 반응 부족" not "선택지 정보 부족"',
    ev.confidenceDrivers.lowered.includes('실제 반응 부족') && !ev.confidenceDrivers.lowered.includes('선택지 정보 부족'));
  check('P1.1 creator: supportTagLabels uses "실제 반응 확인 필요"',
    sp.executionPlan.supportTagLabels.includes('실제 반응 확인 필요') && !sp.executionPlan.supportTagLabels.includes('선택지 정보 보강 필요'));
  check('P1.1 creator: contextualBarrier uses "실제 반응 미확인" not "시장 반응 미확인"',
    ev.contextualBarriers.includes('실제 반응 미확인') && !ev.contextualBarriers.includes('시장 반응 미확인'));
}

// Conditional-led venture (safety bridge = jobChange, direction = startup) → MARKET copy.
{
  const sp = buildResultFromResponses(SCN.venture);
  const ev = sp.evidence;
  check('P1.1 venture (conditional_led): narrative uses "실제 반응" not "후보별 정보"',
    ev.narrative.includes('실제 반응') && !ev.narrative.includes('후보별 정보가 충분히 모이지'));
  check('P1.1 venture: supportTagLabels uses "실제 반응 확인 필요"',
    sp.executionPlan.supportTagLabels.includes('실제 반응 확인 필요'));
  check('P1.1 venture: contextualBarrier uses "실제 반응 미확인"',
    ev.contextualBarriers.includes('실제 반응 미확인'));
}

// Grammar bug never appears in any scenario.
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const sp = buildResultFromResponses(SCN[k]);
  const all = [
    ...sp.evidence.whyThisRecommendation,
    sp.evidence.narrative,
    ...sp.executionPlan.stopOrPivotCriteria,
    ...sp.executionPlan.reevaluationChecklist,
  ].join(' || ');
  check(`P1.1 ${k}: no "것를" grammar bug`, !all.includes('것를'));
}

// P1.1 Range tightening: lowOpt + burnout should NOT have activeLenses.range = true with the new floor.
{
  const sp = buildResultFromResponses(lowOptionResponses);
  check('P1.1 lowOpt: activeLenses.range = false after first-axis floor', sp.executionPlan.activeLenses.range === false);
  check('P1.1 lowOpt: archetypeTags does NOT include careerComposer',
    !sp.identityAxis.archetypeTags.includes('careerComposer'));
}
{
  const sp = buildResultFromResponses(SCN.recovery);
  check('P1.1 burnout: activeLenses.range = false (depleted profile, weak top axis)', sp.executionPlan.activeLenses.range === false);
  check('P1.1 burnout: archetypeTags does NOT include careerComposer',
    !sp.identityAxis.archetypeTags.includes('careerComposer'));
}

// ─── P1.2 lowOptionVisibility classifier guards (Guard 1 + Guard 2) ─────────────
// A1: true no-visible-options profile (rc_opt_few + ap_unsure + stability+expertise rooted)
// must REMAIN lowOptionVisibility. Guard 2 allows it because explicit no-options + no visible-direction.
const P12_A1_lowOpt: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_expert','ar_leader']},
  cv_values:{selectedOptionIds:['cv_stability','cv_expertise']}, cv_priorities:{ranking:['pr_stability','pr_growth']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_market_only']}, rc_options:{selectedOptionIds:['rc_opt_few']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P12_A1_lowOpt);
  check('P1.2 A1 (true no-options + ap_unsure): remains lowOptionVisibility',
    sp.solutionLayer.mainTypeKey === 'lowOptionVisibility');
  check('P1.2 A1: closing is optionGeneration variant',
    sp.executionPlan.closingLine.includes('결론을 내리지 않아도'));
}

// B4 internal growth: ori_energized + ap_redesign + stable base → must NOT be lowOpt.
const P12_B4_internal: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_leader','ar_expert']},
  cv_values:{selectedOptionIds:['cv_stability','cv_growth','cv_meaning']}, cv_priorities:{ranking:['pr_growth','pr_stability','pr_meaning']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_energized']},
  ap_experiment:{selectedOptionIds:['ap_redesign']},
};
{
  const sp = buildResultFromResponses(P12_B4_internal);
  check('P1.2 B4 (internal growth + ap_redesign): NOT lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
  check('P1.2 B4: stayRedesign/roleRedesign-aligned (bestMove stayRedesign OR plan from roleRedesign)',
    sp.currentBestMove.optionKey === 'stayRedesign' || sp.solutionLayer.primaryModule.key === 'roleRedesign');
  check('P1.2 B4: weekly plan reflects role-redesign (불만/지루함 root)',
    /불만|지루함|재설계/.test(sp.executionPlan.weeklyActions[0].action));
}

// B5 stability-first: cv_stability+cv_recovery + sc_both + ap_redesign → must NOT be lowOpt.
const P12_B5_stability: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_leader','ar_expert']},
  cv_values:{selectedOptionIds:['cv_stability','cv_recovery','cv_money']}, cv_priorities:{ranking:['pr_stability','pr_recovery','pr_money']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_capable_flat']},
  ap_experiment:{selectedOptionIds:['ap_redesign']},
};
{
  const sp = buildResultFromResponses(P12_B5_stability);
  check('P1.2 B5 (stability-first): NOT lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
}

// B6 pure job-change: ap_profile + ar_expert+ar_leader → must NOT be lowOpt; jobChange direction preserved.
const P12_B6_jobChange: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_expand']}, ar_roles:{selectedOptionIds:['ar_expert','ar_leader']},
  cv_values:{selectedOptionIds:['cv_expertise','cv_growth','cv_stability','cv_money']}, cv_priorities:{ranking:['pr_growth','pr_money','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_stable_flat']},
  ap_experiment:{selectedOptionIds:['ap_profile']},
};
{
  const sp = buildResultFromResponses(P12_B6_jobChange);
  check('P1.2 B6 (pure job-change + ap_profile): NOT lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
  check('P1.2 B6: coreExperiment routes via jobChange (preferred experiment honored)',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'jobChange');
  check('P1.2 B6: weekly plan is NOT opportunityGeneration (no "관심이 살짝 가는 주제 5개")',
    !sp.executionPlan.weeklyActions.some((w) => w.action.includes('관심이 살짝 가는 주제 5개')));
}

// C1 office worker: cs_stay + ar_leader + ori_energized + ap_redesign → roleRedesign-aligned.
const P12_C1_office: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_leader','ar_expert']},
  cv_values:{selectedOptionIds:['cv_stability','cv_growth','cv_expertise']}, cv_priorities:{ranking:['pr_stability','pr_growth','pr_money']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_energized']},
  ap_experiment:{selectedOptionIds:['ap_redesign']},
};
{
  const sp = buildResultFromResponses(P12_C1_office);
  check('P1.2 C1 (office worker): NOT lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
  check('P1.2 C1: bestMove is stayRedesign (role redesign aligned)',
    sp.currentBestMove.optionKey === 'stayRedesign');
  check('P1.2 C1: weekly plan reflects role-redesign module',
    /불만|지루함|재설계/.test(sp.executionPlan.weeklyActions[0].action));
}

// C2 licensed professional: cs_expand + ar_expert+ar_advisor + rc_runway_1y + ap_portfolio →
// portfolioConvert / plateauedPerformer / advisoryTeaching aligned.
const P12_C2_licensed: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_expand']}, ar_roles:{selectedOptionIds:['ar_expert','ar_advisor']},
  cv_values:{selectedOptionIds:['cv_expertise','cv_stability','cv_money']}, cv_priorities:{ranking:['pr_growth','pr_money','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_1y']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_meaning_money']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_portfolio']},
};
{
  const sp = buildResultFromResponses(P12_C2_licensed);
  check('P1.2 C2 (licensed professional + ap_portfolio): NOT lowOptionVisibility',
    sp.solutionLayer.mainTypeKey !== 'lowOptionVisibility');
  check('P1.2 C2: aligns to plateauedPerformer / advisoryTeaching family',
    sp.solutionLayer.mainTypeKey === 'plateauedPerformer' ||
    sp.solutionLayer.primaryModule.key === 'portfolioConvert' ||
    sp.currentBestMove.optionKey === 'advisoryTeaching');
}

// B7 option-rich + low energy: burnout priority must hold.
const P12_B7_richLow: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_many']}, ar_roles:{selectedOptionIds:['ar_creator','ar_freelancer','ar_founder']},
  cv_values:{selectedOptionIds:['cv_creativity','cv_impact','cv_autonomy']}, cv_priorities:{ranking:['pr_freedom','pr_meaning']},
  fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_many']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_tired']}, rc_risk:{selectedOptionIds:['rc_risk_time']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_money_tiring']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P12_B7_richLow);
  check('P1.2 B7 (option-rich + low energy): remains overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
}

// B8 no options + low energy: burnout priority must hold over lowOpt.
const P12_B8_noOptLow: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_rest']}, ar_roles:{selectedOptionIds:['ar_reset','ar_expert']},
  cv_values:{selectedOptionIds:['cv_recovery','cv_stability']}, cv_priorities:{ranking:['pr_recovery','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_unsure']}, rc_options:{selectedOptionIds:['rc_opt_few']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_rest']}, rc_risk:{selectedOptionIds:['rc_risk_none']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_rest']},
};
{
  const sp = buildResultFromResponses(P12_B8_noOptLow);
  check('P1.2 B8 (no options + low energy): remains overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
}

// A2 option-overload: scatteredExplorer must still classify cleanly.
{
  const sp = buildResultFromResponses({ ...SCN.creator, rc_options:{selectedOptionIds:['rc_opt_many']}, ap_experiment:{selectedOptionIds:['ap_unsure']} });
  check('P1.2 A2 (option-overload): remains scatteredExplorer',
    sp.solutionLayer.mainTypeKey === 'scatteredExplorer');
}

// ─── P1.3 routing + copy guards ─────────────────────────────────────────────
// A2 — scatteredExplorer must keep optionNarrowing weekly + stop/pivot, not runwayStabilizer.
const P13_A2: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_many']}, ar_roles:{selectedOptionIds:['ar_creator','ar_freelancer','ar_founder']},
  cv_values:{selectedOptionIds:['cv_creativity','cv_impact','cv_autonomy','cv_meaning']}, cv_priorities:{ranking:['pr_freedom','pr_meaning','pr_growth']},
  fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_many']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_capacity']}, rc_risk:{selectedOptionIds:['rc_risk_exp']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_energized']}, or_venture:{selectedOptionIds:['orv_energized']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P13_A2);
  check('P1.3 A2: scatteredExplorer weekly plan uses optionNarrowing (NOT runwayStabilizer)',
    sp.executionPlan.weeklyActions.some((w) => w.action.includes('옵션을 모두 나열') || w.action.includes('상위 3개')) &&
    !sp.executionPlan.weeklyActions.some((w) => w.action.includes('정확한 런웨이')));
  check('P1.3 A2: stop/pivot is option-narrowing aligned',
    // P3.7 — "가치 트레이드오프" was replaced by "선택 기준" in user-facing copy.
    // The internal planModule key (valueTradeoffMapping) is preserved; only
    // the visible stop/pivot phrase changed.
    sp.executionPlan.stopOrPivotCriteria.some((s) =>
      s.includes('못 좁히면') || s.includes('선택 기준') || s.includes('우선순위') || s.includes('가치 충돌')));
}

// B3 — investAnalysis (ap_writing) routes via portfolioConvert weekly plan, not interview-heavy marketTest.
const P13_B3: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_expand']}, ar_roles:{selectedOptionIds:['ar_expert','ar_analyst']},
  cv_values:{selectedOptionIds:['cv_expertise','cv_money','cv_growth']}, cv_priorities:{ranking:['pr_growth','pr_money','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_early']},
  or_content:{selectedOptionIds:['orc_meaning_money']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_writing']},
};
{
  const sp = buildResultFromResponses(P13_B3);
  check('P1.3 B3: ap_writing/investAnalysis weekly plan is portfolioConvert-aligned (성과 추리기 / 케이스 정리)',
    sp.executionPlan.weeklyActions.some((w) => w.action.includes('성과 10개') || w.action.includes('케이스로 정리')));
  check('P1.3 B3: weekly plan is NOT interview-heavy marketTest',
    !sp.executionPlan.weeklyActions.some((w) => w.action.includes('관심 있을 만한 사람 20명')));
}

// Burnout — no marketInsightGap support tag chip.
for (const burnScn of [SCN.recovery]) {
  const sp = buildResultFromResponses(burnScn);
  check('P1.3 burnout: supportTagLabels does NOT include "선택지 정보 보강 필요" or "실제 반응 확인 필요"',
    !sp.executionPlan.supportTagLabels.includes('선택지 정보 보강 필요') &&
    !sp.executionPlan.supportTagLabels.includes('실제 반응 확인 필요') &&
    !sp.executionPlan.supportTagLabels.includes('외부 정보 보강 필요'));
}

// Burnout / lowOpt narrative tails use context-specific text.
{
  const sp = buildResultFromResponses(SCN.recovery);
  check('P1.3 burnout narrative tail uses energy-aligned closing',
    sp.evidence.narrative.includes('에너지가 돌아온 뒤에 다시') &&
    !sp.evidence.narrative.includes('확인할 정보가 남아 있습니다'));
}
{
  const sp = buildResultFromResponses(lowOptionResponses);
  check('P1.3 lowOpt narrative tail uses option-generation closing',
    sp.evidence.narrative.includes('다음 달엔 새로 떠오른 후보') &&
    !sp.evidence.narrative.includes('확인할 정보가 남아 있습니다'));
}

// No "시장 검증" anywhere across all 5 default SCN + the lowOpt/manyOpt scenarios.
for (const k of [...Object.keys(SCN), 'lowOpt', 'manyOpt'] as const) {
  const sp = k === 'lowOpt' ? buildResultFromResponses(lowOptionResponses)
    : k === 'manyOpt' ? buildResultFromResponses(manyOptionsCanonical)
    : buildResultFromResponses(SCN[k as keyof typeof SCN]);
  const all = [
    sp.evidence.narrative,
    ...sp.evidence.whyThisRecommendation,
    ...sp.executionPlan.supportTagLabels,
    ...sp.executionPlan.stopOrPivotCriteria,
    sp.executionPlan.secondaryModuleHint ?? '',
  ].join(' || ');
  check(`P1.3 ${k}: no "시장 검증" in user-facing output`, !all.includes('시장 검증'));
}

// No "선택 통제감" / "결정 준비 신호" / "현재 판단의 확실성은 '낮음'이에요." anywhere.
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const sp = buildResultFromResponses(SCN[k]);
  const all = [
    sp.evidence.narrative,
    ...sp.evidence.whyThisRecommendation,
  ].join(' || ');
  check(`P1.3 ${k}: no "선택 통제감" jargon`, !all.includes('선택 통제감'));
  check(`P1.3 ${k}: no "결정 준비 신호" jargon`, !all.includes('결정 준비 신호'));
  check(`P1.3 ${k}: no "현재 판단의 확실성은 '낮음'이에요." raw quiz-grade line`,
    !sp.evidence.narrative.includes("현재 판단의 확실성은 '낮음'이에요."));
}

// valueConflict line uses softer trade-off wording (when surfaced at all).
for (const k of Object.keys(SCN) as (keyof typeof SCN)[]) {
  const sp = buildResultFromResponses(SCN[k]);
  for (const w of sp.evidence.whyThisRecommendation) {
    check(`P1.3 ${k}: no "원하는 가치가 서로 부딪혀" sharp wording`, !w.includes('원하는 가치가 서로 부딪혀'));
  }
}

// ─── P1.4 — alignment patch: strategyStatement / reeval / closingLine ─────────────

// FIX 1 — planModule-aware strategyStatement: B4/B5/C1 (plateauedPerformer + ap_redesign →
// planModule widened to roleRedesign) should now get the roleRedesign-aligned strategy.
const P14_B4: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_leader','ar_expert']},
  cv_values:{selectedOptionIds:['cv_stability','cv_growth','cv_meaning']}, cv_priorities:{ranking:['pr_growth','pr_stability','pr_meaning']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_both']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_partial']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_energized']},
  ap_experiment:{selectedOptionIds:['ap_redesign']},
};
{
  const sp = buildResultFromResponses(P14_B4);
  check('P1.4 Fix1 B4 (internal growth): strategy aligned with roleRedesign plan',
    sp.executionPlan.strategyStatement.includes('역할·방식') || sp.executionPlan.strategyStatement.includes('자리에서'));
  check('P1.4 Fix1 B4: strategy NOT the static "자산으로 정리할 때" (plateaued default)',
    !sp.executionPlan.strategyStatement.includes('자산으로 정리할 때'));
  check('P1.4 Fix1 B4: weekly plan IS still the role-redesign plan (alignment confirmed)',
    /불만|지루함|재설계/.test(sp.executionPlan.weeklyActions[0].action));
}

// FIX 2 — planModule-derived reeval: A2 scatteredExplorer (post P1.3) routes plan to
// optionNarrowing but sourceOptionKey falls back to bestMove=jobChange. Reeval should
// describe the actual plan (narrowing), not job-change criteria.
const P14_A2: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_many']}, ar_roles:{selectedOptionIds:['ar_creator','ar_freelancer','ar_founder']},
  cv_values:{selectedOptionIds:['cv_creativity','cv_impact','cv_autonomy','cv_meaning']}, cv_priorities:{ranking:['pr_freedom','pr_meaning','pr_growth']},
  fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_many']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_capacity']}, rc_risk:{selectedOptionIds:['rc_risk_exp']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_energized']}, or_venture:{selectedOptionIds:['orv_energized']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P14_A2);
  const reevalText = sp.executionPlan.reevaluationChecklist.join(' || ');
  check('P1.4 Fix2 A2 (scattered + ap_unsure): reeval does NOT contain jobChange criteria (공고·면접)',
    !reevalText.includes('공고') && !reevalText.includes('면접'));
  check('P1.4 Fix2 A2: reeval reflects narrowing plan (후보·실험·검증법)',
    /후보|실험|검증법/.test(reevalText));
  check('P1.4 Fix2 A2: weekly plan is still optionNarrowing',
    /나열|점수화|좁히|걸러내/.test(sp.executionPlan.weeklyActions[0].action) ||
    /나열|점수화|좁히|걸러내/.test(sp.executionPlan.weeklyActions[1].action));
}

// FIX 3 — closing-line override for unvalidatedAspirant: validation users shouldn't
// see the essentialist "subtract" closing. A6 venture + A7 creator should get actionType.
const P14_A6: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_between']}, ar_roles:{selectedOptionIds:['ar_founder','ar_freelancer']},
  cv_values:{selectedOptionIds:['cv_autonomy','cv_money','cv_problem','cv_bigmarket']}, cv_priorities:{ranking:['pr_money','pr_freedom','pr_growth','pr_influence']},
  fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_1to3']}, rc_energy:{selectedOptionIds:['rc_energy_capacity']}, rc_risk:{selectedOptionIds:['rc_risk_time']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_money_tiring']}, or_venture:{selectedOptionIds:['orv_energized']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_interview']},
};
{
  const sp = buildResultFromResponses(P14_A6);
  check('P1.4 Fix3 A6 (unvalidated venture): closing is actionType (validation > subtraction)',
    sp.executionPlan.closingLine.includes('작은 실험으로 한 줄의 신호') &&
    !sp.executionPlan.closingLine.includes('더 늘리기보다'));
}
{
  const sp = buildResultFromResponses(SCN.creator);
  check('P1.4 Fix3 creator (unvalidated): closing is actionType, not essentialist',
    sp.executionPlan.closingLine.includes('작은 실험으로 한 줄의 신호') &&
    !sp.executionPlan.closingLine.includes('더 늘리기보다'));
}

// Regression: scatteredExplorer (A2) should KEEP essentialist closing (essentialism IS its strategy)
{
  const sp = buildResultFromResponses(P14_A2);
  check('P1.4 regression A2 (scattered): essentialist closing preserved (subtraction IS the strategy)',
    sp.executionPlan.closingLine.includes('2~3개로 정리'));
}

// Regression: lowOpt (A1) keeps optionGeneration closing
const P14_A1: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_stay']}, ar_roles:{selectedOptionIds:['ar_expert','ar_leader']},
  cv_values:{selectedOptionIds:['cv_stability','cv_expertise']}, cv_priorities:{ranking:['pr_stability','pr_growth']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_market_only']}, rc_options:{selectedOptionIds:['rc_opt_few']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P14_A1);
  check('P1.4 regression A1 (lowOpt): closing stays optionGeneration',
    sp.executionPlan.closingLine.includes('결론을 내리지 않아도'));
  check('P1.4 regression A1: lowOpt-specific hardcoded reeval preserved',
    sp.executionPlan.reevaluationChecklist.some((c) => c.includes('해볼 만한 후보가 2개 이상')));
}

// Regression: scenarios where planModule == primaryModule should NOT change strategy.
{
  const sp = buildResultFromResponses(SCN.recovery);
  check('P1.4 regression: burnout strategy unchanged when planModule == primaryModule',
    sp.executionPlan.strategyStatement.includes('에너지를 먼저 회복'));
}

// ─── P1.5 — burnout/recovery closing invariant ────────────────────────────────
// For mainType === overloadedBurnout OR planModule === recoveryFirst, closing MUST
// be the recovery variant — even when the essentialism lens fires (cs_many → overload).

// SCN.recovery — burnout via cs_rest, ap_rest. Should already be burnout + recoveryFirst.
{
  const sp = buildResultFromResponses(SCN.recovery);
  check('P1.5 SCN.recovery: closing is recovery variant',
    sp.executionPlan.closingLine === CLOSING_REC);
  check('P1.5 SCN.recovery: closing is NOT essentialist',
    sp.executionPlan.closingLine !== CLOSING_ESS);
  check('P1.5 SCN.recovery: closing is NOT actionType',
    sp.executionPlan.closingLine !== CLOSING_ACT);
}

// B7 option-rich + low energy — burnout type but cs_many drives optionOverload high,
// previously fired essentialist. Must now be recovery.
const P15_B7: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_many']}, ar_roles:{selectedOptionIds:['ar_creator','ar_freelancer','ar_founder']},
  cv_values:{selectedOptionIds:['cv_creativity','cv_impact','cv_autonomy']}, cv_priorities:{ranking:['pr_freedom','pr_meaning']},
  fc_1:{selectedOptionIds:['fc1_connector']}, fc_2:{selectedOptionIds:['fc2_builder']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_maker']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_many']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_tired']}, rc_risk:{selectedOptionIds:['rc_risk_time']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_money_tiring']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_unsure']},
};
{
  const sp = buildResultFromResponses(P15_B7);
  check('P1.5 B7 (burnout + overload): mainType is overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
  check('P1.5 B7: essentialism lens still ON (optionOverload high)',
    sp.executionPlan.activeLenses.essentialism === true);
  check('P1.5 B7: closing is recovery variant (invariant: burnout > essentialism)',
    sp.executionPlan.closingLine === CLOSING_REC);
  check('P1.5 B7: closing is NOT essentialist',
    sp.executionPlan.closingLine !== CLOSING_ESS);
}

// B8 no options + low energy — burnout. Should also get recovery closing.
const P15_B8: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_rest']}, ar_roles:{selectedOptionIds:['ar_reset','ar_expert']},
  cv_values:{selectedOptionIds:['cv_recovery','cv_stability']}, cv_priorities:{ranking:['pr_recovery','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_unsure']}, rc_options:{selectedOptionIds:['rc_opt_few']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_rest']}, rc_risk:{selectedOptionIds:['rc_risk_none']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_rest']},
};
{
  const sp = buildResultFromResponses(P15_B8);
  check('P1.5 B8 (no-options + low energy): closing is recovery variant',
    sp.executionPlan.closingLine === CLOSING_REC);
}

// Regression: planModule === recoveryFirst path (alternative invariant trigger).
// A user who explicitly picks ap_rest with a non-burnout profile would route their plan
// to recoveryFirst via the experiment-home routing.
{
  // Build a profile that classifies as something OTHER than burnout but picks ap_rest.
  // Most users picking ap_rest get burnout-classified due to recoveryNeed/energy signals,
  // but a stable user could in principle. We verify via SCN.recovery where mainType IS
  // overloadedBurnout and planModule IS recoveryFirst.
  const sp = buildResultFromResponses(SCN.recovery);
  check('P1.5 recoveryFirst planModule path: closing is recovery (defensive)',
    sp.executionPlan.closingLine === CLOSING_REC && sp.solutionLayer.primaryModule.key === 'recoveryFirst');
}

// Regression — non-burnout closing variants preserved:
{
  // scattered (A2-like) → essentialist (NOT recovery)
  const sp = buildResultFromResponses({ ...SCN.creator, rc_options:{selectedOptionIds:['rc_opt_many']}, ap_experiment:{selectedOptionIds:['ap_unsure']} });
  check('P1.5 regression scattered: essentialist closing preserved (NOT recovery)',
    sp.executionPlan.closingLine === CLOSING_ESS);
}
{
  // lowOpt (A1) → optionGeneration (NOT recovery)
  const sp = buildResultFromResponses(lowOptionResponses);
  check('P1.5 regression lowOpt: optionGeneration preserved (NOT recovery)',
    sp.executionPlan.closingLine === CLOSING_OPT);
}
{
  // unvalidatedAspirant venture (A6) → actionType (NOT recovery)
  const sp = buildResultFromResponses(SCN.venture);
  check('P1.5 regression unvalidated venture: actionType preserved (NOT recovery)',
    sp.executionPlan.closingLine === CLOSING_ACT);
}
{
  // plateauedPerformer (A4) → actionType (NOT recovery)
  const sp = buildResultFromResponses(SCN.expert);
  check('P1.5 regression plateaued: actionType preserved (NOT recovery)',
    sp.executionPlan.closingLine === CLOSING_ACT);
}

// ─── P1.6 — (unvalidatedAspirant × portfolioConvert) cross-product strategy ───────
// B3-style: low outcome expectation + ap_writing → investAnalysis → portfolioConvert
// home, but mainType = unvalidatedAspirant. Both frames matter — the combined strategy
// honors both ("정리 + 작은 반응").
const P16_B3: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_expand']}, ar_roles:{selectedOptionIds:['ar_expert','ar_analyst']},
  cv_values:{selectedOptionIds:['cv_expertise','cv_money','cv_growth']}, cv_priorities:{ranking:['pr_growth','pr_money','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_public']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_self_only']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_6to12']}, rc_energy:{selectedOptionIds:['rc_energy_ok']}, rc_risk:{selectedOptionIds:['rc_risk_cost']}, rc_validation:{selectedOptionIds:['rc_val_early']},
  or_content:{selectedOptionIds:['orc_meaning_money']}, or_venture:{selectedOptionIds:['orv_capable_flat']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_writing']},
};
{
  const sp = buildResultFromResponses(P16_B3);
  check('P1.6 B3 (unvalidated × portfolioConvert): mainType IS unvalidatedAspirant',
    sp.solutionLayer.mainTypeKey === 'unvalidatedAspirant');
  check('P1.6 B3: planModule IS portfolioConvert (ap_writing → investAnalysis → portfolioConvert home)',
    sp.executionPlan.weeklyActions[0].action.includes('성과 10개'));
  check('P1.6 B3: strategy is the cross-product combined sentence',
    sp.executionPlan.strategyStatement === '먼저 경험과 성과를 밖에서도 읽히는 형태로 정리하고, 그 결과물로 작은 반응을 확인할 때예요.');
  check('P1.6 B3: strategy contains both "정리" and "반응"',
    sp.executionPlan.strategyStatement.includes('정리') && sp.executionPlan.strategyStatement.includes('반응'));
}

// Regression A4 plateauedPerformer × portfolioConvert (planModule == primary, no widening)
// → mainType strategy stays (plateaued's static strategy).
{
  const sp = buildResultFromResponses(SCN.expert);
  check('P1.6 regression A4 plateaued × portfolioConvert: strategy stays plateaued mainType',
    sp.executionPlan.strategyStatement === '실력은 쌓였지만, 그걸 밖이 읽을 수 있는 자산으로 정리할 때예요.');
}

// Regression A6 unvalidatedAspirant × marketTest (the non-portfolioConvert unvalidated case)
// → strategy stays unvalidatedAspirant's mainType strategy (NOT the new combined sentence).
{
  const sp = buildResultFromResponses(SCN.venture);
  check('P1.6 regression A6 unvalidated × marketTest: strategy stays unvalidated mainType',
    sp.executionPlan.strategyStatement === '만들고 싶은 방향은 있지만, 시장 반응부터 확인할 때예요.');
}

// Regression A7 unvalidatedAspirant × contentEngine (creator case)
// → strategy stays contentEngine MODULE_STRATEGY (NOT the new combined sentence).
{
  const sp = buildResultFromResponses(SCN.creator);
  check('P1.6 regression A7 unvalidated × contentEngine: strategy uses contentEngine MODULE_STRATEGY',
    sp.executionPlan.strategyStatement === '콘텐츠를 작게 발행해 실제 반응을 확인할 때예요.');
}

// ─── P1.7 — burnout invariant: full execution plan flips to recovery semantics ───
// S1: classifier says burnout, but the user picked ap_interview. The execution layer
// must NOT honor the interview at the plan/experiment/reeval level — only at the
// "we heard your interest" hint level (if anywhere).
const P17_S1: FlowResponses = {
  cs_main:{selectedOptionIds:['cs_rest']}, ar_roles:{selectedOptionIds:['ar_reset','ar_expert']},
  cv_values:{selectedOptionIds:['cv_recovery','cv_stability','cv_expertise']}, cv_priorities:{ranking:['pr_recovery','pr_stability','pr_meaning']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_unsure']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_rest']}, rc_risk:{selectedOptionIds:['rc_risk_none']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
  ap_experiment:{selectedOptionIds:['ap_interview']},
};
{
  const sp = buildResultFromResponses(P17_S1);
  const ep = sp.executionPlan;
  check('P1.7 S1: mainType IS overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
  check('P1.7 S1: bestMove is restRecover',
    sp.currentBestMove.optionKey === 'restRecover');
  check('P1.7 S1: strategyStatement is recovery-aligned (energy frame)',
    ep.strategyStatement.includes('에너지') || ep.strategyStatement.includes('회복'));
  check('P1.7 S1: strategyStatement does NOT mention market/validation/실제 반응',
    !ep.strategyStatement.includes('실제 반응') && !ep.strategyStatement.includes('시장 반응') && !ep.strategyStatement.includes('검증'));
  check('P1.7 S1: coreExperiment.label IS the recovery label',
    ep.coreExperiment.label === '2주 회복 루틴으로 에너지·생활 리듬부터 회복하기');
  check('P1.7 S1: coreExperiment.sourceOptionKey is restRecover (NOT startup/interview)',
    ep.coreExperiment.sourceOptionKey === 'restRecover');
  check('P1.7 S1: coreExperiment.evidenceToCheck is recovery-aligned',
    ep.coreExperiment.evidenceToCheck.some((e) => e.includes('에너지') || e.includes('관심 주제')));
  check('P1.7 S1: weeklyActions are recovery plan (회복 루틴)',
    ep.weeklyActions.some((w) => w.action.includes('회복 루틴')) &&
    !ep.weeklyActions.some((w) => w.action.includes('20명') || w.action.includes('인터뷰')));
  check('P1.7 S1: successSignals are recovery-aligned',
    ep.successSignals.every((s) => !s.includes('인터뷰') && !s.includes('돈·시간을 써서라도')));
  check('P1.7 S1: stopOrPivotCriteria are recovery-aligned',
    ep.stopOrPivotCriteria.every((s) => !s.includes('인터뷰') && !s.includes('채널·타깃')));
  check('P1.7 S1: reevaluationChecklist is recovery-aligned (no interview/validation criteria)',
    ep.reevaluationChecklist.some((c) => c.includes('에너지') || c.includes('회복')) &&
    !ep.reevaluationChecklist.some((c) => c.includes('인터뷰') || c.includes('돈·시간')));
  check('P1.7 S1: closingLine is recovery variant (P1.5 already covered this)',
    ep.closingLine === CLOSING_REC);
}

// Regression S2 (burnout + ap_unsure): still recovery (was already aligned)
{
  const sp = buildResultFromResponses(SCN.recovery);
  const ep = sp.executionPlan;
  check('P1.7 regression S2: burnout + ap_rest still recovery (label restRecover)',
    ep.coreExperiment.sourceOptionKey === 'restRecover');
}

// Regression A2 scatteredExplorer: NOT affected by burnout override (different mainType)
{
  const sp = buildResultFromResponses({ ...SCN.creator, rc_options:{selectedOptionIds:['rc_opt_many']}, ap_experiment:{selectedOptionIds:['ap_unsure']} });
  check('P1.7 regression A2 (scattered): coreExperiment.sourceOptionKey unchanged (NOT restRecover)',
    sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover');
  check('P1.7 regression A2: weeklyActions still optionNarrowing (NOT recovery)',
    sp.executionPlan.weeklyActions.some((w) => w.action.includes('나열') || w.action.includes('점수화')));
}

// Regression A6 unvalidated venture: NOT affected by burnout override
{
  const sp = buildResultFromResponses(SCN.venture);
  check('P1.7 regression A6 (unvalidated venture): coreExperiment routes via startup (NOT restRecover)',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'startup');
}

// Regression A4 plateaued: NOT affected
{
  const sp = buildResultFromResponses(SCN.expert);
  check('P1.7 regression A4 (plateaued): coreExperiment routes via investAnalysis (NOT restRecover)',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'investAnalysis');
}

// Other burnout × non-rest experiments: ap_content / ap_writing / ap_portfolio / ap_profile
const burnoutBase = {
  cs_main:{selectedOptionIds:['cs_rest']}, ar_roles:{selectedOptionIds:['ar_reset','ar_expert']},
  cv_values:{selectedOptionIds:['cv_recovery','cv_stability']}, cv_priorities:{ranking:['pr_recovery','pr_stability']},
  fc_1:{selectedOptionIds:['fc1_expert']}, fc_2:{selectedOptionIds:['fc2_stable']}, fc_3:{selectedOptionIds:['fc3_quiet']}, fc_4:{selectedOptionIds:['fc4_interpreter']},
  sc_outlook:{selectedOptionIds:['sc_unsure']}, rc_options:{selectedOptionIds:['rc_opt_some']},
  rc_runway:{selectedOptionIds:['rc_runway_3to6']}, rc_energy:{selectedOptionIds:['rc_energy_rest']}, rc_risk:{selectedOptionIds:['rc_risk_none']}, rc_validation:{selectedOptionIds:['rc_val_none']},
  or_content:{selectedOptionIds:['orc_capable_flat']}, or_venture:{selectedOptionIds:['orv_money_tiring']}, or_internal:{selectedOptionIds:['ori_unsure']},
};
for (const apId of ['ap_content', 'ap_writing', 'ap_portfolio', 'ap_profile', 'ap_redesign']) {
  const r: FlowResponses = { ...burnoutBase, ap_experiment: { selectedOptionIds: [apId] } };
  const sp = buildResultFromResponses(r);
  check(`P1.7 burnout × ${apId}: coreExperiment is restRecover regardless of user choice`,
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout' &&
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check(`P1.7 burnout × ${apId}: weeklyActions are recovery (NOT user's experiment)`,
    sp.executionPlan.weeklyActions.some((w) => w.action.includes('회복 루틴')));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
