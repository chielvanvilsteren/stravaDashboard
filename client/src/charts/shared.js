/**
 * charts/shared.js — Gedeelde Chart.js helpers, kleurpalet en formatters
 *
 * Chart.js wordt geladen via CDN in index.html of geïmporteerd als npm module.
 * Alle chartfuncties in running/ en cycling/ gebruiken deze helpers.
 */

// ── Kleurpalet ────────────────────────────────────────────────────────────────
export const COLORS = {
  run:        '#fc4c02',
  ride:       '#3b82f6',
  runLight:   'rgba(252,76,2,0.2)',
  rideLight:  'rgba(59,130,246,0.2)',
  muted:      '#8890b0',
  grid:       'rgba(255,255,255,0.07)',
  avg:        '#f59e0b',
  avgLight:   'rgba(245,158,11,0.2)',
  // Maandkleuren (cyclisch)
  months: [
    '#fc4c02','#f97316','#eab308','#22c55e',
    '#14b8a6','#3b82f6','#8b5cf6','#ec4899',
    '#ef4444','#06b6d4','#a3e635','#fb923c',
  ],
};

// ── Globale Chart.js defaults ─────────────────────────────────────────────────
export function applyChartDefaults(Chart) {
  Chart.defaults.color = '#8890b0';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1e2235';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = '#e8eaf6';
  Chart.defaults.plugins.tooltip.bodyColor = '#8890b0';
  Chart.defaults.plugins.tooltip.padding = 10;
}

// ── Formatters ────────────────────────────────────────────────────────────────

/** Formatteer seconden naar "u:mm" */
export function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}u ${m}m` : `${m} min`;
}

/** Formatteer meters naar "X.X km" */
export function formatKm(meters) {
  if (!meters) return '—';
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Formatteer pace (min/km) naar "m:ss /km" */
export function formatPace(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return '—';
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')} /km`;
}

/** Formatteer datum naar "dd MMM" (nl) */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/** Formatteer datum naar naam van de maand (nl) */
export function formatMonth(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
}

// ── Rolling average ───────────────────────────────────────────────────────────

/**
 * Berekent een rolling average over een array met getallen.
 * @param {number[]} values
 * @param {number} window  Venstergrootte (bijv. 5)
 * @returns {(number|null)[]}
 */
export function rollingAverage(values, window = 5) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1).filter((v) => v !== null && !isNaN(v));
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ── Gedeelde chart-opties ─────────────────────────────────────────────────────

export function baseLineOptions(yLabel = '', invertY = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
    },
    scales: {
      x: {
        grid: { color: COLORS.grid },
        ticks: { maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        grid: { color: COLORS.grid },
        reverse: invertY,
        title: yLabel ? { display: true, text: yLabel } : undefined,
      },
    },
  };
}

export function baseBarOptions(yLabel = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
    },
    scales: {
      x: { grid: { display: false }, stacked: false },
      y: {
        grid: { color: COLORS.grid },
        title: yLabel ? { display: true, text: yLabel } : undefined,
      },
    },
  };
}

export function scatterOptions(xLabel = '', yLabel = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw.label ?? ''}: ${xLabel} ${ctx.raw.x?.toFixed(1)}, ${yLabel} ${ctx.raw.y?.toFixed(0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: COLORS.grid },
        title: { display: true, text: xLabel },
      },
      y: {
        grid: { color: COLORS.grid },
        title: { display: true, text: yLabel },
      },
    },
  };
}

// ── Genormaliseerde efficiëntiescore (0–100 schaal) ───────────────────────────
/**
 * Normaliseert een reeks efficiëntie-scores naar een 0–100 schaal
 * zodat run en ride scores naast elkaar vergelijkbaar zijn in de overzichtsgrafiek.
 */
export function normalizeScores(values) {
  const valid = values.filter((v) => v !== null && !isNaN(v));
  if (!valid.length) return values;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  return values.map((v) => (v === null ? null : ((v - min) / range) * 100));
}

// ── Helper: groepeer activiteiten per week ────────────────────────────────────
/**
 * @param {object[]} activities  Gesorteerd op datum (oud → nieuw)
 * @returns {{ week: string, km: number }[]}
 */
export function groupByWeek(activities) {
  const map = new Map();
  for (const act of activities) {
    const d = new Date(act.activity_date);
    // ISO-weeknummer + jaar als sleutel
    const week = getISOWeekKey(d);
    const km = (act.distance_m ?? 0) / 1000;
    map.set(week, (map.get(week) ?? 0) + km);
  }
  return Array.from(map.entries()).map(([week, km]) => ({ week, km }));
}

function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── Helper: groepeer per maand ────────────────────────────────────────────────
export function groupByMonth(activities, valueKey) {
  const map = new Map();
  for (const act of activities) {
    const month = act.activity_date?.slice(0, 7); // "YYYY-MM"
    if (!month) continue;
    if (!map.has(month)) map.set(month, []);
    if (act[valueKey] !== null && act[valueKey] !== undefined) {
      map.get(month).push(act[valueKey]);
    }
  }
  return Array.from(map.entries()).map(([month, values]) => ({
    month,
    avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    values,
  }));
}

// ── Lege grafiek placeholder ──────────────────────────────────────────────────
export function renderEmptyChart(container, message = 'Geen data beschikbaar') {
  container.innerHTML = `<div class="empty-state">📊<p>${message}</p></div>`;
}
