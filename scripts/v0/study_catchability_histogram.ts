/**
 * Histogram every actual readinessCatch() call made during one or more compiles.
 *
 * This is call-site telemetry, not a distinct-arc census: if production computes
 * catchability for a virtual model point, a candidate-pool rank, or committed
 * output telemetry, it is counted once per call. Arcs that fail before any
 * readiness/catchability score is requested are naturally absent.
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_catchability_histogram.ts \
 *     --specs=drums_signature --seeds=0 --budget=100000 --bin=0.05
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import {
  resetCatchabilityTelemetry,
  setCatchabilityTelemetryEnabled,
  snapshotCatchabilityTelemetry,
} from "./optimizer/readiness.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const specNames = (argValue("specs") ?? "drums_signature").split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "100000");
const binWidth = Number(argValue("bin") ?? "0.05");

for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}
for (const seed of seeds) {
  if (!Number.isSafeInteger(seed)) {
    console.error(`invalid seed "${seed}"`);
    process.exit(1);
  }
}
if (!Number.isFinite(budget) || budget <= 0) {
  console.error(`invalid budget "${budget}"`);
  process.exit(1);
}

const f3 = (x: number | null): string => x === null ? "n/a" : x.toFixed(3);
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;

setCatchabilityTelemetryEnabled(true);
resetCatchabilityTelemetry(binWidth);

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const before = snapshotCatchabilityTelemetry().count;
    const t0 = Date.now();
    const cp = compileHandoff(spec, seed, { budget });
    const after = snapshotCatchabilityTelemetry().count;
    console.error(
      `${specName}/seed${seed}: sim_frames=${cp.stats.sim_frames} ` +
        `lines=${cp.track.lines?.length ?? 0} catchability_calls=${after - before} ` +
        `${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

const snap = snapshotCatchabilityTelemetry();
console.log(`\n=== catchability call histogram ===`);
console.log(`specs=${specNames.join(",")} seeds=${seeds.join(",")} budget=${budget} bin=${snap.binWidth}`);
console.log(
  `calls=${snap.count} mean=${f3(snap.mean)} sd=${f3(snap.sd)} ` +
    `min=${f3(snap.min)} max=${f3(snap.max)} below0=${snap.belowZero} above1=${snap.aboveOne}`,
);
console.log("\nbin          count    pct       bar");
const maxCount = Math.max(1, ...snap.bins.map((b) => b.count));
for (const bin of snap.bins) {
  const label = `${bin.lo.toFixed(2)}-${bin.hi.toFixed(2)}`.padEnd(11);
  const bar = "#".repeat(Math.round((bin.count / maxCount) * 40));
  console.log(`${label} ${String(bin.count).padStart(8)} ${pct(bin.fraction).padStart(8)}  ${bar}`);
}
