// Concept lab, round 4: the real saved ride, drawn live with the vendored rider artwork and native replay, an automatic
// camera (cam.js), an intensity metric that knows nothing about any layer (intensity.js), and independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '../dist/native.js';
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
  blueprint: {paper: '#123f7f', ink: '#f3f7ff', pencil: '#4c70aa', mass: '#dfe9fb', accent: '#ffb300', nightPaper: '#071d40', nightInk: '#f3f7ff'},
};
const DIMS = {
  scheme: ['Colour', {graphite: 'Graphite & red', hokusai: 'Hokusai', klein: 'Klein', bottle: 'Bottle', salmon: 'Salmon', blueprint: 'Blueprint', black: 'Black'}],
  size: ['Size', {today: 'Today', s58: '7 % closer', s62: '15 % closer', s68: '25 % closer'}],
  place: ['Rider in the frame', {official: 'Official follower', loose: 'Looser', tamed: 'Tamed', calm: 'Calm', pinnedRight: 'Pinned right'}],
  tide: ['Zoom over time', {steady: 'Steady', calmOut: 'Out when quiet (round 3)', quietI: 'Out when quiet (smooth)', breath: 'One breath', fit: 'Fitted to the song'}],
  drive: ['Intensity from', {both: 'Speed + impact', speed: 'Speed only', impact: 'Impact only', meter: 'Speed + impact, meter'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course at both ends', closing: 'Whole course at the end only'}],
  bandIn: ['Band at the opening', {fade: 'Arrives with the zoom', present: 'There from the first frame'}],
  open: ['Rider at the opening', {plain: 'True size', small: 'A little larger', medium: 'Larger'}],
  close: ['Rider at the ending', {plain: 'True size', ring: 'Ring'}],
  bg: ['Paper', {white: 'White', porcelain: 'Porcelain', whisper: 'Whisper', late: 'Only at the top', xray: 'X-ray (test)'}],
  night: ['Night for the drop', {off: 'Off', on: 'On'}],
  ink: ['Line', {ink: 'Ink', inking: 'Pencil → ink'}],
  music: ['Lower band', {none: 'None', bars: 'Today’s bars', bars3: 'Bars · three colours', blocks: 'Blocks', stems: 'Tuning fork', iris: 'Iris', slits: 'Cobalt', red: 'One accent · fork', redbars: 'One accent · bars', redblocks: 'One accent · blocks', ridge: 'Ridge · waterline', ridgeStruck: 'Ridge · struck'}],
  redBy: ['What takes the accent', {loud: 'Loudest three', standing: 'Standing', heat: 'Heat', level: 'Follows intensity'}],
  bandY: ['Band height', {low: 'Low', lowmid: 'Low-middle', mid: 'Middle', high: 'Today’s height'}],
  top: ['Top of the frame', {none: 'Nothing', vignette: 'Faint vignette', sun: 'Sun', title: 'Song title', score: 'Score'}],
  bandBy: ['Band size', {steady: 'Steady', level: 'Follows intensity'}],
  hit: ['On each hit', {none: 'Nothing', shake: 'Today’s shake & split', refined: 'Refined', strong: 'Held', clean: 'Clean rider', trail: 'Trailing', ahead: 'Held + ink ahead', ghost: 'Held + afterimage', stay: 'Held, rail sets the length', source: 'Held, by source'}],
  when: ['Hits fire at', {touch: 'The touch', hit: 'The measured hit'}],
};
const base = {scheme: 'graphite', size: 's62', place: 'tamed', tide: 'steady', drive: 'both', ends: 'none', open: 'plain', close: 'plain', bg: 'white', night: 'off', ink: 'inking', music: 'none', redBy: 'standing', bandY: 'lowmid', bandBy: 'steady', hit: 'none', bandIn: 'fade', top: 'none', when: 'touch'};
const PRESETS = [
  {id: 'today', name: 'Today', line: 'Today’s camera, bars, shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, size: 'today', place: 'official', ink: 'ink', music: 'bars', hit: 'shake', bandY: 'low'}},
  {id: 'ride', name: 'Ride', line: 'The Tamed camera, 15 % closer, pencil to ink. Nothing else: the baseline.', mix: {...base}},
  {id: 'xray', name: 'X-ray', line: 'A test, not a look: the paper shows the intensity metric as loudly as possible, with the whole curve at the top.', mix: {...base, bg: 'xray', hit: 'strong'}},
  {id: 'paper', name: 'Paper', line: 'Your picks, closest to home: white, graphite and one red on the tuning fork, Held hits, a whisper of tone, Night on the drop, a ring at the end.',
    mix: {...base, ends: 'overture', close: 'ring', hit: 'strong', music: 'red', redBy: 'standing', bg: 'whisper', night: 'on'}},
  {id: 'hokusai', name: 'Hokusai', line: 'A poster: indigo on washi, one accent on the bars, a sun that swells with intensity, the zoom easing out when quiet.',
    mix: {...base, scheme: 'hokusai', ends: 'overture', hit: 'strong', music: 'redbars', redBy: 'heat', bg: 'whisper', tide: 'quietI', top: 'sun'}},
  {id: 'waterline', name: 'Waterline', line: 'No visualiser at all: white paper, Klein blue, the mountain surfacing as the ride falls.',
    mix: {...base, scheme: 'klein', ends: 'overture', close: 'ring', hit: 'strong', music: 'ridge'}},
  {id: 'black', name: 'Black', line: 'The first whole film in the dark: one accent on the fork, ink turning white as the rider passes, one breath of zoom.',
    mix: {...base, scheme: 'black', ends: 'overture', hit: 'strong', music: 'red', redBy: 'loud', tide: 'breath'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma', tomada: 'Montagem Tomada (super slowed)'};
const plain = {...base};
// Each option: [label, mix, note shown when tapped].
const QUESTIONS = [
  {id: 'curve', ask: 'Does the amber follow what you feel?', why: 'A loud test, not a look: amber is the intensity metric, and the curve on top is the whole song. Compare how each follows the ride.',
    song: 'los', t: 8, len: 20, opts: [
      ['Speed + impact', {...plain, bg: 'xray'}, 'The two together. The default.'],
      ['Speed only', {...plain, bg: 'xray', drive: 'speed'}, 'How fast the rider is going.'],
      ['Impact only', {...plain, bg: 'xray', drive: 'impact'}, 'How often and how hard it is being struck.'],
      ['Reacts after', {...plain, bg: 'xray', drive: 'meter'}, 'Speed + impact, reacting after the fact, like a level meter. The others are centred on the change.']],
    moments: [['Los Voltaje 8 s', 8], ['Lua 16 s', 16, 'lua'], ['Petrunko 3 s', 3, 'petrunko'], ['Tomada slowed', 8, 'tomada']]},
  {id: 'paper', ask: 'How should the paper answer?', why: 'The same metric, now for real, much lighter than last round. Night stays hand-placed. Keep any number.',
    song: 'los', t: 17, len: 12, multi: true, opts: [
      ['White', {...plain}, 'For reference.'],
      ['Whisper', {...plain, bg: 'whisper'}, 'A faint tone that follows intensity all the time.'],
      ['Only at the top', {...plain, bg: 'late'}, 'White until the ride is really going, then a tone.'],
      ['Whisper + Night', {...plain, bg: 'whisper', night: 'on'}, 'The tone, then night on the song’s hand-placed drop.']],
    moments: [['Los Voltaje', 17], ['Petrunko drop', 16, 'petrunko'], ['Lua', 22, 'lua']]},
  {id: 'hit', ask: 'How does each hit behave as it gets stronger?', why: 'Your slider. Drag it: every hit takes that strength, and the grey shape shows where this song’s real hits sit. ¼ speed shows the shape of a hit.',
    song: 'los', t: 46.1, len: 3, multi: true, bench: true, opts: [
      ['Today', {...plain, hit: 'shake'}, 'Today’s shake, horizontal split and flash.'],
      ['Refined', {...plain, hit: 'refined'}, 'A kick into the line, a split along the impact, a flash.'],
      ['Held', {...plain, hit: 'strong'}, 'Refined, but strength also sets how long the hit lasts.'],
      ['Clean rider', {...plain, hit: 'clean'}, 'Held in every way, except the rider stays sharp. Not “Held when weak”: only the split’s layer differs.'],
      ['Trailing', {...plain, hit: 'trail'}, 'A separate design: no flash, a smaller kick, and all the fringe falls to one side.']],
    moments: [['Los Voltaje 46 s', 46.1], ['Petrunko strongest', 'strongest', 'petrunko'], ['Lua 30 s', 29.6, 'lua']]},
  {id: 'newhit', ask: 'Any of these on top of Held?', why: 'Not stronger or weaker versions: each gets its meaning from the ride. Sound on, especially for the last one. Keep any number.',
    song: 'los', t: 31, len: 5, multi: true, opts: [
      ['Held', {...plain, hit: 'strong'}, 'For reference.'],
      ['Ink ahead', {...plain, hit: 'ahead'}, 'The blow runs down the rail as ink; the rider catches up with it. Nothing fades back.'],
      ['Afterimage', {...plain, hit: 'ghost'}, 'The body the blow caught stays where it happened while the rider leaves it. May be too close to the stamp.'],
      ['Stay', {...plain, hit: 'stay'}, 'Strength says how hard, the rail says how long: a bounce is a tick, a slam into a grind is a press.'],
      ['By source', {...plain, hit: 'source'}, 'Drum hits kick; voice hits only trail. I suggested on day one that they shouldn’t flash the same way, and never tried it.'],
      ['Later', {...plain, hit: 'strong', when: 'hit'}, 'Held firing 25–75 ms later, at the measured hit instead of the touch. Only your ears can settle this.']],
    moments: [['Los Voltaje 31 s', 31], ['Petrunko 38 s', 38, 'petrunko'], ['Montagem Coma 40 s', 40, 'coma']]},
  {id: 'frame', ask: 'What keeps the picture clearest?', why: 'Twenty seconds. You keep finding wider clearer, and my 15 % was never tested against 7 %. Keep any number.',
    song: 'lua', t: 15, len: 20, multi: true, opts: [
      ['Steady, 15 %', {...plain}, 'Tamed, fixed at 15 % closer than today.'],
      ['Steady, 7 %', {...plain, size: 's58'}, 'The same, 7 % closer than today: more track, a smaller rider.'],
      ['Looser', {...plain, place: 'loose'}, 'Between Tamed and the official camera, which nothing has tried yet.'],
      ['Out when quiet', {...plain, tide: 'quietI'}, 'Now a real tide. Last round’s was secretly dozens of tiny steps, since the rider is airborne 60 % of the time.'],
      ['One breath', {...plain, tide: 'breath'}, 'At most one move in a song, and only if the song has a real quiet.'],
      ['Fitted', {...plain, tide: 'fit'}, 'No motion at all: each song gets the zoom that gives it the same on-screen speed.']],
    moments: [['Lua 15–35 s', 15], ['Los Voltaje 5–25 s', 5, 'los'], ['Montagem Coma 30 s', 30, 'coma']]},
  {id: 'ridge', ask: 'Does the mountain make sense now?', why: 'Nothing climbs any more, because the rider never does. The gaps were the slits I cut for hits; those are gone. Its change is slow: try the chips.',
    song: 'petrunko', t: 28, len: 6, multi: true, opts: [
      ['Waterline', {...plain, scheme: 'hokusai', music: 'ridge'}, 'A pale sea drains as the rider falls, and the mountain surfaces.'],
      ['Struck', {...plain, scheme: 'hokusai', music: 'ridgeStruck'}, 'Each hit inks its own column, so the mountain is built by impacts.']],
    moments: [['Start', 6], ['Middle', 28], ['Near the end', 50], ['Los Voltaje', 38, 'los']]},
  {id: 'scheme', ask: 'Which colours could be ours?', why: 'Whole print identities, each with its own night. Different songs may want different ones. Your ink-and-red stays. Keep any number.',
    song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['Graphite & red', {...plain, music: 'redbars', hit: 'strong'}, 'Where we are.'],
      ['Hokusai', {...plain, scheme: 'hokusai', music: 'redbars', hit: 'strong'}, 'Prussian blue on washi.'],
      ['Klein', {...plain, scheme: 'klein', music: 'redbars', hit: 'strong'}, 'A Swiss poster: stays on white.'],
      ['Bottle', {...plain, scheme: 'bottle', music: 'redbars', hit: 'strong'}, 'An old crime paperback.'],
      ['Salmon', {...plain, scheme: 'salmon', music: 'redbars', hit: 'strong'}, 'Financial newsprint. Claret and teal may be hard for colour-blind viewers.'],
      ['Blueprint', {...plain, scheme: 'blueprint', music: 'redbars', hit: 'strong'}, 'Blue is the daylight here.'],
      ['Black', {...plain, scheme: 'black', music: 'redbars', hit: 'strong'}, 'Dark for the whole film.']],
    moments: [['Lua 36 s', 36.5], ['Fork instead of bars', 36.5, null, {music: 'red'}], ['Night', 31, null, {night: 'on'}]]},
  {id: 'top', ask: 'What belongs in the empty top of the frame?', why: 'Every round worked only on the bottom; you wanted things around the ride, and the top is nearly empty paper. Keep any number.',
    song: 'los', t: 30, len: 6, multi: true, opts: [
      ['Nothing', {...plain, music: 'red', hit: 'strong'}, 'For reference.'],
      ['Vignette', {...plain, music: 'red', hit: 'strong', top: 'vignette'}, 'Still, and faint: your description from the first reviews.'],
      ['Sun', {...plain, scheme: 'hokusai', music: 'redbars', hit: 'strong', top: 'sun'}, 'One big disc that swells with intensity. Not a visualiser; a poster.'],
      ['Title', {...plain, music: 'red', hit: 'strong', top: 'title'}, 'The song’s name, set like a poster.'],
      ['Score', {...plain, music: 'red', hit: 'strong', top: 'score'}, 'A new try at round 1’s Score: hits arrive before the rider reaches them, so the sync can be seen. Bars are drums, dots are voice.']],
    moments: [['Los Voltaje 30 s', 30], ['Quiet part', 12], ['Petrunko 38 s', 38, 'petrunko']]},
  {id: 'open', ask: 'Which opening would stop your thumb?', why: 'Watch the first seconds as if you had never seen this. Today shows rider, line and band at once; ours opens nearly empty.',
    song: 'petrunko', t: 0, len: 4, opts: [
      ['Whole course', {...plain, music: 'red', hit: 'strong', ends: 'overture'}, 'As it is now: the band arrives with the zoom.'],
      ['Band from frame 0', {...plain, music: 'red', hit: 'strong', ends: 'overture', bandIn: 'present'}, 'The same, with the band already there.'],
      ['A little larger', {...plain, music: 'red', hit: 'strong', ends: 'overture', open: 'small'}, 'A rider of about 20 px; last round’s was about 65. A literal +100 % of a 1–2 px speck would not show.'],
      ['Larger', {...plain, music: 'red', hit: 'strong', ends: 'overture', open: 'medium'}, 'About 30 px, opening only.'],
      ['Straight in', {...plain, music: 'red', hit: 'strong', ends: 'closing'}, 'No overture: on the rider from frame 0, with the whole course kept for the end.']],
    moments: [['Petrunko', 0], ['Lua', 0, 'lua'], ['Los Voltaje', 0, 'los']]},
  {id: 'whole', ask: 'Now the bigger questions', why: 'After the films, please. In your own words, and any of these you like: Who is this for: people who have never seen it, or people who already get it? Which film would you post today? Who picks the look for each song? Should each song get a small hand-written sheet, with Night as its first line?',
    song: 'los', t: 30, len: 8, open: true, opts: [['', {...plain, music: 'red', hit: 'strong', bg: 'whisper', night: 'on'}, '']]},
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
const STORE = 'concept-lab-answers-r4';
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
    let run = 0; for (let f = fc ?? f0; native.contacts[f]?.length; f++) run++;
    return {...h, run: run / FPS, tc: fc === null ? h.t : Math.min(h.t, fc / FPS), pos: pos ?? centres[Math.min(f0, centres.length - 1)], ang, nrm, chain: line?.chain, I: power(h.s), vel: {x: cb.x - ca.x, y: cb.y - ca.y}};
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
  const ridge = ridgeOf(centres, hits);
  return {...data, red, ridge, frames: native.frames, lines, grid, G, centres, R, hits, bbox: {x0, y0, x1, y1}, drives, night,
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
// The Ridge: the course as a mountain descending left to right, whole from the first frame. The rider falls in 91–98 % of frames,
// so nothing here climbs. Waterline: a pale sea drains with the rider's real altitude and the mountain surfaces out of it.
// Struck: each hit inks its own column. Nothing is ever cut to paper, which is what caused the gaps at jumps.
function ridgeOf(centres, hits) {
  const n = centres.length, mx = centres.reduce((a, p) => a + p.x, 0) / n, my = centres.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0; for (const p of centres) {sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my);}
  const a = sxy / sxx, det = centres.map(p => p.y - (my + a * (p.x - mx))), lo = Math.min(...det), hi = Math.max(...det), x0 = centres[0].x, x1 = centres.at(-1).x;
  const us = new Float64Array(W + 1).fill(0.5); let f = 0;
  for (let u = 0; u <= W; u++) {const x = x0 + (x1 - x0) * u / W; while (f + 1 < n && centres[f + 1].x < x) f++; us[u] = (det[f] - lo) / Math.max(1, hi - lo);}
  const uOf = t => {const p = centres[clamp(Math.round(t * FPS), 0, n - 1)]; return W * clamp((p.x - x0) / (x1 - x0), 0, 1);};
  const top = Float64Array.from(us, (v, u) => -26 - 105 * (1 - v) - 155 * (1 - u / W)), crest = Math.min(...top); // heights above the base line
  const path = new Path2D(); path.moveTo(0, 0); for (let u = 0; u <= W; u += 2) path.lineTo(u, top[u]); path.lineTo(W, top[W]); path.lineTo(W, 0); path.closePath();
  // the level is driven by the rider's raw altitude: its running lowest point, which is new on 80–93 % of frames
  const rec = new Float64Array(n); let m = centres[0].y; for (let i = 0; i < n; i++) rec[i] = m = Math.max(m, centres[i].y);
  const y0 = centres[0].y, yN = m, level = at => crest + (2 - crest) * (rec[clamp(Math.round(at), 0, n - 1)] - y0) / Math.max(1, yN - y0);
  return {path, level, crest, cols: hits.map(h => ({u: uOf(h.tc), t: h.tc, w: 2 + 10 * h.I, e: h.I}))};
}
function drawRidge(t, at, alpha, th, form) {
  const r = S.ridge, base = 0.825 * H + bandShift(), p = SCHEMES[mix.scheme], mass = th.dark ? p.nightInk : p.mass, pale = mixHex(th.bg, mass, 0.16);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(0, base);
  ctx.fillStyle = pale; ctx.fill(r.path); ctx.clip(r.path);
  ctx.fillStyle = mass;
  if (form === 'ridge') ctx.fillRect(0, r.crest - 2, W, r.level(at) - r.crest + 2);
  else {
    for (const c of r.cols) if (c.t <= t) ctx.fillRect(c.u - c.w / 2, r.crest - 2, c.w, -r.crest + 4);
    ctx.fillStyle = p.accent; for (const c of r.cols) {const age = t - c.t, w = excess(c.e); if (age >= 0 && age < 0.25 && held(age, w) > 0.15) {const cw = Math.max(8, c.w); ctx.fillRect(c.u - cw / 2, r.crest - 2, cw, -r.crest + 4);}}
  }
  ctx.restore();
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
  clean: {kick: 1, split: 1, flash: 1, held: 1, cleanRider: 1},  // the world tears, the rider stays sharp
  trail: {kick: 0.6, trail: 1},                                  // discreet: all the fringe falls beyond the line
  ahead: {kick: 1, split: 1, flash: 1, held: 1, ahead: 1},       // the blow runs down the rail; the rider's real speed is the recovery
  ghost: {kick: 1, split: 1, flash: 1, held: 1, ghost: 1},       // the body the blow caught stays where it happened
  stay: {kick: 1, split: 1, flash: 1, held: 1, stay: 1},         // strength says how hard, the rail says how long
  source: {kick: 1, split: 1, flash: 1, held: 1, source: 1},     // a drum strikes; a voice only trails
};
// Strength as duration: the excess strength w = e^2.2 sets both amplitude and hold. The peak is held at least one full
// 60 fps frame (no hit loses its peak to the frame grid); recovery ends exactly, never later than 0.25 s.
const excess = e => Math.pow(e, 2.2);
const held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
const acc = () => BUNDLES[mix.hit] ?? {};
const envelope = (h, age, w) => {if (!acc().stay) return held(age, w); const hold = clamp(h.run, (1 + 2 * w) / 60, 0.18); return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / 0.07), 2);};
const decay = (age, tau0, e) => age < 0 ? 0 : Math.exp(-age / (tau0 * (0.8 + 0.4 * e)));
function activeHits(t, span) {
  const out = [];
  const late = mix.when === 'hit'; for (const h of S.hits) {const at = late ? h.t : h.tc; if (at > t + 0.001) {if (h.tc > t + 0.001) break; continue;} const age = t - at; if (age <= span) out.push({h, age, e: forceE ?? h.I});}
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
    if (A.kick && !(A.source && h.src !== 'drums')) {const a = A.kick * (A.held ? (10 + 26 * w) * envelope(h, age, w) : (6 + 20 * e) * decay(age, 0.075, e)); dx += i.x * a; dy += i.y * a;}
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
    fade(0, 0.2 * H, 0.05); fade(H, 0.72 * H, 0.08);
  }
  if (mix.top === 'sun') {ctx.fillStyle = th.dark ? p.nightInk : p.accent; ctx.beginPath(); ctx.arc(0.74 * W, 0.17 * H, W * (0.1 + 0.09 * intensityAt(t)), 0, 2 * Math.PI); ctx.fill();}
  if (mix.top === 'title') {ctx.fillStyle = th.ink; ctx.font = '800 104px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; let y = 0.06 * H; for (const w of SONGS[song].replace(/\s*\(.*\)/, '').toUpperCase().split(' ')) {ctx.fillText(w, 0.07 * W, y); y += 106;}}
  if (mix.top === 'score') {
    // hits arrive at a fixed playhead above the rider; drums are bars, voices are dots, and each takes the accent as the rider reaches it
    const px = 0.62 * W, y = 0.15 * H, speed = 340; ctx.strokeStyle = th.ink; ctx.globalAlpha = alpha * 0.25; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.moveTo(px, y - 130); ctx.lineTo(px, y + 14); ctx.stroke();
    for (const h of S.hits) {const d = h.tc - t; if (d < -0.7) continue; if (d > 1.3) break; const x = px + d * speed, age = -d, w = excess(h.I), on = age >= 0 && held(age, w) > 0.1, drum = h.src === 'drums';
      ctx.globalAlpha = alpha * (d < 0 ? Math.max(0.15, 1 + d / 0.7) * 0.5 : 0.9); ctx.fillStyle = on ? p.accent : th.ink; ctx.globalAlpha = on ? alpha : ctx.globalAlpha;
      if (drum) {const b = 26 + 96 * h.I; ctx.fillRect(x - 7, y - b, 14, b);} else {ctx.beginPath(); ctx.arc(x, y - 34, 11 + 13 * h.I, 0, 2 * Math.PI); ctx.fill();}}
  }
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
// Ink ahead: a hit pushes the ink forward along the rail; nothing fades back, the rider simply catches up with it.
function inkFront(t, at) {if (!acc().ahead) return at; let fr = at; for (const h of S.hits) {if (h.tc > t + 0.001) break; if (t - h.tc > 0.6) continue; fr = Math.max(fr, (h.tc + 0.06 + 0.24 * excess(forceE ?? h.I)) * FPS);} return fr;}
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
  // the rider stays on its own screen point at any size; at the opening a size floor can keep it readable on the whole-course view
  const floor = !v.ending && v.over > 0 ? {plain: 0, small: 0.8, medium: 1.2}[mix.open] : 0, zr = floor ? Math.cbrt(v.z ** 3 + floor ** 3) : v.z, px = v.rx + ox, py = v.ry + oy;
  return {x: v.R.x + (W / 2 - px) / zr, y: v.R.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
}
// Afterimage: the rider's exact pose at the hit, flat, left at its world position while the real rider leaves it.
function drawGhosts(sheet, t, v, hc, k, th) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  const p = SCHEMES[mix.scheme];
  for (const {h, age, e} of activeHits(t, 0.3)) {
    const life = 0.12 + 0.13 * excess(e); if (age > life) continue;
    paint(octx, riderCamera(v, hc.dx, hc.dy, k), sheet, riderAt(S.frames, h.tc * FPS), h.tc * FPS);
    octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = mixHex(mixHex(th.bg, th.ink, 0.3), p.accent, smoothstep((e - 0.2) / 0.5)); octx.fillRect(0, 0, overlay.width, overlay.height); octx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.pow(1 - age / life, 0.6); ctx.drawImage(overlay, 0, 0); ctx.restore();
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
  const A = acc(); if (!(A.split || A.trail)) return;
  let ox = 0, oy = 0, trailing = !!A.trail;
  for (const {h, age, e} of activeHits(t, 0.6)) {const voice = A.source && h.src !== 'drums'; if (voice) trailing = true; const w = excess(e), a = (voice ? 0.7 : 1) * (A.held ? (2 + 16 * w) * envelope(h, age, w) : (2 + 12 * e) * decay(age, 0.06, e)), i = into(h); ox += i.x * a; oy += i.y * a;}
  const n = Math.hypot(ox, oy), cap = A.held ? 18 : 14; if (n > cap) {ox *= cap / n; oy *= cap / n;}
  if (Math.hypot(ox, oy) * k > 1) channelSplit(ox * k, oy * k, trailing ? 'trail' : 'centre');
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
  if (A.flash) {
    let f = 0; for (const {h, age, e} of hits) {if (A.source && h.src !== 'drums') continue; const w = excess(e); f = Math.max(f, A.held ? (0.1 + 0.2 * w) * envelope(h, age, w) : A.flash * (0.1 + 0.18 * e) * decay(age, 0.05, e));}
    f *= 1 - 0.6 * darkNow; // on night the flash would only grey the black
    // the flash lifts the ink toward the paper, on any paper; a white flash would tint a coloured one
    if (f > 0.004) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f; ctx.fillStyle = darkNow ? '#fff' : paperNow; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
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
  const th = themeAt(t), v = bookend(t, cameraAt(mix, at), at), hc = hitCamera(t);
  overNow = v.over; darkNow = th.dark; paperNow = th.bg;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.top !== 'none') {const a = (1 - v.over) ** 2; if (a > 0.003) drawTop(t, a, th);}
  const band = mix.bandIn === 'present' && !v.ending ? 1 : (1 - v.over) ** 2;
  if (band > 0.003 && ['red', 'redblocks', 'redbars', 'stems', 'iris', 'slits', 'bars3', 'blocks'].includes(mix.music)) drawSpectrum(t, mix.music, band, th);
  if (mix.music === 'ridge' || mix.music === 'ridgeStruck') {const a = v.ending ? 1 : band; if (a > 0.003) drawRidge(t, at, a, th, mix.music);} // the finished mountain holds through the ending
  const cc = {...v, ax: v.ax + hc.dx, ay: v.ay + hc.dy};
  ctx.setTransform(cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k);
  drawLines(visibleLines(cc), at, cc.z, th);
  if (acc().ghost) drawGhosts(sheet, t, v, hc, k, th);
  if (acc().cleanRider) worldSplit(t, k); // the world tears around a rider that stays sharp
  drawRider(sheet, riderCamera(v, hc.dx, hc.dy, k), at);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (v.over > 0.02 && v.ending && mix.close === 'ring') drawMarker(v, hc.dx, hc.dy, th);
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
    const data = await (await fetch(`../data/${key}.json`)).json();
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
  document.body.classList.add('feelmode'); $('feel').hidden = false; mix = {...base}; loop = null;
  const pairs = await (await fetch('../intensity/pairs.json')).json(), got = (() => {try {return JSON.parse(localStorage.getItem(FEEL) ?? '{}');} catch {return {};}})();
  let i = pairs.findIndex(p => !got[p.id]); if (i < 0) i = pairs.length;
  const flag = document.createElement('div'); flag.className = 'sideflag'; flag.hidden = true; $('stagewrap').append(flag);
  const pick = [...$('feelpick').children], enable = on => pick.forEach(b => {b.disabled = !on;});
  const show = () => {
    const done = i >= pairs.length, n = Object.keys(got).length;
    $('qprogress').textContent = done ? 'All done' : `Pair ${i + 1} of ${pairs.length}`;
    $('concept').textContent = done ? 'Thank you.' : 'Which passage feels more intense?';
    $('line').textContent = done ? 'Copy this and paste it to me with your other answers.' : 'Sound on. Five seconds each. Go with your gut, and whatever “intense” means to you.';
    $('feelplay').hidden = pick[0].parentNode.hidden = done; $('feelsummary').hidden = $('feelcopy').hidden = !done;
    $('feelnow').textContent = done ? '' : ''; enable(false); $('feelplay').textContent = 'Play A, then B';
    if (done) $('feelsummary').value = 'Blind pairs: ' + pairs.map(p => `${p.id}:${got[p.id]}`).join(' ');
  };
  const clip = async (c, name) => {
    if (song !== c.song || !S) await loadSong(c.song); flag.textContent = name; flag.hidden = false; seconds = c.t; await draw();
    await music.play(c.t, 1); playing = music.playing; if (!playing) throw new Error('Sound did not start. Tap again.');
    await new Promise(res => {const end = c.t + 5, f = () => {if (seconds >= end || !playing) {res(); return;} requestAnimationFrame(f);}; f();});
    pause(); flag.hidden = true;
  };
  $('feelplay').onclick = async () => {
    const p = pairs[i]; $('feelplay').disabled = true; enable(false);
    try {await clip(p.A, 'A'); await new Promise(r => setTimeout(r, 450)); await clip(p.B, 'B'); enable(true); $('feelplay').textContent = 'Play again';}
    catch (e) {$('feelnow').textContent = e.message;}
    $('feelplay').disabled = false;
  };
  pick.forEach(b => {b.onclick = () => {got[pairs[i].id] = b.dataset.v; try {localStorage.setItem(FEEL, JSON.stringify(got));} catch {} i = pairs.findIndex(p => !got[p.id]); if (i < 0) i = pairs.length; show();};});
  $('feelcopy').onclick = async () => {const box = $('feelsummary'); let ok = false; try {await navigator.clipboard.writeText(box.value); ok = true;} catch {} if (!ok) {box.focus(); box.select(); try {ok = document.execCommand('copy');} catch {}} $('feelcopy').textContent = ok ? 'Copied ✓' : 'Selected: copy it from the box';};
  show();
}
if (feelmode) {song = 'los'; mix = {...base}; seconds = 4; loadSong(song).then(runFeel).catch(e => status('Could not load: ' + e.message));}
else if (qmode) {song = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)].song; loadSong(song).then(() => goQuestion(qi)).catch(e => status('Could not load: ' + e.message));}
else loadSong(song).catch(e => status('Could not load: ' + e.message));
