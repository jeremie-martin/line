/** Compare a candidate compiler with a named reference, on a panel.
 *
 * Bookkeeping only: it compiles what is missing, reuses every compatible saved
 * cell, reports the evidence after each round, and stops and resumes at any
 * point. It announces no winner; the decision is ours.
 *
 *   npm run compare -- run --reference=NAME [--candidate=.|REF] [--panel=bench] [--jobs=44] [--rounds=N]
 *                          [--mode=strike3] [--budget=standard] [--creative=JSON] [--candidate-budget=..] [--candidate-creative=..]
 *   npm run compare -- report  (same selection flags; reports saved cells only, compiles nothing; --detail prints the detail too)
 *   any command: --only=REGEX restricts the panel to matching case ids
 *   npm run compare -- rides   (same selection flags) [--top=6 | --cases=ID,ID]  side-by-side rides on the dashboard
 *   npm run compare -- reference set NAME [--from=REF] [--note=TEXT] | reference list
 *
 * --candidate=. (the default) compiles this checkout as it is, uncommitted
 * changes included; a commit or branch compiles from a worktree of it, so this
 * checkout stays free. A round is every spec's k-th seed: rides run round by
 * round, categories interleaved, so a stopped run covers the panel evenly.
 * Ctrl-C keeps finished rides and prints a report labelled PARTIAL. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
import {ENGINE_PATH} from '../../scripts/lib/compiler_identity.ts';
import {resolveJoltMs} from '../../scripts/produce/jolt.ts';
import {panelCases, resolveCase, evaluatorIdentity, digest, EXPLICIT} from './inputs.ts';
import {readJson, type PlannedCase, type Run, type RunPlan} from './records.ts';
import {compileAndMeasure, type ArmSettings} from './compile.ts';
import {compilerContent, commitContent, resolveCommit, worktreeFor, openArm, savedCell, saveArmCell, readArmTrack, readArmGallery, setReference, getReference,
  listReferences, type Arm} from './arms.ts';
import {headline, headlineScore, specKey, mean} from './summary.ts';
import {validateRunOptions, stratifiedReport} from './eval.ts';
import {seedBlocks, formatSupport, MIN_BLOCKS} from './uncertainty.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => process.argv.includes(`--${k}`);
const sha256 = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const engineSha = () => sha256(readFileSync(ENGINE_PATH));
const subject = (commit: string) => execFileSync('git', ['log', '-1', '--format=%s', commit]).toString().trim();
const pad = (s: string, n: number) => s.length >= n ? s + ' ' : s.padEnd(n);
const signed = (x: number, d = 1) => !Number.isFinite(x) ? '—' : (x > 0 ? '+' : '') + x.toFixed(d);

type Side = 'candidate' | 'reference';
type Selection = {panel: string; reference: ReturnType<typeof getReference>; arms: Record<Side, Arm>; cases: PlannedCase[];
  resolved: Map<string, Promise<{spec: any; music: any}>>; evaluator: string; name: string};

/** Everything a command needs: the two arms, the panel's resolved cases, and the measurement identity. */
async function select(): Promise<Selection> {
  const panel = arg('panel', 'v7')!, mode = arg('mode', 'strike3')!, budget = arg('budget', 'standard')!;
  // --seeds=N: the first N seeds of the v7 sequence (default 4); more seeds reuse every saved ride.
  const seedCount = arg('seeds') ? Number(arg('seeds')) : undefined;
  const creative = arg('creative') ? JSON.parse(arg('creative')!) : undefined;
  validateRunOptions(mode, budget, 1, panel, {sealed: flag('sealed'), heldout: flag('heldout')});
  const candidateBudget = arg('candidate-budget', budget)!, candidateCreative = arg('candidate-creative') ? JSON.parse(arg('candidate-creative')!) : creative;
  validateRunOptions(mode, candidateBudget, 1, panel, {sealed: flag('sealed'), heldout: flag('heldout')});
  const settings: ArmSettings = {mode, budget, ...(creative ? {creative} : {})};
  const candidateSettings: ArmSettings = {mode, budget: candidateBudget, ...(candidateCreative ? {creative: candidateCreative} : {})};
  assert.ok(arg('reference'), '--reference=NAME is required (see `npm run compare -- reference list`)');
  const reference = getReference(arg('reference')!), jolt = resolveJoltMs();
  const refContent = commitContent(reference.commit, engineSha());
  const candidateRef = arg('candidate', '.')!;
  let candidate: Arm;
  if (candidateRef === '.') {
    const content = compilerContent('.');
    candidate = openArm('.', `this checkout (${content.head.slice(0, 8)}${content.clean ? '' : ' + uncommitted changes'})`, content, candidateSettings, jolt);
  } else {
    const commit = resolveCommit(candidateRef);
    candidate = openArm('', `${candidateRef} (${commit.slice(0, 8)})`, commitContent(commit, engineSha()), candidateSettings, jolt);
  }
  const ref = openArm('', `${reference.name} (${reference.commit.slice(0, 8)})`, refContent, settings, jolt);
  // --only=REGEX restricts the panel to matching case ids (a targeted look; coverage then refers to that subset).
  const only = arg('only') ? new RegExp(arg('only')!) : null, declared = (await panelCases(panel, '.', seedCount)).filter(c => !only || only.test(c.id));
  assert.ok(declared.length, `no case of ${panel} matches --only`);
  assert.ok(declared.every(c => c.bench), `compare uses the stratified panels (bench, bench-confirm, bench-pairs8, sealed, heldout); ${panel} is a legacy panel`);
  const resolvedCases = await Promise.all(declared.map(c => resolveCase(c, jolt)));
  const resolved = new Map(resolvedCases.map(r => [r.planned.id, Promise.resolve({spec: r.spec, music: r.music})]));
  const name = arg('name', `${candidateRef === '.' ? 'checkout' : candidateRef.replace(/[^A-Za-z0-9._-]/g, '_')}-vs-${reference.name}@${reference.commit.slice(0, 8)}-${panel}${only ? '-only' : ''}`)!;
  // A comparison keeps its configuration under its name: running it again with
  // more seeds extends it; anything else needs another --name.
  // This checkout is edited all the time: pin it as "this checkout", a commit by its arm.
  const config = {panel, only: arg('only') ?? null, reference: reference.commit, referenceArm: ref.key,
    candidate: candidateRef === '.' ? {ref: '.', settings: candidateSettings} : {ref: candidateRef, arm: candidate.key}};
  const configPath = resolve('generated/eval/compare', name, 'comparison.json');
  if (existsSync(configPath)) {
    const saved = readJson(configPath);
    assert.deepEqual(saved, config, `comparison ${name} was started with another configuration (${configPath}); use --name=… for a new one`);
  } else {mkdirSync(resolve('generated/eval/compare', name), {recursive: true}); writeFileSync(configPath, JSON.stringify(config, null, 1));}
  return {panel, reference, arms: {candidate, reference: ref}, cases: resolvedCases.map(r => r.planned), resolved, evaluator: evaluatorIdentity(), name};
}

