// Career Compass 3.0 — P3.0/P3.1 guided chat container.
//
// What this is:
//   • A guided, button-based chat UI that wraps the EXISTING profile +
//     question + result flow. There is NO free-text interpretation, NO LLM,
//     NO streaming. Every step is a tap or a single short text entry
//     (jobRoleRaw only).
//
// What this is NOT (deliberately, per P3.0 spec):
//   • Not an AI chatbot.
//   • Does not call any API / database / analytics / telemetry.
//   • Does not collect the 30-day follow-up.
//   • Does not modify FlowResponses / UserProfile / engine logic.
//
// Algorithm:
//   1. Walk a static `script` (built from chatFlow.buildChatScript()).
//   2. Render the answered portion of the script as alternating bot/user bubbles.
//   3. For the current step, render its message as a bot bubble + answer buttons
//      (or one text input for jobRoleRaw).
//   4. After the final step, compute the result via the existing
//      buildResultFromResponses() and render the spine as sequential bot bubbles.
//
// Profile derivation:
//   • Every profile commit runs normalizeProfile() eagerly so that jobRoleRaw
//     → jobRoleCategory/Subcategory/Secondary derivations stay in sync with
//     the V2 path (where normalizeProfile fires on every localStorage save).
//   • constraintTags uses the EXISTING applyConstraintTagToggle so `none`
//     exclusivity + cap rules are NOT duplicated here.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile, ResultSpine, QuestionStep } from '../../types/careerCompass.ts';
import type { FlowResponses, StepResponse2, PersistedSession } from '../careerCompassV2/session.ts';
import {
  buildResultFromResponses,
  normalizeProfile,
  applyConstraintTagToggle,
  parsePersistedSession,
} from '../careerCompassV2/session.ts';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import {
  buildChatScript,
  applyProfileAnswer,
  applyCappedToggle,
  optionLabelFor,
  multiLabelFor,
  isStepComplete,
  countAnswerSteps,
  answerStepsBefore,
} from '../../lib/chatFlow.ts';
import type { ChatStep } from '../../lib/chatFlow.ts';
import ChatMessage from './ChatMessage.tsx';
import ChatChoiceButton from './ChatChoiceButton.tsx';

// ─── localStorage shape parity with #v2 ────────────────────────────────────
// Per P3.2 spec ("Store the same session shape if the app currently stores
// session in localStorage"), we reuse the EXACT PersistedSession shape that
// V2 uses (responses + profile + done + profileDone + stepIndex). We store
// it under a CHAT-SPECIFIC key so that the chat and V2 sessions stay cleanly
// isolated — they're alternate UIs over the same engine, not a unified state.
// The shape itself is bit-identical, so parsePersistedSession can hydrate
// either payload interchangeably.
const CHAT_STORAGE_KEY = 'career-compass-chat-session-v1';

// MUST stay in sync with CareerCompassV2Page.tsx → STORAGE_KEY. Used only by
// the chat → V2 result bridge below (no other V2 state is touched). If V2 ever
// changes its key, change the literal here too.
const V2_STORAGE_KEY = 'career-compass-v2-session-v1';

// ─── Container ──────────────────────────────────────────────────────────────

type Phase = 'chat' | 'result';

// Pure helper: derive the chat cursor from persisted (responses, profile).
// Rule:
//   • If no main response has been recorded yet → still in profile section.
//     Land on the first profile step whose targetField is missing. If all
//     profile fields are filled, land on the first main step.
//   • If any main response exists → past profile. Land on the first main
//     step whose response is missing. If all main steps are answered, land
//     on the result_intro step.
export function deriveChatCursor(
  script: ReadonlyArray<ChatStep>,
  responses: FlowResponses,
  profile: UserProfile,
): number {
  const hasMain = Object.keys(responses).length > 0;
  if (!hasMain) {
    for (let i = 0; i < script.length; i++) {
      const s = script[i];
      if (s.phase !== 'profile') continue;
      if ((profile as Record<string, unknown>)[s.targetField] === undefined) return i;
    }
    const firstMain = script.findIndex((s) => s.phase === 'main');
    return firstMain >= 0 ? firstMain : 0;
  }
  for (let i = 0; i < script.length; i++) {
    const s = script[i];
    if (s.phase !== 'main') continue;
    if (!responses[s.questionId]) return i;
  }
  const ri = script.findIndex((s) => s.phase === 'result_intro');
  return ri >= 0 ? ri : script.length - 1;
}

