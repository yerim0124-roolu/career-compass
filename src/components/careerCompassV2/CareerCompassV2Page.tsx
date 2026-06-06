import { useEffect, useMemo, useState } from 'react';
import type { FlowStage, UserProfile } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS } from '../../types/careerCompass.ts';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import { inferCareerArchetypes } from '../../lib/careerVectorEngine.ts';
import type { FlowResponses, StepResponse2 } from './session';
import { isStepComplete, buildResultFromSession, buildPartialVector, collectSelectedCards, normalizeProfile, parsePersistedSession } from './session';
import { buildLiveInsight } from './liveInsight';
import ProgressHeader from './ProgressHeader';
import ChatLikeFlow from './ChatLikeFlow';
import QuestionStepRenderer from './QuestionStepRenderer';
import LiveInsightCard from './LiveInsightCard';
import ResultSpineView from './ResultSpineView';
import ProfileFormView from './ProfileFormView';

const STORAGE_KEY = 'career-compass-v2-session-v1';

const STAGE_LABELS: Record<FlowStage, string> = {
  current_state: '지금 상태',
  attractive_roles: '끌리는 역할',
  core_values: '가치',
  forced_choices: '선택',
  reality_check: '현실 점검',
  option_reactions: '방향 반응',
  action_preferences: '실행',
};

// P2.0 / P2.1 — the persisted shape lives in session.ts (PersistedSession). The page
// only owns the DOM read path; the parser owns the schema + backward-compat defaults.

function loadSession(): ReturnType<typeof parsePersistedSession> {
  // P2.0 / P2.1 — pure parser lives in session.ts so backward-compat behavior is
  // unit-testable without DOM/localStorage mocking. The page only owns the DOM read path.
  // Return type inferred from parser so `profileDone` (always defined at runtime) is
  // typed as `boolean` here.
  const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
  return parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
}

export default function CareerCompassV2Page() {
  const initial = loadSession();
  const [responses, setResponses] = useState<FlowResponses>(initial.responses);
  // P2.1 — profile is now a controlled, mutable piece of state. The setter is wired
  // exclusively to ProfileFormView; engines NEVER read or write it for routing.
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [stepIndex, setStepIndex] = useState(initial.stepIndex);
  const [done, setDone] = useState(initial.done);
  // P2.1 — true once the user has either filled or explicitly skipped the profile
  // form. Pre-P2.1 completed sessions default to true (parser heuristic) so existing
  // users aren't re-prompted; new completions start false → form appears.
  const [profileDone, setProfileDone] = useState(initial.profileDone);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // P2.0 — normalize on save so any future profile setter or external mutation goes
    // through the derivation pipeline (currently just careerPattern).
    const normalizedProfile = normalizeProfile(profile);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepIndex, responses, profile: normalizedProfile, done, profileDone }),
    );
  }, [stepIndex, responses, profile, done, profileDone]);

  const step = CAREER_QUESTION_FLOW[stepIndex];
  const complete = isStepComplete(step, responses[step.id]);
  const isLast = stepIndex === CAREER_QUESTION_FLOW.length - 1;

  const showInsight = stepIndex > 0 && !!CAREER_QUESTION_FLOW[stepIndex - 1].liveInsightTrigger;
  const insightText = useMemo(() => buildLiveInsight(responses), [responses]);

  const partialArchetypes = useMemo(
    () => inferCareerArchetypes(buildPartialVector(responses)).slice(0, 3),
    [responses],
  );
  const selectedCount = useMemo(() => collectSelectedCards(responses).length, [responses]);

  // P2.2 — spine builds when the main flow is done. Profile is a pre-flow gate now,
  // so by the time `done === true`, `profileDone === true` is already guaranteed.
  // We still read `profileDone` defensively so a corrupted state never renders a
  // result without the profile step having been seen.
  const spine = useMemo(
    () => (done && profileDone ? buildResultFromSession({ responses, profile }) : null),
    [done, profileDone, responses, profile],
  );

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const setStep = (v: StepResponse2) => setResponses((r) => ({ ...r, [step.id]: v }));

  const next = () => {
    if (!complete) return;
    if (isLast) setDone(true);
    else setStepIndex((i) => i + 1);
    scrollTop();
  };
  const back = () => {
    // P2.2 — render order is profile → main flow → result. Back unwinds in reverse:
    //   result        → last step of main flow (done=false)
    //   step >0       → previous step
    //   step 0        → back to profile form (profileDone=false)
    //   profile form  → no further back (entry screen)
    if (done) setDone(false);
    else if (stepIndex > 0) setStepIndex((i) => i - 1);
    else if (profileDone) setProfileDone(false);
    scrollTop();
  };
  const restart = () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    setResponses({});
    setProfile({});
    setStepIndex(0);
    setDone(false);
    setProfileDone(false); // P2.2 — restart lands the user on the profile form again
    scrollTop();
  };

  // P2.2 — three-phase render in user-facing order: profile form → main flow → result.
  if (!profileDone) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <ProfileFormView
          profile={profile}
          onChange={setProfile}
          onComplete={() => { setProfileDone(true); scrollTop(); }}
          onSkip={() => { setProfileDone(true); scrollTop(); }}
        />
      </div>
    );
  }

  if (done && spine) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <ResultSpineView spine={spine} onRestart={restart} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Left: question flow */}
        <main className="lg:col-span-2 space-y-5 pb-28 lg:pb-6">
          <ProgressHeader
            current={stepIndex + 1}
            total={CAREER_QUESTION_FLOW.length}
            stageLabel={STAGE_LABELS[step.stage]}
            // P2.2 — back is always available in main flow: step 0 returns to the
            // profile form (the new entry screen), not a dead-end.
            canBack
            onBack={back}
          />
          {showInsight && <LiveInsightCard text={insightText} />}
          <ChatLikeFlow step={step}>
            <QuestionStepRenderer step={step} value={responses[step.id] ?? {}} onChange={setStep} />
          </ChatLikeFlow>

          {/* Desktop action row */}
          <div className="hidden lg:flex items-center justify-end gap-3 pt-2">
            {step.optional && !complete && (
              <button type="button" onClick={next} className="text-sm text-slate-500 hover:text-slate-800">건너뛰기</button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!complete}
              className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
            >
              {isLast ? '결과 보기' : '다음'} <span aria-hidden>→</span>
            </button>
          </div>
        </main>

        {/* Right: live summary (desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">진행 현황</p>
            <div>
              <p className="text-2xl font-black text-indigo-600">{stepIndex + 1}<span className="text-base text-slate-300"> / {CAREER_QUESTION_FLOW.length}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">선택 {selectedCount}개 반영 중</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1.5">지금까지의 성향</p>
              {partialArchetypes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {partialArchetypes.map((a) => (
                    <span key={a.key} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">{ARCHETYPE_LABELS[a.key]}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">아직 모으는 중이에요.</p>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
              성향은 보조 라벨이에요. 결과는 지금 할 한 수와 그 조건으로 정리됩니다.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        {step.optional && !complete && (
          <button type="button" onClick={next} className="text-sm text-slate-500 px-3 py-3">건너뛰기</button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!complete}
          className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLast ? '결과 보기' : '다음'} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-black text-indigo-700 text-sm">
          <span aria-hidden>🧭</span> Career Compass <span className="text-slate-300 font-bold">2.0</span>
        </span>
        <button
          type="button"
          onClick={() => { window.location.hash = ''; }}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          기본 버전 →
        </button>
      </div>
    </header>
  );
}
