# PatternTeaserView 정보 밀도·결제 전환 개선 보고서

- 날짜: 2026-07-13
- 범위: 무료 PatternTeaserView + 표시용 카피 계층만. 엔진 규칙·기존 결과 필드·유료 파이프라인 무변경.
- 상태: 미커밋(요청대로 commit/push/deploy 안 함).

## 1. 변경 전후 화면 구조

**변경 전**
- 자체 헤더("Career Compass 무료 결과") + 상위 헤더 → **헤더 중복**
- 옅은 단일 카드: 헤드라인 1문장(패턴명 반복) + 설명 1문장 + 내부 변수형 태그("목표 선명도 신호")
- CTA/미리보기는 하단 별도 형제(PaidEntryBanner)에만 → 첫 화면 CTA 약함
- 근거 납득 부족, 유료 가치 약함

**변경 후** (task 필수 구성 1~8 반영, 위계 명확한 구획)
1. 상단 라벨 "현재 답변에서 가장 강하게 나타난 고민 패턴"
2. **반전형 헤드라인**(패턴명 반복 대신 재해석) — 예: "지금까지 쌓은 게 아까운 거지, 방향이 틀린 게 아니에요."
3. 이론적 패턴명 칩 + 상위 범주 칩 — 예: `매몰비용` · `본능의 덫`, confidence 반영 한 줄
4. **개인화 2문단** — ①현재 상태 ②놓치고 있을 핵심 메커니즘 (확정 진단·자유입력 인용 없음)
5. **"당신의 답변에서 읽힌 신호" 2~3개** — evidenceCodes 뒷받침 항목만, 사용자 언어(내부 코드/변수명 제거)
6. **아직 풀리지 않은 질문** 1문장(무료에선 답·행동계획 미제공)
7. **심층 분석 미리보기 4항목** — 실제로 지키고 싶은 조건 / 현실적 위험과 심리적 두려움의 구분 / 현재 조건에 맞는 전환 방식 / 30일 실행 실험과 재판단 기준
8. **강한 CTA** — "내 고민의 원인과 30일 계획 확인하기" + 보조 "추가 질문 12개 · 약 3분 · 개인화된 심층 결과"
- 자체 헤더 제거(상위 헤더만) + 상단 여백 축소(pt-3), 카드 내부를 구획선으로 분리.
- **중복 CTA 제거**: 신규 티저가 CTA·미리보기를 모두 담으므로, App.tsx의 하단 형제 배너(PaidEntryBanner) 렌더를 제거. "기존 유료 CTA 진입"은 티저 CTA(→ `#paid-preview`)로 그대로 유지(유료 12문항 e2e 흐름 불변). 페이지 높이 1537→1217px.

## 2. 패턴별 예시 카피 (반전 헤드라인 · confidence 어투)

| 결과 | 반전 헤드라인 | confidence 어투 |
|---|---|---|
| sunkCost (high) | "지금까지 쌓은 게 아까운 거지, 방향이 틀린 게 아니에요." | "…패턴은 ‘들인 것이 아까운 마음’입니다." |
| lowSelfEfficacy (medium) | "방향이 없는 게 아니라, 해낼 수 있을지 자신이 흔들리는 거예요." | "현재 답변은 ‘…’ 패턴에 가까워 보여요." |
| maximizer (예) | "방향이 없는 게 아니라, 놓치고 싶지 않은 게 너무 많은 거예요." | — |
| tyrannyOfShoulds (예) | "당신이 원하는 게 아니라, ‘해야 한다’가 결정을 누르고 있어요." | — |
| instinctTrap (category_only) | "결정을 못 하는 게 아니라, 놓기 어려운 무언가가 있는 거예요." | "지금은 ‘본능의 덫’ 쪽 고민이 크게 보여요. (구체적인 유형은 아직 단정하지 않아요.)" |
| cognitiveOverload (category_only) | "방향이 없는 게 아니라, 생각할 거리가 너무 많은 거예요." | "지금은 ‘인지 과부하’ 쪽…" |
| insufficient_signal | "지금은 하나의 패턴으로 좁히기 어렵습니다." | (구체 유형 미표시, 이후 심화 분석 필요성 자연스럽게 설명) |

전 16패턴 + 4범주 + insufficient의 반전 헤드라인·상태문단·메커니즘문단·미해결질문은 `patternTeaserCopy.ts`에 정의.

## 3. 변경 파일

