// Career Compass — /api/paid-analysis (Vercel serverless function).
//
// 유료 심화 결과지 생성. 프론트에서 { freeContext(원본 코드값), paidAnswers(한글
// 라벨) }를 받아 → labelMap으로 코드값을 한글로 변환하며 사용자 데이터 블록을
// 조립 → Anthropic Messages API 호출 → 순수 JSON 결과지를 검증해 반환한다.
//
// 보안: ANTHROPIC_API_KEY는 process.env로만 접근하며, 코드/응답 어디에도 노출하지
// 않는다. 실패 시 키·내부 정보 없이 에러 코드만 반환한다.

// ── 코드값 → 한글 변환 (self-contained) ────────────────────────────────────────
// ⚠️ Vercel 함수는 자기 파일 기준으로 번들된다. api/ 함수가 src/ 파일을 import하면
// 배포 번들에 그 src 파일이 포함되지 않아 런타임 ERR_MODULE_NOT_FOUND가 난다.
// 그래서 변환 로직을 여기에 자립적으로 둔다(프론트 src/components/paid/labelMap.ts와
// 매핑 내용은 동일하게 유지 — 한쪽을 바꾸면 다른 쪽도 함께 갱신할 것).

const SUBTYPE_LABELS: Record<string, string> = {
  incomeRisk: '생활에 줄 영향',
  careerCapitalContinuity: '쌓아온 걸 이어갈 길',
  identityTransition: '새로운 나로 옮겨가는 일',
  valuePreservation: '가치의 우선순위',
  possibilityClosureAvoidance: '선택지를 닫기 어려운 마음',
  researchLoop: '끝나지 않는 정보 탐색',
  curiositySpread: '흩어진 관심',
  marketResponseUnknown: '시장의 반응',
  selfFitUnknown: '해낼 수 있을지에 대한 확신',
  sustainabilityUnknown: '지속 가능성',
  meaningDecline: '옅어진 의미',
  autonomyDeficit: '스스로 정할 자리',
  growthRoutineAbsent: '성장하는 감각',
  expertiseStagnation: '실력을 꺼낼 통로',
  recognitionGap: '보이지 않는 실력',
  assetUnleveraged: '아직 안 쓴 자산',
  contentLeverage: '콘텐츠로 낼 첫 신호',
  advisoryLeverage: '자문·강의로 확인할 수요',
  analysisLeverage: '분석으로 받을 반응',
  independentPilot: '작은 유료 일감',
  startupPrep: '문제와 수요의 검증',
  generalLeverage: '어디부터 시작할지',
  runwayShortage: '움직일 재정 여유',
  lossIntolerance: '감당할 수 있는 시도 크기',
  externalConstraint: '시간·역할의 합의',
  selfInfoGap: '또렷하지 않은 내 강점',
  marketInfoGap: '바깥에 어떤 길이 있는지',
  roleLanguageGap: '끌리는 일을 부를 이름',
  energyDepletion: '먼저 필요한 회복',
  decisionOverload: '줄여야 할 판단 부담',
  environmentDrain: '에너지를 빼앗는 환경',
  default: '맡아서 끌어볼 자리',
};
const SUBTYPE_FALLBACK = '지금의 핵심 고민';
function subtypeToKorean(code?: string | null): string {
  if (!code) return SUBTYPE_FALLBACK;
  return SUBTYPE_LABELS[code] ?? SUBTYPE_FALLBACK;
}

const AGE_BAND_LABELS: Record<string, string> = {
  '20_early': '20대 초반', '20_late': '20대 후반',
  '30_early': '30대 초반', '30_late': '30대 후반',
  '40_early': '40대 초반', '40_late_plus': '40대 후반 이상',
};
function ageBandToKorean(code?: string | null): string {
  if (!code) return '';
  return AGE_BAND_LABELS[code] ?? '';
}

const MAIN_TYPE_LABELS: Record<string, string> = {
  overloadedBurnout: '과부하 소진형',
  realityLocked: '현실 조건 정비형',
  lowOptionVisibility: '기회 탐색 부족형',
  conflictedAtFork: '갈림길 결정형',
  scatteredExplorer: '탐색 과잉형',
  unvalidatedAspirant: '시장 미검증 도전형',
  plateauedPerformer: '정체된 성실형',
  restlessStabilizer: '안정 속 권태형',
  emergingLeader: '조직 리더 성장형',
  leverageReady: '전문성 레버리지형',
};
function mainTypeToKorean(code?: string | null): string {
  if (!code) return '';
  return MAIN_TYPE_LABELS[code] ?? '';
}

const PULL_DIRECTION_LABELS: Record<string, string> = {
  stayRedesign: '현 직무 유지·재설계',
  jobChange: '이직',
  startup: '창업',
  independent: '프리랜스/독립',
  contentBrand: '콘텐츠/퍼스널 브랜드',
  advisoryTeaching: '전문 자문/강의',
  investAnalysis: '투자/분석/리포트',
  orgLeadership: '조직 내 리더십',
  restRecover: '휴식/재정비',
};
function pullDirectionToKorean(code?: string | null): string {
  if (!code) return '';
  return PULL_DIRECTION_LABELS[code] ?? '';
}

const FRICTION_LABELS: Record<string, string> = {
  income_uncertainty: '수입의 불확실성',
  career_capital_loss: '쌓은 경력 자산을 잃을 우려',
  identity_loss: '지금의 정체성을 잃을 우려',
  too_many_live_options: '너무 많이 열려 있는 선택지',
  low_market_signal: '아직 부족한 시장 신호',
  low_energy: '바닥난 에너지',
  time_constraint: '시간의 제약',
  tradeoff_pain: '가치 사이의 상충',
};
const FRICTION_FALLBACK = '지금의 결정을 어렵게 하는 마찰';
function frictionToKorean(code?: string | null): string {
  if (!code) return '';
  return FRICTION_LABELS[code] ?? FRICTION_FALLBACK;
}

const READINESS_LABELS: Record<string, string> = {
  pause: '지금은 회복이 먼저인 단계',
  reflect_only: '생각을 정리하는 단계',
  tiny_test: '가장 작은 시도를 해볼 단계',
  structured_test: '병행할 구조를 만들 단계',
  commitment_test: '집중해 검증할 단계',
};
function readinessToKorean(code?: string | null): string {
  if (!code) return '';
  return READINESS_LABELS[code] ?? '';
}

const TOTAL_CAREER_STAGE_LABELS: Record<string, string> = {
  total_0_3: '총 경력 0~3년',
  total_3_7: '총 경력 3~7년',
  total_7_12: '총 경력 7~12년',
  total_12_plus: '총 경력 12년 이상',
  no_fulltime_experience: '정규직 경험 없음',
};
function experienceToKorean(code?: string | null): string {
  if (!code) return '';
  return TOTAL_CAREER_STAGE_LABELS[code] ?? '';
}

export const MODEL = 'claude-sonnet-4-6';
// 유료 리포트 수준의 풍성한 분량을 위해 넉넉히 둔다. 고정 배열 개수 + 필드별 길이
// 상한 + "순수 JSON만" 지시가 함께 있어 무한 장문/미종료를 막는다. repair도 같은 상한.
const MAX_OUTPUT_TOKENS = 8000;

