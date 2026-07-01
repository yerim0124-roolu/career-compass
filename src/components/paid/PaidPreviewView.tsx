// Career Compass — 유료 미리보기 화면 (#paid-preview).
//
// "결제하면 이런 걸 받는다"를 보여주고 결제로 유도한다. AI 호출 없이, 기존 무료
// 결과값(resultContext)만으로 맛보기 한 문단을 조합한다. session.ts의 순수 빌더를
// '읽어서 재사용'만 하고(수정 안 함), 결과는 hybrid 세션 localStorage에서 만든다.

import { useEffect, useMemo } from 'react';
import { CAREER_QUESTION_FLOW } from '../../data/careerQuestionFlow.ts';
import { parsePersistedSession, buildResultFromSession } from '../careerCompassV2/session.ts';
import { subtypeToKorean } from './labelMap.ts';
import { logPaidPreviewViewed, logPaidCheckoutClicked } from './paidAnalytics.ts';

const HYBRID_STORAGE_KEY = 'career-compass-hybrid-session-v1';

// "이런 리포트를 받아요" 정적 목록.
const REPORT_ITEMS: Array<{ lead?: string; text: string }> = [
  { lead: '📋', text: '1분 요약 카드 (핵심 진단 · 가장 큰 리스크 · 이번 달 할 것)' },
  { text: '왜 하필 지금 이 고민이 왔는지' },
  { text: '두 마음의 줄다리기 (당신을 붙잡는 심리의 정체)' },
  { text: '현실 리스크 지도 (당신의 돈·시간·가족 상황 반영)' },
  { text: '당신이 이미 가진 전환 자산 (3갈래)' },
  { text: '이번 달의 30일 실험 (구체적 실행 계획)' },
  { text: '30일 뒤 판단 기준' },
];

/** 무료 결과의 resultContext에서 맛보기 문장을 조합. 코드값은 한글로 변환. */
function useTeaser(): string {
  return useMemo(() => {
    let primary = '';
    let secondary = '';
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(HYBRID_STORAGE_KEY) : null;
      const parsed = parsePersistedSession(raw, CAREER_QUESTION_FLOW.length);
      const spine = buildResultFromSession({ responses: parsed.responses, profile: parsed.profile });
      primary = subtypeToKorean(spine.resultContext?.primarySubtype);
      secondary = subtypeToKorean(spine.resultContext?.secondarySubtype);
    } catch {
      primary = subtypeToKorean(undefined);
      secondary = subtypeToKorean(undefined);
    }
    const tail = '이 마음의 정체와, 그래서 이번 달 무엇을 하면 좋을지 — 더 깊은 분석에서 구체적으로 짚어드릴게요.';
    // primary === secondary(단일 subtype 유형)면 "사이에서 흔들리고"가 어색하므로 변형.
    if (primary === secondary) {
      return `지금 당신은 '${primary}'을(를) 두고 고민하고 있어요. ${tail}`;
    }
    return `지금 당신은 '${primary}'와(과) '${secondary}' 사이에서 흔들리고 있어요. ${tail}`;
  }, []);
}

export default function PaidPreviewView() {
  const teaser = useTeaser();

  // 미리보기 진입 이벤트 — 마운트 1회.
  useEffect(() => { logPaidPreviewViewed(); }, []);

  const onCheckout = () => {
    logPaidCheckoutClicked();
    // TODO(3단계): 여기에 실제 결제 플로우가 들어간다. 결제 성공 후 아래로 진행.
    // 지금은 결제가 없으므로 곧바로 심화 문항으로 이동한다.
    window.location.hash = '#paid-questions';
  };

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-1.5 font-black text-sm" style={{ color: '#5E5280' }}>
          <span aria-hidden>🧭</span> Career Compass <span className="font-bold" style={{ color: '#C7BBDE' }}>심화 분석</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* (A) 맛보기 문단 */}
        <section
          className="rounded-2xl p-5"
          style={{ background: '#F5F1FC', border: '1px solid #E4DAF7' }}
        >
          <p className="text-[15px] leading-[1.75] text-slate-800">{teaser}</p>
        </section>

        {/* (B) 이런 리포트를 받아요 */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-800">이런 리포트를 받아요</h2>
          <ul className="space-y-2.5">
            {REPORT_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-slate-700">
                <span aria-hidden style={{ color: '#8C6FD6' }}>{item.lead ?? '·'}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* (C) 결제 CTA */}
        <section className="pt-2">
          <button
            type="button"
            onClick={onCheckout}
            className="w-full py-3.5 rounded-2xl text-white font-bold transition-colors"
            style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.28)' }}
          >
            결제하고 전체 받기 <span aria-hidden>→</span>
          </button>
        </section>
      </main>
    </div>
  );
}
