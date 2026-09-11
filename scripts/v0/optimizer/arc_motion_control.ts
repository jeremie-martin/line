/** Control operations shared by learned proposals, local memory and search.
 * Omitted fields are intentional geometry choices, not missing numeric zeros. */
import { normalizeArcTurnFraction, type ArcMotionControl } from './arc_geometry.ts';

type ControlKey = keyof ArcMotionControl;
type Step = number | ((support: number) => number);
type SearchMethod = 'coordinate' | 'response' | 'newton' | 'repair';
export type ArcControlContext = {
  span: number; bidirectional?: boolean; channel?: number;
  preserveTurnTiming?: boolean; independentExit?: boolean; exitRefinementOnly?: boolean;
};
type ControlDefinition = {
  family: 'core' | 'guide' | 'expressive' | 'exit';
  min: number; max: number; tolerance: number;
  coordinate: Step; response?: Step; newton?: Step; repair?: Step;
  searchDefault?: (c: ArcMotionControl, channel?: number) => number;
  normalize?: (value: number, c: ArcMotionControl, context: ArcControlContext) => number;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Search contract for every authored control. Adding a geometry field requires
 * an entry here; memo identity and method key lists derive from this registry.
 * Search defaults intentionally do not materialize omitted geometry fields. */
export const ARC_CONTROL_DEFINITIONS: Readonly<Record<ControlKey, ControlDefinition>> = {
  entry: {family: 'core', min: -75, max: 85, tolerance: 2, coordinate: 3, response: 2, repair: 1},
  turn: {family: 'core', min: -120, max: 120, tolerance: 4, coordinate: 8, response: 5, repair: 3,
    normalize: (v, _c, context) => clamp(v, -120, context.bidirectional ? 120 : 15)},
  exit: {family: 'core', min: -80, max: 85, tolerance: 4, coordinate: 10, response: 6, repair: 3},
  support: {family: 'core', min: 2, max: Infinity, tolerance: 1,
    coordinate: s => Math.max(1, s * .18), response: s => Math.max(.6, s * .1),
    newton: s => Math.max(1, s * .1), repair: s => Math.max(.5, s * .06),
    normalize: (v, _c, context) => clamp(v, 2, Math.max(2, context.span - 4))},
  bias: {family: 'core', min: -2, max: 2, tolerance: .3, coordinate: .5, response: .25, repair: .2},
  offset: {family: 'core', min: -2, max: 3, tolerance: .2, coordinate: .4, response: .2, repair: .1},
  clearance: {family: 'guide', min: 6, max: 30, tolerance: 1, coordinate: 2, response: 1.5, repair: 1,
    searchDefault: (_c, channel) => channel ?? 12},
  guideStart: {family: 'guide', min: 0, max: 1, tolerance: .08, coordinate: .15},
  guideEnd: {family: 'guide', min: 0, max: 1, tolerance: .08, coordinate: .15, searchDefault: () => 1},
  turnFraction: {family: 'expressive', min: .1, max: .85, tolerance: .06, coordinate: .12, response: .08, repair: .06,
    searchDefault: c => Math.min(5, c.support * .5) / c.support,
    normalize: (v, c, context) => normalizeArcTurnFraction(v, c.support, context.preserveTurnTiming)},
  bend: {family: 'expressive', min: -60, max: 60, tolerance: 5, coordinate: 10, response: 7, repair: 5},
  guideFlare: {family: 'expressive', min: -16, max: 16, tolerance: 2, coordinate: 4, response: 2.5, repair: 2},
  exitBias: {family: 'exit', min: -3, max: 3, tolerance: .3, coordinate: .5, response: .4,
    searchDefault: c => c.bias},
};
export const ARC_CONTROL_KEYS = Object.keys(ARC_CONTROL_DEFINITIONS) as readonly ControlKey[];
export const ARC_CORE_KEYS = ARC_CONTROL_KEYS.filter(key => ARC_CONTROL_DEFINITIONS[key].family === 'core');
export const ARC_EXPRESSIVE_KEYS = ARC_CONTROL_KEYS.filter(key => ARC_CONTROL_DEFINITIONS[key].family === 'expressive');

export function normalizeArcControl(control: ArcMotionControl, context: ArcControlContext): ArcMotionControl {
  const c = {...control};
  for (const key of ARC_CONTROL_KEYS) {
    const definition = ARC_CONTROL_DEFINITIONS[key];
    // Independent probing must freeze late easing before changing entry bias.
    if (key === 'exitBias' && context.independentExit && !context.exitRefinementOnly && c[key] === undefined)
      c[key] = c.bias;
    const value = c[key];
    if (value === undefined && definition.family !== 'core') continue;
    c[key] = definition.normalize ? definition.normalize(value!, c, context) : clamp(value!, definition.min, definition.max);
  }
  return c;
}

/** All other geometry inputs are fixed by the surrounding evaluation context.
 * Absence and signed zero are significant. Only implicit clearance is exactly
 * equivalent to the fixed channel, even when the search default would be 12. */
export function arcControlMemoKey(c: ArcMotionControl, channel?: number): string {
  return JSON.stringify(ARC_CONTROL_KEYS.map(key => {
    const value = key === 'clearance' ? c.clearance ?? channel ?? 0 : c[key];
    return value === undefined ? 'absent' : Object.is(value, -0) ? '-0' : Number.isFinite(value) ? value : String(value);
  }));
}

export function arcControlValue(c: ArcMotionControl, key: ControlKey, channel?: number): number {
  return c[key] ?? ARC_CONTROL_DEFINITIONS[key].searchDefault?.(c, channel) ?? 0;
}

/** Construction steps use nominal support; repair steps use incumbent support. */
export function arcControlStep(key: ControlKey, method: SearchMethod, support: number): number {
  const definition = ARC_CONTROL_DEFINITIONS[key];
  const step = method === 'newton' ? definition.newton ?? definition.response : definition[method];
  if (step === undefined) throw new Error(`arc control ${key} has no ${method} step`);
  return typeof step === 'number' ? step : step(support);
}

export function arcMethodKeys(method: 'response' | 'repair', expressive: boolean, independentExit = false): ControlKey[] {
  return ARC_CONTROL_KEYS.filter(key => {
    const definition = ARC_CONTROL_DEFINITIONS[key];
    return definition[method] !== undefined && (definition.family !== 'expressive' || expressive) &&
      (definition.family !== 'exit' || independentExit);
  });
}

export type ArcControlReference = {control: ArcMotionControl; incoming: number; span: number};

/** Preserve demonstrated doubles and field absence at the original boundary. */
export function arcReferencedControl(reference: ArcControlReference, incoming: number, span: number): ArcMotionControl {
  if (!Number.isFinite(reference.incoming) || !Number.isFinite(reference.span) || reference.span <= 0)
    throw new Error('invalid arc control reference');
  const c = reference.control, angle = incoming - reference.incoming;
  return {...c, entry: angle === 0 ? c.entry : c.entry + angle,
    exit: angle === 0 ? c.exit : c.exit + angle,
    support: span === reference.span ? c.support : c.support * (span / reference.span)};
}

/** A neighborhood in authored control space, not a physical-equivalence claim.
 * Keep distinct expressive shapes available to the real-engine evaluator.
 * Conservatively distinguish omitted optional fields: their defaults can depend
 * on channel/wave settings and explicit guide endpoints have a length floor. */
export function arcControlsSimilar(a: ArcMotionControl, b: ArcMotionControl): boolean {
  return ARC_CONTROL_KEYS.every(key => {
    const x = a[key], y = b[key];
    return x === undefined || y === undefined ? x === y : Math.abs(x - y) < ARC_CONTROL_DEFINITIONS[key].tolerance;
  });
}
