/** Reuse measured controls and local responses as proposals, never as validation. */
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcResponseStep } from './arc_response.ts';

export type ArcControlExample = {
  features: number[]; incoming: number; span: number; control: ArcMotionControl;
};
export type ArcResponseExample = ArcControlExample & {
  targets: Array<number | undefined>; keys: Array<keyof ArcMotionControl>;
  jac: number[][]; residuals: number[]; scale: number[]; loss: number;
};

export function arcControlSimilar(a: ArcMotionControl, b: ArcMotionControl): boolean {
  return Math.abs(a.turn - b.turn) < 4 && Math.abs(a.entry - b.entry) < 2 &&
    Math.abs(a.exit - b.exit) < 4 && Math.abs(a.support - b.support) < 1;
}

const distance = (a: number[], b: number[]) => a.reduce((sum, value, k) =>
  sum + (value - b[k]) ** 2 * (k >= 47 ? 4 : k < 7 ? 2 : 1), 0);
const adapted = (m: ArcControlExample, incoming: number, span: number): ArcMotionControl =>
  ({...m.control, entry: incoming + m.control.entry - m.incoming,
    exit: incoming + m.control.exit - m.incoming, support: span * m.control.support / m.span});
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

  proposeControls(features: number[], incoming: number, span: number, count: number): ArcMotionControl[] {
    if (count <= 0) return [];
    const nearest = this.controls.map(m => ({m, distance: distance(m.features, features)}))
      .sort((a, b) => a.distance - b.distance);
    const selected: ArcMotionControl[] = [];
    for (const {m} of nearest) {
      const control = adapted(m, incoming, span);
      if (selected.some(p => arcControlSimilar(control, p))) continue;
      selected.push(control);
      if (selected.length >= count) break;
    }
    return selected;
  }

  proposeResponses(features: number[], incoming: number, span: number,
    wanted: Array<number | undefined>, count: number,
    weights: {amplitude: number; impact: number; damping: number}): ArcMotionControl[] {
    if (count <= 0) return [];
    const nearest = this.responses.map(m => ({m, distance: distance(m.features, features)}))
      .sort((a, b) => a.distance - b.distance || a.m.loss - b.m.loss);
    const selected: ArcMotionControl[] = [];
    for (const {m} of nearest) {
      const control = adapted(m, incoming, span);
      const residuals = m.residuals.map((r, j) => {
        const target = wanted[j];
        return target === undefined ? 0 : r + ((m.targets[j] ?? target) - target) *
          Math.sqrt(j === 2 ? weights.amplitude : j === 3 ? weights.impact : 1);
      });
      const delta = arcResponseStep(m.jac, residuals, weights.damping);
      if (!delta) continue;
      m.keys.forEach((key, d) => {
        control[key] = (control[key] as number) + m.scale[d] *
          (key === 'support' ? span / m.span : 1) * clamp(delta[d]);
      });
      if (selected.some(p => arcControlSimilar(control, p))) continue;
      selected.push(control);
      if (selected.length >= count) break;
    }
    return selected;
  }
}
