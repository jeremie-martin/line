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

/** Floors may be 0, so this cannot reuse `positiveNumberList`. */
function readinessFloorList(): number[] {
  const raw = matrixArgument("readiness-floors");
  if (raw === undefined) return [OBJECTIVE_CONTROL_DEFAULT.readinessFloor];
  return raw.split(",").map((entry) => {
    const floor = Number(entry.trim());
    if (!Number.isFinite(floor) || floor < 0 || floor >= 1) {
      throw new Error(
        `--readiness-floors entries must be in [0, 1), got ${entry.trim()}`,
      );
    }
    return floor;
  });
}

/** Ratio sweeps need this; see objectiveControlEnvironment. The id carries it so
 *  a gates-off cell can never be confused with the same exponents gates-on. */
const disableSpecGates = process.argv.includes("--disable-spec-gates");

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
  readinessFloors: readinessFloorList(),
});

await runCompilerConfigurationMatrix<ObjectiveControlConfiguration>({
  /* v2: environment emission became per-variable. See
   * optimizer/objective_control.ts objectiveControlEnvironment — v1 cells also
   * disabled handoff's per-spec exponent gates and are not comparable. */
  schema: "line.benchmark-v2.objective-power-matrix.v2",
  configurationAxes: [
    "settled_power",
    "future_power",
    "readiness_power",
    "readiness_floor",
  ],
  defaultOutputRoot: "generated/benchmark-v2/objective-power-matrices",
  explorationPrefix: "objective-power-matrix",
  configurations,
  idOf: (configuration) =>
    disableSpecGates ? `${configuration.id}--nogates` : configuration.id,
  environmentFor: (configuration) =>
    objectiveControlEnvironment(configuration, { disableSpecGates }),
  knownArguments: [
    "settled-powers",
    "future-powers",
    "readiness-powers",
    "readiness-floors",
  ],
  knownFlags: ["disable-spec-gates"],
  dryRunExtras: {
    disableSpecGates,
    note:
      "readiness_power 'follow' is the shipped default: readiness takes the future exponent. " +
      "readiness_floor recalibrates readiness to floor + (1-floor)*readiness, which bounds its " +
      "tail rather than scaling its log weight uniformly the way an exponent does.",
  },
});
