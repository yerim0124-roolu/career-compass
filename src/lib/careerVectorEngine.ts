// Career Compass 2.0 — career vector engine.
// Deterministic, no LLM, no UI, no backend. Converts low-friction choices
// (cards, forced choices, rankings, sliders, option reactions) into:
//   1. a normalized 13-axis CareerVector
//   2. inferred Korean archetype tags (secondary only)
//   3. generated career option candidates
//   4. per-option fit scores
//
// Principle: the vector helps build the identity axis and rank option fit, but it
// NEVER overrides the readiness gates (Step 3 owns timing authority). Same input
// always yields the same output. All thresholds are explicit constants below.

import type {
  CareerVector,
  CareerVectorKey,
  CareerOptionKey,
  CareerArchetype,
  ChoiceOption,
} from '../types/careerCompass.ts';
import { ARCHETYPE_LABELS, CAREER_OPTION_LABELS } from '../types/careerCompass.ts';
import { RISK_PROFILES } from './readinessGateEngine.ts';

// ─── Tunable constants (explicit & documented) ───────────────────────────────
const RANK_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2] as const; // rank1..rank5; beyond → RANK_TAIL
const RANK_TAIL = 0.1;
const SLIDER_MAX_POINTS = 10;     // a maxed slider (100) ≈ two strong (5-pt) cards
const MOD = 45;                   // "moderately high" axis threshold (normalized 0–100)
const ARCHETYPE_MIN_SCORE = 50;   // below this an archetype is not surfaced
const ARCHETYPE_MAX_TAGS = 4;     // secondary tags only — caller typically shows top 2–3
const GENERATION_THRESHOLD = 50;  // min fit for an option to be surfaced as a candidate

const VECTOR_KEYS: readonly CareerVectorKey[] = [
  'expertise', 'autonomy', 'stability', 'marketOrientation', 'creativity',
  'analysisOrientation', 'ventureOrientation', 'executionDrive', 'impactOrientation',
  'recoveryNeed', 'riskTolerance', 'financialReadiness', 'marketValidationNeed',
];

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const mean = (...xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ─── Vector accumulation ──────────────────────────────────────────────────────

export function createEmptyCareerVector(): CareerVector {
  return {
    expertise: 0, autonomy: 0, stability: 0, marketOrientation: 0, creativity: 0,
    analysisOrientation: 0, ventureOrientation: 0, executionDrive: 0, impactOrientation: 0,
    recoveryNeed: 0, riskTolerance: 0, financialReadiness: 0, marketValidationNeed: 0,
  };
}

function addScaled(target: CareerVector, effects: Partial<CareerVector>, weight: number): CareerVector {
  const out: CareerVector = { ...target };
  for (const key of Object.keys(effects) as CareerVectorKey[]) {
    const val = effects[key];
    if (val !== undefined) out[key] += val * weight;
  }
  return out;
}

export function applyChoiceEffects(vector: CareerVector, choice: ChoiceOption): CareerVector {
  return addScaled(vector, choice.scoreEffects, 1);
}

export function applyMultipleChoiceEffects(vector: CareerVector, choices: ChoiceOption[]): CareerVector {
  return choices.reduce((acc, c) => applyChoiceEffects(acc, c), vector);
}

// Higher-ranked choices contribute more (rank1 = full weight). Order = rank order.
export function applyRankingEffects(vector: CareerVector, ranked: ChoiceOption[]): CareerVector {
  let out = vector;
  ranked.forEach((choice, i) => {
    const weight = i < RANK_WEIGHTS.length ? RANK_WEIGHTS[i] : RANK_TAIL;
    out = addScaled(out, choice.scoreEffects, weight);
  });
  return out;
}

// sliderValues: axis → 0–100 reading. Converted to comparable raw points.
export function applySliderEffects(vector: CareerVector, sliderValues: Partial<Record<CareerVectorKey, number>>): CareerVector {
  const out: CareerVector = { ...vector };
  for (const key of Object.keys(sliderValues) as CareerVectorKey[]) {
    const val = sliderValues[key];
    if (val !== undefined) out[key] += (val / 100) * SLIDER_MAX_POINTS;
  }
  return out;
}

// Relative normalization: the strongest axis becomes 100, others scale proportionally.
// Robust to how many cards were picked (card-based flows have few selections).
// Negative accumulations clamp to 0. Empty vector → all zeros.
export function normalizeCareerVector(vector: CareerVector): CareerVector {
  const max = Math.max(0, ...VECTOR_KEYS.map((k) => vector[k]));
  const out = createEmptyCareerVector();
  if (max <= 0) return out;
  for (const k of VECTOR_KEYS) {
    out[k] = clamp(Math.round((vector[k] / max) * 100), 0, 100);
  }
  return out;
}

// ─── Archetype inference (secondary tags) ─────────────────────────────────────
// Expects a normalized 0–100 vector. Korean labels come from ARCHETYPE_LABELS.
// Scores combine the defining axes of each archetype; the top few are returned.

export interface ArchetypeMatch {
  key: CareerArchetype;
  label: string;
  score: number;
}

const BREADTH_AXES: readonly CareerVectorKey[] = [
  'expertise', 'creativity', 'marketOrientation', 'impactOrientation',
  'analysisOrientation', 'autonomy', 'ventureOrientation',
];

// Portfolio breadth: how many orientation axes are moderately high (drives 커리어 조합가).
function breadth(v: CareerVector): number {
  const count = BREADTH_AXES.filter((k) => v[k] >= MOD).length;
  return (count / BREADTH_AXES.length) * 100;
}

export function inferCareerArchetypes(vector: CareerVector): ArchetypeMatch[] {
  const scores: Record<CareerArchetype, number> = {
    expertExpander: mean(vector.expertise, vector.impactOrientation, vector.autonomy),
    knowledgeTranslator: mean(vector.expertise, vector.creativity, vector.impactOrientation),
    marketInterpreter: mean(vector.analysisOrientation, vector.marketOrientation),
    careerComposer: 0.5 * vector.autonomy + 0.5 * breadth(vector),
    problemFounder: mean(vector.ventureOrientation, vector.executionDrive, vector.riskTolerance),
    stableRedesigner: mean(vector.stability, 100 - vector.riskTolerance),
    recoveryFirst: vector.recoveryNeed,
    executionOperator: mean(vector.executionDrive, vector.stability) - vector.creativity * 0.1,
    // advisor leans on depth/credibility, not creative output or building
    expertAdvisor: mean(vector.expertise, vector.impactOrientation) - vector.creativity * 0.15 - vector.ventureOrientation * 0.15,
    expertBuilder: mean(vector.expertise, vector.executionDrive) - vector.creativity * 0.1,
  };

  return (Object.keys(scores) as CareerArchetype[])
    .map((key) => ({ key, label: ARCHETYPE_LABELS[key], score: clamp(Math.round(scores[key]), 0, 100) }))
    .filter((m) => m.score >= ARCHETYPE_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)) // key tiebreak = deterministic
    .slice(0, ARCHETYPE_MAX_TAGS);
}

