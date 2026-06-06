// Career Compass 2.0 — P2.4 Profile Context Summary builder.
//
// Pure function that converts (UserProfile, ResultSpine) → ProfileContextSummary.
// Designed for the result-page "지금 상태" card. The summary is COPY-ONLY:
// engines never read it back, so toggling profile data that changes the
// summary cannot change any routing field.
//
// ─── HARD INVARIANT ──────────────────────────────────────────────────────────
// The output of this module MUST NOT be consumed by any engine. Concretely:
//   • Not by classifyMainType / selectSolutionModules / deriveActiveLenses /
//     resolveClosingLine / sourceOptionKey resolver / planModule routing /
//     bestMove selection / EXPERIMENT_HOME_MODULE.
//   • Not by any vector / construct / gate / score effects.
//   • Not by any P1.x invariant (especially P1.7 burnout).
//   • Not by jobRoleNormalizer routing behavior.
// The session-level routing-fingerprint tests in session.test.ts enforce this.
//
// PURITY: this function does not mutate its arguments. Input `profile` and
// `result` objects are read-only — verified by the P2.4 PURITY tests.

import type {
  UserProfile,
  ResultSpine,
  ProfileContextSummary,
  MainTypeKey,
  SolutionModuleKey,
} from '../types/careerCompass.ts';
import { MAIN_TYPE_LABELS } from '../types/careerCompass.ts';
import type { JobRoleCategory } from './jobRoleNormalizer.ts';

// ─── Display labels (Korean) ─────────────────────────────────────────────────

const AGE_BAND_LABELS: Record<NonNullable<UserProfile['ageBand']>, string> = {
  '20_early':     '20대 초반',
  '20_late':      '20대 후반',
  '30_early':     '30대 초반',
  '30_late':      '30대 후반',
  '40_early':     '40대 초반',
  '40_late_plus': '40대 후반 이상',
};

const TOTAL_CAREER_LABELS: Record<NonNullable<UserProfile['totalCareerStage']>, string> = {
  total_0_3:              '경력 0~3년',
  total_3_7:              '경력 3~7년',
  total_7_12:             '경력 7~12년',
  total_12_plus:          '경력 12년 이상',
  no_fulltime_experience: '본격적 경력 시작 전',
};

// (WORK_MODE_LABELS / TRANSITION_TIMING_LABELS / TRANSITION_INTENT_LABELS
//  removed in P2.4.12 — body composer now uses WORK_MODE_THEME +
//  computeActionTone() per the burnout-dominant / careerPattern / workMode /
//  transition copy rules. Profile-side prose labels are no longer needed.)

// Job-role category → short Korean noun for tag use. 'other' deliberately
// omitted so the tag list never surfaces a "기타" label.
const JOB_ROLE_CATEGORY_TAGS: Partial<Record<JobRoleCategory, string>> = {
  marketing:                  '마케터',
  design:                     '디자이너',
  engineering:                '엔지니어',
  product_planning:           '프로덕트·기획',
  business_strategy:          '전략·컨설팅',
  investment_finance:         '투자·금융',
  healthcare_medical:         '의료',
  veterinary_pet:             '수의·반려동물',
  research_academia:          '연구·학계',
  education:                  '교육',
  content_media:              '콘텐츠·미디어',
  sales_business_development: '영업·BD',
  operations:                 '운영',
  legal_accounting:           '법률·회계',
  beauty_wellness:            '뷰티·웰니스',
  founder_entrepreneur:       '창업·1인 사업',
  student_jobseeker:          '학생·취준',
  multi_domain:               '다중 분야',
};

// Job-role category → headline-friendly noun (used only when jobRoleRaw is empty).
const JOB_ROLE_CATEGORY_HEADLINE: Partial<Record<JobRoleCategory, string>> = {
  ...JOB_ROLE_CATEGORY_TAGS,
  engineering: '개발자/엔지니어',
};

// Chip-form work mode labels — shorter than WORK_MODE_LABELS (which are full
// sentences) so they fit in a tag chip.
const WORK_MODE_TAGS: Record<NonNullable<UserProfile['workMode']>, string> = {
  organization: '조직 소속',
  professional: '전문직',
  freelance:    '프리랜서',
  founder:      '창업·대표',
  student:      '학생/취준',
  career_break: '커리어 휴식',
  multi_work:   '겸업',
};

