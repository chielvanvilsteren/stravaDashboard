/**
 * tabs/cycling.js — 🚴 Wielrennen tab
 *
 * Alle 9 fietsgrafieken + KPI badges + interpretatie-sectie + power-check.
 */

import { fetchActivities } from '../api.js';
import { formatKm, formatDuration } from '../charts/shared.js';
import {
  renderEfficiency, renderSpeed, renderHeartrate,
  renderSpeedAtHR, renderHRAtSpeed, renderScatter,
  renderWeeklyVolume, renderElevation, renderMonthComparison,
} from '../charts/cycling/index.js';

export async function renderCycling(panel) {
  const { activities: rides = [] } = await fetchActivities({ type: 'Ride', limit: 100 });

  if (!rides.length) {
    panel.innerHTML = `
      <div class="empty-state">🚴
        <p>Nog geen fietsactiviteiten gevonden.<br>Sync je Strava-account om te beginnen.</p>
      </div>`;
    return;
  }

  // Sorteer oud → nieuw voor trends
  const sorted = [...rides].sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  // Check of vermogensdata beschikbaar is
  const hasPower = sorted.some((r) => r.avg_watts != null);

  panel.innerHTML = `
    <!-- KPI badges -->
    <div class="kpi-grid" id="ride-kpis"></div>

    <!-- Interpretatie-sectie -->
    <div class="card">
      <div class="card-title">Inzichten</div>
      <div class="insights" id="ride-insights"></div>
    </div>

    ${hasPower ? `
    <!-- Vermogenskaart (alleen als powermeter aanwezig) -->
    <div class="card">
      <div class="card-title">⚡ Vermogen</div>
      <div class="kpi-grid" id="ride-power"></div>
    </div>` : `
    <!-- Geen powermeter -->
    <div class="card">
      <div class="card-title">⚡ Vermogen</div>
      <div class="empty-state">
        <p>Koppel een powermeter voor vermogensanalyse.</p>
      </div>
    </div>`}

    <!-- Grafieken -->
    <div class="card"><div class="card-title">1. Efficiëntiescore</div><div class="chart-wrap" id="ride-c1"></div></div>
    <div class="card"><div class="card-title">2. Snelheidsontwikkeling</div><div class="chart-wrap" id="ride-c2"></div></div>
    <div class="card"><div class="card-title">3. Hartslagontwikkeling</div><div class="chart-wrap" id="ride-c3"></div></div>
    <div class="card"><div class="card-title">4. Snelheid bij vaste HR (145–155 bpm)</div><div class="chart-wrap" id="ride-c4"></div></div>
    <div class="card"><div class="card-title">5. HR bij vaste snelheid (28–30 km/u)</div><div class="chart-wrap" id="ride-c5"></div></div>
    <div class="card"><div class="card-title">6. Scatterplot snelheid vs HR</div><div class="chart-wrap" id="ride-c6"></div></div>
    <div class="card"><div class="card-title">7. Wekelijks fietsvolume</div><div class="chart-wrap" id="ride-c7"></div></div>
    <div class="card"><div class="card-title">8. Stijgingsmeters per rit</div><div class="chart-wrap" id="ride-c8"></div></div>
    <div class="card"><div class="card-title">9. Maandvergelijking</div><div class="chart-wrap" id="ride-c9"></div></div>
  `;

  // KPIs
  renderKPIs(panel.querySelector('#ride-kpis'), sorted);

  // Inzichten
  renderInsights(panel.querySelector('#ride-insights'), sorted);

  // Vermogen KPIs (alleen als data beschikbaar)
  if (hasPower) {
    renderPowerKPIs(panel.querySelector('#ride-power'), sorted);
  }

  // Grafieken (parallel renderen)
  await Promise.all([
    renderEfficiency(     panel.querySelector('#ride-c1'), sorted),
    renderSpeed(          panel.querySelector('#ride-c2'), sorted),
    renderHeartrate(      panel.querySelector('#ride-c3'), sorted),
    renderSpeedAtHR(      panel.querySelector('#ride-c4'), sorted),
    renderHRAtSpeed(      panel.querySelector('#ride-c5'), sorted),
    renderScatter(        panel.querySelector('#ride-c6'), sorted),
    renderWeeklyVolume(   panel.querySelector('#ride-c7'), sorted),
    renderElevation(      panel.querySelector('#ride-c8'), sorted),
    renderMonthComparison(panel.querySelector('#ride-c9'), sorted),
  ]);
}

