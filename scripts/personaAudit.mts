// Persona audit harness — drives realistic answer-sets through the FULL pipeline
// (answers → vector → gates → constructProfile → ResultSpine) and prints a compact
// one-line-per-persona summary so we can eyeball whether each recommendation is sane.
//
// Run: node --experimental-strip-types scripts/personaAudit.mts
//
// NOT a test (no assertions). Purpose: accuracy sanity-check after logic changes.

import { findOption, assembleGatesFromSelections, assembleConstructProfile, EXPERIMENT_OPTION_BY_CARD } from '../src/data/careerQuestionFlow.ts';
import { createEmptyCareerVector, applyMultipleChoiceEffects, applyRankingEffects, normalizeCareerVector } from '../src/lib/careerVectorEngine.ts';
import { buildResultSpine } from '../src/lib/resultSpineEngine.ts';
import type { ChoiceOption, CareerOptionKey } from '../src/types/careerCompass.ts';

const o = findOption;
const exp = (ap: string): CareerOptionKey => EXPERIMENT_OPTION_BY_CARD[ap];

interface Persona {
  name: string;
  expect: string;            // what a human counselor would expect (my hypothesis)
  cards: ChoiceOption[];
  ranked: ChoiceOption[];
  ap: string;                // chosen experiment card id
}

// Helper builders to keep personas readable
const roles = (...ids: string[]) => ids.map((id) => o('ar_roles', id));
const values = (...ids: string[]) => ids.map((id) => o('cv_values', id));
const rank = (...ids: string[]) => ids.map((id) => o('cv_priorities', id));

