/**
 * sajuFromManse.ts — Convert ManseChart into a SajuBehaviorProfile.
 *
 * Uses day master (일간) as core identity when chart is calculated.
 * Uses dominant element from elementProfile for temperament.
 * Uses tenGodProfile for behavior patterns.
 *
 * Returns status "unavailable" when chart is not calculated.
 * Never uses year-only or zodiac fallback.
 */

import type { ManseChart, FiveElement, TenGod } from './manseEngine';
import type { SajuBehaviorProfile } from './sajuInterpretation';

// ─── Element → behavior (career language, no raw saju terms) ─────────────────

const ELEMENT_TEMPERAMENT: Record<FiveElement, string> = {
  wood:  '새로운 환경과 성장 가능성에서 에너지를 얻는 기질입니다. 확장을 통해 자신을 실현하려는 성향이 자연스럽게 나타납니다.',
  fire:  '표현력과 추진 에너지가 강한 기질입니다. 가시적인 성과와 사람과의 연결에서 동기를 얻습니다.',
  earth: '안정성과 신뢰를 중시하는 기질입니다. 체계적인 기반 위에서 착실히 쌓아가는 방식이 강점입니다.',
  metal: '원칙과 전문성을 중시하는 기질입니다. 기준이 명확할 때 최고의 성과를 냅니다.',
  water: '상황을 읽고 적응하는 통찰형 기질입니다. 맥락과 리스크를 감지하는 감각이 뛰어납니다.',
};

const ELEMENT_DECISION: Record<FiveElement, string> = {
  wood:  '명확한 성장 경로가 보일 때 움직입니다. 탐색하면서 방향을 잡아가는 방식이 자신에게 맞습니다.',
  fire:  '에너지와 확신이 생기면 빠르게 움직입니다. 목표가 생기면 속도가 붙는 타입입니다.',
  earth: '기반이 안전하다는 확신이 생길 때 움직입니다. 충분히 준비된 후 실행하는 방식을 선호합니다.',
  metal: '기준이 명확할 때 움직이고, 기준이 흐릴 때는 보류합니다. 데이터와 논리를 근거로 판단합니다.',
  water: '상황 맥락을 먼저 파악하고 리스크를 줄인 뒤에 움직입니다. 타이밍을 읽고 나서 행동하는 방식입니다.',
};

const ELEMENT_STRENGTH: Record<FiveElement, string> = {
  wood:  '새로운 가능성을 먼저 발견하고 탐색하면서 방향을 잡는 데 강합니다. 변화 친화적인 태도가 강점입니다.',
  fire:  '아이디어를 실행으로 옮기고 사람을 움직이는 데 강합니다. 표현력과 실행력이 주요 강점입니다.',
  earth: '신뢰를 쌓고 장기적으로 지속하는 데 강합니다. 착실하게 축적하는 능력이 강점입니다.',
  metal: '전문 영역을 깊이 파고들고 높은 기준을 유지하는 데 강합니다. 구조화된 문제 해결이 강점입니다.',
  water: '상황을 빠르게 파악하고 리스크를 감지하는 데 강합니다. 다양한 환경에서 적응하는 유연성이 강점입니다.',
};

const ELEMENT_VULNERABILITY: Record<FiveElement, string> = {
  wood:  '여러 일을 동시에 시작하고 마무리하지 못할 수 있습니다. 방향이 많아질수록 집중이 분산됩니다.',
  fire:  '감정 압력 아래에서 충동적으로 결정할 수 있습니다. 열정이 식으면 지속성이 떨어지기도 합니다.',
  earth: '결정을 너무 오래 미루거나 변화 시점을 놓칠 수 있습니다. 준비가 완벽해야 한다는 생각이 실행을 막기도 합니다.',
  metal: '완벽주의가 실행을 막거나, 유연성 부족으로 기회를 놓칠 수 있습니다.',
  water: '완벽한 타이밍을 기다리다 실행이 계속 미뤄질 수 있습니다. 과도한 신중함이 기회 비용을 만들기도 합니다.',
};

