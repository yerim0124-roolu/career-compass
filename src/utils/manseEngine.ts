/**
 * manseEngine.ts — BaZi / Four Pillars (四柱八字) calculation.
 *
 * Adapter: lunar-typescript (pure JS/TS, browser-compatible, zero native deps).
 *
 * Provides:
 *   - Four pillars (year/month/day/hour) with Heavenly Stem + Earthly Branch
 *   - WuXing (五行) element mapping
 *   - ShiShen (十神) ten-god profile
 *   - DaYun (大運) current period
 *   - Year luck signals (current + next year)
 *
 * User-facing copy must remain neutral — no raw 간지, no zodiac labels, no "운명".
 */

import { Solar, Lunar } from 'lunar-typescript';

export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type YinYang = 'yin' | 'yang';

export type TenGod =
  | '비견' | '겁재'   // self — autonomy, independent decision
  | '식신' | '상관'   // output — expression, creativity, content/product
  | '편재' | '정재'   // wealth — monetization, business, customer value
  | '편관' | '정관'   // power — organization, responsibility, promotion
  | '편인' | '정인';  // resource — learning, research, expertise, preparation

export interface ManseInput {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthTime?: string;                     // "HH:MM" 24h, local solar time preferred
  calendarType: 'solar' | 'lunar';
  gender?: 'male' | 'female' | 'unknown'; // needed for daewoon direction
  timezone?: string;
}

export interface Pillar {
  stem: string;           // Heavenly Stem character, e.g. "甲"
  branch: string;         // Earthly Branch character, e.g. "子"
  stemElement: FiveElement;
  branchElement: FiveElement;
  tenGod?: string;        // ten god relative to day master (empty for day pillar)
}

export interface ManseChart {
  status: 'calculated' | 'partial' | 'failed';
  fourPillars?: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour?: Pillar;
  };
  dayMaster?: {
    stem: string;
    element: FiveElement;
    yinYang: YinYang;
  };
  elementProfile?: Record<FiveElement, number>; // 0–100 relative strength
  tenGodProfile?: Partial<Record<TenGod, number>>;
  currentYearLuck?: YearLuckSignal;
  nextYearLuck?: YearLuckSignal;
  daewoon?: DaewoonSignal | null;
  warnings: string[];
}

export interface YearLuckSignal {
  year: number;
  pillarName: string;     // internal identifier, not shown to user
  expansion: number;      // 0–100: new opportunity energy
  stability: number;      // 0–100: foundation / consolidation energy
  change: number;         // 0–100: pressure / transformation energy
  promotion: number;      // 0–100: authority / recognition energy
  learning: number;       // 0–100: resource / knowledge energy
  rest: number;           // 0–100: withdrawal / recovery energy
  summary: string;        // 1–2 sentence career timing summary (neutral language)
}

export interface DaewoonSignal {
  pillarName: string;
  startAge?: number;
  endAge?: number;
  expansion: number;
  stability: number;
  change: number;
  careerDirection: string;
  summary: string;
}

// ─── Element and stem/branch tables ──────────────────────────────────────────

const WUXING_TO_ELEMENT: Record<string, FiveElement> = {
  '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water',
};

const STEM_YIN_YANG: Record<string, YinYang> = {
  '甲': 'yang', '乙': 'yin',  '丙': 'yang', '丁': 'yin',  '戊': 'yang',
  '己': 'yin',  '庚': 'yang', '辛': 'yin',  '壬': 'yang', '癸': 'yin',
};

// Heavenly Stem → WuXing character (for DaYun stem element resolution)
const STEM_ELEMENT_MAP: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
};

// 七杀 is an alternate name for 偏官 (same ten god)
const SHISHEN_TO_TENGOD: Record<string, TenGod> = {
  '比肩': '비견', '劫财': '겁재',
  '食神': '식신', '伤官': '상관',
  '偏财': '편재', '正财': '정재',
  '偏官': '편관', '七杀': '편관',
  '正官': '정관',
  '偏印': '편인', '正印': '정인',
};

// Generation (상생) and control (상극) cycles
const GENERATES: Record<FiveElement, FiveElement> = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};
const CONTROLS: Record<FiveElement, FiveElement> = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

// ─── Ten god computation ──────────────────────────────────────────────────────

function computeTenGod(
  dayEl: FiveElement, dayYY: YinYang,
  targetEl: FiveElement, targetYY: YinYang,
): TenGod {
  const same = dayYY === targetYY;
  if (targetEl === dayEl)            return same ? '비견' : '겁재';
  if (GENERATES[dayEl] === targetEl) return same ? '식신' : '상관';
  if (CONTROLS[dayEl] === targetEl)  return same ? '편재' : '정재';
  if (GENERATES[targetEl] === dayEl) return same ? '편인' : '정인';
  if (CONTROLS[targetEl] === dayEl)  return same ? '편관' : '정관';
  return '비견';
}

