-- =============================================================================
-- Supabase migratie: initieel schema voor Strava Conditie PWA
-- Uitvoeren in Supabase SQL Editor of via supabase CLI:
--   supabase db push
-- =============================================================================

-- ── Profieltabel (publiek profiel gekoppeld aan auth.users) ───────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id  BIGINT UNIQUE NOT NULL,
  firstname          TEXT,
  lastname           TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- ── Strava OAuth tokens (AES-256-GCM encrypted) ───────────────────────────────
CREATE TABLE IF NOT EXISTS strava_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL,    -- AES-256-GCM encrypted
  refresh_token  TEXT NOT NULL,    -- AES-256-GCM encrypted
  expires_at     BIGINT NOT NULL,  -- Unix timestamp
  scope          TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own tokens"
  ON strava_tokens FOR ALL
  USING (auth.uid() = user_id);

-- ── Activiteiten (hardlopen én fietsen) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_id        BIGINT UNIQUE NOT NULL,
  activity_date    DATE NOT NULL,
  name             TEXT,
  type             TEXT NOT NULL,       -- 'Run' | 'Ride' | 'Walk' | etc.

  -- Gedeelde velden
  distance_m       NUMERIC,
  moving_time_s    INTEGER,
  elapsed_time_s   INTEGER,
  avg_speed_ms     NUMERIC,
  avg_heartrate    NUMERIC,
  max_heartrate    NUMERIC,
  elevation_gain   NUMERIC,
  calories         NUMERIC,

  -- Hardlopen-specifiek
  avg_cadence      NUMERIC,            -- stappen/min per been (×2 voor totaal)

  -- Fietsen-specifiek
  avg_watts        NUMERIC,            -- gemiddeld vermogen (powermeter)
  max_watts        NUMERIC,
  weighted_avg_watts NUMERIC,          -- normalized power
  kilojoules       NUMERIC,            -- totale arbeid
  gear_name        TEXT,               -- fietsnaam

  -- Berekende (gegenereerde) kolommen
  pace_min_km      NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN type = 'Run' AND avg_speed_ms > 0
                     THEN 1000.0 / (avg_speed_ms * 60)
                     ELSE NULL END
                   ) STORED,

  speed_kmh        NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN avg_speed_ms IS NOT NULL
                     THEN avg_speed_ms * 3.6
                     ELSE NULL END
                   ) STORED,

  efficiency_score NUMERIC GENERATED ALWAYS AS (
                     CASE WHEN avg_heartrate > 0
                     THEN (avg_speed_ms / avg_heartrate) * 1000
                     ELSE NULL END
                   ) STORED,

  raw_data         JSONB,
  synced_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes voor veelgebruikte queries
CREATE INDEX IF NOT EXISTS activities_user_date_idx  ON activities(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS activities_user_type_idx  ON activities(user_id, type);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own activities"
  ON activities FOR ALL
  USING (auth.uid() = user_id);
