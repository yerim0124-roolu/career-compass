// Career Compass 2.0 — card-based question flow (data + small helpers).
// Low-friction: users tap/select/rank/slide. The only typing allowed is one
// optional short memo (ap_memo). Every choice card carries scoreEffects and/or
// gateAssignment and/or constructEffects so the engines can run headlessly.
//
// Two parallel measurement channels per card:
//   - scoreEffects   → CareerVector (identity / option fit)
//   - constructEffects → SCCT / Career Adaptability / CDDQ / MCDA constructs
// Saju is NOT in this flow — it appears only after the result. Tone: calm,
// professional, supportive; no MBTI "you are X" framing and no fortune-telling.

import type {
  QuestionStep,
  ChoiceOption,
  CareerOptionKey,
  ReadinessGates,
  ConstructProfile,
} from '../types/careerCompass.ts';
import { createEmptyConstructProfile, applyConstructEffects, normalizeConstructProfile } from '../lib/careerConstructEngine.ts';
// 타입 전용 import(런타임 순환 없음) — 조건부 흐름 helper의 입력 타입.
import type { FlowResponses } from '../components/careerCompassV2/session.ts';

// ─── Stage 1: current_state (single_select) ───────────────────────────────────
const currentState: QuestionStep = {
  id: 'cs_main',
  stage: 'current_state',
  inputType: 'single_select',
  title: '지금 상태',
  assistantPrompt: '요즘 가장 가까운 상태를 하나만 골라주세요.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    // P3.13 — cs_many와 cs_between이 둘 다 optionOverload를 측정해 중복(상호배타성 위반).
    // 차별화: cs_many = 내적 흥미 과잉(하고 싶은 게 많음 → scatteredExplorer),
    //         cs_between = 판단 기준 부재(길은 보이나 무엇을 먼저 둘지 모름 → conflictedAtFork).
    { id: 'cs_many', label: '하고 싶은 게 많아 하나로 못 좁히겠다', description: '관심사가 넘쳐서 우선순위가 안 선다', tags: ['state'], scoreEffects: { autonomy: 3, creativity: 2, marketValidationNeed: 4 }, constructEffects: { difficulty: { optionOverload: 5 }, adaptability: { curiosity: 3 } } },
    { id: 'cs_stay', label: '지금 일을 계속할지 모르겠다', description: '버티는 게 맞는지, 바꾸는 게 맞는지', tags: ['state'], scoreEffects: { marketValidationNeed: 3, recoveryNeed: 2, stability: 2 }, constructEffects: { difficulty: { readinessGap: 4, selfInformationGap: 3 } } },
    { id: 'cs_expand', label: '전문성을 어떻게 확장할지 모르겠다', description: '쌓아온 경력을 다음 단계로 잇고 싶다', tags: ['state'], scoreEffects: { expertise: 4, impactOrientation: 3, marketOrientation: 2 }, constructEffects: { adaptability: { concern: 4, curiosity: 2 }, scct: { goalClarity: 3 } } },
    { id: 'cs_between', label: '어느 길로 갈지 기준이 안 선다', description: '이직·사내 이동·창업 등 길은 보이는데, 무엇을 먼저 둘지 모르겠다', tags: ['state'], scoreEffects: { marketValidationNeed: 2 }, constructEffects: { difficulty: { valueConflict: 4, optionOverload: 3 } } },
    { id: 'cs_rest', label: '쉬어야 할지 밀어붙여야 할지 모르겠다', description: '방향 문제인지 에너지 문제인지 헷갈린다', tags: ['state'], scoreEffects: { recoveryNeed: 5 }, constructEffects: { difficulty: { readinessGap: 5 } } },
  ],
};

