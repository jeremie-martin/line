/**
 * Offline portfolio/restart headroom probe.
 *
 * This does not change compiler behavior. It runs the current handoff compiler
 * with the same public seed (same per-gap target jitter) and several diagnostic
 * search-lane seeds, then reports how much an oracle best-of-lanes selector
 * could gain.
 *
 * Useful first pass:
 *
 *   npx tsx scripts/v0/portfolio_oracle.ts \
 *     --specs=drums_pendulum,drums_swell,drums_crescendo,opening_burst \
 *     --seed=0 --lanes=0,1,2,3
 *
 * The "full-lane oracle" is an optimistic upper bound: each lane gets the full
 * checkpoint budget, so total work is lane_count x budget. The "equal-slice
 * oracle" gives each lane roughly budget / lane_count work and is a rougher
 * proxy for a simple interleaved portfolio with the same total budget.
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_BUDGETS, GOLDEN_SEEDS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean } from "./score.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { secToFrame } from "./types.ts";
import type { CompileCheckpoint, CompileResult } from "./optimizer/types.ts";

type Args = {
  specs: GoldenSpecName[];
  seeds: number[];
  budgets: number[];
  lanes: number[];
  maxNodes?: number;
  polish: boolean;
  progress: boolean;
  jsonOut?: string;
};

type LaneCheckpoint = {
  budget: number;
  score: number;
  pass: boolean;
  axisQuality: number;
  simFrames: number;
  lane: number;
  searchSeed: number;
  trackHash: string;
};

type RowResult = {
  specName: GoldenSpecName;
  seed: number;
  byLane: Map<number, LaneCheckpoint[]>;
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((part) => part.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function has(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function parsePositiveInts(raw: string | null, fallback: readonly number[], label: string): number[] {
  if (raw === null || raw.trim() === "") return [...fallback];
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`--${label} must be a comma-separated list of positive integers`);
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseLaneIds(raw: string | null): number[] {
  if (raw === null || raw.trim() === "") return [0, 1, 2, 3];
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("--lanes must be a comma-separated list of non-negative integers");
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseSeeds(): number[] {
  const seed = arg("seed");
  if (seed !== null) {
    const value = Number(seed);
    if (!Number.isSafeInteger(value)) throw new Error(`--seed must be a safe integer, got ${seed}`);
    return [value];
  }
  const seeds = arg("seeds");
  if (seeds === null || seeds.trim() === "") return [GOLDEN_SEEDS[0]];
  const values = seeds.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isSafeInteger(value))) {
    throw new Error("--seeds must be a comma-separated list of safe integers");
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseSpecs(): GoldenSpecName[] {
  const raw = arg("specs");
  const fallback = [
    "drums_pendulum",
    "drums_swell",
    "drums_crescendo",
    "opening_burst",
  ] as const;
  if (raw === null || raw.trim() === "") return [...fallback];
  return raw.split(",").map((part) => part.trim()).filter(Boolean) as GoldenSpecName[];
}

function parseArgs(): Args {
  const maxNodesRaw = arg("max-nodes");
  const maxNodes = maxNodesRaw === null ? undefined : Number(maxNodesRaw);
  if (maxNodes !== undefined && (!Number.isInteger(maxNodes) || maxNodes <= 0)) {
    throw new Error(`--max-nodes must be a positive integer, got ${maxNodesRaw}`);
  }
  return {
    specs: parseSpecs(),
    seeds: parseSeeds(),
    budgets: parsePositiveInts(arg("budgets"), DEFAULT_BUDGETS, "budgets"),
    lanes: parseLaneIds(arg("lanes")),
    maxNodes,
    polish: !has("no-polish"),
    progress: !has("quiet"),
    jsonOut: arg("json-out") ?? undefined,
  };
}

function searchSeedForLane(publicSeed: number, lane: number): number {
  if (lane === 0) return publicSeed;
  return (
    Math.imul(publicSeed | 0, 0x45d9f3b) ^
    Math.imul(lane | 0, 0x119de1f3) ^
    0x6a09e667
  ) | 0;
}

function checkpoint(result: CompileResult, budget: number): CompileCheckpoint {
  const found = result.checkpoints.find((candidate) => candidate.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint for budget ${budget}`);
  return found;
}

function trackHash(checkpoint: CompileCheckpoint): string {
  return createHash("sha256").update(JSON.stringify(checkpoint.track)).digest("hex");
}

function scoreCheckpoint(
  checkpoint: CompileCheckpoint,
  totalFrames: number,
  lane: number,
  searchSeed: number,
): LaneCheckpoint {
  const scored = scoreDriftReport(checkpoint.report, { totalFrames });
  return {
    budget: checkpoint.budget,
    score: scored.score,
    pass: scored.contract_passed,
    axisQuality: scored.axis_quality,
    simFrames: checkpoint.stats.sim_frames,
    lane,
    searchSeed,
    trackHash: trackHash(checkpoint),
  };
}

function shiftedScore(values: number[]): number {
  return shiftedGeometricMean(values);
}

function suiteScore(rows: LaneCheckpoint[], keys: string[]): number {
  const bySpec = new Map<string, LaneCheckpoint[]>();
  rows.forEach((row, index) => {
    const key = keys[index];
    bySpec.set(key, [...(bySpec.get(key) ?? []), row]);
  });
  const specScores = [...bySpec.values()].map((group) =>
    shiftedScore(group.map((row) => row.score))
  );
  return shiftedScore(specScores);
}

function fmtBudget(budget: number): string {
  return budget % 1000 === 0 ? `${budget / 1000}k` : String(budget);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function elapsed(startMs: number): string {
  return `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
}

function bestByScore(candidates: LaneCheckpoint[]): LaneCheckpoint {
  return candidates.reduce((best, row) => row.score > best.score ? row : best);
}

function laneCheckpointSummary(row: LaneCheckpoint): object {
  return {
    lane: row.lane,
    search_seed: row.searchSeed,
    score: row.score,
    pass: row.pass,
    axis_quality: row.axisQuality,
    sim_frames: row.simFrames,
    track_hash: row.trackHash,
  };
}

function scaledBudget(totalBudget: number, laneCount: number): number {
  return Math.max(1, Math.floor(totalBudget / laneCount));
}

async function runRow(specName: GoldenSpecName, seed: number, args: Args): Promise<RowResult> {
  const rowStart = Date.now();
  if (args.progress) {
    console.error(`[portfolio] start ${specName} seed=${seed}`);
  }
  const spec = await loadGoldenSpec(specName, "base");
  const totalFrames = secToFrame(spec.duration);
  const laneBudgets = [...new Set([
    ...args.budgets,
    ...args.budgets.map((budget) => scaledBudget(budget, args.lanes.length)),
  ])].sort((a, b) => a - b);
  const byLane = new Map<number, LaneCheckpoint[]>();

  for (const lane of args.lanes) {
    const searchSeed = searchSeedForLane(seed, lane);
    const laneStart = Date.now();
    if (args.progress) {
      console.error(
        `[portfolio]   lane=${lane} searchSeed=${searchSeed} budgets=` +
          laneBudgets.map(fmtBudget).join(","),
      );
    }
    const result = compileHandoff(spec, seed, {
      budgets: laneBudgets,
      searchSeed,
      maxNodes: args.maxNodes,
      polish: args.polish,
    });
    byLane.set(
      lane,
      laneBudgets.map((budget) =>
        scoreCheckpoint(checkpoint(result, budget), totalFrames, lane, searchSeed)
      ),
    );
    if (args.progress) {
      const last = rowCheckpoint({ specName, seed, byLane }, lane, laneBudgets[laneBudgets.length - 1]);
      console.error(
        `[portfolio]   done lane=${lane} score=${fmt(last.score)} ` +
          `pass=${last.pass ? "yes" : "no"} sim=${last.simFrames} t=${elapsed(laneStart)}`,
      );
    }
  }

  if (args.progress) {
    console.error(`[portfolio] done ${specName} seed=${seed} t=${elapsed(rowStart)}`);
  }
  return { specName, seed, byLane };
}

function rowCheckpoint(row: RowResult, lane: number, budget: number): LaneCheckpoint {
  const checkpoints = row.byLane.get(lane);
  if (checkpoints === undefined) throw new Error(`missing lane ${lane}`);
  const found = checkpoints.find((checkpoint) => checkpoint.budget === budget);
  if (found === undefined) {
    throw new Error(`${row.specName} seed=${row.seed} lane=${lane} missing budget ${budget}`);
  }
  return found;
}

function printSummary(rows: RowResult[], args: Args): void {
  const rowKeys = rows.map((row) => row.specName);
  const baselineLane = args.lanes.includes(0) ? 0 : args.lanes[0];
  const baselineCurve: number[] = [];
  const fullOracleCurve: number[] = [];
  const equalSliceCurve: number[] = [];

  console.log(
    `portfolio oracle · specs=${args.specs.join(",")} seeds=${args.seeds.join(",")} ` +
      `lanes=${args.lanes.join(",")} budgets=${args.budgets.map(fmtBudget).join(",")} ` +
      `polish=${args.polish}`,
  );
  console.log("");
  console.log("budget        baseline   equal-slice   full-lane    pass baseline/equal/full");

  for (const budget of args.budgets) {
    const equalBudget = scaledBudget(budget, args.lanes.length);
    const baseline = rows.map((row) => rowCheckpoint(row, baselineLane, budget));
    const fullOracle = rows.map((row) =>
      bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, budget)))
    );
    const equalSlice = rows.map((row) =>
      bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, equalBudget)))
    );
    const baselineScore = suiteScore(baseline, rowKeys);
    const fullScore = suiteScore(fullOracle, rowKeys);
    const equalScore = suiteScore(equalSlice, rowKeys);
    baselineCurve.push(baselineScore);
    fullOracleCurve.push(fullScore);
    equalSliceCurve.push(equalScore);
    const pass = (xs: LaneCheckpoint[]) => xs.filter((row) => row.pass).length;
    console.log(
      `${fmtBudget(budget).padStart(6)} ` +
        `${fmt(baselineScore).padStart(13)} ` +
        `${fmt(equalScore).padStart(13)} ` +
        `${fmt(fullScore).padStart(11)} ` +
        `${String(pass(baseline)).padStart(4)}/${String(pass(equalSlice)).padStart(2)}/${String(pass(fullOracle)).padStart(2)}` +
        `  equal uses ${fmtBudget(equalBudget)} per lane`,
    );
  }

  console.log("");
  const baselineCurveScore = shiftedScore(baselineCurve);
  const equalCurveScore = shiftedScore(equalSliceCurve);
  const fullCurveScore = shiftedScore(fullOracleCurve);
  console.log(`baseline curve:    ${fmt(baselineCurveScore)}`);
  console.log(
    `equal-slice curve: ${fmt(equalCurveScore)}  ` +
      `delta=${fmt(equalCurveScore - baselineCurveScore)}`,
  );
  console.log(
    `full-lane curve:   ${fmt(fullCurveScore)}  ` +
      `delta=${fmt(fullCurveScore - baselineCurveScore)} ` +
      `(optimistic, ${args.lanes.length}x work)`,
  );

  const lastBudget = args.budgets[args.budgets.length - 1];
  const equalLastBudget = scaledBudget(lastBudget, args.lanes.length);
  const gains = rows.map((row) => {
    const base = rowCheckpoint(row, baselineLane, lastBudget);
    const full = bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, lastBudget)));
    const equal = bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, equalLastBudget)));
    return { row, base, full, equal };
  });

  console.log("");
  console.log(`largest full-lane gains at ${fmtBudget(lastBudget)}:`);
  gains
    .slice()
    .sort((a, b) => (b.full.score - b.base.score) - (a.full.score - a.base.score))
    .slice(0, 8)
    .forEach(({ row, base, full }) => {
      console.log(
        `  ${row.specName.padEnd(22)} seed=${row.seed} ` +
          `+${fmt(full.score - base.score).padStart(7)} ` +
          `lane=${full.lane} searchSeed=${full.searchSeed} score=${fmt(full.score)}`,
      );
    });

  console.log("");
  console.log(`largest equal-slice gains at total ${fmtBudget(lastBudget)}:`);
  gains
    .slice()
    .sort((a, b) => (b.equal.score - b.base.score) - (a.equal.score - a.base.score))
    .slice(0, 8)
    .forEach(({ row, base, equal }) => {
      console.log(
        `  ${row.specName.padEnd(22)} seed=${row.seed} ` +
          `${fmt(equal.score - base.score).padStart(8)} ` +
          `lane=${equal.lane} perLane=${fmtBudget(equalLastBudget)} score=${fmt(equal.score)}`,
      );
    });
}

function writeJson(rows: RowResult[], args: Args): void {
  if (args.jsonOut === undefined) return;
  const outputPath = resolve(args.jsonOut);
  const rowKeys = rows.map((row) => row.specName);
  const baselineLane = args.lanes.includes(0) ? 0 : args.lanes[0];
  const budgets = args.budgets.map((budget) => {
    const equalBudget = scaledBudget(budget, args.lanes.length);
    const baseline = rows.map((row) => rowCheckpoint(row, baselineLane, budget));
    const fullOracle = rows.map((row) =>
      bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, budget)))
    );
    const equalSlice = rows.map((row) =>
      bestByScore(args.lanes.map((lane) => rowCheckpoint(row, lane, equalBudget)))
    );
    return {
      budget,
      equal_slice_lane_budget: equalBudget,
      baseline_score: suiteScore(baseline, rowKeys),
      full_lane_oracle_score: suiteScore(fullOracle, rowKeys),
      equal_slice_oracle_score: suiteScore(equalSlice, rowKeys),
      baseline_passed: baseline.filter((row) => row.pass).length,
      full_lane_passed: fullOracle.filter((row) => row.pass).length,
      equal_slice_passed: equalSlice.filter((row) => row.pass).length,
      full_lane_winners: fullOracle.map((row) => ({
        lane: row.lane,
        search_seed: row.searchSeed,
        score: row.score,
        pass: row.pass,
      })),
      equal_slice_winners: equalSlice.map((row) => ({
        lane: row.lane,
        search_seed: row.searchSeed,
        score: row.score,
        pass: row.pass,
      })),
      rows: rows.map((row, index) => {
        const base = baseline[index];
        const full = fullOracle[index];
        const equal = equalSlice[index];
        return {
          spec: row.specName,
          seed: row.seed,
          baseline: laneCheckpointSummary(base),
          full_lane_winner: laneCheckpointSummary(full),
          full_lane_delta: full.score - base.score,
          equal_slice_winner: laneCheckpointSummary(equal),
          equal_slice_delta: equal.score - base.score,
          lanes: args.lanes.map((lane) =>
            laneCheckpointSummary(rowCheckpoint(row, lane, budget))
          ),
          equal_slice_lanes: args.lanes.map((lane) =>
            laneCheckpointSummary(rowCheckpoint(row, lane, equalBudget))
          ),
        };
      }),
    };
  });
  writeFileSync(outputPath, JSON.stringify({
    source: "scripts/v0/portfolio_oracle.ts",
    args: {
      specs: args.specs,
      seeds: args.seeds,
      budgets: args.budgets,
      lanes: args.lanes,
      max_nodes: args.maxNodes ?? null,
      polish: args.polish,
    },
    budgets,
    rows: rows.map((row) => ({
      spec: row.specName,
      seed: row.seed,
      lanes: args.lanes.map((lane) => ({
        lane,
        checkpoints: row.byLane.get(lane) ?? [],
      })),
    })),
  }, null, 2));
  console.error(`[portfolio] wrote ${outputPath}`);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const rows: RowResult[] = [];
  for (const specName of args.specs) {
    for (const seed of args.seeds) {
      rows.push(await runRow(specName, seed, args));
    }
  }
  printSummary(rows, args);
  writeJson(rows, args);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
