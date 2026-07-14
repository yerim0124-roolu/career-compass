// ─────────────────────────────────────────────────────────────────────────────
// biasPatternEngine.ts — Career Pattern v1 (16개 커리어 고민 패턴 결정론적 분류)
//
// 별도 additive 계층. 기존 의사결정 엔진(vector/construct/gates/classifyMainType/
// subtype/friction/readiness)의 값을 읽되 **절대 수정·재해석하지 않는다**. 이 모듈의
// 출력(CareerPatternProfile)은 기존 결과 필드를 대체하지 않으며, 엔진 라우팅에 되먹이지
// 않는다(storyInsight와 동일한 표시 전용 계약). 무료 화면 전용 — 유료로 전달하지 않는다.
//
// 설계 근거: docs/research/career-pattern-v1-spec.md (증거코드 §2, 규칙 §4, 충돌 §5,
//   산출 §6, fallback §7, 시뮬레이션 §8).
//
// 원칙:
//  - 단일 응답 하나로 특정 패턴을 확정하지 않는다: 구체 패턴명(resolution='pattern')은
//    판별 신호(discriminator) 보유 + 점수·마진 조건을 모두 만족할 때만 반환한다.
//  - 신호 부족이면 상위 범주(category_only) 또는 insufficient_signal로 폴백한다.
//  - movingGoalposts(종단 필요)·anticipatedRegret(전용 신호 없음)은 단일 세션에서
//    primary로 확정하지 않는다(neverPrimary).
//  - evidenceCodes에는 자유입력 원문·개인정보를 저장하지 않는다(선택 옵션 토큰만).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PatternId, PatternCategory, CareerPatternProfile,
  CareerVector, ConstructProfile, ReadinessGates, UserProfile,
} from '../types/careerCompass.ts';

export type { PatternId, PatternCategory, CareerPatternProfile } from '../types/careerCompass.ts';

// session.ts와의 순환 import 회피 — 최소 응답 형태만 받는다(storyInsight.ts와 동일 패턴).
export interface PatternResponses {
  [questionId: string]: { selectedOptionIds?: string[]; ranking?: string[] } | undefined;
}

export interface PatternInput {
  responses: PatternResponses;
  construct?: ConstructProfile;
  vector?: CareerVector;
  gates?: ReadinessGates;
  profile?: Pick<UserProfile, 'totalCareerStage' | 'currentFieldStage'>;
}

// ── 임계값 (career-pattern-v1-spec §6) ──
const LOW_MIN = 2, MED_MIN = 3, HIGH_MIN = 5, MARGIN_HIGH = 2;
// construct 임계는 resultContextEngine과 동일 스케일 재사용(값 읽기만, 미변경).
const C_HIGH = 66, C_PRESENT = 50, C_LOW = 33, V_HIGH = 60, V_MOD = 45;

export const CATEGORY_OF: Record<PatternId, PatternCategory> = {
  lossAversion: 'instinctTrap', endowmentEffect: 'instinctTrap', sunkCost: 'instinctTrap', ambiguityAversion: 'instinctTrap',
  maximizer: 'cognitiveOverload', anticipatedRegret: 'cognitiveOverload', analysisParalysis: 'cognitiveOverload', noSelectionCriteria: 'cognitiveOverload',
  productiveProcrastination: 'avoidance', movingGoalposts: 'avoidance', experimentAvoidance: 'avoidance',
  liminality: 'identityConfusion', tyrannyOfShoulds: 'identityConfusion', identityForeclosure: 'identityConfusion', impostor: 'identityConfusion', lowSelfEfficacy: 'identityConfusion',
};

// ─── 1) 증거 추출: 원답변 + 기산출 construct/vector/gates/profile → 코드 집합 ─────
const first = (r: PatternResponses, q: string): string | undefined => r[q]?.selectedOptionIds?.[0];

