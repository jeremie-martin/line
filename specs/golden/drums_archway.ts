/**
 * drums_archway — a single tall, smooth air arch over
 * the whole track: the rider rises to a sustained high-air peak mid-track then
 * descends, with speed and grain held flat so the arch is a pure air statement
 * (the air isolation counterpart to drums_swell's all-axis hump).
 *
 *   air    0.45 → 0.82 → 0.45   (one smooth arch, high amplitude)
 *   speed  0.55 (flat)
 *   grain  0.50 (flat)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air: keyframes([{ t: 0, v: 0.45, ease: "smooth" }, { t: 15, v: 0.82, ease: "smooth" }, { t: 30, v: 0.45 }]),
  speed: constant(0.55),
  grain: constant(0.50),
});
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
