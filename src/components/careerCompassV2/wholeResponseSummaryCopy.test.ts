// 전체 답변을 종합하면(WholeResponseSummary) 표시 카피 — 최대 2문장, 답변 재진술 금지,
// 무료에서 처방형 표현 금지, mainType/resultContext 재사용·pt_*/patternProfile 독립성 검증.
// 실행: node --experimental-strip-types <file>

import {
  buildWholeResponseSummary, FRICTION_TENSION, READINESS_STATE,
} from './wholeResponseSummaryCopy.ts';
import { CURRENT_POSITION_COPY } from './currentPositionCopy.ts';
import { buildResultFromResponses } from './session.ts';
import type { FlowResponses } from './session.ts';
import type { MainTypeKey, FrictionSource, ReadinessLevel } from '../../types/careerCompass.ts';

let passed = 0, failed = 0;
const check = (name: string, cond: boolean) => { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } };

// ── 데이터 무결성 ──
const FRICTION_KEYS = Object.keys(FRICTION_TENSION) as FrictionSource[];
check('FRICTION_TENSION 8개(FrictionSource 전체)', FRICTION_KEYS.length === 8);
check('READINESS_STATE는 낮은 준비도 2개(pause/reflect_only)만', (() => {
  const keys = Object.keys(READINESS_STATE) as ReadinessLevel[];
  return keys.length === 2 && keys.includes('pause') && keys.includes('reflect_only');
})());

// ── 무료에서 처방형 표현 금지: 요약이 스스로 만드는 문장(긴장/준비)에 행동 지시·시점 없음 ──
const PRESCRIPTIVE = ['작게 확인', '본격 검증', '짜임새 있는 검증', '검증 시점', '확인해볼 시점', '무엇을 해볼', '회복해야', '정리해야', '해보는 정도', '옮겨볼 시점'];
const ADDED_SENTENCES = [...FRICTION_KEYS.map((k) => FRICTION_TENSION[k]), ...Object.values(READINESS_STATE)];
check('요약이 만드는 문장에 처방형 표현 없음', ADDED_SENTENCES.every((s) => !PRESCRIPTIVE.some((p) => s!.includes(p))));

// ── 조립형·중복 도입부·금지 표현 제거(이번 지시) ──
const BANNED_ASSEMBLED = ['마음이 기우는 방향은 있지만', '확신이 뒤따르지 못', '확신은 아직 뒤따르지', '선택을 붙잡고', '선택을 신중하게 붙잡', '판단이 아직 남아', '판단이 남아 있'];
check('긴장/준비 문장에 조립형·금지 표현 없음', ADDED_SENTENCES.every((s) => !BANNED_ASSEMBLED.some((b) => s!.includes(b))));

// ── §7 금지 표현 회귀 테스트: mainType 국면 문장 + friction/readiness 문장 전체에서 확인 ──
const ALL_MAIN_SENTENCES = Object.values(CURRENT_POSITION_COPY);
const BANNED_REGRESSION = [
  '지금은 방향은', '반응을 확인해보는', '확신이 따라오지 못', '확신은 따라오지 못',
  '연속성을 놓기 어려워', '바꿀 수 있는 가능성', '준비도가 낮은 상태', '에너지 자체가 아직 부족한 상태',
];
check('§7 금지 표현이 국면 문장에 없음', ALL_MAIN_SENTENCES.every((s) => !BANNED_REGRESSION.some((b) => s.includes(b))));
check('§7 금지 표현이 긴장/준비 문장에 없음', ADDED_SENTENCES.every((s) => !BANNED_REGRESSION.some((b) => s!.includes(b))));
// 공통 도입부가 과도하게 반복되지 않음: FRICTION_TENSION 8종이 모두 동일한 접두로 시작하지 않는다.
check('FRICTION_TENSION 8종이 동일 도입부로 시작하지 않음', (() => {
  const firstClause = FRICTION_KEYS.map((k) => FRICTION_TENSION[k].split(', ')[0].split(' ')[0]);
  return new Set(firstClause).size >= 4;
})());

// ── 답변 재진술 금지: 구체 방향명(선택지 명사)을 그대로 붙이지 않음 ──
const DIRECTION_NOUNS = ['콘텐츠', '창업', '자문', '강의', '독립', '프리랜서', '이직', '투자', '분석', '브랜드', '조직 내 리더', '재설계'];
check('긴장/준비 문장에 구체 방향명 미포함(한 단계 추상화)',
  ADDED_SENTENCES.every((s) => !DIRECTION_NOUNS.some((n) => s!.includes(n))));

