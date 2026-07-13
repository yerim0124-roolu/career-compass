# 무료 문항의 16개 커리어 고민 패턴 진단 가능성 감사

- 날짜: 2026-07-13
- 범위: **코드·문항 수준 진단 가능성 분석만**. 문항·scoring·결과 UI·localStorage·readFreeContext·유료 파이프라인은 일절 변경하지 않았다(문서만 작성).
- 목적: 현재 무료 질문·답변 옵션·점수 계산·결과 생성 로직이 아래 16개 이론 라벨을 실제로 구분할 수 있는지 증거 기반으로 판정.
- 방법론 원칙: 이론 이름만으로 결과 필드에 매핑하지 않았다. 각 판정은 실제 문항 ID·옵션·scoring 코드 경로로 뒷받침한다. 코드에서 확인되지 않은 것은 **[가설]**로 표기하고, 학술적 타당성과 코드상 측정 가능성을 구분한다.

---

## 0. 핵심 결론 (요약)

현재 시스템의 분류 온톨로지는 **커리어 의사결정-난도 모델**이다: CDDQ(진로결정 어려움) + SCCT(사회인지진로) + Career Adaptability + MCDA 이론을 합성해 **"지금 어떤 커리어 이동 상황에 있는가"**를 판정한다([careerQuestionFlow.ts:6-9](../../src/data/careerQuestionFlow.ts)). 산출물은:

- **mainType** 10종 — 상황 유형([careerCompass.ts:381-404](../../src/types/careerCompass.ts))
- **subtype** — mainType별 2~4개 하위 기제([subtypeFunctions.ts:124-246](../../src/lib/subtypeFunctions.ts))
- **primaryFriction** 8종 — 마찰원([careerCompass.ts:722-730](../../src/types/careerCompass.ts))
- **readinessLevel** 5종 — 행동 강도([careerCompass.ts:715-720](../../src/types/careerCompass.ts))
- **pullDirection** — 9개 커리어 옵션 중 하나([careerCompass.ts:77-98](../../src/types/careerCompass.ts))

**16개 유형은 인지편향·정체성 구성개념(cognitive-bias / identity constructs)으로, 위 온톨로지와 다른 축이다.** 따라서 "16개를 평면 분류"하도록 설계돼 있지 않다. 편향 신호의 대부분은 **두 개의 "추론 전용(effect-free)" 문항**에 집중돼 있다:

- **`ar_narrow`** (좁히기 어려운 이유, 6옵션) — [careerQuestionFlow.ts:74-90](../../src/data/careerQuestionFlow.ts)
- **`cs_blocker`** (결정을 막는 것, 6옵션) — [careerQuestionFlow.ts:339-355](../../src/data/careerQuestionFlow.ts)

이 둘은 `scoreEffects`/`constructEffects`가 **비어 있어** 벡터·construct 점수엔 안 들어가지만([careerQuestionFlow.ts:83-88, 348-353](../../src/data/careerQuestionFlow.ts)), `resultContextEngine`가 **별도로 읽어** friction·subtype·mainType 타이브레이커에 쓴다([resultContextEngine.ts:138-149](../../src/lib/resultContextEngine.ts), [solutionModuleEngine.ts:289-292](../../src/lib/solutionModuleEngine.ts)) + 표시 전용 `storyInsight` 리프레임([storyInsight.ts:82-94, 155-174](../../src/lib/storyInsight.ts)).

**결정적 제약**: 유료 AI로 전달되는 `FreeContext`에는 `ar_narrow`·`cs_blocker`·`storyInsight`·원시 벡터/construct 점수가 **포함되지 않는다**([freeContext.ts:51-86](../../src/components/paid/freeContext.ts)). 유료로 넘어가는 심리 신호는 `primaryFriction`(8종)·`primarySubtype`·`readinessLevel`로 **압축된 뒤**뿐이다. 즉 원시 편향 신호는 무료 화면 안에서만 완전하게 존재한다.

판정: 16개 중 **A(명확 구분)에 해당하는 유형은 0개**, **B(휴리스틱 가능·인접 혼동)가 5개**, **C(현재 데이터로 구분 불가)가 11개**다. 자세한 내용은 §2 매트릭스.

---

## 1. 현재 무료 문항 및 scoring 구조 요약

### 1.1 문항 전체 (20 스텝, [careerQuestionFlow.ts:385-403](../../src/data/careerQuestionFlow.ts))

두 측정 채널: `scoreEffects` → CareerVector(정체성/옵션 적합), `constructEffects` → SCCT/Adaptability/CDDQ/MCDA([careerQuestionFlow.ts:6-8](../../src/data/careerQuestionFlow.ts)).

