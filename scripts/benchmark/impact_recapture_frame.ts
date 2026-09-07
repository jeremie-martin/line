/** Rigid phase alignment in one physics frame of position/velocity units. */
import type { TrackLine } from "../v0/types.ts";
export type PhasePoint = { x: number; y: number; vx: number; vy: number };
export function matchRecaptureFrame(lines: readonly TrackLine[], original: readonly PhasePoint[], changed: readonly PhasePoint[]): any {
  if (original.length !== 4 || changed.length !== 4 ||
      ![...original, ...changed].flatMap(p => [p.x, p.y, p.vx, p.vy]).every(Number.isFinite)) return { available: false, reason: "invalid_phase" };
  const center = (points: readonly PhasePoint[]) => ({ x: points.reduce((s, p) => s + p.x, 0) / 4, y: points.reduce((s, p) => s + p.y, 0) / 4 });
  const oldCenter = center(original), newCenter = center(changed);
  if (original.every((p, i) => ["x", "y", "vx", "vy"].every(key => p[key as keyof PhasePoint] === changed[i][key as keyof PhasePoint]))) {
    return { available: true, identity: true, lines: lines.map(l => ({ ...l })), cosine: 1, sine: 0,
      oldCenter, newCenter, residual: 0 };
  }
  const pairs = original.flatMap((p, i) => [{
    x: p.x - oldCenter.x, y: p.y - oldCenter.y, u: changed[i].x - newCenter.x, v: changed[i].y - newCenter.y,
  }, { x: p.vx, y: p.vy, u: changed[i].vx, v: changed[i].vy }]);
  const dot = pairs.reduce((s, p) => s + p.x * p.u + p.y * p.v, 0);
  const cross = pairs.reduce((s, p) => s + p.x * p.v - p.y * p.u, 0), length = Math.hypot(dot, cross);
  if (!(length > 1e-12)) return { available: false, reason: "unidentifiable_rotation" };
  const cosine = dot / length, sine = cross / length;
  const point = (x: number, y: number) => ({
    x: newCenter.x + cosine * (x - oldCenter.x) - sine * (y - oldCenter.y),
    y: newCenter.y + sine * (x - oldCenter.x) + cosine * (y - oldCenter.y),
  });
  const transformed = lines.map(line => {
    const a = point(line.x1, line.y1), b = point(line.x2, line.y2);
    return { ...line, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  return { available: true, identity: false, lines: transformed, oldCenter, newCenter, cosine, sine,
    residual: Math.sqrt(pairs.reduce((s, p) => s + (cosine * p.x - sine * p.y - p.u) ** 2 +
      (sine * p.x + cosine * p.y - p.v) ** 2, 0)) };
}
