/**
 * tabs/running.js — 🏃 Hardlopen tab
 *
 * Alle 9 hardloopgrafieken + KPI badges + interpretatie-sectie.
 */

import { fetchActivities } from '../api.js';
import { formatKm, formatPace, formatDuration } from '../charts/shared.js';
import {
  renderEfficiency, renderPace, renderHeartrate,
  renderPaceAtHR, renderHRAtPace, renderScatter,
  renderWeeklyVolume, renderCadence, renderMonthComparison,
} from '../charts/running/index.js';

export async function renderRunning(panel) {
  const { activities: runs = [] } = await fetchActivities({ type: 'Run', limit: 100 });

  if (!runs.length) {
    panel.innerHTML = `
      <div class="empty-state">🏃
        <p>Nog geen hardloopactiviteiten gevonden.<br>Sync je Strava-account om te beginnen.</p>
      </div>`;
    return;
  }

  // Sorteer oud → nieuw voor trends
  const sorted = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  panel.innerHTML = `
    <!-- KPI badges -->
    <div class="kpi-grid" id="run-kpis"></div>

    <!-- Interpretatie-sectie -->
    <div class="card">
      <div class="card-title">Inzichten</div>
      <div class="insights" id="run-insights"></div>
    </div>

    <!-- Grafieken -->
    <div class="card"><div class="card-title">1. Efficiëntiescore</div><div class="chart-wrap" id="run-c1"></div></div>
    <div class="card"><div class="card-title">2. Tempoontwikkeling</div><div class="chart-wrap" id="run-c2"></div></div>
    <div class="card"><div class="card-title">3. Hartslagontwikkeling</div><div class="chart-wrap" id="run-c3"></div></div>
    <div class="card"><div class="card-title">4. Tempo bij vaste HR (145–155 bpm)</div><div class="chart-wrap" id="run-c4"></div></div>
    <div class="card"><div class="card-title">5. HR bij vast tempo (6:20–7:00 /km)</div><div class="chart-wrap" id="run-c5"></div></div>
    <div class="card"><div class="card-title">6. Scatterplot tempo vs HR</div><div class="chart-wrap" id="run-c6"></div></div>
    <div class="card"><div class="card-title">7. Wekelijks loopvolume</div><div class="chart-wrap" id="run-c7"></div></div>
    <div class="card"><div class="card-title">8. Cadans over tijd</div><div class="chart-wrap" id="run-c8"></div></div>
    <div class="card"><div class="card-title">9. Maandvergelijking</div><div class="chart-wrap" id="run-c9"></div></div>
  `;

  // KPIs
  renderKPIs(panel.querySelector('#run-kpis'), sorted);

  // Inzichten
  renderInsights(panel.querySelector('#run-insights'), sorted);

  // Grafieken (parallel renderen)
  await Promise.all([
    renderEfficiency(    panel.querySelector('#run-c1'), sorted),
    renderPace(          panel.querySelector('#run-c2'), sorted),
    renderHeartrate(     panel.querySelector('#run-c3'), sorted),
    renderPaceAtHR(      panel.querySelector('#run-c4'), sorted),
    renderHRAtPace(      panel.querySelector('#run-c5'), sorted),
    renderScatter(       panel.querySelector('#run-c6'), sorted),
    renderWeeklyVolume(  panel.querySelector('#run-c7'), sorted),
    renderCadence(       panel.querySelector('#run-c8'), sorted),
    renderMonthComparison(panel.querySelector('#run-c9'), sorted),
  ]);
}