// 패턴명·금지 추상표현도 없음
const PATTERN_NAMES = ['손실 회피', '소유 효과', '매몰비용', '모호성 회피', '극대화', '예기된 후회', '분석 마비', '선택 기준 부재', '생산적 지연', '목표점 이동', '실험 회피', '리미널', '당위적 사고', '정체성 조기', '가면 증후군', '자기효능감'];
check('긴장/준비 문장에 패턴명 미사용', ADDED_SENTENCES.every((s) => !PATTERN_NAMES.some((n) => s!.includes(n))));

// ══════════════════════════════════════════════════════════════════════════
// 2번째 문장 우선순위 순수 함수 — 브랜치별 검증
// ══════════════════════════════════════════════════════════════════════════
// (1) pause → 준비 상태 우선 (단, overloadedBurnout은 국면이 회복을 말하므로 생략)
check('우선순위1: readiness=pause → 준비 상태(에너지) 문장',
  buildWholeResponseSummary({ mainType: 'realityLocked', showPullDirection: false, primaryFriction: 'time_constraint', readinessLevel: 'pause' })[1] === READINESS_STATE.pause);
check('우선순위1 예외: overloadedBurnout + pause → 준비 문장 생략(국면이 회복 서술)',
  buildWholeResponseSummary({ mainType: 'overloadedBurnout', showPullDirection: false, primaryFriction: 'low_energy', readinessLevel: 'pause' }).length === 1);
// (2) showPullDirection && friction → 긴장 우선
check('우선순위2: 또렷한 방향 + 병목 → 긴장 문장(공통 도입부 없는 완성 문장)',
  buildWholeResponseSummary({ mainType: 'conflictedAtFork', showPullDirection: true, primaryFriction: 'income_uncertainty', readinessLevel: 'structured_test' })[1] === FRICTION_TENSION.income_uncertainty);
check('우선순위2 예외: unvalidatedAspirant는 국면이 검증을 말하므로 긴장 생략',
  (() => { const s = buildWholeResponseSummary({ mainType: 'unvalidatedAspirant', showPullDirection: true, primaryFriction: 'low_market_signal', readinessLevel: 'tiny_test' }); return s.length === 1; })());
check('우선순위2 예외: leverageReady는 이미 실행 준비 완료라 긴장 생략',
  buildWholeResponseSummary({ mainType: 'leverageReady', showPullDirection: true, primaryFriction: 'time_constraint', readinessLevel: 'commitment_test' }).length === 1);
// (3) reflect_only → 준비 상태 폴백(긴장이 안 뜰 때)
check('우선순위3: 또렷한 방향 없음 + reflect_only → 준비도 낮음 문장',
  buildWholeResponseSummary({ mainType: 'lowOptionVisibility', showPullDirection: false, primaryFriction: 'low_market_signal', readinessLevel: 'reflect_only' })[1] === READINESS_STATE.reflect_only);
// (4) 근거 약함 → 첫 문장만
check('우선순위4: 방향 없음 + 준비도 정보 없음 → 첫 문장만',
  buildWholeResponseSummary({ mainType: 'scatteredExplorer', showPullDirection: false, primaryFriction: 'too_many_live_options', readinessLevel: 'tiny_test' }).length === 1);

// ── 최대 2문장 보장(전 조합) ──
const ALL_MAIN = Object.keys(CURRENT_POSITION_COPY) as MainTypeKey[];
const ALL_FRICTION = FRICTION_KEYS;
const ALL_READY: ReadinessLevel[] = ['pause', 'reflect_only', 'tiny_test', 'structured_test', 'commitment_test'];
const TENSION_VALUES = new Set(FRICTION_KEYS.map((k) => FRICTION_TENSION[k]));
const TENSION_ALLOWED = new Set<MainTypeKey>(['conflictedAtFork', 'plateauedPerformer', 'restlessStabilizer', 'emergingLeader']);
let maxLen = 0, everContradict = false;
for (const mt of ALL_MAIN) for (const f of ALL_FRICTION) for (const r of ALL_READY) for (const sp of [true, false]) {
  const out = buildWholeResponseSummary({ mainType: mt, showPullDirection: sp, primaryFriction: f, readinessLevel: r });
  maxLen = Math.max(maxLen, out.length);
  // 긴장 문장('방향이 보인다')은 방향이 또렷한 4개 유형에서만 나와야 한다(방향 미확정 국면과 모순 방지).
  if (out[1] && TENSION_VALUES.has(out[1]) && !TENSION_ALLOWED.has(mt)) everContradict = true;
}
check('모든 조합에서 최대 2문장', maxLen === 2);
check('긴장 문장은 방향 또렷한 4개 유형에서만(방향 미확정 국면과 모순 없음)', !everContradict);
check('undefined mainType(구버전) → 0문장(영역 숨김)', buildWholeResponseSummary({}).length === 0);

