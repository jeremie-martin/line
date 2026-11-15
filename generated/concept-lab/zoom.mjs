// Zoom: the whole song plays with a zoom written for it (keyframes on one fixed scale, scripts/video/zoom.js; the song's lanes come with the scene),
// against the production picture (held or beside). The zoom is drawn over the whole song and its points can be moved. Settings live in the address and are saved per song.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {prepareHits} from '/scripts/video/hits.js';
import {rideSignals} from '/scripts/video/camera.js';
import {rideIntensity} from '/scripts/video/intensity.js';
import {RANGE, wideAt, laneScale, zoomOfWide} from '/scripts/video/zoom.js';

const STUDY = 'zoom-2026-11';
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1));
if (['petrunko', 'trouble', 'tiki', 'circus'].includes(q.get('song'))) $('song').value = q.get('song');
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {hits: 'v1'});
// the zoom being looked at: a draft's id and its keyframes, which may have been moved
let lane = q.get('lane') ?? 'steady', keys = (q.get('k') ?? '').split(',').filter(Boolean).map(s => {const [t, wide] = s.split(':').map(Number); return {t, wide};}).filter(k => Number.isFinite(k.t) && Number.isFinite(k.wide));
let ride, lanes = [], mine, today, scale, time = 0, playing = false, holding = false, beside = false, ticket = 0, cursor, pending = 0;

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/hit-effects/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    const centres = replay.frames.map(f => {const ps = f.points.filter(q => BODY_POINTS.includes(q.name)); return {x: ps.reduce((s, q) => s + q.pos.x, 0) / ps.length, y: ps.reduce((s, q) => s + q.pos.y, 0) / ps.length};});
    const hits = prepareHits(scene.account, replay.contacts, centres, new Map(scene.track.lines.map(l => [l.id, l]))), motion = rideSignals(centres);
    const level = rideIntensity(motion.velocity.map(v => v.speed), hits, scene.track.duration / 40);
    return {scene, replay, sprites, hits, level, frames: centres.length};
  })());
  return rides.get(song);
}
// ── the zoom over the song ───────────────────────────────────────────────
const L = {W: 1180, H: 150, L: 58, R: 10, T: 18, B: 22};
const end = () => ride.scene.span[1], tx = t => L.L + t / end() * (L.W - L.L - L.R), wy = w => L.T + w * (L.H - L.T - L.B);
function drawLine() {
  const g = $('line'); g.replaceChildren(); if (!ride) return;
  const off = ride.scene.timing.offset;
  ride.scene.phases.forEach((ph, i) => {
    if (i % 2) g.append(svg('rect', {x: tx(ph.t0), y: L.T, width: tx(Math.min(end(), ph.t1)) - tx(ph.t0), height: L.H - L.T - L.B, fill: 'var(--soft)', opacity: 0.06}));
    g.append(svg('text', {x: tx(ph.t0) + 4, y: 12}, ph.name.toLowerCase()));
  });
  let area = `M${tx(0)},${L.H - L.B}`; ride.level.forEach((v, i) => {area += `L${tx(Math.min(end(), Math.max(0, i / 10 - off))).toFixed(1)},${(L.H - L.B - v * 34).toFixed(1)}`;}); area += `L${tx(end())},${L.H - L.B}Z`;
  g.append(svg('path', {d: area, fill: 'var(--soft)', opacity: 0.18}));
  for (const h of ride.hits) if (h.strength >= 0.55) g.append(svg('line', {x1: tx(h.time - off), x2: tx(h.time - off), y1: L.H - L.B, y2: L.H - L.B - 4 - 14 * Math.min(1, (h.strength - 0.55) / 0.45), stroke: 'var(--hot)', 'stroke-width': 1.5}));
  for (const [w, name] of [[0, 'closest'], [0.5, 'today'], [1, 'widest']]) {g.append(svg('line', {x1: L.L, x2: L.W - L.R, y1: wy(w), y2: wy(w), stroke: w === 0.5 ? 'var(--soft)' : 'var(--line)', 'stroke-dasharray': w === 0.5 ? '4 4' : ''})); g.append(svg('text', {x: L.L - 5, y: wy(w) + 4, 'text-anchor': 'end'}, name));}
  for (let t = 0; t <= end(); t += 10) g.append(svg('text', {x: tx(t), y: L.H - 6, 'text-anchor': 'middle'}, `${t} s`));
  let d = ''; for (let t = 0; t <= end(); t += 0.1) d += `${d ? 'L' : 'M'}${tx(t).toFixed(1)},${wy(wideAt(keys, t)).toFixed(1)}`;
  g.append(svg('path', {d, fill: 'none', stroke: 'var(--zoom)', 'stroke-width': 2.5}));
  keys.forEach((k, i) => {const c = svg('circle', {class: 'handle', cx: tx(k.t), cy: wy(k.wide), r: 7}); c.dataset.i = i; g.append(c);});
  cursor = svg('line', {y1: L.T, y2: L.H - L.B, stroke: 'var(--ink)', 'stroke-width': 1.5, 'pointer-events': 'none'}); g.append(cursor); place();
}
function place() {if (cursor && ride) {cursor.setAttribute('x1', tx(time)); cursor.setAttribute('x2', tx(time));}}
const at = e => {const box = $('line').getBoundingClientRect(), x = (e.clientX - box.left) / box.width * L.W, y = (e.clientY - box.top) / box.height * L.H;
  return {t: Math.max(0, Math.min(end(), (x - L.L) / (L.W - L.L - L.R) * end())), wide: Math.max(0, Math.min(1, (y - L.T) / (L.H - L.T - L.B)))};};
