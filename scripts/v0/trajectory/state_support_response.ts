/**
 * Fixed, state-normalized local support actions for an exact response assay.
 *
 * This is deliberately not a compiler menu or a target solver.  It asks one
 * narrow question: from the measured state immediately after a contact, do
 * small tangent actions produce a coherent, directional exact response over a
 * fixed physical horizon?  No duration class, next event, or authored axis is
 * an input.
 */
import type { SupportPathPlan } from "./envelope/realizer.ts";
import type { ExactResponseBoundary } from "./state_coupled_support.ts";

export type StateSupportResponseAction = {
  id: string;
  /** Mean tangent residual relative to the observed response heading. */
  gradeResidualDeg: number;
  /** Log2 temporal curvature power; negative spends turn early, positive late. */
  curvatureSkew: number;
};

/**
 * A small, non-redundant symmetric stencil.  Curvature has no geometric effect
 * at zero grade residual, so the center appears once instead of wasting three
 * nominally different but identical actions.
 */
export const STATE_SUPPORT_RESPONSE_ACTIONS: readonly StateSupportResponseAction[] = [
  { id: "neutral", gradeResidualDeg: 0, curvatureSkew: 0 },
  { id: "grade_negative", gradeResidualDeg: -16, curvatureSkew: 0 },
  { id: "grade_positive", gradeResidualDeg: 16, curvatureSkew: 0 },
  { id: "grade_negative_early", gradeResidualDeg: -16, curvatureSkew: -1 },
  { id: "grade_negative_late", gradeResidualDeg: -16, curvatureSkew: 1 },
  { id: "grade_positive_early", gradeResidualDeg: 16, curvatureSkew: -1 },
  { id: "grade_positive_late", gradeResidualDeg: 16, curvatureSkew: 1 },
] as const;

/**
 * A second, deliberately one-dimensional follow-up after the coarse stencil
 * reveals a contact-mode boundary. It refines only grade around zero: no new
 * topology, duration rule, curvature, or action-selection logic is added.
 */
export const STATE_SUPPORT_RESPONSE_THRESHOLD_ACTIONS: readonly StateSupportResponseAction[] = [
  { id: "grade_negative_8", gradeResidualDeg: -8, curvatureSkew: 0 },
  { id: "grade_negative_4", gradeResidualDeg: -4, curvatureSkew: 0 },
  { id: "neutral", gradeResidualDeg: 0, curvatureSkew: 0 },
  { id: "grade_positive_4", gradeResidualDeg: 4, curvatureSkew: 0 },
  { id: "grade_positive_8", gradeResidualDeg: 8, curvatureSkew: 0 },
] as const;

export type StateSupportResponseMenu = "coarse-v1" | "threshold-v1";

/** Every menu is source-declared; callers cannot inject arbitrary controls. */
export function stateSupportResponseActions(
  menu: StateSupportResponseMenu,
): readonly StateSupportResponseAction[] {
  if (menu === "coarse-v1") return STATE_SUPPORT_RESPONSE_ACTIONS;
  if (menu === "threshold-v1") return STATE_SUPPORT_RESPONSE_THRESHOLD_ACTIONS;
  throw new Error(`unknown state support response menu ${menu satisfies never}`);
}

export type StateSupportResponsePlan = SupportPathPlan & {
  action: StateSupportResponseAction;
  horizonFrames: number;
  anchor: ExactResponseBoundary["anchor"];
};

/**
 * Create a neutral-occupancy support action with length scaled solely by the
 * exact response speed and fixed physical horizon.  The exact replay observes
 * whether its geometry actually remains supported; no analytic contact model
 * is assumed here.
 */
export function planStateSupportResponse(
  response: ExactResponseBoundary,
  horizonFrames: number,
  action: StateSupportResponseAction,
): StateSupportResponsePlan {
  if (!Number.isSafeInteger(horizonFrames) || horizonFrames <= 0) {
    throw new Error("response horizonFrames must be a positive safe integer");
  }
  if (!Number.isFinite(response.anchor.speedPxPerFrame) || response.anchor.speedPxPerFrame <= 0) {
    throw new Error("response anchor speed must be positive and finite");
  }
  if (!Number.isFinite(response.anchor.headingDeg)) {
    throw new Error("response anchor heading must be finite");
  }
  if (!Number.isFinite(action.gradeResidualDeg) || !Number.isFinite(action.curvatureSkew)) {
    throw new Error("response action controls must be finite");
  }
  const curvaturePower = Math.pow(2, action.curvatureSkew);
  if (!Number.isFinite(curvaturePower) || curvaturePower <= 0) {
    throw new Error("response curvature power must be positive and finite");
  }
  return {
    action: { ...action },
    horizonFrames,
    anchor: copyAnchor(response.anchor),
    intervalFrames: horizonFrames,
    supportIntervals: horizonFrames,
    plannedAirborneIntervals: 0,
    plannedExtentPx: response.anchor.speedPxPerFrame * horizonFrames,
    meanGradeDeg: response.anchor.headingDeg + action.gradeResidualDeg,
    curvaturePower,
  };
}

function copyAnchor(anchor: ExactResponseBoundary["anchor"]): ExactResponseBoundary["anchor"] {
  return {
    ...anchor,
    reference: { ...anchor.reference },
  };
}