// Chip-form career pattern labels — shorter than the prose ones above.
const CAREER_PATTERN_TAGS: Record<NonNullable<UserProfile['careerPattern']>, string> = {
  single_track:      '단일 분야',
  domain_shift:      '분야 전환',
  multi_track:       '다중 분야',
  early_exploration: '초기 탐색',
};

// Chip-form total career stage labels.
const TOTAL_CAREER_TAGS: Record<NonNullable<UserProfile['totalCareerStage']>, string> = {
  total_0_3:              '경력 0~3년',
  total_3_7:              '경력 3~7년',
  total_7_12:             '경력 7~12년',
  total_12_plus:          '경력 12년+',
  no_fulltime_experience: '경력 시작 전',
};

// Chip-form transition timing labels.
const TRANSITION_TIMING_TAGS: Record<NonNullable<UserProfile['transitionTiming']>, string> = {
  now:               '지금 바로',
  within_1_3_months: '1~3개월 내',
  within_3_6_months: '3~6개월 준비',
  after_6_months:    '6개월+ 유지',
  unknown:           '시기 미정',
};

// ─── Args + return shape ─────────────────────────────────────────────────────

export interface BuildProfileContextSummaryArgs {
  profile: UserProfile;
  result: ResultSpine;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function pickJobRoleLabel(profile: UserProfile): string | undefined {
  // Prefer the user's verbatim words — they convey nuance the category can't.
  if (profile.jobRoleRaw && profile.jobRoleRaw.trim().length > 0) {
    return profile.jobRoleRaw.trim();
  }
  if (profile.jobRoleCategory && profile.jobRoleCategory !== 'other') {
    return JOB_ROLE_CATEGORY_HEADLINE[profile.jobRoleCategory as JobRoleCategory];
  }
  return undefined;
}

function composeHeadline(profile: UserProfile, result: ResultSpine): string {
  // Label lookups can return undefined for unrecognized enum values (e.g. a stale
  // persisted session) — filter them so the join never renders a dangling ' · '.
  const parts: string[] = [
    profile.ageBand ? AGE_BAND_LABELS[profile.ageBand] : undefined,
    pickJobRoleLabel(profile),
    profile.totalCareerStage ? TOTAL_CAREER_LABELS[profile.totalCareerStage] : undefined,
  ].filter((p): p is string => !!p);
  if (parts.length > 0) return parts.join(' · ');

  // No profile signal — fall back to a neutral, result-derived phrase so the
  // headline string is still meaningful per the user spec (headline: string).
  const mainLabel = MAIN_TYPE_LABELS[result.solutionLayer.mainTypeKey as MainTypeKey];
  return mainLabel ? `지금 ${mainLabel}` : '지금 상태';
}

// ─── Korean particle helpers ────────────────────────────────────────────────
// Last Hangul syllable has a final consonant (받침) when (codepoint - 0xAC00) %
// 28 !== 0. The 'ㄹ' batchim (rieul) takes 을/를 like every other batchim for
// object/subject particles, so a single boolean suffices here.
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}
function subjectParticle(word: string): '이' | '가' {
  return hasBatchim(word) ? '이' : '가';
}
function objectParticle(word: string): '을' | '를' {
  return hasBatchim(word) ? '을' : '를';
}

// ─── Burnout dominance ──────────────────────────────────────────────────────
// When mainTypeKey === 'overloadedBurnout' OR planModule.key === 'recoveryFirst',
// body is 2 sentences: a verbatim recovery framing S1 + a timing-aware
// maintain-and-recover S2 with an optional workMode insert. The S2 prefix
// adapts to transitionTiming (e.g. "6개월 이상 현재 일을 유지해야 한다면" for
// after_6_months) and the inside-the-sentence insert adapts to workMode
// (e.g. "업무 경계와 " for organization). For non-safe workModes
// (freelance / founder / multi_work) the insert is empty so the body cannot
// surface market validation / customer conversations / proposals / etc.
const BURNOUT_S1 = '현재는 커리어 방향을 판단하기 전에 에너지와 생활 리듬을 회복해야 하는 상태에 가깝습니다.';

