interface Props {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  rank?: number;       // when part of a ranking, shows the order number
  disabled?: boolean;
}

export default function SelectableCard({ label, description, selected, onClick, rank, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'w-full text-left rounded-2xl border p-4 transition-all duration-150 flex items-start gap-3',
        selected
          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {rank !== undefined && (
        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
          {rank}
        </span>
      )}
      <span className="flex-1">
        <span className={`block font-semibold text-[15px] ${selected ? 'text-indigo-700' : 'text-slate-800'}`}>{label}</span>
        {description && <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{description}</span>}
      </span>
      {selected && rank === undefined && (
        <span className="shrink-0 text-indigo-600 mt-0.5" aria-hidden>✓</span>
      )}
    </button>
  );
}
