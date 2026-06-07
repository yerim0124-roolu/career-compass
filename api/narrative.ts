// ADR-001 — /api/narrative (Vercel serverless function).
//
// Takes the NarrativePayload assembled client-side (narrativePayload.ts),
// asks the model to produce { coreInsight, narrative, whyBullets }, validates
// the output, and returns it. ANY failure → non-200 → the client keeps the
// deterministic template text (zero-risk fallback).
//
// Env: ANTHROPIC_API_KEY (Vercel project settings). Never exposed to the client.

export const MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 1200;

// Exported for scripts/runGoldenNarratives.mts (golden-payload review runner).
export const SYSTEM_PROMPT = `너는 노련한 커리어 상담사다. 입력 JSON(recommendation의 사실, 사용자의 답변 라벨)을 바탕으로 결과지의 해석 문장을 쓴다.

핵심 임무 — 요약 금지, 해석 의무. 출력 전에 아래 3단계 추론을 순서대로 수행하라:

1단계 — 이력 구조 추론: profile을 교차 대조하라. 직군 특성(전문직/자격 여부), 총 경력 vs 현 분야 경력의 차이, 연령대를 함께 보면 살아온 구조가 보인다.
예시 a: 수의사(전문직) + 현 분야 1~3년 + 총 경력 7~12년 → 자격까지 갖춰 방향을 바꾼 경험 → 도전을 두려워하지 않거나 깊은 고민을 거쳐온 사람일 가능성.
예시 b: 마케터(일반 직군) + 현 분야 7년 이상 + 총 경력 7~12년 → 한 우물형 → 안정 자산이 크지만 '다른 길을 안 가본 것'이 불안의 원천일 가능성.
프로필 정보가 비어 있으면 1단계를 건너뛰고 2단계(답변 조합)만으로 추론하라.

2단계 — 동기 구조 추론: 가치 우선순위 + 자신감 신호 + 끌리는 역할의 조합에서 욕구 가설을 세워라.
예시: 영향력·수익 동시 상위 + 자신감 높음 → 잘하는 게 많고 자존감이 높은 사람의 고민은 '무엇을 할까'가 아니라 '어떻게 더 크게 인정받고 벌까'다.
보조 패턴: 가치를 모두 고르고 랭킹을 망설임 → 선택지를 닫는 것을 손해로 느끼는 성향 / 안정 가치 상위 + 창업 역할 끌림 → 원하는 것과 허락한 것이 다른 상태, 순서의 문제로 풀기 / 가치 랭킹과 직접 고른 30일 실험이 다른 방향 → 손이 먼저 간 쪽이 진심일 가능성 / 반응 질문의 감정 단어(설렘·피곤·무덤덤) 분포가 에너지 나침반.

3단계 — 진짜 질문 재정의: 1·2단계를 합쳐 사용자가 명시하지 않은 '진짜 질문'을 한 문장으로 정의하고 coreInsight로 출력하라. userConcern이 있으면 받아 적지 말고 그 아래의 질문으로 내려가라.

narrative 구조 강제: coreInsight를 재설명하지 마라. 문단 1 = "그래서 이렇게 하시면 돼요"(coreInsight의 렌즈로 coreExperiment를 재해석한 구체적 행동 지시), 문단 2(선택) = 안전판·여건 한 줄. 한 문단에 한 가지 생각만. userConcern이 있으면 narrative 어딘가에서 그 고민에 직접 답하되 왜곡하지 마라.

절대 규칙:
0. 위 예시들은 추론의 '형태'를 보여줄 뿐이다. 입력에 해당 신호가 없으면 그 유형의 추론을 억지로 만들지 마라 — 전환 경험·전문직 같은 주제는 실제 신호가 있을 때만 다룬다.
1. recommendation에 없는 행동·선택지를 제안하거나 추천을 바꾸지 않는다.
2. 입력에 없는 사실을 지어내지 않는다. 해석은 허용, 사실 날조는 금지. 모든 추론은 입력 신호 2개 이상의 조합에서 도출한다.
3. 빗나갈 수 있는 해석은 "~였을 가능성이 높아요", "만약 그렇다면" 화법으로 가설임을 드러낸다. 단정 금지.
4. conditionalOption/pausedOption은 점수상 추론된 후보임을 밝힌다 ("끌리지 않으면 지우셔도 됩니다").
5. 답변을 나열·반복하지 마라. 인용은 근거 제시용 최대 2회.
6. 톤: 친구의 조언처럼 따뜻하고 직접적으로. 허락을 주는 화법. 데이터 용어·점수·내부 유형명 금지. 의료·심리 진단 표현 금지.
7. 출력은 JSON만. 다른 텍스트·마크다운 코드펜스 금지.

출력 형식: {"coreInsight": "1문장(80자 이내)", "narrative": "4~7문장(500자 이내)", "whyBullets": ["1문장", ...최대 4개(각 90자 이내)]}`;

interface LlmOutput {
  coreInsight: string;
  narrative: string;
  whyBullets: string[];
}

function isValidPayload(b: unknown): boolean {
  if (!b || typeof b !== 'object') return false;
  const p = b as Record<string, unknown>;
  const rec = p.recommendation as Record<string, unknown> | undefined;
  return !!rec
    && typeof rec.currentBestMove === 'string'
    && typeof rec.coreExperiment === 'string'
    && Array.isArray(p.answerHighlights);
}

export function validateOutput(o: unknown, coreExperiment: string, currentBestMove: string): o is LlmOutput {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  if (typeof r.coreInsight !== 'string' || typeof r.narrative !== 'string' || !Array.isArray(r.whyBullets)) return false;
  if (r.coreInsight.length === 0 || r.coreInsight.length > 120) return false;
  if (r.narrative.length === 0 || r.narrative.length > 700) return false;
  if (r.whyBullets.length > 4 || r.whyBullets.some((b) => typeof b !== 'string' || (b as string).length > 140)) return false;
  // The recommendation must survive the rewrite: experiment or best-move must appear.
  const all = `${r.coreInsight} ${r.narrative} ${(r.whyBullets as string[]).join(' ')}`;
  const mentions = (label: string): boolean => {
    // Loose containment — allow the model to drop particles/spacing around the label.
    const core = label.replace(/\s+/g, '');
    return all.replace(/\s+/g, '').includes(core.slice(0, Math.min(core.length, 8)));
  };
  if (!mentions(coreExperiment) && !mentions(currentBestMove)) return false;
  // Hard bans: certainty claims and diagnosis-flavored words.
  if (/반드시|100%|진단|장애|우울증/.test(all)) return false;
  return true;
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  const payload = req.body;
  if (!isValidPayload(payload)) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream_error', status: upstream.status });
      return;
    }
    const data = (await upstream.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const parsed = extractJson(text);
    const rec = payload.recommendation as { coreExperiment: string; currentBestMove: string };
    if (!validateOutput(parsed, rec.coreExperiment, rec.currentBestMove)) {
      res.status(422).json({ error: 'validation_failed' });
      return;
    }
    // Cache identical payloads at the edge for a day (same answers → same letter).
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).json(parsed);
  } catch {
    res.status(502).json({ error: 'upstream_error' });
  }
}
