/** Where the owner stands on each spec of the spec dashboard (spec-dashboard/): his verdict on each reading, its video
 * and his notes, for the dashboard's menu.
 *   GET  /api/spec-review  → {verdictsPath, readings: [Reading]}, production set first (by title), then the library
 *   POST /api/spec-review  ← {spec, verdict: 'love' | 'good' | 'needs-work' | null} or {spec, note: text}  → {reading}
 * A reading is one listed spec file: a song's spec.ts (reading "main") or one of its variants. The production set is the
 * songs `productions/short_*`, labelled by the title and artist of their source.json; the others are the library.
 * Verdicts are appended to labels/spec-verdicts.jsonl (tracked: the owner's judgments), one row per click:
 * {spec, verdict, specSha256, note, at}, verdict null clearing it; the latest row of a spec counts. `note` is his free words
 * on the reading as a whole; a row that sets one of the two keeps the other. specSha256 is the spec's hash
 * when he gave it (the one its video is checked against, spec_api.ts specSha256): when the song's files change after it,
 * the verdict is `changed`. */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {listSpecs, specSha256} from './spec_api.ts';
import {savedVideo} from './spec_video_api.ts';

export const VERDICTS = ['love', 'good', 'needs-work'] as const;
type Verdict = typeof VERDICTS[number];
type Row = {spec: string; verdict: Verdict | null; specSha256: string; note?: string; at: string};

const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};
const readJson = (path: string) => {try {return JSON.parse(readFileSync(path, 'utf8'));} catch {return null;}};

export function createSpecReviewApi(root = process.cwd()) {
  const verdictsPath = 'labels/spec-verdicts.jsonl', file = join(root, verdictsPath);
  const latest = () => {
    const rows = new Map<string, Row>();
    if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) if (line.trim()) {
      const row = JSON.parse(line) as Row; rows.set(row.spec, row);
    }
    return rows;
  };

  function readings() {
    const verdicts = latest();
    const songs = new Map<string, {sha: string; title: string | null; artist: string | null; seconds: number | null; notes: number}>();
    const song = (name: string) => {
      let s = songs.get(name);
      if (!s) {
        const dir = join(root, 'productions', name), source = name.startsWith('short_') ? readJson(join(dir, 'source.json')) : null;
        const notes = readJson(join(dir, 'notes.json'))?.notes;
        const seconds = source?.sourceEndSeconds - source?.sourceStartSeconds;
        s = {sha: specSha256(join(dir, 'spec.ts')), title: source?.title ?? null, artist: source?.artist ?? null,
          seconds: Number.isFinite(seconds) ? seconds : null, notes: Array.isArray(notes) ? notes.length : 0};
        songs.set(name, s);
      }
      return s;
    };
    const list = listSpecs(root).map(entry => {
      const name = entry.path.split('/')[1], s = song(name), variant = entry.path.split('/')[2] === 'variants';
      const set = name.startsWith('short_') ? 'production' : 'library', row = verdicts.get(entry.path)?.verdict ? verdicts.get(entry.path)! : null;
      const note = verdicts.get(entry.path)?.note ?? '';
      const video = savedVideo(root, entry.path, s.sha);
      return {path: entry.path, song: name, set, reading: variant ? entry.path.split('/')[3].slice(0, -3) : 'main',
        title: set === 'production' && s.title ? s.title : name, artist: set === 'production' ? s.artist : null, notes: s.notes,
        video: video ? (video.current ? 'current' : 'old') : null, note,
        verdict: row?.verdict ?? null, verdictAt: row?.at ?? null, changed: !!row && row.specSha256 !== s.sha};
    });
    // two cuts of one piece (same title and artist) are told apart by their length
    const named = new Map<string, Set<string>>();
    for (const r of list) if (r.set === 'production') named.set(r.title + r.artist, (named.get(r.title + r.artist) ?? new Set()).add(r.song));
    for (const r of list) if (r.set === 'production' && named.get(r.title + r.artist)!.size > 1 && song(r.song).seconds)
      r.title += ` (${Math.round(song(r.song).seconds!)} s)`;
    const order = (r: typeof list[number]) => r.set === 'production' ? 0 : 1;
    // stable: a song's main reading, then its variants, as listed
    return list.map((r, i) => ({r, i})).sort((a, b) => order(a.r) - order(b.r)
      || (a.r.set === 'production' ? a.r.title.localeCompare(b.r.title) || a.r.song.localeCompare(b.r.song) : 0) || a.i - b.i).map(x => x.r);
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, u: URL): Promise<boolean> {
    if (u.pathname !== '/api/spec-review') return false;
    if (req.method === 'GET') {reply(res, {verdictsPath, readings: readings()}); return true;}
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 16384) {reply(res, {error: 'request too large'}, 413); return true;}}
    let body;
    try {body = JSON.parse(text);} catch {reply(res, {error: 'invalid JSON'}, 400); return true;}
    const entry = listSpecs(root).find(s => s.path === body?.spec);
    if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
    const before = latest().get(entry.path), at = new Date().toISOString();
    let row: Row;
    if (typeof body.note === 'string' && !('verdict' in body))  // his words on the reading; the verdict and the version it was given on stay
      row = {spec: entry.path, verdict: before?.verdict ?? null, specSha256: before?.specSha256 ?? specSha256(join(root, entry.path)), note: body.note.slice(0, 8000), at};
    else {
      if (body.verdict !== null && !VERDICTS.includes(body.verdict)) {reply(res, {error: `verdict must be one of ${VERDICTS.join(', ')} or null`}, 400); return true;}
      row = {spec: entry.path, verdict: body.verdict, specSha256: specSha256(join(root, entry.path)), note: before?.note || undefined, at};
    }
    mkdirSync(dirname(file), {recursive: true});
    appendFileSync(file, JSON.stringify(row) + '\n');
    reply(res, {reading: readings().find(r => r.path === entry.path)}); return true;
  };
}
