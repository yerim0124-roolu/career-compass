import { useState, useRef } from 'react';
import type {
  Results, FormData, OptionKey, ConfidenceLevel,
  RankedOption, DirectionType, ExecutionMode, OptionRole,
  StateTimingLevel,
} from '../types';
import ShareCard from './ShareCard';
import { calculateManseChartSync } from '../utils/manseEngine';
import { interpretManseForCareer, buildDeepPersonaNarrative } from '../utils/sajuFromManse';

import type { SajuBehaviorProfile } from '../utils/sajuInterpretation';
import type { ManseChart } from '../utils/manseEngine';

function isManseCalculated(chart: ManseChart): boolean {
  return (chart?.status === 'calculated' || chart?.status === 'partial')
    && !!chart.dayMaster;
}

// ─── Step5 timing view builder ────────────────────────────────────────────────

type Step5TimingView = {
  status: 'calculated' | 'partial' | 'stateOnly';
  headline: string;
  stateSentence: string;
  currentYearSentence?: string;
  nextYearSentence?: string;
  recommendation: string;
  caution?: string;
};

function dominantLuckKey(luck: NonNullable<ManseChart['currentYearLuck']>): string {
  const scores: Record<string, number> = {
    expansion: luck.expansion, stability: luck.stability, change: luck.change,
    promotion: luck.promotion, learning:  luck.learning,  rest:    luck.rest,
  };
  return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function yearSentence(luck: NonNullable<ManseChart['currentYearLuck']>, isCurrent: boolean): string {
  const label = isCurrent ? '올해' : '내년';
  switch (dominantLuckKey(luck)) {
    case 'expansion': return `${label}는 새로운 시도를 작게 열어보기 좋은 흐름입니다.`;
    case 'stability': return `${label}는 안정 기반을 유지하면서 기회를 선별하는 흐름입니다.`;
    case 'change':    return `${label}는 변화 압력이 높아, 주도적으로 방향을 정하는 것이 유리합니다.`;
    case 'promotion': return `${label}는 인정과 역할 확장에 에너지가 맞는 흐름입니다.`;
    case 'learning':  return `${label}는 전면 실행보다 준비와 역량 축적이 더 유리한 흐름입니다.`;
    case 'rest':      return `${label}는 회복과 재정비에 에너지가 맞는 흐름입니다.`;
    default:          return `${label}는 특별히 강한 방향 신호는 없습니다.`;
  }
}

function hookForStrategy(primaryStrategy: string, stateLevel: StateTimingLevel): string {
  if (stateLevel === '회복 우선')
    return '지금은 먼저 에너지를 회복해야 할 시기입니다. 소진된 상태에서의 결정은 비용이 큽니다.';
  if (primaryStrategy.includes('창업') || primaryStrategy.includes('독립') || primaryStrategy.includes('사이드'))
    return '지금 시장 반응을 확인하기 시작할 수 있는 시기입니다. 방향 없는 행동보다 작은 검증이 먼저입니다.';
  if (primaryStrategy.includes('이직') || primaryStrategy.includes('전환') || primaryStrategy.includes('탐색'))
    return '지금은 움직일 수 있는 시기입니다. 다만 방향 없이 움직이면 손실이 커질 수 있습니다.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무') || primaryStrategy.includes('내부'))
    return '지금은 내부 조건을 개선하는 것이 더 빠른 방법일 수 있습니다. 이직보다 역할 재설계가 먼저입니다.';
  return '지금 타이밍에서 필요한 것이 무엇인지 명확히 하고, 그에 맞는 방식으로 움직이는 것이 중요합니다.';
}

function actionSentence(
  primaryStrategy: string,
  directionType: string,
  stateTimingLevel: StateTimingLevel,
): string {
  if (stateTimingLevel === '회복 우선')
    return '회복이 완료된 후 이 타이밍을 다시 확인하세요. 지금은 컨디션이 먼저입니다.';
  if (stateTimingLevel === '저강도 탐색')
    return '지금은 결정보다 탐색입니다. 작은 행동 하나로 신호를 먼저 확인하세요.';
  if (directionType === '자기 길 만드는 사람' || primaryStrategy.includes('사이드'))
    return '흐름이 받쳐주는 지금, 첫 번째 행동은 유료 고객 반응을 확인하는 것입니다.';
  if (primaryStrategy.includes('이직') || primaryStrategy.includes('탐색'))
    return '지금이 이직 탐색을 시작하기에 현실적인 시점입니다. 이력서부터 시작하세요.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무'))
    return '지금 환경 안에서 개선 가능한 조건을 먼저 확인하세요.';
  return '지금 타이밍에 맞게 가장 작은 첫 번째 행동을 시작하세요.';
}

function buildMansePart(
  cur: NonNullable<ManseChart['currentYearLuck']>,
  nxt: ManseChart['nextYearLuck'],
  primaryStrategy: string,
  stateTimingLevel: StateTimingLevel,
): string {
  const curDom = dominantLuckKey(cur);
  const nxtDom = nxt ? dominantLuckKey(nxt) : null;

  const isRecovery  = stateTimingLevel === '회복 우선' || primaryStrategy.includes('회복');
  const isStartup   = primaryStrategy.includes('사이드') || primaryStrategy.includes('창업');
  const isJobChange = primaryStrategy.includes('이직') || primaryStrategy.includes('탐색');
  const isInternal  = primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무');

  if (curDom === 'expansion' && nxtDom === 'expansion') {
    if (isRecovery)  return '올해와 내년 모두 확장 흐름이지만, 지금은 회복이 먼저입니다. 컨디션이 돌아오면 이 흐름을 활용하세요.';
    if (isStartup)   return '올해와 내년 모두 사이드 프로젝트를 검증하고 확장하기에 유리한 흐름입니다. 올해 첫 고객을 만들고 내년에 강도를 높이세요.';
    if (isJobChange) return '올해와 내년 모두 이직 탐색에 흐름이 받쳐줍니다. 올해 시장 반응을 확인하고 내년에 결정을 굳히는 방식이 자연스럽습니다.';
    if (isInternal)  return '올해와 내년 모두 역할 확장 에너지가 있습니다. 내부 재설계로 조건을 개선하기에 좋은 흐름입니다.';
    return '올해와 내년 모두 새로운 시도를 열어보기에 유리한 흐름입니다. 올해 검증을 시작하고 내년에 강도를 높이세요.';
  }

  if (curDom === 'expansion') {
    if (isRecovery)  return '흐름은 확장을 가리키지만, 지금 상태에서 무리하면 역효과입니다. 회복 후 이 에너지를 활용하세요.';
    if (isStartup)   return '올해 사이드 프로젝트를 시작하기에 흐름이 받쳐줍니다. 올해 안에 첫 번째 검증을 시작하세요.';
    if (isJobChange) return '올해 이직 탐색을 시작하기에 흐름이 맞습니다. 올해 안에 시장 반응을 확인하는 것이 유리합니다.';
    if (isInternal)  return '올해는 역할 확장과 조건 개선을 시도하기에 좋은 흐름입니다.';
    return '올해 안에 움직임을 시작하는 것이 흐름상 유리합니다.';
  }

  if (nxtDom === 'expansion') {
    if (isRecovery)  return '올해는 회복에 집중하고, 내년 확장 흐름이 올 때 실행을 시작하는 것이 더 자연스럽습니다.';
    if (isStartup)   return '올해는 아이디어와 방향을 정리하고, 내년에 사이드 프로젝트 검증을 본격화하는 방식이 잘 맞습니다.';
    if (isJobChange) return '올해는 준비를 다지고, 내년 흐름이 올 때 이직 탐색 강도를 높이는 방식이 자연스럽습니다.';
    return '올해는 검증을 시작하고, 내년에는 확장 강도를 높이는 방식이 더 자연스럽습니다.';
  }

  if (curDom === 'rest') {
    if (isRecovery) return '흐름도, 상태도 모두 회복을 가리키고 있습니다. 지금은 쉬는 것이 전략입니다.';
    return '올해 흐름은 회복과 재정비에 더 잘 맞습니다. 무리한 실행보다 내실을 다지는 시기입니다.';
  }

  if (curDom === 'learning' || curDom === 'stability')
    return '현재 흐름은 실행보다 준비와 기반 강화에 더 잘 맞습니다.';
  if (curDom === 'change')
    return '변화 압력을 주도적으로 활용해 전환의 동력으로 삼는 것이 유리합니다.';
  return '상태 기반 판단을 우선하세요.';
}

