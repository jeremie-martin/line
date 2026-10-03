/** Blind impact labelling: one looping 1.5 s clip around a musical beat per page.
 * No source, compiler or measurement is shown. Answers are stored server-side
 * (POST /api/labels/<study>) so a session can resume on any device. */
import {prepareView} from './replay.js';

const $ = id => document.getElementById(id), audio = $('audio'), canvas = $('canvas');
const study = new URLSearchParams(location.search).get('study') ?? 'impact-2026-10';
const state = {manifest: null, index: 0, answers: {}, labeled: new Set(), view: null, trace: null, clip: null,
  t: 0, playing: false, slow: false, last: 0, shownAt: 0, token: 0};
const status = (text, error = false) => {$('status').textContent = text; $('status').classList.toggle('error', error);};
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
async function fetchChecked(url, digest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url} (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (digest && await sha256(bytes) !== digest) throw new Error(`${url} does not match the study manifest`);
  return bytes;
}
const audioUrls = new Map();
async function audioFor(clip) {
  if (!audioUrls.has(clip.audio)) audioUrls.set(clip.audio,
    fetchChecked(clip.audio, clip.audioSha256).then(bytes => URL.createObjectURL(new Blob([bytes], {type: 'audio/mpeg'}))));
  return audioUrls.get(clip.audio);
}

function renderQuestions() {
  const form = $('questions'); form.replaceChildren();
  for (const q of state.manifest.questions) {
    const set = document.createElement('fieldset'), legend = document.createElement('legend'), row = document.createElement('div');
    legend.textContent = q.text; row.className = 'choices';
    for (const option of q.options) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = option;
      b.classList.toggle('on', state.answers[q.id] === option);
      b.onclick = () => {state.answers[q.id] = option; renderQuestions();};
      row.append(b);
    }
    set.append(legend, row); form.append(set);
  }
  $('next').disabled = !state.manifest.questions.every(q => state.answers[q.id]);
}

function draw() {
  if (!state.view || !state.trace) return;
  const at = Math.max(0, Math.min(state.t * 40, state.trace.length - 1)), f = Math.floor(at), k = at - f;
  const a = state.trace[f], b = state.trace[Math.min(f + 1, state.trace.length - 1)];
  state.view.draw(canvas, {x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k,
    w: canvas.clientWidth, h: canvas.clientHeight, z: 1.6, r: Math.min(2, devicePixelRatio)}, at);
  $('flash').classList.toggle('on', $('beat-light').checked && Math.abs(state.t - state.clip.beat) < 0.06);
}
function tick(now) {
  if (state.playing && state.clip) {
    if (state.slow) state.t += (now - state.last) / 1000 / 4; else state.t = audio.currentTime;
    if (state.t >= state.clip.end) {
      state.t = state.clip.start;
      if (!state.slow) audio.currentTime = state.t;
    }
    draw();
  }
  state.last = now; requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

async function play() {
  state.playing = true; $('play').textContent = 'Pause';
  if (state.slow) audio.pause(); else {audio.currentTime = state.t; await audio.play();}
}
function pause() {state.playing = false; $('play').textContent = 'Play'; audio.pause();}
$('play').onclick = () => state.playing ? pause() : play().catch(e => status(e.message, true));
$('slow').onclick = () => {
  state.slow = !state.slow; $('slow').setAttribute('aria-pressed', String(state.slow));
  if (state.playing) play().catch(e => status(e.message, true));
};
$('beat-light').onchange = draw;

async function open(index) {
  const token = ++state.token, clips = state.manifest.clips;
  state.index = Math.max(0, Math.min(index, clips.length - 1));
  const clip = state.clip = clips[state.index];
  state.answers = {}; $('note').value = ''; renderQuestions();
  $('progress').textContent = `${state.labeled.size} labeled · clip ${state.index + 1} / ${clips.length}`;
  $('back').disabled = state.index === 0;
  pause(); state.view = null; status('Loading…');
  try {
    const [recordBytes, audioUrl] = await Promise.all([fetchChecked(clip.record, clip.recordSha256), audioFor(clip)]);
    if (token !== state.token) return;
    const record = JSON.parse(new TextDecoder().decode(recordBytes));
    const {view} = await prepareView(record, clip.recordSha256);
    if (token !== state.token) return;
    state.view = view; state.trace = record.trace.frames; state.t = clip.start;
    if (audio.src !== audioUrl) {audio.src = audioUrl; await new Promise(r => audio.addEventListener('loadedmetadata', r, {once: true}));}
    state.shownAt = performance.now(); draw(); status('');
    await play().catch(() => status('Press Play to start the clip (the browser blocked autoplay).'));
  } catch (e) {if (token === state.token) status(String(e.message ?? e), true);}
}

async function save(skipped) {
  const clip = state.clip, body = {clip: clip.id, skipped, answers: skipped ? null : state.answers,
    note: $('note').value.trim() || null, viewMs: Math.round(performance.now() - state.shownAt), at: new Date().toISOString()};
  const response = await fetch(`/api/labels/${study}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? `Saving failed (${response.status})`);
  if (!skipped) state.labeled.add(clip.id);
}
$('next').onclick = () => save(false).then(() => open(nextUnlabeled(state.index + 1))).catch(e => status(e.message, true));
$('skip').onclick = () => save(true).then(() => open(nextUnlabeled(state.index + 1))).catch(e => status(e.message, true));
$('back').onclick = () => open(state.index - 1);
function nextUnlabeled(from) {
  const clips = state.manifest.clips;
  for (let k = 0; k < clips.length; k++) {const i = (from + k) % clips.length; if (!state.labeled.has(clips[i].id)) return i;}
  status('All clips are labeled. Thank you!'); return Math.min(from, clips.length - 1);
}

try {
  state.manifest = JSON.parse(new TextDecoder().decode(await fetchChecked(`/generated/label-studies/${study}/manifest.json`)));
  if (state.manifest.schema !== 'line.label-study.v1') throw new Error('Unknown study format');
  $('instructions').textContent = state.manifest.instructions;
  const done = await (await fetch(`/api/labels/${study}`)).json();
  for (const id of done.labeled ?? []) state.labeled.add(id);
  await open(nextUnlabeled(0));
} catch (e) {status(String(e.message ?? e), true);}
