interface Props {
  current: number; // 1-based (counted position; for conditional steps = 직전 일반 문항 위치)
  total: number;
  stageLabel: string;
  canBack: boolean;
  onBack: () => void;
  // 조건부 후속 질문("추가 확인")에서는 'N/total' 대신 이 라벨을 보여주고, 진행률 바는
  // current(=직전 일반 문항 위치)를 유지한다. 없으면 기존 'stageLabel · current/total'.
  conditionalLabel?: string;
}

export default function ProgressHeader({ current, total, stageLabel, canBack, onBack, conditionalLabel }: Props) {
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
        <span className="text-xs font-medium" style={{ color: '#8C7EB4' }}>{conditionalLabel ?? `${stageLabel} · ${current}/${total}`}</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: '#ECE6FB' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #A98FE0, #8C6FD6)' }} />
      </div>
    </div>
  );
}
