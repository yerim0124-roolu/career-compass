# Career Pattern v1 — 1차 구현 보고서

- 날짜: 2026-07-13
- 범위: 판별 문항 4개(effect-free) + 순수 패턴 분류 엔진 + 무료 화면 티저. 기존 의사결정 엔진·유료 파이프라인 무변경.
- 근거: [career-pattern-v1-spec.md](career-pattern-v1-spec.md), [free-career-pattern-coverage-audit.md](free-career-pattern-coverage-audit.md)
- 상태: 미커밋(요청대로 commit/push/deploy 안 함).

## 1. 변경 파일

### 신규
| 파일 | 역할 |
|---|---|
| `src/lib/biasPatternEngine.ts` | 순수 분류 엔진 — 증거 추출(`extractEvidence`) + 결정론적 분류(`classifyFromEvidence`) + 통합(`buildCareerPatternProfile`) + 표시용 라벨/카피. 기존 값 읽기만, 수정·역주입 없음 |
| `src/lib/biasPatternEngine.test.ts` | spec §8의 22개 시뮬레이션 + 엣지(미응답·손상·동점·부족·마진). 152 checks |
| `src/lib/careerPatternRegression.test.ts` | 기존 무료 결과 불변성 증명(신규 문항 응답 변경에도 기존 필드 완전 동일). 13 checks |
| `src/components/careerCompassV2/PatternTeaserView.tsx` | 무료 화면 티저(표시 전용). 카피 원칙(신뢰도별 어투) 적용 |

### 수정 (additive만)
| 파일 | 변경 요지 |
|---|---|
| `src/types/careerCompass.ts` | `PatternId`/`PatternCategory`/`CareerPatternProfile` 타입 추가 + `ResultSpine.patternProfile?` 옵셔널 필드(순수 additive). 기존 필드 무변경. (이름 충돌 회피: 기존 `UserProfile.careerPattern`과 별개라 스파인 필드명은 `patternProfile`) |
| `src/data/careerQuestionFlow.ts` | Q1~Q4(`pt_hold`/`pt_delay`/`pt_confidence`/`pt_direction`)를 **effect-free**로 배열 말미 추가. 기존 20문항 ID·scoreEffects 무변경 |
| `src/components/careerCompassV2/session.ts` | `buildCareerPatternProfile` 호출 → `spine.patternProfile` 패스스루(storyInsight와 동일 계약). 기존 산출 로직 무변경 |
| `src/components/hybridV3/HybridFlowView.tsx` | 유료 플래그 on일 때 무료 화면을 `PatternTeaserView`로 렌더(기존 상세 리포트는 화면에서만 숨김, spine 데이터 유지). 플래그 off는 기존 `ResultSpineView` 그대로 |
| `src/data/careerQuestionFlow.test.ts` | flow 길이 검증 20→24 갱신(신규 4문항 반영) |
| `src/lib/chatFlow.test.ts` | chat 스크립트 step 수 검증 20→24, 30→34 갱신(CAREER_QUESTION_FLOW 재사용 반영) |

## 2. 기존 무료 결과 불변성 증거

- **effect-free 원리**: Q1~Q4는 `scoreEffects`/`constructEffects`가 비어 있고 `gateAssignment`이 없다. `collectSelectedCards`가 이들을 카드로 수집해도 `applyMultipleChoiceEffects`/`assembleConstructProfile`/`assembleGatesFromSelections`에 0 기여 → vector·construct·gates·mainType·subtype·friction·readiness 불변([session.ts:37-48,77-85,305](../../src/components/careerCompassV2/session.ts) 경로).
- **회귀 테스트**(`careerPatternRegression.test.ts`, 13 checks 통과):
  - 신규 Q1~Q4를 4가지 서로 다른 조합으로 바꿔도 `mainType/primarySubtype/secondarySubtype/subtypeConfidence/pullDirection/primaryFriction/secondaryFriction/readinessLevel/profile/narrative/signals/showPullDirection` 지문이 **완전 동일**.
  - 통제 케이스: 기존 응답 고정 + `pt_hold`만 sunk↔loss로 바꾸면 patternProfile primary는 달라지지만(sunkCost↔lossAversion) 기존 지문은 동일 → 독립 계층 증명.
  - 번아웃형 프로필로도 재확인(mainType=overloadedBurnout 유지).
- **기존 전 스위트 통과**: session.test.ts(246), hybridFlow.test.ts(66), careerQuestionFlow.test.ts(95), chatFlow.test.ts(107), resultContextEngine/subtypeFunctions/solutionModuleEngine 등 27개 스위트 전부 0 failed. session.test.ts의 P2.0 라우팅 핑거프린트 불변 검증도 그대로 통과.

## 3. 신규 엔진 테스트 결과

