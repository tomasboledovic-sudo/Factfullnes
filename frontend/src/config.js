/**
 * Všetky Express trasy sú pod prefixom `/api`.
 * Ak je v .env len host (bez `/api`), doplníme ho — inak volania končia na 404 „Endpoint neexistuje“.
 */
function normalizeApiBase() {
    let base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    base = String(base).trim().replace(/\/+$/, '');
    if (!base.endsWith('/api')) {
        base = `${base}/api`;
    }
    return base;
}

export const API_BASE_URL = normalizeApiBase();
