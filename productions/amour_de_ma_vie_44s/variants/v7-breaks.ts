/**
 * v7-breaks (benchmark stratum P5: breaks, drops and re-entries).
 *
 * The first groove (3.25–24.3) is built in two-bar phrases (5.33 s), and each phrase
 * ends in a stop: after a lone backbeat snare, the bass AND the drums stop for about
 * 0.65 s (mix 0.17–0.33; bass ≤ 0.06, drums ≤ 0.02 in their stems), only the voice is
 * heard, then kick and bass come back together on the next beat. Then the band drops
 * out once more, and stops for a whole bar. This spec reads every stop as the last
 * hit before it, nothing inside, and the re-entry:
 *   1. 4.586 → 5.236 (the voice answers alone, G♯3 4.795);
 *   2. 9.915 → 10.577 (the quietest moment of the groove, mix 0.17; C♯4 10.275);
 *   3. 15.267 → 15.917 (C♯4 15.604);
 *   4. 20.596 → 21.258 (the band stops under the hook's held G4);
 *   5. the drop-out: 23.255 → 23.591, where the bass alone leads back in (bass rise
 *      0.39, landed at the bass's loudness, 0.36), then the kick 23.905;
 *   6. the break: the last kick 24.242 (drums 0.85, the loudest of the cut), a bar of
 *      the voice alone (mix 0.42–0.49), and the re-entry 25.252 (kick, bass and synth
 *      together), pinned 0.95.
 * The re-entry kicks of stops 1–4 are not louder than other kicks (mix rise 0.52–0.83,
 * drums 0.74–0.80), so they keep their measured strength (0.66–0.72).
 *
 * Around the stops: the voice intro by its two phrase starts (0.604, 2.264; soft
 * touches), the drums' entry (3.251, 3.587, 3.924), then in the first groove every
 * kick and snare, so the rider is driven by the runs (0.31–0.38 s apart) right up to
 * each stop. The second groove (25.25–44.26) has no stops (the bass plays through
 * every drum rest), so it is read lightly, by the quarter-note beat (backbeat snares
 * and the kicks on beats 2 and 4), to the fill's snare (44.257).
 *
 * Why. P5 tests whether the rider can stop being driven when the band stops and come
 * back exactly on the re-entry. Here the stops are short and many (a phrase ending
 * every 5.33 s), plus one bar-long break: six chances per ride.
 *
 * Left out on purpose:
 *   - the words sung alone in stops 1–3 (4.795, 10.275, 15.604; salience 0.96–0.98)
 *     and the drop-out's word (23.766): audible, but the band's stop is the reading;
 *     a landing inside would turn each stop into a pair (that is bench-pairs and
 *     bench-words). 23.766 is also 0.139 s before the 23.905 kick;
 *   - the held word in the break (24.300: 0.058 s after the 24.242 kick) and its tail
 *     onsets (24.706, 24.950; rises ≤ 0.12);
 *   - the drum rests of 1.0 s in the first groove (6.246 → 7.245, 11.587 → 12.574,
 *     16.904 → 17.868, 22.256 → 23.255) are not stops: the bass plays through them;
 *   - the off-beat kicks of the second groove (its runs are bench-intense's window);
 *   - the intro's other words (1.625–3.053): one touch per phrase.
 *
 * Windows: each stop, from its last hit to its re-entry (±0.05 s).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes, type Keyframe } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BASS_PICKUP, BREAK_LAST, DRUMS_IN, DRUM_HITS, DURATION, ENTRY_CLUSTER, KICKS, REENTRY, SNARES, bass, camera, drum,
  landings, music, preroll, start, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

/** The intro's two phrase starts (sung.json: A3 0.604, D4 2.264). */
const PHRASES = [0.604, 2.264];
/** Stops 1–4: the lone snare, then the re-entry kick with the bass. */
const STOPS: [number, number][] = [[4.586, 5.236], [9.915, 10.577], [15.267, 15.917], [20.596, 21.258]];
const DROPOUT: [number, number] = [23.255, BASS_PICKUP];
const BREAK: [number, number] = [BREAK_LAST, REENTRY];

const GROOVE_1 = DRUM_HITS.filter((t) => t >= DRUMS_IN && t <= BREAK_LAST);
/** Second groove, by the beat: backbeat snares and the kicks one beat (0.667 s) from one. */
const BEAT_KICKS = KICKS.filter((k) => SNARES.some((s) => Math.abs(Math.abs(k - s) - 0.667) < 0.06));
const GROOVE_2 = [...SNARES, ...BEAT_KICKS].filter((t) => t >= REENTRY);

const times = landings(PHRASES, ENTRY_CLUSTER, GROOVE_1, [BASS_PICKUP], GROOVE_2);
const strength = (t: number) =>
  t === REENTRY ? 0.95
  : t === BASS_PICKUP ? bass(t)
  : PHRASES.includes(t) ? Number(voiceStrength(t, 0.06, 0.4).toFixed(3))
  : drum(t);

const pad = ([a, b]: [number, number]): [number, number] => [Number((a - 0.05).toFixed(3)), Number((b + 0.05).toFixed(3))];
export const bench = {
  stratum: "P5" as const,
  pattern: "breaks, drops and re-entries",
  windows: [...STOPS, DROPOUT, BREAK].map(pad),
};

/** Air: hang in every stop (step at its last hit, back at its re-entry). */
const stopAir = [...STOPS, DROPOUT, BREAK].flatMap(([a, b]): Keyframe[] => [
  { t: a, v: a === BREAK_LAST ? 0.88 : 0.82, ease: "hold" },
  { t: b, v: b === REENTRY ? 0.55 : 0.45, ease: "hold" },
]);

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  start,
  preroll,
  axes: {
    air: keyframes([
      { t: 0, v: 0.75, ease: "hold" }, // the voice intro
      { t: DRUMS_IN, v: 0.45, ease: "hold" }, // the first groove: driven, low arcs
      ...stopAir,
      { t: DURATION, v: 0.55 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.45, ease: "smooth" },
      { t: DRUMS_IN, v: 0.85, ease: "hold" }, // driven
      { t: BREAK_LAST, v: 0.62, ease: "hold" }, // the break: let go
      { t: REENTRY, v: 0.9, ease: "smooth" },
      { t: DURATION, v: 0.82 },
    ]),
  },
};

export default spec;
