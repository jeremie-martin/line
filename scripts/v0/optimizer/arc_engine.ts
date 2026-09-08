import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { TrackLine } from '../types.ts';

/** An empty addLine batch aliases the native handle without acquiring ownership.
 * Keep the original wrapper when the prefix is empty, so its finalizer cannot
 * invalidate another wrapper that appears to own the same handle. */
export function createArcEngine(start: {
  position: {x: number; y: number}; velocity: {x: number; y: number};
}, lines: TrackLine[] = []): Engine {
  const base = new Engine().setStart(start.position, start.velocity);
  return lines.length ? base.addLine(lines) : base;
}
