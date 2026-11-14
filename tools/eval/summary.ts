/** The stratified arithmetic of eval runs: completion first, quality on
 * both-complete cells, per-spec sign counts, strata weighted equally. */
import assert from 'node:assert/strict';
import {GEOMETRY_FAMILIES} from '../../scripts/v0/optimizer/geometry_families.ts';

import {EXPLICIT} from './inputs.ts';
import {assertPairedRuns, type Run} from './records.ts';
export {loadRun, type Run} from './records.ts';
export const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN;};
export const mean = (xs: number[]) => {const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;};
/** A cell's headline score: the production grade (contact_impact_grade.ts),
 * 0 when the ride is invalid or incomplete, as the headline always counted
 * failures; NaN only for cells measured before the grade was recorded. */
export const headlineScore = (cell: any) => cell.score ? (cell.complete && cell.score.valid ? cell.score.score : 0) : NaN;
/** The one headline definition, shared by every report: per stratum the mean
 * score of its specs (each spec the mean of its seeds; failures at 0); the
 * headline is the mean of strata, explicit requests (E) excluded; `cells` is
 * the plain mean over the counted cells. E is returned apart, never counted. */
export function headline(r: Run, strata: string[]) {
  const cases = r.run.panel as any[], score = (c: any) => headlineScore(r.cells.get(c.id));
  const stratumMean = (s: string) => {
    const own = cases.filter(c => c.bench.stratum === s);
    return mean([...new Set(own.map(specKey))].map(spec => mean(own.filter(c => specKey(c) === spec).map(score))));
  };
  const counted = strata.filter(s => s !== EXPLICIT), perStratum = Object.fromEntries(strata.map(s => [s, stratumMean(s)]));
  return {perStratum, counted, strata: mean(counted.map(s => perStratum[s])),
    cells: mean(cases.filter(c => counted.includes(c.bench.stratum)).map(score)),
    explicit: strata.includes(EXPLICIT) ? perStratum[EXPLICIT] : NaN,
    recorded: cases.filter(c => Number.isFinite(score(c))).length};
}
/** Song-level summary of one cell: the numbers a decision would be based on. */
export function summarize(cell: any) {
  return {
    complete: cell.complete ? 1 : 0, fulfilled: cell.fulfilled ? 1 : 0,
    score: headlineScore(cell),
    // One loss per impact ruler, so every ruler stays visible; the headline's (v3) in detail below.
    'contact-impact loss': cell.contact.loss,
    'strike loss': cell.strike?.loss ?? NaN,
    'impact loss (v2)': cell.impact?.loss ?? NaN,
    'impact loss (v3)': cell.impact3?.loss ?? NaN,
    'strong extra impacts / beat (v3)': cell.impact3 ? cell.impact3.strongExtras / cell.impact3.beats : NaN,
    'opposite-push pairs >=0.2 / beat (v3)': cell.impact3.reversals.filter((r: any) => r.beforeStrength >= .2 && r.afterStrength >= .2).length / cell.impact3.beats,
    ...(() => {
      // Per-beat v3 strength by requested band; a beat with no matched impact counts as strength 0.
      const rows = (cell.impact3?.perBeat ?? []).filter((r: any) => r.requested != null).map((r: any) => [r.requested, r.hit?.strength ?? 0]);
      const band = (a: number, b: number) => rows.filter((r: any) => r[0] >= a && r[0] < b);
      const bias = (xs: any[]) => mean(xs.map((r: any) => r[1] - r[0])), rms = (xs: any[]) => Math.sqrt(mean(xs.map((r: any) => (r[1] - r[0]) ** 2)));
      return {'v3 strong bias (req>=0.6)': bias(band(.6, 2)), 'v3 strong rms (req>=0.6)': rms(band(.6, 2)),
        'v3 very strong bias (req>=0.8)': bias(band(.8, 2)), 'v3 quiet bias (req<0.15)': bias(band(0, .15))};
    })(),
    'air rms': cell.frozen.axes?.air?.rmsError ?? NaN,
    'speed rms': cell.frozen.axes?.speed?.rmsError ?? NaN,
    'amplitude rms': cell.frozen.axes?.amplitude?.rmsError ?? NaN,
    ...characterOfCell(cell),
    'strong arrivals inverted/backward': cell.guards?.strongInverted ?? NaN,
    'body drag s/min': cell.guards?.dragSecondsPerMinute ?? NaN,
    'off-beat kicks / ride': cell.guards?.offBeatKicks ?? NaN,
    'physics frames (M)': cell.physicalFrames / 1e6,
  };
}
const SHAPES = new Set(['fold', 'serpentine', 'scallops', 'terraces']);
/** One ride's character (tools/measure/character.ts, contact_role.ts), NaN where the cell predates it. Rails: sections
 * whose final track keeps a guide line, weighted by their frames; open arcs: arcs keeping none; shapes: the four shaped
 * families; the longest railed stretch: consecutive sections keeping a rail, in seconds. A clean upper hit: a beat
 * caught on a line's underside with no rail touched; a strong beat asks 0.6 or more, and one with no matched hit counts
 * as not clean. */
