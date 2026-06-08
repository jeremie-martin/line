/**
 * syncopated_lift - alternating short and long gaps. The long gaps request
 * higher air and amplitude; the short syncopations keep the elevation target
 * modest and speed alive.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

// accent the syncopated off-beats (the short-gap hits, odd indices) hard; the
// on-beat long-gap lifts land moderate — a back-beat accent pattern.
const contacts: Contact[] = withImpact(
  [
    0.7, 1.55, 2.05, 2.95, 3.45, 4.35, 4.85, 5.8, 6.3, 7.25,
    7.75, 8.7, 9.2, 10.15, 10.65, 11.6, 12.1, 13.05, 13.55, 14.5,
  ].map((t) => ({ t })),
  (_t, i) => (i % 2 === 1 ? 0.85 : 0.35), // off-beat accent
);

const spec: Spec = {
  duration: 15.5,
  contacts,
  axes: {
    air: keyframes([{ t: 0, v: 0.48 }, { t: 5, v: 0.72 }, { t: 10, v: 0.50 }, { t: 15, v: 0.74 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.62 }, { t: 15, v: 0.70 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.50 }, { t: 5, v: 0.60 }, { t: 10, v: 0.42 }, { t: 15, v: 0.62 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.14 }, { t: 5, v: 0.44 }, { t: 10, v: 0.16 }, { t: 15, v: 0.48 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
