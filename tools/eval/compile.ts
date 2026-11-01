/** One evaluation compile: the compiler at `root` (this checkout, or a
 * worktree of another commit) compiles one resolved case; the measurement
 * code of this checkout measures it. Shared by `eval` and `compare`. */
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {measureCell, geometryFacts} from './measure.ts';
import type {PlannedCase} from './records.ts';

export const CONTRACTS = {landing: undefined, strike: 'line.strike.v1', strike2: 'line.strike.v2', strike3: 'line.strike.v3'} as const;
export type ArmSettings = {mode: string; budget: string; creative?: Record<string, unknown>};

/** The allowance of one ride: standard is the production allowance for its
 * length, standard*F scales it (a budget study), N is a fixed allowance. */
export function allowanceFor(budget: string, duration: number, productionBudget: (seconds: number) => number) {
  return budget === 'standard' ? productionBudget(duration)
    : budget.startsWith('standard*') ? Math.round(productionBudget(duration) * Number(budget.slice(9))) : Number(budget);
}

export async function compileAndMeasure(root: string, c: PlannedCase, resolved: {spec: any; music: any}, settings: ArmSettings) {
  const {compileHandoff} = await import(pathToFileURL(join(root, 'scripts/v0/optimizer/handoff.ts')).href);
  const {productionBudget} = await import(pathToFileURL(join(root, 'scripts/v0/optimizer/production_budget.ts')).href);
  const {spec, music} = resolved, budget = allowanceFor(settings.budget, spec.duration, productionBudget), began = performance.now();
  const cp = compileHandoff(spec, c.seed, {budget, creative: settings.creative ?? {}, impactContract: CONTRACTS[settings.mode as keyof typeof CONTRACTS],
    phraseBoundaries: music.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter(Number.isFinite)});
  const compileMs = performance.now() - began, r = cp.repertoire!;
  const cell = measureCell({c, mode: settings.mode, track: cp.track, spec, music, physicalFrames: r.physicalFrames,
    compileMs, complete: r.valid, fulfilled: r.qualified, motion: r.motion.full, geometry: geometryFacts(r)});
  return {cell, track: cp.track};
}
