// The trim map: one ride drawn as a map in two versions side by side, with linked pan and zoom. Versions: as compiled today,
// and three ways of removing pieces the rider never touches (generated/trim/data, from trim-prepare.mjs).
import * as N from '/generated/renderer/native.js';
import {BODY_POINTS} from '/scripts/video/picture.js';

const VERSIONS = {base: ['Today', 'Nothing removed.'], trim: ['Two pieces kept', 'Each curve keeps what the rider touches, two more pieces at each end, and at least 24 px or a fifth of its length.'],
  one: ['One piece kept', 'Each curve keeps what the rider touches and one more piece at each end.'], exact: ['To the first and last touch', 'Each curve starts at the first piece the rider touches and ends at the last.']};
const $ = id => document.getElementById(id), q = new URLSearchParams(location.hash.slice(1)), css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
for (const id of ['va', 'vb']) $(id).replaceChildren(...Object.entries(VERSIONS).map(([v, [name]]) => new Option(name, v)));
$('va').value = Object.hasOwn(VERSIONS, q.get('a')) ? q.get('a') : 'base'; $('vb').value = Object.hasOwn(VERSIONS, q.get('b')) ? q.get('b') : 'trim';
if ([...$('song').options].some(o => o.value === q.get('song'))) $('song').value = q.get('song');
let ride, view = {x: 0, y: 0, s: 2.2}, showGone = true, showPath = true, time = Number(q.get('t')) || 37, ticket = 0;
const cache = new Map();
async function load(song) {
  if (!cache.has(song)) cache.set(song, (async () => {
    const {scene, kept} = await (await fetch(`/generated/trim/data/${song}.json`)).json(), replay = await N.replay(scene.track, scene.trace);
    const touched = new Set(replay.contacts.slice(1).flat());
    const centres = replay.frames.map(f => {const ps = f.points.filter(p => BODY_POINTS.includes(p.name)); return {x: ps.reduce((s, p) => s + p.pos.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.pos.y, 0) / ps.length};});
    const lines = scene.track.lines, sets = {base: new Set(lines.map(l => l.id)), ...Object.fromEntries(Object.entries(kept).map(([v, ids]) => [v, new Set(ids)]))};
    // per version: lines, drawn length, untouched pieces, curves that end in a piece the rider never touches
    const stats = Object.fromEntries(Object.entries(sets).map(([v, set]) => {
      const mine = lines.filter(l => set.has(l.id)), curves = new Map();
      for (const l of mine) {const c = Math.floor((l.id - 1000) / 10000); if (!curves.has(c)) curves.set(c, []); curves.get(c).push(l);}
      let grey = 0, ridden = 0;
      for (const c of curves.values()) {if (!c.some(l => touched.has(l.id))) continue; ridden++; c.sort((a, b) => a.id - b.id); if (!touched.has(c[0].id) || !touched.has(c.at(-1).id)) grey++;}
      return [v, {lines: mine.length, length: mine.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0), idle: mine.filter(l => !touched.has(l.id)).length, grey, ridden}];
    }));
    return {scene, lines, sets, touched, centres, stats, end: scene.span[1], offset: scene.timing.offset};
  })());
  return cache.get(song);
}
const riderAt = t => ride.centres[Math.max(0, Math.min(ride.centres.length - 1, Math.round((t + ride.offset) * 40)))];
function paint(id, version) {
  const c = $(id), box = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (c.width !== Math.round(box.width * dpr)) {c.width = Math.round(box.width * dpr); c.height = Math.round(box.height * dpr);}
  const g = c.getContext('2d'), w = box.width, h = box.height; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (!ride) return;
  const X = x => w / 2 + (x - view.x) * view.s, Y = y => h / 2 + (y - view.y) * view.s, set = ride.sets[version], pad = 40 / view.s;
  const x0 = view.x - w / 2 / view.s - pad, x1 = view.x + w / 2 / view.s + pad, y0 = view.y - h / 2 / view.s - pad, y1 = view.y + h / 2 / view.s + pad;
  const stroke = (colour, width, test) => {g.strokeStyle = colour; g.lineWidth = width; g.lineCap = 'round'; g.beginPath();
    for (const l of ride.lines) {if (!test(l) || Math.max(l.x1, l.x2) < x0 || Math.min(l.x1, l.x2) > x1 || Math.max(l.y1, l.y2) < y0 || Math.min(l.y1, l.y2) > y1) continue; g.moveTo(X(l.x1), Y(l.y1)); g.lineTo(X(l.x2), Y(l.y2));} g.stroke();};
  const thick = Math.max(1.2, Math.min(4, view.s * 1.1));
  if (showGone) stroke(css('--gone'), thick, l => !set.has(l.id));
  stroke(css('--idle'), thick, l => set.has(l.id) && !ride.touched.has(l.id));
  stroke(css('--used'), thick, l => set.has(l.id) && ride.touched.has(l.id));
  if (showPath) {
    g.strokeStyle = css('--path'); g.globalAlpha = 0.45; g.lineWidth = 1.2; g.beginPath(); let pen = false;
    for (let f = 0; f < ride.centres.length; f += 2) {const p = ride.centres[f]; if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) {pen = false; continue;} pen ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)); pen = true;} g.stroke(); g.globalAlpha = 1;
    const p = riderAt(time); g.fillStyle = css('--path'); g.beginPath(); g.arc(X(p.x), Y(p.y), 6, 0, 7); g.fill();
  }
}
function draw() {
  paint('a', $('va').value); paint('b', $('vb').value);
  for (const [info, sel] of [['ia', 'va'], ['ib', 'vb']]) {const v = $(sel).value, s = ride?.stats[v], b = ride?.stats.base;
    $(info).textContent = s ? `${VERSIONS[v][1]} ${v === 'base' ? '' : `${Math.round(100 * (1 - s.length / b.length))}% less track drawn than today; `}${s.grey} of ${s.ridden} curves end in grey.` : '';}
  $('clock').textContent = `${time.toFixed(1)} s`;
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, a: $('va').value, b: $('vb').value, t: time.toFixed(2)}));
}
function table() {
  const b = ride.stats.base;
  $('table').innerHTML = '<tr><th>Version</th><th>Pieces</th><th>Track drawn</th><th>Never touched</th><th>Curves ending in grey</th></tr>' + Object.entries(VERSIONS).map(([v, [name]]) => {const s = ride.stats[v];
    return `<tr><td>${name}</td><td>${s.lines}</td><td>${v === 'base' ? 'all' : `−${Math.round(100 * (1 - s.length / b.length))}%`}</td><td>${s.idle}</td><td>${s.grey} of ${s.ridden}</td></tr>`;}).join('');
}
function centre() {const p = riderAt(time); view.x = p.x; view.y = p.y;}
async function open() {
  const n = ++ticket; window.__ready = false; const next = await load($('song').value); if (n !== ticket) return;
  ride = next; $('time').max = ride.end; time = Math.min(time, ride.end - 1); $('time').value = time; centre(); table(); draw(); window.__ready = true;
}
$('song').onchange = () => void open(); $('va').onchange = $('vb').onchange = draw;
$('time').oninput = () => {time = +$('time').value; centre(); draw();};
$('gone').onclick = () => {showGone = !showGone; $('gone').classList.toggle('on', showGone); draw();};
$('path').onclick = () => {showPath = !showPath; $('path').classList.toggle('on', showPath); draw();};
$('wide').onclick = () => {let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of ride.centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  const box = $('a').getBoundingClientRect(); view = {x: (x0 + x1) / 2, y: (y0 + y1) / 2, s: 0.92 * Math.min(box.width / (x1 - x0), box.height / (y1 - y0))}; draw();};
for (const id of ['a', 'b']) {
  const c = $(id); let last = null;
  c.addEventListener('pointerdown', e => {last = {x: e.clientX, y: e.clientY}; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing';});
  c.addEventListener('pointermove', e => {if (!last) return; view.x -= (e.clientX - last.x) / view.s; view.y -= (e.clientY - last.y) / view.s; last = {x: e.clientX, y: e.clientY}; draw();});
  for (const type of ['pointerup', 'pointercancel']) c.addEventListener(type, () => {last = null; c.style.cursor = 'grab';});
  c.addEventListener('wheel', e => {e.preventDefault(); const box = c.getBoundingClientRect(), mx = e.clientX - box.left - box.width / 2, my = e.clientY - box.top - box.height / 2, k = Math.exp(-e.deltaY * 0.0015), s = Math.max(0.05, Math.min(30, view.s * k));
    view.x += mx / view.s - mx / s; view.y += my / view.s - my / s; view.s = s; draw();}, {passive: false});
}
addEventListener('resize', draw);
window.trimMap = {state: () => ({view, time, stats: ride?.stats})};
await open();
