'use strict';

import express from 'express';
import {
  findUserByStravaId,
  upsertActivity,
  deleteActivityByStravaId,
} from '../services/supabase.js';
import {
  fetchActivity,
  getValidAccessToken,
  normalizeActivity,
} from '../services/strava.js';

const router = express.Router();

// ── GET /webhook/strava — Strava verification challenge ───────────────────────
router.get('/strava', (req, res) => {
  const {
    'hub.mode': mode,
    'hub.verify_token': token,
    'hub.challenge': challenge,
  } = req.query;

  // Valideer de verify_token ALTIJD — nooit zomaar challenge teruggeven
  if (
    mode === 'subscribe' &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN &&
    typeof challenge === 'string' &&
    challenge.length > 0
  ) {
    return res.json({ 'hub.challenge': challenge });
  }

  return res.status(403).json({ error: 'Forbidden' });
});

// ── POST /webhook/strava — Strava event ontvangen ────────────────────────────
router.post('/strava', async (req, res) => {
  // Altijd 200 teruggeven aan Strava (anders stuurt Strava retry-storms)
  res.status(200).send('EVENT_RECEIVED');

  const { object_type, aspect_type, object_id, owner_id } = req.body;

  // Basisvalidatie — verwerk alleen activiteit-events
  if (object_type !== 'activity') return;
  if (!object_id || !owner_id) return;
  if (typeof object_id !== 'number' || typeof owner_id !== 'number') return;

  try {
    if (aspect_type === 'create' || aspect_type === 'update') {
      // Zoek de gebruiker op via strava_athlete_id
      const user = await findUserByStravaId(owner_id);
      if (!user) return; // onbekende atleet — sla over

      const accessToken = await getValidAccessToken(user.id);
      const rawActivity = await fetchActivity(accessToken, object_id);
      const normalized = normalizeActivity(user.id, rawActivity);
      await upsertActivity(normalized);
    }

    if (aspect_type === 'delete') {
      // Verwijder bij alle bekende gebruikers met dit strava_id
      // (veilig omdat strava_id UNIQUE is in de DB)
      const user = await findUserByStravaId(owner_id);
      if (!user) return;

      await deleteActivityByStravaId(object_id, user.id);
    }
  } catch (err) {
    // Log maar propageer niet — antwoord is al verstuurd
    console.error('Webhook processing error:', err);
  }
});

export default router;
