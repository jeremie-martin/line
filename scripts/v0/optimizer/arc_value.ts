/** Physical arrival and authored-future features; no case, seed or budget identity. */
export const ARC_VALUE_FEATURE_SCHEMA = 'line.arc-future-value-features.v2';
export function arcArrivalFeatures(state: any, heading: number, speed: number, pose: number,
  angularRate: number, airborneFrames: number): number[] {
  const features = [Math.sin(heading * Math.PI / 180), Math.cos(heading * Math.PI / 180), speed / 10,
    Math.sin(pose * Math.PI / 180), Math.cos(pose * Math.PI / 180), angularRate, airborneFrames / 40];
  const anchor = state.points.PEG;
  for (const id of ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT']) {
    const point = state.points[id];
    features.push((point.x - anchor.x) / 24, (point.y - anchor.y) / 24, point.vx / 10, point.vy / 10);
  }
  return features;
}

/** Exact retrieval distance: arrival features weigh twice, relative point
 * state once, and authored future targets four times. Traverse these contiguous
 * feature groups in order so the floating-point sum stays unchanged. A bounded
 * query may return Infinity once the default metric exceeds maxDistance. */
export function arcFeatureDistance(a: readonly number[], b: readonly number[], weights?: readonly number[], maxDistance = Infinity): number {
  let sum = 0;
  if (weights) {
    for (let k = 0; k < a.length; k++) sum += (a[k] - b[k]) ** 2 * (weights[k] ?? (k >= 47 ? 4 : k < 7 ? 2 : 1));
    return sum;
  }
  let k = 0;
  for (const end = Math.min(7, a.length); k < end; k++) sum += (a[k] - b[k]) ** 2 * 2;
  if (sum > maxDistance) return Infinity;
  if (Number.isFinite(maxDistance)) {
    // These terms retain their original order while omitting nonnegative
    // point-state terms, so their sum is a conservative lower bound. Survivors
    // still compute the complete distance below in its original order.
    let bound = sum;
    for (let j = 47; j < a.length; j++) bound += (a[j] - b[j]) ** 2 * 4;
    if (bound > maxDistance) return Infinity;
  }
  for (const end = Math.min(47, a.length); k < end; k++) sum += (a[k] - b[k]) ** 2;
  if (sum > maxDistance) return Infinity;
  for (; k < a.length; k++) sum += (a[k] - b[k]) ** 2 * 4;
  return sum;
}

type ValueTree = {left: number[]; right: number[]; feature: number[]; threshold: number[]; value: number[]; leaf: boolean[]};
type ValueModel = {initial: number; trees: readonly ValueTree[]};

/** One contiguous forest: `split[n]` is a node's feature, or -1 at a leaf.
 * Children are absolute node indices. Prepared once per immutable model. */
function flattenForest(trees: readonly ValueTree[]) {
  const nodes = trees.reduce((n, tree) => n + tree.leaf.length, 0);
  const roots = new Int32Array(trees.length), split = new Int32Array(nodes), left = new Int32Array(nodes),
    right = new Int32Array(nodes), threshold = new Float64Array(nodes), value = new Float64Array(nodes);
  let base = 0;
  trees.forEach((tree, t) => {
    roots[t] = base;
    for (let n = 0; n < tree.leaf.length; n++) {
      const at = base + n;
      split[at] = tree.leaf[n] ? -1 : tree.feature[n];
      left[at] = base + tree.left[n]; right[at] = base + tree.right[n];
      threshold[at] = tree.threshold[n]; value[at] = tree.value[n];
    }
    base += tree.leaf.length;
  });
  return {roots, split, left, right, threshold, value};
}
const forests = new WeakMap<ValueModel, ReturnType<typeof flattenForest>>();

export function arcFutureValue(features: number[], artifact: any): number {
  // Features only grow at the end: a model reads the first `featureCount`, those it was trained on.
  let valid = artifact.featureSchema === ARC_VALUE_FEATURE_SCHEMA && artifact.featureCount <= features.length;
  for (let k = 0; valid && k < artifact.featureCount; k++) valid = Number.isFinite(features[k]);
  if (!valid) throw new Error('arc future-value feature mismatch');
  const model: ValueModel = artifact.model;
  let forest = forests.get(model);
  if (!forest) forests.set(model, forest = flattenForest(model.trees));
  const {roots, split, left, right, threshold, value: leaves} = forest;
  let value = model.initial;
  for (let t = 0; t < roots.length; t++) {
    let node = roots[t];
    for (let feature = split[node]; feature >= 0; feature = split[node])
      node = features[feature] <= threshold[node] ? left[node] : right[node];
    value += leaves[node];
  }
  return Math.max(0, Math.expm1(value) / 100);
}
