# 신규 패턴 판별 문항(pt_hold·pt_delay·pt_confidence·pt_direction) 중복 감사 & 최소 문항 수 결정

- 날짜: 2026-07-13
- 성격: **코드·문항 수준 분석 문서만**. 코드는 변경하지 않았다(무변경 검증은 문서 말미).
- 근거: [free-career-pattern-coverage-audit.md](free-career-pattern-coverage-audit.md), [career-pattern-v1-spec.md](career-pattern-v1-spec.md), [career-pattern-v1-implementation-report.md](career-pattern-v1-implementation-report.md), 그리고 실제 코드([careerQuestionFlow.ts](../../src/data/careerQuestionFlow.ts):391-451, [biasPatternEngine.ts](../../src/lib/biasPatternEngine.ts) RULES).

## 0. 핵심 결론 (요약)

분류 엔진의 결정 규칙상 **한 패턴이 "구체 라벨(resolution='pattern', medium 이상)"이 되려면 그 패턴의 discriminator(D) 코드가 반드시 있어야 한다**([biasPatternEngine.ts:classifyFromEvidence] confidence 규칙). 따라서 각 신규 문항의 실제 가치 = "그 문항의 코드가 유일한 D인 패턴 수"로 정량화된다.

| 신규 문항 | 유일하게 구체 라벨을 여는 패턴 | 기존 대체 D | 판별 가치 | 사용자 체감 중복 |
|---|---|---|---|---|
| **pt_delay** (q2) | ambiguityAversion, analysisParalysis, productiveProcrastination, experimentAvoidance (4) | 없음 | **최상** | Medium(cs_blocker·rc_validation과 부분) |
| **pt_hold** (q1) | lossAversion, endowmentEffect, sunkCost (3) | 없음 | **상** | **High**(ar_narrow와 강한 의미 중복) |
| **pt_direction** (q4) | liminality, identityForeclosure (2) | 없음 | 중 | Medium(cs_main·ar_narrow와 부분) |
| **pt_confidence** (q3) | **impostor (1)** | lowSelfEfficacy는 `cx:selfEfficacyLow`로 이미 분류 | **하** | **High**(sc_outlook·cs_blocker(blk_confidence)와 3중 반복) |

→ **pt_confidence가 명백한 REMOVE 후보**(단 1개 패턴만 열고, 그 패턴 impostor는 커버리지 감사에서 가장 신뢰도 낮은 유형이며, 자신감 질문이 이미 2개 존재). pt_hold·pt_delay는 대체 불가한 고가치. pt_direction은 유지-경계.

**권장 총 무료 문항: 23개**(pt_confidence 제거) — 14개 분류가능 패턴 중 impostor 하나만 lowSelfEfficacy로 흡수, 나머지 13개 구체 라벨 유지. 더 축소하려면 22개(pt_direction도 제거, liminality/foreclosure를 category_only로 정직 폴백).

---

## 1. 실제 문항 비교 (코드 확인)

### 1.1 신규 4문항 (전부 effect-free: scoreEffects/constructEffects 비움 → 기존 scoring·resultContext 미사용)

| ID | 문구 | 옵션 → biasPatternEngine evidence code |
|---|---|---|
| `pt_hold` | "지금 결정을 미루게 하는 '아까움'에 가장 가까운 것은?" | 들인 시간·노력 아까움→`q1:sunkCost` / 지금 가진 것 넘기기 아까움→`q1:endowment` / 무엇을 고르든 잃는 게 두려움→`q1:lossAversion` / 없음→`q1:none` |
| `pt_delay` | "'작게라도 한번 해보기'를 아직 안 한 이유에 가장 가까운 것은?" | 정보 더 모으는 중→`q2:analysisParalysis` / 결과 몰라 망설임→`q2:ambiguity` / 잘못될까 두려움→`q2:experimentAvoidance` / 급한 일 때문→`q2:procrastination` / 이미 함→`q2:acting` |
| `pt_confidence` | "지금까지의 성과나 인정에 대해 가장 가까운 느낌은?" | 운이 좋았을 뿐→`q3:impostor` / 성과 자체 부족→`q3:lowEfficacy` / 내 실력이라 느낌→`q3:healthy` / 모름→`q3:unknown` |
| `pt_direction` | "지금 방향에 대한 태도에 가장 가까운 것은?" | 이미 정하고 안 봄→`q4:closedEarly` / 예전 놓고 새 방향 미정→`q4:inBetween` / 열어두고 살펴봄→`q4:open` / 해당없음→(코드 없음) |