- `biasPatternEngine.test.ts` — **152 checks passed**. spec §8의 22개 시뮬레이션 전부 기대 primary/secondary/confidence/resolution 일치 + 불변식(비-pattern은 primary 라벨 미노출, primary≠secondary, version 유지, evidenceCodes 보존).
- 엣지: 기존 문항만으로도 분류 가능, 빈 증거→insufficient_signal, 손상 세션(알 수 없는 id·null·비배열)→예외 없이 안전 폴백, 동점(margin 0)→secondary 노출 + primary≠secondary, 약신호→category_only(라벨 미노출).
- 불변식: `movingGoalposts`·`anticipatedRegret`는 전용 신호를 넣어도 절대 primary 아님(neverPrimary).
- **spec 대비 정합 refinement 2건**(구현이 규칙을 정확히 적용한 결과):
  1. sim#7: noSelectionCriteria가 `q2:analysisParalysis` neg(−1)로 5→4점 → **medium**(문서 표의 'high'는 자체 neg 규칙 미반영이었음).
  2. confidence 규칙: "구체 패턴명(medium+)은 판별 신호(discriminator) 보유 시에만" — spec §6의 '(D OR margin)' 중 margin-단독 medium 경로를 제거해 §10("low면 상위 범주만")과 "약신호로 특정 라벨 강제 금지" 원칙에 정합. 결과적으로 22개 시뮬레이션 표의 신뢰도 주석과 100% 일치(#22 포함 low→category_only).

## 4. Fallback 동작

- `resolution: 'pattern'` — 신뢰도 medium/high(판별 신호 보유 + 점수·마진 충족). primaryPattern 노출.
- `resolution: 'category_only'` — primary가 low(판별 신호 없음)이거나, 어떤 패턴도 LOW_MIN 미만이나 특정 범주 raw합 ≥2. **primaryPattern 미노출**, category만. UI는 상위 범주만 표시.
- `resolution: 'insufficient_signal'` — 유의 신호 전무. UI는 "하나의 패턴으로 좁히기 어렵다".
- movingGoalposts(종단 필요)·anticipatedRegret(전용 신호 없음)은 단일 세션에서 절대 primary가 되지 않고 위 폴백으로 흐른다.
- **브라우저 확인**: high→"…입니다."(들인 것이 아까운 마음/sunkCost), medium→"…에 가까워 보여요."(고를 기준이 아직 없는 상태/noSelectionCriteria) 렌더 확인. 콘솔 에러 없음.

## 5. 유료 파이프라인 무변경 증거

- 보호 파일 `git diff` **각 0줄**: `src/components/paid/{freeContext,PaidQuestionsView,PaidResultView,paidJobSession}.ts(x)`, `api/{paid-job,paid-analysis,paid-analysis-runner}.ts`.
- `db/` 0줄, `vercel.json` 0줄.
- 프론트의 `POST /api/paid-analysis` 직접 호출 **0건**(grep 확인).
- `FreeContext`/`readFreeContext` 미변경 → 유료 AI 입력 불변. patternProfile은 스파인에만 있고 FreeContext로 전달하지 않음(무료 화면 전용).
- `npm run build`(tsc -b + vite) 통과, `git diff --check` 통과, 유료 관련 node 테스트(paidAnalysisContract 68·paidJobSession 74·qstashDedupId 5) 통과.

## 6. 남은 위험

- **무료 화면 대폭 변경**: 유료 플래그 on일 때 무료 상세 리포트(ResultSpineView) 대신 패턴 티저를 렌더한다(spec/task §4 "다음만 표시"). spine 데이터는 유지되나 화면 노출이 크게 바뀌므로 제품 관점 리뷰 권장. 단일 조건부(HybridFlowView 1곳)라 되돌리기 쉬움.
- **chatFlow(#chat 실험)에도 4문항 노출**: CAREER_QUESTION_FLOW를 재사용하는 레거시 chat 실험 스크립트가 24 step으로 늘어난다(테스트 갱신 완료). chat 결과 UI는 패턴 티저를 아직 안 쓴다(원한다면 별도 작업).
- **patternProfile 미영속 분리**: 세션 저장은 responses 원본만 저장하고 patternProfile은 매 산출 시 재계산(순수 함수)이라 스키마 버전 이슈 없음. 다만 구버전 세션(신규 문항 미응답)은 category_only/insufficient로 정상 폴백함을 테스트로 확인.
- **신뢰도 캘리브레이션**: 점수·임계는 spec 설계값(실사용 응답 분포 미검증). 실데이터 확보 후 튜닝 대상. movingGoalposts는 30일 종단(followup) 확장 전까지 미분류.
- **유료 전달 여부는 별도 결정**: 현재 patternProfile을 유료 AI로 넘기지 않는다(요청대로). 넘길 경우 FreeContext 확장이 필요하며 이는 다음 단계.
