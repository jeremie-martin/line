import { describe, expect, test } from "vitest";
import { ELEVATION, type TrackLine } from "../scripts/v0/types.ts";
import {
  additiveQuadraticFeatures,
  applyArcKnobs,
  arcProbeDesign,
  arcProbeDesignMinRows,
  parseArcProbeDesignName,
  pitchQuadraticFeatures,
  arcResponseOutputs,
  fitLinearLeastSquares,
  fitJointArcResponseModel,
  jointQuadraticFeatures,
  pitchExitLines,
  predictedArrivalState,
  predictedCurrentAxes,
  predictJointArcOutputs,
  predictLinearModel,
  propagateBallisticArrivalState,
  reduceLatentJointArcOutputs,
  rotateArcLines,
  stateOutputs,
  type RiderArrivalState,
} from "../scripts/v0/optimizer/arc_model.ts";
import { readinessCatch, readinessCatchState } from "../scripts/v0/optimizer/readiness.ts";

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return {
    id,
    type: 0,
    x1,
    y1,
    x2,
    y2,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

const TEST_RESPONSE_CONTEXT = {
  gap: {
    index: 0,
    startFrame: 0,
    endFrame: 8,
    endsWithContact: true,
    targets: {},
  },
  axisMeasureEnd: 12,
  nextFrame: 13,
};

describe("arc_model knob transforms", () => {
  const lines = [
    line(1, 0, 0, 10, 0),
    line(2, 10, 0, 20, 0),
    line(3, 20, 0, 30, 0),
  ];

  test("pitchExitLines rotates only the tail third about the suffix joint", () => {
    const out = pitchExitLines(lines, 90);
    expect(out[0]).toEqual(lines[0]);
    expect(out[1]).toEqual(lines[1]);
    expect(out[2].x1).toBeCloseTo(20);
    expect(out[2].y1).toBeCloseTo(0);
    expect(out[2].x2).toBeCloseTo(20);
    expect(out[2].y2).toBeCloseTo(10);
  });

  test("rotateArcLines rotates the whole arc about the entry point", () => {
    const out = rotateArcLines(lines, 90);
    expect(out[0].x1).toBeCloseTo(0);
    expect(out[0].y1).toBeCloseTo(0);
    expect(out[0].x2).toBeCloseTo(0);
    expect(out[0].y2).toBeCloseTo(10);
    expect(out[2].x2).toBeCloseTo(0);
    expect(out[2].y2).toBeCloseTo(30);
  });

  test("applyArcKnobs uses rotate-then-pitch order", () => {
    const knobs = { pitchDeg: 12, rotateDeg: -2 };
    expect(applyArcKnobs(lines, knobs)).toEqual(
      pitchExitLines(rotateArcLines(lines, knobs.rotateDeg), knobs.pitchDeg),
    );
  });
});

describe("arc_model local regression helpers", () => {
  const value = (pitchDeg: number, rotateDeg: number): number =>
    2 + 0.5 * pitchDeg - rotateDeg + 0.1 * pitchDeg * pitchDeg +
    0.25 * pitchDeg * rotateDeg - 0.2 * rotateDeg * rotateDeg;

  const grid = [-6, 0, 6].flatMap((pitchDeg) =>
    [-3, 0, 3].map((rotateDeg) => ({ pitchDeg, rotateDeg }))
  );

  test("jointQuadraticFeatures fit a pitch*rotation interaction", () => {
    const model = fitLinearLeastSquares(
      grid.map((knobs) => ({ features: jointQuadraticFeatures(knobs), value: value(knobs.pitchDeg, knobs.rotateDeg) })),
      0,
    );
    expect(model).not.toBeNull();
    const knobs = { pitchDeg: 1.5, rotateDeg: 0.5 };
    expect(predictLinearModel(model!, jointQuadraticFeatures(knobs))).toBeCloseTo(value(knobs.pitchDeg, knobs.rotateDeg), 8);
  });

  test("additiveQuadraticFeatures cannot represent the interaction term", () => {
    const model = fitLinearLeastSquares(
      grid.map((knobs) => ({ features: additiveQuadraticFeatures(knobs), value: value(knobs.pitchDeg, knobs.rotateDeg) })),
      0,
    );
    expect(model).not.toBeNull();
    const knobs = { pitchDeg: 2, rotateDeg: 1 };
    const predicted = predictLinearModel(model!, additiveQuadraticFeatures(knobs));
    expect(Math.abs(predicted - value(knobs.pitchDeg, knobs.rotateDeg))).toBeGreaterThan(0.1);
  });
});

describe("arc_model joint response helpers", () => {
  test("probe designs are restricted to five-probe cross and nine-probe grid", () => {
    expect(arcProbeDesign("cross5")).toHaveLength(5);
    expect(arcProbeDesign("grid9")).toHaveLength(9);
    expect(arcProbeDesign("cross5").map((k) => [k.pitchDeg, k.rotateDeg])).toEqual([
      [0, 0],
      [-8.5, 0],
      [8.5, 0],
      [0, -2.5],
      [0, 2.5],
    ]);
  });

  test("pitch3 design is a three-row pitch-only cross with no rotate perturbation", () => {
    const design = arcProbeDesign("pitch3");
    expect(design).toHaveLength(3);
    expect(design.map((k) => [k.pitchDeg, k.rotateDeg])).toEqual([
      [0, 0],
      [-8.5, 0],
      [8.5, 0],
    ]);
    expect(arcProbeDesignMinRows("pitch3")).toBe(3);
    expect(parseArcProbeDesignName("pitch3")).toBe("pitch3");
  });

  test("pitch_quadratic fits three pitch3 rows of a known quadratic exactly", () => {
    const quad = (p: number): number => 1.5 - 0.4 * p + 0.07 * p * p;
    const rows = arcProbeDesign("pitch3").map((knobs) => ({
      knobs,
      outputs: { "next.speed": quad(knobs.pitchDeg) },
    }));
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    const fitted = model.outputModels.get("next.speed");
    expect(fitted?.model.form).toBe("pitch_quadratic");
    expect(fitted?.model.degraded).toBe(false);
    for (const p of [-8.5, -3, 0, 4.25, 8.5]) {
      expect(fitted!.model.predict({ pitchDeg: p, rotateDeg: 0 })).toBeCloseTo(quad(p), 6);
    }
    // rotateDeg is ignored under pitch3 (features don't include it).
    expect(fitted!.model.predict({ pitchDeg: 2, rotateDeg: 5 })).toBeCloseTo(quad(2), 6);
  });

  test("pitch3 ladder falls to pitch_linear with degraded flag when one row is non-finite", () => {
    const lin = (p: number): number => 3 + 0.5 * p;
    const rows = arcProbeDesign("pitch3").map((knobs) => ({
      knobs,
      // The +8.5 row gate-failed: its value is non-finite, leaving only 2 finite rows.
      outputs: { "next.speed": knobs.pitchDeg === 8.5 ? NaN : lin(knobs.pitchDeg) },
    }));
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    const fitted = model.outputModels.get("next.speed");
    expect(fitted?.model.form).toBe("pitch_linear");
    expect(fitted?.model.degraded).toBe(true);
    // Two clean rows of a linear law recover it exactly.
    expect(fitted!.model.predict({ pitchDeg: -8.5, rotateDeg: 0 })).toBeCloseTo(lin(-8.5), 6);
    expect(fitted!.model.predict({ pitchDeg: 0, rotateDeg: 0 })).toBeCloseTo(lin(0), 6);
  });

  test("pitchQuadraticFeatures ignore rotate entirely", () => {
    expect(pitchQuadraticFeatures({ pitchDeg: 3, rotateDeg: 7 })).toEqual([1, 3, 9]);
  });

  test("pitch3 latent pipeline predicts a sensible arrival state", () => {
    const rows = arcProbeDesign("pitch3").map((knobs) => {
      const p = knobs.pitchDeg;
      return {
        knobs,
        outputs: {
          "current.cost": 0.2,
          "current.axis.air": 0,
          "current.axis.amplitude": 0.42,
          "current.error.amplitude": 0.02,
        },
        latentOutputs: {
          "latent.suffix.frame": 10,
          "latent.suffix.x": 100 + p,
          "latent.suffix.y": 50 + 2 * p,
          "latent.suffix.vx": 3 + 0.01 * p,
          "latent.suffix.vy": 1,
          "latent.suffix.sledPoseDeg": 20 + p,
          "latent.suffix.sledPoseRateDegPerFrame": 2,
          "latent.prefix.airFrames": 5,
          "latent.prefix.speedSumPx": 55,
          "latent.prefix.speedFrames": 11,
          "latent.prefix.dy": 4,
          "latent.prefix.v0SpeedPx": 5,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", {
      context: {
        gap: { index: 0, startFrame: 0, endFrame: 8, endsWithContact: true, targets: { air: 0.5, amplitude: 0.4 } },
        axisMeasureEnd: 12,
        nextFrame: 13,
      },
    });
    const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    // exit.* is the suffix state directly (x=100+p); next.* is that propagated
    // ballistically to nextFrame, so it carries the vx*dt drift.
    expect(outputs["exit.x"]).toBeCloseTo(104, 6);
    expect(outputs["exit.sledPoseDeg"]).toBeCloseTo(24, 6);
    expect(outputs["current.axis.amplitude"]).toBeCloseTo(0.42, 6);
  });

  test("response outputs include all achieved axes but only targeted errors", () => {
    const outputs = arcResponseOutputs(
      { air: 0.5, impact: 0.8 },
      { air: 0.6, speed: 0.7, impact: 0.75 },
      0.02,
      null,
    );
    expect(outputs["current.cost"]).toBeCloseTo(0.02);
    expect(outputs["current.axis.speed"]).toBeCloseTo(0.7);
    expect(outputs["current.error.air"]).toBeCloseTo(0.1);
    expect(outputs["current.error.impact"]).toBeCloseTo(-0.05);
    expect(outputs["current.error.speed"]).toBeUndefined();
  });

  test("joint response model predicts current axes and next rider state from shared outputs", () => {
    const rows = arcProbeDesign("cross5").map((knobs) => {
      const p = knobs.pitchDeg;
      const r = knobs.rotateDeg;
      return {
        knobs,
        outputs: {
          "current.cost": 0.1 + 0.01 * p - 0.02 * r,
          "current.axis.air": 0.5 + 0.01 * p,
          "current.error.air": 0.05 + 0.01 * p,
          "next.x": 100 + p + r,
          "next.y": 200 + 2 * p - r,
          "next.vx": 9 + 0.1 * p,
          "next.vy": 1 + 0.2 * r,
          "next.speed": 9.1 + 0.1 * p + 0.2 * r,
          "next.comAngleDeg": 10 + p + r,
          "next.sledPoseDeg": 30 + p,
          "next.sledPoseRateDegPerFrame": 0.5 + 0.1 * r,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "cross5", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    const outputs = predictJointArcOutputs(model, { pitchDeg: 0, rotateDeg: 0 });
    expect(predictedCurrentAxes(outputs).air).toBeCloseTo(0.5);
    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    expect(state!.x).toBeCloseTo(100);
    expect(state!.speed).toBeCloseTo(9.1);
    expect(state!.comAngleDeg).toBeCloseTo(10);
  });

  test("full-mode direct outputs (next.* only, no latentOutputs) fit and predict an arrival for pitch3", () => {
    // Full mode emits direct current.*/next.* outputs and NO latentOutputs —
    // predictJointArcOutputs must fit the per-output models directly and
    // predictedArrivalState must read next.* without any latent reducer.
    const rows = arcProbeDesign("pitch3").map((knobs) => {
      const p = knobs.pitchDeg;
      return {
        knobs,
        outputs: {
          "current.cost": 0.1 + 0.01 * p,
          "current.axis.air": 0.5 + 0.01 * p,
          "current.error.air": 0.05 + 0.01 * p,
          "next.x": 100 + p,
          "next.y": 200 + 2 * p,
          "next.vx": 9 + 0.1 * p,
          "next.vy": 1 + 0.05 * p,
          "next.speed": 9.1 + 0.1 * p,
          "next.comAngleDeg": 10 + p,
          "next.sledPoseDeg": 30 + p,
          "next.sledPoseRateDegPerFrame": 0.5 + 0.1 * p,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    expect(model.latentModels.size).toBe(0);
    // pitch3 designs key onto the pitch_quadratic/pitch_linear ladder.
    expect(model.outputModels.get("next.speed")?.model.form).toBe("pitch_quadratic");
    const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
    expect(predictedCurrentAxes(outputs).air).toBeCloseTo(0.5 + 0.01 * 4);
    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    expect(state!.x).toBeCloseTo(104);
    expect(state!.speed).toBeCloseTo(9.5);
    expect(state!.comAngleDeg).toBeCloseTo(14);
  });

  test("hybrid identifiability ladder keeps current-axis models when a probe row fails the gates", () => {
    // One non-base probe row fails the hard gates: it carries next.* outputs
    // but NO current.* outputs (arc_probe only emits those when currentOk).
    // The first-choice forms (surface / additive quadratic) need all 5 cross5
    // rows, so before the ladder every current.* model vanished and the sweep
    // objective silently lost its current-gap term.
    const failed = { pitchDeg: 8.5, rotateDeg: 0 };
    const rows = arcProbeDesign("cross5").map((knobs) => {
      const p = knobs.pitchDeg;
      const r = knobs.rotateDeg;
      const gateFailed = knobs.pitchDeg === failed.pitchDeg && knobs.rotateDeg === failed.rotateDeg;
      return {
        knobs,
        outputs: {
          ...(gateFailed ? {} : {
            "current.cost": 0.1 + 0.01 * p - 0.02 * r,
            "current.axis.air": 0.5 + 0.01 * p,
            "current.axis.speed": 0.7 - 0.005 * p,
            "current.error.air": 0.05 + 0.01 * p,
          }),
          "next.speed": 9.1 + 0.1 * p + 0.2 * r,
          "next.comAngleDeg": 10 + p + r,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "cross5", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    const outputs = predictJointArcOutputs(model, { pitchDeg: 2, rotateDeg: 0 });
    // The generating functions are linear, so the linear-floor fit over the
    // four gate-clean rows recovers them exactly.
    expect(outputs["current.axis.air"]).toBeCloseTo(0.5 + 0.01 * 2, 6);
    expect(outputs["current.axis.speed"]).toBeCloseTo(0.7 - 0.005 * 2, 6);
    expect(outputs["current.cost"]).toBeCloseTo(0.1 + 0.01 * 2, 6);
    // Degradation is explicit, never silent: current.* fell to the linear
    // floor; next.* had all five rows and kept its first-choice form.
    expect(model.outputModels.get("current.axis.air")?.model.degraded).toBe(true);
    expect(model.outputModels.get("current.axis.air")?.model.form).toBe("linear");
    expect(model.outputModels.get("next.speed")?.model.degraded).toBe(false);
    expect(model.outputModels.get("next.speed")?.model.form).toBe("additive_quadratic");
  });

  test("hybrid fits are unchanged (first choice, not degraded) when every probe row passes", () => {
    const rows = arcProbeDesign("cross5").map((knobs) => ({
      knobs,
      outputs: {
        "current.axis.air": 0.5 + 0.01 * knobs.pitchDeg,
        "current.axis.speed": 0.7 - 0.005 * knobs.pitchDeg,
        "next.speed": 9.1 + 0.1 * knobs.pitchDeg,
      },
    }));
    const model = fitJointArcResponseModel(rows, "cross5", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    expect(model.outputModels.get("current.axis.air")?.model.form).toBe("surface");
    expect(model.outputModels.get("current.axis.air")?.model.degraded).toBe(false);
    expect(model.outputModels.get("current.axis.speed")?.model.form).toBe("additive_quadratic");
    expect(model.outputModels.get("current.axis.speed")?.model.degraded).toBe(false);
  });

  test("direct short rows (ballistic exit.*/next.* in outputs, no latentOutputs) fit and predict for cross5 and pitch3", () => {
    // DIRECT model space: each short probe row already carries the ballistic
    // reduction (exit.*/next.*) in `outputs` and NO latentOutputs. The fit must
    // run knobs → those outputs directly and predictedArrivalState read next.*
    // with no latent reducer involved.
    for (const design of ["cross5", "pitch3"] as const) {
      const rows = arcProbeDesign(design).map((knobs) => {
        const p = knobs.pitchDeg;
        const r = knobs.rotateDeg;
        return {
          knobs,
          outputs: {
            "current.cost": 0.1 + 0.01 * p,
            "current.axis.air": 0.5 + 0.01 * p,
            "current.error.air": 0.05 + 0.01 * p,
            "current.releaseSpeedPx": 9 + 0.1 * p,
            "current.releaseVy": 1 + 0.05 * p,
            "exit.frame": 10,
            "exit.x": 90 + p + r,
            "exit.y": 50 + 2 * p,
            "exit.vx": 9 + 0.1 * p,
            "exit.vy": 1 + 0.05 * p,
            "exit.speed": Math.hypot(9 + 0.1 * p, 1 + 0.05 * p),
            "exit.comAngleDeg": 6 + p,
            "exit.sledPoseDeg": 20 + p,
            "exit.sledPoseRateDegPerFrame": 2,
            "next.x": 100 + p + r,
            "next.y": 200 + 2 * p,
            "next.vx": 9 + 0.1 * p,
            "next.vy": 1 + 0.05 * p,
            "next.speed": 9.1 + 0.1 * p,
            "next.comAngleDeg": 10 + p,
            "next.sledPoseDeg": 30 + p,
            "next.sledPoseRateDegPerFrame": 0.5 + 0.1 * p,
          },
        };
      });
      const model = fitJointArcResponseModel(rows, design, "hybrid", { context: TEST_RESPONSE_CONTEXT });
      // No latent models — the direct fits own every prediction.
      expect(model.latentModels.size).toBe(0);
      const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
      // exit.frame is fitted, so the next_before_exit guard reads a real value.
      expect(outputs["exit.frame"]).toBeCloseTo(10, 6);
      expect(predictedCurrentAxes(outputs).air).toBeCloseTo(0.5 + 0.01 * 4, 6);
      const state = predictedArrivalState(outputs);
      expect(state).not.toBeNull();
      expect(state!.x).toBeCloseTo(104, 6);
      expect(state!.speed).toBeCloseTo(9.5, 6);
      expect(state!.comAngleDeg).toBeCloseTo(14, 6);
    }
  });

  test("direct-mode angle outputs unwrap across the ±180° seam", () => {
    // exit.comAngleDeg / next.comAngleDeg straddle the wrap: baseline 175°, the
    // −8.5 probe at 179°, the +8.5 probe at −178° (i.e. 182° unwrapped around the
    // 175° baseline ref). The fit must unwrap onto a continuous branch and the
    // baseline (pitch 0) prediction must land back at 175°, not jump ~360°.
    const angleAt = (p: number): number => (p === 0 ? 175 : p < 0 ? 179 : -178);
    const rows = arcProbeDesign("pitch3").map((knobs) => {
      const p = knobs.pitchDeg;
      return {
        knobs,
        outputs: {
          "exit.frame": 10,
          "exit.x": 90 + p,
          "exit.y": 50,
          "exit.vx": 9 + 0.1 * p,
          "exit.vy": 1,
          "exit.speed": Math.hypot(9 + 0.1 * p, 1),
          "exit.comAngleDeg": angleAt(p),
          "exit.sledPoseDeg": 20 + p,
          "exit.sledPoseRateDegPerFrame": 0,
          "next.x": 100 + p,
          "next.y": 200,
          "next.vx": 9 + 0.1 * p,
          "next.vy": 1,
          "next.speed": Math.hypot(9 + 0.1 * p, 1),
          "next.comAngleDeg": angleAt(p),
          "next.sledPoseDeg": 30 + p,
          "next.sledPoseRateDegPerFrame": 0,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    expect(model.latentModels.size).toBe(0);
    // The +8.5 row at −178° is unwrapped to 182° around the 175° baseline ref.
    expect(model.outputModels.get("next.comAngleDeg")?.angle).toBe(true);
    const base = predictJointArcOutputs(model, { pitchDeg: 0, rotateDeg: 0 });
    expect(base["exit.comAngleDeg"]).toBeCloseTo(175, 6);
    expect(base["next.comAngleDeg"]).toBeCloseTo(175, 6);
    // Predicting at the +8.5 knob recovers the unwrapped 182° branch.
    const high = predictJointArcOutputs(model, { pitchDeg: 8.5, rotateDeg: 0 });
    expect(high["next.comAngleDeg"]).toBeCloseTo(182, 6);
    expect(predictedArrivalState(base)?.comAngleDeg).toBeCloseTo(175, 6);
  });

  test("gate-failed direct row still yields a scoreable arrival and no current-axis model for its missing axis", () => {
    // A direct pool where the off-base probes failed the current-axis gate: they
    // carry exit.*/next.* but NO current.axis.* (arc_probe only emits current.*
    // when currentOk). The fit must still produce a non-null arrival, and an axis
    // left with too few finite rows to fit (here only the baseline) must have no
    // current-axis model at all.
    const rows = arcProbeDesign("pitch3").map((knobs) => {
      const p = knobs.pitchDeg;
      // Both off-base probes gate-fail: only the baseline carries current.axis.*.
      const gateFailed = knobs.pitchDeg !== 0 || knobs.rotateDeg !== 0;
      return {
        knobs,
        outputs: {
          ...(gateFailed ? {} : {
            "current.cost": 0.1 + 0.01 * p,
            "current.axis.air": 0.5 + 0.01 * p,
            "current.error.air": 0.05 + 0.01 * p,
          }),
          "exit.frame": 10,
          "exit.x": 90 + p,
          "exit.y": 50 + 2 * p,
          "exit.vx": 9 + 0.1 * p,
          "exit.vy": 1 + 0.05 * p,
          "exit.speed": Math.hypot(9 + 0.1 * p, 1 + 0.05 * p),
          "exit.comAngleDeg": 6 + p,
          "exit.sledPoseDeg": 20 + p,
          "exit.sledPoseRateDegPerFrame": 0,
          "next.x": 100 + p,
          "next.y": 200 + 2 * p,
          "next.vx": 9 + 0.1 * p,
          "next.vy": 1 + 0.05 * p,
          "next.speed": Math.hypot(9 + 0.1 * p, 1 + 0.05 * p),
          "next.comAngleDeg": 10 + p,
          "next.sledPoseDeg": 30 + p,
          "next.sledPoseRateDegPerFrame": 0,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "pitch3", "hybrid", { context: TEST_RESPONSE_CONTEXT });
    expect(model.latentModels.size).toBe(0);
    const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
    // The arrival is scoreable: next.* came from all three rows.
    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    expect(state!.x).toBeCloseTo(104, 6);
    // current.axis.air had only one finite row (the baseline); even the
    // pitch_linear floor needs two, so there is no model and no predicted
    // current axis for it.
    expect(model.outputModels.has("current.axis.air")).toBe(false);
    expect(predictedCurrentAxes(outputs).air).toBeUndefined();
  });

  test("direct outputs of a row equal the reducer applied to that row's measured latents", () => {
    // Pins fit(reduce(·)) and reduce(·) to ONE reduction. Build a single
    // synthetic measured suffix state, derive the direct outputs the way
    // arc_probe does (exitStateOutputs + propagate→stateOutputs), and the
    // latent outputs the reducer consumes; the reducer's exit.*/next.* must
    // match the direct exit.*/next.* exactly.
    const suffixFrame = 9;
    const suffix: RiderArrivalState = {
      x: 123.4,
      y: 56.7,
      vx: 8.25,
      vy: -1.5,
      speed: Math.hypot(8.25, -1.5),
      comAngleDeg: Math.atan2(-1.5, 8.25) * 180 / Math.PI,
      sledPoseDeg: 17.5,
      sledPoseRateDegPerFrame: 1.25,
    };
    const context = {
      gap: { index: 0, startFrame: 0, endFrame: 8, endsWithContact: true, targets: {} },
      axisMeasureEnd: 12,
      nextFrame: 13,
    };

    // Direct path (mirrors study-local per-row reduction from measured latents).
    const direct: Record<string, number> = {
      "exit.frame": suffixFrame,
      "exit.x": suffix.x,
      "exit.y": suffix.y,
      "exit.vx": suffix.vx,
      "exit.vy": suffix.vy,
      "exit.speed": suffix.speed,
      "exit.comAngleDeg": suffix.comAngleDeg!,
      "exit.sledPoseDeg": suffix.sledPoseDeg!,
      "exit.sledPoseRateDegPerFrame": suffix.sledPoseRateDegPerFrame!,
    };
    Object.assign(direct, stateOutputs(propagateBallisticArrivalState(suffix, context.nextFrame - suffixFrame)));

    // Latent path: the latent keys a measured row carries, run through the reducer.
    const latent: Record<string, number> = {
      "latent.suffix.frame": suffixFrame,
      "latent.suffix.x": suffix.x,
      "latent.suffix.y": suffix.y,
      "latent.suffix.vx": suffix.vx,
      "latent.suffix.vy": suffix.vy,
      "latent.suffix.sledPoseDeg": suffix.sledPoseDeg!,
      "latent.suffix.sledPoseRateDegPerFrame": suffix.sledPoseRateDegPerFrame!,
    };
    const reduced = reduceLatentJointArcOutputs(latent, context);

    for (const key of Object.keys(direct)) {
      expect(reduced[key]).toBeCloseTo(direct[key], 9);
    }
  });

  test("latent joint response predicts suffix state and reduces it to final outputs", () => {
    const rows = arcProbeDesign("cross5").map((knobs) => {
      const p = knobs.pitchDeg;
      const r = knobs.rotateDeg;
      return {
        knobs,
        outputs: {
          "current.cost": 0.2,
          "current.axis.air": 0,
          "current.axis.amplitude": 0.42,
          "current.error.amplitude": 0.02,
        },
        latentOutputs: {
          "latent.suffix.frame": 10,
          "latent.suffix.x": 100 + p + r,
          "latent.suffix.y": 50 + 2 * p - r,
          "latent.suffix.vx": 3 + 0.01 * p,
          "latent.suffix.vy": 1 + 0.02 * r,
          "latent.suffix.sledPoseDeg": 20 + p,
          "latent.suffix.sledPoseRateDegPerFrame": 2,
          "latent.prefix.airFrames": 5,
          "latent.prefix.speedSumPx": 55,
          "latent.prefix.speedFrames": 11,
          "latent.prefix.dy": 4,
          "latent.prefix.v0SpeedPx": 5,
        },
      };
    });
    const model = fitJointArcResponseModel(rows, "cross5", "additive_quadratic", {
      context: {
        gap: {
          index: 0,
          startFrame: 0,
          endFrame: 8,
          endsWithContact: true,
          targets: { air: 0.5, amplitude: 0.4 },
        },
        axisMeasureEnd: 12,
        nextFrame: 13,
      },
    });
    const outputs = predictJointArcOutputs(model, { pitchDeg: 0, rotateDeg: 0 });
    expect(outputs["current.axis.air"]).toBeCloseTo(7 / 13);
    expect(outputs["current.error.air"]).toBeCloseTo(7 / 13 - 0.5);
    expect(outputs["current.axis.amplitude"]).toBeCloseTo(0.42);
    expect(outputs["current.releaseSpeedPx"]).toBeCloseTo(Math.hypot(3, 1));

    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    expect(state!.x).toBeCloseTo(109);
    // Next-arrival propagation uses PURE readout gravity: the launch-read
    // transient is corrected at the read (arc_probe LAUNCH_VY_OFFSET_PX),
    // never as an acceleration (falsified — see propagateBallisticArrivalState).
    expect(state!.y).toBeCloseTo(50 + 3 + 0.5 * ELEVATION.GRAVITY_PX_PER_FRAME2 * 3 * 4);
    expect(state!.vy).toBeCloseTo(1 + ELEVATION.GRAVITY_PX_PER_FRAME2 * 3);
    expect(state!.sledPoseDeg).toBeCloseTo(26);
  });
});

describe("readiness state wrapper", () => {
  test("readinessCatchState delegates to the current speed/angle surface", () => {
    expect(readinessCatchState({ speed: 9, comAngleDeg: 10 })).toBeCloseTo(readinessCatch(9, 10));
  });

  test("readinessCatchState treats unknown velocity angle as unreadable", () => {
    expect(readinessCatchState({ speed: 9, comAngleDeg: null })).toBe(0);
  });
});