### 1.2 의미가 겹치는 기존 문항 (실제 문구·코드)

| 기존 문항 | 문구 | 겹치는 신규 문항 | 겹치는 구성개념 |
|---|---|---|---|
| `ar_narrow` | "하나로 좁히지 못하는 가장 큰 이유는?" — nr_loss(어느 쪽 골라도 중요한 걸 잃는 느낌), nr_safety(돈·안정 때문), nr_continuity(쌓아온 경험과 연결), nr_explore(다 해보고 싶어), nr_unsure(될지 확신 없어), nr_decided(거의 정해짐) | **pt_hold** (loss≈nr_loss, endowment≈nr_safety/nr_continuity, sunk≈nr_continuity), **pt_direction**(closedEarly≈nr_decided) | **손실/포기 비용·방향 확정** — 거의 동일 축 |
| `cs_blocker` | "결정을 가장 미루게 만드는 건?" — blk_time(시간·에너지), blk_fail(되돌리기 어려울까 두려움), blk_confidence(잘 해낼 자신 없음), blk_eyes(주변 시선), blk_money(돈·현실), blk_unclear(뭘 원하는지 모름) | **pt_delay**(busy≈blk_time, fear≈blk_fail), **pt_confidence**(≈blk_confidence) | **미루는 이유·자신감** |
| `sc_outlook` | "새 방향 상상 시 가까운 쪽?" — sc_market_only(내가 해낼지 모르겠다=self-efficacy 약), sc_unsure(둘 다 확신 없음), sc_both, sc_self_only | **pt_confidence** | **자기효능감(SCCT)** — 직접 중복 |
| `rc_validation` | "실제 반응 확인 정도?" — rc_val_none(혼자 생각만), rc_val_early… | **pt_delay**(acting/experimentAvoidance≈rc_val_none) | **행동·검증 여부** |
| `cs_main` | "지금 가장 가까운 상태?" — cs_stay(계속할지 모름), cs_between(기준 안 섬), cs_many(하고 싶은 게 많음) | **pt_direction**(inBetween≈cs_stay), pt_delay(간접) | **결정 상태·방향** |
| `rc_options` | "떠오르는 선택지 정도?" — rc_opt_many(너무 많음), rc_opt_several | (pt_* 아님, maximizer 기존 D) | 선택지 과잉 |
| `cv_priorities` | 우선순위 랭킹 → TENSION_PAIRS(가치 충돌) | (pt_* 아님) | 가치 충돌 |

---

## 2. 신규 문항별 중복 감사

판정 근거는 §0의 "유일 D 패턴 수" + 실제 문구/구성개념 중복.

