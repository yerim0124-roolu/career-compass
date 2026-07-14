# 무료 패턴 티저 신호(evidenceCode)가 주 패턴과 무관하게 노출되던 문제 + 카피 검수

날짜: 2026-07-14

## 해결한 문제
무료 결과 PatternTeaserView의 "당신의 답변에서 읽힌 신호"가 주 패턴과 직접 관계없는 신호까지 노출하고 있었다. 아울러 16패턴 카피에 금지 표현·반복 템플릿·이론 혼동이 있어 전체 검수·재작성했다.

## 사용자에게 나타난 증상
예) 결과가 lossAversion(손실 회피)인데, 신호 목록 상단에 pt_delay(분석/지연)나 pt_direction(방향) 답변에서 나온 무관한 신호가 먼저 표시될 수 있었다. 사용자가 "왜 이 신호가 내 패턴 근거지?"라고 느낄 여지.

## 확인된 근본 원인
`readSignals(evidenceCodes, max)`가 evidenceCodes를 **생성 순서대로 앞 3개**만 잘라 라벨을 붙였다. `extractEvidence`는 신규 판별 문항 q1(pt_hold)·q2(pt_delay)·q4(pt_direction)을 배열 앞쪽에 넣는데, 사용자는 이 세 문항에 **매번** 답하므로 주 패턴과 무관해도 q1/q2/q4 코드가 신호 목록에 먼저 들어갔다. 즉 신호 선택이 "주 패턴"이 아니라 "코드 생성 순서"에 묶여 있었다.

## 고려하거나 시도한 접근법
- SIGNAL_TAG_LABELS 문구만 다듬기 — 채택 안 함. 무관 신호가 섞이는 구조 문제는 그대로 남는다.
- `readSignals`를 패턴 인지형으로 바꾸기 — 채택. 표시 계층(patternTeaserCopy.ts) 안에서 해결되고 엔진·타입 변경이 없다.

## 최종 해결 방법과 선택 이유
1. `PATTERN_SIGNAL_CODES: Record<PatternId, string[]>`(패턴별 "직접 지지" 코드, 판별 신호 우선 순서)와 `CATEGORY_PATTERNS`(범주→소속 패턴) 추가.
2. `readSignals(codes, max, scope?)`로 확장: `{pattern}`이면 그 패턴 화이트리스트 코드만 우선순위 순으로, `{category}`면 그 범주 패턴들의 코드만, scope 없으면(insufficient) 기존 전체 순서. 관계 약한 신호는 목록에서 배제.
3. `PatternTeaserView.resolve()`에서 resolution별로 스코프 전달(pattern/category/none).
4. 카피 전면 재작성: 금지 표현("무게가 실려/한쪽으로 기울지/가벼워진다/흐름이 보여요 반복") 제거, mechanismPara의 "…라는 점이에요" 단일 템플릿 탈피, 이론 정합성 확보(소유효과=현재자산 웃돈 vs 매몰비용=이미 쓴 시간 등 유사 패턴 분화).
5. confidence 어투 완화: high를 "…입니다"(확정) → "현재 답변에서는 '○○' 경향이 가장 강하게 나타났어요". medium은 PATTERN_LABELS가 "…패턴"으로 끝나는 라벨(생산적 지연/실험 회피/목표점 이동)에서 "패턴' 패턴에" 이중 표기가 생겨 "'○○' 쪽에 가까워 보여요"로 교체.
6. 누락 라벨 3종 추가: `cx:executionDriveLow`, `val:rc_val_none`, `arNarrow:nr_unsure`(각각 analysisParalysis/experimentAvoidance/ambiguityAversion의 pos 코드인데 라벨이 없어 신호로 못 뜨던 것).

## 변경된 주요 파일
- `src/components/careerCompassV2/patternTeaserCopy.ts` — 카피 전면 재작성 + PATTERN_SIGNAL_CODES/CATEGORY_PATTERNS + readSignals 스코프화 + 라벨 정비.
- `src/components/careerCompassV2/PatternTeaserView.tsx` — confidence/범주 nameLine 문구, 상단 라벨, resolution별 신호 스코프 전달.
- 엔진(`biasPatternEngine.ts`)·질문(`careerQuestionFlow.ts`)·`session.ts`·유료 파이프라인 diff 0.

## 검증 방법과 결과
- 신규 흐름 실제 노출 패턴을 엔진 RULES + extractEvidence(pt_confidence 제거로 q3:* 미생성) 기준으로 확정: active_primary 13, active_secondary(identityForeclosure 오버라이드), category_only 4범주, legacy_only 3(anticipatedRegret·movingGoalposts·impostor).
- probe 스크립트로 각 목표 패턴을 산출하는 응답 세트를 확정한 뒤, 그 세트를 localStorage done-세션으로 주입해 브라우저 렌더 검증(9패턴 + category_only 2범주 + legacy impostor 세션). 신호가 주 패턴 코드로만 채워지고 무관 신호(pt_delay/pt_direction 등)가 배제됨을 확인. 콘솔 에러 0, CTA 1개, 모바일 375px 가로 오버플로우 없음.
- legacy impostor 세션(과거 pt_confidence 응답 잔존)은 impostor가 아닌 재계산 결과(lowSelfEfficacy)로 안전 렌더 — impostor는 neverPrimary라 신규 산출되지 않음. impostor 카피는 과거 세션 호환용으로 구조 검증(라벨·카피·impostor-scoped 신호 정상).
- `npm run build` 통과, node 27개 스위트 전부 통과, `git diff --check` clean.

## 재발 방지 원칙
- 표시용 신호/태그는 "생성 순서"가 아니라 "무엇을 뒷받침하는가"로 골라야 한다. evidence 배열을 앞에서 자르는 방식은 매번 응답하는 문항이 목록을 오염시킨다.
- 카피/노출 검수 전, 반드시 엔진 RULES + evidence 추출을 읽어 "신규 흐름에서 실제 노출되는 패턴"을 먼저 확정한다(neverPrimary·primaryRequires·discriminator·D 미보유 시 category_only 강등).
- 사용자용 라벨(PATTERN_LABELS)이 "…패턴/…상태/…마음"으로 끝나 문장 템플릿에 이중어가 생길 수 있으니, 템플릿은 라벨 어미에 독립적으로 자연스럽게 쓴다.

## 남은 위험 / 후속 작업
- 카피는 설계값(실사용 A/B 미검증) — 전환 데이터 확보 후 헤드라인·CTA 튜닝 대상.
- 심층 미리보기 4항목은 유료 result_json 섹션 약속과 대응하므로 패턴별 문구 분기는 보류(약속-산출물 불일치 방지). 유료 섹션 구조가 바뀌면 함께 갱신.
- 아직 commit/push/deploy 안 함(요청대로 로컬 변경만).
- 검수 상세표: `docs/research/career-pattern-copy-final-review.md`.
