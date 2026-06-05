/**
 * Shared, deterministic benchmark/equivalence fixture.
 *
 * A fixed downhill track the rider rides for thousands of frames in continuous
 * contact, so every frame pays the realistic collision + constraint cost (not a
 * free-fall degenerate case). Used by both sim_bench (timing) and sim_trace
 * (byte-identical behavior fingerprint).
 */
import { LineRiderEngine, createLineFromJson } from "../../lib/_lr_engine.ts";

export const SOLID = 0;

export interface LineJson {
  id: number;
  type: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function buildTrack(segments: number): LineJson[] {
  const lines: LineJson[] = [];
  const segWidth = 80;
  const segDrop = 18; // ~12.7° slope
  let x = -20;
  let y = 40;
  for (let i = 0; i < segments; i++) {
    lines.push({ id: i, type: SOLID, x1: x, y1: y, x2: x + segWidth, y2: y + segDrop });
    x += segWidth;
    y += segDrop;
  }
  return lines;
}

export interface Vec {
  x: number;
  y: number;
}

// deno-lint-ignore no-explicit-any
export function buildEngine(track: LineJson[], start?: Vec, velocity?: Vec): any {
  let engine = new LineRiderEngine();
  if (start || velocity) {
    engine = engine.setStart(
      start ?? { x: 0, y: 0 },
      velocity ?? { x: 0.4, y: 0 },
    );
  }
  for (const l of track) engine = engine.addLine(createLineFromJson(l));
  return engine;
}

export interface LoadedTrack {
  name: string;
  lines: any[]; // raw line JSON (passed straight to createLineFromJson)
  start: Vec;
  velocity: Vec;
  duration: number | null;
}

/**
 * Load a real track JSON (the compiler's .track.json / export format) into the
 * fields the engine needs. Mirrors how the compiler feeds lines to lr-core:
 * raw line JSON straight through createLineFromJson, start from the rider.
 */
// deno-lint-ignore no-explicit-any
export function loadTrackJson(name: string, json: any): LoadedTrack {
  const rider = json.riders?.[0];
  const start: Vec = json.startPosition ?? rider?.startPosition ?? { x: 0, y: 0 };
  const velocity: Vec = rider?.startVelocity ?? { x: 0.4, y: 0 };
  return {
    name,
    lines: json.lines ?? [],
    start: { x: start.x ?? 0, y: start.y ?? 0 },
    velocity: { x: velocity.x ?? 0.4, y: velocity.y ?? 0 },
    duration: typeof json.duration === "number" ? json.duration : null,
  };
}
