/**
 * Structural traversal budget model for compileHandoff.
 *
 * This is a pure predictor for the first complete traversal cost, not a score or
 * quality model. It intentionally uses only spec structure: feasible contact
 * count plus authored duration in frames. See docs/difficulty-model-study.md.
 */

import { K_BOUNCE_LANDING } from "../../lib/detector.ts";
import { secToFrame, type Spec } from "../types.ts";

export type TraversalBudgetInputs = {
  /** Required contacts that can physically be landed after bounce rejection. */
  contactCount: number;
  /** Authored duration in Line Rider frames. */
  durationFrames: number;
};

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

export function traversalBudgetInputs(spec: Spec): TraversalBudgetInputs {
  return {
    contactCount: feasibleContactFrames(spec).length,
    durationFrames: secToFrame(spec.duration),
  };
}

export function predictFirstCompletionFrames(
  specOrInputs: Spec | TraversalBudgetInputs,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  const inputs = isTraversalInputs(specOrInputs)
    ? specOrInputs
    : traversalBudgetInputs(specOrInputs);
  return Math.max(
    1,
    model.interceptFrames +
      model.contactFrames * inputs.contactCount +
      model.durationFrameScale * inputs.durationFrames,
  );
}

/** Suffix estimate from an existing gap boundary. No intercept: startup/root
 * overhead has already been paid by the prefix search. */
export function predictSuffixCompletionFrames(
  spec: Spec,
  gapIndex: number,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  const durationFrames = secToFrame(spec.duration);
  const contacts = feasibleContactFrames(spec);
  const rawAnchor = Number.isFinite(gapIndex) ? Math.floor(gapIndex) : 0;
  const anchor = Math.max(0, Math.min(rawAnchor, contacts.length));
  const startFrame = anchor === 0 ? 0 : contacts[anchor - 1];
  const remainingContacts = Math.max(0, contacts.length - anchor);
  const remainingDurationFrames = Math.max(0, durationFrames - startFrame);
  return Math.max(
    1,
    model.contactFrames * remainingContacts +
      model.durationFrameScale * remainingDurationFrames,
  );
}

export function traversalBudgetSlack(
  budgetFrames: number,
  specOrInputs: Spec | TraversalBudgetInputs,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  return Math.max(0, budgetFrames) / predictFirstCompletionFrames(specOrInputs, model);
}

function feasibleContactFrames(spec: Spec): number[] {
  return spec.contacts
    .map((contact) => secToFrame(contact.t))
    .filter((frame) => frame >= K_BOUNCE_LANDING)
    .sort((a, b) => a - b);
}

function isTraversalInputs(value: Spec | TraversalBudgetInputs): value is TraversalBudgetInputs {
  return "contactCount" in value && "durationFrames" in value;
}
