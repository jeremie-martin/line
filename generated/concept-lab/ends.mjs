// Opening and ending: the last seconds of a ride run into its first seconds as a loop, while the owner shapes how the picture moves
// out to the whole course and back in to the rider (camera.js ENDS). Settings live in the address and are saved for every song.
import {createMusic} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {ENDS} from '/scripts/video/camera.js';

const STUDY = 'bookends-2026-11', BEFORE = 5, AFTER = 5;
const KEYS = ['halve', 'turn', 'leave', 'land', 'swing', 'bow', 'lead'];
const PROPOSALS = [
  {name: 'Plain', about: 'Production now. An even zoom up and down; the camera swings right, sweeps left across the whole course, turns around on the way down, and the video starts already moving with the ride.', ends: ENDS},
  {name: 'Oval', about: 'Plain, flown as an oval: the camera also moves to one side at the top, so it never retraces its own path.', ends: {...ENDS, bow: 110}},
  {name: 'Wide swing', about: 'A bigger sweep across the course: more movement at the widest view.', ends: {...ENDS, swing: 220}},
  {name: 'From the side', about: 'A large swing and a later cut: the video starts beside the course and the start slides into the frame, so everything flows one way.', ends: {...ENDS, swing: 340, lead: 0.8}},
  {name: 'Slow', about: 'A calmer zoom and a wider turn; each side takes about half a second more.', ends: {...ENDS, halve: 0.22, turn: 0.7}},
  {name: 'At rest', about: 'For comparison: no swing, cut on the whole course standing still.', ends: {...ENDS, lead: 0, swing: 0}},
];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const copy = e => ({...e}), read = (e, k) => e[k], get = k => ends[k], set = (k, v) => {ends[k] = v;};
// the settings under the owner's hand; the picture reads them at every frame
const ends = copy(ENDS), q = new URLSearchParams(location.hash.slice(1));
for (const k of KEYS) if (q.has(k) && Number.isFinite(+q.get(k))) set(k, +q.get(k));
if (q.has('pencil')) ends.pencil = q.get('pencil') === '1';
for (const id of ['song', 'theme']) if ([...$(id).options].some(o => o.value === q.get(id))) $(id).value = q.get(id);
const music = createMusic(), sheet = N.loadSheet(), rides = new Map();
let ride, mine, today, look, at = 0, playing = false, rate = 1, holding = false, ticket = 0, cursor;

