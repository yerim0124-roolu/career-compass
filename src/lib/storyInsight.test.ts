// storyInsight 규칙 회귀 테스트. self-assert (node --experimental-strip-types).
import { buildStoryInsight } from './storyInsight.ts';
import type { InsightResponses } from './storyInsight.ts';

let passed = 0, failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}
const r = (o: InsightResponses) => o;

// R1 — 말 vs 행동: 안정/회복 1순위 + 도전형 실험 → '손이 먼저 간 쪽'
const r1 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_stability', 'pr_growth'] }, ap_experiment: { selectedOptionIds: ['ap_content'] } }));
check('R1 stated-vs-revealed fires', !!r1 && r1.includes('손이 먼저'));

// R1 우선: 안정 1순위 + 도전 실험이면 가치충돌(R2)보다 R1이 먼저
const r1pri = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_stability', 'pr_freedom'] }, ap_experiment: { selectedOptionIds: ['ap_interview'] } }));
check('R1 takes priority over R2', !!r1pri && r1pri.includes('손이 먼저'));

// R2 — 가치 충돌 페어 (안정+자유), 비도전 실험
const r2 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_stability', 'pr_freedom'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R2 tension pair fires', !!r2 && r2.includes('안정과 자유'));

// R2 — 같은 결(안정+회복)은 충돌 아님 → R2 미발동
const r2same = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_stability', 'pr_recovery'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R2 does NOT fire for same-grain pair (안정+회복)', !r2same || !r2same.includes('나란히 위에'));

// R3 — 감정 나침반: 한 곳만 설렘
const r3 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, or_content: { selectedOptionIds: ['orc_energized'] }, or_venture: { selectedOptionIds: ['orv_capable_flat'] }, or_internal: { selectedOptionIds: ['ori_capable_flat'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R3 single-energized fires', !!r3 && r3.includes('설렘'));

// R5 — 이력 전환 (gap ≥ 2)
const r5 = buildStoryInsight({ totalCareerStage: 'total_7_12', currentFieldStage: 'current_1_3' }, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R5 switch-history fires', !!r5 && r5.includes('또 한 번'));

// 적용 없음 → null (앵무새 대신 생략)
const none = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('no rule applies → null (no forced echo)', none === null);

// R6 — 자신감 비대칭 (sc_self_only)
const r6 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, sc_outlook: { selectedOptionIds: ['sc_self_only'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R6 self-vs-market asymmetry fires', !!r6 && r6.includes('검증 문제'));

// R7 — 가치 과다선택 (5개 이상)
const r7 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, cv_values: { selectedOptionIds: ['cv_autonomy', 'cv_growth', 'cv_impact', 'cv_creativity', 'cv_meaning'] }, sc_outlook: { selectedOptionIds: ['sc_both'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R7 flat-profile fires', !!r7 && r7.includes('무엇을 안 할지'));

// R9 — 가치-역할 일치 (toward, affirming)
const r9 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_influence', 'pr_growth'] }, ar_roles: { selectedOptionIds: ['ar_leader', 'ar_advisor'] }, or_content: { selectedOptionIds: ['orc_energized'] }, or_venture: { selectedOptionIds: ['orv_energized'] }, or_internal: { selectedOptionIds: ['ori_energized'] }, sc_outlook: { selectedOptionIds: ['sc_both'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R9 value-role coherence fires', !!r9 && r9.includes('언제, 어떻게'));

// R10 — 결정 블로커 리프레임 (B 질문). 폴백 커버리지.
const r10 = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, sc_outlook: { selectedOptionIds: ['sc_both'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] }, cs_blocker: { selectedOptionIds: ['blk_money'] } }));
check('R10 blocker reframe fires (현실 조건)', !!r10 && r10.includes('런웨이 문제'));

// R10 cross-check: blk_unclear인데 끌림 있으면 '책임이 두려운 것'으로 리프레임 (단 R3 미발동 시)
const r10x = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_influence'] }, or_content: { selectedOptionIds: ['orc_energized'] }, or_venture: { selectedOptionIds: ['orv_energized'] }, or_internal: { selectedOptionIds: ['ori_energized'] }, sc_outlook: { selectedOptionIds: ['sc_both'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] }, cs_blocker: { selectedOptionIds: ['blk_unclear'] } }));
check('R10 blk_unclear + clear pull → 책임 reframe', !!r10x && r10x.includes('책임'));

// R-narrow — '하나로 못 좁히는 이유'(ar_narrow, Phase 2) 이유별 리프레임
const nrEx = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_meaning'] }, ar_narrow: { selectedOptionIds: ['nr_explore'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R-narrow nr_explore → 좁히기 reframe', !!nrEx && nrEx.includes('2~3개만'));
const nrLoss = buildStoryInsight({}, r({ cv_priorities: { ranking: ['pr_growth', 'pr_meaning'] }, ar_narrow: { selectedOptionIds: ['nr_loss'] }, ap_experiment: { selectedOptionIds: ['ap_redesign'] } }));
check('R-narrow nr_loss → 기준 reframe', !!nrLoss && nrLoss.includes('기준'));

// 인사이트는 절대 고른 옵션 라벨을 그대로 나열하지 않는다(앵무새 금지) — 최소 길이·서술형 확인
check('insight is a sentence, not a list', !!r2 && r2.length > 30 && r2.includes('.'));

console.log(`\nstoryInsight: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