function burnoutTimingPrefix(profile: UserProfile): string {
  switch (profile.transitionTiming) {
    case 'after_6_months':    return '6개월 이상 현재 일을 유지해야 한다면';
    case 'within_3_6_months': return '3~6개월간 현재 일을 유지해야 한다면';
    case 'within_1_3_months': return '1~3개월 안에 변화를 고려한다면';
    case 'now':               return '지금 바로 움직일 수 있다면';
    case 'unknown':
    default:                   return '현재 일을 당분간 유지해야 하는 조건이 있다면';
  }
}

function burnoutWorkModeInsert(profile: UserProfile): string {
  switch (profile.workMode) {
    case 'organization': return '업무 경계와 ';
    case 'professional': return '신뢰를 유지하는 일정과 ';
    case 'career_break': return '생활 리듬과 ';
    case 'student':      return '작은 시도와 ';
    // freelance / founder / multi_work: empty — their typical workMode language
    // (customer feedback, market validation, proposals) is on the burnout
    // suppression list. Recovery sentence stays plain.
    default:             return '';
  }
}

function composeBurnoutBody(profile: UserProfile): string {
  const prefix = burnoutTimingPrefix(profile);
  const insert = burnoutWorkModeInsert(profile);
  const S2 = `${prefix}, 이번 달에는 큰 전환보다 ${insert}회복 가능한 리듬을 만드는 것이 우선입니다.`;
  return `${BURNOUT_S1} ${S2}`;
}

// ─── Specialized: plateauedPerformer + portfolioConvert + domain_shift ──────
// When the engine recommends portfolioConvert AND the profile carries a
// domain_shift pattern AND we have both total + current career stages, swap in
// a 2-sentence "two-axes bridge" body (per user Example 1).
// Falls back to the generic composer when any precondition is missing.
const TOTAL_CAREER_EXPERIENCE: Record<NonNullable<UserProfile['totalCareerStage']>, string> = {
  total_0_3:              '초기 실무 경험',
  total_3_7:              '주니어~미들 수준의 실무 경험',
  total_7_12:             '충분한 실무 경험',
  total_12_plus:          '선임급의 깊이 있는 경험',
  no_fulltime_experience: '본격적인 실무 경험은 아직 적은 단계',
};
const CURRENT_FIELD_EXPERTISE: Record<NonNullable<UserProfile['currentFieldStage']>, string> = {
  current_under_1:         '1년 미만의 초기 단계',
  current_1_3:             '1~3년차 수준의 전문성',
  current_3_7:             '3~7년차 수준의 전문성',
  current_7_plus:          '7년 이상의 깊이',
  multiple_current_fields: '여러 분야를 병행하는 구조',
};

function composePlateauedPortfolioBridgeBody(profile: UserProfile): string {
  const totalPhrase = TOTAL_CAREER_EXPERIENCE[profile.totalCareerStage!];
  const currentPhrase = CURRENT_FIELD_EXPERTISE[profile.currentFieldStage!];
  const S1 = `전체 경력으로는 ${totalPhrase}${subjectParticle(totalPhrase)} 쌓였고, 현재 직무에서도 ${currentPhrase}${subjectParticle(currentPhrase)} 형성된 상태입니다.`;
  const S2 = '특히 이전 분야의 전문성과 현재 직무 경험이 함께 있는 전환형 커리어이므로, 이번 고민은 완전히 새로 시작할지보다 이미 가진 두 축을 어떤 문제에 연결할지에 가깝습니다.';
  return `${S1} ${S2}`;
}

