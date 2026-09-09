/** Cold-replay all 44 retained canonical geometries; no compilation or score changes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extractTrace } from '../v0/core/trace.ts';
import { AXIS_MEASURE } from '../v0/core/measure.ts';
import { contactRedirArcPxAtLanding } from '../v0/core/substrate.ts';
import { IMPACT_WINDOW, normImpact } from '../v0/types.ts';

const root = 'generated/benchmark-v2/review-2026-09';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const write = (p: string, value: unknown) => { const b = JSON.stringify(value, null, 2) + '\n'; writeFileSync(p, b); writeFileSync(p + '.sha256', hash(b) + '\n'); };
const review = read('benchmark/v2/studies/v2-alignment-review.json');
const engineSha256 = hash(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'));
assert.equal(engineSha256, read('benchmark/v2/campaign-baseline.json').engine_artifact_fingerprint);
const source = process.argv.find(a => a.startsWith('--source='))?.slice(9);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const longest = (xs: boolean[], value: boolean) => { let run = 0, best = 0; for (const x of xs) { run = x === value ? run + 1 : 0; best = Math.max(best, run); } return best; };
const detection = (frames: any[]) => ({ measurements: {
  airborne: frames.map(f => f.airborne), speed: frames.map(f => f.speed),
  velocity: frames.map(f => f.velocity), position: frames.map(f => f.position),
  contactLineIds: frames.map(f => f.contactLineIds ?? []),
}, events: [], terminus: { frame: frames.length - 1, reason: 'endOfSpec' } }) as any;
const reduce = (det: any, start: number, end: number) => {
  const ctx = { det, gap: { index: 0, startFrame: start, endFrame: end, endsWithContact: true, targets: {} }, rangeEndFrame: end, gapLines: [] };
  return Object.fromEntries(['air', 'speed', 'amplitude'].map(a => [a, AXIS_MEASURE[a as 'air'](ctx)!]));
};
mkdirSync(root + '/replays', { recursive: true });
if (source) {
  assert.equal(process.env.LR_ENGINE, 'wasm');
  const expected = review.cases.find((r: any) => r.sourceId === source); assert.ok(expected);
  const bytes = readFileSync(`generated/benchmark-v2/arc-850/integrated-public-750k/${source}.json`);
  assert.equal(hash(bytes), expected.recordSha256);
  const record = JSON.parse(bytes.toString());
  assert.equal(hash(JSON.stringify(record.track)), expected.trackHash);
  const trace = extractTrace(record.track), det = detection(trace.frames);
  assert.equal(trace.durationFrames, record.report.terminus.frame);
  let maxMeasurementDifference = 0;
  const gaps = record.report.gaps.map((g: any, i: number) => {
    const start = i ? Math.round(record.report.gaps[i - 1].t_end * 40) : 0, end = Math.round(g.t_end * 40);
    const achieved = reduce(det, start, end);
    const rawImpact = contactRedirArcPxAtLanding(det, Math.round(record.report.contacts[i].t_actual * 40), IMPACT_WINDOW);
    assert.notEqual(rawImpact, undefined);
    achieved.impact = normImpact(rawImpact!);
    for (const [a, detail] of Object.entries(g.axes) as [string, any][]) {
      const delta = Math.abs(detail.achieved - achieved[a]);
      maxMeasurementDifference = Math.max(maxMeasurementDifference, delta);
      assert.ok(delta < 1e-8, `${source}/${i}/${a}: ${delta}`);
    }
    const frames = trace.frames.slice(start, end + 1), speeds = frames.map(f => f.speed), air = frames.map(f => f.airborne), avg = mean(speeds);
    const landing = Math.round(record.report.contacts[i].t_actual * 40);
    let preLandingAirFrames = 0;
    for (let f = landing - 1; f >= 0 && trace.frames[f].airborne; f--) preLandingAirFrames++;
    if (i > 0 && end - start > 6) assert.ok(preLandingAirFrames >= 6);
    return { index: i, start: start / 40, end: end / 40, preLandingAirFrames,
      speedMean: avg, speedMin: Math.min(...speeds), speedMax: Math.max(...speeds),
      speedCv: Math.sqrt(mean(speeds.map(x => (x - avg) ** 2))) / avg,
      supportRuns: air.filter((a, j) => !a && (j === 0 || air[j - 1])).length,
      longestSupportSeconds: longest(air, false) / 40, longestAirSeconds: longest(air, true) / 40 };
  });
  const tailStart = Math.round(record.report.gaps.at(-1).t_end * 40), tailEnd = Math.round(expected.duration * 40);
  const tailFrames = trace.frames.slice(tailStart, tailEnd + 1), tail = { start: tailStart / 40, end: tailEnd / 40,
    targets: expected.tail?.targets, achieved: reduce(det, tailStart, tailEnd),
    longestSupportSeconds: longest(tailFrames.map(f => f.airborne), false) / 40,
    supportRuns: tailFrames.filter((f, i) => !f.airborne && (i === 0 || tailFrames[i - 1].airborne)).length };
  write(`${root}/replays/${source}.json`, { sourceId: source, trackHash: expected.trackHash,
    frames: trace.frames.length, maxMeasurementDifference, features: trace.features, tail, gaps });
  write(`${root}/replays/${source}.trace.json`, trace);
} else {
  const queue = review.cases.map((r: any) => r.sourceId);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      await new Promise<void>((resolve, reject) => {
        const p = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, `--source=${id}`], { env: { ...process.env, LR_ENGINE: 'wasm' }, stdio: 'inherit' });
        p.once('error', reject); p.once('exit', code => code === 0 ? resolve() : reject(new Error(`${id}: ${code}`)));
      });
    }
  }));
  const replays = review.cases.map((r: any) => read(`${root}/replays/${r.sourceId}.json`));
  const frames = (speeds: number[], airs: boolean[]) => speeds.map((speed, i) => ({ speed, airborne: airs[i], velocity: { x: speed, y: 0 }, position: { x: 0, y: 0 } }));
  const constant = frames(Array(40).fill(9), Array(40).fill(false));
  const surging = frames([...Array(20).fill(4.5), ...Array(20).fill(13.5)], Array(40).fill(false));
  const continuous = frames(Array(40).fill(9), [...Array(20).fill(false), ...Array(20).fill(true)]);
  const fragmented = frames(Array(40).fill(9), Array.from({ length: 40 }, (_, i) => i % 2 === 0));
  assert.deepEqual(reduce(detection(constant), 0, 39), reduce(detection(surging), 0, 39));
  assert.deepEqual(reduce(detection(continuous), 0, 39), reduce(detection(fragmented), 0, 39));
  const result = { schema: 'line.v2-alignment-replay.v1', researchOnly: true,
    reviewSha256: hash(readFileSync('benchmark/v2/studies/v2-alignment-review.json')),
    scriptSha256: hash(readFileSync(import.meta.filename)), engineSha256,
    cases: replays.length, scoredGaps: replays.reduce((s: number, r: any) => s + r.gaps.length, 0),
    replayFrames: replays.reduce((s: number, r: any) => s + r.frames, 0),
    maxMeasurementDifference: Math.max(...replays.map((r: any) => r.maxMeasurementDifference)),
    counterexamples: { caveat: 'Synthetic measurement fixtures, not physically simulated tracks or valid complete benchmark entries. They demonstrate reduction non-identifiability, not a current compiler exploit.',
      constantVsSurging: { sameMeasurements: reduce(detection(constant), 0, 39), constantSpeed: 9, surgingSpeeds: [4.5, 13.5] },
      continuousVsFragmented: { sameMeasurements: reduce(detection(continuous), 0, 39), continuousLongestSupport: .5, fragmentedLongestSupport: .025 } },
    replays };
  write('benchmark/v2/studies/v2-alignment-replay.json', result);
  console.log(JSON.stringify({ cases: result.cases, scoredGaps: result.scoredGaps, frames: result.replayFrames, maxMeasurementDifference: result.maxMeasurementDifference }));
}
