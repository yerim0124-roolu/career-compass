/**
 * sajuPersona.ts — MVP Saju personality layer
 *
 * Year-pillar-only element estimation → structured persona copy.
 * NOT a full 사주팔자 reading. Clearly labeled as estimated.
 */

import type { FormData, SajuTraitEstimate, SajuPersonaMVP, SajuElementKey } from '../types';

const DISCLAIMER =
  '연주(年柱) 기반 간이 추정 — 생년(年)의 천간·지지를 기반으로 한 참고 추정치입니다. ' +
  '실제 사주팔자(四柱八字) 분석은 생년월일시 모두와 만세력 계산이 필요합니다.';

// ─── Element key reverse-mapping ─────────────────────────────────────────────
// saju.ts returns dominantElement as Korean label e.g. "목(木)"

const KOREAN_TO_KEY: Record<string, SajuElementKey> = {
  '목(木)': 'wood',
  '화(火)': 'fire',
  '토(土)': 'earth',
  '금(金)': 'metal',
  '수(水)': 'water',
};

function getDominantElementKey(koreanLabel: string): SajuElementKey {
  return KOREAN_TO_KEY[koreanLabel] ?? 'balanced';
}

// ─── Element persona copy ─────────────────────────────────────────────────────

const CORE_TEMPERAMENT: Record<SajuElementKey, string> = {
  wood:     '성장 지향적이고 탐색을 즐기는 기질입니다. 새로운 환경과 기회에 에너지를 얻으며, 변화 속에서 확장하려는 경향이 강합니다.',
  fire:     '열정적이고 표현력이 강한 기질입니다. 사람과의 연결과 도전 과제에서 동기를 얻으며, 목표가 생기면 빠르게 행동하는 성향입니다.',
  earth:    '안정성을 중시하고 체계적인 기질입니다. 신뢰할 수 있는 환경과 구체적인 계획 안에서 최고의 성과를 내는 경향이 있습니다.',
  metal:    '원칙과 정밀함을 중시하는 기질입니다. 전문성을 깊이 쌓는 데 집중하며, 기준이 명확할 때 가장 잘 작동하는 유형입니다.',
  water:    '유연하고 통찰력 있는 기질입니다. 상황을 직관적으로 파악하고 빠르게 적응하며, 리스크를 감지하는 감각이 뛰어납니다.',
  balanced: '특정 기운이 두드러지지 않는 균형형 기질입니다. 상황에 따라 유연하게 전략을 바꿀 수 있는 강점이 있습니다.',
};

const DECISION_PATTERN: Record<SajuElementKey, string> = {
  wood:     '탐색하면서 결정합니다. 여러 옵션을 비교하고 실제로 시도해보면서 방향을 잡는 경향이 있습니다.',
  fire:     '직관으로 결정합니다. 논리보다 열정과 확신이 결정을 이끌며, 빠르게 실행에 옮기는 편입니다.',
  earth:    '계획 후 결정합니다. 충분히 준비되고 안전이 확인된 뒤에 움직이며, 신중하게 기반을 다지는 스타일입니다.',
  metal:    '원칙 기반으로 결정합니다. 데이터와 기준을 근거로 판단하며, 감정보다 논리를 우선시하는 경향이 있습니다.',
  water:    '상황을 읽으면서 결정합니다. 타이밍과 맥락을 중시하며, 리스크가 최소화된 순간을 기다리는 성향이 있습니다.',
  balanced: '상황에 맞게 결정합니다. 특정 패턴에 고착되지 않고 맥락에 따라 전략을 유연하게 조정하는 편입니다.',
};

const STRENGTH_PATTERN: Record<SajuElementKey, string> = {
  wood:     '새로운 가능성을 먼저 보는 능력, 변화 친화적인 태도, 탐색을 통한 성장력.',
  fire:     '사람을 움직이는 설득력, 높은 실행 에너지, 열정이 주변에 전달되는 영향력.',
  earth:    '신뢰를 쌓는 일관성, 장기적 계획 실행력, 안정적인 기반 위에서 작동하는 지속성.',
  metal:    '전문성의 깊이, 높은 기준을 유지하는 자기통제력, 구조화된 문제해결 능력.',
  water:    '상황 파악 속도, 다양한 환경에 적응하는 유연성, 리스크를 미리 감지하는 통찰력.',
  balanced: '어느 한쪽에 치우치지 않는 균형감, 다양한 역할을 소화할 수 있는 범용성.',
};