| # | ID | 유형 | 문항 요지 | 측정 채널 | 결과 영향 |
|---|---|---|---|---|---|
| 1 | `cs_main` | single | 지금 상태(하고싶은게많음/계속할지/전문성확장/기준안섬/쉴지) | vector+construct | mainType 게이트(optionOverload·readinessGap·valueConflict) |
| 2 | `ar_roles` | multi 1–3 | 시간 써 알아보고 싶은 역할 | vector+construct | 정체성 축, selectedRoleCount |
| 3 | **`ar_narrow`** | single | **하나로 못 좁히는 이유(explore/loss/safety/continuity/unsure/decided)** | **비어 있음(effect-free)** | friction·subtype·mainType 타이브레이커·storyInsight |
| 4 | `cv_values` | multi ≤5 | 포기하기 싫은 가치 | vector | cvValuesMany·Broad |
| 5 | `cv_priorities` | ranking | 1년 우선순위 정렬 | vector+MCDA | MCDA 가중치·TENSION_PAIRS |
| 6–9 | `fc_1~4` | forced | 전문가vs연결자 / 안정vs구축 / 조용vs노출 / 제작vs해석 | vector+construct | 정체성 축 |
| 10 | `sc_outlook` | single | 새 방향 상상 시 자신감(SCCT self-efficacy×outcome) | vector+construct | selfEfficacy/outcome, selfFitUnknown |
| 11 | `rc_options` | single | 떠오르는 선택지 정도(거의없음~너무많음) | construct | selfInfoGap↔optionOverload(lowOpt↔scattered 라우팅) |
| 12 | `rc_runway` | single | 버틸 수 있는 기간 | gate+construct | runway gate, income_uncertainty |
| 13 | `rc_energy` | single | 지금 에너지 | gate+vector | energy gate → burnout |
| 14 | `rc_risk` | single | 감당 가능한 손실 | gate+vector | risk gate |
| 15 | `rc_validation` | single | 방향에 받은 실제 반응 | gate+construct | marketValidation gate |
| 16 | `or_content` | single | 콘텐츠·자문 방향 1년 느낌 | vector+construct | valueConflict, 감정나침반 |
| 17 | `or_venture` | single | 창업·독립 방향 느낌 | vector+construct | valueConflict, 감정나침반 |
| 18 | `or_internal` | single | 사내·현직 방향 느낌 | vector+construct | valueConflict, 감정나침반 |
| 19 | **`cs_blocker`** | single | **결정을 막는 것(unclear/confidence/money/eyes/fail/time)** | **비어 있음(effect-free)** | identity_loss·time_constraint friction·storyInsight |
| 20 | `ap_experiment` | single | 이번 달 결과물 형식 | vector | 실험 라우팅, stated-vs-revealed |

**자유 서술 입력은 없다.** `ap_memo`는 제거됨([careerQuestionFlow.ts:380-382](../../src/data/careerQuestionFlow.ts)) → `userFreeText`는 이 플로우에서 **항상 빈 문자열**([freeContext.ts:64-68](../../src/components/paid/freeContext.ts): responses의 shortText를 모으는데, 이 플로우엔 shortText 문항이 없음).

### 1.2 결과 필드 산출 파이프라인

1. `buildResultFromResponses`([session.ts:299-366](../../src/components/careerCompassV2/session.ts)): vector·gates·construct 조립 → `buildResultSpine` → `classifyMainType` → `buildResultContext`.
2. **mainType**: `classifyMainType`([solutionModuleEngine.ts:211-310+](../../src/lib/solutionModuleEngine.ts)) — **first-match 우선순위 게이트**. 순서: `overloadedBurnout`(에너지/readinessGap이 모든 것 override, L216) → `emergingLeader`(bestMove=orgLeadership, L227) → `realityLocked`(runway/risk low+barrier+desire, L233) → `lowOptionVisibility`(goalClarity low+optionOverload low+lowIdentityPull, L268) → `unvalidatedAspirant`(makerPull+validationLow, L299) → `scatteredExplorer`(optionOverload+curiosity/nrExplore) → `conflictedAtFork`(잔여 가치충돌) → plateaued/restless/leverageReady 등.
3. **subtype**: `getSubtype`([subtypeFunctions.ts:249-263](../../src/lib/subtypeFunctions.ts)) — mainType별 점수합산 최고점.
4. **friction**: `getFrictions`([resultContextEngine.ts:164-176](../../src/lib/resultContextEngine.ts)) — 우선순위 매칭 first-match.
5. **readiness**: `getReadinessLevel`([resultContextEngine.ts:179-186](../../src/lib/resultContextEngine.ts)).
6. **storyInsight**(표시 전용, 엔진 미사용): `buildStoryInsight`([storyInsight.ts:63-184](../../src/lib/storyInsight.ts)) — 우선순위 규칙 중 **첫 매칭 1줄만** 반환.

### 1.3 무료 화면 값 vs 유료 AI 전달 값

| 값 | 무료 화면 | 유료 AI(FreeContext) |
|---|---|---|
| mainType / primarySubtype / secondarySubtype | ✅ | ✅ ([freeContext.ts:73-75](../../src/components/paid/freeContext.ts)) |
| pullDirection / primaryFriction / readinessLevel | ✅ | ✅ ([freeContext.ts:76-80](../../src/components/paid/freeContext.ts)) |
| subtypeConfidence | ✅ | ✅ |
| **storyInsight (편향 리프레임 1줄)** | ✅ | ❌ **미전달** |
| **ar_narrow / cs_blocker 원시 선택** | 간접(friction·insight) | ❌ **미전달** |
| 원시 vector/construct 점수, gates | ❌(내부) | ❌ |
| userFreeText | — | ✅이지만 이 플로우에선 **빈 값** |
| occupation/experience/age | — | ✅ ([freeContext.ts:69-72](../../src/components/paid/freeContext.ts)) |

