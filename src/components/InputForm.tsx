import { useEffect, useRef, useState } from 'react';
import type { FormData, OptionKey } from '../types';
import SliderQuestion from './SliderQuestion';
import OptionCheckbox from './OptionCheckbox';
import { formatKRW, inferTargetEvents, getFlowTypePreview } from '../utils/scoring';

const SECTION_TITLES = [
  '기본 프로필',
  '커리어 현황',
  '검토 중인 선택지',
  '커리어 성향 분석',
  '타이밍 참고',
];

const STEP_SHORT = ['프로필', '커리어', '선택지', '성향', '타이밍'];
const TOTAL_STEPS = 5;
const FORM_DRAFT_KEY = 'career-compass-form-draft-v1';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onSubmit: (data: FormData) => void;
}

const defaultForm: FormData = {
  basicProfile: {
    currentRole: '',
    industry: '',
    annualSalary: 50000000,
    monthlyExpense: 2500000,
    savings: 15000000,
  },
  careerStatus: {
    jobSatisfaction: 3,
    growthPotential: 3,
    salarySatisfaction: 3,
    workLifeBalance: 3,
    organizationStress: 3,
    burnout: 3,
    jobSearchConfidence: 3,
  },
  selectedOptions: [],
  traits: {
    changeOrientation: 3,
    planning: 3,
    curiosity: 3,
    riskTolerance: 3,
    recoveryNeed: 3,
    selfEfficacy: 3,
    networking: 3,
    meaningOrientation: 3,
    outcomeExpectation: 3,
    portfolioEvidence: 3,
  },
  flow: {
    desireForChange: 3,
    desireForStability: 3,
    needForRest: 3,
  },
  timing: {
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthTime: '',
    calendarType: 'solar',
  },
};

function formatNumber(v: number): string {
  return v.toLocaleString('ko-KR');
}

function parseNumber(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10) || 0;
}

