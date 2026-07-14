// patternTeaserCopy.ts — 무료 PatternTeaserView 전용 표시 카피 계층(순수 데이터).
//
// biasPatternEngine의 점수·분류·confidence·fallback 규칙은 건드리지 않는다. 이 파일은
// PatternId/PatternCategory → 사용자용 카피만 매핑한다(반전 헤드라인·개인화 2문단·
// 미해결 질문·사용자 언어 신호 태그·심층 미리보기·CTA). 임상 진단·확정 어투 금지,
// 사용자 자유입력 원문 미인용. 근거: docs/research/career-pattern-v1-spec.md.

import type { PatternId, PatternCategory } from '../../types/careerCompass.ts';

export interface PatternCopy {
  academic: string;      // 이론적 패턴명(개념어)
  inverted: string;      // 반전형 헤드라인(패턴명 반복 대신 재해석)
  statePara: string;     // 현재 답변에서 보이는 상태
  mechanismPara: string; // 놓치고 있을 핵심 메커니즘
  question: string;      // 아직 풀리지 않은 핵심 질문(무료에선 답을 주지 않음)
}

export const PATTERN_COPY: Record<PatternId, PatternCopy> = {
  lossAversion: {
    academic: '손실 회피',
    inverted: '결정을 못 하는 게 아니라, 잃는 쪽이 더 크게 보이는 거예요.',
    statePara: '지금 답변에는 무언가를 얻는 것보다 잃지 않으려는 무게가 더 크게 실려 있어요. 그래서 선택지를 아무리 비교해도 쉽게 한쪽으로 기울지 않는 상태예요.',
    mechanismPara: '놓치기 쉬운 건, 지금 필요한 게 더 나은 비교가 아니라 “무엇을 먼저 지킬지”라는 점이에요. 기준이 서면 같은 선택지도 훨씬 가벼워져요.',
    question: '그렇다면, 당신이 정말 잃으면 안 되는 한 가지는 무엇일까요?',
  },
  endowmentEffect: {
    academic: '소유 효과',
    inverted: '방향이 틀린 게 아니라, 이미 내 것이 된 걸 넘기기가 무거운 거예요.',
    statePara: '답변에는 지금 가진 것(자리·안정·관계)을 넘기는 일이 유독 무겁게 느껴지는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 그 무게가 “이게 최선이라서”가 아니라 “이미 가졌기 때문에” 커진다는 점이에요. 그 둘을 나눠 보면 판단이 달라질 수 있어요.',
    question: '지금 가진 것을, 정말 원해서 지키는 걸까요 아니면 익숙해서 지키는 걸까요?',
  },
  sunkCost: {
    academic: '매몰비용',
    inverted: '지금까지 쌓은 게 아까운 거지, 방향이 틀린 게 아니에요.',
    statePara: '답변에는 지금까지 들인 시간과 노력이 아까워 쉽게 놓지 못하는 흐름이 뚜렷해요.',
    mechanismPara: '놓치기 쉬운 건, 그 경험이 “버려야 할 비용”이 아니라 “다음으로 이어갈 자산”이라는 점이에요. 진짜 질문은 무엇을 버릴까가 아니라 어떻게 이을까예요.',
    question: '지금까지의 경험을, 다음 방향으로 어떻게 이어붙일 수 있을까요?',
  },
  ambiguityAversion: {
    academic: '모호성 회피',
    inverted: '실력이 없는 게 아니라, 결과를 모른다는 게 발을 붙잡는 거예요.',
    statePara: '답변에는 결과가 어떻게 될지 모른다는 불확실함 자체가 시작을 망설이게 하는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 확실해질 때까지 기다리는 것보다 작게 한 번 부딪혀 불확실함을 줄이는 게 빠르다는 점이에요.',
    question: '확실해지면 움직이려는 걸까요, 아니면 움직여야 확실해지는 걸까요?',
  },
  maximizer: {
    academic: '극대화 함정',
    inverted: '방향이 없는 게 아니라, 놓치고 싶지 않은 게 너무 많은 거예요.',
    statePara: '답변에는 더 나은 선택이 있을까 싶어 쉽게 하나로 좁히지 못하는 흐름이 보여요. 관심이 부족한 게 아니라 너무 넓게 열려 있는 상태예요.',
    mechanismPara: '놓치기 쉬운 건, 지금 필요한 게 “고르기”가 아니라 “실제로 확인할 두세 개만 남기기”라는 점이에요.',
    question: '지금 열어둔 가능성 중, 이번 달에 실제로 확인해볼 두세 개는 무엇일까요?',
  },
  anticipatedRegret: {
    academic: '예기된 후회',
    inverted: '고르기 싫은 게 아니라, 미리 후회를 걱정하는 거예요.',
    statePara: '답변에는 고른 뒤에 후회할까 미리 걱정하는 마음이 함께 보여요.',
    mechanismPara: '놓치기 쉬운 건, 이 신호만으로는 아직 단정하기 어렵다는 점이에요. 다른 답변과 함께 봐야 또렷해져요.',
    question: '어떤 선택이든, 후회를 덜 하려면 무엇이 필요할까요?',
  },
  analysisParalysis: {
    academic: '분석 마비',
    inverted: '게으른 게 아니라, 답을 찾으려 계속 알아보는 중인 거예요.',
    statePara: '답변에는 정보를 조금만 더 모으면 답이 나올 것 같아 계속 검토하게 되는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 답이 대개 “더 많은 조사”가 아니라 “작은 시도”에서 온다는 점이에요.',
    question: '지금 부족한 건 정보일까요, 아니면 한 번 부딪혀본 경험일까요?',
  },
  noSelectionCriteria: {
    academic: '선택 기준 부재',
    inverted: '길이 안 보이는 게 아니라, 무엇을 먼저 볼지 기준이 없는 거예요.',
    statePara: '답변에는 길은 여럿 보이는데 무엇을 먼저 둘지 기준이 아직 서지 않은 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 지금 필요한 게 “더 많은 선택지”가 아니라 “무엇을 먼저 볼지”를 정하는 한 줄의 기준이라는 점이에요.',
    question: '무엇이 충족되면, 이 결정을 “됐다”고 말할 수 있을까요?',
  },
  productiveProcrastination: {
    academic: '생산적 지연',
    inverted: '의지가 약한 게 아니라, 바쁜 일들이 진짜 결정을 미루는 거예요.',
    statePara: '답변에는 급한 일들에 밀려 정작 중요한 결정이 계속 뒤로 미뤄지는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 새 일을 더하는 것보다 지금 하나를 덜어내는 게 진짜 첫 단계라는 점이에요. 비워야 새 칸이 생겨요.',
    question: '이번 달, 무엇을 덜어내면 이 고민에 손댈 여유가 생길까요?',
  },
  movingGoalposts: {
    academic: '목표점 이동',
    inverted: '만족을 못 하는 게 아니라, 기준이 계속 올라가는 거예요.',
    statePara: '답변에는 조건이 채워질 때마다 기준이 조금씩 올라가는 흐름의 실마리가 보여요.',
    mechanismPara: '놓치기 쉬운 건, 이 패턴은 한 번의 답변보다 시간을 두고 다시 봐야 또렷해진다는 점이에요.',
    question: '지난달과 지금, 당신이 세운 기준은 얼마나 달라졌을까요?',
  },
  experimentAvoidance: {
    academic: '실험 회피',
    inverted: '방향이 없는 게 아니라, 내보내는 걸 미루고 있는 거예요.',
    statePara: '답변에는 방향은 어렴풋이 있는데 작게라도 내보내는 걸 망설이는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 큰 결정이 아니라 “되돌릴 수 있는 작은 크기”부터 시작하면 된다는 점이에요.',
    question: '실패해도 잃을 게 적은, 이번 달의 가장 작은 시도는 무엇일까요?',
  },
  liminality: {
    academic: '리미널리티(전환기)',
    inverted: '길을 잃은 게 아니라, 전환의 중간에 서 있는 거예요.',
    statePara: '답변에는 예전 방향은 이미 놓았는데 새 방향은 아직 잡히지 않은, 사이에 선 상태가 보여요.',
    mechanismPara: '놓치기 쉬운 건, 이 시기가 “빨리 벗어나야 할 공백”이 아니라 “방향이 정해지기 전의 자연스러운 과정”이라는 점이에요.',
    question: '지금의 “사이 시기”가 당신에게 무엇을 준비시키고 있는 걸까요?',
  },
  tyrannyOfShoulds: {
    academic: '당위적 사고',
    inverted: '당신이 원하는 게 아니라, “해야 한다”가 결정을 누르고 있어요.',
    statePara: '답변에는 “이래야 한다”는 바깥의 기준이 결정을 무겁게 만드는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 그 결정을 5년 뒤 책임지는 건 그 기준을 준 사람들이 아니라 당신이라는 점이에요.',
    question: '지금의 기준 중, 정말 “내 것”은 어디까지일까요?',
  },
  identityForeclosure: {
    academic: '정체성 조기 결정',
    inverted: '확신이 있는 게 아니라, 일찍 문을 닫아둔 것일 수 있어요.',
    statePara: '답변에는 여러 가능성을 살펴보기 전에 일찍 방향을 정해둔 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 닫은 문을 다시 여는 게 아니라 “정말 그 방향이 내 기준인지” 한 번 확인해보는 일이라는 점이에요.',
    question: '지금의 방향은, 충분히 살펴본 뒤의 선택이었을까요?',
  },
  impostor: {
    academic: '가면 증후군',
    inverted: '실력이 부족한 게 아니라, 스스로를 낮게 보는 습관일 수 있어요.',
    statePara: '답변에는 좋은 성과에도 “운이 좋았을 뿐”이라며 스스로를 낮게 보는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 이게 능력의 문제가 아니라 “성과를 자기 것으로 인정하는 방식”의 문제일 수 있다는 점이에요.',
    question: '지금까지의 성과 중, 온전히 “내 실력”으로 인정할 수 있는 건 무엇일까요?',
  },
  lowSelfEfficacy: {
    academic: '자기효능감 저하',
    inverted: '방향이 없는 게 아니라, 해낼 수 있을지 자신이 흔들리는 거예요.',
    statePara: '답변에는 “내가 잘 해낼 수 있을까”에 대한 자신이 흔들리는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 자신감이 생각이 아니라 “작은 성공”에서 온다는 점이에요. 그래서 지금은 큰 결정보다 작게 한 번 해보기가 먼저예요.',
    question: '이번 달, 작은 성공 하나를 만든다면 무엇이 좋을까요?',
  },
};

