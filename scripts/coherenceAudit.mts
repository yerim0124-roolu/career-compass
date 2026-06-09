// 정합성 점검 — 결과지의 여러 레이어가 한 이야기를 하는지 전수 덤프.
// 풀 세션 경로(buildResultFromResponses)로 통과시켜 중심축·프로필본문·유형·thesis·
// storyInsight·방향·솔루션·실험·근거를 한 화면에 모아 모순을 눈으로 잡는다.
// 실행: node --experimental-strip-types scripts/coherenceAudit.mts

import { buildResultFromResponses } from '../src/components/careerCompassV2/session.ts';
import type { FlowResponses } from '../src/components/careerCompassV2/session.ts';
import { MAIN_TYPE_NARRATIVES } from '../src/data/mainTypeNarratives.ts';
import type { UserProfile } from '../src/types/careerCompass.ts';

const sel = (...ids: string[]) => ({ selectedOptionIds: ids });
const rank = (...ids: string[]) => ({ ranking: ids });

interface P { name: string; profile: UserProfile; r: FlowResponses }

const personas: P[] = [
  {
    name: 'P1 수의사·메이커 끌림+가치충돌 (스크린샷류)',
    profile: { jobRoleRaw: '수의사', ageBand: '30_late', totalCareerStage: 'total_7_12', currentFieldStage: 'current_7_plus', workMode: 'professional', careerPattern: 'single_track', transitionTiming: 'now' },
    r: {
      cs_main: sel('cs_between'), ar_roles: sel('ar_founder', 'ar_creator'), cv_values: sel('cv_autonomy', 'cv_impact', 'cv_money'),
      cv_priorities: rank('pr_money', 'pr_influence', 'pr_meaning', 'pr_freedom', 'pr_stability'),
      fc_1: sel('fc1_connector'), fc_2: sel('fc2_builder'), fc_3: sel('fc3_public'), fc_4: sel('fc4_maker'), sc_outlook: sel('sc_self_only'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_6to12'), rc_energy: sel('rc_energy_ok'), rc_risk: sel('rc_risk_cost'), rc_validation: sel('rc_val_early'),
      or_content: sel('orc_energized'), or_venture: sel('orv_meaning_money'), or_internal: sel('ori_unsure'), cs_blocker: sel('blk_confidence'), ap_experiment: sel('ap_content'),
    },
  },
  {
    name: 'P2 리더 (emergingLeader)',
    profile: { jobRoleRaw: '팀장', ageBand: '40_early', totalCareerStage: 'total_12_plus', currentFieldStage: 'current_7_plus', workMode: 'organization', careerPattern: 'single_track', transitionTiming: 'within_3_6_months' },
    r: {
      cs_main: sel('cs_stay'), ar_roles: sel('ar_leader', 'ar_advisor'), cv_values: sel('cv_impact', 'cv_growth', 'cv_money'),
      cv_priorities: rank('pr_influence', 'pr_growth', 'pr_money', 'pr_meaning', 'pr_stability'),
      fc_1: sel('fc1_expert'), fc_2: sel('fc2_stable'), fc_3: sel('fc3_public'), fc_4: sel('fc4_interpreter'), sc_outlook: sel('sc_both'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_1y'), rc_energy: sel('rc_energy_ok'), rc_risk: sel('rc_risk_cost'), rc_validation: sel('rc_val_partial'),
      or_content: sel('orc_meaning_money'), or_venture: sel('orv_meaning_money'), or_internal: sel('ori_energized'), cs_blocker: sel('blk_eyes'), ap_experiment: sel('ap_redesign'),
    },
  },
  {
    name: 'P3 번아웃',
    profile: { jobRoleRaw: '간호사', ageBand: '30_late', totalCareerStage: 'total_7_12', currentFieldStage: 'current_3_7', workMode: 'professional', careerPattern: 'single_track', transitionTiming: 'unknown' },
    r: {
      cs_main: sel('cs_rest'), ar_roles: sel('ar_reset', 'ar_expert'), cv_values: sel('cv_recovery', 'cv_stability'),
      cv_priorities: rank('pr_recovery', 'pr_stability', 'pr_meaning', 'pr_money', 'pr_growth'),
      fc_1: sel('fc1_expert'), fc_2: sel('fc2_stable'), fc_3: sel('fc3_quiet'), fc_4: sel('fc4_maker'), sc_outlook: sel('sc_unsure'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_3to6'), rc_energy: sel('rc_energy_rest'), rc_risk: sel('rc_risk_none'), rc_validation: sel('rc_val_none'),
      or_content: sel('orc_unsure'), or_venture: sel('orv_capable_flat'), or_internal: sel('ori_capable_flat'), cs_blocker: sel('blk_time'), ap_experiment: sel('ap_rest'),
    },
  },
  {
    name: 'P4 전문가 깔끔 (coherent expected)',
    profile: { jobRoleRaw: '변호사', ageBand: '40_early', totalCareerStage: 'total_12_plus', currentFieldStage: 'current_7_plus', workMode: 'professional', careerPattern: 'single_track', transitionTiming: 'within_3_6_months' },
    r: {
      cs_main: sel('cs_expand'), ar_roles: sel('ar_advisor', 'ar_expert'), cv_values: sel('cv_expertise', 'cv_impact', 'cv_knowledge'),
      cv_priorities: rank('pr_influence', 'pr_growth', 'pr_meaning', 'pr_money', 'pr_stability'),
      fc_1: sel('fc1_expert'), fc_2: sel('fc2_stable'), fc_3: sel('fc3_public'), fc_4: sel('fc4_interpreter'), sc_outlook: sel('sc_self_only'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_6to12'), rc_energy: sel('rc_energy_ok'), rc_risk: sel('rc_risk_cost'), rc_validation: sel('rc_val_none'),
      or_content: sel('orc_meaning_money'), or_venture: sel('orv_capable_flat'), or_internal: sel('ori_stable_flat'), cs_blocker: sel('blk_money'), ap_experiment: sel('ap_writing'),
    },
  },
  {
    name: 'P5 크리에이터 고검증',
    profile: { jobRoleRaw: '디자이너', ageBand: '30_early', totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7', workMode: 'organization', careerPattern: 'single_track', transitionTiming: 'now' },
    r: {
      cs_main: sel('cs_expand'), ar_roles: sel('ar_creator', 'ar_expert'), cv_values: sel('cv_creativity', 'cv_impact', 'cv_bigmarket'),
      cv_priorities: rank('pr_influence', 'pr_growth', 'pr_meaning', 'pr_freedom', 'pr_money'),
      fc_1: sel('fc1_connector'), fc_2: sel('fc2_builder'), fc_3: sel('fc3_public'), fc_4: sel('fc4_maker'), sc_outlook: sel('sc_both'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_1y'), rc_energy: sel('rc_energy_high'), rc_risk: sel('rc_risk_cost'), rc_validation: sel('rc_val_done'),
      or_content: sel('orc_energized'), or_venture: sel('orv_meaning_money'), or_internal: sel('ori_energized'), cs_blocker: sel('blk_unclear'), ap_experiment: sel('ap_content'),
    },
  },
  {
    name: 'P6 갈림길 안정-자유 충돌',
    profile: { jobRoleRaw: '회사원', ageBand: '30_late', totalCareerStage: 'total_7_12', currentFieldStage: 'current_3_7', workMode: 'organization', careerPattern: 'single_track', transitionTiming: 'within_3_6_months' },
    r: {
      cs_main: sel('cs_between'), ar_roles: sel('ar_steady', 'ar_creator'), cv_values: sel('cv_stability', 'cv_autonomy', 'cv_creativity'),
      cv_priorities: rank('pr_stability', 'pr_freedom', 'pr_growth', 'pr_meaning', 'pr_money'),
      fc_1: sel('fc1_expert'), fc_2: sel('fc2_stable'), fc_3: sel('fc3_quiet'), fc_4: sel('fc4_maker'), sc_outlook: sel('sc_market_only'),
      rc_options: sel('rc_opt_some'), rc_runway: sel('rc_runway_6to12'), rc_energy: sel('rc_energy_ok'), rc_risk: sel('rc_risk_time'), rc_validation: sel('rc_val_early'),
      or_content: sel('orc_meaning_money'), or_venture: sel('orv_unsure'), or_internal: sel('ori_stable_flat'), cs_blocker: sel('blk_fail'), ap_experiment: sel('ap_redesign'),
    },
  },
];

for (const p of personas) {
  const s = buildResultFromResponses(p.r, { profile: p.profile });
  const mt = s.solutionLayer.mainTypeKey;
  const story = MAIN_TYPE_NARRATIVES[mt];
  console.log('\n' + '═'.repeat(78));
  console.log(p.name);
  console.log('─'.repeat(78));
  console.log('① 중심축      :', s.identityAxis.statement);
  console.log('② 프로필 본문 :', s.profileContext?.body ?? '(없음)');
  console.log('③ 유형        :', mt, '/', s.solutionLayer.mainTypeLabel);
  console.log('④ 이야기 제목 :', story?.thesis ?? '(없음)');
  console.log('⑤ storyInsight:', s.storyInsight ?? '(없음)');
  console.log('⑥ 현재 우선순위(추천):', s.currentBestMove.label, `<${s.currentBestMove.readiness}>`);
  console.log('⑦ 검증할 방향 :', s.strategicDirection?.label ?? '(직접/없음)');
  console.log('⑧ 솔루션 헤더 :', s.solutionLayer.primaryModule.title, '—', s.solutionLayer.strategyStatement);
  console.log('⑨ 이번 달 실험:', s.executionPlan.coreExperiment.label);
  console.log('⑩ 근거 내러티브:', s.evidence.narrative);
  console.log('⑪ 닫는 문장   :', s.executionPlan.closingLine ?? '(없음)');
}
console.log('\n' + '═'.repeat(78));
