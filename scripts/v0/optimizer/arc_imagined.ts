/** Imagined proposals (experiment, branch exp/imagined-proposals): in place of the archive's
 * lookups, each later interval generates N controls per contact side from plain per-family
 * ranges (imagined_generator.json: a typical move per situation cell and each parameter's
 * observed range, varying together through a correlation factor; no stored move), predicts
 * what each would do with a small forward model (imagined_model.json: strength, next arrival
 * heading and speed, air and speed residuals, failure log-odds; trained on training songs only),
 * and offers the most promising distinct ones. Native physics still measures every offer. */
import {readFileSync} from 'node:fs';
import type {ArcMotionControl} from './arc_geometry.ts';
import {arcControlsSimilar} from './arc_motion_control.ts';
import {arcConstructionMemoryKey} from './arc_memory.ts';
import {steepArrival} from './arc_evaluate.ts';
import {authoredSpeedToPx, impactToRawPx} from '../types.ts';
import type {IntervalSearch} from './arc_interval_state.ts';

/** Controls generated per contact side, before the model ranks them. */
export const IMAGINED_PER_SIDE = 512;
const FAILURE_WEIGHT = 4;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const deg = (x: number) => x * 180 / Math.PI;
const frac = (x: number) => x - Math.floor(x);
const STRIDES = [0.6180339887, 0.4142135624, 0.7320508076, 0.2360679775, 0.6457513111, 0.3166247903, 0.5677643628, 0.7416573868, 0.1622776602,
  0.3588989435, 0.4721359550, 0.8284271247, 0.1231056256, 0.6055512755, 0.4772255751, 0.2915026221, 0.3851648071, 0.9282032303, 0.6904157598];

type Model = {inputs: string[]; outputs: string[]; x_mean: number[]; x_std: number[]; y_mean: number[]; y_std: number[]; layers: {W: number[][]; b: number[]}[]};
let loaded: {model: Model; generator: any} | undefined;
const load = (): {model: Model; generator: any} => loaded ??= {
  model: JSON.parse(readFileSync(new URL('./imagined_model.json', import.meta.url), 'utf8')),
  generator: JSON.parse(readFileSync(new URL('./imagined_generator.json', import.meta.url), 'utf8')),
};

