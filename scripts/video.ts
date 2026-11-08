/** One command from a fresh seed, a saved ride or a bare track to a finished video, drawn by the video renderer
 * (scripts/video/) exactly as the concept lab shows it. */
import {randomInt} from 'node:crypto';
import {openSync, closeSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {videoRequest} from './produce/video_request.ts';
import {readVerifiedJson, verifiedVideoCell} from './produce/video_input.ts';
import {buildScene} from './video/scene.ts';
import {writeVideo} from './video/write.ts';
import {THEMES} from './video/look.js';
import {sha} from './lib/case.ts';

async function main() {
if (process.argv.includes('--help')) {
  console.log(`Make a video from a fresh seed, a saved ride or a bare track.

  npm run video -- --song=petrunko_selection --seed=404 --look=hokusai
  npm run video -- --study=generated/my-ride --look=dune --from=20 --to=35
  npm run video -- --track=track.json --music=petrunko_selection

Input:  --song=ID [--seed=N --budget=N] (compiles first), --study=DIR [--id=CELL], or --track=FILE --music=SONG.
Look:   --look=${Object.keys(THEMES).join('|')}|plain (paper for productions, plain for tracks)
        --set=key:value,… changes single options of the look (scripts/video/look.js)
Extent: --from=S --to=S in song seconds (the whole ride by default); --width=N pixels (1080; the video is 9:16)
Output: --out=FILE.mp4 (generated/videos/ by default), with FILE.json beside it: what the video is of.`);
} else {
  const began = performance.now(), request = videoRequest(process.argv.slice(2));
  const name = request.song ?? (request.study ? basename(resolve(request.study)) : basename(request.track!, '.json'));
  const output = resolve(request.out ?? `generated/videos/${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
  if (!output.endsWith('.mp4')) throw new Error('--out must end with .mp4');
  const work = output.slice(0, -4) + '.assets';
  if (existsSync(output) || existsSync(work)) throw new Error('Output already exists; choose a new --out.');
  let study = request.study ? resolve(request.study) : undefined;
  const seed = request.seed ?? randomInt(0, 2 ** 31);
  console.log(`Video · ${request.lookName} · ${request.width} px wide\nOutput: ${output}`);
  if (request.song) {
    mkdirSync(work, {recursive: true});
    study = join(work, 'production');
    console.log(`Compile · ${request.song} · seed ${seed}`);
    const started = performance.now(), log = join(work, 'compile.log');
    console.log(`Log: ${log}`);
    await new Promise<void>((done, fail) => {
      const fd = openSync(log, 'w');
      const pulse = setInterval(() => console.log(`Compile running · ${((performance.now() - started) / 1000).toFixed(0)}s`), 15_000);
      const cleanup = () => {clearInterval(pulse); closeSync(fd);};
      const child = spawn(process.execPath, ['scripts/produce/automatic.ts', `--song=${request.song}`, `--seed=${seed}`, `--out=${study}`,
        ...(request.budget ? [`--budget=${request.budget}`] : [])], {stdio: ['ignore', fd, fd]});
      child.once('error', error => {cleanup(); fail(error);});
      child.once('exit', code => {cleanup(); code === 0 ? done() : fail(new Error(`Compilation exited ${code}; see ${log}`));});
    });
    console.log(`Compile done · ${((performance.now() - started) / 1000).toFixed(1)}s`);
  }
  let scene, of;
  if (study) {
    const manifest = readVerifiedJson(join(study, 'manifest.json'));
    const id = request.id ?? (manifest.cells.length === 1 ? manifest.cells[0].id : undefined);
    if (!id) throw new Error('This study has multiple rides; choose --id=CELL.');
    const {c, cell, record} = verifiedVideoCell(study, manifest, id);
    scene = buildScene(c.id, record); of = {study, id, cellSha256: cell.sha256, ...(request.song ? {seed} : {})};
  } else {
    const text = readFileSync(request.track!, 'utf8');
    scene = buildScene(request.music!, {track: JSON.parse(text)}); of = {track: resolve(request.track!), trackSha256: sha(text), music: request.music};
  }
  const from = request.from ?? 0, to = Math.min(request.to ?? scene.duration, scene.duration);
  await writeVideo({scene, look: request.look, out: output, from, to, width: request.width});
  writeFileSync(output.slice(0, -4) + '.json', JSON.stringify({of, look: request.look, lookName: request.lookName, from, to, width: request.width,
    renderedAt: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), sha256: sha(readFileSync(output)),
    seconds: (performance.now() - began) / 1000}, null, 2) + '\n');
  console.log(`Done · ${((performance.now() - began) / 1000).toFixed(1)}s total\n${output}`);
}
}
await main().catch(error => {console.error(`Video failed: ${error.message ?? error}`); process.exitCode = 1;});
