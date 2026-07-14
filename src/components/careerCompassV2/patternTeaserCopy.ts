// patternTeaserCopy.ts — 무료 PatternTeaserView 전용 표시 카피 계층(순수 데이터).
//
// biasPatternEngine의 점수·분류·confidence·fallback 규칙은 건드리지 않는다. 이 파일은
// PatternId/PatternCategory → 사용자용 카피만 매핑한다(반전 헤드라인·개인화 2문단·
// 미해결 질문·사용자 언어 신호 태그·심층 미리보기·CTA). 임상 진단·확정 어투 금지,
// 사용자 자유입력 원문 미인용. 근거: docs/research/career-pattern-v1-spec.md,
// docs/research/career-pattern-copy-final-review.md.

import type { PatternId, PatternCategory } from '../../types/careerCompass.ts';

export interface PatternCopy {
  academic: string;      // 이론적 패턴명(개념어)
  inverted: string;      // 반전형 헤드라인(패턴명 반복 대신 재해석)
  statePara: string;     // 현재 답변에서 보이는 상태
  mechanismPara: string; // 놓치고 있을 핵심 메커니즘
  question: string;      // 아직 풀리지 않은 핵심 질문(무료에선 답을 주지 않음)
}

export const PATTERN_COPY: Record<PatternId, PatternCopy> = {
  // ── A. 본능의 덫(instinctTrap) ──────────────────────────────────────────────
  lossAversion: {
    academic: '손실 회피',
    inverted: '결정을 못 하는 게 아니라, 잃을 가능성을 더 크게 보고 있는 거예요.',
    statePara: '지금 답변에서는 새로 얻을 것보다 잃게 될 것을 먼저 계산하는 모습이 두드러져요. 그래서 조건을 여러 번 비교해도 쉽게 한쪽을 고르지 못해요.',
    mechanismPara: '필요한 건 더 정밀한 비교가 아니라, 무엇을 잃어도 괜찮고 무엇은 지켜야 하는지 먼저 정하는 일이에요. 그 선이 없으면 어떤 선택지든 손해처럼 보여요.',
    question: '지금 지키려는 건 꼭 필요한 안전일까요, 아니면 익숙함을 놓치기 싫은 마음일까요?',
  },
  endowmentEffect: {
    academic: '소유 효과',
    inverted: '방향이 틀린 게 아니라, 지금 가진 자리를 실제보다 높게 매기고 있는 거예요.',
    statePara: '답변을 보면 지금의 자리·소속·관계를 내려놓는 결정이 유독 크게 다가와요. 새 선택지의 장점보다 지금 것을 잃는다는 감각이 앞서요.',
    mechanismPara: '같은 조건이라도 이미 내 것이 된 건 더 비싸게 느껴지기 마련이에요. 그 웃돈을 걷어내고 봐야 지금 자리의 진짜 가치가 보여요.',
    question: '지금 가진 걸 남이 새로 제안한 조건이라 생각해도, 똑같이 붙잡게 될까요?',
  },
  sunkCost: {
    academic: '매몰비용',
    inverted: '앞으로 얻을 것보다, 이미 들인 시간이 결정을 붙잡고 있어요.',
    statePara: '답변에는 지금까지 쏟은 시간과 노력이 아까워 방향을 바꾸기 어려워하는 마음이 뚜렷해요. 앞으로의 이득보다 지나온 과정이 판단 기준이 되고 있어요.',
    mechanismPara: '이미 쓴 시간은 어느 쪽을 골라도 돌아오지 않아요. 그래서 진짜 질문은 얼마나 들였나가 아니라, 지금부터 무엇이 남느냐예요.',
    question: '과거에 들인 시간을 빼고 본다면, 지금도 같은 선택을 하게 될까요?',
  },
  ambiguityAversion: {
    academic: '모호성 회피',
    inverted: '실력이 부족한 게 아니라, 결과를 알 수 없다는 것 자체가 발을 붙잡는 거예요.',
    statePara: '답변을 보면 잘될지 아닐지 가늠되지 않는 선택 앞에서 시작을 미루게 돼요. 실패가 두렵다기보다 예측이 안 되는 상태가 더 불편한 쪽이에요.',
    mechanismPara: '불확실함은 기다린다고 줄지 않아요. 작게 한 번 해보는 순간부터 정보가 쌓이고, 그때 비로소 안개가 걷혀요.',
    question: '확실해지면 움직이려는 걸까요, 아니면 움직여야 확실해지는 걸까요?',
  },
  // ── B. 인지 과부하(cognitiveOverload) ───────────────────────────────────────
  maximizer: {
    academic: '극대화 함정',
    inverted: '방향이 없는 게 아니라, 어느 것도 놓치고 싶지 않은 거예요.',
    statePara: '답변에는 더 나은 선택이 남아 있을까 싶어 후보를 좀처럼 좁히지 못하는 모습이 있어요. 관심이 부족해서가 아니라, 괜찮아 보이는 길을 너무 많이 살려두고 있어요.',
    mechanismPara: '모든 조건을 만족하는 최선은 대개 존재하지 않아요. 지금 필요한 건 더 찾기가 아니라, 실제로 시험해볼 두세 개만 남기고 나머지를 내려놓는 일이에요.',
    question: '지금 열어둔 선택지 중, 이번 달에 실제로 확인해볼 두세 개는 무엇일까요?',
  },
  anticipatedRegret: {
    academic: '예기된 후회',
    inverted: '고르기 싫은 게 아니라, 나중에 후회할 자신이 먼저 떠오르는 거예요.',
    statePara: '답변에는 어떤 선택이든 훗날 후회하게 될까 미리 걱정하는 마음이 함께 나타나요.',
    mechanismPara: '다만 이 신호 하나만으로는 방향을 단정하기 일러요. 다른 답변과 함께 봐야 후회를 피하려는 마음이 어디서 오는지 또렷해져요.',
    question: '어떤 선택을 하든, 나중의 나에게 덜 미안하려면 지금 무엇이 필요할까요?',
  },
  analysisParalysis: {
    academic: '분석 마비',
    inverted: '게으른 게 아니라, 확신이 설 때까지 계속 알아보는 중인 거예요.',
    statePara: '답변에는 조금만 더 알아보면 답이 나올 것 같아 조사와 비교를 멈추기 어려운 모습이 있어요. 정작 실제로 움직이는 단계는 계속 뒤로 밀려요.',
    mechanismPara: '정보가 늘수록 확신이 커질 것 같지만, 대개 따져볼 선택지만 더 늘어나요. 답은 한 번 해본 경험에서 오는 경우가 많아요.',
    question: '지금 더 필요한 건 정보일까요, 아니면 행동을 시작할 기준일까요?',
  },
  noSelectionCriteria: {
    academic: '선택 기준 부재',
    inverted: '길이 안 보이는 게 아니라, 무엇을 먼저 볼지 기준이 아직 없는 거예요.',
    statePara: '답변에는 갈 만한 길은 여럿 있는데 무엇을 우선할지 정해지지 않은 상태가 드러나요. 그래서 비교를 시작해도 결론이 잘 나지 않아요.',
    mechanismPara: '선택지가 많아 막힌 게 아니라, 무엇을 얻고 무엇을 포기할지 정하는 한 줄이 없어서예요. 기준이 서면 후보 절반은 저절로 정리돼요.',
    question: '무엇이 충족되면, 이 결정을 이제 됐다고 말할 수 있을까요?',
  },
  // ── C. 회피 행동(avoidance) ─────────────────────────────────────────────────
  productiveProcrastination: {
    academic: '생산적 지연',
    inverted: '의지가 약한 게 아니라, 바쁜 일들이 진짜 결정을 대신 미뤄주는 거예요.',
    statePara: '답변에는 눈앞의 급한 일을 처리하느라 정작 중요한 결정은 계속 다음으로 넘기는 모습이 있어요. 아무것도 안 한 건 아닌데 핵심은 그대로 남아 있어요.',
    mechanismPara: '바쁨은 결정을 미루고 있다는 불편함을 잠시 덮어줘요. 새 일을 더하기보다 지금 하나를 덜어내야 핵심에 손댈 자리가 생겨요.',
    question: '이번 달, 무엇을 덜어내면 미뤄둔 그 결정에 손댈 여유가 생길까요?',
  },
  movingGoalposts: {
    academic: '목표점 이동',
    inverted: '만족을 못 하는 게 아니라, 시작할 조건이 계속 뒤로 밀리는 거예요.',
    statePara: '답변에는 한 조건이 채워지면 또 다른 조건을 붙이게 되는 실마리가 있어요. 이것만 되면 시작하자는 기준이 계속 갱신돼요.',
    mechanismPara: '이 패턴은 한 번의 답변보다 시간을 두고 다시 볼 때 또렷해져요. 지금은 시작 조건이 실제로 움직였는지부터 확인하면 좋아요.',
    question: '지난달에 정한 시작 조건과 지금의 조건은 얼마나 달라졌을까요?',
  },
  experimentAvoidance: {
    academic: '실험 회피',
    inverted: '방향이 없는 게 아니라, 작게 시험해보는 걸 미루고 있는 거예요.',
    statePara: '답변에는 방향은 어느 정도 있는데 작게라도 시도해 결과를 확인하는 걸 망설이는 모습이 있어요. 시도가 곧 나에 대한 평가처럼 느껴지는 쪽이에요.',
    mechanismPara: '작은 실험은 당신을 판정하는 시험이 아니라 정보를 얻는 장치예요. 되돌릴 수 있는 크기로 시작하면 결과가 나빠도 잃을 게 크지 않아요.',
    question: '실패해도 잃을 게 적은, 이번 달의 가장 작은 시도는 무엇일까요?',
  },
  // ── D. 정체성 혼란(identityConfusion) ───────────────────────────────────────
  liminality: {
    academic: '리미널리티(전환기)',
    inverted: '길을 잃은 게 아니라, 하나의 정체성과 다음 정체성 사이에 있는 거예요.',
    statePara: '답변에는 예전의 방향은 이미 놓았는데 새 방향은 아직 잡히지 않은 상태가 드러나요. 어느 쪽에도 온전히 속하지 않은 시기예요.',
    mechanismPara: '이 사이의 시기는 빨리 벗어나야 할 공백이 아니라, 다음 정체성이 자리 잡기 전의 자연스러운 과정이에요. 서둘러 이름표를 붙이면 오히려 더 오래 걸려요.',
    question: '지금의 사이 시기는 당신에게 무엇을 준비시키고 있는 걸까요?',
  },
  tyrannyOfShoulds: {
    academic: '당위적 사고',
    inverted: '당신이 원하는 게 아니라, 해야 한다가 결정을 대신 누르고 있어요.',
    statePara: '답변에는 내가 무엇을 원하는지보다 이래야 한다는 바깥 기준이 결정을 앞서는 모습이 있어요. 주변의 시선과 기대가 판단에 먼저 들어와요.',
    mechanismPara: '해야 한다를 따르면 당장은 안전하지만, 그 결정을 몇 년 뒤 감당하는 건 기준을 준 사람들이 아니라 당신이에요. 어디까지가 내 기준인지 나눠볼 필요가 있어요.',
    question: '지금 따르는 기준 중, 정말 내 것이라 할 수 있는 건 어디까지일까요?',
  },
  identityForeclosure: {
    academic: '정체성 조기 결정',
    inverted: '확신이 선 게 아니라, 일찍 방향을 정하고 문을 닫아둔 것일 수 있어요.',
    statePara: '답변에는 여러 가능성을 살펴보기 전에 방향을 일찍 정해둔 모습이 있어요. 지금은 그 선택을 별다른 의심 없이 유지하는 쪽이에요.',
    mechanismPara: '일찍 정한 방향이 틀렸다는 뜻은 아니에요. 다만 충분히 살펴본 뒤의 선택인지, 그때 받아들인 기대인지는 한 번 확인해볼 만해요.',
    question: '지금의 방향은 충분히 살펴본 뒤의 선택이었을까요, 아니면 그때 주어진 기대였을까요?',
  },
  impostor: {
    academic: '가면 증후군',
    inverted: '실력이 부족한 게 아니라, 성과를 온전히 내 것으로 인정하지 못하는 거예요.',
    statePara: '답변에는 좋은 결과를 내고도 운이 좋았을 뿐이라며 자신의 몫을 낮게 보는 마음이 있어요.',
    mechanismPara: '이건 능력의 문제가 아니라 성과를 받아들이는 방식의 문제일 수 있어요. 무엇을 이뤘는지보다 그걸 어떻게 해석하는지가 발목을 잡아요.',
    question: '지금까지의 성과 중, 온전히 내 실력으로 인정할 수 있는 건 무엇일까요?',
  },
  lowSelfEfficacy: {
    academic: '자기효능감 저하',
    inverted: '방향이 없는 게 아니라, 해낼 수 있을지에 대한 자신이 흔들리는 거예요.',
    statePara: '답변에는 방향보다 내가 이걸 잘 해낼 수 있을까라는 물음이 결정을 망설이게 하는 모습이 있어요. 하고 싶은 게 없다기보다 해낼 자신이 서지 않는 쪽이에요.',
    mechanismPara: '자신감은 마음먹기가 아니라 작은 성공의 경험에서 쌓여요. 그래서 지금은 큰 결정을 내리기보다, 해낼 수 있다는 증거를 하나 만드는 게 먼저예요.',
    question: '이번 달에 해냈다고 말할 만한 가장 작은 성공을 만든다면, 무엇이 좋을까요?',
  },
};

