# 무료 질문 시작 안내 화면 — 타이핑 제목 + fade-in (표시 전용 UI)

- 날짜: 2026-07-15
- 범위: `#hybrid` 신규 사용자에게만 보이는 시작 안내 화면(CareerIntroView) 추가. 질문·점수·엔진·세션 schema·유료 파이프라인 무변경(표시 전용 게이트 + 기존 흐름 연결만).

## 1. 삽입 위치

- `HybridFlowView.tsx`의 phase 렌더 최상단에 `phase === 'profile' && showIntro` 분기 추가. 기존 4개 phase(profile/profileReview/mainFlow/result)와 세션 schema(`PersistedSession`)는 그대로 — `showIntro`는 저장되지 않는 컴포넌트 state다.
- `showIntro` 초기값은 `loadHybridSession()`에서 `shouldShowCareerIntro(parsePersistedSession(...))`로 계산(`careerIntroGate.ts`, 순수 함수).
- CTA("무료로 시작하기") 클릭 = `setShowIntro(false)` 하나. 기존 profile phase 렌더(프로필 질문 1/10)가 그대로 드러난다 — 시작 흐름을 복제하지 않음.

## 2. 신규 사용자 표시 조건

핵심 설계 판단: **localStorage 키 존재 여부로는 신규 사용자를 판별할 수 없다** — HybridFlowView의 persist effect가 마운트 직후 빈 세션도 즉시 기록하기 때문. 대신 파싱된 세션의 '내용 비어 있음'으로 판별한다.

표시(전부 충족 시):
- `done === false` (완료 세션 아님)
- `profileDone === false` (프로필/메인 진행 세션 아님)
- `responses` 0건 + `profile` 필드 0건

