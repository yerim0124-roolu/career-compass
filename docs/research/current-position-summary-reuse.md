# 무료 결과 '현재 위치'(의사결정 단계) — 기존 엔진 값 재사용

- 날짜: 2026-07-14
- 범위: PatternTeaserView 상단에 '현재 위치' 보조 블록 추가. 표시 카피/컴포넌트만. 엔진·질문·점수·조건부 흐름·유료 파이프라인 무변경.

## 1. 과거 '현재 위치' 문장의 정확한 출처 (조사 결과)

- 유료 플래그 ON인 현재 무료 화면은 `PatternTeaserView`만 렌더한다. 과거 상세 결과지 `ResultSpineView`(플래그 OFF)에는 `mainType`·`subtype`·`narrative`(counseling paragraph)·`readinessLevel`이 있었으나, **"현재 위치/지금 단계"를 설명하는 완성 문장은 P3.11에서 이미 제거**됐다("PhaseSteps·지금 단계·실행 준비도 제거", ResultSpineView 주석). → 결과 객체에 재사용할 완성 문장이 없음.
- 결과 엔진이 이미 산출하는 값 중 '의사결정 단계'를 담는 필드는 **`mainType`(MainTypeKey, 10개 상황 유형)**. `readinessLevel`은 행동 강도(pause~commitment_test)라 단계 서술과 결이 다르고, `resultContext.narrative`는 처방 중심 문단이라 '현재 위치' 한 줄로 부적합.
- 조사 질문 답:
  1. 완성된 '현재 위치' 문장은 결과 객체에 **없음**(과거엔 있었으나 제거).
  2. 결과 객체에 들어오지 않음.
  3. → 컴포넌트가 기존 필드(mainType)를 표시용 카피 맵과 조합해 생성(§2 우선순위 3).
  4. mainType은 기존 20문항의 vector/gate/construct에서 계산(신규 pt_* 없이도 동일 산출).
  5. **pt_hold/pt_delay/pt_direction 없이도 mainType은 동일** → 현재 위치 문장 동일.
  6. 현재 PatternTeaserView 렌더 지점(HybridFlowView result phase)에 `spine`(mainType 포함)이 이미 있음 → 그대로 재사용.

## 2. 재사용한 기존 결과 필드

- **`spine.solutionLayer.mainTypeKey`(MainTypeKey) 하나만** 사용.
- 새 점수·threshold·분류·인사이트 엔진 없음. `mainType → 문장`은 표시 전용 순수 맵(`currentPositionCopy.ts`).
- 10개 mainType이 의사결정 여정 국면(탐색→축소/결정→검증→실행 준비/정비/회복)에 매핑되고, 각 유형의 기존 분류 의미에 맞춰 국면만 한 문장으로 서술.

## 3. 신규 패턴 문항과의 독립성

- pt_hold/pt_delay/pt_direction은 effect-free(scoreEffects/constructEffects 비고, gate 없음) → vector/gate/construct에 0 기여 → **mainType 불변** → 현재 위치 문장 불변.
- patternProfile은 pt_*로 달라질 수 있으나, mainType이 같으면 현재 위치 문장은 동일(독립 계층). CurrentPositionSummary는 patternProfile을 입력으로 받지 않고 mainType만 받는다.
- 테스트로 검증: pt_hold/pt_delay/pt_direction 단독·동시 변경 → mainType·subtype·pullDirection·primaryFriction·readinessLevel·현재 위치 문장 전부 불변. scoring 필드(cs_main/rc_energy 등) 변경으로 mainType이 달라지면 현재 위치 문장도 달라짐.

## 4. 현재 위치 vs 패턴의 역할 구분

