#!/usr/bin/env node
/**
 * Genereer een bcrypt hash van een wachtwoord voor ADMIN_PASSWORD_HASH.
 *
 * Gebruik:
 *   node scripts/generate-password-hash.js MijnWachtwoord123
 */

'use strict';

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.error('Gebruik: node scripts/generate-password-hash.js <wachtwoord>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Wachtwoord moet minimaal 8 tekens zijn.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log('\nVoeg dit toe aan je .env en Render Dashboard:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
