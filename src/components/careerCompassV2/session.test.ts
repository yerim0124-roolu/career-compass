// Headless state/logic tests for the V2 session (no DOM, no React). Run with `node`.

import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import type { FlowResponses } from './session.ts';
import { isStepComplete, buildResultFromResponses } from './session.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const stepById = (id: string) => CAREER_QUESTION_FLOW.find((s) => s.id === id)!;

// ─── isStepComplete validation ─────────────────────────────────────────────────
check('single_select needs a selection', !isStepComplete(stepById('cs_main'), undefined) && isStepComplete(stepById('cs_main'), { selectedOptionIds: ['cs_between'] }));
check('multi_select honors minSelect (ar_roles now 1)', !isStepComplete(stepById('ar_roles'), { selectedOptionIds: [] }) && isStepComplete(stepById('ar_roles'), { selectedOptionIds: ['ar_founder'] }));
check('multi_select honors maxSelect (5)', !isStepComplete(stepById('cv_values'), { selectedOptionIds: ['cv_autonomy', 'cv_money', 'cv_problem', 'cv_bigmarket', 'cv_growth', 'cv_impact'] }));
check('ranking honors minSelect (3)', !isStepComplete(stepById('cv_priorities'), { ranking: ['pr_money', 'pr_freedom'] }) && isStepComplete(stepById('cv_priorities'), { ranking: ['pr_money', 'pr_freedom', 'pr_growth'] }));
// P3.11 — ap_memo(optional_short_text) 제거됨. 관련 스킵 케이스 테스트 삭제.

// ─── End-to-end via responses (mirrors the UI state shape) ─────────────────────
const responses: FlowResponses = {
  // P3.13 — cs_stay(중립)로: cs_between은 이제 도전 점수를 주지 않아 이 도전형 픽스처를
  // unvalidatedAspirant로 끌어 riskAverse 태그를 상위에서 밀어냄. 이 테스트의 의도는
  // 'rc_risk_time → riskAverse 노출'이므로 중립 cs 옵션으로 의도를 보존한다.
  cs_main: { selectedOptionIds: ['cs_stay'] },
  ar_roles: { selectedOptionIds: ['ar_founder', 'ar_freelancer'] },
  cv_values: { selectedOptionIds: ['cv_autonomy', 'cv_money', 'cv_problem', 'cv_bigmarket'] },
  cv_priorities: { ranking: ['pr_money', 'pr_freedom', 'pr_growth'] },
  fc_1: { selectedOptionIds: ['fc1_connector'] },
  fc_2: { selectedOptionIds: ['fc2_builder'] },
  fc_3: { selectedOptionIds: ['fc3_public'] },
  fc_4: { selectedOptionIds: ['fc4_maker'] },
  sc_outlook: { selectedOptionIds: ['sc_self_only'] },
  rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_1to3'] },   // tight (low runway)
  rc_energy: { selectedOptionIds: ['rc_energy_capacity'] },
  rc_risk: { selectedOptionIds: ['rc_risk_time'] },        // low risk tolerance
  rc_validation: { selectedOptionIds: ['rc_val_none'] },   // high validation need
  or_content: { selectedOptionIds: ['orc_money_tiring'] },
  or_venture: { selectedOptionIds: ['orv_energized'] },
  or_internal: { selectedOptionIds: ['ori_unsure'] },
  ap_experiment: { selectedOptionIds: ['ap_interview'] },  // → startup experiment
  ap_memo: { shortText: '무리하지 않기' },
};

const spine = buildResultFromResponses(responses);
check('result: identityAxis present', spine.identityAxis.statement.length > 0);
check('result: currentBestMove present', !!spine.currentBestMove.optionKey);
check('result: low runway/high validation → startup not the best move', spine.currentBestMove.optionKey !== 'startup');
check('result: reversal warning conditions ≥1', spine.reversalConditions.warningOrDowngradeConditions.length >= 1);
check('result: reevaluationCriteria ≥1 (30 days)', spine.reevaluationCriteria.criteria.length >= 1 && spine.reevaluationCriteria.reviewAfterDays === 30);
check('result: chosen 30-day experiment honored', spine.thirtyDayExperiment.id === 'exp-startup');
check('result: saju layer present but inactive', spine.optionalSajuLayer?.available === false);
check('result: evidence measured constructs (confidence > 0, cites CDDQ)', spine.evidence.whyThisRecommendation.length >= 1 && spine.evidence.confidenceScore > 0 && spine.evidence.theoryGroundedSummary.includes('CDDQ'));

// ─── Solution layer over the full flow ─────────────────────────────────────────
check('result: solutionLayer present + primary module', !!spine.solutionLayer && !!spine.solutionLayer.primaryModule);
// rc_risk_time = timeOnly (explicit low loss tolerance) → riskAverse is measured-legit.
// P3.13 — 위 픽스처는 도전 신호가 압도적이라 riskAverse가 상위 태그에서 밀린다(정상).
// 의도(낮은 손실감내 → riskAverse 노출)를 안정형 맥락에서 분리 검증한다.
{
  const stableRiskAverse = buildResultFromResponses({
    ...responses,
    ar_roles: { selectedOptionIds: ['ar_steady', 'ar_expert'] },
    cv_values: { selectedOptionIds: ['cv_stability', 'cv_money'] },
    cv_priorities: { ranking: ['pr_stability', 'pr_money'] },
    or_venture: { selectedOptionIds: ['orv_money_tiring'] },
    ap_experiment: { selectedOptionIds: ['ap_redesign'] },
  });
  check('result: explicit low-risk answer (timeOnly) → riskAverse surfaces',
    stableRiskAverse.solutionLayer.supportTags.includes('riskAverse'));
}

// Sparse flow: no risk question, no self-outlook, only cards without selfEfficacy/confidence.
const sparseResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_many'] },
  ar_roles: { selectedOptionIds: ['ar_freelancer', 'ar_reset'] },
  cv_values: { selectedOptionIds: ['cv_autonomy', 'cv_stability'] },
};
const sparseSpine = buildResultFromResponses(sparseResponses);
check('sparse flow: risk gate defaults (smallCost) → NO riskAverse', !sparseSpine.solutionLayer.supportTags.includes('riskAverse'));
check('sparse flow: self-efficacy/confidence unmeasured → NO lowSelfTrust', !sparseSpine.solutionLayer.supportTags.includes('lowSelfTrust'));

// ─── P2.0 — UserProfile pass-through + invariant preservation ─────────────────
import type { UserProfile } from '../../types/careerCompass.ts';
import type { SessionState } from './session.ts';
import { buildResultFromSession, deriveCareerPattern, normalizeProfile, parsePersistedSession, applyConstraintTagToggle, CONSTRAINT_TAGS_MAX, CONSTRAINT_TAGS_NONE } from './session.ts';

const baseResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_expand'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
  cv_values: { selectedOptionIds: ['cv_expertise', 'cv_impact', 'cv_knowledge'] },
  cv_priorities: { ranking: ['pr_growth', 'pr_meaning', 'pr_money'] },
  fc_1: { selectedOptionIds: ['fc1_connector'] }, fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_public'] }, fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_both'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_6to12'] }, rc_energy: { selectedOptionIds: ['rc_energy_ok'] },
  rc_risk: { selectedOptionIds: ['rc_risk_cost'] }, rc_validation: { selectedOptionIds: ['rc_val_partial'] },
  or_content: { selectedOptionIds: ['orc_meaning_money'] }, or_venture: { selectedOptionIds: ['orv_capable_flat'] },
  or_internal: { selectedOptionIds: ['ori_unsure'] }, ap_experiment: { selectedOptionIds: ['ap_writing'] },
};

// (a) buildResultFromResponses backward compatibility: result.profile defaults to {}
{
  const sp = buildResultFromResponses(baseResponses);
  check('P2.0 buildResultFromResponses: profile defaults to empty object',
    typeof sp.profile === 'object' && sp.profile !== null && Object.keys(sp.profile ?? {}).length === 0);
  check('P2.0 buildResultFromResponses: still returns a ResultSpine (identityAxis present)',
    typeof sp.identityAxis.statement === 'string' && sp.identityAxis.statement.length > 0);
}

// (b) buildResultFromSession with profile: profile is preserved verbatim on ResultSpine
{
  const profile: UserProfile = {
    ageBand: '30_late',
    jobRoleRaw: '백엔드 개발자',
    jobRoleCategory: 'engineering',
    jobRoleSubcategory: 'backend',
    jobRoleSecondaryCategories: ['operations', 'business_strategy'],
    totalCareerStage: 'total_7_12',
    currentFieldStage: 'current_3_7',
    priorFieldExperience: 'single_track',
    careerPattern: 'single_track',
    workMode: 'organization',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'preparing',
    concernTags: ['burnout', 'too_many_options'],
    constraintTags: ['money', 'time'],
    desiredPaths: ['advisory_teaching', 'side_project'],
  };
  const sp = buildResultFromSession({ responses: baseResponses, profile });
  check('P2.0 buildResultFromSession: profile pass-through (ageBand=30_late)',
    sp.profile?.ageBand === '30_late');
  check('P2.0 buildResultFromSession: profile pass-through (jobRoleRaw preserved verbatim)',
    sp.profile?.jobRoleRaw === '백엔드 개발자');
  check('P2.0 buildResultFromSession: profile pass-through (jobRoleCategory + jobRoleSubcategory)',
    sp.profile?.jobRoleCategory === 'engineering' && sp.profile?.jobRoleSubcategory === 'backend');
  check('P2.0 buildResultFromSession: profile pass-through (jobRoleSecondaryCategories array)',
    Array.isArray(sp.profile?.jobRoleSecondaryCategories) && sp.profile?.jobRoleSecondaryCategories?.[0] === 'operations');
  check('P2.0 buildResultFromSession: profile pass-through (totalCareerStage=total_7_12)',
    sp.profile?.totalCareerStage === 'total_7_12');
  check('P2.0 buildResultFromSession: profile pass-through (workMode=organization)',
    sp.profile?.workMode === 'organization');
  check('P2.0 buildResultFromSession: profile pass-through (transitionTiming + transitionIntent)',
    sp.profile?.transitionTiming === 'within_3_6_months' && sp.profile?.transitionIntent === 'preparing');
  check('P2.0 buildResultFromSession: profile pass-through (concernTags=[burnout, too_many_options])',
    Array.isArray(sp.profile?.concernTags) && sp.profile?.concernTags?.includes('burnout') === true);
  check('P2.0 buildResultFromSession: profile pass-through (constraintTags=[money, time])',
    Array.isArray(sp.profile?.constraintTags) && sp.profile?.constraintTags?.includes('money') === true);
  check('P2.0 buildResultFromSession: profile pass-through (desiredPaths=[advisory_teaching, side_project])',
    Array.isArray(sp.profile?.desiredPaths) && sp.profile?.desiredPaths?.includes('advisory_teaching') === true);
}

// (c) userSelectedExperimentKey preserved (user's original choice)
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: {} });
  // ap_writing → investAnalysis
  check('P2.0 userSelectedExperimentKey reflects user choice (ap_writing → investAnalysis)',
    sp.userSelectedExperimentKey === 'investAnalysis');
}

