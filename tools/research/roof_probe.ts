/** Can a surface above turn the rider down between catches without a hit? (report only)
 * Compiles rides in-process with a read-only sequence observer. At catches i where both
 * i and i+1 ask for 0.6 or more, from the kept candidate K's prefix, in owned study
 * contexts outside the compile's allowance:
 *   1. replay K without a roof (the baseline) and record the rider's free flight;
 *   2. for each push a (px/frame², body mean), add a roof above that flight: from two frames
 *      after K's support to four frames before the next catch, 2 px above the body's top
 *      point, deviating toward the rider by ½·a·t². Like a guide, the roof runs against
 *      the travel so that its active side faces the rider.
 * Each arm (the baseline included, through the same code) is measured with the product's
 * arithmetic: the strike account (v3) over the flight window (any event there is an
 * unwanted hit), roof contact and the points that made it, the rider's integrity, the
 * arrival heading and speed at the next catch, and the next interval's own search
 * (strongest candidate, cheapest, and the cheapest within 0.06 of the ask).
 *   node tools/research/roof_probe.ts run OUT [--jobs=N] [--seed=101] [--per-ride=8] [--push=.15,.3,.5] [--specs=a~b,...]
 *   node tools/research/roof_probe.ts report OUT */
import assert from 'node:assert/strict';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {v7Cases, resolveCase} from '../eval/inputs.ts';
import {compileAndMeasure} from '../eval/compile.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {withSequenceObserver} from '../../scripts/v0/optimizer/arc_sequence.ts';
import {searchInterval} from '../../scripts/v0/optimizer/arc_interval.ts';
import type {MeasuredCandidate} from '../../scripts/v0/optimizer/arc_candidates.ts';
import type {ArcCompileContext} from '../../scripts/v0/optimizer/arc_compile_context.ts';
import {solidPathLines} from '../../scripts/v0/arc.ts';
import {getBallisticStateMetered} from '../../scripts/lib/detector.ts';
import {bodyMotion, observeMotion, detectStrikes, STRIKE_V3_CONTRACT} from '../../scripts/lib/strike_impact.ts';
import {withArcStudy} from './arc_study.ts';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';

const SUITE = 'tools/eval/suites/v7.1.json';
const ROOF_ID = 1000 + 10000 * 9000;   // its own section: never shares an id or a prefix group with compiled lines
const POINTS = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const r4 = (x: number | undefined | null) => x === undefined || x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const deg = (r: number) => r * 180 / Math.PI;
/** [strength, local cost, cost apart from strength, signed speed residual, side] */
const summary = (x: MeasuredCandidate) => [r4(x.actualImpact), r4(x.localCost), r4(x.localCost - (x.residuals[3] ?? 0) ** 2), r4(x.residuals[1]), x.c.contactSide ?? 1];

/** Measure one arm: the flight from catch i to the next catch over `lines`, then the next search. */
function measureArm(ctx: ArcCompileContext, lines: any[], i: number, from: number, to: number) {
  const catchFrame = ctx.contacts[i].frame, next = ctx.contacts[i + 1].frame;
  const arm: any = {};
  withArcStudy(ctx, lines, i + 1, (study, engine) => {
    const states = [];
    for (let f = catchFrame - 1; f <= next - 1; f++) states.push(getBallisticStateMetered(engine, f));
    const motions = states.map(s => bodyMotion(s as any));
    const contactAt = (f: number) => engine.hasContactAtFrame(f);
    // The account's own events over the flight (from the support's end to the next catch's window).
    const frames = observeMotion(catchFrame, motions, contactAt, STRIKE_V3_CONTRACT);
    const events = detectStrikes(frames, STRIKE_V3_CONTRACT).filter(e => e.onset >= from && e.onset < next - STRIKE_V3_CONTRACT.spacing);
    arm.events = events.map(e => r4(e.strength));
    let roofFrames = 0; const touched: Record<string, number> = {};
    for (let f = from; f < next; f++) {
      let any = false;
      for (const u of engine.getUpdatesAtFrame(f)) if (u.type === 'CollisionUpdate' && u.id >= ROOF_ID) {
        any = true; for (const p of u.updated) touched[p.id] = (touched[p.id] ?? 0) + 1;
      }
      if (any) roofFrames++;
    }
    arm.roofFrames = roofFrames; arm.touched = touched;
    const last = states.at(-1)!, m = motions.at(-1)!;
    arm.intact = last.riderMounted && last.sledIntact;
    arm.heading = r4(deg(Math.atan2(m.v.y, m.v.x))); arm.speed = r4(Math.hypot(m.v.x, m.v.y));
    const flight = motions.slice(from - (catchFrame - 1));
    arm.flightSpeed = r4(flight.reduce((n, x) => n + Math.hypot(x.v.x, x.v.y), 0) / Math.max(1, flight.length));
    if (!arm.intact) return;
    try {
      const pool = searchInterval(study, engine, i + 1, {}, [engine])?.candidates ?? [];
      arm.next = pool.map(summary);
    } catch (error) {arm.error = String(error).slice(0, 160);}
  });
  return arm;
}

