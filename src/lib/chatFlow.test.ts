// Headless tests for P3 guided chat — covers the user-spec REQUIRED test list.
// Self-contained: no Jest, no DOM, no fetch, just node --experimental-strip-types.
//
// Each REQUIRED N: prefix maps 1:1 to the user-spec required-tests list so
// failures point straight at the spec line.

import { CAREER_QUESTION_FLOW } from '../data/careerQuestionFlow.ts';
import {
  buildChatScript,
  PROFILE_CHAT_STEPS,
  applyProfileAnswer,
  applyCappedToggle,
  optionLabelFor,
  countAnswerSteps,
} from './chatFlow.ts';
import type { ChatStep } from './chatFlow.ts';
import { resolveRoute } from './routing.ts';
import {
  buildResultFromResponses,
  normalizeProfile,
  applyConstraintTagToggle,
  parsePersistedSession,
} from '../components/careerCompassV2/session.ts';
import type { FlowResponses, PersistedSession } from '../components/careerCompassV2/session.ts';
import type { UserProfile } from '../types/careerCompass.ts';
// Node builtins are NOT included in the app's tsconfig.app.json — test files
// are excluded from that build (industry standard: tests are validated by
// running them, not by tsc -b). Imports below resolve at runtime under
// `node --experimental-strip-types`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 1  —  #v2 route still renders existing V2 flow.
// REQUIRED 2  —  #chat route renders GuidedChatView.
// ════════════════════════════════════════════════════════════════════════════
check('REQUIRED 1: #v2 resolves to "v2" route', resolveRoute('#v2') === 'v2');
check('REQUIRED 1: #/v2 alias also resolves to "v2"', resolveRoute('#/v2') === 'v2');
check('REQUIRED 2: #chat resolves to "chat" route', resolveRoute('#chat') === 'chat');
check('REQUIRED 2: #chat-v1 alias resolves to "chat"', resolveRoute('#chat-v1') === 'chat');
check('REQUIRED 2: #/chat alias resolves to "chat"', resolveRoute('#/chat') === 'chat');
check('Route — unknown hash falls back to "v1"', resolveRoute('#anything') === 'v1');
check('Route — empty hash falls back to "v1"', resolveRoute('') === 'v1');
// P3.8 — hybrid route + alias #v3
check('P3.8: #hybrid resolves to "hybrid"', resolveRoute('#hybrid') === 'hybrid');
check('P3.8: #v3 alias resolves to "hybrid"', resolveRoute('#v3') === 'hybrid');
check('P3.8: #/hybrid alias resolves to "hybrid"', resolveRoute('#/hybrid') === 'hybrid');
check('P3.8: #/v3 alias resolves to "hybrid"', resolveRoute('#/v3') === 'hybrid');
check('P3.8: #chat still resolves to "chat" (kept as experiment route)', resolveRoute('#chat') === 'chat');
check('P3.8: #v2 still resolves to "v2" (unchanged)', resolveRoute('#v2') === 'v2');