// (d) P1.7 burnout invariant: userSelectedExperimentKey preserves user's original choice
// even when coreExperiment.sourceOptionKey is overridden to restRecover.
const burnoutInterview: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_rest'] }, ar_roles: { selectedOptionIds: ['ar_reset', 'ar_expert'] },
  cv_values: { selectedOptionIds: ['cv_recovery', 'cv_stability'] }, cv_priorities: { ranking: ['pr_recovery', 'pr_stability'] },
  fc_1: { selectedOptionIds: ['fc1_expert'] }, fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] }, fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_unsure'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_3to6'] }, rc_energy: { selectedOptionIds: ['rc_energy_rest'] },
  rc_risk: { selectedOptionIds: ['rc_risk_none'] }, rc_validation: { selectedOptionIds: ['rc_val_none'] },
  or_content: { selectedOptionIds: ['orc_capable_flat'] }, or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_unsure'] }, ap_experiment: { selectedOptionIds: ['ap_interview'] },
};
{
  const sp = buildResultFromSession({ responses: burnoutInterview, profile: {} });
  check('P2.0 burnout audit: userSelectedExperimentKey preserves original choice (startup from ap_interview)',
    sp.userSelectedExperimentKey === 'startup');
  check('P2.0 burnout audit: coreExperiment.sourceOptionKey was overridden to restRecover (P1.7 invariant)',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('P2.0 burnout audit: the two keys disagree (proves audit trail value)',
    sp.userSelectedExperimentKey !== sp.executionPlan.coreExperiment.sourceOptionKey);
}

// (e) Invariant preservation: profile MUST NOT change any classification / routing / lens output.
// Build the same responses with 4 dramatically different profiles and assert every engine output
// is bit-identical (modulo the profile field itself).
{
  const profiles: UserProfile[] = [
    {},
    { ageBand: '20_early', totalCareerStage: 'total_0_3', workMode: 'organization' },
    { ageBand: '40_late_plus', totalCareerStage: 'total_12_plus', workMode: 'founder', desiredPaths: ['startup', 'advisory_teaching'] },
    { jobRoleRaw: '의사', jobRoleCategory: 'healthcare_medical', concernTags: ['burnout', 'identity_confusion'], constraintTags: ['time', 'family_responsibility'], careerPattern: 'single_track' },
  ];
  const results = profiles.map((p) => buildResultFromSession({ responses: baseResponses, profile: p }));
  const fingerprint = (sp: ReturnType<typeof buildResultFromSession>) => ({
    mainTypeKey: sp.solutionLayer.mainTypeKey,
    primaryModuleKey: sp.solutionLayer.primaryModule.key,
    bestMove: sp.currentBestMove.optionKey,
    strategicDirection: sp.strategicDirection?.optionKey ?? null,
    coreExperimentSource: sp.executionPlan.coreExperiment.sourceOptionKey,
    coreExperimentLabel: sp.executionPlan.coreExperiment.label,
    weeklyActions: sp.executionPlan.weeklyActions.map((w) => w.action),
    successSignals: sp.executionPlan.successSignals,
    stopOrPivotCriteria: sp.executionPlan.stopOrPivotCriteria,
    reevaluationChecklist: sp.executionPlan.reevaluationChecklist,
    closingLine: sp.executionPlan.closingLine,
    strategyStatement: sp.executionPlan.strategyStatement,
    activeLenses: sp.executionPlan.activeLenses,
    supportTagLabels: sp.executionPlan.supportTagLabels,
    identityStatement: sp.identityAxis.statement,
    archetypeTags: sp.identityAxis.archetypeTags,
  });
  const base = JSON.stringify(fingerprint(results[0]));
  for (let i = 1; i < results.length; i++) {
    check(`P2.0 invariant: profile #${i} produces IDENTICAL classification/routing/lens output as empty profile`,
      JSON.stringify(fingerprint(results[i])) === base);
  }
}

// (f) Invariant preservation on burnout scenario too — profile must not bypass P1.7
{
  const profiles: UserProfile[] = [
    {},
    { ageBand: '30_late', desiredPaths: ['startup'], transitionIntent: 'ready_to_switch' }, // tempting to "promote" startup
  ];
  const results = profiles.map((p) => buildResultFromSession({ responses: burnoutInterview, profile: p }));
  check('P2.0 burnout invariant: profile with desiredPaths=[startup] does NOT override burnout routing',
    results[0].executionPlan.coreExperiment.sourceOptionKey === results[1].executionPlan.coreExperiment.sourceOptionKey &&
    results[1].executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('P2.0 burnout invariant: closingLine identical regardless of profile',
    results[0].executionPlan.closingLine === results[1].executionPlan.closingLine);
}

// ─── P2.0 — deriveCareerPattern unit tests ────────────────────────────────────
// Precedence rules:
//   1. totalCareerStage === 'no_fulltime_experience' → 'early_exploration'
//   2. priorFieldExperience === 'multi_field'        → 'multi_track'
//   3. priorFieldExperience === 'has_prior_field'    → 'domain_shift'
//   4. priorFieldExperience === 'single_track'       → 'single_track'
//   5. fallback to the caller-provided careerPattern (may be undefined)
check('P2.0 deriveCareerPattern: no_fulltime_experience → early_exploration',
  deriveCareerPattern({ totalCareerStage: 'no_fulltime_experience' }) === 'early_exploration');
check('P2.0 deriveCareerPattern: multi_field → multi_track',
  deriveCareerPattern({ priorFieldExperience: 'multi_field' }) === 'multi_track');
check('P2.0 deriveCareerPattern: has_prior_field → domain_shift',
  deriveCareerPattern({ priorFieldExperience: 'has_prior_field' }) === 'domain_shift');
check('P2.0 deriveCareerPattern: single_track (priorFieldExperience) → single_track',
  deriveCareerPattern({ priorFieldExperience: 'single_track' }) === 'single_track');
check('P2.0 deriveCareerPattern: empty profile → undefined',
  deriveCareerPattern({}) === undefined);
check('P2.0 deriveCareerPattern: caller-set careerPattern preserved when no trigger',
  deriveCareerPattern({ careerPattern: 'early_exploration' }) === 'early_exploration');
check('P2.0 deriveCareerPattern: no_fulltime_experience precedence (wins over priorFieldExperience)',
  deriveCareerPattern({
    totalCareerStage: 'no_fulltime_experience',
    priorFieldExperience: 'has_prior_field',
  }) === 'early_exploration');
check('P2.0 deriveCareerPattern: no_fulltime_experience precedence (wins over caller careerPattern)',
  deriveCareerPattern({
    totalCareerStage: 'no_fulltime_experience',
    careerPattern: 'multi_track',
  }) === 'early_exploration');
check('P2.0 deriveCareerPattern: multi_field precedence (wins over has_prior_field would-be — multi_field is checked first)',
  deriveCareerPattern({ priorFieldExperience: 'multi_field', careerPattern: 'single_track' }) === 'multi_track');
check('P2.0 deriveCareerPattern: fields it does not consume have no effect',
  deriveCareerPattern({ ageBand: '30_late', workMode: 'organization', concernTags: ['burnout'] }) === undefined);

// normalizeProfile keeps {} strictly empty (doesn't set careerPattern: undefined explicitly)
{
  const norm = normalizeProfile({});
  check('P2.0 normalizeProfile: empty profile stays empty (no careerPattern key)',
    !('careerPattern' in norm) || norm.careerPattern === undefined);
}

// normalizeProfile populates careerPattern when derivable
{
  const norm = normalizeProfile({ priorFieldExperience: 'has_prior_field', ageBand: '30_late' });
  check('P2.0 normalizeProfile: has_prior_field → careerPattern=domain_shift, other fields preserved',
    norm.careerPattern === 'domain_shift' && norm.ageBand === '30_late');
}

// normalizeProfile overrides caller-set careerPattern when a trigger fires
{
  const norm = normalizeProfile({ priorFieldExperience: 'multi_field', careerPattern: 'single_track' });
  check('P2.0 normalizeProfile: trigger fields override caller careerPattern',
    norm.careerPattern === 'multi_track');
}

// buildResultFromSession enriches ResultSpine.profile with derived careerPattern
{
  const sp = buildResultFromSession({
    responses: baseResponses,
    profile: { priorFieldExperience: 'has_prior_field', ageBand: '40_early' },
  });
  check('P2.0 buildResultFromSession: ResultSpine.profile?.careerPattern populated by derivation',
    sp.profile?.careerPattern === 'domain_shift');
  check('P2.0 buildResultFromSession: input profile preserved alongside derivation',
    sp.profile?.ageBand === '40_early' && sp.profile?.priorFieldExperience === 'has_prior_field');
}

// CRITICAL: careerPattern (whether derived or caller-set) MUST NOT influence engine output.
// Build the same responses with 4 different careerPattern-triggering profiles and assert
// classification/routing/lens output is bit-identical to the empty-profile baseline.
{
  const triggerProfiles: UserProfile[] = [
    {},
    { totalCareerStage: 'no_fulltime_experience' },              // → derives 'early_exploration'
    { priorFieldExperience: 'multi_field' },                     // → derives 'multi_track'
    { priorFieldExperience: 'has_prior_field' },                 // → derives 'domain_shift'
    { priorFieldExperience: 'single_track' },                    // → derives 'single_track'
  ];
  const results = triggerProfiles.map((p) => buildResultFromSession({ responses: baseResponses, profile: p }));
  const fingerprint = (sp: ReturnType<typeof buildResultFromSession>) => ({
    mainTypeKey: sp.solutionLayer.mainTypeKey,
    primaryModuleKey: sp.solutionLayer.primaryModule.key,
    bestMove: sp.currentBestMove.optionKey,
    sourceOptionKey: sp.executionPlan.coreExperiment.sourceOptionKey,
    weeklyActions: sp.executionPlan.weeklyActions.map((w) => w.action),
    closingLine: sp.executionPlan.closingLine,
    strategyStatement: sp.executionPlan.strategyStatement,
    activeLenses: sp.executionPlan.activeLenses,
  });
  const base = JSON.stringify(fingerprint(results[0]));
  for (let i = 1; i < results.length; i++) {
    check(`P2.0 careerPattern invariant: trigger #${i} produces IDENTICAL routing/lens output as empty profile (engine never reads careerPattern)`,
      JSON.stringify(fingerprint(results[i])) === base);
  }
  // Sanity: derived careerPattern values DID flow through to the result profile
  check('P2.0 careerPattern flow-through: trigger #1 (no_fulltime_experience) → result.profile?.careerPattern=early_exploration',
    results[1].profile?.careerPattern === 'early_exploration');
  check('P2.0 careerPattern flow-through: trigger #2 (multi_field) → result.profile?.careerPattern=multi_track',
    results[2].profile?.careerPattern === 'multi_track');
  check('P2.0 careerPattern flow-through: trigger #3 (has_prior_field) → result.profile?.careerPattern=domain_shift',
    results[3].profile?.careerPattern === 'domain_shift');
  check('P2.0 careerPattern flow-through: trigger #4 (single_track) → result.profile?.careerPattern=single_track',
    results[4].profile?.careerPattern === 'single_track');
}

// ─── P2.0 — Entry-point compatibility: buildResultFromResponses with/without opts ─
// Per spec, the bare shape must still work AND the (responses, { profile }) shape must
// produce the same result as buildResultFromSession({ responses, profile }).
{
  const r1 = buildResultFromResponses(baseResponses);
  const r2 = buildResultFromResponses(baseResponses, undefined);
  const r3 = buildResultFromResponses(baseResponses, {});
  const r4 = buildResultFromResponses(baseResponses, { profile: {} });
  const fp = (x: ReturnType<typeof buildResultFromResponses>) => JSON.stringify({
    mainTypeKey: x.solutionLayer.mainTypeKey,
    sourceOptionKey: x.executionPlan.coreExperiment.sourceOptionKey,
    closingLine: x.executionPlan.closingLine,
  });
  check('P2.0 entry compat: buildResultFromResponses(responses) == (responses, undefined) == (responses, {}) == (responses, {profile:{}})',
    fp(r1) === fp(r2) && fp(r2) === fp(r3) && fp(r3) === fp(r4));
}
{
  const profile: UserProfile = { ageBand: '30_late', workMode: 'organization' };
  const viaResponses = buildResultFromResponses(baseResponses, { profile });
  const viaSession = buildResultFromSession({ responses: baseResponses, profile });
  // The two entry points must produce structurally identical results.
  check('P2.0 entry compat: buildResultFromResponses(responses, {profile}) == buildResultFromSession({responses, profile})',
    JSON.stringify(viaResponses) === JSON.stringify(viaSession));
}

// ─── P2.0 — Routing safety: profile must not change ANY of the listed fields ──────
// Spec lists exactly 8 fields that profile must not influence:
//   mainTypeKey / sourceOptionKey / planModule / activeLenses /
//   bestMove / closingLine / executionPlan.weeklyActions / executionPlan.reevaluationChecklist
const ROUTING_FIELDS = (sp: ReturnType<typeof buildResultFromResponses>) => ({
  mainTypeKey: sp.solutionLayer.mainTypeKey,
  sourceOptionKey: sp.executionPlan.coreExperiment.sourceOptionKey,
  planModule: sp.solutionLayer.primaryModule.key,
  activeLenses: sp.executionPlan.activeLenses,
  bestMove: sp.currentBestMove.optionKey,
  closingLine: sp.executionPlan.closingLine,
  weeklyActions: sp.executionPlan.weeklyActions.map((w) => w.action),
  reevaluationChecklist: sp.executionPlan.reevaluationChecklist,
});

// Build a battery of profiles covering every typed field including extremes.
const battery: UserProfile[] = [
  {},
  { ageBand: '20_early' },
  { ageBand: '40_late_plus' },
  { totalCareerStage: 'no_fulltime_experience' },       // triggers careerPattern='early_exploration'
  { priorFieldExperience: 'multi_field' },              // triggers careerPattern='multi_track'
  { priorFieldExperience: 'has_prior_field' },          // triggers careerPattern='domain_shift'
  { priorFieldExperience: 'single_track' },             // triggers careerPattern='single_track'
  { workMode: 'organization' },
  { workMode: 'founder' },
  { workMode: 'career_break' },
  { transitionTiming: 'now', transitionIntent: 'ready_to_switch' },
  { transitionTiming: 'unknown', transitionIntent: 'curious' },
  { concernTags: ['burnout', 'too_many_options', 'identity_confusion'] },
  { constraintTags: ['money', 'energy_burnout', 'low_confidence'] },
  { desiredPaths: ['startup', 'advisory_teaching', 'rest_recover'] },   // tempting routing hints
  { jobRoleRaw: '의사', jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'doctor' },
  // Kitchen-sink: every field populated
  {
    ageBand: '30_late', jobRoleRaw: '백엔드 개발자', jobRoleCategory: 'engineering',
    jobRoleSubcategory: 'backend', jobRoleSecondaryCategories: ['operations'],
    totalCareerStage: 'total_7_12', currentFieldStage: 'current_3_7',
    priorFieldExperience: 'has_prior_field', workMode: 'organization',
    transitionTiming: 'within_3_6_months', transitionIntent: 'actively_considering',
    concernTags: ['too_many_options'], constraintTags: ['time'],
    desiredPaths: ['internal_redesign'],
  },
];

// Run the battery against THREE representative response sets.
const responseSetsForBattery: Array<{ name: string; responses: FlowResponses }> = [
  { name: 'baseResponses (plateaued)', responses: baseResponses },
  { name: 'burnoutInterview (P1.7 candidate)', responses: burnoutInterview },
  { name: 'unsureBase (ap_unsure)', responses: { ...baseResponses, ap_experiment: { selectedOptionIds: ['ap_unsure'] } } },
];

for (const { name, responses } of responseSetsForBattery) {
  const baseFP = JSON.stringify(ROUTING_FIELDS(buildResultFromResponses(responses)));
  let allEqual = true;
  for (const profile of battery) {
    const fp = JSON.stringify(ROUTING_FIELDS(buildResultFromResponses(responses, { profile })));
    if (fp !== baseFP) { allEqual = false; break; }
  }
  check(`P2.0 routing safety [${name}]: all ${battery.length} profiles produce identical 8-field fingerprint`, allEqual);
}

// ─── P2.0 — P1.7 burnout invariant must still hold under any profile ─────────────
// mainTypeKey === 'overloadedBurnout' ⇒ sourceOptionKey === 'restRecover' ⇒ planModule === 'recoveryFirst'
for (const profile of battery) {
  const sp = buildResultFromResponses(burnoutInterview, { profile });
  // Only assert the invariant when the classifier landed on burnout (guard the precondition).
  if (sp.solutionLayer.mainTypeKey === 'overloadedBurnout') {
    const ok =
      sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover' &&
      sp.solutionLayer.primaryModule.key === 'recoveryFirst';
    if (!ok) {
      check(`P1.7 invariant under profile ${JSON.stringify(profile).slice(0, 60)}…`, false);
    }
  }
}
check(`P1.7 invariant: burnout ⇒ sourceOptionKey=restRecover ⇒ planModule=recoveryFirst (under ${battery.length} profiles)`, true);

// ─── P2.0 — Distinguished pair: userSelectedExperimentKey vs sourceOptionKey ─────
// CONTRACT:
//   userSelectedExperimentKey                    = user's ORIGINAL ap_experiment choice
//   executionPlan.coreExperiment.sourceOptionKey = engine-resolved final key
// Two values: same when no invariant fires; divergent when an invariant (P1.7 burnout)
// overrides routing. Profile NEVER influences either.

// (1) Normal case: user picked ap_writing → both keys equal (investAnalysis).
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: {} });
  check('P2.0 distinguished pair: normal case → userSelectedExperimentKey === sourceOptionKey',
    sp.userSelectedExperimentKey === sp.executionPlan.coreExperiment.sourceOptionKey &&
    sp.userSelectedExperimentKey === 'investAnalysis');
}

