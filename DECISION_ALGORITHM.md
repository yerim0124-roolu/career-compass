# Career Compass — 의사결정 알고리즘 현재 구조 (GPT 상담용)

> 목적: 커리어 고민 사용자를 ~20문항으로 진단해 **10개 "유형" 중 하나**로 분류하고, 그에 맞는 "이번 달 솔루션 + 한 수 + 30일 플랜"을 제시한다. **전부 규칙 기반(결정론)**이며 LLM은 아직 안 쓴다. 이 문서는 "더 나은 분류·추천 로직"을 상담받기 위한 현재 상태 정리다.

---

## 0. 전체 파이프라인

```
설문 답변
  → (a) 벡터(13축) 누적        : "어떤 성향인가"
  → (b) construct 프로파일      : "결정이 왜 막혀 있나" (심리·난도 신호)
  → (c) 게이트(4종)             : "현실 조건" (에너지·런웨이·리스크·시장검증)
       │
       ├─ 옵션 fit 계산(9개 진로) = 벡터·가중치 → 점수, 게이트로 타이밍 강등
       │     → currentBestMove(지금의 한 수), strategicDirection(검증할 방향)
       │
       └─ classifyMainType = 벡터+construct+게이트+bestMove → 10개 유형 중 1개
             → 유형 → 솔루션 모듈 → 결과지 카피/플랜
       │
       └─ storyInsight = 원답변 교차 추론 → "당신의 이야기" 한 줄 (표시 전용)
```

**핵심 설계 원칙**: 사용자가 자기 유형을 *직접 고르게* 하지 않는다. 행동/마찰/반응을 통해 간접 추론한다.

---

## 1. 입력 — 질문과 수집 정보

### 1-1. 프로필(맥락) 문항 10개 — 라우팅엔 거의 안 쓰이고 카피 개인화용
`연령대 / 직무(자유텍스트) / 전체 경력연수 / 현재 분야 경력연수 / 일하는 방식(조직·전문직·프리랜서·창업·학생·휴직·복합) / 전환 시점 / 전환 의향 / 고민 태그 / 제약 태그 / 원하는 경로`

### 1-2. 본 설문 문항 (분류·추천을 구동) — 답변이 벡터/construct/게이트로 매핑됨

