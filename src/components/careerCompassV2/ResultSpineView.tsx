import { useEffect, useState } from 'react';
import type { ResultSpine, ActionReadiness, MoveRecommendation, MainTypeKey } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS } from '../../types/careerCompass.ts';
import { MAIN_TYPE_NARRATIVES } from '../../data/mainTypeNarratives.ts';
import { getExperimentJobHint } from '../../data/jobRoleExperimentHints.ts';
import ClosingQuoteCard from './ClosingQuoteCard.tsx';
import { getClosingMessage } from '../../data/closingMessages.ts';
import MobileResultPager from './MobileResultPager.tsx';
// 파스텔 인포그래픽 토큰 — 색에 '단일 의미'를 부여 (design-critique 권장 2).
//   progress(라벤더) = 강점·진행 / caution(피치) = 주의·부족 / done(민트) = 완료·안전 / neutral(회색)
const TONE = {
  progress: { bg: '#EEEBFE', fg: '#4338ca', bar: '#AFA9EC' },
  caution: { bg: '#FBEEE3', fg: '#b45309', bar: '#F5CDB3' },
  done: { bg: '#E4F5EC', fg: '#047857', bar: '#7FD0A8' },
  neutral: { bg: '#F1F5F9', fg: '#475569', bar: '#CBD5E1' },
} as const;

// 요약 3카드 — APPLY_GUIDE 팔레트(민트/라벤더/그레이) + 얇은 손그림 테두리 + 살짝 기울기 +
// 우하단 일러스트(새싹/별/달력).
function StatCard({ bg, label, value, tilt, deco, decoRotate = 0, decoW = 28 }: { bg: string; label: string; value: string; tilt?: string; deco?: string; decoRotate?: number; decoW?: number }) {
  return (
    <div className={`cc-sketch ${tilt ?? ''} relative overflow-hidden flex flex-col justify-center px-3 py-3`} style={{ background: bg }}>
      <p className="text-[12px] font-bold" style={{ color: '#3F3F46' }}>{label}</p>
      <p className="text-[15px] font-extrabold mt-1 leading-snug" style={{ color: '#3F3F46' }}>{value}</p>
      {deco && <Deco name={deco} w={decoW} rotate={decoRotate} className="right-1 bottom-1" />}
    </div>
  );
}

// 단계 표시 (●●○) — high=3칸 채움(강점색), low=1칸(주의색). 가짜 % 대신 정직한 3단계.
function SignalDots({ level }: { level: 'high' | 'low' }) {
  const filled = level === 'high' ? 3 : 1;
  const color = level === 'high' ? TONE.progress.bar : TONE.caution.bar;
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < filled ? color : '#E2E8F0' }} />
      ))}
    </span>
  );
}

// 단계형 진행 표시 — 가짜 %(근거 0% 모임) 대신 '지금 어느 단계인지'를 정직하게.
//   확인 전(현재) → 작은 반응 확인(다음) → 장기 방향 판단(이후)
function PhaseSteps() {
  const steps = [
    { label: '확인 전', sub: '지금 여기', state: 'now' as const },
    { label: '작은 반응 확인', sub: '다음 단계', state: 'next' as const },
    { label: '장기 방향 판단', sub: '이후', state: 'later' as const },
  ];
  return (
    <ol className="flex items-stretch gap-2">
      {steps.map((s, i) => {
        const active = s.state === 'now';
        return (
          <li key={i} className="flex-1 rounded-xl px-3 py-3 border" style={{
            background: active ? TONE.progress.bg : '#FFFFFF',
            borderColor: active ? TONE.progress.bar : '#E5E7EB',
          }}>
            <p className="text-[11px] font-bold" style={{ color: active ? TONE.progress.fg : '#94A3B8' }}>{s.sub}</p>
            <p className="text-[14px] font-extrabold mt-0.5" style={{ color: active ? TONE.progress.fg : '#475569' }}>{s.label}</p>
          </li>
        );
      })}
    </ol>
  );
}

// 대안 옵션별 '왜 지금이 아닌가' — 각 선택지의 *실제 리스크* 기준 (옵션 무관 일반론 금지).
const OPTION_RISK_COPY: Record<string, string> = {
  stayRedesign: '현재 일을 유지하는 선택은 안정성을 지키는 데 유리하지만, 아무 변화 없이 버티는 방식이면 같은 답답함이 반복될 수 있어요. 유지하더라도 업무 범위나 역할 조정을 함께 보는 게 좋아요.',
  jobChange: '이직은 지금 환경을 바꾸는 데는 도움이 되지만, 원하는 역할이나 기준이 정리되지 않은 상태에서는 비슷한 고민을 새 조직으로 옮길 수 있어요.',
  startup: '창업은 실행 강도와 재정 변동이 큰 선택이에요. 지금은 아이디어보다, 반복되는 수요와 감당 가능한 비용 범위를 먼저 확인하는 게 순서예요.',
  independent: '프리랜스·독립은 수입 변동과 고객 확보를 직접 감당해야 하는 선택이에요. 지금은 먼저 자문·강의 같은 작은 형태가 실제 요청으로 이어지는지 확인한 뒤, 독립 가능성을 따져보는 편이 더 적합해요.',
  contentBrand: '콘텐츠는 방향을 드러내는 데 도움이 되지만, 지금은 조회수보다 어떤 주제에 실제 질문과 요청이 생기는지 확인하는 게 먼저예요.',
  advisoryTeaching: '방향은 좋지만, 아직 사람들이 실제로 시간을 내어 묻거나 비용을 낼 만큼의 반응이 확인되지 않았어요. 이번 달에는 자문·강의를 확정하기보다, 작게 제안해보고 반응을 확인하는 단계가 먼저예요.',
  investAnalysis: '분석·리포트 방향은 강점을 살리는 길이지만, 지금은 정식으로 벌이기보다 짧은 분석 하나를 공개해 실제 반응(질문·인용·문의)이 오는지 확인하는 게 먼저예요.',
  orgLeadership: '조직에서 더 큰 역할을 맡는 길은 좋지만, 지금은 직함보다 먼저 작은 일 하나를 직접 끌어 성과와 신뢰를 쌓아두는 편이 다음 자리로 이어지기 쉬워요.',
  restRecover: '회복이 필요한 신호가 강할 때는 휴식이 1순위예요. 다만 회복이 주된 병목이 아니라면, 완전한 멈춤보다 작은 기준 정리나 조건 확인이 더 적합해요.',
};

