import type { MoveRecommendation, OptionReadiness } from '../../types/careerCompass.ts';

const READINESS_BADGE: Record<OptionReadiness, { text: string; cls: string }> = {
  now: { text: '지금', cls: 'bg-emerald-100 text-emerald-700' },
  prepareAfter: { text: '준비 후', cls: 'bg-amber-100 text-amber-700' },
  conditional: { text: '조건부', cls: 'bg-blue-100 text-blue-700' },
  pause: { text: '보류', cls: 'bg-slate-200 text-slate-600' },
};

interface Props {
  title: string;
  move: MoveRecommendation;
  accent?: boolean;
}

export default function PortfolioResultCard({ title, move, accent }: Props) {
  const badge = READINESS_BADGE[move.readiness];
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-slate-400">{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
      </div>
      <p className="font-bold text-slate-900 text-[15px]">{move.label}</p>
      <p className="text-sm text-slate-600 leading-relaxed mt-1">{move.rationale}</p>
    </div>
  );
}
