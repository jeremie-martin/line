/**
 * drums_buildup — 30s "ground → balance → fly" arc against
 * beats/drums_0_30s_60_125.json.
 *
 *   §0 [ 0– 10s] grounded   (air 0.50)  — feet-on-the-floor intro
 *   §1 [10– 20s] balanced   (air 0.70)  — middle gear, classic feel
 *   §2 [20– 30s] aerial     (air 0.85)  — drum-driven liftoff
 *
 * Reuses the canonical Contact filter (drops onsets < 0.5s and any pair
 * spaced < 0.4s) so the v0 compiler has a clean per-beat schedule.
 */
import { drumsSpec } from "../scripts/v0/specs/_drums.ts";

const spec = drumsSpec([
  { t0: 0,  t1: 10, air: 0.5  },
  { t0: 10, t1: 20, air: 0.7  },
  { t0: 20, t1: 30, air: 0.85 },
]);
export default spec;
