import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import CookieBanner from './CookieBanner';

const COOKIE_STORAGE_KEY = 'learnflow_cookie_consent_v1';

function readCookieAccepted() {
  try {
    return localStorage.getItem(COOKIE_STORAGE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Spoločný obal: obsah stránky + cookie lišta.
 */
function AppShell() {
  const [cookieAccepted, setCookieAccepted] = useState(readCookieAccepted);

  const handleCookieAccept = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, 'accepted');
    } catch {
      /* ignore */
    }
    setCookieAccepted(true);
  }, []);

  return (
    <div className={`app-layout${!cookieAccepted ? ' app-layout--cookie' : ''}`}>
      <Outlet />
      {!cookieAccepted && <CookieBanner onAccept={handleCookieAccept} />}
    </div>
  );
}

export default AppShell;
