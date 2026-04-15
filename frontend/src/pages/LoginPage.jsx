import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import './LoginPage.css';

/** Presmerovanie na /admin pre účet admin (meno alebo email pred @). */
function isAdminUser(user) {
  if (!user) return false;
  const name = String(user.name || '').trim().toLowerCase();
  const local = String(user.email || '').split('@')[0]?.trim().toLowerCase() || '';
  return name === 'admin' || local === 'admin';
}

function LoginPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();

      if (data.success) {
        login(data.data.user, data.data.token);
        navigate(isAdminUser(data.data.user) ? '/admin' : '/');
      } else {
        setError(data.error?.message || 'Nepodarilo sa prihlásiť');
      }
    } catch {
      setError('Chyba pri pripájaní na server');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();

      if (data.success) {
        login(data.data.user, data.data.token);
        navigate('/');
      } else {
        setError(data.error?.message || 'Nepodarilo sa zaregistrovať');
      }
    } catch {
      setError('Chyba pri pripájaní na server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <Navigation />
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>{activeTab === 'login' ? 'Vitaj späť' : 'Vytvor účet'}</h1>
            <p>{activeTab === 'login' ? 'Prihlás sa a pozri svoj pokrok' : 'Sleduj svoj pokrok v učení'}</p>
          </div>

          <div className="login-tabs">
            <button
              className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => { setActiveTab('login'); setError(null); }}
            >
              Prihlásiť sa
            </button>
            <button
              className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => { setActiveTab('register'); setError(null); }}
            >
              Registrovať
            </button>
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {activeTab === 'login' ? (
            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="tvoj@email.com"
                  value={loginForm.email}
                  onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Heslo</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg-name">Meno</label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="Tvoje meno"
                  value={registerForm.name}
                  onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="tvoj@email.com"
                  value={registerForm.email}
                  onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">Heslo</label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="Aspoň 6 znakov"
                  value={registerForm.password}
                  onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Registrujem...' : 'Vytvoriť účet'}
              </button>
            </form>
          )}

          <div className="login-skip">
            <Link to="/">Pokračovať bez prihlásenia →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
