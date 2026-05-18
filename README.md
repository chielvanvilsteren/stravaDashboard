# Strava Conditie PWA

Conditie-analyse voor hardlopen en wielrennen op basis van Strava-activiteiten.

## Tech Stack

- **Frontend**: Vanilla JS + Vite (PWA)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL + RLS)
- **Auth**: Strava OAuth 2.0
- **Hosting**: Render

## Lokaal ontwikkelen

### 1. Installeer dependencies

```bash
npm install
```

### 2. Maak .env aan

```bash
cp .env.example .env
# Vul alle variabelen in (zie .env.example)
```

Genereer de encryptiesleutel:
```bash
openssl rand -hex 32   # → TOKEN_ENCRYPTION_KEY
openssl rand -hex 64   # → SESSION_SECRET
openssl rand -hex 32   # → STRAVA_WEBHOOK_VERIFY_TOKEN
```

### 3. Voer Supabase migratie uit

Open de Supabase SQL Editor en voer uit:
```
supabase/migrations/001_initial_schema.sql
```

### 4. Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3000

## Deployment (Render)

1. Push naar GitHub
2. Maak een nieuwe **Web Service** aan op Render gekoppeld aan je repo
3. Stel alle environment variables in via **Render Dashboard → Environment**
4. Render deploy automatisch bij elke push naar `main`

### Webhook registreren (eenmalig na eerste deploy)

```bash
APP_URL=https://jouw-app.onrender.com node scripts/register-webhook.js
```

## Projectstructuur

```
/server          Node/Express backend
/client          Vite frontend (PWA)
/supabase        Database migraties
/scripts         Hulpscripts (webhook registratie)
```

## Security

- Strava tokens worden AES-256-GCM encrypted opgeslagen
- Sessies via httpOnly + secure + sameSite=strict cookies
- RLS actief op alle Supabase tabellen
- CSRF-bescherming via OAuth state parameter
- Helmet.js security headers
- Rate limiting op auth en API endpoints
