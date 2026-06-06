// Career Compass 2.0 — P2.3 Job role normalization.
//
// Converts the user's free-text `jobRoleRaw` into a standardized
// {category, subcategory, secondaryCategories} triple. The output is intended
// for: (a) profile normalization, (b) future report personalization, and
// (c) future analytics segmentation.
//
// ─── HARD INVARIANT ──────────────────────────────────────────────────────────
// The output of this module MUST NOT be consumed by any career-routing path:
//   • Not by classifyMainType / selectSolutionModules / deriveActiveLenses /
//     resolveClosingLine / sourceOptionKey resolver / planModule routing /
//     bestMove selection / EXPERIMENT_HOME_MODULE.
//   • Not by any vector / construct / gate / score effects.
//   • Not by any P1.x invariant (especially P1.7 burnout).
// It exists ONLY on the profile metadata. The routing-safety fingerprint tests
// in session.test.ts enforce this contract at the engine boundary.
//
// Pure function: no I/O, no telemetry, no DOM.

// ─── Canonical taxonomy ──────────────────────────────────────────────────────
// Exported as a string union so callers can refer to specific values, but the
// UserProfile fields themselves stay loosely typed (`string`) to allow future
// expansion without a type-cascade. Tests assert specific values directly.

// Canonical taxonomy — these 19 categories are the closed set the user spec
// defines. Any input that doesn't match a category falls through to 'other'.
export type JobRoleCategory =
  | 'marketing'
  | 'design'
  | 'engineering'
  | 'product_planning'
  | 'business_strategy'
  | 'investment_finance'
  | 'healthcare_medical'
  | 'veterinary_pet'
  | 'research_academia'
  | 'education'
  | 'content_media'
  | 'sales_business_development'
  | 'operations'
  | 'legal_accounting'
  | 'beauty_wellness'
  | 'founder_entrepreneur'
  | 'student_jobseeker'
  | 'multi_domain'
  | 'other';

// Subcategories — strict interpretation of the user spec: only the categories
// with explicitly listed subcategories emit a subcategory. The other categories
// (product_planning, business_strategy, sales_business_development, operations,
// legal_accounting, beauty_wellness, student_jobseeker, multi_domain, other)
// produce a category-only result.
export type JobRoleSubcategory =
  // marketing
  | 'brand_marketing' | 'performance_marketing' | 'content_marketing' | 'growth_marketing'
  // design
  | 'ux_ui' | 'brand_design' | 'product_design' | 'graphic_design'
  // engineering
  | 'frontend' | 'backend' | 'data_ai' | 'mobile' | 'devops'
  // investment_finance
  | 'vc' | 'pe' | 'equity_research' | 'asset_management' | 'corporate_finance'
  // healthcare_medical
  | 'doctor' | 'nurse' | 'pharmacist' | 'clinical_research' | 'healthcare_business'
  // veterinary_pet
  | 'veterinarian' | 'vet_nurse' | 'pet_industry' | 'animal_health'
  // research_academia
  | 'researcher' | 'professor' | 'graduate_researcher' | 'rnd'
  // education
  | 'teacher' | 'instructor' | 'education_business'
  // content_media
  | 'creator' | 'writer' | 'editor' | 'media_producer'
  // founder_entrepreneur
  | 'founder' | 'ceo' | 'small_business_owner';

// P2.3 — The return shape uses the SAME field names as UserProfile so callers
// can spread it directly onto the profile (`{ ...profile, ...normalizeJobRole(raw) }`).
// jobRoleSubcategory and jobRoleSecondaryCategories are optional — omitted when
// the normalizer has no signal for them, NOT set to undefined explicitly.
export interface NormalizedJobRole {
  jobRoleCategory: JobRoleCategory;
  jobRoleSubcategory?: JobRoleSubcategory;
  jobRoleSecondaryCategories?: JobRoleCategory[];
}

// ─── Matcher table ───────────────────────────────────────────────────────────
// Each entry maps a category (+ optional subcategory) to substring patterns.
// Pattern matching is case-insensitive substring (after lowercase + trim).
//
// IMPORTANT — order is significant only for ties. The primary category is
// chosen by the RIGHTMOST match position in the input text (Korean noun-phrase
// "head noun" is usually at the right). The subcategory is then picked from
// any matcher whose category equals the primary, preferring the entry with a
// subcategory over the generic category-only matcher.
//
// To add a new role: add a new entry. To split an existing role into finer
// subcategories: add subcategory-bearing entries; the generic entry can stay
// as the fallback.

