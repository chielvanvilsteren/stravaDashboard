'use strict';

import express from 'express';
import crypto from 'node:crypto';
import { exchangeCode } from '../services/strava.js';
import { encrypt } from '../utils/crypto.js';
import {
  findUserByStravaId,
  createUserFromAthlete,
  upsertTokens,
} from '../services/supabase.js';
import { syncRecentActivities } from '../services/strava.js';

const router = express.Router();

const STRAVA_SCOPES = 'read,activity:read_all';

// ── GET /auth/strava — start OAuth flow ───────────────────────────────────────
router.get('/strava', (req, res) => {
  // Genereer CSRF-state token en sla op in sessie
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/auth/callback`,
    response_type: 'code',
    scope: STRAVA_SCOPES,
    state,
  });

  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// ── GET /auth/callback — OAuth callback ───────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Fout van Strava (bijv. gebruiker weigerde toegang)
  if (error) {
    return res.redirect('/?error=access_denied');
  }

  // Valideer CSRF state
  if (!state || state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid OAuth state' });
  }
  delete req.session.oauthState;

  // Valideer aanwezigheid van code
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    // Ruil code in voor tokens
    const tokenData = await exchangeCode(code);
    const athlete = tokenData.athlete;

    // Zoek of maak gebruiker
    let user = await findUserByStravaId(athlete.id);
    let isNewUser = false;

    if (!user) {
      const userId = await createUserFromAthlete(athlete);
      user = { id: userId };
      isNewUser = true;
    }

    // Sla encrypted tokens op
    await upsertTokens(user.id, {
      access_token: encrypt(tokenData.access_token),
      refresh_token: encrypt(tokenData.refresh_token),
      expires_at: tokenData.expires_at,
      scope: tokenData.scope,
    });

    // Zet sessie
    req.session.userId = user.id;
    req.session.stravaAthleteId = athlete.id;

    // Initiële sync van 90 dagen voor nieuwe gebruikers (fire & forget op de achtergrond)
    if (isNewUser) {
      syncRecentActivities(user.id, 90).catch((err) =>
        console.error('Initial sync failed:', err)
      );
    }

    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// ── GET /auth/me — huidig ingelogde gebruiker ─────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({
    userId: req.session.userId,
    stravaAthleteId: req.session.stravaAthleteId,
  });
});

export default router;