| 신규 문항 | 중복되는 기존 문항 | 의미 중복도 | 사용자 체감 중복도 | 독립적으로 얻는 정보 | 없을 때 영향받는 패턴 | 권고 |
|---|---|---|---|---|---|---|
| **pt_hold** | `ar_narrow`(nr_loss/nr_safety/nr_continuity) | **High** | **High**("좁히기 어려운 이유"를 다시 묻는 느낌) | 손실/소유/매몰을 *3분할*로 분리하는 판별 신호(ar_narrow는 점수만 주고 D가 아님; endowment 옵션 부재) | lossAversion·endowmentEffect·sunkCost (3개, 대체 D 없음→category_only로 하락) | **KEEP**(또는 ar_narrow에 MERGE — §6) |
| **pt_delay** | `cs_blocker`(blk_time/blk_fail), `rc_validation`(rc_val_none) | Medium | Medium | 미행동 동기를 *4분할*(분석/모호/두려움/바쁨)로 분리 — cs_blocker의 friction 매핑으론 이 4패턴 D를 못 만듦 | ambiguityAversion·analysisParalysis·productiveProcrastination·experimentAvoidance (4개) | **KEEP** |
| **pt_confidence** | `sc_outlook`(sc_market_only), `cs_blocker`(blk_confidence) | **High** | **High**(자신감을 세 번째로 묻는 반복) | impostor의 "성과를 운으로 귀인"만 유일 — lowSelfEfficacy는 sc_outlook/cs_blocker/construct로 이미 커버 | **impostor(1개)뿐**. lowSelfEfficacy는 `cx:selfEfficacyLow` 기존 D로 무영향 | **REMOVE** |
| **pt_direction** | `cs_main`(cs_stay), `ar_narrow`(nr_decided) | Medium | Medium | 전환기(사이 상태) vs 조기폐쇄를 명시 분리 — cs_stay/nr_decided는 점수만 주고 D 아님 | liminality·identityForeclosure (2개) | **KEEP**(경계; 추가 축소 시 REMOVE 후보) |

**질문별 상세 판단(2-1~2-7):**

- **pt_hold**: (1)ar_narrow와 사실상 유사 질문 — Yes. (2)같은 축(포기 비용) 반복 — Yes. (3)ar_narrow 응답으로 상당 추론 가능(nr_loss→loss, nr_continuity→sunk)이나 endowment는 추론 불가. (4)독립 정보=endowment 분리 + loss/sunk를 *discriminator 등급*으로 승격. (5)없으면 loss vs endowment vs sunk 구분 불가(전부 category_only). (6)삭제 시 3패턴 resolution이 pattern→category_only. (7)**KEEP 또는 ar_narrow에 MERGE.**
- **pt_delay**: (1)cs_blocker와 부분 유사이나 4분할이 더 예리. (2)부분 반복. (3)cs_blocker(blk_time/fail)로 busy/fear 일부 추론 가능하나 analysis/ambiguity는 불가. (4)독립=분석마비·모호성회피·실험회피·생산적지연의 유일 D. (5)없으면 이 4쌍 구분 불가. (6)삭제 시 4패턴 하락. (7)**KEEP.**
- **pt_confidence**: (1)sc_outlook·cs_blocker와 매우 유사(자신감). (2)자기효능감을 3중 반복. (3)sc_market_only+blk_confidence로 저효능은 이미 추론됨. (4)독립=impostor의 귀인 왜곡 1개뿐. (5)없으면 impostor↔lowSelfEfficacy만 구분 불가(감사에서 원래 Low 신뢰). (6)삭제 시 impostor만 하락(lowSelfEfficacy 무영향). (7)**REMOVE.**
- **pt_direction**: (1)cs_main·ar_narrow와 부분 유사. (2)방향 상태 부분 반복. (3)cs_stay/nr_decided로 일부 추론. (4)독립=inBetween(전환기) 명시. (5)없으면 liminality·foreclosure 구분 불가. (6)삭제 시 2패턴 하락→category_only(identityConfusion). (7)**KEEP(경계).**

---

## 3. 패턴별 판별 기여도

"기존 20문항만의 신호"에 discriminator가 있으면 신규 문항 불필요. `●`=이 패턴의 유일 D를 이 문항이 제공(필수), `○`=점수만 기여(D 아님), `-`=무관.

