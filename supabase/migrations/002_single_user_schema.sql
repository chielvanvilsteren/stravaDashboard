-- =============================================================================
-- Migratie 002: single-user schema (geen Supabase Auth koppeling)
-- Vervangt de tabellen uit migratie 001.
-- Uitvoeren in Supabase SQL Editor.
-- =============================================================================

-- Verwijder oude tabellen indien aanwezig
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS strava_tokens CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ── Strava OAuth tokens (single row, id=1) ────────────────────────────────────
CREATE TABLE strava_tokens (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  access_token  TEXT NOT NULL,    -- AES-256-GCM encrypted
  refresh_token TEXT NOT NULL,    -- AES-256-GCM encrypted
  expires_at    BIGINT NOT NULL,  -- Unix timestamp
  scope         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ── Activiteiten ──────────────────────────────────────────────────────────────
CREATE TABLE activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_id        BIGINT UNIQUE NOT NULL,
  activity_date    DATE NOT NULL,
  name             TEXT,
  type             TEXT NOT NULL,

  distance_m       NUMERIC,
  moving_time_s    INTEGER,
  elapsed_time_s   INTEGER,
  avg_speed_ms     NUMERIC,
  avg_heartrate    NUMERIC,
  max_heartrate    NUMERIC,
  elevation_gain   NUMERIC,
  calories         NUMERIC,

  avg_cadence      NUMERIC,
  avg_watts        NUMERIC,
  max_watts        NUMERIC,
  weighted_avg_watts NUMERIC,
  kilojoules       NUMERIC,
  gear_name        TEXT,

  pace_min_km      NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN type = 'Run' AND avg_speed_ms > 0
                     THEN 1000.0 / (avg_speed_ms * 60) ELSE NULL END
                   ) STORED,

  speed_kmh        NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN avg_speed_ms IS NOT NULL
                     THEN avg_speed_ms * 3.6 ELSE NULL END
                   ) STORED,

  efficiency_score NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN avg_heartrate > 0
                     THEN (avg_speed_ms / avg_heartrate) * 1000 ELSE NULL END
                   ) STORED,

  raw_data         JSONB,
  synced_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_date_idx ON activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(type);
