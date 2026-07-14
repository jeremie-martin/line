/**
 * Target-blind input surface for post-impact construction.
 *
 * This leaf deliberately has no fixture parser, filesystem access, runtime
 * environment access, or compiler-policy import. Construction receives only
 * a replayable physical prefix, the current contact, and a bounded way to add
 * static lines to that prefix. The fixture boundary owns how those values are
 * reconstructed and keeps all outgoing observation outside this surface.
 */
import type { PostimpactImpactConvention, PostimpactTrackLine } from "./postimpact_physics.ts";
import type { PlanningState } from "./state.ts";

export const POSTIMPACT_MAX_LINE_ID = 0x7fffffff;

/** The physical prefix data that construction may inspect or replay. */
export type PostimpactConstructionPreparedPrefix = {
  // deno-lint-ignore no-explicit-any
  engine: any;
  targetPlanningState: PlanningState;
  nextLineId: number;
  /**
   * Engine-specific line conversion stays at the fixture boundary. The
   * construction leaf receives this as a physical replay operation, not a
   * source of authored schedule data or runtime configuration.
   */
  // deno-lint-ignore no-explicit-any
  addTrackLines: (engine: any, lines: readonly PostimpactTrackLine[]) => any;
  /**
   * The fixture boundary binds the production impact metric. Construction can
   * compare its opaque outcomes but cannot import the compiler substrate or
   * reach environment-tuned scorer state on its own.
   */
  scoreContactImpact: (detection: unknown, input: PostimpactConstructionImpactInput) => unknown;
  /** Active scoring constants sealed by the fixture boundary at replay start. */
  impactConvention: Readonly<PostimpactImpactConvention>;
};

/** The sole authored event exposed before outgoing observation opens. */
export type PostimpactConstructionCurrentContact = {
  startFrame: number;
  endFrame: number;
  intervalFrames: number;
  impact: number;
};

/** Input shape for the fixed production impact-comparator adapter. */
export type PostimpactConstructionImpactInput = {
  target: number | null;
  landingFrame: number | null;
  responseWindowComplete: boolean;
};

export type PostimpactConstructionContext = {
  readonly prepared: Readonly<PostimpactConstructionPreparedPrefix>;
  readonly current: Readonly<PostimpactConstructionCurrentContact>;
};

/**
 * Reserve a contiguous static-line range without mutating an engine. Keeping
 * this arithmetic with the narrow construction contract prevents a callback
 * from importing the fixture reader solely to obtain its allocator.
 */
export function postimpactLineIdRange(
  nextLineId: number,
  lineCount: number,
): { start: number; end: number } {
  assertNonNegativeSigned32Integer("nextLineId", nextLineId);
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) {
    throw new Error("post-impact lineCount must be a positive safe integer");
  }
  const end = nextLineId + lineCount - 1;
  if (!Number.isSafeInteger(end) || end > POSTIMPACT_MAX_LINE_ID) {
    throw new Error("post-impact line-id allocation overflows signed 32-bit engine ids");
  }
  return { start: nextLineId, end };
}

function assertNonNegativeSigned32Integer(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > POSTIMPACT_MAX_LINE_ID) {
    throw new Error(`post-impact ${name} must be a non-negative signed 32-bit integer`);
  }
}
