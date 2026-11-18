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
    // his words on the reading keep the verdict, and a later verdict keeps the words
    expect((await (await post({spec: 'productions/short_beta/spec.ts', note: 'softer at the start'})).json()).reading).toMatchObject({verdict: 'love', note: 'softer at the start'});
    expect((await (await post({spec: 'productions/short_beta/spec.ts', verdict: 'love'})).json()).reading).toMatchObject({verdict: 'love', note: 'softer at the start'});
    expect(given.reading).toMatchObject({path: 'productions/short_beta/spec.ts', verdict: 'love', changed: false});
    await post({spec: 'productions/short_zeta/variants/calls.ts', verdict: 'needs-work'});
    await post({spec: 'productions/short_zeta/variants/calls.ts', verdict: 'good'});
    const rows = readFileSync(join(root, 'labels/spec-verdicts.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(rows.map(r => [r.spec, r.verdict])).toEqual([['productions/short_beta/spec.ts', 'love'], ['productions/short_beta/spec.ts', 'love'], ['productions/short_beta/spec.ts', 'love'],
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

it('keeps his words on a reading with the version they were written on, and serves the notes on what changed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-review-'));
  mkdirSync(join(root, 'productions/short_song/variants'), {recursive: true});
  mkdirSync(join(root, 'labels'), {recursive: true});
  writeFileSync(join(root, 'productions/short_song/spec.ts'), 'export default {};\n');
  writeFileSync(join(root, 'productions/short_song/variants/upper.ts'), 'export default {};\n');
  const main = 'productions/short_song/spec.ts', upper = 'productions/short_song/variants/upper.ts';
  const first = specSha256(join(root, main));
  // rows written before words had a version of their own: their version is the verdict's
  writeFileSync(join(root, 'labels/spec-verdicts.jsonl'), [
    {spec: main, verdict: null, specSha256: first, note: 'faster', at: '2026-11-18T10:00:00.000Z'},
    {spec: main, verdict: 'good', specSha256: first, note: 'faster', at: '2026-11-18T10:01:00.000Z'},
    {spec: upper, verdict: 'needs-work', specSha256: first, note: 'more fun', at: '2026-11-18T10:02:00.000Z'},
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  const api = createSpecReviewApi(root);
  const server = createServer(async (req, res) => {
    if (!await api(req, res, new URL(req.url!, 'http://local'))) res.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/spec-review`;
  const reading = async (path: string) => (await (await fetch(base)).json()).readings.find((r: any) => r.path === path);
  const post = async (body: unknown) => (await (await fetch(base, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json()).reading;
  const rows = () => readFileSync(join(root, 'labels/spec-verdicts.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  // the author records a revision of the main reading (tools/music/revision.ts): what answers his words
  const revised: object[] = [];
  const revise = async (at?: string) => {
    await new Promise(r => setTimeout(r, 5));
    revised.push({spec: main, sha256: 'x' + revised.length, at: at ?? new Date().toISOString(), by: 'test', summary: 'done'});
    writeFileSync(join(root, 'productions/short_song/revisions.json'), JSON.stringify({revisions: revised}));
    await new Promise(r => setTimeout(r, 5));
  };
  try {
    // each reading its own words, on the version as it stands
    expect(await reading(main)).toMatchObject({note: 'faster', earlierNotes: [], revisions: []});
    // the files change without a recorded revision: his words stay open
    writeFileSync(join(root, 'productions/short_song/spec.ts'), 'export default {changed: true};\n');
    expect(await reading(main)).toMatchObject({note: 'faster', earlierNotes: []});
    expect(await reading(upper)).toMatchObject({note: 'more fun', earlierNotes: []});

    // the revision is recorded: the words are earlier ones, quoted apart; the field starts empty; the other reading keeps its own
    await revise('2026-11-18T12:00:00.000Z');
    const second = specSha256(join(root, main));
    expect(await reading(main)).toMatchObject({note: '', earlierNotes: [{note: 'faster', at: '2026-11-18T10:00:00.000Z'}]});
    expect(await reading(upper)).toMatchObject({note: 'more fun', earlierNotes: []});
    // a verdict on the new version carries the words with their own version: still earlier
    await post({spec: main, verdict: 'love'});
    expect(rows().at(-1)).toMatchObject({verdict: 'love', specSha256: second, note: 'faster', noteSha256: first});
    expect(await reading(main)).toMatchObject({note: '', earlierNotes: [{note: 'faster'}]});
    // new words are written on this version; the verdict stays, and a later verdict keeps them
    expect(await post({spec: main, note: 'now slower'})).toMatchObject({verdict: 'love', note: 'now slower', earlierNotes: [{note: 'faster'}]});
    expect(rows().at(-1)).toMatchObject({note: 'now slower', noteSha256: second, specSha256: second});
    expect(await post({spec: main, verdict: 'good'})).toMatchObject({verdict: 'good', note: 'now slower'});
    expect(rows().at(-1)).toMatchObject({note: 'now slower', noteSha256: second});
    // a third version: both earlier words, newest first; the same words twice are quoted once
    await revise();
    expect((await reading(main)).earlierNotes.map((w: any) => w.note)).toEqual(['now slower', 'faster']);
    await post({spec: main, note: 'faster'});
    expect(await reading(main)).toMatchObject({note: 'faster'});
    expect((await reading(main)).earlierNotes.map((w: any) => w.note)).toEqual(['now slower']);
    // the other reading had no revision: its words are still open
    expect(await reading(upper)).toMatchObject({note: 'more fun', earlierNotes: []});

    // the author's notes on what changed: the reading's own, each current while its version stands
    const now = specSha256(join(root, main));
    writeFileSync(join(root, 'productions/short_song/revisions.json'), JSON.stringify({revisions: [
      {spec: main, sha256: first, at: '2026-11-18T09:00:00.000Z', by: 'Codex', summary: 'first'},
      {spec: upper, sha256: now, at: '2026-11-18T11:00:00.000Z', by: 'Claude', summary: 'upper'},
      {spec: main, sha256: now, at: '2026-11-18T12:00:00.000Z', by: 'Claude', summary: 'second', points: [{from: 1, to: null, text: 'here'}]},
    ]}));
    expect((await reading(main)).revisions.map((r: any) => [r.summary, r.current])).toEqual([['first', false], ['second', true]]);
    expect((await reading(main)).revisions.at(-1).stale).toBe(false);
    expect((await reading(upper)).revisions.map((r: any) => [r.summary, r.current])).toEqual([['upper', true]]);
    // they are not part of what a version is
    expect(specSha256(join(root, main))).toBe(now);
  } finally {
    server.close();
    rmSync(root, {recursive: true, force: true});
  }
});
