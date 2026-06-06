/**
 * line · dashboard — cockpit
 *
 * URL: ?run=<name>          ⇒ loads /shakedown/<name>/{detection.json, video_with_audio.mp4|video.mp4}
 * URL: ?demo=1              ⇒ loads ./demo-detection.json (no video)
 * URL: ?report=<url>        ⇒ axes view; loads a DriftReport JSON directly
 *                            (e.g. ?report=/generated/v0_crescendo.report.json)
 * URL: ?golden=1            ⇒ golden-runs analyzer; loads generated/golden-runs
 * URL: (no params)          ⇒ landing page; lists /shakedown/runs.json entries.
 *
 * Cursor sync: video time → cursor → all UI; timeline click → video.currentTime.
 * rAF loop runs while video plays so badge timing isn't bottlenecked by the
 * browser's ~4Hz `timeupdate` cadence.
 */

import uPlot from "/node_modules/uplot/dist/uPlot.esm.js";

const COLORS = {
  landing:    "#9b3a2a",
  bounce:     "#b58326",
  kick:       "#1e5a6e",
  flyThrough: "#928873",
  ink:        "#1f1a14",
  inkMid:     "#5d564a",
  inkFade:    "#928873",
  rule:       "#cdbfa3",
  ruleSoft:   "#ddd0b2",
  paperWarm:  "#ede4d0",
  air:        "#8a9a78",
  slide:      "#7a8a5a",
  accent:     "#9b3a2a",
};

const EVENT_TYPES = ["landing", "bounce", "kick", "flyThrough"];

// Axis palette for the measured-vs-target panel (one hue per creative axis).
const AXIS_INFO = {
  air:           { label: "air",           color: "#1e5a6e", max: 0.99 },
  speed:         { label: "speed",         color: "#9b3a2a", max: 1 },
  grain:         { label: "grain",         color: "#b58326", max: 1 },
};
const AXIS_ORDER = ["air", "speed", "grain"];

const params  = new URLSearchParams(location.search);
const runName = params.get("run");
const isDemo  = params.get("demo") === "1";
const reportUrl = params.get("report");
const isGolden = params.get("golden") === "1" || params.get("view") === "golden";

queueMicrotask(() => {
  if (isGolden) {
    mountGoldenView().catch((e) => {
      console.error(e);
      document.body.innerHTML =
        `<pre style="padding:24px;color:#9b3a2a;font-family:monospace">
Failed to load golden runs:\n${String(e)}</pre>`;
    });
  } else if (reportUrl) {
    mountReportView(reportUrl).catch((e) => {
      console.error(e);
      document.body.innerHTML =
        `<pre style="padding:24px;color:#9b3a2a;font-family:monospace">
Failed to load report "${reportUrl}":\n${String(e)}</pre>`;
    });
  } else if (runName || isDemo) {
    mountRunView(runName || "demo").catch((e) => {
      console.error(e);
      document.body.innerHTML =
        `<pre style="padding:24px;color:#9b3a2a;font-family:monospace">
Failed to load run "${runName || "demo"}":\n${String(e)}</pre>`;
    });
  } else {
    mountLandingView();
  }
});

// ── Report (measured-vs-target axes) view ────────────────────────
//
// Loads a DriftReport JSON and plots, per creative axis, the target curve
// (what the spec asked for, averaged over each gap) against what the detector
// measured. x = gap.t_end (landing time, seconds); y in [0, max].
// One small stacked chart per axis; only axes that appear in gaps[] render.

async function mountReportView(url) {
  document.getElementById("report-view").hidden = false;

  const report = await fetch(url, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  });

  const durationFrames = Math.max(1, Math.ceil(reportDurationSec(report) * 40));
  const axisReport = normalizeAxisReport(report, durationFrames, 40);
  const gaps = axisReport.points;

  // Which axes actually appear in the gaps, in canonical order.
  const present = new Set();
  for (const g of gaps) for (const k of Object.keys(g.axes ?? {})) present.add(k);
  const axes = AXIS_ORDER.filter((a) => present.has(a))
    .concat([...present].filter((a) => !AXIS_ORDER.includes(a)));

  const tMax = gaps.length ? Math.max(...gaps.map((g) => g.t_end)) : 1;

  // Header / meta.
  const name = url.split("/").pop().replace(/\.report\.json$/, "").replace(/\.json$/, "");
  setText("rp-name", name);
  const surv = gaps.filter((g) => g.survived).length;
  const offBeat = (report.off_beat_landings ?? []).length;
  const term = report.terminus;
  setText("rp-meta",
    `${gaps.length} ${axisReport.kind} · ${axes.length} axes · ${surv}/${gaps.length} survived` +
    (offBeat ? ` · ${offBeat} off-beat` : "") +
    (term ? ` · terminus ${term.reason}@${term.frame}` : ""));

  const host = document.getElementById("rp-charts");
  host.innerHTML = "";
  if (!axes.length) {
    host.innerHTML = `<p class="hint">No per-axis gap data in this report.</p>`;
    return;
  }
  for (const axis of axes) renderAxisChart(host, axis, gaps, tMax);
}

function renderAxisChart(host, axis, gaps, tMax) {
  const info = AXIS_INFO[axis] ?? { label: axis, color: "#5d564a", max: 1 };

  // Pull the per-gap series for this axis (gaps where the axis was targeted).
  const series = gaps
    .filter((g) => g.axes && g.axes[axis])
    .map((g) => ({
      t: g.t_end,
      target: g.axes[axis].target,
      achieved: g.axes[axis].achieved,
      error: g.axes[axis].error,
      raw: g.axes[axis].raw,
      survived: g.survived,
    }));
  if (!series.length) return;

  const meanAbsErr = series.reduce((s, p) => s + Math.abs(p.error), 0) / series.length;
  const authoredValues = series.flatMap((p) => [p.target, p.achieved].filter(Number.isFinite));
  const yMin = Math.min(0, ...authoredValues);
  const yMax = Math.max(info.max ?? 1, ...authoredValues);
  const ySpan = Math.max(0.001, yMax - yMin);
  const rawMeanAbsErr = axis === "speed"
    ? meanRawSpeedError(series)
    : null;

  const card = document.createElement("div");
  card.className = "rp-card";
  card.innerHTML =
    `<div class="rp-card-head">` +
      `<span class="rp-axis-name" style="color:${info.color}">${escapeHtml(info.label)}</span>` +
      `<span class="rp-legend">` +
        `<span class="lg lg-target" style="--c:${info.color}">target</span>` +
        `<span class="lg lg-achieved" style="--c:${info.color}">measured</span>` +
        `<span class="lg lg-err">mean |err| ${meanAbsErr.toFixed(3)}</span>` +
        (rawMeanAbsErr === null ? "" : `<span class="lg lg-err">raw ${rawMeanAbsErr.toFixed(2)} px/frame</span>`) +
      `</span>` +
    `</div>`;
  host.appendChild(card);

  const W = 944, H = 150;
  const padL = 54, padR = 16, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "rp-svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  card.appendChild(svg);

  const el = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      n.setAttribute(k, String(v));
    }
    if (text != null) n.textContent = text;
    return n;
  };

  const xAt = (t) => padL + (tMax > 0 ? t / tMax : 0) * innerW;
  const yAt = (v) => {
    const clamped = Math.max(yMin, Math.min(yMax, v));
    return padT + (1 - (clamped - yMin) / ySpan) * innerH;
  };

  // Horizontal grid + y labels (min, mid, max).
  for (const v of [yMin, yMin + ySpan * 0.5, yMax]) {
    const y = yAt(v);
    svg.appendChild(el("line", { class: "rp-grid", x1: padL, x2: padL + innerW, y1: y, y2: y }));
    svg.appendChild(el("text", { class: "rp-ylabel", x: padL - 8, y: y + 3, "text-anchor": "end" },
      v.toFixed(2)));
  }

  // Error ribbons: vertical segment per gap between target and achieved.
  for (const p of series) {
    const x = xAt(p.t);
    svg.appendChild(el("line", {
      class: "rp-errband",
      x1: x, x2: x, y1: yAt(p.target), y2: yAt(p.achieved),
      style: `stroke:${info.color}`,
    }));
  }

  // Target curve (solid line).
  let dt = "";
  series.forEach((p, i) => {
    dt += (i === 0 ? "M" : "L") + xAt(p.t).toFixed(2) + "," + yAt(p.target).toFixed(2);
  });
  svg.appendChild(el("path", { class: "rp-target", d: dt, style: `stroke:${info.color}` }));

  // Measured series (dashed line + dots; hollow dot when the gap didn't survive).
  let da = "";
  series.forEach((p, i) => {
    da += (i === 0 ? "M" : "L") + xAt(p.t).toFixed(2) + "," + yAt(p.achieved).toFixed(2);
  });
  svg.appendChild(el("path", { class: "rp-achieved", d: da, style: `stroke:${info.color}` }));

  for (const p of series) {
    const c = el("circle", {
      class: "rp-dot" + (p.survived ? "" : " dead"),
      cx: xAt(p.t), cy: yAt(p.achieved), r: 2.6,
      style: `--c:${info.color}`,
    });
    c.appendChild(el("title", {}, `t=${p.t.toFixed(2)}s · target ${p.target.toFixed(3)} · ` +
      `measured ${p.achieved.toFixed(3)} · |err| ${Math.abs(p.error).toFixed(3)}` +
      rawSpeedTitle(p.raw) +
      (p.survived ? "" : " · did not survive")));
    svg.appendChild(c);
  }

  // x ruler (seconds).
  const totalSec = Math.ceil(tMax);
  const stepSec = totalSec > 12 ? 5 : 1;
  for (let s = 0; s <= totalSec; s += stepSec) {
    const x = xAt(s);
    svg.appendChild(el("line", { class: "rp-tick", x1: x, x2: x, y1: padT + innerH, y2: padT + innerH + 4 }));
    svg.appendChild(el("text", { class: "rp-xlabel", x, y: padT + innerH + 16, "text-anchor": "middle" },
      `${s}s`));
  }
}

function meanRawSpeedError(series) {
  const values = series
    .map((p) => p.raw?.error)
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length : null;
}

function rawSpeedTitle(raw) {
  if (!raw) return "";
  return ` · raw target ${raw.target.toFixed(2)} px/frame` +
    ` · raw achieved ${raw.achieved.toFixed(2)} px/frame` +
    ` · raw |err| ${Math.abs(raw.error).toFixed(2)} px/frame`;
}

function normalizeAxisReport(report, N, FPS) {
  const durationSec = Math.max(0.001, N / FPS);
  if (Array.isArray(report?.gaps) && report.gaps.length) {
    let prevFrame = 0;
    const points = report.gaps
      .slice()
      .sort((a, b) => a.t_end - b.t_end)
      .map((g, i) => {
        const frameEnd = Math.max(prevFrame, Math.round((g.t_end ?? 0) * FPS));
        const point = {
          gap_index: g.gap_index ?? i,
          t_end: frameEnd / FPS,
          frameStart: prevFrame,
          frameEnd,
          survived: g.survived !== false,
          axes: g.axes ?? {},
        };
        prevFrame = frameEnd;
        return point;
      });
    return { kind: "gaps", points };
  }

  if (Array.isArray(report?.sections) && report.sections.length) {
    const count = report.sections.length;
    const points = report.sections.map((s, i) => {
      const frameStart = Math.round((i / count) * N);
      const frameEnd = Math.round(((i + 1) / count) * N);
      return {
        gap_index: s.section_index ?? i,
        t_end: frameEnd / FPS,
        frameStart,
        frameEnd,
        survived: s.survived !== false,
        axes: s.axes ?? {},
      };
    });
    return { kind: "sections", points };
  }

  return { kind: "gaps", points: [] };
}

function reportDurationSec(report) {
  const gapEnd = Math.max(0, ...(report?.gaps ?? []).map((g) => Number(g.t_end) || 0));
  const contactEnd = Math.max(0, ...(report?.contacts ?? []).map((c) => Number(c.t_target) || 0));
  const terminusEnd = Number(report?.terminus?.frame) > 0 ? Number(report.terminus.frame) / 40 : 0;
  return Math.max(gapEnd, contactEnd, terminusEnd, 1);
}

// ── Golden-runs analyzer ─────────────────────────────────────────

const GOLDEN_RUN_COLORS = [
  "#9b3a2a",
  "#1e5a6e",
  "#3d6b3a",
  "#b58326",
  "#3d3a78",
  "#7a8a5a",
  "#6f4a7c",
  "#8f5a35",
  "#2f6659",
  "#5d564a",
];

const GOLDEN_METRICS = {
  score: {
    label: "score",
    lowerBetter: false,
    domain: [0, 500],
    fmt: (v) => fmtGoldenNumber(v, 1),
  },
  pass_rate: {
    label: "pass %",
    lowerBetter: false,
    domain: [0, 100],
    fmt: (v) => `${fmtGoldenNumber(v, 0)}%`,
  },
  failures: {
    label: "failures",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtGoldenNumber(v, 0),
  },
  missing: {
    label: "missing avg",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtGoldenNumber(v, 2),
  },
  axis_error: {
    label: "axis error",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtGoldenNumber(v, 3),
  },
  axis_loss: {
    label: "axis loss",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtGoldenNumber(v, 3),
  },
  axis_quality: {
    label: "axis quality",
    lowerBetter: false,
    domain: [0, 1],
    fmt: (v) => fmtGoldenNumber(v, 3),
  },
  sim_frames: {
    label: "sim frames avg",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtBudget(v),
  },
  elapsed: {
    label: "elapsed avg",
    lowerBetter: true,
    domain: null,
    fmt: (v) => `${fmtGoldenNumber(v, 1)}s`,
  },
  seed_sigma: {
    label: "seed σ (score)",
    lowerBetter: true,
    domain: null,
    fmt: (v) => fmtGoldenNumber(v, 1),
  },
};
const GOLDEN_METRIC_ORDER = [
  "score",
  "pass_rate",
  "failures",
  "missing",
  "seed_sigma",
  "axis_error",
  "axis_loss",
  "axis_quality",
  "sim_frames",
  "elapsed",
];

