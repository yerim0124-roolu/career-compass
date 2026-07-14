# Career Compass 무료 23문항 순서 재배열 + pt_direction 재작성

- 날짜: 2026-07-14
- 범위: `src/data/careerQuestionFlow.ts`(배열 순서 + pt_direction 문항), `biasPatternEngine.ts`(pt_direction evidence 매핑), 세션 복구·진행 문구.
- 불변: 문항 ID·scoreEffects·constructEffects, 기존 무료 결과(mainType/subtype/pullDirection/primaryFriction/readinessLevel/resultContext), 유료 파이프라인.

## 1. 기존 순서 (재배열 전)

| # | ID | 주제 | 측정 | stage |
|---|---|---|---|---|
| 1 | cs_main | 지금 상태 | vector·construct | current_state |
| 2 | ar_roles | 끌리는 역할 | vector·construct | attractive_roles |
| 3 | ar_narrow | 좁히기 어려운 이유 | 추론 전용(effect-free) | attractive_roles |
| 4 | cv_values | 포기하기 싫은 가치 | vector | core_values |
| 5 | cv_priorities | 우선순위 | vector·mcda | core_values |
| 6–9 | fc_1~fc_4 | 더 끌리는 쪽 | vector·construct | forced_choices |
| 10 | sc_outlook | 해낼 수 있을까(자기효능감) | scct | reality_check |
| 11 | rc_options | 떠오르는 선택지 수 | difficulty | reality_check |
| 12 | rc_runway | 버틸 기간 | gate·vector | reality_check |
| 13 | rc_energy | 지금 에너지 | gate·vector | reality_check |
| 14 | rc_risk | 감당 손실 | gate·vector | reality_check |
| 15 | rc_validation | 받은 반응(검증) | gate·construct | reality_check |
| 16 | or_content | 콘텐츠·자문 방향 반응 | construct | option_reactions |
| 17 | or_venture | 창업·독립 방향 반응 | construct | option_reactions |
| 18 | or_internal | 사내·현직 방향 반응 | construct | option_reactions |
| 19 | cs_blocker | 결정을 막는 것 | 추론 전용(effect-free) | current_state |
| 20 | ap_experiment | 이번 달 결과물 | vector·experiment | action_preferences |
| 21 | pt_hold | 놓기 어려운 것 | 패턴 전용(effect-free) | action_preferences |
| 22 | pt_delay | 미루는 이유 | 패턴 전용(effect-free) | action_preferences |
| 23 | pt_direction | (구)방향에 대한 태도 | 패턴 전용(effect-free) | action_preferences |

## 2. 변경 순서 (서사 A~F)

| # | ID | 주제 | 서사 |
|---|---|---|---|
| 1 | cs_main | 지금 상태 | A. 현재 위치 |
| 2 | rc_energy | 지금 에너지 | A |
| 3 | ar_roles | 끌리는 역할 | B. 방향과 선택지 |
| 4 | rc_options | 떠오르는 선택지 수·구체성 | B |
| 5 | ar_narrow | 좁히기 어려운 이유 | B |
| 6 | or_content | 콘텐츠·자문 방향 반응 | B |
| 7 | or_venture | 창업·독립 방향 반응 | B |
| 8 | or_internal | 사내·현직 방향 반응 | B |
| 9 | cv_values | 포기하기 싫은 가치 | C. 선택 기준과 지킬 조건 |
| 10 | cv_priorities | 우선순위 | C |
| 11–14 | fc_1~fc_4 | 더 끌리는 쪽(가치 타이브레이커) | C |
| 15 | pt_hold | 놓기 어려운 것 | C |
| 16 | rc_runway | 버틸 기간 | D. 현실 조건과 검증 |
| 17 | rc_risk | 감당 손실 | D |
| 18 | rc_validation | 받은 반응(검증) | D |
| 19 | cs_blocker | 결정을 막는 것 | E. 행동과 장애물 |
| 20 | ap_experiment | 이번 달 결과물(시도할 행동) | E |
| 21 | pt_delay | 작게 해보기를 미룬 이유 | E |
| 22 | sc_outlook | 해낼 수 있다는 감각 | F. 정체성과 전환 |
| 23 | pt_direction | (신)커리어-정체성 관계 | F |

## 3. 재배열 이유

