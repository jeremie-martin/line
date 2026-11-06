/** Resolve authoring once, before workers or cache lookup. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildSync} from 'esbuild';
import {makeRng} from '../../scripts/lib/rng.ts';
import {loadMusicCase} from '../../scripts/produce/music_artifacts.ts';

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Where a stratified case's pattern happens: authored (music) seconds. An
 * empty list means the whole ride (the G stratum and the held-out specs). */
export type BenchMeta = {stratum: string; pattern: string; windows: Array<[number, number]>; construction?: ConstructionWindow[]};
/** `variant: null` is the song's spec.ts. `perturbation` exists for saved runs:
 * the blind night study's evaluations used perturbed specs. */
export type EvalCase = {id: string; song: string; seed: number; perturbation: number | null; variant: string | null; bench: BenchMeta};

export const STRATA = ['G', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'E'];
/** Explicit geometry requests (stratum E): these gaps ask for one geometry;
 * the rest of the ride is the automatic plan. Reported apart from the headline. */
export const EXPLICIT = 'E';
export type ConstructionWindow = {from: number; to: number; family: string; rail: 'offered' | 'required' | 'handover'};
/** Held-out songs: run only at decision points, never used for compiler decisions. */
export const HELDOUT: Array<{song: string; variant: string | null}> = [
  {song: 'trouble_50s', variant: null}, {song: 'valhalla_40s', variant: null},
  {song: 'circus_minimus_77s', variant: null}, {song: 'circus_minimus_77s', variant: 'pairs4'},
  // The voice-and-drums hook (2026-11-01): fast words, a hard ride for the compiler.
  {song: 'circus_minimus_77s', variant: 'voice-drums'}];
export const PANEL_HELP: Record<string, string> = {
  v7: 'V7.0 (tools/eval/suites/v7.0.json): its 28 specs x the first N seeds of 101, 202, 303, ... (N = 4 unless --seeds=N)',
  'v7-confirm': 'V7.0 at seeds 505, 606, 707, 808 (seeds 5 to 8 of the sequence)',
  sealed: 'every sealed-* variant x 101, 202, 303; only with --sealed, to confirm an adopted candidate',
  heldout: 'Trouble, Valhalla, Circus preferred specs + Circus pairs4 and voice-drums x 101-404; only with --heldout. '
    + 'These songs are held out from compiler decisions: run them only at decision points, never to tune',
};
export const PANEL_NAMES = Object.keys(PANEL_HELP);

/** Validated `bench` export of a bench-* or sealed-* variant module. */
export function benchMeta(module: any, where: string): BenchMeta {
  const b = module.bench, duration = module.default?.duration;
  assert.ok(b && typeof b === 'object', `${where}: missing \`export const bench = {stratum, pattern, windows}\``);
  assert.ok(STRATA.includes(b.stratum), `${where}: bench.stratum must be one of ${STRATA.join(', ')}`);
  assert.ok(typeof b.pattern === 'string' && b.pattern.length > 0, `${where}: bench.pattern must be a non-empty string`);
  assert.ok(Array.isArray(b.windows) && b.windows.length > 0, `${where}: bench.windows must list at least one [t0, t1]`);
  b.windows.forEach((w: any, i: number) => {
    assert.ok(Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] >= 0 && w[0] < w[1] && w[1] <= duration,
      `${where}: window ${i} must be [t0, t1] seconds with 0 <= t0 < t1 <= duration`);
    assert.ok(i === 0 || w[0] >= b.windows[i - 1][1], `${where}: windows must be sorted and disjoint`);
  });
  assert.equal(b.stratum === EXPLICIT, Array.isArray(b.construction), `${where}: stratum E and a \`construction\` list go together`);
  if (b.construction) b.construction.forEach((w: any, i: number) => {
    assert.ok(Number.isFinite(w.from) && Number.isFinite(w.to) && w.from < w.to && w.from >= 0 && w.to <= duration, `${where}: construction ${i} needs from < to inside the song`);
    assert.ok(['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered'].includes(w.family), `${where}: construction ${i}: unknown geometry ${w.family}`);
    assert.ok(['offered', 'required', 'handover'].includes(w.rail), `${where}: construction ${i}: rail is offered, required or handover`);
  });
  return {stratum: b.stratum, pattern: b.pattern, windows: b.windows.map((w: number[]) => [w[0], w[1]]),
    ...(b.construction ? {construction: b.construction.map((w: any) => ({from: w.from, to: w.to, family: w.family, rail: w.rail}))} : {})};
}
const variantPath = (root: string, song: string, variant: string) => resolve(root, 'productions', song, 'variants', `${variant}.ts`);
const importBench = async (root: string, song: string, variant: string) =>
  benchMeta(await import(pathToFileURL(variantPath(root, song, variant)).href), `${song}/variants/${variant}.ts`);
/** Every `productions/<song>/variants/<prefix>-*.ts`, sorted, with its bench metadata. */
export async function discoverVariants(prefix: 'sealed', root = '.') {
  const songs = readdirSync(join(root, 'productions')).filter(s => existsSync(join(root, 'productions', s, 'variants'))).sort();
  const found = songs.flatMap(song => readdirSync(join(root, 'productions', song, 'variants'))
    .filter(f => f.startsWith(prefix + '-') && f.endsWith('.ts')).sort().map(f => ({song, variant: f.slice(0, -3)})));
  return Promise.all(found.map(async v => ({...v, bench: await importBench(root, v.song, v.variant)})));
}
const stratified = (song: string, variant: string | null, seed: number, bench: BenchMeta): EvalCase =>
  ({id: `${song}~${variant ?? 'spec'}~${seed}`, song, seed, perturbation: null, variant, bench});
