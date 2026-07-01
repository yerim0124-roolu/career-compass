// Career Compass — 유료 심화 분석 결과 화면 (아직 플레이스홀더).
//
// 2단계에서는 여전히 자리만 잡는다. 다만 심화 문항(PaidQuestionsView)에서 모은
// paidAnswers를 prop으로 받도록 배선해 둔다 — 3단계에서 이 객체를 AI 프롬프트에
// 주입해 실제 결과를 렌더할 예정. 접근 게이팅은 App.tsx의 FEATURE_FLAGS에서 처리.

import type { PaidAnswers } from './paidTypes.ts';

interface Props {
  paidAnswers?: PaidAnswers | null;
}

export default function PaidResultView({ paidAnswers }: Props = {}) {
  const isDev = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
  const answered = paidAnswers
    ? Object.values(paidAnswers).filter((v) => (Array.isArray(v) ? v.length > 0 : v !== '')).length
    : 0;

  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-2xl" aria-hidden>🧭</p>
        <h1 className="text-lg font-black text-slate-800">유료 심화 분석</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          유료 분석 결과가 여기 표시됩니다 (준비 중).
        </p>
        {isDev && paidAnswers && (
          <p className="text-[11px] text-slate-400">[dev] 심화 답변 {answered}개 항목 수신됨</p>
        )}
      </div>
    </div>
  );
}
