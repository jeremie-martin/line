// Concept lab: the real saved ride, drawn live with the vendored rider artwork,
// native replay and follow camera, plus independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '../dist/native.js';

const W = 1080, H = 1920, FPS = 40;
const INK = '#15181d';
const SRC = {drums: '#15181d', vocals: '#2b59d6', bass: '#7b3fbf', other: '#e0532f'};
const PENCIL = '#b4bcc8';
const PAPER = {white: '#ffffff', porcelain: '#f4f6f9'};
const Z0 = 5.4; // the vertical video's zoom: static 3 × the 1.8 vertical multiplier
const ZR = Z0 * 1.35; // ride framing: rider about 1/8 of the width

const DIMS = {
  frame: ['Framing', {current: 'Today', lead: 'Closer, looking ahead', close: 'Closest', sections: 'Breathes with sections'}],
  punch: ['Camera on hits', {none: 'Steady', shake: 'Today’s shake, split & flash', catch: 'Catch', push: 'Push in'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course'}],
  paper: ['Paper', {white: 'White', porcelain: 'Porcelain', chapters: 'Section steps'}],
  ink: ['Line', {ink: 'Ink', inking: 'Pencil → ink'}],
  music: ['Music (lower band)', {none: 'None', bars: 'Today’s bars', stems: 'Tuning fork', iris: 'Iris', brackets: 'Cobalt', horizon: 'Horizon', score: 'Score'}],
  hits: ['At each hit', {none: 'Nothing', stamp: 'Stamp', burst: 'Burst'}],
  big: ['Strongest hits', {none: 'Same as others', flash: 'Flash'}],
};
const base = {frame: 'lead', punch: 'none', ends: 'none', paper: 'white', ink: 'ink', music: 'none', hits: 'none', big: 'none'};
const PRESETS = [
  {id: 'today', name: 'Today', line: 'Today’s framing and bars, with its shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, frame: 'current', music: 'bars', punch: 'shake'}},
  {id: 'ride', name: 'Ride first', line: 'Nothing added. Closer, and the camera looks ahead and downhill, toward the next landing.', mix: {...base}},
  {id: 'catch', name: 'Catch', line: 'Hits move the camera like a hand-held operator: a slight lag, then it catches up. A short stamp marks each contact; the six strongest hits flash.',
    mix: {...base, punch: 'catch', hits: 'stamp', big: 'flash'}},
  {id: 'inking', name: 'Inking', line: 'The track waits in pencil. Only what the rider actually touches turns to ink; the scaffolding stays grey.',
    mix: {...base, ink: 'inking'}},
  {id: 'score', name: 'Score', line: 'Upcoming hits slide toward the rider and fill as it lands. Height is the measured strength. Black is drums; colour is voice or another instrument.',
    mix: {...base, music: 'score'}},
  {id: 'fork', name: 'Tuning fork', line: 'The fine frequency stems you liked, moved to the lower band.', mix: {...base, music: 'stems'}},
  {id: 'iris', name: 'Iris', line: 'The flowing contours with their real recent history, in the lower band.', mix: {...base, music: 'iris'}},
  {id: 'sections', name: 'Sections', line: 'The camera reads the song: wider in sparse sections, closer in dense ones. The paper steps on each downbeat, deeper when the section asks for speed.',
    mix: {...base, frame: 'sections', paper: 'chapters'}},
  {id: 'overture', name: 'Overture', line: 'Open on the whole course in pencil, plunge to the rider by the first hit. At the end, pull back: the song, inked.',
    mix: {...base, ends: 'overture', ink: 'inking'}},
  {id: 'together', name: 'Together', line: 'My combination: overture, pencil to ink, catch with stamps, the camera reading the sections, Iris below.',
    mix: {...base, frame: 'sections', ends: 'overture', ink: 'inking', punch: 'catch', hits: 'stamp', big: 'flash', music: 'iris'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje'};
// Morning questions: one decision each, everything else held constant, at a moment where the difference shows.
const plain = {...base};
const QUESTIONS = [
  {id: 'framing', ask: 'How big should the ride be?', why: 'Today the rider is about a tenth of the frame. Closer framings look ahead and downhill so the next landing stays in view.',
    song: 'los', t: 19.5, opts: [['Today', {...plain, frame: 'current'}], ['Closer', {...plain}], ['Closest', {...plain, frame: 'close'}]]},
  {id: 'lower', ask: 'What should fill the lower half?', why: 'The music lives in the band above the Shorts UI. Score shows the hits themselves: they fill as the rider lands.',
    song: 'petrunko', t: 22.2, opts: [['Nothing', {...plain}], ['Today’s bars', {...plain, music: 'bars'}], ['Tuning fork', {...plain, music: 'stems'}], ['Iris', {...plain, music: 'iris'}], ['Cobalt', {...plain, music: 'brackets'}], ['Score', {...plain, music: 'score'}]]},
  {id: 'hit', ask: 'What should a hit do?', why: 'Watch several hits in the loop. Catch moves the camera like a hand-held operator; stamps mark the contact and vanish in a tenth of a second.',
    song: 'los', t: 46.2, opts: [['Nothing', {...plain}], ['Today’s shake & split', {...plain, punch: 'shake'}], ['Stamp', {...plain, hits: 'stamp'}], ['Burst', {...plain, hits: 'burst'}], ['Catch', {...plain, punch: 'catch'}], ['Catch + stamp', {...plain, punch: 'catch', hits: 'stamp'}]]},
  {id: 'big', ask: 'Should the strongest hits stand out?', why: 'Only the six strongest hits of each song. The flash is a two-frame inversion: the boldest thing a light frame can do. The loop includes the strongest hit.',
    song: 'petrunko', t: null, opts: [['Same as the others', {...plain, punch: 'catch', hits: 'stamp'}], ['Flash', {...plain, punch: 'catch', hits: 'stamp', big: 'flash'}]]},
  {id: 'line', ask: 'Ink everywhere, or pencil until touched?', why: 'About half the lines are scaffolding the rider never touches. In pencil they recede, and black means “the music touched here”.',
    song: 'lua', t: 27, opts: [['All ink', {...plain}], ['Pencil → ink', {...plain, ink: 'inking'}]]},
  {id: 'sections', ask: 'Should the camera and paper follow the song’s sections?', why: 'Wider in sparse sections, closer in dense ones, easing across each boundary. The paper can also step on each section’s downbeat, deeper when it asks for speed. The 8-second loop crosses three sections: ROLL, SUSPEND, RETURN.',
    song: 'petrunko', t: 19, len: 8, opts: [['Steady', {...plain}], ['Camera breathes', {...plain, frame: 'sections'}], ['Camera + paper', {...plain, frame: 'sections', paper: 'chapters'}]]},
  {id: 'ends', ask: 'Open and close on the whole course?', why: 'The opening holds the whole course, then plunges to the rider; the last seconds pull back to the whole course again, so on Shorts the loop closes on itself. Shown in plain ink here; with pencil → ink, the ending becomes the song, inked. Try the opening, then tap “Ending”.',
    song: 'lua', t: 0, len: 4, opts: [['No', {...plain}], ['Whole course', {...plain, ends: 'overture'}]]},
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
const answers = (() => {try {return JSON.parse(localStorage.getItem('concept-lab-answers') ?? '{}');} catch {return {};}})();
const saveAnswers = () => {try {localStorage.setItem('concept-lab-answers', JSON.stringify(answers));} catch {}};
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
const lerpPt = (arr, at) => {const i = Math.max(0, Math.min(arr.length - 1, Math.floor(at))), j = Math.min(i + 1, arr.length - 1), t = Math.max(0, Math.min(1, at - i));
  return {x: arr[i].x + (arr[j].x - arr[i].x) * t, y: arr[i].y + (arr[j].y - arr[i].y) * t};};

function prepare(data, native) {
  const lines = data.track.lines.map(l => ({id: l.id, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, touch: Infinity}));
  const byId = new Map(lines.map(l => [l.id, l]));
  native.contacts.forEach((ids, f) => {for (const id of ids) {const l = byId.get(id); if (l && f < l.touch) l.touch = f;}});
  // connected rails: a rail inks up to the furthest point touched so far, so a used rail is solid behind the rider
  {
    const parent = lines.map((_, i) => i), find = i => {while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i;};
    const ends = new Map(), key = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100);
    lines.forEach((l, i) => {for (const k of [key(l.x1, l.y1), key(l.x2, l.y2)]) {if (ends.has(k)) parent[find(i)] = find(ends.get(k)); else ends.set(k, i);}});
    const chains = new Map(); lines.forEach((l, i) => {const r = find(i); if (!chains.has(r)) chains.set(r, []); chains.get(r).push(l);});
    for (const chain of chains.values()) {
      chain.sort((a, b) => (a.x1 + a.x2) - (b.x1 + b.x2));
      let m = Infinity; for (let i = chain.length - 1; i >= 0; i--) {m = Math.min(m, chain[i].touch); chain[i].ink = m;}
    }
  }
  // spatial grid for culling
  const G = 400, grid = new Map();
  for (const l of lines) {
    for (let gx = Math.floor(Math.min(l.x1, l.x2) / G); gx <= Math.floor(Math.max(l.x1, l.x2) / G); gx++)
      for (let gy = Math.floor(Math.min(l.y1, l.y2) / G); gy <= Math.floor(Math.max(l.y1, l.y2) / G); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l);
      }
  }
  const centres = data.trace.frames.map(centreOf);
  // smoothed velocity → look-ahead offset (offline, so a centred window is fine)
  const vel = centres.map((_, f) => {const a = centres[Math.max(0, f - 6)], b = centres[Math.min(centres.length - 1, f + 6)];
    const n = Math.min(centres.length - 1, f + 6) - Math.max(0, f - 6) || 1; return {x: (b.x - a.x) / n, y: (b.y - a.y) / n};});
  const sig = 24, ker = []; for (let k = -2 * sig; k <= 2 * sig; k++) ker.push(Math.exp(-k * k / (2 * sig * sig)));
  const lead = vel.map((_, f) => {let x = 0, y = 0, w = 0; ker.forEach((g, i) => {const v = vel[Math.max(0, Math.min(vel.length - 1, f + i - 2 * sig))]; x += v.x * g; y += v.y * g; w += g;});
    return {x: x / w, y: y / w};});
  const sm = 10, k2 = []; for (let k = -2 * sm; k <= 2 * sm; k++) k2.push(Math.exp(-k * k / (2 * sm * sm)));
  const smooth = centres.map((_, f) => {let x = 0, y = 0, w = 0; k2.forEach((g, i) => {const c = centres[Math.max(0, Math.min(centres.length - 1, f + i - 2 * sm))]; x += c.x * g; y += c.y * g; w += g;});
    return {x: x / w, y: y / w};});
  const air = centres.map((_, f) => !(native.contacts[f]?.length));
  // hit density per section, ranked within the song: sparse sections frame wider
  const dens = data.phases.map(p => data.hits.filter(h => h.t >= p.t0 && h.t < p.t1).length / Math.max(0.5, p.t1 - p.t0));
  const lo = Math.min(...dens), hi = Math.max(...dens);
  const breath = dens.map(d => 0.68 + 0.42 * (hi > lo ? (d - lo) / (hi - lo) : 0.5));
  // where each hit happened: the touched line nearest the body, projected
  const hits = data.hits.map(h => {
    const f0 = Math.round(h.t * FPS); let pos = null, ang = 0;
    for (let f = f0 - 1; f <= f0 + 4 && !pos; f++) {
      const ids = native.contacts[f] ?? []; if (!ids.length) continue;
      const c = centres[Math.min(f, centres.length - 1)]; let best = Infinity;
      for (const id of ids) {
        const l = byId.get(id); if (!l) continue;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2));
        const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) {best = d; pos = p; ang = Math.atan2(dy, dx);}
      }
    }
    // the moment the drawn rider touches: the start of the contact run at or just before the hit
    let fc = null;
    for (let f = f0 + 1; f >= f0 - 6; f--) {if (native.contacts[f]?.length) fc = f; else if (fc !== null) break;}
    return {...h, tc: fc === null ? h.t : Math.min(h.t, fc / FPS), pos: pos ?? centres[Math.min(f0, centres.length - 1)], ang};
  });
  // the strongest few hits get the big accent
  [...hits].filter(h => h.s >= 0.6).sort((a, b) => b.s - a.s).slice(0, 6).forEach(h => {h.big = true;});
  // camera "catch": a slightly underdamped follow of the lead target, so jolts are caught a beat late
  const catchPath = []; {
    const capW = 0.24 * W / ZR, w0 = 2 * Math.PI * 2.4, zeta = 0.62, dt = 1 / FPS / 4;
    const target = f => {const c = centres[f], v = lead[f], e = Math.min(1, f / 24), ramp = e * e * (3 - 2 * e); let lx = v.x * 20 * ramp, ly = v.y * 20 * ramp; const n = Math.hypot(lx, ly); if (n > capW) {lx *= capW / n; ly *= capW / n;} return {x: c.x + lx, y: c.y + ly};};
    let x = target(0), v = {x: 0, y: 0};
    for (let f = 0; f < centres.length; f++) {
      const T = target(f);
      for (let i = 0; i < 4; i++) {
        v.x += (w0 * w0 * (T.x - x.x) - 2 * zeta * w0 * v.x) * dt; v.y += (w0 * w0 * (T.y - x.y) - 2 * zeta * w0 * v.y) * dt;
        x = {x: x.x + v.x * dt, y: x.y + v.y * dt};
      }
      catchPath.push(x);
    }
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lines) {x0 = Math.min(x0, l.x1, l.x2); x1 = Math.max(x1, l.x1, l.x2); y0 = Math.min(y0, l.y1, l.y2); y1 = Math.max(y1, l.y1, l.y2);}
  const inkOrder = lines.filter(l => l.touch < Infinity).sort((a, b) => a.touch - b.touch);
  return {...data, frames: native.frames, lines, grid, G, centres, smooth, air, lead, breath, catchPath, hits, bbox: {x0, y0, x1, y1}, inkOrder,
    follow: N.follower(data.trace.frames), mapKey: ''};
}

// ── camera ─────────────────────────────────────────────────────────────────
const smoothstep = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
function sectionBreath(t) {
  // eased over 1.2 s around each boundary
  const ph = S.phases; let i = ph.findIndex(p => t >= p.t0 && t < p.t1); if (i < 0) i = ph.length - 1;
  let b = S.breath[i];
  if (i + 1 < ph.length && ph[i + 1].t0 - t < 0.6) b += (S.breath[i + 1] - b) * smoothstep((t - (ph[i + 1].t0 - 0.6)) / 1.2);
  if (i > 0 && t - ph[i].t0 < 0.6) b = S.breath[i - 1] + (S.breath[i] - S.breath[i - 1]) * smoothstep((t - ph[i].t0 + 0.6) / 1.2);
  return b;
}
function punchAt(t) {
  let p = 0;
  for (const h of S.hits) {
    if (h.tc > t + 0.05) break; const age = t - h.tc; if (age < -0.04 || age > 0.45) continue;
    p = Math.max(p, h.s * (age < 0 ? 1 + age / 0.04 : Math.exp(-age / 0.11)));
  }
  return p;
}
function framing(m, t) {
  let f;
  if (m.frame === 'current') f = {z: Z0, ax: W / 2, ay: 0.35 * H, lead: 0};
  else f = {z: ZR * (m.frame === 'close' ? 1.25 : m.frame === 'sections' ? sectionBreath(t) : 1), ax: W / 2, ay: 0.38 * H, lead: 1};
  if (m.punch === 'push') f.z *= 1 + 0.085 * punchAt(t);
  return f;
}
function camera(at, fr) {
  if (!fr.lead) return S.follow({w: W, h: H, z: fr.z}, at);
  if (mix.punch === 'catch') return lerpPt(S.catchPath, at);
  // a smoothed path that looks ahead (downhill too), eased in over the first half second
  const c = lerpPt(S.smooth, at), v = lerpPt(S.lead, at), k = 20 * smoothstep(at / 24), max = 0.24 * W / fr.z;
  let lx = v.x * k, ly = v.y * k; const n = Math.hypot(lx, ly); if (n > max) {lx *= max / n; ly *= max / n;}
  return {x: c.x + lx, y: c.y + ly};
}
// Opening and ending on the whole course: log-zoom, with the centre moving so the target point glides naturally.
function bookend(t, fr, cam) {
  if (mix.ends !== 'overture') return {fr, cam, over: 0};
  const b = S.bbox, zo = Math.min((W - 140) / (b.x1 - b.x0), (H * 0.5) / (b.y1 - b.y0));
  const o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2}, land = S.hits.find(h => h.tc >= 1.3)?.tc ?? 1.6;
  const t1 = Math.min(2.2, land), tE = S.duration - 2.8;
  let u = 1;
  if (t < t1) u = smoothstep((t - 0.5) / (t1 - 0.5));
  else if (t > tE) u = 1 - smoothstep((t - tE) / 2.5);
  if (u >= 1) return {fr, cam, over: 0};
  const z = Math.exp(Math.log(zo) + (Math.log(fr.z) - Math.log(zo)) * u);
  const w = (1 / zo - 1 / z) / (1 / zo - 1 / fr.z);
  return {fr: {...fr, z, ax: W / 2 + (fr.ax - W / 2) * w, ay: 0.46 * H + (fr.ay - 0.46 * H) * w},
    cam: {x: o.x + (cam.x - o.x) * w, y: o.y + (cam.y - o.y) * w}, over: 1 - w};
}

// ── drawing ────────────────────────────────────────────────────────────────
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;};
const easeOut = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const colourOf = h => SRC[h.src] ?? SRC.other;

