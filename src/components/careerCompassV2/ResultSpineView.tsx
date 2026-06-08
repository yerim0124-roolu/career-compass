import { useEffect, useState } from 'react';
import type { ResultSpine, ActionReadiness, MoveRecommendation, MainTypeKey } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS, SUPPORT_TAG_LABELS } from '../../types/careerCompass.ts';
import { MAIN_TYPE_NARRATIVES } from '../../data/mainTypeNarratives.ts';
import { getExperimentJobHint } from '../../data/jobRoleExperimentHints.ts';
import { CAREER_OPTION_LABELS } from '../../types/careerCompass.ts';

// 파스텔 인포그래픽 토큰 (레퍼런스: 소프트 파스텔 대시보드)
const PASTEL = {
  lavender: { bg: '#EEEBFE', fg: '#4338ca' },
  mint: { bg: '#E4F5EC', fg: '#047857' },
  peach: { bg: '#FBEEE3', fg: '#b45309' },
} as const;

function StatCard({ tone, icon, label, value }: { tone: keyof typeof PASTEL; icon: string; label: string; value: string }) {
  const t = PASTEL[tone];
  return (
    <div className="rounded-3xl px-3 py-4 text-center" style={{ background: t.bg }}>
      <div className="w-10 h-10 rounded-xl bg-white mx-auto mb-2 flex items-center justify-center text-lg" style={{ color: t.fg }} aria-hidden>
        {icon}
      </div>
      <p className="text-[11px] font-semibold opacity-75" style={{ color: t.fg }}>{label}</p>
      <p className="text-[15px] font-extrabold mt-0.5 leading-snug" style={{ color: t.fg }}>{value}</p>
    </div>
  );
}

// 확신성 도넛 — 모인 근거(라벤더) + 30일 실험이 채울 몫(피치) + 남는 부분(회색)
function ConfidenceDonut({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = Math.max(Math.min(score, 100), 8);
  const expFill = Math.min(40, 100 - filled);
  const seg = (pct: number, offsetPct: number, color: string) => (
    <circle
      r={r} cx={60} cy={60} fill="none" stroke={color} strokeWidth={16}
      strokeDasharray={`${(c * pct) / 100} ${c}`} strokeDashoffset={-(c * offsetPct) / 100}
      transform="rotate(-90 60 60)"
    />
  );
  return (
    <div className="flex gap-4 items-center py-1">
      <div className="relative w-[112px] h-[112px] shrink-0" role="img" aria-label={`장기 방향 근거가 ${score}% 모였어요`}>
        <svg viewBox="0 0 120 120" width="112" height="112">
          {seg(100, 0, '#f1f5f9')}
          {seg(filled, 0, '#AFA9EC')}
          {seg(expFill, filled, '#F5CDB3')}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-black text-slate-800">{score}%</span>
          <span className="text-[10px] text-slate-500">근거 모임</span>
        </div>
      </div>
      <div className="text-[13px] text-slate-600 leading-relaxed space-y-0.5">
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5" style={{ background: '#AFA9EC' }} />지금까지 모인 근거</p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5" style={{ background: '#F5CDB3' }} />30일 실험이 채울 몫</p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 border border-slate-200" style={{ background: '#f1f5f9' }} />장기 확정에 남는 부분</p>
      </div>
    </div>
  );
}

// P3.9 UI — display-only softening of judgment-flavored mainType labels.
// The canonical MAIN_TYPE_LABELS stay untouched (engine copy, analytics payloads,
// tests all keep reading them); this map only changes the badge the user sees.
// Burnout keeps its name — naming the exhaustion is empathic accuracy, not judgment.
const MAIN_TYPE_DISPLAY: Partial<Record<MainTypeKey, string>> = {
  plateauedPerformer: '도약 준비 성실형',   // was 정체된 성실형 — same diagnosis, forward frame
  scatteredExplorer: '폭넓은 탐색형',        // was 탐색 과잉형
  lowOptionVisibility: '선택지 발굴형',      // was 기회 탐색 부족형
  unvalidatedAspirant: '검증 전 도전형',     // was 시장 미검증 도전형
  restlessStabilizer: '안정 속 변화 모색형', // was 안정 속 권태형
};

// ADR-001 — LLM narrative layer client side. The deterministic template renders
// immediately (skeleton + permanent fallback); when /api/narrative responds with
// a validated rewrite, it fades in over the template. Identical answer sets hit
// a sessionStorage cache so re-opening the result doesn't re-call the API.
interface LlmNarrative { coreInsight: string; narrative: string; whyBullets: string[] }

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function useLlmNarrative(spine: ResultSpine): LlmNarrative | null {
  const [llm, setLlm] = useState<LlmNarrative | null>(null);
  const seed = spine.narrativeSeed;
  useEffect(() => {
    if (!seed) return;
    const body = JSON.stringify(seed);
    const cacheKey = `cc-llm-narrative-${hashString(body)}`;
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) { setLlm(JSON.parse(cached) as LlmNarrative); return; }
    } catch { /* noop */ }
    const ctrl = new AbortController();
    fetch('/api/narrative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((out: unknown) => {
        const o = out as LlmNarrative | null;
        if (o && typeof o.coreInsight === 'string' && typeof o.narrative === 'string' && Array.isArray(o.whyBullets)) {
          setLlm(o);
          try { window.sessionStorage.setItem(cacheKey, JSON.stringify(o)); } catch { /* noop */ }
        }
      })
      .catch(() => { /* template stays — that's the fallback */ });
    return () => ctrl.abort();
  }, [seed]);
  return llm;
}

