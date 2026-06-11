import { useState } from 'react';

// 모바일 전용 페이지형/스텝형 결과 보기.
//  · 상단: 현재 위치 표시(1 / N · 라벨) + 점 인디케이터(탭으로 이동)
//  · 본문: 현재 페이지만 렌더(키 큰 페이지 옆 여백 방지)
//  · 하단: 이전 / 다음(다음 페이지 이름 표기) 버튼
//  · 페이지 전환은 버튼·점 인디케이터로만. 좌우 스와이프는 제거 — 세로 스크롤 중 손가락이
//    옆으로 살짝 호를 그리는 것을 스와이프로 오인해 의도치 않게 앞 페이지로 튀던 버그(가로축만
//    보고 세로축을 무시) 때문. 버튼 전환이 모바일에서 가장 확실하다.
export interface PagerPage {
  label: string;        // 인디케이터용 전체 이름
  nav?: string;         // '다음' 버튼에 쓸 짧은 이름(= 다음 페이지 이름). 마지막 페이지는 빈 값.
  content: React.ReactNode;
}

export default function MobileResultPager({ pages }: { pages: PagerPage[] }) {
  const [i, setI] = useState(0);
  const total = pages.length;

  const goto = (n: number) => {
    const idx = Math.max(0, Math.min(total - 1, n));
    setI(idx);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* 현재 위치 — 페이지 라벨. 아래 큰 제목과 간격(16px) */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-bold" style={{ color: '#5E5280', lineHeight: 1.3 }}>
          <span style={{ color: '#8C6FD6' }}>{i + 1}</span> / {total} · {pages[i].label}
        </span>
        <div className="flex gap-1.5">
          {pages.map((p, k) => (
            <button
              key={k}
              type="button"
              aria-label={`${k + 1}페이지: ${p.label}`}
              onClick={() => goto(k)}
              className="rounded-full"
              style={{ width: 7, height: 7, background: k === i ? '#8C6FD6' : '#E2D8F2' }}
            />
          ))}
        </div>
      </div>

      {/* 현재 페이지 — 전환은 하단 버튼·점 인디케이터로만(스와이프 제거) */}
      <div className="min-h-[36vh]">
        <div className="space-y-5">{pages[i].content}</div>
      </div>

      {/* 이전 / 다음 — 콘텐츠 아래 자연 배치(가림 방지). 버튼 높이 동일(52px), primary 은은하게. */}
      <div
        className="mt-9 pt-4 flex items-stretch gap-2"
        style={{ borderTop: '1px solid rgba(120,100,160,0.16)' }}
      >
        {i > 0 && (
          <button
            type="button"
            onClick={() => goto(i - 1)}
            className="px-4 rounded-xl text-[15.5px] font-semibold active:scale-[0.98] transition"
            style={{ height: '50px', border: '1.5px solid rgba(120,100,160,0.30)', color: '#5E5280' }}
          >
            이전
          </button>
        )}
        {i < total - 1 ? (
          <button
            type="button"
            onClick={() => goto(i + 1)}
            className="flex-1 px-4 rounded-xl text-[15.5px] font-bold text-white active:scale-[0.98] transition"
            style={{ height: '50px', background: '#8C6FD6', border: '1.5px solid transparent', boxShadow: '0 1px 3px rgba(140,111,214,0.20)' }}
          >
            다음: {pages[i].nav || pages[i + 1].label}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goto(0)}
            className="flex-1 px-4 rounded-xl text-[15.5px] font-bold active:scale-[0.98] transition"
            style={{ height: '50px', border: '1.5px solid rgba(120,100,160,0.30)', color: '#5E5280' }}
          >
            결과 요약으로
          </button>
        )}
      </div>
    </div>
  );
}
