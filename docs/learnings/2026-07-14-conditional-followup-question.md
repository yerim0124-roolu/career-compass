# 조건부 후속 질문(정적 정의 ↔ 활성 흐름 분리)과 stale 응답 게이팅

날짜: 2026-07-14

## 해결한 문제
중복 체감되던 두 문항(cs_blocker·pt_hold)을 "상위 질문 → 조건부 후속" 구조로 바꿨다. 손실·아까움 신호가 있을 때만 pt_hold를 cs_blocker 뒤에 노출하고, 조건이 바뀌면 stale 응답이 결과에 새지 않게 해야 했다. 진행률 분모는 기본 22로 고정하고 pt_hold는 "추가 확인"으로 표시.

## 확인된 근본 원인 / 핵심 사실
- 정적 질문 정의(CAREER_QUESTION_FLOW)를 그대로 두고, 실제 노출 흐름을 별도 함수로 분리하는 게 안전하다. CAREER_QUESTION_FLOW 길이·순서를 바꾸면 여러 소비자(freeContext·PaidPreviewView·chatFlow·narrativePayload 등)가 영향받는다. → 정적 배열은 23 유지, `getActiveCareerQuestionFlow(responses)`만 pt_hold를 제거/재삽입.
- 보호 소비자(freeContext.ts·PaidPreviewView.tsx)는 `CAREER_QUESTION_FLOW.length`만 사용 → 길이 유지로 diff 0. narrativePayload는 QUESTION_CONTEXT에 pt_hold가 없어 reword 무영향. cs_blocker reword는 assistantPrompt만 바꿔 narrativePayload의 옵션 라벨 사용에 영향 없음.
- `.stage`처럼 표시 전용 필드는 엔진이 읽지 않으므로, 조건부 흐름용 표시 필드(conditionalFollowUp/countsTowardProgress/parentQuestionId)를 추가해도 scoring/engine 무변경.
- 활성 흐름 길이가 런타임에 바뀌면(22↔23) stepIndex가 유효 범위를 벗어날 수 있다 → clamp + 재개는 항상 "활성 흐름의 첫 미응답 문항"으로 ID 기반 계산.

## 고려하거나 시도한 접근법
- **정적 배열에서 pt_hold를 cs_blocker 뒤로 이동** — 채택 안 함. 정적 순서/길이 변경이 보호·기타 소비자에 파급. 대신 정적은 그대로 두고 활성 흐름 함수만 재배치.
- **pt_hold 응답을 보존 + 결과 계산에서만 제외** — 부분 채택. 결과 계산 제외는 안전망으로 유지하되, "재응답 요구" 요건 때문에 진행 중 세션에서는 숨겨질 때 응답을 실제 제거하는 편을 우선.

## 최종 해결 방법과 선택 이유
1. `careerQuestionFlow.ts`: `shouldAskPtHold(responses)`(단일 순수 함수, 노출 조건) + `getActiveCareerQuestionFlow(responses)`(pt_hold 제거 후 조건 충족 시 cs_blocker 뒤 삽입). cs_blocker/pt_hold 문구·pt_hold 메타 필드 추가. 옵션 ID·evidence 매핑·effect 불변.
2. `types/careerCompass.ts`: QuestionStep에 표시·흐름 전용 필드 3종 추가(엔진 미참조).
3. `ChatLikeFlow`/`ProgressHeader`: comparisonLabel("추가 확인") + conditionalLabel(숫자 대신 라벨, 바 위치 유지).
4. `HybridFlowView`·`CareerCompassV2Page`: 활성 흐름 기준 인덱싱(clamp) + 진행률(countsTowardProgress 제외, 분모 22) + stale pt_hold 제거 효과 + 로드 시 stale 제거·활성 흐름 첫 미응답 재개.
5. `session.ts buildResultFromResponses`: `shouldAskPtHold`가 false면 pattern 계산용 effectiveResponses에서 pt_hold 제외(§6·§8 게이팅). 엔진(biasPatternEngine)은 무변경 — 게이팅은 session 계층.

