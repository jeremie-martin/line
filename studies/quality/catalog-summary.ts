/** Complete-panel evidence only; source groups, not seeds, are the uncertainty units. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {summarize, bootstrap, mean} from '../../tools/eval/summary.ts';
const dir = '/tmp/line-quality-catalog-panel-20261006';
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plan = JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8'));
const ids = plan.work.map((w: any) => `${w.id}~${w.seed}`);
for (const label of ['baseline', 'candidate']) {
  assert.deepEqual(readdirSync(join(dir, label)).filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort(), [...ids].sort());
}
const cases = plan.work.map((w: any) => {
  const id = `${w.id}~${w.seed}`;
  let arrangement: unknown;
  const pair = Object.fromEntries(['baseline', 'candidate'].map(label => {
    const c = JSON.parse(readFileSync(join(dir, label, id + '.json'), 'utf8'));
    assert.equal(c.planSha256, digest(plan)); assert.equal(c.inputSha256, w.inputSha256);
    const cp = JSON.parse(gunzipSync(readFileSync(join(dir, label, id + '.checkpoint.json.gz'))).toString());
    assert.equal(c.trackHash, digest(cp.track));
    assert.equal(c.physicalFrames, cp.work.physicalFrames); assert.equal(cp.budget, cp.work.allowance);
    assert.ok(cp.work.physicalFrames <= cp.work.allowance, 'physical allowance exceeded: '+id);
    assert.equal(cp.work.stages.reduce((n:any,s:any)=>n+s.physicalFrames,0), cp.work.physicalFrames);
    if (arrangement === undefined) arrangement = cp.repertoire.plan; else assert.deepEqual(cp.repertoire.plan, arrangement, 'construction plan changed: '+id);
    assert.ok(cp.track.lines.every((l: any) => l.type === 0));
    return [label, {trackHash: c.trackHash, failure: c.failure, requested: c.requested, constructed: c.constructed,
      layoutFulfilled: c.layoutFulfilled, ...summarize(c), cpuSeconds: c.cpuMs / 1000, peakRssMiB: c.maxRssKiB / 1024}];
  }));
  const source = JSON.parse(readFileSync(join(dir, 'candidate', id + '.json'), 'utf8'));
  return {id, inputSha256: w.inputSha256, group: source.group, constructionPlanSha256: digest(arrangement), ...pair};
});
const groups = [...new Set(cases.map((c: any) => c.group))] as string[];
const first = JSON.parse(readFileSync(join(dir, 'candidate', ids[0] + '.json'), 'utf8'));
const metrics = [...Object.keys(summarize(first)), 'cpuSeconds', 'peakRssMiB'];
const subsets: any = {};
for (const [name, filter] of Object.entries({all: (_c: any) => true,
  completeBoth: (c: any) => c.baseline.complete && c.candidate.complete})) {
  const rows = cases.filter(filter), values: any = {};
  for (const metric of metrics) {
    const perGroup = new Map<string, number>();
    const baseline = new Map<string, number>(), candidate = new Map<string, number>();
    let n = 0;
    for (const group of groups) {
      // Null is a missing measurement, never zero. Use the same finite pairs on each side.
      const pairs = rows.filter((c: any) => c.group === group && typeof c.baseline[metric] === 'number' &&
        typeof c.candidate[metric] === 'number' && Number.isFinite(c.baseline[metric]) && Number.isFinite(c.candidate[metric]));
      n += pairs.length;
      baseline.set(group, mean(pairs.map((c: any) => c.baseline[metric])));
      candidate.set(group, mean(pairs.map((c: any) => c.candidate[metric])));
      perGroup.set(group, mean(pairs.map((c: any) => c.candidate[metric] - c.baseline[metric])));
    }
    values[metric] = {finitePairs: n, finiteGroups: [...perGroup.values()].filter(Number.isFinite).length, baseline: bootstrap(baseline), candidate: bootstrap(candidate), paired: bootstrap(perGroup), perGroup: Object.fromEntries(perGroup)};
  }
  subsets[name] = {cases: rows.length, metrics: values};
}
const output = {schema: 'line.quality-catalog-evidence.v1', plan, planSha256: digest(plan),
  interpretation: 'Training-catalog robustness, not unseen-music generalization. Equal source-group weight; group bootstrap. All cases and the common completed subset are both reported. Undefined frozen scores remain missing. Process CPU and peak RSS are measured during compilation; wall time is confounded by other jobs.',
  groups, completion: {baseline: cases.filter((c: any) => c.baseline.complete).length, candidate: cases.filter((c: any) => c.candidate.complete).length,
    recovered: cases.filter((c: any) => !c.baseline.complete && c.candidate.complete).map((c: any) => c.id),
    regressed: cases.filter((c: any) => c.baseline.complete && !c.candidate.complete).map((c: any) => c.id)}, subsets, cases};
writeFileSync('/home/wyss/line/docs/research/quality-20261005-catalog.json', JSON.stringify(output) + '\n');
console.log(JSON.stringify(output.completion));
for (const subset of Object.keys(subsets)) {
  console.log(subset, subsets[subset].cases);
  for (const [key, value] of Object.entries(subsets[subset].metrics) as any) console.log(key, value.paired, value.finitePairs);
}
