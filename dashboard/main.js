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

  const FPS = det.meta?.fps ?? 40;

  // ── Derived data ──
  const m = det.measurements;
  const N = m.speed.length;
  const speed = m.speed;
  const posY = m.position.map((p) => p.y);
  const airborne = m.airborne.map((a) => (a ? 1 : 0));
  const events = (det.events ?? []).slice().sort((a, b) => a.frame - b.frame);

  const summary = buildSummary(det, speed, posY, airborne, events, N, FPS);

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
  setText("vid-track-info", `line · ${FPS} fps`);

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

  // ── Audio (optional, synced to video) ──
  // Convention: if `shakedown/<run>/audio.mp3` exists, the dashboard treats
  // it as the soundtrack and mirrors video playback onto it. The audio
  // element is hidden (no separate controls); video controls drive both.
  // Drift correction every second keeps them within ~50ms.
  const audio = (() => {
    if (isDemo) return null;
    const a = new Audio(`${base}/audio.mp3`);
    a.preload = "auto";
    let audioReady = false;
    a.addEventListener("canplay", () => { audioReady = true; });
    a.addEventListener("error", () => { /* no audio for this run; fine */ });
    const sync = () => {
      if (!audioReady) return;
      if (Math.abs(a.currentTime - video.currentTime) > 0.05) {
        a.currentTime = Math.min(a.duration || Infinity, video.currentTime);
      }
    };
    video.addEventListener("play", () => { if (audioReady) { sync(); a.play().catch(() => {}); } });
    video.addEventListener("pause", () => a.pause());
    video.addEventListener("seeking", sync);
    video.addEventListener("seeked", sync);
    video.addEventListener("ratechange", () => { a.playbackRate = video.playbackRate; });
    // Drift correction during steady playback.
    setInterval(() => { if (!video.paused) sync(); }, 1000);
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
  buildLedger(events, FPS);

  // ── Timeline strip ──
  const tlSvg = document.getElementById("tl-svg");
  setText("tl-meta", `${(N / FPS).toFixed(2)}s · ${N} frames · click to scrub`);
  const tl = renderTimeline(tlSvg, { speed, airborne, events, N, summary, FPS });

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

function renderTimeline(svg, { speed, airborne, events, N, summary, FPS }) {
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
  const sMax = summary.maxSpeed;
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
