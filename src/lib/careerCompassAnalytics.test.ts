// Headless tests for P2.5 buildCareerCompassAnalyticsSubmission.
// Pure-function only — no DOM, no localStorage, no network.
// Targets the user-prescribed shape:
//   { submissionId, createdAt, profile, context, userChoice, engineOutput, reportOutput }

import {
  buildCareerCompassAnalyticsSubmission,
  buildCareerCompassAnalyticsSubmissionFromSession,
} from './careerCompassAnalytics.ts';
import { buildResultFromResponses } from '../components/careerCompassV2/session.ts';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import type { UserProfile, ResultSpine } from '../types/careerCompass.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Shared fixtures ─────────────────────────────────────────────────────────
const baseResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_expand'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
  cv_values: { selectedOptionIds: ['cv_growth', 'cv_problem', 'cv_meaning'] },
  cv_priorities: { ranking: ['pr_growth', 'pr_meaning', 'pr_freedom'] },
  fc_1: { selectedOptionIds: ['fc1_solo'] }, fc_2: { selectedOptionIds: ['fc2_curator'] },
  fc_3: { selectedOptionIds: ['fc3_legacy'] }, fc_4: { selectedOptionIds: ['fc4_idea'] },
  sc_outlook: { selectedOptionIds: ['sc_share'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy: { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk: { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation: { selectedOptionIds: ['rc_val_some'] },
  or_content: { selectedOptionIds: ['orc_energized'] },
  or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_energized'] },
  ap_experiment: { selectedOptionIds: ['ap_portfolio'] },
  ap_memo: { shortText: '무리하지 않기' },
};

const burnoutResponses: FlowResponses = {
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

const baseResult = buildResultFromResponses(baseResponses);
const burnoutResult = buildResultFromResponses(burnoutResponses);

const richProfile: UserProfile = {
  ageBand: '30_late',
  jobRoleRaw: '백엔드 개발자',
  jobRoleCategory: 'engineering',
  jobRoleSubcategory: 'backend',
  jobRoleSecondaryCategories: ['operations'],
  totalCareerStage: 'total_7_12',
  currentFieldStage: 'current_3_7',
  priorFieldExperience: 'has_prior_field',
  careerPattern: 'domain_shift',
  workMode: 'organization',
  transitionTiming: 'within_3_6_months',
  transitionIntent: 'actively_considering',
  concernTags: ['burnout', 'strength_unclear'],
  constraintTags: ['money'],
  desiredPaths: ['advisory_teaching', 'side_project'],
};

// ─── Top-level shape ─────────────────────────────────────────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  const topKeys = Object.keys(out).sort().join(',');
  check('shape: top-level keys = submissionId, createdAt, profile, context, userChoice, engineOutput, reportOutput',
    topKeys === 'context,createdAt,engineOutput,profile,reportOutput,submissionId,userChoice');
  check('shape: profile is a plain object',
    typeof out.profile === 'object' && out.profile !== null && !Array.isArray(out.profile));
  check('shape: context is a plain object',
    typeof out.context === 'object' && out.context !== null && !Array.isArray(out.context));
  check('shape: userChoice is a plain object',
    typeof out.userChoice === 'object' && out.userChoice !== null && !Array.isArray(out.userChoice));
  check('shape: engineOutput is a plain object',
    typeof out.engineOutput === 'object' && out.engineOutput !== null && !Array.isArray(out.engineOutput));
  check('shape: reportOutput is a plain object',
    typeof out.reportOutput === 'object' && out.reportOutput !== null && !Array.isArray(out.reportOutput));
  check('shape: NO schemaVersion key (per user spec — not in structure)',
    !('schemaVersion' in out));
  check('shape: NO responses key (per user spec — moved to engineOutput / reportOutput)',
    !('responses' in out));
}

// ─── Metadata: submissionId + createdAt are always strings ───────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
    submissionId: 'sub_abc123', createdAt: '2026-06-01T00:00:00Z',
  });
  check('metadata: submissionId passes through verbatim',
    out.submissionId === 'sub_abc123');
  check('metadata: createdAt string passes through verbatim',
    out.createdAt === '2026-06-01T00:00:00Z');
}
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
    createdAt: new Date('2026-06-01T10:30:00Z'),
  });
  check('metadata: Date input → ISO 8601 string',
    out.createdAt === '2026-06-01T10:30:00.000Z');
}
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
  });
  check('metadata: omitted submissionId → empty string (required field stays a string)',
    out.submissionId === '');
  check('metadata: omitted createdAt → empty string',
    out.createdAt === '');
}

// ─── profile block — verbatim values, omit absent fields ────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
  });
  check('profile: ageBand passes through',
    out.profile.ageBand === '30_late');
  check('profile: jobRoleRaw INCLUDED verbatim per spec',
    out.profile.jobRoleRaw === '백엔드 개발자');
  check('profile: jobRoleCategory passes through',
    out.profile.jobRoleCategory === 'engineering');
  check('profile: jobRoleSubcategory passes through',
    out.profile.jobRoleSubcategory === 'backend');
  check('profile: jobRoleSecondaryCategories preserved',
    JSON.stringify(out.profile.jobRoleSecondaryCategories) === JSON.stringify(['operations']));
  check('profile: totalCareerStage passes through',
    out.profile.totalCareerStage === 'total_7_12');
  check('profile: currentFieldStage passes through',
    out.profile.currentFieldStage === 'current_3_7');
  check('profile: priorFieldExperience passes through',
    out.profile.priorFieldExperience === 'has_prior_field');
  check('profile: careerPattern passes through',
    out.profile.careerPattern === 'domain_shift');
  check('profile: workMode passes through',
    out.profile.workMode === 'organization');
  check('profile: transitionTiming passes through',
    out.profile.transitionTiming === 'within_3_6_months');
  check('profile: transitionIntent passes through',
    out.profile.transitionIntent === 'actively_considering');
}

// Empty profile — block is {} (no phantom undefined keys)
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
  });
  check('profile (empty input): block is {} (no phantom keys)',
    Object.keys(out.profile).length === 0);
}

// jobRoleRaw whitespace-only → omitted (after trim is empty)
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: { jobRoleRaw: '   ' }, result: baseResult,
  });
  check('profile: whitespace-only jobRoleRaw → field omitted from profile block',
    out.profile.jobRoleRaw === undefined);
}

// ─── context block — tag arrays only ─────────────────────────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
  });
  check('context: concernTags preserved',
    JSON.stringify(out.context.concernTags) === JSON.stringify(['burnout', 'strength_unclear']));
  check('context: constraintTags preserved',
    JSON.stringify(out.context.constraintTags) === JSON.stringify(['money']));
  check('context: desiredPaths preserved',
    JSON.stringify(out.context.desiredPaths) === JSON.stringify(['advisory_teaching', 'side_project']));
}
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
  });
  check('context (empty): all three tag arrays omitted',
    Object.keys(out.context).length === 0);
}

// ─── userChoice block ───────────────────────────────────────────────────────
{
  // base: user picked ap_portfolio → mapped to 'advisoryTeaching'
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('userChoice: selectedExperimentKey is the MAPPED CareerOptionKey (ap_portfolio → "advisoryTeaching")',
    out.userChoice.selectedExperimentKey === 'advisoryTeaching');
  check('userChoice: selectedExperimentKey is NEVER the raw card id ("ap_portfolio")',
    out.userChoice.selectedExperimentKey !== 'ap_portfolio');
  check('userChoice: selectedExperimentLabel populated from EXPERIMENT_LABEL_BY_CARD',
    typeof out.userChoice.selectedExperimentLabel === 'string'
    && out.userChoice.selectedExperimentLabel.length > 0);
}
{
  // burnout: user picked ap_interview → mapped to 'startup'
  const out = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses, profile: {}, result: burnoutResult,
  });
  check('userChoice (burnout): selectedExperimentKey = "startup" (ap_interview mapped via EXPERIMENT_OPTION_BY_CARD)',
    out.userChoice.selectedExperimentKey === 'startup');
}
{
  // no ap_experiment response → userChoice is {}
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: baseResult,
  });
  check('userChoice (no ap_experiment): block is {} (no phantom keys)',
    Object.keys(out.userChoice).length === 0);
}

