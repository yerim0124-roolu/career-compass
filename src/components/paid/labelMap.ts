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
