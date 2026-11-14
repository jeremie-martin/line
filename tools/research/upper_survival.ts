/** Why strong catches from above come apart (report only). Compiles V8 rides in-process (like crash_edge.ts) and, for
 * every candidate built from the opposing side (`contactSide` −1) on an interval asking 0.6 or more that the rider did
 * not survive, reads from frames already simulated: which rider points touched first after the catch, how the rider was
 * set against the line the frame before (the body above or below the sled, the sled's pitch against the arrival), how
 * many frames until it came apart, and the strongest strike before that. The compile is unchanged (track identity is
 * checked against a saved arm). The survivors compared with are the accepted clean upper hits (upper_hits.ts fields).
 *   node tools/research/upper_survival.ts run OUT [--jobs=N] [--seed=101]
 *   node tools/research/upper_survival.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {withRejectionObserver} from '../../scripts/v0/optimizer/arc_evaluate.ts';
import {impactRuler} from '../../scripts/v0/optimizer/impact_accounts.ts';
import {extractRawTrajectoryWindow, withPhysicsFrameProbe} from '../../scripts/lib/detector.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SUITE = 'tools/eval/suites/v8.json', SLED = ['PEG', 'TAIL', 'NOSE', 'STRING'];
const r3 = (x: number | null | undefined) => x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1e3) / 1e3;

/** How the rider is set the frame before the catch: the body's offset from the sled's centre (screen y down: negative =
 * body above the sled) and the sled's pitch (TAIL→NOSE) against the arrival heading, in degrees. */
export function setting(points: Record<string, {x: number; y: number}>, heading: number) {
  const cy = SLED.reduce((a, k) => a + points[k].y, 0) / 4;
  const pitch = Math.atan2(points.NOSE.y - points.TAIL.y, points.NOSE.x - points.TAIL.x) * 180 / Math.PI - heading;
  return {bodyBelow: points.SHOULDER.y - cy, pitch: ((pitch + 540) % 360) - 180};
}

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c);
  const rows: any[] = [];
  const result = await withRejectionObserver((s, cand, reason, engine) => {
    if (reason !== 'binding' || !engine || cand.contactSide !== -1) return;
    const ask = music.contacts.find((t: any) => t.frame >= s.frame && t.frame <= s.frame + 4)?.impact;
    if (ask === undefined || ask < .6) return;
    rows.push(withPhysicsFrameProbe(() => {
      const last = engine.getLastFrameIndex(), first: string[] = [];
      for (let f = s.frame; f <= last && !first.length; f++)
        for (const u of engine.getUpdatesAtFrame(f)) if (u.type === 'CollisionUpdate') first.push(u.updated[0].id);
      const from = (s.impactPrefix as any).through + 1;
      const events = last > from ? impactRuler.continue(s.impactPrefix, impactRuler.observe(engine, extractRawTrajectoryWindow(engine, from, last).frames)) : [];
      const near = events.filter(e => Math.abs(e.onset - s.frame) <= impactRuler.matchFrames);
      return {ask, struck: near.length ? r3(Math.max(...near.map(e => e.strength))) : null, apart: last - s.frame,
        first: [...new Set(first)], sledFirst: first.some(p => SLED.includes(p)), ...setting(s.beforeState.points, s.incoming),
        incoming: r3(s.incoming)};
    }));
  }, () => compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'}));
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, seed, trackHash: digest(result.track), crashes: rows}) + '\n');
}

function report(dir: string, armDir?: string) {
  const rides = readFileSync(join(dir, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  if (armDir) console.log(`track identity: ${rides.filter(r => JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8')).trackHash === r.trackHash).length}/${rides.length}`);
  const all = rides.flatMap(r => r.crashes), near = all.filter((x: any) => x.struck !== null && x.struck >= x.ask - .1);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length, share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
  for (const [label, xs] of [['came apart, all', all], ['came apart, struck near the ask', near]] as const) {
    const firsts = new Map<string, number>();
    for (const x of xs) for (const p of x.first) firsts.set(p, (firsts.get(p) ?? 0) + 1);
    console.log(`${label}: ${xs.length}; apart after ${mean(xs.map((x: any) => x.apart)).toFixed(1)} frames (within 3: ${(100 * share(xs.map((x: any) => x.apart <= 3))).toFixed(0)}%);` +
      ` sled touches first ${(100 * share(xs.map((x: any) => x.sledFirst))).toFixed(0)}%; body above the sled ${(100 * share(xs.map((x: any) => x.bodyBelow < 0))).toFixed(0)}%;` +
      ` pitch ${mean(xs.map((x: any) => x.pitch)).toFixed(1)}°; arrival ${mean(xs.map((x: any) => x.incoming)).toFixed(1)}°`);
    console.log(`  first touch: ${[...firsts].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${(100 * n / xs.length).toFixed(0)}%`).join(' · ')}`);
  }
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  mkdirSync(out, {recursive: true});
  const seed = Number(arg('seed', '101')), queue = (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
  if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.upper-survival.v1', seed, suite: SUITE, specs: queue}, null, 2) + '\n');
  const pool = new WorkerPool(workerJobs(arg('jobs', '')));
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`]));
} else report(out, process.argv[4]);
