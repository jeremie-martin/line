/**
 * Initial conditions for the v0 compiler.
 *
 * Two seams:
 *
 *   start    — manual rider initial state override.
 *   preroll  — synthesize a warmup window before spec t=0 so the rider hits
 *              §0 in its steady state. Removed from the user-facing report.
 */
import { describe, test, expect } from "vitest";
import { compile } from "../scripts/v0/compile.ts";
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

const TRIVIAL: Spec = { duration: 1, contacts: [], sections: [] };

describe("v0 spec.start (manual knob)", () => {
  test("omitted ⇒ legacy default in TrackJson", () => {
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
      sections: [{ t0: 0, t1: 3, air: 0.5 }],
    };
    const { report } = compile(spec, 0);
    expect(report.contacts).toHaveLength(2);
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].section_index).toBe(0);
  });

  test("preroll extends TrackJson but report is in user coords", () => {
    const userSpec: Spec = {
      duration: 3,
      contacts: [{ t: 1 }, { t: 2 }],
      sections: [{ t0: 0, t1: 3, air: 0.5 }],
      preroll: 2,
    };
    const { track, report } = compile(userSpec, 0);

    // TrackJson covers user duration + preroll (in frames, plus the +20 tail).
    expect(track.duration).toBeGreaterThanOrEqual(Math.round((3 + 2) * 40));

    // User sees only their two contacts at their original timestamps.
    expect(report.contacts).toHaveLength(2);
    expect(report.contacts[0].t_target).toBeCloseTo(1, 6);
    expect(report.contacts[1].t_target).toBeCloseTo(2, 6);

    // User sees only their one section, re-indexed to 0.
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].section_index).toBe(0);
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
