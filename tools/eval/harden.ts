/** Generate the V8 suite (docs/benchmark.md, "V8"): every V7.1 spec and some formerly held-out
 * specs, made faster, shorter and more contrasted, written as frozen variant files.
 *
 *   node tools/eval/harden.ts            # writes productions/<song>/variants/v8-*.ts and tools/eval/suites/v8.json
 *
 * The transformation, the same for every spec:
 *   (the phases, which give the planner its phrase boundaries, follow the warp; the camera and music fields are dropped)
 *   - time: one monotone warp anchored on the beats. Every gap between consecutive beats (and
 *     before the first, and after the last to the end) becomes TIME × its length in frames,
 *     rounded, but never shorter than MIN_GAP frames or its own length if that is shorter. The
 *     axes' keyframes, the bench windows and the explicit construction windows follow the
 *     same warp, piecewise linearly between beats.
 *   - impact asks: CONTRAST × their distance from 0.5, clamped to [0, 1].
 *
 * A generated file holds plain data (contacts, keyframes, start, preroll): it no longer
 * fits its song and is for scoring only. It does not change when its source spec changes,
 * so the suite stays fixed while specifications are reworked. Run this again only to make
 * a new suite version. */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {benchMeta, type BenchMeta} from './inputs.ts';

export const TIME = 0.85, CONTRAST = 1.25, MIN_GAP = 6;
const FPS = 40;
/** Formerly held-out specs that join development in V8, with their category. The rest stay held out (inputs.ts HELDOUT). */
export const JOINING: Array<{song: string; variant: string | null; stratum: string; pattern: string}> = [
  {song: 'trouble_50s', variant: null, stratum: 'P1', pattern: 'two-hit pairs at speed (Trouble, preferred spec)'},
  {song: 'circus_minimus_77s', variant: 'pairs4', stratum: 'P1', pattern: 'pairs and the sung hook (Circus Minimus pairs4)'},
  {song: 'valhalla_40s', variant: null, stratum: 'P2', pattern: 'words (Valhalla, preferred spec)'},
  {song: 'circus_minimus_77s', variant: 'voice-drums', stratum: 'P2', pattern: 'fast voice and drums (Circus Minimus hook)'},
  ...['funk_estranho_super_slowed', 'let_the_world_burn', 'montagem_coma', 'no_batidao'].map(s =>
    ({song: `${s}_selection`, variant: null, stratum: 'G', pattern: 'groove'}))];
/** A window around every gap of at most this many seconds, for the joining P1/P2 specs. */
const SHORT_GAP_S = 0.35;

const round3 = (x: number) => Math.round(x * 1000) / 1000;
export const contrast = (impact: number) => round3(Math.min(1, Math.max(0, 0.5 + CONTRAST * (impact - 0.5))));
const newGap = (frames: number) => Math.max(Math.round(TIME * frames), Math.min(frames, MIN_GAP));

/** The warp of a spec: beat frames and duration before → after, and t ↦ t' between them. */
export function timeWarp(beatFrames: number[], durationFrames: number) {
  const before = [0, ...beatFrames, durationFrames], after = [0];
  for (let i = 1; i < before.length; i++) {
    assert.ok(before[i] > before[i - 1], 'beats must be strictly increasing frames inside the spec');
    after.push(after[i - 1] + newGap(before[i] - before[i - 1]));
  }
  const piecewise = (from: number[], to: number[]) => (t: number) => {
    const f = t * FPS;
    let i = 1;
    while (i < from.length - 1 && f > from[i]) i++;
    const [a, b, a2, b2] = [from[i - 1], from[i], to[i - 1], to[i]];
    return (a2 + (f - a) * (b2 - a2) / (b - a)) / FPS;
  };
  return {beats: after.slice(1, -1), duration: after.at(-1)!, map: piecewise(before, after), inverse: piecewise(after, before)};
}

