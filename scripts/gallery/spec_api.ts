/** Read-only view of production specs for the spec dashboard (spec-dashboard/),
 * plus the owner's timeline notes, stored beside each spec (they are authoring input).
 *   GET  /api/specs                         → {specs: [{path, name, label, group}]}
 *   GET  /api/spec-view?spec=…&samples=…    → contacts, gaps, sampled axes, keyframes, music
 *                                            (music.eventsUrl: the song's measured events.json, if any;
 *                                            music.stems: the song's separated stems that exist, by name;
 *                                            drop: the song's drop [start, end] s, scripts/video/drops.ts, or null)
 *   GET  /api/spec-notes?spec=…             → {specPath, notesPath, notes}
 *   POST /api/spec-notes  ← {spec, note} upsert (empty text and no tags deletes), {spec, id} delete, {spec, clear}
 * A note records what it was written on: `on` = {spec, sha256} (the reading and specSha256 at the time). It is `current`
 * (open; reported, not stored) until its author records a revision of that reading (revisionTimes); then it is a note on
 * an earlier version: kept, shown apart, its landing number no longer valid. Notes without `on` predate this and are earlier. Writing over an
 * earlier note keeps it (under a new id) and makes a current one; `clear` removes only the current notes of the reading.
 * Specs are edited in their source files; the dashboard does not write them. */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync, mkdirSync} from 'node:fs';
import {join, relative, resolve, sep, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {AXES, type Spec, type SpecMusic} from '../v0/types.ts';
import {DROP_TIMES} from '../video/drops.ts';

type SpecEntry = {path: string; name: string; label: string; group: string};
type Note = {id: string; t: number; scope: string; index: number | null; t0: number | null; t1: number | null;
  axis: string | null; title: string; text: string; tags: string[]; createdAt: string; updatedAt: string;
  on?: {spec: string; sha256: string}};

const SCOPES = new Set(['moment', 'contact', 'gap', 'range', 'keyframe']);
const round = (x: number, digits = 4) => Math.round(x * 10 ** digits) / 10 ** digits;
const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};

/** Refuse stale derived measurements rather than silently displaying them. */
export function validVocalEvidence(root: string, evidencePath: string, audioPath: string): boolean {
  try {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    if (evidence.schema !== 'line.vocal-evidence.v1' || !Array.isArray(evidence.inputs) || !evidence.inputs.length) return false;
    if (!evidence.inputs.some((input: {path: string}) => resolve(root, input.path) === resolve(root, audioPath))) return false;
    return evidence.inputs.every((input: {path: string; sha256: string}) => {
      const path = resolve(root, input.path);
      return path.startsWith(resolve(root) + sep) && createHash('sha256').update(readFileSync(path)).digest('hex') === input.sha256;
    });
  } catch { return false; }
}

/** The specs the dashboard shows: each production's spec.ts, then its variants (productions/<song>/variants/*.ts). */
export const listSpecs = (root: string): SpecEntry[] => readdirSync(join(root, 'productions'), {withFileTypes: true})
  .filter(d => d.isDirectory() && existsSync(join(root, 'productions', d.name, 'spec.ts')))
  .flatMap(d => {
    const dir = join(root, 'productions', d.name, 'variants');
    const variants = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.ts')).sort() : [];
    return [{path: `productions/${d.name}/spec.ts`, name: d.name, label: d.name, group: 'production'},
      ...variants.map(f => ({path: `productions/${d.name}/variants/${f}`, name: `${d.name}:${f.slice(0, -3)}`,
        label: `${d.name} · ${f.slice(0, -3)}`, group: 'production'}))];
  });

/** What a spec is made from: every .ts of its song's folder (the spec, the variant it may re-export, music.ts) and the
 * measured files they load. A video or a verdict is current while none of them changed. `path` is the spec file's
 * absolute path. */
/** When the author's notes on what changed in a reading were recorded (productions/<song>/revisions.json, written by
 * tools/music/revision.ts), oldest first. Recording one is what answers the owner's input: a timeline note, or his words
 * on the reading, is open (current) while no revision of that reading was recorded after it was written; a change of the
 * files alone does not close it. */
export const revisionTimes = (root: string, specPath: string): string[] => {
  try {
    const all = JSON.parse(readFileSync(join(root, specPath.split('/').slice(0, 2).join('/'), 'revisions.json'), 'utf8')).revisions;
    return (Array.isArray(all) ? all : []).filter(r => r?.spec === specPath && typeof r.at === 'string').map(r => r.at as string).sort();
  } catch {return [];}
};

