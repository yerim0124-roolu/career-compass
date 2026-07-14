# 복수 선택 문항 — 질문 본문 / 선택 제한 안내 분리 감사

- 날짜: 2026-07-14
- 범위: 현재 라이브 무료 흐름(`#hybrid` 라우트, `HybridFlowView`)이 렌더하는 모든 `multi_select` 문항의 질문 본문에서 "최대 N개" 표현을 제거하고, 렌더러가 `maxSelect` 값으로 자동 생성하는 공통 안내(`최대 {N}개까지 선택 가능`)로 분리했다. 선택지 ID·`maxSelect` 값·`scoreEffects`/`constructEffects`·조건부 흐름은 무변경.

## 1. 전체 복수 선택 문항 전수 검색

`CAREER_QUESTION_FLOW`(`src/data/careerQuestionFlow.ts`)와 실제 렌더러(`QuestionStepRenderer.tsx`, `HybridFlowView.tsx`)를 `multi_select`/`maxSelect`/`최대…개`/`골라주세요`/`선택 가능` 키워드로 전수 검색한 결과:

| 출처 | 문항 ID | maxSelect | 렌더러 |
|---|---|---|---|
| CAREER_QUESTION_FLOW | `ar_roles`(끌리는 역할) | 3 | `QuestionStepRenderer.tsx`(`HybridFlowView` mainFlow phase가 호출) |
| CAREER_QUESTION_FLOW | `cv_values`(포기하기 싫은 가치) | 5 | 〃 |
| chatFlow.ts `PROFILE_CHAT_STEPS` | `pc_concernTags`(커리어 고민) | 2 | `HybridFlowView.tsx`의 `ProfileChatStepView`(profile phase, 자체 렌더) |
| chatFlow.ts `PROFILE_CHAT_STEPS` | `pc_constraintTags`(현실적 제약, `none` 배타) | 2 | 〃 |
| chatFlow.ts `PROFILE_CHAT_STEPS` | `pc_desiredPaths`(관심 방향) | 2 | 〃 |

범위 밖(별도 화면, 이번 작업에서 미변경):
- `src/components/chatV1/GuidedChatView.tsx`(`#chat` 라우트) — 레거시/실험용 별도 플로우, 현재 기본 라우트는 `#hybrid`(`src/lib/routing.ts` 주석 참조). 라이브 무료 흐름이 아니라 범위 밖.
- `src/components/paid/PaidQuestionsView.tsx` — 유료 문항(§5 보호 대상, "최대 2개" 표기 무변경).
- `src/components/careerCompassV2/ProfileFormView.tsx`(`#v2` 라우트 전용 폼) — 별도 레거시 화면, `CAREER_QUESTION_FLOW`/`chatFlow.ts` 렌더 경로가 아님.

## 2. 변경 전후 문구

| 문항 ID | 변경 전 질문 본문 | 변경 후 질문 본문 | 안내(공통, 자동 생성) |
|---|---|---|---|
| `ar_roles` | (이미 "최대 N개" 없이 서술형이라 문구 변경 없음) | 변경 없음 | 최대 3개까지 선택 가능 |
| `cv_values` | "앞으로의 일에서 포기하기 싫은 것을 **최대 5개까지** 골라주세요." | "앞으로의 일에서 포기하기 싫은 것을 골라주세요." | 최대 5개까지 선택 가능 |
| `pc_concernTags` | "요즘 가장 큰 커리어 고민은 무엇인가요? **최대 2개까지** 골라주세요." | "요즘 가장 큰 커리어 고민은 무엇인가요?" | 최대 2개까지 선택 가능 |
| `pc_constraintTags` | "현실적으로 가장 걸리는 제약은 무엇인가요? **최대 2개까지** 골라주세요." | "현실적으로 가장 걸리는 제약은 무엇인가요?" | 최대 2개까지 선택 가능 |
| `pc_desiredPaths` | "관심 있는 방향은 무엇인가요? **최대 2개까지** 골라주세요." | "관심 있는 방향은 무엇인가요?" | 최대 2개까지 선택 가능 |

기존에 렌더러가 표시하던 문구도 통일:
- `QuestionStepRenderer.tsx`: 기존 "{n}개 선택 · 최대 {N}개 · 최소 {M}개"(제한과 카운트가 한 줄에 뒤섞임) → 제한 안내(그리드 위, `최대 {N}개까지 선택 가능`)와 라이브 카운트(그리드 아래, `{n}/{N} 선택 · 최소 {M}개`)를 분리.
- `HybridFlowView.tsx`(`ProfileChatStepView`): 기존 `최대 {max}개 선택` → `최대 {max}개까지 선택 가능`(문구 형식을 `QuestionStepRenderer`와 통일).

## 3. maxSelect 기반 공통 구현(하드코딩 없음)

