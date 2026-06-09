// Career Compass 2.0 — pure session logic (no React, no DOM). Bridges the card
// flow responses to the engines so it can be unit-tested headlessly.

import type { QuestionStep, ChoiceOption, CareerOptionKey, CareerVector, ConstructProfile, ResultSpine, MeasuredSignals, UserProfile } from '../../types/careerCompass.ts';
import { CAREER_QUESTION_FLOW, EXPERIMENT_OPTION_BY_CARD, EXPERIMENT_LABEL_BY_CARD, assembleGatesFromSelections, assembleConstructProfile } from '../../data/careerQuestionFlow.ts';
import { createEmptyCareerVector, applyMultipleChoiceEffects, applyRankingEffects, normalizeCareerVector } from '../../lib/careerVectorEngine.ts';
import { buildResultSpine } from '../../lib/resultSpineEngine.ts';
import { normalizeJobRole } from '../../lib/jobRoleNormalizer.ts';
import { buildProfileContextSummary, personalizeNarrativeOpening } from '../../lib/profileContextSummary.ts';
import { buildNarrativePayload } from '../../lib/narrativePayload.ts';
import { buildStoryInsight } from '../../lib/storyInsight.ts';

export interface StepResponse2 {
  selectedOptionIds?: string[];
  ranking?: string[];
  shortText?: string;
  sliderValues?: Record<string, number>;
}

export type FlowResponses = Record<string, StepResponse2>;

// A step is complete enough to advance. optional_short_text is always skippable.
export function isStepComplete(step: QuestionStep, r: StepResponse2 | undefined): boolean {
  if (step.inputType === 'optional_short_text') return true;
  if (step.inputType === 'slider_group') return true; // sliders always have a default value
  if (!r) return false;
  if (step.inputType === 'ranking') {
    return (r.ranking?.length ?? 0) >= (step.minSelect ?? 1);
  }
  const n = r.selectedOptionIds?.length ?? 0;
  if (n < (step.minSelect ?? 1)) return false;
  if (step.maxSelect !== undefined && n > step.maxSelect) return false;
  return true;
}

export function collectSelectedCards(responses: FlowResponses): ChoiceOption[] {
  const cards: ChoiceOption[] = [];
  for (const step of CAREER_QUESTION_FLOW) {
    if (step.inputType === 'ranking') continue;
    const ids = responses[step.id]?.selectedOptionIds;
    if (!ids) continue;
    for (const id of ids) {
      const opt = step.options?.find((o) => o.id === id);
      if (opt) cards.push(opt);
    }
  }
  return cards;
}

export function collectRankedCards(responses: FlowResponses): ChoiceOption[] {
  const out: ChoiceOption[] = [];
  for (const step of CAREER_QUESTION_FLOW) {
    if (step.inputType !== 'ranking') continue;
    const ranking = responses[step.id]?.ranking;
    if (!ranking) continue;
    for (const id of ranking) {
      const opt = step.options?.find((o) => o.id === id);
      if (opt) out.push(opt);
    }
  }
  return out;
}

export function getPreferredExperiment(responses: FlowResponses): CareerOptionKey | undefined {
  const id = responses['ap_experiment']?.selectedOptionIds?.[0];
  return id ? EXPERIMENT_OPTION_BY_CARD[id] : undefined;
}

// General output-format label for the chosen card → coreExperiment label (de-biased copy).
export function getPreferredExperimentLabel(responses: FlowResponses): string | undefined {
  const id = responses['ap_experiment']?.selectedOptionIds?.[0];
  return id ? EXPERIMENT_LABEL_BY_CARD[id] : undefined;
}

// Normalized vector from whatever has been answered so far (used for Live Insight too).
export function buildPartialVector(responses: FlowResponses): CareerVector {
  let v = applyMultipleChoiceEffects(createEmptyCareerVector(), collectSelectedCards(responses));
  v = applyRankingEffects(v, collectRankedCards(responses));
  return normalizeCareerVector(v);
}

// Theory-grounded construct profile from the answered cards (shared assembler).
export function buildConstructProfile(responses: FlowResponses): ConstructProfile {
  return assembleConstructProfile(collectSelectedCards(responses), collectRankedCards(responses));
}

// Share of the (non-optional) flow that has been answered — feeds confidence.
export function computeInputCompleteness(responses: FlowResponses): number {
  const core = CAREER_QUESTION_FLOW.filter((s) => s.inputType !== 'optional_short_text');
  if (core.length === 0) return 1;
  const done = core.filter((s) => isStepComplete(s, responses[s.id])).length;
  return done / core.length;
}

