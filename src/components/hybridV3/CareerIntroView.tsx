// CareerIntroView — 무료 질문 시작 전 '시작 안내 화면'(표시 전용).
//
// 연출: 제목 한 문장만 타이핑되듯 나타나고(한 글자 40ms, Unicode-safe), 완성 후 본문·CTA가
// fade-in한다. 타이핑 중 화면 클릭/Enter/Space는 애니메이션만 즉시 완료하며(질문 자동 시작
// 없음), 질문은 'CTA 클릭'으로만 시작된다. prefers-reduced-motion이면 모든 내용을 즉시 표시.
//
// 이 컴포넌트가 하지 않는 것: 점수 계산·세션 생성/저장·Supabase/paid-job/QStash/결제 호출 없음.
// onStart는 상위(HybridFlowView)의 기존 흐름 진입만 트리거한다(중복 호출 가드 포함).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  INTRO_TITLE, INTRO_TITLE_CHARS, INTRO_BODY_1, INTRO_BODY_2, INTRO_BODY_3,
  INTRO_FINAL_NOTE, INTRO_CTA_LABEL,
  INTRO_BODY_1_EMPHASIS, INTRO_BODY_2_EMPHASIS, INTRO_BODY_3_EMPHASIS, INTRO_FINAL_NOTE_EMPHASIS,
  TYPE_START_DELAY_MS, TYPE_CHAR_INTERVAL_MS, REVEAL_DELAY_MS, REVEAL_FADE_MS, CURSOR_HIDE_AFTER_MS,
} from './careerIntroGate.ts';

const PURPLE = '#8C6FD6';
const INK = '#3E356B';
const BOX_BG = '#F5F1FC';
const BOX_BORDER = '#E4DAF7';

// 지정 구절만 <strong>으로 감싸 렌더한다(문구 자체는 변형하지 않음 — 순수 표시).
// 긴 구절이 짧은 구절에 먼저 잡히지 않도록 길이 내림차순으로 매칭한다.
function withEmphasis(text: string, phrases: readonly string[], color?: string): ReactNode[] {
  const ordered = [...phrases].sort((a, b) => b.length - a.length);
  const pattern = ordered.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text.split(new RegExp(`(${pattern})`)).map((part, i) => (
    ordered.includes(part)
      ? <strong key={i} className="font-bold" style={{ color: color ?? INK }}>{part}</strong>
      : <span key={i}>{part}</span>
  ));
}

export default function CareerIntroView({ onStart }: { onStart: () => void }) {
  // 모션 감소 설정 사용자: 타이핑·커서 없이 전부 즉시 표시(§5).
  const [reducedMotion] = useState<boolean>(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const [typedCount, setTypedCount] = useState(reducedMotion ? INTRO_TITLE_CHARS.length : 0);
  const [revealed, setRevealed] = useState(reducedMotion);
  const [cursorGone, setCursorGone] = useState(reducedMotion);
  const startedRef = useRef(false); // CTA 중복 클릭 → 흐름 중복 시작 방지

  const typingDone = typedCount >= INTRO_TITLE_CHARS.length;

  // 즉시 완료(건너뛰기): 제목·본문 전부 표시 + 커서 제거. 질문 흐름은 시작하지 않는다(§4).
  const finish = useCallback(() => {
    setTypedCount(INTRO_TITLE_CHARS.length);
    setRevealed(true);
    setCursorGone(true);
  }, []);

  // 타이핑: 진입 200ms 후 시작, 40ms/글자. cleanup으로 unmount 후 타이머가 남지 않는다.
  useEffect(() => {
    if (reducedMotion) return;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setTypedCount((c) => {
          if (c >= INTRO_TITLE_CHARS.length) {
            if (interval !== undefined) window.clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, TYPE_CHAR_INTERVAL_MS);
    }, TYPE_START_DELAY_MS);
    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [reducedMotion]);

  // 제목 완성 → 200ms 뒤 본문/CTA fade-in, 커서는 짧게 깜빡인 뒤 제거.
  useEffect(() => {
    if (!typingDone || revealed) return;
    const reveal = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    const hideCursor = window.setTimeout(() => setCursorGone(true), CURSOR_HIDE_AFTER_MS);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(hideCursor);
    };
  }, [typingDone, revealed]);

  // 타이핑 중 Enter/Space → 즉시 완료(같은 이벤트로 질문 시작 안 함). 완료 후엔 리스너 제거.
  useEffect(() => {
    if (reducedMotion || revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reducedMotion, revealed, finish]);

  const handleStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    onStart();
  };

  return (
    // 안내 영역 클릭 = 타이핑 즉시 완료(완료 후에는 no-op). CTA 클릭만 질문을 시작한다.
    <main className="max-w-2xl mx-auto px-4 pt-10 pb-14 sm:pt-16" onClick={() => { if (!revealed) finish(); }}>
      <section className="rounded-2xl px-6 py-8 sm:px-8" style={{ border: `1px solid ${BOX_BORDER}`, background: BOX_BG }}>
        {/* 스크린리더는 전체 제목을 한 번에 읽는다(sr-only). 타이핑 문자열은 aria-hidden —
            글자별 aria-live 금지(§5). 최소 높이 확보로 타이핑 중 레이아웃 shift 방지(§6). */}
        <h1 className="text-[24px] sm:text-[28px] leading-[1.4] font-black min-h-[68px] sm:min-h-[40px]" style={{ color: INK }}>
          <span className="sr-only">{INTRO_TITLE}</span>
          <span aria-hidden="true">
            {INTRO_TITLE_CHARS.slice(0, typedCount).join('')}
            {!cursorGone && (
              <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse" style={{ background: PURPLE }} />
            )}
          </span>
        </h1>

        {/* 본문·CTA — 항상 자리를 차지하고 opacity만 전환해 레이아웃 shift 없음. */}
        <div
          className={`mt-6 space-y-4 transition-opacity ${revealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ transitionDuration: `${REVEAL_FADE_MS}ms` }}
        >
          <p className="text-[14.5px] leading-[1.85] text-slate-700">{withEmphasis(INTRO_BODY_1, INTRO_BODY_1_EMPHASIS)}</p>
          <p className="text-[14.5px] leading-[1.85] text-slate-700">{withEmphasis(INTRO_BODY_2, INTRO_BODY_2_EMPHASIS)}</p>
          <p className="text-[14.5px] leading-[1.85] text-slate-700">{withEmphasis(INTRO_BODY_3, INTRO_BODY_3_EMPHASIS)}</p>

          <p className="pt-4 text-[14.5px] leading-[1.7] font-semibold" style={{ borderTop: `1px solid ${BOX_BORDER}`, color: INK }}>
            {withEmphasis(INTRO_FINAL_NOTE, INTRO_FINAL_NOTE_EMPHASIS, PURPLE)}
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={!revealed}
            className="w-full mt-2 px-6 py-4 rounded-2xl text-white font-black text-[15.5px] transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
            style={{ background: PURPLE, boxShadow: '0 2px 12px rgba(140,111,214,0.34)', outlineColor: PURPLE }}
          >
            {INTRO_CTA_LABEL} <span aria-hidden>→</span>
          </button>
        </div>
      </section>
    </main>
  );
}
