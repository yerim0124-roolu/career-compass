// biasPatternEngine.test.ts — 실행: node --experimental-strip-types <file>
// career-pattern-v1-spec.md §8의 22개 시뮬레이션 + 엣지 케이스(미응답·손상·동점·부족·마진).
// classifyFromEvidence는 증거코드 집합만 받는 순수 함수라 spec 시뮬레이션을 그대로 옮긴다.

import assert from 'node:assert';
import {
  classifyFromEvidence, extractEvidence, buildCareerPatternProfile, CATEGORY_OF, teaserTags,
  PATTERN_LABELS,
  type PatternId, type PatternCategory,
} from './biasPatternEngine.ts';
import { PATTERN_COPY } from '../components/careerCompassV2/patternTeaserCopy.ts';

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
  // impostor는 neverPrimary(pt_confidence 제거, 24→23) → 구체 패턴 미산출. 전용 신호만 있으면
  // lowSelfEfficacy 기준(cx:selfEfficacyLow 등) 미충족 시 상위 범주(identityConfusion)로만 귀결.
  { n: 14, codes: ['q3:impostor', 'sc:sc_market_only'], exp: { resolution: 'category_only', category: 'identityConfusion', confidence: 'low' } },
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

// ── 불변식(pt_confidence 제거, 24→23): impostor는 신규 분석에서 primary·secondary 모두 아님 ──
{
  // 전용 신호(q3:impostor)를 강하게 넣어도 impostor는 산출되지 않는다.
  const r1 = classifyFromEvidence(['q3:impostor', 'sc:sc_market_only']);
  ok('invariant: impostor never primary (전용 신호 넣어도)', r1.primaryPattern !== 'impostor');
  ok('invariant: impostor never secondary (전용 신호 넣어도)', r1.secondaryPattern !== 'impostor');
  // impostor 신호가 다른 후보와 경쟁해도 secondary로 새어나오지 않는다.
  const r2 = classifyFromEvidence(['q3:impostor', 'sc:sc_market_only', 'csMain:cs_between', 'cx:goalClarityLow']);
  ok('invariant: impostor 경쟁 상황에서도 primary 아님', r2.primaryPattern !== 'impostor');
  ok('invariant: impostor 경쟁 상황에서도 secondary 아님', r2.secondaryPattern !== 'impostor');
}

// ── 하위 호환: 신규 흐름(pt_confidence 미존재)이라도 lowSelfEfficacy는 실제 경로(cx:selfEfficacyLow)로 구체 분류 유지 ──
{
  const r = classifyFromEvidence(['cx:selfEfficacyLow', 'sc:sc_market_only', 'blocker:blk_confidence']);
  ok('compat: cx:selfEfficacyLow 경로로 lowSelfEfficacy 구체 분류 유지', r.resolution === 'pattern' && r.primaryPattern === 'lowSelfEfficacy');
}

// ── 하위 호환(렌더): PatternId 타입·라벨·카피에서 impostor를 삭제하지 않는다.
//    과거 세션이 primaryPattern:'impostor'를 갖고 있어도 PatternTeaserView가 기존 카피로 렌더 가능해야 한다. ──
{
  ok('compat: PATTERN_LABELS에 impostor 라벨 유지(과거 세션 렌더)', typeof PATTERN_LABELS.impostor === 'string' && PATTERN_LABELS.impostor.length > 0);
  const c = PATTERN_COPY.impostor;
  ok('compat: PATTERN_COPY에 impostor 카피 유지(과거 세션 렌더)',
    !!c && typeof c.inverted === 'string' && typeof c.statePara === 'string' && typeof c.mechanismPara === 'string' && typeof c.question === 'string');
  // 과거 저장 프로필(수동 구성)이 그대로 카피 조회 경로를 통과하는지 확인.
  const legacyProfile = { primaryPattern: 'impostor' as PatternId };
  ok('compat: 과거 impostor 프로필 → 라벨/카피 조회 성공', !!PATTERN_LABELS[legacyProfile.primaryPattern] && !!PATTERN_COPY[legacyProfile.primaryPattern]);
}

