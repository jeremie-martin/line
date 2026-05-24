/**
 * line · dashboard — cockpit
 *
 * URL: ?run=<name>          ⇒ loads /shakedown/<name>/{detection.json, video.mp4}
 * URL: ?demo=1              ⇒ loads ./demo-detection.json (no video)
 * URL: (no params)          ⇒ landing page; lists /shakedown/runs.json entries.
 *
 * Cursor sync: video time → cursor → all UI; timeline click → video.currentTime.
 * rAF loop runs while video plays so badge timing isn't bottlenecked by the
 * browser's ~4Hz `timeupdate` cadence.
 */

const FPS = 40;

const COLORS = {
  landing: "#9b3a2a",
  bounce:  "#b58326",
  kick:    "#1e5a6e",
  ink:     "#1f1a14",
  inkMid:  "#5d564a",
  inkFade: "#928873",
  rule:    "#cdbfa3",
  ruleSoft:"#ddd0b2",
  paperWarm:"#ede4d0",
  air:     "#8a9a78",
  accent:  "#9b3a2a",
};

const params  = new URLSearchParams(location.search);
const runName = params.get("run");
const isDemo  = params.get("demo") === "1";

if (runName || isDemo) {
  mountRunView(runName || "demo").catch((e) => {
    console.error(e);
    document.body.innerHTML =
      `<pre style="padding:24px;color:#9b3a2a;font-family:monospace">
Failed to load run "${runName || "demo"}":\n${String(e)}</pre>`;
  });
} else {
  mountLandingView();
}

// ── Landing view ─────────────────────────────────────────────────

async function mountLandingView() {
  const view = document.getElementById("landing-view");
  view.hidden = false;
  const list = document.getElementById("runs-list");
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

  // ── Derived data ──
  const m = det.measurements;
  const N = m.speed.length;
  const speed = m.speed;
  const posY = m.position.map((p) => p.y);
  const airborne = m.airborne.map((a) => (a ? 1 : 0));
  const events = (det.events ?? []).slice().sort((a, b) => a.frame - b.frame);

  const summary = computeSummary(speed, posY, airborne, events, N);

  // ── Header ──
  setText("hd-run", run);
  setText("hd-track", det.meta?.track ?? "—");
  setText("hd-sampled", det.meta?.generatedAt
    ? new Date(det.meta.generatedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
    : "—");
  setText("hd-params", `K=${det.params.K} · θ=${det.params.thetaDeg}° · vStall ${det.params.vStall ?? "—"}`);
  setText("hd-terminus", `${det.terminus.reason} @ ${det.terminus.frame}`);

  setText("vid-track-name", det.meta?.track ?? "—");

  // ── Video ──
  const video = document.getElementById("video");
  const videoWrap = document.getElementById("video-wrap");
  let hasVideo = false;
  if (!isDemo) {
    video.src = `${base}/video.mp4`;
    video.addEventListener("loadedmetadata", () => {
      hasVideo = true;
      videoWrap.classList.add("has-video");
    });
    video.addEventListener("error", () => {
      hasVideo = false;
      video.hidden = true;
    });
  } else {
    video.hidden = true;
  }

  // ── Sidebar ──
  setText("sb-run", run);
  setText("sb-counts", `${events.length} events · ${summary.counts.landing}L · ${summary.counts.bounce}B · ${summary.counts.kick}K`);
  setText("sb-frame-total", `/ ${N}`);
  setText("sb-speed-max", `max ${summary.maxSpeed.toFixed(2)}`);
  setText("sb-ledger-total", `${events.length} total`);

  buildLedger(events);

  // ── Timeline strip ──
  const tlSvg = document.getElementById("tl-svg");
  setText("tl-meta", `${(N / FPS).toFixed(2)}s · ${N} frames · click to scrub`);
  const tl = renderTimeline(tlSvg, { speed, airborne, events, N, summary });

  // Click to scrub
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
  const ledgerLis = document.querySelectorAll("#sb-ledger li");

  function syncCursor() {
    cursorFrame = hasVideo ? video.currentTime * FPS : cursorFrame;
    render();
  }

  let rafId = null;
  const rafLoop = () => {
    syncCursor();
    rafId = requestAnimationFrame(rafLoop);
  };
  if (hasVideo === false) {
    // Demo mode + missing video: no auto-play; user scrubs via timeline.
    render();
  }
  video.addEventListener("timeupdate", syncCursor);
  video.addEventListener("seeked",     syncCursor);
  video.addEventListener("play",  () => { if (rafId == null) rafLoop(); });
  video.addEventListener("pause", () => { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } });
  video.addEventListener("ended", () => { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } });

  // Click an event in the ledger to seek
  document.getElementById("sb-ledger").addEventListener("click", (ev) => {
    const li = ev.target.closest("li[data-frame]");
    if (!li) return;
    seekTo(+li.dataset.frame);
  });

  function render() {
    const f = Math.floor(cursorFrame);
    const tSec = f / FPS;

    // Video overlay timestamp + frame
    setText("vid-ts-time", fmtTime(tSec));
    setText("vid-ts-frame", `frame ${pad(f, 4)} / ${N}`);

    // Sidebar time + frame
    setText("sb-time", fmtTime(tSec));
    setText("sb-frame", pad(f, 4));

    // Speed
    const fi = Math.min(f, N - 1);
    const sNow = speed[fi];
    setText("sb-speed", sNow.toFixed(2));
    const pct = (sNow / summary.maxSpeed) * 100;
    setText("sb-speed-pct", `${pct.toFixed(0)}% of peak`);
    document.getElementById("sb-speed-bar").style.width = `${pct}%`;

    // Position.y + direction
    const pNow = posY[fi];
    setText("sb-posy", Math.round(pNow).toLocaleString());
    const pPrev = posY[Math.max(0, fi - 2)];
    const descending = pNow > pPrev;
    const pdir = document.getElementById("sb-pos-dir");
    pdir.textContent = descending ? "↓ descending" : "↑ ascending";
    pdir.className = "small " + (descending ? "descending" : "ascending");

    // Airborne
    const air = airborne[fi] === 1;
    setText("sb-air-state", air ? "yes" : "no");
    const airRow = document.getElementById("sb-air-row");
    airRow.classList.toggle("airborne", air);
    // Length of current run
    let runStart = fi;
    const target = airborne[fi];
    while (runStart > 0 && airborne[runStart - 1] === target) runStart--;
    const runLen = fi - runStart + 1;
    setText("sb-air-dur", `${runLen}f · ${(runLen / FPS).toFixed(2)}s`);

    // Nearby events
    renderProximity(events, f);

    // Firing badges over video
    renderBadges(badgesEl, events, tSec);

    // Active ledger row
    let activeIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < events.length; i++) {
      if (events[i].frame > f) break;
      const d = f - events[i].frame;
      if (d < bestDist) { bestDist = d; activeIdx = i; }
    }
    if (bestDist > FPS / 2) activeIdx = -1; // only highlight if within ~0.5s
    for (let i = 0; i < ledgerLis.length; i++) {
      ledgerLis[i].classList.toggle("active", i === activeIdx);
    }

    // Playhead
    tl.setPlayhead(f);
  }

  render();
}

