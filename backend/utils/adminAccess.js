/**
 * Voliteľný zoznam v .env: ADMIN_EMAILS=ja@firma.sk,druhy@email.com (presná zhoda emailu, lowercase).
 */
function adminEmailsFromEnv() {
    const raw = process.env.ADMIN_EMAILS;
    if (!raw || !String(raw).trim()) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * Správca ak:
 * - meno (trim, lowercase) je "admin", alebo lokálna časť emailu pred @ je "admin", alebo
 * - celý email je v ADMIN_EMAILS (čarka-oddelený zoznam v .env / na Verceli).
 */
export function isAdminUser(row) {
    if (!row) return false;
    const email = String(row.email || '').trim().toLowerCase();
    const name = String(row.name || '').trim().toLowerCase();
    const local = email.split('@')[0] || '';

    if (name === 'admin' || local === 'admin') return true;

    const allow = adminEmailsFromEnv();
    if (allow.length > 0 && email && allow.includes(email)) return true;

    return false;
}