async function mountGoldenView() {
  const view = document.getElementById("golden-view");
  view.hidden = false;

  const metricSelect = document.getElementById("golden-metric");
  metricSelect.innerHTML = GOLDEN_METRIC_ORDER.map((key) =>
    `<option value="${key}">${escapeHtml(GOLDEN_METRICS[key].label)}</option>`).join("");

  const manifestRes = await fetch("/api/golden-runs", { cache: "no-cache" });
  if (!manifestRes.ok) {
    throw new Error(`/api/golden-runs: HTTP ${manifestRes.status}. Start with npm run dash so archives can be discovered.`);
  }
  const manifest = await manifestRes.json();
  const entries = Array.isArray(manifest.runs) ? manifest.runs : [];
  if (!entries.length) {
    setText("golden-meta", "no generated/golden-runs archives found");
    document.getElementById("golden-kpis").innerHTML =
      `<div class="golden-empty">No <code>generated/golden-runs/*/golden.json</code> archives found.</div>`;
    return;
  }

  const loaded = await Promise.all(entries.map(async (entry) => {
    try {
      const res = await fetch(entry.json, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return normalizeGoldenRun(entry, await res.json());
    } catch (error) {
      console.warn("failed to load golden run", entry, error);
      return null;
    }
  }));

  const runs = loaded.filter(Boolean).sort((a, b) =>
    a.createdMs - b.createdMs || a.id.localeCompare(b.id));
  if (!runs.length) {
    setText("golden-meta", "golden archives were found but none could be parsed");
    return;
  }
  const palette = goldenPalette(runs.length);
  runs.forEach((run, index) => { run.color = palette[index]; });

  const focus = runs[runs.length - 1];
  const state = {
    runs,
    byId: new Map(runs.map((run) => [run.id, run])),
    selectedIds: new Set(runs.map((run) => run.id)),
    focusId: focus.id,
    baselineId: defaultGoldenBaseline(runs, focus)?.id ?? "",
    metric: "score",
    filter: "",
    range: null,          // budget scoring window set by drag-zoom on the curve
    _building: false,     // guard so uPlot's setScale hook ignores programmatic builds
    _curve: null,         // live uPlot instance
  };

  setupGoldenControls(state);
  renderGolden(state);
}

function normalizeGoldenRun(entry, data) {
  const id = entry.name ?? data.archive?.dir?.split("/").pop() ?? "golden-run";
  const createdMs = parseGoldenStamp(id) ?? entry.mtime_ms ?? 0;
  const budgetScores = Array.isArray(data.budget_scores)
    ? data.budget_scores.slice().sort((a, b) => a.budget - b.budget)
    : [];
  const budgets = Array.isArray(data.budgets) && data.budgets.length
    ? data.budgets.slice().sort((a, b) => a - b)
    : budgetScores.map((summary) => summary.budget);
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const commit = entry.commit ?? data.source?.commit ?? null;
  const subject = entry.subject ?? null;
  const seqMatch = /^sweep_(\d+)_/.exec(id);
  const seq = seqMatch ? Number(seqMatch[1]) : null;
  const short = commit ? commit.slice(0, 7) : id.slice(0, 8);
  const label = seq != null ? `${String(seq).padStart(2, "0")} · ${short}` : (commit ? short : goldenRunLabel(id, createdMs));

  return {
    id,
    label,
    short,
    seq,
    commit,
    subject,
    createdMs,
    jsonUrl: entry.json,
    sizeBytes: entry.size_bytes ?? 0,
    canonical: Boolean(data.canonical),
    compiler: data.compiler ?? "unknown",
    evaluatorFingerprint: data.evaluator_fingerprint ?? "unknown",
    source: data.source ?? {},
    archive: data.archive ?? {},
    curveScore: Number(data.curve_score ?? 0),
    // Headline metric: budget-value-weighted average of the per-budget suite scores
    // (see metric.ts); `ceiling`/`log_auc` are reported secondaries. Captured here so
    // the UI can show the real metric; curveScore above is the LEGACY shifted-geomean.
    // TODO(dashboard): surface `headline` as the primary KPI (score + weight_by_budget
    // + tier + validity), and relabel the curveScore tile/columns "curve score (legacy
    // SGM)". Do this with the dashboard running (verify skill).
    headline: data.headline ?? null,
    budgets,
    budgetScores,
    rows,
    scope: data.scope ?? {},
    scoring: data.scoring ?? {},
    variants: data.variants ?? { enabled: false },
    raw: data,
    _agg: null,
    _checkpoints: null,        // built lazily — only focus/baseline need the heavy flatten
    _checkpointByKey: null,
    _seedBand: null,
  };
}

// Heavy per-checkpoint flatten, memoized. Only the focus/baseline runs ever build this,
// so loading 19 runs no longer materializes ~tens of thousands of checkpoint objects.
function runCheckpoints(run) {
  if (run._checkpoints) return run._checkpoints;
  const checkpoints = [];
  for (const row of run.rows) {
    const name = row.name ?? "unknown";
    const variant = row.variant ?? "base";
    const seed = row.seed ?? 0;
    for (const checkpoint of (Array.isArray(row.checkpoints) ? row.checkpoints : [])) {
      checkpoints.push({
        ...checkpoint,
        name,
        variant,
        seed,
        row_status: row.status ?? "unknown",
        key: goldenCaseKey(name, variant, seed, checkpoint.budget),
      });
    }
  }
  run._checkpoints = checkpoints;
  return checkpoints;
}

function setupGoldenControls(state) {
  const focusSelect = document.getElementById("golden-focus");
  const baselineSelect = document.getElementById("golden-baseline");
  const runOptions = state.runs.slice().reverse().map((run) =>
    `<option value="${escapeHtml(run.id)}">${escapeHtml(run.label)} · ${fmtGoldenNumber(run.curveScore, 2)}</option>`).join("");
  focusSelect.innerHTML = runOptions;
  baselineSelect.innerHTML = `<option value="">none</option>${runOptions}`;

  document.getElementById("golden-select-all").addEventListener("click", () => {
    state.selectedIds = new Set(state.runs.map((run) => run.id));
    renderGolden(state);
  });
  document.getElementById("golden-select-canonical").addEventListener("click", () => {
    const canonical = state.runs.filter((run) => run.canonical);
    state.selectedIds = new Set((canonical.length ? canonical : state.runs).map((run) => run.id));
    renderGolden(state);
  });
  document.getElementById("golden-select-latest").addEventListener("click", () => {
    state.selectedIds = new Set(state.runs.slice(-6).map((run) => run.id));
    renderGolden(state);
  });
  focusSelect.addEventListener("change", () => {
    state.focusId = focusSelect.value;
    if (state.baselineId === state.focusId) {
      state.baselineId = defaultGoldenBaseline(state.runs, state.byId.get(state.focusId))?.id ?? "";
    }
    renderGolden(state);
  });
  baselineSelect.addEventListener("change", () => {
    state.baselineId = baselineSelect.value;
    renderGolden(state);
  });
  document.getElementById("golden-metric").addEventListener("change", (ev) => {
    state.metric = ev.target.value;
    renderGolden(state);
  });
  document.getElementById("golden-filter").addEventListener("input", (ev) => {
    state.filter = ev.target.value.trim().toLowerCase();
    renderGolden(state);
  });
}

function goldenResolve(state) {
  const selected = state.runs.filter((run) => state.selectedIds.has(run.id));
  const focus = state.byId.get(state.focusId) ?? state.runs[state.runs.length - 1];
  let baseline = state.byId.get(state.baselineId) ?? null;
  state.focusId = focus.id;
  if (baseline?.id === focus.id) { state.baselineId = ""; baseline = null; }
  return { selected, focus, baseline };
}

// Full render: rebuilds the (relatively expensive) uPlot curve, then everything else.
// Called on selection / focus / metric / filter changes — not on zoom.
function renderGolden(state) {
  const { selected, focus, baseline } = goldenResolve(state);

  setText("golden-meta",
    `${state.runs.length} archives · ${state.runs.filter((run) => run.canonical).length} canonical · ` +
    `focus ${focus.label} · ${focus.compiler} · ${focus.evaluatorFingerprint}`);
  document.getElementById("golden-focus").value = state.focusId;
  document.getElementById("golden-baseline").value = state.baselineId;
  document.getElementById("golden-metric").value = state.metric;

  renderGoldenCurve(state, selected, focus);
  renderGoldenDependents(state);
}

// Everything downstream of the budget scoring window. Re-run on zoom WITHOUT
// rebuilding the curve, so dragging a range is cheap and keeps the chart's view.
function renderGoldenDependents(state) {
  const { selected, focus, baseline } = goldenResolve(state);
  setText("golden-selected-count", `${selected.length}/${state.runs.length} selected`);
  renderGoldenRangeReadout(state, selected);
  renderGoldenRunPills(state);
  renderGoldenKpis(state, selected, focus, baseline);
  renderGoldenProgression(state, selected);
  renderGoldenDelta(document.getElementById("golden-delta"), focus, baseline, state.range);
  renderGoldenMatrix(document.getElementById("golden-matrix"), focus, baseline, state.metric, state.filter, state.range);
  renderGoldenCases(document.getElementById("golden-cases"), focus, baseline, state.filter);
  renderGoldenCatalog(document.getElementById("golden-catalog"), state);
}

function renderGoldenRangeReadout(state, selected) {
  const host = document.getElementById("golden-curve-legend");
  if (!host) return;
  const budgets = [...new Set(selected.flatMap((run) => run.budgets))].sort((a, b) => a - b);
  const lo = budgets[0], hi = budgets[budgets.length - 1];
  if (!state.range) {
    host.innerHTML = `<span class="golden-range-note">scope <b>full</b>${
      Number.isFinite(lo) ? ` · ${fmtBudget(lo)}–${fmtBudget(hi)}` : ""} · drag the curve to scope the score</span>`;
    return;
  }
  host.innerHTML = `<span class="golden-range-note active">scope <b>${fmtBudget(state.range.min)}–${fmtBudget(state.range.max)}</b> · ` +
    `<button type="button" id="golden-range-reset">reset</button></span>`;
  const reset = document.getElementById("golden-range-reset");
  if (reset) reset.addEventListener("click", () => {
    state.range = null;
    renderGolden(state);   // full rebuild restores the curve to its data extent
  });
}

function renderGoldenRunPills(state) {
  const host = document.getElementById("golden-run-pills");
  const runs = state.runs.slice().reverse();
  host.innerHTML = runs.map((run, index) => {
    const color = goldenRunColor(run, state.runs.length - 1 - index);
    const selected = state.selectedIds.has(run.id);
    const focus = state.focusId === run.id;
    return `<label class="golden-run-pill${selected ? " selected" : ""}${focus ? " focus" : ""}" style="--run-color:${color}">` +
      `<input type="checkbox" value="${escapeHtml(run.id)}"${selected ? " checked" : ""}>` +
      `<span>${escapeHtml(run.label)}</span>` +
      `<small>${fmtGoldenNumber(rangeScopedScore(run, state.range), 2)}</small>` +
    `</label>`;
  }).join("");

  host.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selectedIds.add(input.value);
      else state.selectedIds.delete(input.value);
      renderGolden(state);
    });
  });
}

function renderGoldenKpis(state, selected, focus, baseline) {
  const host = document.getElementById("golden-kpis");
  const range = state.range;
  const focusScore = rangeScopedScore(focus, range);
  const curveDelta = baseline ? focusScore - rangeScopedScore(baseline, range) : null;
  const scopedSummaries = rangeScopedSummaries(focus, range);
  const firstFull = firstFullPassBudget(focus, range);
  const finalSummary = scopedSummaries[scopedSummaries.length - 1];
  const firstSummary = scopedSummaries[0];
  const bestSelected = selected.reduce((best, run) =>
    !best || rangeScopedScore(run, range) > rangeScopedScore(best, range) ? run : best, null);
  const worst = weakestSpecs(focus, finalSummary?.budget).slice(0, 3);
  const budgetGain = largestBudgetGain(focus, range);
  const scopeLabel = range ? `${fmtBudget(range.min)}–${fmtBudget(range.max)}` : "full range";

  const tile = (label, value, sub, klass = "") =>
    `<div class="golden-kpi ${klass}">` +
      `<div class="golden-kpi-label">${escapeHtml(label)}</div>` +
      `<div class="golden-kpi-value">${value}</div>` +
      `<div class="golden-kpi-sub">${sub}</div>` +
    `</div>`;

  host.innerHTML =
    tile(
      `focus curve · ${escapeHtml(scopeLabel)}`,
      fmtGoldenNumber(focusScore, 2),
      baseline
        ? `${goldenSigned(curveDelta, 2)} vs ${escapeHtml(baseline.label)}`
        : `${focus.canonical ? "canonical" : "indicative"} · ${escapeHtml(focus.compiler)}`,
      curveDelta == null ? "" : curveDelta >= 0 ? "good" : "bad",
    ) +
    tile(
      "contract",
      firstFull ? fmtBudget(firstFull) : "not full",
      finalSummary
        ? `${finalSummary.passed}/${finalSummary.total} at ${fmtBudget(finalSummary.budget)} · start ${firstSummary?.passed ?? 0}/${firstSummary?.total ?? 0}`
        : "no budget summaries",
      finalSummary && finalSummary.passed === finalSummary.total ? "good" : "bad",
    ) +
    tile(
      "best selected",
      bestSelected ? fmtGoldenNumber(rangeScopedScore(bestSelected, range), 2) : "—",
      bestSelected ? escapeHtml(bestSelected.label) : "no selected runs",
      bestSelected?.id === focus.id ? "good" : "",
    ) +
    tile(
      "weak spots",
      worst.length ? escapeHtml(worst[0].name) : "—",
      worst.length
        ? worst.map((spec) => `${escapeHtml(spec.name)} ${fmtGoldenNumber(spec.score, 1)}`).join(" · ")
        : "no spec scores",
      worst.length && worst[0].passed < worst[0].total ? "bad" : "",
    ) +
    tile(
      "best budget gain",
      budgetGain ? goldenSigned(budgetGain.delta, 1) : "—",
      budgetGain
        ? `${fmtBudget(budgetGain.prevBudget)} to ${fmtBudget(budgetGain.budget)}`
        : "single budget run",
    );
}

const GOLDEN_AXIS_INK = "#928873";   // --ink-fade
const GOLDEN_AXIS_GRID = "#ddd0b2";  // --rule-soft
const GOLDEN_AXIS_FONT = "10px 'IBM Plex Mono', monospace";

