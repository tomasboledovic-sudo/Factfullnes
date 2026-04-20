import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import './ProfilePage.css';

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProfilePage() {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user, token, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [token]);

  async function fetchProfile() {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        setProfileData(data.data);
      } else {
        setError('Nepodarilo sa načítať profil');
      }
    } catch {
      setError('Chyba pri pripájaní na server');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('sk-SK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function getImprovementClass(val) {
    if (val > 0) return 'improvement positive';
    if (val < 0) return 'improvement negative';
    return 'improvement neutral';
  }

  function sessionStatusLabel(t) {
    if (t.completed) return 'Dokončené';
    if (t.sessionStatus === 'pre_assessment') return 'Čaká na vstupný test';
    if (t.sessionStatus === 'generating_content') return 'Pripravujem materiály';
    if (t.sessionStatus === 'content_ready') return 'Materiály pripravené';
    if (t.sessionStatus === 'learning') return 'Učenie / záverečný test';
    return t.sessionStatus || 'Prebieha';
  }

  const testHistory = profileData?.testHistory || profileData?.completedTests || [];
  const stats = profileData?.stats;
  const uploadedFiles = profileData?.uploadedFiles || [];
  const completedForStats = testHistory.filter((t) => t.completed);

  return (
    <div className="profile-page">
      <Navigation />
      <div className="profile-container">

        <div className="profile-header-section">
          <div className="profile-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="profile-info">
            <h1>{user?.name}</h1>
            <p className="profile-email">{user?.email}</p>
            <p className="profile-since">Člen od {formatDate(user?.createdAt)}</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Odhlásiť sa
          </button>
        </div>

        {loading && (
          <div className="profile-loading">
            <div className="spinner"></div>
            <p>Načítavam výsledky...</p>
          </div>
        )}

        {error && (
          <div className="profile-error">{error}</div>
        )}

        {profileData && !loading && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-number">{stats?.totalSessions ?? testHistory.length}</span>
                <span className="stat-label">Všetky pokusy</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats?.completedCount ?? completedForStats.length}</span>
                <span className="stat-label">Dokončené</span>
              </div>
              {completedForStats.length > 0 && (
                <>
                  <div className="stat-card">
                    <span className="stat-number">
                      {Math.round(
                        completedForStats.reduce((s, t) => s + (t.finalTestScore ?? 0), 0) /
                          completedForStats.length
                      )}
                      %
                    </span>
                    <span className="stat-label">Priem. celkové skóre</span>
                  </div>
                  <div className="stat-card">
                    <span
                      className={`stat-number ${
                        completedForStats.reduce((s, t) => s + (t.improvement ?? 0), 0) /
                          completedForStats.length >=
                        0
                          ? 'positive-text'
                          : 'negative-text'
                      }`}
                    >
                      {completedForStats.reduce((s, t) => s + (t.improvement ?? 0), 0) /
                        completedForStats.length >
                      0
                        ? '+'
                        : ''}
                      {(
                        completedForStats.reduce((s, t) => s + (t.improvement ?? 0), 0) /
                        completedForStats.length
                      ).toFixed(1)}
                      %
                    </span>
                    <span className="stat-label">Priem. zlepšenie</span>
                  </div>
                </>
              )}
            </div>

            <div className="tests-section">
              <h2>História testov</h2>
              <p className="tests-section-hint">
                Ukladajú sa len témy, pri ktorých si bol prihlásený — relácia sa viaže na účet.
              </p>

              {testHistory.length === 0 ? (
                <div className="no-tests">
                  <p>Zatiaľ nemáš žiadnu uloženú reláciu. Prihlás sa pred výberom témy.</p>
                  <button className="start-btn" onClick={() => navigate('/')}>
                    Začni sa učiť →
                  </button>
                </div>
              ) : (
                <div className="tests-list">
                  {testHistory.map((test) => (
                    <div
                      key={test.sessionId}
                      className={`test-card ${test.completed ? '' : 'test-card-incomplete'}`}
                    >
                      <div className="test-card-top">
                        <div className="test-topic-info">
                          <span className="test-category-tag">{test.topicCategory}</span>
                          <span className="test-topic-title">{test.topicTitle}</span>
                          <span className={`test-status-badge status-${test.sessionStatus || 'unknown'}`}>
                            {sessionStatusLabel(test)}
                          </span>
                        </div>
                        <span className="test-date">
                          {test.completed
                            ? formatDate(test.completedAt)
                            : formatDate(test.createdAt)}
                        </span>
                      </div>

                      {test.completed ? (
                        <div className="test-card-scores">
                          <div className="score-col">
                            <span className="score-col-label">Vstupný test</span>
                            <span className="score-col-value pre-score">
                              {test.preTestScore != null ? `${Math.round(test.preTestScore)}%` : '—'}
                            </span>
                          </div>

                          <div className="score-arrow">→</div>

                          <div className="score-col">
                            <span className="score-col-label">Celkové skóre</span>
                            <span className="score-col-value final-score">
                              {test.finalTestScore != null ? `${Math.round(test.finalTestScore)}%` : '—'}
                            </span>
                          </div>

                          <div className="score-divider" />

                          <div
                            className={`improvement-col ${
                              (test.improvement ?? 0) > 0
                                ? 'positive'
                                : (test.improvement ?? 0) < 0
                                  ? 'negative'
                                  : 'neutral'
                            }`}
                          >
                            <span className="score-col-label">Zlepšenie</span>
                            <span className="improvement-value">
                              {test.improvement == null
                                ? '—'
                                : `${test.improvement > 0 ? '↑' : test.improvement < 0 ? '↓' : '–'} ${test.improvement > 0 ? '+' : ''}${Math.round(test.improvement)}%`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="test-card-incomplete-actions">
                          {test.preTestScore != null && (
                            <span className="incomplete-pre">
                              Vstupný test: {Math.round(test.preTestScore)}%
                            </span>
                          )}
                          {test.continuePath && (
                            <Link to={test.continuePath} className="continue-link">
                              Pokračovať →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="files-section">
              <h2>Nahrané súbory</h2>
              {uploadedFiles.length === 0 ? (
                <div className="no-files">
                  <p>Zatiaľ žiadne súbory.</p>
                  <Link to="/admin" className="files-link-cta">
                    Nahrať súbor →
                  </Link>
                </div>
              ) : (
                <ul className="files-list-profile">
                  {uploadedFiles.map((f) => (
                    <li key={f.id} className="file-row-profile">
                      <span className="file-row-icon" title={f.file_type || ''}>
                        📎
                      </span>
                      <div className="file-row-info">
                        <span className="file-row-name">{f.file_name}</span>
                        <span className="file-row-meta">
                          {formatFileSize(f.file_size)} · {formatDate(f.uploaded_at)}
                        </span>
                      </div>
                      <div className="file-row-actions">
                        <Link to={`/admin/materials/${f.id}`} className="file-row-link">
                          Zhrnutie
                        </Link>
                        <Link to={`/admin/materials/${f.id}/quiz`} className="file-row-link file-row-link-quiz">
                          AI test
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
