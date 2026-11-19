/** The ride's video beside a spec in the spec dashboard: one video per spec file, made on request, one job at a time.
 *   GET  /api/spec-video?spec=…  → {video: {url, from, madeAt, specSha256, current, theme, zoom, ride} | null,
 *                                   ride: how its ride stands against the spec (rideStanding) | null, job}
 *   POST /api/spec-video  ← {spec}  → 202 {job}; 409 while another video is being made
 * A job compiles the spec (npm run produce, seed 101) into generated/dashboard-rides/<song>--<variant> and renders it
 * (scripts/video.ts) to generated/videos/dashboard/<song>--<variant>.mp4, `spec` naming spec.ts. Beside the video, its JSON:
 * the renderer's sidecar plus the spec file's sha256 and when the video was made. The look and zoom lane are the song's in
 * its Astra video (generated/videos/astra/<song>-astra.json) when there is one; otherwise the renderer chooses them for the
 * ride, as `npm run videos` does. A video replaces the previous one only once it is complete. */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {spawn, type ChildProcess} from 'node:child_process';
import {closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {isVersion, listSpecs, specSha256 as sha256} from './spec_api.ts';
import {FPS} from '../v0/types.ts';
import {ZOOMS} from '../video/zooms.ts';

type Job = {spec: string; name: string; phase: 'compiling' | 'rendering' | 'done' | 'error'; startedAt: string; finishedAt?: string;
  look: string; line?: string; error?: string};

const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};
/** `<song>--<variant>` for a listed spec path, `spec` naming spec.ts. */
const nameOf = (path: string) => {const [, song, ...rest] = path.split('/'); return `${song}--${rest.length === 1 ? 'spec' : rest[1].slice(0, -3)}`;};

/** A listed spec's video in generated/videos/dashboard, or null; current while the spec's sha256 (`sha`, computed when
 * not given) is the one it was made from. */
export function savedVideo(root: string, spec: string, sha?: string) {
  const name = nameOf(spec), videos = join(root, 'generated/videos/dashboard'), file = join(videos, name + '.json');
  if (!existsSync(file) || !existsSync(join(videos, name + '.mp4'))) return null;
  const side = JSON.parse(readFileSync(file, 'utf8'));
  return {url: `/generated/videos/dashboard/${name}.mp4`, from: side.from ?? 0, madeAt: side.madeAt, specSha256: side.specSha256,
    current: isVersion(join(root, spec), side.specSha256), theme: side.partner ? `${side.theme} → ${side.partner}` : side.theme, zoom: side.zoom ?? null,
    ride: side.ride ? {...side.ride, missing: Array.isArray(side.ride.missing) ? side.ride.missing.length : side.ride.missing} : null};
}
/** How the ride of a listed spec's video stands against the spec, for the owner to look at (information, not a goal for
 * the author): null without a video; for a video of an earlier version of the spec only that (`current` false: its
 * landings are not this version's); otherwise, per landing of the spec in order, the strength asked (null when
 * untargeted), the strength delivered (null when missed) and the timing error (s, + late), with a summary. Read from the
 * ride the video was made from (generated/dashboard-rides/<name>/manifest.json, its cell named by the sidecar); `why`
 * says when that ride is no longer there (being made again). */
export function rideStanding(root: string, spec: string, sha?: string) {
  const video = savedVideo(root, spec, sha);
  if (!video) return null;
  if (!video.current) return {current: false, why: 'The video is of an earlier version of the spec: its landings are not this version\'s.'};
  const name = nameOf(spec), side = JSON.parse(readFileSync(join(root, 'generated/videos/dashboard', name + '.json'), 'utf8'));
  const file = join(root, 'generated/dashboard-rides', name, 'manifest.json');
  const cell = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).cells?.[0] : null;
  const evaluation = cell?.impactEvaluation;
  if (!evaluation?.account || (side.of?.cellSha256 && side.of.cellSha256 !== cell.sha256))
    return {current: true, why: 'The ride this video was made from is not on disk any more (it is being made again).'};
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const matched = new Map<number, {event: number; offset: number}>(evaluation.account.matches.map((m: {target: number; event: number; offset: number}) => [m.target, m]));
  const landings = evaluation.targets.map((target: {frame: number; impact?: number | null}, i: number) => {
    const m = matched.get(i), delivered = m ? evaluation.events[m.event]?.strength : undefined;
    return {t: r3(target.frame / FPS), asked: typeof target.impact === 'number' ? target.impact : null,
      delivered: typeof delivered === 'number' ? r3(delivered) : null, timing: m ? r3(m.offset / FPS) : null};
  });
  const compared = landings.filter((l: {asked: number | null; delivered: number | null}) => l.asked !== null && l.delivered !== null);
  return {current: true, seed: side.ride?.seed ?? cell.seed ?? null, landings,
    summary: {landings: landings.length, missed: landings.filter((l: {delivered: number | null}) => l.delivered === null).length,
      unasked: evaluation.account.unmatchedEvents?.length ?? 0,
      meanStrengthDifference: compared.length ? r3(compared.reduce((s: number, l: any) => s + Math.abs(l.delivered - l.asked), 0) / compared.length) : null,
      reachedEnd: !cell.failure, stoppedAt: cell.failure ? r3(cell.failure.frame / FPS) : null}};
}
const lastLines = (path: string, n: number) => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).slice(-n).join('\n') : '';
/** What a failed step said: the log's first error line (a thrown error, or the renderer's own report), else its last lines. */
const failure = (path: string) => (existsSync(path) && /^(\w*Error\b.*|Video failed:.*)$/m.exec(readFileSync(path, 'utf8'))?.[0]) || lastLines(path, 3);

