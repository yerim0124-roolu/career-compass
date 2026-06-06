// Headless tests for P2.3 jobRoleNormalizer. Pure function only — no DOM.
// Taxonomy aligned to the user-spec canonical 19-category set.

import { normalizeJobRole } from './jobRoleNormalizer.ts';
import type { NormalizedJobRole } from './jobRoleNormalizer.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// Helper: compare a NormalizedJobRole to an expectation (shallow + array-aware).
// Field names match UserProfile (jobRoleCategory etc.) so a passing result can
// be spread straight onto the profile.
function eq(actual: NormalizedJobRole | undefined, expected: Partial<NormalizedJobRole> | undefined): boolean {
  if (expected === undefined) return actual === undefined;
  if (actual === undefined) return false;
  if (actual.jobRoleCategory !== expected.jobRoleCategory) return false;
  if (actual.jobRoleSubcategory !== expected.jobRoleSubcategory) return false;
  const a = actual.jobRoleSecondaryCategories ?? [];
  const e = expected.jobRoleSecondaryCategories ?? [];
  if (a.length !== e.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== e[i]) return false;
  return true;
}

// ─── undefined / empty / whitespace ──────────────────────────────────────────
check('undefined input → undefined',
  normalizeJobRole(undefined) === undefined);
check('null input → undefined',
  normalizeJobRole(null) === undefined);
check('empty string → undefined',
  normalizeJobRole('') === undefined);
check('whitespace-only string → undefined',
  normalizeJobRole('   \t  ') === undefined);

// ─── healthcare_medical ──────────────────────────────────────────────────────
check('의사 → healthcare_medical/doctor',
  eq(normalizeJobRole('의사'), { jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'doctor' }));
check('간호사 → healthcare_medical/nurse',
  eq(normalizeJobRole('간호사'), { jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'nurse' }));
check('약사 → healthcare_medical/pharmacist',
  eq(normalizeJobRole('약사'), { jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'pharmacist' }));
check('한의사 → healthcare_medical (no subcategory — not in spec list)',
  eq(normalizeJobRole('한의사'), { jobRoleCategory: 'healthcare_medical' }));
check('치과의사 → healthcare_medical (no subcategory — not in spec list)',
  eq(normalizeJobRole('치과의사'), { jobRoleCategory: 'healthcare_medical' }));
check('임상 시험 → healthcare_medical/clinical_research',
  eq(normalizeJobRole('임상 시험'), { jobRoleCategory: 'healthcare_medical', jobRoleSubcategory: 'clinical_research' }));

// ─── veterinary_pet (now distinct from healthcare_medical per spec) ──────────
check('수의사 → veterinary_pet/veterinarian',
  eq(normalizeJobRole('수의사'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'veterinarian' }));
check('동물 간호사 → veterinary_pet/vet_nurse',
  eq(normalizeJobRole('동물 간호사'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'vet_nurse' }));
check('동물병원 → veterinary_pet (no subcategory)',
  eq(normalizeJobRole('동물병원'), { jobRoleCategory: 'veterinary_pet' }));
check('반려동물 산업 → veterinary_pet/pet_industry',
  eq(normalizeJobRole('반려동물 산업'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'pet_industry' }));

// ─── legal_accounting (combined per spec) ────────────────────────────────────
check('변호사 → legal_accounting (no subcategory — not in spec list)',
  eq(normalizeJobRole('변호사'), { jobRoleCategory: 'legal_accounting' }));
check('회계사 → legal_accounting (no subcategory)',
  eq(normalizeJobRole('회계사'), { jobRoleCategory: 'legal_accounting' }));
check('세무사 → legal_accounting (no subcategory)',
  eq(normalizeJobRole('세무사'), { jobRoleCategory: 'legal_accounting' }));

// ─── education & research_academia ───────────────────────────────────────────
check('교사 → education/teacher',
  eq(normalizeJobRole('교사'), { jobRoleCategory: 'education', jobRoleSubcategory: 'teacher' }));
check('강사 → education/instructor',
  eq(normalizeJobRole('강사'), { jobRoleCategory: 'education', jobRoleSubcategory: 'instructor' }));
