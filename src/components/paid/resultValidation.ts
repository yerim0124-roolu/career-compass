// Career Compass — 유료 결과지 JSON 파싱·검증 (클라이언트).
//
// 서버(api/paid-analysis)는 스트리밍으로 순수 JSON 텍스트만 흘려보낸다. 프론트가
// 전체 텍스트를 다 받은 뒤 여기서 파싱·검증한 다음 카드 UI로 렌더한다. 검증 규칙은
// 서버(api/paid-analysis.ts)의 것과 동일하게 유지한다(summaryCard 5필드 / sections
// 정확히 7개 / judgeCriteria 구조).

export interface PaidResult {
  summaryCard: {
    coreNow: string; biggestRisk: string; dontDo: string; doThis: string; judgeBy: string;
  };
  sections: Array<{ title: string; body: string }>;
  judgeCriteria: { intro: string; checks: string[]; ifYes: string; ifNo: string };
}

/** 코드펜스/앞뒤 잡텍스트를 걷어내고 JSON만 파싱. 실패 시 null. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* noop */ }
  }
  return null;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** 결과지 스키마 검증 + 타입 가드. */
export function validateResult(o: unknown): o is PaidResult {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  if (!sc || !isStr(sc.coreNow) || !isStr(sc.biggestRisk) || !isStr(sc.dontDo) || !isStr(sc.doThis) || !isStr(sc.judgeBy)) return false;
  if (!Array.isArray(r.sections) || r.sections.length !== 7) return false;
  for (const s of r.sections) {
    const sec = s as Record<string, unknown>;
    if (!isStr(sec.title) || !isStr(sec.body)) return false;
  }
  const jc = r.judgeCriteria as Record<string, unknown> | undefined;
  if (!jc || !isStr(jc.intro) || !isStr(jc.ifYes) || !isStr(jc.ifNo)) return false;
  if (!Array.isArray(jc.checks) || jc.checks.length === 0 || jc.checks.some((c) => !isStr(c))) return false;
  return true;
}
