/**
 * Prospective source registry for the recursive-transient continuation study.
 *
 * This intentionally does not import the broad calibration panel. The three
 * source passages, seeds, and contact ordinals were selected from authored
 * score structure before any prefix capture or recurrence observation.
 */
import pickup from "../../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import meterExchange from "../../../benchmark/v2/cases/normative/representative/meter_exchange.ts";
import openHook from "../../../benchmark/v2/cases/normative/representative/open_hook.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import {
  buildTrajectoryCaptureSetup,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";

export const RECURSIVE_TRANSIENT_HELDOUT_CASES = [
  {
    id: "heldout_open_hook_dense",
    cohort: "validation",
    category: "dense",
    spec: openHook,
    sourcePath: "benchmark/v2/cases/normative/representative/open_hook.ts",
    seed: 730301,
    targetGap: 29,
    expectedOutgoingFrames: 19,
    selectionRationale:
      "The first uninterrupted four-contact 20/19-frame block inside the authored open-response return; contacts retain their authored impact sequence.",
    studyScope: "recursive-transient-heldout-v1",
  },
  {
    id: "heldout_meter_exchange_ordinary",
    cohort: "validation",
    category: "ordinary",
    spec: meterExchange,
    sourcePath: "benchmark/v2/cases/normative/representative/meter_exchange.ts",
    seed: 730303,
    targetGap: 34,
    expectedOutgoingFrames: 23,
    selectionRationale:
      "The first four-contact regular compact-meter block after the score's second exchange; it is an ordinary authored cadence with independent impacts.",
    studyScope: "recursive-transient-heldout-v1",
  },
  {
    id: "heldout_pickup_low_air",
    cohort: "validation",
    category: "low_air",
    spec: pickup,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts",
    seed: 730307,
    targetGap: 51,
    expectedOutgoingFrames: 24,
    selectionRationale:
      "The first four-contact steady pickup block after authored air falls below 0.24; the source supplies the impact sequence and no capture outcome informed the choice.",
    studyScope: "recursive-transient-heldout-v1",
  },
] as const satisfies readonly TrajectoryCaptureCase[];

export type RecursiveTransientHeldoutCase = (typeof RECURSIVE_TRANSIENT_HELDOUT_CASES)[number];

export function activeRecursiveTransientHeldoutCases(): readonly RecursiveTransientHeldoutCase[] {
  return RECURSIVE_TRANSIENT_HELDOUT_CASES;
}

export function getRecursiveTransientHeldoutCase(id: string): RecursiveTransientHeldoutCase {
  const panel = RECURSIVE_TRANSIENT_HELDOUT_CASES.find((entry) => entry.id === id);
  if (panel === undefined) throw new Error(`unknown recursive-transient held-out panel ${id}`);
  return panel;
}

export function buildRecursiveTransientHeldoutSetup(
  panel: RecursiveTransientHeldoutCase,
): TrajectoryCaptureSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}
