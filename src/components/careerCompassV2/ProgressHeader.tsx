interface Props {
  current: number; // 1-based
  total: number;
  stageLabel: string;
  canBack: boolean;
  onBack: () => void;
}

export default function ProgressHeader({ current, total, stageLabel, canBack, onBack }: Props) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!canBack}
          className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30 flex items-center gap-1"
        >
          <span aria-hidden>←</span> 이전
        </button>
        <span className="text-xs font-medium text-slate-400">{stageLabel} · {current}/{total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
