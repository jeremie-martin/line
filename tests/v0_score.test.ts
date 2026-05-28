import { describe, expect, test } from "vitest";
import {
  AXIS_QUALITY_TOLERANCE,
  MISSING_CONTACT_TOLERANCE,
  OFF_BEAT_TOLERANCE,
  SYNC_TOLERANCE,
  runtimeMultiplier,
  scoreDriftReport,
  scoreTimedDriftReport,
  shiftedGeometricMean,
} from "../scripts/v0/score.ts";
import type { ContactReport, DriftReport } from "../scripts/v0/types.ts";

function contact(status: ContactReport["status"], frameError = 0): ContactReport {
  return {
    t_target: 1,
    t_actual: status === "missing" ? null : 1,
    frame_error: status === "missing" ? null : frameError,
    status,
  };
}

function report(options: {
  contacts?: ContactReport[];
  axisErrors?: number[];
  offBeat?: number;
  terminusReason?: string;
  terminusFrame?: number;
} = {}): DriftReport {
  const axisErrors = options.axisErrors ?? [0];
  return {
    contacts: options.contacts ?? [contact("hit", 0)],
    sections: [
      {
        section_index: 0,
        survived: true,
        axes: Object.fromEntries(axisErrors.map((error, index) => [
          `axis_${index}`,
          { target: 0.5, achieved: 0.5 + error, error },
        ])),
      },
    ],
    off_beat_landings: Array.from({ length: options.offBeat ?? 0 }, (_, i) => ({ frame: 12 + i })),
    terminus: {
      frame: options.terminusFrame ?? 120,
      reason: options.terminusReason ?? "endOfSpec",
    },
  };
}