// category_only용 상위 범주 카피. 구체 패턴을 암시하지 않고, 두 갈래 정도만 예시로 남긴다.
export interface CategoryCopy {
  inverted: string; statePara: string; mechanismPara: string; question: string;
}
export const CATEGORY_COPY: Record<PatternCategory, CategoryCopy> = {
  instinctTrap: {
    inverted: '결정을 못 하는 게 아니라, 쉽게 놓지 못하는 무언가가 있는 거예요.',
    statePara: '지금 답변에서는 무언가를 잃거나 내려놓는 일이 결정을 어렵게 만드는 쪽으로 신호가 모여요. 다만 그게 손실 걱정인지, 지금 가진 것에 대한 애착인지, 들인 시간 때문인지까지는 아직 하나로 좁혀지지 않아요.',
    mechanismPara: '방향이 틀려서가 아니라, 무엇을 왜 놓기 어려운지 아직 정리되지 않았기 때문일 수 있어요. 그 지점을 분명히 해야 다음 결정이 쉬워져요.',
    question: '지금 가장 놓기 어려운 한 가지는 무엇이고, 왜 그럴까요?',
  },
  cognitiveOverload: {
    inverted: '방향이 없는 게 아니라, 한꺼번에 고려할 게 너무 많은 거예요.',
    statePara: '답변에서는 선택지와 따질 조건이 많아 하나로 좁히기 어려운 쪽으로 신호가 모여요. 다만 그게 최선을 찾으려는 마음 때문인지, 우선순위가 없어서인지는 지금 답변만으로 단정하기 어려워요.',
    mechanismPara: '지금 필요한 건 더 많은 정보를 모으는 게 아니라, 무엇을 먼저 볼지 정하는 일이에요. 기준이 생기면 고려할 것도 자연히 줄어요.',
    question: '지금 열려 있는 것들 중, 무엇을 가장 먼저 좁혀야 할까요?',
  },
  avoidance: {
    inverted: '의지가 약한 게 아니라, 중요한 결정이 자꾸 뒤로 밀리는 거예요.',
    statePara: '답변에서는 중요한 결정이 여러 이유로 계속 미뤄지는 쪽으로 신호가 모여요. 다만 그게 바쁨 때문인지, 시도 자체가 부담스러워서인지는 아직 분명하지 않아요.',
    mechanismPara: '큰 결심을 세우기보다 아주 작게 한 번 움직여보는 게 먼저예요. 작은 행동 하나가 미뤄온 이유를 눈에 보이게 해줘요.',
    question: '이번 달, 미루지 않고 할 수 있는 가장 작은 한 걸음은 무엇일까요?',
  },
  identityConfusion: {
    inverted: '길을 잃은 게 아니라, 지금의 방향과 나를 다시 맞춰보는 시기예요.',
    statePara: '답변에서는 지금의 방향과 정체성을 다시 정리하려는 쪽으로 신호가 모여요. 다만 그게 전환의 중간이라서인지, 바깥 기준에 눌려서인지까지는 아직 좁혀지지 않아요.',
    mechanismPara: '서둘러 답을 정하기보다 이 정리의 시기를 버티는 힘이 먼저예요. 방향은 대개 그 시간을 지나며 잡혀요.',
    question: '지금 당신은 어떤 사람으로 일하고 싶은 걸까요?',
  },
};