const VULNERABILITY_PATTERN: Record<SajuElementKey, string> = {
  wood:     '결정을 미루고 계속 탐색하다가 실행 타이밍을 놓칠 수 있습니다.',
  fire:     '단기 열정이 지속성으로 이어지지 않거나, 충동적 결정으로 기반을 흔들 수 있습니다.',
  earth:    '준비가 충분하지 않다고 느껴 변화 시점을 계속 미룰 수 있습니다.',
  metal:    '완벽주의적 기준이 실행을 막거나, 유연성 부족으로 협업에서 마찰이 생길 수 있습니다.',
  water:    '과도한 신중함이 실행을 지연시키거나, 방향 없이 상황에만 반응하는 패턴이 나타날 수 있습니다.',
  balanced: '뚜렷한 강점이 보이지 않아 스스로 방향을 정하기 어렵게 느껴질 수 있습니다.',
};

const CAREER_DIRECTION_HINT: Record<SajuElementKey, string> = {
  wood:     '성장과 탐색이 가능한 환경 — 새로운 도전, 확장 기회, 다양한 경험이 있는 역할이 잘 맞습니다.',
  fire:     '표현과 영향력이 발휘되는 환경 — 사람을 대면하거나, 아이디어를 실현하거나, 빠른 실행이 요구되는 역할이 잘 맞습니다.',
  earth:    '체계와 안정이 있는 환경 — 장기 프로젝트, 신뢰 기반 조직, 단계적 성장이 가능한 역할이 잘 맞습니다.',
  metal:    '전문성과 기준이 인정받는 환경 — 깊이 있는 전문 역할, 품질 중심 조직, 명확한 평가 체계가 있는 곳이 잘 맞습니다.',
  water:    '유연성과 적응이 중시되는 환경 — 변화가 많은 조직, 전략·분석 역할, 리스크 관리가 중요한 포지션이 잘 맞습니다.',
  balanced: '다양한 역할을 실험해보면서 자신의 강점이 가장 발휘되는 환경을 찾아가는 방식이 효과적입니다.',
};

const TIMING_HINT: Record<SajuElementKey, string> = {
  wood:     '목(木) 기운이 강한 해(인년·묘년)나 목 운이 들어오는 시기는 새로운 시작과 도전에 에너지가 실리는 경향이 있습니다.',
  fire:     '화(火) 기운이 강한 해(사년·오년)는 표현과 실행에 에너지가 높아지는 시기입니다. 단, 소진도 빠를 수 있으니 페이스를 확인하세요.',
  earth:    '토(土) 기운이 강한 해(진·술·축·미년)는 기반을 다지고 안정적으로 쌓기에 적합한 시기로 작용하는 경향이 있습니다.',
  metal:    '금(金) 기운이 강한 해(신년·유년)는 전문성 심화와 구조 재편에 집중하기 좋은 시기로 작용하는 경향이 있습니다.',
  water:    '수(水) 기운이 강한 해(자년·해년)는 성찰과 재정비, 다음 방향을 설계하기에 유리한 흐름이 나타나는 경향이 있습니다.',
  balanced: '특정 원소 우세보다는 현재 상태와 목표를 기준으로 타이밍을 판단하는 것이 더 효과적입니다.',
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeSajuPersonaMVP(
  _form: FormData,
  sajuTraitEstimate: SajuTraitEstimate | null,
): SajuPersonaMVP {
  if (!sajuTraitEstimate || sajuTraitEstimate.confidence !== 'estimated') {
    return {
      status: 'notAvailable',
      dominantElement: 'balanced',
      coreTemperament: '',
      decisionPattern: '',
      strengthPattern: '',
      vulnerabilityPattern: '',
      careerDirectionHint: '',
      timingHint: '',
      disclaimer: DISCLAIMER,
    };
  }

  const dominantElement = getDominantElementKey(sajuTraitEstimate.dominantElement);

  return {
    status: 'estimated',
    dominantElement,
    coreTemperament:       CORE_TEMPERAMENT[dominantElement],
    decisionPattern:       DECISION_PATTERN[dominantElement],
    strengthPattern:       STRENGTH_PATTERN[dominantElement],
    vulnerabilityPattern:  VULNERABILITY_PATTERN[dominantElement],
    careerDirectionHint:   CAREER_DIRECTION_HINT[dominantElement],
    timingHint:            TIMING_HINT[dominantElement],
    disclaimer:            DISCLAIMER,
  };
}