// P3.9 UI — display-only softening of judgment-flavored mainType labels.
// The canonical MAIN_TYPE_LABELS stay untouched (engine copy, analytics payloads,
// tests all keep reading them); this map only changes the badge the user sees.
// Burnout keeps its name — naming the exhaustion is empathic accuracy, not judgment.
const MAIN_TYPE_DISPLAY: Partial<Record<MainTypeKey, string>> = {
  plateauedPerformer: '도약 준비 성실형',   // was 정체된 성실형 — same diagnosis, forward frame
  scatteredExplorer: '폭넓은 탐색형',        // was 탐색 과잉형
  lowOptionVisibility: '선택지 발굴형',      // was 기회 탐색 부족형
  unvalidatedAspirant: '확인 전 도전형',     // was 시장 미검증 도전형
  restlessStabilizer: '안정 속 변화 모색형', // was 안정 속 권태형
};

// ADR-001 — LLM narrative layer client side. The deterministic template renders
// immediately (skeleton + permanent fallback); when /api/narrative responds with
// a validated rewrite, it fades in over the template. Identical answer sets hit
// a sessionStorage cache so re-opening the result doesn't re-call the API.
interface LlmNarrative { coreInsight: string; narrative: string; whyBullets: string[] }

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function useLlmNarrative(spine: ResultSpine): LlmNarrative | null {
  const [llm, setLlm] = useState<LlmNarrative | null>(null);
  const seed = spine.narrativeSeed;
  useEffect(() => {
    if (!seed) return;
    const body = JSON.stringify(seed);
    const cacheKey = `cc-llm-narrative-${hashString(body)}`;
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) { setLlm(JSON.parse(cached) as LlmNarrative); return; }
    } catch { /* noop */ }
    const ctrl = new AbortController();
    fetch('/api/narrative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((out: unknown) => {
        const o = out as LlmNarrative | null;
        if (o && typeof o.coreInsight === 'string' && typeof o.narrative === 'string' && Array.isArray(o.whyBullets)) {
          setLlm(o);
          try { window.sessionStorage.setItem(cacheKey, JSON.stringify(o)); } catch { /* noop */ }
        }
      })
      .catch(() => { /* template stays — that's the fallback */ });
    return () => ctrl.abort();
  }, [seed]);
  return llm;
}

// 30일 체크리스트 체크 상태 — 결과지를 다시 열었을 때 유지되도록 localStorage에 저장.
// 항목 텍스트를 키로 써서 플랜이 바뀌면 자연스럽게 초기화된 것처럼 보이게 한다.
const REEVAL_CHECKS_KEY = 'career-compass-reeval-checks-v1';
function loadReevalChecks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REEVAL_CHECKS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

const ACTION_READINESS_KO: Record<ActionReadiness, string> = {
  ready: '실행 준비됨',
  'explore-with-structure': '구조 있는 탐색',
  'stabilize-first': '기반 다지기 먼저',
};

// Natural Korean subject particle (이/가) based on whether the last syllable has a 받침.
function subjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0 ? '이' : '가';
  return '이(가)';
}
function topicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0 ? '은' : '는';
  return '은(는)';
}
interface Props {
  spine: ResultSpine;
  onRestart: () => void;
}

// 손그림 일러스트(투명 PNG, public/assets/deco) — 장식 전용. aria-hidden + pointer-events-none.
// rotate로 각도를 제각각 줘 '손으로 흩뿌린' 느낌(스티커 복붙 느낌 회피).
function Deco({ name, className = '', w, rotate = 0, style }: { name: string; className?: string; w?: number; rotate?: number; style?: React.CSSProperties }) {
  return (
    <img src={`/assets/deco/${name}.png`} alt="" aria-hidden
      className={`absolute pointer-events-none select-none ${className}`}
      style={{ ...(w ? { width: w } : {}), height: 'auto', transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }} />
  );
}

// 섹션 제목 — 별(✦)은 바깥, 제목 텍스트만 감싸서 물결 밑줄이 글자 폭과 정확히 일치(width 100%).
function SectionTitle({ children, accent = '#E0A8C0' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden style={{ color: '#F5A623', fontSize: 17, lineHeight: 1 }}>✦</span>
      <span className="relative inline-block pb-1.5">
        <h2 className="text-[19px] font-extrabold tracking-[-0.01em]" style={{ color: '#3F3F46' }}>{children}</h2>
        <svg aria-hidden viewBox="0 0 120 6" preserveAspectRatio="none"
          className="cc-wave absolute left-0 bottom-[-2px]" style={{ width: '100%', height: 6 }}>
          <path d="M1,3 Q5,1 9,3 T17,3 T25,3 T33,3 T41,3 T49,3 T57,3 T65,3 T73,3 T81,3 T89,3 T97,3 T105,3 T113,3 T119,3"
            stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <section className="space-y-3">
      <SectionTitle accent={accent}>{title}</SectionTitle>
      {children}
    </section>
  );
}

