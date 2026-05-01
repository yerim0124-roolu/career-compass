/**
 * sajuInterpretation.ts — Structured saju behavior interpretation layer.
 *
 * Converts saju data (element profile, ten-god profile, day master) into
 * career-language: temperament, decision pattern, strengths, vulnerabilities.
 *
 * Current status: year-pillar only (partial).
 * Full manse calendar (만세력) engine is NOT yet connected.
 *
 * Architecture rule:
 *   This layer explains the PERSON and TIMING only.
 *   It must NOT override the final career strategy (determined by the data gate).
 *   When isFullManseConnected is true, day master + ten-god profile unlock
 *   significantly more accurate interpretation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export type TenGod =
  | '비견' | '겁재'   // self / competition → autonomy, independence
  | '식신' | '상관'   // output → expression, creativity, content/product creation
  | '편재' | '정재'   // wealth → business sense, monetization, customer value
  | '편관' | '정관'   // power → organization, responsibility, role expansion
  | '편인' | '정인';  // resource → learning, research, expertise, preparation

export interface SajuInterpretationInput {
  elementProfile?: Record<FiveElement, number>;    // from year-pillar derivation or full 4-pillar
  tenGodProfile?: Partial<Record<TenGod, number>>; // future: from full manse engine
  dayMaster?: FiveElement;                         // future: 일간(日干) from full manse
  dominantElement?: FiveElement;                   // year-pillar-only estimate (available now)
  isFullManseConnected: boolean;                   // always false until manse engine is wired
}

export interface SajuBehaviorProfile {
  status: 'full' | 'partial' | 'unavailable';
  temperament: string;
  decisionPattern: string;
  strengthPattern: string;
  vulnerabilityPattern: string;
  careerDirectionHint: string;
  timingHint: string;
  caution: string;          // honest about the limitation of the current estimate
  strategyBridge?: string;  // set by generateSajuStrategyBridge()
}

// ─── Element behavior maps — career language only ─────────────────────────────
// Do NOT expose raw saju terms as the main output.
// Every line must read as a behavioral or career insight.

interface ElementBehavior {
  temperament: string;
  decisionPattern: string;
  strengthPattern: string;
  vulnerabilityPattern: string;
  careerDirectionHint: string;
  timingHint: string;
}

const ELEMENT_BEHAVIOR: Record<FiveElement, ElementBehavior> = {
  wood: {
    temperament:
      '새로운 환경과 성장 가능성에서 에너지를 얻는 기질입니다. 변화를 통해 확장하려는 성향이 자연스럽게 나타납니다.',
    decisionPattern:
      '명확한 성장 경로가 보일 때 움직이는 편입니다. 탐색하면서 방향을 잡아가는 방식이 자신에게 맞습니다.',
    strengthPattern:
      '새로운 가능성을 먼저 발견하고, 탐색하면서 방향을 잡는 데 강합니다. 변화 친화적인 태도가 강점입니다.',
    vulnerabilityPattern:
      '여러 일을 동시에 시작하고 마무리하지 못할 수 있습니다. 방향이 많아질수록 집중이 분산됩니다.',
    careerDirectionHint:
      '성장 기회가 있는 환경 — 새로운 도전이나 확장 역할이 잘 맞습니다. 반복적인 환경보다 변화가 있는 곳에서 더 강점을 발휘합니다.',
    timingHint:
      '새로운 시도를 시작하기에 기회가 열리는 흐름입니다. 방향 전환이나 확장 시도를 검토하기에 좋은 시점입니다.',
  },
  fire: {
    temperament:
      '표현력과 추진 에너지가 강한 기질입니다. 사람과의 연결과 가시적인 성과에서 동기를 얻습니다.',
    decisionPattern:
      '에너지와 인정이 주어질 때 빠르게 움직입니다. 목표가 생기면 속도가 붙는 타입입니다.',
    strengthPattern:
      '아이디어를 실행으로 옮기고 사람을 움직이는 데 강합니다. 표현력과 실행력이 주요 강점입니다.',
    vulnerabilityPattern:
      '감정 압력 아래에서 충동적으로 결정할 수 있습니다. 열정이 식으면 지속성이 떨어지기도 합니다.',
    careerDirectionHint:
      '표현과 실행이 요구되는 환경 — 리더십, 영업, 창의 역할이 잘 맞습니다. 가시적인 성과와 빠른 피드백이 있는 곳에서 강합니다.',
    timingHint:
      '실행 에너지가 높은 흐름이지만, 소진도 빠를 수 있습니다. 페이스를 조절하며 진행하는 것이 중요합니다.',
  },
  earth: {
    temperament:
      '안정성과 책임감을 중시하는 기질입니다. 체계적인 계획과 신뢰할 수 있는 환경을 선호합니다.',
    decisionPattern:
      '기반이 안전하다는 확신이 생길 때 움직입니다. 준비가 충분히 됐다는 신호를 중요하게 여깁니다.',
    strengthPattern:
      '신뢰를 쌓고 장기적으로 지속하는 데 강합니다. 착실하게 축적하는 능력이 강점입니다.',
    vulnerabilityPattern:
      '결정을 너무 오래 미루거나 변화 시점을 놓칠 수 있습니다. 준비가 완벽해야 한다는 생각이 실행을 막기도 합니다.',
    careerDirectionHint:
      '체계와 안정이 있는 환경 — 장기 프로젝트, 신뢰 기반 역할이 잘 맞습니다. 단계적 성장이 가능한 곳에서 강합니다.',
    timingHint:
      '기반을 다지고 안정적으로 쌓기에 좋은 흐름입니다. 급격한 변화보다 내실을 다지는 방향이 유리합니다.',
  },
  metal: {
    temperament:
      '원칙과 전문성을 중시하는 기질입니다. 구조와 기준이 명확할 때 최고의 성과를 냅니다.',
    decisionPattern:
      '기준이 명확할 때 움직이고, 기준이 흐릴 때는 보류합니다. 데이터와 논리를 근거로 판단하는 편입니다.',
    strengthPattern:
      '전문 영역을 깊이 파고들고 높은 기준을 유지하는 데 강합니다. 구조화된 문제 해결 능력이 강점입니다.',
    vulnerabilityPattern:
      '완벽주의가 실행을 막거나, 유연성 부족으로 기회를 놓칠 수 있습니다. 기준이 너무 높아 협업에서 마찰이 생기기도 합니다.',
    careerDirectionHint:
      '전문성과 기준이 인정받는 환경 — 전문직, 품질 중심 역할이 잘 맞습니다. 명확한 평가 체계가 있는 곳에서 강합니다.',
    timingHint:
      '전문성을 깊이 쌓고 체계를 재정비하기에 좋은 흐름입니다. 기준을 높이고 역량을 정제하는 방향에 에너지를 집중하는 것이 유리합니다.',
  },
  water: {
    temperament:
      '상황을 읽고 적응하는 통찰형 기질입니다. 맥락과 흐름을 감지하는 감각이 뛰어납니다.',
    decisionPattern:
      '상황 맥락을 먼저 파악하고 리스크를 줄인 뒤에 움직입니다. 상황을 읽고 타이밍을 보는 방식이 자신에게 맞습니다.',
    strengthPattern:
      '상황을 빠르게 파악하고 리스크를 감지하는 데 강합니다. 다양한 환경에서 적응하는 유연성이 강점입니다.',
    vulnerabilityPattern:
      '완벽한 타이밍을 기다리다 실행이 계속 미뤄질 수 있습니다. 과도한 신중함이 기회 비용을 만들기도 합니다.',
    careerDirectionHint:
      '분석과 적응이 중요한 환경 — 전략, 리스크 관리, 컨설팅 역할이 잘 맞습니다. 맥락 파악이 중요한 포지션에서 강합니다.',
    timingHint:
      '성찰과 재정비, 다음 방향을 설계하기에 유리한 흐름입니다. 무리한 실행보다 내실을 다지고 준비를 갖추는 방향이 맞습니다.',
  },
};

// ─── Ten-god behavior map (future: full manse engine) ────────────────────────
// Each ten-god carries a career behavioral tendency when strong (high value).

interface TenGodBehavior {
  careerTendency: string;
  decisionModifier: string;
}

const TEN_GOD_BEHAVIOR: Record<TenGod, TenGodBehavior> = {
  '비견': { careerTendency: '자기 주도적 방향 설정, 독립적 결정', decisionModifier: '스스로 판단하고 자율적으로 움직임' },
  '겁재': { careerTendency: '경쟁적 실행력, 도전 의지', decisionModifier: '비교와 경쟁을 통해 동기 부여됨' },
  '식신': { careerTendency: '창의적 표현, 콘텐츠·제품 창출', decisionModifier: '창의적 아이디어로 결과물을 만드는 것이 자연스러움' },
  '상관': { careerTendency: '혁신 지향, 기존 체계 재해석', decisionModifier: '기존 방식에 도전하고 새 방향을 제시하려는 성향' },
  '편재': { careerTendency: '사업 감각, 기회 포착, 다양한 수익원 탐색', decisionModifier: '수익화 가능성과 시장 반응을 먼저 확인하는 편' },
  '정재': { careerTendency: '안정적 수익 관리, 신뢰 기반 거래', decisionModifier: '검증된 방법과 안정적 수입에 우선순위를 두는 편' },
  '편관': { careerTendency: '도전·성과 중심, 빠른 승진 지향', decisionModifier: '결과와 영향력을 중심으로 움직이는 편' },
  '정관': { careerTendency: '체계적 역할 수행, 조직 내 신뢰 축적', decisionModifier: '규칙과 역할 안에서 안정적으로 실행하는 편' },
  '편인': { careerTendency: '독립적 학습, 전문 분야 탐구', decisionModifier: '충분히 이해한 후 실행하려는 경향' },
  '정인': { careerTendency: '체계적 학습, 전문성 축적', decisionModifier: '검증된 지식과 전문 역량을 기반으로 판단하는 편' },
};

// ─── Helper: Korean element label → FiveElement ───────────────────────────────

const KOREAN_TO_ELEMENT: Record<string, FiveElement> = {
  '목(木)': 'wood',
  '화(火)': 'fire',
  '토(土)': 'earth',
  '금(金)': 'metal',
  '수(水)': 'water',
};

export function koreanLabelToElement(label: string): FiveElement | null {
  return KOREAN_TO_ELEMENT[label] ?? null;
}

// ─── Core interpretation function ─────────────────────────────────────────────

/**
 * Convert saju input into a structured behavior profile.
 *
 * Priority order for element resolution:
 *  1. dayMaster (most accurate — from full manse, not yet available)
 *  2. elementProfile dominant (from year + month pillar derivation, future)
 *  3. dominantElement (year-pillar only, available now)
 *
 * Ten-god overlay is applied on top when available (future).
 */