`QuestionStepRenderer.tsx`(multi_select 분기):
```tsx
{step.maxSelect !== undefined && (
  <p className="text-xs text-slate-400">최대 {step.maxSelect}개까지 선택 가능</p>
)}
<MultiSelectCardGrid ... />
<p className="text-xs text-slate-400">
  {step.maxSelect !== undefined ? `${selectedIds.length}/${step.maxSelect} 선택` : `${selectedIds.length}개 선택`}
  {step.minSelect ? ` · 최소 ${step.minSelect}개` : ''}
</p>
```
`HybridFlowView.tsx`(`ProfileChatStepView`):
```tsx
const helperText = max !== undefined ? `최대 ${max}개까지 선택 가능` : '여러 개 선택 가능';
```
두 곳 모두 문항별 문자열을 하드코딩하지 않고 `step.maxSelect`(또는 `max`) 값에서 파생한다 — 문항이 늘어나거나 `maxSelect`가 바뀌어도 안내 문구가 자동으로 맞춰진다. `single_select` 분기에는 이 안내 자체가 없다(정적 소스 검사로 회귀 방지, §6).

## 4. 구현 원칙 준수

- 선택지 ID·`maxSelect` 값·`scoreEffects`/`constructEffects`는 전부 불변(테스트로 값 확인, §6).
- 선택 가능 개수 자체(3/5/2) 변경 없음.
- 제한 안내는 렌더러가 `maxSelect`에서 자동 생성 — 문항별 하드코딩 없음.
- 기존 `helperText`(문항별 안내, 예: `ar_narrow`의 "아직 뚜렷한 방향이 없다면…")와 선택 개수 안내는 서로 다른 슬롯이라 중복되지 않음.
- 단일 선택 문항에는 이 안내가 렌더되지 않음.
- 선택 완료 수는 "N/max 선택"(간결) 형태로 제한 안내와 다른 줄에, 다른 문구로 표시해 중복되지 않음.

## 5. 브라우저 검증(실제 라이브 `#hybrid` 흐름)

로컬 dev 서버에서 `#hybrid`로 처음부터 실제 세션을 진행하며 확인(스크린샷·DOM 상태로 확인, 콘솔 오류 0):

- **`pc_concernTags`(8/10, 프로필 채팅)**: 질문 본문에 "최대 N개" 없음. "최대 2개까지 선택 가능" 안내가 질문 아래 한 번만 표시. "돈"·"시간" 선택 후 다른 항목이 시각적으로 비활성화(disabled)됨, CTA가 "다음 (2개)"로 갱신. "이전" 클릭 시 이전 프로필 문항으로 정상 이동.
- **`pc_constraintTags`(9/10)**: 동일 패턴 확인 + `noneExclusive` 규칙(제한과 무관하게 유지) 정상.
- **`pc_desiredPaths`(10/10)**: 동일 패턴 확인.
- **`ar_roles`(3/22, 메인 플로우)**: 질문 본문 "이번 달에 실제로 시간을 써서 알아보고 싶은 역할만 골라주세요. …하나여도 괜찮아요. …"에 "최대 N개" 없음(원래도 없었음 — 회귀 없음 확인). "최대 3개까지 선택 가능" 안내 1회. 전문가·크리에이터·창업가 선택 후 나머지 카드 비활성화, 4번째 클릭(투자자·분석가) 무시 확인.
- **`cv_values`(9/22)**: 질문 본문 "앞으로의 일에서 포기하기 싫은 것을 골라주세요."로 단축(최대 5개 문구 제거 확인). "최대 5개까지 선택 가능" 안내 1회 + 라이브 카운트 "n/5 선택 · 최소 1개"가 별도 줄에 중복 없이 표시. 5개 선택 후 6번째(사회적 의미) 클릭 시 카운트가 "5/5 선택"에서 변하지 않음(제한 정상 동작, DOM으로 확인).
- 전체 22문항(단일 선택·강제 선택·랭킹·복수 선택 혼합) + 프로필 10문항을 실제로 끝까지 진행해 결과 화면 도달, 이전/다음/답변 수정(뒤로가기) 전부 정상, 모바일(375px)에서 안내 문구가 자연스럽게 표시(줄바꿈·잘림 없음), 콘솔 오류 0건.

## 6. 테스트(자동)

`src/data/multiSelectQuestionCopy.test.ts`(19개 체크, 전부 PASS):

- `CAREER_QUESTION_FLOW`/`PROFILE_CHAT_STEPS`의 모든 `multi_select` 문항 전수(5개) 확인, 질문 본문에 "최대 N개" 없음.
- `maxSelect` 값 불변(ar_roles=3, cv_values=5, pc_concernTags/constraintTags/desiredPaths=2), `pc_constraintTags.noneExclusive` 유지, `cv_values` 옵션 12개 불변.
- 모든 `single_select` 문항 본문에 "최대 N개" 없음(회귀 방지).
- `QuestionStepRenderer.tsx`/`HybridFlowView.tsx` 소스 정적 검사: 안내 문구가 `step.maxSelect`/`max` 템플릿에서 파생(하드코딩 문자열 아님), 라이브 카운트가 제한 안내와 다른 형식, `single_select` 분기에는 안내 자체가 없음.
