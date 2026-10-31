/**
 * bench-calm (benchmark stratum P3: calm floats into a slam).
 *
 * What it lands. The two genuinely quiet stretches of the clip are each ridden as
 * one long, high float that ends on the clip's strongest hits:
 *   - the soft intro: the 808 boom (0.337) and the first chop of the first two
 *     vocal phrases (0.894, 2.554), then a 1.90 s float over the quietest music of
 *     the clip (mix 0.31) into the burst's first kick, 4.458, the loudest hit
 *     (drums 0.98), pinned 0.95;
 *   - the breath: from the burst's last kick (7.755) a 1.37 s float over the voice
 *     alone (mix 0.32–0.41) into the drop, 9.125, pinned 1.
 * The rest is a plain reading of the music: every burst kick (including 4.725,
 * 0.267 s after the slam, because it is plainly heard), every groove kick at its
 * measured loudness, the re-drop after the hole (26.726, pinned 0.9), and in the
 * fade the sung C♯4 (43.897) and the soft return (44.339).
 *
 * Why. P3 tests whether the rider can hold a long, high float where the music is
 * quiet and still arrive hard on time. Both floats here are the music's own
 * quiet; the hits they end on are the two loudest entries of the clip.
 *
 * Left out on purpose:
 *   - the intro chops 1.138–1.683, 3.100, 3.367, 3.913, 4.180 and the breath's faint
 *     onsets (7.930–8.870, including the clear 8.046): soft voice under a float;
 *     landing them would cut the float that the quiet asks for;
 *   - the sung "hey" in the hole (26.285): 0.105 s after the 26.180 kick;
 *   - 43.654: the first of two sung notes 0.24 s apart; the clearer 43.897 is landed;
 *   - the in-between onsets of the groove (see music.ts).
 *
 * Windows: each float with the hit that ends it.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BREATH_START, BURST, BURST_START, DROP, DURATION, FADE_START, GROOVE_KICKS, INTRO_PHRASE_STARTS, REDROP,
  SOFT_RETURN, camera, kick, landings, music, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const INTRO_TOUCHES = INTRO_PHRASE_STARTS.slice(0, 2); // 0.894, 2.554; the third phrase is floated over
const FADE_NOTE = 43.897;

const PINNED = new Map<number, number>([
  [BURST_START, 0.95],
  [DROP, 1],
  [REDROP, 0.9],
]);

const times = landings([BOOM], INTRO_TOUCHES, BURST, GROOVE_KICKS, [FADE_NOTE, SOFT_RETURN]);
const strength = (t: number) =>
  PINNED.get(t) ?? (INTRO_TOUCHES.includes(t) || t === FADE_NOTE ? voiceStrength(t) : kick(t));

export const bench = {
  stratum: "P3" as const,
  pattern: "calm float into a slam",
  windows: [
    [2.5, 4.5],
    [7.7, 9.2],
  ] as [number, number][],
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes([
      { t: 0, v: 0.85, ease: "smooth" },
      { t: 2.5, v: 0.92, ease: "hold" }, // the intro float
      { t: BURST_START, v: 0.6, ease: "smooth" },
      { t: 7.7, v: 0.92, ease: "hold" }, // the breath float
      { t: DROP, v: 0.66, ease: "smooth" },
      { t: FADE_START, v: 0.7, ease: "smooth" },
      { t: DURATION, v: 0.85 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.35, ease: "smooth" },
      { t: BURST_START, v: 0.62, ease: "smooth" },
      { t: BREATH_START, v: 0.5, ease: "easeIn" },
      { t: DROP, v: 0.76, ease: "smooth" },
      { t: 30, v: 0.8, ease: "smooth" },
      { t: FADE_START, v: 0.6, ease: "easeOut" },
      { t: DURATION, v: 0.45 },
    ]),
  },
};

export default spec;
