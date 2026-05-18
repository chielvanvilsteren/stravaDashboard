'use strict';

import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — gebruikt de service_role_key.
 * ALLEEN gebruiken op de server voor:
 *  - webhook-inserts (omzeilt RLS bewust: we schrijven namens de gebruiker)
 *  - token-opslag en -refresh (omzeilt RLS bewust: admin beheert tokens)
 * Exporteer dit bestand NOOIT naar de frontend-bundle.
 */

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ── Helper: Supabase Auth gebruiker aanmaken / ophalen ────────────────────────

/**
 * Zoek een bestaande gebruiker via strava_athlete_id in de profiles-tabel.
 * @param {number} stravaAthleteId
 * @returns {Promise<{id: string}|null>}
 */
export async function findUserByStravaId(stravaAthleteId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('strava_athlete_id', stravaAthleteId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Maak een nieuwe Supabase Auth gebruiker aan en sla het profiel op.
 * @param {object} athlete  Strava athlete object
 * @returns {Promise<string>} userId
 */
export async function createUserFromAthlete(athlete) {
  // Maak auth-gebruiker aan met een stabiel e-mailadres op basis van strava-id
  const email = `strava_${athlete.id}@strava.internal`;
  const password = crypto.randomUUID(); // nooit gebruikt — login is via Strava OAuth

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw authError;

  const userId = authData.user.id;

  // Sla profiel op
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    strava_athlete_id: athlete.id,
    firstname: athlete.firstname,
    lastname: athlete.lastname,
  });
  if (profileError) throw profileError;

  return userId;
}

// ── Helper: Strava tokens opslaan / ophalen ───────────────────────────────────
// Omzeilt RLS bewust — service_role schrijft namens de gebruiker.

/**
 * Sla (encrypted) Strava tokens op voor een gebruiker. Upsert.
 * @param {string} userId
 * @param {object} tokens  { access_token, refresh_token, expires_at, scope }
 */
export async function upsertTokens(userId, tokens) {
  const { error } = await supabaseAdmin.from('strava_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,    // moet al encrypted zijn
      refresh_token: tokens.refresh_token,  // moet al encrypted zijn
      expires_at: tokens.expires_at,
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

/**
 * Haal Strava tokens op voor een gebruiker.
 * @param {string} userId
 * @returns {Promise<{access_token:string, refresh_token:string, expires_at:number, scope:string}>}
 */
export async function getTokens(userId) {
  const { data, error } = await supabaseAdmin
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Helper: activiteiten opslaan ──────────────────────────────────────────────
// Omzeilt RLS bewust — webhook-inserts hebben geen user-sessie.

/**
 * Sla een activiteit op (upsert op strava_id).
 * @param {object} activity  Genormaliseerd activiteitenobject
 */
export async function upsertActivity(activity) {
  const { error } = await supabaseAdmin
    .from('activities')
    .upsert(activity, { onConflict: 'strava_id' });
  if (error) throw error;
}

/**
 * Verwijder een activiteit op basis van strava_id en user_id.
 * @param {number} stravaId
 * @param {string} userId
 */
export async function deleteActivityByStravaId(stravaId, userId) {
  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('strava_id', stravaId)
    .eq('user_id', userId);
  if (error) throw error;
}
