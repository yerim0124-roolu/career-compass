import type { OptionKey } from '../types';

interface OptionItem {
  key: OptionKey;
  label: string;
  description: string;
  icon: string;
}

const OPTIONS: OptionItem[] = [
  { key: 'stay',             label: '현 직장 유지',          description: '지금 회사에서 계속 일하기',          icon: '🏢' },
  { key: 'jobChange',        label: '이직 준비',                 description: '이직 가능성 알아보기',                  icon: '🚀' },
  { key: 'careerSwitch',     label: '직무 전환',             description: '다른 직종/직무로 바꾸기',             icon: '🔄' },
  { key: 'restAfterQuit',    label: '퇴사 후 휴식',          description: '잠시 쉬며 재정비하기',               icon: '🌿' },
  { key: 'startupFreelance', label: '창업/프리랜서',         description: '독립적으로 일 시작하기',              icon: '💡' },
  { key: 'studyReskill',     label: '공부/자격증/부트캠프',  description: '역량 개발에 집중하기',                icon: '📚' },
];

interface Props {
  selected: OptionKey[];
  onChange: (keys: OptionKey[]) => void;
}

export default function OptionCheckbox({ selected, onChange }: Props) {
  const toggle = (key: OptionKey) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const checked = selected.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              aria-pressed={checked}
              aria-label={`${opt.label} 선택 ${checked ? '해제' : '추가'}`}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                checked
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${checked ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{opt.description}</div>
              </div>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
              }`}>
                {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-sm text-slate-400 text-center pt-1">
          선택하지 않으면 모든 선택지를 분석합니다.
        </p>
      )}
    </div>
  );
}