// (2) Burnout override: user picked ap_interview → original=startup, resolved=restRecover.
{
  const sp = buildResultFromSession({ responses: burnoutInterview, profile: {} });
  check('P2.0 distinguished pair: P1.7 burnout → keys DIVERGE',
    sp.userSelectedExperimentKey === 'startup' &&
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('P2.0 distinguished pair: P1.7 burnout → divergence is detectable by consumer',
    sp.userSelectedExperimentKey !== sp.executionPlan.coreExperiment.sourceOptionKey);
}

// (3) ap_unsure: no ap_experiment mapping → userSelectedExperimentKey undefined,
//     but engine still resolves a sourceOptionKey (from bestMove fallback or P1.7).
const unsureBase: FlowResponses = { ...baseResponses, ap_experiment: { selectedOptionIds: ['ap_unsure'] } };
{
  const sp = buildResultFromSession({ responses: unsureBase, profile: {} });
  check('P2.0 distinguished pair: ap_unsure → userSelectedExperimentKey is undefined',
    sp.userSelectedExperimentKey === undefined);
  check('P2.0 distinguished pair: ap_unsure → sourceOptionKey still defined (engine fallback)',
    typeof sp.executionPlan.coreExperiment.sourceOptionKey === 'string' &&
    sp.executionPlan.coreExperiment.sourceOptionKey.length > 0);
}

// (4) Profile CANNOT bypass P1.7 — even a profile that "wants" startup gets restRecover.
//     This re-validates the P2.0.5 invariant explicitly through the distinguished-pair lens.
{
  const aspirationalProfile: UserProfile = {
    desiredPaths: ['startup'],
    transitionIntent: 'ready_to_switch',
    concernTags: ['startup_side_project'],
  };
  const sp = buildResultFromSession({ responses: burnoutInterview, profile: aspirationalProfile });
  check('P2.0 distinguished pair: aspirational profile does NOT bypass P1.7',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('P2.0 distinguished pair: aspirational profile preserves the userSelectedExperimentKey audit trail',
    sp.userSelectedExperimentKey === 'startup');
  check('P2.0 distinguished pair: aspirational profile values flow through (no routing read)',
    sp.profile?.desiredPaths?.[0] === 'startup' &&
    sp.profile?.transitionIntent === 'ready_to_switch');
}

// (5) Profile is optional on the type AND on direct buildResultSpine calls.
//     Through the FromResponses/FromSession entry points, runtime always provides {}.
{
  const sp = buildResultFromResponses(baseResponses);
  // Type allows undefined; runtime defaults to {} via session entry.
  check('P2.0 distinguished pair: profile via buildResultFromResponses defaults to {}',
    typeof sp.profile === 'object' && sp.profile !== null);
}

// ─── P2.0 — parsePersistedSession (localStorage backward-compat) ──────────────
const FLOW_LEN = 20; // current CAREER_QUESTION_FLOW.length (cs_blocker 추가)

// 1. null (no payload yet) → default state with empty profile.
{
  const s = parsePersistedSession(null, FLOW_LEN);
  check('P2.0 parsePersistedSession: null → default state',
    s.stepIndex === 0 && s.done === false && Object.keys(s.responses).length === 0);
  check('P2.0 parsePersistedSession: null → profile is empty object (always defined)',
    typeof s.profile === 'object' && s.profile !== null && Object.keys(s.profile).length === 0);
}

// 2. Empty string → fallback (treated as missing).
{
  const s = parsePersistedSession('', FLOW_LEN);
  check('P2.0 parsePersistedSession: empty string → default state',
    s.stepIndex === 0 && s.done === false);
}

// 3. Corrupt JSON → fallback (no throw, no profile undefined).
{
  const s = parsePersistedSession('{not valid json', FLOW_LEN);
  check('P2.0 parsePersistedSession: corrupt JSON → default state (no throw)',
    s.stepIndex === 0 && s.done === false);
  check('P2.0 parsePersistedSession: corrupt JSON → profile still {} (always defined)',
    Object.keys(s.profile).length === 0);
}

// 4. Pre-P2.0 payload (NO `profile` key at all) → profile coerced to {}.
{
  const oldPayload = JSON.stringify({
    stepIndex: 5,
    responses: { cs_main: { selectedOptionIds: ['cs_expand'] } },
    done: false,
    // NOTE: no `profile` key — simulating a session saved before P2.0
  });
  const s = parsePersistedSession(oldPayload, FLOW_LEN);
  check('P2.0 backward-compat: pre-P2.0 payload (no profile key) → profile = {}',
    typeof s.profile === 'object' && Object.keys(s.profile).length === 0);
  check('P2.0 backward-compat: pre-P2.0 payload → responses preserved',
    s.responses.cs_main?.selectedOptionIds?.[0] === 'cs_expand');
  check('P2.0 backward-compat: pre-P2.0 payload → stepIndex preserved',
    s.stepIndex === 5);
}

// 5. Modern payload with profile → profile preserved.
{
  const newPayload = JSON.stringify({
    stepIndex: 10,
    responses: {},
    profile: { ageBand: '30_late', workMode: 'organization' },
    done: false,
  });
  const s = parsePersistedSession(newPayload, FLOW_LEN);
  check('P2.0 parsePersistedSession: modern payload preserves profile.ageBand',
    s.profile.ageBand === '30_late');
  check('P2.0 parsePersistedSession: modern payload preserves profile.workMode',
    s.profile.workMode === 'organization');
}

// 6. Payload with derivable careerPattern → derivation runs on load.
{
  const derivablePayload = JSON.stringify({
    stepIndex: 0,
    responses: {},
    profile: { priorFieldExperience: 'has_prior_field', ageBand: '40_early' },
    done: false,
  });
  const s = parsePersistedSession(derivablePayload, FLOW_LEN);
  check('P2.0 parsePersistedSession: derivation runs on load (priorFieldExperience → careerPattern=domain_shift)',
    s.profile?.careerPattern === 'domain_shift');
}

// 7. stepIndex clamping: out-of-range values are clamped to [0, flowLength-1].
{
  const overShoot = JSON.stringify({ stepIndex: 999, responses: {}, done: false });
  const s = parsePersistedSession(overShoot, FLOW_LEN);
  check('P2.0 parsePersistedSession: stepIndex clamped to flowLength-1 (defensive)',
    s.stepIndex === FLOW_LEN - 1);
}
{
  const underShoot = JSON.stringify({ stepIndex: -5, responses: {}, done: false });
  const s = parsePersistedSession(underShoot, FLOW_LEN);
  check('P2.0 parsePersistedSession: negative stepIndex clamped to 0',
    s.stepIndex === 0);
}

// P10 — pt_confidence 제거(24→23) 하위 호환: 과거 24문항 흐름에서 저장된 in-progress 세션
// (stepIndex가 이전 마지막 인덱스 23까지 가능)이 이제 23문항 흐름 길이로 열려도 범위를 벗어나지
// 않고 안전한 유효 인덱스로 clamp되어야 한다(크래시 없이 계속 진행/결과 화면 이동 가능).
{
  const CUR_LEN = CAREER_QUESTION_FLOW.length; // 이제 23
  check('P10: 현재 흐름 길이 === 23 (pt_confidence 제거 반영)', CUR_LEN === 23);
  // 과거 24문항 흐름의 마지막 인덱스(23)로 저장된 세션을 새 길이(23)로 로드.
  const legacy24 = JSON.stringify({
    stepIndex: 23,
    responses: { cs_main: { selectedOptionIds: ['cs_between'] }, pt_confidence: { selectedOptionIds: ['pt_conf_impostor'] } },
    done: false,
  });
  const s = parsePersistedSession(legacy24, CUR_LEN);
  check('P10: 과거 24문항 stepIndex=23 → 유효 범위 [0, len-1]로 clamp',
    s.stepIndex >= 0 && s.stepIndex <= CUR_LEN - 1);
  check('P10: 과거 24문항 세션 stepIndex는 새 마지막 인덱스(22)로 clamp',
    s.stepIndex === CUR_LEN - 1);
  check('P10: 과거 세션에 남은 pt_confidence 응답은 보존되지만 흐름을 깨지 않음',
    s.responses.pt_confidence?.selectedOptionIds?.[0] === 'pt_conf_impostor');
}

// 8. Done flag preserved.
{
  const donePayload = JSON.stringify({ stepIndex: 18, responses: {}, done: true });
  const s = parsePersistedSession(donePayload, FLOW_LEN);
  check('P2.0 parsePersistedSession: done=true preserved (mid-result session)',
    s.done === true);
}

// 9. Save shape: when we re-serialize the loaded session, an older payload's saved JSON
// SHOULD now include a `profile: {}` key (we no longer write the legacy shape).
{
  const oldPayload = JSON.stringify({ stepIndex: 0, responses: {}, done: false });
  const s = parsePersistedSession(oldPayload, FLOW_LEN);
  const reserialized = JSON.stringify({ stepIndex: s.stepIndex, responses: s.responses, profile: s.profile, done: s.done });
  check('P2.0 round-trip: re-serialized old payload now includes profile field',
    reserialized.includes('"profile":{}'));
}

// ─── P2.2 — profileDone backward-compat heuristic (pre-flow placement) ────────
// Spec: profile form is now BEFORE the main flow. A pre-P2.1 user with any prior
// progress (done=true OR at least one entry in responses) must NOT be sent back
// through the new front gate on load — that would be a visible regression. Only
// truly empty pre-P2.1 sessions (and modern fresh sessions) start at the form.
{
  // pre-P2.1 completed session → profileDone defaults to true (don't re-prompt)
  const preP21Done = JSON.stringify({ stepIndex: 18, responses: {}, done: true });
  const s = parsePersistedSession(preP21Done, FLOW_LEN);
  check('P2.2 backward-compat: pre-P2.1 done=true session → profileDone = true (no re-prompt)',
    s.done === true && s.profileDone === true);
}
{
  // pre-P2.1 partial session WITH responses → profileDone defaults to true so the
  // user keeps continuing the main flow instead of being kicked back to the form.
  const preP21PartialWithProgress = JSON.stringify({
    stepIndex: 5,
    responses: { cs_now: { selectedOptionIds: ['cs_now_steady'] } },
    done: false,
  });
  const s = parsePersistedSession(preP21PartialWithProgress, FLOW_LEN);
  check('P2.2 backward-compat: pre-P2.1 partial session (has responses) → profileDone = true (no front-gate regression)',
    s.done === false && s.profileDone === true);
}
{
  // pre-P2.1 truly empty session (no responses, not done) → profileDone defaults to
  // false. This is indistinguishable from a fresh modern session and the new user
  // SHOULD see the profile form first.
  const preP21Empty = JSON.stringify({ stepIndex: 0, responses: {}, done: false });
  const s = parsePersistedSession(preP21Empty, FLOW_LEN);
  check('P2.2 backward-compat: pre-P2.1 empty session (no responses, !done) → profileDone = false (show form)',
    s.done === false && s.profileDone === false);
}
{
  // null payload → profileDone defaults to false
  const s = parsePersistedSession(null, FLOW_LEN);
  check('P2.2 backward-compat: null payload → profileDone = false (default)',
    s.profileDone === false);
}
{
  // modern payload explicitly carries profileDone=true → preserved
  const modernTrue = JSON.stringify({ stepIndex: 18, responses: {}, done: true, profileDone: true });
  const s = parsePersistedSession(modernTrue, FLOW_LEN);
  check('P2.1 parser: modern payload profileDone=true preserved',
    s.profileDone === true);
}
{
  // modern payload explicitly carries profileDone=false → preserved (user is mid-form)
  const modernFalse = JSON.stringify({ stepIndex: 18, responses: {}, done: true, profileDone: false });
  const s = parsePersistedSession(modernFalse, FLOW_LEN);
  check('P2.1 parser: modern payload profileDone=false preserved (mid-form user)',
    s.profileDone === false);
}
{
  // corrupt JSON → safe default
  const s = parsePersistedSession('{bad', FLOW_LEN);
  check('P2.1 parser: corrupt JSON → profileDone defaults to false',
    s.profileDone === false);
}

// ─── P2.1 — Profile form only writes to profile; engine output unchanged ──────
// Simulate the ProfileFormView's onChange by mutating profile through every typed field
// and assert engine fingerprint stays bit-identical.
{
  const formMutations: UserProfile[] = [
    {},
    { ageBand: '30_late' },
    { ageBand: '30_late', jobRoleRaw: '백엔드 개발자' },
    { ageBand: '30_late', jobRoleRaw: '백엔드 개발자', totalCareerStage: 'total_7_12' },
    {
      ageBand: '30_late', jobRoleRaw: '백엔드 개발자', totalCareerStage: 'total_7_12',
      currentFieldStage: 'current_3_7', priorFieldExperience: 'has_prior_field',
      workMode: 'organization', transitionTiming: 'within_3_6_months', transitionIntent: 'preparing',
      concernTags: ['too_many_options', 'burnout'], constraintTags: ['time', 'energy_burnout'],
      desiredPaths: ['internal_redesign', 'side_project'],
    },
  ];
  const fp = (p: UserProfile) => {
    const sp = buildResultFromSession({ responses: baseResponses, profile: p });
    return JSON.stringify({
      mainTypeKey: sp.solutionLayer.mainTypeKey,
      sourceOptionKey: sp.executionPlan.coreExperiment.sourceOptionKey,
      planModule: sp.solutionLayer.primaryModule.key,
      activeLenses: sp.executionPlan.activeLenses,
      bestMove: sp.currentBestMove.optionKey,
      closingLine: sp.executionPlan.closingLine,
      weeklyActions: sp.executionPlan.weeklyActions.map((w) => w.action),
      reevaluationChecklist: sp.executionPlan.reevaluationChecklist,
    });
  };
  const baseFP = fp({});
  let allEqual = true;
  for (const p of formMutations) {
    if (fp(p) !== baseFP) { allEqual = false; break; }
  }
  check('P2.1 form-write invariant: 5 progressive form mutations produce identical 8-field fingerprint as empty profile',
    allEqual);
}

// P2.1 form writes a careerPattern-trigger field → derivation runs → ResultSpine reflects it
{
  // Simulate ProfileFormView writing priorFieldExperience='multi_field'
  const profileAfterForm: UserProfile = { priorFieldExperience: 'multi_field' };
  const sp = buildResultFromSession({ responses: baseResponses, profile: profileAfterForm });
  check('P2.1 form-write derivation: priorFieldExperience=multi_field → careerPattern=multi_track on ResultSpine.profile',
    sp.profile?.careerPattern === 'multi_track');
}

// ═════════════════════════════════════════════════════════════════════════════
// P2.0 — REQUIRED TESTS (10) per spec § 8
// Each numbered block below maps 1:1 to a required check. The behaviors below are
// independently covered by other test sections in this file; this block exists for
// self-documentation: a reader can verify the 10 contract items at a glance.
// ═════════════════════════════════════════════════════════════════════════════

// (1) UserProfile can be attached to session state.
{
  const state: SessionState = {
    responses: baseResponses,
    profile: { ageBand: '30_late', workMode: 'organization' },
  };
  const sp = buildResultFromSession(state);
  check('REQ 1: UserProfile can be attached to session state and flows through to ResultSpine',
    sp.profile?.ageBand === '30_late' && sp.profile?.workMode === 'organization');
}

// (2) Existing FlowResponses-only result building still works.
{
  const sp = buildResultFromResponses(baseResponses); // bare 1-arg call, no opts
  check('REQ 2: buildResultFromResponses(responses) still returns a valid ResultSpine',
    typeof sp.identityAxis.statement === 'string' &&
    typeof sp.executionPlan.coreExperiment.sourceOptionKey === 'string' &&
    typeof sp.executionPlan.closingLine === 'string');
}

// (3) Old persisted payloads without `profile` load with profile = {}.
{
  const oldPayload = JSON.stringify({ stepIndex: 0, responses: {}, done: false }); // no profile key
  const s = parsePersistedSession(oldPayload, 19);
  check('REQ 3: pre-P2.0 persisted payload (no profile key) loads with profile = {}',
    typeof s.profile === 'object' && Object.keys(s.profile).length === 0);
}

// (4) `profile` appears on ResultSpine.
{
  const profile: UserProfile = { workMode: 'founder' };
  const sp = buildResultFromResponses(baseResponses, { profile });
  check('REQ 4: profile appears on ResultSpine.profile',
    sp.profile !== undefined && sp.profile.workMode === 'founder');
}

// (5) Adding profile does NOT change mainTypeKey.
{
  const baseSp = buildResultFromResponses(baseResponses);
  const withProfileSp = buildResultFromResponses(baseResponses, {
    profile: { desiredPaths: ['startup'], transitionIntent: 'ready_to_switch' }, // tempting "promote startup" hints
  });
  check('REQ 5: profile does NOT change mainTypeKey',
    baseSp.solutionLayer.mainTypeKey === withProfileSp.solutionLayer.mainTypeKey);
}

// (6) Adding profile does NOT change sourceOptionKey.
{
  const baseSp = buildResultFromResponses(baseResponses);
  const withProfileSp = buildResultFromResponses(baseResponses, {
    profile: { desiredPaths: ['rest_recover'], concernTags: ['burnout'] }, // tempting "force recovery" hints
  });
  check('REQ 6: profile does NOT change executionPlan.coreExperiment.sourceOptionKey',
    baseSp.executionPlan.coreExperiment.sourceOptionKey === withProfileSp.executionPlan.coreExperiment.sourceOptionKey);
}

// (7) Adding profile does NOT change planModule.
{
  const baseSp = buildResultFromResponses(baseResponses);
  const withProfileSp = buildResultFromResponses(baseResponses, {
    profile: { careerPattern: 'multi_track', workMode: 'multi_work' }, // tempting "scatter" hints
  });
  check('REQ 7: profile does NOT change planModule (solutionLayer.primaryModule.key)',
    baseSp.solutionLayer.primaryModule.key === withProfileSp.solutionLayer.primaryModule.key);
}

// (8) Adding profile does NOT change executionPlan.weeklyActions.
{
  const baseSp = buildResultFromResponses(baseResponses);
  const withProfileSp = buildResultFromResponses(baseResponses, {
    profile: {
      ageBand: '40_late_plus', totalCareerStage: 'total_12_plus',
      jobRoleRaw: '의사', concernTags: ['burnout', 'identity_confusion'],
    },
  });
  check('REQ 8: profile does NOT change executionPlan.weeklyActions',
    JSON.stringify(baseSp.executionPlan.weeklyActions) ===
    JSON.stringify(withProfileSp.executionPlan.weeklyActions));
}

// (9) P1.7 burnout invariant still passes.
//     For a burnt-out user: regardless of profile, mainTypeKey=overloadedBurnout
//     ⇒ sourceOptionKey === 'restRecover' ⇒ planModule === 'recoveryFirst'.
{
  const sp = buildResultFromResponses(burnoutInterview, {
    profile: { desiredPaths: ['startup'], transitionIntent: 'ready_to_switch' },
  });
  check('REQ 9: P1.7 burnout invariant — mainTypeKey === overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
  check('REQ 9: P1.7 burnout invariant — coreExperiment.sourceOptionKey === restRecover',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('REQ 9: P1.7 burnout invariant — planModule === recoveryFirst',
    sp.solutionLayer.primaryModule.key === 'recoveryFirst');
}

// (10) userSelectedExperimentKey is preserved separately from sourceOptionKey.
//      Specific scenario from spec: burnout + ap_interview
//      Expected:
//        userSelectedExperimentKey === 'startup'  (original ap_interview → startup mapping)
//        executionPlan.coreExperiment.sourceOptionKey === 'restRecover'  (P1.7 override)
//        mainTypeKey === 'overloadedBurnout'
//        planModule === 'recoveryFirst'
{
  const sp = buildResultFromResponses(burnoutInterview);
  check('REQ 10 (spec scenario): userSelectedExperimentKey === "startup" (original choice preserved)',
    sp.userSelectedExperimentKey === 'startup');
  check('REQ 10 (spec scenario): executionPlan.coreExperiment.sourceOptionKey === "restRecover" (P1.7 override)',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('REQ 10 (spec scenario): mainTypeKey === "overloadedBurnout"',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
  check('REQ 10 (spec scenario): planModule === "recoveryFirst"',
    sp.solutionLayer.primaryModule.key === 'recoveryFirst');
  // The two keys differ — the divergence IS the audit trail value.
  check('REQ 10 (spec scenario): the two keys are distinct (audit trail captures the override)',
    sp.userSelectedExperimentKey !== sp.executionPlan.coreExperiment.sourceOptionKey);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.2 TESTS — one block per user-listed behavior, named so each PASS
// line is easy to spot in CI output. Many of these are reinforced by earlier
// blocks; this section is the explicit per-requirement contract.
// ═══════════════════════════════════════════════════════════════════════════════

// (P2.2 R1) Profile UI updates SessionState.profile
//   Simulates what ProfileFormView does via onChange: progressive merges into the
//   profile field of SessionState. The engine output (responses still fixed) must
//   not change — that's R6/R7.
{
  let session: SessionState = { responses: baseResponses, profile: {} };
  const onChange = (next: UserProfile) => { session = { ...session, profile: next }; };

  onChange({ ...session.profile, ageBand: '30_late' });
  onChange({ ...session.profile, ageBand: '30_late', jobRoleRaw: '백엔드 개발자' });
  onChange({ ...session.profile, ageBand: '30_late', jobRoleRaw: '백엔드 개발자', workMode: 'organization' });

  check('P2.2 R1: form onChange updates SessionState.profile.ageBand',
    session.profile.ageBand === '30_late');
  check('P2.2 R1: form onChange updates SessionState.profile.jobRoleRaw',
    session.profile.jobRoleRaw === '백엔드 개발자');
  check('P2.2 R1: form onChange updates SessionState.profile.workMode',
    session.profile.workMode === 'organization');
  check('P2.2 R1: SessionState.responses is NOT mutated by profile writes',
    session.responses === baseResponses);
}

// (P2.2 R2) jobRoleRaw free text saves correctly
//   Includes Korean, spaces, punctuation; round-trip through normalizeProfile and
//   parsePersistedSession.
{
  const profile: UserProfile = { jobRoleRaw: '마케팅 PM (B2B SaaS)' };
  const normalized = normalizeProfile(profile);
  check('P2.2 R2: jobRoleRaw preserved verbatim through normalizeProfile',
    normalized.jobRoleRaw === '마케팅 PM (B2B SaaS)');

  const persisted = JSON.stringify({ stepIndex: 0, responses: {}, profile: normalized, done: false, profileDone: true });
  const reloaded = parsePersistedSession(persisted, FLOW_LEN);
  check('P2.2 R2: jobRoleRaw survives JSON round-trip through parsePersistedSession',
    reloaded.profile.jobRoleRaw === '마케팅 PM (B2B SaaS)');

  // Empty string should clear to undefined when set via the UI setter pattern
  // (`onChange(e.target.value || undefined)`). We model that here by validating
  // that an undefined value persists as undefined.
  const cleared = normalizeProfile({ ...normalized, jobRoleRaw: undefined });
  check('P2.2 R2: clearing jobRoleRaw leaves it undefined (no empty-string sneak)',
    cleared.jobRoleRaw === undefined);
}

// (P2.2 R3) constraintTags max 2 works
//   Pure helper: applyConstraintTagToggle.
{
  check('P2.2 R3: CONSTRAINT_TAGS_MAX is 2 (contract)',
    CONSTRAINT_TAGS_MAX === 2);

  // Start empty → add 1
  const a = applyConstraintTagToggle(undefined, 'money');
  check('P2.2 R3: empty + money → [money]',
    JSON.stringify(a) === JSON.stringify(['money']));

  // Add 2nd
  const b = applyConstraintTagToggle(a, 'time');
  check('P2.2 R3: [money] + time → [money, time]',
    JSON.stringify(b) === JSON.stringify(['money', 'time']));

  // At cap → 3rd is a no-op
  const c = applyConstraintTagToggle(b, 'energy_burnout');
  check('P2.2 R3: at cap, adding 3rd real tag is a no-op',
    JSON.stringify(c) === JSON.stringify(['money', 'time']));

  // Deselect lets you add a different one
  const d = applyConstraintTagToggle(c, 'time');                 // deselect time
  const e = applyConstraintTagToggle(d, 'energy_burnout');       // now under cap
  check('P2.2 R3: after deselect, a new tag can be added',
    JSON.stringify(e) === JSON.stringify(['money', 'energy_burnout']));

  // Deselecting the last real tag at cap is fine (doesn't get blocked)
  const f = applyConstraintTagToggle(['money', 'time'], 'money');
  check('P2.2 R3: deselecting at cap returns [time] (cap does not block deselect)',
    JSON.stringify(f) === JSON.stringify(['time']));
}

// (P2.2 R4) constraintTags value "none" is exclusive
{
  check('P2.2 R4: CONSTRAINT_TAGS_NONE === "none" (contract)',
    CONSTRAINT_TAGS_NONE === 'none');

  // none clears everything else
  const a = applyConstraintTagToggle(['money', 'time'], 'none');
  check('P2.2 R4: selecting none wipes other selections → [none]',
    JSON.stringify(a) === JSON.stringify(['none']));

  // selecting a real tag while none is on drops none
  const b = applyConstraintTagToggle(['none'], 'time');
  check('P2.2 R4: selecting a real tag while none is on drops none → [time]',
    JSON.stringify(b) === JSON.stringify(['time']));

  // deselecting none clears the field to undefined (matches "missing = undefined")
  const c = applyConstraintTagToggle(['none'], 'none');
  check('P2.2 R4: deselecting the only "none" returns undefined',
    c === undefined);

  // none is allowed even at the cap (it's the "clear all" path)
  const d = applyConstraintTagToggle(['money', 'time'], 'none');
  check('P2.2 R4: none is selectable even when at cap (clear-all)',
    JSON.stringify(d) === JSON.stringify(['none']));
}

// (P2.2 R5) careerPattern is derived after priorFieldExperience selection
//   Direct unit test of deriveCareerPattern across each branch + the
//   no_fulltime_experience precedence rule.
{
  check('P2.2 R5: priorFieldExperience=single_track → careerPattern=single_track',
    deriveCareerPattern({ priorFieldExperience: 'single_track' }) === 'single_track');
  check('P2.2 R5: priorFieldExperience=has_prior_field → careerPattern=domain_shift',
    deriveCareerPattern({ priorFieldExperience: 'has_prior_field' }) === 'domain_shift');
  check('P2.2 R5: priorFieldExperience=multi_field → careerPattern=multi_track',
    deriveCareerPattern({ priorFieldExperience: 'multi_field' }) === 'multi_track');
  check('P2.2 R5: totalCareerStage=no_fulltime_experience overrides any priorFieldExperience → early_exploration',
    deriveCareerPattern({
      totalCareerStage: 'no_fulltime_experience',
      priorFieldExperience: 'multi_field',
    }) === 'early_exploration');
  check('P2.2 R5: normalizeProfile populates careerPattern after priorFieldExperience set',
    normalizeProfile({ priorFieldExperience: 'has_prior_field' }).careerPattern === 'domain_shift');
}

// (P2.2 R6) Existing FlowResponses remain unchanged
//   Build a result, then mutate the profile across many shapes, and confirm:
//     (a) the original responses object reference is preserved on SessionState
//     (b) the engine produces an identical fingerprint regardless of profile
{
  const before = JSON.stringify(baseResponses);
  let session: SessionState = { responses: baseResponses, profile: {} };

  // Walk through every profile field once
  session = { ...session, profile: { ageBand: '30_early' } };
  session = { ...session, profile: { ...session.profile, jobRoleRaw: '디자이너' } };
  session = { ...session, profile: { ...session.profile, totalCareerStage: 'total_3_7' } };
  session = { ...session, profile: { ...session.profile, priorFieldExperience: 'has_prior_field' } };
  session = { ...session, profile: { ...session.profile, workMode: 'freelance' } };
  session = { ...session, profile: { ...session.profile, transitionTiming: 'within_1_3_months' } };
  session = { ...session, profile: { ...session.profile, concernTags: ['burnout'] } };
  session = { ...session, profile: { ...session.profile, constraintTags: applyConstraintTagToggle([], 'time') } };
  session = { ...session, profile: { ...session.profile, desiredPaths: ['freelance', 'side_project'] } };

  check('P2.2 R6: responses reference preserved across all profile mutations',
    session.responses === baseResponses);
  check('P2.2 R6: responses JSON shape unchanged after profile mutations',
    JSON.stringify(session.responses) === before);
}

// (P2.2 R7) Running the main result with profile does not change routing
//   Build the SAME responses (a) without a profile, (b) with a richly populated
//   profile, and compare the 8-field routing fingerprint.
{
  const fingerprint = (sp: ReturnType<typeof buildResultFromSession>) => JSON.stringify([
    sp.solutionLayer.mainTypeKey,
    sp.solutionLayer.primaryModule.key,
    sp.executionPlan.coreExperiment.sourceOptionKey,
    sp.executionPlan.coreExperiment.label,
    sp.executionPlan.weeklyActions.map((a) => a.action),
    sp.executionPlan.successSignals,
    sp.executionPlan.stopOrPivotCriteria,
    sp.currentBestMove.optionKey,
  ]);

  const fpEmpty = fingerprint(buildResultFromSession({ responses: baseResponses, profile: {} }));
  const richProfile: UserProfile = {
    ageBand: '40_early',
    jobRoleRaw: '시니어 PM',
    totalCareerStage: 'total_12_plus',
    currentFieldStage: 'current_7_plus',
    priorFieldExperience: 'multi_field',
    workMode: 'organization',
    transitionTiming: 'after_6_months',
    transitionIntent: 'actively_considering',
    concernTags: ['too_many_options', 'identity_confusion'],
    constraintTags: ['money', 'family_responsibility'],
    desiredPaths: ['internal_redesign', 'advisory_teaching'],
  };
  const fpRich = fingerprint(buildResultFromSession({ responses: baseResponses, profile: richProfile }));

  check('P2.2 R7: routing fingerprint identical for {} vs richly populated profile',
    fpEmpty === fpRich);
}

// (P2.2 R8) P1.7 burnout invariant still passes
//   Asserted in REQ 9 above; here we re-assert under a profile that names burnout
//   on every relevant tag — profile must NOT alter the invariant.
{
  const burnoutProfile: UserProfile = {
    concernTags: ['burnout'],
    constraintTags: ['energy_burnout'],
    desiredPaths: ['rest_recover'],
  };
  const sp = buildResultFromSession({ responses: burnoutInterview, profile: burnoutProfile });
  check('P2.2 R8: P1.7 invariant under burnout-named profile — mainTypeKey === overloadedBurnout',
    sp.solutionLayer.mainTypeKey === 'overloadedBurnout');
  check('P2.2 R8: P1.7 invariant under burnout-named profile — sourceOptionKey === restRecover',
    sp.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  check('P2.2 R8: P1.7 invariant under burnout-named profile — planModule === recoveryFirst',
    sp.solutionLayer.primaryModule.key === 'recoveryFirst');
}

// (P2.2 R9) Profile persists and reloads from localStorage
//   Write → JSON.stringify (what the page useEffect does) → parsePersistedSession.
//   Asserts every field comes back AND careerPattern was derived on the way in.
{
  const written: UserProfile = normalizeProfile({
    ageBand: '30_late',
    jobRoleRaw: '연구원',
    totalCareerStage: 'total_7_12',
    currentFieldStage: 'current_3_7',
    priorFieldExperience: 'has_prior_field', // → careerPattern=domain_shift
    workMode: 'organization',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'preparing',
    concernTags: ['stay_or_leave', 'strength_unclear'],
    constraintTags: ['time', 'family_responsibility'],
    desiredPaths: ['job_change', 'internal_redesign'],
  });
  const raw = JSON.stringify({ stepIndex: 12, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: written, done: false, profileDone: true });

  const reloaded = parsePersistedSession(raw, FLOW_LEN);

  check('P2.2 R9: reloaded.profile.ageBand preserved',
    reloaded.profile.ageBand === '30_late');
  check('P2.2 R9: reloaded.profile.jobRoleRaw preserved (Korean text)',
    reloaded.profile.jobRoleRaw === '연구원');
  check('P2.2 R9: reloaded.profile.totalCareerStage preserved',
    reloaded.profile.totalCareerStage === 'total_7_12');
  check('P2.2 R9: reloaded.profile.priorFieldExperience preserved',
    reloaded.profile.priorFieldExperience === 'has_prior_field');
  check('P2.2 R9: reloaded.profile.careerPattern derived === domain_shift',
    reloaded.profile.careerPattern === 'domain_shift');
  check('P2.2 R9: reloaded.profile.concernTags preserved (multi)',
    JSON.stringify(reloaded.profile.concernTags) === JSON.stringify(['stay_or_leave', 'strength_unclear']));
  check('P2.2 R9: reloaded.profile.constraintTags preserved (multi)',
    JSON.stringify(reloaded.profile.constraintTags) === JSON.stringify(['time', 'family_responsibility']));
  check('P2.2 R9: reloaded.profile.desiredPaths preserved (multi)',
    JSON.stringify(reloaded.profile.desiredPaths) === JSON.stringify(['job_change', 'internal_redesign']));
  check('P2.2 R9: reloaded.profileDone preserved (true)',
    reloaded.profileDone === true);
}

// (P2.2 R10) Old localStorage payload without profile still loads
//   Pre-P2.0 payload has NO profile key, NO profileDone key. parsePersistedSession
//   coerces missing values to safe defaults and applies the backward-compat
//   heuristic for profileDone.
{
  const preP20Done = JSON.stringify({ stepIndex: 18, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, done: true });
  const s = parsePersistedSession(preP20Done, FLOW_LEN);
  check('P2.2 R10: pre-P2.0 payload (no profile key) loads without throwing',
    typeof s === 'object');
  check('P2.2 R10: pre-P2.0 payload → profile defaulted to {}',
    JSON.stringify(s.profile) === '{}');
  check('P2.2 R10: pre-P2.0 payload → done preserved',
    s.done === true);
  check('P2.2 R10: pre-P2.0 done=true payload → profileDone heuristic = true (no re-prompt)',
    s.profileDone === true);
  check('P2.2 R10: pre-P2.0 payload → responses preserved',
    JSON.stringify(s.responses.cs_main) === JSON.stringify({ selectedOptionIds: ['cs_between'] }));

  // And re-running the engine with the empty profile returns a valid spine
  const sp = buildResultFromSession({ responses: s.responses, profile: s.profile });
  check('P2.2 R10: engine produces a valid ResultSpine from pre-P2.0-loaded state',
    !!sp && typeof sp.solutionLayer.mainTypeKey === 'string' && sp.solutionLayer.mainTypeKey.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.3 — Job role normalization at the session boundary
// Contract:
//   • normalizeProfile derives jobRoleCategory/Subcategory/SecondaryCategories
//     from jobRoleRaw using the pure normalizer.
//   • The derivation is suppressed if any of the three job-role fields is
//     explicitly set (preserve manual taxonomy).
//   • Backward compat: a pre-P2.3 saved session with jobRoleRaw and no category
//     auto-derives on load (parsePersistedSession calls normalizeProfile).
//   • Routing fingerprint is identical regardless of jobRoleRaw value.
//   • P1.7 burnout invariant unchanged under any jobRoleRaw.
// ═══════════════════════════════════════════════════════════════════════════════

// (P2.3 D1) normalizeProfile derives jobRoleCategory from jobRoleRaw
{
  const n = normalizeProfile({ jobRoleRaw: '백엔드 개발자' });
  check('P2.3 D1: normalizeProfile derives jobRoleCategory from jobRoleRaw',
    n.jobRoleCategory === 'engineering');
  check('P2.3 D1: normalizeProfile derives jobRoleSubcategory from jobRoleRaw',
    n.jobRoleSubcategory === 'backend');
  check('P2.3 D1: normalizeProfile preserves jobRoleRaw verbatim',
    n.jobRoleRaw === '백엔드 개발자');
}

// (P2.3 D2) Multi-role input — under Rule 4, ANY 2+ distinct categories promote
// to multi_domain. "프리랜서 디자이너" triggers design + founder_entrepreneur.
{
  const n = normalizeProfile({ jobRoleRaw: '프리랜서 디자이너' });
  check('P2.3 D2: prim category = multi_domain (Rule 4 — any 2+ categories)',
    n.jobRoleCategory === 'multi_domain');
  check('P2.3 D2: secondaryCategories includes design',
    Array.isArray(n.jobRoleSecondaryCategories) && n.jobRoleSecondaryCategories!.includes('design'));
  check('P2.3 D2: secondaryCategories includes founder_entrepreneur',
    Array.isArray(n.jobRoleSecondaryCategories) && n.jobRoleSecondaryCategories!.includes('founder_entrepreneur'));
}

// (P2.3 D3) Unknown text → category=other, no subcategory, no secondaries
{
  const n = normalizeProfile({ jobRoleRaw: '갤럭시 우주선 조종' });
  check('P2.3 D3: unknown text → jobRoleCategory=other',
    n.jobRoleCategory === 'other');
  check('P2.3 D3: unknown text → no subcategory',
    n.jobRoleSubcategory === undefined);
  check('P2.3 D3: unknown text → no secondaryCategories',
    n.jobRoleSecondaryCategories === undefined);
}

// (P2.3 D4) Empty / whitespace jobRoleRaw → no derivation
{
  const n1 = normalizeProfile({ jobRoleRaw: '' });
  check('P2.3 D4: empty jobRoleRaw → no jobRoleCategory derived',
    n1.jobRoleCategory === undefined);
  const n2 = normalizeProfile({ jobRoleRaw: '   ' });
  check('P2.3 D4: whitespace-only jobRoleRaw → no jobRoleCategory derived',
    n2.jobRoleCategory === undefined);
  const n3 = normalizeProfile({});
  check('P2.3 D4: no jobRoleRaw at all → no jobRoleCategory derived',
    n3.jobRoleCategory === undefined && n3.jobRoleSubcategory === undefined);
}

// (P2.3 D5) Preserve explicitly-set job-role fields (manual taxonomy wins)
{
  // Caller explicitly set jobRoleCategory — even with jobRoleRaw that would
  // normalize to a different value, the explicit value is preserved.
  const n1 = normalizeProfile({ jobRoleRaw: '백엔드 개발자', jobRoleCategory: 'operations' });
  check('P2.3 D5: explicit jobRoleCategory NOT overwritten by derivation',
    n1.jobRoleCategory === 'operations');
  check('P2.3 D5: explicit jobRoleCategory case → no jobRoleSubcategory derived (whole job-role derivation suppressed)',
    n1.jobRoleSubcategory === undefined);

  // Explicit subcategory alone also suppresses derivation
  const n2 = normalizeProfile({ jobRoleRaw: '백엔드 개발자', jobRoleSubcategory: 'frontend' });
  check('P2.3 D5: explicit jobRoleSubcategory suppresses category derivation',
    n2.jobRoleCategory === undefined && n2.jobRoleSubcategory === 'frontend');

  // Explicit secondaryCategories alone also suppresses derivation
  const n3 = normalizeProfile({ jobRoleRaw: '백엔드 개발자', jobRoleSecondaryCategories: ['operations'] });
  check('P2.3 D5: explicit jobRoleSecondaryCategories suppresses category derivation',
    n3.jobRoleCategory === undefined && JSON.stringify(n3.jobRoleSecondaryCategories) === JSON.stringify(['operations']));
}

// (P2.3 D6) Backward-compat: pre-P2.3 saved session (jobRoleRaw only) auto-derives on load
{
  const preP23 = JSON.stringify({
    stepIndex: 5,
    responses: {},
    profile: { jobRoleRaw: '수의사' },
    done: false,
    profileDone: true,
  });
  const s = parsePersistedSession(preP23, FLOW_LEN);
  check('P2.3 D6: pre-P2.3 saved session auto-derives jobRoleCategory on load',
    s.profile.jobRoleCategory === 'veterinary_pet');
  check('P2.3 D6: pre-P2.3 saved session auto-derives jobRoleSubcategory on load',
    s.profile.jobRoleSubcategory === 'veterinarian');
  check('P2.3 D6: pre-P2.3 saved session preserves jobRoleRaw verbatim',
    s.profile.jobRoleRaw === '수의사');
}

// (P2.3 D7) Round-trip stability: derive → serialize → parse → reflects derived fields,
// and a second normalizeProfile pass is idempotent.
{
  const start = normalizeProfile({ jobRoleRaw: '프로덕트 매니저' });
  const raw = JSON.stringify({ stepIndex: 0, responses: {}, profile: start, done: false, profileDone: true });
  const reloaded = parsePersistedSession(raw, FLOW_LEN);
  check('P2.3 D7: round-trip preserves jobRoleCategory',
    reloaded.profile.jobRoleCategory === 'product_planning');
  check('P2.3 D7: round-trip preserves jobRoleSubcategory (none — product_planning has no spec-listed subcategories)',
    reloaded.profile.jobRoleSubcategory === undefined);

  // Second pass through normalizeProfile is idempotent (derived fields already
  // populated → preservation rule kicks in → no change).
  const second = normalizeProfile(reloaded.profile);
  check('P2.3 D7: second normalizeProfile call is idempotent',
    JSON.stringify(second) === JSON.stringify(reloaded.profile));
}

// (P2.3 D8) Routing fingerprint UNCHANGED across different jobRoleRaw values.
//   This is the core P2.3 invariant: job-role normalization is metadata-only.
{
  const ROUTING = (sp: ReturnType<typeof buildResultFromSession>) => JSON.stringify([
    sp.solutionLayer.mainTypeKey,
    sp.solutionLayer.primaryModule.key,
    sp.executionPlan.coreExperiment.sourceOptionKey,
    sp.executionPlan.coreExperiment.label,
    sp.executionPlan.weeklyActions.map((a) => a.action),
    sp.executionPlan.successSignals,
    sp.executionPlan.stopOrPivotCriteria,
    sp.currentBestMove.optionKey,
  ]);

  const fpBase = ROUTING(buildResultFromSession({ responses: baseResponses, profile: {} }));

  const jobRoles = [
    '백엔드 개발자',
    '수의사',
    '변호사',
    '프리랜서 디자이너',
    'Marketing PM (B2B SaaS)',
    '갤럭시 우주선 조종', // unknown → category=other
    '교사',
    '투자심사역',
    '창업자',
  ];
  let allEqual = true;
  for (const raw of jobRoles) {
    const fp = ROUTING(buildResultFromSession({ responses: baseResponses, profile: { jobRoleRaw: raw } }));
    if (fp !== fpBase) { allEqual = false; break; }
  }
  check('P2.3 D8: routing fingerprint identical across 9 distinct jobRoleRaw inputs',
    allEqual);
}

// (P2.3 D9) P1.7 burnout invariant unchanged under any jobRoleRaw
{
  const jobRoles = ['수의사', '백엔드 개발자', '창업자', '갤럭시 우주선 조종', '프리랜서 디자이너'];
  let allHold = true;
  for (const raw of jobRoles) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile: { jobRoleRaw: raw } });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout' ||
      sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover' ||
      sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) {
      allHold = false; break;
    }
  }
  check('P2.3 D9: P1.7 burnout invariant holds under any jobRoleRaw',
    allHold);
}

// (P2.3 D10) Derived fields ride along on ResultSpine.profile (metadata-only).
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: { jobRoleRaw: '데이터 분석가' } });
  check('P2.3 D10: ResultSpine.profile.jobRoleCategory populated by derivation',
    sp.profile?.jobRoleCategory === 'engineering');
  check('P2.3 D10: ResultSpine.profile.jobRoleSubcategory populated by derivation',
    sp.profile?.jobRoleSubcategory === 'data_ai');
  check('P2.3 D10: ResultSpine.profile.jobRoleRaw still preserved',
    sp.profile?.jobRoleRaw === '데이터 분석가');
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.3 RULES (session boundary) — rules that involve normalizeProfile directly,
// asserted at the session level so each PASS line is easy to spot in CI output.
// ═══════════════════════════════════════════════════════════════════════════════

// Rule 3 (storage side): normalizeProfile trims jobRoleRaw before persisting.
{
  const n = normalizeProfile({ jobRoleRaw: '  백엔드 개발자  ' });
  check('P2.3 RULES R3 (storage): normalizeProfile trims leading/trailing whitespace on jobRoleRaw',
    n.jobRoleRaw === '백엔드 개발자');
  check('P2.3 RULES R3 (storage): trimming preserves inner whitespace (no aggressive normalization)',
    n.jobRoleRaw === '백엔드 개발자' && n.jobRoleRaw.includes(' '));
  // After trim, derivation still runs and finds the right category
  check('P2.3 RULES R3 (storage): trimmed value is what the matcher sees → engineering/backend',
    n.jobRoleCategory === 'engineering' && n.jobRoleSubcategory === 'backend');
}

// Rule 3 (whitespace-only): jobRoleRaw of just spaces collapses to undefined.
{
  const n = normalizeProfile({ jobRoleRaw: '   \t  ' });
  check('P2.3 RULES R3 (whitespace-only): jobRoleRaw of just spaces → undefined (no phantom empty string)',
    n.jobRoleRaw === undefined);
  check('P2.3 RULES R3 (whitespace-only): no jobRoleCategory derived (no input to normalize)',
    n.jobRoleCategory === undefined);
}

// Rule 4 (session boundary): normalizeProfile auto-promotes to multi_domain.
{
  const n = normalizeProfile({ jobRoleRaw: '프리랜서 디자이너' });
  check('P2.3 RULES R4 (session): "프리랜서 디자이너" → jobRoleCategory=multi_domain',
    n.jobRoleCategory === 'multi_domain');
  check('P2.3 RULES R4 (session): jobRoleSubcategory left undefined for multi_domain',
    n.jobRoleSubcategory === undefined);
}

// Rule 10 (routing invariant under new multi-domain rule): re-affirm the
// fingerprint stays identical including jobRoleRaw values that NOW resolve to
// multi_domain. Critical guarantee: mainTypeKey / sourceOptionKey / planModule /
// weeklyActions / reevaluationChecklist / closingLine must NOT change.
{
  const ROUTING_KEYS = (sp: ReturnType<typeof buildResultFromSession>) => JSON.stringify({
    mainTypeKey: sp.solutionLayer.mainTypeKey,
    sourceOptionKey: sp.executionPlan.coreExperiment.sourceOptionKey,
    planModule: sp.solutionLayer.primaryModule.key,
    weeklyActions: sp.executionPlan.weeklyActions.map((a) => a.action),
    reevaluationChecklist: sp.executionPlan.reevaluationChecklist,
    closingLine: sp.executionPlan.closingLine,
  });
  const fpEmpty = ROUTING_KEYS(buildResultFromSession({ responses: baseResponses, profile: {} }));

  // Diverse inputs — single-category, multi-domain via auto-promotion, and a few
  // that previously triggered single-category routes.
  const raws = [
    '백엔드 개발자',
    '수의사',
    '프리랜서 디자이너',         // → multi_domain
    '마케팅 PM',                  // → multi_domain
    'developer / founder',        // → multi_domain
    '수의사 출신 투자심사역',     // → multi_domain
    '갤럭시 우주선 조종',         // → other
  ];
  let allEqual = true;
  for (const raw of raws) {
    const fp = ROUTING_KEYS(buildResultFromSession({ responses: baseResponses, profile: { jobRoleRaw: raw } }));
    if (fp !== fpEmpty) { allEqual = false; break; }
  }
  check('P2.3 RULES R10 (session): mainTypeKey/sourceOptionKey/planModule/weeklyActions/reevaluationChecklist/closingLine identical across 7 jobRoleRaw inputs',
    allEqual);

  // Burnout scenario sanity-check: even when jobRoleRaw promotes to multi_domain
  // (or any other category), the P1.7 invariant continues to hold.
  const burnoutCases = ['프리랜서 디자이너', '수의사 출신 투자심사역', '디자이너 마케터'];
  let p17Holds = true;
  for (const raw of burnoutCases) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile: { jobRoleRaw: raw } });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout'
      || sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover'
      || sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) { p17Holds = false; break; }
  }
  check('P2.3 RULES R10 (session): P1.7 burnout invariant holds under multi_domain-promoting jobRoleRaw values',
    p17Holds);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.3 SESSION TESTS — one named line per user-spec requirement that
// involves normalizeProfile / buildResultFromSession / routing invariance.
// Each PASS line maps 1:1 to a row in the user's "Required tests" list.
// ═══════════════════════════════════════════════════════════════════════════════

// REQUIRED: normalizeProfile should populate jobRoleCategory from jobRoleRaw
{
  const n = normalizeProfile({ jobRoleRaw: '백엔드 개발자' });
  check('REQUIRED: normalizeProfile populates jobRoleCategory from jobRoleRaw',
    n.jobRoleCategory === 'engineering' && n.jobRoleSubcategory === 'backend');
}

// REQUIRED: Existing profile fields should be preserved after normalization
{
  const rich: UserProfile = {
    ageBand: '30_early',
    jobRoleRaw: '백엔드 개발자',
    totalCareerStage: 'total_3_7',
    currentFieldStage: 'current_1_3',
    priorFieldExperience: 'has_prior_field', // → careerPattern derives to domain_shift
    workMode: 'organization',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'actively_considering',
    concernTags: ['burnout', 'too_many_options'],
    constraintTags: ['money', 'time'],
    desiredPaths: ['advisory_teaching'],
  };
  const n = normalizeProfile(rich);
  check('REQUIRED: existing ageBand preserved after normalization',
    n.ageBand === '30_early');
  check('REQUIRED: existing totalCareerStage preserved after normalization',
    n.totalCareerStage === 'total_3_7');
  check('REQUIRED: existing currentFieldStage preserved after normalization',
    n.currentFieldStage === 'current_1_3');
  check('REQUIRED: existing priorFieldExperience preserved after normalization',
    n.priorFieldExperience === 'has_prior_field');
  check('REQUIRED: existing workMode preserved after normalization',
    n.workMode === 'organization');
  check('REQUIRED: existing transitionTiming preserved after normalization',
    n.transitionTiming === 'within_3_6_months');
  check('REQUIRED: existing transitionIntent preserved after normalization',
    n.transitionIntent === 'actively_considering');
  check('REQUIRED: existing concernTags array preserved after normalization',
    JSON.stringify(n.concernTags) === JSON.stringify(['burnout', 'too_many_options']));
  check('REQUIRED: existing constraintTags array preserved after normalization',
    JSON.stringify(n.constraintTags) === JSON.stringify(['money', 'time']));
  check('REQUIRED: existing desiredPaths array preserved after normalization',
    JSON.stringify(n.desiredPaths) === JSON.stringify(['advisory_teaching']));
  check('REQUIRED: existing jobRoleRaw preserved verbatim after normalization',
    n.jobRoleRaw === '백엔드 개발자');
}

// REQUIRED: Adding jobRoleRaw/jobRoleCategory must not change mainTypeKey
//           Adding jobRoleRaw/jobRoleCategory must not change sourceOptionKey
//           Adding jobRoleRaw/jobRoleCategory must not change planModule
//
// Each routing key is asserted SEPARATELY across a battery of jobRoleRaw inputs
// that cover single-category, multi_domain, and "other" outcomes.
{
  const baseline = buildResultFromSession({ responses: baseResponses, profile: {} });
  const baseMainType = baseline.solutionLayer.mainTypeKey;
  const baseSource   = baseline.executionPlan.coreExperiment.sourceOptionKey;
  const basePlanMod  = baseline.solutionLayer.primaryModule.key;

  const raws = [
    '수의사',                    // single → veterinary_pet/veterinarian
    '백엔드 개발자',              // single → engineering/backend
    '투자심사역',                 // single → investment_finance/vc
    '프리랜서 디자이너',           // multi_domain (Rule 4)
    '수의사 출신 투자심사역',     // multi_domain
    '의사 출신 헬스케어 VC',      // multi_domain
    'zxqwerty foobar nonsense',  // → other
  ];

  let mainTypeOk = true, sourceOk = true, planModOk = true;
  for (const raw of raws) {
    const sp = buildResultFromSession({ responses: baseResponses, profile: { jobRoleRaw: raw } });
    if (sp.solutionLayer.mainTypeKey !== baseMainType) mainTypeOk = false;
    if (sp.executionPlan.coreExperiment.sourceOptionKey !== baseSource) sourceOk = false;
    if (sp.solutionLayer.primaryModule.key !== basePlanMod) planModOk = false;
  }
  check('REQUIRED: Adding jobRoleRaw/jobRoleCategory must NOT change mainTypeKey',
    mainTypeOk);
  check('REQUIRED: Adding jobRoleRaw/jobRoleCategory must NOT change sourceOptionKey',
    sourceOk);
  check('REQUIRED: Adding jobRoleRaw/jobRoleCategory must NOT change planModule',
    planModOk);

  // Also assert across explicit jobRoleCategory injection (in case a future
  // caller bypasses derivation and sets the category directly).
  let mainTypeOk2 = true, sourceOk2 = true, planModOk2 = true;
  const directProfiles: UserProfile[] = [
    { jobRoleCategory: 'engineering' },
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['design', 'founder_entrepreneur'] },
    { jobRoleCategory: 'other' },
    { jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'doctor' },
  ];
  for (const p of directProfiles) {
    const sp = buildResultFromSession({ responses: baseResponses, profile: p });
    if (sp.solutionLayer.mainTypeKey !== baseMainType) mainTypeOk2 = false;
    if (sp.executionPlan.coreExperiment.sourceOptionKey !== baseSource) sourceOk2 = false;
    if (sp.solutionLayer.primaryModule.key !== basePlanMod) planModOk2 = false;
  }
  check('REQUIRED: Direct jobRoleCategory injection must NOT change mainTypeKey',
    mainTypeOk2);
  check('REQUIRED: Direct jobRoleCategory injection must NOT change sourceOptionKey',
    sourceOk2);
  check('REQUIRED: Direct jobRoleCategory injection must NOT change planModule',
    planModOk2);
}

