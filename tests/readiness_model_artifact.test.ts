import { describe, expect, test } from "vitest";
import {
  parseReadinessModelArtifact,
  predictReadinessComponent,
  READINESS_MODEL_ARTIFACT_SCHEMA,
} from "../scripts/v0/optimizer/readiness_model_artifact.ts";
import {
  assertCompatibleReadinessArtifact,
  READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS,
  READINESS_TARGET_SEMANTICS_ID,
} from "../scripts/v0/optimizer/readiness_scoring.ts";
import runtimeModel from "../scripts/v0/optimizer/readiness_model.json" with {
  type: "json",
};
import aimImpactModel from "../scripts/v0/optimizer/aim_impact_model.json" with {
  type: "json",
};
import parityFixture from "./fixtures/readiness_model_parity.json" with {
  type: "json",
};

function artifact(
  component: Record<string, unknown>,
  featureNames = ["a", "b"],
): unknown {
  return {
    schema: READINESS_MODEL_ARTIFACT_SCHEMA,
    generatorPolicyId: "test-policy",
    featureTransformId: "test-features",
    targetSemanticsId: "test-targets",
    trainingCorpus: {
      schema: "test-corpus",
      samplerFingerprint: "test-fingerprint",
      contextSelectionArtifactFingerprint: "test-selection",
    },
    featureNames,
    components: { score: component },
  };
}

