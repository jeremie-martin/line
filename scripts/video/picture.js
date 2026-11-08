// The picture: one frame of a finished video at song time t, for a look (look.js). The concept lab, its films and the finished
// videos all draw through this, so what the owner approves in the lab is what ships.
//
// createPicture(canvas, scene, replay, sheet, paint):
//   scene  — scene.ts: the ride, its impact account and timing, and the song's span, spectrum and drop
//   replay — the native replay of the ride (renderer worker): per physics frame the rider's points and the lines it touches;
//            the camera follows these points, so a bare track renders as well as a saved production
//   sheet, paint — the vendored rider artwork and its painter (renderer bundle)
// draw(t, look) draws song time t, a pure function of t for a given look: nothing carries from one frame to the next (the title's
// box is measured in the frame that draws the title), so frames can be drawn in any order. Everything is designed on
// 1080 × 1920 and scaled to the canvas's width; videos are 9:16.
//
// Two clocks (timing.js, docs/TIMING-DESIGN.md): the ride (rider, camera, line inking, the intensity metric, and everything a hit
// triggers) is drawn at ride time r = t + offset; the song (the band, the drop's cue, the title, the sun's place, the opening and
// the ending) at song time t. A hit happens at its strongest frame (round 23): its shake, split, flash and accent heat start
// there, on their own, sized by its measured strength (never a rank, never the spec's request), and pushed along the line struck
// at its onset. Owner's decisions, round by round, are in generated/concept-lab/LEDGER.md.
import {W, H, smoothstep, rideSignals, followCamera} from './camera.js';
import {FPS, rideTime, songTime} from './timing.js';
import * as I from './intensity.js';
import {SCHEMES, DROP_SCHEMES} from './palettes.js';

const ZOOM = 6.2; // 15 % closer than the first videos (R4)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('');};
/** The rider's ten body points, in the order compiled rides are traced in (scripts/gallery/artifacts.ts); the camera follows
 * their mean, which stays smooth through a spin where any single point circles. */
export const BODY_POINTS = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const centreOf = frame => {
  const at = new Map(frame.points.map(p => [p.name, p.pos])); let x = 0, y = 0;
  for (const name of BODY_POINTS) {const p = at.get(name); x += p.x; y += p.y;}
  return {x: x / BODY_POINTS.length, y: y / BODY_POINTS.length};
};

/** The rider's pose at fractional physics frame `at`, interpolated as the native player does. */
export function riderAt(frames, at) {
  const c = Math.max(0, Math.min(at, frames.length - 1)), i = Math.floor(c), t = c - i;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  if (!t) return a;
  const m = (x, y) => x + (y - x) * t;
  return {points: a.points.map((p, j) => ({name: p.name, pos: {x: m(p.pos.x, b.points[j].pos.x), y: m(p.pos.y, b.points[j].pos.y)}})),
    framesSinceUnmount: m(a.framesSinceUnmount, b.framesSinceUnmount), framesSinceSledBreak: m(a.framesSinceSledBreak, b.framesSinceSledBreak),
    framesSinceStringDetached: m(a.framesSinceStringDetached, b.framesSinceStringDetached)};
}