export const INSUFFICIENT_COPY = {
  inverted: '지금은 하나의 고민 패턴으로 좁히기는 어려워요.',
  statePara: '답변만으로는 아직 신호가 한 방향으로 모이지 않았어요. 여러 마음이 비슷한 크기로 섞여 있는 상태에 가까워요.',
  mechanismPara: '이럴수록 재정·가족·현실 조건까지 함께 놓고 봐야 무엇이 진짜 결정을 막는지 드러나요. 심화 분석은 그 갈래를 나누는 걸 도와요.',
  question: '지금 가장 크게 걸리는 한 가지부터 짚어보면 어떨까요?',
};

// ── 사용자 언어 신호 태그 — 내부 변수명 금지. evidenceCode가 실제 있을 때만 표시. ──
export const SIGNAL_TAG_LABELS: Record<string, string> = {
  'q1:sunkCost': '지금까지 들인 노력을 놓기 어려움',
  'q1:endowment': '지금 가진 것을 넘기기 부담스러움',
  'q1:lossAversion': '무엇을 고르든 잃는 게 먼저 떠오름',
  'q2:analysisParalysis': '행동보다 비교·검토가 앞서고 있음',
  'q2:ambiguity': '결과가 불확실해 시작을 망설임',
  'q2:experimentAvoidance': '작게 시험해보는 걸 미루고 있음',
  'q2:procrastination': '바쁜 일에 밀려 결정을 미룸',
  'q3:impostor': '성과를 온전히 내 것으로 못 느낌',      // legacy(과거 세션)
  'q3:lowEfficacy': '해낼 수 있을지 자신이 흔들림',        // legacy(과거 세션)
  'q4:closedEarly': '방향을 일찍 정하고 닫아둠',
  'q4:inBetween': '예전 방향은 놓고 새 방향은 미정',
  'arNarrow:nr_continuity': '쌓아온 경험과 이어지려는 마음',
  'arNarrow:nr_loss': '선택할 때마다 잃는 쪽이 먼저 보임',
  'arNarrow:nr_safety': '돈·안정이 쉽게 놓지 못하게 함',
  'arNarrow:nr_explore': '여러 방향을 동시에 열어두고 있음',
  'arNarrow:nr_decided': '이미 방향을 거의 정해둠',
  'arNarrow:nr_unsure': '어느 쪽이 나을지 가늠이 안 됨',
  'csMain:cs_between': '무엇을 먼저 둘지 기준이 안 섬',
  'csMain:cs_stay': '지금 일을 계속할지 고민 중',
  'csMain:cs_many': '하고 싶은 게 많아 못 좁힘',
  'blocker:blk_eyes': '주변의 시선·기대가 신경 쓰임',
  'blocker:blk_fail': '되돌리기 어려울까 두려움',
  'blocker:blk_time': '시간·에너지가 부족함',
  'blocker:blk_confidence': '새 일을 잘 해낼 자신이 부족함',
  'sc:sc_market_only': '실력보다 외부 반응이 더 불안함',
  'sc:sc_unsure': '결과를 낼 수 있을지 확신이 없음',
  'opt:rc_opt_many': '선택지가 너무 많아 분산됨',
  'opt:rc_opt_several': '선택지는 있는데 고르기 어려움',
  'val:rc_val_none': '아직 밖에서 반응을 받아본 적 없음',
  'cx:optionOverloadHigh': '한 번에 살펴보는 선택지가 많음',
  'cx:valueConflictPresent': '중요하게 여기는 조건들이 서로 부딪힘',
  'cx:goalClarityLow': '무엇을 먼저 볼지 기준이 흐릿함',
  'cx:marketInfoGapHigh': '실제 반응을 아직 확인 못 함',
  'cx:selfEfficacyLow': '해낼 수 있을지 자신이 흔들림',
  'cx:curiosityLow': '새로 살펴보려는 마음이 약함',
  'cx:careerCapitalAnxiety': '쌓은 걸 못 쓸까 하는 불안',
  'cx:executionDriveLow': '생각을 행동으로 옮기는 힘이 약함',
  'gate:riskNone': '지금은 감당할 여력이 적음',
  'profile:careerTransition': '이미 한 번 크게 방향을 바꾼 이력',
  'values:cvValuesMany': '지키고 싶은 게 여러 개',
  'stated:safetyTop+challengeExp': '안정을 원하면서도 도전에 끌림',
};

