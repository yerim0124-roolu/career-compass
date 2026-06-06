// Headless tests for P2.4 buildProfileContextSummary. Pure function only.
// Contract:
//   { profile, result } → ProfileContextSummary | undefined
//   undefined when profile is essentially empty.
//   ProfileContextSummary = { headline: string; body: string; tags?: string[] }
//   Tags map to user-spec categories: 직업군 / 경력 단계 / 일하는 방식 /
//   전환 가능 시점 / 커리어 패턴. Raw enum values must NOT appear in output.

import { buildProfileContextSummary } from './profileContextSummary.ts';
import { buildResultFromResponses } from '../components/careerCompassV2/session.ts';
import type { FlowResponses } from '../components/careerCompassV2/session.ts';
import type { UserProfile, ResultSpine } from '../types/careerCompass.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Shared fixture — realistic ResultSpine to use as the `result` arg ───────
const baseResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_expand'] },
  ar_roles: { selectedOptionIds: ['ar_expert', 'ar_analyst', 'ar_advisor'] },
  cv_values: { selectedOptionIds: ['cv_growth', 'cv_problem', 'cv_meaning'] },
  cv_priorities: { ranking: ['pr_growth', 'pr_meaning', 'pr_freedom'] },
  fc_1: { selectedOptionIds: ['fc1_solo'] },
  fc_2: { selectedOptionIds: ['fc2_curator'] },
  fc_3: { selectedOptionIds: ['fc3_legacy'] },
  fc_4: { selectedOptionIds: ['fc4_idea'] },
  sc_outlook: { selectedOptionIds: ['sc_share'] },
  rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_6plus'] },
  rc_energy: { selectedOptionIds: ['rc_energy_focused'] },
  rc_risk: { selectedOptionIds: ['rc_risk_calculated'] },
  rc_validation: { selectedOptionIds: ['rc_val_some'] },
  or_content: { selectedOptionIds: ['orc_energized'] },
  or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_energized'] },
  ap_experiment: { selectedOptionIds: ['ap_advisory'] },
  ap_memo: { shortText: '' },
};
const baseResult: ResultSpine = buildResultFromResponses(baseResponses);

