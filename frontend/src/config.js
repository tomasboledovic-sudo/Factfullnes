/**
 * Všetky Express trasy sú pod prefixom `/api`.
 * - Produkcia bez VITE_API_URL: relatívne `/api` (jeden Vercel projekt = rovnaký pôvod).
 * - Dev alebo oddelený backend: VITE_API_URL = napr. http://localhost:3001 alebo https://api.example.com
 */
function normalizeApiBase() {
    let raw = import.meta.env.VITE_API_URL;
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
