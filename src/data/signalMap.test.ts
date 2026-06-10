// signalMap.test.ts — 실행: node --experimental-strip-types src/data/signalMap.test.ts
// 검증: 3비트 해석형 signals의 데이터 커버리지 —
//   ① intentByMainType: 모든 mainType, ② conditionBySubtype: 모든 subtype(템플릿 기준),
//   ③ responseByFriction: 모든 FrictionSource. + 톤(비어있지 않음·마침표 종결).

import assert from 'node:assert';
import { intentByMainType, conditionBySubtype, responseByReadiness } from './signalMap.ts';
import { narrativeTemplates, type ReadinessLevel } from './narrativeTemplates.ts';

let passed = 0;
const ok = (c: boolean, m: string) => { assert.ok(c, m); passed++; };

// ① 모든 mainType에 의지 비트
for (const mt of Object.keys(narrativeTemplates)) {
  ok(typeof intentByMainType[mt] === 'string' && intentByMainType[mt].length > 0, `intentByMainType '${mt}' 누락`);
  ok(intentByMainType[mt].endsWith('고,'), `intent '${mt}' 는 "…고," 로 끝나야 (${intentByMainType[mt]})`);
}

// ② 모든 subtype에 조건 비트 (템플릿의 실제 subtype 키 전수)
for (const mt of Object.keys(narrativeTemplates)) {
  for (const sub of Object.keys(narrativeTemplates[mt].subtypes)) {
    ok(typeof conditionBySubtype[sub] === 'string' && conditionBySubtype[sub].length > 0, `conditionBySubtype '${sub}' (${mt}) 누락`);
    ok(conditionBySubtype[sub].startsWith('다만'), `condition '${sub}' 는 "다만…" 으로 시작해야`);
  }
}

// ③ 모든 readinessLevel에 제안 비트
const levels: ReadinessLevel[] = ['pause', 'reflect_only', 'tiny_test', 'structured_test', 'commitment_test'];
for (const r of levels) {
  ok(typeof responseByReadiness[r] === 'string' && responseByReadiness[r].length > 0, `responseByReadiness '${r}' 누락`);
  ok(responseByReadiness[r].includes('그래서'), `response '${r}' 는 "그래서" 연결 포함`);
}

// 톤: 모든 줄 마침표 종결(intent는 쉼표 종결이므로 제외)
for (const [k, v] of Object.entries(conditionBySubtype)) ok(v.endsWith('.') || v.endsWith('다.'), `condition['${k}'] 마침표 종결 아님`);
for (const [k, v] of Object.entries(responseByReadiness)) ok(v.endsWith('.') || v.endsWith('다.'), `response['${k}'] 마침표 종결 아님`);

console.log(`✓ signalMap: ${passed} checks passed`);