미표시(각각 테스트로 고정):
- 진행 중 무료 세션 복구(응답 존재 또는 profileDone) / 완료 결과 복구(done) / 답변 수정 경로(완료 세션 기반) — 게이트 false.
- 유료 질문·유료 결과 복구(#paid-preview/#paid-questions/#paid-result, ?paidJobId=) — 별도 라우트라 HybridFlowView 자체를 렌더하지 않음(`resolveRoute` 테스트로 확인).
- 부수 규칙: 헤더 "다시"(restartAll)는 같은 마운트 안에서는 안내를 다시 띄우지 않는다(질문 재시작 의도 존중). 빈 세션 상태로 새로고침하면 다시 표시(아직 시작 안 한 사용자와 동일 상태).

## 3. 최종 문구 (`careerIntroGate.ts` 상수, 스펙 §2 그대로)

- 제목: "요즘, 이 길이 맞는지 자꾸 고민된다면"
- 본문 1~3, 마지막 안내("좋아 보이는 답보다, 지금의 나와 가장 가까운 답을 골라주세요."), CTA "무료로 시작하기".
- 강조(bold) 5곳: **87.5%**, **커리어 의사결정에 관한 논문과 전문 서적을 바탕으로 질문을 설계**, **무료**, **유료 심층 분석**(이상 잉크색), **지금의 나와 가장 가까운 답**(퍼플). 구절 목록은 `INTRO_*_EMPHASIS` 상수로 두고 렌더러(`withEmphasis`)가 문단을 쪼개 `<strong>`으로 감싼다 — 문구 자체는 변형하지 않으며, 각 구절이 문단에 정확히 1회 등장함을 테스트로 고정.
- 금지 확인(테스트로 고정): 조건부 추가 질문 안내·가격(₩/3,900/원)·예상 소요 시간(약 N분)·'진단' 표현 없음.

## 4. 애니메이션 시간 (`careerIntroGate.ts` 상수)

- 진입 200ms 후 타이핑 시작 → 글자당 40ms(제목 21자 = 840ms) → 완성 200ms 후 본문·CTA fade-in(300ms) → 총 ~1.54초(< 2초, `totalIntroAnimationMs()` 테스트로 고정).
- 커서: 제목 옆 2px 바(`animate-pulse`), 완성 후 1100ms에 제거.
- 타이핑은 제목 한 문장에만. 본문 타이핑·줄별 지연 연출 없음. 외부 라이브러리 없음(React state + 기존 Tailwind/CSS).
- Unicode-safe: `Array.from(INTRO_TITLE)` 산출 배열(`INTRO_TITLE_CHARS`)의 prefix join — `string[index]` 접근 없음(정적 테스트로 금지).

## 5. 건너뛰기 동작

- 타이핑 중 안내 영역 클릭 / Enter / Space(전역 keydown, preventDefault) → 제목 전체 + 본문 전체 + CTA 활성화 + 커서 제거. 타이머는 effect cleanup으로 정리.
- 즉시 완료 이벤트는 질문을 시작하지 않는다 — `onStart()` 호출 지점은 CTA의 `handleStart` 1곳뿐(정적 테스트: `onStart()` 출현 1회). 완료 후에는 클릭/키 리스너가 제거되어 no-op.
- CTA 중복 클릭 가드: `startedRef`로 `onStart` 1회만 호출(+ `setShowIntro(false)` 자체가 멱등).

## 6. reduced motion (§5)

- `window.matchMedia('(prefers-reduced-motion: reduce)')`를 마운트 시 1회 판정. true면 타이핑·커서·fade 없이 제목/본문/CTA 전부 즉시 표시(state 초기값으로 처리, 타이머 자체를 만들지 않음).
- 스크린리더: `<h1>` 안에 `sr-only`로 전체 제목을 항상 제공, 타이핑 문자열은 `aria-hidden="true"`, 글자별 `aria-live` 없음. CTA는 일반 `<button type="button">`(disabled 동안 비활성, 완료 후 keyboard focus 가능 — 브라우저에서 확인).

## 7. 세션 복구 방식

- 안내 화면은 세션에 아무것도 쓰지 않는다(컴포넌트에 localStorage/fetch/buildResult 없음 — 정적 테스트). 기존 persist effect·`parsePersistedSession`·첫 미응답 문항 재개 로직(`firstUnanswered`) 전부 무변경.
- 질문 진행 중 새로고침 → 세션에 응답이 있어 게이트 false → 안내 없이 해당 문항 재개(브라우저: 연령대 답변 후 새로고침 → 2/10 직행 확인).
- 완료 세션 새로고침 → 결과 화면 직행(브라우저 확인), "답변 수정하러 돌아가기" → 21/22 문항 직행(안내 미경유).

## 8. 모바일·데스크톱 검증 (로컬 dev, 실제 렌더)

- 모바일 375px: 제목 2줄(min-height 예약으로 타이핑 중 레이아웃 shift 없음), 가로 overflow 없음, CTA 높이 58px(충분히 큼), fade-in 정상, 콘솔 오류 0.
- 중간·데스크톱 1280px: 카드 max-w-2xl(640px)로 제한, 제목 1줄, 본문 폭 자연스러움, 콘솔 오류 0.
- 타이핑 순차 표시: 실제 진입 직후 스크린샷에서 정상 속도 완료 확인. 자동화 환경에서 브라우저 백그라운드 탭 타이머 스로틀링(1s)으로 느린 사례가 관찰됐으나 이는 자동화 환경 특성이며, 이 상태를 활용해 '타이핑 중 클릭/Enter/Space 즉시 완료'가 실제로 동작함을 확인(중간 상태 opacity 0 → 클릭 후 즉시 전체 표시·질문 자동 시작 없음).
- CTA 클릭(더블클릭 포함) → 기존 첫 프로필 질문 "나에 대한 정보 · 1 / 10 · 연령대" 1회만 진입.
- reduced motion: matchMedia 오버라이드 후 재마운트 — 120ms 시점(타이핑 시작 지연보다 이른 시점)에 이미 전체 제목·본문·CTA 표시, 커서 없음.

## 9. 변경 파일

- 신규: `src/components/hybridV3/careerIntroGate.ts`(게이트+문구+타이밍, 순수), `CareerIntroView.tsx`(표시 컴포넌트), `careerIntro.test.ts`(49 체크).
- 수정: `src/components/hybridV3/HybridFlowView.tsx` — import 2줄, `loadHybridSession`에 `showIntro` 계산·반환, state 1개, 렌더 분기 1개. 그 외 무변경.

## 10. 보호 파일 무변경 증거

`git diff --stat` 0: `biasPatternEngine.ts`, `session.ts`(buildResultFromResponses·parsePersistedSession), `resultContextEngine.ts`, `resultSpineEngine.ts`, `careerQuestionFlow.ts`(질문·조건부 pt_hold), `chatFlow.ts`, `QuestionStepRenderer.tsx`(복수 선택 개선), `WholeResponseSummary.tsx`·`wholeResponseSummaryCopy.ts`·`currentPositionCopy.ts`(전체 답변 종합), `PatternTeaserView.tsx`·`patternTeaserCopy.ts`(패턴 결과), `src/components/paid/`, `api/`, `db/`, `vercel.json`. 전체 33 스위트 2075 PASS(기존 세션 복구·질문 계약 테스트 포함), `npm run build` ✓, `git diff --check` clean.