const STAGE_RANK: Record<string, number> = { total_0_3: 1, total_3_7: 2, total_7_12: 3, total_12_plus: 4 };
const CURRENT_RANK: Record<string, number> = { current_under_1: 0, current_1_3: 1, current_3_7: 2, current_7_plus: 3 };
const SAFETY_TOP = new Set(['pr_stability', 'pr_recovery']);
const CHALLENGE_EXP = new Set(['ap_interview', 'ap_content', 'ap_writing', 'ap_portfolio']);

export function extractEvidence(input: PatternInput): string[] {
  const { responses: r, construct, vector, gates, profile } = input;
  const E: string[] = [];
  const add = (c: string) => { if (!E.includes(c)) E.push(c); };

  // 신규 판별 문항(Q1~Q4)
  const map = (q: string, m: Record<string, string>) => { const id = first(r, q); if (id && m[id]) add(m[id]); };
  map('pt_hold', { pt_hold_sunk: 'q1:sunkCost', pt_hold_endow: 'q1:endowment', pt_hold_loss: 'q1:lossAversion', pt_hold_none: 'q1:none' });
  map('pt_delay', { pt_delay_analysis: 'q2:analysisParalysis', pt_delay_ambiguity: 'q2:ambiguity', pt_delay_fear: 'q2:experimentAvoidance', pt_delay_busy: 'q2:procrastination', pt_delay_acting: 'q2:acting' });
  // pt_confidence 문항 제거(24→23). 신규 흐름에서는 q3:* 코드가 더 이상 생성되지 않는다.
  // 과거 저장 세션의 responses.pt_confidence는 매핑하지 않아 안전하게 무시된다.
  map('pt_direction', { pt_dir_closed: 'q4:closedEarly', pt_dir_between: 'q4:inBetween', pt_dir_open: 'q4:open' });

  // 기존 문항(원답변 읽기만)
  const cs = first(r, 'cs_main'); if (cs) add(`csMain:${cs}`);
  const nr = first(r, 'ar_narrow'); if (nr) add(`arNarrow:${nr}`);
  const blk = first(r, 'cs_blocker'); if (blk) add(`blocker:${blk}`);
  const sc = first(r, 'sc_outlook'); if (sc) add(`sc:${sc}`);
  const opt = first(r, 'rc_options'); if (opt) add(`opt:${opt}`);
  const val = first(r, 'rc_validation'); if (val) add(`val:${val}`);
  if ((r['cv_values']?.selectedOptionIds?.length ?? 0) >= 4) add('values:cvValuesMany');

  // 기산출 construct(임계 재사용 — 값 읽기만)
  if (construct) {
    const { scct, adaptability, difficulty, mcda } = construct;
    if (difficulty.optionOverload >= C_HIGH) add('cx:optionOverloadHigh');
    if (difficulty.valueConflict >= C_PRESENT) add('cx:valueConflictPresent');
    if (difficulty.marketInformationGap >= C_PRESENT) add('cx:marketInfoGapHigh');
    if (scct.selfEfficacy <= C_LOW) add('cx:selfEfficacyLow');
    if (scct.goalClarity <= C_LOW) add('cx:goalClarityLow');
    if (adaptability.curiosity <= C_LOW) add('cx:curiosityLow');
    if (vector && vector.expertise >= V_HIGH && mcda.assetLeverage <= C_LOW) add('cx:careerCapitalAnxiety');
  }
  if (vector && vector.executionDrive < V_MOD) add('cx:executionDriveLow');

  // gates / profile 전환
  if (gates?.risk === 'none') add('gate:riskNone');
  const tr = profile?.totalCareerStage ? STAGE_RANK[profile.totalCareerStage] : undefined;
  const cr = profile?.currentFieldStage ? CURRENT_RANK[profile.currentFieldStage] : undefined;
  if (tr !== undefined && cr !== undefined && tr - cr >= 2) add('profile:careerTransition');

  // stated-vs-revealed (안정/회복 1순위 ∧ 도전형 실험)
  const topPr = (r['cv_priorities']?.ranking ?? [])[0];
  const exp = first(r, 'ap_experiment');
  if (topPr && SAFETY_TOP.has(topPr) && exp && CHALLENGE_EXP.has(exp)) add('stated:safetyTop+challengeExp');

  return E;
}