// ── 시스템 프롬프트 (전문, 그대로) ──────────────────────────────────────────────
export const PAID_SYSTEM_PROMPT = `당신은 커리어 갈림길에 선 사람의 마음을 깊이 읽어주는 따뜻한 커리어 안내자입니다. 아래 진단 데이터를 그대로 요약하지 말고, 데이터에 적히지 않은 이 사람의 현실까지 조심스럽게 추론해서 채우세요.
이 결과지는 유료 심화 결과지입니다. 목표는 "공감된다"를 넘어, 사용자가 "내 상황을 진짜 알고 말해주는구나"와 "그래서 이번 달에 뭘 하면 되는지 알겠다"를 동시에 느끼게 하는 것입니다. 차가운 분석 리포트가 아니라 상담자가 오래 듣고 정리해주는 글이되, 막연한 위로는 금지합니다. 직업 현실·돈·시간·가족·전환 가능성·이번 달 실행안을 구체적으로 다루세요.
[세 층으로 읽기]
1. 심리 메커니즘 매핑 — 왜 결정을 못 내리는지 이름 붙이기(현실 언어로).
2. 직업·연차 추론 — 이 직업을 이 연차까지 해온 사람의 구조적 현실.
3. 직업×심리×현실 리스크 교집합 처방 — 실행 제안은 직업·연차·핵심마찰·가장 강한 마음·준비도·고용형태·버틸기간·부양·나이대가 모두 반영돼야 함. 직업만/심리만/이상론만으로 나오는 조언은 실패.
[추론 원칙] ① 이 직업이 이 연차에 겪는 구조적 현실 ② 왜 하필 지금인지(계기 있으면 중심에, 없으면 연차·나이·고용형태·마찰로 추론) ③ 이 경력이 다른 형태로 전환되는 방식 ④ 현실 리스크 상한(버틸기간·부양·최소소득·나이대·결혼 반영). 모든 추론은 "아마 ~하지 않을까요"처럼 여지를 두어 표현. 단정 금지.
[고용형태] 회사원(정규직): 현 직장 유지한 채 외부 실험 / 계약직·파견: 다음 계약 안정성 축으로 병행 검증 / 프리랜서·개인사업: 기존 수입 지키며 새 수익원 실험 / 사장님(고용주): 접는 게 아니라 역할 재배치·수익 다각화 / 쉬는 중·구직: 버틸기간 기준 회복·검증·수입회복 순서. 값 없으면 일반적으로.
[나이대] '남은 커리어 시간' 감각으로만. 20~30대 회복 여유 있어 조금 과감히 / 40대 균형점, 방향 조정 적기 / 그 이상 판 엎기보다 경험 재배치. 값 없으면 나이에 열린 표현. 나이 기반 구체적 숫자("앞으로 30년" 등)는 사용자가 직접 언급했을 때만.
[경력 해석 — 최우선 규칙] 입력 맨 위 PROFILE_FACTS를 절대 사실로 따를 것.
- '전체 커리어 기간'과 '현재 직업 경력'은 다른 값이다. 전자는 커리어 전체, 후자는 현재 직업/역할에서의 기간. 두 값이 다르면 전체 기간을 현재 직업 경력으로 바꿔 쓰지 말 것(예: 전체 7~12년·현재 1~3년을 "그 직업 10년 차"로 쓰면 오답).
- 전체 > 현재이면 현재 직업을 '오래 지속한 사람'으로 해석하지 말 것. 여러 경험을 거쳐 현재 역할에 온, 복합 커리어 자산을 가진 전환 국면으로 다룰 것. 단 이전 직무·전환 경로가 입력에 없으면 단정하지 말고 "전환 가능성이 있는 커리어 구조", "복합 커리어 자산을 가진 상태"처럼 열린 표현을 쓸 것.
- 이 경우 결과는 '장기 동일 직무 종사자의 번아웃/권태'가 아니라 '기존 커리어 자산 + 현재 전문성을 어떻게 조합·확장할지'의 관점으로 쓸 것. 현재 직업을 유일한 정체성으로 환원하지 말고 전문성의 한 축으로 다룰 것. 단순 정착을 권하지 말고, 성향에 따라 현재 전문성을 한 축으로 두고 다른 가능성을 실험하는 방향도 열어둘 것.
- PROFILE_FACTS의 '금지 표현' 목록에 있는 문구는 결과 어디에도 쓰지 말 것.
[결과지 방향] 현재 직업 하나로 환원 금지. ①기존 커리어 자산 ②현재 전문성 ③사용자가 새로 시도하고 싶은 방향 ④테스트에서 나온 성향 — 이 넷을 어떻게 조합할지로 작성. 실험(monthlyExperiments 3개)도 한 형태로 고정하지 말고 서로 다른 축으로 열어둘 것(예: 전문성 활용 콘텐츠 실험 / 특정 타깃 대상 브랜드 메시지 실험 / 기존 기획·경험을 살린 문제정의형 상품 실험 / 현재 전문성을 한 축으로 두고 다른 가능성을 검증하는 실험).
[문장 품질] 추측형("~일 수 있어요/~하지 않을까요")은 문단당 1회 이내로 절제. 근거 없는 심리 해석 금지 — 반드시 입력 신호에 근거. 강한 명령형을 줄이고 제안형으로. 같은 문구·라벨을 반복하지 말 것. 최종 출력 전 각 문장이 자연스러운 한국어인지 스스로 점검할 것.
[결혼] 부양 부담 판단 항목 아님. 부담은 부양 항목으로만 판단. 결혼은 "혼자 안는 결정인가, 함께 상의할 사람 있는가" 톤에만 반영.
[버틸 기간] 실험 공격성의 핵심. 3개월 미만=수입 흔드는 실험 금지, 현 소득 유지한 작은 검증만 / 3~6개월=저리스크 유료 파일럿, 3~5명 검증 / 6개월~1년=한 달 유료 실험·포트폴리오·파트타임 확장 / 1년 이상=비교적 과감하되 단계적 전환. 값 없으면 수입 안 흔드는 실험이 기본값.
[부양] 크면 수입 방어형 실험. 낮으면 탐색 폭 넓힘. 크다고 도전 포기 권하지 말고 "수입 유지한 채 검증"으로 설계.
[에너지] 낮거나 번아웃이면 실험을 추가 노동으로 만들지 말 것. 첫걸음은 "더 벌기"보다 "회복 해치지 않는 작은 확인".
[몰입 순간] 있으면 30일 실험의 출발점으로 반드시 활용. 이 사람이 실제로 살아났던 장면에서 실험 주제를 끌어낼 것. 일반론 금지.
[지키고 싶은 것] 4·5·6섹션의 필터로. 이 조건을 위협하는 제안 금지.
[심리 메커니즘] 아래 16개 중 최대 2개만, 나열 금지, '두 마음의 줄다리기' 섹션에서 이 사람 언어로. 선택순서: 핵심마찰→강한마음·둘째마음→기운방향→준비도→현실리스크.
[손실 회피] 얻을 것보다 잃을 게 2배 아프게 느껴짐
[소유 효과] 내 것이 된 순간 실제보다 소중해 보임
[매몰비용의 오류] 과거에 쏟은 시간이 아까워 앞으로를 희생함
[모호성 회피] 아는 고통이 모르는 가능성보다 나아 보임
[극대화자의 함정] 완벽한 선택지 찾다 아무것도 못 고름
[예기된 후회] 실패했을 때 자책을 미리 당겨와 느낌
[분석 마비] 정보가 많을수록 결정이 멀어짐
[선택 기준 부재] 뭘 중요하게 여기는지 몰라 비교가 안 됨
[생산적 지연] 진짜 무서운 일을 피하려 덜 중요한 걸 열심히 함
[목표점 이동] 조건을 계속 미뤄 영원히 결정 안 해도 되게 함
[실험 회피] 작게 시도하는 것조차 자아에 대한 심판처럼 느낌
[과도기적 상태] 과거 정체성은 떠났는데 새 정체성은 아직 없음
[당위적 사고] 내가 원하는 게 아니라 사회 기준에 끌려다님
[정체성 유실] 고민할 틈 없이 남의 기준을 따라옴
[가면 증후군] 성과를 내고도 운이었다고 깎아내림
[자기효능감 부족] 흥미가 있어도 '난 못 할 것 같다'가 막음
[문체] 존댓말, 다정한 상담 톤. "OO형입니다" 규정 금지. "퇴사/창업/이직하세요" 강요 금지. 막연한 위로 반복 금지. 진단명·점수 나열 금지, 일상 언어로 번역. 사용자 직접 문장은 마지막 섹션에서 다시 안아주기.
[6번 실험 특칙] '고려 방향'이 명확하면 그 방향의 30일 실험 하나. '아직 모르겠음'이거나 비면, 실험 후보 2~3개를 짧게 비교한 뒤 가장 안전·적합한 1개로 좁힐 것. 실험은 반드시 포함: 주제·대상·채널·형식·30일 안에 할 행동·확인할 지표·이 실험으로 알게 될 것. 주차 흐름(1주 정리→2주 대상→3주 실행→4주 반응)을 자연스럽게. "콘텐츠 만들어보세요" 식 금지.
[골든 스타일 — 이 톤으로] 분석가가 한 개인의 전환기를 깊게 읽어주는 개인 리포트다(조언 모음 아님). 사용자의 구체 상황을 짚고, 왜 지금 이 고민이 왔는지 설명하고, 현실 리스크를 숫자·기간·소득 조건과 연결하고, "작게 해보세요"가 아니라 "한 달 안에 무엇을 검증할지"를 말한다. 문장은 단정하고 밀도 있게 쓰되 입력에 없는 사실은 단정하지 않는다.
[근거 반영 — 최우선] USER_EVIDENCE_PACK에서 아래를 반드시 읽어내 각 섹션에 자연스러운 리포트 문장으로 녹여라(키워드 나열 금지). 각 주요 섹션은 evidence에서 최소 2개 이상 사용:
 · 지금 만들고/하고 싶은 것(브랜드·콘텐츠·사업·상품 아이디어) · 현재 수입 공백 또는 필요한 최소 수입 · 버틸 수 있는 기간 · 기존 직업(병원 취직/임상 확대 등) 복귀에 대한 고민 · 배우자·가족·생활비 압박 · 가장 두려워하는 시나리오 · 이미 반응을 얻은 경험 · 돈을 받을 수 있는지 확인해야 하는 포인트 · 지키고 싶은 것.
[금지] "작은 실험", "방향 감각", "현재 전문성", "에너지", "고민을 한 문장으로 적어보기", "대상 한 명 정하기", "초안 만들기" 같은 일반·템플릿 표현 반복 금지. 모든 전환자에게 붙일 수 있는 문장 금지 — 이 사용자만의 맥락이 들어가야 한다.
[구조 — narrative report] 결과지는 카드형 목록이 아니라 '긴 서사 리포트'다. 아래 7개 narrative 섹션(currentPosition·whyNow·innerConflict·riskMap·transitionAssets·monthlyExperiment·futureMessage)을 각각 하나의 이어지는 문단(들)로, 지정 분량으로 밀도 있게 쓴다. 각 섹션은 evidence pack의 구체 정보를 최소 2개 이상 자연스럽게 녹인다.
━━ 출력 형식 (반드시 아래 스키마에 '정확히' 맞는 순수 JSON만) ━━
규칙: 마크다운·코드펜스(\`\`\`)·설명·JSON 앞뒤 텍스트 전부 금지. 아래 필드만 생성. 각 body는 지정 분량을 채운다(짧고 얕으면 실패).
{
  "summaryCard": {
    "coreNow": "지금 핵심 1~2문장",
    "biggestRisk": "가장 큰 리스크 1~2문장",
    "dontDo": "지금 하지 말 것 1문장",
    "doThis": "이번 달 할 것 1문장",
    "judgeBy": "30일 뒤 판단 기준 1문장"
  },
  "currentPosition": { "title": "지금 당신이 멈춰 선 곳", "body": "지금 어떤 지점에 서 있는지를 사용자 상황으로. 500~800자" },
  "whyNow": { "title": "왜 하필 지금 이 마음이 왔는지", "body": "계기·수입 공백·버틸 기간 등과 연결. 500~800자" },
  "innerConflict": { "title": "두 마음의 줄다리기", "body": "기존 일 복귀 vs 새 방향 사이의 갈등을 구체적으로. 심리 메커니즘 최대 2개. 600~900자" },
  "riskMap": { "title": "현실 리스크 지도", "body": "버틸 기간·최소 수입·부양 등 실제 수치와 연결한 리스크. 600~900자" },
  "transitionAssets": { "title": "당신이 이미 가진 전환 자산", "body": "기존 커리어 + 현재 전문성(자격·도메인 이해·신뢰 자산)의 조합. 500~800자" },
  "monthlyExperiment": {
    "title": "이번 달의 30일 실험",
    "body": "이번 달 무엇을 시장/수익/전환 가능성 차원에서 검증할지의 서사. 700~1000자",
    "experiments": [
      {
        "title": "실험 이름(무엇을 검증하는지 드러나게)",
        "body": "실험 개요",
        "hypothesis": "검증할 가설(예: 이 전문성에 돈을 낼 사람이 있는가)",
        "target": "실제 구매/결제 가능성이 있는 구체 집단",
        "action": "구매의사·DM·소액 결제·상담 요청·예약을 유도하는 구체 제안(콘텐츠 N개 아님)",
        "successMetric": "저장·좋아요가 아니라 DM·소액 결제·상담 요청·예약·이메일 확보 등 돈에 가까운 반응의 구체 수치",
        "stopSignal": "어떤 가설을 버릴지 명확히",
        "whyThisFits": "수입 공백·버틸 기간·기존 경험·현재 전문성을 연결한 근거"
      }
    ]
  },
  "futureMessage": { "title": "한 달 뒤의 당신에게", "body": "사용자가 직접 쓴 말을 다시 안아주는 마무리. 실제 표현 인용 가능. 400~700자" },
  "sevenDayPlan": [ "1일차: 유료 반응을 확인할 가설 1개 정의(감정정리 아님). 이후 2일차 타깃 10명 리스트업, 3일차 제안 메시지/랜딩 문구, 4일차 제안 1개 공개, 5일차 DM/지인 5명 직접 검증, 6일차 반응을 돈/관심/칭찬/무반응으로 분류, 7일차 키울 가설·버릴 가설 결정. 각 100~180자" ],
  "recheckCriteria": [ "30일 뒤 스스로 점검(예/아니오, 돈에 가까운 반응 중심). 120~220자" ],
  "ifTwoOrMoreYes": "재점검에서 2가지 이상 예일 때의 다음 행동",
  "ifAllNo": "모두 아니오일 때의 안내(전환 서두르지 말고 대상/제안 교체 또는 회복·역할 재설계)"
}
개수 규칙(반드시): narrative 7섹션 모두 채움, monthlyExperiment.experiments 2~3(각 구조화 필드 채움), sevenDayPlan 7(1일차~7일차 검증 루프), recheckCriteria 3.
[30일 실험] "콘텐츠 올려보세요/주 2회 올리기/대상 한 명 정하기" 금지. '누구에게 무엇을 팔거나 검증할지'와 '돈에 가까운 성공 지표' 필수.
[7일 계획] "고민 적기/지키고 싶은 것 정하기/초안 만들기" 수준 금지. 유료 반응 검증 루프로.
[수의사 등 전문직] 현재 직업을 '현재 가진 전문 자격·신뢰 자산·도메인 이해'로 구체적으로 다루되, 오래 종사한 것처럼 쓰지 말 것(PROFILE_FACTS 준수). 기존 커리어 자산과 현재 전문성의 조합 가능성을 중심으로.
JSON 외 어떤 텍스트도 금지. 마크다운·코드펜스 금지. 순수 JSON만.`;

