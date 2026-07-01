import { useEffect, useState } from 'react';
import './index.css';
import LandingPage from './components/LandingPage';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import CareerCompassV2Page from './components/careerCompassV2/CareerCompassV2Page';
import GuidedChatView from './components/chatV1/GuidedChatView';
import HybridFlowView from './components/hybridV3/HybridFlowView';
import PaidResultView from './components/paid/PaidResultView';
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
  if (route === 'v2') return <CareerCompassV2Page />;
  if (route === 'chat') return <GuidedChatView />;
  if (route === 'hybrid') return <HybridFlowView />;
  // 유료 라우트: 플래그가 켜졌을 때만 접근 가능. 꺼져 있으면 무료 기본 화면
  // (hybrid = 홈)으로 리다이렉트해, 이 단계 배포 시 사용자 경험이 변하지 않게 한다.
  if (route === 'paid') return FEATURE_FLAGS.paidAnalysis ? <PaidResultView /> : <HybridFlowView />;
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