| 패턴 | 기존 20문항만의 D(구체 라벨 가능?) | pt_hold | pt_delay | pt_confidence | pt_direction | 신규 필수? |
|---|---|---|---|---|---|---|
| lossAversion | ✗ (nr_loss/nr_safety는 점수만) | ● | - | - | - | pt_hold |
| endowmentEffect | ✗ (전무, primaryRequires q1:endowment) | ● | - | - | - | pt_hold |
| sunkCost | ✗ (nr_continuity 점수만) | ● | - | - | - | pt_hold |
| ambiguityAversion | ✗ (primaryRequires q2:ambiguity) | - | ● | - | - | pt_delay |
| analysisParalysis | ✗ (marketInfoGap 점수만) | - | ● | - | - | pt_delay |
| productiveProcrastination | ✗ (blk_time 점수만) | - | ● | - | - | pt_delay |
| experimentAvoidance | ✗ (rc_val_none 점수만) | - | ● | - | - | pt_delay |
| liminality | ✗ (cs_stay 점수만) | - | - | - | ● | pt_direction |
| identityForeclosure | ✗ (nr_decided 점수만) | ○(nr_decided) | - | - | ● | pt_direction |
| impostor | ✗ (primaryRequires q3:impostor) | - | - | ● | - | pt_confidence |
| **maximizer** | ✅ **nr_explore / (rc_opt_many&overload)** | - | - | - | - | **불필요** |
| **noSelectionCriteria** | ✅ **cs_between / goalClarityLow** | - | - | - | - | **불필요** |
| **tyrannyOfShoulds** | ✅ **blk_eyes** | - | - | - | ○(stated) | **불필요** |
| **lowSelfEfficacy** | ✅ **cx:selfEfficacyLow**(+ sc_market_only/blk_confidence 점수) | - | - | ○(q3:lowEfficacy 대체 D) | - | **불필요** |
| anticipatedRegret | neverPrimary(분류 불가) | ○ | ○ | - | - | 무관 |
| movingGoalposts | neverPrimary(종단 필요) | - | - | - | - | 무관 |

**요지**: 4개 패턴(maximizer·noSelectionCriteria·tyrannyOfShoulds·lowSelfEfficacy)은 기존 D로 이미 구체 라벨 가능 → 신규 문항 불필요. 나머지 10개 분류가능 패턴은 신규 문항이 유일 경로. 그중 **impostor만 pt_confidence 단독 의존**이고 나머지 9개는 pt_hold(3)·pt_delay(4)·pt_direction(2)에 분산.

---

## 4. 인접 유형 쌍별 판별 필요성

| 유형 쌍 | 기존 문항만으로 구별? | 필요한 신규 문항 | 신규 없으면? |
|---|---|---|---|
| 손실회피 vs 소유효과 | ✗ (nr_loss/nr_safety 둘 다 점수만) | **pt_hold** (loss vs endowment 옵션) | 둘 다 category_only(instinctTrap) |
| 손실회피 vs 매몰비용 | ✗ | **pt_hold** (loss vs sunk) | category_only |
| 소유효과 vs 매몰비용 | ✗ (nr_continuity가 둘 다 대표) | **pt_hold** (endowment vs sunk) | category_only |
| 손실회피 vs 모호성회피 | ✗ (nr_unsure는 검증형으로 코딩) | **pt_hold**(loss) + **pt_delay**(ambiguity) | category_only |
| 극대화 vs 분석마비 | 부분(maximizer는 nr_explore 기존 D) | **pt_delay**(analysis) — 분석마비 쪽만 신규 필요 | 분석마비→category, 극대화는 구체 유지 |
| 분석마비 vs 선택기준부재 | 부분(기준부재는 cs_between 기존 D) | **pt_delay**(analysis) — 분석마비 쪽만 | 분석마비→category, 기준부재 구체 유지 |
| 생산적지연 vs 실험회피 | ✗ (blk_time/rc_val_none 점수만) | **pt_delay** (busy vs fear) | 둘 다 category_only(avoidance) |
| 생산적지연 vs 목표점이동 | ✗ (목표점이동은 종단 필요·neverPrimary) | pt_delay(지연만) — 목표점이동은 단일세션 불가 | 목표점이동은 항상 미분류 |
| 리미널리티 vs 조기결정 | ✗ (cs_stay/nr_decided 점수만) | **pt_direction** (inBetween vs closedEarly) | 둘 다 category_only(identityConfusion) |
| 당위적사고 vs 조기결정 | 부분(당위는 blk_eyes 기존 D) | **pt_direction**(closedEarly) — 조기결정 쪽만 | 당위 구체 유지, 조기결정→category |
| 가면증후군 vs 자기효능감부족 | 부분(저효능은 cx:selfEfficacyLow 기존 D) | **pt_confidence**(impostor) — 가면증후군 쪽만 | 가면증후군→lowSelfEfficacy로 흡수(저효능은 구체 유지) |

