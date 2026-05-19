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

  renderKPIs(panel.querySelector('#ov-kpis'), runS, rideS, [...runs, ...rides]);
  await renderWeeklyChart(panel.querySelector('#ov-weekly'), runs, rides);
  renderCalendar(panel.querySelector('#ov-calendar'), runs, rides);
  await renderEfficiencyTrend(panel.querySelector('#ov-trend'), runs, rides);
  renderRecentActivities(panel.querySelector('#ov-recent'), runs, rides);
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(container, runS, rideS, allActivities) {
  const totalHours = ((runS.total_moving_time_s ?? 0) + (rideS.total_moving_time_s ?? 0)) / 3600;
  const totalCal   = (runS.total_calories ?? 0) + (rideS.total_calories ?? 0);

  // Datumspanne voor gemiddelden
  const dates     = allActivities.map(a => a.activity_date).filter(Boolean).sort();
  const daySpan   = dates.length > 1
    ? Math.max(1, (new Date(dates.at(-1)) - new Date(dates[0])) / 86_400_000)
    : 1;
  const perDay    = totalCal / daySpan;
  const perWeek   = perDay * 7;
  const perMonth  = perDay * 30.44;

  const FOOD = [
    { emoji: '🍺', label: 'biertjes',     kcal: 150 },
    { emoji: '🍕', label: 'pizzapunten',  kcal: 300 },
    { emoji: '🍔', label: 'Big Macs',     kcal: 550 },
    { emoji: '🥐', label: 'croissants',   kcal: 230 },
    { emoji: '🍪', label: 'stroopwafels', kcal: 130 },
  ];

  // Alle staten die doorgelopen worden bij elke klik
  const states = [
    { label: '🔥 Calorieën',  value: Math.round(totalCal).toLocaleString('nl-NL'), sub: 'kcal verbrand' },
    { label: '📅 Gem. per dag',  value: Math.round(perDay).toLocaleString('nl-NL'),   sub: 'kcal / dag' },
    { label: '📆 Gem. per week', value: Math.round(perWeek).toLocaleString('nl-NL'),  sub: 'kcal / week' },
    { label: '🗓️ Gem. per maand',value: Math.round(perMonth).toLocaleString('nl-NL'), sub: 'kcal / maand' },
    ...FOOD.map(f => ({
      label: `${f.emoji} Equivalent`,
      value: Math.round(totalCal / f.kcal).toLocaleString('nl-NL'),
      sub:   f.label,
    })),
  ];

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
    <div class="kpi-card kpi-card--tappable" id="kpi-cal" title="Tik om te wisselen">
      <div class="kpi-label" id="kpi-cal-label">${states[0].label}</div>
      <div class="kpi-value" id="kpi-cal-value">${states[0].value}</div>
      <div class="kpi-sub" id="kpi-cal-sub">${states[0].sub}</div>
      <div class="kpi-tap-hint">tik ›</div>
    </div>
  `;

  if (totalCal < 1) return; // geen data → niet interactief maken

  let idx = 0;
  const card  = container.querySelector('#kpi-cal');
  const lbl   = container.querySelector('#kpi-cal-label');
  const val   = container.querySelector('#kpi-cal-value');
  const sub   = container.querySelector('#kpi-cal-sub');

  card.addEventListener('click', () => {
    idx = (idx + 1) % states.length;
    const s = states[idx];
    card.classList.add('kpi-card--flash');
    lbl.textContent = s.label;
    val.textContent = s.value;
    sub.textContent = s.sub;
    setTimeout(() => card.classList.remove('kpi-card--flash'), 200);
  });
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
