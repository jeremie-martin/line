// What stands at the top of the frame besides the title (look.top): the sun, or in the lab (rounds 48–49) a crescent, the moon
// among a few stars, or a sun half set behind the band. Masses, static in the frame, sized by the ride's intensity. Pure: no
// state between frames.
import {W, H} from './camera.js';

// fixed stars: [x, y, size] in fractions of the frame, none where the moon is
const STARS = [[.08, .05, 5], [.21, .11, 4], [.37, .04, 6], [.52, .09, 4], [.13, .21, 6], [.31, .19, 4], [.46, .25, 5], [.06, .33, 4], [.24, .31, 5],
  [.58, .31, 4], [.93, .32, 5], [.84, .37, 4], [.41, .37, 4], [.69, .40, 5], [.16, .42, 4], [.95, .06, 4]];
// how large a star at height y (fraction of the frame) is drawn: `thin` halves them from 0.15 down to the rider's level, `high`
// keeps only those above 0.27
const STAR_SIZE = {
  stars: () => 1,
  starsThin: y => 1 - 0.55 * Math.max(0, Math.min(1, (y - 0.15) / 0.27)),
  starsHigh: y => y < 0.27 ? 1 : 0,
};
STAR_SIZE.crescentStars = STAR_SIZE.starsThin;

export function drawSky(ctx, kind, level, colours, look) {
  const r = W * (0.1 + 0.09 * level), sx = 0.74 * W, sy = 0.17 * H - look.sunLift;
  const disc = (x, y, rad) => {ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.fill();};
  ctx.fillStyle = colours.sun;
  if (kind === 'sunset') { // on the left, away from the rider's side of the frame, and smaller than the sun at the top
    const horizon = 0.785 * H; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip(); disc(0.25 * W, horizon, W * (0.13 + 0.07 * level)); ctx.restore(); return;
  }
  if (kind === 'crescent' || kind === 'crescentStars') {
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(sx + 0.42 * r, sy - 0.2 * r, 0.9 * r, 0, 2 * Math.PI); ctx.fill('evenodd'); ctx.restore();
  } else disc(sx, sy, r);
  const size = STAR_SIZE[kind];
  if (size) for (const [x, y, s] of STARS) {const k = size(y); if (k > 0) disc(x * W, y * H, s * k * (0.8 + 0.5 * level));}
}
