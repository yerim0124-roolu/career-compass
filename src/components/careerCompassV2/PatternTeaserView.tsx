// PatternTeaserView — 무료 결과 화면의 커리어 고민 패턴 티저(표시 전용).
//
// 신규 CareerPatternProfile + 표시 카피 계층(patternTeaserCopy)만 사용한다. 엔진 규칙·
// 기존 결과 필드·유료 파이프라인은 변경하지 않는다. 상세 해석·실행 처방은 화면에서
// 숨기고(데이터는 spine 유지), 유료 진입은 아래 CTA(→ #paid-preview)로 이어진다.
//
// 카피 원칙(career-pattern-v1-spec §10): 임상 진단·확정 성격분류 어투 금지, 자유입력
// 원문 미인용. confidence: high→구체 패턴명 확정 어투 / medium→완화 어투 /
// category_only→상위 범주만 / insufficient_signal→"좁히기 어렵다" + 유료 필요성.

import type { CareerPatternProfile } from '../../types/careerCompass.ts';
import { PATTERN_LABELS, CATEGORY_LABELS } from '../../lib/biasPatternEngine.ts';
import {
  PATTERN_COPY, CATEGORY_COPY, INSUFFICIENT_COPY, readSignals,
  DEEP_PREVIEW_ITEMS, CTA_PRIMARY, CTA_SUB,
} from './patternTeaserCopy.ts';

const PURPLE = '#8C6FD6';
const INK = '#3E356B';
const BOX_BG = '#F5F1FC';
const BOX_BORDER = '#E4DAF7';

interface Resolved {
  label: string;          // 상단 고정 라벨
  inverted: string;       // 반전형 헤드라인
  nameLine?: string;      // confidence 반영 패턴/범주명 라인
  academic?: string;      // 이론적 패턴명(개념어)
  category?: string;      // 상위 범주명
  statePara: string;
  mechanismPara: string;
  signals: string[];
  question: string;
}

function resolve(p?: CareerPatternProfile): Resolved {
  const LABEL = '지금 답변에서 읽은 핵심 고민 패턴';
  const codes = p?.evidenceCodes ?? [];

  if (p && p.resolution === 'pattern' && p.primaryPattern) {
    const c = PATTERN_COPY[p.primaryPattern];
    const name = PATTERN_LABELS[p.primaryPattern];
    // 확정 진단 어투 금지: high도 "경향이 가장 강하게 나타났어요"로 완화. medium은 근사 어투.
    // name(PATTERN_LABELS)이 '…패턴'으로 끝나는 경우가 있어 뒤에 '패턴'을 또 붙이지 않는다.
    const nameLine = p.confidence === 'high'
      ? `현재 답변에서는 ‘${name}’ 경향이 가장 강하게 나타났어요.`
      : `현재 답변은 ‘${name}’ 쪽에 가까워 보여요.`;
    return {
      label: LABEL, inverted: c.inverted, nameLine, academic: c.academic,
      category: p.category ? CATEGORY_LABELS[p.category] : undefined,
      statePara: c.statePara, mechanismPara: c.mechanismPara,
      signals: readSignals(codes, 3, { pattern: p.primaryPattern }), question: c.question,
    };
  }

  if (p && p.resolution === 'category_only' && p.category) {
    const c = CATEGORY_COPY[p.category];
    return {
      label: LABEL, inverted: c.inverted,
      nameLine: `현재 답변에서는 ‘${CATEGORY_LABELS[p.category]}’ 범주의 고민이 비교적 크게 나타났어요.`,
      category: CATEGORY_LABELS[p.category],
      statePara: c.statePara, mechanismPara: c.mechanismPara,
      signals: readSignals(codes, 3, { category: p.category }), question: c.question,
    };
  }

  // insufficient_signal
  return {
    label: LABEL, inverted: INSUFFICIENT_COPY.inverted,
    statePara: INSUFFICIENT_COPY.statePara, mechanismPara: INSUFFICIENT_COPY.mechanismPara,
    signals: readSignals(codes, 3), question: INSUFFICIENT_COPY.question,
  };
}

