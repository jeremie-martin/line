/**
 * Luna Bala, bench-breakdown (stratum P5: breaks, drops and re-entries).
 *
 * Luna has four structural moments, each a stop or thinning and a re-entry; each
 * is pinned (strength set by its role, not its loudness):
 * - the voice stop: the last word before it (3.216), a 1.28 s float over the
 *   silence (mix 0.03), and the voice's re-entry 4.493 (pinned 0.45, clearly
 *   above the intro's other words);
 * - the drop 8.615 (pinned 1.0) after the voice-only intro, approached by phrase
 *   landings that grow (7.523 is the last, 1.09 s before it);
 * - the tom break: the last downbeat with bass under it (23.870, pinned 0.8), the
 *   three toms alone (24.416, 24.961, 25.507; 0.6, their mix rise of 0.64–0.72
 *   is the song's highest after the drop, but nothing else sounds), with the speed
 *   dropping and the air rising, then the re-entry of bass and voice on 26.053
 *   (pinned 0.95) with the speed back up;
 * - the collapse: the last two kicks (42.411, 42.957 pinned 0.9) and 1.04 s of
 *   near-silence ridden out to the end.
 *
 * The rest: the voice intro by phrases, the body by its kick pulse (every on-beat
 * kick, bar downbeats a step up).
 *
 * Deliberately left out: off-beats and fill off-beats (other strata), the faint
 * sung A♯4 at 43.514 in the collapse (mix 0.05, it would undo the stop), and the
 * intro's other words (only phrase starts, so the stop and the drop read as
 * structure, not as one more word).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_IN, DROP, DURATION, KICKS, LAST_KICK, PHRASES, REENTRY, STOP_T0, VOICE_REENTRY,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const LAST_WORD = 3.216;
const TOMS = [24.416, 24.961, 25.507];
const PINNED: Record<string, number> = {
  [VOICE_REENTRY]: 0.45, [DROP]: 1.0, [BREAK_IN]: 0.8, [REENTRY]: 0.95, 42.411: 0.9, [LAST_KICK]: 0.9,
};
for (const t of TOMS) PINNED[t] = 0.6;

const times = landings(PHRASES, [LAST_WORD], KICKS);
const strength = (t: number) =>
  PINNED[t] ?? (t < DROP ? wordStrength(t) : kickStrength(t, 0.5, 0.18));

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.78, amp: 0.14, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf([
      [0.0, 0.6], [LAST_WORD, 0.62], [STOP_T0, 0.88], [VOICE_REENTRY, 0.62], [7.5, 0.7],
      [DROP, 0.68], [BREAK_IN, 0.66], [24.2, 0.82], [25.9, 0.82], [REENTRY, 0.66],
      [42.4, 0.7], [LAST_KICK, 0.88], [DURATION, 0.9],
    ])),
    speed: keyframes(kf([
      [0.0, 0.4], [LAST_WORD, 0.42], [STOP_T0, 0.34], [VOICE_REENTRY, 0.42], [7.5, 0.56],
      [DROP, 0.8], [12.0, 0.76], [BREAK_IN, 0.78], [24.3, 0.6], [25.6, 0.62], [REENTRY, 0.86],
      [30.0, 0.78], [42.4, 0.76], [LAST_KICK, 0.55], [DURATION, 0.42],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P5" as const,
  pattern: "breaks, drops and re-entries",
  windows: [[3.15, 4.72], [7.45, 9.2], [23.3, 26.65], [42.35, 44.0]] as Array<[number, number]>,
};
