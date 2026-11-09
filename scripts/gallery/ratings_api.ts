/** The owner's theme ratings (generated/concept-lab/rate/): one set of themes per address, its judgments appended to
 * generated/concept-lab/docs/owner-answers/ratings/<set>.jsonl. Local only: the repository is public and owner answers are never
 * committed (they are excluded in .git/info/exclude). Phone and desktop share one log, so either sees the other's answers.
 *   GET  /api/rate              → {sets: [{id, title, created, items}]}, newest first
 *   GET  /api/rate/<set>        → {events: [...]} in the order they were made
 *   POST /api/rate/<set>        ← {kind: 'grade', id, grade: 1–10 | null} | {kind: 'pick', a, b, winner: a | b | null}
 *                                 | {kind: 'note', id, text} | {kind: 'undo'} (takes back the latest pick) */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

type Manifest = {title: string; created: string; items: {id: string}[]};
const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};

/** The event as stored, or the reason it is refused. */
export function checkEvent(e: any, ids: ReadonlySet<string>): {event: Record<string, unknown>} | {error: string} {
  const known = (id: unknown): id is string => typeof id === 'string' && ids.has(id);
  if (e?.kind === 'grade') {
    if (!known(e.id)) return {error: 'unknown theme'};
    if (e.grade !== null && !(Number.isInteger(e.grade) && e.grade >= 1 && e.grade <= 10)) return {error: 'grade must be 1–10 or null'};
    return {event: {kind: 'grade', id: e.id, grade: e.grade}};
  }
  if (e?.kind === 'pick') {
    if (!known(e.a) || !known(e.b) || e.a === e.b) return {error: 'a pick needs two different themes'};
    if (e.winner !== null && e.winner !== e.a && e.winner !== e.b) return {error: 'the winner must be a, b or null'};
    return {event: {kind: 'pick', a: e.a, b: e.b, winner: e.winner}};
  }
  if (e?.kind === 'note') {
    if (!known(e.id) || typeof e.text !== 'string') return {error: 'a note needs a theme and a text'};
    return {event: {kind: 'note', id: e.id, text: e.text.slice(0, 2000)}};
  }
  if (e?.kind === 'undo') return {event: {kind: 'undo'}};
  return {error: 'unknown kind'};
}

export function createRatingsApi(root = process.cwd()) {
  const sets = join(root, 'generated/concept-lab/rate/sets'), store = join(root, 'generated/concept-lab/docs/owner-answers/ratings');
  const manifest = (set: string): Manifest | null => {
    const path = join(sets, set, 'manifest.json'); return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  };
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (url.pathname === '/api/rate') {
      const list = existsSync(sets) ? readdirSync(sets).map(id => ({id, m: manifest(id)})).filter(s => s.m) : [];
      reply(res, {sets: list.map(({id, m}) => ({id, title: m!.title, created: m!.created, items: m!.items.length}))
        .sort((a, b) => b.created.localeCompare(a.created))});
      return true;
    }
    const match = /^\/api\/rate\/([a-z0-9-]{1,80})$/.exec(url.pathname);
    if (!match) return false;
    const set = match[1], m = manifest(set), file = join(store, set + '.jsonl');
    if (!m) {reply(res, {error: 'unknown set'}, 404); return true;}
    if (req.method === 'GET') {
      reply(res, {events: existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []});
      return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 8192) {reply(res, {error: 'too large'}, 413); return true;}}
    let body: unknown;
    try {body = JSON.parse(text);} catch {reply(res, {error: 'not JSON'}, 400); return true;}
    const checked = checkEvent(body, new Set(m.items.map(i => i.id)));
    if ('error' in checked) {reply(res, checked, 400); return true;}
    mkdirSync(store, {recursive: true});
    appendFileSync(file, JSON.stringify({...checked.event, at: new Date().toISOString()}) + '\n');
    reply(res, {ok: true}); return true;
  };
}
