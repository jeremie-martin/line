// What stands at the top of the frame, or behind the band, besides the title (look.top). The sun is production; the others are in
// the lab (round 48). Everything is a mass, static in the frame, sized by the ride's intensity; `kick` (0–1) is a hit's punch
// when the look asks the sun to answer hits. Pure: no state between frames.
import {W, H} from './camera.js';
import {mixHex} from './colour.js';

const HORIZON = 0.785 * H;
// fixed stars: [x, y, size] in fractions of the frame, none where the moon is
const STARS = [[.08, .05, 5], [.21, .11, 4], [.37, .04, 6], [.52, .09, 4], [.13, .21, 6], [.31, .19, 4], [.46, .25, 5], [.06, .33, 4], [.24, .31, 5],
  [.58, .31, 4], [.93, .32, 5], [.84, .37, 4], [.41, .37, 4], [.69, .40, 5], [.16, .42, 4], [.95, .06, 4]];
const ridge = (ctx, top, amp, f, phase, colour) => {
  ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(0, HORIZON);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, top - amp * (0.6 * Math.sin(f * x / W * 6.283 + phase) + 0.4 * Math.sin(2.3 * f * x / W * 6.283 + 1.7 * phase)));
  ctx.lineTo(W, HORIZON); ctx.closePath(); ctx.fill();
};

export function drawSky(ctx, kind, level, kick, colours, look, row) {
  const r = W * (0.1 + 0.09 * level) * (1 + 0.3 * kick), sx = 0.74 * W, sy = 0.17 * H - look.sunLift;
  const disc = (x, y, rad) => {ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.fill();};
  ctx.fillStyle = colours.sun;
  if (kind === 'great') { // a very large pale disc, partly out of the frame
    ctx.fillStyle = mixHex(colours.paper, colours.sun, 0.3); disc(0.80 * W, 0.19 * H, W * (0.42 + 0.1 * level) * (1 + 0.1 * kick)); return;
  }
  if (kind === 'horizon') { // a sun half set behind the band
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HORIZON); ctx.clip(); disc(0.68 * W, HORIZON, W * (0.2 + 0.1 * level) * (1 + 0.2 * kick)); ctx.restore(); return;
  }
  if (kind === 'hills') [[0.655 * H, 26, 1.3, 0.4, 0.1], [0.70 * H, 20, 2.1, 2.2, 0.17], [0.74 * H, 14, 3.2, 4.1, 0.26]]
    .forEach(([top, amp, f, phase, mix]) => ridge(ctx, top, amp, f, phase, mixHex(colours.paper, colours.band, mix)));
  if (kind === 'fuji') { // one mountain behind the band, its cap in the ground's colour
    const px = 0.34 * W, py = 0.585 * H, half = 0.50 * W, cone = y => (y - py) / (HORIZON - py), side = (s, y) => px + s * half * (0.08 + 0.92 * cone(y) ** 1.35);
    const shape = to => {ctx.beginPath(); ctx.moveTo(side(-1, py), py); for (let y = py; y <= to; y += 8) ctx.lineTo(side(1, y), y); ctx.lineTo(side(1, to), to); ctx.lineTo(side(-1, to), to); for (let y = to; y >= py; y -= 8) ctx.lineTo(side(-1, y), y); ctx.closePath(); ctx.fill();};
    ctx.fillStyle = mixHex(colours.paper, colours.band, 0.3); shape(HORIZON);
    ctx.fillStyle = mixHex(colours.paper, colours.band, 0.06); shape(py + 0.045 * H);
  }
  ctx.fillStyle = colours.sun;
  if (kind === 'crescent') {
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(sx + 0.42 * r, sy - 0.2 * r, 0.9 * r, 0, 2 * Math.PI); ctx.fill('evenodd'); ctx.restore(); return;
  }
  if (kind === 'ring') {ctx.strokeStyle = colours.sun; ctx.lineWidth = 0.3 * r; ctx.beginPath(); ctx.arc(sx, sy, 0.85 * r, 0, 2 * Math.PI); ctx.stroke(); return;}
  if (kind === 'rays') { // the spectrum as rays around a smaller sun, low notes at the top, running both ways round
    const core = 0.72 * r, n = row.length; disc(sx, sy, core); ctx.strokeStyle = colours.sun; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const v = row[Math.min(n - 1, Math.floor((i < 20 ? i : 39 - i) / 20 * n))], a = -Math.PI / 2 + (i + 0.5) / 40 * 2 * Math.PI, from = core + 16, to = from + 6 + 0.9 * r * v;
      ctx.beginPath(); ctx.moveTo(sx + from * Math.cos(a), sy + from * Math.sin(a)); ctx.lineTo(sx + to * Math.cos(a), sy + to * Math.sin(a)); ctx.stroke();
    }
    return;
  }
  disc(sx, sy, r);
  if (kind === 'stars') for (const [x, y, s] of STARS) {disc(x * W, y * H, s * (0.8 + 0.5 * level));}
}
