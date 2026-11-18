import {expect, it} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSpecApi} from '../scripts/gallery/spec_api.ts';
import {DROP_TIMES} from '../scripts/video/drops.ts';

it('keeps a note with the version of the reading it was written on, and never writes over an earlier one', async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-notes-')), dir = join(root, 'productions/short_beta');
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'spec.ts'), 'export default {};\n');
  writeFileSync(join(dir, 'notes.json'), JSON.stringify({notes: [{id: 'contact:3', t: 1, scope: 'contact', index: 3, t0: null, t1: null, axis: null,
    title: 'contact', text: 'legacy', tags: [], createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'}]}));
  const api = createSpecApi(root);
  const server = createServer(async (req, res) => {
    if (!await api(req, res, new URL(req.url!, 'http://local'))) res.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/spec-notes`, spec = 'productions/short_beta/spec.ts';
  const list = async () => (await (await fetch(`${base}?spec=${spec}`)).json()).notes as any[];
  const post = async (body: object) => (await fetch(base, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({spec, ...body})})).json();
  try {
    expect((await list()).map(n => [n.id, n.current])).toEqual([['contact:3', false]]);  // a note from before: earlier
    // a new note on the same landing number does not replace the earlier one
    expect((await post({note: {id: 'contact:3', t: 1.2, scope: 'contact', index: 3, text: 'stronger'}})).note).toMatchObject({text: 'stronger', current: true});
    await post({note: {id: 'moment:2000', t: 2, scope: 'moment', tags: ['mark']}});
    let notes = await list();
    expect(notes.map(n => [n.text, n.current]).sort()).toEqual([['', true], ['legacy', false], ['stronger', true]]);
    expect(new Set(notes.map(n => n.id)).size).toBe(3);
    // the reading is revised: his notes become notes on an earlier version, and are kept
    writeFileSync(join(dir, 'spec.ts'), 'export default {revised: true};\n');
    expect((await list()).every(n => !n.current)).toBe(true);
    await post({note: {id: 'moment:5000', t: 5, scope: 'moment', text: 'new'}});
    // clearing removes the notes on this version only
    expect((await post({clear: true})).count).toBe(3);
    notes = JSON.parse(readFileSync(join(dir, 'notes.json'), 'utf8')).notes;
    expect(notes.map((n: any) => n.text).sort()).toEqual(['', 'legacy', 'stronger']);
  } finally {
    server.close(); rmSync(root, {recursive: true, force: true});
  }
});

it("shows the song's drop (scripts/video/drops.ts) in the spec view, and none for a song without one", async () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-view-'));
  const [withDrop, times] = Object.entries(DROP_TIMES)[0];  // whichever song has one
  for (const song of [withDrop, 'short_no_drop_here']) {
    mkdirSync(join(root, 'productions', song), {recursive: true});
    writeFileSync(join(root, 'productions', song, 'spec.ts'), 'export default {duration: 40, contacts: [{t: 1, impact: 0.5}], axes: {}};\n');
  }
  const api = createSpecApi(root);
  const view = (song: string) => api.computeView({path: `productions/${song}/spec.ts`, name: song, label: song, group: 'production'}, 80) as Promise<any>;
  try {
    expect((await view(withDrop)).drop).toEqual(times);
    expect((await view('short_no_drop_here')).drop).toBeNull();
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
