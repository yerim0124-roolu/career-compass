// ─────────────────────────────────────────────────────────────────────────────
// signalMap.ts — Career Compass v2: "이렇게 판단한 이유" 4섹션의 소재
//
// 규칙 #4 — signals는 3개 비트를 *다른 레이어*에서 한 개씩 뽑아 해석형으로 잇는다:
//   ① 의지(mainType)   "…하고 있었고,"          ← intentByMainType
//   ② 조건(subtype)    "다만 …하지 못한 상태였습니다." ← conditionBySubtype
//   ③ 그래서 제안(friction) "…이 핵심이라, 그래서 …기로 했습니다." ← responseByFriction
//
// 톤: "검사 결과"가 아니라 *답변을 읽어준 느낌* + 격려. 사용자를 판정하지 않고,
//     의지를 인정 → 미완료 조건을 짚음 → 다음 한 걸음으로 연결.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessLevel } from '../types/careerCompass.ts';

// ① 의지/방향 — mainType별. "…있었고," 로 끝나 ②로 이어진다.
export const intentByMainType: Record<string, string> = {
  conflictedAtFork: '어느 쪽도 놓치고 싶지 않을 만큼 진지하게 고민하고 있었고,',
  scatteredExplorer: '여러 가능성에 진심으로 관심을 두고 있었고,',
  unvalidatedAspirant: '가고 싶은 방향이 이미 마음속에 또렷했고,',
  restlessStabilizer: '지금 자리를 충실히 지켜내고 있었고,',
  plateauedPerformer: '충분한 실력을 이미 갖추고 있었고,',
  leverageReady: '움직일 준비가 거의 갖춰져 있었고,',
  overloadedBurnout: '끝까지 버티며 최선을 다해왔고,',
  realityLocked: '하고 싶은 방향은 분명히 보였고,',
  lowOptionVisibility: '더 나아가고 싶은 마음은 분명했고,',
  emergingLeader: '더 넓게 끌어보고 싶은 마음이 있었고,',
};

// ② 미완료 조건 — subtype별. "다만 …" 으로 시작.
export const conditionBySubtype: Record<string, string> = {
  // conflictedAtFork
  incomeRisk: '다만 그 변화가 생활에 줄 영향을 아직 가늠해보지 못했습니다.',
  careerCapitalContinuity: '다만 쌓아온 경험을 어떻게 이어 쓸지 아직 찾지 못했습니다.',
  identityTransition: '다만 그 역할 속의 나를 아직 한 번도 작게 입어보지 못했습니다.',
  valuePreservation: '다만 어느 가치를 먼저 둘지 순서를 아직 정하지 못했습니다.',
  // scatteredExplorer
  possibilityClosureAvoidance: '다만 닫지 않고 잠시 미뤄두는 방식을 아직 써보지 못했습니다.',
  researchLoop: '다만 자료가 아니라 작은 시도로만 좁혀질 단계에 와 있었습니다.',
  curiositySpread: '다만 시간을 낼 수 있는 기준으로 후보를 아직 추리지 못했습니다.',
  // unvalidatedAspirant
  marketResponseUnknown: '다만 그 방향에 시장이 어떻게 반응할지 아직 확인하지 못했습니다.',
  selfFitUnknown: '다만 이 일을 계속 해낼 수 있을지 아직 확신이 서지 않았습니다.',
  sustainabilityUnknown: '다만 지금 크기로 지속할 수 있을지 아직 가늠하지 못했습니다.',
  // restlessStabilizer
  meaningDecline: '다만 그 안에서 의미를 더할 지점을 아직 찾지 못했습니다.',
  autonomyDeficit: '다만 그 안에서 스스로 정할 자리를 아직 회복하지 못했습니다.',
  growthRoutineAbsent: '다만 다시 성장한다는 감각을 줄 작은 루틴이 아직 없었습니다.',
  // plateauedPerformer
  expertiseStagnation: '다만 쌓은 것을 밖으로 꺼낼 통로를 아직 만들지 못했습니다.',
  recognitionGap: '다만 그 실력이 밖에서 보이는 형태로 아직 꺼내지지 않았습니다.',
  assetUnleveraged: '다만 그 실력을 활용해볼 첫 시도를 아직 시작하지 못했습니다.',
  // leverageReady
  contentLeverage: '다만 콘텐츠로 첫 신호를 아직 내보내지 못했습니다.',
  advisoryLeverage: '다만 자문·강의로 수요를 아직 확인해보지 못했습니다.',
  analysisLeverage: '다만 분석을 공개해 반응을 아직 받아보지 못했습니다.',
  independentPilot: '다만 작은 유료 일감으로 시장을 아직 확인해보지 못했습니다.',
  startupPrep: '다만 문제와 수요를 아직 작게 검증해보지 못했습니다.',
  generalLeverage: '다만 어느 방향부터 시작할지 아직 정하지 못했습니다.',
  // overloadedBurnout
  energyDepletion: '다만 지금은 판단보다 회복이 먼저인 상태였습니다.',
  decisionOverload: '다만 판단할 입력을 줄여둘 자리를 아직 만들지 못했습니다.',
  environmentDrain: '다만 에너지를 빼앗는 환경 요인을 아직 줄이지 못했습니다.',
  // realityLocked
  runwayShortage: '다만 움직일 수 있는 재정 여유가 아직 빠듯했습니다.',
  lossIntolerance: '다만 시도 크기를 감당할 수 있는 범위에 아직 맞춰보지 못했습니다.',
  externalConstraint: '다만 시간·역할에 대한 합의를 아직 이루지 못했습니다.',
  // lowOptionVisibility
  selfInfoGap: '다만 내 강점과 선호가 아직 또렷해지지 않았습니다.',
  marketInfoGap: '다만 바깥에 어떤 길이 있는지 아직 충분히 보이지 않았습니다.',
  roleLanguageGap: '다만 끌리는 일을 부를 이름을 아직 찾지 못했습니다.',
  // emergingLeader
  default: '다만 그 역할을 맡아 끌어볼 자리가 아직 주어지지 않았습니다.',
};

// ③ 그래서 제안 — readinessLevel별(행동 강도). 항상 ②③섹션 plan과 일치해 모순이 없다.
// (friction 기반은 선택이 불안정해 모순을 만들어 — 번아웃에 "시장에 내놓기" 등 — readiness로 고정.)
export const responseByReadiness: Record<ReadinessLevel, string> = {
  pause: '에너지가 바닥에 가까워, 그래서 지금은 무엇을 정하기보다 회복을 먼저 두기로 했습니다.',
  reflect_only: '그래서 이번 달은 결정을 서두르기보다, 머릿속을 종이 위에 정리하는 것부터 해보기로 했습니다.',
  tiny_test: '그래서 지금 할 수 있는 가장 작은 한 걸음부터 가볍게 시작해보기로 했습니다.',
  structured_test: '그래서 지금을 지키면서 병행할 수 있는 구조부터 만들어보기로 했습니다.',
  commitment_test: '그래서 한 달 동안 시간과 자원을 정해 걸고, 직접 확인해보기로 했습니다.',
};
