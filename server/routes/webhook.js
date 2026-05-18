'use strict';

import express from 'express';
import { deleteActivityByStravaId, upsertActivity, getPushSubscription } from '../services/supabase.js';
import { fetchActivity, getValidAccessToken, normalizeActivity } from '../services/strava.js';
import { broadcastNewActivity } from './events.js';
import { webpush } from './push.js';

const router = express.Router();

// ── GET /webhook/strava — Strava verification challenge ───────────────────────
router.get('/strava', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

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

// ── POST /webhook/strava — Strava event ontvangen ─────────────────────────────
router.post('/strava', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  const { object_type, aspect_type, object_id, owner_id } = req.body;

  if (object_type !== 'activity') return;
  if (!object_id || !owner_id) return;
  if (typeof object_id !== 'number' || typeof owner_id !== 'number') return;

  // Optioneel: verifieer dat het event voor onze atleet is
  const expectedAthleteId = process.env.STRAVA_ATHLETE_ID ? Number(process.env.STRAVA_ATHLETE_ID) : null;
  if (expectedAthleteId && owner_id !== expectedAthleteId) return;

  try {
    if (aspect_type === 'create' || aspect_type === 'update') {
      const accessToken  = await getValidAccessToken();
      const rawActivity  = await fetchActivity(accessToken, object_id);
      const normalized   = normalizeActivity(rawActivity);
      await upsertActivity(normalized);
      if (aspect_type === 'create') {
        broadcastNewActivity(normalized);
        // Web Push — stuur OS-notificatie (ook als app gesloten is)
        try {
          const sub = await getPushSubscription();
          if (sub && process.env.VAPID_PUBLIC_KEY) {
            const icons = { Run: '🏃', Ride: '🚴', Walk: '🚶', Hike: '🥾' };
            const icon  = icons[normalized.type] ?? '⚡';
            await webpush.sendNotification(
              sub,
              JSON.stringify({
                title: `${icon} Nieuwe activiteit`,
                body:  normalized.name,
                url:   process.env.APP_URL ?? '/',
              })
            );
          }
        } catch (pushErr) {
          // Push mislukt (bijv. subscription verlopen) — niet fataal
          console.warn('Push notification failed:', pushErr.message);
        }
      }
    }

    if (aspect_type === 'delete') {
      await deleteActivityByStravaId(object_id);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

export default router;