**함의**: 유료 AI가 편향을 참조하려면 `primaryFriction`(8종)이 유일한 창구다 — nr_loss / nr_safety / nr_continuity / blk_eyes / blk_fail 등 5개 이상 원시 신호가 이 8종으로 **다대일 압축**된다.

---

## 2. 16개 유형별 커버리지 매트릭스

매핑 가능성: **A**=현재 문항·scoring만으로 비교적 명확 / **B**=휴리스틱 가능하나 인접 유형 혼동 / **C**=현재 데이터로 구분 불가.

| # | 유형 | 이론적 핵심 | 현재 관련 문항 ID | 실제 scoring 사용 | 구별 어려운 경쟁 유형 | 매핑 | 신뢰도 | 부족한 정보 |
|---|---|---|---|---|---|---|---|---|
| 1 | 손실 회피 | 손실을 이득보다 크게 가중 | `ar_narrow`(nr_loss·nr_safety), `cs_blocker`(blk_fail), `rc_risk` | friction(income_uncertainty/identity_loss), subtype(incomeRisk/valuePreservation), lossAversionHigh 플래그 | 소유효과·매몰비용·모호성회피 | **B** | Medium | 손실 대상(돈 vs 정체성 vs 관계)·이득 대비 가중 크기 |
| 2 | 소유 효과 | *소유했다는 사실* 자체로 과대평가 | (없음; nr_continuity가 근사) | 없음(별도 신호 없음) | 매몰비용·손실회피 | **C** | Low | "내 것이라 놓기 싫다" vs "투자가 아까워 놓기 싫다" 구분 문항 |
| 3 | 매몰비용 오류 | 과거 회수불가 투자가 잔류를 강제 | `ar_narrow`(nr_continuity) | friction(career_capital_loss), subtype(careerCapitalContinuity), storyInsight nr_continuity | 소유효과·손실회피 | **B** | Medium | 시간/노력이 *앞으로의 선택*을 얼마나 잡는지 강도 |
| 4 | 모호성 회피 | 불확실성 *자체*를 회피 | `ar_narrow`(nr_unsure), `cs_blocker`(blk_fail), `rc_validation` | nr_unsure→validation(unvalidatedAspirant), blk_fail→identity_loss | 예기된 후회·검증 필요·손실회피 | **C** | Low | "확률을 몰라 회피" vs "검증만 하면 감" 구분(현재 nr_unsure는 검증으로 코딩) |
| 5 | 극대화자의 함정 | 최선 추구·만족화 실패 | `ar_narrow`(nr_explore), `rc_options`(rc_opt_many), `cv_values`(다수 선택) | too_many_live_options friction, possibilityClosureAvoidance subtype, scatteredExplorer 라우팅 | 분석 마비·선택기준 부재·호기심 분산 | **B** | Medium | "더 나은 게 있을까봐" vs "다 재밌어서" 동기 구분 |
| 6 | 예기된 후회 | *미래 후회 시뮬레이션*이 회피 유발 | (없음; nr_loss가 부분 근사) | 없음 | 손실회피·모호성회피 | **C** | Low | 전향적 후회 예상 문항(현재는 현재 상태만 측정) |
| 7 | 분석 마비 | 과도한 분석이 행동을 막음 | (researchLoop subtype이 근사) | researchLoop = marketInfoGap+executionLow 뿐; `recentBehaviorResearching` 플래그는 **코드상 절대 세팅 안 됨** | 극대화자·선택기준 부재 | **C** | Low | "조사만 반복하고 실행 안 함" 행동 반복 신호 |
| 8 | 선택 기준 부재 | 결정 기준 자체가 없음 | `cs_main`(cs_between), `rc_options`(rc_opt_several) | valueConflict↑ → conflictedAtFork 라우팅, goalClarityLow | 분석 마비·극대화자 | **B** | Medium(High까지) | cs_main 단일선택이라 cs_stay 선택 시 신호 소실 |
| 9 | 생산적 지연 | 바쁜 일로 진짜 결정 회피 | `cs_blocker`(blk_time) | time_constraint friction, storyInsight blk_time | 실험 회피·목표점 이동 | **C** | Low | "바쁨이 회피 수단인가 실제 제약인가" 구분 |
| 10 | 목표점 이동 | 기준을 계속 올림/재정의 | (없음) | 없음 | 극대화자·생산적 지연 | **C** | Low | 시간축 반복 측정 또는 "조건 충족돼도 새 조건 생김" 문항 |
| 11 | 실험 회피 | 테스트·행동 자체를 거부 | `rc_validation`(rc_val_none), `ap_experiment`(ap_unsure), `rc_risk` | marketValidationUnvalidated gate | 방향 없음·모호성회피 | **C** | Low(Medium) | "방향이 없어서" vs "있는데 안 내보냄" 구분 |
| 12 | 리미널리티 | 정체성 전환 *중간 상태* | `cs_main`(cs_stay·cs_rest), 경력전환(profile total≫current) | identityTransition subtype(간접), storyInsight R5 | 정체성 조기결정·번아웃 | **C** | Low(Medium) | "낡은 정체성은 떠났으나 새것 미형성" 상태 문항 |
| 13 | 당위적 사고 | 외부 "해야 한다"에 지배 | `cs_blocker`(blk_eyes) | identity_loss friction, storyInsight blk_eyes | 정체성 조기결정·정체성 상실 | **B** | Medium | "누구의 기대인지·내면화 정도" |
| 14 | 정체성 조기 결정 | 탐색 없이 조기 확정 | `ar_narrow`(nr_decided) | **nr_decided는 storyInsight에서 명시적 제외**([storyInsight.ts:81](../../src/lib/storyInsight.ts)), friction 매핑 없음 | 당위적 사고·리미널리티 | **C** | Low | "탐색을 건너뛰고 확정했는지" 신호 |
| 15 | 가면 증후군 | 유능함에도 사기꾼 느낌 | `sc_outlook`(sc_market_only), `cs_blocker`(blk_confidence) | selfFitUnknown subtype, selfEfficacyLow | 자기효능감 부족 | **C** | Low | "*객관적 유능함에도 불구하고*" 귀인 문항 |
| 16 | 자기효능감 부족 | 실행할 수 없다는 믿음 | `sc_outlook`(sc_market_only·sc_unsure), `cs_blocker`(blk_confidence) | SCCT selfEfficacy(핵심 construct), selfFitUnknown, storyInsight sc_market_only | 가면 증후군 | **B** | Medium(High) | 자기효능이 특정 영역인지 전반인지 |

