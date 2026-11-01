/**
 * v7-calm (benchmark stratum P3: calm floats into a slam).
 *
 * This cut has two genuinely quiet stretches, and each ends where the music lands
 * hard. Both are read as floats (high air) into a pinned slam:
 *   1. The intro (0–3.25; mix 0.10–0.39, no drums or bass, against 0.5–1.0 in the
 *      groove). The voice leads over a soft pad, in two legato phrases: A3 0.604
 *      (salience 0.98) sung on to about 2.05, a breath, then D4 2.264 (rise 0.31, the
 *      intro's sharpest attack) sung on into the drums. Each phrase start is a soft
 *      touch (0.14, 0.18 from the vocal rise), each phrase a float: 1.66 s, then
 *      0.99 s into the drums' entry 3.251 (mix 0.12 → 0.96, rise 0.67), pinned 0.95.
 *      The entry is a three-kick cluster: 3.587 and 3.924 follow at measured loudness.
 *   2. The break. After the kick at 24.242 (the loudest kick of the cut, drums 0.85)
 *      the bass, synth and drums stop for a bar; the voice holds one word alone
 *      (mix 0.42–0.49). The kick launches a 1.01 s float into the re-entry 25.252
 *      (kick, bass and synth together), pinned 0.95.
 *
 * The rest is ordinary riding, read by the quarter-note beat: every backbeat snare
 * (beats 1 and 3) and every kick that falls on beats 2 and 4 (a kick 0.667 s from a
 * snare), at measured loudness (kicks 0.56–0.74, snares 0.36–0.48). The gaps are
 * 0.65–0.71 s, 1.28–1.35 s where beat 2 or 4 has no kick. The fill's snare (44.257)
 * ends it.
 *
 * Why. P3 tests a float that ends on a hard, on-time landing, where the music asks
 * for exactly that: the calm is real (no drums, no bass) and the landing is the
 * moment the band arrives. The groove is kept plain so the two slams are this spec's
 * peaks, as they are the music's.
 *
 * Left out on purpose:
 *   - the intro's other words (E4 1.625, D4 1.962, 2.856, 3.053; salience 0.25–0.51):
 *     they continue the two phrases; one touch per phrase keeps the floats floats;
 *   - the pad and breath onsets of the intro (rises ≤ 0.09);
 *   - the off-beat kicks of the groove's runs (e.g. 5.584, 6.246, 7.581, 8.255): they
 *     are audible, but they belong to the dense readings (bench-intense, bench-pairs);
 *     here the groove is the setting, not the test;
 *   - the drop-out at 23.3–23.6 (bass pickup 23.591, word 23.766): a 0.65 s hole
 *     between beat hits, read as a stop in v7-breaks; here it is ridden over;
 *   - the held word in the break (24.300, 0.058 s after the 24.242 kick) and its tail
 *     onsets (24.706, 24.950; rises ≤ 0.12): the float is over them;
 *   - the exposed words in the drum rests (4.795, 10.275, 15.604, 23.766): the
 *     groove is read by its beat (the words belong to bench-words).
 *
 * Windows: the intro from the first touch to the slam; the break from its last kick
 * to the re-entry.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_LAST, DRUMS_IN, DURATION, ENTRY_CLUSTER, KICKS, REENTRY, SNARES, camera, drum, landings, music, preroll,
  start, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

/** The intro's two phrase starts (sung.json: A3 0.604, D4 2.264). */
const PHRASES = [0.604, 2.264];
/** Kicks on beats 2 and 4: one beat (0.667 s) from a backbeat snare. */
const BEAT_KICKS = KICKS.filter((k) => SNARES.some((s) => Math.abs(Math.abs(k - s) - 0.667) < 0.06));
const BEAT = [...SNARES, ...BEAT_KICKS];
const SLAMS: Record<string, number> = { [DRUMS_IN]: 0.95, [REENTRY]: 0.95 };

const times = landings(PHRASES, ENTRY_CLUSTER, BEAT, [BREAK_LAST]);
const strength = (t: number) =>
  SLAMS[t] ?? (PHRASES.includes(t) ? Number(voiceStrength(t, 0.06, 0.4).toFixed(3)) : drum(t));

export const bench = {
  stratum: "P3" as const,
  pattern: "calm floats into a slam",
  windows: [[0.55, 3.3], [24.19, 25.3]] as [number, number][],
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  start,
  preroll,
  axes: {
    air: keyframes([
      { t: 0, v: 0.9, ease: "hold" }, // the intro: two floats
      { t: DRUMS_IN, v: 0.5, ease: "hold" }, // the entry cluster
      { t: ENTRY_CLUSTER[2], v: 0.6, ease: "hold" }, // the groove
      { t: BREAK_LAST, v: 0.92, ease: "hold" }, // the break: float
      { t: REENTRY, v: 0.6, ease: "hold" },
      { t: DURATION, v: 0.6 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.4, ease: "smooth" },
      { t: PHRASES[1], v: 0.5, ease: "hold" },
      { t: DRUMS_IN, v: 0.75, ease: "smooth" },
      { t: 16.5, v: 0.8, ease: "hold" },
      { t: BREAK_LAST, v: 0.65, ease: "hold" }, // the break: calmer
      { t: REENTRY, v: 0.85, ease: "smooth" },
      { t: DURATION, v: 0.8 },
    ]),
  },
};

export default spec;
