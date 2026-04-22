import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import TopicCard from '../components/TopicCard';
import './HomePage.css';

function HomePage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { getAuthHeaders, token } = useAuth();

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/topics`);
      const ct = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!ct.includes('application/json')) {
        console.error('[topics] Neočakávaná odpoveď (nie JSON). Skontroluj Vercel /api a Root Directory.)', response.status, text.slice(0, 200));
        setError(
          `Server vrátil odpoveď ${response.status} (nie JSON). Pri jednom Vercel projekte musí byť koreň repa a fungovať /api — pozri DEPLOY.md.`
        );
        return;
      }
      const data = JSON.parse(text);
      if (data.success) {
        setTopics(data.data);
      } else {
        setError('Nepodarilo sa načítať témy');
      }
    } catch (err) {
      setError('Chyba pri pripájaní na server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLearning = async (topicId) => {
    try {
      const topic = topics.find(t => t.id === topicId);
      
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ topicId })
      });

      const data = await response.json();

      if (data.success) {
        const { sessionId } = data.data;
        localStorage.setItem('currentSessionId', sessionId);
        localStorage.setItem('sessionStartTime', Date.now());
        localStorage.setItem('currentTopicId', topicId);
        localStorage.setItem('currentTopicTitle', topic?.title || '');
        
        navigate(`/session/${sessionId}/pre-test`);
      } else {
        alert('Nepodarilo sa vytvoriť reláciu');
      }
    } catch (err) {
      alert('Chyba pri vytváraní relácie');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Načítavam témy...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navigation />
      
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-headline">
            Naučte sa čokoľvek za <span className="hero-headline-accent">10 minút</span>
          </h1>
          <p className="lead">
            AI vytvorí personalizované materiály na základe tvojich vedomostí
          </p>
        </div>
      </section>

      <section className="topics-section">
        <h2 className="section-title">
          Vyber si tému alebo{' '}
          {token ? (
            <Link to="/admin?nahrat=1" className="section-title-upload-link">
              nahraj súbor
            </Link>
          ) : (
            <Link
              to="/login"
              state={{ from: { pathname: '/admin', search: '?nahrat=1' } }}
              className="section-title-upload-link"
            >
              nahraj súbor
            </Link>
          )}
        </h2>
        <div className="topics-grid">
          {topics.map((topic) => (
            <TopicCard 
              key={topic.id} 
              topic={topic} 
              onStart={handleStartLearning}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
