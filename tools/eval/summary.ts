/** Song-level summaries of eval runs, shared by the eval report and the night
 * report (tools/report): one cell's decision numbers, per-song means (optionally
 * paired differences against another run) and the song bootstrap; and the
 * stratified (bench, sealed, held-out) arithmetic: completion first, quality on
 * both-complete cells, per-spec sign counts, strata weighted equally. */
import assert from 'node:assert/strict';
import {makeRng} from '../../scripts/lib/rng.ts';

import {SONGS} from './inputs.ts';
import {assertPairedRuns, type Run} from './records.ts';
export {SONGS} from './inputs.ts';
export {loadRun, type Run} from './records.ts';
export const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN;};
export const mean = (xs: number[]) => {const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;};
/** Song-level summary of one cell: the numbers a decision would be based on. */
export function summarize(cell: any) {
  const b = cell.beats.filter((r: any) => r.requested != null), strong = b.filter((r: any) => r.requested >= .6), quiet = b.filter((r: any) => r.requested <= .15);
  const strengthErr = (rows: any[]) => Math.sqrt(mean(rows.map((r: any) => ((r.r1?.strength ?? 0) - r.requested) ** 2)));
  return {
    complete: cell.complete ? 1 : 0, fulfilled: cell.fulfilled ? 1 : 0,
    frozenScore: cell.frozen.valid ? cell.frozen.score : NaN,
    'strength rms (R1)': strengthErr(b), 'strong strength rms': strengthErr(strong), 'quiet strength rms': strengthErr(quiet),
    'R1 bend peak lag ms (median)': median(b.map((r: any) => (r.r1?.peak ?? NaN) * 25)),
    'R1 bend peaks >100 ms late': mean(b.map((r: any) => r.r1 ? (r.r1.peak * 25 > 100 ? 1 : 0) : NaN)),
    'contested strong beats': mean(strong.map((r: any) => r.impulse.competitor >= .5 * r.impulse.hit ? 1 : 0)),
    'strong extra hits / beat': mean(b.map((r: any) => r.extrasR1.filter((e: any) => e.strength >= .25).length)),
    'hidden contacted bend / beat': mean(b.map((r: any) => r.hiddenBend)),
    'contact-impact loss': cell.contact.loss,
    'strike loss': cell.strike?.loss ?? NaN,
    'strike strength rms': cell.strike ? Math.sqrt(cell.strike.strengthMse) : NaN,
    'strike extra (mse)': cell.strike?.extraMse ?? NaN,
    'strong extra strikes / beat': mean(b.map((r: any) => r.strike ? r.strike.extras.filter((e: any) => e.strength >= .25).length : NaN)),
    'impact loss (v2)': cell.impact?.loss ?? NaN,
    'impact strength rms (v2)': cell.impact ? Math.sqrt(cell.impact.strengthMse) : NaN,
    'impact extra (v2, mse)': cell.impact?.extraMse ?? NaN,
    'strong extra impacts / beat (v2)': cell.impact ? cell.impact.strongExtras / cell.impact.beats : NaN,
    'impact loss (v3)': cell.impact3?.loss ?? NaN,
    'strong extra impacts / beat (v3)': cell.impact3 ? cell.impact3.strongExtras / cell.impact3.beats : NaN,
    'opposite-push boundaries / beat (v3)': cell.impact3.reversals.length / cell.impact3.beats,
    'opposite-push pairs >=0.2 / beat (v3)': cell.impact3.reversals.filter((r: any) => r.beforeStrength >= .2 && r.afterStrength >= .2).length / cell.impact3.beats,
    ...(() => {
      // Per-beat v3 strength by requested band; a beat with no matched impact counts as strength 0.
      const rows = (cell.impact3?.perBeat ?? []).filter((r: any) => r.requested != null).map((r: any) => [r.requested, r.hit?.strength ?? 0]);
      const band = (a: number, b: number) => rows.filter((r: any) => r[0] >= a && r[0] < b);
      const bias = (xs: any[]) => mean(xs.map((r: any) => r[1] - r[0])), rms = (xs: any[]) => Math.sqrt(mean(xs.map((r: any) => (r[1] - r[0]) ** 2)));
      return {'v3 strong bias (req>=0.6)': bias(band(.6, 2)), 'v3 strong rms (req>=0.6)': rms(band(.6, 2)),
        'v3 very strong bias (req>=0.8)': bias(band(.8, 2)), 'v3 quiet bias (req<0.15)': bias(band(0, .15))};
    })(),
    'strong arrivals inverted/backward': cell.guards?.strongInverted ?? NaN,
    'body drag s/min': cell.guards?.dragSecondsPerMinute ?? NaN,
    'off-beat kicks / ride': cell.guards?.offBeatKicks ?? NaN,
    'air rms': cell.frozen.axes?.air?.rmsError ?? NaN,
    'speed rms': cell.frozen.axes?.speed?.rmsError ?? NaN,
    'amplitude rms': cell.frozen.axes?.amplitude?.rmsError ?? NaN,
    'burst excess (100 ms)': cell.motion?.bursts?.[1]?.excessIntegral ?? NaN,
    'physics frames (M)': cell.physicalFrames / 1e6, 'compile s': cell.compileMs / 1000,
  };
}
export function bootstrap(perSong: Map<string, number>, draws = 4000) {
  const values = [...perSong.values()].filter(Number.isFinite), rng = makeRng(7), out: number[] = [];
  if (!values.length) return [NaN, NaN, NaN];
  for (let d = 0; d < draws; d++) {let s = 0; for (let i = 0; i < values.length; i++) s += values[Math.floor(rng() * values.length)]; out.push(s / values.length);}
  out.sort((a, b) => a - b);
  return [mean(values), out[Math.floor(.025 * draws)], out[Math.floor(.975 * draws)]];
}


/** Per-song mean of a metric over the cells passing `filter`; with `diff`, the
 * mean paired difference against the same cases of another run. */
export function songValues(run: Run, metric: string, filter: (c: any) => boolean, diff?: Run) {
  if (diff) assertPairedRuns(run, diff);
  const m = new Map<string, number>();
  for (const song of SONGS) {
    const xs = [...run.cells.values()].filter(filter).filter((c: any) => c.case.song === song).map((c: any) => {
      const value = summarize(c)[metric as keyof ReturnType<typeof summarize>] as number;
      if (!diff) return value;
      const other = diff.cells.get(c.case.id); return other ? value - (summarize(other)[metric as keyof ReturnType<typeof summarize>] as number) : NaN;
    });
    m.set(song, mean(xs));
  }
  return m;
}

/** The pattern windows of a stratified case as a frame test. Windows are in
 * authored seconds; contacts are compiled `-jolt` ms later, so shift by that. No
 * windows (G, held-out) means the whole ride. */
export function windowTest(c: any) {
  const windows: Array<[number, number]> = c.bench?.windows ?? [], shift = -c.input.jolt / 1000;
  return (frame: number) => !windows.length || windows.some(([t0, t1]) => frame >= (t0 + shift) * 40 && frame <= (t1 + shift) * 40);
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
  return {...rows, 'v3 strength (mse)': v3.strengthMse, 'v3 timing (mse)': v3.timingMse ?? v3.loss - v3.strengthMse - v3.extraMse - missing,
    'v3 extra (mse)': v3.extraMse, ...windowImpact(cell)};
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
  assert.ok(cases.every(c => c.bench), 'not a stratified run: use the legacy report');
  const strata = [...new Set(cases.map(c => c.bench.stratum))].sort((x, y) => x.localeCompare(y, 'en', {numeric: true}));
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
