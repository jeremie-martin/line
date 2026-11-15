// The hit dials: a passage loops while the owner sets carry, punch and shake to taste (the method of adjustment: finer
// than choosing between two close versions). Every trial starts from random settings; the chosen and the starting settings are saved.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {hitEffectsAt} from '/scripts/video/hits.js';
import {motionAt} from './hit-motion-model.mjs';
import {realizedHits} from './hit-motion-realized.mjs';
import {versionFraming} from './hit-pairs-camera.mjs';

const STUDY = 'hit-dial-2026-11', DIALS = ['carry', 'punch', 'shake'];
const $ = id => document.getElementById(id);
const manifest = await (await fetch(`/generated/label-studies/${STUDY}/manifest.json`, {cache: 'no-store'})).json();
const done = new Set((await (await fetch(`/api/labels/${STUDY}`)).json()).labeled);
const queue = manifest.clips, firstOpen = queue.findIndex(c => !done.has(c.id));
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {ends: 'none', hits: 'v1'});
// the version being set: today's camera, with the three dials read at every frame
const live = {follow: 'carry', zoom: 6.2, punch: 0, carry: {gain: 0}, shake: 1}, TODAY = {follow: 'pinned', zoom: 6.2, punch: 0};
let clip, ride, mine, today, from = 0, length = 2.5, time = 0, playing = false, rate = 1, loadedSong, started = 0, ticket = 0, start = {}, holding = false, beside = false;

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/hit-effects/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    const all = realizedHits(scene).filter(h => h.time > 3 && h.time < scene.span[1] - 5), apart = (list, gap) => list.filter((h, i, a) => a.slice(0, i).every(p => Math.abs(p.time - h.time) > gap));
    const strong = apart([...all].sort((a, b) => b.strength - a.strength), 2).slice(0, 3).sort((a, b) => a.time - b.time);
    // medium hits: nearest 0.62, away from the strong ones shown
    const medium = apart([...all].filter(h => h.strength >= 0.55 && h.strength < 0.7 && strong.every(s => Math.abs(s.time - h.time) > 1.5)).sort((a, b) => Math.abs(a.strength - 0.62) - Math.abs(b.strength - 0.62)), 3).slice(0, 2).sort((a, b) => a.time - b.time);
    // the 4 s with the most hits of 0.55 or more
    const dense = all.reduce((best, h) => {const n = all.filter(p => p.time >= h.time && p.time < h.time + 4 && p.strength >= 0.55).length; return n > best.n ? {time: h.time, n} : best;}, {time: all[0].time, n: 0});
    return {scene, replay, sprites, strong, medium, dense};
  })());
  return rides.get(song);
}
const pause = () => {music.pause(); playing = false;};
const play = async () => {playing = true; await music.play(time, rate);};
const effects = v => (hits, t) => ({...hitEffectsAt(hits, t), ...motionAt('current', hits, t, v.shake)});
function draw() {
  if (!mine) return;
  if (beside) {mine.draw(time, look); today.draw(time, look);} else (holding ? today : mine).draw(time, look);
}
function layout() {
  $('pair').classList.toggle('single', !beside); $('today').parentNode.classList.toggle('hidden', !beside && !holding); $('mine').parentNode.classList.toggle('hidden', !beside && holding);
  $('beside').classList.toggle('on', beside); $('hold').classList.toggle('on', holding); draw();
}
function read() {live.carry.gain = +$('carry').value; live.punch = +$('punch').value; live.shake = +$('shake').value; if (!playing) draw();}
async function open(index) {
  const n = ++ticket; pause(); mine = today = null; $('form').hidden = true; $('done').hidden = true; $('back').hidden = index <= 0;
  if (index >= queue.length) {clip = null; $('progress').textContent = 'Done'; $('status').textContent = ''; $('done').hidden = false; return;}
  clip = queue[index]; $('progress').textContent = `Passage ${index + 1} of ${queue.length}${done.has(clip.id) ? ' · set before, saving replaces it' : ''}`; $('status').textContent = 'Loading…';
  ride = await loadRide(clip.song); if (n !== ticket) return;
  if (loadedSong !== clip.song) {await music.load('/' + ride.scene.audio); loadedSong = clip.song;}
  if (n !== ticket) return;
  const off = ride.scene.timing.offset, hit = clip.kind === 'dense' ? null : ride[clip.kind][Math.min(clip.index, ride[clip.kind].length - 1)];
  if (hit) {from = Math.max(0, hit.time - off - 1.2); length = 2.5;} else {from = Math.max(0, ride.dense.time - off - 0.6); length = 4.6;}
  const make = (id, v) => createPicture($(id), ride.scene, ride.replay, ride.sprites, N.riderPainter(), {effectsAt: effects(v), framing: versionFraming(v, ride.scene)});
  mine = make('mine', live); today = make('today', {...TODAY, shake: 1});
  start = {carry: +(Math.random() * 3).toFixed(2), punch: +(Math.random() * 0.2).toFixed(3), shake: +(Math.random() * 2).toFixed(2)};
  for (const d of DIALS) $(d).value = start[d];
  read(); $('note').value = '';
  $('status').textContent = `${clip.song === 'tiki' ? 'Tiki Tiki' : 'Circus Minimus'} · ${hit ? `one hit, strength ${hit.strength.toFixed(2)}` : `a dense passage, ${ride.dense.n} hits`}`;
  $('form').hidden = false; started = performance.now(); time = from; layout(); if (music.context) void play();
  window.__ready = true;
}
async function save(skipped) {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: clip.id, skipped, answers: {carry: live.carry.gain, punch: live.punch, shake: live.shake, start}, note: $('note').value, viewMs: Math.round(performance.now() - started)})});
  if (!r.ok) {$('status').textContent = `Not saved: ${(await r.json()).error}`; return;}
  if (!skipped) done.add(clip.id);
  void open(queue.indexOf(clip) + 1);
}
for (const d of DIALS) $(d).oninput = () => {read(); if (!playing) void play();};
$('next').onclick = () => save(false); $('skip').onclick = () => save(true);
$('back').onclick = () => void open((clip ? queue.indexOf(clip) : queue.length) - 1);
$('beside').onclick = () => {beside = !beside; layout();};
$('half').onclick = () => {rate = rate === 1 ? 0.5 : 1; $('half').classList.toggle('on', rate !== 1); if (playing) void play();};
const hold = on => {if (holding !== on) {holding = on; layout();}};
$('hold').onpointerdown = () => hold(true); $('hold').onpointerup = $('hold').onpointerleave = () => hold(false);
for (const s of document.querySelectorAll('.screen')) s.onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 't' || e.key === 'T') hold(true); else if (e.key === 'p' || e.key === 'P') playing ? pause() : void play();
});
addEventListener('keyup', e => {if (e.key === 't' || e.key === 'T') hold(false);});
function tick(ts) {
  if (playing && mine) {time = music.position(shown(ts)); if (time >= from + length) {time = from; void play();} draw();}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.hitDial = {state: () => ({clip, time, from, length, live, start}), draw: t => mine.draw(t, look)};
await open(firstOpen < 0 ? queue.length : firstOpen);
