// Opening and ending: the last seconds of a ride run into its first seconds as a loop, while the owner shapes how the picture moves
// out to the whole course and back in to the rider (camera.js ENDS). Settings live in the address and are saved for every song.
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {ENDS} from '/scripts/video/camera.js';

const STUDY = 'bookends-2026-11', BEFORE = 5, AFTER = 5;
const KEYS = ['halve', 'turn', 'leave', 'land', 'swing', 'bow', 'lead'];
const PROPOSALS = [
  {name: 'From the side', about: 'Production now, your pick. A large swing and a late cut: the video starts beside the course and the start slides into the frame, so everything flows one way.', ends: ENDS},
  {name: 'From the side, oval', about: 'The same, flown as an oval: the camera also moves to one side at the top, so it never retraces its own path.', ends: {...ENDS, bow: 120}},
  {name: 'From the side, calmer', about: 'A slower zoom and a rounder top: about half a second more on each side.', ends: {...ENDS, halve: 0.2, turn: 0.6}},
  {name: 'From further', about: 'A still larger swing and a later cut.', ends: {...ENDS, swing: 400, lead: 1}},
  {name: 'Plain', about: 'A small swing and an early cut: the video starts on most of the course, already moving.', ends: {...ENDS, swing: 120, lead: 0.45}},
  {name: 'At rest', about: 'For comparison: no swing, cut on the whole course standing still.', ends: {...ENDS, lead: 0, swing: 0}},
];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const copy = e => ({...e}), read = (e, k) => e[k], get = k => ends[k], set = (k, v) => {ends[k] = v;};
// the settings under the owner's hand; the picture reads them at every frame
const ends = copy(ENDS), q = new URLSearchParams(location.hash.slice(1));
for (const k of KEYS) if (q.has(k) && Number.isFinite(+q.get(k))) set(k, +q.get(k));
if (q.has('pencil')) ends.pencil = q.get('pencil') === '1';
for (const id of ['song', 'theme']) if ([...$(id).options].some(o => o.value === q.get(id))) $(id).value = q.get(id);
const sheet = N.loadSheet(), rides = new Map();
const loops = await fetch('/generated/lab-rides/loops.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
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
// The sound: the last BEFORE seconds and the first AFTER seconds of the recording joined in one buffer that the browser loops
// without a gap, so the cut is heard exactly as a looping video plays it. The picture follows the sound's own clock.
const audio = new AudioContext(), sounds = new Map();
let node = null, loopSound = null, from = 0, started = 0;
function sound(url) {
  if (!sounds.has(url)) sounds.set(url, (async () => audio.decodeAudioData(await (await fetch(url)).arrayBuffer()))());
  return sounds.get(url);
}
async function useSound() {
  const n = ticket, recording = await sound($('sound').value), rate = recording.sampleRate, end = Math.min(recording.length, Math.round(ride.scene.span[1] * rate));
  if (n !== ticket) return;
  const joined = audio.createBuffer(recording.numberOfChannels, (BEFORE + AFTER) * rate, rate);
  for (let c = 0; c < recording.numberOfChannels; c++) {const data = recording.getChannelData(c), out = joined.getChannelData(c); out.set(data.subarray(end - BEFORE * rate, end), 0); out.set(data.subarray(0, AFTER * rate), BEFORE * rate);}
  loopSound = joined; if (playing) {at = position(); start();}
}
const position = () => (((from + (audio.currentTime - started - (audio.outputLatency || 0)) * rate) % (BEFORE + AFTER)) + BEFORE + AFTER) % (BEFORE + AFTER);
function start() {
  node?.stop(); node = audio.createBufferSource(); node.buffer = loopSound; node.loop = true; node.playbackRate.value = rate; node.connect(audio.destination);
  from = at; started = audio.currentTime; node.start(0, at);
}
const pause = () => {if (playing) {at = position(); node?.stop(); node = null;} playing = false; $('play').textContent = 'Play';};
// A phone in silent mode mutes this kind of sound unless the page says it is playing media: the audio session where the browser
// has one, and a silent looping <audio> element everywhere else (it must start inside the tap).
let unmuted = false;
function unmute() {
  if (unmuted) return; unmuted = true;
  try {if (navigator.audioSession) navigator.audioSession.type = 'playback';} catch {}
  const bytes = new Uint8Array(44 + 800), view = new DataView(bytes.buffer), text = (at, word) => [...word].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + 800, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); text(36, 'data'); view.setUint32(40, 800, true); bytes.fill(128, 44);
  const quiet = new Audio(URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}))); quiet.loop = true; quiet.setAttribute('playsinline', ''); void quiet.play().catch(() => {});
}
const play = async () => {
  if (!ride) return;
  unmute(); await audio.resume();
  if (!loopSound) {$('status').textContent = 'The sound is still loading, or could not be decoded on this device.'; return;}
  playing = true; $('play').textContent = 'Pause'; start();
};
function draw() {
  if (!mine) return;
  (holding ? today : mine).draw(songTime(at), look);
  $('seek').value = at; $('clock').textContent = at < BEFORE ? `${(BEFORE - at).toFixed(1)} s left` : `${(at - BEFORE).toFixed(1)} s`; place();
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); mine = today = ride = null; $('play').disabled = true; $('status').textContent = 'Loading…'; window.__ready = false;
  const next = await loadRide(song); if (n !== ticket) return;
  ride = next; look = resolveLook($('theme').value);
  // the sound at the cut: production's looping recording, the recording as cut, and other blend lengths where prepared
  const made = loops[song] ?? {}, options = [['/' + ride.scene.audio, 'Sound: looped (production)'], [`/productions/${song}/audio.mp3`, 'Sound: as cut'], ...Object.entries(made.lengths ?? {}).map(([seconds, path]) => ['/' + path, `Sound: ${made.loop === 'lead-in' ? 'blended' : 'faded'} over ${seconds} s`]),
    ...Object.entries(made.mirrored ?? {}).map(([seconds, path]) => ['/' + path, `Sound: the opening backwards over ${seconds} s (a trial)`])];
  $('sound').replaceChildren(...options.map(([value, text]) => Object.assign(document.createElement('option'), {value, textContent: text})));
  loopSound = null; await useSound().catch(error => {$('status').textContent = `Sound: ${error.message}`;}); if (n !== ticket) return;
  mine = createPicture($('mine'), ride.scene, ride.replay, ride.sprites, N.riderPainter(), {ends});
  today = createPicture($('mine'), ride.scene, ride.replay, ride.sprites, N.riderPainter());
  ride.points = mine.centres.filter((_, i) => i % 4 === 0);
  $('play').disabled = false; $('status').textContent = ''; show(); window.__ready = true;
}
$('song').onchange = () => {at = 0; void load();};
$('theme').onchange = () => {look = resolveLook($('theme').value); ride.production = null; show();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => {at = +$('seek').value; if (playing) start(); draw();};
$('half').onclick = () => {if (playing) at = position(); rate = rate === 1 ? 0.5 : 1; $('half').classList.toggle('on', rate !== 1); if (playing) start();};
$('sound').onchange = () => void useSound();
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
    at = position();
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.endsPage = {state: () => ({at, ends}), drawAt: a => {at = a; draw();}, proposals: PROPOSALS, measure: e => {const m = measure(mine, e); delete m.rows; return m;}};
await load();
