'use strict';

import express from 'express';
import bcrypt from 'bcrypt';

const router = express.Router();

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Input validatie
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
  }

  // Vergelijk met waarden uit environment (timing-safe via bcrypt)
  const validUsername = process.env.ADMIN_USERNAME;
  const validHash    = process.env.ADMIN_PASSWORD_HASH;

  if (!validUsername || !validHash) {
    console.error('FATAL: ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const usernameMatch = username === validUsername;
  const passwordMatch = await bcrypt.compare(password, validHash);

  // Beide checks altijd uitvoeren (voorkomt timing attacks op gebruikersnaam)
  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ error: 'Ongeldige gebruikersnaam of wachtwoord' });
  }

  req.session.userId = validUsername;
  res.json({ ok: true });
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
  res.json({ username: req.session.userId });
});

export default router;