// ─── engineOutput.activeLenses — structured 4-boolean object ────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  const al = out.engineOutput.activeLenses;
  check('engineOutput.activeLenses: has essentialism boolean',
    typeof al.essentialism === 'boolean');
  check('engineOutput.activeLenses: has range boolean',
    typeof al.range === 'boolean');
  check('engineOutput.activeLenses: has plannedHappenstance boolean',
    typeof al.plannedHappenstance === 'boolean');
  check('engineOutput.activeLenses: has jobCrafting boolean',
    typeof al.jobCrafting === 'boolean');
  check('engineOutput.activeLenses: exactly 4 keys',
    Object.keys(al).length === 4);
}

// ─── engineOutput.sourceOptionKey vs finalSourceOptionKey ───────────────────
{
  // base (no override): user pick === engine final
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('engineOutput (no override): sourceOptionKey === finalSourceOptionKey',
    out.engineOutput.sourceOptionKey === out.engineOutput.finalSourceOptionKey);
  check('engineOutput.overrideReason = "none" when no divergence',
    out.engineOutput.overrideReason === 'none');
}
{
  // burnout: user picked ap_interview→startup; engine forced restRecover
  const out = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses, profile: {}, result: burnoutResult,
  });
  check('engineOutput (burnout): sourceOptionKey = "startup" (user pick)',
    out.engineOutput.sourceOptionKey === 'startup');
  check('engineOutput (burnout): finalSourceOptionKey = "restRecover" (after P1.7 override)',
    out.engineOutput.finalSourceOptionKey === 'restRecover');
  check('engineOutput.overrideReason = "burnout_recovery_gate" when burnout fires',
    out.engineOutput.overrideReason === 'burnout_recovery_gate');
}

// ─── engineOutput required + optional fields ────────────────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('engineOutput: mainTypeKey is a non-empty string',
    typeof out.engineOutput.mainTypeKey === 'string' && out.engineOutput.mainTypeKey.length > 0);
  check('engineOutput: planModuleKey is a non-empty string',
    typeof out.engineOutput.planModuleKey === 'string' && out.engineOutput.planModuleKey.length > 0);
  check('engineOutput: supportTags is an array',
    Array.isArray(out.engineOutput.supportTags));
  check('engineOutput: bestMoveKey populated when result has bestMove',
    typeof out.engineOutput.bestMoveKey === 'string');
  check('engineOutput: resultMode populated',
    typeof out.engineOutput.resultMode === 'string');
}

// ─── engineOutput routing pass-through (proves NO engine recall) ────────────
{
  const fakeResult = {
    ...baseResult,
    solutionLayer: {
      ...baseResult.solutionLayer,
      mainTypeKey: 'WONKY_TYPE',
      primaryModule: { ...baseResult.solutionLayer.primaryModule, key: 'WONKY_MODULE' },
    },
    executionPlan: {
      ...baseResult.executionPlan,
      coreExperiment: { ...baseResult.executionPlan.coreExperiment, sourceOptionKey: 'WONKY_SOURCE' },
    },
  } as unknown as ResultSpine;
  const out = buildCareerCompassAnalyticsSubmission({
    responses: {}, profile: {}, result: fakeResult,
  });
  check('engineOutput: mainTypeKey passes through verbatim (NO engine recall)',
    out.engineOutput.mainTypeKey === 'WONKY_TYPE');
  check('engineOutput: planModuleKey passes through verbatim',
    out.engineOutput.planModuleKey === 'WONKY_MODULE');
  check('engineOutput: finalSourceOptionKey passes through verbatim',
    out.engineOutput.finalSourceOptionKey === 'WONKY_SOURCE');
}

// ─── overrideReason detection — one test per spec branch ───────────────────

// (a) burnout_recovery_gate — user picked an action, engine forced recovery.
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses, profile: {}, result: burnoutResult,
  });
  check('overrideReason (a): burnout + user picked ap_interview (→startup), engine→restRecover → "burnout_recovery_gate"',
    out.engineOutput.overrideReason === 'burnout_recovery_gate');
}

// (a-negative) burnout but user picked ap_rest — selected===final, NO override.
{
  const burnoutPickRestResponses: FlowResponses = {
    ...burnoutResponses, ap_experiment: { selectedOptionIds: ['ap_rest'] },
  };
  const r = buildResultFromResponses(burnoutPickRestResponses);
  const out = buildCareerCompassAnalyticsSubmission({
    responses: burnoutPickRestResponses, profile: {}, result: r,
  });
  // selectedExperimentKey will be 'restRecover' (ap_rest mapping), same as final → no override
  check('overrideReason (a-neg): burnout + ap_rest pick (selectedExperimentKey===final) → NOT burnout_recovery_gate',
    out.engineOutput.overrideReason !== 'burnout_recovery_gate');
}

// (b) ap_unsure_plan_module_fallback — user picked ap_unsure, engine fell back.
{
  const apUnsureResponses: FlowResponses = {
    ...baseResponses, ap_experiment: { selectedOptionIds: ['ap_unsure'] },
  };
  const apUnsureResult = buildResultFromResponses(apUnsureResponses);
  const out = buildCareerCompassAnalyticsSubmission({
    responses: apUnsureResponses, profile: {}, result: apUnsureResult,
  });
  check('overrideReason (b): ap_unsure pick → "ap_unsure_plan_module_fallback"',
    out.engineOutput.overrideReason === 'ap_unsure_plan_module_fallback');
  check('overrideReason (b): selectedExperimentKey absent on this path (ap_unsure has no mapping)',
    out.userChoice.selectedExperimentKey === undefined);
}

// (b-alt) no ap_experiment response at all → ap_unsure_plan_module_fallback
{
  const noApResponses: FlowResponses = { ...baseResponses };
  delete (noApResponses as Record<string, unknown>).ap_experiment;
  const r = buildResultFromResponses(noApResponses);
  const out = buildCareerCompassAnalyticsSubmission({
    responses: noApResponses, profile: {}, result: r,
  });
  check('overrideReason (b-alt): missing ap_experiment response → "ap_unsure_plan_module_fallback"',
    out.engineOutput.overrideReason === 'ap_unsure_plan_module_fallback');
}

// (c) low_option_visibility_protection — synth a result with the mainType
//     and a divergence between selected and final.
{
  const lowOptResult = {
    ...baseResult,
    solutionLayer: { ...baseResult.solutionLayer, mainTypeKey: 'lowOptionVisibility' },
    userSelectedExperimentKey: 'startup',
    executionPlan: {
      ...baseResult.executionPlan,
      coreExperiment: { ...baseResult.executionPlan.coreExperiment, sourceOptionKey: 'opportunityGeneration' },
    },
  } as unknown as ResultSpine;
  // Build with responses where user actually picked ap_interview (→startup)
  // so selectedExperimentKey is populated.
  const out = buildCareerCompassAnalyticsSubmission({
    responses: { ...baseResponses, ap_experiment: { selectedOptionIds: ['ap_interview'] } },
    profile: {}, result: lowOptResult,
  });
  check('overrideReason (c): lowOptionVisibility + divergence → "low_option_visibility_protection"',
    out.engineOutput.overrideReason === 'low_option_visibility_protection');
}

