/**
 * auth.js — Sessie-beheer
 * - Sessie tokens worden NOOIT in localStorage opgeslagen.
 * - Alles verloopt via httpOnly session cookies (server-side).
 */

/**
 * Controleer de huidige sessie via /auth/me.
 * @returns {Promise<{username: string}|null>}
 */
export async function checkSession() {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Inloggen met gebruikersnaam en wachtwoord.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(username, password) {
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? 'Inloggen mislukt' };
  } catch {
    return { ok: false, error: 'Geen verbinding met de server' };
  }
}

/**
 * Uitloggen via POST /auth/logout en redirect naar home.
 */
export async function logout() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Altijd doorgaan met redirect
  }
  window.location.href = '/';
}
