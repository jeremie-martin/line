/** L'amour de ma vie · drums-voice: rewritten from scratch from the measured layers (2026-11-14).
 *
 * The song is its drum pattern: runs of three to seven hits a third of a second apart, cut by
 * rests of two thirds of a second to a full second. Nothing sounds in most of those rests. The
 * reading lands the whole pattern and makes the rests visible, instead of filling them.
 *
 *   0.6–3.1    The voice over a pad: the first word, then the fast run of five (0.20–0.34 s apart),
 *              faster and faster, straight into the drums; the pad's one clear attack between them.
 *   3.25       The drums enter with three kicks; the first, the arrival, is the hardest of the three.
 *   3.3–24.2   The groove. Every kick and every snare (the first spec missed 24 of the 90 drum
 *              hits and put 18 landings where nothing sounds). Strength follows the pattern, not a
 *              flat maximum: kicks firm, the kick that ends a run before a long rest firmer (it
 *              launches the rest), snares under the kicks, a snare with a sung word right on it a
 *              step up. The words alone in a rest land on their own; the bass note at 23.59 leads
 *              back in to its kick. Each long rest (about a second) is a small float.
 *   24.2–25.3  The break: the kick, the held word on top of it, a bar of air, the re-entry.
 *   25.3–44.3  Groove 2: the same pattern, a step firmer and faster (the loudest stretch).
 *   44.26      The fill's first snare; the cut ends 0.29 s later, mid-fill, so there is no
 *              ride-out to ask for here: the last landing is the end.
 *
 * Not landed on: hats; sung notes within 0.1 s of a drum hit (the drum hit is the landing); the
 * pad and breath onsets of the intro; the held word's tail. Every time is a measured event.
 * Not heard by the author. Compiler feasibility is not a filter.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes, type Keyframe} from '../../../scripts/v0/core/curves.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import * as m from '../music.ts';
export {overlayMeta} from '../music.ts';

/** The pad's attack, alone in a one-second gap of the intro ("other" 0.38, the loudest attack before the drums). */
const PAD = 1.231;
const hits = m.DRUM_HITS.filter(t => t !== m.FLAM_SECOND);
const next = (t: number) => hits[hits.indexOf(t) + 1] ?? m.DURATION;
/** A rest: at least 0.9 s to the next drum hit. */
const RESTS = hits.filter(t => next(t) - t >= 0.9 && t < m.FILL).map(t => [t, next(t)]);
const endsRun = (t: number) => RESTS.some(([a]) => a === t);
/** A sung word within 0.1 s after a drum hit: one landing, on the drum, a step firmer. */
const sungOn = (t: number) => m.sungNotes(0.3).some(w => w - t > -0.02 && w - t < 0.1);
const G2 = (t: number) => t >= m.REENTRY ? 0.04 : 0;

/** A kick by its measured loudness (drum stem 0.62–0.85), around the pattern's level. */
const loud = (t: number) => 0.5 * ((m.event(t).sources.drums?.peak ?? 0.74) - 0.74);
const kick = (t: number) => Number(m.clamp((endsRun(t) ? 0.80 : 0.72) + loud(t) + G2(t), 0.55, 0.9).toFixed(2));
const snare = (t: number) => (sungOn(t) ? 0.62 : 0.56) + G2(t);
const PINNED: Record<number, number> = {3.251: 0.90, 3.587: 0.72, 3.924: 0.78, [m.BREAK_LAST]: 0.80, [m.REENTRY]: 0.95, 23.905: 0.82, [m.FILL]: 0.70};

const authored = [
  ...m.INTRO_WORDS.map((t, i) => ({t, impact: [0.44, 0.40, 0.44, 0.48, 0.40, 0.42][i]})),
  {t: PAD, impact: 0.40},
  ...m.KICKS.map(t => ({t, impact: PINNED[t] ?? kick(t)})),
  ...m.SNARES.map(t => ({t, impact: PINNED[t] ?? snare(t)})),
  ...m.EXPOSED_WORDS.map(t => ({t, impact: 0.48})),
  {t: m.BASS_PICKUP, impact: 0.50},
];
for (const {t} of authored) m.event(t); // every landing is a measured event

const smooth = (t: number, v: number): Keyframe => ({t, v, ease: 'smooth'});
/** Low rides inside the runs; a small float in each long rest; the break's bar of air. */
const air = keyframes([
  smooth(0, 0.55), smooth(m.DRUMS_IN, 0.46),
  ...RESTS.flatMap(([a, b]) => b === m.REENTRY ? [smooth(a + 0.05, 0.60), smooth((a + b) / 2, 0.86), smooth(b - 0.05, 0.60)] : [smooth(a + 0.05, 0.50), smooth((a + b) / 2, 0.70), smooth(b - 0.05, 0.50)]),
  smooth(m.DURATION, 0.46),
].sort((p, q) => p.t - q.t));
const speed = keyframes([
  smooth(0, 0.46), smooth(1.6, 0.52), smooth(m.DRUMS_IN, 0.70), smooth(17, 0.74), smooth(m.BREAK_START, 0.60), smooth(m.REENTRY, 0.82), smooth(m.DURATION, 0.82),
]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  contacts: beats(authored.sort((a, b) => a.t - b.t)),
  axes: {air, speed},
};
export default spec;
