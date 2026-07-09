/**
 * Candidate-pool coverage study (observation only).
 *
 * For each targeted gap, compare the best viable candidate on every scored axis
 * with the best candidate that reached handoff scoring and the final selected
 * track. This isolates generation, bounded-pool admission, and downstream
 * selection loss on the current compiler without changing any policy.
 */
import { writeFileSync } from "node:fs";
import {
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { AXES, type AxisName, type AxisValues } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = [
  "drums_dropout",
  "drums_pulse",
  "drums_signature",
  "skyline_push",
  "terrace_sprint",
  "dense_echo_climb",
  "syncopated_lift",
  "rolling_drop",
].join(",");
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
for (const spec of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) {
    throw new Error(`unknown spec "${spec}"`);
  }
}

type CoverageRow = {
  spec: string;
  seed: number;
  gapIndex: number;
  axis: AxisName;
  target: number;
  viableCandidates: number;
  scoredCandidates: number;
  selectedAbsError: number;
  bestViableAbsError: number;
  bestScoredAbsError: number | null;
};

const rows: CoverageRow[] = [];
enableLandingWindowProbe();

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const started = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const { records, dropped } = drainLandingWindowProbe();
    if (dropped > 0) throw new Error(`${specName}/s${seed}: dropped ${dropped} probe records`);
    const byGap = new Map<number, LandingWindowProbeRecord[]>();
    for (const record of records) {
      if (record.cost === null || record.achieved === undefined) continue;
      const group = byGap.get(record.gapIndex) ?? [];
      group.push(record);
      byGap.set(record.gapIndex, group);
    }

    for (const gapReport of checkpoint.report.gaps) {
      const candidates = byGap.get(gapReport.gap_index) ?? [];
      if (candidates.length === 0) continue;
      const scored = candidates.filter((candidate) => candidate.handoffScore !== undefined);
      for (const axis of AXES) {
        const selected = gapReport.axes[axis];
        if (selected === undefined) continue;
        const errorOf = (candidate: LandingWindowProbeRecord): number | null => {
          const achieved: AxisValues = candidate.achievedAtEnd ?? candidate.achieved ?? {};
          const value = achieved[axis];
          return value === undefined || !Number.isFinite(value)
            ? null
            : Math.abs(value - selected.target);
        };
        const viableErrors = candidates.map(errorOf).filter((v): v is number => v !== null);
        if (viableErrors.length === 0) continue;
        const scoredErrors = scored.map(errorOf).filter((v): v is number => v !== null);
        rows.push({
          spec: specName,
          seed,
          gapIndex: gapReport.gap_index,
          axis,
          target: selected.target,
          viableCandidates: viableErrors.length,
          scoredCandidates: scoredErrors.length,
          selectedAbsError: Math.abs(selected.error),
          bestViableAbsError: Math.min(...viableErrors),
          bestScoredAbsError: scoredErrors.length === 0 ? null : Math.min(...scoredErrors),
        });
      }
    }
    console.error(
      `  ${specName}/s${seed}: ${records.length} candidates, ${byGap.size} gaps, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const mean = (values: number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
const f3 = (value: number): string => Number.isFinite(value) ? value.toFixed(3) : "n/a";
const material = 0.025;

console.log(`\n=== candidate pool coverage (budget ${budget}, ${specNames.length} specs x ${seeds.length} seeds) ===`);
for (const axis of AXES) {
  const axisRows = rows.filter((row) => row.axis === axis);
  if (axisRows.length === 0) continue;
  const withScored = axisRows.filter((row) => row.bestScoredAbsError !== null);
  const generationOpportunity = axisRows.filter(
    (row) => row.bestViableAbsError + material < row.selectedAbsError,
  );
  const poolOpportunity = axisRows.filter(
    (row) => row.bestScoredAbsError !== null &&
      row.bestViableAbsError + material < (row.bestScoredAbsError ?? Infinity),
  );
  const selectionOpportunity = withScored.filter(
    (row) => (row.bestScoredAbsError ?? Infinity) + material < row.selectedAbsError,
  );
  console.log(
    `${axis.padEnd(10)} rows=${String(axisRows.length).padStart(5)}` +
      ` selected=${f3(mean(axisRows.map((row) => row.selectedAbsError)))}` +
      ` viable=${f3(mean(axisRows.map((row) => row.bestViableAbsError)))}` +
      ` scored=${f3(mean(withScored.map((row) => row.bestScoredAbsError ?? NaN)))}` +
      ` opportunities generated/pool/selection=` +
      `${generationOpportunity.length}/${poolOpportunity.length}/${selectionOpportunity.length}`,
  );
}

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  console.log(`\nrows -> ${outPath}`);
}