// ─── 2) 규칙 테이블 (career-pattern-v1-spec §4) ─────────────────────────────────
interface Rule {
  pos: Record<string, number>;
  neg: Record<string, number>;
  discriminator: (has: (c: string) => boolean) => boolean;
  veto?: (has: (c: string) => boolean) => boolean;
  primaryRequires?: (has: (c: string) => boolean) => boolean;
  neverPrimary?: boolean;
}

const RULES: Record<PatternId, Rule> = {
  // A. instinctTrap
  lossAversion: {
    pos: { 'q1:lossAversion': 3, 'arNarrow:nr_loss': 2, 'arNarrow:nr_safety': 2, 'blocker:blk_fail': 1, 'gate:riskNone': 1 },
    neg: { 'q1:sunkCost': 2, 'q1:endowment': 2 },
    discriminator: (h) => h('q1:lossAversion'),
  },
  endowmentEffect: {
    pos: { 'q1:endowment': 3, 'arNarrow:nr_continuity': 1 },
    neg: { 'q1:sunkCost': 2, 'q1:lossAversion': 2 },
    discriminator: (h) => h('q1:endowment'),
    primaryRequires: (h) => h('q1:endowment'),
  },
  sunkCost: {
    pos: { 'q1:sunkCost': 3, 'arNarrow:nr_continuity': 2, 'cx:careerCapitalAnxiety': 1 },
    neg: { 'q1:endowment': 2, 'q1:lossAversion': 1 },
    discriminator: (h) => h('q1:sunkCost'),
  },
  ambiguityAversion: {
    pos: { 'q2:ambiguity': 3, 'arNarrow:nr_unsure': 1, 'blocker:blk_fail': 1 },
    neg: { 'q2:acting': 2 },
    discriminator: (h) => h('q2:ambiguity'),
    primaryRequires: (h) => h('q2:ambiguity'),
  },
  // B. cognitiveOverload
  maximizer: {
    pos: { 'arNarrow:nr_explore': 2, 'opt:rc_opt_many': 2, 'cx:optionOverloadHigh': 1, 'values:cvValuesMany': 1 },
    neg: { 'q2:analysisParalysis': 1, 'csMain:cs_between': 1 },
    discriminator: (h) => h('arNarrow:nr_explore') || (h('opt:rc_opt_many') && h('cx:optionOverloadHigh')),
  },
  anticipatedRegret: {
    pos: { 'arNarrow:nr_loss': 1, 'blocker:blk_fail': 1 },
    neg: { 'q1:lossAversion': 1 },
    discriminator: () => false,
    neverPrimary: true, // 전용 신호 부재 → 단일 세션에서 primary 확정 금지(spec §4 B2)
  },
  analysisParalysis: {
    pos: { 'q2:analysisParalysis': 3, 'cx:marketInfoGapHigh': 1, 'cx:executionDriveLow': 1 },
    neg: { 'csMain:cs_between': 2, 'cx:goalClarityLow': 1 },
    discriminator: (h) => h('q2:analysisParalysis'),
    veto: (h) => h('cx:goalClarityLow') && h('csMain:cs_between') && !h('q2:analysisParalysis'),
  },
  noSelectionCriteria: {
    pos: { 'csMain:cs_between': 3, 'cx:goalClarityLow': 2, 'cx:valueConflictPresent': 1, 'opt:rc_opt_several': 1 },
    neg: { 'q2:analysisParalysis': 1 },
    discriminator: (h) => h('csMain:cs_between') || h('cx:goalClarityLow'),
  },
  // C. avoidance
  productiveProcrastination: {
    pos: { 'q2:procrastination': 3, 'blocker:blk_time': 2 },
    neg: { 'q2:experimentAvoidance': 2, 'q2:acting': 2 },
    discriminator: (h) => h('q2:procrastination'),
    veto: (h) => h('q2:acting'),
  },
  movingGoalposts: {
    pos: {}, neg: {},
    discriminator: () => false,
    neverPrimary: true, // 시간축 반복이 본질 → 단일 세션 불가(spec §4 C2)
  },
  experimentAvoidance: {
    pos: { 'q2:experimentAvoidance': 3, 'val:rc_val_none': 1, 'gate:riskNone': 1 },
    neg: { 'q2:procrastination': 1, 'q2:acting': 2 },
    discriminator: (h) => h('q2:experimentAvoidance'),
    veto: (h) => h('q2:acting'),
  },
  // D. identityConfusion
  liminality: {
    pos: { 'q4:inBetween': 3, 'csMain:cs_stay': 1, 'profile:careerTransition': 1 },
    neg: { 'q4:closedEarly': 2, 'q4:open': 1 },
    discriminator: (h) => h('q4:inBetween'),
    veto: (h) => h('q4:closedEarly'),
  },
  tyrannyOfShoulds: {
    pos: { 'blocker:blk_eyes': 3, 'stated:safetyTop+challengeExp': 1 },
    neg: {},
    discriminator: (h) => h('blocker:blk_eyes'),
  },
  identityForeclosure: {
    pos: { 'q4:closedEarly': 3, 'arNarrow:nr_decided': 1, 'cx:curiosityLow': 1 },
    neg: { 'q4:inBetween': 2, 'q4:open': 2 },
    discriminator: (h) => h('q4:closedEarly'),
    veto: (h) => h('q4:open'),
  },
  impostor: {
    pos: { 'q3:impostor': 3, 'sc:sc_market_only': 1 },
    neg: { 'q3:lowEfficacy': 2, 'q3:healthy': 2 },
    discriminator: (h) => h('q3:impostor'),
    primaryRequires: (h) => h('q3:impostor'),
    // pt_confidence 문항 제거(24→23)에 따라 impostor 전용 판별 신호(q3:impostor)가
    // 신규 흐름에서 더 이상 생성되지 않는다. 신규 분석에서 impostor를 구체 패턴으로
    // 산출하지 않도록 primary·secondary 후보에서 영구 제외한다. 규칙/라벨/카피는 과거
    // 세션 렌더 호환을 위해 그대로 유지한다(PatternId 타입도 삭제하지 않음).
    neverPrimary: true,
  },
  lowSelfEfficacy: {
    pos: { 'cx:selfEfficacyLow': 2, 'sc:sc_market_only': 2, 'blocker:blk_confidence': 2, 'sc:sc_unsure': 1, 'q3:lowEfficacy': 2 },
    neg: { 'q3:impostor': 2, 'q3:healthy': 2, 'sc:sc_both': 1 },
    discriminator: (h) => h('cx:selfEfficacyLow') || h('q3:lowEfficacy'),
    veto: (h) => h('sc:sc_both') && !h('cx:selfEfficacyLow') && !h('q3:lowEfficacy') && !h('sc:sc_market_only') && !h('blocker:blk_confidence'),
  },
};

