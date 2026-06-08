// 결과지 '당신의 직무라면' — 직무 그룹 × 실험 옵션별 소재 예시 (정적 콘텐츠).
//
// 고정 플랜 카피("콘텐츠 4개 발행")가 일반론으로 읽히는 문제를, 직무에 맞는
// 소재 한 줄로 구체화한다. 표시 전용 — 엔진·플랜 라우팅에는 영향이 없다.
// jobRoleCategory(jobRoleNormalizer 산출)를 매크로 그룹으로 접어 사용한다.

import type { CareerOptionKey, UserProfile } from '../types/careerCompass.ts';

type JobMacroGroup =
  | 'planning' | 'marketing' | 'engineering' | 'data' | 'design'
  | 'finance' | 'healthcare' | 'veterinary' | 'legal' | 'education'
  | 'content' | 'sales_ops' | 'founder';

const CATEGORY_TO_GROUP: Record<string, JobMacroGroup> = {
  // 기획·전략
  product_planning: 'planning', business_strategy: 'planning', ceo: 'planning',
  // 마케팅
  marketing: 'marketing', brand_marketing: 'marketing', growth_marketing: 'marketing',
  performance_marketing: 'marketing', content_marketing: 'marketing',
  // 개발
  engineering: 'engineering', backend: 'engineering', frontend: 'engineering',
  mobile: 'engineering', devops: 'engineering',
  // 데이터·AI
  data_ai: 'data',
  // 디자인
  design: 'design', ux_ui: 'design', product_design: 'design',
  graphic_design: 'design', brand_design: 'design',
  // 금융·투자
  investment_finance: 'finance', vc: 'finance', pe: 'finance',
  asset_management: 'finance', equity_research: 'finance', corporate_finance: 'finance',
  // 의료·헬스
  doctor: 'healthcare', nurse: 'healthcare', pharmacist: 'healthcare',
  healthcare_medical: 'healthcare', healthcare_business: 'healthcare', clinical_research: 'healthcare',
  // 수의·반려동물
  veterinarian: 'veterinary', vet_nurse: 'veterinary', animal_health: 'veterinary',
  pet_industry: 'veterinary', veterinary_pet: 'veterinary',
  // 법률·회계
  legal_accounting: 'legal',
  // 교육·연구
  teacher: 'education', professor: 'education', instructor: 'education',
  education: 'education', education_business: 'education', research_academia: 'education',
  researcher: 'education', graduate_researcher: 'education', rnd: 'education',
  // 콘텐츠·미디어
  content_media: 'content', creator: 'content', writer: 'content',
  editor: 'content', media_producer: 'content',
  // 영업·운영
  sales_business_development: 'sales_ops', operations: 'sales_ops',
  // 창업·자영업
  founder: 'founder', founder_entrepreneur: 'founder', small_business_owner: 'founder',
};

