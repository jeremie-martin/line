/** Behavioural evaluation of the production compiler, with songs as the unit.
 *
 *   node --import tsx tools/eval/eval.ts run    --name=DIR [--mode=strike3|strike2|strike|landing] [--budget=standard|N] [--panel=dev|confirm] [--jobs=24]
 *   node --import tsx tools/eval/eval.ts report --name=DIR [--against=DIR]
 *
 * Panel: each production song × 4 arrangement seeds (distinct plans, so distinct
 * tracks) + each song × 2 perturbed authorings (beat times ±1 frame, impacts
 * ±0.05) at seed 101. Every compile runs in a fresh process at the production
 * budget. The report keeps completion separate from quality, gives every ruler
 * (frozen landing score, contact-impact account, sync measures, motion, cost),
 * and resamples songs, not seeds, for its intervals. */
import {gzipSync} from 'node:zlib';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {makeRng} from '../../scripts/lib/rng.ts';
import {compilerIdentity} from '../../scripts/lib/compiler_identity.ts';

const SONGS = ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s', 'amour_de_ma_vie_44s'];
// 'standard' is the length-scaled production allowance; a number fixes it for every song.
const DEFAULT_BUDGET = 'standard';
const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
type Case = {id: string; song: string; seed: number; perturbation: number | null};
const panel = (seeds: number[], perturbed: number[]): Case[] => [
  ...SONGS.flatMap(song => seeds.map(seed => ({id: `${song}~${seed}`, song, seed, perturbation: null}))),
  ...SONGS.flatMap(song => perturbed.map(p => ({id: `${song}~${seeds[0]}~p${p}`, song, seed: seeds[0], perturbation: p}))),
];
/** dev: the panel decisions were made on. confirm: fresh arrangement seeds and
 * perturbations, for checking that adopted changes hold beyond dev. */
export const PANELS: Record<string, Case[]> = {dev: panel([101, 202, 303, 404], [1, 2]), confirm: panel([505, 606, 707, 808], [3, 4])};
export const PANEL = PANELS.dev;
const findCase = (id: string) => Object.values(PANELS).flat().find(x => x.id === id)!;

/** Small, musically plausible authoring perturbation: the questions it asks are
 * whether quality survives inputs the compiler and its models have not seen. */
function perturb(spec: any, p: number) {
  const rng = makeRng(1000 + p), contacts = spec.contacts.map((c: any, i: number) => {
    const shift = i === 0 ? 0 : Math.floor(rng() * 3) - 1;
    return {...c, t: c.t + shift / 40, ...(c.impact === undefined ? {} : {impact: Math.min(1, Math.max(0, c.impact + (rng() * 2 - 1) * .05))})};
  });
  for (let i = 1; i < contacts.length; i++) if (contacts[i].t <= contacts[i - 1].t + 4 / 40) contacts[i].t = spec.contacts[i].t;
  return {...spec, contacts};
}

