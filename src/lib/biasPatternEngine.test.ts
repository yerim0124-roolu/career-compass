// biasPatternEngine.test.ts — 실행: node --experimental-strip-types <file>
// career-pattern-v1-spec.md §8의 22개 시뮬레이션 + 엣지 케이스(미응답·손상·동점·부족·마진).
// classifyFromEvidence는 증거코드 집합만 받는 순수 함수라 spec 시뮬레이션을 그대로 옮긴다.

import assert from 'node:assert';
import {
  classifyFromEvidence, extractEvidence, buildCareerPatternProfile, CATEGORY_OF, teaserTags,
  type PatternId, type PatternCategory,
} from './biasPatternEngine.ts';

let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

type Exp = {
  resolution: 'pattern' | 'category_only' | 'insufficient_signal';
  primary?: PatternId;
  secondary?: PatternId;
  confidence?: 'low' | 'medium' | 'high';
  category?: PatternCategory;
};

const SIMS: Array<{ n: number; codes: string[]; exp: Exp }> = [
  { n: 1, codes: ['q1:sunkCost', 'arNarrow:nr_continuity', 'cx:careerCapitalAnxiety'], exp: { resolution: 'pattern', primary: 'sunkCost', confidence: 'high' } },
  { n: 2, codes: ['q1:endowment', 'arNarrow:nr_continuity'], exp: { resolution: 'pattern', primary: 'endowmentEffect', confidence: 'medium' } },
  { n: 3, codes: ['q1:lossAversion', 'arNarrow:nr_safety', 'gate:riskNone'], exp: { resolution: 'pattern', primary: 'lossAversion', confidence: 'high' } },
  { n: 4, codes: ['arNarrow:nr_continuity'], exp: { resolution: 'category_only', category: 'instinctTrap', confidence: 'low' } },
  { n: 5, codes: ['arNarrow:nr_loss'], exp: { resolution: 'category_only', category: 'instinctTrap', confidence: 'low' } },
  { n: 6, codes: ['q2:analysisParalysis', 'cx:marketInfoGapHigh'], exp: { resolution: 'pattern', primary: 'analysisParalysis', confidence: 'medium' } },
  // spec §4 B4의 neg(q2:analysisParalysis −1)이 적용돼 5→4점 → medium(문서 표의 'high'는 neg 미반영이었음).
  { n: 7, codes: ['q2:analysisParalysis', 'csMain:cs_between', 'cx:goalClarityLow'], exp: { resolution: 'pattern', primary: 'noSelectionCriteria', confidence: 'medium' } },
  { n: 8, codes: ['csMain:cs_between', 'cx:goalClarityLow', 'cx:valueConflictPresent'], exp: { resolution: 'pattern', primary: 'noSelectionCriteria', confidence: 'high' } },
  { n: 9, codes: ['arNarrow:nr_explore', 'opt:rc_opt_many', 'cx:optionOverloadHigh'], exp: { resolution: 'pattern', primary: 'maximizer', confidence: 'high' } },
  { n: 10, codes: ['opt:rc_opt_many', 'cx:optionOverloadHigh', 'q2:analysisParalysis'], exp: { resolution: 'pattern', primary: 'analysisParalysis', confidence: 'medium' } },
  { n: 11, codes: ['q2:experimentAvoidance', 'val:rc_val_none'], exp: { resolution: 'pattern', primary: 'experimentAvoidance', confidence: 'medium' } },
  { n: 12, codes: ['blocker:blk_time', 'q2:procrastination'], exp: { resolution: 'pattern', primary: 'productiveProcrastination', confidence: 'high' } },
  { n: 13, codes: ['blocker:blk_time'], exp: { resolution: 'category_only', category: 'avoidance', confidence: 'low' } },
  { n: 14, codes: ['q3:impostor', 'sc:sc_market_only'], exp: { resolution: 'pattern', primary: 'impostor', confidence: 'medium' } },
  { n: 15, codes: ['sc:sc_market_only', 'blocker:blk_confidence', 'cx:selfEfficacyLow'], exp: { resolution: 'pattern', primary: 'lowSelfEfficacy', confidence: 'high' } },
  { n: 16, codes: ['q3:lowEfficacy', 'sc:sc_unsure'], exp: { resolution: 'pattern', primary: 'lowSelfEfficacy', confidence: 'medium' } },
  { n: 17, codes: ['blocker:blk_eyes', 'stated:safetyTop+challengeExp'], exp: { resolution: 'pattern', primary: 'tyrannyOfShoulds', confidence: 'medium' } },
  { n: 18, codes: ['blocker:blk_eyes', 'q4:closedEarly', 'cx:curiosityLow'], exp: { resolution: 'pattern', primary: 'tyrannyOfShoulds', secondary: 'identityForeclosure', confidence: 'medium' } },
  { n: 19, codes: ['q4:closedEarly', 'arNarrow:nr_decided', 'cx:curiosityLow'], exp: { resolution: 'pattern', primary: 'identityForeclosure', confidence: 'high' } },
  { n: 20, codes: ['q4:inBetween', 'csMain:cs_stay', 'profile:careerTransition'], exp: { resolution: 'pattern', primary: 'liminality', confidence: 'high' } },
  { n: 21, codes: ['blocker:blk_unclear'], exp: { resolution: 'insufficient_signal' } },
  { n: 22, codes: ['arNarrow:nr_loss', 'blocker:blk_fail'], exp: { resolution: 'category_only', category: 'instinctTrap', confidence: 'low' } },
];

