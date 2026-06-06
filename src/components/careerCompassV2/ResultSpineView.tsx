import type { ResultSpine, ActionReadiness, ConfidenceBand, MoveRecommendation } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS, SUPPORT_TAG_LABELS } from '../../types/careerCompass.ts';

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
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

export default function ResultSpineView({ spine, onRestart }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
      {/* Identity axis — the hook (archetypes are secondary chips only) */}
      <header className="text-center space-y-3">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">당신의 중심축</p>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">{spine.identityAxis.statement}</h1>
        {/* archetype = secondary disposition tags; kept small/muted so the identity headline leads */}
        {spine.identityAxis.archetypeTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 pt-0.5">
            {spine.identityAxis.archetypeTags.slice(0, 2).map((t) => (
              <span key={t} className="text-[11px] text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-full">
                {ARCHETYPE_LABELS[t]}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* P2.4 — Profile context summary card (copy-only). Sits between the
          identity headline and the execution plan so the user reads "this is
          who I am right now" before "here's what to do". The shape is
          { headline: string, body: string, tags?: string[] } per the user
          spec; both headline and body always have content. Visually lighter
          than the main strategy block — soft slate border, no shadow, small
          leading text — to keep the strategy header dominant. */}
      {spine.profileContext && (
        <section
          aria-label="지금 상태 요약"
          className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3.5 space-y-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">현재 맥락 요약</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            {spine.profileContext.headline}
          </p>
          <p className="text-[13px] text-slate-600 leading-relaxed">
            {spine.profileContext.body}
          </p>
          {spine.profileContext.tags && spine.profileContext.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {spine.profileContext.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

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
            {/* ① strategy header — strategy statement is the framing; main type is only a small label */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">이번 달 실행 계획</p>
                <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{ep.mainTypeLabel}</span>
              </div>
              <p className="text-lg font-bold text-slate-900 leading-snug">{ep.strategyStatement}</p>
              {ep.mainTypeContextNote && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/60 border border-slate-200/60 rounded-xl px-3 py-2">{ep.mainTypeContextNote}</p>
              )}
              {visibleTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {visibleTags.map((t) => (
                    <span key={t} className="text-xs font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-full">#{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ② this month's core experiment (+ optional safety-bridge dual thread) */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-700/80">이번 달 핵심 실험</p>
              <p className="font-bold text-emerald-900 text-[15px]">{ep.coreExperiment.label}</p>
              {ep.coreExperimentBridge && (
                <p className="text-xs text-emerald-800/70 leading-relaxed">{ep.coreExperimentBridge}</p>
              )}
              {ep.safetyBridge && ep.directionToValidate && (
                <div className="mt-1 space-y-1.5 border-t border-emerald-200/70 pt-2.5">
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-400 mr-1.5">지금의 안전판</span><span className="font-bold">{ep.safetyBridge.label}</span> — {ep.safetyBridge.why}</p>
                  <p className="text-sm text-slate-700"><span className="text-xs font-semibold text-slate-400 mr-1.5">이번 달 검증할 방향</span><span className="font-bold">{ep.directionToValidate.label}</span> <span className="text-xs text-indigo-600">{ep.directionToValidate.readinessLabel}</span></p>
                  <p className="text-xs text-slate-500 leading-relaxed">둘은 경쟁이 아니라 한 쌍이에요. 안전판으로 지금의 바닥을 지키면서, 이번 달 실험으로 방향을 검증합니다.</p>
                </div>
              )}
            </div>

            {/* ③ week-by-week actions (module is the spine) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2">주차별 행동</p>
              <ol className="space-y-1.5">
                {ep.weeklyActions.map((s, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="shrink-0 text-xs font-bold text-indigo-500 mt-0.5 w-10">{s.week}</span>
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
              <p className="text-sm font-bold text-slate-700 mb-1.5">{ep.reevaluationDateLabel}에 다시 보기</p>
              <ul className="space-y-1.5">
                {ep.reevaluationChecklist.map((c, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-slate-400">□</span>{c}</li>
                ))}
              </ul>
            </div>

            {ep.secondaryModuleHint && (
              <p className="text-xs text-slate-400 px-1">{ep.secondaryModuleHint}</p>
            )}
          </section>
        );
      })()}

      <Section title="왜 이 추천인가 · 판단 확실성">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
          {/* two distinct metrics: 실행 준비도 vs 판단 확실성 */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            <span className="text-sm">
              <span className="text-xs font-semibold text-slate-400 mr-1.5">실행 준비도</span>
              <span className="font-bold text-slate-700">{ACTION_READINESS_KO[spine.evidence.actionReadiness]}</span>
            </span>
            <span className="text-sm">
              <span className="text-xs font-semibold text-slate-400 mr-1.5">판단 확실성</span>
              <span className={`font-bold ${BAND_COLOR[spine.evidence.confidenceBand]}`}>{spine.evidence.confidenceBand}</span>
              {spine.evidence.confidenceBand !== '낮음' && <span className="text-[11px] text-slate-400 ml-1">{spine.evidence.confidenceScore}점</span>}
            </span>
          </div>
          {/* what '판단 확실성' means (not capability, not safety) */}
          <p className="text-[11px] text-slate-400 leading-relaxed">{spine.evidence.confidenceNote}</p>

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
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">이번 달 계획은 위 한 가지예요. 아래는 함께 검토한 선택지와 지금의 타이밍입니다.</p>
            <ul className="mt-2 space-y-2">
              {items.map((it, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="shrink-0 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">{it.tag}</span>
                  <span><span className="font-semibold text-slate-800">{it.move.label}</span> — {it.move.rationale}</span>
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
        <p className="pt-3 text-center text-[15px] font-bold text-slate-800 leading-relaxed px-4">
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
      <p className="text-center text-[11px] text-slate-300 leading-relaxed">
        본 결과는 현재 입력값 기준의 의사결정 참고용입니다. 조건이 바뀌면 결론도 달라질 수 있어요.
      </p>
    </div>
  );
}
