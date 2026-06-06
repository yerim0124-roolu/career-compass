import type { ReactNode } from 'react';
import type { QuestionStep } from '../../types/careerCompass.ts';

interface Props {
  step: QuestionStep;
  children: ReactNode;
}

// Visually chat-like: an assistant bubble with the prompt, then the selectable input.
export default function ChatLikeFlow({ step, children }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm" aria-hidden>🧭</span>
        <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-4 py-3 max-w-prose">
          <p className="text-[15px] text-slate-800 leading-relaxed font-medium">{step.assistantPrompt}</p>
          {step.helperText && <p className="text-xs text-slate-400 mt-1.5">{step.helperText}</p>}
        </div>
      </div>
      <div className="sm:pl-11">{children}</div>
    </div>
  );
}