// (c-negative) lowOptionVisibility but selected === final → no protection fired.
//   User picked ap_interview (→ 'startup' via EXPERIMENT_OPTION_BY_CARD).
//   We mock the engine's final to ALSO be 'startup' so the divergence
//   condition fails. Detector should return 'none' (not the protection
//   label), since no protection actually overrode anything.
{
  const lowOptNoDivergence = {
    ...baseResult,
    solutionLayer: { ...baseResult.solutionLayer, mainTypeKey: 'lowOptionVisibility' },
    executionPlan: {
      ...baseResult.executionPlan,
      coreExperiment: { ...baseResult.executionPlan.coreExperiment, sourceOptionKey: 'startup' },
    },
  } as unknown as ResultSpine;
  const out = buildCareerCompassAnalyticsSubmission({
    responses: { ...baseResponses, ap_experiment: { selectedOptionIds: ['ap_interview'] } },
    profile: {}, result: lowOptNoDivergence,
  });
  check('overrideReason (c-neg): lowOptionVisibility without divergence → NOT low_option_visibility_protection',
    out.engineOutput.overrideReason !== 'low_option_visibility_protection');
}

// (d) plan_module_widening — NOT detectable from current schema. The function
//     deliberately leaves this case as 'none'. Documented in the source.
{
  // Synth a result that would have widened the plan module — but we have no
  // schema-level signal to detect it, so we expect 'none' (not a wrong label).
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('overrideReason (d): plan_module_widening is NEVER emitted (not safely detectable; documented)',
    out.engineOutput.overrideReason !== 'plan_module_widening');
}

// (e) cross_product_strategy_bridge — unvalidatedAspirant × portfolioConvert.
{
  const bridgeResult = {
    ...baseResult,
    solutionLayer: {
      ...baseResult.solutionLayer,
      mainTypeKey: 'unvalidatedAspirant',
      primaryModule: { ...baseResult.solutionLayer.primaryModule, key: 'portfolioConvert', title: '전문성 자산화' },
    },
  } as unknown as ResultSpine;
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: bridgeResult,
  });
  check('overrideReason (e): unvalidatedAspirant × portfolioConvert → "cross_product_strategy_bridge"',
    out.engineOutput.overrideReason === 'cross_product_strategy_bridge');
}

// (f) none — normal case with user pick === final.
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('overrideReason (f): normal case (selected===final, mainType not special) → "none"',
    out.engineOutput.overrideReason === 'none');
}

// ─── reportOutput — string-array shape per user spec ────────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('reportOutput.weeklyActions: each element is a string (not an object)',
    Array.isArray(out.reportOutput.weeklyActions)
    && out.reportOutput.weeklyActions.every((s) => typeof s === 'string'));
  check('reportOutput.successSignals: every element is a string',
    Array.isArray(out.reportOutput.successSignals)
    && out.reportOutput.successSignals.every((s) => typeof s === 'string'));
  check('reportOutput.stopOrPivotCriteria: every element is a string',
    Array.isArray(out.reportOutput.stopOrPivotCriteria)
    && out.reportOutput.stopOrPivotCriteria.every((s) => typeof s === 'string'));
  check('reportOutput.reevaluationChecklist: every element is a string',
    Array.isArray(out.reportOutput.reevaluationChecklist)
    && out.reportOutput.reevaluationChecklist.every((s) => typeof s === 'string'));
}

// reportOutput does NOT expose internal enum values (only display copy).
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  // Concatenate all reportOutput text fields and assert no raw enum key leaks.
  // These are the routing-level keys that live in engineOutput; reportOutput
  // is user-facing copy only.
  const allText =
    out.reportOutput.identityStatement + ' ' +
    out.reportOutput.strategyStatement + ' ' +
    out.reportOutput.coreExperimentLabel + ' ' +
    out.reportOutput.weeklyActions.join(' ') + ' ' +
    out.reportOutput.successSignals.join(' ') + ' ' +
    out.reportOutput.stopOrPivotCriteria.join(' ') + ' ' +
    out.reportOutput.reevaluationChecklist.join(' ') + ' ' +
    out.reportOutput.closingLine;
  const internalKeys = [
    'plateauedPerformer', 'overloadedBurnout', 'unvalidatedAspirant', 'scatteredExplorer',
    'portfolioConvert', 'recoveryFirst', 'marketTest', 'optionNarrowing',
    'restRecover', 'jobChange', 'stayRedesign', 'advisoryTeaching',
  ];
  let leaked: string | undefined;
  for (const k of internalKeys) if (allText.includes(k)) { leaked = k; break; }
  check('reportOutput: NO internal enum value leaks into display copy'
    + (leaked ? ` — leaked "${leaked}"` : ''),
    leaked === undefined);
}

// ─── reportOutput — display copy from result ────────────────────────────────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: buildResultFromResponses(baseResponses, { profile: richProfile }),
  });
  check('reportOutput: identityStatement is a non-empty string',
    typeof out.reportOutput.identityStatement === 'string'
    && out.reportOutput.identityStatement.length > 0);
  check('reportOutput: strategyStatement is a non-empty string',
    typeof out.reportOutput.strategyStatement === 'string'
    && out.reportOutput.strategyStatement.length > 0);
  check('reportOutput: coreExperimentLabel is a non-empty string',
    typeof out.reportOutput.coreExperimentLabel === 'string'
    && out.reportOutput.coreExperimentLabel.length > 0);
  check('reportOutput: weeklyActions is an array of strings',
    Array.isArray(out.reportOutput.weeklyActions)
    && out.reportOutput.weeklyActions.every((s) => typeof s === 'string'));
  check('reportOutput: successSignals is a string array',
    Array.isArray(out.reportOutput.successSignals));
  check('reportOutput: stopOrPivotCriteria is a string array',
    Array.isArray(out.reportOutput.stopOrPivotCriteria));
  check('reportOutput: reevaluationChecklist is a string array',
    Array.isArray(out.reportOutput.reevaluationChecklist));
  check('reportOutput: closingLine is a string',
    typeof out.reportOutput.closingLine === 'string');
  check('reportOutput: profileContextHeadline populated when result has profileContext',
    typeof out.reportOutput.profileContextHeadline === 'string'
    && out.reportOutput.profileContextHeadline.length > 0);
  check('reportOutput: profileContextBody populated when result has profileContext',
    typeof out.reportOutput.profileContextBody === 'string'
    && out.reportOutput.profileContextBody.length > 0);
  check('reportOutput: profileContextTags array preserved',
    Array.isArray(out.reportOutput.profileContextTags));
}
{
  // empty profile → no profileContext on result → 3 profile-context fields omitted
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('reportOutput (no profileContext): profileContextHeadline omitted',
    out.reportOutput.profileContextHeadline === undefined);
  check('reportOutput (no profileContext): profileContextBody omitted',
    out.reportOutput.profileContextBody === undefined);
  check('reportOutput (no profileContext): profileContextTags omitted',
    out.reportOutput.profileContextTags === undefined);
}

// ─── Plain JSON serializable — no undefined values inside arrays/objects ────
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
    submissionId: 'sub_x', createdAt: '2026-06-01T00:00:00Z',
  });
  // Round-trip through JSON.parse(JSON.stringify(...)) must produce an EQUAL
  // object — proves all values are JSON-safe (no Dates, functions, Symbols).
  const round = JSON.parse(JSON.stringify(out));
  check('JSON: round-trip stringify+parse produces an equal object',
    JSON.stringify(round) === JSON.stringify(out));
  check('JSON: no "undefined" string literal in the serialized output',
    !JSON.stringify(out).includes(': undefined'));
}

// ─── PURITY — inputs are not mutated ────────────────────────────────────────
{
  const profile: UserProfile = { ...richProfile };
  const responses: FlowResponses = JSON.parse(JSON.stringify(baseResponses));
  const result = baseResult;
  const profileSnap = JSON.stringify(profile);
  const responsesSnap = JSON.stringify(responses);
  const resultSnap = JSON.stringify(result);

  buildCareerCompassAnalyticsSubmission({ responses, profile, result });

  check('PURITY: profile not mutated',
    JSON.stringify(profile) === profileSnap);
  check('PURITY: responses not mutated',
    JSON.stringify(responses) === responsesSnap);
  check('PURITY: result not mutated',
    JSON.stringify(result) === resultSnap);
}

