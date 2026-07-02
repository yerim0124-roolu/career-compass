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
// 토큰을 무작정 크게 두면 장문이 늘어 JSON이 안 닫힐 위험이 커진다. 필드별 길이
// 제한 + 고정 배열 개수 스키마와 함께 3500으로 두면 결과지 분량은 유지하면서
// JSON이 안정적으로 닫힌다. repair 재시도도 같은 상한을 쓴다.
const MAX_OUTPUT_TOKENS = 3500;

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
━━ 출력 형식 (반드시 아래 스키마에 '정확히' 맞는 순수 JSON만) ━━
규칙: 마크다운·코드펜스(\`\`\`)·설명·JSON 앞뒤 텍스트 전부 금지. 배열 개수는 지정 수를 정확히 지킬 것. 각 필드는 지정 글자 수를 넘기지 말 것(초과하면 JSON이 잘려 실패함). 프론트가 렌더하는 아래 필드만 생성. 자유 형식 장문 금지 — 각 필드는 지정 길이 안에서 밀도 있게.
{
  "summaryCard": {
    "coreNow": "지금 핵심 한 문장(60자 내외)",
    "biggestRisk": "가장 큰 리스크 한 문장(60자 내외)",
    "dontDo": "지금 하지 말 것 한 문장(60자 내외)",
    "doThis": "이번 달 할 것 한 문장(60자 내외)",
    "judgeBy": "30일 뒤 판단 기준 한 줄(60자 내외)"
  },
  "corePatterns": [
    { "title": "패턴 이름(20자 이내)", "body": "지금 결정을 못 내리게 하는 심리 메커니즘을 이 사람 언어로. 200~300자" }
  ],
  "blockers": [
    { "title": "20자 이내", "body": "붙잡는 현실·심리 요인. 150~250자" }
  ],
  "strengths": [
    { "title": "20자 이내", "body": "이미 가진 전환 자산. 150~220자" }
  ],
  "risks": [
    { "title": "20자 이내", "body": "돈·시간·가족·나이 반영한 현실 리스크. 120~200자" }
  ],
  "monthlyExperiments": [
    { "title": "실험 이름(20자 이내)", "body": "주제·대상·채널·행동·확인지표 포함한 30일 실험. 200~300자" }
  ],
  "sevenDayPlan": [
    "1일차에 할 구체적 한 가지. 60~100자"
  ],
  "recheckCriteria": [
    "30일 뒤 스스로 점검할 기준(예/아니오로 답할 수 있게). 80~150자"
  ],
  "finalMessage": "사용자가 직접 쓴 말을 다시 안아주는 마무리. 200~300자"
}
개수 규칙(반드시): corePatterns 정확히 3개, blockers 정확히 3개, strengths 정확히 3개, risks 2~3개, monthlyExperiments 정확히 3개, sevenDayPlan 정확히 7개(1일차~7일차 순서), recheckCriteria 정확히 3개.
JSON 외 어떤 텍스트도 금지. 마크다운·코드펜스 금지. 순수 JSON만.`;

// ── 요청/응답 타입 ─────────────────────────────────────────────────────────────
interface FreeContext {
  occupation: string; experienceLevel: string; ageBand: string;
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
    `경력 연차: ${or(experienceToKorean(free.experienceLevel))}`,
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

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isTitledArr = (v: unknown, min: number, max: number): boolean =>
  Array.isArray(v) && v.length >= min && v.length <= max
  && v.every((x) => { const o = x as Record<string, unknown>; return !!o && isStr(o.title) && isStr(o.body); });
const isStrArr = (v: unknown, n: number): boolean =>
  Array.isArray(v) && v.length === n && v.every((x) => isStr(x));

/** 스키마 검증 실패 항목 목록. 비어 있으면 유효. (로깅·진단용) */
export function validationErrors(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== 'object') return ['not_object'];
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  if (!sc || !isStr(sc.coreNow) || !isStr(sc.biggestRisk) || !isStr(sc.dontDo) || !isStr(sc.doThis) || !isStr(sc.judgeBy)) e.push('summaryCard');
  if (!isTitledArr(r.corePatterns, 3, 3)) e.push('corePatterns(3)');
  if (!isTitledArr(r.blockers, 3, 3)) e.push('blockers(3)');
  if (!isTitledArr(r.strengths, 3, 3)) e.push('strengths(3)');
  if (!isTitledArr(r.risks, 2, 3)) e.push('risks(2-3)');
  if (!isTitledArr(r.monthlyExperiments, 3, 3)) e.push('monthlyExperiments(3)');
  if (!isStrArr(r.sevenDayPlan, 7)) e.push('sevenDayPlan(7)');
  if (!isStrArr(r.recheckCriteria, 3)) e.push('recheckCriteria(3)');
  if (!isStr(r.finalMessage)) e.push('finalMessage');
  return e;
}

export function validateResult(o: unknown): boolean {
  return validationErrors(o).length === 0;
}

// ── repair 재시도용 ────────────────────────────────────────────────────────────
// 1차 출력이 파싱/검증에 실패하면, 원래 긴 사용자 입력을 다시 넣지 않고 '깨진 출력 +
// 스키마'만 넘겨 교정만 시킨다(빠르고 저렴). 교정도 실패하면 그때만 422.
const REPAIR_SYSTEM_PROMPT = `당신은 JSON 교정기입니다. 입력의 '깨진 출력'을 아래 스키마에 정확히 맞는 순수 JSON으로 고쳐서 출력합니다.
규칙: 마크다운·코드펜스·설명 절대 금지, 순수 JSON만. 필드명·타입·배열 개수를 스키마에 정확히 맞출 것. 누락 필드는 기존 내용에서 자연스럽게 채우되 새 주제를 지어내지 말 것. 각 필드 길이는 스키마 지시를 따를 것.`;

const SCHEMA_SPEC = `{
  "summaryCard": { "coreNow": string, "biggestRisk": string, "dontDo": string, "doThis": string, "judgeBy": string },
  "corePatterns": [ { "title": string, "body": string } ] (정확히 3),
  "blockers": [ { "title": string, "body": string } ] (정확히 3),
  "strengths": [ { "title": string, "body": string } ] (정확히 3),
  "risks": [ { "title": string, "body": string } ] (2~3),
  "monthlyExperiments": [ { "title": string, "body": string } ] (정확히 3),
  "sevenDayPlan": [ string ] (정확히 7),
  "recheckCriteria": [ string ] (정확히 3),
  "finalMessage": string
}`;

function buildRepairInput(brokenRaw: string): string {
  return `아래는 유효한 JSON을 만들려다 형식이 깨진 출력입니다. 내용은 최대한 보존하되, 지정 스키마에 '정확히' 맞는 순수 JSON만 다시 출력하세요.\n\n[깨진 출력]\n${brokenRaw.slice(0, 8000)}\n\n[반드시 맞출 스키마]\n${SCHEMA_SPEC}`;
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

  // 입력 길이 로깅(서술형 원문 총량 vs 압축 후 컨텍스트 길이).
  const rawInputLen =
    (freeContext.occupation?.length ?? 0) + (freeContext.userFreeText?.length ?? 0)
    + (paidAnswers.trigger?.length ?? 0) + (paidAnswers.flowMoment?.length ?? 0);
  const userContent = assembleUserContent(freeContext, paidAnswers);
  // eslint-disable-next-line no-console
  console.log('[paid] input free-text chars:', rawInputLen, '| compact context chars:', userContent.length);

  // ── non-streaming 호출 (+ 1회 repair 재시도) ──────────────────────────────────
  // 1차 생성이 JSON 파싱/스키마 검증에 실패하면, 원래 긴 입력을 다시 넣지 않고 '깨진
  // 출력 + 스키마'만 넘겨 교정만 시도한다(빠름). 교정도 실패해야 422. 각 호출 시간을
  // 로깅해 전체가 프론트 150초/서버 180초 안에 드는지 추적한다.
  const t0 = Date.now();
  try {
    let raw = await callClaude(apiKey, PAID_SYSTEM_PROMPT, userContent, MAX_OUTPUT_TOKENS);
    const ms1 = Date.now() - t0;
    let parsed = extractJson(raw);
    let errs = validationErrors(parsed);
    // eslint-disable-next-line no-console
    console.log('[paid] call#1 ms:', ms1, '| raw len:', raw.length, '| parseOk:', parsed !== null,
      '| validateOk:', errs.length === 0, errs.length ? `| missing: ${errs.join(',')}` : '');

    if (errs.length > 0) {
      // repair 재시도 1회.
      const tR = Date.now();
      raw = await callClaude(apiKey, REPAIR_SYSTEM_PROMPT, buildRepairInput(raw), MAX_OUTPUT_TOKENS);
      const msR = Date.now() - tR;
      parsed = extractJson(raw);
      errs = validationErrors(parsed);
      // eslint-disable-next-line no-console
      console.log('[paid] repair ms:', msR, '| raw len:', raw.length, '| parseOk:', parsed !== null,
        '| validateOk:', errs.length === 0, errs.length ? `| still missing: ${errs.join(',')}` : '',
        '| total ms:', Date.now() - t0);
      if (errs.length > 0) { res.status(422).json({ error: 'validation_failed' }); return; }
    }

    res.status(200).json(parsed);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[paid] upstream/exception:', e instanceof Error ? e.message : 'unknown',
      '| total ms:', Date.now() - t0);
    res.status(502).json({ error: 'upstream_error' });
  }
}
