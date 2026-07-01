// Career Compass — 유료 심화 분석 결과 화면 (1단계: 빈 자리만).
//
// 이 단계에서는 결제 / 문항 / AI 호출을 만들지 않는다. 라우트와 컴포넌트
// 자리만 잡아 두고, 플레이스홀더 텍스트만 표시한다. 실제 접근 게이팅은
// App.tsx에서 FEATURE_FLAGS.paidAnalysis로 처리한다(플래그 off면 홈으로
// 리다이렉트되어 이 컴포넌트는 렌더되지 않는다).

export default function PaidResultView() {
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-2xl" aria-hidden>🧭</p>
        <h1 className="text-lg font-black text-slate-800">유료 심화 분석</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          유료 분석 결과가 여기 표시됩니다 (준비 중).
        </p>
      </div>
    </div>
  );
}
