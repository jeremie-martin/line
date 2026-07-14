/**
 * Explicit target-frame construction for trajectory studies.
 *
 * Contact geometry is anchored at the selected lowest sled point. Its tangent
 * is normally that same point's velocity, with a labelled rider-COM fallback
 * only when the engine does not expose a usable point velocity. Keeping this
 * choice here prevents a future primitive from silently combining a sled-point
 * position with an unrelated heading.
 */
import type { PlanningState, SledPointName, Vec2 } from "./state.ts";

export type TargetFrameHeadingSource = "reference_point_velocity" | "rider_com_velocity";

export type TargetFrame = {
  reference: Vec2;
  headingDeg: number;
  speedPxPerFrame: number;
  /** Maximum exposed sled-point separation; the cross-track local scale. */
  sledSpanPx: number;
  anchorPoint: SledPointName | "rider";
  headingSource: TargetFrameHeadingSource;
};

export type TargetFrameOptions = {
  /**
   * `contact_point` is the default physical frame. `rider_com` exists only as
   * an explicitly labelled diagnostic comparator; neither is a score proxy.
   */
  heading?: "contact_point" | "rider_com";
};

export function targetFrameFromPlanningState(
  state: PlanningState,
  options: TargetFrameOptions = {},
): TargetFrame {
  const requested = options.heading ?? "contact_point";
  const referenceVelocity = state.referenceVelocity;
  const useReference = requested === "contact_point" && usableVelocity(referenceVelocity);
  const velocity = useReference ? referenceVelocity! : state.velocity;
  if (!usableVelocity(velocity)) {
    throw new Error("target frame requires a finite, non-zero heading velocity");
  }
  const speed = Math.hypot(velocity.x, velocity.y);
  return {
    reference: { ...state.reference },
    headingDeg: Math.atan2(velocity.y, velocity.x) * 180 / Math.PI,
    speedPxPerFrame: speed,
    sledSpanPx: sledSpan(state),
    anchorPoint: state.referencePointName,
    headingSource: useReference ? "reference_point_velocity" : "rider_com_velocity",
  };
}

function sledSpan(state: PlanningState): number {
  const positions = Object.values(state.points)
    .map((point) => point?.position)
    .filter((position): position is Vec2 => position !== undefined);
  let span = 0;
  for (let left = 0; left < positions.length; left++) {
    for (let right = left + 1; right < positions.length; right++) {
      const a = positions[left]!;
      const b = positions[right]!;
      span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  // A missing point set is valid only for diagnostics. Preserve a finite,
  // non-zero unit rather than letting a cross-track conversion become NaN.
  return span > 1e-9 ? span : 1;
}

function usableVelocity(value: Vec2 | null): value is Vec2 {
  return value !== null &&
    Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Math.hypot(value.x, value.y) > 1e-9;
}
