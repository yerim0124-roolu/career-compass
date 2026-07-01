// Career Compass — feature flags.
//
// 유료 기능 전체를 켜고 끄는 단일 스위치. `paidAnalysis`가 false인 동안에는
// 무료 버전과 100% 동일하게 동작해야 한다(빈 유료 라우트는 접근 시 홈으로
// 리다이렉트). 유료 기능이 완성되기 전까지는 false로 둔다.

export const FEATURE_FLAGS = {
  paidAnalysis: true, // 유료 심화 분석 기능. 완성 전까지 false.
};
