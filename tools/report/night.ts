/** Data for the overnight results page (motion-gallery/night.html): eval runs
 * summarized per panel with song-bootstrap intervals, paired differences
 * against a reference run, requested-vs-achieved impact curves and per-song
 * rows. Run names are eval runs under generated/eval.
 *
 *   node --import tsx tools/report/night.ts --stages=evening:<run>,v3:<run>,final:<run>
 *       [--confirm=evening:<run>,final:<run>] [--out=generated/report/night/data.json] */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync, copyFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {SONGS, summarize, bootstrap, loadRun, songValues, mean, type Run} from '../eval/summary.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const parse = (s: string | undefined) => (s ?? '').split(',').filter(Boolean).map(x => {const [key, run] = x.split(':'); return {key, run};});
const stages = parse(arg('stages')), confirm = parse(arg('confirm'));
assert.ok(stages.length >= 2, 'declare at least a reference and a candidate');
type Stage = {key: string; run: string; data: Run};
const readStages = (xs: Array<{key: string; run: string}>): Stage[] => {
  assert.equal(new Set(xs.map(x => x.key)).size, xs.length, 'duplicate stage key');
  return xs.map(s => ({...s, data: loadRun(s.run)}));
};
const devRuns = readStages(stages), confirmRuns = readStages(confirm);
const out = arg('out', 'generated/report/night/data.json')!;

/** The rows the page shows, grouped; `better` says which direction is good. */
const METRICS: Array<{group: string; metric: string; label: string; better: 'lower' | 'higher' | 'zero'; digits?: number}> = [
  {group: 'Impact', metric: 'impact loss (v3)', label: 'Impact loss (strength, timing, extras)', better: 'lower'},
  {group: 'Impact', metric: 'v3 strong bias (req>=0.6)', label: 'Strong beats: strength − request', better: 'zero'},
  {group: 'Impact', metric: 'v3 very strong bias (req>=0.8)', label: 'Very strong beats: strength − request', better: 'zero'},
  {group: 'Impact', metric: 'v3 quiet bias (req<0.15)', label: 'Quiet beats: strength − request', better: 'zero'},
  {group: 'Impact', metric: 'opposite-push boundaries / beat (v3)', label: 'Opposite-push boundaries per beat (v3)', better: 'lower'},
  {group: 'Impact', metric: 'opposite-push pairs >=0.2 / beat (v3)', label: 'Opposite-push pairs per beat (both ≥0.2, v3)', better: 'lower'},
  {group: 'Impact', metric: 'contested strong beats', label: 'Strong beats with a competing hit', better: 'lower'},
  {group: 'Impact', metric: 'R1 bend peak lag ms (median)', label: 'R1 bend peak after the beat (ms, median)', better: 'lower', digits: 1},
  {group: 'Spec axes', metric: 'complete', label: 'Rides completed', better: 'higher'},
  {group: 'Spec axes', metric: 'air rms', label: 'Air error (rms)', better: 'lower'},
  {group: 'Spec axes', metric: 'speed rms', label: 'Speed error (rms)', better: 'lower'},
  {group: 'Spec axes', metric: 'amplitude rms', label: 'Amplitude error (rms, one song)', better: 'lower'},
  {group: 'Look', metric: 'strong arrivals inverted/backward', label: 'Strong arrivals head-down/backward at first contact (v3)', better: 'lower'},
  {group: 'Look', metric: 'body drag s/min', label: 'Body dragging on lines (s/min)', better: 'lower'},
  {group: 'Look', metric: 'burst excess (100 ms)', label: 'Unwanted speed-ups (100 ms bursts)', better: 'lower'},
  {group: 'Cost', metric: 'physics frames (M)', label: 'Physics frames per ride (M)', better: 'lower'},
];
const PANELS = [{key: 'authored', title: 'Authored specs', filter: (c: any) => !c.case.perturbation},
  {key: 'perturbed', title: 'Perturbed specs', filter: (c: any) => !!c.case.perturbation}];

function summarizeRuns(runs: Stage[]) {
  const reference = runs[0];
  return PANELS.map(p => ({panel: p.key, title: p.title, rows: METRICS.map(m => ({...m, stages: runs.map(r => {
    const values = songValues(r.data, m.metric, p.filter), [value, lo, hi] = bootstrap(values);
    const songs = [...values.values()].filter(Number.isFinite).length;
    const [d, dlo, dhi] = r === reference ? [0, 0, 0] : bootstrap(songValues(r.data, m.metric, p.filter, reference.data));
    return {key: r.key, value, lo, hi, songs, diff: d, diffLo: dlo, diffHi: dhi};
  })}))}));
}

/** Achieved v3 strength against the request, in request bins (authored panel). */
function curve(run: Run) {
  const bins = Array.from({length: 10}, (_, k) => ({from: k / 10, to: (k + 1) / 10, n: 0, sum: 0, values: [] as number[]}));
  for (const c of run.cells.values()) if (!c.case.perturbation) for (const row of c.impact3.perBeat) {
    const req = row.requested, got = row.hit?.strength ?? 0;
    if (req == null) continue;
    const b = bins[Math.min(9, Math.floor(req * 10))]; b.n++; b.sum += got; b.values.push(got);
  }
  return bins.filter(b => b.n).map(b => {const v = b.values.sort((x, y) => x - y);
    return {from: b.from, to: b.to, n: b.n, mean: b.sum / b.n, p25: v[Math.floor(.25 * (v.length - 1))], p75: v[Math.floor(.75 * (v.length - 1))]};});
}

function perSong(runs: Stage[]) {
  return SONGS.map(song => ({song, stages: runs.map(r => {
    const cells = [...r.data.cells.values()].filter((c: any) => c.case.song === song && !c.case.perturbation).map(summarize) as any[];
    const m = (k: string) => mean(cells.map(c => c[k]));
    return {key: r.key, impactLoss: m('impact loss (v3)'), strongBias: m('v3 strong bias (req>=0.6)'), air: m('air rms'), speed: m('speed rms'),
      inverted: m('strong arrivals inverted/backward')};
  })}));
}

const data = {
  generated: new Date().toISOString(),
  stages: devRuns.map(({key, run, data: {run: p}}) => ({key, run, identity: p.identity, mode: p.mode, jolt: p.jolt, evaluator: p.evaluator})),
  dev: summarizeRuns(devRuns),
  confirm: confirm.length ? summarizeRuns(confirmRuns) : null,
  confirmStages: confirmRuns.map(({key, run, data: {run: p}}) => ({key, run, identity: p.identity, mode: p.mode, jolt: p.jolt, evaluator: p.evaluator})),
  curves: devRuns.map(s => ({key: s.key, bins: curve(s.data)})),
  songs: perSong(devRuns),
  experiments: JSON.parse(readFileSync(new URL('./experiments.json', import.meta.url), 'utf8')),
};
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, JSON.stringify(data, null, 1));
copyFileSync(new URL('./narrative.json', import.meta.url), join(dirname(out), 'narrative.json'));
console.log(`night report data: ${out} (${stages.map(s => s.key).join(', ')}${confirm.length ? `; confirm ${confirm.map(s => s.key).join(', ')}` : ''})`);
