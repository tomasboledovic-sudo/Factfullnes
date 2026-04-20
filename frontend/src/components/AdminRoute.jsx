import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from './Navigation';
import { isAdminUser } from '../utils/adminAccess';

/**
 * Povolí len prihláseného používateľa s admin právami (pozri isAdminUser).
 */
export default function AdminRoute() {
  const { token, user, loading } = useAuth();

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

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