async function worker(caseId: string, mode: string, out: string, requested: string) {
  const c = findCase(caseId);
  const {loadMusicCase} = await import('../../scripts/produce/music_artifacts.ts');
  const {resolveJoltMs} = await import('../../scripts/produce/jolt.ts');
  const {compileHandoff} = await import('../../scripts/v0/optimizer/handoff.ts');
  const {productionBudget} = await import('../../scripts/v0/optimizer/production_budget.ts');
  const {replayGalleryTrack} = await import('../../scripts/gallery/artifacts.ts');
  const {observe} = await import('../measure/observe.ts');
  const {beatRows} = await import('../measure/measures.ts');
  const {strikeFrames, strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} = await import('../measure/strike.ts');
  const loaded = await loadMusicCase({song: c.song, title: c.song, moments: []}, resolveJoltMs());
  const spec = c.perturbation ? perturb(loaded.spec, c.perturbation) : loaded.spec;
  const music = {...loaded.musicCase, contacts: spec.contacts.map((x: any) => ({frame: Math.round(x.t * 40), impact: x.impact}))};
  const budget = requested === 'standard' ? productionBudget(spec.duration) : Number(requested);
  const began = performance.now();
  const contract = ({landing: undefined, strike: 'line.strike.v1', strike2: 'line.strike.v2', strike3: 'line.strike.v3'} as Record<string, string | undefined>)[mode];
  if (!(mode in {landing: 1, strike: 1, strike2: 1, strike3: 1})) throw new Error('mode is landing, strike, strike2 or strike3');
  const cp = compileHandoff(spec, c.seed, {budget, creative: {}, ...(contract ? {impactContract: contract as any} : {}),
    phraseBoundaries: loaded.musicCase.phases.map((p: any) => p.t0 ?? p.t ?? p.start).filter((t: any) => Number.isFinite(t))});
  const compileMs = performance.now() - began, r = cp.repertoire!;
  const frozen = replayGalleryTrack(cp.track, music, false).grade;
  const targets = music.contacts, observation = observe(cp.track, music.durationFrames, targets);
  const strikes = detectStrikes(strikeFrames(observation)).filter(e => e.onset <= music.durationFrames);
  const strike = accountStrikes(strikes, targets);
  // Every run is also scored under v2 (whole-body motion change), whatever it optimized.
  const motionFrames = strikeMotionFrames(observation);
  const impacts = detectStrikes(motionFrames, STRIKE_V2_CONTRACT).filter(e => e.onset <= music.durationFrames);
  const impact = accountStrikes(impacts, targets, STRIKE_V2_CONTRACT);
  // ...and under v3, where a floor-then-rail double contact is two impacts.
  const impacts3 = detectStrikes(motionFrames, STRIKE_V3_CONTRACT).filter(e => e.onset <= music.durationFrames);
  const impact3 = accountStrikes(impacts3, targets, STRIKE_V3_CONTRACT);
  // Guards from the blind-spot audit (docs/research/scorecard-blind-spots-20261005.md).
  const pt = (f: number, i: number) => observation.frames[f].points[i], NOSE = 2, TAIL = 1, BODY = [4, 5, 6, 7];
  const vel = (f: number) => {let x = 0, y = 0; for (const [a, b, c2, d] of observation.frames[f].points) {x += a - c2; y += b - d;} return [x / 10, y / 10];};
  const strongPose = impact3.matches.filter((m: any) => (targets[m.target].impact ?? 0) >= .6).map((m: any) => {
    const f0 = impacts3[m.event].contactStart, ax = pt(f0, NOSE)[0] - pt(f0, TAIL)[0], ay = pt(f0, NOSE)[1] - pt(f0, TAIL)[1], [vx, vy] = vel(Math.max(0, f0 - 1));
    return Math.abs(Math.atan2(ay, ax)) > Math.PI / 2 || ax * vx + ay * vy < 0;
  });
  const last = Math.min(music.durationFrames, observation.frames.length - 1);
  let dragFrames = 0, run = 0, kicks = 0;
  for (let f = 1; f <= last; f++) {
    const body = observation.frames[f].collisions.some((x: number[]) => BODY.includes(x[1]));
    run = body ? run + 1 : 0; if (run === 6) dragFrames += 6; else if (run > 6) dragFrames++;
    const [px, py] = vel(f - 1), before = Math.hypot(px, py + .175), gain = Math.hypot(...vel(f)) - before;
    if (gain > Math.max(.75, .1 * before) && !targets.some((t: any) => Math.abs(t.frame - f) <= 4)) kicks++;
  }
  const guards = {strongInverted: strongPose.length ? strongPose.filter(Boolean).length / strongPose.length : NaN,
    dragSecondsPerMinute: dragFrames / 40 / (last / 40 / 60), offBeatKicks: kicks};
  const strongExtras = (account: any, events: any[]) => account.unmatchedEvents.filter((i: number) => events[i].strength >= .25).length;
  const beats = beatRows({id: c.id, set: mode, song: c.song, seed: c.seed, durationFrames: music.durationFrames,
    targets: spec.contacts.map((x: any) => ({t: x.t, frame: Math.round(x.t * 40), impact: x.impact})), ...observation});
  // The compiled track, for diagnosis without recompiling.
  writeFileSync(out.replace(/\.json$/, '.track.json.gz'), gzipSync(JSON.stringify(cp.track)));
  writeFileSync(out, JSON.stringify({case: c, mode, trackHash: createHash('sha256').update(JSON.stringify(cp.track)).digest('hex'),
    physicalFrames: r.physicalFrames, compileMs, complete: r.valid, fulfilled: r.qualified,
    frozen: {valid: frozen.score.valid, score: frozen.score.score, axes: frozen.score.components},
    // Per gap and axis (air, speed, amplitude): [gap, axis, target, achieved], signed errors recoverable.
    gaps: frozen.observations.filter((o: any) => o.axis !== 'impact').map((o: any) => [o.gap, o.axis, +o.target.toFixed(4), o.achieved === null ? null : +o.achieved.toFixed(4)]),
    contact: {loss: observation.contactAccount.loss, strengthMse: observation.contactAccount.strengthMse, timingMse: observation.contactAccount.timingMse, extraMse: observation.contactAccount.extraMse},
    strike: {loss: strike.loss, strengthMse: strike.strengthMse, timingMse: strike.timingMse, extraMse: strike.extraMse, missing: strike.missingTargets.length},
    impact: {loss: impact.loss, strengthMse: impact.strengthMse, timingMse: impact.timingMse, extraMse: impact.extraMse, missing: impact.missingTargets.length,
      strongExtras: strongExtras(impact, impacts), beats: targets.length},
    impact3: {loss: impact3.loss, strengthMse: impact3.strengthMse, extraMse: impact3.extraMse, strongExtras: strongExtras(impact3, impacts3),
      splits: impacts3.filter(e => e.strength >= .2).length - impacts.filter(e => e.strength >= .2).length, beats: targets.length,
      // Per beat: requested, the matched impact's strength and onset offset (null when missing).
      perBeat: targets.map((t: any, j: number) => {const m = impact3.matches.find((x: any) => x.target === j);
        return [t.impact ?? null, m ? +impacts3[m.event].strength.toFixed(4) : null, m ? impacts3[m.event].onset - t.frame : null];})},
    motion: r.motion.full, guards, beats}));
}

