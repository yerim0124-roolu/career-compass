import { useEffect, useState } from 'react';
import type { ResultSpine, ActionReadiness, MoveRecommendation, MainTypeKey } from '../../types/careerCompass.ts';
import { ARCHETYPE_LABELS, SUPPORT_TAG_LABELS } from '../../types/careerCompass.ts';
import { MAIN_TYPE_NARRATIVES } from '../../data/mainTypeNarratives.ts';
import { getExperimentJobHint } from '../../data/jobRoleExperimentHints.ts';
// 파스텔 인포그래픽 토큰 — 색에 '단일 의미'를 부여 (design-critique 권장 2).
//   progress(라벤더) = 강점·진행 / caution(피치) = 주의·부족 / done(민트) = 완료·안전 / neutral(회색)
const TONE = {
  progress: { bg: '#EEEBFE', fg: '#4338ca', bar: '#AFA9EC' },
  caution: { bg: '#FBEEE3', fg: '#b45309', bar: '#F5CDB3' },
  done: { bg: '#E4F5EC', fg: '#047857', bar: '#7FD0A8' },
  neutral: { bg: '#F1F5F9', fg: '#475569', bar: '#CBD5E1' },
} as const;

function StatCard({ tone, label, value }: { tone: keyof typeof TONE; label: string; value: string }) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl px-3.5 py-4" style={{ background: t.bg }}>
      <p className="text-[12px] font-bold opacity-90" style={{ color: t.fg }}>{label}</p>
      <p className="text-[15px] font-extrabold mt-1 leading-snug" style={{ color: t.fg }}>{value}</p>
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

