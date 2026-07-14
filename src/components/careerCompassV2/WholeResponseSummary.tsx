// WholeResponseSummary — 무료 결과 패턴 카드 위에 얹는 '전체 답변을 종합하면' 블록(표시 전용).
//
// 입력은 기존 무료 결과 엔진(buildResultFromResponses)이 이미 계산한 mainType + resultContext
// 필드(pullDirection/showPullDirection/primaryFriction/readinessLevel)뿐이다. raw 응답 재분석·
// 새 점수·분류를 하지 않고, buildWholeResponseSummary(표시용 순수 helper)로 문장만 조립한다.
// 근거 필드가 없으면(구버전/불완전 세션) 해당 문장만 생략하고, 전부 없으면 아무것도 렌더하지
// 않아 화면이 깨지지 않는다. 패턴 카드보다 시각적으로 작은 보조 영역으로 둔다.

import type { MainTypeKey, ResultContext } from '../../types/careerCompass.ts';
import { buildWholeResponseSummary } from './wholeResponseSummaryCopy.ts';

interface Props {
  mainType?: MainTypeKey;
  resultContext?: Pick<ResultContext, 'pullDirection' | 'showPullDirection' | 'primaryFriction' | 'readinessLevel'>;
}

export default function WholeResponseSummary({ mainType, resultContext }: Props) {
  const sentences = buildWholeResponseSummary({
    mainType,
    pullDirection: resultContext?.pullDirection,
    showPullDirection: resultContext?.showPullDirection,
    primaryFriction: resultContext?.primaryFriction,
    readinessLevel: resultContext?.readinessLevel,
  });

  if (sentences.length === 0) return null; // fallback — 안전하게 숨김

  return (
    <section className="max-w-2xl mx-auto px-4 pt-3">
      <div className="rounded-xl px-4 py-3" style={{ background: '#FAF8FE', border: '1px solid #EEE7FA' }}>
        <p className="text-[10.5px] font-black tracking-widest uppercase" style={{ color: '#9B8AC4' }}>전체 답변을 종합하면</p>
        <p className="text-[13.5px] leading-relaxed text-slate-600 mt-1">{sentences.join(' ')}</p>
      </div>
    </section>
  );
}
