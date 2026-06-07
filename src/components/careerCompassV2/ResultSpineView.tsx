import { useState } from 'react';
import type { ResultSpine, ActionReadiness, ConfidenceBand, MoveRecommendation, MainTypeKey } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS, SUPPORT_TAG_LABELS } from '../../types/careerCompass.ts';

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

const BAND_COLOR: Record<ConfidenceBand, string> = {
  '낮음': 'text-slate-500',
  '중간': 'text-amber-600',
  '높음': 'text-indigo-600',
  '매우 높음': 'text-emerald-600',
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
              <p className="text-[21px] font-extrabold text-slate-900 leading-snug">{ep.coreExperiment.label}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{ep.strategyStatement}</p>
              {ep.mainTypeContextNote && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/60 border border-slate-200/60 rounded-xl px-3 py-2">{ep.mainTypeContextNote}</p>
              )}
              {ep.coreExperimentBridge && (
                <p className="text-xs text-emerald-800/80 leading-relaxed">{ep.coreExperimentBridge}</p>
              )}
              {ep.safetyBridge && ep.directionToValidate && (
                <div className="mt-1 space-y-1.5 border-t border-emerald-200/70 pt-2.5">
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-500 mr-1.5">지금의 안전판</span><span className="text-base font-extrabold">{ep.safetyBridge.label}</span> — {ep.safetyBridge.why}</p>
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-500 mr-1.5">이번 달 검증할 방향</span><span className="text-base font-extrabold">{ep.directionToValidate.label}</span> <span className="text-xs font-bold text-indigo-600">{ep.directionToValidate.readinessLabel}</span></p>
                  <p className="text-xs text-slate-500 leading-relaxed">둘은 경쟁이 아니라 한 쌍이에요. 안전판으로 지금의 바닥을 지키면서, 이번 달 실험으로 방향을 검증합니다.</p>
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

            {/* ③ week-by-week actions (module is the spine) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2">주차별 행동</p>
              <ol className="space-y-1.5">
                {ep.weeklyActions.map((s, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="shrink-0 text-[13px] font-black text-indigo-600 mt-0.5 w-11">{s.week}</span>
                    <span className="leading-relaxed">{s.action}</span>
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

      <Section title="왜 이 추천인가 · 판단 확실성">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
          {/* two distinct metrics: 실행 준비도 vs 판단 확실성.
              P3.9 UI — the "N점" score read like a report-card grade and contradicted the
              goal-gradient copy ("30일 실험이 채워 줍니다"). It now renders as an
              evidence-fill gauge: partially full, with the experiment as what fills the rest. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            <span className="text-sm">
              <span className="text-xs font-semibold text-slate-500 mr-1.5">실행 준비도</span>
              <span className="font-bold text-slate-700">{ACTION_READINESS_KO[spine.evidence.actionReadiness]}</span>
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">장기 방향 근거 모임 (판단 확실성)</span>
              <span className={`text-xs font-bold ${BAND_COLOR[spine.evidence.confidenceBand]}`}>{spine.evidence.confidenceBand}</span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={spine.evidence.confidenceScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="장기 방향 근거 수집 정도"
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.max(spine.evidence.confidenceScore, 6)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">남은 칸은 이번 달 30일 실험이 채워요.</p>
          </div>
          {/* what '판단 확실성' means (not capability, not safety) */}
          <p className="text-[11px] text-slate-500 leading-relaxed">{spine.evidence.confidenceNote}</p>

          {/* hero: connected counseling paragraph */}
          <p className="text-[15px] text-slate-800 leading-relaxed">{spine.evidence.narrative}</p>

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

          {/* details kept below the main explanation */}
          <details className="border-t border-slate-100 pt-3">
            <summary className="text-xs font-semibold text-slate-400 cursor-pointer select-none">근거 자세히 보기</summary>
            <div className="mt-3 space-y-3">
              {spine.evidence.constructSignals.length > 0 && (
                <div className="space-y-2">
                  {spine.evidence.constructSignals.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${s.level === 'high' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {s.humanLabel} {s.level === 'high' ? '↑' : '↓'}
                      </span>
                      <span className="text-sm text-slate-600 leading-relaxed">{s.note}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 mb-1">확신을 높인 것</p>
                  {spine.evidence.confidenceDrivers.raised.length > 0
                    ? <ul className="space-y-1">{spine.evidence.confidenceDrivers.raised.map((r, i) => <li key={i} className="text-xs text-slate-600">+ {r}</li>)}</ul>
                    : <p className="text-xs text-slate-300">—</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-600 mb-1">확신을 낮춘 것</p>
                  {spine.evidence.confidenceDrivers.lowered.length > 0
                    ? <ul className="space-y-1">{spine.evidence.confidenceDrivers.lowered.map((r, i) => <li key={i} className="text-xs text-slate-600">− {r}</li>)}</ul>
                    : <p className="text-xs text-slate-300">—</p>}
                </div>
              </div>
              {spine.evidence.contextualBarriers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1.5">현실 장벽</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spine.evidence.contextualBarriers.map((b, i) => (
                      <span key={i} className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{b}</span>
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