**함의**: pt_hold·pt_delay·pt_direction이 없으면 각 3·4·2쌍이 통째로 category_only로 내려간다(양쪽 다 하락). 반면 **pt_confidence는 한쪽(impostor)만 저효능으로 흡수**될 뿐 저효능 자체는 기존 신호로 구체 유지 → 손실이 가장 작다.

---

## 5. 문항 축소 시나리오 비교

기준: 22개 시뮬레이션은 순수 evidence code 기반이므로, 신규 문항 제거 = 해당 `q1/q2/q3/q4:*` 코드 제거로 재계산. **construct 코드(cx:*)는 실제 세션에선 남으므로**, 실사용에선 시뮬레이션보다 category_only 폴백이 더 잘 걸린다(특히 lowSelfEfficacy·noSelectionCriteria). ※ 시뮬레이션 일치율은 실제 사용자 정확도가 아님.

| 항목 | A. 24(4개 전부) | B. 22(pt_hold+pt_confidence) | C. 21(pt_delay 1개) | D. 20(신규 0) | E. 병합(ar_narrow↑) |
|---|---|---|---|---|---|
| 구체 라벨 가능 패턴 수 | **14** | 8 (loss/endow/sunk/impostor + 기존4) | 8 (ambig/analysis/procrast/exp + 기존4) | **4** (maximizer/noSelCriteria/shoulds/lowSelfEff) | ~13 (loss/sunk를 ar_narrow로, endowment 신설) |
| category_only 증가 | 기준 | +6패턴(pt_delay·pt_direction 상실) | +6(pt_hold·pt_direction·pt_confidence 상실) | **+10패턴** | +1(impostor) 수준 |
| insufficient 증가 | 거의 없음(construct 폴백) | 낮음 | 낮음 | 낮음(construct가 category로 흡수) | 낮음 |
| 인접 유형 충돌 | 최소 | loss/sunk 구분O, 나머지 다수 충돌 | ambig/analysis 구분O, 나머지 충돌 | 대부분 충돌→범주로 흡수 | loss/sunk 구분O, endowment O |
| confidence 하락 | 기준 | 6패턴 medium→category | 6패턴 하락 | 10패턴 하락 | impostor만 하락 |
| 사용자 질문 부담 | 24 (최다) | 22 | 21 | 20 (최소) | 22~23 |
| 체감 반복성 | **높음**(pt_confidence 3중 자신감, pt_hold≈ar_narrow) | 여전히 pt_confidence 반복 잔존 | 낮음 | 없음 | 중(ar_narrow 확장) |
| 구현 복잡도 | 낮음(현행) | 낮음 | 낮음 | 낮음 | **중**(엔진 RULES에서 arNarrow 코드를 D로 승격 + 옵션 추가 필요) |

