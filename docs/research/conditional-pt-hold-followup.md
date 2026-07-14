# cs_blocker → pt_hold 조건부 후속 질문 설계

- 날짜: 2026-07-14
- 범위: 무료 질문 흐름의 cs_blocker(상위)·pt_hold(조건부 후속) 재설계. 엔진 점수·임계값·유료 파이프라인 무변경.

## 1. 기존 중복 문제

production에서 두 문항이 사용자에게 중복으로 느껴졌다.
- cs_blocker: "지금 결정을 가장 미루게 만드는 건 무엇에 가까운가요?"
- pt_hold: "지금 결정을 미루게 하는 '아까움'에 가장 가까운 것은?"

둘 다 "무엇이 결정을 미루게 하나"를 병렬로 물어, 손실·시간·두려움 축에서 사실상 같은 답을 두 번 고르게 했다. 실제로는 독립 병렬 질문이 아니라, cs_blocker에서 손실·아까움 신호가 나타난 경우에만 pt_hold로 세부 원인을 확인하는 **상위 질문 → 조건부 후속** 구조가 맞다.

## 2. 상위 질문(cs_blocker)과 후속 질문(pt_hold)의 역할

- **cs_blocker(상위, 항상 노출)**: 전체 장애물을 넓게 확인. 문구만 수정("지금 행동으로 옮기는 데 가장 크게 걸리는 것은 무엇인가요?"). 선택지 ID·scoreEffects·constructEffects·기존 무료 결과 효과는 불변. 6개 장애물(방향 불명확·자신감·현실 조건·주변 기대·되돌리기 두려움·시간/에너지).
- **pt_hold(조건부 후속)**: 손실 신호가 있을 때만 cs_blocker 바로 뒤에 삽입. 소라벨 "추가 확인" + "새로운 선택을 할 때, 가장 포기하기 어려운 것은 무엇인가요?" + 안내("결정을 막는 전체 이유가 아니라, 지금 놓기 어려운 대상"). 옵션 ID·evidence 매핑(q1:*) 유지, 라벨만 재작성, effect-free 유지.
  - 이미 들인 시간과 노력(pt_hold_sunk) → sunkCost
  - 지금 가진 직함·안정·관계(pt_hold_endow) → endowmentEffect
  - 선택하지 않게 될 다른 가능성(pt_hold_loss) → lossAversion
  - 특별히 포기하기 어려운 것은 없다(pt_hold_none) → 코드 없음

## 3. 정확한 노출 조건 (shouldAskPtHold — 단일 순수 함수)

다음 중 하나라도 있으면 노출(true):
- **A. cs_blocker = blk_fail**("잘못되면 되돌리기 어려울까 봐 두렵다")
- **B. ar_narrow ∈ {nr_loss, nr_safety, nr_continuity}**(잃는 느낌 / 안정 못 버림 / 기존 경력 연속성)
- **C. rc_risk = rc_risk_none**("거의 없다" — 감당 가능한 손실이 매우 낮음)

다음만 있으면 미노출(false): 방향 불명확(blk_unclear)·자신감 부족(blk_confidence)·시간/에너지(blk_time)·주변 시선(blk_eyes)·정보 부족·모호성(nr_unsure)·실행 계획 부족.

옵션 ID는 `careerQuestionFlow.ts`에서 직접 확인해 사용(문구 기반 추측 없음). `shouldAskPtHold`는 UI 노출 여부와 결과 계산 시 pt_hold 유효성 판단에 **동일하게** 쓴다.

## 4. 기본 22문항 + 조건부 "추가 확인" 구조

- 정적 정의 `CAREER_QUESTION_FLOW`는 pt_hold를 포함해 **23개 그대로 유지**(길이·하위호환·다른 소비자 무변경).
- 실제 노출은 `getActiveCareerQuestionFlow(responses)`가 결정: pt_hold를 정적 위치에서 항상 제거하고, `shouldAskPtHold`=true일 때만 **cs_blocker 바로 뒤**에 삽입.
  - 미노출: 22문항 / 노출: 23문항.
