/** One evaluation compile: the compiler at `root` (this checkout, or a
 * worktree of another commit) compiles one resolved case; the measurement
 * code of this checkout measures it. Shared by `eval` and `compare`. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {measureCell, geometryFacts} from './measure.ts';
import type {PlannedCase} from './records.ts';

/** This adapter turns a resolved case into compile options (allowance, phrase
 * boundaries, explicit plans), so it is part of what a saved ride depends on:
 * its bytes enter every arm's identity (arms.ts). */
export const ADAPTER_SHA256 = createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex');
export type ArmSettings = {budget: string; creative?: Record<string, unknown>};

/** The allowance of one ride: standard is the production allowance for its
 * length, standard*F scales it (a budget study), N is a fixed allowance. */
export function allowanceFor(budget: string, duration: number, productionBudget: (seconds: number) => number) {
  return budget === 'standard' ? productionBudget(duration)
    : budget.startsWith('standard*') ? Math.round(productionBudget(duration) * Number(budget.slice(9))) : Number(budget);
}

const RAILS = {offered: {guidance: 'optional', railLayout: 'paired'}, required: {guidance: 'required', railLayout: 'paired'},
  handover: {guidance: 'required', railLayout: 'transfer'}} as const;
/** An explicit request (stratum E): the automatic plan, with the gaps that
 * start inside a construction window asking for that window's geometry.
 * Built with the compiler under test (its planner and plan validation). */
export async function explicitPlan(root: string, spec: any, seed: number, creative: Record<string, unknown>, boundaries: number[], windows: NonNullable<NonNullable<PlannedCase['bench']>['construction']>) {
  const load = (f: string) => import(pathToFileURL(join(root, 'scripts/v0/optimizer', f)).href);
  const [{planIntentionalRepertoire}, {validateProductionPlan}, {normalizeCompilerTimeline}] = await Promise.all([
    load('intentional_repertoire.ts'), load('repertoire_policy.ts'), load('compiler_input.ts'),
  ]);
  const normalized = normalizeCompilerTimeline(spec), plan = planIntentionalRepertoire(normalized, seed, creative, boundaries);
  const requests = plan.requests.map((r: any) => {
    const w = r.section > 0 && windows.find(w => r.frame >= Math.round(w.from * 40) && r.frame < Math.round(w.to * 40));
    if (!w) return r;
    const rail = w.family === 'scattered' ? {guidance: 'optional'} : RAILS[w.rail];
    return {...r, construction: w.family, ...rail, ...(w.family === 'scattered' ? {railLayout: 'paired'} : {})};
  });
  // One phrase per run of identical requests (a phrase has one construction, guidance and rail layout).
  const phrases: any[] = [];
  for (let i = 1; i < requests.length; i++) {
    const r = requests[i], last = phrases.at(-1);
    if (last && r.construction === last.construction && r.guidance === last.guidance && r.railLayout === last.railLayout) last.count++;
    else phrases.push({first: i, count: 1, construction: r.construction, guidance: r.guidance, railLayout: r.railLayout});
  }
  return validateProductionPlan(normalized, {...plan, requests, phrases});
}

export async function compileAndMeasure(root: string, c: PlannedCase, resolved: {spec: any; music: any}, settings: ArmSettings) {
  const [{compileHandoff}, {productionBudget}] = await Promise.all([
    import(pathToFileURL(join(root, 'scripts/v0/optimizer/handoff.ts')).href),
    import(pathToFileURL(join(root, 'scripts/v0/optimizer/production_budget.ts')).href),
  ]);
  const {spec, music} = resolved, budget = allowanceFor(settings.budget, spec.duration, productionBudget), began = performance.now();
  const boundaries = music.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter(Number.isFinite), creative = settings.creative ?? {};
  const windows = c.bench?.construction;
  const cp = compileHandoff(spec, c.seed, windows
    ? {budget, constructionPlan: await explicitPlan(root, spec, c.seed, creative, boundaries, windows)}
    : {budget, creative, phraseBoundaries: boundaries});
  const compileMs = performance.now() - began, r = cp.repertoire!;
  const cell = measureCell({c, track: cp.track, spec, music, physicalFrames: r.physicalFrames,
    compileMs, complete: r.valid, fulfilled: r.qualified, motion: r.motion.full, geometry: geometryFacts(r)});
  // The compile's own outputs that the gallery record is written from
  // (scripts/produce/music_artifacts.ts saveMusicCell), so a saved ride can be
  // shown on the dashboard exactly as compared, without compiling it again.
  const {result, ...production} = r, gallery = {budget, compileMs, physicalFrames: r.physicalFrames, production, work: cp.work,
    result: {track: result.track, report: result.report, rows: result.rows, stats: result.stats, attempts: result.attempts, failure: result.failure,
      impactEvaluation: result.impactEvaluation, impactTrajectoryLoss: result.impactTrajectoryLoss,
      opposingEntryWork: result.opposingEntryWork}};
  return {cell, track: cp.track, gallery};
}