/** The free flight's top edge and a roof deviating from it toward the rider by ½·a·t². */
function roofLines(ctx: ArcCompileContext, lines: any[], i: number, from: number, to: number, push: number) {
  const path: Array<{x: number; y: number}> = [];
  withArcStudy(ctx, lines, i + 1, (_study, engine) => {
    for (let f = from; f <= to; f++) {
      const s = getBallisticStateMetered(engine, f), m = bodyMotion(s as any), speed = Math.hypot(m.v.x, m.v.y) || 1;
      const up = {x: m.v.y / speed, y: -m.v.x / speed};   // the normal away from the ground side of travel (y down)
      const top = POINTS.map(id => s.points[id]).reduce((a, b) => a.x * up.x + a.y * up.y >= b.x * up.x + b.y * up.y ? a : b);
      const t = f - from, lift = 2 - .5 * push * t * t;
      path.push({x: top.x + up.x * lift, y: top.y + up.y * lift});
    }
  });
  return solidPathLines([{id: ROOF_ID, points: path.reverse()}]);
}

async function worker(id: string, seed: number, perRide: number, pushes: number[]) {
  const c = (await v7Cases([seed], '.', SUITE)).find(x => `${x.song}~${x.variant ?? 'spec'}` === id);
  assert(c, `unknown case: ${id}`);
  const {spec, music, planned} = await resolveCase(c, resolveJoltMs());
  const asks = [undefined, ...music.contacts.map((t: any) => t.impact)];
  const probes: any[] = [];
  await withSequenceObserver((i, offered, chosen, ctx) => {
    if (probes.length >= perRide || !chosen.length || i + 2 >= ctx.contacts.length) return;
    if (!((asks[i] ?? 0) >= .6 && (asks[i + 1] ?? 0) >= .6)) return;
    const kept = offered.find(o => o.candidate === chosen[0].candidate)!, K = kept.candidate;
    const lines = [...kept.parent.seq.lines, ...K.lines];
    const catchFrame = ctx.contacts[i].frame, next = ctx.contacts[i + 1].frame;
    const from = catchFrame + Math.ceil(K.c.support) + 2, to = next - 4;
    if (to - from < 6) return;
    const row: any = {i, ask: asks[i], nextAsk: asks[i + 1], gap: next - catchFrame, window: to - from, kept: summary(K), arms: {}};
    row.arms['0'] = measureArm(ctx, lines, i, from, to);
    if (!row.arms['0'].intact) return;
    for (const push of pushes) row.arms[String(push)] = measureArm(ctx, [...lines, ...roofLines(ctx, lines, i, from, to, push)], i, from, to);
    probes.push(row);
  }, () => compileAndMeasure('.', planned, {spec, music}, {budget: 'standard'}));
  for (const p of probes) appendFileSync(join(out, 'probes.jsonl'), JSON.stringify({spec: id, stratum: c.bench.stratum, seed, ...p}) + '\n');
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmt = (x: number, d = 3) => Number.isFinite(x) ? x.toFixed(d) : '—';

function report(dir: string) {
  const rows = readFileSync(join(dir, 'probes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const study = JSON.parse(readFileSync(join(dir, 'study.json'), 'utf8'));
  console.log(`${rows.length} strong catches followed by a strong ask (next ask ${fmt(mean(rows.map(r => r.nextAsk)))}, ` +
    `${fmt(mean(rows.map(r => r.gap)), 1)} frames apart, steering window ${fmt(mean(rows.map(r => r.window)), 1)} frames)`);
  for (const key of ['0', ...study.pushes.map(String)]) {
    const arms = rows.map(r => ({r, a: r.arms[key]})).filter(x => x.a);
    const intact = arms.filter(x => x.a.intact), withNext = intact.filter(x => x.a.next?.length);
    const pool = (x: any) => x.a.next.filter((t: any) => t[0] !== null);
    const strongest = withNext.map(x => Math.max(...pool(x).map((t: any) => t[0])));
    const cheapest = withNext.map(x => pool(x).reduce((p: any, q: any) => q[1] < p[1] ? q : p));
    const near = withNext.map(x => pool(x).filter((t: any) => Math.abs(t[0] - x.r.nextAsk) <= .06)).filter(n => n.length)
      .map(n => n.reduce((p: any, q: any) => q[2] < p[2] ? q : p));
    const hits = intact.filter(x => x.a.events.length), touched: Record<string, number> = {};
    for (const x of intact) for (const [p, n] of Object.entries(x.a.touched)) touched[p] = (touched[p] ?? 0) + (n as number);
    console.log(`\n${key === '0' ? 'no roof (baseline)' : `roof, push ${key} px/frame²`}: intact ${intact.length}/${arms.length}`);
    console.log(`  roof contact ${fmt(mean(intact.map(x => x.a.roofFrames)), 1)} frames; points: ${Object.entries(touched).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(', ') || 'none'}`);
    console.log(`  hits registered in the flight: ${hits.length}/${intact.length} arms (strongest ${fmt(mean(hits.map(x => Math.max(...x.a.events))))})`);
    console.log(`  arrival at the next catch: heading ${fmt(mean(intact.map(x => x.a.heading)), 1)}°, speed ${fmt(mean(intact.map(x => x.a.speed)), 2)}; ` +
      `mean flight speed ${fmt(mean(intact.map(x => x.a.flightSpeed)), 2)}`);
    console.log(`  next catch (ask ${fmt(mean(withNext.map(x => x.r.nextAsk)))}): strongest ${fmt(mean(strongest))}; cheapest strength ${fmt(mean(cheapest.map(t => t[0])))} ` +
      `local ${fmt(mean(cheapest.map(t => t[1])), 4)}; within 0.06 of the ask in ${near.length}/${withNext.length}, cost apart from strength ${fmt(mean(near.map(t => t[2])), 4)}`);
  }
}

if (command === 'worker') await worker(arg('spec', ''), Number(arg('seed', '101')), Number(arg('per-ride', '8')), arg('push', '.15,.3,.5').split(',').map(Number));
else if (command === 'run') {
  const pool = new WorkerPool(workerJobs(arg('jobs', '') || undefined)), seed = Number(arg('seed', '101')), perRide = Number(arg('per-ride', '8'));
  const pushes = arg('push', '.15,.3,.5').split(',').map(Number);
  assert(pushes.every(p => p > 0), '--push values must be positive');
  const all = (await v7Cases([seed], '.', SUITE)).filter(x => x.bench.stratum !== 'E').map(x => `${x.song}~${x.variant ?? 'spec'}`);
  const queue = arg('specs', all.join(',')).split(',');
  assert(queue.every(Boolean) && new Set(queue).size === queue.length, '--specs must contain unique cases');
  assert(out && !existsSync(out), 'a new study requires a fresh output directory');
  mkdirSync(dirname(out), {recursive: true});
  mkdirSync(out);
  writeFileSync(join(out, 'study.json'), JSON.stringify({schema: 'line.roof-probe.v1', seed, perRide, pushes, suite: SUITE, specs: queue}, null, 2) + '\n');
  console.log(`${queue.length} rides`);
  await pool.run(queue, spec => pool.worker([import.meta.filename, 'worker', out, `--spec=${spec}`, `--seed=${seed}`, `--per-ride=${perRide}`, `--push=${pushes.join(',')}`]));
} else report(out);
