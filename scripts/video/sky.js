// The disc at the top of the frame (look.top): the sun, or in the lab (round 48) a crescent or the moon among a few stars. A mass,
// static in the frame, sized by the ride's intensity. Pure: no state between frames.
import {W, H} from './camera.js';

// fixed stars: [x, y, size] in fractions of the frame, none where the moon is
const STARS = [[.08, .05, 5], [.21, .11, 4], [.37, .04, 6], [.52, .09, 4], [.13, .21, 6], [.31, .19, 4], [.46, .25, 5], [.06, .33, 4], [.24, .31, 5],
  [.58, .31, 4], [.93, .32, 5], [.84, .37, 4], [.41, .37, 4], [.69, .40, 5], [.16, .42, 4], [.95, .06, 4]];

export function drawSky(ctx, kind, level, colours, look) {
  const r = W * (0.1 + 0.09 * level), sx = 0.74 * W, sy = 0.17 * H - look.sunLift;
  const disc = (x, y, rad) => {ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.fill();};
  ctx.fillStyle = colours.sun;
  if (kind === 'crescent') {
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(sx + 0.42 * r, sy - 0.2 * r, 0.9 * r, 0, 2 * Math.PI); ctx.fill('evenodd'); ctx.restore(); return;
  }
  disc(sx, sy, r);
  if (kind === 'stars') for (const [x, y, s] of STARS) disc(x * W, y * H, s * (0.8 + 0.5 * level));
}
