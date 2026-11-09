/** The owner's theme judgments (generated/concept-lab/rate/). A set is frozen (rate/sets/<set>/set.json, written once by
 * rate/freeze.mjs); its events are appended to generated/concept-lab/docs/owner-answers/ratings/<set>.jsonl, local only: the
 * repository is public and owner answers are never committed (.git/info/exclude). One log for every device, append-only, so a
 * phone and a desktop never conflict; a retried batch never duplicates (events carry their own id). Each event keeps when it
 * was made (at, the device's clock) and saved (savedAt), the device (phone or desktop, screen, home screen) and the client
 * (address, browser).
 *   GET  /api/rate                     → {sets: [{set, title, created, themes}]}, newest first
 *   GET  /api/rate/<set>/events?after=n → {events (each with its seq), seq, setHash}
 *   POST /api/rate/<set>/events        ← {setHash, events: [...]} → {ok, added}; 409 if the set changed since the page loaded */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {createHash} from 'node:crypto';
import {appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

type FrozenSet = {set: string; title: string; created: string; themes: {id: string}[]};
const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};
const OUTCOMES = ['left', 'right', 'equal', 'pass'], VERDICTS = ['love', 'keep', 'unsure', 'cut'], WHY = ['coverage', 'info', 'sibling', 'random', 'again', 'repeat'];

/** The event as stored (only the fields of its kind), or the reason it is refused. */
export function checkEvent(e: any, themes: ReadonlySet<string>): {event: Record<string, unknown>} | {error: string} {
  if (typeof e?.id !== 'string' || !/^[0-9A-Za-z_-]{8,40}$/.test(e.id)) return {error: 'an event needs an id'};
  const known = (id: unknown): id is string => typeof id === 'string' && themes.has(id);
  const device = e.device && typeof e.device === 'object'
    ? {kind: e.device.kind === 'phone' ? 'phone' : 'desktop', w: Number(e.device.w) || null, h: Number(e.device.h) || null, standalone: e.device.standalone === true} : null;
  const base = {v: 1, id: e.id, at: typeof e.at === 'string' ? e.at.slice(0, 40) : null, device};
  switch (e.kind) {
    case 'verdict':
      if (!known(e.theme) || !VERDICTS.includes(e.value)) return {error: 'a verdict needs a theme of the set and love, keep, unsure or cut'};
      return {event: {...base, kind: 'verdict', theme: e.theme, value: e.value}};
    case 'duel':
      if (!known(e.left) || !known(e.right) || e.left === e.right || !OUTCOMES.includes(e.outcome)) return {error: 'a duel needs two themes of the set and an outcome'};
      return {event: {...base, kind: 'duel', left: e.left, right: e.right, outcome: e.outcome,
        ms: Number.isFinite(e.ms) ? Math.round(e.ms) : null, why: WHY.includes(e.why) ? e.why : null}};
    case 'note':
      if (!Array.isArray(e.themes) || !e.themes.length || e.themes.length > 2 || !e.themes.every(known) || typeof e.text !== 'string' || !e.text.trim())
        return {error: 'a note needs one or two themes of the set and a text'};
      return {event: {...base, kind: 'note', themes: e.themes, text: e.text.trim().slice(0, 4000)}};
    case 'retract':
      if (typeof e.target !== 'string') return {error: 'a retraction needs the id of the event it takes back'};
      return {event: {...base, kind: 'retract', target: e.target}};
    default: return {error: 'unknown kind'};
  }
}

export function createRatingsApi(root = process.cwd()) {
  const sets = join(root, 'generated/concept-lab/rate/sets'), store = join(root, 'generated/concept-lab/docs/owner-answers/ratings');
  const frozen = (set: string): {text: string; data: FrozenSet} | null => {
    const path = join(sets, set, 'set.json');
    if (!existsSync(path)) return null;
    const text = readFileSync(path, 'utf8'); return {text, data: JSON.parse(text)};
  };
  const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);
  const read = (file: string): any[] => existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (url.pathname === '/api/rate') {
      const list = existsSync(sets) ? readdirSync(sets).map(frozen).filter(s => s !== null).map(s => s!.data) : [];
      reply(res, {sets: list.map(s => ({set: s.set, title: s.title, created: s.created, themes: s.themes.length}))
        .sort((a, b) => b.created.localeCompare(a.created) || b.set.localeCompare(a.set))});
      return true;
    }
    const match = /^\/api\/rate\/([a-z0-9-]{1,80})\/events$/.exec(url.pathname);
    if (!match) return false;
    const set = match[1], f = frozen(set), file = join(store, set + '.jsonl');
    if (!f) {reply(res, {error: 'unknown set'}, 404); return true;}
    const setHash = hash(f.text);
    if (req.method === 'GET') {
      const all = read(file), after = Number(url.searchParams.get('after') ?? 0) || 0;
      reply(res, {events: all.filter(e => e.seq > after), seq: all.length ? all.at(-1).seq : 0, setHash}); return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 262144) {reply(res, {error: 'too large'}, 413); return true;}}
    let body: any;
    try {body = JSON.parse(text);} catch {reply(res, {error: 'not JSON'}, 400); return true;}
    if (body?.setHash !== setHash) {reply(res, {error: 'the set changed since the page loaded: reload it'}, 409); return true;}
    if (!Array.isArray(body.events)) {reply(res, {error: 'events must be a list'}, 400); return true;}
    const themes = new Set(f.data.themes.map(t => t.id)), stored = read(file), seen = new Set(stored.map(e => e.id));
    const checked = body.events.map((e: unknown) => checkEvent(e, themes));
    const bad = checked.find((c: any) => 'error' in c);
    if (bad) {reply(res, bad, 400); return true;}
    let seq = stored.length ? stored.at(-1).seq : 0, added = 0;
    // where it came from: the address and the browser (the device kind and screen come with the event)
    const client = {ip: req.socket.remoteAddress ?? null, ua: String(req.headers['user-agent'] ?? '').slice(0, 300)};
    mkdirSync(store, {recursive: true});
    for (const {event} of checked as {event: Record<string, unknown>}[]) {
      if (seen.has(event.id as string)) continue;  // a retry after a lost reply: already kept
      seen.add(event.id as string);
      appendFileSync(file, JSON.stringify({...event, seq: ++seq, set, savedAt: new Date().toISOString(), client}) + '\n'); added++;
    }
    reply(res, {ok: true, added}); return true;
  };
}
