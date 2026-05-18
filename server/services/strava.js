'use strict';

import axios from 'axios';
import { encrypt, decrypt } from '../utils/crypto.js';
import { getTokens, upsertTokens, upsertActivity } from './supabase.js';

const STRAVA_BASE      = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

// ── Token management ──────────────────────────────────────────────────────────

export async function exchangeCode(code) {
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  return data;
}

async function refreshAccessToken(encryptedRefreshToken) {
  const { data } = await axios.post(STRAVA_TOKEN_URL, {
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: decrypt(encryptedRefreshToken),
    grant_type:    'refresh_token',
  });
  return data;
}

/**
 * Geeft een geldig access token terug. Verversst automatisch indien nodig.
 */
export async function getValidAccessToken() {
  const tokenRecord = await getTokens();
  if (!tokenRecord) throw new Error('Geen Strava-tokens gevonden. Koppel eerst je Strava-account via /setup/connect-strava.');

  const now = Math.floor(Date.now() / 1000);
  if (tokenRecord.expires_at > now + 300) {
    return decrypt(tokenRecord.access_token);
  }

  const refreshed = await refreshAccessToken(tokenRecord.refresh_token);
  await upsertTokens({
    access_token:  encrypt(refreshed.access_token),
    refresh_token: encrypt(refreshed.refresh_token),
    expires_at:    refreshed.expires_at,
    scope:         tokenRecord.scope,
  });
  return refreshed.access_token;
}

// ── Strava API calls ──────────────────────────────────────────────────────────

async function fetchActivitiesPage(accessToken, params) {
  const { data } = await axios.get(`${STRAVA_BASE}/athlete/activities`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params:  { per_page: 100, ...params },
  });
  return data;
}

export async function fetchActivity(accessToken, activityId) {
  const { data } = await axios.get(`${STRAVA_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function syncRecentActivities(days = 90) {
  const accessToken = await getValidAccessToken();
  const after = Math.floor(Date.now() / 1000) - days * 86400;
  let page = 1, fetched = 0;

  while (true) {
    const activities = await fetchActivitiesPage(accessToken, { after, page });
    if (!activities.length) break;
    for (const raw of activities) await upsertActivity(normalizeActivity(raw));
    fetched += activities.length;
    if (activities.length < 100) break;
    page++;
  }
  return { synced: fetched };
}

// ── Normalisatie ──────────────────────────────────────────────────────────────

export function normalizeActivity(raw) {
  return {
    strava_id:      raw.id,
    activity_date:  raw.start_date_local?.slice(0, 10) ?? null,
    name:           raw.name ?? null,
    type:           raw.type ?? null,
    distance_m:     raw.distance ?? null,
    moving_time_s:  raw.moving_time ?? null,
    elapsed_time_s: raw.elapsed_time ?? null,
    avg_speed_ms:   raw.average_speed ?? null,
    avg_heartrate:  raw.average_heartrate ?? null,
    max_heartrate:  raw.max_heartrate ?? null,
    elevation_gain: raw.total_elevation_gain ?? null,
    calories:       raw.calories ?? null,
    avg_cadence:    raw.average_cadence ?? null,
    avg_watts:      raw.average_watts ?? null,
    max_watts:      raw.max_watts ?? null,
    weighted_avg_watts: raw.weighted_average_watts ?? null,
    kilojoules:     raw.kilojoules ?? null,
    gear_name:      raw.gear?.name ?? null,
    raw_data:       raw,
    synced_at:      new Date().toISOString(),
  };
}

