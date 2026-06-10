// Career Compass — P3.8 Hybrid: profile review screen.
//
// Stateless presentational summary card. Shows every PROFILE_CHAT_STEPS field
// with the user's current answer and a per-row "수정" button. Bottom CTAs:
//   • "이대로 진행하기"      → advances to the main questionnaire
//   • "처음부터 다시 입력하기" → resets profile + cursor (caller-handled)
//
// The container (HybridFlowView) owns state: this component only renders.
//
// Internal label name + UserProfile structure are NOT modified — this is the
// review surface only.

import type { UserProfile } from '../../types/careerCompass.ts';
import { PROFILE_CHAT_STEPS, optionLabelFor, multiLabelFor } from '../../lib/chatFlow.ts';
import type { ChatStep } from '../../lib/chatFlow.ts';

// Short Korean label per UserProfile field for the review row title.
const FIELD_TITLE: Record<string, string> = {
  ageBand:             '연령대',
  jobRoleRaw:          '하는 일',
  totalCareerStage:    '전체 경력',
  currentFieldStage:   '현재 분야 경력',
  workMode:            '일하는 방식',
  transitionTiming:    '변화 가능 시점',
  transitionIntent:    '변화에 대한 마음',
  concernTags:         '커리어 고민',
  constraintTags:      '현실적 제약',
  desiredPaths:        '관심 방향',
};

interface ProfileSummaryReviewProps {
  profile: UserProfile;
  onEditStep: (cursor: number) => void;  // jump back to a specific profile step
  onConfirm: () => void;                  // 이대로 진행하기
  onRestartProfile: () => void;          // 처음부터 다시 입력하기
}

function renderAnswerFor(step: Extract<ChatStep, { phase: 'profile' }>, profile: UserProfile): string {
  const v = (profile as Record<string, unknown>)[step.targetField];
  if (v === undefined) return '건너뜀';
  if (step.answerType === 'text') {
    return typeof v === 'string' && v.length > 0 ? v : '건너뜀';
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '건너뜀';
    return multiLabelFor(step, v as string[]);
  }
  return optionLabelFor(step, v as string);
}

export default function ProfileSummaryReview({
  profile,
  onEditStep,
  onConfirm,
  onRestartProfile,
}: ProfileSummaryReviewProps) {
  // PROFILE_CHAT_STEPS is the source of truth for which fields exist + their
  // order. We index by position so onEditStep can return the user to the
  // right slot in the chat container.
  const rows = PROFILE_CHAT_STEPS
    .map((step, idx) => ({ step, idx }))
    .filter((r): r is { step: Extract<ChatStep, { phase: 'profile' }>; idx: number } =>
      r.step.phase === 'profile');

  return (
    <main className="w-full max-w-2xl mx-auto px-4 pt-5 pb-10">
      {/* Header — light, conversational tone */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: '#9488B8' }}>
          입력한 정보
        </p>
        <h1 className="mt-1 text-xl font-bold leading-snug" style={{ color: '#3F3F46' }}>
          이대로 진행할까요?
        </h1>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: '#8C7EB4' }}>
          본 질문으로 넘어가기 전에, 답해주신 내용을 한 번 확인해주세요. 고치고 싶은 항목이 있으면 옆의 "수정"을 눌러주세요.
        </p>
      </div>

      {/* Review rows — 결과지 손그림 카드(cc-sketch-q)와 동일한 디자인 언어 */}
      <section className="cc-sketch-q bg-white overflow-hidden">
        {rows.map(({ step, idx }) => {
          const answer = renderAnswerFor(step, profile);
          const isSkipped = answer === '건너뜀';
          return (
            <div key={step.id} className="flex items-start gap-3 px-4 py-3" style={idx > 0 ? { borderTop: '1px solid rgba(120,100,160,0.14)' } : undefined}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: '#9488B8' }}>
                  {FIELD_TITLE[step.targetField] ?? step.targetField}
                </p>
                <p
                  className={['mt-0.5 text-[15px] leading-snug break-words', isSkipped ? 'italic' : ''].join(' ')}
                  style={{ color: isSkipped ? '#A8A2BC' : '#3F3F46' }}
                >
                  {answer}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(idx)}
                className="shrink-0 text-xs font-semibold px-2 py-1 rounded-lg transition-colors hover:bg-[#F3EEFC]"
                style={{ color: '#8C6FD6' }}
              >
                수정
              </button>
            </div>
          );
        })}
      </section>

      {/* Bottom CTAs */}
      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3.5 rounded-2xl text-white font-bold transition-colors hover:bg-[#7C5FCC]"
          style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.25)' }}
        >
          이대로 진행하기
        </button>
        <button
          type="button"
          onClick={onRestartProfile}
          className="w-full py-3 rounded-2xl bg-white text-sm transition-colors hover:bg-[#FAF7FF]"
          style={{ border: '1.5px solid rgba(120,100,160,0.25)', color: '#8C7EB4' }}
        >
          처음부터 다시 입력하기
        </button>
      </div>
    </main>
  );
}
