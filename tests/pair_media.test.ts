import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {createLabelsApi} from '../scripts/gallery/labels_api.ts';
import {createPairMedia} from '../scripts/gallery/pair_media.ts';
const run = promisify(execFile);
let root: string, media: ReturnType<typeof createPairMedia>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'line-pair-media-')); media = createPairMedia(root);
  for (const [side, color, frequency] of [['left', 'red', 440], ['right', 'blue', 880]]) {
    await run('ffmpeg', ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', `color=${color}:s=160x90:r=30:d=0.4`,
      '-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=48000:duration=0.4`,
      '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(root, `${side}.mp4`)]);
  }
});
afterAll(async () => {media?.close(); if (root) await rm(root, {recursive: true, force: true});});
describe('shared-picture pair previews', () => {
  it('caches concurrent requests, preserves source bytes and remuxes each original soundtrack', async () => {
    const before = await readFile(join(root, 'left.mp4'));
    const [a, b] = await Promise.all([media.prepare('/left.mp4', '/right.mp4', 'wide', .4), media.prepare('/left.mp4', '/right.mp4', 'wide', .4)]);
    expect(a).toEqual(b); expect(a).toMatchObject({width: 324, height: 90, frames: 12, fps: 30, duration: .4});
    expect(await media.prepare('/left.mp4', '/right.mp4', 'wide', .4)).toEqual(a);
    expect(await readFile(join(root, 'left.mp4'))).toEqual(before);
    const packets = async (file: string, stream: string) => JSON.parse((await run('ffprobe', ['-v', 'error',
      '-select_streams', stream, '-show_packets', '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash,pts_time',
      '-of', 'json', file])).stdout).packets;
    for (const side of ['left', 'right'] as const) {
      expect(await packets(join(root, a.sources[side]), 'a')).toEqual(await packets(join(root, side + '.mp4'), 'a'));
    }
    expect(await packets(join(root, a.sources.left), 'v')).toEqual(await packets(join(root, a.sources.right), 'v'));
  });
  it('keeps A before B in both layouts and keeps their duration and frame count', async () => {
    for (const layout of ['wide', 'stacked'] as const) {
      const a = await media.prepare('/left.mp4', '/right.mp4', layout, .4);
      expect(a).toMatchObject(layout === 'wide' ? {width: 324, height: 90} : {width: 160, height: 184});
      const {stdout} = await run('ffmpeg', ['-v', 'error', '-i', join(root, a.sources.left), '-frames:v', '1',
        '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], {encoding: 'buffer', maxBuffer: 1024 * 1024});
      const pixel = (x: number, y: number) => [...stdout.subarray((y * a.width + x) * 3, (y * a.width + x) * 3 + 3)];
      expect(pixel(40, 40)[0]).toBeGreaterThan(240);
      expect(pixel(layout === 'wide' ? 204 : 40, layout === 'wide' ? 40 : 134)[2]).toBeGreaterThan(240);
    }
  });
  it('serves only manifest pairs and valid layouts without writing judgments', async () => {
    const dir = join(root, 'generated/label-studies/test'); await mkdir(dir, {recursive: true});
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({length: .4, clips: [{id: 'pair1', left: {src: '/left.mp4'}, right: {src: '/right.mp4'}}]}));
    const api = createLabelsApi(root), server = createServer(async (req, res) => {
      if (!await api(req, res, new URL(req.url!, 'http://local'))) res.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as {port: number}).port}/api/labels/test`;
    try {
      expect(await (await fetch(base + '/pair/pair1?layout=wide')).json()).toMatchObject({frames: 12, layout: 'wide'});
      expect((await fetch(base + '/pair/missing')).status).toBe(400);
      expect((await fetch(base + '/pair/pair1?layout=bad')).status).toBe(400);
      expect((await fetch(base + '/pair/pair1', {method: 'POST'})).status).toBe(405);
      expect(await (await fetch(base)).json()).toEqual({labeled: []});
    } finally {api.close(); await new Promise<void>(resolve => server.close(() => resolve()));}
  });
  it('rejects mismatched declared duration and external sources', async () => {
    await expect(media.prepare('/left.mp4', '/right.mp4', 'wide', .5)).rejects.toThrow('matching');
    await expect(media.prepare('https://example.org/a.mp4', '/right.mp4', 'wide', .4)).rejects.toThrow('local');
  });
});
