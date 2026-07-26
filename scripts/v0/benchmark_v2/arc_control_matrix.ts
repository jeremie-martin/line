/**
 * Benchmark V2 exploration for declarative arc-control configurations.
 *
 * The configuration matrix is strictly compiler-side:
 *
 *   ordered knob sequence × training method × probe layout × probe range × solver range × proposal count
 *
 * Cases, budgets, seeds, and scoring are deliberately not matrix dimensions.
 *
 * Thin CLI: it enumerates cells from `optimizer/arc_control.ts` and hands them
 * to the shared runner in `compiler_matrix.ts`, which owns the seed epoch,
 * snapshots, resume, the paired report, and the exploration-only authority. That
 * orchestration used to live here and was the obvious thing for the next sweep
 * to copy; it is now shared instead.
 *
 * Examples:
 *   # Inspect the generated compiler configurations without any paid work.
 *   npm run benchmark:v2:arc-control-matrix -- --dry-run --knobs=whole_rotation,tail_pitch
 *
 *   # A short actual-V2 smoke: source-default, reversed order, joint, sequential.
 *   npm run benchmark:v2:arc-control-matrix -- --name=smoke-01 --seeds=2 \
 *     --configurations=base_additive--signed3--whole_rotation__tail_pitch,base_additive--signed3--tail_pitch__whole_rotation,base_joint--signed3--whole_rotation__tail_pitch,sequential_conditional--signed3--whole_rotation__tail_pitch
 */
import {
  matrixArgument,
  positiveNumberList,
  runCompilerConfigurationMatrix,
} from "./compiler_matrix.ts";
import {
  ARC_CONTROL_DEFAULT,
  ARC_PROPOSAL_COUNT_DEFAULT,
  ARC_PROBE_RANGE_SCALE_DEFAULT,
  ARC_PROPOSAL_RANGE_SCALE_DEFAULT,
  enumerateArcControlConfigurations,
  type ArcControlConfiguration,
  type ArcProbeLayoutId,
  type ArcTrainingMethod,
} from "../optimizer/arc_control.ts";
import { getArcKnob, type ArcKnobId } from "../optimizer/arc_actuator.ts";

const argv = process.argv.slice(2);

const knobs = (matrixArgument("knobs") ?? "whole_rotation,tail_pitch")
  .split(",").map((value) => value.trim()).filter(Boolean) as ArcKnobId[];
const sequences = matrixArgument("sequences")?.split(",").map((entry) =>
  entry.split("__").map((value) => value.trim()).filter(Boolean) as ArcKnobId[]
);
const maxKnobs = Number(matrixArgument("max-knobs") ?? "2");
const allowRepeated = argv.includes("--allow-repeated");
const methods = matrixArgument("methods")?.split(",").map((value) => value.trim())
  .filter(Boolean) as ArcTrainingMethod[] | undefined;
/** Keep a nominal layout explicit by default: registering a future layout must
 * never silently multiply an existing paid experiment. Layout remains an
 * ordinary selected compiler axis through --probe-layouts. */
const probeLayouts = (matrixArgument("probe-layouts") ?? "signed3")
  .split(",").map((value) => value.trim()).filter(Boolean) as ArcProbeLayoutId[];
const probeRangeScales = positiveNumberList(
  "probe-range-scales",
  ARC_PROBE_RANGE_SCALE_DEFAULT,
);
const proposalRangeScales = positiveNumberList(
  "proposal-range-scales",
  ARC_PROPOSAL_RANGE_SCALE_DEFAULT,
);
const proposalCounts = (matrixArgument("proposal-counts") ??
  String(ARC_PROPOSAL_COUNT_DEFAULT))
  .split(",").map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));

if (!Number.isInteger(maxKnobs) || maxKnobs < 1) {
  throw new Error(`--max-knobs must be a positive integer`);
}
for (const knob of knobs) getArcKnob(knob);
for (const sequence of sequences ?? []) for (const knob of sequence) getArcKnob(knob);

const configurations = enumerateArcControlConfigurations({
  knobs,
  maxKnobs,
  probeLayouts,
  probeRangeScales,
  proposalRangeScales,
  proposalCounts,
  ...(allowRepeated ? { allowRepeated: true } : {}),
  ...(methods === undefined ? {} : { trainingMethods: methods }),
  ...(sequences === undefined ? {} : { sequences }),
});

function environmentFor(
  configuration: ArcControlConfiguration,
): Record<string, string> {
  const isSourceDefault =
    configuration.trainingMethod === ARC_CONTROL_DEFAULT.trainingMethod &&
    configuration.probeLayout === ARC_CONTROL_DEFAULT.probeLayout &&
    configuration.probeRangeScale === ARC_CONTROL_DEFAULT.probeRangeScale &&
    configuration.proposalRangeScale === ARC_CONTROL_DEFAULT.proposalRangeScale &&
    configuration.proposalCount === ARC_CONTROL_DEFAULT.proposalCount &&
    configuration.sequence.join("\0") === ARC_CONTROL_DEFAULT.sequence.join("\0");
  if (isSourceDefault) return {};
  return {
    LR_AIM_KNOB_SEQUENCE: configuration.sequence.join(","),
    LR_AIM_TRAINING_METHOD: configuration.trainingMethod,
    LR_AIM_PROBE_LAYOUT: configuration.probeLayout,
    LR_AIM_PROBE_RANGE_SCALE: String(configuration.probeRangeScale),
    LR_AIM_PROPOSAL_RANGE_SCALE: String(configuration.proposalRangeScale),
    LR_AIM_PROPOSAL_COUNT: String(configuration.proposalCount),
  };
}

await runCompilerConfigurationMatrix<ArcControlConfiguration>({
  schema: "line.benchmark-v2.arc-control-matrix.v2",
  configurationAxes: [
    "ordered_knob_sequence",
    "training_method",
    "probe_layout",
    "probe_range_scale",
    "proposal_range_scale",
    "proposal_count",
  ],
  defaultOutputRoot: "generated/benchmark-v2/arc-control-matrices",
  explorationPrefix: "arc-control-matrix",
  configurations,
  idOf: (configuration) => configuration.id,
  environmentFor,
  knownArguments: [
    "knobs",
    "sequences",
    "max-knobs",
    "methods",
    "probe-layouts",
    "probe-range-scales",
    "proposal-range-scales",
    "proposal-counts",
  ],
  knownFlags: ["allow-repeated"],
});
