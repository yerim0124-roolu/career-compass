// Career Compass — P3.8 Hybrid UX (#hybrid / #v3).
//
// What this is:
//   • Chat-style profile onboarding (light, guided).
//   • Profile summary review with per-row edit + global confirm/restart.
//   • Card/form-style main questionnaire (reuses V2 components verbatim).
//   • Card-style result report (reuses V2 ResultSpineView verbatim).
//
// What this is NOT:
//   • Does not change engine / CAREER_QUESTION_FLOW / FlowResponses /
//     UserProfile / scoring / routing / resultSpineEngine / analytics builder.
//   • Does not change V2 source files — V2 keeps working on #v2 unchanged.
//   • Does not add back-navigation to the engine itself; back-nav exists ONLY
//     in the chat profile onboarding layer (per user spec).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile, ResultSpine } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS } from '../../types/careerCompass.ts';
import type { FlowStage } from '../../types/careerCompass.ts';
import type {
  FlowResponses,
  StepResponse2,
  PersistedSession,
} from '../careerCompassV2/session.ts';
import {
  buildResultFromSession,
  buildPartialVector,
  isStepComplete,
  normalizeProfile,
  parsePersistedSession,
  applyConstraintTagToggle,
} from '../careerCompassV2/session.ts';
import { inferCareerArchetypes } from '../../lib/careerVectorEngine.ts';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import ProgressHeader from '../careerCompassV2/ProgressHeader';
import ChatLikeFlow from '../careerCompassV2/ChatLikeFlow';
import QuestionStepRenderer from '../careerCompassV2/QuestionStepRenderer';
import LiveInsightCard from '../careerCompassV2/LiveInsightCard';
import ResultSpineView from '../careerCompassV2/ResultSpineView';
import PatternTeaserView from '../careerCompassV2/PatternTeaserView';
import { buildLiveInsight } from '../careerCompassV2/liveInsight';
import ChatMessage from '../chatV1/ChatMessage';
import ChatChoiceButton from '../chatV1/ChatChoiceButton';
import {
  PROFILE_CHAT_STEPS,
  applyProfileAnswer,
  applyCappedToggle,
} from '../../lib/chatFlow.ts';
import type { ChatStep } from '../../lib/chatFlow.ts';
import ProfileSummaryReview from './ProfileSummaryReview';
import { logStart, logProgress, logComplete } from '../../lib/analytics.ts';
import { FEATURE_FLAGS } from '../../config/featureFlags';

// Same PersistedSession shape V2 uses. Hybrid has its own key so V2 sessions
// stay independent. Loaded via the EXACT V2 parser.
const HYBRID_STORAGE_KEY = 'career-compass-hybrid-session-v1';

const STAGE_LABELS: Record<FlowStage, string> = {
  current_state: '지금 상태',
  attractive_roles: '끌리는 역할',
  core_values: '가치',
  forced_choices: '선택',
  reality_check: '현실 점검',
  option_reactions: '방향 반응',
  action_preferences: '실행',
};

type Phase = 'profile' | 'profileReview' | 'mainFlow' | 'result';

// PROFILE_CHAT_STEPS contains only `phase: 'profile'` entries in P3.1 — but
// reuse-safe filter keeps us robust to future additions.
const ONBOARDING_STEPS: Array<Extract<ChatStep, { phase: 'profile' }>> = PROFILE_CHAT_STEPS
  .filter((s): s is Extract<ChatStep, { phase: 'profile' }> => s.phase === 'profile');

const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;

// ─── Initial-state loader ───────────────────────────────────────────────────
function loadHybridSession(): {
  profile: UserProfile;
  responses: FlowResponses;
  stepIndex: number;
  done: boolean;
  phase: Phase;
  profileCursor: number;
} {
  if (typeof window === 'undefined') {
    return { profile: {}, responses: {}, stepIndex: 0, done: false, phase: 'profile', profileCursor: 0 };
  }
  const raw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
  const parsed = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
  let phase: Phase;
  if (parsed.done) phase = 'result';
  else if (parsed.profileDone) phase = 'mainFlow';
  else phase = 'profile';
  // 문항 재배열 하위호환 — 응답은 문항 ID로 저장되므로 raw stepIndex를 그대로 신뢰하지 않는다.
  // 새 질문 순서에서 '첫 번째 미응답 문항'을 재개 지점으로 삼는다(순서가 바뀌어도 다른 질문으로
  // 튀지 않음). 모든 문항에 답했다면 마지막 문항에 둔다(done이면 위에서 이미 result).
  let stepIndex = parsed.stepIndex;
  if (phase === 'mainFlow') {
    const firstUnanswered = CAREER_QUESTION_FLOW.findIndex((s) => !isStepComplete(s, parsed.responses[s.id]));
    stepIndex = firstUnanswered === -1 ? Math.max(CAREER_QUESTION_FLOW.length - 1, 0) : firstUnanswered;
  }
  // Cursor: if resuming profile, land on first field that's missing.
  let profileCursor = 0;
  if (phase === 'profile') {
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      const f = ONBOARDING_STEPS[i].targetField;
      if ((parsed.profile as Record<string, unknown>)[f] === undefined) {
        profileCursor = i;
        break;
      }
      // All fields filled → land on review even though phase says profile.
      if (i === ONBOARDING_STEPS.length - 1) {
        phase = 'profileReview';
        profileCursor = ONBOARDING_STEPS.length;
      }
    }
  }
  return {
    profile: parsed.profile,
    responses: parsed.responses,
    stepIndex,
    done: parsed.done,
    phase,
    profileCursor,
  };
}