for (const { n, codes, exp } of SIMS) {
  const r = classifyFromEvidence(codes);
  ok(`sim#${n} resolution=${exp.resolution}`, r.resolution === exp.resolution);
  if (exp.primary) ok(`sim#${n} primary=${exp.primary} (got ${r.primaryPattern})`, r.primaryPattern === exp.primary);
  if (exp.secondary) ok(`sim#${n} secondary=${exp.secondary} (got ${r.secondaryPattern})`, r.secondaryPattern === exp.secondary);
  if (exp.confidence) ok(`sim#${n} confidence=${exp.confidence} (got ${r.confidence})`, r.confidence === exp.confidence);
  if (exp.category) ok(`sim#${n} category=${exp.category} (got ${r.category})`, r.category === exp.category);
  // 불변식: category_only/insufficient는 primaryPattern 미노출
  if (exp.resolution !== 'pattern') ok(`sim#${n} no primary label on non-pattern`, r.primaryPattern === undefined);
  // 불변식: primary !== secondary
  ok(`sim#${n} primary≠secondary`, !r.secondaryPattern || r.secondaryPattern !== r.primaryPattern);
  // 불변식: version·evidenceCodes 유지
  ok(`sim#${n} version`, r.version === 'pattern-v1');
  ok(`sim#${n} evidenceCodes preserved`, exp.resolution === 'insufficient_signal' || codes.every((c) => r.evidenceCodes.includes(c)));
}

// ── 엣지: 판별 문항 미응답 — 기존 문항만으로도 분류 가능해야 ──
{
  const r = classifyFromEvidence(['csMain:cs_between', 'cx:goalClarityLow']);
  ok('edge: 기존 문항만(cs_between+goalClarityLow) → noSelectionCriteria pattern', r.resolution === 'pattern' && r.primaryPattern === 'noSelectionCriteria');
}

// ── 엣지: 완전 미응답 / 빈 증거 → insufficient_signal ──
{
  const r = classifyFromEvidence([]);
  ok('edge: 빈 증거 → insufficient_signal', r.resolution === 'insufficient_signal' && r.primaryPattern === undefined && r.confidence === 'low');
}

// ── 엣지: 손상 구버전 세션(알 수 없는 id·null·비배열) → 예외 없이 처리 ──
{
  const garbage = {
    responses: {
      cs_main: { selectedOptionIds: ['UNKNOWN_OPT'] },
      ar_narrow: undefined,
      pt_hold: { selectedOptionIds: [] },
      cv_priorities: { ranking: null as unknown as string[] },
      broken: { foo: 'bar' } as never,
    },
  };
  let threw = false; let codes: string[] = [];
  try { codes = extractEvidence(garbage); } catch { threw = true; }
  ok('edge: 손상 세션 extractEvidence 예외 없음', !threw);
  const r = classifyFromEvidence(codes);
  ok('edge: 손상 세션 분류 안전(insufficient/category)', r.resolution === 'insufficient_signal' || r.resolution === 'category_only');
}

