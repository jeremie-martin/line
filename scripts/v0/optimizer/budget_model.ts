/**
 * Structural traversal budget model for compileHandoff.
 *
 * This is a pure predictor for the first complete traversal cost, not a score or
 * quality model. It intentionally uses only spec structure: feasible contact
 * count plus authored duration in frames. See docs/difficulty-model-study.md.
 */

import { K_BOUNCE_LANDING } from "../../lib/detector.ts";
import { secToFrame, type Spec } from "../types.ts";

export type TraversalBudgetModel = {
  name: string;
  source: string;
  interceptFrames: number;
  contactFrames: number;
  durationFrameScale: number;
};

export const TRAVERSAL_BUDGET_MODEL_V1: TraversalBudgetModel = {
  name: "contacts+duration/v1",
  source: "generated/golden-runs/attempt-true-target-objective-newgrid-a01/golden.json @250k",
  interceptFrames: 5_848.254347,
  contactFrames: 796.19669,
  durationFrameScale: 29.587736,
} as const;

export function predictFirstCompletionFrames(
  spec: Spec,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  const contactCount = feasibleContactFrames(spec).length;
  const durationFrames = secToFrame(spec.duration);
  return Math.max(
    1,
    model.interceptFrames +
      model.contactFrames * contactCount +
      model.durationFrameScale * durationFrames,
  );
}

export function traversalBudgetSlack(
  budgetFrames: number,
  spec: Spec,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  return Math.max(0, budgetFrames) / predictFirstCompletionFrames(spec, model);
}

/**
 * The same slack, re-estimated from the compile's OWN pace.
 *
 * The structural model is a regression on contact count and duration, so it
 * cannot know that one spec is expensive per contact: on
 * `frontier_pickup_progression_shifted` at 250k it predicts 164,440 frames
 * against a first complete traversal at 271,068. `spent / deepestGap *
 * totalGaps` is the compile's own measured cost to reach the end and needs no
 * model. Blend the two by the share of the budget already spent, so the prior
 * rules while there is no evidence and the evidence rules once there is — no
 * threshold, and exactly the structural predictor when nothing has been
 * observed yet.
 */
export function observedTraversalBudgetSlack(input: {
  budgetFrames: number;
  spentFrames: number;
  /** Gaps the traversal has reached; 0 or less before it has reached any. */
  deepestGap: number;
  totalGaps: number;
  predictedFrames: number;
}): number {
  const { budgetFrames, spentFrames, deepestGap, totalGaps, predictedFrames } = input;
  if (!(budgetFrames > 0) || !(totalGaps > 0)) return Infinity;
  if (!(deepestGap > 0) || !(spentFrames > 0)) return budgetFrames / Math.max(1, predictedFrames);
  const evidence = Math.min(1, spentFrames / budgetFrames);
  const measured = (spentFrames * totalGaps) / deepestGap;
  const projected = Math.max(1, (1 - evidence) * predictedFrames + evidence * measured);
  return budgetFrames / projected;
}

function feasibleContactFrames(spec: Spec): number[] {
  return spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);
}
