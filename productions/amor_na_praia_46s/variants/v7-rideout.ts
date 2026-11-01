/**
 * v7-rideout (V7 stratum P7: ride-outs, long riding on geometry at low air). This
 * song has two sustained, quiet stretches between loud entries; each is one long
 * gap ridden mostly on the line, ending on the entry. The ladder is short because
 * the song is: ~1.4 s and ~4.1 s. Its other stops are too short (the hole 0.44 s,
 * the fade's gaps ≤ 0.44 s once its sung notes are landed), and the groove is an
 * unbroken 0.55 s kick with no sustained passage to ride over.
 *
 * What it lands, section by section:
 *   - Soft intro, the long ride-out (4.12 s): the 808 boom (0.337, from its loudness)
 *     sustains and dies away by about 3.4 s, then the quietest stretch of the clip
 *     (mix 0.31, 2.0–4.4). One ride from the boom over its whole decay into the
 *     burst's first kick, 4.458 (the clip's loudest hit), pinned 0.95. Air 0.15:
 *     the rider rides the line for most of it and leaves it only to fly into the hit.
 *   - Burst: every kick at its measured loudness, ordinary riding.
 *   - Breath, the short ride-out (1.37 s): from the burst's last kick (7.755) over the
 *     voice alone (mix 0.32–0.41) into the drop, 9.125, pinned 1. Air 0.25 (the
 *     final flight into the drop is a larger share of a shorter gap).
 *   - Groove, hole, groove 2: every kick at its measured loudness, the re-drop 26.726
 *     pinned 1: ordinary riding.
 *   - Fade: the sung C♯4 43.897 and the soft return 44.339 (derived, soft).
 *
 * Why. P7 tests long riding on geometry, as opposed to bouncing off it, ending on
 * time and with the asked strength. Both ride-outs are the music's own sustained
 * quiet: a decaying boom with faint chops over it, and a voice alone. A float
 * (high air) over the same stretches is bench-calm's reading; here the rider stays
 * on the line.
 *
 * Left out on purpose:
 *   - every intro chop (0.894–4.180, vocal rises 0.04–0.24, sung.py finds no pitched
 *     note): faint voice over the boom's decay; landing any of them would break the
 *     sustained passage into hops;
 *   - the breath's onsets (7.930–8.870, including the clear 8.046, rise 0.20): soft
 *     voice under the ride-out, for the same reason;
 *   - the sung "hey" (26.285): 0.105 s after the 26.180 kick;
 *   - 43.654: the first of two sung notes 0.24 s apart; the clearer 43.897 is landed;
 *   - the in-between onsets of the groove (see music.ts).
 *
 * Windows: each ride-out with the entry that ends it.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BURST, BURST_START, DROP, DURATION, FADE_START, GROOVE_KICKS, REDROP, SOFT_RETURN, camera, kick, landings,
  music, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const FADE_NOTE = 43.897;
const LAST_BURST = 7.755;

const PINNED = new Map<number, number>([
  [BURST_START, 0.95],
  [DROP, 1],
  [REDROP, 1],
]);

const times = landings([BOOM], BURST, GROOVE_KICKS, [FADE_NOTE, SOFT_RETURN]);
const strength = (t: number) => PINNED.get(t) ?? (t === FADE_NOTE ? voiceStrength(t) : kick(t));

export const bench = {
  stratum: "P7" as const,
  pattern: "ride-out at low air",
  windows: [
    [0.3, 4.5],
    [7.7, 9.2],
  ] as [number, number][],
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera,
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes([
      { t: 0, v: 0.5, ease: "hold" },
      { t: BOOM, v: 0.15, ease: "hold" }, // the long ride-out (4.12 s)
      { t: BURST_START, v: 0.6, ease: "hold" },
      { t: LAST_BURST, v: 0.25, ease: "hold" }, // the short ride-out (1.37 s)
      { t: DROP, v: 0.66, ease: "smooth" },
      { t: FADE_START, v: 0.72, ease: "smooth" },
      { t: DURATION, v: 0.8 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.35, ease: "smooth" },
      { t: 3.9, v: 0.45, ease: "easeIn" },
      { t: BURST_START, v: 0.64, ease: "smooth" },
      { t: LAST_BURST, v: 0.55, ease: "easeIn" },
      { t: DROP, v: 0.78, ease: "smooth" },
      { t: 30, v: 0.8, ease: "smooth" },
      { t: FADE_START, v: 0.58, ease: "easeOut" },
      { t: DURATION, v: 0.45 },
    ]),
  },
};

export default spec;
