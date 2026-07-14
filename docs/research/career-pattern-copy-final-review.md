# Career Pattern 무료 결과 카피 최종 검수

- 날짜: 2026-07-14
- 범위: `src/components/careerCompassV2/patternTeaserCopy.ts` 전면 재작성 + `PatternTeaserView.tsx`의 confidence/범주 문장·신호 스코프 소폭 수정.
- 엔진·질문·유료 파이프라인 무변경.

## 1. 신규 흐름(23문항) 실제 노출 상태

`biasPatternEngine.ts`의 RULES + `extractEvidence`(pt_confidence 제거로 `q3:*` 코드 미생성)를 기준으로 확정.

| 패턴 | 판별 신호(D) | 신규 흐름 도달 | 노출 상태 |
|---|---|---|---|
| lossAversion | q1:lossAversion | high 가능 | active_primary |
| endowmentEffect | q1:endowment | medium(최대 4점) | active_primary |
| sunkCost | q1:sunkCost | high 가능 | active_primary |
| ambiguityAversion | q2:ambiguity | high 가능 | active_primary |
| maximizer | nr_explore ∨ (opt_many∧overload) | high 가능 | active_primary |
| analysisParalysis | q2:analysisParalysis | high 가능 | active_primary |
| noSelectionCriteria | cs_between ∨ goalClarityLow | high 가능 | active_primary |
| productiveProcrastination | q2:procrastination | high 가능 | active_primary |
| experimentAvoidance | q2:experimentAvoidance | high 가능 | active_primary |
| liminality | q4:inBetween | high 가능 | active_primary |
| tyrannyOfShoulds | blk_eyes | medium(최대 4점) | active_primary / (blk_eyes∧closedEarly 시 primary) |
| identityForeclosure | q4:closedEarly | high 가능 | active_primary + active_secondary(blk_eyes∧closedEarly 오버라이드) |
| lowSelfEfficacy | cx:selfEfficacyLow | high 가능 | active_primary |
| anticipatedRegret | (없음, neverPrimary) | — | legacy_only(범주 fallback 기여만) |
| movingGoalposts | (없음, neverPrimary) | — | legacy_only(범주 fallback 기여만) |
| impostor | q3:impostor(신규 미생성) | — | legacy_only(과거 세션 렌더용) |

- category_only: 4범주(instinctTrap/cognitiveOverload/avoidance/identityConfusion) — D 보유 패턴이 medium 미달일 때.
- insufficient_signal: 손상·degenerate 입력 안전망(실사용 흐름은 construct 정규화로 최소 category_only).
- **legacy_only 3종(anticipatedRegret·movingGoalposts·impostor) 카피는 삭제하지 않고 유지**(과거 세션 호환).

## 2. 주요 카피 수정 원칙

1. **금지 표현 제거**: "무게가 실려 있다 / 한쪽으로 기울지 않는다 / 가벼워진다 / 흐름이 보여요(반복)"를 전면 제거. statePara 문미를 "~두드러져요 / ~드러나요 / ~쪽이에요 / ~모습이 있어요"로 분산.
2. **mechanismPara 템플릿 탈피**: 모든 문단이 "놓치기 쉬운 건, …라는 점이에요"로 시작하던 것을 패턴별로 다른 첫 문장·다른 결론으로 재작성.
3. **이론 정합성**: §3 정의에 맞춰 유사 패턴이 같은 문장으로 수렴하지 않게 메커니즘을 구분(예: 소유 효과=현재 자산의 웃돈 / 매몰비용=이미 쓴 시간 / 손실회피=미래 손실 계산; 분석마비=정보가 행동 대체 / 선택기준부재=우선순위 부재; 실험회피=시도를 판정으로 받아들임 / 생산적지연=바쁨으로 회피; impostor=과거 성과 인정 / lowSelfEfficacy=미래 수행 자신).
4. **confidence 어투 완화**: high를 "…입니다"(확정) → "현재 답변에서는 '○○' 경향이 가장 강하게 나타났어요"로 변경. medium 유지. 진단형 표현 금지.
5. **신호 스코프화**: 주된 패턴과 직접 관계 있는 evidenceCode만 신호로 노출(아래 §4).
6. **문장 길이**: 한 문장 20~45자, 한 문단 2문장 이내 지향.

