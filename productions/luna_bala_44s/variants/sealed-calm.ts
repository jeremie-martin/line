/**
 * Luna Bala, sealed-calm (stratum P3: calm floats, a soft opening, a float into a
 * slam). SEALED: frozen for confirmation; do not compile it during development.
 *
 * The voice-only intro (mix 0.17–0.35, half the body's level) is Luna's one calm
 * stretch. It is landed sparsely and softly, a float between phrase starts:
 * 0.441, 1.579, 2.659, then over the one-second stop to the re-entry 4.493, then
 * 5.944 and 6.989 (gaps 1.05–1.83 s; asks 0.10–0.16, light touches). From 6.989
 * a 1.63 s float, the highest air of the song, carries over the last two words
 * into the drop 8.615 (kick + snare, mix rise 0.85), pinned 1.0.
 *
 * After the drop everything is a little bigger, so the contrast shows: every
 * on-beat kick, stronger than in the other variants (0.58, downbeats 0.74–0.79),
 * at speed.
 *
 * Deliberately left out:
 * - the intro words between the phrase starts (0.441, 1.033, 2.078, 3.216, 4.667,
 *   5.074, 5.387, 6.444, 7.523, 8.069): a calm reading floats over them; 7.523
 *   and 8.069 are inside the final float on purpose;
 * - off-beats and fill off-beats (other strata);
 * - the tom break is not treated as calm: its toms are as loud as any kick.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_IN, DROP, DURATION, KICKS, LAST_KICK, REENTRY, VOICE_REENTRY,
  kf, kickStrength, landings, music, overlayMeta, voiceStrength, zoom,
} from "../music.ts";

const SOFT = [0.441, 1.579, 2.659, VOICE_REENTRY, 5.944, 6.989];
const FLOAT_FROM = 6.989;

const times = landings(SOFT, KICKS);
const strength = (t: number) =>
  t === DROP ? 1.0 : t < DROP ? Number(voiceStrength(t, 0.06, 0.32).toFixed(3)) : kickStrength(t, 0.58, 0.2);

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.15, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: [{ t: 0.0, zoom: 2.8 }, { t: FLOAT_FROM, zoom: 2.7 }, ...zoom.filter((k) => k.t >= DROP)],
    },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes(kf([
      [0.0, 0.88], [FLOAT_FROM, 0.9], [7.3, 0.95], [DROP, 0.95], [DROP + 0.3, 0.66],
      [BREAK_IN, 0.66], [24.4, 0.72], [REENTRY, 0.66], [LAST_KICK, 0.72], [DURATION, 0.85],
    ])),
    speed: keyframes(kf([
      [0.0, 0.3], [4.5, 0.32], [FLOAT_FROM, 0.36], [DROP, 0.66], [DROP + 0.6, 0.8],
      [BREAK_IN, 0.82], [24.6, 0.74], [REENTRY, 0.84], [40.8, 0.82], [LAST_KICK, 0.6], [DURATION, 0.48],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P3" as const,
  pattern: "soft opening, float into the drop",
  windows: [[0.39, 8.66]] as Array<[number, number]>,
};