// 확신성 도넛 — 모인 근거(라벤더) + 30일 실험이 채울 몫(피치) + 남는 부분(회색)
function ConfidenceDonut({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = Math.max(Math.min(score, 100), 8);
  const expFill = Math.min(40, 100 - filled);
  // 색 의미 통일: 모인 근거=progress(라벤더), 실험이 채울 몫=done(민트, '채워질' 안전),
  // 남는 부분=neutral(회색). caution(피치)은 여기서 쓰지 않는다 — 부족/주의 전용이므로.
  const seg = (pct: number, offsetPct: number, color: string) => (
    <circle
      r={r} cx={60} cy={60} fill="none" stroke={color} strokeWidth={16}
      strokeDasharray={`${(c * pct) / 100} ${c}`} strokeDashoffset={-(c * offsetPct) / 100}
      transform="rotate(-90 60 60)"
    />
  );
  return (
    <div className="flex gap-4 items-center py-1">
      <div className="relative w-[112px] h-[112px] shrink-0" role="img" aria-label={`장기 방향 근거가 ${score}% 모였어요`}>
        <svg viewBox="0 0 120 120" width="112" height="112">
          {seg(100, 0, TONE.neutral.bg)}
          {seg(filled, 0, TONE.progress.bar)}
          {seg(expFill, filled, TONE.done.bar)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-black text-slate-800">{score}%</span>
          <span className="text-[10px] text-slate-500">근거 모임</span>
        </div>
      </div>
      <div className="text-[13px] text-slate-600 leading-relaxed space-y-0.5">
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle" style={{ background: TONE.progress.bar }} />지금까지 모인 근거 <b>{score}%</b></p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle" style={{ background: TONE.done.bar }} />30일 실험이 채울 몫</p>
        <p><span className="inline-block w-2.5 h-2.5 rounded mr-1.5 align-middle border border-slate-200" style={{ background: TONE.neutral.bg }} />장기 확정에 남는 부분</p>
      </div>
    </div>
  );
}

// P3.9 UI — display-only softening of judgment-flavored mainType labels.
// The canonical MAIN_TYPE_LABELS stay untouched (engine copy, analytics payloads,
// tests all keep reading them); this map only changes the badge the user sees.
// Burnout keeps its name — naming the exhaustion is empathic accuracy, not judgment.
const MAIN_TYPE_DISPLAY: Partial<Record<MainTypeKey, string>> = {
  plateauedPerformer: '도약 준비 성실형',   // was 정체된 성실형 — same diagnosis, forward frame
  scatteredExplorer: '폭넓은 탐색형',        // was 탐색 과잉형
  lowOptionVisibility: '선택지 발굴형',      // was 기회 탐색 부족형
  unvalidatedAspirant: '검증 전 도전형',     // was 시장 미검증 도전형
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
function andParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0 ? '과' : '와';
  return '와(과)';
}

// 무료 개인화 — "당신의 이야기"는 유형별 고정 에세이라 같은 유형끼리 글자까지 똑같다.
// 직무·경력은 위 프로필 박스가 이미 보여주므로, 여기선 *유저 고유의 끌림(archetype 태그)과
// 기우는 방향*을 한 줄로 풀어 thesis 아래에 끼워, 같은 유형이라도 사람마다 다르게 읽히게 한다.
// 내부 라벨('전문 자문가', '투자/분석/리포트')을 그대로 쓰면 딱딱하므로, 사람 말 구절로 바꾼다.
// 데이터가 부족하면 null → 정적 에세이 그대로(폴백). 표시 전용(엔진·테스트 무영향).
const STATE_TYPES_NO_LEAD: ReadonlySet<MainTypeKey> = new Set<MainTypeKey>([
  'overloadedBurnout', 'realityLocked', 'lowOptionVisibility', // '상태' 유형 — 끌림·방향 호명이 톤에 안 맞아 정적 에세이가 낫다
]);
// archetype → '~하고 싶은 마음/감각/힘' 평문 구절 (모두 받침으로 끝나 와/과·이/가 처리 일관).
const ARCHETYPE_PULL_PHRASE: Record<string, string> = {
  expertExpander: '쌓은 전문성을 더 넓게 펼치고 싶은 마음',
  marketInterpreter: '시장과 흐름을 읽어내는 감각',
  careerComposer: '여러 길을 내 방식대로 엮고 싶은 마음',
  problemFounder: '문제를 직접 풀어 만들고 싶은 마음',
  expertBuilder: '실력으로 결과를 만들어내는 힘',
  knowledgeTranslator: '아는 걸 쉽게 풀어 전하고 싶은 마음',
  expertAdvisor: '전문성으로 방향을 짚어주고 싶은 마음',
  executionOperator: '맡은 일을 끝까지 굴려내는 추진력',
  recoveryFirst: '잠시 멈추고 회복하고 싶은 마음',
  stableRedesigner: '지금 자리를 지키며 바꿔가려는 마음',
};
// careerOption → '~하는' 평문 수식 구절 ('쪽'/'쪽으로'에 붙는다).
const DIRECTION_PHRASE: Record<string, string> = {
  stayRedesign: '지금 일을 바꿔보는',
  jobChange: '새 환경으로 옮기는',
  startup: '직접 만들어보는',
  independent: '독립해서 일하는',
  contentBrand: '콘텐츠로 풀어내는',
  advisoryTeaching: '전문성을 나누고 가르치는',
  investAnalysis: '분석하고 글로 풀어내는',
  orgLeadership: '지금 조직에서 더 크게 끌어가는',
  restRecover: '잠시 쉬어가는',
};
function personalizedStoryLead(spine: ResultSpine): string | null {
  const type = spine.solutionLayer.mainTypeKey;
  if (STATE_TYPES_NO_LEAD.has(type)) return null;
  const pulls = spine.identityAxis.archetypeTags.slice(0, 2).map((t) => ARCHETYPE_PULL_PHRASE[t]).filter(Boolean);
  if (pulls.length === 0) return null;
  // 끌리는 방향이 따로 있으면 그걸, 없으면(직접 추천형) 지금의 한 수를 방향으로.
  const dirMove = spine.strategicDirection ?? spine.currentBestMove;
  const dirPhrase = DIRECTION_PHRASE[dirMove.optionKey];
  // 다중 끌림형(갈림길·탐색 과잉): 두 결의 공존을 평문으로.
  if ((type === 'conflictedAtFork' || type === 'scatteredExplorer') && pulls.length >= 2) {
    const dirClause = (spine.strategicDirection && dirPhrase) ? ` 요즘은 ${dirPhrase} 쪽으로 마음이 더 기울어 있고요.` : '';
    return `당신 안에는 ${pulls[0]}${andParticle(pulls[0])} ${pulls[1]}${subjectParticle(pulls[1])} 함께 있어요.${dirClause}`;
  }
  // 단일 방향형: 가장 또렷한 끌림 + 방향.
  if (!dirPhrase) return `당신에게선 ${pulls[0]}${subjectParticle(pulls[0])} 특히 또렷해요.`;
  return `당신에게선 ${pulls[0]}${subjectParticle(pulls[0])} 또렷하고, 요즘은 ${dirPhrase} 쪽으로 마음이 향해 있어요.`;
}

interface Props {
  spine: ResultSpine;
  onRestart: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[19px] font-extrabold text-zinc-900 tracking-[-0.01em]">{title}</h2>
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
  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-10">
      {/* P3.9 UI — gradient identity hero: the result's visual payoff. Absorbs the
          P2.4 profile-context summary (headline/body/tags) so "이게 나" and "지금 상태"
          land in one block instead of a dashboard-style card stack. */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-700 px-7 py-10 text-center space-y-3.5 shadow-xl shadow-indigo-700/20">
        <div aria-hidden className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <p className="relative text-[11px] font-bold text-white/75 uppercase tracking-[0.14em]">당신의 중심축</p>
        <h1 className="relative text-2xl sm:text-3xl font-black text-white leading-snug">{spine.identityAxis.statement}</h1>
        {spine.identityAxis.archetypeTags.length > 0 && (
          <div className="relative flex flex-wrap justify-center gap-1.5 pt-0.5">
            {spine.identityAxis.archetypeTags.slice(0, 2).map((t) => (
              <span key={t} className="text-xs font-bold text-white bg-white/15 border border-white/30 px-3.5 py-1 rounded-full">
                {ARCHETYPE_LABELS[t]}
              </span>
            ))}
          </div>
        )}
        {spine.profileContext && (
          <div className="relative pt-3 mt-1 space-y-2.5 border-t border-white/20" aria-label="지금 상태 요약">
            <p className="text-[15px] font-bold text-white pt-3">
              {spine.profileContext.headline}
            </p>
            <p className="text-[14px] text-white/90 leading-[1.7] max-w-md mx-auto">
              {spine.profileContext.body}
            </p>
            {spine.profileContext.tags && spine.profileContext.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {spine.profileContext.tags.map((t) => (
                  <span key={t} className="text-[12px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 파스텔 스탯 카드 — P3.17: 결과 요약 3항목을 사용자가 가장 먼저 알고 싶은 순서로.
          '이번 달 실험'은 아직 구체 과제 전이라 이르다 → '검증할 방향'(strategicDirection)이 자연스럽다. */}
      {(() => {
        const dateMatch = spine.executionPlan.reevaluationDateLabel.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
        const reevalShort = dateMatch ? `${Number(dateMatch[2])}월 ${Number(dateMatch[3])}일` : '30일 후';
        const directionLabel = spine.strategicDirection?.label ?? spine.conditionalOption?.label;
        return (
          <div className="grid grid-cols-3 gap-3">
            {/* 색 의미: 현재 우선순위=done(민트), 검증할 방향=progress(라벤더), 판단 시점=neutral */}
            <StatCard tone="done" label="현재 우선순위" value={spine.currentBestMove.label} />
            <StatCard tone="progress" label={directionLabel ? '검증할 방향' : '이번 달 초점'} value={directionLabel ?? spine.solutionLayer.primaryModule.title} />
            <StatCard tone="neutral" label="판단 시점" value={`${reevalShort} 재평가`} />
          </div>
        );
      })()}

      {/* 당신의 이야기 — mainType 딥 서사 (정적 콘텐츠). 스토리 아크의 1막:
          유형 배지만 있고 해설이 없던 '분석 얇음'을 채우는 층. 플랜(그래서)보다
          먼저 와서 "왜 내 플랜이 이런 모양인지"의 복선이 된다. */}
      {(() => {
        const story = MAIN_TYPE_NARRATIVES[spine.solutionLayer.mainTypeKey as MainTypeKey];
        if (!story) return null;
        return (
          <section className="space-y-3">
            <h2 className="text-[19px] font-extrabold text-zinc-900 tracking-[-0.01em]">당신의 이야기</h2>
            {/* P3.11 — 카드 인플레이션 제거: 함정을 별도 박스에 가두지 않고 구분선 + 경고
                아이콘으로. 위계 점프(thesis 19 / 본문 16 / 함정 14)와 본문 대비 강화. */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-7 space-y-5">
              <p className="text-[19px] font-bold text-indigo-900 leading-[1.45] tracking-[-0.01em]">{story.thesis}</p>
              {(() => {
                const lead = personalizedStoryLead(spine);
                if (!lead) return null;
                return (
                  <p className="text-[15px] text-indigo-700 leading-[1.7] bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3">
                    {lead}
                  </p>
                );
              })()}
              <p className="text-base text-zinc-800 leading-[1.8]">{story.arrival}</p>
              <div className="border-t border-zinc-100 pt-5 space-y-4">
                {story.traps.map((t) => (
                  <div key={t.title} className="flex gap-3">
                    <span className="text-amber-500 text-lg leading-tight shrink-0 mt-0.5" aria-hidden>⚠</span>
                    <div>
                      <p className="text-[15px] font-bold text-zinc-900 mb-0.5">{t.title.replace(/^함정 \d+ — /, '')}</p>
                      <p className="text-[15px] text-zinc-600 leading-[1.7]">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-base text-zinc-800 leading-[1.8] border-t border-zinc-100 pt-5">{story.meaning}</p>
            </div>
          </section>
        );
      })()}

      {/* 이번 달 실행 계획 — one merged plan (module + core experiment + reeval + safety bridge).
          Replaces the separate solution-module / 30일 실험 / 재판정 sections. */}
      {(() => {
        const ep = spine.executionPlan;
        // Recovery tag guard: when the move is to rest/recover, "시장 반응 확인 필요" is off-message
        // in the main tag row (the user shouldn't be told to validate a market while recovering).
        // It stays internally in solutionLayer.supportTags and in future-option context.
        const recoveryGuard = spine.solutionLayer.mainTypeKey === 'overloadedBurnout' || spine.currentBestMove.optionKey === 'restRecover';
        const visibleTags = recoveryGuard
          ? ep.supportTagLabels.filter((t) => t !== SUPPORT_TAG_LABELS.marketInsightGap)
          : ep.supportTagLabels;
        return (
          <section className="space-y-3">
            {/* P3.17 — 정보구조 재배열(왜→무엇→어떻게). '추천 솔루션'을 4요소로:
                ① 무엇(currentBestMove) ② 왜 지금(primaryModule) + 오해 방지(안전판≠소극적)
                ③ 이번 달엔 하지 말 것 ④ 성공하면 다음 선택지가 어떻게 바뀌나. */}
            {(() => {
              const mod = spine.solutionLayer.primaryModule;
              // ③ '하지 말 것' — resultMode별. 검증/회복 모드는 큰 결정 유예가 핵심.
              const dontDo = spine.resultMode === 'recovery_first'
                ? '퇴사·이직·확장 같은 큰 결정을 지금 내리지 마세요. 에너지부터 회복하는 편이 다음 선택의 성공률을 높여요.'
                : (ep.safetyBridge && ep.directionToValidate)
                  ? '퇴사·전환·확장 같은 큰 결정을 이번 달에 내리지 마세요. 지금의 핵심은 ‘결정’이 아니라 ‘증거 수집’이에요.'
                  : '조급하게 크게 벌이지 마세요. 작게 시작해 신호부터 확인하는 게 이번 달의 일이에요.';
              const promo = ep.promotionConditions[0];
              const dir = ep.directionToValidate?.label ?? spine.strategicDirection?.label;
              return (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-extrabold tracking-wide text-emerald-800">그래서, 지금 당신에게 필요한 솔루션</p>
                    <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full" title={ep.mainTypeLabel}>{mainTypeDisplayLabel}</span>
                  </div>

                  {/* ① 솔루션(심리적 처방)이 헤드라인 */}
                  <p className="text-[21px] font-extrabold text-zinc-900 leading-[1.4] tracking-[-0.01em]">{mod.title}</p>
                  <p className="text-[15px] font-bold text-emerald-800 leading-[1.6]">{mod.goal}</p>
                  <p className="text-[15px] text-zinc-700 leading-[1.75]">{mod.why}</p>

                  {/* 위계 명확화 — 사용자가 고른 시도(coreExperiment)를 곧장 하지 말고 솔루션부터.
                      들어갈 건 '검증할 방향'(strategicDirection)이 아니라 '사용자가 고른 시도'다. */}
                  {(() => {
                    const DECISION_TYPES = new Set(['conflictedAtFork', 'scatteredExplorer', 'lowOptionVisibility']);
                    if (!DECISION_TYPES.has(spine.solutionLayer.mainTypeKey)) return null;
                    const tried = ep.coreExperiment.label;
                    return (
                      <p className="text-[14px] text-zinc-600 leading-[1.7] bg-white/60 border border-emerald-100 rounded-xl px-4 py-3">
                        이번 달의 핵심은 <span className="font-bold text-zinc-800">‘{tried}’</span> 같은 시도를 곧장 하는 게 아니라, <span className="font-bold text-zinc-800">{mod.title}</span>예요. 고른 시도는 기준이 선 다음에 그 기준을 확인해보는 방법일 뿐이고요.
                      </p>
                    );
                  })()}

                  {/* ② 커리어적 권고 — 내부 라벨처럼 안 보이게 사용자 언어로 풀어쓴다. */}
                  <div className="border-t border-emerald-200/70 pt-3.5 space-y-2">
                    <p className="text-[11px] font-bold tracking-wide text-emerald-700">커리어적으로는</p>
                    <p className="text-[15px] text-zinc-700 leading-[1.75]">
                      {ep.safetyBridge && ep.directionToValidate
                        ? '지금은 퇴사나 전환처럼 큰 결정을 내리기보다, 현재 일을 안전판으로 두고 “무엇을 지키고 무엇을 바꿀지”를 정리하는 단계가 적합해요.'
                        : spine.currentBestMove.rationale}
                    </p>
                  </div>

                  {/* ③ 짧은 추천 이유 — '왜 이 추천인가' 독립 섹션을 대체하는 박스 */}
                  <div className="border-t border-emerald-200/70 pt-3.5">
                    <p className="text-[11px] font-bold tracking-wide text-indigo-600 mb-1">추천 이유</p>
                    <p className="text-[14px] text-zinc-700 leading-[1.7]">
                      실행할 힘과 방향 감각은 있지만, {dir ? <>{dir}{topicParticle(dir)} </> : '이 방향이 '}실제 기회로 이어질지에 대한 확인은 아직 부족해요. 그래서 이번 달엔 큰 결정보다, 현재 일을 안전판으로 두고 내가 지킬 기준과 실제 반응을 함께 확인하는 게 가장 안전해요.
                    </p>
                  </div>

                  {/* ④ 하지 말 것 */}
                  <div className="border-t border-emerald-200/70 pt-3.5">
                    <p className="text-[11px] font-bold tracking-wide text-amber-700 mb-1">이번 달엔 이건 하지 마세요</p>
                    <p className="text-[14px] text-zinc-700 leading-[1.7]">{dontDo}</p>
                  </div>

                  {/* ④ 성공하면 다음 */}
                  {promo && (
                    <div className="border-t border-emerald-200/70 pt-3.5">
                      <p className="text-[11px] font-bold tracking-wide text-indigo-600 mb-1">검증에 성공하면</p>
                      <p className="text-[14px] text-zinc-700 leading-[1.7]">
                        {promo.conditions[0].condition}{promo.conditions.length > 1 ? ' 등' : ''}, 그러면 <span className="font-bold text-indigo-700">{promo.promoteToLabel}</span>{subjectParticle(promo.promoteToLabel)} 다음 1순위로 올라가요.
                      </p>
                    </div>
                  )}

                  {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {visibleTags.map((t) => (
                        <span key={t} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ⑤ 이번 달 핵심 실험 — 앞에서 맥락(진단·솔루션)을 만든 뒤 마지막에 '어떻게'.
                P3.19: 결정-난도 유형(갈림길·탐색과잉·선택지부족)에선 사용자가 고른 실험을
                신뢰하지 않는다(기준이 없어 '고를 게 없어서' 고른 것일 수 있음). 그 경우 콘텐츠
                같은 사용자 선택 실험을 헤드라인에서 빼고, 솔루션(기준 정리)의 firstStep을 그대로
                이번 달 행동으로 통일한다. 사용자가 고른 방향은 '검증할 방향'에 이미 남아 있다. */}
            {(() => {
              const DECISION_TYPES = new Set(['conflictedAtFork', 'scatteredExplorer', 'lowOptionVisibility']);
              const isDecisionType = DECISION_TYPES.has(spine.solutionLayer.mainTypeKey);
              const mod = spine.solutionLayer.primaryModule;
              const hint = getExperimentJobHint(spine.profile, ep.coreExperiment.sourceOptionKey);
              return (
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 space-y-3">
              {isDecisionType ? (
                <>
                  <p className="text-[11px] font-bold tracking-wide text-indigo-600">이번 달, 이렇게 시작해요</p>
                  <p className="text-[18px] font-extrabold text-zinc-900 leading-[1.45]">{mod.title}부터 — {ep.strategyStatement}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold tracking-wide text-indigo-600">이번 달 핵심 실험</p>
                  {/* coreExperiment.label — 테스트(REQUIRED J)와 비-결정 유형 헤드라인 */}
                  <p className="text-[18px] font-extrabold text-zinc-900 leading-[1.45]">{ep.coreExperiment.label}</p>
                  <p className="text-[14px] text-zinc-600 leading-[1.7]">{ep.coreExperimentBridge ?? ep.strategyStatement}</p>
                  {hint && (
                    <p className="text-[15px] text-zinc-700 leading-[1.7] bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5">
                      <span className="text-[13px] font-bold text-emerald-800 mr-1.5">당신의 직무라면</span>{hint}
                    </p>
                  )}
                </>
              )}
              <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-4 mt-1">
                <p className="text-[12px] font-bold tracking-wide text-indigo-700 mb-1.5">👉 이번 주, 딱 이거 하나</p>
                <p className="text-[17px] font-extrabold text-indigo-950 leading-[1.55]">{spine.solutionLayer.primaryModule.firstStep}</p>
                {spine.topValueLabels && spine.topValueLabels.length >= 2 && (() => {
                  const top = spine.topValueLabels.slice(0, 3);
                  return (
                    <p className="text-[13px] text-indigo-700/90 leading-[1.6] mt-2.5">
                      당신이 위에서 꼽은 우선순위 <span className="font-bold">{top.join(' · ')}</span>{subjectParticle(top[top.length - 1])} 출발점이에요.
                    </p>
                  );
                })()}
                <details className="mt-3.5 pt-3 border-t border-indigo-200/70">
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
            </div>
              );
            })()}

            {/* ④⑤ success / stop */}
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4">
                <p className="text-[13px] font-bold text-emerald-700 mb-2">잘되고 있다는 신호</p>
                <ul className="space-y-1.5">{ep.successSignals.map((x, i) => <li key={i} className="text-[15px] text-zinc-700 flex gap-2 leading-[1.6]"><span className="text-emerald-500 font-bold">·</span>{x}</li>)}</ul>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white px-5 py-4">
                <p className="text-[13px] font-bold text-amber-700 mb-2">멈추거나 바꿀 때</p>
                <ul className="space-y-1.5">{ep.stopOrPivotCriteria.map((x, i) => <li key={i} className="text-[15px] text-zinc-700 flex gap-2 leading-[1.6]"><span className="text-amber-500 font-bold">·</span>{x}</li>)}</ul>
              </div>
            </div>

            {/* ⑥ re-evaluation (absorbs 재판정) */}
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <p className="text-[17px] font-extrabold text-zinc-900 mb-2.5">{ep.reevaluationDateLabel}에 다시 보기</p>
              {/* real checkboxes (persisted) — the old decorative □ glyphs looked
                  interactive but weren't, which is an affordance lie */}
              <ul className="space-y-1.5">
                {ep.reevaluationChecklist.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
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
            </div>

            {ep.secondaryModuleHint && (
              <p className="text-xs text-slate-500 px-1">{ep.secondaryModuleHint}</p>
            )}
          </section>
        );
      })()}

      {/* P3.20 — 사용자 지시: '왜 이 추천인가' 독립 narrative 섹션 제거(요약카드·당신의
          이야기·솔루션·근거·비추천과 중복). 짧은 추천 이유는 솔루션 카드 안으로 옮기고,
          여기는 '근거 자세히 보기'(도넛·심리신호·확신요소)만 남긴다. */}
      <Section title="근거 자세히 보기">
        <details className="rounded-2xl border border-zinc-200 bg-white px-6 py-5">
          <summary className="text-[15px] font-bold text-zinc-700 cursor-pointer select-none">장기 방향 근거가 얼마나 모였는지 보기</summary>
          <div className="mt-4 space-y-6">
              {/* 도넛 + 의미 풀이(28% 같은 숫자를 사용자 언어로) */}
              <div>
                <p className="text-[14px] font-bold text-zinc-700 mb-1.5">장기 방향 근거, 얼마나 모였나</p>
                <ConfidenceDonut score={spine.evidence.confidenceScore} />
                <p className="text-[14px] text-zinc-600 leading-[1.7] mt-2">
                  아직 장기 방향을 확정하기엔 근거가 부족한 상태예요. 지금까지 모인 단서는 약 <span className="font-bold text-indigo-700">{spine.evidence.confidenceScore}%</span> 수준이고, 나머지는 30일 동안 실제 반응을 보며 채워가는 거예요.
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

              {/* 확신을 움직인 것 — +/− 통합 리스트 */}
              {(spine.evidence.confidenceDrivers.raised.length > 0 || spine.evidence.confidenceDrivers.lowered.length > 0) && (
                <div>
                  <p className="text-[14px] font-bold text-zinc-700 mb-2">확신을 움직인 것</p>
                  <ul className="space-y-1.5">
                    {spine.evidence.confidenceDrivers.raised.map((r, i) => (
                      <li key={`r${i}`} className="text-[14px] text-zinc-700 flex gap-2 leading-[1.55]"><span className="font-black text-emerald-500">+</span>{r}</li>
                    ))}
                    {spine.evidence.confidenceDrivers.lowered.map((r, i) => (
                      <li key={`l${i}`} className="text-[14px] text-zinc-700 flex gap-2 leading-[1.55]"><span className="font-black text-amber-500">−</span>{r}</li>
                    ))}
                  </ul>
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

      {/* P3.18 — '추천하지 않는 선택지'를 Q&A로. "왜 지금 1순위가 아닌가"를 명시해
          "내 선택지가 무시됐다"가 아니라 "비교 평가됐다"로 느끼게 한다. 태그별 도입
          문구로 rationale을 풍부화하고, safe 1순위면 '함께 준비' 능동 프레임을 덧댄다. */}
      {(() => {
        const stratKey = spine.strategicDirection?.optionKey;
        const seen = new Set<string>([spine.currentBestMove.optionKey, ...(stratKey ? [stratKey] : [])]);
        const others: { tag: string; move: MoveRecommendation }[] = [];
        const add = (m: MoveRecommendation | null, tag: string) => { if (m && !seen.has(m.optionKey)) { others.push({ tag, move: m }); seen.add(m.optionKey); } };
        if (spine.strategicDirection) others.push({ tag: '검증 중', move: spine.strategicDirection });
        add(spine.conditionalOption, '조건 충족 시');
        add(spine.prepareAfterOption, '준비 후');
        add(spine.pauseOption, '지금은 보류');
        if (others.length === 0) return null;

        // 태그 → 답변 도입부 (rationale 앞에 붙여 풍부화). P3.20 — 자연스러운 문안.
        const lead: Record<string, string> = {
          '검증 중': '방향성은 잘 맞아요. 다만 ‘좋아요’나 관심보다 중요한 건, 사람들이 실제로 시간을 쓰거나 비용을 낼 만큼 그 문제를 느끼는지예요. 그 신호가 아직 충분히 확인되지 않았어요.',
          '조건 충족 시': '방향은 좋지만, 아직 실제 반응이 충분히 확인되지 않았어요. ',
          '준비 후': '준비가 조금 더 필요해서예요. ',
          '지금은 보류': '에너지가 아주 낮은 상태라기보다, 방향을 정리해야 하는 신호가 더 강해요. 그래서 완전한 회복 모드보다 기준 정리와 작은 검증이 더 적합해요. ',
        };
        const SAFE_NOW = new Set(['stayRedesign', 'jobChange', 'orgLeadership', 'restRecover']);
        const safeLed = SAFE_NOW.has(spine.currentBestMove.optionKey);

        return (
          <Section title="왜 다른 선택지는 지금이 아닐까?">
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 space-y-4">
              {safeLed && (
                <p className="text-[14px] text-zinc-600 leading-[1.7] pb-3 border-b border-zinc-100">
                  이번 달은 <span className="font-bold text-zinc-800">{spine.currentBestMove.label}</span>로 시작하지만, 아래 방향들도 무시한 게 아니라 함께 저울에 올린 거예요. 같은 기간에 조금씩 준비해 두면 다음 결정이 가벼워져요.
                </p>
              )}
              {others.map((it, i) => (
                <div key={i}>
                  <p className="text-[15px] font-bold text-zinc-900 mb-1">왜 {it.move.label}{topicParticle(it.move.label)} 지금 1순위가 아닐까?</p>
                  <p className="text-[14px] text-zinc-600 leading-[1.7]">{lead[it.tag] ?? cleanRationale(it.move.rationale)}</p>
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* 조건이 바뀌면 올라올 선택지 — promotion conditions only (contextual, ≤2), collapsed.
          Warnings are NOT repeated here; they live in the plan's 멈추거나 바꿀 때. */}
      {spine.executionPlan.promotionConditions.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="text-sm font-bold text-slate-700 cursor-pointer select-none">조건이 바뀌면 올라올 선택지</summary>
          <div className="mt-3 space-y-3">
            {spine.executionPlan.promotionConditions.map((rule, i) => (
              <div key={i}>
                <p className="text-sm text-slate-700">
                  {rule.conditions.length === 1 ? (
                    <>다음 조건이 충족되면 <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라갑니다.</>
                  ) : (
                    <>아래 조건 중 <span className="font-bold text-indigo-600">{rule.ifMetCount}개 이상</span> 충족되면{' '}
                    <span className="font-bold">{rule.promoteToLabel}</span>{subjectParticle(rule.promoteToLabel)} 1순위로 올라갑니다.</>
                  )}
                </p>
                <ul className="mt-1 space-y-1">
                  {rule.conditions.map((c, j) => (
                    <li key={j} className="text-sm text-slate-600 flex gap-2"><span className="text-indigo-400">·</span>{c.condition}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Optional saju/timing layer is intentionally hidden until implemented (placeholder removed
          from the main result to reduce clutter). optionalSajuLayer stays on the model for later. */}

      {/* Peak-End: the last substantive thing the user reads is the plan's affirming
          one-liner (mainType-aware closingLine), not the disclaimer. Moved here from
          the plan section so the page ends on permission, not hedging. */}
      {spine.executionPlan.closingLine && (
        <p className="pt-3 text-center text-[19px] font-extrabold text-slate-800 leading-relaxed px-4">
          {spine.executionPlan.closingLine}
        </p>
      )}

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-4"
        >
          처음부터 다시 하기
        </button>
      </div>
      {/* small but WCAG-readable (slate-500 ≥ 4.5:1 on white) */}
      <p className="text-center text-[11px] text-slate-500 leading-relaxed">
        본 결과는 현재 입력값 기준의 의사결정 참고용입니다. 조건이 바뀌면 결론도 달라질 수 있어요.
      </p>
    </div>
  );
}
