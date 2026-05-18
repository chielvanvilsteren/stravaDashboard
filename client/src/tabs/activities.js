/**
 * tabs/activities.js — 📋 Activiteiten overzicht
 *
 * Toont alle recente activiteiten gesorteerd op datum,
 * met type-specifieke statistieken.
 */

import { fetchActivities } from '../api.js';
import { formatKm, formatDuration, formatDate, formatPace } from '../charts/shared.js';

const PAGE_SIZE = 30;

export async function renderActivities(panel, { from, to } = {}) {
  panel.innerHTML = `<div class="loading"><div class="spinner"></div> Laden…</div>`;

  let offset = 0;
  let allActivities = [];

  try {
    const { activities } = await fetchActivities({ limit: 100, offset: 0, from, to });
    allActivities = activities ?? [];
  } catch {
    panel.innerHTML = `<div class="empty-state"><p>Kon activiteiten niet laden.</p></div>`;
    return;
  }

  if (!allActivities.length) {
    panel.innerHTML = `
      <div class="empty-state">📋
        <p>Nog geen activiteiten gevonden.<br>Sync je Strava-account om te beginnen.</p>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="act-list" id="act-list"></div>
    <div id="act-load-more" class="act-load-more hidden">
      <button id="act-load-btn" class="btn-load-more">Meer laden</button>
    </div>
  `;

  const listEl = panel.querySelector('#act-list');
  const loadMoreEl = panel.querySelector('#act-load-more');

  function renderPage() {
    const slice = allActivities.slice(offset, offset + PAGE_SIZE);
    slice.forEach((a) => {
      listEl.insertAdjacentHTML('beforeend', renderRow(a));
    });
    offset += slice.length;
    if (offset < allActivities.length) {
      loadMoreEl.classList.remove('hidden');
    } else {
      loadMoreEl.classList.add('hidden');
    }
  }

  renderPage();

  panel.querySelector('#act-load-btn').addEventListener('click', renderPage);
}

function renderRow(a) {
  const isRun  = a.type === 'Run' || a.type === 'VirtualRun';
  const isRide = a.type === 'Ride' || a.type === 'VirtualRide';

  const icon = isRun ? '🏃' : isRide ? '🚴' : '🏋️';
  const dist = a.distance_m ? formatKm(a.distance_m) : '—';
  const dur  = a.moving_time_s ? formatDuration(a.moving_time_s) : '—';
  const hr   = a.avg_heartrate ? `${Math.round(a.avg_heartrate)} bpm` : '—';
  const date = a.activity_date ? formatDate(a.activity_date) : '—';

  let statLabel, statValue;
  if (isRun && a.pace_min_km) {
    statLabel = 'Tempo';
    statValue = formatPace(a.pace_min_km) + ' /km';
  } else if (isRide && a.speed_kmh) {
    statLabel = 'Snelheid';
    statValue = a.speed_kmh.toFixed(1) + ' km/h';
  } else if (a.avg_speed_ms) {
    statLabel = isRun ? 'Tempo' : 'Snelheid';
    statValue = isRun
      ? formatPace(1000 / a.avg_speed_ms / 60) + ' /km'
      : (a.avg_speed_ms * 3.6).toFixed(1) + ' km/h';
  } else {
    statLabel = 'Afstand';
    statValue = dist;
  }

  return `
    <div class="act-row">
      <div class="act-icon">${icon}</div>
      <div class="act-main">
        <div class="act-name">${a.name ?? a.type}</div>
        <div class="act-date">${date}</div>
      </div>
      <div class="act-stats">
        <div class="act-stat">
          <span class="act-stat-val">${dist}</span>
          <span class="act-stat-lbl">afstand</span>
        </div>
        <div class="act-stat">
          <span class="act-stat-val">${dur}</span>
          <span class="act-stat-lbl">duur</span>
        </div>
        <div class="act-stat">
          <span class="act-stat-val">${statValue}</span>
          <span class="act-stat-lbl">${statLabel}</span>
        </div>
        <div class="act-stat">
          <span class="act-stat-val ${a.avg_heartrate ? 'red-hr' : ''}">${hr}</span>
          <span class="act-stat-lbl">hartslag</span>
        </div>
      </div>
    </div>
  `;
}
