/** Invert the ideal uniform native-energy impulse, then let the exact engine
 * evaluate the articulated rider, contact timing, and actual turning impulse.
 */
export function nativeEnergySteering(
  velocity: { x: number; y: number }, desiredSpeed: number, turn: number,
): { normalTurn: number; layers: number; energy: -1 | 1; desiredDelta: { x: number; y: number } } | null {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!(speed > 1e-6 && desiredSpeed > 0) || !Number.isFinite(turn)) return null;
  const angle = Math.atan2(velocity.y, velocity.x);
  const dx = desiredSpeed * Math.cos(angle + turn) - velocity.x;
  const dy = desiredSpeed * Math.sin(angle + turn) - velocity.y;
  const magnitude = Math.hypot(dx, dy);
  if (!(magnitude > 0.05)) return null;
  // The active tangent supplies the requested delta. Pick the perpendicular
  // collision normal which faces the measured flow; no state is imposed.
  let nx = -dy / magnitude, ny = dx / magnitude;
  if (nx * velocity.x + ny * velocity.y < 0) { nx = -nx; ny = -ny; }
  if (nx * velocity.x + ny * velocity.y < 1e-6) return null;
  const normalTurn = Math.atan2(Math.sin(Math.atan2(ny, nx) - angle), Math.cos(Math.atan2(ny, nx) - angle));
  const energy: -1 | 1 = dx * velocity.x + dy * velocity.y >= 0 ? 1 : -1;
  return { normalTurn, layers: Math.max(1, Math.round(magnitude / 0.1)), energy, desiredDelta: { x: dx, y: dy } };
}