// REQUIRED: Burnout dominance in profile-context body (P2.4.12 rule).
//   When the session lands on mainTypeKey=overloadedBurnout, profileContext.body
//   MUST contain the recovery-state framing and MUST NOT mention market
//   validation, interviews, customer conversations, paid tests, content
//   publishing, networking, or proposals as primary actions — regardless of
//   workMode that might otherwise weave those examples in.
{
  // Non-safe workMode for burnout context (founder typically surfaces "고객 문제"
  // and "시장 반응" in non-burnout — suppress these in burnout).
  const sp = buildResultFromSession({
    responses: burnoutInterview,
    profile: { ageBand: '40_early', workMode: 'founder', careerPattern: 'multi_track' },
  });
  const body = sp.profileContext?.body ?? '';
  check('REQUIRED (P2.4.12): burnout body contains recovery framing',
    body.includes('에너지와 생활 리듬을 회복'));
  const PROHIBITED = ['시장 반응', '시장 검증', '인터뷰', '고객 반응', '고객 문제', '유료', '콘텐츠 발행', '네트워킹', '제안서'];
  let cleanBurnoutBody = true;
  for (const w of PROHIBITED) {
    if (body.includes(w)) { cleanBurnoutBody = false; break; }
  }
  check('REQUIRED (P2.4.12): burnout body does NOT mention market / interviews / customer / paid / content publishing / networking / proposals',
    cleanBurnoutBody);
}

