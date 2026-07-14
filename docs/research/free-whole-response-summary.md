# 무료 결과 '전체 답변을 종합하면' — 최대 2문장·추상화·진단 전용

- 날짜: 2026-07-14 (2026-07-15 최대 2문장/재진술·처방 제거로 재설계 → 조립형 도입부 제거 → 문법·자연스러움 최종 수정)
- 블록 라벨: **"전체 답변을 종합하면"** (초안 "전체 답변으로 본 현재 상태"에서 변경).
- 범위: 기존 CurrentPositionSummary(mainType 한 줄)를 WholeResponseSummary(mainType + resultContext 재사용, **최대 2문장**)로 재설계. 엔진·질문·점수·조건부 흐름·유료 파이프라인 무변경.

## 1. 문제

- mainType 한 줄만으로는 전체 무료 응답을 종합했다는 느낌이 부족했다.
- 초안(3문장)은 (a) 사용자의 답을 거의 그대로 다시 읽고, (b) 처방형 표현을 넣는 문제가 있었다.
- 이후 수정본도 여러 문장이 "마음이 기우는 방향은 있지만"이라는 공통 도입부를 공유해 조립형으로 읽혔고, 일부 문장(unvalidatedAspirant 국면, identity/career_capital friction, 낮은 준비도 문장)에 문법·표현 어색함이 남아 있었다.

## 2. 사용한 기존 결과 필드

`buildResultFromResponses`가 이미 계산한 필드만 재사용한다. 새 점수·threshold·분류 없음.

- `spine.solutionLayer.mainTypeKey` (MainTypeKey) — 국면 문장(1번째)
- `spine.resultContext.showPullDirection` (boolean) — **또렷한 방향이 있는지 여부만** 판단(구체 방향명은 절대 노출하지 않음). 기존 `resultContextEngine.ts` 게이트(`NO_PULL_TYPES`=scatteredExplorer/lowOptionVisibility/overloadedBurnout, 또는 `pullConfident` 낮으면 false).
- `spine.resultContext.primaryFriction` (FrictionSource) — 긴장 문장의 병목 축
- `spine.resultContext.readinessLevel` (ReadinessLevel) — 준비 상태 문장

`pullDirection` 값(창업/콘텐츠 등 구체 방향)은 입력 인터페이스에는 남아 있으나 **로직에서 읽지 않는다** — 방향은 항상 "변화 가능성/새로운 방향"처럼 상위 개념으로만 표현한다. 컴포넌트는 `mainType`과 `resultContext`(4필드 pick)만 받고, raw responses·pt_*·patternProfile은 입력으로 받지 않는다(정적 타입으로 강제).

## 3. 문장 생성 구조 (최대 2문장, 구조·우선순위 로직은 불변)

`buildWholeResponseSummary()`가 순수 함수로 조립한다.

**1문장 — 현재 의사결정 국면**: `currentPositionCopy(mainType)` 재사용(10종 중 3종은 §4에서 문구 재수정, 나머지 7종은 유지).

**2문장 — 긴장 또는 준비 상태 중 정보 가치가 높은 하나**(항상 3개를 다 출력하지 않음). 우선순위 순수 함수 `pickSecondSentence`(변경 없음):

1. `readinessLevel === 'pause'` → 준비 상태 문장(에너지). 단 `overloadedBurnout`은 국면이 이미 회복을 말하므로 생략.
2. `showPullDirection && primaryFriction` → **긴장 문장** = `FRICTION_TENSION[friction]` 그대로(공통 도입부 없음). 단 `lowOptionVisibility`/`scatteredExplorer`/`unvalidatedAspirant`/`realityLocked`/`leverageReady`/`overloadedBurnout`은 생략 → 긴장 문장은 **conflictedAtFork·plateauedPerformer·restlessStabilizer·emergingLeader** 4개에서만 나온다.
3. `readinessLevel === 'reflect_only'` → 준비도 낮음 문장(폴백).
4. 그 외 → 2번째 문장 없음(첫 문장만).

### 최종 수정된 문구(이번 회차)

**FRICTION_TENSION**(각각 독립 완성 문장, 공통 도입부 없음):
- `income_uncertainty`: "변화 가능성은 보이지만, 현실적인 안전 조건이 결정 속도를 늦추고 있어요."
- `career_capital_loss`: "새로운 가능성은 보이지만, 기존 경력과 단절될 수 있다는 부담이 결정 속도를 늦추고 있어요." (수정: "연속성을 놓기 어려워 결정이 늦어지고 있어요" → 위 문장)
- `identity_loss`: "새로운 방향은 보이지만, 그 역할에 대한 자기 확신은 아직 충분하지 않아요." (수정: "확신은 아직 충분히 따라오지 못하고 있어요" → 위 문장)
- `too_many_live_options`/`low_market_signal`/`low_energy`/`time_constraint`/`tradeoff_pain`: 변경 없음.

