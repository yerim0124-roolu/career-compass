// Career Compass — 무료 결과 화면 하단에 얹는 유료 진입 배너.
//
// HybridFlowView.tsx는 READ-ONLY이므로 그 내부를 수정하지 않는다. 대신 App.tsx
// 라우팅 레벨에서 <HybridFlowView /> '다음'에 이 배너를 형제로 얹는다. 배너는
// 무료 결과 phase(hybrid 세션의 done === true)일 때만 보이도록, HybridFlowView가
// 쓰는 localStorage 세션을 읽어 스스로 판단한다. (문항 진행 중에는 숨김)

import { useEffect, useState } from 'react';
import { FEATURE_FLAGS } from '../../config/featureFlags';

// HybridFlowView가 쓰는 세션 키(HYBRID_STORAGE_KEY). 읽기 전용으로만 참조.
const HYBRID_STORAGE_KEY = 'career-compass-hybrid-session-v1';

function readHybridDone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.done === true;
  } catch {
    return false;
  }
}

/**
 * hybrid 결과 phase 여부를 localStorage 기반으로 추적.
 * HybridFlowView(READ-ONLY)가 이벤트를 못 쏘므로, 같은 탭에서의 상태 변화는
 * 폴링으로, 탭 복귀/포커스/해시 이동/다른 탭 변경은 이벤트로 함께 감지한다.
 * (프로덕션·개발 동일하게 동작 — localStorage/타이머는 빌드 모드와 무관)
 */
function useHybridDone(): boolean {
  const [done, setDone] = useState<boolean>(() => readHybridDone());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setDone((prev) => {
      const next = readHybridDone();
      return next === prev ? prev : next;
    });
    check(); // 마운트 직후 즉시 1회 재확인(초기 렌더 이후 상태가 바뀐 경우 대비).
    const id = window.setInterval(check, 800);
    window.addEventListener('storage', check);      // 다른 탭에서의 변경
    window.addEventListener('focus', check);        // 창 포커스 복귀
    window.addEventListener('visibilitychange', check); // 탭 가시성 복귀
    window.addEventListener('hashchange', check);   // 해시 라우팅 이동
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('visibilitychange', check);
      window.removeEventListener('hashchange', check);
    };
  }, []);
  return done;
}

export default function PaidEntryBanner() {
  const done = useHybridDone();
  // 이중 가드: 플래그 off이면 절대 렌더하지 않는다(무료와 100% 동일).
  if (!FEATURE_FLAGS.paidAnalysis) return null;
  if (!done) return null;

  const includes = [
    '왜 지금 이 고민이 생겼는지',
    '현실 리스크 지도',
    '이번 달의 30일 실행 실험',
    '7일 실행 계획',
    '30일 뒤 재판정 기준',
  ];

  return (
    <div className="bg-white border-t border-slate-200">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 유료 CTA — 무료 본문과 시각적으로 분리된 박스(진한 배경/테두리 + 자물쇠 라벨 + 가격). */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#F1EBFB', border: '1.5px solid #C9B8EC', boxShadow: '0 4px 16px rgba(120,90,190,0.12)' }}
        >
          {/* 상단 라벨 바 */}
          <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: '#EBE2F9', borderBottom: '1px solid #D9C9F0' }}>
            <span className="text-[12px] font-black tracking-wide" style={{ color: '#6A54A8' }}>🔒 유료 심화 분석</span>
            <span className="text-[12px] font-bold" style={{ color: '#8C6FD6' }}>₩3,900</span>
          </div>

          <div className="px-5 py-5 space-y-3">
            <p className="text-[16px] font-black text-slate-800 leading-snug">
              🔒 더 깊은 심화 분석에서 확인할 수 있어요
            </p>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              무료 결과는 현재 상태를 요약한 리포트예요. 심화 분석에서는 재정 상황, 가족 구조,
              버틸 수 있는 기간, 실행 가능성까지 반영해 이번 달 실제로 무엇을 해야 할지
              구체적인 계획을 드려요.
            </p>

            <ul className="space-y-1.5 pt-1">
              {includes.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13.5px] text-slate-700 leading-relaxed">
                  <span aria-hidden style={{ color: '#8C6FD6' }} className="mt-0.5 font-bold">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => { window.location.hash = '#paid-preview'; }}
              className="w-full mt-2 px-6 py-3.5 rounded-2xl text-white font-black transition-transform active:scale-[0.99]"
              style={{ background: '#8C6FD6', boxShadow: '0 2px 10px rgba(140,111,214,0.32)' }}
            >
              3,900원으로 심화 리포트 보기 <span aria-hidden>→</span>
            </button>
            <p className="text-[12px] text-slate-400 text-center leading-relaxed">
              결제 후 몇 가지 심화 문항에 답하면 맞춤 결과지가 생성됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
