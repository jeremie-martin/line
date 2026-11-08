/** What the picture is drawn from: one ride and its song, in song seconds.
 *
 * The video renderer (picture.js) and the concept lab read exactly this, so a lab frame and a finished video frame are
 * drawn from the same data. Hits are the ride's own measured impacts (onset and strength from the saved one-to-one impact
 * account), never the spec's requests; a bare track (a review clip) has none. The spectrum is computed once per recording
 * (make_spectrum.py) and cached by its bytes. Nothing here reads the spec: a saved ride renders the same whatever the spec
 * says today. */
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {loadSelect} from '../produce/config.ts';
import {DROP_TIMES} from './drops.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const FPS = 40; // physics frames per second
const SPECTRUM = {fps: 30, bands: 56};

export type Hit = {t: number; s: number};
export type Phase = {name: string; t0: number; t1: number};
export type Scene = {
  song: string; title: string; duration: number;
  /** Repository-relative path of the recording; t = 0 is its first decoded sample. */
  audio: string;
  track: {duration: number; lines: unknown[]; riders: unknown[]};
  /** A compiled production's recorded body points; the replay checks the ride against them. */
  trace?: {fps: number; pointIds: string[]; frames: number[][]};
  hits: Hit[]; phases: Phase[];
  /** The drop, placed by hand from the spec's sections, or null. */
  drop: [number, number] | null;
  spectrum: {fps: number; bands: number; frames: number[][]};
};
type ImpactEvaluation = {targets: {frame: number}[]; events: {onset: number; strength: number}[]; account: {matches: {target: number; event: number}[]}};
/** A ride: a track, and for a compiled production its trace and impact account. */
export type Ride = {track: Scene['track']; trace?: Scene['trace']; impactEvaluation?: ImpactEvaluation};

/** The ride's measured hits: every requested impact the ride answered, at its measured onset and strength. */
export function measuredHits(evaluation: ImpactEvaluation): Hit[] {
  const event = new Map(evaluation.account.matches.map(m => [m.target, evaluation.events[m.event]]));
  return evaluation.targets.flatMap((_, i) => {
    const e = event.get(i);
    if (event.has(i) && !e) throw new Error('Saved impact match references a missing event');
    return e ? [{t: e.onset / FPS, s: e.strength}] : [];
  });
}

/** The on-screen title: the catalog title without its artist or parenthetical, in capitals. */
export function screenTitle(catalogTitle: string): string {
  return catalogTitle.split(' — ').at(-1)!.replace(/\s*\(.*\)/, '').toUpperCase();
}

/** make_spectrum.py needs numpy: the beats venv when present, LR_SPECTRUM_PYTHON to choose another. */
const spectrumPython = () => process.env.LR_SPECTRUM_PYTHON ?? (existsSync(join(ROOT, 'beats/.venv/bin/python')) ? join(ROOT, 'beats/.venv/bin/python') : 'python3');
/** The song's spectrum (30 frames per second × 56 bands), computed once per recording. */
export function spectrum(audioPath: string): Scene['spectrum'] {
  const bytes = readFileSync(audioPath), script = join(ROOT, 'scripts/make_spectrum.py');
  const id = createHash('sha256').update(bytes).update(readFileSync(script)).update(JSON.stringify(SPECTRUM)).digest('hex');
  const out = join(ROOT, 'generated/spectrum', `${id}.json`);
  if (!existsSync(out)) {
    mkdirSync(join(ROOT, 'generated/spectrum'), {recursive: true});
    const temporary = `${out}.${randomUUID()}.tmp`;
    try {
      execFileSync(spectrumPython(), [script, `--audio=${audioPath}`, `--out=${temporary}`, `--fps=${SPECTRUM.fps}`, `--bands=${SPECTRUM.bands}`], {stdio: 'pipe'});
      JSON.parse(readFileSync(temporary, 'utf8')); // never publish a truncated analysis
      renameSync(temporary, out);
    } finally {rmSync(temporary, {force: true});}
  }
  return JSON.parse(readFileSync(out, 'utf8'));
}

/** The song's recording, repository-relative, resolved as a compile resolves it: select.json's `audio`, by default
 * productions/<song>/audio.mp3. */
export const songRecording = (song: string) => relative(ROOT, loadSelect(join(ROOT, 'productions', song)).audio);

/** The scene of one ride of `song` (a folder of productions/), timed to `recording`: a saved production passes the recording it
 * was compiled and verified against (its case's audioPath), a bare track the song's own. */
export function buildScene(song: string, ride: Ride, recording = songRecording(song)): Scene {
  const entry = repertoireSongs.find(s => s.id === song);
  if (!entry) throw new Error(`Unknown song: ${song}`);
  const audio = relative(ROOT, resolve(ROOT, recording)), duration = ride.track.duration / FPS;
  const composition = join(ROOT, 'productions', song, 'composition.json');
  const authored: {name: string; t: number}[] = existsSync(composition) ? JSON.parse(readFileSync(composition, 'utf8')).phases : [];
  const phases = authored.length ? authored.map((p, i) => ({name: p.name, t0: p.t, t1: authored[i + 1]?.t ?? duration})) : [{name: 'all', t0: 0, t1: duration}];
  return {song, title: screenTitle(entry.title), duration, audio, track: ride.track, ...(ride.trace ? {trace: ride.trace} : {}),
    hits: ride.impactEvaluation ? measuredHits(ride.impactEvaluation) : [], phases, drop: DROP_TIMES[song] ?? null, spectrum: spectrum(resolve(ROOT, audio))};
}