**READINESS_STATE**(낮은 준비도 2종만):
- `pause`: "새로운 판단을 밀고 나갈 에너지도 아직 부족해요." (수정: "에너지 자체가 아직 부족한 상태예요" → 위 문장, "부족한 상태" 중복 표현 제거)
- `reflect_only`: "아직 실행으로 옮길 준비는 충분하지 않아요." (수정: "실행에 나설 준비도가 낮은 상태예요" → 위 문장, "준비도"+"상태" 이중 명사화 제거)

**CURRENT_POSITION_COPY**(국면 문장 3종 재수정, `currentPositionCopy.ts`):
- `unvalidatedAspirant`: "지금은 방향이 어느 정도 잡혀 있고, 실제 반응을 통해 가능성을 확인하는 단계에 가까워요." (수정: "방향은 어느 정도 잡혔고, 실제로 통할지 반응을 확인해보는 검증 단계" — 조사 오류 "방향은"→"방향이", "확인해보는" 어색함 제거)
- `restlessStabilizer`: "지금은 자리를 옮기기보다, 현재 자리 안에서 변화의 여지를 살펴보는 단계에 가까워요." (수정: "바꿀 수 있는 가능성을 살펴보는" → "변화의 여지를 살펴보는", 앞선 회차의 "가능성"과 friction 문장의 "가능성" 중복 회피)
- `leverageReady`/`realityLocked`/`overloadedBurnout`: 직전 회차 수정 유지(변경 없음).

두 문장은 `join(' ')`로 이어 렌더. 근거가 없으면 해당 문장 생략(억지 fallback 없음), 전부 없으면 0문장(영역 숨김).

### 원칙 준수
- **답변 재진술 금지**: 방향명 미노출, "변화 가능성/새로운 방향/새로운 가능성"처럼 상위 개념으로만.
- **조립형 금지**: FRICTION_TENSION 8종이 서로 다른 도입부(변화 가능성은/새로운 가능성은/새로운 방향은/여러 방향이/가고 싶은 방향은/방향을 좁혀갈/움직일 방향은/변화에서 얻고 싶은)로 시작해 공통 접두 반복이 없음.
- **무료에서 처방 금지**: "…있어요/…않아요/…충분하지 않아요" 등 상태 진단까지만.
- **문법·중복 정리**: 한 문장 안에서 "상태"·"단계" 같은 표현이 반복되지 않도록 각 문장을 검수.
- **모순 금지**: 국면이 "방향을 정하기 전"인 유형엔 긴장 문장을 붙이지 않음(SKIP_TENSION, 전 조합 테스트로 확인).

## 4. 실제 최종 출력 20개(축약 없음, 최종본)

