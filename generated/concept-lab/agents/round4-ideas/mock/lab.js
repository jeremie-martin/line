// Concept lab, round 2: the real saved ride, drawn live with the vendored rider artwork and
// native replay, an honest automatic camera (cam.js), and independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '../../../dist/native.js';
import * as C from './cam.js';

const W = 1080, H = 1920, FPS = 40;
const INK = '#15181d', PENCIL = '#b4bcc8', NIGHT = '#14171d';
const SRC = {drums: '#15181d', vocals: '#2b59d6', sung: '#2b59d6', bass: '#7b3fbf', other: '#e0532f'};
const Z0 = 5.4; // today's vertical zoom
const SIZE_Z = {s58: 5.8, s62: 6.2, s68: 6.8};
// One optional, hand-placed cue per song: a drop is a musical judgement, and no detector found it reliably.
const NIGHTS = {petrunko: [22.4, 40.5], los: [23.9, 40.5], lua: [29.7, 49.6], batidao: [15.2, 29.5], burn: [4.5, 24.5], coma: [19.1, 33.6]};

const qs0 = new URLSearchParams(location.search);
const PAL = {
  klein:   {paper:'#ffffff', ink:'#0d1433', pencil:'#b4bcd8', mass:'#0f2fb5', accent:'#f2500f', np:'#0a1a6e', ni:'#f5f7ff'},
  hokusai: {paper:'#f4ecdc', ink:'#12294d', pencil:'#b8b4a4', mass:'#1d3e73', accent:'#d4412a', np:'#0d1f3f', ni:'#f4ecdc'},
  bottle:  {paper:'#f3f1e4', ink:'#0e2e27', pencil:'#b0b9a8', mass:'#14604c', accent:'#c96805', np:'#0a2a23', ni:'#f6efcf'},
  salmon:  {paper:'#fce6d9', ink:'#3a1024', pencil:'#cfb3a8', mass:'#7a1438', accent:'#007a78', np:'#2b0a1a', ni:'#fce6d9'},
  blueprint:{paper:'#123f7f', ink:'#f3f7ff', pencil:'#4c70aa', mass:'#dfe9fb', accent:'#ffb300', np:'#071d40', ni:'#f3f7ff'},
  graphite:{paper:'#ffffff', ink:'#15181d', pencil:'#b4bcc8', mass:'#3b414a', accent:'#d3262e', np:'#14171d', ni:'#eef1f5'},
};
const P = PAL[qs0.get('pal')] ?? PAL.graphite, RV = qs0.get('rv') ?? '', HITX = qs0.get('hx') ?? '', XAGE = +(qs0.get('age') ?? 0);
const DIMS = {
  size: ['Size', {today: 'Today', s58: '7 % closer', s62: '15 % closer', s68: '25 % closer'}],
  place: ['Rider in the frame', {official: 'Official follower', tamed: 'Tamed', calm: 'Calm', pinnedRight: 'Pinned right', pinnedLeft: 'Pinned left'}],
  tide: ['Zoom over time', {steady: 'Steady', busyWide: 'Wider when busy', busyClose: 'Closer when busy', calmOut: 'Out when quiet', arc: 'One slow push'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course'}],
  tiny: ['Tiny rider', {plain: 'As it is', ring: 'Ring', token: 'Larger rider'}],
  bg: ['Background', {white: 'White', porcelain: 'Porcelain', impact: 'Tone: impact rate', loud: 'Tone: loudness', night: 'Night for the drop'}],
  ink: ['Line', {ink: 'Ink', inking: 'Pencil → ink'}],
  music: ['Lower band', {none: 'None', bars: 'Today’s bars', bars3: 'Bars · three colours', blocks: 'Blocks', stems: 'Tuning fork', iris: 'Iris', slits: 'Cobalt', red: 'One red · fork', redblocks: 'One red · blocks', redbars: 'One red · bars', ridge: 'Ridge'}],
  redBy: ['What turns red', {loud: 'Loudest three', standing: 'Standing', struck: 'Struck', registers: 'Three registers', heat: 'Heat'}],
  bandY: ['Band height', {low: 'Low', mid: 'Middle', high: 'Today’s height'}],
  hit: ['On each hit', {none: 'Nothing', shake: 'Today’s shake & split', refined: 'Today, refined', strong: 'Refined, stronger hits held longer', clean: 'Refined, clean rider', trail: 'Trailing split', shade: 'Shade'}],
};
const base = {size: 's62', place: 'calm', tide: 'steady', ends: 'none', tiny: 'ring', bg: 'white', ink: 'inking', music: 'none', redBy: 'standing', bandY: 'low', hit: 'none'};
const PRESETS = [
  {id: 'today', name: 'Today', line: 'Today’s camera, bars, shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, size: 'today', place: 'official', ink: 'ink', music: 'bars', hit: 'shake'}},
  {id: 'ride', name: 'Ride', line: 'The Calm camera, 15 % closer, pencil to ink. Nothing else: the baseline.', mix: {...base}},
  {id: 'plus', name: 'Today+', line: 'The closest to what you already like: today’s bars and refined hits, with pencil to ink, the Calm camera and whole-course ends.',
    mix: {...base, ends: 'overture', tiny: 'token', hit: 'refined', music: 'bars'}},
  {id: 'scarf', name: 'Scarf', line: 'One red on the tuning fork, standing until a clearly stronger hit moves it. Held hits. White.',
    mix: {...base, ends: 'overture', tiny: 'token', hit: 'strong', music: 'red'}},
  {id: 'ridge', name: 'Ridge', line: 'The course as a filled silhouette that inks as you ride. Clean-rider hits, a tone following impact rate.',
    mix: {...base, ends: 'overture', tiny: 'token', hit: 'clean', music: 'ridge', bg: 'impact'}},
  {id: 'night', name: 'Night', line: 'The drop turns to night. Iris below, held hits.',
    mix: {...base, ends: 'overture', tiny: 'token', hit: 'strong', music: 'iris', bg: 'night'}},
  {id: 'shade', name: 'Shade', line: 'On strong hits, everything beyond the struck line drops in tone. Red blocks on porcelain.',
    mix: {...base, ends: 'overture', tiny: 'token', hit: 'shade', music: 'redblocks', bg: 'porcelain'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma'};
const plain = {...base};
// Each option: [label, mix, note shown when tapped].
const QUESTIONS = [
  {id: 'place', ask: 'How still should the rider be?', why: 'All sit in about the same place, right of centre; only the motion differs. Watch the rider, not the track, for a few seconds.',
    song: 'los', t: 24, len: 8, opts: [
      ['Official', {...plain, place: 'official'}, 'The official follower as it is: the rider rides the edge of a soft zone.'],
      ['Tamed', {...plain, place: 'tamed'}, 'The official shape: falls still show, and the climb back curves gently.'],
      ['Calm', {...plain, place: 'calm'}, 'A small swell, with almost no slips. The default for the films.'],
      ['Pinned right', {...plain, place: 'pinnedRight'}, 'Fixed to one point. Tests whether you disliked the pinning or the left side.']],
    moments: [['Los Voltaje 24 s', 24], ['Petrunko 22 s', 22, 'petrunko'], ['Lua 28 s', 28, 'lua'], ['Montagem Coma 40 s', 40, 'coma']]},
  {id: 'tide', ask: 'Should the zoom move at all?', why: 'Twenty seconds: these move slowly on purpose, and never while airborne. Keep any number.',
    song: 'lua', t: 15, len: 20, multi: true, opts: [
      ['Steady', {...plain}, 'Fixed at 15 % closer.'],
      ['Wider when busy', {...plain, tide: 'busyWide'}, 'Eases out as hits get denser, so it stays readable; ±12 %.'],
      ['Closer when busy', {...plain, tide: 'busyClose'}, 'The opposite: eases in as hits get denser; ±12 %.'],
      ['Out when quiet', {...plain, tide: 'calmOut'}, 'Steady, easing out up to 12 % only in the song’s quietest stretches.'],
      ['One slow push', {...plain, tide: 'arc'}, 'One push across the whole song, too slow to see in a loop: compare the Start and End chips.']],
    moments: [['Lua 15–35 s', 15], ['Los Voltaje 5–25 s', 5, 'los'], ['Start', 0.2], ['End', 32]]},
  {id: 'hit', ask: 'Which hits feel right?', why: 'Each on one strength scale for every song. Keep any number.',
    song: 'los', t: 46.1, len: 4, multi: true, opts: [
      ['Today', {...plain, hit: 'shake'}, 'Today’s shake, horizontal split and flash.'],
      ['Refined', {...plain, hit: 'refined'}, 'Your favourite last round: a kick into the line, a split along the impact, a flash.'],
      ['Held', {...plain, hit: 'strong'}, 'Refined, but strong hits hold longer and stand out more; weak ones stay crisp.'],
      ['Clean rider', {...plain, hit: 'clean'}, 'Held, with the world splitting around a rider that stays sharp.'],
      ['Trailing', {...plain, hit: 'trail'}, 'The discreet trailing split you liked in Voltage, with a small kick.'],
      ['Shade', {...plain, hit: 'shade'}, 'A risk: everything beyond the struck line drops in tone, reddening on the hardest hits.']],
    moments: [['Los Voltaje 46 s', 46.1], ['Petrunko strongest', 'strongest', 'petrunko'], ['Lua 30 s', 29.6, 'lua'], ['No Batidão 30 s', 29.4, 'batidao']]},
  {id: 'red', ask: 'What should turn red?', why: 'The red you loved, with different logic behind it. Keep any number.',
    song: 'coma', t: 40, len: 6, multi: true, opts: [
      ['Loudest', {...plain, music: 'red', redBy: 'loud'}, 'The original: the three loudest frequencies, changing constantly.'],
      ['Standing', {...plain, music: 'red', redBy: 'standing'}, 'Red rests on three stems until a clearly stronger hit earns it. The jump is the event.'],
      ['Struck', {...plain, music: 'red', redBy: 'struck'}, 'Red only at a hit, on the frequencies that struck; harder hits light more.'],
      ['Heat', {...plain, music: 'red', redBy: 'heat'}, 'The more impact lately, the more red, from none up to six.']],
    moments: [['Montagem Coma 40 s', 40], ['Lua 36 s', 36.5, 'lua'], ['Petrunko 24 s', 24.5, 'petrunko']]},
  {id: 'band', ask: 'Which forms for the lower band?', why: 'One palette for all, graphite with one red, so you judge the form, not the colour. Keep any number.',
    song: 'petrunko', t: 30, len: 5, multi: true, opts: [
      ['Fork', {...plain, music: 'red'}, 'The tuning fork.'],
      ['Bars', {...plain, music: 'redbars', bandY: 'mid'}, 'Solid bars with a reflection.'],
      ['Blocks', {...plain, music: 'redblocks'}, 'Stepped columns; only the top of a chosen column turns red.'],
      ['Ridge', {...plain, music: 'ridge'}, 'Not a visualisation: the course as a mountain, inking as you ride. Tell me if it reads as a progress bar.']],
    moments: [['Petrunko 30 s', 30], ['Lua 36 s', 36.5, 'lua'], ['Near the end', 53]]},
  {id: 'height', ask: 'How high should the bars sit?', why: 'The middle ground you asked about. The reflection grows with the room it has and stops above the comments.',
    song: 'petrunko', t: 30, len: 4, opts: [
      ['Low', {...plain, music: 'bars3'}, 'Last round’s position.'],
      ['Middle', {...plain, music: 'bars3', bandY: 'mid'}, 'Between the two, with a longer reflection.'],
      ['High', {...plain, music: 'bars3', bandY: 'high'}, 'Close to today’s height.']],
    moments: [['Petrunko 30 s', 30], ['Los Voltaje 45 s', 45, 'los']]},
  {id: 'bg', ask: 'What should drive the background?', why: 'A tone now follows a continuous signal, not sections. Which one means “intensity” to you? Keep any number.',
    song: 'los', t: 19.5, len: 8, multi: true, opts: [
      ['White', {...plain}, 'For reference.'],
      ['Tone: impact', {...plain, bg: 'impact'}, 'Deeper when hits come faster and harder over the last few seconds.'],
      ['Tone: loudness', {...plain, bg: 'loud'}, 'Deeper when the music itself is fuller.'],
      ['Night', {...plain, bg: 'night'}, 'One hand-placed cue per song, picked from the spec’s own structure.']],
    moments: [['Los Voltaje', 19.5], ['Petrunko drop', 18, 'petrunko'], ['Let the World Burn', 1.5, 'burn'], ['No Batidão', 11, 'batidao']]},
  {id: 'ends', ask: 'How should a tiny rider read?', why: 'The opening and ending now work with any camera, and the rider stays in frame the whole way. The path line is gone.',
    song: 'petrunko', t: 0, len: 3, opts: [
      ['Larger rider', {...plain, ends: 'overture', tiny: 'token'}, 'The rider stays readable at any zoom and settles to true size.'],
      ['Ring', {...plain, ends: 'overture', tiny: 'ring'}, 'A ring that fades in as the view widens.'],
      ['As it is', {...plain, ends: 'overture', tiny: 'plain'}, 'No help: the true tiny rider.']],
    moments: [['Opening', 0], ['Ending', 'end'], ['Lua ending', 'end', 'lua']]},
];

// ── state ──────────────────────────────────────────────────────────────────
const q = new URLSearchParams(location.search);
const shot = q.has('shot');
const $ = id => document.getElementById(id);
const music = createMusic(), onScreen = displayTime();
let song = SONGS[q.get('song')] ? q.get('song') : 'petrunko';
let preset = PRESETS.find(p => p.id === q.get('c')) ?? PRESETS[0];
let mix = {...preset.mix};
for (const kv of (q.get('m') ?? '').split(',').filter(Boolean)) {const [k, v] = kv.split(':'); if (DIMS[k]?.[1][v]) mix[k] = v;}
let seconds = +(q.get('t') ?? 0) || 0, playing = false, S = null, loadId = 0;
const qmode = q.has('q');
let qi = Math.max(0, Math.min(QUESTIONS.length, +(q.get('q') || 1) - 1)), qopt = 0;
const STORE = 'concept-lab-answers-r3';
const answers = (() => {try {return JSON.parse(localStorage.getItem(STORE) ?? '{}');} catch {return {};}})();
const saveAnswers = () => {try {localStorage.setItem(STORE, JSON.stringify(answers));} catch {}};
const sheetPromise = N.loadSheet();
const paint = N.riderPainter();
const canvas = $('stage'), ctx = canvas.getContext('2d');
const overlay = document.createElement('canvas'), octx = overlay.getContext('2d');

// ── data preparation ───────────────────────────────────────────────────────
function replay(track, trace) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'});
    worker.onmessage = ({data}) => {worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data);};
    worker.onerror = e => {worker.terminate(); reject(new Error(e.message || 'replay failed'));};
    worker.postMessage({request: 1, track, trace});
  });
}
function riderAt(frames, at) {
  const c = Math.max(0, Math.min(at, frames.length - 1)), i = Math.floor(c), t = c - i;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  if (!t) return a;
  const m = (x, y) => x + (y - x) * t;
  return {points: a.points.map((p, j) => ({name: p.name, pos: {x: m(p.pos.x, b.points[j].pos.x), y: m(p.pos.y, b.points[j].pos.y)}})),
    framesSinceUnmount: m(a.framesSinceUnmount, b.framesSinceUnmount), framesSinceSledBreak: m(a.framesSinceSledBreak, b.framesSinceSledBreak),
    framesSinceStringDetached: m(a.framesSinceStringDetached, b.framesSinceStringDetached)};
}
const centreOf = f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = C.smoothstep;
/** How hard a hit reads, continuous in the measured strength: no tiers, no top-N. */
const power = C.strength;

function prepare(data, native) {
  const lines = data.track.lines.map(l => ({id: l.id, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, touch: Infinity}));
  const byId = new Map(lines.map(l => [l.id, l]));
  native.contacts.forEach((ids, f) => {for (const id of ids) {const l = byId.get(id); if (l && f < l.touch) l.touch = f;}});
  // connected rails: a rail inks up to the furthest point touched so far, so a used rail is solid behind the rider
  {
    const parent = lines.map((_, i) => i), find = i => {while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i;};
    // segments whose ends touch or nearly touch (dotted rails are runs of short pieces a few units apart) form one rail
    const GAP = 6, cells = new Map(), cell = (x, y) => Math.floor(x / GAP) + ',' + Math.floor(y / GAP);
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {const k = cell(x, y); if (!cells.has(k)) cells.set(k, []); cells.get(k).push([x, y, i]);}});
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
      const gx = Math.floor(x / GAP), gy = Math.floor(y / GAP);
      for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) for (const [px, py, j] of cells.get(a + ',' + b) ?? [])
        if (j !== i && (px - x) ** 2 + (py - y) ** 2 < GAP * GAP) parent[find(i)] = find(j);
    }});
    const chains = new Map(); lines.forEach((l, i) => {const r = find(i); l.chain = r; if (!chains.has(r)) chains.set(r, []); chains.get(r).push(l);});
    for (const chain of chains.values()) {
      chain.sort((a, b) => (a.x1 + a.x2) - (b.x1 + b.x2));
      let m = Infinity; for (let i = chain.length - 1; i >= 0; i--) {m = Math.min(m, chain[i].touch); chain[i].ink = m;}
    }
  }
  const G = 400, grid = new Map();
  for (const l of lines) {
    for (let gx = Math.floor(Math.min(l.x1, l.x2) / G); gx <= Math.floor(Math.max(l.x1, l.x2) / G); gx++)
      for (let gy = Math.floor(Math.min(l.y1, l.y2) / G); gy <= Math.floor(Math.max(l.y1, l.y2) / G); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l);
      }
  }
  const centres = data.trace.frames.map(centreOf);
  // where each hit happened: the touched line nearest the body, its normal on the rider's side
  const hits = data.hits.map(h => {
    const f0 = Math.round(h.t * FPS); let pos = null, ang = 0, line = null, nrm = {x: 0, y: -1}, best = Infinity;
    for (let f = f0 - 2; f <= f0 + 4 && !pos; f++) {
      const ids = native.contacts[f] ?? []; if (!ids.length) continue;
      const c = centres[Math.min(f, centres.length - 1)];
      for (const id of ids) {
        const l = byId.get(id); if (!l) continue;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2));
        const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) {
          best = d; pos = p; ang = Math.atan2(dy, dx); line = l;
          const L = Math.sqrt(L2) || 1; let nx = -dy / L, ny = dx / L;
          if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) {nx = -nx; ny = -ny;}
          nrm = {x: nx, y: ny};
        }
      }
    }
    let fc = null;
    for (let f = f0 + 1; f >= f0 - 6; f--) {if (native.contacts[f]?.length) fc = f; else if (fc !== null) break;}
    const ca = centres[Math.max(0, f0 - 2)], cb = centres[Math.min(centres.length - 1, f0)];
    return {...h, tc: fc === null ? h.t : Math.min(h.t, fc / FPS), pos: pos ?? centres[Math.min(f0, centres.length - 1)], ang, nrm, chain: line?.chain, I: power(h.s), vel: {x: cb.x - ca.x, y: cb.y - ca.y}};
  });
  const R = C.rideSignals(centres, native.contacts, hits, data.phases, data.duration);
  // the whole-course view frames the ride itself (rails reaching past it may crop), with a margin
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  x0 -= 80; x1 += 80; y0 -= 80; y1 += 80;
  // tone signals, smoothed by what the data supports: σ = 2 s swings about 3 times a minute (σ = 1 s swings 9 times)
  const n = centres.length, norm = a => {const s = [...a].sort((x, y) => x - y), lo = s[Math.floor(0.1 * n)], hi = s[Math.floor(0.99 * n)]; return a.map(v => clamp((v - lo) / Math.max(1e-6, hi - lo), 0, 1));};
  const gaussian = (a, sig) => {const r = Math.ceil(3 * sig), k = []; for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * sig * sig))); const w = k.reduce((x, y) => x + y); return a.map((_, f) => {let s = 0; for (let i = -r; i <= r; i++) s += a[clamp(f + i, 0, n - 1)] * k[i + r]; return s / w;});};
  const imp = new Array(n).fill(0); for (const h of hits) {const f = clamp(Math.round(h.tc * FPS), 0, n - 1); imp[f] += (0.5 + h.s) * FPS;}
  const lou = Array.from({length: n}, (_, f) => {const i = clamp(Math.round(f / FPS * data.spectrum.fps), 0, data.spectrum.frames.length - 1), row = data.spectrum.frames[i]; return row.reduce((x, y) => x + y, 0) / row.length;});
  const tone = {impact: norm(gaussian(imp, 2 * FPS)), loud: norm(gaussian(lou, 2 * FPS))};
  // the night cue, snapped to the strongest hit within 0.4 s of it
  let night = null; const cue = NIGHTS[data.key];
  if (cue) {const near = hits.filter(h => Math.abs(h.tc - cue[0]) < 0.4), s = near.reduce((a, b) => (!a || b.s > a.s ? b : a), null); const exit = hits.filter(h => Math.abs(h.tc - cue[1]) < 0.8).reduce((a, b) => (!a || b.s > a.s ? b : a), null); night = [s ? s.tc : cue[0], exit ? exit.tc : cue[1]];}
  const red = redLogic(data.spectrum, hits);
  const ridge = ridgeOf(centres, hits);
  return {...data, red, ridge, frames: native.frames, lines, grid, G, centres, R, hits, bbox: {x0, y0, x1, y1}, tone, night,
    follow: N.follower(data.trace.frames), cams: new Map()};
}

