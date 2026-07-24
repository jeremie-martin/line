/**
 * Canonical authored target ownership for one arc placed at a contact.
 *
 * The arc's entry/contact geometry delivers impact and owns the line grain of
 * the scorer gap ending at that contact. Its post-contact geometry shapes the
 * motion axes of the scorer gap starting there. Keeping this split in one
 * function prevents the sampler, readiness corpus, and model features from
 * silently choosing different sides of the contact.
 */

import type { AxisValues, Gap } from "../types.ts";

/**
 * Exact proposal distribution represented by the readiness corpus/model.
 * Changing target ownership, sampling probabilities, templates, or hard gates
 * requires a new identifier and an explicit corpus/model rebuild.
 */
export const PRODUCTION_ARC_PROPOSAL_POLICY_ID =
  "compiler-v0-contact-owned-v3-tail-aware";

const ENTRY_CONTACT_AXES = ["impact", "grain"] as const;
const OUTGOING_MOTION_AXES = [
  "air",
  "speed",
  "elevation",
  "amplitude",
] as const;

export function composeArcProposalTargets(
  incomingTargets: AxisValues,
  outgoingTargets: AxisValues | null,
): AxisValues {
  assertFiniteTargets(incomingTargets, "incoming");
  if (outgoingTargets !== null) {
    assertFiniteTargets(outgoingTargets, "outgoing");
  }
  const targets: AxisValues = {};
  for (const axis of ENTRY_CONTACT_AXES) {
    const value = incomingTargets[axis];
    if (value !== undefined) targets[axis] = value;
  }
  if (outgoingTargets !== null) {
    for (const axis of OUTGOING_MOTION_AXES) {
      const value = outgoingTargets[axis];
      if (value !== undefined) targets[axis] = value;
    }
  }
  return targets;
}

export function arcProposalTargetsForGap(
  incomingGap: Gap,
  gaps: readonly Gap[],
): AxisValues {
  return composeArcProposalTargets(
    incomingGap.targets,
    successorScorerGapAfter(incomingGap, gaps)?.targets ?? null,
  );
}

/** Canonical immediate scorer-gap successor with timeline validation. */
export function successorScorerGapAfter(
  gap: Gap,
  gaps: readonly Gap[],
): Gap | null {
  const positions = gaps.flatMap((candidate, position) =>
    candidate === gap || candidate.index === gap.index ? [position] : []
  );
  if (positions.length !== 1) {
    throw new Error(
      `arc proposal gap ${gap.index} must appear exactly once in its timeline`,
    );
  }
  const candidate = gaps[positions[0] + 1];
  if (candidate === undefined) return null;
  if (
    candidate.index <= gap.index ||
    candidate.startFrame !== gap.endFrame ||
    candidate.endFrame <= gap.endFrame
  ) {
    throw new Error(
      `arc proposal gap ${gap.index} has a misaligned outgoing scorer gap`,
    );
  }
  return candidate;
}

/** Next authored-contact gap at or after the immediate scorer successor. */
export function nextContactGapAfter(
  gap: Gap,
  gaps: readonly Gap[],
): Gap | null {
  let candidate = successorScorerGapAfter(gap, gaps);
  while (candidate !== null) {
    if (candidate.endsWithContact) return candidate;
    candidate = successorScorerGapAfter(candidate, gaps);
  }
  return null;
}

function assertFiniteTargets(
  targets: AxisValues,
  owner: string,
): void {
  for (const [axis, value] of Object.entries(targets)) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new Error(
        `arc proposal ${owner} target ${axis} must be finite`,
      );
    }
  }
}