describe("v0 scoreDriftReport — smooth quality factors", () => {
  test("axis quality uses RMS, not L1 mean, of section errors", () => {
    const score = scoreDriftReport(report({ axisErrors: [0, AXIS_QUALITY_TOLERANCE] }));

    // RMS of [0, 0.25] = sqrt(0.25²/2) ≈ 0.1768; loss ≈ 0.7071
    const expectedRms = Math.sqrt((AXIS_QUALITY_TOLERANCE * AXIS_QUALITY_TOLERANCE) / 2);
    expect(score.contract_passed).toBe(true);
    expect(score.axis_error_mean).toBeCloseTo(AXIS_QUALITY_TOLERANCE / 2);
    expect(score.axis_error_rms).toBeCloseTo(expectedRms);
    expect(score.axis_loss).toBeCloseTo(expectedRms / AXIS_QUALITY_TOLERANCE);
    expect(score.axis_quality).toBeCloseTo(Math.exp(-expectedRms / AXIS_QUALITY_TOLERANCE));
  });

  test("L2 aggregator penalizes one bad section more than L1 mean would", () => {
    const evenly = scoreDriftReport(report({ axisErrors: [0.2, 0.2, 0.2, 0.2] }));
    const oneBad = scoreDriftReport(report({ axisErrors: [0.0, 0.0, 0.0, 0.8] }));
    // L1 means are equal (0.2), but RMS punishes the spike: 0.4 vs 0.2.
    expect(oneBad.axis_error_mean).toBeCloseTo(evenly.axis_error_mean);
    expect(oneBad.axis_error_rms).toBeGreaterThan(evenly.axis_error_rms);
    expect(oneBad.axis_quality).toBeLessThan(evenly.axis_quality);
  });

  test("clean contract gives every quality factor 1.0 and contract_passed = true", () => {
    const clean = scoreDriftReport(report({ axisErrors: [0] }));
    expect(clean.axis_quality).toBeCloseTo(1);
    expect(clean.drift_quality).toBeCloseTo(1);
    expect(clean.missing_quality).toBeCloseTo(1);
    expect(clean.sync_quality).toBeCloseTo(1);
    expect(clean.survival_quality).toBe(1);
    expect(clean.off_beat_quality).toBeCloseTo(1);
    expect(clean.contract_passed).toBe(true);
    expect(clean.score).toBeCloseTo(1000);
  });

  test("hard-gate violations no longer zero the score — they degrade smoothly", () => {
    const driftRow = scoreDriftReport(report({ contacts: [contact("drift", 2)] }));
    const offBeatRow = scoreDriftReport(report({ offBeat: 1 }));
    const earlyDeath = scoreDriftReport(report({
      terminusReason: "fell",
      terminusFrame: 60,
    }), { totalFrames: 120 });

    // contract_passed is false, but score is strictly between 0 and 1000.
    for (const row of [driftRow, offBeatRow, earlyDeath]) {
      expect(row.contract_passed).toBe(false);
      expect(row.score).toBeGreaterThan(0);
      expect(row.score).toBeLessThan(1000);
    }

    // drift: one landed contact at frame_error=2, excess=1, RMS=1 → drift_quality = exp(-1)
    expect(driftRow.drift_quality).toBeCloseTo(Math.exp(-1 / SYNC_TOLERANCE));
    expect(driftRow.missing_quality).toBeCloseTo(1);
    // one off-beat → off_beat_quality = exp(-1/OFF_BEAT_TOL)
    expect(offBeatRow.off_beat_quality).toBeCloseTo(Math.exp(-1 / OFF_BEAT_TOLERANCE));
    // died halfway → survival_quality = 0.5 (linear in frame fraction)
    expect(earlyDeath.survival_quality).toBeCloseTo(0.5);
  });

  test("drift gradient: smaller frame error scores strictly higher than larger", () => {
    const small = scoreDriftReport(report({ contacts: [contact("drift", 2)] }));
    const big = scoreDriftReport(report({ contacts: [contact("drift", 5)] }));
    expect(small.score).toBeGreaterThan(big.score);
  });

  test("missing gradient: fewer missing contacts scores strictly higher than more", () => {
    const oneMissing = scoreDriftReport(report({ contacts: [
      contact("missing"),
      ...Array.from({ length: 9 }, () => contact("hit", 0)),
    ]}));
    const twoMissing = scoreDriftReport(report({ contacts: [
      contact("missing"), contact("missing"),
      ...Array.from({ length: 8 }, () => contact("hit", 0)),
    ]}));
    expect(oneMissing.score).toBeGreaterThan(twoMissing.score);
  });

  test("missing penalty is count-based and INVARIANT to spec size", () => {
    // One missing contact: same missing_quality regardless of how many other
    // contacts hit. This is the core principle — missing a contact is missing
    // a contact, whether there are 10 or 50 contacts in the spec.
    const makeReport = (numContacts: number) => report({
      contacts: [
        contact("missing"),
        ...Array.from({ length: numContacts - 1 }, () => contact("hit", 0)),
      ],
    });
    const ten = scoreDriftReport(makeReport(10));
    const fifty = scoreDriftReport(makeReport(50));
    const expected = Math.exp(-1 / MISSING_CONTACT_TOLERANCE);
    expect(ten.missing_quality).toBeCloseTo(expected);
    expect(fifty.missing_quality).toBeCloseTo(expected);
    expect(ten.missing_quality).toBeCloseTo(fifty.missing_quality);

    // Two missing → exp(-2) ≈ 0.135, also invariant.
    const twoMissing = report({ contacts: [
      contact("missing"), contact("missing"),
      ...Array.from({ length: 28 }, () => contact("hit", 0)),
    ]});
    expect(scoreDriftReport(twoMissing).missing_quality).toBeCloseTo(
      Math.exp(-2 / MISSING_CONTACT_TOLERANCE),
    );
  });

  test("drift_quality smoothly grades landed near-misses", () => {
    // Drift errors (contacts that landed but past ±1 frame) get a smooth
    // gradient. Hits are still counted in the RMS denominator — a single
    // small drift in a 30-contact spec is correctly less severe than the
    // same drift in a 10-contact spec, because the contact *did* land.
    const oneSmallDriftIn30 = report({ contacts: [
      contact("drift", 2),
      ...Array.from({ length: 29 }, () => contact("hit", 0)),
    ]});
    const oneBigDriftIn30 = report({ contacts: [
      contact("drift", 5),
      ...Array.from({ length: 29 }, () => contact("hit", 0)),
    ]});
    const small = scoreDriftReport(oneSmallDriftIn30);
    const big = scoreDriftReport(oneBigDriftIn30);
    expect(small.drift_quality).toBeGreaterThan(big.drift_quality);
    expect(small.missing_quality).toBeCloseTo(1);
    expect(big.missing_quality).toBeCloseTo(1);
  });

  test("drift_quality computed only over landed contacts (missing excluded)", () => {
    // 1 missing + 1 drift(fe=3) + 3 hits: drift RMS computed over the 4
    // landed contacts only (drift contributes excess=2, hits contribute 0).
    // RMS = sqrt(4/4) = 1 → drift_quality = exp(-1).
    const mixed = report({ contacts: [
      contact("missing"),
      contact("drift", 3),
      contact("hit", 0), contact("hit", 0), contact("hit", 0),
    ]});
    const row = scoreDriftReport(mixed);
    expect(row.drift_quality).toBeCloseTo(Math.exp(-1 / SYNC_TOLERANCE));
    expect(row.missing_quality).toBeCloseTo(Math.exp(-1 / MISSING_CONTACT_TOLERANCE));
    // sync_quality is the reported convenience aggregate.
    expect(row.sync_quality).toBeCloseTo(row.drift_quality * row.missing_quality);
  });

  test("survival_quality is 1 on endOfSpec regardless of totalFrames", () => {
    const reached = scoreDriftReport(report(), { totalFrames: 999 });
    expect(reached.survival_quality).toBe(1);
  });

  test("survival_quality without totalFrames is binary on terminus.reason", () => {
    const dead = scoreDriftReport(report({ terminusReason: "fell", terminusFrame: 50 }));
    expect(dead.survival_quality).toBe(0);
  });
});

