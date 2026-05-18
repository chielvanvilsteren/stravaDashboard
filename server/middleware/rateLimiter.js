'use strict';

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter voor auth-endpoints:
 * max 10 pogingen per IP per 15 minuten.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuten
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Rate limiter voor API-endpoints:
 * max 100 verzoeken per IP per minuut.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuut
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
