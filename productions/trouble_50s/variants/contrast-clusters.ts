/**
 * Trouble · contrast-clusters. contrast-pairs, plus the hit the owner hears right after
 * each three-kick cluster: the snare/tom 0.22 s after its third kick (35.29, 42.47).
 * Measured at about half a kick's loudness; asked a little firmer (0.45) because it reads
 * as a clear fourth beat, still well under the cluster's 0.75–0.9.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import pairs from "./contrast-pairs.ts";

const CLUSTER_ENDS = [35.29, 42.47];
const end = (t: number) => CLUSTER_ENDS.some((x) => Math.abs(x - t) < 0.03);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...pairs,
  contacts: beats(m.landings(pairs.contacts.map((c) => c.t), CLUSTER_ENDS).map((t) => ({
    t, impact: end(t) ? 0.45 : pairs.contacts.find((c) => Math.abs(c.t - t) < 0.03)!.impact,
  }))),
};
export default spec;
