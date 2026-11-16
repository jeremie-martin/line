// The decisions board: one card per open decision of decisions.json. A card says the question, what holds today, what Claude
// would do (marked as such), where to look (links, or versions of a video in one player), and takes one answer and a note.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const {decisions} = await (await fetch('./decisions.json', {cache: 'no-store'})).json(), saved = await loadAnswers();
const $ = id => document.getElementById(id), state = id => saved.get(id) ?? {answers: {}, note: ''};
const chosen = d => d.options.find(o => o.id === state(d.id).answers.choice);

function progress() {
  const done = decisions.filter(chosen).length;
  $('progress').max = decisions.length; $('progress').value = done; $('count').textContent = `${done} of ${decisions.length} decided`;
  for (const d of decisions) {
    const pick = chosen(d);
    $(`dot-${d.id}`).className = `dot${pick ? ' done' : ''}`; $(`pick-${d.id}`).textContent = pick?.label ?? '';
    Object.assign($(`chip-${d.id}`), {textContent: pick ? `Decided: ${pick.label}` : 'Open', className: `chip${pick ? ' done' : ''}`});
  }
}

// versions of one video in one player: switching keeps the moment and whether it plays
function player(versions) {
  const video = el('video', {controls: true, preload: 'metadata', playsInline: true, src: versions[0].src, className: versions[0].wide ? 'wide' : ''});
  const tabs = versions.map((v, i) => el('button', {className: `pill${i ? '' : ' on'}`, textContent: v.label, onclick: () => {
    const t = video.currentTime, playing = !video.paused;
    tabs.forEach((b, j) => b.classList.toggle('on', j === i));
    video.src = v.src; video.className = v.wide ? 'wide' : '';
    video.addEventListener('loadedmetadata', () => {video.currentTime = t; if (playing) video.play();}, {once: true});
  }}));
  return el('div', {className: 'watch'}, video, el('div', {className: 'tabs'}, ...(versions.length > 1 ? tabs : [])));
}

function card(d) {
  const status = el('div', {className: 'saved'}), note = el('textarea', {placeholder: 'A note, if you want (saved when you leave the field)', value: state(d.id).note});
  const save = async what => {report(status, await saveAnswer(d.id, state(d.id).answers, note.value), what); progress();};
  const options = d.options.map(o => el('button', {className: `option${chosen(d) === o ? ' on' : ''}`, onclick: () => {
    saved.set(d.id, {answers: {choice: o.id}, note: note.value});
    options.forEach((b, i) => b.classList.toggle('on', d.options[i] === o)); save(o.label);
  }}, el('b', {textContent: o.label}), o.about ? el('span', {textContent: o.about}) : null));
  note.onchange = () => {saved.set(d.id, {answers: state(d.id).answers, note: note.value}); save('your note');};
  return el('section', {className: 'card', id: d.id},
    el('h2', {}, d.title, el('span', {id: `chip-${d.id}`})),
    el('p', {textContent: d.question}),
    el('p', {className: 'today', textContent: `Until you answer: ${d.today}`}),
    d.mine ? el('p', {className: 'mine'}, el('b', {textContent: 'What Claude would do: '}), d.mine) : null,
    d.versions ? player(d.versions) : null,
    d.look ? el('div', {className: 'look'}, ...d.look.map(l => el('a', {href: l.href, target: '_blank', textContent: `${l.label} ↗`}))) : null,
    d.details ? el('details', {}, el('summary', {textContent: d.details.title}), el('ul', {}, ...d.details.items.map(t => el('li', {textContent: t})))) : null,
    el('div', {className: 'options'}, ...options), note, status);
}

$('cards').append(...decisions.map(card));
$('index').append(...decisions.map(d => el('button', {onclick: () => $(d.id).scrollIntoView({behavior: 'smooth'})},
  el('span', {id: `dot-${d.id}`}), d.short ?? d.title, el('small', {id: `pick-${d.id}`}))));
progress();
if (location.hash) $(location.hash.slice(1))?.scrollIntoView();
