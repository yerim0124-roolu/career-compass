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
        'cc-sketch-q w-full text-left p-3.5 transition-colors duration-150 flex items-start gap-3',
        selected ? 'bg-[#EFEAFB]' : 'bg-white hover:bg-[#FAF7FF]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {rank !== undefined && (
        <span className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5" style={{ background: '#8C6FD6' }}>
          {rank}
        </span>
      )}
      <span className="flex-1">
        <span className="block font-semibold text-[15px]" style={{ color: selected ? '#5B3FB2' : '#3F3F46' }}>{label}</span>
        {description && <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{description}</span>}
      </span>
      {selected && rank === undefined && (
        <span className="shrink-0 mt-0.5" style={{ color: '#8C6FD6' }} aria-hidden>✓</span>
      )}
    </button>
  );
}
