// The ear board: the owner says what a ride should follow in each passage of a song, in a few gestures instead of a mark per
// note. Data from generated/lab-rides/ear.json (prepare-ear.mjs): the notes of each separated stem (tools/music/lines.py), the
// bar, sections, his earlier marks, the landings of the specs that have a ride, and an author's proposed reading when there is
// one. A passage is a time range, the stems followed in it with a least attack each, and optionally the slots of the bar that
// count; the notes it selects are heard as clicks over the music. Taps (T) are examples: the page finds the stem and the
// attack that explain them, or keeps only the bar slots he tapped. B marks the note at the playhead as a big hit: the few
// moments that must hit hardest, which is all he says about strength. Saved to the study ear-2026-11, one row per save;
// guides.mjs turns the latest rows into productions/<song>/guide.json for an author.
import {el, loadAnswers, report, saveAnswer} from './store.mjs';

const STUDY = 'ear-2026-11', STEMS = ['vocals', 'other', 'drums', 'bass'], NAME = {vocals: 'voice', other: 'other', drums: 'drums', bass: 'bass'};
const COLOUR = {vocals: '#c0392b', other: '#236cba', drums: '#1b1f25', bass: '#8a6a2f'}, SLOTS = 16, NEAR = 0.07;
const $ = id => document.getElementById(id), saved = await loadAnswers(STUDY);
const response = await fetch('/generated/lab-rides/ear.json', {cache: 'no-store'});
if (!response.ok) {$('title').textContent = 'No data yet: run node generated/concept-lab/closing/prepare-ear.mjs'; throw new Error('ear.json is missing');}
const {songs} = await response.json(), state = s => saved.get(s.song) ?? {answers: {}, note: ''};
let at = Math.max(0, songs.findIndex(s => s.song === location.hash.slice(1))), passages = [], taps = [], chosen = -1, view = {t0: 0, span: 30}, clicksOn = 'followed', hear = 'mix', looping = false, pending = null, fits = null, proposed = false, big = [];
const canvas = $('timeline'), ctx = canvas.getContext('2d');
const clock = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── what a passage selects ──
const slotOf = (s, t) => ((Math.round(((t - s.bar.first) % s.bar.seconds + s.bar.seconds) % s.bar.seconds / s.bar.seconds * SLOTS)) % SLOTS);
function selected(s, p, only = null) {
  const out = [];
  for (const stem of only ?? Object.keys(p.follow)) for (const [t, attack, heard] of s.stems[stem])
    if (t >= p.from && t < p.to && attack >= p.follow[stem] && (!p.slots || p.slots.includes(slotOf(s, t)))) out.push({t, strength: Math.min(1, heard / 2), stem});
  out.sort((a, b) => a.t - b.t);
  // one sound in two stems is one note: of two within 60 ms, the one where the mix rises more stays (strength: the mix's rise)
  const kept = []; for (const n of out) {const last = kept.at(-1); if (last && n.t - last.t < 0.06) {if (n.strength > last.strength) kept[kept.length - 1] = n;} else kept.push(n);}
  return kept;
}
const followed = s => passages.flatMap(p => selected(s, p));
function nearest(times, t) {let lo = 0, hi = times.length; while (lo < hi) {const m = (lo + hi) >> 1; if (times[m] < t) lo = m + 1; else hi = m;} return [times[lo - 1], times[lo]].filter(v => v !== undefined).reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a, Infinity);}
/** His taps come a little late or early as a whole: the median distance to the nearest note, within 0.2 s. */
function lag(times, mine) {const d = mine.map(t => t - nearest(times, t)).filter(v => Math.abs(v) < 0.2).sort((a, b) => a - b); return d.length ? d[d.length >> 1] : 0;}
/** Per stem, the least attack whose notes agree best with the taps of the passage: {stem: {least, score, found, notes}}. */
function fit(s, p) {
  const mine = taps.filter(t => t >= p.from && t < p.to), out = {};
  if (mine.length < 3) return null;
  const span = [Math.min(...mine) - 0.15, Math.max(...mine) + 0.15];
  for (const stem of STEMS) {
    let best = null;
    for (let least = 0; least <= 1.5; least += 0.05) {
      const times = s.stems[stem].filter(n => n[1] >= least && n[0] >= span[0] && n[0] <= span[1]).map(n => n[0]); if (!times.length) break;
      const off = lag(times, mine), found = mine.filter(t => Math.abs(nearest(times, t - off) - (t - off)) <= NEAR).length;
      const on = times.filter(n => Math.abs(nearest(mine.map(t => t - off), n) - n) <= NEAR).length, score = 2 * found * on / ((found * times.length + on * mine.length) || 1);
      if (!best || score > best.score + 1e-9) best = {least: +least.toFixed(2), score, found, notes: times.length, taps: mine.length};
    }
    if (best) out[stem] = best;
  }
  return out;
}
/** What to follow for the taps of a passage. With stems already ticked: their least attacks that agree best with the taps
 * (he said which lines; the taps say how sharp a note counts). With none: the one stem that explains the taps best. A rhythm
 * figure is found well this way; a voice is better ticked, since the band often plays on the same syllables. */