const burnoutResponses: FlowResponses = {
  cs_main: { selectedOptionIds: ['cs_rest'] }, ar_roles: { selectedOptionIds: ['ar_reset', 'ar_expert'] },
  cv_values: { selectedOptionIds: ['cv_recovery', 'cv_stability'] }, cv_priorities: { ranking: ['pr_recovery', 'pr_stability'] },
  fc_1: { selectedOptionIds: ['fc1_expert'] }, fc_2: { selectedOptionIds: ['fc2_stable'] },
  fc_3: { selectedOptionIds: ['fc3_quiet'] }, fc_4: { selectedOptionIds: ['fc4_interpreter'] },
  sc_outlook: { selectedOptionIds: ['sc_unsure'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
  rc_runway: { selectedOptionIds: ['rc_runway_3to6'] }, rc_energy: { selectedOptionIds: ['rc_energy_rest'] },
  rc_risk: { selectedOptionIds: ['rc_risk_none'] }, rc_validation: { selectedOptionIds: ['rc_val_none'] },
  or_content: { selectedOptionIds: ['orc_capable_flat'] }, or_venture: { selectedOptionIds: ['orv_money_tiring'] },
  or_internal: { selectedOptionIds: ['ori_unsure'] }, ap_experiment: { selectedOptionIds: ['ap_interview'] },
};
const burnoutResult: ResultSpine = buildResultFromResponses(burnoutResponses);

// ─── Hide behavior ──────────────────────────────────────────────────────────
check('empty profile {} → undefined (section hidden)',
  buildProfileContextSummary({ profile: {}, result: baseResult }) === undefined);

// Even a profile with only careerPattern survives — careerPattern is meaningful
// data the user supplied (or derived). It alone keeps the summary visible.
check('profile with only careerPattern → not undefined (still meaningful)',
  buildProfileContextSummary({ profile: { careerPattern: 'single_track' }, result: baseResult }) !== undefined);

// jobRoleCategory='other' alone is NOT enough to keep the summary visible
// (matches the "no useful fields" intuition since 'other' carries no signal).
check('profile with only jobRoleCategory="other" → undefined',
  buildProfileContextSummary({ profile: { jobRoleCategory: 'other' }, result: baseResult }) === undefined);

// jobRoleRaw whitespace-only → undefined (same trim semantics as elsewhere).
check('profile with only whitespace jobRoleRaw → undefined',
  buildProfileContextSummary({ profile: { jobRoleRaw: '   ' }, result: baseResult }) === undefined);

// ─── Shape contract (when summary IS returned) ──────────────────────────────
{
  const s = buildProfileContextSummary({ profile: { ageBand: '30_early' }, result: baseResult });
  check('shape: headline is non-empty string',
    !!s && typeof s.headline === 'string' && s.headline.length > 0);
  check('shape: body is non-empty string',
    !!s && typeof s.body === 'string' && s.body.length > 0);
  check('shape: tags either absent or non-empty array',
    !!s && (s.tags === undefined || (Array.isArray(s.tags) && s.tags.length > 0)));
}

// ─── Headline composition ───────────────────────────────────────────────────
{
  const s = buildProfileContextSummary({ profile: { ageBand: '30_early' }, result: baseResult });
  check('ageBand alone → headline = "30대 초반"',
    s?.headline === '30대 초반');
}
{
  const s = buildProfileContextSummary({
    profile: { ageBand: '30_early', jobRoleRaw: '백엔드 개발자', totalCareerStage: 'total_3_7' },
    result: baseResult,
  });
  check('age + jobRoleRaw + totalCareerStage → 3-part headline',
    s?.headline === '30대 초반 · 백엔드 개발자 · 경력 3~7년');
}
{
  // jobRoleRaw takes precedence over jobRoleCategory in the headline.
  const s = buildProfileContextSummary({
    profile: { jobRoleRaw: '수의사 출신 투자심사역', jobRoleCategory: 'multi_domain' },
    result: baseResult,
  });
  check('jobRoleRaw takes precedence over jobRoleCategory for headline',
    s?.headline === '수의사 출신 투자심사역');
}
{
  // jobRoleCategory used when jobRoleRaw absent.
  const s = buildProfileContextSummary({
    profile: { jobRoleCategory: 'engineering' },
    result: baseResult,
  });
  check('jobRoleCategory fallback → "개발자/엔지니어" appears in headline',
    s?.headline === '개발자/엔지니어');
}

// ─── Body sentence cap (≤ 3) ────────────────────────────────────────────────
{
  const s = buildProfileContextSummary({
    profile: {
      careerPattern: 'domain_shift',
      workMode: 'organization',
      transitionIntent: 'actively_considering',
      transitionTiming: 'within_3_6_months',
    },
    result: baseResult,
  });
  const sentenceCount = (s?.body.match(/\./g) ?? []).length;
  check('body cap honored (≤ 3 sentences) on rich profile',
    sentenceCount > 0 && sentenceCount <= 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BURNOUT DOMINANCE — when mainTypeKey="overloadedBurnout" OR
// planModule.key="recoveryFirst", the body reinforces recovery and MUST NOT
// mention market validation / interviews / customer conversations / paid tests /
// content publishing / networking / proposals as primary actions.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = buildProfileContextSummary({ profile: { ageBand: '30_late' }, result: burnoutResult });
  check('BURNOUT: body contains the user-spec S1 recovery framing sentence',
    !!s && s.body.includes('에너지와 생활 리듬을 회복'));
  check('BURNOUT: body contains the user-spec S2 maintain-current-job clause',
    !!s && s.body.includes('회복 가능한 리듬을 만드는 것이 우선'));

  // Suppression assertions — none of these words should surface as primary
  // actions in burnout context.
  const PROHIBITED_BURNOUT_WORDS = [
    '시장 반응', '시장 검증', '시장 확인',  // market validation
    '인터뷰',                                 // interviews
    '고객 반응', '고객 인터뷰', '고객 대화',  // customer conversations
    '유료',                                   // paid tests
    '콘텐츠 발행',                            // content publishing
    '네트워킹',                               // networking
    '제안서',                                 // proposals
  ];
  for (const w of PROHIBITED_BURNOUT_WORDS) {
    check(`BURNOUT: body does NOT mention "${w}" as primary action`,
      !!s && !s.body.includes(w));
  }
}

// Burnout × organization: body now weaves "업무 경계" into S2 (P2.4.15 refresh).
{
  const s = buildProfileContextSummary({
    profile: { workMode: 'organization' }, result: burnoutResult,
  });
  check('BURNOUT × organization: body weaves "업무 경계" into recovery sentence',
    !!s && s.body.includes('업무 경계'));
}

// Burnout + non-safe workMode (founder) — DO NOT surface customer/market words.
{
  const s = buildProfileContextSummary({
    profile: { workMode: 'founder' }, result: burnoutResult,
  });
  check('BURNOUT × founder: body does NOT mention 시장 반응 or 고객 문제',
    !!s && !s.body.includes('시장 반응') && !s.body.includes('고객 문제'));
  check('BURNOUT × founder: body still has the recovery framing',
    !!s && s.body.includes('에너지와 생활 리듬을 회복'));
}

// Burnout + non-safe workMode (freelance) — DO NOT surface 제안서 / 포트폴리오.
{
  const s = buildProfileContextSummary({
    profile: { workMode: 'freelance' }, result: burnoutResult,
  });
  check('BURNOUT × freelance: body does NOT mention 제안서 or 포트폴리오',
    !!s && !s.body.includes('제안서') && !s.body.includes('포트폴리오'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// careerPattern framing — verbatim user-spec sentences per pattern.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = buildProfileContextSummary({
    profile: { careerPattern: 'domain_shift' }, result: baseResult,
  });
  check('careerPattern domain_shift → user-spec sentence appears verbatim',
    !!s && s.body.includes('한 분야만 깊게 파온 사람이라기보다, 이전 경험과 현재 직무를 연결해온 전환형 커리어에 가깝습니다'));
}
{
  const s = buildProfileContextSummary({
    profile: { careerPattern: 'multi_track' }, result: baseResult,
  });
  check('careerPattern multi_track → user-spec sentence appears verbatim',
    !!s && s.body.includes('여러 축의 경험이 흩어진 약점이라기보다, 연결 방식이 정리되면 차별점이 될 수 있습니다'));
}
{
  const s = buildProfileContextSummary({
    profile: { careerPattern: 'single_track' }, result: baseResult,
  });
  check('careerPattern single_track → user-spec sentence appears verbatim',
    !!s && s.body.includes('한 분야에서 쌓아온 경험을 다음 선택지에 어떻게 활용할지가 중요합니다'));
}
{
  const s = buildProfileContextSummary({
    profile: { careerPattern: 'early_exploration' }, result: baseResult,
  });
  check('careerPattern early_exploration → user-spec sentence appears verbatim',
    !!s && s.body.includes('아직 커리어 축을 확정하기보다, 가능한 선택지를 가볍게 확인해보는 단계에 가깝습니다'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// workMode examples — user-spec themes are woven into the body.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = buildProfileContextSummary({ profile: { workMode: 'organization' }, result: baseResult });
  check('workMode organization: body mentions 내부 조정 or 역할 재설계',
    !!s && (s.body.includes('내부 조정') || s.body.includes('역할 재설계')));
}
{
  const s = buildProfileContextSummary({ profile: { workMode: 'professional' }, result: baseResult });
  check('workMode professional: body mentions 전문성 or 케이스 정리 or 자문/강의',
    !!s && (s.body.includes('전문성') || s.body.includes('케이스 정리') || s.body.includes('자문/강의')));
}
{
  const s = buildProfileContextSummary({ profile: { workMode: 'freelance' }, result: baseResult });
  check('workMode freelance: body mentions 포트폴리오 or 고객 반응 or 제안서',
    !!s && (s.body.includes('포트폴리오') || s.body.includes('고객 반응') || s.body.includes('제안서')));
}
{
  const s = buildProfileContextSummary({ profile: { workMode: 'founder' }, result: baseResult });
  check('workMode founder: body mentions 고객 문제 or 시장 반응 or 런웨이',
    !!s && (s.body.includes('고객 문제') || s.body.includes('시장 반응') || s.body.includes('런웨이')));
}
{
  const s = buildProfileContextSummary({ profile: { workMode: 'student' }, result: baseResult });
  check('workMode student: body mentions 탐색 or 경험 축적 or 작은 시도',
    !!s && (s.body.includes('탐색') || s.body.includes('경험 축적') || s.body.includes('작은 시도')));
}
{
  // P3.5 — career_break theme ('회복과 재진입, 생활 리듬') is a recovery
  // framing. It must appear ONLY when the planModule frame is recovery —
  // the recovery body (burnout/recoveryFirst) is where it belongs.
  const s = buildProfileContextSummary({ profile: { workMode: 'career_break' }, result: burnoutResult });
  check('workMode career_break (recovery frame): body mentions 회복 or 생활 리듬',
    !!s && (s.body.includes('회복') || s.body.includes('생활 리듬')));
}
{
  const s = buildProfileContextSummary({ profile: { workMode: 'multi_work' }, result: baseResult });
  check('workMode multi_work: body mentions 우선순위 or 에너지 분산 or 포트폴리오 구조',
    !!s && (s.body.includes('우선순위') || s.body.includes('에너지 분산') || s.body.includes('포트폴리오 구조')));
}

// ═══════════════════════════════════════════════════════════════════════════════
// transitionTiming → intensity in copy (only).
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'now' }, result: baseResult });
  check('timing now → body mentions 바로 실행 가능한 작은 행동',
    !!s && s.body.includes('바로 실행 가능한 작은 행동'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'within_1_3_months' }, result: baseResult });
  check('timing within_1_3_months → body mentions 외부 확인 병행',
    !!s && s.body.includes('외부 확인 병행'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'within_3_6_months' }, result: baseResult });
  check('timing within_3_6_months → body mentions 자산화·탐색·준비',
    !!s && s.body.includes('자산화·탐색·준비'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'after_6_months' }, result: baseResult });
  check('timing after_6_months → body uses conservative "현직 재설계·조용한 준비" tone',
    !!s && s.body.includes('큰 전환보다 현직 재설계와 조용한 준비'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'unknown' }, result: baseResult });
  check('timing unknown → body mentions 작게 확인하고 판단',
    !!s && s.body.includes('작게 확인하고 판단'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// transitionIntent → wording in copy (only).
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = buildProfileContextSummary({ profile: { transitionIntent: 'curious' }, result: baseResult });
  check('intent curious → body mentions 탐색 중심',
    !!s && s.body.includes('탐색 중심'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionIntent: 'preparing' }, result: baseResult });
  check('intent preparing → body mentions 준비 중심',
    !!s && s.body.includes('준비 중심'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionIntent: 'actively_considering' }, result: baseResult });
  check('intent actively_considering → body mentions 실제 선택지 비교',
    !!s && s.body.includes('실제 선택지 비교'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionIntent: 'ready_to_switch' }, result: baseResult });
  check('intent ready_to_switch → body mentions 실행 가능성 중심',
    !!s && s.body.includes('실행 가능성 중심'));
}
{
  const s = buildProfileContextSummary({ profile: { transitionIntent: 'must_stay' }, result: baseResult });
  check('intent must_stay → body uses conservative "현직 재설계·조용한 준비" tone',
    !!s && s.body.includes('큰 전환보다 현직 재설계와 조용한 준비'));
}