**집계**: A=0, B=5(손실회피·매몰비용·극대화자·선택기준부재·당위적사고·자기효능감 중 5), C=11.
※ #16 자기효능감과 #8 선택기준부재는 조건이 맞으면 High에 근접하나, 인접 유형(가면증후군·분석마비)과의 *구별*이 불가해 종합 B로 판정.

---

## 3. 유형 간 충돌 매트릭스

각 조합에 대해 "현재 문항으로 가를 수 있는가"와 불가 시 필요한 판별 문항의 성격.

| 충돌 조합 | 현재 가름 여부 | 근거·필요 판별 |
|---|---|---|
| 손실 회피 vs 소유 효과 | ❌ 불가 | 둘 다 nr_loss/nr_continuity로 수렴. "무엇을 잃는지"(미래 이득 vs 현재 소유물)를 묻는 문항 없음. 필요: 대상 프레이밍 문항(잃는 게 *가능성*인가 *지금 가진 것*인가) |
| 손실 회피 vs 모호성 회피 | ⚠️ 부분 | nr_loss(손실 느낌)와 nr_unsure(될지 모름)가 형식상 분리되나, nr_unsure는 *검증형*으로 코딩돼([solutionModuleEngine.ts:292](../../src/lib/solutionModuleEngine.ts)) 모호성회피로 안 감. 필요: "결과 확률을 몰라서 회피 vs 손실이 두려워 회피" 대조 문항 |
| 소유 효과 vs 매몰비용 | ❌ 불가 | nr_continuity 하나가 둘 다 대표. 시제 구분(과거 투자 vs 현재 소유) 문항 필요 |
| 극대화자 vs 분석 마비 | ⚠️ 부분 | nr_explore(극대화)와 researchLoop(분석마비)이 형식상 분리되나, researchLoop는 `recentBehaviorResearching`가 절대 안 켜져 marketInfoGap+executionLow만으로 약하게 작동. 필요: "조사 후 결정 미룸" 반복 행동 문항 |
| 예기된 후회 vs 모호성 회피 | ❌ 불가 | 둘 다 별도 신호 없음. 전향적 후회 예상 vs 확률 불확실 회피를 가르는 문항 필요 |
| 분석 마비 vs 선택 기준 부재 | ⚠️ 부분 | cs_between(기준 부재)은 valueConflict로 라우팅되나, 분석 마비 신호가 약해 겹침. 필요: "기준이 없다" vs "기준은 있는데 정보를 계속 모은다" 대조 |
| 생산적 지연 vs 실험 회피 | ❌ 불가 | blk_time(지연)과 rc_val_none(미실험)이 분리돼 보이나, 둘 다 "행동 안 함"으로 귀결. 회피 *동기* 문항 필요 |
| 생산적 지연 vs 목표점 이동 | ❌ 불가 | 목표점 이동은 완전 미측정. 시간축·조건재설정 문항 필요 |
| 리미널리티 vs 정체성 조기 결정 | ❌ 불가 | 정반대 상태(전환 중 vs 조기 확정)인데 둘 다 약측정. nr_decided(조기결정)는 insight 제외, cs_stay(리미널)는 다른 유형과 겹침. "탐색을 열어뒀나 닫았나" 문항 필요 |
| 당위적 사고 vs 정체성 조기 결정 | ⚠️ 부분 | blk_eyes(외부 기대)는 잡히나 nr_decided(조기확정)와의 인과(남 기대 때문에 조기확정?)는 못 봄. 필요: "확정한 방향이 내 기준인가 남 기준인가" |
| 가면 증후군 vs 자기효능감 부족 | ❌ 불가 | 둘 다 selfEfficacyLow/sc_market_only로 수렴. 가면증후군의 핵심(*객관적 성취에도* 불구)을 재는 문항 없음. 필요: 성취-자기평가 불일치 문항 |