// ─── Option fit ────────────────────────────────────────────────────────────────
// Base fit = identity/asset/market alignment (axis weights sum to 1.0). Then apply
// energy/recovery, execution-demand, and risk-tolerance modifiers using the shared
// per-option RISK_PROFILES (single source of truth with the gate engine).
//
// recoveryNeed is NOT a negative trait: it only penalizes high-execution/high-risk
// options, and it positively weights the recovery-friendly options.

const RECOVERY_FRIENDLY: ReadonlySet<CareerOptionKey> = new Set<CareerOptionKey>(['restRecover', 'stayRedesign']);

// Explicit type annotation (not `as const`) so the map is uniformly indexable by
// any CareerVectorKey while still requiring every CareerOptionKey to be present.
const OPTION_AXIS_WEIGHTS: Record<CareerOptionKey, Partial<Record<CareerVectorKey, number>>> = {
  stayRedesign:     { stability: 0.4, expertise: 0.3, autonomy: 0.1, recoveryNeed: 0.2 },
  jobChange:        { expertise: 0.3, marketOrientation: 0.3, autonomy: 0.2, stability: 0.2 },
  startup:          { ventureOrientation: 0.35, executionDrive: 0.3, riskTolerance: 0.2, impactOrientation: 0.15 },
  independent:      { autonomy: 0.3, expertise: 0.25, marketOrientation: 0.2, riskTolerance: 0.25 },
  contentBrand:     { creativity: 0.3, impactOrientation: 0.3, marketOrientation: 0.2, expertise: 0.2 },
  advisoryTeaching: { expertise: 0.4, impactOrientation: 0.3, autonomy: 0.3 },
  investAnalysis:   { analysisOrientation: 0.4, marketOrientation: 0.35, expertise: 0.25 },
  restRecover:      { recoveryNeed: 0.8, stability: 0.2 },
};

export function calculateOptionFit(optionKey: CareerOptionKey, vector: CareerVector): number {
  const weights = OPTION_AXIS_WEIGHTS[optionKey];
  let base = 0;
  for (const key of Object.keys(weights) as CareerVectorKey[]) {
    const w = weights[key];
    if (w !== undefined) base += w * vector[key];
  }

  const profile = RISK_PROFILES[optionKey];
  const recoveryFriendly = RECOVERY_FRIENDLY.has(optionKey);

  // energy / recovery compatibility
  const recoveryPenalty = recoveryFriendly
    ? 0
    : profile.executionLoad === 'high' ? vector.recoveryNeed * 0.4
    : profile.executionLoad === 'medium' ? vector.recoveryNeed * 0.2
    : 0;

  // execution demand (high-execution options need execution drive)
  const executionPenalty = profile.executionLoad === 'high' ? (100 - vector.executionDrive) * 0.2 : 0;

  // risk tolerance vs financial risk
  const riskPenalty = recoveryFriendly
    ? 0
    : profile.financialRisk === 'high' ? (100 - vector.riskTolerance) * 0.3
    : profile.financialRisk === 'medium' ? (100 - vector.riskTolerance) * 0.15
    : 0;

  return clamp(Math.round(base - recoveryPenalty - executionPenalty - riskPenalty), 0, 100);
}

export interface OptionFit {
  optionKey: CareerOptionKey;
  label: string;
  fit: number;
}

const OPTION_KEYS = Object.keys(CAREER_OPTION_LABELS) as CareerOptionKey[];

export function rankCareerOptions(vector: CareerVector): OptionFit[] {
  return OPTION_KEYS
    .map((optionKey) => ({ optionKey, label: CAREER_OPTION_LABELS[optionKey], fit: calculateOptionFit(optionKey, vector) }))
    .sort((a, b) => b.fit - a.fit || a.optionKey.localeCompare(b.optionKey)); // key tiebreak = deterministic
}

// Candidate options to surface: those clearing the threshold, else the single best.
export function generateCareerOptionsFromVector(vector: CareerVector): CareerOptionKey[] {
  const ranked = rankCareerOptions(vector);
  const above = ranked.filter((o) => o.fit >= GENERATION_THRESHOLD).map((o) => o.optionKey);
  return above.length > 0 ? above : [ranked[0].optionKey];
}
