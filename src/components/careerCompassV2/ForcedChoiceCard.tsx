import type { ChoiceOption } from '../../types/careerCompass.ts';

interface Props {
  options: ChoiceOption[]; // exactly two
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function ForcedChoiceCard({ options, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.slice(0, 2).map((o, i) => {
        const selected = selectedId === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={selected}
            className={[
              'rounded-2xl border p-5 text-left transition-all duration-150 min-h-[112px] flex flex-col gap-2',
              selected
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50',
            ].join(' ')}
          >
            <span className={`text-xs font-bold ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>{i === 0 ? 'A' : 'B'}</span>
            <span className={`font-semibold text-[15px] leading-snug ${selected ? 'text-indigo-700' : 'text-slate-800'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
