/** Readings of one song compared: every reading's film is loaded at once and follows one clock (the song's own sound),
 * so going from one reading to another (keys 1–9) is a change of which picture is shown, at the same instant. Under them
 * the spec alone: landings with their strengths, and the air, speed and height curves, with the approved reading behind
 * on request. The vote: one best reading per song, a verdict and words per reading (the spec dashboard's own records). */
const $ = (id) => document.getElementById(id);
const ORDER = ["main", "astra", "sol", "opus", "blend"];
const BY = { main: "The approved reading", astra: "Astra", sol: "Sol", opus: "Opus", blend: "Blend: from the four" };
const LANES = [["air", "air time", "--teal"], ["speed", "speed", "--blue"], ["amplitude", "height", "--violet"]];
const state = { songs: [], picks: {}, s: 0, v: 0, views: new Map(), films: new Map(), ghost: false, from: 0, to: 1, token: 0, dirty: null };
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
  renderSide();
  const loaded = await Promise.all(s.versions.map(async (r) => [r,
    state.views.get(r.path) ?? await fetch(`/api/spec-view?spec=${encodeURIComponent(r.path)}&samples=900`).then(json),
    await fetch(`/api/spec-video?spec=${encodeURIComponent(r.path)}`).then(json).catch(() => ({}))]));
  if (token !== state.token) return;
  for (const [r, v, film] of loaded) {
    state.views.set(r.path, v);
    if (!film.video) continue;
    const el = document.createElement("video");
    Object.assign(el, { muted: true, playsInline: true, preload: "auto", src: `${film.video.url}?v=${encodeURIComponent(film.video.madeAt)}` });
    el.from = film.video.from ?? 0; el.stale = !film.video.current;
    state.films.set(r.path, el); $("stage").append(el);
  }
  const music = view(s.versions[0]).music;
  audio.src = music.audioUrl; audio.currentTime = 0;
  state.from = 0; state.to = duration();
  history.replaceState(null, "", `?song=${s.dir.split("/")[1]}&reading=${reading().reading}`);
  renderSide(); show(); draw();
}

/** Which film is seen. Every film keeps running under the one on top, so nothing has to load or seek at the change. */
function show() {
  const path = reading()?.path;
  for (const [p, el] of state.films) el.classList.toggle("on", p === path);
  let none = $("stage").querySelector(".none");
  if (!state.films.has(path)) { if (!none) { none = document.createElement("div"); none.className = "none"; none.textContent = "No video of this reading yet"; $("stage").append(none); } }
  else none?.remove();
}