## 변경된 주요 파일
- `src/data/careerQuestionFlow.ts` — shouldAskPtHold/getActiveCareerQuestionFlow + cs_blocker·pt_hold 문구/메타.
- `src/types/careerCompass.ts` — QuestionStep 표시·흐름 필드 3종.
- `src/components/careerCompassV2/ChatLikeFlow.tsx`, `ProgressHeader.tsx` — 소라벨·조건부 라벨.
- `src/components/hybridV3/HybridFlowView.tsx`, `careerCompassV2/CareerCompassV2Page.tsx` — 활성 흐름·진행률·stale 처리.
- `src/components/careerCompassV2/session.ts` — pattern 계산 게이팅.
- 테스트: careerQuestionFlow.test.ts, hybridFlow.test.ts(REQUIRED P/Q), careerPatternRegression.test.ts.

## 검증 방법과 결과
- `npm run build` 통과, node 27개 스위트 전부 통과, `git diff --check` clean.
- 보호 파일(paid/·api/·db/·vercel.json·PatternTeaserView·patternTeaserCopy·biasPatternEngine.ts) diff 0.
- 브라우저 3흐름(A 미노출/B 노출·"추가 확인"/C 조건 변경·stale 제거) + 모바일 + 콘솔 0. 완료 세션에 stale pt_hold_sunk가 있어도 손실 신호 없으면 결과가 sunkCost 아님(게이팅 검증).

## 재발 방지 원칙
- 조건부/동적 노출이 필요하면 정적 정의를 바꾸지 말고 "활성 흐름 계산 함수"를 하나 만들어 모든 UI가 그것을 쓰게 한다(컴포넌트별 filter 금지).
- 정적 배열의 길이/순서 변경은 파급이 크다 — 먼저 소비자를 grep해 length/order 의존을 확인한다.
- 런타임에 흐름 길이가 바뀌면 인덱스를 clamp하고 재개는 ID 기반(첫 미응답)으로.
- 조건부 응답은 "숨겨질 때 제거" + "결과 계산에서 제외" 이중 방어로 stale 유입을 막는다. 노출 조건은 단일 순수 함수로 중앙화해 UI와 결과 계산이 같은 기준을 쓰게 한다.

## 후속(2026-07-21) — 전제가 깨지는 문항: "조건부 스킵"이 아니라 "문구 분기"

pt_delay 문구가 직전 ap_experiment에서 고른 '결과물'을 앵커로 삼는데(`방금 고른 결과물을…`), `ap_unsure`('아직 모르겠음')를 고르면 가리킬 결과물이 없어 전제가 깨졌다. 첫 반사는 "pt_hold처럼 조건부로 빼자"였지만, **의존성을 먼저 확인하니 스킵이 명백히 손해**였다:

- `pt_delay`는 `biasPatternEngine`에서 16개 중 **4개 패턴의 discriminator**(모호성 회피는 primaryRequires, 생산적 지연·실험 회피는 veto까지) — `q2:*` evidence의 유일한 공급원이다.
- 스킵하면 그 4개가 구체 패턴으로 판정 불가 → `category_only`/`insufficient_signal`로 떨어진다. 하필 "아직 모르겠음"을 고른 **가장 불확실한 사용자가 가장 뭉툭한 결과**를 받는 역효과.

채택: 질문·선택지·효과·문항 수·evidence를 전부 그대로 두고 **`assistantPrompt`만 분기**. 이미 responses를 읽고 있던 `getActiveCareerQuestionFlow`에 얹되, 정적 정의를 mutate하지 않도록 해당 스텝만 `{...s, assistantPrompt}`로 복사한다(원본 불변을 테스트로 고정).

일반화한 규칙:
- **조건부 노출(스킵)을 검토하기 전에 그 문항이 결과 엔진에 무엇을 공급하는지 먼저 grep한다.** 판별자(discriminator/veto/primaryRequires) 역할이면 스킵 비용이 크다 — 문구 분기로 해결되는지 먼저 본다.
- 활성 흐름 계산 함수는 "문항 삽입/제거"뿐 아니라 **"표시 문구 교체"의 자연스러운 자리**이기도 하다. 단, 정적 정의를 절대 mutate하지 말 것(복사 후 교체 + 원본 불변 테스트).
- 직전 답을 앵커로 삼는 문구를 쓸 때는 **"해당 없음/모르겠음" 선택지에서의 문장을 반드시 함께 설계**한다. 이번 결함도 앵커 도입 시 그 케이스만 누락된 것이었다.

## 남은 위험 / 후속 작업
- pt_delay 순수 "미해당" 중립 옵션 부재는 별도 결정 사항으로 이전 문서에 기록됨(이번 범위 밖).
- 설계 상세: `docs/research/conditional-pt-hold-followup.md`.
