import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import ContentSection from '../components/ContentSection';
import QuestionCard from '../components/QuestionCard';
import './LearningPage.css';

function LearningPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [preTestScore, setPreTestScore] = useState(0);
  const [preTestDetail, setPreTestDetail] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Záverečný test state
  const [finalTest, setFinalTest] = useState(null);
  const [testGenerating, setTestGenerating] = useState(true);
  const [testReady, setTestReady] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [testAnswers, setTestAnswers] = useState({});
  const [showTestResults, setShowTestResults] = useState(false);
  const [testScore, setTestScore] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const startTimeRef = useRef(Date.now());
  const contentRef = useRef(null);
  const pollingRef = useRef(null);
  const testGenStartedRef = useRef(false);

  useEffect(() => {
    fetchContent();
    
    // Timer
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    // Scroll progress
    const handleScroll = () => {
      if (contentRef.current) {
        const element = contentRef.current;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight - element.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        setScrollProgress(Math.min(progress, 100));
      }
    };

    return () => {
      clearInterval(timerInterval);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [sessionId]);

  const fetchContent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/content`, {
        cache: 'no-store'
      });
      const data = await response.json();
      
      if (data.success) {
        setContent(data.data);
        setTopicTitle(data.data.topicTitle);
        setPreTestScore(data.data.preTestScore);
        setPreTestDetail(data.data.preTestDetail || null);
        
        if (data.data.finalTest != null) {
          setFinalTest(data.data.finalTest);
          setTestReady(true);
          setTestGenerating(false);
        } else {
          startTestGeneration();
        }
      } else {
        alert('Nepodarilo sa načítať obsah');
        navigate('/');
      }
    } catch (err) {
      alert('Chyba pri načítaní obsahu');
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateContent = async () => {
    if (
      !window.confirm(
        'Znova vygenerovať učebné materiály pomocou AI? Uložený záverečný test sa zruší a pripraví sa znovu z nového textu.'
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/regenerate-content`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || 'Nepodarilo sa obnoviť materiály');
        return;
      }
      testGenStartedRef.current = false;
      setFinalTest(null);
      setTestReady(false);
      setTestGenerating(true);
      setLoading(true);
      await fetchContent();
    } catch (e) {
      console.error(e);
      alert('Chyba pri obnovení materiálov');
    } finally {
      setRegenerating(false);
    }
  };

  // Spustenie generovania záverečného testu — zavolá sa iba raz
  const startTestGeneration = async () => {
    if (testGenStartedRef.current) return;
    testGenStartedRef.current = true;

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/generate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (data.data?.status === 'ready') {
        const found = await fetchFinalTest();
        if (found) return;
      }
    } catch (err) {
      console.error('Chyba pri spúšťaní generovania testu:', err);
    }

    pollTestStatus();
  };

  // Polling pre stav testu — bez časového obmedzenia, beží kým test nie je hotový
  const pollTestStatus = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/test/status`);
        const data = await response.json();
        
        if (data.success && data.data.ready) {
          clearInterval(pollingRef.current);
          await fetchFinalTest();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // Načítanie finálneho testu
  const fetchFinalTest = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/content`, {
        cache: 'no-store'
      });
      const data = await response.json();
      
      if (data.success && data.data.finalTest != null) {
        setFinalTest(data.data.finalTest);
        setTestReady(true);
        setTestGenerating(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Chyba pri načítaní testu:', err);
      return false;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Test handlers
  const handleTestAnswer = (questionIndex, selectedOptionIndex) => {
    setTestAnswers({
      ...testAnswers,
      [questionIndex]: selectedOptionIndex
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < finalTest.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleStartTest = () => {
    setShowTest(true);
    setCurrentQuestionIndex(0);
  };

  function applyPostSubmitResult(d) {
    setTestScore({
      percentage: d.postTestScore?.percentage,
      correctCount: d.postTestScore?.correctAnswers,
      totalQuestions: d.postTestScore?.totalQuestions,
      detailedResults: d.detailedResults,
      improvement: d.improvementPercentPoints ?? d.improvement,
      improvementPoints: d.improvementPoints,
      improvementPercentPoints: d.improvementPercentPoints,
      preTestScorePct: d.preTestScore,
      weaknessRound: d.weaknessRoundScore,
      combinedScore: d.combinedScore
    });
    setShowTestResults(true);
  }

  const handleFinishWithoutFinalTest = async () => {
    try {
      const timeSpentSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/post-test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds })
      });
      const data = await response.json();
      if (data.success) applyPostSubmitResult(data.data);
      else alert(data.error?.message || 'Chyba');
    } catch (err) {
      console.error(err);
      alert('Chyba pri dokončení');
    }
  };

  const handleSubmitFinalTest = async () => {
    const answeredCount = Object.keys(testAnswers).length;
    if (answeredCount < finalTest.questions.length) {
      alert(`Prosím odpovedzte na všetky otázky (${answeredCount}/${finalTest.questions.length})`);
      return;
    }

    try {
      const timeSpentSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      const answersArray = finalTest.questions.map((_, index) => ({
        questionId: index,
        selectedOptionIndex: testAnswers[index],
        answeredAt: new Date().toISOString()
      }));

      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/post-test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersArray,
          timeSpentSeconds
        })
      });

      const data = await response.json();

      if (data.success) applyPostSubmitResult(data.data);
      else alert('Chyba pri odosielaní testu');
    } catch (err) {
      console.error('Chyba:', err);
      alert('Chyba pri odosielaní testu');
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleRepeatTopic = () => {
    const topicId = localStorage.getItem('currentTopicId');
    if (topicId) {
      // Vytvoriť novú session
      navigate('/');
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Načítavam učebný materiál...</div>
      </div>
    );
  }

  // Výsledky záverečného testu
  if (showTestResults && testScore) {
    return (
      <div className="page-wrapper">
        <Navigation />
        
        <div className="results-container">
          <div className="results-header">
            <h1>🎉 Výsledky</h1>
            
            <div className="score-display">
              <div className="score-circle large">
                <span className="score-number">{testScore.combinedScore?.percentage ?? testScore.percentage}%</span>
              </div>
              <p className="score-text">
                Celkové skóre: {testScore.combinedScore
                  ? `${testScore.combinedScore.correct} z ${testScore.combinedScore.total} správne`
                  : `${testScore.correctCount} z ${testScore.totalQuestions} správne`}
              </p>
              {testScore.weaknessRound && testScore.weaknessRound.totalQuestions > 0 && (
                <p className="score-subline">
                  Záverečný test (otázky, ktoré si predtým netrafil):{' '}
                  {testScore.weaknessRound.correctAnswers}/{testScore.weaknessRound.totalQuestions} (
                  {testScore.weaknessRound.percentage}%)
                </p>
              )}
            </div>
          </div>

          <div className="comparison-section">
            <div className="comparison-row">
              <div className="comparison-item">
                <span className="label">Vstupný test</span>
                <span className="value">
                  {preTestDetail
                    ? `${preTestDetail.label} (${Number(testScore.preTestScorePct ?? preTestScore).toFixed(1)}%)`
                    : `${Number(testScore.preTestScorePct ?? preTestScore).toFixed(0)}%`}
                </span>
              </div>
              <div className="comparison-arrow">+</div>
              <div className="comparison-item">
                <span className="label">Body zo záverečného</span>
                <span className="value">
                  {testScore.improvementPoints != null
                    ? `${testScore.improvementPoints} / ${testScore.weaknessRound?.totalQuestions ?? '—'}`
                    : '—'}
                </span>
              </div>
              <div className="comparison-arrow">=</div>
              <div className="comparison-item">
                <span className="label">Spolu</span>
                <span className="value">
                  {testScore.combinedScore
                    ? `${testScore.combinedScore.correct}/${testScore.combinedScore.total}`
                    : `${testScore.correctCount}/${testScore.totalQuestions}`}
                </span>
              </div>
            </div>
            <div className={`improvement-badge ${(testScore.improvementPercentPoints ?? testScore.improvement) >= 0 ? 'positive' : 'negative'}`}>
              {(testScore.improvementPercentPoints ?? testScore.improvement) >= 0 ? '+' : ''}
              {(testScore.improvementPercentPoints ?? testScore.improvement).toFixed(1)} percentuálnych bodov
              {testScore.improvementPoints != null && testScore.combinedScore
                ? ` · +${testScore.improvementPoints} správnych odpovedí oproti vstupu`
                : ''}
            </div>
          </div>

          <div className="detailed-results">
            <h2>Detaily</h2>
            {testScore.detailedResults?.map((result, index) => (
              <div 
                key={index} 
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

          <div className="results-actions">
            <button onClick={handleRepeatTopic} className="btn btn-secondary">
              Zopakovať tému
            </button>
            <button onClick={handleGoHome} className="btn btn-primary">
              Späť na úvod
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Záverečný test
  if (showTest && finalTest) {
    const currentQuestion = finalTest.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / finalTest.questions.length) * 100;
    const isLastQuestion = currentQuestionIndex === finalTest.questions.length - 1;

    return (
      <div className="page-wrapper">
        <Navigation />
        
        <div className="assessment-container">
          <div className="assessment-header">
            <h1>Záverečný Test</h1>
            <p className="test-description">{finalTest.description}</p>
            <div className="progress-info">
              Otázka {currentQuestionIndex + 1} z {finalTest.questions.length}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <QuestionCard
            question={{
              id: currentQuestionIndex,
              questionText: currentQuestion.question,
              options: currentQuestion.options
            }}
            selectedAnswer={testAnswers[currentQuestionIndex]}
            onAnswer={(optionIndex) => handleTestAnswer(currentQuestionIndex, optionIndex)}
          />

          <div className="navigation-buttons">
            <button 
              onClick={handlePreviousQuestion} 
              disabled={currentQuestionIndex === 0}
              className="btn btn-secondary"
            >
              ← Späť
            </button>

            {!isLastQuestion ? (
              <button 
                onClick={handleNextQuestion}
                className="btn btn-primary"
                disabled={testAnswers[currentQuestionIndex] === undefined}
              >
                Ďalej →
              </button>
            ) : (
              <button 
                onClick={handleSubmitFinalTest}
                className="btn btn-primary"
                disabled={Object.keys(testAnswers).length < finalTest.questions.length}
              >
                Odoslať Test
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Učebný obsah
  return (
    <div className="page-wrapper">
      <Navigation />
      
      <div className="learning-container">
        <div className="learning-header">
          <h1>{topicTitle}</h1>
          <div className="learning-stats">
            <div className="stat">
              <span className="stat-label">Vstupný test:</span>
              <span className="stat-value">
                {preTestDetail
                  ? `${preTestDetail.label} (${preTestScore.toFixed(1)}%)`
                  : `${preTestScore.toFixed(0)}%`}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Čas:</span>
              <span className="stat-value">{formatTime(elapsedTime)}</span>
            </div>
          </div>
          <div className="learning-header-actions">
            <button
              type="button"
              className="btn btn-secondary learning-regenerate-btn"
              onClick={handleRegenerateContent}
              disabled={regenerating}
            >
              {regenerating ? 'Generujem…' : 'Znova vygenerovať materiály (AI)'}
            </button>
          </div>
        </div>

        <div className="learning-content" ref={contentRef}>
          {content?.sections.map((section, index) => (
            <ContentSection key={index} section={section} />
          ))}
        </div>

        <div className="learning-footer">
          {testReady && finalTest && finalTest.questions?.length > 0 ? (
            <button 
              onClick={handleStartTest}
              className="btn btn-primary btn-large"
            >
              Začať záverečný test ({finalTest.questions.length}{' '}
              {finalTest.questions.length === 1 ? 'otázka' : finalTest.questions.length < 5 ? 'otázky' : 'otázok'})
              {' '}→
            </button>
          ) : testReady && finalTest && (!finalTest.questions || finalTest.questions.length === 0) ? (
            <button
              type="button"
              onClick={handleFinishWithoutFinalTest}
              className="btn btn-primary btn-large"
            >
              Dokončiť — vstupný test bez chýb →
            </button>
          ) : testGenerating ? (
            <div className="test-generating">
              <div className="mini-spinner"></div>
              <span>Pripravujem záverečný test...</span>
            </div>
          ) : (
            <button 
              onClick={handleGoHome}
              className="btn btn-secondary btn-large"
            >
              Späť na úvod
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LearningPage;
