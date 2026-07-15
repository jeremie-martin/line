/**
 * Frozen cross-regime roster for final-path transition observation.
 *
 * Target contacts were selected from authored topology before this study runs;
 * this is not a result-dependent generator menu.
 */
import dense from "../../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import frontier5 from "../../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import pickup from "../../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import countercurrent from "../../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import dense240 from "../../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import frontier4 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier6 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier7 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import pickupShifted from "../../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import { buildTrajectoryCaptureSetup, type TrajectoryCaptureCase, type TrajectoryCaptureSetup } from "./capture_input.ts";

export const OBSERVED_TRANSITION_PACKET_PANEL_VERSION = "mixed-v1";

export const OBSERVED_TRANSITION_PACKET_CASES = [
  { id: "ordinary", cohort: "validation", category: "ordinary", spec: countercurrent,
    sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts", seed: 24, targetGap: 20,
    selectionRationale: "Ordinary countercurrent contact selected before observation." },
  { id: "dense", cohort: "validation", category: "dense", spec: dense,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts", seed: 3057130498, targetGap: 69,
    selectionRationale: "Authored dense-stream recovery boundary from the failure atlas." },
  { id: "dense240", cohort: "validation", category: "dense", spec: dense240,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts", seed: 3057130496, targetGap: 86,
    selectionRationale: "Authored 240ms dense-figure recovery boundary." },
  { id: "pickup", cohort: "validation", category: "pickup", spec: pickup,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts", seed: 24, targetGap: 90,
    selectionRationale: "Final authored pickup-to-accent interval." },
  { id: "pickup_shifted", cohort: "validation", category: "pickup", spec: pickupShifted,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts", seed: 24, targetGap: 90,
    selectionRationale: "Final shifted authored pickup-to-accent interval." },
  { id: "frontier3", cohort: "validation", category: "low_air", spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts", seed: 24, targetGap: 32,
    selectionRationale: "Declared three-second low-air ladder stage.", expectedOutgoingFrames: 120 },
  { id: "frontier4", cohort: "validation", category: "low_air", spec: frontier4,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts", seed: 24, targetGap: 54,
    selectionRationale: "Declared four-second low-air ladder stage.", expectedOutgoingFrames: 160 },
  { id: "frontier5", cohort: "validation", category: "low_air", spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts", seed: 24, targetGap: 54,
    selectionRationale: "Declared five-second low-air ladder stage.", expectedOutgoingFrames: 200 },
  { id: "frontier6", cohort: "validation", category: "low_air", spec: frontier6,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts", seed: 24, targetGap: 54,
    selectionRationale: "Declared six-second low-air ladder stage.", expectedOutgoingFrames: 240 },
  { id: "frontier7", cohort: "validation", category: "low_air", spec: frontier7,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts", seed: 24, targetGap: 54,
    selectionRationale: "Declared seven-second low-air ladder stage.", expectedOutgoingFrames: 280 },
] as const satisfies readonly TrajectoryCaptureCase[];

export type ObservedTransitionPacketCase = (typeof OBSERVED_TRANSITION_PACKET_CASES)[number];
export const OBSERVED_TRANSITION_PACKET_CASE_IDS = OBSERVED_TRANSITION_PACKET_CASES.map((panel) => panel.id);

export function getObservedTransitionPacketCase(id: string): ObservedTransitionPacketCase {
  const panel = OBSERVED_TRANSITION_PACKET_CASES.find((candidate) => candidate.id === id);
  if (panel === undefined) throw new Error(`unknown observed transition packet case ${id}`);
  return panel;
}

export function buildObservedTransitionPacketSetup(panel: ObservedTransitionPacketCase): TrajectoryCaptureSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}
