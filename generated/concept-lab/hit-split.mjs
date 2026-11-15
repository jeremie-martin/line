// Hit split: the whole song plays while the owner chooses which way the colour split points at a hit (where red goes) and how
// far it goes by measured strength, against the production split (held or beside). Settings live in the address, and are saved
// per song. Only the split's direction and size change: the movement, boost and everything else are production's.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {FPS} from '/scripts/video/timing.js';
import {prepareHits, hitEffectsAt} from '/scripts/video/hits.js';
import {SPLIT_DEFAULT, DIRECTIONS, HALF, KNOCK, splitAmount, splitAt, redSide, travelBefore} from './hit-split-model.mjs';

const STUDY = 'hit-split-2026-11', KEYS = ['dir', 'swap', 'size', 'start'];
const TELL = {
  today: 'Production: red goes halfway between sideways and into the surface.',
  into: 'Red goes into the surface, the way the hit pushes.',
  out: 'Red goes out of the surface, the way the picture is carried after the hit.',
  outHalf: 'Red goes halfway between sideways and out of the surface.',
  side: 'Red goes sideways only, to the same side as production.',
  travel: 'Red goes the way the rider was moving just before the hit.',
  turn: 'Red goes into the surface for the first knock, then out of it while the picture is carried.'};
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1)), p = {...SPLIT_DEFAULT};
if (DIRECTIONS.includes(q.get('dir'))) p.dir = q.get('dir');
for (const k of ['swap', 'size', 'start']) if (q.has(k) && Number.isFinite(+q.get(k))) p[k] = +q.get(k);
p.swap = p.swap ? 1 : 0; p.size = Math.max(0, Math.min(3, p.size)); p.start = Math.max(0.1, Math.min(0.8, p.start));
if (['tiki', 'circus'].includes(q.get('song'))) $('song').value = q.get('song');
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {hits: 'v1'});
let ride, mine, today, time = 0, playing = false, rate = 1, loopFrom = null, holding = false, beside = false, ticket = 0, dots = [];

// ── which way: a hit on level ground and one on a slope ──────────────────
const R2 = Math.SQRT1_2, CASES = [
  {title: 'Level ground', n: {x: 0, y: -1}, t: {x: 1, y: 0}, travel: {x: 0.8, y: 0.6}},
  {title: '45° slope', n: {x: R2, y: -R2}, t: {x: R2, y: R2}, travel: {x: 0.5, y: 0.87}}];
