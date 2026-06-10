# Career Compass v2 — subtype 분류 문제 정리 (GPT 상담용)

> 이 문서는 코드 없이도 이해할 수 있게 자립형으로 작성. 결정 시스템의 분류 로직 한 군데에서
> "사용자 기대 ↔ 엔진 분류"가 어긋나는 케이스를 정리한 것.

---

## 1. 시스템 개요 (맥락)

Career Compass는 **결정론적 규칙 기반**(LLM 없음) 커리어 의사결정 도우미다. 사용자의 객관식·슬라이더
답변을 받아 결과지를 만든다. 파이프라인:

```
답변(FlowResponses)
  → CareerVector (13축, 0~100 정규화: expertise, autonomy, stability, marketOrientation,
                  creativity, analysisOrientation, ventureOrientation, executionDrive,
                  impactOrientation, recoveryNeed, riskTolerance, financialReadiness,
                  marketValidationNeed)
  → ConstructProfile (이론 기반: SCCT[selfEfficacy/outcomeExpectation/goalClarity/contextual…],
                  Adaptability[concern/control/curiosity/confidence],
                  CDDQ 의사결정난이도[readinessGap/selfInfoGap/marketInfoGap/valueConflict/optionOverload],
                  MCDA 가중치[identityFit/assetLeverage/marketPotential/energySustainability/
                  financialSafety/autonomy/impact])
  → ReadinessGates (4개: energy / runway / risk / marketValidation)
  → classifyMainType  → 10개 mainType 중 1개 (first-match, 우선순위 순서대로)
  → subtype 계산      → mainType 안에서 한 단계 더 (점수 합산 후 최고점)
  → 결과지 4섹션 + 신호
```

임계값 상수: 벡터 `V_HIGH=60 / V_MOD=45`, construct `C_HIGH=66 / C_PRESENT=50 / C_LOW=33`.

### v2에서 새로 넣은 것 = subtype 레이어
v1은 `mainType → 솔루션 → 카피`로 너무 빨리 압축돼, 같은 mainType이면 모두 같은 솔루션을 받았다.
그래서 mainType 안에 **subtype**을 하나 더 두고(점수 합산 방식), subtype별로 결과지 카피를 다르게 한다.

- `mainType` = first-match (먼저 매칭되는 조건이 이김)
- `subtype` = **score-summation** (조건마다 점수를 더해 최고점 선택, 동점은 우선순위표)
- subtype이 비슷하게 강하면(점수차 < 3) "혼합"으로 primary core에 secondary 한 절을 덧붙임

---

## 2. 문제의 mainType: `conflictedAtFork` (갈림길 결정형)

"선택지가 부족한 게 아니라, 무엇을 먼저 지킬지 기준이 안 선 상태." subtype 4개와 점수식:

```
incomeRisk              = financialSafetyHigh ?3 + runwayTight ?2 + riskLow ?2 + nrSafety ?2
careerCapitalContinuity = expertiseHigh ?3 + nrContinuity ?3 + assetLeverageHigh ?1
identityTransition      = (csBlockerSocialGaze||csBlockerIrreversible) ?3
                          + (autonomyHigh||creativityHigh) ?2 + workModeOrg ?1
valuePreservation       = mcdaConflict ?3 + top2ScoresClose ?2 + cvValuesMany ?2 + lossAversionHigh ?1
```

동점 우선순위: `incomeRisk > careerCapitalContinuity > identityTransition > valuePreservation`