function paperAt(t) {
  if (mix.paper !== 'chapters') return PAPER[mix.paper];
  // a step on each section's downbeat (60 ms), never a slow wash
  // the tint follows what the section asks: airy sections paler, fast ones a deeper cool grey
  const tone = p => mixHex('#fdfdff', '#e6ebf3', Math.max(0, Math.min(1, 0.75 * (p.speed - 0.4) / 0.45 + 0.25 * (0.85 - p.air) / 0.6)));
  const i = Math.max(0, S.phases.findIndex(p => t >= p.t0 && t < p.t1)), p = S.phases[i] ?? S.phases.at(-1);
  return tone(p);
}
function visibleLines(cam, fr) {
  const z = fr.z, x0 = cam.x - fr.ax / z - 40, x1 = cam.x + (W - fr.ax) / z + 40, y0 = cam.y - fr.ay / z - 40, y1 = cam.y + (H - fr.ay) / z + 40, out = new Set();
  for (let gx = Math.floor(x0 / S.G); gx <= Math.floor(x1 / S.G); gx++)
    for (let gy = Math.floor(y0 / S.G); gy <= Math.floor(y1 / S.G); gy++)
      for (const l of S.grid.get(gx + ',' + gy) ?? []) out.add(l);
  return out;
}
function drawLines(lines, at, z) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (filter) => {ctx.beginPath(); for (const l of lines) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
  const ink = Math.max(2, 3.2 / z);
  if (mix.ink === 'ink') {path(() => true); ctx.strokeStyle = INK; ctx.lineWidth = ink; ctx.stroke(); return;}
  path(l => l.ink > at); ctx.strokeStyle = PENCIL; ctx.lineWidth = Math.max(1.3, 2.8 / z); ctx.stroke();
  path(l => l.ink <= at); ctx.strokeStyle = INK; ctx.lineWidth = ink; ctx.stroke();
}
function drawStamps(t, z) {
  // a short bar along the line where it was struck, gone in 0.12 s; strong hits add two ticks
  for (const h of S.hits) {
    if (h.tc > t) continue; const age = t - h.tc; if (age > 0.12) continue;
    const p = age / 0.12, a = 1 - p * p, len = (44 + 90 * h.s) * (0.75 + 0.25 * easeOut(p * 3)) / z;
    const tang = Math.cos(h.ang) < 0 ? h.ang + Math.PI : h.ang, nx = Math.sin(tang), ny = -Math.cos(tang), tx = Math.cos(tang), ty = Math.sin(tang);
    const off = 13 / z, c = {x: h.pos.x + nx * off, y: h.pos.y + ny * off};
    ctx.globalAlpha = a; ctx.strokeStyle = colourOf(h); ctx.lineCap = 'butt';
    ctx.lineWidth = (7 + 6 * h.s) / z;
    ctx.beginPath(); ctx.moveTo(c.x - tx * len / 2, c.y - ty * len / 2); ctx.lineTo(c.x + tx * len / 2, c.y + ty * len / 2); ctx.stroke();
    if (h.s > 0.55) {
      const tl = (12 + 30 * h.s) * easeOut(p * 2.5) / z, g = 9 / z; ctx.lineWidth = 4 / z; ctx.beginPath();
      for (const sgn of [-1, 1]) {const ex = c.x + sgn * tx * len / 2, ey = c.y + sgn * ty * len / 2;
        ctx.moveTo(ex + nx * g, ey + ny * g); ctx.lineTo(ex + nx * (g + tl), ey + ny * (g + tl));}
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function drawBursts(t, z) {
  for (const h of S.hits) {
    if (h.tc > t) continue; const age = t - h.tc; if (age > 0.2) continue;
    const up = Math.cos(h.ang) < 0 ? h.ang + Math.PI : h.ang;
    const p = age / 0.2, n = 7, r0 = (14 + 30 * easeOut(p)) / z, len = (18 + 46 * h.s) * (1 - p) / z;
    ctx.strokeStyle = colourOf(h); ctx.lineCap = 'round'; ctx.lineWidth = (3 + 4 * h.s) * (1 - 0.6 * p) / z;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = up - Math.PI + (i + 0.5) * Math.PI / n;
      ctx.moveTo(h.pos.x + Math.cos(a) * r0, h.pos.y + Math.sin(a) * r0);
      ctx.lineTo(h.pos.x + Math.cos(a) * (r0 + len), h.pos.y + Math.sin(a) * (r0 + len));
    }
    ctx.stroke();
  }
}
function drawCourseDots(t, z, over) {
  // on the whole-course view: every hit so far as a small dot, coloured by source
  ctx.globalAlpha = Math.min(1, over * 1.4);
  for (const h of S.hits) {
    if (h.t > t) break; const r = (2.2 + 3 * h.s) / z;
    ctx.fillStyle = colourOf(h); ctx.beginPath(); ctx.arc(h.pos.x, h.pos.y, r, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function riderCamera(cam, fr, k) {
  return {x: cam.x + (W / 2 - fr.ax) / fr.z, y: cam.y + (H / 2 - fr.ay) / fr.z, z: fr.z * k, w: canvas.width, h: canvas.height, r: 1};
}
function drawRider(sheet, rc, at) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  paint(octx, rc, sheet, riderAt(S.frames, at), at);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(overlay, 0, 0);
}
function spectrumRow(t) {
  const sp = S.spectrum, x = Math.max(0, Math.min(sp.frames.length - 1, t * sp.fps)), i = Math.floor(x), j = Math.min(i + 1, sp.frames.length - 1), u = x - i;
  return sp.frames[i].map((v, b) => v + (sp.frames[j][b] - v) * u);
}
function drawBars(t) {
  const row = spectrumRow(t), n = row.length, gap = 3, bw = (W - gap * (n - 1)) / n, base = 0.73 * H, max = 0.17 * H;
  const ramp = ['#38d6c8', '#6ad36a', '#f0b429', '#ff5a4f'], stops = [0, .4, .7, 1];
  const col = u => {let s = 0; while (s < 2 && u > stops[s + 1]) s++; return mixHex(ramp[s], ramp[s + 1], (u - stops[s]) / (stops[s + 1] - stops[s]));};
  row.forEach((v, b) => {
    const h = Math.max(2, v * max), x = b * (bw + gap); ctx.fillStyle = col(b / (n - 1));
    ctx.globalAlpha = 0.95; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = 0.42; ctx.fillRect(x, base, bw, h);
  });
  ctx.globalAlpha = 1;
}
function drawHorizon(t, scroll) {
  // opaque, crisp ridges; each mirrors the spectrum into a seamless period and drifts at its own depth
  const layers = [[0.5, 0.55, '#edf0f5', 0.018, -150], [0.25, 0.75, '#e2e7ef', 0.03, -75], [0, 1, '#d5dce7', 0.045, 0]];
  for (const [age, amp, fill, depth, lift] of layers) {
    const row = spectrumRow(Math.max(0, t - age)), sm = row.map((v, i) => (row[Math.max(0, i - 1)] + 2 * v + row[Math.min(row.length - 1, i + 1)]) / 4);
    const period = [...sm, ...sm.slice().reverse()], P = period.length, span = 2 * W, step = span / P;
    const off = ((-scroll * depth) % span + span) % span;
    const pts = [];
    for (let i = -2; i * step < W + 2 * step + span; i++) {
      const x = i * step - span + off; if (x < -2 * step || x > W + 2 * step) continue;
      pts.push({x, y: H * 0.86 + lift - period[((i % P) + P) % P] * H * 0.3 * amp});
    }
    ctx.beginPath(); smoothPath(pts); ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
}
function smoothPath(pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);}
  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
}
function drawScore(t, alpha, nowX) {
  // ticks on one baseline in the lower band: x is time, height is the measured strength.
  // The "now" column sits under the rider, so a tick fills as the rider lands.
  const lift = v => Math.max(0, Math.min(1, (v - 0.25) / 0.65));
  const px = nowX, pps = 230, base = 0.80 * H, fade = x => Math.max(0, Math.min(1, Math.min(x - 30, W - 150 - x) / 110));
  ctx.fillStyle = INK; ctx.globalAlpha = 0.55 * alpha;
  ctx.beginPath(); ctx.moveTo(px - 11, base + 34); ctx.lineTo(px + 11, base + 34); ctx.lineTo(px, base + 18); ctx.closePath(); ctx.fill();
  for (const h of S.hits) {
    const x = px + (h.tc - t) * pps; if (x < 0) continue; if (x > W) break;
    const age = t - h.tc, hgt = 34 + 150 * lift(h.s), w = 12;
    const pop = age >= 0 && age < 0.18 ? 1 + 0.4 * (1 - easeOut(age / 0.18)) : 1;
    ctx.globalAlpha = fade(x) * alpha; ctx.fillStyle = age < 0 ? PENCIL : colourOf(h);
    const hh = hgt * pop, ww = w * pop;
    ctx.beginPath(); ctx.roundRect(x - ww / 2, base - hh, ww, hh, ww / 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawSpectrum(t, form, alpha) {
  // ports of the earlier spectra the owner liked, in the lower band (0.67–0.80 H), full width
  const row = spectrumRow(t), n = row.length, base = 0.80 * H, hgt = 0.13 * H, step = W / n;
  ctx.globalAlpha = alpha;
  if (form === 'stems') {
    const pal = ['#328ca0', '#7787b7', '#c47a85'], r = 5.5;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, c = pal[Math.min(2, Math.floor(i / n * 3))];
      ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = c; ctx.globalAlpha = alpha * 0.9; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'brackets') {
    ctx.strokeStyle = '#2a55c9'; ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    row.forEach((v, i) => {if (v <= 0) return; const c = (i + .5) * step, half = step * .26, top = base - v * hgt;
      ctx.moveTo(c - half, base); ctx.lineTo(c - half, top); ctx.lineTo(c + half, top); ctx.lineTo(c + half, base);});
    ctx.stroke();
  } else if (form === 'iris') {
    const contour = (vals, dy) => {const pts = vals.map((v, i) => ({x: -10 + (W + 20) * i / (n - 1), y: base - v * hgt * 0.72 + dy})); ctx.beginPath(); smoothPath(pts);};
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [.06, .12, .18, .24, .3, .36, .42].map((age, i) => ({age, i})).reverse().forEach(({age, i}) => {
      if (t < age) return; contour(spectrumRow(t - age), hgt * .04 * (i + 1));
      ctx.strokeStyle = '#8f86c9'; ctx.lineWidth = 2.6; ctx.globalAlpha = alpha * (.42 - i * .032); ctx.stroke();
    });
    contour(row, 0); ctx.strokeStyle = '#2f3a74'; ctx.lineWidth = 3.8; ctx.globalAlpha = alpha * .92; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// Today's shipped accents, from scripts/fx_recipe.ts LOCKED_FX, keyed like production (overlay hit time).
const trauma = (t, c) => {let x = 0; for (const h of S.hits) {if (h.t > t) break; if (h.s < c.min) continue; x += h.s * c.gain * Math.exp(-(t - h.t) * c.decay);} return Math.pow(Math.min(1, x), c.power);};
function shakeAt(t) {
  if (mix.punch !== 'shake') return {dx: 0, dy: 0};
  const m = trauma(t, {min: 0.22, gain: 1.6, decay: 7, power: 1.5}), w = 2 * Math.PI * 9;
  return {dx: 10 * m * Math.sin(w * t), dy: 10 * m * Math.sin(w * 1.37 * t + 1.7)};
}
const chan = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
function todayAccents(t) {
  const split = 14 * trauma(t, {min: 0.25, gain: 2.0, decay: 7, power: 1.4}) * canvas.width / W;
  if (split > 0.5) {
    const [src, ...rgb] = chan, w = canvas.width, h = canvas.height;
    for (const c of chan) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
    src.getContext('2d').drawImage(canvas, 0, 0);
    ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => {const g = rgb[i].getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, w, h);});
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
    const m = Math.ceil(split) + 2, o = (c, dx) => ctx.drawImage(c, dx - m, -m * h / w, w + 2 * m, h + 2 * m * h / w); // slight overscan, as production
    o(rgb[0], split); o(rgb[1], 0); o(rgb[2], -split);
    ctx.globalCompositeOperation = 'source-over';
  }
  const flash = 0.3 * trauma(t, {min: 0.3, gain: 1.8, decay: 12, power: 1});
  if (flash > 0.003) {ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
}
function drawFlash(t) {
  // the strongest hits only: a two-frame inversion, the boldest accent a light frame can take
  for (const h of S.hits) {
    if (h.tc > t) continue; if (!h.big) continue; const age = t - h.tc; if (age >= 0.03) continue;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over';
  }
}

async function draw() {
  if (!S || !canvas.width || !canvas.height) return;
  const sheet = await sheetPromise, t = seconds, at = Math.max(0, Math.min(S.frames.length - 1, t * FPS));
  const k = canvas.width / W, fr0 = framing(mix, t), b = bookend(t, fr0, camera(at, fr0)), fr = b.fr, cam = b.cam;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = paperAt(t); ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.music === 'horizon') drawHorizon(t, cam.x * fr.z);
  const riderX = fr.ax + (lerpPt(S.smooth, at).x - cam.x) * fr.z;
  if (mix.music === 'score') drawScore(t, 1 - b.over, Math.max(120, Math.min(W - 260, riderX)));
  if (['stems', 'iris', 'brackets'].includes(mix.music)) drawSpectrum(t, mix.music, 1 - b.over);
  const sh = shakeAt(t), world = () => ctx.setTransform(fr.z * k, 0, 0, fr.z * k, (fr.ax - cam.x * fr.z + sh.dx) * k, (fr.ay - cam.y * fr.z + sh.dy) * k);
  world();
  drawLines(visibleLines(cam, fr), at, fr.z);
  if (b.over > 0.02) drawCourseDots(t, fr.z, b.over);
  drawRider(sheet, riderCamera({x: cam.x - sh.dx / fr.z, y: cam.y - sh.dy / fr.z}, fr, k), at);
  world();
  if (mix.hits === 'stamp') drawStamps(t, fr.z);
  if (mix.hits === 'burst') drawBursts(t, fr.z);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.music === 'bars') drawBars(t);
  if (mix.big === 'flash') drawFlash(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mix.punch === 'shake') todayAccents(t);
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
  if (shot) {window.__ready = true; window.__duration = S.duration;
    window.__renderAt = async t => {seconds = t; await draw(); return canvas.toDataURL('image/png');};}
}
function moments() {
  const dens = S.phases.map(p => ({p, d: S.hits.filter(h => h.t >= p.t0 && h.t < p.t1).length / Math.max(0.5, p.t1 - p.t0)})).filter(x => x.p.t1 - x.p.t0 > 2);
  const quiet = dens.reduce((a, b) => b.d < a.d ? b : a), dense = dens.reduce((a, b) => b.d > a.d ? b : a);
  const big = S.hits.reduce((a, b) => b.s > a.s ? b : a), change = S.phases[Math.min(S.phases.length - 1, Math.floor(S.phases.length / 2))];
  return [['Opening', 0], ['Quiet · ' + quiet.p.name.toLowerCase(), quiet.p.t0 + 0.3], ['Dense · ' + dense.p.name.toLowerCase(), dense.p.t0 + 0.3],
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
function seek(t) {const resume = playing; if (resume) pause(); seconds = Math.max(0, Math.min(S?.duration ?? 0, t)); draw(); sync(); if (resume) play();}
function qStart(question) {
  if (question.t !== null) return question.t;
  const big = S.hits.reduce((a, b) => b.s > a.s ? b : a); return Math.max(0, big.tc - 1.6);
}
async function goQuestion(i) {
  pause(); qi = i; qopt = 0;
  if (qi >= QUESTIONS.length) {renderQuestion(); return;}
  const Q = QUESTIONS[qi]; mix = {...Q.opts[0][1]};
  if (song !== Q.song) {await loadSong(Q.song);}
  loop = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); seek(loop); renderQuestion(); draw();
}
function renderQuestion() {
  document.body.classList.add('qmode');
  const done = qi >= QUESTIONS.length, Q = QUESTIONS[qi];
  $('moments').replaceChildren(...(!done && Q.id === 'ends' ? moments().filter(([l]) => l === 'Opening' || l === 'Ending').map(([label, at]) => chip(label, false, () => {loop = at; seek(at);}, 'moment')) : []));
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[Q.song]}`;
  $('concept').textContent = done ? 'Thank you.' : Q.ask;
  $('line').textContent = done ? 'Copy your answers and paste them to me in the chat. They are also kept in this browser.' : Q.why;
  $('presets').replaceChildren(...(done ? [] : Q.opts.map(([label, m], i) => chip(`${'ABCDEF'[i]} · ${label}`, i === qopt, () => {qopt = i; mix = {...m}; renderQuestion(); draw();}))));
  const a = done ? null : (answers[Q.id] ??= {pick: null, note: ''});
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip('ABCDEF'[i], a.pick === label, () => {a.pick = label; saveAnswers(); renderQuestion();}, 'opt')),
    chip('None of these', a.pick === 'none', () => {a.pick = 'none'; saveAnswers(); renderQuestion();}, 'opt')]));
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answers[Q.id] ?? {}; return `${i + 1}. ${Q.ask} → ${a.pick ?? '(skipped)'}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
  $('qcopy').hidden = !done;
  sync();
}
function choosePreset(p) {preset = p; mix = {...p.mix}; renderUI(); draw(); sync();}
function chip(label, on, click, cls = 'chip') {const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = click; return b;}
function renderUI() {
  if (shot) return;
  if (qmode) return renderQuestion();
  $('moments').replaceChildren(...moments().map(([label, at]) => chip(label, false, () => {if (loop) loop = at; seek(at);}, 'moment')));
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
    else if (qmode && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && qi < QUESTIONS.length) {const o = QUESTIONS[qi].opts; qopt = (qopt + (e.key === 'ArrowRight' ? 1 : o.length - 1)) % o.length; mix = {...o[qopt][1]}; renderQuestion(); draw();}
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {e.preventDefault(); choosePreset(PRESETS[(i + 1) % PRESETS.length]);}
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {e.preventDefault(); choosePreset(PRESETS[(i + PRESETS.length - 1) % PRESETS.length]);}
    else if (/^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) choosePreset(PRESETS[+e.key - 1]);
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
  // tap the picture to play or pause; swipe sideways to change concept at the same moment
  let touch = null;
  $('stagewrap').addEventListener('pointerdown', e => {touch = {x: e.clientX, y: e.clientY};});
  $('stagewrap').addEventListener('pointerup', e => {
    if (!touch) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    const i = PRESETS.indexOf(preset);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (qmode && qi < QUESTIONS.length) {const o = QUESTIONS[qi].opts; qopt = (qopt + (dx < 0 ? 1 : o.length - 1)) % o.length; mix = {...o[qopt][1]}; renderQuestion(); draw();}
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
