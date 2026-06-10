// Career Compass 3.0 — P3.0 choice pill primitive.
// Single button. Supports a "selected" visual state for multi_select / ranking
// previews where the user can toggle multiple options before tapping "다음".
//
// Stateless: the parent owns the selection state and re-renders.

interface ChatChoiceButtonProps {
  label: string;
  description?: string;
  // Visual "selected" state for multi-step accumulation (multi_select, ranking).
  selected?: boolean;
  // Optional ranking ordinal — when set, shown as a small badge before the label.
  rankBadge?: number;
  onClick: () => void;
  disabled?: boolean;
  // Variant: 'primary' = default answer choice; 'ghost' = skip/secondary;
  // 'cta' = advance/proceed button (e.g. "다음").
  variant?: 'primary' | 'ghost' | 'cta';
}

export default function ChatChoiceButton({
  label,
  description,
  selected = false,
  rankBadge,
  onClick,
  disabled = false,
  variant = 'primary',
}: ChatChoiceButtonProps) {
  let cls = '';
  if (variant === 'ghost') {
    cls = 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300';
  } else if (variant === 'cta') {
    cls = 'border-[#8C6FD6] bg-[#8C6FD6] text-white hover:bg-[#7C5FCC]';
  } else if (selected) {
    cls = 'border-[#C7B6E6] bg-[#EFEAFB] text-[#5B3FB2]';
  } else {
    cls = 'border-[rgba(120,100,160,0.25)] bg-white text-[#3F3F46] hover:border-[#C7B6E6] hover:bg-[#FAF7FF]';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={variant === 'primary' ? selected : undefined}
      className={[
        'w-full text-left rounded-2xl border px-4 py-3 transition',
        'shadow-[0_1px_0_rgba(15,23,42,0.02)]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.99]',
        cls,
      ].join(' ')}
    >
      <span className="flex items-baseline gap-2">
        {typeof rankBadge === 'number' && (
          <span
            className={[
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
              selected || variant === 'cta'
                ? 'bg-[#8C6FD6] text-white'
                : 'bg-slate-200 text-slate-700',
            ].join(' ')}
            aria-hidden
          >
            {rankBadge}
          </span>
        )}
        <span className="text-[15px] font-semibold leading-snug">{label}</span>
      </span>
      {description && (
        <span className="block mt-1 text-xs text-slate-500 leading-relaxed">{description}</span>
      )}
    </button>
  );
}