const ALL_PATTERNS = Object.keys(RULES) as PatternId[];

function rawPositive(id: PatternId, has: (c: string) => boolean): number {
  const { pos } = RULES[id];
  return Object.entries(pos).reduce((s, [c, w]) => s + (has(c) ? w : 0), 0);
}
function score(id: PatternId, has: (c: string) => boolean): number {
  const { pos, neg } = RULES[id];
  let s = 0;
  for (const [c, w] of Object.entries(pos)) if (has(c)) s += w;
  for (const [c, w] of Object.entries(neg)) if (has(c)) s -= w;
  return s;
}

// ─── 3) 분류: 증거 코드 → CareerPatternProfile (spec §6·§7) ──────────────────────
export function classifyFromEvidence(evidenceCodes: string[]): CareerPatternProfile {
  const codes = [...new Set(evidenceCodes)];
  const set = new Set(codes);
  const has = (c: string) => set.has(c);

  // primary 후보: neverPrimary 아님, veto 아님, primaryRequires 충족, score ≥ LOW_MIN.
  const scored = ALL_PATTERNS.map((id) => ({ id, s: score(id, has) }));
  const eligible = scored.filter(({ id, s }) => {
    const r = RULES[id];
    if (r.neverPrimary) return false;
    if (r.veto?.(has)) return false;
    if (r.primaryRequires && !r.primaryRequires(has)) return false;
    return s >= LOW_MIN;
  });

  const base = (extra: Partial<CareerPatternProfile>): CareerPatternProfile =>
    ({ confidence: 'low', evidenceCodes: codes, resolution: 'insufficient_signal', version: 'pattern-v1', ...extra });

  // 정렬: 점수 desc → discriminator 보유 우선 → PatternId 사전순(결정론).
  const ranked = [...eligible].sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    const da = RULES[a.id].discriminator(has) ? 1 : 0;
    const db = RULES[b.id].discriminator(has) ? 1 : 0;
    if (db !== da) return db - da;
    return a.id < b.id ? -1 : 1;
  });

  // ── 명시 충돌 오버라이드 (spec §5-9): blk_eyes ∧ closedEarly → 당위=primary, 조기결정=secondary ──
  if (has('blocker:blk_eyes') && has('q4:closedEarly')) {
    const primaryScore = score('tyrannyOfShoulds', has);
    const D = RULES.tyrannyOfShoulds.discriminator(has);
    const confidence = D && primaryScore >= HIGH_MIN ? 'high' : D && primaryScore >= MED_MIN ? 'medium' : 'low';
    if (confidence === 'low') {
      return base({ resolution: 'category_only', category: 'identityConfusion' });
    }
    return base({
      primaryPattern: 'tyrannyOfShoulds', secondaryPattern: 'identityForeclosure',
      category: 'identityConfusion', confidence, resolution: 'pattern',
    });
  }

  if (ranked.length === 0) {
    // fallback: 범주별 raw positive 합
    const catScore: Record<PatternCategory, number> = { instinctTrap: 0, cognitiveOverload: 0, avoidance: 0, identityConfusion: 0 };
    for (const id of ALL_PATTERNS) catScore[CATEGORY_OF[id]] += Math.max(0, rawPositive(id, has));
    const topCat = (Object.entries(catScore) as [PatternCategory, number][]).sort((a, b) => b[1] - a[1])[0];
    if (topCat[1] >= LOW_MIN) return base({ resolution: 'category_only', category: topCat[0], confidence: 'low' });
    return base({ resolution: 'insufficient_signal', confidence: 'low' });
  }

  const primary = ranked[0];
  const runnerUp = ranked[1];
  const margin = primary.s - (runnerUp ? runnerUp.s : 0);
  const D = RULES[primary.id].discriminator(has);

  // confidence: 구체 패턴명은 판별 신호(D) 보유 시에만. (spec §6·§10: medium 이상만 패턴명 노출)
  //   D 없으면 low → 상위 범주만 표시.
  let confidence: 'low' | 'medium' | 'high';
  if (D && primary.s >= HIGH_MIN && margin >= MARGIN_HIGH) confidence = 'high';
  else if (D && primary.s >= MED_MIN) confidence = 'medium';
  else confidence = 'low';

  if (confidence === 'low') {
    // 특정 16 라벨을 억지로 반환하지 않는다 → 상위 범주만.
    return base({ resolution: 'category_only', category: CATEGORY_OF[primary.id], confidence: 'low' });
  }

  // secondary: 근접 동률(margin < MARGIN_MED=1)이고 secondaryScore ≥ MED_MIN일 때만 노출. primary와 상이 보장.
  let secondaryPattern: PatternId | undefined;
  if (runnerUp && runnerUp.id !== primary.id && runnerUp.s >= MED_MIN && margin < 1) {
    secondaryPattern = runnerUp.id;
  }

  return base({
    primaryPattern: primary.id,
    secondaryPattern,
    category: CATEGORY_OF[primary.id],
    confidence,
    resolution: 'pattern',
  });
}

