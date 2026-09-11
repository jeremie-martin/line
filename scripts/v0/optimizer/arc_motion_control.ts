/** Control operations shared by learned proposals, local memory and search.
 * Omitted fields are intentional geometry choices, not missing numeric zeros. */
import type { ArcMotionControl } from './arc_geometry.ts';

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

const tolerance: Record<keyof ArcMotionControl, number> = {
    entry: 2, turn: 4, exit: 4, support: 1, bias: .3, offset: .2,
    clearance: 1, guideStart: .08, guideEnd: .08, turnFraction: .06,
    bend: 5, guideFlare: 2, exitBias: .3,
};


/** A neighborhood in authored control space, not a physical-equivalence claim.
 * Keep distinct expressive shapes available to the real-engine evaluator.
 * Conservatively distinguish omitted optional fields: their defaults can depend
 * on channel/wave settings and explicit guide endpoints have a length floor. */
export function arcControlsSimilar(a: ArcMotionControl, b: ArcMotionControl): boolean {
  return (Object.keys(tolerance) as Array<keyof ArcMotionControl>).every(key => {
    const x = a[key], y = b[key];
    return x === undefined || y === undefined ? x === y : Math.abs(x - y) < tolerance[key];
  });
}