// category_only용 상위 범주 카피.
export interface CategoryCopy {
  inverted: string; statePara: string; mechanismPara: string; question: string;
}
export const CATEGORY_COPY: Record<PatternCategory, CategoryCopy> = {
  instinctTrap: {
    inverted: '결정을 못 하는 게 아니라, 놓기 어려운 무언가가 있는 거예요.',
    statePara: '지금 답변에는 무언가를 잃거나 놓는 일에 대한 무게가 결정을 어렵게 하는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 방향이 틀려서가 아니라 “무엇을, 왜 놓기 어려운지”를 아직 정리하지 않았기 때문일 수 있다는 점이에요.',
    question: '지금 가장 놓기 어려운 한 가지는 무엇이고, 왜일까요?',
  },
  cognitiveOverload: {
    inverted: '방향이 없는 게 아니라, 생각할 거리가 너무 많은 거예요.',
    statePara: '답변에는 선택지와 기준이 많아 하나로 좁히기 어려운 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 지금 필요한 게 “더 찾기”가 아니라 “무엇을 먼저 볼지 정하기”라는 점이에요.',
    question: '지금 열려 있는 것들 중, 무엇을 먼저 좁혀야 할까요?',
  },
  avoidance: {
    inverted: '의지가 약한 게 아니라, 결정이 자꾸 뒤로 밀리는 거예요.',
    statePara: '답변에는 중요한 결정이 여러 이유로 계속 미뤄지는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 큰 결심보다 아주 작게 한 번 움직여보는 게 첫 단계라는 점이에요.',
    question: '이번 달, 미루지 않고 할 수 있는 가장 작은 한 걸음은 무엇일까요?',
  },
  identityConfusion: {
    inverted: '길을 잃은 게 아니라, 지금 방향과 나를 다시 맞춰보는 시기예요.',
    statePara: '답변에는 지금의 방향·정체성을 다시 정리하려는 흐름이 보여요.',
    mechanismPara: '놓치기 쉬운 건, 서둘러 정하기보다 이 과정을 견디는 힘이 먼저라는 점이에요.',
    question: '지금 당신은, 어떤 사람으로 일하고 싶은 걸까요?',
  },
};

