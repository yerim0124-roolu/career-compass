// paidAnalysisContract.test.ts — 실행: node --experimental-strip-types <file>
// (1) 서버 인라인 vs shared 계약 normalize/validate/rawContentReport 동등성(드리프트 방지)
// (2) narrative 스키마 정규화(별칭/누락/문자열) + Case A/B fallback + sanitize + quality gate

import assert from 'node:assert';
import * as shared from '../../shared/paidAnalysisContract.ts';
import * as server from '../../../api/paid-analysis.ts';

let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

const S = (t: string, b: string) => ({ title: t, body: b });
const bodyN = (n: number) => '이 사용자는 반려동물 브랜드를 준비하며 병원 복귀와 창업 사이에서 흔들린다. 버틸 기간 3~6개월과 배우자와의 생활비 압박이 실험의 크기를 제한한다. '.repeat(6).slice(0, n);
const exp = () => ({ title: 'e', body: bodyN(200), hypothesis: '돈을 낼 사람이 있는가', target: '반려동물 보호자', action: '소액 결제 제안', successMetric: 'DM·소액 결제·상담 요청 수', stopSignal: '무반응이면 가설 버림', whyThisFits: '수입 공백·버틸 기간 반영' });

const goodCanonical = {
  summaryCard: { coreNow: '핵심', biggestRisk: '리스크', dontDo: '피', doThis: '해', judgeBy: '판' },
  currentPosition: S('지금 당신이 멈춰 선 곳', bodyN(600)),
  whyNow: S('왜 하필 지금 이 마음이 왔는지', bodyN(600)),
  innerConflict: S('두 마음의 줄다리기', bodyN(700)),
  riskMap: S('현실 리스크 지도', bodyN(700)),
  transitionAssets: S('당신이 이미 가진 전환 자산', bodyN(600)),
  monthlyExperiment: { title: '이번 달의 30일 실험', body: bodyN(800), experiments: [exp(), exp()] },
  futureMessage: S('한 달 뒤의 당신에게', bodyN(500)),
  sevenDayPlan: [1, 2, 3, 4, 5, 6, 7].map((i) => '검증 루프 ' + i + '일차 ' + bodyN(60)),
  recheckCriteria: ['c1', 'c2', 'c3'],
  ifTwoOrMoreYes: '키워보세요', ifAllNo: '대상을 바꾸세요',
};
// 별칭/누락/문자열 섞인 지저분한 출력
const messy = {
  summary: { core: '핵심', risk: '리', do: '해', judge: '판' },
  narrativeSections: {
    currentState: '지금 상태 문장',
    why: { body: '왜 지금' },
    conflict: { paragraphs: ['한 문장', '두 문장'] },
  },
  assets: { body: '자산' },
  experiment: { body: '실험 개요', experiments: ['콘텐츠 실험', { title: 'x', what: '무엇', who: '누구', success: '기준' }] },
  weekPlan: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  checks: ['c1', 'c2', 'c3'],
  closing: { body: '닫는 말' },
};
const fixtures: unknown[] = [goodCanonical, messy, {}, null, 'garbage', { summaryCard: {} }];

// (1) 드리프트: 서버 == 계약
for (const f of fixtures) {
  ok('normalize 동등: ' + JSON.stringify(f).slice(0, 30), JSON.stringify(server.normalizePaidResult(f)) === JSON.stringify(shared.normalizePaidResult(f)));
  ok('validate 동등: ' + JSON.stringify(f).slice(0, 30), server.validationErrors(server.normalizePaidResult(f)).join(',') === shared.getValidationErrors(shared.normalizePaidResult(f)).join(','));
  ok('rawContentReport 동등: ' + JSON.stringify(f).slice(0, 30), JSON.stringify(server.rawContentReport(f)) === JSON.stringify(shared.rawContentReport(f)));
}

// good은 normalize 후 유효
ok('goodCanonical normalize→valid', shared.validatePaidAnalysisResult(shared.normalizePaidResult(goodCanonical)));
ok('goodCanonical hasCore & defaultedSlots 0', (() => { const r = shared.rawContentReport(goodCanonical); return r.hasCore && r.defaultedSlots === 0; })());
// messy: 별칭으로 일부 채워지지만 riskMap/transitionAssets/실험 부족 → 일부 default. 그래도 normalize는 구조 보장.
const messyNorm = shared.normalizePaidResult(messy);
ok('messy 별칭 매핑(currentPosition body)', messyNorm.currentPosition.body === '지금 상태 문장');
ok('messy 실험 alias/부분 normalize(action)', messyNorm.monthlyExperiment.experiments[1].action === '무엇');
ok('빈 객체 hasCore=false', !shared.rawContentReport({}).hasCore);