function fromTaps(s, p, fits) {
  const mine = taps.filter(t => t >= p.from && t < p.to), span = {from: Math.min(...mine) - 0.15, to: Math.max(...mine) + 0.15, slots: null}, ticked = Object.keys(p.follow);
  const score = follow => {const times = selected(s, {...span, follow}).map(n => n.t); if (!times.length) return 0; const off = lag(times, mine), shifted = mine.map(t => t - off);
    const found = shifted.filter(t => Math.abs(nearest(times, t) - t) <= NEAR).length, on = times.filter(n => Math.abs(nearest(shifted, n) - n) <= NEAR).length; return 2 * found * on / ((found * times.length + on * mine.length) || 1);};
  if (!ticked.length) {const [stem, f] = Object.entries(fits).sort((a, b) => b[1].score - a[1].score)[0]; return {[stem]: f.least};}
  const best = Object.fromEntries(ticked.map(stem => [stem, fits[stem]?.least ?? 0.5])); let top = score(best);
  for (let round = 0; round < 3; round++) for (const stem of ticked) for (let least = 0; least <= 1.5; least += 0.05) {const v = score({...best, [stem]: +least.toFixed(2)}); if (v > top + 1e-9) {top = v; best[stem] = +least.toFixed(2);}}
  return best;
}

// ── sound: the music (the mix or one stem), and a click on every note of the chosen row ──
const audio = new AudioContext(), buffers = new Map(), tick = audio.createBuffer(1, 1600, audio.sampleRate);
{const d = tick.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 1900 * i / audio.sampleRate) * Math.exp(-i / 260);}
let source = null, startedAt = 0, startedFrom = 0, playing = false, ticket = 0, clickedTo = 0;
const file = s => hear === 'mix' ? s.audio : `/generated/stems/${s.song}/${hear}.wav`;
const buffer = url => {if (!buffers.has(url)) buffers.set(url, fetch(url).then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b))); return buffers.get(url);};
const range = () => looping && passages[chosen] ? passages[chosen] : null;
function position() {
  if (!playing) return startedFrom;
  const t = startedFrom + audio.currentTime - startedAt, r = range();
  return r && t >= r.to ? r.from + (t - r.to) % (r.to - r.from) : t;
}
function stop() {if (source) {try {source.stop();} catch {} source = null;} startedFrom = Math.min(position(), songs[at].seconds); playing = false; $('play').textContent = 'Play';}
async function play(from = position()) {
  const mine = ++ticket, s = songs[at], sound = await buffer(file(s)); if (mine !== ticket) return;
  if (source) {try {source.stop();} catch {} source = null;}
  await audio.resume();
  const r = range(); if (r && !(from >= r.from && from < r.to)) from = r.from; if (from >= s.seconds - 0.05) from = 0;
  source = audio.createBufferSource(); source.buffer = sound; if (r) {source.loop = true; source.loopStart = r.from; source.loopEnd = r.to;}
  source.connect(audio.destination); source.start(0, from); startedAt = audio.currentTime; startedFrom = from; clickedTo = from - 0.001; playing = true; $('play').textContent = 'Pause';
}
const replay = () => {if (playing) void play();};
function clickTimes(s) {
  if (clicksOn === 'followed') return followed(s).map(n => [n.t, big.some(v => Math.abs(v - n.t) < 0.05) ? 1.6 : 0.2 + 0.5 * n.strength]);
  if (clicksOn === 'my marks') return Object.values(s.marks).flat().sort((a, b) => a - b).map(t => [t, 0.8]);
  if (clicksOn === 'my taps') return taps.map(t => [t, 0.8]);
  return s.specs[clicksOn] ?? [];
}
function sounding(s, now) {
  if (now < clickedTo) clickedTo = now - 0.001; // the loop came round
  const until = now + 0.25; if (clicksOn === 'none') {clickedTo = until; return;}
  for (const [t, strength] of clickTimes(s)) if (t > clickedTo && t <= until) {
    const node = audio.createBufferSource(), gain = audio.createGain(); node.buffer = tick; gain.gain.value = 0.25 + 0.75 * strength; node.connect(gain).connect(audio.destination); node.start(audio.currentTime + Math.max(0, t - now));
  }
  clickedTo = until;
}

