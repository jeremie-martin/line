/**
 * drums_winddown — the mirror of drums_crescendo: every axis starts hot and
 * decays to calm over the 30s drums grid. A reverse build / outro arc. Tests
 * graduated DE-coupling (all axes falling together) and whether the compiler
 * can shed energy as cleanly as it gains it.
 *
 *   air    0.80 ──► 0.45   (settles toward the ground)
 *   speed  0.80 ──► 0.50   (eases off)
 *   grain  0.62 ──► 0.35   (lines shorten)
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { ramp } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air: ramp(0, 0.80, 30, 0.45),
  speed: ramp(0, 0.80, 30, 0.50),
  grain: ramp(0, 0.62, 30, 0.35),
});
spec.preroll = 5;
spec.jitter = 0; // continuous curve carries the variation; no per-gap jitter
export default spec;