---

## 4. 현재 문항만으로 가능한 유형 (A)

**없음.** 어떤 편향도 인접 유형과의 구별까지 포함해 "명확 구분"에 도달하지 못한다. 시스템이 편향 구별이 아니라 커리어-상황 라우팅을 위해 설계됐기 때문이다.

## 5. 휴리스틱으로만 가능한 유형 (B, Medium)

- **#3 매몰비용** — `nr_continuity` 직접 신호 + career_capital_loss friction + 전용 storyInsight. 단 소유효과·손실회피와 구별 불가.
- **#5 극대화자의 함정** — `nr_explore` + optionOverload → possibilityClosureAvoidance/scatteredExplorer. 호기심 분산·분석마비와 혼동.
- **#8 선택 기준 부재** — `cs_between` + goalClarityLow → conflictedAtFork. cs_main 단일선택 의존.
- **#13 당위적 사고** — `blk_eyes` 직접 신호 + identity_loss friction + 전용 storyInsight. blk_fail과 friction 공유.
- **#16 자기효능감 부족** — SCCT self-efficacy(핵심 construct) + `sc_market_only`/`blk_confidence` + 전용 storyInsight. 가면증후군과 구별 불가.
- (부분) **#1 손실 회피** — nr_loss/nr_safety 신호는 있으나 대상·기제가 소유효과·모호성회피로 새는 다대일.

## 6. 현재는 측정 불가능한 유형 (C, Low)

- **#2 소유 효과** — 전용 신호 없음(nr_continuity가 매몰비용으로 흡수).
- **#4 모호성 회피** — nr_unsure가 검증형으로 코딩돼 편향으로 안 감.
- **#6 예기된 후회** — 전향적 후회 문항 부재.
- **#7 분석 마비** — researchLoop가 죽은 플래그(`recentBehaviorResearching` 미세팅)로 약함.
- **#9 생산적 지연** — blk_time은 실제 제약과 회피를 못 가름.
- **#10 목표점 이동** — 완전 미측정(시간축 없음).
- **#11 실험 회피** — "방향 없음"과 혼동.
- **#12 리미널리티** — 전환 중간상태 전용 문항 없음.
- **#14 정체성 조기 결정** — nr_decided가 insight/friction에서 배제.
- **#15 가면 증후군** — 저효능과 분리 불가.
- (경계) **#1 손실 회피**는 신호 존재로 B에 두되, 순수 손실회피 구별은 C 수준.

---

## 7. 오분류 시뮬레이션 (동일 결과 필드, 다른 심리 기제)

각 쌍은 현재 문항에 답하면 **같은 mainType/subtype/friction**으로 수렴하나 실제 이유가 다르다.

**쌍 1 — 매몰비용 vs 소유효과** (예시의 확장)
- A: "지난 10년이 아까워 못 떠남"(매몰비용). B: "지금 가진 직함·안정이 내 것이라 못 놓음"(소유효과).
- 둘 다 `ar_narrow=nr_continuity` 선택 가능 → `careerCapitalContinuity` subtype + `career_capital_loss` friction 동일([subtypeFunctions.ts:129-130](../../src/lib/subtypeFunctions.ts), [resultContextEngine.ts:167](../../src/lib/resultContextEngine.ts)). **구분 불가.**

**쌍 2 — 손실회피(재정) vs 실제 현실제약**
- A: "돈 잃을까 두려워 못 움직임"(손실회피 편향). B: "실제로 런웨이가 1개월"(객관적 제약).
- 둘 다 `rc_runway=lt1/1to3` → income_uncertainty friction([resultContextEngine.ts:166](../../src/lib/resultContextEngine.ts)) + realityLocked 경로. 편향과 사실을 시스템이 **동일 취급.**

**쌍 3 — 극대화자 vs 호기심 분산**
- A: "더 나은 선택이 있을까봐 못 닫음"(극대화 편향). B: "전부 진심으로 재밌어서 다 해보고 싶음"(넓은 흥미).
- 둘 다 `ar_narrow=nr_explore`+`rc_opt_many` → possibilityClosureAvoidance/scatteredExplorer 동일([subtypeFunctions.ts:146-147](../../src/lib/subtypeFunctions.ts)). 동기(불안 vs 열정) **구분 불가.**

