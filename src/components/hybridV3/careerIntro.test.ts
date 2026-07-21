// 시작 안내 화면(CareerIntroView) — 표시 조건·문구·타이핑 계약·접근성·흐름 연결 검증.
// 실행: node --experimental-strip-types <file>
//
// 저장소 컨벤션(hybridFlow.test.ts와 동일): 순수 로직은 import로, React 렌더 계약은
// 소스 정적 검사(readFileSync + regex)로 검증한다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  shouldShowCareerIntro,
  INTRO_TITLE, INTRO_TITLE_CHARS, INTRO_BODY_1, INTRO_BODY_2, INTRO_BODY_3,
  INTRO_FINAL_NOTE, INTRO_CTA_LABEL,
  INTRO_BODY_1_EMPHASIS, INTRO_BODY_2_EMPHASIS, INTRO_BODY_3_EMPHASIS, INTRO_FINAL_NOTE_EMPHASIS,
  TYPE_START_DELAY_MS, TYPE_CHAR_INTERVAL_MS, REVEAL_DELAY_MS, REVEAL_FADE_MS,
  totalIntroAnimationMs,
} from './careerIntroGate.ts';
import { parsePersistedSession } from '../careerCompassV2/session.ts';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import { resolveRoute } from '../../lib/routing.ts';

let passed = 0, failed = 0;
const check = (name: string, cond: boolean) => { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } };

// ═══════════════════════════════════════════════════════════════════════════
// 표시 조건(§9) — 순수 게이트 + 실제 parsePersistedSession 통합
// ═══════════════════════════════════════════════════════════════════════════
check('신규 빈 세션 → 표시', shouldShowCareerIntro({ done: false, profileDone: false, responses: {}, profile: {} }) === true);
check('진행 중 무료 세션(profileDone) → 미표시', shouldShowCareerIntro({ done: false, profileDone: true, responses: {}, profile: {} }) === false);
check('진행 중 무료 세션(응답 존재) → 미표시', shouldShowCareerIntro({ done: false, profileDone: false, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: {} }) === false);
check('프로필 일부 입력 → 미표시', shouldShowCareerIntro({ done: false, profileDone: false, responses: {}, profile: { ageBand: '30_early' } }) === false);
check('완료 세션 → 미표시', shouldShowCareerIntro({ done: true, profileDone: true, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: {} }) === false);

// parsePersistedSession 통합 — 실제 복구 경로 그대로.
const gateFromRaw = (raw: string | null) => {
  const p = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
  return shouldShowCareerIntro({ done: p.done, profileDone: p.profileDone, responses: p.responses, profile: p.profile });
};
check('raw=null(첫 방문) → 표시', gateFromRaw(null) === true);
check('마운트 직후 저장된 빈 세션 → 표시(키 존재만으로 차단하지 않음)',
  gateFromRaw(JSON.stringify({ stepIndex: 0, responses: {}, profile: {}, done: false, profileDone: false })) === true);
check('완료 세션 JSON(답변 수정/결과 복구 경로) → 미표시',
  gateFromRaw(JSON.stringify({ stepIndex: 21, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: {}, done: true, profileDone: true })) === false);
check('메인 질문 진행 중 JSON → 미표시',
  gateFromRaw(JSON.stringify({ stepIndex: 3, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: {}, done: false, profileDone: true })) === false);
check('구버전 JSON(profileDone 없음 + 응답 존재) → 미표시(하위호환 휴리스틱 경유)',
  gateFromRaw(JSON.stringify({ stepIndex: 3, responses: { cs_main: { selectedOptionIds: ['cs_between'] } }, profile: {}, done: false })) === false);

// 유료 화면은 별도 라우트 — 안내 게이트를 아예 지나지 않는다.
check('유료 진입 라우트는 hybrid가 아님(#paid-preview/#paid-questions/#paid-result)',
  resolveRoute('#paid-preview') !== 'hybrid' && resolveRoute('#paid-questions') !== 'hybrid' && resolveRoute('#paid-result') !== 'hybrid');
check('유료 결과 복구(?paidJobId=)도 hybrid가 아님', resolveRoute('', '?paidJobId=abc') !== 'hybrid');

