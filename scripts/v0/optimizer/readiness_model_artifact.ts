/**
 * Dependency-free validation and inference for exported readiness models.
 *
 * This module deliberately knows only the artifact's feature vector and
 * component names. Constructing those features and deciding how a component is
 * consumed remain outside this boundary.
 */

export const READINESS_MODEL_ARTIFACT_SCHEMA =
  "line.readiness-model.v3" as const;

export type ReadinessLinearModel = {
  family: "ridge" | "logistic";
  link: "identity_clip" | "sigmoid";
  mean: readonly number[];
  scale: readonly number[];
  coefficients: readonly number[];
  intercept: number;
};

export type ReadinessRegressionTree = {
  childrenLeft: readonly number[];
  childrenRight: readonly number[];
  feature: readonly number[];
  threshold: readonly number[];
  value: readonly number[];
};

export type ReadinessRegressionForestModel = {
  family: "extra_trees_regressor";
  link: "identity_clip";
  trees: readonly ReadinessRegressionTree[];
};

export type ReadinessHistogramTree = ReadinessRegressionTree & {
  isLeaf: readonly boolean[];
  missingGoToLeft: readonly boolean[];
};

export type ReadinessHistogramGradientBoostingModel = {
  family: "hist_gradient_boosting_regressor";
  link: "identity_clip";
  initialPrediction: number;
  trees: readonly ReadinessHistogramTree[];
};

export type ReadinessInferenceModel =
  | ReadinessLinearModel
  | ReadinessRegressionForestModel
  | ReadinessHistogramGradientBoostingModel;

export type ReadinessModelArtifact = {
  schema: typeof READINESS_MODEL_ARTIFACT_SCHEMA;
  generatorPolicyId: string;
  featureTransformId: string;
  targetSemanticsId: string;
  trainingCorpus: {
    schema: string;
    samplerFingerprint: string;
    contextSelectionArtifactFingerprint: string;
  };
  featureNames: readonly string[];
  components: Readonly<Record<string, ReadinessInferenceModel>>;
};

/**
 * Validate an untrusted JSON value and copy the inference-relevant fields into
 * a typed artifact. Unsupported versions and model families fail loudly.
 */
export function parseReadinessModelArtifact(
  input: unknown,
): ReadinessModelArtifact {
  const root = record(input, "$");
  if (root.schema !== READINESS_MODEL_ARTIFACT_SCHEMA) {
    invalid(
      "$.schema",
      `expected ${JSON.stringify(READINESS_MODEL_ARTIFACT_SCHEMA)}`,
    );
  }
  const generatorPolicyId = nonEmptyText(
    root.generatorPolicyId,
    "$.generatorPolicyId",
  );
  const featureTransformId = nonEmptyText(
    root.featureTransformId,
    "$.featureTransformId",
  );
  const targetSemanticsId = nonEmptyText(
    root.targetSemanticsId,
    "$.targetSemanticsId",
  );
  const rawTrainingCorpus = record(
    root.trainingCorpus,
    "$.trainingCorpus",
  );
  const trainingCorpus = {
    schema: nonEmptyText(
      rawTrainingCorpus.schema,
      "$.trainingCorpus.schema",
    ),
    samplerFingerprint: nonEmptyText(
      rawTrainingCorpus.samplerFingerprint,
      "$.trainingCorpus.samplerFingerprint",
    ),
    contextSelectionArtifactFingerprint: nonEmptyText(
      rawTrainingCorpus.contextSelectionArtifactFingerprint,
      "$.trainingCorpus.contextSelectionArtifactFingerprint",
    ),
  };

  const featureNames = stringArray(root.featureNames, "$.featureNames");
  if (featureNames.length === 0) {
    invalid("$.featureNames", "must not be empty");
  }
  if (new Set(featureNames).size !== featureNames.length) {
    invalid("$.featureNames", "must contain unique names");
  }

  const rawComponents = record(root.components, "$.components");
  const components: Record<string, ReadinessInferenceModel> = {};
  for (const [name, rawModel] of Object.entries(rawComponents)) {
    if (name.length === 0) invalid("$.components", "component names must not be empty");
    components[name] = parseModel(
      rawModel,
      featureNames.length,
      `$.components.${name}`,
    );
  }
  if (Object.keys(components).length === 0) {
    invalid("$.components", "must contain at least one component");
  }

  return {
    schema: READINESS_MODEL_ARTIFACT_SCHEMA,
    generatorPolicyId,
    featureTransformId,
    targetSemanticsId,
    trainingCorpus,
    featureNames,
    components,
  };
}

/**
 * Infer one named readiness component. Tree models accept non-finite feature
 * values as missing; standardized linear models require finite inputs.
 */
