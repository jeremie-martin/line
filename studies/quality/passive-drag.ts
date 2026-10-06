/** Explain the existing drag guard without introducing another optimization metric. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {loadRun, readTrack, assertPairedRuns} from '../../tools/eval/records.ts';
import {resolveCase, digest} from '../../tools/eval/inputs.ts';
import {observe} from '../../tools/measure/observe.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {mean, bootstrap} from '../../tools/eval/summary.ts';
const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith('--'+key+'='))?.slice(key.length+3) ?? fallback;
const roots = {baseline: arg('baseline', '/tmp/line-quality-final-candidate-20261006/generated/eval/quality-development-remeasured'),
  candidate: arg('candidate', '/tmp/line-quality-passive-arrival-20261006/generated/eval/q65-passive-arrival')};
const runs = Object.fromEntries(Object.entries(roots).map(([k, p]) => [k, loadRun(p)]));
assertPairedRuns(runs.baseline, runs.candidate);
const rows: any[] = [], bands = ['quiet', 'moderate', 'strong', 'unspecified'];
const band = (request: number | null) => request == null ? 'unspecified' : request < .15 ? 'quiet' : request >= .6 ? 'strong' : 'moderate';
for (const [label, run] of Object.entries(runs)) for (const c of run.run.panel) {
  const {music, planned} = await resolveCase(c, run.run.jolt); assert.deepEqual(planned, c);
  const track = readTrack(run.dir, c.id), o = observe(track, music.durationFrames, c.targets);
  const last = Math.min(music.durationFrames, o.frames.length - 1), ranges: any[] = [], counts = Object.fromEntries(bands.map(k => [k, {frames: 0, drag: 0}]));
  let start: number | null = null, points = new Set<number>();
  const tags = ['unspecified'];
  for (let f = 1, target = -1; f <= last; f++) {
    // Attribute time after a beat to that authored beat; before the first beat,
    // use the first request. This is descriptive and independent of geometry.
    while (target + 1 < c.targets.length && c.targets[target + 1].frame <= f) target++;
    const tag = band(c.targets[Math.max(0, target)]?.impact ?? null); tags[f] = tag; counts[tag].frames++;
    const body = o.frames[f].collisions.filter(x => x[1] >= 4 && x[1] <= 7);
    if (body.length) {start ??= f; for (const x of body) points.add(x[1]);}
    if ((!body.length || f === last) && start !== null) {
      const end = body.length ? f : f - 1;
      if (end - start + 1 >= 6) {
        const pointIds = [...points].sort(), seconds = (end - start + 1) / 40;
        ranges.push({start, end, seconds, points: pointIds, band: tags[start]});
        for (let j = start; j <= end; j++) counts[tags[j]].drag++;
      }
      start = null; points = new Set();
    }
  }
  const drag = Object.values(counts).reduce((n, c) => n + c.drag, 0), value = drag / last * 60;
  assert.ok(Math.abs(value - run.cells.get(c.id).guards.dragSecondsPerMinute) < 1e-9, 'guard replay differs');
  rows.push({label, id: c.id, song: c.song, perturbation: c.perturbation, trackHash: run.cells.get(c.id).trackHash,
    durationFrames: last, dragSecondsPerMinute: value, counts, ranges});
  Engine.retainOnly([]);
}
const result: any = {schema: 'line.quality-drag-diagnostic.v1',
  interpretation: 'Reproduces the existing six-consecutive-frame body-contact guard. Frames are attributed to the preceding authored request, with the first request used before the first beat. Bands describe timing context, not subjective quality or new optimization targets. Compare source-song means; long contact can be intentional.',
  sources: Object.fromEntries(Object.entries(runs).map(([k,r]) => [k,{planSha256:digest(r.run), compiler:r.run.identity, evaluator:r.run.evaluator}])), subsets: {}, rows};
for (const perturbed of [false, true]) {
  const subset = rows.filter(r => !!r.perturbation === perturbed), songs = [...new Set(subset.map(r => r.song))];
  const metrics: Record<string, (r: any) => number> = {totalSecondsPerMinute: r => r.dragSecondsPerMinute};
  for (const k of bands) {
    metrics[k+'DragSecondsPerRideMinute'] = r => r.counts[k].drag / r.durationFrames * 60;
    metrics[k+'FractionOfBandTime'] = r => r.counts[k].frames ? r.counts[k].drag / r.counts[k].frames : NaN;
  }
  result.subsets[perturbed?'perturbed':'authored'] = Object.fromEntries(Object.entries(metrics).map(([k, fn]) => {
    const avg = (label: string) => new Map(songs.map(song => [song, mean(subset.filter(r => r.label === label && r.song === song).map(fn))]));
    const a = avg('baseline'), b = avg('candidate'), paired = new Map(songs.map(s => [s, b.get(s)! - a.get(s)!]));
    return [k, {baseline: bootstrap(a), candidate: bootstrap(b), paired: bootstrap(paired), perSong: Object.fromEntries(paired)}];
  }));
}
writeFileSync(arg('out','/home/wyss/line/docs/research/quality-20261005-passive-drag.json'), JSON.stringify(result)+'\n');
console.log(JSON.stringify(result.subsets, null, 2));
