// Career Compass — 유료 심화 분석 결과 화면 (#paid-result).
//
// [영속 job 방식] 브라우저는 Claude 실시간 생성에 의존하지 않는다. 대신:
//   1) POST /api/paid-job        — job 생성(queued). {jobId} 수신.
//   2) POST /api/paid-job-run    — 워커 트리거(await하지 않음; 결과는 DB에 저장됨).
//   3) GET  /api/paid-job?id=... — polling. status=ready면 저장된 result_json만 렌더.
// 실패/timeout/schema/quality 실패는 job failed로 저장되어 실패 UI + 재시도(/paid-job-retry)로
// 처리된다. 프론트는 Claude raw response를 직접 렌더하지 않는다(저장된 result_json만).
// API 키는 서버에서만 쓰인다. 접근 게이팅은 App.tsx의 플래그.

import { useEffect, useRef, useState } from 'react';
import type { PaidAnswers } from './paidTypes.ts';
import { readFreeContext } from './freeContext.ts';
import { logPaidAnalysisFailed } from './paidAnalytics.ts';
import { validationErrors, normalizePaidResult, type PaidResult, type NarrativeSection, type ExperimentItem } from './resultValidation.ts';

interface Props {
  paidAnswers?: PaidAnswers | null;
}

type Phase = 'loading' | 'success' | 'error' | 'no_answers' | 'insufficient_input' | 'permanent_failed';

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
  // 현재 job id(재시도용) + 직전이 실패였는지(같은 input으로 retry할지 판단).
  const jobIdRef = useRef<string | null>(null);
  const lastFailedRef = useRef(false);

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

    // polling 하드 타임아웃 = 서버 stale-timeout(10분)과 동일. 그 안에 ready가 안 되면 재시도 화면.
    const HARD_TIMEOUT_MS = 600000; // 10분
    const POLL_INTERVAL_MS = 3000;

    const finishError = (reason: string) => {
      if (!isActive()) return;
      settled = true; lastFailedRef.current = true;
      window.clearTimeout(timeout);
      logPaidAnalysisFailed(reason);
      // eslint-disable-next-line no-console
      console.log('[paid-job] → error UI (reason:', reason, ')');
      setPhase('error');
    };
    const finishSuccess = (data: PaidResult) => {
      if (!isActive()) return;
      settled = true; lastFailedRef.current = false;
      window.clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.log('[paid-job] → success: 저장된 result_json 렌더');
      setResult(data);
      setPhase('success');
    };

    const timeout = window.setTimeout(() => { controller.abort(); finishError('timeout'); }, HARD_TIMEOUT_MS);
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

    // 저장된 result_json을 프론트 계약으로 한 번 더 방어 정규화 후 렌더.
    const renderStoredResult = (resultJson: unknown): boolean => {
      const normalized = normalizePaidResult(resultJson);
      const errs = validationErrors(normalized);
      // eslint-disable-next-line no-console
      console.log('[paid-job] stored result validateOk:', errs.length === 0, errs.length ? `| ${errs.join(', ')}` : '');
      if (errs.length > 0) { finishError('validation_failed'); return false; }
      finishSuccess(normalized as PaidResult);
      return true;
    };

    (async () => {
      try {
        const freeContext = readFreeContext();
        const clip60 = (v: string) => (v ? v.slice(0, 60).replace(/\n/g, ' ') : '(none)');
        const freeTextChars = freeContext.occupation.length + freeContext.userFreeText.length + paid.trigger.length + paid.flowMoment.length;
        const sentenceCount = countSentences(`${paid.trigger}\n${paid.flowMoment}\n${freeContext.userFreeText}`);
        const answerVals = Object.values(paid).flatMap((v) => (Array.isArray(v) ? v : [v]));
        const answerCount = answerVals.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
        // eslint-disable-next-line no-console
        console.log('[paid-job] SEND | freeContext keys:', Object.keys(freeContext).join(','),
          '| paid.trigger len:', paid.trigger.length, `"${clip60(paid.trigger)}"`,
          '| paid.flowMoment len:', paid.flowMoment.length, `"${clip60(paid.flowMoment)}"`,
          '| freeTextChars:', freeTextChars, '| sentenceCount:', sentenceCount,
          '| candidateDirection:', paid.candidateDirection, '| mustKeep:', paid.mustKeep.join('/'));
        // eslint-disable-next-line no-console
        console.log('[paid-job] PAYLOAD_SHAPE', {
          topLevelKeys: ['freeContext', 'paidAnswers'],
          hasResult: !!(freeContext.mainType || freeContext.primarySubtype),
          hasScores: typeof freeContext.subtypeConfidence === 'number',
          hasAnswers: answerCount > 0, answerCount,
          hasFreeContext: Object.keys(freeContext).length > 0,
          freeContextKeys: Object.keys(freeContext),
          freeTextChars,
        });

        // ── 1) job 확보: 직전 실패 + 기존 job이 있으면 같은 input으로 retry, 아니면 새로 create ──
        let jobId = '';
        if (lastFailedRef.current && jobIdRef.current) {
          const r = await fetch('/api/paid-job-retry', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId: jobIdRef.current }), signal: controller.signal,
          });
          if (r.ok) {
            const rj = await r.json().catch(() => ({})) as { permanent?: boolean };
            // retry_count 초과 → permanent_failed. 더 이상 재시도하지 않는다.
            if (rj.permanent) {
              if (!isActive()) return;
              settled = true; window.clearTimeout(timeout); setPhase('permanent_failed'); return;
            }
            jobId = jobIdRef.current;
          }
          // retry 실패(예: 만료) → 아래 create로 폴백.
        }
        if (!jobId) {
          const createResp = await fetch('/api/paid-job', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ freeContext, paidAnswers: paid }), signal: controller.signal,
          });
          const createText = await createResp.text();
          // eslint-disable-next-line no-console
          console.log('[paid-job] CREATE status:', createResp.status, '| body:', createText.slice(0, 300));
          if (!createResp.ok) {
            let serverErr = '';
            try { serverErr = String((JSON.parse(createText) as { error?: unknown })?.error ?? ''); } catch { /* 비-JSON */ }
            if (serverErr === 'insufficient_input') {
              if (!isActive()) return;
              settled = true; window.clearTimeout(timeout); setPhase('insufficient_input'); return;
            }
            throw new Error(`create_http_${createResp.status}${serverErr ? `_${serverErr}` : ''}`);
          }
          jobId = String((JSON.parse(createText) as { jobId?: string }).jobId ?? '');
          if (!jobId) throw new Error('no_job_id');
        }
        jobIdRef.current = jobId;
        lastFailedRef.current = false;

        // ── 2) 워커 트리거 — 결과를 기다리지 않는다(결과는 DB에 저장, 폴링으로 읽음). ──
        //   run worker는 /api/paid-analysis (POST {jobId}). abort되어도 서버 함수는 계속
        //   실행되어 result_json을 저장한다. 프론트는 이 응답 본문을 렌더에 쓰지 않는다.
        fetch('/api/paid-analysis', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jobId }), signal: controller.signal,
        }).catch(() => { /* fire-and-forget: 폴링이 실제 상태를 읽는다 */ });

        // ── 3) polling — 저장된 status만 신뢰. ready면 result_json 렌더, failed면 실패 UI. ──
        while (isActive()) {
          await sleep(POLL_INTERVAL_MS);
          if (!isActive()) return;
          let pollResp: Response;
          try {
            // cache-busting(&t=) + no-store — 폴링이 304로 떨어지면 상태를 못 읽는다.
            pollResp = await fetch(`/api/paid-job?id=${encodeURIComponent(jobId)}&t=${Date.now()}`, {
              method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal,
            });
          } catch { continue; /* 일시적 네트워크 오류 → 다음 폴링 */ }
          // 304가 오더라도(중간 프록시 등) 절대 fatal로 처리하지 않고 다음 폴링으로 넘어간다.
          if (pollResp.status === 304) { continue; }
          if (!pollResp.ok) { if (pollResp.status === 404) { finishError('job_not_found'); return; } continue; }
          const poll = await pollResp.json() as { status?: string; result_json?: unknown; error_json?: { error?: string; errorType?: string } };
          // eslint-disable-next-line no-console
          console.log('[paid-job] POLL status:', poll.status);
          if (poll.status === 'ready') {
            if (poll.result_json == null) { finishError('ready_without_result'); return; }
            renderStoredResult(poll.result_json);
            return;
          }
          if (poll.status === 'failed') {
            const et = poll.error_json?.errorType || poll.error_json?.error || 'failed';
            // 이미 permanent로 마킹된 job이면 재시도 화면 대신 영구 실패 화면.
            if (et === 'permanent_failed') {
              if (!isActive()) return;
              settled = true; lastFailedRef.current = true; window.clearTimeout(timeout);
              logPaidAnalysisFailed('permanent_failed'); setPhase('permanent_failed'); return;
            }
            finishError(`job_failed_${et}`);
            return;
          }
          // queued/processing → 계속 폴링.
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        finishError(e instanceof Error ? e.message : 'unknown');
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

  // ── 영구 실패(재시도 한도 초과) — 재시도 버튼 없음 ──
  if (phase === 'permanent_failed') {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-2xl" aria-hidden>🙏</p>
          <p className="text-base font-black text-slate-800">지금은 분석을 완성하지 못했어요</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            여러 번 시도했지만 리포트를 만들지 못했어요. 결제는 진행되지 않았어요.
            잠시 뒤 처음부터 다시 시도해 주시면 도움이 될 수 있어요.
          </p>
          <button type="button" onClick={() => { window.location.hash = '#paid-questions'; }}
            className="px-6 py-3 rounded-2xl text-white font-bold" style={{ background: PURPLE }}>
            심화 문항으로 가기 <span aria-hidden>→</span>
          </button>
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
