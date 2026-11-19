// Zoom range: the two ends of the zoom scale (scripts/video/zoom.js ZOOM: the magnification at the closest and at the widest,
// against the camera's base picture), tried live on a song's ride with one of its lanes, or held at one end for the whole song.
// The choice is saved with a note (labels/studies/zoom-range-2026-11.jsonl; the latest row counts). Scenes: the production
// set's rides, prepared into generated/lab-rides/range/ (prepare-rides.mjs --out), listed in its index.json.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {ZOOM} from '/scripts/video/zoom.js';

const STUDY = 'zoom-range-2026-11', $ = id => document.getElementById(id);
const PRESETS = [['Today', ZOOM.closest, ZOOM.widest], ['Closest a little further', 1.075, ZOOM.widest], ['Closest further still', 1.05, ZOOM.widest],
  ['Closest further, widest wider', 1.075, 0.785], ['Closest further, widest less wide', 1.075, 0.825]];
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map(), look = resolveLook('hokusai', {hits: 'v1'});
const q = new URLSearchParams(location.hash.slice(1));
let ride = null, picture = null, today = null, playing = false, holding = false, time = 0, ticket = 0, pending = 0, mode = q.get('mode') ?? 'lane';
const range = () => ({closest: +$('closest').value, widest: +$('widest').value});
const pct = x => `${Math.abs(x * 100).toFixed(x * 100 % 1 ? 1 : 0)} %`;

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/lab-rides/range/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    return {scene, replay, sprites};
  })());
  return rides.get(song);
}
const keyframes = () => mode === 'closest' ? [{t: 0, wide: 0}] : mode === 'widest' ? [{t: 0, wide: 1}] : (ride.scene.zooms.find(l => l.id === $('lane').value) ?? ride.scene.zooms[0])?.keyframes ?? [{t: 0, wide: 0.5}];
function build() {
  if (!ride) return;
  const {scene, replay, sprites} = ride, zoom = {keyframes: keyframes().map(k => ({...k}))};
  picture = createPicture($('mine'), {...scene, zoom, zoomRange: range()}, replay, sprites, N.riderPainter());
  today = {zoom, make: () => createPicture($('mine'), {...scene, zoom}, replay, sprites, N.riderPainter()), picture: null};
  if (!playing) draw();
}
function draw() {
  if (!picture) return;
  if (holding) (today.picture ??= today.make()).draw(time, look); else picture.draw(time, look);
  $('seek').value = time; $('clock').textContent = `${time.toFixed(1)} s`;
  $('label').textContent = holding ? "Today's range" : mode === 'closest' ? 'Held at the closest' : mode === 'widest' ? 'Held at the widest' : $('lane').selectedOptions[0]?.textContent ?? '';
}
function change() {
  const {closest, widest} = range();
  $('closest-out').textContent = `${closest.toFixed(3)} ×`; $('widest-out').textContent = `${widest.toFixed(3)} ×`;
  $('closest-says').textContent = closest === 1 ? 'At its closest the picture is the base picture.' : `At its closest everything is ${pct(closest - 1)} larger than in the base picture.`;
  $('widest-says').textContent = `At its widest the picture shows ${pct(1 / widest - 1)} more than the base picture.`;
  $('range-says').textContent = `The widest shows ${(closest / widest).toFixed(2)} times more than the closest (today: ${(ZOOM.closest / ZOOM.widest).toFixed(2)}). A song without lanes sits at ${Math.sqrt(closest * widest).toFixed(3)} ×.`;
  for (const b of $('presets').children) b.classList.toggle('on', Math.abs(+b.dataset.closest - closest) < 1e-6 && Math.abs(+b.dataset.widest - widest) < 1e-6);
  for (const b of $('mode').children) b.classList.toggle('on', b.dataset.mode === mode);
  history.replaceState(null, '', '#' + new URLSearchParams({song: $('song').value, lane: $('lane').value, mode, closest, widest}));
  clearTimeout(pending); pending = setTimeout(build, 120);
}
async function load() {
  const n = ++ticket, song = $('song').value; pause(); picture = ride = null; $('play').disabled = true; $('status').textContent = 'Loading…';
  const next = await loadRide(song); if (n !== ticket) return;
  await music.load('/' + next.scene.audio); if (n !== ticket) return;
  ride = next; time = Math.min(time, ride.scene.span[1]); $('seek').max = ride.scene.span[1];
  $('lane').replaceChildren(...ride.scene.zooms.map(l => new Option(`Lane: ${l.name}`, l.id)));
  if (ride.scene.zooms.some(l => l.id === q.get('lane'))) $('lane').value = q.get('lane');
  $('play').disabled = false; $('status').textContent = ''; change();
}
const pause = () => {if (playing) time = music.pause(); playing = false; $('play').textContent = 'Play';};
const play = async () => {if (!ride) return; playing = true; $('play').textContent = 'Pause'; await music.play(time);};
function seek(t) {const on = playing; pause(); time = Math.max(0, Math.min(ride.scene.span[1], t)); draw(); if (on) void play();}
const hold = on => {if (holding !== on) {holding = on; draw();}};
const setMode = m => {mode = m; change();};

$('presets').replaceChildren(...PRESETS.map(([name, closest, widest]) => Object.assign(document.createElement('button'), {textContent: `${name} (${closest} / ${widest})`,
  onclick: () => {$('closest').value = closest; $('widest').value = widest; change();}})));
PRESETS.forEach(([, closest, widest], i) => Object.assign($('presets').children[i].dataset, {closest, widest}));
$('closest').oninput = $('widest').oninput = change;
$('lane').onchange = () => {mode = 'lane'; change();};
$('song').onchange = () => {time = 0; void load();};
$('mode').onclick = e => {const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode);};
$('play').onclick = () => playing ? pause() : void play();
$('seek').oninput = () => seek(+$('seek').value);
document.querySelector('.screen').onclick = () => playing ? pause() : void play();
$('keep').onclick = async () => {
  const {closest, widest} = range();
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: 'range', skipped: false, answers: {closest, widest, song: $('song').value, lane: $('lane').value}, note: $('note').value})});
  $('status').textContent = r.ok ? `Saved: closest ${closest}, widest ${widest} (${new Date().toLocaleTimeString()}).` : `Not saved: ${(await r.json()).error}`;
};
addEventListener('keydown', e => {
  if (['TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true);
  else if (e.key === ' ') {e.preventDefault(); playing ? pause() : void play();}
  else if (e.key === '1') setMode('lane'); else if (e.key === '2') setMode('closest'); else if (e.key === '3') setMode('widest');
  else if (e.key === 'ArrowLeft' && e.target.type !== 'range') seek(time - 5); else if (e.key === 'ArrowRight' && e.target.type !== 'range') seek(time + 5);
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
function tick(ts) {
  if (playing && picture) {time = music.position(shown(ts)); if (time >= ride.scene.span[1]) {pause(); time = ride.scene.span[1];} draw();}
  requestAnimationFrame(tick);
}
const songs = await (await fetch('/generated/lab-rides/range/index.json', {cache: 'no-store'})).json();
$('song').replaceChildren(...songs.map(s => new Option(s.title, s.song)));
if (songs.some(s => s.song === q.get('song'))) $('song').value = q.get('song');
$('closest').value = q.get('closest') ?? ZOOM.closest; $('widest').value = q.get('widest') ?? ZOOM.widest;
window.zoomRange = {state: () => ({time, mode, ...range()}), drawAt: t => {time = t; draw();}};
requestAnimationFrame(tick);
await load();
