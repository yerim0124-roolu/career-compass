// Career Compass 2.0 — P2.2 Profile question UI (pre-flow placement).
// Pure data-collection screen for the UserProfile metadata. The user lands here
// BEFORE the main question flow as a compact background-info step. Every section is
// optional and the whole screen is skippable (skip just advances to the main flow).
//
// HARD INVARIANTS this component must preserve:
//   - Does NOT touch FlowResponses / CAREER_QUESTION_FLOW / engine logic.
//   - Writes ONLY to the parent's profile state (which becomes SessionState.profile).
//   - Does NOT produce scoreEffects / constructEffects / gateAssignment / routing.
//   - The result spine derived from (responses, profile) must be identical to the
//     result derived from (responses, {}) for every profile value the user picks here.
//     This is enforced by the routing-safety fingerprint tests in session.test.ts.
//
// The shape of each section is fully typed against UserProfile so a future change to
// the type (e.g. renaming an enum value) is caught by the compiler.

import { useMemo } from 'react';
import type { UserProfile } from '../../types/careerCompass.ts';
import { applyConstraintTagToggle, CONSTRAINT_TAGS_MAX, CONSTRAINT_TAGS_NONE } from './session';

interface ProfileFormProps {
  profile: UserProfile;
  onChange: (next: UserProfile) => void;
  onComplete: () => void;     // user finished filling (or chose "continue to questions")
  onSkip: () => void;          // user opted to skip the whole form
}

// ─── Section option lookups (display labels) ─────────────────────────────────
// Keys are typed against UserProfile, so renaming an enum in types/careerCompass.ts
// surfaces here as a compile error.
type Opt<V> = { value: V; label: string };

const AGE_BAND: Array<Opt<NonNullable<UserProfile['ageBand']>>> = [
  { value: '20_early',    label: '20대 초반' },
  { value: '20_late',     label: '20대 후반' },
  { value: '30_early',    label: '30대 초반' },
  { value: '30_late',     label: '30대 후반' },
  { value: '40_early',    label: '40대 초반' },
  { value: '40_late_plus', label: '40대 후반 이상' },
];

const TOTAL_CAREER_STAGE: Array<Opt<NonNullable<UserProfile['totalCareerStage']>>> = [
  { value: 'total_0_3',                label: '0~3년' },
  { value: 'total_3_7',                label: '3~7년' },
  { value: 'total_7_12',               label: '7~12년' },
  { value: 'total_12_plus',            label: '12년 이상' },
  { value: 'no_fulltime_experience',   label: '아직 본격적인 경력은 없어요' },
];

const CURRENT_FIELD_STAGE: Array<Opt<NonNullable<UserProfile['currentFieldStage']>>> = [
  { value: 'current_under_1',          label: '1년 미만' },
  { value: 'current_1_3',              label: '1~3년' },
  { value: 'current_3_7',              label: '3~7년' },
  { value: 'current_7_plus',           label: '7년 이상' },
  { value: 'multiple_current_fields',  label: '여러 일을 병행 중이라 하나로 말하기 어려워요' },
];

const PRIOR_FIELD_EXPERIENCE: Array<Opt<NonNullable<UserProfile['priorFieldExperience']>>> = [
  { value: 'single_track',     label: '아니요, 대부분 한 분야에서 일해왔어요' },
  { value: 'has_prior_field',  label: '네, 다른 분야 경력이 있어요' },
  { value: 'multi_field',      label: '여러 분야를 오가며 일해왔어요' },
];

const WORK_MODE: Array<Opt<NonNullable<UserProfile['workMode']>>> = [
  { value: 'organization',   label: '회사/조직에 소속되어 일하고 있어요' },
  { value: 'professional',   label: '전문직으로 일하고 있어요' },
  { value: 'freelance',      label: '프리랜서/1인 사업자로 일하고 있어요' },
  { value: 'founder',        label: '창업자/공동창업자로 일하고 있어요' },
  { value: 'student',        label: '학생/취업 준비 중이에요' },
  { value: 'career_break',   label: '퇴사·휴직 후 다음 방향을 찾고 있어요' },
  { value: 'multi_work',     label: '여러 일을 병행하고 있어요' },
];

