# Setup Checklist

## 1. Strava API app registreren

- [ ] Ga naar https://www.strava.com/settings/api
- [ ] Maak een nieuwe applicatie aan:
  - **Application Name**: Strava Conditie
  - **Website**: `https://jouw-app.onrender.com`
  - **Authorization Callback Domain**: `jouw-app.onrender.com`
- [ ] Noteer `Client ID` → `STRAVA_CLIENT_ID`
- [ ] Noteer `Client Secret` → `STRAVA_CLIENT_SECRET`

---

## 2. Supabase project aanmaken

- [ ] Ga naar https://supabase.com → nieuw project
- [ ] Noteer `Project URL` → `SUPABASE_URL` en `VITE_SUPABASE_URL`
- [ ] Noteer `anon key` → `VITE_SUPABASE_ANON_KEY`
- [ ] Noteer `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Open **SQL Editor** en voer uit: `supabase/migrations/001_initial_schema.sql`

---

## 3. `.env` aanmaken en invullen

```bash
cp .env.example .env
```

Genereer de ontbrekende secrets:

```bash
openssl rand -hex 32   # → TOKEN_ENCRYPTION_KEY
openssl rand -hex 64   # → SESSION_SECRET
openssl rand -hex 32   # → STRAVA_WEBHOOK_VERIFY_TOKEN
```

- [ ] `SUPABASE_URL` ingevuld
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ingevuld
- [ ] `VITE_SUPABASE_URL` ingevuld
- [ ] `VITE_SUPABASE_ANON_KEY` ingevuld
- [ ] `STRAVA_CLIENT_ID` ingevuld
- [ ] `STRAVA_CLIENT_SECRET` ingevuld
- [ ] `STRAVA_WEBHOOK_VERIFY_TOKEN` ingevuld (min. 32 tekens)
- [ ] `SESSION_SECRET` ingevuld (min. 64 tekens)
- [ ] `TOKEN_ENCRYPTION_KEY` ingevuld (exact 64 hex-tekens)
- [ ] `APP_URL` ingevuld

---

## 4. PWA icons aanmaken

Toevoegen in `client/public/icons/` (zie ook `client/public/icons/README.md`):

- [ ] `icon-192.png` — 192×192 px
- [ ] `icon-512.png` — 512×512 px
- [ ] `apple-touch-icon.png` — 180×180 px
- [ ] `strava-logo.svg` — logo voor de login-knop (te vinden op https://developers.strava.com/guidelines)

Snelste manier voor PNG icons: https://realfavicongenerator.net  
Themakleur: `#fc4c02` / achtergrond: `#0d0f18`

---

## 5. Lokaal testen

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3000

- [ ] Inloggen via Strava werkt
- [ ] Activiteiten worden gesynchroniseerd
- [ ] Alle drie tabs tonen data

---

## 6. Render deployment

- [ ] Push code naar GitHub (`main` branch)
- [ ] Maak een **Web Service** aan op https://render.com gekoppeld aan je repo
- [ ] Stel alle `.env` variabelen in via **Render Dashboard → Environment** (nooit in `render.yaml`)
- [ ] Wacht tot de eerste deploy klaar is
- [ ] Controleer `/health` endpoint: `https://jouw-app.onrender.com/health`

---

## 7. Strava Webhook registreren (éénmalig, ná eerste deploy)

```bash
node scripts/register-webhook.js
```

- [ ] Webhook geregistreerd
- [ ] Strava bevestigt met subscription ID in de terminal output