// ─── Specialized: scatteredExplorer + optionNarrowing ───────────────────────
// "Too many options → narrow to 2~3". S1 weaves in transitionTiming framing +
// a workMode-flavored focus phrase. S2 is a workMode-specific warning.
function optionNarrowingTimingPrefix(profile: UserProfile): string {
  switch (profile.transitionTiming) {
    case 'now':               return '현재 바로 움직일 수 있는 상태라면';
    case 'within_1_3_months': return '1~3개월 안에 움직일 수 있다면';
    case 'within_3_6_months': return '3~6개월의 준비 시간을 두고 본다면';
    case 'after_6_months':    return '지금 당장 결정하지 않아도 된다면';
    case 'unknown':           return '시기는 아직 정해지지 않았더라도';
    default:                   return '지금 단계에서는';
  }
}
function optionNarrowingFocusPhrase(profile: UserProfile): string {
  switch (profile.workMode) {
    case 'freelance':    return '수익 가능성과 지속 가능성';
    case 'founder':      return '고객 가설과 수익 가설';
    case 'organization': return '검증 가능성과 합의 가능성';
    case 'professional': return '신뢰와 케이스 정리 가능성';
    case 'student':      return '경험 가치와 학습 가능성';
    case 'career_break': return '회복 가능성과 지속 가능성';
    case 'multi_work':   return '에너지 효율과 지속 가능성';
    default:             return '현실적인 실행 가능성';
  }
}
function optionNarrowingWorkModeWarning(profile: UserProfile): string | undefined {
  switch (profile.workMode) {
    case 'freelance':    return '프리랜서/독립형 일에서는 방향이 넓을수록 포지셔닝과 고객 확보가 늦어질 수 있습니다.';
    case 'organization': return '조직 안에서는 선택지가 많을수록 합의와 우선순위가 흐려질 수 있습니다.';
    case 'founder':      return '창업/대표 역할에서는 한두 가설로 좁혀야 자원을 집중할 수 있습니다.';
    case 'professional': return '전문직 일에서는 좁힌 케이스로 신뢰를 쌓는 것이 더 빠릅니다.';
    case 'student':      return '탐색 단계에서는 너무 많은 선택지를 두기보다 작은 시도로 좁히는 것이 도움이 됩니다.';
    case 'career_break': return '재진입 시기에는 좁힌 방향이 회복 후 첫 시도를 빠르게 만듭니다.';
    case 'multi_work':   return '여러 일을 병행할수록 우선순위 기준이 좁히는 기준이 됩니다.';
    default:             return undefined;
  }
}
function composeOptionNarrowingBody(profile: UserProfile): string {
  const timingPrefix = optionNarrowingTimingPrefix(profile);
  const focus = optionNarrowingFocusPhrase(profile);
  const S1 = `${timingPrefix} 선택지를 더 늘리는 것보다, ${focus}${subjectParticle(focus)} 있는 후보를 2~3개로 좁히는 것이 중요합니다.`;
  const warning = optionNarrowingWorkModeWarning(profile);
  return warning ? `${S1} ${warning}` : S1;
}

// ─── careerPattern framing (user spec — verbatim sentences) ─────────────────
const CAREER_PATTERN_SENTENCE: Record<NonNullable<UserProfile['careerPattern']>, string> = {
  domain_shift:      '한 분야만 깊게 파온 사람이라기보다, 이전 경험과 현재 직무를 연결해온 전환형 커리어에 가깝습니다.',
  multi_track:       '여러 축의 경험이 흩어진 약점이라기보다, 연결 방식이 정리되면 차별점이 될 수 있습니다.',
  single_track:      '한 분야에서 쌓아온 경험을 다음 선택지에 어떻게 활용할지가 중요합니다.',
  early_exploration: '아직 커리어 축을 확정하기보다, 가능한 선택지를 가볍게 확인해보는 단계에 가깝습니다.',
};

// ─── workMode example themes (user spec — keywords woven into copy) ─────────
const WORK_MODE_THEME: Record<NonNullable<UserProfile['workMode']>, string> = {
  organization: '내부 조정과 역할 재설계',
  professional: '전문성과 케이스 정리, 자문/강의 가능성',
  freelance:    '포트폴리오와 고객 반응, 제안서',
  founder:      '고객 문제와 시장 반응, 런웨이',
  student:      '탐색과 경험 축적, 작은 시도',
  career_break: '회복과 재진입, 생활 리듬',
  multi_work:   '우선순위와 에너지 분산, 포트폴리오 구조',
};

