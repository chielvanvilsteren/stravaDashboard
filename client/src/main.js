/**
 * main.js — App entry point
 * - Registreert de service worker
 * - Controleert sessie via /auth/me
 * - Toont login of app op basis van sessie
 * - Beheert PWA install banner en offline indicator
 */

import './style.css';
import { checkSession, login } from './auth.js';
import { initNav, setYear } from './nav.js';
import { initNotifications } from './notifications.js';

// ── Service Worker registratie ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => console.warn('SW registration failed:', err));
}

// ── Offline indicator ─────────────────────────────────────────────────────────
const offlineIndicator = document.getElementById('offline-indicator');
window.addEventListener('offline', () => offlineIndicator.classList.remove('hidden'));
window.addEventListener('online', () => offlineIndicator.classList.add('hidden'));
if (!navigator.onLine) offlineIndicator.classList.remove('hidden');

// ── PWA Install banner ────────────────────────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('install-banner');
  banner.classList.remove('hidden');
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('install-banner').classList.add('hidden');
  }
  deferredInstallPrompt = null;
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  document.getElementById('install-banner').classList.add('hidden');
});

// ── Login form handler ────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled  = true;
  btn.textContent = 'Bezig…';
  errEl.classList.add('hidden');

  const result = await login(username, password);
  if (result.ok) {
    window.location.reload();
  } else {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Inloggen';
  }
});

// ── App initialisatie ─────────────────────────────────────────────────────────
async function init() {
  const user = await checkSession();

  if (!user) {
    document.getElementById('login-screen').classList.remove('hidden');
    return;
  }

  document.getElementById('app-screen').classList.remove('hidden');

  // Jaar-selector vullen
  const yearSelect = document.getElementById('year-select');
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  for (let y = currentYear; y >= startYear; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
  yearSelect.value = currentYear;
  yearSelect.addEventListener('change', () => setYear(yearSelect.value));

  initNav();
  initNotifications();

  // Sync knop
  document.getElementById('sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.textContent = '⟳';
    btn.style.animation = 'spin .7s linear infinite';
    try {
      const { apiFetch } = await import('./api.js');
      await apiFetch('/api/sync', { method: 'POST' });
      // Herlaad huidige tab
      window.dispatchEvent(new CustomEvent('strava:synced'));
    } finally {
      btn.style.animation = '';
      btn.textContent = '⟳';
    }
  });

  // Strava koppelen
  document.getElementById('connect-strava-btn').addEventListener('click', () => {
    window.location.href = '/setup/connect-strava';
  });

  // Logout knop
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { logout } = await import('./auth.js');
    await logout();
  });
}

init();