export function predictReadinessComponent(
  artifact: ReadinessModelArtifact,
  componentName: string,
  features: readonly number[],
): number {
  if (features.length !== artifact.featureNames.length) {
    throw new Error(
      `readiness feature dimension mismatch: expected ` +
        `${artifact.featureNames.length}, got ${features.length}`,
    );
  }
  const model = artifact.components[componentName];
  if (model === undefined) {
    throw new Error(`unknown readiness component ${JSON.stringify(componentName)}`);
  }

  let raw: number;
  if (model.family === "ridge" || model.family === "logistic") {
    raw = predictLinear(model, features);
  } else if (model.family === "extra_trees_regressor") {
    let sum = 0;
    for (const tree of model.trees) sum += predictTree(tree, features);
    raw = sum / model.trees.length;
  } else if (model.family === "hist_gradient_boosting_regressor") {
    raw = model.initialPrediction;
    for (const tree of model.trees) {
      raw += predictTree(tree, features);
      if (!Number.isFinite(raw)) {
        throw new Error("histogram gradient-boosted prediction overflowed");
      }
    }
  } else {
    throw new Error(`unsupported readiness model family`);
  }

  if (!Number.isFinite(raw)) {
    throw new Error(`readiness model produced a non-finite prediction`);
  }
  const linked = model.link === "sigmoid" ? sigmoid(raw) : raw;
  return Math.max(0, Math.min(1, linked));
}

function parseModel(
  input: unknown,
  featureCount: number,
  path: string,
): ReadinessInferenceModel {
  const value = record(input, path);
  const family = text(value.family, `${path}.family`);

  if (family === "ridge" || family === "logistic") {
    const expectedLink = family === "logistic" ? "sigmoid" : "identity_clip";
    if (value.link !== expectedLink) {
      invalid(`${path}.link`, `${family} requires ${expectedLink}`);
    }
    const mean = finiteArray(value.mean, `${path}.mean`);
    const scale = finiteArray(value.scale, `${path}.scale`);
    const coefficients = finiteArray(
      value.coefficients,
      `${path}.coefficients`,
    );
    for (const [name, values] of [
      ["mean", mean],
      ["scale", scale],
      ["coefficients", coefficients],
    ] as const) {
      if (values.length !== featureCount) {
        invalid(
          `${path}.${name}`,
          `expected ${featureCount} values, got ${values.length}`,
        );
      }
    }
    if (scale.some((entry) => entry <= 0)) {
      invalid(`${path}.scale`, "entries must be greater than zero");
    }
    return {
      family,
      link: expectedLink,
      mean,
      scale,
      coefficients,
      intercept: finiteNumber(value.intercept, `${path}.intercept`),
    };
  }

  if (family === "extra_trees_regressor") {
    if (value.link !== "identity_clip") {
      invalid(`${path}.link`, "extra_trees_regressor requires identity_clip");
    }
    const trees = nonEmptyArray(value.trees, `${path}.trees`).map(
      (tree, index) =>
        parseTree(tree, featureCount, `${path}.trees[${index}]`, false),
    );
    return {
      family: "extra_trees_regressor",
      link: "identity_clip",
      trees,
    };
  }

  if (family === "hist_gradient_boosting_regressor") {
    if (value.link !== "identity_clip") {
      invalid(
        `${path}.link`,
        "hist_gradient_boosting_regressor requires identity_clip",
      );
    }
    const trees = nonEmptyArray(value.trees, `${path}.trees`).map(
      (tree, index) =>
        parseTree(tree, featureCount, `${path}.trees[${index}]`, true),
    );
    return {
      family: "hist_gradient_boosting_regressor",
      link: "identity_clip",
      initialPrediction: finiteNumber(
        value.initialPrediction,
        `${path}.initialPrediction`,
      ),
      trees,
    };
  }

  invalid(path, `unsupported model family ${JSON.stringify(family)}`);
}

