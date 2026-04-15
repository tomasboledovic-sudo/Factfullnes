import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navigation.css';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="logo">
          <svg className="logo-shapes" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="12" height="12" rx="3" fill="#818cf8" />
            <rect x="18" y="2" width="12" height="12" rx="3" fill="#c084fc" />
            <rect x="2" y="18" width="12" height="12" rx="3" fill="#22d3d1" />
            <rect x="18" y="18" width="12" height="12" rx="3" fill="#f472b6" />
          </svg>
          <span className="logo-text">LearnFlow</span>
        </Link>

        <div className="nav-actions">
          {user ? (
            <div className="nav-user">
              <Link to="/profile" className="nav-profile-link">
                <span className="nav-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="nav-name">{user.name}</span>
              </Link>
              <button className="nav-logout-btn" onClick={handleLogout} title="Odhlásiť sa">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-login-btn">
              Prihlásiť sa
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