// 패턴별 "직접 지지" evidenceCode(우선순위 순). 신호 목록을 주 패턴과 무관한 코드로
// 오염시키지 않기 위한 화이트리스트. (매번 답하는 q1/q2/q4 코드가 주 패턴과 무관해도
// 신호로 앞서 노출되던 문제를 막는다.) legacy_only 패턴도 과거 세션 렌더용으로 포함.
export const PATTERN_SIGNAL_CODES: Record<PatternId, string[]> = {
  lossAversion: ['q1:lossAversion', 'arNarrow:nr_loss', 'arNarrow:nr_safety', 'blocker:blk_fail', 'gate:riskNone'],
  endowmentEffect: ['q1:endowment', 'arNarrow:nr_continuity'],
  sunkCost: ['q1:sunkCost', 'arNarrow:nr_continuity', 'cx:careerCapitalAnxiety'],
  ambiguityAversion: ['q2:ambiguity', 'arNarrow:nr_unsure', 'blocker:blk_fail'],
  maximizer: ['arNarrow:nr_explore', 'opt:rc_opt_many', 'values:cvValuesMany', 'cx:optionOverloadHigh'],
  anticipatedRegret: ['arNarrow:nr_loss', 'blocker:blk_fail'],
  analysisParalysis: ['q2:analysisParalysis', 'cx:marketInfoGapHigh', 'cx:executionDriveLow'],
  noSelectionCriteria: ['csMain:cs_between', 'cx:goalClarityLow', 'cx:valueConflictPresent', 'opt:rc_opt_several'],
  productiveProcrastination: ['q2:procrastination', 'blocker:blk_time'],
  movingGoalposts: [],
  experimentAvoidance: ['q2:experimentAvoidance', 'val:rc_val_none', 'gate:riskNone'],
  liminality: ['q4:inBetween', 'csMain:cs_stay', 'profile:careerTransition'],
  tyrannyOfShoulds: ['blocker:blk_eyes', 'stated:safetyTop+challengeExp'],
  identityForeclosure: ['q4:closedEarly', 'arNarrow:nr_decided', 'cx:curiosityLow'],
  impostor: ['q3:impostor', 'sc:sc_market_only'],
  lowSelfEfficacy: ['cx:selfEfficacyLow', 'blocker:blk_confidence', 'sc:sc_market_only', 'sc:sc_unsure'],
};