// ─── Stage 2: attractive_roles (multi_select 2–4) ─────────────────────────────
const attractiveRoles: QuestionStep = {
  id: 'ar_roles',
  stage: 'attractive_roles',
  inputType: 'multi_select',
  title: '끌리는 역할',
  // P2 — '2~4개' 앵커링이 다중 관심을 유도하고(최대 4) 단일 집중형도 억지로 2번째를 고르게(최소 2)
  // 만들어 breadth 신호를 왜곡했다. min1·max3 + '실제로 시간 써서 확인하고 싶은 것만'으로 낮게 앵커링.
  assistantPrompt: '이번 달에 실제로 시간을 써서 알아보고 싶은 역할만 골라주세요. 가볍게 흥미로운 건 빼고요. 하나여도 괜찮아요. (직함이 아니라 일하는 방식에 가깝게)',
  minSelect: 1,
  maxSelect: 3,
  liveInsightTrigger: true,
  options: [
    { id: 'ar_expert', label: '전문가', description: '깊은 지식과 신뢰로 일하는 사람', tags: ['role'], scoreEffects: { expertise: 5, stability: 2, impactOrientation: 2 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'ar_creator', label: '크리에이터', description: '생각을 콘텐츠로 표현하는 사람', tags: ['role'], scoreEffects: { creativity: 5, impactOrientation: 3, autonomy: 2 }, constructEffects: { adaptability: { curiosity: 3 } } },
    { id: 'ar_founder', label: '창업가', description: '문제를 제품·서비스로 직접 푸는 사람', tags: ['role'], scoreEffects: { ventureOrientation: 5, executionDrive: 4, autonomy: 3, riskTolerance: 3 }, constructEffects: { adaptability: { curiosity: 3, control: 2 }, scct: { selfEfficacy: 2 } } },
    { id: 'ar_analyst', label: '투자자·분석가', description: '시장과 가능성을 해석하는 사람', tags: ['role'], scoreEffects: { marketOrientation: 5, analysisOrientation: 5, impactOrientation: 2 }, constructEffects: { adaptability: { concern: 2 } } },
    { id: 'ar_advisor', label: '자문가', description: '전문성으로 방향을 짚어주는 사람', tags: ['role'], scoreEffects: { expertise: 4, impactOrientation: 3, autonomy: 2 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'ar_leader', label: '조직 내 리더', description: '팀과 함께 성과를 만드는 사람', tags: ['role'], scoreEffects: { executionDrive: 4, stability: 3, impactOrientation: 3 }, constructEffects: { adaptability: { control: 3 } } },
    // P3.13 — RIASEC 균형(content validity): 기존 옵션이 Enterprising·Investigative에 쏠려
    // 일반 직장인이 고를 Conventional(체계적 실무)·Social(협업·조력)이 없던 결함을 보완.
    { id: 'ar_steady', label: '안정적 기여자', description: '맡은 일을 책임감 있게 해내는 사람', tags: ['role'], scoreEffects: { stability: 5, executionDrive: 2, expertise: 1 }, constructEffects: { adaptability: { control: 2 }, scct: { selfEfficacy: 2 } } },
    { id: 'ar_helper', label: '협업·조력자', description: '사람들을 돕고 연결하는 사람', tags: ['role'], scoreEffects: { impactOrientation: 4, stability: 2, executionDrive: 1 }, constructEffects: { adaptability: { concern: 2, control: 1 } } },
    { id: 'ar_freelancer', label: '프리랜서', description: '내 방식대로 일을 꾸리는 사람', tags: ['role'], scoreEffects: { autonomy: 5, marketOrientation: 2, riskTolerance: 2 }, constructEffects: { adaptability: { control: 2, curiosity: 1 } } },
    { id: 'ar_reset', label: '재정비하는 사람', description: '잠시 멈추고 정비하는 시기', tags: ['role'], scoreEffects: { recoveryNeed: 4 }, constructEffects: { difficulty: { readinessGap: 2 } } },
  ],
};

// ─── 좁히지 못하는 이유 (Phase 2, 스펙 6·7 병합) — 추론 전용 신호 (effect-free). 엔진의 벡터·
// 게이트·construct는 이 답을 읽지 않는다(scoreEffects/constructEffects 비움). storyInsight가
// '왜 못 좁히는지'를 짚는 데, 그리고 분류에서 scattered/conflicted/validation 경계를 가르는
// 타이브레이커로만 쓴다. 자기 유형을 직접 고르게 하지 않고 *이유*로 간접 추론한다. ──
const narrowingReason: QuestionStep = {
  id: 'ar_narrow',
  stage: 'attractive_roles',
  inputType: 'single_select',
  title: '좁히기 어려운 이유',
  // 문구 수정만: rc_options(선택지 수) 직후라 전제('여러 방향을 두고 고민 중')가 안 맞는 사용자를
  // 위해 리드를 중립화하고, 방향이 없어도 답할 수 있게 안내를 추가. 선택지·효과값 불변.
  assistantPrompt: '지금 방향을 하나로 좁히기 어려운 가장 큰 이유는 무엇인가요?',
  helperText: '아직 뚜렷한 방향이 없다면, 지금 마음에 가장 가까운 항목을 골라주세요.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'nr_explore', label: '여러 개를 실제로 해보고 싶어서, 아직 가능성을 닫기 싫다', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
    { id: 'nr_loss', label: '어느 쪽을 골라도 중요한 걸 하나 잃는 느낌이라', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
    { id: 'nr_safety', label: '돈·안정 때문에 쉽게 못 버려서', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
    { id: 'nr_continuity', label: '지금까지 쌓아온 경험과 연결돼 있어서', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
    { id: 'nr_unsure', label: '한 방향은 보이는데, 실제로 될지 확신이 없어서', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
    { id: 'nr_decided', label: '사실 거의 하나로 정해졌다', tags: ['narrow'], scoreEffects: {}, constructEffects: {} },
  ],
};

// ─── Stage 3: core_values (multi_select up to 5, then ranking → MCDA weights) ──
const coreValues: QuestionStep = {
  id: 'cv_values',
  stage: 'core_values',
  inputType: 'multi_select',
  title: '포기하기 싫은 가치',
  assistantPrompt: '앞으로의 일에서 포기하기 싫은 것을 골라주세요.',
  minSelect: 1,
  maxSelect: 5,
  options: [
    { id: 'cv_autonomy', label: '자율성', tags: ['value'], scoreEffects: { autonomy: 4 } },
    { id: 'cv_stability', label: '안정성', tags: ['value'], scoreEffects: { stability: 4 } },
    { id: 'cv_money', label: '수익성', tags: ['value'], scoreEffects: { financialReadiness: 3, marketOrientation: 2 } },
    { id: 'cv_growth', label: '성장', tags: ['value'], scoreEffects: { expertise: 2, executionDrive: 2 } },
    { id: 'cv_expertise', label: '전문성', tags: ['value'], scoreEffects: { expertise: 4 } },
    { id: 'cv_impact', label: '영향력', tags: ['value'], scoreEffects: { impactOrientation: 4 } },
    { id: 'cv_creativity', label: '창작', tags: ['value'], scoreEffects: { creativity: 4 } },
    { id: 'cv_meaning', label: '사회적 의미', tags: ['value'], scoreEffects: { impactOrientation: 3 } },
    { id: 'cv_recovery', label: '회복', tags: ['value'], scoreEffects: { recoveryNeed: 4 } },
    { id: 'cv_problem', label: '문제 해결', tags: ['value'], scoreEffects: { ventureOrientation: 3, executionDrive: 2 } },
    { id: 'cv_knowledge', label: '지식 생산', tags: ['value'], scoreEffects: { analysisOrientation: 3, expertise: 2 } },
    { id: 'cv_bigmarket', label: '큰 시장', tags: ['value'], scoreEffects: { marketOrientation: 3, ventureOrientation: 2 } },
  ],
};

const corePriorities: QuestionStep = {
  id: 'cv_priorities',
  stage: 'core_values',
  inputType: 'ranking',
  title: '우선순위',
  assistantPrompt: '앞으로 1년, 가장 중요하게 보고 싶은 기준을 위에서부터 순서대로 정렬해주세요.',
  helperText: '위에 둘수록 가중치가 커집니다.',
  minSelect: 3,
  maxSelect: 7,
  options: [
    { id: 'pr_money', label: '돈', tags: ['priority'], scoreEffects: { financialReadiness: 3, marketOrientation: 2 }, constructEffects: { mcda: { financialSafety: 5 } } },
    { id: 'pr_meaning', label: '의미', tags: ['priority'], scoreEffects: { impactOrientation: 3 }, constructEffects: { mcda: { impact: 5 } } },
    { id: 'pr_freedom', label: '자유', tags: ['priority'], scoreEffects: { autonomy: 3 }, constructEffects: { mcda: { autonomy: 5 } } },
    { id: 'pr_growth', label: '성장', tags: ['priority'], scoreEffects: { expertise: 2, executionDrive: 2 }, constructEffects: { mcda: { assetLeverage: 4, identityFit: 2 } } },
    { id: 'pr_stability', label: '안정', tags: ['priority'], scoreEffects: { stability: 3 }, constructEffects: { mcda: { energySustainability: 3, financialSafety: 2 } } },
    { id: 'pr_influence', label: '영향력', tags: ['priority'], scoreEffects: { impactOrientation: 3, marketOrientation: 1 }, constructEffects: { mcda: { impact: 4, marketPotential: 3 } } },
    { id: 'pr_recovery', label: '회복', tags: ['priority'], scoreEffects: { recoveryNeed: 3 }, constructEffects: { mcda: { energySustainability: 5 } } },
  ],
};

// ─── Stage 4: forced_choices (4 × forced_choice) ──────────────────────────────
const fc = (
  id: string,
  prompt: string,
  a: ChoiceOption,
  b: ChoiceOption,
  liveInsightTrigger = false,
): QuestionStep => ({
  id, stage: 'forced_choices', inputType: 'forced_choice', title: '더 끌리는 쪽',
  assistantPrompt: prompt, minSelect: 1, maxSelect: 1, liveInsightTrigger, options: [a, b],
});

const forcedChoices: QuestionStep[] = [
  fc('fc_1', '둘 중 더 끌리는 쪽을 골라주세요.',
    { id: 'fc1_expert', label: '깊이 있는 전문가가 되고 싶다', tags: ['fc'], scoreEffects: { expertise: 4 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'fc1_connector', label: '여러 영역을 연결하는 사람이 되고 싶다', tags: ['fc'], scoreEffects: { marketOrientation: 3, autonomy: 2, impactOrientation: 2 }, constructEffects: { adaptability: { curiosity: 2 } } }),
  fc('fc_2', '둘 중 더 끌리는 쪽을 골라주세요.',
    { id: 'fc2_stable', label: '안정적인 구조 안에서 성장하고 싶다', tags: ['fc'], scoreEffects: { stability: 4 }, constructEffects: { scct: { contextualSupport: 2 } } },
    { id: 'fc2_builder', label: '직접 판을 만들고 싶다', tags: ['fc'], scoreEffects: { ventureOrientation: 4, autonomy: 3, riskTolerance: 2 }, constructEffects: { adaptability: { control: 3 }, scct: { selfEfficacy: 1 } } }),
  fc('fc_3', '둘 중 더 끌리는 쪽을 골라주세요.',
    { id: 'fc3_quiet', label: '조용히 실력을 쌓고 싶다', tags: ['fc'], scoreEffects: { expertise: 3, stability: 2 } },
    { id: 'fc3_public', label: '내 생각이나 성과를 더 드러내고 싶다', tags: ['fc'], scoreEffects: { impactOrientation: 4, creativity: 2 }, constructEffects: { adaptability: { confidence: 2 } } }),
  // depth-vs-breadth is already covered by fc_1, so the last forced choice is maker-vs-interpreter.
  fc('fc_4', '둘 중 더 끌리는 쪽을 골라주세요.',
    { id: 'fc4_maker', label: '좋은 것을 직접 만들고 싶다', tags: ['fc'], scoreEffects: { ventureOrientation: 3, executionDrive: 3, creativity: 2 }, constructEffects: { adaptability: { control: 2 } } },
    { id: 'fc4_interpreter', label: '좋은 것을 선별하고 해석하고 싶다', tags: ['fc'], scoreEffects: { analysisOrientation: 4, marketOrientation: 3 }, constructEffects: { adaptability: { concern: 2 } } },
    true),
];

// ─── Stage 5: reality_check (SCCT self-read + band cards → readiness gates) ────
// One natural SCCT item (self-efficacy × outcome expectation) keeps the construct
// model explicit without feeling like a questionnaire.
const selfOutlook: QuestionStep = {
  id: 'sc_outlook',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '해낼 수 있을까',
  assistantPrompt: '새로운 방향을 시작한다고 상상하면, 어느 쪽에 가장 가까운가요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'sc_both', label: '잘 해낼 자신도 있고, 주변(조직·동료·고객)도 알아줄 것 같다', tags: ['scct'], scoreEffects: { executionDrive: 2 }, constructEffects: { scct: { selfEfficacy: 5, outcomeExpectation: 5 }, adaptability: { confidence: 4 } } },
    { id: 'sc_self_only', label: '잘 해낼 순 있지만, 실제 반응은 어떨지 모르겠다', tags: ['scct'], scoreEffects: { executionDrive: 1 }, constructEffects: { scct: { selfEfficacy: 5, outcomeExpectation: 1 }, adaptability: { confidence: 3 }, difficulty: { marketInformationGap: 4 } } },
    { id: 'sc_market_only', label: '결과는 따라올 것 같은데, 내가 잘 해낼지 모르겠다', tags: ['scct'], scoreEffects: { marketOrientation: 1 }, constructEffects: { scct: { selfEfficacy: 1, outcomeExpectation: 5 }, adaptability: { confidence: 1 }, difficulty: { selfInformationGap: 3 } } },
    { id: 'sc_unsure', label: '둘 다 아직 확신이 없다', tags: ['scct'], scoreEffects: { recoveryNeed: 1 }, constructEffects: { scct: { selfEfficacy: 1, outcomeExpectation: 1 }, difficulty: { readinessGap: 5 } } },
  ],
};

// Perceived option visibility — Hope Theory "pathways" probe.
// Captures the "no visible options" state (lowOptionVisibility) without relying on
// identity-axis suppression. Uses existing CDDQ fields (selfInformationGap / optionOverload /
// valueConflict) and adaptability.curiosity — no new construct. rc_opt_few drives selfInfoGap
// up (the engine's lowOptionVisibility gate); rc_opt_many drives optionOverload up (the
// engine's scatteredExplorer gate). The two extremes therefore route to different mainTypes
// without overlapping.
const realityOptions: QuestionStep = {
  id: 'rc_options',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '떠오르는 선택지',
  assistantPrompt: '지금 현실적으로 떠오르는 다음 선택지는 어느 정도인가요?',
  helperText: '구체적인 형태가 아니라 막연한 방향이어도 괜찮아요. 현실적으로 떠오르는 정도로 답해주세요.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'rc_opt_few', label: '거의 없다 — 무엇을 할 수 있을지 잘 보이지 않는다', tags: ['options'], scoreEffects: {}, constructEffects: { difficulty: { selfInformationGap: 5 } } },
    { id: 'rc_opt_some', label: '1~2개는 있다 — 하지만 아직 구체적이지는 않다', tags: ['options'], scoreEffects: {}, constructEffects: { difficulty: { selfInformationGap: 2 } } },
    { id: 'rc_opt_several', label: '3개 이상 있다 — 하지만 무엇을 골라야 할지 어렵다', tags: ['options'], scoreEffects: {}, constructEffects: { difficulty: { valueConflict: 3 }, scct: { goalClarity: 2 } } },
    { id: 'rc_opt_many', label: '너무 많다 — 정리하지 않으면 계속 분산될 것 같다', tags: ['options'], scoreEffects: {}, constructEffects: { difficulty: { optionOverload: 5 }, adaptability: { curiosity: 2 } } },
  ],
};

// No exact financial numbers. Each card assigns a gate level (+ light vector/construct nudges).
const realityRunway: QuestionStep = {
  id: 'rc_runway',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '버틸 수 있는 기간',
  assistantPrompt: '일을 잠시 줄이거나 바꿔도 버틸 수 있는 기간은 어느 정도인가요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'rc_runway_lt1', label: '1개월 미만', tags: ['runway'], scoreEffects: {}, gateAssignment: { runway: 'critical' }, constructEffects: { scct: { contextualBarrier: 5 } } },
    { id: 'rc_runway_1to3', label: '1~3개월', tags: ['runway'], scoreEffects: { financialReadiness: 1 }, gateAssignment: { runway: 'tight' }, constructEffects: { scct: { contextualBarrier: 3 } } },
    { id: 'rc_runway_3to6', label: '3~6개월', tags: ['runway'], scoreEffects: { financialReadiness: 2 }, gateAssignment: { runway: 'moderate' } },
    { id: 'rc_runway_6to12', label: '6~12개월', tags: ['runway'], scoreEffects: { financialReadiness: 4 }, gateAssignment: { runway: 'comfortable' }, constructEffects: { scct: { contextualSupport: 3 } } },
    { id: 'rc_runway_1y', label: '1년 이상', tags: ['runway'], scoreEffects: { financialReadiness: 5 }, gateAssignment: { runway: 'extended' }, constructEffects: { scct: { contextualSupport: 5 } } },
    { id: 'rc_runway_unknown', label: '잘 모르겠다', tags: ['runway'], scoreEffects: {}, gateAssignment: { runway: 'unknown' }, constructEffects: { difficulty: { selfInformationGap: 3 } } },
  ],
};

const realityEnergy: QuestionStep = {
  id: 'rc_energy',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '지금 에너지',
  assistantPrompt: '지금 에너지는 어느 쪽에 가깝나요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'rc_energy_rest', label: '당장 쉬어야 한다', tags: ['energy'], scoreEffects: { recoveryNeed: 5 }, gateAssignment: { energy: 'depleted' }, constructEffects: { difficulty: { readinessGap: 4 } } },
    { id: 'rc_energy_tired', label: '버티고 있지만 많이 지쳤다', tags: ['energy'], scoreEffects: { recoveryNeed: 4 }, gateAssignment: { energy: 'strained' }, constructEffects: { difficulty: { readinessGap: 2 } } },
    { id: 'rc_energy_ok', label: '보통이다', tags: ['energy'], scoreEffects: { recoveryNeed: 2 }, gateAssignment: { energy: 'steady' } },
    { id: 'rc_energy_capacity', label: '새 프로젝트를 시작할 여력은 있다', tags: ['energy'], scoreEffects: { recoveryNeed: 1 }, gateAssignment: { energy: 'capacity' }, constructEffects: { adaptability: { control: 2 } } },
    { id: 'rc_energy_high', label: '에너지가 꽤 높다', tags: ['energy'], scoreEffects: {}, gateAssignment: { energy: 'high' }, constructEffects: { adaptability: { control: 3, confidence: 2 } } },
  ],
};

const realityRisk: QuestionStep = {
  id: 'rc_risk',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '감당 가능한 손실',
  assistantPrompt: '실패했을 때 감당할 수 있는 손실은 어느 정도인가요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'rc_risk_none', label: '거의 없다', tags: ['risk'], scoreEffects: {}, gateAssignment: { risk: 'none' }, constructEffects: { scct: { contextualBarrier: 3 } } },
    { id: 'rc_risk_time', label: '시간 일부는 가능', tags: ['risk'], scoreEffects: { riskTolerance: 1 }, gateAssignment: { risk: 'timeOnly' } },
    { id: 'rc_risk_cost', label: '작은 비용은 가능', tags: ['risk'], scoreEffects: { riskTolerance: 2 }, gateAssignment: { risk: 'smallCost' } },
    { id: 'rc_risk_exp', label: '3개월 실험 정도는 가능', tags: ['risk'], scoreEffects: { riskTolerance: 4 }, gateAssignment: { risk: 'experiment' }, constructEffects: { adaptability: { confidence: 2 } } },
    { id: 'rc_risk_income', label: '일정 기간 수입 감소도 가능', tags: ['risk'], scoreEffects: { riskTolerance: 5 }, gateAssignment: { risk: 'incomeDrop' }, constructEffects: { adaptability: { control: 3, confidence: 2 } } },
  ],
};

const realityValidation: QuestionStep = {
  id: 'rc_validation',
  stage: 'reality_check',
  inputType: 'single_select',
  title: '지금 방향에 받은 반응',
  assistantPrompt: '지금 시도하려는 방향에 대해, 실제 반응을 확인한 정도는 어디에 가깝나요?',
  helperText: '아직 정해진 방향이 없다면 첫 번째(혼자 생각만)를 골라도 됩니다.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'rc_val_none', label: '아직 혼자 생각만 해봤어요', tags: ['validation'], scoreEffects: { marketValidationNeed: 5 }, gateAssignment: { marketValidation: 'unvalidated' }, constructEffects: { difficulty: { marketInformationGap: 5 } } },
    { id: 'rc_val_early', label: '주변 사람에게 의견을 들어본 정도예요', tags: ['validation'], scoreEffects: { marketValidationNeed: 4 }, gateAssignment: { marketValidation: 'early' }, constructEffects: { difficulty: { marketInformationGap: 3 } } },
    { id: 'rc_val_partial', label: '작게 시도했을 때 긍정적인 반응이 있었어요', tags: ['validation'], scoreEffects: { marketValidationNeed: 2 }, gateAssignment: { marketValidation: 'partial' }, constructEffects: { scct: { outcomeExpectation: 2 } } },
    { id: 'rc_val_done', label: '실제 요청·제안·구매 의향처럼 구체적인 신호가 있었어요', tags: ['validation'], scoreEffects: {}, gateAssignment: { marketValidation: 'validated' }, constructEffects: { scct: { outcomeExpectation: 4 } } },
  ],
};