let dragging = -1, moved = false;
$('line').addEventListener('pointerdown', e => {moved = false; if (e.target.classList.contains('handle')) {dragging = +e.target.dataset.i; $('line').setPointerCapture(e.pointerId);}});
$('line').addEventListener('pointermove', e => {
  if (dragging < 0) return;
  const pnt = at(e), lo = dragging ? keys[dragging - 1].t + 0.05 : 0, hi = dragging < keys.length - 1 ? keys[dragging + 1].t - 0.05 : end();
  keys[dragging] = {t: +Math.max(lo, Math.min(hi, pnt.t)).toFixed(2), wide: +pnt.wide.toFixed(3)}; moved = true; change();
});
$('line').addEventListener('pointerup', e => {if (!ride) return; if (dragging < 0 && !moved && e.detail < 2) seek(at(e).t); dragging = -1;});
$('line').addEventListener('dblclick', e => {
  if (!ride) return;
  if (e.target.classList.contains('handle')) {if (keys.length > 1) keys.splice(+e.target.dataset.i, 1);}
  else {const pnt = at(e); keys.push({t: +pnt.t.toFixed(2), wide: +pnt.wide.toFixed(3)}); keys.sort((a, b) => a.t - b.t);}
  change();
});

// ── settings ─────────────────────────────────────────────────────────────
function build() {
  const {scene, replay, sprites} = ride; scale = laneScale(keys, ride.frames, scene.timing.offset);
  // the picture takes the zoom as a video does: the scene's lane. It keeps the keyframes it was built with.
  mine = createPicture($('mine'), {...scene, zoom: {keyframes: keys.map(k => ({...k}))}}, replay, sprites, N.riderPainter());
  if (!playing) draw();
}
const same = (a, b) => a.length === b.length && a.every((k, i) => Math.abs(k.t - b[i].t) < 0.005 && Math.abs(k.wide - b[i].wide) < 0.0005);
function change() {
  const draft = lanes.find(l => l.id === lane), edited = draft && !same(keys, draft.keyframes);
  for (const b of $('sources').children) b.classList.toggle('on', b.dataset.id === lane);
  $('about').textContent = (draft?.about ?? '') + (edited ? ' You have moved its points.' : ''); $('reset').disabled = !edited;
  const w = keys.map(k => k.wide), lo = Math.min(...w), hi = Math.max(...w);
  $('readout').textContent = hi > lo ? `${keys.length} points. The picture goes from ${zoomOfWide(lo).toFixed(2)} to ${zoomOfWide(hi).toFixed(2)} times today's zoom: its widest moment shows ${(zoomOfWide(lo) / zoomOfWide(hi)).toFixed(2)} times more than its closest (the scale allows ${RANGE}).` : `One zoom for the whole ride, ${zoomOfWide(lo).toFixed(2)} times today's.`;
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, lane, k: keys.map(k => `${k.t}:${k.wide}`).join(',')}));
  drawLine();
  // a new zoom means a new camera path: rebuild the picture shortly after the last change
  clearTimeout(pending); pending = setTimeout(build, 120);
}
function choose(id) {lane = id; keys = lanes.find(l => l.id === id).keyframes.map(k => ({...k})); change();}
$('reset').onclick = () => choose(lane);

