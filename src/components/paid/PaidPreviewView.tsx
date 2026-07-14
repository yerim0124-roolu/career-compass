// Career Compass — 유료 미리보기 화면 (#paid-preview).
//
// "결제하면 이런 걸 받는다"를 보여주고 결제로 유도한다. 표시 카피만 담당하며 결과
// 생성·결제·유료 파이프라인은 건드리지 않는다. 상단 소개는 사용자 답변 조각을 조합하지
// 않고(어색한 명사구 결합 제거), 심층 분석이 실제로 제공하는 가치를 설명하는 안전한 단일
// 기본 문장을 쓴다. 근거: docs/research/paid-preview-copy-final-review.md.

import { useEffect } from 'react';
import { logPaidPreviewViewed, logPaidCheckoutClicked } from './paidAnalytics.ts';

// 상단 소개 — 모든 사용자에게 자연스러운 단일 기본 문장(개인화 명사구 조합 미사용).
//   · 2인칭 반복·따옴표 개념어·문학적 은유 없음
//   · 지금 무엇이 막혀 있는지 + 심층 분석이 주는 가치(원인·현실 조건·선택지·30일 실험)만 설명
const INTRO =
  '지금은 내가 잘하는 것과 해보고 싶은 일이 아직 하나의 방향으로 연결되지 않았어요. ' +
  '심층 분석에서는 결정을 막는 이유를 정리하고, 현실 조건에 맞는 전환 방향과 이번 달 바로 시작할 수 있는 30일 실험을 제안해드려요.';

// 심층 분석에서 확인할 내용 — 제목(굵게) + 보조 설명(있을 때만). 은유·'진단'·'1분'·괄호 제거.
const REPORT_ITEMS: Array<{ lead?: string; title: string; sub?: string }> = [
  { lead: '📋', title: '한눈에 보는 핵심 요약', sub: '현재 고민 · 가장 큰 변수 · 이번 달 우선순위' },
  { title: '지금 이 고민이 생긴 이유' },
  { title: '서로 충돌하는 선택 기준', sub: '무엇을 얻고 싶고, 무엇을 잃기 싫은지' },
  { title: '돈·시간·가족 조건을 반영한 현실 점검' },
  { title: '전환에 활용할 수 있는 경험과 강점', sub: '실무 경험 · 전문성 · 관계 자산' },
  { title: '이번 달 실행할 30일 실험', sub: '무엇을 언제까지 시험할지 정리한 실행 계획' },
  { title: '30일 후 계속할지 바꿀지 판단하는 기준' },
];

export default function PaidPreviewView() {
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
        {/* (A) 소개 문단 */}
        <section
          className="rounded-2xl p-5"
          style={{ background: '#F5F1FC', border: '1px solid #E4DAF7' }}
        >
          <p className="text-[15px] leading-[1.75] text-slate-800">{INTRO}</p>
        </section>

        {/* (B) 심층 분석에서 확인할 내용 */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-800">심층 분석에서 확인할 내용</h2>
          <ul className="space-y-3">
            {REPORT_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5 text-[14px]" style={{ color: '#8C6FD6' }}>{item.lead ?? '·'}</span>
                <div>
                  <p className="text-[14.5px] font-bold text-slate-800 leading-snug">{item.title}</p>
                  {item.sub && <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{item.sub}</p>}
                </div>
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
            결제하고 심층 분석 받기 <span aria-hidden>→</span>
          </button>
          <p className="mt-2 text-[12px] text-slate-500 text-center">추가 질문 약 3분 · 개인화된 심층 리포트</p>
        </section>
      </main>
    </div>
  );
}
