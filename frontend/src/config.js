/**
 * Všetky Express trasy sú pod prefixom `/api`.
 * - Produkcia bez VITE_API_URL: relatívne `/api` (jeden Vercel projekt = rovnaký pôvod).
 * - Dev alebo oddelený backend: VITE_API_URL = napr. http://localhost:3001 alebo https://api.example.com
 * - Ak je v buildi omylom localhost, na nasadenej doméne prepíš na `/api`.
 */
function normalizeApiBase() {
    let raw = import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        const deployed = h !== 'localhost' && h !== '127.0.0.1';
        const bad =
            raw == null ||
            String(raw).trim() === '' ||
            String(raw).includes('localhost') ||
            String(raw).includes('127.0.0.1');
        if (deployed && bad) {
            return '/api';
        }
    }
    if (raw === undefined || String(raw).trim() === '') {
        if (import.meta.env.DEV) {
            raw = 'http://localhost:3001';
        } else {
            return '/api';
        }
    }
    let base = String(raw).trim().replace(/\/+$/, '');
    if (!base.endsWith('/api')) {
        base = `${base}/api`;
    }
    return base;
}

export const API_BASE_URL = normalizeApiBase();
