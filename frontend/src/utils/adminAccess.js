/**
 * Správca: server nastaví user.isAdmin (login / profil).
 * Záložne: meno "admin" alebo časť emailu pred @ je "admin".
 */
export function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const name = String(user.name || '').trim().toLowerCase();
  const local = String(user.email || '').split('@')[0]?.trim().toLowerCase() || '';
  return name === 'admin' || local === 'admin';
}