const songOf = (path: string) => path.slice(0, path.indexOf('/', path.indexOf('productions/') + 12));
const MEASURED = /^(events|sung|lines|vocal-evidence|audio)\.json$/;
/** The files one reading is made from, relative to its song's folder, sorted: the spec file, the files of the folder it
 * imports (and they import: a variant's `../spec.ts`, the song's music.ts), and the song's measured files. Another
 * reading of the same song is not among them unless this one imports it. `path` is the spec file's absolute path. */
export const specFiles = (path: string): string[] => {
  const song = songOf(path), seen = new Set<string>();
  const visit = (file: string) => {
    const name = relative(song, file);
    if (name.startsWith('..') || seen.has(name) || !existsSync(file)) return;
    seen.add(name);
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) visit(join(dirname(file), m[1]));
  };
  visit(path);
  return [...seen, ...readdirSync(song).filter(f => MEASURED.test(f))].sort();
};
/** The version of a reading: a video, a verdict or a note on what changed is of this version while none of the reading's
 * own files (specFiles) changed. */
export const specSha256 = (path: string) => {
  const song = songOf(path), hash = createHash('sha256');
  for (const f of specFiles(path)) hash.update(f).update(readFileSync(join(song, f)));
  return hash.digest('hex');
};
/** The version as it was recorded before a reading had one of its own: every .ts of the song's folder and its measured
 * files. Records made then stay valid while the whole folder is unchanged. */
const songSha256 = (path: string) => {
  const song = songOf(path), hash = createHash('sha256');
  const files = (readdirSync(song, {recursive: true}) as string[]).filter(f => /\.ts$/.test(f) || MEASURED.test(f)).sort();
  for (const f of files) hash.update(f).update(readFileSync(join(song, f)));
  return hash.digest('hex');
};
/** Whether a recorded version (of a video, a verdict, a note) is the reading's present one. */
export const isVersion = (path: string, recorded: string | undefined) => !!recorded && (recorded === specSha256(path) || recorded === songSha256(path));

/** The separated stems a song has (generated/stems/<song>/<stem>.wav), by stem name. */
const STEMS = ['vocals', 'other', 'drums', 'bass'];

