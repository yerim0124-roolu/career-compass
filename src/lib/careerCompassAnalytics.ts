// Career Compass 2.0 — P2.5 Analytics Submission builder.
//
// A pure transform: (responses, profile, result) → CareerCompassAnalyticsSubmission.
// The submission is the canonical "what the user submitted + what the engine
// decided + what the user saw" record for future analytics, 30-day follow-up,
// and aggregation. P2.5 only builds the object — it does not transmit,
// persist, or otherwise consume it.
//
// ─── HARD INVARIANTS ──────────────────────────────────────────────────────────
// The builder is a pure function. It MUST NOT:
//   • write to localStorage
//   • send network requests
//   • mutate `result`, `profile`, or `responses`
//   • call the engine again (no buildResultSpine / buildResultFromResponses
//     re-invocation; routing fields are passed through from the given `result`)
//   • change any routing field (mainTypeKey / sourceOptionKey / planModule /
//     activeLenses / bestMove / closingLine / P1.7 invariant / profile
//     context summary behavior / jobRoleNormalizer routing behavior).
//
// ─── OUTPUT IS PLAIN JSON ───────────────────────────────────────────────────
// Every emitted value is a primitive, array of primitives, or plain object.
// No undefined keys, no Date instances, no functions, no Symbols. Optional
// fields are OMITTED from the output when they have no value (so the
// JSON.stringify of an empty profile shows no phantom keys).

import type { FlowResponses, SessionState } from '../components/careerCompassV2/session.ts';
import type { ResultSpine, UserProfile } from '../types/careerCompass.ts';
import { EXPERIMENT_LABEL_BY_CARD, EXPERIMENT_OPTION_BY_CARD } from '../data/careerQuestionFlow.ts';
import type { CareerCompassFollowUp30d } from './careerCompassFollowUp30d.ts';
import { normalizeFollowUp30d, isFollowUp30dEmpty } from './careerCompassFollowUp30d.ts';

// Re-export the follow-up surface so analytics callers can import everything
// from one entry point.
export type { CareerCompassFollowUp30d } from './careerCompassFollowUp30d.ts';

// ─── overrideReason — categorical labels for why the engine diverged from
//   the user's pick (or fell back to a plan-module default). 'none' means the
//   user's pick is the same as the engine's final and no protective routing
//   rule fired. The union enumerates KNOWN reasons; the detector currently
//   produces the first three plus 'none', leaving 'plan_module_widening' and
//   'cross_product_strategy_bridge' for future expansion.
export type AnalyticsOverrideReason =
  | 'none'
  | 'burnout_recovery_gate'
  | 'ap_unsure_plan_module_fallback'
  | 'low_option_visibility_protection'
  | 'plan_module_widening'
  | 'cross_product_strategy_bridge';

// ─── CareerCompassAnalyticsSubmission — user-prescribed shape ─────────────
export interface CareerCompassAnalyticsSubmission {
  submissionId: string;
  createdAt: string;        // ISO 8601 if provided by caller, '' otherwise

  // ─── Profile fields (string-valued; verbatim values per user spec) ──────
  // jobRoleRaw IS included verbatim per the spec — callers that need PII
  // protection must redact upstream of this builder.
  profile: {
    ageBand?: string;
    jobRoleRaw?: string;
    jobRoleCategory?: string;
    jobRoleSubcategory?: string;
    jobRoleSecondaryCategories?: string[];
    totalCareerStage?: string;
    currentFieldStage?: string;
    priorFieldExperience?: string;
    careerPattern?: string;
    workMode?: string;
    transitionTiming?: string;
    transitionIntent?: string;
  };

  // ─── Context tags (the three multi-select tag arrays) ───────────────────
  context: {
    concernTags?: string[];
    constraintTags?: string[];
    desiredPaths?: string[];
  };

  // ─── User's recorded choice (which ap_experiment card they picked) ──────
  userChoice: {
    selectedExperimentKey?: string;    // option id (e.g. 'ap_interview')
    selectedExperimentLabel?: string;  // de-biased copy label
  };

