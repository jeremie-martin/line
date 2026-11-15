// Hit movement: the whole song plays under today's camera while the owner shapes carry's curve of measured strength
// (start, amount at 0.85), its timing and the shake's amount. Settings live in the address, and are saved per song.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {prepareHits, hitEffectsAt, shake as shakeAmount} from '/scripts/video/hits.js';
import {MOVE_DEFAULT, carryAmount, movementAt, singleHit} from './hit-move-model.mjs';

const STUDY = 'hit-curve-2026-11', KEYS = ['start', 'amount', 'shake', 'out', 'back'];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1)), p = {...MOVE_DEFAULT};
for (const k of KEYS) if (q.has(k) && Number.isFinite(+q.get(k))) p[k] = +q.get(k);
if (['tiki', 'circus'].includes(q.get('song'))) $('song').value = q.get('song');
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {hits: 'v1'});
let ride, mine, today, time = 0, playing = false, rate = 1, loopFrom = null, holding = false, beside = false, ticket = 0, dots = [];

// ── charts ───────────────────────────────────────────────────────────────
const C = {W: 440, H: 250, L: 34, R: 10, T: 10, B: 26, s0: 0.2, s1: 1.05, lo: -60, hi: 150};
const cx = s => C.L + (s - C.s0) / (C.s1 - C.s0) * (C.W - C.L - C.R), cy = v => C.T + (C.hi - v) / (C.hi - C.lo) * (C.H - C.T - C.B);
function drawCurve() {
  const g = $('curve'); g.replaceChildren();
  for (const v of [-50, 0, 50, 100, 150]) {g.append(svg('line', {x1: C.L, x2: C.W - C.R, y1: cy(v), y2: cy(v), stroke: v ? 'var(--line)' : 'var(--soft)', 'stroke-width': v ? 1 : 1.2})); g.append(svg('text', {x: C.L - 5, y: cy(v) + 4, 'text-anchor': 'end'}, Math.abs(v)));}
  for (let s = 0.2; s <= 1.001; s += 0.1) g.append(svg('text', {x: cx(s), y: C.H - 8, 'text-anchor': 'middle'}, s.toFixed(1)));
  g.append(svg('text', {x: C.L + 4, y: C.T + 10}, 'px out'), svg('text', {x: C.L + 4, y: cy(-50) + 4}, 'px in'));
  const path = f => {let d = ''; for (let s = C.s0; s <= C.s1 + 1e-9; s += 0.005) d += `${d ? 'L' : 'M'}${cx(s).toFixed(1)},${cy(f(s)).toFixed(1)}`; return d;};
  g.append(svg('path', {d: path(s => -shakeAmount(s) * p.shake), fill: 'none', stroke: 'var(--shake)', 'stroke-width': 2}));
  g.append(svg('path', {d: path(s => carryAmount(s, p)), fill: 'none', stroke: 'var(--carry)', 'stroke-width': 2.5}));
  dots = (ride?.hits ?? []).map(h => {const c = svg('circle', {class: 'dot', cx: cx(Math.min(C.s1, Math.max(C.s0, h.strength))), cy: cy(carryAmount(h.strength, p)), r: 3}); g.append(c); return {h, c, lit: false};});
  g.append(svg('circle', {class: 'handle', id: 'hStart', cx: cx(p.start), cy: cy(0), r: 8}), svg('circle', {class: 'handle', id: 'hAmount', cx: cx(0.85), cy: cy(p.amount), r: 8}));
  if (ride) {const moved = ride.hits.filter(h => carryAmount(h.strength, p) >= 5).length;
    $('readout').textContent = `${moved} of ${ride.hits.length} hits of this song carry the picture 5 px or more. A medium hit (0.62) goes ${carryAmount(0.62, p).toFixed(0)} px, a strong one (0.85) ${p.amount.toFixed(0)} px; today's shake gives them ${(shakeAmount(0.62) * p.shake).toFixed(0)} and ${(shakeAmount(0.85) * p.shake).toFixed(0)} px.`;}
}
const X = {W: 440, H: 190, L: 34, R: 10, T: 10, B: 24, t0: -0.05, t1: 1};
function drawTrace() {
  const g = $('trace'); g.replaceChildren();
  const hi = Math.max(40, p.amount * 1.1), lo = -Math.max(20, shakeAmount(0.85) * p.shake * 1.15), tx = t => X.L + (t - X.t0) / (X.t1 - X.t0) * (X.W - X.L - X.R), ty = v => X.T + (hi - v) / (hi - lo) * (X.H - X.T - X.B);
  g.append(svg('line', {x1: X.L, x2: X.W - X.R, y1: ty(0), y2: ty(0), stroke: 'var(--soft)'}), svg('line', {x1: tx(0), x2: tx(0), y1: X.T, y2: X.H - X.B, stroke: 'var(--line)'}));
  for (const t of [0, 0.25, 0.5, 0.75, 1]) g.append(svg('text', {x: tx(t), y: X.H - 7, 'text-anchor': 'middle'}, t ? `${t} s` : 'hit'));
  g.append(svg('text', {x: X.L - 5, y: ty(hi) + 9, 'text-anchor': 'end'}, hi.toFixed(0)), svg('text', {x: X.L - 5, y: ty(lo), 'text-anchor': 'end'}, Math.abs(lo).toFixed(0)), svg('text', {x: X.L + 4, y: X.T + 10}, 'px out'), svg('text', {x: X.L + 4, y: ty(lo) - 2}, 'px in'));
  for (const [s, o] of [[0.62, 0.45], [0.85, 1]]) {let d = ''; for (let t = X.t0; t <= X.t1; t += 1 / 480) d += `${d ? 'L' : 'M'}${tx(t).toFixed(1)},${ty(singleHit(s, t, p)).toFixed(1)}`; g.append(svg('path', {d, fill: 'none', stroke: 'var(--carry)', 'stroke-width': 2.2, opacity: o}));}
}
function show() {
  $('startOut').textContent = p.start.toFixed(2); $('amountOut').textContent = `${p.amount.toFixed(0)} px`; $('shakeOut').textContent = p.shake === 1 ? "today's" : p.shake === 0 ? 'none' : `${p.shake.toFixed(2)} × today's`;
  $('outOut').textContent = `${Math.round(p.out * 1000)} ms`; $('backOut').textContent = `${p.back.toFixed(2)} s`;
  for (const k of KEYS) $(k).value = p[k];
  drawCurve(); drawTrace(); light();
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, ...Object.fromEntries(KEYS.map(k => [k, p[k]]))}));
  if (!playing) draw();
}
for (const k of KEYS) $(k).oninput = () => {p[k] = +$(k).value; show();};
// drag the handles: the start along the axis, the amount up and down
let dragging = null;
$('curve').addEventListener('pointerdown', e => {if (e.target.classList.contains('handle')) {dragging = e.target.id; $('curve').setPointerCapture(e.pointerId);}});
$('curve').addEventListener('pointermove', e => {
  if (!dragging) return;
  const box = $('curve').getBoundingClientRect(), x = (e.clientX - box.left) / box.width * C.W, y = (e.clientY - box.top) / box.height * C.H;
  if (dragging === 'hStart') p.start = Math.round(Math.max(0.2, Math.min(0.8, C.s0 + (x - C.L) / (C.W - C.L - C.R) * (C.s1 - C.s0))) * 100) / 100;
  else p.amount = Math.round(Math.max(0, Math.min(140, C.hi - (y - C.T) / (C.H - C.T - C.B) * (C.hi - C.lo))));
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
    return {scene, replay, sprites, hits: prepareHits(scene.account, replay.contacts, centres, new Map(scene.track.lines.map(l => [l.id, l])))};
  })());
  return rides.get(song);
}
const pause = () => {if (playing) time = music.pause(); playing = false; $('play').textContent = 'Play';};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(time, rate);};
const seek = t => {const on = playing; pause(); time = Math.max(0, Math.min(ride.scene.span[1], t)); if (loopFrom !== null) loopFrom = time; draw(); if (on) void play();};
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
  mine = make('mine', (hits, t) => ({...hitEffectsAt(hits, t), ...movementAt(hits, t, p)})); today = make('today');
  $('play').disabled = false; $('status').textContent = ''; show(); layout(); window.__ready = true;
}
$('song').onchange = () => {time = 0; void load();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => seek(+$('seek').value);
$('loop').onclick = () => {loopFrom = loopFrom === null ? time : null; layout();};
$('beside').onclick = () => {beside = !beside; layout();};
$('half').onclick = () => {rate = rate === 1 ? 0.5 : 1; layout(); if (playing) void play();};
const hold = on => {if (holding !== on) {holding = on; layout();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
for (const s of document.querySelectorAll('.screen')) s.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true);
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
window.hitMove = {state: () => ({time, p, hits: ride?.hits.length}), drawAt: t => {time = t; draw(); return mine.draw(t, look);}};
await load();
