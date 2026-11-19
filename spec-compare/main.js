/** Readings of one song compared: every reading's film is loaded at once and follows one clock (the song's own sound),
 * so going from one reading to another (keys 1–9) is a change of which picture is shown, at the same instant. Under them
 * the spec alone: landings with their strengths, and the air, speed and height curves, with the approved reading behind
 * on request. The vote: one best reading per song, a verdict and words per reading (the spec dashboard's own records). */
const $ = (id) => document.getElementById(id);
const ORDER = ["main", "astra", "sol", "opus", "blend"];
const BY = { main: "The approved reading", astra: "Astra", sol: "Sol", opus: "Opus", blend: "Blend: from the four" };
const LANES = [["air", "air time", "--teal"], ["speed", "speed", "--blue"], ["amplitude", "height", "--violet"]];
// Zoom lanes: films of one reading (the blend) under each of the song's camera lanes, listed in an index written when they
// are rendered. `state.zoom[song]` is the lane on screen for that reading; with none, the reading's own film.
const ZOOM_OF = "blend", ZOOM_INDEX = "/generated/videos/lanes/index.json";
const lanesOf = (s = song()) => state.lanes[s?.dir.split("/")[1]] ?? [];
const laneOn = () => reading()?.reading === ZOOM_OF ? lanesOf().find((l) => l.id === state.zoom[song().dir]) ?? lanesOf()[0] ?? null : null;
const filmKey = () => { const lane = laneOn(); return lane ? `${reading().path}#${lane.id}` : reading()?.path; };
const state = { lanes: {}, zoom: {}, held: [], loading: 0, songs: [], picks: {}, s: 0, v: 0, views: new Map(), films: new Map(), ghost: false, from: 0, to: 1, token: 0, dirty: null };
const audio = $("audio"), canvas = $("timeline"), ctx = canvas.getContext("2d");
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const json = async (res) => { const body = await res.json(); if (!res.ok) throw Error(body.error ?? res.statusText); return body; };
const post = (body) => fetch("/api/spec-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json);
const song = () => state.songs[state.s], reading = () => song()?.versions[state.v], view = (r = reading()) => r && state.views.get(r.path);
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const duration = () => view(song()?.versions[0])?.spec.duration ?? 1;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

async function start() {
  const body = await fetch("/api/spec-review", { cache: "no-cache" }).then(json);
  state.picks = body.picks ?? {};
  state.lanes = await fetch(ZOOM_INDEX, { cache: "no-cache" }).then((res) => res.ok ? res.json() : {}).catch(() => ({}));
  const by = new Map();
  for (const r of body.readings.filter((r) => r.set === "production")) {
    const dir = r.path.split("/").slice(0, 2).join("/");
    if (!by.has(dir)) by.set(dir, { dir, title: r.title, artist: r.artist, versions: [] });
    by.get(dir).versions.push(r);
  }
  const rank = (r) => { const i = ORDER.indexOf(r.reading); return i < 0 ? ORDER.length : i; };
  state.songs = [...by.values()];
  for (const s of state.songs) s.versions.sort((a, b) => rank(a) - rank(b));
  $("songs").replaceChildren(...state.songs.map((s, i) => new Option(`${s.title}${s.artist ? " · " + s.artist : ""}`, i)));
  const params = new URLSearchParams(location.search), wanted = state.songs.findIndex((s) => s.dir.endsWith("/" + params.get("song")));
  await openSong(Math.max(0, wanted), params.get("reading"));
  requestAnimationFrame(tick);
}

async function openSong(index, readingName = null) {
  await flushWords();
  const token = ++state.token, keep = reading()?.reading;
  audio.pause();
  state.s = (index + state.songs.length) % state.songs.length;
  const s = song(), name = readingName ?? keep;
  state.v = Math.max(0, s.versions.findIndex((r) => r.reading === name));
  $("songs").value = state.s;
  $("stage").replaceChildren(); state.films.clear();
  for (const url of state.held.splice(0)) URL.revokeObjectURL(url);
  audio.removeAttribute("src"); audio.load();
  renderSide();
  const loaded = await Promise.all(s.versions.map(async (r) => [r,
    state.views.get(r.path) ?? await fetch(`/api/spec-view?spec=${encodeURIComponent(r.path)}&samples=900`).then(json),
    await fetch(`/api/spec-video?spec=${encodeURIComponent(r.path)}`).then(json).catch(() => ({}))]));
  if (token !== state.token) return;
  // The sound and every film are fetched whole and played from memory. Streamed, five films and the sound each hold a
  // connection to the server for as long as they play, which is all a browser allows to one server: the sound can then
  // starve and stop while the films run on, and a vote cannot be sent.
  const whole = async (url) => { const blob = await fetch(url).then((res) => res.ok ? res.blob() : Promise.reject(Error(res.statusText))); const held = URL.createObjectURL(blob); state.held.push(held); return held; };
  for (const [r, v] of loaded) state.views.set(r.path, v);
  state.from = 0; state.to = duration(); state.loading = loaded.filter((x) => x[2].video).length + 1;
  renderSide(); draw();
  const sound = await whole(view(s.versions[0]).music.audioUrl).catch(() => null);
  if (token !== state.token) return;
  if (sound) { audio.src = sound; audio.currentTime = 0; }
  state.loading--;
  // the reading on screen first, then the others
  const order = [...loaded].sort((a, b) => (b[0] === reading()) - (a[0] === reading()));
  await Promise.all(order.map(async ([r, , film]) => {
    if (!film.video) return;
    const src = await whole(`${film.video.url}?v=${encodeURIComponent(film.video.madeAt)}`).catch(() => null);
    if (token !== state.token) return;
    state.loading--;
    if (!src) return;
    const el = document.createElement("video");
    Object.assign(el, { muted: true, playsInline: true, preload: "auto", src });
    el.from = film.video.from ?? 0; el.dataset.reading = r.reading;
    el.addEventListener("loadedmetadata", () => place(el, true), { once: true });
    state.films.set(r.path, el); $("stage").append(el); show();
  }));
  if (token !== state.token) return;
  const blend = s.versions.find((r) => r.reading === ZOOM_OF);
  if (blend) { state.loading = lanesOf(s).length; await Promise.all(lanesOf(s).map(async (lane) => {
    const src = await whole(`${lane.url}?v=${encodeURIComponent(lane.madeAt)}`).catch(() => null);
    if (token !== state.token) return;
    state.loading--;
    if (!src) return;
    const el = document.createElement("video");
    Object.assign(el, { muted: true, playsInline: true, preload: "auto", src });
    el.from = 0; el.dataset.reading = `${ZOOM_OF}#${lane.id}`;
    el.addEventListener("loadedmetadata", () => place(el, true), { once: true });
    state.films.set(`${blend.path}#${lane.id}`, el); $("stage").append(el); show();
  })); }
  if (token !== state.token) return;
  state.loading = 0; show();
  history.replaceState(null, "", `?song=${s.dir.split("/")[1]}&reading=${reading().reading}`);
  renderSide(); show(); draw();
}

/** Which film is seen. Every film keeps running under the one on top, so nothing has to load or seek at the change. */
function show() {
  const wanted = filmKey(), path = state.films.has(wanted) ? wanted : reading()?.path;
  for (const [p, el] of state.films) el.classList.toggle("on", p === path);
  let none = $("stage").querySelector(".none");
  if (!state.films.has(path)) { if (!none) { none = document.createElement("div"); none.className = "none"; $("stage").append(none); } none.textContent = state.loading ? "Loading the film…" : "No video of this reading yet"; }
  else none?.remove();
}

async function setVersion(i) {
  const versions = song().versions;
  if (i < 0 || i >= versions.length || i === state.v) return;
  await flushWords();
  state.v = i;
  history.replaceState(null, "", `?song=${song().dir.split("/")[1]}&reading=${reading().reading}`);
  show(); renderSide(); draw();
  const shown = shownFilm();
  if (shown && audio.paused) place(shown, true);
}

function renderSide() {
  const s = song(), r = reading();
  if (!s) return;
  $("title").textContent = `${s.title}${s.artist ? " · " + s.artist : ""}`;
  $("versions").replaceChildren(...s.versions.map((x, i) => {
    const b = document.createElement("button");
    b.innerHTML = `<span class="n">${i + 1}</span><span class="mark ${x.verdict ?? ""}"></span>${x.reading}${state.picks[s.dir] === x.path ? ' <span class="star">★</span>' : ""}`;
    b.classList.toggle("on", i === state.v); b.onclick = () => setVersion(i);
    b.title = BY[x.reading] ?? x.reading;
    return b;
  }));
  const picked = state.songs.filter((x) => state.picks[x.dir]).length;
  $("progress").textContent = `${picked} of ${state.songs.length} songs have a best reading`;
  $("best").classList.toggle("on", state.picks[s.dir] === r.path);
  for (const b of $("verdict").children) b.classList.toggle("on", r.verdict === b.dataset.verdict && !r.changed);
  $("open").href = `/spec-dashboard/?spec=${r.path}`;
  // the author's intention is the note written with the reading; what was changed since is said after it
  const notes = r.revisions ?? [], stated = notes.findLast((n) => /^The intention:/.test(n.summary ?? "")) ?? notes.at(-1);
  const since = notes.slice(notes.indexOf(stated) + 1).map((n) => n.summary).filter(Boolean);
  $("by").textContent = BY[r.reading] ?? r.reading;
  $("intention").textContent = r.reading === "main" ? "The reading you reviewed and approved. The others keep its landings and change how the rider moves between them: air time, speed, height, and how hard each landing is."
    : ((stated?.summary ?? "").replace(/^The intention:\s*/, "") || "No intention written.") + (since.length ? `\n\nSince then: ${since.join(" ")}` : "");
  const lane = laneOn();
  $("zoom").hidden = !lane;
  if (lane) {
    $("zooms").replaceChildren(...lanesOf().map((l) => { const b = document.createElement("button"); b.textContent = l.name; b.classList.toggle("on", l === lane); b.onclick = () => setZoom(l.id); b.title = l.about; return b; }));
    $("zoom-about").textContent = lane.about; $("zoom-about").title = lane.about;
  }
  if (document.activeElement !== $("words")) $("words").value = r.note ?? "";
  $("saved").textContent = "";
}

/** Another camera lane for the blend: `to` a lane id, or a step. */
function setZoom(to) {
  const lanes = lanesOf(), now = laneOn();
  if (!now || lanes.length < 2) return;
  const next = typeof to === "string" ? lanes.find((l) => l.id === to) : lanes[(lanes.indexOf(now) + to + lanes.length) % lanes.length];
  if (!next || next === now) return;
  state.zoom[song().dir] = next.id;
  show(); renderSide(); draw();
  const shown = shownFilm(); if (shown && audio.paused) place(shown, true);
}

async function vote(verdict) {
  const r = reading(), next = r.verdict === verdict && !r.changed ? null : verdict;
  const body = await post({ spec: r.path, verdict: next }).catch((e) => ($("saved").textContent = `Not saved: ${e.message}`, null));
  if (body?.reading) { Object.assign(r, body.reading); renderSide(); }
}
async function pick() {
  const s = song(), r = reading();
  const body = await post({ spec: r.path, pick: state.picks[s.dir] !== r.path }).catch((e) => ($("saved").textContent = `Not saved: ${e.message}`, null));
  if (body?.picks) { state.picks = body.picks; renderSide(); }
}
let wordsTimer = 0;
function wordsChanged() {
  state.dirty = { r: reading(), note: $("words").value };
  $("saved").textContent = "…";
  clearTimeout(wordsTimer); wordsTimer = setTimeout(flushWords, 700);
}
async function flushWords() {
  clearTimeout(wordsTimer);
  const d = state.dirty; state.dirty = null;
  if (!d) return;
  const body = await post({ spec: d.r.path, note: d.note }).catch((e) => ($("saved").textContent = `Not saved: ${e.message}`, null));
  if (body?.reading) { Object.assign(d.r, body.reading); if (d.r === reading()) $("saved").textContent = "Saved"; }
}

// ---- the clock: the song's own sound; every film follows it.
// A film is moved by a seek only when it has to be (a jump of the clock): a seek stalls its picture for a moment, and five
// at once stall everything. While playing, a film that is a little early or late is brought back by playing it slightly
// faster or slower. While the clock is being dragged only the film on top follows; the others are placed once it rests.
const GUTTER = 52;
let settle = 0, starting = false;
const shownFilm = () => state.films.get(filmKey()) ?? state.films.get(reading()?.path);
const filmTime = (el, t = audio.currentTime) => clamp(t - el.from, 0, Math.max(0, (el.duration || 0) - 0.03));
function place(el, exact = false) {
  const at = filmTime(el);
  if (el.readyState < 1 || el.seeking && !exact) return;
  if (Math.abs(el.currentTime - at) > 0.02) el.currentTime = at;
}
const placeOthers = () => { const shown = shownFilm(); for (const el of state.films.values()) if (el !== shown) place(el, true); };
function seek(t) {
  audio.currentTime = clamp(t, 0, duration() - 0.01);
  const shown = shownFilm();
  if (shown) place(shown);
  clearTimeout(settle);
  if (audio.paused) settle = setTimeout(placeOthers, 220); else placeOthers();
}
const ready = (el) => el.readyState >= 3 && !el.seeking ? Promise.resolve() : new Promise((done) => {
  const end = () => { el.removeEventListener("seeked", end); el.removeEventListener("canplay", end); done(); };
  el.addEventListener("seeked", end); el.addEventListener("canplay", end); setTimeout(end, 1500);
});
/** Play: every film is placed first, and the sound starts when the film on top is ready, so the start is clean. */
async function toggle() {
  if (starting) return;
  if (!audio.paused) { audio.pause(); for (const el of state.films.values()) el.pause(); clearTimeout(settle); settle = setTimeout(() => { for (const el of state.films.values()) place(el, true); }, 120); return; }
  if (audio.currentTime >= duration() - 0.05) audio.currentTime = 0;
  starting = true; clearTimeout(settle);
  for (const el of state.films.values()) place(el, true);
  const shown = shownFilm();
  if (shown) await ready(shown);
  starting = false;
  await audio.play().catch(() => {});
}
// The sound can stop by itself (its end, a device, a starved download). The films then wait for it where it is, instead of
// running on and being pulled back again and again.
let lastT = -1, lastMove = 0;
function tick(now = performance.now()) {
  const t = audio.currentTime, playing = !audio.paused && !audio.ended;
  if (t !== lastT) { lastT = t; lastMove = now; }
  const waiting = playing && now - lastMove > 350;
  if (!playing || waiting) { for (const el of state.films.values()) if (!el.paused) el.pause(); }
  if (waiting && now - lastMove > 3000 && audio.readyState < 3) { lastMove = now; const at = t; audio.load(); audio.currentTime = at; audio.play().catch(() => {}); }
  if (playing && !waiting) for (const el of state.films.values()) {
    if (el.readyState < 2) continue;
    const at = filmTime(el, t), over = t - el.from >= (el.duration || 0) - 0.03;
    if (over) { if (!el.paused) el.pause(); continue; }
    if (el.seeking) continue;
    const drift = el.currentTime - at;
    if (Math.abs(drift) > 0.3) { el.currentTime = at + 0.03; el.playbackRate = 1; }
    else el.playbackRate = Math.abs(drift) < 0.012 ? 1 : clamp(1 - drift * 0.9, 0.85, 1.15);
    if (el.paused) el.play().catch(() => {});
  }
  $("play").textContent = playing || starting ? "Pause" : "Play";
  $("clock").textContent = `${fmt(t)} / ${fmt(duration())}${state.loading ? ` · loading ${state.loading}` : waiting ? " · waiting for the sound" : ""}`;
  draw();
  requestAnimationFrame(tick);
}

// ---- the spec, and only the spec
function draw() {
  const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const v = view(), base = view(song()?.versions[0]);
  if (!v || !base) return;
  const x = (t) => GUTTER + (t - state.from) / (state.to - state.from) * (W - GUTTER);
  const hover = state.hover != null && state.hover >= state.from && state.hover <= state.to ? state.hover : null;
  const at = (points, t) => { if (!points?.length) return null; let prev = null; for (const p of points) { if (p[0] >= t) { if (p[1] == null) return null; if (!prev || prev[1] == null || p[0] === prev[0]) return p[1]; return prev[1] + (p[1] - prev[1]) * (t - prev[0]) / (p[0] - prev[0]); } prev = p; } return prev?.[1] ?? null; };
  const tag = (text, X, Y, colour) => { const w = ctx.measureText(text).width + 8, left = X + 6 + w > W ? X - 6 - w : X + 6; ctx.fillStyle = css("--surface"); ctx.globalAlpha = 0.92; ctx.fillRect(left, Y - 8, w, 16); ctx.globalAlpha = 1; ctx.fillStyle = colour; ctx.fillText(text, left + 4, Y + 0.5); };
  const ink = css("--ink"), muted = css("--muted"), line = css("--line"), rust = css("--rust");
  ctx.font = "11px " + (css("--sans") || "sans-serif"); ctx.textBaseline = "middle";
  // phases, and the drop
  const top = 18;
  ctx.save(); ctx.beginPath(); ctx.rect(GUTTER, 0, W - GUTTER, H); ctx.clip();
  for (const p of v.overlayMeta?.phases ?? []) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = p.color ?? line; ctx.fillRect(x(p.t0), 0, x(p.t1) - x(p.t0) - 1, top);
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.save(); ctx.beginPath(); ctx.rect(x(p.t0), 0, x(p.t1) - x(p.t0) - 1, top); ctx.clip(); ctx.fillText(p.name, Math.max(x(p.t0), 0) + 6, top / 2 + 0.5); ctx.restore();
  }
  if (v.drop) { ctx.fillStyle = rust; ctx.globalAlpha = 0.06; ctx.fillRect(x(v.drop[0]), top, x(v.drop[1]) - x(v.drop[0]), H - top); ctx.globalAlpha = 1; }
  ctx.restore();
  // landings: one stem each, as tall as the landing is hard
  const laneCount = LANES.length + (laneOn() ? 1 : 0), laneH = Math.max(30, Math.round((H - top - 16) * (laneOn() ? 0.16 : 0.2))), impactH = H - top - 16 - laneCount * (laneH + 8), y0 = top + impactH;
  // one scale per curve for all the readings of the song, so that two readings are compared on the same ruler
  const scale = (axis) => { let lo = 1, hi = 0; for (const r of song().versions) for (const p of view(r)?.axes?.[axis]?.points ?? []) if (p[1] != null) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    const pad = Math.max(0.03, (hi - lo) * 0.12); return hi > lo ? [Math.max(0, lo - pad), Math.min(1, hi + pad)] : [0, 1]; };
  const ruler = (value, Y, strong = false) => { ctx.strokeStyle = line; ctx.globalAlpha = strong ? 1 : 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(GUTTER, Math.round(Y) + 0.5); ctx.lineTo(W, Math.round(Y) + 0.5); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(value, GUTTER - 5, Y); ctx.textAlign = "left"; };
  for (const g of [0, 0.25, 0.5, 0.75, 1]) ruler(g.toFixed(2).replace(/0$/, "").replace(/\.$/, ""), y0 - g * (impactH - 8), g === 0);
  ctx.save(); ctx.translate(9, y0 - impactH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillStyle = muted; ctx.fillText("impact", 0, 0); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(GUTTER, 0, W - GUTTER, H); ctx.clip();
  const ghost = state.ghost && v !== base;
  if (ghost) { ctx.strokeStyle = muted; ctx.globalAlpha = 0.55; for (const c of base.contacts) { const X = Math.round(x(c.t)) + 3.5, h = (c.impact ?? 0) * (impactH - 8); ctx.beginPath(); ctx.moveTo(X - 3, y0 - h); ctx.lineTo(X + 3, y0 - h); ctx.stroke(); } ctx.globalAlpha = 1; }
  for (const c of v.contacts) {
    const i = c.impact ?? 0, X = Math.round(x(c.t)) + 0.5, h = i * (impactH - 8);
    if (X < -4 || X > W + 4) continue;
    ctx.strokeStyle = ctx.fillStyle = i >= 0.75 ? rust : i >= 0.4 ? ink : muted; ctx.lineWidth = i >= 0.75 ? 2 : 1.2;
    ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y0 - h); ctx.stroke();
    ctx.beginPath(); ctx.arc(X, y0 - h, i >= 0.75 ? 3 : 2, 0, 7); ctx.fill();
  }
  ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(GUTTER, 0, W - GUTTER, H); ctx.clip();
  // the curves between the landings
  const zoomLane = laneOn(), drawn = zoomLane ? [...LANES, ["zoom", "zoom (wide)", "--gold"]] : LANES;
  drawn.forEach(([axis, label, colour], k) => {
    const zoomPts = axis === "zoom" ? [[0, zoomLane.keyframes[0].wide], ...zoomLane.keyframes.map((p) => [p.t, p.wide]), [duration(), zoomLane.keyframes.at(-1).wide]] : null;
    const y1 = y0 + 8 + k * (laneH + 8) + laneH, pts = zoomPts ?? v.axes?.[axis]?.points, c = css(colour), [lo, hi] = zoomPts ? [0, 1] : scale(axis);
    const y = (val) => y1 - (val - lo) / (hi - lo) * (laneH - 4);
    const path = (points) => { let pen = false; ctx.beginPath(); for (const [t, val] of points) { if (val == null) { pen = false; continue; } const X = x(t), Y = y(val); pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; } };
    ctx.restore();
    ruler(lo.toFixed(2), y(lo), true); ruler(((lo + hi) / 2).toFixed(2), y((lo + hi) / 2)); ruler(hi.toFixed(2), y(hi));
    ctx.save(); ctx.translate(9, y1 - laneH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillStyle = c; ctx.fillText(label, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(GUTTER, 0, W - GUTTER, H); ctx.clip();
    if (pts?.length) {
      // filled under each stretch where the curve is written; a stretch it leaves open stays empty
      ctx.fillStyle = c; ctx.globalAlpha = 0.18;
      for (let i = 0; i < pts.length;) { if (pts[i][1] == null) { i++; continue; } let j = i; while (j + 1 < pts.length && pts[j + 1][1] != null) j++;
        ctx.beginPath(); ctx.moveTo(x(pts[i][0]), y1); for (let k = i; k <= j; k++) ctx.lineTo(x(pts[k][0]), y(pts[k][1])); ctx.lineTo(x(pts[j][0]), y1); ctx.closePath(); ctx.fill(); i = j + 1; }
      ctx.globalAlpha = 1;
      path(pts); ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.stroke();
    }
    const basePts = zoomPts ? null : base.axes?.[axis]?.points;
    if (ghost && basePts?.length) { path(basePts); ctx.setLineDash([4, 3]); ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (!pts?.length) { ctx.fillStyle = muted; ctx.fillText("not written in this reading", GUTTER + 8, y1 - laneH / 2); }
    if (hover != null) { const val = at(pts, hover), was = ghost ? at(basePts, hover) : null;
      if (val != null) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x(hover), y(val), 3.5, 0, 7); ctx.fill(); }
      if (val != null || was != null) tag(`${val != null ? val.toFixed(2) : "–"}${was != null ? `  (approved ${was.toFixed(2)})` : ""}`, x(hover), val != null ? clamp(y(val), y1 - laneH + 8, y1 - 8) : y1 - laneH / 2, c); }
  });
  // under the pointer: the moment, and the landing nearest to it
  if (hover != null) {
    const X = Math.round(x(hover)) + 0.5; ctx.strokeStyle = muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(X, H - 14); ctx.stroke(); ctx.globalAlpha = 1;
    const near = v.contacts.reduce((best, c) => !best || Math.abs(c.t - hover) < Math.abs(best.t - hover) ? c : best, null);
    if (near && Math.abs(x(near.t) - x(hover)) < 14) {
      const i = near.impact ?? 0, Y = y0 - i * (impactH - 8), was = ghost ? base.contacts.find((c) => Math.abs(c.t - near.t) < 0.002) : null;
      ctx.strokeStyle = rust; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(x(near.t)) + 0.5, Y, 5.5, 0, 7); ctx.stroke();
      tag(`${i.toFixed(2)} at ${Math.floor(near.t / 60)}:${(near.t % 60).toFixed(2).padStart(5, "0")}${was && Math.abs((was.impact ?? 0) - i) > 0.004 ? `  (approved ${(was.impact ?? 0).toFixed(2)})` : ""}`, x(near.t), clamp(Y - 13, top + 10, y0 - 10), ink);
    }
    tag(fmt(hover), x(hover), H - 24, muted);
  }
  ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(GUTTER, 0, W - GUTTER, H); ctx.clip();
  // seconds, and where we are
  ctx.fillStyle = muted; const step = [1, 2, 5, 10, 20].find((s) => (state.to - state.from) / s <= 14) ?? 30;
  for (let t = Math.ceil(state.from / step) * step; t <= state.to; t += step) ctx.fillText(fmt(t).replace(/\.0$/, ""), x(t) + 3, H - 7);
  const X = Math.round(x(audio.currentTime)) + 0.5; ctx.strokeStyle = rust; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke(); ctx.restore();
  $("legend").textContent = `${v.contacts.length} landings${ghost ? " · dashed and ticks: the approved reading" : ""}${state.to - state.from < duration() - 0.01 ? " · double-click for the whole song" : " · scroll to zoom"}`;
}

