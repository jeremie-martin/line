/**
 * Hand-authored production-distribution case: every local pulse offset below is
 * authored explicitly. The timing drifts by 10-35ms around a 520ms backbone so
 * the compiler sees played timing rather than a perfectly quantized grid.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near } from "./_score.ts";

function handTimed(start: number, offsets: readonly number[]): number[] {
  return offsets.map((offset, index) => Number((start + index * 0.52 + offset).toFixed(3)));
}

const intro = [0.53, 1.04, 1.58, 2.07, 2.61, 3.14, 3.65, 4.19, 4.70, 5.24];
const driveA = handTimed(5.76, [
  0.000, 0.018, -0.012, 0.026, -0.020, 0.010, -0.030, 0.016, -0.006, 0.028, -0.018,
  0.004, 0.022, -0.024, 0.012, -0.010, 0.030, -0.014, 0.006, -0.028, 0.020, -0.004,
]);
const driveB = handTimed(17.40, [
  0.000, -0.022, 0.014, -0.008, 0.032, -0.018, 0.006, -0.030, 0.018, -0.012, 0.026,
  -0.004, -0.024, 0.012, -0.016, 0.030, -0.010, 0.004, -0.028, 0.020, -0.006, 0.016,
]);
const driveC = handTimed(29.08, [
  0.000, 0.024, -0.016, 0.008, -0.032, 0.020, -0.004, 0.028, -0.018, 0.010, -0.026,
  0.014, -0.006, 0.032, -0.020, 0.004, -0.030, 0.018, -0.010, 0.026, -0.014, 0.006,
]);
const driveD = handTimed(40.72, [
  0.000, -0.018, 0.028, -0.010, 0.014, -0.032, 0.020, -0.004, 0.030, -0.016, 0.008,
  -0.024, 0.018, -0.006, 0.026, -0.012, 0.004, -0.028,
]);
const accents = [5.76, 17.40, 29.08, 40.72, 49.56];
const contacts = authoredContacts(
  mergeTimes(intro, driveA, driveB, driveC, driveD),
  (t, index) => {
    if (near(t, accents, 0.04)) return 0.92;
    if (t < 5.5) return 0.18 + 0.05 * (index % 4);
    if (t > 48) return 0.34;
    return index % 4 === 0 ? 0.80 : index % 2 === 0 ? 0.62 : 0.46;
  },
);

const spec: Spec = {
  duration: 52,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.42, ease: "smooth" },
      { t: 5.76, v: 0.62, ease: "smooth" },
      { t: 17.40, v: 0.76, ease: "smooth" },
      { t: 29.08, v: 0.86, ease: "smooth" },
      { t: 40.72, v: 0.80, ease: "smooth" },
      { t: 52, v: 0.60 },
    ]),
    air: keyframes([
      { t: 0, v: 0.48, ease: "smooth" },
      { t: 12, v: 0.66, ease: "smooth" },
      { t: 24, v: 0.60, ease: "smooth" },
      { t: 36, v: 0.74, ease: "smooth" },
      { t: 46, v: 0.68, ease: "smooth" },
      { t: 52, v: 0.56 },
    ]),
  },
};

export default spec;