// One red: which stems are red. Red is never added; a few existing elements become red, and the logic picks who.
function redLogic(sp, hits) {
  const n = sp.bands, T = sp.frames.length, p95 = Array.from({length: n}, (_, b) => {const s = sp.frames.map(r => r[b]).sort((a, c) => a - c); return Math.max(0.05, s[Math.floor(0.95 * (T - 1))]);});
  const wh = i => sp.frames[clamp(i, 0, T - 1)].map((v, b) => v / p95[b]);
  const top = (arr, k) => arr.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  const flux = t => {const i = Math.round(t * sp.fps), a = wh(i + 1), b = wh(i - 2); return a.map((v, j) => v - b[j]);};
  // standing: red holds on the stems of the last champion hit; only a clearly stronger hit (×1.3, against an 8 s decay) moves it
  const champs = []; {let c = 0, t0 = 0; for (const h of hits) {const cur = c * Math.exp(-(h.tc - t0) / 8); if (h.I > 1.3 * cur) {c = h.I; t0 = h.tc; champs.push({t: h.tc, set: top(flux(h.tc), 3)});}}}
  // struck: 1–5 stems light at each hit, for 0.10–0.24 s
  const struck = hits.map(h => ({t: h.tc, end: h.tc + 0.1 + 0.14 * h.I, set: top(flux(h.tc), 1 + Math.round(4 * h.I))}));
  // three registers: each third of the band keeps one red, its loudest whitened band, with hysteresis
  const regs = []; {const cur = [0, 0, 0].map((_, r) => Math.floor((r + 0.5) * n / 3)), since = [0, 0, 0];
    for (let i = 0; i < T; i++) {const w = wh(i); for (let r = 0; r < 3; r++) {let best = cur[r]; const a = Math.floor(r * n / 3), b = Math.floor((r + 1) * n / 3); for (let j = a; j < b; j++) if (w[j] > w[best]) best = j;
      if (best !== cur[r] && w[best] > 1.15 * w[cur[r]] && (i - since[r]) / sp.fps >= 0.1) {cur[r] = best; since[r] = i;}} regs.push([...cur]);}}
  return {champs, struck, regs};
}
function redAt(t, row) {
  const L = S.red, top = k => row.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  if (mix.redBy === 'standing') {let c = null; for (const x of L.champs) {if (x.t > t) break; c = x;} return new Set(c ? c.set : []);}
  if (mix.redBy === 'struck') {const s = new Set(); for (const x of L.struck) {if (x.t > t) break; if (t < x.end) x.set.forEach(b => s.add(b));} return s;}
  if (mix.redBy === 'registers') return new Set(L.regs[clamp(Math.round(t * S.spectrum.fps), 0, L.regs.length - 1)]);
  if (mix.redBy === 'heat') {let h = 0; for (const x of S.hits) {if (x.tc > t) break; h += x.I * Math.exp(-(t - x.tc) / 0.8);} return new Set(top(Math.floor(clamp(6 * h / 1.47, 0, 6))));}
  return new Set(top(3).filter(b => row[b] > 0.25));
}
// The Ridge: the course rotated flat and filled, with every hit cut out of it as a slit. It inks as the rider goes.
function ridgeOf(centres, hits) {
  const n = centres.length, mx = centres.reduce((a, p) => a + p.x, 0) / n, my = centres.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0; for (const p of centres) {sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my);}
  const a = sxy / sxx, det = centres.map(p => p.y - (my + a * (p.x - mx))), lo = Math.min(...det), hi = Math.max(...det), x0 = centres[0].x, x1 = centres.at(-1).x;
  const U = W, us = new Float64Array(U + 1).fill(0.5); let f = 0;
  for (let u = 0; u <= U; u++) {const x = x0 + (x1 - x0) * u / U; while (f + 1 < n && centres[f + 1].x < x) f++; us[u] = (det[f] - lo) / Math.max(1, hi - lo);}
  const uOf = t => {const p = centres[clamp(Math.round(t * FPS), 0, n - 1)]; return U * clamp((p.x - x0) / (x1 - x0), 0, 1);};
  const slits = hits.filter(h => h.I >= 0.5).map(h => ({u: uOf(h.tc), t: h.tc, w: 2 + 4 * h.I, end: h.tc + 0.14 + 0.16 * h.I}));
  const all = hits.map(h => ({u: uOf(h.tc), t: h.tc, e: h.I, w: 3 + 5 * h.I, w2: 2 + 10 * h.I}));
  const R = 6 * FPS, ker = []; for (let k = -2 * R; k <= 2 * R; k++) ker.push(Math.exp(-k * k / (2 * R * R)));
  const alt = centres.map(p => -p.y), low = alt.map((_, f) => {let s = 0, w = 0; for (let k = -2 * R; k <= 2 * R; k += 4) {const v = alt[clamp(f + k, 0, n - 1)], e = ker[k + 2 * R]; s += v * e; w += e;} return s / w;});
  const rs = alt.map((v, f) => v - low[f]), a0 = Math.min(...rs), a1 = Math.max(...rs), local = rs.map(v => (v - a0) / Math.max(1, a1 - a0));
  return {us, uOf, slits, all, local};
}
function drawRidge(t, alpha, th) {
  const r = S.ridge, base = 0.825 * H, mass = th.dark ? P.ni : P.mass, pale = mixHex(th.bg, mass, 0.16);
  const tilted = RV === 'level' || RV === 'descent';
  const top = u => tilted ? base - 26 - 105 * (1 - r.us[u]) - 155 * (1 - u / W) : base - 40 - 170 * (1 - r.us[u]);
  const shape = () => {ctx.beginPath(); ctx.moveTo(0, base); for (let u = 0; u <= W; u += 2) ctx.lineTo(u, top(u)); ctx.lineTo(W, top(W)); ctx.lineTo(W, base); ctx.closePath();};
  ctx.save(); ctx.globalAlpha = alpha;
  const front = r.uOf(t);
  const ticks = (col, list) => {ctx.fillStyle = col; for (const s of list) {const c = base - top(Math.round(s.u)), h = (0.22 + 0.5 * s.e) * c; ctx.fillRect(s.u - s.w / 2, base - h, s.w, h + 1);}};
  if (RV === 'level') {
    // the level falls with the rider's real altitude: what is above it has been descended (ink), below is still ahead (pale)
    shape(); ctx.fillStyle = pale; ctx.fill();
    const cs = S.centres, y0 = cs[0].y, yN = Math.max(...cs.map(p => p.y)); let rec = y0; for (let f = 0, e = Math.min(cs.length - 1, Math.round(t * FPS)); f <= e; f++) rec = Math.max(rec, cs[f].y);
    let hi = base; for (let u = 0; u <= W; u += 4) hi = Math.min(hi, top(u)); const lv = hi + (base + 2 - hi) * (rec - y0) / (yN - y0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, lv); ctx.clip(); shape(); ctx.fillStyle = mass; ctx.fill(); ctx.restore();
    } else if (RV === 'struck') {
    shape(); ctx.fillStyle = pale; ctx.fill();
    ctx.save(); shape(); ctx.clip(); ctx.fillStyle = mass;
    for (const s of r.all) if (s.t <= t) ctx.fillRect(s.u - s.w2 / 2, base - 400, s.w2, 402);
    ctx.fillStyle = P.accent; for (const s of r.all) {const age = t - s.t, wx = Math.pow(s.e, 2.2); if (age >= 0 && age < 0.25 && held(age, wx) > 0.15) ctx.fillRect(s.u - Math.max(8, s.w2) / 2, base - 400, Math.max(8, s.w2), 402);}
    ctx.restore();
  } else if (RV === 'horizon') {
    // the terrain scrolls under a fixed boundary below the rider; rate is a true fraction of the rider's own speed
    const px = 150, bx = 0.62 * W, A = r.local, n = A.length, y = x => {const f = (t + (x - bx) / px) * FPS, i = clamp(Math.round(f), 0, n - 1); return base - 40 - 190 * A[i];};
    const path = (a, b) => {ctx.beginPath(); ctx.moveTo(a, base); for (let x = a; x <= b; x += 2) ctx.lineTo(x, y(x)); ctx.lineTo(b, y(b)); ctx.lineTo(b, base); ctx.closePath();};
    path(bx, W); ctx.fillStyle = pale; ctx.fill(); path(0, bx); ctx.fillStyle = mass; ctx.fill();
    ctx.fillStyle = th.bg; for (const s of r.all) {const x = bx + (s.t - t) * px; if (x < -5 || x > W + 5) continue; const c = base - y(x), h = (0.22 + 0.5 * s.e) * c; ctx.fillRect(x - s.w / 2, base - h, s.w, h + 1);}
  } else {
    shape(); ctx.fillStyle = pale; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, front, H); ctx.clip(); shape(); ctx.fillStyle = mass; ctx.fill(); ctx.restore();
    ctx.fillStyle = th.bg; for (const s of r.slits) ctx.fillRect(s.u - s.w / 2, top(Math.round(s.u)) - 2, s.w, base - top(Math.round(s.u)) + 4);
    ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(front, top(Math.round(front)), 9, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.restore();
}

// ── camera ─────────────────────────────────────────────────────────────────
function camFrames(m) {
  const key = m.size + '|' + m.place + '|' + m.tide;
  if (!S.cams.has(key)) {
    const z = m.size === 'today' ? Z0 : SIZE_Z[m.size]; let cam;
    if (m.size === 'today' || m.place === 'official') cam = S.centres.map((_, f) => {const c = S.follow({w: W, h: H, z}, f); return {z, ax: W / 2, ay: 0.35 * H, x: c.x, y: c.y};});
    else cam = C.buildPlaced(S.R, {base: z, place: m.place, tide: m.tide});
    S.cams.set(key, cam);
  }
  return S.cams.get(key);
}
function cameraAt(m, at) {
  const cam = camFrames(m), i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
  const l = (p, q) => p + (q - p) * u;
  return {z: l(a.z, b.z), ax: l(a.ax, b.ax), ay: l(a.ay, b.ay), x: l(a.x, b.x), y: l(a.y, b.y)};
}
const riderPoint = at => {const c = S.centres, i = clamp(Math.floor(at), 0, c.length - 1), j = Math.min(i + 1, c.length - 1), u = clamp(at - i, 0, 1); return {x: c[i].x + (c[j].x - c[i].x) * u, y: c[i].y + (c[j].y - c[i].y) * u};};
// Whole-course opening and ending, for ANY camera: a view is (the rider's screen point, ln zoom). The overview and the
// camera both keep the rider in frame, so every blend of the two does too, by construction. Nothing here knows the camera.
function bookend(t, c, at) {
  const R = riderPoint(at), p = {x: c.ax + (R.x - c.x) * c.z, y: c.ay + (R.y - c.y) * c.z};
  const view = {...c, rx: p.x, ry: p.y, R, over: 0, ending: false};
  if (mix.ends !== 'overture') return view;
  const b = S.bbox, zo = Math.min(0.78 * W / (b.x1 - b.x0), 0.5 * H / (b.y1 - b.y0)), o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2};
  const t1 = Math.min(2.2, S.hits.find(h => h.tc >= 1.3)?.tc ?? 1.6), tE = S.duration - 3;
  let u = 1;
  if (t < t1) u = smoothstep((t - 0.25) / (t1 - 0.25));
  else if (t > tE) u = 1 - smoothstep((t - tE) / 2.6);
  if (u >= 1) return view;
  const q = {x: W / 2 + (R.x - o.x) * zo, y: 0.4 * H + (R.y - o.y) * zo}, rx = q.x + (p.x - q.x) * u, ry = q.y + (p.y - q.y) * u;
  return {z: Math.exp(Math.log(zo) + (Math.log(c.z) - Math.log(zo)) * u), ax: rx, ay: ry, x: R.x, y: R.y, rx, ry, R, over: 1 - u, ending: t > tE};
}