// Which ambiguous low-signals were actually probed by answered cards. Prevents the
// solution engine from inferring negative tags (작은 성공 필요 등) from unmeasured 0s.
export function computeMeasuredSignals(responses: FlowResponses): MeasuredSignals {
  const cards = collectSelectedCards(responses);
  return {
    selfEfficacy: cards.some((c) => c.constructEffects?.scct?.selfEfficacy !== undefined),
    confidence: cards.some((c) => c.constructEffects?.adaptability?.confidence !== undefined),
  };
}

// P1.2 — did the user explicitly answer rc_options = rc_opt_few? This is the only signal
// the classifier accepts as "I literally see no options" (other rc_options answers don't count).
function computeNoOptionsExplicit(responses: FlowResponses): boolean {
  return responses.rc_options?.selectedOptionIds?.includes('rc_opt_few') ?? false;
}

// ─── P2.0 — Session state with optional UserProfile metadata ──────────────────
// FlowResponses is the engine-facing input. Profile lives alongside it (NOT inside
// responses) and is plumbed read-only through to ResultSpine.profile. Engines must
// never consume profile to alter classification, routing, lenses, or copy decisions
// gated by the P1.x invariants.
export interface SessionState {
  responses: FlowResponses;
  profile: UserProfile;
}

// P2.0 — derive a careerPattern label from priorFieldExperience + totalCareerStage.
// Precedence (high → low):
//   1. totalCareerStage === 'no_fulltime_experience' → 'early_exploration'
//   2. priorFieldExperience === 'multi_field'        → 'multi_track'
//   3. priorFieldExperience === 'has_prior_field'    → 'domain_shift'
//   4. priorFieldExperience === 'single_track'       → 'single_track'
//   5. otherwise: keep the value the caller set (may be undefined).
// IMPORTANT: careerPattern is NOT consumed by any engine routing yet. This helper
// only enriches the profile metadata so future copy personalization can read it.
export function deriveCareerPattern(profile: UserProfile): UserProfile['careerPattern'] {
  if (profile.totalCareerStage === 'no_fulltime_experience') return 'early_exploration';
  if (profile.priorFieldExperience === 'multi_field') return 'multi_track';
  if (profile.priorFieldExperience === 'has_prior_field') return 'domain_shift';
  if (profile.priorFieldExperience === 'single_track') return 'single_track';
  return profile.careerPattern;
}

// P2.0 / P2.3 — produce a normalized profile with derived fields populated where
// possible. Pure: returns a new object; never mutates the input. Call this
// anywhere a profile is saved or updated (localStorage save, result build,
// future profile update API).
//
// Derived fields:
//   • careerPattern         (P2.0)  — derived from priorFieldExperience + totalCareerStage
//   • jobRoleCategory       (P2.3)  — derived from jobRoleRaw via jobRoleNormalizer
//   • jobRoleSubcategory    (P2.3)  — derived from jobRoleRaw via jobRoleNormalizer
//   • jobRoleSecondaryCategories (P2.3) — derived from jobRoleRaw
//
// Preservation rule (P2.3): if a caller has explicitly set a job-role field,
// we DO NOT overwrite it. This respects manual taxonomy decisions (e.g. an
// imported audit payload that already carries jobRoleCategory) and keeps the
// derivation idempotent. The same rule applies to careerPattern via
// deriveCareerPattern's fallback branch.
//
// Routing invariant: these derived fields enrich profile metadata only. The
// engine's routing fingerprint must remain identical regardless of any
// job-role derivation, enforced by the session.test.ts P2.3 fingerprint tests.
export function normalizeProfile(profile: UserProfile): UserProfile {
  const next: UserProfile = { ...profile };

  // P2.3 Rule 3 — trim jobRoleRaw before persisting. The user's typed text is
  // preserved verbatim minus leading/trailing whitespace; if only whitespace
  // (or empty), set to undefined so downstream consumers don't see a phantom
  // empty string and so derivation correctly skips an "empty" jobRoleRaw.
  if (typeof next.jobRoleRaw === 'string') {
    const trimmed = next.jobRoleRaw.trim();
    next.jobRoleRaw = trimmed.length > 0 ? trimmed : undefined;
  }

  const careerPattern = deriveCareerPattern(profile);
  if (careerPattern !== undefined) next.careerPattern = careerPattern;

  // P2.3 — derive job-role taxonomy only when (a) jobRoleRaw is set AND
  // (b) no job-role fields have been explicitly populated yet. The presence
  // of even one (category | subcategory | secondaryCategories) is taken as
  // intentional and the whole derivation is skipped — partial overrides
  // would be ambiguous.
  const hasExplicitJobRoleField =
    profile.jobRoleCategory !== undefined ||
    profile.jobRoleSubcategory !== undefined ||
    profile.jobRoleSecondaryCategories !== undefined;
  if (profile.jobRoleRaw && !hasExplicitJobRoleField) {
    const normalized = normalizeJobRole(profile.jobRoleRaw);
    if (normalized) {
      // normalizeJobRole's return shape is intentionally the SAME keys as
      // UserProfile, so we can spread it directly. Optional fields are absent
      // (not undefined) when the normalizer has no signal, so the spread won't
      // wipe anything.
      Object.assign(next, normalized);
    }
  }

  return next;
}

