/**
 * drums_signature — 3-act narrative against beats/drums_0_30s_60_125.json.
 * The grip/skip acts hold speed constant and flip grain (line length) so the act
 * change is legible on-screen; the opener sets a slower baseline so the kick lands.
 *
 *   [ 0–10s]  cruise   slow, mid-air            — relaxed opener
 *   [10–20s]  grip     fast, long lines         — coarse grain
 *   [20–30s]  skip     fast, short lines        — fine grain
 */
import { drumsSpec } from "../../scripts/v0/specs/_drums.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const spec = drumsSpec({
  air:           keyframes([{ t: 0, v: 0.45 }, { t: 10, v: 0.60 }, { t: 20, v: 0.60 }], "hold"),
  speed:         keyframes([{ t: 0, v: 0.40 }, { t: 10, v: 0.80 }, { t: 20, v: 0.80 }], "hold"),
  grain:         keyframes([{ t: 0, v: 0.45 }, { t: 10, v: 0.75 }, { t: 20, v: 0.25 }], "hold"),
});
spec.preroll = 5;
export default spec;
