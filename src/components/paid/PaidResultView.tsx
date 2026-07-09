// Career Compass — 유료 심화 분석 결과 화면 (#paid-result).
//
// [영속 job 방식] 브라우저는 Claude 실시간 생성에 의존하지 않는다. 대신:
//   1) POST /api/paid-job          — job 생성(queued). {jobId} 수신. (같은 입력이면 재사용, 새 job 금지)
//   2) POST /api/paid-analysis     — 워커 트리거(await하지 않음; 결과는 DB에 저장, idempotent).
//   3) GET  /api/paid-job?id=...   — polling. status=ready + result_json이면 무조건 렌더.
// [고객 재시도 금지] 결제 완료 고객 화면이므로 실패해도 재시도 버튼/자동 retry가 없다. 재시도는
//   운영자 영역(/api/paid-job-retry, ADMIN_RETRY_SECRET). 실패 시 안내 문구만 노출한다.
// 프론트는 Claude raw response를 직접 렌더하지 않는다(저장된 result_json만). API 키는 서버 전용.

import { useEffect, useRef, useState } from 'react';
import type { PaidAnswers } from './paidTypes.ts';
import { readFreeContext } from './freeContext.ts';
import { logPaidAnalysisFailed } from './paidAnalytics.ts';
import { validationErrors, normalizePaidResult, type PaidResult, type NarrativeSection, type ExperimentItem } from './resultValidation.ts';

interface Props {
  paidAnswers?: PaidAnswers | null;
}

type Phase = 'loading' | 'success' | 'error' | 'no_answers' | 'insufficient_input' | 'permanent_failed';

// GET /api/paid-job polling 응답 shape. result_json/quality/can_pay는 ready일 때 채워진다.
interface PollResponse {
  status?: 'queued' | 'processing' | 'ready' | 'failed' | string;
  result_json?: unknown;
  result?: unknown; // 별칭 방어
  quality?: { passed?: boolean; displayable?: boolean; repaired?: boolean; finalResultSource?: string; blockers?: string[]; warnings?: string[] } | null;
  can_pay?: boolean;
  payment_status?: string;
  retry_count?: number;
  error_json?: { error?: string; errorType?: string } | null;
}

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

