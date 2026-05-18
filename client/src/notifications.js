/**
 * notifications.js — realtime activiteiten-meldingen
 *
 * 1. SSE (Server-Sent Events): toast + tab-reload als app open is
 * 2. Web Push: OS-notificatie ook als app gesloten/op achtergrond is
 */

import { apiFetch } from './api.js';

const ICONS = { Run: '🏃', Ride: '🚴', Walk: '🚶', Hike: '🥾' };

export async function initNotifications() {
  // ── SSE ───────────────────────────────────────────────────────────────────
  const es = new EventSource('/api/events');
  es.addEventListener('activity', (e) => {
    try {
      const { name, type } = JSON.parse(e.data);
      const icon = ICONS[type] ?? '⚡';
      showToast(`${icon} Nieuwe activiteit: ${name}`);
      window.dispatchEvent(new CustomEvent('strava:synced'));
    } catch { /* ongeldige payload */ }
  });

  // ── Web Push ──────────────────────────────────────────────────────────────
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    // Haal VAPID public key op
    const { publicKey } = await apiFetch('/api/push/vapid-key');
    if (!publicKey) return;

    const reg = await navigator.serviceWorker.ready;

    // Al geabonneerd? Dan niets te doen
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    // Vraag toestemming (wordt één keer getoond door de browser)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Abonneer
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Stuur subscription naar server
    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });
  } catch (err) {
    console.warn('Web Push setup mislukt:', err.message);
  }
}

// Hulpfunctie: base64url → Uint8Array (vereist door PushManager)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--visible')));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4000);
}
