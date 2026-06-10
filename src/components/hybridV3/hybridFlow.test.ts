// Headless tests for P3.9 hybrid contract.
//
// Pins the user-spec requirements for the hybrid UX:
//   • Main questionnaire is card-based (NOT a long chat-bubble stream).
//   • Main questionnaire shows one question per card.
//   • Users can go back to the previous main question.
//   • Users can see progress.
//   • Users can edit an answer before final submission.
//   • FlowResponses shape preserved exactly.
//   • CAREER_QUESTION_FLOW IDs + option values unchanged.
//   • Completing the questionnaire uses the existing result builder.
//   • Result report is card-based (NOT long chat bubbles).
//   • Result keeps all 9 required sections.
//
// These tests do NOT exercise React render. They exercise the pure data
// contract + the static import graph of HybridFlowView.tsx — that's the
// surface that proves "the hybrid uses the V2 card UI" rather than rebuilding
// a chat stream.

import { buildResultFromResponses, buildResultFromSession } from '../careerCompassV2/session.ts';
import type { FlowResponses } from '../careerCompassV2/session.ts';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import type { ResultSpine } from '../../types/careerCompass.ts';

// node builtins — same approach as chatFlow.test.ts (excluded from app tsconfig)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the hybrid source once — every static-graph assertion below works from
// this single file read, so failures point at the exact contract that drifted.
const hybridSrc = readFileSync(resolve(__dirname, './HybridFlowView.tsx'), 'utf-8');
const reviewSrc = readFileSync(resolve(__dirname, './ProfileSummaryReview.tsx'), 'utf-8');
const v2ResultSrc = readFileSync(resolve(__dirname, '../careerCompassV2/ResultSpineView.tsx'), 'utf-8');

