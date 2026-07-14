# 전체 답변 종합 블록 설계 + 복수 선택 문항 감사 범위 판단

날짜: 2026-07-14

## 해결한 문제

두 가지를 함께 처리했다.
1. mainType 하나만 문장으로 바꾸던 '현재 위치' 블록을, 새 점수/분류를 만들지 않으면서도 "전체 응답을 종합했다"고 느껴지는 여러 문장으로 확장해야 했다.
2. 여러 화면에 흩어진 복수 선택(multi_select) 문항 중, 실제로 사용자가 지나가는 라이브 무료 흐름에 속한 문항만 정확히 식별해 질문 본문과 선택 제한 안내를 분리해야 했다.

## 사용자에게 나타난 증상

- '현재 위치' 블록이 패턴 카드와 별개로 보이긴 하지만, mainType 한 줄만 바뀌는 구조라 "몇 개 신규 질문만으로 만든 결과"처럼 보일 위험이 남아 있었다.
- 이 저장소에는 같은 UI 패턴(카드 기반 질문 플로우)이 `#hybrid`(현재 기본), `#v2`(레거시 폼), `#chat`(레거시 실험) 세 라우트에 병렬로 구현돼 있어, "복수 선택 문항 전수 검색"을 코드베이스 전체에서 무작정 grep하면 사용자가 실제로 보지 않는 화면까지 건드릴 위험이 있었다.

## 확인된 근본 원인 / 조사 결과

- `src/lib/routing.ts` 주석에 라우트 맵이 정본으로 문서화되어 있음: 빈 해시를 포함한 기본 라우트는 `hybrid`(현재 제품), `#v2`는 레거시, `#chat`은 "실험(experiment)"로 명시. 즉 `HybridFlowView.tsx`가 유일한 라이브 진입점이다.
- `HybridFlowView.tsx`는 내부적으로 **두 개의 서로 다른 렌더러**를 쓴다: 메인 20여 문항은 `QuestionStepRenderer.tsx`(`CAREER_QUESTION_FLOW` 기반)를 그대로 재사용하고, 프로필 온보딩 10문항은 자체 `ProfileChatStepView`(`chatFlow.ts`의 `PROFILE_CHAT_STEPS` 기반)를 별도로 렌더한다. 두 렌더러 모두 "최대 N개" 안내 로직을 독립적으로 가지고 있어(각각 다른 문구 형식) 한쪽만 고치면 라이브 흐름 안에서도 불일치가 남는다.
- `ResultContext`(`resultContextEngine.ts`)에는 이미 `showPullDirection` 게이트가 있었다(`NO_PULL_TYPES = scatteredExplorer/lowOptionVisibility/overloadedBurnout`, 또는 `pullConfident`가 낮을 때 false). 이 필드를 재사용하면 "끌림 방향이 아직 불확실한 유형"에 억지로 끌림 문장을 만들지 않을 수 있었다.
- `FrictionSource`(8종) 열거형에는 "자신감/자기효능감" 전용 값이 없다 — "방향은 분명하지만 자신감이 낮은" 페르소나를 표현할 때 friction만으로는 부족해 readinessLevel(구조화된 검증 필요)로 주로 표현하고 friction은 근접한 값(`identity_loss`)으로 매핑하는 절충이 필요했다.

## 고려하거나 시도한 접근법

