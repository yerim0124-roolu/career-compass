// Contract tests for the static result-depth content (유형 딥 서사 + 직무 소재 변형).
// Run: node --experimental-strip-types src/data/mainTypeNarratives.test.ts

import { MAIN_TYPE_NARRATIVES, selectTraps } from './mainTypeNarratives.ts';
import { getExperimentJobHint } from './jobRoleExperimentHints.ts';
import { MAIN_TYPE_LABELS } from '../types/careerCompass.ts';
import type { MainTypeKey } from '../types/careerCompass.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── 유형 딥 서사 ─────────────────────────────────────────────────────────────

const TYPE_KEYS = Object.keys(MAIN_TYPE_LABELS) as MainTypeKey[];

check('narratives: 9개 유형 전부 커버', TYPE_KEYS.every((k) => !!MAIN_TYPE_NARRATIVES[k]));

for (const k of TYPE_KEYS) {
  const n = MAIN_TYPE_NARRATIVES[k];
  check(`narratives[${k}]: 구조 완전 (thesis/arrival/traps 2~4/meaning, 빈 문자열 없음)`,
    n.thesis.length > 10 && n.arrival.length > 50
    && n.traps.length >= 2 && n.traps.length <= 4 && n.traps.every((t) => t.title.length > 0 && t.body.length > 30)
    && n.meaning.length > 30);
}
check('narratives: 기계어(→)·내부 용어 없음',
  TYPE_KEYS.every((k) => {
    const n = MAIN_TYPE_NARRATIVES[k];
    const all = [n.thesis, n.arrival, ...n.traps.map((t) => t.body), n.meaning].join(' ');
    return !all.includes('→') && !all.includes('mainType') && !/[a-zA-Z]{6,}/.test(all);
  }));
check('narratives: 진단성 표현 없음 (번아웃 톤 안전)',
  TYPE_KEYS.every((k) => {
    const n = MAIN_TYPE_NARRATIVES[k];
    const all = [n.thesis, n.arrival, ...n.traps.map((t) => t.body), n.meaning].join(' ');
    return !/우울증|진단|장애|환자(?!들)/.test(all);
  }));

// P3.10 — selectTraps: 신호 매칭 시 해당 함정 surfacing, 매칭 없으면 기본 앞 2개.
check('selectTraps: 매칭 없으면 기본 앞 2개', (() => {
  const n = MAIN_TYPE_NARRATIVES.plateauedPerformer;
  const got = selectTraps(n.traps, new Set());
  return got.length === 2 && got[0] === n.traps[0] && got[1] === n.traps[1];
})());
check('selectTraps: 신호 매칭 함정이 위로', (() => {
  const n = MAIN_TYPE_NARRATIVES.plateauedPerformer; // 함정3 when=['lowSelfTrust']
  const got = selectTraps(n.traps, new Set(['lowSelfTrust']));
  return got.length === 2 && got.some((t) => (t.when ?? []).includes('lowSelfTrust'));
})());

// ─── 직무 소재 변형 ───────────────────────────────────────────────────────────

check('hints: 수의사 × 콘텐츠 → 보호자 소재',
  (getExperimentJobHint({ jobRoleCategory: 'veterinarian' }, 'contentBrand') ?? '').includes('보호자'));
check('hints: 기획자 × 이직 → 케이스 소재',
  (getExperimentJobHint({ jobRoleCategory: 'product_planning' }, 'jobChange') ?? '').includes('케이스'));
check('hints: 백엔드 개발자도 개발 그룹으로 접힘',
  getExperimentJobHint({ jobRoleCategory: 'backend' }, 'contentBrand') !== null);
check('hints: 직무 미상 → null (일반론 덧붙이지 않음)',
  getExperimentJobHint({}, 'contentBrand') === null
  && getExperimentJobHint({ jobRoleCategory: 'other' }, 'contentBrand') === null);
check('hints: 옵션 미매칭 → null', getExperimentJobHint({ jobRoleCategory: 'marketing' }, 'restRecover') === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