// Interactive budget curve (uPlot): auto-fit y, drag-zoom to scope the score,
// live legend, and a seed-spread band under the focus run.
function renderGoldenCurve(state, selected, focus) {
  const host = document.getElementById("golden-curve");
  if (state._curve) { state._curve.destroy(); state._curve = null; }
  host.innerHTML = "";
  if (!selected.length) {
    host.innerHTML = `<div class="golden-empty">Select at least one run to draw the budget curve.</div>`;
    return;
  }

  const budgets = [...new Set(selected.flatMap((run) => run.budgets))].sort((a, b) => a - b);
  const data = [budgets];
  const series = [{ label: "budget", value: (u, v) => (v == null ? "—" : fmtBudget(v)) }];

  const focusSelected = focus && selected.includes(focus);
  const band = focusSelected ? focusSeedBand(focus) : null;

  for (const run of selected) {
    const byBudget = new Map(run.budgetScores.map((s) => [s.budget, s.score]));
    data.push(budgets.map((b) => (byBudget.has(b) ? byBudget.get(b) : null)));
    const isFocus = run.id === focus?.id;
    series.push({
      label: run.label,
      stroke: run.color,
      width: isFocus ? 2.4 : 1.3,
      alpha: selected.length > 10 && !isFocus ? 0.7 : 1,
      points: { show: budgets.length <= 40, size: isFocus ? 5 : 3.2 },
      value: (u, v) => (v == null ? "—" : fmtGoldenNumber(v, 1)),
    });
  }

  const opts = {
    width: (host.clientWidth || 900) - 28,
    height: 330,
    scales: { x: { time: false }, y: { auto: true } },
    legend: { show: true, live: true },
    cursor: { drag: { x: true, y: false }, focus: { prox: 28 }, points: { size: 6 } },
    axes: [
      { stroke: GOLDEN_AXIS_INK, grid: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, ticks: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, font: GOLDEN_AXIS_FONT, values: (u, vals) => vals.map(fmtBudget) },
      { stroke: GOLDEN_AXIS_INK, grid: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, ticks: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, font: GOLDEN_AXIS_FONT, size: 52 },
    ],
    series,
    hooks: {
      // Drag-zoom (and double-click reset) drive the budget scoring window.
      setScale: [(u, key) => {
        if (key !== "x" || state._building) return;
        const min = u.scales.x.min, max = u.scales.x.max;
        const full = budgets[0], fullMax = budgets[budgets.length - 1];
        state.range = (min <= full + 1e-6 && max >= fullMax - 1e-6) ? null : { min, max };
        renderGoldenDependents(state);
      }],
      // Seed-spread band behind the lines (focus run only).
      drawClear: [(u) => {
        if (!band || !band.size) return;
        const ctx = u.ctx;
        ctx.save();
        ctx.beginPath();
        let started = false;
        for (const b of budgets) {
          const e = band.get(b);
          if (!e) continue;
          const x = u.valToPos(b, "x", true), y = u.valToPos(e.max, "y", true);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        for (let i = budgets.length - 1; i >= 0; i--) {
          const e = band.get(budgets[i]);
          if (!e) continue;
          ctx.lineTo(u.valToPos(budgets[i], "x", true), u.valToPos(e.min, "y", true));
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(focus.color, 0.13);
        ctx.fill();
        ctx.restore();
      }],
    },
  };

  state._building = true;
  state._curve = new uPlot(opts, data, host);
  state._building = false;
}

// Score-over-commits: range-scoped curve_score plotted against commit order.
// Answers "did the compiler improve across this branch?" directly.
function renderGoldenProgression(state, selected) {
  const host = document.getElementById("golden-progression");
  if (!host) return;
  if (state._prog) { state._prog.destroy(); state._prog = null; }
  host.innerHTML = "";

  const runs = selected.slice().sort((a, b) =>
    (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.createdMs - b.createdMs);
  if (runs.length < 2) {
    host.innerHTML = `<div class="golden-empty">Select 2+ runs to chart score over commits.</div>`;
    return;
  }

  const xs = runs.map((_, i) => i);
  const ys = runs.map((run) => rangeScopedScore(run, state.range));
  const tick = (run) => (run.seq != null ? String(run.seq).padStart(2, "0") : run.short);

  const cap = document.createElement("div");
  cap.className = "golden-prog-cap";
  cap.textContent = state.range
    ? `score over ${fmtBudget(state.range.min)}–${fmtBudget(state.range.max)} · hover a point`
    : "full-range score · hover a point";

  const opts = {
    width: (host.clientWidth || 480) - 28,
    height: 210,
    scales: { x: { time: false }, y: { auto: true } },
    legend: { show: false },
    cursor: { focus: { prox: 28 }, points: { size: 6 } },
    axes: [
      { stroke: GOLDEN_AXIS_INK, grid: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, ticks: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, font: GOLDEN_AXIS_FONT, splits: () => xs, values: (u, vals) => vals.map((v) => (runs[v] ? tick(runs[v]) : "")) },
      { stroke: GOLDEN_AXIS_INK, grid: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, ticks: { stroke: GOLDEN_AXIS_GRID, width: 0.5 }, font: GOLDEN_AXIS_FONT, size: 52 },
    ],
    series: [
      {},
      { stroke: "#9b3a2a", width: 2, points: { show: true, size: 6 }, value: (u, v) => (v == null ? "—" : fmtGoldenNumber(v, 2)) },
    ],
    hooks: {
      setCursor: [(u) => {
        const idx = u.cursor.idx;
        const run = idx != null ? runs[idx] : null;
        if (!run) {
          cap.textContent = state.range
            ? `score over ${fmtBudget(state.range.min)}–${fmtBudget(state.range.max)} · hover a point`
            : "full-range score · hover a point";
          return;
        }
        cap.textContent = `${run.label} · ${run.subject ?? "—"} · ${fmtGoldenNumber(rangeScopedScore(run, state.range), 2)}`;
      }],
    },
  };

  state._prog = new uPlot(opts, [xs, ys], host);
  host.insertBefore(cap, host.firstChild);
}

function renderGoldenDelta(host, focus, baseline, range = null) {
  host.innerHTML = "";
  if (!baseline) {
    host.innerHTML = `<div class="golden-empty">Pick a baseline run to see budget and spec movement.</div>`;
    return;
  }

  const focusByBudget = new Map(focus.budgetScores.map((summary) => [summary.budget, summary]));
  const baseByBudget = new Map(baseline.budgetScores.map((summary) => [summary.budget, summary]));
  const budgets = budgetsInRange(focus.budgets, range).filter((budget) => baseByBudget.has(budget));
  if (!budgets.length) {
    host.innerHTML = `<div class="golden-empty">Focus and baseline have no common budgets.</div>`;
    return;
  }

  const deltas = budgets.map((budget) => ({
    budget,
    score: (focusByBudget.get(budget)?.score ?? 0) - (baseByBudget.get(budget)?.score ?? 0),
    pass: (focusByBudget.get(budget)?.passed ?? 0) - (baseByBudget.get(budget)?.passed ?? 0),
  }));
  const W = 480, H = 220;
  const padL = 42, padR = 12, padT = 18, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const zeroY = padT + innerH / 2;
  const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d.score)));
  const band = innerW / deltas.length;
  const svg = goldenSvg("svg", { class: "golden-svg golden-delta-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" });
  svg.appendChild(goldenSvg("line", { class: "golden-zero", x1: padL, x2: padL + innerW, y1: zeroY, y2: zeroY }));
  for (const delta of deltas) {
    const x = padL + deltas.indexOf(delta) * band + band * 0.18;
    const h = Math.abs(delta.score) / maxAbs * (innerH / 2 - 8);
    const y = delta.score >= 0 ? zeroY - h : zeroY;
    const rect = goldenSvg("rect", {
      class: `golden-delta-bar ${delta.score >= 0 ? "good" : "bad"}`,
      x,
      y,
      width: Math.max(5, band * 0.64),
      height: Math.max(1, h),
    });
    rect.appendChild(goldenSvg("title", {},
      `${fmtBudget(delta.budget)} ${goldenSigned(delta.score, 2)} score · ${goldenSigned(delta.pass, 0)} passed`));
    svg.appendChild(rect);
    svg.appendChild(goldenSvg("text", { class: "golden-xlabel", x: x + band * 0.32, y: H - 12, "text-anchor": "middle" }, fmtBudget(delta.budget)));
  }
  host.appendChild(svg);

  const specDeltas = specScoreDeltas(focus, baseline);
  const movers = specDeltas.slice(0, 8);
  const rows = movers.map((row) =>
    `<tr>` +
      `<td>${escapeHtml(row.name)}</td>` +
      `<td class="${row.delta >= 0 ? "good-text" : "bad-text"}">${goldenSigned(row.delta, 1)}</td>` +
      `<td>${fmtGoldenNumber(row.focus, 1)}</td>` +
      `<td>${fmtGoldenNumber(row.base, 1)}</td>` +
    `</tr>`).join("");
  host.insertAdjacentHTML("beforeend",
    `<table class="golden-mini-table">` +
      `<thead><tr><th>spec @ ${fmtBudget(specDeltas.budget ?? 0)}</th><th>delta</th><th>focus</th><th>base</th></tr></thead>` +
      `<tbody>${rows || `<tr><td colspan="4">No comparable spec scores.</td></tr>`}</tbody>` +
    `</table>`);
}

function renderGoldenMatrix(host, focus, baseline, metricKey, filter, range = null) {
  const metric = GOLDEN_METRICS[metricKey] ?? GOLDEN_METRICS.score;
  const agg = goldenAggregates(focus);
  const baseAgg = baseline ? goldenAggregates(baseline) : null;
  const budgets = budgetsInRange(focus.budgets, range);
  const filterText = filter.toLowerCase();
  let specs = [...agg.keys()];
  if (filterText) specs = specs.filter((spec) => spec.toLowerCase().includes(filterText));

  const cells = [];
  for (const spec of specs) {
    for (const budget of budgets) {
      const value = metricValue(agg.get(spec)?.get(budget), metricKey);
      if (Number.isFinite(value)) cells.push(value);
    }
  }
  const domain = metric.domain ?? [
    Math.min(...cells, 0),
    Math.max(...cells, metric.lowerBetter ? 1 : 0),
  ];
  if (domain[0] === domain[1]) domain[1] = domain[0] + 1;

  specs.sort((a, b) => {
    const lastBudget = budgets[budgets.length - 1];
    const av = metricValue(agg.get(a)?.get(lastBudget), metricKey);
    const bv = metricValue(agg.get(b)?.get(lastBudget), metricKey);
    if (baseline && baseAgg) {
      const ad = meanMetricDelta(agg, baseAgg, a, budgets, metricKey, metric.lowerBetter);
      const bd = meanMetricDelta(agg, baseAgg, b, budgets, metricKey, metric.lowerBetter);
      if (ad !== bd) return ad - bd;
    }
    if (metric.lowerBetter) return (bv ?? -Infinity) - (av ?? -Infinity);
    return (av ?? Infinity) - (bv ?? Infinity);
  });

  setText("golden-matrix-key",
    `${metric.label} · ${metric.lowerBetter ? "lower is better" : "higher is better"}` +
    (baseline ? ` · delta vs ${baseline.label}` : ""));

  if (!specs.length) {
    host.innerHTML = `<div class="golden-empty">No specs match the current filter.</div>`;
    return;
  }

  const head = `<thead><tr><th class="sticky-col">spec</th>${budgets.map((budget) =>
    `<th>${fmtBudget(budget)}</th>`).join("")}</tr></thead>`;
  const rows = specs.map((spec) => {
    const tds = budgets.map((budget) => {
      const stat = agg.get(spec)?.get(budget);
      const value = metricValue(stat, metricKey);
      const baseValue = baseAgg ? metricValue(baseAgg.get(spec)?.get(budget), metricKey) : null;
      const delta = Number.isFinite(value) && Number.isFinite(baseValue) ? value - baseValue : null;
      const normalized = clamp((value - domain[0]) / (domain[1] - domain[0]), 0, 1);
      const goodness = metric.lowerBetter ? 1 - normalized : normalized;
      const bg = goldenHeat(goodness);
      const improved = delta == null ? null : metric.lowerBetter ? delta <= 0 : delta >= 0;
      const title = `${spec} ${fmtBudget(budget)} ${metric.label}: ${metric.fmt(value)}` +
        (delta == null ? "" : ` (${goldenSigned(delta, metricKey === "pass_rate" ? 0 : 2)} vs baseline)`) +
        (stat ? `\n${stat.pass}/${stat.count} passed · missing ${fmtGoldenNumber(stat.missingSum / stat.count, 2)}` : "");
      return `<td class="golden-heat${stat?.fail ? " has-fail" : ""}" style="background:${bg}" title="${escapeHtml(title)}">` +
        `<span>${Number.isFinite(value) ? metric.fmt(value) : "—"}</span>` +
        (delta == null ? "" : `<small class="${improved ? "good-text" : "bad-text"}">${goldenSigned(delta, metricKey === "pass_rate" ? 0 : 2)}</small>`) +
      `</td>`;
    }).join("");
    return `<tr><th class="sticky-col">${escapeHtml(spec)}</th>${tds}</tr>`;
  }).join("");

  host.innerHTML = `<table class="golden-matrix">${head}<tbody>${rows}</tbody></table>`;
}

