/**
 * bench-restart (benchmark stratum P5: breaks, drops and re-entries).
 *
 * What it lands. Every stop in the clip, read as the last hit before it, what (if
 * anything) sounds inside it, and the re-entry, pinned:
 *   1. the drums' entry: the intro 808 has died away by 3.4 s; the last vocal chop
 *      phrase starts at 3.913 (touched), and the burst enters at 4.458, pinned 0.95;
 *   2. the breath: the burst stops after 7.755; the voice alone sings at 8.046
 *      (touched lightly); the drop at 9.125 brings drums, bass and synth, pinned 1;
 *   3. the hole: after the 26.180 kick the bass and synth cut for 0.44 s; the groove
 *      re-enters at 26.726 (kick+tom, bass, synth), pinned 1;
 *   4. the fade: the master drops after 43.236; the voice sings 43.897 (touched);
 *      a soft kick and the bass come back once at 44.339, pinned 0.3 (it is soft:
 *      drums 0.27).
 * Between the stops it reads the music plainly: the 808 boom (0.337), the first
 * chop of each intro phrase, every burst kick and every groove kick at its measured
 * loudness.
 *
 * Why. P5 tests whether the rider can stop with the music and come back exactly on
 * the re-entry with the asked strength. The re-entries are the song's structure,
 * so they are pinned; everything else follows measured loudness.
 *
 * Left out on purpose:
 *   - the other intro chops and the breath's faint onsets (rises ≤ 0.12): soft
 *     voice inside a stop; one touch per stop keeps the stop readable;
 *   - the sung "hey" in the hole (26.285): 0.105 s after the 26.180 kick, too close
 *     to land both, and the kick is the last hit before the stop;
 *   - 43.654: the first of two sung notes 0.24 s apart;
 *   - the in-between onsets of the groove (see music.ts).
 *
 * Windows: each stop, from its last landing to its re-entry.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BREATH_START, BREATH_VOICE, BURST, BURST_START, DROP, DURATION, FADE_START, GROOVE_KICKS, HOLE_START,
  INTRO_PHRASE_STARTS, REDROP, SOFT_RETURN, camera, kick, landings, music, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const FADE_NOTE = 43.897;
const VOICE = [...INTRO_PHRASE_STARTS, BREATH_VOICE, FADE_NOTE];

const PINNED = new Map<number, number>([
  [BURST_START, 0.95],
  [DROP, 1],
  [REDROP, 1],
  [SOFT_RETURN, 0.3],
]);

const times = landings([BOOM], VOICE, BURST, GROOVE_KICKS, [SOFT_RETURN]);
const strength = (t: number) => PINNED.get(t) ?? (VOICE.includes(t) ? voiceStrength(t) : kick(t));

export const bench = {
  stratum: "P5" as const,
  pattern: "stops and pinned re-entries",
  windows: [
    [3.85, 4.5],
    [7.7, 9.2],
    [26.15, 26.8],
    [43.2, 44.4],
  ] as [number, number][],
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes([
      { t: 0, v: 0.8, ease: "smooth" },
      { t: BURST_START, v: 0.6, ease: "smooth" },
      { t: BREATH_START, v: 0.85, ease: "hold" }, // the breath: hang
      { t: DROP, v: 0.66, ease: "smooth" },
      { t: 25.6, v: 0.66, ease: "smooth" },
      { t: HOLE_START, v: 0.85, ease: "hold" }, // the hole: hang
      { t: REDROP, v: 0.68, ease: "smooth" },
      { t: FADE_START, v: 0.82, ease: "smooth" },
      { t: DURATION, v: 0.85 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.35, ease: "smooth" },
      { t: 3.9, v: 0.4, ease: "easeIn" },
      { t: BURST_START, v: 0.64, ease: "smooth" },
      { t: BREATH_START, v: 0.45, ease: "easeIn" },
      { t: DROP, v: 0.8, ease: "smooth" },
      { t: 25.6, v: 0.8, ease: "smooth" },
      { t: HOLE_START, v: 0.62, ease: "easeIn" },
      { t: REDROP, v: 0.84, ease: "smooth" },
      { t: FADE_START, v: 0.55, ease: "easeOut" },
      { t: DURATION, v: 0.45 },
    ]),
  },
};

export default spec;