export function characterOfCell(cell: any): Record<string, number> {
  const ch = cell.character, sections: any[] = cell.geometry?.sections ?? [];
  const keys = ['rails, share of ride time', 'open arcs, share of ride time', 'shapes, share of ride time', 'longest railed stretch s',
    'clean upper hits, share of strong beats', 'clean upper hits, share of beats', 'rail contact s/min', 'upper contact s/min'];
  if (!ch || ch.railDrawn.length !== sections.length) return Object.fromEntries(keys.map(k => [k, NaN]));
  const frames = sections.reduce((n, x) => n + x.frames, 0), time = (keep: (x: any, i: number) => boolean) =>
    sections.reduce((n, x, i) => n + (keep(x, i) ? x.frames : 0), 0) / frames;
  let run = 0, longest = 0;
  sections.forEach((x, i) => {run = ch.railDrawn[i] ? run + x.frames : 0; longest = Math.max(longest, run);});
  const asked = (cell.impact3?.perBeat ?? []).filter((b: any) => b.requested != null), strong = asked.filter((b: any) => b.requested >= .6);
  const clean = (rows: any[]) => rows.length ? rows.filter(b => b.hit?.contact === 'upper').length / rows.length : NaN;
  return {[keys[0]]: time((_, i) => ch.railDrawn[i]), [keys[1]]: time((x, i) => x.family === 'arcs' && !ch.railDrawn[i]),
    [keys[2]]: time(x => SHAPES.has(x.family)), [keys[3]]: longest / 40,
    [keys[4]]: clean(strong), [keys[5]]: clean(asked), [keys[6]]: ch.guideContact, [keys[7]]: ch.upperContact};
}
export function windowTest(c: any) {
  const windows: Array<[number, number]> = c.bench?.windows ?? [];
  return (frame: number) => !windows.length || windows.some(([t0, t1]) => frame >= t0 * 40 && frame <= t1 * 40);
}
/** The v3 account restricted to the targets and unrequested events inside the
 * case's windows, normalized by the beats inside (same terms as the loss). */
export function windowImpact(cell: any) {
  const inside = windowTest(cell.case), beats = cell.impact3.perBeat.filter((_: any, j: number) => inside(cell.case.targets[j].frame));
  const extras: any[] | undefined = cell.impact3.extras?.filter((e: any) => inside(e.onset));
  const mass = Math.max(1, beats.length), hits = beats.filter((b: any) => b.hit);
  const strength = hits.reduce((s: number, b: any) => s + (b.requested == null ? 0 : (b.hit.strength - b.requested) ** 2), 0) / mass;
  const timing = hits.reduce((s: number, b: any) => s + (b.hit.timingError ?? NaN) ** 2, 0) / mass;
  const extra = extras ? extras.reduce((s, e) => s + e.cost, 0) / mass : NaN, missing = (beats.length - hits.length) / mass;
  return {'window v3 loss': strength + timing + extra + missing, 'window v3 strength (mse)': strength, 'window v3 timing (mse)': timing,
    'window v3 extra (mse)': extra, 'window missing / beat': missing,
    'window strong extra impacts / beat': extras ? extras.filter(e => e.strength >= .25).length / mass : NaN,
    'window v3 strong bias (req>=0.6)': mean(beats.filter((b: any) => b.requested >= .6).map((b: any) => (b.hit?.strength ?? 0) - b.requested))};
}
/** Quality rulers of the stratified report: every summarize() row but completion,
 * the v3 loss parts, and the windowed v3 account. */
