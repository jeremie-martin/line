import type { TrackLine } from "../v0/types.ts";
import type { ArrivalFrame } from "./whole_track_controls.ts";

export const PLANNER_FEATURE_VERSION = 1;
const AXES = ["air", "speed", "amplitude", "impact"] as const;
const FAMILIES = ["incumbent", "transport", "turn", "scale", "material", "program", "target_program",
  "self_reuse", "native_sample", "rail_layers", "contact_pulse", "contact_pulse_pair", "contact_pulse_collective", "tail_energy"];

/** Available before candidate simulation; no source ID, seed, time index, or
 * measured candidate outcome is part of the model input. */
export function plannerContextFeatures(actual: ArrivalFrame, packet: any, gap: any, next: any): number[] {
  return [actual.speed / 10, actual.velocity.x / 10, actual.velocity.y / 10,
    (gap.endFrame - gap.startFrame) / 40, next ? (next.endFrame - next.startFrame) / 40 : 0,
    ...AXES.map(a => gap.targets[a] ?? -1), ...AXES.map(a => next?.targets[a] ?? -1),
    ...Object.keys(packet.points).sort().flatMap(key => {
      const p = packet.points[key];
      return [(p.x - actual.sledX) / 10, (p.y - actual.sledY) / 10, p.vx / 10, p.vy / 10];
    })];
}

export function plannerCandidateFeatures(lines: readonly TrackLine[], actual: ArrivalFrame, action: any): number[] {
  const scale = Math.max(1, actual.speed), n = Math.max(1, lines.length);
  const lengths = lines.map(l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)).sort((a, b) => a - b);
  const xs = lines.flatMap(l => [(l.x1 - actual.sledX) / scale, (l.x2 - actual.sledX) / scale]);
  const ys = lines.flatMap(l => [(l.y1 - actual.sledY) / scale, (l.y2 - actual.sledY) / scale]);
  let nearest = Infinity, normalX = 0, normalY = 0, alignment = 0, bends = 0, disconnected = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], dx = l.x2 - l.x1, dy = l.y2 - l.y1, length = Math.hypot(dx, dy);
    if (length > 0) {
      const t = Math.max(0, Math.min(1, ((actual.sledX - l.x1) * dx + (actual.sledY - l.y1) * dy) / length ** 2));
      const d = Math.hypot(l.x1 + t * dx - actual.sledX, l.y1 + t * dy - actual.sledY);
      if (d < nearest) {
        nearest = d; normalX = -dy / length * (l.flipped ? -1 : 1); normalY = dx / length * (l.flipped ? -1 : 1);
        alignment = (dx * actual.velocity.x + dy * actual.velocity.y) / length / scale;
      }
    }
    if (i > 0) {
      const p = lines[i - 1];
      if (p.x2 !== l.x1 || p.y2 !== l.y1) disconnected++;
      else bends += Math.abs(Math.atan2((p.x2 - p.x1) * dy - (p.y2 - p.y1) * dx,
        (p.x2 - p.x1) * dx + (p.y2 - p.y1) * dy));
    }
  }
  const control = action.family === "tail_energy" ? action.base : action;
  const first = lines[0], last = lines.at(-1);
  return [lines.length / 32, lengths.reduce((a, b) => a + b, 0) / scale,
    (lengths[0] ?? 0) / scale, (lengths[Math.floor(lengths.length / 2)] ?? 0) / scale, (lengths.at(-1) ?? 0) / scale,
    lines.filter(l => l.type === 1).length / n, lines.filter(l => l.flipped).length / n,
    lines.filter(l => l.leftExtended || l.rightExtended).length / n, disconnected / n, bends,
    Math.min(...xs, 0), Math.max(...xs, 0), Math.min(...ys, 0), Math.max(...ys, 0),
    Number.isFinite(nearest) ? nearest / scale : 0, normalX, normalY, alignment,
    first ? (first.x1 - actual.sledX) / scale : 0, first ? (first.y1 - actual.sledY) / scale : 0,
    last ? (last.x2 - actual.sledX) / scale : 0, last ? (last.y2 - actual.sledY) / scale : 0,
    ...FAMILIES.map(f => Number(action.family === f)), ...FAMILIES.map(f => Number(control.family === f)),
    control.turn ?? 0, control.logScale ?? 0, (control.length ?? 0) / scale,
    control.exitTurn ?? 0, control.exitAngle ?? 0, control.bend ?? 0, (control.bendLength ?? 0) / scale,
    control.energy ?? action.direction ?? 0, (control.phase ?? 0) / 6, control.normalTurn ?? 0,
    (control.depth ?? 0) / scale, control.ratio ?? 0, (control.maxWidth ?? 0) / scale,
    control.layers ?? 0, (control.spacing ?? 0) / scale, Number(control.mode === "similarity"),
    control.pointId === "TAIL" ? -1 : control.pointId === "NOSE" ? 1 : 0,
    control.secondPoint === "TAIL" ? -1 : control.secondPoint === "NOSE" ? 1 : 0,
  ];
}
