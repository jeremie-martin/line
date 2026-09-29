/** Verify local gallery artifacts and publish compact measurements, never raw tracks. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname, relative} from 'node:path';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const read = (path: string, expected?: string) => {
  const body = readFileSync(path);
  assert.equal(hash(body), expected ?? readFileSync(path + '.sha256', 'utf8').trim(), path);
  return JSON.parse(body.toString());
};
const args = process.argv.slice(2), output = args.find(a => a.startsWith('--out='))?.slice(6);
assert.ok(output, '--out=PATH is required');
const paths = args.filter(a => !a.startsWith('--')).map(p => resolve(p));
assert.ok(paths.length > 0, 'supply gallery manifest paths');
const studies = paths.map(path => ({path, manifest: read(path)}));
const first = studies[0].manifest;
const rows: any[] = [], ids = new Set<string>();
let normalLines = 0;
for (const {path, manifest} of studies) {
  assert.equal(manifest.schema, 'line.motion-gallery.v1');
  for (const key of ['compiler', 'judge', 'harness', 'observer', 'cases', 'jitter', 'methods'])
    assert.deepEqual(manifest.plan[key], first.plan[key], `unmatched ${key}`);
  const plan = read(resolve(dirname(path), 'plan.json'), manifest.planSha256);
  assert.deepEqual(plan, manifest.plan);
  assert.equal(manifest.cells.length, plan.cases.length * plan.seeds.length * plan.budgets.length * plan.methods.length);
  for (const c of manifest.cells) {
    assert.ok(!ids.has(c.id), 'duplicate comparison'); ids.add(c.id);
    const r = read(resolve(dirname(path), c.path), c.sha256);
    assert.equal(r.planSha256, manifest.planSha256);
    const {schema, planSha256, case: authored, track, trace, ...metadata} = r;
    const {path: cellPath, sha256, ...expected} = c;
    assert.deepEqual(metadata, expected);
    assert.deepEqual(authored, plan.cases.find((x: any) => x.id === c.caseId));
    assert.equal(hash(JSON.stringify(track)), c.trackHash);
    assert.equal(track.lines.length, c.lines);
    assert.ok(track.lines.every((l: any) => l.type === 0 && ['x1','x2','y1','y2'].every(k => Number.isFinite(l[k]))));
    normalLines += track.lines.length;
    assert.ok(Number.isSafeInteger(c.physicalFrames) && c.physicalFrames <= c.budget);
    if (c.work) {
      assert.equal(c.work.feedback + c.work.reconstruction, c.physicalFrames);
      assert.equal(c.work.lastMeter, c.work.reconstruction || c.work.feedback);
      const reconstruction = c.construction.reconstruction;
      if (reconstruction) assert.equal(reconstruction.referenceFrames + reconstruction.observationFrames + reconstruction.reconstructionFrames, c.work.reconstruction);
    }
    assert.equal(trace.fps, 40);
    rows.push({...c, study: relative(process.cwd(), path)});
  }
}
const summary = first.plan.methods.flatMap((method: string) => [...new Set(rows.map(r => r.budget))].sort((a,b)=>a-b).map(budget => {
  const selected = rows.filter(r => r.method === method && r.budget === budget);
  return {method, budget, runs: selected.length, valid: selected.filter(r => r.score.valid).length,
    meanScore: selected.reduce((s,r)=>s+r.score.score,0)/selected.length,
    meanCompileMs: selected.reduce((s,r)=>s+r.compileMs,0)/selected.length,
    meanLines: selected.reduce((s,r)=>s+r.lines,0)/selected.length,
    totalPhysicalFrames: selected.reduce((s,r)=>s+r.physicalFrames,0),
    distinctTracks: new Set(selected.map(r=>r.trackHash)).size,
    ...(method === 'scattered' ? {selectedFragments: selected.filter(r=>r.construction.selected === 'contact-fragments').length} : {})};
}));
const pairs = rows.filter(r=>r.method==='scattered').map(r=>{
  const baseline = rows.find(b=>b.method==='segments' && b.caseId===r.caseId && b.budget===r.budget && b.seed===r.seed);
  assert.ok(baseline, 'missing original scattered comparison');
  assert.equal(baseline.physicalFrames,r.work.feedback);
  return {caseId:r.caseId,budget:r.budget,seed:r.seed,before:baseline.score.score,after:r.score.score,delta:r.score.score-baseline.score.score};
});
const evidence = {schema:'line.motion-gallery-expansion.v1',
  plans:studies.map(({path,manifest})=>({manifest:relative(process.cwd(),path),sha256:hash(readFileSync(path)),planSha256:manifest.planSha256,plan:manifest.plan})),
  checks:{runs:rows.length,normalLines,nonNormalLines:0,allChecksumsAndWorkVerified:true}, summary,pairs,
  rows:rows.map(r=>({id:r.id,caseId:r.caseId,method:r.method,budget:r.budget,seed:r.seed,jitter:r.jitter,
    score:r.score.score,valid:r.score.valid,hardFailures:r.score.hardFailures,physicalFrames:r.physicalFrames,
    compileMs:r.compileMs,lines:r.lines,trackHash:r.trackHash,artifactSha256:r.sha256,study:r.study,
    work:r.work,construction:r.construction})),
  interpretation:'Research passages, not a canonical headline. First four passages/seeds 101–102 informed development. Remaining seeds and final two passages extend evaluation. No broad generalization or visual approval claim. Wall times include shared-host contention and model loading.'};
const out=resolve(output),body=JSON.stringify(evidence,null,2)+'\n';
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
console.log(JSON.stringify({checks:evidence.checks,summary}));