// ══════════════════════════════════════════════════════════════════════════
// 대표 사례 20개 — 실제 최종 출력 전수(축약 없이 출력)
// ══════════════════════════════════════════════════════════════════════════
interface Row { name: string; mt?: MainTypeKey; sp: boolean; f?: FrictionSource; r?: ReadinessLevel; }
const ROWS: Row[] = [
  { name: '방향 미확정', mt: 'lowOptionVisibility', sp: false, f: 'low_market_signal', r: 'reflect_only' },
  { name: '방향 미확정(준비도 보통)', mt: 'lowOptionVisibility', sp: false, f: 'too_many_live_options', r: 'tiny_test' },
  { name: '선택지 축소', mt: 'scatteredExplorer', sp: false, f: 'too_many_live_options', r: 'tiny_test' },
  { name: '선택지 축소(준비도 낮음)', mt: 'scatteredExplorer', sp: false, f: 'tradeoff_pain', r: 'reflect_only' },
  { name: '갈림길·안전조건 충돌', mt: 'conflictedAtFork', sp: true, f: 'income_uncertainty', r: 'structured_test' },
  { name: '갈림길·가치 상충', mt: 'conflictedAtFork', sp: true, f: 'tradeoff_pain', r: 'tiny_test' },
  { name: '갈림길·경력 자산', mt: 'conflictedAtFork', sp: true, f: 'career_capital_loss', r: 'reflect_only' },
  { name: '방향 있으나 미검증', mt: 'unvalidatedAspirant', sp: true, f: 'low_market_signal', r: 'tiny_test' },
  { name: '방향 있으나 미검증(준비도 낮음)', mt: 'unvalidatedAspirant', sp: true, f: 'low_market_signal', r: 'reflect_only' },
  { name: '자신감 낮음(정체성)', mt: 'plateauedPerformer', sp: true, f: 'identity_loss', r: 'structured_test' },
  { name: '자신감 낮음(경력 자산)', mt: 'plateauedPerformer', sp: true, f: 'career_capital_loss', r: 'tiny_test' },
  { name: '실행 준비 완료(안전조건)', mt: 'leverageReady', sp: true, f: 'income_uncertainty', r: 'commitment_test' },
  { name: '실행 준비 완료(시간)', mt: 'leverageReady', sp: true, f: 'time_constraint', r: 'structured_test' },
  { name: '안정 속 재설계(가치)', mt: 'restlessStabilizer', sp: true, f: 'tradeoff_pain', r: 'tiny_test' },
  { name: '안정 속 재설계(정체성)', mt: 'restlessStabilizer', sp: true, f: 'identity_loss', r: 'reflect_only' },
  { name: '조직 내 확장(가치)', mt: 'emergingLeader', sp: true, f: 'tradeoff_pain', r: 'structured_test' },
  { name: '조직 내 확장(경력 자산)', mt: 'emergingLeader', sp: true, f: 'career_capital_loss', r: 'tiny_test' },
  { name: '현실 조건 우선(준비도 낮음)', mt: 'realityLocked', sp: false, f: 'income_uncertainty', r: 'reflect_only' },
  { name: '현실 조건 우선(에너지 고갈)', mt: 'realityLocked', sp: false, f: 'time_constraint', r: 'pause' },
  { name: '소진(회복 우선)', mt: 'overloadedBurnout', sp: false, f: 'low_energy', r: 'pause' },
  { name: '신호 약한 구버전 세션', mt: undefined, sp: false, f: undefined, r: undefined },
];