export const P: Persona[] = [
  {
    name: '1. 번아웃 수의사 (현직 불만·소진)',
    expect: '회복/현직 재설계 우선. 자문·강의 곧장 추천이면 안 됨',
    cards: [
      o('cs_main', 'cs_rest'),
      ...roles('ar_expert', 'ar_helper'),
      ...values('cv_recovery', 'cv_stability', 'cv_meaning'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_self_only'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_3to6'),
      o('rc_energy','rc_energy_rest'), o('rc_risk','rc_risk_none'), o('rc_validation','rc_val_none'),
      o('or_content','orc_unsure'), o('or_venture','orv_capable_flat'), o('or_internal','ori_capable_flat'),
      o('ap_experiment','ap_rest'),
    ],
    ranked: rank('pr_recovery','pr_stability','pr_meaning','pr_growth','pr_money'),
    ap: 'ap_rest',
  },
  {
    name: '2. 전문직 안정 선호 (안전 쏠림 위험군)',
    expect: '현직 재설계 같은 구체 솔루션. 자문/강의가 자동 1순위면 의심',
    cards: [
      o('cs_main','cs_stay'),
      ...roles('ar_expert','ar_steady'),
      ...values('cv_stability','cv_expertise','cv_money'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_partial'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_capable_flat'), o('or_internal','ori_stable_flat'),
      o('ap_experiment','ap_redesign'),
    ],
    ranked: rank('pr_stability','pr_money','pr_growth','pr_meaning','pr_freedom'),
    ap: 'ap_redesign',
  },
  {
    name: '3. 고벤처 저런웨이 (창업 끌림·돈 없음)',
    expect: '창업은 보류(pause). 지금은 회복/재설계',
    cards: [
      o('cs_main','cs_many'),
      ...roles('ar_founder','ar_creator'),
      ...values('cv_autonomy','cv_bigmarket','cv_growth'),
      o('fc_1','fc1_connector'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_self_only'),
      o('rc_options','rc_opt_several'), o('rc_runway','rc_runway_lt1'),
      o('rc_energy','rc_energy_tired'), o('rc_risk','rc_risk_income'), o('rc_validation','rc_val_early'),
      o('or_content','orc_energized'), o('or_venture','orv_energized'), o('or_internal','ori_unsure'),
      o('ap_experiment','ap_interview'),
    ],
    ranked: rank('pr_freedom','pr_growth','pr_money','pr_influence','pr_stability'),
    ap: 'ap_interview',
  },
  {
    name: '4. 크리에이터 고검증 (반응 이미 있음)',
    expect: '콘텐츠/퍼스널 브랜드 지금(now) 가능',
    cards: [
      o('cs_main','cs_expand'),
      ...roles('ar_creator','ar_expert'),
      ...values('cv_creativity','cv_impact','cv_bigmarket'),
      o('fc_1','fc1_connector'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_1y'),
      o('rc_energy','rc_energy_high'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_done'),
      o('or_content','orc_energized'), o('or_venture','orv_meaning_money'), o('or_internal','ori_energized'),
      o('ap_experiment','ap_content'),
    ],
    ranked: rank('pr_influence','pr_growth','pr_meaning','pr_freedom','pr_money'),
    ap: 'ap_content',
  },
  {
    name: '5. 갈림길 갈등형 (conflictedAtFork)',
    expect: '선택 기준 정리 솔루션. 고른 시도 곧장 X',
    cards: [
      o('cs_main','cs_between'),
      ...roles('ar_creator','ar_analyst'),
      ...values('cv_growth','cv_meaning','cv_money'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_unsure'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_time'), o('rc_validation','rc_val_early'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_unsure'), o('or_internal','ori_unsure'),
      o('ap_experiment','ap_content'),
    ],
    ranked: rank('pr_growth','pr_meaning','pr_money','pr_freedom','pr_stability'),
    ap: 'ap_content',
  },
  {
    name: '6. 분산형 탐색가 (scatteredExplorer)',
    expect: '기준/초점 정리 우선. 잡다한 시도 곧장 X',
    cards: [
      o('cs_main','cs_many'),
      ...roles('ar_creator','ar_founder','ar_analyst','ar_advisor'),
      ...values('cv_autonomy','cv_growth','cv_creativity','cv_impact'),
      o('fc_1','fc1_connector'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_self_only'),
      o('rc_options','rc_opt_many'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_time'), o('rc_validation','rc_val_none'),
      o('or_content','orc_energized'), o('or_venture','orv_energized'), o('or_internal','ori_unsure'),
      o('ap_experiment','ap_portfolio'),
    ],
    ranked: rank('pr_freedom','pr_growth','pr_meaning','pr_influence','pr_money'),
    ap: 'ap_portfolio',
  },
  {
    name: '7. 옵션 부족형 (lowOptionVisibility)',
    expect: '선택지 넓히기/기준 정리. 막연함 해소가 먼저',
    cards: [
      o('cs_main','cs_between'),
      ...roles('ar_steady','ar_helper'),
      ...values('cv_stability','cv_meaning'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_unsure'),
      o('rc_options','rc_opt_few'), o('rc_runway','rc_runway_3to6'),
      o('rc_energy','rc_energy_tired'), o('rc_risk','rc_risk_none'), o('rc_validation','rc_val_none'),
      o('or_content','orc_unsure'), o('or_venture','orv_unsure'), o('or_internal','ori_unsure'),
      o('ap_experiment','ap_unsure'),
    ],
    ranked: rank('pr_stability','pr_recovery','pr_meaning','pr_growth','pr_money'),
    ap: 'ap_unsure',
  },
  {
    name: '8. 자문/강의 끌림·검증 부족',
    expect: '자문/강의는 시장검증 조건부. 지금은 검증 실험',
    cards: [
      o('cs_main','cs_expand'),
      ...roles('ar_advisor','ar_expert'),
      ...values('cv_expertise','cv_impact','cv_knowledge'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_public'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_self_only'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_none'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_capable_flat'), o('or_internal','ori_stable_flat'),
      o('ap_experiment','ap_writing'),
    ],
    ranked: rank('pr_influence','pr_growth','pr_meaning','pr_money','pr_stability'),
    ap: 'ap_writing',
  },
  {
    name: '9. 부업형 방향 + 이직 시도 선택 (안전판 보정)',
    expect: '안전판이 이직이면 안 됨 → 현직 유지·재설계로 보정',
    cards: [
      o('cs_main','cs_expand'),
      ...roles('ar_expert','ar_advisor'),
      ...values('cv_expertise','cv_money','cv_impact'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_public'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_3to6'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_income'), o('rc_validation','rc_val_partial'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_capable_flat'), o('or_internal','ori_stable_flat'),
      o('ap_experiment','ap_interview'),
    ],
    ranked: rank('pr_money','pr_stability','pr_growth','pr_influence','pr_meaning'),
    ap: 'ap_interview',
  },
  {
    name: '10. 올그린 (전부 viable)',
    expect: '승격 조건 없음. 직접 now 추천',
    cards: [
      o('cs_main','cs_expand'),
      ...roles('ar_expert','ar_creator'),
      ...values('cv_expertise','cv_impact','cv_growth'),
      o('fc_1','fc1_connector'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_1y'),
      o('rc_energy','rc_energy_high'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_done'),
      o('or_content','orc_energized'), o('or_venture','orv_energized'), o('or_internal','ori_energized'),
      o('ap_experiment','ap_content'),
    ],
    ranked: rank('pr_growth','pr_influence','pr_meaning','pr_money','pr_freedom'),
    ap: 'ap_content',
  },
  {
    name: '11. 회복 우선 (탈진·런웨이 짧음)',
    expect: '회복이 먼저. 무거운 프로젝트 금지',
    cards: [
      o('cs_main','cs_rest'),
      ...roles('ar_reset','ar_steady'),
      ...values('cv_recovery','cv_stability'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_maker'),
      o('sc_outlook','sc_unsure'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_1to3'),
      o('rc_energy','rc_energy_rest'), o('rc_risk','rc_risk_none'), o('rc_validation','rc_val_none'),
      o('or_content','orc_money_tiring'), o('or_venture','orv_money_tiring'), o('or_internal','ori_capable_flat'),
      o('ap_experiment','ap_rest'),
    ],
    ranked: rank('pr_recovery','pr_stability','pr_meaning','pr_money','pr_growth'),
    ap: 'ap_rest',
  },
  {
    name: '12. 분석가형 (글·리포트로 사고)',
    expect: '분석/해석 방향. 글쓰기 실험 적합',
    cards: [
      o('cs_main','cs_expand'),
      ...roles('ar_analyst','ar_expert'),
      ...values('cv_knowledge','cv_problem','cv_expertise'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_partial'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_capable_flat'), o('or_internal','ori_unsure'),
      o('ap_experiment','ap_writing'),
    ],
    ranked: rank('pr_growth','pr_meaning','pr_money','pr_stability','pr_influence'),
    ap: 'ap_writing',
  },
  {
    name: '13. 리더형 (팀·조직 끌림)',
    expect: '조직 내 성장/이동 또는 리더 역할 강화',
    cards: [
      o('cs_main','cs_stay'),
      ...roles('ar_leader','ar_advisor'),
      ...values('cv_impact','cv_growth','cv_money'),
      o('fc_1','fc1_connector'), o('fc_2','fc2_builder'), o('fc_3','fc3_public'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_both'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_1y'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_partial'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_meaning_money'), o('or_internal','ori_energized'),
      o('ap_experiment','ap_redesign'),
    ],
    ranked: rank('pr_influence','pr_growth','pr_money','pr_meaning','pr_stability'),
    ap: 'ap_redesign',
  },
  {
    name: '14. 헬퍼/안정형 (새 RIASEC 옵션)',
    expect: '사람 돕는 안정 방향. 무리한 도전 강요 X',
    cards: [
      o('cs_main','cs_stay'),
      ...roles('ar_helper','ar_steady'),
      ...values('cv_meaning','cv_stability','cv_impact'),
      o('fc_1','fc1_expert'), o('fc_2','fc2_stable'), o('fc_3','fc3_quiet'), o('fc_4','fc4_interpreter'),
      o('sc_outlook','sc_self_only'),
      o('rc_options','rc_opt_some'), o('rc_runway','rc_runway_6to12'),
      o('rc_energy','rc_energy_ok'), o('rc_risk','rc_risk_cost'), o('rc_validation','rc_val_partial'),
      o('or_content','orc_meaning_money'), o('or_venture','orv_capable_flat'), o('or_internal','ori_stable_flat'),
      o('ap_experiment','ap_redesign'),
    ],
    ranked: rank('pr_meaning','pr_stability','pr_recovery','pr_growth','pr_money'),
    ap: 'ap_redesign',
  },
];

export function run(p: Persona) {
  let v = applyMultipleChoiceEffects(createEmptyCareerVector(), p.cards);
  v = applyRankingEffects(v, p.ranked);
  const vector = normalizeCareerVector(v);
  const gates = assembleGatesFromSelections(p.cards);
  const cp = assembleConstructProfile(p.cards, p.ranked);
  const spine = buildResultSpine(vector, gates, {
    preferredExperimentOptionKey: exp(p.ap),
    constructProfile: cp,
    inputCompleteness: 1,
  });
  return { vector, gates, spine };
}

console.log('PERSONA AUDIT — 14 cases through full pipeline\n');
for (const p of P) {
  const { spine, gates } = run(p);
  const dir = spine.strategicDirection;
  console.log('━'.repeat(72));
  console.log(p.name);
  console.log('  기대:', p.expect);
  console.log('  ─');
  console.log('  모드        :', spine.resultMode);
  console.log('  지금의 한 수:', spine.currentBestMove.label, `<${spine.currentBestMove.readiness}>`);
  console.log('  끌리는 방향 :', dir ? `${dir.label} <${dir.readiness}>` : '(없음/직접)');
  console.log('  보류        :', spine.pauseOption ? spine.pauseOption.label : '—');
  console.log('  조건부      :', spine.conditionalOption ? spine.conditionalOption.label : '—');
  console.log('  솔루션모듈  :', (spine as any).solutionLayer?.primaryModule?.title ?? (spine as any).solutionLayer?.mainTypeKey ?? '(n/a)');
  console.log('  유형키      :', (spine as any).solutionLayer?.mainTypeKey ?? '(n/a)');
  console.log('  확신        :', spine.evidence.confidenceBand, `(${spine.evidence.confidenceScore})`);
  console.log('  게이트      :', JSON.stringify(gates));
}
console.log('━'.repeat(72));
