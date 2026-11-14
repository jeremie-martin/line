/** How strong the catches were that the rider did not survive (report only).
 * Compiles V8 (or --suite) rides in-process. For each interval with a strength ask it records
 * the strongest survivor and the kept candidate (from the offered pool), and for every candidate
 * rejected because the rider or sled came apart: the frame it came apart, from the catch, and the
 * strongest impact it struck near the catch before that. Those reads stay inside a physics probe
 * on frames already simulated, so the compile is unchanged; the report checks track identity.
 *   node tools/research/crash_edge.ts run OUT [--jobs=N] [--seed=101] [--suite=v8] [--specs=a~b,...]
 *   node tools/research/crash_edge.ts report OUT [ARM_DIR] */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {v7Cases, resolveCase, digest} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {withRejectionObserver} from '../../scripts/v0/optimizer/arc_evaluate.ts';
import {impactRuler} from '../../scripts/v0/optimizer/impact_accounts.ts';
import {extractRawTrajectoryWindow, withPhysicsFrameProbe} from '../../scripts/lib/detector.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SUITE = `tools/eval/suites/${arg('suite', 'v8')}.json`;
const r3 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e3) / 1e3;

async function worker(id: string, seed: number) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c);
  const crashes = new WeakMap<object, Array<[number, number | null]>>(), intervals: any[] = [], seen = new Set<object>();
  // Every tenth strong-ask interval keeps each candidate's controls against the arrival: [crashed, strength (a survivor's
  // measured impact, a crash's strongest strike), receiver entry − sled axis, entry − incoming heading, turn, clearance,
  // contact side, support / span] (degrees). The sled axis is TAIL→NOSE in the state the frame before the catch.
  const detail = new WeakMap<object, number[][]>();
  let strongSeen = 0;
  const sledAxis = (st: any) => Math.atan2(st.points.NOSE.y - st.points.TAIL.y, st.points.NOSE.x - st.points.TAIL.x) * 180 / Math.PI;
  const axes = new WeakMap<object, number>();
  const row = (s: any, c: any, crashed: number, strength: number | null) => [crashed, r3(strength), r3(c.entry - (axes.get(s.candidates) ?? NaN)),
    r3(c.entry - s.incoming), r3(c.turn), r3(c.clearance ?? -1), c.contactSide ?? 1, r3(c.support / s.span)] as number[];
  const result = await withRejectionObserver((s, _c, reason, engine) => {
    if (!axes.has(s.candidates)) axes.set(s.candidates, sledAxis(s.beforeState));
    if (reason !== 'binding' || !engine || s.impact === undefined) return;
    const record = withPhysicsFrameProbe(() => {
      const last = engine.getLastFrameIndex(), from = (s.impactPrefix as any).through + 1;
      if (last <= from) return [last - s.frame, null] as [number, number | null];
      const events = impactRuler.continue(s.impactPrefix, impactRuler.observe(engine, extractRawTrajectoryWindow(engine, from, last).frames));
      const near = events.filter(e => Math.abs(e.onset - s.frame) <= impactRuler.matchFrames);
      return [last - s.frame, near.length ? r3(Math.max(...near.map(e => e.strength))) : null] as [number, number | null];
    });
    let list = crashes.get(s.candidates); if (!list) crashes.set(s.candidates, list = []);
    list.push(record);
    if (s.impact >= .75) { let d = detail.get(s.candidates); if (!d) detail.set(s.candidates, d = []); d.push(row(s, _c, 1, record[1])); }
  }, () => withSequenceObserver((_i, offered) => {
    for (const interval of new Set(offered.map(o => o.interval))) {
      // Construction leads the beat by a few frames: the interval's catch is the next authored contact.
      const ask = music.contacts.find((t: any) => t.frame >= interval.frame && t.frame <= interval.frame + 4)?.impact;
      if (seen.has(interval) || ask === undefined) continue;
      seen.add(interval);
      const strengths = interval.candidates.map(x => x.actualImpact).filter((x): x is number => Number.isFinite(x));
      const keep = ask >= .75 && strongSeen++ % 10 === 0;
      intervals.push({frame: interval.frame, ask: r3(ask), viable: strengths.length, best: r3(Math.max(...strengths)),
        crashes: crashes.get(interval.candidates) ?? [],
        ...(keep ? {detail: [...(detail.get(interval.candidates) ?? []),
          ...interval.candidates.map(x => row(interval, x.c, 0, x.actualImpact ?? null))]} : {})});
    }
  }, () => compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'})));
  const kept = new Map((result.cell.impact3?.perBeat ?? []).map((b: any, j: number) => [music.contacts[j].frame, r3(b.hit?.strength)]));
  for (const x of intervals) x.kept = [0, 1, 2, 3, 4].map(d => kept.get(x.frame + d)).find(v => v !== undefined) ?? null;
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, trackHash: digest(result.track), intervals}) + '\n');
}

function report(dir: string, armDir?: string) {
  const rides = readFileSync(join(dir, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  if (armDir) {
    const same = rides.filter(r => JSON.parse(readFileSync(join(armDir, 'cells', `${r.spec}~${r.seed}.json`), 'utf8')).trackHash === r.trackHash).length;
    console.log(`track identity: ${same}/${rides.length} identical to the saved arm`);
  }
  const all = rides.flatMap(r => r.intervals);
  console.log(`${rides.length} rides, ${all.length} intervals with an ask`);
  for (const [lo, hi] of [[0, .3], [.3, .6], [.6, .75], [.75, .9], [.9, 2]]) {
    const xs = all.filter(x => x.ask >= lo && x.ask < hi); if (!xs.length) continue;
    const cr = xs.flatMap(x => x.crashes), atCatch = cr.filter(([d]: number[]) => d <= 12);
    const struck = atCatch.filter(([, s]: any[]) => s !== null).map(([, s]: any[]) => s as number);
    const above = xs.filter(x => x.crashes.some(([d, s]: any[]) => d <= 12 && s !== null && s > (x.best ?? 0) + .05)).length;
    const m = (a: number[]) => a.length ? (a.reduce((p, q) => p + q, 0) / a.length).toFixed(3) : '—';
    console.log(`ask ${lo}–${hi}: ${xs.length} intervals; per interval ${(cr.length / xs.length).toFixed(0)} came apart (${(100 * atCatch.length / Math.max(1, cr.length)).toFixed(0)}% within 12 frames of the catch), ` +
      `${(xs.reduce((p, x) => p + x.viable, 0) / xs.length).toFixed(0)} survived; ask ${m(xs.map(x => x.ask))}, kept ${m(xs.map(x => x.kept).filter((v: any) => v !== null))}, ` +
      `strongest survivor ${m(xs.map(x => x.best).filter((v: any) => v !== null))}, struck before coming apart ${m(struck)}; ` +
      `intervals where a crash struck harder than every survivor (+0.05): ${(100 * above / xs.length).toFixed(0)}%`);
  }
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')));
else if (command === 'run') {
  mkdirSync(out, {recursive: true});
  const seed = Number(arg('seed', '101')), all = (await v7Cases([seed], '.', SUITE)).map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', '') ? arg('specs', '').split(',') : all;
  if (existsSync(join(out, 'rides.jsonl'))) throw new Error(`${out} already has rides`);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.crash-edge.v1', seed, suite: SUITE, specs: queue}, null, 2) + '\n');
  const pool = new WorkerPool(workerJobs(arg('jobs', '')));
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`, `--suite=${arg('suite', 'v8')}`]));
} else report(out, process.argv[4]);