check('교수 → research_academia/professor (moved from old "education")',
  eq(normalizeJobRole('교수'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'professor' }));
check('연구원 → research_academia/researcher',
  eq(normalizeJobRole('연구원'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'researcher' }));
check('대학원생 → research_academia/graduate_researcher',
  eq(normalizeJobRole('대학원생'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'graduate_researcher' }));
check('연구개발 → research_academia/rnd',
  eq(normalizeJobRole('연구개발'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'rnd' }));

// ─── investment_finance (renamed from "finance") ─────────────────────────────
check('투자심사역 → investment_finance/vc',
  eq(normalizeJobRole('투자심사역'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'vc' }));
check('private equity → investment_finance/pe',
  eq(normalizeJobRole('private equity'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'pe' }));
check('자산 운용 → investment_finance/asset_management',
  eq(normalizeJobRole('자산 운용'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'asset_management' }));
check('investment banker → investment_finance/corporate_finance',
  eq(normalizeJobRole('investment banker'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'corporate_finance' }));
check('financial analyst → investment_finance (generic, no subcategory)',
  eq(normalizeJobRole('financial analyst'), { jobRoleCategory: 'investment_finance' }));

// ─── product_planning, business_strategy (no listed subcategories) ───────────
check('프로덕트 매니저 → product_planning (no subcategory in spec)',
  eq(normalizeJobRole('프로덕트 매니저'), { jobRoleCategory: 'product_planning' }));
check('서비스 기획자 → product_planning (no subcategory in spec)',
  eq(normalizeJobRole('서비스 기획자'), { jobRoleCategory: 'product_planning' }));
check('Product Manager → product_planning',
  eq(normalizeJobRole('Product Manager'), { jobRoleCategory: 'product_planning' }));
check('컨설턴트 → business_strategy (no subcategory in spec)',
  eq(normalizeJobRole('컨설턴트'), { jobRoleCategory: 'business_strategy' }));
check('전략 컨설턴트 → business_strategy',
  eq(normalizeJobRole('전략 컨설턴트'), { jobRoleCategory: 'business_strategy' }));

// ─── marketing ───────────────────────────────────────────────────────────────
check('마케터 → marketing (no subcategory)',
  eq(normalizeJobRole('마케터'), { jobRoleCategory: 'marketing' }));