console.log('\n──────── 실제 최종 출력 전수 ────────');
for (const row of ROWS) {
  const out = buildWholeResponseSummary({ mainType: row.mt, showPullDirection: row.sp, primaryFriction: row.f, readinessLevel: row.r });
  console.log(`  [${row.name}] (${out.length}문장) ${out.join(' ') || '(빈 문자열 — 영역 숨김)'}`);
  check(`[${row.name}] 최대 2문장`, out.length <= 2);
  check(`[${row.name}] 코드값/선택지 원문 미노출`, !out.some((s) => /pt_|cs_|rc_|cv_|ar_|nr_|fc_|sc_|or_|blk_|ap_/.test(s)));
  check(`[${row.name}] "…형" 유형 단정·"당신은" 없음`, !out.some((s) => /형이에요|당신은/.test(s)));
  // 2번째 문장(요약 생성분)은 구체 방향명·처방형 표현 없음(1번째=국면 문장은 currentPositionCopy라 제외)
  if (out.length === 2) {
    check(`[${row.name}] 2번째 문장에 구체 방향명 없음`, !DIRECTION_NOUNS.some((n) => out[1].includes(n)));
    check(`[${row.name}] 2번째 문장에 처방형 표현 없음`, !PRESCRIPTIVE.some((p) => out[1].includes(p)));
    check(`[${row.name}] 두 문장이 동일 문자열 반복 아님`, out[0] !== out[1]);
  }
}
check('구버전 세션 행 → 0문장', buildWholeResponseSummary({ mainType: undefined }).length === 0);

// ══════════════════════════════════════════════════════════════════════════
// 실제 엔진 통합: 근거 필드 매핑 + patternProfile / pt_* 독립성
// ══════════════════════════════════════════════════════════════════════════
const BASE: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_between'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_advisor'] },
  ar_narrow: { selectedOptionIds: ['nr_safety'] },
  cv_values: { selectedOptionIds: ['cv_money', 'cv_stability', 'cv_meaning'] },
  cv_priorities: { ranking: ['pr_money', 'pr_stability', 'pr_meaning'] },
  fc_1: { selectedOptionIds: ['fc1_expert'] }, fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] }, fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_self_only'] }, rc_options: { selectedOptionIds: ['rc_opt_several'] },
  rc_runway: { selectedOptionIds: ['rc_runway_3to6'] }, rc_energy: { selectedOptionIds: ['rc_energy_ok'] },
  rc_risk: { selectedOptionIds: ['rc_risk_cost'] }, rc_validation: { selectedOptionIds: ['rc_val_none'] },
  or_content: { selectedOptionIds: ['orc_meaning_money'] }, or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_stable_flat'] }, cs_blocker: { selectedOptionIds: ['blk_money'] },
  ap_experiment: { selectedOptionIds: ['ap_writing'] },
  pt_hold: { selectedOptionIds: ['pt_hold_sunk'] }, pt_delay: { selectedOptionIds: ['pt_delay_analysis'] },
  pt_direction: { selectedOptionIds: ['pt_dir_foreclosed'] },
};

const summaryOf = (r: FlowResponses) => {
  const s = buildResultFromResponses(r, { profile: {} });
  return {
    summary: buildWholeResponseSummary({
      mainType: s.solutionLayer.mainTypeKey,
      pullDirection: s.resultContext?.pullDirection,
      showPullDirection: s.resultContext?.showPullDirection,
      primaryFriction: s.resultContext?.primaryFriction,
      readinessLevel: s.resultContext?.readinessLevel,
    }),
    pattern: s.patternProfile.primaryPattern, resolution: s.patternProfile.resolution,
    mainType: s.solutionLayer.mainTypeKey,
  };
};

const base = summaryOf(BASE);
check('BASE: 실제 엔진 출력이 1~2문장', base.summary.length >= 1 && base.summary.length <= 2);
check('BASE: 첫 문장 = mainType 국면 문장', base.summary[0] === CURRENT_POSITION_COPY[base.mainType]);

const ptChanged = { ...BASE,
  pt_hold: { selectedOptionIds: ['pt_hold_none'] },
  pt_delay: { selectedOptionIds: ['pt_delay_acting'] },
  pt_direction: { selectedOptionIds: ['pt_dir_exploring'] } };
const pt = summaryOf(ptChanged);
check('pt_*만 변경 → mainType 불변', base.mainType === pt.mainType);
check('pt_*만 변경 → 전체 종합 불변(독립성)', JSON.stringify(base.summary) === JSON.stringify(pt.summary));
check('pt_hold 단독 변경 → 전체 종합 불변', JSON.stringify(base.summary) === JSON.stringify(summaryOf({ ...BASE, pt_hold: { selectedOptionIds: ['pt_hold_loss'] } }).summary));

// 구버전 세션(resultContext 없음): mainType 문장 1개만
{
  const legacy = buildWholeResponseSummary({ mainType: 'leverageReady' });
  check('구버전 세션(resultContext 없음): 첫 문장만, 크래시 없음',
    legacy.length === 1 && legacy[0] === CURRENT_POSITION_COPY.leverageReady);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
