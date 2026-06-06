// Realistic mock response sets for headless end-to-end testing of the flow + engines.
// Cards are looked up from the real flow (findOption) so examples stay in sync.

import type { ChoiceOption, CareerOptionKey } from '../types/careerCompass.ts';
import { findOption, EXPERIMENT_OPTION_BY_CARD } from './careerQuestionFlow.ts';

export interface MockResponseSet {
  name: string;
  cards: ChoiceOption[];          // every non-ranking selection (incl. reality-check band cards)
  rankedValues: ChoiceOption[];   // cv_priorities, in rank order (rank1 first)
  preferredExperimentOptionKey: CareerOptionKey; // from the chosen action card
}

const o = findOption;
const expOption = (apCardId: string): CareerOptionKey => EXPERIMENT_OPTION_BY_CARD[apCardId];

// 1. High-expertise market-interpreter type with moderate recovery need.
const expertInterpreter: MockResponseSet = {
  name: 'expert market-interpreter (moderate recovery)',
  cards: [
    o('cs_main', 'cs_expand'),
    o('ar_roles', 'ar_expert'), o('ar_roles', 'ar_analyst'), o('ar_roles', 'ar_advisor'),
    o('cv_values', 'cv_expertise'), o('cv_values', 'cv_impact'), o('cv_values', 'cv_knowledge'), o('cv_values', 'cv_money'),
    o('fc_1', 'fc1_connector'),
    o('fc_2', 'fc2_stable'),
    o('fc_3', 'fc3_public'),
    o('fc_4', 'fc4_interpreter'),
    o('sc_outlook', 'sc_both'),           // high self-efficacy + outcome expectation
    o('rc_options', 'rc_opt_some'),       // 1~2 options (default — does not move identity axes)
    o('rc_runway', 'rc_runway_6to12'),   // comfortable
    o('rc_energy', 'rc_energy_ok'),       // steady → moderate recovery
    o('rc_risk', 'rc_risk_cost'),         // smallCost
    o('rc_validation', 'rc_val_partial'), // partial
    o('or_content', 'orc_meaning_money'),
    o('or_venture', 'orv_capable_flat'),
    o('or_internal', 'ori_unsure'),
    o('ap_experiment', 'ap_writing'),     // 글/리포트/메모 → investAnalysis
  ],
  rankedValues: [
    o('cv_priorities', 'pr_growth'),
    o('cv_priorities', 'pr_meaning'),
    o('cv_priorities', 'pr_money'),
    o('cv_priorities', 'pr_influence'),
    o('cv_priorities', 'pr_stability'),
  ],
  preferredExperimentOptionKey: expOption('ap_writing'),
};

// 2. High-venture type but low runway / high market-validation need.
const ventureLowRunway: MockResponseSet = {
  name: 'high-venture, low runway, high validation need',
  cards: [
    o('cs_main', 'cs_between'),
    o('ar_roles', 'ar_founder'), o('ar_roles', 'ar_freelancer'),
    o('cv_values', 'cv_autonomy'), o('cv_values', 'cv_money'), o('cv_values', 'cv_problem'), o('cv_values', 'cv_bigmarket'),
    o('fc_1', 'fc1_connector'),
    o('fc_2', 'fc2_builder'),
    o('fc_3', 'fc3_public'),
    o('fc_4', 'fc4_maker'),
    o('sc_outlook', 'sc_self_only'),      // confident, but market response unknown
    o('rc_options', 'rc_opt_some'),      // 1~2 options
    o('rc_runway', 'rc_runway_1to3'),    // tight (low runway)
    o('rc_energy', 'rc_energy_capacity'), // capacity
    o('rc_risk', 'rc_risk_time'),        // timeOnly (low)
    o('rc_validation', 'rc_val_none'),   // unvalidated (high validation need)
    o('or_content', 'orc_money_tiring'),
    o('or_venture', 'orv_energized'),
    o('or_internal', 'ori_unsure'),
    o('ap_experiment', 'ap_interview'),  // → startup
  ],
  rankedValues: [
    o('cv_priorities', 'pr_money'),
    o('cv_priorities', 'pr_freedom'),
    o('cv_priorities', 'pr_growth'),
    o('cv_priorities', 'pr_influence'),
  ],
  preferredExperimentOptionKey: expOption('ap_interview'),
};

