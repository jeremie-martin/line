import { describe, expect, test } from "vitest";
import {
  compareKinematicTraceSamples,
  engineCollisionHitsForLineIds,
  exactEngineStateTraceFingerprint,
  float64UlpDistance,
  fingerprintExactKinematicTraceSamples,
  fingerprintExactTraceSamples,
  survivesThroughFrame,
} from "../scripts/v0/trajectory/study_trace.ts";

const base = [{
  frame: 12,
  position: { x: 1.25, y: 4.5 },
  velocity: { x: 3.75, y: -0.25 },
  speed: 3.758324094593227,
  airborne: false,
  contactLineIds: [7],
}] as const;

describe("exact trajectory study trace", () => {
  test("distinguishes raw changes below display precision", () => {
    const changed = [{
      ...base[0],
      position: { ...base[0].position, x: base[0].position.x + 1e-7 },
    }];
    expect(fingerprintExactTraceSamples(base)).not.toBe(fingerprintExactTraceSamples(changed));
  });

  test("separates physical state identity from line-ID segmentation", () => {
    const resegmented = [{ ...base[0], contactLineIds: [17, 18] }];
    expect(fingerprintExactTraceSamples(base)).not.toBe(fingerprintExactTraceSamples(resegmented));
    expect(fingerprintExactKinematicTraceSamples(base)).toBe(fingerprintExactKinematicTraceSamples(resegmented));
  });

  test("uses Float64-bit fingerprints, including signed zero", () => {
    const negativeZero = [{ ...base[0], position: { ...base[0].position, x: -0 } }];
    expect(fingerprintExactTraceSamples(base)).not.toBe(fingerprintExactTraceSamples(negativeZero));
  });
});

describe("kinematic numerical diagnostic", () => {
  test("counts true adjacent Float64 values across binades and normalizes signed zero", () => {
    expect(float64UlpDistance(0.5, nextUp(0.5))).toBe(1n);
    expect(float64UlpDistance(1, nextUp(1))).toBe(1n);
    expect(float64UlpDistance(2, nextUp(2))).toBe(1n);
    expect(float64UlpDistance(0, -0)).toBe(0n);
    expect(float64UlpDistance(Number.NaN, Number.NaN)).toBeNull();
    expect(float64UlpDistance(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBeNull();
  });

  test("reports a raw-hash mismatch that still passes the declared numerical screen", () => {
    const changed = [{ ...base[0], velocity: { ...base[0].velocity, x: nextUp(base[0].velocity.x) } }];
    const comparison = compareKinematicTraceSamples(base, changed);
    expect(fingerprintExactKinematicTraceSamples(base)).not.toBe(fingerprintExactKinematicTraceSamples(changed));
    expect(comparison.status).toBe("observed");
    expect(comparison.firstRawDifferenceFrame).toBe(12);
    expect(comparison.passesDeclaredNumericalScreen).toBe(true);
    expect(comparison.maxComponentUlps).toBe("1");
  });

  test("fails the declared screen at 257 true Float64 steps and retains a witness", () => {
    let changedSpeed = base[0].speed;
    for (let index = 0; index < 257; index++) changedSpeed = nextUp(changedSpeed);
    const changed = [{ ...base[0], speed: changedSpeed }];
    const comparison = compareKinematicTraceSamples(base, changed);
    expect(comparison.status).toBe("observed");
    expect(comparison.firstToleranceExceedanceFrame).toBe(12);
    expect(comparison.scalarFrameToleranceExceedanceCount).toBe(1);
    expect(comparison.maxUlpWitness?.component).toBe("speed");
    expect(comparison.maxUlpWitness?.ulps).toBe("257");
    expect(comparison.passesDeclaredNumericalScreen).toBe(false);
  });

  test("fails closed for airborne, unavailable, and invalid-numeric comparisons", () => {
    expect(compareKinematicTraceSamples(base, [{ ...base[0], airborne: true }]).passesDeclaredNumericalScreen).toBe(false);
    const unequal = compareKinematicTraceSamples(base, [...base, { ...base[0], frame: 13 }]);
    expect(unequal.status).toBe("unavailable");
    expect(unequal.framesCompared).toBe(1);
    const invalid = compareKinematicTraceSamples(base, [{ ...base[0], speed: Number.POSITIVE_INFINITY }]);
    expect(invalid.status).toBe("invalid_numeric");
    expect(invalid.invalidNumericAt).toEqual({ frame: 12, component: "speed" });
  });
});

describe("full engine prefix evidence", () => {
  test("includes non-sled state and all collision-point identities", () => {
    const baseline = fakeEngine({ bodyY: 7, collisions: [] });
    const bodyPerturbed = fakeEngine({ bodyY: 7.25, collisions: [] });
    expect(exactEngineStateTraceFingerprint(baseline, 0, 0).fingerprint)
      .not.toBe(exactEngineStateTraceFingerprint(bodyPerturbed, 0, 0).fingerprint);
    const intruding = fakeEngine({
      bodyY: 7,
      collisions: [{ type: "CollisionUpdate", id: 99, updated: [{ id: "BUTT" }] }],
    });
    expect(engineCollisionHitsForLineIds(intruding, 0, new Set([99])))
      .toEqual([{ frame: 0, lineId: 99, pointIds: ["BUTT"] }]);
  });
});

describe("survival boundary", () => {
  test("rejects a fatal terminus on the declared final frame", () => {
    expect(survivesThroughFrame({ terminus: { reason: "rideStalled", frame: 42 } } as any, 42)).toBe(false);
    expect(survivesThroughFrame({ terminus: { reason: "rideStalled", frame: 43 } } as any, 42)).toBe(true);
    expect(survivesThroughFrame({ terminus: { reason: "endOfSpec", frame: 42 } } as any, 42)).toBe(true);
    expect(survivesThroughFrame({ terminus: { reason: "endOfSpec", frame: 41 } } as any, 42)).toBe(false);
  });
});

function nextUp(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  view.setBigUint64(0, value > 0 ? bits + 1n : bits - 1n, false);
  return view.getFloat64(0, false);
}

function fakeEngine({ bodyY, collisions }: { bodyY: number; collisions: any[] }) {
  return {
    getStateMapAtFrame() {
      return new Map([
        ["RIDER_MOUNTED", { __state__: { framesSinceUnbind: -1 } }],
        ["SLED_INTACT", { __state__: { framesSinceUnbind: -1 } }],
        ["TAIL", point(1, 2)],
        ["BUTT", point(3, bodyY)],
      ]);
    },
    getUpdatesAtFrame() { return collisions; },
  };
}

function point(x: number, y: number) {
  return { __state__: { pos: { x, y }, prevPos: { x: x - 1, y: y - 1 }, vel: { x: 1, y: 1 } } };
}