export const INSUFFICIENT_COPY = {
  inverted: '지금은 하나의 패턴으로 좁히기 어렵습니다.',
  statePara: '답변만으로는 아직 한 방향으로 신호가 모이지 않았어요. 여러 마음이 비슷한 크기로 섞여 있는 상태에 가까워요.',
  mechanismPara: '이럴 때일수록 재정·가족·현실 조건까지 함께 놓고 봐야 무엇이 진짜 결정을 막는지 또렷해져요. 심화 분석이 그 정리를 도와요.',
  question: '지금 가장 크게 걸리는 한 가지부터 정리해보면 어떨까요?',
};

// ── 사용자 언어 신호 태그 — 내부 변수명 금지. evidenceCode가 실제 있을 때만 표시. ──
export const SIGNAL_TAG_LABELS: Record<string, string> = {
  'q1:sunkCost': '지금까지 들인 노력을 놓기 어려움',
  'q1:endowment': '지금 가진 것을 넘기기 부담스러움',
  'q1:lossAversion': '무엇을 고르든 잃는 게 두려움',
  'q2:analysisParalysis': '행동보다 비교·검토가 앞서고 있음',
  'q2:ambiguity': '결과가 불확실해 시작을 망설임',
  'q2:experimentAvoidance': '작게 내보내는 걸 미루고 있음',
  'q2:procrastination': '바쁜 일에 밀려 결정을 미룸',
  'q3:impostor': '성과를 온전히 내 것으로 못 느낌',
  'q3:lowEfficacy': '해낼 수 있을지 자신이 흔들림',
  'q4:closedEarly': '방향을 일찍 정하고 닫아둠',
  'q4:inBetween': '예전 방향은 놓고 새 방향은 미정',
  'arNarrow:nr_continuity': '쌓아온 경험과 이어지려는 마음',
  'arNarrow:nr_loss': '선택할 때마다 잃는 느낌',
  'arNarrow:nr_safety': '돈·안정이 쉽게 놓지 못하게 함',
  'arNarrow:nr_explore': '여러 가능성을 동시에 열어두고 있음',
  'arNarrow:nr_decided': '이미 방향을 거의 정해둠',
  'csMain:cs_between': '무엇을 먼저 둘지 기준이 안 섬',
  'csMain:cs_stay': '지금 일을 계속할지 고민 중',
  'csMain:cs_many': '하고 싶은 게 많아 못 좁힘',
  'blocker:blk_eyes': '주변의 시선·기대가 신경 쓰임',
  'blocker:blk_fail': '되돌리기 어려울까 두려움',
  'blocker:blk_time': '시간·에너지가 부족함',
  'blocker:blk_confidence': '잘 해낼 자신이 부족함',
  'sc:sc_market_only': '실력보다 외부 반응이 더 불안함',
  'sc:sc_unsure': '해낼 수 있을지 아직 확신이 없음',
  'opt:rc_opt_many': '선택지가 너무 많아 분산됨',
  'opt:rc_opt_several': '선택지는 있는데 고르기 어려움',
  'cx:optionOverloadHigh': '여러 가능성을 동시에 열어둠',
  'cx:valueConflictPresent': '중요하게 여기는 조건들이 서로 충돌함',
  'cx:goalClarityLow': '무엇을 먼저 볼지 기준이 흐릿함',
  'cx:marketInfoGapHigh': '실제 반응을 아직 확인 못 함',
  'cx:selfEfficacyLow': '해낼 자신이 흔들림',
  'cx:curiosityLow': '새로 살펴보려는 마음이 약함',
  'cx:careerCapitalAnxiety': '쌓은 걸 못 쓸까 하는 불안',
  'gate:riskNone': '지금은 감당할 여력이 적음',
  'profile:careerTransition': '이미 한 번 크게 방향을 바꾼 이력',
  'values:cvValuesMany': '지키고 싶은 게 여러 개',
  'stated:safetyTop+challengeExp': '안정을 원하면서도 도전에 끌림',
};

// evidenceCodes에서 실제 뒷받침되는 사용자 언어 신호 2~3개(존재하는 코드만, 중복 제거).
export function readSignals(evidenceCodes: string[], max = 3): string[] {
  const out: string[] = [];
  for (const c of evidenceCodes) {
    const label = SIGNAL_TAG_LABELS[c];
    if (label && !out.includes(label)) out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

// 심층 분석 미리보기 — 사용자에게 제공되는 4개 항목(구체적).
export const DEEP_PREVIEW_ITEMS: string[] = [
  '실제로 지키고 싶은 조건',
  '현실적 위험과 심리적 두려움의 구분',
  '현재 조건에 맞는 전환 방식',
  '30일 실행 실험과 재판단 기준',
];

export const CTA_PRIMARY = '내 고민의 원인과 30일 계획 확인하기';
export const CTA_SUB = '추가 질문 12개 · 약 3분 · 개인화된 심층 결과';