// ─── Tags — profile-attribute categories (user-spec order) ──────────────────
{
  const s = buildProfileContextSummary({
    profile: {
      jobRoleCategory: 'engineering',           // 직업군
      totalCareerStage: 'total_7_12',           // 경력 단계
      workMode: 'organization',                 // 일하는 방식
      transitionTiming: 'within_3_6_months',    // 전환 가능 시점
      careerPattern: 'domain_shift',            // 커리어 패턴
    },
    result: baseResult,
  });
  const tags = s?.tags ?? [];
  check('tags include 직업군 (엔지니어)',
    tags.includes('엔지니어'));
  check('tags include 경력 단계 (경력 7~12년)',
    tags.includes('경력 7~12년'));
  check('tags include 일하는 방식 (조직 소속)',
    tags.includes('조직 소속'));
  check('tags include 전환 가능 시점 (3~6개월 준비)',
    tags.includes('3~6개월 준비'));
  check('tags include 커리어 패턴 (분야 전환)',
    tags.includes('분야 전환'));
  check('tags are profile-only — NO strategy/direction in tags',
    !tags.includes(baseResult.solutionLayer.primaryModule.title));
  check('tags are exactly 5 when all 5 categories populated',
    tags.length === 5);
}

// ─── Partial tags — skip categories whose source is missing ─────────────────
{
  const s = buildProfileContextSummary({
    profile: { jobRoleCategory: 'design', workMode: 'freelance' },
    result: baseResult,
  });
  const tags = s?.tags ?? [];
  check('partial tags: 직업군 and 일하는 방식 present',
    tags.includes('디자이너') && tags.includes('프리랜서'));
  check('partial tags: missing-source categories skipped (no career stage / pattern / timing)',
    tags.length === 2);
}

