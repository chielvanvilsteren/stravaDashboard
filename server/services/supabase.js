'use strict';

import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — gebruikt de service_role_key.
 * Alle databasetoegang verloopt server-side via deze client.
 * NOOIT exporteren naar de frontend.
 */

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Strava tokens (single-user: altijd één rij) ───────────────────────────────

export async function upsertTokens(tokens) {
  const { error } = await supabaseAdmin.from('strava_tokens').upsert(
    {
      id: 1, // vaste rij voor single-user setup
      access_token:  tokens.access_token,   // AES-256-GCM encrypted
      refresh_token: tokens.refresh_token,  // AES-256-GCM encrypted
      expires_at:    tokens.expires_at,
      scope:         tokens.scope ?? null,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function getTokens() {
  const { data, error } = await supabaseAdmin
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at, scope')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Activiteiten ──────────────────────────────────────────────────────────────

export async function upsertActivity(activity) {
  const { error } = await supabaseAdmin
    .from('activities')
    .upsert(activity, { onConflict: 'strava_id' });
  if (error) throw error;
}

export async function deleteActivityByStravaId(stravaId) {
  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('strava_id', stravaId);
  if (error) throw error;
}

// ── Push subscriptions (single-user: altijd één rij) ─────────────────────────

export async function savePushSubscription(subscription) {
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    { id: 1, subscription, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function getPushSubscription() {
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data?.subscription ?? null;
}

export async function deletePushSubscription() {
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('id', 1);
  if (error) throw error;
}

