// Career Compass 2.0 — Live Insight text (UI-layer template, deterministic, no LLM).
// Describes the user's current *leaning in plain language* — deliberately NOT a
// personality type name (avoids the MBTI-quiz feel). Tone is soft and provisional
// ("지금까지 보면 …"), never a fixed verdict or fortune-telling.

import type { CareerVectorKey } from '../../types/careerCompass.ts';
import type { FlowResponses } from './session';
import { buildPartialVector } from './session';

const LEANING: Record<CareerVectorKey, string> = {
  expertise: '전문성을 더 깊게 다지는 쪽',
  autonomy: '내 방식대로 일을 꾸리는 쪽',
  marketOrientation: '시장과 연결되는 쪽',
  creativity: '콘텐츠로 풀어내는 쪽',
  analysisOrientation: '분석하고 해석하는 쪽',
  ventureOrientation: '직접 판을 만드는 쪽',
  executionDrive: '실행으로 밀어붙이는 쪽',
  impactOrientation: '영향력을 넓히는 쪽',
  stability: '안정적으로 다지는 쪽',
  recoveryNeed: '잠시 재정비가 필요한 상태',
  riskTolerance: '도전을 감수하는 쪽',
  financialReadiness: '현실 여건을 함께 챙기는 쪽',
  marketValidationNeed: '시장 반응을 먼저 확인하려는 쪽',
};

const VECTOR_KEYS = Object.keys(LEANING) as CareerVectorKey[];

export function buildLiveInsight(responses: FlowResponses): string {
  const v = buildPartialVector(responses);
  let topKey: CareerVectorKey | null = null;
  let topVal = 0;
  for (const k of VECTOR_KEYS) {
    if (v[k] > topVal) { topVal = v[k]; topKey = k; }
  }
  if (!topKey || topVal <= 0) {
    return '아직 초반이라 방향을 모으는 중이에요. 편하게 골라주세요.';
  }
  if (topKey === 'recoveryNeed') {
    return '지금까지 보면 잠시 재정비가 필요하다는 신호가 보여요. 큰 결정보다 회복을 먼저 봐도 괜찮아요.';
  }
  return `지금까지 보면 ${LEANING[topKey]}에 무게가 실려요. 계속 골라주시면 더 또렷해집니다.`;
}
