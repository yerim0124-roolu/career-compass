// Career Compass — 유료 심화 분석 결과 화면 (#paid-result).
//
// 진입 시 무료 맥락(freeContext) + 유료 답(paidAnswers)을 서버 함수(/api/paid-analysis)
// 로 보내 결과지 JSON을 받아 카드 UI로 렌더한다. API 키는 서버에서만 쓰이며 프론트는
// 결과 JSON만 받는다. 로딩·에러 상태를 모두 다룬다. 접근 게이팅은 App.tsx의 플래그.

import { useEffect, useRef, useState } from 'react';
import type { PaidAnswers } from './paidTypes.ts';
import { readFreeContext } from './freeContext.ts';
import { logPaidAnalysisFailed } from './paidAnalytics.ts';
import { extractJson, validateResult, reconstructText, type PaidResult } from './resultValidation.ts';

interface Props {
  paidAnswers?: PaidAnswers | null;
}

type Phase = 'loading' | 'success' | 'error' | 'no_answers';

const LOADING_MESSAGES = [
  '당신만을 위한 분석을 만들고 있어요…',
  '재정·가족·현실 상황을 함께 살펴보는 중이에요…',
  '이번 달 할 수 있는 작은 실험을 정리하고 있어요…',
];

const PURPLE = '#8C6FD6';
const BOX_BG = '#F5F1FC';
const BOX_BORDER = '#E4DAF7';

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-1.5 font-black text-sm" style={{ color: '#5E5280' }}>
        <span aria-hidden>🧭</span> Career Compass <span className="font-bold" style={{ color: '#C7BBDE' }}>심화 분석</span>
      </div>
    </header>
  );
}

