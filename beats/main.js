/**
 * beats · dashboard
 *
 * Loads both detection.json (v1: HPSS multi-band heuristic) and
 * detection_stems.json (v2: Demucs-stem-based onsets, plus v3 drum-band split).
 * Lets you switch the audio source between the mix and each isolated stem so
 * you can hear what each onset stream actually corresponds to.
 */

const COLORS = {
  env:      "#5d564a",
  beat:     "#1e5a6e",
  drums:    "#9b3a2a",
  bass:     "#b58326",
  vocals:   "#3d3a78",
  other:    "#6a6a3a",
  kick:     "#5a2018",
  snare:    "#b04b30",
  hat:      "#6a8a78",
  tom:      "#7a4422",
  cymbal:   "#9e864a",
  accent:   "#9b3a2a",
  ink:      "#1f1a14",
  rule:     "#cdbfa3",
  ruleSoft: "#ddd0b2",
  playhead: "#1f1a14",
};

const SECTION_TINTS = [
  "rgba(155,58,42,0.06)", "rgba(30,90,110,0.06)", "rgba(181,131,38,0.07)",
  "rgba(61,58,120,0.06)", "rgba(138,154,120,0.07)", "rgba(155,58,42,0.10)",
  "rgba(30,90,110,0.10)", "rgba(181,131,38,0.11)", "rgba(61,58,120,0.10)",
  "rgba(138,154,120,0.11)",
];

const ZOOM_HALF_WIDTH_S = 4.0;

// ---------- DOM refs -----------------------------------------------------

const audio    = document.getElementById("audio");
const overview = document.getElementById("overview");
const zoom     = document.getElementById("zoom");

const flash = {
  kick:   document.getElementById("flash-kick"),
  snare:  document.getElementById("flash-snare"),
  hat:    document.getElementById("flash-hat"),
  bass:   document.getElementById("flash-stem-bass"),
  vocals: document.getElementById("flash-stem-vocals"),
  beat:   document.getElementById("flash-beat"),
};

const t = (id) => document.getElementById(id);
const tog = {
  sections:   t("t-sections"),
  beats:      t("t-beats"),
  downbeats:  t("t-downbeats"),
  spec:       t("t-spec"),
  env:        t("t-env"),
  drums:      t("t-drums"),
  bass:       t("t-bass"),
  stemDrums:  t("t-stem-drums"),
  stemBass:   t("t-stem-bass"),
  stemVocals: t("t-stem-vocals"),
  stemOther:  t("t-stem-other"),
  kick:       t("t-kick"),
  snare:      t("t-snare"),
  hat:        t("t-hat"),
  rnnMix:     t("t-rnn-mix"),
  rnnDrums:   t("t-rnn-drums"),
  adtKick:    t("t-adt-kick"),
  adtSnare:   t("t-adt-snare"),
  adtHat:     t("t-adt-hat"),
  adtTom:     t("t-adt-tom"),
  adtCymbal:  t("t-adt-cymbal"),
  consensus:     t("t-consensus"),
  corrRnnDrums:  t("t-corr-rnn-drums"),
  corrStemDrums: t("t-corr-stem-drums"),
  corrStemBass:  t("t-corr-stem-bass"),
  corrBandKick:  t("t-corr-band-kick"),
  corrBandSnare: t("t-corr-band-snare"),
  corrBandHat:   t("t-corr-band-hat"),
  corrKick:      t("t-corr-kick"),
  corrSnare:     t("t-corr-snare"),
  corrHat:       t("t-corr-hat"),
  corrDropped:   t("t-corr-dropped"),
};
const click = {
  beat:      t("c-beat"),
  downbeat:  t("c-downbeat"),
  kick:      t("c-kick"),
  snare:     t("c-snare"),
  hat:       t("c-hat"),
  useADT:    t("c-adt"),  // when on, click sounds come from ADTOF, not v3 bands
  consensus: t("c-consensus"),
};

