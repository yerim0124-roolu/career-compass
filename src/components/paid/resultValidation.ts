// Career Compass — 유료 결과지 검증(클라이언트 진입점).
//
// 단일 계약(src/shared/paidAnalysisContract.ts)을 그대로 재노출한다. 프론트는 이
// 파일을 통해 계약의 타입·정규화·검증을 사용하며, 서버(api/paid-analysis.ts)는
// 같은 로직을 인라인 복사해 쓴다(둘의 동등성은 계약 테스트가 보장).

export type { PaidAnalysisResult as PaidResult, NarrativeSection, ExperimentItem } from '../../shared/paidAnalysisContract.ts';
export {
  normalizePaidResult,
  getValidationErrors as validationErrors,
  validatePaidAnalysisResult as validateResult,
} from '../../shared/paidAnalysisContract.ts';
