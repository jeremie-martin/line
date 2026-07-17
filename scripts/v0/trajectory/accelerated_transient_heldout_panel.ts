/**
 * Prospective source registry for the tangential-impulse transient-release
 * replication. This roster is declared before fixture capture and imports no
 * prior trajectory validation panel.
 */
import denseDialogue from "../../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import countercurrent from "../../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import lowAir from "../../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import {
  buildTrajectoryCaptureSetup,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";

export const ACCELERATED_TRANSIENT_HELDOUT_CASES = [
  {
    id: "accelerated_transient_dense_dialogue",
    cohort: "validation",
    category: "dense",
    spec: denseDialogue,
    sourcePath: "benchmark/v2/cases/normative/representative/dense_dialogue.ts",
    seed: 730501,
    targetGap: 50,
    expectedOutgoingFrames: 17,
    selectionRationale:
      "The first four-contact 13/17/14/17-frame dense figure immediately after the authored long-phrase reset; cadence and contact impacts alone determine the selection.",
    studyScope: "transient-accelerated-release-heldout-v1",
  },
  {
    id: "accelerated_transient_countercurrent_ordinary",
    cohort: "validation",
    category: "ordinary",
    spec: countercurrent,
    sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts",
    seed: 730503,
    targetGap: 25,
    expectedOutgoingFrames: 25,
    selectionRationale:
      "The first regular four-contact 25-frame middle-groove figure after the authored 49-frame break; no compiler output informed the selection.",
    studyScope: "transient-accelerated-release-heldout-v1",
  },
  {
    id: "accelerated_transient_low_air_endurance",
    cohort: "validation",
    category: "low_air",
    spec: lowAir,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 730507,
    targetGap: 43,
    expectedOutgoingFrames: 22,
    selectionRationale:
      "The first four-contact 22-frame return after the authored 200-frame low-air rideout, where the authored air field has begun its next low-air descent.",
    studyScope: "transient-accelerated-release-heldout-v1",
  },
] as const satisfies readonly TrajectoryCaptureCase[];

export type AcceleratedTransientHeldoutCase = (typeof ACCELERATED_TRANSIENT_HELDOUT_CASES)[number];

export function activeAcceleratedTransientHeldoutCases(): readonly AcceleratedTransientHeldoutCase[] {
  return ACCELERATED_TRANSIENT_HELDOUT_CASES;
}

export function getAcceleratedTransientHeldoutCase(id: string): AcceleratedTransientHeldoutCase {
  const panel = ACCELERATED_TRANSIENT_HELDOUT_CASES.find((entry) => entry.id === id);
  if (panel === undefined) throw new Error(`unknown accelerated transient held-out panel ${id}`);
  return panel;
}

export function buildAcceleratedTransientHeldoutSetup(
  panel: AcceleratedTransientHeldoutCase,
): TrajectoryCaptureSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}