async function setVersion(i) {
  const versions = song().versions;
  if (i < 0 || i >= versions.length || i === state.v) return;
  await flushWords();
  state.v = i;
  history.replaceState(null, "", `?song=${song().dir.split("/")[1]}&reading=${reading().reading}`);
  show(); renderSide(); draw();
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
  const last = r.revisions?.at(-1);
  $("by").textContent = BY[r.reading] ?? r.reading;
  $("intention").textContent = r.reading === "main" ? "The reading you reviewed and approved. The others keep its landings and change how the rider moves between them: air time, speed, height, and how hard each landing is."
    : (last?.summary ?? "").replace(/^The intention:\s*/, "") || "No intention written.";
  if (document.activeElement !== $("words")) $("words").value = r.note ?? "";
  $("saved").textContent = "";
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

// ---- the clock: the song's own sound; every film follows it
function toggle() { if (audio.paused) { if (audio.currentTime >= duration() - 0.05) audio.currentTime = 0; audio.play().catch(() => {}); } else audio.pause(); }
function seek(t) { audio.currentTime = clamp(t, 0, duration() - 0.01); }
function tick() {
  const t = audio.currentTime, playing = !audio.paused, shown = reading()?.path;
  for (const [path, el] of state.films) {
    if (el.readyState < 1) continue;
    const at = clamp(t - el.from, 0, el.duration || 0), running = playing && at < el.duration - 0.02;
    const slack = running ? (path === shown ? 0.1 : 0.25) : 0.005;
    if (!el.seeking && Math.abs(el.currentTime - at) > slack) el.currentTime = at;
    if (running && el.paused) el.play().catch(() => {}); else if (!running && !el.paused) el.pause();
  }
  $("play").textContent = playing ? "Pause" : "Play";
  $("clock").textContent = `${fmt(t)} / ${fmt(duration())}`;
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
  const x = (t) => (t - state.from) / (state.to - state.from) * W;
  const ink = css("--ink"), muted = css("--muted"), line = css("--line"), rust = css("--rust");
  ctx.font = "11px " + (css("--sans") || "sans-serif"); ctx.textBaseline = "middle";
  // phases, and the drop
  const top = 18;
  for (const p of v.overlayMeta?.phases ?? []) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = p.color ?? line; ctx.fillRect(x(p.t0), 0, x(p.t1) - x(p.t0) - 1, top);
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.save(); ctx.beginPath(); ctx.rect(x(p.t0), 0, x(p.t1) - x(p.t0) - 1, top); ctx.clip(); ctx.fillText(p.name, Math.max(x(p.t0), 0) + 6, top / 2 + 0.5); ctx.restore();
  }
  if (v.drop) { ctx.fillStyle = rust; ctx.globalAlpha = 0.06; ctx.fillRect(x(v.drop[0]), top, x(v.drop[1]) - x(v.drop[0]), H - top); ctx.globalAlpha = 1; }
  // landings: one stem each, as tall as the landing is hard
  const laneH = Math.max(30, Math.round((H - top - 16) * 0.2)), impactH = H - top - 16 - LANES.length * (laneH + 8), y0 = top + impactH;
  // one scale per curve for all the readings of the song, so that two readings are compared on the same ruler
  const scale = (axis) => { let lo = 1, hi = 0; for (const r of song().versions) for (const p of view(r)?.axes?.[axis]?.points ?? []) if (p[1] != null) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    const pad = Math.max(0.03, (hi - lo) * 0.12); return hi > lo ? [Math.max(0, lo - pad), Math.min(1, hi + pad)] : [0, 1]; };
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0 + 0.5); ctx.lineTo(W, y0 + 0.5); ctx.stroke();
  const ghost = state.ghost && v !== base;
  if (ghost) { ctx.strokeStyle = muted; ctx.globalAlpha = 0.55; for (const c of base.contacts) { const X = Math.round(x(c.t)) + 3.5, h = (c.impact ?? 0) * (impactH - 8); ctx.beginPath(); ctx.moveTo(X - 3, y0 - h); ctx.lineTo(X + 3, y0 - h); ctx.stroke(); } ctx.globalAlpha = 1; }
  for (const c of v.contacts) {
    const i = c.impact ?? 0, X = Math.round(x(c.t)) + 0.5, h = i * (impactH - 8);
    if (X < -4 || X > W + 4) continue;
    ctx.strokeStyle = ctx.fillStyle = i >= 0.75 ? rust : i >= 0.4 ? ink : muted; ctx.lineWidth = i >= 0.75 ? 2 : 1.2;
    ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y0 - h); ctx.stroke();
    ctx.beginPath(); ctx.arc(X, y0 - h, i >= 0.75 ? 3 : 2, 0, 7); ctx.fill();
  }
  // the curves between the landings
  LANES.forEach(([axis, label, colour], k) => {
    const y1 = y0 + 8 + k * (laneH + 8) + laneH, pts = v.axes?.[axis]?.points, c = css(colour), [lo, hi] = scale(axis);
    const y = (val) => y1 - (val - lo) / (hi - lo) * (laneH - 4);
    const path = (points) => { let pen = false; ctx.beginPath(); for (const [t, val] of points) { if (val == null) { pen = false; continue; } const X = x(t), Y = y(val); pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; } };
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y1 + 0.5); ctx.lineTo(W, y1 + 0.5); ctx.stroke();
    if (pts?.length) {
      const known = pts.filter((p) => p[1] != null);
      ctx.beginPath(); ctx.moveTo(x(known[0][0]), y1); for (const [t, val] of known) ctx.lineTo(x(t), y(val)); ctx.lineTo(x(known.at(-1)[0]), y1); ctx.closePath();
      ctx.fillStyle = c; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
      path(pts); ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.stroke();
    }
    const basePts = base.axes?.[axis]?.points;
    if (ghost && basePts?.length) { path(basePts); ctx.setLineDash([4, 3]); ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    ctx.fillStyle = muted; ctx.fillText(pts?.length ? `${label}  ${lo.toFixed(2)}–${hi.toFixed(2)}` : `${label}: not written in this reading`, 6, y1 - laneH + 7);
  });
  // seconds, and where we are
  ctx.fillStyle = muted; const step = [1, 2, 5, 10, 20].find((s) => (state.to - state.from) / s <= 14) ?? 30;
  for (let t = Math.ceil(state.from / step) * step; t <= state.to; t += step) ctx.fillText(fmt(t).replace(/\.0$/, ""), x(t) + 3, H - 7);
  const X = Math.round(x(audio.currentTime)) + 0.5; ctx.strokeStyle = rust; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke();
  $("legend").textContent = `${v.contacts.length} landings${ghost ? " · dashed and ticks: the approved reading" : ""}${state.to - state.from < duration() - 0.01 ? " · double-click for the whole song" : " · scroll to zoom"}`;
}

const timeAt = (event) => state.from + (event.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth * (state.to - state.from);
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); seek(timeAt(e)); });
canvas.addEventListener("pointermove", (e) => { if (e.buttons & 1) seek(timeAt(e)); });
canvas.addEventListener("dblclick", () => { state.from = 0; state.to = duration(); });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const span = state.to - state.from, d = duration();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const move = clamp((e.deltaX || e.deltaY) / canvas.clientWidth * span, -state.from, d - state.to); state.from += move; state.to += move; return; }
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
    : key === "c" ? () => $("words").focus() : key === "home" ? () => seek(0) : null;
  if (!act) return;
  e.preventDefault();
  if (!e.repeat || key.startsWith("arrow")) act();
});
start().catch((e) => { $("title").textContent = `Could not load: ${e.message}`; });
