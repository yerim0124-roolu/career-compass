// Career Compass — 유료 미리보기용 subtype 코드 → 한글 짧은 라벨.
//
// resultContext.primarySubtype 등은 내부 코드값(예: 'valuePreservation')이다.
// 미리보기 문장에 코드값이 그대로 노출되면 안 되므로 여기서 한글 명사구로 바꾼다.
//
// ⚠️ TODO(사용자 확인 필요): 아래 라벨은 src/data/signalMap.ts의
//    conditionBySubtype(각 subtype의 공식 의미 문장)에서 파생한 "잠정" 짧은
//    표현이다. 최종 카피는 사용자 확인 후 확정할 것. 매핑에 없는 코드가 오면
//    subtypeToKorean()이 일반 표현(FALLBACK)으로 안전하게 폴백한다.

export const SUBTYPE_LABELS: Record<string, string> = {
  // conflictedAtFork
  incomeRisk: '생활에 줄 영향',
  careerCapitalContinuity: '쌓아온 걸 이어갈 길',
  identityTransition: '새로운 나로 옮겨가는 일',
  valuePreservation: '가치의 우선순위',
  // scatteredExplorer
  possibilityClosureAvoidance: '선택지를 닫기 어려운 마음',
  researchLoop: '끝나지 않는 정보 탐색',
  curiositySpread: '흩어진 관심',
  // unvalidatedAspirant
  marketResponseUnknown: '시장의 반응',
  selfFitUnknown: '해낼 수 있을지에 대한 확신',
  sustainabilityUnknown: '지속 가능성',
  // restlessStabilizer
  meaningDecline: '옅어진 의미',
  autonomyDeficit: '스스로 정할 자리',
  growthRoutineAbsent: '성장하는 감각',
  // plateauedPerformer
  expertiseStagnation: '실력을 꺼낼 통로',
  recognitionGap: '보이지 않는 실력',
  assetUnleveraged: '아직 안 쓴 자산',
  // leverageReady
  contentLeverage: '콘텐츠로 낼 첫 신호',
  advisoryLeverage: '자문·강의로 확인할 수요',
  analysisLeverage: '분석으로 받을 반응',
  independentPilot: '작은 유료 일감',
  startupPrep: '문제와 수요의 검증',
  generalLeverage: '어디부터 시작할지',
  // realityLocked
  runwayShortage: '움직일 재정 여유',
  lossIntolerance: '감당할 수 있는 시도 크기',
  externalConstraint: '시간·역할의 합의',
  // lowOptionVisibility
  selfInfoGap: '또렷하지 않은 내 강점',
  marketInfoGap: '바깥에 어떤 길이 있는지',
  roleLanguageGap: '끌리는 일을 부를 이름',
  // overloadedBurnout
  energyDepletion: '먼저 필요한 회복',
  decisionOverload: '줄여야 할 판단 부담',
  environmentDrain: '에너지를 빼앗는 환경',
  // emergingLeader
  default: '맡아서 끌어볼 자리',
};

/** 매핑에 없는 코드는 일반 표현으로 폴백. 코드값이 화면에 노출되지 않게 한다. */
const FALLBACK = '지금의 핵심 고민';

export function subtypeToKorean(code: string | undefined | null): string {
  if (!code) return FALLBACK;
  return SUBTYPE_LABELS[code] ?? FALLBACK;
}

// ── 나이대(ageBand) 코드값 → 한글 ──────────────────────────────────────────────
// 무료 profile.ageBand 코드값을 3단계 프롬프트에 한글로 넣기 위한 매핑.
// chatFlow.ts의 PROFILE_AGE_BAND label과 동일하게 유지한다.
const AGE_BAND_LABELS: Record<string, string> = {
  '20_early': '20대 초반',
  '20_late': '20대 후반',
  '30_early': '30대 초반',
  '30_late': '30대 후반',
  '40_early': '40대 초반',
  '40_late_plus': '40대 후반 이상',
};

/** 매핑에 없거나 비면 빈 문자열 반환 → 프롬프트에서 "나이 정보 없음"으로 처리 가능. */
export function ageBandToKorean(code?: string | null): string {
  if (!code) return '';
  return AGE_BAND_LABELS[code] ?? '';
}

// ── mainType 코드 → 한글 ───────────────────────────────────────────────────────
// 근거: src/types/careerCompass.ts의 MAIN_TYPE_LABELS(정본). 서버 번들을 가볍게
// 유지하려 값을 여기 복사하되, 정본이 바뀌면 함께 갱신할 것.
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
export function mainTypeToKorean(code?: string | null): string {
  if (!code) return '';
  return MAIN_TYPE_LABELS[code] ?? '';
}

// ── pullDirection(CareerOptionKey) 코드 → 한글 ────────────────────────────────
// 근거: src/types/careerCompass.ts의 CAREER_OPTION_LABELS(정본).
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
export function pullDirectionToKorean(code?: string | null): string {
  if (!code) return '';
  return PULL_DIRECTION_LABELS[code] ?? '';
}

// ── primaryFriction(FrictionSource) 코드 → 한글 ───────────────────────────────
// 근거: src/lib/resultContextEngine.ts의 friction 검출부 의미 + FrictionSource 타입.
// 임의 창작이 아니라 코드값의 의미를 짧은 명사구로 옮긴 것. 미매핑은 일반 표현 폴백.
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
export function frictionToKorean(code?: string | null): string {
  if (!code) return '';
  return FRICTION_LABELS[code] ?? FRICTION_FALLBACK;
}

// ── readinessLevel 코드 → 한글 ────────────────────────────────────────────────
// 근거: src/data/signalMap.ts의 responseByReadiness(각 준비도의 행동 강도 의미).
const READINESS_LABELS: Record<string, string> = {
  pause: '지금은 회복이 먼저인 단계',
  reflect_only: '생각을 정리하는 단계',
  tiny_test: '가장 작은 시도를 해볼 단계',
  structured_test: '병행할 구조를 만들 단계',
  commitment_test: '집중해 검증할 단계',
};
export function readinessToKorean(code?: string | null): string {
  if (!code) return '';
  return READINESS_LABELS[code] ?? '';
}

// ── 경력 연차(totalCareerStage) 코드 → 한글 ───────────────────────────────────
// 근거: src/types/careerCompass.ts의 UserProfile.totalCareerStage enum.
const TOTAL_CAREER_STAGE_LABELS: Record<string, string> = {
  total_0_3: '총 경력 0~3년',
  total_3_7: '총 경력 3~7년',
  total_7_12: '총 경력 7~12년',
  total_12_plus: '총 경력 12년 이상',
  no_fulltime_experience: '정규직 경험 없음',
};
export function experienceToKorean(code?: string | null): string {
  if (!code) return '';
  return TOTAL_CAREER_STAGE_LABELS[code] ?? '';
}
