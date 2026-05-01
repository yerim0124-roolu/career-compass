interface Props {
  onStart: () => void;
}

const features = [
  {
    icon: '📊',
    title: '현실 기반 분석',
    description: '재정 런웨이, 번아웃 위험도, 시장 경쟁력을 수치로 계산해 실질적인 선택지를 제시합니다.',
    gradient: 'from-indigo-500/10 to-blue-500/10',
    border: 'border-indigo-200/60',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    icon: '🎯',
    title: '커리어 성향 분석',
    description: '8가지 연구 기반 성향 지표로 커리어 결정 패턴과 실행 준비도를 측정합니다.',
    gradient: 'from-violet-500/10 to-purple-500/10',
    border: 'border-violet-200/60',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    icon: '🌊',
    title: '타이밍 참고 분석',
    description: '변화 욕구, 안정 욕구, 회복 필요성을 조합해 지금이 이동할 시기인지 점검합니다.',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    border: 'border-emerald-200/60',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
];

const stats = [
  { value: '6가지', label: '선택지 비교' },
  { value: '8개',  label: '성향 지표 측정' },
  { value: '30일', label: '맞춤 실행 계획' },
];

export default function LandingPage({ onStart }: Props) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">

      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #e0e7ff 1.5px, transparent 1.5px)',
          backgroundSize: '30px 30px',
          opacity: 0.55,
        }}
      />
      {/* Radial colour wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-white/60 to-violet-50/60 pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <header className="max-w-4xl mx-auto px-5 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🧭</span>
            <span className="font-black text-indigo-700 text-lg tracking-tight">Career Compass</span>
          </div>
          <span className="text-xs text-slate-500 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 shadow-sm font-medium">
            무료 · 익명 · 3분
          </span>
        </header>

        {/* Hero */}
        <main className="max-w-3xl mx-auto px-5 pt-14 pb-10 text-center">
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 mb-7">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase">커리어 의사결정 시뮬레이터</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.15] mb-6 tracking-tight">
            지금 회사에 남을까,<br />
            <span className="text-indigo-600">이직</span>할까,{' '}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              퇴사 후 재정비
            </span>할까?
          </h1>

          <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto leading-relaxed mb-10">
            감정이 아니라{' '}
            <strong className="text-slate-700 font-semibold">커리어 상태, 재정 여력, 번아웃, 성향, 타이밍</strong>을
            함께 비교해 더 나은 선택지를 찾아드립니다.
          </p>

          {/* Hero illustration */}
          <div className="flex flex-col items-center mb-10">
            <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-4 shadow-sm inline-flex flex-col items-center">
              <img
                src="/working-cats.png"
                alt="커리어를 고민하는 고양이들"
                className="w-full max-w-[240px] sm:max-w-[300px]"
              />
              <p className="mt-3 text-xs text-slate-500 text-center leading-relaxed max-w-[280px]">
                분석 고양이와 전략 고양이가 지금의 커리어 선택지를 함께 정리해드립니다.
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onStart}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-bold text-lg px-9 py-4 rounded-2xl shadow-xl shadow-indigo-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-300/60"
          >
            내 커리어 선택지 분석하기
            <span className="text-xl transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>

          <p className="mt-4 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            외부 서버 전송 없음 — 브라우저에서만 계산
          </p>
        </main>

        {/* Stats row */}
        <div className="max-w-3xl mx-auto px-5 mb-10">
          <div className="bg-white/70 backdrop-blur border border-slate-200/80 rounded-2xl shadow-sm grid grid-cols-3 divide-x divide-slate-200/80">
            {stats.map((s) => (
              <div key={s.label} className="py-5 text-center">
                <div className="text-2xl font-black text-indigo-600 leading-none mb-1">{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <section className="max-w-3xl mx-auto px-5 pb-16">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest text-center mb-5">
            3가지 분석 레이어
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className={`bg-gradient-to-br ${f.gradient} border ${f.border} rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default`}
              >
                <div className={`${f.iconBg} w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 shadow-sm`}>
                  <span>{f.icon}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer disclaimer */}
        <div className="text-center pb-10 px-5 border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            본 서비스는 커리어 의사결정 참고용 시뮬레이션입니다. 성향·타이밍 분석은 자기 이해를 돕는 보조 도구입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
