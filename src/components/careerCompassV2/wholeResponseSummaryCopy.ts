// wholeResponseSummaryCopy — 무료 결과 '전체 답변을 종합하면' 블록 표시 카피(순수 데이터).
//
// 기존 무료 결과 엔진(buildResultFromResponses)이 이미 계산한 필드만 재사용한다. 새 점수·
// threshold·분류를 만들지 않고, raw responses·pt_hold/pt_delay/pt_direction을 직접 읽지 않으며,
// patternProfile을 근거로 쓰지 않는다.
//
// 출력 규칙(최대 2문장):
//   1문장(항상, 근거 있을 때): mainType 기반 현재 의사결정 국면 — currentPositionCopy 재사용.
//   2문장(정보 가치가 높은 하나만): pullDirection+primaryFriction 기반 '긴장' 또는 readinessLevel
//          기반 '현재 준비 상태' 중 하나. 국면·긴장·준비도를 항상 3개 다 출력하지 않는다.
//
// 원칙:
//   · 답변 재진술 금지 — 특정 선택지의 명사(콘텐츠/창업/자문/강의/독립…)를 그대로 붙이지 않고
//     한 단계 추상화한 판단으로 쓴다. 방향은 '변화 가능성/새로운 방향'처럼 상위 개념으로만 표현한다.
//   · 조립형 금지 — 여러 문장이 공통 도입부를 공유하지 않고 각 friction을 독립 완성 문장으로 쓴다.
//   · 무료에서 처방 금지 — '작게 확인해볼 시점/본격 검증 시점/짜임새 있는 검증/회복해야 함' 등
//     행동 지시·시점 표현을 쓰지 않는다. 현재 상태의 '진단'까지만 한다.
//   · 근거가 약하면 첫 문장만 — 억지로 2번째 문장을 만들지 않는다.

import type { MainTypeKey, FrictionSource, ReadinessLevel } from '../../types/careerCompass.ts';
import { currentPositionCopy } from './currentPositionCopy.ts';

// primaryFriction(병목) → 한 단계 추상화한 '긴장' 완성 문장. 공통 도입부('마음이 기우는 방향은
// 있지만')를 붙이지 않고 각 friction을 독립적인 완결 문장으로 쓴다. 답변 원문·구체 방향명을 담지
// 않고, 결정이 왜 늦춰지는지를 상태로만 서술한다(행동 지시·시점 표현 없음).
export const FRICTION_TENSION: Record<FrictionSource, string> = {
  income_uncertainty: '변화 가능성은 보이지만, 현실적인 안전 조건이 결정 속도를 늦추고 있어요.',
  career_capital_loss: '새로운 가능성은 보이지만, 기존 경력과 단절될 수 있다는 부담이 결정 속도를 늦추고 있어요.',
  identity_loss: '새로운 방향은 보이지만, 그 역할에 대한 자기 확신은 아직 충분하지 않아요.',
  too_many_live_options: '여러 방향이 모두 열려 있어, 무엇에 먼저 집중할지가 아직 좁혀지지 않았어요.',
  low_market_signal: '가고 싶은 방향은 잡혔지만, 그것이 실제로 통할지에 대한 근거는 아직 충분하지 않아요.',
  low_energy: '방향을 좁혀갈 수는 있지만, 그것을 밀고 나갈 에너지가 지금은 충분하지 않아요.',
  time_constraint: '움직일 방향은 어느 정도 보이지만, 실제로 시간과 여유를 내기가 아직 어려워요.',
  tradeoff_pain: '변화에서 얻고 싶은 것과 지켜야 할 조건 사이의 우선순위가 아직 정리되지 않았어요.',
};

// readinessLevel(행동 강도) → 현재 '준비 상태'만 진단(처방 없음). 준비도가 낮은 쪽(pause/
// reflect_only)에서만 정보 가치가 있어 그 2개만 정의한다(그 외 준비도는 국면 문장과 겹치므로
// 2번째 문장을 만들지 않는다).
export const READINESS_STATE: Partial<Record<ReadinessLevel, string>> = {
  pause: '새로운 판단을 밀고 나갈 에너지도 아직 부족해요.',
  reflect_only: '아직 실행으로 옮길 준비는 충분하지 않아요.',
};

