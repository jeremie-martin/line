import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  POSTIMPACT_ENGINE_TRACE_SEMANTICS,
  emptyPostimpactEngineStateTraceFingerprint,
  exactPostimpactEngineStateTraceFingerprint,
  postimpactEngineCollisionWitnessesForLineIds,
  samePostimpactEngineTrace,
  survivesPostimpactThroughFrame,
} from "../scripts/v0/trajectory/postimpact_trace.ts";
import { exactEngineStateTraceFingerprint } from "../scripts/v0/trajectory/study_trace.ts";

describe("post-impact trace leaf closure", () => {
  test("imports only local platform hashing and no study/compiler context", () => {
    const source = readFileSync(new URL("../scripts/v0/trajectory/postimpact_trace.ts", import.meta.url), "utf8");
    const importSpecifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
    expect(importSpecifiers).toEqual(["node:crypto"]);
    expect(source).not.toMatch(/from\s+["'][^"']*(?:frozen_fixture|core\/candidate|optimizer|panel|benchmark|study_context)[^"']*["']/);
  });
});

describe("post-impact full-engine trace identity", () => {
  test("preserves the legacy full-engine fingerprint byte encoding", () => {
    const engine = fakeEngine({ bodyY: 7, collisionPointIds: ["BUTT", "TAIL"], reverseStateInsertion: true });
    expect(exactPostimpactEngineStateTraceFingerprint(engine, 0, 2))
      .toEqual(exactEngineStateTraceFingerprint(engine, 0, 2));
  });

  test("is exact, canonical across state-map insertion order, and excludes scarf", () => {
    const baseline = fakeEngine({ bodyY: 7, collisionPointIds: ["BUTT"], reverseStateInsertion: false });
    const sameStateDifferentMapOrder = fakeEngine({ bodyY: 7, collisionPointIds: ["BUTT"], reverseStateInsertion: true });
    const bodyPerturbed = fakeEngine({ bodyY: 7.25, collisionPointIds: ["BUTT"], reverseStateInsertion: false });
    const scarfPerturbed = fakeEngine({ bodyY: 7, collisionPointIds: ["BUTT"], reverseStateInsertion: false, scarfY: 999 });
    const collisionPerturbed = fakeEngine({ bodyY: 7, collisionPointIds: ["TAIL"], reverseStateInsertion: false });

    const baselineTrace = exactPostimpactEngineStateTraceFingerprint(baseline, 0, 1);
    expect(baselineTrace).toMatchObject({
      frameCount: 2,
      unavailableAtFrame: null,
      semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
    });
    expect(baselineTrace.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(samePostimpactEngineTrace(baselineTrace, exactPostimpactEngineStateTraceFingerprint(sameStateDifferentMapOrder, 0, 1))).toBe(true);
    expect(samePostimpactEngineTrace(baselineTrace, exactPostimpactEngineStateTraceFingerprint(bodyPerturbed, 0, 1))).toBe(false);
    expect(samePostimpactEngineTrace(baselineTrace, exactPostimpactEngineStateTraceFingerprint(scarfPerturbed, 0, 1))).toBe(true);
    expect(samePostimpactEngineTrace(baselineTrace, exactPostimpactEngineStateTraceFingerprint(collisionPerturbed, 0, 1))).toBe(false);
  });

  test("fails closed for an unavailable or unsupported engine frame", () => {
    expect(exactPostimpactEngineStateTraceFingerprint({}, 4, 6)).toEqual({
      fingerprint: null,
      frameCount: 0,
      unavailableAtFrame: 4,
      semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
    });
    const partial = {
      ...fakeEngine({ bodyY: 7, collisionPointIds: [], reverseStateInsertion: false }),
      getStateMapAtFrame(frame: number) {
        if (frame === 2) throw new Error("state not retained");
        return new Map([["BUTT", point(3, 7)]]);
      },
    };
    expect(exactPostimpactEngineStateTraceFingerprint(partial, 1, 3)).toEqual({
      fingerprint: null,
      frameCount: 1,
      unavailableAtFrame: 2,
      semantics: POSTIMPACT_ENGINE_TRACE_SEMANTICS,
    });
    expect(samePostimpactEngineTrace(emptyPostimpactEngineStateTraceFingerprint(), exactPostimpactEngineStateTraceFingerprint({}, 0, 0))).toBe(false);
  });

  test("uses a valid empty identity only for an empty interval", () => {
    expect(exactPostimpactEngineStateTraceFingerprint({}, 8, 7)).toEqual(emptyPostimpactEngineStateTraceFingerprint());
    expect(() => exactPostimpactEngineStateTraceFingerprint({}, -1, 0)).toThrow("startFrame must be a non-negative safe integer");
  });
});

describe("post-impact collision and survival evidence", () => {
  test("retains body-point collision witnesses only for owned lines", () => {
    const engine = fakeEngine({ bodyY: 7, collisionPointIds: ["BUTT", "TAIL"], reverseStateInsertion: false });
    expect(postimpactEngineCollisionWitnessesForLineIds(engine, 5, new Set([99]))).toEqual([
      { frame: 5, lineId: 99, pointIds: ["BUTT", "TAIL"] },
    ]);
    expect(postimpactEngineCollisionWitnessesForLineIds(engine, 5, new Set([101]))).toEqual([]);
    expect(() => postimpactEngineCollisionWitnessesForLineIds({}, 5, new Set([99]))).toThrow("getUpdatesAtFrame");
  });

  test("recognizes the engine's class-shaped collision updates", () => {
    class CollisionUpdate {
      constructor(readonly id: number, readonly updated: unknown[]) {}
    }
    const engine = {
      getUpdatesAtFrame() {
        return [new CollisionUpdate(88, [{ id: "BUTT" }])];
      },
    };
    expect(postimpactEngineCollisionWitnessesForLineIds(engine, 5, new Set([88]))).toEqual([
      { frame: 5, lineId: 88, pointIds: ["BUTT"] },
    ]);
  });

  test("implements the strict detector terminal boundary", () => {
    expect(survivesPostimpactThroughFrame({ terminus: { reason: "rideStalled", frame: 42 } }, 42)).toBe(false);
    expect(survivesPostimpactThroughFrame({ terminus: { reason: "rideStalled", frame: 43 } }, 42)).toBe(true);
    expect(survivesPostimpactThroughFrame({ terminus: { reason: "endOfSpec", frame: 42 } }, 42)).toBe(true);
    expect(survivesPostimpactThroughFrame({ terminus: { reason: "endOfSpec", frame: 41 } }, 42)).toBe(false);
  });
});

function fakeEngine({
  bodyY,
  collisionPointIds,
  reverseStateInsertion,
  scarfY = 4,
}: {
  bodyY: number;
  collisionPointIds: string[];
  reverseStateInsertion: boolean;
  scarfY?: number;
}) {
  return {
    getStateMapAtFrame() {
      const entries: Array<[string, unknown]> = [
        ["RIDER_MOUNTED", { __state__: { framesSinceUnbind: -1 } }],
        ["SLED_INTACT", { __state__: { framesSinceUnbind: -1 } }],
        ["TAIL", point(1, 2)],
        ["BUTT", point(3, bodyY)],
        ["SCARF_VISUAL", point(9, scarfY)],
      ];
      return new Map(reverseStateInsertion ? entries.reverse() : entries);
    },
    getUpdatesAtFrame() {
      return [
        { type: "CollisionUpdate", id: 99, updated: collisionPointIds.map((id) => ({ id })) },
        { type: "CollisionUpdate", id: 100, updated: [{ id: "RIDER_MOUNTED" }] },
      ];
    },
  };
}

function point(x: number, y: number) {
  return { __state__: { pos: { x, y }, prevPos: { x: x - 1, y: y - 1 }, vel: { x: 1, y: 1 } } };
}
