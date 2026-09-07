import type { TrackLine } from "../v0/types.ts";
import { setCatchEnergy } from "./whole_track_controls.ts";

/** Closely spaced native rails, ordered so the canonical descending-ID sweep
 * can encounter the outer rail before the next inward rail. Acceleration is
 * still the engine's native constant; these are ordinary authored segments.
 * Grid-cell ordering and articulated survival require exact evaluation.
 */
export function nativeRailLayers(
  lines: readonly TrackLine[], velocity: { x: number; y: number },
  layers: number, spacing: number, direction: -1 | 1,
): TrackLine[] {
  if (!Number.isSafeInteger(layers) || layers < 1 || !(spacing > 0) || !Number.isFinite(spacing)) throw new Error("invalid rail layers");
  const active = setCatchEnergy(lines, velocity, direction);
  if (layers === 1) return active;
  const result: TrackLine[] = [];
  for (let layer = layers - 1; layer >= 0; layer--) for (const line of active) {
    if (line.type === 2) { if (layer === 0) result.push({ ...line }); continue; }
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1, length = Math.hypot(dx, dy);
    if (!(length > 0)) throw new Error("degenerate native rail");
    const sign = line.flipped ? -1 : 1;
    const nx = -dy / length * sign, ny = dx / length * sign;
    const offset = -spacing * layer;
    result.push({ ...line, x1: line.x1 + nx * offset, y1: line.y1 + ny * offset,
      x2: line.x2 + nx * offset, y2: line.y2 + ny * offset });
  }
  return result.map((line, i) => ({ ...line, id: lines[0].id + i }));
}
