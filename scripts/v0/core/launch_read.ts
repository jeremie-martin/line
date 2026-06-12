/**
 * Single source of truth for the smoothed launch-velocity read (the short-probe
 * launch fix, commit f23ef60). The estimator averages up to LAUNCH_READ_FRAMES
 * consecutive AIRBORNE velocity reads — each compensated by g·k so that gravity
 * over the read window does not bias the average — then adds a constant vy
 * offset (LAUNCH_VY_OFFSET_PX) that corrects the post-impact-transient
 * under-read of vy.
 *
 * This module is intentionally DEPENDENCY-FREE (no imports) so that both call
 * sites can share it without an import cycle: optimizer/arc_probe.ts imports
 * `axisCost` from core/candidate.ts, so candidate.ts cannot import from
 * arc_probe.ts. The two call sites differ only in where the per-frame velocity
 * comes from (the metered ENGINE in arc_probe.ts vs the DETECTION arrays in
 * candidate.ts) and in the stop predicate (arc_probe.ts also bounds on the
 * fork horizon); the float-op sequence of the average is identical and lives
 * here.
 */

/** Frames averaged by the gravity-corrected launch-velocity estimator. */
export const LAUNCH_READ_FRAMES = 4;

/** Constant correction to the launch vy read (px/f). The velocity readout
 *  at the first airborne frames after a catch UNDERESTIMATES vy by a
 *  roughly constant amount (post-impact transient of the constrained body):
 *  signed prediction error vs full-sim truth is flat across dt buckets, so
 *  this is a read offset, not an acceleration. Fitted on 22.7k probe rows
 *  across 6 golden specs (smoothed read: +0.0345; raw read: +0.0265) and
 *  validated out-of-sample — see the calibration note in
 *  docs/ARC_AIMING_FORMALIZATION.md and study_latent_decomposition.ts. */
export const LAUNCH_VY_OFFSET_PX = 0.0345;

export type LaunchVelocity = { x: number; y: number };

/**
 * Gravity-corrected average of consecutive airborne velocity reads, starting
 * from the launch-frame velocity `v0` and walking forward up to
 * LAUNCH_READ_FRAMES frames. `g` is the per-frame gravity (px/f²).
 *
 * For each step k = 1 .. LAUNCH_READ_FRAMES-1:
 *   - `continueRead(k)` is consulted FIRST; a false result stops the walk
 *     (used for the airborne/horizon gating). When it returns true,
 *   - `readVelocity(k)` supplies the frame-(launch+k) velocity. A null /
 *     undefined / non-finite read also stops the walk.
 *   - otherwise sx += v.x, sy += v.y − g·k, n++.
 *
 * Result: `{ vx: sx/n, vy: sy/n + LAUNCH_VY_OFFSET_PX, n }`. The accumulation
 * order and float operations match the original two hand-mirrored loops
 * exactly (commit f23ef60), so both call sites stay bit-identical.
 */
export function gravityCorrectedLaunchAverage(
  v0: LaunchVelocity,
  g: number,
  continueRead: (k: number) => boolean,
  readVelocity: (k: number) => LaunchVelocity | null | undefined,
): { vx: number; vy: number; n: number } {
  let sx = v0.x;
  let sy = v0.y;
  let n = 1;
  for (let k = 1; k < LAUNCH_READ_FRAMES; k++) {
    if (!continueRead(k)) break;
    const v = readVelocity(k);
    if (v === undefined || v === null || !Number.isFinite(v.x) || !Number.isFinite(v.y)) break;
    sx += v.x;
    sy += v.y - g * k;
    n++;
  }
  const vx = sx / n;
  const vy = sy / n + LAUNCH_VY_OFFSET_PX;
  return { vx, vy, n };
}