function isValidDateParts(year: string, month: string, day: string): boolean {
  if (!year || !month || !day) return false;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export default function InputForm({ onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const setBasic  = (k: keyof FormData['basicProfile'], v: string | number) =>
    setForm((f) => ({ ...f, basicProfile: { ...f.basicProfile, [k]: v } }));
  const setCareer = (k: keyof FormData['careerStatus'], v: number) =>
    setForm((f) => ({ ...f, careerStatus: { ...f.careerStatus, [k]: v } }));
  const setTrait  = (k: keyof FormData['traits'], v: number) =>
    setForm((f) => ({ ...f, traits: { ...f.traits, [k]: v } }));
  const setFlow   = (k: keyof FormData['flow'], v: number) =>
    setForm((f) => ({ ...f, flow: { ...f.flow, [k]: v } }));
  const setTiming = (k: keyof FormData['timing'], v: string) =>
    setForm((f) => ({ ...f, timing: { ...f.timing, [k]: v } }));

  // Refs for birth date auto-focus
  const yearRef  = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef   = useRef<HTMLInputElement>(null);

  const validateStep = (): boolean => {
    const errs: string[] = [];
    if (step === 0) {
      if (!form.basicProfile.currentRole.trim()) errs.push('현재 직무를 입력해 주세요.');
      if (!form.basicProfile.industry.trim())    errs.push('산업/업종을 입력해 주세요.');
      if (form.basicProfile.annualSalary < 0) errs.push('연봉을 올바르게 입력해 주세요.');
      if (form.basicProfile.monthlyExpense <= 0) errs.push('월 지출액을 올바르게 입력해 주세요.');
      if (form.basicProfile.savings < 0) errs.push('저축/비상금을 올바르게 입력해 주세요.');
      const { birthYear, birthMonth, birthDay } = form.timing;
      if (!birthYear || !birthMonth || !birthDay) {
        errs.push('생년월일을 입력해 주세요.');
      } else if (!isValidDateParts(birthYear, birthMonth, birthDay)) {
        errs.push('생년월일 형식이 올바르지 않습니다.');
      }
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    setErrors([]);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const prev = () => {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 0));
  };
  const handleSubmit = () => {
    if (!validateStep()) return;
    localStorage.removeItem(FORM_DRAFT_KEY);
    onSubmit(form);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { step?: number; form?: FormData; savedAt?: number };
      if (typeof parsed.savedAt === 'number') {
        const age = Date.now() - parsed.savedAt;
        if (age > DRAFT_MAX_AGE_MS) {
          localStorage.removeItem(FORM_DRAFT_KEY);
          return;
        }
      }
      if (parsed.form) {
        setForm(parsed.form);
        setIsDraftLoaded(true);
      }
      if (typeof parsed.step === 'number') {
        setStep(Math.max(0, Math.min(TOTAL_STEPS - 1, parsed.step)));
      }
    } catch {
      // Ignore malformed draft and continue with defaults.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FORM_DRAFT_KEY,
        JSON.stringify({
          step,
          form,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [step, form]);

  const clearDraft = () => {
    localStorage.removeItem(FORM_DRAFT_KEY);
    setStep(0);
    setForm(defaultForm);
    setErrors([]);
    setIsDraftLoaded(false);
  };

  const runway = form.basicProfile.monthlyExpense > 0
    ? (form.basicProfile.savings / form.basicProfile.monthlyExpense).toFixed(1)
    : '—';

  const INPUT_CLS = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent';

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <span className="font-black text-slate-800 text-sm tracking-tight hidden sm:block">Career Compass</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEP_SHORT.map((label, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1">
                <div className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < step ? 'bg-indigo-400' : i === step ? 'bg-indigo-600' : 'bg-slate-200'
                }`} />
                <span className={`text-center text-[10px] font-medium hidden sm:block ${
                  i === step ? 'text-indigo-600' : i < step ? 'text-indigo-300' : 'text-slate-300'
                }`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">

        {/* Section header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-white">{step + 1}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{SECTION_TITLES[step]}</h2>
          </div>
          <div className="h-px bg-gradient-to-r from-slate-300 via-slate-200 to-transparent mt-3" />
        </div>

        {/* Error messages */}
        {isDraftLoaded && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-indigo-700 font-medium">이전 입력 내용을 불러왔습니다.</p>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
            >
              새로 시작
            </button>
          </div>
        )}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 space-y-1">
            {errors.map((e) => (
              <p key={e} className="text-sm text-red-700">— {e}</p>
            ))}
          </div>
        )}

        {/* ── 1. Basic Profile ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">생년월일</label>
              <div className="flex items-center gap-2">
                <input
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={form.timing.birthYear}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setTiming('birthYear', v);
                    if (v.length === 4) monthRef.current?.focus();
                  }}
                  className="w-20 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span className="text-slate-300 font-bold text-lg">/</span>
                <input
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={form.timing.birthMonth}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v !== '' && parseInt(v) > 12) return;
                    setTiming('birthMonth', v);
                    if (v.length === 2) dayRef.current?.focus();
                  }}
                  className="w-14 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span className="text-slate-300 font-bold text-lg">/</span>
                <input
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="DD"
                  value={form.timing.birthDay}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v !== '' && parseInt(v) > 31) return;
                    setTiming('birthDay', v);
                  }}
                  className="w-14 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="mt-2 flex gap-2">
                {(['solar', 'lunar'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTiming('calendarType', type)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.timing.calendarType === type
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {type === 'solar' ? '양력' : '음력'}
                  </button>
                ))}
              </div>
              {form.timing.birthYear.length === 4 && form.timing.birthMonth && form.timing.birthDay && (
                <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                  {form.timing.birthYear}년 {form.timing.birthMonth}월 {form.timing.birthDay}일
                  {form.timing.calendarType === 'lunar' ? ' (음력)' : ' (양력)'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">현재 직무</label>
              <input type="text" value={form.basicProfile.currentRole}
                onChange={(e) => setBasic('currentRole', e.target.value)}
                className={INPUT_CLS} placeholder="예: 백엔드 개발자, 마케터, UX 디자이너" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">산업/업종</label>
              <input type="text" value={form.basicProfile.industry}
                onChange={(e) => setBasic('industry', e.target.value)}
                className={INPUT_CLS} placeholder="예: IT/스타트업, 금융, 제조, 교육" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">연봉 <span className="font-normal text-slate-400">(원)</span></label>
              <input type="text" value={formatNumber(form.basicProfile.annualSalary)}
                onChange={(e) => setBasic('annualSalary', parseNumber(e.target.value))}
                className={INPUT_CLS} placeholder="50,000,000" />
              <p className="text-xs text-slate-400 mt-1">{formatKRW(form.basicProfile.annualSalary)}</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                소득이 없는 기간을 버틸 자금 여력을 판단하기 위한 참고값이며, 입력 데이터는 저장되지 않습니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">월 지출액 <span className="font-normal text-slate-400">(원, 필수)</span></label>
              <input type="text" value={formatNumber(form.basicProfile.monthlyExpense)}
                onChange={(e) => setBasic('monthlyExpense', parseNumber(e.target.value))}
                className={INPUT_CLS} placeholder="2,500,000" />
              <p className="text-xs text-slate-400 mt-1">{formatKRW(form.basicProfile.monthlyExpense)}/월</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">현재 저축/비상금 <span className="font-normal text-slate-400">(원)</span></label>
              <input type="text" value={formatNumber(form.basicProfile.savings)}
                onChange={(e) => setBasic('savings', parseNumber(e.target.value))}
                className={INPUT_CLS} placeholder="15,000,000" />
              <p className="text-xs text-slate-400 mt-1">{formatKRW(form.basicProfile.savings)}</p>
            </div>

            {form.basicProfile.monthlyExpense > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm flex-shrink-0">
                  {runway}
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-800">예상 런웨이 {runway}개월</p>
                  <p className="text-xs text-indigo-500 mt-0.5">무소득 상태에서 버틸 수 있는 기간</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Career Status ── */}
        {step === 1 && (
          <div className="space-y-6 bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <SliderQuestion label="업무 만족도" sublabel="현재 맡은 일이 얼마나 만족스럽나요?" value={form.careerStatus.jobSatisfaction} onChange={(v) => setCareer('jobSatisfaction', v)} leftLabel="매우 불만족" rightLabel="매우 만족" />
            <SliderQuestion label="성장 가능성" sublabel="지금 회사에서 성장할 여지가 얼마나 있나요?" value={form.careerStatus.growthPotential} onChange={(v) => setCareer('growthPotential', v)} leftLabel="없음" rightLabel="충분함" />
            <SliderQuestion label="연봉 만족도" sublabel="현재 받는 보상이 얼마나 적절하다고 느끼나요?" value={form.careerStatus.salarySatisfaction} onChange={(v) => setCareer('salarySatisfaction', v)} leftLabel="매우 불만족" rightLabel="매우 만족" />
            <SliderQuestion label="워라밸" sublabel="업무와 삶의 균형이 얼마나 좋은가요?" value={form.careerStatus.workLifeBalance} onChange={(v) => setCareer('workLifeBalance', v)} leftLabel="매우 나쁨" rightLabel="매우 좋음" />
            <SliderQuestion label="조직 스트레스" sublabel="회사 조직/관계에서 받는 스트레스 정도" value={form.careerStatus.organizationStress} onChange={(v) => setCareer('organizationStress', v)} leftLabel="거의 없음" rightLabel="매우 심함" />
            <SliderQuestion label="번아웃 정도" sublabel="지금 얼마나 소진된 느낌인가요?" value={form.careerStatus.burnout} onChange={(v) => setCareer('burnout', v)} leftLabel="전혀 없음" rightLabel="심각함" />
            <SliderQuestion label="이직 자신감" sublabel="지금 이직을 시도한다면 성공할 자신이 얼마나 있나요?" value={form.careerStatus.jobSearchConfidence} onChange={(v) => setCareer('jobSearchConfidence', v)} leftLabel="없음" rightLabel="높음" />
          </div>
        )}

        {/* ── 3. Options ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100">
              현재 진지하게 고려 중인 선택지를 선택해 주세요. 선택하지 않으면 <strong>모든 선택지를 함께 분석</strong>합니다.
            </p>
            <OptionCheckbox
              selected={form.selectedOptions}
              onChange={(keys) => setForm((f) => ({ ...f, selectedOptions: keys as OptionKey[] }))}
            />
          </div>
        )}

        {/* ── 4. Career Trait Model ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-white">연구 기반 커리어 성향 분석</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                커리어 심리학과 행동 연구에 기반한 8가지 성향 지표입니다. 타입으로 분류하지 않고, 각 성향의 강도를 연속적으로 측정합니다.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-6">
              <SliderQuestion label="변화 지향성" sublabel="새로운 역할이나 환경의 변화가 얼마나 편한가요?" value={form.traits.changeOrientation} onChange={(v) => setTrait('changeOrientation', v)} leftLabel="변화가 불안함" rightLabel="변화가 기회" />
              <SliderQuestion label="계획성" sublabel="업무와 커리어를 얼마나 계획적으로 관리하는 편인가요?" value={form.traits.planning} onChange={(v) => setTrait('planning', v)} leftLabel="즉흥·유연형" rightLabel="체계적 계획형" />
              <SliderQuestion label="호기심 / 탐구욕" sublabel="새로운 분야나 기술을 배우고 싶은 욕구가 얼마나 강한가요?" value={form.traits.curiosity} onChange={(v) => setTrait('curiosity', v)} leftLabel="현 업무에 집중" rightLabel="끊임없이 탐구" />
              <SliderQuestion label="위험 감수성" sublabel="커리어에서 불확실한 선택을 얼마나 감수할 수 있나요?" value={form.traits.riskTolerance} onChange={(v) => setTrait('riskTolerance', v)} leftLabel="안정 선호" rightLabel="위험 감수" />
              <SliderQuestion label="회복 필요성" sublabel="집중적인 업무 후 충분한 회복 시간이 얼마나 필요한가요?" value={form.traits.recoveryNeed} onChange={(v) => setTrait('recoveryNeed', v)} leftLabel="회복이 빠름" rightLabel="충분한 회복 필요" />
              <SliderQuestion label="자기효능감" sublabel="목표 달성을 위한 행동을 시작하는 데 얼마나 자신이 있나요?" value={form.traits.selfEfficacy} onChange={(v) => setTrait('selfEfficacy', v)} leftLabel="자신 없음" rightLabel="확신이 높음" />
              <SliderQuestion label="네트워킹 능력" sublabel="업무 관계 구축과 인맥 활용에 얼마나 적극적인가요?" value={form.traits.networking} onChange={(v) => setTrait('networking', v)} leftLabel="소극적" rightLabel="적극적" />
              <SliderQuestion label="의미 지향성" sublabel="급여나 안정보다 의미 있는 일이 얼마나 중요한가요?" value={form.traits.meaningOrientation} onChange={(v) => setTrait('meaningOrientation', v)} leftLabel="현실적 요인 중시" rightLabel="의미·가치 중시" />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mt-1">
              <p className="text-xs font-bold text-indigo-700 mb-0.5">이직 경쟁력 보정 지표 (SCCT 기반)</p>
              <p className="text-[11px] text-indigo-500 leading-relaxed">외부 시장에서의 경쟁력을 더 정확하게 계산하기 위한 추가 지표입니다.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-6">
              <SliderQuestion label="결과 기대감" sublabel="내 경력은 외부 시장에서 좋은 반응을 얻을 가능성이 있다고 느낀다" value={form.traits.outcomeExpectation} onChange={(v) => setTrait('outcomeExpectation', v)} leftLabel="자신 없음" rightLabel="충분히 가능" />
              <SliderQuestion label="성과 증명력" sublabel="내 성과를 이력서·포트폴리오로 구체적으로 증명할 수 있다" value={form.traits.portfolioEvidence} onChange={(v) => setTrait('portfolioEvidence', v)} leftLabel="증명하기 어려움" rightLabel="명확히 증명 가능" />
            </div>

            {/* Live composite mini-bars */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">성향 복합 지표</p>
              {[
                { label: '실행 준비도', v: Math.round((form.traits.selfEfficacy * 0.4 + form.traits.networking * 0.3 + form.traits.changeOrientation * 0.3 - 1) / 4 * 100) },
                { label: '탐구 드라이브', v: Math.round((form.traits.curiosity * 0.4 + form.traits.changeOrientation * 0.3 + form.traits.riskTolerance * 0.3 - 1) / 4 * 100) },
                { label: '안정 선호도', v: Math.round(((6 - form.traits.changeOrientation) * 0.4 + form.traits.planning * 0.4 + (6 - form.traits.riskTolerance) * 0.2 - 1) / 4 * 100) },
                { label: '회복 압력', v: Math.round((form.traits.recoveryNeed - 1) / 4 * 100) },
              ].map(({ label, v }) => {
                const pct = Math.max(0, Math.min(100, v));
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-7 text-right">{pct}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 5. Timing Reference ── */}
        {step === 4 && (
          <div className="space-y-5">

            {/* Info banner */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">타이밍 참고</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                입력한 생년월일시를 기준으로 성향과 타이밍 참고 지표를 계산합니다.
              </p>
            </div>

            {/* Auto-inferred target events */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-indigo-700">분석 대상 이벤트 — 선택지에서 자동 추론</p>
              <div className="flex flex-wrap gap-2">
                {inferTargetEvents(form.selectedOptions).map((ev) => (
                  <span key={ev} className="text-xs bg-white text-indigo-700 border border-indigo-200 rounded-full px-3 py-1 font-semibold shadow-sm">
                    {ev}
                  </span>
                ))}
              </div>
              <p className="text-xs text-indigo-400">3단계에서 선택지를 수정하면 자동 업데이트됩니다.</p>
            </div>

            {/* Birth time only (date is collected in step 0) */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                태어난 시간 <span className="font-normal text-slate-400 text-xs">(선택 — 사주 시주 분석 정확도용)</span>
              </p>
              <input
                type="time"
                value={form.timing.birthTime}
                onChange={(e) => setTiming('birthTime', e.target.value)}
                className="w-36 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Flow sliders */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-5">
              <p className="text-sm font-semibold text-slate-700">현재 에너지 흐름 <span className="font-normal text-slate-400 text-xs">(점수 계산 및 타이밍 신호 도출에 사용)</span></p>
              <SliderQuestion label="변화 욕구" sublabel="지금 무언가 바꾸고 싶은 욕구가 얼마나 강한가요?" value={form.flow.desireForChange} onChange={(v) => setFlow('desireForChange', v)} leftLabel="현상 유지 원함" rightLabel="크게 바꾸고 싶음" />
              <SliderQuestion label="안정 욕구" sublabel="지금 안정적이고 예측 가능한 상황을 얼마나 원하나요?" value={form.flow.desireForStability} onChange={(v) => setFlow('desireForStability', v)} leftLabel="변화가 괜찮음" rightLabel="안정이 절실함" />
              <SliderQuestion label="회복 필요성" sublabel="지금 당장 에너지를 충전하고 쉬어야 할 필요성이 얼마나 큰가요?" value={form.flow.needForRest} onChange={(v) => setFlow('needForRest', v)} leftLabel="아직 여유 있음" rightLabel="지금 당장 쉬어야 함" />
            </div>

            {/* Flow type preview */}
            <div className="bg-white rounded-xl p-4 border border-stone-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">흐름 유형 미리보기</p>
              <p className="text-sm text-slate-700 font-medium">
                {getFlowTypePreview(form.flow)}
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={prev}
              className="flex-1 border-2 border-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl hover:bg-slate-50 transition-all">
              이전
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button type="button" onClick={next}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3.5 rounded-2xl shadow-md transition-all">
              다음
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-indigo-200 transition-all">
              결과 분석하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
