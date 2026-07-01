import { useEffect, useState } from 'react';
import './index.css';
import LandingPage from './components/LandingPage';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import CareerCompassV2Page from './components/careerCompassV2/CareerCompassV2Page';
import GuidedChatView from './components/chatV1/GuidedChatView';
import HybridFlowView from './components/hybridV3/HybridFlowView';
import PaidResultView from './components/paid/PaidResultView';
import PaidEntryBanner from './components/paid/PaidEntryBanner';
import PaidPreviewView from './components/paid/PaidPreviewView';
import PaidQuestionsView from './components/paid/PaidQuestionsView';
import type { PaidAnswers } from './components/paid/paidTypes';
import { FEATURE_FLAGS } from './config/featureFlags';
import { resolveRoute } from './lib/routing';
import type { Route } from './lib/routing';
import type { FormData, Results } from './types';
import { calculateResults } from './utils/scoring';

type Page = 'landing' | 'form' | 'results';
const FORM_DRAFT_KEY = 'career-compass-form-draft-v1';

// resolveRoute lives in src/lib/routing.ts so the hash mapping is
// unit-testable. App.tsx only owns the DOM read path + the React glue.

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window !== 'undefined' ? resolveRoute(window.location.hash) : 'v1',
  );
  useEffect(() => {
    const onChange = () => setRoute(resolveRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  // 유료 문항(PaidQuestionsView)이 모은 답변을 결과 화면으로 넘기기 위한 상위 상태.
  // App은 라우트가 바뀌어도 마운트 유지되므로 해시 이동 사이에도 값이 보존된다.
  const [paidAnswers, setPaidAnswers] = useState<PaidAnswers | null>(null);
  const paidOn = FEATURE_FLAGS.paidAnalysis;

  if (route === 'v2') return <CareerCompassV2Page />;
  if (route === 'chat') return <GuidedChatView />;
  // 무료 결과 화면. 플래그가 켜졌을 때만 결과 하단에 유료 진입 배너를 형제로 얹는다
  // (HybridFlowView 내부는 건드리지 않음). 플래그 off면 기존과 100% 동일.
  if (route === 'hybrid') {
    return paidOn
      ? (<><HybridFlowView /><PaidEntryBanner /></>)
      : <HybridFlowView />;
  }
  // 유료 퍼널 라우트: 플래그가 켜졌을 때만 접근 가능. 꺼져 있으면 무료 홈(hybrid)으로
  // 폴백해, 이 단계 배포 시 사용자 경험이 변하지 않게 한다(1단계와 동일 패턴).
  if (route === 'paidPreview') return paidOn ? <PaidPreviewView /> : <HybridFlowView />;
  if (route === 'paidQuestions') return paidOn ? <PaidQuestionsView onComplete={setPaidAnswers} /> : <HybridFlowView />;
  if (route === 'paid') return paidOn ? <PaidResultView paidAnswers={paidAnswers} /> : <HybridFlowView />;
  return <AppV1 />;
}

function AppV1() {
  const [page, setPage] = useState<Page>('landing');
  const [results, setResults] = useState<Results | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);

  const handleFormSubmit = (data: FormData) => {
    const r = calculateResults(data);
    setFormData(data);
    setResults(r);
    setPage('results');
    // Scroll to top after navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    localStorage.removeItem(FORM_DRAFT_KEY);
    setResults(null);
    setFormData(null);
    setPage('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {page === 'landing' && (
        <LandingPage onStart={() => setPage('form')} />
      )}
      {page === 'form' && (
        <InputForm onSubmit={handleFormSubmit} />
      )}
      {page === 'results' && results && formData && (
        <ResultsDashboard
          results={results}
          form={formData}
          onReset={handleReset}
        />
      )}
    </>
  );
}
