/**
 * probe_elevation_pure — elevation in isolation (no competing speed/air target),
 * at extreme targets, to read the true achievable climb/plunge envelope.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 15; t += 0.5) contacts.push({ t: Number(t.toFixed(3)) });

const spec: Spec = {
  duration: 16,
  contacts,
  axes: {
    elevation: keyframes(
      [{ t: 0, v: 0.05 }, { t: 5, v: 0.5 }, { t: 10, v: 0.95 }],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
