/**
 * Immutable observation contract for a physical-prefix projection.
 *
 * A compiler traversal can batch-complete a suffix and therefore omit an
 * ordinary callback at an otherwise real intermediate boundary. This rule
 * selects a donor without inspecting the requested target or any score: take
 * the greatest unskipped observed gap and retain the first callback on ties.
 */
export const PHYSICAL_PREFIX_DONOR_SELECTION_RULE =
  "max_unskipped_gap_then_earliest_callback.v1";

export type PhysicalPrefixProjection = {
  rule: typeof PHYSICAL_PREFIX_DONOR_SELECTION_RULE;
  donorGap: number;
  donorPhase: string;
  donorCallbackOrdinal: number;
  donorSimFrames: number;
  projectedTargetGap: number;
  /** Non-null only when the selected donor itself was observed at the target. */
  directTargetCallbackOrdinal: number | null;
};
