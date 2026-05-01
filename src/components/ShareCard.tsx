import { useRef, useState } from 'react';
import type { Results, FormData } from '../types';

interface Props {
  results: Results;
  form: FormData;
}

function ScoreCircle({ label, value }: { label: string; value: number }) {
  const colorCls =
    value >= 70 ? 'text-emerald-300 border-emerald-500/40' :
    value >= 50 ? 'text-indigo-300 border-indigo-400/40' :
    value >= 30 ? 'text-amber-300 border-amber-400/40' :
    'text-red-300 border-red-400/40';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-14 h-14 rounded-full border-2 ${colorCls} flex items-center justify-center`}>
        <span className={`text-xl font-black ${colorCls.split(' ')[0]}`}>{Math.round(value)}</span>
      </div>
      <span className="text-[10px] text-white/50 text-center leading-tight font-medium">{label}</span>
    </div>
  );
}

// Map primaryOptionKey → CTA; recovery strategies override regardless of key
const OPTION_CTA: Partial<Record<string, string>> = {
  jobChange:        '재직 중 이직 탐색 전략 추천',
  stay:             '현 직장 직무 재설계 전략 추천',
  careerSwitch:     '3개월 직무 전환 준비 전략 추천',
  restAfterQuit:    '구조화된 회복 + 복귀 계획 추천',
  startupFreelance: '재직 중 고객 검증 전략 추천',
  studyReskill:     '재직 중 역량 강화 전략 추천',
};

export default function ShareCard({ results, form: _form }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const { derived, strategy, careerDiagnosis } = results;

  const primaryStrategy = strategy.primaryStrategy;
  const primaryOptionKey = strategy.primaryOptionKey;
  const directionLabel = careerDiagnosis.directionLabel;

  const marketPct  = Math.round((derived.marketReadiness - 1) / 4 * 100);
  const changePct  = Math.round(derived.explorationDrive);
  const financePct = Math.round(derived.financialSafetyBase);

  // CTA derives from primaryStrategy text — must match rule: each strategy → one CTA.
  function resolveCTA(ps: string, optKey: string): string {
    if (ps.includes('회복'))              return '회복 후 저강도 탐색 전략 추천';
    if (ps.includes('사이드 프로젝트'))   return '재직 중 사이드 프로젝트 + 이직 병행 전략 추천';
    if (ps.includes('재직 중 이직 탐색')) return '재직 중 이직 탐색 전략 추천';
    if (ps.includes('창업/프리랜서 실행')) return '퇴사 전 고객 검증 전략 추천';
    if (ps.includes('적극적 이직 탐색')) return '이직 + 창업 병행 전략 추천';
    if (ps.includes('준비도 강화') || ps.includes('준비 후')) return '이직 준비도 강화 전략 추천';
    if (ps.includes('현 직장 유지') || ps.includes('직무 재설계')) return '현 직장 직무 재설계 전략 추천';
    if (ps.includes('추가 정보 수집') || ps.includes('보류')) return '현황 점검 후 방향 결정 추천';
    return OPTION_CTA[optKey] ?? '맞춤 커리어 전략 추천';
  }
  const cta = resolveCTA(primaryStrategy, primaryOptionKey);

  const copyToClipboard = () => {
    const text = [
      `[ Career Compass — ${directionLabel} ]`,
      '',
      `전략: ${primaryStrategy}`,
      '',
      `이직 경쟁력:  ${marketPct}/100`,
      `변화 의지:    ${changePct}/100`,
      `재무 안전성:  ${financePct}/100`,
      '',
      cta,
      '',
      '— Career Compass (현재 입력값 기준)',
    ].join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopyNotice('결과가 복사되었습니다.');
        window.setTimeout(() => setCopyNotice(null), 2000);
      },
      () => {
        setCopyNotice('복사에 실패했습니다. 다시 시도해 주세요.');
        window.setTimeout(() => setCopyNotice(null), 2500);
      }
    );
  };

  return (
    <div className="space-y-3">

      {/* Share card */}
      <div
        ref={cardRef}
        className="rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
      >
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #10b981)' }} />

        <div className="px-6 pt-6 pb-8">
          {/* Branding */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-black text-white/30 tracking-widest uppercase">Career Compass</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/30">현재 입력값 기준</span>
          </div>

          {/* Hero — direction label as main identity */}
          <div className="mb-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">나는 지금</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight">
              {directionLabel}
            </h2>
          </div>

          {/* Primary strategy as the strategic label */}
          <div className="bg-white/8 border border-white/10 rounded-xl px-4 py-3 mb-5">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">핵심 전략</p>
            <p className="text-sm font-bold text-white/90 leading-snug">{primaryStrategy}</p>
          </div>

          <div className="flex justify-end mb-4 opacity-60">
            <img src="/working-cats.png" alt="" className="w-20 h-auto object-contain" />
          </div>

          <div className="h-px bg-white/10 mb-4" />

          {/* 3 scores */}
          <div className="flex justify-around mb-5">
            <ScoreCircle label="이직 경쟁력"  value={marketPct} />
            <ScoreCircle label="변화 의지"    value={changePct} />
            <ScoreCircle label="재무 안전성"  value={financePct} />
          </div>

          {/* CTA strip */}
          <div className="bg-white/8 rounded-2xl px-4 py-3 border border-white/10">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1">전략 추천</p>
            <p className="text-sm font-bold text-white">{cta}</p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={copyToClipboard}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-semibold py-3 rounded-xl text-sm transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          결과 복사
        </button>
        <button onClick={() => window.print()}
          className="flex items-center justify-center gap-2 border-2 border-stone-200 hover:bg-stone-50 text-slate-700 font-semibold py-3 rounded-xl text-sm transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          저장 / 인쇄
        </button>
      </div>
      {copyNotice && (
        <p className="text-xs text-center text-slate-500">{copyNotice}</p>
      )}
    </div>
  );
}