function arrow(g, x1, y1, x2, y2, colour, extra = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 8;
  g.append(svg('line', {x1, y1, x2: x2 - 0.6 * h * Math.cos(a), y2: y2 - 0.6 * h * Math.sin(a), stroke: colour, 'stroke-width': 3, 'stroke-linecap': 'round', ...extra}));
  g.append(svg('path', {d: `M${x2},${y2}L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)}L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)}Z`, fill: colour, opacity: extra.opacity ?? 1}));
}
function drawDiagram() {
  const g = $('diagram'); g.replaceChildren();
  CASES.forEach((c, i) => {
    const P = {x: 220 * i + 110, y: 122}, at = (a, b) => ({x: P.x + c.t.x * a + c.n.x * b, y: P.y + c.t.y * a + c.n.y * b});
    g.append(svg('text', {x: 220 * i + 110, y: 16, 'text-anchor': 'middle', style: 'font-size:12px;fill:var(--ink)'}, c.title));
    const L = i ? 78 : 95, s0 = at(-L, 0), s1 = at(L, 0), b0 = at(L, -22), b1 = at(-L, -22);
    g.append(svg('path', {d: `M${s0.x},${s0.y}L${s1.x},${s1.y}L${b0.x},${b0.y}L${b1.x},${b1.y}Z`, fill: 'var(--line)', opacity: 0.6}));
    g.append(svg('line', {x1: s0.x, y1: s0.y, x2: s1.x, y2: s1.y, stroke: 'var(--ink)', 'stroke-width': 2}));
    const h0 = at(-58, 62), h1 = at(-58, 6), c0 = at(58, 6), c1 = at(58, 62);
    arrow(g, h0.x, h0.y, h1.x, h1.y, 'var(--move)'); g.append(svg('text', {x: h0.x, y: h0.y - 5, 'text-anchor': 'middle'}, 'hit'));
    arrow(g, c0.x, c0.y, c1.x, c1.y, 'var(--move)', {'stroke-dasharray': '4 4'}); g.append(svg('text', {x: c1.x, y: c1.y - 5, 'text-anchor': 'middle'}, 'carry'));
    const R = at(0, 16);
    if (p.dir === 'travel') {arrow(g, R.x - c.travel.x * 58, R.y - c.travel.y * 58, R.x - c.travel.x * 10, R.y - c.travel.y * 10, 'var(--ink)', {'stroke-dasharray': '2 4', 'stroke-width': 2});
      g.append(svg('text', {x: R.x - c.travel.x * 62, y: R.y - c.travel.y * 62 - 4, 'text-anchor': 'middle'}, 'travel'));}
    const pair = u => {const s = p.swap ? -1 : 1;
      arrow(g, R.x, R.y, R.x + s * u.x * 44, R.y + s * u.y * 44, 'var(--red)'); arrow(g, R.x, R.y, R.x - s * u.x * 44, R.y - s * u.y * 44, 'var(--blue)');};
    pair(redSide(p.dir, c.n, KNOCK * 2, c.travel));
    g.append(svg('circle', {cx: R.x, cy: R.y, r: 5, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 2}));
  });
  if (p.dir === 'turn') g.append(svg('text', {x: 220, y: 222, 'text-anchor': 'middle'}, 'drawn after the first knock; during it, red and blue are the other way round'));
  else if (p.dir === 'travel') g.append(svg('text', {x: 220, y: 222, 'text-anchor': 'middle'}, 'the rider\'s travel here is an example; on the song it is measured'));
}