const TRANSITION_TIMING: Array<Opt<NonNullable<UserProfile['transitionTiming']>>> = [
  { value: 'now',                  label: '지금 바로 가능해요' },
  { value: 'within_1_3_months',    label: '1~3개월 안에는 가능해요' },
  { value: 'within_3_6_months',    label: '3~6개월 정도 준비가 필요해요' },
  { value: 'after_6_months',       label: '6개월 이상은 현재 일을 유지해야 해요' },
  { value: 'unknown',              label: '아직 모르겠어요' },
];

const TRANSITION_INTENT: Array<Opt<NonNullable<UserProfile['transitionIntent']>>> = [
  { value: 'curious',                label: '막연히 궁금한 정도예요' },
  { value: 'preparing',              label: '준비는 해보고 싶어요' },
  { value: 'actively_considering',   label: '실제로 움직일 생각이 있어요' },
  { value: 'ready_to_switch',        label: '지금 바로 바꾸고 싶어요' },
  { value: 'must_stay',              label: '당분간은 유지해야 해요' },
];

type ConcernTag = NonNullable<UserProfile['concernTags']>[number];
const CONCERN_TAGS: Array<Opt<ConcernTag>> = [
  { value: 'job_change',             label: '이직할지 고민 중' },
  { value: 'stay_or_leave',          label: '지금 일을 계속해도 되는지 모르겠음' },
  { value: 'too_many_options',       label: '하고 싶은 게 너무 많음' },
  { value: 'low_option_visibility',  label: '뭘 하고 싶은지 잘 안 보임' },
  { value: 'burnout',                label: '지금 너무 지쳐 있음' },
  { value: 'strength_unclear',       label: '내 강점을 어떻게 써야 할지 모르겠음' },
  { value: 'startup_side_project',   label: '창업/사이드프로젝트를 해보고 싶음' },
  { value: 'independent_work',       label: '프리랜서/독립을 고민 중' },
  { value: 'identity_confusion',     label: '커리어 정체성이 헷갈림' },
];

type ConstraintTag = NonNullable<UserProfile['constraintTags']>[number];
const CONSTRAINT_TAGS: Array<Opt<ConstraintTag>> = [
  { value: 'money',                 label: '돈' },
  { value: 'time',                  label: '시간' },
  { value: 'energy_burnout',        label: '체력/번아웃' },
  { value: 'family_responsibility', label: '가족/생활 책임' },
  { value: 'low_confidence',        label: '자신감 부족' },
  { value: 'information_gap',       label: '정보 부족' },
  { value: 'social_pressure',       label: '주변 시선' },
  { value: 'career_gap_risk',       label: '경력 공백 걱정' },
  { value: 'none',                  label: '딱히 큰 제약은 없음' },
];

// P2.2 — constraintTags has special selection rules (see applyConstraintTagToggle
// in session.ts). The constants are re-aliased here for terser JSX.
const CONSTRAINT_MAX = CONSTRAINT_TAGS_MAX;
const CONSTRAINT_NONE: ConstraintTag = CONSTRAINT_TAGS_NONE;

type DesiredPath = NonNullable<UserProfile['desiredPaths']>[number];
const DESIRED_PATHS: Array<Opt<DesiredPath>> = [
  { value: 'job_change',         label: '이직' },
  { value: 'internal_redesign',  label: '현재 일 안에서 역할 조정' },
  { value: 'freelance',          label: '프리랜서/독립' },
  { value: 'startup',            label: '창업' },
  { value: 'side_project',       label: '사이드프로젝트' },
  { value: 'content_brand',      label: '콘텐츠/개인브랜드' },
  { value: 'advisory_teaching',  label: '강의/자문' },
  { value: 'rest_recover',       label: '휴식/회복' },
  { value: 'undecided',          label: '아직 모르겠음' },
];

// ─── Small UI primitives (matched to the existing app palette) ────────────────