const voteCheckboxes = document.querySelectorAll(".vote");
const voteSlider     = t("s-votes");
const voteValEl      = t("v-votes");
const windowSlider   = t("s-window");
const windowValEl    = t("v-window");

// Re-render whenever consensus controls change. Sliders + vote toggles both fire.
[voteSlider, windowSlider, ...voteCheckboxes].forEach(el => {
  el.addEventListener("input", () => {
    voteValEl.textContent   = voteSlider.value;
    windowValEl.textContent = windowSlider.value;
    consensusCache = null;
    render();
  });
});

let det1 = null;  // detection.json (librosa)
let det2 = null;  // detection_stems.json (Demucs stems)
let detM = null;  // detection_madmom.json (madmom RNN onsets + DBN downbeats)
let detA = null;  // detection_adtof.json (ADTOF kick/snare/hat/tom/cymbal model)
let detC = null;  // detection_corrected.json (grid-snapped streams)
let spec = null;  // { meta, img } — mel-spectrogram backdrop

// Consensus computation is pure JS — recomputed on demand from sliders/votes.
let consensusCache = null;

/** Aggregate kept onsets from selected streams; output events that got
 *  enough votes. Time keys are bucketed at 1 ms; an optional "match window"
 *  expands a vote to neighbouring buckets so streams that are close-but-not-equal
 *  can still cluster. */
function computeConsensus() {
  if (consensusCache) return consensusCache;
  if (!detC) return [];
  const enabled = [...voteCheckboxes].filter(c => c.checked).map(c => c.dataset.key);
  const minVotes = parseInt(voteSlider.value, 10);
  const windowMs = parseInt(windowSlider.value, 10);

  // Collect (time_ms_int, stream) pairs from enabled streams' kept onsets.
  const events = [];
  for (const key of enabled) {
    const s = detC.streams[key];
    if (!s) continue;
    for (const k of s.kept) events.push({ ms: Math.round(k.t * 1000), src: key });
  }
  events.sort((a, b) => a.ms - b.ms);

  // Cluster within ±windowMs (no window ⇒ exact integer ms key).
  const clusters = [];
  for (const e of events) {
    const last = clusters[clusters.length - 1];
    if (last && (e.ms - last.first_ms) <= windowMs) {
      last.times.push(e.ms);
      last.sources.add(e.src);
    } else {
      clusters.push({ first_ms: e.ms, times: [e.ms], sources: new Set([e.src]) });
    }
  }

  const out = [];
  for (const c of clusters) {
    if (c.sources.size >= minVotes) {
      // Take the median time among the votes — robust to outliers.
      c.times.sort((a, b) => a - b);
      const med = c.times[Math.floor(c.times.length / 2)] / 1000;
      out.push({ t: med, votes: c.sources.size, sources: [...c.sources] });
    }
  }
  consensusCache = out;
  return out;
}

// per-stream last-played indices (for flash + click)
const lastIdx = {};

// ---------- load ---------------------------------------------------------

Promise.all([
  fetch("detection.json").then(r => r.json()),
  fetch("detection_stems.json").then(r => r.json()),
  fetch("detection_madmom.json").then(r => r.json()),
  fetch("detection_adtof.json").then(r => r.ok ? r.json() : null).catch(() => null),
  fetch("detection_corrected.json").then(r => r.ok ? r.json() : null).catch(() => null),
]).then(([d1, d2, dm, da, dc]) => {
  det1 = d1; det2 = d2; detM = dm; detA = da; detC = dc;

  // Prefer madmom's beats/BPM as canonical
  const bar = dm.downbeats.length >= 2 ? (dm.downbeats[dm.downbeats.length-1] - dm.downbeats[0]) / (dm.downbeats.length - 1) : 0;
  const bpm = bar > 0 ? 60 * (dm.meter || 4) / bar : d1.tempo_bpm;
  document.getElementById("hd-bpm").textContent =
    `${bpm.toFixed(2)}  (librosa ${d1.tempo_bpm.toFixed(2)})`;
  document.getElementById("hd-beats").textContent = dm.beats.length;
  document.getElementById("hd-downbeats").textContent = `${dm.downbeats.length} · ${dm.meter}/4`;
  document.getElementById("hd-sections").textContent = (d1.sections || []).length;

  audio.src = "audio.mp3";
  overviewMeta();
  resize();
  render();
});