export function interpretSajuBehavior(input: SajuInterpretationInput): SajuBehaviorProfile {
  // No data at all
  if (!input.dominantElement && !input.dayMaster && !input.elementProfile) {
    return {
      status: 'unavailable',
      temperament: '',
      decisionPattern: '',
      strengthPattern: '',
      vulnerabilityPattern: '',
      careerDirectionHint: '',
      timingHint: '',
      caution: '사주 데이터가 없어 기질 분석을 제공할 수 없습니다.',
    };
  }

  // Resolve dominant element
  const element: FiveElement = (() => {
    // Future: use day master (일간) when full manse is connected
    if (input.dayMaster) return input.dayMaster;

    // Future: derive from full element profile
    if (input.elementProfile) {
      const entries = Object.entries(input.elementProfile) as [FiveElement, number][];
      return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    }

    // Current: year-pillar-only estimate
    return input.dominantElement!;
  })();

  const base = ELEMENT_BEHAVIOR[element];

  // Apply ten-god overlay when available (future feature)
  let tenGodNote = '';
  if (input.tenGodProfile && Object.keys(input.tenGodProfile).length > 0) {
    const sorted = (Object.entries(input.tenGodProfile) as [TenGod, number][])
      .sort((a, b) => b[1] - a[1]);
    const topGod = sorted[0]?.[0];
    if (topGod) {
      const tgb = TEN_GOD_BEHAVIOR[topGod];
      tenGodNote = ` 또한 ${tgb.careerTendency} 성향이 두드러지며, ${tgb.decisionModifier}.`;
    }
  }

  const caution = input.isFullManseConnected
    ? '생년월일시 기반 전체 분석입니다. 행동 성향과 타이밍 해석은 참고용으로 활용하세요.'
    : '생년 기반 간이 추정입니다. 생년월일시가 모두 있을 때 더 정확한 해석이 가능합니다. 참고용으로만 활용하세요.';

  const status: SajuBehaviorProfile['status'] = input.isFullManseConnected
    ? 'full'
    : 'partial';

  return {
    status,
    temperament:          base.temperament,
    decisionPattern:      base.decisionPattern + (tenGodNote ? tenGodNote : ''),
    strengthPattern:      base.strengthPattern,
    vulnerabilityPattern: base.vulnerabilityPattern,
    careerDirectionHint:  base.careerDirectionHint,
    timingHint:           base.timingHint,
    caution,
  };
}