export default function PatternTeaserView({ pattern }: { pattern?: CareerPatternProfile }) {
  const r = resolve(pattern);
  const goPaid = () => { window.location.hash = '#paid-preview'; };

  return (
    // 상단 여백 축소 + 자체 헤더 제거(상위 HybridFlowView가 헤더/뒤로가기 렌더).
    <main className="max-w-2xl mx-auto px-4 pt-3 pb-10 space-y-5">
      {/* 결과 카드 — 라벨 → 반전 헤드라인 → 패턴명 → 상태/메커니즘 → 신호 → 미해결 질문 */}
      <section className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BOX_BORDER}`, background: BOX_BG }}>
        <div className="px-5 pt-5 pb-4 space-y-3">
          <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: PURPLE }}>{r.label}</p>
          <h1 className="text-[20px] leading-[1.4] font-black" style={{ color: INK }}>{r.inverted}</h1>
          {r.nameLine && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {r.academic && (
                <span className="text-[12px] font-bold rounded-full px-2.5 py-1" style={{ background: '#FFFFFF', border: `1px solid ${BOX_BORDER}`, color: INK }}>{r.academic}</span>
              )}
              {r.category && (
                <span className="text-[12px] font-medium rounded-full px-2.5 py-1" style={{ background: '#EFE8FA', color: '#6A54A8' }}>{r.category}</span>
              )}
            </div>
          )}
          {r.nameLine && <p className="text-[13px] text-slate-500 leading-relaxed">{r.nameLine}</p>}
        </div>

        {/* 개인화 설명 2문단 */}
        <div className="px-5 py-4 space-y-3 bg-white/70" style={{ borderTop: `1px solid ${BOX_BORDER}` }}>
          <p className="text-[14.5px] leading-[1.85] text-slate-700">{r.statePara}</p>
          <p className="text-[14.5px] leading-[1.85] text-slate-700">{r.mechanismPara}</p>
        </div>

        {/* 당신의 답변에서 읽힌 신호 (evidenceCodes 뒷받침 항목만) */}
        {r.signals.length > 0 && (
          <div className="px-5 py-4" style={{ borderTop: `1px solid ${BOX_BORDER}` }}>
            <p className="text-[12px] font-bold text-slate-500 mb-2">당신의 답변에서 읽힌 신호</p>
            <ul className="space-y-1.5">
              {r.signals.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[13.5px] text-slate-700 leading-relaxed">
                  <span aria-hidden className="mt-0.5 font-bold" style={{ color: PURPLE }}>✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 아직 풀리지 않은 핵심 질문 */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${BOX_BORDER}`, background: '#FBF9FF' }}>
          <p className="text-[12px] font-bold mb-1.5" style={{ color: PURPLE }}>아직 풀리지 않은 질문</p>
          <p className="text-[15px] font-bold leading-[1.6]" style={{ color: INK }}>{r.question}</p>
        </div>
      </section>

      {/* 심층 분석 미리보기 + 강한 CTA (첫 화면에서 발견되도록 카드 바로 아래) */}
      <section className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid #C9B8EC`, background: '#F1EBFB', boxShadow: '0 4px 16px rgba(120,90,190,0.12)' }}>
        <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: '#EBE2F9', borderBottom: '1px solid #D9C9F0' }}>
          <span className="text-[12px] font-black tracking-wide" style={{ color: '#6A54A8' }}>🔒 심화 분석에서 이어서</span>
          <span className="text-[12px] font-bold" style={{ color: PURPLE }}>₩3,900</span>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-[14px] text-slate-600 leading-relaxed">
            무료 결과는 지금의 고민 패턴을 짚어드려요. 심화 분석에서는 당신의 조건에 맞춰 다음을 구체적으로 드려요.
          </p>
          <ul className="space-y-2">
            {DEEP_PREVIEW_ITEMS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px] text-slate-800 leading-relaxed">
                <span aria-hidden className="mt-0.5 font-bold" style={{ color: PURPLE }}>•</span>
                <span className="font-semibold">{t}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={goPaid}
            className="w-full mt-1 px-6 py-4 rounded-2xl text-white font-black text-[15.5px] transition-transform active:scale-[0.99]"
            style={{ background: PURPLE, boxShadow: '0 2px 12px rgba(140,111,214,0.34)' }}
          >
            {CTA_PRIMARY} <span aria-hidden>→</span>
          </button>
          <p className="text-[12px] text-slate-500 text-center leading-relaxed">{CTA_SUB}</p>
        </div>
      </section>
    </main>
  );
}