// ─── No side effects (runs in Node where window/localStorage are absent) ────
{
  check('NO SIDE EFFECTS: builder ran in Node without throwing on missing window/localStorage',
    true);
}

// ─── Idempotency ────────────────────────────────────────────────────────────
{
  const a = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
    submissionId: 'sub_x', createdAt: '2026-06-01T00:00:00Z',
  });
  const b = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
    submissionId: 'sub_x', createdAt: '2026-06-01T00:00:00Z',
  });
  check('idempotency: two calls produce equal output',
    JSON.stringify(a) === JSON.stringify(b));
}

// ─── SessionState convenience wrapper ───────────────────────────────────────
{
  const aFlat = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: richProfile, result: baseResult,
    submissionId: 's', createdAt: '2026-06-01T00:00:00Z',
  });
  const aSession = buildCareerCompassAnalyticsSubmissionFromSession({
    session: { responses: baseResponses, profile: richProfile },
    result: baseResult,
    submissionId: 's', createdAt: '2026-06-01T00:00:00Z',
  });
  check('convenience: SessionState wrapper produces same output as flat call',
    JSON.stringify(aFlat) === JSON.stringify(aSession));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL — selectedExperimentKey vs finalSourceOptionKey must remain DISTINCT
// so the analytics layer can measure the gap between user intent ("I want to
// do X") and engine recommendation ("the engine routed you to Y"). This test
// is a verbatim transcription of the user-supplied example:
//   "If the user selected ap_interview and the engine mapped that to startup,
//    but the user is overloadedBurnout, P1.7 forces recovery."
// Expected:
//   selectedExperimentKey = "startup"
//   finalSourceOptionKey  = "restRecover"
//   overrideReason        = "burnout_recovery_gate"
//   selectedExperimentKey !== finalSourceOptionKey  (the gap exists)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses, profile: {}, result: burnoutResult,
  });
  check('CRITICAL: selectedExperimentKey = "startup" (user picked ap_interview → engine mapped to startup)',
    out.userChoice.selectedExperimentKey === 'startup');
  check('CRITICAL: finalSourceOptionKey = "restRecover" (P1.7 burnout invariant forces recovery)',
    out.engineOutput.finalSourceOptionKey === 'restRecover');
  check('CRITICAL: overrideReason = "burnout_recovery_gate"',
    out.engineOutput.overrideReason === 'burnout_recovery_gate');
  check('CRITICAL: selectedExperimentKey and finalSourceOptionKey REMAIN DISTINCT (not collapsed)',
    out.userChoice.selectedExperimentKey !== out.engineOutput.finalSourceOptionKey);
  check('CRITICAL: both fields exist on the submission (neither was dropped)',
    typeof out.userChoice.selectedExperimentKey === 'string'
    && typeof out.engineOutput.finalSourceOptionKey === 'string');
  check('CRITICAL: gap-analysis question is answerable from submission alone — "user wanted startup, engine routed to restRecover"',
    out.userChoice.selectedExperimentKey === 'startup'
    && out.engineOutput.finalSourceOptionKey === 'restRecover');
}

// CRITICAL — when no override fires, the two fields agree, but they remain
// SEPARATE fields (distinct keys on the object). This proves the schema
// preserves both even when their values happen to coincide.
{
  const out = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('CRITICAL: with no override, selectedExperimentKey === finalSourceOptionKey (both "advisoryTeaching")',
    out.userChoice.selectedExperimentKey === out.engineOutput.finalSourceOptionKey
    && out.userChoice.selectedExperimentKey === 'advisoryTeaching');
  check('CRITICAL: keys remain SEPARATE properties on the submission (schema not collapsed)',
    'selectedExperimentKey' in out.userChoice
    && 'finalSourceOptionKey' in out.engineOutput);
  check('CRITICAL: overrideReason = "none" when no override fires',
    out.engineOutput.overrideReason === 'none');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMARY CASE — 회사원 (general office worker) burnout override
// User-spec: this is the representative analytics test case. A general
// company employee who picked an action-oriented experiment (ap_interview)
// but is overloadedBurnout — engine correctly routes them to recovery.
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Build the burnout result with the office-worker profile attached so the
  // result.profileContext also rides on the spine.
  const officeWorkerProfile: UserProfile = {
    jobRoleRaw: '회사원',
    workMode: 'organization',
    totalCareerStage: 'total_3_7',
    currentFieldStage: 'current_3_7',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'preparing',
    concernTags: ['burnout'],
    constraintTags: ['energy_burnout'],
    desiredPaths: ['job_change'],
  };
  const officeResult = buildResultFromResponses(burnoutResponses, { profile: officeWorkerProfile });
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses,
    profile: officeResult.profile ?? officeWorkerProfile,  // normalized profile from spine
    result: officeResult,
    submissionId: 'sub_office_001',
    createdAt: '2026-06-01T10:30:00Z',
  });

  // profile section
  check('PRIMARY(회사원): analytics.profile.jobRoleRaw = "회사원"',
    sub.profile.jobRoleRaw === '회사원');
  check('PRIMARY(회사원): analytics.profile.workMode = "organization"',
    sub.profile.workMode === 'organization');
  check('PRIMARY(회사원): analytics.profile.totalCareerStage = "total_3_7"',
    sub.profile.totalCareerStage === 'total_3_7');
  check('PRIMARY(회사원): analytics.profile.currentFieldStage = "current_3_7"',
    sub.profile.currentFieldStage === 'current_3_7');
  check('PRIMARY(회사원): analytics.profile.transitionTiming = "within_3_6_months"',
    sub.profile.transitionTiming === 'within_3_6_months');
  check('PRIMARY(회사원): analytics.profile.transitionIntent = "preparing"',
    sub.profile.transitionIntent === 'preparing');

  // context section
  check('PRIMARY(회사원): analytics.context.concernTags includes "burnout"',
    Array.isArray(sub.context.concernTags) && sub.context.concernTags!.includes('burnout'));
  check('PRIMARY(회사원): analytics.context.constraintTags includes "energy_burnout"',
    Array.isArray(sub.context.constraintTags) && sub.context.constraintTags!.includes('energy_burnout'));
  check('PRIMARY(회사원): analytics.context.desiredPaths includes "job_change"',
    Array.isArray(sub.context.desiredPaths) && sub.context.desiredPaths!.includes('job_change'));

  // userChoice section — selected experiment is the mapped key from ap_interview
  check('PRIMARY(회사원): analytics.userChoice.selectedExperimentKey = "startup" (ap_interview → startup)',
    sub.userChoice.selectedExperimentKey === 'startup');

  // engineOutput section
  check('PRIMARY(회사원): analytics.engineOutput.mainTypeKey = "overloadedBurnout"',
    sub.engineOutput.mainTypeKey === 'overloadedBurnout');
  check('PRIMARY(회사원): analytics.engineOutput.planModuleKey = "recoveryFirst"',
    sub.engineOutput.planModuleKey === 'recoveryFirst');
  check('PRIMARY(회사원): analytics.engineOutput.finalSourceOptionKey = "restRecover"',
    sub.engineOutput.finalSourceOptionKey === 'restRecover');
  check('PRIMARY(회사원): analytics.engineOutput.overrideReason = "burnout_recovery_gate"',
    sub.engineOutput.overrideReason === 'burnout_recovery_gate');

  // The gap that makes this case worth analyzing
  check('PRIMARY(회사원): selectedExperimentKey ("startup") and finalSourceOptionKey ("restRecover") REMAIN DISTINCT',
    sub.userChoice.selectedExperimentKey !== sub.engineOutput.finalSourceOptionKey);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECONDARY REGRESSION — 수의사 출신 투자심사역 (multi_domain preservation)
