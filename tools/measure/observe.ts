/** Replay saved production rides and record what the measures need: per-frame
 * point states, every collision (line id + rider point), sled contact, the
 * detector's landing events with the frozen impact value, and the experimental
 * contact-impact evaluation. Output feeds tools/measure/measures.ts.
 *
 *   node --import tsx tools/measure/observe.ts [--sets=july,current,experimental]
 *
 * Writes generated/measure/observations/<set>~<song>~<seed>.json.gz
 * (+ an index.json listing the sources and their track hashes). */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory, detect} from '../../scripts/lib/detector.ts';
import {contactRedirArcPxAtLanding} from '../../scripts/v0/core/substrate.ts';
import {impactFrames, evaluateMusicalImpacts} from '../../scripts/v0/optimizer/impact_search.ts';

export const POINTS = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
export const OUT = 'generated/measure/observations';
export const SONGS = ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s', 'amour_de_ma_vie_44s'];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

export type Source = {set: string; song: string; seed: number; track: any; origin: string};

/** The three reference sets: July (cleaner impacts, owner's memory), the current
 * default automatic library, and the experimental contact-impact candidates. */
export function sources(sets: string[]): Source[] {
  const out: Source[] = [];
  if (sets.includes('july')) {
    const dir = 'generated/reference/july-2026-07';
    for (const line of readFileSync(join(dir, 'jobs.txt'), 'utf8').trim().split('\n')) {
      const [song, seed] = line.split(/\s+/), path = join(dir, `${song}-${seed}.track.json`);
      if (existsSync(path)) out.push({set: 'july', song, seed: Number(seed), track: readJson(path), origin: path});
    }
  }
  if (sets.includes('current')) for (const song of SONGS) for (const seed of [101, 202, 303]) {
    const path = `generated/intentional-motion/library-candidate-8/${song}-${seed}/${song}-${seed}-production.json`;
    if (existsSync(path)) out.push({set: 'current', song, seed, track: readJson(path).track, origin: path});
  }
  if (sets.includes('experimental')) for (const entry of readJson('motion-gallery/impact-review.json').entries) {
    const manifest = readJson(entry.manifest.replace(/^\//, '')), cell = manifest.cells.find((c: any) => c.method === 'production');
    const dir = entry.manifest.replace(/^\//, '').replace(/\/manifest\.json$/, '');
    const record = readJson(join(dir, cell.path));
    out.push({set: 'experimental', song: entry.song ?? record.case?.id ?? cell.caseId, seed: entry.seed ?? cell.seed, track: record.track, origin: join(dir, cell.path)});
  }
  return out;
}

export async function songSpec(song: string) {
  const spec = (await import(pathToFileURL(join(process.cwd(), 'productions', song, 'spec.ts')).href)).default;
  return {durationFrames: Math.round(spec.duration * 40),
    targets: spec.contacts.map((c: any) => ({t: c.t, frame: Math.round(c.t * 40), impact: c.impact}))};
}

export function observe(track: any, durationFrames: number, targets: Array<{frame: number; impact?: number}>) {
  const engine = new Engine().setStart(track.startPosition ?? track.riders[0].startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const raw = extractRawTrajectory(engine, durationFrames + 20), det = detect(raw);
  const last = Math.min(durationFrames + 20, det.terminus.frame);
  const frames = [];
  for (let f = 0; f <= last; f++) {
    const rider = engine.getRider(f), state = rider.ballisticState();
    const collisions: number[][] = [];
    for (const u of engine.getUpdatesAtFrame(f)) if (u.type === 'CollisionUpdate') collisions.push([u.id, POINTS.indexOf(u.updated[0].id)]);
    frames.push({v: [rider.velocity.x, rider.velocity.y],
      points: POINTS.map(id => [state.points[id].x, state.points[id].y, state.points[id].prevX, state.points[id].prevY]),
      collisions, mounted: state.riderMounted, intact: state.sledIntact});
  }
  const observed = impactFrames(engine, raw.frames.slice(0, last + 1));
  const contact = evaluateMusicalImpacts(observed, targets, durationFrames,
    det.terminus.reason === 'endOfSpec' && det.terminus.frame >= durationFrames);
  const landings = det.events.filter((e: any) => e.type === 'landing' || e.type === 'bounce' || e.type === 'flyThrough')
    .map((e: any) => ({frame: e.frame, type: e.type, raw: contactRedirArcPxAtLanding(det, e.frame) ?? null}));
  return {terminus: det.terminus, frames, sledContact: raw.frames.slice(0, last + 1).map((r: any) => r.sledContacts.length ? 1 : 0),
    observed: observed.map((o: any) => [o.contact ? 1 : 0, o.bend, o.response, o.solverGain, o.gravityGain, o.speedBefore]),
    contactEvents: contact.events, contactAccount: contact.account, landings};
}

if (import.meta.filename === process.argv[1]) {
  const sets = (process.argv.find(a => a.startsWith('--sets='))?.slice(7) ?? 'july,current,experimental').split(',');
  mkdirSync(OUT, {recursive: true});
  const index = [];
  for (const s of sources(sets)) {
    const {durationFrames, targets} = await songSpec(s.song), id = `${s.set}~${s.song}~${s.seed}`;
    const result = {id, ...s, track: undefined, trackHash: sha(JSON.stringify(s.track)), durationFrames, targets,
      ...observe(s.track, durationFrames, targets)};
    writeFileSync(join(OUT, id + '.json.gz'), gzipSync(JSON.stringify(result)));
    index.push({id, set: s.set, song: s.song, seed: s.seed, origin: s.origin, trackHash: result.trackHash});
    console.log(`${id}  frames ${result.frames.length}  terminus ${result.terminus.reason}`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  process.exit(0);
}
