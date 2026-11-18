// The cut: for each song, the 30 to 50 seconds that become its short video, chosen like in a good audio player with two markers.
// The waveform is drawn from the decoded productions/<song>/audio.mp3 (min and max per pixel, so hits show when zoomed in).
// Playback is one AudioBufferSourceNode: speed is its playbackRate (slower is also lower), the playhead is computed from the audio
// clock (less the output latency) at any speed, and the cut loops end straight into start without a gap (loopStart/loopEnd).
// Saved to the study cut-2026-11, one row per save, the latest per song counts: answers {start, end} in song seconds, note.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const STUDY = 'cut-2026-11', MIN = 30, MAX = 50, NARROWEST = 2, BLOCK = 256, RULER = 30, FLAG = 15;
const $ = id => document.getElementById(id), saved = await loadAnswers(STUDY);
const {clips} = await (await fetch(`/labels/studies/${STUDY}.manifest.json`, {cache: 'no-store'})).json();
const titles = new Map(await fetch('/generated/lab-rides/cuts.json').then(r => r.ok ? r.json() : {songs: []}).then(d => d.songs.map(s => [s.song, s.title])).catch(() => []));
const songs = clips.map(c => ({song: c.id, title: titles.get(c.id) ?? c.id}));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), r3 = t => Math.round(t * 1000) / 1000;

let at = Math.max(0, songs.findIndex(s => s.song === location.hash.slice(1))), sound = null, peaks = null, ticket = 0;
let cut = {start: null, end: null}, view = {t0: 0, span: 1}, rate = 1, looping = false;
const duration = () => sound?.duration ?? 0, valid = () => cut.start !== null && cut.end !== null && cut.end - cut.start >= 0.1;

// ── sound ──
const audio = new AudioContext(), cache = new Map();
let source = null, startedAt = 0, from = 0, playing = false;
function analyse(buffer) {
  const n = buffer.length, chans = Array.from({length: buffer.numberOfChannels}, (_, c) => buffer.getChannelData(c)), mono = new Float32Array(n);
  for (const ch of chans) for (let i = 0; i < n; i++) mono[i] += ch[i] / chans.length;
  const blocks = Math.ceil(n / BLOCK), lo = new Float32Array(blocks), hi = new Float32Array(blocks); let peak = 1e-6;
  for (let b = 0; b < blocks; b++) {
    let a = Infinity, z = -Infinity;
    for (let i = b * BLOCK, e = Math.min(n, i + BLOCK); i < e; i++) {const v = mono[i]; if (v < a) a = v; if (v > z) z = v;}
    lo[b] = a; hi[b] = z; peak = Math.max(peak, -a, z);
  }
  return {mono, lo, hi, peak, sr: buffer.sampleRate};
}
function load(song) {
  if (!cache.has(song)) {
    const p = fetch(`/productions/${song}/audio.mp3`).then(r => {if (!r.ok) throw new Error(`status ${r.status}`); return r.arrayBuffer();})
      .then(b => audio.decodeAudioData(b)).then(buffer => ({buffer, peaks: analyse(buffer)}));
    p.catch(() => cache.delete(song)); cache.set(song, p);
    while (cache.size > 3) cache.delete(cache.keys().next().value);
  }
  return cache.get(song);
}
const latency = () => (audio.outputLatency || 0) + (audio.baseLatency || 0);
/** The heard position in song seconds. */
function position() {
  if (!playing) return from;
  let t = from + Math.max(0, audio.currentTime - startedAt - latency()) * rate;
  if (source?.loop && t >= source.loopEnd) t = source.loopStart + (t - source.loopEnd) % (source.loopEnd - source.loopStart);
  return Math.min(t, duration());
}
function halt() {if (source) {source.onended = null; try {source.stop();} catch {} source.disconnect(); source = null;}}
function pause() {from = position(); halt(); playing = false; ui();}
function play(t = position()) {
  if (!sound) return;
  halt(); void audio.resume();
  const loop = looping && valid();
  if (t >= duration() - 0.01) t = loop ? cut.start : 0;
  if (loop && t >= cut.end) t = cut.start;
  const s = source = audio.createBufferSource(); s.buffer = sound; s.playbackRate.value = rate;
  if (loop) {s.loop = true; s.loopStart = cut.start; s.loopEnd = cut.end;}
  s.connect(audio.destination);
  s.onended = () => {if (source === s) {source = null; playing = false; from = duration(); ui();}};
  s.start(0, t); startedAt = audio.currentTime; from = t; playing = true; ui();
}
function seek(t) {t = clamp(t, 0, duration()); if (playing) play(t); else from = t; reveal(t);}
const replay = () => {if (playing) play();};

