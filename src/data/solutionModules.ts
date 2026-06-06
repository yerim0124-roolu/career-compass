// Career Compass 2.0 — solution module + strategy-statement data (copy source).
// Pure data, no logic. Consumed by solutionModuleEngine to build the SolutionLayer.
// Tone: calm, condition-framed, action-oriented; never fortune-telling, never a
// fixed-personality verdict. Strategy statements are framed as "지금 상태에서 유효한
// 전략", not "당신은 OO형입니다".

import type { MainTypeKey, SolutionModule, SolutionModuleKey } from '../types/careerCompass.ts';

// The user-facing headline for each main type — a strategy statement, not a label.
export const MAIN_TYPE_STRATEGY: Record<MainTypeKey, string> = {
  overloadedBurnout: '지금은 새 판을 벌이기보다 에너지를 먼저 회복할 때예요.',
  realityLocked: '방향은 보이지만, 지금은 현실 조건부터 정비해야 할 때예요.',
  lowOptionVisibility: '지금은 선택지를 좁힐 때가 아니라, 보이지 않던 선택지를 더 보이게 할 때예요.',
  conflictedAtFork: '선택지가 부족한 게 아니라, 고를 기준을 먼저 정해야 할 때예요.',
  scatteredExplorer: '관심은 많지만 흩어져 있어, 후보를 좁히고 검증할 때예요.',
  unvalidatedAspirant: '만들고 싶은 방향은 있지만, 시장 반응부터 확인할 때예요.',
  plateauedPerformer: '실력은 쌓였지만, 그걸 밖이 읽을 수 있는 자산으로 정리할 때예요.',
  restlessStabilizer: '지금 자리가 잘못된 게 아니라, 채워지지 않는 축을 작게 실험할 때예요.',
  leverageReady: '지금은 더 분석할 때가 아니라, 작게 실행해 신호를 만들 때예요.',
};

// P1 — MAIN_TYPE_CLOSING_LINE removed. Closing copy is now driven by `activeLenses` via
// `resolveClosingLine` in solutionModuleEngine.ts (3 variants: essentialist / actionType /
// optionGeneration). Keying by mainType alone over-applied the essentialist closing to
// users for whom subtraction was not the right frame (e.g. plateaued single-axis expert).

// Optional Hope-Theory context note: reframes "no visible options" as a pathways-not-deficiency state.
// Only set when the dominant frame would otherwise read as low confidence / lack of direction.
export const MAIN_TYPE_CONTEXT_NOTE: Partial<Record<MainTypeKey, string>> = {
  lowOptionVisibility: '선택지가 안 보이는 것은 능력이나 의지가 부족하다는 뜻이 아닙니다. 아직 경로가 충분히 만들어지지 않은 상태에 가깝습니다.',
};

