/**
 * Declared trajectory-study panels and their materialized compiler inputs.
 *
 * This is study scaffolding, not a production candidate source. Keeping the
 * panel declaration in one place lets fixture capture and observation studies
 * agree on source, seed, target gap, and frame conventions.
 */
import believer from "../../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import dense from "../../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import frontier5 from "../../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import countercurrent from "../../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import dense240 from "../../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import frontier4 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier6 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier7 from "../../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import denseDialogue from "../../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import riverReentry from "../../../benchmark/v2/cases/normative/representative/river_reentry.ts";
import sparseLowline from "../../../benchmark/v2/cases/normative/representative/sparse_lowline.ts";
import { benchmarkPolicy } from "../../../benchmark/v2/policy.ts";
import {
  buildTrajectoryCaptureSetup,
  materializeTrajectoryCaptureInput,
  type MaterializedTrajectoryCaptureInput,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureCategory,
  type TrajectoryCaptureCohort,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";

export type TrajectoryPanelCategory = TrajectoryCaptureCategory;
/** `quarantined` rows are retained for audit but cannot be captured or studied again. */
export type TrajectoryPanelCohort = TrajectoryCaptureCohort;
export type ActiveTrajectoryPanelCohort = Exclude<TrajectoryPanelCohort, "quarantined">;

/**
 * The declared conditions for comparable calibration fixtures. A study may
 * inspect a differently captured fixture only after explicitly defining a new
 * protocol; silently mixing search budgets would confound local geometry with
 * a different physical prefix.
 */
export const TRAJECTORY_CALIBRATION_PROTOCOL = {
  engine: "wasm",
  captureBudget: 500_000,
  /** No source-affecting LR knobs are allowed under this protocol label. */
  relevantEnvironment: { LR_ENGINE: "wasm" },
} as const;

/**
 * Calibration results are comparable only when both the physical engine and
 * capture budget match the declared protocol. New protocols must be declared
 * explicitly instead of reusing this label with a different runtime.
 */
export function assertTrajectoryCalibrationProtocol(
  input: { engine: string; captureBudget: number; relevantEnvironment: Record<string, string> },
  context: string,
): void {
  if (input.engine !== TRAJECTORY_CALIBRATION_PROTOCOL.engine) {
    throw new Error(
      `${context} requires LR_ENGINE=${TRAJECTORY_CALIBRATION_PROTOCOL.engine}; received ${input.engine}`,
    );
  }
  if (input.captureBudget !== TRAJECTORY_CALIBRATION_PROTOCOL.captureBudget) {
    throw new Error(
      `${context} requires capture budget ${TRAJECTORY_CALIBRATION_PROTOCOL.captureBudget}; received ${input.captureBudget}`,
    );
  }
  if (!sameEnvironment(input.relevantEnvironment, TRAJECTORY_CALIBRATION_PROTOCOL.relevantEnvironment)) {
    throw new Error(
      `${context} requires canonical LR environment ${JSON.stringify(TRAJECTORY_CALIBRATION_PROTOCOL.relevantEnvironment)}; ` +
      `received ${JSON.stringify(sortedEnvironment(input.relevantEnvironment))}`,
    );
  }
}

function sameEnvironment(left: Record<string, string>, right: Record<string, string>): boolean {
  return JSON.stringify(sortedEnvironment(left)) === JSON.stringify(sortedEnvironment(right));
}

function sortedEnvironment(environment: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(environment).sort(([left], [right]) => left.localeCompare(right)));
}
export type TrajectoryPanelCase = TrajectoryCaptureCase;

/**
 * The initial panel deliberately spans dense continuity, an ordinary
 * representative transition, and the 3--7s low-air family. It is not a
 * selection menu and contains no per-case control values.
 *
 * This generic panel remains calibration plus quarantined historical rows.
 * Prospective validation owns a dedicated registry and capture entrypoint so
 * it cannot inherit this module's broad legacy source closure.
 */
