// Career Compass — 유료 심화 문항 입력 (#paid-questions), 4스텝 12문항.
//
// 결제/AI 없음. 답변만 수집해 하나의 paidAnswers 객체로 묶고, 완료 시 상위로
// 전달(onComplete)한 뒤 #paid-result로 이동한다. 선택지의 '값'은 한글 라벨을
// 그대로 저장한다 — 3단계에서 AI 프롬프트에 사람이 읽는 형태로 주입되도록.
// 객체 키 이름(workStatus 등)은 3단계 계약이므로 변경 금지.

import { useMemo, useState } from 'react';
import type { PaidAnswers } from './paidTypes.ts';
import { storePaidAnswers } from './paidJobSession.ts';

interface Props {
  onComplete: (answers: PaidAnswers) => void;
}

type Question =
  | { key: SingleKey; type: 'single'; question: string; options: string[] }
  | { key: TextKey; type: 'text'; question: string; placeholder: string }
  | { key: 'mustKeep'; type: 'multi'; question: string; options: string[]; max: number };

type SingleKey =
  | 'workStatus' | 'maritalStatus' | 'dependents'
  | 'candidateDirection' | 'runway' | 'incomeFloor' | 'weeklyTime' | 'energyLevel';
type TextKey = 'trigger' | 'flowMoment';

interface StepDef { title: string; questions: Question[]; }

const STEPS: StepDef[] = [
  {
    title: '지금 당신의 상황',
    questions: [
      { key: 'workStatus', type: 'single', question: '지금 어떤 형태로 일하고 계세요?',
        options: ['회사원(정규직)', '계약직·파견', '프리랜서·개인사업', '사장님(직원 있음)', '지금은 쉬는 중·구직 중'] },
      { key: 'maritalStatus', type: 'single', question: '결혼하셨어요?',
        options: ['미혼', '기혼'] },
      { key: 'dependents', type: 'single', question: '생계를 책임지는 가족이 있나요?',
        options: ['없음(나만)', '배우자', '자녀', '부모님·기타'] },
    ],
  },
  {
    title: '지금 이 고민',
    questions: [
      { key: 'trigger', type: 'text', question: '요즘 이 고민이 부쩍 커진 계기가 있다면?',
        placeholder: '예: 나만 제자리인 것 같아요 / 이대로 나이만 먹는 게 아닐까 불안해요 / 문득 이 일을 평생 할 자신이 없어졌어요' },
      { key: 'candidateDirection', type: 'single', question: '혹시 마음에 두고 있는 방향이 있어요?',
        options: [
          '같은 일, 다른 회사로 (지금 하는 일 그대로 더 좋은 곳으로)',
          '다른 직무로 전환 (하는 일 자체를 바꾸기)',
          '지금 회사에 남되 역할 조정 (부서 이동·업무 범위 변경)',
          '내 사업 시작 (창업·개원·가게 등)',
          '조직 없이 독립 (프리랜서·1인 사업)',
          '완전히 다른 분야로',
          '아직 잘 모르겠음',
        ] },
    ],
  },
  {
    title: '현실적인 조건',
    questions: [
      { key: 'runway', type: 'single', question: '지금 수입이 끊긴다면, 모아둔 걸로 몇 개월이나 버틸 수 있어요?',
        options: ['3개월 미만', '3~6개월', '6개월~1년', '1년 이상'] },
      { key: 'incomeFloor', type: 'single', question: '매달 최소한 이만큼은 벌어야 한다는 금액이 있다면?',
        options: ['200만 원 미만', '200~350만 원', '350~500만 원', '500만 원 이상'] },
      { key: 'weeklyTime', type: 'single', question: '이 고민에 쓸 수 있는 시간이 일주일에 얼마나 되세요?',
        options: ['거의 없음(지금은 여력이 안 됨)', '2시간 이하', '3~5시간', '6~10시간', '10시간 이상'] },
      { key: 'energyLevel', type: 'single', question: '요즘 몸과 마음의 에너지는 어때요?',
        options: ['번아웃에 가까움', '좀 지쳐 있음', '보통', '여유 있음'] },
    ],
  },
  {
    title: '당신에 대해',
    questions: [
      { key: 'flowMoment', type: 'text', question: '최근 1년 중, 시간 가는 줄 모르고 몰입했던 일이 있다면?',
        placeholder: '예: 새 기획안을 짤 때 / 누군가에게 뭔가 가르쳐줄 때 / 문제를 파고들어 답을 찾아냈을 때' },
      { key: 'mustKeep', type: 'multi', question: '무엇을 바꾸든, 이것만은 지키고 싶은 게 있다면? (최대 2개)', max: 2,
        options: ['지금 수준의 수입', '시간 여유', '사는 지역', '사람·관계', '인정받는 느낌', '안정성', '성장하는 감각', '자율성', '가족과의 시간', '건강·체력'] },
    ],
  },
];