export const SOLUTION_MODULES: Record<SolutionModuleKey, SolutionModule> = {
  portfolioConvert: {
    key: 'portfolioConvert',
    title: '전문성 자산화',
    goal: '쌓아온 전문성을 밖이 읽을 수 있는 자산(케이스·포지셔닝)으로 전환',
    why: '능력은 이미 충분한데 병목은 ‘증거화’예요. 자산화해 두면 이직·자문·콘텐츠 어디로 가든 그대로 레버리지가 됩니다.',
    plan: [
      { week: '1주', action: '지난 3년 성과 10개를 쏟아낸 뒤, 임팩트·숫자 기준으로 3개를 추립니다.' },
      { week: '2주', action: '3개를 문제-개입-결과 케이스로 정리하고, 한 줄 포지셔닝 문장을 씁니다.' },
      { week: '3주', action: '외부 1곳(링크드인·포트폴리오·사내 발표)에 공개하고 동료 3명에게 피드백을 받습니다.' },
      { week: '4주', action: '반응을 측정하고 다음 행보(자문·콘텐츠·이직) 1개를 고릅니다.' },
    ],
    successSignals: ['케이스 3개 완성', '외부 반응(저장·문의·재공유) 1건 이상', '포지셔닝 문장에 본인 확신이 생김'],
    stopPivot: ['성과를 못 추리면 → 자기정보 부족 신호, 작은 성공 쌓기로', '공개 후 반응이 0이면 → 주제·채널을 다시 점검하고 작게 다시 시도'],
  },
  marketTest: {
    key: 'marketTest',
    title: '30일 실제 반응 확인',
    goal: '커밋 전에 실제 수요 신호를 30일 안에 확보',
    why: '가장 비싼 실수는 확인 없이 올인하는 거예요. 30일이면 싸게 진실을 확인할 수 있습니다.',
    plan: [
      { week: '1주', action: '가설을 한 문장으로 정의하고, 관심 있을 만한 사람 20명 리스트를 만듭니다.' },
      { week: '2주', action: '10명과 대화/인터뷰하거나 랜딩+사전등록으로 반응을 받습니다.' },
      { week: '3주', action: '5명에게 돈·시간을 써서라도 해결할지 직접 물어봅니다.' },
      { week: '4주', action: '신호를 집계해 진행/보류/전환을 결정합니다.' },
    ],
    successSignals: ['대화/인터뷰 10명 이상', '돈·시간을 써서라도 해결하려는 반응 3명 이상', '반복되는 문제 패턴 확인'],
    stopPivot: ['돈·시간을 쓰겠다는 반응이 0~1명이면 → 주제 전환 또는 현직 재설계로', '대화 자체가 안 잡히면 → 채널·타깃 재정의'],
  },
  recoveryFirst: {
    key: 'recoveryFirst',
    title: '회복 우선',
    goal: '에너지 기준선을 회복하고 큰 결정을 잠시 유예',
    why: '번아웃 상태의 결정은 회피 동기에 오염돼요. 회복이 다음 선택의 성공률을 높입니다.',
    plan: [
      { week: '1-2주', action: '회복 루틴(수면·운동·업무 경계)을 세우고, 의도적으로 커리어 결정을 멈춥니다.' },
      { week: '3주', action: '에너지를 자가 점검하고, 가볍게 떠오르는 관심 주제 1개만 메모합니다.' },
      { week: '4주', action: '에너지가 돌아왔으면 작은 탐색 1스텝, 아니면 회복을 연장합니다.' },
    ],
    successSignals: ['2주 후 에너지 자가평가가 올라감', '일·관심에 대한 의욕이 다시 생김', '수면·기분이 안정됨'],
    stopPivot: ['2주 후에도 회복이 없거나 악화되면 → 번아웃을 넘어선 신호일 수 있어 전문적 도움을 권합니다.'],
  },
  optionNarrowing: {
    key: 'optionNarrowing',
    title: '선택지 좁히기',
    goal: '여러 옵션을 검증 가능한 2~3개 후보로 축소',
    why: '선택지 과잉은 실행이 아니라 인지의 병목이에요. 좁히면 다른 모든 실험이 비로소 작동합니다.',
    plan: [
      { week: '1주', action: '고려 중인 옵션을 모두 나열하고, 이미 정한 우선순위 기준으로 점수화합니다.' },
      { week: '2주', action: '하위 옵션을 덜어내 상위 3개만 남기고, 각각 ‘가장 싼 검증법’을 정합니다.' },
      { week: '3주', action: '상위 1개에 작은 실험을 1회 돌립니다.' },
      { week: '4주', action: '남은 2~3개로 다음 달 계획을 짭니다.' },
    ],
    successSignals: ['후보가 3개 이하로 줄어듦', '각 후보의 검증법이 정의됨', '1개 실험에 착수'],
    stopPivot: ['못 좁히면 → 원인이 우선순위 충돌일 수 있어 선택 기준 정리를 먼저'],
  },
  // INTERNAL KEY `valueTradeoffMapping` is preserved. Only the user-facing
  // copy (title/goal/why/plan) was rewritten in plain Korean (P3.7) — no more
  // "가치 트레이드오프" / "트레이드오프" jargon.
  valueTradeoffMapping: {
    key: 'valueTradeoffMapping',
    title: '선택 기준 정리',
    goal: '여러 우선순위 사이에서 “지금 무엇을 먼저 지킬지” 결정 기준 만들기',
    why: '여러 방향이 모두 가능해 보일수록, 정보를 더 모아도 결정이 잘 안 돼요. 무엇을 지키고 무엇을 내려놓을지 정리하면 길이 좁혀집니다.',
    plan: [
      { week: '1주', action: '지키고 싶은 것 2~3개를 적어보고, 각각의 최소 만족선을 정합니다.' },
      { week: '2주', action: '“앞으로 1년간 무엇을 내려놓을 수 있는가” 시나리오 3개를 써봅니다.' },
      { week: '3주', action: '신뢰하는 사람과 시나리오를 함께 검토합니다.' },
      { week: '4주', action: '1년 한정 우선순위 1개를 확정합니다(영구가 아니라 1년 기준).' },
    ],
    successSignals: ['우선순위를 한 문장으로 진술', '“지금은 X를 위해 Y를 보류” 같은 규칙이 생김', '후보가 자연스럽게 축소'],
    stopPivot: ['그래도 못 정하면 → 결정 준비·에너지 문제일 수 있어 회복을 점검'],
  },
  roleRedesign: {
    key: 'roleRedesign',
    title: '현직 재설계',
    goal: '수입을 유지하면서 현재 역할에서 바꾸고 싶은 1가지를 재설계',
    why: '가장 낮은 리스크로 변화를 만드는 길이에요. 안정이라는 자산을 안 버리고 눌린 축을 채웁니다.',
    plan: [
      { week: '1주', action: '현 역할의 불만·지루함 원인 1개를 특정합니다(역할? 사람? 성장?).' },
      { week: '2주', action: '바꾸고 싶은 1가지의 재설계안(맡을 프로젝트·줄일 업무)과 상사 제안 초안을 만듭니다.' },
      { week: '3주', action: '합의를 시도하거나 사이드 실험을 시작합니다.' },
      { week: '4주', action: '4주간의 효과를 점검합니다.' },
    ],
    successSignals: ['재설계 1건이 실제로 적용됨', '업무 만족의 변화를 체감', '팀·상사와 합의 가능성 확인'],
    stopPivot: ['구조적으로 불가능하면 → 이직 준비로 전환'],
  },
  independentPilot: {
    key: 'independentPilot',
    title: '독립 파일럿',
    goal: '작은 유료 독립 일감 1건으로 독립을 저커밋으로 테스트',
    why: '퇴사 없이 독립 적합성과 시장성을 확인해요. 한 건이 단가·수요·체질을 동시에 검증합니다.',
    plan: [
      { week: '1주', action: '제공 가능한 서비스 1개와 단가를 정의합니다.' },
      { week: '2주', action: '기존 네트워크 5명에게 조용히 제안합니다.' },
      { week: '3주', action: '소규모 1건 수주를 시도합니다.' },
      { week: '4주', action: '진행·완료 후 체감과 단가 수용도를 평가합니다.' },
    ],
    successSignals: ['문의 2건 이상', '1건 계약', '제시한 단가가 수용됨'],
    stopPivot: ['4주간 문의가 0이면 → 포지셔닝 문제, 전문성 자산화 또는 실제 반응 확인으로'],
  },
  contentEngine: {
    key: 'contentEngine',
    title: '콘텐츠 엔진',
    goal: '일관된 소량 콘텐츠로 표현·시장·가시성을 동시에 테스트',
    why: '가장 싼 영향력·시장 실험이에요. 인정 욕구와 창작 욕구를 저리스크로 채우며 데이터를 쌓습니다.',
    plan: [
      { week: '1주', action: '주제 1개를 고정하고 4개 발행 계획을 세웁니다.' },
      { week: '2-3주', action: '콘텐츠 4개를 발행합니다.' },
      { week: '4주', action: '반응(저장·공유·문의)을 측정하고 주제 일관성을 점검합니다.' },
    ],
    successSignals: ['콘텐츠 4개 발행', '저장·공유·문의 등 반응 발생', '일관된 주제가 형성됨'],
    stopPivot: ['4개 모두 반응이 없고 본인도 에너지가 안 생기면 → 실제 반응 확인으로 방향 재고', '에너지는 생기는데 반응만 없으면 → 주제·채널 조정 후 1달 더'],
  },
  runwayStabilizer: {
    key: 'runwayStabilizer',
    title: '런웨이 안정화',
    goal: '수입 발판·런웨이를 확보해 진짜 방향을 실행 가능하게 만들기',
    why: '막은 건 의욕이 아니라 현실이에요. 런웨이가 6개월 이상이 되면 막혀 있던 옵션이 1순위로 올라옵니다.',
    plan: [
      { week: '1주', action: '정확한 런웨이(개월 수)를 계산하고 목표 런웨이를 설정합니다.' },
      { week: '2주', action: '수입 안정 옵션 1개(현직 유지·단기 계약·이직)를 결정합니다.' },
      { week: '3주', action: '지출 구조 1개를 조정하고 비상금 목표를 세웁니다.' },
      { week: '4주', action: '6개월 런웨이까지의 로드맵과 방향 재도전 시점(날짜)을 정합니다.' },
    ],
    successSignals: ['런웨이 수치가 명확해짐', '월 저축 여력 확보', '재도전 시점(날짜)이 정해짐'],
    stopPivot: ['런웨이 확보가 불가능하면 → 방향 자체를 저자본형(콘텐츠·자문)으로 축소'],
  },
  confidenceBuilder: {
    key: 'confidenceBuilder',
    title: '작은 성공 쌓기',
    goal: '2~3개의 작은 성공으로 자기효능감을 회복한 뒤 큰 수로',
    why: '자기효능감은 ‘숙달 경험’으로 가장 잘 올라가요. 확신이 낮을 때의 큰 결정은 회피로 흐르기 쉽습니다.',
    plan: [
      { week: '1주', action: '2주 안에 끝낼 수 있는 작은 과제 3개를 정의합니다(완수 가능한 크기로).' },
      { week: '2-3주', action: '3개를 실행·완수하고 각각을 기록합니다.' },
      { week: '4주', action: '무엇이 통했는지 회고하고 다음 단계로 넘어갑니다.' },
    ],
    successSignals: ['3개 중 2개 이상 완수', '완수 경험을 기록', '“할 수 있다”는 체감 상승'],
    stopPivot: ['작은 과제도 못 끝내면 → 에너지 문제, 회복 우선으로'],
  },
  opportunityGeneration: {
    key: 'opportunityGeneration',
    title: '선택지 발굴',
    goal: '30일 안에 해볼 만한 선택지 후보 2~3개를 만드는 것',
    why: '선택지가 안 보이는 것은 의지 부족이 아니라, 아직 충분한 접점과 경로가 만들어지지 않은 상태일 수 있어요.',
    plan: [
      { week: '1주', action: '관심이 살짝 가는 주제 5개와 인접 분야 1개를 적습니다.' },
      { week: '2주', action: '그중 2~3개에 대해 관련 사람이나 자료를 가볍게 접해봅니다.' },
      { week: '3주', action: '하나를 1시간만 직접 체험하거나 따라 해봅니다.' },
      { week: '4주', action: '에너지와 호기심이 생긴 후보 1~2개를 남깁니다.' },
    ],
    successSignals: ['해볼 만한 후보가 2개 이상 생김', '다음 달 작게 시도할 후보 1개가 보임', '“아무것도 없다”에서 “이 정도는 해볼 수 있다”로 바뀜'],
    stopPivot: ['아무 후보도 떠오르지 않으면 → 강점 회고로 전환', '에너지가 더 떨어지면 → 회복 우선으로 전환', '후보가 너무 많아지면 → 선택지 좁히기로 전환'],
  },
  strengthsReflection: {
    key: 'strengthsReflection',
    title: '강점 회고',
    goal: '이미 해온 일에서 다음 선택지의 단서를 찾는 것',
    why: '하고 싶은 일이 바로 떠오르지 않을 때는, 욕망보다 증거에서 출발하는 편이 더 정확해요.',
    plan: [
      { week: '1주', action: '지난 1년간 덜 힘들게 잘했던 일 5개를 적습니다.' },
      { week: '2주', action: '주변에서 자주 부탁받은 일 3개를 찾습니다.' },
      { week: '3주', action: '두 목록의 공통 패턴 1개를 정리합니다.' },
      { week: '4주', action: '그 패턴이 쓰일 수 있는 역할·분야 후보 2~3개를 적습니다.' },
    ],
    successSignals: ['반복되는 강점 패턴 1개 발견', '연결 가능한 역할·분야 후보 2개 이상 도출', '다음 달 확인해볼 작은 행동 1개 결정'],
    stopPivot: ['아무 패턴도 안 보이면 → 사람과 대화/인터뷰로 전환', '에너지가 낮으면 → 회복 우선으로 전환', '후보가 4개 이상 늘어나면 → 선택지 좁히기로 전환'],
  },
};