// 범주별 소속 패턴(category_only 신호 스코프용).
const CATEGORY_PATTERNS: Record<PatternCategory, PatternId[]> = {
  instinctTrap: ['lossAversion', 'endowmentEffect', 'sunkCost', 'ambiguityAversion'],
  cognitiveOverload: ['maximizer', 'anticipatedRegret', 'analysisParalysis', 'noSelectionCriteria'],
  avoidance: ['productiveProcrastination', 'movingGoalposts', 'experimentAvoidance'],
  identityConfusion: ['liminality', 'tyrannyOfShoulds', 'identityForeclosure', 'impostor', 'lowSelfEfficacy'],
};

export interface SignalScope { pattern?: PatternId; category?: PatternCategory }

// evidenceCodes에서 실제 뒷받침되는 사용자 언어 신호(존재하는 코드만, 중복 제거).
//  - scope.pattern: 그 패턴을 직접 지지하는 코드만, 우선순위 순으로.
//  - scope.category: 그 범주 소속 패턴들의 코드만(evidence 순서 유지).
//  - scope 없음(insufficient): 전체 evidence 순서.
// 관계가 약한 신호는 목록에 섞지 않는다(career-pattern-copy-final-review §4).
export function readSignals(evidenceCodes: string[], max = 3, scope?: SignalScope): string[] {
  const present = new Set(evidenceCodes);
  const out: string[] = [];
  const push = (code: string) => {
    const label = SIGNAL_TAG_LABELS[code];
    if (label && !out.includes(label)) out.push(label);
  };

  if (scope?.pattern) {
    // 패턴 화이트리스트 순서 = 우선순위(판별 신호 우선).
    for (const c of PATTERN_SIGNAL_CODES[scope.pattern] ?? []) {
      if (present.has(c)) push(c);
      if (out.length >= max) break;
    }
    return out;
  }

  const allow = scope?.category
    ? new Set(CATEGORY_PATTERNS[scope.category].flatMap((p) => PATTERN_SIGNAL_CODES[p] ?? []))
    : null;
  for (const c of evidenceCodes) {
    if (allow && !allow.has(c)) continue;
    push(c);
    if (out.length >= max) break;
  }
  return out;
}

// 심층 분석 미리보기 — 사용자에게 제공되는 4개 항목(구체적). 각 항목은 유료 결과의
// 실제 섹션 약속과 대응하므로 패턴별로 바꾸지 않고 통일 유지(약속-산출물 불일치 방지).
export const DEEP_PREVIEW_ITEMS: string[] = [
  '실제로 지키고 싶은 조건',
  '현실적 위험과 심리적 두려움의 구분',
  '현재 조건에 맞는 전환 방식',
  '30일 실행 실험과 재판단 기준',
];

export const CTA_PRIMARY = '내 고민의 원인과 30일 계획 확인하기';
export const CTA_SUB = '추가 질문 12개 · 약 3분 · 개인화된 심층 결과';
