/**
 * Dashboard — synchronized video + measurement plots + event markers.
 *
 * URL: /dashboard/?run=<name>  ⇒  loads /shakedown/<name>/{detection.json, video.mp4}
 * URL: /dashboard/             ⇒  landing page; lists /shakedown/runs.json entries.
 *
 * Cursor sync: video.timeupdate → uPlot setCursor; canvas click → set video.currentTime.
 */

const FPS = 40;
const COLORS = {
  landing: "#e94f4f",
  bounce: "#f0c252",
  kick: "#5da8ff",
  flyThrough: "#8a92a6",
  speed: "#7ad57a",
  vx: "#ffb347",
  vy: "#c099f0",
  airborne: "#5da8ff",
  pos: "#8a92a6",
};

const params = new URLSearchParams(location.search);
const runName = params.get("run");

if (runName) {
  mountRunView(runName).catch((e) => {
    console.error(e);
    document.body.innerHTML =
      `<pre style="padding:24px;color:#e94f4f">Failed to load run "${runName}":\n${String(e)}</pre>`;
  });
} else {
  mountLandingView();
}

// ── Landing view ─────────────────────────────────────────────────────────

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
        `<a href="?run=${encodeURIComponent(r.name)}">${escape(r.name)}</a>` +
        `<div class="sub">${escape(r.track)} · ${r.duration} frames · ${r.eventCount} events` +
        (r.hasVideo ? "" : " · <i>no video</i>") +
        `<br>updated ${new Date(r.updatedAt).toLocaleString()}</div>`;
      list.appendChild(li);
    }
  } catch (e) {
    list.innerHTML = `<li>No <code>shakedown/runs.json</code> yet — run <code>npm run inspect -- --track=…</code>.</li>`;
  }
}

// ── Run view ─────────────────────────────────────────────────────────────

