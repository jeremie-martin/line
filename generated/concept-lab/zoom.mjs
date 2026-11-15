// Zoom: the whole song plays while the owner chooses what the zoom follows and how much (zoom-model.mjs), against the production
// picture (held or beside). The zoom is drawn over the whole song. Settings live in the address and are saved per song.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {prepareHits} from '/scripts/video/hits.js';
import {createFraming, rideSignals} from '/scripts/video/camera.js';
import {rideIntensity} from '/scripts/video/intensity.js';
import {ZOOM_DEFAULT, SOURCES, zoomScale} from './zoom-model.mjs';

const STUDY = 'zoom-2026-11', DIALS = ['close', 'amount', 'ease'];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1)), p = {...ZOOM_DEFAULT};
for (const k of DIALS) if (q.has(k) && Number.isFinite(+q.get(k))) p[k] = +q.get(k);
if (Object.hasOwn(SOURCES, q.get('source'))) p.source = q.get('source');
p.flip = q.get('flip') === '1';
if (['tiki', 'circus'].includes(q.get('song'))) $('song').value = q.get('song');
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {hits: 'v1'});
let ride, mine, today, scale, time = 0, playing = false, holding = false, beside = false, ticket = 0, cursor, pending = 0;

$('sources').replaceChildren(...Object.entries(SOURCES).map(([id, [name]]) => {const b = Object.assign(document.createElement('button'), {textContent: name, onclick: () => {p.source = id; change();}}); b.dataset.id = id; return b;}));

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/hit-effects/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    const centres = replay.frames.map(f => {const ps = f.points.filter(q => BODY_POINTS.includes(q.name)); return {x: ps.reduce((s, q) => s + q.pos.x, 0) / ps.length, y: ps.reduce((s, q) => s + q.pos.y, 0) / ps.length};});
    const hits = prepareHits(scene.account, replay.contacts, centres, new Map(scene.track.lines.map(l => [l.id, l]))), motion = rideSignals(centres);
    const level = rideIntensity(motion.velocity.map(v => v.speed), hits, scene.track.duration / 40);
    return {scene, replay, sprites, hits, level, model: {frames: centres.length, level, speed: Float64Array.from(motion.velocity, v => v.speed), phases: scene.phases, keyframes: scene.authoredCamera?.zoom?.keyframes ?? null}};
  })());
  return rides.get(song);
}
// ── the zoom over the song ───────────────────────────────────────────────
const L = {W: 1180, H: 150, L: 40, R: 10, T: 18, B: 22, lo: Math.log(0.3), hi: Math.log(1.7)};
function drawLine() {
  const g = $('line'); g.replaceChildren(); if (!ride) return;
  const end = ride.scene.span[1], off = ride.scene.timing.offset, tx = t => L.L + t / end * (L.W - L.L - L.R), zy = z => L.T + (L.hi - Math.log(z)) / (L.hi - L.lo) * (L.H - L.T - L.B);
  ride.scene.phases.forEach((ph, i) => {
    if (i % 2) g.append(svg('rect', {x: tx(ph.t0), y: L.T, width: tx(Math.min(end, ph.t1)) - tx(ph.t0), height: L.H - L.T - L.B, fill: 'var(--soft)', opacity: 0.06}));
    g.append(svg('text', {x: tx(ph.t0) + 4, y: 12}, ph.name.toLowerCase()));
  });
  let area = `M${tx(0)},${L.H - L.B}`; ride.level.forEach((v, i) => {area += `L${tx(Math.min(end, Math.max(0, i / 10 - off))).toFixed(1)},${(L.H - L.B - v * 34).toFixed(1)}`;}); area += `L${tx(end)},${L.H - L.B}Z`;
  g.append(svg('path', {d: area, fill: 'var(--soft)', opacity: 0.18}));
  for (const h of ride.hits) if (h.strength >= 0.55) g.append(svg('line', {x1: tx(h.time - off), x2: tx(h.time - off), y1: L.H - L.B, y2: L.H - L.B - 4 - 14 * Math.min(1, (h.strength - 0.55) / 0.45), stroke: 'var(--hot)', 'stroke-width': 1.5}));
  for (const z of [0.5, 1, 1.5]) {g.append(svg('line', {x1: L.L, x2: L.W - L.R, y1: zy(z), y2: zy(z), stroke: z === 1 ? 'var(--soft)' : 'var(--line)', 'stroke-dasharray': z === 1 ? '4 4' : ''})); g.append(svg('text', {x: L.L - 5, y: zy(z) + 4, 'text-anchor': 'end'}, z === 1 ? 'today' : `×${z}`));}
  for (let t = 0; t <= end; t += 10) g.append(svg('text', {x: tx(t), y: L.H - 6, 'text-anchor': 'middle'}, `${t} s`));
  let d = ''; for (let f = 0; f < scale.length; f += 4) d += `${d ? 'L' : 'M'}${tx(Math.min(end, Math.max(0, f / 40 - off))).toFixed(1)},${zy(scale[f]).toFixed(1)}`;
  g.append(svg('path', {d, fill: 'none', stroke: 'var(--zoom)', 'stroke-width': 2.5}));
  cursor = svg('line', {y1: L.T, y2: L.H - L.B, stroke: 'var(--ink)', 'stroke-width': 1.5}); g.append(cursor); place();
}
function place() {if (cursor && ride) {const x = L.L + time / ride.scene.span[1] * (L.W - L.L - L.R); cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);}}
$('line').addEventListener('click', e => {if (!ride) return; const box = $('line').getBoundingClientRect(), x = (e.clientX - box.left) / box.width * L.W; seek((x - L.L) / (L.W - L.L - L.R) * ride.scene.span[1]);});