const GROOVE: BenchMeta = {stratum: 'G', pattern: 'groove', windows: []};

/** The frozen V7 suite: exactly the specs its file lists (docs/benchmark.md). */
export const V7_SUITE = 'tools/eval/suites/v7.0.json';
/** Seed k (1-based) of every V7 sequence: 101, 202, 303, ... */
export const v7Seed = (k: number) => 101 * k;
export async function v7Cases(seeds: number[], root = '.'): Promise<EvalCase[]> {
  const suite = JSON.parse(readFileSync(join(root, V7_SUITE), 'utf8'));
  const specs = await Promise.all(suite.specs.map(async (s: {song: string; variant: string | null; stratum: string}) => {
    if (s.variant === null) {assert.equal(s.stratum, 'G', `${V7_SUITE}: a song's spec.ts is stratum G`); return {...s, bench: GROOVE};}
    const bench = await importBench(root, s.song, s.variant);
    assert.equal(bench.stratum, s.stratum, `${V7_SUITE}: ${s.song}/${s.variant} is stratum ${bench.stratum} in its file`);
    return {...s, bench};
  }));
  return specs.flatMap(s => seeds.map(seed => stratified(s.song, s.variant, seed, s.bench)));
}
/** The declared cases of a panel. Sealed specs are discovered from their variant files. */
export async function panelCases(name: string, root = '.', seedCount?: number): Promise<EvalCase[]> {
  assert.ok(PANEL_NAMES.includes(name), `unknown evaluation panel ${name}`);
  assert.ok(seedCount === undefined || name === 'v7', '--seeds applies to the v7 panel');
  if (name === 'heldout') return HELDOUT.flatMap(h => [101, 202, 303, 404].map(seed =>
    stratified(h.song, h.variant, seed, {stratum: 'H', pattern: h.variant ?? 'preferred', windows: []})));
  if (name === 'sealed') return (await discoverVariants('sealed', root)).flatMap(v => [101, 202, 303].map(seed => stratified(v.song, v.variant, seed, v.bench)));
  if (name === 'v7') {
    const n = seedCount ?? 4;
    assert.ok(Number.isSafeInteger(n) && n >= 1 && n <= 32, '--seeds is a whole number from 1 to 32');
    return v7Cases(Array.from({length: n}, (_, k) => v7Seed(k + 1)), root);
  }
  return v7Cases([5, 6, 7, 8].map(v7Seed), root);
}

export function perturb(spec: any, p: number) {
  const rng = makeRng(1000 + p), contacts = spec.contacts.map((c: any, i: number) => {
    const shift = i === 0 ? 0 : Math.floor(rng() * 3) - 1;
    return {...c, t: c.t + shift / 40, ...(c.impact === undefined ? {} : {impact: Math.min(1, Math.max(0, c.impact + (rng() * 2 - 1) * .05))})};
  });
  for (let i = 1; i < contacts.length; i++) if (contacts[i].t <= contacts[i - 1].t + 4 / 40) contacts[i].t = spec.contacts[i].t;
  return {...spec, contacts};
}

export async function resolveCase(c: EvalCase, jolt: number) {
  const definition = {song: c.song, title: c.song, moments: [], ...(c.variant ? {variant: c.variant} : {})};
  if (c.variant && /^(bench|sealed|v7)-/.test(c.variant)) assert.deepEqual(await importBench('.', c.song, c.variant), c.bench, `${c.id}: bench metadata changed`);
  const [loaded, authored] = await Promise.all([loadMusicCase(definition, jolt), loadMusicCase(definition, 0)]);
  const spec = c.perturbation ? perturb(loaded.spec, c.perturbation) : loaded.spec;
  const music = {...loaded.musicCase, contacts: spec.contacts.map((x: any) => ({frame: Math.round(x.t * 40), impact: x.impact}))};
  const targets = spec.contacts.map((x: any) => ({t: x.t, frame: Math.round(x.t * 40), impact: x.impact ?? null}));
  const input = {jolt, specSha256: music.specSha256, audioSha256: music.audioSha256, analysisSha256: music.analysisSha256,
    resolvedSha256: digest({duration: spec.duration, preroll: spec.preroll, targets, music})};
  return {spec, music, planned: {...c, input, targets, authoredTargets: authored.musicCase.contacts}};
}

/** Measurement code has its own identity: changing a tool without committing it
 * must invalidate cached observations, without conflating two compiler versions. */
export function evaluatorIdentity(root = '.') {
  // Follow actual imports so a change in an indirect ruler or engine wrapper
  // cannot reuse old measurements. The gallery's isolated engine import uses a
  // runtime URL, so declare that entry explicitly, along with both WASM assets.
  const {metafile} = buildSync({absWorkingDir: resolve(root), entryPoints: ['tools/eval/measure.ts', 'tools/eval/inputs.ts', 'scripts/lib/_lr_engine_wasm.ts'],
    bundle: true, platform: 'node', format: 'esm', packages: 'external', metafile: true, write: false,
    outdir: '/unused-evaluator-build', logLevel: 'silent'});
  // The import closure is the measurement: reports, comparison bookkeeping and
  // research scripts beside it do not change what a cell records.
  const files = new Set([...Object.keys(metafile.inputs),
    'package-lock.json', 'scripts/lib/native_motion/engine.wasm',
    'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm']);
  return digest({node: process.version, files: [...files].sort().map(p => [p, createHash('sha256').update(readFileSync(join(root, p))).digest('hex')])});
}
