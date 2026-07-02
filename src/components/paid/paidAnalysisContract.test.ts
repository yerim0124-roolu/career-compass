// paidAnalysisContract.test.ts — 실행: node --experimental-strip-types <file>
// 목적:
//  (1) 서버 인라인(api/paid-analysis.ts)과 shared 계약(paidAnalysisContract.ts)의
//      normalize/validate 동등성(드리프트 방지).
//  (2) Case A(short dummy) / Case B(long 수의사) 픽스처가 normalize+validate 통과,
//      sanitize가 경력 위반 표현을 제거하는지.

import assert from 'node:assert';
import * as shared from '../../shared/paidAnalysisContract.ts';
import * as server from '../../../api/paid-analysis.ts';

let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

// ── 픽스처: Claude가 낼 법한 다양한 형태 ──
const goodCanonical = {
  summaryCard: { coreNow: '지금은 정리 국면', biggestRisk: '수입 흔드는 실험', dontDo: '서두르지 않기', doThis: '작은 실험', judgeBy: '30일 뒤 에너지' },
  corePatterns: [1, 2, 3].map((i) => ({ title: 't' + i, body: '본문' + i })),
  blockers: [1, 2, 3].map((i) => ({ title: 't' + i, body: '본문' + i })),
  strengths: [1, 2, 3].map((i) => ({ title: 't' + i, body: '본문' + i })),
  risks: [1, 2].map((i) => ({ title: 't' + i, body: '본문' + i })),
  monthlyExperiments: [1, 2, 3].map((i) => ({ title: 't' + i, body: '본문' + i })),
  sevenDayPlan: [1, 2, 3, 4, 5, 6, 7].map((i) => 'day' + i),
  recheckCriteria: ['c1', 'c2', 'c3'],
  finalMessage: '마무리',
};
// alias/누락/문자열-아이템이 섞인 지저분한 출력.
const messy = {
  summary: { core: '핵심', risk: '리스크', do: '이번 달', judge: '기준' }, // dontDo 없음(3/5 이상)
  patterns: ['패턴 문장 하나만', { heading: '두번째', description: '설명' }], // 2개(부족)
  blockers: [{ title: 'b', bullets: ['불릿1', '불릿2'] }],
  strengths: [{ title: 's', body: '강점' }],
  experiments: [{ title: 'e', body: '실험' }],
  judgeCriteria: { checks: ['체크1', '체크2', '체크3'] },
  closingMessage: '닫는 말',
};
const oldSchema = { // 구스키마(sections/judgeCriteria)
  summaryCard: goodCanonical.summaryCard,
  sections: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ title: 's' + i, body: 'sec' + i })),
  judgeCriteria: { intro: 'i', checks: ['x', 'y', 'z'], ifYes: 'y', ifNo: 'n' },
};
const fixtures: unknown[] = [goodCanonical, messy, oldSchema, {}, null, 'garbage', { summaryCard: {} }];

// (1) 드리프트: 서버 == 계약
for (const f of fixtures) {
  const a = JSON.stringify(server.normalizePaidResult(f));
  const b = JSON.stringify(shared.normalizePaidResult(f));
  ok('normalize 동등: ' + JSON.stringify(f).slice(0, 40), a === b);
  const ea = server.validationErrors(server.normalizePaidResult(f)).join(',');
  const eb = shared.getValidationErrors(shared.normalizePaidResult(f)).join(',');
  ok('validate 동등: ' + JSON.stringify(f).slice(0, 40), ea === eb);
}

// goodCanonical은 normalize 후 유효해야
ok('goodCanonical normalize→valid', shared.validatePaidAnalysisResult(shared.normalizePaidResult(goodCanonical)));
// 전체 alias 필드도 정규화되어 유효해야(필드명이 달라도 흡수)
const aliasFull = {
  summary: { core: '핵', risk: '리', avoid: '피', do: '해', judge: '판' },
  patterns: [1, 2, 3].map((i) => ({ heading: 'h' + i, description: 'd' + i })),
  obstacles: [1, 2, 3].map((i) => ({ title: 'o' + i, text: 't' + i })),
  assets: [1, 2, 3].map((i) => ({ title: 'a' + i, body: 'b' + i })),
  realRisks: [1, 2].map((i) => ({ title: 'r' + i, body: 'b' + i })),
  experiments: [1, 2, 3].map((i) => ({ title: 'e' + i, body: 'b' + i })),
  weekPlan: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ day: i, task: '할 일' + i })),
  checks: ['c1', 'c2', 'c3'],
  closingMessage: '닫는 말',
};
ok('aliasFull normalize→valid', shared.validatePaidAnalysisResult(shared.normalizePaidResult(aliasFull)));
// oldSchema(sections만)는 blockers/strengths 등 소스가 없어 불완전 → 핸들러에서 fallback 대상
ok('oldSchema(sections)만이면 invalid(→fallback)', !shared.validatePaidAnalysisResult(shared.normalizePaidResult(oldSchema)));