const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN;};
const mean = (xs: number[]) => {const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;};
/** Song-level summary of one cell: the numbers a decision would be based on. */
function summarize(cell: any) {
  const b = cell.beats.filter((r: any) => r.requested != null), strong = b.filter((r: any) => r.requested >= .6), quiet = b.filter((r: any) => r.requested <= .15);
  const strengthErr = (rows: any[]) => Math.sqrt(mean(rows.map((r: any) => ((r.r1?.strength ?? 0) - r.requested) ** 2)));
  return {
    complete: cell.complete ? 1 : 0, fulfilled: cell.fulfilled ? 1 : 0,
    frozenScore: cell.frozen.valid ? cell.frozen.score : NaN,
    'strength rms (R1)': strengthErr(b), 'strong strength rms': strengthErr(strong), 'quiet strength rms': strengthErr(quiet),
    'peak lag ms (median)': median(b.map((r: any) => (r.r1?.peak ?? NaN) * 25)),
    'peaks >100 ms late': mean(b.map((r: any) => r.r1 ? (r.r1.peak * 25 > 100 ? 1 : 0) : NaN)),
    'contested strong beats': mean(strong.map((r: any) => r.impulse.competitor >= .5 * r.impulse.hit ? 1 : 0)),
    'strong extra hits / beat': mean(b.map((r: any) => r.extrasR1.filter((e: any) => e.strength >= .25).length)),
    'hidden contacted bend / beat': mean(b.map((r: any) => r.hiddenBend)),
    'contact-impact loss': cell.contact.loss,
    'strike loss': cell.strike?.loss ?? NaN,
    'strike strength rms': cell.strike ? Math.sqrt(cell.strike.strengthMse) : NaN,
    'strike extra (mse)': cell.strike?.extraMse ?? NaN,
    'strong extra strikes / beat': mean(b.map((r: any) => r.strike ? r.strike.extras.filter((e: any) => e.strength >= .25).length : NaN)),
    'impact loss (v2)': cell.impact?.loss ?? NaN,
    'impact strength rms (v2)': cell.impact ? Math.sqrt(cell.impact.strengthMse) : NaN,
    'impact extra (v2, mse)': cell.impact?.extraMse ?? NaN,
    'strong extra impacts / beat (v2)': cell.impact ? cell.impact.strongExtras / cell.impact.beats : NaN,
    'impact loss (v3)': cell.impact3?.loss ?? NaN,
    'strong extra impacts / beat (v3)': cell.impact3 ? cell.impact3.strongExtras / cell.impact3.beats : NaN,
    'double impacts / beat (v3 − v2)': cell.impact3 ? cell.impact3.splits / cell.impact3.beats : NaN,
    ...(() => {
      // Per-beat v3 strength by requested band (beats without a matched impact excluded).
      const rows = (cell.impact3?.perBeat ?? []).filter((r: any) => r[0] != null && r[1] != null);
      const band = (a: number, b: number) => rows.filter((r: any) => r[0] >= a && r[0] < b);
      const bias = (xs: any[]) => mean(xs.map((r: any) => r[1] - r[0])), rms = (xs: any[]) => Math.sqrt(mean(xs.map((r: any) => (r[1] - r[0]) ** 2)));
      return {'v3 strong bias (req>=0.6)': bias(band(.6, 2)), 'v3 strong rms (req>=0.6)': rms(band(.6, 2)),
        'v3 very strong bias (req>=0.8)': bias(band(.8, 2)), 'v3 quiet bias (req<0.15)': bias(band(0, .15))};
    })(),
    'strong arrivals inverted/backward': cell.guards?.strongInverted ?? NaN,
    'body drag s/min': cell.guards?.dragSecondsPerMinute ?? NaN,
    'off-beat kicks / ride': cell.guards?.offBeatKicks ?? NaN,
    'air rms': cell.frozen.axes?.air?.rmsError ?? NaN,
    'speed rms': cell.frozen.axes?.speed?.rmsError ?? NaN,
    'amplitude rms': cell.frozen.axes?.amplitude?.rmsError ?? NaN,
    'burst excess (100 ms)': cell.motion?.bursts?.[1]?.excessIntegral ?? NaN,
    'physics frames (M)': cell.physicalFrames / 1e6, 'compile s': cell.compileMs / 1000,
  };
}
function bootstrap(perSong: Map<string, number>, draws = 4000) {
  const values = [...perSong.values()].filter(Number.isFinite), rng = makeRng(7), out: number[] = [];
  if (!values.length) return [NaN, NaN, NaN];
  for (let d = 0; d < draws; d++) {let s = 0; for (let i = 0; i < values.length; i++) s += values[Math.floor(rng() * values.length)]; out.push(s / values.length);}
  out.sort((a, b) => a - b);
  return [mean(values), out[Math.floor(.025 * draws)], out[Math.floor(.975 * draws)]];
}