// ─── Stage 6: option_reactions (feeling cards → fit + validation + value conflict) ──
// or_content/or_venture/or_internal — 세 방향을 '같은 척도'로 비교하는 세트(가능성 비교 1~3/3).
// 소라벨 + 첫 문장 리드를 방향별로 명확히 달리해 '반복'이 아니라 '의도된 비교'로 읽히게 한다.
// 선택지·ID·scoreEffects·constructEffects·응답 저장·엔진 매핑은 변경하지 않는다.
const reactionContent: QuestionStep = {
  id: 'or_content',
  stage: 'option_reactions',
  inputType: 'single_select',
  title: '콘텐츠·자문 방향',
  comparisonLabel: '가능성 비교 · 1/3',
  assistantPrompt: '전문지식을 콘텐츠로 풀어내는 일을 떠올리면, 가장 먼저 어떤 느낌이 드나요?',
  helperText: '세 가지 방향을 같은 기준으로 빠르게 비교해볼게요.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'orc_energized', label: '에너지가 생긴다', tags: ['reaction'], scoreEffects: { creativity: 3, impactOrientation: 3 }, constructEffects: { scct: { outcomeExpectation: 3, selfEfficacy: 2 } } },
    { id: 'orc_meaning_money', label: '의미 있지만 돈이 걱정된다', tags: ['reaction'], scoreEffects: { impactOrientation: 2, marketValidationNeed: 3 }, constructEffects: { difficulty: { valueConflict: 4 } } },
    { id: 'orc_money_tiring', label: '돈은 될 수 있지만 피곤할 것 같다', tags: ['reaction'], scoreEffects: { marketOrientation: 2, recoveryNeed: 3 }, constructEffects: { difficulty: { valueConflict: 3 } } },
    { id: 'orc_capable_flat', label: '잘할 수 있지만 설레지는 않는다', tags: ['reaction'], scoreEffects: { expertise: 2 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'orc_unsure', label: '아직 모르겠다', tags: ['reaction'], scoreEffects: { marketValidationNeed: 2 }, constructEffects: { difficulty: { marketInformationGap: 3 } } },
  ],
};