// ── 요청/응답 타입 ─────────────────────────────────────────────────────────────
interface FreeContext {
  occupation: string; experienceLevel: string; currentOccupationRange: string; ageBand: string;
  mainType: string; primarySubtype: string; secondarySubtype: string;
  subtypeConfidence: number; pullDirection: string; primaryFriction: string;
  readinessLevel: string; userFreeText: string;
}
interface PaidAnswers {
  workStatus: string; maritalStatus: string; dependents: string;
  trigger: string; candidateDirection: string;
  runway: string; incomeFloor: string; weeklyTime: string; energyLevel: string;
  flowMoment: string; mustKeep: string[];
}

// 빈 값은 지어내지 말고 "정보 없음"으로. (배열은 join, 없으면 "정보 없음")
const or = (v: string | undefined | null): string => (v && v.trim().length > 0 ? v : '정보 없음');
const orList = (v: string[] | undefined | null): string => (v && v.length > 0 ? v.join(', ') : '정보 없음');

// ── 경력 해석: 전체 vs 현재 직업 경력 ─────────────────────────────────────────
// 근거: UserProfile.currentFieldStage enum(현재 직업/역할에서의 기간).
const CURRENT_FIELD_STAGE_LABELS: Record<string, string> = {
  current_under_1: '1년 미만',
  current_1_3: '1~3년',
  current_3_7: '3~7년',
  current_7_plus: '7년 이상',
  multiple_current_fields: '여러 분야 병행',
};
function currentFieldToKorean(code?: string | null): string {
  if (!code) return '';
  return CURRENT_FIELD_STAGE_LABELS[code] ?? '';
}
// 코드 → [하한, 상한] 연차. 상한 비교로 '전체 > 현재' 여부를 판정한다.
const TOTAL_BOUNDS: Record<string, [number, number]> = {
  total_0_3: [0, 3], total_3_7: [3, 7], total_7_12: [7, 12], total_12_plus: [12, 99],
  no_fulltime_experience: [0, 0],
};
const CURRENT_BOUNDS: Record<string, [number, number]> = {
  current_under_1: [0, 1], current_1_3: [1, 3], current_3_7: [3, 7], current_7_plus: [7, 99],
};

/** '전환/복합 커리어' 여부: 현재 직업 경력 상한 < 전체 경력 하한이면 명백한 전환 국면. */
export function isTransitionOrMixed(totalCode: string, currentCode: string): boolean {
  const t = TOTAL_BOUNDS[totalCode];
  const c = CURRENT_BOUNDS[currentCode];
  if (!t || !c) return false;          // 값 없음/모호(병행) → 단정하지 않음
  return c[1] < t[0];                  // 현재 상한이 전체 하한보다 작다 = 현재 직업이 확실히 더 짧음
}

/** 프롬프트 맨 위에 붙일 절대 사실 블록 + 금지 표현. 코드값은 한글로. */
export function buildProfileFacts(free: FreeContext): { text: string; transition: boolean; currentUpper: number; bannedPhrases: string[] } {
  const occ = or(free.occupation);
  const totalKo = or(experienceToKorean(free.experienceLevel));
  const currentKo = or(currentFieldToKorean(free.currentOccupationRange));
  const transition = isTransitionOrMixed(free.experienceLevel, free.currentOccupationRange);
  const currentUpper = CURRENT_BOUNDS[free.currentOccupationRange]?.[1] ?? 99;

  const lines = [
    '[PROFILE_FACTS — 반드시 지킬 절대 사실]',
    `- 직업: ${occ}`,
    `- 전체 커리어 기간(totalCareerRange): ${totalKo}`,
    `- 현재 직업 경력(currentOccupationCareerRange): ${currentKo}`,
  ];
  const banned: string[] = [];
  if (transition) {
    lines.push(
      `- careerContext = transition_or_mixed_career. 즉 '${occ}'를 오래 지속한 사람이 아니다. 현재 직업 경력은 ${currentKo}뿐이며, 전체 경력(${totalKo})은 여러 경험을 포함한다.`,
      `- 절대: '${occ}'를 장기 종사(예 "${occ} ${totalKo}", "${occ} N년 차")로 서술하지 말 것. 전체 기간을 현재 직업 경력으로 바꾸지 말 것. 현재 직업의 장기 번아웃/권태로 해석하지 말 것.`,
      `- 대신: 기존 커리어 자산 + 현재 '${occ}' 전문성을 어떻게 조합·확장할지의 전환 국면으로 다룰 것. 이전 직무가 입력에 없으면 단정 말고 "복합 커리어 자산을 가진 상태"처럼 열린 표현.`,
    );
    // 금지 표현(전환 국면). 직업명 + 전체기간/연차, 경력 포기 서술.
    banned.push(`${occ} ${totalKo}`, `${occ}로 ${totalKo}`, `${occ} 경력을 접`, `${occ} 경력을 버리`, `${occ} 경력을 포기`);
    if (occ.includes('수의')) {
      banned.push('임상 10년', '임상 7~12', '임상 루틴의 천장', '오래 해온 병원', '병원 일을 놓', '면허와 임상 경력');
    }
    if (banned.length) lines.push(`- 금지 표현(그대로 쓰지 말 것): ${banned.join(' / ')}`);
  } else {
    lines.push('- careerContext = same_field_accumulated_career. 현재 직업을 주 누적 경력으로 다뤄도 된다(단 사실 범위 내에서).');
  }
  return { text: lines.join('\n'), transition, currentUpper, bannedPhrases: banned };
}

/**
 * 결과 본문의 사실 위반 스캔(전환 국면일 때만 의미). 위반 표현 목록 반환.
 * 핵심 일반 규칙: "직업명 + N년(N > 현재직업경력 상한)" = 현재 직업을 장기 종사로 서술 → 위반.
 */
export function factViolations(result: unknown, occupation: string, currentUpper: number, bannedPhrases: string[]): string[] {
  const text = JSON.stringify(result ?? '');
  const flat = text.replace(/\s+/g, '');
  const hits: string[] = [];
  const occ = (or(occupation)).replace(/\s+/g, '');

  // 1) 명시적 금지 표현(공백 무시 비교).
  for (const p of bannedPhrases) {
    if (flat.includes(p.replace(/\s+/g, ''))) hits.push(p);
  }
  // 2) 일반 규칙: 직업(또는 임상) 뒤 N년, N > 현재 상한 → 위반.
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (occ && occ !== '정보없음') {
    const subjects = occ.includes('수의') ? [occ, '임상'] : [occ];
    for (const subj of subjects) {
      const re = new RegExp(`${esc(subj)}(으?로)?\\d{1,2}(~\\d{1,2})?년`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(flat)) !== null) {
        const nums = (m[0].match(/\d{1,2}/g) ?? []).map(Number);
        const maxN = nums.length ? Math.max(...nums) : 0;
        if (maxN > currentUpper) { hits.push(m[0]); }
      }
    }
  }
  return Array.from(new Set(hits));
}