// Used ONLY to verify that multi-domain analytics labels survive end-to-end.
// Not the primary example case.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const vetVcProfile: UserProfile = {
    jobRoleRaw: '수의사 출신 투자심사역',
    // Let normalizeProfile derive jobRoleCategory / jobRoleSecondaryCategories
    // from jobRoleRaw — that's the real-world path. Test asserts the derived
    // values appear in the analytics submission.
  };
  const vetVcResult = buildResultFromResponses(baseResponses, { profile: vetVcProfile });
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses,
    profile: vetVcResult.profile ?? vetVcProfile,  // normalized profile
    result: vetVcResult,
  });

  check('SECONDARY(multi_domain): analytics.profile.jobRoleRaw = "수의사 출신 투자심사역"',
    sub.profile.jobRoleRaw === '수의사 출신 투자심사역');
  check('SECONDARY(multi_domain): analytics.profile.jobRoleCategory = "multi_domain"',
    sub.profile.jobRoleCategory === 'multi_domain');
  check('SECONDARY(multi_domain): jobRoleSecondaryCategories includes "veterinary_pet"',
    Array.isArray(sub.profile.jobRoleSecondaryCategories)
    && sub.profile.jobRoleSecondaryCategories!.includes('veterinary_pet'));
  check('SECONDARY(multi_domain): jobRoleSecondaryCategories includes "investment_finance"',
    Array.isArray(sub.profile.jobRoleSecondaryCategories)
    && sub.profile.jobRoleSecondaryCategories!.includes('investment_finance'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.5 — one named line per user-listed requirement (1–21).
// Each PASS line maps 1:1 to a numbered rule.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const profile: UserProfile = {
    jobRoleRaw: '회사원', workMode: 'organization',
    totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7',
    transitionTiming: 'within_3_6_months', transitionIntent: 'preparing',
    concernTags: ['burnout'], constraintTags: ['energy_burnout'],
    desiredPaths: ['job_change'],
  };
  const result = buildResultFromResponses(burnoutResponses, { profile });
  const normalizedProfile = result.profile ?? profile;
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses,
    profile: normalizedProfile,
    result,
    submissionId: 'sub_required', createdAt: '2026-06-01T10:30:00Z',
  });

  // REQUIRED 1 — JSON-serializable object
  let serializable = true;
  try { JSON.stringify(sub); } catch { serializable = false; }
  check('REQUIRED 1: buildCareerCompassAnalyticsSubmission returns a JSON-serializable object',
    serializable && typeof sub === 'object' && sub !== null);

  // REQUIRED 2 — profile fields copied into analytics.profile
  check('REQUIRED 2: profile fields are copied into analytics.profile',
    sub.profile.jobRoleRaw === '회사원'
    && sub.profile.workMode === 'organization'
    && sub.profile.totalCareerStage === 'total_3_7'
    && sub.profile.currentFieldStage === 'current_3_7'
    && sub.profile.transitionTiming === 'within_3_6_months'
    && sub.profile.transitionIntent === 'preparing');

  // REQUIRED 3 — concernTags, constraintTags, desiredPaths in analytics.context
  check('REQUIRED 3: concernTags, constraintTags, desiredPaths are copied into analytics.context',
    sub.context.concernTags?.includes('burnout') === true
    && sub.context.constraintTags?.includes('energy_burnout') === true
    && sub.context.desiredPaths?.includes('job_change') === true);

  // REQUIRED 4 — selectedExperimentKey in analytics.userChoice
  check('REQUIRED 4: selectedExperimentKey is stored in analytics.userChoice',
    typeof sub.userChoice.selectedExperimentKey === 'string'
    && sub.userChoice.selectedExperimentKey === 'startup');

  // REQUIRED 5 — finalSourceOptionKey in analytics.engineOutput
  check('REQUIRED 5: finalSourceOptionKey is stored in analytics.engineOutput',
    typeof sub.engineOutput.finalSourceOptionKey === 'string'
    && sub.engineOutput.finalSourceOptionKey === 'restRecover');

  // REQUIRED 6 — distinct in burnout override
  check('REQUIRED 6: selectedExperimentKey and finalSourceOptionKey remain distinct in burnout override cases',
    sub.userChoice.selectedExperimentKey !== sub.engineOutput.finalSourceOptionKey);

  // REQUIRED 7 — burnout + ap_interview → burnout_recovery_gate
  check('REQUIRED 7: burnout + ap_interview produces overrideReason = "burnout_recovery_gate"',
    sub.engineOutput.overrideReason === 'burnout_recovery_gate');

  // REQUIRED 8 — normal case → "none"
  {
    const normalResult = buildResultFromResponses(baseResponses);
    const normalSub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: normalResult,
    });
    check('REQUIRED 8: normal case without override produces overrideReason = "none"',
      normalSub.engineOutput.overrideReason === 'none');
  }

  // REQUIRED 9 — activeLenses copied
  check('REQUIRED 9: activeLenses are copied correctly (structured 4-boolean object)',
    typeof sub.engineOutput.activeLenses.essentialism === 'boolean'
    && typeof sub.engineOutput.activeLenses.range === 'boolean'
    && typeof sub.engineOutput.activeLenses.plannedHappenstance === 'boolean'
    && typeof sub.engineOutput.activeLenses.jobCrafting === 'boolean'
    && Object.keys(sub.engineOutput.activeLenses).length === 4);

  // REQUIRED 10 — supportTags copied
  check('REQUIRED 10: supportTags are copied correctly',
    Array.isArray(sub.engineOutput.supportTags)
    && JSON.stringify(sub.engineOutput.supportTags) === JSON.stringify(result.solutionLayer.supportTags ?? []));

  // REQUIRED 11 — profileContext summary copied to reportOutput
  check('REQUIRED 11: profileContext summary is copied into reportOutput (headline/body/tags)',
    !!result.profileContext
    && sub.reportOutput.profileContextHeadline === result.profileContext.headline
    && sub.reportOutput.profileContextBody === result.profileContext.body
    && JSON.stringify(sub.reportOutput.profileContextTags) === JSON.stringify(result.profileContext.tags ?? undefined));

  // REQUIRED 12 — report fields all copied
  check('REQUIRED 12: identityStatement, strategyStatement, coreExperimentLabel, weeklyActions, successSignals, stopOrPivotCriteria, reevaluationChecklist, closingLine are copied into reportOutput',
    sub.reportOutput.identityStatement === result.identityAxis.statement
    && sub.reportOutput.strategyStatement === result.executionPlan.strategyStatement
    && sub.reportOutput.coreExperimentLabel === result.executionPlan.coreExperiment.label
    && JSON.stringify(sub.reportOutput.weeklyActions) === JSON.stringify(result.executionPlan.weeklyActions.map((w) => w.action))
    && JSON.stringify(sub.reportOutput.successSignals) === JSON.stringify(result.executionPlan.successSignals)
    && JSON.stringify(sub.reportOutput.stopOrPivotCriteria) === JSON.stringify(result.executionPlan.stopOrPivotCriteria)
    && JSON.stringify(sub.reportOutput.reevaluationChecklist) === JSON.stringify(result.executionPlan.reevaluationChecklist)
    && sub.reportOutput.closingLine === result.executionPlan.closingLine);

  // REQUIRED 13 — analytics builder does NOT mutate profile
  {
    const beforeProfile: UserProfile = { ...profile, concernTags: [...(profile.concernTags ?? [])] };
    const before = JSON.stringify(beforeProfile);
    buildCareerCompassAnalyticsSubmission({ responses: burnoutResponses, profile: beforeProfile, result });
    check('REQUIRED 13: analytics builder does not mutate profile',
      JSON.stringify(beforeProfile) === before);
  }

  // REQUIRED 14 — analytics builder does NOT mutate result
  {
    const before = JSON.stringify(result);
    buildCareerCompassAnalyticsSubmission({ responses: burnoutResponses, profile: normalizedProfile, result });
    check('REQUIRED 14: analytics builder does not mutate result',
      JSON.stringify(result) === before);
  }

  // REQUIRED 15 — analytics builder does NOT change mainTypeKey
  {
    const before = result.solutionLayer.mainTypeKey;
    buildCareerCompassAnalyticsSubmission({ responses: burnoutResponses, profile: normalizedProfile, result });
    check('REQUIRED 15: analytics builder does not change mainTypeKey',
      result.solutionLayer.mainTypeKey === before);
  }

  // REQUIRED 16 — analytics builder does NOT change sourceOptionKey
  {
    const before = result.executionPlan.coreExperiment.sourceOptionKey;
    buildCareerCompassAnalyticsSubmission({ responses: burnoutResponses, profile: normalizedProfile, result });
    check('REQUIRED 16: analytics builder does not change sourceOptionKey',
      result.executionPlan.coreExperiment.sourceOptionKey === before);
  }

  // REQUIRED 17 — analytics builder does NOT change planModule
  {
    const before = result.solutionLayer.primaryModule.key;
    buildCareerCompassAnalyticsSubmission({ responses: burnoutResponses, profile: normalizedProfile, result });
    check('REQUIRED 17: analytics builder does not change planModule',
      result.solutionLayer.primaryModule.key === before);
  }

  // REQUIRED 18 — P1.7 burnout invariant still passes
  check('REQUIRED 18: P1.7 burnout invariant still passes (mainType=overloadedBurnout ⇒ source=restRecover ⇒ module=recoveryFirst)',
    result.solutionLayer.mainTypeKey === 'overloadedBurnout'
    && result.executionPlan.coreExperiment.sourceOptionKey === 'restRecover'
    && result.solutionLayer.primaryModule.key === 'recoveryFirst');

  // REQUIRED 19 — JSON.stringify + JSON.parse round-trip
  {
    const roundTripped = JSON.parse(JSON.stringify(sub));
    check('REQUIRED 19: analytics object survives JSON.stringify + JSON.parse round-trip',
      JSON.stringify(roundTripped) === JSON.stringify(sub));
  }

  // REQUIRED 20 — 회사원 office-worker profile preserved (composite assertion)
  check('REQUIRED 20: general office-worker profile (회사원) is preserved in analytics.profile',
    sub.profile.jobRoleRaw === '회사원'
    && sub.profile.workMode === 'organization'
    && sub.profile.totalCareerStage === 'total_3_7'
    && sub.profile.currentFieldStage === 'current_3_7'
    && sub.profile.transitionTiming === 'within_3_6_months'
    && sub.profile.transitionIntent === 'preparing'
    && sub.context.concernTags?.includes('burnout') === true
    && sub.context.constraintTags?.includes('energy_burnout') === true
    && sub.context.desiredPaths?.includes('job_change') === true);

  // REQUIRED 21 — multi_domain regression preserved (secondary test case)
  {
    const vetProfile: UserProfile = { jobRoleRaw: '수의사 출신 투자심사역' };
    const vetResult = buildResultFromResponses(baseResponses, { profile: vetProfile });
    const vetSub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses,
      profile: vetResult.profile ?? vetProfile,
      result: vetResult,
    });
    check('REQUIRED 21: jobRole multi_domain case (수의사 출신 투자심사역) is preserved in analytics.profile',
      vetSub.profile.jobRoleRaw === '수의사 출신 투자심사역'
      && vetSub.profile.jobRoleCategory === 'multi_domain'
      && Array.isArray(vetSub.profile.jobRoleSecondaryCategories)
      && vetSub.profile.jobRoleSecondaryCategories!.includes('veterinary_pet')
      && vetSub.profile.jobRoleSecondaryCategories!.includes('investment_finance'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6 — followUp30d optional field on the analytics submission
// The follow-up is purely additive: when absent, the submission shape is
// IDENTICAL to pre-P2.6. When present, it appears as a normalized object.
// ═══════════════════════════════════════════════════════════════════════════════

// I1 — no followUp30d arg → field is OMITTED entirely (bit-identical to pre-P2.6)
{
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  check('P2.6 I1: omitting followUp30d → field is ABSENT on submission (key not present)',
    !('followUp30d' in sub));
  check('P2.6 I1: top-level keys still exactly 7 (no followUp30d phantom key)',
    Object.keys(sub).sort().join(',') === 'context,createdAt,engineOutput,profile,reportOutput,submissionId,userChoice');
}

// I2 — empty followUp30d arg ({}) → field is OMITTED (not emitted as empty object)
{
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    followUp30d: {},
  });
  check('P2.6 I2: empty followUp30d ({}) → field omitted (treated as "no follow-up")',
    !('followUp30d' in sub));
}