**대표 시뮬레이션 델타(§8 22개 중 변동분):**
- **pt_confidence 제거 시**: #14(q3:impostor+sc_market_only)→impostor 불가(primaryRequires)→lowSelfEfficacy sc_market_only(+2) 무D→**category_only(identityConfusion)**. #16(q3:lowEfficacy+sc_unsure)→시뮬상 lowSelfEfficacy 하락하나 **실세션은 cx:selfEfficacyLow로 구체 유지**. #15(cx:selfEfficacyLow…)→**무변동(high 유지)**. → 순수 손실 = **impostor 1개**.
- **pt_direction 제거 시**: #18(blk_eyes+q4:closedEarly)→override 소멸, tyrannyOfShoulds는 blk_eyes로 여전히 pattern(secondary만 상실). #19(q4:closedEarly+nr_decided+curiosityLow)→foreclosure 무D→category. #20(q4:inBetween+cs_stay+transition)→liminality 무D→category. → 손실 = liminality·foreclosure 2개.
- **pt_hold 제거 시**: #1(sunkCost)→category, #2(endowment)→불가→category, #3(lossAversion)→category. → 손실 3개.
- **pt_delay 제거 시**: #6·#7(analysis)·#10·#11·#12·#22 등에서 분석마비/실험회피/생산적지연 하락. → 손실 4개(가장 큼).
- **시나리오 D**: 10개 패턴이 category로, 4개만 구체 유지.

---

## 6. 문항 문구 품질 (KEEP/REWRITE/MERGE 대상)

### KEEP: pt_delay (그대로 유지 — 4패턴의 유일 판별)
- 목적: 미행동의 *동기*를 분석마비/모호성회피/실험회피/생산적지연으로 분리
- 문구·옵션: 현행 유지(위 §1.1). 기존 cs_blocker(blk_time/blk_fail)와 겹치지 않는 이유: cs_blocker는 friction(time_constraint/identity_loss)로만 흐르고 이 4패턴의 D를 만들지 못함. 구별 쌍: 생산적지연↔실험회피, 극대화↔분석마비, 분석마비↔기준부재, 손실회피↔모호성회피. evidence: `q2:analysisParalysis|ambiguity|experimentAvoidance|procrastination|acting`

### KEEP 또는 MERGE: pt_hold
- 목적: 결정을 막는 "아까움"의 *대상/시제*를 매몰비용(과거 투자)/소유효과(현재 보유)/손실회피(미래 손실)로 분리
- 문구·옵션: 현행 유지. **다만 ar_narrow와 High 중복** → 대안(MERGE):
  - ar_narrow 옵션을 `nr_loss`(손실회피), `nr_continuity`(매몰비용)에 **discriminator 등급 부여** + `nr_endow`("지금 가진 지위·안정을 놓기 싫어서"=소유효과) 옵션 신설 → pt_hold 제거 가능(질문 1개 절감). 단 **엔진 RULES 변경 필요**(이번 범위 아님, 향후 대상).
- 겹치지 않는 이유(현행 pt_hold): ar_narrow는 "왜 못 좁히나"(탐색 프레임), pt_hold는 "무엇이 아까운가"(포기비용 프레임)로 시제·대상이 더 예리. 구별 쌍: 손실회피↔소유효과↔매몰비용. evidence: `q1:sunkCost|endowment|lossAversion|none`

### KEEP(경계): pt_direction
- 목적: 정체성 전환 상태를 전환기(inBetween) vs 조기폐쇄(closedEarly)로 분리
- 문구·옵션: 현행 유지. 구별 쌍: 리미널리티↔조기결정, 당위↔조기결정. evidence: `q4:inBetween|closedEarly|open`
- 축소가 필요하면 REMOVE 가능(liminality·foreclosure를 category_only(identityConfusion)로 정직 폴백).

### REMOVE: pt_confidence
- 사유: 유일 기여 impostor(1개)뿐, sc_outlook(sc_market_only)+cs_blocker(blk_confidence)와 자기효능감을 3중 반복, impostor는 커버리지 감사에서 Low 신뢰(저효능과 임상적으로 분리 곤란). 제거해도 lowSelfEfficacy는 `cx:selfEfficacyLow`로 구체 유지.
- (impostor를 꼭 살리려면 REWRITE보다, sc_outlook에 "성과가 있어도 내 실력 같지 않다" 옵션을 추가하는 MERGE가 반복 부담이 더 작음 — 단 엔진 변경 필요.)

