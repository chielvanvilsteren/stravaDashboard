/**
 * api.js — Fetch wrapper
 * - Stelt credentials: 'include' in zodat de session cookie meegestuurd wordt.
 * - Bij 401: redirect naar /
 * - Gooit een Error bij niet-2xx responses.
 */

/**
 * @param {string} path      Relatief pad (bijv. '/api/activities?type=Run')
 * @param {RequestInit} [options]
 * @returns {Promise<any>}   Geparsed JSON
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Sessie verlopen — terug naar login
    window.location.href = '/';
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.offline = body.offline === true;
    throw err;
  }

  return res.json();
}

/**
 * Haal activiteiten op met optionele filters.
 * @param {{ type?: string, limit?: number, offset?: number, from?: string, to?: string }} params
 */
export async function fetchActivities(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
  );
  return apiFetch(`/api/activities?${qs}`);
}

/**
 * Haal samenvatting op (totaalcijfers per sporttype voor huidig jaar).
 */
export async function fetchSummary() {
  return apiFetch('/api/activities/summary');
}