describe("readiness model artifact inference", () => {
  test("accepts the governed aim artifact only for its declared impact-only consumer", () => {
    const parsed = parseReadinessModelArtifact(aimImpactModel);
    expect(() => assertCompatibleReadinessArtifact(parsed)).toThrow(
      /missing catchability/,
    );
    expect(() =>
      assertCompatibleReadinessArtifact(parsed, {
        requiredComponents: ["impactFeasibility"],
      })
    ).not.toThrow();
    expect(aimImpactModel.distillation.exportParityMaxAbsoluteError).toBe(0);
    expect(aimImpactModel.components.impactFeasibility.trees).toHaveLength(32);
  });

  test("previous scorer semantics are legal only for context collection", () => {
    expect(runtimeModel.targetSemanticsId).toBe(
      READINESS_TARGET_SEMANTICS_ID,
    );
    const previous = parseReadinessModelArtifact({
      ...runtimeModel,
      targetSemanticsId:
        READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS[0],
    });

    expect(() => assertCompatibleReadinessArtifact(previous))
      .toThrow(/target semantics are stale/);
    expect(() =>
      assertCompatibleReadinessArtifact(previous, {
        allowTargetSemanticsIds:
          READINESS_CONTEXT_BOOTSTRAP_TARGET_SEMANTICS_IDS,
      })
    ).not.toThrow();
    expect(() => assertCompatibleReadinessArtifact(previous))
      .toThrow(/target semantics are stale/);
  });

  test("standardizes ridge features and clips the identity link", () => {
    const parsed = parseReadinessModelArtifact(artifact({
      family: "ridge",
      link: "identity_clip",
      mean: [1, 3],
      scale: [2, 4],
      coefficients: [0.25, 0.5],
      intercept: 0.1,
    }));

    expect(predictReadinessComponent(parsed, "score", [5, 1]))
      .toBeCloseTo(0.35, 12);
    expect(predictReadinessComponent(parsed, "score", [100, 100])).toBe(1);
    expect(predictReadinessComponent(parsed, "score", [-100, -100])).toBe(0);
  });

  test("applies a numerically stable sigmoid to logistic output", () => {
    const parsed = parseReadinessModelArtifact(artifact({
      family: "logistic",
      link: "sigmoid",
      mean: [0],
      scale: [2],
      coefficients: [4],
      intercept: 0,
    }, ["a"]));

    expect(predictReadinessComponent(parsed, "score", [1]))
      .toBeCloseTo(1 / (1 + Math.exp(-2)), 12);
    expect(predictReadinessComponent(parsed, "score", [1e6])).toBe(1);
    expect(predictReadinessComponent(parsed, "score", [-1e6])).toBe(0);
  });

  test("averages ordinary regression-tree predictions", () => {
    const parsed = parseReadinessModelArtifact(artifact({
      family: "extra_trees_regressor",
      link: "identity_clip",
      trees: [
        {
          childrenLeft: [1, -1, -1],
          childrenRight: [2, -1, -1],
          feature: [0, -2, -2],
          threshold: [0, -2, -2],
          value: [0, 0.2, 0.8],
        },
        {
          childrenLeft: [-1],
          childrenRight: [-1],
          feature: [-2],
          threshold: [-2],
          value: [0.4],
        },
      ],
    }));

    expect(predictReadinessComponent(parsed, "score", [-1, 0]))
      .toBeCloseTo(0.3, 12);
    expect(predictReadinessComponent(parsed, "score", [1, 0]))
      .toBeCloseTo(0.6, 12);
    // The Python exporter routes an absent ordinary-tree feature to the right.
    expect(predictReadinessComponent(parsed, "score", [Number.NaN, 0]))
      .toBeCloseTo(0.6, 12);
  });

  test("adds histogram trees to the baseline and honors missing direction", () => {
    const parsed = parseReadinessModelArtifact(artifact({
      family: "hist_gradient_boosting_regressor",
      link: "identity_clip",
      initialPrediction: 0.3,
      trees: [
        {
          childrenLeft: [1, 0, 0],
          childrenRight: [2, 0, 0],
          feature: [0, 0, 0],
          threshold: [0, 0, 0],
          value: [0, 0.1, 0.2],
          isLeaf: [false, true, true],
          missingGoToLeft: [true, false, false],
        },
        {
          childrenLeft: [0],
          childrenRight: [0],
          feature: [0],
          threshold: [0],
          value: [0.05],
          isLeaf: [true],
          missingGoToLeft: [false],
        },
      ],
    }));

    expect(predictReadinessComponent(parsed, "score", [-1, 0]))
      .toBeCloseTo(0.45, 12);
    expect(predictReadinessComponent(parsed, "score", [1, 0]))
      .toBeCloseTo(0.55, 12);
    expect(predictReadinessComponent(parsed, "score", [Number.NaN, 0]))
      .toBeCloseTo(0.45, 12);
  });

  test("rejects unsupported versions, families, and malformed dimensions", () => {
    expect(() => parseReadinessModelArtifact({
      schema: "line.readiness-model.v1",
      generatorPolicyId: "test-policy",
      featureTransformId: "test-features",
      targetSemanticsId: "test-targets",
      trainingCorpus: {
        schema: "test-corpus",
        samplerFingerprint: "test-fingerprint",
        contextSelectionArtifactFingerprint: "test-selection",
      },
      featureNames: ["a"],
      components: {},
    })).toThrow(/schema/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "current",
    }))).toThrow(/unsupported model family/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "ridge",
      link: "identity_clip",
      mean: [0],
      scale: [1, 1],
      coefficients: [1, 1],
      intercept: 0,
    }))).toThrow(/mean.*expected 2 values/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "ridge",
      link: "identity_clip",
      mean: [0, 0],
      scale: [1, 0],
      coefficients: [1, 1],
      intercept: 0,
    }))).toThrow(/scale.*greater than zero/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "logistic",
      link: "sigmoid",
      mean: [0, 0],
      scale: [1, 1],
      coefficients: [1, Number.NaN],
      intercept: 0,
    }))).toThrow(/coefficients\[1\].*finite number/);
  });

  test("rejects malformed tree topology and histogram flags", () => {
    expect(() => parseReadinessModelArtifact(artifact({
      family: "extra_trees_regressor",
      link: "identity_clip",
      trees: [{
        childrenLeft: [1, -1],
        childrenRight: [3, -1],
        feature: [0, -2],
        threshold: [0, -2],
        value: [0, 1],
      }],
    }))).toThrow(/invalid child index 3/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "extra_trees_regressor",
      link: "identity_clip",
      trees: [{
        childrenLeft: [1, -1, -1],
        childrenRight: [1, -1, -1],
        feature: [0, -2, -2],
        threshold: [0, -2, -2],
        value: [0, 1, 2],
      }],
    }))).toThrow(/node 1 must have exactly one parent/);

    expect(() => parseReadinessModelArtifact(artifact({
      family: "hist_gradient_boosting_regressor",
      link: "identity_clip",
      initialPrediction: 0,
      trees: [{
        childrenLeft: [0],
        childrenRight: [0],
        feature: [0],
        threshold: [0],
        value: [0],
        isLeaf: [true],
        missingGoToLeft: [],
      }],
    }))).toThrow(/missingGoToLeft.*expected 1 values/);
  });

  test("fails loudly on inference contract violations", () => {
    const parsed = parseReadinessModelArtifact(artifact({
      family: "ridge",
      link: "identity_clip",
      mean: [0, 0],
      scale: [1, 1],
      coefficients: [1, 1],
      intercept: 0,
    }));

    expect(() => predictReadinessComponent(parsed, "missing", [0, 0]))
      .toThrow(/unknown readiness component/);
    expect(() => predictReadinessComponent(parsed, "score", [0]))
      .toThrow(/dimension mismatch/);
    expect(() =>
      predictReadinessComponent(parsed, "score", [Number.NaN, 0])
    ).toThrow(/feature 0 must be finite/);
  });

  test("matches the pinned Python exporter on the real selected models", () => {
    const parsed = parseReadinessModelArtifact(runtimeModel);
    expect(parityFixture.featureNames).toEqual(parsed.featureNames);
    for (
      const [component, fixture] of Object.entries(
        parityFixture.components,
      )
    ) {
      let maxAbsoluteError = 0;
      for (let index = 0; index < fixture.features.length; index++) {
        const actual = predictReadinessComponent(
          parsed,
          component,
          fixture.features[index],
        );
        maxAbsoluteError = Math.max(
          maxAbsoluteError,
          Math.abs(actual - fixture.expected[index]),
        );
      }
      expect(maxAbsoluteError).toBeLessThanOrEqual(fixture.tolerance);
    }
  });
});