async function mountRunView(run) {
  document.getElementById("run-view").hidden = false;
  document.getElementById("run-label").textContent = `· ${run}`;

  const base = `/shakedown/${encodeURIComponent(run)}`;
  const det = await fetch(`${base}/detection.json`, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`detection.json: HTTP ${r.status}`);
    return r.json();
  });

  // Wire video.
  const video = document.getElementById("video");
  video.src = `${base}/video.mp4`;
  video.addEventListener("error", () => {
    video.replaceWith(Object.assign(document.createElement("div"), {
      style: "padding:14px;color:#8a92a6;border:1px dashed #2a2f3a;border-radius:4px",
      textContent: "no video.mp4 in this run (run inspect with --render).",
    }));
  });

  // Build measurement arrays.
  const m = det.measurements;
  const N = m.speed.length;
  const t = new Float64Array(N);
  for (let i = 0; i < N; i++) t[i] = i / FPS;
  const speed = Float64Array.from(m.speed);
  const vx = Float64Array.from(m.velocity, (v) => v.x);
  const vy = Float64Array.from(m.velocity, (v) => v.y);
  const airborne = Float64Array.from(m.airborne, (a) => (a ? 1 : 0));
  const posY = Float64Array.from(m.position, (p) => p.y);

  // Meta line.
  const meta = document.getElementById("meta");
  meta.textContent =
    `${N} frames · ${(N / FPS).toFixed(2)} s · ` +
    `terminus: ${det.terminus.reason} @ ${det.terminus.frame} · ` +
    `K=${det.params.K} θ=${det.params.thetaDeg}°`;

  // Top-line stats strip — the headline numbers the user cares about.
  const sm = det.summary;
  const stats = document.getElementById("stats");
  const goodContact = sm.contactFractionSpec >= 0.4;
  const goodSlide = sm.longestContactRun >= 40; // ~1 second
  const goodTerm = det.terminus.reason === "endOfSpec";
  const statHtml = (label, value, sub, klass = "") =>
    `<div class="stat"><div class="label">${label}</div>` +
    `<div class="value ${klass}">${value}</div>` +
    `<div class="sub">${sub}</div></div>`;
  stats.innerHTML = [
    statHtml(
      "sliding (% of spec)",
      `${(sm.contactFractionSpec * 100).toFixed(1)}%`,
      `${sm.contactFrames} / ${sm.specFrames} frames`,
      goodContact ? "good" : "bad",
    ),
    statHtml(
      "longest slide",
      `${(sm.longestContactRun / FPS).toFixed(2)}s`,
      `${sm.longestContactRun} frames · ${sm.slideSegments.length} segments`,
      goodSlide ? "good" : "bad",
    ),
    statHtml(
      "mean vx (sliding)",
      sm.meanVxSliding.toFixed(2),
      `airborne mean: ${sm.meanVxAirborne.toFixed(2)}`,
    ),
    statHtml(
      "ride survived",
      goodTerm ? "yes" : "no",
      `${det.terminus.reason} @ f=${det.terminus.frame}`,
      goodTerm ? "good" : "bad",
    ),
  ].join("");

  // Sort events for the marker overlay + the list.
  const events = (det.events ?? []).slice().sort((a, b) => a.frame - b.frame);

  // Event-marker uPlot plugin: draws colored vertical lines on every plot.
  const eventMarkers = (events) => ({
    hooks: {
      draw: [
        (u) => {
          const { ctx } = u;
          const top = u.bbox.top;
          const bot = u.bbox.top + u.bbox.height;
          ctx.save();
          for (const e of events) {
            const x = u.valToPos(e.frame / FPS, "x", true);
            if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) continue;
            ctx.strokeStyle = COLORS[e.type] ?? "#fff";
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bot);
            ctx.stroke();
          }
          ctx.restore();
        },
      ],
    },
  });

  // Slide-segment plugin: fills green bands during contiguous in-contact
  // intervals. Visually, you scan this chart and immediately see "is the
  // rider actually riding, or is it all freefall and corpse?"
  const slideBands = (segments) => ({
    hooks: {
      draw: [
        (u) => {
          const { ctx } = u;
          const top = u.bbox.top;
          const height = u.bbox.height;
          ctx.save();
          ctx.fillStyle = COLORS.speed;
          ctx.globalAlpha = 0.18;
          for (const seg of segments) {
            const x0 = u.valToPos(seg.start / FPS, "x", true);
            const x1 = u.valToPos((seg.end + 1) / FPS, "x", true);
            ctx.fillRect(x0, top, Math.max(1, x1 - x0), height);
          }
          ctx.restore();
        },
      ],
    },
  });

  const chartsHost = document.getElementById("charts");
  const baseOpts = (title, fmt = (v) => v?.toFixed?.(2) ?? "") => ({
    title,
    width: chartsHost.clientWidth || 800,
    height: 140,
    cursor: { sync: { key: "dash", setSeries: true } },
    scales: { x: { time: false } },
    axes: [
      {
        stroke: "#8a92a6",
        grid: { stroke: "#2a2f3a" },
        values: (_u, vals) => vals.map((v) => `${v.toFixed(2)}s`),
      },
      { stroke: "#8a92a6", grid: { stroke: "#2a2f3a" }, values: (_u, vals) => vals.map(fmt) },
    ],
    series: [
      {},
      { label: title, stroke: COLORS.speed, width: 1, points: { show: false } },
    ],
    plugins: [slideBands(sm.slideSegments), eventMarkers(events)],
  });

  const dataSpeed = [t, speed];
  const dataVx = [t, vx];
  const dataVy = [t, vy];
  const dataPosY = [t, posY];
  void airborne; // info is conveyed by slideBands plugin instead

  const charts = [];
  function makeChart(host, opts, data) {
    const el = document.createElement("div");
    el.className = "chart";
    host.appendChild(el);
    const u = new uPlot(opts, data, el);
    charts.push(u);
    el.addEventListener("click", (ev) => {
      const rect = el.getBoundingClientRect();
      const xPx = ev.clientX - rect.left - u.bbox.left / devicePixelRatio;
      const tSec = u.posToVal(xPx, "x");
      if (Number.isFinite(tSec)) video.currentTime = Math.max(0, tSec);
    });
    return u;
  }

  const speedChart = makeChart(chartsHost, baseOpts("|v|  (speed, units / frame · green = sliding)"), dataSpeed);

  const vxOpts = baseOpts("vx (horizontal velocity)");
  vxOpts.series[1].stroke = COLORS.vx;
  makeChart(chartsHost, vxOpts, dataVx);

  const vyOpts = baseOpts("vy (vertical velocity — +y is down)");
  vyOpts.series[1].stroke = COLORS.vy;
  makeChart(chartsHost, vyOpts, dataVy);

  const posYOpts = baseOpts("position.y");
  posYOpts.series[1].stroke = COLORS.pos;
  posYOpts.scales = { ...posYOpts.scales, y: { auto: true } };
  posYOpts.height = 90;
  makeChart(chartsHost, posYOpts, dataPosY);

  // Resize charts on window resize.
  window.addEventListener("resize", () => {
    const w = chartsHost.clientWidth;
    for (const u of charts) u.setSize({ width: w, height: u.height });
  });

  // Video time → uPlot cursor + on-video event overlay.
  const badgesEl = document.getElementById("badges");
  const flashEl = document.getElementById("flash");

  const syncToTime = (tSec) => {
    const xPx = speedChart.valToPos(tSec, "x", false);
    for (const u of charts) {
      u.setCursor({ left: xPx, top: u.height / 2 }, false);
    }
    updateEventListCursor(tSec);
    updateVideoOverlay(tSec);
  };

  video.addEventListener("timeupdate", () => syncToTime(video.currentTime));
  video.addEventListener("seeked",     () => syncToTime(video.currentTime));

  // requestAnimationFrame loop while playing — timeupdate fires only ~4×/s in
  // some browsers, too slow for a flash with a 250ms lifetime.
  let rafId = null;
  const rafLoop = () => {
    syncToTime(video.currentTime);
    rafId = requestAnimationFrame(rafLoop);
  };
  video.addEventListener("play",  () => { if (rafId == null) rafLoop(); });
  video.addEventListener("pause", () => { if (rafId != null) cancelAnimationFrame(rafId); rafId = null; });
  video.addEventListener("ended", () => { if (rafId != null) cancelAnimationFrame(rafId); rafId = null; });

  function updateVideoOverlay(tSec) {
    const fNow = tSec * FPS;
    // Show every event whose "active window" includes the current time.
    // Window: [event_time - 30ms, event_time + 350ms]. Slight lead-in for
    // perceptual alignment, then a fade-out tail.
    const PRE_MS = 30, POST_MS = 350;
    const active = [];
    for (const e of events) {
      const dtSec = tSec - e.frame / FPS;
      if (dtSec >= -PRE_MS / 1000 && dtSec <= POST_MS / 1000) {
        const op = dtSec < 0 ? 1 : Math.max(0, 1 - dtSec / (POST_MS / 1000));
        active.push({ e, op, dtSec });
      }
    }

    // Render badges — diff against existing for steady DOM (avoid full innerHTML
    // churn at 60fps which thrashes the GPU).
    const want = new Map(active.map((a) => [`${a.e.frame}-${a.e.type}`, a]));
    // Remove badges no longer wanted
    for (const child of [...badgesEl.children]) {
      if (!want.has(child.dataset.key)) child.remove();
    }
    // Add / update
    for (const [key, a] of want) {
      let el = badgesEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!el) {
        el = document.createElement("div");
        el.className = `evt-badge t-${a.e.type}`;
        el.dataset.key = key;
        let sub;
        if (a.e.type === "kick") sub = `${a.e.angleDeg.toFixed(0)}°`;
        else if (a.e.type === "flyThrough") sub = `${(a.e.contactFraction * 100).toFixed(0)}%`;
        else sub = `T=${a.e.frame - a.e.airborneFrom}`;
        el.innerHTML = `<span class="lbl">${a.e.type.toUpperCase()}</span><span class="sub">${sub}</span>`;
        badgesEl.appendChild(el);
      }
      el.style.opacity = a.op.toFixed(2);
      el.style.transform = `scale(${(0.9 + 0.3 * a.op).toFixed(3)})`;
    }

    // Flash the frame for landings (the "big" event). Inset box-shadow.
    let strongest = null;
    for (const a of active) {
      if (a.e.type === "landing" && (!strongest || a.op > strongest.op)) strongest = a;
    }
    if (strongest) {
      const w = (12 * strongest.op).toFixed(1);
      flashEl.style.boxShadow = `inset 0 0 ${w * 4}px ${w}px rgba(233, 79, 79, ${(0.5 * strongest.op).toFixed(2)})`;
    } else {
      flashEl.style.boxShadow = "inset 0 0 0 0 transparent";
    }
  }

  // Render the event list panel.
  const ol = document.getElementById("event-ol");
  ol.innerHTML = "";
  for (const e of events) {
    const li = document.createElement("li");
    li.className = `t-${e.type}`;
    li.dataset.frame = e.frame;
    const tSec = (e.frame / FPS).toFixed(3);
    let detail;
    if (e.type === "kick") detail = `Δ${e.angleDeg.toFixed(1)}°`;
    else if (e.type === "flyThrough") detail = `from f=${e.airborneFrom} · contact ${(e.contactFraction * 100).toFixed(0)}%`;
    else detail = `from f=${e.airborneFrom} (T=${e.frame - e.airborneFrom})`;
    li.innerHTML =
      `<b>${e.type}</b> f=${e.frame} <span style="color:#8a92a6">${tSec}s</span> ${detail}`;
    li.addEventListener("click", () => { video.currentTime = e.frame / FPS; });
    ol.appendChild(li);
  }

  function updateEventListCursor(tSec) {
    const fNow = tSec * FPS;
    let bestIdx = -1;
    let bestDelta = Infinity;
    const lis = ol.children;
    for (let i = 0; i < lis.length; i++) {
      const f = +lis[i].dataset.frame;
      const d = Math.abs(f - fNow);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
      lis[i].classList.remove("cursor");
    }
    if (bestIdx >= 0 && bestDelta < FPS / 4) lis[bestIdx].classList.add("cursor");
  }
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
