/**
 * charts/running/index.js — Hardloop-specifieke Chart.js functies
 *
 * Exporteert alle 9 grafiekfuncties die running.js nodig heeft.
 */

import {
  COLORS, baseLineOptions, baseBarOptions, scatterOptions,
  rollingAverage, formatDate, formatPace, formatMonth,
  groupByWeek, groupByMonth, renderEmptyChart,
} from '../shared.js';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

async function getChart() {
  return Chart;
}

function canvas(wrap) {
  const c = document.createElement('canvas');
  wrap.innerHTML = '';
  wrap.appendChild(c);
  return c;
}

// ── 1. Efficiëntiescore ───────────────────────────────────────────────────────
export async function renderEfficiency(wrap, runs) {
  if (!runs.length) return renderEmptyChart(wrap, 'Nog geen hardloopdata');
  const C = await getChart();
  const labels = runs.map((r) => formatDate(r.activity_date));
  const scores = runs.map((r) => r.efficiency_score ?? null);
  const avg = rollingAverage(scores, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Efficiëntie', data: scores, borderColor: COLORS.run, backgroundColor: COLORS.runLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-runs gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: baseLineOptions('Score'),
  });
}

// ── 2. Tempoontwikkeling ──────────────────────────────────────────────────────
export async function renderPace(wrap, runs) {
  if (!runs.length) return renderEmptyChart(wrap, 'Nog geen hardloopdata');
  const C = await getChart();
  const labels = runs.map((r) => formatDate(r.activity_date));
  const paces = runs.map((r) => r.pace_min_km ?? null);
  const avg = rollingAverage(paces, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Tempo', data: paces, borderColor: COLORS.run, backgroundColor: COLORS.runLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-runs gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: {
      ...baseLineOptions('min/km', true), // Y-as omgekeerd: lager = sneller
      plugins: {
        ...baseLineOptions().plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatPace(ctx.raw)}`,
          },
        },
      },
    },
  });
}

// ── 3. Hartslagontwikkeling ───────────────────────────────────────────────────
export async function renderHeartrate(wrap, runs) {
  if (!runs.length) return renderEmptyChart(wrap, 'Nog geen hartslag-data');
  const C = await getChart();
  const labels = runs.map((r) => formatDate(r.activity_date));
  const hrs = runs.map((r) => r.avg_heartrate ?? null);
  const avg = rollingAverage(hrs, 5);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Gem. HR (bpm)', data: hrs, borderColor: COLORS.run, backgroundColor: COLORS.runLight, tension: 0.3, pointRadius: 3, fill: true },
        { label: '5-runs gem.', data: avg, borderColor: COLORS.avg, borderDash: [5,3], pointRadius: 0, tension: 0.3 },
      ],
    },
    options: baseLineOptions('bpm'),
  });
}

// ── 4. Tempo bij vaste HR (145–155 bpm) ──────────────────────────────────────
export async function renderPaceAtHR(wrap, runs) {
  const filtered = runs.filter((r) => r.avg_heartrate >= 145 && r.avg_heartrate <= 155 && r.pace_min_km);
  if (filtered.length < 2) return renderEmptyChart(wrap, 'Onvoldoende runs op 145–155 bpm');
  const C = await getChart();
  const labels = filtered.map((r) => formatDate(r.activity_date));
  const paces = filtered.map((r) => r.pace_min_km);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Tempo @ 145–155 bpm', data: paces, borderColor: COLORS.run, tension: 0.3, pointRadius: 4, fill: false }],
    },
    options: baseLineOptions('min/km', true),
  });
}

// ── 5. HR bij vast tempo (6:20–7:00 /km) ─────────────────────────────────────
export async function renderHRAtPace(wrap, runs) {
  const filtered = runs.filter((r) => r.pace_min_km >= 6.33 && r.pace_min_km <= 7.0 && r.avg_heartrate);
  if (filtered.length < 2) return renderEmptyChart(wrap, 'Onvoldoende runs op 6:20–7:00 /km');
  const C = await getChart();
  const labels = filtered.map((r) => formatDate(r.activity_date));
  const hrs = filtered.map((r) => r.avg_heartrate);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'HR @ 6:20–7:00 /km', data: hrs, borderColor: COLORS.run, tension: 0.3, pointRadius: 4, fill: false }],
    },
    options: baseLineOptions('bpm'),
  });
}

// ── 6. Scatterplot tempo vs HR (per maand gekleurd) ──────────────────────────
export async function renderScatter(wrap, runs) {
  if (runs.length < 3) return renderEmptyChart(wrap, 'Onvoldoende data voor scatterplot');
  const C = await getChart();

  // Groepeer per maand
  const byMonth = {};
  for (const r of runs) {
    const m = r.activity_date?.slice(0, 7);
    if (!m || !r.pace_min_km || !r.avg_heartrate) continue;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push({ x: r.pace_min_km, y: r.avg_heartrate, r: Math.max(4, (r.distance_m / 1000) * 0.4), label: r.name });
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
    options: scatterOptions('Tempo (min/km)', 'HR (bpm)'),
  });
}

// ── 7. Wekelijks loopvolume ───────────────────────────────────────────────────
export async function renderWeeklyVolume(wrap, runs) {
  if (!runs.length) return renderEmptyChart(wrap, 'Nog geen loopdata');
  const C = await getChart();
  const sorted = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const weeks = groupByWeek(sorted);
  const last20 = weeks.slice(-20);
  new C(canvas(wrap), {
    type: 'bar',
    data: {
      labels: last20.map((w) => w.week),
      datasets: [{ label: 'Loopkilometers', data: last20.map((w) => w.km.toFixed(1)), backgroundColor: COLORS.run }],
    },
    options: baseBarOptions('km'),
  });
}

// ── 8. Cadans over tijd ───────────────────────────────────────────────────────
export async function renderCadence(wrap, runs) {
  const withCadence = runs.filter((r) => r.avg_cadence);
  if (!withCadence.length) return renderEmptyChart(wrap, 'Geen cadansdata beschikbaar');
  const C = await getChart();
  const labels = withCadence.map((r) => formatDate(r.activity_date));
  // Strava geeft stappen per been per min — ×2 voor totale cadans
  const cadence = withCadence.map((r) => r.avg_cadence * 2);
  new C(canvas(wrap), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Cadans (spm)', data: cadence, borderColor: COLORS.run, tension: 0.3, pointRadius: 3, fill: false },
        {
          label: 'Doel (166 spm)',
          data: Array(labels.length).fill(166),
          borderColor: COLORS.avg, borderDash: [6,3], pointRadius: 0,
        },
      ],
    },
    options: baseLineOptions('spm'),
  });
}

// ── 9. Maandvergelijking (efficiëntie + HR) ───────────────────────────────────
export async function renderMonthComparison(wrap, runs) {
  if (!runs.length) return renderEmptyChart(wrap, 'Nog geen data');
  const C = await getChart();
  const sorted = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const effMonths = groupByMonth(sorted, 'efficiency_score');
  const hrMonths = groupByMonth(sorted, 'avg_heartrate');

  const labels = effMonths.map((m) => formatMonth(m.month + '-01'));
  new C(canvas(wrap), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar',  label: 'Efficiëntie', data: effMonths.map((m) => m.avg?.toFixed(2) ?? null), backgroundColor: COLORS.runLight, borderColor: COLORS.run, borderWidth: 1, yAxisID: 'y' },
        { type: 'line', label: 'Gem. HR',     data: hrMonths.map((m) => m.avg?.toFixed(0) ?? null), borderColor: COLORS.avg, tension: 0.3, yAxisID: 'y2', pointRadius: 4 },
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