const ELEMENT_CAREER_HINT: Record<FiveElement, string> = {
  wood:  '성장 기회가 있는 환경 — 확장 역할, 새로운 도전이 있는 곳이 잘 맞습니다.',
  fire:  '표현과 실행이 요구되는 환경 — 리더십, 영업, 창의 역할이 잘 맞습니다.',
  earth: '체계와 안정이 있는 환경 — 장기 프로젝트, 신뢰 기반 역할이 잘 맞습니다.',
  metal: '전문성과 기준이 인정받는 환경 — 전문직, 품질 중심 역할이 잘 맞습니다.',
  water: '분석과 적응이 중요한 환경 — 전략, 리스크 관리, 컨설팅 역할이 잘 맞습니다.',
};

const ELEMENT_TIMING: Record<FiveElement, string> = {
  wood:  '확장 에너지가 실리는 시기는 새로운 시작과 방향 전환에 유리합니다.',
  fire:  '표현과 실행 에너지가 높은 시기이지만, 소진도 빠를 수 있어 페이스 관리가 중요합니다.',
  earth: '기반을 다지고 안정적으로 쌓기에 적합한 시기입니다.',
  metal: '전문성 심화와 구조 재편에 집중하기 좋은 시기입니다.',
  water: '성찰과 재정비, 다음 방향 설계에 유리한 시기입니다.',
};

// ─── Ten god → career modifier ────────────────────────────────────────────────