**쌍 4 — 가면증후군 vs 자기효능감 부족**
- A: 팀장 승진·수상 이력 있으나 "난 사실 부족" 느낌(가면증후군). B: 실제 경험이 적어 "해낼 자신 없음"(저효능).
- 둘 다 `sc_outlook=sc_market_only`/`cs_blocker=blk_confidence` → selfFitUnknown subtype + selfEfficacyLow([subtypeFunctions.ts:161-162](../../src/lib/subtypeFunctions.ts)). 성취-자기평가 불일치를 안 물어 **구분 불가.**

**쌍 5 — 당위적 사고 vs 정체성 조기결정**
- A: "부모·주변 기대라 이 길"(당위). B: "탐색 없이 일찍 '난 개발자'로 확정"(조기결정).
- A는 `blk_eyes`→identity_loss로 잡히나, B의 `nr_decided`는 friction·insight 어디에도 안 실려 사실상 **무-신호** → 둘의 대비가 성립 안 함.

**쌍 6(추가) — 생산적 지연 vs 실험 회피**
- A: "바쁘다는 이유로 결정을 미룸"(회피). B: "정말 시간이 없음"(제약) / C: "방향은 있는데 무서워 안 내보냄"(실험회피).
- A·B는 `blk_time`→time_constraint 동일, C는 `rc_val_none`→unvalidated. 회피 동기 vs 제약을 **못 가름.**

---

## 8. 계층형 분류 권고안 (구조만; 미구현)

현재 문항으로 16개 평면 분류는 불안정(§2에서 11개가 C). 다음 **2단계 계층 + 신뢰도** 구조가 더 안전하다.

**1단계 — 상위 범주(현재 문항으로 비교적 안정)**
현재 신호로 4개 상위 범주는 대략 판별 가능하다(각 범주가 이미 특정 construct에 대응):

| 상위 범주 | 현재 대응 신호 | 안정성 |
|---|---|---|
| 본능의 덫(손실·소유·매몰·모호) | `ar_narrow`(loss/safety/continuity), income/career_capital friction | Medium |
| 인지 과부하(극대화·후회·분석마비·기준부재) | `cs_main`(cs_between/cs_many), optionOverload/valueConflict, `rc_options` | Medium |
| 회피 행동(지연·목표이동·실험회피) | `cs_blocker`(blk_time), `rc_validation`(rc_val_none) | Low |
| 정체성 혼란(리미널·당위·조기결정·가면·저효능) | `sc_outlook`, `cs_blocker`(blk_eyes/confidence), SCCT | Medium |

**2단계 — 하위 16개**: 각 상위 범주 안에서만 세분. 단 §2의 C 유형은 신규 판별 문항(§9) 없이는 하위 확정 금지.

**표시 방식 권고**: 사용자당 **주 패턴 1 + 보조 패턴 1 + 신뢰도(High/Medium/Low)**. 이는 기존 `SubtypeResult`의 `primary`/`secondary`/`confidence`(=primaryScore−secondaryScore) 구조와 정확히 동형이라([subtypeFunctions.ts:21-30](../../src/lib/subtypeFunctions.ts)) 재사용 가능. `confidence < BLEND_THRESHOLD(3)`면 "혼합/저신뢰"로 표기하는 로직도 이미 존재([subtypeFunctions.ts:19, 116](../../src/lib/subtypeFunctions.ts)).

**원칙**: 상위 범주는 티저로 노출 가능(신뢰도 Medium+), 하위 16개 세부 라벨은 신뢰도 High일 때만 단정. C 유형은 "가능성"으로만 표현.

---

## 9. 최소 추가 문항안 (C 또는 Low 유형 한정)

원칙: 전면 재설계 금지, 기존 정보 재사용, 판별 문항만, 단일 문항으로 유형 확정 금지, 사회적 바람직성·유도 최소화. **가장 큰 구별 이득을 주는 3문항으로 압축**했다(각 문항이 2쌍 이상을 동시에 가름).

### 신규 문항 Q1 — "놓기 어려운 것의 정체" (소유효과 vs 매몰비용 vs 손실회피 분리)
- **목적**: `ar_narrow=nr_continuity/nr_loss`가 뭉뚱그린 세 편향을 대상·시제로 분리.
- **문항 문구**: "지금 결정을 미루게 하는 '아까움'에 가장 가까운 것은?"
- **답변 형식**: single_select
- **답변 옵션**:
  - a. "지금까지 들인 시간·노력이 아까워서" → 매몰비용(과거 투자)
  - b. "지금 가진 것(직함·안정·관계)을 넘기는 게 아까워서" → 소유효과(현재 보유)
  - c. "무엇을 고르든 다른 하나를 잃는 게 두려워서" → 손실회피(이득-손실 가중)
  - d. "특별히 아까운 건 없다" → (편향 아님, 과발동 방지 앵커)
- **구별 대상**: #2 소유효과 vs #3 매몰비용 vs #1 손실회피
- **scoring 방향**: a→careerCapitalContinuity 강화 & 매몰비용 태그, b→소유효과 태그(신규), c→손실회피 태그. (엔진 라우팅엔 미투입 권장 = ar_narrow처럼 effect-free 태그.)
- **단정 금지 이유**: '아까움'은 세 편향이 공유하는 표층 정서라, 이 문항 하나로는 대상만 좁힐 뿐 강도·전향성은 미측정.