function renderGoldenCases(host, focus, baseline, filter) {
  const baseMap = baseline ? checkpointByKey(baseline) : new Map();
  const filterText = filter.toLowerCase();
  const checkpoints = runCheckpoints(focus)
    .filter((checkpoint) =>
      !filterText ||
      checkpoint.name.toLowerCase().includes(filterText) ||
      String(checkpoint.seed).includes(filterText))
    .slice()
    .sort((a, b) => {
      const af = checkpointFailed(a) ? 1 : 0;
      const bf = checkpointFailed(b) ? 1 : 0;
      if (af !== bf) return bf - af;
      if ((a.score ?? 0) !== (b.score ?? 0)) return (a.score ?? 0) - (b.score ?? 0);
      if ((a.missing ?? 0) !== (b.missing ?? 0)) return (b.missing ?? 0) - (a.missing ?? 0);
      return a.budget - b.budget;
    })
    .slice(0, 48);

  if (!checkpoints.length) {
    host.innerHTML = `<div class="golden-empty">No checkpoints match the current filter.</div>`;
    return;
  }

  const rows = checkpoints.map((checkpoint) => {
    const base = baseMap.get(checkpoint.key);
    const scoreDelta = base ? checkpoint.score - base.score : null;
    const reportUrl = workspaceUrl(checkpoint.report_path);
    const reportHref = reportUrl ? `?report=${encodeURIComponent(reportUrl)}` : "";
    const statusClass = checkpointFailed(checkpoint) ? "bad-text" : "good-text";
    return `<tr>` +
      `<td><b>${escapeHtml(checkpoint.name)}</b><span>s${checkpoint.seed} · ${escapeHtml(checkpoint.variant)}</span></td>` +
      `<td>${fmtBudget(checkpoint.budget)}</td>` +
      `<td class="${statusClass}">${escapeHtml(checkpoint.status ?? "—")}</td>` +
      `<td>${fmtGoldenNumber(checkpoint.score, 2)}</td>` +
      `<td>${scoreDelta == null ? "—" : goldenSigned(scoreDelta, 2)}</td>` +
      `<td>${checkpoint.missing ?? 0}/${checkpoint.drift ?? 0}</td>` +
      `<td>${fmtGoldenNumber(checkpoint.axis_error_rms, 3)}</td>` +
      `<td>${fmtBudget(checkpoint.compile_stats?.sim_frames ?? 0)}</td>` +
      `<td>${reportHref ? `<a href="${escapeHtml(reportHref)}">report</a>` : "—"}</td>` +
    `</tr>`;
  }).join("");

  host.innerHTML =
    `<table class="golden-cases">` +
      `<thead><tr><th>case</th><th>budget</th><th>status</th><th>score</th><th>delta</th><th>miss/drift</th><th>axis</th><th>sim</th><th></th></tr></thead>` +
      `<tbody>${rows}</tbody>` +
    `</table>`;
}

function renderGoldenCatalog(host, state) {
  const rows = state.runs.slice().reverse().map((run) => {
    const firstFull = firstFullPassBudget(run);
    const first = run.budgetScores[0];
    const last = run.budgetScores[run.budgetScores.length - 1];
    const selected = state.selectedIds.has(run.id);
    return `<tr class="${run.id === state.focusId ? "is-focus" : ""}">` +
      `<td><input type="checkbox" data-run-toggle="${escapeHtml(run.id)}"${selected ? " checked" : ""}></td>` +
      `<td><button type="button" data-focus-run="${escapeHtml(run.id)}">${escapeHtml(run.label)}</button><span>${escapeHtml(run.id)}</span></td>` +
      `<td>${fmtGoldenNumber(run.curveScore, 2)}</td>` +
      `<td>${run.canonical ? "yes" : "no"}</td>` +
      `<td>${firstFull ? fmtBudget(firstFull) : "—"}</td>` +
      `<td>${first ? `${first.passed}/${first.total}` : "—"} → ${last ? `${last.passed}/${last.total}` : "—"}</td>` +
      `<td>${run.scope.row_count ?? run.rows.length} rows · ${run.scope.checkpoint_count ?? (run.rows.length * run.budgets.length)} cp</td>` +
      `<td>${escapeHtml(run.source.commit ?? "unknown")}${run.source.dirty ? " dirty" : ""}</td>` +
    `</tr>`;
  }).join("");

  host.innerHTML =
    `<table class="golden-catalog">` +
      `<thead><tr><th></th><th>run</th><th>curve</th><th>canon</th><th>full pass</th><th>pass curve</th><th>scope</th><th>source</th></tr></thead>` +
      `<tbody>${rows}</tbody>` +
    `</table>`;

  host.querySelectorAll("[data-run-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selectedIds.add(input.dataset.runToggle);
      else state.selectedIds.delete(input.dataset.runToggle);
      renderGolden(state);
    });
  });
  host.querySelectorAll("[data-focus-run]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusId = button.dataset.focusRun;
      if (state.baselineId === state.focusId) {
        state.baselineId = defaultGoldenBaseline(state.runs, state.byId.get(state.focusId))?.id ?? "";
      }
      renderGolden(state);
    });
  });
}

function goldenAggregates(run) {
  if (run._agg) return run._agg;
  const bySpec = new Map();
  const getStat = (spec, budget) => {
    if (!bySpec.has(spec)) bySpec.set(spec, new Map());
    const byBudget = bySpec.get(spec);
    if (!byBudget.has(budget)) {
      byBudget.set(budget, {
        count: 0,
        pass: 0,
        fail: 0,
        scoreSum: 0,
        scoreSqSum: 0,
        missingSum: 0,
        driftSum: 0,
        axisErrorSum: 0,
        axisLossSum: 0,
        axisQualitySum: 0,
        elapsedMsSum: 0,
        simFramesSum: 0,
        summaryScore: null,
        summaryPassed: null,
        summaryTotal: null,
      });
    }
    return byBudget.get(budget);
  };

  for (const checkpoint of runCheckpoints(run)) {
    const stat = getStat(checkpoint.name, checkpoint.budget);
    stat.count += 1;
    if (checkpoint.contract_passed || checkpoint.status === "pass") stat.pass += 1;
    else stat.fail += 1;
    const score = checkpoint.score ?? 0;
    stat.scoreSum += score;
    stat.scoreSqSum += score * score;
    stat.missingSum += checkpoint.missing ?? 0;
    stat.driftSum += checkpoint.drift ?? 0;
    stat.axisErrorSum += checkpoint.axis_error_rms ?? 0;
    stat.axisLossSum += checkpoint.axis_loss ?? 0;
    stat.axisQualitySum += checkpoint.axis_quality ?? 0;
    stat.elapsedMsSum += checkpoint.elapsed_ms ?? 0;
    stat.simFramesSum += checkpoint.compile_stats?.sim_frames ?? 0;
  }

  for (const summary of run.budgetScores) {
    for (const spec of summary.spec_scores ?? []) {
      const stat = getStat(spec.name, summary.budget);
      stat.summaryScore = spec.score;
      stat.summaryPassed = spec.passed;
      stat.summaryTotal = spec.total;
    }
  }

  run._agg = bySpec;
  return bySpec;
}

function checkpointByKey(run) {
  if (!run._checkpointByKey) {
    run._checkpointByKey = new Map(runCheckpoints(run).map((checkpoint) => [checkpoint.key, checkpoint]));
  }
  return run._checkpointByKey;
}

function metricValue(stat, metricKey) {
  if (!stat || stat.count === 0) return NaN;
  const avg = (value) => value / stat.count;
  switch (metricKey) {
    case "score": return stat.summaryScore ?? avg(stat.scoreSum);
    case "pass_rate": {
      const passed = stat.summaryPassed ?? stat.pass;
      const total = stat.summaryTotal ?? stat.count;
      return total > 0 ? passed / total * 100 : NaN;
    }
    case "failures": return stat.summaryTotal != null && stat.summaryPassed != null
      ? stat.summaryTotal - stat.summaryPassed
      : stat.fail;
    case "missing": return avg(stat.missingSum);
    case "axis_error": return avg(stat.axisErrorSum);
    case "axis_loss": return avg(stat.axisLossSum);
    case "axis_quality": return avg(stat.axisQualitySum);
    case "sim_frames": return avg(stat.simFramesSum);
    case "elapsed": return avg(stat.elapsedMsSum) / 1000;
    case "seed_sigma": {
      const mean = avg(stat.scoreSum);
      return Math.sqrt(Math.max(0, avg(stat.scoreSqSum) - mean * mean));
    }
    default: return NaN;
  }
}

function weakestSpecs(run, budget) {
  const summary = budgetSummaryAt(run, budget);
  return (summary?.spec_scores ?? []).slice().sort((a, b) => {
    const ap = a.passed / Math.max(1, a.total);
    const bp = b.passed / Math.max(1, b.total);
    if (ap !== bp) return ap - bp;
    return a.score - b.score;
  });
}

function specScoreDeltas(focus, baseline) {
  const commonBudgets = focus.budgets.filter((budget) => baseline.budgets.includes(budget));
  const budget = commonBudgets[commonBudgets.length - 1];
  const focusSummary = budgetSummaryAt(focus, budget);
  const baseSummary = budgetSummaryAt(baseline, budget);
  const baseBySpec = new Map((baseSummary?.spec_scores ?? []).map((spec) => [spec.name, spec]));
  const deltas = (focusSummary?.spec_scores ?? [])
    .filter((spec) => baseBySpec.has(spec.name))
    .map((spec) => {
      const base = baseBySpec.get(spec.name);
      return {
        name: spec.name,
        focus: spec.score,
        base: base.score,
        delta: spec.score - base.score,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  deltas.budget = budget;
  return deltas;
}

function meanMetricDelta(focusAgg, baseAgg, spec, budgets, metricKey, lowerBetter) {
  let sum = 0;
  let count = 0;
  for (const budget of budgets) {
    const focusValue = metricValue(focusAgg.get(spec)?.get(budget), metricKey);
    const baseValue = metricValue(baseAgg.get(spec)?.get(budget), metricKey);
    if (!Number.isFinite(focusValue) || !Number.isFinite(baseValue)) continue;
    const delta = focusValue - baseValue;
    sum += lowerBetter ? -delta : delta;
    count += 1;
  }
  return count ? sum / count : 0;
}

function budgetSummaryAt(run, budget) {
  return run.budgetScores.find((summary) => summary.budget === budget) ?? null;
}

function firstFullPassBudget(run, range = null) {
  return rangeScopedSummaries(run, range).find((summary) => summary.total > 0 && summary.passed === summary.total)?.budget ?? null;
}

function largestBudgetGain(run, range = null) {
  const summaries = rangeScopedSummaries(run, range);
  let best = null;
  for (let i = 1; i < summaries.length; i++) {
    const prev = summaries[i - 1];
    const cur = summaries[i];
    const delta = cur.score - prev.score;
    if (!best || delta > best.delta) best = { prevBudget: prev.budget, budget: cur.budget, delta };
  }
  return best;
}

function defaultGoldenBaseline(runs, focus) {
  if (!focus) return null;
  const before = runs.filter((run) => run.createdMs < focus.createdMs || (run.createdMs === focus.createdMs && run.id < focus.id));
  return before.slice().reverse().find((run) => comparableGoldenRuns(run, focus)) ??
    before[before.length - 1] ??
    null;
}

function comparableGoldenRuns(a, b) {
  return a &&
    b &&
    a.evaluatorFingerprint === b.evaluatorFingerprint &&
    sameNumbers(a.budgets, b.budgets) &&
    (a.scope.seed_count ?? a.scope.seeds?.length) === (b.scope.seed_count ?? b.scope.seeds?.length);
}

function checkpointFailed(checkpoint) {
  return checkpoint.status !== "pass" || checkpoint.contract_passed === false;
}

function goldenRunColor(run, index) {
  return run.color ?? GOLDEN_RUN_COLORS[index % GOLDEN_RUN_COLORS.length];
}

// Shifted geometric mean — the exact curve_score aggregation from score.ts
// (shiftedGeometricMean(values, shift=1)). Replicated so range-scoped scores
// match the canonical metric rather than approximating it.
function goldenSgm(values, shift = 1) {
  if (!values.length) return 0;
  const logMean = values.reduce((sum, v) => {
    const safe = Number.isFinite(v) ? Math.max(0, v) : 0;
    return sum + Math.log(safe + shift);
  }, 0) / values.length;
  return Math.exp(logMean) - shift;
}

// curve_score restricted to a [min,max] budget window (null = full range).
function rangeScopedScore(run, range) {
  const summaries = rangeScopedSummaries(run, range);
  if (!summaries.length) return run.curveScore;
  return goldenSgm(summaries.map((s) => s.score));
}

function rangeScopedSummaries(run, range) {
  if (!range) return run.budgetScores;
  return run.budgetScores.filter((s) => s.budget >= range.min - 1e-6 && s.budget <= range.max + 1e-6);
}

function budgetsInRange(budgets, range) {
  if (!range) return budgets;
  return budgets.filter((b) => b >= range.min - 1e-6 && b <= range.max + 1e-6);
}

// Distinct, on-palette colors for any run count: the curated stops for <=10,
// otherwise evenly sampled along the same piecewise-linear ramp.
function goldenPalette(n) {
  if (n <= GOLDEN_RUN_COLORS.length) return GOLDEN_RUN_COLORS.slice(0, n);
  const stops = GOLDEN_RUN_COLORS.map(hexToRgb);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (stops.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(stops.length - 1, lo + 1);
    const f = t - lo;
    const mix = stops[lo].map((c, k) => Math.round(c + (stops[hi][k] - c) * f));
    return rgbToHex(mix);
  });
}

function rgbToHex(rgb) {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
}
function hexToRgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);   // hexToRgb defined below (shared with the report view)
  return `rgba(${r},${g},${b},${alpha})`;
}

// Per-budget seed spread for one run: for each budget, the min/mean/max across
// seeds of that seed's mean score over specs. Used to draw a stability band on
// the focus curve. Memoized.
function focusSeedBand(run) {
  if (run._seedBand) return run._seedBand;
  const bySeed = new Map(); // seed -> budget -> {sum,count}
  for (const cp of runCheckpoints(run)) {
    if (!bySeed.has(cp.seed)) bySeed.set(cp.seed, new Map());
    const byBudget = bySeed.get(cp.seed);
    const acc = byBudget.get(cp.budget) ?? { sum: 0, count: 0 };
    acc.sum += cp.score ?? 0;
    acc.count += 1;
    byBudget.set(cp.budget, acc);
  }
  const band = new Map(); // budget -> {min,max,mean}
  for (const budget of run.budgets) {
    const perSeed = [];
    for (const byBudget of bySeed.values()) {
      const acc = byBudget.get(budget);
      if (acc && acc.count) perSeed.push(acc.sum / acc.count);
    }
    if (perSeed.length) {
      band.set(budget, {
        min: Math.min(...perSeed),
        max: Math.max(...perSeed),
        mean: perSeed.reduce((a, b) => a + b, 0) / perSeed.length,
      });
    }
  }
  run._seedBand = band;
  return band;
}

