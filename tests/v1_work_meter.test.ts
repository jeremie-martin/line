import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createBaseEngine,
  engineLineFromTrackLine,
  engineLastFrameIndex,
  measuredGetRider,
  rebuildEngineFromLines,
} from "../scripts/v1/engine_adapter.ts";
import { CompileStatsBuilder } from "../scripts/v1/stats.ts";
import type { ResolvedStart, TrackLine } from "../scripts/v1/types.ts";
import { BudgetExhaustedError, WorkMeter } from "../scripts/v1/work_meter.ts";

const START: ResolvedStart = {
  position: { x: 0, y: 0 },
  velocity: { x: 0.4, y: 0 },
};

const LINE: TrackLine = {
  id: 1,
  type: 0,
  x1: -10,
  y1: 20,
  x2: 10,
  y2: 20,
  flipped: false,
  leftExtended: false,
  rightExtended: false,
};

describe("v1 work meter", () => {
  test("adding one engine line spends one unit", () => {
    const stats = new CompileStatsBuilder(1);
    const meter = new WorkMeter({ kind: "work", units: 1 }, stats);
    const engine = createBaseEngine(START, meter);

    engine.addLine(engineLineFromTrackLine(LINE));

    expect(meter.unitsUsed).toBe(1);
    expect(stats.snapshot().work_units_used).toBe(1);
    expect(stats.snapshot().engine_addLine_calls).toBe(1);
  });

  test("budget exhaustion stops at the exact addLine boundary", () => {
    const stats = new CompileStatsBuilder(1);
    const meter = new WorkMeter({ kind: "work", units: 1 }, stats);
    let engine = createBaseEngine(START, meter);

    engine = engine.addLine(engineLineFromTrackLine(LINE));

    expect(() => engine.addLine(engineLineFromTrackLine({ ...LINE, id: 2 })))
      .toThrow(BudgetExhaustedError);
    expect(meter.unitsUsed).toBe(1);
    expect(stats.snapshot().budget_exhausted).toBe(true);
  });

  test("rebuilding N lines spends N units", () => {
    const stats = new CompileStatsBuilder(2);
    const meter = new WorkMeter({ kind: "work", units: 2 }, stats);

    rebuildEngineFromLines([LINE, { ...LINE, id: 2, y1: 30, y2: 30 }], START, meter, stats);

    const snapshot = stats.snapshot();
    expect(snapshot.engine_rebuilds).toBe(1);
    expect(snapshot.work_units_used).toBe(2);
    expect(snapshot.engine_addLine_calls).toBe(2);
  });

  test("physics frame diagnostics count lr-core computation delta, not cached reads", () => {
    const stats = new CompileStatsBuilder(0);
    const meter = new WorkMeter({ kind: "work", units: 0 }, stats);
    const engine = createBaseEngine(START, meter).raw();

    const before = engineLastFrameIndex(engine);
    measuredGetRider(engine, 10, stats);
    const afterFirstRead = engineLastFrameIndex(engine);
    measuredGetRider(engine, 10, stats);

    expect(before).not.toBeNull();
    expect(afterFirstRead).not.toBeNull();
    const firstComputed = (afterFirstRead ?? 0) - (before ?? 0);
    const snapshot = stats.snapshot();
    expect(firstComputed).toBeGreaterThan(0);
    expect(snapshot.physics_frame_requests).toBe(2);
    expect(snapshot.physics_frames_computed).toBe(firstComputed);
    expect(snapshot.physics_frame_cache_hits).toBe(1);
    expect(snapshot.work_units_used).toBe(0);
  });

  test("v1 has no unmetered engine.addLine calls outside the adapter", () => {
    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "scripts/v1"))) {
      if (!file.endsWith(".ts") || file.endsWith("engine_adapter.ts")) continue;
      const contents = readFileSync(file, "utf8");
      if (/\.addLine\s*\(/.test(contents)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
