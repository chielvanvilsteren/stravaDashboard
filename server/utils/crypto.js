'use strict';

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 12;  // bytes — standaard voor GCM
const TAG_LENGTH = 16; // bytes

/**
 * Laad de encryptiesleutel uit de environment.
 * Verwacht een 64-karakter hexstring (= 32 bytes).
 * Stopt de applicatie als de sleutel ontbreekt of ongeldig is.
 */
function loadKey() {
  const hexKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hexKey) {
    console.error('FATAL: TOKEN_ENCRYPTION_KEY not set');
    process.exit(1);
  }
  const keyBuf = Buffer.from(hexKey, 'hex');
  if (keyBuf.length !== KEY_LENGTH) {
    console.error(`FATAL: TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars`);
    process.exit(1);
  }
  return keyBuf;
}

const KEY = loadKey();

/**
 * Encrypt een plaintext string met AES-256-GCM.
 * Resultaat: "<iv_hex>:<tag_hex>:<ciphertext_hex>"
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt een string die eerder versleuteld is met encrypt().
 * @param {string} ciphertext  "<iv_hex>:<tag_hex>:<data_hex>"
 * @returns {string}
 */
export function decrypt(ciphertext) {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid ciphertext format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
