'use strict';

import axios from 'axios';
import { encrypt, decrypt } from '../utils/crypto.js';
import { getTokens, upsertTokens, upsertActivity } from './supabase.js';

const STRAVA_BASE = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Ruil een OAuth-code in voor access- en refresh-token.
 * @param {string} code  OAuth authorization code van Strava callback
 * @returns {Promise<{access_token, refresh_token, expires_at, athlete, scope}>}
 */
export async function exchangeCode(code) {
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  return data;
}

/**
 * Ververs een verlopen access token via het refresh token.
 * @param {string} encryptedRefreshToken  Encrypted refresh token uit DB
 * @returns {Promise<{access_token, refresh_token, expires_at}>}
 */
async function refreshAccessToken(encryptedRefreshToken) {
  const refreshToken = decrypt(encryptedRefreshToken);
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return data;
}

/**
 * Geeft een geldig (niet-verlopen) access token terug voor de gebruiker.
 * Verversst automatisch als het token binnen 5 minuten verloopt.
 * @param {string} userId
 * @returns {Promise<string>}  plaintext access token
 */
export async function getValidAccessToken(userId) {
  const tokenRecord = await getTokens(userId);
  const now = Math.floor(Date.now() / 1000);

  if (tokenRecord.expires_at > now + 300) {
    // Token is nog geldig (meer dan 5 min resterend)
    return decrypt(tokenRecord.access_token);
  }

  // Token verloopt binnenkort — ververs
  const refreshed = await refreshAccessToken(tokenRecord.refresh_token);

  // Sla nieuwe tokens encrypted op
  await upsertTokens(userId, {
    access_token: encrypt(refreshed.access_token),
    refresh_token: encrypt(refreshed.refresh_token),
    expires_at: refreshed.expires_at,
    scope: tokenRecord.scope,
  });

  return refreshed.access_token;
}

// ── Strava API calls ──────────────────────────────────────────────────────────

/**
 * Haal een pagina activiteiten op van Strava.
 * @param {string} accessToken
 * @param {object} params  { before, after, page, per_page }
 */
async function fetchActivitiesPage(accessToken, params) {
  const { data } = await axios.get(`${STRAVA_BASE}/athlete/activities`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { per_page: 100, ...params },
  });
  return data;
}

/**
 * Haal een enkele activiteit op van Strava.
 * @param {string} accessToken
 * @param {number} activityId
 */
export async function fetchActivity(accessToken, activityId) {
  const { data } = await axios.get(`${STRAVA_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * Synct alle activiteiten van de afgelopen N dagen.
 * Pagineert automatisch totdat Strava geen data meer teruggeeft.
 * @param {string} userId
 * @param {number} days   Standaard 90 dagen
 */
export async function syncRecentActivities(userId, days = 90) {
  const accessToken = await getValidAccessToken(userId);
  const after = Math.floor(Date.now() / 1000) - days * 86400;

  let page = 1;
  let fetched = 0;

  while (true) {
    const activities = await fetchActivitiesPage(accessToken, { after, page });
    if (!activities.length) break;

    for (const raw of activities) {
      const normalized = normalizeActivity(userId, raw);
      await upsertActivity(normalized);
    }

    fetched += activities.length;
    if (activities.length < 100) break; // laatste pagina
    page++;
  }

  return { synced: fetched };
}

// ── Normalisatie ──────────────────────────────────────────────────────────────

/**
 * Zet een ruwe Strava activiteit om naar het DB-schema.
 * @param {string} userId
 * @param {object} raw  Strava API activity object
 * @returns {object}
 */
export function normalizeActivity(userId, raw) {
  return {
    user_id: userId,
    strava_id: raw.id,
    activity_date: raw.start_date_local?.slice(0, 10) ?? null,
    name: raw.name ?? null,
    type: raw.type ?? null,

    // Gedeelde velden
    distance_m: raw.distance ?? null,
    moving_time_s: raw.moving_time ?? null,
    elapsed_time_s: raw.elapsed_time ?? null,
    avg_speed_ms: raw.average_speed ?? null,
    avg_heartrate: raw.average_heartrate ?? null,
    max_heartrate: raw.max_heartrate ?? null,
    elevation_gain: raw.total_elevation_gain ?? null,
    calories: raw.calories ?? null,

    // Hardlopen
    avg_cadence: raw.average_cadence ?? null,

    // Fietsen
    avg_watts: raw.average_watts ?? null,
    max_watts: raw.max_watts ?? null,
    weighted_avg_watts: raw.weighted_average_watts ?? null,
    kilojoules: raw.kilojoules ?? null,
    gear_name: raw.gear?.name ?? null,

    raw_data: raw,
    synced_at: new Date().toISOString(),
  };
}
