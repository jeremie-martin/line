/** Structural-change safety net. Structural steps must leave every parity cell
 * byte-identical: same track hash, same physics-frame count, same judgment.
 *
 *   node --import tsx tools/parity/parity.ts compile [--mode=landing|strike|strike2] [--jobs=23]
 *   node --import tsx tools/parity/parity.ts judge   [--all]
 *
 * `compile` recompiles the committed cells in fresh processes.
 * `judge` re-scores the committed reference tracks; `--all` additionally
 * re-scores every stored V6 reference track under generated/ (local data).
 * Cells with a `budget` compile at that allowance instead of the V6 budget, where
 * budget-gated options take other values; they pin the track hash and frame
 * count only (no stored track, no judgment).
 * Expected values come from tools/parity/cells.json. A deliberate behaviour
 * change updates them with `compile --update`, in its own commit. */
import {readFileSync, writeFileSync, mkdtempSync, existsSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {loadCatalog} from '../../benchmark/v6/model.ts';
import {policy} from '../../benchmark/v6/policy.ts';
import {caseSpec, sha} from '../../benchmark/v4/model.ts';

type Cell = {mode: 'landing' | 'strike' | 'strike2'; id: string; seed: number; panel: string; budget?: number; trackHash: string; physicalFrames: number;
  score?: number; musicalScore?: number; valid?: boolean; fulfilled?: number; quality?: number; loss?: number};
const root = new URL('.', import.meta.url).pathname;
const cellsPath = join(root, 'cells.json');
const doc = JSON.parse(readFileSync(cellsPath, 'utf8')) as {cells: Cell[]};
const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => process.argv.includes(`--${k}`);
const trackFile = (c: Cell) => join(root, 'tracks', `${c.mode}-${c.id}-${c.seed}.json.gz`);
const CONTRACTS: Record<string, string> = {strike: 'line.strike.v1', strike2: 'line.strike.v2'};

function caseOf(cell: {id: string}) {
  const catalog = loadCatalog(), c = catalog.cases.find((c: any) => c.id === cell.id)!;
  return {c, music: catalog.music.find((m: any) => m.id === c.sourceId)!};
}

async function compileWorker(index: number, out: string) {
  const cell = doc.cells[index], {c, music} = caseOf(cell), requested = c.plans[cell.seed];
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const began = performance.now();
  const checkpoint = compileHandoff(caseSpec(music), cell.seed, {budget: cell.budget ?? policy.budget,
    ...(CONTRACTS[cell.mode] ? {impactContract: CONTRACTS[cell.mode] as any} : {}),
    ...(c.panel === 'automatic' ? {creative: requested.preferences} : {constructionPlan: requested})});
  writeFileSync(out, JSON.stringify({trackHash: sha(JSON.stringify(checkpoint.track)), physicalFrames: checkpoint.stats.sim_frames,
    compileMs: performance.now() - began, track: checkpoint.track}));
}

async function judgeTrack(cell: Cell, track: any) {
  const {c, music} = caseOf(cell);
  if (cell.mode === 'landing') {
    const {judgeV6Track} = await import('./v6_cell.ts');
    const j = judgeV6Track(track, c, music, cell.seed);
    return {score: j.score, musicalScore: j.musicalScore, valid: j.valid, fulfilled: j.fulfilled};
  }
  const {replayGalleryTrack} = await import('../../scripts/gallery/artifacts.ts');
  const {contactImpactGrade} = await import('../../scripts/gallery/contact_impact_grade.ts');
  const replay = replayGalleryTrack(track, music, true, CONTRACTS[cell.mode] as any), impact = replay.impactEvaluation!;
  return {quality: contactImpactGrade(replay.grade, impact).score.score, loss: impact.account.loss};
}

function compare(expected: Record<string, unknown>, actual: Record<string, unknown>, keys: string[]) {
  return keys.filter(k => expected[k] !== undefined && expected[k] !== actual[k]).map(k => `${k}: expected ${expected[k]}, got ${actual[k]}`);
}

const command = process.argv[2];
if (command === 'worker') await compileWorker(Number(arg('cell')), arg('out')!);
else if (command === 'compile') {
  const mode = arg('mode'), jobs = Number(arg('jobs', '23')), only = arg('ids')?.split(',');
  const queue = doc.cells.map((c, i) => ({c, i})).filter(({c}) => (!mode || c.mode === mode) && (!only || only.includes(c.id)));
  const dir = mkdtempSync(join(tmpdir(), 'parity-')), failures: string[] = [], began = performance.now();
  await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => {
    while (queue.length) {
      const {c, i} = queue.shift()!, out = join(dir, `${i}.json`);
      const code = await new Promise<number | null>((done, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--cell=${i}`, `--out=${out}`],
          {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
        child.once('error', reject); child.once('exit', done);
      });
      const name = `${c.mode} ${c.id} #${c.seed}${c.budget ? ` @${c.budget}` : ''}`;
      if (code !== 0 || !existsSync(out)) {failures.push(`${name}: worker exited ${code}`); continue;}
      const r = JSON.parse(readFileSync(out, 'utf8'));
      const diff = compare(c, r, ['trackHash', 'physicalFrames']);
      if (flag('update') && (diff.length || c.trackHash === undefined)) {
        Object.assign(c, {trackHash: r.trackHash, physicalFrames: r.physicalFrames}, c.budget ? {} : await judgeTrack(c, r.track));
        if (!c.budget) writeFileSync(trackFile(c), gzipSync(JSON.stringify(r.track)));
      }
      console.log(`${diff.length ? 'DIFF' : 'same'}  ${name}  ${(r.compileMs / 1000).toFixed(0)}s${diff.length ? '  ' + diff.join('; ') : ''}`);
      if (diff.length && !flag('update')) failures.push(`${name}: ${diff.join('; ')}`);
    }
  }));
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