// 그룹 × 옵션 → "당신의 직무라면" 소재 한 줄.
const HINTS: Record<JobMacroGroup, Partial<Record<CareerOptionKey, string>>> = {
  planning: {
    contentBrand: '직접 굴린 기획 사례 회고나 의사결정 비하인드가 가장 강한 소재예요 — 자기소개 글보다 케이스 한 편.',
    advisoryTeaching: '초기 팀의 기획 리뷰, 주니어 PM 멘토링처럼 \'내 판단을 빌려주는\' 작은 자문부터.',
    startup: '내가 매일 겪는 업무 비효율 — 기획자들이 돈 내고 풀고 싶은 문제부터 인터뷰해 보세요.',
    jobChange: '문제 정의→개입→지표 변화로 정리한 케이스 2~3개가 포트폴리오의 전부예요.',
    stayRedesign: '맡고 싶은 문제 영역 하나를 정해 \'이 프로젝트 제가 굴려보겠다\'는 제안서 한 장.',
    independent: '첫 의뢰 타깃은 기획자가 없는 초기 팀 — 기획 패키지(문제정의·로드맵)를 상품으로.',
  },
  marketing: {
    contentBrand: '집행한 캠페인의 숫자와 교훈 — \'얼마 써서 뭘 배웠나\'가 마케터의 최강 콘텐츠예요.',
    advisoryTeaching: '작은 브랜드의 채널 진단 한 건부터 — 진단 리포트 자체가 영업 자료가 돼요.',
    startup: '내 채널 운영 노하우를 도구·템플릿으로 팔 수 있는지부터 확인해 보세요.',
    jobChange: '성과 지표가 박힌 캠페인 케이스 2개 + 실패에서 바꾼 것 1개 조합이 면접을 끌고 가요.',
    stayRedesign: '지표가 정체된 채널 하나를 골라 \'3개월 실험권\'을 제안해 보세요.',
    independent: '첫 고객은 마케터를 못 뽑는 로컬·초기 브랜드 — 월 고정 운영 패키지부터.',
  },
  engineering: {
    contentBrand: '삽질기와 아키텍처 결정 회고가 개발자 콘텐츠의 왕도예요 — 튜토리얼보다 \'왜 이렇게 했나\'.',
    advisoryTeaching: '코드 리뷰 멘토링이나 초기 팀 기술 자문 — 시간당으로 시작해 보세요.',
    startup: '내 작업 흐름에서 반복되는 불편 — 개발자가 지갑을 여는 도구 아이디어의 원천이에요.',
    jobChange: '깃허브 잔디보다 \'문제→설계→트레이드오프\'가 보이는 프로젝트 글 한 편이 세요.',
    stayRedesign: '기술 부채 하나를 잡아 \'이거 갚으면 이만큼 빨라진다\'는 제안으로 역할을 재설계해 보세요.',
    independent: '외주보다 유지보수 계약 — 작은 팀의 \'시간제 시니어\'가 안정적인 첫 모델이에요.',
  },
  data: {
    contentBrand: '공개 데이터로 만든 분석 한 편 — 결론보다 \'어떻게 봤는가\'가 당신의 상품이에요.',
    advisoryTeaching: '데이터 없는 작은 회사의 지표 설계 자문 — 대시보드 한 장이 결과물이에요.',
    startup: '분석 요청 중 반복되는 것 — 그게 자동화 도구의 씨앗이에요. 요청자들을 인터뷰해 보세요.',
    jobChange: '비즈니스 질문→분석→의사결정 변화까지 이어진 케이스가 채용 시장의 언어예요.',
    stayRedesign: '리포트 만드는 사람에서 \'질문을 정하는 사람\'으로 — 분기 지표 리뷰 주도권을 제안해 보세요.',
    independent: '월 단위 \'데이터 파트너\' 계약 — 분석 1건이 아니라 질문 받는 창구를 파세요.',
  },
  design: {
    contentBrand: '비포→애프터와 그 사이의 \'왜\'를 담은 작업 회고 — 포트폴리오 사이트보다 글 한 편이 멀리 가요.',
    advisoryTeaching: '초기 팀 디자인 시스템 진단이나 포트폴리오 리뷰 세션부터 — 안목이 곧 상품이에요.',
    startup: '디자이너들이 반복해서 사는 것(템플릿·에셋·툴)에 내 버전을 얹을 수 있는지 보세요.',
    jobChange: '예쁜 결과물 나열보다 \'문제→탐색→결정\'이 보이는 케이스 스터디 2개로 재구성하세요.',
    stayRedesign: '디자인이 늦게 불려오는 프로세스를 바꾸는 제안 — 상류로 올라가는 역할 재설계예요.',
    independent: '첫 포지셔닝은 \'OO 전문\'으로 좁히기 — 모든 걸 하는 디자이너는 아무도 안 찾아요.',
  },
  finance: {
    contentBrand: '시장 해석 글이 자산이에요 — 종목 추천이 아니라 \'이 뉴스를 나는 이렇게 읽는다\'.',
    advisoryTeaching: '초기 창업자 대상 재무 모델 리뷰, 투자 유치 준비 자문 — 한 건이 레퍼런스가 돼요.',
    startup: '내 분석 프로세스에서 수작업 구간 — 그걸 사고 싶은 사람을 먼저 인터뷰해 보세요.',
    jobChange: '딜·분석 케이스를 \'판단 근거\' 중심으로 정리 — 숫자보다 사고 과정이 차별점이에요.',
    stayRedesign: '커버리지 확장이나 신규 섹터 리서치 주도권을 제안해 보세요.',
    independent: '리서치 구독 모델 — 무료 글 몇 편으로 수요를 확인한 뒤에 유료를 여세요.',
  },
  healthcare: {
    contentBrand: '환자들이 매번 묻는 질문에 대한 쉬운 답 — 그게 의료인 콘텐츠의 가장 단단한 출발점이에요.',
    advisoryTeaching: '헬스케어 스타트업의 자문역, 동료 대상 임상 교육 — 자격이 곧 신뢰 자산이에요.',
    startup: '진료 현장에서 반복되는 비효율 — 현장을 아는 사람만 보이는 문제가 창업 소재예요.',
    jobChange: '임상 경력을 산업(제약·디지털헬스) 언어로 번역한 이력서가 필요해요 — 케이스로 보여주세요.',
    stayRedesign: '진료 외 역할(교육·프로토콜 개선·QI)을 공식화하는 제안을 해보세요.',
    independent: '개원이 전부가 아니에요 — 자문·교육·콘텐츠를 묶은 하이브리드 모델부터 검증해 보세요.',
  },
  veterinary: {
    contentBrand: '보호자들이 검색하는 질문(증상·사료·행동)에 대한 신뢰할 수 있는 답 — 수요가 이미 검증된 소재예요.',
    advisoryTeaching: '펫 산업 기업의 수의학 자문, 보호자 교육 클래스 — 자격이 흔치 않은 시장이에요.',
    startup: '진료실에서 매일 보는 보호자의 반복 문제 — 펫 시장은 현장 전문성이 곧 차별화예요.',
    jobChange: '임상 외 진로(제약·보험·펫테크)에는 임상 경험을 데이터·케이스로 번역한 문서가 필요해요.',
    stayRedesign: '병원 안에서 교육·콘텐츠·특수 진료 같은 내 영역 하나를 공식화해 보세요.',
    independent: '왕진·행동 상담·온라인 보호자 코칭 — 병원 밖 모델의 수요부터 작게 확인해 보세요.',
  },
  legal: {
    contentBrand: '\'계약서에서 이것만은 보세요\' 같은 예방 콘텐츠 — 전문 용어를 풀어주는 사람이 희소해요.',
    advisoryTeaching: '스타트업 월 자문 패키지 — 큰 사건보다 작은 반복 수요가 안정적이에요.',
    startup: '반복 업무(검토·신고·등기)의 템플릿화 — 동업계가 돈 내는 도구가 될 수 있어요.',
    jobChange: '다룬 사건·업무를 산업별 케이스로 재분류하면 인하우스 시장이 열려요.',
    stayRedesign: '특정 산업 전문화를 선언하고 그 분야 일이 내게 오게 만드는 내부 포지셔닝부터.',
    independent: '개업의 첫 단계는 사무실이 아니라 채널이에요 — 상담 수요를 온라인에서 먼저 확인하세요.',
  },
  education: {
    contentBrand: '가르치며 정리한 설명법 자체가 콘텐츠예요 — \'어렵던 게 이렇게 보이면 쉽다\'.',
    advisoryTeaching: '이미 하는 일의 시장 버전이에요 — 외부 특강·온라인 클래스 한 건으로 가격을 확인해 보세요.',
    startup: '학습자들이 반복해서 막히는 지점 — 그 좁은 문제 하나를 푸는 서비스부터.',
    jobChange: '교육 성과를 숫자와 사례로 — \'가르쳤다\'가 아니라 \'무엇이 달라졌나\'로 정리하세요.',
    stayRedesign: '커리큘럼 개편이나 신규 프로그램 설계 주도권을 제안해 보세요.',
    independent: '첫 상품은 넓은 강의가 아니라 좁은 문제의 코칭 — \'OO 때문에 막힌 사람\'을 타깃으로.',
  },
  content: {
    contentBrand: '이미 본업이 콘텐츠라면, 이번엔 \'남의 주제\'가 아니라 내 이름의 주제 하나를 정하는 게 실험이에요.',
    advisoryTeaching: '채널 진단·콘텐츠 전략 자문 — 만들어주는 것보다 봐주는 것이 단가가 좋아요.',
    startup: '제작 과정의 반복 작업 — 같은 업계 사람들이 돈 내고 쓸 도구·템플릿이 숨어 있어요.',
    jobChange: '조회수보다 \'기획 의도→실행→반응\'이 보이는 케이스로 정리하세요.',
    stayRedesign: '소모성 제작에서 기획·시리즈 소유권으로 — 내 이름이 남는 구조를 제안하세요.',
    independent: '클라이언트 잡히는 대로 받지 말고, 한 업계 전문 제작자로 좁혀서 시작하세요.',
  },
  sales_ops: {
    contentBrand: '현장에서 통한 화법·프로세스 개선기 — 영업·운영의 암묵지는 늘 수요가 있어요.',
    advisoryTeaching: '초기 팀의 영업 프로세스 셋업, 운영 매뉴얼 구축 자문 — 경험이 곧 매뉴얼이에요.',
    startup: '고객 접점에서 매일 듣는 불만 — 가장 검증된 창업 아이디어 원천을 이미 갖고 있어요.',
    jobChange: '수치(달성률·개선폭)와 함께 \'시스템을 만든 경험\'을 전면에 — 손이 아니라 구조를 판 사람으로.',
    stayRedesign: '반복 업무 하나를 자동화·매뉴얼화하는 프로젝트를 제안해 보세요.',
    independent: '프리랜스 영업 대행·운영 셋업 — 첫 계약은 전 직장 네트워크에서 나와요.',
  },
  founder: {
    contentBrand: '사업 운영의 실제 숫자와 결정들 — 창업자의 솔직한 기록은 그 자체로 차별화된 콘텐츠예요.',
    advisoryTeaching: '한 번 가본 길(창업·운영·정리)을 이제 시작하는 사람에게 — 경험담이 아니라 체크리스트로.',
    startup: '이미 판에 있으니, 이번 실험은 새 아이템보다 기존 고객의 옆 문제를 인터뷰하는 거예요.',
    jobChange: '창업 경험을 회사 언어로 번역하세요 — \'대표였다\'가 아니라 \'0→1을 이렇게 만들었다\'.',
    stayRedesign: '지금 사업에서 나만 할 수 있는 일과 위임할 일을 가르는 게 재설계예요.',
    independent: '법인 전환·피벗 전에, 지금 모델의 단위 경제부터 한 장으로 정리해 보세요.',
  },
};

// 직무 그룹이 없거나(미입력·기타) 옵션 매칭이 없을 때는 표시하지 않는다 —
// 어설픈 일반론을 덧붙이는 것보다 빼는 쪽이 신뢰를 지킨다.
export function getExperimentJobHint(
  profile: UserProfile | undefined,
  sourceOptionKey: CareerOptionKey | undefined,
): string | null {
  if (!profile?.jobRoleCategory || !sourceOptionKey) return null;
  const group = CATEGORY_TO_GROUP[profile.jobRoleCategory];
  if (!group) return null;
  return HINTS[group][sourceOptionKey] ?? null;
}
