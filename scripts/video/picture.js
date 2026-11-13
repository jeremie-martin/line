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
// the ending) at song time t. A hit happens at its strongest frame (round 23): its split, colour boost, accent heat and (on
// strong hits) shake start there, on their own, sized by its measured strength (never a rank, never the spec's request), and
// pushed along the line struck at its onset. Owner's decisions, round by round, are in generated/concept-lab/LEDGER.md.
import {W, H, rideSignals, createFraming} from './camera.js';
import {FPS, rideTime, songTime} from './timing.js';
import {rideIntensity, intensityAt} from './intensity.js';
import {prepareHits, hitEffectsAt, hitHeatAt, TUNES} from './hits.js';
import {createSplit} from './split.js';
import {prepareTrack, drawTrack} from './track.js';
import {drawBand} from './music.js';
import {drawSky} from './sky.js';
import {createTheme, dropSpan} from './theme.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
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

export function createPicture(canvas, scene, replay, sheet, paint) {
  const ctx = canvas.getContext('2d'), overlay = document.createElement('canvas'), octx = overlay.getContext('2d');
  const frames = replay.frames, {offset} = scene.timing, [, songEnd] = scene.span;

  // ── the ride, prepared once ──────────────────────────────────────────────
  const centres = frames.map(centreOf);
  const track = prepareTrack(scene.track.lines, replay.contacts, centres);
  const hits = prepareHits(scene.account, replay.contacts, centres, track.byId);
  const motion = rideSignals(centres);
  const level = rideIntensity(motion.velocity.map(v => v.speed), hits, scene.track.duration / FPS);
  // Hit metadata and hand-authored cues share the song clock; ride signals stay on the ride clock.
  const hitTimes = hits.map(h => ({t: songTime(h.time, offset), s: h.strength}));
  const themeAt = createTheme(dropSpan(scene.drop, hitTimes));
  const frameAt = createFraming(motion, level, hitTimes, songEnd);

  const applySplit = createSplit(canvas);
  // the colour boost: everything drawn on the paper (ink, line, rider, band, sun, title) gets more saturated and more contrasted for
  // an instant, while the paper stays exactly the paper: the frame's content is drawn on a clear canvas and laid on the paper
  // through the filter. It reads on any palette, a dark drop included.
  const boostCanvas = document.createElement('canvas');
  // `under` draws, on the paper itself, what the boost must leave alone: the pencilled course ahead (a contrast boost pushes a
  // light pencil toward the paper, so on strong hits the course ahead blinked out as the rider landed: phone review, 8 November)
  function layBoosted(a, paper, under) {
    const w = canvas.width, hh = canvas.height;
    if (boostCanvas.width !== w || boostCanvas.height !== hh) {boostCanvas.width = w; boostCanvas.height = hh;}
    const g = boostCanvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh); g.drawImage(canvas, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = paper; ctx.fillRect(0, 0, w, hh); under();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `saturate(${1 + 0.3 * a}) contrast(${1 + 0.25 * a})`; ctx.drawImage(boostCanvas, 0, 0); ctx.restore();
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // The top of the frame, behind the ride. The sun is a mass, not a line: it stays colour on a phone; its size follows the ride's
  // intensity at this frame.
  function drawTop(level, alpha, colours, look) {
    let box = null;
    ctx.save(); ctx.globalAlpha = alpha;
    if (look.top !== 'title') drawSky(ctx, look.top, level, colours, look);
    if (look.top === 'title') {
      // at most two lines, broken where the two are most even, never wider than 62 % of the frame (smaller type if needed)
      const words = scene.title.split(' '), font = px => `800 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.font = font(92); const wd = a => ctx.measureText(a.join(' ')).width;
      let rows = [words]; for (let i = 1; i < words.length; i++) {const c = [words.slice(0, i), words.slice(i)]; if (Math.max(...c.map(wd)) < Math.max(...rows.map(wd))) rows = c;}
      const px = Math.min(92, 92 * 0.62 * W / Math.max(...rows.map(wd)));
      ctx.fillStyle = colours.ink; ctx.font = font(px); ctx.textBaseline = 'top'; rows.forEach((l, i) => ctx.fillText(l.join(' '), 0.07 * W, 0.04 * H + i * 1.02 * px));
      box = [0.07 * W - 4, 0.04 * H - 4, Math.max(...rows.map(l => ctx.measureText(l.join(' ')).width)) + 8, rows.length * 1.02 * px + 8];
    }
    ctx.restore();
    return box;
  }
  // the rider stays on its own screen point at any zoom
  function riderCamera(v, ox, oy, k) {
    const zr = v.z, px = v.ax + ox, py = v.ay + oy;
    return {x: v.x + (W / 2 - px) / zr, y: v.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
  }
  function drawRider(rc, at) {
    if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
    paint(octx, rc, sheet, riderAt(frames, at), at);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(overlay, 0, 0);
  }

  /** Draw the frame at song time t (s). `exaggerate` is the lab's viewing aid: it multiplies every hit effect alike and is never
   * part of a look, a film or a video. Returns the world-to-canvas transform the ride was drawn with (before the split). */
  function draw(t, look, exaggerate = 1) {
    const r = rideTime(t, offset), at = clamp(r * FPS, 0, frames.length - 1), k = canvas.width / W;
    const intensity = intensityAt(level, r);
    const fx = hitEffectsAt(look.hits === 'none' ? [] : hits, r, exaggerate, TUNES[look.hits] ?? TUNES.v1);
    const colours = themeAt(t, intensity, look), v = frameAt(t, at, look);
    let titleBox = null; // only the title drawn in this frame gets its smaller split
    const boosting = fx.boost;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    // with a colour boost, the content is drawn on a clear canvas and laid on the paper afterwards
    if (boosting > 0.01) ctx.clearRect(0, 0, canvas.width, canvas.height); else {ctx.fillStyle = colours.paper; ctx.fillRect(0, 0, canvas.width, canvas.height);}
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (look.top !== 'none') {const a = (1 - v.over) ** 2; if (a > 0.003) titleBox = drawTop(intensity, a, colours, look);}
    // the band is drawn before the ride, so the split catches it with the title and sun (R11)
    const band = v.ending ? (1 - v.over) ** 2 : 1;
    if (band > 0.003 && look.band !== 'none') drawBand(ctx, scene.spectrum, t, hitHeatAt(hits, r), band, colours, look, fx.lit);
    const cc = {...v, ax: v.ax + fx.dx, ay: v.ay + fx.dy}, world = new DOMMatrix([cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k]);
    ctx.setTransform(world);
    const visible = track.visibleAt(cc), boosted = boosting > 0.01;
    drawTrack(ctx, visible, at, cc.z, colours, look.line, v.over, boosted ? 'ink' : 'all');
    drawRider(riderCamera(v, fx.dx, fx.dy, k), at);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (boosted) layBoosted(boosting, colours.paper, () => {ctx.setTransform(world); drawTrack(ctx, visible, at, cc.z, colours, look.line, v.over, 'pencil');});
    applySplit(k, fx, overlay, titleBox);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return world;
  }

  /** The ride's intensity (0–1) at song time t. */
  const levelAt = t => intensityAt(level, rideTime(t, offset));
  const schemeAt = (t, look) => themeAt(t, levelAt(t), look).scheme;
  return {draw, span: scene.span, timing: scene.timing, hitTimes, schemeAt, levelAt};
}
