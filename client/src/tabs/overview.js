/**
 * tabs/overview.js — 🏠 Overzicht tab
 *
 * Toont gecombineerde KPIs, weekvolume (run + ride), activiteitskalender,
 * gecombineerde efficiëntietrend en recente activiteiten.
 */

import { fetchActivities, fetchSummary } from '../api.js';
import {
  COLORS, formatKm, formatDuration, formatDate,
  rollingAverage, normalizeScores, groupByWeek, renderEmptyChart,
} from '../charts/shared.js';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

async function getChart() {
  return Chart;
}

export async function renderOverview(panel, { from, to } = {}) {
  // Haal data parallel op
  const [summaryData, runData, rideData] = await Promise.all([
    fetchSummary(),
    fetchActivities({ type: 'Run', limit: 100, from, to }),
    fetchActivities({ type: 'Ride', limit: 100, from, to }),
  ]);

  const runs  = runData.activities ?? [];
  const rides = rideData.activities ?? [];
  const s     = summaryData.summary ?? {};
  const runS  = s['Run'] ?? {};
  const rideS = s['Ride'] ?? {};

  panel.innerHTML = `
    <!-- KPI balk -->
    <div class="kpi-grid" id="ov-kpis"></div>

    <!-- Leuke calorieën vergelijking -->
    <div class="card" id="ov-fun"></div>

    <!-- Wekelijks volume -->
    <div class="card">
      <div class="card-title">Wekelijks volume</div>
      <div class="chart-wrap" id="ov-weekly"></div>
    </div>

    <!-- Activiteitskalender -->
    <div class="card">
      <div class="card-title">Laatste 30 activiteiten</div>
      <div id="ov-calendar" class="activity-calendar"></div>
    </div>

    <!-- Gecombineerde efficiëntietrend -->
    <div class="card">
      <div class="card-title">Gecombineerde efficiëntietrend (genormaliseerd)</div>
      <div class="chart-wrap" id="ov-trend"></div>
    </div>

    <!-- Recente activiteiten -->
    <div class="card">
      <div class="card-title">Recente activiteiten</div>
      <div class="activity-list" id="ov-recent"></div>
    </div>
  `;

  renderKPIs(panel.querySelector('#ov-kpis'), runS, rideS);
  renderFunCalories(panel.querySelector('#ov-fun'), [...runs, ...rides]);
  await renderWeeklyChart(panel.querySelector('#ov-weekly'), runs, rides);
  renderCalendar(panel.querySelector('#ov-calendar'), runs, rides);
  await renderEfficiencyTrend(panel.querySelector('#ov-trend'), runs, rides);
  renderRecentActivities(panel.querySelector('#ov-recent'), runs, rides);
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(container, runS, rideS) {
  const totalHours = ((runS.total_moving_time_s ?? 0) + (rideS.total_moving_time_s ?? 0)) / 3600;
  const totalCal   = (runS.total_calories ?? 0) + (rideS.total_calories ?? 0);

  container.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">🏃 Hardlopen</div>
      <div class="kpi-value" style="color:var(--color-run)">${formatKm(runS.total_distance_m ?? 0)}</div>
      <div class="kpi-sub">${runS.count ?? 0} activiteiten</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">🚴 Fietsen</div>
      <div class="kpi-value" style="color:var(--color-ride)">${formatKm(rideS.total_distance_m ?? 0)}</div>
      <div class="kpi-sub">${rideS.count ?? 0} activiteiten</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">⏱ Trainingsuren</div>
      <div class="kpi-value">${totalHours.toFixed(0)}u</div>
      <div class="kpi-sub">dit jaar</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">🔥 Calorieën</div>
      <div class="kpi-value">${Math.round(totalCal).toLocaleString('nl-NL')}</div>
      <div class="kpi-sub">kcal verbrand</div>
    </div>
  `;
}

// ── Fun calorieën ──────────────────────────────────────────────────────────────
function renderFunCalories(container, all) {
  const totalCal = all.reduce((s, a) => s + (a.calories ?? 0), 0);

  if (totalCal < 10) {
    container.innerHTML = `
      <div class="card-title">🔥 Calorieën in context</div>
      <p class="fun-empty">Nog geen calorieëndata — Strava stuurt dit mee zodra activiteiten gesynchroniseerd zijn.</p>`;
    return;
  }

  // Datumspanne voor gemiddelden
  const dates = all.map(a => a.activity_date).filter(Boolean).sort();
  const firstDate = new Date(dates[0]);
  const lastDate  = new Date(dates[dates.length - 1]);
  const daySpan   = Math.max(1, (lastDate - firstDate) / 86_400_000);
  const weeks     = Math.max(1, daySpan / 7);
  const months    = Math.max(1, daySpan / 30.44);

  const perWeek  = Math.round(totalCal / weeks);
  const perMonth = Math.round(totalCal / months);

  // Equivalenten (kcal per item)
  const ITEMS = [
    { emoji: '🍺', name: 'biertjes',    kcal: 150  },
    { emoji: '🍕', name: 'pizzapunten', kcal: 300  },
    { emoji: '🍔', name: 'Big Macs',    kcal: 550  },
    { emoji: '🥐', name: 'croissants',  kcal: 230  },
    { emoji: '🍪', name: 'stroopwafels',kcal: 130  },
  ];

  const equivHTML = ITEMS.map(({ emoji, name, kcal }) => {
    const n = Math.round(totalCal / kcal);
    return `
      <div class="fun-item">
        <span class="fun-emoji">${emoji}</span>
        <div class="fun-info">
          <span class="fun-count">${n.toLocaleString('nl-NL')}</span>
          <span class="fun-name">${name}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="card-title">🔥 Calorieën in context</div>
    <div class="fun-averages">
      <div class="fun-avg-item">
        <span class="fun-avg-val">${perWeek.toLocaleString('nl-NL')}</span>
        <span class="fun-avg-lbl">kcal / week</span>
      </div>
      <div class="fun-avg-item">
        <span class="fun-avg-val">${perMonth.toLocaleString('nl-NL')}</span>
        <span class="fun-avg-lbl">kcal / maand</span>
      </div>
      <div class="fun-avg-item">
        <span class="fun-avg-val">${Math.round(totalCal).toLocaleString('nl-NL')}</span>
        <span class="fun-avg-lbl">kcal totaal</span>
      </div>
    </div>
    <p class="fun-intro">Dat zijn in totaal:</p>
    <div class="fun-grid">${equivHTML}</div>
  `;
}

// ── Wekelijks volume (gestapeld) ──────────────────────────────────────────────
async function renderWeeklyChart(wrap, runs, rides) {
  if (!runs.length && !rides.length) return renderEmptyChart(wrap, 'Nog geen activiteiten');

  const C = await getChart();

  const sortedRuns  = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const sortedRides = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  const runWeeks  = groupByWeek(sortedRuns);
  const rideWeeks = groupByWeek(sortedRides);

  // Combineer alle weeksleutels
  const allWeeks = [...new Set([...runWeeks.map((w) => w.week), ...rideWeeks.map((w) => w.week)])].sort().slice(-16);

  const runMap  = Object.fromEntries(runWeeks.map((w) => [w.week, w.km]));
  const rideMap = Object.fromEntries(rideWeeks.map((w) => [w.week, w.km]));

  const c = document.createElement('canvas');
  wrap.innerHTML = '';
  wrap.appendChild(c);

  new C(c, {
    type: 'bar',
    data: {
      labels: allWeeks,
      datasets: [
        { label: 'Hardlopen', data: allWeeks.map((w) => (runMap[w] ?? 0).toFixed(1)), backgroundColor: COLORS.run },
        { label: 'Fietsen',   data: allWeeks.map((w) => (rideMap[w] ?? 0).toFixed(1)), backgroundColor: COLORS.ride },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { grid: { display: false }, stacked: false },
        y: { grid: { color: COLORS.grid }, title: { display: true, text: 'km' } },
      },
    },
  });
}

// ── Activiteitskalender ───────────────────────────────────────────────────────
function renderCalendar(container, runs, rides) {
  const all = [
    ...runs.map((r) => ({ date: r.activity_date, type: 'run' })),
    ...rides.map((r) => ({ date: r.activity_date, type: 'ride' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  if (!all.length) {
    container.innerHTML = '<div class="empty-state">📅<p>Nog geen activiteiten</p></div>';
    return;
  }

  container.innerHTML = all
    .map(
      (a) =>
        `<div class="cal-dot ${a.type}" title="${a.date} (${a.type === 'run' ? '🏃' : '🚴'})"></div>`
    )
    .join('');
}

// ── Gecombineerde efficiëntietrend ────────────────────────────────────────────
async function renderEfficiencyTrend(wrap, runs, rides) {
  const hasRuns  = runs.filter((r) => r.efficiency_score).length >= 3;
  const hasRides = rides.filter((r) => r.efficiency_score).length >= 3;

  if (!hasRuns && !hasRides) return renderEmptyChart(wrap, 'Onvoldoende data voor efficiëntietrend');

  const C = await getChart();
  const datasets = [];

  if (hasRuns) {
    const sorted = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    const raw = sorted.map((r) => r.efficiency_score ?? null);
    const normalized = normalizeScores(raw);
    const avgLine = rollingAverage(normalized, 5);
    datasets.push({
      label: '🏃 Hardlopen',
      data: avgLine,
      borderColor: COLORS.run,
      tension: 0.4, pointRadius: 0, fill: false,
    });
  }

  if (hasRides) {
    const sorted = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    const raw = sorted.map((r) => r.efficiency_score ?? null);
    const normalized = normalizeScores(raw);
    const avgLine = rollingAverage(normalized, 5);
    datasets.push({
      label: '🚴 Fietsen',
      data: avgLine,
      borderColor: COLORS.ride,
      tension: 0.4, pointRadius: 0, fill: false,
    });
  }

  const c = document.createElement('canvas');
  wrap.innerHTML = '';
  wrap.appendChild(c);

  new C(c, {
    type: 'line',
    data: { labels: Array(datasets[0].data.length).fill(''), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { display: false },
        y: { grid: { color: COLORS.grid }, title: { display: true, text: 'Score (0–100)' }, min: 0, max: 100 },
      },
    },
  });
}

// ── Recente activiteiten ──────────────────────────────────────────────────────
function renderRecentActivities(container, runs, rides) {
  const all = [
    ...runs.map((r) => ({ ...r, _type: 'run' })),
    ...rides.map((r) => ({ ...r, _type: 'ride' })),
  ].sort((a, b) => b.activity_date.localeCompare(a.activity_date)).slice(0, 5);

  if (!all.length) {
    container.innerHTML = '<div class="empty-state">🏅<p>Nog geen activiteiten gesynchroniseerd</p></div>';
    return;
  }

  container.innerHTML = all
    .map((act) => {
      const icon    = act._type === 'run' ? '🏃' : '🚴';
      const dist    = formatKm(act.distance_m);
      const hr      = act.avg_heartrate ? `${Math.round(act.avg_heartrate)} bpm` : '—';
      const date    = formatDate(act.activity_date);
      return `
        <div class="activity-item">
          <div class="activity-icon">${icon}</div>
          <div class="activity-info">
            <div class="activity-name">${act.name ?? 'Activiteit'}</div>
            <div class="activity-meta">${date}</div>
          </div>
          <div class="activity-stat">${dist}<br><small style="color:var(--color-muted)">${hr}</small></div>
        </div>`;
    })
    .join('');
}
