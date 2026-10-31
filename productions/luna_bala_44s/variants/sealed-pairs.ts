/**
 * Luna Bala, sealed-pairs (stratum P1: short audible pairs at speed). SEALED:
 * frozen for confirmation; do not compile it during development.
 *
 * Lands two kinds of short pairs, both sounds landed, at body speed:
 * - the four kick triplet fills (12.434, 21.153, 29.872, 38.592): kick, the
 *   off-beat kick/snare/tom 0.267 s later (drums 0.61–0.66), the downbeat 0.279
 *   (0.290) s after it. Two pairs each.
 * - "ta-BOOM": an off-beat 0.24–0.29 s before a kick, where it is clearly
 *   audible: a chord stab rising ≥ 0.20 (11.633, 13.804, 15.987, 20.341,
 *   22.523, 26.889, 35.608, 39.962) or an ADTOF snare (31.777, 36.177, 40.484).
 *   The kick before the off-beat is also landed, so each is a kick, off-beat,
 *   kick cluster (0.25–0.29 + 0.24–0.29 s).
 * Off-beats land at 0.4–0.45, kicks at 0.62 (downbeats 0.74–0.79), so each pair reads
 * as a lighter upper hit and a heavier bottom hit.
 *
 * The rest: the voice intro by phrases, the drop (8.615, pinned 1.0), every
 * other on-beat kick by the pulse.
 *
 * Deliberately left out: weaker off-beats (stab rise < 0.20; bass notes, which
 * come 0.20–0.23 s after a kick and so pair with the kick before rather than
 * lead into the next), so that the pairs above stay distinct moments rather than
 * a continuous 0.27 s grid (that is bench-intense's pattern).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_IN, DROP, DURATION, FILLS, FILL_OFFBEATS, KICKS, LAST_KICK, PHRASES, REENTRY,
  kf, kickStrength, landings, music, offbeatStrength, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const TA_BOOMS = [11.633, 13.804, 15.987, 20.341, 22.523, 26.889, 31.777, 35.608, 36.177, 39.962, 40.484];

const body = KICKS.filter((t) => t > DROP);
const times = landings(PHRASES, [DROP], body, FILL_OFFBEATS, TA_BOOMS);
const strength = (t: number) => {
  if (t === DROP) return 1.0;
  if (PHRASES.includes(t)) return wordStrength(t);
  if (FILL_OFFBEATS.includes(t)) return 0.45;
  if (TA_BOOMS.includes(t)) return Math.max(0.4, offbeatStrength(t));
  return kickStrength(t, 0.62, 0.16);
};

// Each pair cluster: [first landing - 0.05, last landing + 0.05].
const clusters: number[][] = [
  ...FILLS,
  ...TA_BOOMS.map((o) => {
    const before = KICKS.filter((k) => k < o).at(-1)!;
    const after = KICKS.find((k) => k > o)!;
    return [before, o, after];
  }),
].sort((a, b) => a[0] - b[0]);
const windows = clusters.map((c) => [Number((c[0] - 0.05).toFixed(3)), Number((c[c.length - 1] + 0.05).toFixed(3))] as [number, number])
  .reduce<Array<[number, number]>>((acc, w) => {
    const last = acc.at(-1);
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else acc.push(w);
    return acc;
  }, []);

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.75, amp: 0.12, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air: keyframes(kf([
      [0.0, 0.66], [7.6, 0.62], [DROP, 0.62], [BREAK_IN, 0.62], [24.4, 0.7], [REENTRY, 0.62],
      [LAST_KICK, 0.72], [DURATION, 0.85],
    ])),
    speed: keyframes(kf([
      [0.0, 0.38], [6.4, 0.46], [7.6, 0.56], [DROP, 0.8], [11.0, 0.86], [BREAK_IN, 0.86],
      [24.6, 0.78], [REENTRY, 0.86], [40.8, 0.86], [LAST_KICK, 0.64], [DURATION, 0.5],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P1" as const,
  pattern: "short audible pairs at speed",
  windows,
};