// ── how far: each colour's move by strength ──────────────────────────────
const C = {W: 440, H: 230, L: 34, R: 10, T: 10, B: 26, s0: 0.1, s1: 1.05, hi: 60};
const cx = s => C.L + (s - C.s0) / (C.s1 - C.s0) * (C.W - C.L - C.R), cy = v => C.T + (C.hi - Math.min(C.hi, v)) / C.hi * (C.H - C.T - C.B);
const moveOf = (s, q = p) => HALF * splitAmount(s, q);
function drawCurve() {
  const g = $('curve'); g.replaceChildren();
  for (const v of [0, 20, 40, 60]) {g.append(svg('line', {x1: C.L, x2: C.W - C.R, y1: cy(v), y2: cy(v), stroke: v ? 'var(--line)' : 'var(--soft)', 'stroke-width': v ? 1 : 1.2})); g.append(svg('text', {x: C.L - 5, y: cy(v) + 4, 'text-anchor': 'end'}, v));}
  for (let s = 0.1; s <= 1.001; s += 0.1) g.append(svg('text', {x: cx(s), y: C.H - 8, 'text-anchor': 'middle'}, s.toFixed(1)));
  g.append(svg('text', {x: C.L + 4, y: C.T + 10}, 'px each colour moves'));
  const path = f => {let d = ''; for (let s = C.s0; s <= C.s1 + 1e-9; s += 0.005) d += `${d ? 'L' : 'M'}${cx(s).toFixed(1)},${cy(f(s)).toFixed(1)}`; return d;};
  g.append(svg('path', {d: path(s => moveOf(s, SPLIT_DEFAULT)), fill: 'none', stroke: 'var(--move)', 'stroke-width': 2, 'stroke-dasharray': '5 4'}));
  g.append(svg('path', {d: path(s => moveOf(s)), fill: 'none', stroke: 'var(--mine)', 'stroke-width': 2.5}));
  dots = (ride?.hits ?? []).map(h => {
    const c = svg('circle', {class: 'dot', cx: cx(Math.min(C.s1, Math.max(C.s0, h.strength))), cy: cy(moveOf(h.strength)), r: 3}); g.append(c);
    c.addEventListener('click', () => seek(h.time - ride.scene.timing.offset - 0.4)); return {h, c, lit: false};});
  g.append(svg('circle', {class: 'handle', id: 'hStart', cx: cx(p.start), cy: cy(0), r: 8}), svg('circle', {class: 'handle', id: 'hSize', cx: cx(0.85), cy: cy(moveOf(0.85)), r: 8}));
  if (ride) {const seen = ride.hits.filter(h => moveOf(h.strength) >= 3).length;
    $('readout').textContent = `${seen} of ${ride.hits.length} hits of this song move the colours 3 px or more. A medium hit (0.62) moves each colour ${moveOf(0.62).toFixed(0)} px, a strong one (0.85) ${moveOf(0.85).toFixed(0)} px; production moves them ${moveOf(0.62, SPLIT_DEFAULT).toFixed(0)} and ${moveOf(0.85, SPLIT_DEFAULT).toFixed(0)} px.`;}
}
function show() {
  for (const b of $('dirs').children) b.classList.toggle('on', b.dataset.dir === p.dir);
  $('swap').classList.toggle('on', !!p.swap);
  $('chosen').textContent = TELL[p.dir] + (p.swap ? ' Swapped: blue goes there, red the other way.' : '');
  $('sizeOut').textContent = p.size === 0 ? 'none' : `${p.size.toFixed(2)} × production`; $('startOut').textContent = p.start.toFixed(2);
  $('size').value = p.size; $('start').value = p.start;
  drawDiagram(); drawCurve(); light();
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, ...Object.fromEntries(KEYS.map(k => [k, p[k]]))}));
  if (!playing) draw();
}
for (const b of $('dirs').children) b.onclick = () => {p.dir = b.dataset.dir; show();};
$('swap').onclick = () => {p.swap = p.swap ? 0 : 1; show();};
for (const k of ['size', 'start']) $(k).oninput = () => {p[k] = +$(k).value; show();};
let dragging = null;
$('curve').addEventListener('pointerdown', e => {if (e.target.classList.contains('handle')) {dragging = e.target.id; $('curve').setPointerCapture(e.pointerId);}});
$('curve').addEventListener('pointermove', e => {
  if (!dragging) return;
  const box = $('curve').getBoundingClientRect(), x = (e.clientX - box.left) / box.width * C.W, y = (e.clientY - box.top) / box.height * C.H;
  if (dragging === 'hStart') p.start = Math.round(Math.max(0.1, Math.min(0.8, C.s0 + (x - C.L) / (C.W - C.L - C.R) * (C.s1 - C.s0))) * 100) / 100;
  else {const px = (C.H - C.B - y) / (C.H - C.T - C.B) * C.hi, ratio = px / moveOf(0.85, {...p, size: 1}); p.size = Math.round(Math.max(0, Math.min(3, ratio)) * 20) / 20;}
  show();
});
for (const type of ['pointerup', 'pointercancel']) $('curve').addEventListener(type, () => {dragging = null;});
function light() {
  if (!ride) return;
  const r = time + ride.scene.timing.offset;
  for (const d of dots) {const on = r >= d.h.time && r < d.h.time + 0.35; if (on !== d.lit) {d.lit = on; d.c.classList.toggle('lit', on); d.c.setAttribute('r', on ? 7 : 3);}}
}