export const TRAJECTORY_PANEL_CASES: Record<TrajectoryPanelCase["id"], TrajectoryPanelCase> = {
  dense: {
    id: "dense",
    cohort: "calibration",
    category: "dense",
    spec: dense,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    seed: 3057130498,
    targetGap: 69,
    selectionRationale: "Fixed dense-recovery stream contact used by the initial containment study.",
  },
  believer36: {
    id: "believer36",
    cohort: "calibration",
    category: "ordinary",
    spec: believer,
    sourcePath: "benchmark/v2/cases/normative/development_music/believer_56_6s.ts",
    seed: 24,
    targetGap: 36,
    selectionRationale:
      "Slow-episode onset passage (authored speed 0.87 + impact 0.82 + air 0.63 jointly; slow in 99% of seeds) — the both-bad tail's prevention point for the energy-carrier (J-valley) program.",
  },
  believer69: {
    id: "believer69",
    cohort: "calibration",
    category: "ordinary",
    spec: believer,
    sourcePath: "benchmark/v2/cases/normative/development_music/believer_56_6s.ts",
    seed: 24,
    targetGap: 69,
    selectionRationale:
      "Deep slow-cluster passage (authored speed 1.0 + impact 0.76 + air 0.64) — mid-episode state for energy-recovery geometry assays.",
  },
  dense240: {
    id: "dense240",
    cohort: "calibration",
    category: "dense",
    spec: dense240,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts",
    seed: 3057130496,
    targetGap: 86,
    selectionRationale: "Fixed 240ms dense-figure contact used by the initial containment study.",
  },
  ordinary: {
    id: "ordinary",
    cohort: "calibration",
    category: "ordinary",
    spec: countercurrent,
    sourcePath: "benchmark/v2/cases/normative/representative/countercurrent.ts",
    seed: 24,
    targetGap: 20,
    selectionRationale: "Fixed ordinary countercurrent transition used by the initial screen.",
  },
  frontier3: {
    id: "frontier3",
    cohort: "calibration",
    category: "low_air",
    spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 24,
    targetGap: 32,
    selectionRationale: "Three-second stage of the initial low-air duration ladder.",
    expectedOutgoingFrames: 120,
  },
  frontier4: {
    id: "frontier4",
    cohort: "calibration",
    category: "low_air",
    spec: frontier4,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts",
    seed: 24,
    targetGap: 54,
    selectionRationale: "Four-second low-air duration variant in the initial ladder.",
    expectedOutgoingFrames: 160,
  },
  frontier5: {
    id: "frontier5",
    cohort: "calibration",
    category: "low_air",
    spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 24,
    targetGap: 54,
    selectionRationale: "Five-second low-air duration parent in the initial ladder.",
    expectedOutgoingFrames: 200,
  },
  frontier6: {
    id: "frontier6",
    cohort: "calibration",
    category: "low_air",
    spec: frontier6,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts",
    seed: 24,
    targetGap: 54,
    selectionRationale: "Six-second low-air duration variant in the initial ladder.",
    expectedOutgoingFrames: 240,
  },
  frontier7: {
    id: "frontier7",
    cohort: "calibration",
    category: "low_air",
    spec: frontier7,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts",
    seed: 24,
    targetGap: 54,
    selectionRationale: "Seven-second low-air duration variant in the initial ladder.",
    expectedOutgoingFrames: 280,
  },
  // Older V2 reserve rows are audit-only. They cannot be reused as active
  // validation because their original comparison protocol was superseded.
  validation_dense_dialogue: {
    id: "validation_dense_dialogue",
    cohort: "quarantined",
    category: "dense",
    spec: denseDialogue,
    sourcePath: "benchmark/v2/cases/normative/representative/dense_dialogue.ts",
    seed: 4099,
    // Source contact ordinal 24: first compact-B reentry after the initial
    // complete compact-A phrase. Chosen from score structure, before capture.
    targetGap: 24,
    selectionRationale: "First compact-B reentry after the initial complete compact-A phrase.",
  },
  validation_river_reentry: {
    id: "validation_river_reentry",
    cohort: "quarantined",
    category: "ordinary",
    spec: riverReentry,
    sourcePath: "benchmark/v2/cases/normative/representative/river_reentry.ts",
    seed: 4103,
    // Source contact ordinal 48: the explicitly authored current-B reentry
    // after the displaced fill, with no compiler-output selection.
    targetGap: 48,
    selectionRationale: "First current-B reentry immediately after the displaced fill.",
  },
  validation_sparse_lowline: {
    id: "validation_sparse_lowline",
    cohort: "quarantined",
    category: "low_air",
    spec: sparseLowline,
    sourcePath: "benchmark/v2/cases/normative/representative/sparse_lowline.ts",
    seed: 4111,
    // Source contact ordinal 28 begins the authored 1.86s low-air passage in
    // the first double-open phrase.
    targetGap: 28,
    selectionRationale: "First double-open breath exit whose outgoing interval is the authored 1.86-second low-air passage.",
  },
  validation_frontier_dense_seed_4127: {
    id: "validation_frontier_dense_seed_4127",
    cohort: "quarantined",
    category: "dense",
    spec: dense,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    seed: 4127,
    targetGap: 69,
    selectionRationale: "Same declared dense-recovery contact under the first fixed reserve research seed.",
  },
  validation_frontier_dense_seed_4133: {
    id: "validation_frontier_dense_seed_4133",
    cohort: "quarantined",
    category: "dense",
    spec: dense,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    seed: 4133,
    targetGap: 69,
    selectionRationale: "Same declared dense-recovery contact under the second fixed reserve research seed.",
  },
  validation_frontier3_seed_4153: {
    id: "validation_frontier3_seed_4153",
    cohort: "quarantined",
    category: "low_air",
    spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 4153,
    targetGap: 32,
    selectionRationale: "Three-second point of the fixed reserve low-air duration ladder.",
    expectedOutgoingFrames: 120,
  },
  validation_frontier4_seed_4153: {
    id: "validation_frontier4_seed_4153",
    cohort: "quarantined",
    category: "low_air",
    spec: frontier4,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts",
    seed: 4153,
    targetGap: 54,
    selectionRationale: "Four-second point of the fixed reserve low-air duration ladder.",
    expectedOutgoingFrames: 160,
  },
  validation_frontier5_seed_4153: {
    id: "validation_frontier5_seed_4153",
    cohort: "quarantined",
    category: "low_air",
    spec: frontier5,
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts",
    seed: 4153,
    targetGap: 54,
    selectionRationale: "Five-second point of the fixed reserve low-air duration ladder.",
    expectedOutgoingFrames: 200,
  },
  validation_frontier6_seed_4153: {
    id: "validation_frontier6_seed_4153",
    cohort: "quarantined",
    category: "low_air",
    spec: frontier6,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts",
    seed: 4153,
    targetGap: 54,
    selectionRationale: "Six-second point of the fixed reserve low-air duration ladder.",
    expectedOutgoingFrames: 240,
  },
  validation_frontier7_seed_4153: {
    id: "validation_frontier7_seed_4153",
    cohort: "quarantined",
    category: "low_air",
    spec: frontier7,
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts",
    seed: 4153,
    targetGap: 54,
    selectionRationale: "Seven-second point of the fixed reserve low-air duration ladder.",
    expectedOutgoingFrames: 280,
  },
};