const timeAt = (event) => state.from + (event.clientX - canvas.getBoundingClientRect().left - GUTTER) / (canvas.clientWidth - GUTTER) * (state.to - state.from);
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); seek(timeAt(e)); });
canvas.addEventListener("pointermove", (e) => { state.hover = timeAt(e); if (e.buttons & 1) seek(timeAt(e)); });
canvas.addEventListener("pointerleave", () => { state.hover = null; });
canvas.addEventListener("dblclick", () => { state.from = 0; state.to = duration(); });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const span = state.to - state.from, d = duration();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const move = clamp((e.deltaX || e.deltaY) / (canvas.clientWidth - GUTTER) * span, -state.from, d - state.to); state.from += move; state.to += move; return; }
  const at = timeAt(e), next = clamp(span * (e.deltaY > 0 ? 1.25 : 0.8), 3, d), k = (at - state.from) / span;
  state.from = clamp(at - k * next, 0, d - next); state.to = state.from + next;
}, { passive: false });

$("play").onclick = toggle;
$("prev").onclick = () => openSong(state.s - 1); $("next").onclick = () => openSong(state.s + 1);
$("songs").onchange = () => { openSong(Number($("songs").value)); $("songs").blur(); };
$("best").onclick = pick;
$("verdict").onclick = (e) => { const b = e.target.closest("button[data-verdict]"); if (b) vote(b.dataset.verdict); };
$("ghost").onchange = () => { state.ghost = $("ghost").checked; $("ghost").blur(); };
$("words").addEventListener("input", wordsChanged);
$("words").addEventListener("blur", flushWords);
addEventListener("beforeunload", flushWords);
addEventListener("keydown", (e) => {
  if (e.target === $("words")) { if (e.key === "Escape") $("words").blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase(), digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? (/^[1-9]$/.test(e.key) ? e.key : null);
  const act = digit ? () => setVersion(Number(digit) - 1)
    : e.code === "Space" ? toggle
    : key === "arrowleft" ? () => seek(audio.currentTime - (e.shiftKey ? 0.5 : 2))
    : key === "arrowright" ? () => seek(audio.currentTime + (e.shiftKey ? 0.5 : 2))
    : key === "arrowup" ? () => openSong(state.s - 1) : key === "arrowdown" ? () => openSong(state.s + 1)
    : key === "]" ? () => setVersion((state.v + 1) % song().versions.length) : key === "[" ? () => setVersion((state.v - 1 + song().versions.length) % song().versions.length)
    : key === "b" ? pick : key === "l" ? () => vote("love") : key === "g" ? () => vote("good") : key === "x" ? () => vote("needs-work")
    : key === "m" ? () => { state.ghost = !state.ghost; $("ghost").checked = state.ghost; }
    : key === "z" ? () => setZoom(e.shiftKey ? -1 : 1)
    : key === "c" ? () => $("words").focus() : key === "home" ? () => seek(0) : null;
  if (!act) return;
  e.preventDefault();
  if (!e.repeat || key.startsWith("arrow")) act();
});
start().catch((e) => { $("title").textContent = `Could not load: ${e.message}`; });
