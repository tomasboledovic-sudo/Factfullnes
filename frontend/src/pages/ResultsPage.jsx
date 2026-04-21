import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './ResultsPage.css';

function ResultsPage() {
  const navigate = useNavigate();
  
  const [restarting, setRestarting] = useState(false);
  
  const preTestScore = parseFloat(localStorage.getItem('preTestScore') || 0);
  const postTestScore = parseFloat(localStorage.getItem('postTestScore') || 0);
  const improvement = parseFloat(localStorage.getItem('improvement') || 0);
  const currentTopicId = parseInt(localStorage.getItem('currentTopicId'));
  const currentTopicTitle = localStorage.getItem('currentTopicTitle') || '';

  useEffect(() => {
    // Ak nemáme dáta, vrátime na homepage
    if (!preTestScore && !postTestScore) {
      navigate('/');
    }
  }, [preTestScore, postTestScore, navigate]);

  const getImprovementStatus = (improvement) => {
    if (improvement >= 20) return { label: 'Výborné!', class: 'excellent', emoji: '🎉' };
    if (improvement >= 10) return { label: 'Veľmi dobre!', class: 'good', emoji: '👏' };
    if (improvement >= 5) return { label: 'Dobre!', class: 'ok', emoji: '👍' };
    return { label: 'Pokračujte v učení', class: 'fair', emoji: '💪' };
  };

  const status = getImprovementStatus(improvement);

  const handleBackToTopics = () => {
    // Vyčistiť localStorage
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('preTestScore');
    localStorage.removeItem('postTestScore');
    localStorage.removeItem('improvement');
    localStorage.removeItem('currentTopicId');
    localStorage.removeItem('currentTopicTitle');
    
    navigate('/');
  };

  const handleRestartTest = async () => {
    if (!Number.isFinite(currentTopicId)) {
      alert('Nepodarilo sa načítať tému. Skús znova začať z úvodnej stránky.');
      return;
    }

    setRestarting(true);

    try {
      // Vytvorenie novej session pre tú istú tému
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ topicId: currentTopicId })
      });

      const data = await response.json();

      if (data.success) {
        const { sessionId } = data.data;
        
        // Vyčistiť staré dáta
        localStorage.removeItem('preTestScore');
        localStorage.removeItem('postTestScore');
        localStorage.removeItem('improvement');
        
        // Uložiť novú session
        localStorage.setItem('currentSessionId', sessionId);
        localStorage.setItem('sessionStartTime', Date.now());
        
        // Navigácia na vstupný test
        navigate(`/session/${sessionId}/pre-test`);
      } else {
        alert('Nepodarilo sa vytvoriť novú reláciu');
        setRestarting(false);
      }
    } catch (err) {
      alert('Chyba pri vytváraní novej relácie');
      console.error(err);
      setRestarting(false);
    }
  };

  return (
    <div className="container">
      <Navigation />
      
      <div className="results-container">
        <div className="results-hero">
          <div className="results-emoji">{status.emoji}</div>
          <h1 className={`results-status ${status.class}`}>{status.label}</h1>
          <p className="results-subtitle">
            Podarilo sa vám zlepšiť o {improvement.toFixed(1)} percentuálnych bodov!
          </p>
        </div>

        <div className="score-cards">
          <div className="score-card">
            <div className="score-card-label">Vstupný Test</div>
            <div className="score-card-value">{preTestScore.toFixed(1)}%</div>
            <div className="score-card-icon">📝</div>
          </div>

          <div className="score-card improvement-card">
            <div className="score-card-label">Zlepšenie</div>
            <div className="score-card-value">+{improvement.toFixed(1)}</div>
            <div className="score-card-icon">📈</div>
          </div>

          <div className="score-card">
            <div className="score-card-label">Výstupný Test</div>
            <div className="score-card-value">{postTestScore.toFixed(1)}%</div>
            <div className="score-card-icon">✅</div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Porovnanie Výsledkov</h3>
          <div className="bar-chart">
            <div className="bar-group">
              <div className="bar-label">Pred</div>
              <div className="bar-wrapper">
                <div 
                  className="bar bar-before" 
                  style={{ width: `${preTestScore}%` }}
                >
                  {preTestScore.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="bar-group">
              <div className="bar-label">Po</div>
              <div className="bar-wrapper">
                <div 
                  className="bar bar-after" 
                  style={{ width: `${postTestScore}%` }}
                >
                  {postTestScore.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="results-analysis">
          <h3>Analýza Vášho Pokroku</h3>
          <div className="analysis-content">
            {improvement >= 15 ? (
              <>
                <p className="analysis-point">
                  ✅ <strong>Výborný pokrok!</strong> Učebný materiál vám výrazne pomohol.
                </p>
                <p className="analysis-point">
                  ✅ <strong>Osvojené koncept:</strong> Rozumiete téme na vysokej úrovni.
                </p>
              </>
            ) : improvement >= 5 ? (
              <>
                <p className="analysis-point">
                  ✅ <strong>Dobrý pokrok!</strong> Zlepšili ste sa v pochopení témy.
                </p>
                <p className="analysis-point">
                  💡 <strong>Tip:</strong> Skúste si tému zopakovať pre ešte lepšie výsledky.
                </p>
              </>
            ) : (
              <>
                <p className="analysis-point">
                  💪 <strong>Začiatok je dobrý!</strong> Máte priestor na zlepšenie.
                </p>
                <p className="analysis-point">
                  📚 <strong>Odporúčanie:</strong> Zopakujte si materiál a skúste test znova.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="results-actions">
          <button 
            onClick={handleRestartTest}
            className="btn btn-secondary btn-large"
            disabled={restarting}
          >
            {restarting ? 'Reštartujem...' : '🔄 Zopakovať Test'}
          </button>
          <button 
            onClick={handleBackToTopics}
            className="btn btn-primary btn-large"
          >
            Vybrať inú tému
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultsPage;