// ── drawing ──
const LEFT = 88, RULER = 26, BAND = 16, TALL = 46, THIN = 20;
const rowsOf = s => [...STEMS.map(stem => ({kind: 'stem', stem, h: TALL})), {kind: 'followed', label: 'followed', h: 30}, {kind: 'taps', label: 'my taps', h: THIN}, {kind: 'big', label: 'big hits', h: THIN},
  ...Object.keys(s.specs).map(name => ({kind: 'spec', name, label: name, h: THIN})), ...Object.keys(s.marks).map(tag => ({kind: 'marks', tag, label: `my ${tag === 'mark' ? 'rhythm' : tag} marks`, h: THIN}))];
const x = t => LEFT + (t - view.t0) / view.span * (canvas.clientWidth - LEFT - 8), timeAt = px => clamp(view.t0 + (px - LEFT) / (canvas.clientWidth - LEFT - 8) * view.span, 0, songs[at].seconds);
function paint() {
  const s = songs[at], rows = rowsOf(s), w = canvas.clientWidth, h = RULER + BAND + rows.reduce((a, r) => a + r.h + 4, 0) + 6, k = devicePixelRatio || 1;
  if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;
  if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) {canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);}
  ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h); ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
  const t1 = view.t0 + view.span, seen = t => t >= view.t0 - 0.01 && t <= t1 + 0.01;
  ctx.save(); ctx.beginPath(); ctx.rect(LEFT - 2, 0, w - LEFT, h); ctx.clip();
  // bars (a hypothesis), seconds, sections
  if (s.bar.repeats >= 0.4) for (let b = s.bar.first; b < t1; b += s.bar.seconds) if (seen(b)) {ctx.fillStyle = '#1b1f2514'; ctx.fillRect(x(b), RULER, 1, h);}
  const every = view.span > 40 ? 10 : view.span > 16 ? 5 : 1;
  ctx.fillStyle = '#626a75'; for (let t = Math.ceil(view.t0 / every) * every; t <= t1; t += every) {ctx.fillRect(x(t), RULER - 6, 1, 6); ctx.fillText(String(t), x(t) + 3, RULER - 12);}
  s.sections.forEach(p => {if (!seen(p.t)) return; ctx.fillStyle = '#b8741a'; ctx.fillRect(x(p.t), 0, 1, h); ctx.fillText(p.name.toLowerCase(), x(p.t) + 4, 6);});
  // passages
  passages.forEach((p, i) => {
    ctx.fillStyle = i === chosen ? '#236cba24' : '#236cba10'; ctx.fillRect(x(p.from), RULER, x(p.to) - x(p.from), h - RULER);
    ctx.fillStyle = i === chosen ? '#236cba' : '#236cba99'; ctx.fillRect(x(p.from), RULER, x(p.to) - x(p.from), BAND - 3);
    ctx.fillStyle = '#fff'; ctx.fillText(Object.keys(p.follow).map(f => NAME[f]).join(' + ') || 'nothing yet', Math.max(x(p.from), LEFT) + 5, RULER + (BAND - 3) / 2);
  });
  if (pending !== null) {ctx.fillStyle = '#236cba'; ctx.fillRect(x(pending), RULER, 2, h);}
  if (drag?.made) {ctx.fillStyle = '#236cba30'; ctx.fillRect(x(Math.min(drag.t, drag.to)), RULER, Math.abs(x(drag.to) - x(drag.t)), h - RULER);}
  // rows
  let y = RULER + BAND + 2; const tops = [];
  for (const r of rows) {
    tops.push([r, y]); const base = y + r.h;
    ctx.fillStyle = '#1b1f250a'; ctx.fillRect(LEFT, base, w, 1);
    const stroke = (t, v, colour, alpha = 1) => {if (!seen(t)) return; ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.fillRect(x(t) - 1, base - Math.max(3, v * (r.h - 2)), 2, Math.max(3, v * (r.h - 2)));};
    if (r.kind === 'stem') for (const [t, attack] of s.stems[r.stem]) {
      const p = passages.find(q => t >= q.from && t < q.to), on = p ? r.stem in p.follow && attack >= p.follow[r.stem] && (!p.slots || p.slots.includes(slotOf(s, t))) : null;
      stroke(t, Math.min(1, attack / 1.3), COLOUR[r.stem], on === null ? 0.5 : on ? 1 : 0.16);
    } else if (r.kind === 'followed') for (const n of followed(s)) stroke(n.t, 0.35 + 0.65 * n.strength, COLOUR[n.stem]);
    else if (r.kind === 'taps') for (const t of taps) stroke(t, 1, '#1f8a4c');
    else if (r.kind === 'big') for (const t of big) stroke(t, 1, '#c0392b');
    else if (r.kind === 'spec') for (const [t, v] of s.specs[r.name]) stroke(t, 0.3 + 0.7 * v, '#5b3fa8');
    else for (const t of s.marks[r.tag]) stroke(t, 1, '#1f8a4c');
    ctx.globalAlpha = 1; y = base + 4;
  }
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x(position()) - 1, 0, 2, h); ctx.restore();
  ctx.textAlign = 'right'; for (const [r, top] of tops) {ctx.fillStyle = r.kind === 'stem' ? COLOUR[r.stem] : '#626a75'; ctx.fillText(r.kind === 'stem' ? NAME[r.stem] : r.label.replace('my ', ''), LEFT - 8, top + r.h / 2);} ctx.textAlign = 'left';
}
function frame() {
  const s = songs[at], now = position();
  if (playing) {
    if (now >= s.seconds) stop(); else sounding(s, now);
    if (now < view.t0 || now > view.t0 + view.span * 0.92) view.t0 = clamp(now - view.span * 0.1, 0, Math.max(0, s.seconds - view.span));
  }
  $('clock').textContent = `${clock(Math.min(now, s.seconds))} / ${clock(s.seconds)}`; paint(); requestAnimationFrame(frame);
}