// (2) Case A: short dummy — fallback 항상 유효
const freeA = { occupation: 'ㅇㅇ', experienceLevel: '', currentOccupationRange: '', ageBand: '', mainType: '', primarySubtype: '', secondarySubtype: '', subtypeConfidence: 0, pullDirection: '', primaryFriction: '', readinessLevel: '', userFreeText: 'ㅇㅇ' };
const paidA = { workStatus: '', maritalStatus: '', dependents: '', trigger: 'ㅇㅇ', candidateDirection: '', runway: '', incomeFloor: '', weeklyTime: '', energyLevel: '', flowMoment: 'ㅇㅇ', mustKeep: [] as string[] };
ok('Case A fallback valid', shared.validatePaidAnalysisResult(server.buildFallbackResult(freeA, paidA)));

// Case B: long 수의사 (total 7-12 / current 1-3)
const freeB = { occupation: '수의사', experienceLevel: 'total_7_12', currentOccupationRange: 'current_1_3', ageBand: '30_late', mainType: 'conflictedAtFork', primarySubtype: 'careerCapitalContinuity', secondarySubtype: 'identityTransition', subtypeConfidence: 2, pullDirection: 'contentBrand', primaryFriction: 'career_capital_loss', readinessLevel: 'tiny_test', userFreeText: '반려동물 브랜드를 만들고 싶은데 병원에 다시 취직해야 하나 고민이에요. 배우자랑 생활비가 빠듯해요.' };
const paidB = { workStatus: '지금은 쉬는 중·구직 중', maritalStatus: '기혼', dependents: '배우자', trigger: '브랜드 준비하다 수입이 끊겨서 버틸 수 있을지 불안해요', candidateDirection: '내 사업 시작 (창업·개원·가게 등)', runway: '3~6개월', incomeFloor: '200~350만 원', weeklyTime: '6~10시간', energyLevel: '좀 지쳐 있음', flowMoment: '브랜드 스토리랑 제품 기획할 때', mustKeep: ['안정성', '가족과의 시간'] };
const factsB = server.buildProfileFacts(freeB);
ok('Case B transition 판정', factsB.transition === true);
const fbB = server.buildFallbackResult(freeB, paidB);
ok('Case B fallback valid', shared.validatePaidAnalysisResult(fbB));
ok('Case B fallback 경력 위반 없음', server.factViolations(fbB, '수의사', factsB.currentUpper, factsB.bannedPhrases).length === 0);

// sanitize: 위반 표현이 narrative 본문에 있으면 제거되고 스키마 유지
const violating = shared.normalizePaidResult({
  ...goodCanonical,
  currentPosition: S('t', '수의사로 7~12년을 쌓아온 사람으로서 임상 루틴의 천장이 보여요. 수의사 10년 안팎이면 수의사 경력을 접는 것도 방법이에요.'),
});
ok('sanitize 전 위반 있음', server.factViolations(violating, '수의사', factsB.currentUpper, factsB.bannedPhrases).length > 0);
const sanitized = server.sanitizeCareerPhrasing(violating, '수의사', factsB.currentUpper, factsB.bannedPhrases);
ok('sanitize 후 위반 제거', server.factViolations(sanitized, '수의사', factsB.currentUpper, factsB.bannedPhrases).length === 0);
ok('sanitize 후 스키마 유효', shared.validatePaidAnalysisResult(sanitized));

// quality gate: fallback은 경고(→content-repair), golden-like는 무경고
const ev = server.buildUserEvidencePack(freeB, paidB);
ok('fallback quality 경고 있음', server.qualityWarnings(fbB, ev, 'primary_normalized').length > 0);
ok('golden-like 무경고', server.qualityWarnings(goodCanonical, ev, 'primary_normalized').length === 0);

