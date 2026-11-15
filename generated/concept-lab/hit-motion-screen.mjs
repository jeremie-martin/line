// Geometry diagnostics, not an aesthetic score. Design pixels before the colour split.
// The radius is rotation-invariant RMS distance of the ten physical body points.
import {BODY_POINTS} from '../../scripts/video/picture.js';
export function riderOnScreen(frame, effect, pose) {
  const z = frame.z * (effect.scale ?? 1), angle = (effect.rotation ?? 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), ax = frame.ax + effect.dx, ay = frame.ay + effect.dy;
  const points = pose.points.filter(p => BODY_POINTS.includes(p.name)).map(p => {
    const x = (p.pos.x - frame.x) * z, y = (p.pos.y - frame.y) * z;
    return {x: ax + c * x - s * y, y: ay + s * x + c * y};
  });
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length, y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const radius = Math.sqrt(points.reduce((sum, p) => sum + (p.x-x)**2 + (p.y-y)**2, 0) / points.length);
  return {x, y, radius};
}
export function screenMetrics(samples) {
  let travel = 0, maxSpeed = 0, maxShift = 0, maxSize = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    maxShift = Math.max(maxShift, Math.hypot(a.dx, a.dy));
    maxSize = Math.max(maxSize, a.size);
    if (i) {
      const b = samples[i - 1], distance = Math.hypot(a.x - b.x, a.y - b.y);
      travel += distance; maxSpeed = Math.max(maxSpeed, distance / (a.t - b.t));
    }
  }
  return {travel, maxSpeed, maxShift, maxSize};
}
export const NO_MOTION = Object.freeze({dx: 0, dy: 0, scale: 1, rotation: 0});
export function unpunchedCamera(mode) {
  if (mode === 'old-authored') return 'old-zoom';
  if (mode === 'measured-current') return 'current';
  return ['old-punch','old-punch-locked','measured-punch','measured-locked'].includes(mode) ? 'old-six' : mode;
}
