/**
 * Luna Bala, bench-intense (stratum P4: an intense dense section at speed).
 *
 * The body is uniformly loud (8 s mean mix 0.70–0.71 everywhere from 9 to 41 s),
 * so "the loudest stretch" is chosen by density: where the off-beat between two
 * kicks is audible most often. Two windows qualify, split by the tom break:
 * - 17.85–23.95: kicks, off-beat stabs/toms/bass notes and the 21.153 fill;
 * - 26.55–32.62: kicks, stabs, snares, bass notes and the 29.872 fill.
 * There every on-beat kick, every audible off-beat (OFFBEATS: an ADTOF snare or
 * tom, a chord stab rising ≥ 0.18, or a bass note rising ≥ 0.30) and the fill's
 * off-beat kick are landed, at the highest speed of the song. Gaps are 0.19–0.29
 * s, except five half-beats where nothing audible plays (19.505, 21.699, 28.235,
 * 28.793, 30.418 → next kick, 0.53–0.56 s). Kicks are strong (the bar downbeat
 * stronger), off-beats lighter (0.31–0.43 by their loudest stem).
 *
 * The rest is a sensible reading: the voice intro by phrases (gentle), the drop
 * (8.615, pinned 1.0), and the other body stretches and the tom break by the kick
 * pulse (0.545 s), at a lower speed so the windows stand out.
 *
 * Deliberately left out:
 * - off-beats outside the windows, so the dense stretches are the pattern, and the
 *   fills at 12.434 and 38.592 (their off-beat kick) for the same reason;
 * - inside the windows, half-beats whose only sound is a chord swell rising
 *   < 0.18 that ADTOF does not hear as a drum (e.g. 29.060, mix rise 0.22 but no
 *   stem attack), and the late snare 28.642 (0.151 s before the kick 28.793:
 *   too close to read as its own hit);
 * - the vocal "hey" on downbeats (it coincides with the landed kick).
 *
 * The windows contain short pairs (fills, 0.19–0.29 s), so a P4 failure can also be
 * a P1 failure; per-window results tell which landing it stopped at.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_IN, DROP, DURATION, FILL_OFFBEATS, KICKS, LAST_KICK, OFFBEATS, PHRASES, REENTRY,
  kf, kickStrength, landings, music, offbeatStrength, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const WINDOWS: Array<[number, number]> = [[17.85, 23.95], [26.55, 32.62]];
const inWindow = (t: number) => WINDOWS.some(([a, b]) => t >= a && t <= b);

const body = KICKS.filter((t) => t > DROP);
const dense = [...OFFBEATS, ...FILL_OFFBEATS].filter(inWindow);
const times = landings(PHRASES, [DROP], body, dense);
const strength = (t: number) => {
  if (t === DROP) return 1.0;
  if (PHRASES.includes(t)) return wordStrength(t);
  if (dense.includes(t)) return FILL_OFFBEATS.includes(t) ? 0.45 : offbeatStrength(t);
  return inWindow(t) ? kickStrength(t, 0.62, 0.18) : kickStrength(t, 0.5, 0.18);
};

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.7, amp: 0.12, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: zoom.map((k) => (k.t >= 17.5 && k.t <= 33 ? { ...k, zoom: k.zoom - 0.25 } : k))
        .concat([{ t: 17.85, zoom: 1.65 }, { t: 32.62, zoom: 1.7 }]).sort((a, b) => a.t - b.t),
    },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  axes: {
    air: keyframes(kf([
      [0.0, 0.66], [7.6, 0.6], [DROP, 0.7], [17.3, 0.66], [17.85, 0.5], [23.95, 0.5], [24.4, 0.72],
      [25.8, 0.66], [26.55, 0.5], [32.62, 0.5], [33.2, 0.68], [LAST_KICK, 0.75], [DURATION, 0.85],
    ])),
    speed: keyframes(kf([
      [0.0, 0.38], [6.4, 0.46], [7.6, 0.55], [DROP, 0.7], [17.2, 0.74], [17.85, 0.9], [23.95, 0.9],
      [BREAK_IN + 0.6, 0.8], [REENTRY, 0.82], [26.55, 0.9], [32.62, 0.9], [33.5, 0.74],
      [LAST_KICK, 0.6], [DURATION, 0.5],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P4" as const,
  pattern: "intense dense section at speed",
  windows: WINDOWS,
};
