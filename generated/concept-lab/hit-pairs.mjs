// The hit-weight pairs: one strong hit looping in two camera versions, answers saved by the labels API.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {effectsAt} from './hit-motion-model.mjs';
import {realizedHits} from './hit-motion-realized.mjs';
import {versionFraming} from './hit-pairs-camera.mjs';

const BEFORE = 1.2, AFTER = 1.3;
const $ = id => document.getElementById(id), STUDY = new URLSearchParams(location.search).get('study') ?? 'hit-weight-2026-11';
const manifest = await (await fetch(`/generated/label-studies/${STUDY}/manifest.json`, {cache: 'no-store'})).json();
const only = new URLSearchParams(location.search).get('pair');
const done = new Set((await (await fetch(`/api/labels/${STUDY}`)).json()).labeled);
// the questions come from the study; an option named left or right reads A or B; a question with a `default` starts answered
const NAMES = {left: 'A', right: 'B', same: 'Same', neither: 'Neither', both: 'Both'};
$('questions').replaceChildren(...manifest.questions.flatMap(q => {
  const group = Object.assign(document.createElement('div'), {className: 'answers'}); group.dataset.q = q.id;
  group.append(...q.options.map(o => {const b = Object.assign(document.createElement('button'), {textContent: NAMES[o] ?? o}); b.dataset.v = o; return b;}));
  return [Object.assign(document.createElement('p'), {className: 'q', textContent: q.text}), group];
}));
const ready = () => manifest.questions.every(q => answers[q.id]);
// every pair stays reachable: Back reopens the one before, and a new answer replaces the earlier one (the last row counts)
const queue = manifest.clips.filter(c => !only || c.id === only), first = Math.max(0, queue.findIndex(c => !done.has(c.id)) < 0 ? queue.length : queue.findIndex(c => !done.has(c.id)));
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), rides = new Map();
const look = resolveLook('hokusai', {ends: 'none', hits: 'v1'});
let clip, ride, pictures = [], side = 0, from = 0, time = 0, playing = false, rate = 1, loadedSong, started = 0, ticket = 0;
const answers = {};

function loadRide(song) {
  if (!rides.has(song)) rides.set(song, (async () => {
    const scene = await (await fetch(`/generated/hit-effects/data/${song}.json`)).json();
    const [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
    // the three strongest hits, at least 2 s apart, away from the opening and the ending
    const hits = realizedHits(scene).filter(h => h.time > 3 && h.time < scene.span[1] - 4).sort((a, b) => b.strength - a.strength)
      .filter((h, i, a) => a.slice(0, i).every(p => Math.abs(p.time - h.time) > 2)).slice(0, 3).sort((a, b) => a.time - b.time);
    return {scene, replay, sprites, hits};
  })());
  return rides.get(song);
}
const pause = () => {music.pause(); playing = false;};
const play = async () => {playing = true; await music.play(time, rate);};
function show(i) {side = i; $('a').hidden = i !== 0; $('b').hidden = i !== 1; $('side').textContent = 'AB'[i]; $('showA').classList.toggle('on', i === 0); $('showB').classList.toggle('on', i === 1); draw();}
function draw() {pictures[side]?.draw(time, look);}
function setHit(i) {
  const h = ride.hits[i], t = h.time - ride.scene.timing.offset;
  from = Math.max(0, t - BEFORE); time = from; [...$('hits').children].forEach((b, j) => b.classList.toggle('on', j === i));
  if (playing) void play(); else draw();
}
async function open(index) {
  const n = ++ticket; pause(); pictures = []; $('form').hidden = true;
  $('done').hidden = true;
  if (index >= queue.length) {$('progress').textContent = 'Done'; $('back').hidden = queue.length === 0; clip = null; $('status').textContent = ''; $('done').hidden = false; $('hits').replaceChildren(); return;}
  clip = queue[index]; $('progress').textContent = `Pair ${index + 1} of ${queue.length}${done.has(clip.id) ? ' · answered, a new answer replaces it' : ''}`; $('back').hidden = index === 0; $('status').textContent = 'Loading…';
  ride = await loadRide(clip.song); if (n !== ticket) return;
  if (loadedSong !== clip.song) {await music.load('/' + ride.scene.audio); loadedSong = clip.song;}
  if (n !== ticket) return;
  pictures = [clip.left, clip.right].map((v, i) => createPicture($('ab'[i]), ride.scene, ride.replay, ride.sprites, N.riderPainter(), {
    effectsAt: effectsAt(v.shake === true ? 'current' : v.shake || 'still', 1, true, ride.scene.timing.offset, true), framing: versionFraming(v, ride.scene)}));
  $('hits').replaceChildren(...ride.hits.map((h, i) => Object.assign(document.createElement('button'), {textContent: `${(h.time - ride.scene.timing.offset).toFixed(1)} s · strength ${h.strength.toFixed(2)}`, onclick: () => setHit(i)})));
  for (const k of Object.keys(answers)) delete answers[k];
  for (const q of manifest.questions) if (q.default) answers[q.id] = q.default;
  document.querySelectorAll('.answers button').forEach(b => b.classList.toggle('on', answers[b.parentNode.dataset.q] === b.dataset.v)); $('note').value = ''; $('next').disabled = !ready();
  $('status').textContent = clip.song === 'tiki' ? 'Tiki Tiki' : 'Circus Minimus'; $('form').hidden = false; started = performance.now();
  show(0); setHit(Math.floor(ride.hits.length / 2)); if (music.context) void play();
  window.__ready = true;
}
async function save(skipped) {
  const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: clip.id, skipped, answers, note: $('note').value, viewMs: Math.round(performance.now() - started)})});
  if (!r.ok) {$('status').textContent = `Not saved: ${(await r.json()).error}`; return;}
  if (!skipped) done.add(clip.id);
  void open(queue.indexOf(clip) + 1);
}
$('back').onclick = () => void open((clip ? queue.indexOf(clip) : queue.length) - 1);
document.querySelectorAll('.answers').forEach(group => group.onclick = e => {
  const v = e.target.dataset?.v; if (!v) return;
  answers[group.dataset.q] = v; [...group.children].forEach(b => b.classList.toggle('on', b === e.target));
  $('next').disabled = !ready();
});
$('next').onclick = () => save(false); $('skip').onclick = () => save(true);
$('showA').onclick = () => {show(0); if (!playing) void play();}; $('showB').onclick = () => {show(1); if (!playing) void play();};
document.querySelector('.screen').onclick = () => playing ? pause() : void play();
addEventListener('keydown', e => {
  if (['TEXTAREA', 'INPUT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft') show(0); else if (e.key === 'ArrowRight') show(1); else if (e.key === ' ') show(1 - side);
  else if (e.key === 'p' || e.key === 'P') {playing ? pause() : void play(); return;}
  else if (e.key === 'h' || e.key === 'H') {rate = rate === 1 ? 0.5 : 1; if (playing) void play(); return;}
  else return;
  e.preventDefault(); if (!playing) void play();
});
function tick(ts) {
  if (playing && pictures.length) {
    time = music.position(shown(ts));
    if (time >= from + BEFORE + AFTER) {time = from; void play();}
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.hitPairs = {state: () => ({clip, side, time, from, playing}), show, version: i => pictures[i]};
await open(first);
