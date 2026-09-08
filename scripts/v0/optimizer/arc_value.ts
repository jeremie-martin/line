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