// ── 엣지: 경쟁 유형 동점(margin 0, 둘 다 D, 둘 다 ≥3) → secondary 노출 + primary≠secondary ──
{
  const r = classifyFromEvidence(['csMain:cs_between', 'blocker:blk_eyes']); // 각 3점, 다른 범주
  ok('edge: 동점 → primary noSelectionCriteria(사전순)', r.primaryPattern === 'noSelectionCriteria');
  ok('edge: 동점 → secondary tyrannyOfShoulds 노출', r.secondaryPattern === 'tyrannyOfShoulds');
  ok('edge: 동점 primary≠secondary', r.primaryPattern !== r.secondaryPattern);
  ok('edge: 동점 confidence medium(≥3, D, margin<2)', r.confidence === 'medium');
}

// ── 엣지: 점수 부족(단일 약신호) → low/category_only, 특정 라벨 강제 안 함 ──
{
  const r = classifyFromEvidence(['blocker:blk_time']);
  ok('edge: 약신호 → category_only(avoidance), 라벨 미노출', r.resolution === 'category_only' && r.primaryPattern === undefined && r.category === 'avoidance');
}

// ── 불변식: movingGoalposts·anticipatedRegret는 절대 primary 아님(전용 신호 넣어도) ──
{
  const r1 = classifyFromEvidence(['arNarrow:nr_loss', 'blocker:blk_fail']); // anticipatedRegret 근사
  ok('invariant: anticipatedRegret never primary', r1.primaryPattern !== 'anticipatedRegret');
  const r2 = classifyFromEvidence(['csMain:cs_stay', 'q4:inBetween', 'profile:careerTransition']);
  ok('invariant: movingGoalposts never primary', r2.primaryPattern !== 'movingGoalposts');
  ok('CATEGORY_OF covers 16', (Object.keys(CATEGORY_OF).length === 16));
}

// ── extractEvidence 매핑 정확성(대표 응답 → 코드) ──
{
  const codes = extractEvidence({
    responses: {
      cs_main: { selectedOptionIds: ['cs_between'] },
      ar_narrow: { selectedOptionIds: ['nr_loss'] },
      cs_blocker: { selectedOptionIds: ['blk_eyes'] },
      sc_outlook: { selectedOptionIds: ['sc_market_only'] },
      pt_hold: { selectedOptionIds: ['pt_hold_sunk'] },
      pt_delay: { selectedOptionIds: ['pt_delay_fear'] },
      pt_confidence: { selectedOptionIds: ['pt_conf_impostor'] },
      pt_direction: { selectedOptionIds: ['pt_dir_closed'] },
      cv_values: { selectedOptionIds: ['a', 'b', 'c', 'd'] },
      cv_priorities: { ranking: ['pr_stability', 'pr_money'] },
      ap_experiment: { selectedOptionIds: ['ap_interview'] },
    },
  });
  const wants = ['csMain:cs_between', 'arNarrow:nr_loss', 'blocker:blk_eyes', 'sc:sc_market_only',
    'q1:sunkCost', 'q2:experimentAvoidance', 'q3:impostor', 'q4:closedEarly',
    'values:cvValuesMany', 'stated:safetyTop+challengeExp'];
  ok('extract: 대표 응답 → 코드 매핑', wants.every((w) => codes.includes(w)));
  ok('extract: 자유입력·원문 코드 없음(토큰만)', codes.every((c) => /^[a-zA-Z0-9_:+]+$/.test(c)));
}

// ── teaserTags: 2~3개, 코드 없는 것 스킵 ──
{
  const tags = teaserTags(['q1:sunkCost', 'arNarrow:nr_continuity', 'UNKNOWN_CODE', 'blocker:blk_eyes'], 3);
  ok('teaserTags: 최대 3개, 알 수 없는 코드 스킵', tags.length === 3 && tags.every((t) => typeof t === 'string' && t.length > 0));
}

// ── buildCareerPatternProfile 통합 진입점 동작 ──
{
  const p = buildCareerPatternProfile({
    responses: { pt_hold: { selectedOptionIds: ['pt_hold_sunk'] }, ar_narrow: { selectedOptionIds: ['nr_continuity'] } },
  });
  ok('build: pt_hold_sunk+nr_continuity → sunkCost pattern', p.resolution === 'pattern' && p.primaryPattern === 'sunkCost');
}

console.log(`✓ biasPatternEngine: ${passed} checks passed`);