describe("v0 runtime scoring", () => {
  test("runtime multiplier is flat, then smooth, then zero", () => {
    expect(runtimeMultiplier(10, 20, 40)).toBe(1);
    expect(runtimeMultiplier(20, 20, 40)).toBe(1);
    expect(runtimeMultiplier(30, 20, 40)).toBeCloseTo(0.5);
    expect(runtimeMultiplier(40, 20, 40)).toBe(0);
    expect(runtimeMultiplier(45, 20, 40)).toBe(0);
    expect(() => runtimeMultiplier(10, 20, 20)).toThrow(/invalid runtime budget/);
  });

  test("timed row score is the smooth score times the runtime multiplier", () => {
    const timed = scoreTimedDriftReport(report(), {
      elapsed_ms: 30,
      soft_ms: 20,
      hard_ms: 40,
    });
    // clean contract: score_without_time ≈ 1000, time_multiplier = 0.5 → 500
    expect(timed.score_without_time).toBeCloseTo(1000);
    expect(timed.time_multiplier).toBeCloseTo(0.5);
    expect(timed.score).toBeCloseTo(500);

    // hard-gate violation still gets time-multiplied (no zero cliff)
    const driftRow = scoreTimedDriftReport(
      report({ contacts: [contact("drift", 2)] }),
      { elapsed_ms: 10, soft_ms: 20, hard_ms: 40 },
    );
    expect(driftRow.time_multiplier).toBe(1);
    expect(driftRow.score).toBeGreaterThan(0);
    expect(driftRow.score).toBeLessThan(1000);
    expect(driftRow.contract_passed).toBe(false);
  });
});

describe("v0 suite aggregation", () => {
  test("shifted geometric mean penalizes failures without collapsing the suite", () => {
    const aggregate = shiftedGeometricMean([1000, 0]);

    expect(aggregate).toBeCloseTo(Math.sqrt(1001) - 1);
    expect(aggregate).toBeGreaterThan(0);
    expect(aggregate).toBeLessThan(500);
  });
});