function PillButton({
  active,
  label,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-disabled={disabled}
      disabled={disabled}
      className={[
        'rounded-full border px-4 py-2 text-sm transition',
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
          : disabled
            ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// P2.2 — Field-level title. Lighter weight than the main flow's question heading
// (text-sm semibold vs main flow's text-base bold) so the profile feels like a
// background-info step, not another heavy question screen.
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-sm font-semibold text-slate-800 leading-snug">{children}</h3>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// P2.2 — Thematic group container. Bundles related fields into one visually
// contained card so the form reads as 4 grouped sections, not 11 stacked questions.
// Each card carries a small uppercase label up top for orientation.
function GroupCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <p className="mb-4 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        {label}
      </p>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ProfileFormView({ profile, onChange, onComplete, onSkip }: ProfileFormProps) {
  // Single-select setter (sets a scalar field).
  const setField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]): void => {
    onChange({ ...profile, [field]: value });
  };

  // Toggle on a string-array field (multi-select).
  const toggleTag = <K extends 'concernTags' | 'desiredPaths'>(
    field: K,
    tag: NonNullable<UserProfile[K]>[number],
  ): void => {
    const current = (profile[field] ?? []) as Array<NonNullable<UserProfile[K]>[number]>;
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    onChange({ ...profile, [field]: next as UserProfile[K] });
  };

  // P2.2 — Delegate to the pure helper so the rules are unit-testable headlessly
  // (see session.test.ts → REQUIRED P2.2 TESTS). Rules:
  //   • Max CONSTRAINT_TAGS_MAX (=2) "real" tags.
  //   • Selecting `none` wipes everything else; selecting another tag drops `none`.
  //   • Click at cap is a no-op (the disallowed pill also renders disabled below).
  const toggleConstraintTag = (tag: ConstraintTag): void => {
    const next = applyConstraintTagToggle(profile.constraintTags, tag);
    onChange({ ...profile, constraintTags: next });
  };

  // Pre-compute the cap state so the JSX stays declarative.
  const constraintReal = (profile.constraintTags ?? []).filter((t) => t !== CONSTRAINT_NONE);
  const constraintAtCap = constraintReal.length >= CONSTRAINT_MAX;
  const constraintNoneSelected = (profile.constraintTags ?? []).includes(CONSTRAINT_NONE);

  const filledCount = useMemo(() => {
    let n = 0;
    if (profile.ageBand) n++;
    if (profile.jobRoleRaw && profile.jobRoleRaw.trim().length > 0) n++;
    if (profile.totalCareerStage) n++;
    if (profile.currentFieldStage) n++;
    if (profile.priorFieldExperience) n++;
    if (profile.workMode) n++;
    if (profile.transitionTiming) n++;
    if (profile.transitionIntent) n++;
    if (profile.concernTags && profile.concernTags.length > 0) n++;
    if (profile.constraintTags && profile.constraintTags.length > 0) n++;
    if (profile.desiredPaths && profile.desiredPaths.length > 0) n++;
    return n;
  }, [profile]);

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">배경 정보 (선택)</h2>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {filledCount}/11
          </span>
        </div>
      </header>

      {/* P2.2 — intro block. Title + microcopy are the user-specified copy that frames
          this pre-flow step. Both lines are calibration framing, NOT identification.
          Title is text-base (not text-lg) so the page feels lighter than the main flow. */}
      <section className="mx-auto mt-6 max-w-2xl px-4">
        <h1 className="text-base font-bold leading-snug text-slate-900">
          먼저 결과를 더 현실적으로 맞추기 위해 간단한 배경 정보를 확인할게요.
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          개인을 특정하기 위한 정보가 아니라, 커리어 단계와 실행 가능성을 보정하기 위한 질문입니다.
        </p>
      </section>

      {/* P2.2 — 11 fields grouped into 4 thematic cards so the form reads as a few
          compact sections, not eleven heavy questions. All copy/values/rules are
          unchanged; only the visual container & per-field heading weight differ. */}
      <main className="mx-auto mt-6 max-w-2xl space-y-4 px-4">
        {/* ── Group A: 기본 정보 ── ageBand / jobRoleRaw / workMode ── */}
        <GroupCard label="기본 정보">
          {/* 1. ageBand */}
          <div>
            <SectionTitle>현재 연령대는 어디에 가까운가요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {AGE_BAND.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.ageBand === o.value}
                  label={o.label}
                  onClick={() => setField('ageBand', profile.ageBand === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>

          {/* 2. jobRoleRaw — free text */}
          <div>
            <SectionTitle>현재 하고 있는 일을 가장 가깝게 적어주세요.</SectionTitle>
            <input
              type="text"
              value={profile.jobRoleRaw ?? ''}
              onChange={(e) => setField('jobRoleRaw', e.target.value || undefined)}
              placeholder="예: 마케터, 디자이너, 개발자, 수의사, 연구원, 투자심사역, 기획자, 교사, 프리랜서, 창업자 등"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 6. workMode (regrouped here under "현재 일하는 방식" — fits the basics card) */}
          <div>
            <SectionTitle>현재 일하는 방식에 가장 가까운 것은 무엇인가요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {WORK_MODE.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.workMode === o.value}
                  label={o.label}
                  onClick={() => setField('workMode', profile.workMode === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>
        </GroupCard>

        {/* ── Group B: 경력 흐름 ── totalCareerStage / currentFieldStage / priorFieldExperience ── */}
        <GroupCard label="경력 흐름">
          {/* 3. totalCareerStage */}
          <div>
            <SectionTitle>전체 경력은 어느 정도인가요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TOTAL_CAREER_STAGE.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.totalCareerStage === o.value}
                  label={o.label}
                  onClick={() => setField('totalCareerStage', profile.totalCareerStage === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>

          {/* 4. currentFieldStage */}
          <div>
            <SectionTitle>현재 주로 하는 일의 경력은 어느 정도인가요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CURRENT_FIELD_STAGE.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.currentFieldStage === o.value}
                  label={o.label}
                  onClick={() => setField('currentFieldStage', profile.currentFieldStage === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>

          {/* 5. priorFieldExperience */}
          <div>
            <SectionTitle>이전에 다른 분야에서 쌓은 경력이 있나요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {PRIOR_FIELD_EXPERIENCE.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.priorFieldExperience === o.value}
                  label={o.label}
                  onClick={() => setField('priorFieldExperience', profile.priorFieldExperience === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>
        </GroupCard>

        {/* ── Group C: 변화 시점·의향 ── transitionTiming / transitionIntent ── */}
        <GroupCard label="변화 시점·의향">
          {/* 7. transitionTiming */}
          <div>
            <SectionTitle>현실적으로 언제부터 커리어 변화를 실행할 수 있나요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TRANSITION_TIMING.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.transitionTiming === o.value}
                  label={o.label}
                  onClick={() => setField('transitionTiming', profile.transitionTiming === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>

          {/* 8. transitionIntent */}
          <div>
            <SectionTitle>지금 커리어 변화를 어느 정도로 생각하고 있나요?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TRANSITION_INTENT.map((o) => (
                <PillButton
                  key={o.value}
                  active={profile.transitionIntent === o.value}
                  label={o.label}
                  onClick={() => setField('transitionIntent', profile.transitionIntent === o.value ? undefined : o.value)}
                />
              ))}
            </div>
          </div>
        </GroupCard>

        {/* ── Group D: 지금의 결 ── concernTags / constraintTags / desiredPaths ── */}
        <GroupCard label="지금의 결">
          {/* 9. concernTags */}
          <div>
            <SectionTitle>지금 고민에 가까운 것을 모두 골라주세요.</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CONCERN_TAGS.map((o) => (
                <PillButton
                  key={o.value}
                  active={(profile.concernTags ?? []).includes(o.value)}
                  label={o.label}
                  onClick={() => toggleTag('concernTags', o.value)}
                />
              ))}
            </div>
          </div>

          {/* 10. constraintTags — special rules (see toggleConstraintTag).
              Disabled state: when at cap (2 real tags), non-selected non-`none` pills
              are visually disabled. `none` is always interactive — clicking it clears
              the rest. When `none` is already selected, real tags are NOT disabled
              (clicking one replaces `none`). */}
          <div>
            <SectionTitle>지금 가장 크게 걸리는 현실 조건은 무엇인가요? 최대 2개까지 골라주세요.</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CONSTRAINT_TAGS.map((o) => {
                const isSelected = (profile.constraintTags ?? []).includes(o.value);
                const isNone = o.value === CONSTRAINT_NONE;
                const disabled = !isSelected && !isNone && constraintAtCap && !constraintNoneSelected;
                return (
                  <PillButton
                    key={o.value}
                    active={isSelected}
                    disabled={disabled}
                    label={o.label}
                    onClick={() => toggleConstraintTag(o.value)}
                  />
                );
              })}
            </div>
          </div>

          {/* 11. desiredPaths */}
          <div>
            <SectionTitle>지금 관심 있는 다음 경로가 있다면 골라주세요. 아직 없어도 괜찮아요.</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {DESIRED_PATHS.map((o) => (
                <PillButton
                  key={o.value}
                  active={(profile.desiredPaths ?? []).includes(o.value)}
                  label={o.label}
                  onClick={() => toggleTag('desiredPaths', o.value)}
                />
              ))}
            </div>
          </div>
        </GroupCard>
      </main>

      {/* Sticky bottom action bar — pre-flow placement: the next screen is the main
          question flow, not the result. CTA copy reflects that. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            질문 시작하기 <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