// 30일 체크리스트 체크 상태 — 결과지를 다시 열었을 때 유지되도록 localStorage에 저장.
// 항목 텍스트를 키로 써서 플랜이 바뀌면 자연스럽게 초기화된 것처럼 보이게 한다.
const REEVAL_CHECKS_KEY = 'career-compass-reeval-checks-v1';
function loadReevalChecks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REEVAL_CHECKS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

const ACTION_READINESS_KO: Record<ActionReadiness, string> = {
  ready: '실행 준비됨',
  'explore-with-structure': '구조 있는 탐색',
  'stabilize-first': '기반 다지기 먼저',
};

// Natural Korean subject particle (이/가) based on whether the last syllable has a 받침.
function subjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0 ? '이' : '가';
  return '이(가)';
}

interface Props {
  spine: ResultSpine;
  onRestart: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[17px] font-extrabold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

// P3.9 UI — strip the engine's "blocker → consequence" arrow notation from rationales
// shown to users: the row's tag chip (조건 충족 시 / 지금은 보류 / 준비 후) already
// carries the consequence, so only the blocker clause renders.
function cleanRationale(r: string): string {
  const head = r.split('→')[0].trim().replace(/[,，]\s*$/, '');
  return /[.!?。]$/.test(head) ? head : `${head}.`;
}

export default function ResultSpineView({ spine, onRestart }: Props) {
  const llm = useLlmNarrative(spine);
  const [reevalChecks, setReevalChecks] = useState<Record<string, boolean>>(loadReevalChecks);
  const toggleReevalCheck = (item: string) => {
    setReevalChecks((prev) => {
      const next = { ...prev, [item]: !prev[item] };
      try { window.localStorage.setItem(REEVAL_CHECKS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };
  const mainTypeDisplayLabel =
    MAIN_TYPE_DISPLAY[spine.solutionLayer.mainTypeKey as MainTypeKey] ?? spine.executionPlan.mainTypeLabel;
  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
      {/* P3.9 UI — gradient identity hero: the result's visual payoff. Absorbs the
          P2.4 profile-context summary (headline/body/tags) so "이게 나" and "지금 상태"
          land in one block instead of a dashboard-style card stack. */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-700 px-7 py-10 text-center space-y-3.5 shadow-xl shadow-indigo-700/20">
        <div aria-hidden className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <p className="relative text-[11px] font-bold text-white/75 uppercase tracking-[0.14em]">당신의 중심축</p>
        <h1 className="relative text-2xl sm:text-3xl font-black text-white leading-snug">{spine.identityAxis.statement}</h1>
        {spine.identityAxis.archetypeTags.length > 0 && (
          <div className="relative flex flex-wrap justify-center gap-1.5 pt-0.5">
            {spine.identityAxis.archetypeTags.slice(0, 2).map((t) => (
              <span key={t} className="text-xs font-bold text-white bg-white/15 border border-white/30 px-3.5 py-1 rounded-full">
                {ARCHETYPE_LABELS[t]}
              </span>
            ))}
          </div>
        )}
        {spine.profileContext && (
          <div className="relative pt-2 space-y-2" aria-label="지금 상태 요약">
            <p className="text-[13px] font-semibold text-white/85">
              {spine.profileContext.headline}
            </p>
            <p className="text-xs text-white/70 leading-relaxed max-w-md mx-auto">
              {spine.profileContext.body}
            </p>
            {spine.profileContext.tags && spine.profileContext.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-0.5">
                {spine.profileContext.tags.map((t) => (
                  <span key={t} className="text-[11px] text-white/80 bg-white/12 px-2.5 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 파스텔 스탯 카드 — 결과의 세 가지 핵심 사실을 한 줄에 (레퍼런스 대시보드 문법) */}
      {(() => {
        const expKey = spine.executionPlan.coreExperiment.sourceOptionKey;
        const dateMatch = spine.executionPlan.reevaluationDateLabel.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
        const reevalShort = dateMatch ? `${Number(dateMatch[2])}월 ${Number(dateMatch[3])}일` : '30일 후';
        return (
          <div className="grid grid-cols-3 gap-3">
            <StatCard tone="lavender" icon="◉" label="지금의 선택" value={spine.currentBestMove.label} />
            <StatCard tone="mint" icon="⚑" label="이번 달 실험" value={CAREER_OPTION_LABELS[expKey] ?? spine.executionPlan.coreExperiment.label} />
            <StatCard tone="peach" icon="◔" label="다시 보는 날" value={reevalShort} />
          </div>
        );
      })()}

      {/* 당신의 이야기 — mainType 딥 서사 (정적 콘텐츠). 스토리 아크의 1막:
          유형 배지만 있고 해설이 없던 '분석 얇음'을 채우는 층. 플랜(그래서)보다
          먼저 와서 "왜 내 플랜이 이런 모양인지"의 복선이 된다. */}
      {(() => {
        const story = MAIN_TYPE_NARRATIVES[spine.solutionLayer.mainTypeKey as MainTypeKey];
        if (!story) return null;
        return (
          <section className="space-y-2.5">
            <h2 className="text-[17px] font-extrabold text-slate-900">당신의 이야기</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <p className="text-base font-bold text-indigo-700 leading-relaxed">{story.thesis}</p>
              <p className="text-base text-slate-700 leading-[1.75]">{story.arrival}</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {story.traps.map((t) => (
                  <div key={t.title} className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                    <p className="text-sm font-bold text-slate-800 mb-1">{t.title}</p>
                    <p className="text-sm text-slate-600 leading-[1.65]">{t.body}</p>
                  </div>
                ))}
              </div>
              <p className="text-base text-slate-700 leading-[1.75]">{story.meaning}</p>
            </div>
          </section>
        );
      })()}

      {/* 이번 달 실행 계획 — one merged plan (module + core experiment + reeval + safety bridge).
          Replaces the separate solution-module / 30일 실험 / 재판정 sections. */}
      {(() => {
        const ep = spine.executionPlan;
        // Recovery tag guard: when the move is to rest/recover, "시장 반응 확인 필요" is off-message
        // in the main tag row (the user shouldn't be told to validate a market while recovering).
        // It stays internally in solutionLayer.supportTags and in future-option context.
        const recoveryGuard = spine.solutionLayer.mainTypeKey === 'overloadedBurnout' || spine.currentBestMove.optionKey === 'restRecover';
        const visibleTags = recoveryGuard
          ? ep.supportTagLabels.filter((t) => t !== SUPPORT_TAG_LABELS.marketInsightGap)
          : ep.supportTagLabels;
        return (
          <section className="space-y-3">
            {/* ①+② merged — P3.9 UI: the old indigo strategy card and green experiment
                card said nearly the same thing back-to-back. One card now leads with the
                experiment (the page's second-biggest type), with the strategy statement
                as its supporting line. */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold tracking-wide text-emerald-700/90">이번 달 플랜 · 핵심 실험</p>
                {/* display label may be softened (MAIN_TYPE_DISPLAY); ep.mainTypeLabel stays canonical */}
                <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full" title={ep.mainTypeLabel}>{mainTypeDisplayLabel}</span>
              </div>
              {/* coreExperimentBridge는 결정-난도 유형에서 '플랜(기준 정리)'과 '실험(시장 반응)'이
                  서로 다른 줄기일 때 엔진이 세우는 다리다. 그 경우 실험 라벨을 헤드라인으로 올리면
                  주차별 행동과 충돌해 보이므로, 헤드라인은 전략 문장이 갖고 실험은 보조 블록으로 내린다. */}
              {ep.coreExperimentBridge ? (
                <>
                  <p className="text-[21px] font-extrabold text-slate-900 leading-snug">{ep.strategyStatement}</p>
                  <div className="rounded-xl bg-white/80 border border-emerald-100 px-3.5 py-2.5 space-y-1">
                    <p className="text-xs font-bold text-emerald-700">이번 달 핵심 실험 — 기준을 좁혀줄 데이터 수집</p>
                    <p className="text-[15px] font-bold text-slate-800 leading-snug">{ep.coreExperiment.label}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{ep.coreExperimentBridge}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[21px] font-extrabold text-slate-900 leading-snug">{ep.coreExperiment.label}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{ep.strategyStatement}</p>
                </>
              )}
              {ep.mainTypeContextNote && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/60 border border-slate-200/60 rounded-xl px-3 py-2">{ep.mainTypeContextNote}</p>
              )}
              {ep.safetyBridge && ep.directionToValidate && (
                <div className="mt-1 space-y-1.5 border-t border-emerald-200/70 pt-2.5">
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-500 mr-1.5">지금의 안전판</span><span className="text-base font-extrabold">{ep.safetyBridge.label}</span> — {ep.safetyBridge.why}</p>
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-500 mr-1.5">이번 달 검증할 방향</span><span className="text-base font-extrabold">{ep.directionToValidate.label}</span> <span className="text-xs font-bold text-indigo-600">{ep.directionToValidate.readinessLabel}</span></p>
                  <p className="text-xs text-slate-500 leading-relaxed">둘은 경쟁이 아니라 한 쌍이에요. 안전판으로 지금의 바닥을 지키면서, 이번 달 실험으로 방향을 검증합니다.</p>
                </div>
              )}
              {/* 직무별 소재 변형 — 고정 플랜 카피를 사용자 직무의 언어로 구체화.
                  직무 미상이면 일반론을 덧붙이지 않고 그냥 숨긴다. */}
              {(() => {
                const hint = getExperimentJobHint(spine.profile, ep.coreExperiment.sourceOptionKey);
                return hint ? (
                  <p className="text-sm text-slate-700 leading-relaxed bg-white/70 border border-emerald-100 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-emerald-700 mr-1.5">당신의 직무라면</span>{hint}
                  </p>
                ) : null;
              })()}
              {visibleTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {visibleTags.map((t) => (
                    <span key={t} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">#{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ③ week-by-week actions — 타임라인 스테퍼 (알약 배지 + 연결선) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">주차별 행동</p>
              <ol>
                {ep.weeklyActions.map((s, i) => (
                  <li key={i} className="relative pl-14 py-2.5">
                    <span className="absolute left-0 top-2 w-11 h-[26px] rounded-full bg-indigo-50 text-indigo-700 text-xs font-black flex items-center justify-center">{s.week}</span>
                    {i < ep.weeklyActions.length - 1 && (
                      <span aria-hidden className="absolute left-[21px] top-9 -bottom-1 w-0.5 bg-slate-200" />
                    )}
                    <span className="text-sm text-slate-700 leading-relaxed">{s.action}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* ④⑤ success / stop */}
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                <p className="text-xs font-semibold text-emerald-600 mb-1.5">잘되고 있다는 신호</p>
                <ul className="space-y-1">{ep.successSignals.map((x, i) => <li key={i} className="text-sm text-slate-600 flex gap-1.5"><span className="text-emerald-500">·</span>{x}</li>)}</ul>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold text-amber-600 mb-1.5">멈추거나 바꿀 때</p>
                <ul className="space-y-1">{ep.stopOrPivotCriteria.map((x, i) => <li key={i} className="text-sm text-slate-600 flex gap-1.5"><span className="text-amber-500">·</span>{x}</li>)}</ul>
              </div>
            </div>

            {/* ⑥ re-evaluation (absorbs 재판정) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[17px] font-extrabold text-slate-900 mb-2">{ep.reevaluationDateLabel}에 다시 보기</p>
              {/* real checkboxes (persisted) — the old decorative □ glyphs looked
                  interactive but weren't, which is an affordance lie */}
              <ul className="space-y-1.5">
                {ep.reevaluationChecklist.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!reevalChecks[c]}
                        onChange={() => toggleReevalCheck(c)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 cursor-pointer"
                      />
                      <span className={reevalChecks[c] ? 'text-slate-400 line-through leading-relaxed' : 'text-slate-600 leading-relaxed'}>{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {ep.secondaryModuleHint && (
              <p className="text-xs text-slate-500 px-1">{ep.secondaryModuleHint}</p>
            )}
          </section>
        );
      })()}

      {/* P3.10 — 사용자 피드백: 본문 위의 확실성·준비도 메타 지표가 흐름을 끊는다.
          본문은 상담 문단만 남기고, 지표(도넛·준비도·노트)는 '근거 자세히 보기'로 접어 넣는다. */}
      <Section title="왜 이 추천인가">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
          {/* hero: counseling paragraph. Template renders first; the validated
              LLM rewrite (insight box + reinterpreted narrative) fades in over it. */}
          {llm && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-1">
              <p className="text-[11px] font-bold text-indigo-600">핵심 인사이트</p>
              <p className="text-[15px] font-bold text-indigo-950 leading-relaxed">{llm.coreInsight}</p>
            </div>
          )}
          <p key={llm ? 'llm' : 'template'} className="text-base text-slate-800 leading-[1.75] whitespace-pre-line animate-[fadeIn_0.5s_ease]">
            {llm ? llm.narrative : spine.evidence.narrative}
          </p>

          {/* actionable: what would raise confidence */}
          {spine.evidence.missingInformation.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-400 mb-1">더 정확히 보려면</p>
              <ul className="space-y-1">
                {spine.evidence.missingInformation.map((m, i) => (
                  <li key={i} className="text-xs text-slate-500 flex gap-2"><span className="text-slate-400">+</span>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* details kept below the main explanation — P3.10 재설계: 도넛 + 소프트 바 차트 */}
          <details className="border-t border-slate-100 pt-3">
            <summary className="text-sm font-bold text-slate-600 cursor-pointer select-none">근거 자세히 보기</summary>
            <div className="mt-3 space-y-5">
              {/* 판단 확실성 (본문에서 이동) — 도넛: 모인 근거 vs 실험이 채울 몫 */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">장기 방향 근거, 얼마나 모였나</p>
                <ConfidenceDonut score={spine.evidence.confidenceScore} />
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{spine.evidence.confidenceNote}</p>
                <p className="text-xs text-slate-600 mt-1.5">
                  <span className="font-semibold text-slate-500 mr-1.5">실행 준비도</span>
                  <span className="font-bold text-slate-700">{ACTION_READINESS_KO[spine.evidence.actionReadiness]}</span>
                </p>
              </div>

              {/* 심리 신호 — 소프트 가로 바 (높음=라벤더 길게, 낮음=피치 짧게) */}
              {spine.evidence.constructSignals.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">심리 신호</p>
                  <div className="space-y-2.5">
                    {spine.evidence.constructSignals.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">{s.humanLabel}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: s.level === 'high' ? '78%' : '32%', background: s.level === 'high' ? '#AFA9EC' : '#F5CDB3' }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-[11px] font-bold" style={{ color: s.level === 'high' ? '#4338ca' : '#b45309' }}>
                            {s.level === 'high' ? '높음' : '낮음'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 ml-[9.625rem]">{s.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 확신을 움직인 것 — +/− 통합 리스트 */}
              {(spine.evidence.confidenceDrivers.raised.length > 0 || spine.evidence.confidenceDrivers.lowered.length > 0) && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1.5">확신을 움직인 것</p>
                  <ul className="space-y-1">
                    {spine.evidence.confidenceDrivers.raised.map((r, i) => (
                      <li key={`r${i}`} className="text-xs text-slate-600 flex gap-1.5"><span className="font-black text-emerald-500">+</span>{r}</li>
                    ))}
                    {spine.evidence.confidenceDrivers.lowered.map((r, i) => (
                      <li key={`l${i}`} className="text-xs text-slate-600 flex gap-1.5"><span className="font-black text-amber-500">−</span>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {spine.evidence.contextualBarriers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1.5">현실 장벽</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spine.evidence.contextualBarriers.map((b, i) => (
                      <span key={i} className="text-xs font-medium text-amber-800 px-2.5 py-1 rounded-full" style={{ background: '#FBEEE3' }}>{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* framework names live here only */}
          <details className="border-t border-slate-100 pt-3">
            <summary className="text-xs font-semibold text-slate-400 cursor-pointer select-none">이론적 근거 보기</summary>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2">{spine.evidence.theoryGroundedSummary}</p>
            {spine.evidence.constructSignals.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {spine.evidence.constructSignals.map((s, i) => (
                  <li key={i} className="text-[11px] text-slate-400">{s.framework} · {s.construct} ({s.level === 'high' ? '높음' : '낮음'})</li>
                ))}
              </ul>
            )}
          </details>
        </div>
      </Section>

      {/* 다른 선택지도 함께 본 이유 — option landscape, collapsed (no large repeat of the plan).
          The now-move/direction already live in the execution plan; this is the "why we also looked". */}
      {(() => {
        const stratKey = spine.strategicDirection?.optionKey;
        const seen = new Set<string>([spine.currentBestMove.optionKey, ...(stratKey ? [stratKey] : [])]);
        const items: { tag: string; move: MoveRecommendation }[] = [{ tag: '지금의 선택', move: spine.currentBestMove }];
        const add = (m: MoveRecommendation | null, tag: string) => { if (m && !seen.has(m.optionKey)) { items.push({ tag, move: m }); seen.add(m.optionKey); } };
        add(spine.prepareAfterOption, '준비 후');
        add(spine.conditionalOption, '조건 충족 시');
        add(spine.pauseOption, '지금은 보류');
        return (
          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="text-sm font-bold text-slate-700 cursor-pointer select-none">다른 선택지도 함께 본 이유</summary>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">이번 달 계획은 위 한 가지예요. 아래는 함께 검토한 선택지와 지금의 타이밍입니다.</p>
            <ul className="mt-2 space-y-2">
              {items.map((it, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="shrink-0 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">{it.tag}</span>
                  <span><span className="font-semibold text-slate-800">{it.move.label}</span> — {cleanRationale(it.move.rationale)}</span>
                </li>
              ))}
            </ul>
          </details>
        );
      })()}

      {/* 조건이 바뀌면 올라올 선택지 — promotion conditions only (contextual, ≤2), collapsed.
          Warnings are NOT repeated here; they live in the plan's 멈추거나 바꿀 때. */}
      {spine.executionPlan.promotionConditions.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="text-sm font-bold text-slate-700 cursor-pointer select-none">조건이 바뀌면 올라올 선택지</summary>
          <div className="mt-3 space-y-3">
            {spine.executionPlan.promotionConditions.map((rule, i) => (
              <div key={i}>
                <p className="text-sm text-slate-700">
                  {rule.conditions.length === 1 ? (
                    <>다음 조건이 충족되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라갑니다.</>
                  ) : (
                    <>아래 조건 중 <span className="font-bold text-indigo-600">{rule.ifMetCount}개 이상</span> 충족되면{' '}
                    <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라갑니다.</>
                  )}
                </p>
                <ul className="mt-1 space-y-1">
                  {rule.conditions.map((c, j) => (
                    <li key={j} className="text-sm text-slate-600 flex gap-2"><span className="text-indigo-400">·</span>{c.condition}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Optional saju/timing layer is intentionally hidden until implemented (placeholder removed
          from the main result to reduce clutter). optionalSajuLayer stays on the model for later. */}

      {/* Peak-End: the last substantive thing the user reads is the plan's affirming
          one-liner (mainType-aware closingLine), not the disclaimer. Moved here from
          the plan section so the page ends on permission, not hedging. */}
      {spine.executionPlan.closingLine && (
        <p className="pt-3 text-center text-[19px] font-extrabold text-slate-800 leading-relaxed px-4">
          {spine.executionPlan.closingLine}
        </p>
      )}

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-4"
        >
          처음부터 다시 하기
        </button>
      </div>
      {/* small but WCAG-readable (slate-500 ≥ 4.5:1 on white) */}
      <p className="text-center text-[11px] text-slate-500 leading-relaxed">
        본 결과는 현재 입력값 기준의 의사결정 참고용입니다. 조건이 바뀌면 결론도 달라질 수 있어요.
      </p>
    </div>
  );
}
