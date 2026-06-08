// Story Insight — "내가 어떤 갈등 때문에 막혔는지를 읽어준 것 같다"는 느낌을 만드는 결정론적
// 추론 한 줄. 핵심 원칙: 고른 답을 *되돌려 말하지(앵무새)* 않는다. 대신 고른 답들이 *부딪히는
// 지점*(고르지 않았지만 그 조합이 가리키는 긴장)을 짚는다 — 그게 인사이트로 읽힌다.
//
// 근거: INSIGHT-INFERENCE-CATALOG.md (Savickas CCI / Holland 분화도·일관성 / Super 생애역할).
// LLM 없이(무비용) 손으로 작성. 적용 규칙이 없으면 null → 결과지에 아무것도 안 붙는다
// (억지 문장보다 없는 게 낫다는 사용자 방침).
//
// 표시 전용. 엔진은 절대 읽지 않는다(라우팅·분류 무관, P2.0 패스스루로 스파인에 실림).

import type { UserProfile } from '../types/careerCompass.ts';

// 세션 응답의 최소 형태만 받는다(session.ts 순환 import 회피).
export interface InsightResponses {
  [questionId: string]: { selectedOptionIds?: string[]; ranking?: string[] } | undefined;
}

const PR_LABEL: Record<string, string> = {
  pr_money: '돈', pr_meaning: '의미', pr_freedom: '자유', pr_growth: '성장',
  pr_stability: '안정', pr_influence: '영향력', pr_recovery: '회복',
};

// 도전형(손이 먼저 가는) 실험 — A5 stated-vs-revealed 용.
const CHALLENGE_EXPERIMENT_LABEL: Record<string, string> = {
  ap_interview: '사람들과 대화·인터뷰로 수요 확인하기',
  ap_content: '짧은 콘텐츠로 반응 보기',
  ap_writing: '글·리포트로 생각 풀어내기',
  ap_portfolio: '포트폴리오·케이스 정리해 보여주기',
};
const SAFETY_FIRST = new Set(['pr_stability', 'pr_recovery']);
const VENTURE_ROLES = new Set(['ar_founder', 'ar_freelancer']);
// toward-신호용: 가치가 가리키는 방향과 끌리는 역할이 같은 곳을 보는지.
const PEOPLE_IMPACT_ROLES = new Set(['ar_advisor', 'ar_leader', 'ar_helper']); // 영향력·의미 ↔ 사람 이끌고 돕기
const AUTONOMY_ROLES = new Set(['ar_freelancer', 'ar_founder', 'ar_creator']);  // 자유 ↔ 독립·창작

// 가치 충돌 페어 — 정렬된 키(a|b) → '왜 이게 막힘인지'를 짚는 한 줄.
// 같은 결(안정+회복 등)은 충돌이 아니라 제외. 페어는 양방향 모두 같은 문구.
const TENSION_PAIRS: Record<string, string> = {
  'pr_freedom|pr_stability':
    '안정과 자유를 나란히 위에 두셨어요. 이 둘은 보통 서로 반대쪽을 가리켜서, 한쪽을 고르면 다른 쪽을 버리는 것처럼 느껴지죠 — 결정이 막히는 지점이 정확히 거기예요.',
  'pr_growth|pr_stability':
    '안정과 성장이 1·2순위로 붙어 있어요. 성장은 흔들림을 요구하고, 안정은 바로 그 흔들림을 피하려 하죠. 두 마음이 동시에 있으니 어느 쪽으로도 쉽게 못 기우는 거예요.',
  'pr_meaning|pr_money':
    '돈과 의미를 동시에 윗줄에 두셨어요. 둘이 같은 방향을 가리켰다면 고민도 없었을 텐데, 지금은 갈라져 있어서 어느 쪽도 쉽게 내려놓지 못하는 상태예요.',
  'pr_influence|pr_recovery':
    '더 큰 영향력을 내고 싶은 마음과, 회복하고 싶은 마음이 같이 있어요. 액셀과 브레이크를 동시에 밟는 상태라, 애써도 제자리처럼 느껴지는 거예요.',
  'pr_growth|pr_recovery':
    '성장하고 싶은 마음과 쉬고 싶은 마음이 부딪혀요. 더 하고 싶은데 이미 지쳐 있는 신호 — 방향보다 에너지가 먼저 풀려야 할 때일 수 있어요.',
  'pr_freedom|pr_money':
    '돈과 자유를 같이 위에 두셨어요. 보통 한쪽을 늘리면 다른 쪽이 줄어드는 관계라, 둘 다 지키려다 결정이 멈춰 선 거예요.',
};

const first = (r: InsightResponses, q: string): string | undefined => r[q]?.selectedOptionIds?.[0];
const reactionEmotion = (r: InsightResponses, q: string, prefix: string): string | undefined => {
  const id = first(r, q);
  return id?.startsWith(prefix) ? id.slice(prefix.length) : undefined;
};

