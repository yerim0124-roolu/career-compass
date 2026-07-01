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

/**
 * 서버가 보낸 원문에서 "결과지 JSON 텍스트"를 뽑아낸다.
 * - 정상: 서버가 순수 JSON 텍스트를 흘림 → 원문 그대로 사용.
 * - 방어: 만약 원문이 Anthropic SSE(`data: {...}`) 형태로 오면(프록시/서버 형식
 *   변화 대비), content_block_delta의 text_delta만 이어붙여 재구성한다.
 * 어느 형식이 와도 프론트가 동일하게 처리하도록 하는 관용 파서.
 */
export function reconstructText(raw: string): string {
  const looksSse = raw.includes('"content_block_delta"') || /(^|\n)data:/.test(raw);
  if (!looksSse) return raw;
  let text = '';
  let sawDelta = false;
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const d = t.slice(5).trim();
    if (d === '' || d === '[DONE]') continue;
    try {
      const e = JSON.parse(d) as { type?: string; delta?: { type?: string; text?: string } };
      if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta'
          && typeof e.delta.text === 'string') {
        text += e.delta.text;
        sawDelta = true;
      }
    } catch { /* 부분 라인/비-델타 무시 */ }
  }
  // 델타를 하나도 못 벗겼으면(=실은 SSE가 아니었음) 원문을 그대로 돌려준다.
  return sawDelta ? text : raw;
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