// ─── 4) 통합 진입점 ─────────────────────────────────────────────────────────────
export function buildCareerPatternProfile(input: PatternInput): CareerPatternProfile {
  return classifyFromEvidence(extractEvidence(input));
}

// ─── 5) 표시용 라벨·카피 (무료 티저 전용 — 임상 진단 어투 금지) ──────────────────
export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  instinctTrap: '본능의 덫', cognitiveOverload: '인지 과부하', avoidance: '회피 행동', identityConfusion: '정체성 혼란',
};

export const PATTERN_LABELS: Record<PatternId, string> = {
  lossAversion: '손실을 크게 느끼는 마음', endowmentEffect: '가진 것을 놓기 어려운 마음', sunkCost: '들인 것이 아까운 마음', ambiguityAversion: '불확실함을 피하려는 마음',
  maximizer: '더 나은 선택을 찾는 마음', anticipatedRegret: '미리 후회를 걱정하는 마음', analysisParalysis: '분석이 길어지는 상태', noSelectionCriteria: '고를 기준이 아직 없는 상태',
  productiveProcrastination: '바쁨으로 미루는 패턴', movingGoalposts: '기준이 계속 올라가는 패턴', experimentAvoidance: '작은 시도를 미루는 패턴',
  liminality: '전환의 중간에 선 상태', tyrannyOfShoulds: "'해야 한다'에 눌린 마음", identityForeclosure: '일찍 방향을 닫은 상태', impostor: '스스로를 낮게 보는 마음', lowSelfEfficacy: '해낼 자신이 흔들리는 마음',
};

