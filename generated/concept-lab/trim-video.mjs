// Trimming unused track: the whole song plays with one version of the trim (generated/trim/data, from trim-video-prepare.mjs),
// against today's drawing (held or beside). Every version keeps the same ride; a version is the scene with fewer lines.
// A timeline shows where the chosen version takes track off the screen. Settings live in the address and are saved per song.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook, THEMES} from '/scripts/video/look.js';

const STUDY = 'trim-2026-11', SONGS = ['petrunko', 'trouble', 'tiki', 'circus', 'amor', 'bones', 'valhalla'];
// gentlest to most aggressive (by the track each removes, over the seven songs)
const VERSIONS = [
  {id: 'base', name: 'Nothing', rule: 'Nothing is trimmed: the track as it is today.'},
  {id: 'end', name: 'End only', rule: 'Where the rider comes onto a curve, it stays whole; where it leaves, the curve stops at the last touch.'},
  {id: 'trim', name: 'Two kept', rule: 'Each curve keeps two pieces past the first and the last touch, and at least 24 px or a fifth of its length.'},
  {id: 'one', name: 'One kept', rule: 'Each curve keeps one piece past the first and the last touch.'},
  {id: 'startone', name: 'One before', rule: 'Each curve keeps one piece before the first touch, on the side the rider comes from, and stops at the last touch.'},
  {id: 'min', name: 'Not too short', rule: 'Each curve runs from the first touch to the last, but never shorter than 24 px or a fifth of its length (it grows back toward the side the rider comes from).'},
  {id: 'exact', name: 'Touch to touch', rule: 'Each curve runs from the first touch to the last, nothing more.'},
];
const $ = id => document.getElementById(id), svg = (tag, attrs = {}, text) => {const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
const q = new URLSearchParams(location.hash.slice(1));
$('theme').replaceChildren(...Object.entries(THEMES).map(([id, theme]) => new Option(theme.name, id)), new Option('Plain', 'plain'));
$('theme').value = Object.hasOwn(THEMES, q.get('look')) || q.get('look') === 'plain' ? q.get('look') : 'hokusai';
if (SONGS.includes(q.get('song'))) $('song').value = q.get('song');
let version = Math.max(0, VERSIONS.findIndex(v => v.id === (q.get('v') ?? 'trim')));
$('how').max = VERSIONS.length - 1;
$('steps').replaceChildren(...VERSIONS.map((v, i) => Object.assign(document.createElement('button'), {textContent: v.name, onclick: () => choose(i)})));

const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
let ride, look = resolveLook($('theme').value), time = Math.max(0, Number(q.get('t')) || 0), playing = false, rate = 1, loopFrom = null;
let holding = false, beside = q.get('beside') === '1', ticket = 0, cursor = null, measured = null, measuring = 0;

// ── the ride and its versions ────────────────────────────────────────────
const curveOf = l => Math.floor((l.id - 1000) / 10000);
function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const {scene, kept} = await (await fetch(`/generated/trim/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    const lines = scene.track.lines, touched = new Set(replay.contacts.slice(1).flat());
    const sets = Object.fromEntries(VERSIONS.map(v => [v.id, v.id === 'base' ? new Set(lines.map(l => l.id)) : new Set(kept[v.id])]));
    // per version: drawn length, untouched pieces, touched curves whose first or last piece is untouched
    const stats = Object.fromEntries(VERSIONS.map(({id}) => {
      const mine = lines.filter(l => sets[id].has(l.id)), curves = new Map();
      for (const l of mine) {if (!curves.has(curveOf(l))) curves.set(curveOf(l), []); curves.get(curveOf(l)).push(l);}
      let grey = 0, ridden = 0;
      for (const c of curves.values()) {if (!c.some(l => touched.has(l.id))) continue; ridden++; c.sort((a, b) => a.id - b.id); if (!touched.has(c[0].id) || !touched.has(c.at(-1).id)) grey++;}
      return [id, {lines: mine.length, length: mine.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0), idle: mine.filter(l => !touched.has(l.id)).length, grey, ridden}];
    }));
    // one picture per version and canvas, made when first shown
    const pictures = new Map(), picture = (canvas, id) => {
      const key = canvas + id;
      if (!pictures.has(key)) pictures.set(key, createPicture($(canvas), {...scene, track: {...scene.track, lines: lines.filter(l => sets[id].has(l.id))}}, replay, sprites, N.riderPainter()));
      return pictures.get(key);
    };
    return {scene, replay, sprites, lines, touched, sets, stats, picture, end: scene.span[1], measures: new Map()};
  })());
  return rides.get(song);
}

// ── where the versions differ: track on screen, sampled over the song ────
const STEP = 0.25, SMALL = 108;
// For each sample, the picture's own camera (drawn on a small canvas) gives the part of the course on screen; we add up, in
// pixels of the 1080-wide video, the track there that the rider never touches, and the track each version removes.
async function measure(r, lk) {
  const key = $('theme').value;
  if (r.measures.has(key)) return r.measures.get(key);
  const small = Object.assign(document.createElement('canvas'), {width: SMALL, height: SMALL * 16 / 9});
  const probe = createPicture(small, r.scene, r.replay, r.sprites, () => {}), scale = 1080 / SMALL;
  const removedBy = r.lines.map(l => VERSIONS.map((v, i) => r.sets[v.id].has(l.id) ? -1 : i).filter(i => i > 0));
  const n = Math.floor(r.end / STEP) + 1, idle = new Float32Array(n), removed = VERSIONS.map(() => new Float32Array(n));
  for (let s = 0; s < n; s++) {
    if (s % 40 === 0) await new Promise(res => setTimeout(res));
    const world = probe.draw(s * STEP, lk), inv = world.inverse(), k = Math.hypot(world.a, world.b) * scale;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[0, 0], [small.width, 0], [0, small.height], [small.width, small.height]]) {const p = inv.transformPoint({x: cx, y: cy}); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
    r.lines.forEach((l, i) => {
      if (Math.max(l.x1, l.x2) < x0 || Math.min(l.x1, l.x2) > x1 || Math.max(l.y1, l.y2) < y0 || Math.min(l.y1, l.y2) > y1) return;
      const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) * k;
      if (!r.touched.has(l.id)) idle[s] += len;
      for (const v of removedBy[i]) removed[v][s] += len;
    });
  }
  // places that differ: runs of samples where the version removes at least a quarter of its own most (and 40 px)
  const places = removed.map(series => {
    const top = Math.max(...series), at = [], limit = Math.max(40, top / 4);
    let from = -1; for (let s = 0; s <= n; s++) {const on = s < n && series[s] >= limit; if (on && from < 0) from = s; if (!on && from >= 0) {if (!at.length || from * STEP - at.at(-1).t1 > 0.75) at.push({t0: from * STEP, t1: s * STEP}); else at.at(-1).t1 = s * STEP; from = -1;}}
    return at;
  });
  const m = {idle, removed, places, n}; r.measures.set(key, m); return m;
}
const L = {W: 1180, H: 120, L: 44, R: 10, T: 8, B: 22};
const tx = t => L.L + t / ride.end * (L.W - L.L - L.R);
function drawLine() {
  const g = $('line'); g.replaceChildren(); cursor = null; if (!ride) return;
  const base = L.H - L.B, top = L.T;
  for (let t = 0; t <= ride.end; t += 10) g.append(svg('text', {x: tx(t), y: L.H - 6, 'text-anchor': 'middle'}, `${t} s`));
  if (measured) {
    const series = measured.removed[version], most = Math.max(1, ...measured.idle), y = v => base - v / most * (base - top);
    const area = values => {let d = `M${tx(0)},${base}`; values.forEach((v, s) => {d += `L${tx(Math.min(ride.end, s * STEP)).toFixed(1)},${y(v).toFixed(1)}`;}); return d + `L${tx(ride.end)},${base}Z`;};
    g.append(svg('path', {d: area(measured.idle), fill: 'var(--idle)', opacity: 0.25}));
    if (version) g.append(svg('path', {d: area(series), fill: 'var(--cut)', opacity: 0.85}));
    for (const p of version ? measured.places[version] : []) g.append(svg('line', {x1: tx(p.t0), x2: tx(Math.min(ride.end, p.t1)), y1: base + 3, y2: base + 3, stroke: 'var(--cut)', 'stroke-width': 3}));
    g.append(svg('text', {x: L.L - 6, y: top + 9, 'text-anchor': 'end'}, `${Math.round(most / 100) * 100}`), svg('text', {x: L.L - 6, y: base, 'text-anchor': 'end'}, 'px'));
  } else g.append(svg('text', {x: L.W / 2, y: L.H / 2, 'text-anchor': 'middle'}, 'Measuring…'));
  g.append(svg('line', {x1: L.L, x2: L.W - L.R, y1: base, y2: base, stroke: 'var(--line)'}));
  cursor = svg('line', {y1: top, y2: base, stroke: 'var(--ink)', 'stroke-width': 1.5, 'pointer-events': 'none'}); g.append(cursor); place();
}
function place() {if (cursor && ride) {cursor.setAttribute('x1', tx(time)); cursor.setAttribute('x2', tx(time));}}
$('line').addEventListener('click', e => {if (!ride) return; const box = $('line').getBoundingClientRect(), x = (e.clientX - box.left) / box.width * L.W; seek((x - L.L) / (L.W - L.L - L.R) * ride.end);});
function nextPlace() {
  if (!ride || !measured || !version) return;
  const places = measured.places[version], p = places.find(p => p.t0 - 0.5 > time + 0.1) ?? places[0];
  if (p) seek(Math.max(0, p.t0 - 0.5));
}
$('next').onclick = nextPlace;

// ── the panel ────────────────────────────────────────────────────────────
function showVersion() {
  const v = VERSIONS[version], s = ride?.stats[v.id], b = ride?.stats.base;
  $('how').value = version; [...$('steps').children].forEach((e, i) => e.classList.toggle('on', i === version));
  $('rule').textContent = v.rule; $('mineLabel').textContent = version ? `Trimmed: ${v.name.toLowerCase()}` : 'Nothing trimmed';
  $('next').disabled = !version;
  if (s) {
    $('nDrawn').textContent = version ? `−${Math.round(100 * (1 - s.length / b.length))} %` : 'all'; $('nIdle').textContent = `${s.idle} of ${s.lines}`; $('nGrey').textContent = `${s.grey} of ${s.ridden}`;
    [...$('table').querySelectorAll('tbody tr')].forEach((tr, i) => tr.classList.toggle('on', i === version));
  }
  drawLine(); remember(); if (!playing) draw();
}
function table() {
  const b = ride.stats.base;
  $('table').innerHTML = '<thead><tr><th></th><th>Track drawn</th><th>Never touched</th><th>Ends untouched</th></tr></thead><tbody>' + VERSIONS.map(({id, name}) => {const s = ride.stats[id];
    return `<tr><td>${name}</td><td>${id === 'base' ? 'all' : `−${Math.round(100 * (1 - s.length / b.length))} %`}</td><td>${s.idle}</td><td>${s.grey} of ${s.ridden}</td></tr>`;}).join('') + '</tbody>';
  [...$('table').querySelectorAll('tbody tr')].forEach((tr, i) => {tr.onclick = () => choose(i);});
}
function choose(i) {version = Math.max(0, Math.min(VERSIONS.length - 1, i)); showVersion();}
$('how').oninput = () => choose(+$('how').value);
const remember = () => history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, look: $('theme').value, v: VERSIONS[version].id, t: time.toFixed(2), ...(beside ? {beside: '1'} : {})}));

// ── the picture ──────────────────────────────────────────────────────────
const pause = () => {if (playing) time = music.pause(); playing = false; $('play').textContent = 'Play'; if (ride) remember();};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(time, rate);};
const seek = t => {if (!ride) return; const on = playing; pause(); time = Math.max(0, Math.min(ride.end, t)); if (loopFrom !== null) loopFrom = time; draw(); remember(); if (on) void play();};
function draw() {
  if (!ride) return;
  const mine = ride.picture('mine', VERSIONS[version].id), today = ride.picture('today', 'base');
  if (beside) {mine.draw(time, look); today.draw(time, look);} else (holding ? today : mine).draw(time, look);
  $('seek').value = time; $('clock').textContent = `${time.toFixed(1)} s`; place();
}
function layout() {
  $('pair').classList.toggle('single', !beside); $('today').parentNode.classList.toggle('hidden', !beside && !holding); $('mine').parentNode.classList.toggle('hidden', !beside && holding);
  $('beside').classList.toggle('on', beside); $('hold').classList.toggle('on', holding); $('loop').classList.toggle('on', loopFrom !== null); $('half').classList.toggle('on', rate !== 1); draw();
}
async function remeasure() {
  const n = ++measuring, r = ride; measured = null; drawLine();
  const m = await measure(r, look); if (n !== measuring || r !== ride) return;
  measured = m; drawLine(); window.__measured = true;
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); ride = null; measured = null; $('play').disabled = true; $('status').textContent = 'Loading…'; window.__ready = window.__measured = false; drawLine();
  const next = await loadRide(song); if (n !== ticket) return;
  await music.load('/' + next.scene.audio); if (n !== ticket) return;
  ride = next; time = Math.min(time, ride.end); $('seek').max = ride.end; loopFrom = null;
  $('play').disabled = false; $('status').textContent = ''; table(); showVersion(); layout(); window.__ready = true;
  void remeasure();
}
$('song').onchange = () => {time = 0; void load();};
$('theme').onchange = () => {look = resolveLook($('theme').value); remember(); draw(); if (ride) void remeasure();};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => seek(+$('seek').value);
$('loop').onclick = () => {loopFrom = loopFrom === null ? time : null; layout();};
$('beside').onclick = () => {beside = !beside; layout(); remember();};
$('half').onclick = () => {rate = rate === 1 ? 0.5 : 1; layout(); if (playing) void play();};
const hold = on => {if (holding !== on) {holding = on; layout();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
for (const s of document.querySelectorAll('.screen')) s.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  const onRange = e.target.type === 'range';
  if (e.key === 't' || e.key === 'T') hold(true);
  else if (e.key === 'n' || e.key === 'N') nextPlace();
  else if (e.key === ' ') {e.preventDefault(); playing ? pause() : void play();}
  else if (e.key === 'ArrowLeft' && !onRange) seek(time - 2); else if (e.key === 'ArrowRight' && !onRange) seek(time + 2);
  else if (e.key === 'ArrowUp' && !onRange) {e.preventDefault(); choose(version + 1);} else if (e.key === 'ArrowDown' && !onRange) {e.preventDefault(); choose(version - 1);}
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
$('save').onclick = async () => {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: $('song').value, skipped: false, answers: {version: VERSIONS[version].id, look: $('theme').value}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved "${VERSIONS[version].name}" for ${$('song').selectedOptions[0].textContent} at ${new Date().toLocaleTimeString()}.` : `Not saved: ${(await r.json()).error}`;
};
function tick(ts) {
  if (playing && ride) {
    time = music.position(shown(ts));
    const end = loopFrom !== null ? Math.min(ride.end, loopFrom + 6) : ride.end;
    if (time >= end) {if (loopFrom !== null) {time = loopFrom; void play();} else {pause(); time = end;}}
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.trimVideo = {VERSIONS, choose, state: () => ({time, playing, version: VERSIONS[version].id, holding, beside, song: $('song').value, look: $('theme').value, stats: ride?.stats, places: measured?.places.map(p => p.length)}),
  measured: () => measured && {idle: [...measured.idle], removed: measured.removed.map(s => [...s]), places: measured.places},
  drawAt: t => {time = t; draw();}};
await load();