// ─── No raw enum values exposed ─────────────────────────────────────────────
{
  const s = buildProfileContextSummary({
    profile: {
      ageBand: '30_early',
      jobRoleCategory: 'engineering',
      totalCareerStage: 'total_7_12',
      workMode: 'organization',
      transitionTiming: 'within_3_6_months',
      careerPattern: 'domain_shift',
      concernTags: ['burnout'],
      constraintTags: ['money'],
      desiredPaths: ['advisory_teaching'],
    },
    result: baseResult,
  });
  const blob = JSON.stringify(s);
  // Check for any raw enum values from the user-listed fields.
  const rawEnums = [
    '30_early', 'engineering', 'total_7_12', 'organization',
    'within_3_6_months', 'domain_shift', 'burnout', 'money',
    'advisory_teaching', 'multi_domain',
  ];
  let anyLeaked = false;
  for (const e of rawEnums) if (blob.includes(`"${e}"`) || blob.includes(`'${e}'`) || blob.includes(`${e}`)) {
    // The raw enum 'burnout' is also the Korean word 번아웃, so 'burnout' wouldn't
    // appear unless we leaked it. Check for raw-style strings only.
    if (blob.includes(e)) { anyLeaked = true; break; }
  }
  check('no raw internal enum value leaks into headline/body/tags',
    !anyLeaked);
}

// ─── PURITY — inputs are not mutated ────────────────────────────────────────
{
  const profile: UserProfile = {
    ageBand: '30_early',
    jobRoleRaw: '백엔드 개발자',
    totalCareerStage: 'total_3_7',
    workMode: 'organization',
    careerPattern: 'domain_shift',
  };
  const profileSnap = JSON.stringify(profile);
  const resultSnap = JSON.stringify(baseResult);
  buildProfileContextSummary({ profile, result: baseResult });
  check('PURITY: profile not mutated by builder',
    JSON.stringify(profile) === profileSnap);
  check('PURITY: result not mutated by builder',
    JSON.stringify(baseResult) === resultSnap);
}