  // ─── Engine's decisions ─────────────────────────────────────────────────
  engineOutput: {
    mainTypeKey: string;
    planModuleKey: string;
    // sourceOptionKey = user's resolved pick (mapped career option key) —
    // what the engine would default to in absence of any invariant override.
    sourceOptionKey: string;
    // finalSourceOptionKey = engine's final decision after invariants run.
    // Diverges from sourceOptionKey when overrideReason !== 'none'.
    finalSourceOptionKey: string;
    bestMoveKey?: string;
    strategicDirectionKey?: string;
    resultMode?: string;
    activeLenses: {
      essentialism: boolean;
      range: boolean;
      plannedHappenstance: boolean;
      jobCrafting: boolean;
    };
    supportTags: string[];
    overrideReason: AnalyticsOverrideReason;
  };

  // ─── What was actually rendered on the report screen ────────────────────
  reportOutput: {
    profileContextHeadline?: string;
    profileContextBody?: string;
    profileContextTags?: string[];
    identityStatement: string;
    strategyStatement: string;
    coreExperimentLabel: string;
    weeklyActions: string[];
    successSignals: string[];
    stopOrPivotCriteria: string[];
    reevaluationChecklist: string[];
    closingLine: string;
  };

  // ─── P2.6 — Optional 30-day follow-up snapshot (additive metadata) ─────────
  // Present only when the caller supplies a non-empty follow-up. NEVER consumed
  // by routing, classification, or any P1.x invariant — purely a data hand-off
  // for future analytics / 30-day re-engagement workflows.
  followUp30d?: CareerCompassFollowUp30d;
}

// ─── Input shapes ────────────────────────────────────────────────────────────

export interface BuildCareerCompassAnalyticsSubmissionArgs {
  responses: FlowResponses;
  profile: UserProfile;
  result: ResultSpine;
  createdAt?: string | Date;
  submissionId?: string;
  // P2.6 — Optional 30-day follow-up. When provided, the builder normalizes
  // it and (if non-empty after normalization) attaches it as
  // `submission.followUp30d`. Absent input means the field is omitted from
  // the output, so the no-followUp shape is bit-identical to pre-P2.6.
  followUp30d?: CareerCompassFollowUp30d;
}

export interface BuildCareerCompassAnalyticsSubmissionFromSessionArgs {
  session: SessionState;
  result: ResultSpine;
  createdAt?: string | Date;
  submissionId?: string;
  followUp30d?: CareerCompassFollowUp30d;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

// Add a field to an object only when its value is non-empty. Helps emit a
// clean JSON shape with no undefined keys.
function setIfPresent<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K] | undefined | null,
): void {
  if (value === undefined || value === null) return;
  if (typeof value === 'string' && value.length === 0) return;
  if (Array.isArray(value) && value.length === 0) return;
  obj[key] = value;
}

