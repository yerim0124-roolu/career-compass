// 표시 전용 테스트 — 무료 결과 패턴 티저 카피 전수 감사. patternTeaserCopy.ts 데이터 +
// PatternTeaserView의 confidence 사용 방식만 검증한다(엔진·점수·유료 무관).
// 실행: node --experimental-strip-types <file>

import { PATTERN_COPY, CATEGORY_COPY, INSUFFICIENT_COPY, SIGNAL_TAG_LABELS } from './patternTeaserCopy.ts';
import { PATTERN_LABELS, CATEGORY_LABELS } from '../../lib/biasPatternEngine.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const patternIds = Object.keys(PATTERN_LABELS) as (keyof typeof PATTERN_COPY)[];

// ── 모든 패턴이 confidence(완성 문장) 보유 + 확정 진단 어투 금지 ──
check('모든 패턴에 confidence 문장 존재(16)', patternIds.length === 16 && patternIds.every((id) => typeof PATTERN_COPY[id].confidence === 'string' && PATTERN_COPY[id].confidence.length > 0));
check('confidence: "○○ 마음" 인공적 조합/중첩 따옴표 없음', patternIds.every((id) => !/‘[^’]*’\s*(경향이 가장 강하게|쪽에 가까워)/.test(PATTERN_COPY[id].confidence)));
check('confidence: 확정 진단 어투 아님(경향이/모습이/신호가 나타났어요)', patternIds.every((id) => /(경향이|모습이|신호가) (함께 )?나타났어요\.$/.test(PATTERN_COPY[id].confidence)));

// ── 어색한 표현 전면 제거(패턴/범주/부족 카피 전체) ──
const BANNED = ['누르고 있', '눌린', '바깥 기준', '판단에 먼저 들어', '판단에 들어', '가벼워지', '무게가 실', '흐름이 보여', '마음의 정체'];
const allCopy = [
  ...patternIds.flatMap((id) => { const c = PATTERN_COPY[id]; return [c.inverted, c.confidence, c.statePara, c.mechanismPara, c.question]; }),
  ...Object.values(CATEGORY_COPY).flatMap((c) => [c.inverted, c.statePara, c.mechanismPara, c.question]),
  INSUFFICIENT_COPY.inverted, INSUFFICIENT_COPY.statePara, INSUFFICIENT_COPY.mechanismPara, INSUFFICIENT_COPY.question,
].join(' || ');
for (const b of BANNED) {
  check(`제거됨(전체 카피): "${b}"`, !allCopy.includes(b));
}

// ── 당위적 사고(tyrannyOfShoulds) 최종본 ──
{
  const t = PATTERN_COPY.tyrannyOfShoulds;
  check('당위적 사고 헤드라인', t.inverted === '내가 원하는 것보다, ‘해야 한다’는 기준이 결정을 이끌고 있어요.');
  check('당위적 사고 confidence', t.confidence === '현재 답변에서는 내 기준보다 주변의 기대를 먼저 고려하는 경향이 나타났어요.');
  check('당위적 사고 상태 문단', t.statePara.startsWith('무엇을 원하는지보다, 어떤 선택을 해야 인정받고 안전할지를 먼저 생각하고 있어요'));
  check('당위적 사고 메커니즘 문단', t.mechanismPara.includes('그 선택을 오래 유지할 수 있는지는 별개의 문제') && t.mechanismPara.includes('주변의 기대를 받아들인 것인지 더 살펴봐야'));
  check('당위적 사고 질문', t.question === '지금 따르는 기준은 내가 선택한 것일까요, 주변의 기대를 받아들인 것일까요?');
}

// ── 직접 신호 태그: 주변의 시선과 기대를 먼저 고려함 ──
check('blk_eyes 신호 태그 최종본', SIGNAL_TAG_LABELS['blocker:blk_eyes'] === '주변의 시선과 기대를 먼저 고려함');

// ── category identityConfusion에서 "바깥 기준" 제거 ──
check('category identityConfusion: "바깥 기준" 제거', !CATEGORY_COPY.identityConfusion.statePara.includes('바깥 기준'));

// ── PatternTeaserView가 라벨 조합 대신 confidence 문장을 사용 ──
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const viewSrc = readFileSync(resolve(__dirname, './PatternTeaserView.tsx'), 'utf-8');
  check('PatternTeaserView: nameLine에 c.confidence 사용', /nameLine:\s*c\.confidence/.test(viewSrc));
  check('PatternTeaserView: PATTERN_LABELS 조합 템플릿 미사용', !/PATTERN_LABELS\[p\.primaryPattern\]/.test(viewSrc) && !/경향이 가장 강하게 나타났어요/.test(viewSrc) && !/쪽에 가까워 보여요/.test(viewSrc));
  // 범주 confidence 라인은 범주명(정상)만 인용 — 유지 확인
  check('PatternTeaserView: category nameLine은 범주명 인용 유지', viewSrc.includes('범주의 고민이 비교적 크게 나타났어요'));
}

// CATEGORY_LABELS 존재(범주 confidence 라인용) — 회귀 가드
check('CATEGORY_LABELS 4범주 존재', Object.keys(CATEGORY_LABELS).length === 4);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