// REQUIRED: P1.7 burnout invariant still passes
//   Re-asserted under jobRoleRaw inputs that promote to multi_domain (the new
//   behavior) and under direct jobRoleCategory injection.
{
  const cases: UserProfile[] = [
    { jobRoleRaw: '프리랜서 디자이너' },             // multi_domain via derivation
    { jobRoleRaw: '수의사 출신 투자심사역' },        // multi_domain via derivation
    { jobRoleCategory: 'multi_domain' },              // direct injection
    { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }, // direct injection
    { jobRoleRaw: 'zxqwerty foobar nonsense' },      // → other
  ];
  let allHold = true;
  for (const profile of cases) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout'
      || sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover'
      || sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) {
      allHold = false; break;
    }
  }
  check('REQUIRED: P1.7 burnout invariant still passes under any jobRoleRaw / jobRoleCategory',
    allHold);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.4 — Profile Context Summary integration tests
// Asserts:
//   I1. profileContext rides on ResultSpine when profile is non-empty
//   I2. profileContext is ABSENT when profile is empty / has nothing to summarize
//   R1. Routing fingerprint (mainTypeKey / sourceOptionKey / planModule /
//       weeklyActions / reevaluationChecklist / closingLine) is IDENTICAL across
//       wildly different profiles that DO change the summary content
//   R2. P1.7 burnout invariant continues to hold under every such profile
// ═══════════════════════════════════════════════════════════════════════════════