// ── settings ─────────────────────────────────────────────────────────────
function build() {
  const {scene, replay, sprites} = ride; scale = zoomScale(ride.model, p);
  const zoom = scale; // this picture keeps the zoom it was built with
  mine = createPicture($('mine'), scene, replay, sprites, N.riderPainter(), {framing: (motion, level, hitTimes, songEnd) => createFraming(motion, level, hitTimes, songEnd, f => zoom[Math.max(0, Math.min(zoom.length - 1, f))])});
  drawLine(); if (!playing) draw();
}
function change() {
  $('closeOut').textContent = p.close === 1 ? "today's" : `${p.close.toFixed(2)} × today's`; $('amountOut').textContent = p.amount === 0 ? 'not at all' : `up to ${Math.pow(2.5, p.amount).toFixed(2)} × between closest and widest`; $('easeOut').textContent = `${p.ease.toFixed(1)} s`;
  for (const k of DIALS) $(k).value = p[k];
  for (const b of $('sources').children) {b.classList.toggle('on', b.dataset.id === p.source); b.disabled = b.dataset.id === 'song' && ride && !ride.model.keyframes;}
  $('about').textContent = SOURCES[p.source][1]; $('flip').classList.toggle('on', p.flip);
  for (const id of ['amount', 'ease']) $(id).disabled = p.source === 'steady'; $('flip').disabled = p.source === 'steady'; $('ease').disabled ||= p.source === 'song';
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, source: p.source, ...Object.fromEntries(DIALS.map(k => [k, p[k]])), flip: p.flip ? '1' : '0'}));
  if (!ride) return;
  // a new zoom means a new camera path: rebuild the picture shortly after the last change
  clearTimeout(pending); pending = setTimeout(() => {build(); const z = [...scale].sort((a, b) => a - b);
    $('readout').textContent = p.source === 'steady' ? '' : `In this song the zoom goes from ${z[0].toFixed(2)} to ${z.at(-1).toFixed(2)} times today's.`;}, 120);
}
for (const k of DIALS) $(k).oninput = () => {p[k] = +$(k).value; change();};
$('flip').onclick = () => {p.flip = !p.flip; change();};

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
  if (p.source === 'song' && !ride.model.keyframes) p.source = 'steady';
  today = createPicture($('today'), ride.scene, ride.replay, ride.sprites, N.riderPainter());
  build(); change(); $('play').disabled = false; $('status').textContent = ''; layout(); window.__ready = true;
}
$('song').onchange = () => {time = 0; void load();};
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
    body: JSON.stringify({clip: $('song').value, skipped: false, answers: {...p}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved for ${$('song').selectedOptions[0].textContent} at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick(ts) {
  if (playing && mine) {time = music.position(shown(ts)); if (time >= ride.scene.span[1]) {pause(); time = ride.scene.span[1];} draw();}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.zoomLab = {state: () => ({time, p, range: scale ? [Math.min(...scale), Math.max(...scale)] : null}), drawAt: t => {time = t; draw(); return mine.draw(t, look);}};
await load();
