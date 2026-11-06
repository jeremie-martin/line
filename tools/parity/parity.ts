/** Structural-change safety net. Structural steps must leave every parity cell
 * byte-identical: same track hash, same physics-frame count, same judgment.
 *
 *   node tools/parity/parity.ts compile [--mode=landing|strike|strike2|strike3] [--jobs=N]
 *   node tools/parity/parity.ts judge   [--all]
 *
 * `compile` recompiles the committed cells in fresh processes.
 * `judge` re-scores the committed reference tracks; `--all` additionally
 * re-scores every stored V6 reference track under generated/ (local data).
 * Cells with a `budget` compile at that allowance instead of the V6 budget, where
 * budget-gated options take other values; they pin the track hash and frame
 * count only (no stored track, no judgment).
 * Expected values come from tools/parity/cells.json. A deliberate behaviour
 * change updates them with `compile --update`, in its own commit. */
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {WorkerPool, workerJobs} from '../../scripts/lib/workers.ts';
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {policy} from '../../benchmark/v6/policy.ts';
import {caseSpec, sha} from '../../benchmark/v4/model.ts';

type Cell = {mode: 'landing' | 'strike' | 'strike2' | 'strike3'; id: string; seed: number; panel: string; budget?: number; trackHash: string; physicalFrames: number;
  /** A current V7 specification, compiled by the same route as evaluation. */
  spec?: {song: string; variant: string};
  score?: number; musicalScore?: number; valid?: boolean; fulfilled?: number; quality?: number; loss?: number};
const root = new URL('.', import.meta.url).pathname;
const cellsPath = join(root, 'cells.json');
const doc = JSON.parse(readFileSync(cellsPath, 'utf8')) as {cells: Cell[]};
const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => process.argv.includes(`--${k}`);
const trackFile = (c: Cell) => join(root, c.mode === 'strike3' ? 'tracks' : 'physics-tracks', `${c.mode}-${c.id.replaceAll('/', '~')}-${c.seed}.json.gz`);
const CONTRACTS: Record<string, string> = {strike: 'line.strike.v1', strike2: 'line.strike.v2', strike3: 'line.strike.v3'};

function caseOf(cell: {id: string}) {
  const catalog = loadCatalog(), c = catalog.cases.find((c: any) => c.id === cell.id)!;
  return {c, music: catalog.music.find((m: any) => m.id === c.sourceId)!};
}

/** A V7 specification: authored inputs and options as `compare` resolves them, without reading audio. */
async function specInputs(cell: Cell) {
  const [{loadMusicSpec}, {resolveJoltMs}, {productionBudget}, {explicitPlan}] = await Promise.all([
    import('../../scripts/produce/music_artifacts.ts'), import('../../scripts/produce/jolt.ts'),
    import('../../scripts/v0/optimizer/production_budget.ts'), import('../eval/compile.ts')]);
  const {song, variant} = cell.spec!, definition = {song, title: song, moments: [], variant};
  const {spec, musicCase: music} = await loadMusicSpec(definition, resolveJoltMs());
  const construction = (await import(pathToFileURL(resolve('productions', song, 'variants', `${variant}.ts`)).href)).bench?.construction;
  const boundaries = music.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter(Number.isFinite);
  const budget = cell.budget ?? productionBudget(spec.duration), impactContract = CONTRACTS.strike3 as any;
  const options = construction ? {budget, impactContract, constructionPlan: await explicitPlan('.', spec, cell.seed, {}, boundaries, construction)}
    : {budget, impactContract, creative: {}, phraseBoundaries: boundaries};
  return {spec, music, options};
}

async function cellInputs(cell: Cell) {
  if (cell.spec) return specInputs(cell);
  const {c, music} = caseOf(cell), requested = c.plans[cell.seed];
  return {spec: caseSpec(music), music, options: {budget: cell.budget ?? policy.budget,
    ...(CONTRACTS[cell.mode] ? {impactContract: CONTRACTS[cell.mode] as any} : {}),
    ...(c.panel === 'automatic' ? {creative: requested.preferences} : {constructionPlan: requested})}};
}

/** The prepared inputs of one cell, shared by every timing and profiling boundary. */
export async function prepareCell(index: number) {
  const cell = doc.cells[index], {spec, options} = await cellInputs(cell);
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  return {cell, compile: () => compileHandoff(spec, cell.seed, options),
    /** Whether a checkpoint reproduces the cell's committed track and charged work. */
    exact: (checkpoint: ReturnType<typeof compileHandoff>) =>
      sha(JSON.stringify(checkpoint.track)) === cell.trackHash && checkpoint.stats.sim_frames === cell.physicalFrames};
}

export async function compileWorker(index: number, out: string, collectResources = false) {
  const {compile} = await prepareCell(index);
  // v2: both clocks enclose only compileHandoff. Input loading, hashing,
  // serialization and diagnostic resource sampling are outside this boundary.
  const cpu = process.cpuUsage(), began = performance.now();
  const checkpoint = compile();
  const compileMs = performance.now() - began, used = process.cpuUsage(cpu);
  const resources = collectResources ? {
    wasmLinearMemoryBytes: (await import('../../scripts/lib/native_motion/wasm.ts')).wasm.memory.buffer.byteLength,
    ...process.memoryUsage(), processMaxRssBytes: process.resourceUsage().maxRSS * 1024,
  } : undefined;
  writeFileSync(out, JSON.stringify({trackHash: sha(JSON.stringify(checkpoint.track)), physicalFrames: checkpoint.stats.sim_frames,
    compileMs, compileCpuMs: (used.user + used.system) / 1000, resources, track: checkpoint.track}));
}