// ═══════════════════════════════════════════════════════════════════════════
// 문구(§2) — 스펙 그대로, 금지 문구 없음
// ═══════════════════════════════════════════════════════════════════════════
check('제목 문구 일치', INTRO_TITLE === '요즘, 이 길이 맞는지 자꾸 고민된다면');
check('CTA 문구 일치', INTRO_CTA_LABEL === '무료로 시작하기');
check('마지막 안내 문구 일치', INTRO_FINAL_NOTE === '좋아 보이는 답보다, 지금의 나와 가장 가까운 답을 골라주세요.');
check('본문1: 87.5% 포함(강조 분리 지점 1곳)', INTRO_BODY_1.split('87.5%').length === 2);
check('본문2: 논문·전문 서적 근거 문장 포함', INTRO_BODY_2.includes('논문과 전문 서적'));
check('본문3: 22개의 질문 + 무료/유료 흐름 안내 포함', INTRO_BODY_3.includes('22개의 질문') && INTRO_BODY_3.includes('유료 심층 분석'));

// ── 강조(bold) 구절: 각 문단에 정확히 1회 등장해야 렌더러가 안전하게 분리한다 ──
const EMPHASIS_CASES: Array<[string, string, readonly string[]]> = [
  ['본문1', INTRO_BODY_1, INTRO_BODY_1_EMPHASIS],
  ['본문2', INTRO_BODY_2, INTRO_BODY_2_EMPHASIS],
  ['본문3', INTRO_BODY_3, INTRO_BODY_3_EMPHASIS],
  ['마지막 안내', INTRO_FINAL_NOTE, INTRO_FINAL_NOTE_EMPHASIS],
];
for (const [label, text, phrases] of EMPHASIS_CASES) {
  check(`${label}: 강조 구절이 본문에 정확히 1회 등장`, phrases.every((p) => text.split(p).length === 2));
}
check('본문2 강조 = 논문·전문 서적 기반 설계 문장',
  INTRO_BODY_2_EMPHASIS[0] === '커리어 의사결정에 관한 논문과 전문 서적을 바탕으로 질문을 설계');
check('본문3 강조 = 무료 / 유료 심층 분석 2곳',
  INTRO_BODY_3_EMPHASIS.length === 2 && INTRO_BODY_3_EMPHASIS.includes('무료') && INTRO_BODY_3_EMPHASIS.includes('유료 심층 분석'));
check('강조 구절끼리 서로를 포함하지 않음(중첩 매칭 방지)', (() => {
  const all = [...INTRO_BODY_1_EMPHASIS, ...INTRO_BODY_2_EMPHASIS, ...INTRO_BODY_3_EMPHASIS, ...INTRO_FINAL_NOTE_EMPHASIS];
  return all.every((a) => all.filter((b) => b !== a).every((b) => !b.includes(a)));
})());
const ALL_COPY = [INTRO_TITLE, INTRO_BODY_1, INTRO_BODY_2, INTRO_BODY_3, INTRO_FINAL_NOTE, INTRO_CTA_LABEL].join(' ');
check('금지: 조건부 추가 질문 안내 없음', !ALL_COPY.includes('추가 확인 질문') && !ALL_COPY.includes('나타날 수 있'));
check('금지: 가격 없음', !ALL_COPY.includes('₩') && !ALL_COPY.includes('3,900') && !ALL_COPY.includes('원'));
check('금지: 예상 소요 시간 없음', !/약\s*\d+\s*분|\d+\s*분\s*(소요|정도)/.test(ALL_COPY));
check('금지: 진단 표현 없음', !ALL_COPY.includes('진단'));

// ═══════════════════════════════════════════════════════════════════════════
// 타이핑 계약(§3) — Unicode-safe·타이밍·2초 미만
// ═══════════════════════════════════════════════════════════════════════════
check('Unicode-safe: Array.from 기준 문자 배열이 제목과 일치',
  INTRO_TITLE_CHARS.join('') === INTRO_TITLE && INTRO_TITLE_CHARS.length === Array.from(INTRO_TITLE).length);
check('공백·쉼표 포함 순차 표시(prefix가 항상 원문 부분 문자열)',
  Array.from({ length: INTRO_TITLE_CHARS.length + 1 }, (_, i) => INTRO_TITLE_CHARS.slice(0, i).join(''))
    .every((prefix) => INTRO_TITLE.startsWith(prefix)));
