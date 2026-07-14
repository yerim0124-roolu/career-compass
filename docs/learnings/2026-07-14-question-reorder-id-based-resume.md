# 무료 문항 재배열 + pt_direction 재작성 시 순서-무관 복구 보장

날짜: 2026-07-14

## 해결한 문제
무료 23문항을 사용자 서사(A~F) 순서로 재배열하고 pt_direction을 '방향의 유무' → '커리어-정체성 관계' 문항으로 재작성하면서, (1) 기존 무료 결과·유료 파이프라인을 완전히 불변으로 유지하고 (2) 순서가 바뀌어도 구버전 진행 세션이 엉뚱한 문항으로 튀지 않게 복구해야 했다.

## 사용자에게 나타난 증상
증상성 버그가 아닌 개선. 다만 순서를 바꾸면 localStorage에 저장된 raw stepIndex가 재배열 후 '다른 문항'을 가리켜, 진행 중이던 사용자가 답을 건너뛰거나 엉뚱한 질문에서 재개할 위험이 있었다.

## 확인된 근본 원인 / 핵심 사실
- `buildResultFromResponses`는 전부 `responses[id]` 기준(collectSelectedCards·buildPartialVector·assembleGates 모두 가법·ID기반)이라 **배열 순서에 완전히 무관**. → 재배열이 mainType/subtype/friction/readiness/resultContext를 바꾸지 않음(전체 테스트로 확인).
- `QuestionStep.stage`는 진행 헤더 라벨 표시에만 쓰이고 **엔진/스코어링이 읽지 않음**(grep로 확인: STAGE_LABELS 조회 2곳뿐). → 재배열해도 stage-count 테스트가 깨지지 않도록 stage는 건드리지 않음.
- 세션 복구(`loadHybridSession`)가 raw stepIndex를 clamp만 해서 그대로 신뢰 → 재배열에 취약.
- pt_direction의 evidence code(q4:closedEarly/inBetween/open)는 신규 옵션 의미(foreclosure/liminality/open)와 여전히 정합 → code 이름 유지, 옵션 ID만 개명.

## 고려하거나 시도한 접근법
- **stage 필드까지 서사에 맞게 재할당** — 채택 안 함. FlowStage 타입·STAGE_LABELS(2곳)·stage-count 테스트를 건드리는 불필요한 리팩터링. 라벨은 각 문항 주제로 정확하므로 순서만 변경.
- **옵션 ID를 그대로 두고 라벨만 교체** — 부분 채택 안 함. 문항 의미가 바뀌어 ID(pt_dir_na='aligned' 등)가 오해를 부름. 대신 의미에 맞게 개명 + 구 ID 하위호환 매핑.
- **currentQuestionId를 저장해 복구** — 불필요. responses가 ID로 저장되므로 '첫 번째 미응답 문항' 계산이 더 단순·강건.

## 최종 해결 방법과 선택 이유
1. `careerQuestionFlow.ts`: 배열 순서만 A~F로 재배열(ID/effects 불변). pt_direction 문항 전면 재작성(effect-free 유지).
2. `biasPatternEngine.ts`: pt_direction 매핑에 신규 옵션 ID(foreclosed/liminal/exploring→q4:*) + 구 옵션 ID(closed/between/open→동일 code) 하위호환. aligned/na→코드 없음. RULES·임계값 무변경.
3. `HybridFlowView.loadHybridSession`: mainFlow일 때 `CAREER_QUESTION_FLOW.findIndex(s => !isStepComplete(s, parsed.responses[s.id]))`로 **첫 미응답 문항**에서 재개(전부 답하면 마지막 인덱스). raw stepIndex를 신뢰하지 않음.
4. 진행 문구 `선택 {selectedCount}개 반영 중` → `답변을 실시간으로 반영 중`(HybridFlowView·CareerCompassV2Page). 미사용된 selectedCount·collectSelectedCards import 제거(noUnusedLocals 대응).

## 변경된 주요 파일
- `src/data/careerQuestionFlow.ts` — 배열 재배열 + pt_direction 재작성.
- `src/lib/biasPatternEngine.ts` — pt_direction evidence 매핑(신규+legacy).
- `src/components/hybridV3/HybridFlowView.tsx` — ID기반 재개 + 진행 문구 + import 정리.
- `src/components/careerCompassV2/CareerCompassV2Page.tsx` — 진행 문구 + import 정리.
- 테스트: careerQuestionFlow.test.ts(순서·ID고유·effect-free·pt_direction), biasPatternEngine.test.ts(옵션→code·foreclosure/liminality·옵션1·4 부정 강제 안 함·legacy), hybridFlow.test.ts(진행 문구·첫 미응답 재개).

## 검증 방법과 결과
- `npm run build` 통과, node 27개 스위트 전부 통과, `git diff --check` clean.
- 유료 보호 파일(`src/components/paid/`, `api/`, `db/`, `vercel.json`) diff 0.
- 브라우저: pt_direction 마지막(23/23)·신규 문항 렌더, sc_outlook→pt_direction(F) 순서, 이전/다음/답변수정 정상, 진행 문구 '답변을 실시간으로 반영 중', foreclosed→identityForeclosure 산출. **구버전 raw stepIndex=10 세션 → 첫 미응답(rc_energy, 2/23)에서 재개**, 콘솔 오류 0.

## 재발 방지 원칙
- 순서에 의존하는 상태(stepIndex)를 저장할 때, 순서가 바뀔 수 있는 데이터라면 **인덱스가 아니라 ID로 복구 지점을 재계산**한다(첫 미응답 문항).
- 표시 전용 필드(stage)는 엔진 의존성을 grep로 먼저 확인하고, 없으면 건드리지 않아 테스트/타입 churn을 피한다.
- 문항 의미가 바뀌어도 하위 신호 매핑이 정합하면 evidence code 이름은 유지하고, 옵션 ID만 개명 + 구 ID 하위호환 매핑으로 저장 세션을 보호한다.
- 컴포넌트에서 값을 제거하면 그 값만 쓰던 useMemo/import가 죽어 noUnusedLocals 빌드가 깨지므로 함께 정리한다.

## 남은 위험 / 후속 작업
- stage 라벨이 서사 그룹과 1:1이 아니라 문항별 주제를 그대로 보여줌(각 라벨은 정확하나 단조 증가하지 않음). 필요 시 별도 작업에서 서사-정합 라벨 재설계.
- 추가 중복 후보(or_content/venture/internal 3연속, cs_blocker↔pt_delay 어휘 근접)는 삭제하지 않고 order-review 문서에 기록만. 축소·문구 차별화는 후속.
- 아직 commit/push/deploy 안 함(요청대로 로컬 변경만).
- 상세: `docs/research/career-question-flow-order-review.md`.
