/** Reuse measured controls and local responses as proposals, never as validation. */
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcOrigins, tagOrigin } from './arc_origin.ts';
import type {ArcGeometryStyle} from './arc_geometry.ts';
import {arcControlsSimilar, arcReferencedControl, type ArcControlReference} from './arc_motion_control.ts';
import { arcResponseStep } from './arc_response.ts';
import {arcFeatureDistance as distance} from './arc_value.ts';

/** Largest-remainder apportionment keeps a short probe's proposal mix intact. */
export function allocateArcProposalSlots(requested: readonly number[], slots: number): number[] {
  if(!Number.isSafeInteger(slots)||slots<0||requested.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('invalid arc proposal allocation');
  const total=requested.reduce((a,b)=>a+b,0);
  if(total<=slots)return [...requested];
  const exact=requested.map(n=>slots*n/total),counts=exact.map(Math.floor);
  const order=exact.map((n,i)=>({i,fraction:n-counts[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  let remaining=slots-counts.reduce((a,b)=>a+b,0);
  for(const {i} of order){if(!remaining)break;if(counts[i]<requested[i]){counts[i]++;remaining--;}}
  return counts;
}

export type ArcControlExample = ArcControlReference & { features: readonly number[]; };
/** Only physically compatible constructors share demonstrations or responses. */
export function arcConstructionMemoryKey(style:ArcGeometryStyle&{subdivisions?:number}):string{
  const fields=[style.guides!==false,style.profile,style.profileStrength,style.profileStart,
    style.rippleCycles,style.faces,style.foldAngle,style.subdivisions,style.railLayout,style.independentGuide];
  if(style.alignedFoldEntry&&style.profile==='fold')fields.push(true);
  return JSON.stringify(fields);
}
export type ArcResponseExample = ArcControlExample & {
  targets: Array<number | undefined>; keys: Array<keyof ArcMotionControl>;
  jac: number[][]; residuals: number[]; scale: number[]; loss: number;
  /** Squared residual weights, when a caller varies them between intervals. */
  axisWeights?: number[];
};

/** Stable maximum heap of the retained example indices. Distances keep their original
 * summation order; insertion index breaks ties exactly as the stable sort did. */
function siftFarthest(order: Uint32Array, distances: Float64Array, root: number, length: number): void {
  const value = order[root], score = distances[value];
  for (let child = root * 2 + 1; child < length; child = root * 2 + 1) {
    if (child + 1 < length && (distances[order[child + 1]] - distances[order[child]] || order[child + 1] - order[child]) > 0) child++;
    if ((distances[order[child]] - score || order[child] - value) <= 0) break;
    order[root] = order[child]; root = child;
  }
  order[root] = value;
}
const adapted = arcReferencedControl;
const clamp = (value: number) => Math.max(-3, Math.min(3, value));

/** One instance belongs to one compile. Stored examples contain no live engines. */
export class ArcControlMemory {
  private readonly controls: ArcControlExample[];
  private readonly modelCount: number;
  private readonly modelWidth: number | undefined;
  private readonly responses: ArcResponseExample[] = [];
  private distances = new Float64Array(0);
  private nearest = new Uint32Array(0);

  /** Model rows are immutable demonstrations. Remembered local rows are read
   * afresh on every query; they need no index or maintenance after learning. */
  constructor(model: readonly ArcControlExample[] = []) {
    this.controls = [...model];
    this.modelCount = model.length;
    const width = model[0]?.features.length;
    this.modelWidth = width !== undefined && model.every(e => e.features.length === width && e.features.every(Number.isFinite)) ? width : undefined;
  }

  /** Independent study state, including locally learned examples. Query scratch
   * is rebuilt lazily; no private arrays need to escape for save/restore. */
  fork(): ArcControlMemory {
    const controls = structuredClone(this.controls);
    const copy = new ArcControlMemory(controls.slice(0, this.modelCount));
    copy.controls.push(...controls.slice(this.modelCount));
    copy.responses.push(...structuredClone(this.responses));
    return copy;
  }

  rememberControl(example: ArcControlExample): void { this.controls.push(example); }

  rememberResponse(example: ArcResponseExample): void {
    this.responses.push(example);
    if (this.responses.length > 384) this.responses.shift();
  }

  /** Exact neighborhoods expand only when adaptation/deduplication consumes
   * the whole first page. A partial distance above the farthest retained row
   * cannot enter that page; ties keep their original insertion order. */
  private *nearestControls(features: number[], requested: number): IterableIterator<ArcControlExample> {
    const size = this.controls.length;
    if (this.nearest.length < size) {
      const capacity = Math.max(size, this.nearest.length * 2);
      this.nearest = new Uint32Array(capacity);
      this.distances = new Float64Array(capacity);
    }
    const {nearest, distances, controls, modelCount, modelWidth} = this;
    let bounded = modelWidth !== undefined && features.length >= modelWidth && features.every(Number.isFinite);
    for (let i = modelCount; i < size; i++) {
      distances[i] = distance(controls[i].features, features);
      bounded &&= Number.isFinite(distances[i]);
    }
    if (!bounded) {
      // NaN subtraction is not a total order. Keep stable sort's behavior for
      // ragged/nonfinite inputs, and the small unseeded local-memory case.
      const ordered = controls.map((m, i) => ({i, distance: distance(m.features, features)})).sort((a, b) => a.distance - b.distance);
      for (const {i} of ordered) yield controls[i];
      return;
    }
    let yielded = 0, page = Math.min(size, Number.isFinite(requested) ? Math.max(32, Math.ceil(requested)) : size);
    while (yielded < size) {
      for (let i = 0; i < page; i++) {
        nearest[i] = i;
        if (i < modelCount) distances[i] = distance(controls[i].features, features);
      }
      for (let i = (page >>> 1) - 1; i >= 0; i--) siftFarthest(nearest, distances, i, page);
      for (let i = page; i < size; i++) {
        const farthest = nearest[0];
        if (i < modelCount) distances[i] = distance(controls[i].features, features, undefined, distances[farthest]);
        if ((distances[i] - distances[farthest] || i - farthest) >= 0) continue;
        nearest[0] = i;
        siftFarthest(nearest, distances, 0, page);
      }
      const ordered = Array.from(nearest.subarray(0, page)).sort((a, b) => distances[a] - distances[b] || a - b);
      for (; yielded < page; yielded++) yield controls[ordered[yielded]];
      page = Math.min(size, page * 2);
    }
  }

  proposeControls(features: number[], incoming: number, span: number, count: number, duration:'relative'|'both'='relative'): ArcMotionControl[] {
    if (count <= 0) return [];
    const selected: ArcMotionControl[] = [];
    for (const m of this.nearestControls(features, count)) {
      // A construction can keep its demonstrated duration while its following
      // flight grows. Offer both hypotheses; native evaluation decides.
      // Report-only label: a stored demonstration, or a control committed earlier in this ride.
      const source=arcOrigins.enabled?(this.controls.indexOf(m)<this.modelCount?'memory-archive':'memory-ride'):'';
      const proposals=[adapted(m,incoming,span),...(duration==='both'?[adapted(m,incoming,m.span)]:[])].map(c=>tagOrigin(c,source));
      for(const control of proposals){
        if (selected.some(p => arcControlsSimilar(control, p))) continue;
        selected.push(control);
        if (selected.length >= count) return selected;
      }
    }
    return selected;
  }

  proposeResponses(features: number[], incoming: number, span: number,
    wanted: Array<number | undefined>, count: number,
    weights: {amplitude: number; impact: number; damping: number; axisWeights?: number[]}): ArcMotionControl[] {
    if (count <= 0) return [];
    const nearest = this.responses.map(m => ({m, distance: distance(m.features, features)}))
      .sort((a, b) => a.distance - b.distance || a.m.loss - b.m.loss);
    const selected: ArcMotionControl[] = [];
    for (const {m} of nearest) {
      const control = adapted(m, incoming, span);
      const currentWeights=weights.axisWeights??[1,1,weights.amplitude,weights.impact];
      const storedWeights=m.axisWeights??[1,1,weights.amplitude,weights.impact];
      const residuals = m.residuals.map((r, j) => {
        const target = wanted[j];
        if(weights.axisWeights||m.axisWeights){
          if(target===undefined||m.targets[j]===undefined||storedWeights[j]<=0)return 0;
          // Equal weights already use the same units. Preserve their arithmetic
          // rather than introducing a needless divide/multiply round trip.
          if(storedWeights[j]===currentWeights[j])return r+(m.targets[j]!-target)*Math.sqrt(currentWeights[j]);
          return (r/Math.sqrt(storedWeights[j])+m.targets[j]!-target)*Math.sqrt(currentWeights[j]);
        }
        return target === undefined ? 0 : r + ((m.targets[j] ?? target) - target) *
          Math.sqrt(j === 2 ? weights.amplitude : j === 3 ? weights.impact : 1);
      });
      const jac=weights.axisWeights||m.axisWeights?m.jac.map((row,j)=>row.map(v=>wanted[j]===undefined||m.targets[j]===undefined||storedWeights[j]<=0?0:v*Math.sqrt(currentWeights[j]/storedWeights[j]))):m.jac;
      const delta = arcResponseStep(jac, residuals, weights.damping);
      if (!delta) continue;
      m.keys.forEach((key, d) => {
        control[key] = (control[key] as number) + m.scale[d] *
          (key === 'support' ? span / m.span : 1) * clamp(delta[d]);
      });
      if (selected.some(p => arcControlsSimilar(control, p))) continue;
      selected.push(control);
      if (selected.length >= count) break;
    }
    return selected;
  }
}
