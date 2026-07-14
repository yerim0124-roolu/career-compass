import type { QuestionStep } from '../../types/careerCompass.ts';
import type { StepResponse2 } from './session';
import SelectableCard from './SelectableCard';
import MultiSelectCardGrid from './MultiSelectCardGrid';
import ForcedChoiceCard from './ForcedChoiceCard';
import RankingCards from './RankingCards';

interface Props {
  step: QuestionStep;
  value: StepResponse2;
  onChange: (v: StepResponse2) => void;
}

export default function QuestionStepRenderer({ step, value, onChange }: Props) {
  const options = step.options ?? [];

  switch (step.inputType) {
    case 'single_select':
      return (
        <div className="space-y-2.5">
          {options.map((o) => (
            <SelectableCard
              key={o.id}
              label={o.label}
              description={o.description}
              selected={value.selectedOptionIds?.[0] === o.id}
              onClick={() => onChange({ ...value, selectedOptionIds: [o.id] })}
            />
          ))}
        </div>
      );

    case 'multi_select': {
      const selectedIds = value.selectedOptionIds ?? [];
      const onToggle = (id: string) => {
        const has = selectedIds.includes(id);
        if (!has && step.maxSelect !== undefined && selectedIds.length >= step.maxSelect) return;
        const next = has ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
        onChange({ ...value, selectedOptionIds: next });
      };
      // 질문 본문(assistantPrompt)에는 선택 개수 제한을 넣지 않는다. 선택 제한 안내는
      // step.maxSelect를 보고 렌더러가 일관된 문구로 자동 생성한다(문항별 하드코딩 없음).
      return (
        <div className="space-y-2">
          {step.maxSelect !== undefined && (
            <p className="text-xs text-slate-400">최대 {step.maxSelect}개까지 선택 가능</p>
          )}
          <MultiSelectCardGrid options={options} selectedIds={selectedIds} maxSelect={step.maxSelect} onToggle={onToggle} />
          {/* 제한 안내와 중복되지 않는 간결한 선택 완료 수만 표시. */}
          <p className="text-xs text-slate-400">
            {step.maxSelect !== undefined ? `${selectedIds.length}/${step.maxSelect} 선택` : `${selectedIds.length}개 선택`}
            {step.minSelect ? ` · 최소 ${step.minSelect}개` : ''}
          </p>
        </div>
      );
    }

    case 'forced_choice':
      return (
        <ForcedChoiceCard
          options={options}
          selectedId={value.selectedOptionIds?.[0]}
          onSelect={(id) => onChange({ ...value, selectedOptionIds: [id] })}
        />
      );

    case 'ranking':
      return (
        <RankingCards
          options={options}
          ranking={value.ranking ?? []}
          maxSelect={step.maxSelect}
          onChange={(ranking) => onChange({ ...value, ranking })}
        />
      );

    case 'optional_short_text':
      return (
        <div className="space-y-2">
          <textarea
            value={value.shortText ?? ''}
            onChange={(e) => onChange({ ...value, shortText: e.target.value })}
            rows={2}
            maxLength={200}
            placeholder="예: 올해는 너무 무리하지 않기"
            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
          />
          <p className="text-xs text-slate-400">선택 사항이에요. 건너뛰어도 됩니다.</p>
        </div>
      );

    case 'slider_group':
      return (
        <div className="space-y-4">
          {(step.sliders ?? []).map((s) => {
            const v = value.sliderValues?.[s.id] ?? Math.round((s.min + s.max) / 2);
            return (
              <label key={s.id} className="block">
                <span className="flex justify-between text-sm text-slate-700 mb-1">
                  <span>{s.label}</span>
                  <span className="font-semibold text-indigo-600">{v}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step ?? 1}
                  value={v}
                  onChange={(e) => onChange({ ...value, sliderValues: { ...value.sliderValues, [s.id]: Number(e.target.value) } })}
                  className="w-full accent-indigo-600"
                />
              </label>
            );
          })}
        </div>
      );

    default:
      return null;
  }
}
