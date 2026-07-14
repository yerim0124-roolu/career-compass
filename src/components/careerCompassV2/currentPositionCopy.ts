// currentPositionCopy — 무료 결과 '현재 위치'(의사결정 단계) 표시 카피(순수 데이터).
//
// 기존 무료 결과 엔진이 이미 산출한 mainType(MainTypeKey, 10개 상황 유형)만 재사용한다.
// 새 점수·threshold·분류를 만들지 않으며, mainType은 기존 20문항의 vector/gate/construct에서
// 계산되고 신규 패턴 문항(pt_hold/pt_delay/pt_direction, effect-free)에 영향받지 않는다.
// 따라서 pt_* 응답만 바뀌면 현재 위치 문장은 변하지 않는다.
//
// 문장 원칙(근거: docs/research/current-position-summary-reuse.md):
//   · 지금 어느 의사결정 단계(탐색/축소/검증/실행 준비/정비/회복 등)에 가까운지 1문장
//   · 심리 진단·성격 규정·패턴명(손실 회피/당위적 사고…) 금지, 행동 계획 미제공
//   · '흔들리고 있어요'·'마음의 정체'·'흐름이 보여요' 같은 추상 표현 금지
//   · 각 mainType의 기존 분류 의미에 맞춰 단계만 짚는다(패턴 카드 헤드라인과 중복 금지)

import type { MainTypeKey } from '../../types/careerCompass.ts';

// 문장은 '의사결정 여정의 어느 국면'인지(탐색→축소→검증→실행/정비/회복)를 짚는다. 패턴 카드가
// 다루는 심리적 원인(기준 부재·손실 회피 등)과 겹치지 않도록, 원인이 아니라 '국면'을 서술한다.
export const CURRENT_POSITION_COPY: Record<MainTypeKey, string> = {
  // 탐색 계열 — 선택지가 아직 안 보이거나 너무 넓게 열려 있음
  lowOptionVisibility: '지금은 방향을 정하기 전에, 어떤 선택지가 있는지부터 살펴보는 초반 탐색 단계에 가까워요.',
  scatteredExplorer: '지금은 여러 방향을 충분히 둘러본 뒤, 실제로 집중할 것을 추려가는 단계에 가까워요.',
  // 갈림길 — 길은 보이고, 결정을 앞둔 국면
  conflictedAtFork: '지금은 여러 길이 보이는 갈림길에서, 어느 쪽으로 갈지 결정을 앞두고 있는 단계에 가까워요.',
  // 검증 — 방향은 있으나 실제 반응 미확인
  unvalidatedAspirant: '지금은 방향이 어느 정도 잡혀 있고, 실제 반응을 통해 가능성을 확인하는 단계에 가까워요.',
  // 실행 준비 — 전환/레버리지 준비
  plateauedPerformer: '지금은 쌓아온 경력을 다음 단계로 잇기 위해, 전환의 첫발을 준비하는 단계에 가까워요.',
  leverageReady: '현재는 방향과 현실 조건이 어느 정도 정리되어, 실행 가능성을 확인하는 단계에 가까워요.',
  // 현재 자리 재설계 — 안정 속 변화 모색
  restlessStabilizer: '지금은 자리를 옮기기보다, 현재 자리 안에서 변화의 여지를 살펴보는 단계에 가까워요.',
  emergingLeader: '지금은 자리를 옮기기보다, 현재 조직 안에서 역할과 영향력을 넓혀가는 단계에 가까워요.',
  // 현실 조건 정비 / 회복 — 방향보다 조건·에너지가 먼저
  realityLocked: '현재는 방향 자체보다 재정과 시간 같은 현실 조건이 선택의 범위를 더 크게 좌우하는 상태에 가까워요.',
  overloadedBurnout: '현재는 새로운 결정을 밀고 나갈 에너지와 생활 리듬이 충분하지 않은 상태에 가까워요.',
};

// 기존 결과의 mainType이 없거나(구버전/불완전 세션) 매핑이 없으면 null → 영역 숨김(§7 fallback).
export function currentPositionCopy(mainType: MainTypeKey | undefined | null): string | null {
  if (!mainType) return null;
  return CURRENT_POSITION_COPY[mainType] ?? null;
}
