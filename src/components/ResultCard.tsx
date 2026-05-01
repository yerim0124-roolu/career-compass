import { useState } from 'react';
import type { OptionScore, OptionReadiness } from '../types';
import ScoreBar from './ScoreBar';

interface Props {
  score: OptionScore;
  rank: number;
  badge?: 'best' | 'second' | 'avoid';
}

const BADGE_CONFIG = {
  best:   { label: '가장 추천',   cls: 'bg-slate-900 text-white' },
  second: { label: '보조 선택지', cls: 'bg-slate-600 text-white' },
  avoid:  { label: '주의 필요',   cls: 'bg-red-500 text-white' },
};

const READINESS_CONFIG: Record<OptionReadiness, { label: string; cls: string }> = {
  now:             { label: '지금 가능',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  prepareFirst:    { label: '준비 후 가능', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  conditional:     { label: '조건부 가능',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  notRecommended:  { label: '현재 비추천',  cls: 'bg-red-100 text-red-700 border-red-200' },
};

function scoreRing(s: number) {
  if (s >= 70) return { ring: 'ring-indigo-200 bg-indigo-50',   text: 'text-indigo-700' };
  if (s >= 50) return { ring: 'ring-emerald-200 bg-emerald-50', text: 'text-emerald-700' };
  if (s >= 35) return { ring: 'ring-amber-200 bg-amber-50',     text: 'text-amber-700' };
  return        { ring: 'ring-red-200 bg-red-50',               text: 'text-red-700' };
}

const RANK_LABELS = ['1위', '2위', '3위', '4위', '5위', '6위'];

export default function ResultCard({ score, rank, badge }: Props) {
  const [expanded, setExpanded] = useState(rank <= 2);
  const badgeCfg = badge ? BADGE_CONFIG[badge] : null;
  const { ring, text } = scoreRing(score.totalScore);

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
      badge === 'best'  ? 'border-slate-800 shadow-sm' :
      badge === 'avoid' ? 'border-red-200' :
      'border-stone-200 hover:border-slate-300'
    }`}>

      {/* Header */}
      <button
        className="w-full text-left px-4 py-4 flex items-center gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-black text-slate-400 w-5 text-center flex-shrink-0">{RANK_LABELS[rank - 1]}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-sm">{score.label}</span>
            {badgeCfg && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeCfg.cls}`}>{badgeCfg.label}</span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${READINESS_CONFIG[score.readinessStatus].cls}`}>
              {READINESS_CONFIG[score.readinessStatus].label}
            </span>
          </div>
          {/* Mini score bar */}
          <div className="mt-1.5 h-1.5 bg-stone-100 rounded-full overflow-hidden w-28">
            <div className="h-full bg-slate-700 rounded-full" style={{ width: `${score.totalScore}%` }} />
          </div>
        </div>

        {/* Score ring */}
        <div className={`ring-2 ${ring} w-14 h-14 rounded-full flex flex-col items-center justify-center flex-shrink-0`}>
          <span className={`text-lg font-black leading-none ${text}`}>{Math.round(score.totalScore)}</span>
          <span className="text-[9px] text-slate-400 mt-0.5">점</span>
        </div>

        <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-stone-100">

          {/* Recommended action — what to do now */}
          <div className="px-4 py-3 bg-slate-800 flex items-start gap-2.5">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-0.5 flex-shrink-0 w-14">다음 행동</span>
            <p className="text-xs font-bold text-white leading-relaxed">{score.recommendedAction}</p>
          </div>

          {/* Comparison summary — why it ranked here */}
          <div className="px-4 py-4 space-y-3 bg-stone-50/70">
            {score.matchReasons.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">이유</p>
                <ul className="space-y-1">
                  {score.matchReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {score.mismatchRisks.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">우려 사항</p>
                <ul className="space-y-1">
                  {score.mismatchRisks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {score.bestCondition && (
              <div className="bg-white border border-stone-200 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">최적 조건</p>
                <p className="text-xs text-slate-700 leading-relaxed">{score.bestCondition}</p>
              </div>
            )}
          </div>

          {/* Sub-scores */}
          <div className="px-4 py-4 space-y-2.5 border-t border-stone-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">세부 점수</p>
            <ScoreBar label="커리어 성장 가능성"           value={score.careerUpside}       color="bg-indigo-500" />
            <ScoreBar label="재정 안전성"                   value={score.financialSafety}    color="bg-emerald-500" />
            <ScoreBar label="심리적 회복력"                 value={score.mentalRecovery}     color="bg-sky-500" />
            <ScoreBar label="실행 난이도 (낮을수록 좋음)"   value={score.executionDifficulty} invert />
            <ScoreBar label="후회 위험도 (낮을수록 좋음)"   value={score.regretRisk}          invert />
          </div>

          {/* Bonus tags */}
          {(score.traitFitScore > 0 || score.flowFitScore > 0) && (
            <div className="px-4 pb-4 flex gap-2 flex-wrap border-t border-stone-100 pt-3">
              {score.traitFitScore > 0 && (
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1 font-medium">
                  성향 적합 +{score.traitFitScore}점
                </span>
              )}
              {score.flowFitScore > 0 && (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 font-medium">
                  흐름 +{score.flowFitScore}점
                </span>
              )}
            </div>
          )}

          {/* Warnings / Notes */}
          {score.warnings.length > 0 && (
            <div className="px-4 pb-4 space-y-2 border-t border-stone-100 pt-3">
              {score.warnings.map((w) => (
                <div key={w} className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-[10px] font-black">!</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">{w}</p>
                </div>
              ))}
            </div>
          )}
          {score.notes.map((n) => (
            <div key={n} className="px-4 pb-3 flex gap-2 bg-sky-50/50 border-t border-stone-100 pt-3">
              <div className="w-4 h-4 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sky-600 text-[10px] font-black">i</span>
              </div>
              <p className="text-xs text-sky-800 leading-relaxed">{n}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