// ── hits: each effect answering the hit's measured strength s on its own curve, with no ceiling ──────
// (R13–R17: "if there's a very rare, very powerful hit, let's go for it"). CAP is only a safety net at twice the chosen values.
const ramp = (s, from, full) => (s - from) / (full - from);
const linR = (s, from, full) => Math.max(0, ramp(s, from, full));
const riseR = (s, from, full, p = 2) => {const x = ramp(s, from, full); return x <= 0 ? 0 : x <= 1 ? Math.pow(x, p) : 1 + p * (x - 1);};
const SHAKE = s => Math.min(48, 24 * linR(s, 0.2, 0.85)); // px: straight from 0 at 0.2 to 24 px at 0.85 (R13, R17)
const SPLIT = s => 14 * Math.min(3, 1.5 * riseR(s, 0.3, 0.85)); // px before the direction's match: a slow start from 0.3 (R15)
const FLASH = s => Math.min(0.5, s <= 0.85 ? 0.25 * smoothstep(ramp(s, 0.6, 0.85)) : 0.25 + 0.25 * (s - 0.85)); // 0.6 → 25 % at 0.85, gently on (R17)
// The ways a hit can be felt (look.hits), compared in rounds 24–26. Plain names, one meaning each:
//   shake — the whole frame is knocked along the hit's direction and springs back;
//   split — the red and blue channels pull apart for an instant;
//   flash — the picture fades toward the paper colour for an instant;
//   colour boost — what is drawn on the paper gets more saturated and more contrasted for an instant; the paper does not change.
// A recipe lists its effects, each as a curve of the hit's measured strength. (A zoom on the rider was tried twice, R6–R8 and
// R24–R25, and rejected: "I hate seeing the rider become bigger and then smaller… all the geometry".)
const BOOST = s => 1.5 * Math.min(2, s <= 0.85 ? smoothstep(ramp(s, 0.35, 0.85)) : 1 + 1.5 * (s - 0.85)); // from 0.35, full ×1.5 at 0.85, gently on
/** The shake kept for strong hits: nothing below `from`, then the flash's S-curve to today's 24 px at `full`, then gently on. */
const strongShake = (from, full) => s => Math.min(48, s <= full ? 24 * smoothstep(ramp(s, from, full)) : 24 + 40 * (s - full));
/** Exported for the round pages' curves, so a chart shows exactly what is drawn. */
export const RECIPES = {
  v1: {shake: SHAKE, split: SPLIT, flash: FLASH}, // today: shake, split, flash (R7–R19)
  noMotion: {split: SPLIT, boost: BOOST}, // no camera motion: the split and the colour boost carry the hit (R25: "a game changer")
  shakeFrom60: {shake: strongShake(0.6, 0.85), split: SPLIT, boost: BOOST}, // and the shake on strong hits, from strength 0.6
  shakeFrom70: {shake: strongShake(0.7, 0.9), split: SPLIT, boost: BOOST}, // and the shake on the strongest, from strength 0.7
};
const HALF = 0.61; // the halfway split shows the same fringe as the sideways one, on average (fitted on Tomada and Los Voltaje, R8)
const TITLE_SPLIT = 0.65, TITLE_PULSE = 0.45; // the title gets a little less split (R16) and less of its zoom pulse (R19)
// Strength as duration: the peak is held at least one full 60 fps frame (no hit loses its peak to the frame grid); the
// recovery ends within 0.25 s.
const excess = e => Math.pow(e, 2.2);
const held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
// The lower band sits between the ride and the Shorts comments (which start near 0.85 H).
const BAND_SHIFT = {low: 0, lowmid: -0.015 * H, mid: -0.03 * H};