// 엄격 paid-ready 게이트: golden-like는 통과(blocker 0), fallback/partial/빈배열/경고는 차단.
ok('paid-ready: golden-like blocker 0', server.paidReadyBlockers(goodCanonical, 'primary_normalized', []).length === 0);
ok('paid-ready: fallback 차단', server.paidReadyBlockers(fbB, 'full_fallback_used', server.qualityWarnings(fbB, ev, 'full_fallback_used')).length > 0);
ok('paid-ready: partial_fallback_sections 차단', server.paidReadyBlockers(goodCanonical, 'partial_fallback_sections', []).some((b: string) => b.includes('partial_fallback_sections')));
ok('paid-ready: default_narrative_bodies 경고 차단', server.paidReadyBlockers(goodCanonical, 'primary_normalized', ['default_narrative_bodies']).some((b: string) => b.includes('default_narrative_bodies')));
ok('paid-ready: 빈 계획/재점검 차단', (() => { const b = server.paidReadyBlockers({ ...goodCanonical, sevenDayPlan: [], recheckCriteria: [] } as unknown as Parameters<typeof server.paidReadyBlockers>[0], 'primary_normalized', []); return b.includes('empty_seven_day') && b.includes('empty_recheck'); })());
ok('paid-ready: fallback 서명 문구 차단', server.paidReadyBlockers({ ...goodCanonical, monthlyExperiment: { ...goodCanonical.monthlyExperiment, body: '이번 달의 목표는 방향을 확정하는 것이 아니라 확인' } } as unknown as Parameters<typeof server.paidReadyBlockers>[0], 'primary_normalized', []).includes('fallback_signature'));

// tagged-text 파서: 전체 태그 → normalize → valid; 부분(핵심 3개)만 있어도 usable
const fullTagged = `쓸데없는 서두\n<summaryCard>\ncoreNow: 핵심\nbiggestRisk: 리스크\ndoThis: 해\njudgeBy: 판\n</summaryCard>\n<currentPosition>${bodyN(600)}</currentPosition>\n<whyNow>${bodyN(600)}</whyNow>\n<innerConflict>${bodyN(700)}</innerConflict>\n<riskMap>${bodyN(700)}</riskMap>\n<transitionAssets>${bodyN(600)}</transitionAssets>\n<monthlyExperiment>${bodyN(800)}</monthlyExperiment>\n<experiment_1>\ntitle: 실험1\nhypothesis: 돈 낼 사람 있나\ntarget: 반려동물 보호자\naction: 소액 결제 제안\nsuccessMetric: DM·소액 결제 수\nstopSignal: 무반응이면 버림\nwhyThisFits: 수입 공백 반영\n</experiment_1>\n<experiment_2>\ntitle: 실험2\nhypothesis: h\ntarget: t\naction: a\nsuccessMetric: DM 수\nstopSignal: s\nwhyThisFits: w\n</experiment_2>\n<sevenDayPlan>\n1일차: 가설 정의\n2일차: 타깃 10명\n3일차: 제안 작성\n4일차: 공개\n5일차: 직접 검증\n6일차: 반응 분류\n7일차: 가설 취사\n</sevenDayPlan>\n<recheckCriteria>\n- 돈에 가까운 반응 있었나\n- 어떤 가설 버릴지 명확한가\n- 방향 좁혀졌나\n</recheckCriteria>\n<ifTwoOrMoreYes>그 경우에는 키워보세요</ifTwoOrMoreYes>\n<ifAllNo>그 경우에는 대상을 바꾸세요</ifAllNo>\n<futureMessage>${bodyN(500)}</futureMessage>`;
const tp = server.parseTaggedResult(fullTagged);
ok('tagged 전체 추출 7섹션', tp.sectionCount === 7 && tp.coreSectionCount === 4);
ok('tagged 실험 2개 파싱', (tp.obj.monthlyExperiment as { experiments: unknown[] }).experiments.length === 2);
ok('tagged normalize→valid', shared.validatePaidAnalysisResult(shared.normalizePaidResult(tp.obj)));
ok('tagged 실험 successMetric 파싱', (tp.obj.monthlyExperiment as { experiments: Array<{ successMetric?: string }> }).experiments[0].successMetric === 'DM·소액 결제 수');
// 부분(핵심 3개만) → usable 판정 근거
const partialTagged = `<currentPosition>${bodyN(600)}</currentPosition>\n<whyNow>${bodyN(600)}</whyNow>\n<innerConflict>${bodyN(600)}</innerConflict>`;
ok('부분 태그 coreSections=3(usable)', server.parseTaggedResult(partialTagged).coreSectionCount === 3);
// 한국어: fallback에 조사/중복 오류 없어야
const fbStr = JSON.stringify(server.buildFallbackResult(freeB, paidB));
ok('fallback 조사 오류 없음(1~3년로 없음)', !fbStr.includes('1~3년로'));
ok('fallback 중복 없음(총 경력 총 경력 없음)', !fbStr.includes('총 경력 총 경력') && !fbStr.includes('전체 경력은 총 경력'));
ok('fallback ifYes 라벨중복 없음', !server.buildFallbackResult(freeB, paidB).ifTwoOrMoreYes.startsWith('두 가지 이상'));

console.log(`✓ paidAnalysisContract: ${passed} checks passed`);
