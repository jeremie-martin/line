// The cuts board: for every song, the 30 to 45 seconds that become its short video. Data from generated/lab-rides/cuts.json
// (prepare-cuts.mjs): loudness to draw, the rhythm a loop is judged by, sections, the owner's note on the song's spec, proposed
// cuts. The owner picks a proposal or drags the two handles; the page plays the cut as a loop without a gap (the finished video
// also blends its last half second into the music before its start) and computes the match the way production does
// (scripts/video/loop_audio.ts loopPoint, tools/music/passage.ts). Saved to the study cuts-2026-11, one row per save.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const STUDY = 'cuts-2026-11', MIN = 30, MAX = 45;
const $ = id => document.getElementById(id), saved = await loadAnswers(STUDY);
const response = await fetch('/generated/lab-rides/cuts.json', {cache: 'no-store'});
if (!response.ok) {$('title').textContent = 'No data yet: run node generated/concept-lab/closing/prepare-cuts.mjs'; throw new Error('cuts.json is missing');}
const {step, draw, compared, songs} = await response.json(), state = s => saved.get(s.song) ?? {answers: {}, note: ''}, decided = s => state(s).answers.cut;
let at = Math.max(0, songs.findIndex(s => s.song === location.hash.slice(1))), cut = {start: 0, end: 0}, proposal = -1;
const canvas = $('timeline'), ctx = canvas.getContext('2d'), video = $('video');
const clock = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// ── the match: the rhythm of the last `compared` seconds against the rhythm of the `compared` seconds before the start ──
const squares = new Map();
function match(s, start, end) {
  const beat = s.rhythm, n = Math.round(compared / step), a = Math.round(start / step), b = Math.min(beat.length, Math.round(end / step));
  if (a < n || b - a < n) return null;
  if (!squares.has(s)) {const q = new Float64Array(beat.length + 1); for (let i = 0; i < beat.length; i++) q[i + 1] = q[i] + beat[i] * beat[i]; squares.set(s, q);}
  const q = squares.get(s); let dot = 0; for (let i = 1; i <= n; i++) dot += beat[b - i] * beat[a - i];
  return dot / (Math.sqrt((q[b] - q[b - n]) * (q[a] - q[a - n])) || 1);
}
function bestEnd(s, start, around, reach = 1.5) {
  let best = around, top = -2;
  for (let e = Math.max(start + MIN, around - reach); e <= Math.min(s.seconds, start + MAX, around + reach); e += step) {const m = match(s, start, e) ?? -1; if (m > top) {top = m; best = e;}}
  return best;
}
function nearestOnset(s, t) {
  const beat = s.rhythm, level = Float64Array.from(beat).sort()[Math.floor(beat.length * 0.9)]; let best = t, gap = Infinity;
  for (let i = Math.round(Math.max(compared, t - 1.5) / step); i < Math.min(beat.length - 1, (t + 1.5) / step); i++)
    if (beat[i] >= level && beat[i] >= beat[i - 1] && beat[i] > beat[i + 1] && Math.abs(i * step - t) < gap) {gap = Math.abs(i * step - t); best = (i - 2) * step;}
  return best;
}

// ── sound: the cut as one buffer region the browser loops without a gap; the muted video follows its clock ──
const audio = new AudioContext(), buffers = new Map();
let source = null, startedAt = 0, startedFrom = 0, playing = false, ticket = 0;
const buffer = s => {if (!buffers.has(s.song)) buffers.set(s.song, fetch(s.audio).then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b))); return buffers.get(s.song);};
function position() {
  if (!playing) return startedFrom;
  const t = startedFrom + audio.currentTime - startedAt, span = cut.end - cut.start;
  return t < cut.end || span <= 0 ? t : cut.start + (t - cut.end) % span;
}
function stop() {if (source) {source.onended = null; try {source.stop();} catch {} source = null;} startedFrom = position(); playing = false; video.pause(); $('play').textContent = 'Play';}
async function play(from = position()) {
  const mine = ++ticket, s = songs[at], sound = await buffer(s); if (mine !== ticket) return;
  if (source) {try {source.stop();} catch {} source = null;}
  await audio.resume();
  if (!(from >= cut.start && from < cut.end)) from = cut.start;
  source = audio.createBufferSource(); source.buffer = sound; source.loop = true; source.loopStart = cut.start; source.loopEnd = cut.end; source.connect(audio.destination);
  source.start(0, from); startedAt = audio.currentTime; startedFrom = from; playing = true; $('play').textContent = 'Pause';
  if (s.video) void video.play().catch(() => {});
}
const replay = () => {if (playing) void play(Math.min(position(), cut.end - 0.01));};

