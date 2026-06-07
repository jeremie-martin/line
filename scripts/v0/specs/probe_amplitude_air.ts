/**
 * probe_amplitude_air — amplitude envelope when the rider is forced airborne.
 *
 * Same amplitude staircase as probe_amplitude, but with a high constant `air`
 * target so the rider actually leaves the ground (a precondition for a tall
 * ballistic arc). If amplitude tracks here but not without air, the lever is
 * real and the follow-up is air-coupled candidate generation.
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
    air: constant(0.75),
    amplitude: keyframes(
      [{ t: 0, v: 0.2 }, { t: 5, v: 0.5 }, { t: 10, v: 0.85 }],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
