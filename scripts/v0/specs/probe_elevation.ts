/**
 * probe_elevation — envelope probe for the new `elevation` axis.
 *
 * Walks elevation plunge → level → climb (0.25 → 0.50 → 0.75) while speed is
 * held constant and air/grain are left free. Read the per-gap target→achieved
 * column to see how far the compiler can actually move altitude trend.
 */
import type { Contact, Spec } from "../types.ts";
import { constant, keyframes } from "../core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 15; t += 0.5) contacts.push({ t: Number(t.toFixed(3)) });

const spec: Spec = {
  duration: 16,
  contacts,
  axes: {
    speed: constant(0.5),
    elevation: keyframes(
      [{ t: 0, v: 0.25 }, { t: 5, v: 0.5 }, { t: 10, v: 0.75 }],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
