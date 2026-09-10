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
  if(artifact.residualBase){
    const strength=artifact.residualStrength??1;
    if(!Number.isFinite(strength)||strength<0||strength>1||artifact.residualInput!=='features-plus-log1p-base')throw new Error('invalid arc future-value correction');
    const base=arcFutureValue(features,artifact.residualBase);if(strength===0)return base;
    const input=[...features,Math.log1p(100*base)],model=artifact.residualModel;
    let correction=model.initial;
    for(const tree of model.trees){
      let node=0;
      while(!tree.leaf[node])node=input[tree.feature[node]]<=tree.threshold[node]?tree.left[node]:tree.right[node];
      correction+=tree.value[node];
    }
    return Math.max(0,Math.expm1(Math.log1p(100*base)+strength*correction)/100);
  }
  let value = artifact.model.initial;
  for (const tree of artifact.model.trees) {
    let node = 0;
    while (!tree.leaf[node]) node = features[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    value += tree.value[node];
  }
  return Math.max(0, Math.expm1(value) / 100);
}

/** Guide local geometry refinement with the same future estimate used to rank
 * arrivals. Keep physical span residuals intact and blend only the arrival prior.
 * This is an optional search objective, never a reported track measurement. */
export function arcValueGuidance(cost:number,localCost:number,residuals:number[],priorStart:number,
  predictedFuture:number|undefined,weight:number){
  if(!Number.isFinite(weight)||weight<0||weight>1)throw new Error('invalid arc value guidance weight');
  if(!weight||predictedFuture===undefined)return {cost,residuals};
  const guided=residuals.map((r,i)=>i<priorStart?r:r*Math.sqrt(1-weight));
  guided.push(Math.sqrt(weight*predictedFuture));
  return {cost:cost+weight*(localCost+predictedFuture-cost),residuals:guided};
}
