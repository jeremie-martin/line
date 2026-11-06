/** Paired production evaluation. Plans fix all inputs before workers start;
 * reports require the full panel. A failed worker is a failed run, resumable
 * after its cause is addressed; an incomplete ride is still a recorded result.
 *
 * node tools/eval/eval.ts run --name=DIR [--mode=strike3] [--budget=standard|standard*F|N] [--panel=NAME] [--sealed|--heldout] [--jobs=N] [--creative=JSON]
 * node tools/eval/eval.ts report --name=DIR [--against=DIR]
 * Panels are listed in USAGE below (PANEL_HELP in inputs.ts). */
import assert from 'node:assert/strict';
import {mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {defaultWorkerJobs} from '../lib/worker_jobs.ts';
import {compilerIdentity} from '../../scripts/lib/compiler_identity.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {PANEL_HELP, PANEL_NAMES, panelCases, resolveCase, evaluatorIdentity} from './inputs.ts';
import {readPlan, readCells, saveCell, loadRun, atomicWrite, runDir, type RunPlan} from './records.ts';
import {summarize, bootstrap, songValues, stratify, geometryStrata, headline, type Run} from './summary.ts';
import {ADAPTER_SHA256, CONTRACTS, compileAndMeasure} from './compile.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => process.argv.includes(`--${k}`);
export const USAGE = `usage:
  npm run eval -- --name=DIR [--panel=NAME] [--mode=strike3] [--budget=standard|standard*F|N] [--jobs=N] [--sealed|--heldout] [--creative=JSON]
  npm run eval:report -- --name=DIR [--against=DIR]
panels:
${Object.entries(PANEL_HELP).map(([k, v]) => `  ${k.padEnd(14)}${v}`).join('\n')}
Bench, sealed and held-out runs get the stratified report (completion first, then quality on
cells complete in both arms, per-spec sign counts, strata weighted equally).
The held-out songs (Trouble, Valhalla, Circus Minimus) are excluded from compiler decisions;
--heldout is for decision points only.`;
export function validateRunOptions(mode: string, budget: string, jobs: number, panel: string, flags: {sealed?: boolean; heldout?: boolean} = {}) {
  assert.ok(Object.hasOwn(CONTRACTS, mode), 'unknown compilation mode');
  assert.ok(PANEL_NAMES.includes(panel), 'unknown evaluation panel');
  // Sealed and held-out specs are spent by every look: compile them only on an explicit decision.
  assert.equal(!!flags.sealed, panel === 'sealed', panel === 'sealed'
    ? 'the sealed panel runs only with --sealed: it confirms an adopted candidate and is never used for tuning' : '--sealed applies only to --panel=sealed');
  assert.equal(!!flags.heldout, panel === 'heldout', panel === 'heldout'
    ? 'the heldout panel runs only with --heldout: these songs are held out from compiler decisions and run only at decision points'
    : '--heldout applies only to --panel=heldout');
  assert.ok(Number.isSafeInteger(jobs) && jobs >= 1 && jobs <= 64, 'jobs must be an integer from 1 to 64');
  assert.ok(budget === 'standard' || /^standard\*(0|[1-9]\d*)(\.\d+)?$/.test(budget) && Number(budget.slice(9)) > 0 ||
    (Number.isSafeInteger(Number(budget)) && Number(budget) > 0), 'budget must be standard, standard*FACTOR or a positive integer');
}
async function planFor(mode: string, budget: string, panelName: string, creative?: Record<string, unknown>): Promise<RunPlan> {
  const identity = compilerIdentity('.'), evaluator = evaluatorIdentity(), jolt = resolveJoltMs();
  const cases = await panelCases(panelName);
  assert.ok(cases.length > 0, `panel ${panelName} declares no cases (no matching variant files found)`);
  const panel = await Promise.all(cases.map(async c => (await resolveCase(c, jolt)).planned));
  // The compile adapter (compile.ts) turns a case into compile options; neither the
  // compiler identity nor the evaluator identity covers it, so the plan pins it.
  return {schema: 'line.eval.v2', identity, evaluator, adapter: ADAPTER_SHA256, jolt, mode, budget, panelName, panel, ...(creative ? {creative} : {})};
}
async function worker(dir: string, id: string) {
  const plan = readPlan(dir), c = plan.panel.find(c => c.id === id);
  assert.ok(c, 'undeclared worker case');
  assert.deepEqual(compilerIdentity('.'), plan.identity, 'compiler changed before worker started');
  assert.equal(evaluatorIdentity(), plan.evaluator, 'measurement code changed');
  assert.equal(ADAPTER_SHA256, plan.adapter, 'compile adapter (tools/eval/compile.ts) changed since the run was planned');
  const {spec, music, planned} = await resolveCase(c, plan.jolt);
  assert.deepEqual(planned, c, 'resolved authoring changed');
  const {cell, track} = await compileAndMeasure('.', c, {spec, music}, plan);
  assert.deepEqual(compilerIdentity('.'), plan.identity, 'compiler changed during worker');
  assert.equal(evaluatorIdentity(), plan.evaluator, 'measurement code changed during worker');
  assert.deepEqual((await resolveCase(c, plan.jolt)).planned, c, 'authoring changed during worker');
  saveCell(dir, plan, c, cell, track);
}
async function main() {
  const command = process.argv[2];
  if (command === 'worker') {assert.ok(arg('name') && arg('case')); await worker(runDir(arg('name')!), arg('case')!); return;}
  if ((command !== 'run' && command !== 'report') || !arg('name')) {console.error(USAGE); process.exitCode = 2; return;}
  if (command === 'run') {
    const budget = arg('budget', 'standard')!, mode = arg('mode', 'strike3')!, panelName = arg('panel', 'dev')!, jobs = Number(arg('jobs', String(defaultWorkerJobs())));
    validateRunOptions(mode, budget, jobs, panelName, {sealed: flag('sealed'), heldout: flag('heldout')});
    const creative = arg('creative') ? JSON.parse(arg('creative')!) : undefined;
    const dir = runDir(arg('name')!), plan = await planFor(mode, budget, panelName, creative);
    mkdirSync(join(dir, 'cells'), {recursive: true});
    const release = lockArtifacts(dir);
    try {
      if (existsSync(join(dir, 'run.json'))) assert.deepEqual(readPlan(dir), plan, 'run inputs or measurement code changed; choose a fresh directory');
      else atomicWrite(join(dir, 'run.json'), JSON.stringify(plan));
      const existing = readCells(dir, plan), queue = plan.panel.filter(c => !existing.has(c.id)), failures: string[] = [], began = performance.now();
      await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => {
        while (queue.length) {
          const c = queue.shift()!;
          try {
            await new Promise<void>((done, fail) => {
              const child = spawn(process.execPath, [import.meta.filename, 'worker', `--case=${c.id}`, `--name=${dir}`],
                {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
              child.once('error', fail); child.once('exit', (code, signal) => code === 0 ? done() : fail(new Error(`worker exited ${code ?? signal}`)));
            });
            console.log(`done  ${c.id}`);
          } catch (e) {failures.push(`${c.id}: ${e}`); console.error(`FAILED ${c.id}: ${e}`);}
        }
      }));
      assert.deepEqual(await planFor(mode, budget, panelName, creative), plan, 'inputs changed during run');
      if (failures.length) throw new Error(`${failures.length} workers failed; run is incomplete and cannot be reported. Resume the same plan after addressing the failures.\n${failures.join('\n')}`);
      assert.deepEqual(readPlan(dir), plan, 'saved run plan changed');
      const result = loadRun(dir);
      console.log(`${arg('name')}: ${result.cells.size}/${plan.panel.length} cells in ${((performance.now() - began) / 1000).toFixed(0)} s`);
    } finally {release();}
  } else {
    const a = loadRun(arg('name')!), b = arg('against') ? loadRun(arg('against')!) : undefined;
    if (a.run.panel.some((c: any) => c.bench)) {console.log(stratifiedReport(a, b, arg('name')!, arg('against')).join('\n')); return;}
    for (const [title, filter] of [['authored', (c: any) => !c.case.perturbation], ['perturbed', (c: any) => !!c.case.perturbation]] as const) {
      console.log(`\n${title} — ${arg('name')}${b ? ` vs ${arg('against')} (paired difference)` : ''}`);
      for (const metric of Object.keys(summarize([...a.cells.values()][0]))) {
        const values = songValues(a, metric, filter, b), [m, lo, hi] = bootstrap(values);
        console.log(`${metric.padEnd(42)} ${m.toFixed(3)} [${lo.toFixed(3)}, ${hi.toFixed(3)}] n=${[...values.values()].filter(Number.isFinite).length} songs`);
      }
    }
  }
}
const num = (x: number, signed = false) => !Number.isFinite(x) ? '—' : (signed && x > 0 ? '+' : '') + x.toFixed(3);
export const pad = (s: string, n: number) => s.length >= n ? s + ' ' : s.padEnd(n);
const who = (r: Run) => `${String(r.run.identity?.head ?? '?').slice(0, 8)} (fingerprint ${String(r.run.identity?.candidateFingerprint ?? '?').slice(0, 8)}${r.run.creative ? `, creative ${JSON.stringify(r.run.creative)}` : ''})`;
/** The stratified report (bench, sealed, held-out panels): completion, then
 * quality on both-complete cells, then per-spec detail with seed sign counts. */
export function stratifiedReport(a: Run, b: Run | undefined, nameA: string, nameB?: string): string[] {
  const r = stratify(a, b), out: string[] = [], paired = !!b, A = 'A', B = 'B';
  out.push(`${a.run.panelName} — A = ${nameA}${b ? `, B = ${nameB}; differences are A − B, paired by case` : ''}`,
    `compiler A ${who(a)}${b ? `, B ${who(b)}` : ''}; evaluator ${a.run.evaluator.slice(0, 12)}; ${a.run.panel.length} cases`,
    'Strata weigh equally. Within a stratum each spec weighs equally; seeds are averaged.',
    'Per spec: seed signs (+ A higher, − A lower, = identical) over cells complete in both arms; no per-spec intervals.', '');
  const strataNames = r.strata.map(s => s.stratum), ha = headline(a, strataNames), hb = b ? headline(b, strataNames) : undefined;
  const fmt = (x: number) => Number.isFinite(x) ? x.toFixed(2) : 'not recorded', cols = ha.counted;
  const row = (label: string, f: (s: string) => number, h: number, c: number, e: number) =>
    `${pad(label, 9)}${cols.map(s => pad(fmt(f(s)), 10)).join('')}${pad(fmt(h), 10)}${pad(fmt(c), 11)}${cols.length < strataNames.length ? fmt(e) : ''}`;
  out.push(`0. Headline score (production grade, 1000·exp(−rms/0.25); invalid or incomplete rides count 0;`,
    `   headline = mean of strata${cols.length < strataNames.length ? '; explicit requests (E) are shown apart and never counted' : ''})`,
    `${pad('', 9)}${cols.map(s => pad(s, 10)).join('')}${pad('headline', 10)}${pad('all cells', 11)}${cols.length < strataNames.length ? 'E (apart)' : ''}`,
    row(A, s => ha.perStratum[s], ha.strata, ha.cells, ha.explicit),
    ...(hb ? [row(B, s => hb.perStratum[s], hb.strata, hb.cells, hb.explicit),
      row('A − B', s => ha.perStratum[s] - hb.perStratum[s], ha.strata - hb.strata, ha.cells - hb.cells, ha.explicit - hb.explicit)] : []),
    ...(ha.recorded < a.run.panel.length || (hb && hb.recorded < a.run.panel.length) ? ['(cells measured before the score was recorded show "not recorded": remeasure them)'] : []),
    '', '1. Completion (every cell)', `${pad('stratum', 9)}${pad('cells', 7)}${pad(A, 8)}${paired ? pad(B, 8) + pad('recovered', 11) + 'lost' : ''}`);
  for (const s of r.strata) {
    const c = s.completion;
    out.push(`${pad(s.stratum, 9)}${pad(String(c.total), 7)}${pad(`${c.a}/${c.total}`, 8)}${paired ? pad(`${c.b}/${c.total}`, 8) + pad(String(c.recovered.length), 11) + c.lost.length : ''}`);
    for (const x of c.specs) out.push(`    ${pad(x.spec, 40)}${pad(`${x.a}/${x.n}`, 8)}${paired ? `${x.b}/${x.n}` : ''}`);
    if (c.recovered.length) out.push(`    recovered: ${c.recovered.join(', ')}`);
    if (c.lost.length) out.push(`    lost: ${c.lost.join(', ')}`);
  }
  out.push(`strata weighted equally (mean of stratum completion rates): A ${num(r.completionRate.a)}${paired ? `, B ${num(r.completionRate.b)}` : ''}`);
  for (const [arm, fails] of [[A, r.failures.a], ...(paired ? [[B, r.failures.b]] : [])] as Array<[string, typeof r.failures.a]>) {
    out.push(`failed rides, ${arm}: ${fails.length}`);
    for (const f of fails) out.push(`    ${pad(f.id, 44)}at ${pad(Number.isFinite(f.time) ? f.time.toFixed(2) + ' s' : '—', 9)}beats reached ${pad((100 * f.reached).toFixed(0) + '%', 6)}${f.kind}`);
  }
  const field = paired ? 'diff' : 'a';
  out.push('', `2. Quality on cells complete in ${paired ? 'both arms' : 'this run'}: ${paired ? 'A − B' : 'value'} by stratum (cells: ${
    r.strata.map(s => `${s.stratum} ${s.quality.reduce((n, q) => n + q.n, 0)}`).join(', ')}); "strata" = mean over strata`,
  `${pad('metric', 44)}${r.strata.map(s => pad(s.stratum, 11)).join('')}strata`);
  for (const k of r.metricNames) out.push(`${pad(k, 44)}${r.strata.map(s => pad(num(s.value[k][field], paired), 11)).join('')}${num(r.overall[k][field], paired)}`);
  out.push('', `3. Per spec: ${paired ? 'A − B (seed mean) and seed signs' : 'seed mean'}, on the same cells`);
  for (const s of r.strata) {
    out.push(`[${s.stratum}] ${s.quality.map((q, i) => `(${i + 1}) ${q.spec} n=${q.n}`).join('  ')}`,
      `  ${pad('', 42)}${s.quality.map((_, i) => pad(`(${i + 1})`, 22)).join('')}`.trimEnd());
    for (const k of r.metricNames) out.push(`  ${pad(k, 42)}${s.quality.map(q => {
      const m = q.metrics[k], value = paired ? m?.diff : m?.a;
      return pad(!Number.isFinite(value) ? '—' : paired ? `${num(m.diff, true)} +${m.up}−${m.down}=${m.same}` : num(m.a), 22);
    }).join('')}`.trimEnd());
  }
  return [...out, '', ...geometryReport(a, b)];
}
const GEOMETRY_TITLES = {time: 'share of ride time (frames), %', sections: 'share of sections, %', plan: 'planned', realized: 'realized (complete cells)'};
/** Section 4 of the stratified report: how rides use the geometry families.
 * Single run: values. Paired: A→B per stratum, then A, B and A − B over strata. */
export function geometryReport(a: Run, b?: Run): string[] {
  const g = geometryStrata(a, b), paired = !!b, missing = [g.recorded.a ? '' : 'A', paired && !g.recorded.b ? 'B' : ''].filter(Boolean);
  const out = [`4. Geometry: planned sections on every cell; realized facts on cells complete in ${paired ? 'both arms' : 'this run'} (${
    g.strata.map((s, i) => `${s} ${g.realizedCells[i]}`).join(', ')}). Descriptive only: no target, no verdict.`];
  if (missing.length === (paired ? 2 : 1)) return [...out, `not recorded: ${paired ? 'both runs predate' : 'this run predates'} geometry facts. They are compiler output`
    + ' (plan and realization), so remeasure cannot recover them; recompile to see them.'];
  if (missing.length) out.push(`not recorded for ${missing[0]}: that run predates geometry facts (compiler output; remeasure cannot recover them).`);
  out.push(`"short" = under ${g.shapedMinFrames.join('/')} frames (a reporting band: a 0.2 s pair is 8–9 frames). Families are the realized ones: a shaped`,
    'section the search simplified at a dead end shows as arcs, and is counted in "shapes simplified at a dead end".',
    `${pad('', 40)}${g.strata.map(s => pad(s, paired ? 10 : 8)).join('')}${paired ? `${pad('strata A', 10)}${pad('B', 9)}A − B` : 'strata'}`);
  for (const {group, rows} of g.groups) {
    const percent = (row: string) => group === 'time' || group === 'sections' || row.includes('share');
    out.push(GEOMETRY_TITLES[group]);
    for (const row of rows) {
      const v = g.values[group][row], scale = percent(row) ? 100 : 1, digits = percent(row) ? 0 : 1;
      const f = (x: number, d = digits, signed = false) => !Number.isFinite(x) ? '—' : (signed && x * scale > 0 ? '+' : '') + (x * scale).toFixed(d);
      out.push(`  ${pad(row, 38)}${v.strata.map(s => pad(paired ? `${f(s.a)}→${f(s.b)}` : f(s.a), paired ? 10 : 8)).join('')}${
        paired ? `${pad(f(v.overall.a, digits + 1), 10)}${pad(f(v.overall.b, digits + 1), 9)}${f(v.overall.diff, digits + 1, true)}` : f(v.overall.a, digits + 1)}`);
    }
  }
  return out;
}
if (import.meta.filename === process.argv[1]) await main();