// 서술형 입력 압축: 사용자가 아주 길게 써도 프롬프트가 무한히 커지지 않게 자른다.
// 핵심 표현·감정을 앞부분에서 보존하되 상한을 둔다. 초과분은 '…(생략)'으로 표시.
const NARRATIVE_MAX = 500;              // 서술형 한 항목 최대 글자
const TOTAL_CONTEXT_MAX = 5000;         // 사용자 데이터 블록 전체 상한
const clip = (v: string | undefined | null, max: number): string => {
  const s = or(v);
  if (s === '정보 없음') return s;
  return s.length > max ? `${s.slice(0, max)}…(생략)` : s;
};

/** 코드값을 한글로 변환하고 서술형을 압축하며 사용자 데이터 블록을 조립. 총량도 캡. */
function assembleUserContent(free: FreeContext, paid: PaidAnswers): string {
  const block = [
    `직업: ${clip(free.occupation, 200)}`,
    `전체 커리어 기간: ${or(experienceToKorean(free.experienceLevel))}`,
    `현재 직업 경력: ${or(currentFieldToKorean(free.currentOccupationRange))}`,
    `나이대: ${or(ageBandToKorean(free.ageBand))}`,
    `주 유형: ${or(mainTypeToKorean(free.mainType))}`,
    `가장 강한 마음: ${or(subtypeToKorean(free.primarySubtype))}`,
    `그 다음 마음: ${or(subtypeToKorean(free.secondarySubtype))}`,
    `확신도: ${typeof free.subtypeConfidence === 'number' ? String(free.subtypeConfidence) : '정보 없음'}`,
    `마음이 기우는 방향: ${or(pullDirectionToKorean(free.pullDirection))}`,
    `핵심 마찰: ${or(frictionToKorean(free.primaryFriction))}`,
    `준비도: ${or(readinessToKorean(free.readinessLevel))}`,
    `사용자가 직접 쓴 말: ${clip(free.userFreeText, NARRATIVE_MAX)}`,
    `[유료] 고용형태: ${or(paid.workStatus)}`,
    `[유료] 결혼: ${or(paid.maritalStatus)}`,
    `[유료] 부양: ${or(paid.dependents)}`,
    `[유료] 계기: ${clip(paid.trigger, NARRATIVE_MAX)}`,
    `[유료] 고려 방향: ${or(paid.candidateDirection)}`,
    `[유료] 버틸 기간: ${or(paid.runway)}`,
    `[유료] 최소 소득: ${or(paid.incomeFloor)}`,
    `[유료] 쓸 수 있는 시간: ${or(paid.weeklyTime)}`,
    `[유료] 에너지: ${or(paid.energyLevel)}`,
    `[유료] 몰입 순간: ${clip(paid.flowMoment, NARRATIVE_MAX)}`,
    `[유료] 지키고 싶은 것: ${orList(paid.mustKeep)}`,
  ].join('\n');
  return block.length > TOTAL_CONTEXT_MAX ? `${block.slice(0, TOTAL_CONTEXT_MAX)}…(생략)` : block;
}

// ── 출력 JSON 추출·검증 ────────────────────────────────────────────────────────
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* noop */ }
  }
  return null;
}

// ── 계약(normalize + validate) — src/shared/paidAnalysisContract.ts의 '동일 복사' ──
// Vercel 번들 제약으로 src를 import할 수 없어 여기에 복사한다. 둘의 동등성은
// src/components/paid/paidAnalysisContract.test.ts가 픽스처로 비교해 드리프트를 막는다.
export interface NarrativeSection { title: string; body: string; }
export interface ExperimentItem {
  title: string; body: string;
  hypothesis?: string; target?: string; action?: string; successMetric?: string; stopSignal?: string; whyThisFits?: string;
}
export interface PaidAnalysisResult {
  summaryCard: { coreNow: string; biggestRisk: string; dontDo: string; doThis: string; judgeBy: string; };
  currentPosition: NarrativeSection; whyNow: NarrativeSection; innerConflict: NarrativeSection;
  riskMap: NarrativeSection; transitionAssets: NarrativeSection;
  monthlyExperiment: NarrativeSection & { experiments: ExperimentItem[] };
  futureMessage: NarrativeSection;
  sevenDayPlan: string[]; recheckCriteria: string[]; ifTwoOrMoreYes: string; ifAllNo: string;
}
const SECTION_DEFS: Array<{ key: string; title: string; aliases: string[] }> = [
  { key: 'currentPosition', title: '지금 당신이 멈춰 선 곳', aliases: ['currentPosition', 'currentState', 'position', 'nowStanding'] },
  { key: 'whyNow', title: '왜 하필 지금 이 마음이 왔는지', aliases: ['whyNow', 'why', 'whyThisMoment'] },
  { key: 'innerConflict', title: '두 마음의 줄다리기', aliases: ['innerConflict', 'conflict', 'tugOfWar', 'twoMinds'] },
  { key: 'riskMap', title: '현실 리스크 지도', aliases: ['riskMap', 'risks', 'realRisks', 'riskMapSection'] },
  { key: 'transitionAssets', title: '당신이 이미 가진 전환 자산', aliases: ['transitionAssets', 'assets', 'strengths'] },
  { key: 'monthlyExperiment', title: '이번 달의 30일 실험', aliases: ['monthlyExperiment', 'experiment', 'experimentSection'] },
  { key: 'futureMessage', title: '한 달 뒤의 당신에게', aliases: ['futureMessage', 'finalMessage', 'closing', 'closingMessage'] },
];

function asStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(asStr).filter(Boolean).join(' ');
  return '';
}
function rec(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}
function bodyOf(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  const o = rec(v);
  let body = asStr(pick(o, ['body', 'text', 'description', 'content']));
  const bullets = pick(o, ['bullets', 'items', 'points', 'paragraphs']);
  if (Array.isArray(bullets)) body = [body, ...bullets.map(asStr)].filter(Boolean).join(' ');
  return body;
}
function toSection(v: unknown, defaultTitle: string): NarrativeSection {
  const title = asStr(pick(rec(v), ['title', 'heading'])) || defaultTitle;
  return { title, body: bodyOf(v) };
}
function toExperiment(v: unknown): ExperimentItem | null {
  if (typeof v === 'string') { const b = v.trim(); return b ? { title: '', body: b } : null; }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = asStr(pick(o, ['title', 'heading', 'name']));
  const hypothesis = asStr(pick(o, ['hypothesis', 'assumption']));
  const target = asStr(pick(o, ['target', 'who', 'audience']));
  const action = asStr(pick(o, ['action', 'what', 'doWhat']));
  const successMetric = asStr(pick(o, ['successMetric', 'success', 'metric']));
  const stopSignal = asStr(pick(o, ['stopSignal', 'stop', 'abort']));
  const whyThisFits = asStr(pick(o, ['whyThisFits', 'why', 'fit']));
  let body = bodyOf(o);
  if (!body) body = [action && `무엇: ${action}`, target && `대상: ${target}`, successMetric && `성공 기준: ${successMetric}`].filter(Boolean).join(' · ');
  if (!body && !title) return null;
  return { title, body: body || title, hypothesis, target, action, successMetric, stopSignal, whyThisFits };
}
function normExperiments(raw: unknown, pad: ExperimentItem): ExperimentItem[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map(toExperiment).filter((x): x is ExperimentItem => x !== null);
  if (items.length === 0) return [];
  const out = items.slice(0, 3);
  while (out.length < 2) out.push({ ...pad });
  return out;
}
function normStrArray(raw: unknown, count: number, pad: string): string[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map((x) => (typeof x === 'string' ? x.trim() : asStr(pick(rec(x), ['body', 'text', 'task', 'day', 'title'])))).filter(Boolean);
  if (items.length === 0) return [];
  const out = items.slice(0, count);
  while (out.length < count) out.push(pad);
  return out;
}
const SECTION_PAD: Record<string, string> = {
  currentPosition: '지금 서 있는 지점을 이어지는 섹션과 함께 보면 더 또렷해져요.',
  whyNow: '왜 지금인지는 이어지는 리스크·자산 섹션과 함께 읽어 주세요.',
  innerConflict: '두 방향 사이의 줄다리기는 아래 리스크·자산 섹션에서 이어집니다.',
  riskMap: '현실 조건은 실험 크기를 정하는 기준으로 이어집니다.',
  transitionAssets: '지금까지 쌓아온 것은 다른 형태로 이어 쓸 수 있는 자산이에요.',
  monthlyExperiment: '이번 달은 돈에 가까운 반응을 확인하는 작은 검증부터 시작해 보세요.',
  futureMessage: '한 달 뒤의 당신에게, 지금의 한 걸음이 방향을 좁혀줄 거예요.',
};

