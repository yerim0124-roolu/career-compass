// careerIntroGate — 시작 안내 화면(CareerIntroView)의 표시 조건 + 최종 문구 + 애니메이션 타이밍
// (순수 데이터/함수, React 없음 — 헤드리스 테스트 대상).
//
// 표시 조건 설계 근거: HybridFlowView의 persist effect는 마운트 직후에도 빈 세션을 localStorage에
// 기록하므로 'localStorage 키 존재 여부'로는 신규 사용자를 판별할 수 없다. 대신 파싱된 세션의
// '내용 비어 있음'(완료 아님 + 프로필 미완 + 응답 0 + 프로필 필드 0)으로 판별한다.
// 세션 schema·질문 index는 변경하지 않는다(표시 전용 게이트).

import type { UserProfile } from '../../types/careerCompass.ts';
import type { FlowResponses } from '../careerCompassV2/session.ts';

export interface CareerIntroGateInput {
  done: boolean;
  profileDone: boolean;
  responses: FlowResponses;
  profile: UserProfile;
}

// 신규(아직 아무것도 시작하지 않은) 사용자에게만 true.
//   · 완료 세션 복구(done) → false        · 무료 질문 진행 중(profileDone/응답 존재) → false
//   · 프로필 일부라도 입력 → false        · 전부 비어 있으면(첫 진입) → true
// 유료 화면(#paid-preview/#paid-questions/#paid-result)은 별도 라우트라 이 게이트를 지나지 않는다.
export function shouldShowCareerIntro(s: CareerIntroGateInput): boolean {
  if (s.done || s.profileDone) return false;
  if (Object.keys(s.responses).length > 0) return false;
  if (Object.keys(s.profile).length > 0) return false;
  return true;
}

// ─── 최종 문구(§2 스펙 그대로 — 추가 안내·가격·소요 시간·진단 표현 금지) ───────
export const INTRO_TITLE = '요즘, 이 길이 맞는지 자꾸 고민된다면';
// 한글 타이핑은 code unit이 아니라 문자 단위로 — Unicode-safe(Array.from).
export const INTRO_TITLE_CHARS: readonly string[] = Array.from(INTRO_TITLE);

export const INTRO_BODY_1 =
  '커리어 고민은 일이 싫어서만 생기지 않습니다. 잘하고 있어도, 어느 순간 “계속 이 길로 가도 될까?”라는 질문이 찾아옵니다. 한 국내 조사에서도 직장인의 87.5%가 현재 커리어에 대한 고민이 있다고 답했어요.';
export const INTRO_BODY_2 =
  '이 테스트를 만든 사람도 같은 질문에서 출발했습니다. 무엇이 결정을 어렵게 만드는지 이해하기 위해 커리어 의사결정에 관한 논문과 전문 서적을 바탕으로 질문을 설계했습니다.';
export const INTRO_BODY_3 =
  '지금부터 22개의 질문을 통해 내가 현재 어디쯤 와 있는지, 그리고 결정을 어렵게 만드는 핵심 고민 패턴은 무엇인지 무료로 살펴봅니다. 더 깊이 들여다보고 싶다면 이후 추가 질문을 거쳐 유료 심층 분석으로 이어갈 수 있습니다.';
export const INTRO_FINAL_NOTE = '좋아 보이는 답보다, 지금의 나와 가장 가까운 답을 골라주세요.';
export const INTRO_CTA_LABEL = '무료로 시작하기';

// 본문 중 굵게 강조할 구절(표시 전용). 각 구절은 해당 문단에 정확히 1회 등장해야 하며,
// 렌더러가 이 목록으로 문단을 쪼개 <strong>으로 감싼다(테스트로 등장 횟수 고정).
export const INTRO_BODY_1_EMPHASIS = ['87.5%'] as const;
export const INTRO_BODY_2_EMPHASIS = ['커리어 의사결정에 관한 논문과 전문 서적을 바탕으로 질문을 설계'] as const;
export const INTRO_BODY_3_EMPHASIS = ['무료', '유료 심층 분석'] as const;
export const INTRO_FINAL_NOTE_EMPHASIS = ['지금의 나와 가장 가까운 답'] as const;

// ─── 애니메이션 타이밍(§3) — 전체 연출 2초 미만 ───────────────────────────────
export const TYPE_START_DELAY_MS = 200;   // 진입 후 타이핑 시작까지
export const TYPE_CHAR_INTERVAL_MS = 40;  // 한 글자당
export const REVEAL_DELAY_MS = 200;       // 제목 완성 → 본문/CTA fade-in 시작
export const REVEAL_FADE_MS = 300;        // 본문/CTA fade-in 시간
export const CURSOR_HIDE_AFTER_MS = 1100; // 제목 완성 후 커서가 사라지기까지(짧은 깜빡임)

export function totalIntroAnimationMs(): number {
  return TYPE_START_DELAY_MS
    + INTRO_TITLE_CHARS.length * TYPE_CHAR_INTERVAL_MS
    + REVEAL_DELAY_MS
    + REVEAL_FADE_MS;
}