// ── drawing ──
const canvas = $('wave'), ctx = canvas.getContext('2d'), layer = document.createElement('canvas'), lctx = layer.getContext('2d');
const W = () => canvas.clientWidth, X = t => (t - view.t0) / view.span * W(), T = px => clamp(view.t0 + px / W() * view.span, 0, duration());
const clampT0 = (t0, span = view.span) => clamp(t0, 0, Math.max(0, duration() - span));
const reveal = t => {if (t < view.t0 || t > view.t0 + view.span) view.t0 = clampT0(t - view.span * 0.1);};
const STEPS = [[0.01, 5], [0.02, 4], [0.05, 5], [0.1, 5], [0.2, 4], [0.5, 5], [1, 5], [2, 4], [5, 5], [10, 5], [20, 4], [30, 3], [60, 6]];
let layerKey = '';
function drawWave(w, h, k) {
  const key = `${at}|${view.t0}|${view.span}|${w}|${h}|${k}`; if (key === layerKey) return; layerKey = key;
  lctx.setTransform(k, 0, 0, k, 0, 0); lctx.clearRect(0, 0, w, h);
  const top = RULER + FLAG + 4, mid = (top + h - 6) / 2, amp = (h - 6 - top) / 2 / peaks.peak, {mono, lo, hi, sr} = peaks, n = mono.length;
  lctx.fillStyle = '#dde0e5'; lctx.fillRect(0, mid, w, 1); lctx.fillStyle = '#1b1f25';
  for (let px = 0; px < w; px++) {
    const i0 = Math.floor((view.t0 + px / w * view.span) * sr), i1 = Math.min(n, Math.max(i0 + 1, Math.floor((view.t0 + (px + 1) / w * view.span) * sr)));
    if (i0 >= n) break;
    let a = Infinity, z = -Infinity;
    if (i1 - i0 >= 2 * BLOCK) for (let b = Math.floor(i0 / BLOCK); b < Math.ceil(i1 / BLOCK); b++) {if (lo[b] < a) a = lo[b]; if (hi[b] > z) z = hi[b];}
    else for (let i = i0; i < i1; i++) {const v = mono[i]; if (v < a) a = v; if (v > z) z = v;}
    lctx.fillRect(px, mid - z * amp, 1, Math.max(1, (z - a) * amp));
  }
}
function paint() {
  const w = canvas.clientWidth, h = canvas.clientHeight, k = devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) {canvas.width = layer.width = Math.round(w * k); canvas.height = layer.height = Math.round(h * k); layerKey = '';}
  ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h);
  const d = duration(); if (!d) return;
  // the ruler: where the view is in the song, then seconds
  ctx.fillStyle = '#f2f3f5'; ctx.fillRect(0, 0, w, RULER);
  ctx.fillStyle = '#dde0e5'; ctx.fillRect(0, 0, w, 4);
  if (valid()) {ctx.fillStyle = '#236cba88'; ctx.fillRect(cut.start / d * w, 0, (cut.end - cut.start) / d * w, 4);}
  ctx.fillStyle = '#626a75'; ctx.fillRect(view.t0 / d * w, 0, Math.max(2, view.span / d * w), 4);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(position() / d * w - 1, 0, 2, 4);
  const [step, parts] = STEPS.find(([s]) => s / view.span * w >= 70) ?? STEPS.at(-1), minor = step / parts, digits = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  ctx.font = '11px system-ui'; ctx.textBaseline = 'alphabetic';
  for (let i = Math.ceil(view.t0 / minor); i * minor <= view.t0 + view.span; i++) {
    const x = Math.round(X(i * minor)), major = i % parts === 0;
    ctx.fillRect(x, major ? RULER - 9 : RULER - 4, 1, major ? 9 : 4);
    if (major) ctx.fillText((i * minor).toFixed(digits), x + 3, RULER - 12);
  }
  ctx.fillStyle = '#dde0e5'; ctx.fillRect(0, RULER, w, 1);
  // the cut, the waveform, the markers, the playhead
  if (valid()) {ctx.fillStyle = '#236cba1f'; ctx.fillRect(X(cut.start), RULER + 1, X(cut.end) - X(cut.start), h - RULER);}
  drawWave(w, h, k); ctx.drawImage(layer, 0, 0, w, h);
  ctx.font = '600 11px system-ui'; ctx.textBaseline = 'middle';
  for (const which of ['start', 'end']) {
    if (cut[which] === null) continue;
    const x = X(cut[which]), left = which === 'end', fw = 36;
    ctx.fillStyle = '#236cba'; ctx.fillRect(x - 1, RULER + 1, 2, h - RULER);
    ctx.fillRect(left ? x - fw : x, RULER + 1, fw, FLAG); ctx.fillStyle = '#fff'; ctx.fillText(which, (left ? x - fw : x) + 5, RULER + 1 + FLAG / 2);
  }
  const p = X(position()); ctx.fillStyle = '#c0392b'; ctx.fillRect(p - 1, 4, 2, h - 4);
  ctx.beginPath(); ctx.moveTo(p - 6, 4); ctx.lineTo(p + 6, 4); ctx.lineTo(p, 12); ctx.fill();
}
let wasInside = true;
function frame() {
  const p = position(), inside = p >= view.t0 && p <= view.t0 + view.span;
  if (playing && wasInside && !inside) {view.t0 = clampT0(p - view.span * 0.05);}   // follows the playhead unless he scrolled away from it
  wasInside = p >= view.t0 && p <= view.t0 + view.span;
  const text = p.toFixed(2); if ($('pos').textContent !== text) $('pos').textContent = text;
  paint(); requestAnimationFrame(frame);
}