// ── KPI badges ────────────────────────────────────────────────────────────────
function renderKPIs(container, rides) {
  const totalDist = rides.reduce((s, r) => s + (r.distance_m ?? 0), 0);
  const longest   = Math.max(...rides.map((r) => r.distance_m ?? 0));
  const avgSpeed  = avg(rides.map((r) => r.speed_kmh).filter(Boolean));
  const totalElev = rides.reduce((s, r) => s + (r.elevation_gain ?? 0), 0);

  container.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Totaal gefietst</div>
      <div class="kpi-value" style="color:var(--color-ride)">${formatKm(totalDist)}</div>
      <div class="kpi-sub">${rides.length} ritten in 2026</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Langste rit</div>
      <div class="kpi-value">${formatKm(longest)}</div>
      <div class="kpi-sub">persoonlijk record</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gem. snelheid</div>
      <div class="kpi-value">${avgSpeed ? avgSpeed.toFixed(1) : '—'} <small>km/u</small></div>
      <div class="kpi-sub">alle ritten</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Totale stijging</div>
      <div class="kpi-value">${Math.round(totalElev).toLocaleString('nl-NL')} <small>m</small></div>
      <div class="kpi-sub">dit jaar</div>
    </div>
  `;
}

// ── Vermogen KPIs ─────────────────────────────────────────────────────────────
function renderPowerKPIs(container, rides) {
  const withPower = rides.filter((r) => r.avg_watts);
  const avgW      = avg(withPower.map((r) => r.avg_watts));
  const maxW      = Math.max(...withPower.map((r) => r.max_watts ?? 0));
  const avgNP     = avg(withPower.filter((r) => r.weighted_avg_watts).map((r) => r.weighted_avg_watts));
  const totalKJ   = withPower.reduce((s, r) => s + (r.kilojoules ?? 0), 0);

  container.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Gem. vermogen</div>
      <div class="kpi-value">${avgW ? Math.round(avgW) : '—'} <small>W</small></div>
      <div class="kpi-sub">alle ritten met powermeter</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Max. vermogen</div>
      <div class="kpi-value">${maxW ? Math.round(maxW) : '—'} <small>W</small></div>
      <div class="kpi-sub">piekwaarde</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Norm. vermogen</div>
      <div class="kpi-value">${avgNP ? Math.round(avgNP) : '—'} <small>W</small></div>
      <div class="kpi-sub">weighted avg power</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Totale arbeid</div>
      <div class="kpi-value">${Math.round(totalKJ).toLocaleString('nl-NL')} <small>kJ</small></div>
      <div class="kpi-sub">dit jaar</div>
    </div>
  `;
}

// ── Interpretatie-sectie ──────────────────────────────────────────────────────
function renderInsights(container, rides) {
  const insights = [];

  if (rides.length < 3) {
    container.innerHTML = '<div class="insight-item"><span class="insight-icon">ℹ️</span><span>Sync meer ritten voor automatische inzichten.</span></div>';
    return;
  }

  const effScores = rides.filter((r) => r.efficiency_score).map((r) => r.efficiency_score);
  if (effScores.length >= 2) {
    const improvement = ((effScores[effScores.length - 1] - effScores[0]) / effScores[0]) * 100;
    if (improvement > 5) {
      insights.push({ icon: '📈', text: `Je fietsefficiëntie is ${improvement.toFixed(0)}% verbeterd t.o.v. je eerste rit.`, cls: 'insight-positive' });
    } else if (improvement < -5) {
      insights.push({ icon: '📉', text: `Je fietsefficiëntie is ${Math.abs(improvement).toFixed(0)}% gedaald. Overweeg een rustweek.`, cls: 'insight-warning' });
    }
  }

  // Terugval afgelopen week
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recentRides = rides.filter((r) => r.activity_date >= oneWeekAgo);
  const olderRides  = rides.filter((r) => r.activity_date < oneWeekAgo);
  if (recentRides.length > 0 && olderRides.length >= 3) {
    const recentEff = avg(recentRides.map((r) => r.efficiency_score).filter(Boolean));
    const olderEff  = avg(olderRides.slice(-10).map((r) => r.efficiency_score).filter(Boolean));
    if (recentEff && olderEff) {
      const diff = ((recentEff - olderEff) / olderEff) * 100;
      if (diff < -15) {
        insights.push({ icon: '⚠️', text: `Afgelopen week ${Math.abs(diff).toFixed(0)}% lager dan je recente fietsgemiddelde.`, cls: 'insight-warning' });
      }
    }
  }

  // Snelheidsverbetering
  const withSpeed = rides.filter((r) => r.speed_kmh);
  if (withSpeed.length >= 5) {
    const first5 = avg(withSpeed.slice(0, 5).map((r) => r.speed_kmh));
    const last5  = avg(withSpeed.slice(-5).map((r) => r.speed_kmh));
    if (last5 > first5 + 0.5) {
      insights.push({ icon: '⚡', text: `Je gemiddelde snelheid is ${(last5 - first5).toFixed(1)} km/u gestegen.`, cls: 'insight-positive' });
    }
  }

  if (!insights.length) {
    insights.push({ icon: '✅', text: 'Consistent op de fiets. Blijf het vol houden!', cls: 'insight-positive' });
  }

  container.innerHTML = insights
    .map((i) => `<div class="insight-item ${i.cls}"><span class="insight-icon">${i.icon}</span><span>${i.text}</span></div>`)
    .join('');
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
