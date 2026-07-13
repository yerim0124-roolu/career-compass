# CareerPattern v1 — 16개 커리어 고민 패턴 결정론적 분류 명세

- 날짜: 2026-07-13
- 근거: [free-career-pattern-coverage-audit.md](free-career-pattern-coverage-audit.md)
- 성격: **설계 명세만**. 이번 작업에서 코드는 변경하지 않는다. 구현 대상은 §12에만 기록한다.

## 0. 설계 계약 (불변식)

1. 기존 `mainType` / `subtype` / `primaryFriction` / `pullDirection` / `readinessLevel`의 의미·계산 로직을 **변경하지 않는다**. 이 명세는 그 값들을 재해석·대체하지 않는다.
2. 신규 분류기는 기존 엔진과 **완전히 별도 계층**(`biasPatternEngine`, additive)이다. 기존 벡터·construct·gates·classifyMainType의 입력이나 라우팅 지문에 **아무 값도 주입하지 않는다**. (현재 `storyInsight`·`profileContext`·`narrativeSeed`가 쓰는 "엔진은 절대 읽지 않는다" 패스스루 계약과 동일 — [session.ts:322-348](../../src/components/careerCompassV2/session.ts), [storyInsight.ts:9](../../src/lib/storyInsight.ts).)
3. 유료 파이프라인·`FreeContext`·`paidAnswers`·QStash·runner·`result_json`을 변경하지 않는다. `CareerPatternProfile`은 (기본값) **무료 화면 전용**이며 유료로 넘기지 않는다.
4. **단일 응답 하나로 유형을 확정하지 않는다** — 모든 primary 확정은 ①점수 임계 + ②판별 증거(discriminator) 존재 + ③2위와의 마진, 세 조건을 모두 요구한다(§6).
5. 임상 진단 어투 금지. 무료 화면 카피는 §11 원칙만 사용한다.

---

## 1. 타입 정의

```ts
type PatternCategory =
  | 'instinctTrap'        // A. 본능의 덫
  | 'cognitiveOverload'   // B. 인지 과부하
  | 'avoidance'           // C. 회피 행동
  | 'identityConfusion';  // D. 정체성 혼란

type PatternId =
  // A. instinctTrap
  | 'lossAversion' | 'endowmentEffect' | 'sunkCost' | 'ambiguityAversion'
  // B. cognitiveOverload
  | 'maximizer' | 'anticipatedRegret' | 'analysisParalysis' | 'noSelectionCriteria'
  // C. avoidance
  | 'productiveProcrastination' | 'movingGoalposts' | 'experimentAvoidance'
  // D. identityConfusion
  | 'liminality' | 'tyrannyOfShoulds' | 'identityForeclosure' | 'impostor' | 'lowSelfEfficacy';

type CareerPatternProfile = {
  primaryPattern: PatternId;
  secondaryPattern?: PatternId;
  category: PatternCategory;
  confidence: 'low' | 'medium' | 'high';
  evidenceCodes: string[];      // 판정에 기여한 신호 토큰(감사·튜닝·재현용)
  version: 'pattern-v1';
};

// primary가 확정되지 않을 때(§7)
type CareerPatternResult =
  | CareerPatternProfile
  | { kind: 'categoryOnly'; category: PatternCategory; confidence: 'low'; evidenceCodes: string[]; version: 'pattern-v1' }
  | { kind: 'insufficient_signal'; evidenceCodes: string[]; version: 'pattern-v1' };
```

`CATEGORY_OF: Record<PatternId, PatternCategory>` — 16개를 위 4범주로 고정 매핑(A 4개 / B 4개 / C 3개 / D 5개).

---

## 2. 증거 코드(evidenceCodes) 네임스페이스

분류기는 원본 응답을 **불린 증거 코드 집합**으로 평탄화한 뒤 규칙을 적용한다. 코드는 문자열 토큰으로 그대로 `evidenceCodes`에 담겨 재현·튜닝을 가능케 한다.

### 2.1 기존 문항에서 얻는 코드 (엔진 미변경 — 원답변만 재읽기)

| 코드 | 출처 문항/필드 | 근거 |
|---|---|---|
| `csMain:cs_between` `csMain:cs_many` `csMain:cs_stay` `csMain:cs_rest` `csMain:cs_expand` | `cs_main` | [careerQuestionFlow.ts:30-39](../../src/data/careerQuestionFlow.ts) |
| `arNarrow:nr_loss` `nr_safety` `nr_continuity` `nr_explore` `nr_unsure` `nr_decided` | `ar_narrow` | [careerQuestionFlow.ts:83-88](../../src/data/careerQuestionFlow.ts) |
| `blocker:blk_eyes` `blk_fail` `blk_time` `blk_confidence` `blk_unclear` `blk_money` | `cs_blocker` | [careerQuestionFlow.ts:348-353](../../src/data/careerQuestionFlow.ts) |
| `sc:sc_market_only` `sc:sc_self_only` `sc:sc_unsure` `sc:sc_both` | `sc_outlook` | [careerQuestionFlow.ts:177-182](../../src/data/careerQuestionFlow.ts) |
| `opt:rc_opt_many` `rc_opt_few` `rc_opt_several` | `rc_options` | [careerQuestionFlow.ts:201-206](../../src/data/careerQuestionFlow.ts) |
| `val:rc_val_none` `rc_val_early` | `rc_validation` | [careerQuestionFlow.ts:271-276](../../src/data/careerQuestionFlow.ts) |
| `cx:optionOverloadHigh` `cx:valueConflictPresent` `cx:marketInfoGapHigh` `cx:selfEfficacyLow` `cx:outcomeExpectationHigh` `cx:goalClarityLow` `cx:executionDriveLow` | ConstructProfile(이미 산출됨) | [resultContextEngine.ts:107-131](../../src/lib/resultContextEngine.ts) 동일 임계 재사용 |
| `gate:runwayTight` `gate:riskNone` `gate:energyLow` | ReadinessGates | [careerQuestionFlow.ts:458-469](../../src/data/careerQuestionFlow.ts) |
| `values:cvValuesMany` | `cv_values` ≥ 4 | [resultContextEngine.ts:135](../../src/lib/resultContextEngine.ts) |
| `tension:<pair>` | `cv_priorities` 상위 2개 상충 | [storyInsight.ts:38-51](../../src/lib/storyInsight.ts) TENSION_PAIRS |
| `profile:careerTransition` | totalCareerStage − currentFieldStage ≥ 2 | [storyInsight.ts:59-60,179](../../src/lib/storyInsight.ts) |
| `stated:safetyTop+challengeExp` | `cv_priorities` 안정/회복 1위 ∧ `ap_experiment` 도전형 | [storyInsight.ts:70-71](../../src/lib/storyInsight.ts) |