// I1 — profileContext present with new tag composition (profile-attribute
//       categories: 직업군 / 경력 단계 / 일하는 방식 / 전환 가능 시점 / 커리어 패턴)
{
  const sp = buildResultFromSession({
    responses: baseResponses,
    profile: {
      ageBand: '30_early',
      jobRoleRaw: '백엔드 개발자',
      jobRoleCategory: 'engineering',
      totalCareerStage: 'total_7_12',
      workMode: 'organization',
      transitionTiming: 'within_3_6_months',
      careerPattern: 'domain_shift',
    },
  });
  check('P2.4 I1: ResultSpine.profileContext present',
    sp.profileContext !== undefined);
  check('P2.4 I1: profileContext.headline composed (ageBand + jobRoleRaw + totalCareerStage)',
    sp.profileContext?.headline === '30대 초반 · 백엔드 개발자 · 경력 7~12년');
  check('P2.4 I1: body weaves workMode examples (내부 조정 or 역할 재설계 for organization)',
    sp.profileContext?.body.includes('내부 조정') || sp.profileContext?.body.includes('역할 재설계') || false);
  const tags = sp.profileContext?.tags ?? [];
  check('P2.4 I1: tags include 직업군 (엔지니어)',     tags.includes('엔지니어'));
  check('P2.4 I1: tags include 경력 단계 (경력 7~12년)', tags.includes('경력 7~12년'));
  check('P2.4 I1: tags include 일하는 방식 (조직 소속)', tags.includes('조직 소속'));
  check('P2.4 I1: tags include 전환 가능 시점',          tags.includes('3~6개월 준비'));
  check('P2.4 I1: tags include 커리어 패턴 (분야 전환)', tags.includes('분야 전환'));
  check('P2.4 I1: tags do NOT include strategy/direction (profile-only chips)',
    !tags.includes(sp.solutionLayer.primaryModule.title));
}