// ── pt_direction 재작성('방향의 유무' → '커리어-정체성 관계'): 신규 옵션 ID → 동일 q4 코드,
//    옵션1(aligned)·옵션4(exploring)은 부정 유형을 억지로 생성하지 않음, 구 옵션 ID 하위호환 ──
{
  const ev = (optId: string) => extractEvidence({ responses: { pt_direction: { selectedOptionIds: [optId] } } });
  // 신규 옵션 → evidence code 매핑
  ok('pt_direction: foreclosed → q4:closedEarly', ev('pt_dir_foreclosed').includes('q4:closedEarly'));
  ok('pt_direction: liminal → q4:inBetween', ev('pt_dir_liminal').includes('q4:inBetween'));
  ok('pt_direction: exploring → q4:open', ev('pt_dir_exploring').includes('q4:open'));
  // 옵션1(aligned): q4 코드 없음 → 부정 패턴 신호 없음
  ok('pt_direction: aligned → q4 코드 없음(부정 패턴 신호 없음)', !ev('pt_dir_aligned').some((c) => c.startsWith('q4:')));
  // 구버전 옵션 ID 하위호환(과거 저장 세션)
  ok('pt_direction(legacy): pt_dir_closed → q4:closedEarly', ev('pt_dir_closed').includes('q4:closedEarly'));
  ok('pt_direction(legacy): pt_dir_between → q4:inBetween', ev('pt_dir_between').includes('q4:inBetween'));
  ok('pt_direction(legacy): pt_dir_open → q4:open', ev('pt_dir_open').includes('q4:open'));
  ok('pt_direction(legacy): pt_dir_na → q4 코드 없음', !ev('pt_dir_na').some((c) => c.startsWith('q4:')));

  // 옵션2(foreclosed) → identityForeclosure 판별
  const foreclosed = buildCareerPatternProfile({ responses: { pt_direction: { selectedOptionIds: ['pt_dir_foreclosed'] }, ar_narrow: { selectedOptionIds: ['nr_decided'] } } });
  ok('pt_direction: foreclosed(+nr_decided) → identityForeclosure', foreclosed.resolution === 'pattern' && foreclosed.primaryPattern === 'identityForeclosure');
  // 옵션3(liminal) → liminality 판별
  const liminal = buildCareerPatternProfile({ responses: { pt_direction: { selectedOptionIds: ['pt_dir_liminal'] }, cs_main: { selectedOptionIds: ['cs_stay'] } } });
  ok('pt_direction: liminal(+cs_stay) → liminality', liminal.resolution === 'pattern' && liminal.primaryPattern === 'liminality');
  // 옵션1(aligned)·4(exploring)은 identityForeclosure/liminality를 강제하지 않는다
  const aligned = buildCareerPatternProfile({ responses: { pt_direction: { selectedOptionIds: ['pt_dir_aligned'] } } });
  ok('pt_direction: aligned → identityForeclosure/liminality 강제 안 함', aligned.primaryPattern !== 'identityForeclosure' && aligned.primaryPattern !== 'liminality');
  const exploring = buildCareerPatternProfile({ responses: { pt_direction: { selectedOptionIds: ['pt_dir_exploring'] } } });
  ok('pt_direction: exploring → identityForeclosure/liminality 강제 안 함', exploring.primaryPattern !== 'identityForeclosure' && exploring.primaryPattern !== 'liminality');
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
      // 과거 저장 세션이 남긴 pt_confidence — 신규 코드에서 매핑 제거됨(24→23). 안전 무시되어야 한다.
      pt_confidence: { selectedOptionIds: ['pt_conf_impostor'] },
      pt_direction: { selectedOptionIds: ['pt_dir_closed'] },
      cv_values: { selectedOptionIds: ['a', 'b', 'c', 'd'] },
      cv_priorities: { ranking: ['pr_stability', 'pr_money'] },
      ap_experiment: { selectedOptionIds: ['ap_interview'] },
    },
  });
  const wants = ['csMain:cs_between', 'arNarrow:nr_loss', 'blocker:blk_eyes', 'sc:sc_market_only',
    'q1:sunkCost', 'q2:experimentAvoidance', 'q4:closedEarly',
    'values:cvValuesMany', 'stated:safetyTop+challengeExp'];
  ok('extract: 대표 응답 → 코드 매핑', wants.every((w) => codes.includes(w)));
  // pt_confidence 제거: 저장된 응답이 있어도 q3:* 코드는 더 이상 생성되지 않는다(하위 호환 무시).
  ok('extract: 저장된 pt_confidence는 q3 코드 미생성(안전 무시)', !codes.some((c) => c.startsWith('q3:')));
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
