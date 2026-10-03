/** Local refinement around the best measured curve of an interval search:
 * coordinate steps on the core controls, a broad-then-coordinate search over
 * guide and shape controls, and damped finite-difference response steps.
 * Every step is an ordinary measured evaluation. */
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcResponseStep } from './arc_response.ts';
import { ARC_CORE_KEYS, ARC_EXPRESSIVE_KEYS, arcControlValue, arcControlStep, arcMethodKeys, arcControlActive } from './arc_motion_control.ts';
import { evaluate } from './arc_evaluate.ts';
import { retainSearch, type IntervalSearch } from './arc_interval_state.ts';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
type ControlKey = keyof ArcMotionControl;

/** Alternating signed steps on each core control, shrinking every two rounds,
 * until the interval's sample allowance is used. */
export function coordinateSearch(s: IntervalSearch) {
  if (!s.best) return;
  const {options, initial, max, support} = s;
  const keys = ARC_CORE_KEYS;
  for (let k = initial; k < max; k++) {
    const key = keys[Math.floor((k - initial) / 2) % keys.length], round = Math.floor((k - initial) / (2 * keys.length)), sign = k % 2 === 0 ? -1 : 1;
    const best = s.best;
    const candidate = {...best.c, [key]: best.c[key] + sign * arcControlStep(key, 'coordinate', options.constructionProposals ? best.c.support : support) *
      Math.pow(.65, Math.floor(round / 2))};
    evaluate(s, candidate);
    if (k % 10 === 9) retainSearch(s);
  }
}

/** Guide and shape search, then response steps, within the guidance
 * allowance. Response rounds take their share first; coordinate exploration
 * receives the remainder. */
export function guidanceSearch(s: IntervalSearch) {
  const {options} = s;
  if (!s.best || !options.guidance) return;
  const origin = s.best;
  const receiverActive = options.observedReceiver && origin.c.receiverFlight !== undefined;
  const irrelevantGuide = new Set(['clearance', 'guideStart', 'guideEnd', 'guideTilt', 'guideFlare']);
  const responseKeys = arcMethodKeys('response', !!options.expressive, false, options.guides,
    {...options, observedReceiver: receiverActive}).filter(key => !receiverActive || !irrelevantGuide.has(key));
  const wantedResponse = Math.min(options.guidanceSamples ?? 48, options.responseSamples ?? 0);
  const responseRound = 2 * responseKeys.length + 3;
  const responseAllowance = options.completeGuidanceBudget
    ? Math.floor(wantedResponse / responseRound) * responseRound : wantedResponse >= responseRound ? wantedResponse : 0;
  const count = (options.guidanceSamples ?? 48) - responseAllowance;
  let keys: ControlKey[] = options.guidance === 'span' ? ['guideStart', 'guideEnd'] :
    options.guidance === 'clearance' ? ['clearance'] : ['clearance', 'guideStart', 'guideEnd'];
  if (options.guidanceJoint) keys.push(...ARC_CORE_KEYS);
  if (options.expressive) keys.push(...ARC_EXPRESSIVE_KEYS);
  if (options.independentGuide) keys.push('guideTilt');
  if (options.observedReceiver && origin.c.receiverFlight !== undefined)
    keys.push('receiverFlight', 'receiverEntry', 'receiverTurn', 'receiverExit', 'receiverDuration');
  keys = keys.filter(key => arcControlActive(key, options.guides, options));
  if (receiverActive) keys = keys.filter(key => !irrelevantGuide.has(key));
  guideShapeSearch(s, origin, keys, count);
  responseSearch(s, responseKeys, responseAllowance);
}

/** A broad low-discrepancy sweep of guide and expressive controls around
 * `origin`, followed by coordinate steps around the current best. */