const STAGE_RANK: Record<string, number> = { total_0_3: 1, total_3_7: 2, total_7_12: 3, total_12_plus: 4 };
const CURRENT_RANK: Record<string, number> = { current_under_1: 0, current_1_3: 1, current_3_7: 2, current_7_plus: 3 };

// 우선순위 가장 강한 인사이트 하나만 반환(없으면 null). 순서 = '갈등을 읽어준' 강도 순.
export function buildStoryInsight(profile: UserProfile, responses: InsightResponses): string | null {
  const ranking = responses.cv_priorities?.ranking ?? [];
  const top = ranking[0];
  const second = ranking[1];

  // R1 — 말한 선호 vs 행동 (A5). 가장 강한 단서: 행동은 거짓말을 덜 한다.
  const chosen = first(responses, 'ap_experiment');
  if (top && SAFETY_FIRST.has(top) && chosen && CHALLENGE_EXPERIMENT_LABEL[chosen]) {
    return `우선순위 1순위로는 ${PR_LABEL[top]}을 꼽으셨는데, 정작 직접 고른 이번 달 시도는 ‘${CHALLENGE_EXPERIMENT_LABEL[chosen]}’예요. 말보다 손이 먼저 간 쪽 — 어쩌면 그쪽이 더 당기는 건 아닐까요?`;
  }

  // R2 — 가치 충돌 페어 (상위 2개가 서로 반대 방향).
  if (top && second) {
    const key = [top, second].sort().join('|');
    if (TENSION_PAIRS[key]) return TENSION_PAIRS[key];
  }

  // R6 — 자신감 비대칭 (SCCT: 자기효능 vs 결과기대). 어느 쪽이 병목인지 정확히 짚는다.
  const sc = first(responses, 'sc_outlook');
  if (sc === 'sc_self_only') {
    return '‘내가 잘 해낼 수 있다’는 자신은 있는데, ‘시장이 반응할까’가 불안한 상태예요. 실력 문제가 아니라 검증 문제라서, 작게 한 번 내보내 실제 반응을 받아보는 게 가장 빠른 해소예요.';
  }
  if (sc === 'sc_market_only') {
    return '‘되긴 될 것 같은데, 내가 해낼 수 있을까’가 걸리는 상태예요. 외부 조건보다 자기 확신이 병목이라, 작은 성공 한 번이 생각보다 크게 풀어줄 거예요.';
  }

  // R7 — 가치 과다선택 (Holland 미분화, A3). "몰라서"가 아니라 "못 버려서".
  const valueCount = responses.cv_values?.selectedOptionIds?.length ?? 0;
  if (valueCount >= 5) {
    return '중요하게 여기는 가치를 여러 개 고르셨어요. 무엇을 원하는지 몰라서가 아니라, 어느 하나도 포기하고 싶지 않은 상태에 가까워요 — 그래서 지금 필요한 건 더 찾기가 아니라 ‘무엇을 안 할지’를 정하는 거예요.';
  }

  // R3 — 감정 나침반 (A7). 세 방향 반응의 감정 분포.
  const emotions = [
    reactionEmotion(responses, 'or_content', 'orc_'),
    reactionEmotion(responses, 'or_venture', 'orv_'),
    reactionEmotion(responses, 'or_internal', 'ori_'),
  ].filter((e): e is string => !!e);
  if (emotions.length >= 2) {
    const energizedCount = emotions.filter((e) => e === 'energized').length;
    const flatCount = emotions.filter((e) => e === 'capable_flat' || e === 'money_tiring' || e === 'stable_flat').length;
    if (energizedCount === 1) {
      return '세 방향에 대한 반응 중 ‘설렘’이 켜진 건 딱 한 곳뿐이었어요. 점수나 조건보다, 그 한 곳이 지금 당신의 진짜 나침반일 수 있어요.';
    }
    if (energizedCount === 0 && flatCount >= 2) {
      return '어느 방향에도 큰 설렘은 없고, ‘잘하긴 하지만 무덤덤’에 가까웠어요. 이건 방향을 못 정한 게 아니라, 지금은 회복이나 의미가 먼저 채워져야 한다는 신호일 수 있어요.';
    }
  }

  // R4 — 비일관 프로파일 (A3): 안정·회복이 1순위인데 끌리는 역할엔 창업·독립.
  const roles = responses.ar_roles?.selectedOptionIds ?? [];
  if (top && SAFETY_FIRST.has(top) && roles.some((r) => VENTURE_ROLES.has(r))) {
    return `1순위는 ${PR_LABEL[top]}인데, 끌리는 역할에는 직접 만들거나 독립해서 일하는 모습이 들어 있어요. 원하는 것과 스스로에게 허락한 것이 다른 상태 — 갈등이라기보다, 안정을 깨지 않는 작은 크기의 시도부터 풀어야 할 문제예요.`;
  }

  // R8 — 탈출 신호 (away-from, A4): '계속할지/쉴지' 고민인데 끌리는 다른 방향은 또렷하지 않음.
  const csMain = first(responses, 'cs_main');
  const noPull = emotions.length >= 2 && emotions.every((e) => e !== 'energized');
  if ((csMain === 'cs_stay' || csMain === 'cs_rest') && noPull) {
    return '지금 일을 계속할지 고민이신데, 끌리는 다른 방향이 또렷하진 않아요. 이건 ‘어디로 갈까’보다 ‘여기서 뭐가 안 맞나’를 먼저 봐야 하는 신호예요 — 떠나기 전에, 지금 가장 걸리는 한 가지부터 한 문장으로 적어보세요.';
  }

  // R9 — 가치-역할 일치 (toward, 긍정): 원하는 가치와 끌리는 역할이 같은 곳을 가리킴.
  // 갈등이 없는 또렷한 프로파일에게 '아무것도 없음' 대신 방향을 확인해주는 affirming 인사이트.
  if (top) {
    const peopleImpact = (top === 'pr_influence' || top === 'pr_meaning') && roles.some((r) => PEOPLE_IMPACT_ROLES.has(r));
    const autonomy = top === 'pr_freedom' && roles.some((r) => AUTONOMY_ROLES.has(r));
    if (peopleImpact || autonomy) {
      const what = peopleImpact ? '사람을 이끌고 돕는 쪽' : '내 방식대로 일하는 쪽';
      return `원하는 가치(${PR_LABEL[top]})와 끌리는 역할(${what})이 같은 곳을 가리켜요. 방향은 이미 또렷한 편이에요 — 그래서 진짜 질문은 ‘무엇을’이 아니라 ‘언제, 어떻게’일 거예요.`;
    }
  }

  // R10 — 결정 블로커 리프레임 (B: cs_blocker). 거의 모두가 답하는 신호라 커버리지 높은
  // 폴백. 단순 되돌려 말하기가 아니라, 막는 것을 *다시 보게* 하는 리프레임 + 일부는 다른
  // 신호와 교차해 더 날카롭게(blk_unclear인데 끌림이 또렷하면 "모르는 게 아니라 책임이 두려운 것").
  const blocker = first(responses, 'cs_blocker');
  if (blocker) {
    const hasEnergizedPull = emotions.includes('energized');
    switch (blocker) {
      case 'blk_unclear':
        return hasEnergizedPull
          ? '막는 건 ‘뭘 원하는지 모르겠다’고 하셨지만, 답변에는 분명히 설렘이 켜진 방향이 있었어요. 모르는 게 아니라, 고른 걸 책임지는 게 두려운 것에 더 가까울 수 있어요.'
          : '막는 건 ‘뭘 원하는지 아직 모르겠다’예요. 그렇다면 지금은 결정을 내릴 때가 아니라, 작게 부딪혀보며 ‘이건 아니다/이건 좀 낫다’를 모으는 탐색이 먼저예요.';
      case 'blk_confidence':
        return '막는 건 자신감이에요. 그런데 자신감은 머리로 생각해서가 아니라 작은 성공에서 와요 — 그래서 이번 달 플랜이 ‘큰 결정’이 아니라 ‘작게 한 번 해보기’인 거예요.';
      case 'blk_money':
        return '막는 건 돈·현실 조건이에요. 방향이 틀려서가 아니라 런웨이 문제라서, 결정을 미루기보다 ‘얼마가 있으면 움직일 수 있는지’ 숫자부터 정하면 의외로 빨리 풀려요.';
      case 'blk_eyes':
        return '막는 건 주변의 시선이에요. 그런데 그 결정을 5년 뒤 책임지는 건 그분들이 아니라 당신이에요 — 남의 기준과 내 기준을 종이 한 장에 나눠 적어보는 게 먼저예요.';
      case 'blk_fail':
        return '막는 건 ‘잘못되면 되돌리기 어려울까 봐’예요. 그래서 플랜이 큰 베팅이 아니라 ‘되돌릴 수 있는 작은 실험’으로 짜여 있어요 — 실패해도 잃는 게 적은 크기부터 시작하면 돼요.';
      case 'blk_time':
        return '막는 건 시간·에너지예요. 그렇다면 새 일을 더하는 게 아니라, 지금 하고 있는 것 중 하나를 덜어내는 게 진짜 첫 단계일 수 있어요. 비우지 않으면 새 칸이 안 생기거든요.';
    }
  }

  // R5 — 이력 전환 (A1): 전체 경력 ≫ 현재 분야 경력.
  const tr = profile.totalCareerStage ? STAGE_RANK[profile.totalCareerStage] : undefined;
  const cr = profile.currentFieldStage ? CURRENT_RANK[profile.currentFieldStage] : undefined;
  if (tr !== undefined && cr !== undefined && tr - cr >= 2) {
    return '지금 분야의 경력보다 전체 경력이 훨씬 길어요. 이미 한 번 크게 방향을 바꿔본 분이라는 뜻이에요 — 이번 고민도 ‘처음 내리는 결정’이 아니라 ‘또 한 번 내리는 결정’이라는 걸, 스스로 기억해두면 한결 가벼워져요.';
  }

  return null;
}
