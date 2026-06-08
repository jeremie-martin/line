/**
 * drums_crescendo — monotonic multi-axis build against
 * beats/drums_0_30s_60_125.json. Every axis grows across three 10-second
 * blocks: calm → driving → unleashed. Tests *graduated coupling*, not contrast —
 * each block is visibly more energetic than the last across the axes at once.
 *
 * Ported to `hold` keyframes (step blocks, identical to the original sections).
 * A future revision could swap to eased ramps for a genuinely continuous build.
 *
 *   [ 0–10s]  whisper   air 0.30  speed 0.35  grain 0.20
 *   [10–20s]  drive     air 0.55  speed 0.60  grain 0.50
 *   [20–30s]  unleash   air 0.85  speed 0.90  grain 0.80
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air:           keyframes([{ t: 0, v: 0.30 }, { t: 10, v: 0.55 }, { t: 20, v: 0.85 }], "hold"),
  speed:         keyframes([{ t: 0, v: 0.35 }, { t: 10, v: 0.60 }, { t: 20, v: 0.90 }], "hold"),
  grain:         keyframes([{ t: 0, v: 0.20 }, { t: 10, v: 0.50 }, { t: 20, v: 0.80 }], "hold"),
}, (t) => (t < 10 ? 0.20 : t < 20 ? 0.50 : 0.85)); // impact crescendos with the blocks: whisper → drive → unleash
spec.preroll = 5;
export default spec;