function goldenCaseKey(name, variant, seed, budget) {
  return `${name}::${variant}::${seed}::${budget}`;
}

function parseGoldenStamp(id) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})Z/.exec(id);
  if (!match) return null;
  return Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
}

function goldenRunLabel(id, createdMs) {
  if (createdMs) {
    const iso = new Date(createdMs).toISOString();
    return `${iso.slice(5, 10)} ${iso.slice(11, 16)}Z`;
  }
  return id.replace(/^generated-?/, "").slice(0, 18);
}

function fmtBudget(value) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(Math.round(value));
}

function fmtGoldenNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(digits);
}

function goldenSigned(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toFixed(digits);
  return `${value >= 0 ? "+" : "-"}${abs}`;
}

function sameNumbers(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
}

function workspaceUrl(filePath) {
  if (!filePath) return "";
  const generatedIdx = String(filePath).indexOf("/generated/");
  if (generatedIdx >= 0) return String(filePath).slice(generatedIdx);
  if (String(filePath).startsWith("generated/")) return `/${filePath}`;
  if (String(filePath).startsWith("/")) return String(filePath);
  return `/${filePath}`;
}

function goldenHeat(goodness) {
  const clamped = clamp(goodness, 0, 1);
  const raw = clamped < 0.5
    ? mixHex("#9b3a2a", "#b58326", clamped * 2)
    : mixHex("#b58326", "#3d6b3a", (clamped - 0.5) * 2);
  return mixHex(raw, "#faf4e6", 0.64);
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = ca.map((value, i) => Math.round(value + (cb[i] - value) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function authoredSpeedToPx(speed) {
  return 5.4 + speed * (12.6 - 5.4);
}

function goldenSvg(tag, attrs = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    node.setAttribute(key, String(value));
  }
  if (text != null) node.textContent = text;
  return node;
}

// ── Landing view ─────────────────────────────────────────────────

async function mountLandingView() {
  const view = document.getElementById("landing-view");
  view.hidden = false;
  initJobForm().catch((e) => {
    console.error(e);
    setText("job-api-state", "generation unavailable");
  });
  await refreshRunsList();
}

async function refreshRunsList() {
  const list = document.getElementById("runs-list");
  list.innerHTML = "";
  try {
    const res = await fetch("/shakedown/runs.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const runs = await res.json();
    if (!runs.length) {
      list.innerHTML = `<li>No runs yet. Try <code>npm run inspect -- --track=test.track.json</code>.</li>`;
      return;
    }
    for (const r of runs) {
      const li = document.createElement("li");
      li.innerHTML =
        `<a href="?run=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a>` +
        `<div class="sub">${escapeHtml(r.track)} · ${r.duration} frames · ${r.eventCount} events` +
        (r.hasVideo ? "" : " · <i>no video</i>") +
        `<br>updated ${new Date(r.updatedAt).toLocaleString()}</div>`;
      list.appendChild(li);
    }
  } catch (e) {
    list.innerHTML = `<li>No <code>shakedown/runs.json</code> yet — run <code>npm run inspect -- --track=…</code>.</li>`;
  }
}

async function initJobForm() {
  const form = document.getElementById("job-form");
  const specSelect = document.getElementById("job-spec");
  const runInput = document.getElementById("job-run-name");
  const renderInput = document.getElementById("job-render");
  const resolutionInput = document.getElementById("job-1080p");
  const hqInput = document.getElementById("job-hq");
  const submit = document.getElementById("job-submit");

  const res = await fetch("/api/specs", { cache: "no-cache" });
  if (!res.ok) throw new Error(`specs: HTTP ${res.status}`);
  const { specs } = await res.json();

  specSelect.innerHTML = "";
  for (const spec of specs ?? []) {
    const option = document.createElement("option");
    option.value = spec.path;
    option.textContent = spec.label;
    specSelect.appendChild(option);
  }

  if (!specSelect.options.length) {
    setText("job-api-state", "no specs found");
    submit.disabled = true;
    return;
  }

  setText("job-api-state", `${specSelect.options.length} specs`);
  autofillRunName();

  runInput.addEventListener("input", () => {
    runInput.dataset.userEdited = "1";
  });
  specSelect.addEventListener("change", () => {
    if (runInput.dataset.userEdited !== "1") autofillRunName();
  });
  renderInput.addEventListener("change", syncRenderToggles);
  syncRenderToggles();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    form.classList.add("busy");
    showJobStatus({ status: "queued", logs: ["queued"] });

    try {
      const payload = {
        spec: specSelect.value,
        runName: runInput.value,
        seed: Number(document.getElementById("job-seed").value),
        budget: Number(document.getElementById("job-budget").value),
        zoom: Number(document.getElementById("job-zoom").value),
        render: renderInput.checked,
        resolution: resolutionInput.checked ? "1080p" : "720p",
        hq: hqInput.checked,
      };
      const start = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await start.json();
      if (!start.ok) throw new Error(body.error ?? `HTTP ${start.status}`);
      pollJob(body.job.id, form, submit);
    } catch (e) {
      showJobStatus({ status: "failed", error: String(e), logs: [`ERROR: ${String(e)}`] });
      form.classList.remove("busy");
      submit.disabled = false;
    }
  });

  function autofillRunName() {
    runInput.value = `${specBaseName(specSelect.value)}_${compactLocalTimestamp()}`;
  }

  function syncRenderToggles() {
    const enabled = renderInput.checked;
    resolutionInput.disabled = !enabled;
    hqInput.disabled = !enabled;
    resolutionInput.closest("label").classList.toggle("disabled", !enabled);
    hqInput.closest("label").classList.toggle("disabled", !enabled);
  }
}

async function pollJob(id, form, submit) {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-cache" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    const job = body.job;
    showJobStatus(job);
    if (job.status === "queued" || job.status === "running") {
      setTimeout(() => pollJob(id, form, submit), 1200);
    } else {
      form.classList.remove("busy");
      submit.disabled = false;
      refreshRunsList();
    }
  } catch (e) {
    showJobStatus({ status: "failed", error: String(e), logs: [`ERROR: ${String(e)}`] });
    form.classList.remove("busy");
    submit.disabled = false;
  }
}

function showJobStatus(job) {
  const box = document.getElementById("job-status");
  const state = document.getElementById("job-state");
  const log = document.getElementById("job-log");
  const links = document.getElementById("job-links");

  box.hidden = false;
  state.textContent = job.status ?? "queued";
  state.classList.toggle("good", job.status === "succeeded");
  state.classList.toggle("bad", job.status === "failed");
  log.textContent = (job.logs ?? []).join("\n");
  log.scrollTop = log.scrollHeight;

  links.innerHTML = "";
  if (job.dashboardUrl) links.appendChild(jobLink(job.dashboardUrl, "open run"));
  if (job.reportUrl) links.appendChild(jobLink(job.reportUrl, "report"));
  if (job.trackPath) links.appendChild(jobLink(job.trackPath, "track"));
  if (job.reportPath) links.appendChild(jobLink(job.reportPath, "json"));
}

function jobLink(href, label) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  return a;
}

function specBaseName(path) {
  return String(path).split("/").pop().replace(/\.ts$/, "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function compactLocalTimestamp() {
  const d = new Date();
  const parts = [
    d.getFullYear(),
    pad(d.getMonth() + 1, 2),
    pad(d.getDate(), 2),
    "_",
    pad(d.getHours(), 2),
    pad(d.getMinutes(), 2),
    pad(d.getSeconds(), 2),
  ];
  return parts.join("");
}

// ── Run view ─────────────────────────────────────────────────────

async function mountRunView(run) {
  document.getElementById("topbar").hidden = false;
  document.getElementById("run-view").hidden = false;

  const base = isDemo ? "." : `/shakedown/${encodeURIComponent(run)}`;
  const detUrl = isDemo ? "./demo-detection.json" : `${base}/detection.json`;
  const det = await fetch(detUrl, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`detection.json: HTTP ${r.status}`);
    return r.json();
  });

  const FPS = det.meta?.fps ?? 40;

  // ── Derived data ──
  const m = det.measurements;
  const N = m.speed.length;
  const speed = m.speed;
  const posY = m.position.map((p) => p.y);
  const airborne = m.airborne.map((a) => (a ? 1 : 0));
  const events = (det.events ?? []).slice().sort((a, b) => a.frame - b.frame);

  const summary = buildSummary(det, speed, posY, airborne, events, N, FPS);
  const axisReport = await loadRunAxisReport(det, run).catch((e) => {
    console.warn("axis report unavailable", e);
    return null;
  });
  const axisState = axisReport ? buildAxisLiveState(axisReport, N, FPS) : null;
  const axisLive = renderAxisLive(axisState);

  // ── Header ──
  setText("hd-run", run);
  setText("hd-track", det.meta?.track ?? "—");
  setText("hd-sampled", det.meta?.generatedAt
    ? new Date(det.meta.generatedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
    : "—");
  setText("hd-params", `K=${det.params.K} · θ=${det.params.thetaDeg}° · vStall ${det.params.vStall ?? "—"}`);
  const termGood = det.terminus.reason === "endOfSpec";
  const termChip = document.getElementById("hd-terminus");
  termChip.textContent = `${det.terminus.reason} @ ${det.terminus.frame}`;
  termChip.classList.toggle("good", termGood);
  termChip.classList.toggle("bad", !termGood);

  setText("vid-track-name", det.meta?.track ?? "—");

  // ── Video ──
  const video = document.getElementById("video");
  const videoWrap = document.getElementById("video-wrap");
  let hasVideo = false;
  let usesMuxedVideo = false;
  if (!isDemo) {
    video.preload = "auto";
    const mediaVersion = runAssetVersion(det);
    const muxedVideoUrl = cacheBustUrl(`${base}/video_with_audio.mp4`, mediaVersion);
    const plainVideoUrl = cacheBustUrl(`${base}/video.mp4`, mediaVersion);
    const [muxedInfo, plainInfo] = await Promise.all([
      mediaInfo(muxedVideoUrl),
      mediaInfo(plainVideoUrl),
    ]);
    const canCompareMediaMtime = Number.isFinite(muxedInfo.mtimeMs) && Number.isFinite(plainInfo.mtimeMs);
    usesMuxedVideo = muxedInfo.ok && (
      !plainInfo.ok ||
      !canCompareMediaMtime ||
      muxedInfo.mtimeMs >= plainInfo.mtimeMs - 1000
    );
    if (muxedInfo.ok && plainInfo.ok && !usesMuxedVideo) {
      console.warn("video_with_audio.mp4 is older than video.mp4; using video.mp4 to avoid stale muxed media");
    }
    video.src = usesMuxedVideo ? muxedVideoUrl : plainVideoUrl;
    setText("vid-track-info", `line · ${FPS} fps${usesMuxedVideo ? " · muxed audio" : ""}`);
    video.addEventListener("loadedmetadata", () => {
      hasVideo = true;
      videoWrap.classList.add("has-video");
    });
    video.addEventListener("error", () => {
      hasVideo = false;
      video.hidden = true;
    });
  } else {
    setText("vid-track-info", `line · ${FPS} fps`);
    video.hidden = true;
  }

  // ── Audio fallback (optional, synced to video) ──
  // Preferred runs use video_with_audio.mp4 above. This fallback is only for
  // older run directories that still have silent video.mp4 plus audio.mp3.
  // Small drift is corrected by nudging audio playbackRate; hard seeks are
  // reserved for real seeks or large drift, because frequent currentTime writes
  // can make the soundtrack wobble during normal playback.
  const audio = (() => {
    if (isDemo || usesMuxedVideo) return null;
    const a = new Audio(`${base}/audio.mp3`);
    a.preload = "auto";
    let audioReady = false;
    let correctionTimer = null;
    a.addEventListener("canplay", () => { audioReady = true; });
    a.addEventListener("error", () => { /* no audio for this run; fine */ });
    const sync = (force = false) => {
      if (!audioReady) return;
      const drift = a.currentTime - video.currentTime;
      if (force || Math.abs(drift) > 0.35) {
        a.currentTime = Math.min(a.duration || Infinity, video.currentTime);
        a.playbackRate = video.playbackRate;
      }
    };
    const correctDrift = () => {
      if (!audioReady || video.paused) return;
      const drift = a.currentTime - video.currentTime;
      if (Math.abs(drift) > 0.35) {
        sync(true);
      } else if (Math.abs(drift) > 0.04) {
        a.playbackRate = clamp(video.playbackRate - drift * 0.35, 0.94, 1.06);
      } else {
        a.playbackRate = video.playbackRate;
      }
    };
    video.addEventListener("play", () => {
      if (!audioReady) return;
      sync(true);
      a.play().catch(() => {});
      if (correctionTimer == null) correctionTimer = setInterval(correctDrift, 250);
    });
    video.addEventListener("pause", () => {
      a.pause();
      a.playbackRate = video.playbackRate;
      if (correctionTimer != null) {
        clearInterval(correctionTimer);
        correctionTimer = null;
      }
    });
    video.addEventListener("ended", () => {
      a.pause();
      if (correctionTimer != null) {
        clearInterval(correctionTimer);
        correctionTimer = null;
      }
    });
    video.addEventListener("seeking", () => sync(true));
    video.addEventListener("seeked", () => sync(true));
    video.addEventListener("ratechange", () => { a.playbackRate = video.playbackRate; });
    return a;
  })();
  void audio; // referenced for the lifetime of the page via event listeners

  // ── Sidebar ──
  setText("sb-run", run);
  const counts = summary.counts;
  const countParts = [`${events.length} events`];
  if (counts.landing)    countParts.push(`${counts.landing}L`);
  if (counts.bounce)     countParts.push(`${counts.bounce}B`);
  if (counts.kick)       countParts.push(`${counts.kick}K`);
  if (counts.flyThrough) countParts.push(`${counts.flyThrough}F`);
  setText("sb-counts", countParts.join(" · "));
  setText("sb-frame-total", `/ ${N}`);
  setText("sb-speed-max", `max ${summary.maxSpeed.toFixed(2)}`);
  setText("sb-ledger-total", `${events.length} total`);

  renderSummaryTiles(summary, FPS, det.terminus);
  const scoreLive = renderScoreLive(axisReport?.report ?? null, N, FPS);
  buildLedger(events, FPS);

  // ── Timeline strip ──
  const tlSvg = document.getElementById("tl-svg");
  const targetSpeed = axisState ? axisTargetSpeedSeries(axisState) : [];
  setText("tl-meta",
    `${(N / FPS).toFixed(2)}s · ${N} frames · ` +
    (targetSpeed.length ? "solid measured · dashed target · " : "") +
    "click to scrub");
  const tl = renderTimeline(tlSvg, { speed, targetSpeed, airborne, events, N, summary, FPS });

  tlSvg.addEventListener("click", (ev) => {
    const frame = tl.frameAtClient(ev.clientX);
    if (frame == null) return;
    seekTo(frame);
  });
  tlSvg.addEventListener("mousemove", (ev) => {
    const x = tl.svgXAtClient(ev.clientX);
    tl.setHover(x);
  });
  tlSvg.addEventListener("mouseleave", () => tl.setHover(null));

  function seekTo(frame) {
    const t = frame / FPS;
    if (hasVideo) {
      video.currentTime = Math.max(0, Math.min(video.duration || t, t));
    } else {
      cursorFrame = frame;
      render();
    }
  }

  // ── Cursor state + render loop ──
  let cursorFrame = 0;
  const badgesEl = document.getElementById("vid-badges");
  const flashEl  = document.getElementById("vid-flash");
  const ledgerLis = document.querySelectorAll("#sb-ledger li");

  let lastRenderedFrame = -1;
  function syncCursor() {
    cursorFrame = hasVideo ? video.currentTime * FPS : cursorFrame;
    const f = Math.floor(cursorFrame);
    if (f !== lastRenderedFrame) render();
  }

  let rafId = null;
  const rafLoop = () => {
    syncCursor();
    rafId = requestAnimationFrame(rafLoop);
  };
  if (hasVideo === false) {
    render();
  }
  video.addEventListener("timeupdate", syncCursor);
  video.addEventListener("seeked",     syncCursor);
  video.addEventListener("play",  () => { if (rafId == null) rafLoop(); });
  video.addEventListener("pause", () => { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } });
  video.addEventListener("ended", () => { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } });

  document.getElementById("sb-ledger").addEventListener("click", (ev) => {
    const li = ev.target.closest("li[data-frame]");
    if (!li) return;
    seekTo(+li.dataset.frame);
  });

  function render() {
    const f = Math.floor(cursorFrame);
    lastRenderedFrame = f;
    const tSec = f / FPS;

    setText("vid-ts-time", fmtTime(tSec));
    setText("vid-ts-frame", `frame ${pad(f, 4)} / ${N}`);
    setText("sb-time", fmtTime(tSec));
    setText("sb-frame", pad(f, 4));

    const fi = Math.min(f, N - 1);
    const sNow = speed[fi];
    setText("sb-speed", sNow.toFixed(2));
    const pct = (sNow / summary.maxSpeed) * 100;
    setText("sb-speed-pct", `${pct.toFixed(0)}% of peak`);
    document.getElementById("sb-speed-bar").style.width = `${pct}%`;

    const pNow = posY[fi];
    setText("sb-posy", Math.round(pNow).toLocaleString());
    const pPrev = posY[Math.max(0, fi - 2)];
    const descending = pNow > pPrev;
    const pdir = document.getElementById("sb-pos-dir");
    pdir.textContent = descending ? "↓ descending" : "↑ ascending";
    pdir.className = "small " + (descending ? "descending" : "ascending");

    const air = airborne[fi] === 1;
    setText("sb-air-state", air ? "yes" : "no");
    const airRow = document.getElementById("sb-air-row");
    airRow.classList.toggle("airborne", air);
    let runStart = fi;
    const target = airborne[fi];
    while (runStart > 0 && airborne[runStart - 1] === target) runStart--;
    const runLen = fi - runStart + 1;
    setText("sb-air-dur", `${runLen}f · ${(runLen / FPS).toFixed(2)}s`);

    renderProximity(events, f, FPS, seekTo);
    renderBadges(badgesEl, events, tSec, FPS);
    renderLandingFlash(flashEl, events, tSec, FPS);
    scoreLive?.update(f);
    axisLive?.update(f);

    let activeIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < events.length; i++) {
      if (events[i].frame > f) break;
      const d = f - events[i].frame;
      if (d < bestDist) { bestDist = d; activeIdx = i; }
    }
    if (bestDist > FPS / 2) activeIdx = -1;
    for (let i = 0; i < ledgerLis.length; i++) {
      ledgerLis[i].classList.toggle("active", i === activeIdx);
    }

    tl.setPlayhead(f);
  }

  render();
}