function parseTree(
  input: unknown,
  featureCount: number,
  path: string,
  histogram: false,
): ReadinessRegressionTree;
function parseTree(
  input: unknown,
  featureCount: number,
  path: string,
  histogram: true,
): ReadinessHistogramTree;
function parseTree(
  input: unknown,
  featureCount: number,
  path: string,
  histogram: boolean,
): ReadinessRegressionTree | ReadinessHistogramTree {
  const tree = record(input, path);
  const childrenLeft = integerArray(tree.childrenLeft, `${path}.childrenLeft`);
  const childrenRight = integerArray(
    tree.childrenRight,
    `${path}.childrenRight`,
  );
  const feature = integerArray(tree.feature, `${path}.feature`);
  const threshold = finiteArray(tree.threshold, `${path}.threshold`);
  const value = finiteArray(tree.value, `${path}.value`);
  const count = childrenLeft.length;
  if (count === 0) invalid(path, "tree must contain at least one node");
  for (const [name, entries] of [
    ["childrenRight", childrenRight],
    ["feature", feature],
    ["threshold", threshold],
    ["value", value],
  ] as const) {
    if (entries.length !== count) {
      invalid(
        `${path}.${name}`,
        `expected ${count} values, got ${entries.length}`,
      );
    }
  }

  const isLeaf = histogram
    ? booleanArray(tree.isLeaf, `${path}.isLeaf`)
    : childrenLeft.map((child) => child === -1);
  const missingGoToLeft = histogram
    ? booleanArray(tree.missingGoToLeft, `${path}.missingGoToLeft`)
    : undefined;
  if (isLeaf.length !== count) {
    invalid(`${path}.isLeaf`, `expected ${count} values, got ${isLeaf.length}`);
  }
  if (missingGoToLeft !== undefined && missingGoToLeft.length !== count) {
    invalid(
      `${path}.missingGoToLeft`,
      `expected ${count} values, got ${missingGoToLeft.length}`,
    );
  }

  const parentCount = Array<number>(count).fill(0);
  for (let index = 0; index < count; index++) {
    if (isLeaf[index]) {
      if (
        !histogram &&
        (childrenLeft[index] !== -1 || childrenRight[index] !== -1)
      ) {
        invalid(path, `ordinary leaf ${index} must have children -1/-1`);
      }
      continue;
    }
    const featureIndex = feature[index];
    if (featureIndex < 0 || featureIndex >= featureCount) {
      invalid(
        `${path}.feature[${index}]`,
        `must be in [0, ${featureCount - 1}]`,
      );
    }
    for (const [side, child] of [
      ["childrenLeft", childrenLeft[index]],
      ["childrenRight", childrenRight[index]],
    ] as const) {
      if (child < 0 || child >= count) {
        invalid(`${path}.${side}[${index}]`, `invalid child index ${child}`);
      }
      parentCount[child]++;
    }
  }
  if (parentCount[0] !== 0) invalid(path, "root node must not have a parent");
  for (let index = 1; index < count; index++) {
    if (parentCount[index] !== 1) {
      invalid(path, `node ${index} must have exactly one parent`);
    }
  }
  validateTreeReachability(childrenLeft, childrenRight, isLeaf, path);

  const base = { childrenLeft, childrenRight, feature, threshold, value };
  return histogram
    ? { ...base, isLeaf, missingGoToLeft: missingGoToLeft! }
    : base;
}

function validateTreeReachability(
  left: readonly number[],
  right: readonly number[],
  isLeaf: readonly boolean[],
  path: string,
): void {
  const seen = new Set<number>();
  const stack = [0];
  while (stack.length > 0) {
    const index = stack.pop()!;
    if (seen.has(index)) invalid(path, `tree contains a cycle at node ${index}`);
    seen.add(index);
    if (!isLeaf[index]) stack.push(right[index], left[index]);
  }
  if (seen.size !== left.length) {
    invalid(path, `tree contains ${left.length - seen.size} unreachable node(s)`);
  }
}

function predictLinear(
  model: ReadinessLinearModel,
  features: readonly number[],
): number {
  let result = model.intercept;
  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    if (!Number.isFinite(feature)) {
      throw new Error(
        `readiness linear feature ${index} must be finite`,
      );
    }
    result +=
      ((feature - model.mean[index]) / model.scale[index]) *
      model.coefficients[index];
  }
  return result;
}

function predictTree(
  tree: ReadinessRegressionTree | ReadinessHistogramTree,
  features: readonly number[],
): number {
  let index = 0;
  for (let steps = 0; steps <= tree.value.length; steps++) {
    const histogram = "isLeaf" in tree;
    const leaf = histogram ? tree.isLeaf[index] : tree.childrenLeft[index] === -1;
    if (leaf) return tree.value[index];
    const featureValue = features[tree.feature[index]];
    const goLeft = Number.isFinite(featureValue)
      ? featureValue <= tree.threshold[index]
      : histogram && tree.missingGoToLeft[index];
    index = goLeft ? tree.childrenLeft[index] : tree.childrenRight[index];
  }
  throw new Error(`readiness tree traversal did not reach a leaf`);
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) invalid(path, "expected an object");
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string") invalid(path, "expected a string");
  return value;
}

function nonEmptyText(value: unknown, path: string): string {
  const result = text(value, path);
  if (result.length === 0) invalid(path, "must not be empty");
  return result;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(path, "expected a finite number");
  }
  return value;
}

function nonEmptyArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(path, "expected a non-empty array");
  }
  return value;
}

function finiteArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value)) invalid(path, "expected an array");
  return value.map((entry, index) =>
    finiteNumber(entry, `${path}[${index}]`)
  );
}

function integerArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value)) invalid(path, "expected an array");
  return value.map((entry, index) => {
    if (typeof entry !== "number" || !Number.isSafeInteger(entry)) {
      invalid(`${path}[${index}]`, "expected a safe integer");
    }
    return entry;
  });
}

function booleanArray(value: unknown, path: string): boolean[] {
  if (!Array.isArray(value)) invalid(path, "expected an array");
  return value.map((entry, index) => {
    if (typeof entry !== "boolean") {
      invalid(`${path}[${index}]`, "expected a boolean");
    }
    return entry;
  });
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(path, "expected an array");
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      invalid(`${path}[${index}]`, "expected a non-empty string");
    }
    return entry;
  });
}

function invalid(path: string, reason: string): never {
  throw new Error(`invalid readiness model artifact at ${path}: ${reason}`);
}
