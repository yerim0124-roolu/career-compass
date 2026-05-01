interface Props {
  label: string;
  value: number; // 0-100
  max?: number;
  color?: string;
  showValue?: boolean;
  invert?: boolean; // lower is better (difficulty / regret)
}

export default function ScoreBar({
  label,
  value,
  max = 100,
  color = 'bg-indigo-500',
  showValue = true,
  invert = false,
}: Props) {
  const pct = Math.min((value / max) * 100, 100);

  // Inverted bars switch colour based on severity
  const barColor = invert
    ? value > 60 ? 'bg-gradient-to-r from-red-400 to-rose-500'
    : value > 35 ? 'bg-gradient-to-r from-orange-400 to-amber-400'
    : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : color;

  const valuePillClass = invert
    ? value > 60 ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
    : value > 35 ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'
    : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
    : 'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 leading-snug">{label}</span>
        {showValue && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${valuePillClass}`}>
            {Math.round(value)}
          </span>
        )}
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
