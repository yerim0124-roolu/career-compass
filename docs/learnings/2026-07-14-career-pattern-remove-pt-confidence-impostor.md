# Career Pattern 신규 문항 4→3 축소(pt_confidence 제거)와 impostor 산출 중단

날짜: 2026-07-14

## 해결한 문제
무료 흐름에 추가된 Career Pattern 판별 문항 4개 중 pt_confidence가 기존 문항(sc_outlook + cs_blocker/blk_confidence)과 중복도가 높고, 오직 impostor 패턴 하나만 활성화하는 저효율 문항이었다. 문항을 24→23개로 줄이면서 신규 분석이 impostor를 구체 패턴으로 산출하지 않도록 하되, 과거 저장 세션·과거 patternProfile은 계속 안전하게 읽혀야 했다.

## 사용자에게 나타난 증상
증상성 버그가 아니라 설계 개선. pt_confidence는 impostor 전용 문항인데 lowSelfEfficacy는 이미 별도 판별 신호(`cx:selfEfficacyLow`)를 갖고 있어, 이 문항 하나를 위해 사용자에게 추가 질문을 노출하는 비용이 컸다(감사 문서 `docs/research/career-pattern-question-overlap-audit.md` 참조).

## 확인된 근본 원인
- impostor 규칙의 유일한 판별 신호(discriminator)는 `q3:impostor`이고, 이 코드는 pt_confidence 응답에서만 생성된다. 따라서 문항을 없애면 신규 흐름에서 impostor는 자연히 산출 불가.
- lowSelfEfficacy는 `q3:lowEfficacy` 외에 `cx:selfEfficacyLow`(construct 정규화 산출)라는 실사용 판별 경로가 있어 문항 제거 후에도 구체 분류를 유지한다.
- in-progress 세션 하위 호환은 이미 `parsePersistedSession`의 stepIndex clamp(`Math.min(Math.max(idx,0), flowLength-1)`)로 커버됨 — 새 clamp 코드 불필요.

## 고려하거나 시도한 접근법
- **PatternId 타입에서 impostor 삭제** — 채택 안 함. 과거 세션이 `primaryPattern:'impostor'`를 갖고 있을 수 있어 타입/라벨/카피를 지우면 파싱·렌더가 깨진다.
- **impostor→lowSelfEfficacy 강제 변환** — 채택 안 함. 서로 다른 심리 구성이라 오분류를 낳는다. lowSelfEfficacy는 자체 기준(`cx:selfEfficacyLow`) 충족 시에만 산출되게 두고, 미충족 시 상위 범주(identityConfusion)로 폴백시킨다.

## 최종 해결 방법과 선택 이유
1. `careerQuestionFlow.ts`: `patternConfidence` const과 배열 엔트리 제거(24→23). 나머지 3개 신규 문항은 effect-free 그대로 유지.
2. `biasPatternEngine.ts`: (a) `extractEvidence`의 `map('pt_confidence', …)` 라인 제거 — 저장된 pt_confidence는 매핑되지 않아 안전 무시(q3:* 코드 미생성). (b) impostor 규칙에 `neverPrimary: true` 추가.
   - `classifyFromEvidence`의 `eligible` 필터가 이미 `neverPrimary`를 primary·secondary 후보 모두에서 제외하므로 한 플래그로 두 경로가 동시에 차단된다.
   - 규칙 본문(pos/neg/discriminator)·`PATTERN_LABELS.impostor`·`PATTERN_COPY.impostor`는 과거 세션 렌더 호환을 위해 삭제하지 않음. fallback의 `rawPositive` 범주 합산에는 impostor가 여전히 기여하므로 옛 impostor 신호는 category_only(identityConfusion)로 귀결된다.

## 변경된 주요 파일
- `src/data/careerQuestionFlow.ts` — pt_confidence 문항 제거(24→23).
- `src/lib/biasPatternEngine.ts` — pt_confidence 추출 매핑 제거 + impostor `neverPrimary: true`.
- 테스트: `careerQuestionFlow.test.ts`(23·미노출·유지), `chatFlow.test.ts`(23 main·33 answer), `biasPatternEngine.test.ts`(sim#14 → category_only/identityConfusion, impostor never primary/secondary, 저장 pt_confidence 무시, impostor 라벨·카피 렌더 호환), `careerPatternRegression.test.ts`(변형에서 pt_confidence 제거·legacy 무영향), `session.test.ts`(과거 24문항 stepIndex=23 → 22 clamp).

## 검증 방법과 결과
- `npm run build`(tsc -b + vite) 통과.
- node 실행형 27개 스위트 전부 통과.
- 보호 대상 유료 파이프라인 파일(`src/components/paid/*`, `api/paid-*`, `db/`, `vercel.json`) `git diff` 0줄. `git diff --check` clean.
- 브라우저: (A) 과거 impostor 신호가 남은 완료 세션 → 재계산 결과가 impostor가 아닌 sunkCost로 렌더, 콘솔 에러 0. (B) CTA → `#paid-preview` 이동 확인. (C) 과거 24문항 in-progress(stepIndex 23) 세션 → 마지막 유효 문항(pt_direction, 23/23)으로 안전 clamp, 크래시/콘솔 에러 없음.

## 재발 방지 원칙
- 특정 패턴을 "산출만 중단"하고 "타입·라벨·카피는 유지"해야 할 때는 규칙 삭제가 아니라 `neverPrimary` 플래그로 후보에서 제외한다. 하위 호환(과거 세션 파싱·렌더)을 깨지 않는 최소 변경이다.
- 판별 문항을 제거할 때는 그 문항이 만드는 evidence 코드(`q3:*`)에 의존하는 다른 규칙이 있는지 먼저 확인한다. 여기선 lowSelfEfficacy가 `q3:lowEfficacy`를 참조하지만 `cx:selfEfficacyLow`라는 실사용 경로가 별도로 있어 dead-but-harmless로 남길 수 있었다.
- 흐름 길이 변경(문항 add/remove) 시 하드코딩된 count 어서션(flow length, main steps, countAnswerSteps)을 함께 갱신한다. stepIndex 하위 호환은 `parsePersistedSession`의 기존 clamp가 처리한다.

## 남은 위험 / 후속 작업
- 16패턴 카피 최종 리뷰(반전 헤드라인·상태/메커니즘 문단·미해결 질문)는 별도 후속 작업으로 예정. impostor 카피는 신규 흐름에서 선택되지 않으나 과거 세션 렌더용으로 남겨둠.
- 아직 commit/push/deploy하지 않음(요청대로 로컬 변경만).
