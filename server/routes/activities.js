'use strict';

import express from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { syncRecentActivities } from '../services/strava.js';
import { apiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limit voor alle API routes
router.use(apiRateLimiter);

// Toegestane activity-types (whitelist)
const ALLOWED_TYPES = new Set(['Run', 'Ride', 'Walk', 'Hike', 'VirtualRun', 'VirtualRide']);

// ── GET /api/activities ───────────────────────────────────────────────────────
// Query params:
//   type    = 'Run' | 'Ride' | ...   (verplicht voor gefilterde view)
//   limit   = max aantal (1–100, default 50)
//   offset  = paginering (default 0)
//   from    = ISO datum (inclusief)
//   to      = ISO datum (inclusief)
router.get('/activities', async (req, res) => {
  const userId = req.session.userId;
  const { type, limit: limitRaw, offset: offsetRaw, from, to } = req.query;

  // Input validatie
  if (type && !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid activity type' });
  }

  const limit = Math.min(Math.max(parseInt(limitRaw) || 50, 1), 100);
  const offset = Math.max(parseInt(offsetRaw) || 0, 0);

  // Datumvalidatie
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return res.status(400).json({ error: 'Invalid from date' });
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'Invalid to date' });
  }

  try {
    let query = supabaseAdmin
      .from('activities')
      .select(
        `id, strava_id, activity_date, name, type,
         distance_m, moving_time_s, avg_speed_ms,
         avg_heartrate, max_heartrate, elevation_gain, calories,
         avg_cadence, avg_watts, max_watts, weighted_avg_watts,
         kilojoules, gear_name, pace_min_km, speed_kmh, efficiency_score`
      )
      .eq('user_id', userId) // Altijd filteren op eigen data
      .order('activity_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq('type', type);
    if (from) query = query.gte('activity_date', from);
    if (to) query = query.lte('activity_date', to);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ activities: data, offset, limit });
  } catch (err) {
    console.error('GET /api/activities error:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// ── GET /api/activities/summary ───────────────────────────────────────────────
// Totaalcijfers per sporttype voor het huidig jaar.
router.get('/activities/summary', async (req, res) => {
  const userId = req.session.userId;
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  try {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('type, distance_m, moving_time_s, calories, elevation_gain')
      .eq('user_id', userId)
      .gte('activity_date', from)
      .lte('activity_date', to);

    if (error) throw error;

    // Aggregeer server-side — stuur nooit ruwe data onnodig mee
    const summary = {};
    for (const act of data) {
      if (!summary[act.type]) {
        summary[act.type] = {
          count: 0,
          total_distance_m: 0,
          total_moving_time_s: 0,
          total_calories: 0,
          total_elevation_m: 0,
        };
      }
      const s = summary[act.type];
      s.count++;
      s.total_distance_m += act.distance_m ?? 0;
      s.total_moving_time_s += act.moving_time_s ?? 0;
      s.total_calories += act.calories ?? 0;
      s.total_elevation_m += act.elevation_gain ?? 0;
    }

    res.json({ summary, year });
  } catch (err) {
    console.error('GET /api/activities/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ── POST /api/sync — handmatige sync ─────────────────────────────────────────
router.post('/sync', async (req, res) => {
  const userId = req.session.userId;

  try {
    const result = await syncRecentActivities(userId, 90);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
