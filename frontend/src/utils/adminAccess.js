/** Správca: meno "admin" alebo časť emailu pred @ je "admin" (napr. admin@firma.sk). */
export function isAdminUser(user) {
  if (!user) return false;
  const name = String(user.name || '').trim().toLowerCase();
  const local = String(user.email || '').split('@')[0]?.trim().toLowerCase() || '';
  return name === 'admin' || local === 'admin';
}