- **쉬운 현재 상태 → 점차 심리적·개인적**: 상태·에너지(A)로 가볍게 시작, 정체성·자기효능감(F)을 마지막으로 배치. sc_outlook(자기효능감)을 초반 reality_check에서 F로 이동해 "해낼 수 있는가"라는 개인적 물음을 후반에 둠. pt_direction은 마지막 회고형.
- **체감 중복 쌍의 비인접화(§6)**: 아래 쌍은 서로 다른 정보를 묻지만 연속 배치 시 반복감이 생겨 사이에 다른 문항을 둠.
  - rc_options(#4, 선택지 수) ↔ pt_direction(#23): 가장 멀리 분리(구버전 최대 중복원). 
  - cs_blocker(#19, 결정 장애물) ↔ pt_delay(#21, 실험 미룸): ap_experiment(#20)가 사이에 위치.
  - cv_priorities(#10, 우선순위) ↔ pt_hold(#15, 놓기 어려운 것): fc_1~4가 사이에 위치.
  - rc_validation(#18, 검증) ↔ ap_experiment(#20, 행동): cs_blocker(#19)가 사이에 위치.
- **주제 클러스터**: 방향/선택지(B)에 역할·선택지수·반응을, 기준(C)에 가치·우선순위·강제선택·pt_hold를, 현실(D)에 런웨이·리스크·검증을 모아 서사 연속성 확보.
- **stage 필드는 변경하지 않음**: `.stage`는 진행 헤더 라벨 표시에만 쓰이고 엔진/스코어링이 읽지 않는다. stage 재할당은 FlowStage 타입·라벨맵·stage-count 테스트를 건드리는 불필요한 리팩터링이라 배제. 대신 배열 순서만 바꿔 라벨은 각 문항 주제를 그대로 반영(서사 그룹과 라벨이 1:1로 일치하지는 않으나, 각 라벨은 해당 문항에 정확).

## 4. pt_direction 변경 전후

**전(구):** "지금 방향에 대한 태도에 가장 가까운 것은?" — 방향의 유무를 물어 rc_options(선택지 수)·ar_narrow(좁히기 이유)와 체감 중복.
- pt_dir_closed(방향 정함) / pt_dir_between(사이) / pt_dir_open(열어둠) / pt_dir_na(해당없음)

**후(신):** "지금까지 이어온 커리어가 현재의 나와 얼마나 잘 맞는다고 느끼나요?" — 커리어-정체성 관계(회고형).
- pt_dir_aligned: "지금도 나와 잘 맞고, 앞으로도 계속 이어가고 싶다" → **코드 없음**(정체성 일치, 부정 패턴 신호 없음)
- pt_dir_foreclosed: "익숙해서 이어가고 있지만, 정말 내가 원하는 길인지는 확신이 없다" → **q4:closedEarly**(identityForeclosure)
- pt_dir_liminal: "지금의 길은 더 이상 나와 맞지 않지만, 다음 방향은 아직 정하지 못했다" → **q4:inBetween**(liminality)
- pt_dir_exploring: "여러 경험을 해보며 나에게 맞는 새로운 방향을 찾는 중이다" → **q4:open**(구체 부정 패턴 강제 안 함; foreclosure veto·liminality neg)

**evidence code 유지 여부**: 기존 code 이름(q4:closedEarly/inBetween/open)이 신규 옵션 의미와 여전히 정합 → **그대로 유지**. 패턴 점수·D·confidence 임계값 무변경. 옵션 ID만 의미에 맞게 개명(aligned/foreclosed/liminal/exploring)하고, 구버전 옵션 ID(pt_dir_closed/between/open)는 `extractEvidence`에서 동일 code로 **하위호환 매핑**(과거 저장 세션 안전). aligned·na → 코드 없음.

## 5. 추가로 발견된 중복 후보 (이번 작업에서 삭제하지 않고 기록만)

- **or_content / or_venture / or_internal (3연속, #6~8)**: 동일 포맷("해당 방향에 1년 쓰면 느낌")으로 방향만 다른 세트. 의도된 3종(콘텐츠/창업/사내)이나, 연속 3문항이라 일부 사용자에게 반복감 가능. 서로 다른 방향을 측정하므로 유지. 향후 축소·통합 검토 후보.
- **cs_blocker vs pt_delay**: 둘 다 "무엇이 막는가" 계열. 각각 결정 지연(storyInsight) vs 실험 지연(패턴 엔진)으로 측정 대상이 다르나 사용자 언어상 근접. 비인접 배치로 완화. 향후 문구 차별화 검토 후보.
- **sc_outlook vs cs_blocker(blk_confidence)**: 자기효능감과 "자신 없음" 블로커가 개념적으로 겹침. 측정 계층은 다름(construct vs 추론). 유지.
- **rc_validation vs ap_experiment**: 과거 검증 정도 vs 향후 시도 결과물. 인접했으나 cs_blocker로 분리. 방향은 다르나 "시도" 어휘 근접.

## 6. 구버전 세션 호환 방식

- **복구 지점 = 문항 ID 기준 '첫 번째 미응답 문항'**: `loadHybridSession`(HybridFlowView)에서 raw stepIndex를 신뢰하지 않고, `CAREER_QUESTION_FLOW.findIndex(s => !isStepComplete(s, responses[s.id]))`로 재개 인덱스를 계산. 순서가 바뀌어도 이미 답한 문항을 건너뛰고 첫 공백에서 재개. 모든 문항 답변 시 마지막 인덱스(그리고 done이면 결과 단계).
- **응답 해석은 ID 기준**: `buildResultFromResponses`는 전부 `responses[id]`로 읽어 순서 무관 → 완료된 기존 세션 결과 불변.
- **pt_direction 옵션 하위호환**: 구 옵션 ID → 동일 evidence code로 매핑, 스코어링 무영향.
- **검증(브라우저)**: 구버전 raw stepIndex=10(구 order) + 첫 10문항 응답 세션을 새 흐름으로 로드 → 신 order 첫 미응답(rc_energy, index 1)에서 재개(2/23), 크래시·콘솔 오류 없음. 이전/다음/답변 수정 정상, pt_direction(foreclosed)→identityForeclosure 산출.
