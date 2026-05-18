/**
 * notifications.js — realtime activiteiten-meldingen via SSE
 *
 * Verbindt met /api/events en toont een toast wanneer een nieuwe
 * Strava-activiteit binnenkomt. Herlaad ook de actieve tab automatisch.
 */

const ICONS = { Run: '🏃', Ride: '🚴', Walk: '🚶', Hike: '🥾' };

export function initNotifications() {
  // EventSource stuurt automatisch de auth-cookie mee
  const es = new EventSource('/api/events');

  es.addEventListener('activity', (e) => {
    try {
      const { name, type } = JSON.parse(e.data);
      const icon = ICONS[type] ?? '⚡';
      showToast(`${icon} Nieuwe activiteit: ${name}`);
      // Herlaad de actieve tab zodat de nieuwe activiteit zichtbaar is
      window.dispatchEvent(new CustomEvent('strava:synced'));
    } catch {
      // ongeldige payload — negeer
    }
  });

  // EventSource herverbindt automatisch bij een error/disconnect
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Start fade-in na één frame
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--visible')));

  // Fade-out na 4 s, verwijder daarna uit DOM
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4000);
}