// ─── Action tone — combines transitionIntent + transitionTiming ──────────────
// "after_6_months" timing and "must_stay" intent both call for the same
// conservative tone; either condition wins regardless of the other field.
function computeActionTone(profile: UserProfile): string | undefined {
  if (profile.transitionTiming === 'after_6_months' || profile.transitionIntent === 'must_stay') {
    return '큰 전환보다 현직 재설계와 조용한 준비가 자연스럽습니다.';
  }
  const intentPart = (() => {
    switch (profile.transitionIntent) {
      case 'curious':              return '탐색 중심';
      case 'preparing':            return '준비 중심';
      case 'actively_considering': return '실제 선택지 비교 중심';
      case 'ready_to_switch':      return '실행 가능성 중심';
      default:                     return undefined;
    }
  })();
  const timingPart = (() => {
    switch (profile.transitionTiming) {
      case 'now':               return '바로 실행 가능한 작은 행동';
      case 'within_1_3_months': return '준비와 외부 확인 병행';
      case 'within_3_6_months': return '자산화·탐색·준비';
      case 'unknown':           return '작게 확인하고 판단';
      default:                  return undefined;
    }
  })();
  const parts = [intentPart, timingPart].filter((s): s is string => !!s);
  if (parts.length === 0) return undefined;
  const joined = parts.join(' · ');
  return `${joined}${subjectParticle(joined)} 자연스럽습니다.`;
}

// ─── P3.5 — planModule frame coherence ───────────────────────────────────────
// The body MUST align with the engine's recommendation frame (planModule).
// We group every SolutionModuleKey into one of three coherent categories so the
// composer can suppress profile-derived phrases that would conflict with the
// dominant frame.
//
//   recovery → recoveryFirst, runwayStabilizer
//              → no action-urgent tone, no market/content/interview/networking
//              → only the career_break workMode theme (회복과 재진입) is allowed
//                here; everywhere else it is suppressed.
//   planning → valueTradeoffMapping, optionNarrowing, opportunityGeneration,
//              strengthsReflection
//              → reflection/criteria-clarification phrasing only; no action-urgent
//                tone like "실행 가능성 중심 · 바로 실행 가능한 작은 행동".
//   action   → marketTest, contentEngine, independentPilot, portfolioConvert,
//              roleRedesign, confidenceBuilder
//              → action-urgent tone OK; conservative tone still allowed.
type FrameCategory = 'recovery' | 'planning' | 'action';

function frameCategoryFor(moduleKey: SolutionModuleKey): FrameCategory {
  switch (moduleKey) {
    case 'recoveryFirst':
    case 'runwayStabilizer':
      return 'recovery';
    case 'valueTradeoffMapping':
    case 'optionNarrowing':
    case 'opportunityGeneration':
    case 'strengthsReflection':
      return 'planning';
    case 'marketTest':
    case 'contentEngine':
    case 'independentPilot':
    case 'portfolioConvert':
    case 'roleRedesign':
    case 'confidenceBuilder':
      return 'action';
  }
}

// One sentence per planModule that answers
// "그래서 이번 달에 무엇을 우선해야 하나?". Self-contained — never references
// sourceOptionKey labels by name (those live in the executionPlan section
// further down). recoveryFirst is included for completeness even though the
// burnout dispatcher branch already owns recovery-aligned bodies.
const PRIORITY_BY_MODULE: Record<SolutionModuleKey, string> = {
  recoveryFirst:         '이번 달에는 큰 전환보다 회복 가능한 리듬을 먼저 만드는 것이 우선입니다.',
  runwayStabilizer:      '이번 달에는 큰 결정을 미루고 런웨이와 현실 조건을 먼저 안정화하는 것이 우선입니다.',
  optionNarrowing:       '이번 달에는 선택지를 더 늘리기보다 후보를 2~3개로 좁혀 비교 기준을 만드는 것이 우선입니다.',
  valueTradeoffMapping:  '이번 달에는 새로운 시도를 늘리기보다, 나에게 중요한 기준을 먼저 정리하는 것이 우선입니다.',
  opportunityGeneration: '이번 달에는 작은 외부 탐색으로 가능한 선택지를 더 발굴해보는 것이 우선입니다.',
  strengthsReflection:   '이번 달에는 강점을 회고하면서 다음 한 수의 근거를 정리하는 것이 우선입니다.',
  portfolioConvert:      '이번 달에는 기존 전문성을 사례·포트폴리오로 정리해 다음 자리로 잇는 것이 우선입니다.',
  roleRedesign:          '이번 달에는 자리를 옮기기보다 현재 역할 안에서 작게 재설계해보는 것이 우선입니다.',
  contentEngine:         '이번 달에는 한두 편의 작은 콘텐츠 실험으로 방향을 검증해보는 것이 우선입니다.',
  marketTest:            '이번 달에는 시장 반응을 작은 단위로 확인해보는 것이 우선입니다.',
  independentPilot:      '이번 달에는 독립 파일럿을 작게 돌려 수익·고객 가능성을 확인해보는 것이 우선입니다.',
  confidenceBuilder:     '이번 달에는 작은 성공을 한두 번 쌓아 다음 단계의 확신을 만드는 것이 우선입니다.',
};