check('퍼포먼스 마케터 → marketing/performance_marketing',
  eq(normalizeJobRole('퍼포먼스 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'performance_marketing' }));
check('콘텐츠 마케터 → marketing/content_marketing',
  eq(normalizeJobRole('콘텐츠 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'content_marketing' }));
check('브랜드 마케팅 → marketing/brand_marketing',
  eq(normalizeJobRole('브랜드 마케팅'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'brand_marketing' }));
check('그로스 마케팅 → marketing/growth_marketing',
  eq(normalizeJobRole('그로스 마케팅'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'growth_marketing' }));

// ─── design ──────────────────────────────────────────────────────────────────
check('디자이너 → design (no subcategory)',
  eq(normalizeJobRole('디자이너'), { jobRoleCategory: 'design' }));
check('UX 디자이너 → design/ux_ui (UX and UI merged per spec)',
  eq(normalizeJobRole('UX 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'ux_ui' }));
check('UI 디자이너 → design/ux_ui',
  eq(normalizeJobRole('UI 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'ux_ui' }));
check('프로덕트 디자이너 → design/product_design',
  eq(normalizeJobRole('프로덕트 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'product_design' }));
check('브랜드 디자이너 → design/brand_design',
  eq(normalizeJobRole('브랜드 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'brand_design' }));
check('그래픽 디자이너 → design/graphic_design',
  eq(normalizeJobRole('그래픽 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'graphic_design' }));
check('모션 디자이너 → design (no subcategory — not in spec list)',
  eq(normalizeJobRole('모션 디자이너'), { jobRoleCategory: 'design' }));

// ─── engineering (now absorbs the old "data" category as data_ai) ────────────
check('개발자 → engineering (no subcategory)',
  eq(normalizeJobRole('개발자'), { jobRoleCategory: 'engineering' }));
check('백엔드 개발자 → engineering/backend',
  eq(normalizeJobRole('백엔드 개발자'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'backend' }));
check('프론트엔드 개발자 → engineering/frontend',
  eq(normalizeJobRole('프론트엔드 개발자'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'frontend' }));
check('풀스택 개발자 → engineering (no subcategory — fullstack not in spec list)',
  eq(normalizeJobRole('풀스택 개발자'), { jobRoleCategory: 'engineering' }));
check('데이터 분석가 → engineering/data_ai',
  eq(normalizeJobRole('데이터 분석가'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));
check('데이터 사이언티스트 → engineering/data_ai',
  eq(normalizeJobRole('데이터 사이언티스트'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));
check('Data Scientist → engineering/data_ai',
  eq(normalizeJobRole('Data Scientist'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));
check('AI 엔지니어 → engineering/data_ai',
  eq(normalizeJobRole('AI 엔지니어'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));
check('Backend Engineer → engineering/backend',
  eq(normalizeJobRole('Backend Engineer'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'backend' }));
check('Mobile Developer → engineering/mobile',
  eq(normalizeJobRole('Mobile Developer'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'mobile' }));
check('DevOps → engineering/devops',
  eq(normalizeJobRole('DevOps'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'devops' }));

// ─── content_media (renamed/replaced old "creator") ──────────────────────────
check('크리에이터 → content_media/creator',
  eq(normalizeJobRole('크리에이터'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'creator' }));
check('작가 → content_media/writer',
  eq(normalizeJobRole('작가'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'writer' }));
check('에디터 → content_media/editor',
  eq(normalizeJobRole('에디터'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'editor' }));
check('media producer → content_media/media_producer',
  eq(normalizeJobRole('media producer'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'media_producer' }));
check('일러스트레이터 → content_media (no subcategory — not in spec list)',
  eq(normalizeJobRole('일러스트레이터'), { jobRoleCategory: 'content_media' }));

// ─── sales_business_development, operations ──────────────────────────────────
check('영업 → sales_business_development (no subcategory in spec)',
  eq(normalizeJobRole('영업'), { jobRoleCategory: 'sales_business_development' }));
check('사업 개발 → sales_business_development',
  eq(normalizeJobRole('사업 개발'), { jobRoleCategory: 'sales_business_development' }));
check('운영 → operations (no subcategory in spec)',
  eq(normalizeJobRole('운영'), { jobRoleCategory: 'operations' }));
check('리크루터 → operations (HR folded into operations per spec — no people category)',
  eq(normalizeJobRole('리크루터'), { jobRoleCategory: 'operations' }));

// ─── beauty_wellness (new) ───────────────────────────────────────────────────
check('헤어 디자이너 → beauty_wellness (NOT design)',
  eq(normalizeJobRole('헤어 디자이너'), { jobRoleCategory: 'beauty_wellness' }));
check('요가 강사 → beauty_wellness (NOT education)',
  eq(normalizeJobRole('요가 강사'), { jobRoleCategory: 'beauty_wellness' }));
check('필라테스 강사 → beauty_wellness',
  eq(normalizeJobRole('필라테스 강사'), { jobRoleCategory: 'beauty_wellness' }));
check('메이크업 아티스트 → beauty_wellness',
  eq(normalizeJobRole('메이크업 아티스트'), { jobRoleCategory: 'beauty_wellness' }));

// ─── founder_entrepreneur ────────────────────────────────────────────────────
check('창업자 → founder_entrepreneur/founder',
  eq(normalizeJobRole('창업자'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'founder' }));
check('공동창업자 → founder_entrepreneur/founder (cofounder not in spec — falls into founder)',
  eq(normalizeJobRole('공동창업자'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'founder' }));
check('CEO → founder_entrepreneur/ceo',
  eq(normalizeJobRole('CEO'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'ceo' }));
check('1인 사업자 → founder_entrepreneur/small_business_owner',
  eq(normalizeJobRole('1인 사업자'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'small_business_owner' }));
check('소상공인 → founder_entrepreneur/small_business_owner',
  eq(normalizeJobRole('소상공인'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'small_business_owner' }));
check('프리랜서 → founder_entrepreneur (no subcategory — freelancer not in spec list)',
  eq(normalizeJobRole('프리랜서'), { jobRoleCategory: 'founder_entrepreneur' }));

// ─── student_jobseeker (new) ─────────────────────────────────────────────────
check('학생 → student_jobseeker',
  eq(normalizeJobRole('학생'), { jobRoleCategory: 'student_jobseeker' }));
check('취업 준비 → student_jobseeker',
  eq(normalizeJobRole('취업 준비'), { jobRoleCategory: 'student_jobseeker' }));
check('취준생 → student_jobseeker',
  eq(normalizeJobRole('취준생'), { jobRoleCategory: 'student_jobseeker' }));
check('intern → student_jobseeker',
  eq(normalizeJobRole('intern'), { jobRoleCategory: 'student_jobseeker' }));

// ─── multi_domain (new, EXPLICIT trigger only) ───────────────────────────────
check('여러 일을 하고 있어요 → multi_domain (explicit "여러 일" trigger)',
  eq(normalizeJobRole('여러 일을 하고 있어요'), { jobRoleCategory: 'multi_domain' }));
check('병행 → multi_domain (explicit trigger)',
  eq(normalizeJobRole('병행'), { jobRoleCategory: 'multi_domain' }));
check('multi-track → multi_domain',
  eq(normalizeJobRole('multi-track'), { jobRoleCategory: 'multi_domain' }));

// ─── Multi-category inputs → multi_domain (Rule 4) ────────────────────────────
// Under the simplified rule, ANY input with ≥2 distinct categories matched
// becomes multi_domain. The original distinct categories ride along in
// jobRoleSecondaryCategories (rightmost-first). No transition phrase required.
check('프리랜서 디자이너 → multi_domain, secondaries [design, founder_entrepreneur]',
  eq(normalizeJobRole('프리랜서 디자이너'),
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['design', 'founder_entrepreneur'] }));

check('마케팅 PM → multi_domain, secondaries [product_planning, marketing]',
  eq(normalizeJobRole('마케팅 PM'),
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['product_planning', 'marketing'] }));

check('Marketing PM (B2B SaaS) → multi_domain, secondaries [product_planning, marketing]',
  eq(normalizeJobRole('Marketing PM (B2B SaaS)'),
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['product_planning', 'marketing'] }));

check('developer / founder → multi_domain, secondaries [founder_entrepreneur, engineering]',
  eq(normalizeJobRole('developer / founder'),
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['founder_entrepreneur', 'engineering'] }));

check('프리랜서 UX 디자이너 → multi_domain, secondaries [design, founder_entrepreneur]',
  eq(normalizeJobRole('프리랜서 UX 디자이너'),
    { jobRoleCategory: 'multi_domain', jobRoleSecondaryCategories: ['design', 'founder_entrepreneur'] }));

// ─── Unknown / unmatched text ─────────────────────────────────────────────────
check('"갤럭시 우주선 조종" (gibberish) → jobRoleCategory=other',
  eq(normalizeJobRole('갤럭시 우주선 조종'), { jobRoleCategory: 'other' }));
check('"random nonsense xyz" → jobRoleCategory=other',
  eq(normalizeJobRole('random nonsense xyz'), { jobRoleCategory: 'other' }));

// ─── Idempotency: feeding the same keyword back in is stable ─────────────────
{
  const a = normalizeJobRole('백엔드 개발자');
  const b = normalizeJobRole('백엔드 개발자');
  check('idempotency: same input → identical output',
    JSON.stringify(a) === JSON.stringify(b));
}

// ─── Absence-of-fields when no signal ────────────────────────────────────────
{
  const r = normalizeJobRole('변호사');
  check('변호사 result has no jobRoleSecondaryCategories key',
    r?.jobRoleSecondaryCategories === undefined);
}
{
  const r = normalizeJobRole('한의사');
  check('한의사 result has no jobRoleSubcategory key (not in user-listed subcategories)',
    r?.jobRoleSubcategory === undefined);
}

// ─── Case insensitivity ──────────────────────────────────────────────────────
{
  const a = normalizeJobRole('Backend Engineer');
  const b = normalizeJobRole('backend engineer');
  const c = normalizeJobRole('BACKEND ENGINEER');
  check('case insensitive: Backend Engineer === backend engineer',
    JSON.stringify(a) === JSON.stringify(b));
  check('case insensitive: Backend Engineer === BACKEND ENGINEER',
    JSON.stringify(a) === JSON.stringify(c));
}

// ═══════════════════════════════════════════════════════════════════════════════
// User spec coverage — one named test per example in the latest spec message.
// ═══════════════════════════════════════════════════════════════════════════════

// veterinary_pet family
check('SPEC: "수의사" → veterinary_pet/veterinarian',
  eq(normalizeJobRole('수의사'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'veterinarian' }));
check('SPEC: "동물병원 수의사" → veterinary_pet/veterinarian',
  eq(normalizeJobRole('동물병원 수의사'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'veterinarian' }));
check('SPEC: "수의테크" → veterinary_pet/animal_health',
  eq(normalizeJobRole('수의테크'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'animal_health' }));
check('SPEC: "펫산업" → veterinary_pet/pet_industry',
  eq(normalizeJobRole('펫산업'), { jobRoleCategory: 'veterinary_pet', jobRoleSubcategory: 'pet_industry' }));

// investment_finance family
check('SPEC: "투자심사역" → investment_finance/vc',
  eq(normalizeJobRole('투자심사역'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'vc' }));
check('SPEC: "VC" (standalone acronym) → investment_finance/vc',
  eq(normalizeJobRole('VC'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'vc' }));
check('SPEC: "벤처캐피탈" (no space) → investment_finance/vc',
  eq(normalizeJobRole('벤처캐피탈'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'vc' }));
check('SPEC: "PE" (standalone acronym) → investment_finance/pe',
  eq(normalizeJobRole('PE'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'pe' }));
check('SPEC: "애널리스트" → investment_finance/equity_research',
  eq(normalizeJobRole('애널리스트'), { jobRoleCategory: 'investment_finance', jobRoleSubcategory: 'equity_research' }));

// marketing family
check('SPEC: "브랜드 마케터" → marketing/brand_marketing',
  eq(normalizeJobRole('브랜드 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'brand_marketing' }));
check('SPEC: "퍼포먼스 마케터" → marketing/performance_marketing',
  eq(normalizeJobRole('퍼포먼스 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'performance_marketing' }));
check('SPEC: "콘텐츠 마케터" → marketing/content_marketing',
  eq(normalizeJobRole('콘텐츠 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'content_marketing' }));
check('SPEC: "그로스 마케터" → marketing/growth_marketing',
  eq(normalizeJobRole('그로스 마케터'), { jobRoleCategory: 'marketing', jobRoleSubcategory: 'growth_marketing' }));

// design family
check('SPEC: "디자이너" → design (no subcategory)',
  eq(normalizeJobRole('디자이너'), { jobRoleCategory: 'design' }));
check('SPEC: "UX 디자이너" → design/ux_ui',
  eq(normalizeJobRole('UX 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'ux_ui' }));
check('SPEC: "UI 디자이너" → design/ux_ui',
  eq(normalizeJobRole('UI 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'ux_ui' }));
check('SPEC: "프로덕트 디자이너" → design/product_design',
  eq(normalizeJobRole('프로덕트 디자이너'), { jobRoleCategory: 'design', jobRoleSubcategory: 'product_design' }));

// engineering family
check('SPEC: "개발자" → engineering (no subcategory)',
  eq(normalizeJobRole('개발자'), { jobRoleCategory: 'engineering' }));
check('SPEC: "프론트엔드 개발자" → engineering/frontend',
  eq(normalizeJobRole('프론트엔드 개발자'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'frontend' }));
check('SPEC: "백엔드 개발자" → engineering/backend',
  eq(normalizeJobRole('백엔드 개발자'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'backend' }));
check('SPEC: "AI 엔지니어" → engineering/data_ai',
  eq(normalizeJobRole('AI 엔지니어'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));
check('SPEC: "데이터 사이언티스트" → engineering/data_ai',
  eq(normalizeJobRole('데이터 사이언티스트'), { jobRoleCategory: 'engineering', jobRoleSubcategory: 'data_ai' }));

// research_academia family
check('SPEC: "연구원" → research_academia/researcher',
  eq(normalizeJobRole('연구원'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'researcher' }));
check('SPEC: "R&D" → research_academia/rnd',
  eq(normalizeJobRole('R&D'), { jobRoleCategory: 'research_academia', jobRoleSubcategory: 'rnd' }));

// education family
check('SPEC: "교사" → education/teacher',
  eq(normalizeJobRole('교사'), { jobRoleCategory: 'education', jobRoleSubcategory: 'teacher' }));
check('SPEC: "강사" → education/instructor',
  eq(normalizeJobRole('강사'), { jobRoleCategory: 'education', jobRoleSubcategory: 'instructor' }));

// content_media family
check('SPEC: "크리에이터" → content_media/creator',
  eq(normalizeJobRole('크리에이터'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'creator' }));
check('SPEC: "작가" → content_media/writer',
  eq(normalizeJobRole('작가'), { jobRoleCategory: 'content_media', jobRoleSubcategory: 'writer' }));

// founder_entrepreneur family — note '대표' MOVED from founder to ceo per spec
check('SPEC: "창업자" → founder_entrepreneur/founder',
  eq(normalizeJobRole('창업자'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'founder' }));
check('SPEC: "대표" → founder_entrepreneur/ceo (moved from founder per spec)',
  eq(normalizeJobRole('대표'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'ceo' }));
check('SPEC: "CEO" → founder_entrepreneur/ceo',
  eq(normalizeJobRole('CEO'), { jobRoleCategory: 'founder_entrepreneur', jobRoleSubcategory: 'ceo' }));

// ─── Multi-domain examples ──────────────────────────────────────────────────
// User spec: when "출신"-style transition phrase + ≥2 distinct categories,
// promote to multi_domain with all distinct categories in
// jobRoleSecondaryCategories. jobRoleSubcategory MAY be undefined (we use that).

// "수의사 출신 투자심사역"
{
  const r = normalizeJobRole('수의사 출신 투자심사역');
  check('SPEC: "수의사 출신 투자심사역" → primary multi_domain',
    r?.jobRoleCategory === 'multi_domain');
  check('SPEC: "수의사 출신 투자심사역" → subcategory undefined (per user spec, may be undefined)',
    r?.jobRoleSubcategory === undefined);
  check('SPEC: "수의사 출신 투자심사역" → secondaries include veterinary_pet',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('veterinary_pet'));
  check('SPEC: "수의사 출신 투자심사역" → secondaries include investment_finance',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('investment_finance'));
}

// "의사 출신 헬스케어 VC"
{
  const r = normalizeJobRole('의사 출신 헬스케어 VC');
  check('SPEC: "의사 출신 헬스케어 VC" → primary multi_domain',
    r?.jobRoleCategory === 'multi_domain');
  check('SPEC: "의사 출신 헬스케어 VC" → secondaries include healthcare_medical',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('healthcare_medical'));
  check('SPEC: "의사 출신 헬스케어 VC" → secondaries include investment_finance',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('investment_finance'));
}

// "디자이너 출신 창업자"
{
  const r = normalizeJobRole('디자이너 출신 창업자');
  check('SPEC: "디자이너 출신 창업자" → primary multi_domain',
    r?.jobRoleCategory === 'multi_domain');
  check('SPEC: "디자이너 출신 창업자" → secondaries include design',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('design'));
  check('SPEC: "디자이너 출신 창업자" → secondaries include founder_entrepreneur',
    Array.isArray(r?.jobRoleSecondaryCategories) && r!.jobRoleSecondaryCategories!.includes('founder_entrepreneur'));
}

// Negative guard: "출신" with ONE category should NOT trigger multi_domain.
{
  const r = normalizeJobRole('수의사 출신');
  check('GUARD: "수의사 출신" (one category only) does NOT trigger multi_domain',
    r?.jobRoleCategory === 'veterinary_pet');
}

// Positive guard for the simplified Rule 4: two categories WITHOUT a transition
// phrase still trigger multi_domain. This used to be a rightmost-wins case in
// the prior implementation; the simpler rule promotes it.
{
  const r = normalizeJobRole('마케팅 PM');
  check('GUARD (new Rule 4): "마케팅 PM" (no transition phrase) → multi_domain',
    r?.jobRoleCategory === 'multi_domain');
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2.3 RULES — one or two named assertions per spec rule so each PASS line maps
// directly to a numbered rule in the user message.
// ═══════════════════════════════════════════════════════════════════════════════

// Rule 1: case-insensitive English matching
{
  const a = normalizeJobRole('Backend Engineer');
  const b = normalizeJobRole('backend engineer');
  const c = normalizeJobRole('BACKEND ENGINEER');
  check('RULES R1: English case insensitivity — lower/Title/UPPER produce identical output',
    JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c));
}

// Rule 2: Korean and English mixed input works
{
  const r = normalizeJobRole('마케팅 PM (B2B SaaS)');
  check('RULES R2: Korean+English mixed input matches both signals',
    r?.jobRoleCategory === 'multi_domain'
    && r!.jobRoleSecondaryCategories!.includes('marketing')
    && r!.jobRoleSecondaryCategories!.includes('product_planning'));
}

// Rule 3 (helper side): normalizeJobRole internally trims and behaves identically
// regardless of leading/trailing whitespace.
{
  const a = normalizeJobRole('백엔드 개발자');
  const b = normalizeJobRole('  백엔드 개발자  ');
  check('RULES R3 (matcher side): identical output for trimmed vs whitespace-padded input',
    JSON.stringify(a) === JSON.stringify(b));
}

// Rule 4: multiple categories found → multi_domain
{
  const r = normalizeJobRole('디자이너 마케터');
  check('RULES R4: two distinct categories without any transition phrase → multi_domain',
    r?.jobRoleCategory === 'multi_domain');
}

// Rule 5: in multi-domain cases, store matched categories in secondaries
{
  const r = normalizeJobRole('디자이너 마케터');
  check('RULES R5: multi_domain result populates jobRoleSecondaryCategories with both matched categories',
    Array.isArray(r?.jobRoleSecondaryCategories)
    && r!.jobRoleSecondaryCategories!.length === 2
    && r!.jobRoleSecondaryCategories!.includes('design')
    && r!.jobRoleSecondaryCategories!.includes('marketing'));
}

// Rule 6: one category found → that single category (not multi_domain)
{
  const r = normalizeJobRole('백엔드 개발자');
  check('RULES R6: single-category input → that single category (no multi_domain promotion)',
    r?.jobRoleCategory === 'engineering' && r?.jobRoleSubcategory === 'backend');
}

// Rule 7: no category → "other"
{
  const r = normalizeJobRole('갤럭시 우주선 조종');
  check('RULES R7: unmatched input → jobRoleCategory="other"',
    r?.jobRoleCategory === 'other');
}

// Rule 8: do not throw on empty / undefined / null
{
  let threw = false;
  try {
    normalizeJobRole('');
    normalizeJobRole('   ');
    normalizeJobRole(undefined);
    normalizeJobRole(null);
  } catch { threw = true; }
  check('RULES R8: empty / whitespace / undefined / null inputs do NOT throw',
    !threw);
}

// Rule 9: empty / whitespace returns undefined (matches existing code style —
// we use "leave category undefined" since the helper signals "nothing to derive"
// to its caller).
{
  check('RULES R9: empty input → undefined (no synthetic "other" injected at the helper level)',
    normalizeJobRole('') === undefined);
  check('RULES R9: whitespace-only input → undefined',
    normalizeJobRole('   ') === undefined);
}

// Rule 10 is verified by session.test.ts P2.3 D8 (routing fingerprint identical
// across distinct jobRoleRaw inputs) and P2.3 D9 (P1.7 burnout invariant holds).
// Cross-reference printed here so it's visible in this suite's log.
{
  check('RULES R10: see session.test.ts P2.3 D8 + D9 for routing-invariant verification',
    true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED P2.3 TESTS — one named line per requirement in the latest user spec.
// Each PASS line below maps 1:1 to a row in the user's "Required tests" list.
// ═══════════════════════════════════════════════════════════════════════════════
{
  const v = normalizeJobRole('수의사');
  check('REQUIRED: "수의사" → veterinary_pet / veterinarian',
    v?.jobRoleCategory === 'veterinary_pet' && v?.jobRoleSubcategory === 'veterinarian');
}
{
  const v = normalizeJobRole('동물병원 수의사');
  check('REQUIRED: "동물병원 수의사" → veterinary_pet / veterinarian',
    v?.jobRoleCategory === 'veterinary_pet' && v?.jobRoleSubcategory === 'veterinarian');
}
{
  const v = normalizeJobRole('투자심사역');
  check('REQUIRED: "투자심사역" → investment_finance / vc',
    v?.jobRoleCategory === 'investment_finance' && v?.jobRoleSubcategory === 'vc');
}
{
  const v = normalizeJobRole('VC');
  check('REQUIRED: "VC" → investment_finance / vc',
    v?.jobRoleCategory === 'investment_finance' && v?.jobRoleSubcategory === 'vc');
}
{
  const v = normalizeJobRole('브랜드 마케터');
  check('REQUIRED: "브랜드 마케터" → marketing / brand_marketing',
    v?.jobRoleCategory === 'marketing' && v?.jobRoleSubcategory === 'brand_marketing');
}
{
  const v = normalizeJobRole('퍼포먼스 마케터');
  check('REQUIRED: "퍼포먼스 마케터" → marketing / performance_marketing',
    v?.jobRoleCategory === 'marketing' && v?.jobRoleSubcategory === 'performance_marketing');
}
{
  const v = normalizeJobRole('UX 디자이너');
  check('REQUIRED: "UX 디자이너" → design / ux_ui',
    v?.jobRoleCategory === 'design' && v?.jobRoleSubcategory === 'ux_ui');
}
{
  const v = normalizeJobRole('프론트엔드 개발자');
  check('REQUIRED: "프론트엔드 개발자" → engineering / frontend',
    v?.jobRoleCategory === 'engineering' && v?.jobRoleSubcategory === 'frontend');
}
{
  const v = normalizeJobRole('연구원');
  check('REQUIRED: "연구원" → research_academia / researcher',
    v?.jobRoleCategory === 'research_academia' && v?.jobRoleSubcategory === 'researcher');
}
{
  const v = normalizeJobRole('창업자');
  check('REQUIRED: "창업자" → founder_entrepreneur / founder',
    v?.jobRoleCategory === 'founder_entrepreneur' && v?.jobRoleSubcategory === 'founder');
}
{
  const v = normalizeJobRole('수의사 출신 투자심사역');
  const cats = v?.jobRoleSecondaryCategories ?? [];
  check('REQUIRED: "수의사 출신 투자심사역" → multi_domain, includes veterinary_pet and investment_finance',
    v?.jobRoleCategory === 'multi_domain'
    && cats.includes('veterinary_pet') && cats.includes('investment_finance'));
}
{
  const v = normalizeJobRole('의사 출신 헬스케어 VC');
  const cats = v?.jobRoleSecondaryCategories ?? [];
  check('REQUIRED: "의사 출신 헬스케어 VC" → multi_domain, includes healthcare_medical and investment_finance',
    v?.jobRoleCategory === 'multi_domain'
    && cats.includes('healthcare_medical') && cats.includes('investment_finance'));
}
{
  const v = normalizeJobRole('zxqwerty foobar nonsense');
  check('REQUIRED: Unknown free text → other',
    v?.jobRoleCategory === 'other');
}
{
  let threw = false;
  try {
    normalizeJobRole('');
    normalizeJobRole('   ');
    normalizeJobRole(undefined);
    normalizeJobRole(null);
  } catch { threw = true; }
  check('REQUIRED: Empty jobRoleRaw should not crash',
    !threw);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
