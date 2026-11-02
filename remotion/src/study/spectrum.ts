/** Rounded frequency silhouette; this is a graphic interpolation, not a time-domain waveform. */
export function ribbonPaths(row: readonly number[], width: number, height: number): {crest: string; fill: string} {
  if (!row.length) return {crest: '', fill: ''};
  const points = row.map((value, i) => ({x: (i + .5) * width / row.length, y: height * (1 - Math.max(0, Math.min(1, value)))}));
  let crest = `M 0,${points[0].y} L ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    crest += ` Q ${a.x},${a.y} ${(a.x + b.x) / 2},${(a.y + b.y) / 2}`;
  }
  const last = points[points.length - 1];
  crest += ` Q ${last.x},${last.y} ${width},${last.y}`;
  return {crest, fill: `${crest} L ${width},${height} L 0,${height} Z`};
}

/** Linear reconstruction between actual spectrum rows; time in seconds. */
export function sampleSpectrumRow(frames: readonly (readonly number[])[], fps: number, t: number): number[] {
  if (!frames.length || !Number.isFinite(t) || t < 0 || !Number.isFinite(fps) || fps <= 0) return [];
  const position = Math.min(frames.length - 1, t * fps);
  const i = Math.floor(position), u = position - i;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  const clean = (v: number | undefined) => Number.isFinite(v) ? Math.max(0, Math.min(1, v!)) : 0;
  return a.map((v, k) => clean(v) * (1 - u) + clean(b[k]) * u);
}
