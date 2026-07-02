// Career Compass — 유료 심화 분석 결과 화면 (#paid-result).
//
// 진입 시 무료 맥락(freeContext) + 유료 답(paidAnswers)을 서버 함수(/api/paid-analysis)
// 로 보내 결과지 JSON을 받아 카드 UI로 렌더한다. API 키는 서버에서만 쓰이며 프론트는
// 결과 JSON만 받는다. 로딩·에러 상태를 모두 다룬다. 접근 게이팅은 App.tsx의 플래그.

import { useEffect, useRef, useState } from 'react';
import type { PaidAnswers } from './paidTypes.ts';
import { readFreeContext } from './freeContext.ts';
import { logPaidAnalysisFailed } from './paidAnalytics.ts';
import { validationErrors, normalizePaidResult, type PaidResult, type NarrativeSection, type ExperimentItem } from './resultValidation.ts';

interface Props {
  paidAnswers?: PaidAnswers | null;
}

type Phase = 'loading' | 'success' | 'error' | 'no_answers' | 'insufficient_input';

// 서술형 길이로는 절대 막지 않는다(맥락은 대부분 구조화 답변에 있음). 문장 수는 진단 로그용.
function countSentences(text: string): number {
  return text.split(/[\n.!?]|다\.|요\.|음\./).map((s) => s.trim()).filter((s) => s.length >= 5).length;
}

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

  // 각 실행(mount/재시도)의 고유 id — 늦게 도착한 stale 콜백을 무시하기 위함.
  const runIdRef = useRef(0);

  useEffect(() => {
    const paid = paidRef.current;
    if (!paid) { setPhase('no_answers'); return; }
    setPhase('loading');
    setResult(null);

    const myRun = ++runIdRef.current;
    const controller = new AbortController();
    let settled = false;
    // 이 실행이 여전히 최신이고 아직 종결 전일 때만 상태를 바꾼다.
    const isActive = () => myRun === runIdRef.current && !settled;

    const finishError = (reason: string) => {
      if (!isActive()) return;
      settled = true;
      window.clearTimeout(timeout);
      logPaidAnalysisFailed(reason);
      // eslint-disable-next-line no-console
      console.log('[paid-analysis] → error UI (reason:', reason, ')');
      setPhase('error');
    };
    const finishSuccess = (data: PaidResult) => {
      if (!isActive()) return;
      settled = true;
      window.clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.log('[paid-analysis] → success: result 세팅, loading 종료');
      setResult(data);
      setPhase('success');
    };

    // 하드 타임아웃: 서버 함수는 최대 3분(180초)까지 열려 있고 main Claude 호출을 150초까지
    // 기다린다. 프론트는 그보다 여유 있게 180초로 둬야 서버 정상 응답을 놓치지 않는다.
    const timeout = window.setTimeout(() => { controller.abort(); finishError('timeout'); }, 180000);

    (async () => {
      try {
        const freeContext = readFreeContext();
        // 진단 — 서버로 보내는 서술형 길이(개인정보 전체는 찍지 않음). free-text 누락 추적용.
        const clip60 = (v: string) => (v ? v.slice(0, 60).replace(/\n/g, ' ') : '(none)');
        const freeTextChars = freeContext.occupation.length + freeContext.userFreeText.length + paid.trigger.length + paid.flowMoment.length;
        const sentenceCount = countSentences(`${paid.trigger}\n${paid.flowMoment}\n${freeContext.userFreeText}`);
        // 답변 개수(구조화) — 맥락이 실제로 얼마나 채워졌는지.
        const answerVals = Object.values(paid).flatMap((v) => (Array.isArray(v) ? v : [v]));
        const answerCount = answerVals.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
        // eslint-disable-next-line no-console
        console.log('[paid-analysis] SEND | freeContext keys:', Object.keys(freeContext).join(','),
          '| paid.trigger len:', paid.trigger.length, `"${clip60(paid.trigger)}"`,
          '| paid.flowMoment len:', paid.flowMoment.length, `"${clip60(paid.flowMoment)}"`,
          '| freeTextChars:', freeTextChars, '| sentenceCount:', sentenceCount,
          '| candidateDirection:', paid.candidateDirection, '| mustKeep:', paid.mustKeep.join('/'));
        // eslint-disable-next-line no-console
        console.log('[paid-analysis] PAYLOAD_SHAPE', {
          topLevelKeys: ['freeContext', 'paidAnswers'],
          hasResult: !!(freeContext.mainType || freeContext.primarySubtype),
          hasScores: typeof freeContext.subtypeConfidence === 'number',
          hasAnswers: answerCount > 0, answerCount,
          hasFreeContext: Object.keys(freeContext).length > 0,
          freeContextKeys: Object.keys(freeContext),
          freeTextChars,
        });
        // 서술형이 짧아도 절대 막지 않는다 — 구조화 답변으로 서버가 분석을 진행한다.
        const resp = await fetch('/api/paid-analysis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ freeContext, paidAnswers: paid }),
          signal: controller.signal,
        });

        // 진단 로깅 — 실제로 무엇이 오는지 (status / 길이 / 앞부분 / parse / validate).
        const status = resp.status;
        const bodyText = await resp.text();
        // eslint-disable-next-line no-console
        console.log('[paid-analysis] status:', status, '| text length:', bodyText.length);
        // eslint-disable-next-line no-console
        console.log('[paid-analysis] body(0..500):', bodyText.slice(0, 500));

        if (!resp.ok) {
          // 서버가 준 에러 코드(fact_check_failed / validation_failed / upstream_error / not_configured 등)를 분리.
          let serverErr = '';
          try { serverErr = String((JSON.parse(bodyText) as { error?: unknown })?.error ?? ''); } catch { /* 비-JSON 본문 */ }
          // eslint-disable-next-line no-console
          console.error('[paid-analysis] 서버 에러 — status:', status, '| error:', serverErr || '(본문 없음/비JSON)');
          // 서버가 '입력이 극단적으로 부족'하다고 판단한 경우에만 추가 입력 화면을 띄운다(차단 아님).
          if (serverErr === 'insufficient_input') {
            if (!isActive()) return;
            settled = true;
            window.clearTimeout(timeout);
            setPhase('insufficient_input');
            return;
          }
          throw new Error(`http_${status}${serverErr ? `_${serverErr}` : ''}`);
        }

        let parsedRaw: unknown = null;
        let parseOk = false;
        try { parsedRaw = JSON.parse(bodyText); parseOk = true; }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error('[paid-analysis] JSON.parse 실패:', err);
        }
        // 서버가 이미 canonical을 반환하지만, 프론트도 계약의 normalize로 한 번 더 방어.
        const normalized = parseOk ? normalizePaidResult(parsedRaw) : null;
        const errs = normalized ? validationErrors(normalized) : ['parse_failed'];
        // eslint-disable-next-line no-console
        console.log('[paid-analysis] parseOk:', parseOk, '| validateOk(normalized):', errs.length === 0,
          errs.length ? `| 누락/불일치: ${errs.join(', ')}` : '');
        if (errs.length > 0) {
          if (parseOk) {
            // eslint-disable-next-line no-console
            console.error('[paid-analysis] 받은 top-level keys:', Object.keys((parsedRaw ?? {}) as object));
          }
          throw new Error(parseOk ? 'validation_failed' : 'parse_failed');
        }

        finishSuccess(normalized as PaidResult);
      } catch (e) {
        // 타임아웃/언마운트로 abort된 경우는 이미 finishError가 처리했거나 stale이므로 무시.
        if (controller.signal.aborted) return;
        finishError(e instanceof Error ? e.message : 'unknown');
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    // 언마운트/재시도 시: 이 실행을 stale로 만들고(runId 증가) 정리.
    return () => { runIdRef.current++; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

  // ── 입력 부족(서술형이 너무 짧음) → 추가 입력 요청 ──
  if (phase === 'insufficient_input') {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-2xl" aria-hidden>✍️</p>
          <p className="text-base font-black text-slate-800">답변을 조금만 더 채워 주세요</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            분석에 필요한 정보가 아직 충분하지 않아요. 심화 문항을 한 번 더 확인해 채워 주시면
            당신의 상황에 맞는 리포트를 만들어 드릴게요.
          </p>
          <button type="button" onClick={() => { window.location.hash = '#paid-questions'; }}
            className="px-6 py-3 rounded-2xl text-white font-bold" style={{ background: PURPLE }}>
            심화 문항 확인하기 <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

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
          <p className="text-[11px] text-slate-400">1~2분 정도 걸릴 수 있어요.</p>
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

  // ── 성공 (narrative report) ──
  const { summaryCard, currentPosition, whyNow, innerConflict, riskMap, transitionAssets,
    monthlyExperiment, futureMessage, sevenDayPlan, recheckCriteria, ifTwoOrMoreYes, ifAllNo } = result;

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: '지금 핵심', value: summaryCard.coreNow },
    { label: '가장 큰 리스크', value: summaryCard.biggestRisk },
    { label: '지금 하지 말 것', value: summaryCard.dontDo },
    { label: '이번 달 할 것', value: summaryCard.doThis },
    { label: '30일 뒤 판단 기준', value: summaryCard.judgeBy },
  ];

  // 본문 = narrative 섹션들(긴 서사). futureMessage는 지정 순서상 재점검 뒤 마지막에.
  const narrativeFlow: NarrativeSection[] = [currentPosition, whyNow, innerConflict, riskMap, transitionAssets];

  const expRows: Array<{ label: string; key: keyof ExperimentItem }> = [
    { label: '가설', key: 'hypothesis' },
    { label: '대상', key: 'target' },
    { label: '행동', key: 'action' },
    { label: '성공 기준', key: 'successMetric' },
    { label: '중단 신호', key: 'stopSignal' },
    { label: '왜 나에게 맞나', key: 'whyThisFits' },
  ];

  const NarrativeBlock = ({ s }: { s: NarrativeSection }) => (
    <section className="space-y-2">
      <h2 className="text-base font-black text-slate-800">【{s.title}】</h2>
      <p className="text-[15px] leading-[1.85] text-slate-700 whitespace-pre-line">{s.body}</p>
    </section>
  );

  return (
    <div className="min-h-dvh bg-white">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* 1분 요약(도구적·강조 박스) */}
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

        {/* 본문 — narrative 섹션(긴 서사 리포트) */}
        {narrativeFlow.map((s, i) => <NarrativeBlock key={i} s={s} />)}

        {/* 이번 달의 30일 실험 — 서사 본문 + 구조화 실험 카드 */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-800">【{monthlyExperiment.title}】</h2>
          <p className="text-[15px] leading-[1.85] text-slate-700 whitespace-pre-line">{monthlyExperiment.body}</p>
          <div className="space-y-4 pt-1">
            {monthlyExperiment.experiments.map((exp, i) => (
              <article key={i} className="rounded-2xl p-4 space-y-2" style={{ background: '#FBFAFE', border: `1px solid ${BOX_BORDER}` }}>
                <h3 className="text-[15px] font-bold" style={{ color: '#5E5280' }}>{exp.title || `실험 ${i + 1}`}</h3>
                {exp.body && <p className="text-[14px] leading-[1.75] text-slate-700 whitespace-pre-line">{exp.body}</p>}
                <dl className="grid grid-cols-1 gap-1 pt-1">
                  {expRows.filter((r) => (exp[r.key] as string | undefined)?.trim()).map((r) => (
                    <div key={r.key} className="flex gap-2 text-[13px] leading-relaxed">
                      <dt className="shrink-0 font-bold" style={{ color: PURPLE }}>{r.label}</dt>
                      <dd className="text-slate-700">{exp[r.key] as string}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        {/* 7일 실행 계획 */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}` }}>
          <p className="text-xs font-black tracking-widest uppercase" style={{ color: PURPLE }}>7일 실행 계획</p>
          <ol className="space-y-2.5">
            {sevenDayPlan.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-slate-800 leading-relaxed">
                <span aria-hidden className="mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] font-bold"
                  style={{ background: PURPLE }}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 30일 뒤 판단 기준 + 분기 안내 */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-black tracking-widest uppercase text-slate-500">30일 뒤 판단 기준</p>
          <ul className="space-y-2 pt-1">
            {recheckCriteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-slate-800 leading-relaxed">
                <span aria-hidden className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border text-[10px]"
                  style={{ borderColor: PURPLE, color: PURPLE }}>✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2 space-y-2 text-[13px] leading-relaxed">
            <p className="text-slate-700"><span className="font-bold" style={{ color: PURPLE }}>2가지 이상 예라면</span> · {ifTwoOrMoreYes}</p>
            <p className="text-slate-700"><span className="font-bold text-slate-500">모두 아니오라면</span> · {ifAllNo}</p>
          </div>
        </section>

        {/* 한 달 뒤의 당신에게 — 마지막 서사 */}
        <NarrativeBlock s={futureMessage} />

      </main>
    </div>
  );
}
