'use strict';

/**
 * events.js — Server-Sent Events endpoint
 *
 * Clients subscribe via GET /api/events.
 * When a new Strava activity arrives via webhook, broadcastNewActivity()
 * pushes an "activity" event to all connected clients.
 */

import { Router } from 'express';

const router = Router();

// Set of active SSE response objects
const clients = new Set();

/**
 * Broadcast a new-activity event to every connected SSE client.
 * Called from webhook.js after a successful upsert.
 *
 * @param {{ name: string, type: string }} activity
 */
export function broadcastNewActivity(activity) {
  if (clients.size === 0) return;
  const payload = `event: activity\ndata: ${JSON.stringify({ name: activity.name, type: activity.type })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // Client already gone — will be cleaned up on 'close'
    }
  }
}

// GET /api/events
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering on Render
  res.flushHeaders();

  // Initial comment so the browser knows the connection is open
  res.write(': connected\n\n');

  // Keepalive every 25 s to prevent Render's 30 s idle timeout
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepalive);
    }
  }, 25_000);

  clients.add(res);

  req.on('close', () => {
    clearInterval(keepalive);
    clients.delete(res);
  });
});

export default router;
