'use strict';

/**
 * requireAuth middleware
 * Verifieert de server-side sessie bij elk /api/* verzoek.
 * Bij ontbrekende of verlopen sessie: 401. Nooit doorlaten zonder geldig userId.
 */
export function requireAuth(req, res, next) {
  if (!req.signedCookies?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