// ── Helpers ──────────────────────────────────────────────────────

function computeSummary(speed, posY, airborne, events, N) {
  let maxSpeed = 0, maxSpeedFrame = 0;
  for (let i = 0; i < N; i++) if (speed[i] > maxSpeed) { maxSpeed = speed[i]; maxSpeedFrame = i; }
  const counts = { landing: 0, bounce: 0, kick: 0 };
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  let longestAir = 0, current = 0;
  for (let i = 0; i < N; i++) {
    if (airborne[i]) { current++; if (current > longestAir) longestAir = current; }
    else current = 0;
  }
  let airSum = 0;
  for (let i = 0; i < N; i++) airSum += airborne[i];
  return {
    maxSpeed, maxSpeedFrame,
    counts,
    longestAir, longestAirSec: longestAir / FPS,
    airPct: (airSum / N) * 100,
    descent: posY[N - 1] - posY[0],
    durationSec: N / FPS,
  };
}

function buildLedger(events) {
  const ol = document.getElementById("sb-ledger");
  ol.innerHTML = "";
  events.forEach((e, i) => {
    const li = document.createElement("li");
    li.className = `t-${e.type}`;
    li.dataset.frame = e.frame;
    const detail = e.type === "kick"
      ? `${e.angleDeg > 0 ? "+" : ""}${e.angleDeg.toFixed(1)}°`
      : `T${e.frame - e.airborneFrom}`;
    li.innerHTML =
      `<span class="idx">${pad(i + 1, 2)}</span>` +
      `<span class="type">${e.type}</span>` +
      `<span class="meta">f${e.frame} · ${(e.frame / FPS).toFixed(2)}s</span>` +
      `<span class="detail">${detail}</span>`;
    ol.appendChild(li);
  });
}

