// The songs board: one fresh production video per song (generated/lab-rides/closing-songs.json, written by prepare.mjs), and the
// owner's mark on each: in the batches, in after its spec is reworked, or out for now.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const MARKS = [['in', 'In the batches', 'Good as it is.'], ['rework', 'In, after its spec is reworked', 'The song stays; say what is wrong in the note.'], ['out', 'Out for now', 'Not in the batches.']];
const $ = id => document.getElementById(id), saved = await loadAnswers();
const response = await fetch('/generated/lab-rides/closing-songs.json', {cache: 'no-store'});
if (!response.ok) {$('title').textContent = 'No songs yet: run node generated/concept-lab/closing/prepare.mjs'; throw new Error('closing-songs.json is missing');}
const {songs} = await response.json(), state = s => saved.get(s.song) ?? {answers: {}, note: ''}, mark = s => state(s).answers.mark;
let at = Math.max(0, songs.findIndex(s => s.song === location.hash.slice(1)));

const rows = songs.map((s, i) => el('button', {onclick: () => show(i)}, el('span'), s.title, el('small')));
$('index').append(...rows);
const buttons = MARKS.map(([id, label, about], i) => el('button', {className: 'option', onclick: () => set(id)}, el('b', {textContent: `${i + 1} · ${label}`}), el('span', {textContent: about})));
$('marks').append(...buttons);

function progress() {
  const done = songs.filter(mark).length;
  $('progress').max = songs.length; $('progress').value = done; $('count').textContent = `${done} of ${songs.length} songs marked`; $('next').disabled = done === songs.length;
  songs.forEach((s, i) => {
    const [dot, , small] = rows[i].childNodes, m = mark(s);
    dot.className = `dot${m === 'in' ? ' done' : m ? ` ${m}` : ''}`; small.textContent = s.judged ? 'spec judged' : '';
    rows[i].classList.toggle('on', i === at);
  });
  buttons.forEach((b, i) => b.classList.toggle('on', MARKS[i][0] === mark(songs[at])));
}
function show(i) {
  at = i; const s = songs[i], v = s.video;
  history.replaceState(null, '', `#${s.song}`);
  $('title').textContent = s.title; $('note').value = state(s).note; $('status').textContent = '';
  if (v) $('video').src = v.src; else $('video').removeAttribute('src');
  const lanes = s.lanes.map(l => `${l.name}${l.mark ? ` (${l.mark})` : ''}`).join(', ');
  $('facts').replaceChildren(
    el('div', {}, el('b', {textContent: 'Spec: '}), s.judged ?? 'not judged by you yet'),
    el('div', {}, el('b', {textContent: 'This video: '}), v ? `${v.theme}, zoom ${v.zoom ?? 'steady'}, seed ${v.seed}` : 'not made yet'),
    el('div', {className: 'warn', hidden: v?.valid !== false, textContent: 'The ride of this video did not complete.'}),
    el('div', {}, el('b', {textContent: 'Zoom lanes: '}), lanes || 'none'));
  $('links').replaceChildren(
    el('a', {href: `/spec-dashboard/?spec=productions/${s.song}/spec.ts`, target: '_blank', textContent: 'Its spec against the music ↗'}),
    el('a', {href: `../zoom.html#song=${s.song}`, target: '_blank', textContent: 'Its zoom lanes ↗'}));
  rows[i].scrollIntoView({block: 'nearest'}); progress();
}
async function set(id) {
  const s = songs[at]; saved.set(s.song, {answers: {mark: id}, note: $('note').value});
  report($('status'), await saveAnswer(s.song, {mark: id}, $('note').value), MARKS.find(m => m[0] === id)[1]); progress();
}
$('note').onchange = async () => {
  const s = songs[at]; saved.set(s.song, {answers: state(s).answers, note: $('note').value});
  report($('status'), await saveAnswer(s.song, state(s).answers, $('note').value), 'your note');
};
const nextOpen = () => {for (let k = 1; k <= songs.length; k++) {const i = (at + k) % songs.length; if (!mark(songs[i])) return show(i);}};
$('next').onclick = nextOpen;
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
  const video = $('video');
  if (e.key >= '1' && e.key <= '3') set(MARKS[+e.key - 1][0]);
  else if (e.key === 'ArrowDown') show(Math.min(songs.length - 1, at + 1));
  else if (e.key === 'ArrowUp') show(Math.max(0, at - 1));
  else if (e.key.toLowerCase() === 'n') nextOpen();
  else if (e.key === ' ') video.paused ? video.play() : video.pause();
  else return;
  e.preventDefault();
});
show(at);