| 문항 | 측정 | 주요 매핑 |
|---|---|---|
| **cs_main** 지금 상태(택1) | 고민의 형태 | cs_many→optionOverload+5,curiosity+3 / cs_between→valueConflict+4,optionOverload+3 / cs_rest→readinessGap+5 / cs_stay→readinessGap+4 / cs_expand→goalClarity+3 |
| **ar_roles** 끌리는 역할(1~3개) | 정체성 끌림 | 전문가→expertise / 크리에이터→creativity / 창업가→ventureOrientation,executionDrive / 분석가→analysis,market / 자문가→expertise,impact / 리더→executionDrive,stability,impact / 안정형→stability / 조력자→impact / 프리랜서→autonomy / 재정비→recoveryNeed |
| **ar_narrow** 하나로 못 좁히는 이유(택1) | 병목의 정체 | (effect-free, 분류 타이브레이커+인사이트) nr_explore→탐색 / nr_loss·nr_safety·nr_continuity→갈림길(포기비용) / nr_unsure→검증 / nr_decided→정해짐 |
| **cv_values** 포기 못할 가치(최대5) | 가치 폭 | 각 가치 → 해당 벡터축. 5개↑ = 미분화 신호(인사이트) |
| **cv_priorities** 우선순위 랭킹(3~7) | 가치 가중(MCDA) | 돈→financialSafety / 의미→impact / 자유→autonomy / 성장→assetLeverage / 안정→energySustainability+financialSafety / 영향력→impact+marketPotential / 회복→energySustainability. **순위 가중 1.0/0.8/0.6/0.4/0.2** |
| **fc_1~4** 양자택일 ×4 | 깊은 선호 | 전문가↔연결가 / 안정↔빌더 / 조용↔드러냄 / 메이커↔해석가 |
| **sc_outlook** 자신감(택1) | SCCT 자기효능·결과기대 | sc_both→둘다高 / sc_self_only→자기효능高·결과기대低·marketGap+4 / sc_market_only→결과기대高·자기효능低 / sc_unsure→둘다低·readinessGap+5 |
| **rc_options** 보이는 선택지(택1) | 선택지 인식 | few→selfInfoGap+5 / some→+2 / several→valueConflict+3 / many→optionOverload+5 |
| **rc_runway** 버틸 기간(택1) | 재정 게이트 | →gate.runway: critical/tight/moderate/comfortable/extended/unknown |
| **rc_energy** 에너지(택1) | 에너지 게이트 | →gate.energy: depleted/strained/steady/capacity/high |
| **rc_risk** 감당 손실(택1) | 리스크 게이트 | →gate.risk: none/timeOnly/smallCost/experiment/incomeDrop |
| **rc_validation** 시장 반응 확인(택1) | 검증 게이트 | →gate.marketValidation: unvalidated/early/partial/validated + marketGap |
| **or_content / or_venture / or_internal** 세 방향 감정반응(각 택1) | 에너지 나침반 | energized→설렘(efficacy/outcome↑) / meaning_money→valueConflict+4 / money_tiring→valueConflict+3 / capable_flat→무덤덤 / unsure→marketGap |
| **cs_blocker** 결정 미루는 이유(택1) | 마찰 (effect-free, 인사이트용) | 모름/자신감/돈/시선/되돌리기/시간 |
| **ap_experiment** 30일 실험 선택(택1) | *유저가 고른 행동* | ⚠️ **현재 쟁점: 이게 실행 플랜을 끌고 가 진단과 어긋남. 제거 검토 중** |

---

## 2. 신호 레이어 (답변 → 누적)

### 2-1. 벡터 13축 (성향, 0~100 상대정규화)
`expertise, autonomy, stability, marketOrientation, creativity, analysisOrientation, ventureOrientation, executionDrive, impactOrientation, recoveryNeed, riskTolerance, financialReadiness, marketValidationNeed`
- 각 카드의 scoreEffects를 합산, **최댓값 축=100으로 상대 정규화**(카드 수에 강건).

### 2-2. Construct 프로파일 (결정 심리·난도, 0~100 정규화)
- **SCCT**: selfEfficacy(잘 해낼 자신), outcomeExpectation(시장이 알아줄 기대), goalClarity(방향 또렷), contextualSupport(여건), contextualBarrier(제약)
- **Adaptability**: concern(준비), control(통제감), curiosity(탐색성), confidence(자신)
- **Difficulty(난도)**: readinessGap(결정준비부족), selfInformationGap(자기정보부족), marketInformationGap(시장정보부족), **valueConflict(가치충돌)**, **optionOverload(선택지과잉)**
- **MCDA(가치가중)**: identityFit, assetLeverage, marketPotential, energySustainability, financialSafety, autonomy, impact

### 2-3. 게이트 4종 (현실 조건, 범주형)
`energy / runway / risk / marketValidation`

### 2-4. 임계 상수
- 벡터: **V_HIGH=60, V_MOD=45**
- construct: **C_HIGH=66, C_PRESENT=50, C_LOW=33**

---

## 3. 진로 옵션 fit (9개) → 추천(currentBestMove / strategicDirection)

