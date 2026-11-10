/** What the picture is drawn from: one ride and its song (generated/concept-lab/docs/TIMING-DESIGN.md).
 *
 * Every consumer reads this one object: the picture (the lab, its films, the videos, study clips, the review player), the
 * review player's impact panel and the study builders. It holds:
 * - the ride as compiled (track, trace) and its impact account as recorded, in physics frames: every target (with its authored
 *   beat, in seconds, when the ride recorded it), every measured event (its onset, where the strike begins, and its strongest
 *   frame, where the hit happens; its strength), and which event answered which target. Nothing is converted here; the
 *   consumer converts once, through timing.js;
 * - the ride's timing: the offset between the song's clock and the ride's, derived from the ride itself (timing.js);
 * - the song span the ride covers, and the song: its recording, spectrum, sections, drop and title.
 * A saved ride brings its own song, recording, duration and sections (its compiled case); nothing here reads the spec or the
 * song's current authoring, so a saved ride renders the same whatever they say today. A bare track names its song and is shown
 * over the song's recording, as one section. */
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {repertoireSongs} from '../gallery/repertoire_catalog.ts';
import {DROP_TIMES} from './drops.ts';
import {FPS, alignment, rideTime} from './timing.js';

const ROOT = resolve(import.meta.dirname, '../..');
const SPECTRUM = {fps: 30, bands: 56};

/** A requested impact: its physics frame as compiled, its requested strength, and its authored beat (seconds) when recorded. */
export type Target = {frame: number; impact?: number; beat?: number};
/** A measured impact (scripts/lib/strike_impact.ts), in physics frames: its half-rise onset (where the strike begins: the line
 * struck there gives its direction), its strongest frame (maximum contact acceleration: when the hit happens, round 23), and its
 * strength. */
export type ImpactEvent = {onset: number; peak: number; strength: number};
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
  events: {onset: number; peakFrame: number; strength: number}[]; account: {matches: {target: number; event: number}[]}};
/** A ride: a track, and for a compiled production its trace, impact account, compiled case (its song, recording, duration and
 * sections) and, when recorded, its authored beats, one per target of its account. */
export type Ride = {track: Scene['track']; trace?: Scene['trace']; impactEvaluation?: SavedEvaluation; beats?: number[];
  case?: {id: string; audioPath: string; durationFrames: number; phases: Phase[]}};

/** The ride's impact account as recorded, or null for a bare track. Its matches are in target order, and their strongest frames
 * must be too: the picture scans hits in that order. */
export function rideAccount(ride: Ride): Account | null {
  const e = ride.impactEvaluation;
  if (!e) return null;
  if (ride.beats && ride.beats.length !== e.targets.length) throw new Error(`The ride records ${ride.beats.length} beats for ${e.targets.length} targets`);
  const targets = e.targets.map((t, i) => ({frame: t.frame, ...(t.impact === undefined ? {} : {impact: t.impact}), ...(ride.beats ? {beat: ride.beats[i]} : {})}));
  const events = e.events.map(x => ({onset: x.onset, peak: x.peakFrame, strength: x.strength}));
  const matches = e.account.matches.map(({target, event}) => {
    if (!targets[target] || !events[event]) throw new Error('Saved impact match references a missing target or event');
    return {target, event};
  });
  const inOrder = [...matches].sort((a, b) => a.target - b.target);
  inOrder.forEach((m, i) => {
    if (i && events[m.event].peak < events[inOrder[i - 1].event].peak)
      throw new Error(`The hit answering target ${m.target} peaks before the one answering target ${inOrder[i - 1].target}`);
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

/** The song's recording, repository-relative, as a compile resolves it: productions/<song>/audio.mp3. */
export const songRecording = (song: string) => join('productions', song, 'audio.mp3');

/** The scene of one ride of `song` (a folder of productions/). A saved production is shown over the recording it was compiled
 * and verified against, with its own sections; a bare track over the song's recording, as one section. */
export function buildScene(song: string, ride: Ride): Scene {
  const entry = repertoireSongs.find(s => s.id === song);
  if (!entry) throw new Error(`Unknown song: ${song}`);
  if (ride.case && ride.case.id !== song) throw new Error(`The ride is of ${ride.case.id}, not ${song}`);
  const audio = relative(ROOT, resolve(ROOT, ride.case?.audioPath ?? songRecording(song))), account = rideAccount(ride);
  const end = (ride.case?.durationFrames ?? ride.track.duration) / FPS, timing = alignment(account);
  // the ride must cover what is shown of it: a compiled ride runs past its song (timing.js MAX_OFFSET)
  if (rideTime(end, timing.offset) * FPS > ride.track.duration) throw new Error(`The ride ends before the song it is shown with (${end} s at offset ${timing.offset} s)`);
  const phases = ride.case?.phases.length ? ride.case.phases.map(({name, t0, t1}) => ({name, t0, t1})) : [{name: 'all', t0: 0, t1: end}];
  return {song, title: screenTitle(entry.title), audio, span: [0, end], timing, track: ride.track,
    ...(ride.trace ? {trace: ride.trace} : {}), account, phases, drop: DROP_TIMES[song] ?? null, spectrum: spectrum(resolve(ROOT, audio))};
}
