/** Resolve authoring once, before workers or cache lookup. */
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildSync} from 'esbuild';
import {makeRng} from '../../scripts/lib/rng.ts';
import {loadMusicCase} from '../../scripts/produce/music_artifacts.ts';

export const SONGS = ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s', 'amour_de_ma_vie_44s'];
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type EvalCase = {id: string; song: string; seed: number; perturbation: number | null};
const panel = (seeds: number[], ps: number[]): EvalCase[] => [
  ...SONGS.flatMap(song => seeds.map(seed => ({id: `${song}~${seed}`, song, seed, perturbation: null}))),
  ...SONGS.flatMap(song => ps.map(p => ({id: `${song}~${seeds[0]}~p${p}`, song, seed: seeds[0], perturbation: p}))),
];
export const PANELS: Record<string, EvalCase[]> = {dev: panel([101, 202, 303, 404], [1, 2]), confirm: panel([505, 606, 707, 808], [3, 4])};

export function perturb(spec: any, p: number) {
  const rng = makeRng(1000 + p), contacts = spec.contacts.map((c: any, i: number) => {
    const shift = i === 0 ? 0 : Math.floor(rng() * 3) - 1;
    return {...c, t: c.t + shift / 40, ...(c.impact === undefined ? {} : {impact: Math.min(1, Math.max(0, c.impact + (rng() * 2 - 1) * .05))})};
  });
  for (let i = 1; i < contacts.length; i++) if (contacts[i].t <= contacts[i - 1].t + 4 / 40) contacts[i].t = spec.contacts[i].t;
  return {...spec, contacts};
}

export async function resolveCase(c: EvalCase, jolt: number) {
  const definition = {song: c.song, title: c.song, moments: []};
  const loaded = await loadMusicCase(definition, jolt), authored = await loadMusicCase(definition, 0);
  const spec = c.perturbation ? perturb(loaded.spec, c.perturbation) : loaded.spec;
  const music = {...loaded.musicCase, contacts: spec.contacts.map((x: any) => ({frame: Math.round(x.t * 40), impact: x.impact}))};
  const targets = spec.contacts.map((x: any) => ({t: x.t, frame: Math.round(x.t * 40), impact: x.impact ?? null}));
  const input = {jolt, specSha256: music.specSha256, audioSha256: music.audioSha256, analysisSha256: music.analysisSha256,
    resolvedSha256: digest({duration: spec.duration, preroll: spec.preroll, jitter: spec.jitter, targets, music})};
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
  const files = new Set([...Object.keys(metafile.inputs),
    ...['tools/eval', 'tools/measure'].flatMap(dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.ts')).map(f => join(dir, f))),
    'package-lock.json', 'scripts/lib/native_motion/engine.wasm',
    'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm']);
  return digest({node: process.version, files: [...files].sort().map(p => [p, createHash('sha256').update(readFileSync(join(root, p))).digest('hex')])});
}
