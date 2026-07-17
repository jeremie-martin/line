/**
 * Prospective source registry for the compact tangential-impulse force/solid
 * comparison. Its source-only roster is declared before capture.
 */
import denseRecovery from "../../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import amplitudeTides from "../../../benchmark/v2/cases/normative/representative/amplitude_tides.ts";
import sparseLowline from "../../../benchmark/v2/cases/normative/representative/sparse_lowline.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import {
  buildTrajectoryCaptureSetup,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";

export const COMPACT_FORCE_COMPARISON_CASES = [
  {
    id: "compact_force_dense_recovery",
    cohort: "validation",
    category: "dense",
    spec: denseRecovery,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    seed: 730601,
    targetGap: 50,
    expectedOutgoingFrames: 9,
    selectionRationale:
      "The first 9/9/9-frame dense-stream cluster after its preceding ordinary recovery pulse; source cadence and impacts alone determine the selection.",
    studyScope: "transient-compact-force-comparison-v1",
  },
  {
    id: "compact_force_amplitude_tides",
    cohort: "validation",
    category: "ordinary",
    spec: amplitudeTides,
    sourcePath: "benchmark/v2/cases/normative/representative/amplitude_tides.ts",
    seed: 730603,
    targetGap: 20,
    expectedOutgoingFrames: 21,
    selectionRationale:
      "The first regular 21/21-frame compact pulse after the authored 42-frame opening; no compiler output informed the selection.",
    studyScope: "transient-compact-force-comparison-v1",
  },
  {
    id: "compact_force_sparse_lowline",
    cohort: "validation",
    category: "low_air",
    spec: sparseLowline,
    sourcePath: "benchmark/v2/cases/normative/representative/sparse_lowline.ts",
    seed: 730607,
    targetGap: 16,
    expectedOutgoingFrames: 25,
    selectionRationale:
      "The first 25/25-frame return after the authored 50-frame low-air omission; source cadence, impact sequence, and authored air field alone determine the selection.",
    studyScope: "transient-compact-force-comparison-v1",
  },
] as const satisfies readonly TrajectoryCaptureCase[];

export type CompactForceComparisonCase = (typeof COMPACT_FORCE_COMPARISON_CASES)[number];

export function activeCompactForceComparisonCases(): readonly CompactForceComparisonCase[] {
  return COMPACT_FORCE_COMPARISON_CASES;
}

export function getCompactForceComparisonCase(id: string): CompactForceComparisonCase {
  const panel = COMPACT_FORCE_COMPARISON_CASES.find((entry) => entry.id === id);
  if (panel === undefined) throw new Error(`unknown compact force-comparison panel ${id}`);
  return panel;
}

export function buildCompactForceComparisonSetup(
  panel: CompactForceComparisonCase,
): TrajectoryCaptureSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}
