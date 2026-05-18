/**
 * charts/cycling/index.js — Fiets-specifieke Chart.js functies
 *
 * Exporteert alle 9 grafiekfuncties die cycling.js nodig heeft.
 */

import {
  COLORS, baseLineOptions, baseBarOptions, scatterOptions,
  rollingAverage, formatDate, formatMonth,
  groupByWeek, groupByMonth, renderEmptyChart,
} from '../shared.js';

let Chart;

async function getChart() {
  if (!Chart) {
    Chart = (await import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm')).Chart;
    const { registerables } = await import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm');
    Chart.register(...registerables);
  }
  return Chart;
}

function canvas(wrap) {
  const c = document.createElement('canvas');
  wrap.innerHTML = '';
  wrap.appendChild(c);
  return c;
}

// ── 1. Efficiëntiescore fietsen ───────────────────────────────────────────────
export async function renderEfficiency(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Nog geen fietsdata');
  const C = await getChart();
  const labels = rides.map((r) => formatDate(r.activity_date));
  const scores = rides.map((r) => r.efficiency_score ?? null);
  const avg = rollingAverage(scores, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Efficiëntie', data: scores, borderColor: COLORS.ride, backgroundColor: COLORS.rideLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-ritten gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: baseLineOptions('Score'),
  });
}

// ── 2. Snelheidsontwikkeling ──────────────────────────────────────────────────
export async function renderSpeed(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Nog geen fietsdata');
  const C = await getChart();
  const labels = rides.map((r) => formatDate(r.activity_date));
  const speeds = rides.map((r) => r.speed_kmh ?? null);
  const avg = rollingAverage(speeds, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Snelheid (km/u)', data: speeds, borderColor: COLORS.ride, backgroundColor: COLORS.rideLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-ritten gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: baseLineOptions('km/u'),
  });
}

// ── 3. Hartslagontwikkeling ───────────────────────────────────────────────────
export async function renderHeartrate(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Geen hartslag-data');
  const C = await getChart();
  const labels = rides.map((r) => formatDate(r.activity_date));
  const hrs = rides.map((r) => r.avg_heartrate ?? null);
  const avg = rollingAverage(hrs, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Gem. HR (bpm)', data: hrs, borderColor: COLORS.ride, backgroundColor: COLORS.rideLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-ritten gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: baseLineOptions('bpm'),
  });
}

// ── 4. Snelheid bij vaste HR (145–155 bpm) ────────────────────────────────────
export async function renderSpeedAtHR(wrap, rides) {
  const filtered = rides.filter((r) => r.avg_heartrate >= 145 && r.avg_heartrate <= 155 && r.speed_kmh);
  if (filtered.length < 2) return renderEmptyChart(wrap, 'Onvoldoende ritten op 145–155 bpm');
  const C = await getChart();
  const labels = filtered.map((r) => formatDate(r.activity_date));
  const speeds = filtered.map((r) => r.speed_kmh);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Snelheid @ 145–155 bpm', data: speeds, borderColor: COLORS.ride, tension: 0.3, pointRadius: 4, fill: false }],
    },
    options: baseLineOptions('km/u'),
  });
}

// ── 5. HR bij vaste snelheid (28–30 km/u) ────────────────────────────────────
export async function renderHRAtSpeed(wrap, rides) {
  const filtered = rides.filter((r) => r.speed_kmh >= 28 && r.speed_kmh <= 30 && r.avg_heartrate);
  if (filtered.length < 2) return renderEmptyChart(wrap, 'Onvoldoende ritten op 28–30 km/u');
  const C = await getChart();
  const labels = filtered.map((r) => formatDate(r.activity_date));
  const hrs = filtered.map((r) => r.avg_heartrate);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'HR @ 28–30 km/u', data: hrs, borderColor: COLORS.ride, tension: 0.3, pointRadius: 4, fill: false }],
    },
    options: baseLineOptions('bpm'),
  });
}

// ── 6. Scatterplot snelheid vs HR (per maand gekleurd) ───────────────────────
export async function renderScatter(wrap, rides) {
  if (rides.length < 3) return renderEmptyChart(wrap, 'Onvoldoende data voor scatterplot');
  const C = await getChart();

  const byMonth = {};
  for (const r of rides) {
    const m = r.activity_date?.slice(0, 7);
    if (!m || !r.speed_kmh || !r.avg_heartrate) continue;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push({ x: r.speed_kmh, y: r.avg_heartrate, r: Math.max(4, (r.distance_m / 1000) * 0.15), label: r.name });
  }

  const datasets = Object.entries(byMonth).map(([month, points], i) => ({
    label: month,
    data: points,
    backgroundColor: COLORS.months[i % 12] + '99',
    borderColor: COLORS.months[i % 12],
    pointRadius: points.map((p) => p.r),
  }));

  new C(canvas(wrap), {
    type: 'bubble',
    data: { datasets },
    options: scatterOptions('Snelheid (km/u)', 'HR (bpm)'),
  });
}

// ── 7. Wekelijks fietsvolume ──────────────────────────────────────────────────
export async function renderWeeklyVolume(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Nog geen fietsdata');
  const C = await getChart();
  const sorted = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const weeks = groupByWeek(sorted);
  const last20 = weeks.slice(-20);
  new C(canvas(wrap), {
    type: 'bar',
    data: {
      labels: last20.map((w) => w.week),
      datasets: [{ label: 'Fietskilometers', data: last20.map((w) => w.km.toFixed(1)), backgroundColor: COLORS.ride }],
    },
    options: baseBarOptions('km'),
  });
}

// ── 8. Stijgingsmeters per rit ────────────────────────────────────────────────
export async function renderElevation(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Nog geen fietsdata');
  const C = await getChart();
  const sorted = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const labels = sorted.map((r) => formatDate(r.activity_date));
  const elevation = sorted.map((r) => r.elevation_gain ?? null);
  new C(canvas(wrap), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Stijging (m)', data: elevation, backgroundColor: COLORS.rideLight, borderColor: COLORS.ride, borderWidth: 1 }],
    },
    options: baseBarOptions('m'),
  });
}

// ── 9. Maandvergelijking (efficiëntie + HR) ───────────────────────────────────
export async function renderMonthComparison(wrap, rides) {
  if (!rides.length) return renderEmptyChart(wrap, 'Nog geen data');
  const C = await getChart();
  const sorted = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const effMonths = groupByMonth(sorted, 'efficiency_score');
  const hrMonths = groupByMonth(sorted, 'avg_heartrate');

  const labels = effMonths.map((m) => formatMonth(m.month + '-01'));
  new C(canvas(wrap), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar',  label: 'Efficiëntie', data: effMonths.map((m) => m.avg?.toFixed(2) ?? null), backgroundColor: COLORS.rideLight, borderColor: COLORS.ride, borderWidth: 1, yAxisID: 'y' },
        { type: 'line', label: 'Gem. HR',     data: hrMonths.map((m) => m.avg?.toFixed(0) ?? null),  borderColor: COLORS.avg, tension: 0.3, yAxisID: 'y2', pointRadius: 4 },
      ],
    },
    options: {
      ...baseBarOptions(),
      scales: {
        x:  { grid: { display: false } },
        y:  { grid: { color: COLORS.grid }, position: 'left',  title: { display: true, text: 'Efficiëntie' } },
        y2: { grid: { display: false },     position: 'right', title: { display: true, text: 'bpm' } },
      },
    },
  });
}
