// Career Compass — 무료 퀴즈에서 이미 수집한 맥락을 유료 파이프라인으로 넘기는 리더.
//
// 나이대(ageBand)는 무료 온보딩(chatFlow의 pc_ageBand → profile.ageBand)에서
// 수집되어 hybrid 세션 localStorage에 저장된다. 유료 문항에서 중복 수집하지 않고,
// 결과 생성 시 여기서 읽어 함께 사용한다(3단계 프롬프트 주입). READ-ONLY 파일은
// 읽기만 하며, ageBand 코드값 형식('20_early' 등)은 그대로 보존한다.

import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import { parsePersistedSession, buildResultFromSession } from '../careerCompassV2/session.ts';

const HYBRID_STORAGE_KEY = 'career-compass-hybrid-session-v1';

/**
 * 무료 세션의 profile.ageBand 코드값을 반환. 없거나 파싱 실패 시 undefined.
 * 값 형식은 UserProfile.ageBand와 동일: 20_early|20_late|30_early|30_late|40_early|40_late_plus
 */
export function readFreeAgeBand(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
    if (!raw) return undefined;
    const ageBand = JSON.parse(raw)?.profile?.ageBand;
    return typeof ageBand === 'string' ? ageBand : undefined;
  } catch {
    return undefined;
  }
}

// 서버(api/paid-analysis)로 넘길 무료 맥락. 값은 전부 원본 코드값 또는 원문 텍스트.
// 코드값 → 한글 변환은 서버가 labelMap으로 수행한다(프론트는 형식을 바꾸지 않음).
export interface FreeContext {
  occupation: string;        // profile.jobRoleRaw (원문)
  experienceLevel: string;   // profile.totalCareerStage (코드)
  ageBand: string;           // profile.ageBand (코드)
  mainType: string;          // resultContext.mainType (코드)
  primarySubtype: string;    // 코드
  secondarySubtype: string;  // 코드
  subtypeConfidence: number;
  pullDirection: string;     // 코드(CareerOptionKey)
  primaryFriction: string;   // 코드(FrictionSource)
  readinessLevel: string;    // 코드
  userFreeText: string;      // 무료 응답 중 사용자가 직접 쓴 말(있으면), 없으면 ''
}

/**
 * 무료 세션(localStorage) + 순수 결과 빌더로 유료 결과 생성에 필요한 무료 맥락을 만든다.
 * READ-ONLY 로직(session.ts)은 읽기만 하며, 코드값 형식을 그대로 보존한다.
 * 세션이 없거나 실패하면 빈 값(코드는 '', 숫자는 0)으로 안전 폴백 → 서버에서 "정보 없음".
 */
export function readFreeContext(): FreeContext {
  const empty: FreeContext = {
    occupation: '', experienceLevel: '', ageBand: '',
    mainType: '', primarySubtype: '', secondarySubtype: '',
    subtypeConfidence: 0, pullDirection: '', primaryFriction: '',
    readinessLevel: '', userFreeText: '',
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
    const parsed = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
    const spine = buildResultFromSession({ responses: parsed.responses, profile: parsed.profile });
    const rc = spine.resultContext;
    // 사용자가 직접 쓴 자유입력(shortText) 모으기 — 없으면 ''.
    const userFreeText = Object.values(parsed.responses)
      .map((r) => (r?.shortText ?? '').trim())
      .filter((t) => t.length > 0)
      .join(' / ');
    return {
      occupation: parsed.profile.jobRoleRaw ?? '',
      experienceLevel: parsed.profile.totalCareerStage ?? '',
      ageBand: parsed.profile.ageBand ?? '',
      mainType: rc?.mainType ?? '',
      primarySubtype: rc?.primarySubtype ?? '',
      secondarySubtype: rc?.secondarySubtype ?? '',
      subtypeConfidence: rc?.subtypeConfidence ?? 0,
      pullDirection: rc?.pullDirection ?? '',
      primaryFriction: rc?.primaryFriction ?? '',
      readinessLevel: rc?.readinessLevel ?? '',
      userFreeText,
    };
  } catch {
    return empty;
  }
}