export function benchMetrics(cell: any): Record<string, number> {
  const {complete: _, ...rows} = summarize(cell), v3 = cell.impact3;
  const missing = v3.perBeat.filter((b: any) => !b.hit).length / Math.max(1, v3.beats);
  const w = windowImpact(cell);
  return {...rows, 'v3 strength (mse)': v3.strengthMse, 'v3 timing (mse)': v3.timingMse ?? v3.loss - v3.strengthMse - v3.extraMse - missing,
    'v3 extra (mse)': v3.extraMse, 'window v3 loss': w['window v3 loss'], 'window v3 strong bias (req>=0.6)': w['window v3 strong bias (req>=0.6)']};
}
/** Where an incomplete ride failed: the earlier of the crash (the replay ended
 * before the spec) and the first beat without a matched impact; `reached` is the
 * share of beats before that point. */
export function failurePoint(cell: any) {
  const targets = cell.case.targets, crash = cell.terminus && cell.terminus.reason !== 'endOfSpec' ? cell.terminus.frame : Infinity;
  const j = cell.impact3.perBeat.findIndex((b: any) => !b.hit), miss = j < 0 ? Infinity : targets[j].frame, frame = Math.min(crash, miss);
  return {kind: frame === Infinity ? 'invalid' : crash <= miss ? `crash (${cell.terminus.reason})` : 'missed beat',
    time: frame === Infinity ? NaN : frame / 40, reached: frame === Infinity ? 1 : targets.filter((t: any) => t.frame < frame).length / targets.length};
}
/** The categories of `cases`, in numeric order (G, P1, P2, …, P10). */
export const strataOf = (cases: Array<{bench?: {stratum: string} | null}>) =>
  [...new Set(cases.map(c => c.bench!.stratum))].sort((x, y) => x.localeCompare(y, 'en', {numeric: true}));
export const specKey = (c: any) => `${c.song}~${c.variant ?? 'spec'}`;
/** Stratified comparison of run `a` against optional reference `b`.
 * Completion first, over every cell. Quality only on cells complete in both
 * arms: per spec, the seed mean of each arm and of the paired difference (a − b)
 * with sign counts over seeds; a stratum is the mean of its specs; `strata` is
 * the mean of the strata (each weighs equally). No intervals: with few units a
 * resampled interval is not evidence. */