const reactionVenture: QuestionStep = {
  id: 'or_venture',
  stage: 'option_reactions',
  inputType: 'single_select',
  title: '창업·독립 방향',
  comparisonLabel: '가능성 비교 · 2/3',
  assistantPrompt: '직접 사업이나 프로젝트를 만드는 일을 떠올리면, 가장 먼저 어떤 느낌이 드나요?',
  minSelect: 1,
  maxSelect: 1,
  // liveInsightTrigger moved to or_internal so the insight fires after the full option_reactions stage.
  options: [
    { id: 'orv_energized', label: '에너지가 생긴다', tags: ['reaction'], scoreEffects: { ventureOrientation: 3, executionDrive: 2 }, constructEffects: { scct: { selfEfficacy: 2, outcomeExpectation: 2 }, adaptability: { control: 2 } } },
    { id: 'orv_meaning_money', label: '의미 있지만 돈이 걱정된다', tags: ['reaction'], scoreEffects: { ventureOrientation: 2, marketValidationNeed: 3 }, constructEffects: { difficulty: { valueConflict: 4 } } },
    { id: 'orv_money_tiring', label: '돈은 될 수 있지만 피곤할 것 같다', tags: ['reaction'], scoreEffects: { marketOrientation: 2, recoveryNeed: 3 }, constructEffects: { difficulty: { valueConflict: 3 } } },
    { id: 'orv_capable_flat', label: '잘할 수 있지만 설레지는 않는다', tags: ['reaction'], scoreEffects: { executionDrive: 2 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'orv_unsure', label: '아직 모르겠다', tags: ['reaction'], scoreEffects: { marketValidationNeed: 2 }, constructEffects: { difficulty: { marketInformationGap: 3 } } },
  ],
};

// Third reaction probe — balances the stage with an internal (사내·현직) direction so org-based
// workers don't only react to external content/advisory or startup/independent paths.
const reactionInternal: QuestionStep = {
  id: 'or_internal',
  stage: 'option_reactions',
  inputType: 'single_select',
  title: '사내·현직 방향',
  comparisonLabel: '가능성 비교 · 3/3',
  assistantPrompt: '조직 안에서 새로운 역할로 확장하는 일을 떠올리면, 가장 먼저 어떤 느낌이 드나요?',
  helperText: '사내 이동, 역할 확장, 업무 방식 개선, 새 책임 맡기처럼 현재 기반 안에서 바꾸는 방향을 떠올려보세요.',
  minSelect: 1,
  maxSelect: 1,
  liveInsightTrigger: true,
  options: [
    { id: 'ori_energized', label: '해볼 만하고 에너지가 생긴다', tags: ['reaction'], scoreEffects: { stability: 3, executionDrive: 3 }, constructEffects: { scct: { outcomeExpectation: 3, selfEfficacy: 2 }, adaptability: { control: 2 } } },
    { id: 'ori_meaning_slow', label: '의미는 있지만, 합의나 변화 속도가 걸릴 것 같다', tags: ['reaction'], scoreEffects: { stability: 2, impactOrientation: 1 }, constructEffects: { difficulty: { valueConflict: 4 } } },
    { id: 'ori_stable_flat', label: '안정적이지만 성장감은 부족할 것 같다', tags: ['reaction'], scoreEffects: { stability: 2 }, constructEffects: { difficulty: { valueConflict: 3 }, scct: { contextualSupport: 1 } } },
    { id: 'ori_capable_flat', label: '잘할 수는 있지만 크게 끌리지는 않는다', tags: ['reaction'], scoreEffects: { stability: 1, expertise: 2 }, constructEffects: { scct: { selfEfficacy: 2 } } },
    { id: 'ori_unsure', label: '아직은 잘 모르겠다', tags: ['reaction'], scoreEffects: {}, constructEffects: { difficulty: { selfInformationGap: 2 } } },
  ],
};

// ─── 결정 블로커 — 추론 전용 신호 (effect-free). 엔진(벡터·게이트·분류)은 이 답을 절대 읽지
// 않는다(scoreEffects/constructEffects 비움). storyInsight가 다른 신호와 교차해 '무엇이 막고
// 있는지'를 리프레임하는 데만 쓴다. 1클릭이라 답하기 쉽고, 거의 모든 답변과 교차 가능. ──
const decisionBlocker: QuestionStep = {
  id: 'cs_blocker',
  stage: 'current_state', // 결정 상태(무엇이 막는지) — reaction 3종 카운트와 분리
  inputType: 'single_select',
  title: '결정을 막는 것',
  // 상위 질문: 전체 장애물을 넓게 확인(방향 불명확/자신감/현실 조건/주변 기대/되돌리기
  // 두려움/시간·에너지). 손실·아까움 신호가 나타난 경우에만 pt_hold(조건부 후속)로 이어진다.
  assistantPrompt: '지금 행동으로 옮기는 데 가장 크게 걸리는 것은 무엇인가요? 하나만 골라주세요.',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'blk_unclear', label: '내가 뭘 원하는지 아직 또렷하지 않다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
    { id: 'blk_confidence', label: '잘 해낼 수 있을지 자신이 없다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
    { id: 'blk_money', label: '돈·생활 같은 현실 조건이 걸린다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
    { id: 'blk_eyes', label: '주변 시선이나 기대가 신경 쓰인다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
    { id: 'blk_fail', label: '잘못되면 되돌리기 어려울까 봐 두렵다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
    { id: 'blk_time', label: '시간·에너지가 없어 엄두가 안 난다', tags: ['blocker'], scoreEffects: {}, constructEffects: {} },
  ],
};

// ─── Stage 7: action_preferences (pick a low-friction output format + optional memo) ──
// Reframed around "결과물 형식" (output format) rather than startup-style experiments, so
// general workers / professionals / researchers / org-based users relate to it too.
const actionExperiment: QuestionStep = {
  id: 'ap_experiment',
  stage: 'action_preferences',
  inputType: 'single_select',
  title: '이번 달 결과물',
  assistantPrompt: '이번 달 가장 부담 없이 남겨볼 수 있는 결과물은 무엇인가요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'ap_writing', label: '글/리포트/메모', description: '생각이나 전문성을 글로 정리해보는 방식', tags: ['experiment'], scoreEffects: { analysisOrientation: 2 } },
    { id: 'ap_content', label: '짧은 콘텐츠', description: '짧은 글, 카드, 영상 등으로 가볍게 반응을 보는 방식', tags: ['experiment'], scoreEffects: { creativity: 2 } },
    { id: 'ap_portfolio', label: '포트폴리오/케이스', description: '내가 해온 일이나 성과를 사례로 정리하는 방식', tags: ['experiment'], scoreEffects: { expertise: 2 } },
    { id: 'ap_interview', label: '사람과 대화/인터뷰', description: '관심 있는 사람, 동료, 고객, 업계 사람에게 직접 물어보는 방식', tags: ['experiment'], scoreEffects: { ventureOrientation: 2 } },
    { id: 'ap_redesign', label: '내부 제안서/업무 개선안', description: '현재 자리에서 역할이나 방식을 작게 바꿔보는 방식', tags: ['experiment'], scoreEffects: { stability: 2 } },
    { id: 'ap_profile', label: '프로필/이력서', description: '나의 경험을 밖에서도 읽히게 정리하는 방식', tags: ['experiment'], scoreEffects: { marketOrientation: 2 } },
    { id: 'ap_rest', label: '회복 루틴', description: '에너지와 생활 리듬을 먼저 회복하는 방식', tags: ['experiment'], scoreEffects: { recoveryNeed: 3 } },
    { id: 'ap_unsure', label: '아직 모르겠음', description: '아직은 결과물보다 기준을 먼저 정리해야 하는 상태', tags: ['experiment'], scoreEffects: {}, constructEffects: { difficulty: { optionOverload: 2 } } },
  ],
};

// P3.11 — 자유 입력 'ap_memo'(한 줄 더하고 싶은 말)는 제거됨. 분류(벡터/construct/게이트)·
// 결과지·narrative 어디에서도 읽지 않던 죽은 필드라(입력해도 사라짐) 마지막 문항을 30일
// 실험 선택(actionExperiment)으로 끝낸다.

// ─── Career Pattern v1 판별 문항 (Q1~Q4) — effect-free ────────────────────────
// 16개 커리어 고민 패턴 분류(biasPatternEngine)만 읽는 추론 전용 문항. ar_narrow·
// cs_blocker와 동일하게 scoreEffects/constructEffects를 비워, 벡터·construct·gate·
// mainType·subtype·friction·readiness 산출에 0 기여한다(기존 결과 완전 불변).
// ID는 'pt_' 네임스페이스로 기존 문항 ID(cs_/ar_/cv_/fc_/sc_/rc_/or_/ap_)와 미충돌.
// 근거: docs/research/career-pattern-v1-spec.md §3.
// pt_hold — cs_blocker의 '조건부 후속 질문'. 정적 정의에는 남겨두되(길이·하위호환 유지),
// 실제 노출은 getActiveCareerQuestionFlow가 shouldAskPtHold=true일 때만 cs_blocker 바로 뒤에
// 삽입한다. 기본 진행률 분모에는 포함하지 않는다(countsTowardProgress:false → '추가 확인').
// 옵션 ID와 evidence 매핑(q1:*)은 그대로 유지하고 라벨만 재작성. effect-free 유지.
const patternHold: QuestionStep = {
  id: 'pt_hold',
  stage: 'action_preferences',
  title: '놓기 어려운 것',
  inputType: 'single_select',
  comparisonLabel: '추가 확인',
  assistantPrompt: '새로운 선택을 할 때, 가장 포기하기 어려운 것은 무엇인가요?',
  helperText: '결정을 막는 전체 이유가 아니라, 지금 놓기 어려운 대상에 가까운 것을 골라주세요.',
  conditionalFollowUp: true,
  countsTowardProgress: false,
  parentQuestionId: 'cs_blocker',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'pt_hold_sunk', label: '이미 들인 시간과 노력', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },        // → sunkCost
    { id: 'pt_hold_endow', label: '지금 가진 직함·안정·관계', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },     // → endowmentEffect
    { id: 'pt_hold_loss', label: '선택하지 않게 될 다른 가능성', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },   // → lossAversion
    { id: 'pt_hold_none', label: '특별히 포기하기 어려운 것은 없다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} }, // → 코드 없음
  ],
};

const patternDelay: QuestionStep = {
  id: 'pt_delay',
  stage: 'action_preferences',
  inputType: 'single_select',
  title: '미루는 이유',
  // 문구 수정만: 직전 문항(ap_experiment)에서 고른 '결과물'을 앵커로 삼아 cs_blocker와의 반복감을
  // 없애고, 이 문항이 '그 행동을 아직 시작 못 한 이유'임을 명확히 한다. 이미 실행 중인 사용자는
  // 'pt_delay_acting(이미 작게 해보고 있다)'로 답할 수 있다. 선택지·효과값 불변.
  assistantPrompt: '방금 고른 결과물을 아직 시작하지 못했다면, 가장 큰 이유는 무엇인가요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'pt_delay_analysis', label: '정보를 더 모으면 답이 나올 것 같아 계속 알아보는 중', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_delay_ambiguity', label: '결과가 어떻게 될지 몰라 시작이 망설여진다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_delay_fear', label: '잘못될까 두려워 내보내지 못한다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_delay_busy', label: '다른 급한 일들 때문에 손을 못 댄다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_delay_acting', label: '이미 작게 해보고 있다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
  ],
};

// pt_direction — '방향의 유무'(기존 선택지 수·방향성 문항과 체감 중복)를 '현재 커리어와
// 자기 정체성의 관계'를 묻는 회고형 문항으로 전면 재작성. 마지막 문항으로 배치.
// evidence code(q4:closedEarly/inBetween/open)는 그대로 유지된다(의미가 여전히 정합):
//   - pt_dir_aligned  : 현재 정체성 일치 → 코드 없음(부정 패턴 신호 없음)
//   - pt_dir_foreclosed: 익숙함으로 유지·확신 없음 → q4:closedEarly(identityForeclosure)
//   - pt_dir_liminal  : 현재 길 부적합·다음 미정 → q4:inBetween(liminality)
//   - pt_dir_exploring: 새 방향 탐색 중 → q4:open(구체 부정 패턴 강제 안 함)
// 구버전 옵션 ID(pt_dir_closed/between/open/na)는 biasPatternEngine에서 하위호환 매핑한다.
const patternDirection: QuestionStep = {
  id: 'pt_direction',
  stage: 'action_preferences',
  inputType: 'single_select',
  title: '지금 커리어와 나',
  assistantPrompt: '지금까지 이어온 커리어가 현재의 나와 얼마나 잘 맞는다고 느끼나요?',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 'pt_dir_aligned', label: '지금도 나와 잘 맞고, 앞으로도 계속 이어가고 싶다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_dir_foreclosed', label: '익숙해서 이어가고 있지만, 정말 내가 원하는 길인지는 확신이 없다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_dir_liminal', label: '지금의 길은 더 이상 나와 맞지 않지만, 다음 방향은 아직 정하지 못했다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
    { id: 'pt_dir_exploring', label: '여러 경험을 해보며 나에게 맞는 새로운 방향을 찾는 중이다', tags: ['pattern'], scoreEffects: {}, constructEffects: {} },
  ],
};

