import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import QuestionCard from '../components/QuestionCard';
import './AssessmentPage.css';
import './FileQuizPage.css';

export default function FileQuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, getAuthHeaders, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);

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
        setDescription(data.data.description || '');
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
        body: JSON.stringify({ questionCount: 6 })
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
    try {
      const res = await fetch(`${API_BASE_URL}/files/${id}/quiz/submit`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: ordered })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Odoslanie zlyhalo');
      setResults(data.data);
      setPhase('results');
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentQ = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => answers[q.id] != null).length;

  return (
    <div className="page-wrapper file-quiz-page">
      <Navigation />

      <div className="assessment-container">
        <div className="assessment-header">
          <Link to="/admin" className="file-quiz-back">
            ← Späť na zoznam súborov
          </Link>
          <h1>Test z vlastného súboru</h1>
          {fileName && <p className="file-quiz-sub">{fileName}</p>}
        </div>

        {phase === 'loading' && (
          <div className="loading file-quiz-center">Načítavam...</div>
        )}

        {phase === 'error' && (
          <div className="file-quiz-panel error">
            <p>{error}</p>
            <button type="button" className="file-quiz-btn primary" onClick={() => navigate('/admin')}>
              Späť na zoznam súborov
            </button>
          </div>
        )}

        {phase === 'generate' && (
          <div className="file-quiz-panel">
            <h2>Vytvoriť test z dokumentu</h2>
            <p>
              AI (Gemini) vytvorí 6 otázok s výberom odpovede z textu tvojho súboru — rovnaký štýl ako pri
              testoch k témam v kurze. Funguje to len z extrahovateľného textu (PDF/TXT a pod.); čisté obrázky
              v PDF bez textu nestačia.
            </p>
            {error && <div className="file-quiz-err">⚠️ {error}</div>}
            <button
              type="button"
              className="file-quiz-btn primary"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generujem test (môže trvať 30–60 s)...' : 'Vygenerovať test'}
            </button>
          </div>
        )}

        {phase === 'taking' && currentQ && (
          <>
            {description && <p className="file-quiz-desc">{description}</p>}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <p className="question-counter">
              Otázka {currentQuestionIndex + 1} z {questions.length} · zodpovedané {answeredCount}/
              {questions.length}
            </p>

            <QuestionCard
              question={currentQ}
              selectedAnswer={answers[currentQ.id]?.selectedOptionIndex}
              onAnswer={(idx) => handleAnswer(currentQ.id, idx)}
            />

            <div className="navigation-buttons">
              <button
                type="button"
                className="nav-button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((i) => i - 1)}
              >
                ← Predchádzajúca
              </button>
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="nav-button primary"
                  onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                >
                  Ďalšia →
                </button>
              ) : (
                <button
                  type="button"
                  className="nav-button primary"
                  disabled={submitting || answeredCount < questions.length}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Odosielam...' : 'Vyhodnotiť test'}
                </button>
              )}
            </div>

            <p className="file-quiz-regen">
              <button type="button" className="link-btn" onClick={handleGenerate} disabled={generating}>
                Vygenerovať nový test (prepíše starý)
              </button>
            </p>
          </>
        )}

        {phase === 'results' && results && (
          <div className="results-section">
            <h2>Výsledok</h2>
            <div className="score-display">
              <span className="score-number">{results.score.percentage}%</span>
              <span className="score-label">
                {results.score.correctCount} z {results.score.totalCount} správne
              </span>
            </div>
            <ul className="file-quiz-detail-list">
              {results.detailedResults.map((r) => (
                <li key={r.questionId} className={r.wasCorrect ? 'ok' : 'bad'}>
                  <strong>{r.wasCorrect ? '✓' : '✗'}</strong> {r.questionText}
                  {!r.wasCorrect && (
                    <div className="file-quiz-correct-hint">
                      Správne: {r.correctOption}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="file-quiz-actions">
              <button type="button" className="file-quiz-btn" onClick={() => loadQuiz()}>
                Znova vyplniť tento test
              </button>
              <Link to="/admin" className="file-quiz-btn primary">
                Späť na zoznam súborov
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