/** Up to `count` distinct proposals for interval search `s` (sections after the first). */
export function imaginedProposals(s: IntervalSearch, count: number): ArcMotionControl[] {
  const {model, generator} = load(), {options, i, incoming, span, targets} = s;
  const cat = generator.groups[arcConstructionMemoryKey(options)];
  if (!cat || count <= 0) return [];
  const features = s.inputFeatures, request = options.constructionRequests?.[i];
  // The typical move of this situation: bilinear in the requested strength and the arrival heading.
  const cell = (axis: number[], x: number) => {
    const v = clamp(x, axis[0], axis.at(-1)!); let k = 0;
    while (k < axis.length - 2 && v > axis[k + 1]) k++;
    return [k, (v - axis[k]) / (axis[k + 1] - axis[k])];
  };
  const [a, u] = cell(cat.ask, Math.max(0, features[48])), [h, v] = cell(cat.heading, deg(Math.atan2(features[0], features[1]))), n = cat.heading.length;
  const at = (t: any[], o: number) => (1 - u) * (1 - v) * t[a * n + h][o] + (1 - u) * v * t[a * n + h + 1][o] + u * (1 - v) * t[(a + 1) * n + h][o] + u * v * t[(a + 1) * n + h + 1][o];
  // The situation part of the model's first layer is shared by every candidate of this interval.
  const situation: Record<string, number> = {pace: s.pace, span: span / 40, gap: (s.next - 1 - s.frame) / 40,
    t_air: targets.air ?? 0, t_speed: targets.speed ?? 0, t_amp: targets.amplitude ?? 0, has_amp: targets.amplitude === undefined ? 0 : 1};
  features.forEach((x, j) => { situation[`f${j}`] = x; });
  for (const name of model.inputs) {
    if (name.startsWith('fam_')) situation[name] = request?.construction === name.slice(4) ? 1 : 0;
    if (name.startsWith('guid_')) situation[name] = request?.guidance === name.slice(5) ? 1 : 0;
  }
  const first = model.layers[0], control = model.inputs.map((name, k) => [name, k] as const).filter(([name]) => !(name in situation));
  const base = first.b.map((b, j) => model.inputs.reduce((sum, name, k) => name in situation
    ? sum + first.W[j][k] * (situation[name] - model.x_mean[k]) / model.x_std[k] : sum, b));
  const predict = (c: ArcMotionControl) => {
    const value = (name: string): number => {
      if (name === 'entry') return c.entry - incoming;
      if (name === 'exit') return c.exit - incoming;
      if (name === 'turn') return c.turn;
      if (name === 'support') return c.support / span;
      if (name === 'side') return c.contactSide ?? 1;
      if (name.startsWith('o_')) return (c as any)[name.slice(2)] ?? 0;
      return (c as any)[name.slice(4)] === undefined ? 0 : 1;   // has_<field>
    };
    const xs = control.map(([name, k]) => (value(name) - model.x_mean[k]) / model.x_std[k]);
    let hidden = base.map((z, j) => Math.tanh(control.reduce((sum, [, k], m) => sum + first.W[j][k] * xs[m], z)));
    model.layers.slice(1).forEach(({W, b}, L) => {
      const z = W.map((row, j) => row.reduce((sum, w, k) => sum + w * hidden[k], b[j]));
      hidden = L < model.layers.length - 2 ? z.map(Math.tanh) : z;
    });
    return hidden.map((y, j) => y * model.y_std[j] + model.y_mean[j]);
  };
  const objective = (p: number[]) => (s.impact === undefined ? 0 : (options.impactWeight ?? 2) * (p[0] - s.impact) ** 2)
    + (targets.air === undefined ? 0 : p[3] ** 2) + (targets.speed === undefined ? 0 : p[4] ** 2)
    + arrivalPrior(s, p[1], p[2]) + FAILURE_WEIGHT / (1 + Math.exp(-p[5]));
  // Generate: an evenly spread sequence per parameter, offset by the interval's frame (deterministic).
  const pool: {c: ArcMotionControl; cost: number}[] = [];
  for (const side of Object.keys(cat.generator.ranges).map(Number)) {
    const ranges = cat.generator.ranges[String(side)], names = Object.keys(ranges), factor = cat.generator.factor?.[String(side)], cores = cat.cores[String(side)];
    if (!cores) continue;
    const core = [0, 1, 2].map(o => at(cores, o));
    for (let k = 0; k < IMAGINED_PER_SIDE; k++) {
      const index = k + s.frame;
      let us = names.map((_, d) => frac((index + .5) * STRIDES[d % STRIDES.length] + d * .137));
      if (factor) {
        const z = us.map(x => normalQuantile(clamp(x, 1e-9, 1 - 1e-9))), y = names.map(() => 0);
        let f = 0; for (let p = 0; p < names.length; p++) for (let q = 0; q <= p; q++) y[p] += factor[f++] * z[q];
        us = y.map(normalCdf);
      }
      const value: Record<string, number> = {};
      names.forEach((name, d) => { const qs = ranges[name], x = us[d] * (qs.length - 1), j = Math.min(qs.length - 2, Math.floor(x)); value[name] = qs[j] + (x - j) * (qs[j + 1] - qs[j]); });
      const {dEntry, dTurn, dExit, support, ...free} = value;
      const c = {...free, ...(side === -1 ? {contactSide: -1} : {}), entry: incoming + core[0] + dEntry, turn: core[1] + dTurn,
        exit: incoming + core[2] + dExit, support: span * support} as ArcMotionControl;
      pool.push({c, cost: objective(predict(s.normalizeControl(c)))});
    }
  }
  // Keep the most promising, distinct.
  const selected: ArcMotionControl[] = [];
  for (const {c} of pool.map((x, k) => ({...x, k})).sort((x, y) => x.cost - y.cost || x.k - y.k)) {
    if (selected.some(p => arcControlsSimilar(c, p))) continue;
    selected.push(c);
    if (selected.length >= count) break;
  }
  return selected;
}

/** The compiler's arrival priors toward the next catch (arc_evaluate.ts addArrivalPriors), without the upright term. */
function arrivalPrior(s: IntervalSearch, heading: number, speed: number) {
  const {ctx, options, i, targets} = s, {contacts, gaps, planned} = ctx;
  if (i >= contacts.length - 1) return 0;
  const nextImpact = gaps[contacts[i + 1].gap].targets.impact ?? 0, steep = steepArrival(nextImpact, options.impactSearch);
  let cost = 0;
  if ((options.arrivalWeight ?? 0) > 0) {
    const nextSpeed = authoredSpeedToPx(planned[contacts[i + 1].gap + 1]?.targets.speed ?? targets.speed ?? .55);
    const kinetic = options.passiveArrival && options.constructionRequests?.[i + 1]?.guidance === 'forbidden' ? 1 : steep;
    const impulse = impactToRawPx(nextImpact), arrivalSpeed = (1 - kinetic) * nextSpeed + kinetic * Math.hypot(nextSpeed, impulse);
    const desired = clamp(15 + deg((1 - kinetic) * (impulse / nextSpeed) + kinetic * Math.atan2(impulse, nextSpeed)), 20, 70);
    const angled = options.passiveArrival ? 1 : steep;
    cost += options.arrivalWeight! * (angled * ((heading - desired) / 45) ** 2 + ((speed - arrivalSpeed) / 7.2) ** 2);
  }
  if ((options.headingWeight ?? 0) > 0 && steep < 1) cost += options.headingWeight! * (1 - steep) * (Math.max(0, Math.abs(heading - 15) - 30) / 30) ** 2;
  return cost;
}

/** Standard normal distribution function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
function normalCdf(x: number): number {
  const t = 1 / (1 + .3275911 * Math.abs(x) / Math.SQRT2), e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + e) / 2 : (1 - e) / 2;
}
/** Its inverse (Acklam's rational approximation, relative error below 1.2e-9). */
function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-.007784894002430293, -.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [.007784695709041462, .3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < .02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - .02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - .5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
