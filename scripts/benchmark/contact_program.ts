import type { TrackLine } from "../v0/types.ts";
import { setCatchEnergy, type ArrivalFrame } from "./whole_track_controls.ts";

export type ReleaseProgram = {
  length: number;
  exitTurn: number;
  bend: number;
  energy: -1 | 0 | 1;
};

/** Seed the approach from an existing catch, then synthesize its release.
 * Angles are in radians and length is in pixels. No rider states are changed.
 * A short smooth bend followed by an independent exit angle provides separate
 * impact-window and release controls. Every proposal still needs exact physics.
 */
export function releaseProgram(
  lines: readonly TrackLine[], arrival: ArrivalFrame, program: ReleaseProgram,
): TrackLine[] | null {
  if (lines.length < 3 || !lines.every((l, i) => l.type === 0 &&
      (i === 0 || (l.x1 === lines[i - 1].x2 && l.y1 === lines[i - 1].y2)))) return null;
  if (!(program.length > 0) || ![program.length, program.exitTurn, program.bend, arrival.speed].every(Number.isFinite)) return null;
  let index = 1, nearest = Infinity;
  for (let i = 1; i < lines.length; i++) {
    const d = Math.hypot(lines[i].x1 - arrival.sledX, lines[i].y1 - arrival.sledY);
    if (d < nearest) { nearest = d; index = i; }
  }
  const approach = lines.slice(0, index).map(l => ({ ...l }));
  const last = approach.at(-1)!;
  const initialAngle = Math.atan2(last.y2 - last.y1, last.x2 - last.x1);
  const stepCount = Math.max(4, Math.min(128, Math.ceil(program.length / Math.max(2, arrival.speed * 0.65))));
  const ds = program.length / stepCount;
  const bendLength = Math.min(program.length, Math.max(10, arrival.speed * 6));
  let x = last.x2, y = last.y2;
  const tail: TrackLine[] = [];
  for (let i = 0; i < stepCount; i++) {
    const distance = (i + 0.5) * ds;
    const u = distance / program.length;
    const b = Math.min(1, distance / bendLength);
    const angle = initialAngle + program.exitTurn * (u * u * (3 - 2 * u)) + program.bend * Math.sin(2 * Math.PI * b);
    const nx = x + ds * Math.cos(angle), ny = y + ds * Math.sin(angle);
    tail.push({ ...last, id: last.id + i + 1, x1: x, y1: y, x2: nx, y2: ny,
      leftExtended: false, rightExtended: i + 1 < stepCount });
    x = nx; y = ny;
  }
  return [...approach, ...setCatchEnergy(tail, arrival.velocity, program.energy)];
}