### 2.2 신규 문항에서 얻는 코드 (판별 전용 — effect-free 추가)

| 코드 | 출처(신규) |
|---|---|
| `q1:sunkCost` `q1:endowment` `q1:lossAversion` `q1:none` | Q1 |
| `q2:analysisParalysis` `q2:ambiguity` `q2:experimentAvoidance` `q2:procrastination` `q2:acting` | Q2 |
| `q3:impostor` `q3:lowEfficacy` `q3:healthy` `q3:unknown` | Q3 |
| `q4:closedEarly` `q4:inBetween` `q4:open` | Q4 |

**신규 문항은 전부 effect-free**(scoreEffects/constructEffects 비움)로 추가한다 → 벡터·construct·gates·mainType 완전 불변(§0-2, §12). `ar_narrow`/`cs_blocker`가 이미 이 방식으로 안전하게 공존 중.

---

## 3. 신규 판별 문항 (감사 Q1~Q3 + 보강 Q4)

### Q1 — "놓기 어려운 것의 정체" (손실회피/소유효과/매몰비용 분리)
- 문구: "지금 결정을 미루게 하는 '아까움'에 가장 가까운 것은?"
- 형식: single_select
- 옵션: a "지금까지 들인 시간·노력이 아까워서"(`q1:sunkCost`) / b "지금 가진 것(직함·안정·관계)을 넘기는 게 아까워서"(`q1:endowment`) / c "무엇을 고르든 다른 하나를 잃는 게 두려워서"(`q1:lossAversion`) / d "특별히 아까운 건 없다"(`q1:none`)
- 해소 충돌: 손실회피 vs 소유효과, 소유효과 vs 매몰비용

### Q2 — "행동을 미루는 진짜 이유" (분석마비/모호성회피/실험회피/생산적지연 분리)
- 문구: "'작게라도 한번 해보기'를 아직 안 한 이유에 가장 가까운 것은?"
- 형식: single_select
- 옵션: a "정보를 더 모으면 답이 나올 것 같아 계속 알아보는 중"(`q2:analysisParalysis`) / b "결과가 어떻게 될지 몰라 시작이 망설여진다"(`q2:ambiguity`) / c "잘못될까 두려워 내보내지 못한다"(`q2:experimentAvoidance`) / d "다른 급한 일들 때문에 손을 못 댄다"(`q2:procrastination`) / e "이미 작게 해보고 있다"(`q2:acting`)
- 해소 충돌: 극대화 vs 분석마비, 분석마비 vs 선택기준부재, 생산적지연 vs 실험회피, (부분) 손실회피 vs 모호성회피

### Q3 — "확신의 근거" (가면증후군/저효능 분리)
- 문구: "지금까지의 성과나 인정에 대해 가장 가까운 느낌은?"
- 형식: single_select
- 옵션: a "좋은 평가를 받아도 '운이 좋았을 뿐'이라는 생각이 든다"(`q3:impostor`) / b "아직 내세울 만한 성과 자체가 부족하다고 느낀다"(`q3:lowEfficacy`) / c "성과도 있고 그만큼 내 실력이라 느낀다"(`q3:healthy`) / d "잘 모르겠다"(`q3:unknown`)
- 해소 충돌: 가면증후군 vs 자기효능감부족