/** Rounds: every spec's k-th seed (seeds in ascending order). */
export function rounds(cases: PlannedCase[]) {
  const bySpec = new Map<string, PlannedCase[]>();
  for (const c of cases) bySpec.set(specKey(c), [...(bySpec.get(specKey(c)) ?? []), c]);
  const index = new Map<string, number>();
  for (const xs of bySpec.values()) xs.sort((a, b) => a.seed - b.seed).forEach((c, k) => index.set(c.id, k));
  const count = Math.max(...index.values()) + 1;
  // Within a round, take categories in turn so a stopped round is spread out.
  return Array.from({length: count}, (_, k) => {
    const own = cases.filter(c => index.get(c.id) === k), byCat = new Map<string, PlannedCase[]>();
    for (const c of own) byCat.set(c.bench!.stratum, [...(byCat.get(c.bench!.stratum) ?? []), c]);
    const lists = [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'en', {numeric: true})).map(s => byCat.get(s)!), order: PlannedCase[] = [];
    for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length) order.push(l[i]);
    return order;
  });
}

/** Saved cells of both arms (remeasured if needed), and what is missing. */
async function loadState(s: Selection) {
  const cells: Record<Side, Map<string, any>> = {candidate: new Map(), reference: new Map()};
  const missing: Record<Side, PlannedCase[]> = {candidate: [], reference: []}, notes: string[] = [];
  for (const side of ['candidate', 'reference'] as const) {
    let remeasured = 0, stale = 0;
    for (const c of s.cases) {
      const arm = s.arms[side], before = existsSync(join(arm.dir, 'cells', c.id + '.json')) ? readJson(join(arm.dir, 'cells', c.id + '.json')).evaluator : null;
      const state = await savedCell(arm, c, s.evaluator, () => s.resolved.get(c.id)!);
      if (state && 'cell' in state) {cells[side].set(c.id, state.cell); if (before && before !== s.evaluator) remeasured++;}
      else {missing[side].push(c); if (state) stale++;}
    }
    notes.push(`${side}: ${cells[side].size} saved${remeasured ? ` (${remeasured} remeasured with today's measurement code)` : ''}, ` +
      `${missing[side].length} to compile${stale ? ` (${stale} saved with other inputs)` : ''}`);
  }
  return {cells, missing, notes};
}

function runOf(s: Selection, side: Side, cells: Map<string, any>, ids: string[]): Run {
  const arm = s.arms[side], panel = s.cases.filter(c => ids.includes(c.id));
  const run: RunPlan = {schema: 'line.eval.v2', identity: {head: arm.content.clean ? arm.content.head : 'checkout', candidateFingerprint: arm.content.key},
    evaluator: s.evaluator, jolt: arm.jolt, mode: arm.settings.mode, budget: arm.settings.budget, panelName: s.panel, panel,
    ...(arm.settings.creative ? {creative: arm.settings.creative} : {})};
  return {dir: arm.dir, run, cells: new Map(ids.map(id => [id, cells.get(id)]))};
}

/** The evidence on matched pairs: headline difference (overall and per
 * category), rides gained and lost, the spread over specs, and compute. */
function evidence(s: Selection, cells: Record<Side, Map<string, any>>, ids: string[]) {
  const a = runOf(s, 'candidate', cells.candidate, ids), b = runOf(s, 'reference', cells.reference, ids);
  const all = [...new Set(a.run.panel.map(c => c.bench!.stratum))].sort((x, y) => x.localeCompare(y, 'en', {numeric: true}));
  // The one headline definition (summary.ts): explicit requests (E) apart, never counted.
  const ha = headline(a, all), hb = headline(b, all), strata = ha.counted;
  const explicitIds = a.run.panel.filter(c => c.bench!.stratum === EXPLICIT).map(c => c.id);
  const done = (side: Side, id: string) => cells[side].get(id).complete as boolean;
  const gained = ids.filter(id => done('candidate', id) && !done('reference', id)), lost = ids.filter(id => !done('candidate', id) && done('reference', id));
  const specs = [...new Set(a.run.panel.filter(c => c.bench!.stratum !== EXPLICIT).map(specKey))].map(spec => {
    const own = a.run.panel.filter(c => specKey(c) === spec).map(c => c.id);
    return {spec, d: mean(own.map(id => headlineScore(cells.candidate.get(id)) - headlineScore(cells.reference.get(id))))};
  }).sort((x, y) => x.d - y.d);
  const perRide = (side: Side, f: (c: any) => number) => mean(ids.map(id => f(cells[side].get(id))));
  const explicit = explicitIds.length ? {n: explicitIds.length,
    score: [ha.explicit, hb.explicit],
    finished: (['candidate', 'reference'] as const).map(side => explicitIds.filter(id => done(side, id)).length),
    realized: (['candidate', 'reference'] as const).map(side => {
      const counts = explicitIds.map(id => requestedRealized(a.run.panel.find(c => c.id === id)!, cells[side].get(id)));
      return [counts.reduce((n, x) => n + x[0], 0), counts.reduce((n, x) => n + x[1], 0)];
    })} : null;
  const diversity = (['candidate', 'reference'] as const).map(side =>
    betweenStarts(a.run.panel.filter(c => c.bench!.stratum !== EXPLICIT), cells[side]));
  return {pairs: ids.length, strata, explicit, diversity, delta: ha.strata - hb.strata, perStratum: Object.fromEntries(strata.map(st => [st, ha.perStratum[st] - hb.perStratum[st]])),
    candidate: ha.strata, reference: hb.strata, gained, lost, specs,
    frames: [perRide('candidate', c => c.physicalFrames), perRide('reference', c => c.physicalFrames)],
    compile: [perRide('candidate', c => c.compileMs), perRide('reference', c => c.compileMs)]};
}
/** How different the rides of different random starts are, within one arm:
 * for every spec and every pair of its seeds, the share of gaps whose realized
 * geometry differs (family, and whether the upper rail was touched) and the
 * mean per-gap difference in airtime; pairs averaged per spec, specs equally.
 * Reported to watch the generator, never part of any score. */
export function betweenStarts(cases: PlannedCase[], cells: Map<string, any>) {
  const bySpec = new Map<string, any[]>();
  for (const c of cases) if (cells.get(c.id)?.geometry) bySpec.set(specKey(c), [...(bySpec.get(specKey(c)) ?? []), cells.get(c.id)]);
  const geometry: number[] = [], airtime: number[] = [];
  for (const rides of bySpec.values()) {
    const g: number[] = [], m: number[] = [];
    for (let x = 0; x < rides.length; x++) for (let y = x + 1; y < rides.length; y++) {
      const a = rides[x].geometry.sections, b = rides[y].geometry.sections, n = Math.min(a.length, b.length);
      const kind = (s: any) => `${s.family}${s.guideFrames > 0 ? '+rail' : ''}`;
      let differ = 0; for (let k = 1; k < n; k++) if (kind(a[k]) !== kind(b[k])) differ++;
      g.push(differ / Math.max(1, n - 1));
      const air = (ride: any) => new Map(ride.gaps.filter((o: any) => o[1] === 'air' && o[3] !== null).map((o: any) => [o[0], o[3]]));
      const aa = air(rides[x]), ab = air(rides[y]), shared = [...aa.keys()].filter(k => ab.has(k));
      m.push(mean(shared.map(k => Math.abs((aa.get(k) as number) - (ab.get(k) as number)))));
    }
    if (g.length) {geometry.push(mean(g)); airtime.push(mean(m));}
  }
  return {specs: geometry.length, geometry: mean(geometry), airtime: mean(airtime)};
}
/** Requested gaps of an explicit case that the ride realized as asked
 * (the requested geometry, fulfilled), out of all requested gaps. */
function requestedRealized(c: PlannedCase, cell: any): [number, number] {
  let frame = 1, realized = 0, asked = 0;
  for (const sec of cell.geometry?.sections ?? []) {
    const w = sec && c.bench!.construction!.find(w => frame >= Math.round(w.from * 40) && frame < Math.round(w.to * 40));
    if (w && frame > 1) {asked++; if (sec.family === w.family && sec.fulfilled) realized++;}
    frame += sec.frames;
  }
  return [realized, asked];
}
/** Seed-block uncertainty (uncertainty.ts): one headline difference per
 * complete block, a block being one seed of every spec in the selection. */
function blockUncertainty(s: Selection, cells: Record<Side, Map<string, any>>) {
  const cov = coverage(s, cells), rs = rounds(s.cases), blocks = comparableBlocks(s.cases, cov.done);
  const u = seedBlocks(blocks.map(k => evidence(s, cells, rs[k].map(c => c.id)).delta));
  return 'unavailable' in u && blocks.length < cov.done.length
    ? {...u, unavailable: `${u.unavailable} covering every spec; ${cov.done.length - blocks.length} complete round(s) cover fewer specs and are left out`} : u;
}
/** The complete rounds that are comparable seed blocks: those covering every
 * spec of the selection (a panel with unequal seed counts per spec, such as
 * bench, has later rounds with fewer specs and other weights). */
export function comparableBlocks(cases: PlannedCase[], done: number[]) {
  const specs = new Set(cases.map(specKey)).size, rs = rounds(cases);
  return done.filter(k => new Set(rs[k].map(specKey)).size === specs);
}
function uncertaintyLines(u: ReturnType<typeof seedBlocks>) {
  if ('unavailable' in u) return [`  uncertainty: not estimable yet (${u.unavailable})`];
  return [`  uncertainty over ${u.n} complete seed blocks: mean ${signed(u.mean)}, 95% interval [${signed(u.interval[0])}, ${signed(u.interval[1])}]; ` +
    `directional support P(mean change > 0) ${formatSupport(u.support)}`,
    `    block differences: ${u.blocks.map(d => signed(d)).join(', ')}`,
    `    (a t model of the seed blocks: the mean change on this fixed suite across seeds, not on new music; ` +
    `reading it repeatedly and stopping when it looks good makes it optimistic)`];
}
function evidenceLines(e: ReturnType<typeof evidence>) {
  const up = e.specs.filter(x => x.d > 0).length, down = e.specs.filter(x => x.d < 0).length, same = e.specs.length - up - down;
  const ends = e.specs.length ? `lowest ${signed(e.specs[0].d)} (${e.specs[0].spec}), highest ${signed(e.specs.at(-1)!.d)} (${e.specs.at(-1)!.spec})` : '';
  const automatic = e.strata.length ? [
    `  headline ${e.candidate.toFixed(1)} vs ${e.reference.toFixed(1)}: ${signed(e.delta)} (categories ${e.strata.join(', ')} weighted equally; ${e.pairs} matched pairs)`,
    `  by category: ${e.strata.map(st => `${st} ${signed(e.perStratum[st])}`).join(' · ')}`,
    `  specs up ${up}, down ${down}, unchanged ${same}; ${ends}`] : ['  (no automatic categories in this selection: no headline)'];
  return [...automatic,
    `  rides finished: gained ${e.gained.length}${e.gained.length ? ` (${e.gained.join(', ')})` : ''}, lost ${e.lost.length}${e.lost.length ? ` (${e.lost.join(', ')})` : ''}`,
    ...(e.explicit ? [`  explicit requests (E, apart from the headline, ${e.explicit.n} rides): headline ${e.explicit.score[0].toFixed(1)} vs ${e.explicit.score[1].toFixed(1)} ` +
      `(${signed(e.explicit.score[0] - e.explicit.score[1])}); finished ${e.explicit.finished[0]} vs ${e.explicit.finished[1]}; ` +
      `requested gaps realized (the compiler's own shape check) ${e.explicit.realized[0][0]}/${e.explicit.realized[0][1]} vs ${e.explicit.realized[1][0]}/${e.explicit.realized[1][1]}`] : []),
    ...(e.diversity[0].specs ? [`  between random starts (reported, never a target): geometry differs in ${(100 * e.diversity[0].geometry).toFixed(0)}% vs ` +
      `${(100 * e.diversity[1].geometry).toFixed(0)}% of gaps; airtime differs by ${e.diversity[0].airtime.toFixed(3)} vs ${e.diversity[1].airtime.toFixed(3)} per gap`] : []),
    `  compute per ride: physics ${(e.frames[0] / 1e6).toFixed(2)}M vs ${(e.frames[1] / 1e6).toFixed(2)}M frames (${signed((e.frames[0] - e.frames[1]) / 1e6, 2)}M); ` +
    `compile ${(e.compile[0] / 1000).toFixed(0)} s vs ${(e.compile[1] / 1000).toFixed(0)} s (wall time: depends on how many rides ran at once)`];
}

/** Coverage: matched pairs overall, per category, complete rounds, outstanding work. */
export function coverage(s: Pick<Selection, "cases">, cells: Record<Side, Map<string, any>>) {
  const matched = s.cases.filter(c => cells.candidate.has(c.id) && cells.reference.has(c.id)).map(c => c.id);
  // Rounds can complete out of order (rides finish when they finish).
  const rs = rounds(s.cases), done = rs.map((r, k) => r.every(c => matched.includes(c.id)) ? k : -1).filter(k => k >= 0);
  const complete = done.length, inComplete = done.flatMap(k => rs[k].map(c => c.id));
  const cats = [...new Set(s.cases.map(c => c.bench!.stratum))].sort((x, y) => x.localeCompare(y, 'en', {numeric: true}));
  const byCat = cats.map(st => `${st} ${s.cases.filter(c => c.bench!.stratum === st && matched.includes(c.id)).length}/${s.cases.filter(c => c.bench!.stratum === st).length}`);
  return {matched, inComplete, complete, done, rounds: rs.length, byCat,
    outstanding: {candidate: s.cases.filter(c => !cells.candidate.has(c.id)).length, reference: s.cases.filter(c => !cells.reference.has(c.id)).length}};
}

function report(s: Selection, cells: Record<Side, Map<string, any>>, notes: string[] = []) {
  const cov = coverage(s, cells), full = cov.matched.length === s.cases.length, out: string[] = [];
  const {candidate: ca, reference: ra} = s.arms;
  out.push(`${full ? 'COMPLETE' : 'PARTIAL'} comparison on ${s.panel}: candidate ${ca.label} vs reference ${s.reference.name}`,
    `  reference ${s.reference.name}: ${s.reference.commit.slice(0, 8)} "${subject(s.reference.commit)}"${s.reference.note ? ` (${s.reference.note})` : ''}`,
    `  candidate: ${ca.content.clean ? `${ca.content.head.slice(0, 8)} "${subject(ca.content.head)}"` : `${ca.content.head.slice(0, 8)} with uncommitted changes`}`,
    `  provenance: compiler content ${ca.content.key.slice(0, 12)} vs ${ra.content.key.slice(0, 12)}${ca.content.key === ra.content.key ? ' (THE SAME COMPILER)' : ''}; ` +
    `engine ${ca.content.engineSha256.slice(0, 12)}; measurement ${s.evaluator.slice(0, 12)}; mode ${ca.settings.mode}; ` +
    `allowance ${ca.settings.budget === ra.settings.budget ? ca.settings.budget : `candidate ${ca.settings.budget}, reference ${ra.settings.budget}`}` +
    `${JSON.stringify(ca.settings.creative ?? {}) !== JSON.stringify(ra.settings.creative ?? {}) ? `; creative candidate ${JSON.stringify(ca.settings.creative ?? {})}, reference ${JSON.stringify(ra.settings.creative ?? {})}` : ''}`,
    ...notes.map(n => `  ${n}`),
    `  coverage: ${cov.matched.length}/${s.cases.length} matched pairs; complete rounds ${cov.complete}/${cov.rounds}; by category ${cov.byCat.join(' · ')}`,
    ...(full ? [] : [`  outstanding: candidate ${cov.outstanding.candidate}, reference ${cov.outstanding.reference} rides; resume with the same command`]), '');
  if (!cov.matched.length) return [...out, 'No matched pairs yet.'];
  // "Evenly": the comparable seed blocks, rounds that cover every spec.
  const rs = rounds(s.cases), even = comparableBlocks(s.cases, cov.done), evenIds = even.flatMap(k => rs[k].map(c => c.id));
  const evenly = evenIds.length === cov.matched.length;
  if (!full && even.length && !evenly)
    out.push(`Evidence on the ${even.length} complete round(s) that cover every spec (${evenIds.length} pairs, the panel evenly):`, ...evidenceLines(evidence(s, cells, evenIds)), '');
  out.push(`Evidence on ${full ? 'the whole panel' : evenly ? `the ${even.length} complete round(s) (${cov.matched.length} pairs, the panel evenly)`
    : `all ${cov.matched.length} matched pairs (categories unevenly covered)`}:`, ...evidenceLines(evidence(s, cells, cov.matched)),
    ...uncertaintyLines(blockUncertainty(s, cells)), '');
  const moved = cov.matched.map(id => ({id, d: headlineScore(cells.candidate.get(id)) - headlineScore(cells.reference.get(id))}))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8);
  out.push('Rides that moved most (candidate − reference, headline points); see them with `npm run compare -- rides` and the same flags:',
    ...moved.map(m => `  ${pad(m.id, 46)}${signed(m.d)}`), '');
  out.push('Detail (the stratified report on the matched pairs; A = candidate, B = reference):', '');
  return [...out, ...stratifiedReport(runOf(s, 'candidate', cells.candidate, cov.matched), runOf(s, 'reference', cells.reference, cov.matched), 'candidate', s.reference.name)];
}
/** The report up to its detail section: what to read first. */
const summaryOf = (lines: string[]) => lines.slice(0, Math.max(0, lines.findIndex(l => l.startsWith('Detail ('))) || lines.length);
function saveReport(s: Selection, lines: string[]) {
  const dir = resolve('generated/eval/compare', s.name);
  mkdirSync(dir, {recursive: true}); writeFileSync(join(dir, 'report.txt'), lines.join('\n') + '\n');
  return join(dir, 'report.txt');
}

