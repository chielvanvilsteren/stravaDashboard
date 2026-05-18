/**
 * auth.js — Sessie-beheer
 * - Sessie tokens worden NOOIT in localStorage opgeslagen.
 * - Alles verloopt via httpOnly session cookies (server-side).
 */

/**
 * Controleer de huidige sessie via /auth/me.
 * @returns {Promise<{userId: string, stravaAthleteId: number}|null>}
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
 * Uitloggen via POST /auth/logout en redirect naar home.
 */
export async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Altijd doorgaan met redirect
  }
  window.location.href = '/';
}
