/**
 * Search-policy helpers for deciding whether a proposal pool covers a
 * practically supportable air request. These are not readiness semantics:
 * projected outgoing quality uses the scorer definition, while next-arc
 * readiness predicts the outcome of an unbuilt arc.
 */

import { K_BOUNCE_LANDING } from "../../lib/detector.ts";

export const AIR_DELIVERABILITY_DEADBAND = 0.05;

export function airDeliverabilityAsk(
  authoredAsk: number,
  gapFrameCount: number,
): number {
  return Math.max(
    authoredAsk,
    Math.min(1, K_BOUNCE_LANDING / Math.max(1, gapFrameCount)),
  );
}