const command = process.argv[2];
if (command === 'worker') await worker(arg('case')!, arg('mode', 'strike3')!, arg('out')!, arg('budget', DEFAULT_BUDGET)!);
else if (command === 'run') {
  const budget = arg('budget', DEFAULT_BUDGET)!, name = arg('name')!, mode = arg('mode', 'strike3')!, jobs = Number(arg('jobs', '24')), dir = resolve('generated/eval', name);
  const panelName = arg('panel', 'dev')!, cases = PANELS[panelName];
  if (!cases) throw new Error(`--panel is one of ${Object.keys(PANELS).join(', ')}`);
  if (budget !== 'standard' && !(Number(budget) > 0)) throw new Error('--budget is standard or a frame count');
  mkdirSync(join(dir, 'cells'), {recursive: true});
  const identity = compilerIdentity('.');
  if (existsSync(join(dir, 'run.json'))) {
    const prior = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));
    if (prior.identity.candidateFingerprint !== identity.candidateFingerprint || prior.mode !== mode || prior.budget !== budget || (prior.panelName ?? 'dev') !== panelName) throw new Error('existing run has a different compiler, mode, budget or panel');
  } else writeFileSync(join(dir, 'run.json'), JSON.stringify({mode, identity, budget, panelName, panel: cases}, null, 1));
  const queue = cases.filter(c => !existsSync(join(dir, 'cells', c.id + '.json'))), began = performance.now();
  await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => {
    while (queue.length) {
      const c = queue.shift()!;
      const code = await new Promise<number | null>((done, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'worker', `--case=${c.id}`, `--mode=${mode}`, `--budget=${budget}`, `--out=${join(dir, 'cells', c.id + '.json')}`],
          {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']});
        child.once('error', reject); child.once('exit', done);
      });
      console.log(`${code === 0 ? 'done' : 'FAILED'}  ${c.id}`);
    }
  }));
  if (JSON.stringify(compilerIdentity('.')) !== JSON.stringify(identity)) throw new Error('compiler changed during the run');
  console.log(`${name}: ${readdirSync(join(dir, 'cells')).filter(f => f.endsWith('.json')).length}/${cases.length} cells in ${((performance.now() - began) / 1000).toFixed(0)} s`);
} else if (command === 'report') {
  const load = (name: string) => {
    const dir = resolve('generated/eval', name), cells = new Map<string, any>();
    for (const f of readdirSync(join(dir, 'cells')).filter(f => f.endsWith('.json'))) {const c = JSON.parse(readFileSync(join(dir, 'cells', f), 'utf8')); cells.set(c.case.id, c);}
    return {run: JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')), cells};
  };
  const a = load(arg('name')!), b = arg('against') ? load(arg('against')!) : null;
  const metrics = Object.keys(summarize([...a.cells.values()][0]));
  const perSong = (run: any, metric: string, filter: (c: any) => boolean, diff?: any) => {
    const m = new Map<string, number>();
    for (const song of SONGS) {
      const xs = [...run.cells.values()].filter(filter).filter((c: any) => c.case.song === song).map((c: any) => {
        const value = summarize(c)[metric as keyof ReturnType<typeof summarize>] as number;
        if (!diff) return value;
        const other = diff.cells.get(c.case.id); return other ? value - (summarize(other)[metric as keyof ReturnType<typeof summarize>] as number) : NaN;
      });
      m.set(song, mean(xs));
    }
    return m;
  };
  for (const [title, filter] of [['authored panel (4 songs × 4 seeds)', (c: any) => !c.case.perturbation], ['perturbed panel (4 songs × 2)', (c: any) => !!c.case.perturbation]] as const) {
    console.log(`\n${title}  —  ${arg('name')}${b ? `  vs  ${arg('against')} (difference, 95% song-bootstrap interval)` : ''}`);
    for (const metric of metrics) {
      const [m, lo, hi] = bootstrap(perSong(a, metric, filter, b ?? undefined));
      console.log(`  ${metric.padEnd(30)} ${m.toFixed(3).padStart(10)}   [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    }
  }
  console.log(`\ncompiler ${a.run.identity.head.slice(0, 10)}${a.run.identity.dirtySha256 ? '' : ''} mode ${a.run.mode}; songs are the resampling unit (n=4), so intervals are wide by design.`);
} else throw new Error('usage: eval.ts run|report');
