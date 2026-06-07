/**
 * probe_amplitude_sparse — amplitude with LONG gaps (sparse contacts), where pop
 * (≈ g·N²/8) can actually be large. Tests whether amplitude steering produces big
 * arcs when the gap is long enough to allow them (it can't at dense beats).
 */
import type { Contact, Spec } from "../types.ts";
import { constant, keyframes } from "../core/curves.ts";

const contacts: Contact[] = [];
for (let t = 1.2; t < 18; t += 1.2) contacts.push({ t: Number(t.toFixed(3)) }); // ~1.2s gaps (48f)

const spec: Spec = {
  duration: 19,
  contacts,
  jitter: 0,
  axes: {
    air: constant(0.6),
    amplitude: keyframes([{ t: 0, v: 0.2 }, { t: 9, v: 0.5 }, { t: 18, v: 0.85 }], "smooth"),
  },
  preroll: 5,
};

export default spec;
