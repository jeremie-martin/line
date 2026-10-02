/** Diagnostic kinematics, deliberately independent of the benchmark and search.
 * These are velocity corrections (world units/frame), not calibrated perceptual
 * impact or forces. Incoming velocity already includes the current gravity step.
 */
export const ACCENT_BODY_POINTS = ['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'] as const;
type Point = {x: number; y: number; prevX: number; prevY: number; vx: number; vy: number};
export function riderCorrection(points: Record<string, Point>) {
  const rows = ACCENT_BODY_POINTS.map(id => {
    const p = points[id];
    if (!p || ![p.x, p.y, p.prevX, p.prevY, p.vx, p.vy].every(Number.isFinite)) throw new Error('incomplete rider state');
    return {incoming: [p.vx, p.vy], effective: [p.x - p.prevX, p.y - p.prevY],
      delta: [p.x - p.prevX - p.vx, p.y - p.prevY - p.vy]};
  });
  const mean = (key: 'incoming' | 'effective' | 'delta') => [0, 1].map(i => rows.reduce((s, r) => s + r[key][i], 0) / rows.length);
  const incoming = mean('incoming'), effective = mean('effective'), delta = mean('delta');
  const speedBefore = Math.hypot(...incoming), speedAfter = Math.hypot(...effective);
  const angle = speedBefore < 1e-9 || speedAfter < 1e-9 ? 0 :
    Math.atan2(incoming[0] * effective[1] - incoming[1] * effective[0], incoming[0] * effective[0] + incoming[1] * effective[1]);
  return {meanImpulse: Math.hypot(...delta), pointRmsImpulse: Math.sqrt(rows.reduce((s, r) => s + r.delta[0] ** 2 + r.delta[1] ** 2, 0) / rows.length),
    relativeRmsImpulse: Math.sqrt(rows.reduce((s, r) => s + (r.delta[0] - delta[0]) ** 2 + (r.delta[1] - delta[1]) ** 2, 0) / rows.length),
    speedBefore, speedAfter, speedGain: speedAfter - speedBefore, headingDegrees: angle * 180 / Math.PI,
    directionCorrection: .5 * (speedBefore + speedAfter) * Math.abs(angle), incoming, effective};
}

/** Last point of a flat-topped maximum; no magnitude threshold or musical gate. */
export function localPeaks(values: readonly number[]) {
  if (values.some(x => !Number.isFinite(x) || x < 0)) throw new Error('invalid accent series');
  return values.flatMap((value, frame) => {
    if (!frame || frame === values.length - 1 || value <= 0 || value < values[frame - 1] || value <= values[frame + 1]) return [];
    let first = frame, last = frame;
    while (first > 0 && values[first - 1] >= value / 2) first--;
    while (last < values.length - 1 && values[last + 1] >= value / 2) last++;
    const context = values.slice(Math.max(0, frame - 2), Math.min(values.length, frame + 3));
    return [{frame, value, halfHeightFirst: first, halfHeightLast: last,
      peakToFiveFrameMean: value / (context.reduce((s, x) => s + x, 0) / context.length)}];
  });
}