// ─── Year luck signal scoring ─────────────────────────────────────────────────

type LuckScores = { expansion: number; stability: number; change: number; promotion: number; learning: number; rest: number };

const TEN_GOD_LUCK: Record<TenGod, LuckScores> = {
  '비견': { expansion: 75, stability: 40, change: 35, promotion: 30, learning: 25, rest: 20 },
  '겁재': { expansion: 65, stability: 25, change: 55, promotion: 35, learning: 20, rest: 25 },
  '식신': { expansion: 65, stability: 50, change: 25, promotion: 30, learning: 30, rest: 25 },
  '상관': { expansion: 55, stability: 25, change: 65, promotion: 20, learning: 25, rest: 30 },
  '편재': { expansion: 65, stability: 45, change: 35, promotion: 45, learning: 20, rest: 20 },
  '정재': { expansion: 30, stability: 75, change: 20, promotion: 35, learning: 25, rest: 35 },
  '편관': { expansion: 20, stability: 20, change: 75, promotion: 65, learning: 25, rest: 35 },
  '정관': { expansion: 35, stability: 55, change: 40, promotion: 75, learning: 30, rest: 25 },
  '편인': { expansion: 30, stability: 45, change: 30, promotion: 20, learning: 75, rest: 55 },
  '정인': { expansion: 30, stability: 60, change: 20, promotion: 30, learning: 80, rest: 50 },
};

const ELEMENT_CAREER_DIRECTION: Record<FiveElement, string> = {
  wood:  '성장과 확장이 중심인 시기입니다. 새로운 방향 탐색과 역할 전환에 에너지가 맞습니다.',
  fire:  '표현력과 실행 에너지가 강한 시기입니다. 가시적인 성과를 만들고 연결을 확장하는 데 유리합니다.',
  earth: '기반을 다지고 안정을 강화하는 시기입니다. 신뢰를 쌓고 장기적으로 축적하는 방향이 잘 맞습니다.',
  metal: '전문성을 심화하고 체계를 재편하는 시기입니다. 역량을 정제하고 기준을 높이는 방향이 유리합니다.',
  water: '성찰과 재정비, 다음 방향을 설계하는 시기입니다. 준비와 학습에 에너지를 모으는 방향이 맞습니다.',
};