export function createPicture(canvas, scene, replay, sheet, paint) {
  const ctx = canvas.getContext('2d'), overlay = document.createElement('canvas'), octx = overlay.getContext('2d');
  const frames = replay.frames, {offset} = scene.timing, [, songEnd] = scene.span;

  // ── the ride, prepared once ──────────────────────────────────────────────
  const lines = scene.track.lines.map(l => ({id: l.id, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, touch: Infinity}));
  const byId = new Map(lines.map(l => [l.id, l]));
  replay.contacts.forEach((ids, f) => {for (const id of ids) {const l = byId.get(id); if (l && f < l.touch) l.touch = f;}});
  const centres = frames.map(centreOf);
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
    const chains = new Map(); lines.forEach((l, i) => {const r = find(i); if (!chains.has(r)) chains.set(r, []); chains.get(r).push(l);});
    // A rail inks as the rider passes it, not only where a contact was recorded: on five songs 8–17 % of the course stayed pencil
    // behind the rider, about 90 % of it within 14 units of the body, and a third of used rails ended in a grey tail.
    const cs = centres, reach = []; {let m = -Infinity; for (const c of cs) reach.push(m = Math.max(m, c.x));}
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
  // each hit: a measured event that answered a target, in target order (scene.ts checks their strongest frames follow it), at its
  // strongest frame in ride seconds, with the struck line's normal on the rider's side (the direction of its effects, a property
  // of the geometry: the line touched nearest its onset, where the strike begins)
  const account = scene.account, matchOf = new Map(account?.matches.map(m => [m.target, m.event]));
  const hits = (account?.targets ?? []).flatMap((_, i) => {
    if (!matchOf.has(i)) return [];
    const e = account.events[matchOf.get(i)], f0 = e.onset; let pos = null, nrm = {x: 0, y: -1}, best = Infinity;
    for (let f = f0 - 2; f <= f0 + 4 && !pos; f++) {
      const ids = replay.contacts[f] ?? []; if (!ids.length) continue;
      const c = centres[Math.min(f, centres.length - 1)];
      for (const id of ids) {
        const l = byId.get(id); if (!l) continue;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2));
        const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) {
          best = d; pos = p;
          const L = Math.sqrt(L2) || 1; let nx = -dy / L, ny = dx / L;
          if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) {nx = -nx; ny = -ny;}
          nrm = {x: nx, y: ny};
        }
      }
    }
    return [{r: e.peak / FPS, s: e.strength, I: I.strength(e.strength), nrm}];
  });
  const R = rideSignals(centres, replay.contacts);
  // the whole-course view frames the ride itself (rails reaching past it may crop), with a margin
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  const bbox = {x0: x0 - 80, y0: y0 - 80, x1: x1 + 80, y1: y1 + 80};
  // the intensity metric (intensity.js): a description of the ride, on ride time, from its speed and its hits
  const speed = centres.map((_, f) => {const a = centres[Math.max(0, f - 1)], b = centres[Math.min(centres.length - 1, f + 1)], k = Math.min(centres.length - 1, f + 1) - Math.max(0, f - 1) || 1; return Math.hypot(b.x - a.x, b.y - a.y) / k * FPS;}).filter((_, f) => f % 4 === 0);
  const level = I.intensity(I.rawSignals({speed, hits: hits.map(h => ({t: h.r, s: h.s})), duration: scene.track.duration / FPS}));
  const cams = new Map();

  /** The intensity metric at ride time r, 0–1. */
  function intensityAt(r) {const x = clamp(r * I.FS, 0, level.length - 1), i = Math.floor(x), j = Math.min(i + 1, level.length - 1); return level[i] + (level[j] - level[i]) * (x - i);}

  // ── the song's own events: each hit's song time, once, for the drop and the opening ───────────────────
  // The drop's cue is placed in song time; each end snaps to the strongest hit near it.
  const hitsOnSong = hits.map(h => ({t: songTime(h.r, offset), h}));
  let night = null;
  if (scene.drop) {
    const strongestNear = (c, w) => hitsOnSong.filter(x => Math.abs(x.t - c) < w).reduce((a, b) => (!a || b.h.s > a.h.s ? b : a), null);
    const s = strongestNear(scene.drop[0], 0.4), exit = strongestNear(scene.drop[1], 0.8); night = [s ? s.t : scene.drop[0], exit ? exit.t : scene.drop[1]];
  }
  const inDrop = t => night && t >= night[0] && t < night[1];

  // ── camera ───────────────────────────────────────────────────────────────
  function cameraAt(look, at) {
    if (!cams.has(look.zoom)) cams.set(look.zoom, followCamera(R, {base: ZOOM, tide: look.zoom, level: f => level[clamp(Math.round(f / FPS * I.FS), 0, level.length - 1)]}));
    const cam = cams.get(look.zoom), i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
    const l = (p, q) => p + (q - p) * u;
    // the whole view can sit a little lower, a little more with a sun (design px; the camera's behaviour is unchanged, only translated)
    const dy = +look.riderLower + (look.top === 'sun' ? +look.sunRider : 0);
    return {z: l(a.z, b.z), ax: l(a.ax, b.ax), ay: l(a.ay, b.ay) + dy, x: l(a.x, b.x), y: l(a.y, b.y)};
  }
  const riderPoint = at => {const c = centres, i = clamp(Math.floor(at), 0, c.length - 1), j = Math.min(i + 1, c.length - 1), u = clamp(at - i, 0, 1); return {x: c[i].x + (c[j].x - c[i].x) * u, y: c[i].y + (c[j].y - c[i].y) * u};};
  // Whole-course opening and ending: a view is (the rider's screen point, ln zoom). The overview and the camera both keep the
  // rider in frame, so every blend of the two does too, by construction.
  function bookend(t, c, at, look) {
    const R = riderPoint(at), p = {x: c.ax + (R.x - c.x) * c.z, y: c.ay + (R.y - c.y) * c.z};
    const view = {...c, rx: p.x, ry: p.y, R, over: 0, ending: false};
    if (look.ends === 'none') return view;
    const b = bbox, zo = Math.min(0.78 * W / (b.x1 - b.x0), 0.5 * H / (b.y1 - b.y0)), o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2};
    const t1 = Math.min(2.2, hitsOnSong.find(x => x.t >= 1.3)?.t ?? 1.6), tE = songEnd - 3;
    let u = 1;
    if (t < t1) u = smoothstep((t - 0.25) / (t1 - 0.25));
    else if (t > tE) u = 1 - smoothstep((t - tE) / 2.6);
    if (u >= 1) return view;
    const q = {x: W / 2 + (R.x - o.x) * zo, y: 0.4 * H + (R.y - o.y) * zo}, rx = q.x + (p.x - q.x) * u, ry = q.y + (p.y - q.y) * u;
    return {z: Math.exp(Math.log(zo) + (Math.log(c.z) - Math.log(zo)) * u), ax: rx, ay: ry, x: R.x, y: R.y, rx, ry, R, over: 1 - u, ending: t > tE};
  }

  // ── hits ─────────────────────────────────────────────────────────────────
  /** The strongest live hit at ride time r and its envelope (0–1): each hit alone, never piling up. */
  function strongest(r) {
    let x = 0, last = null, lastEnv = 0, lastAge = 0;
    for (const h of hits) {
      if (h.r > r + 0.001) break; const age = r - h.r;
      const env = held(age, excess(h.I)), v = env * (0.01 + h.s); if (v > x) {x = v; last = h; lastEnv = env; lastAge = age;}
    }
    return {m: last ? lastEnv : 0, h: last, age: lastAge};
  }
  const into = h => ({x: -h.nrm.x, y: -h.nrm.y});
  // the shake: the frame is knocked along the blow at once, then springs back through rest (6 Hz) as the energy drains
  function shake({m, h, age}, curve) {
    if (!h || m < 0.002) return {dx: 0, dy: 0};
    const i = into(h), a = curve(h.s) * m * Math.cos(2 * Math.PI * 6 * age);
    return {dx: a * i.x, dy: a * i.y};
  }
  // The colour split, halfway between sideways and the hit's direction, over the whole picture (the band, title and sun too,
  // R11). Its overscan hides the edges and zooms the whole picture a little with each split: the pulse (R18).
  const chan = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
  let lastSplit = null, titleBox = null;
  function split(k, {m, h}, curve) {
    if (!h || m <= 0.002) return;
    const a = curve(h.s) * m * k, i = into(h);
    keepTitle(k, true); lastSplit = null;
    if (!(a > 0.5)) return;
    // the hit's direction plus a sideways unit on the same side as the hit's own x, so red stays on the hit's side
    const hx = i.x + (i.x < 0 ? -1 : 1), hy = i.y, n = Math.hypot(hx, hy) || 1;
    channelSplit(HALF * a * hx / n, HALF * a * hy / n);
    // the rider keeps half of its own clean image through the split (R4, restored R12); the overlay still holds this frame's rider
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.5; ctx.drawImage(overlay, 0, 0); ctx.restore();
    keepTitle(k, false);
  }
  function channelSplit(ox, oy) {
    const m = Math.ceil(Math.hypot(ox, oy)) + 2; lastSplit = {ox, oy, m};
    splitInto(ctx, canvas, ox, oy, m);
  }
  // red one way, blue the other, green in place; the overscan m hides the edges. The channels are built from `from` itself: it
  // is opaque and untouched until g0 is cleared below, so no copy of it is needed.
  function splitInto(g0, from, ox, oy, m) {
    const w = canvas.width, h = canvas.height;
    for (const c of chan) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
    ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => {const g = chan[i].getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(from, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, w, h);});
    g0.setTransform(1, 0, 0, 1, 0, 0); g0.fillStyle = '#000'; g0.fillRect(0, 0, w, h); g0.globalCompositeOperation = 'lighter';
    const o = (c, dx, dy) => g0.drawImage(c, dx - m, dy - m * h / w, w + 2 * m, h + 2 * m * h / w);
    o(chan[0], ox, oy); o(chan[1], 0, 0); o(chan[2], -ox, -oy);
    g0.globalCompositeOperation = 'source-over';
  }
  // The title's own, smaller split: the clean frame is kept before the split; after it, that frame is split again by a fraction
  // of the offset, with a smaller overscan, and laid over the title's area through a feathered mask. A smaller split, not a
  // blend: blending two splits looked grey and doubled. The sun is not touched (R19).
  const preCanvas = document.createElement('canvas'), maskCanvas = document.createElement('canvas'), smallCanvas = document.createElement('canvas');
  // the feathered mask depends only on the frame size and the title's box, so its blur (the costliest step) runs once per title
  const featherCanvas = document.createElement('canvas'); let featherKey = '';
  function keepTitle(k, before) {
    if (!titleBox) return; // only when this frame drew the title
    const w = canvas.width, h = canvas.height;
    if (before) {if (preCanvas.width !== w || preCanvas.height !== h) {preCanvas.width = w; preCanvas.height = h;} preCanvas.getContext('2d').drawImage(canvas, 0, 0); return;}
    if (!lastSplit) return;
    for (const c of [maskCanvas, smallCanvas]) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
    splitInto(smallCanvas.getContext('2d'), preCanvas, lastSplit.ox * TITLE_SPLIT, lastSplit.oy * TITLE_SPLIT, Math.max(1, Math.round(lastSplit.m * TITLE_PULSE)));
    const key = `${w}x${h}|${k}|${titleBox.join(',')}`;
    if (key !== featherKey) {
      featherKey = key; if (featherCanvas.width !== w || featherCanvas.height !== h) {featherCanvas.width = w; featherCanvas.height = h;}
      const f = featherCanvas.getContext('2d'); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, w, h);
      f.filter = `blur(${Math.round(14 * k)}px)`; f.fillStyle = '#000';
      const [x, y, bw, bh] = titleBox; f.fillRect((x - 10) * k, (y - 10) * k, (bw + 20) * k, (bh + 20) * k); f.filter = 'none';
    }
    const g = maskCanvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
    g.drawImage(featherCanvas, 0, 0); g.globalCompositeOperation = 'source-in'; g.drawImage(smallCanvas, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(maskCanvas, 0, 0); ctx.restore();
  }
  // the flash lifts the picture toward the paper actually on screen (Night's included: a white flash over a black drop was
  // "very bad", R21), only on strong hits
  function flash({m, h}, paper, curve) {
    if (!h || m < 0.003) return;
    const op = curve(h.s) * m; if (op < 0.003) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.3 * (op / 0.3); ctx.fillStyle = paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }

  // the colour boost: everything drawn on the paper (ink, line, rider, band, sun, title) gets more saturated and more contrasted for
  // an instant, while the paper stays exactly the paper: the frame's content is drawn on a clear canvas and laid on the paper
  // through the filter. It reads on any palette, a dark drop included.
  const boostCanvas = document.createElement('canvas');
  const boostOf = ({m, h}, curve) => !h || m < 0.003 ? 0 : curve(h.s) * m;
  function layBoosted(a, paper) {
    const w = canvas.width, hh = canvas.height;
    if (boostCanvas.width !== w || boostCanvas.height !== hh) {boostCanvas.width = w; boostCanvas.height = hh;}
    const g = boostCanvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh); g.drawImage(canvas, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = paper; ctx.fillRect(0, 0, w, hh);
    ctx.filter = `saturate(${1 + 0.3 * a}) contrast(${1 + 0.25 * a})`; ctx.drawImage(boostCanvas, 0, 0); ctx.restore();
  }

  // ── colour ───────────────────────────────────────────────────────────────
  // The drop switch carries the accent and the sun over, so the switch keeps one thread (Midnight's own moon was "bad", R6).
  const dropScheme = {};
  function schemeAt(t, look) {
    const o = SCHEMES[look.scheme], d = DROP_SCHEMES[look.scheme];
    if (!(look.drop === 'switch' && inDrop(t) && d)) return o;
    return dropScheme[look.scheme] ??= {...SCHEMES[d], accent: o.accent, sun: o.sun ?? o.accent};
  }
  // Paper: plain, or answering the ride's intensity (at ride time r); Night is the drop's dark version of the scheme.
  function themeAt(t, r, look) {
    const p = schemeAt(t, look), lit = bg => ({bg, ink: p.ink, pencil: p.pencil, dark: 0});
    if (look.drop === 'night' && inDrop(t)) return {bg: p.nightPaper, ink: p.nightInk, pencil: mixHex(p.nightPaper, p.nightInk, 0.38), dark: 1};
    if (look.paper === 'whisper') return lit(mixHex(p.paper, p.tone ?? p.mass, (p.tone ? 1 : 0.055) * intensityAt(r)));
    return lit(p.paper);
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // The top of the frame, behind the ride. The sun is a mass, not a line: it stays colour on a phone; its size follows the ride's
  // intensity (at ride time rt).
  function drawTop(t, rt, alpha, th, look) {
    const p = schemeAt(t, look); ctx.save(); ctx.globalAlpha = alpha;
    if (look.top === 'sun') {const r = W * (0.1 + 0.09 * intensityAt(rt)), sy = 0.17 * H - look.sunLift; ctx.fillStyle = th.dark ? p.nightInk : p.sun ?? p.accent; ctx.beginPath(); ctx.arc(0.74 * W, sy, r, 0, 2 * Math.PI); ctx.fill();}
    if (look.top === 'title') {
      // at most two lines, broken where the two are most even, never wider than 62 % of the frame (smaller type if needed)
      const words = scene.title.split(' '), font = px => `800 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.font = font(92); const wd = a => ctx.measureText(a.join(' ')).width;
      let rows = [words]; for (let i = 1; i < words.length; i++) {const c = [words.slice(0, i), words.slice(i)]; if (Math.max(...c.map(wd)) < Math.max(...rows.map(wd))) rows = c;}
      const px = Math.min(92, 92 * 0.62 * W / Math.max(...rows.map(wd)));
      ctx.fillStyle = th.ink; ctx.font = font(px); ctx.textBaseline = 'top'; rows.forEach((l, i) => ctx.fillText(l.join(' '), 0.07 * W, 0.04 * H + i * 1.02 * px));
      titleBox = [0.07 * W - 4, 0.04 * H - 4, Math.max(...rows.map(l => ctx.measureText(l.join(' ')).width)) + 8, rows.length * 1.02 * px + 8];
    }
    ctx.restore();
  }
  function visibleLines(c) {
    const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
    const seen = new Set();
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++)
      for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++)
        for (const l of grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
    return out;
  }
  function drawLines(visible, at, z, th, look, over) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = filter => {ctx.beginPath(); for (const l of visible) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
    const ink = Math.max(2, 3.6 / z);
    if (look.line === 'ink') {path(() => true); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke(); return;}
    const done = look.line === 'rail' ? l => l.rail <= at : l => l.ink <= at;
    path(l => !done(l)); ctx.strokeStyle = over > 0.02 ? mixHex(th.pencil, th.ink, 0.25 * over) : th.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * over) / z); ctx.stroke();
    path(done); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();
  }
  // the rider stays on its own screen point at any zoom
  function riderCamera(v, ox, oy, k) {
    const zr = v.z, px = v.rx + ox, py = v.ry + oy;
    return {x: v.R.x + (W / 2 - px) / zr, y: v.R.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
  }
  function drawRider(rc, at) {
    if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
    paint(octx, rc, sheet, riderAt(frames, at), at);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(overlay, 0, 0);
  }
  function spectrumRow(t) {
    const sp = scene.spectrum, x = clamp(t * sp.fps, 0, sp.frames.length - 1), i = Math.floor(x), j = Math.min(i + 1, sp.frames.length - 1), u = x - i;
    return sp.frames[i].map((v, b) => v + (sp.frames[j][b] - v) * u);
  }
  // which bars take the accent: 'loud', the loudest three; 'heat', as many as recent hits have heated up
  // the band's accented bars: with heat, as many as the hits' recent energy at ride time r; otherwise the loudest
  function accented(r, row, look) {
    const top = k => row.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
    if (look.accent === 'heat') {let h = 0; for (const x of hits) {if (x.r > r) break; h += x.I * Math.exp(-(r - x.r) / 0.8);} return new Set(top(Math.floor(clamp(6 * h / 1.47, 0, 6))));}
    return new Set(top(3).filter(b => row[b] > 0.25));
  }
  function smoothPath(pts) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);}
    ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
  }
  function drawBand(t, r, alpha, th, look) {
    const shift = BAND_SHIFT[look.bandHeight];
    ctx.save(); ctx.translate(0, shift);
    const row = spectrumRow(t).map(v => Math.min(1, v)), n = row.length, step = W / n, lit = c => th.dark ? mixHex(c, '#ffffff', 0.62 * th.dark) : c;
    ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const p = schemeAt(t, look), RED = p.accent, graphite = th.dark ? p.nightInk : p.mass;
    if (look.band === 'fork') {
      // graphite stems; the accent turns a few dots the accent colour (solid, ≥ 4 px: colour survives only in masses)
      const base = 0.825 * H, hgt = 0.15 * H, r = 7, hot = accented(r, row, look);
      row.forEach((v, i) => {
        if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, on = hot.has(i);
        ctx.strokeStyle = mixHex(th.bg, graphite, 0.42); ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.7; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = on ? RED : graphite; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, on ? r + 2 : r, 0, 2 * Math.PI); ctx.fill();
      });
    } else if (look.band === 'bars') {
      // graphite bars with a reflection, which stops above the comments; an accented bar turns solid
      const base = 0.80 * H, hgt = 0.15 * H, bw = step * 0.8, room = 0.853 * H - (base + shift) - 6, hot = accented(r, row, look);
      row.forEach((v, i) => {
        const h = Math.max(2, v * hgt), x = (i + .5) * step - bw / 2; ctx.fillStyle = hot.has(i) ? RED : graphite;
        ctx.globalAlpha = alpha * 0.92; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = alpha * 0.28; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));
      });
    } else if (look.band === 'iris') {
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

  /** Draw the frame at song time t (s). `exaggerate` is the lab's viewing aid: it multiplies every hit effect alike and is never
   * part of a look, a film or a video. Returns the world-to-canvas transform the ride was drawn with (before the split). */
  function draw(t, look, exaggerate = 1) {
    const r = rideTime(t, offset), at = clamp(r * FPS, 0, frames.length - 1), k = canvas.width / W, recipe = RECIPES[look.hits];
    const fx = recipe && exaggerate !== 1 ? Object.fromEntries(Object.entries(recipe).map(([name, curve]) => [name, s => curve(s) * exaggerate])) : recipe;
    const hit = fx ? strongest(r) : null;
    const th = themeAt(t, r, look), v = bookend(t, cameraAt(look, at), at, look), hc = fx?.shake ? shake(hit, fx.shake) : {dx: 0, dy: 0};
    titleBox = null; // set by drawTop when it draws the title in this frame
    const boosting = fx?.boost ? boostOf(hit, fx.boost) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    // with a colour boost, the content is drawn on a clear canvas and laid on the paper afterwards
    if (boosting > 0.01) ctx.clearRect(0, 0, canvas.width, canvas.height); else {ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);}
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (look.top !== 'none') {const a = (1 - v.over) ** 2; if (a > 0.003) drawTop(t, r, a, th, look);}
    // the band is drawn before the ride, so the split catches it with the title and sun (R11)
    const band = v.ending ? (1 - v.over) ** 2 : 1;
    if (band > 0.003 && look.band !== 'none') drawBand(t, r, band, th, look);
    const cc = {...v, ax: v.ax + hc.dx, ay: v.ay + hc.dy}, world = new DOMMatrix([cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k]);
    ctx.setTransform(world);
    drawLines(visibleLines(cc), at, cc.z, th, look, v.over);
    drawRider(riderCamera(v, hc.dx, hc.dy, k), at);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (boosting > 0.01) layBoosted(boosting, th.bg);
    if (fx) {
      split(k, hit, fx.split); ctx.setTransform(k, 0, 0, k, 0, 0);
      if (fx.flash) flash(hit, th.bg, fx.flash);
    }
    return world;
  }

  /** The hits at the song times they are seen (song seconds), in order: [{t, s}]. */
  const hitTimes = hitsOnSong.map(({t, h}) => ({t, s: h.s}));
  return {draw, span: scene.span, timing: scene.timing, hitTimes, schemeAt};
}
