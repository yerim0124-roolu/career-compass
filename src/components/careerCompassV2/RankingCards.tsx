import type { ChoiceOption } from '../../types/careerCompass.ts';
import SelectableCard from './SelectableCard';

interface Props {
  options: ChoiceOption[];
  ranking: string[];
  maxSelect?: number;
  onChange: (ranking: string[]) => void;
}

export default function RankingCards({ options, ranking, maxSelect, onChange }: Props) {
  const ranked = ranking.map((id) => options.find((o) => o.id === id)).filter((o): o is ChoiceOption => !!o);
  const unranked = options.filter((o) => !ranking.includes(o.id));
  const atMax = maxSelect !== undefined && ranking.length >= maxSelect;

  const add = (id: string) => onChange([...ranking, id]);
  const remove = (id: string) => onChange(ranking.filter((x) => x !== id));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...ranking];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {ranked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">선택한 순서 (위일수록 중요)</p>
          {ranked.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <div className="flex-1">
                <SelectableCard label={o.label} selected rank={i + 1} onClick={() => remove(o.id)} />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs disabled:opacity-30" aria-label="위로">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === ranked.length - 1}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs disabled:opacity-30" aria-label="아래로">▼</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {unranked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">탭하면 순서에 추가됩니다</p>
          <div className="grid grid-cols-2 gap-2.5">
            {unranked.map((o) => (
              <SelectableCard key={o.id} label={o.label} selected={false} disabled={atMax} onClick={() => add(o.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
