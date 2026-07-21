# 시작 안내 화면 게이트 설계 + 마운트 애니메이션 브라우저 검증 기법

날짜: 2026-07-15

## 해결한 문제

`#hybrid` 신규 사용자에게만 보이는 시작 안내 화면(타이핑 제목)을 추가하면서, (a) "신규 사용자"를 세션 schema 변경 없이 판별하는 기준과 (b) 마운트 시 1회만 도는 애니메이션을 자동화 브라우저에서 검증하는 방법이 필요했다.

## 사용자에게 나타난 증상

(신규 기능이라 버그 아님) 설계 단계에서: localStorage 키 존재로 신규 여부를 판별하면 안내가 평생 1회만 뜨고, 아무것도 답하지 않은 사용자도 재방문 시 안내를 못 보게 되는 문제. 검증 단계에서: 브라우저 자동화로 타이핑 진행을 관찰하려 하자 `setInterval`이 1초 간격으로만 틱해 애니메이션이 사실상 멈춘 것처럼 보였다.

## 확인된 근본 원인

- **키 존재 판별 불가**: `HybridFlowView`의 persist effect는 마운트 직후(안내 화면이 떠 있는 동안에도) 빈 세션을 localStorage에 즉시 기록한다. 따라서 '키 있음'은 '시작함'을 의미하지 않는다.
- **자동화 타이머 스로틀링**: 데스크톱 앱의 Browser pane이 잡고 있는 페이지는 백그라운드 탭 취급되어 Chrome이 `setTimeout`/`setInterval`을 최소 1초로 스로틀한다. `javascript_tool`의 긴 await 중 특히 두드러진다. 실사용자(포그라운드 탭)에게는 발생하지 않는 자동화 환경 특성.

## 고려하거나 시도한 접근법

- 게이트: localStorage 키 존재 여부 — 위 이유로 폐기.
- 게이트: 별도 'introSeen' 플래그를 세션에 저장 — schema 변경 금지 제약 위반이라 폐기.
- 검증: `location.reload()` 후 즉시 스크린샷/샘플링으로 타이핑 중간 상태 포착 — 툴 왕복(~1s+)이 애니메이션(1.5s)과 경합해 재현 불안정, 폐기.

## 최종 해결 방법과 선택 이유

- **게이트 = 파싱된 세션의 '내용 비어 있음'**: `done=false && profileDone=false && responses 0건 && profile 필드 0건`일 때만 표시(`careerIntroGate.ts`의 순수 함수). schema 무변경, 아무것도 답하지 않은 재방문자에게 자연스럽게 재표시, 진행/완료/답변수정 복구 경로는 전부 자동 차단. 유료 화면은 라우트 자체가 달라 게이트를 지나지 않음을 `resolveRoute`로 테스트.
- **검증 = hash 토글 리마운트**: `location.hash = '#v1'` → `'#hybrid'`로 App 라우트를 오가면 페이지 리로드 없이 컴포넌트가 리마운트되어, 같은 JS 실행 컨텍스트 안에서 마운트 애니메이션을 처음부터 관찰·조작할 수 있다(리로드하면 스크립트 컨텍스트가 죽어 중간 상태를 못 잡는다). 스로틀링은 오히려 '타이핑 중' 상태를 길게 유지시켜 건너뛰기(클릭/Enter/Space) 검증에 활용했다.
- reduced motion 검증도 같은 기법: `window.matchMedia`를 monkey-patch한 뒤 hash 리마운트하면 실제 OS 설정 없이 분기를 실행할 수 있다.

## 변경된 주요 파일

- `src/components/hybridV3/careerIntroGate.ts` — 신규: 게이트 순수 함수 + 최종 문구 + 타이밍 상수.
- `src/components/hybridV3/CareerIntroView.tsx` — 신규: 표시 전용 컴포넌트(타이핑/건너뛰기/reduced motion).
- `src/components/hybridV3/HybridFlowView.tsx` — `loadHybridSession`에 showIntro 계산, 렌더 분기 1개(세션 schema·기존 phase 무변경).
- `src/components/hybridV3/careerIntro.test.ts` — 신규: 42 체크(게이트/문구/타이밍/접근성/흐름 정적 계약).

## 검증 방법과 결과

- 전체 33 스위트 2068 PASS, build ✓, 보호 파일 diff 0.
- 브라우저: 신규 진입 표시 / 진행·완료·답변수정 복구 미표시 / 클릭·Enter·Space 즉시 완료(질문 자동 시작 없음) / CTA 더블클릭에도 1회 시작 / reduced motion 즉시 전체 표시 / 375px·1280px overflow 없음·콘솔 오류 0.

## 재발 방지 원칙

- 이 저장소에서 "신규/최초 1회" UI 게이트는 localStorage 키 존재가 아니라 **파싱된 세션의 내용**으로 판별한다(persist effect가 마운트 즉시 빈 세션을 쓰기 때문).
- 마운트 시 1회 도는 연출을 자동화로 검증할 때는 리로드 대신 **hash 토글 리마운트**로 JS 컨텍스트를 유지한 채 관찰한다. Browser pane에서는 타이머가 1초로 스로틀될 수 있음을 전제하고, 시간 의존 단언 대신 상태 전이(중간 상태 → 건너뛰기 → 완료)를 단언한다.
- 애니메이션 문구·타이밍·게이트는 React 컴포넌트가 아닌 순수 `.ts` 모듈에 두면 node 헤드리스 테스트로 계약을 고정할 수 있다(JSX는 readFileSync 정적 검사로 보완).

## 남은 위험 / 후속 작업

- 백그라운드 탭에서 열린 실사용자 세션은 타이핑이 스로틀될 수 있으나, 포커스 시 정상 재개되고 클릭/키로 즉시 완료 가능해 수용. visibilitychange 기반 즉시 완료는 필요해지면 후속.
