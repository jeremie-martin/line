/**
 * Valhalla: words3 (the preferred spec until now), revisited.
 *
 * Kept: its choice of landings (every heard word, the two lone hits, the groove's kicks and snares), the words'
 * strengths, its air and speed.
 * Changed, and why:
 * - The drop at 30.06 asked for 0.20; it is where the drums enter and as loud as any kick after it: now 1.
 * - The two lone drum hits (9.32, 19.69) stand alone in near-silence: 0.55 and 0.60 become 0.72.
 * - The groove's kicks were all 0.90–0.95; they now follow their loudness (0.86–0.95, 34.27 the heaviest).
 * - The bass entries between the groove's hits (31.02, 32.35, 33.63, 36.22, 37.52, 38.81) were not landed; they are part
 *   of the groove's pulse: 0.30.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import old from "./words3.ts";

export const overlayMeta = m.overlayMeta;
const CHANGED: Record<string, number> = { "9.32": 0.72, "19.69": 0.72, "30.06": 1, "31.67": 0.90, "32.65": 0.86, "34.27": 0.95, "35.24": 0.88, "36.86": 0.92,
  "37.84": 0.86 };
const BASS = [31.022, 32.345, 33.634, 36.223, 37.523, 38.812];
const spec: Spec = {
  ...old,
  contacts: beats(m.table([
    ...old.contacts.map((k): [number, number] => [k.t, CHANGED[k.t.toFixed(2)] ?? k.impact!]),
    ...BASS.map((t): [number, number] => [t, 0.30]),
  ])),
};

export default spec;
