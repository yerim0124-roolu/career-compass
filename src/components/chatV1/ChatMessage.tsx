// Career Compass 3.0 — P3.0 chat bubble primitive.
// Stateless presentational component. No business logic, no state.
//
// Layout decisions baked in:
//   • Bot bubble:  left-aligned, soft slate-100 background, tucked top-left corner.
//   • User bubble: right-aligned, indigo-600 background, white text.
//   • max-w-[88%] on mobile / 78% on sm+ keeps long Korean lines from edge-to-edge,
//     while `whitespace-pre-wrap break-words` lets natural wrapping handle the rest.
//   • `\n` in the children is preserved (whitespace-pre-wrap), so multi-line
//     prompts authored with embedded line breaks render as paragraphs.

import type { ReactNode } from 'react';

interface ChatMessageProps {
  variant: 'bot' | 'user';
  children: ReactNode;
  // Optional eyebrow rendered above the bubble (e.g. small section label).
  eyebrow?: string;
}

export default function ChatMessage({ variant, children, eyebrow }: ChatMessageProps) {
  const isBot = variant === 'bot';
  return (
    <div className={isBot ? 'w-full flex justify-start' : 'w-full flex justify-end'}>
      <div className="max-w-[88%] sm:max-w-[78%]">
        {eyebrow && (
          <p
            className={[
              'mb-1 text-[11px] font-semibold tracking-wide text-slate-400',
              isBot ? 'text-left pl-1' : 'text-right pr-1',
            ].join(' ')}
          >
            {eyebrow}
          </p>
        )}
        <div
          className={[
            'whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-[0_1px_0_rgba(15,23,42,0.02)]',
            isBot
              ? 'bg-slate-100 text-slate-900 rounded-tl-md'
              : 'bg-indigo-600 text-white rounded-tr-md',
          ].join(' ')}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
