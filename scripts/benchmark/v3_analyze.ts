/** Retain compact, reproducible evidence for the first frozen V3 comparison. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { loadCases, caseGaps, sha } from '../../benchmark/v3/model.ts';
import { scoreObservations, summarize } from '../../benchmark/v3/evaluator.ts';
import { policy } from '../../benchmark/v3/policy.ts';

const cases = loadCases(), casesById = new Map(cases.map(c => [c.id, c]));
const verified = (p: string) => { const b = readFileSync(p); assert.equal(sha(b), readFileSync(p + '.sha256', 'utf8').trim()); return JSON.parse(b.toString()); };
const write = (p: string, value: unknown) => { const b = JSON.stringify(value, null, 2) + '\n'; writeFileSync(p, b); writeFileSync(p + '.sha256', sha(b) + '\n'); };
const paths = { before: 'generated/benchmark-v3/validated-828/run.json', after: 'generated/benchmark-v3/validated-852/run.json' };
const before = verified(paths.before), after = verified(paths.after);
assert.equal(before.plan.suiteFingerprint, after.plan.suiteFingerprint);
assert.deepEqual(before.plan.seeds, [16, 17]); assert.deepEqual(after.plan.seeds, [16, 17]);
assert.equal(before.plan.budget, 750000); assert.equal(after.plan.budget, 750000);
assert.deepEqual(summarize(before.rows, cases, before.plan.seeds), before.summary);
assert.deepEqual(summarize(after.rows, cases, after.plan.seeds), after.summary);
const round = (n: number) => Math.round(n * 10000) / 10000;
const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
mkdirSync('benchmark/v3/runs', { recursive: true });
const archives: Record<string, unknown> = {};
for (const [label, source] of Object.entries(paths)) {
  const raw = readFileSync(source), compressed = gzipSync(raw, { level: 9 }), destination = `benchmark/v3/runs/initial-${label}.json.gz`;
  writeFileSync(destination, compressed); writeFileSync(destination + '.sha256', sha(compressed) + '\n');
  archives[label] = { path: destination, rawSha256: sha(raw), compressedSha256: sha(compressed), bytes: compressed.length };
  const run = label === 'before' ? before : after, root = source.slice(0, -'/run.json'.length);
  for (const r of run.rows) {
    assert.equal(r.planSha256, sha(readFileSync(root + '/plan.json')));
    const track = verified(`${root}/tracks/${r.sourceId}-${r.seed}.json`);
    assert.equal(sha(JSON.stringify(track)), r.trackHash);
    assert.ok(r.resources.physicalFrames <= 750000);
  }
}
const paired = after.summary.specifications.map((a: any) => { const b = before.summary.specifications.find((b: any) => a.id === b.id);
  return { id: a.id, provenance: casesById.get(a.id)!.provenance.kind, before: b.score, after: a.score, delta: round(a.score - b.score), validBefore: b.valid, validAfter: a.valid }; });
const seedReadout = (run: any) => ({
  headlines: run.plan.seeds.map((seed: number) => ({ seed, headline: summarize(run.rows.filter((r: any) => r.seed === seed), cases, [seed]).headline })),
  casesWithDifferentTracks: run.summary.specifications.filter((s: any) => s.distinctTracks > 1).length,
  maximumCaseScoreRange: Math.max(...cases.map(c => { const scores = run.rows.filter((r: any) => r.sourceId === c.id).map((r: any) => r.score.score); return Math.max(...scores) - Math.min(...scores); })) });
const perfect = (predicate: (source: string, o: any) => boolean) => summarize(after.rows.map((r: any) => ({ ...r,
  score: scoreObservations(r.observations.map((o: any) => predicate(r.sourceId, o) ? { ...o, error: 0 } : o), r.score.hardFailures) })), cases, after.plan.seeds).headline;
const resourceReadout = (run: any) => ({
  totalPhysicalFrames: run.rows.reduce((s: number, r: any) => s + r.resources.physicalFrames, 0),
  maxPhysicalFrames: Math.max(...run.rows.map((r: any) => r.resources.physicalFrames)),
  meanCompileMs: average(run.rows.map((r: any) => r.resources.compileMs)),
  maximumCompileProcessRssKb: Math.max(...run.rows.map((r: any) => r.resources.compileMaxRssKb)),
  coldJudgeFrameSamples: run.rows.reduce((s: number, r: any) => s + r.judgeFrameSamples, 0),
  note: 'Both panels used 14 workers concurrently on the same shared host. Timings and process RSS are descriptive, not controlled speedup claims. Judge work is separately reported outside the compiler budget.' });
const geometry = (run: any) => ({ allNormal: run.rows.every((r: any) => r.geometry.allNormal),
  singleSegmentComponents: run.rows.reduce((s: number, r: any) => s + r.geometry.singleSegmentComponents, 0),
  shortestComponent: Math.min(...run.rows.map((r: any) => r.geometry.shortestComponent)),
  geometrySourceSha256: run.plan.compiler.files['scripts/v0/optimizer/arc_geometry.ts'],
  note: 'Endpoint connectivity and unchanged approved geometry source support the retained arc contract; these are not a new beauty metric.' });
const bridge = verified('generated/benchmark-v3/fixed-track-bridge.json');
const inputLock = JSON.parse(readFileSync('benchmark/v3/catalog.lock.json', 'utf8'));
assert.equal(execFileSync('git', ['diff', '--name-only', '3831bae4', '--', 'benchmark/v3/specifications.json.gz', 'benchmark/v3/catalog.lock.json', 'benchmark/v3/policy.ts'], { encoding: 'utf8' }).trim(), '');
const evidence = { schema: 'line.benchmark-v3.initial-validation.v1', date: '2026-09-09',
  authoringCommit: '3831bae4', adapterFixCommit: 'bf23e8ab', suiteFingerprint: after.plan.suiteFingerprint, inputSha256: inputLock.specificationsSha256,
  cases: 88, seeds: [16, 17], budget: 750000, archives,
  before: before.summary, after: after.summary, headlineDelta: round(after.summary.headline - before.summary.headline),
  improvedCases: paired.filter((r: any) => r.delta > 0).length, regressedCases: paired.filter((r: any) => r.delta < 0).length, pairedCases: paired,
  byProvenance: Object.fromEntries(['v2_bridge', 'new_program', 'exposed_music_reference'].map(kind => {
    const rs = paired.filter((r: any) => r.provenance === kind); return [kind, { cases: rs.length, arithmeticMeanBefore: average(rs.map((r: any) => r.before)), arithmeticMeanAfter: average(rs.map((r: any) => r.after)), arithmeticMeanDelta: average(rs.map((r: any) => r.delta)), note: 'Unweighted descriptive case means, not canonical headlines.' }]; })),
  seedReplication: { before: seedReadout(before), after: seedReadout(after) },
  resources: { before: resourceReadout(before), after: resourceReadout(after) }, geometry: { before: geometry(before), after: geometry(after) },
  counterfactuals: { note: 'Analytical edits of observations, not achievable new tracks; effects are not additive.',
    perfectTails: perfect((_id, o) => o.tail), perfectLongSupportedEpisodes: perfect((id, o) => casesById.get(id)!.group === 'low_air_frontier' && !o.tail && o.endFrame - o.startFrame >= 80),
    perfectAxes: Object.fromEntries(['air', 'speed', 'impact', 'amplitude'].map(axis => [axis, perfect((_id, o) => o.axis === axis)])) },
  lowAirEpisodeWeights: cases.filter(c => c.group === 'low_air_frontier').map(c => { const gaps = caseGaps(c), selected = gaps.filter(g => g.endsWithContact && g.endFrame - g.startFrame >= 80);
    return { id: c.id, selectedGaps: selected.length, equalGapShare: selected.length / gaps.filter(g => g.endsWithContact).length,
      elapsedSpanShare: selected.reduce((s, g) => s + g.endFrame - g.startFrame, 0) / c.durationFrames }; }),
  fixedTrackBridge: { originalTrackCount: 44, scores: Object.fromEntries(Object.entries(bridge.summaries).map(([k, v]: any) => [k, v.score])), note: bridge.note },
  adapterRecovery: { inputsAndPolicyUnchanged: true, aborted: ['852', '828'].map(label => JSON.parse(readFileSync(`generated/benchmark-v3/initial-${label}/aborted.json`, 'utf8'))),
    note: 'No score-driven case edits. The input API rejected the original encoding, so both incomplete attempts were retained and both full panels rerun after fixing the adapter.' },
  limitations: ['The frozen compiler comparison supports useful discrimination; it does not validate an aesthetic proxy or establish new owner audiovisual approval.',
    'All catalog cases become exposed development material after this publication. New programs share family grammars; the five added real-music works were already exposed.',
    'Two seeds are a finite panel. Exact replication here does not guarantee future stochastic compilers need only two seeds.',
    'The necessary airtime constraints do not prove all combined targets are physically achievable.',
    'V3 scores are not numerically comparable with original V2 headlines. V2 remains unchanged.'] };
write('benchmark/v3/initial-validation.json', evidence);
write('benchmark/v3/baseline.json', { schema: 'line.benchmark-v3.baseline.v1', status: 'evaluated-pilot-baseline', label: 'arc-control-memory-on-v3',
  compilerCommit: after.plan.compiler.commit, compilerSourceSha256: after.plan.compiler.sourceSha256, suiteFingerprint: after.plan.suiteFingerprint,
  inputSha256: inputLock.specificationsSha256, headline: after.summary.headline, valid: after.summary.valid, runs: after.summary.runs,
  budget: policy.budget, seeds: [...policy.seeds], archive: archives.after,
  note: 'Separate V3 baseline. No compiler promotion, V2 rebaseline, or audiovisual approval is implied.' });
write('benchmark/v3/fixed-track-bridge.json', { schema: bridge.schema, note: bridge.note, summaries: bridge.summaries,
  rows: bridge.rows.map(({ observations, ...row }: any) => row) });
console.log(JSON.stringify({ before: before.summary.headline, after: after.summary.headline, delta: evidence.headlineDelta,
  improved: evidence.improvedCases, regressed: evidence.regressedCases, seedReplication: evidence.seedReplication, archives }, null, 2));