// 사용자 응답을 직접 인용하지 않는 2~3문장 설명(표시 전용).
export const PATTERN_TEASER: Record<PatternId, string> = {
  lossAversion: '무언가를 얻는 것보다 잃는 쪽을 더 크게 느끼는 흐름이 보여요. 그래서 비교를 아무리 더 해도 쉽게 결정이 서지 않아요. 필요한 건 더 비교가 아니라, 무엇을 먼저 지킬지 정하는 거예요.',
  endowmentEffect: '지금 가진 것을 넘기는 일이 유독 무겁게 느껴지는 흐름이에요. 그 무게는 방향이 틀려서가 아니라, 이미 내 것이 된 것에 대한 자연스러운 마음일 수 있어요.',
  sunkCost: '지금까지 들인 시간과 노력이 아까워 쉽게 놓지 못하는 흐름이에요. 그 경험은 버릴 것이 아니라 다음으로 이어갈 자산 — 질문은 무엇을 고를까가 아니라 어떻게 연결할까예요.',
  ambiguityAversion: '결과가 어떻게 될지 모른다는 불확실함 자체가 발을 붙잡는 흐름이에요. 더 확실해지길 기다리기보다, 작게 한 번 부딪혀 불확실함을 줄이는 편이 빠를 수 있어요.',
  maximizer: '더 나은 선택이 있을까 싶어 쉽게 하나로 좁히지 못하는 흐름이에요. 부족한 게 아니라 너무 넓게 열려 있는 것 — 지금은 고르기보다 실제로 확인할 몇 개만 남기는 게 먼저예요.',
  anticipatedRegret: '고른 뒤에 후회할까 미리 걱정하는 마음이 함께 보여요. 다만 이 신호만으로 단정하기는 일러, 다른 답변과 함께 살펴봐야 또렷해져요.',
  analysisParalysis: '정보를 조금만 더 모으면 답이 나올 것 같아 자꾸 알아보게 되는 흐름이에요. 답은 대개 더 조사가 아니라 작은 시도에서 와요.',
  noSelectionCriteria: '길은 보이는데 무엇을 먼저 둘지 기준이 아직 서지 않은 상태예요. 지금 필요한 건 더 많은 선택지가 아니라, 무엇을 먼저 볼지 정하는 한 줄의 기준이에요.',
  productiveProcrastination: '바쁜 일들에 밀려 정작 중요한 결정이 뒤로 미뤄지는 흐름이에요. 새 일을 더하기보다 지금 하나를 덜어내는 게 진짜 첫 단계일 수 있어요.',
  movingGoalposts: '기준이 조금씩 올라가는 패턴은 한 번의 답변만으로는 확인하기 어려워요. 시간을 두고 다시 살펴봐야 또렷해지는 신호예요.',
  experimentAvoidance: '방향은 어렴풋이 있는데 작게라도 내보내는 걸 미루는 흐름이에요. 크게 걸지 않고 되돌릴 수 있는 작은 크기부터 시작하면 돼요.',
  liminality: '예전 방향은 이미 놓았는데 새 방향은 아직 잡히지 않은, 전환의 중간에 서 있는 상태예요. 지금은 서둘러 정하기보다 이 사이 시기를 견디는 힘이 먼저예요.',
  tyrannyOfShoulds: "'이래야 한다'는 바깥의 기준이 결정을 무겁게 누르는 흐름이에요. 그 결정을 책임지는 건 결국 나 — 남의 기준과 내 기준을 나눠 적어보는 게 먼저예요.",
  identityForeclosure: '여러 가능성을 살펴보기 전에 일찍 방향을 닫아둔 상태에 가까워요. 닫은 문을 다시 여는 게 아니라, 정말 그 방향이 내 기준인지 한 번 확인해보는 거예요.',
  impostor: '좋은 성과에도 스스로를 낮게 보는 마음이 함께 보여요. 다만 이는 실력의 문제가 아니라 자기 평가의 습관에 가까울 수 있어요.',
  lowSelfEfficacy: '해낼 수 있을지에 대한 자신이 흔들리는 흐름이에요. 자신감은 생각이 아니라 작은 성공에서 와서, 이번 달은 큰 결정보다 작게 한 번 해보기가 먼저예요.',
};