// I2 — profileContext ABSENT when profile is empty (section hidden per spec)
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: {} });
  check('P2.4 I2: ResultSpine.profileContext absent when profile is empty (section hidden)',
    sp.profileContext === undefined);
}

// R1 — Routing fingerprint unchanged across distinct profiles
{
  const ROUTING = (sp: ReturnType<typeof buildResultFromSession>) => JSON.stringify({
    mainTypeKey: sp.solutionLayer.mainTypeKey,
    sourceOptionKey: sp.executionPlan.coreExperiment.sourceOptionKey,
    planModule: sp.solutionLayer.primaryModule.key,
    weeklyActions: sp.executionPlan.weeklyActions.map((a) => a.action),
    reevaluationChecklist: sp.executionPlan.reevaluationChecklist,
    closingLine: sp.executionPlan.closingLine,
  });
  const baseFp = ROUTING(buildResultFromSession({ responses: baseResponses, profile: {} }));

  // A battery of profiles each of which DOES produce a distinct summary.
  const profiles: UserProfile[] = [
    { ageBand: '20_early' },
    { ageBand: '40_late_plus', workMode: 'founder' },
    {
      ageBand: '30_late',
      jobRoleRaw: '데이터 사이언티스트',
      totalCareerStage: 'total_7_12',
      workMode: 'organization',
      transitionTiming: 'within_3_6_months',
      transitionIntent: 'actively_considering',
      concernTags: ['burnout', 'strength_unclear'],
      constraintTags: ['money', 'time'],
      desiredPaths: ['job_change', 'advisory_teaching'],
    },
    { jobRoleRaw: '수의사 출신 투자심사역' },
    { concernTags: ['too_many_options', 'identity_confusion'] },
    { constraintTags: ['energy_burnout', 'family_responsibility'] },
    { desiredPaths: ['rest_recover', 'side_project'] },
  ];

  let allEqual = true;
  for (const p of profiles) {
    const fp = ROUTING(buildResultFromSession({ responses: baseResponses, profile: p }));
    if (fp !== baseFp) { allEqual = false; break; }
  }
  check('P2.4 R1: routing fingerprint identical across 7 distinct profile shapes (despite changing profileContext)',
    allEqual);

  // Cross-check: profileContext IS different across those profiles (proves the
  // summary actually changes — otherwise R1 would be vacuous). Under the new
  // P2.4.10 spec the section is hidden (undefined) for empty profiles, and
  // concern/constraint/desired tags no longer surface in the summary, so
  // profiles that only carry those produce identical summaries. We expect at
  // least 4 distinct shapes across the battery, which still proves R1 isn't
  // vacuous (the kitchen-sink, workMode-only, and the two single-field
  // profiles each produce different output).
  const summaries = profiles.map((p) =>
    JSON.stringify(buildResultFromSession({ responses: baseResponses, profile: p }).profileContext)
  );
  const distinctSummaries = new Set(summaries).size;
  check('P2.4 R1 (corollary): profileContext content actually varies across the test profiles',
    distinctSummaries >= 4);
}

