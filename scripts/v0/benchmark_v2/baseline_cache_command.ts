import { availableParallelism } from "node:os";
import {
  baselineCachePlan,
  extendBaselineCache,
  readBaselineCache,
  renderBaselineCachePlan,
  verifyBaselineCache,
} from "./baseline_cache.ts";

/** The explicit cache command has two deliberately small verbs.  `status`
 * reads and verifies evidence; `extend` is the only operation allowed to
 * compile the frozen baseline tail. */
export function runBaselineCacheCommand(argv: string[]): number {
  const action = argv.find((value) => !value.startsWith("--"));
  if (action !== "status" && action !== "extend") {
    throw new Error(`usage: benchmark baseline-cache status|extend --seeds=N [--jobs=N] [--resume] [--json]`);
  }
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const allowed = new Set(["seeds", "jobs", "baseline"]);
  for (const value of argv) {
    if (!value.startsWith("--")) continue;
    if (value === "--resume" || value === "--json") continue;
    const name = value.slice(2, value.indexOf("=") === -1 ? undefined : value.indexOf("="));
    if (!allowed.has(name) || !value.includes("=")) throw new Error(`unsupported baseline-cache flag ${value}`);
  }
  const seedsRaw = argument("seeds");
  if (seedsRaw === undefined || !/^\d+$/.test(seedsRaw)) throw new Error(`baseline-cache ${action} requires --seeds=N`);
  const seeds = Number(seedsRaw);
  const baselinePath = argument("baseline");
  const jobsRaw = argument("jobs");
  const jobs = jobsRaw === undefined ? Math.min(48, availableParallelism()) : Number(jobsRaw);
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error(`--jobs must be an integer in 1..48`);

  const view = readBaselineCache(baselinePath);
  if (view.campaignScope !== undefined && seeds !== view.campaignScope.seeds) {
    throw new Error(`the active campaign cache is fixed at N=${view.campaignScope.seeds}`);
  }
  const plan = baselineCachePlan(view, seeds);
  verifyBaselineCache(view, plan.coveredSeeds === 0 ? undefined : plan.coveredSeeds);
  if (action === "status") {
    emit(argv, {
      schema: "line.benchmark-v2.baseline-cache-status.v1",
      baseline: view.cache.baselineLabel,
      maximumSeeds: view.cache.ladder.maximumSeedsPerBudget,
      ...plan,
      nextCommand: plan.missingBaselineSeeds === 0
        ? `npm run benchmark -- eval --seeds=${seeds}${baselineArgument(baselinePath)}`
        : `npm run benchmark -- baseline-cache extend --seeds=${seeds} --jobs=${jobs}${baselineArgument(baselinePath)}`,
    });
    return 0;
  }

  const completed = extendBaselineCache({
    seeds,
    jobs,
    resume: argv.includes("--resume"),
    baselinePath,
  });
  emit(argv, {
    schema: "line.benchmark-v2.baseline-cache-extension.v1",
    status: "complete",
    ...completed,
    nextCommand: `npm run benchmark -- eval --seeds=${seeds}${baselineArgument(baselinePath)}`,
  });
  return 0;
}

function baselineArgument(path: string | undefined): string {
  return path === undefined ? "" : ` --baseline=${path}`;
}

function emit(argv: string[], payload: Record<string, unknown>): void {
  if (argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`Canonical baseline cache: ${payload.baseline ?? "extended"}`);
    console.log(renderBaselineCachePlan(payload as any));
    console.log(`  nextCommand: ${payload.nextCommand}`);
  }
}
