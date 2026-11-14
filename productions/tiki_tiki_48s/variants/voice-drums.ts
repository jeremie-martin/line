/** Tiki Tiki · voice-drums: rewritten from scratch from the measured layers (2026-11-14).
 *
 * The song is slow and spacious (69 BPM, a kick every 0.87 s), and it is framed by a voice alone:
 * the reading keeps that shape instead of filling it.
 *
 *   0.0–4.9    The solo voice. Every word lands, gently but plainly (a quiet voice alone is the
 *              whole music): five words, then the five-word motif 0.26–0.30 s apart, rising.
 *   4.9–7.0    Silence: the one long float.
 *   7.0–10.5   The breathy words, each a little firmer and faster; the two loud notes in the drum
 *              cut; then the drop, the hardest landing.
 *   10.5–24.4  The groove. Every kick, with the downbeat firmer; the backbeat snare after beats 1
 *              and 2; the pickup snare 0.22 s before each downbeat ("ta-BOOM"). On top, what makes
 *              each bar different, which the first spec could not ask for:
 *                - the two words that run into beat 3, 0.2 s apart (the first shares the backbeat);
 *                - the syllable 0.21 s before the pickup, making three in a row into the downbeat;
 *                - the hook after beat 3, the extra kick, the chord stabs of the third bar;
 *                - the one bass note that walks up to the first hook.
 *   24.4–27.9  The boom, and the beat goes on under it: two softer booms a beat apart (25.25, 26.12;
 *              drum stem 0.35 and 0.31, slow attacks, no drum class), then the three murmured
 *              syllables, lightly, and the re-entry. The first draft floated over this passage and
 *              landed neither boom: the owner asked why (they are on the beat, and heard).
 *   27.9–39.2  The run: the groove again and the loudest stretch, so everything a little firmer
 *              and faster.
 *   39.2–41.8  The bar breaks: the weak snare, three kicks, the last soft kick.
 *   41.8–48.0  The voice alone again: its words, the motif, the faint last syllable at 46.92,
 *              and then a ride-out: low air held to the end, the rider slowing on the line.
 *
 * Not landed on: hats; bass notes within 0.14 s of a drum hit (they blur into it); vocal estimates
 * with no clear attack. Every time is a measured event (music.ts fails on one that is not).
 * Not heard by the author. Compiler feasibility is not a filter.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import * as m from '../music.ts';
export {overlayMeta} from '../music.ts';

const RUN = (t: number) => t >= m.REENTRY && t < m.RUN_END ? 0.06 : 0;
const layer = (times: number[], impact: number | ((t: number, i: number) => number)) =>
  times.map((t, i) => ({t, impact: typeof impact === 'number' ? impact : impact(t, i)}));

/** The second of the two words that run into beat 3 (the first, 0.06 s after the backbeat, shares it). */
const WORDS_INTO_3 = [12.875, 16.358, 30.279, 33.762];
/** The syllable 0.21 s before a pickup snare: with the pickup and the downbeat, three in a row. */
const BEFORE_PICKUP = [14.396, 17.868, 31.788, 35.26];
/** The chord stabs of the groove's third bar ("other" 0.29–0.51), the song's only chords in front. */
const STABS = [19.841, m.STAB, 22.895, 23.324];
/** The one bass note heard on its own, clear of any drum hit or word: the walk up to the first hook. */
const BASS = [13.351];
/** Voice in the run's last bar, between the kicks (vocals 0.29). */
const RUN_WORDS = [38.731];
const EXTRA_KICKS = [16.985, 34.377];
/** The boom's two softer repeats, a beat apart; the swell's first tick; the backbeat inside the run's end. */
const AFTER_BOOM = [25.252, 26.122], SWELL_START = 8.731, RUN_END_BACKBEAT = 40.054;
const kicks = m.KICKS.filter(t => t !== m.DROP && t !== m.REENTRY);

const authored = [
  // the solo voice
  ...layer(m.INTRO_WORDS, (_, i) => [0.34, 0.36, 0.42, 0.36, 0.38][i]),
  ...layer(m.INTRO_RUN, (_, i) => 0.36 + 0.03 * i),
  {t: m.INTRO_TAIL, impact: 0.22},
  // the build and the cut
  ...layer(m.BUILD_WORDS, (_, i) => 0.30 + 0.04 * i),
  ...layer(m.CUT_WORDS, (_, i) => [0.50, 0.56][i]),
  {t: m.DROP, impact: 1},
  // groove and run
  ...layer(kicks, t => (m.DOWNBEATS.includes(t) ? 0.86 : EXTRA_KICKS.includes(t) ? 0.66 : t >= m.RUN_END ? (t === m.LAST_DRUM ? 0.55 : 0.68) : 0.72) + RUN(t)),
  ...layer(m.PICKUPS, t => 0.55 + RUN(t)),
  ...layer(m.BACKBEATS, t => t === m.RUN_END ? 0.36 : 0.50 + RUN(t)),
  ...layer(WORDS_INTO_3, 0.50),
  ...layer(BEFORE_PICKUP, 0.42),
  ...layer(m.HOOKS, 0.56),
  ...layer(STABS, t => t === m.STAB ? 0.56 : 0.44),
  ...layer(BASS, 0.36),
  ...layer(RUN_WORDS, 0.42),
  // the boom and the reset
  {t: m.BOOM, impact: 0.9},
  ...layer(AFTER_BOOM, (_, i) => [0.56, 0.50][i]),
  {t: SWELL_START, impact: 0.30},
  {t: RUN_END_BACKBEAT, impact: 0.45},
  ...layer(m.RESET_WORDS, (_, i) => 0.22 + 0.03 * i),
  {t: m.REENTRY, impact: 0.95},
  // the voice alone again
  ...layer(m.OUTRO_WORDS, (_, i) => [0.30, 0.36, 0.32, 0.30][i]),
  ...layer(m.OUTRO_RUN, (_, i) => 0.30 + 0.02 * i),
  {t: 46.916, impact: 0.2},
];
for (const {t} of authored) m.event(t); // every landing is a measured event

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: {zoom: {smoothingFrames: 8, keyframes: m.zoom}},
  contacts: beats(authored.sort((a, b) => a.t - b.t)),
  axes: {
    // one float, where the music is empty (the silence at 4.9 s); a ride-out at the end
    air: keyframes(m.kf([
      [0, 0.50], [4.5, 0.55], [m.SILENCE_T0, 0.88], [6.8, 0.60], [9.5, 0.55], [m.DROP, 0.52], [24.0, 0.52], [m.BOOM, 0.62], [26.3, 0.60],
      [m.REENTRY, 0.50], [m.LAST_DRUM, 0.52], [42.6, 0.50], [46.2, 0.40], [46.9, 0.15], [m.DURATION, 0.12],
    ])),
    speed: keyframes(m.kf([
      [0, 0.42], [m.SILENCE_T0, 0.40], [m.BUILD, 0.46], [9.9, 0.62], [m.DROP, 0.74], [24.0, 0.74], [m.BOOM, 0.55], [26.4, 0.50],
      [m.REENTRY, 0.86], [38.4, 0.84], [m.LAST_DRUM, 0.58], [42.6, 0.44], [46.9, 0.36], [m.DURATION, 0.28],
    ])),
  },
};
export default spec;