| 파일 | 성격 |
|---|---|
| 신규 `src/components/careerCompassV2/patternTeaserCopy.ts` | 표시 카피 계층: PATTERN_COPY(16)·CATEGORY_COPY(4)·INSUFFICIENT_COPY·SIGNAL_TAG_LABELS(사용자 언어)·readSignals·DEEP_PREVIEW_ITEMS·CTA 문구 |
| 수정 `src/components/careerCompassV2/PatternTeaserView.tsx` | 리치 구조 재작성(1~8), 헤더 제거, 위계 구획, 강한 CTA |
| 수정 `src/App.tsx` | 무료 결과의 중복 하단 배너(PaidEntryBanner) 렌더 + import 제거(단일 CTA). 진입은 티저 CTA로 유지 |

- **엔진 무변경**: `src/lib/biasPatternEngine.ts` diff **0줄**(점수·분류·confidence·fallback 규칙 그대로).
- `PaidEntryBanner.tsx` 파일은 남겨둠(미사용, 되돌리기 용이).

## 4. 검증 결과

- **4개 이상 서로 다른 패턴/티어 브라우저 렌더**: sunkCost(high), lowSelfEfficacy(medium), instinctTrap·cognitiveOverload·identityConfusion(category_only) 확인.
- **confidence별**: high(확정 "…입니다"), medium(완화 "…가까워 보여요"), category_only(상위 범주만·구체 유형 미확정), insufficient_signal("좁히기 어렵다" + 심화 필요성) — 카피 확인.
- **evidenceCodes ↔ 태그 일치**: 표시된 신호가 모두 실제 응답 코드에 대응. `readSignals(['UNKNOWN_X','blocker:blk_unclear'])` → `[]` → **존재하지 않는 태그 미생성** 확인. 내부 변수형 태그("목표 선명도 신호") 제거.
- **모바일 CTA**: 첫 화면(812px) 하단에 "🔒 심화 분석에서 이어서 ₩3,900" 박스가 이미 노출, CTA 버튼은 바로 아래(~1062px, 리치 콘텐츠 뒤 자연 위치). 데스크톱도 카드 직후 단일 CTA. 중복 배너 제거로 과도한 하단 밀림 완화.
- **유료 e2e 흐름 유지**: 티저 CTA → `#paid-preview` → 유료 12문항 → POST /api/paid-job → runner → 결과지(직전 세션에서 이미 end-to-end 정상 확인, 이번 변경은 그 경로에 무영향).
- **빌드/테스트**: `npm run build` 통과, node 실행형 **27개 스위트 전부 통과**, `git diff --check` 통과.

### insufficient_signal 관련 주의(발견)
construct 정규화가 sparse/empty 응답에서도 `cx:selfEfficacyLow/goalClarityLow/…`를 만들어, **실제 무료 흐름에서는 항상 최소 category_only로 귀결**된다(빈 응답으로도 재현). 순수 insufficient_signal은 degenerate/손상 증거에서만 나오며, 엔진 레벨(`classifyFromEvidence([])`/`['blocker:blk_unclear']` → insufficient, 브라우저에서 확인)과 컴포넌트 카피 연결(`INSUFFICIENT_COPY`)로 검증했다. 즉 insufficient 카피는 손상 입력용 안전망으로 동작하며, 일반 사용자는 category_only 이상을 받는다.

## 5. 유료 파이프라인 무변경 증거

- 보호 파일 `git diff` 각 **0줄**: `src/components/paid/{freeContext,PaidQuestionsView,PaidResultView,paidJobSession}`, `api/{paid-job,paid-analysis,paid-analysis-runner}`.
- `db/` 0줄, `vercel.json` 0줄.
- `biasPatternEngine.ts` 0줄(엔진 규칙 불변), FreeContext·paidAnswers·유료 12문항·result_json 미변경.
- 이번 변경은 무료 PatternTeaserView + 표시 카피 계층 + App.tsx의 무료 결과 CTA 구성(중복 배너 제거)에 한정.

## 6. 남은 위험 / 후속

- App.tsx의 PaidEntryBanner 렌더 제거는 task의 "PatternTeaserView + 카피 계층" 범위를 한 줄 넘어서지만, 지정 CTA를 티저에 넣으면 배너가 필연적으로 중복 CTA가 되어 전환을 해치므로 무료 결과 화면 구성 차원에서 최소 제거했다(되돌리기 쉬움). 유료 진입은 티저 CTA로 유지.
- 카피는 설계값(실사용 A/B 미검증) — 전환 데이터 확보 후 헤드라인·CTA 문구 튜닝 대상.
- `PaidEntryBanner.tsx`는 미사용 파일로 남음(정리 시 삭제 가능).