interface JobRoleMatcher {
  category: JobRoleCategory;
  subcategory?: JobRoleSubcategory;
  patterns: string[];
}

const MATCHERS: JobRoleMatcher[] = [
  // marketing
  { category: 'marketing', subcategory: 'performance_marketing', patterns: ['퍼포먼스 마케팅', 'performance marketing', '퍼포먼스 마케터'] },
  { category: 'marketing', subcategory: 'content_marketing',     patterns: ['콘텐츠 마케팅', '콘텐츠 마케터', 'content marketing', 'content marketer'] },
  { category: 'marketing', subcategory: 'brand_marketing',       patterns: ['브랜드 마케팅', '브랜드 마케터', 'brand marketing', 'brand marketer'] },
  { category: 'marketing', subcategory: 'growth_marketing',      patterns: ['그로스 마케팅', '그로스 마케터', '그로스', 'growth marketing', 'growth marketer'] },
  { category: 'marketing',                                        patterns: ['마케터', '마케팅', 'marketer', 'marketing'] },

  // design
  { category: 'design', subcategory: 'product_design', patterns: ['프로덕트 디자이너', 'product designer', '서비스 디자이너'] },
  { category: 'design', subcategory: 'ux_ui',          patterns: ['ux/ui 디자이너', 'ux ui 디자이너', 'ux 디자이너', 'ui 디자이너', 'ux/ui designer', 'ux designer', 'ui designer', 'user experience'] },
  { category: 'design', subcategory: 'brand_design',   patterns: ['브랜드 디자이너', 'brand designer', 'bx 디자이너'] },
  { category: 'design', subcategory: 'graphic_design', patterns: ['그래픽 디자이너', 'graphic designer'] },
  // 모션 디자이너 etc. are NOT in the user-listed subcategory set → fall through
  // to the generic design matcher (category only).
  { category: 'design',                                 patterns: ['디자이너', '디자인', 'designer', 'design'] },

  // engineering — data_ai collapses the old data category in here per user spec.
  { category: 'engineering', subcategory: 'backend',  patterns: ['백엔드', 'backend', 'back-end', '서버 개발', 'server engineer'] },
  { category: 'engineering', subcategory: 'frontend', patterns: ['프론트엔드', '프론트 엔드', 'frontend', 'front-end', '웹 개발'] },
  { category: 'engineering', subcategory: 'data_ai',  patterns: [
      '데이터 사이언티스트', 'data scientist',
      '데이터 분석가', '데이터 분석', 'data analyst', 'data analytics',
      '머신러닝 엔지니어', 'machine learning engineer', 'ml engineer', ' mle ',
      'ai 엔지니어', 'ml 엔지니어', 'ai engineer', 'machine learning',
      '데이터 엔지니어', 'data engineer',
      '데이터',
  ] },
  { category: 'engineering', subcategory: 'mobile',   patterns: ['모바일 개발', 'ios 개발', 'android 개발', 'ios 엔지니어', 'android 엔지니어', 'mobile engineer', 'mobile developer', '앱 개발자'] },
  { category: 'engineering', subcategory: 'devops',   patterns: ['devops', 'sre', '인프라 엔지니어', 'site reliability'] },
  // 풀스택, 보안, QA, 일반 개발자 → no listed subcategory → category only.
  { category: 'engineering',                           patterns: ['개발자', '엔지니어', 'engineer', 'developer', 'programmer', '프로그래머', 'swe', '풀스택', 'fullstack', 'full-stack', 'full stack'] },

  // product_planning (no user-listed subcategories → category only).
  // ' pm '/' po ' use both-space anchors so they match standalone "PM"/"PO"
  // after input padding but NOT inside words like "pmo" or "spam".
  { category: 'product_planning', patterns: ['프로덕트 매니저', 'product manager', 'product owner', '서비스 기획', '기획자', 'service planner', ' pm ', ' po ', '기획'] },

  // business_strategy (no user-listed subcategories → category only)
  { category: 'business_strategy', patterns: ['경영 컨설턴트', '전략 컨설턴트', 'management consultant', 'strategy consultant', '컨설턴트', 'consultant', 'advisor', '자문', 'business strategist', '전략 기획'] },

  // investment_finance
  { category: 'investment_finance', subcategory: 'vc',                patterns: [' vc ', '벤처캐피탈', '벤처 캐피탈', 'venture capital', '투자심사역', '심사역', '투자 심사', 'venture capitalist'] },
  { category: 'investment_finance', subcategory: 'pe',                patterns: [' pe ', 'private equity', '사모 펀드', '사모펀드'] },
  // 애널리스트 alone is broad ("analyst") but per user spec it routes to
  // equity_research — financial-research is the closest canonical home.
  { category: 'investment_finance', subcategory: 'equity_research',   patterns: ['equity research', '리서치 애널리스트', 'research analyst', '애널리스트'] },
  { category: 'investment_finance', subcategory: 'asset_management',  patterns: ['자산 운용', 'asset management', 'fund manager', '펀드 매니저'] },
  { category: 'investment_finance', subcategory: 'corporate_finance', patterns: ['investment banker', 'investment banking', ' ib ', '재무 기획', 'corporate finance'] },
  // 회계사, 세무사 → legal_accounting per user spec (not under investment_finance)
  // Generic finance / financial analyst → category-only investment_finance
  { category: 'investment_finance',                                    patterns: ['재무', '금융', 'finance', 'financial analyst'] },

  // healthcare_medical
  { category: 'healthcare_medical', subcategory: 'clinical_research',   patterns: ['임상 시험', '임상 연구', 'clinical research', 'clinical trial'] },
  { category: 'healthcare_medical', subcategory: 'healthcare_business', patterns: ['의료 경영', '병원 행정', 'healthcare business', 'hospital admin'] },
  { category: 'healthcare_medical', subcategory: 'pharmacist',          patterns: ['약사', 'pharmacist'] },
  { category: 'healthcare_medical', subcategory: 'nurse',               patterns: ['간호사', 'nurse'] },
  { category: 'healthcare_medical', subcategory: 'doctor',              patterns: ['의사', 'physician', 'doctor'] },
  // 한의사, 치과의사 — no user-listed subcategory → category only.
  { category: 'healthcare_medical',                                      patterns: ['한의사', '한방', '치과의사', 'dentist'] },

  // veterinary_pet — includes Korean neologisms like 수의테크 (vet-tech) and
  // 펫산업 (pet industry) per the user-spec examples.
  { category: 'veterinary_pet', subcategory: 'veterinarian',  patterns: ['수의사', 'veterinarian', 'veterinary'] },
  { category: 'veterinary_pet', subcategory: 'vet_nurse',     patterns: ['수의 간호사', '동물 간호사', 'vet nurse', 'veterinary nurse'] },
  { category: 'veterinary_pet', subcategory: 'pet_industry',  patterns: ['펫산업', '펫 산업', '반려동물 산업', '반려동물산업', 'pet industry', '반려동물 업계', '펫업계'] },
  { category: 'veterinary_pet', subcategory: 'animal_health', patterns: ['수의테크', '수의 테크', '동물 보건', '동물보건', 'animal health', 'vet tech', 'vettech'] },
  { category: 'veterinary_pet',                                patterns: ['동물병원', '반려동물', '펫 케어', 'pet care'] },

  // research_academia
  { category: 'research_academia', subcategory: 'professor',           patterns: ['교수', 'professor'] },
  { category: 'research_academia', subcategory: 'rnd',                 patterns: ['연구개발', 'r&d', 'rnd', 'r and d'] },
  { category: 'research_academia', subcategory: 'graduate_researcher', patterns: ['대학원생', '박사 과정', 'phd student', 'phd 과정', 'graduate researcher'] },
  { category: 'research_academia', subcategory: 'researcher',          patterns: ['연구원', '연구자', 'researcher', 'scientist'] },

  // education
  { category: 'education', subcategory: 'education_business', patterns: ['교육 사업', '학원장', 'education business', '교육 스타트업'] },
  { category: 'education', subcategory: 'instructor',         patterns: ['강사', 'instructor', 'lecturer'] },
  { category: 'education', subcategory: 'teacher',            patterns: ['교사', 'teacher', '선생님'] },
  // 과외 (tutor) — no user-listed subcategory → category only.
  { category: 'education',                                     patterns: ['과외', 'tutor'] },

  // content_media
  { category: 'content_media', subcategory: 'media_producer', patterns: ['미디어 프로듀서', 'media producer'] },
  { category: 'content_media', subcategory: 'editor',         patterns: ['에디터', '편집자', 'editor'] },
  { category: 'content_media', subcategory: 'writer',         patterns: ['작가', 'writer', 'author'] },
  { category: 'content_media', subcategory: 'creator',        patterns: ['크리에이터', '유튜버', 'content creator', 'youtuber', '프로듀서', 'producer'] },
  // 일러스트레이터 — no user-listed subcategory → category only.
  { category: 'content_media',                                 patterns: ['일러스트레이터', 'illustrator'] },

  // sales_business_development (no user-listed subcategories → category only)
  { category: 'sales_business_development', patterns: ['영업', 'sales', '사업 개발', 'business development', 'account executive', 'account manager', ' ae ', ' bd ', ' am '] },

  // operations (no user-listed subcategories → category only).
  // HR / recruiter / people-ops folded here since the user spec has no
  // dedicated `people` category.
  { category: 'operations', patterns: ['운영', 'operations', ' ops ', '오퍼레이션', '인사', '인사 담당', ' hr ', 'people ops', 'recruiter', '리크루터', '채용 담당', '채용', 'human resources'] },

  // legal_accounting (no user-listed subcategories → category only).
  // Combines legal practice + accounting per user spec naming.
  { category: 'legal_accounting', patterns: ['변호사', 'lawyer', 'attorney', '법무', 'legal', '회계사', '회계', 'accountant', 'accounting', '세무사', '세무', 'tax accountant'] },

  // beauty_wellness (no user-listed subcategories → category only)
  { category: 'beauty_wellness', patterns: ['미용사', '헤어 디자이너', '헤어 디자인', '메이크업 아티스트', '에스테티션', '네일 아티스트', '필라테스 강사', '요가 강사', '트레이너', '스킨케어', 'hairdresser', 'esthetician', 'makeup artist', 'fitness trainer', 'yoga instructor', 'pilates instructor', 'wellness', 'beauty', 'salon', 'barber'] },

  // founder_entrepreneur
  { category: 'founder_entrepreneur', subcategory: 'small_business_owner', patterns: ['1인 사업자', '1인사업자', '자영업', '소상공인', '소규모 사업', 'small business owner'] },
  // ceo: ' ceo ' uses both-space anchor (input padding makes "CEO" alone match
  // at position 0 in " ceo "). '대표이사' is the Korean formal CEO title.
  // ' 대표 ' requires standalone '대표' so it doesn't false-match inside
  // '대표적' ("typical"). The user spec is explicit: 대표 → ceo, not founder.
  { category: 'founder_entrepreneur', subcategory: 'ceo',                   patterns: [' ceo ', 'chief executive', '최고경영자', '대표이사', ' 대표 '] },
  { category: 'founder_entrepreneur', subcategory: 'founder',               patterns: ['공동 창업자', '공동창업자', 'co-founder', 'cofounder', '창업자', 'founder'] },
  // 프리랜서 (freelancer) and solopreneur live under founder_entrepreneur but
  // with NO subcategory in the user's spec — they fall to the generic matcher.
  { category: 'founder_entrepreneur',                                        patterns: ['프리랜서', 'freelancer', 'freelance', 'solopreneur'] },

  // student_jobseeker (no user-listed subcategories → category only)
  { category: 'student_jobseeker', patterns: ['취업 준비생', '취업 준비', '취준생', '구직자', 'job seeker', 'jobseeker', '학생', 'student', '인턴', 'intern'] },

  // multi_domain — only triggers on EXPLICIT multi-track phrasing typed by the
  // user. It is NOT auto-promoted when several distinct categories are detected;
  // those still go to the rightmost-wins primary with the rest in
  // jobRoleSecondaryCategories. This keeps "프리랜서 디자이너" (design + founder)
  // from suddenly becoming a multi-domain self-identification.
  { category: 'multi_domain', patterns: ['여러 일', '여러 가지 일', '여러 분야', '병행', '다양한 분야', '복합 직무', 'multi-track', 'multi-disciplinary', 'multiple roles', 'multi role'] },
];