export default function PaidResultView({ paidAnswers }: Props = {}) {
  const [phase, setPhase] = useState<Phase>(paidAnswers ? 'loading' : 'no_answers');
  const [result, setResult] = useState<PaidResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);

  // 로딩 문구 순환.
  useEffect(() => {
    if (phase !== 'loading') return;
    const id = window.setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 4000);
    return () => window.clearInterval(id);
  }, [phase]);

  // 최신 paidAnswers를 effect 안에서 안전하게 참조.
  const paidRef = useRef(paidAnswers);
  paidRef.current = paidAnswers;

  useEffect(() => {
    const paid = paidRef.current;
    if (!paid) { setPhase('no_answers'); return; }
    setPhase('loading');
    setResult(null);

    const controller = new AbortController();
    let cancelled = false;
    let settled = false; // 성공/에러 중 하나로 반드시 종결. 무한 로딩 방지.

    const finishError = (reason: string) => {
      if (cancelled || settled) return;
      settled = true;
      controller.abort();
      logPaidAnalysisFailed(reason);
      setPhase('error');
    };
    const finishSuccess = (data: PaidResult) => {
      if (cancelled || settled) return;
      settled = true;
      controller.abort();
      setResult(data);
      setPhase('success');
    };

    // 하드 타임아웃: 60초 안에 성공/에러로 끝나지 않으면 무조건 에러로 종결.
    // (스트림이 안 닫혀 done이 안 와도 여기서 확실히 로딩을 푼다.)
    const timeout = window.setTimeout(() => finishError('timeout'), 60000);

    (async () => {
      try {
        const freeContext = readFreeContext();
        const resp = await fetch('/api/paid-analysis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ freeContext, paidAnswers: paid }),
          signal: controller.signal,
        });
        // 스트림 시작 전 실패(4xx/5xx)는 여기서 잡힌다.
        if (!resp.ok || !resp.body) throw new Error(`http_${resp.status}`);

        // 스트림을 청크로 누적하되, 매 청크마다 "완전한 유효 JSON이 모였는지" 확인해
        // 모이는 즉시 완료한다(스트림 종료 done을 기다리지 않음 — 서버가 연결을 늦게
        // 닫아도 무한 로딩에 빠지지 않게). 서버가 순수 JSON이든 SSE든 reconstructText가
        // 흡수한다. 화면은 로딩 유지 → 완성 시 카드로 전환(글자 실시간 표시 아님).
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let full = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (value) full += decoder.decode(value, { stream: true });

          const parsed = extractJson(reconstructText(full));
          if (validateResult(parsed)) {
            try { await reader.cancel(); } catch { /* noop */ }
            finishSuccess(parsed);
            return;
          }
          if (done) break;
          if (settled) return; // 타임아웃 등으로 이미 종결됐으면 중단
        }

        // 스트림이 끝났는데도 유효 JSON을 못 얻음 → 마지막 flush 후 한 번 더 시도.
        full += decoder.decode();
        const finalParsed = extractJson(reconstructText(full));
        if (validateResult(finalParsed)) { finishSuccess(finalParsed); return; }
        throw new Error('parse_or_validation_failed');
      } catch (e) {
        if (controller.signal.aborted && settled) return; // 우리가 성공 후 abort한 경우
        finishError(e instanceof Error ? e.message : 'unknown');
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

  // ── 답변 없음(직접 접근/새로고침) ──
  if (phase === 'no_answers') {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-2xl" aria-hidden>🧭</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            먼저 심화 문항에 답해 주세요. 답변을 바탕으로 맞춤 분석을 만들어 드려요.
          </p>
          <button type="button" onClick={() => { window.location.hash = '#paid-questions'; }}
            className="px-6 py-3 rounded-2xl text-white font-bold" style={{ background: PURPLE }}>
            심화 문항으로 가기 <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 로딩 ──
  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-24 flex flex-col items-center text-center gap-5">
          <div className="w-10 h-10 rounded-full border-4 animate-spin"
            style={{ borderColor: BOX_BORDER, borderTopColor: PURPLE }} aria-hidden />
          <p className="text-sm text-slate-600 leading-relaxed">{LOADING_MESSAGES[msgIndex]}</p>
          <p className="text-[11px] text-slate-400">10~20초 정도 걸릴 수 있어요.</p>
        </div>
      </div>
    );
  }

  // ── 에러 ──
  if (phase === 'error' || !result) {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-2xl" aria-hidden>🌥️</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            분석을 만드는 중에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.
          </p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)}
            className="px-6 py-3 rounded-2xl text-white font-bold" style={{ background: PURPLE }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ── 성공 ──
  const { summaryCard, sections, judgeCriteria } = result;
  const summaryRows: Array<{ label: string; value: string }> = [
    { label: '지금 핵심', value: summaryCard.coreNow },
    { label: '가장 큰 리스크', value: summaryCard.biggestRisk },
    { label: '지금 하지 말 것', value: summaryCard.dontDo },
    { label: '이번 달 할 것', value: summaryCard.doThis },
    { label: '30일 뒤 판단 기준', value: summaryCard.judgeBy },
  ];

  return (
    <div className="min-h-dvh bg-white">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* 상단 — 요약 카드(도구적·명료, 강조 박스) */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}` }}>
          <p className="text-xs font-black tracking-widest uppercase" style={{ color: PURPLE }}>1분 요약</p>
          <ul className="space-y-2.5">
            {summaryRows.map((row) => (
              <li key={row.label} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-400">{row.label}</span>
                <span className="text-[14px] font-bold text-slate-800 leading-snug">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 중단 — 7섹션(상담 온기, 편한 본문) */}
        <section className="space-y-7">
          {sections.map((s, i) => (
            <article key={i} className="space-y-2">
              <h2 className="text-base font-black text-slate-800">【{s.title}】</h2>
              <p className="text-[15px] leading-[1.8] text-slate-700 whitespace-pre-line">{s.body}</p>
            </article>
          ))}
        </section>

        {/* 하단 — 판단 기준 체크리스트(도구적, 강조 박스) */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-black tracking-widest uppercase text-slate-500">30일 뒤 판단 기준</p>
          <p className="text-[14px] text-slate-700 leading-relaxed">{judgeCriteria.intro}</p>
          <ul className="space-y-2 pt-1">
            {judgeCriteria.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-slate-800">
                <span aria-hidden className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border text-[10px]"
                  style={{ borderColor: PURPLE, color: PURPLE }}>✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2 space-y-2 text-[13px] leading-relaxed">
            <p className="text-slate-700"><span className="font-bold" style={{ color: PURPLE }}>2개 이상 예라면</span> · {judgeCriteria.ifYes}</p>
            <p className="text-slate-700"><span className="font-bold text-slate-500">모두 아니오라면</span> · {judgeCriteria.ifNo}</p>
          </div>
        </section>

      </main>
    </div>
  );
}