export type TrajectoryPanelSetup = TrajectoryCaptureSetup;
export type MaterializedTrajectoryPanelInput = MaterializedTrajectoryCaptureInput;

/** Return the rows that may be captured under an active cohort label. */
export function activeTrajectoryPanelCases(cohort: ActiveTrajectoryPanelCohort): TrajectoryPanelCase[] {
  return Object.values(TRAJECTORY_PANEL_CASES).filter((panel) => panel.cohort === cohort);
}

/** Quarantined rows are historical evidence, never valid study inputs. */
export function assertActiveTrajectoryPanel(
  panel: Pick<TrajectoryPanelCase, "id" | "cohort">,
  context: string,
): void {
  if (panel.cohort === "quarantined") {
    throw new Error(`${context} cannot use quarantined trajectory panel ${panel.id}; it is audit-only`);
  }
}

/**
 * The transition-envelope menus were developed on the calibration cohort and
 * cannot be presented as independent validation evidence.
 */
export function assertCalibrationTrajectoryPanel(
  panel: Pick<TrajectoryPanelCase, "id" | "cohort">,
  context: string,
): void {
  if (panel.cohort !== "calibration") {
    throw new Error(
      `${context} requires a calibration trajectory fixture; panel ${panel.id} belongs to ${panel.cohort}`,
    );
  }
}

export function getTrajectoryPanelCase(id: string): TrajectoryPanelCase {
  const panel = TRAJECTORY_PANEL_CASES[id];
  if (panel === undefined) throw new Error(`unknown trajectory panel ${id}`);
  return panel;
}

/** Materialize exactly the compiler-facing input for a declared panel. */
export function buildTrajectoryPanelSetup(panel: TrajectoryPanelCase): TrajectoryPanelSetup {
  return buildTrajectoryCaptureSetup(panel, benchmarkPolicy.transform);
}

export function materializeTrajectoryPanelInput(
  setup: TrajectoryPanelSetup,
): MaterializedTrajectoryPanelInput {
  return materializeTrajectoryCaptureInput(setup);
}
