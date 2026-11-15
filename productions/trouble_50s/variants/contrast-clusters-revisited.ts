/**
 * Trouble: contrast-clusters (the preferred spec until now), revisited.
 *
 * Kept: its landings and its reading (a quiet voice intro, a groove that alternates a firm and a light kick, the
 * drop, the heavy stop-and-go, a float in the vocal break), its air, and its speed up to the vocal break.
 * Changed, and why:
 * - After the drop every heavy kick is equally loud in the song, but six were asked 0.75–0.82 and the rest 0.86–
 *   0.90. Now all 0.86–0.98, and each of the two triples (34.40, 41.56) climbs kick by kick to 0.96 and 0.98.
 * - The last kicks (46.95–50.07) are one family in the song (all the same loudness), but three were asked 0.37 and
 *   three 0.68–0.90. Now 0.74 climbing kick by kick to 0.92 at 50.07.
 * - Speed fell to 0.67–0.70 under those last kicks: hard hits need pace. It now returns to 0.86 for them.
 * - The vocal break landed two of its five clear words; the other three are added as touches (0.10).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import old from "./contrast-clusters.ts";

export const overlayMeta = m.overlayMeta;
const CHANGED: Record<string, number> = { "30.82": 0.90, "31.50": 0.86, "34.40": 0.88, "34.74": 0.92, "35.07": 0.96, "41.56": 0.90, "41.90": 0.94, "42.24": 0.98,
  "46.95": 0.74, "47.61": 0.76, "48.29": 0.80, "48.74": 0.82, "49.41": 0.86, "50.07": 0.92 };
const ADDED: Array<[number, number]> = [[44.23, 0.10], [45.62, 0.10], [46.02, 0.10]];
const oldSpeed = (t: number) => old.axes.speed!(t) ?? 0;
const spec: Spec = {
  ...old,
  contacts: beats(m.table([...old.contacts.map((k): [number, number] => [k.t, CHANGED[k.t.toFixed(2)] ?? k.impact!]), ...ADDED])),
  axes: {
    ...old.axes,
    /** The old speed, raised smoothly to 0.86 from 46.3 s on. */
    speed: (t: number) => { const w = Math.min(1, Math.max(0, (t - 46.3) / 0.6)); return oldSpeed(t) * (1 - w) + Math.max(oldSpeed(t), 0.86) * w; },
  },
};

export default spec;
