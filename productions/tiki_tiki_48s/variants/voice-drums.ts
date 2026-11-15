/** Tiki Tiki · voice-drums: rewritten from scratch from the measured layers (2026-11-14).
 *
 * The song is slow and spacious (69 BPM, a kick every 0.87 s), and it is framed by a voice alone:
 * the reading keeps that shape instead of filling it.
 *
 *   0.0–7.0    The solo voice, before any music: every word is touched at about 0.1, no more (the
 *              owner's wish for this song, not a rule): five words, the five-word motif 0.26–0.30 s
 *              apart, then silence with one breath at 5.27, touched too. The ride floats around it.
 *   7.0–10.5   The build. The beat is already there under the breathy words: the words on it are
 *              firmer, the words between lighter, each pair a step up, into the drop, the hardest
 *              landing of the song.
 *   10.5–24.4  The groove. Every kick; every fourth beat from the drop is a fat, heavy hit and lands far
 *              harder than the ordinary kicks around it; the backbeat snare after beats 1
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
 *   27.9–39.2  The run: the groove again and the loudest stretch, a step above the groove.
 *   39.2–41.8  The bar breaks: the weak snare, then the last four kicks, alone as the voice goes
 *              down: very strong, the second peak of the song.
 *   41.8–48.0  The voice alone again, as at the start: only the voice, touched at about 0.1, to its
 *              last note at 47.32; low air held to the end, the rider slowing on the line.
 *
 * Not landed on: hats; bass notes within 0.14 s of a drum hit (they blur into it); vocal estimates
 * with no clear attack. Every time is a measured event (music.ts fails on one that is not), except
 * the breath at 5.27 and the last note at 47.32, which only sung.json measures; 46.92 is nearly silent.
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
const BEFORE_PICKUP = [14.396, 17.868, 28.317, 31.788, 35.26];
/** The chord stabs of the groove's third bar ("other" 0.29–0.51), the song's only chords in front. */
const STABS = [19.841, m.STAB, 22.895, 23.324];
const STAB_STRENGTH: Record<number, number> = {19.841: 0.50, [m.STAB]: 0.62, 22.895: 0.50, 23.324: 0.52};
/** Notes of the instrumental line the owner marked and the first drafts left out (soft attacks in the "other" stem), and
 *  three more he named: before the first pickup, in the stab bars, in the run's end, and two faint ones in the outro. */
const LINE_EXTRA = [10.913, 21.351, 23.975, 38.975, 41.366, 42.237, 46.602];
const LINE_STRENGTH: Record<number, number> = {10.913: 0.40, 21.351: 0.46, 23.975: 0.42, 38.975: 0.42, 41.366: 0.38, 42.237: 0.10, 46.602: 0.06};
/** The one bass note heard on its own, clear of any drum hit or word: the walk up to the first hook. */
const BASS = [13.351];
/** Voice in the run's last bar, between the kicks (vocals 0.29). */
const RUN_WORDS = [38.731];
/** The run's last bar fills the slot after beat 3 with a bass note and a drum tick (bass 0.31, mix rise 0.20). */
const RUN_SLOT = 37.222;
/** Two sounds of the voice that sung.json measures and events.json does not list: a breath in the silence (unpitched, vocals
 *  0.06; the owner hears it at about 5.27) and the last sung note (F♯4, salience 0.48). */
const BREATH = 5.271, LAST_NOTE = 47.322;
/** The boom's two softer repeats, a beat apart; the swell's first tick; the backbeat inside the run's end. */
const AFTER_BOOM = [25.252, 26.122], SWELL_START = 8.731, RUN_END_BACKBEAT = 40.054;
const kicks = m.KICKS.filter(t => t !== m.DROP && t !== m.REENTRY);
const fail = (t: number): never => {throw new Error(`no strength for the kick at ${t}`);};
/** Every kick's strength, chosen one by one, in two families the owner hears (2026-11-14, his "impact" marks).
 *  - The fat ones: a heavy, not-sharp hit every four beats counted from the drop (13.96, 17.43, 20.94; 31.35, 34.82,
 *    38.30; the drop and the re-entry are two more), the kick half a beat before it where there is one (16.99, 34.38),
 *    and the last four kicks. These carry the song: 0.90 and up, rising through each half, the very last the highest
 *    after the drop. In the data they show as a full-level mix peak with a soft attack, four of them with no drum onset.
 *  - The others: strong but ordinary, deliberately a clear step below (0.60–0.70; a little more in the run), the
 *    sharpest attacks (15.69, 22.64) one notch up. The kick before the fat pair (16.56, 33.95) sits between, at 0.8.
 *  The boom at 24.38 falls on a fat slot but is quiet in the song, and stays discreet. */
const KICK: Record<number, number> = {
  11.343: 0.66, 12.214: 0.62, 13.073: 0.62, 13.955: 0.90,
  14.826: 0.66, 15.685: 0.68, 16.556: 0.80, 16.985: 0.84, 17.427: 0.92,
  18.297: 0.66, 19.168: 0.64, 20.039: 0.64, 20.944: 0.94,
  21.78: 0.68, 22.639: 0.70, 23.51: 0.64,
  28.735: 0.70, 29.605: 0.66, 30.476: 0.66, 31.347: 0.92,
  32.218: 0.70, 33.077: 0.70, 33.948: 0.80, 34.377: 0.84, 34.818: 0.92,
  35.689: 0.70, 36.56: 0.68, 37.431: 0.68, 38.301: 0.95,
  39.602: 0.92, 40.472: 0.94, 40.902: 0.92, 41.784: 0.98,
};