export function createSpecVideoApi(root = process.cwd()) {
  const videos = join(root, 'generated/videos/dashboard'), rides = join(root, 'generated/dashboard-rides');
  let job: Job | null = null, child: ChildProcess | null = null;
  const resolveSpec = (raw: unknown) => typeof raw === 'string' ? listSpecs(root).find(s => s.path === raw)?.path : undefined;
  const status = () => job && {...job, line: job.phase === 'compiling' || job.phase === 'rendering' ? lastLines(join(rides, job.name + '.log'), 1) : undefined};

  /** One step of a job, a node script with its output appended to the job's log; rejects with what it said. */
  const step = (args: string[], log: string) => new Promise<void>((done, fail) => {
    const fd = openSync(log, 'a');
    child = spawn(process.execPath, args, {cwd: root, stdio: ['ignore', fd, fd]}); closeSync(fd);
    child.once('error', fail);
    child.once('exit', (code, signal) => {child = null;
      code === 0 ? done() : fail(new Error(`${failure(log) || `${args[0]} exited ${code ?? signal}`}\n(log: ${relative(root, log)})`));});
  });

  async function make(spec: string) {
    const name = nameOf(spec), [, song, ...rest] = spec.split('/'), variant = rest.length === 1 ? null : rest[1].slice(0, -3);
    const ride = join(rides, name), log = join(rides, name + '.log'), next = join(videos, name + '.next');
    const astra = join(root, 'generated/videos/astra', `${song}-astra.json`);
    job = {spec, name, phase: 'compiling', startedAt: new Date().toISOString(), look: 'chosen for the ride'};
    try {
      const specSha256 = sha256(join(root, spec)), chosen = existsSync(astra) ? JSON.parse(readFileSync(astra, 'utf8')) : null;
      // the lane of that video, while the song still has it (lanes are rewritten; then the renderer chooses one)
      const lane = chosen && (!chosen.zoom || ZOOMS[song]?.some(z => z.id === chosen.zoom));
      const look = chosen ? [`--look=${chosen.theme}`, ...(lane ? [`--zoom=${chosen.zoom || 'steady'}`] : [])] : [];
      if (chosen) job.look = lane ? `${chosen.theme}, zoom ${chosen.zoom || 'steady'} (the song's Astra video)` : `${chosen.theme} (the song's Astra video); its zoom lane is gone, one is chosen for the ride`;
      // the previous ride and any unfinished render are replaced; the previous video stays until the new one is complete
      for (const path of [ride, log, next + '.mp4', next + '.json']) rmSync(path, {recursive: true, force: true});
      mkdirSync(rides, {recursive: true}); mkdirSync(videos, {recursive: true});
      // seed 101, or the next one when its ride stops before the end: whether a ride completes can hang on the seed alone,
      // and a reading has to be watched (the seed used is in the video's record)
      let seed = 101;
      for (;; seed++) {
        rmSync(ride, {recursive: true, force: true});
        await step(['scripts/produce/automatic.ts', `--song=${song}`, ...(variant ? [`--variant=${variant}`] : []), `--seed=${seed}`, `--out=${ride}`], log);
        if (seed === 103 || !JSON.parse(readFileSync(join(ride, 'manifest.json'), 'utf8')).cells[0].failure) break;
      }
      job.phase = 'rendering';
      await step(['scripts/video.ts', `--study=${ride}`, ...look, '--review', `--out=${next}.mp4`], log);
      const side = JSON.parse(readFileSync(next + '.json', 'utf8'));
      // how the ride stands against the spec, for the owner to see (information, not a goal): its landings, those without an impact
      const cell = JSON.parse(readFileSync(join(ride, 'manifest.json'), 'utf8')).cells[0], account = cell.impactEvaluation?.account;
      const rideFacts = {seed, valid: !!cell.valid, landings: cell.impactEvaluation?.targets?.length ?? null, missing: Array.isArray(account?.missingTargets) ? account.missingTargets.length : account?.missingTargets ?? null};
      renameSync(next + '.mp4', join(videos, name + '.mp4'));
      writeFileSync(join(videos, name + '.json'), JSON.stringify({...side, spec, specSha256, ride: rideFacts, madeAt: new Date().toISOString()}, null, 2) + '\n');
      rmSync(next + '.json');
      job.phase = 'done';
    } catch (error) {
      job.phase = 'error'; job.error = (error as Error).message;
    }
    job.finishedAt = new Date().toISOString();
  }

  const handle = async function handle(req: IncomingMessage, res: ServerResponse, u: URL): Promise<boolean> {
    if (u.pathname !== '/api/spec-video') return false;
    if (req.method === 'GET') {
      const spec = resolveSpec(u.searchParams.get('spec'));
      if (!spec) {reply(res, {error: 'unknown spec'}, 400); return true;}
      const sha = sha256(join(root, spec));
      reply(res, {video: savedVideo(root, spec, sha), ride: rideStanding(root, spec, sha), job: status()}); return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 4096) {reply(res, {error: 'request too large'}, 413); return true;}}
    let body;
    try {body = JSON.parse(text);} catch {reply(res, {error: 'invalid JSON'}, 400); return true;}
    const spec = resolveSpec(body?.spec);
    if (!spec) {reply(res, {error: 'unknown spec'}, 400); return true;}
    if (job && (job.phase === 'compiling' || job.phase === 'rendering')) {reply(res, {error: `a video is already being made (${job.spec})`, job: status()}, 409); return true;}
    void make(spec);
    reply(res, {job: status()}, 202); return true;
  };
  return Object.assign(handle, {close: () => child?.kill('SIGTERM')});
}