function dominantKey(s: LuckScores): keyof LuckScores {
  return (Object.entries(s) as [keyof LuckScores, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

const DOMINANT_SUMMARY: Record<string, string> = {
  expansion: '새로운 시도와 방향 전환을 검토하기에 기회가 열리는 흐름입니다.',
  stability: '기반을 다지고 안정적으로 축적하기에 좋은 흐름입니다.',
  change:    '변화와 전환 압력이 강한 흐름입니다. 주도적으로 방향을 잡으면 에너지를 활용할 수 있습니다.',
  promotion: '인정과 역할 확장에 에너지가 맞는 흐름입니다.',
  learning:  '준비와 역량 축적에 에너지가 모이는 흐름입니다.',
  rest:      '회복과 재정비에 에너지가 맞는 흐름입니다.',
};

function computeYearLuck(
  yearGan: string, yearZhi: string,
  yearGanEl: FiveElement, yearZhiEl: FiveElement,
  dayMasterEl: FiveElement, dayMasterYY: YinYang,
  targetYear: number,
): YearLuckSignal {
  const yearGanYY = STEM_YIN_YANG[yearGan] ?? 'yang';
  const ganTenGod  = computeTenGod(dayMasterEl, dayMasterYY, yearGanEl, yearGanYY);
  const zhiTenGod  = computeTenGod(dayMasterEl, dayMasterYY, yearZhiEl, yearGanYY);

  // Weight: stem (60%) + branch (40%)
  const ganS  = TEN_GOD_LUCK[ganTenGod];
  const zhiS  = TEN_GOD_LUCK[zhiTenGod];
  const blend = (k: keyof LuckScores) => Math.round(ganS[k] * 0.6 + zhiS[k] * 0.4);

  const scores: LuckScores = {
    expansion: blend('expansion'),
    stability: blend('stability'),
    change:    blend('change'),
    promotion: blend('promotion'),
    learning:  blend('learning'),
    rest:      blend('rest'),
  };

  return {
    year: targetYear,
    pillarName: `${yearGan}${yearZhi}`,
    ...scores,
    summary: DOMINANT_SUMMARY[dominantKey(scores)],
  };
}

// ─── Element profile ──────────────────────────────────────────────────────────

function buildElementProfile(elements: FiveElement[]): Record<FiveElement, number> {
  const counts: Record<FiveElement, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const e of elements) counts[e]++;
  const total = elements.length || 1;
  return {
    wood:  Math.round((counts.wood  / total) * 100),
    fire:  Math.round((counts.fire  / total) * 100),
    earth: Math.round((counts.earth / total) * 100),
    metal: Math.round((counts.metal / total) * 100),
    water: Math.round((counts.water / total) * 100),
  };
}

// ─── Ten god profile ──────────────────────────────────────────────────────────

function buildTenGodProfile(
  shiShenList: string[],
): Partial<Record<TenGod, number>> {
  const profile: Partial<Record<TenGod, number>> = {};
  for (const s of shiShenList) {
    if (s === '日主') continue; // day master self — not counted
    const tg = SHISHEN_TO_TENGOD[s];
    if (tg) profile[tg] = Math.min(100, (profile[tg] ?? 0) + 20);
  }
  return profile;
}

// ─── Core calculation (synchronous — lunar-typescript is sync) ────────────────

function runCalculation(input: ManseInput): ManseChart {
  const year  = parseInt(input.birthYear,  10);
  const month = parseInt(input.birthMonth, 10);
  const day   = parseInt(input.birthDay,   10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { status: 'failed', warnings: ['생년월일 숫자 변환에 실패했습니다.'] };
  }

  let hour = 12, minute = 0;
  const hasTime = !!input.birthTime;
  if (hasTime) {
    const [h, m] = input.birthTime!.split(':').map(Number);
    hour   = isNaN(h) ? 12 : h;
    minute = isNaN(m) ? 0  : m;
  }

  // Build solar date (convert lunar if needed)
  let solar: ReturnType<typeof Solar.fromYmdHms>;
  try {
    if (input.calendarType === 'lunar') {
      const lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0);
      const s = lunar.getSolar();
      solar = Solar.fromYmdHms(s.getYear(), s.getMonth(), s.getDay(), hour, minute, 0);
    } else {
      solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    }
  } catch {
    return { status: 'failed', warnings: ['날짜 변환 중 오류가 발생했습니다. 날짜를 확인해 주세요.'] };
  }

  let ec: ReturnType<typeof solar.getLunar>['getEightChar'] extends () => infer R ? R : never;
  try {
    ec = solar.getLunar().getEightChar();
  } catch {
    return { status: 'failed', warnings: ['사주 계산 중 오류가 발생했습니다.'] };
  }

  // ── Extract Gan (stem) and Zhi (branch) ────────────────────────────────────
  const yGan = ec.getYearGan(),  yZhi = ec.getYearZhi();
  const mGan = ec.getMonthGan(), mZhi = ec.getMonthZhi();
  const dGan = ec.getDayGan(),   dZhi = ec.getDayZhi();
  const tGan = ec.getTimeGan(),  tZhi = ec.getTimeZhi();

  // ── Parse WuXing (五行) — 2-char string: stem+branch ──────────────────────
  const wx = (s: string) => WUXING_TO_ELEMENT[s[0]] ?? 'earth';
  const yWx = ec.getYearWuXing(),  mWx = ec.getMonthWuXing();
  const dWx = ec.getDayWuXing(),   tWx = ec.getTimeWuXing();

  const yGanEl = wx(yWx), yZhiEl = wx(yWx[1] ?? '土');
  const mGanEl = wx(mWx), mZhiEl = wx(mWx[1] ?? '土');
  const dGanEl = wx(dWx), dZhiEl = wx(dWx[1] ?? '土');
  const tGanEl = wx(tWx), tZhiEl = wx(tWx[1] ?? '土');

  // ── Day master ────────────────────────────────────────────────────────────
  const dayMasterYY = STEM_YIN_YANG[dGan] ?? 'yang';
  const dayMaster = { stem: dGan, element: dGanEl, yinYang: dayMasterYY };

  // ── Ten god profile ───────────────────────────────────────────────────────
  const allShiShen: string[] = [
    ec.getYearShiShenGan(),
    ec.getMonthShiShenGan(),
    ec.getDayShiShenGan(),   // '日主' — filtered out inside buildTenGodProfile
    ...(hasTime ? [ec.getTimeShiShenGan()] : []),
    ...ec.getYearShiShenZhi(),
    ...ec.getMonthShiShenZhi(),
    ...ec.getDayShiShenZhi(),
    ...(hasTime ? ec.getTimeShiShenZhi() : []),
  ];
  const tenGodProfile = buildTenGodProfile(allShiShen);

  // ── Element profile ───────────────────────────────────────────────────────
  const visibleElements: FiveElement[] = [
    yGanEl, yZhiEl, mGanEl, mZhiEl, dGanEl, dZhiEl,
    ...(hasTime ? [tGanEl, tZhiEl] : []),
  ];
  const elementProfile = buildElementProfile(visibleElements);

  // ── Four pillars ──────────────────────────────────────────────────────────
  const fourPillars = {
    year:  { stem: yGan, branch: yZhi, stemElement: yGanEl, branchElement: yZhiEl, tenGod: ec.getYearShiShenGan() },
    month: { stem: mGan, branch: mZhi, stemElement: mGanEl, branchElement: mZhiEl, tenGod: ec.getMonthShiShenGan() },
    day:   { stem: dGan, branch: dZhi, stemElement: dGanEl, branchElement: dZhiEl },
    ...(hasTime ? {
      hour: { stem: tGan, branch: tZhi, stemElement: tGanEl, branchElement: tZhiEl, tenGod: ec.getTimeShiShenGan() },
    } : {}),
  };

  // ── Year luck (current + next) ────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const nextYear    = currentYear + 1;

  let currentYearLuck: YearLuckSignal | undefined;
  let nextYearLuck: YearLuckSignal | undefined;
  try {
    const curEc  = Solar.fromYmd(currentYear, 6, 1).getLunar().getEightChar();
    const nextEc = Solar.fromYmd(nextYear,    6, 1).getLunar().getEightChar();
    currentYearLuck = computeYearLuck(
      curEc.getYearGan(), curEc.getYearZhi(),
      wx(curEc.getYearWuXing()), wx(curEc.getYearWuXing()[1] ?? '土'),
      dGanEl, dayMasterYY, currentYear,
    );
    nextYearLuck = computeYearLuck(
      nextEc.getYearGan(), nextEc.getYearZhi(),
      wx(nextEc.getYearWuXing()), wx(nextEc.getYearWuXing()[1] ?? '土'),
      dGanEl, dayMasterYY, nextYear,
    );
  } catch {
    // Year luck is optional — not a hard failure
  }

  // ── DaYun (大運) current period ───────────────────────────────────────────
  let daewoon: DaewoonSignal | null = null;
  const warnings: string[] = [];
  try {
    const genderNum = input.gender === 'female' ? 0 : 1;
    const yun = ec.getYun(genderNum);
    const daYuns = yun.getDaYun();
    const current = daYuns.find(d => d.getStartYear() <= currentYear && d.getEndYear() >= currentYear);
    if (current && current.getGanZhi()) {
      const dyGanZhi = current.getGanZhi();
      const dyGan = dyGanZhi[0];
      const dyEl  = WUXING_TO_ELEMENT[STEM_ELEMENT_MAP[dyGan] ?? '土'] ?? 'earth';
      const dyYY  = STEM_YIN_YANG[dyGan] ?? 'yang';
      const dyTenGod = computeTenGod(dGanEl, dayMasterYY, dyEl, dyYY);
      const dyScores = TEN_GOD_LUCK[dyTenGod];
      daewoon = {
        pillarName:    dyGanZhi,
        startAge:      current.getStartAge(),
        endAge:        current.getEndAge(),
        expansion:     dyScores.expansion,
        stability:     dyScores.stability,
        change:        dyScores.change,
        careerDirection: ELEMENT_CAREER_DIRECTION[dyEl],
        summary: DOMINANT_SUMMARY[dominantKey(dyScores)],
      };
    }
  } catch {
    warnings.push('대운 계산 중 오류가 발생했습니다.');
  }

  return {
    status: hasTime ? 'calculated' : 'partial',
    fourPillars,
    dayMaster,
    elementProfile,
    tenGodProfile,
    currentYearLuck,
    nextYearLuck,
    daewoon,
    warnings,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function calculateManseChart(input: ManseInput): Promise<ManseChart> {
  if (!input.birthYear || !input.birthMonth || !input.birthDay) {
    return { status: 'failed', warnings: ['생년월일이 불완전합니다.'] };
  }
  try {
    return runCalculation(input);
  } catch (e) {
    console.warn('[ManseEngine] calculation error:', e);
    return { status: 'failed', warnings: ['계산 중 예기치 않은 오류가 발생했습니다.'] };
  }
}

export function calculateManseChartSync(input: ManseInput): ManseChart {
  if (!input.birthYear || !input.birthMonth || !input.birthDay) {
    return { status: 'failed', warnings: ['생년월일이 불완전합니다.'] };
  }
  try {
    return runCalculation(input);
  } catch (e) {
    console.warn('[ManseEngine] calculation error:', e);
    return { status: 'failed', warnings: ['계산 중 예기치 않은 오류가 발생했습니다.'] };
  }
}