type Source = {song: string; variant: string | null; stratum: string; pattern?: string};
async function harden(root: string, s: Source) {
  const file = resolve(root, 'productions', s.song, ...(s.variant ? ['variants', `${s.variant}.ts`] : ['spec.ts']));
  const module = await import(pathToFileURL(file).href), spec = module.default;
  const frames = spec.contacts.map((c: any) => Math.round(c.t * FPS)), durationFrames = Math.round(spec.duration * FPS);
  const warp = timeWarp(frames, durationFrames);
  const axes = Object.fromEntries(Object.entries(spec.axes ?? {}).map(([name, curve]: [string, any]) => {
    const meta = curve.meta;
    if (meta?.points?.length) return [name, {defaultEase: meta.defaultEase ?? 'linear',
      points: meta.points.map((p: any) => ({t: round3(warp.map(p.t)), v: p.v, ...(p.ease ? {ease: p.ease} : {})}))}];
    // A curve given as a function: its value at every frame of the new timeline, held, runs merged.
    const points: Array<{t: number; v: number}> = [];
    for (let f = 0; f <= warp.duration; f++) {
      const v = curve(warp.inverse(f / FPS));
      assert.ok(Number.isFinite(v), `${file}: axis ${name} is not targeted everywhere; freezing needs a value at every frame`);
      if (points.at(-1)?.v !== v) points.push({t: f / FPS, v});
    }
    return [name, {defaultEase: 'hold', points}];
  }));
  const contacts = spec.contacts.map((c: any, i: number) => ({t: warp.beats[i] / FPS, ...(c.impact === undefined ? {} : {impact: contrast(c.impact)})}));
  const duration = warp.duration / FPS;
  const windows = (w: Array<[number, number]>) => w.map(([a, b]) => [round3(warp.map(a)), Math.min(duration, round3(warp.map(b)))] as [number, number]);
  let bench: BenchMeta;
  if (s.variant && module.bench) {
    const b = benchMeta(module, file);
    bench = {stratum: b.stratum, pattern: b.pattern, windows: windows(b.windows),
      ...(b.construction ? {construction: b.construction.map(w => ({...w, from: round3(warp.map(w.from)), to: round3(warp.map(w.to))}))} : {})};
  } else if (s.stratum === 'G') bench = {stratum: 'G', pattern: 'groove', windows: [[0, duration]]};
  else {
    // Joining P1/P2 specs: their pattern happens at their short gaps.
    const w: Array<[number, number]> = [];
    for (let i = 1; i < contacts.length; i++) if (contacts[i].t - contacts[i - 1].t <= SHORT_GAP_S) {
      const a = Math.max(0, round3(contacts[i - 1].t - 0.05)), b = Math.min(duration, round3(contacts[i].t + 0.05));
      if (w.length && a <= w.at(-1)![1]) w.at(-1)![1] = b; else w.push([a, b]);
    }
    bench = {stratum: s.stratum, pattern: s.pattern!, windows: w};
  }
  assert.equal(bench.stratum, s.stratum, `${file}: stratum`);
  // The planner reads phrase boundaries from the phases (compile.ts compileOptions): they follow the warp too.
  const phases = (module.overlayMeta?.phases ?? []).map((p: any) => {
    assert.ok(Number.isFinite(p.t0) && Number.isFinite(p.t1), `${file}: a phase without t0/t1`);
    return {name: p.name, t0: round3(warp.map(p.t0)), t1: Math.min(duration, round3(warp.map(p.t1)))};
  });
  const source = `${s.song}/${s.variant ? `variants/${s.variant}` : 'spec'}.ts`;
  const text = [
    `/** V8 (generated by tools/eval/harden.ts, ${new Date().toISOString().slice(0, 10)}; do not edit): ${source}`,
    ` * with time ×${TIME} (no gap below ${MIN_GAP} frames or its own length) and impact asks ×${CONTRAST} around 0.5.`,
    ` * Scoring only: it no longer fits the song. */`,
    `import type {Spec} from '../../../scripts/v0/types.ts';`,
    `import {keyframes} from '../../../scripts/v0/core/curves.ts';`,
    '',
    `export const bench = ${JSON.stringify(bench)};`,
    `export const overlayMeta = {phases: ${JSON.stringify(phases)}};`,
    '',
    'const spec: Spec = {',
    `  duration: ${duration},`,
    ...(spec.start ? [`  start: ${JSON.stringify(spec.start)},`] : []),
    ...(spec.preroll !== undefined ? [`  preroll: ${spec.preroll},`] : []),
    '  axes: {',
    ...Object.entries(axes).map(([name, a]: [string, any]) => `    ${name}: keyframes(${JSON.stringify(a.points)}, ${JSON.stringify(a.defaultEase)}),`),
    '  },',
    '  contacts: [',
    ...contacts.map((c: any) => `    ${JSON.stringify(c)},`),
    '  ],',
    '};',
    'export default spec;',
    ''].join('\n');
  const name = `v8-${s.variant ?? 'spec'}`;
  mkdirSync(join(root, 'productions', s.song, 'variants'), {recursive: true});
  writeFileSync(join(root, 'productions', s.song, 'variants', `${name}.ts`), text);
  return {song: s.song, variant: name, stratum: bench.stratum, source};
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const root = '.', v71 = JSON.parse(readFileSync(join(root, 'tools/eval/suites/v7.1.json'), 'utf8'));
  const specs = [];
  for (const s of [...v71.specs, ...JOINING]) specs.push(await harden(root, s));
  writeFileSync(join(root, 'tools/eval/suites/v8.json'), JSON.stringify({
    name: 'V8', frozen: new Date().toISOString().slice(0, 10), design: 'docs/benchmark.md (V8)',
    generator: `tools/eval/harden.ts: time ×${TIME} (no gap below ${MIN_GAP} frames or its own length), impact asks ×${CONTRAST} around 0.5`,
    seeds: {sequence: '101 x k for k = 1, 2, 3, ...', default: 4},
    note: 'Every V7.1 spec and eight formerly held-out specs, made faster, shorter and more contrasted, frozen as data. The suite is exactly this list; changing it makes a new version.',
    specs}, null, 1) + '\n');
  console.log(`${specs.length} specs written`);
}