// Action-urgent phrases in the composed tone. These get dropped under
// planning/recovery frames so the body doesn't tell the user to act NOW when
// the plan is to think/recover first. The conservative tone variant
// ("큰 전환보다 현직 재설계와 조용한 준비") is FRAME-NEUTRAL — never dropped.
function isActionUrgentTone(tone: string): boolean {
  return tone.includes('실행 가능성 중심') || tone.includes('바로 실행 가능한 작은 행동');
}

function composeNonBurnoutBody(profile: UserProfile, result: ResultSpine): string {
  const moduleKey = result.solutionLayer.primaryModule.key;
  const frame = frameCategoryFor(moduleKey);

  const sentences: string[] = [];

  // S1 — careerPattern (WHO they are). Frame-neutral; always coherent.
  if (profile.careerPattern) sentences.push(CAREER_PATTERN_SENTENCE[profile.careerPattern]);

  // S2 — workMode theme + action tone, ONLY when frame-coherent.
  //   • The career_break theme ('회복과 재진입, 생활 리듬') is a recovery
  //     framing. Suppress it under non-recovery frames (P3.5 spec: do not
  //     mention 회복과 재진입 unless the plan is recovery-oriented).
  //   • Action-urgent tone phrases ('실행 가능성 중심', '바로 실행 가능한
  //     작은 행동') conflict with planning/recovery priorities. Suppress
  //     them when the frame is non-action.
  let theme = profile.workMode ? WORK_MODE_THEME[profile.workMode] : undefined;
  if (profile.workMode === 'career_break' && frame !== 'recovery') theme = undefined;
  let tone = computeActionTone(profile);
  if (tone && frame !== 'action' && isActionUrgentTone(tone)) tone = undefined;

  if (theme && tone) {
    sentences.push(`${theme}${objectParticle(theme)} 중심으로, ${tone}`);
  } else if (theme) {
    sentences.push(`${theme}${subjectParticle(theme)} 중심이 됩니다.`);
  } else if (tone) {
    sentences.push(tone);
  }

  // S3 — planModule-frame priority anchor (answers
  // "그래서 이번 달에 무엇을 우선해야 하나?"). Replaces the legacy dual-mention
  // sentence ("이번 결과는 X 전략과 Y 방향을 권합니다.") that mixed module
  // title with sourceOptionKey label and produced incoherent paragraphs (P3.5).
  sentences.push(PRIORITY_BY_MODULE[moduleKey]);

  // Cap at 3 sentences — keep the section visually lighter than executionPlan.
  return sentences.slice(0, 3).join(' ');
}

