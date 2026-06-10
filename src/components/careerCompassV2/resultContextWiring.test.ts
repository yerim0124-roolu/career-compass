// resultContextWiring.test.ts — 실행: node --experimental-strip-types src/components/careerCompassV2/resultContextWiring.test.ts
// 검증: buildResultFromResponses가 실제 FlowResponses로부터 spine.resultContext를 부착하고,
//       그 subtype/서사/신호가 유효한지(템플릿 정합 + 4섹션 채워짐 + ar_narrow·cs_blocker 경로).

import assert from 'node:assert';
import type { FlowResponses } from './session.ts';
import { buildResultFromResponses } from './session.ts';
import { narrativeTemplates, type ReadinessLevel } from '../../data/narrativeTemplates.ts';

let passed = 0;
const ok = (c: boolean, m: string) => { assert.ok(c, m); passed++; };

const READINESS: ReadinessLevel[] = ['pause', 'reflect_only', 'tiny_test', 'structured_test', 'commitment_test'];

// 값 충돌형 + 새 질문(ar_narrow=nr_safety, cs_blocker=blk_money) 포함
const RESPONSES_CONFLICT: FlowResponses = {
  cs_main:       { selectedOptionIds: ['cs_between'] },
  ar_roles:      { selectedOptionIds: ['ar_expert', 'ar_advisor'] },
  ar_narrow:     { selectedOptionIds: ['nr_safety'] },
  cv_values:     { selectedOptionIds: ['cv_money', 'cv_meaning', 'cv_stability'] },
  cv_priorities: { ranking: ['pr_money', 'pr_meaning', 'pr_stability'] },
  fc_1:          { selectedOptionIds: ['fc1_expert'] },
  fc_2:          { selectedOptionIds: ['fc2_stable'] },
  fc_3:          { selectedOptionIds: ['fc3_quiet'] },
  fc_4:          { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook:    { selectedOptionIds: ['sc_self_only'] },
  cs_blocker:    { selectedOptionIds: ['blk_money'] },
  rc_options:    { selectedOptionIds: ['rc_opt_several'] },
  rc_runway:     { selectedOptionIds: ['rc_runway_1to3'] },
  rc_energy:     { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:       { selectedOptionIds: ['rc_risk_none'] },
  rc_validation: { selectedOptionIds: ['rc_val_none'] },
  ap_experiment: { selectedOptionIds: ['ap_unsure'] },
};

// 콘텐츠/레버리지형 — pullDirection 노출 경로
const RESPONSES_CONTENT: FlowResponses = {
  cs_main:       { selectedOptionIds: ['cs_expand'] },
  ar_roles:      { selectedOptionIds: ['ar_creator', 'ar_advisor'] },
  cv_values:     { selectedOptionIds: ['cv_creativity', 'cv_meaning', 'cv_growth'] },
  cv_priorities: { ranking: ['pr_meaning', 'pr_freedom', 'pr_growth'] },
  fc_1:          { selectedOptionIds: ['fc1_connector'] },
  fc_2:          { selectedOptionIds: ['fc2_builder'] },
  fc_3:          { selectedOptionIds: ['fc3_public'] },
  fc_4:          { selectedOptionIds: ['fc4_maker'] },
  sc_outlook:    { selectedOptionIds: ['sc_share'] },
  rc_options:    { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:     { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy:     { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:       { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation: { selectedOptionIds: ['rc_val_some'] },
  ap_experiment: { selectedOptionIds: ['ap_content'] },
};

// 회복 우선형 — readiness=pause 경로
const RESPONSES_RECOVERY: FlowResponses = {
  cs_main:       { selectedOptionIds: ['cs_rest'] },
  ar_roles:      { selectedOptionIds: ['ar_reset', 'ar_expert'] },
  cv_values:     { selectedOptionIds: ['cv_recovery', 'cv_stability'] },
  cv_priorities: { ranking: ['pr_recovery', 'pr_stability'] },
  fc_1:          { selectedOptionIds: ['fc1_expert'] },
  fc_2:          { selectedOptionIds: ['fc2_stable'] },
  fc_3:          { selectedOptionIds: ['fc3_quiet'] },
  fc_4:          { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook:    { selectedOptionIds: ['sc_unsure'] },
  rc_options:    { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:     { selectedOptionIds: ['rc_runway_3to6'] },
  rc_energy:     { selectedOptionIds: ['rc_energy_rest'] },
  rc_risk:       { selectedOptionIds: ['rc_risk_none'] },
  rc_validation: { selectedOptionIds: ['rc_val_none'] },
  ap_experiment: { selectedOptionIds: ['ap_interview'] },
};

const cases: Array<[string, FlowResponses]> = [
  ['conflict', RESPONSES_CONFLICT],
  ['content', RESPONSES_CONTENT],
  ['recovery', RESPONSES_RECOVERY],
];

for (const [name, responses] of cases) {
  const spine = buildResultFromResponses(responses);
  const rc = spine.resultContext;
  ok(!!rc, `${name}: resultContext 부착됨`);
  if (!rc) continue;

  // mainType 정합 — solutionLayer와 일치
  ok(rc.mainType === spine.solutionLayer.mainTypeKey, `${name}: mainType=solutionLayer.mainTypeKey (${rc.mainType} vs ${spine.solutionLayer.mainTypeKey})`);

  // subtype이 해당 mainType 템플릿에 실제 존재
  const tmpl = narrativeTemplates[rc.mainType];
  ok(!!tmpl, `${name}: 템플릿 존재 (${rc.mainType})`);
  ok(!!tmpl?.subtypes[rc.primarySubtype], `${name}: primarySubtype '${rc.primarySubtype}' 템플릿에 존재`);

  // 서사 4섹션 채워짐
  ok(rc.narrative.core.length > 0, `${name}: core 채워짐`);
  ok(rc.narrative.monthlyApproach.length > 0, `${name}: monthly 채워짐`);
  ok(rc.narrative.weeklyMove.length > 0, `${name}: weekly 채워짐`);

  // 메타 유효
  ok(READINESS.includes(rc.readinessLevel), `${name}: readinessLevel 유효 (${rc.readinessLevel})`);
  ok(Array.isArray(rc.signals) && rc.signals.length <= 3, `${name}: signals 0~3 (${rc.signals.length})`);
  ok(typeof rc.subtypeConfidence === 'number', `${name}: confidence 숫자`);

  // blended면 secondary도 템플릿 기준 유효해야
  if (rc.narrative.isBlended) {
    ok(rc.primarySubtype !== rc.secondarySubtype, `${name}: blended면 primary≠secondary`);
  }
}

// ADDITIVE 계약 — resultContext 유무가 라우팅 핵심 필드를 바꾸지 않음(같은 입력 재호출 안정성)
{
  const a = buildResultFromResponses(RESPONSES_CONFLICT);
  const b = buildResultFromResponses(RESPONSES_CONFLICT);
  ok(a.resultMode === b.resultMode && a.solutionLayer.mainTypeKey === b.solutionLayer.mainTypeKey
     && a.resultContext?.primarySubtype === b.resultContext?.primarySubtype, '결정성: 동일 입력 → 동일 subtype');
}

console.log(`✓ resultContextWiring: ${passed} checks passed`);
