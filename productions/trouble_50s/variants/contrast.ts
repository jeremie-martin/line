/**
 * Trouble · contrast. The spec Claude would write: kick's reading of the song, with the
 * structure made visible through accents and two big floats.
 *
 *   intro    as kick: the opening syllables, then phrase starts and chord entries;
 *   groove   every kick, accented 3-3-2: each cycle start firm, the kicks between lighter,
 *            so the odd meter shows in the ride;
 *   break    the biggest float of the song, into the drop;
 *   drop     every heavy kick, the snares that stand alone, and "boom-TAK" (the snare/tom
 *            0.22 s after a heavy kick, 31.72 and 38.87); the two three-kick clusters grow a
 *            little (a gesture, not three equal hits) and nothing lands next to them;
 *   outro    two phrase starts of the voice break, then a second big float over the drum
 *            swell into 46.95 (an echo of the drop), then every kick; 50.07 the hardest after the drop.
 */
import type { Contact, Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";

const VOCAL_BREAK = [43.77, 44.91];
const BOOM_TAK = [31.72, 38.87];
const CLUSTERS = [[34.40, 34.74, 35.07], [41.56, 41.90, 42.24]];
const CYCLE_STARTS = [...m.GROOVE_CYCLES, ...m.DROP_CYCLES, 48.74];
const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);

function impactFor(t: number): number {
  if (near([m.DROP_T], t)) return 1.0;
  if (near([m.OPENING_CRASH], t)) return 0.5;
  if (near([46.95], t)) return 0.85; // the second re-entry, after the float
  if (near([50.07], t)) return 0.9;
  if (t < m.GROOVE_T || near(VOCAL_BREAK, t)) {
    const build = t < m.GROOVE_T && t > 11.8 ? (t - 11.8) / (m.GROOVE_T - 11.8) : 0;
    return Number(m.clamp(m.voiceStrength(t) + 0.18 * build, 0.04, 0.35).toFixed(3));
  }
  for (const c of CLUSTERS) {
    const i = c.findIndex((x) => Math.abs(x - t) < 0.03);
    if (i >= 0) return [0.75, 0.82, 0.9][i];
  }
  if (near(CYCLE_STARTS, t)) return Number(m.clamp(m.drumStrength(t), 0.65, 0.9).toFixed(3));
  if (near(m.GROOVE_KICKS, t) || near(m.OUTRO_KICKS, t)) return Number(m.clamp(m.drumStrength(t, 0.5), 0.25, 0.45).toFixed(3));
  return Number(m.clamp(m.drumStrength(t), 0.3, 0.9).toFixed(3)); // drop kicks, snares, boom-TAK
}

const times = m.landings([m.OPENING_CRASH, 0.85, 1.30, 1.73], m.INTRO_PHRASES, m.GROOVE_KICKS,
  m.DROP_KICKS, m.DROP_SNARES, BOOM_TAK, VOCAL_BREAK, m.OUTRO_KICKS);
const contacts: Contact[] = beats(times.map((t) => ({ t, impact: impactFor(t) })));

const speed: Curve = keyframes([
  { t: 0.0, v: 0.36, ease: "smooth" },
  { t: 12.0, v: 0.42, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.56, ease: "easeIn" },
  { t: 27.24, v: 0.62, ease: "smooth" },
  { t: m.DROP_T, v: 0.80, ease: "easeIn" },
  { t: 42.3, v: 0.80, ease: "smooth" },
  { t: m.STOP_T, v: 0.58, ease: "smooth" },
  { t: 45.0, v: 0.56, ease: "smooth" },
  { t: m.BUILD_END_T, v: 0.70, ease: "easeIn" },
  { t: m.DURATION, v: 0.66 },
]);
const air: Curve = keyframes([
  { t: 0.0, v: 0.60, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.58, ease: "smooth" },
  { t: 27.25, v: 0.62, ease: "smooth" },
  { t: 28.2, v: 0.92, ease: "smooth" }, // the big float into the drop
  { t: m.DROP_T, v: 0.70, ease: "smooth" },
  { t: m.STOP_T, v: 0.62, ease: "smooth" },
  { t: 45.9, v: 0.90, ease: "smooth" }, // the second big float, into 46.95
  { t: m.BUILD_END_T, v: 0.66, ease: "smooth" },
  { t: m.DURATION, v: 0.64 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { beatPunch: { threshold: 0.80, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" }, zoom: m.zoom },
  contacts,
  jitter: 0,
  axes: { air, speed },
};
export default spec;