// Spectrogram is best-effort — if the PNG hasn't been generated yet
// (run `python extract_spectrogram.py`), the dashboard still works.
fetch("spectrogram.json")
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(meta => new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res({ meta, img });
    img.onerror = rej;
    img.src = meta.image;
  }))
  .then(s => { spec = s; render(); })
  .catch(() => {});

function overviewMeta() {
  if (!det1 || !det2 || !detM) return;
  const cls = detA ? detA.classes : null;
  const c = detC ? detC.streams : null;
  document.getElementById("overview-meta").textContent =
    `dur ${fmt(det1.duration)} · v2 drums ${det2.stems.drums.count} bass ${det2.stems.bass.count}`
    + ` · v3 kick ${det2.drum_bands.kick.count} snare ${det2.drum_bands.snare.count} hat ${det2.drum_bands.hat.count}`
    + ` · v4 RNN ${detM.onsets_mix.length}/${detM.onsets_drums.length}`
    + (cls ? ` · v5 ADTOF k${cls.kick.length} s${cls.snare.length} h${cls.hat.length} t${cls.tom.length} c${cls.cymbal.length}` : "")
    + (c ? ` · v6 corrected rnn_drums ${c.rnn_drums.kept_count}/${c.rnn_drums.kept_count + c.rnn_drums.dropped_count}` : "");
}

// ---------- source switcher ---------------------------------------------

document.getElementById("src-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".src-tab");
  if (!btn) return;
  const wasPlaying = !audio.paused;
  const wasTime = audio.currentTime;
  for (const b of document.querySelectorAll(".src-tab")) b.classList.remove("active");
  btn.classList.add("active");
  audio.src = btn.dataset.src;
  audio.addEventListener("loadedmetadata", function once() {
    audio.removeEventListener("loadedmetadata", once);
    audio.currentTime = wasTime;
    if (wasPlaying) audio.play();
  });
});

// Toggles trigger re-render
[...Object.values(tog)].forEach((el) => el.addEventListener("change", render));

audio.addEventListener("seeking", () => {
  for (const k of Object.keys(lastIdx)) lastIdx[k] = -1;
});

// ---------- rAF loop ----------------------------------------------------

requestAnimationFrame(function loop() {
  if (det1 && det2) {
    tickFlashes();
    render();
  }
  requestAnimationFrame(loop);
});

// ---------- click track --------------------------------------------------

let ac = null;
function getAC() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  return ac;
}
function clickTone(freq, dur = 0.04, type = "square", gain = 0.15) {
  const c = getAC();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}
function clickKick() {
  // Pitched sine sweep — chest thump
  const c = getAC();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.08);
  g.gain.setValueAtTime(0.5, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.13);
}
function clickSnare() {
  // White noise burst
  const c = getAC();
  const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  const g = c.createGain();
  s.buffer = buf;
  g.gain.value = 0.25;
  s.connect(g).connect(c.destination);
  s.start();
}
function clickHat() {
  clickTone(8000, 0.02, "square", 0.08);
}
function clickBeat() {
  clickTone(660, 0.04, "square", 0.15);
}
function clickDownbeat() {
  // Lower & louder than a regular beat — the "ONE" of the bar
  clickTone(440, 0.06, "square", 0.28);
}

// ---------- flashes / clicks --------------------------------------------