export function stratify(a: Run, b?: Run) {
  if (b) assertPairedRuns(a, b);
  const cases = a.run.panel as any[];
  assert.ok(cases.every(c => c.bench), 'this run predates the stratified panels; its report is at tag archive/pre-lean-foundation-2026-11');
  const strata = strataOf(cases);
  const done = (r: Run | undefined, id: string) => r ? r.cells.get(id).complete as boolean : true;
  const failures = (r: Run) => cases.filter(c => !r.cells.get(c.id).complete).map(c => ({id: c.id, ...failurePoint(r.cells.get(c.id))}));
  const rows = strata.map(stratum => {
    const own = cases.filter(c => c.bench.stratum === stratum), specs = [...new Set(own.map(specKey))];
    const count = (r: Run | undefined, xs: any[]) => r ? xs.filter(c => r.cells.get(c.id).complete).length : NaN;
    const completion = {total: own.length, a: count(a, own), b: count(b, own),
      recovered: b ? own.filter(c => done(a, c.id) && !done(b, c.id)).map(c => c.id) : [],
      lost: b ? own.filter(c => !done(a, c.id) && done(b, c.id)).map(c => c.id) : [],
      specs: specs.map(spec => {const xs = own.filter(c => specKey(c) === spec); return {spec, n: xs.length, a: count(a, xs), b: count(b, xs)};})};
    const quality = specs.map(spec => {
      const both = own.filter(c => specKey(c) === spec && done(a, c.id) && done(b, c.id));
      const ma = both.map(c => benchMetrics(a.cells.get(c.id))), mb = b ? both.map(c => benchMetrics(b.cells.get(c.id))) : [];
      const metrics = Object.fromEntries(Object.keys(ma[0] ?? {}).map(k => {
        const d = b ? ma.map((m, i) => m[k] - mb[i][k]) : [];
        return [k, {a: mean(ma.map(m => m[k])), b: b ? mean(mb.map(m => m[k])) : NaN, diff: b ? mean(d) : NaN,
          up: d.filter(x => x > 0).length, down: d.filter(x => x < 0).length, same: d.filter(x => x === 0).length}];
      }));
      return {spec, n: both.length, metrics};
    });
    return {stratum, completion, quality};
  });
  const metricNames = [...new Set(rows.flatMap(r => r.quality.flatMap(q => Object.keys(q.metrics))))];
  const level = (qs: any[], k: string, f: 'a' | 'b' | 'diff') => mean(qs.map(q => q.metrics[k]?.[f] ?? NaN));
  const stratumValue = rows.map(r => Object.fromEntries(metricNames.map(k => [k, {a: level(r.quality, k, 'a'), b: level(r.quality, k, 'b'), diff: level(r.quality, k, 'diff')}])));
  return {strata: rows.map((r, i) => ({...r, value: stratumValue[i]})), metricNames,
    // Equal stratum weights: the mean of stratum values, never of cells.
    overall: Object.fromEntries(metricNames.map(k => [k, Object.fromEntries((['a', 'b', 'diff'] as const).map(f => [f, mean(stratumValue.map(s => s[k][f]))]))])),
    completionRate: {a: mean(rows.map(r => r.completion.a / r.completion.total)), b: mean(rows.map(r => r.completion.b / r.completion.total))},
    failures: {a: failures(a), b: b ? failures(b) : []}};
}

/** Realization reasons meaning a shaped section's turns were not realized: a
 * fold's corners, or another shape's turn reversals (paired and transfer). */
const SHAPE_MISSES = new Set(['missing-fold-corners', 'missing-shaped-reversals', 'missing-engaged-transfer-corners', 'missing-engaged-transfer-reversals']);
const GUIDANCE_ORDER = ['forbidden', 'optional', 'required'];
const share = (n: number, d: number) => d ? n / d : NaN;
/** One ride's geometry numbers, or null when the cell predates geometry facts.
 * `time` and `sections` are shares by family/guidance (of ride time in frames,
 * and of sections); `plan` holds the other planned facts; `realized` comes from
 * the compiler's realization check. */
export function geometryOfCell(cell: any) {
  const g = cell.geometry;
  if (!g) return null;
  const all = g.sections as any[], frames = all.reduce((n, s) => n + s.frames, 0), key = (s: any) => `${s.family}/${s.guidance}`;
  const time: Record<string, number> = {}, sections: Record<string, number> = {};
  for (const s of all) {time[key(s)] = (time[key(s)] ?? 0) + s.frames / frames; sections[key(s)] = (sections[key(s)] ?? 0) + 1 / all.length;}
  // Guided: a connected section given a guide rail, required (explicit plans, and
  // automatic plans before 2026-11-01) or offered ('optional', automatic plans since).
  const railed = (s: any) => s.guidance !== 'forbidden' && s.family !== 'scattered';
  const guided = all.filter(railed), transfer = guided.filter(s => s.rail === 'transfer');
  const shaped = all.filter(s => s.family !== 'arcs' && s.family !== 'scattered');
  const short = all.filter(s => s.frames < g.shapedMinFrames), shortGuidedArcs = short.filter(s => s.family === 'arcs' && railed(s)).length;
  const untouched = guided.filter(s => s.guideFrames === 0).length;
  return {time, sections,
    plan: {'transfer, share of guided time': share(transfer.reduce((n, s) => n + s.frames, 0), guided.reduce((n, s) => n + s.frames, 0)),
      'transfer, share of guided sections': share(transfer.length, guided.length),
      'distinct families per ride': new Set(all.map(s => s.family)).size,
      'short sections per ride': short.length,
      'short, planned shaped per ride': short.filter(s => shaped.includes(s)).length,
      'short, planned guided arcs per ride': shortGuidedArcs,
      'shapes simplified at a dead end per ride': g.fallbacks ? g.fallbacks.length : NaN,
      'short guided arcs, share of sections': share(shortGuidedArcs, all.length)},
    realized: {'sections fulfilled, share': share(all.filter(s => s.fulfilled).length, all.length),
      'guided, guide never touched per ride': untouched,
      'guided, guide never touched, share': share(untouched, guided.length),
      'shaped, turns realized, share': share(shaped.filter(s => !s.reasons.some((r: string) => SHAPE_MISSES.has(r))).length, shaped.length),
      'shaped, turn reversals per section': share(shaped.reduce((n, s) => n + s.reversals, 0), shaped.length)}};
}
export type GeometryValue = {strata: Array<{a: number; b: number; diff: number}>; overall: {a: number; b: number; diff: number}};
/** Geometry use by stratum, with the stratified report's weights (seeds
 * averaged per spec, specs equal within a stratum, strata equal across).
 * Planned facts use every cell, since the plan does not depend on completion;
 * realized facts use cells complete in both arms (in this run, unpaired). A run
 * with any cell lacking geometry facts is not recorded and gives no values.
 * Descriptive only: no direction is better. */