// ── the chosen passage ──
function panel() {
  const s = songs[at], p = passages[chosen], box = $('passage');
  $('loop').classList.toggle('on', looping);
  if (!p) {box.replaceChildren(el('h3', {textContent: passages.length ? 'No passage chosen' : 'No passage yet'}), el('p', {className: 'hint', textContent: 'Drag across the rows to make one (or press [ where it starts and ] where it ends, while listening). Click a passage to choose it.'})); return;}
  const notes = selected(s, p), bars = (p.to - p.from) / s.bar.seconds;
  const stems = STEMS.map((stem, i) => {
    const on = stem in p.follow, least = on ? p.follow[stem] : fits?.[stem]?.least ?? 1, f = fits?.[stem];
    const box = el('input', {type: 'checkbox', checked: on, onchange: () => {if (box.checked) p.follow[stem] = least; else delete p.follow[stem]; changed();}});
    const slider = el('input', {type: 'range', min: 0, max: 1.5, step: 0.05, value: least, disabled: !on, oninput: () => {p.follow[stem] = +slider.value; changed(false); count.textContent = `${selected(s, p, [stem]).length} notes, attack ≥ ${(+slider.value).toFixed(2)}`;}, onchange: () => changed()});
    const count = el('small', {textContent: on ? `${selected(s, p, [stem]).length} notes, attack ≥ ${least.toFixed(2)}` : f ? `explains ${f.found} of ${f.taps} taps (${f.notes} notes at ≥ ${f.least.toFixed(2)})` : ''});
    return el('div', {className: 'stem'}, el('label', {style: `color:${COLOUR[stem]};font-weight:600`}, box, ` ${i + 1} ${NAME[stem]}`), slider, count);
  });
  const counts = Array(SLOTS).fill(0); for (const n of selected(s, {...p, slots: null})) counts[slotOf(s, n.t)]++;
  const slots = el('div', {className: 'slots'}, ...counts.map((c, k) => el('button', {className: !p.slots || p.slots.includes(k) ? 'on' : '', title: `slot ${k + 1} of the bar: ${c} notes in this passage`, textContent: c || '·',
    onclick: () => {const all = p.slots ?? [...Array(SLOTS).keys()]; p.slots = all.includes(k) ? all.filter(v => v !== k) : [...all, k].sort((a, b) => a - b); if (p.slots.length === SLOTS) p.slots = null; changed();}})));
  const best = fits && Object.entries(fits).sort((a, b) => b[1].score - a[1].score)[0];
  const note = el('input', {className: 'note', value: p.note ?? '', placeholder: 'A word on this passage, if the ticks do not say it', onchange: () => {p.note = note.value;}});
  box.replaceChildren(...[
    el('h3', {textContent: `${proposed ? 'Proposed: ' : ''}${clock(p.from)} to ${clock(p.to)}`}),
    el('p', {className: 'hint', textContent: `${notes.length} notes followed, ${(notes.length / (p.to - p.from)).toFixed(1)} a second. Tick what the ride follows here; a slider keeps only the sharper notes of that stem.`}),
    ...stems,
    el('p', {className: 'hint', textContent: s.bar.repeats >= 0.4 ? `The bar (${s.bar.seconds.toFixed(2)} s, about ${bars.toFixed(1)} in this passage) in sixteen slots, with how many of the ticked notes fall in each. Turn a slot off to leave its notes out in every bar.` : 'No steady bar was found in this song, so the slots below may mean little.'}), slots,
    el('div', {className: 'row'},
      el('button', {className: 'pill', textContent: 'Fit to my taps', onclick: () => {fits = fit(s, p); if (fits) p.follow = fromTaps(s, p, fits); changed(); if (!fits) $('status').textContent = 'Tap at least three notes inside this passage first (T while it plays).';}}),
      el('button', {className: 'pill', textContent: 'Keep only the slots I tapped', onclick: () => {
        const mine = taps.filter(t => t >= p.from && t < p.to), times = selected(s, {...p, slots: null}).map(n => n.t); if (mine.length < 2 || !times.length) {$('status').textContent = 'Tap a bar or two inside this passage first, with at least one stem ticked.'; return;}
        const off = lag(times, mine); p.slots = [...new Set(mine.map(t => slotOf(s, nearest(times, t - off))))].sort((a, b) => a - b); changed();}}),
      el('button', {className: 'pill', textContent: 'All slots', onclick: () => {p.slots = null; changed();}}),
      el('button', {className: 'pill', textContent: 'Delete the passage', onclick: () => {passages.splice(chosen, 1); chosen = -1; changed();}})),
    best ? el('p', {className: 'hint', textContent: `Your taps here agree best with ${NAME[best[0]]}: ${best[1].found} of ${best[1].taps} taps on a note, among ${best[1].notes} notes.`}) : null, note].filter(Boolean));
}
function changed(redraw = true) {proposed = false; if (redraw) panel(); facts();}
function facts() {
  const s = songs[at], n = followed(s).length, covered = passages.reduce((a, p) => a + p.to - p.from, 0);
  $('facts').replaceChildren(...[el('div', {textContent: `${passages.length} passages over ${covered.toFixed(0)} of ${s.seconds.toFixed(0)} s, ${n} notes followed, ${big.length} big hits, ${taps.length} taps.`}),
    s.reading ? el('div', {}, el('b', {textContent: `${s.reading.by ?? 'Proposed'}: `}), s.reading.summary ?? '') : null, ...(s.reading?.questions ?? []).map(q => el('div', {}, el('b', {textContent: 'Question: '}), q))].filter(Boolean));
}
function addPassage(from, to) {
  [from, to] = [Math.min(from, to), Math.max(from, to)]; if (to - from < 0.3) return;
  passages = passages.flatMap(q => q.from >= from && q.to <= to ? [] : q.from < from && q.to > to ? [{...q, to: from}, {...structuredClone(q), from: to}] : [{...q, from: q.from < to && q.from >= from ? to : q.from, to: q.to > from && q.to <= to ? from : q.to}]);
  const p = {from: +from.toFixed(2), to: +to.toFixed(2), follow: {}, slots: null, note: ''}; passages.push(p); passages.sort((a, b) => a.from - b.from); chosen = passages.indexOf(p); fits = null; changed();
}
const pills = (host, names, current, set) => host.replaceChildren(...names.map(n => el('button', {className: `pill${n === current() ? ' on' : ''}`, textContent: NAME[n] ?? n, onclick: () => {set(n); menus();}})));
function menus() {
  const s = songs[at];
  pills($('hear'), ['mix', ...STEMS], () => hear, n => {hear = n; replay();});
  pills($('clicks'), ['followed', ...Object.keys(s.specs), ...(Object.keys(s.marks).length ? ['my marks'] : []), 'my taps', 'none'], () => clicksOn, n => {clicksOn = n; clickedTo = position();});
}

