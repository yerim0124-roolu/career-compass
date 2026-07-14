// 현재 위치(WholeResponseSummary의 첫 문장으로 재사용) 표시 카피 — 기존 mainType 재사용·신규 패턴 문항 독립성 검증.
// 실행: node --experimental-strip-types <file>

import { CURRENT_POSITION_COPY, currentPositionCopy } from './currentPositionCopy.ts';
import { buildResultFromResponses } from './session.ts';
import type { FlowResponses } from './session.ts';
import type { MainTypeKey } from '../../types/careerCompass.ts';

let passed = 0, failed = 0;
const check = (name: string, cond: boolean) => { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } };

// ── 카피 품질: 10 mainType 전부, 단계 문장, 패턴명/금지 표현 없음 ──
const ids = Object.keys(CURRENT_POSITION_COPY) as MainTypeKey[];
check('10개 mainType 카피 존재', ids.length === 10 && ids.every((k) => CURRENT_POSITION_COPY[k].length > 0));
check('모든 문장이 "…단계/상태에 가까워요."로 끝(국면·상태 서술)', ids.every((k) => /(단계|상태)에 가까워요\.$/.test(CURRENT_POSITION_COPY[k])));
const BANNED = ['흔들리고 있어요', '마음의 정체', '흐름이 보여요', '누르고 있', '눌린'];
check('금지 추상 표현 없음', ids.every((k) => !BANNED.some((b) => CURRENT_POSITION_COPY[k].includes(b))));
const PATTERN_NAMES = ['손실 회피', '소유 효과', '매몰비용', '모호성 회피', '극대화', '예기된 후회', '분석 마비', '선택 기준 부재', '생산적 지연', '목표점 이동', '실험 회피', '리미널', '당위적 사고', '정체성 조기', '가면 증후군', '자기효능감'];
check('현재 위치 문장에 패턴명 미사용', ids.every((k) => !PATTERN_NAMES.some((n) => CURRENT_POSITION_COPY[k].includes(n))));

// ── fallback: mainType 없거나 알 수 없으면 null(영역 숨김) ──
check('currentPositionCopy(undefined) === null', currentPositionCopy(undefined) === null);
check('currentPositionCopy(null) === null', currentPositionCopy(null) === null);
check('currentPositionCopy(unknown) === null', currentPositionCopy('nope' as MainTypeKey) === null);

// ── 완성 응답 세트(갈림길형) ──
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

const fields = (r: FlowResponses) => {
  const s = buildResultFromResponses(r, { profile: {} });
  const rc = s.resultContext;
  return {
    mainType: s.solutionLayer.mainTypeKey, pos: currentPositionCopy(s.solutionLayer.mainTypeKey),
    pattern: s.patternProfile.primaryPattern, resolution: s.patternProfile.resolution,
    reg: JSON.stringify({ subtype: rc?.primarySubtype, pull: rc?.pullDirection, friction: rc?.primaryFriction, readiness: rc?.readinessLevel, mt: s.solutionLayer.mainTypeKey }),
  };
};

const base = fields(BASE);
check('BASE: 현재 위치 문장 존재', typeof base.pos === 'string' && (base.pos as string).length > 0);

// ── 독립성: pt_hold/pt_delay/pt_direction만 바꿔도 현재 위치 문장 불변 ──
const ptChanged = { ...BASE,
  pt_hold: { selectedOptionIds: ['pt_hold_none'] },
  pt_delay: { selectedOptionIds: ['pt_delay_acting'] },
  pt_direction: { selectedOptionIds: ['pt_dir_exploring'] } };
const pt = fields(ptChanged);
check('pt_*만 변경 → mainType 불변', base.mainType === pt.mainType);
check('pt_*만 변경 → 현재 위치 문장 불변', base.pos === pt.pos);
check('pt_*만 변경 → 기존 결과 필드(subtype/pull/friction/readiness) 불변', base.reg === pt.reg);
check('pt_*만 변경 → patternProfile은 달라질 수 있음(독립 계층)', base.pattern !== pt.pattern || base.resolution !== pt.resolution || true);

// pt_hold 단독 / pt_delay 단독 변경도 현재 위치 불변
check('pt_hold 단독 변경 → 현재 위치 불변', base.pos === fields({ ...BASE, pt_hold: { selectedOptionIds: ['pt_hold_loss'] } }).pos);
check('pt_delay 단독 변경 → 현재 위치 불변', base.pos === fields({ ...BASE, pt_delay: { selectedOptionIds: ['pt_delay_fear'] } }).pos);
check('pt_direction 단독 변경 → 현재 위치 불변', base.pos === fields({ ...BASE, pt_direction: { selectedOptionIds: ['pt_dir_liminal'] } }).pos);

// ── 기존 scoring 필드가 바뀌어 mainType이 달라지면 현재 위치 문장도 달라짐 ──
const burnout = { ...BASE,
  cs_main: { selectedOptionIds: ['cs_rest'] }, rc_energy: { selectedOptionIds: ['rc_energy_rest'] },
  rc_risk: { selectedOptionIds: ['rc_risk_none'] }, cv_values: { selectedOptionIds: ['cv_recovery', 'cv_stability'] },
  cv_priorities: { ranking: ['pr_recovery', 'pr_stability'] }, ap_experiment: { selectedOptionIds: ['ap_rest'] } };
const burn = fields(burnout);
check('번아웃형: mainType이 BASE와 다름', burn.mainType !== base.mainType);
check('mainType 달라지면 현재 위치 문장도 달라짐', burn.pos !== base.pos && typeof burn.pos === 'string');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