// ─── Assembled flow — 사용자 서사(A~F) 순서 ────────────────────────────────────
// 배열 순서만 바꾼다. 문항 ID·scoreEffects·constructEffects는 불변이라 모든 응답은
// ID 기준으로 그대로 해석되고 기존 무료 결과(mainType/subtype/friction/…)는 완전 불변.
// 쉬운 현재 상태 → 점차 심리적·개인적 문항으로 이동, pt_direction은 마지막 회고형.
// 근거: docs/research/career-question-flow-order-review.md.
export const CAREER_QUESTION_FLOW: QuestionStep[] = [
  // A. 현재 위치
  currentState,        // cs_main — 지금 상태
  realityEnergy,       // rc_energy — 지금 에너지
  // B. 방향과 선택지
  attractiveRoles,     // ar_roles — 끌리는 역할
  realityOptions,      // rc_options — 떠오르는 선택지(수·구체성)
  narrowingReason,     // ar_narrow — 좁히기 어려운 이유
  reactionContent,     // or_content — 콘텐츠·자문 방향 반응
  reactionVenture,     // or_venture — 창업·독립 방향 반응
  reactionInternal,    // or_internal — 사내·현직 방향 반응
  // C. 선택 기준과 지킬 조건
  coreValues,          // cv_values — 포기하기 싫은 가치
  corePriorities,      // cv_priorities — 우선순위
  ...forcedChoices,    // fc_1~fc_4 — 더 끌리는 쪽(가치 타이브레이커)
  patternHold,         // pt_hold — cs_blocker의 조건부 후속(정적 정의만; 실제 노출은
                       //   getActiveCareerQuestionFlow가 조건 충족 시 cs_blocker 뒤로 이동·삽입)
  // D. 현실 조건과 검증
  realityRunway,       // rc_runway — 버틸 수 있는 기간
  realityRisk,         // rc_risk — 감당 가능한 손실
  realityValidation,   // rc_validation — 지금 방향에 받은 반응(검증)
  // E. 행동과 장애물
  decisionBlocker,     // cs_blocker — 결정을 막는 것
  actionExperiment,    // ap_experiment — 이번 달 결과물(시도할 행동)
  patternDelay,        // pt_delay — 작게 해보기를 미룬 이유(effect-free)
  // F. 정체성과 전환
  selfOutlook,         // sc_outlook — 해낼 수 있다는 감각
  patternDirection,    // pt_direction — 지금 커리어와 자기 정체성의 관계(effect-free, 마지막)
];

