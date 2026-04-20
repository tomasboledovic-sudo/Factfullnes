import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from './Navigation';
import { isAdminUser } from '../utils/adminAccess';

/**
 * Povolí len prihláseného používateľa s admin právami.
 * Raz zavolá /auth/profile, aby sa doplnilo isAdmin (zastaralé localStorage).
 */
export default function AdminRoute() {
  const location = useLocation();
  const { token, user, loading, syncUserFromProfile } = useAuth();
  /** unknown = ešte neoverené, ok = vstup, denied = nie je správca */
  const [gate, setGate] = useState('unknown');

  /** Nová navigácia = nový pokus o overenie (location.key sa mení pri push; nie search — vyhlieme sa resetu po ?nahrat=1). */
  useEffect(() => {
    setGate('unknown');
  }, [token, location.key]);

  useEffect(() => {
    if (loading || !token) return;
    if (isAdminUser(user)) {
      setGate('ok');
      return;
    }
    let cancelled = false;
    (async () => {
      const fresh = await syncUserFromProfile();
      if (cancelled) return;
      if (fresh && isAdminUser(fresh)) {
        setGate('ok');
        return;
      }
      setGate('denied');
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, token, syncUserFromProfile, location.key]);

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

  if (isAdminUser(user)) {
    return <Outlet />;
  }

  if (gate === 'unknown') {
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Overujem oprávnenia…</div>
      </div>
    );
  }

  if (gate === 'denied') {
    return <Navigate to="/" replace state={{ adminAccessDenied: true }} />;
  }

  if (gate === 'ok') {
    if (isAdminUser(user)) {
      return <Outlet />;
    }
    return (
      <div className="page-wrapper">
        <Navigation />
        <div className="loading">Otváram panel…</div>
      </div>
    );
  }

  return <Navigate to="/" replace state={{ adminAccessDenied: true }} />;
}
