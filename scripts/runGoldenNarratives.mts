// ADR-001 — golden payload runner.
//
// 10 persona fixtures → NarrativePayload (via the real engine) → optionally the
// real model. Two modes:
//
//   dry run (no key):   node --experimental-strip-types scripts/runGoldenNarratives.mts
//   live run:           ANTHROPIC_API_KEY=sk-... node --experimental-strip-types scripts/runGoldenNarratives.mts
//
// Live output lands in golden-narrative-outputs.json — review every coreInsight:
// (1) 근거 답변을 역추적할 수 있는가? (2) 단정 화법이 없는가? (3) 추천이 보존됐는가?

import { writeFileSync } from 'node:fs';
import { buildResultFromResponses } from '../src/components/careerCompassV2/session.ts';
import type { FlowResponses } from '../src/components/careerCompassV2/session.ts';
import type { UserProfile } from '../src/types/careerCompass.ts';
import { MODEL, SYSTEM_PROMPT, validateOutput, extractJson } from '../api/narrative.ts';

const BASE: FlowResponses = {
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

const v = (over: Partial<FlowResponses>): FlowResponses => ({ ...BASE, ...over });

interface Fixture { name: string; pattern: string; responses: FlowResponses; profile: UserProfile }

const FIXTURES: Fixture[] = [
  {
    name: '1 maker-quiet 기획자 (창업자 본인 세션)',
    pattern: 'A7 에너지 나침반 — 만들기 설렘 vs 노출 피곤',
    responses: BASE,
    profile: { jobRoleRaw: '서비스 기획자', jobRoleCategory: 'product_planning', ageBand: '30_late', workMode: 'organization', totalCareerStage: 'total_7_12', currentFieldStage: 'current_7_plus', concernFreeText: '회사를 계속 다닐지 내 걸 시작할지 모르겠어요' },
  },
  {
    name: '2 수의사 전직자',
    pattern: 'A1 이력 구조 — 전문직 + 현 2년/총 10년',
    responses: v({ cv_priorities: { ranking: ['pr_influence', 'pr_money', 'pr_growth'] } }),
    profile: { jobRoleRaw: '수의사', jobRoleCategory: 'veterinarian', ageBand: '30_late', workMode: 'professional', totalCareerStage: 'total_7_12', currentFieldStage: 'current_1_3', concernFreeText: '전문직인데 더 큰 일을 하고 싶어요' },
  },
  {
    name: '3 번아웃 회복형',
    pattern: 'A4 탈출 동기 + 번아웃 톤 안전성 (가장 민감한 케이스)',
    responses: v({
      cs_main: { selectedOptionIds: ['cs_rest'] },
      ar_roles: { selectedOptionIds: ['ar_reset', 'ar_expert'] },
      cv_values: { selectedOptionIds: ['cv_recovery', 'cv_stability'] },
      cv_priorities: { ranking: ['pr_recovery', 'pr_stability'] },
      sc_outlook: { selectedOptionIds: ['sc_unsure'] },
      rc_energy: { selectedOptionIds: ['rc_energy_rest'] },
      rc_risk: { selectedOptionIds: ['rc_risk_none'] },
      rc_validation: { selectedOptionIds: ['rc_val_none'] },
      or_content: { selectedOptionIds: ['orc_capable_flat'] },
      or_venture: { selectedOptionIds: ['orv_money_tiring'] },
      ap_experiment: { selectedOptionIds: ['ap_interview'] },
    }),
    profile: { jobRoleRaw: '마케터', jobRoleCategory: 'marketing', ageBand: '30_early', workMode: 'organization', totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7', concernFreeText: '아무것도 하기 싫은데 이대로 괜찮은 걸까요' },
  },
  {
    name: '4 전문가 발신형',
    pattern: 'A2 동기 구조 — 축적→발신 전환 신호',
    responses: v({
      ar_roles: { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
      cv_values: { selectedOptionIds: ['cv_expertise', 'cv_impact', 'cv_knowledge'] },
      cv_priorities: { ranking: ['pr_growth', 'pr_influence', 'pr_money'] },
      fc_3: { selectedOptionIds: ['fc3_public'] },
      fc_4: { selectedOptionIds: ['fc4_interpreter'] },
      rc_validation: { selectedOptionIds: ['rc_val_informal'] },
      or_content: { selectedOptionIds: ['orc_excited'] },
      or_venture: { selectedOptionIds: ['orv_money_energized'] },
      or_internal: { selectedOptionIds: ['ori_capable'] },
      rc_runway: { selectedOptionIds: ['rc_runway_6to12'] },
      rc_energy: { selectedOptionIds: ['rc_energy_ok'] },
      rc_risk: { selectedOptionIds: ['rc_risk_small'] },
    }),
    profile: { jobRoleRaw: '데이터 분석가', jobRoleCategory: 'data_ai', ageBand: '30_early', workMode: 'organization', totalCareerStage: 'total_7_12', currentFieldStage: 'current_7_plus' },
  },
  {
    name: '5 미분화 프로파일',
    pattern: 'A3 분화도 — 가치 전부 + 포기를 손해로 느낌',
    responses: v({
      cv_values: { selectedOptionIds: ['cv_money', 'cv_expertise', 'cv_impact', 'cv_meaning'] },
      cv_priorities: { ranking: ['pr_growth', 'pr_money', 'pr_meaning', 'pr_influence', 'pr_freedom', 'pr_stability'] },
      ar_roles: { selectedOptionIds: ['ar_expert', 'ar_founder', 'ar_creator'] },
    }),
    profile: { jobRoleRaw: 'PM', jobRoleCategory: 'product_planning', ageBand: '20_late', workMode: 'organization', totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7', concernFreeText: '하고 싶은 게 너무 많아서 문제예요' },
  },
  {
    name: '6 안정 가치 + 창업 끌림',
    pattern: 'A3 비일관 — 욕구와 허락의 분리, 순서의 문제',
    responses: v({
      cv_values: { selectedOptionIds: ['cv_stability', 'cv_money'] },
      cv_priorities: { ranking: ['pr_stability', 'pr_money', 'pr_freedom'] },
      ar_roles: { selectedOptionIds: ['ar_founder'] },
      or_venture: { selectedOptionIds: ['orv_money_energized'] },
    }),
    profile: { jobRoleRaw: '회계사', jobRoleCategory: 'legal_accounting', ageBand: '30_early', workMode: 'organization', totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7' },
  },
  {
    name: '7 말한 선호 vs 드러난 선호',
    pattern: 'A5 — 안정 1위인데 실험은 고객 인터뷰(창업)를 선택',
    responses: v({
      cv_priorities: { ranking: ['pr_stability', 'pr_recovery', 'pr_money'] },
      cv_values: { selectedOptionIds: ['cv_stability', 'cv_recovery'] },
      ap_experiment: { selectedOptionIds: ['ap_interview'] },
    }),
    profile: { jobRoleRaw: '교사', jobRoleCategory: 'teacher', ageBand: '40_early', workMode: 'organization', totalCareerStage: 'total_12_plus', currentFieldStage: 'current_7_plus' },
  },
  {
    name: '8 생애 역할 제약',
    pattern: 'A6 — 가족 책임 + 시간 제약 = 역할 협상 문제',
    responses: v({ rc_runway: { selectedOptionIds: ['rc_runway_3to6'] }, rc_risk: { selectedOptionIds: ['rc_risk_none'] } }),
    profile: { jobRoleRaw: '간호사', jobRoleCategory: 'nurse', ageBand: '40_early', workMode: 'organization', totalCareerStage: 'total_12_plus', currentFieldStage: 'current_7_plus', constraintTags: ['family_responsibility', 'time'], concernFreeText: '애들 때문에 모험은 못 하는데 이대로 10년이 갈까 봐요' },
  },
  {
    name: '9 고민 미입력 (userConcern 없음)',
    pattern: '되비추기 없이도 성립하는지',
    responses: v({}),
    profile: { jobRoleRaw: '개발자', jobRoleCategory: 'backend', ageBand: '20_late', workMode: 'organization', totalCareerStage: 'total_3_7', currentFieldStage: 'current_3_7' },
  },
  {
    name: '10 프로필 최소 (직무·경력 없음)',
    pattern: '재료 부족 시 과잉 해석하지 않는지',
    responses: v({}),
    profile: {},
  },
];

async function callModel(payload: unknown, apiKey: string): Promise<unknown> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: JSON.stringify(payload) }] }),
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const data = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
  return extractJson(data.content?.find((c) => c.type === 'text')?.text ?? '');
}

const apiKey = process.env.ANTHROPIC_API_KEY;
const results: unknown[] = [];

for (const f of FIXTURES) {
  const spine = buildResultFromResponses(f.responses, { profile: f.profile });
  const payload = spine.narrativeSeed!;
  console.log(`\n━━━ ${f.name} — ${f.pattern}`);
  if (!apiKey) {
    console.log(JSON.stringify(payload, null, 1).slice(0, 600) + ' …(dry run)');
    results.push({ fixture: f.name, pattern: f.pattern, payload });
    continue;
  }
  try {
    const out = await callModel(payload, apiKey);
    const valid = validateOutput(out, payload.recommendation.coreExperiment, payload.recommendation.currentBestMove);
    console.log(`  valid=${valid}`);
    console.log(JSON.stringify(out, null, 1));
    results.push({ fixture: f.name, pattern: f.pattern, payload, output: out, valid });
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
    results.push({ fixture: f.name, pattern: f.pattern, payload, error: String(e) });
  }
}

writeFileSync('golden-narrative-outputs.json', JSON.stringify(results, null, 2));
console.log(`\n${apiKey ? '라이브' : '드라이'} 런 완료 → golden-narrative-outputs.json (${results.length}건)`);