// the loop: `at` runs from 0 to BEFORE + AFTER; first the last seconds of the song, then its first
const songTime = a => a < BEFORE ? ride.scene.span[1] - BEFORE + a : a - BEFORE;
// ── what the camera does over the loop: measured on the picture's own camera, 60 times a second ─────────────────────────
// For points along the course that are inside the frame: how fast they move on screen (px/s).
const RATE = 60, FW = 1080, FH = 1920;
function measure(pic, e = null) {
  const end = ride.scene.span[1], n = (BEFORE + AFTER) * RATE, cams = [], keep = e ? copy(ends) : null;
  if (e) Object.assign(ends, copy(e));
  for (let i = 0; i <= n; i++) {const tau = i / RATE - BEFORE; cams.push(pic.cameraAt(tau < 0 ? end + tau : tau, look));}
  const pts = ride.points, at = (c, q) => [FW / 2 + c.z * (q.x - c.x), FH / 2 + c.z * (q.y - c.y)], rows = [];
  for (let i = 1; i < n; i++) {
    let v = 0, m = 0;
    for (const q of pts) {
      const s0 = at(cams[i - 1], q), s1 = at(cams[i], q), s2 = at(cams[i + 1], q);
      if (s1[0] < 0 || s1[0] > FW || s1[1] < 0 || s1[1] > FH) continue;
      m++; v += Math.hypot(s2[0] - s0[0], s2[1] - s0[1]) * RATE / 2;
    }
    rows.push({tau: i / RATE - BEFORE, seen: m, v: m ? v / m : rows.at(-1)?.v ?? 0, // with no point of the course in the frame, as the moment before
      zoom: cams[i].z, rate: Math.log(cams[i + 1].z / cams[i - 1].z) * RATE / 2, cam: cams[i]});
  }
  const [out, back] = pic.endsLengths(), moving = rows.filter(r => r.tau >= -out && r.tau <= back), calm = rows.filter(r => r.tau < -out - 0.2 || r.tau > back + 0.2);
  const median = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0, max = (a, k) => a.reduce((mx, r) => Math.max(mx, Math.abs(r[k])), 0);
  const cut = rows.find(r => r.tau >= 0) ?? rows[0];
  const lengths = [out, back];
  if (keep) Object.assign(ends, keep);
  return {rows, lengths, rideSpeed: median(calm.map(r => r.v)), fastest: max(moving, 'v'), rate: max(moving, 'rate'),
    slowest: Math.min(...moving.filter(r => r.seen > 2 && r.tau < back - 0.15).map(r => r.v)), atCut: cut.v};
}
const C = {W: 440, H: 150, L: 10, R: 10, T: 12, B: 24};
const cx = a => C.L + a / (BEFORE + AFTER) * (C.W - C.L - C.R);
let cursors = [], last = null;
function frame(g, labels = true) {
  g.replaceChildren();
  g.append(svg('line', {x1: C.L, x2: C.W - C.R, y1: C.H - C.B, y2: C.H - C.B, stroke: 'var(--line)'}), svg('line', {x1: cx(BEFORE), x2: cx(BEFORE), y1: C.T - 4, y2: C.H - C.B + 4, stroke: 'var(--soft)', 'stroke-dasharray': '4 4'}));
  if (labels) for (let s = -BEFORE + 1; s < AFTER; s++) if (s) g.append(svg('text', {x: cx(BEFORE + s), y: C.H - 7, 'text-anchor': 'middle'}, s < 0 ? `${-s} s left` : `${s} s`));
  const c = svg('line', {y1: C.T - 4, y2: C.H - C.B + 4, stroke: 'var(--ink)', 'stroke-width': 1}); g.append(c); cursors.push(c);
}
const line = (rows, y, attrs) => svg('path', {d: rows.map((r, i) => `${i ? 'L' : 'M'}${cx(r.tau + BEFORE).toFixed(1)},${y(r).toFixed(1)}`).join(''), fill: 'none', ...attrs});
function drawChart() {
  if (!ride || !mine) return;
  cursors = []; const m = last = measure(mine), ref = ride.production ??= measure(today), y = (v, top) => C.T + (1 - Math.min(1, v / top)) * (C.H - C.T - C.B);
  // the zoom, on a scale of ratios: top on the rider, bottom the whole course
  const zs = m.rows.map(r => Math.log(r.zoom)), z0 = Math.min(...zs), z1 = Math.max(...zs), zy = r => y(Math.log(r.zoom) - z0, z1 - z0 || 1);
  frame($('zoomChart')); $('zoomChart').append(line(ref.rows, zy, {stroke: 'var(--soft)', 'stroke-width': 1.2, opacity: 0.6}), line(m.rows, zy, {stroke: 'var(--curve)', 'stroke-width': 2.5}));
  // how fast the course moves on screen
  const top = Math.max(m.fastest, ref.fastest, m.rideSpeed) * 1.08, vy = r => y(r.v, top);
  frame($('flowChart')); $('flowChart').append(svg('line', {x1: C.L, x2: C.W - C.R, y1: y(m.rideSpeed, top), y2: y(m.rideSpeed, top), stroke: 'var(--soft)', 'stroke-dasharray': '2 5'}), svg('text', {x: C.W - C.R, y: y(m.rideSpeed, top) - 4, 'text-anchor': 'end'}, 'the ride itself'),
    line(ref.rows, vy, {stroke: 'var(--soft)', 'stroke-width': 1.2, opacity: 0.6}), line(m.rows, vy, {stroke: 'var(--curve)', 'stroke-width': 2.5}));
  const n = v => Math.round(v).toLocaleString('en'), halves = m.rate ? Math.round(Math.LN2 / m.rate * 1000) : 0;
  $('numbers').innerHTML = '';
  for (const [label, value, was] of [
    ['On this song the ending takes', `${m.lengths[0].toFixed(1)} s, the opening ${m.lengths[1].toFixed(1)} s`, `${ref.lengths[0].toFixed(1)} s and ${ref.lengths[1].toFixed(1)} s`],
    ['Fastest the course moves on screen', `${n(m.fastest)} px/s`, `${n(ref.fastest)}; the ride itself ${n(m.rideSpeed)}`],
    ['Slowest it gets before the ride takes over (0 is a standstill)', `${n(m.slowest)} px/s`, n(ref.slowest)],
    ['At the cut, where the video starts again', `${n(m.atCut)} px/s`, n(ref.atCut)],
    ['Zoom at its fastest', `the picture halves or doubles every ${halves} ms`, `${Math.round(Math.LN2 / ref.rate * 1000)} ms`]]) {
    const row = document.createElement('div'); row.className = 'number'; row.append(Object.assign(document.createElement('span'), {textContent: label}), Object.assign(document.createElement('b'), {textContent: value}), Object.assign(document.createElement('i'), {textContent: `production: ${was}`})); $('numbers').append(row);}
  drawMap(); place();
}
// the course from above, with the path of the camera's centre over the loop and the frame it shows now
const M = {W: 440, H: 240, P: 14};
function drawMap() {
  const g = $('map'); g.replaceChildren(); if (!last) return;
  const pts = ride.points, xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((M.W - 2 * M.P) / (x1 - x0 || 1), (M.H - 2 * M.P) / (y1 - y0 || 1)) * 0.8, ox = M.W / 2 - k * (x0 + x1) / 2, oy = M.H / 2 - k * (y0 + y1) / 2;
  ride.map = {k, ox, oy};
  const d = (list, f) => list.map((p, i) => `${i ? 'L' : 'M'}${(ox + k * f(p).x).toFixed(1)},${(oy + k * f(p).y).toFixed(1)}`).join('');
  g.append(svg('path', {d: d(pts, p => p), fill: 'none', stroke: 'var(--soft)', 'stroke-width': 1.5}));
  g.append(svg('path', {d: d(last.rows.filter(r => r.tau < 0), r => r.cam), fill: 'none', stroke: 'var(--hot)', 'stroke-width': 2}), svg('path', {d: d(last.rows.filter(r => r.tau >= 0), r => r.cam), fill: 'none', stroke: 'var(--curve)', 'stroke-width': 2}));
  ride.box = svg('rect', {fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2}); g.append(ride.box);
}
const place = () => {
  for (const c of cursors) {c.setAttribute('x1', cx(at)); c.setAttribute('x2', cx(at));}
  if (!last || !ride?.box) return;
  const r = last.rows[Math.max(0, Math.min(last.rows.length - 1, Math.round(at * RATE) - 1))], {k, ox, oy} = ride.map, w = Math.max(3, k * FW / r.zoom), h = Math.max(3, k * FH / r.zoom);
  for (const [name, v] of [['x', ox + k * r.cam.x - w / 2], ['y', oy + k * r.cam.y - h / 2], ['width', w], ['height', h]]) ride.box.setAttribute(name, v.toFixed(1));
};
const sec = v => `${v.toFixed(2)} s`;
const TEXT = {
  halve: v => `${Math.round(v * 1000)} ms`, turn: sec, leave: sec, land: sec,
  swing: v => v ? `${v.toFixed(0)} px each way` : 'none', bow: v => v ? `${Math.abs(v).toFixed(0)} px ${v > 0 ? 'to one side' : 'to the other'}` : 'none',
  lead: v => v ? `${v.toFixed(2)} s after the widest view` : 'at the widest view',
};
function show() {
  for (const k of KEYS) {$(k).value = get(k); $(k + 'Out').textContent = TEXT[k](get(k));}
  $('pencil').classList.toggle('on', ends.pencil);
  const same = e => KEYS.every(k => Math.abs(read(e, k) - get(k)) < 1e-9) && e.pencil === ends.pencil;
  [...$('presets').children].forEach((b, i) => b.classList.toggle('on', same(PROPOSALS[i].ends)));
  drawChart();
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, theme: $('theme').value, ...Object.fromEntries(KEYS.map(k => [k, get(k)])), pencil: ends.pencil ? 1 : 0}));
  if (!playing) draw();
}
for (const k of KEYS) $(k).oninput = () => {set(k, +$(k).value); show();};
$('pencil').onclick = () => {ends.pencil = !ends.pencil; show();};
PROPOSALS.forEach(pr => {const b = document.createElement('button'); b.innerHTML = `<b></b><span></span>`; b.firstChild.textContent = pr.name; b.lastChild.textContent = pr.about;
  b.onclick = () => {Object.assign(ends, copy(pr.ends)); show();}; $('presets').append(b);});

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/lab-rides/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    return {scene, replay, sprites};
  })());
  return rides.get(song);
}
// the loop runs on the page's own clock, so the picture never waits for the music at the cut; the music is started again at
// the cut and at the loop's return, and follows
let from = 0, started = 0;
const pause = () => {if (playing) {music.pause(); at = position(performance.now());} playing = false; $('play').textContent = 'Play';};
const position = now => (from + (now - started) / 1000 * rate) % (BEFORE + AFTER);
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; from = at; started = performance.now(); await music.play(songTime(at), rate);};
function draw() {
  if (!mine) return;
  (holding ? today : mine).draw(songTime(at), look);
  $('seek').value = at; $('clock').textContent = at < BEFORE ? `${(BEFORE - at).toFixed(1)} s left` : `${(at - BEFORE).toFixed(1)} s`; place();
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); mine = today = ride = null; $('play').disabled = true; $('status').textContent = 'Loading…'; window.__ready = false;
  const next = await loadRide(song); if (n !== ticket) return;
  await music.load('/' + next.scene.audio); if (n !== ticket) return;
  ride = next; look = resolveLook($('theme').value);
  mine = createPicture($('mine'), ride.scene, ride.replay, ride.sprites, N.riderPainter(), {ends});
  today = createPicture($('mine'), ride.scene, ride.replay, ride.sprites, N.riderPainter());
  ride.points = mine.centres.filter((_, i) => i % 4 === 0);
  $('play').disabled = false; $('status').textContent = ''; show(); window.__ready = true;
}
$('song').onchange = () => {at = 0; void load();};
$('theme').onchange = () => {look = resolveLook($('theme').value); ride.production = null; show();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => {const on = playing; pause(); at = +$('seek').value; draw(); if (on) void play();};
$('half').onclick = () => {rate = rate === 1 ? 0.5 : 1; $('half').classList.toggle('on', rate !== 1); if (playing) void play();};
const hold = on => {if (holding !== on) {holding = on; $('hold').classList.toggle('on', on); draw();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
$('mine').parentNode.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true);
  else if (e.key === ' ') {e.preventDefault(); playing ? pause() : void play();}
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
$('save').onclick = async () => {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: 'all', skipped: false, answers: {...Object.fromEntries(KEYS.map(k => [k, get(k)])), pencil: ends.pencil, song: $('song').value}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick() {
  if (playing && mine) {
    const before = at; at = position(performance.now());
    if ((before < BEFORE) !== (at < BEFORE)) void music.play(songTime(at), rate); // crossed the cut or the loop's return
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.endsPage = {state: () => ({at, ends}), drawAt: a => {at = a; draw();}, proposals: PROPOSALS, measure: e => {const m = measure(mine, e); delete m.rows; return m;}};
await load();
