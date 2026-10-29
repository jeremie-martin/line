/** Read-only view of production specs for the spec dashboard (spec-dashboard/),
 * plus the owner's timeline notes, stored beside each spec (they are authoring input).
 *   GET  /api/specs                         → {specs: [{path, name, label, group}]}
 *   GET  /api/spec-view?spec=…&samples=…    → contacts, gaps, sampled axes, keyframes, zoom, music
 *                                            (music.eventsUrl: the song's measured events.json, if any)
 *   GET  /api/spec-notes?spec=…             → {specPath, notesPath, notes}
 *   POST /api/spec-notes  ← {spec, note} upsert (empty text and no tags deletes), {spec, id} delete, {spec, clear}
 * Specs are edited in their source files; the dashboard does not write them. */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {specZoomLaneToRenderPlan} from '../v0/core/camera.ts';
import {AXES, FPS, type Spec, type SpecMusic} from '../v0/types.ts';

type Note = {id: string; t: number; scope: string; index: number | null; t0: number | null; t1: number | null;
  axis: string | null; title: string; text: string; tags: string[]; createdAt: string; updatedAt: string};

const SCOPES = new Set(['moment', 'contact', 'gap', 'range', 'keyframe']);
const READ_ONLY = {editable: false, editKind: null, id: null, readOnlyReason: 'Edit the spec source; the dashboard is read-only'};
const round = (x: number, digits = 4) => Math.round(x * 10 ** digits) / 10 ** digits;
const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};