// ── drawing ──
const PAD = 10, TOP = 46, x = t => PAD + t / songs[at].seconds * (canvas.clientWidth - 2 * PAD), timeAt = px => Math.max(0, Math.min(songs[at].seconds, (px - PAD) / (canvas.clientWidth - 2 * PAD) * songs[at].seconds));
function paint() {
  const s = songs[at], w = canvas.clientWidth, h = canvas.clientHeight, k = devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * k)) {canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);}
  ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h);
  const base = h - 26, tall = base - TOP - 8;
  // the cut
  ctx.fillStyle = '#236cba1f'; ctx.fillRect(x(cut.start), TOP - 4, x(cut.end) - x(cut.start), base - TOP + 8);
  // where the lead-in is compared: the six seconds before the start and the last six
  ctx.fillStyle = '#b8741a26'; ctx.fillRect(x(Math.max(0, cut.start - compared)), base + 4, x(cut.start) - x(Math.max(0, cut.start - compared)), 4); ctx.fillRect(x(cut.end - compared), base + 4, x(cut.end) - x(cut.end - compared), 4);
  // loudness
  ctx.fillStyle = '#1b1f25'; s.level.forEach((v, i) => {const t = i * draw, inside = t >= cut.start && t < cut.end; ctx.globalAlpha = inside ? 0.85 : 0.3; ctx.fillRect(x(t), base - v / 100 * tall, Math.max(1, x(draw) - x(0) - 0.3), v / 100 * tall);}); ctx.globalAlpha = 1;
  // sections
  ctx.font = '11px system-ui'; ctx.textBaseline = 'top';
  s.sections.forEach(p => {ctx.fillStyle = '#626a75'; ctx.fillRect(x(p.t), TOP - 4, 1, base - TOP + 8); ctx.fillText(p.name.toLowerCase(), x(p.t) + 4, TOP - 2);});
  // proposals
  s.cuts.forEach((c, i) => {ctx.fillStyle = i === proposal ? '#236cba' : '#236cba66'; ctx.fillRect(x(c.start), 8 + i * 11, x(c.end) - x(c.start), 7); ctx.fillStyle = '#236cba'; ctx.fillText(String(i + 1), x(c.start) - 9, 5 + i * 11);});
  // seconds
  ctx.fillStyle = '#626a75'; ctx.textBaseline = 'alphabetic'; for (let t = 0; t <= s.seconds; t += 5) {ctx.fillRect(x(t), base + 10, 1, t % 10 ? 3 : 6); if (t % 10 === 0) ctx.fillText(String(t), x(t) + 3, h - 4);}
  // handles and the playhead
  for (const t of [cut.start, cut.end]) {ctx.fillStyle = '#236cba'; ctx.fillRect(x(t) - 1.5, TOP - 8, 3, base - TOP + 16); ctx.beginPath(); ctx.arc(x(t), TOP - 8, 6, 0, 2 * Math.PI); ctx.fill();}
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x(position()) - 1, TOP - 4, 2, base - TOP + 8);
}
function read() {
  const s = songs[at], m = match(s, cut.start, cut.end), length = cut.end - cut.start;
  $('read').replaceChildren(
    el('span', {}, 'from ', el('b', {textContent: clock(cut.start)}), ' to ', el('b', {textContent: clock(cut.end)})),
    el('span', {className: length < MIN - 0.01 || length > MAX + 0.01 ? 'weak' : ''}, el('b', {textContent: `${length.toFixed(1)} s`})),
    el('span', {className: m === null ? 'weak' : m >= 0.75 ? 'fine' : m < 0.4 ? 'weak' : ''}, m === null ? `starts less than ${compared} s into the song: nothing to lead into it` : el('b', {textContent: `match ${m.toFixed(2)}`})));
  [...$('proposals').children].forEach((b, i) => b.classList.toggle('on', i === proposal));
}
function frame() {
  const s = songs[at];
  if (playing && s.video && video.readyState > 0) {const t = position(); if (Math.abs(video.currentTime - t) > 0.12) video.currentTime = t;}
  paint(); requestAnimationFrame(frame);
}

