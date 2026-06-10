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
              'cc-sketch-q p-4 text-left transition-colors duration-150 min-h-[112px] flex flex-col gap-2',
              selected ? 'bg-[#EFEAFB]' : 'bg-white hover:bg-[#FAF7FF]',
            ].join(' ')}
          >
            <span className="text-xs font-bold" style={{ color: selected ? '#8C6FD6' : '#A8A2BC' }}>{i === 0 ? 'A' : 'B'}</span>
            <span className="font-semibold text-[15px] leading-snug" style={{ color: selected ? '#5B3FB2' : '#3F3F46' }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