async function run() {
  const s = await select(), jobs = Number(arg('jobs', '44')), maxRounds = arg('rounds') ? Number(arg('rounds')) : Infinity;
  assert.ok(Number.isSafeInteger(jobs) && jobs >= 1 && jobs <= 64, 'jobs must be an integer from 1 to 64');
  const {cells, missing, notes} = await loadState(s);
  for (const n of notes) console.log(n);
  // The same arm on both sides (same compiler and setting): compile each ride once.
  const same = s.arms.candidate.key === s.arms.reference.key;
  if (same) {missing.reference = []; console.log('candidate and reference are the same arm: each ride is compiled once and serves both');}
  // Roots only when something must be compiled: a worktree per commit, this checkout for `.`.
  for (const side of ['candidate', 'reference'] as const) if (missing[side].length && !s.arms[side].root) s.arms[side].root = worktreeFor(s.arms[side].content.head);
  // Only an arm that will be written is locked: a fully saved reference serves any number of comparisons at once.
  const releases = [...new Set((['candidate', 'reference'] as const).filter(side => missing[side].length).map(side => s.arms[side].dir))].map(d => lockArtifacts(d));
  const rs = rounds(s.cases).slice(0, maxRounds), queue: Array<{side: Side; c: PlannedCase}> = [];
  for (const r of rs) for (const c of r) for (const side of ['candidate', 'reference'] as const) if (missing[side].some(m => m.id === c.id)) queue.push({side, c});
  const announced = new Set<number>(coverage(s, cells).done);
  let stopping = false, finished = 0;
  const children = new Set<ReturnType<typeof spawn>>(), failures: string[] = [], began = performance.now();
  // Ctrl-C, or a termination signal from whoever started the run: stop
  // scheduling, stop the workers, keep finished rides, release the locks, report.
  const stop = () => {if (!stopping) {stopping = true; console.log('\nstopping: finished rides are kept; writing a partial report…');} for (const ch of children) ch.kill('SIGINT');};
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  console.log(`${queue.length} rides to compile (${rs.length < rounds(s.cases).length ? `first ${rs.length} round(s)` : 'every round'}), ${Math.min(jobs, queue.length)} at a time`);
  try {
    await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => {
      while (queue.length && !stopping) {
        const {side, c} = queue.shift()!, arm = s.arms[side], pending = join(arm.dir, `pending-${c.id}.json`);
        writeFileSync(pending, JSON.stringify({case: c, root: arm.root, contentKey: arm.content.key, evaluator: s.evaluator, label: arm.label}));
        try {
          await new Promise<void>((done, fail) => {
            const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--arm=${arm.dir}`, `--pending=${pending}`],
              {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit'], detached: true});
            children.add(child);
            child.once('error', fail); child.once('exit', (code, signal) => {children.delete(child); code === 0 ? done() : fail(new Error(`worker exited ${code ?? signal}`));});
          });
        } catch (e) {
          if (!stopping) {failures.push(`${side} ${c.id}: ${e}`); console.error(`FAILED ${side} ${c.id}: ${e}`);}
          continue;
        } finally {if (existsSync(pending)) unlinkSync(pending);}
        cells[side].set(c.id, readJson(join(arm.dir, 'cells', c.id + '.json'))); finished++;
        if (same) cells.reference.set(c.id, cells[side].get(c.id));
        const cov = coverage(s, cells);
        for (const k of cov.done) if (!announced.has(k)) {
          announced.add(k);
          console.log(`\nround ${k + 1}/${cov.rounds} complete (${cov.complete} of ${cov.rounds} now) · ${cov.matched.length}/${s.cases.length} matched pairs · ${((performance.now() - began) / 60000).toFixed(1)} min`,
            `\n  coverage ${cov.byCat.join(' · ')}`, '\n' + [...evidenceLines(evidence(s, cells, cov.inComplete)),
              ...(cov.complete >= MIN_BLOCKS ? uncertaintyLines(blockUncertainty(s, cells)) : [])].join('\n'));
        }
        if (finished % 10 === 0) console.log(`  ${finished} rides compiled this session; ${cov.matched.length}/${s.cases.length} matched pairs`);
      }
    }));
  } finally {for (const r of releases) r();}
  const lines = report(s, cells, notes);
  console.log('\n' + summaryOf(lines).join('\n'));
  if (failures.length) console.log(`\n${failures.length} rides failed to compile (not results; fix and resume):\n${failures.join('\n')}`);
  console.log(`\nfull report (with the detail): ${saveReport(s, lines)}`);
  if (stopping) process.exitCode = 130;
  else if (failures.length) process.exitCode = 1;
}

async function worker() {
  const armDir = arg('arm')!, p = readJson(arg('pending')!), c: PlannedCase = p.case, meta = readJson(join(armDir, 'arm.json'));
  const content = compilerContent(p.root);
  assert.equal(content.key, p.contentKey, `the compiler at ${p.root} changed before this ride started`);
  assert.equal(evaluatorIdentity(), p.evaluator, 'measurement code changed');
  const {spec, music, planned} = await resolveCase(c, meta.jolt);
  assert.deepEqual(planned, c, 'resolved inputs changed');
  const settings = {mode: meta.mode, budget: meta.budget, creative: meta.creative};
  const {cell, track, gallery} = await compileAndMeasure(p.root, c, {spec, music}, settings);
  assert.equal(compilerContent(p.root).key, p.contentKey, `the compiler at ${p.root} changed during this ride`);
  assert.equal(evaluatorIdentity(), p.evaluator, 'measurement code changed during this ride');
  const arm = {dir: armDir, settings} as Arm;
  saveArmCell(arm, c, cell, track, p.evaluator, {commit: content.head, clean: content.clean, compiledAt: new Date().toISOString()}, gallery);
}

/** The rides that moved most (or --cases=ID,…), both arms, on the dashboard:
 * the saved rides themselves. The gallery record is written by the producer's
 * own writer (saveMusicCell) from the compile outputs saved with each ride, and
 * the exported track must be byte-identical to the compared one. */
async function rides() {
  const s = await select(), {cells} = await loadState(s), cov = coverage(s, cells);
  const top = Number(arg('top', '6')), ids = arg('cases') ? arg('cases')!.split(',') : cov.matched
    .map(id => ({id, d: headlineScore(cells.candidate.get(id)) - headlineScore(cells.reference.get(id))}))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, top).map(x => x.id);
  assert.ok(ids.every(id => cov.matched.includes(id)), 'rides are shown for matched pairs only');
  const {loadMusicCase, saveMusicCell} = await import('../../scripts/produce/music_artifacts.ts');
  const {writeGalleryJson} = await import('../../scripts/gallery/artifacts.ts');
  const {judgeIdentity} = await import('../../benchmark/v6/contract.ts');
  const outRoot = resolve('generated/compare', s.name), entries: any[] = [];
  mkdirSync(outRoot, {recursive: true});
  for (const id of ids) for (const side of ['reference', 'candidate'] as const) {
    const c = s.cases.find(x => x.id === id)!, arm = s.arms[side], cell = cells[side].get(id), gallery = readArmGallery(arm, id);
    assert.ok(gallery, `${side} ${id} was saved before rides kept their compile outputs; compile it again to show it`);
    // An export is the saved ride itself: its folder is named by the arm and the
    // saved track, and a reused export must still show that track.
    const label = `${side}-${id.replace(/~/g, '-')}-${arm.key.slice(0, 8)}-${cell.trackHash.slice(0, 12)}`, out = join(outRoot, label);
    if (existsSync(join(out, 'manifest.json'))) {
      const shown = readJson(join(out, 'manifest.json')).cells[0];
      assert.equal(shown.trackHash, cell.trackHash, `${out} does not show the saved ride; remove it and export again`);
    } else {
      mkdirSync(out, {recursive: true});
      const {musicCase} = await loadMusicCase({song: c.song, title: `${c.song}${c.variant ? ` · ${c.variant}` : ''}`, moments: [], ...(c.variant ? {variant: c.variant} : {})}, arm.jolt);
      for (const key of ['specSha256', 'audioSha256', 'analysisSha256'] as const) assert.equal(musicCase[key], c.input[key], `${id}: ${key} changed since the ride was compared`);
      const plan = {schema: 'line.automatic-production.v1', kind: 'musical-direction', source: 'npm run compare (saved benchmark ride)',
        compiler: {contentKey: arm.content.key, commit: arm.content.clean ? arm.content.head : null, arm: arm.key}, judge: judgeIdentity(),
        jolt: arm.jolt, impactContract: gallery.result.impactEvaluation?.contract, cases: [musicCase], seeds: [c.seed], budgets: [gallery.budget],
        methods: ['production'], methodDetails: {production: {title: 'Automatic arrangement', description: 'A saved V7 benchmark ride.'}},
        request: {mode: 'production', song: c.song, ...(c.variant ? {variant: c.variant} : {}), seed: c.seed, budget: gallery.budget, creative: arm.settings.creative ?? {}}};
      const planSha256 = writeGalleryJson(out, 'plan.json', plan), production = gallery.production;
      const phrases = production.plan.phrases.map((p: any) => {
        const requests = production.plan.requests.slice(p.first, p.first + p.count);
        return {...p, title: p.construction, window: [requests[0].frame / 40, Math.min(musicCase.durationFrames / 40, requests.at(-1)!.next / 40)], sections: requests.map((r: any) => r.section)};
      });
      const saved = saveMusicCell({out, planSha256, c: musicCase, method: 'production', seed: c.seed, budget: gallery.budget, allowance: gallery.budget,
        result: gallery.result, reference: null, referenceTrace: null, compileMs: gallery.compileMs, physicalFrames: gallery.physicalFrames,
        production, styles: production.styles, phrases, work: gallery.work});
      assert.equal(saved.cell.trackHash, sha256(JSON.stringify(readArmTrack(arm, id))), `${side} ${id}: the exported track is not the compared one`);
      writeGalleryJson(out, 'manifest.json', {schema: 'line.motion-gallery.v1', planSha256, plan, cells: [saved.cell],
        sets: [{actualCompilationFrames: gallery.physicalFrames, productionFrames: gallery.physicalFrames, productionAllowance: gallery.budget,
          validation: 'A saved benchmark ride, shown as compiled and compared (no second compile).'}],
        summary: [{method: 'production', valid: Number(saved.cell.valid), runs: 1, meanScore: saved.cell.score.score}]});
    }
    entries.push({id: `${side}-${id}`, seed: c.seed, video: false, status: cell.complete ? 'Fulfilled' : 'Incomplete',
      title: `${id} · ${side === 'reference' ? `reference ${s.reference.name}` : `candidate ${s.arms.candidate.label}`} — score ${headlineScore(cell).toFixed(0)}` +
        `${side === 'candidate' ? ` (${signed(headlineScore(cell) - headlineScore(cells.reference.get(id)))})` : ''}${cell.complete ? '' : ', did not finish'}`,
      manifest: '/' + join('generated/compare', s.name, label, 'manifest.json')});
  }
  writeGalleryJson(outRoot, 'collection.json', {schema: 'line.production-library.v1',
    description: `${s.name}: reference ${s.reference.name}, then the candidate, for each ride`, entries});
  console.log(`rides: http://10.77.77.30:8767/motion-gallery/production.html?collection=/generated/compare/${s.name}/collection.json`);
}

async function main() {
  const command = process.argv[2];
  if (command === 'worker') return worker();
  if (command === 'run') return run();
  if (command === 'report') {
    const s = await select(), {cells, notes} = await loadState(s), lines = report(s, cells, notes);
    console.log((flag('detail') ? lines : summaryOf(lines)).join('\n'));
    console.log(`\nfull report (with the detail): ${saveReport(s, lines)}`); return;
  }
  if (command === 'rides') return rides();
  if (command === 'reference' && process.argv[3] === 'set') {
    const name = process.argv[4], commit = resolveCommit(arg('from', 'HEAD')!);
    assert.ok(name && !name.startsWith('--'), 'usage: reference set NAME [--from=REF] [--note=TEXT]');
    const r = setReference(name, commit, arg('note'));
    console.log(`reference ${r.name} = ${commit.slice(0, 8)} "${subject(commit)}"`); return;
  }
  if (command === 'reference' && process.argv[3] === 'list') {
    for (const r of listReferences()) console.log(`${pad(r.name, 24)}${r.commit.slice(0, 8)} ${r.setAt.slice(0, 10)} "${subject(r.commit)}"${r.note ? ` — ${r.note}` : ''}`);
    return;
  }
  console.error(readFileSync(import.meta.filename, 'utf8').split('*/')[0]); process.exitCode = 2;
}
if (import.meta.filename === process.argv[1]) await main();
