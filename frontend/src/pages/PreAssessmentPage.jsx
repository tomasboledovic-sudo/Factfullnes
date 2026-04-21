import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import QuestionCard from '../components/QuestionCard';
import './AssessmentPage.css';

function PreAssessmentPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [contentReady, setContentReady] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('Generujem učebné materiály...');
  const [questions, setQuestions] = useState([]);
  const [topicTitle, setTopicTitle] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startTime] = useState(Date.now());
  
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchQuestions();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [sessionId]);

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/pre-test`);
      const data = await response.json();
      
      if (data.success) {
        setQuestions(data.data.questions);
        setTopicTitle(data.data.topicTitle);
        if (data.data.topicId != null) {
          localStorage.setItem('currentTopicId', String(data.data.topicId));
        }
        if (data.data.topicTitle) {
          localStorage.setItem('currentTopicTitle', data.data.topicTitle);
        }
      } else {
        alert('Nepodarilo sa načítať otázky');
        navigate('/');
      }
    } catch (err) {
      alert('Chyba pri načítaní otázok');
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Polling pre stav generovania
  const startPolling = () => {
    let attempts = 0;
    const maxAttempts = 60; // Max 2 minúty (60 * 2s)
    
    const messages = [
      'Generujem učebné materiály...',
      'Analyzujem tvoje odpovede...',
      'Prispôsobujem obsah tvojim potrebám...',
      'Vytváram personalizovaný test...',
      'Dokončujem generovanie...'
    ];
    
    pollingRef.current = setInterval(async () => {
      attempts++;
      
      // Rotácia správ
      setGeneratingMessage(messages[Math.min(Math.floor(attempts / 4), messages.length - 1)]);
      
      try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/content/status`);
        const data = await response.json();
        
        if (data.success && data.data.ready) {
          clearInterval(pollingRef.current);
          setContentReady(true);
          setGeneratingMessage('Učebné materiály sú pripravené!');
        } else if (data.data.status === 'error') {
          clearInterval(pollingRef.current);
          setGeneratingMessage('Chyba pri generovaní. Skúste znova.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
      
      // Timeout po 2 minútach
      if (attempts >= maxAttempts) {
        clearInterval(pollingRef.current);
        setContentReady(true); // Aj tak povoliť pokračovanie
        setGeneratingMessage('Generovanie trvá dlhšie. Môžete pokračovať.');
      }
    }, 2000);
  };

  const handleAnswer = (questionId, selectedOptionIndex) => {
    setAnswers({
      ...answers,
      [questionId]: {
        questionId,
        selectedOptionIndex,
        answeredAt: new Date().toISOString()
      }
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      alert(`Prosím odpovedzte na všetky otázky (${answeredCount}/${questions.length})`);
      return;
    }

    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/pre-test/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: Object.values(answers),
          timeSpentSeconds
        })
      });

      const data = await response.json();

      if (data.success) {
        const perfect = data.data.perfectPreTest === true;
        if (!perfect) {
          localStorage.setItem('preTestScore', String(data.data.preTestScore.percentage));
        }

        setTestResults(data.data);
        setShowResults(true);
        setSubmitting(false);

        if (perfect) {
          setContentReady(true);
        } else {
          startPolling();
        }
      } else {
        alert(`Chyba: ${data.error?.message || 'Nepodarilo sa odoslať test'}`);
        setSubmitting(false);
      }
    } catch (err) {
      alert('Chyba pri odosielaní testu');
      console.error(err);
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    navigate(`/session/${sessionId}/learning`);
  };

  const handlePerfectGoHome = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('sessionStartTime');
    localStorage.removeItem('preTestScore');
    localStorage.removeItem('postTestScore');
    localStorage.removeItem('improvement');
    localStorage.removeItem('currentTopicId');
    localStorage.removeItem('currentTopicTitle');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Načítavam test...</div>
      </div>
    );
  }

  // Zobrazenie výsledkov
  if (showResults && testResults) {
    const { preTestScore, detailedResults, perfectPreTest } = testResults;

    if (perfectPreTest) {
      return (
        <div className="page-wrapper">
          <Navigation />

          <div className="results-container pre-test-perfect">
            <div className="results-header">
              <div className="perfect-badge" aria-hidden="true">
                🌟
              </div>
              <h1>Výborne!</h1>
              <p className="perfect-lead">
                Máš všetky otázky vo vstupnom teste správne ({preTestScore.correctAnswers} z{' '}
                {preTestScore.totalQuestions}) — tému už ovládaš na úrovni tohto testu.
              </p>
              <p className="perfect-hint">
                Učebné materiály pre túto tému ti teraz neukážeme; skús si vybrať{' '}
                <strong>inú tému</strong>, kde ešte môžeš naraziť na nové súvislosti alebo výzvy.
              </p>
            </div>

            <div className="results-actions">
              <button type="button" onClick={handlePerfectGoHome} className="btn btn-primary btn-large">
                Späť na výber tém
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="page-wrapper">
        <Navigation />

        <div className="results-container">
          <div className="results-header">
            <h1>Výsledky Vstupného Testu</h1>
            <div className="score-display">
              <div className="score-circle">
                <span className="score-number">{preTestScore.percentage}%</span>
              </div>
              <p className="score-text">
                {preTestScore.correctAnswers} z {preTestScore.totalQuestions} správne ({preTestScore.percentage}%)
              </p>
            </div>
          </div>

          <div className="detailed-results">
            <h2>Detailné Výsledky</h2>
            {detailedResults.map((result, index) => (
              <div
                key={result.questionId}
                className={`result-item ${result.wasCorrect ? 'correct' : 'incorrect'}`}
              >
                <div className="result-number">
                  {result.wasCorrect ? '✓' : '✗'} Otázka {index + 1}
                </div>
                <div className="result-question">{result.questionText}</div>
                <div className="result-answers">
                  <div className={`result-answer ${result.wasCorrect ? '' : 'wrong'}`}>
                    <strong>Vaša odpoveď:</strong> {result.userSelectedOption}
                  </div>
                  {!result.wasCorrect && (
                    <div className="result-answer correct-answer">
                      <strong>Správna odpoveď:</strong> {result.correctOption}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Status generovania */}
          <div className={`generation-status ${contentReady ? 'ready' : 'generating'}`}>
            {!contentReady && <div className="mini-spinner"></div>}
            <span>{generatingMessage}</span>
            {contentReady && <span className="check-icon">✓</span>}
          </div>

          <div className="results-actions">
            <button
              onClick={handleContinue}
              className={`btn btn-primary btn-large ${!contentReady ? 'btn-waiting' : ''}`}
              disabled={!contentReady}
            >
              {contentReady ? 'Pokračovať na Učebné Materiály →' : 'Čakám na materiály...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="page-wrapper">
      <Navigation />
      
      <div className="assessment-container">
        <div className="assessment-header">
          <h1>Vstupný Test</h1>
          <p className="test-description">{topicTitle}</p>
          <div className="progress-info">
            Otázka {currentQuestionIndex + 1} z {questions.length}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <QuestionCard
          question={currentQuestion}
          selectedAnswer={answers[currentQuestion.id]?.selectedOptionIndex}
          onAnswer={(optionIndex) => handleAnswer(currentQuestion.id, optionIndex)}
        />

        <div className="navigation-buttons">
          <button 
            onClick={handlePrevious} 
            disabled={currentQuestionIndex === 0}
            className="btn btn-secondary"
          >
            ← Späť
          </button>

          {!isLastQuestion ? (
            <button 
              onClick={handleNext}
              className="btn btn-primary"
              disabled={!answers[currentQuestion.id]}
            >
              Ďalej →
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={submitting || Object.keys(answers).length < questions.length}
            >
              {submitting ? 'Odosielam...' : 'Odoslať Test'}
            </button>
          )}
        </div>

        {submitting && (
          <div className="submitting-overlay">
            <div className="submitting-content">
              <div className="spinner"></div>
              <p>Vyhodnocujem test...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreAssessmentPage;