---

## 7. 최종 권고

1. **실질 중복 문항**: `pt_confidence`(자기효능감 3중 반복, 유일 기여 impostor 1개). 부차적으로 `pt_hold`는 `ar_narrow`와 의미·체감 중복 High(단 endowment 분리 가치가 있어 KEEP/MERGE).
2. **14개 패턴 MVP 필수 신규 문항**: `pt_delay`(4패턴), `pt_hold`(3패턴), `pt_direction`(2패턴). `pt_confidence`는 impostor 1개만 담당 → MVP 필수 아님(impostor를 lowSelfEfficacy로 흡수 허용 시 13패턴).
3. **권장 총 무료 문항 수**: **23개**(기존 20 + pt_hold·pt_delay·pt_direction, pt_confidence 제거). 품질·UX 균형 최적. 더 줄이려면 22개(pt_direction도 제거).
4. **문항 축소 시 category_only로 내려갈 유형**: pt_confidence 제거 → **impostor**(→저효능 흡수). pt_direction까지 제거 → **liminality·identityForeclosure**. (pt_hold/pt_delay는 유지 권장이라 하락 없음.)
5. **기존 옵션 수정으로 대체 가능?**: 부분적으로 Yes — `ar_narrow`에 endowment 옵션 추가 + nr_loss/nr_continuity를 discriminator로 승격하면 `pt_hold` 대체 가능(엔진 RULES 변경 필요, 향후). `pt_confidence`의 impostor는 sc_outlook 옵션 추가로 대체 가능하나, 신뢰도 낮은 패턴이라 그냥 REMOVE가 단순.
6. **최적 균형 구조**: **23개**(pt_hold·pt_delay·pt_direction 유지, pt_confidence 제거). 근거: 신규 3문항이 각각 대체 불가한 3·4·2패턴을 열고, 제거되는 pt_confidence는 반복 부담이 가장 크고 기여가 가장 작다. "억지 보존" 대신 impostor는 저효능으로 정직하게 흡수.

---

## 8. 무변경 검증

- 작업 전 `git status --short`: `.claude/*`(무관 세션 파일)만 변경, HEAD `ef650df`.
- 이 문서 외 **어떤 소스도 변경하지 않음**. 특히 `src/data/careerQuestionFlow.ts`, `src/lib/biasPatternEngine.ts`, `src/components/careerCompassV2/session.ts`, `PatternTeaserView.tsx`, `patternTeaserCopy.ts`, 무료 결과 UI, 유료 문항, `FreeContext`, `paidAnswers`, `api/`, `db/`는 diff 0(문서 말미 검증).
- commit/push/deploy 없음.

---

## 부록. 확인된 사실 vs 가설

**코드로 확인**: 신규 4문항 정의·옵션([careerQuestionFlow.ts:391-451]), 각 패턴의 discriminator/primaryRequires/neverPrimary([biasPatternEngine.ts] RULES), 신규 문항 effect-free(scoring 미사용), maximizer/noSelectionCriteria/tyrannyOfShoulds/lowSelfEfficacy가 기존 D 보유.

**가설(실데이터 미검증)**: "사용자 체감 중복도"는 문구 유사성 기반 추정(실사용 설문 없음). 시뮬레이션 델타는 순수 evidence code 기반이며 실세션의 construct 폴백을 고려하면 category_only가 더 자주 걸릴 수 있음 — **시뮬레이션 일치율 ≠ 실제 사용자 정확도**. 문항 수 권고(23)는 분류-커버리지 vs UX 트레이드오프 판단이며, 전환·완주율 A/B로 재검증 대상.