- **별도 블록을 하나 더 추가(현재 위치 + 새 블록 2개)** — 채택하지 않음: 화면이 길어지고 사용자 지시(§1 "별도 블록을 하나 더 쌓으면 화면만 길어지고… 문제는 남는다")에 정면으로 위배.
- **긴장 문장을 mainType×pullDirection×primaryFriction 전수 조합으로 하드코딩(9×8×10 문장)** — 채택하지 않음: 유지보수 불가능한 조합 폭발. 대신 pullDirection용 명사구 9개 + friction용 완결절 8개를 독립적으로 만들고 고정된 접속 템플릿(`"{pull}은 분명하지만, {friction}"`)으로 조합해, 항목이 늘어도 선형적으로만 커지게 설계.
- **paid/labelMap.ts의 기존 한글 라벨(pullDirectionToKorean 등)을 재사용** — 채택하지 않음: 무료 컴포넌트가 유료 폴더(`src/components/paid/`)에 의존하게 되는 역방향 결합이 생기고, paid 쪽 톤(명사구, 미리보기용)과 free 쪽에 필요한 톤(완결 문장)이 달라 향후 한쪽만 바뀌어도 다른 쪽이 의도치 않게 흔들릴 위험이 있었음. free 전용 템플릿을 별도로 새로 작성.
- **`GuidedChatView.tsx`(#chat)까지 함께 수정** — 채택하지 않음: 라우팅 주석상 실험/레거시 라우트로 확인됨. 라이브 흐름 범위 밖으로 판단해 문서에 "범위 밖" 근거와 함께 명시.

## 최종 해결 방법과 선택 이유

- `wholeResponseSummaryCopy.ts`에 순수 함수 `buildWholeResponseSummary(mainType, pullDirection, showPullDirection, primaryFriction, readinessLevel)`를 만들어 최대 3문장(국면→긴장→준비)을 조립. 근거 필드가 없으면 해당 문장만 생략(억지 fallback 금지). 기존 `currentPositionCopy.ts`는 그대로 국면 문장 소스로 재사용하고 컴포넌트만 `WholeResponseSummary.tsx`로 교체(`CurrentPositionSummary.tsx`는 삭제해 중복 렌더 지점을 없앰).
- 복수 선택 감사는 "실제 렌더러" 기준으로 범위를 `CAREER_QUESTION_FLOW`(→`QuestionStepRenderer.tsx`)와 `chatFlow.ts`의 `PROFILE_CHAT_STEPS`(→`HybridFlowView.tsx`의 `ProfileChatStepView`) 두 곳으로 한정하고, 각각의 렌더러가 `step.maxSelect`/`max` 값에서 안내 문구를 자동 생성하도록(하드코딩 없이) 통일했다.

## 변경된 주요 파일

- `src/components/careerCompassV2/wholeResponseSummaryCopy.ts` — 신규, 순수 템플릿/조립 함수.
- `src/components/careerCompassV2/WholeResponseSummary.tsx` — 신규, 표시 컴포넌트(mainType + resultContext 2개 prop만).
- `src/components/careerCompassV2/CurrentPositionSummary.tsx` — 삭제(WholeResponseSummary로 대체).
- `src/components/hybridV3/HybridFlowView.tsx` — 컴포넌트 교체 + `ProfileChatStepView`의 `multi_select` 안내 문구 통일.
- `src/components/careerCompassV2/QuestionStepRenderer.tsx` — `multi_select` 안내를 제한/카운트 두 줄로 분리, `maxSelect` 기반 자동 생성.
- `src/data/careerQuestionFlow.ts`, `src/lib/chatFlow.ts` — 질문 본문에서 "최대 N개" 문구만 제거(값/ID/효과는 무변경).

## 검증 방법과 결과

- 순수 함수 테스트(`wholeResponseSummaryCopy.test.ts`, 65 체크)로 10개 대표 페르소나 + pt_*/patternProfile 독립성 + 구버전 세션(resultContext 없음) fallback 확인.
- 복수 선택 테스트(`multiSelectQuestionCopy.test.ts`, 19 체크)로 문항 전수·maxSelect 불변·렌더러 소스의 하드코딩 여부를 정적 검사.
- 브라우저에서 `#hybrid`를 처음부터 끝까지(프로필 10문항 + 메인 22문항) 실제로 진행해 결과 화면 도달까지 확인: 선택 제한 초과 시 클릭 무시, 라이브 카운트와 제한 안내가 중복되지 않음, 콘솔 오류 0건.
- 전체 32개 노드 테스트 스위트(1960 체크) + `tsc -b && vite build` 통과, `git diff --check` clean.

## 재발 방지 원칙

- 이 저장소에서 "무료 흐름"을 감사/수정할 때는 항상 `src/lib/routing.ts`의 라우트 맵 주석으로 기본 라이브 라우트를 먼저 확인한다 — `#v2`/`#chat`은 병렬 레거시 구현이라 겉보기엔 같은 UI라도 별개 코드 경로다.
- `HybridFlowView.tsx`는 메인 문항과 프로필 문항에 서로 다른 렌더러를 쓴다는 점을 기억할 것 — 한쪽 렌더러만 고치면 같은 세션 안에서도 문구 형식이 어긋난다.
- N×M 조합이 필요한 표시 문장은 조합 전체를 하드코딩하지 말고, 각 축을 독립된 완결 문구 집합으로 만들고 고정 템플릿으로 접합한다.
- free/paid 폴더 간에는 코드(라벨 맵 포함)를 공유하지 않는다 — 톤이 다르고, 한쪽 변경이 다른 쪽에 의도치 않게 새어 들어갈 위험이 있다.

## 후속(2026-07-15) — 전체 종합 문장 품질 재설계

첫 구현(3문장)이 (a) 답을 거의 그대로 재진술하고("콘텐츠를 쌓고 싶지만 시장 반응이 없음"), (b) "작게 확인해볼 시점" 같은 처방을 무료 결과에 넣는 문제가 있어 재설계했다. 얻은 규칙:

- **최대 2문장**: 국면(mainType) 1문장 + 긴장/준비 중 정보 가치 높은 하나. 3개 축을 늘 다 출력하지 않는다.
- **방향명 절대 비노출**: pullDirection 값(창업/콘텐츠 등)을 문장에 넣지 않고 "마음이 기우는 방향"처럼 상위 개념으로만. `showPullDirection`(있는지 여부)만 읽는다 → 답변 재진술이 구조적으로 불가능해진다.
- **무료 결과는 진단까지만**: "…시점/…검증/회복해야/정리해야" 같은 행동·시점 표현 제거. 상태 서술("…있어요/…상태예요")로만.
- **국면 문장과 2번째 문장의 모순·중복을 SKIP 집합으로 차단**: 국면이 "방향 미확정"인 유형(lowOptionVisibility/realityLocked 등)엔 "방향은 있지만" 긴장을 붙이지 않고, 국면이 이미 회복/검증/실행완료를 말하는 유형엔 해당 2번째 문장을 생략한다. 전 조합(mainType×friction×readiness×showPull) 루프 테스트로 "모순 0"을 강제하면 이런 조합 실수를 컴파일 없이 잡아낸다.
- 조각을 기계적으로 잇는 대신 축별 완결 문구 + 고정 우선순위 순수 함수(`pickSecondSentence`)로 조립하면, 문장 수·모순·처방 여부를 전부 순수 함수 단위로 테스트할 수 있다.

## 남은 위험 / 후속 작업

- `FrictionSource`에 "자신감/자기효능감" 전용 값이 없어 관련 페르소나의 friction 매핑이 근사치(identity_loss)다. 정확도가 중요해지면 `FrictionSource`나 별도 축 확장이 필요하다.
- `#chat`(GuidedChatView.tsx)에는 이번에 통일한 "최대 N개까지 선택 가능" 문구가 반영되지 않았다 — 향후 그 라우트를 다시 활성화한다면 별도로 맞춰야 한다.
