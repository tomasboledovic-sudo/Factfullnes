import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import QuestionCard from '../components/QuestionCard';
import './AssessmentPage.css';

function PostAssessmentPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [topicTitle, setTopicTitle] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startTime] = useState(Date.now());

  useEffect(() => {
    fetchQuestions();
  }, [sessionId]);

  const fetchQuestions = async () => {
    try {
      // Pre demo používame rovnaké otázky ako pre pre-test
      // V produkcii by ste mali mať samostatný endpoint
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
      // Volanie backend API
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/post-test/submit`, {
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
        const { postTestScore, detailedResults, improvement } = data.data;
        
        // Uloženie do localStorage
        localStorage.setItem('postTestScore', postTestScore.percentage);
        localStorage.setItem('improvement', improvement.toFixed(1));
        
        // Zobrazenie výsledkov
        setTestResults({
          postTestScore,
          detailedResults
        });
        setShowResults(true);
        setSubmitting(false);
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
    navigate(`/session/${sessionId}/results`);
  };

  if (loading) {
    return (
      <div className="container">
        <Navigation />
        <div className="loading">Načítavam test...</div>
      </div>
    );
  }

  // Zobrazenie výsledkov
  if (showResults && testResults) {
    const { postTestScore, detailedResults } = testResults;
    
    return (
      <div className="container">
        <Navigation />
        
        <div className="results-modal">
          <div className="results-header">
            <h1>Výsledky Výstupného Testu</h1>
            <div className="score-display">
              <div className="score-circle">
                <span className="score-number">{postTestScore.percentage}%</span>
              </div>
              <p className="score-text">
                {postTestScore.correctAnswers} z {postTestScore.totalQuestions} správne
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

          <div className="results-actions">
            <button onClick={handleContinue} className="btn btn-primary btn-large">
              Zobraziť Finálne Výsledky →
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
    <div className="container">
      <Navigation />
      
      <div className="assessment-container">
        <div className="assessment-header">
          <h1>Výstupný Test</h1>
          <h2>{topicTitle}</h2>
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
              {submitting ? 'Vyhodnocujem...' : 'Odoslať Test'}
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

export default PostAssessmentPage;

