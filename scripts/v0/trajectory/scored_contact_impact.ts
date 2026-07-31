/**
 * Shared study-only reporting of the production impact measurement
 * (the scored redirection impulse, contactRedirArcPxAtLanding since 2026-07-31).
 *
 * This module reports a closed capture's scored contact outcome; it never
 * selects a capture or turns impact residual into a planning input.
 */
import { contactRedirArcPxAtLanding } from "../core/substrate.ts";
import { IMPACT_WINDOW, normImpact } from "../types.ts";
import {
  postimpactRawImpactToFelt,
  type PostimpactImpactConvention,
} from "./postimpact_physics.ts";

export type ScoredContactImpactOutcome = {
  metric: "contactRedirArcPxAtLanding -> normImpact";
  windowFrames: number;
  availability:
    | "measured"
    | "no_owned_contact"
    | "response_window_unavailable"
    | "measurement_unavailable";
  target: number | null;
  landingFrame: number | null;
  rawPxPerFrame: number | null;
  achieved: number | null;
  residual: number | null;
};

/** Build a stable outcome once the exact raw impact measurement is known. */
export function scoredContactImpactFromRaw(input: {
  target: number | null;
  landingFrame: number | null;
  responseWindowComplete: boolean;
  rawPxPerFrame: number | undefined;
}, convention?: Readonly<PostimpactImpactConvention>): ScoredContactImpactOutcome {
  const base = {
    metric: "contactRedirArcPxAtLanding -> normImpact" as const,
    windowFrames: convention?.impactWindowFrames ?? IMPACT_WINDOW,
    target: input.target,
    landingFrame: input.landingFrame,
  };
  if (input.landingFrame === null) {
    return { ...base, availability: "no_owned_contact", rawPxPerFrame: null, achieved: null, residual: null };
  }
  if (!input.responseWindowComplete) {
    return { ...base, availability: "response_window_unavailable", rawPxPerFrame: null, achieved: null, residual: null };
  }
  if (input.rawPxPerFrame === undefined) {
    return { ...base, availability: "measurement_unavailable", rawPxPerFrame: null, achieved: null, residual: null };
  }
  const achieved = convention === undefined
    ? normImpact(input.rawPxPerFrame)
    : postimpactRawImpactToFelt(input.rawPxPerFrame, convention);
  return {
    ...base,
    availability: "measured",
    rawPxPerFrame: input.rawPxPerFrame,
    achieved,
    residual: input.target === null ? null : achieved - input.target,
  };
}

/** Read the exact production impact metric for an already-owned landing. */
export function scoredContactImpact(
  detection: Parameters<typeof contactRedirArcPxAtLanding>[0],
  input: { target: number | null; landingFrame: number | null; responseWindowComplete: boolean },
): ScoredContactImpactOutcome {
  const rawPxPerFrame = input.landingFrame === null || !input.responseWindowComplete
    ? undefined
    : contactRedirArcPxAtLanding(detection, input.landingFrame, IMPACT_WINDOW);
  return scoredContactImpactFromRaw({ ...input, rawPxPerFrame });
}

/**
 * Fixture-bound variant. It performs both the redirection read and
 * normalization through the exact convention that was sealed into the replay
 * boundary, rather than re-reading ambient production constants.
 */
export function scoredContactImpactWithConvention(
  detection: Parameters<typeof contactRedirArcPxAtLanding>[0],
  input: { target: number | null; landingFrame: number | null; responseWindowComplete: boolean },
  convention: Readonly<PostimpactImpactConvention>,
): ScoredContactImpactOutcome {
  const rawPxPerFrame = input.landingFrame === null || !input.responseWindowComplete
    ? undefined
    : contactRedirArcPxAtLanding(detection, input.landingFrame, convention.impactWindowFrames);
  return scoredContactImpactFromRaw({ ...input, rawPxPerFrame }, convention);
}
