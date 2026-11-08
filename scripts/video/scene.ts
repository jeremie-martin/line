/** What the picture is drawn from: one ride and its song (generated/concept-lab/docs/TIMING-DESIGN.md).
 *
 * Every consumer reads this one object: the picture (the lab, its films, the videos, study clips, the review player), the
 * review player's impact panel and the study builders. It holds:
 * - the ride as compiled (track, trace) and its impact account as recorded, in physics frames: every target (with its authored
 *   beat, in seconds, when the ride recorded it), every measured event (first touch, onset, strongest frame, strength), and which
 *   event answered which target. Nothing is converted here; the consumer converts once, through timing.js;
 * - the ride's timing: the offset between the song's clock and the ride's, derived from the ride itself (timing.js);
 * - the song span the ride covers, and the song: its recording, spectrum, sections, drop and title.
 * Nothing here reads the spec: a saved ride renders the same whatever the spec says today. */
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {loadSelect} from '../produce/config.ts';
import {DROP_TIMES} from './drops.ts';
import {FPS, alignment} from './timing.js';

const ROOT = resolve(import.meta.dirname, '../..');
const SPECTRUM = {fps: 30, bands: 56};

/** A requested impact: its physics frame as compiled, its requested strength, and its authored beat (seconds) when recorded. */
export type Target = {frame: number; impact?: number; beat?: number};
/** A measured impact (scripts/lib/strike_impact.ts), in physics frames: where its strike starts (`touch`, the event's
 * contactStart, which for a renewed strike inside continuous contact is not a new touchdown), its half-rise onset, its strongest
 * frame (maximum contact acceleration), and its strength. */
export type ImpactEvent = {touch: number; onset: number; peak: number; strength: number};
export type Account = {targets: Target[]; events: ImpactEvent[]; matches: {target: number; event: number}[]};
export type Timing = {offset: number; aligned: boolean; reason?: string};
export type Phase = {name: string; t0: number; t1: number};
export type Scene = {
  song: string; title: string;
  /** Repository-relative path of the recording; song time 0 is its first decoded sample. */
  audio: string;
  /** The song time the ride covers: the spec's duration for a compiled ride, the track's for a bare one. A video's extent. */
  span: [number, number];
  timing: Timing;
  track: {duration: number; lines: unknown[]; riders: unknown[]};
  /** A compiled production's recorded body points; the replay checks the ride against them. */
  trace?: {fps: number; pointIds: string[]; frames: number[][]};
  account: Account | null;
  phases: Phase[];
  /** The drop, placed by hand from the spec's sections, in song time, or null. */
  drop: [number, number] | null;
  spectrum: {fps: number; bands: number; frames: number[][]};
};
type SavedEvaluation = {targets: {frame: number; impact?: number}[];
  events: {contactStart: number; onset: number; peakFrame: number; strength: number}[]; account: {matches: {target: number; event: number}[]}};
/** A ride: a track, and for a compiled production its trace, impact account, song duration and (once recorded) authored beats,
 * one per target of its account. */
export type Ride = {track: Scene['track']; trace?: Scene['trace']; impactEvaluation?: SavedEvaluation; beats?: number[];
  case?: {durationFrames: number}};

/** The ride's impact account as recorded, or null for a bare track. */
export function rideAccount(ride: Ride): Account | null {
  const e = ride.impactEvaluation;
  if (!e) return null;
  if (ride.beats && ride.beats.length !== e.targets.length) throw new Error(`The ride records ${ride.beats.length} beats for ${e.targets.length} targets`);
  const targets = e.targets.map((t, i) => ({frame: t.frame, ...(t.impact === undefined ? {} : {impact: t.impact}), ...(ride.beats ? {beat: ride.beats[i]} : {})}));
  const events = e.events.map(x => ({touch: x.contactStart, onset: x.onset, peak: x.peakFrame, strength: x.strength}));
  const matches = e.account.matches.map(({target, event}) => {
    if (!targets[target] || !events[event]) throw new Error('Saved impact match references a missing target or event');
    return {target, event};
  });
  return {targets, events, matches};
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
  const audio = relative(ROOT, resolve(ROOT, recording)), account = rideAccount(ride);
  const end = (ride.case?.durationFrames ?? ride.track.duration) / FPS;
  const composition = join(ROOT, 'productions', song, 'composition.json');
  const authored: {name: string; t: number}[] = existsSync(composition) ? JSON.parse(readFileSync(composition, 'utf8')).phases : [];
  const phases = authored.length ? authored.map((p, i) => ({name: p.name, t0: p.t, t1: authored[i + 1]?.t ?? end})) : [{name: 'all', t0: 0, t1: end}];
  return {song, title: screenTitle(entry.title), audio, span: [0, end], timing: alignment(account), track: ride.track,
    ...(ride.trace ? {trace: ride.trace} : {}), account, phases, drop: DROP_TIMES[song] ?? null, spectrum: spectrum(resolve(ROOT, audio))};
}
