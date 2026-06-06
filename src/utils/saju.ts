/**
 * saju.ts — Saju (사주) trait extraction and timing reference
 *
 * ARCHITECTURE NOTE:
 * - This module provides year-pillar-based element estimation only.
 * - Full 4-pillar chart (사주팔자) accuracy requires: birth date + time +
 *   real manse calendar (만세력) lookup. That engine is NOT yet connected.
 * - Placeholder comments mark where the real manse calculation should be wired in.
 * - All outputs are framed as "참고 추정치" (reference estimates), not deterministic results.
 */

import type {
  FormData,
  ElementProfile,
  SajuTraitEstimate,
  LuckCycle,
  YearLuck,
  CareerYearSignal,
  SajuRelationType,
  SajuUrgency,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const HEAVENLY_STEMS_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const EARTHLY_BRANCHES_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// Heavenly stem (천간) → five element
const STEM_ELEMENT: Record<number, keyof ElementProfile> = {
  0: 'wood',   // 갑(甲) — yang wood
  1: 'wood',   // 을(乙) — yin wood
  2: 'fire',   // 병(丙) — yang fire
  3: 'fire',   // 정(丁) — yin fire
  4: 'earth',  // 무(戊) — yang earth
  5: 'earth',  // 기(己) — yin earth
  6: 'metal',  // 경(庚) — yang metal
  7: 'metal',  // 신(辛) — yin metal
  8: 'water',  // 임(壬) — yang water
  9: 'water',  // 계(癸) — yin water
};

// Earthly branch (지지) → five element
const BRANCH_ELEMENT: Record<number, keyof ElementProfile> = {
  0:  'water', // 자(子)
  1:  'earth', // 축(丑)
  2:  'wood',  // 인(寅)
  3:  'wood',  // 묘(卯)
  4:  'earth', // 진(辰)
  5:  'fire',  // 사(巳)
  6:  'fire',  // 오(午)
  7:  'earth', // 미(未)
  8:  'metal', // 신(申)
  9:  'metal', // 유(酉)
  10: 'earth', // 술(戌)
  11: 'water', // 해(亥)
};

const ELEMENT_LABELS: Record<keyof ElementProfile, string> = {
  wood:  '목(木)',
  fire:  '화(火)',
  earth: '토(土)',
  metal: '금(金)',
  water: '수(水)',
};

// ─── Index helpers ────────────────────────────────────────────────────────────

function stemIdx(year: number):   number { return ((year - 1900) % 10 + 10) % 10; }
function branchIdx(year: number): number { return ((year - 1900) % 12 + 12) % 12; }

// ─── Element profile (year pillar only) ───────────────────────────────────────

function buildElementProfile(birthYear: number): ElementProfile {
  const stem   = STEM_ELEMENT[stemIdx(birthYear)];
  const branch = BRANCH_ELEMENT[branchIdx(birthYear)];

  const p: ElementProfile = { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 };
  p[stem]   += 40;  // Year heavenly stem: strongest year-pillar influence
  p[branch] += 25;  // Year earthly branch: secondary year-pillar influence

  // TODO: Add month pillar (월주) — requires solar term (절기) from manse calendar
  // TODO: Add day pillar (일주) — requires full manse calendar table lookup
  // TODO: Add hour pillar (시주) — requires birth hour + branch derivation

  return p;
}

// ─── Trait estimation ─────────────────────────────────────────────────────────

export function estimateTraitsFromSaju(birthYear: number): SajuTraitEstimate {
  const p = buildElementProfile(birthYear);
  const total = p.wood + p.fire + p.earth + p.metal + p.water;

  const w  = p.wood  / total;
  const f  = p.fire  / total;
  const e  = p.earth / total;
  const m  = p.metal / total;
  const wa = p.water / total;

  // Element → career trait mapping (참고 추정치)
  const explorationTendency   = clamp100(w * 50 + f * 30 + wa * 20);
  const planningTendency      = clamp100(e * 50 + m * 40 + wa * 10);
  const riskTolerance         = clamp100(f * 50 + w * 30 + (1 - e) * 20);
  const autonomyDrive         = clamp100(w * 40 + f * 35 + wa * 25);
  const learningDrive         = clamp100(m * 40 + wa * 35 + w * 25);
  const organizationFit       = clamp100(e * 45 + m * 40 + wa * 15);
  const entrepreneurialDrive  = clamp100(f * 45 + w * 35 + (1 - e) * 20);
  const stabilityNeed         = clamp100(e * 50 + m * 30 + wa * 20);

  const entries = Object.entries(p) as [keyof ElementProfile, number][];
  const sorted  = entries.sort((a, b) => b[1] - a[1]);
  const dominant  = sorted[0][0];
  const secondary = sorted[1][0];

  return {
    explorationTendency,
    planningTendency,
    riskTolerance,
    autonomyDrive,
    learningDrive,
    organizationFit,
    entrepreneurialDrive,
    stabilityNeed,
    dominantElement: ELEMENT_LABELS[dominant],
    traitStory: generateSajuTraitStory(dominant, secondary),
    confidence: 'estimated',
  };
}

function clamp100(v: number): number { return Math.round(Math.max(0, Math.min(100, v))); }

export function generateSajuTraitStory(
  dominant: keyof ElementProfile,
  secondary: keyof ElementProfile,
): string {
  const primary: Record<keyof ElementProfile, string> = {
    wood:  '성장 지향적인 기질로, 새로운 환경과 기회를 탐색하는 에너지가 강한 경향이 있습니다. 변화를 통해 확장하려는 성향이 있습니다.',
    fire:  '열정과 표현력이 강한 기질로, 사람과의 연결과 새로운 도전에서 동기를 얻는 경향이 있습니다. 목표가 생기면 빠르게 움직이는 성향입니다.',
    earth: '안정성을 중시하는 기질로, 체계적인 계획과 신뢰할 수 있는 환경을 선호하는 경향이 있습니다. 장기적으로 착실히 쌓아가는 스타일입니다.',
    metal: '원칙과 정밀함을 중시하는 기질로, 전문성을 깊이 있게 발전시키는 성향이 있습니다. 구조와 기준이 명확할 때 최고의 성과를 내는 경향입니다.',
    water: '유연하고 통찰력 있는 기질로, 상황을 빠르게 파악하고 적응하는 능력이 있습니다. 리스크를 직관적으로 감지하는 경향이 강합니다.',
  };

  const secondaryMap: Record<keyof ElementProfile, string> = {
    wood:  '탐색과 성장에 대한 욕구',
    fire:  '표현과 도전에 대한 에너지',
    earth: '안정과 지속성에 대한 선호',
    metal: '전문성과 정밀함에 대한 지향',
    water: '적응력과 신중함에 대한 감각',
  };

  return `${primary[dominant]} 보조 기질로는 ${secondaryMap[secondary]}가 함께 나타나는 경향이 있습니다.`;
}

// ─── Saju timing (year-pillar relation — full 대운/세운 not yet connected) ─────

const TRINE_GROUPS = [[2, 6, 10], [5, 9, 1], [8, 0, 4], [11, 3, 7]];

function getSajuRelation(birthBranch: number, yearBranch: number): SajuRelationType {
  if (birthBranch === yearBranch) return 'self';
  if ((birthBranch + 6) % 12 === yearBranch) return 'clash';
  for (const g of TRINE_GROUPS) {
    if (g.includes(birthBranch) && g.includes(yearBranch)) return 'harmony';
  }
  return 'neutral';
}

function relationLabel(r: SajuRelationType): string {
  switch (r) {
    case 'self':    return '본명년 (12년 전환점)';
    case 'clash':   return '충(충돌)의 해';
    case 'harmony': return '삼합 조화';
    case 'neutral': return '중립';
  }
}

function yearSignalText(r: SajuRelationType, isCurrentYear: boolean): string {
  const w = isCurrentYear ? '올해' : '내년';
  switch (r) {
    case 'self':
      return `${w}은 12년 주기의 전환점으로, 새 사이클 시작에 에너지가 맞아 있습니다. 방향 전환과 실행을 검토하기에 참고할 수 있는 시기입니다.`;
    case 'clash':
      return `${w}은 변화 압력이 강한 시기입니다. 주도적으로 움직이면 이 에너지를 전환의 동력으로 활용할 수 있습니다.`;
    case 'harmony':
      return `${w}은 확장 에너지가 안정적인 시기입니다. 새 환경 진입이나 성장 투자에 참고할 수 있습니다.`;
    case 'neutral':
      return `${w}은 특별한 흐름 신호 없이 중립적입니다. 준비도가 타이밍보다 더 중요한 시기입니다.`;
  }
}

function urgencyFromRelation(r: SajuRelationType): SajuUrgency {
  return r !== 'neutral' ? 'now' : 'wait';
}

function formatYearName(year: number): string {
  return `${HEAVENLY_STEMS_KR[stemIdx(year)]}${EARTHLY_BRANCHES_KR[branchIdx(year)]}년`;
}

/**
 * Generate CareerYearSignal from form data.
 * Currently uses year-pillar relation only.
 * TODO: Connect real manse calendar for month/day pillar accuracy and 대운 cycle.
 */
export function generateCareerYearSummary(form: FormData): CareerYearSignal {
  const birthYearNum = parseInt(form.timing.birthYear, 10);
  const currentYear  = new Date().getFullYear();
  const nextYear     = currentYear + 1;

  const emptyYear = (y: number): YearLuck => ({
    year: y,
    yearName: '',
    relation: 'neutral',
    relationLabel: '',
    careerSignal: '',
    urgency: 'wait',
  });

  if (!form.timing.birthYear || isNaN(birthYearNum) || birthYearNum < 1930 || birthYearNum > 2010) {
    return {
      available: false,
      currentYear: emptyYear(currentYear),
      nextYear: emptyYear(nextYear),
      timingConclusion: '생년을 입력하면 흐름 참고 분석이 추가됩니다.',
      urgency: 'wait',
    };
  }

  const birthBranch = branchIdx(birthYearNum);
  const curRel      = getSajuRelation(birthBranch, branchIdx(currentYear));
  const nxtRel      = getSajuRelation(birthBranch, branchIdx(nextYear));
  const isFav       = (r: SajuRelationType) => r !== 'neutral';

  const urgency: SajuUrgency =
    isFav(curRel) ? 'now' : isFav(nxtRel) ? 'soon' : 'wait';

  const conclusion =
    isFav(curRel) && isFav(nxtRel)
      ? '올해와 내년 모두 변화 에너지를 지지하는 흐름입니다. 데이터 기반 판단과 함께 참고할 수 있습니다.'
      : isFav(curRel)
        ? `올해(${relationLabel(curRel)}) 흐름이 변화 에너지와 맞습니다. 참고할 수 있습니다.`
        : isFav(nxtRel)
          ? `내년(${relationLabel(nxtRel)})이 더 유리한 흐름입니다. 올해는 준비에 집중하는 것이 적합할 수 있습니다.`
          : '올해와 내년 모두 강한 흐름 신호는 없습니다. 데이터 기반 판단을 우선하세요.';

  return {
    available: true,
    currentYear: {
      year: currentYear,
      yearName: formatYearName(currentYear),
      relation: curRel,
      relationLabel: relationLabel(curRel),
      careerSignal: yearSignalText(curRel, true),
      urgency: urgencyFromRelation(curRel),
    },
    nextYear: {
      year: nextYear,
      yearName: formatYearName(nextYear),
      relation: nxtRel,
      relationLabel: relationLabel(nxtRel),
      careerSignal: yearSignalText(nxtRel, false),
      urgency: urgencyFromRelation(nxtRel),
    },
    timingConclusion: conclusion,
    urgency,
  };
}

/**
 * Convert a LuckCycle to a career signal string.
 * TODO: Requires real manse 대운(大運) cycle calculation.
 */
export function convertLuckToCareerSignal(_luckCycle: LuckCycle): string {
  // TODO: Map luckCycle.element and relation to bestKey career signal
  // This requires the 일간(day stem) which needs full manse calendar.
  return '대운 계산 기능 연결 후 활성화됩니다.';
}

/**
 * Compare data-based timing with saju timing and return a combined narrative.
 * TODO: Deeper integration once full manse calendar is connected.
 */
export function compareCareerTiming(
  dataSignal: string,
  _sajuConclusion: string,
): string {
  return dataSignal;
}
