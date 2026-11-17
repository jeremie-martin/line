// The specs board: every song of the second set of specifications (generated/watch/astra.json: the new spec, a revision where
// there is one, and the song's current spec, as whole videos) with the owner's mark and note on each, saved to the study
// astra-2026-11. A note is his words on a song, with video times; the mark is about the newest version of the new spec.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const STUDY = 'astra-2026-11';
const MARKS = [['take', 'Take the new spec', 'It becomes the song\u2019s spec.'], ['changes', 'Take it, after changes', 'Say what to change in the note, with times.'], ['current', 'Keep the current spec', 'The new one is not better.']];
const $ = id => document.getElementById(id), saved = await loadAnswers(STUDY);
const response = await fetch('/generated/watch/astra.json', {cache: 'no-store'});
if (!response.ok) {$('title').textContent = 'generated/watch/astra.json is missing'; throw new Error('no collection');}
const songs = (await response.json()).passages, state = s => saved.get(s.id) ?? {answers: {}, note: ''}, mark = s => state(s).answers.mark;
let at = Math.max(0, songs.findIndex(s => s.id === location.hash.slice(1))), version = 0;

const rows = songs.map((s, i) => el('button', {onclick: () => show(i)}, el('span'), s.label, el('small')));
$('index').append(...rows);
const buttons = MARKS.map(([id, label, about], i) => el('button', {className: 'option', onclick: () => set(id)}, el('b', {textContent: `${i + 1} \u00b7 ${label}`}), el('span', {textContent: about})));
$('marks').append(...buttons);
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function progress() {
  const done = songs.filter(mark).length;
  $('progress').max = songs.length; $('progress').value = done; $('count').textContent = `${done} of ${songs.length} songs marked`; $('next').disabled = done === songs.length;
  songs.forEach((s, i) => {
    const [dot, , small] = rows[i].childNodes, m = mark(s);
    dot.className = `dot${m === 'take' ? ' done' : m === 'changes' ? ' rework' : m ? ' out' : ''}`;
    small.textContent = [s.videos.some(v => v.id === 'revised') ? 'revised' : '', state(s).note ? 'note' : ''].filter(Boolean).join(' \u00b7 ');
    rows[i].classList.toggle('on', i === at);
  });
  buttons.forEach((b, i) => b.classList.toggle('on', MARKS[i][0] === mark(songs[at])));
}
// versions switch at the same moment of the song, playing or paused
function use(k) {
  const video = $('video'), s = songs[at], time = video.currentTime, playing = !video.paused && !video.ended;
  version = k; video.src = s.videos[k].src;
  video.addEventListener('loadedmetadata', () => {video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05)); if (playing) void video.play();}, {once: true});
  [...$('versions').children].forEach((b, i) => b.classList.toggle('on', i === k));
}
function show(i) {
  at = i; const s = songs[i];
  history.replaceState(null, '', `#${s.id}`);
  $('title').textContent = s.label; $('note').value = state(s).note; $('status').textContent = '';
  $('versions').replaceChildren(...s.videos.map((v, k) => el('button', {className: 'pill', textContent: v.label, onclick: () => use(k)})));
  $('video').currentTime = 0; use(0); $('video').pause();
  $('facts').textContent = s.description;
  $('links').replaceChildren(
    el('a', {href: `/spec-dashboard/?spec=productions/${s.id}/spec.ts`, target: '_blank', textContent: 'The current spec against the music \u2197'}));
  rows[i].scrollIntoView({block: 'nearest'}); progress();
}
async function keep(what) {
  const s = songs[at], answers = state(s).answers; saved.set(s.id, {answers, note: $('note').value});
  report($('status'), await saveAnswer(s.id, answers, $('note').value, STUDY), what); progress();
}
async function set(id) {saved.set(songs[at].id, {answers: {mark: id}, note: $('note').value}); await keep(MARKS.find(m => m[0] === id)[1]);}
$('note').onchange = () => keep('your note');
// the video's time and the version shown, on a new line of the note, ready to type after
function stamp() {
  const note = $('note'), s = songs[at], line = `${clock($('video').currentTime)} (${s.videos[version].label}): `;
  note.value = note.value + (note.value && !note.value.endsWith('\n') ? '\n' : '') + line; note.focus(); note.setSelectionRange(note.value.length, note.value.length);
}
$('stamp').onclick = stamp;
const nextOpen = () => {for (let k = 1; k <= songs.length; k++) {const i = (at + k) % songs.length; if (!mark(songs[i])) return show(i);}};
$('next').onclick = nextOpen;
addEventListener('keydown', e => {
  const video = $('video');
  if (e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault(); e.target.blur();}
    else if (e.altKey && e.key.toLowerCase() === 't') {e.preventDefault(); stamp();}
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key >= '1' && e.key <= '3') set(MARKS[+e.key - 1][0]);
  else if (e.key.toLowerCase() === 'v') use((version + 1) % songs[at].videos.length);
  else if (e.key.toLowerCase() === 't') stamp();
  else if (e.key === 'ArrowDown') show(Math.min(songs.length - 1, at + 1));
  else if (e.key === 'ArrowUp') show(Math.max(0, at - 1));
  else if (e.key.toLowerCase() === 'n') nextOpen();
  else if (e.key === ' ') video.paused ? video.play() : video.pause();
  else return;
  e.preventDefault();
});
show(at);
