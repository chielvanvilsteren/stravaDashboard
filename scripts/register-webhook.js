#!/usr/bin/env node
/**
 * Webhook registratie bij Strava (eenmalig uitvoeren na deployment).
 *
 * Gebruik:
 *   node scripts/register-webhook.js
 *
 * Vereiste environment variabelen (.env):
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   STRAVA_WEBHOOK_VERIFY_TOKEN
 *   APP_URL
 */

'use strict';

import 'dotenv/config';
import axios from 'axios';

const required = [
  'STRAVA_CLIENT_ID',
  'STRAVA_CLIENT_SECRET',
  'STRAVA_WEBHOOK_VERIFY_TOKEN',
  'APP_URL',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is not set`);
    process.exit(1);
  }
}

const callbackUrl = `${process.env.APP_URL}/webhook/strava`;

async function listSubscriptions() {
  const { data } = await axios.get(
    'https://www.strava.com/api/v3/push_subscriptions',
    {
      params: {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
      },
    }
  );
  return data;
}

async function deleteSubscription(id) {
  await axios.delete(`https://www.strava.com/api/v3/push_subscriptions/${id}`, {
    params: {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
    },
  });
  console.log(`Deleted existing subscription ${id}`);
}

async function createSubscription() {
  const { data } = await axios.post(
    'https://www.strava.com/api/v3/push_subscriptions',
    {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      callback_url: callbackUrl,
      verify_token: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    }
  );
  return data;
}

(async () => {
  console.log('Checking existing Strava webhook subscriptions...');
  const existing = await listSubscriptions();

  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing subscription(s).`);
    for (const sub of existing) {
      await deleteSubscription(sub.id);
    }
  }

  console.log(`Registering webhook → ${callbackUrl}`);
  const subscription = await createSubscription();
  console.log('Webhook registered successfully:', subscription);
})();
