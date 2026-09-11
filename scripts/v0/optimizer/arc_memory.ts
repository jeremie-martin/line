/** Reuse measured controls and local responses as proposals, never as validation. */
import type { ArcMotionControl } from './arc_geometry.ts';
import {arcControlsSimilar, arcReferencedControl} from './arc_motion_control.ts';
import { arcResponseStep } from './arc_response.ts';

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

export type ArcControlExample = {
  features: number[]; incoming: number; span: number; control: ArcMotionControl;
};
export type ArcResponseExample = ArcControlExample & {
  targets: Array<number | undefined>; keys: Array<keyof ArcMotionControl>;
  jac: number[][]; residuals: number[]; scale: number[]; loss: number;
  /** Squared residual weights, when a caller varies them between intervals. */
  axisWeights?: number[];
};

export function arcControlSimilar(a: ArcMotionControl, b: ArcMotionControl): boolean {
  return Math.abs(a.turn - b.turn) < 4 && Math.abs(a.entry - b.entry) < 2 &&
    Math.abs(a.exit - b.exit) < 4 && Math.abs(a.support - b.support) < 1 &&
    (a.exitBias===undefined&&b.exitBias===undefined||Math.abs((a.exitBias??a.bias)-(b.exitBias??b.bias))<.3);
}

const distance = (a: number[], b: number[]) => a.reduce((sum, value, k) =>
  sum + (value - b[k]) ** 2 * (k >= 47 ? 4 : k < 7 ? 2 : 1), 0);
const adapted = arcReferencedControl;
const clamp = (value: number) => Math.max(-3, Math.min(3, value));

/** One instance belongs to one compile. Stored examples contain no live engines. */
export class ArcControlMemory {
  private readonly controls: ArcControlExample[] = [];
  private readonly responses: ArcResponseExample[] = [];

  rememberControl(example: ArcControlExample): void { this.controls.push(example); }

  rememberResponse(example: ArcResponseExample): void {
    this.responses.push(example);
    if (this.responses.length > 384) this.responses.shift();
  }

  proposeControls(features: number[], incoming: number, span: number, count: number, diversity: 'inherited' | 'geometry' = 'inherited'): ArcMotionControl[] {
    if (count <= 0) return [];
    const nearest = this.controls.map(m => ({m, distance: distance(m.features, features)}))
      .sort((a, b) => a.distance - b.distance);
    const selected: ArcMotionControl[] = [];
    for (const {m} of nearest) {
      const control = adapted(m, incoming, span);
      if (selected.some(p => diversity === 'geometry' ? arcControlsSimilar(control, p) : arcControlSimilar(control, p))) continue;
      selected.push(control);
      if (selected.length >= count) break;
    }
    return selected;
  }

  proposeResponses(features: number[], incoming: number, span: number,
    wanted: Array<number | undefined>, count: number,
    weights: {amplitude: number; impact: number; damping: number; axisWeights?: number[]}, diversity: 'inherited' | 'geometry' = 'inherited'): ArcMotionControl[] {
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
          return target===undefined||m.targets[j]===undefined||storedWeights[j]<=0?0:
            (r/Math.sqrt(storedWeights[j])+m.targets[j]!-target)*Math.sqrt(currentWeights[j]);
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
      if (selected.some(p => diversity === 'geometry' ? arcControlsSimilar(control, p) : arcControlSimilar(control, p))) continue;
      selected.push(control);
      if (selected.length >= count) break;
    }
    return selected;
  }
}