// Pure helper: derive a V2-compatible stepIndex (highest answered index in
// CAREER_QUESTION_FLOW). Persisted alongside the chat session so the field
// stays meaningful even though the chat itself does not use it for routing.
function deriveV2StepIndex(responses: FlowResponses): number {
  let idx = 0;
  for (let i = 0; i < CAREER_QUESTION_FLOW.length; i++) {
    if (responses[CAREER_QUESTION_FLOW[i].id]) idx = i;
  }
  return idx;
}

// Index of the last profile step in the script — used to mark profileDone.
function lastProfileIndex(script: ReadonlyArray<ChatStep>): number {
  let last = -1;
  for (let i = 0; i < script.length; i++) if (script[i].phase === 'profile') last = i;
  return last;
}

function loadChatSession(script: ReadonlyArray<ChatStep>): {
  responses: FlowResponses;
  profile: UserProfile;
  done: boolean;
  profileDone: boolean;
  cursor: number;
} {
  if (typeof window === 'undefined') {
    return { responses: {}, profile: {}, done: false, profileDone: false, cursor: 0 };
  }
  const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
  // parsePersistedSession is the EXACT loader used by V2 — same shape, same
  // backward-compat heuristics, same normalizeProfile pipeline.
  const parsed = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
  const cursor = parsed.done
    ? script.length
    : deriveChatCursor(script, parsed.responses, parsed.profile);
  return {
    responses: parsed.responses,
    profile: parsed.profile,
    done: parsed.done,
    profileDone: parsed.profileDone,
    cursor,
  };
}

