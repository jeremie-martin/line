/** Render the valid rides of a saved study as finished videos: node scripts/produce/render_repertoire.ts --study=DIR [--ids=a,b]
 * [--look=THEME]. No compilation, selection or geometry change happens here.
 *
 * Each ride gets its full video and its excerpt, both written directly by the video writer, a publication bundle
 * (videos/<song>/<song>-s<seed>/: video.mp4, work.json, upload.json) and a record <id>.video.json. A ride that already has a
 * record is done: its record must name this ride (its inputs) and its videos must be intact, whatever renderer made it; delete
 * the record to render it again.
 * A render is the output of its inputs (the ride, its account, the recording) and a look; the renderer's commit is recorded for
 * information, never checked. */
import assert from 'node:assert/strict';
import {copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {hostname} from 'node:os';
import {sha} from '../lib/case.ts';
import {writeGalleryJson} from '../gallery/artifacts.ts';
import {readVerifiedJson, verifiedVideoCell} from './video_input.ts';
import {buildScene} from '../video/scene.ts';
import {resolveLook} from '../video/look.js';
import {writeVideo} from '../video/write.ts';

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
assert.ok(arg('study'), '--study required');
const root = resolve(arg('study')!), manifest = readVerifiedJson(join(root, 'manifest.json'));
const lookName = arg('look') ?? 'paper', look = resolveLook(lookName);
const ids: string[] = arg('ids')?.split(',') ?? manifest.cells.filter((c: any) => c.valid).map((c: any) => c.id);
assert.ok(ids.every(id => manifest.cells.some((c: any) => c.id === id)), 'unknown --ids');
const hash = (p: string) => sha(readFileSync(p)), gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (!ids.length) console.log('no valid rides to render');
for (const id of ids) {
  const {cell, c, record, trackPath, reportPath, impactPath} = verifiedVideoCell(root, manifest, id);
  // what this render is of: change any of these and it is a video of another ride
  const inputs = {planSha256: manifest.planSha256, cellSha256: cell.sha256, trackSha256: hash(trackPath), reportSha256: hash(reportPath),
    audioSha256: c.audioSha256, ...(impactPath ? {impactSha256: hash(impactPath)} : {})};
  const recordPath = join(root, id + '.video.json');
  if (existsSync(recordPath)) {
    const saved = readVerifiedJson(recordPath), named = saved.inputs ?? saved.identity;
    for (const [key, value] of Object.entries(inputs)) assert.equal(named[key], value, `${id}.video.json is a video of another ride (${key}); move it away to render this one`);
    // a record is only as good as the videos it names: a deleted or changed file is not "already rendered"
    for (const {path, sha256} of [saved.full, saved.excerpt]) assert.ok(existsSync(join(root, path)) && hash(join(root, path)) === sha256,
      `${id}.video.json names ${path}, which is missing or changed; move the record away to render it again`);
    console.log(`already rendered ${id}${saved.look ? ` (${saved.lookName ?? 'custom look'})` : ' (an earlier renderer)'}`); continue;
  }
  // timed to the recording verifiedVideoCell has just checked against the ride's own digest
  const scene = buildScene(c.id, record, resolve(c.audioPath)), name = `${id}-s${cell.seed}`, work = join(root, 'render-work', id);
  // the excerpt as it will be written, inside the ride: checked before any video is made, and recorded as written
  const start = c.excerpt[0], end = Math.min(c.excerpt[1], scene.duration);
  assert.ok(end > start, `${id}: the excerpt ${c.excerpt.join('–')} s lies outside the ${scene.duration} s ride`);
  rmSync(work, {recursive: true, force: true}); mkdirSync(work, {recursive: true});
  const full = join(work, 'video.mp4'), excerpt = join(work, 'excerpt.mp4');
  console.log(`render ${id} · ${lookName} · ${scene.duration.toFixed(1)} s`);
  await writeVideo({scene, look, out: full});
  await writeVideo({scene, look, out: excerpt, from: start, to: end});
  // the publication bundle: staged, then moved into place whole
  const folder = join(root, 'videos', id, name), staging = join(root, 'videos', `.staging-${name}`);
  rmSync(staging, {recursive: true, force: true}); mkdirSync(staging, {recursive: true});
  renameSync(full, join(staging, 'video.mp4')); renameSync(excerpt, join(staging, 'excerpt.mp4'));
  copyFileSync(join(root, id, 'work.json'), join(staging, 'work.json'));
  writeFileSync(join(staging, 'upload.json'), JSON.stringify({project: 'musical-direction-review', song: id, video: 'video.mp4', created_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    // git_sha is the commit that compiled the ride, as it always was; the renderer's commit is recorded beside it
    values: {seed: cell.seed, rep: 0}, meta: {git_sha: manifest.plan.compiler.head, render_git_sha: gitSha, generator_host: hostname(), look: lookName,
      score: Number((impactPath ? cell.score.score : cell.metrics.score).toFixed(1)), revolutions: Number(cell.metrics.rotations.toFixed(2)),
      standTimePct: Number(cell.metrics.standTimePct.toFixed(2)), budget: cell.allowance ?? cell.budget}}, null, 2));
  rmSync(folder, {recursive: true, force: true}); mkdirSync(join(root, 'videos', id), {recursive: true}); renameSync(staging, folder);
  rmSync(work, {recursive: true, force: true});
  const media = (file: string) => ({path: relative(root, join(folder, file)), sha256: hash(join(folder, file))});
  writeGalleryJson(root, id + '.video.json', {schema: 'line.production-video.v2', id, inputs, lookName, look, renderedAt: gitSha,
    full: media('video.mp4'), excerpt: {...media('excerpt.mp4'), start, end}, visualApproval: null});
  console.log(`complete ${id}`);
}