// ── songs, saving ──
function progress() {songs.forEach((s, i) => {const [dot, , small] = rows[i].childNodes, a = state(s).answers; dot.className = `dot${a.passages?.length ? ' done' : ''}`; small.textContent = a.passages?.length ? `${a.passages.length} passages` : s.reading ? 'proposed' : `${s.seconds.toFixed(0)} s`; rows[i].classList.toggle('on', i === at);});}
const rows = songs.map((s, i) => el('button', {onclick: () => show(i)}, el('span'), s.title, el('small')));
$('index').append(...rows);
function show(i) {
  stop(); at = i; const s = songs[i], a = state(s).answers;
  history.replaceState(null, '', `#${s.song}`); startedFrom = 0; pending = null; fits = null;
  proposed = !a.passages && !!s.reading?.passages?.length;
  passages = structuredClone(a.passages ?? s.reading?.passages ?? []); taps = [...(a.taps ?? [])]; big = [...(a.big ?? s.reading?.big ?? [])]; chosen = passages.length ? 0 : -1;
  view = {t0: 0, span: Math.min(s.seconds, 30)}; if (!(clicksOn in s.specs) && !['followed', 'none', 'my taps'].includes(clicksOn)) clicksOn = 'followed';
  $('title').textContent = s.title; $('note').value = state(s).note; $('status').textContent = '';
  menus(); panel(); facts(); progress(); rows[i].scrollIntoView({block: 'nearest'}); void buffer(file(s));
}
async function save() {
  const s = songs[at], answers = {passages: passages.map(p => ({...p, notes: selected(s, p).length})), taps: taps.map(t => +t.toFixed(3)), big, bar: s.bar};
  saved.set(s.song, {answers, note: $('note').value}); report($('status'), await saveAnswer(s.song, answers, $('note').value, STUDY), `${passages.length} passages of ${s.title}`); progress();
}
$('save').onclick = save; $('note').onchange = save;
$('untap').onclick = () => {const p = passages[chosen]; taps = p ? taps.filter(t => t < p.from || t >= p.to) : []; fits = null; changed();};
$('play').onclick = () => playing ? stop() : void play();
const toggleLoop = () => {looping = !looping; panel(); replay();};
$('loop').onclick = toggleLoop;
const seek = t => {t = clamp(t, 0, songs[at].seconds - 0.05); if (playing) void play(t); else startedFrom = t;};

