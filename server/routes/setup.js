'use strict';

/**
 * Setup route — éénmalige Strava OAuth koppeling.
 * Alleen toegankelijk voor ingelogde gebruikers (session check).
 *
 * Stap 1: GET /setup/connect-strava  → redirect naar Strava (vereist sessie)
 * Stap 2: GET /setup/callback        → tokens opslaan, redirect naar /
 */

import express from 'express';
import crypto from 'node:crypto';
import { exchangeCode } from '../services/strava.js';
import { encrypt } from '../utils/crypto.js';
import { upsertTokens, getTokens } from '../services/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { syncRecentActivities } from '../services/strava.js';

const router = express.Router();

const STRAVA_SCOPES = 'read,activity:read_all';

// ── GET /setup/connect-strava ─────────────────────────────────────────────────
router.get('/connect-strava', requireAuth, async (req, res) => {
  // Toon status als tokens al bestaan
  const existing = await getTokens().catch(() => null);

  const state = crypto.randomBytes(24).toString('hex');

  // Sla CSRF state op als gesigneerde cookie (10 min geldig)
  res.cookie('oauth_state', state, {
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    redirect_uri:  `${process.env.APP_URL}/setup/callback`,
    response_type: 'code',
    scope:         STRAVA_SCOPES,
    approval_prompt: existing ? 'force' : 'auto',
    state,
  });

  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// ── GET /setup/callback ───────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect('/?error=strava_access_denied');

  // Valideer CSRF state
  if (!state || state !== req.signedCookies.oauth_state) {
    return res.status(403).send('Ongeldige OAuth state. Probeer opnieuw via /setup/connect-strava.');
  }
  res.clearCookie('oauth_state');

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Ontbrekende authorization code.');
  }

  try {
    const tokenData = await exchangeCode(code);

    await upsertTokens({
      access_token:  encrypt(tokenData.access_token),
      refresh_token: encrypt(tokenData.refresh_token),
      expires_at:    tokenData.expires_at,
      scope:         tokenData.scope,
    });

    // Sla atletID op voor webhook verificatie (optioneel)
    console.log(`Strava gekoppeld: atleet ${tokenData.athlete?.id} (${tokenData.athlete?.firstname})`);

    // Initiële sync van 90 dagen (fire & forget)
    syncRecentActivities(90).catch((err) => console.error('Initial sync failed:', err));

    res.redirect('/?setup=success');
  } catch (err) {
    console.error('Setup callback error:', err);
    res.redirect('/?error=setup_failed');
  }
});

export default router;
