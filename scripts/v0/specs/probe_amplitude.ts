/**
 * probe_amplitude — envelope probe for the new `amplitude` axis.
 *
 * Walks jump-arc height low → high (0.20 → 0.50 → 0.85) while speed is held
 * constant and air/grain are left free. amplitude is the peak upward bow above
 * the takeoff→landing chord, so a rising staircase should ask the compiler for
 * progressively taller arcs. Read target→achieved to calibrate AMPLITUDE_CAP.
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
    amplitude: keyframes(
      [{ t: 0, v: 0.2 }, { t: 5, v: 0.5 }, { t: 10, v: 0.85 }],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
