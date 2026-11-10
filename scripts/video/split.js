// Canvas colour separation, shared by every picture. Scratch canvases are reused, but every input
// that affects the image is passed for this frame. The feather cache depends only on size and title box.
const HALF = 0.61; // matched fringe size, halfway direction vs sideways (R8)
const TITLE_SPLIT = 0.65, TITLE_PULSE = 0.45; // R16 / R19: smaller split and overscan on the title

export function createSplit(canvas) {
  const ctx = canvas.getContext('2d');
  const chan = Array.from({length: 3}, () => document.createElement('canvas'));
  const preCanvas = document.createElement('canvas'), maskCanvas = document.createElement('canvas'), smallCanvas = document.createElement('canvas');
  const featherCanvas = document.createElement('canvas'); let featherKey = '';
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

  return function applySplit(k, fx, rider, titleBox) {
    const a = fx.split * k;
    if (!(a > 0.5)) return;
    const w = canvas.width, h = canvas.height;
    // Preserve the clean picture for a second, smaller split within the title's feathered area.
    if (titleBox) {
      if (preCanvas.width !== w || preCanvas.height !== h) {preCanvas.width = w; preCanvas.height = h;}
      preCanvas.getContext('2d').drawImage(canvas, 0, 0);
    }
    // Halfway between sideways and the blow, with red on the blow's side.
    const {x, y} = fx.direction, hx = x + (x < 0 ? -1 : 1), n = Math.hypot(hx, y) || 1;
    const ox = HALF * a * hx / n, oy = HALF * a * y / n;
    const m = Math.ceil(Math.hypot(ox, oy)) + 2;
    splitInto(ctx, canvas, ox, oy, m);
    // Retain half the clean rider, in the same place, through the split (R4 / R12).
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.5; ctx.drawImage(rider, 0, 0); ctx.restore();
    if (!titleBox) return;
    for (const c of [maskCanvas, smallCanvas]) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
    splitInto(smallCanvas.getContext('2d'), preCanvas, ox * TITLE_SPLIT, oy * TITLE_SPLIT, Math.max(1, Math.round(m * TITLE_PULSE)));
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
  };
}
