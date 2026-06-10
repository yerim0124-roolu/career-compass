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
        <span className="shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #A98FE0, #8C6FD6)' }} aria-hidden>🧭</span>
        <div className="cc-sketch-q px-4 py-3 max-w-prose" style={{ background: '#FBF9FF' }}>
          <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#3F3F46' }}>{step.assistantPrompt}</p>
          {step.helperText && <p className="text-xs mt-1.5" style={{ color: '#8C7EB4' }}>{step.helperText}</p>}
        </div>
      </div>
      <div className="sm:pl-11">{children}</div>
    </div>
  );
}