| # | 사례 | mainType | showPull | primaryFriction | readiness | 실제 출력 |
|---|---|---|---|---|---|---|
| 1 | 방향 미확정 | lowOptionVisibility | F | low_market_signal | reflect_only | 지금은 방향을 정하기 전에, 어떤 선택지가 있는지부터 살펴보는 초반 탐색 단계에 가까워요. 아직 실행으로 옮길 준비는 충분하지 않아요. |
| 2 | 방향 미확정(준비 보통) | lowOptionVisibility | F | too_many_live_options | tiny_test | 지금은 방향을 정하기 전에, 어떤 선택지가 있는지부터 살펴보는 초반 탐색 단계에 가까워요. |
| 3 | 선택지 축소 | scatteredExplorer | F | too_many_live_options | tiny_test | 지금은 여러 방향을 충분히 둘러본 뒤, 실제로 집중할 것을 추려가는 단계에 가까워요. |
| 4 | 선택지 축소(준비 낮음) | scatteredExplorer | F | tradeoff_pain | reflect_only | 지금은 여러 방향을 충분히 둘러본 뒤, 실제로 집중할 것을 추려가는 단계에 가까워요. 아직 실행으로 옮길 준비는 충분하지 않아요. |
| 5 | 갈림길·안전조건 | conflictedAtFork | T | income_uncertainty | structured_test | 지금은 여러 길이 보이는 갈림길에서, 어느 쪽으로 갈지 결정을 앞두고 있는 단계에 가까워요. 변화 가능성은 보이지만, 현실적인 안전 조건이 결정 속도를 늦추고 있어요. |
| 6 | 갈림길·가치 상충 | conflictedAtFork | T | tradeoff_pain | tiny_test | 지금은 여러 길이 보이는 갈림길에서, 어느 쪽으로 갈지 결정을 앞두고 있는 단계에 가까워요. 변화에서 얻고 싶은 것과 지켜야 할 조건 사이의 우선순위가 아직 정리되지 않았어요. |
| 7 | 갈림길·경력 자산 | conflictedAtFork | T | career_capital_loss | reflect_only | 지금은 여러 길이 보이는 갈림길에서, 어느 쪽으로 갈지 결정을 앞두고 있는 단계에 가까워요. 새로운 가능성은 보이지만, 기존 경력과 단절될 수 있다는 부담이 결정 속도를 늦추고 있어요. |
| 8 | 방향 있으나 미검증 | unvalidatedAspirant | T | low_market_signal | tiny_test | 지금은 방향이 어느 정도 잡혀 있고, 실제 반응을 통해 가능성을 확인하는 단계에 가까워요. |
| 9 | 방향 있으나 미검증(준비 낮음) | unvalidatedAspirant | T | low_market_signal | reflect_only | 지금은 방향이 어느 정도 잡혀 있고, 실제 반응을 통해 가능성을 확인하는 단계에 가까워요. 아직 실행으로 옮길 준비는 충분하지 않아요. |
| 10 | 자신감 낮음(정체성) | plateauedPerformer | T | identity_loss | structured_test | 지금은 쌓아온 경력을 다음 단계로 잇기 위해, 전환의 첫발을 준비하는 단계에 가까워요. 새로운 방향은 보이지만, 그 역할에 대한 자기 확신은 아직 충분하지 않아요. |
| 11 | 자신감 낮음(경력 자산) | plateauedPerformer | T | career_capital_loss | tiny_test | 지금은 쌓아온 경력을 다음 단계로 잇기 위해, 전환의 첫발을 준비하는 단계에 가까워요. 새로운 가능성은 보이지만, 기존 경력과 단절될 수 있다는 부담이 결정 속도를 늦추고 있어요. |
| 12 | 실행 준비 완료(안전조건) | leverageReady | T | income_uncertainty | commitment_test | 현재는 방향과 현실 조건이 어느 정도 정리되어, 실행 가능성을 확인하는 단계에 가까워요. |
| 13 | 실행 준비 완료(시간) | leverageReady | T | time_constraint | structured_test | 현재는 방향과 현실 조건이 어느 정도 정리되어, 실행 가능성을 확인하는 단계에 가까워요. |
| 14 | 안정 속 재설계(가치) | restlessStabilizer | T | tradeoff_pain | tiny_test | 지금은 자리를 옮기기보다, 현재 자리 안에서 변화의 여지를 살펴보는 단계에 가까워요. 변화에서 얻고 싶은 것과 지켜야 할 조건 사이의 우선순위가 아직 정리되지 않았어요. |
| 15 | 안정 속 재설계(정체성) | restlessStabilizer | T | identity_loss | reflect_only | 지금은 자리를 옮기기보다, 현재 자리 안에서 변화의 여지를 살펴보는 단계에 가까워요. 새로운 방향은 보이지만, 그 역할에 대한 자기 확신은 아직 충분하지 않아요. |
| 16 | 조직 내 확장(가치) | emergingLeader | T | tradeoff_pain | structured_test | 지금은 자리를 옮기기보다, 현재 조직 안에서 역할과 영향력을 넓혀가는 단계에 가까워요. 변화에서 얻고 싶은 것과 지켜야 할 조건 사이의 우선순위가 아직 정리되지 않았어요. |
| 17 | 조직 내 확장(경력 자산) | emergingLeader | T | career_capital_loss | tiny_test | 지금은 자리를 옮기기보다, 현재 조직 안에서 역할과 영향력을 넓혀가는 단계에 가까워요. 새로운 가능성은 보이지만, 기존 경력과 단절될 수 있다는 부담이 결정 속도를 늦추고 있어요. |
| 18 | 현실 조건 우선(준비 낮음) | realityLocked | F | income_uncertainty | reflect_only | 현재는 방향 자체보다 재정과 시간 같은 현실 조건이 선택의 범위를 더 크게 좌우하는 상태에 가까워요. 아직 실행으로 옮길 준비는 충분하지 않아요. |
| 19 | 현실 조건 우선(에너지 고갈) | realityLocked | F | time_constraint | pause | 현재는 방향 자체보다 재정과 시간 같은 현실 조건이 선택의 범위를 더 크게 좌우하는 상태에 가까워요. 새로운 판단을 밀고 나갈 에너지도 아직 부족해요. |
| 20 | 소진(회복 우선) | overloadedBurnout | F | low_energy | pause | 현재는 새로운 결정을 밀고 나갈 에너지와 생활 리듬이 충분하지 않은 상태에 가까워요. |
| 21 | 신호 약한 구버전(mainType 없음) | — | — | — | — | (0문장 — 영역 숨김) |

