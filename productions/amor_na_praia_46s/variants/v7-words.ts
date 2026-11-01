/**
 * v7-words (V7 stratum P2: voice-led close words). The voice leads this song only
 * where the drums stop: the soft intro, the breath, the hole and the fade. There it
 * is landed word by word as clear light hits; everywhere the drums play they are
 * three to four times louder than the voice, so the reading follows the kicks.
 *
 * What it lands, section by section:
 *   - Soft intro (0–4.46, the voice alone over the boom's decay): the 808 boom
 *     (0.337, from its loudness), then every heard chop of the three phrases:
 *     0.894, 1.138, 1.683 | 2.554, 3.100, 3.367 | 3.913, 4.180 (gaps 0.24–0.87 s,
 *     the closest 0.244, 0.267, 0.267), running 0.278 s into the burst's first kick.
 *     sung.py finds these unpitched, but they are the only sound after the boom
 *     dies (vocal 0.27–0.31 = the whole mix). Strength 0.21–0.32 from each chop's
 *     vocal rise: clear, light hits, not touches.
 *   - Burst: every kick at its measured loudness (the 808 leads).
 *   - Breath (7.9–9.1, the voice alone): the clear onset 8.046 (rise 0.20), 0.291 s
 *     after the burst's last kick, and the next word 8.301 (rise 0.12, 0.255 s on);
 *     then a ride into the drop, 9.125, pinned 1.
 *   - Groove: every kick at its measured loudness, up to 25.635.
 *   - Hole: the sung "hey" (26.285, C♯4, salience 0.90, the clip's clearest sung
 *     note) instead of the 26.180 kick 0.105 s before it (the two are too close to
 *     land both). This reading follows the voice where it sings alone, and the
 *     hey is what fills the hole; then the re-drop 26.726, pinned 1, 0.441 s later.
 *   - Groove 2: every kick at its measured loudness, up to 43.236.
 *   - Fade (the master drops, the voice alone): the two sung notes 43.654 and
 *     43.897 (0.243 s apart), then the soft kick+bass return 44.339 (drums 0.27,
 *     derived, so soft) with the voice's held C♯4 on it.
 *
 * Left out on purpose:
 *   - 1.463 (vocal rise 0.04, mix rise 0.02): too faint to hear as a word;
 *   - 26.180 (kick): see the hole, above; every bench spec lands it instead;
 *   - 7.930 (a borderline F♯4 0.175 s after the 7.755 kick, 0.116 s before 8.046)
 *     and 8.754 (the breath's borderline note, mix rise 0.02): faint, and 8.754
 *     would leave the drop 0.37 s of room;
 *   - the vocal chops inside the burst (4.621, 6.118, 7.198): the 808 leads there,
 *     at three times the voice (the burst's pairs reading is v7-pairs);
 *   - 43.468 (vocal rise 0.14, 0.186 s before the clearer 43.654 note);
 *   - every vocal or bass onset between groove kicks (vocal 0.2–0.3 against kicks
 *     at 0.8–0.9, 0.08–0.15 s after a kick, see music.ts): under the drums the voice
 *     read off the music on Trouble;
 *   - 44.919 and later (fade residue, rises ≤ 0.14).
 *
 * Windows: each stretch where the voice leads, its words and the hit that ends it.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BOOM, BREATH_START, BREATH_VOICE, BURST, BURST_START, DROP, DURATION, FADE_START, FADE_VOICE, GROOVE_KICKS,
  HOLE_START, HOLE_VOICE, INTRO_PHRASES, REDROP, SOFT_RETURN, camera, kick, landings, music, voiceStrength,
} from "../music.ts";

export { overlayMeta } from "../music.ts";

const FAINT = 1.463;
const INTRO_WORDS = INTRO_PHRASES.flat().filter((t) => t !== FAINT);
const BREATH_WORDS = [BREATH_VOICE, 8.301];
const WORDS = [...INTRO_WORDS, ...BREATH_WORDS, HOLE_VOICE, ...FADE_VOICE];
const KICKS = GROOVE_KICKS.filter((t) => t !== 26.18); // the hey replaces the kick before the hole

const PINNED = new Map<number, number>([
  [DROP, 1],
  [REDROP, 1],
]);

/** A clear light word hit from the vocal rise: 0.21–0.32 (the hey, rise 0.32, reaches 0.40). */
const word = (t: number) => voiceStrength(t, 0.14, 0.8);

const times = landings([BOOM], WORDS, BURST, KICKS, [SOFT_RETURN]);
const strength = (t: number) => PINNED.get(t) ?? (WORDS.includes(t) ? word(t) : kick(t));

export const bench = {
  stratum: "P2" as const,
  pattern: "voice-led close words",
  windows: [
    [0.85, 4.5],
    [8.0, 9.15],
    [26.25, 26.75],
    [43.6, 44.4],
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
      { t: 0, v: 0.7, ease: "smooth" },
      { t: 2.0, v: 0.62, ease: "smooth" }, // close words: short hops
      { t: BURST_START, v: 0.6, ease: "smooth" },
      { t: BREATH_START, v: 0.7, ease: "smooth" },
      { t: DROP, v: 0.66, ease: "smooth" },
      { t: 25.6, v: 0.66, ease: "smooth" },
      { t: HOLE_START, v: 0.7, ease: "smooth" },
      { t: REDROP, v: 0.68, ease: "smooth" },
      { t: FADE_START, v: 0.72, ease: "smooth" },
      { t: DURATION, v: 0.85 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.4, ease: "smooth" },
      { t: 3.9, v: 0.45, ease: "easeIn" },
      { t: BURST_START, v: 0.64, ease: "smooth" },
      { t: BREATH_START, v: 0.5, ease: "easeIn" },
      { t: DROP, v: 0.78, ease: "smooth" },
      { t: 25.6, v: 0.8, ease: "smooth" },
      { t: HOLE_START, v: 0.66, ease: "easeIn" },
      { t: REDROP, v: 0.82, ease: "smooth" },
      { t: FADE_START, v: 0.55, ease: "easeOut" },
      { t: DURATION, v: 0.45 },
    ]),
  },
};

export default spec;