### 신규 문항 Q2 — "행동을 미루는 진짜 이유" (분석마비 vs 실험회피 vs 생산적지연 vs 모호성회피 분리)
- **목적**: `cs_blocker=blk_time`·`rc_val_none`이 뭉갠 회피 기제를 분리.
- **문항 문구**: "'작게라도 한번 해보기'를 아직 안 한 이유에 가장 가까운 것은?"
- **답변 형식**: single_select
- **답변 옵션**:
  - a. "정보를 더 모으면 답이 나올 것 같아 계속 알아보는 중" → 분석 마비
  - b. "결과가 어떻게 될지 몰라 시작이 망설여진다" → 모호성 회피
  - c. "잘못될까 두려워 내보내지 못한다" → 실험 회피
  - d. "다른 급한 일들 때문에 손을 못 댄다" → 생산적 지연/제약
  - e. "이미 작게 해보고 있다" → (회피 아님, 앵커)
- **구별 대상**: #7 분석마비 vs #4 모호성회피 vs #11 실험회피 vs #9 생산적지연
- **scoring 방향**: a→analysisParalysis 태그, b→ambiguityAversion, c→experimentAvoidance, d→productiveProcrastination. effect-free 태그 권장.
- **단정 금지 이유**: 자기보고 회피 동기는 사회적 바람직성 편향에 취약(특히 c/d). 옵션 e(앵커)와 `ap_experiment`·`rc_validation` 실제 선택과 교차 검증해야 신뢰.

### 신규 문항 Q3 — "확신의 근거" (가면증후군 vs 저효능 분리)
- **목적**: `sc_outlook`·`blk_confidence`가 못 가른 "유능함에도 불구하고" 신호를 성취-자기평가 불일치로 포착.
- **문항 문구**: "지금까지의 성과나 인정에 대해 가장 가까운 느낌은?"
- **답변 형식**: single_select
- **답변 옵션**(성취 존재를 전제하지 않도록 중립 프레이밍):
  - a. "좋은 평가를 받아도 '운이 좋았을 뿐'이라는 생각이 든다" → 가면증후군(귀인 왜곡)
  - b. "아직 내세울 만한 성과 자체가 부족하다고 느낀다" → 저효능(경험 기반)
  - c. "성과도 있고, 그만큼 내 실력이라고 느낀다" → 건강한 효능감(앵커)
  - d. "잘 모르겠다" → 미측정 앵커
- **구별 대상**: #15 가면증후군 vs #16 자기효능감 부족
- **scoring 방향**: a→impostor 태그(성취 인정 + 자기 귀인 부정), b→lowSelfEfficacy 강화, c→효능 정상. effect-free 태그 권장.
- **단정 금지 이유**: 가면증후군은 반복·상황의존적 특성이라 단일 문항 자기보고로 확정 불가. `sc_outlook`(sc_market_only)과 교차해 "외부결과 낙관+자기 회의" 패턴일 때만 보조 신호로.

**미해결(신규 문항으로도 최소 1개 더 필요)**: #10 목표점 이동은 **시간축 반복 측정**이 본질이라 단발 문항으로 원리상 불가 — 30일 후 재평가([careerCompassFollowUp30d.ts])에서 "지난달 기준이 또 올라갔는지"를 종단 비교하는 방식이 유일한 타당 경로다. #12 리미널리티/#14 조기결정은 Q1~Q3 밖의 별도 "탐색 개방/폐쇄" 문항이 필요하나, 티저 신뢰도 이득이 낮아 후순위로 둔다.

---

## 10. 무료 결과 티저 안전/위험 라벨

**티저로 노출해도 안전한 라벨**(현재 신호로 Medium+ 지지 + 오분류 시 무해):
- 상위 범주 4종("본능의 덫 / 인지 과부하 / 회피 행동 / 정체성 혼란")
- #8 "선택 기준 부재"(cs_between 직접 신호)
- #16 "자기효능감"(SCCT 핵심 construct) — 단 "가면증후군"으로 승격 금지
- #3 "매몰비용"·#5 "극대화"·#13 "당위적 사고"는 **가능성 어투**로만("~일 수 있어요")

**티저로 쓰면 안 되는 라벨**(오분류 위험 + 낙인 가능):
- **#15 가면 증후군** — 임상 뉘앙스 + 저효능과 구별 불가 → 단정 시 오해·상처 위험
- **#2 소유효과 / #6 예기된 후회 / #10 목표점 이동 / #14 정체성 조기결정** — 전용 신호 없음(허구 매핑 위험)
- **#4 모호성 회피** — 현재 검증형으로 코딩돼 반대 처방 유발 가능
- 편향 라벨을 "당신은 X입니다"式 **단정 헤드라인**으로 쓰는 것 전반(기존 방침과도 상충: [careerQuestionFlow.ts:10](../../src/data/careerQuestionFlow.ts) "no MBTI 'you are X' framing", [storyInsight.ts:1-3](../../src/lib/storyInsight.ts))

