// The concept lab: the owner's questions, the themes and a free mix, played live with the music. It draws through the video
// renderer (scripts/video/picture.js) from the same scenes as the finished videos (scripts/video/scene.ts, prepare.mjs), so what
// is approved here is exactly what ships. The lab owns only the questions, the transport and the blind intensity test.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture} from '/scripts/video/picture.js';
import {OPTIONS, V1, resolveLook} from '/scripts/video/look.js';
import {PRESETS} from './presets.js';

const SONGS = {circus: 'Circus Minimus', petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma', tomada: 'Montagem Tomada (super slowed)'};
const noEnds = {...V1, ends: 'none'};
// Each option: [label, look, note shown when tapped].
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
];

const QUESTIONS = [
  {id: 'layout', ask: 'The layout as a whole', why: 'Your idea from round 21: instead of moving one element at a time, a few complete layouts, each seen with and without a sun. The changes are small on purpose. Varies: the rider’s height, the band’s height and, in D, the sun’s. The moments switch the sun on and off; “Shorts UI” shows where YouTube’s buttons and captions sit. Keep any number.',
    song: 'circus', t: 18, len: 6, multi: true, opts: [
      ['As now', {...noEnds, band: 'bars', riderLower: '0', bandHeight: 'lowmid', sunLift: '16'}, 'The rider as today; the band low-middle. With a sun: the rider 32 px lower, the sun 16 px higher (your round-21 choice).'],
      ['The rider a touch lower', {...noEnds, band: 'bars', riderLower: '8', bandHeight: 'lowmid', sunLift: '16'}, 'The rider 8 px lower; the band as now.'],
      ['Rider and band lower', {...noEnds, band: 'bars', riderLower: '8', bandHeight: 'low', sunLift: '16'}, 'The rider 8 px lower; the band at “low”, 29 px lower.'],
      ['More room, more air', {...noEnds, band: 'bars', riderLower: '16', bandHeight: 'low', sunLift: '32'}, 'The rider 16 px lower; the band at “low”; with a sun, the sun 32 px higher.']],
    moments: [['Circus 18 s', 18], ['Circus 43 s (the hook)', 43], ['With a sun · Hokusai', 18, 'circus', {scheme: 'hokusai', top: 'sun'}],
      ['With a sun · Celadon, the hook', 43, 'circus', {scheme: 'w2Celadon', top: 'sun'}], ['With the title', 18, 'circus', {top: 'title'}]]},
];
if (new URLSearchParams(location.search).has('qtest')) QUESTIONS.splice(0, QUESTIONS.length, ...TEST_QUESTIONS);
// every option is a complete look, checked once: a typo in a question fails on load, not silently on screen
for (const Q of QUESTIONS) for (const o of Q.opts) o[1] = resolveLook(null, o[1]);