// ── Helpers ──────────────────────────────────────────────────────

function buildSummary(det, speed, posY, airborne, events, N, FPS) {
  let maxSpeed = 0, maxSpeedFrame = 0;
  for (let i = 0; i < N; i++) if (speed[i] > maxSpeed) { maxSpeed = speed[i]; maxSpeedFrame = i; }

  const counts = { landing: 0, bounce: 0, kick: 0, flyThrough: 0 };
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;

  let longestAir = 0, current = 0;
  for (let i = 0; i < N; i++) {
    if (airborne[i]) { current++; if (current > longestAir) longestAir = current; }
    else current = 0;
  }
  let airSum = 0;
  for (let i = 0; i < N; i++) airSum += airborne[i];

  // Prefer detection.summary when present (richer than what we can compute here).
  const det_s = det.summary;
  const slideSegments = det_s?.slideSegments ?? deriveSlideSegments(airborne);
  const contactFrames = det_s?.contactFrames ?? (N - airSum);
  const specFrames    = det_s?.specFrames    ?? N;
  const contactFraction = det_s?.contactFractionSpec ?? (contactFrames / specFrames);
  const longestContactRun = det_s?.longestContactRun ?? deriveLongestContact(airborne);
  const meanVxSliding  = det_s?.meanVxSliding  ?? null;
  const meanVxAirborne = det_s?.meanVxAirborne ?? null;

  return {
    maxSpeed, maxSpeedFrame,
    counts,
    longestAir, longestAirSec: longestAir / FPS,
    airPct: (airSum / N) * 100,
    descent: posY[N - 1] - posY[0],
    durationSec: N / FPS,
    slideSegments,
    contactFrames,
    specFrames,
    contactFraction,
    longestContactRun,
    meanVxSliding,
    meanVxAirborne,
  };
}

function deriveSlideSegments(airborne) {
  const segs = [];
  let start = null;
  for (let i = 0; i < airborne.length; i++) {
    if (airborne[i] === 0 && start == null) start = i;
    else if (airborne[i] === 1 && start != null) {
      segs.push({ start, end: i - 1, durationFrames: i - start });
      start = null;
    }
  }
  if (start != null) segs.push({ start, end: airborne.length - 1, durationFrames: airborne.length - start });
  return segs;
}

function deriveLongestContact(airborne) {
  let longest = 0, cur = 0;
  for (let i = 0; i < airborne.length; i++) {
    if (airborne[i] === 0) { cur++; if (cur > longest) longest = cur; }
    else cur = 0;
  }
  return longest;
}

async function loadRunAxisReport(det, run) {
  const candidates = reportCandidateUrls(det, run);
  for (const url of candidates) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) continue;
    const report = await res.json();
    const hasAxes =
      (Array.isArray(report.gaps) && report.gaps.some((g) => Object.keys(g.axes ?? {}).length)) ||
      (Array.isArray(report.sections) && report.sections.some((s) => Object.keys(s.axes ?? {}).length));
    if (hasAxes) return { url, report };
  }
  return null;
}

function reportCandidateUrls(det, run) {
  const urls = [];
  const add = (url) => {
    if (!url || urls.includes(url)) return;
    urls.push(url);
  };

  add(workspaceUrl(det.meta?.report));

  const track = det.meta?.track;
  if (track && /\.track\.json$/i.test(String(track))) {
    add(workspaceUrl(String(track).replace(/\.track\.json$/i, ".report.json")));
  }

  if (run) {
    add(`/generated/dashboard/${encodeURIComponent(run)}.report.json`);
    add(`/generated/${encodeURIComponent(run)}.report.json`);
  }
  return urls.filter(Boolean);
}

function buildAxisLiveState(axisReport, N, FPS) {
  const normalized = normalizeAxisReport(axisReport.report, N, FPS);
  const points = normalized.points.filter((p) => Object.keys(p.axes ?? {}).length);
  const present = new Set();
  for (const p of points) for (const axis of Object.keys(p.axes ?? {})) present.add(axis);
  const axes = AXIS_ORDER.filter((a) => present.has(a))
    .concat([...present].filter((a) => !AXIS_ORDER.includes(a)));
  if (!axes.length || !points.length) return null;

  const scales = {};
  for (const axis of axes) {
    const infoMax = AXIS_INFO[axis]?.max ?? 1;
    let minValue = 0;
    let maxValue = infoMax;
    for (const p of points) {
      const v = p.axes?.[axis];
      if (!v) continue;
      const target = finiteAxisValue(v.target);
      const achieved = finiteAxisValue(v.achieved);
      minValue = Math.min(minValue, target, achieved);
      maxValue = Math.max(maxValue, target, achieved);
    }
    scales[axis] = {
      min: minValue,
      max: maxValue,
      span: Math.max(0.001, maxValue - minValue),
    };
  }

  return {
    url: axisReport.url,
    kind: normalized.kind,
    points,
    axes,
    scales,
    N,
  };
}

function axisTargetSpeedSeries(state) {
  return state.points
    .map((p) => {
      const speed = p.axes?.speed;
      if (!speed) return null;
      const rawTarget = speed.raw?.target;
      const authoredTarget = speed.target;
      const value = Number.isFinite(rawTarget)
        ? rawTarget
        : Number.isFinite(authoredTarget)
          ? authoredSpeedToPx(authoredTarget)
          : null;
      if (!Number.isFinite(value)) return null;
      return {
        frameStart: p.frameStart,
        frameEnd: p.frameEnd,
        value,
        authored: authoredTarget,
      };
    })
    .filter(Boolean);
}

function renderAxisLive(state) {
  const panel = document.getElementById("axis-live");
  const rowsHost = document.getElementById("axis-rows");
  const sparkHost = document.getElementById("axis-spark");
  const reportLink = document.getElementById("axis-report-link");

  rowsHost.innerHTML = "";
  sparkHost.innerHTML = "";

  if (!state) {
    panel.hidden = true;
    reportLink.hidden = true;
    return null;
  }

  panel.hidden = false;
  reportLink.hidden = false;
  reportLink.href = `?report=${encodeURIComponent(state.url)}`;

  const rowByAxis = new Map();
  for (const axis of state.axes) {
    const info = AXIS_INFO[axis] ?? { label: axis, color: "#5d564a", max: 1 };
    const row = document.createElement("div");
    row.className = "axis-row";
    row.dataset.axis = axis;
    row.style.setProperty("--axis-color", info.color);
    row.innerHTML =
      `<div class="axis-row-top">` +
        `<span class="axis-name">${escapeHtml(info.label)}</span>` +
        `<span class="axis-values">` +
          `<span class="axis-target-val">target —</span>` +
          `<span class="axis-achieved-val">measured —</span>` +
          `<span class="axis-delta-val">Δ —</span>` +
        `</span>` +
      `</div>` +
      `<div class="axis-meter">` +
        `<div class="axis-target-fill"></div>` +
        `<i class="axis-achieved-mark"></i>` +
      `</div>`;
    rowsHost.appendChild(row);
    rowByAxis.set(axis, row);
  }

  const spark = renderAxisSpark(sparkHost, state);

  const update = (frame) => {
    for (const axis of state.axes) {
      const value = axisValueAtFrame(state, axis, frame);
      const row = rowByAxis.get(axis);
      if (!value || !row) {
        row?.classList.add("missing");
        continue;
      }
      row.classList.remove("missing");
      const target = finiteAxisValue(value.target);
      const achieved = finiteAxisValue(value.achieved);
      const delta = achieved - target;
      const scale = state.scales[axis] || { min: 0, span: 1 };
      row.querySelector(".axis-target-val").textContent =
        axisLiveValueLabel(axis, "target", target, value.raw?.target);
      row.querySelector(".axis-achieved-val").textContent =
        axisLiveValueLabel(axis, "measured", achieved, value.raw?.achieved);
      const deltaEl = row.querySelector(".axis-delta-val");
      deltaEl.textContent = axisLiveDeltaLabel(axis, delta, value.raw?.error, achieved >= target);
      deltaEl.classList.toggle("good", Math.abs(delta) <= 0.08);
      deltaEl.classList.toggle("bad", Math.abs(delta) > 0.18);
      row.querySelector(".axis-target-fill").style.width =
        `${clamp(((target - scale.min) / scale.span) * 100, 0, 100)}%`;
      row.querySelector(".axis-achieved-mark").style.left =
        `${clamp(((achieved - scale.min) / scale.span) * 100, 0, 100)}%`;
    }
    spark.setCursor(frame);
  };
  update(0);
  return { update };
}

function axisLiveValueLabel(axis, label, authoredValue, rawValue) {
  if (axis === "speed" && Number.isFinite(rawValue)) {
    return `${label} ${authoredValue.toFixed(2)} · ${rawValue.toFixed(2)} px/frame`;
  }
  return `${label} ${authoredValue.toFixed(2)}`;
}

function axisLiveDeltaLabel(axis, authoredDelta, rawError, achievedAtOrAboveTarget) {
  const signed = `${authoredDelta >= 0 ? "+" : ""}${authoredDelta.toFixed(2)}`;
  if (axis === "speed" && Number.isFinite(rawError)) {
    const rawSigned = `${achievedAtOrAboveTarget ? "+" : "-"}${Math.abs(rawError).toFixed(2)} px/frame`;
    return `Δ ${signed} · ${rawSigned}`;
  }
  return `Δ ${signed}`;
}