// ── Case A: short dummy — fallback은 항상 유효 ──
const freeA = { occupation: 'ㅇㅇ', experienceLevel: '', currentOccupationRange: '', ageBand: '', mainType: '', primarySubtype: '', secondarySubtype: '', subtypeConfidence: 0, pullDirection: '', primaryFriction: '', readinessLevel: '', userFreeText: 'ㅇㅇ' };
const paidA = { workStatus: '', maritalStatus: '', dependents: '', trigger: 'ㅇㅇ', candidateDirection: '', runway: '', incomeFloor: '', weeklyTime: '', energyLevel: '', flowMoment: 'ㅇㅇ', mustKeep: [] as string[] };
const fbA = server.buildFallbackResult(freeA, paidA);
ok('Case A fallback valid', shared.validatePaidAnalysisResult(fbA));

// ── Case B: long 수의사 (total 7-12 / current 1-3) ──
const freeB = { occupation: '수의사', experienceLevel: 'total_7_12', currentOccupationRange: 'current_1_3', ageBand: '30_late', mainType: 'conflictedAtFork', primarySubtype: 'careerCapitalContinuity', secondarySubtype: 'identityTransition', subtypeConfidence: 2, pullDirection: 'contentBrand', primaryFriction: 'career_capital_loss', readinessLevel: 'tiny_test', userFreeText: '이대로 계속 임상만 해도 될지 오래 고민했어요'.repeat(20) };
const paidB = { workStatus: '회사원(정규직)', maritalStatus: '기혼', dependents: '자녀', trigger: '나만 제자리인 것 같아요'.repeat(30), candidateDirection: '다른 직무로 전환 (하는 일 자체를 바꾸기)', runway: '3~6개월', incomeFloor: '350~500만 원', weeklyTime: '3~5시간', energyLevel: '좀 지쳐 있음', flowMoment: '누군가에게 뭔가 가르쳐줄 때'.repeat(10), mustKeep: ['안정성', '가족과의 시간'] };
const factsB = server.buildProfileFacts(freeB);
ok('Case B transition 판정', factsB.transition === true);
const fbB = server.buildFallbackResult(freeB, paidB);
ok('Case B fallback valid', shared.validatePaidAnalysisResult(fbB));
ok('Case B fallback 경력 위반 없음', server.factViolations(fbB, '수의사', factsB.currentUpper, factsB.bannedPhrases).length === 0);

// sanitize: 위반이 있는 결과를 넣으면 위반이 제거되어야
const violating = shared.normalizePaidResult({
  ...goodCanonical,
  corePatterns: [
    { title: 'a', body: '수의사로 7~12년을 쌓아온 사람으로서' },
    { title: 'b', body: '수의사 10년 안팎이면 임상 루틴의 천장이 보여요' },
    { title: 'c', body: '수의사 경력을 접는 것도 방법' },
  ],
});
ok('sanitize 전 위반 있음', server.factViolations(violating, '수의사', factsB.currentUpper, factsB.bannedPhrases).length > 0);
const sanitized = server.sanitizeCareerPhrasing(violating, '수의사', factsB.currentUpper, factsB.bannedPhrases);
ok('sanitize 후 위반 제거', server.factViolations(sanitized, '수의사', factsB.currentUpper, factsB.bannedPhrases).length === 0);
ok('sanitize 후에도 스키마 유효', shared.validatePaidAnalysisResult(sanitized));

// ── rawContentReport 드리프트(서버==계약) + 의미 ──
for (const f of fixtures) {
  ok('rawContentReport 동등: ' + JSON.stringify(f).slice(0, 30),
    JSON.stringify(server.rawContentReport(f)) === JSON.stringify(shared.rawContentReport(f)));
}
ok('goodCanonical hasCore=true, defaultedSlots=0', (() => { const r = shared.rawContentReport(goodCanonical); return r.hasCore && r.defaultedSlots === 0; })());
ok('빈 객체 hasCore=false', !shared.rawContentReport({}).hasCore);
ok('부분 결과 defaultedSlots>0', shared.rawContentReport(messy).defaultedSlots > 0);

// ── 구조화 실험 normalize ──
const withExp = shared.normalizePaidResult({
  ...goodCanonical,
  monthlyExperiments: [1, 2, 3].map((i) => ({
    title: 'e' + i, body: 'b' + i, hypothesis: 'h' + i, target: 't' + i, action: 'a' + i, successMetric: 'm' + i, stopSignal: 's' + i, whyThisFits: 'w' + i,
  })),
});
ok('실험 구조화 필드 보존', withExp.monthlyExperiments.every((e) => !!e.target && !!e.action && !!e.successMetric && !!e.hypothesis));
// 실험이 문자열/부분필드로 와도 normalize (monthlyExperiments 없이 experiments alias만)
const { monthlyExperiments: _omitExp, ...goodNoExp } = goodCanonical;
void _omitExp;
const expLoose = shared.normalizePaidResult({ ...goodNoExp, experiments: ['콘텐츠 실험', { title: 'x', what: '무엇', who: '누구', success: '기준' }] });
ok('실험 alias/부분 normalize', expLoose.monthlyExperiments.length === 3 && expLoose.monthlyExperiments[1].action === '무엇');

// Case B fallback 실험도 구조화 필드 있음
ok('Case B fallback 실험 구조화', fbB.monthlyExperiments.every((e) => !!e.target && !!e.action && !!e.successMetric));

console.log(`✓ paidAnalysisContract: ${passed} checks passed`);
