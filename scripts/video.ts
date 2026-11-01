/** One command from a fresh seed or saved ride to a plain/finished video. */
import {randomInt} from 'node:crypto';
import {openSync, closeSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {videoRequest} from './produce/video_request.ts';
import {readVerifiedJson, verifiedVideoCell} from './produce/video_input.ts';
import {ensureSpectrum, renderVideo} from './produce/render.ts';
import {sha} from '../benchmark/v3/model.ts';

async function main() {
if (process.argv.includes('--help')) {
  console.log(`Generate a video from a fresh seed or a saved ride.

  npm run video -- --song=petrunko_selection --seed=404
  npm run video -- --study=generated/my-ride --style=plain --format=horizontal
  npm run video -- --track=track.json --audio=song.mp3 --spec=spec.ts

Inputs: --song=ID [--seed=N --budget=N], --study=DIR [--id=CELL], or --track=FILE [--audio=FILE --spec=FILE].
Look:   --style=plain|finished --format=horizontal|vertical --zoom-mult=N
Output: --out=FILE.mp4 --workers=N
Defaults: finished vertical for productions; plain horizontal for raw tracks.
Progress and timings appear here; detailed logs and fresh compilation artifacts stay beside the output.`);
} else {
  const began = performance.now(), request = videoRequest(process.argv.slice(2));
  const name = request.song ?? (request.study ? basename(resolve(request.study)) : basename(request.track, '.json'));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = resolve(request.out ?? `generated/videos/${name}-${stamp}.mp4`);
  if (!output.endsWith('.mp4')) throw new Error('--out must end with .mp4');
  const work = output.slice(0, -4) + '.assets';
  if (existsSync(output) || existsSync(work)) throw new Error('Output already exists; choose a new --out.');
  mkdirSync(work, {recursive: true});
  process.env.LR_REMOTION_CONCURRENCY = String(request.workers);
  let study = request.study ? resolve(request.study) : undefined;
  const seed = request.seed ?? randomInt(0, 2 ** 31);
  console.log(`Video · ${request.style} · ${request.format} · ${request.workers} workers\nOutput: ${output}`);
  if (request.song) {
    study = join(work, 'production');
    console.log(`Compile · ${request.song} · seed ${seed}`);
    const started = performance.now();
    const log = join(work, 'compile.log');
    console.log(`Log: ${log}`);
    await new Promise<void>((done, fail) => {
      const fd = openSync(log, 'w');
      const pulse = setInterval(() => console.log(`Compile running · ${((performance.now() - started) / 1000).toFixed(0)}s`), 15_000);
      const cleanup = () => {clearInterval(pulse); closeSync(fd);};
      const child = spawn(process.execPath, ['scripts/produce/automatic.ts',`--song=${request.song}`,`--seed=${seed}`,`--out=${study}`,
        ...(request.budget ? [`--budget=${request.budget}`] : [])], {stdio: ['ignore', fd, fd]});
      child.once('error', error => {cleanup(); fail(error);});
      child.once('exit', code => {cleanup(); code === 0 ? done() : fail(new Error(`Compilation exited ${code}; see ${log}`));});
    });
    console.log(`Compile done · ${((performance.now() - started) / 1000).toFixed(1)}s`);
  }
  const render = {...request.render};
  let trackPath = request.track, audioPath = request.audio, specPath = request.spec, reportPath: string | undefined, impactPath: string | undefined, jolt = 0;
  if (study) {
    const manifest = readVerifiedJson(join(study, 'manifest.json'));
    const id = request.id ?? (manifest.cells.length === 1 ? manifest.cells[0].id : undefined);
    if (!id) throw new Error('This study has multiple rides; choose --id=CELL.');
    const input = verifiedVideoCell(study, manifest, id);
    ({trackPath, reportPath, impactPath} = input);
    audioPath = input.c.audioPath; specPath = input.c.source; jolt = manifest.plan.jolt;
    if (request.style === 'finished') {
      render.beatPunchPct = input.c.render.beatPunchPct;
      if (request.format === 'vertical' && !request.zoomOverride) render.zoomMult = input.c.render.zoomMult;
    }
  }
  const inputs = Object.fromEntries([trackPath,audioPath,specPath,reportPath,impactPath].filter((p): p is string => Boolean(p)).map(p => [resolve(p), sha(readFileSync(p))]));
  const spectrumBase = request.style === 'finished' ? await ensureSpectrum(resolve(audioPath), name, join(work, 'spectrum.log')) : undefined;
  const movie = await renderVideo({name: 'video', trackPath, audioPath, specPath, reportPath, impactPath, spectrumBase,
    render, jolt, workDir: work, style: request.style});
  console.log('Verify · decode output');
  execFileSync('ffmpeg', ['-v','error','-xerror','-i',movie,'-f','null','-'], {stdio: ['ignore','ignore','pipe']});
  for (const [path, hash] of Object.entries(inputs)) if (sha(readFileSync(path)) !== hash) throw new Error(`Input changed during rendering: ${path}`);
  const seconds = (performance.now() - began) / 1000;
  writeFileSync(join(work, 'video.json'), JSON.stringify({inputs, style: request.style, format: request.format, render,
    workers: request.workers, ...(request.song ? {seed} : {}), seconds, sha256: sha(readFileSync(movie))}, null, 2) + '\n');
  mkdirSync(dirname(output), {recursive: true}); renameSync(movie, output);
  console.log(`Done · ${seconds.toFixed(1)}s total\n${output}`);
}
}
await main().catch(error => {console.error(`Video failed: ${error.message ?? error}`); process.exitCode = 1;});