const authored = [
  // the solo voice: barely touched (the owner: about 0.1 until there is music, at 7 s)
  ...layer(m.INTRO_WORDS, 0.10),
  ...layer(m.INTRO_RUN, (_, i) => 0.08 + 0.01 * i),
  {t: m.INTRO_TAIL, impact: 0.06},
  {t: BREATH, impact: 0.08},
  // the build and the cut: the beat already runs under the voice (0.87 s back from the drop: 7.00, 7.87, 8.73, 9.6), so the
  // words on it are firmer than the words between, each pair a step up (the owner heard it; two carry a faint drum tick)
  {t: 7.001, impact: 0.34}, {t: 7.372, impact: 0.18}, {t: 7.872, impact: 0.40}, {t: 8.243, impact: 0.22},
  {t: SWELL_START, impact: 0.46}, {t: 9.102, impact: 0.26}, {t: 9.66, impact: 0.54}, {t: 9.961, impact: 0.30},
  {t: m.DROP, impact: 1},
  // groove and run
  ...layer(kicks, t => KICK[t] ?? fail(t)),
  ...layer(m.PICKUPS, t => 0.54 + RUN(t)),
  ...layer(m.BACKBEATS, t => t === m.RUN_END ? 0.42 : 0.48 + RUN(t)),
  ...layer(WORDS_INTO_3, 0.50),
  ...layer(BEFORE_PICKUP, 0.42),
  ...layer(m.HOOKS, 0.56),
  ...layer(STABS, t => STAB_STRENGTH[t]),
  ...layer(LINE_EXTRA, t => LINE_STRENGTH[t]),
  ...layer(BASS, 0.36),
  ...layer(RUN_WORDS, 0.42),
  {t: RUN_SLOT, impact: 0.46},
  // the boom and the reset
  {t: m.BOOM, impact: 0.55}, // the owner: quite discreet (the mix agrees: 0.62, attack 0.16, against 1.0 and 0.7 for a kick)
  ...layer(AFTER_BOOM, (_, i) => [0.40, 0.36][i]),
  {t: RUN_END_BACKBEAT, impact: 0.34},
  ...layer(m.RESET_WORDS, (_, i) => 0.16 + 0.02 * i),
  {t: 27.458, impact: 0.12}, // one more syllable before the re-entry, very small
  {t: m.REENTRY, impact: 0.95},
  // the voice alone again, as at the start: only the voice, barely touched
  ...layer(m.OUTRO_WORDS, 0.10),
  ...layer(m.OUTRO_RUN, (_, i) => 0.12 - 0.01 * i),
  {t: 46.916, impact: 0.06},
  {t: LAST_NOTE, impact: 0.06},
];
for (const {t} of authored) if (t !== BREATH && t !== LAST_NOTE) m.event(t); // every landing is a measured event

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  contacts: beats(authored.sort((a, b) => a.t - b.t)),
  axes: {
    // Air is how far the rider leaves the line, and follows how much room the music leaves between its sounds:
    // one float in the silence at 4.9 s; a leap into the drop; an even bounce through the groove and the run, where a
    // kick or a snare comes every third of a second; longer flights after the boom and between the last four fat kicks,
    // which stand alone; then down onto the line for the voice's last words, a ride-out.
    air: keyframes(m.kf([
      [0, 0.50], [4.5, 0.55], [m.SILENCE_T0, 0.70], [5.4, 0.88], [6.8, 0.60], [9.5, 0.55], [9.95, 0.58], [10.25, 0.74], [m.DROP, 0.54],
      [24.0, 0.54], [m.BOOM, 0.64], [26.3, 0.62], [m.REENTRY, 0.52], [38.4, 0.52], [39.3, 0.66], [m.LAST_DRUM, 0.66],
      [42.6, 0.46], [46.2, 0.36], [46.9, 0.18], [m.DURATION, 0.12],
    ])),
    // Speed is the song's drive, and where the hardest hits are the rider must be fastest: slow under the lone voice,
    // gathering through the build, fast in the groove and faster toward its fat last bars, held back in the reset, then
    // the run, climbing to the song's top speed for the last four fat kicks. It only starts to drop at the third of them
    // (40.9, the owner's limit), is still fast at the last, and falls away under the voice.
    speed: keyframes(m.kf([
      [0, 0.38], [m.SILENCE_T0, 0.36], [m.BUILD, 0.44], [9.9, 0.64], [m.DROP, 0.76], [20.0, 0.80], [24.0, 0.80], [m.BOOM, 0.56], [26.4, 0.50],
      [27.6, 0.56], [m.REENTRY, 0.86], [38.3, 0.92], [39.6, 0.96], [40.9, 0.96], [m.LAST_DRUM, 0.84], [43.0, 0.46], [46.9, 0.34], [m.DURATION, 0.26],
    ])),
  },
};
export default spec;
