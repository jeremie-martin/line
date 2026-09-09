/** Read-only V2 construct review. Counterfactuals are report edits, never tracks. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { developmentCases, qualificationCases } from '../../benchmark/v2/catalog.ts';
import { benchmarkPolicy } from '../../benchmark/v2/policy.ts';
import { applyJolt } from '../produce/seed.ts';
import { buildAxisContract, scoreV2Report, summarizeDevelopmentBudget } from '../v0/benchmark_v2/evaluator.ts';
import { effectiveAxes, sliceTimeline } from '../v0/core/substrate.ts';
import { secToFrame } from '../v0/types.ts';
import { MIN_LANDING_AIRBORNE_FRAMES } from '../lib/detector.ts';

const out = 'benchmark/v2/studies/v2-alignment-review.json';
const local = 'generated/benchmark-v2/review-2026-09';
const richRoot = 'generated/benchmark-v2/arc-850/integrated-public-750k';
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const baseline = read('benchmark/v2/campaign-baseline.json');
const compressed = readFileSync(baseline.development.compressed_archive);
assert.equal(hash(compressed), baseline.development.compressed_archive_sha256);
const raw = gunzipSync(compressed);
assert.equal(hash(raw), baseline.development.archive_sha256);
const archive = JSON.parse(raw.toString());
const suite = read('benchmark/v2/compat/suite-manifest.json');
const budget = 750000;
const axes = ['air', 'speed', 'impact', 'amplitude'] as const;
const round = (x: number) => Math.round(x * 1e8) / 1e8;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const distribution = (xs: number[]) => {
  const sorted = xs.slice().sort((a, b) => a - b);
  const q = (p: number) => {
    const i = p * (sorted.length - 1), lo = Math.floor(i);
    return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
  };
  return { n: xs.length, min: sorted[0], p10: q(.1), median: q(.5), p90: q(.9), max: sorted.at(-1), mean: mean(xs) };
};
const rows = developmentCases.map(entry => {
  const sourceId = entry.case.metadata.id;
  const canonical = archive.runs.filter((r: any) => r.task.sourceId === sourceId);
  assert.equal(canonical.length, 8);
  assert.equal(new Set(canonical.map((r: any) => r.trackHash)).size, 1);
  const path = `${richRoot}/${sourceId}.json`, bytes = readFileSync(path);
  assert.equal(hash(bytes), readFileSync(path + '.sha256', 'utf8').trim());
  const rich = JSON.parse(bytes.toString());
  assert.equal(hash(JSON.stringify(rich.track)), canonical[0].trackHash);
  for (const r of canonical) {
    assert.deepEqual(r.report, rich.report);
    assert.deepEqual(r.score, rich.score);
    assert.equal(r.stats.sim_frames, rich.stats.sim_frames);
  }
  const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, entry.case.metadata.eligibleComponents, entry.case.metadata.diagnosticComponents);
  assert.deepEqual(scoreV2Report(rich.report, spec.contacts.length, contract, suite), rich.score);
  const gaps = sliceTimeline(spec.contacts.map(c => secToFrame(c.t)).sort((a, b) => a - b), secToFrame(spec.duration));
  const observations = rich.report.gaps.map((g: any) => {
    const gap = gaps[g.gap_index], d = gap.endFrame - gap.startFrame, n = d + 1;
    const authored = { ...effectiveAxes(gap, spec), impact: spec.contacts.find(c => secToFrame(c.t) === gap.endFrame)?.impact };
    for (const [axis, detail] of Object.entries(g.axes) as [keyof typeof authored, any][]) {
      assert.ok(Math.abs(detail.target - authored[axis]!) < 1e-10, `${sourceId}/${g.gap_index}/${axis}: authored target`);
      assert.ok(Math.abs(detail.error - Math.abs(detail.achieved - detail.target)) < 1e-10, `${sourceId}/${g.gap_index}/${axis}: error`);
    }
    // For d>=7, a valid contact at e-1..e+1 has at least six immediately
    // preceding airborne frames, all inside [e-d,e]. For short gaps a bounce
    // is eligible. Exclude the startup and short-gap cases from this bound.
    const minAirFrames = g.gap_index > 0 && d > MIN_LANDING_AIRBORNE_FRAMES ? MIN_LANDING_AIRBORNE_FRAMES : 0;
    const target = g.axes.air?.target;
    const nearest = target === undefined ? null : Math.max(minAirFrames, Math.min(n, Math.round(target * n))) / n;
    const airFloor = minAirFrames / n;
    if (target !== undefined) {
      assert.ok(g.axes.air.achieved + 1e-10 >= airFloor, `${sourceId}/${g.gap_index}: air lower bound`);
      assert.ok(Math.abs(g.axes.air.achieved * n - Math.round(g.axes.air.achieved * n)) < 1e-8);
    }
    return { index: g.gap_index, start: gap.startFrame / 40, end: gap.endFrame / 40, frames: d,
      phase: entry.case.metadata.phases.find(p => gap.endFrame / 40 > p.start && gap.endFrame / 40 <= p.end)?.id ?? null,
      axes: g.axes, airFloor, minAirFrames, nearestAdmissibleAir: nearest,
      minimumAirError: nearest === null ? null : Math.abs(nearest - target),
      targetBelowLandingFloor: target !== undefined && target < airFloor - 1e-10 };
  });
  const tail = gaps.find(g => !g.endsWithContact);
  return { sourceId, metadata: entry.case.metadata, spec, contract, rich, observations,
    canonicalTrackHash: canonical[0].trackHash, richSha256: hash(bytes), duration: spec.duration,
    tail: tail ? { seconds: (tail.endFrame - tail.startFrame) / 40, targets: effectiveAxes(tail, spec) } : null };
});
const scoreRows = (edit?: (row: any, gap: any, axis: string, detail: any) => void) => rows.map(row => {
  const report = structuredClone(row.rich.report);
  if (edit) for (const gap of report.gaps) for (const [axis, detail] of Object.entries(gap.axes)) edit(row, gap, axis, detail);
  return { sourceId: row.sourceId, budget, actualSeed: 16, seedSlot: 0,
    score: scoreV2Report(report, row.spec.contacts.length, row.contract, suite) };
});
const aggregate = (rs: ReturnType<typeof scoreRows>) => summarizeDevelopmentBudget(rs, budget, suite);
const original = aggregate(scoreRows());
assert.equal(original.score, baseline.development.canonical_headline);
const hypothetical = (edit: Parameters<typeof scoreRows>[0]) => {
  const summary = aggregate(scoreRows(edit));
  return { headline: summary.score, delta: round(summary.score - original.score), strata: summary.strata };
};
const perfectAxis = Object.fromEntries(axes.map(axis => [axis, hypothetical((_r, _g, a, d) => { if (a === axis) d.error = 0; })]));
const floorCeiling = hypothetical((r, g, a, d) => { d.error = a === 'air' ? r.observations[g.gap_index].minimumAirError : 0; });
const floorCaseScores = new Map(scoreRows((r, g, a, d) => { d.error = a === 'air' ? r.observations[g.gap_index].minimumAirError : 0; }).map(r => [r.sourceId, r.score.score]));
const bestAdmissibleAir = hypothetical((r, g, a, d) => { if (a === 'air') d.error = r.observations[g.gap_index].minimumAirError; });
const all = rows.flatMap(r => r.observations.map((g: any) => ({ sourceId: r.sourceId, ...g })));
const conflicted = all.filter(g => g.targetBelowLandingFloor);
const pooledAxes = Object.fromEntries(axes.map(axis => {
  const obs = all.flatMap(g => g.axes[axis] ? [g.axes[axis]] : []);
  return [axis, { observations: obs.length, rms: Math.sqrt(mean(obs.map(x => x.error ** 2))),
    meanSignedResidual: mean(obs.map(x => x.achieved - x.target)),
    within005: obs.filter(x => x.error <= .05).length / obs.length,
    within010: obs.filter(x => x.error <= .1).length / obs.length,
    target: distribution(obs.map(x => x.target)), achieved: distribution(obs.map(x => x.achieved)) }];
}));
const lowAirRows = rows.filter(r => r.metadata.originFamily === 'low_air_frontier');
const isRideout = (r: any, g: any) => r.metadata.originFamily === 'low_air_frontier' && r.observations[g.gap_index].frames >= 80;
const perfectRideout = hypothetical((r, g, _a, d) => { if (isRideout(r, g)) d.error = 0; });
const fullyAirborneRideout = hypothetical((r, g, a, d) => { if (a === 'air' && isRideout(r, g)) d.error = Math.abs(1 - d.target); });
const unitErrorRideout = hypothetical((r, g, _a, d) => { if (isRideout(r, g)) d.error = 1; });
const worstCaseFailure = rows.map(r => {
  const rs = scoreRows();
  rs.find(x => x.sourceId === r.sourceId)!.score = { ...r.rich.score, score: 0, valid: false };
  return { sourceId: r.sourceId, headlineIfThisCaseAlwaysInvalid: aggregate(rs).score };
});
const cases = rows.map(r => ({ sourceId: r.sourceId, metadata: r.metadata, score: r.rich.score.score,
  measurementUpperBoundScore: floorCaseScores.get(r.sourceId),
  components: r.rich.score.components, gaps: r.observations.length, duration: r.duration, tail: r.tail,
  trackHash: r.canonicalTrackHash, recordSha256: r.richSha256,
  belowAirFloor: r.observations.filter((g: any) => g.targetBelowLandingFloor).length,
  gapFrames: distribution(r.observations.map((g: any) => g.frames)),
  minimumAirRms: Math.sqrt(mean(r.observations.map((g: any) => (g.minimumAirError ?? 0) ** 2))),
  longGaps: r.observations.filter((g: any) => g.frames >= 80).map((g: any) => ({ index: g.index, seconds: g.frames / 40, phase: g.phase, axes: g.axes }))
}));
const result = {
  schema: 'line.v2-alignment-review.v1', date: '2026-09-09', researchOnly: true,
  provenance: { baseline: 'benchmark/v2/campaign-baseline.json', baselineSha256: hash(readFileSync('benchmark/v2/campaign-baseline.json')),
    archiveSha256: hash(raw), suiteFingerprint: archive.identity.suiteFingerprint,
    scoringProtocolFingerprint: archive.identity.scoringProtocolFingerprint,
    scriptSha256: hash(readFileSync(import.meta.filename)) },
  interpretation: ['All counterfactuals use the unchanged scorer and hierarchy, modifying errors in copies of valid reports; they are NOT simulated achievable improvements.',
    'The measurement upper bound ignores all coupled physics and all non-air errors. It is an optimistic necessary-condition bound, not an attainable ceiling.',
    'Observation-pooled diagnostics are not the weighted headline. Zero seed variation is conditional on these exposed cases.'],
  canonical: { headline: original.score, runs: archive.runs.length, distinctTracks: new Set(archive.runs.map((r: any) => r.trackHash)).size,
    scores: distribution(rows.map(r => r.rich.score.score)), atLeast900: rows.filter(r => r.rich.score.score >= 900).length,
    atLeast950: rows.filter(r => r.rich.score.score >= 950).length, strata: original.strata, groups: original.groups },
  coverage: { cases: rows.length, parents: developmentCases.filter(e => !e.case.metadata.variant).length,
    totalScoredGaps: all.length, durationSeconds: rows.reduce((s, r) => s + r.duration, 0),
    unscoredTailSeconds: rows.reduce((s, r) => s + (r.tail?.seconds ?? 0), 0),
    tailDistribution: distribution(rows.map(r => r.tail?.seconds ?? 0)),
    qualification: qualificationCases.map(e => ({ id: e.case.metadata.id, metadata: e.case.metadata })) },
  pooledAxes, perfectAxis, bestAdmissibleAir, measurementUpperBound: { ...floorCeiling, conflictedGaps: conflicted.length,
    conflictedCases: new Set(conflicted.map(g => g.sourceId)).size, conflictedGapRecords: conflicted.map(g => ({ sourceId: g.sourceId, index: g.index, frames: g.frames, target: g.axes.air.target, achieved: g.axes.air.achieved, floor: g.airFloor })),
    unavoidableAirSquaredError: all.reduce((s, g) => s + (g.minimumAirError ?? 0) ** 2, 0),
    observedAirSquaredError: all.reduce((s, g) => s + (g.axes.air?.error ?? 0) ** 2, 0) },
  lowAirRideouts: { definition: 'Existing low-air-frontier intervals lasting at least 2 seconds, selected from authored structure, not errors.',
    perfectRideout, fullyAirborneRideout, unitErrorRideout,
    cases: lowAirRows.map(r => ({ sourceId: r.sourceId, totalGaps: r.observations.length,
      selectedGaps: r.observations.filter((g: any) => g.frames >= 80).length,
      selectedSeconds: r.observations.filter((g: any) => g.frames >= 80).reduce((s: number, g: any) => s + g.frames / 40, 0), duration: r.duration })) },
  worstCaseFailure, cases,
};
mkdirSync(local, { recursive: true });
for (const [path, value] of [[out, result], [`${local}/gap-observations.json`, all]] as const) {
  const body = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(path, body); writeFileSync(path + '.sha256', hash(body) + '\n');
}
console.log(JSON.stringify({ out, canonical: result.canonical, perfectAxis, measurementUpperBound: { ...floorCeiling, conflicts: conflicted.length }, lowAirRideouts: result.lowAirRideouts, pooledAxes, coverage: result.coverage }, null, 2));