// Dispatcher.
//   1. Burnout (mainTypeKey=overloadedBurnout OR planModuleKey=recoveryFirst):
//      composeBurnoutBody (verbatim S1 + timing/workMode-aware S2)
//   2. plateauedPerformer + portfolioConvert + careerPattern=domain_shift +
//      total+current career stages: composePlateauedPortfolioBridgeBody
//      (experience framing + two-axes-bridge framing per user Example 1)
//   3. scatteredExplorer + optionNarrowing: composeOptionNarrowingBody
//      (timing+workMode-flavored narrow-options framing per user Example 2)
//   4. Otherwise: composeNonBurnoutBody (generic careerPattern + workMode
//      theme + strategy mention from P2.4.12)
function composeBody(profile: UserProfile, result: ResultSpine): string {
  const mainType = result.solutionLayer.mainTypeKey;
  const moduleKey = result.solutionLayer.primaryModule.key;

  // 1. Burnout (highest priority)
  if (mainType === 'overloadedBurnout' || moduleKey === 'recoveryFirst') {
    return composeBurnoutBody(profile);
  }

  // 2. plateauedPerformer × portfolioConvert × domain_shift + career stages
  if (
    mainType === 'plateauedPerformer' &&
    moduleKey === 'portfolioConvert' &&
    profile.careerPattern === 'domain_shift' &&
    profile.totalCareerStage &&
    profile.currentFieldStage
  ) {
    return composePlateauedPortfolioBridgeBody(profile);
  }

  // 3. scatteredExplorer × optionNarrowing
  if (mainType === 'scatteredExplorer' && moduleKey === 'optionNarrowing') {
    return composeOptionNarrowingBody(profile);
  }

  // 4. Generic fallback
  return composeNonBurnoutBody(profile, result);
}

// User-spec tag categories for the "현재 맥락 요약" chip row. Profile-only,
// ordered:
//   1. 직업군         — jobRoleCategory
//   2. 경력 단계      — totalCareerStage
//   3. 일하는 방식    — workMode
//   4. 전환 가능 시점 — transitionTiming
//   5. 커리어 패턴    — careerPattern
// Each chip is skipped when its source field is undefined / 'other' / etc.
// Every returned label is a user-friendly Korean phrase — never a raw enum
// value like 'total_7_12' or 'organization'.
function composeTags(profile: UserProfile): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const add = (t: string | undefined) => {
    if (t && !seen.has(t)) { seen.add(t); tags.push(t); }
  };

  // 1. 직업군
  if (profile.jobRoleCategory && profile.jobRoleCategory !== 'other') {
    add(JOB_ROLE_CATEGORY_TAGS[profile.jobRoleCategory as JobRoleCategory]);
  }
  // 2. 경력 단계
  if (profile.totalCareerStage) add(TOTAL_CAREER_TAGS[profile.totalCareerStage]);
  // 3. 일하는 방식
  if (profile.workMode) add(WORK_MODE_TAGS[profile.workMode]);
  // 4. 전환 가능 시점
  if (profile.transitionTiming) add(TRANSITION_TIMING_TAGS[profile.transitionTiming]);
  // 5. 커리어 패턴
  if (profile.careerPattern) add(CAREER_PATTERN_TAGS[profile.careerPattern]);

  return tags;
}

// Heuristic: a profile is "essentially empty" — i.e. nothing meaningful to
// summarize — when every field a summary line could draw on is absent. In that
// case the UI hides the section entirely (per user spec).
function isProfileTooEmpty(profile: UserProfile): boolean {
  return !(
    profile.ageBand
    || (profile.jobRoleRaw && profile.jobRoleRaw.trim().length > 0)
    || (profile.jobRoleCategory && profile.jobRoleCategory !== 'other')
    || profile.totalCareerStage
    || profile.currentFieldStage
    || profile.careerPattern
    || profile.workMode
    || profile.transitionTiming
    || profile.transitionIntent
    || (profile.concernTags && profile.concernTags.length > 0)
    || (profile.constraintTags && profile.constraintTags.length > 0)
    || (profile.desiredPaths && profile.desiredPaths.length > 0)
  );
}

// ─── buildProfileContextSummary ──────────────────────────────────────────────
// Pure. Reads from `profile` and `result`; mutates NEITHER.
//
// Returns `undefined` when the profile is essentially empty — the UI then
// hides the "현재 맥락 요약" section entirely. Per user spec, this is
// preferable to surfacing a generic placeholder when there is nothing to say.
export function buildProfileContextSummary(
  args: BuildProfileContextSummaryArgs,
): ProfileContextSummary | undefined {
  const { profile, result } = args;

  if (isProfileTooEmpty(profile)) return undefined;

  const headline = composeHeadline(profile, result);
  const body     = composeBody(profile, result);
  const tags     = composeTags(profile);

  return tags.length > 0
    ? { headline, body, tags }
    : { headline, body };
}
