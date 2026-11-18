import {expect, it} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSpecReviewApi} from '../scripts/gallery/spec_review_api.ts';
import {specSha256} from '../scripts/gallery/spec_api.ts';

it('lists the production set by title, then the library, with verdicts that say when the spec changed since', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-review-'));
  const song = (name: string, source?: object, variants: string[] = []) => {
    mkdirSync(join(root, 'productions', name, 'variants'), {recursive: true});
    writeFileSync(join(root, 'productions', name, 'spec.ts'), 'export default {};\n');
    for (const v of variants) writeFileSync(join(root, 'productions', name, 'variants', v + '.ts'), 'export default {};\n');
    if (source) writeFileSync(join(root, 'productions', name, 'source.json'), JSON.stringify(source));
  };
  song('short_zeta', {title: 'Amor', artist: 'Flame', sourceStartSeconds: 10, sourceEndSeconds: 56}, ['calls']);
  song('short_alpha', {title: 'Amor', artist: 'Flame', sourceStartSeconds: 0, sourceEndSeconds: 52.4});
  song('short_beta', {title: 'Believer', artist: 'Imagine Dragons'});
  song('old_song', {title: 'Ignored in the library', artist: 'x'}, ['turn']);
  writeFileSync(join(root, 'productions/short_beta/notes.json'), JSON.stringify({notes: [{id: 'a'}, {id: 'b'}]}));
  const api = createSpecReviewApi(root);
  const server = createServer(async (req, res) => {
    if (!await api(req, res, new URL(req.url!, 'http://local'))) res.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/spec-review`;
  const list = async () => (await (await fetch(base)).json()).readings;
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(base, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: typeof body === 'string' ? body : JSON.stringify(body)});
  try {
    const readings = await list();
    expect(readings.map((r: any) => [r.path, r.set, r.reading, r.title, r.artist])).toEqual([
      ['productions/short_zeta/spec.ts', 'production', 'main', 'Amor (46 s)', 'Flame'],
      ['productions/short_zeta/variants/calls.ts', 'production', 'calls', 'Amor (46 s)', 'Flame'],
      ['productions/short_alpha/spec.ts', 'production', 'main', 'Amor (52 s)', 'Flame'],
      ['productions/short_beta/spec.ts', 'production', 'main', 'Believer', 'Imagine Dragons'],
      ['productions/old_song/spec.ts', 'library', 'main', 'old_song', null],
      ['productions/old_song/variants/turn.ts', 'library', 'turn', 'old_song', null],
    ]);
    expect(readings.map((r: any) => r.notes)).toEqual([0, 0, 0, 2, 0, 0]);
    expect(readings.every((r: any) => r.verdict === null && r.changed === false && r.video === null)).toBe(true);

    // a video beside a reading: current while the song's files are those it was made from
    const videos = join(root, 'generated/videos/dashboard'), sha = specSha256(join(root, 'productions/short_beta/spec.ts'));
    mkdirSync(videos, {recursive: true});
    writeFileSync(join(videos, 'short_beta--spec.mp4'), '');
    writeFileSync(join(videos, 'short_beta--spec.json'), JSON.stringify({specSha256: sha, madeAt: '2026-11-18T10:00:00.000Z'}));
    expect((await list()).find((r: any) => r.song === 'short_beta').video).toBe('current');

    expect((await fetch(base, {method: 'PUT'})).status).toBe(405);
    expect((await post({spec: 'productions/short_beta/spec.ts', verdict: 'love'}, {Origin: 'http://elsewhere.example'})).status).toBe(403);
    for (const bad of [{spec: 'productions/short_beta/../short_beta/spec.ts', verdict: 'love'}, {spec: 'productions/short_beta/spec.ts', verdict: 'great'},
      {spec: 'productions/short_beta/spec.ts'}, 'not json'])
      expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);

    const given = await (await post({spec: 'productions/short_beta/spec.ts', verdict: 'love'})).json();
    expect(given.reading).toMatchObject({path: 'productions/short_beta/spec.ts', verdict: 'love', changed: false});
    await post({spec: 'productions/short_zeta/variants/calls.ts', verdict: 'needs-work'});
    await post({spec: 'productions/short_zeta/variants/calls.ts', verdict: 'good'});
    const rows = readFileSync(join(root, 'labels/spec-verdicts.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(rows.map(r => [r.spec, r.verdict])).toEqual([['productions/short_beta/spec.ts', 'love'],
      ['productions/short_zeta/variants/calls.ts', 'needs-work'], ['productions/short_zeta/variants/calls.ts', 'good']]);
    expect(rows[0]).toMatchObject({specSha256: sha});
    expect(Number.isFinite(Date.parse(rows[0].at))).toBe(true);
    expect((await list()).find((r: any) => r.path === 'productions/short_zeta/variants/calls.ts')).toMatchObject({verdict: 'good', changed: false});

    // the song's spec changes after the verdict: the verdict (and its video) are of an earlier version
    writeFileSync(join(root, 'productions/short_beta/spec.ts'), 'export default {changed: true};\n');
    expect((await list()).find((r: any) => r.song === 'short_beta')).toMatchObject({verdict: 'love', changed: true, video: 'old'});
    // given again, it is current; cleared, there is none
    expect((await (await post({spec: 'productions/short_beta/spec.ts', verdict: 'love'})).json()).reading).toMatchObject({verdict: 'love', changed: false});
    expect((await (await post({spec: 'productions/short_beta/spec.ts', verdict: null})).json()).reading).toMatchObject({verdict: null, changed: false});
  } finally {
    server.close();
    rmSync(root, {recursive: true, force: true});
  }
});
