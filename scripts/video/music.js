// Music lives on the song clock; heat is already sampled on the ride clock by the picture.
// Shapes share spectrum interpolation and accent selection, with no hidden theme or frame state.
import {W, H} from './camera.js';
import {mixHex} from './colour.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Leave room below the band for the Shorts comments (from roughly 0.85 H).
const BAND_SHIFT = {lowmid: -0.015 * H};

/** Loud accents: up to three bands above 0.25. Heat: up to six, from recent impact energy. Ties keep band order. */
export function accentedBands(row, mode, heat) {
  const top = k => row.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  return new Set(mode === 'heat' ? top(Math.floor(clamp(6 * heat / 1.47, 0, 6))) : top(3).filter(b => row[b] > 0.25));
}
export function spectrumAt(spectrum, t) {
  const sp = spectrum, x = clamp(t * sp.fps, 0, sp.frames.length - 1), i = Math.floor(x), j = Math.min(i + 1, sp.frames.length - 1), u = x - i;
  return sp.frames[i].map((v, b) => v + (sp.frames[j][b] - v) * u);
}
function smoothPath(ctx, pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);}
  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
}
export function drawBand(ctx, spectrum, t, heat, alpha, colours, look, allHot = false) {
  const shift = BAND_SHIFT[look.bandHeight];
  ctx.save(); ctx.translate(0, shift);
  // Iris draws in its own navy and lavender, lit toward white on a dark paper (on Black's paper the navy was nearly invisible,
  // theme study 8 November)
  const onDark = colours.irisLight;
  const row = spectrumAt(spectrum, t).map(v => Math.min(1, v)), n = row.length, step = W / n, lit = c => onDark ? mixHex(c, '#ffffff', 0.62) : c;
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hot = allHot ? new Set(row.keys()) : accentedBands(row, look.accent, heat);
  if (look.band === 'fork') {
    // Quiet stems; the accent turns a few dots the accent colour (solid, ≥ 4 px: colour survives only in masses)
    const base = 0.825 * H, hgt = 0.15 * H, radius = 7;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - radius - (hgt - 2 * radius) * v, on = hot.has(i);
      ctx.strokeStyle = mixHex(colours.paper, colours.band, 0.42); ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.7; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = on ? colours.accent : colours.band; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, on ? radius + 2 : radius, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (look.band === 'bars') {
    // Bars with a reflection, which stops above the comments; an accented bar turns solid
    const base = 0.80 * H, hgt = 0.15 * H, bw = step * 0.8, room = 0.853 * H - (base + shift) - 6;
    row.forEach((v, i) => {
      const h = Math.max(2, v * hgt), x = (i + .5) * step - bw / 2; ctx.fillStyle = hot.has(i) ? colours.accent : colours.band;
      ctx.globalAlpha = alpha * 0.92; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = alpha * 0.28; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));
    });
  } else if (look.band === 'dots') {
    // each band a column of dots, as many as it is loud; without a reflection the band sits a little lower than the bars (round 49)
    const base = 0.815 * H, rad = Math.min(8, step * 0.36), pitch = 2 * rad + 5, most = Math.floor(0.15 * H / pitch);
    row.forEach((v, i) => {
      ctx.fillStyle = hot.has(i) ? colours.accent : colours.band; ctx.globalAlpha = alpha * 0.92;
      for (let d = 0, count = Math.max(1, Math.round(v * most)); d < count; d++) {ctx.beginPath(); ctx.arc((i + .5) * step, base - rad - d * pitch, rad, 0, 2 * Math.PI); ctx.fill();}
    });
  } else if (look.band === 'iris' || look.band === 'strands') {
    // bold strands for a phone, where thin ones fade (phone review, 8 November): main line 3.8 → 7 px, echoes 2.6 → 4.5 px
    // the theme's strands (lab) sit a little lower: there is no reflection under them
    const base = (look.band === 'strands' ? 0.83 : 0.82) * H, hgt = 0.14 * H, weight = look.band === 'strands' ? 1.1 : look.irisWeight === 'bold' ? 1.8 : 1; // the theme's strands: between the thinnest and a fifth heavier (round 50)
    const swing = look.band === 'strands' ? 1.0 : 0.72; // the theme's strands (lab) swing wider
    const contour = (vals, dy) => {const pts = vals.map((v, i) => ({x: -10 + (W + 20) * i / (n - 1), y: base - v * hgt * swing + dy})); ctx.beginPath(); smoothPath(ctx, pts);};
    [.06, .12, .18, .24, .3, .36, .42].map((age, i) => ({age, i})).reverse().forEach(({age, i}) => {
      if (t < age) return; contour(spectrumAt(spectrum, t - age), hgt * .04 * (i + 1));
      ctx.strokeStyle = look.band === 'strands' ? colours.band : lit('#8f86c9'); ctx.lineWidth = 2.6 * weight; ctx.globalAlpha = alpha * (.42 - i * .032); ctx.stroke();
    });
    contour(row, 0); ctx.strokeStyle = look.band === 'strands' ? colours.accent : lit('#2f3a74'); ctx.lineWidth = 3.8 * weight; ctx.globalAlpha = alpha * .92; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
