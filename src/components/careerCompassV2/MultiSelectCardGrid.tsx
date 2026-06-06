import type { ChoiceOption } from '../../types/careerCompass.ts';
import SelectableCard from './SelectableCard';

interface Props {
  options: ChoiceOption[];
  selectedIds: string[];
  maxSelect?: number;
  onToggle: (id: string) => void;
}

export default function MultiSelectCardGrid({ options, selectedIds, maxSelect, onToggle }: Props) {
  const atMax = maxSelect !== undefined && selectedIds.length >= maxSelect;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {options.map((o) => {
        const selected = selectedIds.includes(o.id);
        return (
          <SelectableCard
            key={o.id}
            label={o.label}
            description={o.description}
            selected={selected}
            disabled={!selected && atMax}
            onClick={() => onToggle(o.id)}
          />
        );
      })}
    </div>
  );
}
