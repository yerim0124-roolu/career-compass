// 복수 선택 문항 질문 본문 / 선택 제한 안내 분리 검증. 실행: node --experimental-strip-types <file>
//
// 대상: CAREER_QUESTION_FLOW의 multi_select 문항(ar_roles/cv_values) + 현재 라이브
// hybrid 라우트(HybridFlowView)가 렌더하는 프로필 채팅 multi_select 문항
// (chatFlow.ts PROFILE_CHAT_STEPS: pc_concernTags/pc_constraintTags/pc_desiredPaths).
// legacy #chat(GuidedChatView)·유료 문항(PaidQuestionsView)은 별도 화면이라 범위 밖.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CAREER_QUESTION_FLOW } from './careerQuestionFlow.ts';
import { PROFILE_CHAT_STEPS } from '../lib/chatFlow.ts';

let passed = 0, failed = 0;
const check = (name: string, cond: boolean) => { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } };

const LIMIT_PHRASE = /최대\s*\d+\s*개/;

// ── CAREER_QUESTION_FLOW: multi_select 문항 전수 ──
const multiSteps = CAREER_QUESTION_FLOW.filter((s) => s.inputType === 'multi_select');
check('CAREER_QUESTION_FLOW: multi_select 문항 2개(ar_roles, cv_values)',
  multiSteps.length === 2 && multiSteps.every((s) => ['ar_roles', 'cv_values'].includes(s.id)));
for (const s of multiSteps) {
  check(`[${s.id}] 질문 본문(assistantPrompt)에 "최대 N개" 없음`, !LIMIT_PHRASE.test(s.assistantPrompt));
}
check('ar_roles: maxSelect 값 불변(3)', CAREER_QUESTION_FLOW.find((s) => s.id === 'ar_roles')?.maxSelect === 3);
check('cv_values: maxSelect 값 불변(5)', CAREER_QUESTION_FLOW.find((s) => s.id === 'cv_values')?.maxSelect === 5);
check('cv_values: 옵션 ID·개수 불변(12개)', CAREER_QUESTION_FLOW.find((s) => s.id === 'cv_values')?.options?.length === 12);

// ── 프로필 채팅 multi_select 문항 전수(HybridFlowView가 렌더) ──
const profileMulti = PROFILE_CHAT_STEPS.filter((s) => s.phase === 'profile' && s.answerType === 'multi_select');
check('PROFILE_CHAT_STEPS: multi_select 문항 3개(concernTags/constraintTags/desiredPaths)',
  profileMulti.length === 3 && ['pc_concernTags', 'pc_constraintTags', 'pc_desiredPaths'].every((id) => profileMulti.some((s) => s.id === id)));
for (const s of profileMulti) {
  check(`[${s.id}] 질문 본문(message)에 "최대 N개" 없음`, !LIMIT_PHRASE.test(s.message));
}
check('pc_concernTags: maxSelect 값 불변(2)', profileMulti.find((s) => s.id === 'pc_concernTags')?.maxSelect === 2);
check('pc_constraintTags: maxSelect 값 불변(2) + noneExclusive 유지', (() => {
  const s = profileMulti.find((s) => s.id === 'pc_constraintTags');
  return s?.maxSelect === 2 && s?.noneExclusive === true;
})());
check('pc_desiredPaths: maxSelect 값 불변(2)', profileMulti.find((s) => s.id === 'pc_desiredPaths')?.maxSelect === 2);

// ── single_select 문항에는 "최대 N개" 안내 자체가 없음(원래도 필요 없었지만 회귀 방지) ──
const singleSteps = CAREER_QUESTION_FLOW.filter((s) => s.inputType === 'single_select');
check('single_select 문항 본문에 "최대 N개" 없음(전수)', singleSteps.every((s) => !LIMIT_PHRASE.test(s.assistantPrompt)));

// ═══════════════════════════════════════════════════════════════════════════
// 렌더러: maxSelect 기반 자동 생성(문항별 하드코딩 아님) + single_select 미노출
// ═══════════════════════════════════════════════════════════════════════════
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const qsrSrc = readFileSync(resolve(__dirname, '../components/careerCompassV2/QuestionStepRenderer.tsx'), 'utf-8');
const hybridSrc = readFileSync(resolve(__dirname, '../components/hybridV3/HybridFlowView.tsx'), 'utf-8');

check('QuestionStepRenderer: multi_select 안내가 step.maxSelect 템플릿에서 파생(하드코딩 아님)',
  /최대 \{step\.maxSelect\}개까지 선택 가능/.test(qsrSrc));
check('QuestionStepRenderer: 라이브 카운트가 제한 안내와 형식이 다름(중복 문구 아님)',
  /\$\{selectedIds\.length\}\/\$\{step\.maxSelect\} 선택/.test(qsrSrc));
{
  // single_select case 블록 안에는 "선택 가능" 안내가 없어야 한다(단일 선택엔 미노출).
  const singleStart = qsrSrc.indexOf("case 'single_select':");
  const singleEnd = qsrSrc.indexOf("case 'multi_select':");
  const singleBlock = qsrSrc.slice(singleStart, singleEnd);
  check('QuestionStepRenderer: single_select 블록에는 선택 제한 안내 없음', !/선택 가능/.test(singleBlock));
}
check('HybridFlowView(프로필 채팅): helperText가 max 기반 템플릿에서 파생(하드코딩 아님)',
  /`최대 \$\{max\}개까지 선택 가능`/.test(hybridSrc));
{
  // ProfileChatStepView의 single_select 분기(answerType === 'single_select')에는 helperText 안내가 없다.
  const singleStart = hybridSrc.indexOf("step.answerType === 'single_select'");
  const multiStart = hybridSrc.indexOf('multi_select (with optional cap');
  const singleBlock = hybridSrc.slice(singleStart, multiStart);
  check('HybridFlowView: 프로필 단일 선택 분기에는 선택 제한 안내 없음', !/helperText/.test(singleBlock));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