function tickFlashes() {
  const tNow = audio.currentTime;
  const lit = (el) => { el.classList.add("lit"); setTimeout(() => el.classList.remove("lit"), 70); };

  // Click source selector: ADTOF (model) or v3 bands (heuristic).
  // When ADTOF data is available and the "use ADTOF" toggle is on,
  // kick/snare/hat clicks fire on the model output instead of the band heuristic.
  const useADT = click.useADT && click.useADT.checked && detA;
  const adt = detA ? detA.classes : null;

  const streams = [
    { key: "beat",       times: detM.beats,                              el: flash.beat,   click: click.beat,     fire: clickBeat,    show: tog.beats.checked },
    { key: "downbeat",   times: detM.downbeats,                          el: null,         click: click.downbeat, fire: clickDownbeat,show: tog.downbeats.checked },
    { key: "stemDrums",  times: det2.stems.drums.onsets.map(o => o.t),   el: flash.kick,   click: null,           fire: null,         show: tog.stemDrums.checked },
    { key: "stemBass",   times: det2.stems.bass.onsets.map(o => o.t),    el: flash.bass,   click: null,           fire: null,         show: tog.stemBass.checked },
    { key: "stemVocals", times: det2.stems.vocals.onsets.map(o => o.t),  el: flash.vocals, click: null,           fire: null,         show: tog.stemVocals.checked },
    // v3 band heuristic — click only when not using ADTOF
    { key: "kick",       times: det2.drum_bands.kick.onsets.map(o => o.t),  el: flash.kick,  click: useADT ? null : click.kick,   fire: clickKick,    show: tog.kick.checked },
    { key: "snare",      times: det2.drum_bands.snare.onsets.map(o => o.t), el: flash.snare, click: useADT ? null : click.snare,  fire: clickSnare,   show: tog.snare.checked },
    { key: "hat",        times: det2.drum_bands.hat.onsets.map(o => o.t),   el: flash.hat,   click: useADT ? null : click.hat,    fire: clickHat,     show: tog.hat.checked },
    // v5 ADTOF model — click only when using ADTOF
    ...(adt ? [
      { key: "adtKick",   times: adt.kick.map(h => h.t),   el: flash.kick,  click: useADT ? click.kick  : null, fire: clickKick,  show: tog.adtKick.checked },
      { key: "adtSnare",  times: adt.snare.map(h => h.t),  el: flash.snare, click: useADT ? click.snare : null, fire: clickSnare, show: tog.adtSnare.checked },
      { key: "adtHat",    times: adt.hat.map(h => h.t),    el: flash.hat,   click: useADT ? click.hat   : null, fire: clickHat,   show: tog.adtHat.checked },
      { key: "adtTom",    times: adt.tom.map(h => h.t),    el: null,        click: null,                        fire: null,       show: tog.adtTom.checked },
      { key: "adtCymbal", times: adt.cymbal.map(h => h.t), el: null,        click: null,                        fire: null,       show: tog.adtCymbal.checked },
    ] : []),
    // v7 consensus — its own click; flashes none (it's the unified output)
    { key: "consensus", times: computeConsensus().map(c => c.t), el: null, click: click.consensus, fire: clickKick, show: tog.consensus && tog.consensus.checked },
  ];

  for (const s of streams) {
    if (!(s.key in lastIdx)) lastIdx[s.key] = -1;
    let i = lastIdx[s.key];
    while (i + 1 < s.times.length && s.times[i + 1] <= tNow) {
      i++;
      if (s.show && s.el) lit(s.el);
      if (s.click && s.click.checked && s.fire) s.fire();
    }
    lastIdx[s.key] = i;
  }
}

// ---------- canvas -------------------------------------------------------

function resize() {
  for (const c of [overview, zoom]) {
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width  = Math.max(1, Math.floor(r.width * dpr));
    c.height = Math.max(1, Math.floor(r.height * dpr));
  }
}
window.addEventListener("resize", () => { resize(); render(); });