// ── hit effects ────────────────────────────────────────────────────────────
// One absolute strength curve (C.strength, 0..1) drives every accent; nothing is ranked or tiered.
// Every accent peaks on the first frame at or after the contact onset and decays as exp(−age/τ),
// τ = τ0·(0.8 + 0.4e). Directions come from the struck line: î points into the line, from the rider's side.
const BUNDLES = {
  none: {}, shake: {today: 1},
  refined: {kick: 1, split: 1, flash: 1},                        // today's spirit, every part with a direction
  strong: {kick: 1, split: 1, flash: 1, held: 1},                // the same, with strength read as duration
  clean: {kick: 1, split: 1, flash: 1, held: 1, cleanRider: 1},  // the world tears, the rider stays sharp
  trail: {kick: 0.6, trail: 1},                                  // discreet: all the fringe falls beyond the line
  shade: {kick: 0.7, shade: 1, held: 1},                         // the struck line divides the frame
};
// Strength as duration: the excess strength w = e^2.2 sets both amplitude and hold. The peak is held at least one full
// 60 fps frame (no hit loses its peak to the frame grid); recovery ends exactly, never later than 0.25 s.
const excess = e => Math.pow(e, 2.2);
const held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
const acc = () => BUNDLES[mix.hit] ?? {};
const decay = (age, tau0, e) => age < 0 ? 0 : Math.exp(-age / (tau0 * (0.8 + 0.4 * e)));
function activeHits(t, span) {
  const out = [];
  for (const h of S.hits) {if (h.tc > t + 0.001) break; const age = t - h.tc; if (age <= span) out.push({h, age, e: h.I});}
  return out;
}
const into = h => ({x: -h.nrm.x, y: -h.nrm.y});
/** Camera-level response to hits: a screen offset (px). */
function hitCamera(t) {
  const A = acc(); let dx = 0, dy = 0;
  if (A.today) {
    const m = trauma(t, {min: 0.22, gain: 1.6, decay: 7, power: 1.5}), w = 2 * Math.PI * 9;
    return {dx: 10 * m * Math.sin(w * t), dy: 10 * m * Math.sin(w * 1.37 * t + 1.7)};
  }
  for (const {h, age, e} of activeHits(t, 0.6)) {
    const i = into(h);
    const w = excess(e);
    if (A.kick) {const a = A.kick * (A.held ? (10 + 26 * w) * held(age, w) : (6 + 20 * e) * decay(age, 0.075, e)); dx += i.x * a; dy += i.y * a;}
  }
  const n = Math.hypot(dx, dy), cap = A.held ? 36 : 28; if (n > cap) {dx *= cap / n; dy *= cap / n;}
  return {dx, dy};
}

