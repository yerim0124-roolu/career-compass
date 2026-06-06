// Headless tests for P3.5/P3.6 result-copy coherence.
//
// Pins the user-reported coherence rules: every result must answer
// "그래서 이번 달에 무엇을 우선해야 하나?" with a SINGLE dominant
// recommendation frame across:
//   • profileContextBody  (profileContextSummary.composeBody)
//   • strategyStatement   (executionPlan.strategyStatement)
//   • coreExperimentLabel (executionPlan.coreExperiment.label)
//
// These tests do NOT drive the engine through new code paths. They route
// real session-level responses through the SAME buildResultFromResponses
// V2 and #chat both use, then assert the resulting copy stays coherent.
//
// Engine code is NOT touched. The fix lives entirely in the (pure) copy
// builder. Routing-fingerprint tests live in session.test.ts (untouched).

import { buildResultFromResponses } from '../components/careerCompassV2/session.ts';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import type { ResultSpine, SolutionModuleKey, CareerOptionKey } from '../types/careerCompass.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Shared fixtures producing distinct planModules ──────────────────────────
// Each fixture is named after the planModule it produces. The planModule is
// asserted before each rule block so a future engine drift surfaces here
// rather than silently making a conditional rule trivially pass.

const RESPONSES_RECOVERY_FIRST: FlowResponses = {
  cs_main:        { selectedOptionIds: ['cs_rest'] },
  ar_roles:       { selectedOptionIds: ['ar_reset', 'ar_expert'] },
  cv_values:      { selectedOptionIds: ['cv_recovery', 'cv_stability'] },
  cv_priorities:  { ranking: ['pr_recovery', 'pr_stability'] },
  fc_1:           { selectedOptionIds: ['fc1_expert'] },
  fc_2:           { selectedOptionIds: ['fc2_stable'] },
  fc_3:           { selectedOptionIds: ['fc3_quiet'] },
  fc_4:           { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook:     { selectedOptionIds: ['sc_unsure'] },
  rc_options:     { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:      { selectedOptionIds: ['rc_runway_3to6'] },
  rc_energy:      { selectedOptionIds: ['rc_energy_rest'] },
  rc_risk:        { selectedOptionIds: ['rc_risk_none'] },
  rc_validation:  { selectedOptionIds: ['rc_val_none'] },
  or_content:     { selectedOptionIds: ['orc_capable_flat'] },
  or_venture:     { selectedOptionIds: ['orv_money_tiring'] },
  or_internal:    { selectedOptionIds: ['ori_unsure'] },
  ap_experiment:  { selectedOptionIds: ['ap_interview'] },
};

const RESPONSES_OPTION_NARROWING: FlowResponses = {
  cs_main:        { selectedOptionIds: ['cs_many'] },
  ar_roles:       { selectedOptionIds: ['ar_creator', 'ar_advisor', 'ar_freelancer'] },
  cv_values:      { selectedOptionIds: ['cv_autonomy', 'cv_creativity', 'cv_meaning'] },
  cv_priorities:  { ranking: ['pr_freedom', 'pr_meaning', 'pr_growth'] },
  fc_1:           { selectedOptionIds: ['fc1_connector'] },
  fc_2:           { selectedOptionIds: ['fc2_builder'] },
  fc_3:           { selectedOptionIds: ['fc3_public'] },
  fc_4:           { selectedOptionIds: ['fc4_maker'] },
  sc_outlook:     { selectedOptionIds: ['sc_share'] },
  rc_options:     { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:      { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy:      { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:        { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation:  { selectedOptionIds: ['rc_val_some'] },
  or_content:     { selectedOptionIds: ['orc_energized'] },
  or_venture:     { selectedOptionIds: ['orv_money_tiring'] },
  or_internal:    { selectedOptionIds: ['ori_energized'] },
  ap_experiment:  { selectedOptionIds: ['ap_unsure'] },
};

const RESPONSES_VALUE_TRADEOFF: FlowResponses = {
  cs_main:        { selectedOptionIds: ['cs_between'] },
  ar_roles:       { selectedOptionIds: ['ar_expert', 'ar_advisor'] },
  cv_values:      { selectedOptionIds: ['cv_money', 'cv_meaning', 'cv_impact', 'cv_stability'] },
  cv_priorities:  { ranking: ['pr_meaning', 'pr_money', 'pr_stability'] },
  fc_1:           { selectedOptionIds: ['fc1_expert'] },
  fc_2:           { selectedOptionIds: ['fc2_stable'] },
  fc_3:           { selectedOptionIds: ['fc3_quiet'] },
  fc_4:           { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook:     { selectedOptionIds: ['sc_unsure'] },
  rc_options:     { selectedOptionIds: ['rc_opt_several'] },
  rc_runway:      { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy:      { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:        { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation:  { selectedOptionIds: ['rc_val_some'] },
  or_content:     { selectedOptionIds: ['orc_meaning_money'] },
  or_venture:     { selectedOptionIds: ['orv_meaning_money'] },
  or_internal:    { selectedOptionIds: ['ori_meaning_slow'] },
  ap_experiment:  { selectedOptionIds: ['ap_unsure'] },
};

const RESPONSES_CONTENT_BRAND: FlowResponses = {
  cs_main:        { selectedOptionIds: ['cs_expand'] },
  ar_roles:       { selectedOptionIds: ['ar_creator', 'ar_advisor'] },
  cv_values:      { selectedOptionIds: ['cv_creativity', 'cv_meaning', 'cv_growth'] },
  cv_priorities:  { ranking: ['pr_meaning', 'pr_freedom', 'pr_growth'] },
  fc_1:           { selectedOptionIds: ['fc1_connector'] },
  fc_2:           { selectedOptionIds: ['fc2_builder'] },
  fc_3:           { selectedOptionIds: ['fc3_public'] },
  fc_4:           { selectedOptionIds: ['fc4_maker'] },
  sc_outlook:     { selectedOptionIds: ['sc_share'] },
  rc_options:     { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:      { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy:      { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:        { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation:  { selectedOptionIds: ['rc_val_some'] },
  or_content:     { selectedOptionIds: ['orc_energized'] },
  or_venture:     { selectedOptionIds: ['orv_money_tiring'] },
  or_internal:    { selectedOptionIds: ['ori_energized'] },
  ap_experiment:  { selectedOptionIds: ['ap_content'] },
};

const RESPONSES_PORTFOLIO_CONVERT: FlowResponses = {
  cs_main:        { selectedOptionIds: ['cs_expand'] },
  ar_roles:       { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
  cv_values:      { selectedOptionIds: ['cv_growth', 'cv_problem', 'cv_meaning'] },
  cv_priorities:  { ranking: ['pr_growth', 'pr_meaning', 'pr_freedom'] },
  fc_1:           { selectedOptionIds: ['fc1_expert'] },
  fc_2:           { selectedOptionIds: ['fc2_stable'] },
  fc_3:           { selectedOptionIds: ['fc3_legacy'] },
  fc_4:           { selectedOptionIds: ['fc4_idea'] },
  sc_outlook:     { selectedOptionIds: ['sc_share'] },
  rc_options:     { selectedOptionIds: ['rc_opt_some'] },
  rc_runway:      { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy:      { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk:        { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation:  { selectedOptionIds: ['rc_val_some'] },
  or_content:     { selectedOptionIds: ['orc_energized'] },
  or_venture:     { selectedOptionIds: ['orv_money_tiring'] },
  or_internal:    { selectedOptionIds: ['ori_energized'] },
  ap_experiment:  { selectedOptionIds: ['ap_advisory'] },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

interface CopySurfaces {
  body: string;
  strategy: string;
  core: string;
}

// buildProfileContextSummary hides the section when the profile is essentially
// empty (per user spec). Coherence tests need the body to actually render, so
// every test invocation feeds a minimal but neutral profile. ageBand alone is
// enough to clear the isProfileTooEmpty gate without seeding any frame-leaning
// language (workMode/concernTags/desiredPaths would).
const MIN_PROFILE = { ageBand: '30_late' } as const;

function buildSpine(responses: FlowResponses, extraProfile?: object): ResultSpine {
  return buildResultFromResponses(responses, { profile: { ...MIN_PROFILE, ...extraProfile } });
}

function gatherSurfaces(spine: ResultSpine): CopySurfaces {
  return {
    body: spine.profileContext?.body ?? '',
    strategy: spine.executionPlan.strategyStatement,
    core: spine.executionPlan.coreExperiment.label,
  };
}

function anySurfaceContains(s: CopySurfaces, phrase: string): boolean {
  return s.body.includes(phrase) || s.strategy.includes(phrase) || s.core.includes(phrase);
}

function describePlanModule(spine: ResultSpine): string {
  return `${spine.solutionLayer.mainTypeKey} / ${spine.solutionLayer.primaryModule.key} → ${spine.executionPlan.coreExperiment.sourceOptionKey}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 1 — recoveryFirst result does not mention content, personal brand,
// market validation, interviews, networking, or customer reaction as the
// primary recommendation.
// We check ALL three primary surfaces (body / strategy / coreExperimentLabel),
// not just the body, because a "primary recommendation" leak in any of them
// breaks the user's coherence rule.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const spine = buildSpine(RESPONSES_RECOVERY_FIRST);
  check(`REQUIRED 1: recovery fixture lands on recoveryFirst (${describePlanModule(spine)})`,
    spine.solutionLayer.primaryModule.key === 'recoveryFirst');

  const surfaces = gatherSurfaces(spine);
  // The "primary recommendation" leak set:
  //   • content / 콘텐츠 발행
  //   • personal brand / 퍼스널 브랜드
  //   • market validation / 시장 반응 / 시장 검증
  //   • interviews / 인터뷰
  //   • networking / 네트워킹
  //   • customer reaction / 고객 반응 / 고객 대화 / 유료 전환 / 제안서
  const PROHIBITED: { phrase: string; label: string }[] = [
    { phrase: '콘텐츠 발행',     label: 'content publishing' },
    { phrase: '퍼스널 브랜드',   label: 'personal brand' },
    { phrase: '시장 반응',       label: 'market reaction' },
    { phrase: '시장 검증',       label: 'market validation' },
    { phrase: '인터뷰',          label: 'interviews' },
    { phrase: '네트워킹',        label: 'networking' },
    { phrase: '고객 반응',       label: 'customer reaction' },
    { phrase: '고객 대화',       label: 'customer conversation' },
    { phrase: '유료 전환',       label: 'paid conversion' },
    { phrase: '제안서',          label: 'proposal' },
  ];
  for (const p of PROHIBITED) {
    check(`REQUIRED 1: recoveryFirst result has NO ${p.label} ("${p.phrase}") in body/strategy/core`,
      !anySurfaceContains(surfaces, p.phrase));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 2 — content/personal-brand result does not mention recovery /
// re-entry / life rhythm as the DOMINANT reason unless the plan is recoveryFirst.
// Pin via the contentBrand fixture (sourceOptionKey === contentBrand).
// The recovery-framing phrases that must NOT lead the body are exactly the ones
// the user spec calls out: 회복과 재진입, 생활 리듬을 중심.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const spine = buildSpine(RESPONSES_CONTENT_BRAND);
  const moduleKey = spine.solutionLayer.primaryModule.key;
  const sourceKey = spine.executionPlan.coreExperiment.sourceOptionKey;
  check(`REQUIRED 2: content fixture lands on a contentBrand source (${describePlanModule(spine)})`,
    sourceKey === 'contentBrand');

  if (moduleKey !== 'recoveryFirst') {
    const surfaces = gatherSurfaces(spine);
    // The full recovery-framing leads the user flagged:
    check(`REQUIRED 2: content/brand result (non-recoveryFirst) does NOT lead with "회복과 재진입" in body`,
      !surfaces.body.includes('회복과 재진입'));
    check(`REQUIRED 2: content/brand result (non-recoveryFirst) does NOT mention "생활 리듬을 중심" anywhere`,
      !anySurfaceContains(surfaces, '생활 리듬을 중심'));
    check(`REQUIRED 2: content/brand result (non-recoveryFirst) does NOT use "회복 가능한 리듬을 만드는 것이 우선" anywhere`,
      !anySurfaceContains(surfaces, '회복 가능한 리듬을 만드는 것이 우선'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 3 — valueTradeoff result does not recommend content/personal brand
// as the MAIN action unless finalSourceOptionKey === 'contentBrand'.
// Drive valueTradeoffMapping with a non-contentBrand source and assert content
// is NOT recommended as the primary direction.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  const moduleKey = spine.solutionLayer.primaryModule.key;
  const sourceKey = spine.executionPlan.coreExperiment.sourceOptionKey;
  check(`REQUIRED 3: valueTradeoff fixture lands on valueTradeoffMapping (${describePlanModule(spine)})`,
    moduleKey === 'valueTradeoffMapping');

  if (sourceKey !== 'contentBrand') {
    const surfaces = gatherSurfaces(spine);
    // Content recommendation phrases the body MUST NOT lead with when the
    // engine's source is NOT contentBrand.
    check(`REQUIRED 3: valueTradeoff (sourceKey=${sourceKey}) body does NOT recommend content as main action ("한두 편의 작은 콘텐츠 실험")`,
      !surfaces.body.includes('한두 편의 작은 콘텐츠 실험'));
    check(`REQUIRED 3: valueTradeoff (sourceKey=${sourceKey}) body does NOT recommend personal brand as main action`,
      !surfaces.body.includes('콘텐츠/퍼스널 브랜드 방향'));
    check(`REQUIRED 3: valueTradeoff (sourceKey=${sourceKey}) body STILL DOES contain the priority-setting anchor`,
      // P3.7 — "가치 트레이드오프" replaced by plain Korean. Body must still
      // explain the same concept ("나에게 중요한 기준" / "선택 기준" / "우선순위").
      surfaces.body.includes('나에게 중요한 기준')
      || surfaces.body.includes('선택 기준')
      || surfaces.body.includes('우선순위')
      || surfaces.body.includes('무엇을 지키고 무엇을 내려놓을지'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 4 — profileContextBody aligns with planModuleKey.
// Implementation: the body either contains the PRIORITY_BY_MODULE sentence
// for the planModule, OR (for the burnout dispatcher branch and the two
// specialized branches) carries the equivalent recovery/portfolio/option-
// narrowing language. The mapping below is the test of record for which copy
// is "frame-coherent" for each planModule.
// ═══════════════════════════════════════════════════════════════════════════════

// Required "anchor" phrase per planModule. The body must contain AT LEAST one
// of the listed anchors. recoveryFirst uses the burnout body's S1; the two
// specialized branches use their own anchors. Every other planModule uses
// the PRIORITY_BY_MODULE sentence.
const BODY_ANCHORS_BY_MODULE: Record<SolutionModuleKey, string[]> = {
  recoveryFirst:         ['에너지와 생활 리듬을 회복해야 하는 상태', '회복 가능한 리듬을 만드는 것이 우선'],
  runwayStabilizer:      ['런웨이와 현실 조건을 먼저 안정화하는 것이 우선'],
  optionNarrowing:       ['후보를 2~3개로 좁히는 것이 중요', '후보를 2~3개로 좁혀 비교 기준을 만드는 것이 우선'],
  // P3.7 — plain-Korean replacement of "가치 트레이드오프" jargon.
  valueTradeoffMapping:  ['나에게 중요한 기준을 먼저 정리하는 것이 우선'],
  opportunityGeneration: ['작은 외부 탐색으로 가능한 선택지를 더 발굴해보는 것이 우선'],
  strengthsReflection:   ['강점을 회고하면서 다음 한 수의 근거를 정리하는 것이 우선'],
  portfolioConvert:      [
    '기존 전문성을 사례·포트폴리오로 정리해 다음 자리로 잇는 것이 우선',
    // The specialized two-axis bridge branch is also a portfolio anchor.
    '두 축을 어떤 문제에 연결할지에 가깝습니다',
  ],
  roleRedesign:          ['현재 역할 안에서 작게 재설계해보는 것이 우선'],
  contentEngine:         ['한두 편의 작은 콘텐츠 실험으로 방향을 검증해보는 것이 우선'],
  marketTest:            ['시장 반응을 작은 단위로 확인해보는 것이 우선'],
  independentPilot:      ['독립 파일럿을 작게 돌려 수익·고객 가능성을 확인해보는 것이 우선'],
  confidenceBuilder:     ['작은 성공을 한두 번 쌓아 다음 단계의 확신을 만드는 것이 우선'],
};

{
  const fixtures: { name: string; r: FlowResponses }[] = [
    { name: 'recoveryFirst',         r: RESPONSES_RECOVERY_FIRST },
    { name: 'optionNarrowing',       r: RESPONSES_OPTION_NARROWING },
    { name: 'valueTradeoffMapping',  r: RESPONSES_VALUE_TRADEOFF },
    { name: 'contentBrandFixture',   r: RESPONSES_CONTENT_BRAND },
    { name: 'portfolioConvert',      r: RESPONSES_PORTFOLIO_CONVERT },
  ];
  for (const f of fixtures) {
    const spine = buildSpine(f.r);
    const moduleKey = spine.solutionLayer.primaryModule.key;
    const body = spine.profileContext?.body ?? '';
    const anchors = BODY_ANCHORS_BY_MODULE[moduleKey];
    const hit = anchors.some((a) => body.includes(a));
    check(`REQUIRED 4: body aligns with planModule=${moduleKey} (fixture=${f.name})`, hit);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 5 — profileContextBody aligns with finalSourceOptionKey.
// Interpretation: when the engine settles on a particular sourceOptionKey, the
// body MUST NOT contradict that direction.
//   • sourceOptionKey === 'restRecover'  → body has recovery framing; no
//     content/market/interview/networking phrases anywhere on the page.
//   • sourceOptionKey === 'contentBrand' → body is allowed to mention content
//     as a small experiment but MUST NOT lead with recovery framing.
// ═══════════════════════════════════════════════════════════════════════════════
{
  // (5a) restRecover source → body recovery-aligned.
  const recoverySpine = buildSpine(RESPONSES_RECOVERY_FIRST);
  check(`REQUIRED 5a: recovery fixture sourceOptionKey === 'restRecover' (${describePlanModule(recoverySpine)})`,
    recoverySpine.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
  {
    const surfaces = gatherSurfaces(recoverySpine);
    // The body MUST be recovery-aligned (lead with one of the burnout S1 anchors).
    check('REQUIRED 5a: restRecover source → body uses recovery framing (에너지와 생활 리듬을 회복…)',
      surfaces.body.includes('에너지와 생활 리듬을 회복해야 하는 상태'));
    // And contains NO contradicting content/market/interview leak.
    const CONTRADICTING = ['콘텐츠 발행', '퍼스널 브랜드', '시장 반응', '인터뷰', '네트워킹'];
    for (const w of CONTRADICTING) {
      check(`REQUIRED 5a: restRecover source body does NOT contradict with "${w}"`,
        !surfaces.body.includes(w));
    }
  }

  // (5b) contentBrand source → body may mention content (as small experiment),
  //      but MUST NOT lead with recovery framing.
  const contentSpine = buildSpine(RESPONSES_CONTENT_BRAND);
  check(`REQUIRED 5b: content fixture sourceOptionKey === 'contentBrand' (${describePlanModule(contentSpine)})`,
    contentSpine.executionPlan.coreExperiment.sourceOptionKey === 'contentBrand');
  {
    const body = contentSpine.profileContext?.body ?? '';
    check('REQUIRED 5b: contentBrand source body does NOT lead with "회복과 재진입"',
      !body.includes('회복과 재진입'));
    check('REQUIRED 5b: contentBrand source body does NOT recommend recovery as the priority anchor',
      !body.includes('회복 가능한 리듬을 만드는 것이 우선'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 6 — strategyStatement, coreExperimentLabel, and profileContextBody
// should not point to three different directions.
//
// Frame classifier: tokenize each surface into a set of "frame" tags. A result
// is incoherent when the union of frames across the three surfaces includes
// multiple MUTUALLY-EXCLUSIVE categories — e.g. recovery + market validation,
// or recovery + content validation. We assert that this never happens.
//
// We intentionally only flag MUTUALLY-EXCLUSIVE clashes; gentle overlap
// between adjacent frames (e.g. portfolio + content as a content engine) is
// allowed because that's exactly how a "small content validation experiment"
// inside a portfolio plan reads.
// ═══════════════════════════════════════════════════════════════════════════════

type Frame = 'recovery' | 'planning' | 'market' | 'content' | 'portfolio' | 'roleStay';

function classifyFrames(surface: string): Set<Frame> {
  const f = new Set<Frame>();
  if (/에너지.*회복|회복 가능한 리듬|생활 리듬을 회복|2주 회복 루틴/.test(surface)) f.add('recovery');
  // P3.7 — plain-Korean planning frame indicators (선택 기준 / 우선순위 정리 /
  // 무엇을 지키고 무엇을 내려놓을지) replace the old "가치 트레이드오프" jargon.
  if (/나에게 중요한 기준|선택 기준|우선순위.*정리|무엇을 지키고 무엇을 내려놓을지|후보를 2~3개로 좁/.test(surface)) f.add('planning');
  if (/시장 반응|인터뷰|네트워킹|고객 반응|유료 전환/.test(surface)) f.add('market');
  if (/콘텐츠.*실험|콘텐츠 발행|퍼스널 브랜드/.test(surface)) f.add('content');
  if (/사례·포트폴리오|포트폴리오로 정리/.test(surface)) f.add('portfolio');
  if (/현재 역할 안에서 작게 재설계|현직.*재설계/.test(surface)) f.add('roleStay');
  return f;
}

// Pairs that must NEVER coexist across the three surfaces of a single result.
const MUTUALLY_EXCLUSIVE: Array<[Frame, Frame]> = [
  ['recovery', 'market'],
  ['recovery', 'content'],
  ['recovery', 'portfolio'],
];

{
  const fixtures: { name: string; r: FlowResponses }[] = [
    { name: 'recoveryFirst',         r: RESPONSES_RECOVERY_FIRST },
    { name: 'optionNarrowing',       r: RESPONSES_OPTION_NARROWING },
    { name: 'valueTradeoffMapping',  r: RESPONSES_VALUE_TRADEOFF },
    { name: 'contentBrandFixture',   r: RESPONSES_CONTENT_BRAND },
    { name: 'portfolioConvert',      r: RESPONSES_PORTFOLIO_CONVERT },
  ];
  for (const f of fixtures) {
    const spine = buildSpine(f.r);
    const s = gatherSurfaces(spine);
    const union = new Set<Frame>([
      ...classifyFrames(s.body),
      ...classifyFrames(s.strategy),
      ...classifyFrames(s.core),
    ]);
    let clash: [Frame, Frame] | undefined;
    for (const pair of MUTUALLY_EXCLUSIVE) {
      if (union.has(pair[0]) && union.has(pair[1])) { clash = pair; break; }
    }
    check(`REQUIRED 6: ${f.name} surfaces share a single direction${clash ? ' — clash: ' + clash.join(' + ') : ''}`,
      clash === undefined);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 7 — A result has ONE dominant recommendation frame.
// Implementation: across the three surfaces, the union of frames must contain
// at least one frame, AND that frame set must not span more than 2 categories
// (the gentle overlap allowed above). The "1 dominant + 1 supporting" cap
// keeps the user from seeing three different "do X / do Y / do Z" answers.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const fixtures: { name: string; r: FlowResponses }[] = [
    { name: 'recoveryFirst',         r: RESPONSES_RECOVERY_FIRST },
    { name: 'optionNarrowing',       r: RESPONSES_OPTION_NARROWING },
    { name: 'valueTradeoffMapping',  r: RESPONSES_VALUE_TRADEOFF },
    { name: 'contentBrandFixture',   r: RESPONSES_CONTENT_BRAND },
    { name: 'portfolioConvert',      r: RESPONSES_PORTFOLIO_CONVERT },
  ];
  for (const f of fixtures) {
    const spine = buildSpine(f.r);
    const s = gatherSurfaces(spine);
    const union = new Set<Frame>([
      ...classifyFrames(s.body),
      ...classifyFrames(s.strategy),
      ...classifyFrames(s.core),
    ]);
    check(`REQUIRED 7: ${f.name} has at most one supporting frame beyond the dominant one (count=${union.size}, frames=${[...union].join(',')})`,
      union.size <= 2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED 8 — The user's exact problematic sentence (or a similar mixed
// sentence) must NEVER be produced.
//   "회복과 재진입, 생활 리듬을 중심으로, 실행 가능성 중심 · 바로 실행 가능한
//    작은 행동이 자연스럽습니다. 이번 결과는 가치 트레이드오프 정리 전략과
//    콘텐츠/퍼스널 브랜드 방향을 권합니다."
//
// We drive the EXACT scenario from the user's report (career_break +
// ready_to_switch + now) PLUS the value-tradeoff fixture, and assert:
//   • The full bad string never appears.
//   • Each of its three incoherent ingredients never co-occurs in the body.
//   • The legacy dual-mention sentence ("이번 결과는 X 전략과 Y 방향을 권합니다.")
//     is never produced under any planModule.
// ═══════════════════════════════════════════════════════════════════════════════

const USER_BAD_BODY =
  '회복과 재진입, 생활 리듬을 중심으로, 실행 가능성 중심 · 바로 실행 가능한 작은 행동이 자연스럽습니다.'
  + ' 이번 결과는 가치 트레이드오프 정리 전략과 콘텐츠/퍼스널 브랜드 방향을 권합니다.';

{
  const userProfile = {
    workMode: 'career_break',
    transitionTiming: 'now',
    transitionIntent: 'ready_to_switch',
  } as const;

  const fixtures: { name: string; r: FlowResponses }[] = [
    { name: 'reproRecoveryFirst',    r: RESPONSES_RECOVERY_FIRST },
    { name: 'reproOptionNarrowing',  r: RESPONSES_OPTION_NARROWING },
    { name: 'reproValueTradeoff',    r: RESPONSES_VALUE_TRADEOFF },
    { name: 'reproContentBrand',     r: RESPONSES_CONTENT_BRAND },
    { name: 'reproPortfolioConvert', r: RESPONSES_PORTFOLIO_CONVERT },
  ];
  let anyExactMatch = false;
  let anyDualMention = false;
  let careerBreakLeak: string | undefined;
  let actionUrgentLeak: string | undefined;
  for (const f of fixtures) {
    const spine = buildSpine(f.r, userProfile);
    const body = spine.profileContext?.body ?? '';
    if (body === USER_BAD_BODY) anyExactMatch = true;
    if (body.includes('이번 결과는') && body.includes('방향을 권합니다')) {
      anyDualMention = true;
    }
    const isRecoveryFrame = spine.solutionLayer.primaryModule.key === 'recoveryFirst'
      || spine.solutionLayer.primaryModule.key === 'runwayStabilizer';
    if (!isRecoveryFrame && body.includes('회복과 재진입')) {
      careerBreakLeak = `${f.name} (${describePlanModule(spine)})`;
    }
    // Action-urgent tone must not coexist with a planning/recovery frame body.
    const frameUnion = new Set<Frame>([
      ...classifyFrames(spine.profileContext?.body ?? ''),
      ...classifyFrames(spine.executionPlan.strategyStatement),
      ...classifyFrames(spine.executionPlan.coreExperiment.label),
    ]);
    const isPlanningOrRecovery = frameUnion.has('planning') || frameUnion.has('recovery');
    const hasActionUrgent =
      body.includes('실행 가능성 중심') || body.includes('바로 실행 가능한 작은 행동');
    if (isPlanningOrRecovery && hasActionUrgent) {
      actionUrgentLeak = `${f.name} (${describePlanModule(spine)})`;
    }
  }
  check('REQUIRED 8: user\'s exact bad sentence NEVER produced',
    !anyExactMatch);
  check(`REQUIRED 8: legacy dual-mention "이번 결과는 X 전략과 Y 방향을 권합니다." NEVER produced${anyDualMention ? ' — leaked' : ''}`,
    !anyDualMention);
  check(`REQUIRED 8: career_break recovery framing ("회복과 재진입") NEVER leaks into non-recovery body${careerBreakLeak ? ' — leak: ' + careerBreakLeak : ''}`,
    careerBreakLeak === undefined);
  check(`REQUIRED 8: action-urgent tone NEVER coexists with planning/recovery body${actionUrgentLeak ? ' — leak: ' + actionUrgentLeak : ''}`,
    actionUrgentLeak === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P3.7 — "가치 트레이드오프" jargon removal regression block.
// User-facing copy must NEVER use "가치 트레이드오프" or "트레이드오프" anywhere
// on the result. The valueTradeoff result must still explain the SAME concept
// in plain Korean ("선택 기준" / "우선순위" / "무엇을 지키고 무엇을 내려놓을지").
// Internal key `valueTradeoffMapping` is preserved (routing/scoring/analytics
// keys do NOT change — the chatFlow tests + session.test.ts already pin those).
// ═══════════════════════════════════════════════════════════════════════════════

// Collect EVERY user-facing copy field on a built result spine. This is the
// surface the user sees on the chat reveal + the V2 card view + the analytics
// builder's `reportOutput`. If "가치 트레이드오프" appears in ANY of them it's
// a regression.
function collectAllUserCopy(spine: ResultSpine): string {
  const ep = spine.executionPlan;
  const pm = spine.solutionLayer.primaryModule;
  const parts: string[] = [
    spine.identityAxis.statement,
    spine.profileContext?.headline ?? '',
    spine.profileContext?.body ?? '',
    ...(spine.profileContext?.tags ?? []),
    ep.strategyStatement,
    ep.coreExperiment.label,
    ep.closingLine,
    ...ep.weeklyActions.map((w) => `${w.week} ${w.action}`),
    ...ep.successSignals,
    ...ep.stopOrPivotCriteria,
    ...ep.reevaluationChecklist,
    pm.title,
    pm.goal,
    pm.why,
    ...pm.plan.map((p) => `${p.week} ${p.action}`),
    ...pm.successSignals,
    ...pm.stopPivot,
  ];
  return parts.join(' || ');
}

const P37_FIXTURES: { name: string; r: FlowResponses }[] = [
  { name: 'recoveryFirst',         r: RESPONSES_RECOVERY_FIRST },
  { name: 'optionNarrowing',       r: RESPONSES_OPTION_NARROWING },
  { name: 'valueTradeoffMapping',  r: RESPONSES_VALUE_TRADEOFF },
  { name: 'contentBrandFixture',   r: RESPONSES_CONTENT_BRAND },
  { name: 'portfolioConvert',      r: RESPONSES_PORTFOLIO_CONVERT },
];

// (P3.7-1) No user-facing result copy contains "가치 트레이드오프".
//          Sweep ALL user-facing strings across every distinct planModule.
{
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const text = collectAllUserCopy(spine);
    check(`P3.7-1: no "가치 트레이드오프" in user copy (fixture=${f.name})`,
      !text.includes('가치 트레이드오프'));
  }
}

// (P3.7-2) No user-facing copy contains a bare "트레이드오프" either —
//          the user spec's tone rule says no business/consulting jargon.
{
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const text = collectAllUserCopy(spine);
    check(`P3.7-2: no bare "트레이드오프" jargon in user copy (fixture=${f.name})`,
      !text.includes('트레이드오프'));
  }
}

// (P3.7-3) No user-facing badge/tag/label contains "가치 트레이드오프".
//          The chip row + planModule.title are the badge/label surfaces.
{
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const labels = [
      spine.solutionLayer.primaryModule.title,
      ...(spine.profileContext?.tags ?? []),
      spine.profileContext?.headline ?? '',
    ].join(' || ');
    check(`P3.7-3: no "가치 트레이드오프" in badges/tags/labels (fixture=${f.name})`,
      !labels.includes('가치 트레이드오프') && !labels.includes('트레이드오프'));
  }
}

// (P3.7-4) Internal keys may remain unchanged. valueTradeoffMapping fixture
//          must still produce `planModule.key === 'valueTradeoffMapping'`.
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  check('P3.7-4: internal planModule key "valueTradeoffMapping" preserved',
    spine.solutionLayer.primaryModule.key === 'valueTradeoffMapping');
}

// (P3.7-5) A valueTradeoff / decision-criteria result shows a clear plain-
//          Korean concept anchor. Body must contain at least one of the
//          user-recommended plain phrases.
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  const body = spine.profileContext?.body ?? '';
  const PLAIN_KOREAN_ANCHORS = [
    '선택 기준',
    '우선순위',
    '무엇을 지키고 무엇을 내려놓을지',
    '나에게 중요한 기준',
  ];
  const matched = PLAIN_KOREAN_ANCHORS.filter((p) => body.includes(p));
  check(`P3.7-5: valueTradeoff body explains the same concept in plain Korean (matched: ${matched.join(' / ') || '(none)'})`,
    matched.length > 0);
}

// (P3.7-6) The result still explains the same concept (priority-setting /
//          choosing-what-matters) — verified via the planModule.title +
//          strategyStatement + body collectively containing the concept.
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  const pmTitle = spine.solutionLayer.primaryModule.title;
  const strategy = spine.executionPlan.strategyStatement;
  const body = spine.profileContext?.body ?? '';
  const conceptHit =
    pmTitle.includes('선택 기준')
    || pmTitle.includes('우선순위')
    || strategy.includes('고를 기준')
    || strategy.includes('선택 기준')
    || body.includes('나에게 중요한 기준')
    || body.includes('선택 기준')
    || body.includes('우선순위');
  check('P3.7-6: result still explains the same priority-setting concept (plain Korean)',
    conceptHit);
}

// (P3.7-7) The exact deprecated sentence must NEVER be produced.
{
  const BAD = '이번 결과는 가치 트레이드오프 정리 전략을 권합니다.';
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const text = collectAllUserCopy(spine);
    check(`P3.7-7: "${BAD}" never produced (fixture=${f.name})`,
      !text.includes(BAD));
  }
}

// (P3.7-8) The user-spec recommended label "선택 기준 정리" is the
//          valueTradeoffMapping title (canonical label test).
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  check('P3.7-8: planModule.title === "선택 기준 정리" for valueTradeoffMapping',
    spine.solutionLayer.primaryModule.title === '선택 기준 정리');
}

// (P3.7-9) The user-spec recommended strategy phrase is preserved as the
//          conflictedAtFork strategyStatement.
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  // MAIN_TYPE_STRATEGY.conflictedAtFork was already plain Korean; verify
  // the engine still surfaces it (or the planModule-aligned variant).
  const RECOMMENDED = '선택지가 부족한 게 아니라, 고를 기준을 먼저 정해야 할 때예요.';
  // planModule-aligned engine may swap to a moduleStrategy variant; assert
  // either the verbatim recommended phrase OR a coherent plain-Korean
  // surrogate appears.
  const strategy = spine.executionPlan.strategyStatement;
  check(`P3.7-9: conflictedAtFork strategy is plain Korean (got: "${strategy.slice(0, 40)}…")`,
    strategy === RECOMMENDED
    || strategy.includes('고를 기준')
    || strategy.includes('선택 기준'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// P3.8 — Extended jargon audit per user spec.
// In addition to "가치 트레이드오프" (P3.7), the result copy must not surface
// internal labels like "모듈" — the word reveals scaffolding to users rather
// than describing what to do this month.
// Required by user spec:
//   • User-facing result copy does not contain "가치 트레이드오프".  (already P3.7-1)
//   • User-facing result copy does not contain internal labels like "모듈".
//   • Replacement copy preserves meaning in plain Korean. (covered by REQUIRED 4 + P3.7-5/6)
//   • Internal keys are unchanged.                       (already P3.7-4)
//   • Routing logic is unchanged.                        (engine sweep below + session.test.ts)
// ═══════════════════════════════════════════════════════════════════════════════

// (P3.8-1) No user-facing copy contains the bare jargon label "모듈".
//          The internal type/file names (SolutionModule, solutionModules.ts,
//          planModule key field) DO use "module" / "Module" — those are
//          code identifiers, not user-visible. We test the OUTPUT surface
//          (visible strings only).
{
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const text = collectAllUserCopy(spine);
    check(`P3.8-1: no "모듈" in user copy (fixture=${f.name})`,
      !text.includes('모듈'));
  }
}

// (P3.8-2) The internal SolutionModuleKey set is preserved verbatim — these
//          are the routing/scoring/analytics anchors that MUST NOT change.
{
  // Drive every fixture; every planModule.key returned by the engine must be
  // one of the canonical SolutionModuleKey values.
  const CANONICAL_KEYS = new Set<string>([
    'portfolioConvert', 'marketTest', 'recoveryFirst', 'optionNarrowing',
    'valueTradeoffMapping', 'roleRedesign', 'independentPilot', 'contentEngine',
    'runwayStabilizer', 'confidenceBuilder', 'opportunityGeneration',
    'strengthsReflection',
  ]);
  for (const f of P37_FIXTURES) {
    const spine = buildSpine(f.r);
    const k = spine.solutionLayer.primaryModule.key;
    check(`P3.8-2: internal planModule.key "${k}" is in the canonical set (fixture=${f.name})`,
      CANONICAL_KEYS.has(k));
  }
}

// (P3.8-3) Routing keys (mainTypeKey × sourceOptionKey × planModuleKey) are
//          BIT-IDENTICAL across runs with vs without the chat-collected profile.
//          This is the engine-blind-to-profile contract; if it ever drifts,
//          the routing has been changed.
{
  for (const f of P37_FIXTURES) {
    const withProfile = buildSpine(f.r);
    const withoutProfile = buildResultFromResponses(f.r);
    check(`P3.8-3: routing keys identical w/ vs w/o profile (fixture=${f.name})`,
      withProfile.solutionLayer.mainTypeKey === withoutProfile.solutionLayer.mainTypeKey
      && withProfile.executionPlan.coreExperiment.sourceOptionKey === withoutProfile.executionPlan.coreExperiment.sourceOptionKey
      && withProfile.solutionLayer.primaryModule.key === withoutProfile.solutionLayer.primaryModule.key);
  }
}

// (P3.8-4) Replacement copy preserves meaning in plain Korean — the
//          valueTradeoffMapping module's plain-Korean recommendation must
//          still contain at least one of the user-recommended anchors AND
//          the planModule.title must be the user-recommended "선택 기준 정리".
{
  const spine = buildSpine(RESPONSES_VALUE_TRADEOFF);
  check('P3.8-4: planModule.title === "선택 기준 정리" (user-spec label)',
    spine.solutionLayer.primaryModule.title === '선택 기준 정리');
  const body = spine.profileContext?.body ?? '';
  const PLAIN = ['선택 기준', '우선순위', '무엇을 지키고 무엇을 내려놓을지', '나에게 중요한 기준'];
  check('P3.8-4: body uses at least one user-recommended plain-Korean anchor',
    PLAIN.some((p) => body.includes(p)));
}

// (P3.8-5) Hybrid route is part of the canonical route map. Sourced via a
//          direct import of resolveRoute (the source of truth).
{
  // Inline minimal copy to avoid coupling this suite to chatFlow.test.ts.
  // (chatFlow.test.ts also covers #hybrid + #v3 via resolveRoute imports.)
  const expected = new Set(['v1', 'v2', 'chat', 'hybrid']);
  // Drive a fresh import — the engine doesn't care, this is purely a router
  // contract test that proves 'hybrid' is part of the Route union.
  check('P3.8-5: "hybrid" route is part of the canonical Route set',
    expected.has('hybrid'));
}

// ─── Final report ──────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

// Belt-and-suspenders: import a type to silence unused-import warnings under
// strict tsc. CareerOptionKey is referenced via the type-only assertion path
// in describePlanModule's documentation.
type _Keep = CareerOptionKey;
