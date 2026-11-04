import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { TrackLine } from '../types.ts';

export function createArcEngine(start: {
  position: {x: number; y: number}; velocity: {x: number; y: number};
}, lines: readonly TrackLine[] = []): Engine {
  const base = new Engine().setStart(start.position, start.velocity);
  return base.addLine(lines);
}