// P3.9 UI — strip the engine's "blocker → consequence" arrow notation from rationales
// shown to users: the row's tag chip (조건 충족 시 / 지금은 보류 / 준비 후) already
// carries the consequence, so only the blocker clause renders.
function cleanRationale(r: string): string {
  const head = r.split('→')[0].trim().replace(/[,，]\s*$/, '');
  return /[.!?。]$/.test(head) ? head : `${head}.`;
}

// 템플릿의 *강조* 마커 → <strong>. (narrativeTemplates는 *…*로 핵심구를 표시한다)
function renderEmphasis(text: string): React.ReactNode {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.length > 1 && part.startsWith('*') && part.endsWith('*')
      ? <strong key={i} className="font-semibold text-zinc-900">{part.slice(1, -1)}</strong>
      : part,
  );
}

export default function ResultSpineView({ spine, onRestart }: Props) {
  // P3.20 — narrative 섹션 제거로 LLM 재서술 표시처가 사라졌다. 훅 호출은 비활성화하되
  // useLlmNarrative 함수·api/narrative는 남겨, 추후 솔루션 추천이유에 재연결할 수 있게 한다.
  void useLlmNarrative;
  const [reevalChecks, setReevalChecks] = useState<Record<string, boolean>>(loadReevalChecks);
  const toggleReevalCheck = (item: string) => {
    setReevalChecks((prev) => {
      const next = { ...prev, [item]: !prev[item] };
      try { window.localStorage.setItem(REEVAL_CHECKS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };
  const mainTypeDisplayLabel =
    MAIN_TYPE_DISPLAY[spine.solutionLayer.mainTypeKey as MainTypeKey] ?? spine.executionPlan.mainTypeLabel;
  // ── 섹션 노드 추출 — 데스크톱(긴 단일 레이아웃)·모바일(6페이지 스텝형)에서 재사용 ──
  const heroBlock = (
      <header
        className="relative overflow-hidden flex flex-col items-center justify-center text-center gap-2.5"
        style={{
          background: 'radial-gradient(135% 100% at 50% 32%, #F5F0FE 0%, #E4DAFB 56%, #D6C7F7 100%)',
          border: '1.5px solid rgba(120,100,160,0.30)',
          borderRadius: '22px',
          boxShadow: '0 1px 4px rgba(150,130,190,0.10)',
          padding: '28px clamp(22px, 6vw, 52px)',
        }}
      >
        {/* 코너 클러스터 — 모서리에만 작게 묶어 분위기만. 파란 구름은 제거(군더더기). */}
        <Deco name="cloud-dotted" style={{ left: '2.5%', top: '12%', width: '8.5%' }} />
        <Deco name="sparkle" className="deco-opt" style={{ left: '11.5%', top: '26%', width: '2.4%' }} />
        <Deco name="heart-coral" style={{ left: '3.5%', bottom: '12%', width: '6.4%' }} />
        <Deco name="sparkle" className="deco-opt" style={{ left: '11%', bottom: '20%', width: '2%' }} />
        <Deco name="star-yellow" style={{ right: '3.5%', top: '11%', width: '8%' }} />
        <Deco name="star-purple" className="deco-opt" style={{ right: '9.5%', top: '21%', width: '4.4%', opacity: 0.78 }} />
        <Deco name="swirl" style={{ right: '2.5%', bottom: '11%', width: '14%' }} />
        <Deco name="sparkle" className="deco-opt" style={{ right: '13%', bottom: '24%', width: '2%' }} />

        <div className="relative flex flex-col items-center gap-1.5">
          <p className="text-[10.5px] font-semibold tracking-[0.18em]" style={{ color: '#8C7EB4' }}>당신의 중심축</p>
          <h1 style={{ color: '#2F293A', fontWeight: 650, letterSpacing: '-0.01em', fontSize: 'clamp(20px, 3.2vw, 28.5px)', lineHeight: 1.5, maxWidth: '84%', margin: '0 auto', wordBreak: 'keep-all', overflowWrap: 'normal', textWrap: 'balance' }}>{spine.identityAxis.statement}</h1>
        </div>
        {spine.identityAxis.archetypeTags.length > 0 && (
          <div className="relative flex flex-wrap justify-center gap-1.5">
            {spine.identityAxis.archetypeTags.slice(0, 2).map((t) => (
              <span key={t} className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ color: '#5E5280', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(120,100,160,0.30)' }}>
                {ARCHETYPE_LABELS[t]}
              </span>
            ))}
          </div>
        )}
      </header>
  );

  const profileBlock = spine.profileContext ? (
        <div className="rounded-2xl px-5 py-4 space-y-2" style={{ border: '1.5px solid rgba(120,100,160,0.18)', background: '#FBF9FF' }} aria-label="지금 상태 요약">
          <p className="text-[14px] font-bold" style={{ color: '#3B3348' }}>{spine.profileContext.headline}</p>
          <p className="text-[14px] leading-[1.7]" style={{ color: '#5A5366' }}>{spine.profileContext.body}</p>
          {spine.profileContext.tags && spine.profileContext.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {spine.profileContext.tags.map((t) => (
                <span key={t} className="text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ color: '#5E5280', background: '#F0EAFB' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
  ) : null;

  // 결과 요약 — 모바일 리스트 + 데스크톱 3카드(반응형 클래스로 양쪽 모두 처리)
  const summaryBlock = (() => {
        const dateMatch = spine.executionPlan.reevaluationDateLabel.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
        const reevalShort = dateMatch ? `${Number(dateMatch[2])}월 ${Number(dateMatch[3])}일` : '30일 후';
        const directionLabel = spine.strategicDirection?.label ?? spine.conditionalOption?.label;
        const rows = [
          { label: '현재 우선순위', value: spine.currentBestMove.label },
          { label: directionLabel ? '확인할 방향' : '이번 달 초점', value: directionLabel ?? spine.solutionLayer.primaryModule.title },
          { label: '판단 시점', value: `${reevalShort} 재평가` },
        ];
        return (
          <>
            {/* 모바일 — 가로 3열은 글자가 깨져서 요약 리스트(label↔value 한 줄)로. 정보 밀도·가독성 우선. */}
            <div className="sm:hidden rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(120,100,160,0.22)', background: '#FBF9FF' }}>
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3" style={i > 0 ? { borderTop: '1px solid rgba(120,100,160,0.14)' } : undefined}>
                  <span className="text-[12.5px] shrink-0" style={{ color: '#8478A8', wordBreak: 'keep-all' }}>{r.label}</span>
                  <span className="text-[14px] font-bold text-right leading-snug" style={{ color: '#3B3348', wordBreak: 'keep-all' }}>{r.value}</span>
                </div>
              ))}
            </div>
            {/* 태블릿 이상 — 기존 3카드 그리드 유지 */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-3">
              <StatCard bg="#D4EFDC" tilt="cc-tr" deco="sprout" decoRotate={4} decoW={31} label="현재 우선순위" value={spine.currentBestMove.label} />
              <StatCard bg="#ECE4FC" tilt="cc-tl" deco="star-purple" decoRotate={-12} decoW={29} label={directionLabel ? '확인할 방향' : '이번 달 초점'} value={directionLabel ?? spine.solutionLayer.primaryModule.title} />
              <StatCard bg="#F2F0EB" tilt="cc-tr" deco="calendar-check" decoRotate={8} decoW={31} label="판단 시점" value={`${reevalShort} 재평가`} />
            </div>
          </>
        );
      })();

  // 맞춤 분석 — subtype 기반 메인 진단 4섹션. resultContext 있을 때만.
  const analysisBlock = spine.resultContext ? (() => {
        const rc = spine.resultContext;
        // 소제목 형광펜 — 글자 아래 절반만 칠한 마커 느낌. 소제목마다 색 다르게.
        const Label = ({ children, hl }: { children: React.ReactNode; hl: string }) => (
          <p>
            <span className="cc-cardtitle text-[13px]" style={{ display: 'inline', background: `linear-gradient(transparent 55%, ${hl} 55%)`, padding: '0 2px', fontWeight: 700, color: '#5B3FB2' }}>{children}</span>
          </p>
        );
        return (
          <section className="space-y-3" aria-label="맞춤 분석">
            <SectionTitle accent="#E0A8C0">맞춤 분석</SectionTitle>
            <div className="cc-sketch cc-tl relative overflow-hidden px-6 py-7">
              {/* 일러스트 — 우하단 꽃병, 좌하단 꽃, 우상단 하트 (각도 제각각) */}
              <Deco name="vase-flowers" w={58} rotate={-5} className="deco-vase right-2 bottom-2" />
              <Deco name="flower-orange" w={32} rotate={9} className="deco-opt left-2 bottom-1" />
              <Deco name="heart-coral" w={22} rotate={-10} className="deco-opt right-5 top-4" />
              <div className="relative space-y-6">
              <div className="space-y-2">
                <Label hl="#E9DEF8">지금 고민의 핵심</Label>
                <p className="text-[16px] text-zinc-800 leading-[1.8]">{renderEmphasis(rc.narrative.core)}</p>
              </div>
              <div className="space-y-2 border-t border-zinc-100 pt-5">
                <Label hl="#DCEFE2">이번 달 접근</Label>
                <p className="text-[15px] text-zinc-700 leading-[1.8]">{renderEmphasis(rc.narrative.monthlyApproach)}</p>
              </div>
              <div className="space-y-2 border-t border-zinc-100 pt-5">
                <Label hl="#F3EBCF">이번 주 한 수</Label>
                <p className="text-[15px] font-medium text-zinc-800 leading-[1.8]">{renderEmphasis(rc.narrative.weeklyMove)}</p>
              </div>
              {rc.signals.length > 0 && (
                <div className="space-y-2.5 border-t border-zinc-100 pt-5">
                  <Label hl="#F3DEEA">이렇게 판단한 이유</Label>
                  <ul className="space-y-1.5">
                    {rc.signals.map((s, i) => (
                      <li key={i} className="flex gap-2 text-[14px] text-zinc-600 leading-[1.7]">
                        <span className="text-violet-400 shrink-0" aria-hidden>·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
            </div>
          </section>
        );
      })() : null;

  // 반복될 수 있는 고민 패턴 — 보조 해석 카드(thesis 한 줄 + 패턴 1~2개)
  const trapsBlock = (() => {
        const story = MAIN_TYPE_NARRATIVES[spine.solutionLayer.mainTypeKey as MainTypeKey];
        if (!story) return null;
        const traps = story.traps.slice(0, 2);
        return (
          <Section title="반복될 수 있는 고민 패턴" accent="#F2C94C">
            <div className="cc-sketch cc-tr px-5 py-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] text-zinc-700 leading-[1.7]">{story.thesis}</p>
                <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full" title={spine.executionPlan.mainTypeLabel}>{mainTypeDisplayLabel}</span>
              </div>
              {traps.length > 0 && (
                <div className="border-t border-zinc-200/70 pt-3.5 space-y-3">
                  {traps.map((t) => (
                    <div key={t.title} className="flex gap-2.5">
                      <span className="text-amber-400 text-base leading-tight shrink-0 mt-0.5" aria-hidden>⚠</span>
                      <p className="text-[14px] text-zinc-600 leading-[1.65]">
                        <span className="font-bold text-zinc-800">{t.title.replace(/^함정 \d+ — /, '')}</span> — {t.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        );
      })();

  // 이번 달 실행 — 실행 전략 + 직무 힌트 + (필요 유형만) 하지 말 것 + 한 달 흐름(접힘)
  const executionBlock = (() => {
        const ep = spine.executionPlan;
        const hint = getExperimentJobHint(spine.profile, ep.coreExperiment.sourceOptionKey);
        const DECISION_TYPES = new Set(['conflictedAtFork', 'scatteredExplorer', 'lowOptionVisibility', 'unvalidatedAspirant']);
        const recovery = spine.solutionLayer.mainTypeKey === 'overloadedBurnout' || spine.currentBestMove.optionKey === 'restRecover';
        const showDontDo = recovery || DECISION_TYPES.has(spine.solutionLayer.mainTypeKey);
        const dontDo = recovery
          ? '퇴사·이직·확장 같은 큰 결정을 지금 내리지 마세요. 에너지부터 회복하는 편이 다음 선택의 성공률을 높여요.'
          : '이번 달엔 퇴사·전환·확장 같은 큰 결정을 서두르지 마세요. 작게 시도해 반응부터 확인하는 게 먼저예요.';
        return (
          <Section title="이번 달 실행" accent="#B9A7E0">
            <div className="cc-sketch cc-tl px-5 py-5 space-y-3.5">
              <p className="text-[16px] font-bold text-zinc-900 leading-[1.55]">{ep.strategyStatement}</p>
              {hint && (
                <p className="text-[14px] text-zinc-700 leading-[1.7] bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-[13px] font-bold text-emerald-800 mr-1.5">당신의 직무라면</span>{hint}
                </p>
              )}
              {showDontDo && (
                <div className="border-t border-zinc-100 pt-3">
                  <p className="text-[11px] font-bold tracking-wide text-amber-700 mb-1">이번 달엔 이건 하지 마세요</p>
                  <p className="text-[14px] text-zinc-700 leading-[1.7]">{dontDo}</p>
                </div>
              )}
              <details className="border-t border-zinc-100 pt-3">
                <summary className="text-[13px] font-bold text-indigo-700 cursor-pointer select-none">한 달 전체 흐름 보기</summary>
                <ol className="mt-3">
                  {ep.weeklyActions.map((s, i) => (
                    <li key={i} className="relative pl-14 py-2.5">
                      <span className="absolute left-0 top-1.5 w-11 h-[26px] rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">{s.week}</span>
                      {i < ep.weeklyActions.length - 1 && (
                        <span aria-hidden className="absolute left-[21px] top-9 -bottom-1 w-0.5 bg-indigo-200" />
                      )}
                      <span className="text-[15px] text-zinc-800 leading-[1.7]">{s.action}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </Section>
        );
      })();

  // 30일 후 다시 볼 질문 — 체크리스트 + 재평가일 + 멈춤 조건
  const reevalBlock = (() => {
        const ep = spine.executionPlan;
        const burnoutFamily = spine.solutionLayer.mainTypeKey === 'overloadedBurnout'
          || ['energyDepletion', 'decisionOverload', 'environmentDrain'].includes(spine.resultContext?.primarySubtype ?? '')
          || spine.currentBestMove.optionKey === 'restRecover';
        return (
          <Section title="30일 후 다시 볼 질문" accent="#E0A8C0">
            <div className="cc-sketch cc-tr px-5 py-5 space-y-4">
              <ul className="space-y-1.5">
                {ep.reevaluationChecklist.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!reevalChecks[c]}
                        onChange={() => toggleReevalCheck(c)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 cursor-pointer"
                      />
                      <span className={reevalChecks[c] ? 'text-[15px] text-zinc-400 line-through leading-[1.6]' : 'text-[15px] text-zinc-700 leading-[1.6]'}>{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-slate-500">{ep.reevaluationDateLabel}에 다시 봅니다.</p>
              <div className="rounded-xl px-4 py-3 border" style={{ background: TONE.caution.bg, borderColor: TONE.caution.bar }}>
                <p className="text-[13px] font-bold mb-0.5" style={{ color: TONE.caution.fg }}>이럴 땐 멈추고 조정하세요</p>
                <p className="text-[14px] leading-[1.65]" style={{ color: TONE.caution.fg }}>작은 시도 이후에도 불안이 커지거나 일상 리듬이 무너지면, 계획을 줄이고 회복 조건을 먼저 다시 봅니다.</p>
                {burnoutFamily && (
                  <p className="text-[14px] leading-[1.65] mt-1.5 pt-1.5 border-t" style={{ color: TONE.caution.fg, borderColor: TONE.caution.bar }}>2주 후에도 회복이 없거나 더 나빠진다면, 혼자 더 밀어붙이기보다 전문적인 도움을 받는 걸 권해요.</p>
                )}
              </div>
            </div>
          </Section>
        );
      })();

  // 다른 선택지가 올라오는 조건 — 옵션별 실제 리스크 + 승급 조건
  const alternativesBlock = (() => {
        const stratKey = spine.strategicDirection?.optionKey;
        const seen = new Set<string>([spine.currentBestMove.optionKey, ...(stratKey ? [stratKey] : [])]);
        const others: MoveRecommendation[] = [];
        const add = (m: MoveRecommendation | null) => { if (m && !seen.has(m.optionKey)) { others.push(m); seen.add(m.optionKey); } };
        if (spine.strategicDirection) others.push(spine.strategicDirection);
        add(spine.conditionalOption);
        add(spine.prepareAfterOption);
        add(spine.pauseOption);
        const promos = spine.executionPlan.promotionConditions;
        if (others.length === 0 && promos.length === 0) return null;
        return (
          <Section title="다른 선택지가 올라오는 조건" accent="#F2C94C">
            <div className="cc-sketch cc-tl px-5 py-4 space-y-4">
              {others.map((m, i) => (
                <div key={i}>
                  <p className="text-[15px] font-bold text-zinc-900 mb-1">{m.label}{topicParticle(m.label)} 지금이 아닌 이유</p>
                  <p className="text-[14px] text-zinc-600 leading-[1.7]">{OPTION_RISK_COPY[m.optionKey] ?? cleanRationale(m.rationale)}</p>
                </div>
              ))}
              {promos.length > 0 && (
                <div className="border-t border-zinc-100 pt-3.5 space-y-3">
                  <p className="text-[13px] font-bold text-indigo-700">이렇게 되면 1순위가 바뀝니다</p>
                  {promos.map((rule, i) => (
                    <div key={i}>
                      <p className="text-[14px] text-zinc-700 leading-[1.6]">
                        {rule.conditions.length === 1 ? (
                          <>다음이 확인되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라가요.</>
                        ) : (
                          <>아래 중 <span className="font-bold text-indigo-600">{rule.ifMetCount}가지</span>가 확인되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라가요.</>
                        )}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {rule.conditions.map((c, j) => (
                          <li key={j} className="text-[14px] text-zinc-600 flex gap-2 leading-[1.6]"><span className="text-indigo-400">·</span>{c.condition}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        );
      })();

  // 근거 자세히 보기 — 접힘 하단(단계형 PhaseSteps + 심리 신호 + 현실 장벽 + 이론 근거)
  const evidenceBlock = (
      <Section title="근거 자세히 보기" accent="#B9A7E0">
        <details className="cc-sketch cc-tr px-6 py-5">
          <summary className="text-[15px] font-bold text-zinc-700 cursor-pointer select-none">지금 어느 단계인지 보기</summary>
          <div className="mt-4 space-y-6">
              {/* 단계형 — % 대신 '확인 전 → 작은 반응 확인 → 장기 방향 판단' */}
              <div>
                <p className="text-[14px] font-bold text-zinc-700 mb-2.5">지금 단계</p>
                <PhaseSteps />
                <p className="text-[14px] text-zinc-600 leading-[1.7] mt-3">
                  지금은 장기 방향을 확정하기보다, 30일 동안 작은 반응과 생활 조건을 확인하는 단계예요.
                </p>
                <p className="text-[14px] text-zinc-600 mt-2">
                  <span className="font-semibold text-zinc-500 mr-1.5">실행 준비도</span>
                  <span className="font-bold text-zinc-800">{ACTION_READINESS_KO[spine.evidence.actionReadiness]}</span>
                </p>
              </div>

              {/* 심리 신호 — 정직한 3단계 점 표시(●●○). 엔진은 high/low 두 값만 주므로
                  연속 막대(78%/32%)는 없는 정밀도를 지어내는 셈 → 단계 표시로 교체. */}
              {spine.evidence.constructSignals.length > 0 && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2.5">심리 신호</p>
                  <div className="space-y-3">
                    {spine.evidence.constructSignals.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex-1 text-[14px] font-bold text-zinc-800">{s.humanLabel}</span>
                          <SignalDots level={s.level === 'high' ? 'high' : 'low'} />
                          <span className="w-9 shrink-0 text-right text-[12px] font-bold" style={{ color: s.level === 'high' ? TONE.progress.fg : TONE.caution.fg }}>
                            {s.level === 'high' ? '높음' : '낮음'}
                          </span>
                        </div>
                        <p className="text-[13px] text-zinc-500 leading-[1.6] mt-1">{s.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {spine.evidence.contextualBarriers.length > 0 && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2">현실 장벽</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spine.evidence.contextualBarriers.map((b, i) => (
                      <span key={i} className="text-[13px] font-medium px-2.5 py-1 rounded-full" style={{ background: TONE.caution.bg, color: TONE.caution.fg }}>{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* framework names live here only — 중첩 details (전체 근거 안의 더 깊은 접힘) */}
          <details className="border-t border-zinc-100 pt-3.5 mt-4">
            <summary className="text-[13px] font-semibold text-zinc-500 cursor-pointer select-none">이론적 근거 보기</summary>
            <p className="text-[13px] text-zinc-500 leading-[1.65] mt-2">{spine.evidence.theoryGroundedSummary}</p>
            {spine.evidence.constructSignals.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {spine.evidence.constructSignals.map((s, i) => (
                  <li key={i} className="text-[12px] text-zinc-400">{s.framework} · {s.construct} ({s.level === 'high' ? '높음' : '낮음'})</li>
                ))}
              </ul>
            )}
          </details>
        </details>
      </Section>
  );

  // Peak-End — 기억할 한 줄(closingLine). 데스크톱은 맨 끝, 모바일은 1페이지(결과 요약) 끝에.
  const closingBlock = spine.executionPlan.closingLine ? (
    <div className="mt-8 mb-2">
      <ClosingQuoteCard message={getClosingMessage(spine.executionPlan.closingLine)} />
    </div>
  ) : null;

  const footerBlock = (
    <div className="space-y-3">
      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-4"
        >
          처음부터 다시 하기
        </button>
      </div>
      <p className="text-center text-[11px] text-slate-500 leading-relaxed">
        본 결과는 현재 입력값 기준의 의사결정 참고용입니다. 조건이 바뀌면 결론도 달라질 수 있어요.
      </p>
    </div>
  );

  // ── 모바일 전용 페이지 콘텐츠 — 각 페이지가 1~1.3화면 안에서 핵심만, 세부는 접힘 ──
  const ep = spine.executionPlan;
  const mHint = getExperimentJobHint(spine.profile, ep.coreExperiment.sourceOptionKey);
  const M_DECISION = new Set(['conflictedAtFork', 'scatteredExplorer', 'lowOptionVisibility', 'unvalidatedAspirant']);
  const mRecovery = spine.solutionLayer.mainTypeKey === 'overloadedBurnout' || spine.currentBestMove.optionKey === 'restRecover';
  const mShowDontDo = mRecovery || M_DECISION.has(spine.solutionLayer.mainTypeKey);
  const mDontDo = mRecovery
    ? '퇴사·이직·확장 같은 큰 결정을 지금 내리지 마세요. 에너지부터 회복하는 편이 다음 선택의 성공률을 높여요.'
    : '이번 달엔 퇴사·전환·확장 같은 큰 결정을 서두르지 마세요. 작게 시도해 반응부터 확인하는 게 먼저예요.';
  // 대안 데이터
  const mStratKey = spine.strategicDirection?.optionKey;
  const mSeen = new Set<string>([spine.currentBestMove.optionKey, ...(mStratKey ? [mStratKey] : [])]);
  const mOthers: MoveRecommendation[] = [];
  const mAdd = (m: MoveRecommendation | null) => { if (m && !mSeen.has(m.optionKey)) { mOthers.push(m); mSeen.add(m.optionKey); } };
  if (spine.strategicDirection) mOthers.push(spine.strategicDirection);
  mAdd(spine.conditionalOption); mAdd(spine.prepareAfterOption); mAdd(spine.pauseOption);
  const mPromos = ep.promotionConditions;
  const mSig = spine.evidence.constructSignals;
  const mBarriers = spine.evidence.contextualBarriers;

  // 3페이지: 이번 달 실행 — 핵심 문장 + 하지 말 것 + 4주 compact(기본 노출), 직무 힌트만 접힘
  const mExecution = (
    <section className="space-y-3" aria-label="이번 달 실행">
      <SectionTitle accent="#B9A7E0">이번 달 실행</SectionTitle>
      <div className="cc-sketch cc-tl space-y-3.5">
        <p className="text-[15.5px] font-bold text-zinc-900 leading-[1.5]">{ep.strategyStatement}</p>
        {mShowDontDo && (
          <div className="border-t border-zinc-100 pt-3">
            <p className="cc-minilabel text-[11px] font-bold tracking-wide text-amber-700 mb-1">이번 달엔 이건 하지 마세요</p>
            <p className="text-[14px] text-zinc-700">{mDontDo}</p>
          </div>
        )}
        <div className="border-t border-zinc-100 pt-3">
          <p className="cc-minilabel text-[12px] font-bold text-zinc-500 mb-2.5">한 달 흐름</p>
          <ol className="relative">
            {ep.weeklyActions.map((s, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < ep.weeklyActions.length - 1 && (
                  <span aria-hidden className="absolute top-7 bottom-0 w-px" style={{ left: '27px', background: 'rgba(140,111,214,0.28)' }} />
                )}
                <span className="relative z-10 shrink-0 inline-flex items-center justify-center rounded-full text-[12.5px] font-bold whitespace-nowrap" style={{ minWidth: '54px', height: '26px', padding: '0 10px', background: '#ECE4FC', color: '#6044B5' }}>{s.week}</span>
                <span className="text-[14px] text-zinc-700 leading-[1.55] pt-0.5">{s.action}</span>
              </li>
            ))}
          </ol>
        </div>
        {mHint && (
          <details className="border-t border-zinc-100 pt-3">
            <summary className="text-[13px] font-bold text-indigo-700 cursor-pointer select-none">내 직무라면 (자세히)</summary>
            <p className="text-[14px] text-zinc-700 mt-2 leading-[1.6]"><span className="text-[13px] font-bold text-emerald-800 mr-1.5">당신의 직무라면</span>{mHint}</p>
          </details>
        )}
      </div>
    </section>
  );

  // 5페이지: 다른 선택지 — 토글 없는 설명형 카드(왜 지금이 아닌지 + 무엇이 확인되면 올라오는지).
  // 반복 패턴은 2페이지로 이동했으므로 여기엔 없음.
  const mAlternatives = (mOthers.length > 0 || mPromos.length > 0) ? (
    <section className="space-y-3" aria-label="다른 선택지가 올라오는 조건">
      <SectionTitle accent="#F2C94C">다른 선택지가 올라오는 조건</SectionTitle>
      <div className="cc-sketch cc-tl space-y-4">
        {mOthers.slice(0, 2).map((m, i) => (
          <div key={i} className={i > 0 ? 'border-t border-zinc-100 pt-3.5' : undefined}>
            <p className="cc-cardtitle text-[14.5px] font-bold text-zinc-900 mb-1">{m.label}{topicParticle(m.label)} 지금이 아닌 이유</p>
            <p className="text-[14px] text-zinc-600 leading-[1.6]">{OPTION_RISK_COPY[m.optionKey] ?? cleanRationale(m.rationale)}</p>
          </div>
        ))}
        {mPromos.length > 0 && (
          <div className="border-t border-zinc-100 pt-3.5 space-y-3">
            <p className="cc-cardtitle text-[13.5px] font-bold text-indigo-700">이렇게 되면 1순위가 바뀝니다</p>
            {mPromos.map((rule, i) => (
              <div key={i}>
                <p className="text-[14px] text-zinc-700 leading-[1.55] mb-1">
                  {rule.conditions.length === 1
                    ? <>다음이 확인되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라가요.</>
                    : <>아래 중 <span className="font-bold text-indigo-600">{rule.ifMetCount}가지</span>가 확인되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라가요.</>}
                </p>
                <ul className="space-y-1">
                  {rule.conditions.slice(0, 4).map((c, j) => (
                    <li key={j} className="text-[14px] text-zinc-600 flex gap-2 leading-[1.5]"><span className="text-indigo-400 shrink-0">·</span>{c.condition}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  ) : null;

  // 6페이지: 근거 — 핵심 요약 기본 노출(현재 단계/심리 신호/현실 장벽) + 단계·이론 접힘
  // 6페이지 — 근거 요약. 3개 블록으로 축소: 영향 신호 / 현실 장벽 / 쉬운 이론 설명.
  // (중복·내부용어 제거: 한 문장 요약·지금 단계·PhaseSteps·실행 준비도 삭제)
  const mEvidence = (
    <section className="space-y-3" aria-label="근거 보기">
      <SectionTitle accent="#B9A7E0">근거 자세히 보기</SectionTitle>

      <div className="cc-sketch cc-tr">
        {/* 판단에 영향을 준 신호 — 각 항목에 한 줄 설명 유지(브라우저와 통일) */}
        {mSig.length > 0 && (
          <div>
            <p className="cc-minilabel text-[12px] font-bold text-zinc-500 mb-2">판단에 영향을 준 신호</p>
            <div className="space-y-3">
              {mSig.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex-1 text-[14px] font-semibold text-zinc-800">{s.humanLabel}</span>
                    <SignalDots level={s.level === 'high' ? 'high' : 'low'} />
                    <span className="w-8 shrink-0 text-right text-[13.5px] font-semibold" style={{ color: s.level === 'high' ? TONE.progress.fg : TONE.caution.fg }}>{s.level === 'high' ? '높음' : '낮음'}</span>
                  </div>
                  <p className="text-[12.5px] text-zinc-500 leading-[1.5] mt-0.5">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 현실 장벽 */}
        {mBarriers.length > 0 && (
          <div className="border-t border-zinc-100 pt-3.5 mt-3.5">
            <p className="cc-minilabel text-[12px] font-bold text-zinc-500 mb-2">현실 장벽</p>
            <div className="flex flex-wrap gap-2">
              {mBarriers.map((b, i) => (<span key={i} className="text-[13px] font-medium rounded-full" style={{ padding: '5px 10px', background: '#FBEEE3', color: '#A85B22' }}>{b}</span>))}
            </div>
          </div>
        )}

        {/* 쉬운 이론 설명 */}
        <div className="border-t border-zinc-100 pt-3.5 mt-3.5">
          <p className="cc-minilabel text-[12px] font-bold text-zinc-500 mb-1.5">이 결과는 어떻게 나왔나요</p>
          <p className="text-[14px] text-zinc-600 leading-[1.6]">이 결과는 심리학 기반 진로 이론을 종합해 나온 거예요. 지금은 방향을 확정하기보다, 무엇을 먼저 확인하면 좋을지를 보여드려요.</p>
        </div>
      </div>
    </section>
  );

  // 모바일 6페이지 — 각 페이지가 하나의 역할(결론→납득→실행→재판정→대안→근거)
  const mobilePages = [
    { label: '결과 요약', nav: '맞춤 분석', content: <>{heroBlock}{profileBlock}{summaryBlock}<div className="cc-closing-gap">{closingBlock}</div></> },
    { label: '맞춤 분석', nav: '이번 달 실행', content: <>{analysisBlock}{trapsBlock}</> },
    { label: '이번 달 실행', nav: '30일 후 질문', content: mExecution },
    { label: '30일 후 다시 볼 질문', nav: '대안 조건', content: reevalBlock },
    { label: '다른 선택지가 올라오는 조건', nav: '근거 보기', content: mAlternatives },
    { label: '근거 자세히 보기', nav: '', content: mEvidence },
  ];

  return (
    <div className="cc-page min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* 데스크톱 — 기존 긴 단일 레이아웃 */}
        <div className="hidden sm:block space-y-10">
          {heroBlock}
          {profileBlock}
          {summaryBlock}
          {analysisBlock}
          {trapsBlock}
          {executionBlock}
          {reevalBlock}
          {alternativesBlock}
          {evidenceBlock}
          {closingBlock}
          {footerBlock}
        </div>
        {/* 모바일 — 6페이지 스텝형(요약→분석→실행→재판정→대안→근거). .cc-mobile 스코프에서만 밀도 축소 */}
        <div className="sm:hidden cc-mobile">
          <MobileResultPager pages={mobilePages} />
          <div className="mt-8">{footerBlock}</div>
        </div>
      </div>
    </div>
  );
}