function renderAxisSpark(host, state) {
  const W = 360;
  const rowH = 30;
  const padL = 44, padR = 8, padT = 6, padB = 8;
  const H = padT + padB + state.axes.length * rowH;
  const innerW = W - padL - padR;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "axis-spark-svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.height = `${H}px`;
  host.appendChild(svg);

  const el = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      n.setAttribute(k, String(v));
    }
    if (text != null) n.textContent = text;
    return n;
  };

  const xAt = (frame) => padL + clamp(frame / Math.max(1, state.N - 1), 0, 1) * innerW;

  for (let i = 0; i < state.axes.length; i++) {
    const axis = state.axes[i];
    const info = AXIS_INFO[axis] ?? { label: axis, color: "#5d564a", max: 1 };
    const y0 = padT + i * rowH;
    const yMid = y0 + rowH / 2;
    const scale = state.scales[axis] || { min: 0, span: 1 };
    const yAt = (value) =>
      y0 + 4 + (1 - clamp((value - scale.min) / scale.span, 0, 1)) * (rowH - 8);

    svg.appendChild(el("text", { class: "axis-spark-label", x: padL - 8, y: yMid + 3, "text-anchor": "end" }, info.label));
    svg.appendChild(el("line", { class: "axis-spark-base", x1: padL, x2: padL + innerW, y1: yMid, y2: yMid }));

    const targetPath = axisStepPath(state.points, axis, "target", xAt, yAt);
    if (targetPath) svg.appendChild(el("path", { class: "axis-spark-target", d: targetPath, style: `stroke:${info.color}` }));
    const achievedPath = axisStepPath(state.points, axis, "achieved", xAt, yAt);
    if (achievedPath) svg.appendChild(el("path", { class: "axis-spark-achieved", d: achievedPath, style: `stroke:${info.color}` }));
  }

  const cursor = el("g", { class: "axis-spark-cursor" });
  svg.appendChild(cursor);

  return {
    setCursor(frame) {
      cursor.innerHTML = "";
      const x = xAt(frame);
      cursor.appendChild(el("line", { x1: x, x2: x, y1: padT - 2, y2: H - padB + 2 }));
    },
  };
}

