/**
 * Shared study-only reporting of the production impact measurement.
 *
 * This module reports a closed capture's scored contact outcome; it never
 * selects a capture or turns impact residual into a planning input.
 */
import { redirArcPxAtLanding } from "../core/substrate.ts";
import { IMPACT_WINDOW, normImpact } from "../types.ts";

export type ScoredContactImpactOutcome = {
  metric: "redirArcPxAtLanding -> normImpact";
  windowFrames: number;
  availability:
    | "measured"
    | "no_owned_contact"
    | "response_window_unavailable"
    | "measurement_unavailable";
  target: number | null;
  landingFrame: number | null;
  redirArcPx: number | null;
  achieved: number | null;
  residual: number | null;
};

/** Build a stable outcome once the exact raw impact measurement is known. */
export function scoredContactImpactFromRedir(input: {
  target: number | null;
  landingFrame: number | null;
  responseWindowComplete: boolean;
  redirArcPx: number | undefined;
}): ScoredContactImpactOutcome {
  const base = {
    metric: "redirArcPxAtLanding -> normImpact" as const,
    windowFrames: IMPACT_WINDOW,
    target: input.target,
    landingFrame: input.landingFrame,
  };
  if (input.landingFrame === null) {
    return { ...base, availability: "no_owned_contact", redirArcPx: null, achieved: null, residual: null };
  }
  if (!input.responseWindowComplete) {
    return { ...base, availability: "response_window_unavailable", redirArcPx: null, achieved: null, residual: null };
  }
  if (input.redirArcPx === undefined) {
    return { ...base, availability: "measurement_unavailable", redirArcPx: null, achieved: null, residual: null };
  }
  const achieved = normImpact(input.redirArcPx);
  return {
    ...base,
    availability: "measured",
    redirArcPx: input.redirArcPx,
    achieved,
    residual: input.target === null ? null : achieved - input.target,
  };
}

/** Read the exact production impact metric for an already-owned landing. */
export function scoredContactImpact(
  detection: Parameters<typeof redirArcPxAtLanding>[0],
  input: { target: number | null; landingFrame: number | null; responseWindowComplete: boolean },
): ScoredContactImpactOutcome {
  const redirArcPx = input.landingFrame === null || !input.responseWindowComplete
    ? undefined
    : redirArcPxAtLanding(detection, input.landingFrame, IMPACT_WINDOW);
  return scoredContactImpactFromRedir({ ...input, redirArcPx });
}