function buildStep5TimingView({
  stateTimingLevel, stateText, manseChart, primaryStrategy, burnoutPressure, runwayMonths,
}: {
  stateTimingLevel: StateTimingLevel;
  stateText: string;
  manseChart: ManseChart;
  primaryStrategy: string;
  burnoutPressure: number;
  runwayMonths: number;
}): Step5TimingView {
  const STATE_BASE: Record<StateTimingLevel, string> = {
    '회복 우선':   '현재 컨디션 지표상 무리한 실행보다 회복과 병행하는 방식이 안전합니다.',
    '저강도 탐색': '저강도 탐색을 유지하면서 방향을 잡아가는 시기입니다.',
    '실행 가능':   '지금은 실행을 시작하기에 준비된 상태입니다.',
  };

  const headline   = hookForStrategy(primaryStrategy, stateTimingLevel);
  const stateBase  = STATE_BASE[stateTimingLevel];

  const hasManse = isManseCalculated(manseChart) && !!manseChart.currentYearLuck;

  if (!hasManse) {
    return {
      status: 'stateOnly',
      headline,
      stateSentence: stateText,
      recommendation: stateBase,
      caution: burnoutPressure > 70
        ? '현재 피로도가 높아, 이 타이밍 판단은 컨디션 회복 후 다시 확인하세요.'
        : runwayMonths < 3 ? '재무 런웨이가 짧아, 빠른 실행이 필요한 상황입니다.' : undefined,
    };
  }

  const cur = manseChart.currentYearLuck!;
  const nxt = manseChart.nextYearLuck;
  const mansePart = buildMansePart(cur, nxt, primaryStrategy, stateTimingLevel);

  // Safety override: high burnout should not recommend aggressive action
  const recommendation = burnoutPressure > 70
    ? `${stateBase} 다만 현재 피로도가 올라와 있어, 전면 실행보다 회복과 병행하는 방식이 안전합니다.`
    : `${stateBase} ${mansePart}`;

  const caution = burnoutPressure > 70
    ? '현재 피로도가 높아, 이 타이밍 판단은 컨디션 회복 후 다시 확인하세요.'
    : runwayMonths < 3
    ? '재무 런웨이가 짧아, 빠른 실행이 필요한 상황입니다.'
    : undefined;

  return {
    status: manseChart.status as 'calculated' | 'partial',
    headline,
    stateSentence: stateText,
    currentYearSentence:  yearSentence(cur,  true),
    nextYearSentence:     nxt ? yearSentence(nxt, false) : undefined,
    recommendation,
    caution,
  };
}