export function createSpecApi(root = process.cwd()) {
  const url = (abs: string) => '/' + relative(root, abs).split(sep).join('/');
  const specs = () => listSpecs(root);
  /** A production's folder, for a spec.ts or a variant. */
  const songDir = (specPath: string) => specPath.split('/').slice(0, 2).join('/');
  const resolveSpec = (raw: string) => specs().find(s => s.path === raw);
  const notesFile = (specPath: string) => join(root, songDir(specPath), 'notes.json');
  const readNotes = (specPath: string): Note[] => {
    const file = notesFile(specPath);
    if (!existsSync(file)) return [];
    const notes = JSON.parse(readFileSync(file, 'utf8')).notes;
    return Array.isArray(notes) ? notes : [];
  };
  const onNow = (specPath: string) => ({spec: specPath, sha256: specSha256(join(root, specPath))});
  /** Open: written on this reading, and no revision of it recorded since. */
  const isCurrent = (n: Note, on: {spec: string; sha256: string}) => n.on?.spec === on.spec && !(n.createdAt <= (revisionTimes(root, on.spec).at(-1) ?? ''));
  /** Every change to his notes, appended (labels/spec-notes.jsonl): nothing he wrote is lost to a delete, a clear or a
   * later edit. */
  const journal = (spec: string, event: 'write' | 'delete' | 'clear', notes: Note[]) => {
    if (!notes.length) return;
    mkdirSync(join(root, 'labels'), {recursive: true});
    appendFileSync(join(root, 'labels/spec-notes.jsonl'), JSON.stringify({at: new Date().toISOString(), spec, event, notes}) + '\n');
  };
  const writeNotes = (specPath: string, notes: Note[]) => writeFileSync(notesFile(specPath),
    JSON.stringify({specPath, notes: [...notes].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id))}, null, 2) + '\n');
  const asset = (ref: string | undefined) => {
    if (!ref) return null;
    const abs = resolve(root, ref);
    return abs.startsWith(root + sep) ? {ref, url: url(abs), abs} : null;
  };

  function music(m: SpecMusic | undefined, specDir: string) {
    if (!m?.audio) return null;
    const events = existsSync(join(root, specDir, 'events.json')) ? asset(join(specDir, 'events.json')) : null;
    const evidencePath = join(root, specDir, 'vocal-evidence.json');
    let vocalEvidenceUrl: string | null = null, vocalEvidenceError: string | null = null;
    if (existsSync(evidencePath)) {
      if (validVocalEvidence(root, evidencePath, m.audio)) vocalEvidenceUrl = url(evidencePath);
      else vocalEvidenceError = 'Vocal evidence is stale or its source files are missing. Regenerate it before using it.';
    }
    const image = asset(m.spectrogram?.image), meta = asset(m.spectrogram?.metadata);
    const stemDir = join(root, 'generated/stems', specDir.split('/')[1]);
    const stems = Object.fromEntries(STEMS.filter(s => existsSync(join(stemDir, s + '.wav'))).map(s => [s, url(join(stemDir, s + '.wav'))]));
    return {title: m.title ?? null, artist: m.artist ?? null, tempo: m.tempo ?? null,
      audio: m.audio, audioUrl: asset(m.audio)?.url ?? null, beatsUrl: asset(m.beats)?.url ?? null, eventsUrl: events?.url ?? null, stems,
      vocalEvidenceUrl, vocalEvidenceError,
      spectrogram: image || meta ? {imageUrl: image?.url ?? null,
        meta: meta && existsSync(meta.abs) ? JSON.parse(readFileSync(meta.abs, 'utf8')) : null} : null};
  }

  async function computeView(entry: SpecEntry, requested: number) {
    const abs = join(root, entry.path);
    const mod = await import(pathToFileURL(abs).href);
    const spec = mod.default as Spec, duration = spec.duration, samples = Math.max(80, Math.min(3000, Math.trunc(requested)));
    const contacts = spec.contacts.map(c => ({t: round(c.t), impact: Number.isFinite(c.impact) ? round(c.impact!) : null}))
      .sort((a, b) => a.t - b.t);
    const axes: Record<string, unknown> = {}, keyframes: unknown[] = [];
    for (const axis of AXES) {
      const curve = spec.axes?.[axis];
      if (typeof curve !== 'function') continue;
      const meta = (curve as any).meta, metaPoints = Array.isArray(meta?.points) ? meta.points : [];
      metaPoints.forEach((p: any, i: number) => keyframes.push({axis, index: i, t: round(p.t), v: round(p.v),
        ease: p.ease ?? meta.defaultEase ?? null}));
      const points: [number, number | null][] = [];
      for (let i = 0; i < samples; i++) {
        const t = duration * i / (samples - 1), v = curve(t);
        points.push([round(t), typeof v === 'number' && Number.isFinite(v) ? round(v) : null]);
      }
      axes[axis] = {points};
    }
    const gaps = contacts.map((c, i) => {
      const t0 = i === 0 ? 0 : contacts[i - 1].t;
      return {i, t0: round(t0), t1: c.t, duration: round(c.t - t0)};
    });
    const impacts = contacts.map(c => c.impact).filter((v): v is number => v !== null), durations = gaps.map(g => g.duration);
    return {
      spec: {label: entry.label, path: entry.path, duration},
      summary: {contacts: contacts.length, activeAxes: Object.keys(axes), keyframes: keyframes.length,
        impactTargets: impacts.length,
        minImpact: impacts.length ? Math.min(...impacts) : null, maxImpact: impacts.length ? Math.max(...impacts) : null,
        shortestGap: durations.length ? Math.min(...durations) : null, longestGap: durations.length ? Math.max(...durations) : null},
      contacts, gaps, axes, keyframes,
      overlayMeta: mod.overlayMeta ?? null, music: music(spec.music, songDir(entry.path)),
      drop: DROP_TIMES[entry.path.split('/')[1]] ?? null,
    };
  }

  function note(input: any, previous: Note | undefined, on: {spec: string; sha256: string}): Note {
    const now = new Date().toISOString(), num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
    const t = num(input.t) ?? previous?.t ?? 0, scope = SCOPES.has(input.scope) ? input.scope : previous?.scope ?? 'moment';
    const index = num(input.index) !== null ? Math.trunc(input.index) : previous?.index ?? null;
    const t0 = num(input.t0) ?? previous?.t0 ?? null, t1 = num(input.t1) ?? previous?.t1 ?? null;
    const tags = Array.isArray(input.tags) ? input.tags.filter((x: unknown) => typeof x === 'string').map((x: string) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : previous?.tags ?? [];
    const id = String(input.id ?? previous?.id ?? `${scope}:${index ?? Math.round(Math.max(0, t) * 1000)}`).replace(/[^A-Za-z0-9:._-]+/g, '_').slice(0, 120);
    return {id, t: round(Math.max(0, t)), scope, index, t0: t0 === null ? null : round(Math.max(0, t0)), t1: t1 === null ? null : round(Math.max(0, t1)),
      axis: typeof input.axis === 'string' ? input.axis.trim() || null : previous?.axis ?? null,
      title: String(input.title ?? previous?.title ?? scope).trim().slice(0, 160), text: String(input.text ?? previous?.text ?? '').slice(0, 20000),
      tags: [...new Set<string>(tags)], createdAt: previous?.createdAt ?? now, updatedAt: now, on};
  }

  /** Each view loads its spec in a short-lived worker thread: a fresh module graph, so edits
   * to a spec's imports (a song's music.ts, another variant) show without a restart, and a
   * spec that hangs or throws cannot take the server down. */
  function view(entry: SpecEntry, requested: number): Promise<unknown> {
    return new Promise((done, fail) => {
      const worker = new Worker(new URL(import.meta.url), {workerData: {specView: {root, entry, requested}}});
      const timer = setTimeout(() => {worker.terminate(); fail(new Error('spec view timed out after 30 s'));}, 30_000);
      worker.once('message', (m: {view?: unknown; error?: string}) => {clearTimeout(timer); worker.terminate(); m.error ? fail(new Error(m.error)) : done(m.view);});
      worker.once('error', (e) => {clearTimeout(timer); fail(e);});
    });
  }

  const handle = async function handle(req: IncomingMessage, res: ServerResponse, u: URL): Promise<boolean> {
    if (u.pathname === '/api/specs') {reply(res, {specs: specs()}); return true;}
    if (u.pathname === '/api/spec-view') {
      const entry = resolveSpec(u.searchParams.get('spec') ?? '');
      if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
      reply(res, await view(entry, Number(u.searchParams.get('samples') ?? 1200) || 1200)); return true;
    }
    if (u.pathname !== '/api/spec-notes') return false;
    if (req.method === 'GET') {
      const entry = resolveSpec(u.searchParams.get('spec') ?? '');
      if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
      const on = onNow(entry.path);
      reply(res, {specPath: entry.path, notesPath: relative(root, notesFile(entry.path)), notes: readNotes(entry.path).map(n => ({...n, current: isCurrent(n, on)}))}); return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 65536) {reply(res, {error: 'note too large'}, 413); return true;}}
    const body = JSON.parse(text), entry = resolveSpec(body.spec ?? '');
    if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
    const notes = readNotes(entry.path), base = {ok: true, specPath: entry.path, notesPath: relative(root, notesFile(entry.path))};
    const on = onNow(entry.path);
    if (body.clear === true) {
      const kept = notes.filter(n => !isCurrent(n, on)); journal(entry.path, 'clear', notes.filter(n => isCurrent(n, on))); writeNotes(entry.path, kept);
      reply(res, {...base, count: kept.length, notes: kept.map(n => ({...n, current: false}))}); return true;
    }
    if (body.note == null) {
      if (typeof body.id !== 'string') {reply(res, {error: 'missing note or id'}, 400); return true;}
      const next = notes.filter(n => n.id !== body.id); journal(entry.path, 'delete', notes.filter(n => n.id === body.id)); writeNotes(entry.path, next); reply(res, {...base, count: next.length}); return true;
    }
    // a note on an earlier version is not written over: it stays, under an id of its own, and the new one is current
    const before = notes.find(x => x.id === body.note.id), earlier = before && !isCurrent(before, on) ? before : undefined;
    const n = note(body.note, earlier ? {...earlier, createdAt: new Date().toISOString()} : before, on), empty = !n.text.trim() && n.tags.length === 0;
    const archived = earlier ? [{...earlier, id: `${earlier.id}~${earlier.createdAt.slice(0, 19).replace(/[^0-9]/g, '')}`}] : [];
    const next = [...notes.filter(x => x.id !== n.id), ...archived, ...(empty ? [] : [n])];
    if (empty) journal(entry.path, 'delete', before && !earlier ? [before] : []); else journal(entry.path, 'write', [n]);
    writeNotes(entry.path, next); reply(res, {...base, count: next.length, note: empty ? null : {...n, current: true}}); return true;
  };
  return Object.assign(handle, {computeView});
}

// Worker side of view(): load the spec fresh and send its view back.
if (!isMainThread && workerData?.specView) {
  const {root, entry, requested} = workerData.specView;
  createSpecApi(root).computeView(entry, requested)
    .then(view => parentPort!.postMessage({view}), (e: unknown) => parentPort!.postMessage({error: String(e)}));
}
