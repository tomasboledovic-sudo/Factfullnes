/**
 * Rovnaká logika ako vo fronte: správca = meno "admin" alebo lokálna časť emailu "admin".
 */
export function isAdminUser(row) {
    if (!row) return false;
    const name = String(row.name || '').trim().toLowerCase();
    const local = String(row.email || '').split('@')[0]?.trim().toLowerCase() || '';
    return name === 'admin' || local === 'admin';
}
