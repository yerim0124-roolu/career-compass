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

  return (
    <div className="bg-white border-t border-slate-200">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div
          className="rounded-2xl p-5 text-center space-y-2"
          style={{ background: '#F5F1FC', border: '1px solid #E4DAF7' }}
        >
          <p className="text-base font-black text-slate-800">🔍 더 깊은 분석이 필요하신가요?</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            당신의 재정·가족·현실 상황까지 반영한 맞춤 리포트를 받아보세요
          </p>
          <button
            type="button"
            onClick={() => { window.location.hash = '#paid-preview'; }}
            className="mt-2 px-6 py-3 rounded-2xl text-white font-bold transition-colors"
            style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.28)' }}
          >
            심화 분석 받기 <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