// R2 — P1.7 invariant under varying profiles
{
  const profiles: UserProfile[] = [
    { ageBand: '20_early' },
    { ageBand: '40_late_plus', jobRoleRaw: '대표', workMode: 'founder' },
    { jobRoleRaw: '수의사 출신 투자심사역' },
    {
      concernTags: ['burnout', 'too_many_options'],
      constraintTags: ['energy_burnout'],
      desiredPaths: ['rest_recover'],
    },
  ];
  let allHold = true;
  for (const p of profiles) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile: p });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout'
      || sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover'
      || sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) { allHold = false; break; }
  }
  check('P2.4 R2: P1.7 burnout invariant holds across profiles whose profileContext differs',
    allHold);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.4 SESSION/UI TESTS — requirements 15–20 from the user spec.
// Each PASS line maps 1:1 to a numbered rule.
// ═══════════════════════════════════════════════════════════════════════════════

// Rich profile that exercises every summary slot — used as the "with summary"
// case in the no-routing-effect checks below.
const richSummaryProfile: UserProfile = {
  ageBand: '30_late',
  jobRoleRaw: '백엔드 개발자',
  jobRoleCategory: 'engineering',
  totalCareerStage: 'total_7_12',
  currentFieldStage: 'current_3_7',
  careerPattern: 'domain_shift',
  workMode: 'organization',
  transitionTiming: 'within_3_6_months',
  transitionIntent: 'actively_considering',
  concernTags: ['burnout', 'strength_unclear'],
  constraintTags: ['money'],
  desiredPaths: ['advisory_teaching'],
};

// REQUIRED 15 — Adding profile context summary does NOT change mainTypeKey
{
  const a = buildResultFromSession({ responses: baseResponses, profile: {} });
  const b = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  check('REQUIRED 15: Adding profile context summary does NOT change mainTypeKey',
    a.solutionLayer.mainTypeKey === b.solutionLayer.mainTypeKey);
}

// REQUIRED 16 — Adding profile context summary does NOT change sourceOptionKey
{
  const a = buildResultFromSession({ responses: baseResponses, profile: {} });
  const b = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  check('REQUIRED 16: Adding profile context summary does NOT change sourceOptionKey',
    a.executionPlan.coreExperiment.sourceOptionKey === b.executionPlan.coreExperiment.sourceOptionKey);
}

// REQUIRED 17 — Adding profile context summary does NOT change planModule
{
  const a = buildResultFromSession({ responses: baseResponses, profile: {} });
  const b = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  check('REQUIRED 17: Adding profile context summary does NOT change planModule',
    a.solutionLayer.primaryModule.key === b.solutionLayer.primaryModule.key);
}

// REQUIRED 18 — Adding profile context summary does NOT change weeklyActions
{
  const a = buildResultFromSession({ responses: baseResponses, profile: {} });
  const b = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  const aActions = JSON.stringify(a.executionPlan.weeklyActions.map((w) => w.action));
  const bActions = JSON.stringify(b.executionPlan.weeklyActions.map((w) => w.action));
  check('REQUIRED 18: Adding profile context summary does NOT change weeklyActions',
    aActions === bActions);
}

// REQUIRED 19 — P1.7 burnout invariant still passes (mainType=overloadedBurnout
//   ⇒ sourceOptionKey=restRecover ⇒ planModule=recoveryFirst), under profiles
//   that produce a different profileContext summary.
{
  const profiles: UserProfile[] = [
    {},
    { workMode: 'organization', transitionTiming: 'after_6_months' },
    { workMode: 'founder', careerPattern: 'multi_track' },
    richSummaryProfile,
  ];
  let allHold = true;
  for (const p of profiles) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile: p });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout' ||
      sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover' ||
      sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) { allHold = false; break; }
  }
  check('REQUIRED 19: P1.7 burnout invariant still passes under varying profile context summaries',
    allHold);
}

// REQUIRED 20 — Result screen renders the "현재 맥락 요약" section when profile
//   data exists. ResultSpineView gates the entire section render on
//   `spine.profileContext && (...)` and the eyebrow title is the literal
//   string "현재 맥락 요약" (verified by the UI source). This test pins the
//   data-layer half of the contract: across 5 distinct profile shapes that
//   each have AT LEAST ONE meaningful field, ResultSpine.profileContext is
//   defined AND both headline + body are non-empty strings. With that gate
//   satisfied, the UI MUST render the section.
{
  const renderProfiles: UserProfile[] = [
    { ageBand: '30_late' },
    { workMode: 'organization' },
    { careerPattern: 'domain_shift' },
    { jobRoleRaw: '백엔드 개발자' },
    richSummaryProfile,
  ];
  let allRender = true;
  for (const p of renderProfiles) {
    const sp = buildResultFromSession({ responses: baseResponses, profile: p });
    if (
      !sp.profileContext ||
      typeof sp.profileContext.headline !== 'string' || sp.profileContext.headline.length === 0 ||
      typeof sp.profileContext.body !== 'string' || sp.profileContext.body.length === 0
    ) { allRender = false; break; }
  }
  check('REQUIRED 20: Result screen renders "현재 맥락 요약" section when profile data exists (5 profile shapes — UI gates on spine.profileContext, eyebrow="현재 맥락 요약")',
    allRender);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.5 — Analytics submission builder, routing-invariance contract
// Adding the analytics builder must NOT affect any routing field. Each
// REQUIRED test below stringifies a specific routing key BEFORE and AFTER the
// analytics builder runs, asserting the underlying result is bit-identical.
// ═══════════════════════════════════════════════════════════════════════════════
import {
  buildCareerCompassAnalyticsSubmission as p25_buildAnalytics,
} from '../../lib/careerCompassAnalytics.ts';

// REQUIRED P2.5: Adding analytics submission does NOT change mainTypeKey
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  const before = sp.solutionLayer.mainTypeKey;
  const submission = p25_buildAnalytics({
    responses: baseResponses, profile: richSummaryProfile, result: sp,
  });
  // Reference `submission` so the builder is actually executed (and the
  // captured `result` reference is still valid post-call).
  void submission;
  check('REQUIRED P2.5: Adding analytics submission does NOT change mainTypeKey',
    sp.solutionLayer.mainTypeKey === before);
  check('REQUIRED P2.5: analytics submission mainTypeKey reflects the spine verbatim',
    submission.engineOutput.mainTypeKey === before);
}

// REQUIRED P2.5: Adding analytics submission does NOT change sourceOptionKey
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  const before = sp.executionPlan.coreExperiment.sourceOptionKey;
  const submission = p25_buildAnalytics({
    responses: baseResponses, profile: richSummaryProfile, result: sp,
  });
  check('REQUIRED P2.5: Adding analytics submission does NOT change sourceOptionKey',
    sp.executionPlan.coreExperiment.sourceOptionKey === before);
  check('REQUIRED P2.5: analytics submission sourceOptionKey reflects the spine verbatim',
    submission.engineOutput.finalSourceOptionKey === before);
}

// REQUIRED P2.5: Adding analytics submission does NOT change planModule
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  const before = sp.solutionLayer.primaryModule.key;
  const submission = p25_buildAnalytics({
    responses: baseResponses, profile: richSummaryProfile, result: sp,
  });
  check('REQUIRED P2.5: Adding analytics submission does NOT change planModule',
    sp.solutionLayer.primaryModule.key === before);
  check('REQUIRED P2.5: analytics submission planModuleKey reflects the spine verbatim',
    submission.engineOutput.planModuleKey === before);
}

// REQUIRED P2.5: Adding analytics submission does NOT change weeklyActions
{
  const sp = buildResultFromSession({ responses: baseResponses, profile: richSummaryProfile });
  const before = JSON.stringify(sp.executionPlan.weeklyActions.map((w) => w.action));
  p25_buildAnalytics({ responses: baseResponses, profile: richSummaryProfile, result: sp });
  const after = JSON.stringify(sp.executionPlan.weeklyActions.map((w) => w.action));
  check('REQUIRED P2.5: Adding analytics submission does NOT change weeklyActions',
    before === after);
}

// REQUIRED P2.5: P1.7 burnout invariant still passes (under varying profile
// AND under the analytics builder being called on the result).
{
  const profiles: UserProfile[] = [
    {},
    { workMode: 'organization', transitionTiming: 'after_6_months' },
    richSummaryProfile,
  ];
  let allHold = true;
  for (const p of profiles) {
    const sp = buildResultFromSession({ responses: burnoutInterview, profile: p });
    p25_buildAnalytics({ responses: burnoutInterview, profile: p, result: sp });
    if (
      sp.solutionLayer.mainTypeKey !== 'overloadedBurnout' ||
      sp.executionPlan.coreExperiment.sourceOptionKey !== 'restRecover' ||
      sp.solutionLayer.primaryModule.key !== 'recoveryFirst'
    ) { allHold = false; break; }
  }
  check('REQUIRED P2.5: P1.7 burnout invariant still passes after building analytics submission',
    allHold);
}

// REQUIRED P2.5: Builder is a pure transform — output's routing fields are
// the SAME REFERENCE-VALUE strings as on the input result (no rebuild).
{
  const sp = buildResultFromSession({ responses: burnoutInterview, profile: { workMode: 'organization' } });
  const submission = p25_buildAnalytics({
    responses: burnoutInterview, profile: { workMode: 'organization' }, result: sp,
  });
  check('REQUIRED P2.5: builder is pure — routing.mainTypeKey === spine.solutionLayer.mainTypeKey',
    submission.engineOutput.mainTypeKey === sp.solutionLayer.mainTypeKey);
  check('REQUIRED P2.5: builder is pure — routing.sourceOptionKey === spine.executionPlan.coreExperiment.sourceOptionKey',
    submission.engineOutput.finalSourceOptionKey === sp.executionPlan.coreExperiment.sourceOptionKey);
  check('REQUIRED P2.5: builder is pure — routing.planModuleKey === spine.solutionLayer.primaryModule.key',
    submission.engineOutput.planModuleKey === sp.solutionLayer.primaryModule.key);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
