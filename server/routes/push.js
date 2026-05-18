'use strict';

/**
 * push.js — Web Push API endpoints
 *
 * POST /api/push/subscribe    — sla push-subscription op
 * DELETE /api/push/subscribe  — verwijder push-subscription
 * GET  /api/push/vapid-key    — geef public VAPID key terug (geen auth nodig)
 */

import { Router } from 'express';
import webpush from 'web-push';
import { savePushSubscription, deletePushSubscription } from '../services/supabase.js';

const router = Router();

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('Web Push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push disabled');
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Public: geef VAPID public key terug ──────────────────────────────────────
router.get('/vapid-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

// ── POST /api/push/subscribe ─────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  await savePushSubscription(subscription);
  res.status(201).json({ ok: true });
});

// ── DELETE /api/push/subscribe ───────────────────────────────────────────────
router.delete('/subscribe', async (_req, res) => {
  await deletePushSubscription();
  res.json({ ok: true });
});

export { webpush };
export default router;
