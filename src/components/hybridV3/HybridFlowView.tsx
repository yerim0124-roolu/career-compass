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
import { CAREER_QUESTION_FLOW, getActiveCareerQuestionFlow, shouldAskPtHold } from '../../data/careerQuestionFlow.ts';
import ProgressHeader from '../careerCompassV2/ProgressHeader';
import ChatLikeFlow from '../careerCompassV2/ChatLikeFlow';
import QuestionStepRenderer from '../careerCompassV2/QuestionStepRenderer';
import LiveInsightCard from '../careerCompassV2/LiveInsightCard';
import ResultSpineView from '../careerCompassV2/ResultSpineView';
import PatternTeaserView from '../careerCompassV2/PatternTeaserView';
import WholeResponseSummary from '../careerCompassV2/WholeResponseSummary';
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
import CareerIntroView from './CareerIntroView';
import { shouldShowCareerIntro } from './careerIntroGate.ts';
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
  showIntro: boolean;
} {
  if (typeof window === 'undefined') {
    return { profile: {}, responses: {}, stepIndex: 0, done: false, phase: 'profile', profileCursor: 0, showIntro: false };
  }
  const raw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
  const parsed = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
  // 시작 안내 화면(신규 사용자 전용) — 파싱된 세션이 '내용상 비어 있을 때만' true.
  // 진행 중/완료/답변 수정 복구 경로에서는 다시 거치지 않는다(표시 전용, schema 무변경).
  const showIntro = shouldShowCareerIntro({
    done: parsed.done, profileDone: parsed.profileDone,
    responses: parsed.responses, profile: parsed.profile,
  });
  // 조건부 후속(pt_hold) stale 처리 — 현재 노출 조건이 false인데 저장된 pt_hold 응답이
  // 남아 있으면(구버전/조건 변경 후 종료) 제거한다. 다시 조건이 true가 되면 재응답을 요구.
  const responses = parsed.responses;
  if (!shouldAskPtHold(responses) && responses.pt_hold) delete responses.pt_hold;
  let phase: Phase;
  if (parsed.done) phase = 'result';
  else if (parsed.profileDone) phase = 'mainFlow';
  else phase = 'profile';
  // 문항 순서·조건부 흐름 하위호환 — raw stepIndex를 그대로 신뢰하지 않는다. 응답은 문항 ID로
  // 저장되므로 '활성 흐름(getActiveCareerQuestionFlow)의 첫 미응답 문항'을 재개 지점으로 삼는다.
  // 조건이 false여서 pt_hold가 빠진 세션도 다음 유효 문항으로 안전하게 이동한다.
  let stepIndex = parsed.stepIndex;
  if (phase === 'mainFlow') {
    const active = getActiveCareerQuestionFlow(responses);
    const firstUnanswered = active.findIndex((s) => !isStepComplete(s, responses[s.id]));
    stepIndex = firstUnanswered === -1 ? Math.max(active.length - 1, 0) : firstUnanswered;
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
    showIntro,
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
  // 시작 안내 화면(신규 사용자 전용, 표시 전용 게이트). CTA 클릭 시 false로만 전환되며
  // 기존 profile phase 렌더(질문 1/10)가 그대로 드러난다 — 흐름 복제·세션 변경 없음.
  const [showIntro, setShowIntro] = useState(initial.showIntro);
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

  // ─── 조건부 pt_hold stale 처리 ────────────────────────────────────────────
  // 이전 답변을 수정해 노출 조건이 true→false가 되면, 숨겨진 pt_hold 응답을 제거한다.
  // (결과 계산에 남지 않고, 다시 조건이 true가 되면 재응답을 요구하도록.)
  useEffect(() => {
    if (!shouldAskPtHold(responses) && responses.pt_hold) {
      setResponses((r) => { const { pt_hold: _omit, ...rest } = r; return rest; });
    }
  }, [responses]);


  // ─── Derived: 활성 흐름(조건부 pt_hold 포함/제외) + 현재 스텝 ────────────────
  // 정적 정의와 실제 노출 흐름을 분리한다. 모든 UI(현재/다음/이전/진행률/결과/복구)는
  // 활성 흐름 기준으로 동작한다(공용 helper 사용, 컴포넌트에서 직접 filter하지 않음).
  const activeFlow = useMemo(() => getActiveCareerQuestionFlow(responses), [responses]);
  // 활성 흐름 길이가 바뀌어도(pt_hold 삽입/제거) 인덱스가 범위를 벗어나지 않게 clamp.
  const idx = Math.min(Math.max(stepIndex, 0), Math.max(activeFlow.length - 1, 0));
  const flowStep = activeFlow[idx];
  const isLastFlowStep = idx === activeFlow.length - 1;
  const flowComplete = isStepComplete(flowStep, responses[flowStep.id]);
  const showInsight = idx > 0 && !!activeFlow[idx - 1]?.liveInsightTrigger;

  // 진행률 — 기본 22문항 기준. countsTowardProgress:false(pt_hold)는 분모/번호에서 제외하고
  // "추가 확인"으로 표시하며, 진행률 바는 직전 일반 문항 위치를 유지한다.
  const countsTotal = activeFlow.filter((s) => s.countsTowardProgress !== false).length;
  const countedBefore = activeFlow.slice(0, idx).filter((s) => s.countsTowardProgress !== false).length;
  const isConditionalStep = flowStep.countsTowardProgress === false;
  const progressCurrent = isConditionalStep ? countedBefore : countedBefore + 1;

  // 활성 흐름 길이 변화(pt_hold 삽입/제거)로 stepIndex가 유효 범위를 벗어나면 되돌린다.
  useEffect(() => {
    if (phase === 'mainFlow' && stepIndex !== idx) setStepIndex(idx);
  }, [phase, stepIndex, idx]);
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
    logProgress(idx, flowStep.id, responses[flowStep.id]);
    if (isLastFlowStep) {
      setDone(true);
      setPhase('result');
    } else {
      setStepIndex(idx + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backFlow = () => {
    if (done) {
      setDone(false);
      setPhase('mainFlow');
    } else if (idx > 0) {
      setStepIndex(idx - 1);
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
  // 시작 안내(신규 사용자 전용) — 프로필/질문을 아직 시작하지 않은 빈 세션에서만.
  if (phase === 'profile' && showIntro) {
    return (
      <div className="min-h-dvh bg-white">
        {Header}
        <CareerIntroView onStart={() => setShowIntro(false)} />
      </div>
    );
  }

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
          ? (<>
              {/* 전체 답변으로 본 현재 상태 — 기존 무료 결과 엔진의 mainType + resultContext
                  (pullDirection/primaryFriction/readinessLevel) 재사용. 패턴 카드 위, '답변
                  수정' 아래의 작은 맥락 블록. 전체 무료 답변이 반영됐음을 보여준다. */}
              <WholeResponseSummary mainType={spine.solutionLayer.mainTypeKey} resultContext={spine.resultContext} />
              <PatternTeaserView pattern={spine.patternProfile} />
            </>)
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
              current={progressCurrent}
              total={countsTotal}
              stageLabel={STAGE_LABELS[flowStep.stage]}
              conditionalLabel={isConditionalStep ? (flowStep.comparisonLabel ?? '추가 확인') : undefined}
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
                {isConditionalStep
                  ? <p className="text-2xl font-black" style={{ color: '#8C6FD6' }}>추가 확인</p>
                  : <p className="text-2xl font-black" style={{ color: '#8C6FD6' }}>{progressCurrent}<span className="text-base text-slate-300"> / {countsTotal}</span></p>}
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

  // 질문 본문(step.message)에는 선택 개수 제한을 넣지 않는다. 안내는 step.maxSelect를
  // 보고 자동 생성(문항별 하드코딩 없음), CAREER_QUESTION_FLOW 렌더러와 동일한 문구 형식.
  const helperText = max !== undefined ? `최대 ${max}개까지 선택 가능` : '여러 개 선택 가능';
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

