/**
 * nav.js — Tabbladbeheer
 * - Drie tabs: overview, running, cycling
 * - Actieve tab opgeslagen in localStorage
 * - Data wordt lazy geladen bij eerste bezoek aan een tab
 */

import { renderOverview } from './tabs/overview.js';
import { renderRunning } from './tabs/running.js';
import { renderCycling } from './tabs/cycling.js';
import { renderActivities } from './tabs/activities.js';

const TAB_KEY = 'activeTab';
const DEFAULT_TAB = 'overview';

const TABS = {
  overview:   { render: renderOverview,   label: 'Overzicht' },
  running:    { render: renderRunning,    label: 'Hardlopen' },
  cycling:    { render: renderCycling,    label: 'Wielrennen' },
  activities: { render: renderActivities, label: 'Activiteiten' },
};

// Jaar-filter state
let selectedYear = new Date().getFullYear();

export function getYearFilter() {
  if (!selectedYear) return {};
  return {
    from: `${selectedYear}-01-01`,
    to:   `${selectedYear}-12-31`,
  };
}

export function setYear(year) {
  selectedYear = year ? Number(year) : null;
  // Herlaad alle tabs zodat ze de nieuwe filter gebruiken
  loaded.clear();
  const current = localStorage.getItem(TAB_KEY) ?? DEFAULT_TAB;
  loadTab(current);
}

// Bijhouden welke tabs al geladen zijn
const loaded = new Set();

export function initNav() {
  const tabBtns = document.querySelectorAll('.tab-btn');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Herstel actieve tab uit localStorage
  const saved = localStorage.getItem(TAB_KEY);
  const initial = TABS[saved] ? saved : DEFAULT_TAB;
  switchTab(initial);

  // Herlaad actieve tab na sync
  window.addEventListener('strava:synced', () => {
    const current = localStorage.getItem(TAB_KEY) ?? DEFAULT_TAB;
    loaded.clear();
    loadTab(current);
  });
}

function switchTab(tabId) {
  if (!TABS[tabId]) return;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  // Toon/verberg panels
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.add('hidden');
  });
  document.getElementById(`tab-${tabId}`).classList.remove('hidden');

  // Sla actieve tab op
  localStorage.setItem(TAB_KEY, tabId);

  // Laad data (lazy)
  loadTab(tabId);
}

async function loadTab(tabId) {
  if (loaded.has(tabId)) return;
  loaded.add(tabId);

  const panel = document.getElementById(`tab-${tabId}`);
  panel.innerHTML = '<div class="loading"><div class="spinner"></div> Laden…</div>';

  try {
    await TABS[tabId].render(panel, getYearFilter());
  } catch (err) {
    if (err.offline) {
      panel.innerHTML = `
        <div class="empty-state">
          📵
          <p>Geen netwerkverbinding. Gecachede data wordt getoond zodra je weer online bent.</p>
        </div>`;
    } else {
      panel.innerHTML = `
        <div class="empty-state">
          ⚠️
          <p>Kon data niet laden: ${err.message}</p>
        </div>`;
    }
    // Verwijder uit loaded set zodat het opnieuw geprobeerd kan worden
    loaded.delete(tabId);
  }
}