### Q4 — "방향에 대한 지금 태도" (리미널리티/정체성 조기결정 분리) — **감사 미제안, 최소 보강 1개**
감사 §9는 리미널리티(#12)·정체성 조기결정(#14)이 Q1~Q3 밖이라 별도 "탐색 개방/폐쇄" 문항이 필요하다고 명시했다. 이를 최소 1문항으로 보강한다.
- 문구: "지금 방향에 대한 태도에 가장 가까운 것은?"
- 형식: single_select
- 옵션: a "방향은 이미 정했고, 다른 가능성은 별로 안 본다"(`q4:closedEarly`) / b "예전 방향은 놓았는데 새 방향은 아직 안 잡혔다"(`q4:inBetween`) / c "여러 가능성을 아직 열어두고 살펴보는 중"(`q4:open`) / d "특별히 해당 없다"
- 해소 충돌: 리미널리티 vs 정체성 조기결정, (부분) 당위적 사고 vs 정체성 조기결정

**총 추가 문항 = 4개** (감사 3 + 보강 1). 남는 충돌은 §5·§9.

---

## 4. 유형별 규칙 (16개)

표기: `+n`=positive(점수), `−n`=negative, `VETO`=배제(해당 시 이 유형 후보 제외), **D**=discriminator(이 코드가 있어야 `high` 가능). 점수 기준(§6): LOW_MIN=2, MED_MIN=3, HIGH_MIN=5.

각 유형에 대해 [1]최소 관찰 신호 [2]기존 문항 신호 [3]부족 신호 [4]인접 구별 핵심 [5]positive [6]negative [7]배제 [8]최소점수 [9]primary/secondary 규칙(§6 공통) [10]confidence 규칙(§6 공통)을 정의한다. [9][10]은 전 유형 공통이라 §6에 두고, 아래는 [1]~[8].

### A. 본능의 덫

**A1. lossAversion (손실 회피)**
- [1] 손실을 이득보다 크게 가중, 대상이 특정되지 않은 "잃는 두려움".
- [2] `arNarrow:nr_loss`, `arNarrow:nr_safety`, `blocker:blk_fail`, `gate:riskNone`.
- [3] 손실 대상(돈/정체성/관계)·이득 대비 가중 크기.
- [4] vs 소유효과=대상이 *현재 보유물*이면 endowment(Q1:b). vs 모호성회피=불확실성 자체가 문제면 ambiguity(Q2:b/Q1이 c 아님).
- [5] **D** `q1:lossAversion`(+3); `arNarrow:nr_loss`(+2); `arNarrow:nr_safety`(+2); `blocker:blk_fail`(+1); `gate:riskNone`(+1).
- [6] `q1:sunkCost`(−2), `q1:endowment`(−2).
- [7] VETO: `q1:none` 단독이며 다른 positive 없음.

**A2. endowmentEffect (소유 효과)**
- [1] *소유했다는 사실 자체*로 현재 보유물을 과대평가.
- [2] (전용 신호 없음 — 기존 문항으로는 매몰비용/손실회피에 흡수됨. 감사 §2에서 C.)
- [3] "내 것이라 놓기 싫다" vs "투자가 아까워"의 시제/대상 구분.
- [4] vs 매몰비용=과거 투자면 sunkCost(Q1:a). vs 손실회피=미래 이득/손실 가중이면 lossAversion(Q1:c).
- [5] **D** `q1:endowment`(+3); `arNarrow:nr_continuity`(+1, 보조).
- [6] `q1:sunkCost`(−2), `q1:lossAversion`(−2).
- [7] VETO: `q1:endowment` 부재 → endowment는 **primary 불가**(§9: Q1 없으면 최대 low·secondary만).

**A3. sunkCost (매몰비용)**
- [1] 과거 회수불가 투자가 잔류를 강제.
- [2] `arNarrow:nr_continuity`(직접), `cx`(expertiseHigh & assetLeverageLow → careerCapitalAnxiety) [resultContextEngine.ts:131](../../src/lib/resultContextEngine.ts).
- [3] 투자가 *앞으로의 선택*을 잡는 강도.
- [4] vs 소유효과=대상이 현재 보유물이면 endowment(Q1:b). vs 손실회피=미래 손실 가중이면 lossAversion.
- [5] **D** `q1:sunkCost`(+3); `arNarrow:nr_continuity`(+2); `cx:careerCapitalAnxiety`(+1).
- [6] `q1:endowment`(−2), `q1:lossAversion`(−1).
- [7] VETO: 없음(nr_continuity 단독이면 low로 후보 유지).

**A4. ambiguityAversion (모호성 회피)**
- [1] 불확실성 *자체*를 회피(확률 미상이라 회피).
- [2] `arNarrow:nr_unsure`(단, 현재는 검증형으로 코딩됨 [solutionModuleEngine.ts:292](../../src/lib/solutionModuleEngine.ts)), `blocker:blk_fail`.
- [3] "확률 몰라 회피" vs "검증만 하면 감"의 분리.
- [4] vs 손실회피=구체적 손실이면 lossAversion. vs 예기된 후회=미래 후회 시뮬레이션이면 anticipatedRegret.
- [5] **D** `q2:ambiguity`(+3); `arNarrow:nr_unsure`(+1, 약); `blocker:blk_fail`(+1).
- [6] `q2:acting`(−2).
- [7] VETO: `q2:ambiguity` 부재 → primary 불가(기존 nr_unsure만으로는 검증형과 구별 불가 → 최대 low).

### B. 인지 과부하

**B1. maximizer (극대화자의 함정)**
- [1] 최선 추구·만족화 실패로 못 닫음.
- [2] `arNarrow:nr_explore`, `opt:rc_opt_many`, `cx:optionOverloadHigh`, `values:cvValuesMany`.
- [3] "더 나은 게 있을까"(불안) vs "다 재밌어"(열정) 동기 구분.
- [4] vs 분석마비=조사 반복이면 analysisParalysis(Q2:a). vs 선택기준부재=기준 자체 없음이면 noSelectionCriteria(cs_between/goalClarityLow).
- [5] `arNarrow:nr_explore`(+2); `opt:rc_opt_many`(+2); `cx:optionOverloadHigh`(+1); `values:cvValuesMany`(+1). **D** = (`arNarrow:nr_explore` ∧ `q2:acting`아님) 조합 또는 (`opt:rc_opt_many` ∧ `cx:optionOverloadHigh`).
- [6] `q2:analysisParalysis`(−1: 그건 분석마비쪽), `csMain:cs_between`(−1: 기준부재쪽).
- [7] VETO: 없음.

**B2. anticipatedRegret (예기된 후회)**
- [1] *미래 후회 시뮬레이션*이 회피를 유발.
- [2] (전용 신호 없음. `arNarrow:nr_loss`가 표층 근사이나 손실회피로 흡수 — 감사 §2 C.)
- [3] 전향적 후회 예상 문항(현재는 현재 상태만 측정).
- [4] vs 손실회피=현재 손실 두려움이면 lossAversion. vs 모호성회피=확률 미상이면 ambiguity.
- [5] (v1 전용 D 없음) `arNarrow:nr_loss`(+1) ∧ `blocker:blk_fail`(+1) 동반 시에만 약한 후보.
- [6] `q1:lossAversion`(−1: 그건 손실회피 확정).
- [7] VETO: 전용 신호 부재 → **primary 불가**(§7: 항상 최대 low/secondary). v1에서 사실상 미분류(§9 잔여).

**B3. analysisParalysis (분석 마비)**
- [1] 과도한 분석이 행동을 막음(기준은 있으나 정보 계속 수집).
- [2] `cx:marketInfoGapHigh` ∧ `cx:executionDriveLow`(researchLoop 근사 — 단 `recentBehaviorResearching`는 코드상 미세팅 [subtypeFunctions.ts:56,273](../../src/lib/subtypeFunctions.ts)).
- [3] "조사만 반복하고 실행 안 함" 반복 행동.
- [4] vs 극대화=최선 추구·옵션 열어둠이면 maximizer(nr_explore). vs 선택기준부재=기준 자체 없음이면 noSelectionCriteria(goalClarityLow ∧ cs_between).
- [5] **D** `q2:analysisParalysis`(+3); `cx:marketInfoGapHigh`(+1); `cx:executionDriveLow`(+1).
- [6] `csMain:cs_between`(−2: 기준부재), `cx:goalClarityLow`(−1).
- [7] VETO: `cx:goalClarityLow` ∧ `csMain:cs_between` 동시(그건 기준부재) ∧ `q2:analysisParalysis` 부재.

**B4. noSelectionCriteria (선택 기준 부재)**
- [1] 결정 기준 자체가 없음.
- [2] `csMain:cs_between`(직접), `cx:goalClarityLow`, `cx:valueConflictPresent`, `opt:rc_opt_several`.
- [3] cs_main 단일선택이라 cs_stay 선택 시 신호 소실(감사).
- [4] vs 분석마비=기준은 있고 정보 수집이면 analysisParalysis(Q2:a ∧ ¬goalClarityLow). vs 극대화=옵션 과잉·열어둠이면 maximizer.
- [5] **D** `csMain:cs_between`(+3); `cx:goalClarityLow`(+2); `cx:valueConflictPresent`(+1); `opt:rc_opt_several`(+1).
- [6] `q2:analysisParalysis`(−1).
- [7] VETO: 없음.

### C. 회피 행동

**C1. productiveProcrastination (생산적 지연)**
- [1] 바쁜 일로 진짜 결정 회피.
- [2] `blocker:blk_time`.
- [3] "바쁨이 회피인가 실제 제약인가" 구분.
- [4] vs 실험회피=두려워 못 내보냄이면 experimentAvoidance(Q2:c). vs 목표점이동=기준 계속 상향이면 movingGoalposts(종단 필요).
- [5] **D** `q2:procrastination`(+3); `blocker:blk_time`(+2).
- [6] `q2:experimentAvoidance`(−2), `q2:acting`(−2).
- [7] VETO: `q2:acting`.

**C2. movingGoalposts (목표점 이동)**
- [1] 기준을 계속 올림/재정의 — **시간축 반복 측정이 본질**.
- [2] (단일 세션 신호 없음 — 원리상 불가.)
- [3] 30일 후 재평가 종단 비교("지난달 기준이 또 올라갔는가").
- [4] 단일 세션에서는 어떤 유형과도 못 가름.
- [5] (v1 단일 세션 D 없음.) 종단 신호(`followup:criteriaRaised`)는 [careerCompassFollowUp30d.ts](../../src/lib/careerCompassFollowUp30d.ts) 종단 데이터에서만.
- [6] —
- [7] VETO: 단일 세션 → **항상 미분류**(§7 insufficient 또는 category). v1 범위 밖(§9 잔여, 종단 확장 대상).

**C3. experimentAvoidance (실험 회피)**
- [1] 테스트·행동 자체를 거부.
- [2] `val:rc_val_none`(혼자 생각만) ∧ 방향 존재, `ap_experiment=ap_unsure`, `gate:riskNone`.
- [3] "방향 없어서" vs "있는데 안 내보냄" 구분.
- [4] vs 생산적지연=바빠서면 productiveProcrastination(blk_time/Q2:d). vs 방향 없음=lowOptionVisibility(기존 엔진).
- [5] **D** `q2:experimentAvoidance`(+3); `val:rc_val_none`(+1); `gate:riskNone`(+1).
- [6] `q2:procrastination`(−1), `q2:acting`(−2).
- [7] VETO: `q2:acting`.

### D. 정체성 혼란

**D1. liminality (리미널리티)**
- [1] 정체성 전환 *중간 상태*(옛 정체성 놓음, 새것 미형성).
- [2] `csMain:cs_stay`/`cs_rest`, `profile:careerTransition`.
- [3] "낡은 정체성 떠남 + 새것 미형성" 상태 문항.
- [4] vs 조기결정=방향 확정·닫음이면 identityForeclosure(Q4:a). vs 번아웃=에너지 고갈이면 기존 overloadedBurnout(엔진).
- [5] **D** `q4:inBetween`(+3); `csMain:cs_stay`(+1); `profile:careerTransition`(+1).
- [6] `q4:closedEarly`(−2), `q4:open`(−1).
- [7] VETO: `q4:closedEarly`.

**D2. tyrannyOfShoulds (당위적 사고)**
- [1] 외부 "해야 한다"·타인 기대에 지배.
- [2] `blocker:blk_eyes`(직접), `stated:safetyTop+challengeExp`(허락 안 한 욕구 — 약).
- [3] 누구의 기대인지·내면화 정도.
- [4] vs 조기결정=탐색 없이 확정이면 identityForeclosure(Q4:a). 둘 다면(blk_eyes ∧ q4:closedEarly) → shoulds가 primary, foreclosure secondary.
- [5] **D** `blocker:blk_eyes`(+3); `stated:safetyTop+challengeExp`(+1).
- [6] —
- [7] VETO: 없음.

**D3. identityForeclosure (정체성 조기 결정)**
- [1] 탐색 없이 조기 확정.
- [2] `arNarrow:nr_decided`(단 storyInsight/friction에서 배제됨 [storyInsight.ts:81](../../src/lib/storyInsight.ts)), `cx`(curiosityLow).
- [3] "탐색을 건너뛰고 확정했는가" 신호.
- [4] vs 리미널=중간상태 개방이면 liminality(Q4:b). vs 당위=외부 기대 주도면 tyrannyOfShoulds(blk_eyes).
- [5] **D** `q4:closedEarly`(+3); `arNarrow:nr_decided`(+1); `cx:curiosityLow`(+1).
- [6] `q4:inBetween`(−2), `q4:open`(−2).
- [7] VETO: `q4:open`.

**D4. impostor (가면 증후군)**
- [1] 유능함에도 사기꾼 느낌(성취를 운으로 귀인).
- [2] (전용 신호 없음 — 저효능과 분리 불가, 감사 §2 C.)
- [3] "*객관적 유능함에도 불구하고*" 귀인 왜곡.
- [4] vs 저효능=실제 경험 부족·전반적 무능감이면 lowSelfEfficacy(Q3:b).
- [5] **D** `q3:impostor`(+3); (보조) `sc:sc_market_only`(+1, "외부결과 낙관+자기 회의" 패턴일 때만).
- [6] `q3:lowEfficacy`(−2), `q3:healthy`(−2).
- [7] VETO: `q3:impostor` 부재 → **primary 불가**(§9: Q3 없으면 lowSelfEfficacy로 흡수, 최대 low·secondary).

**D5. lowSelfEfficacy (자기효능감 부족)**
- [1] 실행할 수 없다는 믿음.
- [2] `sc:sc_market_only`, `sc:sc_unsure`, `blocker:blk_confidence`, `cx:selfEfficacyLow`(SCCT 핵심 construct).
- [3] 전반 vs 특정영역 효능 구분.
- [4] vs 가면증후군=성취에도 운 귀인이면 impostor(Q3:a).
- [5] `cx:selfEfficacyLow`(+2); `sc:sc_market_only`(+2); `blocker:blk_confidence`(+2); `sc:sc_unsure`(+1); (보강) `q3:lowEfficacy`(+2). **D** = `cx:selfEfficacyLow` 또는 `q3:lowEfficacy`.
- [6] `q3:impostor`(−2), `q3:healthy`(−2), `sc:sc_both`(−1).
- [7] VETO: `sc:sc_both` ∧ 다른 positive 없음.

---

## 5. 충돌쌍 판별 조건식 (결정론적)

`E`=evidenceCodes 집합. `has(x)` = x ∈ E. 각 조건은 두 유형의 점수 계산 전에 적용되는 **판별 게이트**로도, 동점 시 타이브레이커로도 쓴다.

```
// 1) 손실회피 vs 소유효과
if has('q1:endowment'):        lossAversion −= veto-ish; endowment = primary-eligible
elif has('q1:lossAversion') || has('arNarrow:nr_loss') || has('arNarrow:nr_safety'):
                                lossAversion > endowment
else:                           endowment 불가(§4 A2 VETO) → lossAversion만 후보(있으면)

// 2) 소유효과 vs 매몰비용  (시제로 가름)
if has('q1:sunkCost') || has('arNarrow:nr_continuity'):  sunkCost > endowment
elif has('q1:endowment'):                                 endowment > sunkCost
else:                                                     둘 다 low 이하

// 3) 손실회피 vs 모호성회피  (대상 vs 불확실성)
if has('q2:ambiguity'):                                   ambiguityAversion 우선
elif has('q1:lossAversion') || has('arNarrow:nr_loss'):   lossAversion 우선
elif has('arNarrow:nr_unsure') && !has('q2:ambiguity'):   → 기존 검증형으로 흡수, 둘 다 low

// 4) 극대화 vs 분석마비  (옵션 열어둠 vs 정보 수집 반복)
if has('q2:analysisParalysis'):                           analysisParalysis 우선
elif has('arNarrow:nr_explore') || (has('opt:rc_opt_many') && has('cx:optionOverloadHigh')):
                                                          maximizer 우선

// 5) 분석마비 vs 선택기준부재  (기준 있음 vs 없음)
if has('csMain:cs_between') || has('cx:goalClarityLow'):  noSelectionCriteria 우선
elif has('q2:analysisParalysis') && !has('cx:goalClarityLow'): analysisParalysis 우선

// 6) 생산적지연 vs 목표점이동  (단일세션에서 movingGoalposts 불가)
movingGoalposts = insufficient (단일 세션)  // 종단 followup 전까지 항상
if has('q2:procrastination') || has('blocker:blk_time'):  productiveProcrastination

// 7) 생산적지연 vs 실험회피  (바빠서 vs 두려워서)
if has('q2:experimentAvoidance'):                         experimentAvoidance 우선
elif has('q2:procrastination') || has('blocker:blk_time'): productiveProcrastination 우선

// 8) 리미널리티 vs 정체성 조기결정  (개방 중간 vs 조기 폐쇄)
if has('q4:closedEarly'):                                 identityForeclosure 우선
elif has('q4:inBetween') || has('csMain:cs_stay'):        liminality 우선

// 9) 당위적사고 vs 정체성 조기결정  (외부기대 vs 조기폐쇄)
if has('blocker:blk_eyes') && has('q4:closedEarly'):      primary=tyrannyOfShoulds, secondary=identityForeclosure
elif has('blocker:blk_eyes'):                             tyrannyOfShoulds
elif has('q4:closedEarly'):                               identityForeclosure

// 10) 가면증후군 vs 자기효능감부족  (성취 운귀인 vs 실제 무능감)
if has('q3:impostor'):                                    impostor 우선
elif has('q3:lowEfficacy') || has('cx:selfEfficacyLow') || has('blocker:blk_confidence'):
                                                          lowSelfEfficacy 우선
```

**요약**: Q1이 쌍 1·2, Q2가 쌍 4·5·7 및 (부분)3, Q3가 쌍 10, Q4가 쌍 8·9를 결정론적으로 해소한다. 쌍 6의 movingGoalposts와 유형 anticipatedRegret은 §9의 잔여(단일 세션 원리상 불가).

---

## 6. primary / secondary / confidence 산출 규칙 (전 유형 공통)

```
1. 각 PatternId의 점수 = Σ(positive 코드 가중) + Σ(negative 코드 가중).  VETO 유형은 후보에서 제외.
2. eligible = 점수 ≥ LOW_MIN(2) 인 유형들.
3. primary = eligible 중 최고 점수. 동점이면 §5 판별식 → 그래도 동점이면
   카테고리 우선순위(instinctTrap > cognitiveOverload > avoidance > identityConfusion) 아님,
   대신 'discriminator 보유 유형 우선' → 그다음 PatternId 사전순(결정론 보장).
4. secondary = primary 제외 최고 점수 유형. 단 (primaryScore − secondaryScore) < MARGIN_MED(1)
   이고 secondaryScore ≥ MED_MIN(3)일 때만 노출. 아니면 secondary 생략.
5. confidence:
   - high    : primaryScore ≥ HIGH_MIN(5)  AND primary가 자신의 D(discriminator) 코드 1개 이상 보유
               AND (primaryScore − secondaryScore) ≥ MARGIN_HIGH(2).
   - medium  : primaryScore ≥ MED_MIN(3)   AND (D 보유 OR margin ≥ MARGIN_MED(1)).
   - low     : primaryScore ≥ LOW_MIN(2) 이지만 D 미보유 이고 margin < MARGIN_MED.
6. category = CATEGORY_OF[primaryPattern].
7. version = 'pattern-v1'. evidenceCodes = 판정에 기여한 코드 전체(양·음 포함).
```

**단일 응답 확정 금지 보장**: `high`는 D(판별 문항 등) + 점수 ≥5 + 마진 ≥2를 **모두** 요구 → 어떤 단일 옵션도 5점을 못 만들므로(최대 D=3) 반드시 2개 이상 신호가 필요하다. `medium`도 D(3점)만으로는 마진 조건 또는 보조 신호가 필요.

---

## 7. Fallback 규칙 (낮은 신뢰도·신호 부족)

낮은 신뢰도에서 특정 16유형을 억지로 반환하지 않는다.

```
if eligible == ∅ (모든 유형 < LOW_MIN):
    // 범주 수준 신호만 집계
    categoryScore[c] = Σ(그 범주 소속 유형들의 raw positive)
    topCat = argmax categoryScore
    if categoryScore[topCat] ≥ 2:
        return { kind:'categoryOnly', category: topCat, confidence:'low', evidenceCodes, version }
    else:
        return { kind:'insufficient_signal', evidenceCodes, version }

elif confidence(primary) == 'low' AND secondary 없음 AND primary가 D 미보유:
    // 유형은 뜨지만 신뢰가 낮음 → 유형명 대신 범주만
    return { kind:'categoryOnly', category: CATEGORY_OF[primary], confidence:'low', evidenceCodes, version }
```

- **movingGoalposts / anticipatedRegret**는 §4에서 primary 불가로 설계돼, 단독으로는 절대 primaryPattern이 되지 않고 위 fallback으로 흘러간다(억지 반환 금지).
- endowment / ambiguityAversion / impostor는 각 D(Q1:b / Q2:b / Q3:a)가 없으면 primary 불가 → 인접 유형(sunkCost·lossAversion / lossAversion / lowSelfEfficacy)이나 category로 폴백.

---

## 8. 시뮬레이션 (22개 가상 프로필)

각 프로필은 응답에서 유도된 evidenceCodes로 표기(핵심만). 규칙(§4~§7) 적용 결과.

| # | 프로필(핵심 응답) | 기대 유형 | 실제 primary | secondary | conf | 오분류? |
|---|---|---|---|---|---|---|
| 1 | `q1:sunkCost`+`arNarrow:nr_continuity`+`cx:careerCapitalAnxiety` | 매몰비용 | sunkCost(3+2+1=6) | — | **high** | 아니오 |
| 2 | `q1:endowment`+`arNarrow:nr_continuity` | 소유효과 | endowment(3+1=4) | sunkCost(0+2=2, margin2≥1? 4−2=2) → 생략(sec<3) | **medium** | 아니오 |
| 3 | `q1:lossAversion`+`arNarrow:nr_safety`+`gate:riskNone` | 손실회피 | lossAversion(3+2+1=6) | — | **high** | 아니오 |
| 4 | `arNarrow:nr_continuity`만(Q1 미응답) | 매몰비용(약) | sunkCost(2) | — | **low** | 아니오(범주 폴백 가능) |
| 5 | `arNarrow:nr_loss`만(Q1 없음) | 손실회피 vs 소유효과 미상 | lossAversion(2) | — | **low** | 경계(대상 미상 → low가 정직) |
| 6 | `q2:analysisParalysis`+`cx:marketInfoGapHigh` | 분석마비 | analysisParalysis(3+1=4) | — | **medium** | 아니오 |
| 7 | `q2:analysisParalysis`+`csMain:cs_between`+`cx:goalClarityLow` | 분석마비 vs 기준부재 | noSelectionCriteria(3+2=5; analysis 3−2−1=0) | — | **high** | 아니오(§5-5: 기준부재 우선) |
| 8 | `csMain:cs_between`+`cx:goalClarityLow`+`cx:valueConflictPresent` | 선택기준부재 | noSelectionCriteria(3+2+1=6) | — | **high** | 아니오 |
| 9 | `arNarrow:nr_explore`+`opt:rc_opt_many`+`cx:optionOverloadHigh` | 극대화 | maximizer(2+2+1=5, D=조합) | — | **high** | 아니오 |
| 10 | `opt:rc_opt_many`+`cx:optionOverloadHigh`+`q2:analysisParalysis` | 극대화 vs 분석마비 | analysisParalysis(3+1=4; max 2+1−1=2) | maximizer(2, sec<3 생략) | **medium** | 아니오(§5-4) |
| 11 | `q2:experimentAvoidance`+`val:rc_val_none` | 실험회피 | experimentAvoidance(3+1=4) | — | **medium** | 아니오 |
| 12 | `blocker:blk_time`+`q2:procrastination` | 생산적지연 | productiveProcrastination(3+2=5) | — | **high** | 아니오 |
| 13 | `blocker:blk_time`만(Q2 없음) | 생산적지연 vs 제약 | productiveProcrastination(2) | — | **low** | 경계(제약과 미구분 → low 정직) |
| 14 | `q3:impostor`+`sc:sc_market_only` | 가면증후군 | impostor(3+1=4) | — | **medium** | 아니오 |
| 15 | `sc:sc_market_only`+`blocker:blk_confidence`+`cx:selfEfficacyLow` (Q3 없음) | 저효능(가면 아님) | lowSelfEfficacy(2+2+2=6) | — | **high** | 아니오(§5-10: 가면은 D 없어 불가) |
| 16 | `q3:lowEfficacy`+`sc:sc_unsure` | 저효능 | lowSelfEfficacy(2+1=3) | — | **medium** | 아니오 |
| 17 | `blocker:blk_eyes`+`stated:safetyTop+challengeExp` | 당위적사고 | tyrannyOfShoulds(3+1=4) | — | **medium** | 아니오 |
| 18 | `blocker:blk_eyes`+`q4:closedEarly`+`cx:curiosityLow` | 당위+조기결정 | tyrannyOfShoulds(3) | identityForeclosure(3+1=4)… | **재계산 아래** | ⚠ 주의 |
| 19 | `q4:closedEarly`+`arNarrow:nr_decided`+`cx:curiosityLow` | 정체성 조기결정 | identityForeclosure(3+1+1=5) | — | **high** | 아니오 |
| 20 | `q4:inBetween`+`csMain:cs_stay`+`profile:careerTransition` | 리미널리티 | liminality(3+1+1=5) | — | **high** | 아니오 |
| 21 | `blocker:blk_unclear`만 | (신호 약) | eligible ∅ | — | — | **insufficient_signal** 반환 |
| 22 | `arNarrow:nr_loss`+`blocker:blk_fail`(후회 근사, Q없음) | 예기된후회? | anticipatedRegret은 primary 불가 → lossAversion(2+1=3) | — | **low→categoryOnly(instinctTrap)** | 의도된 폴백(억지 반환 금지) |

**#18 재계산(쌍 9 처리)**: §5-9에 따라 `blk_eyes ∧ q4:closedEarly`면 primary=tyrannyOfShoulds, secondary=identityForeclosure로 **명시 지정**(점수와 무관하게 규칙 우선). 결과: primary=tyrannyOfShoulds, secondary=identityForeclosure, conf=medium(D=blk_eyes 보유, margin 규칙은 규칙-지정으로 우회하되 secondary 노출). → 오분류 아님(설계된 공존 표기).

**시뮬레이션 요약**: 22개 중 오분류 0. High 8, Medium 6, Low 3(#4·5·13 — 판별 문항 미응답 시 정직하게 low), insufficient/categoryOnly 2(#21·22), 규칙-공존 1(#18). Low·폴백 케이스는 전부 "판별 신호 부재"라는 정직한 결과이지 오분류가 아니다.

---

## 9. 남는 불가·저신뢰 유형 (정직한 한계)

| 유형 | 상태 | 이유 | 필요 |
|---|---|---|---|
| **movingGoalposts** | v1 **미분류** | 시간축 반복이 본질 — 단일 세션 원리상 불가 | 30일 followup 종단 비교([careerCompassFollowUp30d.ts]) |
| **anticipatedRegret** | v1 **저신뢰(primary 불가)** | 전향적 후회 시뮬레이션 전용 문항 없음 | Q1에 옵션 e "고르고 나서 후회할까봐 미리 걱정된다" 추가 시 medium 가능(선택) |
| endowmentEffect | Q1:b 있을 때만 medium+ | 전용 신호가 Q1에만 존재 | (해결됨: Q1 필수) |
| ambiguityAversion | Q2:b 있을 때만 medium+ | 기존 nr_unsure는 검증형 코딩 | (해결됨: Q2 필수) |
| impostor | Q3:a 있을 때만 medium+ | 저효능과 분리 불가 | (해결됨: Q3 필수) |
| liminality/identityForeclosure | Q4 있을 때 medium+ | 개방/폐쇄 신호 부재 | (해결됨: Q4 보강) |

**결론**: Q1~Q4 4문항 추가 시 **14/16 유형이 조건 충족 시 medium 이상** 판별 가능. movingGoalposts(종단 필요)·anticipatedRegret(전용 문항 미추가 시)만 v1에서 저신뢰/미분류로 정직하게 남긴다.

---

## 10. 무료 화면 카피 원칙

- 표준 표현(요청): **"현재 답변에서 가장 강하게 나타난 고민 패턴은 …입니다."**
- confidence별 어투:
  - high: "…패턴은 **○○**입니다." (유형명 노출 가능)
  - medium: "…패턴은 **○○**에 가까워 보여요." (완화 어투)
  - low / categoryOnly: 유형명 대신 **범주**만 — "지금은 '○○(범주)' 쪽 고민이 가장 크게 보여요." (예: 인지 과부하)
  - insufficient_signal: 패턴 라벨 없이 — "아직 한 가지 패턴으로 좁히긴 이른 상태예요."
- 금지: 임상·진단 어투("당신은 X 증후군입니다"), 단정 헤드라인. 기존 방침과 정합([careerQuestionFlow.ts:10](../../src/data/careerQuestionFlow.ts) "no 'you are X'", [storyInsight.ts:1-3](../../src/lib/storyInsight.ts)).
- secondary 노출 시: "그다음으로는 ○○ 경향도 함께 보여요."

---

## 11. 최종 요약(요청 항목)

- **기존 문항으로 사용 가능한 신호**: `cs_main`(cs_between/cs_many/cs_stay), `ar_narrow`(6옵션), `cs_blocker`(6옵션), `sc_outlook`(SCCT), `rc_options`, `rc_validation`, ConstructProfile(optionOverload/valueConflict/marketInfoGap/selfEfficacy/goalClarity), gates(runway/risk/energy), `cv_values`/`cv_priorities`(TENSION), profile 경력전환. 전부 **원답변/기산출 construct 재읽기**(엔진 미변경).
- **추가할 최소 문항 수**: **4개**(Q1 아까움 대상 / Q2 미행동 이유 / Q3 확신 근거 / Q4 방향 개방·폐쇄). 전부 effect-free.
- **16개 분류 가능한 조건**: Q1~Q4 응답 + 해당 D(discriminator) 코드 보유 + 점수 ≥ MED_MIN + 마진 조건(§6). 이때 14/16이 medium 이상 도달.
- **여전히 불가/저신뢰**: movingGoalposts(종단 필요·v1 미분류), anticipatedRegret(전용 문항 없으면 저신뢰). endowment/ambiguity/impostor/liminality/foreclosure는 해당 신규 문항 응답이 없으면 저신뢰로 폴백.
- **구현 시 변경 파일(향후 대상)**: §12.
- **유료 파이프라인 무영향 구현 순서**: §12.

---

## 12. 향후 구현 대상 (이번 작업 아님 — 기록만)

### 변경 파일
| 파일 | 변경 성격 |
|---|---|
| `src/data/careerQuestionFlow.ts` | Q1~Q4를 **effect-free**(scoreEffects/constructEffects 비움)로 추가. `CAREER_QUESTION_FLOW` 배열 말미 삽입 |
| 신규 `src/lib/biasPatternEngine.ts` | 원답변+construct → evidenceCodes → `CareerPatternProfile`(§2·§4·§6·§7). 기존 엔진 import만, 역주입 없음 |
| 신규 `src/lib/biasPatternEngine.test.ts` | §8 22개 시뮬레이션을 node 실행형 테스트로 고정 |
| `src/types/careerCompass.ts` | `PatternId`/`PatternCategory`/`CareerPatternProfile` 타입 추가(순수 additive) |
| `src/components/careerCompassV2/session.ts` | `buildStoryInsight`처럼 additive 패스스루로 `careerPattern` 필드 부착(P2.0 라우팅 지문 불변 계약 유지) |
| 무료 결과 UI(`ResultSpineView.tsx`) | §10 카피 원칙으로 패턴/범주 티저 표시 |

### 무영향 구현 순서
1. 타입만 추가(`careerCompass.ts`) — 컴파일 영향 0.
2. `biasPatternEngine.ts` + 테스트 작성 → §8 시뮬레이션 통과 확인(순수 함수, 앱 미연결).
3. Q1~Q4를 effect-free로 추가 → 기존 vector/construct/gates/mainType 스냅샷 **불변** 회귀 테스트(기존 `session.test.ts` P2.0 라우팅 지문 그대로 통과해야 함).
4. `session.ts`에서 additive 패스스루로 `careerPattern` 부착(엔진·FreeContext 미변경).
5. 무료 UI에만 티저 렌더(§10).
6. **유료 계약 완전 불변**: `FreeContext`/`readFreeContext`/`paidAnswers`/`api/paid-*`/QStash/runner/`result_json` 미변경. `careerPattern`을 유료로 넘길지는 별도 결정(그 전까지 무료 화면 전용).

### 검증 게이트(구현 시)
- 신규 문항 추가 후 기존 결과 필드(mainType/subtype/friction/pullDirection/readiness) 스냅샷 diff 0.
- `api/paid-*`·`FreeContext`·`paidJobSession`·`PaidQuestionsView`·`PaidResultView` diff 0.
- §8 시뮬레이션 22개 결정론적 재현.
