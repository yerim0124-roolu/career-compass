// careerPatternRegression.test.ts — 실행: node --experimental-strip-types <file>
// 목적: Career Pattern v1 추가(판별 문항 Q1~Q4 effect-free + patternProfile 패스스루)가
//       기존 무료 결과의 어떤 필드도 바꾸지 않음을 증명한다.
//   1) 신규 Q1~Q4 응답을 다르게 바꿔도 mainType/subtype/pullDirection/primaryFriction/
//      readinessLevel/profile/resultContext가 완전히 동일.
//   2) 신규 문항 미응답(구버전 세션)이어도 기존 결과가 정상 산출되고 패턴은 안전 폴백.
//   3) patternProfile은 응답에 따라만 바뀌고 기존 필드와 독립.

import assert from 'node:assert';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import { buildResultFromResponses } from '../components/careerCompassV2/session.ts';

let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

// 기존 20문항 대표 응답(갈림길형).
const BASE: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_between'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_advisor'] },
  ar_narrow: { selectedOptionIds: ['nr_safety'] },
  cv_values: { selectedOptionIds: ['cv_money', 'cv_meaning', 'cv_stability'] },
  cv_priorities: { ranking: ['pr_money', 'pr_meaning', 'pr_stability'] },
  fc_1: { selectedOptionIds: ['fc1_expert'] },
  fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] },
  fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_self_only'] },
  rc_options: { selectedOptionIds: ['rc_opt_several'] },
  rc_runway: { selectedOptionIds: ['rc_runway_1to3'] },
  rc_energy: { selectedOptionIds: ['rc_energy_ok'] },
  rc_risk: { selectedOptionIds: ['rc_risk_cost'] },
  rc_validation: { selectedOptionIds: ['rc_val_none'] },
  or_content: { selectedOptionIds: ['orc_meaning_money'] },
  or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_stable_flat'] },
  cs_blocker: { selectedOptionIds: ['blk_money'] },
  ap_experiment: { selectedOptionIds: ['ap_writing'] },
};

const profile = { jobRoleRaw: '마케터', ageBand: '30_early' as const };

// 비교 대상: 기존 결과 필드만 뽑아 안정 문자열로 직렬화.
function existingFingerprint(resp: FlowResponses): string {
  const s = buildResultFromResponses(resp, { profile });
  const rc = s.resultContext;
  return JSON.stringify({
    mainType: s.solutionLayer.mainTypeKey,
    primarySubtype: rc?.primarySubtype,
    secondarySubtype: rc?.secondarySubtype,
    subtypeConfidence: rc?.subtypeConfidence,
    pullDirection: rc?.pullDirection,
    primaryFriction: rc?.primaryFriction,
    secondaryFriction: rc?.secondaryFriction,
    readinessLevel: rc?.readinessLevel,
    profile: s.profile,
    // resultContext 서사·신호까지 포함해 완전 동일성 확인
    narrative: rc?.narrative,
    signals: rc?.signals,
    showPullDirection: rc?.showPullDirection,
  });
}

// ── 1) 신규 문항 미응답(구버전 세션) 기준 지문 ──
const fpNoPattern = existingFingerprint(BASE);
ok('기존 결과 산출 정상(신규 문항 미응답)', fpNoPattern.length > 0);

// 신규 문항 미응답이어도 patternProfile은 안전 폴백(예외 없음).
{
  const s = buildResultFromResponses(BASE, { profile });
  ok('미응답 → patternProfile 존재', !!s.patternProfile && s.patternProfile.version === 'pattern-v1');
  ok('미응답 → resolution 폴백(category_only/insufficient/pattern 중 하나)',
    ['pattern', 'category_only', 'insufficient_signal'].includes(s.patternProfile!.resolution));
}