function render() {
  if (!det1 || !det2) return;
  const tNow = audio.currentTime || 0;
  document.getElementById("hd-time").textContent = fmt(tNow);

  const secs = det1.sections || [];
  const cur = secs.findIndex(s => tNow >= s.start && tNow < s.end);
  document.getElementById("hd-section").textContent =
    cur >= 0 ? `§ ${cur + 1}/${secs.length}  ${fmt(secs[cur].start)}–${fmt(secs[cur].end)}` : "—";

  drawStrip(overview, 0, det1.duration, tNow, /*dense*/ true);
  const t0 = Math.max(0, tNow - ZOOM_HALF_WIDTH_S);
  const t1 = Math.min(det1.duration, tNow + ZOOM_HALF_WIDTH_S);
  drawStrip(zoom, t0, t1, tNow, /*dense*/ false);
  document.getElementById("zoom-meta").textContent =
    `${fmt(t0)} → ${fmt(t1)}  (${(t1 - t0).toFixed(2)} s)`;
}

/** Lanes: one row per visible stream, stacked from top to bottom. */
function visibleLanes() {
  const lanes = [];
  if (tog.stemDrums.checked)  lanes.push({ label: "drums",  color: COLORS.drums,  times: det2.stems.drums.onsets });
  if (tog.kick.checked)       lanes.push({ label: "kick",   color: COLORS.kick,   times: det2.drum_bands.kick.onsets });
  if (tog.snare.checked)      lanes.push({ label: "snare",  color: COLORS.snare,  times: det2.drum_bands.snare.onsets });
  if (tog.hat.checked)        lanes.push({ label: "hat",    color: COLORS.hat,    times: det2.drum_bands.hat.onsets });
  if (tog.stemBass.checked)   lanes.push({ label: "bass",   color: COLORS.bass,   times: det2.stems.bass.onsets });
  if (tog.stemVocals.checked) lanes.push({ label: "vocals", color: COLORS.vocals, times: det2.stems.vocals.onsets });
  if (tog.stemOther.checked)  lanes.push({ label: "other",  color: COLORS.other,  times: det2.stems.other.onsets });
  if (tog.drums.checked)      lanes.push({ label: "drums-v1", color: COLORS.drums, times: det1.drum_onsets, dim: true });
  if (tog.bass.checked)       lanes.push({ label: "bass-v1",  color: COLORS.bass,  times: det1.bass_onsets, dim: true });
  if (tog.rnnMix.checked && detM)   lanes.push({ label: "RNN mix",   color: COLORS.ink,   times: detM.onsets_mix.map(t => ({ t, strength: 1 })) });
  if (tog.rnnDrums.checked && detM) lanes.push({ label: "RNN drums", color: COLORS.drums, times: detM.onsets_drums.map(t => ({ t, strength: 1 })) });
  if (detA) {
    const adtLane = (key, label, color, hits) => ({ label, color, times: hits.map(h => ({ t: h.t, strength: (h.velocity || 80) / 127 })) });
    if (tog.adtKick.checked)   lanes.push(adtLane("k", "ADT kick",   COLORS.kick,   detA.classes.kick));
    if (tog.adtSnare.checked)  lanes.push(adtLane("s", "ADT snare",  COLORS.snare,  detA.classes.snare));
    if (tog.adtHat.checked)    lanes.push(adtLane("h", "ADT hat",    COLORS.hat,    detA.classes.hat));
    if (tog.adtTom.checked)    lanes.push(adtLane("t", "ADT tom",    COLORS.tom,    detA.classes.tom));
    if (tog.adtCymbal.checked) lanes.push(adtLane("c", "ADT cymbal", COLORS.cymbal, detA.classes.cymbal));
  }
  // Consensus lane — render first so it sits at the top of the lane stack
  if (tog.consensus && tog.consensus.checked && detC) {
    const cons = computeConsensus();
    const maxV = cons.reduce((m, c) => Math.max(m, c.votes), 1);
    lanes.push({
      label:  `consensus (${cons.length} hits)`,
      color:  COLORS.accent || COLORS.drums,
      times:  cons.map(c => ({ t: c.t, strength: c.votes / maxV })),
    });
  }

  if (detC) {
    const showDropped = tog.corrDropped.checked;
    const corrLane = (key, label, color) => {
      const s = detC.streams[key];
      if (!s) return null;
      const kept    = s.kept.map(k => ({ t: k.t, strength: 1, kept: true }));
      const dropped = showDropped ? s.dropped.map(d => ({ t: d.t, strength: 0.35, kept: false })) : [];
      return { label, color, times: kept.concat(dropped), ghost: true };
    };
    const add = (toggle, key, label, color) => {
      if (toggle.checked) {
        const lane = corrLane(key, label, color);
        if (lane) lanes.push(lane);
      }
    };
    add(tog.corrRnnDrums,  "rnn_drums",  "RNN drums ✓",  COLORS.drums);
    add(tog.corrStemDrums, "stem_drums", "v2 drums ✓",   COLORS.drums);
    add(tog.corrStemBass,  "stem_bass",  "v2 bass ✓",    COLORS.bass);
    add(tog.corrBandKick,  "band_kick",  "v3 kick ✓",    COLORS.kick);
    add(tog.corrBandSnare, "band_snare", "v3 snare ✓",   COLORS.snare);
    add(tog.corrBandHat,   "band_hat",   "v3 hat ✓",     COLORS.hat);
    add(tog.corrKick,      "adt_kick",   "ADT kick ✓",   COLORS.kick);
    add(tog.corrSnare,     "adt_snare",  "ADT snare ✓",  COLORS.snare);
    add(tog.corrHat,       "adt_hat",    "ADT hat ✓",    COLORS.hat);
  }
  return lanes;
}

