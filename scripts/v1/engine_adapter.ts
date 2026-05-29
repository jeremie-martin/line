import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import type { TrackLine } from "../lib/primitive.ts";
import { roundToGrid } from "./deterministic_math.ts";
import type { ResolvedStart } from "./types.ts";
import { CompileStatsBuilder } from "./stats.ts";
import { WorkMeter } from "./work_meter.ts";

export type EngineLine = unknown;

export class WorkMeteredEngine {
  readonly inner: any;
  private readonly meter: WorkMeter;

  constructor(
    inner: any,
    meter: WorkMeter,
  ) {
    this.inner = inner;
    this.meter = meter;
  }

  addLine(line: EngineLine): WorkMeteredEngine {
    this.meter.spendOne("engine_addLine");
    return new WorkMeteredEngine(this.inner.addLine(line), this.meter);
  }

  raw(): any {
    return this.inner;
  }
}

export function createBaseEngine(start: ResolvedStart, meter: WorkMeter): WorkMeteredEngine {
  const inner = new LineRiderEngine().setStart(start.position, start.velocity);
  return new WorkMeteredEngine(inner, meter);
}

export function engineLineFromTrackLine(line: TrackLine): EngineLine {
  return createLineFromJson({
    ...line,
    x1: roundToGrid(line.x1),
    y1: roundToGrid(line.y1),
    x2: roundToGrid(line.x2),
    y2: roundToGrid(line.y2),
  });
}

export function addEngineLines(
  baseEngine: WorkMeteredEngine,
  lines: readonly EngineLine[],
): WorkMeteredEngine {
  let engine = baseEngine;
  for (const line of lines) {
    engine = engine.addLine(line);
  }
  return engine;
}

export function addTrackLines(
  baseEngine: WorkMeteredEngine,
  lines: readonly TrackLine[],
): WorkMeteredEngine {
  return addEngineLines(baseEngine, lines.map(engineLineFromTrackLine));
}

export function engineLastFrameIndex(engine: any): number | null {
  const getLastFrameIndex = engine?.getLastFrameIndex;
  if (typeof getLastFrameIndex !== "function") return null;
  const value = getLastFrameIndex.call(engine);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function measureEngineComputation<T>(
  engine: any,
  stats: CompileStatsBuilder | undefined,
  read: () => T,
): T {
  const before = stats === undefined ? null : engineLastFrameIndex(engine);
  const result = read();
  if (stats !== undefined && before !== null) {
    const after = engineLastFrameIndex(engine);
    if (after !== null) stats.recordPhysicsFrameRequest(after - before);
  }
  return result;
}

export function measuredGetRider(
  engine: any,
  frame: number,
  stats?: CompileStatsBuilder,
): any {
  return measureEngineComputation(engine, stats, () => engine.getRider(frame));
}

export function rebuildEngineFromLines(
  lines: readonly TrackLine[],
  start: ResolvedStart,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): WorkMeteredEngine {
  stats.recordEngineRebuild();
  let engine = createBaseEngine(start, meter);
  return addTrackLines(engine, lines);
}