// ─── 조건부 후속 질문(pt_hold) 노출 조건 + 활성 흐름 ───────────────────────────
// pt_hold를 노출할지 판단하는 단일 순수 함수. 손실·아까움·기존 것에 대한 집착 신호가
// 하나라도 있으면 true. UI 노출 여부와 결과 계산(effectiveResponses) 판단에 동일하게 쓴다.
// scoring/construct/biasPatternEngine 규칙은 이 함수를 읽지 않는다(점수·임계값 무변경).
//   A. cs_blocker: 잘못되면 되돌리기 어려울 것 같다(blk_fail)
//   B. ar_narrow: 잃는 느낌(nr_loss) / 안정 못 버림(nr_safety) / 기존 경력 연속성(nr_continuity)
//   C. rc_risk: 감당 가능한 손실이 매우 낮음(rc_risk_none)
// 방향 불명확·자신감 부족·시간/에너지·주변 시선·정보 부족·모호성·실행 계획 부족만 있으면 false.
export function shouldAskPtHold(responses: FlowResponses): boolean {
  const has = (q: string, id: string) => (responses[q]?.selectedOptionIds ?? []).includes(id);
  if (has('cs_blocker', 'blk_fail')) return true;
  if (has('ar_narrow', 'nr_loss') || has('ar_narrow', 'nr_safety') || has('ar_narrow', 'nr_continuity')) return true;
  if (has('rc_risk', 'rc_risk_none')) return true;
  return false;
}