export function normalizePaidResult(raw: unknown): PaidAnalysisResult {
  const r = rec(raw);
  const ns = rec(pick(r, ['narrativeSections', 'sections']));
  const scRaw = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const jc = rec(pick(r, ['judgeCriteria', 'judge_criteria']));
  const summaryCard = {
    coreNow: asStr(pick(scRaw, ['coreNow', 'core', 'now'])),
    biggestRisk: asStr(pick(scRaw, ['biggestRisk', 'risk', 'biggest_risk'])),
    dontDo: asStr(pick(scRaw, ['dontDo', 'avoid', 'dont_do'])),
    doThis: asStr(pick(scRaw, ['doThis', 'do', 'thisMonth'])),
    judgeBy: asStr(pick(scRaw, ['judgeBy', 'judge', 'criteria'])),
  };
  const sec = (def: { key: string; title: string; aliases: string[] }): NarrativeSection => {
    const v = pick(r, def.aliases) ?? pick(ns, def.aliases);
    const s = toSection(v, def.title);
    return { title: s.title, body: s.body || SECTION_PAD[def.key] };
  };
  const bySec = Object.fromEntries(SECTION_DEFS.map((d) => [d.key, sec(d)])) as Record<string, NarrativeSection>;
  const meRaw = pick(r, ['monthlyExperiment', 'experiment', 'experimentSection']) ?? pick(ns, ['monthlyExperiment', 'experiment']);
  const experiments = normExperiments(
    pick(rec(meRaw), ['experiments', 'items']) ?? pick(r, ['experiments', 'monthlyExperiments']),
    { title: '30일 검증 실험', body: '돈에 가까운 반응(문의·상담·소액 결제)을 확인하는 작은 제안을 한 가지 열어두세요.', hypothesis: '이 방향에 돈을 낼 사람이 있는가', target: '실제 구매 가능성이 있는 구체 집단', action: '구매의사·상담·소액 결제를 유도하는 제안', successMetric: 'DM·상담 요청·소액 결제·이메일 확보', stopSignal: '돈에 가까운 반응이 전혀 없으면 대상/제안 교체', whyThisFits: '수입 공백과 버틸 기간을 고려한 저리스크 검증이라서' },
  );
  const sevenDayPlan = normStrArray(pick(r, ['sevenDayPlan', 'weekPlan', 'sevenDay']), 7, '이번 주 검증 루프의 한 단계를 이어가 보세요.');
  const recheckCriteria = normStrArray(pick(r, ['recheckCriteria', 'checks']) ?? pick(jc, ['checks']), 3, '돈에 가까운 반응이 나왔는지 스스로 점검해 보세요.');
  const ifTwoOrMoreYes = asStr(pick(r, ['ifTwoOrMoreYes', 'ifYes'])) || asStr(pick(jc, ['ifYes'])) || '두 가지 이상 반응이 있었다면, 그 방향을 다음 30일에 조금 더 키워 보세요.';
  const ifAllNo = asStr(pick(r, ['ifAllNo', 'ifNo'])) || asStr(pick(jc, ['ifNo'])) || '반응이 없었다면 전환을 서두르기보다, 대상·제안을 바꾸거나 잠시 회복·역할 재설계를 먼저 두세요.';
  return {
    summaryCard,
    currentPosition: bySec.currentPosition, whyNow: bySec.whyNow, innerConflict: bySec.innerConflict,
    riskMap: bySec.riskMap, transitionAssets: bySec.transitionAssets,
    monthlyExperiment: { title: bySec.monthlyExperiment.title, body: bySec.monthlyExperiment.body, experiments },
    futureMessage: bySec.futureMessage,
    sevenDayPlan, recheckCriteria, ifTwoOrMoreYes, ifAllNo,
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const okSection = (v: unknown): boolean => { const o = v as NarrativeSection; return !!o && isStr(o.body); };
const okStrArr = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every(isStr);

/** 스키마 검증 실패 항목 목록(진단·로깅용). 비어 있으면 유효. */
export function validationErrors(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== 'object') return ['not_object'];
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  const scFilled = sc ? [sc.coreNow, sc.biggestRisk, sc.dontDo, sc.doThis, sc.judgeBy].filter(isStr).length : 0;
  if (!sc || scFilled < 3) e.push('summaryCard');
  for (const key of ['currentPosition', 'whyNow', 'innerConflict', 'riskMap', 'transitionAssets', 'futureMessage']) {
    if (!okSection(r[key])) e.push(key);
  }
  const me = r.monthlyExperiment as Record<string, unknown> | undefined;
  if (!me || !isStr(me.body)) e.push('monthlyExperiment');
  else if (!Array.isArray(me.experiments) || me.experiments.length < 2 || me.experiments.length > 3 || !me.experiments.every((x) => isStr((x as ExperimentItem)?.body))) e.push('monthlyExperiment.experiments(2-3)');
  if (!okStrArr(r.sevenDayPlan, 7)) e.push('sevenDayPlan(7)');
  if (!okStrArr(r.recheckCriteria, 3)) e.push('recheckCriteria(3)');
  if (!isStr(r.ifTwoOrMoreYes)) e.push('ifTwoOrMoreYes');
  if (!isStr(r.ifAllNo)) e.push('ifAllNo');
  return e;
}

export function validateResult(o: unknown): boolean {
  return validationErrors(o).length === 0;
}

// rawContentReport — src/shared/paidAnalysisContract.ts와 동일 복사(드리프트 테스트로 보장).
export interface RawContentReport {
  hasCore: boolean; summaryFilled: number; sectionsWithBody: number; experimentCount: number; sevenDayCount: number; defaultedSlots: number;
}
export function rawContentReport(raw: unknown): RawContentReport {
  const r = rec(raw);
  const ns = rec(pick(r, ['narrativeSections', 'sections']));
  const sc = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const summaryFilled = ['coreNow', 'core', 'now', 'biggestRisk', 'risk', 'dontDo', 'avoid', 'doThis', 'do', 'judgeBy', 'judge']
    .reduce((n, k) => (asStr(sc[k]) ? n + 1 : n), 0);
  let sectionsWithBody = 0;
  for (const def of SECTION_DEFS) {
    const v = pick(r, def.aliases) ?? pick(ns, def.aliases);
    if (bodyOf(v)) sectionsWithBody += 1;
  }
  const meRaw = pick(r, ['monthlyExperiment', 'experiment']) ?? pick(ns, ['monthlyExperiment', 'experiment']);
  const expArr = pick(rec(meRaw), ['experiments', 'items']) ?? pick(r, ['experiments', 'monthlyExperiments']);
  const experimentCount = (Array.isArray(expArr) ? expArr : []).map(toExperiment).filter(Boolean).length;
  const sevenDayCount = (Array.isArray(pick(r, ['sevenDayPlan', 'weekPlan'])) ? (pick(r, ['sevenDayPlan', 'weekPlan']) as unknown[]) : []).filter(Boolean).length;
  const defaultedSlots = Math.max(0, 3 - Math.min(summaryFilled, 5)) + Math.max(0, 7 - sectionsWithBody)
    + Math.max(0, 2 - Math.min(experimentCount, 2)) + Math.max(0, 7 - Math.min(sevenDayCount, 7));
  const hasCore = summaryFilled >= 2 && sectionsWithBody >= 3;
  return { hasCore, summaryFilled, sectionsWithBody, experimentCount, sevenDayCount, defaultedSlots };
}

// ── repair 재시도용 ────────────────────────────────────────────────────────────
// 1차 출력이 파싱/검증에 실패하면, 원래 긴 사용자 입력을 다시 넣지 않고 '깨진 출력 +
// 스키마'만 넘겨 교정만 시킨다(빠르고 저렴). 교정도 실패하면 그때만 422.
const REPAIR_SYSTEM_PROMPT = `당신은 JSON 교정기입니다. 입력의 '깨진 출력'을 아래 스키마에 정확히 맞는 순수 JSON으로 고쳐서 출력합니다.
규칙: 마크다운·코드펜스·설명 절대 금지, 순수 JSON만. 필드명·타입·배열 개수를 스키마에 정확히 맞출 것. 누락 필드는 기존 내용에서 자연스럽게 채우되 새 주제를 지어내지 말 것. 각 필드 길이는 스키마 지시를 따를 것.`;

const SCHEMA_SPEC = `{
  "summaryCard": { "coreNow": string, "biggestRisk": string, "dontDo": string, "doThis": string, "judgeBy": string },
  "currentPosition": { "title": string, "body": string(500~800자) },
  "whyNow": { "title": string, "body": string(500~800자) },
  "innerConflict": { "title": string, "body": string(600~900자) },
  "riskMap": { "title": string, "body": string(600~900자) },
  "transitionAssets": { "title": string, "body": string(500~800자) },
  "monthlyExperiment": { "title": string, "body": string(700~1000자), "experiments": [ { "title": string, "body": string, "hypothesis": string, "target": string, "action": string, "successMetric": string, "stopSignal": string, "whyThisFits": string } ] (2~3) },
  "futureMessage": { "title": string, "body": string(400~700자) },
  "sevenDayPlan": [ string ] (정확히 7),
  "recheckCriteria": [ string ] (정확히 3),
  "ifTwoOrMoreYes": string,
  "ifAllNo": string
}`;

function buildRepairInput(brokenRaw: string): string {
  return `아래는 유효한 JSON을 만들려다 형식이 깨진 출력입니다. 내용은 최대한 보존하되, 지정 스키마에 '정확히' 맞는 순수 JSON만 다시 출력하세요.\n\n[깨진 출력]\n${brokenRaw.slice(0, 8000)}\n\n[반드시 맞출 스키마]\n${SCHEMA_SPEC}`;
}

// 사실 위반(경력 오해석) 교정용. 긴 원본 입력은 다시 넣지 않고, 사실·위반·기존결과·스키마만.
const FACT_REPAIR_SYSTEM_PROMPT = `당신은 결과지의 사실 오류를 고치는 교정기입니다. 아래 PROFILE_FACTS를 절대 사실로 삼아, '위반 표현'을 제거하고 그 문장을 사실에 맞게 다시 쓴 순수 JSON을 출력합니다.
규칙: 마크다운·코드펜스·설명 금지, 순수 JSON만. 스키마의 필드명·타입·배열 개수를 그대로 유지. 위반 표현과 '현재 직업을 장기 종사로 서술하는 뉘앙스'를 모두 제거하되, 나머지 내용·톤·분량은 최대한 보존.`;

function buildFactRepairInput(profileFacts: string, violations: string[], existingJson: string): string {
  return `${profileFacts}\n\n[위반 표현 — 이 문구/뉘앙스를 결과에서 제거하고 사실에 맞게 고칠 것]\n${violations.join(' / ')}\n\n[고칠 기존 결과 JSON]\n${existingJson.slice(0, 9000)}\n\n[반드시 유지할 스키마]\n${SCHEMA_SPEC}`;
}

// ── USER_EVIDENCE_PACK — 사용자의 실제 서술을 truncate로 날리지 않고 보존 ─────────
function splitSentences(text: string): string[] {
  return text.split(/[\n.!?]|다\.|요\.|음\./).map((s) => s.trim()).filter((s) => s.length >= 5);
}
function topKeywords(text: string, n: number): string[] {
  const freq = new Map<string, number>();
  for (const w of text.split(/[^가-힣A-Za-z0-9]+/)) if (w.length >= 2) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}
interface EvidencePack { text: string; keywords: string[]; sentenceCount: number; }
export function buildUserEvidencePack(free: FreeContext, paid: PaidAnswers): EvidencePack {
  const trigger = or(paid.trigger); const flow = or(paid.flowMoment); const ufree = or(free.userFreeText);
  const rawAll = [ufree, trigger, flow].filter((x) => x !== '정보 없음').join('\n');
  const sentences = Array.from(new Set([
    ...splitSentences(trigger === '정보 없음' ? '' : trigger),
    ...splitSentences(flow === '정보 없음' ? '' : flow),
    ...splitSentences(ufree === '정보 없음' ? '' : ufree),
  ])).slice(0, 10).map((s) => (s.length > 200 ? `${s.slice(0, 200)}…` : s));
  const keywords = topKeywords(rawAll, 10);
  const lines = [
    '[USER_EVIDENCE_PACK — 사용자가 실제로 쓴 말과 맥락. 아래 항목을 읽어내 각 섹션에 리포트 문장으로 녹일 것(키워드 나열 금지)]',
    sentences.length ? `· 사용자가 직접 쓴 문장(고민·두려움·아이디어·이미 얻은 반응이 여기에 있음): ${sentences.map((s) => `"${s}"`).join(' / ')}` : '· 사용자가 직접 쓴 문장: 정보 없음',
    `· 지금 고민이 커진 계기: ${clip(paid.trigger, 500)}`,
    `· 시간 가는 줄 모르고 몰입했던 순간(강점·에너지원 단서): ${clip(paid.flowMoment, 400)}`,
    `· 지금 만들고/하고 싶은 방향(고려): ${or(paid.candidateDirection)}`,
    `· 필요한 최소 수입(수입 공백 판단): ${or(paid.incomeFloor)}`,
    `· 수입 끊겨도 버틸 수 있는 기간(실험 공격성의 상한): ${or(paid.runway)}`,
    `· 가족·생활비 압박: 부양 ${or(paid.dependents)} / 결혼 ${or(paid.maritalStatus)}`,
    `· 지키고 싶은 것: ${orList(paid.mustKeep)}`,
    `· 그 밖의 현실 조건: 고용형태 ${or(paid.workStatus)} / 주간 가용시간 ${or(paid.weeklyTime)} / 에너지 ${or(paid.energyLevel)}`,
    keywords.length ? `· 반복 등장 키워드(사용자 세계의 단어): ${keywords.join(', ')}` : '',
    '· 반드시 다룰 것: 돈을 받을 수 있는지 확인해야 하는 포인트, 기존 직업(병원/임상 등) 복귀 vs 새 방향 사이의 갈등, 가장 두려워하는 시나리오 — 위 문장/조건에서 근거를 찾아 구체화할 것.',
  ].filter(Boolean);
  let text = lines.join('\n');
  if (text.length > 7000) text = `${text.slice(0, 7000)}…`;
  return { text, keywords, sentenceCount: sentences.length };
}

// ── quality gate — golden 미달을 감지(차단 아님, content-repair 트리거) ─────
const GENERIC_PHRASES = ['작은 실험', '방향 감각', '현재 전문성', '에너지', '한 문장으로 적어', '대상 한 명', '초안 만들', '작게 시작', '가장 작은'];
// normalize/fallback이 채우는 중립 기본 본문의 표식(부분 fallback 감지용).
const DEFAULT_MARKERS = [
  '이어지는 섹션과 함께 보면', '이어지는 리스크·자산 섹션과 함께', '리스크·자산 섹션에서 이어집니다',
  '실험 크기를 정하는 기준으로 이어집니다', '다른 형태로 이어 쓸 수 있는 자산이에요', '작은 검증부터 시작해 보세요',
  '지금의 한 걸음이 방향을 좁혀줄', '이번 주 검증 루프의 한 단계', '이 방향이 나에게 맞았는지 스스로 점검',
  '작은 제안을 한 가지 열어두세요',
];
const MONEY_SIGNALS = ['DM', '결제', '구매', '상담', '예약', '이메일', '문의', '주문', '계약', '지불', '유료'];
function isDefaultBody(s: string): boolean { return DEFAULT_MARKERS.some((m) => s.includes(m)); }
function narrativeBodies(result: PaidAnalysisResult): string[] {
  return [result.currentPosition.body, result.whyNow.body, result.innerConflict.body, result.riskMap.body,
    result.transitionAssets.body, result.monthlyExperiment.body, result.futureMessage.body];
}
export function defaultStats(result: PaidAnalysisResult): { defaultBodyCount: number; totalUnits: number; bodyLength: number } {
  const units = [
    ...narrativeBodies(result), ...result.monthlyExperiment.experiments.map((x) => x.body),
    ...result.sevenDayPlan, ...result.recheckCriteria, result.ifTwoOrMoreYes, result.ifAllNo,
  ];
  const defaultBodyCount = units.filter(isDefaultBody).length;
  const bodyLength = narrativeBodies(result).reduce((a, b) => a + (b?.length ?? 0), 0);
  return { defaultBodyCount, totalUnits: units.length, bodyLength };
}
export function qualityWarnings(result: PaidAnalysisResult, evidence: EvidencePack, source: string): string[] {
  const w: string[] = [];
  const flat = JSON.stringify(result);
  if (source === 'full_fallback_used') w.push('full_fallback');
  if (source === 'partial_fallback_sections') w.push('partial_fallback');
  // narrative 본문이 기본값(default)인 섹션이 하나라도 있으면 실패 신호.
  const nb = narrativeBodies(result);
  const defaultSections = nb.filter(isDefaultBody).length;
  if (defaultSections > 0) w.push('default_narrative_bodies');
  // evidence 키워드 반영 부족.
  const kwHit = evidence.keywords.filter((k) => flat.includes(k)).length;
  if (evidence.keywords.length >= 5 && kwHit < 5) w.push('low_evidence_keywords');
  // golden 밀도 미달(7 narrative 본문 평균 450자 이상).
  const avg = nb.length ? nb.reduce((a, b) => a + b.length, 0) / nb.length : 0;
  if (avg < 450) w.push('short_bodies');
  // 일반·템플릿 표현 반복.
  const genCount = GENERIC_PHRASES.reduce((n, g) => n + (flat.split(g).length - 1), 0);
  if (genCount >= 4) w.push('generic_repetition');
  // 실험이 구조는 있어도 '돈에 가까운' 검증이 아님.
  const exps = result.monthlyExperiment.experiments;
  if (exps.some((e) => !(e.target && e.action && e.successMetric))) w.push('experiments_missing_fields');
  const moneyish = exps.filter((e) => MONEY_SIGNALS.some((s) => (e.successMetric ?? '').includes(s))).length;
  if (moneyish < 2) w.push('experiments_not_monetized');
  // 7일 계획이 감정정리 수준.
  if (result.sevenDayPlan.some((d) => /한 문장으로 적어|지키고 싶은 것.*정하|초안 만들|고민.*적어/.test(d))) w.push('weak_seven_day');
  // 마지막 메시지가 얕음.
  if ((result.futureMessage.body ?? '').length < 300) w.push('final_message_thin');
  return w;
}

// content-repair: 구조는 유지하고 body/items/실험필드를 유료 리포트 수준으로 구체화(fallback으로 덮지 않음).
const CONTENT_REPAIR_SYSTEM_PROMPT = `당신은 유료 리포트 편집자입니다. 아래 결과 JSON의 '구조는 그대로 두고' 각 섹션 body·items·finalMessage·실험 필드를 유료 리포트 수준으로 구체화합니다.
규칙: 순수 JSON만(마크다운·설명 금지). 스키마의 필드명·타입·배열 개수 유지. USER_EVIDENCE_PACK의 실제 표현·제약·키워드를 각 섹션에 반영하고 구체화. "작은 실험/방향 감각/현재 전문성/에너지" 같은 일반 표현 반복 금지. 각 30일 실험의 hypothesis/target/action/successMetric/stopSignal/whyThisFits를 채울 것. PROFILE_FACTS의 경력 사실을 지킬 것. 기존에 좋은 문장은 살리되 얕은 문장은 근거로 두껍게.`;
function buildContentRepairInput(currentJson: string, profileFacts: string, evidence: string, warnings: string[]): string {
  return `${profileFacts}\n\n${evidence}\n\n[품질 경고 — 아래를 보완]\n${warnings.join(', ')}\n\n[구체화할 현재 결과 JSON(구조 유지)]\n${currentJson.slice(0, 12000)}\n\n[유지할 스키마]\n${SCHEMA_SPEC}`;
}

/** Anthropic 비스트리밍 호출. 텍스트 반환, upstream 실패 시 throw. */
async function callClaude(apiKey: string, system: string, userContent: string, maxTokens: number): Promise<string> {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!upstream.ok) throw new Error(`upstream_${upstream.status}`);
  const data = (await upstream.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((c) => c.type === 'text')?.text ?? '';
}

// ── deterministic fallback builder (Claude 재호출 없이 서버에서 최소 유효 결과) ──
// 목표: 유료 결제 후 빈/실패 화면을 막는 최후 안전망. 대단히 훌륭하진 않아도 카드
// 구조는 유지하고, 경력 사실(전환/동일)에 맞춰 안전한 표현으로만 채운다.
export function buildFallbackResult(free: FreeContext, paid: PaidAnswers): PaidAnalysisResult {
  const occ = or(free.occupation);
  const mainKo = or(mainTypeToKorean(free.mainType));
  const totalKo = or(experienceToKorean(free.experienceLevel));
  const currentKo = or(currentFieldToKorean(free.currentOccupationRange));
  const transition = isTransitionOrMixed(free.experienceLevel, free.currentOccupationRange);
  const keep = orList(paid.mustKeep);
  const runway = or(paid.runway);
  const energy = or(paid.energyLevel);

  const assetKo = occ.includes('수의') ? '수의학 전문 자격과 도메인 이해, 신뢰 자산' : `'${occ}'로서의 전문성`;
  const S = (title: string, body: string): NarrativeSection => ({ title, body });
  return {
    summaryCard: {
      coreNow: transition
        ? `전체 경력은 ${totalKo}이지만 현재 '${occ}' 기반 역할은 ${currentKo}로, 지금은 기존 경험과 ${assetKo}을 어떻게 조합할지 정하는 국면이에요.`
        : `지금은 '${occ}'로 쌓아온 것을 어떤 방향으로 더 키울지 정하는 시점이에요.`,
      biggestRisk: `수입과 시간 여건(버틸 기간: ${runway})을 넘어서는 큰 실험은 지금 리스크가 커요.`,
      dontDo: '기존 일 복귀냐 새 방향이냐를 한 번에 확정하려 서두르지 않기.',
      doThis: `이번 달은 '돈을 낼 사람이 실제로 있는가'를 확인하는 작은 검증 하나에 집중하기.`,
      judgeBy: '30일 뒤, DM·상담 요청·소액 결제 같은 돈에 가까운 반응이 하나라도 나왔는지로 판단하기.',
    },
    currentPosition: S('지금 당신이 멈춰 선 곳',
      `전체 경력은 ${totalKo}이지만 현재 '${occ}' 기반 역할은 ${currentKo}로 입력되어 있어, 한 직업을 오래 지속한 사람의 피로감보다는 여러 경험을 지나 지금의 전문성을 어떻게 쓸지 고민하는 전환 국면으로 읽힙니다. 지키고 싶은 것(${keep})과 버틸 기간 ${runway}이라는 조건이 지금 결정의 테두리를 정하고 있어요.`),
    whyNow: S('왜 하필 지금 이 마음이 왔는지',
      `수입 여건과 버틸 기간 ${runway}이라는 현실이 다가오면서, '지금 확인하지 않으면 안 된다'는 감각이 커진 시점이에요. ${assetKo}을 가진 상태에서, 그것을 지금의 자리에 묶어둘지 다른 형태로 꺼낼지의 질문이 올라와 있습니다.`),
    innerConflict: S('두 마음의 줄다리기',
      `한쪽에는 기존 일을 확대해 안정을 지키려는 마음이, 다른 한쪽에는 ${assetKo}을 새로운 방향으로 꺼내보고 싶은 마음이 있어요. 두 마음이 팽팽한 이유는 어느 쪽도 아직 '돈에 가까운 반응'으로 검증되지 않았기 때문입니다.`),
    riskMap: S('현실 리스크 지도',
      `버틸 기간 ${runway}, 최소 필요 수입 ${or(paid.incomeFloor)}, 부양 ${or(paid.dependents)}이라는 조건은 실험의 크기를 정하는 상한입니다. 수입을 흔드는 큰 전환보다, 지금 수입을 지키면서 '살 사람이 있는가'만 확인하는 저리스크 검증이 맞아요.`),
    transitionAssets: S('당신이 이미 가진 전환 자산',
      `${assetKo}은 오래 종사한 경력이 아니라 지금 바로 신뢰로 쓸 수 있는 자산이에요. 여기에 지나온 다른 경험을 더하면, 같은 문제를 남과 다른 각도로 풀 수 있는 조합이 만들어집니다.`),
    monthlyExperiment: {
      title: '이번 달의 30일 실험',
      body: `이번 달의 목표는 방향을 확정하는 것이 아니라, ${assetKo}에 '돈을 낼 사람이 있는가'를 30일 안에 확인하는 것입니다. 버틸 기간 ${runway} 안에서 수입을 흔들지 않는 크기로, 아래 실험 중 하나를 골라 실제 반응을 받아 보세요.`,
      experiments: [
      {
        title: '전문성 기반 짧은 콘텐츠', body: `'${occ}'로서의 전문 지식을 짧은 글/영상으로 옮겨 30일간 반응을 확인합니다.`,
        hypothesis: '내 전문 지식이 특정 대상에게 유용한 콘텐츠로 통하는가',
        target: `${occ} 전문성이 도움이 될 구체적 한 집단(예: 같은 고민을 가진 동료/고객)`,
        action: '실무 질문에 답하는 콘텐츠 끝에 "상담/소액 유료 자료" 제안을 붙여 실제 반응을 유도',
        successMetric: 'DM·상담 요청·소액 결제·이메일 확보 같은 돈에 가까운 반응이 4주간 나오는지(저장·좋아요는 제외)',
        stopSignal: '돈에 가까운 반응이 전혀 없으면 "무료로는 관심, 유료로는 아님" 가설을 채택하고 대상/제안을 교체',
        whyThisFits: `버틸 기간(${runway})·에너지(${energy})를 고려해 수입을 흔들지 않는 작은 검증이라서`,
      },
      {
        title: '대상 좁힌 메시지 테스트', body: '도움을 줄 대상을 한 명으로 좁혀, 그에게 맞는 제안 메시지를 시험합니다.',
        hypothesis: '좁힌 대상에게 내 제안이 실제로 필요한가',
        target: '지금 바로 도움을 줄 수 있는 구체적인 한 사람/집단',
        action: '그 대상에게 맞춘 1:1 제안을 직접 전하고 반응을 듣기',
        successMetric: '대화가 다음 단계(질문·요청)로 이어지는지',
        stopSignal: '세 번 시도해도 무반응이면 대상/메시지를 바꾸기',
        whyThisFits: `지키고 싶은 것(${keep})을 해치지 않는 범위의 실험이라서`,
      },
      {
        title: '기존 경험 결합 문제정의', body: '지나온 경험과 현재 전문성을 묶어 작은 문제 하나를 정의해 봅니다.',
        hypothesis: '두 경험의 교집합에서 나만의 각도가 나오는가',
        target: '그 문제를 실제로 겪는 사람',
        action: '문제·해결 가설을 한 장으로 적어 3명에게 검증',
        successMetric: '"그거 나도 필요해"라는 구체 공감이 나오는지',
        stopSignal: '공감이 전혀 없으면 문제 정의를 다시',
        whyThisFits: '복합 커리어 자산을 하나의 각도로 모으는 첫 걸음이라서',
      },
      ],
    },
    futureMessage: S('한 달 뒤의 당신에게',
      `한 달 뒤의 당신은 방향을 확정하지 않았더라도, '누가 무엇에 돈을 낼 수 있는가'에 대해 한 뼘 더 알게 될 거예요. 지금의 질문은 기존 일을 계속할지 말지의 단순한 선택보다, 지금까지의 경험과 ${assetKo}을 어떤 방식으로 조합할지에 더 가깝습니다. 이번 달의 작은 검증 하나가 그 조합의 첫 단서가 되어 줄 거예요.`),
    sevenDayPlan: [
      '1일차: 유료 반응을 확인할 가설 1개를 정의한다(예: 이 대상은 이 문제에 돈을 낼 것이다).',
      '2일차: 실제 구매 가능성이 있는 타깃 10명을 이름/채널까지 리스트업한다.',
      '3일차: 그들에게 보낼 제안 메시지 또는 랜딩 문구를 한 편 작성한다.',
      '4일차: 콘텐츠 또는 제안 1개를 실제로 공개한다.',
      '5일차: DM·댓글·지인 5명에게 직접 제안하고 반응을 요청한다.',
      '6일차: 받은 반응을 돈/관심/칭찬/무반응으로 분류한다.',
      '7일차: 다음 주에 키울 가설과 버릴 가설을 결정한다.',
    ],
    recheckCriteria: [
      '돈에 가까운 반응(DM·상담·소액 결제·예약)이 한 건이라도 나왔나요?',
      '어떤 대상·제안이 반응했고, 어떤 가설을 버려야 하는지 명확해졌나요?',
      '다음 30일에 더 키워볼 방향이 하나로 좁혀졌나요?',
    ],
    ifTwoOrMoreYes: '두 가지 이상 예라면, 그 대상·제안을 다음 30일에 조금 더 키워 실제 수익 가능성을 확인해 보세요.',
    ifAllNo: '모두 아니오라면 전환을 서두르기보다, 대상·제안을 바꿔 다시 검증하거나 잠시 회복과 역할 재설계를 먼저 두세요.',
  };
}

// ── career sanitizer (차단 대신 위반 표현을 사실에 맞게 치환) ─────────────────
export function sanitizeCareerPhrasing(result: PaidAnalysisResult, occupation: string, currentUpper: number, bannedPhrases: string[]): PaidAnalysisResult {
  const occ = or(occupation);
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sanitize = (input: string): string => {
    let s = input;
    // 명시 금지 표현 → 중립 표현.
    for (const p of bannedPhrases) {
      if (p && s.includes(p)) s = s.split(p).join('현재 전문성을 하나의 축으로 보는 관점');
    }
    if (occ && occ !== '정보 없음') {
      const subjects = occ.includes('수의') ? [occ, '임상'] : [occ];
      for (const subj of subjects) {
        // "직업(로) N년" (N>현재상한) → 도메인 자산 표현으로.
        const asset = occ.includes('수의') ? `${subj} 전문 자격과 도메인 이해` : `${subj} 전문성`;
        s = s.replace(new RegExp(`${esc(subj)}(으?로)?\\s*\\d{1,2}(\\s*[~-]\\s*\\d{1,2})?\\s*년(\\s*차)?`, 'g'), (m) => {
          const maxN = Math.max(...((m.match(/\d{1,2}/g) ?? ['0']).map(Number)));
          return maxN > currentUpper ? asset : m;
        });
        // "직업 경력을 접/버리/포기" → 재배치 관점.
        s = s.replace(new RegExp(`${esc(subj)}\\s*경력을?\\s*(접|버리|포기)\\S*`, 'g'), `${subj} 전문성을 다른 형태로 재배치하는 선택`);
      }
      if (occ.includes('수의')) {
        s = s.replace(/임상\s*루틴의?\s*천장/g, '지금 역할에서 느끼는 한계')
             .replace(/오래\s*해온\s*병원/g, '지금의 임상 현장')
             .replace(/병원\s*일을\s*놓\S*/g, '지금 일을 재구성하는 것')
             .replace(/면허와\s*임상\s*경력/g, '수의학 전문 자격과 도메인 신뢰 자산');
      }
    }
    return s;
  };
  const sec = (n: NarrativeSection): NarrativeSection => ({ title: sanitize(n.title), body: sanitize(n.body) });
  const san = (v: string | undefined): string | undefined => (v === undefined ? undefined : sanitize(v));
  const te = (e: ExperimentItem): ExperimentItem => ({
    title: sanitize(e.title), body: sanitize(e.body),
    hypothesis: san(e.hypothesis), target: san(e.target), action: san(e.action),
    successMetric: san(e.successMetric), stopSignal: san(e.stopSignal), whyThisFits: san(e.whyThisFits),
  });
  return {
    summaryCard: {
      coreNow: sanitize(result.summaryCard.coreNow), biggestRisk: sanitize(result.summaryCard.biggestRisk),
      dontDo: sanitize(result.summaryCard.dontDo), doThis: sanitize(result.summaryCard.doThis), judgeBy: sanitize(result.summaryCard.judgeBy),
    },
    currentPosition: sec(result.currentPosition), whyNow: sec(result.whyNow), innerConflict: sec(result.innerConflict),
    riskMap: sec(result.riskMap), transitionAssets: sec(result.transitionAssets),
    monthlyExperiment: { title: sanitize(result.monthlyExperiment.title), body: sanitize(result.monthlyExperiment.body), experiments: result.monthlyExperiment.experiments.map(te) },
    futureMessage: sec(result.futureMessage),
    sevenDayPlan: result.sevenDayPlan.map(sanitize), recheckCriteria: result.recheckCriteria.map(sanitize),
    ifTwoOrMoreYes: sanitize(result.ifTwoOrMoreYes), ifAllNo: sanitize(result.ifAllNo),
  };
}

// ── 핸들러 ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'not_configured' }); return; }

  // body는 문자열로 올 수도, 파싱된 객체로 올 수도 있다.
  let body: { freeContext?: FreeContext; paidAnswers?: PaidAnswers };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'invalid_json' }); return;
  }
  const freeContext = body?.freeContext;
  const paidAnswers = body?.paidAnswers;
  if (!freeContext || !paidAnswers || typeof paidAnswers !== 'object') {
    res.status(400).json({ error: 'invalid_payload' }); return;
  }

  // PROFILE_FACTS(경력 사실) + USER_EVIDENCE_PACK(실제 서술 보존)을 프롬프트 맨 위에.
  const facts = buildProfileFacts(freeContext);
  const evidence = buildUserEvidencePack(freeContext, paidAnswers);
  const rawInputLen =
    (freeContext.occupation?.length ?? 0) + (freeContext.userFreeText?.length ?? 0)
    + (paidAnswers.trigger?.length ?? 0) + (paidAnswers.flowMoment?.length ?? 0);
  const userContent = `${facts.text}\n\n${evidence.text}\n\n${assembleUserContent(freeContext, paidAnswers)}`;
  // eslint-disable-next-line no-console
  console.log('[paid] input free-text chars:', rawInputLen, '| context chars:', userContent.length,
    '| careerContext:', facts.transition ? 'transition_or_mixed' : 'same_or_unknown',
    '| evidence sentences:', evidence.sentenceCount, '| keywords:', evidence.keywords.join(','));

  // ── 원칙: Claude의 rich primary를 유지. fallback은 catastrophic일 때만. normalize는 구조
  //   보정용(본문 대체 아님). quality warning이면 fallback으로 덮지 말고 content-repair로 보강.
  const t0 = Date.now();
  const SOFT_DEADLINE = 135000;
  const MAIN_TOO_LONG = 100000;
  const includeDiag = process.env.VERCEL_ENV !== 'production';
  try {
    const raw1 = await callClaude(apiKey, PAID_SYSTEM_PROMPT, userContent, MAX_OUTPUT_TOKENS);
    const ms1 = Date.now() - t0;
    const parsed1 = extractJson(raw1);
    const report = rawContentReport(parsed1);
    const topKeys = parsed1 ? Object.keys(rec(parsed1)) : [];
    // eslint-disable-next-line no-console
    console.log('[paid] call#1 ms:', ms1, '| rawLen:', raw1.length, '| parseOk:', parsed1 !== null,
      '| topKeys:', topKeys.join(','), '| hasCore:', report.hasCore, '| defaultedSlots:', report.defaultedSlots,
      '| sectionsWithBody:', report.sectionsWithBody, '| experimentCount:', report.experimentCount, '| sevenDayCount:', report.sevenDayCount);

    let result: PaidAnalysisResult;
    let finalResultSource = '';
    let repairAttempted = false; let repairSucceeded = false; let skippedRepairBecauseDeadline = false;

    if (parsed1 === null || !report.hasCore) {
      // catastrophic: 파싱 불가 또는 본문이 거의 없음 → 전체 fallback.
      result = buildFallbackResult(freeContext, paidAnswers);
      finalResultSource = 'full_fallback_used';
      // eslint-disable-next-line no-console
      console.log('[paid] catastrophic (no parse/no core) → full_fallback_used | total ms:', Date.now() - t0);
    } else {
      // primary 유지. 부족 필드만 normalize가 보완(내용 대체 아님).
      result = normalizePaidResult(parsed1);
      let errs = validationErrors(result);
      if (errs.length > 0) {
        const canRepair = (Date.now() - t0) < SOFT_DEADLINE && ms1 < MAIN_TOO_LONG;
        if (canRepair) {
          repairAttempted = true;
          const tR = Date.now();
          const raw2 = await callClaude(apiKey, REPAIR_SYSTEM_PROMPT, buildRepairInput(raw1), MAX_OUTPUT_TOKENS);
          const p2 = extractJson(raw2);
          const n2 = p2 !== null ? normalizePaidResult(p2) : null;
          if (n2 && validationErrors(n2).length === 0) { result = n2; errs = []; repairSucceeded = true; finalResultSource = 'schema_repair_normalized'; }
          // eslint-disable-next-line no-console
          console.log('[paid] schema-repair ms:', Date.now() - tR, '| ok:', repairSucceeded, '| total ms:', Date.now() - t0);
        } else { skippedRepairBecauseDeadline = true; }
        if (errs.length > 0) { result = buildFallbackResult(freeContext, paidAnswers); finalResultSource = 'full_fallback_used'; }
      }
      if (!finalResultSource) {
        finalResultSource = report.defaultedSlots === 0 ? 'primary_normalized'
          : (report.defaultedSlots <= 4 ? 'primary_with_minor_defaults' : 'partial_fallback_sections');
      }
    }

    // 최종 유효성(정상적으로 fallback도 유효). 그래도 무효면 진단 422.
    const finalErrs = validationErrors(result);
    if (finalErrs.length > 0) {
      const diag = {
        error: 'validation_failed', stage: 'final', topLevelKeys: topKeys, missingFields: finalErrs,
        repairAttempted, repairSucceeded, skippedRepairBecauseDeadline, elapsedMs: Date.now() - t0,
      };
      // eslint-disable-next-line no-console
      console.error('[paid] UNRECOVERABLE validation_failed', JSON.stringify(diag));
      res.status(422).json(includeDiag ? diag : { error: 'validation_failed' });
      return;
    }

    // ── quality gate: golden 미달이면 fallback으로 덮지 말고 content-repair로 보강(fallback도 evidence로 구체화) ──
    const warnings = qualityWarnings(result, evidence, finalResultSource);
    // eslint-disable-next-line no-console
    console.log('[paid] qualityWarnings:', warnings.length ? warnings.join(',') : 'none', '| source(pre-content-repair):', finalResultSource);
    let contentRepairAttempted = false; let contentRepairSucceeded = false;
    const shouldContentRepair = warnings.length > 0 && (Date.now() - t0) < SOFT_DEADLINE && ms1 < MAIN_TOO_LONG;
    if (shouldContentRepair) {
      contentRepairAttempted = true;
      const tC = Date.now();
      const cr = await callClaude(apiKey, CONTENT_REPAIR_SYSTEM_PROMPT,
        buildContentRepairInput(JSON.stringify(result), facts.text, evidence.text, warnings), MAX_OUTPUT_TOKENS);
      const cp = extractJson(cr);
      if (cp !== null && rawContentReport(cp).hasCore) {
        const cn = normalizePaidResult(cp);
        // 교정본이 유효하고, 남은 quality 경고가 줄었을 때만 채택.
        if (validationErrors(cn).length === 0 && qualityWarnings(cn, evidence, 'content_repair_normalized').length < warnings.length) {
          result = cn; finalResultSource = 'content_repair_normalized'; contentRepairSucceeded = true;
        }
      }
      // eslint-disable-next-line no-console
      console.log('[paid] content-repair ms:', Date.now() - tC, '| succeeded:', contentRepairSucceeded, '| source(after):', finalResultSource, '| total ms:', Date.now() - t0);
    }

    // ── career sanitize (전환 국면, deterministic). 차단 아님. ──
    if (facts.transition) {
      result = sanitizeCareerPhrasing(result, freeContext.occupation, facts.currentUpper, facts.bannedPhrases);
      const v = factViolations(result, freeContext.occupation, facts.currentUpper, facts.bannedPhrases);
      // eslint-disable-next-line no-console
      console.log('[paid] post-sanitize violations(non-blocking):', v.length ? v.join(' / ') : 'none');
    }

    // ── 완료 지표 로깅(품질 판정용) ──
    const finalStats = defaultStats(result);
    const finalWarnings = qualityWarnings(result, evidence, finalResultSource);
    const evidenceKeywordCount = evidence.keywords.filter((k) => JSON.stringify(result).includes(k)).length;
    // eslint-disable-next-line no-console
    console.log('[paid] DONE | finalResultSource:', finalResultSource,
      '| rawContentBodyLength:', finalStats.bodyLength, '| defaultBodyCount:', finalStats.defaultBodyCount,
      '| defaultItemCount:', report.defaultedSlots, '| evidenceKeywordCount:', evidenceKeywordCount,
      '| qualityWarnings:', finalWarnings.length ? finalWarnings.join(',') : 'none',
      '| contentRepairAttempted:', contentRepairAttempted, '| contentRepairSucceeded:', contentRepairSucceeded,
      '| repairAttempted:', repairAttempted, '| skippedRepairBecauseDeadline:', skippedRepairBecauseDeadline,
      '| total ms:', Date.now() - t0);
    res.status(200).json(result);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[paid] upstream/exception:', e instanceof Error ? e.message : 'unknown', '| total ms:', Date.now() - t0);
    res.status(502).json({ error: 'upstream_error' });
  }
}