// ── the picture ──────────────────────────────────────────────────────────
function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/hit-effects/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    const centres = replay.frames.map(f => {const ps = f.points.filter(q => BODY_POINTS.includes(q.name)); return {x: ps.reduce((s, q) => s + q.pos.x, 0) / ps.length, y: ps.reduce((s, q) => s + q.pos.y, 0) / ps.length};});
    const travel = new Map(), travelOf = h => {if (!travel.has(h.time)) travel.set(h.time, travelBefore(centres, h.time, FPS)); return travel.get(h.time);};
    return {scene, replay, sprites, travelOf, hits: prepareHits(scene.account, replay.contacts, centres, new Map(scene.track.lines.map(l => [l.id, l])))};
  })());
  return rides.get(song);
}
const pause = () => {if (playing) time = music.pause(); playing = false; $('play').textContent = 'Play';};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(time, rate);};
const seek = t => {const on = playing; pause(); time = Math.max(0, Math.min(ride.scene.span[1], t)); if (loopFrom !== null) loopFrom = time; draw(); if (on) void play();};
const nextStrong = () => {if (!ride) return; const off = ride.scene.timing.offset, h = ride.hits.find(h => h.strength >= 0.7 && h.time - off - 0.4 > time + 0.05) ?? ride.hits.find(h => h.strength >= 0.7); if (h) seek(h.time - off - 0.4);};
function draw() {
  if (!mine) return;
  if (beside) {mine.draw(time, look); today.draw(time, look);} else (holding ? today : mine).draw(time, look);
  $('seek').value = time; $('clock').textContent = `${time.toFixed(1)} s`; light();
}
function layout() {
  $('pair').classList.toggle('single', !beside); $('today').parentNode.classList.toggle('hidden', !beside && !holding); $('mine').parentNode.classList.toggle('hidden', !beside && holding);
  $('beside').classList.toggle('on', beside); $('hold').classList.toggle('on', holding); $('loop').classList.toggle('on', loopFrom !== null); $('half').classList.toggle('on', rate !== 1); draw();
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); mine = today = ride = null; $('play').disabled = true; $('status').textContent = 'Loading…'; window.__ready = false;
  const next = await loadRide(song); if (n !== ticket) return;
  await music.load('/' + next.scene.audio); if (n !== ticket) return;
  ride = next; time = Math.min(time, ride.scene.span[1]); $('seek').max = ride.scene.span[1]; loopFrom = null;
  const make = (id, effectsAt) => createPicture($(id), ride.scene, ride.replay, ride.sprites, N.riderPainter(), effectsAt ? {effectsAt} : {});
  const travelOf = ride.travelOf;
  mine = make('mine', (hits, t, ex, tune) => ({...hitEffectsAt(hits, t, ex, tune), ...splitAt(hits, t, p, travelOf, ex)})); today = make('today');
  $('play').disabled = false; $('status').textContent = ''; show(); layout(); window.__ready = true;
}
$('song').onchange = () => {time = 0; void load();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => seek(+$('seek').value);
$('next').onclick = nextStrong;
$('loop').onclick = () => {loopFrom = loopFrom === null ? time : null; layout();};
$('beside').onclick = () => {beside = !beside; layout();};
$('half').onclick = () => {rate = rate === 1 ? 0.5 : 1; layout(); if (playing) void play();};
const hold = on => {if (holding !== on) {holding = on; layout();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
for (const s of document.querySelectorAll('.screen')) s.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true);
  else if (e.key === 'n' || e.key === 'N') nextStrong();
  else if (e.key === ' ') {e.preventDefault(); playing ? pause() : void play();}
  else if (e.key === 'ArrowLeft' && e.target.type !== 'range') seek(time - 2); else if (e.key === 'ArrowRight' && e.target.type !== 'range') seek(time + 2);
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
$('save').onclick = async () => {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: $('song').value, skipped: false, answers: Object.fromEntries(KEYS.map(k => [k, p[k]])), note: $('note').value})});
  $('status').textContent = r.ok ? `Saved for ${$('song').selectedOptions[0].textContent} at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick(ts) {
  if (playing && mine) {
    time = music.position(shown(ts));
    const end = loopFrom !== null ? Math.min(ride.scene.span[1], loopFrom + 6) : ride.scene.span[1];
    if (time >= end) {if (loopFrom !== null) {time = loopFrom; void play();} else {pause(); time = end;}}
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.hitSplit = {state: () => ({time, p: {...p}, hits: ride?.hits.length, offset: ride?.scene.timing.offset, strong: ride?.hits.filter(h => h.strength >= 0.8).map(h => h.time)}),
  set: q => {Object.assign(p, q); show();}, seek: t => seek(t)};
await load();
