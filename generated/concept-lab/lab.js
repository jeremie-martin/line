// Concept lab, round 4: the real saved ride, drawn live with the vendored rider artwork and native replay, an automatic
// camera (cam.js), an intensity metric that knows nothing about any layer (intensity.js), and independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from './dist/native.js';
import * as C from './cam.js';
import * as I from './intensity.js';

const W = 1080, H = 1920, FPS = 40;
const INK = '#15181d', PENCIL = '#b4bcc8', NIGHT = '#14171d';
const SRC = {drums: '#15181d', vocals: '#2b59d6', sung: '#2b59d6', bass: '#7b3fbf', other: '#e0532f'};
const Z0 = 5.4; // today's vertical zoom
const SIZE_Z = {s58: 5.8, s62: 6.2, s68: 6.8};
// One optional, hand-placed cue per song: a drop is a musical judgement, and no detector found it reliably.
const NIGHTS = {petrunko: [22.4, 40.5], los: [23.9, 40.5], lua: [29.7, 49.6], batidao: [15.2, 29.5], burn: [4.5, 24.5], coma: [19.1, 33.6], tomada: [37.0, 50.0]};

// A scheme is a whole print identity: every colour below comes from these tokens. Validated in agents/round4-ideas (contrast, 4:2:0).
const SCHEMES = {
  graphite: {tone: '#eef2f8', paper: '#ffffff', ink: '#15181d', pencil: '#b4bcc8', mass: '#3b414a', accent: '#d3262e', nightPaper: '#14171d', nightInk: '#eef1f5'},
  hokusai: {paper: '#f4ecdc', ink: '#12294d', pencil: '#b8b4a4', mass: '#1d3e73', accent: '#d4412a', nightPaper: '#0d1f3f', nightInk: '#f4ecdc'},
  klein: {paper: '#ffffff', ink: '#0d1433', pencil: '#b4bcd8', mass: '#0f2fb5', accent: '#f2500f', nightPaper: '#0a1a6e', nightInk: '#f5f7ff'},
  bottle: {paper: '#f3f1e4', ink: '#0e2e27', pencil: '#b0b9a8', mass: '#14604c', accent: '#c96805', nightPaper: '#0a2a23', nightInk: '#f6efcf'},
  salmon: {paper: '#fce6d9', ink: '#3a1024', pencil: '#cfb3a8', mass: '#7a1438', accent: '#007a78', nightPaper: '#2b0a1a', nightInk: '#fce6d9'},
  black: {paper: '#101216', ink: '#eef1f5', pencil: '#4c535f', mass: '#c9ced6', accent: '#ff4d3d', nightPaper: '#101216', nightInk: '#eef1f5'},
  lagoon: {paper: '#e6f1ef', ink: '#0b3540', pencil: '#a9c3c1', mass: '#0e6f78', accent: '#f4623a', nightPaper: '#06262e', nightInk: '#e6f1ef'},
  riso: {paper: '#f7f3e9', ink: '#1a2f9c', pencil: '#b9b7cf', mass: '#2a47c9', accent: '#ff3d7f', nightPaper: '#14206e', nightInk: '#f7f3e9'},
  dune: {paper: '#efe2cd', ink: '#3a2115', pencil: '#c4b197', mass: '#8c3a1c', accent: '#e39a1b', sun: '#d8622a', nightPaper: '#2a160d', nightInk: '#efe2cd'},
  plum: {paper: '#1c1025', ink: '#f5e9fb', pencil: '#5c4a6a', mass: '#cfb2e6', accent: '#ffb000', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
};
const DIMS = {
  scheme: ['Colour', {graphite: 'Graphite & red', hokusai: 'Hokusai', black: 'Black', lagoon: 'Lagoon', riso: 'Riso', dune: 'Dune', plum: 'Plum', klein: 'Klein', bottle: 'Bottle'}],
  size: ['Size', {today: 'Today', s58: '7 % closer', s62: '15 % closer', s68: '25 % closer'}],
  place: ['Rider in the frame', {official: 'Official follower', loose: 'Looser', tamed: 'Tamed'}],
  tide: ['Zoom over time', {steady: 'Steady', quietI: 'Out when quiet', breath: 'One breath', fit: 'Fitted to the song'}],
  drive: ['Intensity from', {both: 'Speed + impact', speed: 'Speed only', impact: 'Impact only'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course at both ends', closing: 'Whole course at the end only'}],
  bandIn: ['Band at the opening', {present: 'There from the first frame', quick: 'Faint, then quickly in', fade: 'Arrives with the zoom'}],
  bg: ['Paper', {white: 'Plain', whisper: 'Whisper', xray: 'X-ray (test)'}],
  night: ['Night for the drop', {off: 'Off', on: 'On'}],
  ink: ['Line', {inking: 'Pencil → ink', rail: 'Whole rail on first touch', ink: 'All ink'}],
  music: ['Lower band', {none: 'None', bars: 'Today’s bars', bars3: 'Bars · three colours', blocks: 'Blocks', stems: 'Tuning fork', iris: 'Iris', red: 'One accent · fork', redbars: 'One accent · bars', redblocks: 'One accent · blocks'}],
  redBy: ['What takes the accent', {heat: 'Heat', loud: 'Loudest three', standing: 'Standing', level: 'Follows intensity'}],
  bandY: ['Band height', {low: 'Low', lowmid: 'Low-middle', mid: 'Middle', high: 'Today’s height'}],
  top: ['Top of the frame', {none: 'Nothing', vignette: 'Faint vignette', sun: 'Sun', title: 'Song title'}],
  hit: ['On each hit', {none: 'Nothing', shake: 'Today’s shake & split', refined: 'Refined', strong: 'Held', ghost: 'Refined + afterimage', heldGhost: 'Held + afterimage'}],
};
const base = {scheme: 'graphite', size: 's62', place: 'tamed', tide: 'steady', drive: 'both', ends: 'overture', bandIn: 'present', bg: 'whisper', night: 'off', ink: 'inking', music: 'none', redBy: 'heat', bandY: 'lowmid', hit: 'refined', top: 'none'};
const PRESETS = [
  {id: 'today', name: 'Today', line: 'Today’s camera, bars, shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, size: 'today', place: 'official', ends: 'none', bg: 'white', ink: 'ink', music: 'bars', hit: 'shake', bandY: 'low'}},
  {id: 'ride', name: 'Ride', line: 'The ride alone: the baseline.', mix: {...base, bg: 'white', hit: 'none'}},
  {id: 'xray', name: 'X-ray', line: 'A test, not a look: the paper shows the intensity metric as loudly as possible.', mix: {...base, bg: 'xray'}},
  {id: 'paper', name: 'Paper', line: 'White, graphite and one red on the fork, Refined hits, Night on the drop.',
    mix: {...base, music: 'red', redBy: 'loud', night: 'on'}},
  {id: 'hokusai', name: 'Hokusai', line: 'Indigo on washi, the bars, the sun, Held hits, easing out when quiet.',
    mix: {...base, scheme: 'hokusai', hit: 'strong', music: 'redbars', tide: 'quietI', top: 'sun'}},
  {id: 'lagoon', name: 'Lagoon', line: 'A new palette, a little wider, a looser camera, the song’s name, and the afterimage left to the camera.',
    mix: {...base, scheme: 'lagoon', size: 's58', place: 'loose', hit: 'ghost', music: 'redbars', top: 'title'}},
  {id: 'black', name: 'Black', line: 'In the dark: one accent on the fork, and each rail lights whole the moment the rider meets it.',
    mix: {...base, scheme: 'black', music: 'red', redBy: 'loud', tide: 'breath', ink: 'rail'}},
  {id: 'riso', name: 'Riso', line: 'A two-ink print: blue and fluorescent pink.', mix: {...base, scheme: 'riso', music: 'redbars', hit: 'strong'}},
  {id: 'dune', name: 'Dune', line: 'Sand and rust, with its own low sun.', mix: {...base, scheme: 'dune', music: 'redbars', hit: 'strong', top: 'sun'}},
  {id: 'plum', name: 'Plum', line: 'A second dark: plum and amber.', mix: {...base, scheme: 'plum', music: 'redbars', hit: 'strong'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma', tomada: 'Montagem Tomada (super slowed)'};
const plain = {...base, ends: 'none'};
// Each option: [label, mix, note shown when tapped].
const QUESTIONS = [
  {id: 'hit', ask: 'Refined or Held, in a whole song?', why: 'You picked Refined on the slider and Held in round 3, so this is close. Watch a long stretch rather than one hit.',
    song: 'los', t: 28, len: 12, opts: [
      ['Refined', {...plain, music: 'redbars'}, 'Every hit a similar length; strength sets the size.'],
      ['Held', {...plain, music: 'redbars', hit: 'strong'}, 'Strength also sets how long it lasts.']],
    moments: [['Los Voltaje 28 s', 28], ['Montagem Coma 40 s', 40, 'coma'], ['Petrunko 38 s', 38, 'petrunko']]},
  {id: 'ghost', ask: 'How much afterimage?', why: 'It now fades slowly, so at speed the camera usually carries it away first, as you suggested. Wider helps it, too.',
    song: 'los', t: 31, len: 8, multi: true, opts: [
      ['None', {...plain, music: 'redbars'}, 'For reference.'],
      ['15 % closer', {...plain, music: 'redbars', hit: 'ghost'}, 'At our usual size.'],
      ['7 % closer', {...plain, music: 'redbars', hit: 'ghost', size: 's58'}, 'A little wider, as you guessed might be better.'],
      ['Today’s width', {...plain, music: 'redbars', hit: 'ghost', size: 'today', place: 'tamed'}, 'Wider still.']],
    moments: [['Los Voltaje 31 s', 31], ['Montagem Coma 40 s', 40, 'coma'], ['Black', 31, null, {scheme: 'black'}]]},
  {id: 'ink', ask: 'How should the line appear?', why: 'Fixed first: rails now ink as the rider passes them, so no grey is left behind. Then the idea itself, which you challenged. Keep any number.',
    song: 'petrunko', t: 28, len: 8, multi: true, opts: [
      ['Pencil → ink', {...plain, music: 'redbars'}, 'As before, without the grey leftovers.'],
      ['Whole rail', {...plain, music: 'redbars', ink: 'rail'}, 'The well-posed version of ink ahead: the rail you meet goes black entirely, at once.'],
      ['All ink', {...plain, music: 'redbars', ink: 'ink'}, 'No grey at all.']],
    moments: [['Petrunko 28 s', 28], ['Los Voltaje 31 s', 31, 'los'], ['Montagem Coma 40 s', 40, 'coma']]},
  {id: 'scheme', ask: 'Do any of the new colours belong with yours?', why: 'Four new palettes beside your three, each with the bars you love. Keep any number.',
    song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['Graphite & red', {...plain, music: 'redbars'}, 'Yours.'],
      ['Hokusai', {...plain, music: 'redbars', scheme: 'hokusai'}, 'Yours.'],
      ['Black', {...plain, music: 'redbars', scheme: 'black'}, 'Yours.'],
      ['Lagoon', {...plain, music: 'redbars', scheme: 'lagoon'}, 'New: pale sea-glass, deep teal, a coral accent.'],
      ['Riso', {...plain, music: 'redbars', scheme: 'riso'}, 'New: a two-ink print, blue and fluorescent pink.'],
      ['Dune', {...plain, music: 'redbars', scheme: 'dune', top: 'sun'}, 'New: sand and rust, with its own sun.'],
      ['Plum', {...plain, music: 'redbars', scheme: 'plum'}, 'New: a second dark, plum and amber.']],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 45 s', 45, 'los'], ['Fork instead', 36.5, null, {music: 'red'}]]},
  {id: 'whole', ask: 'Three bigger questions, when you have time', why: 'Who is this for: people who have never seen it, or people who already get it? Which film would you post today? Should each song get a small hand-written sheet, with Night as its first line?',
    song: 'los', t: 30, len: 8, open: true, opts: [['', {...plain, music: 'redbars'}, '']]},
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
const STORE = 'concept-lab-answers-r5';
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
    // A rail inks as the rider passes it, not only where a contact was recorded: on five songs 8–17 % of the course stayed pencil
    // behind the rider, about 90 % of it within 14 units of the body, and a third of used rails ended in a grey tail.
    const cs = data.trace.frames.map(centreOf), reach = []; {let m = -Infinity; for (const c of cs) reach.push(m = Math.max(m, c.x));}
    const firstAt = x => {let a = 0, b = reach.length - 1; while (a < b) {const c = (a + b) >> 1; if (reach[c] >= x) b = c; else a = c + 1;} return reach[a] >= x ? a : Infinity;};
    const near = l => {const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = dx * dx + dy * dy || 1, a = firstAt(Math.min(l.x1, l.x2) - 30), b = Math.min(cs.length - 1, firstAt(Math.max(l.x1, l.x2) + 30)); if (a === Infinity) return false; for (let f = a; f <= b; f++) {const c = cs[f], u = clamp(((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L, 0, 1); if (Math.hypot(c.x - l.x1 - u * dx, c.y - l.y1 - u * dy) < 14) return true;} return false;};
    for (const chain of chains.values()) {
      chain.sort((a, b) => (a.x1 + a.x2) - (b.x1 + b.x2));
      const used = chain.some(l => l.touch < Infinity) || chain.some(near);
      let m = Infinity, first = Infinity; for (let i = chain.length - 1; i >= 0; i--) {m = Math.min(m, chain[i].touch); chain[i].ink = used ? Math.min(m, firstAt(Math.max(chain[i].x1, chain[i].x2))) : Infinity; first = Math.min(first, chain[i].ink);}
      for (const l of chain) l.rail = first; // the moment the rider first meets this rail
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
  // the intensity metric, from the same two signals on every song; nothing below this line knows how it is computed
  const speed = centres.map((_, f) => {const a = centres[Math.max(0, f - 1)], b = centres[Math.min(centres.length - 1, f + 1)], k = Math.min(centres.length - 1, f + 1) - Math.max(0, f - 1) || 1; return Math.hypot(b.x - a.x, b.y - a.y) / k * FPS;}).filter((_, f) => f % 4 === 0);
  const raw = I.rawSignals({speed, hits: hits.map(h => ({t: h.tc, s: h.s})), duration: data.duration});
  const drives = {both: I.intensity(raw), speed: I.intensity(raw, {use: 'speed'}), impact: I.intensity(raw, {use: 'power'}), meter: I.intensity(raw, {shape: 'meter'})};
  // the night cue, snapped to the strongest hit within 0.4 s of it
  let night = null; const cue = NIGHTS[data.key];
  if (cue) {const near = hits.filter(h => Math.abs(h.tc - cue[0]) < 0.4), s = near.reduce((a, b) => (!a || b.s > a.s ? b : a), null); const exit = hits.filter(h => Math.abs(h.tc - cue[1]) < 0.8).reduce((a, b) => (!a || b.s > a.s ? b : a), null); night = [s ? s.tc : cue[0], exit ? exit.tc : cue[1]];}
  const red = redLogic(data.spectrum, hits);
  return {...data, red, frames: native.frames, lines, grid, G, centres, R, hits, bbox: {x0, y0, x1, y1}, drives, night,
    follow: N.follower(data.trace.frames), cams: new Map()};
}

/** The metric at time t, for the chosen ingredients. */
function intensityAt(t) {const y = S.drives[mix.drive], x = clamp(t * I.FS, 0, y.length - 1), i = Math.floor(x), j = Math.min(i + 1, y.length - 1); return y[i] + (y[j] - y[i]) * (x - i);}
// One red: which stems are red. Red is never added; a few existing elements become red, and the logic picks who.
function redLogic(sp, hits) {
  const n = sp.bands, T = sp.frames.length, p95 = Array.from({length: n}, (_, b) => {const s = sp.frames.map(r => r[b]).sort((a, c) => a - c); return Math.max(0.05, s[Math.floor(0.95 * (T - 1))]);});
  const wh = i => sp.frames[clamp(i, 0, T - 1)].map((v, b) => v / p95[b]);
  const top = (arr, k) => arr.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  const flux = t => {const i = Math.round(t * sp.fps), a = wh(i + 1), b = wh(i - 2); return a.map((v, j) => v - b[j]);};
  // standing: red holds on the stems of the last champion hit; only a clearly stronger hit (×1.3, against an 8 s decay) moves it
  const champs = []; {let c = 0, t0 = 0; for (const h of hits) {const cur = c * Math.exp(-(h.tc - t0) / 8); if (h.I > 1.3 * cur) {c = h.I; t0 = h.tc; champs.push({t: h.tc, set: top(flux(h.tc), 3)});}}}
  return {champs};
}
function redAt(t, row) {
  const L = S.red, top = k => row.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  if (mix.redBy === 'standing') {let c = null; for (const x of L.champs) {if (x.t > t) break; c = x;} return new Set(c ? c.set : []);}
  if (mix.redBy === 'level') return new Set(top(Math.round(1 + 5 * intensityAt(t))));
  if (mix.redBy === 'heat') {let h = 0; for (const x of S.hits) {if (x.tc > t) break; h += x.I * Math.exp(-(t - x.tc) / 0.8);} return new Set(top(Math.floor(clamp(6 * h / 1.47, 0, 6))));}
  return new Set(top(3).filter(b => row[b] > 0.25));
}
// ── camera ─────────────────────────────────────────────────────────────────
function camFrames(m) {
  const key = m.size + '|' + m.place + '|' + m.tide + '|' + m.drive;
  if (!S.cams.has(key)) {
    const z = m.size === 'today' ? Z0 : SIZE_Z[m.size]; let cam;
    if (m.size === 'today' || m.place === 'official') cam = S.centres.map((_, f) => {const c = S.follow({w: W, h: H, z}, f); return {z, ax: W / 2, ay: 0.35 * H, x: c.x, y: c.y};});
    else cam = C.buildPlaced(S.R, {base: z, place: m.place, tide: m.tide, level: f => {const y = S.drives[m.drive]; return y[clamp(Math.round(f / FPS * I.FS), 0, y.length - 1)];}});
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
  if (mix.ends === 'none') return view;
  const b = S.bbox, zo = Math.min(0.78 * W / (b.x1 - b.x0), 0.5 * H / (b.y1 - b.y0)), o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2};
  const t1 = Math.min(2.2, S.hits.find(h => h.tc >= 1.3)?.tc ?? 1.6), tE = S.duration - 3;
  let u = 1;
  if (t < t1 && mix.ends === 'overture') u = smoothstep((t - 0.25) / (t1 - 0.25));
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
  ghost: {kick: 1, split: 1, flash: 1, ghost: 1},                // the body the blow caught stays where it happened
  heldGhost: {kick: 1, split: 1, flash: 1, held: 1, ghost: 1},
};
// Strength as duration: the excess strength w = e^2.2 sets both amplitude and hold. The peak is held at least one full
// 60 fps frame (no hit loses its peak to the frame grid); recovery ends exactly, never later than 0.25 s.
const excess = e => Math.pow(e, 2.2);
const held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
const acc = () => BUNDLES[mix.hit] ?? {};
const decay = (age, tau0, e) => age < 0 ? 0 : Math.exp(-age / (tau0 * (0.8 + 0.4 * e)));
function activeHits(t, span) {
  const out = [];
  for (const h of S.hits) {if (h.tc > t + 0.001) break; const age = t - h.tc; if (age <= span) out.push({h, age, e: forceE ?? h.I});}
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

// Paper: plain, or answering the intensity metric; night is one optional hand-placed cue on top of either.
function themeAt(t) {
  const p = SCHEMES[mix.scheme], lit = bg => ({bg, ink: p.ink, pencil: p.pencil, dark: 0});
  if (mix.night === 'on' && S.night && t >= S.night[0] && t < S.night[1]) return {bg: p.nightPaper, ink: p.nightInk, pencil: mixHex(p.nightPaper, p.nightInk, 0.38), dark: 1};
  if (mix.bg === 'porcelain') return lit(mixHex(p.paper, p.mass, 0.05));
  if (mix.bg === 'whisper') return lit(mixHex(p.paper, p.tone ?? p.mass, (p.tone ? 1 : 0.055) * intensityAt(t)));
  if (mix.bg === 'late') return lit(mixHex(p.paper, p.tone ?? p.mass, (p.tone ? 1 : 0.055) * smoothstep((intensityAt(t) - 0.5) / 0.3)));
  if (mix.bg === 'xray') return lit(mixHex('#ffffff', '#ffb000', intensityAt(t)));
  return lit(p.paper);
}
// The top of the frame, behind the ride. The sun is a mass, not a line: it stays colour on a phone.
function drawTop(t, alpha, th) {
  const p = SCHEMES[mix.scheme]; ctx.save(); ctx.globalAlpha = alpha;
  if (mix.top === 'vignette') {
    // still and faint: fainter at the top than the bottom, eased so that no edge shows
    const c = hex(th.dark ? '#ffffff' : p.ink).join(','), fade = (y0, y1, o) => {const l = ctx.createLinearGradient(0, y0, 0, y1); for (let i = 0; i <= 8; i++) l.addColorStop(i / 8, `rgba(${c},${o * (1 - i / 8) ** 2})`); ctx.fillStyle = l; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));};
    fade(0, 0.18 * H, 0.025); fade(H, 0.74 * H, 0.05); // the most it should ever be
  }
  if (mix.top === 'sun') {ctx.fillStyle = th.dark ? p.nightInk : p.sun ?? p.accent; ctx.beginPath(); ctx.arc(0.74 * W, 0.17 * H, W * (0.1 + 0.09 * intensityAt(t)), 0, 2 * Math.PI); ctx.fill();}
  if (mix.top === 'title') {ctx.fillStyle = th.ink; ctx.font = '800 92px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; let y = 0.04 * H; for (const w of SONGS[song].replace(/\s*\(.*\)/, '').toUpperCase().split(' ')) {ctx.fillText(w, 0.07 * W, y); y += 94;}}
  ctx.restore();
}
// X-ray only: the whole curve along the top of the frame, with a playhead.
function drawGauge(t, th) {
  const y = S.drives[mix.drive], x0 = 0.07 * W, wd = 0.86 * W, top = 0.035 * H, ht = 0.06 * H, X = i => x0 + wd * i / (y.length - 1), Y = v => top + ht * (1 - v);
  ctx.save(); ctx.strokeStyle = th.ink; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x0 + wd, Y(0)); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.lineWidth = 5; ctx.beginPath(); y.forEach((v, i) => {if (i % 3 === 0) ctx.lineTo(X(i), Y(v));}); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(x0 + wd * clamp(t / S.duration, 0, 1), Y(intensityAt(t)), 13, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
}

function visibleLines(c) {
  const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
  const seen = new Set();
  for (let gx = Math.floor(x0 / S.G); gx <= Math.floor(x1 / S.G); gx++)
    for (let gy = Math.floor(y0 / S.G); gy <= Math.floor(y1 / S.G); gy++)
      for (const l of S.grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
  return out;
}
let forceE = null, slowmo = false, slowRun = false, lastTs = 0; // the hit bench: a chosen strength, played slowly
let paperNow = '#ffffff';
let darkNow = 0, overNow = 0; // night amount; how far into the whole-course view we are (0–1)
function drawLines(lines, at, z, th) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = filter => {ctx.beginPath(); for (const l of lines) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
  const ink = Math.max(2, 3.6 / z);
  if (mix.ink === 'ink') {path(() => true); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke(); return;}
  const done = mix.ink === 'rail' ? l => l.rail <= at : l => l.ink <= at;
  path(l => !done(l)); ctx.strokeStyle = overNow > 0.02 ? mixHex(th.pencil, th.ink, 0.25 * overNow) : th.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * overNow) / z); ctx.stroke();
  path(done); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();
}
function riderCamera(v, ox, oy, k) {
  // the rider stays on its own screen point at any zoom
  const zr = v.z, px = v.rx + ox, py = v.ry + oy;
  return {x: v.R.x + (W / 2 - px) / zr, y: v.R.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
}
// Afterimage: the rider's exact pose at the hit, flat, left at its world position. It fades slowly: at the rider's speed the
// frame is crossed in about half a second, so usually the camera, not the fade, takes it away.
function drawGhosts(sheet, t, v, hc, k, th) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  const p = SCHEMES[mix.scheme];
  for (const {h, age, e} of activeHits(t, 1.2)) {
    const life = 0.5 + 0.7 * excess(e); if (age > life) continue;
    paint(octx, riderCamera(v, hc.dx, hc.dy, k), sheet, riderAt(S.frames, h.tc * FPS), h.tc * FPS);
    octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = mixHex(mixHex(th.bg, th.ink, 0.3), p.accent, smoothstep((e - 0.2) / 0.5)); octx.fillRect(0, 0, overlay.width, overlay.height); octx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.pow(1 - age / life, 0.8); ctx.drawImage(overlay, 0, 0); ctx.restore();
  }
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
const bandShift = () => ({low: 0, lowmid: -0.015 * H, mid: -0.03 * H, high: -0.07 * H}[mix.bandY] ?? 0);
function drawSpectrum(t, form, alpha, th) {
  ctx.save(); ctx.translate(0, bandShift());
  const gain = mix.bandBy === 'level' ? 0.7 + 0.42 * intensityAt(t) : 1, row = spectrumRow(t).map(v => Math.min(1, v * gain)), n = row.length, step = W / n, lit = c => th.dark ? mixHex(c, '#ffffff', 0.62 * th.dark) : c;
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const third = i => Math.min(2, Math.floor(i / n * 3));
  const p = SCHEMES[mix.scheme], RED = p.accent, graphite = th.dark ? p.nightInk : p.mass;
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
      if (hot.has(i)) {ctx.fillStyle = RED; ctx.globalAlpha = alpha; ctx.fillRect(x, base - h, bw, Math.min(h, Math.max(cell * 2, 8)));}
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
const trauma = (t, c) => {const fs = forceE === null ? null : 0.2 + 0.65 * Math.pow(forceE, 1 / 1.4); let x = 0; for (const h of S.hits) {if (h.t > t) break; const hs = fs ?? h.s; if (hs < c.min) continue; x += hs * c.gain * Math.exp(-(t - h.t) * c.decay);} return Math.pow(Math.min(1, x), c.power);};
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
  const A = acc(); if (!A.split) return;
  let ox = 0, oy = 0;
  for (const {h, age, e} of activeHits(t, 0.6)) {const w = excess(e), a = (A.held ? (2 + 16 * w) * held(age, w) : (2 + 12 * e) * decay(age, 0.06, e)), i = into(h); ox += i.x * a; oy += i.y * a;}
  const n = Math.hypot(ox, oy), cap = A.held ? 18 : 14; if (n > cap) {ox *= cap / n; oy *= cap / n;}
  if (Math.hypot(ox, oy) * k > 1) channelSplit(ox * k, oy * k);
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
  worldSplit(t, k);
  const hits = Object.keys(A).length ? activeHits(t, 0.6) : [];
  if (A.flash) {
    let f = 0; for (const {age, e} of hits) {const w = excess(e); f = Math.max(f, A.held ? (0.1 + 0.2 * w) * held(age, w) : A.flash * (0.1 + 0.18 * e) * decay(age, 0.05, e));}
    f *= 1 - 0.6 * darkNow; // on night the flash would only grey the black
    // the flash lifts the ink toward the paper, on any paper; a white flash would tint a coloured one
    if (f > 0.004) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f; ctx.fillStyle = darkNow ? '#fff' : paperNow; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
  }
}
async function draw() {
  if (!S || !canvas.width || !canvas.height) return;
  const sheet = await sheetPromise, t = seconds, at = clamp(t * FPS, 0, S.frames.length - 1), k = canvas.width / W;
  const th = themeAt(t), v = bookend(t, cameraAt(mix, at), at), hc = hitCamera(t);
  overNow = v.over; darkNow = th.dark; paperNow = th.bg;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.top !== 'none') {const a = (1 - v.over) ** 2; if (a > 0.003) drawTop(t, a, th);}
  const band = v.ending ? (1 - v.over) ** 2 : mix.bandIn === 'present' ? 1 : mix.bandIn === 'quick' ? 0.3 + 0.7 * smoothstep(t / 0.5) : (1 - v.over) ** 2;
  if (band > 0.003 && ['red', 'redblocks', 'redbars', 'stems', 'iris', 'slits', 'bars3', 'blocks'].includes(mix.music)) drawSpectrum(t, mix.music, band, th);
  const cc = {...v, ax: v.ax + hc.dx, ay: v.ay + hc.dy};
  ctx.setTransform(cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k);
  drawLines(visibleLines(cc), at, cc.z, th);
  if (acc().ghost) drawGhosts(sheet, t, v, hc, k, th);
  drawRider(sheet, riderCamera(v, hc.dx, hc.dy, k), at);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.music === 'bars' && band > 0.003) drawBars(t, band);
  postAccents(t, k, v, hc.dx, hc.dy);
  if (mix.bg === 'xray') {ctx.setTransform(k, 0, 0, k, 0, 0); drawGauge(t, th);}
}

// ── loading, transport, UI ─────────────────────────────────────────────────
const cache = new Map();
async function loadSong(key) {
  const id = ++loadId; song = key; S = null; status('Loading ' + SONGS[key] + '…');
  if (cache.has(key)) {const c = cache.get(key); if (!shot) await music.load(c.audio).catch(() => null); if (id !== loadId) return; S = c;}
  else {
    const data = await (await fetch(`./data/${key}.json`)).json();
    const [native] = await Promise.all([replay(data.track, data.trace), shot ? null : music.load(data.audio).catch(() => null)]);
    if (id !== loadId) return;
    S = prepare(data, native); cache.set(key, S);
  }
  $('seek').max = S.duration; seconds = Math.min(seconds, S.duration);
  status(''); renderUI(); await draw();
  if (shot) {window.__ready = true; window.__duration = S.duration; window.__audio = S.audio;
    window.__inkAudit = () => {
      // after the rider has gone by, what is still pencil? distance: closest approach of the body centre to the segment (units)
      const seg = (l, p) => {const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = dx * dx + dy * dy || 1, u = clamp(((p.x - l.x1) * dx + (p.y - l.y1) * dy) / L, 0, 1); return Math.hypot(p.x - l.x1 - u * dx, p.y - l.y1 - u * dy);};
      let total = 0, inked = 0, stale = {near: 0, mid: 0, far: 0}, chainTail = 0, tailLen = 0, tailHist = [0, 0, 0, 0];
      const chains = new Map(); for (const l of S.lines) {if (!chains.has(l.chain)) chains.set(l.chain, []); chains.get(l.chain).push(l);}
      for (const ch of chains.values()) {
        const touched = ch.some(l => l.touch < Infinity); const len = l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
        const lon = ch.reduce((a, l) => a + len(l), 0); let tail = 0; for (const l of ch) {total += len(l); if (l.ink < Infinity) inked += len(l); else {if (touched) tail += len(l);}}
        if (touched && tail > 0) {chainTail++; tailLen += tail; tailHist[tail / lon < .1 ? 0 : tail / lon < .25 ? 1 : tail / lon < .5 ? 2 : 3]++;}
      }
      const step = 8; for (const l of S.lines) if (l.ink === Infinity) {let d = 1e9; const lo = Math.min(l.x1, l.x2) - 60, hi = Math.max(l.x1, l.x2) + 60; for (let f = 0; f < S.centres.length; f += 2) {const c = S.centres[f]; if (c.x >= lo && c.x <= hi) d = Math.min(d, seg(l, c));} const L = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); if (d < 14) stale.near += L; else if (d < 40) stale.mid += L; else stale.far += L;}
      return {chains: chains.size, lines: S.lines.length, inkedShare: +(inked / total).toFixed(3), staleUnits: Object.fromEntries(Object.entries(stale).map(([k, v]) => [k, Math.round(v)])), touchedChainsWithGreyTail: chainTail, tailShareHist_lt10_lt25_lt50_rest: tailHist, totalUnits: Math.round(total)};
    };
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
  const Q = QUESTIONS[qi]; mix = {...Q.opts[0][1]}; setBench(!!Q.bench);
  if (song !== Q.song) {await loadSong(Q.song);}
  loop = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); $('loop').textContent = `Loop ${loopLen} s`; seek(loop); renderQuestion(); draw();
}
const LETTERS = 'ABCDEFGHIJ';
function renderQuestion() {
  document.body.classList.add('qmode');
  const done = qi >= QUESTIONS.length, Q = QUESTIONS[qi];
  $('moments').replaceChildren(...(!done && Q.moments ? Q.moments.map(([label, at, sg, extra]) => chip(label, false, async () => {
    const was = playing; pause();
    if ((sg ?? Q.song) !== song) await loadSong(sg ?? Q.song);
    if (extra) mix = {...mix, ...extra}; else mix = {...Q.opts[qopt][1]};
    loop = at === 'end' ? Math.max(0, S.duration - (Q.len ?? 4)) : qStart({t: at}); seek(loop); renderQuestion(); if (was) play();
  }, 'moment')) : []));
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[song]}`;
  $('concept').textContent = done ? 'Thank you.' : Q.ask;
  $('line').textContent = done ? 'Copy your answers and paste them to me in the chat. They are also kept in this browser.' : Q.why;
  if (!done && !Q.open && Q.opts[qopt][2]) {const b = document.createElement('b'); b.textContent = ' ' + LETTERS[qopt] + ': ' + Q.opts[qopt][2]; b.style.fontWeight = '500'; b.style.color = 'var(--ink)'; $('line').append(document.createElement('br'), b);}
  $('presets').replaceChildren(...(done ? [] : Q.opts.map(([label, m], i) => chip(`${LETTERS[i]} · ${label}`, i === qopt, () => {qopt = i; mix = {...m}; renderQuestion(); draw();}))));
  const a = done ? null : (answers[Q.id] ??= {pick: null, note: ''});
  $('presets').hidden = !done && !!Q.open; document.querySelector('.qrow').hidden = !done && !!Q.open;
  const picks = Q?.multi ? (a?.pick ?? '').split(', ').filter(Boolean) : [];
  const toggle = label => {if (Q.multi) {const s = new Set(picks); s.has(label) ? s.delete(label) : s.add(label); a.pick = Q.opts.map(o => o[0]).filter(l => s.has(l)).join(', ');} else a.pick = label; saveAnswers(); renderQuestion();};
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip(LETTERS[i], Q.multi ? picks.includes(label) : a.pick === label, () => toggle(label), 'opt')),
    chip('None of these', a.pick === 'none', () => {a.pick = 'none'; saveAnswers(); renderQuestion();}, 'opt')]));
  $('qnote').rows = Q?.open ? 7 : 2; $('qpicklabel').textContent = Q?.multi ? 'Keep (any number)' : 'My pick';
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answers[Q.id] ?? {}; return Q.open ? `${i + 1}. ${Q.ask}: ${a.note || '(skipped)'}` : `${i + 1}. ${Q.ask} → ${a.pick || '(skipped)'}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
  $('qcopy').hidden = !done;
  sync();
}
function choosePreset(p) {preset = p; mix = {...p.mix}; renderUI(); draw(); sync();}
function chip(label, on, click, cls = 'chip') {const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = click; return b;}
function renderUI() {
  if (shot || feelmode) return;
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
  if (slowmo && slowRun && S) {seconds += (ts - lastTs) / 1000 * 0.25; if (loop !== null && seconds >= loop + loopLen) seconds = loop; draw(); $('seek').value = seconds;}
  lastTs = ts;
  if (playing && S) {seconds = music.position(onScreen(ts)); if (loop !== null && seconds >= loop + loopLen) {seek(loop); requestAnimationFrame(tick); return;} if (seconds >= S.duration) {pause(); seconds = S.duration;} draw(); $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(S.duration);}
  requestAnimationFrame(tick);
}
function cycleOption(dir) {const o = QUESTIONS[qi].opts; qopt = (qopt + dir + o.length) % o.length; mix = {...o[qopt][1]}; renderQuestion(); draw();}
if (shot) document.body.classList.add('shot');
else {
  $('play').onclick = () => {if (slowmo) {slowRun = !slowRun; $('play').textContent = slowRun ? 'Pause' : 'Play'; return;} playing ? pause() : play();};
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
// ── the hit bench: one strength for every hit, played at any speed ──────────
function setBench(on) {
  $('bench').hidden = !on; if (on) return renderBench();
  forceE = null; slowmo = slowRun = false;
}
function renderBench() {
  const list = S.hits.map(h => h.I), bins = new Array(24).fill(0); list.forEach(e => bins[Math.min(23, Math.floor(e * 24))]++);
  const top = Math.max(...bins); $('benchhist').replaceChildren(...bins.map(b => {const i = document.createElement('i'); i.style.height = (100 * b / top) + '%'; return i;}));
  const e = +$('benchstrength').value, below = list.filter(v => v < e).length / list.length;
  $('benchlabel').textContent = forceE === null ? 'Every hit at its real strength. Drag to set one strength for all of them.' : `Strength ${e.toFixed(2)}: stronger than ${Math.round(100 * below)} % of this song’s hits`;
  $('benchreal').classList.toggle('on', forceE === null); $('benchslow').classList.toggle('on', slowmo);
}
if (!shot) {
  $('benchstrength').oninput = () => {forceE = +$('benchstrength').value; renderBench(); draw();};
  $('benchreal').onclick = () => {forceE = null; renderBench(); draw();};
  $('benchslow').onclick = () => {const on = !slowmo; pause(); slowmo = on; slowRun = on; $('play').textContent = on ? 'Pause' : 'Play'; renderBench();};
}
// ── the blind test: passages in pairs, with nothing on screen to say what is being measured ─────
const feelmode = q.has('feel'), FEEL = 'concept-lab-feel-r4';
async function runFeel() {
  document.body.classList.add('feelmode'); $('feel').hidden = false; mix = {...base, ends: 'none', bg: 'white', hit: 'none'}; loop = null;
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
  const stop = () => {run++; if (playing) pause(); flag.hidden = true; $('feelplay').textContent = 'Play A, then B';};
  const clip = async (c, name, me) => {
    if (song !== c.song || !S) await loadSong(c.song); if (me !== run) return; flag.textContent = name; flag.hidden = false; seconds = c.t; await draw();
    await music.play(c.t, 1); playing = music.playing; if (!playing) throw new Error('Sound did not start. Tap again.');
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
if (feelmode) {song = 'los'; mix = {...base, ends: 'none', bg: 'white', hit: 'none'}; seconds = 4; loadSong(song).then(runFeel).catch(e => status('Could not load: ' + e.message));}
else if (qmode) {song = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)].song; loadSong(song).then(() => goQuestion(qi)).catch(e => status('Could not load: ' + e.message));}
else loadSong(song).catch(e => status('Could not load: ' + e.message));