// 근거 태그(2~3개) — 무료 티저용 짧은 사람말. 없는 코드는 건너뛴다. 원문·개인정보 미포함.
const EVIDENCE_TAG_LABELS: Record<string, string> = {
  'q1:sunkCost': '들인 노력에 대한 아까움', 'q1:endowment': '가진 것을 놓는 부담', 'q1:lossAversion': '잃는 것에 대한 두려움',
  'arNarrow:nr_continuity': '쌓아온 경험과의 연결', 'arNarrow:nr_loss': '선택 시 상실감', 'arNarrow:nr_safety': '돈·안정에 대한 고려', 'arNarrow:nr_explore': '가능성을 열어두려는 마음',
  'q2:analysisParalysis': '정보 수집이 길어지는 흐름', 'q2:ambiguity': '불확실함에 대한 망설임', 'q2:experimentAvoidance': '작은 시도를 미룸', 'q2:procrastination': '바쁨에 밀린 결정',
  'q3:impostor': '성과를 낮게 보는 습관', 'q3:lowEfficacy': '해낼 자신의 흔들림',
  'q4:closedEarly': '방향을 일찍 닫음', 'q4:inBetween': '전환의 중간 상태',
  'csMain:cs_between': '기준이 서지 않는 상태', 'blocker:blk_eyes': '주변 시선에 대한 신경', 'blocker:blk_time': '시간·에너지 부족',
  'cx:selfEfficacyLow': '자신감 신호', 'cx:goalClarityLow': '목표 선명도 신호', 'cx:optionOverloadHigh': '선택지 과잉 신호', 'cx:marketInfoGapHigh': '시장 반응 미확인',
  'sc:sc_market_only': '외부 반응에 대한 불확실', 'blocker:blk_confidence': '자신감에 대한 신경',
  'gate:riskNone': '감당 여력 신호', 'profile:careerTransition': '큰 방향 전환 이력', 'values:cvValuesMany': '지키고 싶은 가치가 많음',
};

// 표시용 태그 2~3개 추출(순서 보존).
export function teaserTags(evidenceCodes: string[], max = 3): string[] {
  const out: string[] = [];
  for (const c of evidenceCodes) {
    const t = EVIDENCE_TAG_LABELS[c];
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