// 명시적 ?paidJobId=<uuid>가 있으면 그 job을 '조회 전용'으로 연다(생성/실행 금지).
//   결제 1건 = job 1개 원칙: 일반 진입은 항상 새 job을 만들고, 재사용은 이 쿼리로만 허용한다.
//   hash 라우팅(#paid-result?paidJobId=...)과 일반 search(?paidJobId=...) 둘 다 지원.
function getPaidJobIdFromUrl(): string {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('paidJobId');
    if (fromSearch) return fromSearch.trim();
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex >= 0) {
      const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get('paidJobId');
      if (fromHash) return fromHash.trim();
    }
  } catch { /* URL 파싱 실패 무시 */ }
  return '';
}

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
  // ?paidJobId=<uuid> 조회 전용 진입은 paidAnswers 없이도 결과를 불러온다(문항 화면으로 안 보냄).
  const hasViewJobId = getPaidJobIdFromUrl() !== '';
  const [phase, setPhase] = useState<Phase>(paidAnswers || hasViewJobId ? 'loading' : 'no_answers');
  const [result, setResult] = useState<PaidResult | null>(null);
  // 실패 화면/복구 링크에 표시할 요청 ID(jobId). 생성/조회 시점에 채운다.
  const [jobIdForDisplay, setJobIdForDisplay] = useState('');
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

  // 늦게 도착한 stale 콜백을 무시하기 위한 실행 id.
  const runIdRef = useRef(0);

  // mount당 1회만 실행. ?paidJobId= 조회 전용이면 paidAnswers 없이도 진행한다.
  useEffect(() => {
    const paid = paidRef.current;
    const urlJobId = getPaidJobIdFromUrl();
    if (!paid && !urlJobId) { setPhase('no_answers'); return; }
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
      settled = true;
      window.clearTimeout(timeout);
      logPaidAnalysisFailed(reason);
      // eslint-disable-next-line no-console
      console.log('[paid-job] → error UI (reason:', reason, ')');
      setPhase('error');
    };
    const finishSuccess = (data: PaidResult) => {
      if (!isActive()) return;
      settled = true;
      window.clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.log('[paid-job] → success: 저장된 result_json 렌더');
      setResult(data);
      setPhase('success');
    };

    const timeout = window.setTimeout(() => { controller.abort(); finishError('timeout'); }, HARD_TIMEOUT_MS);
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

    // 저장된 ready job을 렌더한다. 서버가 이미 검증/quality gate를 통과시킨 결과이므로,
    // 프론트 validationErrors는 '경고'일 뿐 차단 사유가 아니다(shape 라운드트립 차이로 인한
    // false negative 방지). Hard fail은 아래만: result_json 없음 / quality.passed===false /
    // finalResultSource === full_fallback_used.
    // 결제 완료 사용자는 반드시 결과지를 받는다. result_json이 있으면 무조건 렌더한다.
    //   quality.passed가 false여도(내부 품질 지표) 렌더한다 — 사용자 차단용이 아니다.
    //   유일한 실패 사유: result_json 자체가 없음.
    const renderStoredResult = (poll: PollResponse): boolean => {
      const resultJson = poll.result_json ?? poll.result ?? null;
      try {
        if (!resultJson) throw new Error('ready_without_result_json');
        // normalize는 렌더 shape 보장용(배열/섹션 기본값 채움). 결과가 비어도 터지지 않게.
        const normalized = normalizePaidResult(resultJson);
        const warns = validationErrors(normalized);
        // eslint-disable-next-line no-console
        console.log('[paid-job] READY render | quality.passed:', poll.quality?.passed,
          '| repaired:', poll.quality?.repaired, '| can_pay:', poll.can_pay,
          '| finalSource:', poll.quality?.finalResultSource,
          '| validation warnings(non-blocking):', warns.length ? warns.join(', ') : 'none');
        finishSuccess(normalized as PaidResult);
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[paid-analysis] RENDER_READY_ERROR', {
          status: poll.status, hasResultJson: !!resultJson, quality: poll.quality, error,
        });
        finishError(error instanceof Error ? error.message : 'render_ready_error');
        return false;
      }
    };

    (async () => {
      try {
        // ── 1) job 확보 ──
        //   (a) ?paidJobId=<uuid> → 조회 전용: create/run 금지, GET polling만. (결제 후 결과 재열람 경로)
        //   (b) 일반 진입 → 항상 새 job 생성(결제 1건 = job 1개). 입력이 같아도 재사용하지 않는다.
        const viewJobId = getPaidJobIdFromUrl();
        let jobId = '';
        let viewOnly = false;
        if (viewJobId) {
          jobId = viewJobId; viewOnly = true;
          // eslint-disable-next-line no-console
          console.log('[paid-job] VIEW-ONLY paidJobId(조회만, 생성/실행 안 함):', jobId);
        } else {
          const p = paid!; // 이 분기(일반 진입)에서는 effect 진입 가드로 paid가 반드시 존재.
          const freeContext = readFreeContext();
          const clip60 = (v: string) => (v ? v.slice(0, 60).replace(/\n/g, ' ') : '(none)');
          const freeTextChars = freeContext.occupation.length + freeContext.userFreeText.length + p.trigger.length + p.flowMoment.length;
          const sentenceCount = countSentences(`${p.trigger}\n${p.flowMoment}\n${freeContext.userFreeText}`);
          const answerVals = Object.values(p).flatMap((v) => (Array.isArray(v) ? v : [v]));
          const answerCount = answerVals.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
          // eslint-disable-next-line no-console
          console.log('[paid-job] SEND | freeContext keys:', Object.keys(freeContext).join(','),
            '| paid.trigger len:', p.trigger.length, `"${clip60(p.trigger)}"`,
            '| paid.flowMoment len:', p.flowMoment.length, `"${clip60(p.flowMoment)}"`,
            '| freeTextChars:', freeTextChars, '| sentenceCount:', sentenceCount,
            '| candidateDirection:', p.candidateDirection, '| mustKeep:', p.mustKeep.join('/'));
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
          const createResp = await fetch('/api/paid-job', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ freeContext, paidAnswers: p }), signal: controller.signal,
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

        // 요청 ID + 복구 링크 확보(로그 + 화면 표시용). jobId가 있으면 이 URL로 언제든 결과 재열람 가능.
        setJobIdForDisplay(jobId);
        const recoveryUrl = `${window.location.origin}/?paidJobId=${jobId}`;
        // eslint-disable-next-line no-console
        console.log('[paid-job] jobId:', jobId, '| recovery URL:', recoveryUrl);

        // ── 2) 워커 트리거(idempotent) — 조회 전용 진입에서는 실행하지 않는다.
        //   run worker는 /api/paid-analysis (POST {jobId}). 이미 result_json이 있으면 서버가
        //   Claude를 재호출하지 않고 현재 상태만 반환한다(status가 queued일 때만 실제 생성).
        if (!viewOnly) {
          fetch('/api/paid-analysis', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId }), signal: controller.signal,
          }).catch(() => { /* fire-and-forget: 폴링이 실제 상태를 읽는다 */ });
        }

        // ── 3) polling — result_json이 status보다 우선. ──
        //   우선순위: (1) result_json/result 있으면 status 무관하게 무조건 렌더
        //            (2) 없고 failed면 실패 화면(요청 ID 표시)
        //            (3) 그 외(queued/processing/ready-without-result)면 계속 폴링
        //   POST /api/paid-analysis가 timeout/abort/network error여도 여기서 계속 폴링한다.
        while (isActive()) {
          await sleep(POLL_INTERVAL_MS);
          if (!isActive()) return;
          let pollResp: Response;
          try {
            // cache-busting(&t=) + no-store — 폴링이 304로 떨어지면 상태를 못 읽는다.
            pollResp = await fetch(`/api/paid-job?id=${encodeURIComponent(jobId)}&t=${Date.now()}`, {
              method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal,
            });
          } catch { continue; /* 일시적 네트워크 오류 → 다음 폴링(실패 확정 금지) */ }
          // 304가 오더라도(중간 프록시 등) 절대 fatal로 처리하지 않고 다음 폴링으로.
          if (pollResp.status === 304) { continue; }
          // 404만 확정 실패(job 자체가 없음). 5xx 등 나머지는 다음 폴링으로.
          if (!pollResp.ok) { if (pollResp.status === 404) { finishError('job_not_found'); return; } continue; }
          let poll: PollResponse;
          try { poll = await pollResp.json() as PollResponse; } catch { continue; }
          const storedResult = poll.result_json ?? poll.result ?? null;
          // eslint-disable-next-line no-console
          console.log('[paid-job] POLL status:', poll.status, '| hasResult:', storedResult != null, '| can_pay:', poll.can_pay);
          // (1) result_json이 있으면 status(ready/failed/processing)와 무관하게 무조건 렌더.
          if (storedResult != null) { renderStoredResult(poll); return; }
          // (2) result가 없고 failed면 실패 화면(요청 ID 포함).
          if (poll.status === 'failed') {
            const et = poll.error_json?.errorType || poll.error_json?.error || 'failed';
            finishError(`job_failed_${et}`);
            return;
          }
          // (3) queued/processing/기타 → 계속 폴링.
        }
      } catch (e) {
        // 예외가 나도 jobId가 있으면 실패로 확정하지 않는다(폴링 루프 밖의 드문 예외만 도달).
        if (controller.signal.aborted) return;
        finishError(e instanceof Error ? e.message : 'unknown');
      }
    })();

    // 언마운트 시: 이 실행을 stale로 만들고(runId 증가) 정리.
    return () => { runIdRef.current++; controller.abort(); window.clearTimeout(timeout); };
    // mount당 1회. 새로고침해도 재실행되며, 내부에서 기존 jobId를 재사용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {jobIdForDisplay && (
            <p className="text-[10px] text-slate-300 break-all mt-1">요청 ID: {jobIdForDisplay}</p>
          )}
        </div>
      </div>
    );
  }

  // ── 결과 생성 실패 — result_json이 정말 없을 때만(status failed && !result). 재시도 버튼 없음. ──
  //   result_json이 있으면 위 polling에서 무조건 렌더되므로 여기 오지 않는다.
  if (phase === 'error' || phase === 'permanent_failed' || !result) {
    return (
      <div className="min-h-dvh bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-2xl" aria-hidden>🙏</p>
          <p className="text-base font-black text-slate-800">결과 생성 중 문제가 발생했습니다</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            요청 ID를 보내주시면 확인 후 결과를 다시 제공해 드릴게요.
            결제 내역은 안전하게 보존되어 있습니다.
          </p>
          {jobIdForDisplay && (
            <div className="inline-block rounded-xl px-4 py-2.5 mt-1" style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}` }}>
              <p className="text-[11px] font-semibold text-slate-400">요청 ID</p>
              <p className="text-[13px] font-bold text-slate-700 break-all">{jobIdForDisplay}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 성공 (narrative report) ──
  const { summaryCard, currentPosition, whyNow, innerConflict, riskMap, transitionAssets,
    monthlyExperiment, futureMessage, ifTwoOrMoreYes, ifAllNo } = result;
  // optional 배열은 비어도 렌더가 터지지 않게 방어(normalize가 보장하지만 이중 안전장치).
  const sevenDayPlan = result.sevenDayPlan ?? [];
  const recheckCriteria = result.recheckCriteria ?? [];
  const experiments = monthlyExperiment?.experiments ?? [];

  // 방어: 필드가 없거나 null이어도 화면이 깨지지 않게 기본값 처리(렌더 차단 안 함).
  const EMPTY_SECTION: NarrativeSection = { title: '', body: '' };
  const sc = summaryCard ?? { coreNow: '', biggestRisk: '', dontDo: '', doThis: '', judgeBy: '' };
  const summaryRows: Array<{ label: string; value: string }> = [
    { label: '지금 핵심', value: sc.coreNow ?? '' },
    { label: '가장 큰 리스크', value: sc.biggestRisk ?? '' },
    { label: '지금 하지 말 것', value: sc.dontDo ?? '' },
    { label: '이번 달 할 것', value: sc.doThis ?? '' },
    { label: '30일 뒤 판단 기준', value: sc.judgeBy ?? '' },
  ].filter((r) => r.value);

  // 본문 = narrative 섹션들(긴 서사). 비어있는 섹션은 렌더에서 제외한다.
  const narrativeFlow: NarrativeSection[] = [currentPosition, whyNow, innerConflict, riskMap, transitionAssets]
    .map((s) => s ?? EMPTY_SECTION).filter((s) => (s.body ?? '').trim().length > 0);

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
          <h2 className="text-base font-black text-slate-800">【{monthlyExperiment?.title || '이번 달의 30일 실험'}】</h2>
          <p className="text-[15px] leading-[1.85] text-slate-700 whitespace-pre-line">{monthlyExperiment?.body}</p>
          <div className="space-y-4 pt-1">
            {experiments.map((exp, i) => (
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
        <NarrativeBlock s={futureMessage ?? EMPTY_SECTION} />

      </main>
    </div>
  );
}