// ── KPI badges ────────────────────────────────────────────────────────────────
function renderKPIs(container, runs) {
  if (runs.length < 2) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Onvoldoende data voor KPIs</div>';
    return;
  }

  const first = runs[0];
  const last  = runs[runs.length - 1];

  // Efficiëntie %
  let effChange = null;
  if (first.efficiency_score && last.efficiency_score) {
    effChange = ((last.efficiency_score - first.efficiency_score) / first.efficiency_score) * 100;
  }

  // Tempo delta
  let paceChange = null;
  if (first.pace_min_km && last.pace_min_km) {
    paceChange = first.pace_min_km - last.pace_min_km; // positief = sneller
  }

  // HR delta
  let hrDelta = null;
  const sameTempoRuns = runs.filter((r) => r.pace_min_km >= 6.33 && r.pace_min_km <= 7.0 && r.avg_heartrate);
  if (sameTempoRuns.length >= 2) {
    hrDelta = sameTempoRuns[0].avg_heartrate - sameTempoRuns[sameTempoRuns.length - 1].avg_heartrate;
  }

  // Cadans delta
  const withCad = runs.filter((r) => r.avg_cadence);
  let cadChange = null;
  if (withCad.length >= 2) {
    cadChange = (withCad[withCad.length - 1].avg_cadence - withCad[0].avg_cadence) * 2;
  }

  container.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Efficiëntie</div>
      <div class="kpi-value ${effChange > 0 ? 'kpi-up' : effChange < 0 ? 'kpi-down' : ''}">
        ${effChange !== null ? (effChange > 0 ? '+' : '') + effChange.toFixed(1) + '%' : '—'}
      </div>
      <div class="kpi-sub">vs. eerste run</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Tempoverbetering</div>
      <div class="kpi-value ${paceChange > 0 ? 'kpi-up' : paceChange < 0 ? 'kpi-down' : ''}">
        ${paceChange !== null ? (paceChange > 0 ? '+' : '') + paceChange.toFixed(2) + ' min/km' : '—'}
      </div>
      <div class="kpi-sub">eerste vs. laatste run</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">HR-daling</div>
      <div class="kpi-value ${hrDelta > 0 ? 'kpi-up' : hrDelta < 0 ? 'kpi-down' : ''}">
        ${hrDelta !== null ? (hrDelta > 0 ? '-' : '+') + Math.abs(hrDelta).toFixed(0) + ' bpm' : '—'}
      </div>
      <div class="kpi-sub">bij gelijk tempo</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cadensverbetering</div>
      <div class="kpi-value ${cadChange > 0 ? 'kpi-up' : cadChange < 0 ? 'kpi-down' : ''}">
        ${cadChange !== null ? (cadChange > 0 ? '+' : '') + cadChange.toFixed(0) + ' spm' : '—'}
      </div>
      <div class="kpi-sub">vs. eerste run</div>
    </div>
  `;
}

// ── Interpretatie-sectie ──────────────────────────────────────────────────────
function renderInsights(container, runs) {
  const insights = [];

  if (runs.length < 3) {
    container.innerHTML = '<div class="insight-item"><span class="insight-icon">ℹ️</span><span>Sync meer activiteiten voor automatische inzichten.</span></div>';
    return;
  }

  // Efficiëntietrend
  const effScores = runs.filter((r) => r.efficiency_score).map((r) => r.efficiency_score);
  if (effScores.length >= 2) {
    const improvement = ((effScores[effScores.length - 1] - effScores[0]) / effScores[0]) * 100;
    if (improvement > 5) {
      insights.push({ icon: '📈', text: `Je bent ${improvement.toFixed(0)}% efficiënter geworden t.o.v. je eerste run.`, cls: 'insight-positive' });
    } else if (improvement < -5) {
      insights.push({ icon: '📉', text: `Je efficiëntie is ${Math.abs(improvement).toFixed(0)}% gedaald. Let op overtraining of blessures.`, cls: 'insight-warning' });
    }
  }

  // Terugval afgelopen week
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recentRuns = runs.filter((r) => r.activity_date >= oneWeekAgo);
  const olderRuns  = runs.filter((r) => r.activity_date < oneWeekAgo);
  if (recentRuns.length > 0 && olderRuns.length >= 3) {
    const recentEff = avg(recentRuns.map((r) => r.efficiency_score).filter(Boolean));
    const olderEff  = avg(olderRuns.slice(-10).map((r) => r.efficiency_score).filter(Boolean));
    if (recentEff && olderEff) {
      const diff = ((recentEff - olderEff) / olderEff) * 100;
      if (diff < -15) {
        insights.push({ icon: '⚠️', text: `Afgelopen week ${Math.abs(diff).toFixed(0)}% lager dan je recente gemiddelde. Rust voldoende uit.`, cls: 'insight-warning' });
      }
    }
  }

  // Cadans richting doel (166 spm)
  const lastCadence = runs.filter((r) => r.avg_cadence).slice(-5);
  if (lastCadence.length) {
    const avgCad = avg(lastCadence.map((r) => r.avg_cadence * 2));
    if (avgCad < 160) {
      insights.push({ icon: '👣', text: `Je cadans (gem. ${avgCad.toFixed(0)} spm) is lager dan het doel van 166 spm. Probeer kortere, snellere stappen.`, cls: 'insight-warning' });
    } else if (avgCad >= 165) {
      insights.push({ icon: '✅', text: `Geweldige cadans! Je zit op ${avgCad.toFixed(0)} spm — boven het doel van 166 spm.`, cls: 'insight-positive' });
    }
  }

  if (!insights.length) {
    insights.push({ icon: '✅', text: 'Alles ziet er goed uit. Blijf consistent trainen!', cls: 'insight-positive' });
  }

  container.innerHTML = insights
    .map((i) => `<div class="insight-item ${i.cls}"><span class="insight-icon">${i.icon}</span><span>${i.text}</span></div>`)
    .join('');
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