// ─── Strategy bridge ──────────────────────────────────────────────────────────

/**
 * Connect saju behavior profile to the current primary strategy.
 * Produces 3–5 sentences that explain why the strategy fits this person's nature.
 *
 * Architecture rule:
 *   The bridge must SUPPORT the strategy, not contradict or reframe it.
 *   Never say the strategy is wrong because of saju.
 */
export function generateSajuStrategyBridge(
  profile: SajuBehaviorProfile,
  primaryStrategy: string,
): string {
  if (profile.status === 'unavailable') return '';

  // Base: who they are + how they decide
  const whoLine = profile.temperament;
  const decisionLine = `그래서 ${profile.decisionPattern}`;

  // Strategy connector — links decision pattern to the primary strategy
  let connectorLine: string;

  if (primaryStrategy.includes('회복')) {
    connectorLine = '지금 무리하게 결정하지 않고 먼저 에너지를 회복하는 선택은, 이 기질에 맞는 자연스러운 판단입니다.';
  } else if (primaryStrategy.includes('사이드 프로젝트') || primaryStrategy.includes('검증')) {
    connectorLine = '충분한 검증 없이 바로 뛰어들지 않고 먼저 시장에서 확인하는 방식은, 이 기질의 강점을 살리는 접근입니다.';
  } else if (primaryStrategy.includes('재직 중 이직 탐색') || primaryStrategy.includes('재직 중')) {
    connectorLine = '소득을 유지하면서 탐색하는 재직 중 접근은, 기반을 확인하고 움직이는 이 기질에 잘 맞는 전략입니다.';
  } else if (primaryStrategy.includes('이직 준비도') || primaryStrategy.includes('준비 후')) {
    connectorLine = '지금 바로 실행하기보다 먼저 역량을 쌓는 방향은, 충분히 준비된 후 움직이려는 이 기질에 부합합니다.';
  } else if (primaryStrategy.includes('현 직장 유지') || primaryStrategy.includes('직무 재설계')) {
    connectorLine = '급격한 전환보다 현 기반을 최적화하는 방향은, 안정적인 토대 위에서 움직이려는 이 기질과 잘 맞습니다.';
  } else if (primaryStrategy.includes('창업') || primaryStrategy.includes('실행 검토')) {
    connectorLine = '충분한 여건이 갖춰진 지금, 적극적으로 실행하는 전략은 이 기질의 추진 에너지를 잘 활용하는 방향입니다.';
  } else {
    connectorLine = '현재 선택한 전략은 이 기질의 방향성과 자연스럽게 연결됩니다.';
  }

  // Vulnerability note — honest, not discouraging
  const watchLine = `단, ${profile.vulnerabilityPattern.split('.')[0]}는 점을 의식하며 진행하면 더 좋습니다.`;

  return [whoLine, decisionLine, connectorLine, watchLine].join('\n');
}

// ─── Convenience: build from SajuTraitEstimate ───────────────────────────────
// Use this in ResultsDashboard without modifying Results type.

import type { SajuTraitEstimate } from '../types';

export function interpretFromTraitEstimate(
  estimate: SajuTraitEstimate | null,
): SajuBehaviorProfile {
  if (!estimate || estimate.confidence !== 'estimated') {
    return interpretSajuBehavior({ isFullManseConnected: false });
  }

  const element = koreanLabelToElement(estimate.dominantElement);
  return interpretSajuBehavior({
    dominantElement: element ?? undefined,
    isFullManseConnected: false,
  });
}
