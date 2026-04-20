import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from './Navigation';

/**
 * Chránené trasy: vyžadujú len prihlásenie (JWT).
 */
export default function PrivateRoute() {
  const location = useLocation();
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Načítavam...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname, search: location.search } }}
      />
    );
  }

  return <Outlet />;
}