## 3. 가장 크게 수정된 패턴

- **lossAversion**: 금지 표현 3종("무게 실려/기울지/가벼워져요")이 한 카피에 모두 있어 전면 재작성. 메커니즘을 "무엇을 잃어도 되고 무엇은 지킬지 먼저 정하기"로 구체화, 질문을 "꼭 필요한 안전 vs 익숙함"으로 교체.
- **endowmentEffect / sunkCost**: 서로 "지금 것을 놓기 어렵다"로 수렴하던 문장을 소유 웃돈 vs 매몰 시간으로 분리.
- **analysisParalysis / noSelectionCriteria**: "정보가 행동을 대체" vs "우선순위 한 줄 부재"로 메커니즘 분리.
- **experimentAvoidance / productiveProcrastination**: "시도=판정 두려움" vs "바쁨으로 회피"로 분리.
- **category_only 4종 + insufficient**: "구체 유형은 단정하지 않는다"를 statePara 안에 자연스러운 두 갈래 예시로 재작성.

## 4. evidenceCodes ↔ 카피 불일치 수정

- **누락 라벨 3종 추가**: `cx:executionDriveLow`('생각을 행동으로 옮기는 힘이 약함'), `val:rc_val_none`('아직 밖에서 반응을 받아본 적 없음'), `arNarrow:nr_unsure`('어느 쪽이 나을지 가늠이 안 됨') — 각각 analysisParalysis/experimentAvoidance/ambiguityAversion의 pos 코드인데 라벨이 없어 신호로 표시되지 못하던 문제.
- **근사 중복 라벨 분리**: `cx:optionOverloadHigh`('한 번에 살펴보는 선택지가 많음')와 `arNarrow:nr_explore`('여러 방향을 동시에 열어두고 있음')가 거의 동일하던 것을 구분. lowSelfEfficacy 계열(`selfEfficacyLow`/`blk_confidence`/`sc_unsure`)도 문구를 분화.
- **신호 스코프화(핵심 수정)**: 기존 `readSignals`는 evidenceCodes를 순서대로 앞 3개만 취해, 사용자가 매번 답하는 pt_hold/pt_delay/pt_direction(q1/q2/q4) 코드가 **주 패턴과 무관해도** 신호로 먼저 노출되는 문제가 있었다. `PATTERN_SIGNAL_CODES`(패턴별 직접 지지 코드) + `CATEGORY_PATTERNS`를 추가하고, `readSignals(codes, max, { pattern })` / `{ category }` 스코프를 도입해 **주 패턴을 직접 지지하는 신호만** 우선순위대로 노출하도록 변경. 관계가 약한 신호는 목록에서 배제.

## 5. category_only / fallback 카피

- category_only: nameLine을 "현재 답변에서는 '○○' 범주의 고민이 비교적 크게 나타났어요"로, statePara에 "다만 A 때문인지 B 때문인지 지금 답변만으로 단정하기 어렵다"는 두 갈래를 담아 구체 패턴을 암시하지 않게 함.
- insufficient_signal: "지금은 하나의 고민 패턴으로 좁히기는 어려워요" → 특정 유형 암시 없이 "재정·가족·현실 조건을 함께 놓고 갈래를 나눈다"는 심화 분석 방향으로 연결.

## 6. 심층 미리보기 / CTA

- 기본 4항목(지켜야 할 조건 / 현실 위험·심리 두려움 구분 / 조건에 맞는 전환 방식 / 30일 실험·재판단)은 **유지**. 각 항목이 유료 result_json의 실제 섹션 약속과 대응하므로, 패턴별로 문구를 바꾸면 약속과 산출물이 어긋날 위험이 있어 통일 유지(과최적화 회피). CTA·보조문구 원문 유지.

## 7. 노출 상태 요약

- active_primary: 13
- active_secondary(추가): identityForeclosure(오버라이드 경로)
- category_only: 4범주
- legacy_only: anticipatedRegret, movingGoalposts, impostor