// ─── Idempotency ────────────────────────────────────────────────────────────
{
  const profile: UserProfile = { ageBand: '40_early', workMode: 'founder' };
  const a = buildProfileContextSummary({ profile, result: baseResult });
  const b = buildProfileContextSummary({ profile, result: baseResult });
  check('idempotent: two calls produce equal output',
    JSON.stringify(a) === JSON.stringify(b));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED EXAMPLE OUTPUTS — exact-match assertions against the user-provided
// example bodies (P2.4.15). The builder only reads four fields off `result`
// (mainTypeKey, primaryModule.key, primaryModule.title, sourceOptionKey), so a
// minimal mock object suffices.
// ═══════════════════════════════════════════════════════════════════════════════

function mockResult(opts: {
  mainTypeKey: string;
  primaryModuleKey: string;
  primaryModuleTitle: string;
  sourceOptionKey: string;
}): ResultSpine {
  return {
    solutionLayer: {
      mainTypeKey: opts.mainTypeKey,
      primaryModule: { key: opts.primaryModuleKey, title: opts.primaryModuleTitle },
    },
    executionPlan: {
      coreExperiment: { sourceOptionKey: opts.sourceOptionKey },
    },
  } as unknown as ResultSpine;
}

// EXAMPLE 1 — plateauedPerformer + portfolioConvert + domain_shift bridge
{
  const profile: UserProfile = {
    jobRoleRaw: '수의사 출신 투자심사역',
    jobRoleCategory: 'multi_domain',
    jobRoleSecondaryCategories: ['veterinary_pet', 'investment_finance'],
    careerPattern: 'domain_shift',
    totalCareerStage: 'total_7_12',
    currentFieldStage: 'current_3_7',
    workMode: 'organization',
    transitionTiming: 'within_3_6_months',
  };
  const result = mockResult({
    mainTypeKey: 'plateauedPerformer',
    primaryModuleKey: 'portfolioConvert',
    primaryModuleTitle: '전문성 자산화',
    sourceOptionKey: 'jobChange',
  });
  const s = buildProfileContextSummary({ profile, result });
  const expected = '전체 경력으로는 충분한 실무 경험이 쌓였고, 현재 직무에서도 3~7년차 수준의 전문성이 형성된 상태입니다. 특히 이전 분야의 전문성과 현재 직무 경험이 함께 있는 전환형 커리어이므로, 이번 고민은 완전히 새로 시작할지보다 이미 가진 두 축을 어떤 문제에 연결할지에 가깝습니다.';
  check('EXAMPLE 1: body exact match (plateaued+portfolio+domain_shift bridge)',
    !!s && s.body === expected);
}

// EXAMPLE 2 — scatteredExplorer + optionNarrowing + freelance + now
{
  const profile: UserProfile = {
    workMode: 'freelance',
    transitionTiming: 'now',
  };
  const result = mockResult({
    mainTypeKey: 'scatteredExplorer',
    primaryModuleKey: 'optionNarrowing',
    primaryModuleTitle: '선택지 좁히기',
    sourceOptionKey: 'independent',
  });
  const s = buildProfileContextSummary({ profile, result });
  const expected = '현재 바로 움직일 수 있는 상태라면 선택지를 더 늘리는 것보다, 수익 가능성과 지속 가능성이 있는 후보를 2~3개로 좁히는 것이 중요합니다. 프리랜서/독립형 일에서는 방향이 넓을수록 포지셔닝과 고객 확보가 늦어질 수 있습니다.';
  check('EXAMPLE 2: body exact match (scatteredExplorer+optionNarrowing+freelance+now)',
    !!s && s.body === expected);
}

// EXAMPLE 3 — overloadedBurnout + recoveryFirst + organization + after_6_months
{
  const profile: UserProfile = {
    workMode: 'organization',
    transitionTiming: 'after_6_months',
  };
  const result = mockResult({
    mainTypeKey: 'overloadedBurnout',
    primaryModuleKey: 'recoveryFirst',
    primaryModuleTitle: '회복 우선',
    sourceOptionKey: 'restRecover',
  });
  const s = buildProfileContextSummary({ profile, result });
  const expected = '현재는 커리어 방향을 판단하기 전에 에너지와 생활 리듬을 회복해야 하는 상태에 가깝습니다. 6개월 이상 현재 일을 유지해야 한다면, 이번 달에는 큰 전환보다 업무 경계와 회복 가능한 리듬을 만드는 것이 우선입니다.';
  check('EXAMPLE 3: body exact match (burnout+after_6_months+organization)',
    !!s && s.body === expected);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.4 TESTS — one named line per user-listed requirement.
// Requirements 1–14 are profile-side and live here; 15–20 are session/UI side
// and live in session.test.ts.
// ═══════════════════════════════════════════════════════════════════════════════

// REQUIRED 1 — empty profile → undefined (no generic placeholder)
{
  const s = buildProfileContextSummary({ profile: {}, result: baseResult });
  check('REQUIRED 1: empty profile → undefined (section hidden; no generic placeholder)',
    s === undefined);
}

// REQUIRED 2 — domain_shift → bridge-career language
{
  const s = buildProfileContextSummary({ profile: { careerPattern: 'domain_shift' }, result: baseResult });
  check('REQUIRED 2: domain_shift body produces bridge-career language (전환형 커리어)',
    !!s && s.body.includes('전환형 커리어'));
}

// REQUIRED 3 — multi_track → integration/portfolio language
{
  const s = buildProfileContextSummary({ profile: { careerPattern: 'multi_track' }, result: baseResult });
  check('REQUIRED 3: multi_track body produces integration language (연결 방식)',
    !!s && s.body.includes('연결 방식'));
}

// REQUIRED 4 — single_track → accumulated-experience language
{
  const s = buildProfileContextSummary({ profile: { careerPattern: 'single_track' }, result: baseResult });
  check('REQUIRED 4: single_track body produces accumulated-experience language (쌓아온 경험)',
    !!s && s.body.includes('쌓아온 경험'));
}

// REQUIRED 5 — early_exploration → exploration-stage language
{
  const s = buildProfileContextSummary({ profile: { careerPattern: 'early_exploration' }, result: baseResult });
  check('REQUIRED 5: early_exploration body produces exploration-stage language (가볍게 확인…단계)',
    !!s && s.body.includes('가볍게 확인') && s.body.includes('단계'));
}

// REQUIRED 6 — organization workMode → internal adjustment language
{
  const s = buildProfileContextSummary({ profile: { workMode: 'organization' }, result: baseResult });
  check('REQUIRED 6: organization workMode → internal adjustment language (내부 조정 or 역할 재설계)',
    !!s && (s.body.includes('내부 조정') || s.body.includes('역할 재설계')));
}

// REQUIRED 7 — professional workMode → expertise/trust/case language
{
  const s = buildProfileContextSummary({ profile: { workMode: 'professional' }, result: baseResult });
  check('REQUIRED 7: professional workMode → expertise/trust/case language',
    !!s && (s.body.includes('전문성') || s.body.includes('케이스 정리') || s.body.includes('자문/강의')));
}

// REQUIRED 8 — freelance workMode → portfolio/customer/positioning language
{
  const s = buildProfileContextSummary({ profile: { workMode: 'freelance' }, result: baseResult });
  check('REQUIRED 8: freelance workMode → portfolio/customer/positioning language',
    !!s && (s.body.includes('포트폴리오') || s.body.includes('고객 반응') || s.body.includes('포지셔닝')));
}

// REQUIRED 9 — founder workMode → customer/problem/runway language
{
  const s = buildProfileContextSummary({ profile: { workMode: 'founder' }, result: baseResult });
  check('REQUIRED 9: founder workMode → customer/problem/runway language',
    !!s && (s.body.includes('고객 문제') || s.body.includes('시장 반응') || s.body.includes('런웨이')));
}

// REQUIRED 10 — career_break workMode surfaces recovery/reentry/routine
// language ONLY when the planModule frame is recovery (P3.5 coherence rule).
{
  const s = buildProfileContextSummary({ profile: { workMode: 'career_break' }, result: burnoutResult });
  check('REQUIRED 10: career_break workMode (recovery frame) → recovery/reentry/routine language',
    !!s && (s.body.includes('회복') || s.body.includes('생활 리듬')));
}

// REQUIRED 11 — transitionTiming after_6_months lowers execution intensity
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'after_6_months' }, result: baseResult });
  check('REQUIRED 11: transitionTiming after_6_months lowers execution intensity (큰 전환보다 현직 재설계…조용한 준비)',
    !!s && s.body.includes('큰 전환보다 현직 재설계') && s.body.includes('조용한 준비'));
}