- **현재 위치**: 지금 의사결정 여정의 어느 '국면'인지(탐색/축소/결정/검증/실행 준비/정비/회복). 전체 무료 답변(mainType)이 반영된 상황 요약.
- **핵심 고민 패턴**: 그 국면에서 왜 미루거나 갈등하는지(심리 패턴)·신호·미해결 질문.
- 겹침 방지: 현재 위치는 '원인'이 아니라 '국면'을 서술한다. 초안에서 conflictedAtFork를 "무엇을 우선할지 기준을 세워가는 단계"로 썼더니 noSelectionCriteria 패턴("기준이 아직 없는")과 어휘가 겹쳐, "여러 길이 보이는 갈림길에서 결정을 앞두고 있는 단계"로 국면 중심 재작성. 나머지 유형도 국면 어휘(초반 탐색/추려가기/검증/전환 첫발/재설계/현실 정비/회복)로 통일.

## 5. 대표 사례별 문장 (브라우저 실측)

| mainType | 국면 | 현재 위치 문장 | 동시 렌더 패턴(예) — 중복 없음 |
|---|---|---|---|
| scatteredExplorer | 축소 | 지금은 여러 방향을 충분히 둘러본 뒤, 실제로 집중할 것을 추려가는 단계에 가까워요. | 극대화("어느 것도 놓치고 싶지 않은") |
| conflictedAtFork | 결정 | 지금은 여러 길이 보이는 갈림길에서, 어느 쪽으로 갈지 결정을 앞두고 있는 단계에 가까워요. | 선택 기준 부재("기준이 아직 없는") |
| plateauedPerformer | 실행 준비 | 지금은 쌓아온 경력을 다음 단계로 잇기 위해, 전환의 첫발을 준비하는 단계에 가까워요. | 정체성 혼란(category_only) |
| overloadedBurnout | 회복 | 현재는 새로운 결정을 밀고 나갈 에너지와 생활 리듬이 충분하지 않은 상태에 가까워요. | 생산적 지연("바쁜 일들이 결정을 미뤄주는") |
| (나머지 6종) | 탐색/검증/정비/조직성장/레버리지/재설계 | currentPositionCopy.ts 참조 | — |

## 6. fallback

- `currentPositionCopy(mainType)`는 mainType이 없거나(구버전/불완전) 매핑에 없으면 `null` 반환 → `CurrentPositionSummary`가 `null` 렌더(영역 숨김). 억지 문장 생성·크래시 없음.
- 완료 세션은 항상 mainType이 산출되므로(leverageReady가 엔진 기본 폴백) 정상 문장. 구버전 완료 세션(옛 pt_direction 옵션 id, pt_hold 없음, stale pt_confidence)도 mainType 기반으로 안전 렌더 확인.

## 7. 브라우저 검증 결과

- 5개 국면(탐색=scattered / 결정=conflicted / 실행 준비=plateaued / 회복=burnout / +legacy) 실제 렌더:
  - 현재 위치 문장이 mainType과 일치, **패턴 설명과 중복되지 않음**(국면 vs 원인).
  - 현재 위치가 '답변 수정' 아래·패턴 카드 위에, 시각적으로 작은 보조 블록(연보라 박스, 작은 캡션 + 1~2문장)으로 렌더 — 패턴 카드가 주인공.
  - 신규 패턴 문항 몇 개로 만든 문장처럼 보이지 않음(전체 답변 반영 mainType 기반).
  - 1~2문장, 모바일 375px 가로 오버플로우 없음, CTA 1개, 콘솔 오류 없음.
  - 구버전 완료 세션 안전 렌더(크래시 없음).

## 8. 보호 파일 무변경 증거

- 변경: `HybridFlowView.tsx`(result phase에 `<CurrentPositionSummary>` 한 줄 추가·import — 흐름/조건부 로직 무변경), 신규 `currentPositionCopy.ts`·`CurrentPositionSummary.tsx`·테스트.
- diff 0: `biasPatternEngine.ts`, `careerQuestionFlow.ts`(질문·조건부 pt_hold), `session.ts`(buildResultFromResponses 계산 규칙), **`PatternTeaserView.tsx`·`patternTeaserCopy.ts`(기존 패턴 카피)**, `src/components/paid/`, `api/`, `db/`, `vercel.json`. mainType/subtype/pullDirection/primaryFriction/readinessLevel/resultContext 산출 규칙 무변경.
