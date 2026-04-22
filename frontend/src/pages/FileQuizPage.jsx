import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import QuestionCard from '../components/QuestionCard';
import ContentSection from '../components/ContentSection';
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
  const [roundDescription, setRoundDescription] = useState('');
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
        setRoundDescription(data.data.description || '');
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

  function startFollowUp(fu) {
    if (!fu?.questions?.length) return;
    setQuestions(fu.questions);
    setRoundDescription(fu.description || '');
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
  /** Jeden ďalší krok pri rozpracovanom teste: najprv materiály, inak doplňujúci test. */
  const canShowNextStepBanner =
    phase === 'taking' &&
    isMain &&
    ((learningBundle?.sections?.length > 0 || false) ||
      (storedFollowUp?.questions?.length > 0 || false));
  const nextStepPrefersLearning = (learningBundle?.sections?.length > 0 || false);
  const hasLearningAfterMain =
    results && (results.fileLearningContent?.sections?.length > 0 || false);
  const hasFollowUpAfterMain =
    results && (results.followUpQuiz?.questions?.length > 0 || false);
  const followUpToUse = results?.followUpQuiz || storedFollowUp;

  return (
    <div className="page-wrapper file-quiz-page">
      <Navigation />

      <div className="assessment-container">
        <div className="assessment-header">
          <Link to="/admin" className="file-quiz-back">
            ← Späť na zoznam súborov
          </Link>
          {phase === 'learning' && (
            <>
              <h1>Učebné materiály</h1>
              {fileName && <p className="test-description">{fileName}</p>}
              <p className="test-description">
                AI výklad k témam, v ktorých hlavný test vychytal chyby — oplatí sa prejsť pred doplňujúcim
                kolom.
              </p>
              <button type="button" className="file-quiz-text-back" onClick={backFromLearning}>
                ← {results ? 'Späť na výsledky' : 'Späť na test'}
              </button>
            </>
          )}
          {phase !== 'learning' && (
            <>
          <h1>{isMain ? 'Test z vlastného súboru' : 'Doplňujúci test'}</h1>
          {fileName && <p className="test-description">{fileName}</p>}
          {phase === 'taking' && questions.length > 0 && (
            <>
              {roundDescription && (
                <p className="test-description file-quiz-desc-inline">{roundDescription}</p>
              )}
              <div className="progress-info">
                Otázka {currentQuestionIndex + 1} z {questions.length} · zodpovedané {answeredCount}/
                {questions.length}
                {!isMain && ' · podľa chýb z hlavného kola'}
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
            <div className="file-quiz-learning-footer">
              {followUpToUse?.questions?.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary file-quiz-cta-sole"
                  onClick={() => startFollowUp(followUpToUse)}
                >
                  Pokračovať na doplňujúci test ({followUpToUse.questionCount} otázok)
                </button>
              ) : (
                <p className="file-quiz-learning-hint">
                  Doplňujúci test nie je k dispozícii (nepodarilo sa vygenerovať alebo boli všetky odpovede
                  správne).
                </p>
              )}
              <Link to="/admin" className="file-quiz-text-link-footer">
                Späť na zoznam súborov
              </Link>
            </div>
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

        {canShowNextStepBanner && (
          <div className="file-quiz-next-step file-quiz-panel">
            {nextStepPrefersLearning ? (
              <>
                <p>
                  Máš pripravené <strong>učebné materiály</strong> (AI) k chybám z posledného vyhodnotenia — odporúčame
                  ich prejsť pred doplňujúcim testom{storedFollowUp?.questions?.length
                    ? ` (${storedFollowUp.questionCount} otázok).`
                    : '.'}
                </p>
                <button type="button" className="btn btn-primary file-quiz-cta-sole" onClick={() => goToLearning()}>
                  Otvoriť učebné materiály
                </button>
              </>
            ) : (
              <>
                <p>
                  Máš pripravené <strong>doplňujúce otázky</strong> k oblastiam, ktoré v hlavnom teste ešte treba
                  upevniť.
                </p>
                <button
                  type="button"
                  className="btn btn-primary file-quiz-cta-sole"
                  onClick={() => startFollowUp(storedFollowUp)}
                >
                  Začať doplňujúci test ({storedFollowUp.questionCount} otázok)
                </button>
              </>
            )}
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
              AI (Gemini) vytvorí 6 otázok s výberom odpovede z textu tvojho súboru — rovnaký štýl ako pri
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

            <div className="file-quiz-question-nav">
              {currentQuestionIndex > 0 && (
                <button
                  type="button"
                  className="file-quiz-text-back file-quiz-nav-back"
                  onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                >
                  ← Predchádzajúca otázka
                </button>
              )}
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary file-quiz-cta-sole"
                  onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                >
                  Ďalšia otázka →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary file-quiz-cta-sole"
                  disabled={submitting || answeredCount < questions.length}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? isMain
                      ? 'Generujem učebné materiály a doplňujúci test...'
                      : 'Odosielam...'
                    : isMain
                    ? 'Vyhodnotiť test'
                    : 'Vyhodnotiť doplňujúci test'}
                </button>
              )}
            </div>

            {isMain && (
              <p className="file-quiz-regen">
                <button
                  type="button"
                  className="file-quiz-link-btn"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  Vygenerovať nový test (prepíše starý)
                </button>
              </p>
            )}
          </>
        )}

        {phase === 'results' && results && (
          <div className="results-container">
            <div className="results-header">
              <h1>Výsledok (hlavný test)</h1>
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

            {(hasLearningAfterMain || (hasFollowUpAfterMain && !hasLearningAfterMain)) && (
              <div className="file-quiz-next-step file-quiz-panel">
                {hasLearningAfterMain ? (
                  <>
                    <p>
                      Podľa chýb je k dispozícii <strong>krátky výklad z dokumentu</strong> (AI) — vhodné zvládnuť
                      pred doplňujúcim testom
                      {hasFollowUpAfterMain ? ` (${results.followUpQuiz.questionCount} doplňujúcich otázok).` : '.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary file-quiz-cta-sole"
                      onClick={() => goToLearning()}
                    >
                      Pokračovať na učebné materiály
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Je pripravený <strong>doplňujúci test</strong> ({results.followUpQuiz.questionCount} otázok) k
                      oblastiam, ktoré ešte treba upevniť.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary file-quiz-cta-sole"
                      onClick={() => startFollowUp(results.followUpQuiz)}
                    >
                      Pokračovať na doplňujúci test
                    </button>
                  </>
                )}
              </div>
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

            <div className="file-quiz-results-footer">
              <Link to="/admin" className="btn btn-primary file-quiz-cta-sole">
                Späť na zoznam súborov
              </Link>
              <button type="button" className="file-quiz-text-link-standalone" onClick={() => loadQuiz()}>
                Znova vyplniť tento test
              </button>
            </div>
          </div>
        )}

        {phase === 'followUpResults' && followUpResults && (
          <div className="results-container">
            <div className="results-header">
              <h1>Výsledok (doplňujúci test)</h1>
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

            <div className="file-quiz-results-footer">
              <Link to="/admin" className="btn btn-primary file-quiz-cta-sole">
                Späť na zoznam súborov
              </Link>
              <button type="button" className="file-quiz-text-link-standalone" onClick={() => loadQuiz()}>
                Späť na hlavný test
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