interface Props {
  results: Results;
  form: FormData;
  onReset: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const CONF_CFG: Record<ConfidenceLevel, { label: string; cls: string }> = {
  high:   { label: '신뢰도 높음', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  medium: { label: '신뢰도 중간', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  low:    { label: '신뢰도 낮음', cls: 'bg-red-100 text-red-800 border-red-200' },
};

function statusForScore(v: number, invert = false): { label: string; cls: string; bar: string } {
  const d = invert ? 100 - v : v;
  if (d >= 70) return { label: '강점', cls: 'text-emerald-700',  bar: 'bg-emerald-400' };
  if (d >= 55) return { label: '보통',  cls: 'text-indigo-700',   bar: 'bg-indigo-400' };
  if (d >= 40) return { label: '중간',  cls: 'text-slate-600',    bar: 'bg-slate-400' };
  if (d >= 25) return { label: '주의', cls: 'text-amber-700',    bar: 'bg-amber-400' };
  return              { label: '위험', cls: 'text-red-700',      bar: 'bg-red-400' };
}

function SL({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</p>;
}

// ─── Direction / Execution color tokens ──────────────────────────────────────

const DIRECTION_COLOR: Record<DirectionType, { pill: string; bar: string }> = {
  '자기 길 만드는 사람':   { pill: 'bg-violet-100 text-violet-800 border-violet-200', bar: 'from-violet-500 via-indigo-400 to-purple-400' },
  '한 우물 파는 사람': { pill: 'bg-indigo-100 text-indigo-800 border-indigo-200', bar: 'from-indigo-500 via-sky-400 to-blue-400' },
  '같이 만들 때 잘하는 사람':   { pill: 'bg-sky-100 text-sky-800 border-sky-200',          bar: 'from-sky-500 via-indigo-400 to-slate-400' },
  '방향 바꾸고 싶은 사람':   { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', bar: 'from-emerald-500 via-teal-400 to-indigo-400' },
  '잠시 충전이 필요한 사람': { pill: 'bg-amber-100 text-amber-800 border-amber-200',    bar: 'from-amber-400 via-orange-300 to-red-300' },
  '차근차근 다지는 사람':   { pill: 'bg-slate-100 text-slate-700 border-slate-200',    bar: 'from-slate-500 via-stone-400 to-slate-400' },
};

const EXECUTION_PILL: Record<ExecutionMode, string> = {
  '즉시 실행':    'bg-emerald-100 text-emerald-800 border-emerald-200',
  '재직 중 검증': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '준비 후 전환': 'bg-sky-100 text-sky-700 border-sky-200',
  '회복 후 실행': 'bg-amber-100 text-amber-700 border-amber-200',
  '보류·점검':    'bg-red-100 text-red-700 border-red-200',
};

const ROLE_GROUP: Record<OptionRole, { label: string; badge: string; container: string }> = {
  primary:        { label: '가장 맞는 경로',    badge: 'bg-slate-900 text-white',                         container: 'border-slate-800 bg-white shadow-sm' },
  secondary:      { label: '함께 고려',    badge: 'bg-slate-500 text-white',                         container: 'border-stone-200 bg-white' },
  conditional:    { label: '준비 후 가능',  badge: 'bg-amber-100 text-amber-700 border border-amber-200', container: 'border-stone-200 bg-stone-50/50' },
  notRecommended: { label: '지금은 권하지 않음', badge: 'bg-red-100 text-red-700 border border-red-200', container: 'border-stone-200 bg-stone-50/50 opacity-70' },
};

const READINESS_LABELS: Record<string, { label: string; cls: string }> = {
  now:            { label: '지금 가능',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  prepareFirst:   { label: '준비 후 가능', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  conditional:    { label: '준비 후 가능',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  notRecommended: { label: '현재 비추천',  cls: 'bg-red-100 text-red-700 border-red-200' },
};

// ─── Step 1: 결론 — copy data ─────────────────────────────────────────────────

const EMPATHY_HOOK: Partial<Record<DirectionType, string>> = {
  '자기 길 만드는 사람':   '회사 다니면서도\n자꾸 내 걸 만들고 싶다는 생각이 든다면',
  '한 우물 파는 사람': '일이 싫은 건 아닌데\n5년 뒤에도 지금이랑 똑같을까봐 무섭다면',
  '같이 만들 때 잘하는 사람':   '회사가 싫은 건 아닌데\n자꾸 다른 회사 채용 공고를 보고 있다면',
  '방향 바꾸고 싶은 사람':   '이 길이 내 길은 아닌 것 같은데\n어디로 가야 할지 안 보인다면',
  '잠시 충전이 필요한 사람': '뭐든 다 귀찮고\n그냥 멈추고 싶다는 생각이 든다면',
  '차근차근 다지는 사람':   '변화가 좋다는 건 알지만\n지금 흔드는 게 정답은 아닌 것 같다면',
};
const EMPATHY_FALLBACK = '지금이 맞는 길인지\n자꾸 의심이 든다면';

const TENSION_COPY: Partial<Record<DirectionType, [string, string]>> = {
  '자기 길 만드는 사람':   [
    '지금 충동적으로 퇴사하면 6개월 뒤 통장이 알려줘요.',
    '그렇다고 계속 미루면 1년 뒤에도 똑같이 "내년엔..." 하고 있어요.',
  ],
  '한 우물 파는 사람': [
    '지금 환경에서 더 쌓아도 같은 자리만 더 두꺼워질 수 있어요.',
    '그렇다고 무작정 옮기면 쌓아온 게 흩어져요.',
  ],
  '같이 만들 때 잘하는 사람':   [
    '지금 자리에 머무는 동안, 시장에서 내 값은 조용히 떨어져요.',
    '그렇다고 화나서 던지듯 옮기면 새 회사에서도 똑같은 답답함을 마주해요.',
  ],
  '방향 바꾸고 싶은 사람':   [
    '지금 바로 학원 등록하면 비용만 새요.',
    '그렇다고 계속 미루면 1년 뒤에도 "준비 중"이에요.',
  ],
  '잠시 충전이 필요한 사람': [
    '지금 무리해서 결정하면 6개월 뒤 더 큰 비용으로 돌아와요.',
    '그렇다고 결정 자체를 피하면 답답함도 같이 길어져요.',
  ],
  '차근차근 다지는 사람':   [
    '그냥 계속 다니면 어느 순간 선택지가 사라져요.',
    '그렇다고 무작정 옮기면 지금 가진 것까지 잃어요.',
  ],
};

const PUNCHLINE: Partial<Record<DirectionType, string>> = {
  '자기 길 만드는 사람':   '지금 필요한 건\n돈 내고 사주는 사람 한 명을 찾는 거예요.',
  '한 우물 파는 사람': '지금 필요한 건\n내 전문성이 다른 곳에서도 통하는지 확인해보는 거예요.',
  '같이 만들 때 잘하는 사람':   '지금 필요한 건\n갈 수 있는 곳이 진짜 있는지부터 확인해보는 거예요.',
  '방향 바꾸고 싶은 사람':   '지금 필요한 건\n그 일을 하는 사람을 한 명 만나보는 거예요.',
  '잠시 충전이 필요한 사람': '지금 필요한 건\n다음 단계가 아니라, 오늘 잘 자는 거예요.',
  '차근차근 다지는 사람':   '지금 필요한 건\n옮기지 않고 바꿀 수 있는 게 뭐가 있는지 확인하는 거예요.',
};

const SAFETY_LOCK: Partial<Record<DirectionType, string>> = {
  '자기 길 만드는 사람':   '그 한 명을 만나기 전엔 퇴사하지 마세요. 그게 가장 비싼 보험이에요.',
  '한 우물 파는 사람': '답을 받아본 뒤에 결정해도 늦지 않아요. 지금은 답을 받을 준비만 하면 돼요.',
  '같이 만들 때 잘하는 사람':   '퇴사 결심은 지금 안 해도 돼요. 답을 찾을 준비를 하는 단계니까요.',
  '방향 바꾸고 싶은 사람':   '만나본 뒤에 갈지 결정해도 돼요. 지금은 길이 보이는지부터 확인하는 단계예요.',
  '잠시 충전이 필요한 사람': '회복 다 된 다음에 결정해도 돼요. 지금 내리는 결정은, 회복한 내가 다시 내릴 거예요.',
  '차근차근 다지는 사람':   '안에서 안 되는 게 확인되고 나서 밖을 봐도 늦지 않아요.',
};
const SAFETY_LOCK_SOFT = '결정은 지금 안 해도 돼요. 신호를 확인한 뒤에 내려도 늦지 않아요.';

// ─── Step 1: 결론 ─────────────────────────────────────────────────────────────

function Step1Conclusion({ results }: { results: Results }) {
  const { confidence, confidenceExplanation, confidenceLabel } = results;
  const cd = results.careerDiagnosis;
  const { bridgeMessage } = results.strategy;
  const confCfg = CONF_CFG[confidence];
  const dirColor = DIRECTION_COLOR[cd.directionType];
  const execPill = EXECUTION_PILL[cd.executionMode];

  const isRecoveryGate = cd.executionMode === '회복 후 실행' || cd.executionMode === '보류·점검';
  const isPrepareGate  = cd.executionMode === '준비 후 전환';
  const normalizePunchline = (lines: string[]): [string, string] => {
    const title = (lines[0] ?? '').trim();
    let body = (lines[1] ?? '').trim();
    if (!title || !body) return [title, body];

    const genericTitles = ['지금 필요한 건', '지금 필요한 것'];
    if (genericTitles.includes(title)) {
      for (const t of genericTitles) {
        if (body.startsWith(t)) {
          body = body.replace(t, '').replace(/^[:\s\-–—]+/, '').trim();
        }
      }
    }
    return [title, body];
  };

  const hook      = (EMPATHY_HOOK[cd.directionType] ?? EMPATHY_FALLBACK).split('\n');
  const tension   = TENSION_COPY[cd.directionType];

  const punchline = (() => {
    if (isRecoveryGate)
      return normalizePunchline(['지금 필요한 건', '결정이 아니라, 오늘 잘 자는 거예요.']);
    if (isPrepareGate) {
      const prepareMap: Partial<Record<typeof cd.directionType, string>> = {
        '자기 길 만드는 사람':   '지금 필요한 건\n창업 전 시장 검증 준비입니다.',
        '같이 만들 때 잘하는 사람':   '지금 필요한 건\n이직 경쟁력을 먼저 키우는 것입니다.',
        '한 우물 파는 사람': '지금 필요한 건\n전문성을 증명할 포트폴리오입니다.',
        '방향 바꾸고 싶은 사람':   '지금 필요한 건\n전환 전 실전 경험 한 가지입니다.',
      };
      return normalizePunchline((prepareMap[cd.directionType] ?? PUNCHLINE[cd.directionType] ?? '').split('\n'));
    }
    return normalizePunchline((PUNCHLINE[cd.directionType] ?? '').split('\n'));
  })();

  const safetyLock = isRecoveryGate
    ? '회복하기 전엔 어떤 큰 결정도 내리지 마세요. 지금 내린 결정은 회복한 내가 다시 내릴 거예요.'
    : (SAFETY_LOCK[cd.directionType] ?? SAFETY_LOCK_SOFT);

  return (
    <div className="space-y-3">

      {/* ① Empathy hook → Identity reveal (single hero card) */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${dirColor.bar}`} />
        <div className="px-5 pt-6 pb-5 sm:px-6">

          {/* Hook — pre-identity emotional framing */}
          {(() => {
            const PREPARE_HOOK: Partial<Record<typeof cd.directionType, [string, string]>> = {
              '자기 길 만드는 사람':   ['창업하고 싶은데', '지금 뛰어들기엔 아직 안 잡힌 게 많다면'],
              '같이 만들 때 잘하는 사람':   ['이직하고 싶은데', '지금 시장에서 내가 잘 통할지 자신이 없다면'],
              '한 우물 파는 사람': ['더 깊게 가고 싶은데', '어디서부터 손대야 할지 안 보인다면'],
              '방향 바꾸고 싶은 사람':   ['바꾸고 싶은데', '실제로 그 일을 해본 적이 없어서 두렵다면'],
            };
            const prepareHook = isPrepareGate ? (PREPARE_HOOK[cd.directionType] ?? [hook[0], hook[1] ?? hook[0]]) : null;
            return (
              <div className="mb-5">
                <p className="text-sm text-slate-500 leading-relaxed">
                  {isRecoveryGate ? '뭔가 해야 할 것 같은데' : prepareHook ? prepareHook[0] : hook[0]}
                </p>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                  {isRecoveryGate ? '지금은 그 뭔가를 할 힘이 안 남아있다면' : prepareHook ? prepareHook[1] : (hook[1] ?? hook[0])}
                </p>
              </div>
            );
          })()}

          {/* Identity reveal — recovery/prepare gate: execution first, direction secondary */}
          <div className="mb-5 pb-5 border-b border-stone-100">
            {isRecoveryGate ? (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">지금 상태</p>
                <h2 className="text-3xl sm:text-4xl font-black text-amber-600 leading-none tracking-tight mb-2">
                  회복이 먼저
                </h2>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  기본적으로는 <span className="font-bold text-slate-700">{cd.directionLabel}</span>이지만, 지금은 회복이 먼저예요.
                </p>
              </>
            ) : isPrepareGate ? (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">당신은</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-none tracking-tight mb-1">
                  {cd.directionLabel}
                </h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">지금 단계</span>
                  <span className="text-xs font-bold text-indigo-600">준비 후 전환</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">당신은</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-none tracking-tight mb-1">
                  {cd.directionLabel}
                </h2>
                <p className="text-xs text-slate-400 font-semibold">입니다</p>
              </>
            )}
          </div>

          {/* ② Tension — the stakes */}
          {(tension || isRecoveryGate) && (
            <div className="mb-5 space-y-1">
              <p className="text-sm text-slate-600 leading-relaxed">
                {isRecoveryGate ? '지금 상태에서 내린 결정은, 6개월 뒤 다시 내려야 해요.' : tension?.[0]}
              </p>
              <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                {isRecoveryGate ? '그렇다고 계속 버티면 회복 비용만 더 커져요.' : tension?.[1]}
              </p>
            </div>
          )}

          {/* ③ Punchline — the one thing to do */}
          {punchline.length >= 2 && (
            <div className={`rounded-xl px-4 py-4 mb-4 ${
              isRecoveryGate
                ? 'bg-amber-50 border border-amber-200'
                : isPrepareGate
                  ? 'bg-indigo-50 border border-indigo-200'
                  : 'bg-slate-900'
            }`}>
              <p className={`text-xs font-bold mb-1 ${
                isRecoveryGate ? 'text-amber-600' : isPrepareGate ? 'text-indigo-500' : 'text-white/60'
              }`}>{punchline[0]}</p>
              <p className={`text-xl sm:text-2xl font-black leading-tight ${
                isRecoveryGate ? 'text-amber-900' : isPrepareGate ? 'text-indigo-800' : 'text-white'
              }`}>{punchline[1]}</p>
            </div>
          )}

          {/* ④ Safety lock */}
          <p className="text-xs text-slate-500 leading-relaxed italic">{safetyLock}</p>
        </div>
      </div>

      {/* Supporting data — execution mode + confidence */}
      <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">지금 실행 방식</p>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${execPill}`}>{cd.executionLabel}</span>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${confCfg.cls}`}>{confidenceLabel}</span>
        </div>
        {/* Primary strategy — one line */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">핵심 전략</p>
          <p className="text-xs font-bold text-slate-800 leading-snug">{results.strategy.primaryStrategy}</p>
        </div>
        {/* Key metrics gauge bars */}
        {(() => {
          const isStartup = cd.directionType === '자기 길 만드는 사람';
          const mr = Math.round((results.derived.marketReadiness - 1) / 4 * 100);
          const metrics = isStartup
            ? [
                { label: '독립 실행 에너지', value: Math.round(results.derived.explorationDrive), color: 'bg-violet-400' },
                { label: '변화 의지', value: Math.round(results.derived.explorationDrive), color: 'bg-indigo-400' },
                { label: '재무 안전성', value: Math.round(results.derived.financialSafetyBase), color: 'bg-emerald-400' },
              ]
            : [
                { label: '이직 경쟁력', value: mr, color: 'bg-sky-400' },
                { label: '변화 의지', value: Math.round(results.derived.explorationDrive), color: 'bg-indigo-400' },
                { label: '재무 안전성', value: Math.round(results.derived.financialSafetyBase), color: 'bg-emerald-400' },
              ];
          return (
            <div className="space-y-2">
              {metrics.map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                    <p className="text-[10px] font-black text-slate-600">{value}</p>
                  </div>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Bridge note — only when divergence exists */}
      {(cd.bridgeNote || bridgeMessage) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">방향 vs 현실</p>
          <p className="text-xs text-slate-700 leading-relaxed">{cd.bridgeNote ?? bridgeMessage}</p>
        </div>
      )}

      {/* Confidence explanation — collapsed to one small line */}
      <p className={`text-[11px] leading-relaxed px-3 py-2.5 rounded-xl border ${confCfg.cls}`}>
        {confidenceExplanation}
      </p>
    </div>
  );
}

// ─── Persona story builder ────────────────────────────────────────────────────
// Produces a single cohesive narrative (5–7 sentences) that weaves together
// temperament, decision pattern, current behavior explanation, and strategy fit.
// No raw saju/ohaeng terminology — everything is translated into behavior.

function strategyCurrentBehavior(primaryStrategy: string): string {
  if (primaryStrategy.includes('회복'))
    return '그래서 지금, 에너지가 소진된 상태에서 어떤 결정을 내려도 실행력이 따라오지 못합니다.';
  if (primaryStrategy.includes('사이드 프로젝트') || (primaryStrategy.includes('검증') && !primaryStrategy.includes('이직 준비')))
    return '그래서 지금, 퇴사를 결정하기 전에 먼저 작은 실험으로 시장 반응을 확인하고 싶은 상태입니다.';
  if (primaryStrategy.includes('재직 중 이직') || primaryStrategy.includes('재직 중 탐색'))
    return '그래서 지금, 충동적으로 퇴사하기보다 자리를 유지하면서 시장 반응을 먼저 확인하려는 성향이 자연스럽게 나타납니다.';
  if (primaryStrategy.includes('준비도 강화') || primaryStrategy.includes('준비 후'))
    return '그래서 지금, 변화를 원하면서도 충분히 준비되지 않은 상태에서는 쉽게 뛰어들지 못합니다.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무 재설계'))
    return '그래서 지금, 급격한 전환보다 현재 기반 위에서 조건을 개선하는 방향이 더 자연스럽게 느껴집니다.';
  if (primaryStrategy.includes('창업') || primaryStrategy.includes('적극적 이직'))
    return '그래서 지금, 쌓아온 역량과 여건이 실행을 뒷받침하는 상태입니다.';
  return '그래서 지금, 상황에 맞게 판단하며 다음 방향을 탐색하는 시기입니다.';
}

function strategyValidation(primaryStrategy: string): string {
  if (primaryStrategy.includes('회복'))
    return '지금 회복을 먼저 선택하는 것은 미루는 게 아니라, 더 나은 결정을 위한 준비입니다. 지금 판단은 맞는 방향입니다.';
  if (primaryStrategy.includes('사이드 프로젝트') || (primaryStrategy.includes('검증') && !primaryStrategy.includes('이직 준비')))
    return '재직 중 먼저 검증하는 전략은, 확인 없이 뛰어들지 않는 이 사람의 방식과 정확히 맞습니다. 지금 판단은 맞는 방향입니다.';
  if (primaryStrategy.includes('재직 중 이직') || primaryStrategy.includes('재직 중 탐색'))
    return '재직 중 탐색 전략이 맞는 이유가 여기 있습니다. 검증 없이 뛰어드는 것은 이 사람의 방식이 아닙니다. 지금 판단은 맞는 방향입니다.';
  if (primaryStrategy.includes('준비도 강화') || primaryStrategy.includes('준비 후'))
    return '지금 준비를 먼저 쌓고 움직이는 전략은, 이런 판단 방식을 가진 사람에게 맞는 방향입니다. 지금 판단은 맞는 방향입니다.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무 재설계'))
    return '지금 환경에서 역할을 재설계하는 전략이 맞는 이유가 여기 있습니다. 지금 판단은 맞는 방향입니다.';
  if (primaryStrategy.includes('창업') || primaryStrategy.includes('적극적 이직'))
    return '지금 적극적으로 실행하는 전략이 맞는 이유가 여기 있습니다. 지금 판단은 맞는 방향입니다.';
  return '지금 선택한 전략은 이런 방식으로 결정을 내리는 사람에게 자연스럽게 맞는 방향입니다.';
}

function strategyClosing(primaryStrategy: string): string {
  if (primaryStrategy.includes('회복'))
    return '그래서 지금은 속도가 아니라, 에너지 회복이 가장 전략적인 행동입니다.';
  if (primaryStrategy.includes('사이드 프로젝트') || (primaryStrategy.includes('검증') && !primaryStrategy.includes('이직 준비')))
    return '그래서 지금은 전면 전환이 아니라, 검증이 먼저입니다.';
  if (primaryStrategy.includes('재직 중 이직') || primaryStrategy.includes('재직 중 탐색'))
    return '그래서 지금은 속도가 아니라, 방향 정확도가 더 중요한 시점입니다.';
  if (primaryStrategy.includes('준비도 강화') || primaryStrategy.includes('준비 후'))
    return '그래서 지금은 실행이 아니라, 역량을 쌓는 것이 가장 빠른 길입니다.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무 재설계'))
    return '그래서 지금은 이직이 아니라, 내부 최적화가 더 빠른 방법일 수 있습니다.';
  if (primaryStrategy.includes('창업') || primaryStrategy.includes('적극적 이직'))
    return '그래서 지금은 탐색이 아니라, 실행으로 결과를 만들어야 할 타이밍입니다.';
  return '그래서 지금은 속도가 아니라, 방향 정확도가 더 중요한 시점입니다.';
}

// Bridge sentence connecting saju temperament to current strategy
function sajuDirectionBridge(primaryStrategy: string): string {
  if (primaryStrategy.includes('회복'))
    return '다만 지금은 에너지가 소진된 상태여서, 이런 기질이 충분히 발휘되려면 먼저 회복이 필요합니다.';
  if (primaryStrategy.includes('재직 중 이직') || primaryStrategy.includes('재직 중 탐색'))
    return '지금은 이 기질을 이직 탐색에 활용하는 단계입니다. 조직 안에서 더 잘 맞는 환경을 찾는 것이 현실적인 방향입니다.';
  if (primaryStrategy.includes('사이드') || primaryStrategy.includes('창업'))
    return '지금은 이 기질을 사이드 프로젝트로 먼저 검증하는 단계입니다. 재직 중 작은 실험이 첫 번째입니다.';
  if (primaryStrategy.includes('현 직장') || primaryStrategy.includes('직무'))
    return '지금은 이 기질을 현재 환경 안에서 최대한 활용하는 단계입니다. 역할 재설계가 가장 빠른 방법입니다.';
  if (primaryStrategy.includes('준비'))
    return '지금은 이 기질을 역량 강화에 집중하는 단계입니다. 준비가 갖춰지면 자연스럽게 방향이 보입니다.';
  return '지금 전략은 이런 기질을 현실 조건에 맞게 실행하는 방식입니다.';
}

// Returns [paragraph1, bridge, paragraph2]
function buildPersonaStory(
  np: { headline: string; motivationDriver: string },
  saju: SajuBehaviorProfile,
  primaryStrategy: string,
): [string, string, string] {
  const hasSaju = saju.status !== 'unavailable';

  // Paragraph 1: A (temperament) + B (decision pattern)
  const temperament = hasSaju ? saju.temperament : np.headline;
  const decisionPattern = hasSaju
    ? `그래서 ${saju.decisionPattern}`
    : `그래서 ${np.motivationDriver}.`;
  const p1 = `${temperament} ${decisionPattern}`;

  // Bridge: connects saju temperament to current strategy
  const bridge = hasSaju ? sajuDirectionBridge(primaryStrategy) : '';

  // Paragraph 2: C (current behavior) + D (validation) + closing
  const current    = strategyCurrentBehavior(primaryStrategy);
  const validation = strategyValidation(primaryStrategy);
  const closing    = strategyClosing(primaryStrategy);
  const p2 = `${current} ${validation} ${closing}`;

  return [p1, bridge, p2];
}

// ─── Step 2: 당신은 이런 사람입니다 ──────────────────────────────────────────

function Step2Persona({ results, form }: { results: Results; form: FormData }) {
  const np = results.narrativePersona;
  const ps = results.personalityStory;
  const primaryStrategy = results.strategy.primaryStrategy;

  const manseChart = calculateManseChartSync(form.timing);
  const manseReady = isManseCalculated(manseChart);
  const hasPartialDate = !!(form.timing.birthYear && form.timing.birthMonth && form.timing.birthDay);

  // DEBUG: uncomment the line below and check browser console to diagnose deepNarrative issues
  // if (hasPartialDate) console.log('[Step2] manseChart:', manseChart);

  const sajuBehavior = manseReady
    ? interpretManseForCareer(manseChart, primaryStrategy)
    : { status: 'unavailable' as const, temperament: '', decisionPattern: '', strengthPattern: '', vulnerabilityPattern: '', careerDirectionHint: '', timingHint: '', caution: '' };
  // deepNarrative requires dayMaster. Falls back to p1 if manse calculation failed
  // (e.g. hasPartialDate=true but manseChart.status='failed' → check manseChart.warnings in console).
  const deepNarrative = manseReady ? buildDeepPersonaNarrative(manseChart) : '';
  const [p1, bridge, p2] = buildPersonaStory(np, sajuBehavior, primaryStrategy);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">

      {/* Header: label + archetype badge */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <SL>당신은 이런 사람입니다</SL>
        {ps.archetypeLabel && (
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 flex-shrink-0">
            {ps.archetypeLabel}
          </span>
        )}
      </div>

      {/* Paragraph 1: temperament + decision pattern */}
      <p className="text-sm text-slate-700 leading-loose mb-4">
        {deepNarrative || p1}
      </p>

      {/* Bridge: connects saju temperament to current strategy */}
      {bridge && (
        <p className="text-sm text-slate-600 leading-relaxed mb-4 bg-slate-50 border-l-2 border-slate-300 pl-3 py-1">
          {bridge}
        </p>
      )}

      {/* Paragraph 2: current behavior + strategy validation + closing */}
      <p className="text-sm text-slate-800 leading-loose">
        {p2}
      </p>

      {/* Strength / watchOut footnotes — minimal, not repeated from p1/p2 */}
      <div className="flex gap-3 mt-5 pt-4 border-t border-stone-100">
        <div className="flex-1">
          <p className="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1"><span>●</span> 강점</p>
          <p className="text-xs text-slate-600 leading-relaxed">{np.strength}</p>
        </div>
        <div className="w-px bg-stone-100 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold text-amber-600 mb-1 flex items-center gap-1"><span>⚠</span> 주의</p>
          <p className="text-xs text-slate-600 leading-relaxed">{np.watchOut}</p>
        </div>
      </div>

      {!manseReady && hasPartialDate && (
        <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-stone-100">
          생년월일 계산 중 오류가 발생했습니다. 날짜를 다시 확인해 주세요.
          {manseChart.warnings?.length > 0 && ` (${manseChart.warnings[0]})`}
        </p>
      )}
      {!manseReady && !hasPartialDate && (
        <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-stone-100">
          생년월일을 입력하면 성향 분석을 더 정확하게 계산합니다.
        </p>
      )}
      {manseReady && !form.timing.birthTime && (
        <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-stone-100">
          태어난 시간이 없어 일부 타이밍 해석은 제한됩니다.
        </p>
      )}
    </div>
  );
}

// ─── Step 3: 지금 상태는 이렇습니다 ──────────────────────────────────────────

function Step3State({ results }: { results: Results }) {
  const ns = results.narrativeState;
  const { derived, globalWarnings } = results;
  const marketPct = Math.round((derived.marketReadiness - 1) / 4 * 100);
  const bp = Math.round(derived.burnoutPressure);
  const isStartupDir = results.careerDiagnosis.directionType === '자기 길 만드는 사람';

  const metrics = isStartupDir
    ? [
        { label: '독립 실행 에너지', value: Math.round(derived.explorationDrive),    invert: false },
        { label: '재무 버팀력',       value: Math.round(derived.financialSafetyBase),  invert: false },
        { label: '에너지 잔량',       value: 100 - bp,                                  invert: false },
        { label: '시장 검증 가능성',  value: marketPct,                                invert: false },
      ]
    : [
        { label: '이직 경쟁력',  value: marketPct,                                invert: false },
        { label: '재무 버팀력',  value: Math.round(derived.financialSafetyBase),  invert: false },
        { label: '에너지 잔량',  value: 100 - bp,                                  invert: false },
        { label: '변화 의지',    value: Math.round(derived.explorationDrive),    invert: false },
      ];

  return (
    <div className="space-y-3">
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <SL>지금 상태는 이렇습니다</SL>

        <p className="text-sm font-semibold text-slate-800 mb-4 leading-relaxed">{ns.headline}</p>

        {/* Radar chart + score list */}
        {(() => {
          const size = 180;
          const cx = size / 2;
          const cy = size / 2;
          const r = 72;
          const n = metrics.length;
          const pts = metrics.map((m, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const fillVal = m.invert ? 100 - m.value : m.value;
            const dist = (fillVal / 100) * r;
            return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
          });
          const bgPts = metrics.map((_: any, i: number) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
          });
          const labelPts = metrics.map((m: any, i: number) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const dist = r + 22;
            return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), label: m.label };
          });
          const toPath = (p: {x:number;y:number}[]) =>
            p.map((pt,i) => `${i===0?'M':'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ') + ' Z';
          return (
            <div className="flex items-center gap-4 mb-5">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
                {[0.25,0.5,0.75,1].map((t: number) => (
                  <polygon key={t}
                    points={bgPts.map((p: any) => `${(cx+(p.x-cx)*t).toFixed(1)},${(cy+(p.y-cy)*t).toFixed(1)}`).join(' ')}
                    fill="none" stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {bgPts.map((p: any, i: number) => (
                  <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="#e5e7eb" strokeWidth="1" />
                ))}
                <path d={toPath(pts)} fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
                {pts.map((p: any, i: number) => (
                  <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill="#6366f1" />
                ))}
                {labelPts.map((p: any, i: number) => (
                  <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fontWeight="600" fill="#94a3b8">{p.label}</text>
                ))}
              </svg>
              <div className="flex-1 space-y-2.5">
                {metrics.map(({ label, value, invert }: any) => {
                  const st = statusForScore(value, invert);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs text-slate-500 font-medium">{label}</p>
                        <span className={`text-sm font-black ${st.cls}`}>{value}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st.bar}`}
                          style={{ width: `${invert ? 100-value : value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {isStartupDir && (
          <p className="text-[10px] text-slate-400 italic mb-3">이직 경쟁력은 소득 안정화를 위한 보조 경로로 활용할 수 있습니다.</p>
        )}

        {/* Diagnosis boxes */}
        <div className="space-y-2.5">
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3.5">
            <p className="text-xs font-black text-indigo-600 mb-1.5 flex items-center gap-1"><span>◆</span> 왜 이런 상황인가</p>
            <p className="text-sm text-slate-700 leading-relaxed">{ns.rootCause}</p>
          </div>
          <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-3.5">
            <p className="text-xs font-black text-emerald-600 mb-1.5 flex items-center gap-1"><span>→</span> 지금 상황의 의미</p>
            <p className="text-sm text-slate-700 leading-relaxed">{ns.implication}</p>
          </div>
        </div>
      </div>

      {globalWarnings.map((w) => (
        <div key={w} className="flex gap-2.5 bg-orange-50 border border-orange-300 rounded-2xl p-4">
          <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-[10px] font-black">!</span>
          </div>
          <p className="text-xs text-orange-900 leading-relaxed font-semibold">{w}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Step 4: 선택지 지도 ──────────────────────────────────────────────────────

const ROLE_ORDER: OptionRole[] = ['primary', 'secondary', 'conditional', 'notRecommended'];

function Step4OptionsMap({ results, form }: { results: Results; form: FormData }) {
  const [expandedKey, setExpandedKey] = useState<OptionKey | null>(null);

  const roleMap = Object.fromEntries(
    results.strategy.rankedOptions.map((r: RankedOption) => [r.key, r.role])
  );

  const grouped: Record<OptionRole, typeof results.scores> = {
    primary: [], secondary: [], conditional: [], notRecommended: [],
  };
  for (const s of results.scores) {
    const role = (roleMap[s.key] as OptionRole) ?? 'conditional';
    grouped[role].push(s);
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <SL>선택지 지도</SL>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          지금 상황에서 각 경로가 갖는 현실적 위치입니다. 순위보다 그룹이 더 중요합니다.
        </p>

        <div className="space-y-5">
          {ROLE_ORDER.map(role => {
            const group = grouped[role];
            if (group.length === 0) return null;
            const cfg = ROLE_GROUP[role];
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                  {role === 'primary' && (
                    <span className="text-[9px] text-slate-400 font-medium">현재 조건에 가장 맞는 경로</span>
                  )}
                  {role === 'notRecommended' && (
                    <span className="text-[9px] text-slate-400 font-medium">지금 조건에서는 위험 부담이 큼</span>
                  )}
                </div>

                <div className="space-y-2">
                  {group.map(s => {
                    const rd = READINESS_LABELS[s.readinessStatus] ?? READINESS_LABELS.conditional;
                    const isExpanded = expandedKey === s.key;
                    return (
                      <div key={s.key} className={`border-2 rounded-xl overflow-hidden ${cfg.container}`}>
                        <button
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                          onClick={() => setExpandedKey(isExpanded ? null : s.key)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold ${role === 'notRecommended' ? 'text-slate-500' : 'text-slate-800'}`}>
                                {s.label}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rd.cls}`}>{rd.label}</span>
                            </div>
                            {!isExpanded && s.matchReasons.length > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.matchReasons[0]}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-base font-black leading-none ${role === 'primary' ? 'text-slate-900' : 'text-slate-400'}`}>
                                {Math.round(s.totalScore)}
                              </span>
                              <div className="w-20 h-2 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${role === 'primary' ? 'bg-slate-800' : role === 'secondary' ? 'bg-slate-400' : 'bg-stone-200'}`}
                                  style={{ width: `${Math.min(100, Math.round(s.totalScore))}%` }}
                                />
                              </div>
                            </div>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-stone-100 px-4 pb-4 pt-3 space-y-2.5">
                            {/* Recommended action */}
                            {s.recommendedAction && (
                              <div className="bg-slate-800 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">다음 행동</p>
                                <p className="text-xs font-bold text-white leading-relaxed">{s.recommendedAction}</p>
                              </div>
                            )}
                            {/* Match reasons */}
                            {s.matchReasons.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">이유</p>
                                <ul className="space-y-1">
                                  {s.matchReasons.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                                      <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Mismatch risks */}
                            {s.mismatchRisks.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">우려 사항</p>
                                <ul className="space-y-1">
                                  {s.mismatchRisks.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                                      <p className="text-xs text-slate-600 leading-relaxed">{r}</p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Best condition */}
                            {s.bestCondition && (
                              <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">최적 조건</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{s.bestCondition}</p>
                              </div>
                            )}
                            {/* Warnings */}
                            {s.warnings.map((w) => (
                              <div key={w} className="flex gap-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-white text-[10px] font-black">!</span>
                                </div>
                                <p className="text-xs text-red-700 leading-relaxed">{w}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 💡 비선택 옵션 중 더 높은 점수가 있을 때 참고 표시 */}
      {(() => {
        // primary role에 들어간 옵션이 있는지 확인 (유저가 선택한 것 중 1순위)
        const hasPrimary = results.strategy.rankedOptions.some(r => r.role === 'primary');
        const primaryScore = results.scores.find(s =>
          results.strategy.rankedOptions.find(r => r.key === s.key && r.role === 'primary')
        )?.totalScore ?? 0;

        // 유저가 선택한 옵션 키
        const selectedKeys = new Set(
          results.strategy.rankedOptions
            .filter(r => r.role === 'primary' || r.role === 'secondary')
            .map(r => r.key)
        );

        // 케이스 1: primary가 없음 (회복 게이트 등) → 시스템 추천을 강조
        // 단, 유저가 이미 선택한 항목은 제외하고 그 외 옵션 중 최고 점수를 추천.
        if (!hasPrimary) {
          const userSelectedKeys = new Set(form.selectedOptions ?? []);
          const systemRecommend = [...results.scores]
            .sort((a, b) => b.totalScore - a.totalScore)
            .find(s => !userSelectedKeys.has(s.key));
          if (systemRecommend) {
            return (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">💡 시스템 추천</p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  선택하신 항목 외에, 현재 상황에서는{' '}
                  <span className="font-bold text-indigo-700">{systemRecommend.label}</span>이
                  가장 적합한 경로({Math.round(systemRecommend.totalScore)}점)로 분석됐어요.
                  참고해서 결정해보세요.
                </p>
              </div>
            );
          }
          return null;
        }

        // 케이스 2: primary는 있지만, 비선택 옵션 중 10점 이상 높은 게 있을 때
        const betterUnselected = results.scores
          .filter(s => !selectedKeys.has(s.key) && s.totalScore > primaryScore + 10)
          .sort((a, b) => b.totalScore - a.totalScore)[0];

        if (!betterUnselected) return null;
        return (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">💡 참고</p>
            <p className="text-xs text-slate-700 leading-relaxed">
              선택하지 않으셨지만, 현재 상황에서는{' '}
              <span className="font-bold text-indigo-700">{betterUnselected.label}</span>이
              더 높은 점수({Math.round(betterUnselected.totalScore)}점)를 받았어요.
              필요하다면 선택지에 추가해서 확인해보세요.
            </p>
          </div>
        );
      })()}

      {/* Strategy flip conditions */}
      {results.analysisReport.changeConditions.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2.5">언제 전략이 바뀌나요</p>
          <ul className="space-y-2">
            {results.analysisReport.changeConditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-slate-700 leading-relaxed">{c}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Timing level badge tokens ────────────────────────────────────────────────

const TIMING_LEVEL_CFG: Record<StateTimingLevel, { bg: string; text: string; label: string; bar: string }> = {
  '회복 우선':   { bg: 'bg-amber-50',   text: 'text-amber-800',  label: '회복 우선',   bar: 'bg-amber-400' },
  '저강도 탐색': { bg: 'bg-indigo-50',  text: 'text-indigo-800', label: '저강도 탐색', bar: 'bg-indigo-400' },
  '실행 가능':   { bg: 'bg-emerald-50', text: 'text-emerald-800',label: '실행 가능',   bar: 'bg-emerald-400' },
};

// ─── Step 5: 실행과 타이밍 ────────────────────────────────────────────────────

function Step5ActionTiming({ results, form }: { results: Results; form: FormData }) {
  const plan = results.actionPlanDetailed;
  const ta   = results.strategy.timingAdvice;
  const { derived, careerDiagnosis, strategy } = results;

  const manseChart = calculateManseChartSync(form.timing);

  const timingView = buildStep5TimingView({
    stateTimingLevel: ta.stateTimingLevel,
    stateText:        ta.stateText,
    manseChart,
    primaryStrategy:  strategy.primaryStrategy,
    burnoutPressure:  derived.burnoutPressure,
    runwayMonths:     derived.runwayMonths,
  });

  const hasManseSignals = timingView.status !== 'stateOnly';
  const hasNoTime       = hasManseSignals && !form.timing.birthTime;
  const hasPartialDate  = !!(form.timing.birthYear && form.timing.birthMonth && form.timing.birthDay);
  const levelCfg        = TIMING_LEVEL_CFG[ta.stateTimingLevel];

  const weeks = [
    { n: 1, ...plan.week1 },
    { n: 2, ...plan.week2 },
    { n: 3, ...plan.week3 },
    { n: 4, ...plan.week4 },
  ];

  return (
    <div className="space-y-4">

      {/* ① 타이밍 카드 — 먼저: 지금 움직여도 되나? */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">

        {/* Hook */}
        <div className={`px-5 py-5 ${levelCfg.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${levelCfg.text} border-current/20 bg-white/60`}>
              {levelCfg.label}
            </span>
          </div>
          <p className={`text-sm font-bold leading-relaxed ${levelCfg.text}`}>{timingView.headline}</p>
        </div>

        {/* 타이밍 설명 */}
        <div className="px-5 py-4 border-b border-stone-100">
          {hasManseSignals && (
            <p className="text-[11px] text-slate-400 mb-2.5">
              입력한 생년월일시와 현재 상태 지표를 함께 참고해, 지금 어떤 방식으로 움직이는 것이 적절한지 보여줍니다.
              {hasNoTime && ' 태어난 시간이 없어 일부 세부 타이밍은 제한됩니다.'}
            </p>
          )}
          {!hasManseSignals && !hasPartialDate && (
            <p className="text-[11px] text-slate-400 mb-2.5">
              생년월일 정보가 충분하지 않아 현재는 상태 기반 타이밍만 표시됩니다.
            </p>
          )}
          <p className="text-sm text-slate-700 leading-loose">{timingView.recommendation}</p>
          {timingView.caution && (
            <p className="text-xs text-amber-700 font-semibold mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              ⚠ {timingView.caution}
            </p>
          )}
        </div>

        {/* 올해 · 내년 흐름 — 화살표 타임라인 */}
        {hasManseSignals && (timingView.currentYearSentence || timingView.nextYearSentence) && (
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-xs font-black text-slate-600 mb-3 flex items-center gap-1"><span>📅</span> 올해 · 내년 흐름</p>
            <div className="flex items-stretch gap-0">
              {timingView.currentYearSentence && (
                <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-l-xl px-3 py-3">
                  <p className="text-[10px] font-black text-indigo-500 mb-1">올해</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{timingView.currentYearSentence}</p>
                </div>
              )}
              <div className="flex items-center justify-center w-7 bg-slate-100 flex-shrink-0">
                <span className="text-slate-400 text-sm">→</span>
              </div>
              {timingView.nextYearSentence && (
                <div className="flex-1 bg-stone-50 border border-stone-200 rounded-r-xl px-3 py-3">
                  <p className="text-[10px] font-black text-slate-400 mb-1">내년</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{timingView.nextYearSentence}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 지금 할 것 */}
        <div className="px-5 py-4">
          <p className="text-xs font-black text-slate-600 mb-2 flex items-center gap-1"><span>→</span> 지금 할 것</p>
          <div className="bg-slate-900 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-white leading-snug">
              {actionSentence(strategy.primaryStrategy, careerDiagnosis.directionType, ta.stateTimingLevel)}
            </p>
          </div>
          {ta.signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ta.signals.map((s) => (
                <span key={s} className="text-[10px] bg-stone-100 text-slate-500 rounded-full px-2.5 py-1 font-medium">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ② 다음에 확인해야 할 신호 */}
      {results.analysisReport.nextSignals.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-600 mb-3 flex items-center gap-1"><span>●</span> 다음에 확인해야 할 신호</p>
          <ul className="space-y-2.5">
            {results.analysisReport.nextSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 leading-loose">{s}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ③ 4주 실행 계획 — 마지막: 그래서 이렇게 해라 */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 pt-5 pb-3 border-b border-stone-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">4주 실행 계획</p>
          <p className="text-sm font-bold text-slate-800">{strategy.primaryStrategy}</p>
        </div>

        {/* 타임라인 */}
        <div className="px-5 py-4">
          <div className="relative">
            {/* 세로 연결선 */}
            <div className="absolute left-[18px] top-8 bottom-8 w-px bg-stone-200" />
            <div className="space-y-0">
              {weeks.map((w, idx) => (
                <div key={w.n} className="flex items-start gap-4 relative pb-5 last:pb-0">
                  {/* 주차 원형 */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white shadow-sm"
                    style={{ background: idx === 0 ? '#1e293b' : idx === 1 ? '#334155' : idx === 2 ? '#475569' : '#94a3b8' }}>
                    <span className="text-[11px] font-black text-white">{w.n}주</span>
                  </div>
                  {/* 내용 */}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-1.5">{w.task}</p>
                    <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">목표</span>
                      <span className="text-xs font-semibold text-indigo-700">{w.metric}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save / share */}
      <ShareCard results={results} form={form} />

      <p className="text-[10px] text-slate-400 leading-relaxed text-center px-2">
        본 결과는 커리어 의사결정을 돕는 참고용 분석입니다. 실제 퇴사, 이직, 창업 결정은 개인 상황과 전문가 상담을 함께 고려해 판단해야 합니다.
      </p>
    </div>
  );
}

// ─── Full-scroll layout ("전체 보기") ────────────────────────────────────────

function FullScrollView({ results, form, onReset }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-stone-100 border border-stone-200 rounded-2xl px-4 py-3 text-center">
        <p className="text-xs font-semibold text-slate-500">전체 보기 모드 — 모든 단계를 한 번에 확인합니다</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">1 · 결론</p>
        <Step1Conclusion results={results} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">2 · 당신은 이런 사람입니다</p>
        <Step2Persona results={results} form={form} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">3 · 지금 상태는 이렇습니다</p>
        <Step3State results={results} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">4 · 선택지 지도</p>
        <Step4OptionsMap results={results} form={form} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">5 · 실행과 타이밍</p>
        <Step5ActionTiming results={results} form={form} />
      </div>
      <button onClick={onReset}
        className="w-full bg-slate-900 hover:bg-black text-white font-semibold py-4 rounded-2xl transition-all">
        다른 상황으로 다시 분석하기
      </button>
    </div>
  );
}

// ─── Step funnel ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: '결론' },
  { label: '나는 이런 사람' },
  { label: '지금 상태' },
  { label: '선택지 지도' },
  { label: '실행·타이밍' },
];

// key must be on StepContent at the call site (not inside) to trigger React remount + animation.
function StepContent({
  step, results, form, animClass,
}: {
  step: number;
  results: Results;
  form: FormData;
  animClass: string;
}) {
  return (
    <div className={animClass}>
      {step === 0 && <Step1Conclusion results={results} />}
      {step === 1 && <Step2Persona results={results} form={form} />}
      {step === 2 && <Step3State results={results} />}
      {step === 3 && <Step4OptionsMap results={results} form={form} />}
      {step === 4 && <Step5ActionTiming results={results} form={form} />}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ResultsDashboard({ results, form, onReset }: Props) {
  const [step, setStep] = useState(0);
  const [fullScroll, setFullScroll] = useState(false);
  const [animClass, setAnimClass] = useState('step-in');
  const scrollRef = useRef<HTMLDivElement>(null);

  function goTo(next: number) {
    const dir = next > step ? 'step-in' : 'step-in-back';
    setAnimClass(dir);
    setStep(next);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cd = results.careerDiagnosis;

  return (
    <div className="min-h-screen bg-stone-50 pb-32">

      {/* Sticky header */}
      <div className="bg-white/95 backdrop-blur border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🧭</span>
            <span className="font-black text-slate-800 text-sm tracking-tight">Career Compass</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullScroll(v => !v)}
              className="text-[11px] text-slate-500 border border-stone-200 rounded-xl px-2.5 py-1.5 hover:bg-stone-100 transition-all font-semibold"
            >
              {fullScroll ? '단계별 보기' : '전체 보기'}
            </button>
            <button onClick={onReset}
              className="text-[11px] text-slate-500 flex items-center gap-1 border border-stone-200 rounded-xl px-2.5 py-1.5 hover:bg-stone-100 transition-all font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              다시 하기
            </button>
          </div>
        </div>

        {/* Step progress — only in funnel mode */}
        {!fullScroll && (
          <div className="max-w-xl mx-auto px-4 pb-3">
            {/* Step dots */}
            <div className="flex items-center gap-1.5 mb-2">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  aria-label={`${i + 1}단계: ${s.label}`}
                >
                  <div className={`h-1 rounded-full w-full transition-all ${i === step ? 'bg-slate-900' : i < step ? 'bg-slate-400' : 'bg-stone-200'}`} />
                  <span className={`text-[9px] font-bold transition-colors ${i === step ? 'text-slate-800' : 'text-slate-300'}`}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Step counter + direction label */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">{step + 1} / {STEPS.length}</span>
              <span className="text-[10px] font-bold text-slate-500">{cd.directionLabel} · {cd.executionLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="max-w-xl mx-auto px-4 py-5">
        {fullScroll ? (
          <FullScrollView results={results} form={form} onReset={onReset} />
        ) : (
          <StepContent key={step} step={step} results={results} form={form} animClass={animClass} />
        )}
      </div>

      {/* Bottom nav — only in funnel mode */}
      {!fullScroll && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-stone-200 z-20">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 border border-stone-200 rounded-xl px-4 py-3 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              이전
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => goTo(step + 1)}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-xl py-3 transition-all"
              >
                다음 — {STEPS[step + 1].label}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onReset}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-3 transition-all"
              >
                다시 분석하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