각 플래그의 의미(어디서 켜지나):
- `financialSafetyHigh` = MCDA financialSafety ≥ 66
- `runwayTight` = 게이트 runway ∈ {critical, tight} (생활비 여유 ≤ 3개월)
- `riskLow` = 게이트 risk ∈ {none, timeOnly} (손실 감당 범위 좁음)
- `nrSafety` = "좁히지 못하는 이유" 질문 답 = "돈·안정 때문에 쉽게 못 버려서"
- `nrContinuity` = 같은 질문 답 = "지금까지 쌓아온 경험과 연결돼 있어서"
- `expertiseHigh` = 벡터 expertise ≥ 60
- `mcdaConflict` = CDDQ valueConflict ≥ 50 (가치 충돌)
- `cvValuesMany` = "포기 못 할 가치" 선택 개수 ≥ 3
- `top2ScoresClose` = 옵션 fit 상위 2개 점수차 ≤ 5
- `lossAversionHigh` = nr 답 = "어느 쪽을 골라도 중요한 걸 하나 잃는 느낌"

---

## 3. 문제 케이스 (실제 발생)

세이지가 만든 페르소나: **전문직 기반으로 커리어를 다지는 사람**.

답변 요약:
- 끌리는 역할: **전문가(ar_expert)** + 자문가(ar_advisor)  ← "전문성 기반"의 근거
- 좁히지 못하는 이유: **"돈·안정 때문에"(nr_safety)**
- 포기 못 할 가치: **돈·의미·안정 3개**(cv_values 3개 선택)
- 결정 블로커: **돈·생활 조건(blk_money)**
- 게이트: runway 1~3개월(tight), risk 거의 없음(none), 시장검증 없음

엔진 결과: `conflictedAtFork / valuePreservation ⊕ incomeRisk (혼합)`

대략적 점수:
- valuePreservation ≈ **7** = mcdaConflict(3) + cvValuesMany(2) + top2ScoresClose(2)  ← primary
- incomeRisk ≈ **6** = runwayTight(2) + riskLow(2) + nrSafety(2)  ← secondary (financialSafetyHigh 미달 추정)
- careerCapitalContinuity ≈ **3** = expertiseHigh(3) + nrContinuity(0)  ← 낮음
  · nrContinuity가 0인 이유: 이 사람은 "좁히지 못하는 이유"로 **경험 연결(nr_continuity)이 아니라
    돈·안정(nr_safety)**을 골랐다. 그래서 전문가인데도 careerCapital 점수가 안 오름.

결과지 카피(valuePreservation): **"선택지를 고르지 못하는 건 우유부단해서가 아닙니다…"**

---

## 4. 무엇이 문제로 느껴지나

세이지의 직관: **"전문성 기반 사람인데 왜 '우유부단(valuePreservation)'으로 나오나?
전문성을 살리는 careerCapitalContinuity('쌓아온 경험을 어떻게 이어 쓸까')가 맞지 않나?"**

여기엔 사실 **두 개의 다른 질문**이 섞여 있다:

### (A) 분류 정확성 문제
전문가 역할을 골랐는데 careerCapital이 3점으로 낮아 밀렸다. 핵심 원인:
- `careerCapitalContinuity`는 **전문성(expertiseHigh 3점)만으로는 부족**하고, 사실상
  **nrContinuity(경험 연결, 3점)에 크게 의존**한다. 그런데 이 사람은 좁히는 이유로 돈(nr_safety)을 골라서
  nrContinuity가 0 → careerCapital이 약해짐.
- 반대로 `valuePreservation`은 **가치 3개 선택(cvValuesMany)** 만으로도 2점이 붙는다. 대부분의 사람이
  가치를 3개쯤 고르므로 cvValuesMany(≥3 기준)가 **너무 쉽게 켜져** valuePreservation 점수가 잘 부푼다.
- 즉 "전문성"이라는 신호가 분류에서 약하게 다뤄지고, "가치 여러 개"가 과대평가됨.

### (B) 카피 프레이밍 문제
설령 분류(valuePreservation)가 데이터상 맞다 해도, **"우유부단"이라는 라벨/프레임이 전문가에게는
어울리지 않고 가치 절하처럼 느껴진다.** (현재 카피는 톤을 "감정 판정→미완료 조건"으로 다듬어
"우유부단해서가 아니라 둘 다 소중해서"로 완화한 상태지만, 여전히 전문성을 한 번도 언급하지 않음.)