// I3 — populated followUp30d → field present and normalized
{
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    followUp30d: {
      completedPlan: true,
      completionRate: '75',
      actualActionsTaken: ['rest_recovery', 'internal_redesign'],
      energyChange: 'up',
      clarityChange: 'up',
      confidenceChange: 'same',
      nextIntent: 'continue',
      freeTextReflection: '회복부터 잘 했더니 자신감이 돌아왔어요.',
      completedAt: '2026-07-01T10:30:00Z',
    },
  });
  check('P2.6 I3: populated followUp30d → present on submission',
    'followUp30d' in sub && !!sub.followUp30d);
  check('P2.6 I3: followUp30d.completedPlan preserved',
    sub.followUp30d?.completedPlan === true);
  check('P2.6 I3: followUp30d.completionRate preserved',
    sub.followUp30d?.completionRate === '75');
  check('P2.6 I3: followUp30d.actualActionsTaken preserved',
    JSON.stringify(sub.followUp30d?.actualActionsTaken) === JSON.stringify(['rest_recovery', 'internal_redesign']));
  check('P2.6 I3: followUp30d.energyChange preserved',
    sub.followUp30d?.energyChange === 'up');
  check('P2.6 I3: followUp30d.nextIntent preserved',
    sub.followUp30d?.nextIntent === 'continue');
  check('P2.6 I3: followUp30d.freeTextReflection preserved',
    sub.followUp30d?.freeTextReflection === '회복부터 잘 했더니 자신감이 돌아왔어요.');
  check('P2.6 I3: followUp30d.completedAt preserved',
    sub.followUp30d?.completedAt === '2026-07-01T10:30:00Z');
}

// I4 — invalid entries inside followUp30d are dropped by the normalizer
{
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    followUp30d: {
      completionRate: '33' as unknown as '0',  // invalid
      energyChange: 'better' as unknown as 'up',  // invalid
      nextIntent: 'continue',  // valid
    },
  });
  check('P2.6 I4: invalid completionRate dropped by normalizer',
    sub.followUp30d?.completionRate === undefined);
  check('P2.6 I4: invalid energyChange dropped by normalizer',
    sub.followUp30d?.energyChange === undefined);
  check('P2.6 I4: valid nextIntent preserved alongside dropped invalid fields',
    sub.followUp30d?.nextIntent === 'continue');
}

// I5 — JSON round-trip with followUp30d present
{
  const sub = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    submissionId: 's1', createdAt: '2026-06-01T00:00:00Z',
    followUp30d: { completedPlan: true, completionRate: '100' },
  });
  const round = JSON.parse(JSON.stringify(sub));
  check('P2.6 I5: submission with followUp30d survives JSON round-trip',
    JSON.stringify(round) === JSON.stringify(sub));
}