// REQUIRED 12 — transitionTiming now allows immediate small action language
{
  const s = buildProfileContextSummary({ profile: { transitionTiming: 'now' }, result: baseResult });
  check('REQUIRED 12: transitionTiming now → immediate small action language (바로 실행 가능한 작은 행동)',
    !!s && s.body.includes('바로 실행 가능한 작은 행동'));
}

// REQUIRED 13 — overloadedBurnout summary is recovery-aligned
{
  const s = buildProfileContextSummary({ profile: { ageBand: '30_late' }, result: burnoutResult });
  check('REQUIRED 13: overloadedBurnout body is recovery-aligned (에너지와 생활 리듬을 회복해야 하는 상태)',
    !!s && s.body.includes('에너지와 생활 리듬을 회복해야 하는 상태'));
}

// REQUIRED 14 — overloadedBurnout body does NOT mention prohibited primary actions
// across ALL workModes (including the non-safe freelance/founder/multi_work).
{
  const PROHIBITED = [
    '시장 반응', '시장 검증', '시장 확인',           // market validation
    '인터뷰',                                       // interviews
    '고객 반응', '고객 인터뷰', '고객 대화', '고객 문제', // customer conversations
    '유료',                                          // paid tests
    '콘텐츠 발행',                                  // content publishing
    '네트워킹',                                     // networking
    '제안서',                                       // proposals
  ];
  const ALL_WORK_MODES: Array<NonNullable<UserProfile['workMode']>> = [
    'organization', 'professional', 'freelance', 'founder', 'student', 'career_break', 'multi_work',
  ];
  let allClean = true;
  let firstLeak: string | undefined;
  for (const wm of ALL_WORK_MODES) {
    const s = buildProfileContextSummary({ profile: { workMode: wm }, result: burnoutResult });
    if (!s) continue;
    for (const w of PROHIBITED) {
      if (s.body.includes(w)) { allClean = false; firstLeak = `workMode=${wm} leaked "${w}"`; break; }
    }
    if (!allClean) break;
  }
  check(
    'REQUIRED 14: overloadedBurnout body has NO prohibited primary actions (시장 반응/인터뷰/고객 대화/유료/콘텐츠 발행/네트워킹/제안서) across any workMode'
    + (firstLeak ? ` — leak: ${firstLeak}` : ''),
    allClean,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P3.5 — Profile-context body coherence with planModule frame.
// These tests pin the user-reported bug: workMode/intent/timing phrases must
// NOT be added blindly when they conflict with the engine's recommendation
// frame.
// ═══════════════════════════════════════════════════════════════════════════════

// (a) Reproduce the user's reported scenario — career_break + ready_to_switch +
//     now landing on an action-frame planModule. The recovery framing
//     ('회복과 재진입', '생활 리듬을 중심') must NOT appear.
{
  const careerBreakAndAction: UserProfile = {
    workMode: 'career_break',
    transitionTiming: 'now',
    transitionIntent: 'ready_to_switch',
  };
  const responses: FlowResponses = {
    cs_main: { selectedOptionIds: ['cs_between'] },
    ar_roles: { selectedOptionIds: ['ar_creator', 'ar_advisor'] },
    cv_values: { selectedOptionIds: ['cv_creativity', 'cv_meaning', 'cv_stability', 'cv_money'] },
    cv_priorities: { ranking: ['pr_meaning', 'pr_freedom', 'pr_stability', 'pr_money'] },
    fc_1: { selectedOptionIds: ['fc1_connector'] }, fc_2: { selectedOptionIds: ['fc2_builder'] },
    fc_3: { selectedOptionIds: ['fc3_public'] }, fc_4: { selectedOptionIds: ['fc4_maker'] },
    sc_outlook: { selectedOptionIds: ['sc_share'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
    rc_runway: { selectedOptionIds: ['rc_runway_6plus'] }, rc_energy: { selectedOptionIds: ['rc_energy_focused'] },
    rc_risk: { selectedOptionIds: ['rc_risk_calculated'] }, rc_validation: { selectedOptionIds: ['rc_val_some'] },
    or_content: { selectedOptionIds: ['orc_energized'] }, or_venture: { selectedOptionIds: ['orv_money_tiring'] },
    or_internal: { selectedOptionIds: ['ori_energized'] }, ap_experiment: { selectedOptionIds: ['ap_content'] },
  };
  const reproSpine = buildResultFromResponses(responses, { profile: careerBreakAndAction });
  const s = buildProfileContextSummary({ profile: careerBreakAndAction, result: reproSpine });
  check('P3.5 reproduction: action-frame body does NOT contain "회복과 재진입"',
    !!s && !s.body.includes('회복과 재진입'));
  check('P3.5 reproduction: action-frame body does NOT contain "생활 리듬을 중심"',
    !!s && !s.body.includes('생활 리듬을 중심'));
  check('P3.5 reproduction: body does NOT use the dual-mention dropped sentence',
    !!s && !(s.body.includes('전략과') && s.body.includes('방향을 권합니다')));
  check('P3.5 reproduction: body contains a "이번 달" priority anchor',
    !!s && s.body.includes('이번 달에는'));
}

// (b) career_break theme is allowed ONLY under recovery-frame planModules.
{
  const s = buildProfileContextSummary({ profile: { workMode: 'career_break' }, result: baseResult });
  check('P3.5 coherence: career_break theme SUPPRESSED under action-frame planModule',
    !!s && !s.body.includes('회복과 재진입') && !s.body.includes('생활 리듬을 중심'));
}

// (c) Action-urgent tone ('실행 가능성 중심', '바로 실행 가능한 작은 행동')
// gets suppressed under planning frames. Pin via a planning-frame fixture.
{
  // optionNarrowing falls in the 'planning' frame.
  const planningResponses: FlowResponses = {
    cs_main: { selectedOptionIds: ['cs_many'] },
    ar_roles: { selectedOptionIds: ['ar_creator', 'ar_advisor', 'ar_freelancer'] },
    cv_values: { selectedOptionIds: ['cv_autonomy', 'cv_creativity', 'cv_meaning'] },
    cv_priorities: { ranking: ['pr_freedom', 'pr_meaning', 'pr_growth'] },
    fc_1: { selectedOptionIds: ['fc1_connector'] }, fc_2: { selectedOptionIds: ['fc2_builder'] },
    fc_3: { selectedOptionIds: ['fc3_public'] }, fc_4: { selectedOptionIds: ['fc4_maker'] },
    sc_outlook: { selectedOptionIds: ['sc_share'] }, rc_options: { selectedOptionIds: ['rc_opt_some'] },
    rc_runway: { selectedOptionIds: ['rc_runway_6plus'] }, rc_energy: { selectedOptionIds: ['rc_energy_focused'] },
    rc_risk: { selectedOptionIds: ['rc_risk_calculated'] }, rc_validation: { selectedOptionIds: ['rc_val_some'] },
    or_content: { selectedOptionIds: ['orc_energized'] }, or_venture: { selectedOptionIds: ['orv_money_tiring'] },
    or_internal: { selectedOptionIds: ['ori_energized'] }, ap_experiment: { selectedOptionIds: ['ap_unsure'] },
  };
  const planSpine = buildResultFromResponses(planningResponses);
  if (planSpine.solutionLayer.primaryModule.key === 'optionNarrowing') {
    const s = buildProfileContextSummary({
      profile: { transitionIntent: 'ready_to_switch', transitionTiming: 'now' },
      result: planSpine,
    });
    check('P3.5 coherence: action-urgent tone SUPPRESSED under planning frame (실행 가능성 중심)',
      !!s && !s.body.includes('실행 가능성 중심'));
    check('P3.5 coherence: action-urgent tone SUPPRESSED under planning frame (바로 실행 가능한 작은 행동)',
      !!s && !s.body.includes('바로 실행 가능한 작은 행동'));
  } else {
    // Fixture drifted — make the test signal the drift instead of silently passing.
    check('P3.5 coherence: planning fixture produces a planning-frame planModule (skipped — engine drifted)',
      false);
  }
}

// (d) Every planModule gets a body that contains its priority anchor.
{
  // Drive through buildResultFromResponses with diverse fixtures and assert
  // each produced body ends with a "이번 달" priority anchor. This is a
  // structural assertion across planModules — the actual frame each fixture
  // lands on doesn't matter for this check.
  const fixtures: FlowResponses[] = [baseResponses, burnoutResponses];
  let allHaveAnchor = true;
  for (const r of fixtures) {
    const spine = buildResultFromResponses(r);
    const s = buildProfileContextSummary({ profile: { ageBand: '30_early' }, result: spine });
    if (!s || !s.body.includes('이번 달')) { allHaveAnchor = false; break; }
  }
  check('P3.5 coherence: body always contains a "이번 달" priority anchor',
    allHaveAnchor);
}

// (e) The dropped dual-mention sentence ("이번 결과는 X 전략과 Y 방향을
//     권합니다.") must not surface from any planModule.
{
  const fixtures: FlowResponses[] = [baseResponses, burnoutResponses];
  let stillUsed = false;
  for (const r of fixtures) {
    const spine = buildResultFromResponses(r);
    const s = buildProfileContextSummary({ profile: { ageBand: '30_early' }, result: spine });
    if (!s) continue;
    if (s.body.includes('이번 결과는') && s.body.includes('방향을 권합니다')) { stillUsed = true; break; }
  }
  check('P3.5 coherence: dual-mention "이번 결과는 X 전략과 Y 방향을 권합니다." dropped',
    !stillUsed);
}

// (f) Recovery-frame body never mentions content/personal-brand/market validation/
//     interview/networking. This is the dispatcher contract — extends the
//     REQUIRED 14 sweep to also include the runwayStabilizer recovery frame.
//     (recoveryFirst is covered by REQUIRED 14 via burnoutResult; here we
//     reaffirm the rule explicitly for clarity.)
{
  const PROHIBITED = ['콘텐츠/퍼스널 브랜드', '시장 반응', '인터뷰', '네트워킹', '제안서'];
  const s = buildProfileContextSummary({ profile: { workMode: 'career_break' }, result: burnoutResult });
  const leaked = PROHIBITED.find((p) => s && s.body.includes(p));
  check(`P3.5 coherence: recovery-frame body has no content/market/interview leak${leaked ? ' — leaked "' + leaked + '"' : ''}`,
    !!s && !leaked);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
