// 표시 전용 테스트 — 유료 미리보기(PaidPreviewView) 카피 감사. 런타임 로직·결제·파이프라인은
// 건드리지 않으며, 소스 문자열만 정적으로 검증한다(hybridFlow.test.ts와 동일 접근).
// 실행: node --experimental-strip-types <file>

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, './PaidPreviewView.tsx'), 'utf-8');

// ── 어색한 표현 전면 제거(사용자 화면 문자열 기준) ──
const BANNED = [
  '마음의 정체', '심리의 정체', '줄다리기', '부를 이름', '또렷하지 않은', '왜 하필',
  '핵심 진단', '3갈래', '이번 달의 30일', '전체 받기', '당신은', '흔들리고 있어요',
  '구체적으로 짚어드릴게요', '리스크 지도', '두 마음', '1분 요약',
];
for (const p of BANNED) {
  check(`제거됨: "${p}"`, !src.includes(p));
}

// ── 상단 소개(단일 기본 문장) — 개인화 명사구 조합 미사용 ──
check('상단 소개: 기본 문장 노출', src.includes('아직 하나의 방향으로 연결되지 않았어요'));
check('상단 소개: 심층 분석 가치(원인·선택지·30일 실험) 설명', src.includes('결정을 막는 이유를 정리') && src.includes('30일 실험을 제안'));
check('상단 소개: 명사구 조합 템플릿(subtype 결합) 미사용', !/s%s.*사이에서|사이에서 흔들/.test(src) && !src.includes('subtypeToKorean'));

// ── 섹션 제목 ──
check('섹션 제목 = "심층 분석에서 확인할 내용"', src.includes('심층 분석에서 확인할 내용') && !src.includes('이런 리포트를 받아요'));

// ── 리포트 항목 7개 + 최종 문구 ──
for (const t of [
  '한눈에 보는 핵심 요약',
  '지금 이 고민이 생긴 이유',
  '서로 충돌하는 선택 기준',
  '돈·시간·가족 조건을 반영한 현실 점검',
  '전환에 활용할 수 있는 경험과 강점',
  '이번 달 실행할 30일 실험',
  '30일 후 계속할지 바꿀지 판단하는 기준',
]) {
  check(`리포트 항목: "${t}"`, src.includes(t));
}
check('리포트 항목: 보조 문구(핵심 요약)', src.includes('현재 고민 · 가장 큰 변수 · 이번 달 우선순위'));
check('리포트 항목: 보조 문구(선택 기준)', src.includes('무엇을 얻고 싶고, 무엇을 잃기 싫은지'));
check('리포트 항목: 정확히 7개 title', (src.match(/title: '/g) ?? []).length === 7);

// ── CTA + 보조 문구 ──
check('CTA = "결제하고 심층 분석 받기"', src.includes('결제하고 심층 분석 받기'));
check('CTA 보조: 부정확한 "12개" 하드코딩 없음(실제 유료 11문항)', !src.includes('12개'));
check('CTA 보조: 최종 문구(추가 질문 약 3분 · 개인화된 심층 리포트)', src.includes('추가 질문 약 3분 · 개인화된 심층 리포트'));

// ── 결제·유료 진입 흐름 불변 ──
check('결제 CTA → #paid-questions 진입 유지', src.includes("window.location.hash = '#paid-questions'"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
