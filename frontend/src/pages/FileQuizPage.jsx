import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import QuestionCard from '../components/QuestionCard';
import ContentSection from '../components/ContentSection';
import './AssessmentPage.css';
import './FileQuizPage.css';

/** Názov súboru v hlavičke (bez .pdf a pod. prípon). */
function fileDisplayName(name) {
  if (!name) return '';
  return String(name).replace(/\.pdf$/i, '');
}

export default function FileQuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, getAuthHeaders, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [fileName, setFileName] = useState('');
  const [round, setRound] = useState('main');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [followUpResults, setFollowUpResults] = useState(null);
  const [storedFollowUp, setStoredFollowUp] = useState(null);
  const [fileLearning, setFileLearning] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate('/login', {
        replace: true,
        state: { from: { pathname: location.pathname, search: location.search } }
      });
      return;
    }
    if (!id || id === 'undefined') {
      setError('Chýba identifikátor súboru.');
      setPhase('error');
      return;
    }
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- načítanie pri zmene id/token/auth
  }, [id, token, authLoading]);

  async function loadQuiz() {
    setError(null);
    setPhase('loading');
    setAnswers({});
    setCurrentQuestionIndex(0);
    setResults(null);
    setFollowUpResults(null);
    setFileLearning(null);
    setRound('main');

    try {
      const res = await fetch(`${API_BASE_URL}/files/${id}/quiz`, { headers: getAuthHeaders() });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(
          'Server vrátil neplatnú odpoveď (nie JSON). Skontroluj backend a že voláš správne /api/files/…/quiz.'
        );
        setPhase('error');
        return;
      }

      if (data.success) {
        setQuestions(data.data.questions);
        setFileName(data.data.fileName);
        setStoredFollowUp(
          data.data.followUpQuiz && data.data.followUpQuiz.questions?.length ? data.data.followUpQuiz : null
        );
        setFileLearning(
          data.data.fileLearningContent?.sections?.length ? data.data.fileLearningContent : null
        );
        setPhase('taking');
        return;
      }

      if (data.error?.code === 'QUIZ_NOT_GENERATED') {
        const fr = await fetch(`${API_BASE_URL}/files`, { headers: getAuthHeaders() });
        const fText = await fr.text();
        let fd = {};
        try {
          fd = fText ? JSON.parse(fText) : {};
        } catch {
          /* ignore */
        }
        const f = fd.data?.find((x) => String(x.id) === String(id));
        if (f) setFileName(f.file_name);
        setPhase('generate');
        return;
      }

      setError(data.error?.message || 'Nepodarilo sa načítať test');
      setPhase('error');
    } catch (e) {
      setError(e.message || 'Chyba siete');
      setPhase('error');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setPhase('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/files/${id}/quiz/generate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionCount: 8 })
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server vrátil neplatnú odpoveď (HTTP ${res.status}). Skontroluj log Vercelu / backendu.`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || `Generovanie zlyhalo (HTTP ${res.status})`);
      }
      await loadQuiz();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await loadQuiz();
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  function startFollowUp(fu) {
    if (!fu?.questions?.length) return;
    setQuestions(fu.questions);
    setRound('followUp');
    setAnswers({});
    setCurrentQuestionIndex(0);
    setPhase('taking');
  }

  function goToLearning() {
    if (results?.fileLearningContent?.sections?.length) {
      setFileLearning(results.fileLearningContent);
    }
    setPhase('learning');
  }

  function backFromLearning() {
    if (results) setPhase('results');
    else setPhase('taking');
  }

  function handleAnswer(questionId, selectedOptionIndex) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        selectedOptionIndex,
        answeredAt: new Date().toISOString()
      }
    }));
  }

  async function handleSubmit() {
    const ordered = questions.map((q) => answers[q.id]).filter(Boolean);
    if (ordered.length < questions.length) {
      alert(`Odpovedz na všetky otázky (${ordered.length}/${questions.length})`);
      return;
    }

    setSubmitting(true);
    const isFollowUp = round === 'followUp';
    try {
      const res = await fetch(`${API_BASE_URL}/files/${id}/quiz/submit`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: ordered,
          ...(isFollowUp ? { quizPhase: 'followUp' } : {})
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Odoslanie zlyhalo');
      if (isFollowUp) {
        setFollowUpResults(data.data);
        setPhase('followUpResults');
        return;
      }
      setResults(data.data);
      if (data.data.followUpQuiz) {
        setStoredFollowUp(data.data.followUpQuiz);
      } else {
        setStoredFollowUp(null);
      }
      if (data.data.fileLearningContent?.sections?.length) {
        setFileLearning(data.data.fileLearningContent);
      } else {
        setFileLearning(null);
      }
      setPhase('results');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const currentQ = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => answers[q.id] != null).length;
  const isMain = round === 'main';
  const learningBundle = fileLearning;
  const hasLearningAfterMain =
    results && (results.fileLearningContent?.sections?.length > 0 || false);
  const hasFollowUpAfterMain =
    results && (results.followUpQuiz?.questions?.length > 0 || false);
  const followUpToUse = results?.followUpQuiz || storedFollowUp;

  return (
    <div className="page-wrapper">
      <Navigation />

      <div className="assessment-container file-quiz-page">
        <div className="assessment-header">
          <Link to="/admin" className="file-quiz-back">
            ← Späť na zoznam súborov
          </Link>
          {phase === 'learning' && (
            <>
              <h1>Učebné materiály</h1>
              {fileName && <p className="test-description">{fileName}</p>}
              <p className="test-description">Personalizovaný výklad k tvojim odpovediam.</p>
              <button type="button" className="file-quiz-text-back" onClick={backFromLearning}>
                ← {results ? 'Späť na výsledky' : 'Späť na test'}
              </button>
            </>
          )}
          {phase !== 'learning' && (
            <>
          <h1>{isMain ? 'Test z dokumentu' : 'Doplňujúci test'}</h1>
          {fileName && <p className="test-description">{fileDisplayName(fileName)}</p>}
          {phase === 'taking' && questions.length > 0 && (
            <>
              <div className="progress-info">
                Otázka {currentQuestionIndex + 1} z {questions.length}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </>
          )}
            </>
          )}
        </div>

        {phase === 'learning' && learningBundle?.sections?.length > 0 && (
          <div className="file-quiz-learning-body">
            {learningBundle.sections.map((s) => (
              <ContentSection
                key={`${s.order ?? ''}-${(s.heading || '').slice(0, 24)}`}
                section={s}
              />
            ))}
            {followUpToUse?.questions?.length > 0 ? (
              <div className="results-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={() => startFollowUp(followUpToUse)}
                >
                  Pokračovať na doplňujúci test →
                </button>
              </div>
            ) : null}
          </div>
        )}

        {phase === 'learning' && (!learningBundle?.sections || learningBundle.sections.length === 0) && (
          <div className="file-quiz-panel error">
            <p>Učebné materiály sa nepodarilo zobraziť. Skús znova načítať stránku.</p>
            <button type="button" className="btn btn-primary" onClick={backFromLearning}>
              Späť
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="loading file-quiz-center">Načítavam...</div>
        )}

        {phase === 'error' && (
          <div className="file-quiz-panel error">
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/admin')}>
              Späť na zoznam súborov
            </button>
          </div>
        )}

        {phase === 'generate' && (
          <div className="file-quiz-panel">
            <h2>Vytvoriť test z dokumentu</h2>
            <p>
              AI (Gemini) vytvorí 8 otázok s výberom odpovede z textu tvojho súboru — rovnaký štýl ako pri
              testoch k témam v kurze. Funguje to len z extrahovateľného textu (PDF/TXT a pod.); čisté obrázky
              v PDF bez textu nestačia.
            </p>
            {error && <div className="file-quiz-err">⚠️ {error}</div>}
            <button
              type="button"
              className="btn btn-primary"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generujem test (môže trvať 30–60 s)...' : 'Vygenerovať test'}
            </button>
          </div>
        )}

        {phase === 'taking' && currentQ && (
          <>
            <QuestionCard
              question={currentQ}
              selectedAnswer={answers[currentQ.id]?.selectedOptionIndex}
              onAnswer={(idx) => handleAnswer(currentQ.id, idx)}
            />

            <div className="navigation-buttons">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                disabled={currentQuestionIndex === 0}
                className="btn btn-secondary"
              >
                ← Späť
              </button>
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                  className="btn btn-primary"
                  disabled={answers[currentQ.id] == null}
                >
                  Ďalej →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting || answeredCount < questions.length}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? isMain
                      ? 'Odosielam...'
                      : 'Odosielam...'
                    : isMain
                    ? 'Odoslať test'
                    : 'Odoslať test'}
                </button>
              )}
            </div>

            {submitting && (
              <div className="submitting-overlay">
                <div className="submitting-content">
                  <div className="spinner" />
                  <p>{isMain ? 'Vyhodnocujem test a pripravujem ďalšie kroky...' : 'Vyhodnocujem test...'}</p>
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'results' && results && (
          <div className="results-container">
            <div className="results-header">
              <h1>Výsledok</h1>
              <div className="score-display">
                <div className="score-circle">
                  <span className="score-number">{results.score.percentage}%</span>
                </div>
                <p className="score-text">
                  {results.score.correctCount} z {results.score.totalCount} správne
                </p>
              </div>
            </div>

            {results.learningError && (
              <p className="file-quiz-followup-warn" role="alert">
                Učebné materiály sa nepodarilo vygenerovať: {results.learningError}
              </p>
            )}

            {results.followUpError && (
              <p className="file-quiz-followup-warn" role="alert">
                Doplňujúce otázky sa nepodarilo vygenerovať: {results.followUpError}
              </p>
            )}

            <div className="detailed-results">
              <h2>Detailné výsledky</h2>
              {results.detailedResults.map((r, index) => (
                <div
                  key={r.questionId}
                  className={`result-item ${r.wasCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div className="result-number">
                    {r.wasCorrect ? '✓' : '✗'} Otázka {index + 1}
                  </div>
                  <div className="result-question">{r.questionText}</div>
                  {!r.wasCorrect && (
                    <div className="result-answers">
                      <div className="result-answer wrong">
                        <strong>Vaša odpoveď:</strong> {r.userSelectedOption ?? '—'}
                      </div>
                      <div className="result-answer correct-answer">
                        <strong>Správna odpoveď:</strong> {r.correctOption}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasLearningAfterMain && (
              <div className="results-actions file-quiz-results-cta-bottom">
                <button type="button" className="btn btn-primary btn-large" onClick={() => goToLearning()}>
                  Pokračovať na učebné materiály →
                </button>
              </div>
            )}

            {hasFollowUpAfterMain && !hasLearningAfterMain && (
              <div className="results-actions file-quiz-results-cta-bottom">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={() => startFollowUp(results.followUpQuiz)}
                >
                  Pokračovať na doplňujúci test →
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'followUpResults' && followUpResults && (
          <div className="results-container">
            <div className="results-header">
              <h1>Výsledok doplňujúceho testu</h1>
              {fileName && <p className="test-description">{fileDisplayName(fileName)}</p>}
              <div className="score-display">
                <div className="score-circle">
                  <span className="score-number">{followUpResults.score.percentage}%</span>
                </div>
                <p className="score-text">
                  {followUpResults.score.correctCount} z {followUpResults.score.totalCount} správne
                </p>
              </div>
            </div>

            <div className="detailed-results">
              <h2>Detailné výsledky</h2>
              {followUpResults.detailedResults.map((r, index) => (
                <div
                  key={r.questionId}
                  className={`result-item ${r.wasCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div className="result-number">
                    {r.wasCorrect ? '✓' : '✗'} Otázka {index + 1}
                  </div>
                  <div className="result-question">{r.questionText}</div>
                  {!r.wasCorrect && (
                    <div className="result-answers">
                      <div className="result-answer wrong">
                        <strong>Vaša odpoveď:</strong> {r.userSelectedOption ?? '—'}
                      </div>
                      <div className="result-answer correct-answer">
                        <strong>Správna odpoveď:</strong> {r.correctOption}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="results-actions">
              <Link to="/admin" className="btn btn-primary btn-large">
                Späť na zoznam súborov
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