// 정적 정의(CAREER_QUESTION_FLOW)와 실제 노출 흐름을 분리한다. pt_hold는 정적 배열에서 항상
// 제거하고, shouldAskPtHold=true일 때만 cs_blocker 바로 뒤에 삽입한다. 모든 UI(현재/다음/
// 이전/진행률/결과/수정/첫 미응답 복구)는 이 활성 흐름을 기준으로 동작해야 한다.
export function getActiveCareerQuestionFlow(responses: FlowResponses): QuestionStep[] {
  const base = CAREER_QUESTION_FLOW.filter((s) => s.id !== 'pt_hold');
  if (!shouldAskPtHold(responses)) return base;
  const ptHold = CAREER_QUESTION_FLOW.find((s) => s.id === 'pt_hold');
  if (!ptHold) return base;
  const at = base.findIndex((s) => s.id === 'cs_blocker');
  return at < 0 ? [...base, ptHold] : [...base.slice(0, at + 1), ptHold, ...base.slice(at + 1)];
}

// Maps each output-format card to the career option whose timing/fit/reeval it routes
// through (engine routing only — the user-facing label stays general; see EXPERIMENT_LABEL_BY_CARD).
// 'ap_unsure' has no entry → no preferred experiment; the engine picks from mainType/gates.
export const EXPERIMENT_OPTION_BY_CARD: Record<string, CareerOptionKey> = {
  ap_writing: 'investAnalysis',     // 글/리포트/메모
  ap_content: 'contentBrand',       // 짧은 콘텐츠
  ap_portfolio: 'advisoryTeaching', // 포트폴리오/케이스 (전문성을 사례로 → 자문/콘텐츠 계열)
  ap_interview: 'startup',          // 사람과 대화/인터뷰
  ap_redesign: 'stayRedesign',      // 내부 제안서/업무 개선안
  ap_profile: 'jobChange',          // 프로필/이력서
  ap_rest: 'restRecover',           // 회복 루틴
};