## 5. 자연스러움·충돌 검사

`wholeResponseSummaryCopy.test.ts`(131 체크) + `currentPositionCopy.test.ts`(17 체크) + 위 20행 각각에 대해:
- §7 금지 표현 회귀 테스트 통과: "지금은 방향은/반응을 확인해보는/확신이(은) 따라오지 못/연속성을 놓기 어려워/바꿀 수 있는 가능성/준비도가 낮은 상태/에너지 자체가 아직 부족한 상태" — 국면 문장(10종)·긴장/준비 문장(10종) 전체에서 미포함 확인.
- 개별 답변 원문(옵션 id 패턴, 구체 방향명) 미포함, "…형"/"당신은" 없음.
- FRICTION_TENSION 8종이 동일 도입부로 시작하지 않음(4종 이상).
- 최대 2문장(전 mainType×friction×readiness×showPull 조합에서 `maxLen===2` 확인).
- 긴장 문장은 방향 또렷한 4개 유형에서만(방향 미확정 국면과 모순 없음, 전 조합 검사).
- 두 문장이 동일 문자열로 반복되지 않음, 한 문장 안에서 "상태"/"단계" 중복 없음(20행 육안 검수).
- 브라우저(§6)에서 핵심 고민 패턴 카피와 역할·어휘가 갈림.

## 6. 핵심 고민 패턴과의 역할 구분(브라우저 실측)

대표 프로필을 실제 컴포넌트(WholeResponseSummary + PatternTeaserView + CTA)로 375px 렌더:
- 전체 종합 = 지금 어디쯤(국면) + 긴장 또는 준비 상태(1~2문장). 핵심 고민 패턴 = 왜 어려운지(심리 원인)·신호·미해결 질문.
- 가장 겹치기 쉬운 conflictedAtFork+noSelectionCriteria 조합에서도: 종합 "갈림길 국면 + 안전 조건이 결정 속도를 늦춤"(상황) vs 패턴 "무엇을 먼저 볼지 기준이 없음"(원인) — 어휘·초점이 뚜렷이 갈림.
- 종합 블록(104~148px)이 패턴 카드(438~563px)보다 시각적으로 훨씬 작음. CTA 1개, 375px 가로 오버플로우 없음, 콘솔 오류 0.

## 7. 신규 패턴 질문(pt_*) 및 patternProfile 독립성

- pt_hold/pt_delay/pt_direction은 effect-free → mainType/resultContext 불변 → 전체 종합 불변(실제 엔진 통합 테스트로 `JSON.stringify` 동일 확인).
- `WholeResponseSummary` props에 patternProfile/responses 없음 → 컴파일 타임 오용 차단. `hybridFlow.test.ts` REQUIRED R가 호출부를 정적 검증.

## 8. 변경 파일(이번 회차)

- `wholeResponseSummaryCopy.ts` — FRICTION_TENSION(identity_loss/career_capital_loss), READINESS_STATE(pause/reflect_only) 문구만 수정. 구조·우선순위 로직(`pickSecondSentence`) 불변.
- `currentPositionCopy.ts` — CURRENT_POSITION_COPY(unvalidatedAspirant/restlessStabilizer) 문구만 수정. 나머지 8종·`currentPositionCopy()` 함수 불변.
- `wholeResponseSummaryCopy.test.ts` — §7 금지 표현 회귀 테스트 추가.
- `WholeResponseSummary.tsx` — 변경 없음(구조·라벨 그대로).
- diff 0: biasPatternEngine.ts, session.ts, resultContextEngine.ts, resultSpineEngine.ts, PatternTeaserView.tsx, patternTeaserCopy.ts, src/components/paid/, api/, db/, vercel.json, 질문 효과·조건부 pt_hold, 복수 선택 문구 개선.