// pointer: a drag makes a passage, a click moves the playhead and chooses the passage there
let drag = null;
canvas.onpointerdown = e => {drag = {px: e.offsetX, t: timeAt(e.offsetX), to: timeAt(e.offsetX), made: false, ruler: e.offsetY < RULER}; canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove = e => {if (!drag) return; drag.to = timeAt(e.offsetX); if (!drag.ruler && Math.abs(e.offsetX - drag.px) > 6) drag.made = true; if (drag.ruler) seek(drag.to);};
canvas.onpointerup = () => {
  if (!drag) return; const d = drag; drag = null;
  if (d.made) return addPassage(d.t, d.to);
  const i = passages.findIndex(p => d.t >= p.from && d.t < p.to); if (i !== chosen) {chosen = i; fits = null; panel();} seek(d.t);
};
canvas.addEventListener('wheel', e => {
  e.preventDefault(); const s = songs[at];
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) view.t0 = clamp(view.t0 + (e.deltaX || e.deltaY) / 600 * view.span, 0, Math.max(0, s.seconds - view.span));
  else {const t = timeAt(e.offsetX), span = clamp(view.span * Math.exp(e.deltaY / 400), 3, s.seconds); view.t0 = clamp(t - (t - view.t0) * span / view.span, 0, Math.max(0, s.seconds - span)); view.span = span;}
}, {passive: false});
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.classList?.contains('note')) {if (e.key === 'Enter') {e.preventDefault(); e.target.blur();} return;}
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase(), s = songs[at], p = passages[chosen];
  if (k === ' ') playing ? stop() : void play();
  else if (k === 't') {taps.push(position()); taps.sort((a, b) => a - b); facts();}
  else if (k === 'b') {const here = position(), times = followed(s).map(n => n.t), t = times.length && Math.abs(nearest(times, here) - here) < 0.25 ? nearest(times, here) : here, i = big.findIndex(v => Math.abs(v - t) < 0.05); if (i >= 0) big.splice(i, 1); else big.push(+t.toFixed(3)); big.sort((a, b) => a - b); facts();}
  else if (k === '[') pending = position();
  else if (k === ']') {if (pending !== null) {addPassage(pending, position()); pending = null;}}
  else if (k >= '1' && k <= '4' && p) {const stem = STEMS[+k - 1]; if (stem in p.follow) delete p.follow[stem]; else p.follow[stem] = fits?.[stem]?.least ?? 1; changed();}
  else if (k === 'l') toggleLoop();
  else if (k === 'c') {const names = ['followed', ...Object.keys(s.specs), 'my taps', 'none']; clicksOn = names[(names.indexOf(clicksOn) + 1) % names.length]; clickedTo = position(); menus();}
  else if (k === 'arrowleft') seek(position() - 2);
  else if (k === 'arrowright') seek(position() + 2);
  else if (k === 'enter') void save();
  else if (k === 'arrowdown') show(Math.min(songs.length - 1, at + 1));
  else if (k === 'arrowup') show(Math.max(0, at - 1));
  else return;
  e.preventDefault();
});
window.earPage = {songs, selected, fit, state: () => ({at, passages, taps, chosen, view, clicksOn, hear, looping, playing, position: position()}), addPassage, set: v => {taps = v.taps ?? taps; panel(); facts();}};
show(at); requestAnimationFrame(frame);