---

## 11. 구현 시 변경 필요 파일 목록 (참고; 이번 작업 아님)

편향 계층 분류를 실제 도입한다면:

| 파일 | 변경 성격 |
|---|---|
| [src/data/careerQuestionFlow.ts](../../src/data/careerQuestionFlow.ts) | 신규 판별 문항 Q1~Q3 추가(effect-free 태그로) |
| 신규 `src/lib/biasPatternEngine.ts` | ar_narrow/cs_blocker/sc_outlook/신규 문항 → 16패턴 태그·신뢰도 산출(엔진 라우팅과 분리) |
| [src/lib/storyInsight.ts](../../src/lib/storyInsight.ts) | nr_decided 등 현재 배제 신호에 대한 리프레임 추가(선택) |
| [src/types/careerCompass.ts](../../src/types/careerCompass.ts) | BiasPattern enum + ResultContext 확장 필드(옵셔널·additive) |
| [src/components/careerCompassV2/session.ts](../../src/components/careerCompassV2/session.ts) | biasPattern을 spine에 additive 패스스루(P2.0 라우팅 지문 불변 계약 유지) |
| 무료 결과 UI([ResultSpineView.tsx]) | 상위 범주 티저 표시(신뢰도 어투) |

## 12. 유료 파이프라인 무영향 구현 방법

- **additive-only 패스스루**로 설계: 기존 엔진(vector/gates/construct/classifyMainType)과 라우팅 지문에 신규 신호를 **투입하지 않는다**. 현재 `storyInsight`·`profileContext`·`narrativeSeed`가 이미 이 계약("엔진은 절대 읽지 않는다")으로 붙어 있다([session.ts:322-348](../../src/components/careerCompassV2/session.ts), [storyInsight.ts:9](../../src/lib/storyInsight.ts)) — 동일 패턴을 따르면 P2.0 라우팅 지문 테스트가 그대로 통과.
- **유료 계약 불변**: `FreeContext` 타입·`readFreeContext`를 바꾸지 않으면 유료 AI 입력은 그대로다. 신규 biasPattern을 유료로 넘기고 싶을 때만 별도 결정으로 FreeContext에 옵셔널 필드 1개 추가(그 전까진 무료 화면 전용).
- **문항 추가의 유일한 파급**: 신규 문항이 effect-free(scoreEffects/constructEffects 비움)면 vector·construct·gates·mainType이 불변 → 기존 결과·유료 입력 완전 동일. (ar_narrow/cs_blocker가 이미 이 방식으로 안전하게 공존 중.)

---

## 부록. 확인된 사실 vs 가설 구분

**코드로 확인된 사실**:
- 20개 무료 문항 전체 정의·옵션·effect([careerQuestionFlow.ts](../../src/data/careerQuestionFlow.ts) 전문).
- 5개 결과 필드 enum 값([careerCompass.ts:77-98, 381-404, 715-730](../../src/types/careerCompass.ts)).
- ar_narrow·cs_blocker가 effect-free이며 resultContextEngine/solutionModuleEngine/storyInsight에서만 소비됨(grep 전수 확인).
- getFrictions·getReadinessLevel·getSubtype·classifyMainType의 실제 조건식(해당 파일 줄 번호).
- FreeContext에 storyInsight·ar_narrow·cs_blocker·원시 점수가 미포함, userFreeText가 이 플로우에서 빈 값([freeContext.ts](../../src/components/paid/freeContext.ts), [careerQuestionFlow.ts:380-382](../../src/data/careerQuestionFlow.ts)).
- `recentBehaviorResearching` 플래그가 emptyCareerProfile 이후 어디서도 세팅되지 않음(researchLoop 약화)([subtypeFunctions.ts:56, 273](../../src/lib/subtypeFunctions.ts) + buildCareerProfile 전수 확인).

**가설(코드로 완전 검증되지 않음)**:
- 각 편향의 "이론적 핵심"과 사용자 관찰 신호는 학술 정의 기반이며, 실제 사용자 응답 분포로 검증하지 않았다(오분류 쌍은 코드 경로상 *가능*함을 보인 것이지 실측 빈도가 아님).
- 상위 4범주의 "Medium 안정성"은 조건식 구조 기반 추정이며, 실제 응답 데이터로 신뢰도를 산출하지 않았다.
- classifyMainType의 P3 이후(plateaued/restless/leverageReady) 세부 게이트는 요약 인용했고 전 분기를 줄 단위로 옮기지 않았다(핵심 6개 게이트까지 확인).

**학술 타당성 vs 코드 측정 가능성**: 본 감사는 "이론적으로 이 편향이 존재하는가"가 아니라 "**현재 문항·scoring이 이 구성개념을 분리 측정하는가**"만 판정한다. 예: 자기효능감은 SCCT로 학술·코드 모두 측정되나(#16 B), 가면증후군은 학술적으론 별개 구성개념이지만 코드상 저효능과 분리 불가라 C로 판정한다.
