import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setLoading(false);
        return;
      }

      setToken(storedToken);
      setUser(parsed);

      try {
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        const data = await res.json();
        if (!cancelled && data.success && data.data?.user) {
          const merged = { ...parsed, ...data.data.user };
          setUser(merged);
          localStorage.setItem('auth_user', JSON.stringify(merged));
        }
      } catch {
        /* offline alebo dočasná chyba — ostane parsed z localStorage */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function login(userData, authToken) {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  function getAuthHeaders() {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth musí byť použitý vnútri AuthProvider');
  return ctx;
}