### 3-1. fit 점수 = Σ(가중치 × 벡터축) − 페널티
| 옵션 | 가중치 |
|---|---|
| 현직 유지·재설계 stayRedesign | stability .4, expertise .3, autonomy .1, recoveryNeed .2 |
| 이직 jobChange | expertise .3, market .3, autonomy .2, stability .2 |
| 창업 startup | venture .35, execution .3, risk .2, impact .15 |
| 프리랜스/독립 independent | autonomy .3, expertise .25, market .2, risk .25 |
| 콘텐츠/브랜드 contentBrand | creativity .3, impact .3, market .2, expertise .2 |
| 전문 자문/강의 advisoryTeaching | expertise .4, impact .3, autonomy .1 (합<1) |
| 투자/분석/리포트 investAnalysis | analysis .4, market .35, expertise .25 |
| 조직 내 리더십 orgLeadership | execution .4, impact .25, stability .3, **autonomy −.25** + (stability<30 또는 execution<40이면 부족분×0.6 감점) |
| 휴식/재정비 restRecover | recoveryNeed .8, stability .2 |

**페널티**: recovery-friendly(restRecover/stayRedesign) 외에는 executionLoad·financialRisk에 따라 recoveryNeed·(100−riskTolerance)·(100−executionDrive)로 감점.

### 3-2. 게이트로 타이밍 강등 (RISK_PROFILES 기반, 옵션별 generic)
각 옵션의 위험 프로파일(executionLoad/financialRisk/marketValidationRequired)을 게이트와 대조해 **now / conditional / prepareAfter / pause**로 강등. 예: 검증 필요 high인데 marketValidation=unvalidated → conditional. 가장 제한적 ceiling이 이김(정체성 fit이 높아도 못 넘음).

- **currentBestMove(지금의 한 수)** = now 가능한 옵션 중 최선 (안전판 보정 로직 포함: 부업형 방향인데 이직이 안전판이면 현직 재설계로 교체).
- **strategicDirection(검증할 방향)** = 최고 fit이지만 게이트로 강등된 방향(있을 때).

---

## 4. 분류 (classifyMainType) — 10개 유형, 순서대로 첫 매치 (★ 핵심 로직)

> "reality-first → decision-difficulty → identity-state" 순. **순서가 결과를 좌우함.**

```
P1  overloadedBurnout (과부하 소진형)
    if energyLow || recoveryNeed≥60 || readinessGap≥66
P1.5 emergingLeader (조직 리더 성장형)
    if bestMove == orgLeadership        // fit 엔진이 이미 결합형 리더신호 강제
P2  realityLocked (현실 조건 정비형)
    if (runwayLow||riskLow) && contextualBarrier≥66 && 강한 빌드/독립 욕구
P3  lowOptionVisibility (기회 탐색 부족형)
    if goalClarity≤33 && optionOverload≤33 && recoveryNeed<60 && 정체성끌림낮음
       && (topFit<55 || selfInfoGap≥50 || curiosity≤33)
       && [가드: 방향함의 실험 선택했거나 안정·전문 베이스면 차단]

── 결정-난도 3종 (순서 = 스펙대로 재배열, "선택 기준 정리" catch-all 방지) ──
   decisionConfident = selfEfficacy≥66 && outcomeExpectation≥66
   ar_narrow 타이브레이커: nrExplore / nrLossAversion / nrValidate

(a) unvalidatedAspirant (시장 미검증 도전형) → "작은 검증"
    if makerPull(venture≥60||creativity≥55||market≥60)
       && validationLow(unvalidated|early)
       && (marketInfoGap≥50 || nrValidate)
       && optionOverload<66          // 과잉 메이커는 제외 → scattered로
       && !nrExplore && !nrLossAversion

(b) scatteredExplorer (탐색 과잉형) → "선택지 좁히기"
    if (optionOverload≥50 && curiosity≥60 && goalClarity≤33)   // cs_many의 핵심
       || (nrExplore && optionOverload≥50 && goalClarity≤33)
       || (nrExplore && !nrLossAversion && goalClarity≤33 && curiosity≥50)
    // ※ cs_many(호기심↑)와 cs_between(호기심 안 오름)을 curiosity로 가름

(c) conflictedAtFork (갈림길 결정형) → "선택 기준 정리"
    if (valueConflict≥66 && !convergedMaker && !decisionConfident)
       || (valueConflict≥50 && mcdaConflict && !decisionConfident)
       || (valueConflict≥50 && nrLossAversion && !convergedMaker && !decisionConfident)
    // mcdaConflict = financialSafety≥50 && (impact≥50 || autonomy≥50)

── 정체성-상태 3종 ──
P6  plateauedPerformer (정체된 성실형) → "전문성 자산화"
    if expertise≥60 && selfEfficacy≥66 && (goalClarity≤33||curiosity≤33) && optionOverload≤33
P7  restlessStabilizer (안정 속 권태형) → "현직 재설계"
    if stability≥55 && energyOk && runwayOk && goalClarity≤33 && (creativity||impact||autonomy ≥45)
P8  leverageReady (전문성 레버리지형, 기본값) → "독립 파일럿"
```