// ── state ──────────────────────────────────────────────────────────────────
const q = new URLSearchParams(location.search);
const shot = q.has('shot');
const $ = id => document.getElementById(id);
const music = createMusic(), onScreen = displayTime();
let song = SONGS[q.get('song')] ? q.get('song') : 'petrunko';
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
const STORE = q.has('qtest') ? 'concept-lab-answers-test' : 'concept-lab-answers-r22';
const answers = (() => {try {return JSON.parse(localStorage.getItem(STORE) ?? '{}');} catch {return {};}})();
const saveAnswers = () => {try {localStorage.setItem(STORE, JSON.stringify(answers));} catch {}};
const sheetPromise = N.loadSheet();
const canvas = $('stage');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── loading ────────────────────────────────────────────────────────────────
// A song's scene and native replay are kept; its picture is made when the song is shown (its offscreen canvases are large).
const cache = new Map();
// ?rides=old (or a question moment marked 'old') plays the round 1–5 rides; the cache keeps both
let ridesOld = q.get('rides') === 'old', loadedOld = null;
// a moment can carry an override (for example 'On Dune'); it stays while the viewer switches options, until another moment
let momentExtra = null, momentLabel = '';
async function loadSong(key) {
  const id = ++loadId; song = key; P = null; loadedOld = ridesOld; status('Loading ' + SONGS[key] + (ridesOld ? ' (round-5 ride)' : '') + '…');
  const ck = key + (ridesOld ? ':old' : '');
  // returns false when a newer load superseded this one, or when it failed, so callers stop instead of applying their state
  try {
    let entry = cache.get(ck);
    if (!entry) {
      const res = await fetch(`./${ridesOld ? 'data-r5' : 'data'}/${key}.json`);
      if (!res.ok) throw new Error(`no ${ridesOld ? 'round-5 ' : ''}ride data (HTTP ${res.status})`);
      const scene = await res.json();
      entry = {scene, replay: N.replay(scene.track, scene.trace)}; cache.set(ck, entry);
      entry.replay.catch(() => cache.delete(ck)); // a failed replay is retried on the next tap
    }
    if (id !== loadId) return false; // a newer load began meanwhile: this song's music must not replace the newer song's
    const [replay, sheet] = await Promise.all([entry.replay, sheetPromise, shot ? null : music.load('/' + entry.scene.audio).catch(() => null)]);
    if (id !== loadId) return false;
    P = {...createPicture(canvas, entry.scene, replay, sheet, N.riderPainter()), key, scene: entry.scene};
  } catch (e) {
    // a failed load leaves no ride and says why; the next tap retries (P is null)
    if (id === loadId) {status(`Could not load ${SONGS[key]}: ${e.message}`); if (shot) window.__loadError = e.message;}
    return false;
  }
  $('seek').max = P.span[1]; seconds = Math.min(seconds, P.span[1]);
  status(''); renderUI(); draw();
  if (shot) {window.__ready = true; window.__duration = P.span[1]; window.__audio = '/' + P.scene.audio;
    window.__renderAt = t => {seconds = t; draw(); return canvas.toDataURL('image/png');};}
  return true;
}
// a look the ride cannot be drawn in (effects on the beat without recorded beats) says so instead of drawing something else
function draw() {if (P && canvas.width && canvas.height) try {P.draw(seconds, mix);} catch (e) {status(e.message); if (shot) throw e;}}
function moments() {
  // the quietest and the densest section (hits per second), the middle section change, the strongest hit, the ends
  const hits = P.effectTimes(mix), sect = P.scene.phases.filter(s => s.t1 - s.t0 > 2).map(s => ({...s, density: hits.filter(h => h.t >= s.t0 && h.t < s.t1).length / Math.max(0.5, s.t1 - s.t0)}));
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
  if (question.t === 'strongest') {const big = P.effectTimes(mix).reduce((a, b) => b.s > a.s ? b : a); return Math.max(0, big.t - 1.6);}
  return 0;
}
// What is drawn in question mode is ALWAYS the chosen option plus the chosen moment's override, built in this one place.
function applyOption() {const Q = QUESTIONS[qi]; if (Q?.opts) mix = resolveLook(null, {...Q.opts[qopt][1], ...(momentExtra ?? {})});}
function setOption(i) {qopt = i; applyOption(); renderQuestion(); draw();}
async function goQuestion(i, restore = null) {
  const nav = ++navId;
  pause(); qi = i; qopt = 0; momentExtra = null; momentLabel = ''; qmoment = null; scrollTo(0, 0);
  $('qcopy').textContent = 'Copy answers';
  if (qi >= QUESTIONS.length) {renderQuestion(); return;}
  const Q = QUESTIONS[qi];
  if (restore && restore.opt > 0 && restore.opt < Q.opts.length) qopt = restore.opt;
  applyOption(); ridesOld = Q.rides === 'old';
  renderQuestion();
  // !P: `song` names the song being loaded before its ride is ready, so a second tap during a load must load again
  if ((song !== Q.song || ridesOld !== loadedOld || !P) && !await loadSong(Q.song)) return;
  if (nav !== navId) return; // the viewer moved on while this question's song loaded
  loop = loopHome = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); $('loop').textContent = `Loop ${loopLen} s`; seek(loop); renderQuestion(); draw();
  if (restore && Q.moments?.[restore.mo]) await goMoment(restore.mo);
}
async function goMoment(j) {
  const Q = QUESTIONS[qi], [label, at, sg, extra, rides] = Q.moments[j], nav = ++navId;
  const was = playing; pause(); ridesOld = rides === 'old'; momentExtra = extra ?? null; qmoment = j;
  momentLabel = extra || rides === 'old' ? label : '';
  applyOption(); renderQuestion();
  if (((sg ?? Q.song) !== song || ridesOld !== loadedOld || !P) && !await loadSong(sg ?? Q.song)) return;
  if (nav !== navId) return;
  loop = loopHome = at === 'end' ? Math.max(0, P.span[1] - (Q.len ?? 4)) : qStart({t: at}); loopLen = Q.len ?? 4;
  $('loop').classList.add('on'); seek(loop); renderQuestion(); draw(); if (was) play();
}
// Answers: picks are a LIST of option labels plus a separate 'none' flag. Older saves kept one joined string ('A, B' or 'A + B');
// read it back by matching whole labels, so a label that contains a comma still comes back.
function answerOf(Q) {
  const a = answers[Q.id] ??= {pick: null, note: ''}, labels = Q.opts.map(o => o[0]);
  if (!Array.isArray(a.picks)) {
    const s = a.pick && a.pick !== 'none' ? a.pick : '', wrap = sep => sep + s.split(' + ').join(sep) + sep;
    a.picks = s ? labels.filter(l => l === s || wrap(', ').includes(', ' + l + ', ') || wrap(' + ').includes(' + ' + l + ' + ')) : [];
  }
  if (a.none === undefined) a.none = a.pick === 'none';
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
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[song]}`;
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
    a.none = false; a.pick = pickText(Q, a); saveAnswers(); renderQuestion();
  };
  // 'None of these' is its own flag, never a label: an option may itself be called 'None'
  const none = () => {a.none = !a.none; a.picks = []; a.pick = a.none ? 'none' : ''; saveAnswers(); renderQuestion();};
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip(LETTERS[i], !a.none && a.picks.includes(label), () => toggle(label), 'opt')),
    chip('None of these', a.none, none, 'opt')]));
  $('qnote').rows = Q?.open ? 7 : 2; $('qpicklabel').textContent = Q?.multi ? 'Keep (any number)' : 'My pick';
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  // the summary names each pick by letter AND label, and 'None of these' in words, so 'D · None' and 'None of these' never read alike
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answerOf(Q); return Q.open ? `${i + 1}. ${Q.ask}: ${a.note || '(skipped)'}` : `${i + 1}. ${Q.ask} → ${pickText(Q, a) || '(skipped)'}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
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
  const songs = $('songs'); songs.replaceChildren(...Object.entries(SONGS).map(([k, v]) => chip(v, k === song, () => {if (k !== song || !P) {pause(); loadSong(k);}}, 'song')));
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
window.__labState = () => ({qi, qopt, qmoment, momentExtra, momentLabel, mix: {...mix}, preset: preset.id, song, loaded: P?.key ?? null, ridesOld, loadedOld,
  loop, loopLen, seconds, playing, scheme: P ? P.schemeAt(seconds, mix) : null});
