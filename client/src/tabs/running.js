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

  const sorted = [...runs].sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  panel.innerHTML = `
    <div class="kpi-row" id="run-kpis"></div>

    <div class="section-label">INTERPRETATIE &amp; AANBEVELINGEN</div>
    <div class="insights-grid" id="run-insights"></div>

    <div class="section-label">KERNMETRIC: AEROBE EFFICIËNTIE</div>
    <div class="card">
      <div class="card-title">📈 Efficiëntiescore over tijd</div>
      <div class="card-sub">
        <span class="formula">efficiëntie = snelheid (m/s) ÷ hartslag × 1000</span>
        <strong>Hogere score = je loopt sneller met minder hartslagen.</strong> Stippellijn = 5-runs voortschrijdend gemiddelde.
      </div>
      <div class="chart-wrap" id="run-c1"></div>
    </div>

    <div class="section-label">TREND: TEMPO &amp; HARTSLAG</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">🟠 Tempoontwikkeling over tijd</div>
        <div class="card-sub">min/km per run. <strong>Omgekeerde as: omhoog = sneller.</strong></div>
        <div class="chart-wrap" id="run-c2"></div>
      </div>
      <div class="card">
        <div class="card-title">❤️ Hartslagontwikkeling over tijd</div>
        <div class="card-sub">Gemiddelde hartslag per run. <strong>Omlaag = efficiënter hart.</strong></div>
        <div class="chart-wrap" id="run-c3"></div>
      </div>
    </div>

    <div class="section-label">ZONE-ANALYSE: VERGELIJKBARE RUNS</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">📉 Tempo bij vaste hartslag (145–155 bpm)</div>
        <div class="card-sub">Alleen runs met gem. hartslag 145–155 bpm. Dalende lijn = <strong>sneller bij dezelfde inspanning.</strong></div>
        <div class="chart-wrap" id="run-c4"></div>
      </div>
      <div class="card">
        <div class="card-title">📉 Hartslag bij vast tempo (6:20–7:00 min/km)</div>
        <div class="card-sub">Alleen runs met vergelijkbaar tempo. Dalende lijn = <strong>rustiger hart bij dezelfde snelheid.</strong></div>
        <div class="chart-wrap" id="run-c5"></div>
      </div>
    </div>

    <div class="section-label">SCATTERPLOT: TEMPO VS HARTSLAG</div>
    <div class="card">
      <div class="card-title">🔵 Alle runs: tempo vs hartslag — per maand</div>
      <div class="card-sub">Elk punt = één run. <strong>Rechtsonder = sneller én rustiger hart = beter.</strong> De wolk verschuift bij conditieverbetering.</div>
      <div class="chart-wrap" id="run-c6"></div>
    </div>

    <div class="section-label">VOLUME &amp; LOOPVORM</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">📅 Wekelijks loopvolume (km)</div>
        <div class="card-sub">Totale loopkilometers per week. Let op piekweken gevolgd door rustdip.</div>
        <div class="chart-wrap" id="run-c7"></div>
      </div>
      <div class="card">
        <div class="card-title">👟 Cadans over tijd (stappen/min)</div>
        <div class="card-sub">Streef naar <strong>164–170 spm.</strong> Hogere cadans = efficiënter, minder blessurerisico.</div>
        <div class="chart-wrap" id="run-c8"></div>
      </div>
    </div>

    <div class="section-label">VERDIEPING: MAANDELIJKSE PROGRESSIE</div>
    <div class="card">
      <div class="card-title">📊 Maandvergelijking — vier kernmetrics</div>
      <div class="card-sub">Maandgemiddelden van alle hardlooptrainingen. <strong>Efficiëntie en snelheid stijgen, hartslag daalt.</strong></div>
      <div class="chart-wrap" id="run-c9"></div>
    </div>
  `;

  renderKPIs(panel.querySelector('#run-kpis'), sorted);
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

  let effChange = null;
  if (first.efficiency_score && last.efficiency_score) {
    effChange = ((last.efficiency_score - first.efficiency_score) / first.efficiency_score) * 100;
  }

  let paceChange = null;
  if (first.pace_min_km && last.pace_min_km) {
    paceChange = first.pace_min_km - last.pace_min_km;
  }

  let hrDelta = null;
  const sameTempoRuns = runs.filter((r) => r.pace_min_km >= 6.33 && r.pace_min_km <= 7.0 && r.avg_heartrate);
  if (sameTempoRuns.length >= 2) {
    hrDelta = sameTempoRuns[0].avg_heartrate - sameTempoRuns[sameTempoRuns.length - 1].avg_heartrate;
  }

  const withCad = runs.filter((r) => r.avg_cadence);
  let cadChange = null;
  if (withCad.length >= 2) {
    cadChange = (withCad[withCad.length - 1].avg_cadence - withCad[0].avg_cadence) * 2;
  }

  const kpis = [
    {
      icon: '⚡',
      value: effChange !== null ? (effChange > 0 ? '+' : '') + effChange.toFixed(1) + '%' : '—',
      label: 'Efficiëntieverbetering',
      delta: first.efficiency_score && last.efficiency_score
        ? `${first.efficiency_score.toFixed(1)} → ${last.efficiency_score.toFixed(1)} (score)`
        : null,
      color: effChange > 0 ? 'orange' : effChange < 0 ? 'red' : '',
    },
    {
      icon: '🚀',
      value: paceChange !== null ? (paceChange > 0 ? '–' : '+') + Math.abs(paceChange).toFixed(2) + ' min/km' : '—',
      label: 'Tempoverbetering',
      delta: first.pace_min_km && last.pace_min_km
        ? `${formatPace(first.pace_min_km)} → ${formatPace(last.pace_min_km)} min/km`
        : null,
      color: paceChange > 0 ? 'green' : paceChange < 0 ? 'red' : '',
    },
    {
      icon: '❤️',
      value: hrDelta !== null ? (hrDelta > 0 ? '–' : '+') + Math.abs(hrDelta).toFixed(0) + ' bpm' : '—',
      label: 'HR bij gelijk tempo',
      delta: sameTempoRuns.length >= 2
        ? `${sameTempoRuns[0].avg_heartrate.toFixed(0)} → ${sameTempoRuns[sameTempoRuns.length - 1].avg_heartrate.toFixed(0)} bpm`
        : null,
      color: hrDelta > 0 ? 'blue' : hrDelta < 0 ? 'red' : '',
    },
    {
      icon: '👟',
      value: cadChange !== null ? (cadChange > 0 ? '+' : '') + cadChange.toFixed(0) + ' spm' : '—',
      label: 'Cadensverbetering',
      delta: withCad.length >= 2
        ? `${(withCad[0].avg_cadence * 2).toFixed(0)} → ${(withCad[withCad.length - 1].avg_cadence * 2).toFixed(0)} spm`
        : null,
      color: cadChange > 0 ? 'purple' : '',
    },
  ];

  container.innerHTML = kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-text">
        <div class="kpi-value ${k.color}">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
        ${k.delta ? `<div class="kpi-delta green">${k.delta}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Interpretatie-sectie ──────────────────────────────────────────────────────
function renderInsights(container, runs) {
  const insights = [];

  if (runs.length < 3) {
    container.innerHTML = `<div class="insight info"><div class="insight-title">ℹ️ Onvoldoende data</div><div class="insight-body">Sync meer activiteiten voor automatische inzichten.</div></div>`;
    return;
  }

  const effScores = runs.filter((r) => r.efficiency_score).map((r) => r.efficiency_score);
  if (effScores.length >= 2) {
    const improvement = ((effScores[effScores.length - 1] - effScores[0]) / effScores[0]) * 100;
    if (improvement > 5) {
      insights.push({ cls: 'good', title: '✅ Aerobe basis verbeterd', body: `Je efficiëntiescore steeg van <strong>${effScores[0].toFixed(1)} naar ${effScores[effScores.length - 1].toFixed(1)}</strong> — een verbetering van <strong>+${improvement.toFixed(0)}%</strong>.` });
    } else if (improvement < -5) {
      insights.push({ cls: 'warn', title: '⚠️ Efficiëntiedaling', body: `Je efficiëntie daalde met <strong>${Math.abs(improvement).toFixed(0)}%</strong>. Let op overtraining of blessures.` });
    }
  }

  const lastCad = runs.filter((r) => r.avg_cadence).slice(-5);
  if (lastCad.length) {
    const avgCad = avg(lastCad.map((r) => r.avg_cadence * 2));
    if (avgCad >= 165) {
      insights.push({ cls: 'good', title: '✅ Cadans in ideale zone', body: `Je loopt consistent op <strong>${avgCad.toFixed(0)} spm</strong> — in het ideale bereik van 164–170 spm.` });
    } else if (avgCad < 160) {
      insights.push({ cls: 'warn', title: '⚠️ Cadans onder doel', body: `Je cadans (gem. <strong>${avgCad.toFixed(0)} spm</strong>) ligt onder het doel van 164 spm. Probeer kortere, snellere stappen.` });
    } else {
      insights.push({ cls: 'info', title: '💡 Cadans bijna op doel', body: `Je loopt op <strong>${avgCad.toFixed(0)} spm</strong>. Het streefbereik is 164–170 spm.` });
    }
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recentRuns = runs.filter((r) => r.activity_date >= oneWeekAgo);
  const olderRuns  = runs.filter((r) => r.activity_date < oneWeekAgo);
  if (recentRuns.length > 0 && olderRuns.length >= 3) {
    const recentEff = avg(recentRuns.map((r) => r.efficiency_score).filter(Boolean));
    const olderEff  = avg(olderRuns.slice(-10).map((r) => r.efficiency_score).filter(Boolean));
    if (recentEff && olderEff) {
      const diff = ((recentEff - olderEff) / olderEff) * 100;
      if (diff < -15) {
        insights.push({ cls: 'warn', title: '⚠️ Prestatieterugval afgelopen week', body: `Afgelopen week <strong>${Math.abs(diff).toFixed(0)}%</strong> lager dan je recente gemiddelde. Zorg voor voldoende herstel.` });
      }
    }
  }

  if (!insights.length) {
    insights.push({ cls: 'good', title: '✅ Alles ziet er goed uit', body: 'Blijf consistent trainen!' });
  }

  container.innerHTML = insights.map((i) => `
    <div class="insight ${i.cls}">
      <div class="insight-title">${i.title}</div>
      <div class="insight-body">${i.body}</div>
    </div>
  `).join('');
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
