// Demo printer — focuses on support tags BEFORE vs AFTER the measured-only guard.
// Run with `node src/data/solutionModules.demo.ts`. Not a test (no assertions).
//   BEFORE = legacy logic (treats a 0 score as genuinely low → spurious negatives).
//   AFTER  = measured-only guard (negative/inverse tags need real evidence).

import type { CareerVector, ConstructProfile, ReadinessGates, MeasuredSignals, SupportTagKey } from '../types/careerCompass.ts';
import { SUPPORT_TAG_LABELS } from '../types/careerCompass.ts';
import { createEmptyCareerVector } from '../lib/careerVectorEngine.ts';
import { buildResultSpine } from '../lib/resultSpineEngine.ts';

const vec = (p: Partial<CareerVector>): CareerVector => ({ ...createEmptyCareerVector(), ...p });
type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };
function cp(p: DeepPartial<ConstructProfile> = {}): ConstructProfile {
  return {
    scct: { selfEfficacy: 0, outcomeExpectation: 0, goalClarity: 0, contextualSupport: 0, contextualBarrier: 0, ...p.scct },
    adaptability: { concern: 0, control: 0, curiosity: 0, confidence: 0, ...p.adaptability },
    difficulty: { readinessGap: 0, selfInformationGap: 0, marketInformationGap: 0, valueConflict: 0, optionOverload: 0, ...p.difficulty },
    mcda: { identityFit: 0, assetLeverage: 0, marketPotential: 0, energySustainability: 0, financialSafety: 0, autonomy: 0, impact: 0, ...p.mcda },
  };
}

// Faithful copy of the OLD (pre-guard) tag logic — for the BEFORE column only.
function legacyTags(v: CareerVector, c: ConstructProfile, g: ReadinessGates, max = 3): SupportTagKey[] {
  const riskLow = g.risk === 'none' || g.risk === 'timeOnly';
  const runwayLow = g.runway === 'critical' || g.runway === 'tight' || g.runway === 'unknown';
  const cands: { key: SupportTagKey; on: boolean; s: number }[] = [
    { key: 'recognitionSensitive', on: v.impactOrientation >= 60 || c.mcda.impact >= 66, s: Math.max(v.impactOrientation, c.mcda.impact) },
    { key: 'independenceLeaning', on: v.autonomy >= 60 || c.mcda.autonomy >= 66, s: Math.max(v.autonomy, c.mcda.autonomy) },
    { key: 'marketOriented', on: v.marketOrientation >= 55 && v.analysisOrientation >= 55, s: Math.round((v.marketOrientation + v.analysisOrientation) / 2) },
    { key: 'creativeExpressive', on: v.creativity >= 55, s: v.creativity },
    { key: 'riskAverse', on: v.riskTolerance <= 30 || riskLow || c.mcda.financialSafety >= 66, s: Math.max(100 - v.riskTolerance, c.mcda.financialSafety, riskLow ? 70 : 0) },
    { key: 'externalConstraint', on: c.scct.contextualBarrier >= 66 || runwayLow, s: Math.max(c.scct.contextualBarrier, runwayLow ? 70 : 0) },
    { key: 'lowSelfTrust', on: c.scct.selfEfficacy <= 33 || c.adaptability.confidence <= 33, s: 100 - Math.min(c.scct.selfEfficacy, c.adaptability.confidence) },
    { key: 'selfInsightGap', on: c.difficulty.selfInformationGap >= 50, s: c.difficulty.selfInformationGap },
    { key: 'marketInsightGap', on: c.difficulty.marketInformationGap >= 50, s: c.difficulty.marketInformationGap },
    { key: 'highDrive', on: v.executionDrive >= 60 && (g.energy === 'capacity' || g.energy === 'high') && c.adaptability.control >= 60, s: Math.round((v.executionDrive + c.adaptability.control) / 2) },
  ];
  const order = cands.map((t) => t.key);
  return cands.filter((t) => t.on).sort((a, b) => b.s - a.s || order.indexOf(a.key) - order.indexOf(b.key)).slice(0, max).map((t) => t.key);
}