// ── the picture ──────────────────────────────────────────────────────────
const pause = () => {if (playing) time = music.pause(); playing = false; $('play').textContent = 'Play';};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(time);};
function seek(t) {const on = playing; pause(); time = Math.max(0, Math.min(ride.scene.span[1], t)); draw(); if (on) void play();}
function draw() {
  if (!mine) return;
  if (beside) {mine.draw(time, look); today.draw(time, look);} else (holding ? today : mine).draw(time, look);
  $('seek').value = time; $('clock').textContent = `${time.toFixed(1)} s`; place();
}
function layout() {
  $('pair').classList.toggle('single', !beside); $('today').parentNode.classList.toggle('hidden', !beside && !holding); $('mine').parentNode.classList.toggle('hidden', !beside && holding);
  $('beside').classList.toggle('on', beside); $('hold').classList.toggle('on', holding); draw();
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); mine = today = ride = null; $('play').disabled = true; $('status').textContent = 'Loading…'; window.__ready = false;
  const next = await loadRide(song); if (n !== ticket) return;
  await music.load('/' + next.scene.audio); if (n !== ticket) return;
  ride = next; time = Math.min(time, ride.scene.span[1]); $('seek').max = ride.scene.span[1];
  lanes = [{id: 'steady', name: 'Steady', about: 'One zoom for the whole ride: what a song without lanes gets.', keyframes: [{t: 0, wide: 0.5}]}, ...ride.scene.zooms];
  $('sources').replaceChildren(...lanes.map(l => {const b = Object.assign(document.createElement('button'), {textContent: l.name, onclick: () => choose(l.id)}); b.dataset.id = l.id; return b;}));
  if (!lanes.some(l => l.id === lane) || !keys.length || keys.at(-1).t > ride.scene.span[1]) {lane = lanes.some(l => l.id === lane) ? lane : 'steady'; keys = lanes.find(l => l.id === lane).keyframes.map(k => ({...k}));}
  today = createPicture($('today'), {...ride.scene, zoom: null}, ride.replay, ride.sprites, N.riderPainter()); // beside: the steady zoom
  build(); change(); $('play').disabled = false; $('status').textContent = ''; layout(); window.__ready = true;
}
$('song').onchange = () => {time = 0; keys = []; void load();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => seek(+$('seek').value);
$('beside').onclick = () => {beside = !beside; layout();};
const hold = on => {if (holding !== on) {holding = on; layout();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
for (const s of document.querySelectorAll('.screen')) s.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true);
  else if (e.key === ' ') {e.preventDefault(); playing ? pause() : void play();}
  else if (e.key === 'ArrowLeft' && e.target.type !== 'range') seek(time - 5); else if (e.key === 'ArrowRight' && e.target.type !== 'range') seek(time + 5);
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
$('save').onclick = async () => {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: $('song').value, skipped: false, answers: {lane, keyframes: keys}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved for ${$('song').selectedOptions[0].textContent} at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick(ts) {
  if (playing && mine) {time = music.position(shown(ts)); if (time >= ride.scene.span[1]) {pause(); time = ride.scene.span[1];} draw();}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.zoomLab = {choose, state: () => ({time, lane, keys, range: scale ? [Math.min(...scale), Math.max(...scale)] : null}), drawAt: t => {time = t; draw(); return mine.draw(t, look);}};
await load();
