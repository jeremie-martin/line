/**
 * Offline mid-prefix restart headroom probe.
 *
 * This does not change compiler behavior. It first runs the normal handoff
 * compiler, snapshots a few clean prefix nodes, then resumes each prefix with
 * alternate downstream search-lane seeds. The reported branch oracle is an
 * optimistic diagnostic: it asks whether "same beginning, different downstream
 * search" has headroom before we design any production scheduler.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_BUDGETS, GOLDEN_SEEDS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean } from "./score.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNodeSnapshot,
} from "./optimizer/handoff.ts";
import { secToFrame } from "./types.ts";
import type { CompileCheckpoint, CompileResult } from "./optimizer/types.ts";
import type { LeafKey } from "./optimizer/register.ts";

type Args = {
  specs: GoldenSpecName[];
  seeds: number[];
  budgets: number[];
  lanes: number[];
  fractions: number[];
  maxNodes?: number;
  polish: boolean;
  progress: boolean;
  jsonOut?: string;
};

type CaptureTarget = {
  label: string;
  fraction: number;
  targetGapIndex: number;
};

type CaptureSummary = {
  label: string;
  fraction: number;
  target_gap_index: number;
  actual_gap_index: number;
  sim_frames: number;
  phase: string;
  full_duration: boolean;
  output_duration_frames: number;
  start_rank: number;
  skipped_contacts: number;
  ranks: number[];
  key: LeafKey;
};

type CaptureRecord = {
  target: CaptureTarget;
  snapshot: HandoffNodeSnapshot;
  summary: CaptureSummary;
};

type BudgetCandidate = {
  budget: number;
  score: number;
  pass: boolean;
  axisQuality: number;
  totalSimFrames: number;
  budgetExhausted: boolean;
  trackHash: string;
  source: "baseline" | "branch";
  capture?: string;
  lane?: number;
  searchSeed?: number;
  prefixSimFrames?: number;
  suffixBudget?: number;
  suffixSimFrames?: number;
};

type BranchRun = {
  capture: string;
  lane: number;
  searchSeed: number;
  checkpoints: BudgetCandidate[];
};

type RowResult = {
  specName: GoldenSpecName;
  seed: number;
  baseline: BudgetCandidate[];
  captures: CaptureRecord[];
  branches: BranchRun[];
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
  if (raw === null || raw.trim() === "") return [1, 2, 3];
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("--lanes must be a comma-separated list of non-negative integers");
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseFractions(raw: string | null): number[] {
  if (raw === null || raw.trim() === "") return [0.25, 0.5, 0.75];
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isFinite(value) || value <= 0 || value >= 1)) {
    throw new Error("--fractions must be comma-separated numbers in (0, 1)");
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
  if (raw === null || raw.trim() === "") return ["drums_crescendo"];
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
    fractions: parseFractions(arg("fractions")),
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

function scoreCheckpoint(checkpoint: CompileCheckpoint, totalFrames: number): {
  score: number;
  pass: boolean;
  axisQuality: number;
  trackHash: string;
} {
  const scored = scoreDriftReport(checkpoint.report, { totalFrames });
  return {
    score: scored.score,
    pass: scored.contract_passed,
    axisQuality: scored.axis_quality,
    trackHash: trackHash(checkpoint),
  };
}

function baselineCandidate(
  checkpoint: CompileCheckpoint,
  totalFrames: number,
): BudgetCandidate {
  return {
    budget: checkpoint.budget,
    ...scoreCheckpoint(checkpoint, totalFrames),
    totalSimFrames: checkpoint.stats.sim_frames,
    budgetExhausted: checkpoint.stats.budget_exhausted,
    source: "baseline",
  };
}

function branchCandidate(
  globalBudget: number,
  suffixBudget: number,
  checkpoint: CompileCheckpoint,
  totalFrames: number,
  capture: CaptureRecord,
  lane: number,
  searchSeed: number,
): BudgetCandidate {
  return {
    budget: globalBudget,
    ...scoreCheckpoint(checkpoint, totalFrames),
    totalSimFrames: capture.summary.sim_frames + checkpoint.stats.sim_frames,
    budgetExhausted: checkpoint.stats.budget_exhausted,
    source: "branch",
    capture: capture.summary.label,
    lane,
    searchSeed,
    prefixSimFrames: capture.summary.sim_frames,
    suffixBudget,
    suffixSimFrames: checkpoint.stats.sim_frames,
  };
}

function captureTargets(contactCount: number, fractions: number[]): CaptureTarget[] {
  if (contactCount < 2) return [];
  const seen = new Set<number>();
  const out: CaptureTarget[] = [];
  for (const fraction of fractions) {
    const targetGapIndex = Math.max(
      1,
      Math.min(contactCount - 1, Math.round(contactCount * fraction)),
    );
    if (seen.has(targetGapIndex)) continue;
    seen.add(targetGapIndex);
    out.push({
      label: `${Math.round(fraction * 100)}p-g${targetGapIndex}`,
      fraction,
      targetGapIndex,
    });
  }
  return out;
}

function captureSummary(
  target: CaptureTarget,
  snapshot: HandoffNodeSnapshot,
): CaptureSummary {
  return {
    label: target.label,
    fraction: target.fraction,
    target_gap_index: target.targetGapIndex,
    actual_gap_index: snapshot.node.search.gapIndex,
    sim_frames: snapshot.event.simFrames,
    phase: snapshot.event.phase,
    full_duration: snapshot.event.fullDuration,
    output_duration_frames: snapshot.event.outputDurationFrames,
    start_rank: snapshot.node.startRank,
    skipped_contacts: snapshot.node.skippedContacts,
    ranks: snapshot.node.rankTrace.map((entry) => entry.rank),
    key: snapshot.key,
  };
}

function shiftedScore(values: number[]): number {
  return shiftedGeometricMean(values);
}

function suiteScore(rows: BudgetCandidate[], keys: string[]): number {
  const bySpec = new Map<string, BudgetCandidate[]>();
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

function bestByScore<T extends BudgetCandidate>(candidates: T[]): T {
  if (candidates.length === 0) throw new Error("bestByScore: empty candidate list");
  return candidates.reduce((best, row) => row.score > best.score ? row : best);
}

function baselineAt(row: RowResult, budget: number): BudgetCandidate {
  const found = row.baseline.find((candidate) => candidate.budget === budget);
  if (found === undefined) throw new Error(`${row.specName} seed=${row.seed} missing baseline ${budget}`);
  return found;
}

function branchCandidatesAt(row: RowResult, budget: number): BudgetCandidate[] {
  return row.branches.flatMap((branch) =>
    branch.checkpoints.filter((candidate) => candidate.budget === budget)
  );
}

function oracleAt(row: RowResult, budget: number): BudgetCandidate {
  return bestByScore([baselineAt(row, budget), ...branchCandidatesAt(row, budget)]);
}

async function runRow(specName: GoldenSpecName, seed: number, args: Args): Promise<RowResult> {
  const rowStart = Date.now();
  if (args.progress) {
    console.error(`[prefix-branch] start ${specName} seed=${seed}`);
  }
  const spec = await loadGoldenSpec(specName, "base");
  const totalFrames = secToFrame(spec.duration);
  const targets = captureTargets(spec.contacts.length, args.fractions);
  const capturesByTarget = new Map<number, CaptureRecord>();

  const baselineResult = compileHandoff(spec, seed, {
    budgets: args.budgets,
    maxNodes: args.maxNodes,
    polish: args.polish,
    searchSeed: seed,
    onNode: (node, key, event) => {
      if (event.phase !== "main") return;
      if (node.searchLane !== 0) return;
      if (!node.startExpanded || node.deferExpansion || node.skippedContacts !== 0) return;
      if (node.search.gapIndex <= 0 || node.search.gapIndex >= spec.contacts.length) return;
      for (const target of targets) {
        if (capturesByTarget.has(target.targetGapIndex)) continue;
        if (node.search.gapIndex < target.targetGapIndex) continue;
        const snapshot = snapshotHandoffNode(node, key, event);
        capturesByTarget.set(target.targetGapIndex, {
          target,
          snapshot,
          summary: captureSummary(target, snapshot),
        });
      }
    },
  });
  const baseline = args.budgets.map((budget) =>
    baselineCandidate(checkpoint(baselineResult, budget), totalFrames)
  );
  const captures = targets
    .map((target) => capturesByTarget.get(target.targetGapIndex))
    .filter((capture): capture is CaptureRecord => capture !== undefined);

  if (args.progress) {
    console.error(
      `[prefix-branch]   baseline score=${fmt(baseline[baseline.length - 1].score)} ` +
        `captures=${captures.map((capture) => capture.summary.label).join(",") || "none"}`,
    );
  }

  const branches: BranchRun[] = [];
  for (const capture of captures) {
    for (const lane of args.lanes) {
      const searchSeed = searchSeedForLane(seed, lane);
      const suffixBudgetByGlobal = args.budgets
        .map((budget) => ({
          globalBudget: budget,
          suffixBudget: budget - capture.summary.sim_frames,
        }))
        .filter((row) => row.suffixBudget > 0);
      const suffixBudgets = [...new Set(suffixBudgetByGlobal.map((row) => row.suffixBudget))]
        .sort((a, b) => a - b);
      if (suffixBudgets.length === 0) continue;
      const branchStart = Date.now();
      if (args.progress) {
        console.error(
          `[prefix-branch]   branch capture=${capture.summary.label} lane=${lane} ` +
            `seed=${searchSeed} suffixBudgets=${suffixBudgets.map(fmtBudget).join(",")}`,
        );
      }
      const branchResult = compileHandoffFromSnapshot(spec, seed, capture.snapshot, {
        budgets: suffixBudgets,
        searchSeed,
        maxNodes: args.maxNodes,
        polish: args.polish,
      });
      const checkpoints = suffixBudgetByGlobal.map(({ globalBudget, suffixBudget }) =>
        branchCandidate(
          globalBudget,
          suffixBudget,
          checkpoint(branchResult, suffixBudget),
          totalFrames,
          capture,
          lane,
          searchSeed,
        )
      );
      branches.push({
        capture: capture.summary.label,
        lane,
        searchSeed,
        checkpoints,
      });
      if (args.progress) {
        const last = checkpoints[checkpoints.length - 1];
        console.error(
          `[prefix-branch]   done capture=${capture.summary.label} lane=${lane} ` +
            `score=${fmt(last.score)} totalSim=${last.totalSimFrames} t=${elapsed(branchStart)}`,
        );
      }
    }
  }

  if (args.progress) {
    console.error(`[prefix-branch] done ${specName} seed=${seed} t=${elapsed(rowStart)}`);
  }
  return { specName, seed, baseline, captures, branches };
}

function printSummary(rows: RowResult[], args: Args): void {
  const rowKeys = rows.map((row) => row.specName);
  const baselineCurve: number[] = [];
  const branchCurve: number[] = [];

  console.log(
    `prefix-branch oracle · specs=${args.specs.join(",")} seeds=${args.seeds.join(",")} ` +
      `lanes=${args.lanes.join(",")} fractions=${args.fractions.join(",")} ` +
      `budgets=${args.budgets.map(fmtBudget).join(",")} polish=${args.polish}`,
  );
  console.log("");
  console.log("budget        baseline   branch-oracle   delta   pass base/branch");

  for (const budget of args.budgets) {
    const baseline = rows.map((row) => baselineAt(row, budget));
    const branch = rows.map((row) => oracleAt(row, budget));
    const baselineScore = suiteScore(baseline, rowKeys);
    const branchScore = suiteScore(branch, rowKeys);
    baselineCurve.push(baselineScore);
    branchCurve.push(branchScore);
    const pass = (xs: BudgetCandidate[]) => xs.filter((row) => row.pass).length;
    console.log(
      `${fmtBudget(budget).padStart(6)} ` +
        `${fmt(baselineScore).padStart(13)} ` +
        `${fmt(branchScore).padStart(15)} ` +
        `${fmt(branchScore - baselineScore).padStart(7)} ` +
        `${String(pass(baseline)).padStart(4)}/${String(pass(branch)).padStart(2)}`,
    );
  }

  console.log("");
  const baselineCurveScore = shiftedScore(baselineCurve);
  const branchCurveScore = shiftedScore(branchCurve);
  console.log(`baseline curve:      ${fmt(baselineCurveScore)}`);
  console.log(
    `prefix-branch curve: ${fmt(branchCurveScore)}  ` +
      `delta=${fmt(branchCurveScore - baselineCurveScore)} ` +
      `(optimistic; branch probes are extra work)`,
  );

  const lastBudget = args.budgets[args.budgets.length - 1];
  console.log("");
  console.log(`largest branch gains at ${fmtBudget(lastBudget)}:`);
  rows
    .map((row) => ({
      row,
      base: baselineAt(row, lastBudget),
      best: oracleAt(row, lastBudget),
    }))
    .sort((a, b) => (b.best.score - b.base.score) - (a.best.score - a.base.score))
    .slice(0, 8)
    .forEach(({ row, base, best }) => {
      const source = best.source === "baseline"
        ? "baseline"
        : `${best.capture} lane=${best.lane} totalSim=${best.totalSimFrames}`;
      console.log(
        `  ${row.specName.padEnd(22)} seed=${row.seed} ` +
          `${fmt(best.score - base.score).padStart(8)} ` +
          `${source} score=${fmt(best.score)}`,
      );
    });
}

function candidateSummary(candidate: BudgetCandidate): object {
  return {
    budget: candidate.budget,
    score: candidate.score,
    pass: candidate.pass,
    axis_quality: candidate.axisQuality,
    total_sim_frames: candidate.totalSimFrames,
    budget_exhausted: candidate.budgetExhausted,
    track_hash: candidate.trackHash,
    source: candidate.source,
    capture: candidate.capture ?? null,
    lane: candidate.lane ?? null,
    search_seed: candidate.searchSeed ?? null,
    prefix_sim_frames: candidate.prefixSimFrames ?? null,
    suffix_budget: candidate.suffixBudget ?? null,
    suffix_sim_frames: candidate.suffixSimFrames ?? null,
  };
}

function rowWorkSummary(row: RowResult): object {
  const baseline = row.baseline[row.baseline.length - 1];
  const baselineSimFrames = baseline?.totalSimFrames ?? 0;
  const branchSuffixSimFrames = row.branches.reduce((sum, branch) => {
    const last = branch.checkpoints[branch.checkpoints.length - 1];
    return sum + (last?.suffixSimFrames ?? 0);
  }, 0);
  return {
    baseline_sim_frames: baselineSimFrames,
    branch_suffix_sim_frames: branchSuffixSimFrames,
    experimental_total_sim_frames: baselineSimFrames + branchSuffixSimFrames,
  };
}

function writeJson(rows: RowResult[], args: Args): void {
  if (args.jsonOut === undefined) return;
  const outputPath = resolve(args.jsonOut);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({
    source: "scripts/v0/prefix_branch_oracle.ts",
    args: {
      specs: args.specs,
      seeds: args.seeds,
      budgets: args.budgets,
      lanes: args.lanes,
      fractions: args.fractions,
      max_nodes: args.maxNodes ?? null,
      polish: args.polish,
    },
    rows: rows.map((row) => ({
      spec: row.specName,
      seed: row.seed,
      work: rowWorkSummary(row),
      baseline: row.baseline.map(candidateSummary),
      captures: row.captures.map((capture) => capture.summary),
      branches: row.branches.map((branch) => ({
        capture: branch.capture,
        lane: branch.lane,
        search_seed: branch.searchSeed,
        checkpoints: branch.checkpoints.map(candidateSummary),
      })),
      budgets: args.budgets.map((budget) => ({
        budget,
        baseline: candidateSummary(baselineAt(row, budget)),
        oracle: candidateSummary(oracleAt(row, budget)),
        branch_candidates: branchCandidatesAt(row, budget).map(candidateSummary),
      })),
    })),
  }, null, 2));
  console.error(`[prefix-branch] wrote ${outputPath}`);
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