const TEN_GOD_CAREER_MODIFIER: Partial<Record<TenGod, string>> = {
  '비견': '자기 주도적으로 방향을 결정하고 독립적으로 움직이는 성향이 강합니다.',
  '겁재': '경쟁적 환경에서 실행력이 높아지고, 도전 의지가 자연스럽게 나타납니다.',
  '식신': '창의적 표현과 결과물 창출에 에너지가 맞춰진 기질입니다. 콘텐츠, 제품, 서비스 창출에 강합니다.',
  '상관': '기존 방식에 도전하고 혁신적인 방향을 제시하려는 성향이 있습니다.',
  '편재': '수익화 가능성과 시장 반응을 먼저 확인하는 편입니다. 사업 감각이 강합니다.',
  '정재': '검증된 방법과 안정적 수입에 우선순위를 두는 편입니다.',
  '편관': '결과와 영향력을 중심으로 움직이는 성향입니다. 빠른 성과와 도전에서 에너지를 얻습니다.',
  '정관': '규칙과 역할 안에서 안정적으로 실행하는 성향입니다. 조직 내 신뢰 축적에 강합니다.',
  '편인': '충분히 이해한 후 실행하려는 경향이 있습니다. 독립적 학습과 전문 탐구에 강합니다.',
  '정인': '검증된 지식과 전문 역량을 기반으로 판단합니다. 체계적 학습과 전문성 축적이 강점입니다.',
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert a ManseChart into a SajuBehaviorProfile for use in career analysis.
 *
 * - "calculated": uses day master + elementProfile + tenGodProfile
 * - "partial": uses available elementProfile only (less accurate)
 * - "failed": returns unavailable — no year-only fallback
 */
export function interpretManseForCareer(
  chart: ManseChart,
  _primaryStrategy: string,
): SajuBehaviorProfile {
  // Failed or no data: do not guess from year alone
  if (chart.status === 'failed' || (!chart.dayMaster && !chart.elementProfile)) {
    return {
      status: 'unavailable',
      temperament: '',
      decisionPattern: '',
      strengthPattern: '',
      vulnerabilityPattern: '',
      careerDirectionHint: '',
      timingHint: '',
      caution:
        '행동 성향 분석이 아직 연결되지 않았습니다. ' +
        '생년월일시 기반 계산이 연결되면 더 정확한 해석이 제공됩니다.',
    };
  }

  // Resolve dominant element — day master takes priority (most accurate)
  const element: FiveElement = (() => {
    if (chart.dayMaster) return chart.dayMaster.element;
    if (chart.elementProfile) {
      const entries = Object.entries(chart.elementProfile) as [FiveElement, number][];
      return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    }
    return 'water'; // fallback (should not reach here given the guard above)
  })();

  // Build ten god modifier note from dominant ten god (when available)
  let tenGodNote = '';
  if (chart.tenGodProfile) {
    const sorted = (Object.entries(chart.tenGodProfile) as [TenGod, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const topGod = sorted[0]?.[0];
    if (topGod && TEN_GOD_CAREER_MODIFIER[topGod]) {
      tenGodNote = ` 또한 ${TEN_GOD_CAREER_MODIFIER[topGod]}`;
    }
  }

  const isCalculated = chart.status === 'calculated';
  const caution = isCalculated
    ? '생년월일시 기반 전체 분석입니다. 실제 상황과 다를 수 있으므로 참고용으로 활용하세요.'
    : '생년월일 기반 부분 분석입니다. 생시(時) 정보가 있을 때 더 정확해집니다. 참고용으로만 활용하세요.';

  return {
    status: isCalculated ? 'full' : 'partial',
    temperament:          ELEMENT_TEMPERAMENT[element],
    decisionPattern:      ELEMENT_DECISION[element] + tenGodNote,
    strengthPattern:      ELEMENT_STRENGTH[element],
    vulnerabilityPattern: ELEMENT_VULNERABILITY[element],
    careerDirectionHint:  ELEMENT_CAREER_HINT[element],
    timingHint:           ELEMENT_TIMING[element],
    caution,
  };
}

// ─── Deep persona narrative (한 단락 통합) ────────────────────────────────────
// 일주(dayMaster)의 element + yang/yin + tenGod을 결합해서 깊이 있는 한 단락 생성

const ELEMENT_YANG_DEEP: Record<FiveElement, string> = {
  wood:  '큰 나무처럼 뻗어나가려는 기질을 가진 분이에요. 새로운 환경과 가능성을 마주할 때 가장 살아있다고 느끼고, 정체된 자리에 오래 머무르는 걸 본능적으로 답답해해요.',
  fire:  '환한 불처럼 표현하고 발산하는 기질을 가진 분이에요. 사람들과 연결되고 영향을 주고받을 때 에너지가 차오르고, 자기 일이 누군가에게 가닿지 않으면 의미를 잃어요.',
  earth: '큰 산처럼 묵직하고 신뢰를 쌓아가는 기질을 가진 분이에요. 빠른 변화보다 단단한 기반 위에서 천천히 쌓아 올리는 방식이 본인에게 가장 맞아요.',
  metal: '단단한 금속처럼 원칙과 기준을 중시하는 기질을 가진 분이에요. 자기만의 기준이 명확할 때 최고의 성과를 내고, 모호한 상황을 가장 견디기 힘들어해요.',
  water: '깊은 물처럼 흐름을 읽고 적응하는 기질을 가진 분이에요. 정면 돌파보다 상황을 먼저 파악하고 리스크를 줄이는 방식으로 움직여요.',
};

const ELEMENT_YIN_DEEP: Record<FiveElement, string> = {
  wood:  '작은 풀처럼 유연하게 자라나는 기질을 가진 분이에요. 큰 변화보다 작은 시도를 여러 번 거치면서 방향을 잡아가고, 환경에 맞춰 자기 모습을 조정하는 능력이 뛰어나요.',
  fire:  '촛불처럼 따뜻하게 사람을 끌어들이는 기질을 가진 분이에요. 큰 무대보다 가까운 사람들과의 깊은 연결에서 에너지를 얻고, 그 안에서 자기 일을 의미 있게 풀어가요.',
  earth: '들판처럼 사람들이 머물 수 있는 기반이 되는 기질을 가진 분이에요. 자기를 드러내기보다 주변을 안정시키는 방식으로 가치를 만들어내는 사람이에요.',
  metal: '정교한 도구처럼 섬세하게 다듬는 기질을 가진 분이에요. 큰 그림보다 디테일에서 차이를 만들고, 자기 기준이 정밀할수록 결과물의 품질이 올라가요.',
  water: '잔잔한 호수처럼 깊이 생각하는 기질을 가진 분이에요. 즉각 반응하기보다 충분히 곱씹은 뒤에 움직이고, 그래서 결정의 무게가 다른 사람보다 무거워요.',
};

const ELEMENT_DRIVE_PATTERN: Record<FiveElement, string> = {
  wood:  '그래서 지금 이 회사가 작게 느껴지거나 성장이 멈춘 것처럼 느껴진다면, 그건 게으름이 아니라 본성이 보내는 신호예요.',
  fire:  '그래서 일에서 의미와 연결을 못 느낄 때 가장 빨리 소진되고, 반대로 의미가 분명할 때는 누구보다 멀리 갈 수 있어요.',
  earth: '그래서 갑작스러운 변화보다 충분히 검증된 방향으로 천천히 옮겨가는 게 본인에게 안전하고, 결과적으로도 더 멀리 가요.',
  metal: '그래서 기준이 흐릿한 환경에서 오래 일하면 자기 손해가 크고, 기준이 명확한 환경에서는 동료들이 인정하는 전문가로 성장해요.',
  water: '그래서 결정을 미루는 것처럼 보일 때도 사실은 신중하게 타이밍을 재고 있는 거고, 한번 움직이면 후회가 적어요.',
};

const TEN_GOD_DEEP_NOTE: Partial<Record<TenGod, string>> = {
  '비견': '특히 자기 주도성이 강해서, 누가 시켜서 하는 일보다 직접 결정한 일에서 훨씬 큰 성과가 나요.',
  '겁재': '특히 경쟁이 있는 환경에서 실력이 발휘되고, 도전 과제 앞에서 오히려 침착해지는 타입이에요.',
  '식신': '특히 만들어내는 능력이 강해서, 콘텐츠·제품·서비스처럼 결과물이 남는 일에서 강점이 드러나요.',
  '상관': '특히 기존 방식에 의문을 던지고 새 방식을 만들어내려는 본능이 있어서, 정해진 틀 안에서만 일하면 답답함을 느껴요.',
  '편재': '특히 시장 반응과 수익화 감각이 좋아서, 사업적 가능성을 빠르게 알아채는 사람이에요.',
  '정재': '특히 검증된 방법과 안정적 수입에 우선순위를 두고, 모험보다 꾸준한 축적에서 안전감을 느껴요.',
  '편관': '특히 결과와 영향력으로 평가받는 환경에서 가장 잘 작동하고, 빠른 성과를 만들어내는 데 강해요.',
  '정관': '특히 조직 안에서 신뢰를 쌓고 책임 있는 역할을 맡을 때 본인의 강점이 가장 잘 살아나요.',
  '편인': '특히 깊이 이해한 뒤에 움직이고, 독학·연구·전문 영역 탐구에서 큰 성과를 내요.',
  '정인': '특히 검증된 지식과 전문 역량을 기반으로 판단하고, 체계적으로 쌓은 전문성이 본인의 무기예요.',
};

/**
 * 한 단락으로 통합된 깊이 있는 성향 narrative.
 * 일주의 element + yang/yin + 가장 강한 tenGod까지 반영.
 *
 * Returns empty string when chart is not calculated.
 */
export function buildDeepPersonaNarrative(chart: ManseChart): string {
  if (chart.status === 'failed' || !chart.dayMaster) return '';

  const element = chart.dayMaster.element;
  const yang = chart.dayMaster.yinYang === 'yang';

  // Yang/Yin 기반 핵심 묘사
  const coreNarrative = yang ? ELEMENT_YANG_DEEP[element] : ELEMENT_YIN_DEEP[element];

  // 본성이 만들어내는 패턴
  const drivePattern = ELEMENT_DRIVE_PATTERN[element];

  // 가장 강한 tenGod의 특화 노트
  let tenGodNote = '';
  if (chart.tenGodProfile) {
    const sorted = (Object.entries(chart.tenGodProfile) as [TenGod, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const topGod = sorted[0]?.[0];
    if (topGod && TEN_GOD_DEEP_NOTE[topGod]) {
      tenGodNote = ' ' + TEN_GOD_DEEP_NOTE[topGod];
    }
  }

  return coreNarrative + ' ' + drivePattern + tenGodNote;
}

