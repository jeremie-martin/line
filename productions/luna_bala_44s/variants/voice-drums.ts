/** Luna Bala · voice-drums: rewritten from scratch from the measured layers (2026-11-14).
 *
 * Two songs in one: a legato voice alone for 8.6 s, then a flat, loud four-on-the-floor to the end.
 * The reading gives each its own motion and makes the few things that break the pattern count.
 *
 *   0.4–3.5    The voice, phrase 1: every sung word, the phrase starts a little firmer. (The very
 *              first word, 0.17 s in, is too early for any ride; the ride starts on the second.)
 *   3.5–4.5    The voice stops dead for a second: a float.
 *   4.5–8.6    Phrase 2 re-enters on its strongest note with the intro's only close words
 *              (0.17–0.41 s apart), then a word every half second, gaining speed into the drop.
 *   8.6        The drop: the hardest landing.
 *   8.6–23.9   Body A. Every kick (0.545 s apart), the bar's downbeat firmer. Between kicks, the
 *              off-beat: on every half-beat where a chord stab, a bass note, a tom or a snare
 *              sounds: the measured off-beats, plus the few held chords and bass notes that sit on
 *              the half-beat itself. About a third of the half-beats stay empty, as in the music. The kick-triplet
 *              fills every sixteen kicks are the bar's event: firmer, into a hard downbeat.
 *   23.9–26.1  The tom break. Bass and voice drop out; four tom hits stand alone, as loud as any
 *              kick, so they land hard, out of the space between them (the quiet chord pulse there is
 *              not landed), with more air.
 *   26.1       The re-entry.
 *   26.1–43.0  Body B: as body A, a step firmer and faster.
 *   43.0–44.0  The music collapses to silence after the last kick: a ride-out, low air held to
 *              the end, not a jump.
 *
 * Not landed on: the first word (0.174); note-internal pitch moves of the voice; the kick's own
 * click in the mix; decaying kick tails. Every time is a measured event (music.ts fails otherwise).
 * Not heard by the author. Compiler feasibility is not a filter.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import * as m from '../music.ts';
export {overlayMeta} from '../music.ts';

/** Half-beats that sound at 0.3 or more without a sharp attack, left out of music.ts's OFFBEATS: held chords and bass
 *  notes. Only those on the half-beat itself: the first draft also took five sounds 0.13–0.17 s before a kick, which blur
 *  into it, and three that music.ts names as swells or kick tails (review, 2026-11-14). */
const HELD_OFFBEATS = [10.008, 29.06, 37.802, 42.144, 42.69];
/** The tom break: the three tom hits after its downbeat. */
const BREAK_TOMS = [24.416, 24.961, 25.507];

const B = (t: number) => t > m.REENTRY ? 0.04 : 0;
const fillKicks = m.FILLS.map(f => f[0]), fillDownbeats = m.FILLS.map(f => f[2]);
const layer = (times: number[], impact: number | ((t: number) => number)) => times.map(t => ({t, impact: typeof impact === 'number' ? impact : impact(t)}));
const kicks = m.KICKS.filter(t => t !== m.DROP && t !== m.REENTRY && !BREAK_TOMS.includes(t) && t !== m.LAST_KICK);

const authored = [
  ...layer(m.WORDS, t => t === m.VOICE_REENTRY ? 0.58 : m.PHRASES.includes(t) ? 0.52 : 0.42),
  {t: m.DROP, impact: 1},
  ...layer(kicks, t => (fillDownbeats.includes(t) ? 0.90 : m.DOWNBEATS.includes(t) ? 0.86 : fillKicks.includes(t) ? 0.74 : 0.70) + (fillDownbeats.includes(t) ? 0 : B(t))),
  ...layer(m.FILL_OFFBEATS, 0.66),
  ...layer(m.OFFBEATS, t => 0.48 + B(t)),
  ...layer(HELD_OFFBEATS, t => 0.40 + B(t)),
  ...layer(BREAK_TOMS, 0.85),
  {t: m.REENTRY, impact: 0.95},
  {t: m.LAST_KICK, impact: 0.85},
];
for (const {t} of authored) m.event(t); // every landing is a measured event

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: {zoom: {smoothingFrames: 8, keyframes: m.zoom}},
  contacts: beats(authored.sort((a, b) => a.t - b.t)),
  axes: {
    air: keyframes(m.kf([
      [0, 0.55], [3.3, 0.60], [3.6, 0.86], [4.3, 0.70], [m.VOICE_REENTRY, 0.55], [8.1, 0.60], [m.DROP, 0.48], [23.6, 0.48], [m.BREAK_IN, 0.78],
      [25.8, 0.70], [m.REENTRY, 0.48], [42.6, 0.46], [m.LAST_KICK, 0.25], [43.3, 0.14], [m.DURATION, 0.12],
    ])),
    speed: keyframes(m.kf([
      [0, 0.44], [3.5, 0.44], [m.VOICE_REENTRY, 0.48], [8.2, 0.62], [m.DROP, 0.78], [23.6, 0.78], [m.BREAK_IN, 0.70], [m.REENTRY, 0.84],
      [42.4, 0.84], [43.2, 0.50], [m.DURATION, 0.30],
    ])),
  },
};
export default spec;