function guideShapeSearch(s: IntervalSearch, origin: any, keys: ControlKey[], count: number) {
  const {options, support} = s;
  const broad = options.guidanceJoint ? Math.min(24, Math.ceil(count / 3)) : count / 2;
  for (let k = 0; keys.length && k < count; k++) {
    const frac = (n: number) => ((k + 1) * n) % 1;
    let c: ArcMotionControl;
    if (k < broad) {
      c = {...origin.c};
      if (options.guidance !== 'span') c.clearance = k === 0 ? 12 : 8 + 16 * frac(.61803398875);
      if (options.expressive && k > 0) {
        c.turnFraction = .15 + .65 * frac(.2718281828);
        c.bend = -35 + 70 * frac(.1415926535);
        c.guideFlare = -12 + 24 * frac(.5772156649);
      }
      if (options.independentGuide && k > 0) c.guideTilt = -15 + 30 * frac(.9159655941);
      if (options.railLayout === 'transfer' && k > 0) c.mainEnd = .3 + .6 * frac(.6931471806);
      if (options.guidance !== 'clearance') {
        c.guideStart = k % 3 === 0 ? 0 : frac(.41421356237) * .7;
        c.guideEnd = k === 0 ? 0 : k % 3 === 1 ? 1 : Math.max(c.guideStart, frac(.73205080757));
      }
    } else {
      const best = s.best;
      const key = keys[Math.floor(k / 2) % keys.length];
      const step = arcControlStep(key, 'coordinate', options.constructionProposals ? best.c.support : support);
      c = {...best.c, [key]: arcControlValue(best.c, key, options.channel) +
        (k % 2 === 0 ? -1 : 1) * step * Math.pow(.6, Math.floor((k - broad) / (keys.length * 4)))};
    }
    evaluate(s, c);
    if (k % 8 === 7) retainSearch(s);
  }
}

/** Central finite differences on `responseKeys` around the current best,
 * then a damped Gauss-Newton step tried at full, half and quarter length.
 * The trust radius halves after a round that does not improve. Measured
 * responses are remembered for later intervals. */
function responseSearch(s: IntervalSearch, responseKeys: ControlKey[], responseAllowance: number) {
  const {options, support, controlMemory, targets, impact, incoming, span} = s;
  let responseUsed = 0, trust = 1;
  while (responseUsed + 2 * responseKeys.length + 3 <= responseAllowance) {
    const origin = s.best;
    const scale = (key: ControlKey) => arcControlStep(key, 'response', options.constructionProposals ? origin.c.support : support);
    const value = (key: ControlKey) => arcControlValue(origin.c, key, options.channel);
    const jac = origin.residuals.map(() => Array(responseKeys.length).fill(0));
    responseKeys.forEach((key, d) => {
      const step = scale(key) * trust;
      const a = evaluate(s, {...origin.c, [key]: value(key) + step}), b = evaluate(s, {...origin.c, [key]: value(key) - step});
      responseUsed += 2;
      for (let r = 0; r < jac.length; r++)
        jac[r][d] = a && b ? (a.residuals[r] - b.residuals[r]) / 2 : a ? a.residuals[r] - origin.residuals[r] : b ? origin.residuals[r] - b.residuals[r] : 0;
    });
    if ((options.memoryResponseSamples ?? 0) > 0) {
      controlMemory.rememberResponse({features: s.inputFeatures, incoming, span,
        control: {...origin.c, ...Object.fromEntries(responseKeys.map(key => [key, value(key)]))},
        targets: [targets.air, targets.speed, targets.amplitude, impact], keys: responseKeys.slice(),
        jac: jac.slice(0, 4), residuals: origin.residuals.slice(0, 4),
        axisWeights: s.responseAxisWeights,
        scale: responseKeys.map(key => scale(key) * trust),
        loss: origin.residuals.slice(0, 4).reduce((sum: number, v: number) => sum + v * v, 0)});
    }
    const delta = arcResponseStep(jac, origin.residuals, .0002);
    for (const fraction of [1, .5, .25]) {
      if (delta) {
        const c = {...origin.c};
        responseKeys.forEach((key, d) => c[key] = value(key) + fraction * scale(key) * trust * clamp(delta[d], -3, 3));
        evaluate(s, c);
      }
      responseUsed++;
    }
    const improving = s.best.optimizationCost < origin.optimizationCost - 1e-12;
    if (!improving) trust *= .5;
    retainSearch(s);
  }
}
