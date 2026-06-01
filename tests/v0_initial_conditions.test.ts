/**
 * Initial conditions for the v0 handoff compiler.
 *
 * Two seams:
 *
 *   start    — manual rider initial state override.
 *   preroll  — compiler-chosen initial velocity for the real spec timeline.
 */
import { describe, test, expect } from "vitest";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import { type Spec } from "../scripts/v0/types.ts";
import { LineRiderEngine, createLineFromJson } from "../scripts/lib/_lr_engine.ts";

function replayEngine(track: { lines: unknown[]; riders: { startPosition: { x: number; y: number }; startVelocity: { x: number; y: number } }[] }) {
  // deno-lint-ignore no-explicit-any
  let chained: any = new LineRiderEngine().setStart(
    track.riders[0].startPosition,
    track.riders[0].startVelocity,
  );
  for (const line of track.lines) {
    chained = chained.addLine(createLineFromJson(line));
  }
  return chained;
}

const TRIVIAL: Spec = { duration: 1, contacts: [], axes: {} };
const TEST_BUDGET = 40_000;

function compile(spec: Spec, seed = 0) {
  const result = compileHandoff(spec, seed, {
    budgets: [TEST_BUDGET],
    maxNodes: 100,
    polish: false,
  });
  return result.checkpoints[0];
}

describe("v0 spec.start (manual knob)", () => {
  test("omitted => default in TrackJson", () => {
    const { track } = compile(TRIVIAL, 0);
    expect(track.riders[0].startPosition).toEqual({ x: 0, y: 0 });
    expect(track.riders[0].startVelocity).toEqual({ x: 0.4, y: 0 });
  });

  test("explicit start honored in TrackJson and replayed engine", () => {
    const spec: Spec = { ...TRIVIAL, start: { vx: 5, vy: -2, x: 3, y: -1 } };
    const { track } = compile(spec, 0);

    expect(track.riders[0].startPosition).toEqual({ x: 3, y: -1 });
    expect(track.riders[0].startVelocity).toEqual({ x: 5, y: -2 });

    // Render-time parity: replaying with setStart must place the rider at
    // the same frame-0 state the compiler saw.
    const r = replayEngine(track).getRider(0);
    expect(r.velocity.x).toBeCloseTo(5, 6);
    expect(r.velocity.y).toBeCloseTo(-2, 6);
  });

  test("invalid vx is rejected", () => {
    const spec: Spec = { ...TRIVIAL, start: { vx: 9999, vy: 0 } };
    expect(() => compile(spec, 0)).toThrow(/sanity cap/);
  });

  test("non-finite vx is rejected", () => {
    const spec: Spec = { ...TRIVIAL, start: { vx: NaN, vy: 0 } };
    expect(() => compile(spec, 0)).toThrow(/finite/);
  });
});

describe("v0 spec.preroll", () => {
  test("omitted ⇒ report is unchanged baseline shape", () => {
    const spec: Spec = {
      duration: 3,
      contacts: [{ t: 1 }, { t: 2 }],
      axes: { air: constant(0.5) },
    };
    const { report } = compile(spec, 0);
    expect(report.contacts).toHaveLength(2);
    // Per-gap report: one entry per contact gap that received a catch.
    expect(report.gaps.length).toBeGreaterThanOrEqual(1);
    expect(report.gaps[0].gap_index).toBe(0);
  });

  test("preroll preserves user timeline and report coords", () => {
    const userSpec: Spec = {
      duration: 3,
      contacts: [{ t: 1 }, { t: 2 }],
      axes: { air: constant(0.5) },
      preroll: 2,
    };
    const { track, report } = compile(userSpec, 0);

    // TrackJson covers the real user duration (in frames, plus the +20 tail).
    expect(track.duration).toBe(Math.round(3 * 40) + 20);

    // User sees only their two contacts at their original timestamps.
    expect(report.contacts).toHaveLength(2);
    expect(report.contacts[0].t_target).toBeCloseTo(1, 6);
    expect(report.contacts[1].t_target).toBeCloseTo(2, 6);

    // User sees per-gap axes for their own timeline, gap indices from 0.
    expect(report.gaps.length).toBeGreaterThanOrEqual(1);
    expect(report.gaps[0].gap_index).toBe(0);
  });

  test("preroll > MAX_S is rejected", () => {
    const spec: Spec = { ...TRIVIAL, preroll: 100 };
    expect(() => compile(spec, 0)).toThrow(/sanity cap/);
  });

  test("preroll < 0 is rejected", () => {
    const spec: Spec = { ...TRIVIAL, preroll: -1 };
    expect(() => compile(spec, 0)).toThrow(/must be ≥0/);
  });
});
