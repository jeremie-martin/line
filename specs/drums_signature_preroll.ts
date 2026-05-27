/**
 * drums_signature_preroll — same 3-act narrative as drums_signature,
 * with `preroll: 3` so the compiler synthesizes 3s of warmup geometry
 * before spec time t=0 (mirroring §0's axes). The rider hits t=0 already
 * in §0's steady state instead of spending the opener catching up.
 *
 * Diagnostic variant: run alongside drums_signature and compare §0 axis
 * errors in the DriftReport.
 */
import { drumsSpec } from "../scripts/v0/specs/_drums.ts";

const spec = drumsSpec([
  { t0:  0, t1: 10, air: 0.45, speed: 0.40, grain: 0.45, contact_style: 0.50 },
  { t0: 10, t1: 20, air: 0.60, speed: 0.80, grain: 0.75, contact_style: 0.80 },
  { t0: 20, t1: 30, air: 0.60, speed: 0.80, grain: 0.25, contact_style: 0.20 },
]);
spec.preroll = 3;
export default spec;