check('타이밍 상수: 시작 200ms / 글자당 40ms / 완성 후 200ms',
  TYPE_START_DELAY_MS === 200 && TYPE_CHAR_INTERVAL_MS === 40 && REVEAL_DELAY_MS === 200);
check('fade-in 300~400ms', REVEAL_FADE_MS >= 300 && REVEAL_FADE_MS <= 400);
check('전체 연출 2초 미만', totalIntroAnimationMs() < 2000);

// ═══════════════════════════════════════════════════════════════════════════
// 렌더 계약 — CareerIntroView.tsx 소스 정적 검사(타이핑/건너뛰기/접근성/역할 경계)
// ═══════════════════════════════════════════════════════════════════════════
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const introSrc = readFileSync(resolve(__dirname, 'CareerIntroView.tsx'), 'utf-8');
const hybridSrc = readFileSync(resolve(__dirname, 'HybridFlowView.tsx'), 'utf-8');

check('타이핑이 INTRO_TITLE_CHARS(Array.from 산출물) 기반 — string[index] 직접 접근 없음',
  introSrc.includes('INTRO_TITLE_CHARS.slice(0, typedCount)') && !/INTRO_TITLE\[/.test(introSrc));
check('접근성: h1에 sr-only 전체 제목 + 타이핑 문자열 aria-hidden',
  /className="sr-only">\{INTRO_TITLE\}/.test(introSrc) && /aria-hidden="true"/.test(introSrc));
check('접근성: 글자별 aria-live 속성 미사용', !introSrc.includes('aria-live='));
check('접근성: prefers-reduced-motion 감지 + 즉시 표시 초기값',
  introSrc.includes("matchMedia?.('(prefers-reduced-motion: reduce)')")
  && introSrc.includes('useState(reducedMotion ? INTRO_TITLE_CHARS.length : 0)')
  && introSrc.includes('useState(reducedMotion)'));
check('CTA는 정상 <button type="button"> + disabled 제어', /<button\s+type="button"/.test(introSrc) && introSrc.includes('disabled={!revealed}'));
check('건너뛰기: Enter/Space 처리 + preventDefault', introSrc.includes("e.key === 'Enter'") && introSrc.includes("e.key === ' '") && introSrc.includes('e.preventDefault()'));
check('건너뛰기: 영역 클릭 시 완료 전만 finish', introSrc.includes('if (!revealed) finish()'));
check('건너뛰기가 질문 시작으로 이어지지 않음(onStart 호출은 handleStart 1곳뿐)',
  (introSrc.match(/onStart\(\)/g) ?? []).length === 1 && introSrc.includes('startedRef.current = true'));
check('타이머 정리: clearTimeout/clearInterval cleanup 존재',
  introSrc.includes('window.clearTimeout') && introSrc.includes('window.clearInterval'));
check('역할 경계: 세션/점수/외부 호출 없음(localStorage·fetch·buildResult 미사용)',
  !introSrc.includes('localStorage') && !introSrc.includes('fetch(') && !introSrc.includes('buildResult'));

// ═══════════════════════════════════════════════════════════════════════════
// 흐름 연결 — HybridFlowView 계약(기존 흐름 재사용, 복제 없음)
// ═══════════════════════════════════════════════════════════════════════════
check('HybridFlowView: 게이트를 loadHybridSession에서 사용', hybridSrc.includes('shouldShowCareerIntro({'));
check('HybridFlowView: phase=profile + showIntro일 때만 안내 렌더', hybridSrc.includes("phase === 'profile' && showIntro"));
check('HybridFlowView: CTA는 setShowIntro(false)만 — 기존 profile 렌더가 그대로 시작 화면',
  hybridSrc.includes('<CareerIntroView onStart={() => setShowIntro(false)} />'));
check('HybridFlowView: 안내가 세션 schema를 바꾸지 않음(PersistedSession 필드 추가 없음)',
  !hybridSrc.includes('showIntro:') || !/const session: PersistedSession = \{[^}]*showIntro/s.test(hybridSrc));
check('HybridFlowView: 기존 복구 로직(첫 미응답 문항 재개) 유지', hybridSrc.includes('firstUnanswered'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