// ─── P2.2 — constraintTags selection rules (pure, UI-independent) ─────────────
// Spec:
//   • Max CONSTRAINT_TAGS_MAX (=2) selections among the "real" constraint tags.
//   • CONSTRAINT_TAGS_NONE ('none') is mutually exclusive — selecting it wipes any
//     other selection; selecting any other tag drops 'none' first.
//   • Clicking a non-'none' tag at the cap is a no-op (returns the unchanged input).
//   • Empty result returns `undefined` (matches the "missing fields stay undefined"
//     persistence rule everywhere else in the profile).
// Lives here (not in the UI) so the rules are unit-testable headlessly.
export const CONSTRAINT_TAGS_MAX = 2;
export const CONSTRAINT_TAGS_NONE = 'none' as const;
export type ConstraintTagValue = NonNullable<UserProfile['constraintTags']>[number];

export function applyConstraintTagToggle(
  current: ReadonlyArray<ConstraintTagValue> | undefined,
  tag: ConstraintTagValue,
): NonNullable<UserProfile['constraintTags']> | undefined {
  const arr = current ?? [];
  const isSelected = arr.includes(tag);

  if (isSelected) {
    const next = arr.filter((t) => t !== tag);
    return next.length === 0 ? undefined : next;
  }

  if (tag === CONSTRAINT_TAGS_NONE) {
    return [CONSTRAINT_TAGS_NONE];
  }

  const withoutNone = arr.filter((t) => t !== CONSTRAINT_TAGS_NONE);
  if (withoutNone.length >= CONSTRAINT_TAGS_MAX) {
    // No-op at cap — caller decides whether to also dim the disallowed pill.
    return arr.length === 0 ? undefined : [...arr];
  }
  return [...withoutNone, tag];
}

// ─── P2.0 / P2.1 — localStorage persistence shape ─────────────────────────────
// `profile` and `profileDone` are both optional so older payloads (pre-P2.0 — no
// profile key; pre-P2.1 — no profileDone key) parse cleanly. parsePersistedSession
// coerces missing values to safe defaults, runs profile through normalizeProfile,
// and applies a backward-compat heuristic for profileDone (see below).
export interface PersistedSession {
  stepIndex: number;
  responses: FlowResponses;
  profile?: UserProfile;
  // P2.1 — true once the user has either filled or explicitly skipped the profile
  // form. Optional on disk so pre-P2.1 payloads parse without a key.
  profileDone?: boolean;
  done: boolean;
}

// Pure parser, no DOM access. flowLength is injected so callers can clamp stepIndex
// against the (live) CAREER_QUESTION_FLOW length without this file depending on it.
// On any failure (null / invalid JSON / unexpected shape) returns the empty default.
// Loaded `profile` is always defined (defaulted to `{}`) on the return shape, even
// though the persisted-on-disk shape allows it to be absent.
//
// P2.2 — profileDone backward-compat heuristic (updated for pre-flow placement):
// The profile form now appears BEFORE the main flow. A pre-P2.1 user with any prior
// progress (responses present OR done=true) was, by definition, already past where
// the new front gate would sit — kicking them back to it on load would feel like
// an unexplained regression. The heuristic:
//   - If the payload explicitly carries profileDone, use it verbatim.
//   - Else (pre-P2.1 payload — no profileDone key):
//       • TRUE  if there is any signal of prior progress (done=true OR at least one
//         entry in responses). Existing users land back in the main flow / result.
//       • FALSE otherwise (truly empty/fresh persistence). New users see the form.
export function parsePersistedSession(
  raw: string | null,
  flowLength: number,
): { stepIndex: number; responses: FlowResponses; profile: UserProfile; done: boolean; profileDone: boolean } {
  const fallback = {
    stepIndex: 0, responses: {} as FlowResponses, profile: {} as UserProfile,
    done: false, profileDone: false,
  };
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as Partial<PersistedSession>;
    const done = p.done ?? false;
    const responses = p.responses ?? {};
    const hasResponses = Object.keys(responses).length > 0;
    const profileDone =
      p.profileDone !== undefined ? p.profileDone : (done || hasResponses);
    return {
      stepIndex: Math.min(Math.max(p.stepIndex ?? 0, 0), Math.max(flowLength - 1, 0)),
      responses,
      profile: normalizeProfile(p.profile ?? {}),
      done,
      profileDone,
    };
  } catch {
    return fallback;
  }
}

