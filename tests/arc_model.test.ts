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
  predictJointArcScoreReadout,
  predictLinearModel,
  propagateBallisticArrivalState,
  rotateArcLines,
  scaleArcLines,
  type RiderArrivalState,
} from "../scripts/v0/optimizer/arc_model.ts";
import {
  predictCatchability,
  predictCatchabilityForState,
} from "../scripts/v0/optimizer/catchability.ts";
import {
  BALLISTIC_POINT_IDS,
  type ConstraintBallisticState,
} from "../scripts/v0/core/ballistic_micro_sim.ts";

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

  test("scaleArcLines changes total arc length without changing its shape", () => {
    const out = scaleArcLines(lines, 1.5);
    expect(out[0].x1).toBeCloseTo(0);
    expect(out[0].x2).toBeCloseTo(15);
    expect(out[1].x1).toBeCloseTo(15);
    expect(out[2].x2).toBeCloseTo(45);
    expect(scaleArcLines(lines, 0)).toEqual([]);
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
    expect(state!.speed).toBeCloseTo(Math.hypot(9, 1));
    expect(state!.comAngleDeg).toBeCloseTo(Math.atan2(1, 9) * 180 / Math.PI);
  });

  test("full-mode outputs fit and predict an arrival for pitch3", () => {
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
    // pitch3 designs key onto the pitch_quadratic/pitch_linear ladder.
    expect(model.outputModels.get("next.speed")?.model.form).toBe("pitch_quadratic");
    const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
    expect(predictedCurrentAxes(outputs).air).toBeCloseTo(0.5 + 0.01 * 4);
    const state = predictedArrivalState(outputs);
    expect(state).not.toBeNull();
    expect(state!.x).toBeCloseTo(104);
    expect(state!.speed).toBeCloseTo(Math.hypot(9.4, 1.2));
    expect(state!.comAngleDeg).toBeCloseTo(
      Math.atan2(1.2, 9.4) * 180 / Math.PI,
    );
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

  test("short rows fit ballistic exit and terminal outputs for cross5 and pitch3", () => {
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
      const outputs = predictJointArcOutputs(model, { pitchDeg: 4, rotateDeg: 0 });
      // exit.frame is fitted, so the next_before_exit guard reads a real value.
      expect(outputs["exit.frame"]).toBeCloseTo(10, 6);
      expect(predictedCurrentAxes(outputs).air).toBeCloseTo(0.5 + 0.01 * 4, 6);
      const state = predictedArrivalState(outputs);
      expect(state).not.toBeNull();
      expect(state!.x).toBeCloseTo(104, 6);
      expect(state!.speed).toBeCloseTo(Math.hypot(9.4, 1.2), 6);
      expect(state!.comAngleDeg).toBeCloseTo(
        Math.atan2(1.2, 9.4) * 180 / Math.PI,
        6,
      );
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
    // The +8.5 row at −178° is unwrapped to 182° around the 175° baseline ref.
    expect(model.outputModels.get("next.comAngleDeg")?.angle).toBe(true);
    const base = predictJointArcOutputs(model, { pitchDeg: 0, rotateDeg: 0 });
    expect(base["exit.comAngleDeg"]).toBeCloseTo(175, 6);
    expect(base["next.comAngleDeg"]).toBeCloseTo(175, 6);
    // Predicting at the +8.5 knob recovers the unwrapped 182° branch.
    const high = predictJointArcOutputs(model, { pitchDeg: 8.5, rotateDeg: 0 });
    expect(high["next.comAngleDeg"]).toBeCloseTo(182, 6);
    expect(predictedArrivalState(base)?.comAngleDeg).toBeCloseTo(
      Math.atan2(1, 9) * 180 / Math.PI,
      6,
    );
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

  test("constraint propagation re-anchors so chained and combined calls agree", () => {
    const points = Object.fromEntries(BALLISTIC_POINT_IDS.map((id, index) => [
      id,
      {
        x: index * 1.7,
        y: index * 0.9,
        prevX: index * 1.7 - 2,
        prevY: index * 0.9 + 1,
        vx: 2,
        vy: -1,
      },
    ])) as ConstraintBallisticState["points"];
    const state: RiderArrivalState = {
      x: 1,
      y: 2,
      vx: 3,
      vy: 4,
      speed: 5,
      comAngleDeg: null,
      sledPoseDeg: 10,
      sledPoseRateDegPerFrame: 2,
      constraintState: {
        frameOffset: 3,
        points,
        riderMounted: true,
        sledIntact: true,
      },
    };
    const combined = propagateBallisticArrivalState(state, 15);
    const chained = propagateBallisticArrivalState(
      propagateBallisticArrivalState(state, 10),
      5,
    );

    for (const key of ["x", "y", "vx", "vy", "speed"] as const) {
      expect(chained[key]).toBeCloseTo(combined[key], 10);
    }
    expect(chained.sledPoseDeg).toBeCloseTo(combined.sledPoseDeg!);
    expect(chained.constraintState?.frameOffset).toBe(0);
  });

});

describe("catchability state wrapper", () => {
  test("state wrapper delegates to the current speed/angle surface", () => {
    expect(
      predictCatchabilityForState({ speed: 9, comAngleDeg: 10 }),
    ).toBeCloseTo(predictCatchability(9, 10));
  });

  test("state wrapper treats unknown velocity angle as unreadable", () => {
    expect(predictCatchabilityForState({ speed: 9, comAngleDeg: null })).toBe(0);
  });
});
