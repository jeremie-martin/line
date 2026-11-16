// Zoom: the whole song plays with a zoom written for it (keyframes on one fixed scale, scripts/video/zoom.js; the song's lanes come with the scene),
// against the steady zoom (held or beside). Each zoom of a song gets a mark, a note and, if its points were moved, the owner's version; a song gets a
// note of its own. Every change is saved at once (labels/studies/zoom-2026-11b.jsonl; the latest row per song and zoom counts).
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {RANGE, wideAt, laneScale, zoomOfWide} from '/scripts/video/zoom.js';

const STUDY = 'zoom-2026-11b'; // the lanes written on 2026-11-16; zoom-2026-11 holds the marks on the first set
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1));
// the songs are the menu's options (zoom.html); each has a scene in generated/lab-rides/<song>.json (prepare-rides.mjs)
if ([...$('song').options].some(o => o.value === q.get('song'))) $('song').value = q.get('song');
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {hits: 'v1'});
// the zoom being looked at: a draft's id and its keyframes, which may have been moved
let lane = q.get('lane') ?? '', keys = (q.get('k') ?? '').split(',').filter(Boolean).map(s => {const [t, wide] = s.split(':').map(Number); return {t, wide};}).filter(k => Number.isFinite(k.t) && Number.isFinite(k.wide));
// what the owner has saved: song → zoom id ('' for the song as a whole) → {mark, note, keyframes: his version, if he moved points}
const MARKS = [['love', 'Love'], ['keep', 'Keep'], ['unsure', 'Unsure'], ['cut', 'Cut']], saved = new Map();
const entry = (song, id) => {if (!saved.has(song)) saved.set(song, new Map()); const m = saved.get(song); if (!m.has(id)) m.set(id, {mark: null, note: '', keyframes: null}); return m.get(id);};
const marked = song => [...(saved.get(song)?.values() ?? [])].some(e => e.mark);
async function loadSaved() {
  const r = await fetch(`/labels/studies/${STUDY}.jsonl`, {cache: 'no-store'}); if (!r.ok) return;
  for (const line of (await r.text()).split('\n').filter(Boolean)) {
    const row = JSON.parse(line), a = row.answers; if (!a || !('mark' in a)) continue; // rows from before marks existed say nothing
    Object.assign(entry(row.clip, a.lane ?? ''), {mark: a.mark, note: row.note ?? '', keyframes: a.keyframes ?? null});
  }
}
async function save(id, what) {
  const song = $('song').value, e = entry(song, id);
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: song, skipped: false, answers: {lane: id || null, mark: e.mark, ...(e.keyframes ? {keyframes: e.keyframes} : {})}, note: e.note})});
  $('status').textContent = r.ok ? `Saved: ${what} (${new Date().toLocaleTimeString()}).` : `Not saved: ${(await r.json()).error}`;
  progress();
}
function progress() {
  const options = [...$('song').options], done = options.filter(o => marked(o.value)).length;
  for (const o of options) o.textContent = (marked(o.value) ? '✓ ' : '') + (o.dataset.name ??= o.textContent);
  $('progress').textContent = `${done} of ${options.length} songs have a mark.`; $('next').disabled = done === options.length;
}
// a trial of the overall zoom: the picture shows this many percent more than today (held T and "beside" stay as today)
let wider = Math.max(0, Math.min(30, Number(q.get('wider')) || 0));
let ride, lanes = [], mine, today, scale, time = 0, playing = false, holding = false, beside = false, ticket = 0, cursor, pending = 0;

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/lab-rides/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    return {scene, replay, sprites, frames: replay.frames.length};
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
  for (const [w, name] of [[0, 'closest'], [0.5, 'steady'], [1, 'widest']]) {g.append(svg('line', {x1: L.L, x2: L.W - L.R, y1: wy(w), y2: wy(w), stroke: w === 0.5 ? 'var(--soft)' : 'var(--line)', 'stroke-dasharray': w === 0.5 ? '4 4' : ''})); g.append(svg('text', {x: L.L - 5, y: wy(w) + 4, 'text-anchor': 'end'}, name));}
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
  if (!ride) return; // a song is loading
  const {scene, replay, sprites} = ride; scale = laneScale(keys, ride.frames, scene.timing.offset);
  // the picture takes the zoom as a video does: the scene's lane. It keeps the keyframes it was built with.
  mine = createPicture($('mine'), {...scene, zoom: {keyframes: keys.map(k => ({...k}))}, ...(wider ? {wider: 1 + wider / 100} : {})}, replay, sprites, N.riderPainter());
  if (!playing) draw();
}
const same = (a, b) => a.length === b.length && a.every((k, i) => Math.abs(k.t - b[i].t) < 0.005 && Math.abs(k.wide - b[i].wide) < 0.0005);
function change() {
  const draft = lanes.find(l => l.id === lane), edited = draft && !same(keys, draft.keyframes);
  const own = entry($('song').value, lane), unsaved = edited && !(own.keyframes && same(keys, own.keyframes));
  $('sources').replaceChildren(...lanes.map(l => {
    const e = entry($('song').value, l.id), row = document.createElement('div'); row.className = 'lane' + (l.id === lane ? ' on' : ''); row.onclick = () => {if (l.id !== lane) choose(l.id);};
    const h = document.createElement('h3'); h.textContent = l.name; if (e.keyframes) h.append(Object.assign(document.createElement('small'), {textContent: 'your version'}));
    const marks = document.createElement('div'); marks.className = 'marks';
    for (const [id, label] of MARKS) marks.append(Object.assign(document.createElement('button'), {textContent: label, className: e.mark === id ? 'on' : '',
      onclick: ev => {ev.stopPropagation(); e.mark = e.mark === id ? null : id; void save(l.id, `${l.name}: ${e.mark ? label : 'no mark'}`); change();}}));
    row.append(h, Object.assign(document.createElement('p'), {textContent: l.about}), marks); return row;
  }));
  document.querySelector('#pair .picture-label').textContent = draft?.name ?? '';
  $('note-title').textContent = `Note on “${draft?.name ?? ''}”`; $('edit-title').textContent = `Change “${draft?.name ?? ''}” yourself`;
  if (document.activeElement !== $('note')) $('note').value = own.note;
  $('reset').disabled = !edited; $('keep').disabled = !unsaved; $('keep').textContent = unsaved ? 'Save my version' : own.keyframes && edited ? 'Your version is saved' : 'Save my version';
  const w = keys.map(k => k.wide), lo = Math.min(...w), hi = Math.max(...w);
  $('readout').textContent = hi > lo ? `${keys.length} points. The picture goes from ${zoomOfWide(lo).toFixed(2)} to ${zoomOfWide(hi).toFixed(2)} times the steady zoom: its widest moment shows ${(zoomOfWide(lo) / zoomOfWide(hi)).toFixed(2)} times more than its closest (the scale allows ${RANGE}).` : `One zoom for the whole ride, ${zoomOfWide(lo).toFixed(2)} times today's.`;
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, lane, k: keys.map(k => `${k.t}:${k.wide}`).join(','), ...(wider ? {wider} : {})}));
  drawLine();
  // a new zoom means a new camera path: rebuild the picture shortly after the last change
  clearTimeout(pending); pending = setTimeout(build, 120);
}
const written = id => lanes.find(l => l.id === id).keyframes.map(k => ({...k}));
function choose(id) {lane = id; keys = entry($('song').value, id).keyframes?.map(k => ({...k})) ?? written(id); change();}
$('reset').onclick = () => {const e = entry($('song').value, lane); keys = written(lane); if (e.keyframes) {e.keyframes = null; void save(lane, `${lanes.find(l => l.id === lane).name} as it was written`);} change();};
$('keep').onclick = () => {entry($('song').value, lane).keyframes = keys.map(k => ({...k})); void save(lane, `your version of ${lanes.find(l => l.id === lane).name}`); change();};
$('note').onchange = () => {entry($('song').value, lane).note = $('note').value; void save(lane, `note on ${lanes.find(l => l.id === lane).name}`);};
$('song-note').onchange = () => {entry($('song').value, '').note = $('song-note').value; void save('', 'note on the song');};
$('next').onclick = () => {const o = [...$('song').options], i = $('song').selectedIndex, next = [...o.slice(i + 1), ...o.slice(0, i)].find(x => !marked(x.value)); if (next) {$('song').value = next.value; $('song').onchange();}};

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
  lanes = [{id: 'steady', name: 'Steady', about: 'The picture never moves in or out. Mark it too: Love here means this song is better without zoom moves.', keyframes: [{t: 0, wide: 0.5}]}, ...ride.scene.zooms];
  // a song opens on its first written zoom (or the one in the address)
  if (!lanes.some(l => l.id === lane)) lane = (lanes[1] ?? lanes[0]).id;
  if (!keys.length || keys.at(-1).t > ride.scene.span[1]) keys = entry(song, lane).keyframes?.map(k => ({...k})) ?? written(lane);
  $('song-note').value = entry(song, '').note;
  today = createPicture($('today'), {...ride.scene, zoom: null}, ride.replay, ride.sprites, N.riderPainter()); // beside: the steady zoom
  ride.hits = today.hits; ride.level = today.level;
  build(); change(); $('play').disabled = false; $('status').textContent = ''; layout(); window.__ready = true;
}
$('song').onchange = () => {time = 0; keys = []; lane = ''; void load();};
$('wider').value = wider; const showWider = () => {$('widerOut').textContent = wider ? `shows ${wider}% more` : 'as today';}; showWider();
$('wider').oninput = () => {wider = +$('wider').value; showWider(); change();};
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
function tick(ts) {
  if (playing && mine) {time = music.position(shown(ts)); if (time >= ride.scene.span[1]) {pause(); time = ride.scene.span[1];} draw();}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.zoomLab = {choose, state: () => ({time, lane, keys, range: scale ? [Math.min(...scale), Math.max(...scale)] : null}), drawAt: t => {time = t; draw(); return mine.draw(t, look);}};
await loadSaved(); progress();
await load();