// ── choosing ──
function setCut(start, end, from = -1) {
  const s = songs[at]; start = Math.max(0, Math.min(start, s.seconds - 1)); end = Math.max(start + 1, Math.min(end, s.seconds));
  cut = {start, end}; proposal = from; read(); replay(); if (!playing) {startedFrom = cut.start; if (s.video && video.readyState > 0) video.currentTime = cut.start;}
}
function progress() {
  const done = songs.filter(decided).length;
  $('progress').max = songs.length; $('progress').value = done; $('count').textContent = `${done} of ${songs.length} songs decided`; $('next').disabled = done === songs.length;
  songs.forEach((s, i) => {const [dot, , small] = rows[i].childNodes, a = state(s).answers; dot.className = `dot${a.cut === 'cut' || a.cut === 'whole' ? ' done' : a.cut ? ' out' : ''}`; small.textContent = a.cut === 'cut' ? `${(a.end - a.start).toFixed(0)} s` : a.cut === 'whole' ? 'whole' : a.cut ? 'no short' : `${s.seconds.toFixed(0)} s`; rows[i].classList.toggle('on', i === at);});
}
const rows = songs.map((s, i) => el('button', {onclick: () => show(i)}, el('span'), s.title, el('small')));
$('index').append(...rows);
function show(i) {
  stop(); at = i; const s = songs[i], a = state(s).answers;
  history.replaceState(null, '', `#${s.song}`);
  $('title').textContent = s.title; $('note').value = state(s).note; $('status').textContent = '';
  if (s.video) {video.src = s.video; video.hidden = false;} else {video.removeAttribute('src'); video.hidden = true;}
  $('facts').replaceChildren(...[
    s.note ? el('div', {}, el('b', {textContent: 'Your note on its spec: '}), el('q', {textContent: s.note})) : null,
    s.comment ? el('div', {}, el('b', {textContent: 'On this song as a short: '}), s.comment) : null,
    s.cuts.length ? null : el('div', {textContent: 'No proposals for this song yet.'})].filter(Boolean));
  $('proposals').replaceChildren(...s.cuts.map((c, k) => el('button', {className: 'proposal', onclick: () => setCut(c.start, c.end, k)}, el('b', {textContent: `${k + 1} · ${clock(c.start)} to ${clock(c.end)} · ${(c.end - c.start).toFixed(1)} s · match ${(match(s, c.start, c.end) ?? c.match ?? 0).toFixed(2)}`}), el('span', {textContent: c.why}))));
  if (a.cut === 'cut') setCut(a.start, a.end, s.cuts.findIndex(c => Math.abs(c.start - a.start) < 0.01 && Math.abs(c.end - a.end) < 0.01));
  else if (s.cuts.length) setCut(s.cuts[0].start, s.cuts[0].end, 0);
  else {const start = Math.min(compared + 0.5, Math.max(0, s.seconds - 38)); setCut(start, bestEnd(s, start, Math.min(s.seconds, start + 38), 4));}
  startedFrom = cut.start; rows[i].scrollIntoView({block: 'nearest'}); progress(); void buffer(s);
}
async function keep(answers, what) {
  const s = songs[at]; saved.set(s.song, {answers, note: $('note').value});
  report($('status'), await saveAnswer(s.song, answers, $('note').value, STUDY), what); progress();
}
const saveCut = () => keep({cut: 'cut', start: +cut.start.toFixed(3), end: +cut.end.toFixed(3), match: +(match(songs[at], cut.start, cut.end) ?? 0).toFixed(2), proposal: proposal + 1}, `the cut ${clock(cut.start)} to ${clock(cut.end)}`);
$('save').onclick = saveCut; $('whole').onclick = () => keep({cut: 'whole'}, 'the song stays whole'); $('none').onclick = () => keep({cut: 'none'}, 'no short of this song');
$('note').onchange = () => keep(state(songs[at]).answers, 'your note');
$('play').onclick = () => playing ? stop() : void play();
const seam = () => void play(Math.max(cut.start, cut.end - 3));
$('seam').onclick = seam;
const snap = () => setCut(cut.start, bestEnd(songs[at], cut.start, cut.end), -1);
$('snap').onclick = snap; $('onset').onclick = () => setCut(nearestOnset(songs[at], cut.start), cut.end, -1);
const nextOpen = () => {for (let k = 1; k <= songs.length; k++) {const i = (at + k) % songs.length; if (!decided(songs[i])) return show(i);}};
$('next').onclick = nextOpen;

// dragging: a handle when the pointer starts near one, otherwise the playhead
let drag = null;
canvas.onpointerdown = e => {
  const px = e.offsetX, near = t => Math.abs(x(t) - px) < 12;
  drag = near(cut.start) ? 'start' : near(cut.end) ? 'end' : null; canvas.setPointerCapture(e.pointerId);
  if (!drag) {const t = timeAt(px); if (t >= cut.start && t < cut.end) {if (playing) void play(t); else {startedFrom = t; if (songs[at].video) video.currentTime = t;}}}
};
canvas.onpointermove = e => {if (!drag) return; const t = timeAt(e.offsetX); if (drag === 'start') setCut(Math.min(t, cut.end - 5), cut.end); else setCut(cut.start, Math.max(t, cut.start + 5));};
canvas.onpointerup = () => {drag = null;};
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault(); e.target.blur();} return;}
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase(), s = songs[at];
  if (k === ' ') playing ? stop() : void play();
  else if (k === 'e') seam();
  else if (k === 's') snap();
  else if (k >= '1' && k <= '9' && s.cuts[+k - 1]) setCut(s.cuts[+k - 1].start, s.cuts[+k - 1].end, +k - 1);
  else if (k === 'enter') void saveCut();
  else if (k === 'arrowdown') show(Math.min(songs.length - 1, at + 1));
  else if (k === 'arrowup') show(Math.max(0, at - 1));
  else if (k === 'n') nextOpen();
  else return;
  e.preventDefault();
});
window.cutsPage = {songs, match, state: () => ({at, cut, proposal, playing, position: position()})};
show(at); requestAnimationFrame(frame);