// ─── overrideReason derivation (user-spec precedence) ────────────────────────
// IMPORTANT: this function only DESCRIBES what already happened — it does not
// re-route, re-decide, or create new behavior. It reads the engine's emitted
// keys and labels the reason behind the divergence.
//
// Detection precedence (matches the user spec):
//   1. burnout_recovery_gate           — user picked an action, engine recovered
//   2. ap_unsure_plan_module_fallback  — user gave no clear pick
//   3. low_option_visibility_protection — protection routing fired
//   4. plan_module_widening            — NOT DETECTABLE from current schema
//   5. cross_product_strategy_bridge   — unvalidatedAspirant × portfolioConvert
//   6. none                            — default
//
// "If some of these signals are not currently available, implement the
// reasons that can be derived safely now, and leave the rest as 'none'
// rather than guessing." → plan_module_widening is left undetected. The
// analytics submission's planModuleKey is sourced from primaryModule.key, so
// there is no schema-level distinction between "engine widened" and "engine
// kept" within the submission alone. A future analytics layer that has
// access to engine internals can refine.
function deriveOverrideReason(args: {
  mainTypeKey: string;
  planModuleKey: string;
  selectedExperimentKey: string | undefined;
  finalSourceOptionKey: string;
  userPickedApUnsure: boolean;
  noApExperimentResponse: boolean;
}): AnalyticsOverrideReason {
  const {
    mainTypeKey, planModuleKey,
    selectedExperimentKey, finalSourceOptionKey,
    userPickedApUnsure, noApExperimentResponse,
  } = args;

  // 1. burnout_recovery_gate
  //    User picked an action-oriented experiment, but the engine forced
  //    recovery via the P1.7 burnout invariant. Detected by:
  //      mainTypeKey === 'overloadedBurnout'
  //      AND selectedExperimentKey !== undefined  (user actually picked)
  //      AND selectedExperimentKey !== finalSourceOptionKey  (engine overrode)
  //    A burnout user who picked ap_rest (mapped to 'restRecover') would have
  //    selectedExperimentKey === finalSourceOptionKey, so no override — 'none'.
  if (
    mainTypeKey === 'overloadedBurnout' &&
    selectedExperimentKey !== undefined &&
    selectedExperimentKey !== finalSourceOptionKey
  ) {
    return 'burnout_recovery_gate';
  }

  // 2. ap_unsure_plan_module_fallback
  //    User gave no clear pick (either explicitly chose ap_unsure or did not
  //    answer ap_experiment at all), AND the engine had to derive
  //    finalSourceOptionKey from the planModule fallback. selectedExperimentKey
  //    will be undefined whenever this applies (ap_unsure has no mapping in
  //    EXPERIMENT_OPTION_BY_CARD).
  if (
    selectedExperimentKey === undefined &&
    (userPickedApUnsure || noApExperimentResponse)
  ) {
    return 'ap_unsure_plan_module_fallback';
  }

  // 3. low_option_visibility_protection
  //    The lowOptionVisibility mainType ships with P1.2-era protective routing
  //    that prevents experiment-home fallback from leaking into the strategy.
  //    Detected by:
  //      mainTypeKey === 'lowOptionVisibility'
  //      AND selectedExperimentKey !== undefined
  //      AND selectedExperimentKey !== finalSourceOptionKey
  //    (without an actual divergence, no protection happened — just defaults.)
  if (
    mainTypeKey === 'lowOptionVisibility' &&
    selectedExperimentKey !== undefined &&
    selectedExperimentKey !== finalSourceOptionKey
  ) {
    return 'low_option_visibility_protection';
  }

  // 4. plan_module_widening  — NOT DETECTABLE from the submission alone (see
  //    function-level note above). Skip and fall through.

  // 5. cross_product_strategy_bridge
  //    P1.6 introduces the unvalidatedAspirant × portfolioConvert combined
  //    strategy. When both keys line up like this, the engine used the
  //    specific cross-product bridge — regardless of whether the user picked
  //    anything that would otherwise look like an override.
  if (mainTypeKey === 'unvalidatedAspirant' && planModuleKey === 'portfolioConvert') {
    return 'cross_product_strategy_bridge';
  }

  return 'none';
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildCareerCompassAnalyticsSubmission(
  args: BuildCareerCompassAnalyticsSubmissionArgs,
): CareerCompassAnalyticsSubmission {
  const { responses, profile, result, createdAt, submissionId } = args;

  // ─── Metadata ─────────────────────────────────────────────────────────────
  // submissionId and createdAt are typed as required strings in the output;
  // when the caller omits them, we emit '' (safer than undefined for JSON
  // serializers). Callers wanting non-empty values must inject them.
  const submissionIdStr = submissionId ?? '';
  const createdAtStr =
    createdAt === undefined
      ? ''
      : createdAt instanceof Date
        ? createdAt.toISOString()
        : createdAt;

  // ─── profile block (all fields optional, omit when absent) ───────────────
  const profileBlock: CareerCompassAnalyticsSubmission['profile'] = {};
  setIfPresent(profileBlock, 'ageBand', profile.ageBand ?? undefined);
  setIfPresent(profileBlock, 'jobRoleRaw',
    typeof profile.jobRoleRaw === 'string' ? profile.jobRoleRaw.trim() : undefined);
  setIfPresent(profileBlock, 'jobRoleCategory', profile.jobRoleCategory ?? undefined);
  setIfPresent(profileBlock, 'jobRoleSubcategory', profile.jobRoleSubcategory ?? undefined);
  setIfPresent(profileBlock, 'jobRoleSecondaryCategories',
    profile.jobRoleSecondaryCategories ? [...profile.jobRoleSecondaryCategories] : undefined);
  setIfPresent(profileBlock, 'totalCareerStage', profile.totalCareerStage ?? undefined);
  setIfPresent(profileBlock, 'currentFieldStage', profile.currentFieldStage ?? undefined);
  setIfPresent(profileBlock, 'priorFieldExperience', profile.priorFieldExperience ?? undefined);
  setIfPresent(profileBlock, 'careerPattern', profile.careerPattern ?? undefined);
  setIfPresent(profileBlock, 'workMode', profile.workMode ?? undefined);
  setIfPresent(profileBlock, 'transitionTiming', profile.transitionTiming ?? undefined);
  setIfPresent(profileBlock, 'transitionIntent', profile.transitionIntent ?? undefined);

  // ─── context block (3 tag arrays, omit empty ones) ──────────────────────
  const contextBlock: CareerCompassAnalyticsSubmission['context'] = {};
  setIfPresent(contextBlock, 'concernTags',
    profile.concernTags ? [...profile.concernTags] : undefined);
  setIfPresent(contextBlock, 'constraintTags',
    profile.constraintTags ? [...profile.constraintTags] : undefined);
  setIfPresent(contextBlock, 'desiredPaths',
    profile.desiredPaths ? [...profile.desiredPaths] : undefined);

  // ─── userChoice block (selectedExperimentKey + label) ────────────────────
  // CRITICAL DISTINCTION — preserve the gap between user intent and engine
  // recommendation:
  //   userChoice.selectedExperimentKey  = the MAPPED CareerOptionKey resolved
  //     from the user's ap_experiment card pick, via EXPERIMENT_OPTION_BY_CARD.
  //     E.g. ap_interview → "startup". This is what the user effectively
  //     CHOSE expressed in the career system's canonical vocabulary.
  //   engineOutput.finalSourceOptionKey = the engine's FINAL after invariants
  //     (P1.7 burnout, P1.2 low-option-visibility, etc.). E.g. for a burnout
  //     user who picked ap_interview, this becomes "restRecover".
  // These two fields must stay distinct so future analytics can measure the
  // "users who selected X but were routed to Y" gap (e.g. users who wanted
  // action-oriented experiments but needed recovery).
  // ap_unsure has no mapping → selectedExperimentKey absent.
  const userChoiceBlock: CareerCompassAnalyticsSubmission['userChoice'] = {};
  const apExperimentSelectedId = responses.ap_experiment?.selectedOptionIds?.[0];
  if (apExperimentSelectedId) {
    const mappedKey = EXPERIMENT_OPTION_BY_CARD[apExperimentSelectedId];
    setIfPresent(userChoiceBlock, 'selectedExperimentKey', mappedKey);
    // The label remains a card-level concept (display string the user saw on
    // the option card), so it's still indexed by the card id.
    setIfPresent(userChoiceBlock, 'selectedExperimentLabel',
      EXPERIMENT_LABEL_BY_CARD[apExperimentSelectedId]);
  }

  // ─── engineOutput block ──────────────────────────────────────────────────
  const mainTypeKey = result.solutionLayer.mainTypeKey;
  const planModuleKey = result.solutionLayer.primaryModule.key;
  const finalSourceOptionKey = result.executionPlan.coreExperiment.sourceOptionKey;
  // sourceOptionKey = the user's mapped pick (career option key from their
  // ap_experiment choice). When the user picked ap_unsure or skipped, fall
  // back to the engine's final so sourceOptionKey is always populated.
  const sourceOptionKey = result.userSelectedExperimentKey ?? finalSourceOptionKey;

  // Override-reason detection inputs — read from response data.
  const apExperimentResponse = responses.ap_experiment;
  const userPickedApUnsure =
    (apExperimentResponse?.selectedOptionIds ?? []).includes('ap_unsure');
  const noApExperimentResponse =
    !apExperimentResponse ||
    !apExperimentResponse.selectedOptionIds ||
    apExperimentResponse.selectedOptionIds.length === 0;
  // selectedExperimentKey from userChoice (after EXPERIMENT_OPTION_BY_CARD
  // mapping). When user picked ap_unsure or omitted ap_experiment, this is
  // undefined — which is the signal the detector uses.
  const selectedExperimentKeyForDetection = userChoiceBlock.selectedExperimentKey;

  const engineOutput: CareerCompassAnalyticsSubmission['engineOutput'] = {
    mainTypeKey,
    planModuleKey,
    sourceOptionKey,
    finalSourceOptionKey,
    activeLenses: {
      essentialism: !!result.executionPlan.activeLenses?.essentialism,
      range: !!result.executionPlan.activeLenses?.range,
      plannedHappenstance: !!result.executionPlan.activeLenses?.plannedHappenstance,
      jobCrafting: !!result.executionPlan.activeLenses?.jobCrafting,
    },
    supportTags: result.solutionLayer.supportTags ? [...result.solutionLayer.supportTags] : [],
    overrideReason: deriveOverrideReason({
      mainTypeKey,
      planModuleKey,
      selectedExperimentKey: selectedExperimentKeyForDetection,
      finalSourceOptionKey,
      userPickedApUnsure,
      noApExperimentResponse,
    }),
  };
  setIfPresent(engineOutput, 'bestMoveKey', result.currentBestMove?.optionKey);
  setIfPresent(engineOutput, 'strategicDirectionKey',
    result.strategicDirection?.optionKey ?? undefined);
  setIfPresent(engineOutput, 'resultMode', result.resultMode);

  // ─── reportOutput block (what the user actually saw) ─────────────────────
  const reportOutput: CareerCompassAnalyticsSubmission['reportOutput'] = {
    identityStatement: result.identityAxis.statement,
    strategyStatement: result.executionPlan.strategyStatement,
    coreExperimentLabel: result.executionPlan.coreExperiment.label,
    weeklyActions: result.executionPlan.weeklyActions
      ? result.executionPlan.weeklyActions.map((w) => w.action)
      : [],
    successSignals: result.executionPlan.successSignals
      ? [...result.executionPlan.successSignals]
      : [],
    stopOrPivotCriteria: result.executionPlan.stopOrPivotCriteria
      ? [...result.executionPlan.stopOrPivotCriteria]
      : [],
    reevaluationChecklist: result.executionPlan.reevaluationChecklist
      ? [...result.executionPlan.reevaluationChecklist]
      : [],
    closingLine: result.executionPlan.closingLine ?? '',
  };
  setIfPresent(reportOutput, 'profileContextHeadline', result.profileContext?.headline);
  setIfPresent(reportOutput, 'profileContextBody', result.profileContext?.body);
  setIfPresent(reportOutput, 'profileContextTags',
    result.profileContext?.tags ? [...result.profileContext.tags] : undefined);

  const submission: CareerCompassAnalyticsSubmission = {
    submissionId: submissionIdStr,
    createdAt: createdAtStr,
    profile: profileBlock,
    context: contextBlock,
    userChoice: userChoiceBlock,
    engineOutput,
    reportOutput,
  };

  // P2.6 — Attach normalized follow-up ONLY when the caller supplied a
  // non-empty payload. Empty / missing → field is omitted from the output so
  // pre-P2.6 callers see no change in submission shape.
  if (args.followUp30d) {
    const normalizedFollowUp = normalizeFollowUp30d(args.followUp30d);
    if (!isFollowUp30dEmpty(normalizedFollowUp)) {
      submission.followUp30d = normalizedFollowUp;
    }
  }

  return submission;
}

// Convenience wrapper for SessionState callers.
export function buildCareerCompassAnalyticsSubmissionFromSession(
  args: BuildCareerCompassAnalyticsSubmissionFromSessionArgs,
): CareerCompassAnalyticsSubmission {
  return buildCareerCompassAnalyticsSubmission({
    responses: args.session.responses,
    profile: args.session.profile,
    result: args.result,
    createdAt: args.createdAt,
    submissionId: args.submissionId,
    followUp30d: args.followUp30d,
  });
}
