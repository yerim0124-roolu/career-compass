import { useEffect, useState } from 'react';
import type { ResultSpine, ActionReadiness, MoveRecommendation, MainTypeKey } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS, SUPPORT_TAG_LABELS } from '../../types/careerCompass.ts';
import { MAIN_TYPE_NARRATIVES } from '../../data/mainTypeNarratives.ts';
import { getExperimentJobHint } from '../../data/jobRoleExperimentHints.ts';
// 파스텔 인포그래픽 토큰 — 색에 '단일 의미'를 부여 (design-critique 권장 2).
//   progress(라벤더) = 강점·진행 / caution(피치) = 주의·부족 / done(민트) = 완료·안전 / neutral(회색)
const TONE = {
  progress: { bg: '#EEEBFE', fg: '#4338ca', bar: '#AFA9EC' },
  caution: { bg: '#FBEEE3', fg: '#b45309', bar: '#F5CDB3' },
  done: { bg: '#E4F5EC', fg: '#047857', bar: '#7FD0A8' },
  neutral: { bg: '#F1F5F9', fg: '#475569', bar: '#CBD5E1' },
} as const;

function StatCard({ tone, label, value }: { tone: keyof typeof TONE; label: string; value: string }) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl px-3.5 py-4" style={{ background: t.bg }}>
      <p className="text-[12px] font-bold opacity-90" style={{ color: t.fg }}>{label}</p>
      <p className="text-[15px] font-extrabold mt-1 leading-snug" style={{ color: t.fg }}>{value}</p>
    </div>
  );
}

// 단계 표시 (●●○) — high=3칸 채움(강점색), low=1칸(주의색). 가짜 % 대신 정직한 3단계.
function SignalDots({ level }: { level: 'high' | 'low' }) {
  const filled = level === 'high' ? 3 : 1;
  const color = level === 'high' ? TONE.progress.bar : TONE.caution.bar;
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < filled ? color : '#E2E8F0' }} />
      ))}
    </span>
  );
}

