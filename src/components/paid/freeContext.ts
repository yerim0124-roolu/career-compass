// Career Compass — 무료 퀴즈에서 이미 수집한 맥락을 유료 파이프라인으로 넘기는 리더.
//
// 나이대(ageBand)는 무료 온보딩(chatFlow의 pc_ageBand → profile.ageBand)에서
// 수집되어 hybrid 세션 localStorage에 저장된다. 유료 문항에서 중복 수집하지 않고,
// 결과 생성 시 여기서 읽어 함께 사용한다(3단계 프롬프트 주입). READ-ONLY 파일은
// 읽기만 하며, ageBand 코드값 형식('20_early' 등)은 그대로 보존한다.

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
