/**
 * Trouble · contrast-fast. contrast, faster through the drop (29–43.4 s: 0.92 instead
 * of 0.80), where the music is most intense. Nothing else changes.
 */
import type { Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import * as m from "../music.ts";
import contrast from "./contrast.ts";

export const fastSpeed: Curve = keyframes([
  { t: 0.0, v: 0.36, ease: "smooth" },
  { t: 12.0, v: 0.42, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.56, ease: "easeIn" },
  { t: 27.24, v: 0.64, ease: "smooth" },
  { t: m.DROP_T, v: 0.92, ease: "easeIn" },
  { t: 42.3, v: 0.92, ease: "smooth" },
  { t: m.STOP_T, v: 0.58, ease: "smooth" },
  { t: 45.0, v: 0.56, ease: "smooth" },
  { t: m.BUILD_END_T, v: 0.70, ease: "easeIn" },
  { t: m.DURATION, v: 0.66 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = { ...contrast, axes: { ...contrast.axes, speed: fastSpeed } };
export default spec;