// ── 2) 신규 판별 문항(pt_hold/pt_delay/pt_direction)을 서로 다른 4가지 조합으로 바꿔도 기존 지문 완전 동일 ──
//   pt_confidence는 제거되었으므로(24→23) 신규 문항은 3개. 여전히 effect-free여야 한다.
const PATTERN_VARIANTS: FlowResponses[] = [
  { pt_hold: { selectedOptionIds: ['pt_hold_sunk'] }, pt_delay: { selectedOptionIds: ['pt_delay_analysis'] }, pt_direction: { selectedOptionIds: ['pt_dir_closed'] } },
  { pt_hold: { selectedOptionIds: ['pt_hold_endow'] }, pt_delay: { selectedOptionIds: ['pt_delay_fear'] }, pt_direction: { selectedOptionIds: ['pt_dir_between'] } },
  { pt_hold: { selectedOptionIds: ['pt_hold_loss'] }, pt_delay: { selectedOptionIds: ['pt_delay_busy'] }, pt_direction: { selectedOptionIds: ['pt_dir_open'] } },
  { pt_hold: { selectedOptionIds: ['pt_hold_none'] }, pt_delay: { selectedOptionIds: ['pt_delay_acting'] }, pt_direction: { selectedOptionIds: ['pt_dir_na'] } },
];

PATTERN_VARIANTS.forEach((variant, i) => {
  const resp = { ...BASE, ...variant };
  ok(`variant#${i + 1}: 기존 결과 필드 완전 동일(신규 문항 무영향)`, existingFingerprint(resp) === fpNoPattern);
});

// ── 2b) 하위 호환: 과거 세션이 남긴 pt_confidence 응답이 있어도 기존 결과·패턴이 안전(무영향) ──
{
  const legacy = { ...BASE, pt_confidence: { selectedOptionIds: ['pt_conf_impostor'] } } as FlowResponses;
  ok('legacy pt_confidence: 기존 결과 지문 동일(무영향)', existingFingerprint(legacy) === fpNoPattern);
  const s = buildResultFromResponses(legacy, { profile });
  ok('legacy pt_confidence: patternProfile 안전 산출', !!s.patternProfile && s.patternProfile.version === 'pattern-v1');
  ok('legacy pt_confidence: impostor를 primary로 산출하지 않음', s.patternProfile!.primaryPattern !== 'impostor');
}

// ── 3) patternProfile은 신규 응답에 따라 실제로 달라진다(독립 계층 증명) ──
//   통제 케이스: 기존 응답은 동일하게 두고 pt_hold만 sunk vs loss로 바꾸면 patternProfile primary가 달라진다.
//   (동시에 기존 결과 지문은 두 경우 완전 동일 — 신규 문항이 기존 산출에 무영향임을 재확인.)
{
  const minimal: FlowResponses = {
    cs_main: { selectedOptionIds: ['cs_stay'] },
    ar_narrow: { selectedOptionIds: ['nr_continuity'] },
    rc_energy: { selectedOptionIds: ['rc_energy_ok'] },
  };
  const aResp = { ...minimal, pt_hold: { selectedOptionIds: ['pt_hold_sunk'] } };
  const bResp = { ...minimal, pt_hold: { selectedOptionIds: ['pt_hold_loss'] } };
  ok('통제: 기존 지문은 pt_hold 변경에도 동일', existingFingerprint(aResp) === existingFingerprint(bResp));
  const a = buildResultFromResponses(aResp, { profile }).patternProfile!;
  const b = buildResultFromResponses(bResp, { profile }).patternProfile!;
  ok('통제: pt_hold_sunk → sunkCost', a.primaryPattern === 'sunkCost');
  ok('통제: pt_hold_loss → lossAversion', b.primaryPattern === 'lossAversion');
  ok('통제: patternProfile이 신규 응답에 따라 달라짐(독립 계층)', a.primaryPattern !== b.primaryPattern);
}

// ── 4) 두 번째 대표 프로필(번아웃형)로도 불변성 재확인 ──
{
  const burnout: FlowResponses = {
    ...BASE,
    cs_main: { selectedOptionIds: ['cs_rest'] },
    rc_energy: { selectedOptionIds: ['rc_energy_rest'] },
    ar_narrow: { selectedOptionIds: ['nr_unsure'] },
  };
  const fp = existingFingerprint(burnout);
  const withPattern = existingFingerprint({ ...burnout, pt_hold: { selectedOptionIds: ['pt_hold_loss'] }, pt_direction: { selectedOptionIds: ['pt_dir_between'] } });
  ok('번아웃형: 신규 문항 추가해도 기존 지문 동일', fp === withPattern);
  const s = buildResultFromResponses(burnout, { profile });
  ok('번아웃형: mainType=overloadedBurnout 유지', s.solutionLayer.mainTypeKey === 'overloadedBurnout');
}

console.log(`✓ careerPatternRegression: ${passed} checks passed`);
