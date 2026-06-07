// Headless tests for the ADR-001 narrative payload builder.
// Run: node --experimental-strip-types src/lib/narrativePayload.test.ts

import { buildNarrativePayload } from './narrativePayload.ts';
import { buildResultFromResponses } from '../components/careerCompassV2/session.ts';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import type { UserProfile } from '../types/careerCompass.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const RESPONSES: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_expand'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_founder'] },
  cv_values: { selectedOptionIds: ['cv_money', 'cv_expertise'] },
  cv_priorities: { ranking: ['pr_money', 'pr_meaning'] },
  fc_1: { selectedOptionIds: ['fc1_connector'] },
  fc_2: { selectedOptionIds: ['fc2_builder'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] },
  fc_4: { selectedOptionIds: ['fc4_maker'] },
  sc_outlook: { selectedOptionIds: ['sc_both'] },
  rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_3to6'] },
  rc_energy: { selectedOptionIds: ['rc_energy_high'] },
  rc_risk: { selectedOptionIds: ['rc_risk_income'] },
  rc_validation: { selectedOptionIds: ['rc_val_early'] },
  or_content: { selectedOptionIds: ['orc_money_tiring'] },
  or_venture: { selectedOptionIds: ['orv_meaning_money'] },
  or_internal: { selectedOptionIds: ['ori_capable_flat'] },
  ap_experiment: { selectedOptionIds: ['ap_content'] },
};

// A1 fixture — the founder's vet example: licensed profession, 2y current / 10y total.
const VET_PROFILE: UserProfile = {
  jobRoleRaw: '수의사',
  jobRoleCategory: 'veterinarian',
  ageBand: '30_late',
  workMode: 'professional',
  totalCareerStage: 'total_7_12',
  currentFieldStage: 'current_1_3',
  concernFreeText: '  전문직인데 더 큰 일을 하고 싶어요  ',
};

{
  const spine = buildResultFromResponses(RESPONSES, { profile: VET_PROFILE });
  const p = buildNarrativePayload(spine, VET_PROFILE, RESPONSES);

  check('profile: jobRoleRaw verbatim', p.profile.jobRoleRaw === '수의사');
  check('profile: licensed category → 전문직(자격 기반)', p.profile.jobRoleTraits === '전문직(자격 기반)');
  check('profile: A1 cross-reference material present (total vs current stage)',
    p.profile.totalCareerStage === '총 경력 7~12년' && p.profile.currentFieldStage === '현 분야 1~3년');
  check('recommendation: labels mirror the spine',
    p.recommendation.currentBestMove === spine.currentBestMove.label
    && p.recommendation.coreExperiment === spine.executionPlan.coreExperiment.label
    && p.recommendation.confidenceBand === spine.evidence.confidenceBand);
  check('recommendation: blocker text carries no arrow notation',
    !JSON.stringify(p.recommendation).includes('→'));
  check('answerHighlights: option labels, not ids',
    p.answerHighlights.some((h) => h.includes('전문가') && h.includes('창업가'))
    && !p.answerHighlights.some((h) => h.includes('ar_expert')));
  check('answerHighlights: ranking rendered in order with >',
    p.answerHighlights.some((h) => h.includes('우선순위') && h.includes(' > ')));
  check('answerHighlights: revealed preference (직접 고른 실험) included',
    p.answerHighlights.some((h) => h.includes('직접 고른 30일 실험')));
  check('userConcern: trimmed and present', p.userConcern === '전문직인데 더 큰 일을 하고 싶어요');
  check('constructSignals: human labels with 높음/낮음',
    p.constructSignals.every((s) => s.endsWith('높음') || s.endsWith('낮음')));

  check('spine carries narrativeSeed (additive)', !!spine.narrativeSeed
    && spine.narrativeSeed.recommendation.currentBestMove === spine.currentBestMove.label);
}

{
  // Non-licensed role + no concern → optional fields absent.
  const profile: UserProfile = { jobRoleRaw: '마케터', jobRoleCategory: 'marketing' };
  const spine = buildResultFromResponses(RESPONSES, { profile });
  const p = buildNarrativePayload(spine, profile, RESPONSES);
  check('non-licensed category → 일반 직군', p.profile.jobRoleTraits === '일반 직군');
  check('no concern → userConcern absent', !('userConcern' in p));
}

{
  // Empty profile/responses must not throw and must stay minimal.
  const spine = buildResultFromResponses(RESPONSES, {});
  const p = buildNarrativePayload(spine, {}, {} as FlowResponses);
  check('empty inputs: no highlights, no profile labels, no crash',
    p.answerHighlights.length === 0 && Object.keys(p.profile).length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