// General, output-format coreExperiment label per card (decoupled from the startup-flavored
// option templates). This is what the result screen shows as "이번 달 핵심 실험".
export const EXPERIMENT_LABEL_BY_CARD: Record<string, string> = {
  ap_writing: '글·리포트·메모로 생각이나 전문성을 한 편 정리해 남기기',
  ap_content: '짧은 콘텐츠 몇 개를 올려 가볍게 반응 보기',
  ap_portfolio: '해온 일·성과를 사례(케이스)로 정리하기',
  ap_interview: '관심 있는 사람·동료·고객과 직접 대화(인터뷰)해보기',
  ap_redesign: '지금 자리에서 역할·방식을 바꿀 내부 제안서 한 건 만들기',
  ap_profile: '경험을 밖에서도 읽히게 프로필·이력서로 정리하기',
  ap_rest: '2주 회복 루틴으로 에너지·생활 리듬부터 회복하기',
  ap_unsure: '결과물보다 먼저, 무엇을 기준으로 고를지 정리하기',
};

// ─── Helpers (flow → engine bridge) ───────────────────────────────────────────

// Look up a card by step id + option id (keeps mock/example data in sync with the flow).
export function findOption(stepId: string, optionId: string): ChoiceOption {
  const step = CAREER_QUESTION_FLOW.find((s) => s.id === stepId);
  const opt = step?.options?.find((o) => o.id === optionId);
  if (!opt) throw new Error(`careerQuestionFlow: option not found: ${stepId}/${optionId}`);
  return opt;
}

// Build the theory-grounded construct profile from card constructEffects.
// Ranking cards (MCDA priorities) are weighted by rank position. Single source of
// truth used by the UI session, the demo printer, and the e2e tests.
const CONSTRUCT_RANK_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2];
export function assembleConstructProfile(selected: ChoiceOption[], ranked: ChoiceOption[]): ConstructProfile {
  let p = createEmptyConstructProfile();
  for (const card of selected) {
    if (card.constructEffects) p = applyConstructEffects(p, card.constructEffects, 1);
  }
  ranked.forEach((card, i) => {
    if (card.constructEffects) p = applyConstructEffects(p, card.constructEffects, CONSTRUCT_RANK_WEIGHTS[i] ?? 0.1);
  });
  return normalizeConstructProfile(p);
}

// Merge reality-check band-card gate assignments into a full ReadinessGates.
// Defaults are conservative for any gate the user didn't answer.
export function assembleGatesFromSelections(selected: ChoiceOption[]): ReadinessGates {
  const gates: ReadinessGates = { energy: 'steady', runway: 'unknown', risk: 'smallCost', marketValidation: 'unvalidated' };
  for (const card of selected) {
    const a = card.gateAssignment;
    if (!a) continue;
    if (a.energy) gates.energy = a.energy;
    if (a.runway) gates.runway = a.runway;
    if (a.risk) gates.risk = a.risk;
    if (a.marketValidation) gates.marketValidation = a.marketValidation;
  }
  return gates;
}