const label = (keys: SupportTagKey[]) => keys.map((k) => '#' + SUPPORT_TAG_LABELS[k]).join(' ') || '(없음)';

interface Scenario { name: string; v: CareerVector; g: ReadinessGates; c: ConstructProfile; m: MeasuredSignals; }

const SCENARIOS: Scenario[] = [
  {
    name: '① 정체된 성실형 + 인정 민감 (자기효능감만 측정, 리스크·자신감 미응답)',
    v: vec({ expertise: 75, impactOrientation: 62 }),
    g: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
    c: cp({ scct: { selfEfficacy: 75, goalClarity: 20 }, mcda: { impact: 70 }, difficulty: { selfInformationGap: 55 } }),
    m: { selfEfficacy: true, confidence: false },
  },
  {
    name: '② 탐색 과잉형 + 독립 지향 (리스크·자기효능감·자신감 미응답)',
    v: vec({ autonomy: 68 }),
    g: { energy: 'capacity', runway: 'comfortable', risk: 'experiment', marketValidation: 'partial' },
    c: cp({ difficulty: { optionOverload: 80, marketInformationGap: 55 }, adaptability: { curiosity: 72 }, scct: { goalClarity: 20 } }),
    m: { selfEfficacy: false, confidence: false },
  },
  {
    name: '③ 과부하 소진형 + 외부 제약 (리스크·자신감 명시적 측정 → 음성 태그 정당)',
    v: vec({ recoveryNeed: 85 }),
    g: { energy: 'depleted', runway: 'tight', risk: 'none', marketValidation: 'unvalidated' },
    c: cp({ difficulty: { readinessGap: 80 }, scct: { contextualBarrier: 70, selfEfficacy: 12 }, adaptability: { confidence: 10 } }),
    m: { selfEfficacy: true, confidence: true },
  },
  {
    name: '④ creator-heavy but low-validation (리스크·자신감 미응답)',
    v: vec({ creativity: 75, impactOrientation: 60 }),
    g: { energy: 'steady', runway: 'comfortable', risk: 'experiment', marketValidation: 'unvalidated' },
    c: cp({ difficulty: { marketInformationGap: 70 }, scct: { goalClarity: 40 } }),
    m: { selfEfficacy: false, confidence: false },
  },
  {
    name: '⑤ stable-but-bored (리스크·자기효능감·자신감 미응답)',
    v: vec({ stability: 68, creativity: 56, impactOrientation: 48 }),
    g: { energy: 'steady', runway: 'comfortable', risk: 'smallCost', marketValidation: 'partial' },
    c: cp({ scct: { goalClarity: 25 } }),
    m: { selfEfficacy: false, confidence: false },
  },
];

for (const s of SCENARIOS) {
  const spine = buildResultSpine(s.v, s.g, { constructProfile: s.c, inputCompleteness: 1, measured: s.m });
  const before = legacyTags(s.v, s.c, s.g);
  const after = spine.solutionLayer.supportTags;
  const removed = before.filter((t) => !after.includes(t));

  console.log('\n================================================================');
  console.log('시나리오:', s.name);
  console.log('  메인 타입:', spine.solutionLayer.mainTypeLabel, '| 핵심 모듈:', spine.solutionLayer.primaryModule.title);
  console.log('  [BEFORE 구 로직(0=낮음)]   서포트 태그:', label(before));
  console.log('  [AFTER  측정 가드]         서포트 태그:', label(after));
  console.log('  → 제거된 허위 음성 태그:', removed.length ? label(removed) : '(없음)');
}

console.log('\n────────────────────────────────────────────────────────────────');
console.log('요약: ①②④⑤는 미측정(0) 기반의 #안전판 선호·#작은 성공 필요 허위 태그가 제거됨.');
console.log('      ③은 리스크 게이트(none)·자신감을 실제로 측정 → 음성 태그가 정당하게 유지됨.');
