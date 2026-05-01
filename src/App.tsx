import { useState } from 'react';
import './index.css';
import LandingPage from './components/LandingPage';
import InputForm from './components/InputForm';
import ResultsDashboard from './components/ResultsDashboard';
import type { FormData, Results } from './types';
import { calculateResults } from './utils/scoring';

type Page = 'landing' | 'form' | 'results';
const FORM_DRAFT_KEY = 'career-compass-form-draft-v1';

export default function App() {
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
