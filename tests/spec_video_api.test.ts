import {expect, it} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createSpecVideoApi} from '../scripts/gallery/spec_video_api.ts';

it('accepts only listed production specs, same-origin POSTs and one job at a time, and says whether a video is current', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-video-'));
  mkdirSync(join(root, 'productions/song/variants'), {recursive: true});
  writeFileSync(join(root, 'productions/song/spec.ts'), 'export default {};\n');
  writeFileSync(join(root, 'productions/song/variants/turn.ts'), 'export default {};\n');
  writeFileSync(join(root, 'productions/song/notes.ts'), '');
  const api = createSpecVideoApi(root);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://local');
    if (!await api(req, res, url)) res.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/spec-video`;
  const get = (spec: string) => fetch(`${base}?spec=${encodeURIComponent(spec)}`);
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(base, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: typeof body === 'string' ? body : JSON.stringify(body)});
  try {
    for (const spec of ['productions/song/../../etc/passwd', '/etc/passwd', 'productions/song/notes.ts', 'productions/other/spec.ts', 'scripts/v0/x.ts', ''])
      expect((await get(spec)).status, spec).toBe(400);
    expect(await (await get('productions/song/variants/turn.ts')).json()).toEqual({video: null, job: null});
    expect((await fetch(base, {method: 'PUT'})).status).toBe(405);
    expect((await post({spec: 'productions/song/spec.ts'}, {Origin: 'http://elsewhere.example'})).status).toBe(403);
    expect((await post({spec: 'productions/song/../song/spec.ts'})).status).toBe(400);
    expect((await post({spec: 42})).status).toBe(400);
    expect((await post('not json')).status).toBe(400);

    // a video beside the spec: current while the spec file is unchanged
    const videos = join(root, 'generated/videos/dashboard');
    mkdirSync(videos, {recursive: true});
    // what a spec is made from: every .ts of the song's folder, name then content, in order
    const sha = createHash('sha256').update('notes.ts').update('').update('spec.ts').update('export default {};\n').update('variants/turn.ts').update('export default {};\n').digest('hex');
    writeFileSync(join(videos, 'song--turn.mp4'), '');
    writeFileSync(join(videos, 'song--turn.json'), JSON.stringify({theme: 'hokusai', partner: null, zoom: null, from: 0, specSha256: sha, madeAt: '2026-11-18T10:00:00.000Z'}));
    expect((await (await get('productions/song/variants/turn.ts')).json()).video).toMatchObject({url: '/generated/videos/dashboard/song--turn.mp4', current: true});
    writeFileSync(join(root, 'productions/song/variants/turn.ts'), 'export default {changed: true};\n');
    expect((await (await get('productions/song/variants/turn.ts')).json()).video.current).toBe(false);
    expect((await (await get('productions/song/spec.ts')).json()).video).toBe(null);

    // a job: accepted, then a second refused while it runs; here the compile script is missing, so it fails and says why
    const started = await post({spec: 'productions/song/spec.ts'});
    expect(started.status).toBe(202);
    expect((await started.json()).job).toMatchObject({spec: 'productions/song/spec.ts', name: 'song--spec', phase: 'compiling'});
    expect((await post({spec: 'productions/song/variants/turn.ts'})).status).toBe(409);
    let job;
    for (let i = 0; i < 100 && job?.phase !== 'error'; i++) {
      await new Promise(done => setTimeout(done, 50));
      job = (await (await get('productions/song/spec.ts')).json()).job;
    }
    expect(job.phase).toBe('error');
    expect(job.error).toMatch(/^Error: Cannot find module .*automatic\.ts.*\n\(log: generated\/dashboard-rides\/song--spec\.log\)$/s);
  } finally {
    server.close(); api.close();
    rmSync(root, {recursive: true, force: true});
  }
});