// 긴장 문장(FRICTION_TENSION: '…방향은 보이지만, 병목이 결정을 늦춘다')을 만들지 않는 mainType.
//   · lowOptionVisibility/scatteredExplorer/realityLocked: 국면이 '방향 미확정/탐색/조건 정비'라
//     '또렷한 방향이 있다'는 긴장과 모순(엔진도 이들엔 showPullDirection=false).
//   · unvalidatedAspirant: 국면이 이미 '검증 중'이라 긴장(반응 미확인)과 중복.
//   · leverageReady: 국면이 이미 '실행 준비 완료'라 '막혀 있다'는 긴장과 모순.
//   · overloadedBurnout: 국면이 '회복'이라 방향 긴장이 부적절(에너지 상태가 헤드라인).
// 결과적으로 긴장 문장은 conflictedAtFork/plateauedPerformer/restlessStabilizer/emergingLeader
// 4개(기운 방향은 있으나 병목에 막힌 유형)에서만 나온다.
const SKIP_TENSION = new Set<MainTypeKey>([
  'lowOptionVisibility', 'scatteredExplorer', 'unvalidatedAspirant',
  'realityLocked', 'leverageReady', 'overloadedBurnout',
]);

// 국면 문장이 이미 '에너지 회복'을 말하는 mainType — pause 준비 상태 문장과 중복되므로 생략.
const SKIP_PAUSE_READINESS = new Set<MainTypeKey>(['overloadedBurnout']);

export interface WholeResponseSummaryInput {
  mainType?: MainTypeKey | null;
  // pullDirection 값(구체 방향)은 문장에 노출하지 않는다. '또렷한 방향이 있는지' 여부만
  // showPullDirection(기존 엔진 게이트)으로 판단한다. 필드는 호환 위해 남겨두되 로직에서 안 읽는다.
  pullDirection?: string | null;
  showPullDirection?: boolean;
  primaryFriction?: FrictionSource | null;
  readinessLevel?: ReadinessLevel | null;
}

// 2번째 문장 결정 — 순수 함수(새 점수·임계값 없음, 기존 필드/게이트만 사용).
function pickSecondSentence(input: WholeResponseSummaryInput): string | null {
  const mainType = input.mainType ?? undefined;
  const friction = input.primaryFriction ?? undefined;
  const readiness = input.readinessLevel ?? undefined;

  // 1) 회복이 필요한 매우 낮은 준비 상태 → 준비 상태 우선(국면이 이미 회복을 말하면 생략).
  if (readiness === 'pause' && !(mainType && SKIP_PAUSE_READINESS.has(mainType))) {
    return READINESS_STATE.pause ?? null;
  }
  // 2) 또렷한 방향(showPullDirection)과 구체적 병목(primaryFriction)이 함께 있으면 → 긴장 우선.
  if (input.showPullDirection && friction && !(mainType && SKIP_TENSION.has(mainType))) {
    return FRICTION_TENSION[friction];
  }
  // 3) 낮은 준비 상태(비회복) 폴백.
  if (readiness === 'reflect_only') {
    return READINESS_STATE.reflect_only ?? null;
  }
  // 4) 근거가 약하면 2번째 문장을 만들지 않는다.
  return null;
}

// 최대 2문장. 근거 필드가 없으면 해당 문장을 생략하고, 전부 없으면 빈 배열(영역 숨김).
export function buildWholeResponseSummary(input: WholeResponseSummaryInput): string[] {
  const sentences: string[] = [];

  const position = currentPositionCopy(input.mainType ?? undefined);
  if (position) sentences.push(position);

  const second = pickSecondSentence(input);
  if (second) sentences.push(second);

  return sentences;
}