### 4-1. 유형 → 솔루션 모듈 (primary, secondary)
| 유형 | 솔루션 |
|---|---|
| overloadedBurnout | 회복 우선, 현직 재설계 |
| realityLocked | 런웨이 안정화, 현직 재설계 |
| lowOptionVisibility | 선택지 발굴, 강점 회고 |
| **conflictedAtFork** | **선택 기준 정리**, 선택지 좁히기 |
| **scatteredExplorer** | **선택지 좁히기**, 시장 검증 |
| **unvalidatedAspirant** | **시장 검증(작은 검증)**, 콘텐츠 엔진 |
| plateauedPerformer | 전문성 자산화, 콘텐츠 엔진 |
| restlessStabilizer | 현직 재설계, 콘텐츠 엔진 |
| emergingLeader | 리더십 확장, 현직 재설계 |
| leverageReady | 독립 파일럿, 시장 검증 |

---

## 5. storyInsight — "당신의 이야기" 한 줄 (표시 전용, 원답변 교차 추론)

> 고른 답을 *되돌려 말하지 않고*, 답들이 *부딪히는 지점*을 짚는다. 첫 매치 1개만, 없으면 생략.

순서: R1 말vs행동(안정·회복 1순위인데 도전형 실험 선택) → R2 가치충돌 페어(안정↔자유 등 6쌍) → R-narrow(ar_narrow 6종) → R6 자신감 비대칭(sc_self_only/market_only) → R7 가치 과다선택 → R3 감정 나침반(설렘 분포) → R4 비일관(안정1위+창업역할) → R8 탈출신호 → R9 가치-역할 일치(긍정) → R10 결정 블로커(cs_blocker 리프레임) → R5 이력 전환.

---

## 6. 알려진 쟁점 / 상담받고 싶은 것

1. **분류가 임계·정규화에 취약**: optionOverload가 상대정규화로 cs_many(+5)나 cs_between(+3)이나 둘 다 ~50으로 눌려, curiosity 같은 보조 신호로 억지로 가름. 더 강건한 분류 방법?
2. **순서 의존성**: 10개 유형이 first-match라 순서가 결과를 좌우. 점수/확률 기반(soft)으로 가야 하나, 규칙 유지가 나은가?
3. **conflictedAtFork loss-aversion 신호 부족**: 갈림길의 본질(포기 비용)을 valueConflict(흔한 반응으로 쉽게 높아짐)로 잡아 과발동했었음. ar_narrow로 보강했으나 더 정밀하게?
4. **fit과 유형이 따로**: 추천(옵션 fit)과 진단(construct 유형)이 별도 계산이라 어긋날 수 있음(예: 검증형인데 솔루션 헤드라인↔플랜 분열).
5. **3종 결정-난도(탐색/갈림길/검증) 경계**: 다중 관심 vs 가치 충돌 vs 미검증을 신뢰성 있게 구분하는 더 나은 신호/문항 설계?
6. **regret/안전 편향**: 게이트가 위험 옵션을 강등하는데, 현직 불만 큰 사람에겐 역효과 가능. 적정 균형?
