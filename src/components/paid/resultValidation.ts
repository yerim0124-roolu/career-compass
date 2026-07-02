// Career Compass — 유료 결과지 스키마 타입·검증 (클라이언트).
//
// 서버(api/paid-analysis)가 non-streaming으로 검증 통과한 순수 JSON을 반환한다.
// 프론트는 방어적으로 한 번 더 검증한 뒤 카드 UI로 렌더한다. 검증 규칙은 서버의
// validationErrors와 동일하게 유지한다(고정 배열 개수 + 필드 타입).

export interface TitledItem { title: string; body: string; }

export interface PaidResult {
  summaryCard: {
    coreNow: string; biggestRisk: string; dontDo: string; doThis: string; judgeBy: string;
  };
  corePatterns: TitledItem[];       // 3
  blockers: TitledItem[];           // 3
  strengths: TitledItem[];          // 3
  risks: TitledItem[];              // 2~3
  monthlyExperiments: TitledItem[]; // 3
  sevenDayPlan: string[];           // 7
  recheckCriteria: string[];        // 3
  finalMessage: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isTitledArr = (v: unknown, min: number, max: number): boolean =>
  Array.isArray(v) && v.length >= min && v.length <= max
  && v.every((x) => { const o = x as Record<string, unknown>; return !!o && isStr(o.title) && isStr(o.body); });
const isStrArr = (v: unknown, n: number): boolean =>
  Array.isArray(v) && v.length === n && v.every((x) => isStr(x));

/** 스키마 검증 실패 항목 목록(진단·로깅용). 비어 있으면 유효. */
export function validationErrors(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== 'object') return ['not_object'];
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  if (!sc || !isStr(sc.coreNow) || !isStr(sc.biggestRisk) || !isStr(sc.dontDo) || !isStr(sc.doThis) || !isStr(sc.judgeBy)) e.push('summaryCard');
  if (!isTitledArr(r.corePatterns, 3, 3)) e.push('corePatterns(3)');
  if (!isTitledArr(r.blockers, 3, 3)) e.push('blockers(3)');
  if (!isTitledArr(r.strengths, 3, 3)) e.push('strengths(3)');
  if (!isTitledArr(r.risks, 2, 3)) e.push('risks(2-3)');
  if (!isTitledArr(r.monthlyExperiments, 3, 3)) e.push('monthlyExperiments(3)');
  if (!isStrArr(r.sevenDayPlan, 7)) e.push('sevenDayPlan(7)');
  if (!isStrArr(r.recheckCriteria, 3)) e.push('recheckCriteria(3)');
  if (!isStr(r.finalMessage)) e.push('finalMessage');
  return e;
}

/** 검증 통과 여부 + 타입 가드. */
export function validateResult(o: unknown): o is PaidResult {
  return validationErrors(o).length === 0;
}
