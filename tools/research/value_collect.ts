/** exp/retrain-v3 research tool: collect labelled planning probes for the
 * arc future-value model from the production compiler under line.strike.v3.
 *
 *   node --import tsx tools/research/value_collect.ts run --out=DIR [--seeds=1] [--jobs=16] [--budget=standard|N] [--limit=N]
 *       [--catalog=v4|v6transfer] [--only=FILE]
 *
 * --only=FILE restricts the work to the `id~seed` compiles listed in FILE (a JSON
 * array), e.g. the sources of an earlier construction artifact, so a later round
 * collects exactly the same compiles with only the searching policies changed.
 *
 * Training data: benchmark/v4 catalog cases, EXCLUDING every group derived from
 * the evaluation songs (luna_bala, amor_na_praia, tiki_tiki, amour_de_ma_vie),
 * so the model is disjoint from the eval panel. Each probe row is an arrival's
 * 57 value features, its local cost, and the continuation label with the
 * learned leaf prior removed (`pureFuture`), see arc_lookahead.ts. */
import {gzipSync} from 'node:zlib';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

export const EVAL_GROUPS = ['luna_bala', 'amor_na_praia', 'tiki_tiki', 'amour_de_ma_vie'];
const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

const catalog = arg('catalog', 'v4')!;
async function trainingCases(): Promise<any[]> {
  if (catalog === 'v6transfer') {
    // Explicit V6 plans with transfer rail layouts (rare in automatic plans), from non-evaluation music.
    const {loadCatalog} = await import('../../benchmark/v6/model.ts');
    const c = loadCatalog();
    return c.cases.filter((x: any) => x.layout === 'transfer' && ['arcs', 'fold', 'serpentine'].includes(x.family) && !/luna|amor|tiki|amour/i.test(x.sourceId))
      .map((x: any) => {const music = c.music.find((m: any) => m.id === x.sourceId)!;
        return {...music, id: x.id, group: `v6:${x.family}-transfer:${(music as any).group}`, plans: x.plans};});
  }
  const {loadCases} = await import('../../benchmark/v4/model.ts');
  return loadCases().filter((c: any) => !EVAL_GROUPS.includes(c.group) && !/luna|amor|tiki|amour/i.test(c.id));
}

async function worker(id: string, seed: number, out: string, requested: string) {
  const {caseSpec} = await import('../../benchmark/v4/model.ts');
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await import('../../scripts/v0/optimizer/production_budget.ts');
  const {setValueProbeSink} = await import('../../scripts/v0/optimizer/arc_lookahead.ts');
  const c = (await trainingCases()).find((x: any) => x.id === id)!;
  const spec = caseSpec(c), sink: any[] = [];
  const budget = requested === 'standard' ? productionBudget(spec.duration) : Number(requested);
  setValueProbeSink(sink);
  const began = performance.now();
  const cp = c.plans ? compileHandoff(spec, seed, {budget, constructionPlan: c.plans[seed], impactContract: 'line.strike.v3'})
    : compileHandoff(spec, seed, {budget, creative: {}, impactContract: 'line.strike.v3',
      phraseBoundaries: (c.phases ?? []).map((p: any) => p.start).filter((t: any) => Number.isFinite(t))});
  setValueProbeSink(null);
  // Construction demonstrations (as archive build_construction_examples.ts): fulfilled sections' committed controls.
  const {arcConstructionMemoryKey} = await import('../../scripts/v0/optimizer/arc_memory.ts');
  const {constructionStyle} = await import('../../scripts/v0/optimizer/repertoire_policy.ts');
  const {repertoireSearchOptions} = await import('../../scripts/v0/optimizer/repertoire_search.ts');
  const rep: any = cp.repertoire!;
  let construction: any;
  try { const options: any = repertoireSearchOptions(spec as any, rep.plan, budget, 'line.strike.v3');
  construction = rep.result.rows.map((row: any, i: number) => {
    const request = rep.plan.requests[i], check = rep.realization?.sections?.[i];
    return {key: request ? arcConstructionMemoryKey({...options, ...constructionStyle(request)}) : null, context: !!request?.context,
      fulfilled: !!check?.fulfilled, control: row.control, incoming: row.incoming, span: row.span, features: row.features};
  }); } catch (error) { construction = {error: String(error)}; }
  writeFileSync(out, gzipSync(JSON.stringify({id, group: c.group, seed, budget, compileMs: performance.now() - began,
    complete: cp.repertoire!.valid, physicalFrames: cp.repertoire!.physicalFrames,
    trackHash: createHash('sha256').update(JSON.stringify(cp.track)).digest('hex'), probes: sink, construction})));
}

const command = process.argv[2];
if (command === 'worker') await worker(arg('case')!, Number(arg('seed')), arg('out')!, arg('budget', 'standard')!);
else if (command === 'run') {
  const dir = resolve(arg('out')!), jobs = Number(arg('jobs', '16')), seeds = Number(arg('seeds', '1')), budget = arg('budget', 'standard')!;
  const cases = (await trainingCases()).slice(0, Number(arg('limit', '1000')));
  mkdirSync(dir, {recursive: true});
  const only = arg('only') ? new Set<string>(JSON.parse(readFileSync(arg('only')!, 'utf8'))) : null;
  // Explicit-plan cases compile at their catalog plan seeds.
  const work = cases.flatMap((c: any) => Array.from({length: seeds}, (_, k) => ({id: c.id, seed: c.plans ? Number(Object.keys(c.plans)[k]) : 101 * (k + 1)})))
    .filter(w => !only || only.has(`${w.id}~${w.seed}`))
    .filter(w => !existsSync(join(dir, `${w.id}~${w.seed}.json.gz`)));
  // Longest rides first, so the tail of the run stays parallel.
  const length = new Map(cases.map((c: any) => [c.id, c.durationFrames]));
  work.sort((a, b) => length.get(b.id)! - length.get(a.id)!);
  writeFileSync(join(dir, 'plan.json'), JSON.stringify({excludedGroups: EVAL_GROUPS, budget, seeds, cases: cases.map((c: any) => c.id), ...(only ? {only: [...only]} : {})}, null, 1));
  let next = 0, done = 0;
  await Promise.all(Array.from({length: jobs}, async () => {
    while (next < work.length) {
      const w = work[next++];
      await new Promise<void>(ok => {
        const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--catalog=${catalog}`, `--case=${w.id}`, `--seed=${w.seed}`,
          `--budget=${budget}`, `--out=${join(dir, `${w.id}~${w.seed}.json.gz`)}`], {stdio: ['ignore', 'ignore', 'pipe']});
        let err = ''; child.stderr.on('data', d => err += d);
        child.on('close', code => { done++; console.log(`${done}/${work.length} ${w.id}~${w.seed} ${code ? 'FAILED ' + err.slice(-300) : 'ok'}`); ok(); });
      });
    }
  }));
} else throw new Error('command is run or worker');