- 정적/동적 분리로 모든 UI(현재·다음·이전·진행률·결과·수정·첫 미응답 복구)는 활성 흐름을 기준으로 동작하고, 컴포넌트가 정의를 직접 filter하지 않는다(공용 helper).

## 5. 진행률 처리

- `QuestionStep`에 표시·흐름 전용 optional 필드 추가: `conditionalFollowUp`, `countsTowardProgress`, `parentQuestionId`(scoring/construct/biasPatternEngine 미참조).
- pt_hold는 `countsTowardProgress:false` → 기본 진행률 **분모 22에서 제외**. pt_hold 화면은 숫자 대신 "추가 확인" 표시, 진행률 바는 직전 일반 문항 위치 유지.
- 예: cs_blocker "행동 · 18/22" → pt_hold "추가 확인" → ap_experiment "실행 · 19/22"(분모 22 불변, 18/22→19/22).

## 6. stale response 처리

- 이전 답변 수정으로 노출 조건 true→false가 되면, 진행 중 세션에서 **responses.pt_hold를 즉시 제거**(HybridFlowView·CareerCompassV2Page 효과). 다시 true가 되면 이전 답을 자동 적용하지 않고 재응답 요구.
- 결과 계산(`buildResultFromResponses`)은 조건이 false면 pattern 계산용 effectiveResponses에서 pt_hold를 **반드시 제외**(session.ts). 숨겨진/구버전 pt_hold로 q1:* evidence가 생겨 lossAversion/endowmentEffect/sunkCost가 억지로 구체 산출되는 것을 막는 안전망.

## 7. 구버전 세션 호환

- 로드 시(loadHybridSession) 조건이 false인데 저장된 pt_hold가 남아 있으면 제거. 재개 지점은 raw stepIndex가 아니라 **활성 흐름의 첫 미응답 문항**. 활성 흐름 길이 변화로 인덱스가 범위를 벗어나면 clamp.
- 완료된 기존 세션은 크래시 없이 결과를 열 수 있고, pattern 계산은 §6 게이팅으로 안전. legacy pt_hold 옵션 ID·PatternId·카피는 삭제하지 않음.

## 8. 패턴 분류 fallback

- pt_hold 미노출(손실 신호 없음) 사용자는 sunkCost/endowmentEffect/lossAversion으로 **억지 구체 분류하지 않는다**. q1 discriminator가 없으므로 instinctTrap category_only·다른 더 강한 패턴·기존 fallback 중 적절한 결과 사용.
- pt_hold를 실제 노출·응답한 경우에만 q1 discriminator를 구체 패턴 판별에 사용. biasPatternEngine 점수·임계값 무변경(엔진 diff 0; 게이팅은 session 계층).

## 9. 브라우저 검증 결과

3개 흐름 모두 통과(데스크톱·모바일, 콘솔 오류 0):
- **A. 손실 신호 없음**: cs_blocker(시간·에너지, 18/22) → pt_hold 미노출 → ap_experiment(19/22).
- **B. 손실 신호 있음**: cs_blocker(되돌리기 어려움) → "추가 확인" pt_hold 노출(헤더에 숫자 아닌 "추가 확인", 새 문구·안내·4옵션) → 응답 후 ap_experiment(분모 22 유지, 19/22).
- **C. 조건 변경**: 손실→pt_hold 응답 후 이전으로 돌아가 비손실로 변경 → pt_hold 사라짐 + `responses.pt_hold` 자동 제거 + stepIndex clamp(17). 완료 세션에서 stale pt_hold_sunk가 남아도 손실 신호가 없으면 결과가 sunkCost/매몰비용이 아님(선택 기준 부재로 산출).
- 모바일 375px 가로 오버플로우 없음, 결과 티저 정상, CTA 1개.