// P2.0 — primary entry point. The bare `buildResultFromResponses(responses)` shape is
// preserved (no opts) so every pre-P2.0 caller and every inline FlowResponses test
// fixture continues to work unchanged. The optional `opts.profile` carries UserProfile
// metadata as a read-only pass-through — engines NEVER read it to alter classification,
// routing, lens activation, or any P1.x invariant. Profile is normalized (careerPattern
// derived) before riding on ResultSpine.profile.
export function buildResultFromResponses(
  responses: FlowResponses,
  opts?: { profile?: UserProfile },
): ResultSpine {
  const profile = normalizeProfile(opts?.profile ?? {});
  const vector = buildPartialVector(responses);
  const gates = assembleGatesFromSelections(collectSelectedCards(responses));
  const userSelectedExperimentKey = getPreferredExperiment(responses);
  const spine = buildResultSpine(vector, gates, {
    preferredExperimentOptionKey: userSelectedExperimentKey,
    preferredExperimentLabel: getPreferredExperimentLabel(responses),
    constructProfile: buildConstructProfile(responses),
    inputCompleteness: computeInputCompleteness(responses),
    measured: computeMeasuredSignals(responses),
    noOptionsExplicit: computeNoOptionsExplicit(responses),
    profile,
    userSelectedExperimentKey,
    // 표시 전용 — 사용자가 랭킹한 우선순위 상위 3개 라벨(돈/의미/자유/성장/안정/영향력/회복).
    topValueLabels: collectRankedCards(responses).slice(0, 3).map((c) => c.label),
    // Phase 2 — '하나로 못 좁히는 이유'(ar_narrow) → 분류 타이브레이커.
    narrowingReason: responses.ar_narrow?.selectedOptionIds?.[0],
  });
  // P2.4 — attach the copy-only Profile Context Summary. ADDITIVE METADATA
  // only: the engine has already produced `spine` above; we never feed the
  // summary back into routing. The builder signature is `{ profile, result }`
  // per the user spec — it reads from both, mutates neither. Routing-
  // fingerprint tests in session.test.ts (P2.4 R1+R2) prove that toggling
  // profile data which changes the summary does NOT change any routing key.
  // Builder returns undefined when the profile is essentially empty (per
  // user spec — "hide the section"). We omit the field rather than set it to
  // undefined so the optional `profileContext?: ProfileContextSummary` stays
  // strictly absent on the wire, not `"profileContext": undefined`.
  const profileContext = buildProfileContextSummary({ profile, result: spine });
  // P2.5 — 시안 A: copy-only narrative opening personalization (jobRoleRaw verbatim).
  // Applied AFTER the engine, same additive contract as profileContext above:
  // routing fingerprints (P2.0 R-tests) do not include evidence.narrative.
  const narrative = personalizeNarrativeOpening(spine.evidence.narrative, profile);
  const decorated = narrative === spine.evidence.narrative
    ? spine
    : { ...spine, evidence: { ...spine.evidence, narrative } };
  // ADR-001 — additive LLM-layer seed. Same contract as profileContext:
  // engines never read it; P2.0 routing fingerprints exclude it.
  const narrativeSeed = buildNarrativePayload(decorated, profile, responses);
  // 신호-교차 추론 한 줄(표시 전용, 무비용). 적용 규칙 없으면 omit.
  const storyInsight = buildStoryInsight(profile, responses) ?? undefined;
  const seeded = storyInsight
    ? { ...decorated, narrativeSeed, storyInsight }
    : { ...decorated, narrativeSeed };
  return profileContext ? { ...seeded, profileContext } : seeded;
}

// P2.0 — thin SessionState adapter. Equivalent to
//   buildResultFromResponses(state.responses, { profile: state.profile })
// Kept as a named export for callers that already hold a SessionState.
export function buildResultFromSession(state: SessionState): ResultSpine {
  return buildResultFromResponses(state.responses, { profile: state.profile });
}