function renderProximity(events, cursorFrame) {
  const last = events.filter((e) => e.frame <= cursorFrame).slice(-1)[0];
  const next = events.find((e) => e.frame > cursorFrame);
  const host = document.getElementById("sb-proximity");
  host.innerHTML = "";
  const rows = [
    last && { kind: "last", e: last, arrow: "←", sign: "−", dt: (cursorFrame - last.frame) / FPS },
    next && { kind: "next", e: next, arrow: "→", sign: "+", dt: (next.frame - cursorFrame) / FPS },
  ].filter(Boolean);
  for (const r of rows) {
    const detail = r.e.type === "kick"
      ? `${r.e.angleDeg > 0 ? "+" : ""}${r.e.angleDeg.toFixed(1)}°`
      : `T${r.e.frame - r.e.airborneFrom}`;
    const row = document.createElement("div");
    row.className = `prox-row t-${r.e.type}`;
    row.dataset.frame = r.e.frame;
    row.innerHTML =
      `<span class="arrow">${r.arrow}</span>` +
      `<div>` +
        `<div class="head">${r.e.type} · ${detail}</div>` +
        `<div class="sub">f${r.e.frame} · ${(r.e.frame / FPS).toFixed(2)}s</div>` +
      `</div>` +
      `<span class="delta">${r.sign}${r.dt.toFixed(2)}s</span>`;
    row.addEventListener("click", () => {
      const v = document.getElementById("video");
      v.currentTime = r.e.frame / FPS;
    });
    row.style.cursor = "pointer";
    host.appendChild(row);
  }
}

function renderBadges(badgesEl, events, tSec) {
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
  // remove
  for (const child of [...badgesEl.children]) {
    if (!want.has(child.dataset.key)) child.remove();
  }
  // add / update
  for (const [key, a] of want) {
    let el = badgesEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = `vid-badge t-${a.e.type}`;
      el.dataset.key = key;
      const sub = a.e.type === "kick"
        ? `${a.e.angleDeg > 0 ? "+" : ""}${a.e.angleDeg.toFixed(0)}°`
        : `T${a.e.frame - a.e.airborneFrom}`;
      el.innerHTML = `<span>${a.e.type}</span><span class="sub">${sub}</span>`;
      badgesEl.appendChild(el);
    }
    el.style.opacity = a.op.toFixed(2);
    el.style.transform = `scale(${(0.92 + 0.1 * a.op).toFixed(3)})`;
  }
}

// ── Timeline SVG renderer ────────────────────────────────────────

function renderTimeline(svg, { speed, airborne, events, N, summary }) {
  // Static viewBox 944×220; static elements draw once, dynamic (playhead,
  // hover) get dedicated <g> elements we mutate.
  const W = 944, H = 220;
  const padL = 60, padR = 14;
  const innerW = W - padL - padR;

  // Vertical bands (mirror direction-cockpit.jsx)
  const top = 14;
  const speedH = 96;
  const speedY = top;                  // 14..110
  const airH = 10;
  const airY = speedY + speedH + 6;    // 116..126
  const lanesY = airY + airH + 10;     // 146
  const lanesH = 50;                   // 146..196
  const rulerY = lanesY + lanesH + 4;  // 200

  const xAtFrame = (f) => padL + (f / (N - 1)) * innerW;

  // Downsample speed for SVG path (no need for 1200+ points)
  const TARGET = 480;
  const step = Math.max(1, Math.floor(N / TARGET));
  const speedPts = [];
  for (let i = 0; i < N; i += step) speedPts.push({ i, v: speed[i] });
  // ensure last point included
  if (speedPts[speedPts.length - 1].i !== N - 1) speedPts.push({ i: N - 1, v: speed[N - 1] });

  // Y mapping for speed
  const sMin = 0;
  const sMax = summary.maxSpeed;
  const speedYAt = (v) => speedY + 4 + (1 - (v - sMin) / (sMax - sMin || 1)) * (speedH - 8);

  // Clear & rebuild
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

  // Speed area + line
  let d = "";
  for (let k = 0; k < speedPts.length; k++) {
    const x = xAtFrame(speedPts[k].i);
    const y = speedYAt(speedPts[k].v);
    d += (k === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
  }
  const lastX = xAtFrame(N - 1);
  const baseY = speedY + speedH - 4;
  svg.appendChild(el("path", { class: "speed-area", d: d + `L${lastX.toFixed(2)},${baseY}L${padL.toFixed(2)},${baseY}Z` }));
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

  // Airborne base
  svg.appendChild(el("rect", { class: "air-base", x: padL, y: airY, width: innerW, height: airH }));
  // Airborne runs
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

  // Swim lanes
  const lanes = [
    { type: "kick",    y: lanesY +  8, color: COLORS.kick,    label: "kick" },
    { type: "bounce",  y: lanesY + 25, color: COLORS.bounce,  label: "bounce" },
    { type: "landing", y: lanesY + 42, color: COLORS.landing, label: "landing" },
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
    const x = xAtFrame(e.frame);
    const mag = e.type === "kick"
      ? Math.min(7, 2.5 + Math.abs(e.angleDeg) / 8)
      : Math.min(7, 2.5 + (e.frame - e.airborneFrom) / 7);
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

  // Dynamic layer (hover + playhead) — stays on top
  const hoverG = el("g", { id: "tl-hover-g" });
  svg.appendChild(hoverG);
  const playG = el("g", { id: "tl-play-g" });
  svg.appendChild(playG);

  // Public mutators
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

// ── Utilities ────────────────────────────────────────────────────

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