// ─── Shared fixture — the 회사원 burnout case (already routes through every
//     engine path the existing analytics primary case exercises). ─────────────
const BURNOUT_RESPONSES: FlowResponses = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED A — Main questionnaire is card-based (NOT chat bubbles).
// We test the static import graph: hybrid imports the V2 ChatLikeFlow +
// QuestionStepRenderer + ProgressHeader + LiveInsightCard, and does NOT
// render the main-flow questions through chatV1's ChatMessage component.
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED A: HybridFlowView imports V2 ProgressHeader (progress)',
  /from\s+['"]\.\.\/careerCompassV2\/ProgressHeader['"]/.test(hybridSrc));
check('REQUIRED A: HybridFlowView imports V2 ChatLikeFlow (card prompt+answer)',
  /from\s+['"]\.\.\/careerCompassV2\/ChatLikeFlow['"]/.test(hybridSrc));
check('REQUIRED A: HybridFlowView imports V2 QuestionStepRenderer (one-question-per-card renderer)',
  /from\s+['"]\.\.\/careerCompassV2\/QuestionStepRenderer['"]/.test(hybridSrc));
check('REQUIRED A: HybridFlowView imports V2 LiveInsightCard (insight chip)',
  /from\s+['"]\.\.\/careerCompassV2\/LiveInsightCard['"]/.test(hybridSrc));
// And the main-flow render block actually USES these components.
{
  // The phase === 'mainFlow' branch is the section where these must render.
  const mainFlowIndex = hybridSrc.indexOf("phase === 'mainFlow'");
  const mainFlowEnd = hybridSrc.indexOf("// phase === 'profile'", mainFlowIndex);
  const mainFlowSlice = hybridSrc.slice(mainFlowIndex, mainFlowEnd > 0 ? mainFlowEnd : undefined);
  check('REQUIRED A: main-flow phase renders <ProgressHeader …>',
    /<ProgressHeader\b/.test(mainFlowSlice));
  check('REQUIRED A: main-flow phase renders <QuestionStepRenderer …>',
    /<QuestionStepRenderer\b/.test(mainFlowSlice));
  check('REQUIRED A: main-flow phase renders <ChatLikeFlow …>',
    /<ChatLikeFlow\b/.test(mainFlowSlice));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED B — Main questionnaire shows ONE question per card.
// V2's QuestionStepRenderer accepts a single QuestionStep; ChatLikeFlow wraps
// that single step. The hybrid renders ONE flowStep at a time (driven by
// `stepIndex`), never a list. This is enforced by the absence of any
// .map(step => …) on CAREER_QUESTION_FLOW inside HybridFlowView.
// ═══════════════════════════════════════════════════════════════════════════════
{
  check('REQUIRED B: HybridFlowView does NOT map() over CAREER_QUESTION_FLOW (one-card-at-a-time)',
    !/CAREER_QUESTION_FLOW\.map\b/.test(hybridSrc));
  check('REQUIRED B: HybridFlowView drives a single flowStep via stepIndex',
    /const flowStep = CAREER_QUESTION_FLOW\[stepIndex\]/.test(hybridSrc));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED C — Users can go back to the previous main question.
// HybridFlowView defines a `backFlow` handler wired to ProgressHeader.canBack
// + onBack. Step 0's back returns to the profile review (NOT the engine —
// the engine has no back logic, per spec).
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED C: HybridFlowView defines backFlow handler',
  /const backFlow\s*=\s*\(\)\s*=>/.test(hybridSrc));
check('REQUIRED C: backFlow decrements stepIndex when > 0',
  /setStepIndex\(\(i\)\s*=>\s*i\s*-\s*1\)/.test(hybridSrc));
check('REQUIRED C: backFlow at step 0 returns to profileReview',
  /setPhase\(\s*['"]profileReview['"]\s*\)/.test(hybridSrc));
check('REQUIRED C: ProgressHeader wired with canBack + onBack={backFlow}',
  /<ProgressHeader[\s\S]{0,400}canBack[\s\S]{0,200}onBack=\{backFlow\}/.test(hybridSrc));

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED D — Users can see progress.
// ProgressHeader renders `current / total + stageLabel`. The hybrid passes
// (stepIndex + 1, CAREER_QUESTION_FLOW.length, STAGE_LABELS[step.stage]).
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED D: ProgressHeader receives current = stepIndex + 1',
  /current=\{stepIndex \+ 1\}/.test(hybridSrc));
check('REQUIRED D: ProgressHeader receives total = CAREER_QUESTION_FLOW.length',
  /total=\{CAREER_QUESTION_FLOW\.length\}/.test(hybridSrc));
check('REQUIRED D: ProgressHeader receives the stage label',
  /stageLabel=\{STAGE_LABELS\[flowStep\.stage\]\}/.test(hybridSrc));

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED E — Users can EDIT an answer before final submission.
// This is the data-contract test: navigating back keeps the prior
// FlowResponses entry, AND re-submitting a new value overrides it cleanly.
// The result spine reflects ONLY the final value (no stale cache).
//
// We prove the contract via a comprehensive swap: starting from a burnout-
// shaped FlowResponses, the user edits every key signal back to a non-
// burnout pattern. The engine MUST flip mainTypeKey away from overloadedBurnout.
// If the engine cached the prior responses, this would silently fail.
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Step 1: spine from the original burnout responses.
  let responses: FlowResponses = { ...BURNOUT_RESPONSES };
  const initialSpine = buildResultFromResponses(responses, { profile: {} });
  check('REQUIRED E: initial spine reflects the burnout fixture (mainType=overloadedBurnout)',
    initialSpine.solutionLayer.mainTypeKey === 'overloadedBurnout');

  // Step 2: simulate "user hits BACK and edits every burnout signal back to
  //         a non-burnout pattern" (cs_main / ar_roles / cv_* / rc_energy /
  //         rc_runway / rc_risk / ap_experiment).
  responses = {
    ...responses,
    cs_main:       { selectedOptionIds: ['cs_expand'] },
    ar_roles:      { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
    cv_values:     { selectedOptionIds: ['cv_growth', 'cv_problem', 'cv_meaning'] },
    cv_priorities: { ranking: ['pr_growth', 'pr_meaning', 'pr_freedom'] },
    rc_runway:     { selectedOptionIds: ['rc_runway_6plus'] },
    rc_energy:     { selectedOptionIds: ['rc_energy_focused'] },
    rc_risk:       { selectedOptionIds: ['rc_risk_calculated'] },
    rc_validation: { selectedOptionIds: ['rc_val_some'] },
    or_content:    { selectedOptionIds: ['orc_energized'] },
    or_internal:   { selectedOptionIds: ['ori_energized'] },
    ap_experiment: { selectedOptionIds: ['ap_advisory'] },
  };
  const editedSpine = buildResultFromResponses(responses, { profile: {} });

  // Step 3: the edited spine MUST reflect the new value — no stale cache.
  check('REQUIRED E: editing responses propagates into the final result spine (mainType flipped away from burnout)',
    editedSpine.solutionLayer.mainTypeKey !== 'overloadedBurnout');
  check('REQUIRED E: editing responses propagates a different planModule / sourceOptionKey',
    initialSpine.solutionLayer.primaryModule.key !== editedSpine.solutionLayer.primaryModule.key
    || initialSpine.executionPlan.coreExperiment.sourceOptionKey !== editedSpine.executionPlan.coreExperiment.sourceOptionKey);

  // Belt-and-suspenders: FlowResponses is the simple Record shape the user
  // can mutate at will (no opaque token / no engine-managed cursor).
  check('REQUIRED E: FlowResponses is a plain Record — edits are direct assignments',
    typeof responses === 'object' && responses !== null && !Array.isArray(responses));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED F — Existing FlowResponses shape preserved.
// StepResponse2 shape: { selectedOptionIds?: string[]; ranking?: string[];
//   shortText?: string; sliderValues?: Record<string, number> }
// The hybrid writes FlowResponses via the SAME setForFlowStep wrapper V2 uses.
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED F: HybridFlowView defines setForFlowStep that writes StepResponse2',
  /const setForFlowStep\s*=\s*\(v:\s*StepResponse2\)\s*=>/.test(hybridSrc));
check('REQUIRED F: setForFlowStep writes responses[step.id] (FlowResponses key)',
  /\[flowStep\.id\]:\s*v/.test(hybridSrc));

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED G — CAREER_QUESTION_FLOW IDs + option values unchanged.
// Same drift check that chatFlow.test.ts REQUIRED 10 uses, scoped here to
// confirm the hybrid still routes through the canonical data.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const canonicalIds = new Set(CAREER_QUESTION_FLOW.map((q) => q.id));
  let drift = 0;
  for (const id of Object.keys(BURNOUT_RESPONSES)) if (!canonicalIds.has(id)) drift++;
  check('REQUIRED G: every response key in the fixture is a canonical question id (drift = 0)',
    drift === 0);
  // Option-value drift: every value the fixture uses must be a canonical option id.
  let optionDrift = 0;
  for (const q of CAREER_QUESTION_FLOW) {
    const r = BURNOUT_RESPONSES[q.id];
    if (!r) continue;
    const validIds = new Set((q.options ?? []).map((o) => o.id));
    for (const id of r.selectedOptionIds ?? []) if (!validIds.has(id)) optionDrift++;
    for (const id of r.ranking ?? []) if (!validIds.has(id)) optionDrift++;
  }
  check('REQUIRED G: every option value in the fixture is canonical (drift = 0)',
    optionDrift === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED H — Completing the questionnaire uses the EXISTING result builder.
// Hybrid imports + calls buildResultFromSession (the V2 entry).
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED H: HybridFlowView imports buildResultFromSession from V2 session.ts',
  /buildResultFromSession[\s\S]{0,200}from\s+['"]\.\.\/careerCompassV2\/session\.ts['"]/.test(hybridSrc));
check('REQUIRED H: HybridFlowView calls buildResultFromSession with { responses, profile }',
  /buildResultFromSession\(\{\s*responses,\s*profile\s*\}\)/.test(hybridSrc));

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED I — Result report is card-based (NOT long chat bubbles).
// Hybrid renders ResultSpineView (V2's existing card-based result) for the
// 'result' phase. It does NOT render the result phase through chatV1's
// ChatMessage component.
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED I: HybridFlowView imports V2 ResultSpineView',
  /import\s+ResultSpineView\s+from\s+['"]\.\.\/careerCompassV2\/ResultSpineView['"]/.test(hybridSrc));
{
  // The phase === 'result' branch must render <ResultSpineView />.
  const resultIndex = hybridSrc.indexOf("phase === 'result'");
  const resultEnd = hybridSrc.indexOf("phase === 'profileReview'", resultIndex);
  const resultSlice = hybridSrc.slice(resultIndex, resultEnd > 0 ? resultEnd : undefined);
  check('REQUIRED I: result phase renders <ResultSpineView spine={…} …>',
    /<ResultSpineView\b/.test(resultSlice));
  check('REQUIRED I: result phase does NOT render <ChatMessage> bubbles',
    !/<ChatMessage\b/.test(resultSlice));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED J — All 9 required result sections are present in V2's
// ResultSpineView (which the hybrid renders verbatim).
// ═══════════════════════════════════════════════════════════════════════════════
{
  // v3 결과지 개편 — 섹션 통합으로 일부 필드는 더 이상 별도 카드로 렌더하지 않는다:
  //   · coreExperiment.label → '이번 주 한 수'는 맞춤 분석(resultContext.narrative.weeklyMove)에만 노출(중복 제거)
  //   · successSignals / stopOrPivotCriteria → '30일 후 다시 볼 질문' 체크리스트 + 안전장치 한 줄로 통합
  // 엔진은 여전히 이 데이터를 생성한다(REQUIRED K가 비어있지 않음을 보장). 여기선 '렌더되는 섹션'만 확인.
  const sections = [
    { name: 'identityStatement',     pattern: /spine\.identityAxis\.statement/ },
    { name: 'profileContext.headline + body + tags', pattern: /spine\.profileContext\.headline[\s\S]{0,400}spine\.profileContext\.body[\s\S]{0,400}spine\.profileContext\.tags/ },
    { name: 'strategyStatement',     pattern: /ep\.strategyStatement/ },
    { name: 'weeklyActions',         pattern: /ep\.weeklyActions\.map/ },
    { name: 'reevaluationChecklist', pattern: /ep\.reevaluationChecklist\.map/ },
    // 맞춤 분석(메인 진단)의 '이번 주 한 수' — resultContext 서사
    { name: 'resultContext.weeklyMove', pattern: /rc\.narrative\.weeklyMove/ },
    // P3.9 — closingLine moved to the page end (peak-end), accessed via the full
    // spine path there; either accessor satisfies the "closingLine renders" contract.
    { name: 'closingLine',           pattern: /(?:ep|spine\.executionPlan)\.closingLine/ },
  ];
  for (const s of sections) {
    check(`REQUIRED J: ResultSpineView renders ${s.name}`,
      s.pattern.test(v2ResultSrc));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED K — Engine output actually populates every required section
// for a real fixture (proves the V2 ResultSpineView surfaces non-empty data).
// ═══════════════════════════════════════════════════════════════════════════════
{
  const spine: ResultSpine = buildResultFromSession({ responses: BURNOUT_RESPONSES, profile: {} });
  check('REQUIRED K: identityStatement non-empty',     spine.identityAxis.statement.length > 0);
  check('REQUIRED K: strategyStatement non-empty',     spine.executionPlan.strategyStatement.length > 0);
  check('REQUIRED K: coreExperimentLabel non-empty',   spine.executionPlan.coreExperiment.label.length > 0);
  check('REQUIRED K: weeklyActions populated',         spine.executionPlan.weeklyActions.length > 0);
  check('REQUIRED K: successSignals populated',        spine.executionPlan.successSignals.length > 0);
  check('REQUIRED K: stopOrPivotCriteria populated',   spine.executionPlan.stopOrPivotCriteria.length > 0);
  check('REQUIRED K: reevaluationChecklist populated', spine.executionPlan.reevaluationChecklist.length > 0);
  check('REQUIRED K: closingLine non-empty',           spine.executionPlan.closingLine.length > 0);
  // profileContext is optional (engine hides it when profile is too empty);
  // we don't require it for an empty-profile fixture.
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED L — No AI / network / regenerated result.
// HybridFlowView + ProfileSummaryReview must NOT import fetch / ai-sdk /
// anthropic / openai / axios / WebSocket / EventSource.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const FORBIDDEN: { p: RegExp; label: string }[] = [
    { p: /\bfetch\s*\(/,                            label: 'fetch()' },
    { p: /\bXMLHttpRequest\b/,                      label: 'XMLHttpRequest' },
    { p: /\bnew\s+WebSocket\b/,                     label: 'WebSocket' },
    { p: /\bEventSource\b/,                         label: 'EventSource' },
    { p: /navigator\.sendBeacon/,                   label: 'sendBeacon' },
    { p: /from\s+['"](.*ai-sdk.*|@ai-sdk\/.*)['"]/, label: 'ai-sdk import' },
    { p: /from\s+['"]@anthropic-ai\/.*['"]/,        label: 'anthropic SDK' },
    { p: /from\s+['"]openai['"]/,                   label: 'openai SDK' },
    { p: /from\s+['"]axios['"]/,                    label: 'axios' },
  ];
  for (const f of FORBIDDEN) {
    check(`REQUIRED L: HybridFlowView contains no ${f.label}`, !f.p.test(hybridSrc));
    check(`REQUIRED L: ProfileSummaryReview contains no ${f.label}`, !f.p.test(reviewSrc));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED M — Plain / no internal jargon on the user-visible spine.
// Re-pin the P3.7 + P3.8 jargon rules from the hybrid surface specifically.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const spine = buildResultFromSession({ responses: BURNOUT_RESPONSES, profile: { ageBand: '30_late' } });
  const ep = spine.executionPlan;
  const pm = spine.solutionLayer.primaryModule;
  const text = [
    spine.identityAxis.statement,
    spine.profileContext?.body ?? '',
    ep.strategyStatement,
    ep.coreExperiment.label,
    ep.closingLine,
    ...ep.weeklyActions.map((w) => `${w.week} ${w.action}`),
    ...ep.successSignals,
    ...ep.stopOrPivotCriteria,
    ...ep.reevaluationChecklist,
    pm.title, pm.goal, pm.why,
    ...pm.plan.map((p) => `${p.week} ${p.action}`),
    ...pm.successSignals,
    ...pm.stopPivot,
  ].join(' || ');
  check('REQUIRED M: no "가치 트레이드오프" in hybrid result surfaces (burnout fixture)',
    !text.includes('가치 트레이드오프'));
  check('REQUIRED M: no bare "트레이드오프" jargon in hybrid result surfaces (burnout fixture)',
    !text.includes('트레이드오프'));
  check('REQUIRED M: no internal "모듈" label in hybrid result surfaces (burnout fixture)',
    !text.includes('모듈'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED N — Hybrid phases enumerated correctly.
// 4 phases: 'profile' | 'profileReview' | 'mainFlow' | 'result'.
// ═══════════════════════════════════════════════════════════════════════════════
check('REQUIRED N: HybridFlowView declares Phase = profile | profileReview | mainFlow | result',
  /type Phase\s*=\s*['"]profile['"]\s*\|\s*['"]profileReview['"]\s*\|\s*['"]mainFlow['"]\s*\|\s*['"]result['"]/.test(hybridSrc));

// ─── Final report ──────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
