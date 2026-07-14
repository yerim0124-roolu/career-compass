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
        {/* 질문 = '묻는 것': 채운 라벤더 말풍선(테두리 없음, 말풍선 모서리, 굵게). 선택지(흰 손그림 카드)와 형태로 구분. */}
        <div className="px-5 py-4 max-w-prose" style={{ background: '#EDE7F9', borderRadius: '4px 16px 16px 16px' }}>
          {/* 표시 전용 소라벨 — 연속 비교 문항을 '반복'이 아니라 '비교 과정(1/3…)'으로 알려준다. */}
          {step.comparisonLabel && <p className="text-[11px] mb-1.5 font-black tracking-wide uppercase" style={{ color: '#8C6FD6' }}>{step.comparisonLabel}</p>}
          <p className="text-[15px] leading-relaxed font-bold" style={{ color: '#3F3F46' }}>{step.assistantPrompt}</p>
          {step.helperText && <p className="text-xs mt-1.5 font-normal" style={{ color: '#7C6FAE' }}>{step.helperText}</p>}
        </div>
      </div>
      <div className="sm:pl-11">{children}</div>
    </div>
  );
}
