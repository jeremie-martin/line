/** Physical arrival and authored-future features; no case, seed or budget identity. */
export const ARC_VALUE_FEATURE_SCHEMA = 'line.arc-future-value-features.v1';
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

export function arcFutureValue(features: number[], artifact: any): number {
  if (artifact.featureSchema !== ARC_VALUE_FEATURE_SCHEMA || artifact.featureCount !== features.length ||
      features.some(v => !Number.isFinite(v))) throw new Error('arc future-value feature mismatch');
  let value = artifact.model.initial;
  for (const tree of artifact.model.trees) {
    let node = 0;
    while (!tree.leaf[node]) node = features[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    value += tree.value[node];
  }
  return Math.max(0, Math.expm1(value) / 100);
}