function axisStepPath(points, axis, key, xAt, yAt) {
  let d = "";
  for (const p of points) {
    const value = p.axes?.[axis]?.[key];
    if (!Number.isFinite(value)) continue;
    const y = yAt(value);
    const x0 = xAt(p.frameStart);
    const x1 = xAt(p.frameEnd);
    if (!d) d = `M${x0.toFixed(2)},${y.toFixed(2)}`;
    else d += `L${x0.toFixed(2)},${y.toFixed(2)}`;
    d += `L${x1.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}

function axisValueAtFrame(state, axis, frame) {
  const active = state.points.find((p) => frame >= p.frameStart && frame <= p.frameEnd)
    ?? [...state.points].reverse().find((p) => p.frameEnd <= frame)
    ?? null;
  if (active?.axes?.[axis]) return active.axes[axis];
  const startIndex = active ? state.points.indexOf(active) : -1;
  for (let i = startIndex; i >= 0; i--) {
    const value = state.points[i]?.axes?.[axis];
    if (value) return value;
  }
  if (active !== null) return null;
  return state.points.find((p) => frame >= p.frameStart && p.axes?.[axis])?.axes?.[axis] ?? null;
}

function finiteAxisValue(value) {
  return Number.isFinite(value) ? value : 0;
}

const SCORE_TOLERANCE = {
  axis: 0.25,
  sync: 1,
  missing: 1,
  offBeat: 1,
};

function renderScoreLive(report, N, FPS) {
  const host = document.getElementById("score-live");
  if (!host) return null;
  host.innerHTML = "";

  const score = report ? scoreDriftReport(report, { totalFrames: N }) : null;
  if (!score) {
    host.hidden = true;
    return null;
  }

  host.hidden = false;
  const passed = score.contract_passed;
  const factorRows = [
    { key: "axis", label: "axis fit", value: score.axis_quality, detail: `rms ${score.axis_error_rms.toFixed(3)}` },
    { key: "sync", label: "sync", value: score.sync_quality, detail: `${score.hits}/${score.contacts} hit` },
    { key: "offbeat", label: "off-beat", value: score.off_beat_quality, detail: `${score.off_beat_landings}` },
    { key: "survival", label: "survival", value: score.survival_quality, detail: `${(score.survival_quality * 100).toFixed(0)}%` },
  ];

  host.innerHTML =
    `<div class="score-head">` +
      `<div>` +
        `<div class="label">run score</div>` +
        `<div class="score-main"><span>${Math.round(score.score)}</span><small>/1000</small></div>` +
      `</div>` +
      `<span class="score-chip ${passed ? "good" : "bad"}">${passed ? "passed" : "review"}</span>` +
    `</div>` +
    `<div class="score-bars">` +
      factorRows.map((row) =>
        `<div class="score-factor" data-factor="${row.key}">` +
          `<div class="score-factor-top">` +
            `<span>${row.label}</span>` +
            `<span>${Math.round(row.value * 100)}% · ${escapeHtml(row.detail)}</span>` +
          `</div>` +
          `<div class="score-factor-bar"><i style="width:${clamp(row.value * 100, 0, 100).toFixed(1)}%"></i></div>` +
        `</div>`
      ).join("") +
    `</div>` +
    `<div class="score-kpis">` +
      `<span>${score.axis_count} axis samples</span>` +
      `<span>max err ${score.axis_error_max.toFixed(3)}</span>` +
      `<span>${score.drift} drift</span>` +
      `<span>${score.missing} missing</span>` +
    `</div>` +
    `<div class="score-error-head">` +
      `<span class="label">error timeline</span>` +
      `<span class="small">axis error by gap</span>` +
    `</div>` +
    `<div class="score-error-spark"></div>`;

  const spark = renderScoreErrorSpark(host.querySelector(".score-error-spark"), report, N, FPS);
  return {
    update(frame) {
      spark?.setCursor(frame);
    },
  };
}

function renderScoreErrorSpark(host, report, N, FPS) {
  if (!host) return null;
  const normalized = normalizeAxisReport(report, N, FPS);
  const points = normalized.points.filter((p) => Object.keys(p.axes ?? {}).length);
  if (!points.length) {
    host.innerHTML = `<div class="score-empty">no axis error samples</div>`;
    return null;
  }

  const W = 360;
  const H = 48;
  const padL = 4, padR = 4, padT = 5, padB = 6;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxErr = Math.max(0.08, ...points.flatMap((p) =>
    Object.values(p.axes ?? {}).map((v) => Math.abs(Number(v.error) || 0))
  ));
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "score-error-svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  host.appendChild(svg);

  const el = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      n.setAttribute(k, String(v));
    }
    if (text != null) n.textContent = text;
    return n;
  };
  const xAt = (frame) => padL + clamp(frame / Math.max(1, N - 1), 0, 1) * innerW;

  svg.appendChild(el("line", {
    class: "score-error-base",
    x1: padL,
    x2: padL + innerW,
    y1: H - padB,
    y2: H - padB,
  }));

  for (const p of points) {
    const axes = AXIS_ORDER.filter((axis) => p.axes?.[axis])
      .concat(Object.keys(p.axes ?? {}).filter((axis) => !AXIS_ORDER.includes(axis)));
    const x0 = xAt(p.frameStart);
    const x1 = xAt(p.frameEnd);
    const bandW = Math.max(1.1, x1 - x0);
    const laneW = bandW / Math.max(1, axes.length);
    axes.forEach((axis, index) => {
      const err = Math.abs(Number(p.axes?.[axis]?.error) || 0);
      const h = clamp(err / maxErr, 0, 1) * innerH;
      const info = AXIS_INFO[axis] ?? { color: "#5d564a", label: axis };
      const rect = el("rect", {
        class: "score-error-bar",
        x: x0 + index * laneW,
        y: H - padB - h,
        width: Math.max(0.7, laneW - 0.35),
        height: Math.max(0.6, h),
        style: `fill:${info.color}`,
      });
      rect.appendChild(el("title", {}, `${info.label} gap ${p.gap_index}: error ${err.toFixed(3)}`));
      svg.appendChild(rect);
    });
  }

  const cursor = el("line", { class: "score-error-cursor", y1: padT - 1, y2: H - padB + 2 });
  svg.appendChild(cursor);
  return {
    setCursor(frame) {
      const x = xAt(frame);
      cursor.setAttribute("x1", x.toFixed(2));
      cursor.setAttribute("x2", x.toFixed(2));
    },
  };
}

function scoreDriftReport(report, opts = {}) {
  const contacts = Array.isArray(report?.contacts) ? report.contacts : [];
  const hits = contacts.filter((c) => c.status === "hit").length;
  const drift = contacts.filter((c) => c.status === "drift").length;
  const missing = contacts.filter((c) => c.status === "missing").length;
  const sync_score = contacts.length > 0 ? hits / contacts.length : 1;

  const landed = contacts.filter((c) => c.status !== "missing");
  const driftRms = landed.length > 0
    ? Math.sqrt(landed.reduce((sum, c) => {
      const frameError = Number.isFinite(c.frame_error) ? Math.abs(c.frame_error) : 0;
      const excess = Math.max(0, frameError - 1);
      return sum + excess * excess;
    }, 0) / landed.length)
    : 0;
  const drift_quality = Math.exp(-driftRms / SCORE_TOLERANCE.sync);
  const missing_quality = Math.exp(-missing / SCORE_TOLERANCE.missing);
  const sync_quality = drift_quality * missing_quality;

  const axes = axisScoreDetails(report);
  const axis_count = axes.length;
  const axis_error_total = axes.reduce((sum, a) => sum + Math.abs(a.error), 0);
  const axis_error_mean = axis_count > 0 ? axis_error_total / axis_count : 0;
  const axis_error_max = axes.reduce((max, a) => Math.max(max, Math.abs(a.error)), 0);
  const axis_error_rms = axis_count > 0
    ? Math.sqrt(axes.reduce((sum, a) => sum + a.error * a.error, 0) / axis_count)
    : 0;
  const axis_loss = axis_count > 0 ? axis_error_rms / SCORE_TOLERANCE.axis : 0;
  const axis_quality = Math.exp(-axis_loss);

  const off_beat_landings = Array.isArray(report?.off_beat_landings) ? report.off_beat_landings.length : 0;
  const off_beat_quality = Math.exp(-off_beat_landings / SCORE_TOLERANCE.offBeat);

  const reachedEnd = report?.terminus?.reason === "endOfSpec";
  const survival_quality = reachedEnd
    ? 1
    : opts.totalFrames > 0
      ? clamp((Number(report?.terminus?.frame) || 0) / opts.totalFrames, 0, 1)
      : 0;

  const hard_failures = [];
  if (drift > 0 || missing > 0) hard_failures.push(`sync:${drift}drift/${missing}missing`);
  if (!reachedEnd) hard_failures.push(`died:${report?.terminus?.reason ?? "unknown"}@${report?.terminus?.frame ?? "?"}`);
  if (off_beat_landings > 0) hard_failures.push(`offBeat:${off_beat_landings}`);

  return {
    score: 1000 * axis_quality * drift_quality * missing_quality * off_beat_quality * survival_quality,
    contract_passed: hard_failures.length === 0,
    hard_failures,
    contacts: contacts.length,
    hits,
    drift,
    missing,
    sync_score,
    drift_quality,
    missing_quality,
    sync_quality,
    off_beat_landings,
    off_beat_quality,
    survival_quality,
    axis_count,
    axis_error_total,
    axis_error_mean,
    axis_error_max,
    axis_error_rms,
    axis_loss,
    axis_quality,
  };
}

function axisScoreDetails(report) {
  const source = Array.isArray(report?.gaps) && report.gaps.length
    ? report.gaps
    : Array.isArray(report?.sections)
      ? report.sections
      : [];
  const out = [];
  for (const row of source) {
    for (const [axis, value] of Object.entries(row.axes ?? {})) {
      const error = Number.isFinite(value.error)
        ? value.error
        : Math.abs((Number(value.target) || 0) - (Number(value.achieved) || 0));
      out.push({
        gap_index: row.gap_index ?? row.section_index ?? 0,
        axis,
        target: value.target,
        achieved: value.achieved,
        error,
      });
    }
  }
  return out;
}

function renderSummaryTiles(s, FPS, terminus) {
  const host = document.getElementById("sb-summary");
  const goodContact = s.contactFraction >= 0.4;
  const goodSlide   = s.longestContactRun >= 40;
  const goodTerm    = terminus.reason === "endOfSpec";

  const meanVx = s.meanVxSliding != null
    ? s.meanVxSliding.toFixed(2)
    : "—";
  const meanVxSub = s.meanVxAirborne != null
    ? `air ${s.meanVxAirborne.toFixed(2)}`
    : "";

  const tile = (label, value, sub, klass) =>
    `<div class="tile ${klass || ""}">` +
      `<div class="t-label">${label}</div>` +
      `<div class="t-value">${value}</div>` +
      `<div class="t-sub">${sub}</div>` +
    `</div>`;

  host.innerHTML =
    tile("sliding",     `${(s.contactFraction * 100).toFixed(1)}%`,
         `${s.contactFrames} / ${s.specFrames}f`, goodContact ? "good" : "bad") +
    tile("longest slide", `${(s.longestContactRun / FPS).toFixed(2)}s`,
         `${s.longestContactRun}f · ${s.slideSegments.length} segs`, goodSlide ? "good" : "bad") +
    tile("mean vx",     meanVx, meanVxSub) +
    tile("survived",    goodTerm ? "yes" : "no",
         `${terminus.reason}`, goodTerm ? "good" : "bad");
}

function buildLedger(events, FPS) {
  const ol = document.getElementById("sb-ledger");
  ol.innerHTML = "";
  events.forEach((e, i) => {
    const li = document.createElement("li");
    li.className = `t-${e.type}`;
    li.dataset.frame = e.frame;
    li.innerHTML =
      `<span class="idx">${pad(i + 1, 2)}</span>` +
      `<span class="type">${e.type}</span>` +
      `<span class="meta">f${e.frame} · ${(e.frame / FPS).toFixed(2)}s</span>` +
      `<span class="detail">${eventDetail(e)}</span>`;
    ol.appendChild(li);
  });
}

function eventDetail(e) {
  if (e.type === "kick") {
    return `${e.angleDeg > 0 ? "+" : ""}${e.angleDeg.toFixed(1)}°`;
  }
  if (e.type === "flyThrough") {
    return `${(e.contactFraction * 100).toFixed(0)}% · T${e.frame - e.airborneFrom}`;
  }
  return `T${e.frame - e.airborneFrom}`;
}

function renderProximity(events, cursorFrame, FPS, onSeek) {
  const last = events.filter((e) => e.frame <= cursorFrame).slice(-1)[0];
  const next = events.find((e) => e.frame > cursorFrame);
  const host = document.getElementById("sb-proximity");
  host.innerHTML = "";
  const rows = [
    last && { kind: "last", e: last, arrow: "←", sign: "−", dt: (cursorFrame - last.frame) / FPS },
    next && { kind: "next", e: next, arrow: "→", sign: "+", dt: (next.frame - cursorFrame) / FPS },
  ].filter(Boolean);
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = `prox-row t-${r.e.type}`;
    row.dataset.frame = r.e.frame;
    row.innerHTML =
      `<span class="arrow">${r.arrow}</span>` +
      `<div>` +
        `<div class="head">${r.e.type} · ${eventDetail(r.e)}</div>` +
        `<div class="sub">f${r.e.frame} · ${(r.e.frame / FPS).toFixed(2)}s</div>` +
      `</div>` +
      `<span class="delta">${r.sign}${r.dt.toFixed(2)}s</span>`;
    row.addEventListener("click", () => onSeek(r.e.frame));
    row.style.cursor = "pointer";
    host.appendChild(row);
  }
}

function renderBadges(badgesEl, events, tSec, FPS) {
  const PRE = 0.03, POST = 0.35;
  const active = [];
  for (const e of events) {
    const dt = tSec - e.frame / FPS;
    if (dt >= -PRE && dt <= POST) {
      const op = dt < 0 ? 1 : Math.max(0, 1 - dt / POST);
      active.push({ e, op });
    }
  }
  const want = new Map(active.map((a) => [`${a.e.frame}-${a.e.type}`, a]));
  for (const child of [...badgesEl.children]) {
    if (!want.has(child.dataset.key)) child.remove();
  }
  for (const [key, a] of want) {
    let el = badgesEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = `vid-badge t-${a.e.type}`;
      el.dataset.key = key;
      const sub = badgeSub(a.e);
      el.innerHTML = `<span>${a.e.type}</span><span class="sub">${sub}</span>`;
      badgesEl.appendChild(el);
    }
    el.style.opacity = a.op.toFixed(2);
    el.style.transform = `scale(${(0.92 + 0.1 * a.op).toFixed(3)})`;
  }
}

function badgeSub(e) {
  if (e.type === "kick") return `${e.angleDeg > 0 ? "+" : ""}${e.angleDeg.toFixed(0)}°`;
  if (e.type === "flyThrough") return `${(e.contactFraction * 100).toFixed(0)}%`;
  return `T${e.frame - e.airborneFrom}`;
}

function renderLandingFlash(flashEl, events, tSec, FPS) {
  const POST = 0.35;
  let strongest = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    const dt = tSec - e.frame / FPS;
    if (dt < -0.03 || dt > POST) continue;
    const op = dt < 0 ? 1 : Math.max(0, 1 - dt / POST);
    if (op > strongest) strongest = op;
  }
  if (strongest > 0) {
    const w = 14 * strongest;
    flashEl.style.boxShadow = `inset 0 0 ${w * 4}px ${w}px rgba(155, 58, 42, ${(0.55 * strongest).toFixed(2)})`;
  } else {
    flashEl.style.boxShadow = "inset 0 0 0 0 transparent";
  }
}

// ── Timeline SVG renderer ────────────────────────────────────────

function renderTimeline(svg, { speed, targetSpeed = [], airborne, events, N, summary, FPS }) {
  const W = 944, H = 236;
  const padL = 60, padR = 14;
  const innerW = W - padL - padR;

  // Vertical bands
  const top = 14;
  const speedH = 96;
  const speedY = top;                  // 14..110
  const airH = 10;
  const airY = speedY + speedH + 6;    // 116..126
  const lanesY = airY + airH + 10;     // 146
  // 4 lanes (kick / bounce / landing / flyThrough)
  const laneStep = 16;
  const lanesH = laneStep * 4;         // 64 → 146..210
  const rulerY = lanesY + lanesH + 4;  // 214

  const xAtFrame = (f) => padL + (f / (N - 1)) * innerW;

  // Downsample speed for SVG path
  const TARGET = 480;
  const step = Math.max(1, Math.floor(N / TARGET));
  const speedPts = [];
  for (let i = 0; i < N; i += step) speedPts.push({ i, v: speed[i] });
  if (speedPts[speedPts.length - 1].i !== N - 1) speedPts.push({ i: N - 1, v: speed[N - 1] });

  const sMin = 0;
  const targetSpeedMax = Math.max(0, ...targetSpeed.map((p) => p.value).filter(Number.isFinite));
  const sMax = Math.max(summary.maxSpeed, targetSpeedMax, 1);
  const speedYAt = (v) => speedY + 4 + (1 - (v - sMin) / (sMax - sMin || 1)) * (speedH - 8);

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      n.setAttribute(k, String(v));
    }
    if (text != null) n.textContent = text;
    return n;
  };

  // Track labels
  svg.appendChild(el("text", { class: "track-label", x: padL - 10, y: speedY + 14, "text-anchor": "end" }, "SPEED"));
  svg.appendChild(el("text", { class: "track-meta",  x: padL - 10, y: speedY + speedH - 6, "text-anchor": "end" }, summary.maxSpeed.toFixed(2)));
  svg.appendChild(el("text", { class: "track-label", x: padL - 10, y: airY + 10, "text-anchor": "end" }, "AIR"));

  // Slide-segment bands across the SPEED track (sled in contact = sliding).
  for (const seg of summary.slideSegments) {
    const x0 = xAtFrame(seg.start);
    const x1 = xAtFrame(Math.min(seg.end + 1, N - 1));
    svg.appendChild(el("rect", {
      class: "slide-band",
      x: x0, y: speedY,
      width: Math.max(0.6, x1 - x0),
      height: speedH,
    }));
  }

  // Speed grid (horiz quartile lines)
  for (const g of [0.25, 0.5, 0.75]) {
    const y = speedY + 4 + g * (speedH - 8);
    svg.appendChild(el("line", { class: "axis-rule", x1: padL, x2: padL + innerW, y1: y, y2: y }));
  }

  // Event vertical rules across speed track
  for (const e of events) {
    const x = xAtFrame(e.frame);
    svg.appendChild(el("line", { class: `evt-rule t-${e.type}`, x1: x, x2: x, y1: speedY, y2: speedY + speedH }));
  }

  // Speed area + measured line
  let d = "";
  for (let k = 0; k < speedPts.length; k++) {
    const x = xAtFrame(speedPts[k].i);
    const y = speedYAt(speedPts[k].v);
    d += (k === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
  }
  const lastX = xAtFrame(N - 1);
  const baseY = speedY + speedH - 4;
  svg.appendChild(el("path", { class: "speed-area", d: d + `L${lastX.toFixed(2)},${baseY}L${padL.toFixed(2)},${baseY}Z` }));
  const dt = stepPath(targetSpeed, xAtFrame, speedYAt, N);
  if (dt) {
    const targetPath = el("path", { class: "target-speed-line", d: dt });
    targetPath.appendChild(el("title", {}, "target speed in raw px/frame, held over each report gap"));
    svg.appendChild(targetPath);
  }
  svg.appendChild(el("path", { class: "speed-line", d }));

  // Peak callout
  const pkX = xAtFrame(summary.maxSpeedFrame);
  const pkY = speedYAt(summary.maxSpeed);
  svg.appendChild(el("circle", { class: "peak-dot", cx: pkX, cy: pkY, r: 3 }));
  svg.appendChild(el("text", {
    class: "peak-text",
    x: pkX + (summary.maxSpeedFrame > N * 0.85 ? -6 : 6),
    y: pkY - 4,
    "text-anchor": summary.maxSpeedFrame > N * 0.85 ? "end" : "start",
  }, `peak ${summary.maxSpeed.toFixed(2)}`));

  // Airborne base + runs
  svg.appendChild(el("rect", { class: "air-base", x: padL, y: airY, width: innerW, height: airH }));
  let runStart = null;
  for (let i = 0; i < N; i++) {
    if (airborne[i] === 1 && runStart == null) runStart = i;
    else if (airborne[i] === 0 && runStart != null) {
      const x = xAtFrame(runStart);
      const w = xAtFrame(i) - x;
      svg.appendChild(el("rect", { class: "air-run", x, y: airY, width: Math.max(0.5, w), height: airH }));
      runStart = null;
    }
  }
  if (runStart != null) {
    const x = xAtFrame(runStart);
    const w = xAtFrame(N) - x;
    svg.appendChild(el("rect", { class: "air-run", x, y: airY, width: w, height: airH }));
  }
  svg.appendChild(el("line", { class: "lane-rule", x1: padL, x2: padL + innerW, y1: airY + airH, y2: airY + airH }));

  // Swim lanes — kick / bounce / landing / flyThrough
  const lanes = [
    { type: "kick",       y: lanesY +  8, color: COLORS.kick,       label: "kick" },
    { type: "bounce",     y: lanesY + 24, color: COLORS.bounce,     label: "bounce" },
    { type: "landing",    y: lanesY + 40, color: COLORS.landing,    label: "landing" },
    { type: "flyThrough", y: lanesY + 56, color: COLORS.flyThrough, label: "flythru" },
  ];
  for (const ln of lanes) {
    svg.appendChild(el("line", { class: "lane-rule", x1: padL, x2: padL + innerW, y1: ln.y, y2: ln.y }));
    const lab = el("text", { class: "lane-label", x: padL - 10, y: ln.y + 3.5, "text-anchor": "end" }, ln.label);
    lab.style.fill = ln.color;
    svg.appendChild(lab);
    const count = events.filter((e) => e.type === ln.type).length;
    svg.appendChild(el("text", { class: "lane-count", x: padL + innerW + 4, y: ln.y + 3.5 }, String(count)));
  }
  for (const e of events) {
    const ln = lanes.find((l) => l.type === e.type);
    if (!ln) continue;
    const x = xAtFrame(e.frame);
    let mag;
    if (e.type === "kick") {
      mag = Math.min(7, 2.5 + Math.abs(e.angleDeg) / 8);
    } else if (e.type === "flyThrough") {
      mag = Math.min(7, 2.5 + (e.contactFraction ?? 0) * 5);
    } else {
      mag = Math.min(7, 2.5 + (e.frame - e.airborneFrom) / 7);
    }
    const halo = el("circle", { cx: x, cy: ln.y, r: mag });
    halo.style.fill = ln.color; halo.style.fillOpacity = 0.22;
    svg.appendChild(halo);
    const dot = el("circle", { cx: x, cy: ln.y, r: Math.max(1.4, mag - 1.3) });
    dot.style.fill = ln.color;
    svg.appendChild(dot);
  }

  // Time ruler
  const totalSec = Math.ceil(N / FPS);
  for (let s = 0; s <= totalSec; s++) {
    const x = xAtFrame(s * FPS);
    const major = s % 5 === 0;
    svg.appendChild(el("line", { class: "ruler-tick", x1: x, x2: x, y1: rulerY, y2: rulerY + (major ? 6 : 3) }));
    if (major) {
      svg.appendChild(el("text", { class: "ruler-label", x: x, y: rulerY + 17, "text-anchor": "middle" }, `${s}s`));
    }
  }

  // Dynamic layer
  const hoverG = el("g", { id: "tl-hover-g" });
  svg.appendChild(hoverG);
  const playG = el("g", { id: "tl-play-g" });
  svg.appendChild(playG);

  return {
    setHover(svgX) {
      hoverG.innerHTML = "";
      if (svgX == null || svgX < padL || svgX > padL + innerW) return;
      hoverG.appendChild(el("line", {
        class: "hover-line",
        x1: svgX, x2: svgX, y1: speedY, y2: rulerY + 6,
      }));
    },
    setPlayhead(frame) {
      playG.innerHTML = "";
      const x = xAtFrame(Math.max(0, Math.min(N - 1, frame)));
      playG.appendChild(el("line", {
        class: "playhead", x1: x, x2: x, y1: speedY - 6, y2: rulerY + 6,
      }));
      playG.appendChild(el("polygon", {
        class: "playhead-cap",
        points: `${x - 4},${speedY - 10} ${x + 4},${speedY - 10} ${x},${speedY - 4}`,
      }));
    },
    svgXAtClient(clientX) {
      const r = svg.getBoundingClientRect();
      return (clientX - r.left) * (W / r.width);
    },
    frameAtClient(clientX) {
      const x = this.svgXAtClient(clientX);
      if (x < padL || x > padL + innerW) return null;
      return Math.round(((x - padL) / innerW) * (N - 1));
    },
  };
}

function stepPath(series, xAtFrame, yAt, N) {
  let d = "";
  for (const p of series) {
    if (!Number.isFinite(p.value)) continue;
    const x0 = xAtFrame(clamp(p.frameStart, 0, N - 1));
    const x1 = xAtFrame(clamp(p.frameEnd, 0, N - 1));
    const y = yAt(p.value);
    if (!d) d = `M${x0.toFixed(2)},${y.toFixed(2)}`;
    else d += `L${x0.toFixed(2)},${y.toFixed(2)}`;
    d += `L${x1.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}

// ── Utilities ────────────────────────────────────────────────────

function runAssetVersion(det) {
  const parts = [
    det?.meta?.generatedAt,
    det?.meta?.trackHash,
    det?.meta?.track,
    det?.measurements?.speed?.length,
  ].filter((v) => v != null && v !== "");
  return simpleHash(parts.length ? parts.join("|") : String(Date.now()));
}

function cacheBustUrl(url, version) {
  const u = new URL(url, location.href);
  u.searchParams.set("v", version);
  return u.pathname + u.search + u.hash;
}

function simpleHash(value) {
  let h = 2166136261;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

async function mediaInfo(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return {
      ok: res.ok,
      url,
      mtimeMs: Number(res.headers.get("X-File-MTime-Ms") ?? NaN),
      size: Number(res.headers.get("Content-Length") ?? NaN),
    };
  } catch {
    return { ok: false, url, mtimeMs: NaN, size: NaN };
  }
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el && el.textContent !== txt) el.textContent = txt;
}
function pad(n, w) { return String(n).padStart(w, "0"); }
function fmtTime(s) {
  const mm = Math.floor(s / 60);
  const ss = (s - mm * 60).toFixed(2).padStart(5, "0");
  return `${mm}:${ss}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