// ── drawing ────────────────────────────────────────────────────────────────
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('');};
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const colourOf = h => SRC[h.src] ?? SRC.other;

// Background: plain, a tone following a continuous signal, or night on the song's one optional cue.
function themeAt(t, at) {
  const lit = bg => ({bg: bg === '#ffffff' ? P.paper : bg, ink: P.ink, pencil: P.pencil, dark: 0});
  if (mix.bg === 'white') return lit('#ffffff');
  if (mix.bg === 'porcelain') return lit('#f4f6f9');
  if (mix.bg === 'impact' || mix.bg === 'loud') {const v = S.tone[mix.bg], i = clamp(Math.round(at), 0, v.length - 1); return lit(mixHex('#ffffff', '#e3e8f0', v[i]));}
  return S.night && t >= S.night[0] && t < S.night[1] ? {bg: P.np, ink: P.ni, pencil: mixHex(P.np, P.ni, 0.38), dark: 1} : lit('#ffffff');
}

function visibleLines(c) {
  const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
  const seen = new Set();
  for (let gx = Math.floor(x0 / S.G); gx <= Math.floor(x1 / S.G); gx++)
    for (let gy = Math.floor(y0 / S.G); gy <= Math.floor(y1 / S.G); gy++)
      for (const l of S.grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
  return out;
}
let darkNow = 0, overNow = 0; // night amount; how far into the whole-course view we are (0–1)
function inkFront(t, at) {let fr = at; if (HITX !== 'inkahead') return at; for (const h of S.hits) {if (h.tc > t + 0.001) break; if (t - h.tc > 0.6) continue; const w = excess(h.I); fr = Math.max(fr, (h.tc + 0.06 + 0.24 * w) * FPS);} return fr;}
function drawLines(lines, at0, z, th) {
  const at = inkFront(at0 / FPS, at0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = filter => {ctx.beginPath(); for (const l of lines) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
  const ink = Math.max(2, 3.6 / z);
  if (mix.ink === 'ink') {path(() => true); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke(); return;}
  path(l => l.ink > at); ctx.strokeStyle = overNow > 0.02 ? mixHex(th.pencil, th.ink, 0.25 * overNow) : th.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * overNow) / z); ctx.stroke();
  path(l => l.ink <= at); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();
}
function riderCamera(v, ox, oy, k) {
  // the rider stays on its own screen point at any size; 'token' keeps it readable on the whole-course view
  const zr = mix.tiny === 'token' && v.over > 0 ? Math.cbrt(v.z ** 3 + 2.6 ** 3) : v.z, px = v.rx + ox, py = v.ry + oy;
  return {x: v.R.x + (W / 2 - px) / zr, y: v.R.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
}
function drawRider(sheet, rc, at, M = [1, 0, 0, 1, 0, 0]) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  paint(octx, rc, sheet, riderAt(S.frames, at), at);
  ctx.setTransform(...M); ctx.drawImage(overlay, 0, 0);
}
function spectrumRow(t) {
  const sp = S.spectrum, x = clamp(t * sp.fps, 0, sp.frames.length - 1), i = Math.floor(x), j = Math.min(i + 1, sp.frames.length - 1), u = x - i;
  return sp.frames[i].map((v, b) => v + (sp.frames[j][b] - v) * u);
}
function drawBars(t, a = 1) {
  const row = spectrumRow(t), n = row.length, gap = 3, bw = (W - gap * (n - 1)) / n, base = 0.73 * H, max = 0.17 * H;
  const ramp = ['#38d6c8', '#6ad36a', '#f0b429', '#ff5a4f'], stops = [0, .4, .7, 1];
  const col = u => {let s = 0; while (s < 2 && u > stops[s + 1]) s++; return mixHex(ramp[s], ramp[s + 1], (u - stops[s]) / (stops[s + 1] - stops[s]));};
  row.forEach((v, b) => {
    const h = Math.max(2, v * max), x = b * (bw + gap); ctx.fillStyle = col(b / (n - 1));
    ctx.globalAlpha = 0.95 * a; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = 0.42 * a; ctx.fillRect(x, base, bw, h);
  });
  ctx.globalAlpha = 1;
}
function smoothPath(pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);}
  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
}
// The lower band sits between the ride and the Shorts comments (which start near 0.85 H).
const bandShift = () => ({low: 0, mid: -0.03 * H, high: -0.07 * H}[mix.bandY] ?? 0);
function drawSpectrum(t, form, alpha, th) {
  ctx.save(); ctx.translate(0, bandShift());
  const row = spectrumRow(t), n = row.length, step = W / n, lit = c => th.dark ? mixHex(c, '#ffffff', 0.62 * th.dark) : c;
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const third = i => Math.min(2, Math.floor(i / n * 3));
  const RED = P.accent, graphite = th.dark ? P.ni : P.mass;
  if (form === 'red') {
    // One red: graphite stems; the chosen logic turns a few dots the scarf's red (solid, ≥ 4 px: colour survives only in masses)
    const base = 0.825 * H, hgt = 0.15 * H, r = 7, hot = redAt(t, row);
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, on = hot.has(i);
      ctx.strokeStyle = mixHex(th.bg, graphite, 0.42); ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.7; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = on ? RED : graphite; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, on ? r + 2 : r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'redblocks') {
    // graphite blocks; only the top lit cell of a chosen column turns red
    const base = 0.81 * H, hgt = 0.15 * H, cell = hgt / 16, bw = step * 0.58, hot = redAt(t, row);
    row.forEach((v, i) => {
      const c = Math.floor(v * 16); if (!c) return; const x = (i + .5) * step - bw / 2, h = c * cell;
      ctx.fillStyle = graphite; ctx.globalAlpha = alpha * 0.85; ctx.fillRect(x, base - h, bw, h);
      if (hot.has(i)) {ctx.fillStyle = RED; ctx.globalAlpha = alpha; ctx.fillRect(x, base - h, bw, Math.max(cell * 2, 8));}
    });
  } else if (form === 'redbars') {
    // graphite bars with a reflection; a chosen bar turns solid red
    const base = 0.80 * H, hgt = 0.15 * H, bw = step * 0.8, room = 0.853 * H - (base + bandShift()) - 6, hot = redAt(t, row);
    row.forEach((v, i) => {
      const h = Math.max(2, v * hgt), x = (i + .5) * step - bw / 2; ctx.fillStyle = hot.has(i) ? RED : graphite;
      ctx.globalAlpha = alpha * 0.92; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = alpha * 0.28; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));
    });
  } else if (form === 'stems') {
    const base = 0.825 * H, hgt = 0.15 * H, pal = ['#328ca0', '#7787b7', '#c47a85'], r = 7;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, c = lit(pal[third(i)]);
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = c; ctx.globalAlpha = alpha * 0.92; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'bars3' || form === 'blocks') {
    // Codex's three-colour bars (Porcelain mirror) and quantized blocks (Electric registration)
    const base = 0.80 * H, hgt = 0.15 * H, blocks = form === 'blocks';
    const pal = blocks ? ['#489ca5', '#8376b5', '#b572a1'] : ['#66a7ac', '#8b99be', '#c095a3'];
    const bw = step * (blocks ? 0.58 : 0.8), room = 0.853 * H - (base + bandShift()) - 6; // the reflection stops above the comment bubble
    row.forEach((v, i) => {
      const h = blocks ? Math.floor(v * 16) / 16 * hgt : Math.max(2, v * hgt); if (!h) return;
      const x = (i + .5) * step - bw / 2; ctx.fillStyle = lit(pal[third(i)]);
      ctx.globalAlpha = alpha * (blocks ? 0.8 : 0.92); ctx.beginPath(); ctx.roundRect(x, base - h, bw, h, Math.min(2, bw / 4)); ctx.fill();
      if (!blocks) {ctx.globalAlpha = alpha * 0.32; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));}
    });
  } else if (form === 'slits') {
    const base = 0.82 * H, hgt = 0.14 * H;
    ctx.strokeStyle = lit('#315ca4'); ctx.lineWidth = 3.6; ctx.beginPath();
    row.forEach((v, i) => {if (v <= 0) return; const c = (i + .5) * step, half = step * .26, top = base - v * hgt;
      ctx.moveTo(c - half, base); ctx.lineTo(c - half, top); ctx.lineTo(c + half, top); ctx.lineTo(c + half, base);});
    ctx.stroke();
  } else if (form === 'iris') {
    const base = 0.82 * H, hgt = 0.14 * H;
    const contour = (vals, dy) => {const pts = vals.map((v, i) => ({x: -10 + (W + 20) * i / (n - 1), y: base - v * hgt * 0.72 + dy})); ctx.beginPath(); smoothPath(pts);};
    [.06, .12, .18, .24, .3, .36, .42].map((age, i) => ({age, i})).reverse().forEach(({age, i}) => {
      if (t < age) return; contour(spectrumRow(t - age), hgt * .04 * (i + 1));
      ctx.strokeStyle = lit('#8f86c9'); ctx.lineWidth = 2.6; ctx.globalAlpha = alpha * (.42 - i * .032); ctx.stroke();
    });
    contour(row, 0); ctx.strokeStyle = lit('#2f3a74'); ctx.lineWidth = 3.8; ctx.globalAlpha = alpha * .92; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
// Today's shipped accents, from scripts/fx_recipe.ts LOCKED_FX, keyed like production (overlay hit time).
const trauma = (t, c) => {let x = 0; for (const h of S.hits) {if (h.t > t) break; if (h.s < c.min) continue; x += h.s * c.gain * Math.exp(-(t - h.t) * c.decay);} return Math.pow(Math.min(1, x), c.power);};
const chan = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
function channelSplit(ox, oy, mode = 'centre') {
  // red one way, blue the other, green in place ('trail': red at d, green at d/2, blue in place); overscan hides the edges
  const [src, ...rgb] = chan, w = canvas.width, h = canvas.height;
  for (const c of chan) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
  src.getContext('2d').drawImage(canvas, 0, 0);
  ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => {const g = rgb[i].getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, w, h);});
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
  const m = Math.ceil(Math.hypot(ox, oy)) + 2, o = (c, dx, dy) => ctx.drawImage(c, dx - m, dy - m * h / w, w + 2 * m, h + 2 * m * h / w);
  if (mode === 'trail') {o(rgb[0], ox, oy); o(rgb[1], ox / 2, oy / 2); o(rgb[2], 0, 0);}
  else {o(rgb[0], ox, oy); o(rgb[1], 0, 0); o(rgb[2], -ox, -oy);}
  ctx.globalCompositeOperation = 'source-over';
}
function worldSplit(t, k) {
  const A = acc(); if (!(A.split || A.trail)) return;
  let ox = 0, oy = 0;
  for (const {h, age, e} of activeHits(t, 0.6)) {const w = excess(e), a = A.held ? (2 + 16 * w) * held(age, w) : (2 + 12 * e) * decay(age, 0.06, e), i = into(h); ox += i.x * a; oy += i.y * a;}
  const n = Math.hypot(ox, oy), cap = A.held ? 18 : 14; if (n > cap) {ox *= cap / n; oy *= cap / n;}
  if (Math.hypot(ox, oy) * k > 1) channelSplit(ox * k, oy * k, A.trail ? 'trail' : 'centre');
}
function postAccents(t, k, v, ox, oy) {
  const A = acc();
  if (A.today) {
    const split = 14 * trauma(t, {min: 0.25, gain: 2.0, decay: 7, power: 1.4}) * k;
    if (split > 0.5) channelSplit(split, 0);
    const flash = 0.3 * trauma(t, {min: 0.3, gain: 1.8, decay: 12, power: 1});
    if (flash > 0.003) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
    return;
  }
  if (!A.cleanRider) worldSplit(t, k);
  const hits = Object.keys(A).length ? activeHits(t, 0.6) : [];
  if (A.shade) {
    // everything beyond the struck line drops in tone, with a razor edge along the line; the rider's side stays paper
    for (const {h, age, e} of hits) {
      const w = excess(e); if (w < 0.25) continue; const a = A.shade * (0.04 + 0.26 * w) * held(age, w) * (1 - v.over); if (a < 0.004) continue;
      const i = into(h), Px = (v.ax + ox + (h.pos.x - v.x) * v.z) * k, Py = (v.ay + oy + (h.pos.y - v.y) * v.z) * k, tx = -i.y, ty = i.x, F = 6000;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath();
      ctx.moveTo(Px - tx * F, Py - ty * F); ctx.lineTo(Px + tx * F, Py + ty * F); ctx.lineTo(Px + tx * F + i.x * F, Py + ty * F + i.y * F); ctx.lineTo(Px - tx * F + i.x * F, Py - ty * F + i.y * F); ctx.closePath(); ctx.clip();
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a; ctx.fillStyle = mixHex('#787e88', '#d3262e', w * w); ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
  }
  if (A.flash) {
    let f = 0; for (const {age, e} of hits) {const w = excess(e); f = Math.max(f, A.held ? (0.1 + 0.2 * w) * held(age, w) : A.flash * (0.1 + 0.18 * e) * decay(age, 0.05, e));}
    f *= 1 - 0.6 * darkNow; // on night the flash would only grey the black
    if (f > 0.004) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
  }
}
function drawMarker(v, ox, oy, th) {
  // a ring keeps the rider findable on the whole-course view; it fades in early and progressively as the view widens
  const a = smoothstep((v.over - 0.06) / 0.5); if (a <= 0) return;
  ctx.globalAlpha = a; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(v.rx + ox, v.ry + oy, 22, 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
}

async function draw() {
  if (!S || !canvas.width || !canvas.height) return;
  const sheet = await sheetPromise, t = seconds, at = clamp(t * FPS, 0, S.frames.length - 1), k = canvas.width / W;
  const th = themeAt(t, at), v = bookend(t, cameraAt(mix, at), at), hc = hitCamera(t);
  overNow = v.over; darkNow = th.dark;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const band = (1 - v.over) ** 2;
  if (band > 0.003 && ['red', 'redblocks', 'redbars', 'stems', 'iris', 'slits', 'bars3', 'blocks'].includes(mix.music)) drawSpectrum(t, mix.music, band, th);
  if (mix.music === 'ridge') {const a = v.ending ? 1 : band; if (a > 0.003) drawRidge(t, a, th);} // the finished silhouette holds through the ending
  const cc = {...v, ax: v.ax + hc.dx, ay: v.ay + hc.dy};
  ctx.setTransform(cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k);
  drawLines(visibleLines(cc), at, cc.z, th);
  if (HITX === 'ghost') {
    if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
    for (const h of S.hits) {if (h.tc > t + 0.001) break; const age = t - h.tc, w = excess(h.I), life = 0.12 + 0.2 * w; if (age > life) continue;
      paint(octx, riderCamera(v, hc.dx, hc.dy, k), sheet, riderAt(S.frames, h.tc * FPS), h.tc * FPS);
      octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = mixHex(mixHex(th.bg, th.ink, 0.3), P.accent, smoothstep((h.I - 0.2) / 0.5)); octx.fillRect(0, 0, overlay.width, overlay.height); octx.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.pow(1 - age / life, 0.6); ctx.drawImage(overlay, 0, 0); ctx.restore();}
  }
  if (acc().cleanRider) worldSplit(t, k); // the world tears around a rider that stays sharp
  drawRider(sheet, riderCamera(v, hc.dx, hc.dy, k), at);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (v.over > 0.02 && mix.tiny === 'ring') drawMarker(v, hc.dx, hc.dy, th);
  if (mix.music === 'bars' && band > 0.003) drawBars(t, band);
  postAccents(t, k, v, hc.dx, hc.dy);
}

// ── loading, transport, UI ─────────────────────────────────────────────────
async function loadSong(key) {
  const id = ++loadId; song = key; S = null; status('Loading ' + SONGS[key] + '…');
  const data = await (await fetch(`../../../data/${key}.json`)).json();
  const [native] = await Promise.all([replay(data.track, data.trace), shot ? null : music.load(data.audio).catch(() => null)]);
  if (id !== loadId) return;
  S = prepare(data, native); window.__native = native;
  $('seek').max = S.duration; seconds = Math.min(seconds, S.duration);
  status(''); renderUI(); await draw();
  if (shot) {window.__S = S; window.__ready = true; window.__duration = S.duration; window.__audio = S.audio;
    window.__renderAt = async t => {seconds = t; await draw(); return canvas.toDataURL('image/png');};}
}
function moments() {
  const dens = S.R.sect.filter(s => s.t1 - s.t0 > 2);
  const quiet = dens.reduce((a, b) => b.density < a.density ? b : a), dense = dens.reduce((a, b) => b.density > a.density ? b : a);
  const big = S.hits.reduce((a, b) => b.s > a.s ? b : a), change = S.phases[Math.min(S.phases.length - 1, Math.floor(S.phases.length / 2))];
  return [['Opening', 0], ['Quiet · ' + quiet.name.toLowerCase(), quiet.t0 + 0.3], ['Dense · ' + dense.name.toLowerCase(), dense.t0 + 0.3],
    ['Section change', Math.max(0, change.t0 - 1.5)], ['Strongest hit', Math.max(0, big.tc - 1.2)], ['Ending', Math.max(0, S.duration - 4)]];
}
let loop = null, loopLen = 4;
function status(text) {const s = $('status'); if (s) s.textContent = text;}
function fmt(t) {return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;}
function sync() {
  $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(S?.duration ?? 0);
  const url = new URL(location.href); if (qmode) {url.searchParams.set('q', String(qi + 1)); history.replaceState(null, '', url); return;} url.searchParams.set('song', song); url.searchParams.set('c', preset.id); url.searchParams.set('t', seconds.toFixed(2));
  const diff = Object.keys(mix).filter(d => mix[d] !== preset.mix[d]).map(d => d + ':' + mix[d]);
  diff.length ? url.searchParams.set('m', diff.join(',')) : url.searchParams.delete('m');
  history.replaceState(null, '', url);
}
async function play() {
  if (!S) return; if (seconds >= S.duration - 0.05) seconds = 0;
  $('play').textContent = 'Pause'; $('play').classList.add('on');
  try {await music.play(seconds, 1); playing = music.playing;} catch {playing = false;}
  if (!playing) {$('play').textContent = 'Play'; $('play').classList.remove('on');}
}
function pause() {if (playing) seconds = music.pause(); else music.pause(); playing = false; $('play').textContent = 'Play'; $('play').classList.remove('on'); sync();}
function seek(t) {const resume = playing; if (resume) pause(); seconds = clamp(t, 0, S?.duration ?? 0); draw(); sync(); if (resume) play();}
function qStart(question) {
  if (typeof question.t === 'number') return question.t;
  if (question.t === 'strongest') {const big = S.hits.reduce((a, b) => b.s > a.s ? b : a); return Math.max(0, big.tc - 1.6);}
  return 0;
}
async function goQuestion(i) {
  pause(); qi = i; qopt = 0; scrollTo(0, 0);
  if (qi >= QUESTIONS.length) {renderQuestion(); return;}
  const Q = QUESTIONS[qi]; mix = {...Q.opts[0][1]};
  if (song !== Q.song) {await loadSong(Q.song);}
  loop = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); $('loop').textContent = `Loop ${loopLen} s`; seek(loop); renderQuestion(); draw();
}
const LETTERS = 'ABCDEFGHIJ';
function renderQuestion() {
  document.body.classList.add('qmode');
  const done = qi >= QUESTIONS.length, Q = QUESTIONS[qi];
  $('moments').replaceChildren(...(!done && Q.moments ? Q.moments.map(([label, at, sg]) => chip(label, false, async () => {
    const was = playing; pause();
    if ((sg ?? Q.song) !== song) await loadSong(sg ?? Q.song);
    loop = at === 'end' ? Math.max(0, S.duration - (Q.len ?? 4)) : qStart({t: at}); seek(loop); renderQuestion(); if (was) play();
  }, 'moment')) : []));
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[song]}`;
  $('concept').textContent = done ? 'Thank you.' : Q.ask;
  $('line').textContent = done ? 'Copy your answers and paste them to me in the chat. They are also kept in this browser.' : Q.why;
  if (!done && Q.opts[qopt][2]) {const b = document.createElement('b'); b.textContent = ' ' + LETTERS[qopt] + ': ' + Q.opts[qopt][2]; b.style.fontWeight = '500'; b.style.color = 'var(--ink)'; $('line').append(document.createElement('br'), b);}
  $('presets').replaceChildren(...(done ? [] : Q.opts.map(([label, m], i) => chip(`${LETTERS[i]} · ${label}`, i === qopt, () => {qopt = i; mix = {...m}; renderQuestion(); draw();}))));
  const a = done ? null : (answers[Q.id] ??= {pick: null, note: ''});
  const picks = Q?.multi ? (a?.pick ?? '').split(', ').filter(Boolean) : [];
  const toggle = label => {if (Q.multi) {const s = new Set(picks); s.has(label) ? s.delete(label) : s.add(label); a.pick = Q.opts.map(o => o[0]).filter(l => s.has(l)).join(', ');} else a.pick = label; saveAnswers(); renderQuestion();};
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip(LETTERS[i], Q.multi ? picks.includes(label) : a.pick === label, () => toggle(label), 'opt')),
    chip('None of these', a.pick === 'none', () => {a.pick = 'none'; saveAnswers(); renderQuestion();}, 'opt')]));
  $('qpicklabel').textContent = Q?.multi ? 'Keep (any number)' : 'My pick';
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answers[Q.id] ?? {}; return `${i + 1}. ${Q.ask} → ${a.pick || '(skipped)'}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
  $('qcopy').hidden = !done;
  sync();
}
function choosePreset(p) {preset = p; mix = {...p.mix}; renderUI(); draw(); sync();}
function chip(label, on, click, cls = 'chip') {const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = click; return b;}
function renderUI() {
  if (shot) return;
  if (qmode) return renderQuestion();
  $('moments').replaceChildren(...moments().map(([label, at]) => chip(label, false, () => {if (loop !== null) loop = at; seek(at);}, 'moment')));
  const songs = $('songs'); songs.replaceChildren(...Object.entries(SONGS).map(([k, v]) => chip(v, k === song, () => {if (k !== song) {pause(); loadSong(k);}}, 'song')));
  const pres = $('presets'); pres.replaceChildren(...PRESETS.map((p, i) => chip(`${i + 1} · ${p.name}`, p === preset, () => choosePreset(p))));
  const custom = Object.keys(mix).some(d => mix[d] !== preset.mix[d]);
  $('concept').textContent = preset.name + (custom ? ' · adjusted' : ''); $('line').textContent = preset.line;
  $('mix').replaceChildren(...Object.entries(DIMS).map(([d, [label, opts]]) => {
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
  const w = shot ? W : Math.round(box.width * r), h = shot ? H : Math.round(box.height * r);
  if (canvas.width !== w || canvas.height !== h) {canvas.width = w; canvas.height = h; draw();}
}
function tick(ts) {
  if (playing && S) {seconds = music.position(onScreen(ts)); if (loop !== null && seconds >= loop + loopLen) {seek(loop); requestAnimationFrame(tick); return;} if (seconds >= S.duration) {pause(); seconds = S.duration;} draw(); $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(S.duration);}
  requestAnimationFrame(tick);
}
function cycleOption(dir) {const o = QUESTIONS[qi].opts; qopt = (qopt + dir + o.length) % o.length; mix = {...o[qopt][1]}; renderQuestion(); draw();}
if (shot) document.body.classList.add('shot');
else {
  $('play').onclick = () => (playing ? pause() : play());
  $('seek').oninput = () => seek(+$('seek').value);
  $('back').onclick = () => seek(seconds - 5); $('fwd').onclick = () => seek(seconds + 5);
  addEventListener('keydown', e => {
    if (e.target.closest?.('input,textarea')) return;
    const i = PRESETS.indexOf(preset);
    if (e.code === 'Space') {e.preventDefault(); playing ? pause() : play();}
    else if (e.key === 'ArrowRight' && e.shiftKey) seek(seconds + 2);
    else if (e.key === 'ArrowLeft' && e.shiftKey) seek(seconds - 2);
    else if (qmode && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && qi < QUESTIONS.length) cycleOption(e.key === 'ArrowRight' ? 1 : -1);
    else if (!qmode && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {e.preventDefault(); choosePreset(PRESETS[(i + 1) % PRESETS.length]);}
    else if (!qmode && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {e.preventDefault(); choosePreset(PRESETS[(i + PRESETS.length - 1) % PRESETS.length]);}
    else if (!qmode && /^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) choosePreset(PRESETS[+e.key - 1]);
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
  $('loop').onclick = () => {loop = loop === null ? seconds : null; loopLen = 4; $('loop').classList.toggle('on', loop !== null);};
  let touch = null;
  $('stagewrap').addEventListener('pointerdown', e => {touch = {x: e.clientX, y: e.clientY};});
  $('stagewrap').addEventListener('pointerup', e => {
    if (!touch) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    const i = PRESETS.indexOf(preset);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (qmode && qi < QUESTIONS.length) cycleOption(dx < 0 ? 1 : -1);
      else if (!qmode) choosePreset(PRESETS[(i + (dx < 0 ? 1 : PRESETS.length - 1)) % PRESETS.length]);
    }
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) playing ? pause() : play();
  });
  addEventListener('resize', fit); new ResizeObserver(fit).observe(canvas);
  requestAnimationFrame(tick);
}
fit();
if (qmode) {song = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)].song; loadSong(song).then(() => goQuestion(qi)).catch(e => status('Could not load: ' + e.message));}
else loadSong(song).catch(e => status('Could not load: ' + e.message));
