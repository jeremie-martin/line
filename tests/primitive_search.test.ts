/**
 * Primitive-type search candidate registry tests.
 *
 * Validates the candidate registry + feasibility filters in
 * scripts/lib/primitive_search.ts. The actual integration with the search
 * loop is exercised end-to-end via the bench v2 `compose_primitive_search`
 * strategy.
 */
import { describe, test, expect } from "vitest";
import {
  CANDIDATES_BY_INTENT,
  candidatesForIntent,
  landingCandidates,
} from "../scripts/lib/primitive_search.ts";
import type { IncomingState } from "../scripts/lib/adapt.ts";

const rider = (over: Partial<IncomingState>): IncomingState => ({
  pos: { x: 0, y: 0 },
  velocity: { x: 4, y: 1 },
  speed: 4.12,
  angleDeg: 14,
  ...over,
});

describe("candidate registry", () => {
  test("registry has all five intents populated", () => {
    expect(Object.keys(CANDIDATES_BY_INTENT).sort()).toEqual(
      ["airtime", "bounce", "kick", "landing", "shape"],
    );
    for (const intent of Object.keys(CANDIDATES_BY_INTENT) as Array<keyof typeof CANDIDATES_BY_INTENT>) {
      expect(CANDIDATES_BY_INTENT[intent].length).toBeGreaterThan(0);
    }
  });

  test("each candidate factory produces a Move with the right type and atFrame", () => {
    const fastRider = rider({ speed: 8, velocity: { x: 8, y: 0 } });
    for (const intent of Object.keys(CANDIDATES_BY_INTENT) as Array<keyof typeof CANDIDATES_BY_INTENT>) {
      for (const c of CANDIDATES_BY_INTENT[intent]) {
        if (!c.feasible(fastRider)) continue;
        const m = c.factory(99);
        expect(m.type).toBe(c.type);
        expect(m.atFrame).toBe(99);
      }
    }
  });
});

describe("feasibility filters", () => {
  test("loop excluded when speed < 3", () => {
    const slow = rider({ speed: 2, velocity: { x: 2, y: 0 } });
    const kicks = candidatesForIntent("kick", slow).map((c) => c.type);
    expect(kicks).not.toContain("loop");
    expect(kicks).toContain("kicker"); // kicker is always feasible
  });

  test("loop included when speed ≥ 3", () => {
    const fast = rider({ speed: 4, velocity: { x: 4, y: 0 } });
    const kicks = candidatesForIntent("kick", fast).map((c) => c.type);
    expect(kicks).toContain("loop");
  });

  test("ramp + jump excluded when vx < 1.5", () => {
    const stalled = rider({ speed: 1, velocity: { x: 1, y: 0 } });
    const landings = landingCandidates(stalled).map((c) => c.type);
    expect(landings).not.toContain("jump");
    const kicks = candidatesForIntent("kick", stalled).map((c) => c.type);
    expect(kicks).not.toContain("ramp");
  });

  test("bounceStrip excluded when speed < 2", () => {
    const slow = rider({ speed: 1, velocity: { x: 1, y: 0 } });
    const bounces = candidatesForIntent("bounce", slow).map((c) => c.type);
    expect(bounces).not.toContain("bounceStrip");
    expect(bounces).toContain("catch"); // always feasible
  });

  test("landing intent for a stalled rider still offers catch/landAt/landUp", () => {
    const stalled = rider({ speed: 0.4, velocity: { x: 0.4, y: 0 } });
    const landings = landingCandidates(stalled).map((c) => c.type);
    expect(landings).toContain("catch");
    expect(landings).toContain("landAt");
    expect(landings).toContain("landUp");
    // High-speed primitives gated out
    expect(landings).not.toContain("slide");
    expect(landings).not.toContain("drop");
    expect(landings).not.toContain("glide");
    expect(landings).not.toContain("jump");
  });
});

describe("registry semantics", () => {
  test("landing intent does NOT include brake or gap (those are state-shapers / verification-only)", () => {
    const r = rider({ speed: 5 });
    const landings = landingCandidates(r).map((c) => c.type);
    expect(landings).not.toContain("brake");
    expect(landings).not.toContain("gap");
  });

  test("shape intent does NOT include landing primitives (no double-counting)", () => {
    const r = rider({ speed: 5 });
    const shapes = candidatesForIntent("shape", r).map((c) => c.type);
    expect(shapes).not.toContain("slide");
    expect(shapes).not.toContain("drop");
    expect(shapes).not.toContain("landAt");
  });

  test("halfPipe is in `shape`, not `landing` (it's a long state-shaper, not a beat-landing primitive)", () => {
    const r = rider({ speed: 5 });
    const landings = landingCandidates(r).map((c) => c.type);
    const shapes = candidatesForIntent("shape", r).map((c) => c.type);
    expect(landings).not.toContain("halfPipe");
    expect(shapes).toContain("halfPipe");
  });
});
