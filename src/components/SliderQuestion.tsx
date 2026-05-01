import { useId } from 'react';

interface Props {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  leftLabel?: string;
  rightLabel?: string;
}

const LEVEL_COLORS = [
  { bar: 'bg-rose-400',    thumb: 'bg-rose-400',    badge: 'bg-rose-100 text-rose-700 ring-rose-200' },
  { bar: 'bg-orange-400',  thumb: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700 ring-orange-200' },
  { bar: 'bg-amber-400',   thumb: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { bar: 'bg-emerald-400', thumb: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { bar: 'bg-indigo-500',  thumb: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
];

const STEP_LABELS = ['1', '2', '3', '4', '5'];

export default function SliderQuestion({
  label,
  sublabel,
  value,
  onChange,
  min = 1,
  max = 5,
  leftLabel = '매우 낮음',
  rightLabel = '매우 높음',
}: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const descId = `${id}-desc`;
  const pct = ((value - min) / (max - min)) * 100;
  const colors = LEVEL_COLORS[value - 1] ?? LEVEL_COLORS[4];

  return (
    <div className="space-y-2.5">
      {/* Label row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span id={labelId} className="font-semibold text-slate-800 text-sm leading-snug">{label}</span>
          {sublabel && (
            <p id={descId} className="text-xs text-slate-400 mt-0.5 leading-relaxed">{sublabel}</p>
          )}
        </div>
        {/* Value badge */}
        <span className={`text-sm font-black w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ${colors.badge}`}>
          {value}
        </span>
      </div>

      {/* Track */}
      <div className="relative py-2">
        {/* Background track */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} rounded-full transition-all duration-150`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Invisible native input overlaid on top */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ margin: 0, height: '100%' }}
          aria-labelledby={labelId}
          aria-describedby={sublabel ? descId : undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${label} ${value}점`}
        />

        {/* Visible thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${colors.thumb} border-[3px] border-white shadow-md transition-all duration-150 pointer-events-none`}
          style={{ left: `calc(${pct}% - 12px)` }}
        />
      </div>

      {/* Step dots + end labels */}
      <div className="relative">
        {/* 5 tick dots */}
        <div className="flex justify-between px-[11px]">
          {STEP_LABELS.map((_, i) => {
            const filled = i + 1 <= value;
            return (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-150 ${
                  filled ? colors.bar : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>
        {/* End labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-slate-400 font-medium">{leftLabel}</span>
          <span className="text-[11px] text-slate-400 font-medium">{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}
