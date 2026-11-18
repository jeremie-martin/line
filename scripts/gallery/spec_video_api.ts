/** The ride's video beside a spec in the spec dashboard: one video per spec file, made on request, one job at a time.
 *   GET  /api/spec-video?spec=…  → {video: {url, from, madeAt, specSha256, current, theme, zoom} | null, job}
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
import {listSpecs, specSha256 as sha256} from './spec_api.ts';

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
    current: side.specSha256 === (sha ?? sha256(join(root, spec))), theme: side.partner ? `${side.theme} → ${side.partner}` : side.theme, zoom: side.zoom ?? null};
}
const lastLines = (path: string, n: number) => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).slice(-n).join('\n') : '';
/** What a failed step said: the log's first error line (a thrown error, or the renderer's own report), else its last lines. */
const failure = (path: string) => (existsSync(path) && /^(\w*Error\b.*|Video failed:.*)$/m.exec(readFileSync(path, 'utf8'))?.[0]) || lastLines(path, 3);

export function createSpecVideoApi(root = process.cwd()) {
  const videos = join(root, 'generated/videos/dashboard'), rides = join(root, 'generated/dashboard-rides');
  let job: Job | null = null, child: ChildProcess | null = null;
  const resolveSpec = (raw: unknown) => typeof raw === 'string' ? listSpecs(root).find(s => s.path === raw)?.path : undefined;
  const video = (spec: string) => savedVideo(root, spec);
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
      const look = chosen ? [`--look=${chosen.theme}`, `--zoom=${chosen.zoom || 'steady'}`] : [];
      if (chosen) job.look = `${chosen.theme}, zoom ${chosen.zoom || 'steady'} (the song's Astra video)`;
      // the previous ride and any unfinished render are replaced; the previous video stays until the new one is complete
      for (const path of [ride, log, next + '.mp4', next + '.json']) rmSync(path, {recursive: true, force: true});
      mkdirSync(rides, {recursive: true}); mkdirSync(videos, {recursive: true});
      await step(['scripts/produce/automatic.ts', `--song=${song}`, ...(variant ? [`--variant=${variant}`] : []), '--seed=101', `--out=${ride}`], log);
      job.phase = 'rendering';
      await step(['scripts/video.ts', `--study=${ride}`, ...look, `--out=${next}.mp4`], log);
      const side = JSON.parse(readFileSync(next + '.json', 'utf8'));
      renameSync(next + '.mp4', join(videos, name + '.mp4'));
      writeFileSync(join(videos, name + '.json'), JSON.stringify({...side, spec, specSha256, madeAt: new Date().toISOString()}, null, 2) + '\n');
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
      reply(res, {video: video(spec), job: status()}); return true;
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