// 확신성 도넛 — 모인 근거(라벤더) + 30일 실험이 채울 몫(피치) + 남는 부분(회색)
function ConfidenceDonut({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = Math.max(Math.min(score, 100), 8);
  const expFill = Math.min(40, 100 - filled);
  // 색 의미 통일: 모인 근거=progress(라벤더), 실험이 채울 몫=done(민트, '채워질' 안전),
  // 남는 부분=neutral(회색). caution(피치)은 여기서 쓰지 않는다 — 부족/주의 전용이므로.
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
          {seg(100, 0, TONE.neutral.bg)}
          {seg(filled, 0, TONE.progress.bar)}
          {seg(expFill, filled, TONE.done.bar)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-black text-slate-800">{score}%</span>
          <span className="text-[10px] text-slate-500">근거 모임</span>
        </div>
      </div>
      <div className="text-[13px] text-slate-600 leading-relaxed space-y-0.5">
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle" style={{ background: TONE.progress.bar }} />지금까지 모인 근거 <b>{score}%</b></p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle" style={{ background: TONE.done.bar }} />30일 실험이 채울 몫</p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle border border-slate-200" style={{ background: TONE.neutral.bg }} />장기 확정에 남는 부분</p>
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
function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0 ? '을' : '를';
  return '을(를)';
}

interface Props {
  spine: ResultSpine;
  onRestart: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[19px] font-extrabold text-zinc-900 tracking-[-0.01em]">{title}</h2>
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
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-10">
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
          <div className="relative pt-3 mt-1 space-y-2.5 border-t border-white/20" aria-label="지금 상태 요약">
            <p className="text-[15px] font-bold text-white pt-3">
              {spine.profileContext.headline}
            </p>
            <p className="text-[14px] text-white/90 leading-[1.7] max-w-md mx-auto">
              {spine.profileContext.body}
            </p>
            {spine.profileContext.tags && spine.profileContext.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {spine.profileContext.tags.map((t) => (
                  <span key={t} className="text-[12px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 파스텔 스탯 카드 — P3.17: 결과 요약 3항목을 사용자가 가장 먼저 알고 싶은 순서로.
          '이번 달 실험'은 아직 구체 과제 전이라 이르다 → '검증할 방향'(strategicDirection)이 자연스럽다. */}
      {(() => {
        const dateMatch = spine.executionPlan.reevaluationDateLabel.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
        const reevalShort = dateMatch ? `${Number(dateMatch[2])}월 ${Number(dateMatch[3])}일` : '30일 후';
        const directionLabel = spine.strategicDirection?.label ?? spine.conditionalOption?.label;
        return (
          <div className="grid grid-cols-3 gap-3">
            {/* 색 의미: 현재 우선순위=done(민트), 검증할 방향=progress(라벤더), 판단 시점=neutral */}
            <StatCard tone="done" label="현재 우선순위" value={spine.currentBestMove.label} />
            <StatCard tone="progress" label={directionLabel ? '검증할 방향' : '이번 달 초점'} value={directionLabel ?? spine.solutionLayer.primaryModule.title} />
            <StatCard tone="neutral" label="판단 시점" value={`${reevalShort} 재평가`} />
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
          <section className="space-y-3">
            <h2 className="text-[19px] font-extrabold text-zinc-900 tracking-[-0.01em]">당신의 이야기</h2>
            {/* P3.11 — 카드 인플레이션 제거: 함정을 별도 박스에 가두지 않고 구분선 + 경고
                아이콘으로. 위계 점프(thesis 19 / 본문 16 / 함정 14)와 본문 대비 강화. */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-7 space-y-5">
              <p className="text-[19px] font-bold text-indigo-900 leading-[1.45] tracking-[-0.01em]">{story.thesis}</p>
              <p className="text-base text-zinc-800 leading-[1.8]">{story.arrival}</p>
              <div className="border-t border-zinc-100 pt-5 space-y-4">
                {story.traps.map((t) => (
                  <div key={t.title} className="flex gap-3">
                    <span className="text-amber-500 text-lg leading-tight shrink-0 mt-0.5" aria-hidden>⚠</span>
                    <div>
                      <p className="text-[15px] font-bold text-zinc-900 mb-0.5">{t.title.replace(/^함정 \d+ — /, '')}</p>
                      <p className="text-[15px] text-zinc-600 leading-[1.7]">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-base text-zinc-800 leading-[1.8] border-t border-zinc-100 pt-5">{story.meaning}</p>
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
            {/* P3.17 — 정보구조 재배열(왜→무엇→어떻게). '추천 솔루션'을 4요소로:
                ① 무엇(currentBestMove) ② 왜 지금(primaryModule) + 오해 방지(안전판≠소극적)
                ③ 이번 달엔 하지 말 것 ④ 성공하면 다음 선택지가 어떻게 바뀌나. */}
            {(() => {
              const mod = spine.solutionLayer.primaryModule;
              // ③ '하지 말 것' — resultMode별. 검증/회복 모드는 큰 결정 유예가 핵심.
              const dontDo = spine.resultMode === 'recovery_first'
                ? '퇴사·이직·확장 같은 큰 결정을 지금 내리지 마세요. 에너지부터 회복하는 편이 다음 선택의 성공률을 높여요.'
                : (ep.safetyBridge && ep.directionToValidate)
                  ? '퇴사·전환·확장 같은 큰 결정을 이번 달에 내리지 마세요. 지금의 핵심은 ‘결정’이 아니라 ‘증거 수집’이에요.'
                  : '조급하게 크게 벌이지 마세요. 작게 시작해 신호부터 확인하는 게 이번 달의 일이에요.';
              const promo = ep.promotionConditions[0];
              return (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-extrabold tracking-wide text-emerald-800">그래서, 지금 당신에게 필요한 솔루션</p>
                    <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full" title={ep.mainTypeLabel}>{mainTypeDisplayLabel}</span>
                  </div>

                  {/* ① 솔루션(심리적 처방)이 헤드라인 — '왜→무엇'의 무엇. 커리어 옵션보다 위. */}
                  <p className="text-[21px] font-extrabold text-zinc-900 leading-[1.4] tracking-[-0.01em]">{mod.title}</p>
                  <p className="text-[15px] font-bold text-emerald-800 leading-[1.6]">{mod.goal}</p>
                  <p className="text-[15px] text-zinc-700 leading-[1.75]">{mod.why}</p>

                  {/* ② 커리어적 권고 — 그 솔루션을 커리어 행동으로 옮기면 (currentBestMove) */}
                  <div className="border-t border-emerald-200/70 pt-3.5 space-y-2">
                    <p className="text-[11px] font-bold tracking-wide text-emerald-700">커리어적으로는</p>
                    <p className="text-[17px] font-extrabold text-zinc-900">{spine.currentBestMove.label}{objectParticle(spine.currentBestMove.label)} 추천해요</p>
                    <p className="text-[15px] text-zinc-700 leading-[1.75]">{spine.currentBestMove.rationale}</p>
                    {/* 오해 방지 — 안전판≠소극적 선택 */}
                    {ep.safetyBridge && ep.directionToValidate && (
                      <p className="text-[15px] text-zinc-700 leading-[1.75] bg-white/70 border border-emerald-100 rounded-xl px-4 py-3 mt-1">
                        즉, 지금의 선택은 <span className="font-bold">‘{ep.safetyBridge.label}에 머무르기’가 아니에요.</span> {ep.safetyBridge.label}을 안전판으로 두고, <span className="font-bold">{ep.directionToValidate.label}</span> 방향이 실제로 작동하는지 작게 검증하는 전략이에요.
                      </p>
                    )}
                  </div>

                  {/* ③ 하지 말 것 */}
                  <div className="border-t border-emerald-200/70 pt-3.5">
                    <p className="text-[11px] font-bold tracking-wide text-amber-700 mb-1">이번 달엔 이건 하지 마세요</p>
                    <p className="text-[14px] text-zinc-700 leading-[1.7]">{dontDo}</p>
                  </div>

                  {/* ④ 성공하면 다음 */}
                  {promo && (
                    <div className="border-t border-emerald-200/70 pt-3.5">
                      <p className="text-[11px] font-bold tracking-wide text-indigo-600 mb-1">검증에 성공하면</p>
                      <p className="text-[14px] text-zinc-700 leading-[1.7]">
                        {promo.conditions[0].condition}{promo.conditions.length > 1 ? ' 등' : ''}, 그러면 <span className="font-bold text-indigo-700">{promo.promoteToLabel}</span>{subjectParticle(promo.promoteToLabel)} 다음 1순위로 올라가요.
                      </p>
                    </div>
                  )}

                  {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {visibleTags.map((t) => (
                        <span key={t} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ⑤ 이번 달 핵심 실험 — 앞에서 맥락(진단·솔루션)을 만든 뒤 마지막에 '어떻게'.
                실험 라벨 + 목적 + 오늘 한 걸음 + 4주 흐름. */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 space-y-3">
              <p className="text-[11px] font-bold tracking-wide text-indigo-600">이번 달 핵심 실험</p>
              <p className="text-[18px] font-extrabold text-zinc-900 leading-[1.45]">{ep.coreExperiment.label}</p>
              {/* strategyStatement = 이번 달 전략 한 문장. 실험의 '목적'으로 둔다. */}
              <p className="text-[14px] text-zinc-600 leading-[1.7]">{ep.coreExperimentBridge ?? ep.strategyStatement}</p>
              {ep.coreExperimentBridge && (
                <p className="text-[13px] text-zinc-500 leading-[1.65]">{ep.strategyStatement}</p>
              )}
              {(() => {
                const hint = getExperimentJobHint(spine.profile, ep.coreExperiment.sourceOptionKey);
                return hint ? (
                  <p className="text-[15px] text-zinc-700 leading-[1.7] bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5">
                    <span className="text-[13px] font-bold text-emerald-800 mr-1.5">당신의 직무라면</span>{hint}
                  </p>
                ) : null;
              })()}
              <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-4 mt-1">
                <p className="text-[12px] font-bold tracking-wide text-indigo-700 mb-1.5">👉 이번 주, 딱 이거 하나</p>
                <p className="text-[17px] font-extrabold text-indigo-950 leading-[1.55]">{spine.solutionLayer.primaryModule.firstStep}</p>
                <details className="mt-3.5 pt-3 border-t border-indigo-200/70">
                  <summary className="text-[13px] font-bold text-indigo-700 cursor-pointer select-none">한 달 전체 흐름 보기</summary>
                  <ol className="mt-3">
                    {ep.weeklyActions.map((s, i) => (
                      <li key={i} className="relative pl-14 py-2.5">
                        <span className="absolute left-0 top-1.5 w-11 h-[26px] rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">{s.week}</span>
                        {i < ep.weeklyActions.length - 1 && (
                          <span aria-hidden className="absolute left-[21px] top-9 -bottom-1 w-0.5 bg-indigo-200" />
                        )}
                        <span className="text-[15px] text-zinc-800 leading-[1.7]">{s.action}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>

            {/* ④⑤ success / stop */}
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4">
                <p className="text-[13px] font-bold text-emerald-700 mb-2">잘되고 있다는 신호</p>
                <ul className="space-y-1.5">{ep.successSignals.map((x, i) => <li key={i} className="text-[15px] text-zinc-700 flex gap-2 leading-[1.6]"><span className="text-emerald-500 font-bold">·</span>{x}</li>)}</ul>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white px-5 py-4">
                <p className="text-[13px] font-bold text-amber-700 mb-2">멈추거나 바꿀 때</p>
                <ul className="space-y-1.5">{ep.stopOrPivotCriteria.map((x, i) => <li key={i} className="text-[15px] text-zinc-700 flex gap-2 leading-[1.6]"><span className="text-amber-500 font-bold">·</span>{x}</li>)}</ul>
              </div>
            </div>

            {/* ⑥ re-evaluation (absorbs 재판정) */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <p className="text-[17px] font-extrabold text-zinc-900 mb-2.5">{ep.reevaluationDateLabel}에 다시 보기</p>
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
                      <span className={reevalChecks[c] ? 'text-[15px] text-zinc-400 line-through leading-[1.6]' : 'text-[15px] text-zinc-700 leading-[1.6]'}>{c}</span>
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
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 space-y-4">
          {/* hero: counseling paragraph. Template renders first; the validated
              LLM rewrite (insight box + reinterpreted narrative) fades in over it. */}
          {llm && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3.5 space-y-1.5">
              <p className="text-[11px] font-bold text-indigo-600 tracking-wide">핵심 인사이트</p>
              <p className="text-[17px] font-bold text-indigo-950 leading-[1.55]">{llm.coreInsight}</p>
            </div>
          )}
          <p key={llm ? 'llm' : 'template'} className="text-base text-zinc-800 leading-[1.85] whitespace-pre-line animate-[fadeIn_0.5s_ease]">
            {llm ? llm.narrative : spine.evidence.narrative}
          </p>

          {/* actionable: what would raise confidence */}
          {spine.evidence.missingInformation.length > 0 && (
            <div className="border-t border-zinc-100 pt-3.5">
              <p className="text-[13px] font-bold text-zinc-500 mb-1.5">더 정확히 보려면</p>
              <ul className="space-y-1">
                {spine.evidence.missingInformation.map((m, i) => (
                  <li key={i} className="text-[14px] text-zinc-600 flex gap-2 leading-[1.6]"><span className="text-zinc-400">+</span>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* details kept below the main explanation — P3.10 재설계: 도넛 + 소프트 바 차트 */}
          <details className="border-t border-zinc-100 pt-3.5">
            <summary className="text-[15px] font-bold text-zinc-700 cursor-pointer select-none">근거 자세히 보기</summary>
            <div className="mt-4 space-y-6">
              {/* 판단 확실성 (본문에서 이동) — 도넛: 모인 근거 vs 실험이 채울 몫 */}
              <div>
                <p className="text-[14px] font-bold text-zinc-700 mb-1.5">장기 방향 근거, 얼마나 모였나</p>
                <ConfidenceDonut score={spine.evidence.confidenceScore} />
                <p className="text-[14px] text-zinc-600 mt-2">
                  <span className="font-semibold text-zinc-500 mr-1.5">실행 준비도</span>
                  <span className="font-bold text-zinc-800">{ACTION_READINESS_KO[spine.evidence.actionReadiness]}</span>
                </p>
              </div>

              {/* 심리 신호 — 정직한 3단계 점 표시(●●○). 엔진은 high/low 두 값만 주므로
                  연속 막대(78%/32%)는 없는 정밀도를 지어내는 셈 → 단계 표시로 교체. */}
              {spine.evidence.constructSignals.length > 0 && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2.5">심리 신호</p>
                  <div className="space-y-3">
                    {spine.evidence.constructSignals.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex-1 text-[14px] font-bold text-zinc-800">{s.humanLabel}</span>
                          <SignalDots level={s.level === 'high' ? 'high' : 'low'} />
                          <span className="w-9 shrink-0 text-right text-[12px] font-bold" style={{ color: s.level === 'high' ? TONE.progress.fg : TONE.caution.fg }}>
                            {s.level === 'high' ? '높음' : '낮음'}
                          </span>
                        </div>
                        <p className="text-[13px] text-zinc-500 leading-[1.6] mt-1">{s.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 확신을 움직인 것 — +/− 통합 리스트 */}
              {(spine.evidence.confidenceDrivers.raised.length > 0 || spine.evidence.confidenceDrivers.lowered.length > 0) && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2">확신을 움직인 것</p>
                  <ul className="space-y-1.5">
                    {spine.evidence.confidenceDrivers.raised.map((r, i) => (
                      <li key={`r${i}`} className="text-[14px] text-zinc-700 flex gap-2 leading-[1.55]"><span className="font-black text-emerald-500">+</span>{r}</li>
                    ))}
                    {spine.evidence.confidenceDrivers.lowered.map((r, i) => (
                      <li key={`l${i}`} className="text-[14px] text-zinc-700 flex gap-2 leading-[1.55]"><span className="font-black text-amber-500">−</span>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {spine.evidence.contextualBarriers.length > 0 && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2">현실 장벽</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spine.evidence.contextualBarriers.map((b, i) => (
                      <span key={i} className="text-[13px] font-medium px-2.5 py-1 rounded-full" style={{ background: TONE.caution.bg, color: TONE.caution.fg }}>{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* framework names live here only */}
          <details className="border-t border-zinc-100 pt-3.5">
            <summary className="text-[13px] font-semibold text-zinc-500 cursor-pointer select-none">이론적 근거 보기</summary>
            <p className="text-[13px] text-zinc-500 leading-[1.65] mt-2">{spine.evidence.theoryGroundedSummary}</p>
            {spine.evidence.constructSignals.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {spine.evidence.constructSignals.map((s, i) => (
                  <li key={i} className="text-[12px] text-zinc-400">{s.framework} · {s.construct} ({s.level === 'high' ? '높음' : '낮음'})</li>
                ))}
              </ul>
            )}
          </details>
        </div>
      </Section>

      {/* 다른 선택지 — option landscape. P3.12 (SAFE_DEFAULT_RESEARCH 적용):
          safe 옵션이 1순위일 때 이 섹션을 접힘 밖으로 꺼내 '다음 단계로 열어둘 길'로
          능동 제시한다. "이번 달은 안전하게, 끝" 이 아니라 "지금 X 하면서 이 방향들을
          동시에 준비"로 — 무행동(존버)이 아닌 복수 경로를 눈앞에 둔다. */}
      {(() => {
        const stratKey = spine.strategicDirection?.optionKey;
        const seen = new Set<string>([spine.currentBestMove.optionKey, ...(stratKey ? [stratKey] : [])]);
        const others: { tag: string; move: MoveRecommendation }[] = [];
        const add = (m: MoveRecommendation | null, tag: string) => { if (m && !seen.has(m.optionKey)) { others.push({ tag, move: m }); seen.add(m.optionKey); } };
        // strategicDirection(검증 중인 방향)도 '다음 단계' 후보로 포함
        if (spine.strategicDirection) others.push({ tag: '검증 중', move: spine.strategicDirection });
        add(spine.conditionalOption, '조건 충족 시');
        add(spine.prepareAfterOption, '준비 후');
        add(spine.pauseOption, '지금은 보류');

        const SAFE_NOW = new Set(['stayRedesign', 'jobChange', 'restRecover']);
        const safeLed = SAFE_NOW.has(spine.currentBestMove.optionKey) && others.length > 0;

        if (safeLed) {
          return (
            <Section title="다음 단계로 열어둘 길">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 px-5 py-4 space-y-3">
                <p className="text-[15px] text-zinc-700 leading-[1.7]">
                  이번 달은 <span className="font-bold text-zinc-900">{spine.currentBestMove.label}</span>로 안전하게 시작하되, 여기서 멈추는 게 아니에요. 같은 기간에 아래 방향들을 함께 준비해 두면 다음 결정이 훨씬 가벼워져요.
                </p>
                <ul className="space-y-2.5">
                  {others.map((it, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 text-[12px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full mt-0.5">{it.tag}</span>
                      <span className="text-[15px] text-zinc-700 leading-[1.65]"><span className="font-bold text-zinc-900">{it.move.label}</span> — {cleanRationale(it.move.rationale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          );
        }

        // 도전 옵션이 1순위면 기존처럼 접힘 (이미 플랜이 도전 행동을 담고 있으므로)
        const items = [{ tag: '지금의 선택', move: spine.currentBestMove }, ...others];
        return (
          <details className="rounded-2xl border border-zinc-200 bg-white p-4">
            <summary className="text-sm font-bold text-zinc-700 cursor-pointer select-none">다른 선택지도 함께 본 이유</summary>
            <p className="text-[13px] text-zinc-500 mt-2 leading-relaxed">이번 달 계획은 위 한 가지예요. 아래는 함께 검토한 선택지와 지금의 타이밍입니다.</p>
            <ul className="mt-2 space-y-2">
              {items.map((it, i) => (
                <li key={i} className="text-[14px] text-zinc-600 flex items-start gap-2 leading-[1.6]">
                  <span className="shrink-0 text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full mt-0.5">{it.tag}</span>
                  <span><span className="font-semibold text-zinc-800">{it.move.label}</span> — {cleanRationale(it.move.rationale)}</span>
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
