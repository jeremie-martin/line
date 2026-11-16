// Opening and ending: the last seconds of a ride run into its first seconds as a loop, while the owner shapes how the picture moves
// out to the whole course and back in to the rider (camera.js ENDS). Settings live in the address and are saved for every song.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {ENDS, ease} from '/scripts/video/camera.js';

const STUDY = 'bookends-2026-11', BEFORE = 5, AFTER = 5;
const KEYS = ['close.length', 'close.hold', 'close.leave', 'close.land', 'open.hold', 'open.length', 'open.leave', 'open.land'];
const PROPOSALS = [
  {name: 'Soft landing', about: 'Production now. Leaves the rider at once and takes its time arriving on the whole course, so no hold is needed; the opening lingers a moment on the course and lands on the rider.', ends: ENDS},
  {name: 'Even', about: 'The same ease at both ends of each move.', ends: {open: {hold: 0.25, length: 1.4, leave: 2, land: 2}, close: {hold: 0, length: 1.6, leave: 2, land: 2}, straight: true}},
  {name: 'Short', about: 'As little of the video as possible: 1.2 s out, 1.1 s in, with long soft landings.', ends: {open: {hold: 0.1, length: 1.1, leave: 2.4, land: 2.4}, close: {hold: 0, length: 1.2, leave: 1.5, land: 3}, straight: true}},
  {name: 'Unhurried', about: 'A breath on the whole course: 2.2 s out, held a moment, 1.8 s in.', ends: {open: {hold: 0.3, length: 1.8, leave: 3, land: 2}, close: {hold: 0.2, length: 2.2, leave: 2, land: 3}, straight: true}},
  {name: 'As before', about: 'The timing of the last comparison (Middle) and its path, which drifts across while it zooms.', ends: {open: {hold: 0.25, length: 1.2, leave: 2, land: 2}, close: {hold: 0, length: 1.6, leave: 2, land: 2}, straight: false}},
];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const copy = e => ({open: {...e.open}, close: {...e.close}, straight: e.straight});
const get = k => {const [a, b] = k.split('.'); return ends[a][b];}, set = (k, v) => {const [a, b] = k.split('.'); ends[a][b] = v;};
// the settings under the owner's hand; the picture reads them at every frame
const ends = copy(ENDS), q = new URLSearchParams(location.hash.slice(1));
for (const k of KEYS) if (q.has(k) && Number.isFinite(+q.get(k))) set(k, +q.get(k));
if (q.has('straight')) ends.straight = q.get('straight') !== '0';
for (const id of ['song', 'theme']) if ([...$(id).options].some(o => o.value === q.get(id))) $(id).value = q.get(id);
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
let ride, mine, today, look, at = 0, playing = false, rate = 1, holding = false, ticket = 0, cursor;

// the loop: `at` runs from 0 to BEFORE + AFTER; first the last seconds of the song, then its first
const songTime = a => a < BEFORE ? ride.scene.span[1] - BEFORE + a : a - BEFORE;
const followAt = (t, e) => {const end = ride.scene.span[1], from = end - e.close.hold - e.close.length;
  return t < e.open.hold + e.open.length ? ease((t - e.open.hold) / e.open.length, e.open.leave, e.open.land) : t > from ? 1 - ease((t - from) / e.close.length, e.close.leave, e.close.land) : 1;};

const C = {W: 440, H: 170, L: 10, R: 10, T: 12, B: 24};
const cx = a => C.L + a / (BEFORE + AFTER) * (C.W - C.L - C.R), cy = f => C.T + (1 - f) * (C.H - C.T - C.B);
function drawChart() {
  const g = $('chart'); g.replaceChildren(); if (!ride) return;
  g.append(svg('line', {x1: C.L, x2: C.W - C.R, y1: cy(0), y2: cy(0), stroke: 'var(--line)'}), svg('line', {x1: C.L, x2: C.W - C.R, y1: cy(1), y2: cy(1), stroke: 'var(--line)'}));
  g.append(svg('line', {x1: cx(BEFORE), x2: cx(BEFORE), y1: C.T - 4, y2: C.H - C.B + 4, stroke: 'var(--soft)', 'stroke-dasharray': '4 4'}));
  for (let s = -BEFORE + 1; s < AFTER; s++) if (s) g.append(svg('text', {x: cx(BEFORE + s), y: C.H - 7, 'text-anchor': 'middle'}, s < 0 ? `${-s} s left` : `${s} s`));
  const path = e => {let d = ''; for (let a = 0; a <= BEFORE + AFTER; a += 1 / 60) d += `${d ? 'L' : 'M'}${cx(a).toFixed(1)},${cy(followAt(songTime(Math.min(a, BEFORE + AFTER - 1e-6)), e)).toFixed(1)}`; return d;};
  g.append(svg('path', {d: path(ENDS), fill: 'none', stroke: 'var(--soft)', 'stroke-width': 1.2, opacity: 0.6}), svg('path', {d: path(ends), fill: 'none', stroke: 'var(--curve)', 'stroke-width': 2.5}));
  cursor = svg('line', {y1: C.T - 4, y2: C.H - C.B + 4, stroke: 'var(--ink)', 'stroke-width': 1}); g.append(cursor); place();
}
const place = () => {if (cursor) {cursor.setAttribute('x1', cx(at)); cursor.setAttribute('x2', cx(at));}};
const soft = v => v <= 1.05 ? 'abruptly' : v < 1.8 ? 'quickly' : v < 2.4 ? 'with an ease' : v < 3.2 ? 'softly' : 'very softly';
function show() {
  for (const k of KEYS) {$(k).value = get(k); $(k + 'Out').textContent = k.endsWith('leave') || k.endsWith('land') ? `${soft(get(k))} (${get(k).toFixed(1)})` : get(k) === 0 ? 'not at all' : `${get(k).toFixed(2)} s`;}
  $('straight').classList.toggle('on', ends.straight);
  const same = e => KEYS.every(k => {const [a, b] = k.split('.'); return Math.abs(e[a][b] - ends[a][b]) < 1e-9;}) && e.straight === ends.straight;
  [...$('presets').children].forEach((b, i) => b.classList.toggle('on', same(PROPOSALS[i].ends)));
  drawChart();
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, theme: $('theme').value, ...Object.fromEntries(KEYS.map(k => [k, get(k)])), straight: ends.straight ? 1 : 0}));
  if (!playing) draw();
}
for (const k of KEYS) $(k).oninput = () => {set(k, +$(k).value); show();};
$('straight').onclick = () => {ends.straight = !ends.straight; show();};
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
const pause = () => {if (playing) music.pause(); playing = false; $('play').textContent = 'Play';};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(songTime(at), rate);};
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
  $('play').disabled = false; $('status').textContent = ''; show(); window.__ready = true;
}
$('song').onchange = () => {at = 0; void load();};
$('theme').onchange = () => {look = resolveLook($('theme').value); show();};
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
    body: JSON.stringify({clip: 'all', skipped: false, answers: {...Object.fromEntries(KEYS.map(k => [k, get(k)])), straight: ends.straight, song: $('song').value}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick(ts) {
  if (playing && mine) {
    const t = music.position(shown(ts)), end = ride.scene.span[1];
    // in the last seconds until the song ends, then in the first seconds until they are over
    if (at < BEFORE) {if (t >= end - 1e-3) {at = BEFORE; void play();} else at = Math.max(0, t - (end - BEFORE));}
    else if (t >= AFTER && t < end - BEFORE) {at = 0; void play();} else if (t < AFTER) at = BEFORE + t;
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.endsPage = {state: () => ({at, ends}), drawAt: a => {at = a; draw();}};
await load();