// ── the page ──
function ui() {
  const len = cut.end !== null && cut.start !== null ? cut.end - cut.start : null;
  $('start').textContent = cut.start?.toFixed(2) ?? '–'; $('end').textContent = cut.end?.toFixed(2) ?? '–'; $('length').textContent = len?.toFixed(2) ?? '–';
  $('lengthBox').className = len !== null && (len < MIN - 0.005 || len > MAX + 0.005) ? 'amber' : '';
  $('play').textContent = playing ? 'Pause' : 'Play'; $('loop').classList.toggle('on', looping);
  for (const b of $('speeds').children) b.classList.toggle('on', +b.dataset.rate === rate);
}
const rows = songs.map((s, i) => el('button', {onclick: () => show(i)}, el('span'), s.title, el('small')));
$('index').append(...rows);
function list() {
  songs.forEach((s, i) => {
    const a = saved.get(s.song)?.answers, [dot, , small] = rows[i].childNodes;
    dot.className = `dot${a ? ' done' : ''}`; small.textContent = a ? `${(a.end - a.start).toFixed(2)} s` : ''; rows[i].classList.toggle('on', i === at);
  });
}
async function show(i) {
  halt(); playing = false; at = i; const s = songs[i], row = saved.get(s.song), mine = ++ticket;
  history.replaceState(null, '', `#${s.song}`);
  let draft = null; try {draft = JSON.parse(localStorage.getItem(draftKey(s.song)) ?? 'null');} catch {}
  clearTimeout(saving); cut = {start: draft?.start ?? row?.answers.start ?? null, end: draft?.end ?? row?.answers.end ?? null}; from = cut.start ?? 0;
  $('title').textContent = s.title; $('note').value = draft?.note ?? row?.note ?? ''; $('status').textContent = '';
  sound = peaks = null; layerKey = ''; $('loading').textContent = 'loading the song…'; list(); ui();
  const box = $('index').getBoundingClientRect(), r = rows[i].getBoundingClientRect();   // only the list scrolls, never the page
  if (r.top < box.top) $('index').scrollTop -= box.top - r.top; else if (r.bottom > box.bottom) $('index').scrollTop += r.bottom - box.bottom;
  try {
    const got = await load(s.song); if (mine !== ticket) return;
    sound = got.buffer; peaks = got.peaks; view = {t0: 0, span: sound.duration}; $('loading').textContent = '';
  } catch (error) {if (mine === ticket) $('loading').textContent = `The audio did not load: ${error.message}`;}
}
async function save() {
  const s = songs[at];
  if (!valid()) {$('status').textContent = 'Set a start (S) and an end (E) after it first.'; $('status').classList.add('bad'); return;}
  const answers = {start: r3(cut.start), end: r3(cut.end)}, note = $('note').value.trim(), error = await saveAnswer(s.song, answers, note, STUDY);
  if (!error) saved.set(s.song, {answers, note});
  report($('status'), error, `${answers.start.toFixed(2)} to ${answers.end.toFixed(2)} s`); list();
}
function mark(which) {if (!sound) return; cut[which] = r3(position()); ui(); keep(); if (looping) replay();}
// Nothing he sets is ever only in the page: every change of a marker or of the note is kept in the browser at once, and
// saved to the study as soon as both markers stand (Enter and Save do the same, at once).
const draftKey = song => `cut-2026-11:${song}`;
let saving = 0;
function keep() {
  const s = songs[at]; try {localStorage.setItem(draftKey(s.song), JSON.stringify({...cut, note: $('note').value}));} catch {}
  clearTimeout(saving); if (valid()) saving = setTimeout(() => void save(), 600);
}
function nextOpen() {for (let k = 1; k <= songs.length; k++) {const i = (at + k) % songs.length; if (!saved.has(songs[i].song)) return show(i);}}
const toggle = () => {if (!sound) return; if (playing) pause(); else play(from >= duration() - 0.01 ? 0 : from);};
const playCut = () => {if (cut.start !== null) play(cut.start);};
const toggleLoop = () => {looping = !looping; ui(); replay();};
$('play').onclick = toggle; $('playCut').onclick = playCut; $('loop').onclick = toggleLoop; $('save').onclick = () => void save(); $('note').addEventListener('input', keep);
for (const b of $('speeds').children) b.onclick = () => {rate = +b.dataset.rate; ui(); replay();};
document.addEventListener('mousedown', e => {if (e.target.closest('button')) e.preventDefault();});   // buttons never take the keys

