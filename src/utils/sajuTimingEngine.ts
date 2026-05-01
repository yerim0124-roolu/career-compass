/**
 * sajuTimingEngine.ts — Derive career timing signals from a ManseChart.
 *
 * Only outputs timing when chart.status === "calculated".
 * Does NOT output timing from year-only or zodiac-based data.
 *
 * Timing is always secondary to state-based assessment (burnout, runway, etc.).
 */

import type { ManseChart, YearLuckSignal } from './manseEngine';
import type { StateTimingLevel } from '../types';

export interface CareerTimingResult {
  status: 'calculated' | 'unavailable';
  currentYear: YearLuckSignal | null;
  nextYear: YearLuckSignal | null;
  recommendation: string;
  alignmentWithState: 'aligned' | 'neutral' | 'conflicted' | 'unavailable';
}

/**
 * Derive career timing signals from a ManseChart.
 *
 * Compares year luck signals to identify:
 * - Job change timing
 * - Startup/independent timing
 * - Learning/preparation timing
 * - Rest/recovery timing
 */
export function deriveCareerTimingFromLuck(
  chart: ManseChart,
  stateTimingLevel?: StateTimingLevel,
): CareerTimingResult {
  const unavailable: CareerTimingResult = {
    status: 'unavailable',
    currentYear: null,
    nextYear: null,
    recommendation:
      '현재는 상태 기반 타이밍만 표시됩니다. ' +
      '행동 흐름 분석이 연결되면 장기·연간 타이밍 참고 지표도 확인할 수 있습니다.',
    alignmentWithState: 'unavailable',
  };

  if (chart.status === 'failed') return unavailable;
  if (!chart.currentYearLuck) return unavailable;

  const cur = chart.currentYearLuck;
  const nxt = chart.nextYearLuck ?? null;

  // Determine alignment with current state timing
  let alignmentWithState: CareerTimingResult['alignmentWithState'] = 'neutral';
  if (stateTimingLevel) {
    const curExpansion = cur.expansion;
    if (stateTimingLevel === '실행 가능' && curExpansion >= 60) {
      alignmentWithState = 'aligned';
    } else if (stateTimingLevel === '회복 우선' && cur.rest >= 60) {
      alignmentWithState = 'aligned';
    } else if (stateTimingLevel === '실행 가능' && cur.rest >= 70) {
      alignmentWithState = 'conflicted'; // state says go, luck says rest
    } else if (stateTimingLevel === '회복 우선' && curExpansion >= 70) {
      alignmentWithState = 'conflicted'; // state says recover, luck says expand
    } else {
      alignmentWithState = 'neutral';
    }
  }

  // Build recommendation text
  const dominant = dominantSignal(cur);
  const nextDominant = nxt ? dominantSignal(nxt) : null;

  let recommendation = '';
  if (dominant === 'expansion') {
    recommendation = nxt && nextDominant === 'expansion'
      ? `올해와 내년 모두 새로운 시도를 시작하기에 기회가 열리는 흐름입니다. 상태 조건이 갖춰진다면 이직·전환 실행에 유리한 시기입니다.`
      : `올해는 새로운 시도를 시작하기에 기회가 열리는 흐름입니다. 내년은 다른 방향으로 전환되므로 올해 안에 움직임을 시작하는 것이 유리합니다.`;
  } else if (dominant === 'change') {
    recommendation = `올해는 변화를 위한 압력이 높은 흐름입니다. 주도적으로 움직이면 이 흐름을 전환의 동력으로 활용할 수 있습니다.`;
  } else if (dominant === 'stability') {
    recommendation = `올해는 기반을 다지기에 유리한 흐름입니다. 큰 전환보다 역량 축적과 기반 강화가 더 잘 맞는 시기입니다.`;
  } else if (dominant === 'learning') {
    recommendation = `올해는 학습과 전문성 강화에 에너지가 모이는 흐름입니다. 준비를 탄탄히 하기에 좋은 시기입니다.`;
  } else if (dominant === 'rest') {
    recommendation = `올해는 회복과 재정비에 에너지가 맞는 흐름입니다. 무리한 전진보다 내실을 다지는 방향이 유리합니다.`;
  } else {
    recommendation = `올해는 특별히 강한 흐름 신호가 없습니다. 상태 기반 판단을 우선하세요.`;
  }

  return {
    status: 'calculated',
    currentYear: cur,
    nextYear: nxt,
    recommendation,
    alignmentWithState,
  };
}

function dominantSignal(signal: YearLuckSignal): string {
  const scores: Record<string, number> = {
    expansion: signal.expansion,
    stability: signal.stability,
    change:    signal.change,
    promotion: signal.promotion,
    learning:  signal.learning,
    rest:      signal.rest,
  };
  return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/**
 * Text copy for the "saju timing unavailable" state in Step 5.
 * Used when status !== "calculated".
 */
export const MANSE_TIMING_UNAVAILABLE_COPY =
  '현재는 상태 기반 타이밍만 표시됩니다.\n' +
  '행동 흐름 분석이 연결되면 장기·연간 타이밍 참고 지표도 확인할 수 있습니다.';