function drawStrip(canvas, t0, t1, tNow, dense) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const xOf = (t) => ((t - t0) / (t1 - t0)) * W;
  const dpr = window.devicePixelRatio || 1;

  // Spectrogram backdrop (under everything else, top ~40% of the canvas)
  if (tog.spec.checked && spec) {
    const { img, meta } = spec;
    const dur = meta.duration;
    const sx = (Math.max(0, t0) / dur) * img.width;
    const sw = Math.max(1, ((Math.min(dur, t1) - Math.max(0, t0)) / dur) * img.width);
    const specH = H * 0.40;
    ctx.imageSmoothingEnabled = !dense;  // crisp pixels on overview, smoothed on zoom
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, W, specH);
    ctx.globalAlpha = 1;
    // Thin rule under the spectrogram so it visually detaches from lanes
    ctx.strokeStyle = COLORS.rule;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, specH); ctx.lineTo(W, specH); ctx.stroke();
  }

  // Sections (under everything)
  if (tog.sections.checked && det1.sections) {
    det1.sections.forEach((s, i) => {
      if (s.end < t0 || s.start > t1) return;
      const x0 = Math.max(0, xOf(s.start));
      const x1 = Math.min(W, xOf(s.end));
      ctx.fillStyle = SECTION_TINTS[i % SECTION_TINTS.length];
      ctx.fillRect(x0, 0, x1 - x0, H);
      if (x1 - x0 > 40 && dense) {
        ctx.fillStyle = "rgba(31,26,20,0.45)";
        ctx.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
        ctx.fillText(`§${i + 1}`, x0 + 4, H - 4);
      }
    });
  }

  // Time ticks
  const tickEvery = dense ? 10 : 1;
  ctx.strokeStyle = COLORS.ruleSoft;
  ctx.lineWidth = 1;
  ctx.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = "#928873";
  // When the spectrogram backdrop is on, push tick labels just under it so
  // they don't get lost against the dark high-frequency band.
  const tickY = (tog.spec.checked && spec) ? H * 0.40 + 12 * dpr : 12 * dpr;
  for (let s = Math.ceil(t0 / tickEvery) * tickEvery; s <= t1; s += tickEvery) {
    const x = xOf(s);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.fillText(fmt(s), x + 4, tickY);
  }

  // Envelope (always at the top, behind lanes)
  if (tog.env.checked && det1.envelope) {
    drawEnv(ctx, det1.envelope.full, det1.envelope.hop_s, t0, t1, xOf, H * 0.20, H * 0.18, COLORS.env);
  }

  // Beat grid (madmom DBN beats)
  if (tog.beats.checked && detM) {
    ctx.strokeStyle = COLORS.beat;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    for (const bt of detM.beats) {
      if (bt < t0 || bt > t1) continue;
      const x = xOf(bt);
      ctx.beginPath(); ctx.moveTo(x, H * 0.42); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Downbeats — thicker + extend higher than regular beats
  if (tog.downbeats.checked && detM) {
    ctx.strokeStyle = COLORS.beat;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = dense ? 1 : 2;
    for (const bt of detM.downbeats) {
      if (bt < t0 || bt > t1) continue;
      const x = xOf(bt);
      ctx.beginPath(); ctx.moveTo(x, H * 0.30); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Lanes
  const lanes = visibleLanes();
  if (lanes.length > 0) {
    const top = H * 0.45;
    const bot = H * 0.96;
    const laneH = (bot - top) / Math.max(lanes.length, 1);
    lanes.forEach((lane, i) => {
      const y = top + (i + 0.5) * laneH;
      // Lane label
      ctx.fillStyle = lane.color;
      ctx.globalAlpha = lane.dim ? 0.55 : 0.9;
      ctx.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
      ctx.fillText(lane.label, 4, y - laneH * 0.3);
      // Dots
      let sMax = 0;
      for (const o of lane.times) if (o.strength > sMax) sMax = o.strength;
      sMax = sMax || 1;
      for (const o of lane.times) {
        if (o.t < t0 || o.t > t1) continue;
        const x = xOf(o.t);
        const r = (dense ? 1.0 : 4.0) + (o.strength / sMax) * (dense ? 1.6 : 6.0);
        // For corrected lanes: filled = kept, hollow ring = dropped
        if (lane.ghost && o.kept === false) {
          ctx.save();
          ctx.globalAlpha *= 0.55;
          ctx.strokeStyle = lane.color;
          ctx.lineWidth = dense ? 0.8 : 1.5;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  // Playhead
  const xN = xOf(tNow);
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xN, 0); ctx.lineTo(xN, H); ctx.stroke();
}

function drawEnv(ctx, arr, hop, t0, t1, xOf, baseY, scale, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  const idx0 = Math.max(0, Math.floor(t0 / hop));
  const idx1 = Math.min(arr.length - 1, Math.ceil(t1 / hop));
  ctx.moveTo(xOf(idx0 * hop), baseY);
  for (let i = idx0; i <= idx1; i++) {
    ctx.lineTo(xOf(i * hop), baseY - arr[i] * scale);
  }
  for (let i = idx1; i >= idx0; i--) {
    ctx.lineTo(xOf(i * hop), baseY + arr[i] * scale * 0.3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- scrub --------------------------------------------------------

function bindScrub(canvas, t0fn, t1fn) {
  let dragging = false;
  const seekFromEvent = (ev) => {
    const r = canvas.getBoundingClientRect();
    const f = (ev.clientX - r.left) / r.width;
    audio.currentTime = t0fn() + f * (t1fn() - t0fn());
  };
  canvas.addEventListener("mousedown", (e) => { dragging = true; seekFromEvent(e); });
  window.addEventListener("mousemove",  (e) => { if (dragging) seekFromEvent(e); });
  window.addEventListener("mouseup",    () => { dragging = false; });
}
bindScrub(overview, () => 0, () => det1 ? det1.duration : 1);
bindScrub(zoom,
  () => Math.max(0, (audio.currentTime || 0) - ZOOM_HALF_WIDTH_S),
  () => det1 ? Math.min(det1.duration, (audio.currentTime || 0) + ZOOM_HALF_WIDTH_S) : 1);

// ---------- utils --------------------------------------------------------

function fmt(s) {
  if (!isFinite(s)) return "0:00.00";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}
