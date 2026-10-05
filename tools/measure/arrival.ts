/** Diagnostic pose at the event's first contact, using incoming whole-rider
 * velocity. The scorecard and blind selector consume the same observation. */
export function arrivalPose(frames: Array<{points: number[][]}>, contactStart: number) {
  const points = frames[contactStart].points, previous = frames[Math.max(0, contactStart - 1)].points;
  const ax = points[2][0] - points[1][0], ay = points[2][1] - points[1][1];
  let vx = 0, vy = 0;
  for (const [x, y, px, py] of previous) {vx += x - px; vy += y - py;}
  return {contactStart, headDown: Math.abs(Math.atan2(ay, ax)) > Math.PI / 2 || ax * vx + ay * vy < 0};
}