또 하나의 **해석 관점 차이**: 엔진은 "**역할 선택(전문가)**"이 아니라 "**좁히지 못하는 이유(돈·안정)**"를
그 사람의 *진짜 고민*으로 본다. 이 관점에선 valuePreservation+incomeRisk가 **데이터상 틀리지 않다**
(이 사람의 명시적 걱정은 돈·가치충돌이지, 경험 단절이 아니므로). 문제는 세이지의 기대("전문가니까
전문성 서사")와 엔진의 근거("이 사람이 실제로 누른 건 돈 걱정") 사이의 간극.

---

## 5. 고려 중인 레버 (결정 필요)

- **(가) cvValuesMany 기준 상향**: ≥3 → ≥4. 가치 3개는 흔하니 너무 쉽게 켜진다. 4개부터로 하면
  valuePreservation 과발동이 줄고, 전문성/연속성 신호가 더 자주 이긴다.
- **(나) careerCapitalContinuity의 전문성 가중 강화**: expertiseHigh 단독 점수를 올리거나,
  "expertise 높음 + 가치 여러 개"일 때 careerCapital 쪽으로 가중. (전문가가 가치도 많으면
  valuePreservation 대신 careerCapital로.)
- **(다) 분류는 그대로, 카피만 보강**: valuePreservation 카피가 전문성을 인정하는 문구를 포함하도록.
  (단, subtype 카피는 정적이라 개인 전문성을 동적으로 못 넣는 한계.)
- **(라) 아무것도 안 바꿈**: 이 사람의 실제 답변(돈 걱정 + 가치 3개)상 valuePreservation+incomeRisk가
  타당하다고 보고 둘 다 유지. (역할 선택 ≠ 진짜 고민이라는 엔진 철학 존중.)

---

## 6. GPT에게 묻고 싶은 것 (제안)

1. **분류 철학**: "끌리는 역할"보다 "좁히지 못하는 이유/현실 게이트"를 그 사람의 진짜 고민으로 보는
   현재 가중이 타당한가? 전문성(역할/벡터)을 분류에 더 반영해야 하나, 아니면 self-report 우선이 맞나?
2. **cvValuesMany ≥3 기준**이 valuePreservation을 과대 발동시키는 구조적 편향인가? 적정 기준은?
3. **careerCapitalContinuity가 nrContinuity에 과의존**하는 게 문제인가? 전문성만으로도 더 끌어올려야 하나?
   (그러면 "전문가지만 가치충돌형"인 사람을 careerCapital로 오분류할 위험은?)
4. 더 근본적으로 — **이런 경계 케이스(전문성 높음 + 돈 걱정 + 가치 여럿)**를 하나의 subtype으로
   누르는 게 맞나, 아니면 "혼합"으로 두 서사를 같이 보여주는 현재 방식이 맞나?

---

## 부록: subtype 전체 목록 (참고)

| mainType | subtypes |
|---|---|
| conflictedAtFork | incomeRisk / careerCapitalContinuity / identityTransition / valuePreservation |
| scatteredExplorer | possibilityClosureAvoidance / researchLoop / curiositySpread |
| unvalidatedAspirant | marketResponseUnknown / selfFitUnknown / sustainabilityUnknown |
| restlessStabilizer | meaningDecline / autonomyDeficit / growthRoutineAbsent |
| plateauedPerformer | expertiseStagnation / recognitionGap / assetUnleveraged |
| leverageReady | content/advisory/analysis/independent/startup/general (pullDirection 분기) |
| overloadedBurnout | energyDepletion / decisionOverload / environmentDrain |
| realityLocked | runwayShortage / lossIntolerance / externalConstraint |
| lowOptionVisibility | selfInfoGap / marketInfoGap / roleLanguageGap |
| emergingLeader | (단일) |
