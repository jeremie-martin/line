/**
 * Fresh V4 roster for the fixed distributed-forward four-control recurrence.
 *
 * This cohort is source-declared before capture and is isolated from both the
 * legacy calibration panel and the previously observed V3 held-out registry.
 */
import pickupShifted from "../../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import splitSignal from "../../../benchmark/v2/cases/normative/representative/split_signal.ts";
import wideBreaths from "../../../benchmark/v2/cases/normative/representative/wide_breaths.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import {
  buildTrajectoryCaptureSetup,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";

export const RECURSIVE_TRANSIENT_FOUR_CONTROL_CASES = [
  {
    id: "four_control_split_signal_dense",
    cohort: "validation",
    category: "dense",
    spec: splitSignal,
    sourcePath: "benchmark/v2/cases/normative/representative/split_signal.ts",
    seed: 730401,
    targetGap: 13,
    expectedOutgoingFrames: 17,
    selectionRationale:
      "The first uninterrupted four-contact 16/17-frame compact block in the authored split-signal answer phrase; contact impacts remain source-authored.",
    studyScope: "recursive-transient-distributed-four-v4",
  },
  {
    id: "four_control_wide_breaths_ordinary",
    cohort: "validation",
    category: "ordinary",
    spec: wideBreaths,
    sourcePath: "benchmark/v2/cases/normative/representative/wide_breaths.ts",
    seed: 730403,
    targetGap: 34,
    expectedOutgoingFrames: 28,
    selectionRationale:
      "A regular four-contact middle-groove pulse before the double-breath transition, chosen from authored cadence and impacts only.",
    studyScope: "recursive-transient-distributed-four-v4",
  },
  {
    id: "four_control_pickup_shifted_low_air",
    cohort: "validation",
    category: "low_air",
    spec: pickupShifted,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts",
    seed: 730407,
    targetGap: 59,
    expectedOutgoingFrames: 24,
    selectionRationale:
      "The first stable four-contact shifted pickup block after authored air falls below 0.20; this is a distinct V2 timing variant, not the observed base-score fixture.",
    studyScope: "recursive-transient-distributed-four-v4",
  },
] as const satisfies readonly TrajectoryCaptureCase[];

export type RecursiveTransientFourControlCase = (typeof RECURSIVE_TRANSIENT_FOUR_CONTROL_CASES)[number];

export function activeRecursiveTransientFourControlCases(): readonly RecursiveTransientFourControlCase[] {
  return RECURSIVE_TRANSIENT_FOUR_CONTROL_CASES;
}

export function getRecursiveTransientFourControlCase(id: string): RecursiveTransientFourControlCase {
  const panel = RECURSIVE_TRANSIENT_FOUR_CONTROL_CASES.find((entry) => entry.id === id);
  if (panel === undefined) throw new Error(`unknown four-control recursive-transient panel ${id}`);
  return panel;
}

export function buildRecursiveTransientFourControlSetup(
  panel: RecursiveTransientFourControlCase,
): TrajectoryCaptureSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}