export default function GuidedChatView() {
  const script = useMemo(() => buildChatScript(), []);
  const totalAnswerSteps = useMemo(() => countAnswerSteps(script), [script]);
  const profileTail = useMemo(() => lastProfileIndex(script), [script]);

  // ─── State (hydrated from localStorage on mount) ─────────────────────────
  const initial = useMemo(() => loadChatSession(script), [script]);
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [responses, setResponses] = useState<FlowResponses>(initial.responses);
  const [cursor, setCursor] = useState(initial.cursor);
  // Accumulator for multi_select / ranking before "다음" / text-input draft.
  // Cleared on cursor advance.
  const [draft, setDraft] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>(initial.done ? 'result' : 'chat');

  // ─── Derived ──────────────────────────────────────────────────────────────
  const currentStep: ChatStep | undefined = script[cursor];
  const answeredCount = answerStepsBefore(script, cursor);

  // Result spine — only built once we've walked off the end of the chat.
  // Uses the EXISTING entry point. Profile is normalized one more time at the
  // engine boundary (buildResultFromResponses → normalizeProfile), but we've
  // already normalized eagerly on every commit so this is idempotent.
  const spine: ResultSpine | null = useMemo(() => {
    if (phase !== 'result') return null;
    return buildResultFromResponses(responses, { profile });
  }, [phase, responses, profile]);

  // ─── Auto-scroll on cursor / phase changes ───────────────────────────────
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [cursor, phase]);

  // ─── Persist on every state change ───────────────────────────────────────
  // Same PersistedSession shape as #v2; chat-specific key. profileDone goes
  // true once the cursor has stepped off the last profile step OR the user
  // has reached the result. done is true at the result reveal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = phase === 'result';
    const profileDone = done || cursor > profileTail;
    const session: PersistedSession = {
      stepIndex: deriveV2StepIndex(responses),
      responses,
      profile,
      done,
      profileDone,
    };
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // localStorage full / blocked — fail silently, chat still works.
    }
  }, [responses, profile, phase, cursor, profileTail]);

  // ─── Advance helpers ─────────────────────────────────────────────────────
  const goNext = () => {
    setDraft([]);
    setCursor((c) => {
      const next = c + 1;
      if (next >= script.length) {
        setPhase('result');
        return c;
      }
      return next;
    });
  };

  const restart = () => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* noop */ }
    }
    setResponses({});
    setProfile({});
    setDraft([]);
    setCursor(0);
    setPhase('chat');
  };

  // Eager normalize wrapper: every time profile changes via this setter,
  // run the existing normalizeProfile so jobRoleRaw → jobRoleCategory et al.
  // is derived immediately. Mirrors V2's localStorage-save normalization.
  const commitProfile = (next: UserProfile) => {
    setProfile(normalizeProfile(next));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar
        progressNow={phase === 'result' ? totalAnswerSteps : answeredCount}
        progressTotal={totalAnswerSteps}
        onRestart={restart}
      />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-5 pb-10 space-y-3">
        <TranscriptHistory
          script={script}
          cursor={cursor}
          responses={responses}
          profile={profile}
        />

        {phase === 'chat' && currentStep && (
          <ActiveStep
            step={currentStep}
            draft={draft}
            setDraft={setDraft}
            profile={profile}
            commitProfile={commitProfile}
            responses={responses}
            setResponses={setResponses}
            onAdvance={goNext}
          />
        )}

        {phase === 'result' && spine && (
          <ResultBubbles
            spine={spine}
            onRestart={restart}
            onOpenV2Result={() => bridgeToV2(responses, profile)}
          />
        )}

        <div ref={bottomRef} />
      </main>
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────

function TopBar({
  progressNow,
  progressTotal,
  onRestart,
}: {
  progressNow: number;
  progressTotal: number;
  onRestart: () => void;
}) {
  const pct = progressTotal > 0 ? Math.min(100, Math.round((progressNow / progressTotal) * 100)) : 0;
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-black text-indigo-700 text-sm">
          <span aria-hidden>🧭</span> Career Compass <span className="text-slate-300 font-bold">chat</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            {progressNow} / {progressTotal}
          </span>
          <button
            type="button"
            onClick={() => { window.location.hash = '#v2'; }}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            기존 버전 →
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            다시
          </button>
        </div>
      </div>
      <div className="h-0.5 w-full bg-slate-100">
        <div className="h-0.5 bg-indigo-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

// ─── Transcript renderer (answered portion of the script) ──────────────────

function TranscriptHistory({
  script,
  cursor,
  responses,
  profile,
}: {
  script: ReadonlyArray<ChatStep>;
  cursor: number;
  responses: FlowResponses;
  profile: UserProfile;
}) {
  const bubbles: React.ReactNode[] = [];
  for (let i = 0; i < cursor && i < script.length; i++) {
    const s = script[i];
    if (s.phase === 'result_intro') {
      bubbles.push(<ChatMessage key={`b-${s.id}`} variant="bot">{s.message}</ChatMessage>);
      continue;
    }
    if (s.phase === 'profile') {
      bubbles.push(<ChatMessage key={`bp-${s.id}`} variant="bot">{s.message}</ChatMessage>);
      const userLabel = renderProfileAnswer(s, profile);
      if (userLabel !== null) {
        bubbles.push(<ChatMessage key={`up-${s.id}`} variant="user">{userLabel}</ChatMessage>);
      }
      continue;
    }
    // main
    bubbles.push(<ChatMessage key={`bf-${s.id}`} variant="bot">{s.message}</ChatMessage>);
    const userLabel = renderMainAnswer(s, responses[s.questionId]);
    if (userLabel !== null) {
      bubbles.push(<ChatMessage key={`uf-${s.id}`} variant="user">{userLabel}</ChatMessage>);
    }
  }
  return <>{bubbles}</>;
}

function renderProfileAnswer(
  step: Extract<ChatStep, { phase: 'profile' }>,
  profile: UserProfile,
): string | null {
  const value = (profile as Record<string, unknown>)[step.targetField];
  if (value === undefined) return '건너뜀';
  if (step.answerType === 'text') {
    return typeof value === 'string' && value.length > 0 ? value : '건너뜀';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '건너뜀';
    return multiLabelFor(step, value as string[]);
  }
  return optionLabelFor(step, value as string);
}

function renderMainAnswer(
  step: Extract<ChatStep, { phase: 'main' }>,
  r: StepResponse2 | undefined,
): string | null {
  if (!r) return '건너뜀';
  const underlying = CAREER_QUESTION_FLOW.find((q) => q.id === step.questionId);
  if (underlying?.inputType === 'ranking') {
    const ranking = r.ranking ?? [];
    if (ranking.length === 0) return '건너뜀';
    return ranking.map((v, i) => `${i + 1}. ${optionLabelFor(step, v)}`).join(' / ');
  }
  const ids = r.selectedOptionIds ?? [];
  if (ids.length === 0) return '건너뜀';
  return ids.map((v) => optionLabelFor(step, v)).join(', ');
}

// ─── Active step renderer ───────────────────────────────────────────────────

interface ActiveStepProps {
  step: ChatStep;
  draft: string[];
  setDraft: (next: string[]) => void;
  profile: UserProfile;
  commitProfile: (next: UserProfile) => void;
  responses: FlowResponses;
  setResponses: (next: FlowResponses) => void;
  onAdvance: () => void;
}

function ActiveStep(props: ActiveStepProps) {
  const { step } = props;
  if (step.phase === 'result_intro') return <ResultIntroStepView {...props} step={step} />;
  if (step.phase === 'profile') return <ProfileStepView {...props} step={step} />;
  return <MainStepView {...props} step={step} />;
}

// ── result_intro (narration bubble + continue) ──────────────────────────────
function ResultIntroStepView({
  step, onAdvance,
}: ActiveStepProps & { step: Extract<ChatStep, { phase: 'result_intro' }> }) {
  return (
    <>
      <ChatMessage variant="bot">{step.message}</ChatMessage>
      <div className="pt-2 space-y-2">
        <ChatChoiceButton variant="cta" label="결과 보기" onClick={onAdvance} />
      </div>
    </>
  );
}

// ── profile step (single_select | multi_select | text) ─────────────────────
function ProfileStepView({
  step, draft, setDraft, profile, commitProfile, onAdvance,
}: ActiveStepProps & { step: Extract<ChatStep, { phase: 'profile' }> }) {

  // Seed the draft from the current profile value when this step becomes active.
  useEffect(() => {
    const v = (profile as Record<string, unknown>)[step.targetField];
    if (Array.isArray(v)) setDraft(v as string[]);
    else if (typeof v === 'string') setDraft([v]);
    else setDraft([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const commit = (values: string[]) => {
    const next = applyProfileAnswer(profile, step, values);
    commitProfile(next);
    onAdvance();
  };

  const skip = () => {
    // Skipping clears any prior value on this field (chat is forward-only MVP).
    commit([]);
  };

  // ── text input branch (jobRoleRaw) ───────────────────────────────────────
  if (step.answerType === 'text') {
    return (
      <>
        <ChatMessage variant="bot">{step.message}</ChatMessage>
        <div className="pt-2 space-y-2">
          <textarea
            value={draft[0] ?? ''}
            onChange={(e) => setDraft([e.target.value])}
            placeholder={step.placeholder ?? ''}
            rows={1}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
          />
          <div className="flex gap-2">
            <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
            <ChatChoiceButton variant="cta" label="다음" onClick={() => commit(draft)} />
          </div>
        </div>
      </>
    );
  }

  // ── single_select ────────────────────────────────────────────────────────
  if (step.answerType === 'single_select') {
    return (
      <>
        <ChatMessage variant="bot">{step.message}</ChatMessage>
        <div className="pt-2 space-y-2">
          {(step.options ?? []).map((opt) => (
            <ChatChoiceButton
              key={opt.value}
              label={opt.label}
              onClick={() => commit([opt.value])}
            />
          ))}
          <div className="pt-1">
            <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
          </div>
        </div>
      </>
    );
  }

  // ── multi_select (with optional cap + optional `none` exclusivity) ───────
  const max = step.maxSelect; // typically 2 for concern/constraint/desired
  const useNoneRule = step.noneExclusive === true;

  // Toggle handler.
  //   • constraintTags  → applyConstraintTagToggle (session.ts) preserves the
  //     existing `none`-exclusive + cap rules.
  //   • concernTags / desiredPaths → applyCappedToggle (chatFlow.ts) enforces
  //     the simple max-N rule.
  // Neither path duplicates engine logic; both helpers are pure + headlessly
  // tested.
  const toggle = (value: string) => {
    if (useNoneRule) {
      const next =
        applyConstraintTagToggle(
          draft as Parameters<typeof applyConstraintTagToggle>[0],
          value as Parameters<typeof applyConstraintTagToggle>[1],
        ) ?? [];
      setDraft([...next]);
      return;
    }
    setDraft(applyCappedToggle(draft, value, max));
  };

  const helperText = max !== undefined ? `최대 ${max}개 선택` : '여러 개 선택 가능';
  const noneSelected = useNoneRule && draft.includes('none');

  return (
    <>
      <ChatMessage variant="bot">{step.message}</ChatMessage>
      <p className="text-[11px] text-slate-400 pl-1">{helperText}</p>
      <div className="pt-1 space-y-2">
        {(step.options ?? []).map((opt) => {
          const selected = draft.includes(opt.value);
          // Disabled condition:
          //   • For noneExclusive: when `none` is on, every other option dims.
          //     When any real option is on, `none` dims.
          //   • For plain cap: at cap, unselected options dim.
          let disabled = false;
          if (useNoneRule) {
            if (noneSelected && opt.value !== 'none') disabled = !selected;
            else if (!noneSelected && draft.length > 0 && opt.value === 'none') disabled = !selected;
            else if (max !== undefined && opt.value !== 'none'
                     && !selected
                     && draft.filter((d) => d !== 'none').length >= max) disabled = true;
          } else if (max !== undefined && !selected && draft.length >= max) {
            disabled = true;
          }
          return (
            <ChatChoiceButton
              key={opt.value}
              label={opt.label}
              selected={selected}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
            />
          );
        })}
        <div className="flex gap-2 pt-1">
          <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
          <ChatChoiceButton
            variant="cta"
            label={draft.length === 0 ? '없이 계속' : `다음 (${draft.length}개)`}
            onClick={() => commit(draft)}
          />
        </div>
      </div>
    </>
  );
}

// ── main step (single_select / multi_select / ranking detected via underlying) ──
function MainStepView({
  step, draft, setDraft, responses, setResponses, onAdvance,
}: ActiveStepProps & { step: Extract<ChatStep, { phase: 'main' }> }) {

  // Look up the underlying CAREER_QUESTION_FLOW step. Needed to:
  //   • detect ranking inputType
  //   • read min/max select rules verbatim from the existing data
  const underlying = useMemo<QuestionStep | undefined>(
    () => CAREER_QUESTION_FLOW.find((q) => q.id === step.questionId),
    [step.questionId],
  );

  const setForStep = (v: StepResponse2) => setResponses({ ...responses, [step.questionId]: v });

  // Seed the draft when the active main step changes.
  useEffect(() => {
    const r = responses[step.questionId];
    if (!r) { setDraft([]); return; }
    if (underlying?.inputType === 'ranking') setDraft(r.ranking ?? []);
    else setDraft(r.selectedOptionIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // ─── single_select / forced_choice → tap to advance ──────────────────────
  if (step.answerType === 'single_select') {
    return (
      <>
        <ChatMessage variant="bot">{step.message}</ChatMessage>
        <div className="pt-2 space-y-2">
          {step.options.map((opt) => {
            const desc = underlying?.options?.find((o) => o.id === opt.value)?.description;
            return (
              <ChatChoiceButton
                key={opt.value}
                label={opt.label}
                description={desc}
                onClick={() => {
                  setForStep({ selectedOptionIds: [opt.value] });
                  onAdvance();
                }}
              />
            );
          })}
        </div>
      </>
    );
  }

  // ─── ranking (cv_priorities) — detected via underlying inputType ─────────
  if (underlying?.inputType === 'ranking') {
    const min = underlying.minSelect ?? 3;
    const max = underlying.maxSelect ?? step.options.length;
    const canAdvance = draft.length >= min;
    return (
      <>
        <ChatMessage variant="bot">{step.message}</ChatMessage>
        <p className="text-[11px] text-slate-400 pl-1">
          위에 둘수록 가중치가 커져요. 최소 {min}개, 최대 {max}개. 위에서부터 순서대로 골라주세요.
        </p>
        <div className="pt-1 space-y-2">
          {step.options.map((opt) => {
            const idx = draft.indexOf(opt.value);
            const selected = idx >= 0;
            const atCap = !selected && draft.length >= max;
            const desc = underlying.options?.find((o) => o.id === opt.value)?.description;
            return (
              <ChatChoiceButton
                key={opt.value}
                label={opt.label}
                description={desc}
                selected={selected}
                rankBadge={selected ? idx + 1 : undefined}
                disabled={atCap}
                onClick={() => {
                  if (selected) setDraft(draft.filter((d) => d !== opt.value));
                  else if (!atCap) setDraft([...draft, opt.value]);
                }}
              />
            );
          })}
          <div className="flex gap-2 pt-1">
            {draft.length > 0 && (
              <ChatChoiceButton
                variant="ghost"
                label="마지막 취소"
                onClick={() => setDraft(draft.slice(0, -1))}
              />
            )}
            <ChatChoiceButton
              variant="cta"
              label={canAdvance ? `다음 (${draft.length}개 정렬됨)` : `최소 ${min}개 필요 (${draft.length})`}
              disabled={!canAdvance}
              onClick={() => {
                setForStep({ ranking: [...draft] });
                onAdvance();
              }}
            />
          </div>
        </div>
      </>
    );
  }

  // ─── multi_select (non-ranking) — accumulate + "다음" ────────────────────
  const min = underlying?.minSelect ?? 1;
  const max = underlying?.maxSelect;
  const canAdvance = underlying ? isStepComplete(underlying, { selectedOptionIds: draft }) : draft.length >= min;
  const helper = max !== undefined ? `${min}~${max}개 선택` : `최소 ${min}개 선택`;
  return (
    <>
      <ChatMessage variant="bot">{step.message}</ChatMessage>
      <p className="text-[11px] text-slate-400 pl-1">{helper}</p>
      <div className="pt-1 space-y-2">
        {step.options.map((opt) => {
          const selected = draft.includes(opt.value);
          const atCap = max !== undefined && !selected && draft.length >= max;
          const desc = underlying?.options?.find((o) => o.id === opt.value)?.description;
          return (
            <ChatChoiceButton
              key={opt.value}
              label={opt.label}
              description={desc}
              selected={selected}
              disabled={atCap}
              onClick={() => {
                if (selected) setDraft(draft.filter((d) => d !== opt.value));
                else if (!atCap) setDraft([...draft, opt.value]);
              }}
            />
          );
        })}
        <div className="pt-1">
          <ChatChoiceButton
            variant="cta"
            label={`다음 (${draft.length}개 선택)`}
            disabled={!canAdvance}
            onClick={() => {
              setForStep({ selectedOptionIds: [...draft] });
              onAdvance();
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Chat → V2 result bridge ────────────────────────────────────────────────
// When the user taps "기존 카드형 결과 보기", mirror the current chat session
// into V2's localStorage key (marking done=true so V2 lands directly on its
// result view) and then navigate to #v2. The chat session itself remains
// intact under CHAT_STORAGE_KEY so returning to #chat resumes the chat.
//
// V2 reads its key via parsePersistedSession (the SAME parser we use), so the
// shape parity established in P3.2 is what makes this bridge a one-liner.
//
// This bridge does NOT modify V2 routing, V2 components, executionPlan,
// profileContextSummary, or any engine code.
function bridgeToV2(responses: FlowResponses, profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  const v2Session: PersistedSession = {
    stepIndex: deriveV2StepIndex(responses),
    responses,
    profile,
    done: true,
    profileDone: true,
  };
  try {
    window.localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(v2Session));
  } catch {
    // localStorage full / blocked — V2 may show profile form on landing.
    // The navigation still happens so the user isn't stuck.
  }
  window.location.hash = '#v2';
}

// ─── Result bubbles ─────────────────────────────────────────────────────────
// Sequence per user spec (P3.3):
//   1. "결과를 정리해볼게요."
//   2. identityStatement
//   3. profileContext (headline / body / tags) — if present
//   4. strategyStatement
//   5. coreExperimentLabel
//   6. weeklyActions
//   7. successSignals
//   8. stopOrPivotCriteria
//   9. reevaluationChecklist
//   10. closingLine
//
// All content comes from the existing ResultSpine — NO copy is regenerated.
// Each section renders as one card/message bubble for mobile readability.
// A minimal CSS-only stagger (100 ms / step) gives a gentle chat reveal
// without competing with readability — no streaming, no setTimeout, no
// token-by-token. The user can read each card the moment it's visible.
function ResultBubbles({
  spine,
  onRestart,
  onOpenV2Result,
}: {
  spine: ResultSpine;
  onRestart: () => void;
  onOpenV2Result: () => void;
}) {
  const ep = spine.executionPlan;
  const [linkCopied, setLinkCopied] = useState(false);

  const copyShareLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions). Fail silently —
      // share is an optional convenience per the spec.
    }
  };

  // Assemble the bubble list in spec order. Empty arrays just skip cleanly
  // so a sparse spine doesn't render empty cards. profileContext is omitted
  // entirely when the engine returns no summary.
  const bubbles: Array<{ key: string; node: React.ReactNode }> = [];
  bubbles.push({
    key: 'intro',
    node: <ChatMessage variant="bot">결과를 정리해볼게요.</ChatMessage>,
  });
  bubbles.push({
    key: 'identity',
    node: (
      <ChatMessage variant="bot" eyebrow="지금의 정체성">
        {spine.identityAxis.statement}
      </ChatMessage>
    ),
  });
  if (spine.profileContext) {
    const pc = spine.profileContext;
    bubbles.push({
      key: 'profileContext',
      node: (
        <ChatMessage variant="bot" eyebrow={pc.headline}>
          {pc.body}
          {pc.tags && pc.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pc.tags.map((t, i) => (
                <span
                  key={i}
                  className="text-[11px] font-medium text-slate-600 bg-white/70 border border-slate-200 px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </ChatMessage>
      ),
    });
  }
  bubbles.push({
    key: 'strategy',
    node: (
      <ChatMessage variant="bot" eyebrow="이번 달 전략">
        {ep.strategyStatement}
      </ChatMessage>
    ),
  });
  bubbles.push({
    key: 'coreExperiment',
    node: (
      <ChatMessage variant="bot" eyebrow="핵심 실험">
        {ep.coreExperiment.label}
      </ChatMessage>
    ),
  });
  if (ep.weeklyActions.length > 0) {
    // ExecutionWeekStep is `{ week, action }` — render both halves verbatim
    // (matches V2's ResultSpineView layout, just inside a chat bubble).
    bubbles.push({
      key: 'weeklyActions',
      node: (
        <ChatMessage variant="bot" eyebrow="주간 행동">
          {ep.weeklyActions.map((s) => `${s.week} — ${s.action}`).join('\n')}
        </ChatMessage>
      ),
    });
  }
  if (ep.successSignals.length > 0) {
    bubbles.push({
      key: 'successSignals',
      node: (
        <ChatMessage variant="bot" eyebrow="성공 신호">
          {ep.successSignals.map((s) => `• ${s}`).join('\n')}
        </ChatMessage>
      ),
    });
  }
  if (ep.stopOrPivotCriteria.length > 0) {
    bubbles.push({
      key: 'stopOrPivot',
      node: (
        <ChatMessage variant="bot" eyebrow="멈추거나 방향 전환 기준">
          {ep.stopOrPivotCriteria.map((s) => `• ${s}`).join('\n')}
        </ChatMessage>
      ),
    });
  }
  if (ep.reevaluationChecklist.length > 0) {
    bubbles.push({
      key: 'reevaluation',
      node: (
        <ChatMessage variant="bot" eyebrow="한 달 뒤 점검할 것">
          {ep.reevaluationChecklist.map((s) => `• ${s}`).join('\n')}
        </ChatMessage>
      ),
    });
  }
  bubbles.push({
    key: 'closing',
    node: <ChatMessage variant="bot">{ep.closingLine}</ChatMessage>,
  });

  // Minimal stagger — 100 ms/step. Total reveal ≈ (bubbles + 1) × 100 ms ≈ ~1 s
  // even for a fully-populated spine. Readability stays the priority: nothing
  // is hidden, just gently sequenced.
  const STEP_MS = 100;

  return (
    <>
      {bubbles.map((b, i) => (
        <div
          key={b.key}
          className="chat-rise"
          style={{ animationDelay: `${i * STEP_MS}ms` }}
        >
          {b.node}
        </div>
      ))}

      {/* Bottom actions — primary CTA first (restart), then the V2 bridge, then
          the optional share-link copy. All three are full-width pills on
          mobile (parent main container constrains to max-w-2xl). */}
      <div
        className="chat-rise pt-4 space-y-2"
        style={{ animationDelay: `${bubbles.length * STEP_MS}ms` }}
      >
        <ChatChoiceButton variant="cta" label="처음부터 다시 하기" onClick={onRestart} />
        <ChatChoiceButton variant="ghost" label="기존 카드형 결과 보기" onClick={onOpenV2Result} />
        <ChatChoiceButton
          variant="ghost"
          label={linkCopied ? '복사됨!' : '공유 링크 복사'}
          onClick={copyShareLink}
        />
      </div>
    </>
  );
}