export function geometryStrata(a: Run, b?: Run) {
  if (b) assertPairedRuns(a, b);
  const cases = a.run.panel as any[], runs = b ? [a, b] : [a];
  const recorded = runs.map(r => [...r.cells.values()].every(c => !!c.geometry));
  const facts = runs.map((r, i) => new Map(recorded[i] ? cases.map(c => [c.id, geometryOfCell(r.cells.get(c.id))!]) : []));
  const families = Object.keys(GEOMETRY_FAMILIES), rank = (k: string) => {
    const [f, g] = k.split('/'), i = families.indexOf(f);
    return (i < 0 ? families.length : i) * 10 + GUIDANCE_ORDER.indexOf(g);
  };
  const shares = (group: string) => group === 'time' || group === 'sections';
  const groups = (['time', 'sections', 'plan', 'realized'] as const).map(group => {
    const rows = [...new Set(facts.flatMap(m => [...m.values()].flatMap(x => Object.keys(x[group]))))];
    return {group, rows: shares(group) ? rows.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y)) : rows};
  });
  const complete = (id: string) => runs.every(r => r.cells.get(id).complete);
  const strata = strataOf(cases);
  // One arm's value of a row over a stratum: seed mean per spec, then spec mean.
  // A family absent from a ride has share 0 there.
  const level = (arm: number, group: string, row: string, stratum: string) => {
    if (!recorded[arm]) return NaN;
    const own = cases.filter(c => c.bench.stratum === stratum && (group !== 'realized' || complete(c.id)));
    return mean([...new Set(own.map(specKey))].map(spec => mean(own.filter(c => specKey(c) === spec)
      .map(c => (facts[arm].get(c.id) as any)[group][row] ?? (shares(group) ? 0 : NaN)))));
  };
  const values: Record<string, Record<string, GeometryValue>> = Object.fromEntries(groups.map(({group, rows}) => [group, Object.fromEntries(rows.map(row => {
    const per = strata.map(s => {const va = level(0, group, row, s), vb = b ? level(1, group, row, s) : NaN; return {a: va, b: vb, diff: va - vb};});
    return [row, {strata: per, overall: {a: mean(per.map(p => p.a)), b: mean(per.map(p => p.b)), diff: mean(per.map(p => p.diff))}}];
  }))]));
  return {recorded: {a: recorded[0], b: b ? recorded[1] : undefined}, strata, groups, values,
    shapedMinFrames: [...new Set(runs.flatMap((r, i) => recorded[i] ? [...r.cells.values()].map(c => c.geometry.shapedMinFrames) : []))],
    realizedCells: strata.map(s => cases.filter(c => c.bench.stratum === s && complete(c.id)).length)};
}
