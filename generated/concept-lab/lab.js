// The concept lab: the owner's questions, the themes and a free mix, played live with the music. It draws through the video
// renderer (scripts/video/picture.js) from the same scenes as the finished videos (scripts/video/scene.ts, prepare.mjs), so what
// is approved here is exactly what ships. The lab owns only the questions, the transport and the blind intensity test.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {OPTIONS, V1, resolveLook} from '/scripts/video/look.js';
import {SCHEMES, DROP_SCHEMES} from '/scripts/video/palettes.js';
import {PRESETS} from './presets.js';
import {SONGS, rideSet} from './rides.js';

const noEnds = {...V1, ends: 'none'};
// Each option: [label, look, note shown when tapped, ride set (rides.js) when not the question's].
// A frozen set of questions, used only by uicheck.mjs (?qtest=1): the interaction suite tests the machinery (multi picks, a label
// with a comma, moment overrides, old rides) without depending on whatever the current round asks.
const TEST_QUESTIONS = [
  {id: 'band', ask: 'The band, compared fairly', why: 'Varies: only the band.', song: 'tomada', t: 36.5, len: 5, multi: true, opts: [
      ['Bars', {...noEnds, band: 'bars'}, 'Bars, the loudest in the accent.'],
      ['Fork', {...noEnds, band: 'fork'}, 'The tuning fork.'],
      ['Iris', {...noEnds, band: 'iris'}, 'Iris.'],
      ['None', {...noEnds, band: 'none'}, 'No band, for reference.']],
    moments: [['Tomada 37 s', 36.5], ['Petrunko 34 s', 33.8, 'petrunko'], ['Los Voltaje 48 s', 47.8, 'los'], ['Batidão 15 s', 14.5, 'batidao']]},
  {id: 'top', ask: 'What at the top of the frame?', why: 'Varies: only the top of the frame.', song: 'petrunko', t: 33.6, len: 5, multi: true, opts: [
      ['Nothing', {...noEnds, band: 'bars', top: 'none'}, 'Nothing.'],
      ['A sun, a little higher', {...noEnds, band: 'bars', top: 'sun', sunLift: '19.2'}, 'The sun, a few pixels higher.'],
      ['The title', {...noEnds, band: 'bars', top: 'title'}, 'The song’s name.']],
    moments: [['Petrunko 34 s', 33.6], ['Tomada 37 s', 36.5, 'tomada'], ['On Dune', 33.6, 'petrunko', {scheme: 'dune'}], ['On Café (dark)', 33.6, 'petrunko', {scheme: 'cafe'}], ['On Hokusai', 33.6, 'petrunko', {scheme: 'hokusai'}]]},
  {id: 'line', ask: 'The line', why: 'Varies: only how the line appears.', song: 'tomada', t: 36.5, len: 5, multi: true, opts: [
      ['Pencil → ink', {...noEnds, band: 'bars', line: 'inking'}, 'Inks as the rider passes.'],
      ['Whole rail', {...noEnds, band: 'bars', line: 'rail'}, 'A rail lights whole when the rider meets it.'],
      ['All ink', {...noEnds, band: 'bars', line: 'ink'}, 'Inked from the start.']],
    moments: [['Tomada 37 s', 36.5], ['Petrunko 34 s', 33.8, 'petrunko'], ['Los Voltaje 48 s', 47.8, 'los'], ['Los Voltaje 10 s, round 5', 10, 'los', null, 'old']]},
  ...[['bgKraft', 'Kraft: which paper?', 'kraft'], ['bgCyan', 'Cyanotype: which paper?', 'cyanotype'], ['bgRothko', 'Rothko: which paper?', 'rothko']].map(([id, ask, s]) => (
    {id, ask, why: 'Varies: only the paper.', song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['As designed', {...noEnds, band: 'bars', scheme: s}, 'The original paper.'],
      ...[0, 1, 2].map(i => [`Variant ${i + 1}`, {...noEnds, band: 'bars', scheme: `${s}~${i}`}, 'Only the paper changes.'])],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 45 s', 45, 'los'], ['Petrunko 28 s', 28, 'petrunko']]})),
  {id: 'rides', ask: 'An option on another ride set', why: 'Varies: only the ride.', song: 'lua', t: 36.5, len: 5, opts: [
      ['Today’s ride', {...noEnds, band: 'bars'}, 'The lab’s ride.'],
      ['The round-5 ride', {...noEnds, band: 'bars'}, 'The round 1–5 ride of the same song.', 'old']],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 10 s, round 5', 10, 'los', null, 'old']]},
];

// A round of theme candidates (candidates.json): their schemes join the palettes in this page's memory only, so versions not yet in
// the code can be compared live. Round 29: two improvements from round 28, its four unanswered drafts, twenty new ones (references,
// a generator, colour tools: docs/COLOUR-TOOLS.md) and the tools' raw output, each in its visibly different versions; a grade per version.
const CANDIDATES = await fetch('./candidates.json').then(r => r.ok ? r.json() : null).catch(() => null);
if (CANDIDATES) {Object.assign(SCHEMES, CANDIDATES.schemes); Object.assign(DROP_SCHEMES, CANDIDATES.drops);}
const DRAFT_MOMENTS = [['Verse, 18 s', 18], ['Into the drop, 36.5 s', 36.5], ['Inside the drop, 44.6 s', 44.6], ['Later, 59.5 s', 59.5]];
const QUESTIONS = (CANDIDATES?.drafts ?? []).map(d => ({id: d.id, ask: d.name, grades: true, multi: true,
  why: `${d.source}. ${d.line} Each version: ${d.variants.map((v, i) => `${String.fromCharCode(65 + i)} ${v.label}`).join(', ')}. Grade any version out of 10; keep any number.`,
  song: 'circus', t: 18, len: 6, opts: d.variants.map(v => [v.label, {...v.look, ends: 'none'}, v.note]), moments: DRAFT_MOMENTS}));
// then the five small choices from the theme reviews (the alternatives are exact copies in palettes.js, deleted once answered)
const fix = (id, choices = {}) => ({...resolveLook(id), ends: 'none', ...choices});
const DROP_FIX_MOMENTS = [['Into the drop, 36.5 s', 36.5], ['Inside the drop, 44.6 s', 44.6], ['Petrunko, into the drop', 21, 'petrunko'], ['Verse, 18 s', 18]];
if (CANDIDATES) QUESTIONS.push(
  {id: 'auberginedrop', ask: 'Aubergine’s drop', grades: true, why: 'At the drop Aubergine hands over to a dark partner and carries its carmine accent onto it; today the partner’s bars are carmine too, so the loudest bars vanish for the whole drop. Varies: only the partner’s bars.',
    song: 'circus', t: 36.5, len: 6, opts: [['As now', fix('aubergine'), 'Carmine bars.'], ['Lavender bars', fix('aubergine', {scheme: 'w2AubergineToLavender'}), 'Wada 307’s own lavender.'], ['Aconite bars', fix('aubergine', {scheme: 'w2AubergineToAconite'}), 'Dark aconite, quieter.']], moments: DROP_FIX_MOMENTS},
  {id: 'dunedrop', ask: 'Dune’s drop', grades: true, why: 'Dune cuts to coffee at the drop, carrying its amber accent; on Espresso’s latte bars the amber is weak, Café was built for it. Varies: only the partner.',
    song: 'circus', t: 36.5, len: 6, opts: [['Espresso, as now', fix('dune'), 'Latte bars.'], ['Café', fix('dune', {scheme: 'duneToCafe'}), 'Darker latte bars.']], moments: DROP_FIX_MOMENTS},
  {id: 'seashelldrop', ask: 'Seashell at the drop', grades: true, why: 'Seashell Night goes to navy Night at the drop; the art director would keep its shell and blue through the drop. Varies: only the drop.',
    song: 'circus', t: 36.5, len: 6, opts: [['Night, as now', fix('seashell'), 'Navy Night.'], ['No Night', fix('seashell', {drop: 'off'}), 'Shell and blue throughout.']], moments: DROP_FIX_MOMENTS},
  {id: 'iris', ask: 'Black Iris’s strands', grades: true, why: 'On a phone the Iris band is the faintest of the set, on the theme whose idea it is. Bolder strands? Varies: only the strands’ weight.',
    song: 'circus', t: 18, len: 6, opts: [['Thin, as now', fix('black'), 'Main line 3.8 px.'], ['Bold', fix('black', {irisWeight: 'bold'}), 'Main line 7 px, echoes 4.5 px.']], moments: [['Verse, 18 s', 18], ['Later, 59.5 s', 59.5], ['Lavender Dusk (Iris on light)', 18, 'circus', {scheme: 'lavender', top: 'sun'}]]},
  {id: 'ultramarine', ask: 'Ultramarine’s bars', grades: true, why: 'Its bars are the faintest against their paper in the set (3.4:1); the same blue, brighter (4.4:1)? Varies: only the bars’ colour.',
    song: 'circus', t: 18, len: 6, opts: [['As now', fix('ultramarine'), 'Bars #006eb8.'], ['Brighter', fix('ultramarine', {scheme: 'wUltramarineBright'}), 'Bars #2380cc.']], moments: [['Verse, 18 s', 18], ['Later, 59.5 s', 59.5], ['Petrunko 34 s', 33.5, 'petrunko']]},
);
if (new URLSearchParams(location.search).has('qtest')) QUESTIONS.splice(0, QUESTIONS.length, ...TEST_QUESTIONS);
// every option is a complete look, checked once: a typo in a question fails on load, not silently on screen
for (const Q of QUESTIONS) for (const o of Q.opts) o[1] = resolveLook(null, o[1]);

// ── state ──────────────────────────────────────────────────────────────────
const q = new URLSearchParams(location.search);
const shot = q.has('shot');
const $ = id => document.getElementById(id);
const music = createMusic(), onScreen = displayTime();
let song = Object.hasOwn(SONGS, q.get('song') ?? '') ? q.get('song') : 'petrunko';
let preset = PRESETS.find(p => p.id === q.get('c')) ?? PRESETS[0];
let mix = {...preset.mix};
// the address's options are checked by the writers' own rule (resolveLook); one it cannot set is ignored, and a shot reports it,
// so a fingerprint or a still never captures another look than the one it names
for (const kv of (q.get('m') ?? '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':');
  try {mix = resolveLook(null, {...mix, [k]: v});} catch (e) {if (shot) window.__loadError = e.message;}
}
let seconds = +(q.get('t') ?? 0) || 0, playing = false, P = null, loadId = 0;
const qmode = q.has('q'), feelmode = q.has('feel');
let qi = Math.max(0, Math.min(QUESTIONS.length, (parseInt(q.get('q'), 10) || 1) - 1)), qopt = 0; // ?q=abc or ?q=1.5 must not give NaN
// Every question/moment navigation takes a ticket; an async step that resumes after a newer navigation drops its stale state
// instead of applying it (a slow song load used to finish after the viewer had moved on and overwrite the newer choice).
let navId = 0, qmoment = null, loopHome = null;
// the viewing aid (index.html #exag): multiplies every hit effect alike; never part of a look or an answer, back to ×1 on each question
let exaggerate = 1;
function setExaggerate(x) {exaggerate = x; $('exagx').value = String(x); $('exagval').textContent = `×${x}`; draw();}
const STORE = q.has('qtest') ? 'concept-lab-answers-test' : 'concept-lab-answers-r29';
const answers = (() => {try {return JSON.parse(localStorage.getItem(STORE) ?? '{}');} catch {return {};}})();
const saveAnswers = () => {try {localStorage.setItem(STORE, JSON.stringify(answers));} catch {}};
const sheetPromise = N.loadSheet();
const canvas = $('stage');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── loading ────────────────────────────────────────────────────────────────
// A song's scene and native replay are kept; its picture is made when the song is shown (its offscreen canvases are large).
const cache = new Map();
// The ride set on screen (rides.js; '' the lab's rides): ?rides=NAME in the free lab; in a question, the moment's set, else the
// option's, else the question's. The cache keeps every set it has loaded.
let rides = q.get('rides') ?? '', loadedRides = null, momentRides = null, loadedAudio = null;
// a moment can carry an override (for example 'On Dune'); it stays while the viewer switches options, until another moment
let momentExtra = null, momentLabel = '';
async function loadSong(key) {
  // another ride set of the song on screen (the same ride timed differently): the current picture keeps drawing, and the music
  // playing, until the other is ready, so options can be switched mid-play
  const id = ++loadId, set = rides, switching = key === song && !!P;
  song = key; loadedRides = set; if (!switching) P = null;
  // returns false when a newer load superseded this one, or when it failed, so callers stop instead of applying their state
  try {
    const {dir, label} = rideSet(set), ck = key + ':' + set;
    if (!switching) status('Loading ' + SONGS[key].name + (label ? ` (${label})` : '') + '…');
    let entry = cache.get(ck);
    if (!entry) {
      const res = await fetch(`./${dir}/${key}.json`);
      if (!res.ok) throw new Error(`no ${label ? label + ' ' : ''}ride data (HTTP ${res.status})`);
      const scene = await res.json();
      entry = {scene, replay: N.replay(scene.track, scene.trace)}; cache.set(ck, entry);
      entry.replay.catch(() => cache.delete(ck)); // a failed replay is retried on the next tap
    }
    if (id !== loadId) return false; // a newer load began meanwhile: this song's music must not replace the newer song's
    // the recording already loaded keeps playing; another is decoded (a failed decode leaves the ride to scrub, silent)
    const audio = '/' + entry.scene.audio;
    let decoding = null;
    if (!shot && audio !== loadedAudio) {loadedAudio = null; decoding = music.load(audio).then(ok => {if (ok) loadedAudio = audio;}).catch(() => null);}
    const [replay, sheet] = await Promise.all([entry.replay, sheetPromise, decoding]);
    if (id !== loadId) return false;
    P = {...createPicture(canvas, entry.scene, replay, sheet, N.riderPainter()), key, rides: set, scene: entry.scene};
  } catch (e) {
    // a failed load leaves no ride and says why; the next tap retries (P is null)
    if (id === loadId) {P = null; status(`Could not load ${SONGS[key].name}: ${e.message}`); if (shot) window.__loadError = e.message;}
    return false;
  }
  $('seek').max = P.span[1]; seconds = Math.min(seconds, P.span[1]);
  status(''); renderUI(); draw();
  if (shot) {window.__ready = true; window.__duration = P.span[1]; window.__audio = '/' + P.scene.audio;
    window.__renderAt = t => {seconds = t; draw(); return canvas.toDataURL('image/png');};}
  return true;
}
// a look the ride cannot be drawn in (effects on the beat without recorded beats) says so instead of drawing something else
function draw() {if (P && canvas.width && canvas.height) try {P.draw(seconds, mix, exaggerate);} catch (e) {status(e.message); if (shot) {window.__loadError = e.message; throw e;}}}
function moments() {
  // the quietest and the densest section (hits per second), the middle section change, the strongest hit, the ends
  const hits = P.hitTimes, sect = P.scene.phases.filter(s => s.t1 - s.t0 > 2).map(s => ({...s, density: hits.filter(h => h.t >= s.t0 && h.t < s.t1).length / Math.max(0.5, s.t1 - s.t0)}));
  const out = [['Opening', 0]];
  if (sect.length) {
    const quiet = sect.reduce((a, b) => b.density < a.density ? b : a), dense = sect.reduce((a, b) => b.density > a.density ? b : a);
    out.push(['Quiet · ' + quiet.name.toLowerCase(), quiet.t0 + 0.3], ['Dense · ' + dense.name.toLowerCase(), dense.t0 + 0.3]);
  }
  const change = P.scene.phases[Math.min(P.scene.phases.length - 1, Math.floor(P.scene.phases.length / 2))];
  if (change.t0 > 0) out.push(['Section change', Math.max(0, change.t0 - 1.5)]);
  if (P.scene.drop) out.push(['The drop', Math.max(0, P.scene.drop[0] - 1.5)]);
  if (hits.length) {const big = hits.reduce((a, b) => b.s > a.s ? b : a); out.push(['Strongest hit', Math.max(0, big.t - 1.2)]);}
  return [...out, ['Ending', Math.max(0, P.span[1] - 4)]];
}

// ── transport and UI ───────────────────────────────────────────────────────
let loop = null, loopLen = 4;
function status(text) {const s = $('status'); if (s) s.textContent = text;}
function fmt(t) {return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;}
function sync() {
  $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(P?.span[1] ?? 0);
  if (feelmode) return; // the blind test's address must not carry (or leak) the free lab's look
  const url = new URL(location.href);
  if (qmode) {
    // the option and moment ride in the address too, so a reload mid-question comes back to exactly what was on screen
    url.searchParams.set('q', String(qi + 1));
    qi < QUESTIONS.length && qopt ? url.searchParams.set('opt', LETTERS[qopt]) : url.searchParams.delete('opt');
    qi < QUESTIONS.length && qmoment !== null ? url.searchParams.set('mo', String(qmoment + 1)) : url.searchParams.delete('mo');
    history.replaceState(null, '', url); return;
  }
  url.searchParams.set('song', song); url.searchParams.set('c', preset.id); url.searchParams.set('t', seconds.toFixed(2));
  const diff = Object.keys(mix).filter(d => mix[d] !== preset.mix[d]).map(d => d + ':' + mix[d]);
  diff.length ? url.searchParams.set('m', diff.join(',')) : url.searchParams.delete('m');
  history.replaceState(null, '', url);
}
// A play waits for the audio context to resume (long on a phone's first tap); a newer play or a pause supersedes it, and a superseded
// play must not touch the state afterwards.
let playTicket = 0;
async function play() {
  if (!P) return; if (seconds >= P.span[1] - 0.05) seconds = 0;
  const n = ++playTicket;
  $('play').textContent = 'Pause'; $('play').classList.add('on');
  try {await music.play(seconds, 1); if (n !== playTicket) return; playing = music.playing;} catch {if (n !== playTicket) return; playing = false;}
  if (!playing) {$('play').textContent = 'Play'; $('play').classList.remove('on');}
}
function pause() {playTicket++; if (playing) seconds = music.pause(); else music.pause(); playing = false; $('play').textContent = 'Play'; $('play').classList.remove('on'); sync();}
function seek(t) {const resume = playing || music.requested; if (resume) pause(); seconds = clamp(t, 0, P?.span[1] ?? 0); draw(); sync(); if (resume) play();}
function qStart(question) {
  if (typeof question.t === 'number') return question.t;
  if (question.t === 'strongest') {const big = P.hitTimes.reduce((a, b) => b.s > a.s ? b : a); return Math.max(0, big.t - 1.6);}
  return 0;
}
// What is drawn in question mode is ALWAYS the chosen option plus the chosen moment's override, built in this one place.
function applyOption() {const Q = QUESTIONS[qi]; if (Q?.opts) mix = resolveLook(null, {...Q.opts[qopt][1], ...(momentExtra ?? {})});}
function questionRides() {const Q = QUESTIONS[qi]; return momentRides ?? Q.opts[qopt][3] ?? Q.rides ?? '';}
// an option on another ride set switches to it at the same time, playing on
function setOption(i) {qopt = i; applyOption(); renderQuestion(); draw(); rides = questionRides(); if (rides !== loadedRides) loadSong(song);}
async function goQuestion(i, restore = null) {
  const nav = ++navId;
  pause(); qi = i; qopt = 0; momentExtra = null; momentRides = null; momentLabel = ''; qmoment = null; scrollTo(0, 0); setExaggerate(1);
  $('qcopy').textContent = 'Copy answers';
  if (qi >= QUESTIONS.length) {renderQuestion(); return;}
  const Q = QUESTIONS[qi];
  if (restore && restore.opt > 0 && restore.opt < Q.opts.length) qopt = restore.opt;
  applyOption(); rides = questionRides();
  renderQuestion();
  // !P: `song` names the song being loaded before its ride is ready, so a second tap during a load must load again
  if ((song !== Q.song || rides !== loadedRides || !P) && !await loadSong(Q.song)) return;
  if (nav !== navId) return; // the viewer moved on while this question's song loaded
  loop = loopHome = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); $('loop').textContent = `Loop ${loopLen} s`; seek(loop); renderQuestion(); draw();
  if (restore && Q.moments?.[restore.mo]) await goMoment(restore.mo);
}
async function goMoment(j) {
  const Q = QUESTIONS[qi], [label, at, sg, extra, set] = Q.moments[j], nav = ++navId;
  const was = playing; pause(); momentExtra = extra ?? null; momentRides = set ?? null; qmoment = j;
  momentLabel = extra || set ? label : '';
  applyOption(); rides = questionRides(); renderQuestion();
  if (((sg ?? Q.song) !== song || rides !== loadedRides || !P) && !await loadSong(sg ?? Q.song)) return;
  if (nav !== navId) return;
  loop = loopHome = at === 'end' ? Math.max(0, P.span[1] - (Q.len ?? 4)) : qStart({t: at}); loopLen = Q.len ?? 4;
  $('loop').classList.add('on'); seek(loop); renderQuestion(); draw(); if (was) play();
}
// An answer: the picked option labels (a list, so a label may contain a comma), a separate 'none' flag and a note. Each round
// keeps its answers in its own store.
function answerOf(Q) {
  const a = answers[Q.id] ??= {picks: [], none: false, note: ''}, labels = Q.opts.map(o => o[0]);
  a.picks = labels.filter(l => a.picks.includes(l)); // current labels only, in option order
  return a;
}
function pickText(Q, a) {
  if (a.none) return 'None of these';
  return a.picks.map(l => `${LETTERS[Q.opts.findIndex(o => o[0] === l)]} · ${l}`).join(' + ');
}
const LETTERS = 'ABCDEFGHIJKLMNOP';
function renderQuestion() {
  document.body.classList.add('qmode');
  const done = qi >= QUESTIONS.length, Q = QUESTIONS[qi];
  $('moments').replaceChildren(...(!done && Q.moments ? Q.moments.map(([label], j) => chip(label, j === qmoment, () => goMoment(j), 'moment')) : []));
  $('optflag').hidden = done || !!Q?.open;
  if (!done && !Q.open) $('optflag').textContent = `${LETTERS[qopt]} · ${Q.opts[qopt][0]}${momentLabel ? ' · ' + momentLabel : ''}`;
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[song].name}`;
  $('concept').textContent = done ? 'Thank you.' : Q.ask;
  $('line').textContent = done ? 'Copy your answers and paste them to me in the chat. They are also kept in this browser.' : Q.why;
  // The chosen option's note sits in a block of FIXED height (the longest note of this question), so the answer buttons below never
  // move when the viewer switches options; a 1- vs 2-line note used to shift them and taps landed on the neighbour.
  if (!done && !Q.open) {
    const b = document.createElement('b'); b.textContent = Q.opts[qopt][2] ? LETTERS[qopt] + ': ' + Q.opts[qopt][2] : ''; b.style.cssText = 'display:block;font-weight:500;color:var(--ink);margin-top:6px';
    const probe = document.createElement('b'); probe.style.cssText = b.style.cssText + ';visibility:hidden;position:absolute;left:0;right:0'; $('line').append(b, probe);
    let h = 0; for (const [i, o] of Q.opts.entries()) {probe.textContent = LETTERS[i] + ': ' + (o[2] ?? ''); probe.style.width = b.offsetWidth + 'px'; h = Math.max(h, probe.offsetHeight);}
    probe.remove(); b.style.minHeight = h + 'px';
  }
  $('presets').replaceChildren(...(done ? [] : Q.opts.map(([label], i) => chip(`${LETTERS[i]} · ${label}`, i === qopt, () => setOption(i)))));
  const a = done ? null : answerOf(Q);
  $('presets').hidden = !done && !!Q.open; document.querySelector('.qrow').hidden = !done && !!Q.open;
  const toggle = label => {
    if (Q.multi) {const s = new Set(a.picks); s.has(label) ? s.delete(label) : s.add(label); a.picks = Q.opts.map(o => o[0]).filter(l => s.has(l));}
    else a.picks = [label];
    a.none = false; saveAnswers(); renderQuestion();
  };
  // 'None of these' is its own flag, never a label: an option may itself be called 'None'
  const none = () => {a.none = !a.none; a.picks = []; saveAnswers(); renderQuestion();};
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip(LETTERS[i], !a.none && a.picks.includes(label), () => toggle(label), 'opt')),
    chip('None of these', a.none, none, 'opt')]));
  // an optional grade out of 10 for the version on screen
  $('qgraderow').hidden = done || !Q.grades;
  if (!done && Q.grades) {
    const label = Q.opts[qopt][0], grades = a.grades ??= {};
    $('qgradelabel').textContent = `Grade ${LETTERS[qopt]}`;
    $('qgrade').replaceChildren(...Array.from({length: 10}, (_, g) => chip(String(g + 1), grades[label] === g + 1, () => {grades[label] === g + 1 ? delete grades[label] : grades[label] = g + 1; saveAnswers(); renderQuestion();}, 'opt')));
  }
  $('qnote').rows = Q?.open ? 7 : 2; $('qpicklabel').textContent = Q?.multi ? 'Keep (any number)' : 'My pick';
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  // the summary names each pick by letter AND label, and 'None of these' in words, so 'D · None' and 'None of these' never read alike
  const gradeText = (Q, a) => Q.grades && a.grades && Object.keys(a.grades).length ? ` · grades ${Q.opts.map(([l], i) => a.grades[l] ? `${LETTERS[i]} ${a.grades[l]}` : null).filter(Boolean).join(', ')}` : '';
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answerOf(Q); return Q.open ? `${i + 1}. ${Q.ask}: ${a.note || '(skipped)'}` : `${i + 1}. ${Q.ask} → ${pickText(Q, a) || '(skipped)'}${gradeText(Q, a)}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
  $('qcopy').hidden = !done;
  sync();
}
function choosePreset(p) {preset = p; mix = {...p.mix}; renderUI(); draw(); sync();}
function chip(label, on, click, cls = 'chip') {const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = click; return b;}
function renderUI() {
  if (shot || feelmode) return;
  if (qmode) return renderQuestion();
  // during a load there is no ride to find moments in
  $('moments').replaceChildren(...(P ? moments() : []).map(([label, at]) => chip(label, false, () => {if (loop !== null) loop = at; seek(at);}, 'moment')));
  const songs = $('songs'); songs.replaceChildren(...Object.entries(SONGS).map(([k, {name}]) => chip(name, k === song, () => {if (k !== song || !P) {pause(); loadSong(k);}}, 'song')));
  const pres = $('presets'); pres.replaceChildren(...PRESETS.map((p, i) => chip(`${i + 1} · ${p.name}`, p === preset, () => choosePreset(p))));
  const custom = Object.keys(mix).some(d => mix[d] !== preset.mix[d]);
  $('concept').textContent = preset.name + (custom ? ' · adjusted' : ''); $('line').textContent = preset.line;
  $('mix').replaceChildren(...Object.entries(OPTIONS).map(([d, [label, opts]]) => {
    const row = document.createElement('div'); row.className = 'row';
    const name = document.createElement('span'); name.textContent = label;
    const seg = document.createElement('div'); seg.className = 'seg';
    seg.append(...Object.entries(opts).map(([v, l]) => chip(l, mix[d] === v, () => {mix[d] = v; renderUI(); draw(); sync();}, 'opt')));
    row.append(name, seg); return row;
  }));
  sync();
}
function fit() {
  const r = shot ? 1 : Math.min(2, devicePixelRatio || 1), box = canvas.getBoundingClientRect();
  const w = shot ? 1080 : Math.round(box.width * r), h = shot ? 1920 : Math.round(box.height * r);
  if (canvas.width !== w || canvas.height !== h) {canvas.width = w; canvas.height = h; draw();}
}
// a loop that would run past the song's end wraps at the end (it used to stop there, and the next Play started from 0:00)
const loopEnd = () => Math.min(loop + loopLen, P.span[1]);
function tick(ts) {
  if (playing && P) {seconds = music.position(onScreen(ts)); if (loop !== null && seconds >= loopEnd()) {seek(loop); requestAnimationFrame(tick); return;} if (seconds >= P.span[1]) {pause(); seconds = P.span[1];} draw(); $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(P.span[1]);}
  requestAnimationFrame(tick);
}
function cycleOption(dir) {const o = QUESTIONS[qi]?.opts; if (o) setOption((qopt + dir + o.length) % o.length);}
if (shot) document.body.classList.add('shot');
else {
  // one toggle for the button, Space and a tap on the picture; a play still waiting for the audio context counts as playing
  const togglePlay = () => {playing || music.requested ? pause() : play();};
  $('play').onclick = togglePlay;
  $('seek').oninput = () => seek(+$('seek').value);
  $('exagx').oninput = () => setExaggerate(+$('exagx').value);
  $('back').onclick = () => seek(seconds - 5); $('fwd').onclick = () => seek(seconds + 5);
  addEventListener('keydown', e => {
    if (e.target.closest?.('input,textarea')) return;
    if (feelmode) return; // the blind test is driven by its own buttons
    const i = PRESETS.indexOf(preset);
    if (e.code === 'Space') {e.preventDefault(); togglePlay();}
    else if (e.key === 'ArrowRight' && e.shiftKey) seek(seconds + 2);
    else if (e.key === 'ArrowLeft' && e.shiftKey) seek(seconds - 2);
    else if (qmode && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && qi < QUESTIONS.length) cycleOption(e.key === 'ArrowRight' ? 1 : -1);
    else if (!qmode && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {e.preventDefault(); choosePreset(PRESETS[(i + 1) % PRESETS.length]);}
    else if (!qmode && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {e.preventDefault(); choosePreset(PRESETS[(i + PRESETS.length - 1) % PRESETS.length]);}
    else if (!qmode && /^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) choosePreset(PRESETS[+e.key - 1]);
    else if (qmode && /^[1-9]$/.test(e.key) && QUESTIONS[qi]?.opts?.[+e.key - 1]) setOption(+e.key - 1);
  });
  $('mixtoggle').onclick = () => document.body.classList.toggle('mixing');
  $('qprev').onclick = () => goQuestion(Math.max(0, qi - 1));
  $('qnext').onclick = () => goQuestion(qi >= QUESTIONS.length ? 0 : qi + 1);
  $('qcopy').onclick = async () => {
    const box = $('qsummary'); let ok = false;
    try {await navigator.clipboard.writeText(box.value); ok = true;} catch {}
    if (!ok) {box.focus(); box.setSelectionRange(0, box.value.length); try {ok = document.execCommand('copy');} catch {}}
    $('qcopy').textContent = ok ? 'Copied ✓' : 'Selected — copy it from the box';
  };
  $('safe').onclick = () => $('safe').classList.toggle('on', document.body.classList.toggle('safe'));
  $('big').onclick = () => {$('big').classList.toggle('on', document.body.classList.toggle('big')); fit();};
  $('loop').onclick = () => {
    // in a question, looping again returns to the moment's own passage and length
    if (qmode && qi < QUESTIONS.length && loop === null && loopHome !== null) {loop = loopHome; loopLen = QUESTIONS[qi].len ?? 4; seek(loop);}
    else {loop = loop === null ? seconds : null; loopLen = 4;}
    $('loop').classList.toggle('on', loop !== null); $('loop').textContent = `Loop ${loopLen} s`;
  };
  let touch = null;
  $('stagewrap').addEventListener('pointerdown', e => {touch = {x: e.clientX, y: e.clientY};});
  $('stagewrap').addEventListener('pointercancel', () => {touch = null;}); // a scroll that began on the picture is not a tap
  $('stagewrap').addEventListener('pointerup', e => {
    if (!touch) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    if (feelmode) return; // a swipe must not load a preset's look into the blind test
    const i = PRESETS.indexOf(preset);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (qmode && qi < QUESTIONS.length) cycleOption(dx < 0 ? 1 : -1);
      else if (!qmode) choosePreset(PRESETS[(i + (dx < 0 ? 1 : PRESETS.length - 1)) % PRESETS.length]);
    }
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) togglePlay();
  });
  addEventListener('resize', fit); new ResizeObserver(fit).observe(canvas);
  requestAnimationFrame(tick);
}
fit();
// ── the blind test: passages in pairs, with nothing on screen to say what is being measured ─────
const FEEL = 'concept-lab-feel-r4', FEEL_LOOK = resolveLook('plain', {line: 'inking'});
async function runFeel() {
  document.body.classList.add('feelmode'); $('feel').hidden = false; mix = {...FEEL_LOOK}; loop = null;
  const pairs = await (await fetch('./intensity/pairs.json')).json();
  const load = k => {try {return JSON.parse(localStorage.getItem(k) ?? '{}');} catch {return {};}}, keep = (k, v) => {try {localStorage.setItem(k, JSON.stringify(v));} catch {}};
  const got = load(FEEL), notes = load(FEEL + '-notes'); let i = pairs.findIndex(p => !got[p.id]); if (i < 0) i = pairs.length; let run = 0;
  const flag = document.createElement('div'); flag.className = 'sideflag'; flag.hidden = true; $('stagewrap').append(flag);
  const pick = [...$('feelpick').children];
  const show = () => {
    const done = i >= pairs.length, id = pairs[i]?.id;
    $('qprogress').textContent = done ? 'All done' : `Pair ${i + 1} of ${pairs.length}`;
    $('concept').textContent = done ? 'Thank you.' : 'Which passage feels more intense?';
    $('line').textContent = done ? 'Copy this and paste it to me with your other answers.' : 'Sound on. Five seconds each. Answer whenever you know, and change your mind freely.';
    $('feelplay').hidden = $('feelpick').hidden = $('feelnote').hidden = done; $('feelsummary').hidden = $('feelcopy').hidden = !done;
    $('feelprev').disabled = i === 0; $('feelnext').hidden = done; $('feelnext').textContent = i === pairs.length - 1 ? 'Finish' : 'Next pair'; $('feelnow').textContent = '';
    pick.forEach(b => b.classList.toggle('on', !done && got[id] === b.dataset.v)); if (!done) $('feelnote').value = notes[id] ?? '';
    if (done) $('feelsummary').value = 'Blind pairs: ' + pairs.map(p => `${p.id}:${got[p.id] ?? '-'}`).join(' ') + pairs.filter(p => notes[p.id]).map(p => `\n${p.id}: ${notes[p.id]}`).join('');
  };
  // pause() even when nothing plays yet: it also cancels a play still waiting for the audio context
  const stop = () => {run++; pause(); flag.hidden = true; $('feelplay').textContent = 'Play A, then B';};
  const clip = async (c, name, me) => {
    if (song !== c.song || !P) await loadSong(c.song); if (me !== run) return;
    if (!P) throw new Error('This passage did not load. Tap again.');
    flag.textContent = name; flag.hidden = false; seconds = c.t; draw();
    await music.play(c.t, 1); if (me !== run) return; // superseded by a newer tap: not a failure to report
    playing = music.playing; if (!playing) throw new Error('Sound did not start. Tap again.');
    await new Promise(res => {const end = c.t + 5, f = () => {if (seconds >= end || !playing || me !== run) {res(); return;} requestAnimationFrame(f);}; f();});
    if (me === run) {pause(); flag.hidden = true;}
  };
  $('feelplay').onclick = async () => {
    stop(); const p = pairs[i], me = run; $('feelplay').textContent = 'Play again';
    try {await clip(p.A, 'A', me); if (me === run) await new Promise(r => setTimeout(r, 450)); if (me === run) await clip(p.B, 'B', me);} catch (e) {$('feelnow').textContent = e.message;}
  };
  pick.forEach(b => {b.onclick = () => {got[pairs[i].id] = b.dataset.v; keep(FEEL, got); show();};});
  $('feelnote').oninput = () => {notes[pairs[i].id] = $('feelnote').value; keep(FEEL + '-notes', notes);};
  $('feelnext').onclick = () => {stop(); i++; show();};
  $('feelprev').onclick = () => {stop(); i = Math.max(0, i - 1); show();};
  $('feelcopy').onclick = async () => {const box = $('feelsummary'); let ok = false; try {await navigator.clipboard.writeText(box.value); ok = true;} catch {} if (!ok) {box.focus(); box.select(); try {ok = document.execCommand('copy');} catch {}} $('feelcopy').textContent = ok ? 'Copied ✓' : 'Selected: copy it from the box';};
  show();
}
if (feelmode) {song = 'los'; mix = {...FEEL_LOOK}; seconds = 4; loadSong(song).then(runFeel).catch(e => status('Could not load: ' + e.message));}
else if (qmode) {
  song = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)].song;
  const restore = {opt: LETTERS.indexOf(q.get('opt') ?? 'A'), mo: (+q.get('mo') || 0) - 1};
  // false: a navigation during this first load superseded it and set up its own question (or the load failed and says so)
  loadSong(song).then(ok => {if (ok) return goQuestion(qi, restore);}).catch(e => status('Could not load: ' + e.message));
}
else loadSong(song).catch(e => status('Could not load: ' + e.message));
// Read-only state for uicheck.mjs: lets the interaction suite assert what is drawn, not just that nothing threw.
window.__labState = () => ({qi, qopt, qmoment, momentExtra, momentLabel, mix: {...mix}, preset: preset.id, song, loaded: P?.key ?? null, rides, loadedRides, drawnRides: P?.rides ?? null, exaggerate,
  loop, loopLen, seconds, playing, scheme: P ? P.schemeAt(seconds, mix) : null});