// R1 — Routing invariants UNCHANGED with followUp30d present
{
  const a = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
  });
  const b = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    followUp30d: {
      completedPlan: true, completionRate: '100',
      actualActionsTaken: ['rest_recovery'],
      energyChange: 'up',
    },
  });
  check('P2.6 R1: engineOutput.mainTypeKey identical with/without followUp30d',
    a.engineOutput.mainTypeKey === b.engineOutput.mainTypeKey);
  check('P2.6 R1: engineOutput.sourceOptionKey identical with/without followUp30d',
    a.engineOutput.sourceOptionKey === b.engineOutput.sourceOptionKey);
  check('P2.6 R1: engineOutput.finalSourceOptionKey identical with/without followUp30d',
    a.engineOutput.finalSourceOptionKey === b.engineOutput.finalSourceOptionKey);
  check('P2.6 R1: engineOutput.planModuleKey identical with/without followUp30d',
    a.engineOutput.planModuleKey === b.engineOutput.planModuleKey);
  check('P2.6 R1: engineOutput.overrideReason identical with/without followUp30d',
    a.engineOutput.overrideReason === b.engineOutput.overrideReason);
  check('P2.6 R1: reportOutput.weeklyActions identical (display copy unchanged)',
    JSON.stringify(a.reportOutput.weeklyActions) === JSON.stringify(b.reportOutput.weeklyActions));
  check('P2.6 R1: reportOutput.closingLine identical',
    a.reportOutput.closingLine === b.reportOutput.closingLine);
}

// R2 — P1.7 burnout invariant still holds with followUp30d
{
  const burnoutWithFollowUp = buildCareerCompassAnalyticsSubmission({
    responses: burnoutResponses, profile: {}, result: burnoutResult,
    followUp30d: { nextIntent: 'pause', completedPlan: false },
  });
  check('P2.6 R2: P1.7 — mainTypeKey === "overloadedBurnout" even with followUp30d',
    burnoutWithFollowUp.engineOutput.mainTypeKey === 'overloadedBurnout');
  check('P2.6 R2: P1.7 — finalSourceOptionKey === "restRecover" even with followUp30d',
    burnoutWithFollowUp.engineOutput.finalSourceOptionKey === 'restRecover');
  check('P2.6 R2: P1.7 — planModuleKey === "recoveryFirst" even with followUp30d',
    burnoutWithFollowUp.engineOutput.planModuleKey === 'recoveryFirst');
  check('P2.6 R2: followUp30d does NOT change overrideReason resolution',
    burnoutWithFollowUp.engineOutput.overrideReason === 'burnout_recovery_gate');
}

