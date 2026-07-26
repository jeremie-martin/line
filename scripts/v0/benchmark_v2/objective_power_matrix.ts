/**
 * Benchmark V2 exploration over the proposal objective's exponents.
 *
 * Thin CLI: it enumerates cells from `optimizer/objective_control.ts` and hands
 * them to the shared runner in `compiler_matrix.ts`. All orchestration — seed
 * epoch, snapshots, resume, paired report, exploration-only authority — lives
 * there and is the same machinery the arc-control matrix uses.
 *
 * Examples:
 *   # Price the experiment without paying for it.
 *   npm run benchmark:v2:objective-power-matrix -- --dry-run \
 *     --future-powers=1,1.5,2 --readiness-powers=0.5,0.75,1
 *
 *   # Sweep A: does the near-exact projected term deserve more weight than the
 *   # fuzzy readiness term? 9 cells, 16 seeds.
 *   npm run benchmark:v2:objective-sweep-a
 */
import {
  matrixArgument,
  positiveNumberList,
  runCompilerConfigurationMatrix,
} from "./compiler_matrix.ts";
import {
  enumerateObjectiveControlConfigurations,
  objectiveControlEnvironment,
  OBJECTIVE_CONTROL_DEFAULT,
  type ObjectiveControlConfiguration,
} from "../optimizer/objective_control.ts";

/** `follow` enumerates the unset cell, where readiness tracks the future
 *  exponent. It is spelled out rather than implied so a grid that means to test
 *  the current compiler says so. */
function readinessPowerList(): (number | null)[] {
  const raw = matrixArgument("readiness-powers");
  if (raw === undefined) return [OBJECTIVE_CONTROL_DEFAULT.readinessPower];
  return raw.split(",").map((entry) => {
    const value = entry.trim();
    if (value === "follow") return null;
    const power = Number(value);
    if (!Number.isFinite(power) || power <= 0) {
      throw new Error(
        `--readiness-powers entries must be positive numbers or "follow", got ${value}`,
      );
    }
    return power;
  });
}

const configurations = enumerateObjectiveControlConfigurations({
  settledPowers: positiveNumberList(
    "settled-powers",
    OBJECTIVE_CONTROL_DEFAULT.settledPower,
  ),
  futurePowers: positiveNumberList(
    "future-powers",
    OBJECTIVE_CONTROL_DEFAULT.futurePower,
  ),
  readinessPowers: readinessPowerList(),
});

await runCompilerConfigurationMatrix<ObjectiveControlConfiguration>({
  schema: "line.benchmark-v2.objective-power-matrix.v1",
  configurationAxes: ["settled_power", "future_power", "readiness_power"],
  defaultOutputRoot: "generated/benchmark-v2/objective-power-matrices",
  explorationPrefix: "objective-power-matrix",
  configurations,
  idOf: (configuration) => configuration.id,
  environmentFor: objectiveControlEnvironment,
  knownArguments: ["settled-powers", "future-powers", "readiness-powers"],
  dryRunExtras: {
    note:
      "readiness_power 'follow' is the shipped default: readiness takes the future exponent. " +
      "A cell pinning readiness to 1 is a real arm, not the baseline.",
  },
});