// ─── HybridFlowView ─────────────────────────────────────────────────────────
export default function HybridFlowView() {
  const initial = useMemo(() => loadHybridSession(), []);
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [responses, setResponses] = useState<FlowResponses>(initial.responses);
  const [stepIndex, setStepIndex] = useState(initial.stepIndex);
  const [done, setDone] = useState(initial.done);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [profileCursor, setProfileCursor] = useState(initial.profileCursor);
  const [draft, setDraft] = useState<string[]>([]);
  // When the user taps "수정" from the review, we set this so commit/skip
  // returns to the review instead of advancing to the next chat question.
  const [returnToReviewAfterCommit, setReturnToReviewAfterCommit] = useState(false);

  // 분석 — 플로우 진입(마운트) 1회.
  useEffect(() => { logStart(); }, []);

  // ─── Persist on every change ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session: PersistedSession = {
      stepIndex,
      responses,
      profile,
      done,
      profileDone: phase !== 'profile',
    };
    try {
      window.localStorage.setItem(HYBRID_STORAGE_KEY, JSON.stringify(session));
    } catch { /* noop */ }
  }, [stepIndex, responses, profile, done, phase]);

  // ─── Derived: main-flow current step ─────────────────────────────────────
  const flowStep = CAREER_QUESTION_FLOW[stepIndex];
  const isLastFlowStep = stepIndex === CAREER_QUESTION_FLOW.length - 1;
  const flowComplete = isStepComplete(flowStep, responses[flowStep.id]);

  const showInsight = stepIndex > 0 && !!CAREER_QUESTION_FLOW[stepIndex - 1].liveInsightTrigger;
  const insightText = useMemo(() => buildLiveInsight(responses), [responses]);

  const partialArchetypes = useMemo(
    () => inferCareerArchetypes(buildPartialVector(responses)).slice(0, 3),
    [responses],
  );

  // ─── Derived: result spine ───────────────────────────────────────────────
  const spine: ResultSpine | null = useMemo(
    () => (phase === 'result' ? buildResultFromSession({ responses, profile }) : null),
    [phase, responses, profile],
  );

  // 분석 — 결과(resultContext)가 산출되어 결과지가 뜰 때 1회만. StrictMode 중복 가드.
  const loggedComplete = useRef(false);
  useEffect(() => {
    if (phase === 'result' && spine?.resultContext && !loggedComplete.current) {
      loggedComplete.current = true;
      logComplete({ answers: responses, resultContext: spine.resultContext });
    }
  }, [phase, spine]);

  // ─── Auto-scroll on phase / cursor / step changes ────────────────────────
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [phase, profileCursor, stepIndex, done]);

  // ─── Profile commit (eager normalizeProfile per user spec) ───────────────
  const commitProfile = (next: UserProfile) => setProfile(normalizeProfile(next));

  // ─── Phase transitions ────────────────────────────────────────────────────
  const goToReview = () => {
    setPhase('profileReview');
    setDraft([]);
  };

  const advanceProfile = () => {
    setDraft([]);
    if (returnToReviewAfterCommit) {
      setReturnToReviewAfterCommit(false);
      goToReview();
      return;
    }
    const next = profileCursor + 1;
    if (next >= ONBOARDING_TOTAL) {
      goToReview();
    } else {
      setProfileCursor(next);
    }
  };

  const goBackProfile = () => {
    setDraft([]);
    setProfileCursor((c) => Math.max(0, c - 1));
  };

  const onConfirmProfileReview = () => {
    setPhase('mainFlow');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onRestartProfile = () => {
    setProfile({});
    setProfileCursor(0);
    setDraft([]);
    setReturnToReviewAfterCommit(false);
    setPhase('profile');
  };

  const onEditProfileStep = (cursor: number) => {
    setProfileCursor(cursor);
    setDraft([]);
    setReturnToReviewAfterCommit(true);
    setPhase('profile');
  };

  // Main-flow advance / back.
  const setForFlowStep = (v: StepResponse2) => setResponses((r) => ({ ...r, [flowStep.id]: v }));
  const advanceFlow = () => {
    if (!flowComplete) return;
    logProgress(stepIndex, flowStep.id, responses[flowStep.id]);
    if (isLastFlowStep) {
      setDone(true);
      setPhase('result');
    } else {
      setStepIndex((i) => i + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backFlow = () => {
    if (done) {
      setDone(false);
      setPhase('mainFlow');
    } else if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else {
      // Step 0 → return to profile review.
      setPhase('profileReview');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restartAll = () => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(HYBRID_STORAGE_KEY); } catch { /* noop */ }
    }
    setProfile({});
    setResponses({});
    setProfileCursor(0);
    setStepIndex(0);
    setDone(false);
    setDraft([]);
    setReturnToReviewAfterCommit(false);
    setPhase('profile');
  };

  // ─── Top bar ──────────────────────────────────────────────────────────────
  // "hybrid" 라벨과 버전 전환(#v2) 링크는 제거됨. "다시"(restartAll)는 전 화면 유지.
  const Header = (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-black text-sm" style={{ color: '#5E5280' }}>
          <span aria-hidden>🧭</span> Career Compass
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={restartAll}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            다시
          </button>
        </div>
      </div>
    </header>
  );

  // ─── Phase render ────────────────────────────────────────────────────────
  if (phase === 'result' && spine) {
    return (
      <div className="min-h-dvh bg-white">
        {Header}
        {/* Back-to-answers: backFlow's `done` branch re-opens the last main
            step so a single answer can be fixed without a full restart.
            Rendered here (hybrid chrome) so ResultSpineView stays V2-pure. */}
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <button
            type="button"
            onClick={backFlow}
            className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <span aria-hidden>←</span> 답변 수정하러 돌아가기
          </button>
        </div>
        {/* 유료 기능 on이면 무료 화면은 커리어 고민 패턴 티저(PatternTeaserView)로 대체한다.
            기존 상세 해석·실행 처방은 화면에서만 숨기고, spine 데이터는 그대로 유지된다(위 계산).
            심층 분석 미리보기·결제 CTA는 형제 컴포넌트 PaidEntryBanner가 제공한다.
            플래그 off(레거시)면 기존 상세 무료 리포트(ResultSpineView)를 그대로 렌더한다. */}
        {FEATURE_FLAGS.paidAnalysis
          ? <PatternTeaserView pattern={spine.patternProfile} />
          : <ResultSpineView spine={spine} onRestart={restartAll} hideDeepSections={false} />}
      </div>
    );
  }

  if (phase === 'profileReview') {
    return (
      <div className="min-h-dvh bg-white">
        {Header}
        <ProfileSummaryReview
          profile={profile}
          onEditStep={onEditProfileStep}
          onConfirm={onConfirmProfileReview}
          onRestartProfile={onRestartProfile}
        />
        <div ref={bottomRef} />
      </div>
    );
  }

  if (phase === 'mainFlow') {
    // Reuse the EXACT V2 main-flow rendering pieces (ProgressHeader +
    // ChatLikeFlow + QuestionStepRenderer + LiveInsightCard). Engine
    // behavior is identical to #v2 because the underlying data + builder
    // are the same; only the surrounding chrome differs.
    return (
      <div className="min-h-dvh bg-white">
        {Header}
        <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-3 lg:gap-8">
          <main className="lg:col-span-2 space-y-5 pb-28 lg:pb-6">
            <ProgressHeader
              current={stepIndex + 1}
              total={CAREER_QUESTION_FLOW.length}
              stageLabel={STAGE_LABELS[flowStep.stage]}
              canBack
              onBack={backFlow}
            />
            {showInsight && <LiveInsightCard text={insightText} />}
            <ChatLikeFlow step={flowStep}>
              <QuestionStepRenderer step={flowStep} value={responses[flowStep.id] ?? {}} onChange={setForFlowStep} />
            </ChatLikeFlow>

            <div className="hidden lg:flex items-center justify-end gap-3 pt-2">
              {flowStep.optional && !flowComplete && (
                <button type="button" onClick={advanceFlow} className="text-sm text-slate-500 hover:text-slate-800">건너뛰기</button>
              )}
              <button
                type="button"
                onClick={advanceFlow}
                disabled={!flowComplete}
                className="px-6 py-3 rounded-2xl text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.28)' }}
              >
                {isLastFlowStep ? '결과 보기' : '다음'} <span aria-hidden>→</span>
              </button>
            </div>
          </main>

          {/* Desktop right column: lightweight progress + early archetypes. */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4 cc-sketch-q p-5 bg-white">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">진행 현황</p>
              <div>
                <p className="text-2xl font-black" style={{ color: '#8C6FD6' }}>{stepIndex + 1}<span className="text-base text-slate-300"> / {CAREER_QUESTION_FLOW.length}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">답변을 실시간으로 반영 중</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1.5">지금까지의 성향</p>
                {partialArchetypes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {partialArchetypes.map((a) => (
                      <span key={a.key} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: '#5B3FB2', background: '#EFEAFB' }}>{ARCHETYPE_LABELS[a.key]}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">아직 모으는 중이에요.</p>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile sticky action bar */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3">
          {flowStep.optional && !flowComplete && (
            <button type="button" onClick={advanceFlow} className="text-sm text-slate-500 px-3 py-3">건너뛰기</button>
          )}
          <button
            type="button"
            onClick={advanceFlow}
            disabled={!flowComplete}
            className="flex-1 py-3.5 rounded-2xl text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.28)' }}
          >
            {isLastFlowStep ? '결과 보기' : '다음'} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  // phase === 'profile' — chat-style onboarding with back-nav + per-step edit.
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {Header}
      {/* Subtle progress bar for the profile onboarding section. */}
      <div className="h-0.5 w-full bg-slate-100">
        <div
          className="h-0.5 transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.round(((profileCursor + 1) / ONBOARDING_TOTAL) * 100))}%`, background: '#8C6FD6' }}
        />
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-5 pb-10 space-y-3">
        {/* Header eyebrow telling the user we're in profile onboarding. */}
        <div className="mb-2">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
            나에 대한 정보 · {profileCursor + 1} / {ONBOARDING_TOTAL}
          </p>
        </div>

        <ProfileChatStepView
          step={ONBOARDING_STEPS[profileCursor]}
          profile={profile}
          draft={draft}
          setDraft={setDraft}
          commitProfile={commitProfile}
          onAdvance={advanceProfile}
          onBack={profileCursor > 0 ? goBackProfile : undefined}
          isLast={profileCursor === ONBOARDING_TOTAL - 1}
          isEditingFromReview={returnToReviewAfterCommit}
        />

        <div ref={bottomRef} />
      </main>
    </div>
  );
}

// ─── ProfileChatStepView (active step in profile onboarding) ───────────────
interface ProfileChatStepViewProps {
  step: Extract<ChatStep, { phase: 'profile' }>;
  profile: UserProfile;
  draft: string[];
  setDraft: (v: string[]) => void;
  commitProfile: (next: UserProfile) => void;
  onAdvance: () => void;
  onBack?: () => void;
  isLast: boolean;
  isEditingFromReview: boolean;
}

function ProfileChatStepView({
  step, profile, draft, setDraft, commitProfile, onAdvance, onBack, isLast, isEditingFromReview,
}: ProfileChatStepViewProps) {
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

  const skip = () => commit([]);

  // CTA wording adjusts when the user is editing a single field from review.
  const primaryNextLabel = isEditingFromReview
    ? '수정 완료'
    : isLast
      ? '검토 화면 보기'
      : '다음';

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
            {onBack && <ChatChoiceButton variant="ghost" label="이전" onClick={onBack} />}
            <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
            <ChatChoiceButton variant="cta" label={primaryNextLabel} onClick={() => commit(draft)} />
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
              selected={draft[0] === opt.value}
              onClick={() => commit([opt.value])}
            />
          ))}
          <div className="flex gap-2 pt-1">
            {onBack && <ChatChoiceButton variant="ghost" label="이전" onClick={onBack} />}
            <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
          </div>
        </div>
      </>
    );
  }

  // ── multi_select (with optional cap + optional `none` exclusivity) ───────
  const max = step.maxSelect;
  const useNoneRule = step.noneExclusive === true;

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
          {onBack && <ChatChoiceButton variant="ghost" label="이전" onClick={onBack} />}
          <ChatChoiceButton variant="ghost" label="건너뛰기" onClick={skip} />
          <ChatChoiceButton
            variant="cta"
            label={draft.length === 0 ? '없이 계속' : `${primaryNextLabel} (${draft.length}개)`}
            onClick={() => commit(draft)}
          />
        </div>
      </div>
    </>
  );
}

