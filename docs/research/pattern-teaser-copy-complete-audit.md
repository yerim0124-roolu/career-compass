# 무료 결과 패턴 티저 카피 전수 감사

- 날짜: 2026-07-14
- 범위: `patternTeaserCopy.ts` + `PatternTeaserView.tsx`의 표시 카피/템플릿 + 카피 테스트. 엔진·질문·세션·유료 파이프라인 무변경.

## 1. 발단 — 당위적 사고(tyrannyOfShoulds) 부자연스러운 노출

production에서 tyrannyOfShoulds 카피가 어색하게 노출됨:
- 헤드라인 "…해야 한다가 결정을 대신 누르고 있어요"("○○가 결정을 누르고 있다" 은유)
- confidence "현재 답변은 '해야 한다'에 눌린 마음 쪽에 가까워 보여요"(엔진 라벨 `PATTERN_LABELS['tyrannyOfShoulds']="'해야 한다'에 눌린 마음"`을 따옴표로 끼워 넣어 **중첩 따옴표 + "눌린 마음"**)
- 상태/메커니즘에 "바깥 기준"·"판단에 먼저 들어와요"·"누르고 있다"

근본 원인: confidence 한 줄이 `‘${PATTERN_LABELS[pattern]}’ 쪽에 가까워 보여요` 식으로 **라벨을 따옴표로 조합**하는 인공적 템플릿이라, 라벨이 은유/따옴표를 포함하면 문장이 깨졌다. PATTERN_LABELS는 엔진(보호)이라 수정 불가 → 템플릿 자체를 패턴별 완성 문장으로 교체.

## 2. 구조 변경 — confidence를 패턴별 완성 문장으로

- `PatternCopy`에 `confidence: string` 추가. 16개 패턴 모두 라벨을 인용하지 않는 **완성 문장** 보유(확정 진단 금지: "…경향/모습/신호가 나타났어요").
- `PatternTeaserView`: 패턴 branch의 nameLine을 `c.confidence`로 교체(기존 `PATTERN_LABELS[...]` 조합·high/medium 템플릿 제거). PATTERN_LABELS import 삭제. 패턴명은 academic 칩(예: "당위적 사고")으로만 노출.
- category_only confidence 라인("'○○' 범주의 고민이 비교적 크게 나타났어요")은 **범주명(정상 라벨)**만 인용하므로 유지.

## 3. 실제 노출 카피 전수 감사표

노출 상태: active(13, primary 가능) / active_secondary(identityForeclosure 오버라이드) / legacy_only(anticipatedRegret·movingGoalposts·impostor) / category_only(4). 아래는 문제 있던 항목 중심(그 외 패턴은 confidence 신설 외 본문 무변경, 브라우저 전수 렌더로 자연스러움 확인).

| 패턴 | 노출 | 기존 문제 | 최종 헤드라인 | 최종 confidence |
|---|---|---|---|---|
| tyrannyOfShoulds | active | 누르고 있다/눌린 마음/바깥 기준/판단에 들어옴/중첩 따옴표 | 내가 원하는 것보다, '해야 한다'는 기준이 결정을 이끌고 있어요. | 현재 답변에서는 내 기준보다 주변의 기대를 먼저 고려하는 경향이 나타났어요. |
| 그 외 12 active | active | confidence가 라벨 조합('○○ 마음' 쪽에) | (기존 헤드라인 유지) | 패턴별 완성 문장 신설(예: 매몰비용 "…이미 들인 것을 기준으로 판단하는 경향이 나타났어요.") |
| category_only ×4 | category_only | identityConfusion 상태문단에 "바깥 기준에 눌려" | (기존) | "'○○' 범주의 고민이 비교적 크게 나타났어요" 유지 |
| anticipatedRegret / movingGoalposts / impostor | legacy_only | confidence 라벨 조합 | (기존) | 완성 문장 신설(과거 세션 렌더 호환) |
| insufficient | fallback | — | (기존) | nameLine 없음(그대로) |

**당위적 사고 최종 본문**
- 상태: "무엇을 원하는지보다, 어떤 선택을 해야 인정받고 안전할지를 먼저 생각하고 있어요. 그래서 주변의 시선이나 기대가 내 판단보다 앞설 수 있습니다."
- 메커니즘: "이런 기준을 따르면 당장의 갈등은 줄일 수 있지만, 그 선택을 오래 유지할 수 있는지는 별개의 문제예요. 지금 따르는 기준이 내 선택인지, 주변의 기대를 받아들인 것인지 더 살펴봐야 합니다."
- 질문: "지금 따르는 기준은 내가 선택한 것일까요, 주변의 기대를 받아들인 것일까요?"
- 직접 신호(blk_eyes): "주변의 시선·기대가 신경 쓰임" → **"주변의 시선과 기대를 먼저 고려함"**

## 4. category_only / fallback 수정

- CATEGORY_COPY.identityConfusion 상태문단 "…전환의 중간이라서인지, **바깥 기준에 눌려서인지**까지는…" → "…전환의 중간이라서인지, **주변의 기대를 앞세우고 있어서인지**까지는…"(은유 제거).
- 나머지 category 3종·insufficient는 어색 표현 없음(감사 결과 무변경).

## 5. 제거/금지 표현(전체 카피에서 부재 확인)

"○○가 결정을 누르고 있다" · "○○에 눌린 마음" · "바깥 기준" · "판단에 들어온다" · "선택지가 가벼워진다" · "무게가 실린다" · "흐름이 보인다" · "마음의 정체" · "현재 답변은 '○○ 마음' 쪽에 가까워 보여요"(인공적 조합). 카피 테스트로 회귀 방지.

## 6. 브라우저 렌더 검증

임시 하니스로 실제 `PatternTeaserView`를 **13 active(high+medium) + legacy 3 + category 4 + insufficient = 34개 프로필** 전수 렌더(검수 후 하니스 삭제):
- 실제 티저 콘텐츠에 금지 표현 **0건**("눌린"은 하니스 섹션 라벨의 엔진 PATTERN_LABELS에서만 나오고 티저에는 없음).
- 모든 confidence가 "현재 답변에서는 …경향/모습/신호가 나타났어요" 완성 문장(중첩 따옴표·라벨 조합 없음, 확정 진단 아님).
- tyrannyOfShoulds: academic 칩 "당위적 사고"(옛 "'해야 한다'에 눌린 마음" 미노출), 신호 "주변의 시선과 기대를 먼저 고려함".
- 헤드라인↔본문 의미 중복 없음, 훈계/진단 어투 없음, 신호 문구가 evidenceCodes와 일치.
- 각 섹션 CTA 정확히 1개, 모바일 375px 가로 오버플로우 없음·과도한 줄바꿈 없음, 콘솔 오류 없음.

## 7. 변경/무변경 범위

- 변경: `patternTeaserCopy.ts`(confidence 16 신설·tyrannyOfShoulds 전면·category identityConfusion·blk_eyes 신호), `PatternTeaserView.tsx`(confidence 사용·PATTERN_LABELS import 제거), `patternTeaserCopy.test.ts`(신규 카피 감사 테스트).
- 무변경(diff 0): `biasPatternEngine.ts`(PATTERN_LABELS 포함 엔진 규칙·점수), 질문 흐름·조건부 pt_hold·session·scoring·FreeContext·paidAnswers·유료 미리보기·유료 결과·api/db/QStash/runner.