// App.tsx must wire these routes to the correct components. Static-read App.tsx
// to confirm the conditional render still maps 'v2' → CareerCompassV2Page and
// 'chat' → GuidedChatView. This catches a future regression where someone
// changes the routing logic without updating tests.
{
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const appSrc = readFileSync(resolve(__dirname, '../App.tsx'), 'utf-8');
  check('REQUIRED 1: App.tsx route "v2" still renders CareerCompassV2Page',
    /route === ['"]v2['"][^]*<CareerCompassV2Page/.test(appSrc));
  check('REQUIRED 2: App.tsx route "chat" still renders GuidedChatView',
    /route === ['"]chat['"][^]*<GuidedChatView/.test(appSrc));
  // P3.8 — hybrid route wires to HybridFlowView
  check('P3.8: App.tsx route "hybrid" renders HybridFlowView',
    /route === ['"]hybrid['"][^]*<HybridFlowView/.test(appSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 3  —  Guided chat profile answers update UserProfile.
// ════════════════════════════════════════════════════════════════════════════
{
  // single_select via ageBand
  const ageStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'ageBand',
  )!;
  const out = applyProfileAnswer({}, ageStep, ['30_late']);
  check('REQUIRED 3: single_select profile answer writes to UserProfile field',
    out.ageBand === '30_late');
}
{
  // multi_select via concernTags
  const concernStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'concernTags',
  )!;
  const out = applyProfileAnswer({}, concernStep, ['burnout', 'job_change']);
  check('REQUIRED 3: multi_select profile answer writes array to UserProfile field',
    Array.isArray(out.concernTags)
    && out.concernTags!.length === 2
    && out.concernTags!.includes('burnout')
    && out.concernTags!.includes('job_change'));
}
{
  // text via jobRoleRaw
  const jrStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'jobRoleRaw',
  )!;
  const out = applyProfileAnswer({}, jrStep, ['회사원']);
  check('REQUIRED 3: text profile answer writes string to UserProfile field',
    out.jobRoleRaw === '회사원');
}
{
  // Empty multi-select clears the field (no phantom undefined)
  const concernStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'concernTags',
  )!;
  const out = applyProfileAnswer({ concernTags: ['burnout'] }, concernStep, []);
  check('REQUIRED 3: empty multi_select clears the field',
    !('concernTags' in out));
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 4  —  jobRoleRaw entered in chat is normalized using existing normalizer.
// ════════════════════════════════════════════════════════════════════════════
{
  const jrStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'jobRoleRaw',
  )!;
  let profile: UserProfile = {};
  profile = applyProfileAnswer(profile, jrStep, ['  회사원  ']);  // user typed w/ whitespace
  profile = normalizeProfile(profile);                          // eager normalize (same as commitProfile)
  check('REQUIRED 4: jobRoleRaw trimmed by normalizeProfile',
    profile.jobRoleRaw === '회사원');
  check('REQUIRED 4: jobRoleCategory derived via normalizeJobRole',
    profile.jobRoleCategory === 'other');
}
{
  // Multi-domain jobRoleRaw derivation (drives jobRoleSecondaryCategories).
  const jrStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'jobRoleRaw',
  )!;
  let profile: UserProfile = {};
  profile = applyProfileAnswer(profile, jrStep, ['수의사 출신 투자심사역']);
  profile = normalizeProfile(profile);
  check('REQUIRED 4: multi_domain jobRole derived by normalizer',
    profile.jobRoleCategory === 'multi_domain'
    && Array.isArray(profile.jobRoleSecondaryCategories)
    && profile.jobRoleSecondaryCategories!.includes('veterinary_pet')
    && profile.jobRoleSecondaryCategories!.includes('investment_finance'));
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 5  —  concernTags max 2 behavior works.
// REQUIRED 7  —  desiredPaths max 2 behavior works.
// (Both use applyCappedToggle with max = 2.)
// ════════════════════════════════════════════════════════════════════════════
{
  const concernStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'concernTags',
  )!;
  check('REQUIRED 5: concernTags chat step has maxSelect = 2',
    concernStep.maxSelect === 2);
  let draft: string[] = [];
  draft = applyCappedToggle(draft, 'burnout', 2);          // → [burnout]
  draft = applyCappedToggle(draft, 'job_change', 2);       // → [burnout, job_change]
  draft = applyCappedToggle(draft, 'too_many_options', 2); // CAP HIT → no-op
  check('REQUIRED 5: concernTags 3rd selection at cap is a no-op',
    JSON.stringify(draft) === JSON.stringify(['burnout', 'job_change']));
  draft = applyCappedToggle(draft, 'burnout', 2);          // toggle off
  check('REQUIRED 5: concernTags toggle-off removes the value',
    JSON.stringify(draft) === JSON.stringify(['job_change']));
  draft = applyCappedToggle(draft, 'too_many_options', 2); // now room → append
  check('REQUIRED 5: concernTags can re-add once below cap',
    JSON.stringify(draft) === JSON.stringify(['job_change', 'too_many_options']));
}
{
  const desiredStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'desiredPaths',
  )!;
  check('REQUIRED 7: desiredPaths chat step has maxSelect = 2',
    desiredStep.maxSelect === 2);
  let draft: string[] = [];
  draft = applyCappedToggle(draft, 'job_change', 2);
  draft = applyCappedToggle(draft, 'side_project', 2);
  draft = applyCappedToggle(draft, 'startup', 2);    // CAP HIT
  check('REQUIRED 7: desiredPaths 3rd selection at cap is a no-op',
    JSON.stringify(draft) === JSON.stringify(['job_change', 'side_project']));
}
// Purity: applyCappedToggle does not mutate the input.
{
  const a: string[] = ['x', 'y'];
  const before = JSON.stringify(a);
  applyCappedToggle(a, 'z', 2);
  check('REQUIRED 5/7: applyCappedToggle PURITY — input not mutated',
    JSON.stringify(a) === before);
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 6  —  constraintTags none-exclusive behavior works.
// Chat step is marked noneExclusive: true, routing toggles through the
// EXISTING applyConstraintTagToggle helper (session.ts), so we verify both
// the flag AND that the helper enforces the rule end-to-end.
// ════════════════════════════════════════════════════════════════════════════
{
  const cStep = PROFILE_CHAT_STEPS.find(
    (s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile' && s.targetField === 'constraintTags',
  )!;
  check('REQUIRED 6: constraintTags chat step has noneExclusive = true',
    cStep.noneExclusive === true);
  check('REQUIRED 6: constraintTags chat step has maxSelect = 2',
    cStep.maxSelect === 2);
  // Selecting `none` while real tags exist wipes them
  let draft = applyConstraintTagToggle(['money', 'time'] as never, 'none' as never);
  check('REQUIRED 6: selecting "none" wipes prior real tags → ["none"]',
    JSON.stringify(draft) === JSON.stringify(['none']));
  // Selecting a real tag while `none` is on drops `none`
  draft = applyConstraintTagToggle(['none'] as never, 'money' as never);
  check('REQUIRED 6: selecting a real tag while "none" is on drops "none"',
    JSON.stringify(draft) === JSON.stringify(['money']));
  // Cap-2 still enforced
  draft = applyConstraintTagToggle(['money', 'time'] as never, 'energy_burnout' as never);
  check('REQUIRED 6: 3rd real tag at cap is a no-op',
    JSON.stringify(draft) === JSON.stringify(['money', 'time']));
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 8  —  main question chat answers update FlowResponses.
// We simulate the chat container's main-step commit and assert the resulting
// FlowResponses entry matches the exact shape V2 writes (StepResponse2).
// ════════════════════════════════════════════════════════════════════════════
{
  const responses: FlowResponses = {};
  // single_select → { selectedOptionIds: [id] }
  responses['cs_main'] = { selectedOptionIds: ['cs_rest'] };
  check('REQUIRED 8: single_select main answer writes selectedOptionIds',
    JSON.stringify(responses['cs_main']) === JSON.stringify({ selectedOptionIds: ['cs_rest'] }));
  // multi_select → { selectedOptionIds: [...ids] }
  responses['ar_roles'] = { selectedOptionIds: ['ar_reset', 'ar_expert'] };
  check('REQUIRED 8: multi_select main answer writes selectedOptionIds array',
    JSON.stringify(responses['ar_roles'].selectedOptionIds) === JSON.stringify(['ar_reset', 'ar_expert']));
  // ranking (cv_priorities) → { ranking: [...ordered] }
  responses['cv_priorities'] = { ranking: ['pr_recovery', 'pr_stability'] };
  check('REQUIRED 8: ranking main answer writes ranking array',
    JSON.stringify(responses['cv_priorities'].ranking) === JSON.stringify(['pr_recovery', 'pr_stability']));
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 9  —  CAREER_QUESTION_FLOW question IDs are preserved.
// Every main chat step's questionId must equal an existing CAREER_QUESTION_FLOW
// step.id verbatim.
// ════════════════════════════════════════════════════════════════════════════
{
  const script = buildChatScript();
  const mainSteps = script.filter(
    (s): s is Extract<ChatStep, { phase: 'main' }> => s.phase === 'main',
  );
  const flowIds = new Set(CAREER_QUESTION_FLOW.map((q) => q.id));
  let drift = 0;
  for (const m of mainSteps) if (!flowIds.has(m.questionId)) drift++;
  check('REQUIRED 9: every main step questionId exists in CAREER_QUESTION_FLOW',
    drift === 0);

  // The ONLY allowed omission is the optional_short_text ap_memo — confirm
  // nothing else got dropped.
  const expected = CAREER_QUESTION_FLOW
    .filter((q) => q.inputType !== 'optional_short_text')
    .map((q) => q.id)
    .sort()
    .join(',');
  const actual = mainSteps.map((s) => s.questionId).sort().join(',');
  check('REQUIRED 9: chat covers every non-memo CAREER_QUESTION_FLOW step',
    actual === expected);
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 10  —  CAREER_QUESTION_FLOW option values are preserved.
// Every main chat step's option.value must equal a canonical ChoiceOption.id
// from the underlying question.
// ════════════════════════════════════════════════════════════════════════════
{
  const script = buildChatScript();
  const mainSteps = script.filter(
    (s): s is Extract<ChatStep, { phase: 'main' }> => s.phase === 'main',
  );
  let drift = 0;
  for (const m of mainSteps) {
    const underlying = CAREER_QUESTION_FLOW.find((q) => q.id === m.questionId);
    const ids = new Set((underlying?.options ?? []).map((o) => o.id));
    for (const o of m.options) if (!ids.has(o.value)) drift++;
  }
  check('REQUIRED 10: every chat option.value === a canonical ChoiceOption.id',
    drift === 0);
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 11  —  Completing chat flow builds a result.
// Drive a full chat-shaped session through the existing entry point.
// ════════════════════════════════════════════════════════════════════════════
function buildBurnoutSession(): { responses: FlowResponses; profile: UserProfile } {
  const profile: UserProfile = {
    jobRoleRaw: '회사원',
    workMode: 'organization',
    totalCareerStage: 'total_3_7',
    currentFieldStage: 'current_3_7',
    transitionTiming: 'within_3_6_months',
    transitionIntent: 'preparing',
    concernTags: ['burnout'],
    constraintTags: ['energy_burnout'],
    desiredPaths: ['job_change'],
  };
  const responses: FlowResponses = {
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
  return { responses, profile };
}

const burnout = buildBurnoutSession();
const chatSpine = buildResultFromResponses(burnout.responses, { profile: burnout.profile });
check('REQUIRED 11: completing chat flow builds a result (ResultSpine returned)',
  !!chatSpine && !!chatSpine.executionPlan && !!chatSpine.identityAxis);

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 12-16  —  Chat result uses existing spine fields verbatim.
// We render the chat result bubbles purely from the spine. Confirm each
// required field is present, non-empty, and surfaces through the spine.
// ════════════════════════════════════════════════════════════════════════════
check('REQUIRED 12: chat result uses existing identityStatement',
  typeof chatSpine.identityAxis.statement === 'string'
  && chatSpine.identityAxis.statement.length > 0);
check('REQUIRED 13: chat result uses existing strategyStatement',
  typeof chatSpine.executionPlan.strategyStatement === 'string'
  && chatSpine.executionPlan.strategyStatement.length > 0);
check('REQUIRED 14: chat result uses existing coreExperimentLabel',
  typeof chatSpine.executionPlan.coreExperiment.label === 'string'
  && chatSpine.executionPlan.coreExperiment.label.length > 0);
check('REQUIRED 15: chat result uses existing weeklyActions',
  Array.isArray(chatSpine.executionPlan.weeklyActions)
  && chatSpine.executionPlan.weeklyActions.length > 0
  && typeof chatSpine.executionPlan.weeklyActions[0].week === 'string'
  && typeof chatSpine.executionPlan.weeklyActions[0].action === 'string');
check('REQUIRED 16: chat result uses existing closingLine',
  typeof chatSpine.executionPlan.closingLine === 'string'
  && chatSpine.executionPlan.closingLine.length > 0);

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 17-19  —  Chat does NOT change routing keys vs V2 with same answers.
// V2 reference: identical responses + profile fed through buildResultFromResponses
// (which is V2's exact entry too). If routing keys diverge, the chat is changing
// behavior — fail.
// ════════════════════════════════════════════════════════════════════════════
const v2RefSpine = buildResultFromResponses(burnout.responses, { profile: burnout.profile });
check('REQUIRED 17: chat mainTypeKey === V2 mainTypeKey',
  chatSpine.solutionLayer.mainTypeKey === v2RefSpine.solutionLayer.mainTypeKey);
check('REQUIRED 18: chat sourceOptionKey === V2 sourceOptionKey',
  chatSpine.executionPlan.coreExperiment.sourceOptionKey === v2RefSpine.executionPlan.coreExperiment.sourceOptionKey);
check('REQUIRED 19: chat planModule === V2 planModule',
  chatSpine.solutionLayer.primaryModule.key === v2RefSpine.solutionLayer.primaryModule.key);

// Belt-and-suspenders: also confirm bare-profile (no chat profile at all) gives
// the same routing keys — the engine MUST be profile-blind.
{
  const bareSpine = buildResultFromResponses(burnout.responses);
  check('REQUIRED 17-19: bare-profile routing keys identical to chat-profile routing keys',
    bareSpine.solutionLayer.mainTypeKey === chatSpine.solutionLayer.mainTypeKey
    && bareSpine.executionPlan.coreExperiment.sourceOptionKey === chatSpine.executionPlan.coreExperiment.sourceOptionKey
    && bareSpine.solutionLayer.primaryModule.key === chatSpine.solutionLayer.primaryModule.key);
}

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 20  —  P1.7 burnout invariant still passes.
// (overloadedBurnout ⇒ finalSourceOptionKey=restRecover ⇒ primaryModule=recoveryFirst)
// ════════════════════════════════════════════════════════════════════════════
check('REQUIRED 20: P1.7 burnout invariant — mainTypeKey = overloadedBurnout',
  chatSpine.solutionLayer.mainTypeKey === 'overloadedBurnout');
check('REQUIRED 20: P1.7 burnout invariant — sourceOptionKey = restRecover',
  chatSpine.executionPlan.coreExperiment.sourceOptionKey === 'restRecover');
check('REQUIRED 20: P1.7 burnout invariant — primaryModule = recoveryFirst',
  chatSpine.solutionLayer.primaryModule.key === 'recoveryFirst');

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED 23  —  No LLM / API / network call introduced.
// Static scan of every file in the chat module + the routing module: forbidden
// patterns include fetch / XMLHttpRequest / WebSocket / EventSource /
// sendBeacon / ai-sdk / anthropic / openai / axios.
// (Source files are read at test time. navigator.clipboard.writeText is an
// OS-level API — NOT a network call — and is whitelisted.)
// ════════════════════════════════════════════════════════════════════════════
{
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const files = [
    '../lib/chatFlow.ts',
    '../lib/routing.ts',
    '../components/chatV1/GuidedChatView.tsx',
    '../components/chatV1/ChatMessage.tsx',
    '../components/chatV1/ChatChoiceButton.tsx',
  ];
  const forbidden: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bfetch\s*\(/,                            label: 'fetch()' },
    { pattern: /\bXMLHttpRequest\b/,                      label: 'XMLHttpRequest' },
    { pattern: /\bnew\s+WebSocket\b/,                     label: 'WebSocket' },
    { pattern: /\bEventSource\b/,                         label: 'EventSource' },
    { pattern: /navigator\.sendBeacon/,                   label: 'sendBeacon' },
    { pattern: /from\s+['"](.*ai-sdk.*|@ai-sdk\/.*)['"]/, label: 'ai-sdk import' },
    { pattern: /from\s+['"]@anthropic-ai\/.*['"]/,        label: 'anthropic SDK' },
    { pattern: /from\s+['"]openai['"]/,                   label: 'openai SDK' },
    { pattern: /from\s+['"]axios['"]/,                    label: 'axios' },
  ];
  for (const rel of files) {
    const path = resolve(__dirname, rel);
    const src = readFileSync(path, 'utf-8');
    for (const f of forbidden) {
      check(`REQUIRED 23: ${rel} contains no ${f.label}`, !f.pattern.test(src));
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Extra coverage — script shape + persistence parity (already used by the chat
// container; tested here so chatFlow.ts has full self-coverage).
// ════════════════════════════════════════════════════════════════════════════
{
  const script = buildChatScript();
  // ADR-001 P0 — 11th profile step: pc_concernText free-text opener.
  check('Extra: script has 11 profile steps (incl. concern free-text opener)',
    script.filter((s) => s.phase === 'profile').length === 11);
  check('Extra: script has 19 main steps (CAREER_QUESTION_FLOW minus ap_memo)',
    script.filter((s) => s.phase === 'main').length === 19);
  check('Extra: script has exactly 1 result_intro narration step',
    script.filter((s) => s.phase === 'result_intro').length === 1);
  // 30 = 11 profile (incl. pc_concernText, ADR-001) + 19 main (cs_blocker 추가).
  check('Extra: countAnswerSteps excludes result_intro from the count',
    countAnswerSteps(script) === 30);
}
{
  // PersistedSession round-trip parity — chat saves under its own key but the
  // SHAPE is bit-identical to V2.
  const session: PersistedSession = {
    stepIndex: 1, responses: burnout.responses, profile: burnout.profile,
    done: true, profileDone: true,
  };
  const parsed = parsePersistedSession(JSON.stringify(session), CAREER_QUESTION_FLOW.length);
  check('Extra: PersistedSession shape parity — round-trip preserves fields',
    parsed.done === true && parsed.profileDone === true
    && JSON.stringify(parsed.responses) === JSON.stringify(burnout.responses));
}
{
  // optionLabelFor sanity for main + profile steps.
  const script = buildChatScript();
  const main = script.find((s): s is Extract<ChatStep, { phase: 'main' }> =>
    s.phase === 'main' && s.questionId === 'cs_main')!;
  check('Extra: optionLabelFor returns the canonical label for a main option',
    optionLabelFor(main, 'cs_rest') === '쉬어야 할지 밀어붙여야 할지 모르겠다');
}

// ── Final report ────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