export function createSpecApi(root = process.cwd()) {
  const url = (abs: string) => '/' + relative(root, abs).split(sep).join('/');
  const specs = () => readdirSync(join(root, 'productions'), {withFileTypes: true})
    .filter(d => d.isDirectory() && existsSync(join(root, 'productions', d.name, 'spec.ts')))
    .map(d => ({path: `productions/${d.name}/spec.ts`, name: d.name, label: d.name, group: 'production'}));
  const resolveSpec = (raw: string) => specs().find(s => s.path === raw);
  const notesFile = (specPath: string) => join(root, dirname(specPath), 'notes.json');
  const readNotes = (specPath: string): Note[] => {
    const file = notesFile(specPath);
    if (!existsSync(file)) return [];
    const notes = JSON.parse(readFileSync(file, 'utf8')).notes;
    return Array.isArray(notes) ? notes : [];
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
    const beats = asset(m.beats), image = asset(m.spectrogram?.image), meta = asset(m.spectrogram?.metadata);
    return {title: m.title ?? null, artist: m.artist ?? null, tempo: m.tempo ?? null, offset: Number.isFinite(m.offset) ? m.offset : 0,
      audio: m.audio, audioUrl: asset(m.audio)?.url ?? null, beats: m.beats ?? null, beatsUrl: beats?.url ?? null, eventsUrl: events?.url ?? null,
      spectrogram: image || meta ? {image: image?.ref ?? null, imageUrl: image?.url ?? null, metadata: meta?.ref ?? null,
        metadataUrl: meta?.url ?? null, meta: meta && existsSync(meta.abs) ? JSON.parse(readFileSync(meta.abs, 'utf8')) : null} : null};
  }

  function zoom(spec: Spec, samples: number) {
    const lane = spec.camera?.zoom, plan = lane && specZoomLaneToRenderPlan(lane, spec.duration);
    if (!lane || !plan || plan.autoZoom.length === 0) return null;
    const count = Math.max(2, Math.min(samples, plan.autoZoom.length)), points: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const t = spec.duration * i / (count - 1);
      points.push([round(t), round(plan.autoZoom[Math.max(0, Math.min(plan.autoZoom.length - 1, Math.round(t * FPS)))])]);
    }
    const values = points.map(p => p[1]);
    return {zoom: {points, smoothingFrames: plan.zoomSmoothing, min: Math.min(...values), max: Math.max(...values), count,
      keyframes: lane.keyframes.map((p, index) => ({id: `camera.zoom:${index}`, index, t: round(p.t), zoom: round(p.zoom), edit: READ_ONLY})),
      renderKeyframes: plan.zoomKeyframes.map(([frame, log2], i) => ({i, frame, t: round(frame / FPS), zoom: round(2 ** log2), log2Zoom: round(log2)}))}};
  }

  async function view(entry: {path: string; name: string; label: string; group: string}, requested: number) {
    const abs = join(root, entry.path);
    const mod = await import(`${pathToFileURL(abs).href}?mtime=${Math.trunc(statSync(abs).mtimeMs)}`);
    const spec = mod.default as Spec, duration = spec.duration, samples = Math.max(80, Math.min(3000, Math.trunc(requested)));
    const contacts = spec.contacts.map((c, i) => ({i, t: round(c.t), frame: Math.round(c.t * FPS),
      impact: Number.isFinite(c.impact) ? round(c.impact!) : null, edit: READ_ONLY})).sort((a, b) => a.t - b.t);
    const axes: Record<string, unknown> = {}, keyframes: unknown[] = [], axisRanges: Record<string, unknown> = {};
    for (const axis of AXES) {
      const curve = spec.axes?.[axis];
      if (typeof curve !== 'function') continue;
      const meta = (curve as any).meta, metaPoints = Array.isArray(meta?.points) ? meta.points : [];
      metaPoints.forEach((p: any, i: number) => keyframes.push({id: `${axis}:${i}`, axis, index: i, t: round(p.t), v: round(p.v),
        ease: p.ease ?? meta.defaultEase ?? null, sourceEase: p.ease ?? null, kind: meta.kind ?? 'unknown', edit: READ_ONLY}));
      const points: [number, number | null][] = [];
      for (let i = 0; i < samples; i++) {
        const t = duration * i / (samples - 1), v = curve(t);
        points.push([round(t), typeof v === 'number' && Number.isFinite(v) ? round(v) : null]);
      }
      const values = points.map(p => p[1]).filter((v): v is number => v !== null);
      const range = values.length ? {min: Math.min(...values), max: Math.max(...values), count: values.length} : null;
      axes[axis] = {points, min: range?.min ?? null, max: range?.max ?? null, count: values.length,
        meta: metaPoints.length ? {kind: meta.kind ?? 'unknown', defaultEase: meta.defaultEase ?? null, points: metaPoints} : null};
      if (range) axisRanges[axis] = range;
    }
    const gaps = contacts.map((c, i) => {
      const t0 = i === 0 ? 0 : contacts[i - 1].t, mid = (t0 + c.t) / 2, targets: Record<string, number> = {};
      for (const axis of AXES) {
        const v = spec.axes?.[axis]?.(mid);
        if (typeof v === 'number' && Number.isFinite(v)) targets[axis] = round(v);
      }
      return {i, t0: round(t0), t1: c.t, duration: round(c.t - t0), contactIndex: c.i, contactT: c.t, impact: c.impact, targets};
    });
    const impacts = contacts.map(c => c.impact).filter((v): v is number => v !== null), durations = gaps.map(g => g.duration);
    const camera = zoom(spec, samples);
    return {
      spec: {name: entry.name, label: entry.label, path: entry.path, group: entry.group, duration, frameRate: FPS,
        jitter: spec.jitter ?? null, preroll: spec.preroll ?? null, start: spec.start ?? null},
      summary: {contacts: contacts.length, gaps: gaps.length, activeAxes: Object.keys(axes), keyframes: keyframes.length,
        zoomKeyframes: camera?.zoom.keyframes.length ?? 0, zoomMin: camera?.zoom.min ?? null, zoomMax: camera?.zoom.max ?? null,
        zoomSmoothingFrames: camera?.zoom.smoothingFrames ?? null, impactTargets: impacts.length,
        minImpact: impacts.length ? Math.min(...impacts) : null, maxImpact: impacts.length ? Math.max(...impacts) : null,
        shortestGap: durations.length ? Math.min(...durations) : null, longestGap: durations.length ? Math.max(...durations) : null, axisRanges},
      contacts, gaps, axes, keyframes, camera, calibration: null,
      overlayMeta: mod.overlayMeta ?? null, benchmark: null, music: music(spec.music, dirname(entry.path)),
    };
  }

  function note(input: any, previous: Note | undefined): Note {
    const now = new Date().toISOString(), num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
    const t = num(input.t) ?? previous?.t ?? 0, scope = SCOPES.has(input.scope) ? input.scope : previous?.scope ?? 'moment';
    const index = num(input.index) !== null ? Math.trunc(input.index) : previous?.index ?? null;
    const t0 = num(input.t0) ?? previous?.t0 ?? null, t1 = num(input.t1) ?? previous?.t1 ?? null;
    const tags = Array.isArray(input.tags) ? input.tags.filter((x: unknown) => typeof x === 'string').map((x: string) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : previous?.tags ?? [];
    const id = String(input.id ?? previous?.id ?? `${scope}:${index ?? Math.round(Math.max(0, t) * 1000)}`).replace(/[^A-Za-z0-9:._-]+/g, '_').slice(0, 120);
    return {id, t: round(Math.max(0, t)), scope, index, t0: t0 === null ? null : round(Math.max(0, t0)), t1: t1 === null ? null : round(Math.max(0, t1)),
      axis: typeof input.axis === 'string' ? input.axis.trim() || null : previous?.axis ?? null,
      title: String(input.title ?? previous?.title ?? scope).trim().slice(0, 160), text: String(input.text ?? previous?.text ?? '').slice(0, 20000),
      tags: [...new Set<string>(tags)], createdAt: previous?.createdAt ?? now, updatedAt: now};
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, u: URL): Promise<boolean> {
    if (u.pathname === '/api/specs') {reply(res, {specs: specs()}); return true;}
    if (u.pathname === '/api/spec-edits') {reply(res, {edits: []}); return true;}
    if (u.pathname === '/api/spec-history') {reply(res, {history: null}); return true;}
    if (u.pathname === '/api/spec-view') {
      const entry = resolveSpec(u.searchParams.get('spec') ?? '');
      if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
      reply(res, await view(entry, Number(u.searchParams.get('samples') ?? 1200) || 1200)); return true;
    }
    if (u.pathname !== '/api/spec-notes') return false;
    if (req.method === 'GET') {
      const entry = resolveSpec(u.searchParams.get('spec') ?? '');
      if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
      reply(res, {specPath: entry.path, notesPath: relative(root, notesFile(entry.path)), notes: readNotes(entry.path)}); return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 65536) {reply(res, {error: 'note too large'}, 413); return true;}}
    const body = JSON.parse(text), entry = resolveSpec(body.spec ?? '');
    if (!entry) {reply(res, {error: 'unknown spec'}, 400); return true;}
    const notes = readNotes(entry.path), base = {ok: true, specPath: entry.path, notesPath: relative(root, notesFile(entry.path)), history: null};
    if (body.clear === true) {writeNotes(entry.path, []); reply(res, {...base, count: 0, notes: []}); return true;}
    if (body.note == null) {
      if (typeof body.id !== 'string') {reply(res, {error: 'missing note or id'}, 400); return true;}
      const next = notes.filter(n => n.id !== body.id); writeNotes(entry.path, next); reply(res, {...base, count: next.length}); return true;
    }
    const n = note(body.note, notes.find(x => x.id === body.note.id)), empty = !n.text.trim() && n.tags.length === 0;
    const next = [...notes.filter(x => x.id !== n.id), ...(empty ? [] : [n])];
    writeNotes(entry.path, next); reply(res, {...base, count: next.length, note: empty ? null : n}); return true;
  };
}
