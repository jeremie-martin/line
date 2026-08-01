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

function feasibleContactFrames(spec: Spec): number[] {
  return spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);
}