// the waveform: wheel zooms around the pointer, Shift+wheel scrolls; the ruler drags the view; a marker drags; elsewhere sets the playhead
canvas.addEventListener('wheel', e => {
  e.preventDefault(); const d = duration(); if (!d) return;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? W() : 1, dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) view.t0 = clampT0(view.t0 + (dx || dy) / W() * view.span);
  else {
    const t = view.t0 + e.offsetX / W() * view.span, span = clamp(view.span * Math.exp(dy * 0.002), Math.min(NARROWEST, d), d);
    view = {t0: clampT0(t - e.offsetX / W() * span, span), span};
  }
}, {passive: false});
let drag = null;
const grab = (px, py) => {
  if (py < RULER) return 'scroll';
  const near = ['start', 'end'].filter(m => cut[m] !== null && Math.abs(X(cut[m]) - px) <= 8).sort((a, b) => Math.abs(X(cut[a]) - px) - Math.abs(X(cut[b]) - px));
  return near[0] ?? 'head';
};
canvas.onpointerdown = e => {
  if (!sound) return;
  canvas.setPointerCapture(e.pointerId); drag = {kind: grab(e.offsetX, e.offsetY), x: e.offsetX, t0: view.t0};
  if (drag.kind === 'head') seek(T(e.offsetX));
};
canvas.onpointermove = e => {
  if (!drag) {const g = sound ? grab(e.offsetX, e.offsetY) : ''; canvas.style.cursor = g === 'scroll' ? 'grab' : g === 'start' || g === 'end' ? 'ew-resize' : 'text'; return;}
  if (drag.kind === 'scroll') view.t0 = clampT0(drag.t0 - (e.offsetX - drag.x) / W() * view.span);
  else if (drag.kind === 'head') {if (!playing) from = T(e.offsetX);}
  else {cut[drag.kind] = r3(T(e.offsetX)); ui();}
};
canvas.onpointerup = canvas.onpointercancel = () => {if (drag && drag.kind !== 'scroll' && drag.kind !== 'head') {keep(); if (looping) replay();} drag = null;};

addEventListener('keydown', e => {
  if (e.target === $('note')) {if (e.key === 'Enter') {e.preventDefault(); void save();} else if (e.key === 'Escape') e.target.blur(); return;}
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, by = e.shiftKey ? 5 : 1;
  if (k === ' ') toggle();
  else if (k === 'ArrowLeft' || k === 'ArrowRight') seek(position() + (k === 'ArrowLeft' ? -by : by));
  else if (k === ',' || k === '.') seek(position() + (k === ',' ? -0.05 : 0.05));
  else if (k === 's' || k === 'e') mark(k === 's' ? 'start' : 'end');
  else if (k === 'p') playCut();
  else if (k === 'l') toggleLoop();
  else if (k === '[') {if (cut.start !== null) seek(cut.start);}
  else if (k === ']') {if (cut.end !== null) {if (playing) seek(cut.end); else {play(Math.max(0, cut.end - 2)); reveal(cut.end);}}}
  else if (k === 'Enter') void save();
  else if (k === 'ArrowDown') show(Math.min(songs.length - 1, at + 1));
  else if (k === 'ArrowUp') show(Math.max(0, at - 1));
  else if (k === 'n') nextOpen();
  else return;
  e.preventDefault();
});
window.cutPage = {state: () => ({song: songs[at].song, cut: {...cut}, view: {...view}, rate, looping, playing, position: position(), loaded: !!sound})};
show(at); requestAnimationFrame(frame);