// ─── normalizeJobRole ────────────────────────────────────────────────────────
// Algorithm:
//   1. Lowercase + trim the input. Empty → undefined.
//   2. For every matcher, record its rightmost pattern occurrence AND the
//      length of the matched pattern.
//   3. The matcher with the LATEST ENDING position (lastIndex + matchedLength)
//      determines the primary category. Using END position correctly handles
//      substring collisions: "의사" (len 2) at index 1 inside "수의사" (len 3)
//      at index 0 both end at position 3, so the matcher-list order then
//      decides — and the more specific veterinarian matcher is listed first.
//      Ties also prefer subcategory-bearing matchers over generic ones.
//   4. Subcategory: pick the rightmost-ending matcher whose category equals
//      the primary AND which carries a subcategory. Falls back to the primary
//      matcher's own subcategory if present.
//   5. Secondary categories: all OTHER unique categories that matched, in
//      reverse-position order (closest-to-the-right first → most relevant).
//   6. No matches at all → { category: 'other' }.
export function normalizeJobRole(raw: string | undefined | null): NormalizedJobRole | undefined {
  if (!raw) return undefined;
  const trimmed = raw.toLowerCase().trim();
  if (trimmed.length === 0) return undefined;
  // P2.3 preprocessing:
  //   (a) Replace common punctuation / separators with a single space so that
  //       short-acronym patterns like ' vc ' still match in "VC, Investor" or
  //       "Designer/Founder". Keep '&' and '-' so 'r&d' / 'co-founder' still
  //       match their literal forms.
  //   (b) Collapse runs of whitespace.
  //   (c) Pad with a single space on each side so patterns with a leading or
  //       trailing space (e.g. ' vc ', ' pm ', ' ceo ') behave as cheap
  //       word-boundary anchors. The padding shifts every match position by +1
  //       uniformly — transparent to ordering and containment.
  const normalized = trimmed
    .replace(/[,.;:()\[\]{}\\/|]/g, ' ')
    .replace(/\s+/g, ' ');
  const text = ' ' + normalized + ' ';

  interface Hit { matcher: JobRoleMatcher; lastIndex: number; matchedLength: number }
  const hits: Hit[] = [];

  for (const m of MATCHERS) {
    let lastIdx = -1;
    let matchedLen = 0;
    for (const p of m.patterns) {
      const needle = p.toLowerCase();
      const idx = text.lastIndexOf(needle);
      // Prefer the later occurrence; on ties, prefer the longer pattern.
      if (idx > lastIdx || (idx === lastIdx && needle.length > matchedLen)) {
        lastIdx = idx;
        matchedLen = needle.length;
      }
    }
    if (lastIdx >= 0) hits.push({ matcher: m, lastIndex: lastIdx, matchedLength: matchedLen });
  }

  if (hits.length === 0) {
    return { jobRoleCategory: 'other' };
  }

  // ─── Containment dedupe ─────────────────────────────────────────────────────
  // Drop any hit whose matched range is STRICTLY contained inside another hit's
  // range. Examples:
  //   "수의사"     — physician's "의사" [1,3) is inside veterinarian's "수의사" [0,3)
  //   "data scientist" — research's "scientist" [5,14) is inside data_scientist's
  //                       "data scientist" [0,14) AND data's "data" [0,4) is also
  //                       inside that range. Both drop, leaving only data_scientist.
  //   "공동창업자" — founder's "창업자" [2,5) is inside cofounder's "공동창업자" [0,5)
  // This is the right semantic: the longer match represents the actual concept
  // the user typed; the shorter substring is collateral and shouldn't surface
  // as either a primary or a secondary category.
  const ranges = hits.map((h) => ({ start: h.lastIndex, end: h.lastIndex + h.matchedLength }));
  const survivors = hits.filter((_, i) => {
    const me = ranges[i];
    for (let j = 0; j < hits.length; j++) {
      if (i === j) continue;
      const other = ranges[j];
      const strictlyContains = other.start <= me.start && other.end >= me.end &&
        (other.start < me.start || other.end > me.end);
      if (strictlyContains) return false;
    }
    return true;
  });

  // Sort by ENDING position DESC so the rightmost head noun wins. Tiebreakers:
  // subcategory beats generic, then matcher-list order (Array.sort is stable).
  survivors.sort((a, b) => {
    const aEnd = a.lastIndex + a.matchedLength;
    const bEnd = b.lastIndex + b.matchedLength;
    if (aEnd !== bEnd) return bEnd - aEnd;
    const aSub = a.matcher.subcategory ? 1 : 0;
    const bSub = b.matcher.subcategory ? 1 : 0;
    return bSub - aSub;
  });

  // Replace `hits` with the deduped + sorted list for the downstream logic.
  hits.length = 0;
  hits.push(...survivors);

  // ─── Multi-domain auto-promotion (Rule 4) ───────────────────────────────────
  // If at least two DISTINCT categories were detected from the hits, override the
  // primary to multi_domain. The original distinct categories ride along in
  // jobRoleSecondaryCategories in rightmost-first order so a downstream consumer
  // (e.g. future report personalization) can still see what the original signals
  // were. No transition phrase is required — any multi-category match qualifies.
  //
  // Examples:
  //   "수의사 출신 투자심사역"  → multi_domain, secondaries [investment_finance, veterinary_pet]
  //   "프리랜서 디자이너"        → multi_domain, secondaries [design, founder_entrepreneur]
  //   "마케팅 PM"                → multi_domain, secondaries [product_planning, marketing]
  //
  // Hits that came from the explicit multi_domain matcher (여러 일 / 병행 / multi-
  // track / ...) take precedence — we don't double-promote. A single category
  // result, even with a phrase like "출신" attached, stays single-category.
  const distinctCategoriesFromHits = new Set<JobRoleCategory>(hits.map((h) => h.matcher.category));
  const alreadyMultiDomain = distinctCategoriesFromHits.has('multi_domain');
  if (distinctCategoriesFromHits.size >= 2 && !alreadyMultiDomain) {
    // Build the secondary list from distinct categories in rightmost-first order
    // (hits is already sorted that way). multi_domain is the new primary, so it
    // is filtered out (and at this point can't appear in distinctCategoriesFromHits
    // anyway, by construction).
    const seenForMulti = new Set<JobRoleCategory>();
    const multiSecondaries: JobRoleCategory[] = [];
    for (const h of hits) {
      const cat = h.matcher.category;
      if (cat !== 'multi_domain' && !seenForMulti.has(cat)) {
        seenForMulti.add(cat);
        multiSecondaries.push(cat);
      }
    }
    const out: NormalizedJobRole = { jobRoleCategory: 'multi_domain' };
    if (multiSecondaries.length > 0) out.jobRoleSecondaryCategories = multiSecondaries;
    // jobRoleSubcategory deliberately omitted — the user spec allows undefined,
    // and we don't yet synthesize composite labels like "veterinarian_vc".
    return out;
  }

  const primary = hits[0].matcher;

  // Pick the most-specific subcategory hit whose category matches primary.
  let subcategory: JobRoleSubcategory | undefined;
  for (const h of hits) {
    if (h.matcher.category === primary.category && h.matcher.subcategory) {
      subcategory = h.matcher.subcategory;
      break; // hits are already in rightmost-first order, so the first wins
    }
  }
  // If the primary matcher itself carries a subcategory, that wins.
  if (primary.subcategory) subcategory = primary.subcategory;

  // Secondary categories: every OTHER category that matched, deduped, in
  // rightmost-first order (since `hits` is already sorted that way).
  const seen = new Set<string>([primary.category]);
  const secondaries: JobRoleCategory[] = [];
  for (const h of hits) {
    if (!seen.has(h.matcher.category)) {
      seen.add(h.matcher.category);
      secondaries.push(h.matcher.category);
    }
  }

  // Build the return object WITHOUT setting optional fields to undefined when
  // we have no signal — keeps the spread `{ ...profile, ...result }` from
  // wiping a caller-set value with an explicit undefined.
  const out: NormalizedJobRole = { jobRoleCategory: primary.category };
  if (subcategory !== undefined) out.jobRoleSubcategory = subcategory;
  if (secondaries.length > 0) out.jobRoleSecondaryCategories = secondaries;
  return out;
}