// 3. Recovery-first professional who should NOT start a heavy new project now.
const recoveryFirst: MockResponseSet = {
  name: 'recovery-first (should not start a heavy project now)',
  cards: [
    o('cs_main', 'cs_rest'),
    o('ar_roles', 'ar_reset'), o('ar_roles', 'ar_expert'),
    o('cv_values', 'cv_recovery'), o('cv_values', 'cv_stability'), o('cv_values', 'cv_expertise'),
    o('fc_1', 'fc1_expert'),
    o('fc_2', 'fc2_stable'),
    o('fc_3', 'fc3_quiet'),
    o('fc_4', 'fc4_interpreter'),
    o('sc_outlook', 'sc_unsure'),         // low confidence, readiness gap
    o('rc_options', 'rc_opt_some'),      // 1~2 options
    o('rc_runway', 'rc_runway_3to6'),    // moderate
    o('rc_energy', 'rc_energy_rest'),     // depleted (severe burnout)
    o('rc_risk', 'rc_risk_none'),         // none
    o('rc_validation', 'rc_val_none'),   // unvalidated
    o('or_content', 'orc_capable_flat'),
    o('or_venture', 'orv_money_tiring'),
    o('or_internal', 'ori_unsure'),
    o('ap_experiment', 'ap_rest'),        // → restRecover
  ],
  rankedValues: [
    o('cv_priorities', 'pr_recovery'),
    o('cv_priorities', 'pr_stability'),
    o('cv_priorities', 'pr_meaning'),
  ],
  preferredExperimentOptionKey: expOption('ap_rest'),
};

// 4. All-green: every option is viable (healthy gates). This is the case that used to
// fabricate a NEGATIVE condition under the promotion sentence — now promotion is empty
// and the negative evidence renders only in the warning section.
const allGreen: MockResponseSet = {
  name: 'all-green (everything viable — old promotion-fallback bug case)',
  cards: [
    o('cs_main', 'cs_expand'),
    o('ar_roles', 'ar_expert'), o('ar_roles', 'ar_advisor'),
    o('cv_values', 'cv_expertise'), o('cv_values', 'cv_impact'),
    o('fc_1', 'fc1_expert'), o('fc_2', 'fc2_stable'), o('fc_3', 'fc3_public'), o('fc_4', 'fc4_interpreter'),
    o('sc_outlook', 'sc_both'),
    o('rc_options', 'rc_opt_some'),       // 1~2 options
    o('rc_runway', 'rc_runway_1y'),       // extended
    o('rc_energy', 'rc_energy_high'),      // high
    o('rc_risk', 'rc_risk_income'),        // incomeDrop
    o('rc_validation', 'rc_val_done'),     // validated
    o('or_content', 'orc_energized'),
    o('or_venture', 'orv_energized'),
    o('or_internal', 'ori_unsure'),
    o('ap_experiment', 'ap_portfolio'),    // 포트폴리오/케이스 → advisoryTeaching
  ],
  rankedValues: [
    o('cv_priorities', 'pr_growth'),
    o('cv_priorities', 'pr_meaning'),
    o('cv_priorities', 'pr_money'),
  ],
  preferredExperimentOptionKey: expOption('ap_portfolio'),
};

// 5. Creator-heavy but low market validation — true-fit direction (content) is gated
// to conditional, so the practical now move is a safer bridge.
const creatorLowValidation: MockResponseSet = {
  name: 'creator-heavy, low market validation',
  cards: [
    o('cs_main', 'cs_many'),
    o('ar_roles', 'ar_creator'), o('ar_roles', 'ar_freelancer'), o('ar_roles', 'ar_founder'),
    o('cv_values', 'cv_creativity'), o('cv_values', 'cv_impact'), o('cv_values', 'cv_autonomy'), o('cv_values', 'cv_meaning'),
    o('fc_1', 'fc1_connector'), o('fc_2', 'fc2_builder'), o('fc_3', 'fc3_public'), o('fc_4', 'fc4_maker'),
    o('sc_outlook', 'sc_self_only'),
    o('rc_options', 'rc_opt_some'),       // 1~2 options
    o('rc_runway', 'rc_runway_3to6'),    // moderate
    o('rc_energy', 'rc_energy_capacity'), // capacity
    o('rc_risk', 'rc_risk_exp'),          // experiment-tolerant
    o('rc_validation', 'rc_val_none'),    // unvalidated (the key constraint)
    o('or_content', 'orc_energized'),
    o('or_venture', 'orv_energized'),
    o('or_internal', 'ori_unsure'),
    o('ap_experiment', 'ap_content'),     // → contentBrand
  ],
  rankedValues: [
    o('cv_priorities', 'pr_freedom'),
    o('cv_priorities', 'pr_meaning'),
    o('cv_priorities', 'pr_growth'),
  ],
  preferredExperimentOptionKey: expOption('ap_content'),
};

export const MOCK_RESPONSE_SETS: MockResponseSet[] = [expertInterpreter, ventureLowRunway, recoveryFirst, allGreen, creatorLowValidation];