const EMPTY: PaidAnswers = {
  workStatus: '', maritalStatus: '', dependents: '',
  trigger: '', candidateDirection: '',
  runway: '', incomeFloor: '', weeklyTime: '', energyLevel: '',
  flowMoment: '', mustKeep: [],
};

export default function PaidQuestionsView({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<PaidAnswers>(EMPTY);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // 진행 게이트: 현재 스텝의 single 문항이 모두 선택되면 다음으로. (자유입력·다중선택은 선택)
  const canProceed = useMemo(
    () => step.questions.every((q) => q.type !== 'single' || (answers[q.key] as string) !== ''),
    [step, answers],
  );

  const setSingle = (key: SingleKey, value: string) => setAnswers((a) => ({ ...a, [key]: value }));
  const setText = (key: TextKey, value: string) => setAnswers((a) => ({ ...a, [key]: value }));
  const toggleMulti = (value: string, max: number) => setAnswers((a) => {
    const cur = a.mustKeep;
    if (cur.includes(value)) return { ...a, mustKeep: cur.filter((v) => v !== value) };
    if (cur.length >= max) return a; // 상한 도달 → 무시
    return { ...a, mustKeep: [...cur, value] };
  });

  const goNext = () => {
    if (!canProceed) return;
    // 화면 이동 전에 저장 — React state가 소실(새로고침·탭 재적재)돼도 결과 화면이 복구한다.
    if (isLast) { storePaidAnswers(answers); onComplete(answers); window.location.hash = '#paid-result'; return; }
    setStepIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    if (stepIndex === 0) { window.location.hash = '#paid-preview'; return; }
    setStepIndex((i) => i - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-1.5 font-black text-sm" style={{ color: '#5E5280' }}>
          <span aria-hidden>🧭</span> Career Compass <span className="font-bold" style={{ color: '#C7BBDE' }}>심화 분석</span>
        </div>
      </header>

      {/* 진행 바 */}
      <div className="h-0.5 w-full bg-slate-100">
        <div className="h-0.5 transition-[width] duration-300"
          style={{ width: `${Math.round(((stepIndex + 1) / STEPS.length) * 100)}%`, background: '#8C6FD6' }} />
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-7">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
            {stepIndex + 1} / {STEPS.length}
          </p>
          <h1 className="text-lg font-black text-slate-800 mt-1">{step.title}</h1>
        </div>

        {step.questions.map((q) => (
          <div key={q.key} className="space-y-2.5">
            <p className="text-[15px] font-bold text-slate-800">{q.question}</p>

            {q.type === 'single' && (
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const selected = (answers[q.key] as string) === opt;
                  return (
                    <button key={opt} type="button" onClick={() => setSingle(q.key, opt)}
                      className="w-full text-left px-4 py-3 rounded-2xl border text-[14px] transition-colors"
                      style={selected
                        ? { borderColor: '#8C6FD6', background: '#F5F1FC', color: '#3E356B', fontWeight: 700 }
                        : { borderColor: '#E2E8F0', background: '#FFFFFF', color: '#334155' }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                value={answers[q.key] as string}
                onChange={(e) => setText(q.key, e.target.value)}
                placeholder={q.placeholder}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 resize-none"
                style={{ boxShadow: 'none' }}
              />
            )}

            {q.type === 'multi' && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">최대 {q.max}개 선택 · {answers.mustKeep.length}개 선택됨</p>
                {q.options.map((opt) => {
                  const selected = answers.mustKeep.includes(opt);
                  const disabled = !selected && answers.mustKeep.length >= q.max;
                  return (
                    <button key={opt} type="button" disabled={disabled} onClick={() => toggleMulti(opt, q.max)}
                      className="w-full text-left px-4 py-3 rounded-2xl border text-[14px] transition-colors disabled:opacity-40"
                      style={selected
                        ? { borderColor: '#8C6FD6', background: '#F5F1FC', color: '#3E356B', fontWeight: 700 }
                        : { borderColor: '#E2E8F0', background: '#FFFFFF', color: '#334155' }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* 하단 고정 네비게이션 */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button type="button" onClick={goBack}
            className="px-4 py-3 text-sm text-slate-500 hover:text-slate-800">이전</button>
          <button type="button" onClick={goNext} disabled={!canProceed}
            className="flex-1 py-3.5 rounded-2xl text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#8C6FD6', boxShadow: '0 2px 8px rgba(140,111,214,0.28)' }}>
            {isLast ? '분석 결과 보기' : '다음'} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
