/** Where does the seed-to-seed spread of a ride's score come from: the plan's
 * geometry draws, or the search's own random choices? Report only.
 * A seed drives both. Here they are separated, on one automatic spec per V7
 * category: design A holds the plan at seed 101 and varies the search seed;
 * design B holds the search at 101 and varies the plan seed. The plan is drawn
 * by the compiler's own planner and passed as an explicit plan.
 * node --import tsx tools/research/seed_variance.ts run OUT [--jobs=44]
 * node --import tsx tools/research/seed_variance.ts report OUT */
import {spawn} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {panelCases, resolveCase} from '../eval/inputs.ts';
import {measureCell, geometryFacts} from '../eval/measure.ts';
import {mean} from '../eval/summary.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';

const SPECS = ['luna_bala_44s~spec', 'tiki_tiki_48s~bench-pairs', 'amor_na_praia_46s~v7-words', 'tiki_tiki_48s~bench-calm',
  'tiki_tiki_48s~v7-intense', 'luna_bala_44s~bench-breakdown', 'amour_de_ma_vie_108s~bench-long', 'luna_bala_44s~v7-rideout'];
const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];
const [command, out] = process.argv.slice(2), arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

async function compileOne(spec: string, planSeed: number, searchSeed: number) {
  const c = (await panelCases('v7', '.', 1)).find(x => `${x.song}~${x.variant ?? 'spec'}` === spec)!;
  const {spec: s, music, planned} = await resolveCase({...c, id: `${spec}~${searchSeed}`, seed: searchSeed}, resolveJoltMs());
  const {planIntentionalRepertoire} = await import('../../scripts/v0/optimizer/intentional_repertoire.ts');
  const {normalizeCompilerTimeline} = await import('../../scripts/v0/optimizer/compiler_input.ts');
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await import('../../scripts/v0/optimizer/production_budget.ts');
  const boundaries = music.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter(Number.isFinite);
  // The plan's draws come from planSeed; the search runs with searchSeed.
  const plan = {...planIntentionalRepertoire(normalizeCompilerTimeline(s), planSeed, {}, boundaries), seed: searchSeed};
  const cp = compileHandoff(s, searchSeed, {budget: productionBudget(s.duration), impactContract: 'line.strike.v3', constructionPlan: plan});
  const r = cp.repertoire!, cell = measureCell({c: planned, mode: 'strike3', track: cp.track, spec: s, music, physicalFrames: r.physicalFrames,
    compileMs: 0, complete: r.valid, fulfilled: r.qualified, motion: r.motion.full, geometry: geometryFacts(r)});
  return {spec, planSeed, searchSeed, complete: cell.complete, score: cell.complete && cell.score?.valid ? cell.score.score : 0};
}

if (command === 'worker') {
  const [spec, planSeed, searchSeed] = [arg('spec', ''), Number(arg('plan', '0')), Number(arg('search', '0'))];
  appendFileSync(join(out, 'rides.jsonl'), JSON.stringify(await compileOne(spec, planSeed, searchSeed)) + '\n');
} else if (command === 'run') {
  mkdirSync(out, {recursive: true});
  const done = new Set(existsSync(join(out, 'rides.jsonl')) ? readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').filter(Boolean)
    .map(l => {const r = JSON.parse(l); return `${r.spec}|${r.planSeed}|${r.searchSeed}`;}) : []);
  const queue = [...new Set(SPECS.flatMap(spec => [...SEEDS.map(s => `${spec}|101|${s}`), ...SEEDS.map(s => `${spec}|${s}|101`)]))].filter(k => !done.has(k));
  console.log(`${queue.length} rides`);
  await Promise.all(Array.from({length: Math.min(Number(arg('jobs', '44')), queue.length)}, async () => {
    while (queue.length) {
      const [spec, plan, search] = queue.shift()!.split('|');
      await new Promise<void>(done => spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', out, `--spec=${spec}`, `--plan=${plan}`, `--search=${search}`],
        {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']}).once('exit', () => done()));
    }
  }));
} else {
  const rides = readFileSync(join(out, 'rides.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const sd = (xs: number[]) => {const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));};
  console.log('spec                                   search varies (plan 101)   plan varies (search 101)');
  const rows = SPECS.map(spec => {
    const a = rides.filter(r => r.spec === spec && r.planSeed === 101).map(r => r.score), b = rides.filter(r => r.spec === spec && r.searchSeed === 101).map(r => r.score);
    console.log(`${spec.padEnd(39)}sd ${sd(a).toFixed(1).padStart(5)} (n=${a.length}, mean ${mean(a).toFixed(1)})   sd ${sd(b).toFixed(1).padStart(5)} (n=${b.length}, mean ${mean(b).toFixed(1)})`);
    return [sd(a) ** 2, sd(b) ** 2];
  });
  console.log(`mean variance: search ${mean(rows.map(r => r[0])).toFixed(0)} (sd ${Math.sqrt(mean(rows.map(r => r[0]))).toFixed(1)}), plan ${mean(rows.map(r => r[1])).toFixed(0)} (sd ${Math.sqrt(mean(rows.map(r => r[1]))).toFixed(1)})`);
}
