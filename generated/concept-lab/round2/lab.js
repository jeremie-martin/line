// Concept lab, round 2: the real saved ride, drawn live with the vendored rider artwork and
// native replay, an honest automatic camera (cam.js), and independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '../dist/native.js';
import * as C from './cam.js';

const W = 1080, H = 1920, FPS = 40;
const INK = '#15181d', PENCIL = '#b4bcc8', NIGHT = '#14171d';
const SRC = {drums: '#15181d', vocals: '#2b59d6', sung: '#2b59d6', bass: '#7b3fbf', other: '#e0532f'};
const Z0 = 5.4; // today's vertical zoom
const SIZE_Z = {s58: 5.8, s62: 6.2, s68: 6.8, s73: 7.3};

const DIMS = {
  size: ['Size', {today: 'Today', r1: 'Round 1 camera', s58: 'Today’s size, honest', s62: 'A bit closer', s68: 'Closer', s73: 'Closest'}],
  director: ['Camera', {steady: 'Steady', tripod: 'Breathes, with two locked-off shots', breathe: 'Breathes with the music', build: 'Builds, releases on the downbeat', flight: 'Frames each jump, cuts in on the drop', lean: 'Leans into strong hits', lookback: 'Looks back in quiet gaps', director: 'Director (all of these)'}],
  feel: ['Camera feel', {strict: 'Pinned: never against the rider', loose: 'Operator: smooth, small slips allowed'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course'}],
  bg: ['Background', {white: 'White', porcelain: 'Porcelain', tones: 'Section tones', colours: 'Section colours', night: 'Night for the peak'}],
  ink: ['Line', {ink: 'Ink', inking: 'Pencil → ink'}],
  land: ['Before a landing', {none: 'Nothing', mark: 'The landing spot pre-inks'}],
  arrange: ['Arrangement', {full: 'Always on', dropouts: 'Band and accents drop out in quiet sections'}],
  music: ['Music (lower band)', {none: 'None', red: 'One red', bars: 'Today’s bars', bars3: 'Bars · three colours', blocks: 'Blocks', stems: 'Tuning fork', fork2: 'Tuning fork · mirrored', iris: 'Iris', slits: 'Cobalt', score: 'Score'}],
  hit: ['On each hit', {none: 'Nothing', shake: 'Today’s shake & split', refined: 'Today, refined', graphite: 'Graphite', voltage: 'Voltage', porcelain: 'Porcelain', weight: 'Weight', pluck: 'Plucked line'}],
};
const base = {size: 's62', feel: 'strict', director: 'steady', ends: 'none', bg: 'white', ink: 'inking', land: 'none', arrange: 'full', music: 'none', hit: 'none'};
const PRESETS = [
  {id: 'today', name: 'Today', line: 'Today’s camera, bars, shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, size: 'today', ink: 'ink', music: 'bars', hit: 'shake'}},
  {id: 'ride', name: 'Ride', line: 'The honest camera, a little wider than round 1, pencil to ink. Nothing else.', mix: {...base}},
  {id: 'graphite', name: 'Graphite', line: 'Pencil to ink, the ink pressing at each hit with a small kick, the camera breathing with the music, the tuning fork, whole-course opening and ending.',
    mix: {...base, director: 'breathe', ends: 'overture', hit: 'graphite', music: 'stems'}},
  {id: 'refined', name: 'Today, refined', line: 'Today’s spirit with direction: a kick into the line, a split along the impact, a flash. The full director camera, three-colour bars.',
    mix: {...base, director: 'director', ends: 'overture', hit: 'refined', music: 'bars3'}},
  {id: 'voltage', name: 'Night voltage', line: 'The drop section turns to night. Trailing split and a line slice on hits, Iris below, the director camera.',
    mix: {...base, director: 'director', ends: 'overture', hit: 'voltage', music: 'iris', bg: 'night'}},
  {id: 'porcelain', name: 'Porcelain', line: 'Section colours, a zoom pulse and ink pressure on hits, blocks below, the camera building through each section and releasing on the downbeat.',
    mix: {...base, director: 'build', ends: 'overture', hit: 'porcelain', music: 'blocks', bg: 'colours'}},
  {id: 'weight', name: 'Weight', line: 'Hits land with weight: letterbox bars punch in, a slight roll, a kick. Mirrored fork, section tones, the camera framing every jump.',
    mix: {...base, director: 'flight', ends: 'overture', hit: 'weight', music: 'fork2', bg: 'tones'}},
  {id: 'onered', name: 'One red', line: 'Monochrome with the scarf’s red. The band and accents drop out in quiet sections and return on the downbeat; the landing spot pre-inks; two locked-off shots.',
    mix: {...base, director: 'tripod', ends: 'overture', hit: 'graphite', music: 'red', arrange: 'dropouts', land: 'mark'}},
  {id: 'pluck', name: 'Plucked line', line: 'The struck rail rings like a string, as hard as the hit; the camera looks back in the quiet gaps.', mix: {...base, director: 'lookback', hit: 'pluck', music: 'slits'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma'};
const plain = {...base};
// Each option: [label, mix, note shown when tapped].
const QUESTIONS = [
  {id: 'honest', ask: 'Which camera feels truthful and alive?', why: 'Same zoom for all three. Watch the rider’s height on screen around the landing.',
    song: 'los', t: 26.9, len: 3, opts: [
      ['Round 1', {...plain, size: 'r1', ink: 'ink'}, 'Reacts to landings early: the rider slides up to 250 px up the screen while falling.'],
      ['Operator', {...plain, size: 's73', ink: 'ink', feel: 'loose'}, 'Smooth; the rider dips into landings. Allows small slips, about as much as today’s camera.'],
      ['Pinned', {...plain, size: 's73', ink: 'ink'}, 'Never moves the rider against its motion. The rider barely moves in the frame.']],
    moments: [['Landing at 28 s', 26.9], ['Your loop at 19.5 s', 19.5], ['Landing at 45 s', 43.8]]},
  {id: 'size', ask: 'How close, now that the line inks?', why: 'Pencil → ink and the new camera in all three. Wider shows the inking; closer fills the frame.',
    song: 'los', t: 44, len: 4, opts: [
      ['Today', {...plain, size: 'today'}, 'Today’s camera and size.'],
      ['A bit closer', {...plain, size: 's62'}, 'About 15 % closer than today.'],
      ['Round 1 (closest)', {...plain, size: 's73'}, 'Round 1’s size, 35 % closer than today.']],
    moments: [['Los Voltaje 44 s', 44], ['Petrunko 30 s', 30, 'petrunko'], ['Lua 31 s', 31, 'lua']]},
  {id: 'camera', ask: 'Which camera ideas should we keep?', why: 'Eleven seconds across several sections. Keep any number.',
    song: 'lua', t: 20.5, len: 11, multi: true, opts: [
      ['Steady', {...plain}, 'A fixed zoom, for reference.'],
      ['Breathes', {...plain, director: 'breathe'}, 'Closer when the music is busy, wider when it opens up.'],
      ['Builds', {...plain, director: 'build'}, 'Pushes in through each section, releases on the next downbeat.'],
      ['Frames jumps', {...plain, director: 'flight'}, 'Widens before landings so they show earlier; cuts in on drops.'],
      ['Looks back', {...plain, director: 'lookback'}, 'In a quiet stretch, pulls out over the ink behind and the pencil ahead.'],
      ['Director', {...plain, director: 'director'}, 'Breathes, leans into strong hits, cuts on drops and looks back.']],
    moments: [['Lua 20–31 s', 20.5], ['Lua 8–19 s', 8], ['Petrunko 15–26 s', 15, 'petrunko'], ['Los Voltaje 17–28 s', 17, 'los']]},
  {id: 'hit', ask: 'Which hits feel right?', why: 'One strength scale for every song; each accent points into the line that was struck. Keep any number.',
    song: 'los', t: 46.1, len: 4, multi: true, opts: [
      ['Today', {...plain, hit: 'shake'}, 'Today’s shake, horizontal colour split and flash.'],
      ['Today, refined', {...plain, hit: 'refined'}, 'A kick into the line, a colour split along the impact, a flash.'],
      ['Graphite', {...plain, hit: 'graphite'}, 'The ink presses into the paper; a small kick. Monochrome.'],
      ['Voltage', {...plain, hit: 'voltage'}, 'A trailing colour split, and the far side of the line slips.'],
      ['Porcelain', {...plain, hit: 'porcelain'}, 'A zoom pulse from the contact point, with ink pressure.'],
      ['Weight', {...plain, hit: 'weight'}, 'Letterbox bars punch in, a slight roll, a kick.']],
    moments: [['Los Voltaje 46 s', 46.1], ['Petrunko strongest', 'strongest', 'petrunko'], ['Lua drums 30 s', 29.6, 'lua'], ['No Batidão 30 s', 29.4, 'batidao']]},
  {id: 'band', ask: 'Which lower bands should stay in the pool?', why: 'All sit above the comment bubble. Keep any number.',
    song: 'petrunko', t: 24.5, len: 4, multi: true, opts: [
      ['Today’s bars', {...plain, music: 'bars'}, 'As shipped.'],
      ['Three colours', {...plain, music: 'bars3'}, 'Codex’s Porcelain mirror bars.'],
      ['Blocks', {...plain, music: 'blocks'}, 'Codex’s Electric registration blocks.'],
      ['Tuning fork', {...plain, music: 'stems'}, 'Larger than before.'],
      ['Mirrored fork', {...plain, music: 'fork2'}, 'Mirrored about a centre line: fills its band, nothing cut.'],
      ['Iris', {...plain, music: 'iris'}, 'The current contour with its real recent history.'],
      ['Cobalt', {...plain, music: 'slits'}, 'Open brackets.'],
      ['One red', {...plain, music: 'red'}, 'Graphite stems; only the loudest frequencies turn the scarf’s red.']],
    moments: [['Petrunko 24 s', 24.5], ['Lua 36 s', 36.5, 'lua'], ['Let the World Burn 25 s', 25, 'burn']]},
  {id: 'bg', ask: 'Should the background follow the song?', why: 'From Petrunko’s suspend into its drop. Keep any number.',
    song: 'petrunko', t: 20.4, len: 5, multi: true, opts: [
      ['White', {...plain}, 'Plain white.'],
      ['Porcelain', {...plain, bg: 'porcelain'}, 'A barely cool white.'],
      ['Section tones', {...plain, bg: 'tones'}, 'Each section a grey as deep as it is intense.'],
      ['Section colours', {...plain, bg: 'colours'}, 'Each section its own pale tint.'],
      ['Night for the drop', {...plain, bg: 'night'}, 'The main drop turns dark, a cut on the downbeat.']],
    moments: [['Petrunko drop', 20.4], ['Petrunko end of drop', 38.5], ['Los Voltaje', 22.5, 'los'], ['Montagem Coma', 32, 'coma']]},
  {id: 'ideas', ask: 'New ideas from your old feedback: keep any?', why: 'Petrunko’s suspend into its drop. Keep any number.',
    song: 'petrunko', t: 19.6, len: 6, multi: true, opts: [
      ['Without', {...plain, music: 'stems', hit: 'graphite'}, 'For reference.'],
      ['Drop-outs', {...plain, music: 'stems', hit: 'graphite', arrange: 'dropouts'}, 'Quiet sections lose the band and accents; all return at once on the downbeat.'],
      ['Landing pre-inks', {...plain, music: 'stems', hit: 'graphite', land: 'mark'}, 'While the rider flies, the spot where it lands inks itself in.'],
      ['Locked-off shot', {...plain, music: 'stems', hit: 'graphite', director: 'tripod'}, 'On a downbeat the camera stops dead; the rider crosses the frame; cut back.'],
      ['One red', {...plain, music: 'red', hit: 'graphite'}, 'Monochrome, with the scarf’s red only on the loudest frequencies.'],
      ['All four', {...plain, music: 'red', hit: 'graphite', arrange: 'dropouts', land: 'mark', director: 'tripod'}, 'Everything above together.']],
    moments: [['Petrunko drop', 19.6], ['Lua quiet', 19.5, 'lua']]},
  {id: 'ends', ask: 'Does the opening and ending look right now?', why: 'The rider is ringed while tiny; the ending draws the ride’s path as one stroke. Dashed rails are real geometry.',
    song: 'lua', t: 0, len: 4, opts: [['Whole course', {...plain, ends: 'overture'}, 'Opening and ending on the whole course.'], ['No bookends', {...plain}, 'For reference.']],
    moments: [['Opening', 0], ['Ending', 'end'], ['Petrunko ending', 'end', 'petrunko']]},
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
const STORE = 'concept-lab-answers-r2';
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
  // landings: for each flight of ≥ 0.25 s, where (and on which line) it touches down
  const landings = [];
  for (let f = 1; f < centres.length; f++) {
    if (!R.air[f] || R.air[f - 1]) continue; let g = f; while (g < centres.length && R.air[g]) g++;
    if (g >= centres.length || (g - f) / FPS < 0.25) continue;
    const c = centres[g]; let best = Infinity, pos = null, ang = 0, chain;
    for (const id of native.contacts[g] ?? []) {
      const l = byId.get(id); if (!l) continue;
      const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1, u = clamp(((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2, 0, 1);
      const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < best) {best = d; pos = p; ang = Math.atan2(dy, dx); chain = l.chain;}
    }
    if (pos) landings.push({f0: f, f1: g, pos, ang, chain});
  }
  // quiet sections for drop-outs: sparse relative to the song (or near-silent)
  const dens = R.sect.map(s => s.density), dmax = Math.max(...dens);
  const quiet = R.sect.map(s => s.density < Math.max(0.9, 0.35 * dmax) && s.t1 - s.t0 > 1);
  const reentry = R.sect.map((s, i) => {const h = hits.find(h => h.tc >= s.t0 - 0.05); return h && h.tc < s.t1 ? h.tc : s.t0;});
  // the whole-course view frames the ride itself (rails reaching past it may crop), with a margin
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  x0 -= 80; x1 += 80; y0 -= 80; y1 += 80;
  // section character for backgrounds: density and strength ranked within the song
  const rank = key => {const v = R.sect.map(s => s[key]), lo = Math.min(...v), hi = Math.max(...v); return v.map(x => hi > lo ? (x - lo) / (hi - lo) : 0.5);};
  const dr = rank('density'), sr = rank('strength');
  const intensity = R.sect.map((s, i) => 0.6 * dr[i] + 0.4 * sr[i]);
  // the song's main drop: a long, strong section (length matters, so a short roll never wins)
  const lens = R.sect.map(s => s.t1 - s.t0), maxLen = Math.max(...lens);
  const drop = R.sect.map((s, i) => lens[i] < 6 ? -1 : 0.5 * sr[i] + 0.25 * dr[i] + 0.25 * lens[i] / maxLen);
  const peak = drop.indexOf(Math.max(...drop));
  return {...data, frames: native.frames, lines, grid, G, centres, R, hits, path: R.R, landings, quiet, reentry, bbox: {x0, y0, x1, y1}, intensity, peak,
    follow: N.follower(data.trace.frames), cams: new Map()};
}

// ── camera ─────────────────────────────────────────────────────────────────
function camFrames(m) {
  const key = m.size + '|' + m.director + '|' + m.feel;
  if (!S.cams.has(key)) {
    let cam;
    if (m.size === 'today') cam = S.centres.map((_, f) => {const c = S.follow({w: W, h: H, z: Z0}, f); return {z: Z0, ax: W / 2, ay: 0.35 * H, x: c.x, y: c.y};});
    else if (m.size === 'r1') cam = C.roundOneCamera(S.centres);
    else cam = C.buildCamera(S.R, {base: SIZE_Z[m.size], director: m.director, compose: {mode: m.feel}});
    S.cams.set(key, cam);
  }
  return S.cams.get(key);
}
function cameraAt(m, at) {
  const cam = camFrames(m), i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1);
  const a = cam[i], b = cam[j];
  if (b.cut || Math.abs(b.z / a.z - 1) > 0.06) return {...(u < 0.5 ? a : b)}; // a cut stays a cut
  const l = (p, q) => p + (q - p) * u;
  return {z: l(a.z, b.z), ax: l(a.ax, b.ax), ay: l(a.ay, b.ay), x: l(a.x, b.x), y: l(a.y, b.y)};
}
// Opening and ending on the whole course: log-zoom, the centre gliding so the target point moves naturally.
function bookend(t, c) {
  if (mix.ends !== 'overture') return {...c, over: 0};
  const b = S.bbox, zo = Math.min(0.78 * W / (b.x1 - b.x0), 0.5 * H / (b.y1 - b.y0));
  const o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2}, land = S.hits.find(h => h.tc >= 1.3)?.tc ?? 1.6;
  const t1 = Math.min(2.2, land), tE = S.duration - 2.8;
  let u = 1;
  if (t < t1) u = smoothstep((t - 0.35) / (t1 - 0.35));
  else if (t > tE) u = 1 - smoothstep((t - tE) / 2.5);
  if (u >= 1) return {...c, over: 0};
  const z = Math.exp(Math.log(zo) + (Math.log(c.z) - Math.log(zo)) * u);
  const w = (1 / zo - 1 / z) / (1 / zo - 1 / c.z);
  return {z, ax: W / 2 + (c.ax - W / 2) * w, ay: 0.4 * H + (c.ay - 0.4 * H) * w, x: o.x + (c.x - o.x) * w, y: o.y + (c.y - o.y) * w, over: 1 - w};
}

// ── hit effects ────────────────────────────────────────────────────────────
// One absolute strength curve (C.strength, 0..1) drives every accent; nothing is ranked or tiered.
// Every accent peaks on the first frame at or after the contact onset and decays as exp(−age/τ),
// τ = τ0·(0.8 + 0.4e). Directions come from the struck line: î points into the line, from the rider's side.
const BUNDLES = {
  none: {}, shake: {today: 1},
  refined: {kick: 1, split: 1, flash: 1},      // today's spirit, every part with a direction
  graphite: {pressure: 1, kick: 0.5},           // the ink answers; for pencil → ink
  voltage: {trail: 1, slice: 1, kick: 0.6},     // electronic
  porcelain: {pulse: 1, pressure: 1},           // clean pop
  weight: {thump: 1, roll: 1, kick: 0.5},       // bass, heavy
  pluck: {pluck: 1, kick: 0.4},                 // the rail rings like a string
};
const acc = () => BUNDLES[mix.hit] ?? {};
const decay = (age, tau0, e) => age < 0 ? 0 : Math.exp(-age / (tau0 * (0.8 + 0.4 * e)));
function activeHits(t, span) {
  const out = [];
  for (const h of S.hits) {if (h.tc > t + 0.001) break; const age = t - h.tc; if (age <= span) out.push({h, age, e: h.I});}
  return out;
}
const into = h => ({x: -h.nrm.x, y: -h.nrm.y});
/** Camera-level response: an offset (px), a zoom factor and a roll (rad), both pivoting on the contact point. */
function hitCamera(t) {
  const A = acc(); let dx = 0, dy = 0, zf = 1, roll = 0, pivot = null, best = 0;
  if (A.today) {
    const m = trauma(t, {min: 0.22, gain: 1.6, decay: 7, power: 1.5}), w = 2 * Math.PI * 9;
    return {dx: 10 * m * Math.sin(w * t), dy: 10 * m * Math.sin(w * 1.37 * t + 1.7), zf, roll, pivot};
  }
  for (const {h, age, e} of activeHits(t, 0.6)) {
    const i = into(h);
    if (A.kick) {const a = A.kick * (6 + 20 * e) * decay(age, 0.075, e); dx += i.x * a; dy += i.y * a;}
    if (A.pulse) zf *= 1 + (0.03 + 0.09 * e) * decay(age, 0.1, e);
    if (A.roll) {
      const m = h.vel ?? {x: 1, y: 0}, sgn = Math.sign(m.x * i.y - m.y * i.x) || 1;
      roll += A.roll * sgn * (0.35 + 1.25 * e) * Math.PI / 180 * decay(age, 0.09, e);
    }
    const g = e * decay(age, 0.08, e); if (g > best) {best = g; pivot = h.pos;}
  }
  const n = Math.hypot(dx, dy); if (n > 28) {dx *= 28 / n; dy *= 28 / n;}
  return {dx, dy, zf, roll, pivot};
}
/** Struck rails that move or swell: plucks (a decaying standing wave) and ink pressure (a far-side swell). */
function railAccents(t) {
  const A = acc(); if (!A.pluck && !A.pressure) return [];
  return activeHits(t, A.pluck ? 0.6 : 0.4).filter(({h}) => h.chain !== undefined);
}

// ── drawing ────────────────────────────────────────────────────────────────
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('');};
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const colourOf = h => SRC[h.src] ?? SRC.other;

// Background: plain, or following the sections (a 0.35 s dissolve that starts on the downbeat).
const TINTS = ['#eef3fb', '#f2effa', '#edf6f3', '#f6f1f5', '#eef4f7'];
function sectionBlend(t, f, dur = 0.35) {
  const ph = S.phases; let i = ph.findIndex(p => t >= p.t0 && t < p.t1); if (i < 0) i = ph.length - 1;
  const u = i > 0 ? smoothstep((t - ph[i].t0) / dur) : 1;
  return u >= 1 || i === 0 ? f(i) : {mixWith: [f(i - 1), f(i), u]};
}
function themeAt(t) {
  const plainTheme = bg => ({bg, ink: INK, pencil: PENCIL, dark: 0});
  if (mix.bg === 'white') return plainTheme('#ffffff');
  if (mix.bg === 'porcelain') return plainTheme('#f4f6f9');
  const resolve = r => r.mixWith ? lerpTheme(r.mixWith[0], r.mixWith[1], r.mixWith[2]) : r;
  if (mix.bg === 'tones') return resolve(sectionBlend(t, i => plainTheme(mixHex('#ffffff', '#e3e8f0', S.intensity[i]))));
  if (mix.bg === 'colours') return resolve(sectionBlend(t, i => plainTheme(mixHex('#ffffff', TINTS[i % TINTS.length], 0.45 + 0.55 * S.intensity[i]))));
  // night: the peak section goes dark, the ink turns light
  // a cut, not a dissolve: halfway between white and night is only grey
  return resolve(sectionBlend(t, i => i === S.peak ? {bg: NIGHT, ink: '#eef1f5', pencil: '#68707e', dark: 1} : plainTheme('#ffffff'), 0.01));
}
function lerpTheme(a, b, u) {return {bg: mixHex(a.bg, b.bg, u), ink: mixHex(a.ink, b.ink, u), pencil: mixHex(a.pencil, b.pencil, u), dark: a.dark + (b.dark - a.dark) * u};}

function visibleLines(c) {
  const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
  const seen = new Set();
  for (let gx = Math.floor(x0 / S.G); gx <= Math.floor(x1 / S.G); gx++)
    for (let gy = Math.floor(y0 / S.G); gy <= Math.floor(y1 / S.G); gy++)
      for (const l of S.grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
  return out;
}
let overNow = 0; // how far into the whole-course view we are (0–1)
function drawLines(lines, at, t, z, th) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const A = acc(), pl = A.pluck ? railAccents(t) : [];
  // displacement of a world point by the active plucks (a standing wave along the rail, decaying)
  const disp = (x, y) => {
    let dx = 0, dy = 0;
    for (const {h, age, e} of pl) {
      const d = Math.hypot(x - h.pos.x, y - h.pos.y), L = (280 + 360 * e) / z;
      if (d > L) continue;
      const w = Math.cos(0.5 * Math.PI * d / L) ** 2;
      const a = (8 + 22 * e) / z * Math.exp(-age / 0.18) * Math.cos(2 * Math.PI * 11 * age) * Math.cos(Math.PI * d / L * 1.5);
      dx += h.nrm.x * a * w; dy += h.nrm.y * a * w;
    }
    return [x + dx, y + dy];
  };
  const moving = pl.length ? new Set(pl.map(p => p.h.chain)) : null;
  const near = l => moving && moving.has(l.chain) && pl.some(({h}) => Math.hypot(l.x1 - h.pos.x, l.y1 - h.pos.y) < 660 / z);
  const path = filter => {
    ctx.beginPath();
    for (const l of lines) if (filter(l)) {
      if (near(l)) {const [ax, ay] = disp(l.x1, l.y1), [bx, by] = disp(l.x2, l.y2); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);}
      else {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}
    }
  };
  const ink = Math.max(2, 3.6 / z);
  if (mix.ink === 'ink') {path(() => true); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();}
  else {
    path(l => l.ink > at); ctx.strokeStyle = overNow > 0.02 ? mixHex(th.pencil, th.ink, 0.25 * overNow) : th.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * overNow) / z); ctx.stroke();
    path(l => l.ink <= at); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();
  }
  if (A.pressure) {
    // ink pressure: the struck rail swells on its far side only (the edge the sled sits on stays put), tapered
    for (const {h, age, e} of railAccents(t)) {
      const g = decay(age, 0.09, e); if (g < 0.03) continue;
      const dw = ink * (0.25 + 0.8 * e) * g * A.pressure, i = into(h), L = (40 + 110 * e) / z;
      const near = lines.filter(l => l.chain === h.chain && Math.hypot((l.x1 + l.x2) / 2 - h.pos.x, (l.y1 + l.y2) / 2 - h.pos.y) < 1.2 * L);
      ctx.strokeStyle = th.ink;
      for (let j = 1; j <= 5; j++) {
        const half = L * (1.2 - 0.2 * j), wj = ink + dw * j / 5, off = (wj - ink) / 2;
        ctx.beginPath();
        for (const l of near) if (Math.hypot((l.x1 + l.x2) / 2 - h.pos.x, (l.y1 + l.y2) / 2 - h.pos.y) < half) {ctx.moveTo(l.x1 + i.x * off, l.y1 + i.y * off); ctx.lineTo(l.x2 + i.x * off, l.y2 + i.y * off);}
        ctx.lineWidth = wj; ctx.stroke();
      }
    }
  }
}
// Drop-outs: in quiet sections the band and accents leave (0.4 s fade); they return at once on the re-entry hit.
function gateAt(t) {
  if (mix.arrange !== 'dropouts') return 1;
  const ph = S.phases; let i = ph.findIndex(p => t >= p.t0 && t < p.t1); if (i < 0) i = ph.length - 1;
  const prevQuiet = i > 0 && S.quiet[i - 1];
  if (S.quiet[i]) return prevQuiet ? 0 : 1 - smoothstep((t - ph[i].t0) / 0.4);
  return prevQuiet && t < S.reentry[i] ? 0 : 1;
}
function drawLandingMark(at, z, th) {
  // while airborne, the spot where the rider will land inks itself in, growing as the landing nears
  for (const L of S.landings) {
    if (at < L.f0 || at > L.f1 + 1) continue;
    const left = (L.f1 - at) / FPS; if (left > 0.4) continue;
    const u = 1 - left / 0.4, len = (16 + 110 * u * u) / z, tx = Math.cos(L.ang), ty = Math.sin(L.ang);
    ctx.globalAlpha = 0.35 + 0.65 * u; ctx.strokeStyle = th.ink; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, 3.6 / z) * 1.25;
    ctx.beginPath(); ctx.moveTo(L.pos.x - tx * len / 2, L.pos.y - ty * len / 2); ctx.lineTo(L.pos.x + tx * len / 2, L.pos.y + ty * len / 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawFlight(at, z, over, th) {
  // on the whole-course view: the ride's own path so far, one continuous stroke through rails and jumps
  const a = clamp((over - 0.15) / 0.5, 0, 1); if (a <= 0 || at < 2) return;
  const p = S.path, n = Math.min(p.length - 1, Math.floor(at));
  ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let f = 2; f <= n; f += 2) ctx.lineTo(p[f].x, p[f].y);
  ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = th.ink; ctx.lineWidth = 1.8 / z; ctx.lineJoin = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
}
function riderCamera(c, k) {
  return {x: c.x + (W / 2 - c.ax) / c.z, y: c.y + (H / 2 - c.ay) / c.z, z: c.z * k, w: canvas.width, h: canvas.height, r: 1};
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
function drawScore(t, alpha, nowX, th) {
  const lift = v => clamp((v - 0.25) / 0.65, 0, 1);
  const px = nowX, pps = 230, base = 0.82 * H, fade = x => clamp(Math.min(x - 30, W - 150 - x) / 110, 0, 1);
  ctx.fillStyle = th.ink; ctx.globalAlpha = 0.55 * alpha;
  ctx.beginPath(); ctx.moveTo(px - 11, base + 34); ctx.lineTo(px + 11, base + 34); ctx.lineTo(px, base + 18); ctx.closePath(); ctx.fill();
  for (const h of S.hits) {
    const x = px + (h.tc - t) * pps; if (x < 0) continue; if (x > W) break;
    const age = t - h.tc, hgt = 34 + 150 * lift(h.s), w = 12;
    const pop = age >= 0 && age < 0.18 ? 1 + 0.4 * (1 - easeOut(age / 0.18)) : 1;
    ctx.globalAlpha = fade(x) * alpha; ctx.fillStyle = age < 0 ? th.pencil : h.src === 'drums' ? th.ink : colourOf(h);
    const hh = hgt * pop, ww = w * pop;
    ctx.beginPath(); ctx.roundRect(x - ww / 2, base - hh, ww, hh, ww / 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The lower band sits between the ride and the Shorts comments (which start near 0.85 H).
function drawSpectrum(t, form, alpha, th) {
  const row = spectrumRow(t), n = row.length, step = W / n, lit = c => th.dark ? mixHex(c, '#ffffff', 0.62 * th.dark) : c;
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const third = i => Math.min(2, Math.floor(i / n * 3));
  if (form === 'red') {
    // One red: graphite stems; only the loudest few frequencies take the scarf's red, as solid dots ≥ 4 px
    const base = 0.825 * H, hgt = 0.15 * H, r = 7, order = row.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), loud = new Set(order.slice(0, 3).filter(o => o[0] > 0.25).map(o => o[1]));
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, hot = loud.has(i);
      ctx.strokeStyle = th.dark ? '#7d8592' : '#a7adb6'; ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.7; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = hot ? '#d3262e' : th.dark ? '#c9ced6' : '#3b414a'; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, hot ? r + 2 : r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'stems') {
    const base = 0.825 * H, hgt = 0.15 * H, pal = ['#328ca0', '#7787b7', '#c47a85'], r = 7;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, c = lit(pal[third(i)]);
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = c; ctx.globalAlpha = alpha * 0.92; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'fork2') {
    // mirrored about a centre line: the band is filled top and bottom, nothing is cut
    const mid = 0.755 * H, half = 0.072 * H, pal = ['#328ca0', '#7787b7', '#c47a85'], r = 6;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, d = r + (half - 2 * r) * v, c = lit(pal[third(i)]);
      ctx.strokeStyle = c; ctx.lineWidth = 2.8; ctx.globalAlpha = alpha * 0.55; ctx.beginPath(); ctx.moveTo(x, mid - d); ctx.lineTo(x, mid + d); ctx.stroke();
      ctx.fillStyle = c; ctx.globalAlpha = alpha * 0.92;
      ctx.beginPath(); ctx.arc(x, mid - d, r, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = alpha * 0.5; ctx.beginPath(); ctx.arc(x, mid + d, r * 0.8, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'bars3' || form === 'blocks') {
    // Codex's three-colour bars (Porcelain mirror) and quantized blocks (Electric registration)
    const base = 0.80 * H, hgt = 0.15 * H, blocks = form === 'blocks';
    const pal = blocks ? ['#489ca5', '#8376b5', '#b572a1'] : ['#66a7ac', '#8b99be', '#c095a3'];
    const bw = step * (blocks ? 0.58 : 0.8);
    row.forEach((v, i) => {
      const h = blocks ? Math.floor(v * 16) / 16 * hgt : Math.max(2, v * hgt); if (!h) return;
      const x = (i + .5) * step - bw / 2; ctx.fillStyle = lit(pal[third(i)]);
      ctx.globalAlpha = alpha * (blocks ? 0.8 : 0.92); ctx.beginPath(); ctx.roundRect(x, base - h, bw, h, Math.min(2, bw / 4)); ctx.fill();
      if (!blocks) {ctx.globalAlpha = alpha * 0.3; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.5, 0.035 * H));}
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
function postAccents(t, k, c, th) {
  const A = acc(), toScreen = P => ({x: (c.ax + (P.x - c.x) * c.z) * k, y: (c.ay + (P.y - c.y) * c.z) * k});
  if (A.today) {
    const split = 14 * trauma(t, {min: 0.25, gain: 2.0, decay: 7, power: 1.4}) * k;
    if (split > 0.5) channelSplit(split, 0);
    const flash = 0.3 * trauma(t, {min: 0.3, gain: 1.8, decay: 12, power: 1});
    if (flash > 0.003) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
    return;
  }
  const hits = (A.split || A.trail || A.slice || A.thump || A.flash) ? activeHits(t, 0.6) : [];
  if (A.slice) {
    // the half-plane beyond the struck line slips along it, then snaps back; the rider's side never moves
    for (const {h, age, e} of hits) {
      if (e < 0.15) continue; const g = decay(age, 0.04, e), d = A.slice * (6 + 26 * e) * g * k; if (d < 1) continue;
      const i = into(h), P = toScreen(h.pos), tx = -i.y, ty = i.x, m = h.vel ?? {x: 1, y: 0}, sg = -(Math.sign(m.x * tx + m.y * ty) || 1), F = 6000;
      chan[0].width = canvas.width; chan[0].height = canvas.height; chan[0].getContext('2d').drawImage(canvas, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath();
      ctx.moveTo(P.x - tx * F, P.y - ty * F); ctx.lineTo(P.x + tx * F, P.y + ty * F); ctx.lineTo(P.x + tx * F + i.x * F, P.y + ty * F + i.y * F); ctx.lineTo(P.x - tx * F + i.x * F, P.y - ty * F + i.y * F); ctx.closePath(); ctx.clip();
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(chan[0], sg * tx * d, sg * ty * d); ctx.restore();
    }
  }
  if (A.thump) {
    // letterbox punch: crisp ink bars slam in from the top and bottom edges with the blow, then retract
    let hgt = 0; for (const {age, e} of hits) hgt = Math.max(hgt, A.thump * (14 + 70 * e) * decay(age, 0.07, e));
    if (hgt > 1) {const b = Math.round(hgt * k); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = th.dark ? '#000000' : INK; ctx.fillRect(0, 0, canvas.width, b); ctx.fillRect(0, canvas.height - b, canvas.width, b);}
  }
  if (A.split || A.trail) {
    // the colour split along the direction of the impact, only as hard as the hit
    let ox = 0, oy = 0;
    for (const {h, age, e} of hits) {const a = (A.split || A.trail) * (2 + 12 * e) * decay(age, 0.06, e), i = into(h); ox += i.x * a; oy += i.y * a;}
    const n = Math.hypot(ox, oy); if (n > 14) {ox *= 14 / n; oy *= 14 / n;}
    if (Math.hypot(ox, oy) * k > 1) channelSplit(ox * k, oy * k, A.trail ? 'trail' : 'centre');
  }
  if (A.flash) {
    let f = 0; for (const {age, e} of hits) f = Math.max(f, A.flash * (0.1 + 0.18 * e) * decay(age, 0.05, e));
    if (f > 0.004) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
  }
}
function drawMarker(c, over, th) {
  // on the whole-course view the rider is a few pixels wide: a ring keeps it findable
  const a = clamp((over - 0.25) / 0.4, 0, 1); if (a <= 0) return;
  ctx.globalAlpha = a; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c.ax, c.ay, 20, 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
}

async function draw() {
  if (!S || !canvas.width || !canvas.height) return;
  const sheet = await sheetPromise, t = seconds, at = clamp(t * FPS, 0, S.frames.length - 1), k = canvas.width / W;
  const th = themeAt(t);
  let c = bookend(t, cameraAt(mix, at));
  const hc = gateAt(t) > 0.5 ? hitCamera(t) : {dx: 0, dy: 0, zf: 1, roll: 0, pivot: null};
  // the rider's own screen point, before hit offsets (bookend has moved the anchor)
  const fi = Math.round(at), rider = {ax: c.ax + (S.R.R[fi].x - c.x) * c.z, ay: c.ay + (S.R.R[fi].y - c.y) * c.z};
  if (hc.zf !== 1) {
    // the zoom pulse pivots on the contact point, so the struck spot stays nailed and the world swells from it
    const P = hc.pivot ? {x: c.ax + (hc.pivot.x - c.x) * c.z, y: c.ay + (hc.pivot.y - c.y) * c.z} : {x: rider.ax, y: rider.ay};
    c = {...c, z: c.z * hc.zf, ax: P.x + (c.ax - P.x) * hc.zf, ay: P.y + (c.ay - P.y) * hc.zf};
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const gate = gateAt(t), band = (1 - (c.over ?? 0)) * gate;
  overNow = c.over ?? 0;
  if (mix.music === 'score') drawScore(t, band, clamp(rider.ax, 120, W - 260), th);
  if (band > 0.003 && ['red', 'stems', 'fork2', 'iris', 'slits', 'bars3', 'blocks'].includes(mix.music)) drawSpectrum(t, mix.music, band, th);
  const cc = {...c, ax: c.ax + hc.dx, ay: c.ay + hc.dy};
  // a camera roll about the contact point (device px), applied to the world and the rider alike
  const R0 = (() => {
    if (!hc.roll || !hc.pivot) return [1, 0, 0, 1, 0, 0];
    const px = (cc.ax + (hc.pivot.x - cc.x) * cc.z) * k, py = (cc.ay + (hc.pivot.y - cc.y) * cc.z) * k, co = Math.cos(hc.roll), si = Math.sin(hc.roll);
    return [co, si, -si, co, px - co * px + si * py, py - si * px - co * py];
  })();
  const world = () => {ctx.setTransform(...R0); ctx.transform(cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k);};
  world();
  drawLines(visibleLines(cc), at, t, cc.z, th);
  if (c.over > 0.02) drawFlight(at, cc.z, c.over, th);
  if (mix.land === 'mark') drawLandingMark(at, cc.z, th);
  drawRider(sheet, riderCamera(cc, k), at, R0);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (c.over > 0.02) drawMarker({ax: rider.ax + hc.dx, ay: rider.ay + hc.dy}, c.over, th);
  if (mix.music === 'bars' && gate > 0.003) drawBars(t, gate);
  if (gate > 0.5) postAccents(t, k, cc, th);
}

// ── loading, transport, UI ─────────────────────────────────────────────────
async function loadSong(key) {
  const id = ++loadId; song = key; S = null; status('Loading ' + SONGS[key] + '…');
  const data = await (await fetch(`../data/${key}.json`)).json();
  const [native] = await Promise.all([replay(data.track, data.trace), shot ? null : music.load(data.audio).catch(() => null)]);
  if (id !== loadId) return;
  S = prepare(data, native);
  $('seek').max = S.duration; seconds = Math.min(seconds, S.duration);
  status(''); renderUI(); await draw();
  if (shot) {window.__ready = true; window.__duration = S.duration; window.__audio = S.audio;
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