async function judgeTrack(cell: Cell, track: any) {
  if (cell.mode === 'landing') {
    const {judgeV6Track} = await import('./v6_cell.ts');
    const {c, music} = caseOf(cell), j = judgeV6Track(track, c, music, cell.seed);
    return {score: j.score, musicalScore: j.musicalScore, valid: j.valid, fulfilled: j.fulfilled};
  }
  const {music} = await cellInputs(cell);
  const [{replayGalleryTrack}, {contactImpactGrade}] = await Promise.all([
    import('../../scripts/gallery/artifacts.ts'), import('../../scripts/gallery/contact_impact_grade.ts'),
  ]);
  const replay = replayGalleryTrack(track, music as any, true, CONTRACTS[cell.mode] as any), impact = replay.impactEvaluation!;
  return {quality: contactImpactGrade(replay.grade, impact).score.score, loss: impact.account.loss};
}

function compare(expected: Record<string, unknown>, actual: Record<string, unknown>, keys: string[]) {
  return keys.filter(k => expected[k] !== undefined && expected[k] !== actual[k]).map(k => `${k}: expected ${expected[k]}, got ${actual[k]}`);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
const command = process.argv[2];
if (command === 'worker') await compileWorker(Number(arg('cell')), arg('out')!);
else if (command === 'compile') {
  const mode = arg('mode'), pool = new WorkerPool(workerJobs(arg('jobs'))), only = arg('ids')?.split(',');
  const queue = doc.cells.map((c, i) => ({c, i})).filter(({c}) => (!mode || c.mode === mode) && (!only || only.includes(c.id)));
  if (!queue.length) throw new Error('No parity cells selected');
  const dir = mkdtempSync(join(tmpdir(), 'parity-')), failures: string[] = [], began = performance.now();
  await pool.run(queue, async ({c, i}) => {
    const out = join(dir, `${i}.json`), name = `${c.mode} ${c.id} #${c.seed}${c.budget ? ` @${c.budget}` : ''}`;
    try {
      await pool.worker([import.meta.filename, 'worker', `--cell=${i}`, `--out=${out}`]);
    } catch (error) {
      failures.push(`${name}: ${error}`);
      return;
    }
    const r = JSON.parse(readFileSync(out, 'utf8'));
    const diff = compare(c, r, ['trackHash', 'physicalFrames']);
    if (flag('update') && (diff.length || c.trackHash === undefined)) {
      Object.assign(c, {trackHash: r.trackHash, physicalFrames: r.physicalFrames}, c.budget ? {} : await judgeTrack(c, r.track));
      if (!c.budget) writeFileSync(trackFile(c), gzipSync(JSON.stringify(r.track)));
    }
    console.log(`${diff.length ? 'DIFF' : 'same'}  ${name}  ${(r.compileMs / 1000).toFixed(0)}s${diff.length ? '  ' + diff.join('; ') : ''}`);
    if (diff.length && !flag('update')) failures.push(`${name}: ${diff.join('; ')}`);
  });
  if (flag('update')) writeFileSync(cellsPath, JSON.stringify(doc, null, 1) + '\n');
  console.log(`${failures.length ? 'FAIL' : 'PASS'}  compile parity  (${((performance.now() - began) / 1000).toFixed(0)}s)`);
  for (const f of failures) console.log('  ' + f);
  process.exit(failures.length ? 1 : 0);
} else if (command === 'judge') {
  const failures: string[] = [];
  for (const cell of doc.cells.filter(c => !c.budget)) {
    const actual = await judgeTrack(cell, JSON.parse(gunzipSync(readFileSync(trackFile(cell))).toString()));
    const diff = compare(cell, actual, ['score', 'musicalScore', 'valid', 'fulfilled', 'quality', 'loss']);
    if (diff.length) failures.push(`${cell.mode} ${cell.id} #${cell.seed}: ${diff.join('; ')}`);
  }
  let checked = doc.cells.filter(c => !c.budget).length;
  if (flag('all')) {
    const ref = 'generated/intentional-motion/v6-candidate-8';
    const run = JSON.parse(readFileSync(join(ref, 'run.json'), 'utf8'));
    for (const row of run.rows) {
      if (row.executionError) continue;
      const cell = {mode: 'landing', id: row.id, seed: row.seed} as Cell;
      const actual = await judgeTrack(cell, JSON.parse(readFileSync(join(ref, 'tracks', `${row.id}-${row.seed}.json`), 'utf8')));
      const diff = compare(row, actual, ['score', 'musicalScore', 'valid', 'fulfilled']);
      if (diff.length) failures.push(`stored ${row.id} #${row.seed}: ${diff.join('; ')}`);
      checked++;
    }
  }
  console.log(`${failures.length ? 'FAIL' : 'PASS'}  judge parity  (${checked} tracks)`);
  for (const f of failures) console.log('  ' + f);
  process.exit(failures.length ? 1 : 0);
} else throw new Error('usage: parity.ts compile|judge');

}