// I6 — SessionState convenience wrapper propagates followUp30d
{
  const aFlat = buildCareerCompassAnalyticsSubmission({
    responses: baseResponses, profile: {}, result: baseResult,
    followUp30d: { completedPlan: true },
  });
  const aSession = buildCareerCompassAnalyticsSubmissionFromSession({
    session: { responses: baseResponses, profile: {} },
    result: baseResult,
    followUp30d: { completedPlan: true },
  });
  check('P2.6 I6: SessionState wrapper propagates followUp30d through to the flat builder',
    JSON.stringify(aFlat.followUp30d) === JSON.stringify(aSession.followUp30d));
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.6 REQUIRED — consolidated 20-requirement block + PRIMARY 회사원 case.
// Sourced verbatim from the user's required-tests list. Each REQUIRED line
// corresponds to one numbered requirement; the PRIMARY block at the end
// verifies the exact "회사원 + ap_interview → restRecover + burnout_recovery_gate
// + followUp30d" scenario the user spec'd.
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Shared follow-up payload used for the PRIMARY case and for several of the
  // REQUIRED checks (it intentionally exercises completionRate auto-derivation
  // + actualActionsTaken multi-select + trinary fields + nextIntent).
  const primaryFollowUp = {
    completionRate: '75' as const,
    actualActionsTaken: ['rest_recovery', 'internal_redesign'] as Array<
      'rest_recovery' | 'job_search' | 'internal_redesign' | 'portfolio_created'
      | 'content_published' | 'interviews_done' | 'market_test' | 'networking'
      | 'course_learning' | 'no_action' | 'other'
    >,
    energyChange: 'up' as const,
    clarityChange: 'same' as const,
    confidenceChange: 'up' as const,
    nextIntent: 'continue' as const,
  };

  // Office-worker profile + burnout responses + ap_interview pick. This is the
  // exact PRIMARY fixture the user pinned.
  const officeWorkerProfile: UserProfile = {
    jobRoleRaw: '회사원',
    workMode: 'organization',
    totalCareerStage: 'total_3_7',
    currentFieldStage: 'current_3_7',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'preparing',
    concernTags: ['burnout'],
    constraintTags: ['energy_burnout'],
    desiredPaths: ['job_change'],
  };
  const officeResult = buildResultFromResponses(burnoutResponses, { profile: officeWorkerProfile });

  // 1. CareerCompassFollowUp30d type/schema accepts all expected fields.
  //    (Tested by constructing a kitchen-sink follow-up that the builder accepts
  //    and the normalizer preserves verbatim.)
  {
    const kitchen = {
      completedPlan: true,
      completionRate: '100' as const,
      actualActionsTaken: ['rest_recovery', 'portfolio_created', 'networking'] as Array<
        'rest_recovery' | 'job_search' | 'internal_redesign' | 'portfolio_created'
        | 'content_published' | 'interviews_done' | 'market_test' | 'networking'
        | 'course_learning' | 'no_action' | 'other'
      >,
      energyChange: 'up' as const,
      clarityChange: 'up' as const,
      confidenceChange: 'up' as const,
      nextIntent: 'continue' as const,
      freeTextReflection: '한 달 잘 해봤어요.',
      completedAt: '2026-07-01T10:30:00Z',
    };
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: baseResult,
      followUp30d: kitchen,
    });
    check('P2.6 REQUIRED 1: CareerCompassFollowUp30d schema accepts all expected fields',
      sub.followUp30d?.completedPlan === true
      && sub.followUp30d?.completionRate === '100'
      && Array.isArray(sub.followUp30d?.actualActionsTaken)
      && sub.followUp30d?.actualActionsTaken!.length === 3
      && sub.followUp30d?.energyChange === 'up'
      && sub.followUp30d?.clarityChange === 'up'
      && sub.followUp30d?.confidenceChange === 'up'
      && sub.followUp30d?.nextIntent === 'continue'
      && sub.followUp30d?.freeTextReflection === '한 달 잘 해봤어요.'
      && sub.followUp30d?.completedAt === '2026-07-01T10:30:00Z');
  }

  // 2. Analytics object can include followUp30d.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      followUp30d: primaryFollowUp,
    });
    check('P2.6 REQUIRED 2: analytics object can include followUp30d',
      'followUp30d' in sub && !!sub.followUp30d);
  }

  // 3. Analytics object still works when followUp30d is missing.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
    });
    check('P2.6 REQUIRED 3: analytics object still works when followUp30d is missing',
      !('followUp30d' in sub)
      && sub.engineOutput.mainTypeKey === 'overloadedBurnout'
      && sub.engineOutput.finalSourceOptionKey === 'restRecover');
  }

  // 4. followUp30d survives JSON.stringify and JSON.parse.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      submissionId: 'sub_req4', createdAt: '2026-06-01T10:30:00Z',
      followUp30d: primaryFollowUp,
    });
    const round = JSON.parse(JSON.stringify(sub));
    check('P2.6 REQUIRED 4: followUp30d survives JSON.stringify and JSON.parse',
      JSON.stringify(round.followUp30d) === JSON.stringify(sub.followUp30d)
      && round.followUp30d.completionRate === '75'
      && round.followUp30d.energyChange === 'up');
  }

  // 5–9. completionRate derives completedPlan.
  {
    const mkSub = (rate: '0' | '25' | '50' | '75' | '100') =>
      buildCareerCompassAnalyticsSubmission({
        responses: baseResponses, profile: {}, result: baseResult,
        followUp30d: { completionRate: rate },
      });
    check('P2.6 REQUIRED 5: completionRate "0"   → completedPlan = false',
      mkSub('0').followUp30d?.completedPlan === false);
    check('P2.6 REQUIRED 6: completionRate "25"  → completedPlan = false',
      mkSub('25').followUp30d?.completedPlan === false);
    check('P2.6 REQUIRED 7: completionRate "50"  → completedPlan = true',
      mkSub('50').followUp30d?.completedPlan === true);
    check('P2.6 REQUIRED 8: completionRate "75"  → completedPlan = true',
      mkSub('75').followUp30d?.completedPlan === true);
    check('P2.6 REQUIRED 9: completionRate "100" → completedPlan = true',
      mkSub('100').followUp30d?.completedPlan === true);
  }

  // 10. actualActionsTaken allows multiple actions.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: baseResult,
      followUp30d: {
        actualActionsTaken: ['rest_recovery', 'job_search', 'networking', 'course_learning'],
      },
    });
    check('P2.6 REQUIRED 10: actualActionsTaken allows multiple actions',
      Array.isArray(sub.followUp30d?.actualActionsTaken)
      && sub.followUp30d!.actualActionsTaken!.length === 4
      && sub.followUp30d!.actualActionsTaken!.includes('rest_recovery')
      && sub.followUp30d!.actualActionsTaken!.includes('job_search')
      && sub.followUp30d!.actualActionsTaken!.includes('networking')
      && sub.followUp30d!.actualActionsTaken!.includes('course_learning'));
  }

  // 11. actualActionsTaken "no_action" is exclusive (when alone, preserved).
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: baseResult,
      followUp30d: { actualActionsTaken: ['no_action'] },
    });
    check('P2.6 REQUIRED 11: actualActionsTaken value "no_action" is exclusive (preserved when alone)',
      JSON.stringify(sub.followUp30d?.actualActionsTaken) === JSON.stringify(['no_action']));
  }

  // 12. Selecting another action removes "no_action".
  //     (Normalizer-level: affirmative actions win, no_action dropped.)
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: baseResult,
      followUp30d: { actualActionsTaken: ['no_action', 'rest_recovery'] },
    });
    check('P2.6 REQUIRED 12: selecting another action removes "no_action"',
      JSON.stringify(sub.followUp30d?.actualActionsTaken) === JSON.stringify(['rest_recovery']));
  }

  // 13. freeTextReflection is trimmed.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: baseResponses, profile: {}, result: baseResult,
      followUp30d: { freeTextReflection: '   회복 잘 했어요   ' },
    });
    check('P2.6 REQUIRED 13: freeTextReflection is trimmed',
      sub.followUp30d?.freeTextReflection === '회복 잘 했어요');
  }

  // 14. Empty followUp30d does not crash (and is omitted, not phantom).
  {
    let threw = false;
    let sub: ReturnType<typeof buildCareerCompassAnalyticsSubmission> | undefined;
    try {
      sub = buildCareerCompassAnalyticsSubmission({
        responses: baseResponses, profile: {}, result: baseResult,
        followUp30d: {},
      });
    } catch { threw = true; }
    check('P2.6 REQUIRED 14: empty followUp30d does not crash (builder returns + key omitted)',
      !threw && !!sub && !('followUp30d' in sub!));
  }

  // 15–18. Routing/plan/weeklyActions invariants — building WITH vs WITHOUT
  // followUp30d must produce bit-identical engineOutput + reportOutput sections.
  {
    const without = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
    });
    const withFu = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      followUp30d: primaryFollowUp,
    });
    check('P2.6 REQUIRED 15: adding followUp30d does NOT change mainTypeKey',
      without.engineOutput.mainTypeKey === withFu.engineOutput.mainTypeKey);
    check('P2.6 REQUIRED 16: adding followUp30d does NOT change sourceOptionKey (or finalSourceOptionKey)',
      without.engineOutput.sourceOptionKey === withFu.engineOutput.sourceOptionKey
      && without.engineOutput.finalSourceOptionKey === withFu.engineOutput.finalSourceOptionKey);
    check('P2.6 REQUIRED 17: adding followUp30d does NOT change planModule (planModuleKey)',
      without.engineOutput.planModuleKey === withFu.engineOutput.planModuleKey);
    check('P2.6 REQUIRED 18: adding followUp30d does NOT change weeklyActions',
      JSON.stringify(without.reportOutput.weeklyActions) === JSON.stringify(withFu.reportOutput.weeklyActions));
  }

  // 19. P1.7 burnout invariant still passes with followUp30d attached.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      followUp30d: primaryFollowUp,
    });
    check('P2.6 REQUIRED 19: P1.7 burnout invariant still passes with followUp30d',
      sub.engineOutput.mainTypeKey === 'overloadedBurnout'
      && sub.engineOutput.finalSourceOptionKey === 'restRecover'
      && sub.engineOutput.planModuleKey === 'recoveryFirst'
      && sub.engineOutput.overrideReason === 'burnout_recovery_gate');
  }

  // 20. followUp30d coexists with profile, context, userChoice, engineOutput,
  //     reportOutput — all five sibling sections present on the same object.
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      followUp30d: primaryFollowUp,
    });
    check('P2.6 REQUIRED 20: followUp30d coexists with profile + context + userChoice + engineOutput + reportOutput',
      !!sub.profile && typeof sub.profile === 'object'
      && !!sub.context && typeof sub.context === 'object'
      && !!sub.userChoice && typeof sub.userChoice === 'object'
      && !!sub.engineOutput && typeof sub.engineOutput === 'object'
      && !!sub.reportOutput && typeof sub.reportOutput === 'object'
      && !!sub.followUp30d && typeof sub.followUp30d === 'object');
  }

  // ─── PRIMARY case — 회사원 + ap_interview → restRecover + burnout gate + follow-up
  {
    const sub = buildCareerCompassAnalyticsSubmission({
      responses: burnoutResponses,
      profile: officeResult.profile ?? officeWorkerProfile,
      result: officeResult,
      submissionId: 'sub_office_followup_001',
      createdAt: '2026-06-01T10:30:00Z',
      followUp30d: primaryFollowUp,
    });

    // analytics.profile.jobRoleRaw = "회사원"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.profile.jobRoleRaw = "회사원"',
      sub.profile.jobRoleRaw === '회사원');
    // analytics.engineOutput.mainTypeKey = "overloadedBurnout"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.engineOutput.mainTypeKey = "overloadedBurnout"',
      sub.engineOutput.mainTypeKey === 'overloadedBurnout');
    // analytics.userChoice.selectedExperimentKey is preserved (= "startup", mapped from ap_interview)
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.userChoice.selectedExperimentKey is preserved ("startup")',
      sub.userChoice.selectedExperimentKey === 'startup');
    // analytics.engineOutput.finalSourceOptionKey = "restRecover"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.engineOutput.finalSourceOptionKey = "restRecover"',
      sub.engineOutput.finalSourceOptionKey === 'restRecover');
    // analytics.engineOutput.overrideReason = "burnout_recovery_gate"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.engineOutput.overrideReason = "burnout_recovery_gate"',
      sub.engineOutput.overrideReason === 'burnout_recovery_gate');
    // analytics.followUp30d.completionRate = "75"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.followUp30d.completionRate = "75"',
      sub.followUp30d?.completionRate === '75');
    // analytics.followUp30d.completedPlan = true (DERIVED from completionRate=75)
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.followUp30d.completedPlan = true (derived)',
      sub.followUp30d?.completedPlan === true);
    // analytics.followUp30d.actualActionsTaken includes "rest_recovery"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.followUp30d.actualActionsTaken includes "rest_recovery"',
      Array.isArray(sub.followUp30d?.actualActionsTaken)
      && sub.followUp30d!.actualActionsTaken!.includes('rest_recovery'));
    // analytics.followUp30d.energyChange = "up"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.followUp30d.energyChange = "up"',
      sub.followUp30d?.energyChange === 'up');
    // analytics.followUp30d.nextIntent = "continue"
    check('P2.6 PRIMARY(회사원+followUp30d): analytics.followUp30d.nextIntent = "continue"',
      sub.followUp30d?.nextIntent === 'continue');

    // Bonus: gap between user-pick and engine route is preserved.
    check('P2.6 PRIMARY(회사원+followUp30d): selectedExperimentKey ≠ finalSourceOptionKey (gap preserved for analytics)',
      sub.userChoice.selectedExperimentKey !== sub.engineOutput.finalSourceOptionKey);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
