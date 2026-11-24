// Custom Playwright reporter: creates a single-page HTML "Test Execution Summary"
// (cards, donut, settings, pass-rate trend of last 20 runs, failures by spec file, failed test details).
// Output: reports/API_Test_Execution_Summary.html  (overwritten each run)
// Trend data is kept in reports/run-history.json

const fs = require('fs');
const path = require('path');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const pct = (n, t) => (t ? (n / t) * 100 : 0);
const f1 = (n) => n.toFixed(1);
const tcIdOf = (title) => (title.match(/^(API_[A-Z]+_\d+)/) || [])[1] || '-';

function fmtDur(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const t = Math.round(s);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function trendSvg(points) {
  const L = 38, R = 602, top = 20, bottom = 209;
  const n = points.length;
  const xs = points.map((_, i) => (n === 1 ? (L + R) / 2 : L + ((R - L) * i) / (n - 1)));
  const ys = points.map((p) => bottom - ((bottom - top) * p.rate) / 100);
  const coords = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`);
  const area = `M ${xs[0].toFixed(1)} ${bottom} L ` + coords.map((c) => c.replace(',', ' ')).join(' ') + ` L ${xs[n - 1].toFixed(1)} ${bottom} Z`;
  const grid = [[100, top], [50, (top + bottom) / 2], [0, bottom]]
    .map(([lbl, y]) => `<line class="trend-grid-line" x1="38" x2="602" y1="${y}" y2="${y}" /><text class="trend-axis-label" x="0" y="${y + 4}">${lbl}%</text>`).join('');
  const dots = xs.map((x, i) => `<circle class="trend-point" cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4"><title>${esc(points[i].label)}: ${f1(points[i].rate)}%</title></circle>`).join('');
  const idx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
  const labels = idx.map((i) => `<text class="trend-axis-label" text-anchor="middle" x="${xs[i].toFixed(1)}" y="237">${esc(points[i].label)}</text>`).join('');
  return `<svg class="trend-chart" viewBox="0 0 620 245" role="img" aria-label="Pass rate across recent test runs">${grid}<path class="trend-area" d="${area}" /><polyline class="trend-line" points="${coords.join(' ')}" />${dots}${labels}</svg>`;
}

class HtmlSummaryReporter {
  constructor(options = {}) {
    this.options = options;
    this.tests = new Map();
  }

  onBegin(config) {
    this.config = config;
    this.startedAt = new Date();
  }

  onTestEnd(test, result) {
    const prev = this.tests.get(test.id);
    this.tests.set(test.id, { test, result, duration: (prev ? prev.duration : 0) + result.duration });
  }

  async onEnd(fullResult) {
    if (this.tests.size === 0) return;
    const o = this.options;
    const outFile = path.resolve(o.outputFile || 'reports/API_Test_Execution_Summary.html');
    const outDir = path.dirname(outFile);
    const historyFile = path.join(outDir, 'run-history.json');
    fs.mkdirSync(outDir, { recursive: true });

    // ---- collect numbers
    const counts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };
    const modules = new Map();
    const failures = [];
    for (const { test, result, duration } of this.tests.values()) {
      const outcome = test.outcome(); // expected | unexpected | flaky | skipped
      const key = outcome === 'expected' ? 'passed' : outcome === 'unexpected' ? 'failed' : outcome === 'flaky' ? 'flaky' : 'skipped';
      counts[key]++;
      const spec = path.basename(test.location.file).replace(/\.spec\.[jt]s$/, '');
      const modName = o.sprint ? `${o.sprint} / ${spec}` : spec;
      if (!modules.has(modName)) modules.set(modName, { name: modName, total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, duration: 0 });
      const m = modules.get(modName);
      m.total++; m[key]++; m.duration += duration;
      if (key === 'failed') {
        const raw = stripAnsi(result.error?.message || 'Unknown error');
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);
        failures.push({ id: tcIdOf(test.title), title: test.title, duration, reason: lines.join('\n'), module: modName });
      }
    }
    const total = this.tests.size;
    const passRate = pct(counts.passed + counts.flaky, total);
    const runPassed = counts.failed === 0;

    // ---- history for trend (last 20 runs)
    let history = [];
    try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (_) {}
    history.push({ date: this.startedAt.toISOString(), rate: passRate, total, failed: counts.failed });
    history = history.slice(-50);
    try { fs.writeFileSync(historyFile, JSON.stringify(history, null, 2)); } catch (_) {}
    const trendPts = history.slice(-20).map((h) => ({ label: dayLabel(h.date), rate: h.rate }));

    // ---- settings
    const cfg = this.config;
    const proj = cfg.projects?.[0] || {};
    const yn = (b) => (b ? 'TRUE' : 'FALSE');
    const settings = [
      ['Test type', 'API testing (Playwright request)'],
      ['Base URL', proj.use?.baseURL || 'Not set'],
      ['Env', o.environment || 'DEMO'],
      ['Stop test after fail', yn(cfg.maxFailures > 0)],
      ['Rerun fail test', yn((proj.retries || 0) > 0)],
      ['Run Tests in Parallel', yn(cfg.workers > 1)],
      ['Workers', String(cfg.workers)],
      ...(o.extraSettings || []),
    ];

    // ---- donut gradient
    let acc = 0;
    const seg = (n, color) => { const s = acc; acc += pct(n, total); return n ? `${color} ${s.toFixed(2)}% ${acc.toFixed(2)}%` : null; };
    const gradient = [seg(counts.passed, '#0f9f6e'), seg(counts.flaky, '#e28b16'), seg(counts.failed, '#e5484d'), seg(counts.skipped, '#8b95a7')].filter(Boolean).join(', ') || '#e5e9f0 0% 100%';

    // ---- module lists
    const mods = [...modules.values()];
    const maxDur = Math.max(...mods.map((m) => m.duration), 1);
    const failList = mods.filter((m) => m.failed > 0).sort((a, b) => pct(b.failed, b.total) - pct(a.failed, a.total));

    const failurePanel = failList.length
      ? `<div class="failure-list">${failList.map((m) => `
    <div class="failure-row">
      <h3>${esc(m.name)}</h3>
      <span>${f1(pct(m.failed, m.total))}% (${m.failed}/${m.total})</span>
      <div class="failure-track"><i style="width:${pct(m.failed, m.total).toFixed(2)}%"></i></div>
    </div>`).join('')}</div>`
      : `<p class="no-failures">No failed tests in this run.</p>`;

    const moduleCards = mods.map((m) => `
        <article class="module-card">
          <div class="module-heading"><h3>${esc(m.name)}</h3><span>${m.total} tests</span></div>
          <div class="status-bar" aria-label="Test status distribution">${[['passed', '#0f9f6e'], ['flaky', '#e28b16'], ['failed', '#e5484d'], ['skipped', '#8b95a7']]
            .filter(([k]) => m[k]).map(([k, c]) => `<span class="status-segment" style="width:${pct(m[k], m.total).toFixed(2)}%;background:${c}"></span>`).join('')}</div>
          <div class="module-metrics">
            <span class="passed">${m.passed} passed</span><span class="failed">${m.failed} failed</span><span class="skipped">${m.skipped} skipped</span>${m.flaky ? `<span class="flaky">${m.flaky} flaky</span>` : ''}
          </div>
          <div class="duration-row"><div class="duration-track"><span style="width:${pct(m.duration, maxDur).toFixed(2)}%"></span></div><span>${fmtDur(m.duration)}</span></div>
        </article>`).join('');

    const failDetails = failures.length ? `
    <section class="panel settings-panel">
      <h2>Failed test details</h2>
      <table class="settings-table fail-table">
        <tr class="th"><td>TC ID</td><td>Test</td><td>Time</td><td>Failure reason</td></tr>
        ${failures.map((f) => `<tr><td>${esc(f.id)}</td><td>${esc(f.title.replace(/^API_[A-Z]+_\d+\s*-\s*/, ''))}<br><small>${esc(f.module)}</small></td><td>${fmtDur(f.duration)}</td><td><pre>${esc(f.reason)}</pre></td></tr>`).join('')}
      </table>
    </section>` : '';

    const generated = this.startedAt.toLocaleString('en-GB', { hour12: true });

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(o.title || 'Banking API Test Execution Summary')}</title>
  <style>
    :root { --ink:#172033; --muted:#667085; --line:#e5e9f0; --panel:#ffffff; --page:#f5f7fb; --passed:#0f9f6e; --failed:#e5484d; --skipped:#8b95a7; --flaky:#e28b16; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--page); color:var(--ink); }
    main { max-width:1120px; margin:0 auto; padding:42px 26px 52px; }
    .hero { display:flex; justify-content:space-between; gap:24px; padding:34px; border-radius:20px; background:linear-gradient(135deg,#12264b,#1b4f85); color:#fff; box-shadow:0 16px 36px rgba(25,54,96,.18); }
    h1 { margin:0; font-size:clamp(28px,4vw,42px); letter-spacing:-.035em; }
    .run-badge { align-self:flex-start; white-space:nowrap; padding:8px 12px; border:1px solid rgba(255,255,255,.34); border-radius:999px; font-size:13px; font-weight:700; text-transform:capitalize; }
    .meta { display:flex; flex-wrap:wrap; gap:12px 25px; margin:23px 2px 0; color:var(--muted); font-size:14px; }
    .cards { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; margin:26px 0; }
    .card,.panel,.module-card { background:var(--panel); border:1px solid var(--line); border-radius:16px; box-shadow:0 3px 12px rgba(16,24,40,.035); }
    .card { padding:20px; }
    .card .label { margin:0; color:var(--muted); font-size:13px; font-weight:600; }
    .card .value { margin:7px 0 0; font-size:28px; font-weight:760; letter-spacing:-.035em; }
    .card .subvalue { margin:5px 0 0; color:var(--muted); font-size:12px; }
    .passed { color:var(--passed); } .failed { color:var(--failed); } .skipped { color:var(--skipped); } .flaky { color:var(--flaky); }
    .overview { display:grid; grid-template-columns:minmax(280px,.85fr) minmax(0,1.15fr); gap:22px; }
    .analytics-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:22px; }
    .panel { padding:26px; }
    .panel h2 { margin:0 0 22px; font-size:18px; letter-spacing:-.02em; }
    .panel-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .panel-heading h2 { margin-bottom:5px; } .panel-heading p,.panel-intro { margin:0; color:var(--muted); font-size:13px; }
    .trend-value { color:#3973b9; font-size:21px; letter-spacing:-.03em; }
    .donut-wrap { display:flex; align-items:center; justify-content:center; min-height:260px; }
    .donut { width:220px; aspect-ratio:1; display:grid; place-items:center; border-radius:50%; background:conic-gradient(${gradient}); }
    .donut::after { content:""; grid-area:1/1; width:150px; aspect-ratio:1; border-radius:50%; background:#fff; }
    .donut-center { z-index:1; grid-area:1/1; text-align:center; }
    .donut-center strong { display:block; font-size:34px; letter-spacing:-.05em; } .donut-center span { color:var(--muted); font-size:13px; }
    .legend { display:grid; gap:12px; margin-top:7px; }
    .legend-row { display:flex; align-items:center; justify-content:space-between; color:var(--muted); font-size:14px; }
    .legend-key { display:flex; align-items:center; gap:9px; } .dot { width:10px; height:10px; border-radius:50%; }
    .trend-chart { width:100%; height:auto; margin-top:16px; overflow:visible; } .trend-grid-line { stroke:#e6ebf2; stroke-width:1; } .trend-axis-label { fill:#8a94a6; font-size:11px; } .trend-area { fill:#dbeafe; } .trend-line { fill:none; stroke:#3973b9; stroke-linecap:round; stroke-linejoin:round; stroke-width:3; } .trend-point { fill:#fff; stroke:#3973b9; stroke-width:3; }
    .failure-list { display:grid; gap:14px; margin-top:18px; } .failure-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px 12px; align-items:end; } .failure-row h3 { margin:0; overflow-wrap:anywhere; font-size:13px; line-height:1.35; } .failure-row span { color:var(--failed); font-size:12px; font-weight:750; white-space:nowrap; } .failure-track { grid-column:1/-1; height:9px; overflow:hidden; border-radius:999px; background:#f1e7e8; } .failure-track i { display:block; min-width:2px; height:100%; border-radius:inherit; background:var(--failed); } .no-failures { margin:27px 0 0; color:var(--passed); font-size:14px; font-weight:650; }
    .modules { margin-top:22px; }
    .modules > h2 { margin:0 0 12px; font-size:20px; letter-spacing:-.02em; }
    .modules > p { margin:0 0 18px; color:var(--muted); font-size:14px; }
    .module-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .module-card { padding:19px; } .module-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
    .module-heading h3 { margin:0; font-size:15px; } .module-heading span { color:var(--muted); font-size:12px; white-space:nowrap; }
    .status-bar,.duration-track { overflow:hidden; border-radius:999px; background:#edf1f5; } .status-bar { display:flex; height:9px; margin:17px 0 12px; }
    .status-segment { height:100%; } .module-metrics { display:flex; flex-wrap:wrap; gap:8px 12px; font-size:12px; font-weight:650; }
    .duration-row { display:flex; align-items:center; gap:11px; margin-top:17px; color:var(--muted); font-size:12px; } .duration-track { flex:1; height:7px; } .duration-track span { display:block; height:100%; border-radius:inherit; background:#3973b9; }
    .settings-table { width:100%; border-collapse:collapse; }
    .settings-table td { padding:12px 16px; border:1px solid var(--line); }
    .settings-table td:first-child { font-weight:600; width:65%; }
    .settings-table td:last-child { text-align:center; font-weight:600; }
    .settings-panel { margin-top:22px; }
    .fail-table td:first-child { width:110px; white-space:nowrap; } .fail-table td:last-child { text-align:left; font-weight:400; }
    .fail-table .th td { background:#f5f7fb; font-weight:700; text-align:left; } .fail-table td { vertical-align:top; font-size:13px; font-weight:400; }
    .fail-table small { color:var(--muted); } .fail-table pre { margin:0; white-space:pre-wrap; word-break:break-word; font:12px/1.45 Consolas,monospace; color:#b42318; }
    footer { margin-top:28px; color:var(--muted); font-size:12px; text-align:center; }
    @media (max-width:800px) { .cards { grid-template-columns:repeat(2,minmax(0,1fr)); } .overview,.analytics-grid { grid-template-columns:1fr; } .module-grid { grid-template-columns:1fr; } }
    @media (max-width:500px) { main { padding:22px 15px 35px; } .hero { padding:24px; flex-direction:column; } .cards { grid-template-columns:1fr 1fr; } .card:first-child { grid-column:1/-1; } }
    @media print { body { background:#fff; } main { max-width:none; padding:12mm; } .hero { box-shadow:none; } .card,.panel,.module-card { box-shadow:none; break-inside:avoid; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div><h1>${esc(o.title || 'Banking API Test Execution Summary')}</h1></div>
      <span class="run-badge">${runPassed ? 'Run passed' : 'Run failed'}</span>
    </section>

    <div class="meta">
      <span><strong>Generated:</strong> ${esc(generated)}</span>
      <span><strong>Environment:</strong> ${esc(o.environment || 'DEMO')}</span>
      <span><strong>Run Duration:</strong> ${fmtDur(fullResult.duration)}</span>
      ${o.sprint ? `<span><strong>Sprint Number:</strong> ${esc(o.sprint)}</span>` : ''}
      <span><strong>Module Name:</strong> ${esc(o.moduleName || 'Banking API')}</span>
    </div>

    <section class="cards" aria-label="Execution totals">
      <article class="card"><p class="label">Total tests</p><p class="value">${total}</p><p class="subvalue">${mods.length} spec file${mods.length === 1 ? '' : 's'}</p></article>
      <article class="card"><p class="label">Passed</p><p class="value passed">${counts.passed}</p><p class="subvalue">${f1(passRate)}% pass rate</p></article>
      <article class="card"><p class="label">Failed</p><p class="value failed">${counts.failed}</p><p class="subvalue">${f1(pct(counts.failed, total))}% of execution</p></article>
      <article class="card"><p class="label">Skipped</p><p class="value skipped">${counts.skipped}</p><p class="subvalue">${f1(pct(counts.skipped, total))}% of execution</p></article>
      <article class="card"><p class="label">Flaky</p><p class="value flaky">${counts.flaky}</p><p class="subvalue">Passed after retry</p></article>
    </section>

    <section class="overview">
      <article class="panel">
        <h2>Execution status</h2>
        <div class="donut-wrap"><div class="donut"><div class="donut-center"><strong>${Math.round(passRate)}%</strong><span>pass rate</span></div></div></div>
      </article>
      <article class="panel">
        <h2>Status distribution</h2>
        <div class="legend">
          <div class="legend-row"><span class="legend-key"><i class="dot" style="background:#0f9f6e"></i>Passed</span><strong>${counts.passed}</strong></div>
          <div class="legend-row"><span class="legend-key"><i class="dot" style="background:#e5484d"></i>Failed</span><strong>${counts.failed}</strong></div>
          <div class="legend-row"><span class="legend-key"><i class="dot" style="background:#8b95a7"></i>Skipped</span><strong>${counts.skipped}</strong></div>
          <div class="legend-row"><span class="legend-key"><i class="dot" style="background:#e28b16"></i>Flaky</span><strong>${counts.flaky}</strong></div>
        </div>
      </article>
    </section>

    <section class="panel settings-panel">
      <h2>Execution Settings</h2>
      <table class="settings-table">
        ${settings.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('\n        ')}
      </table>
    </section>

    <section class="analytics-grid">
      <article class="panel trend-panel">
        <div class="panel-heading">
          <div><h2>Pass-rate trend</h2><p>Most recent ${trendPts.length} run${trendPts.length === 1 ? '' : 's'} (up to 20)</p></div>
          <strong class="trend-value">${f1(passRate)}%</strong>
        </div>
        ${trendSvg(trendPts)}
      </article>
      <article class="panel failure-panel">
        <h2>Failed-test percentage by spec file</h2>
        <p class="panel-intro">The highest-risk areas from the current execution appear first.</p>
        ${failurePanel}
      </article>
    </section>
    ${failDetails}

    <section class="modules">
      <h2>Execution by spec file</h2>
      <p>Each card represents one spec file. The bars show status distribution and execution time.</p>
      <div class="module-grid">${moduleCards}
      </div>
    </section>

    <footer>Generated automatically by Playwright • ${esc(o.title || 'Banking API Test Execution Summary')}</footer>
  </main>
</body>
</html>`;

    fs.writeFileSync(outFile, html);
    console.log(`\n[html-summary] Report saved: ${outFile}`);
  }
}

module.exports = HtmlSummaryReporter;