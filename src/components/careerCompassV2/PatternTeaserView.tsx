// PatternTeaserView — 무료 결과 화면의 커리어 고민 패턴 티저(표시 전용).
//
// 신규 CareerPatternProfile만 사용해 "현재 답변에서 가장 강하게 나타난 고민 패턴"을
// 부드럽게 짚는다. 기존 상세 해석·실행 처방은 화면에서 숨기고(데이터는 spine에 그대로
// 유지), 심층 분석 미리보기 + 유료 CTA는 형제 컴포넌트 PaidEntryBanner가 제공한다.
//
// 카피 원칙(career-pattern-v1-spec §10): 임상 진단·확정 성격분류 어투 금지.
//   · high  → 패턴명 노출("…패턴은 ○○입니다.")
//   · medium→ 완화 어투("…패턴은 ○○에 가까워 보여요.")
//   · low/category_only → 상위 범주만("'○○' 쪽 고민이 가장 크게 보여요.")
//   · insufficient_signal → "지금은 하나의 패턴으로 좁히기 어렵습니다."

import type { CareerPatternProfile } from '../../types/careerCompass.ts';
import { PATTERN_LABELS, CATEGORY_LABELS, PATTERN_TEASER, teaserTags } from '../../lib/biasPatternEngine.ts';

const PURPLE = '#8C6FD6';
const BOX_BG = '#F5F1FC';
const BOX_BORDER = '#E4DAF7';

// 범주 수준 설명(표시 전용) — 특정 패턴을 단정하지 않는 부드러운 어투.
const CATEGORY_TEASER: Record<string, string> = {
  instinctTrap: '무언가를 얻기보다 잃지 않으려는 마음이 지금 결정을 무겁게 하는 흐름이 보여요. 방향이 틀려서가 아니라, 놓기 어려운 무언가가 있는 상태예요.',
  cognitiveOverload: '생각할 거리가 많아 하나로 좁히기 어려운 흐름이 보여요. 더 찾기보다 무엇을 먼저 볼지 정하는 게 지금은 더 도움이 돼요.',
  avoidance: '중요한 결정이 자꾸 뒤로 미뤄지는 흐름이 보여요. 큰 결심보다 아주 작게 한 번 움직여보는 게 첫 단계일 수 있어요.',
  identityConfusion: '지금 내 방향과 정체성을 다시 정리하는 시기에 가까워 보여요. 서둘러 정하기보다 이 과정을 견디는 힘이 먼저예요.',
};

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-1.5 font-black text-sm" style={{ color: '#5E5280' }}>
        <span aria-hidden>🧭</span> Career Compass <span className="font-bold" style={{ color: '#C7BBDE' }}>무료 결과</span>
      </div>
    </header>
  );
}

export default function PatternTeaserView({ pattern }: { pattern?: CareerPatternProfile }) {
  const p = pattern;

  // 헤드라인 + 본문 결정(카피 원칙).
  let headline: string;
  let body: string;
  const tags = teaserTags(p?.evidenceCodes ?? [], 3);

  if (p && p.resolution === 'pattern' && p.primaryPattern) {
    const name = PATTERN_LABELS[p.primaryPattern];
    headline = p.confidence === 'high'
      ? `현재 답변에서 가장 강하게 나타난 고민 패턴은 ‘${name}’입니다.`
      : `현재 답변에서 가장 강하게 나타난 고민 패턴은 ‘${name}’에 가까워 보여요.`;
    body = PATTERN_TEASER[p.primaryPattern];
  } else if (p && p.resolution === 'category_only' && p.category) {
    headline = `지금은 ‘${CATEGORY_LABELS[p.category]}’ 쪽 고민이 가장 크게 보여요.`;
    body = CATEGORY_TEASER[p.category] ?? '';
  } else {
    headline = '지금은 하나의 패턴으로 좁히기 어려운 상태예요.';
    body = '답변만으로는 아직 한 방향으로 모이지 않았어요. 심화 분석에서 재정·가족·현실 조건까지 함께 보면 더 또렷해져요.';
  }

  const secondaryName = p?.resolution === 'pattern' && p.secondaryPattern ? PATTERN_LABELS[p.secondaryPattern] : '';

  return (
    <div className="min-h-dvh bg-white">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 패턴 티저 카드 */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}` }}>
          <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: PURPLE }}>고민 패턴</p>
          <h1 className="text-[17px] font-black text-slate-800 leading-snug">{headline}</h1>
          {body && <p className="text-[14.5px] leading-[1.8] text-slate-700 whitespace-pre-line">{body}</p>}
          {secondaryName && (
            <p className="text-[13px] text-slate-500 leading-relaxed">그다음으로는 ‘{secondaryName}’ 경향도 함께 보여요.</p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t) => (
                <span key={t} className="text-[12px] font-medium rounded-full px-3 py-1" style={{ background: '#FFFFFF', border: `1px solid ${BOX_BORDER}`, color: '#5E5280' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 심층 분석 안내(간단) — 상세 미리보기·결제 CTA는 아래 PaidEntryBanner가 제공 */}
        <p className="text-[13px] text-slate-500 leading-relaxed text-center">
          이 패턴이 왜 지금 생겼는지, 이번 달 무엇부터 하면 좋을지는<br className="hidden sm:block" /> 심화 분석에서 당신의 조건에 맞춰 구체적으로 짚어드려요.
        </p>
      </main>
    </div>
  );
}
