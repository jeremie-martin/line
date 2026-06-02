/**
 * Budgeted prefix-branch scheduler probe.
 *
 * This is a diagnostic harness, not production compiler policy. It consumes a
 * prior prefix-branch oracle JSON, selects row/capture/lane choices that had
 * enough oracle gain, then measures cheaper scheduler approximations:
 *
 *   replace: use the selected branch with only the original remaining budget
 *   extra:   keep baseline as fallback and spend a bounded extra suffix budget
 */

import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_BUDGETS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
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

type Mode = "replace" | "extra";

type Args = {
  selectionJson: string;
  specs?: GoldenSpecName[];
  seeds?: number[];
  budgets: number[];
  modes: Mode[];
  overheads: number[];
  minSelectionDelta: number;
  selectionBudget?: number;
  baselineMaxNodes?: number;
  branchMaxNodes: number;
  polish: boolean;
  progress: boolean;
  jsonOut?: string;
};

type Selection = {
  specName: GoldenSpecName;
  seed: number;
  capture: string;
  targetGapIndex: number;
  lane: number;
  searchSeed: number;
  selectedBudget: number;
  selectionBaselineScore: number;
  selectionBranchScore: number;
  selectionDelta: number;
};

type CaptureSummary = {
  label: string;
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

type CheckpointSummary = {
  budget: number;
  score: number;
  pass: boolean;
  axisQuality: number;
  simFrames: number;
  budgetExhausted: boolean;
  trackHash: string;
};

type BranchCandidateSummary = CheckpointSummary & {
  source: "branch";
  mode: Mode;
  overhead: number | null;
  capture: string;
  lane: number;
  searchSeed: number;
  prefixSimFrames: number;
  suffixBudget: number;
  suffixSimFrames: number;
  branchTrackTotalSimFrames: number;
  experimentalTotalSimFrames: number;
};

type ScenarioCheckpoint = {
  budget: number;
  selected: CheckpointSummary & {
    source: "baseline" | "branch";
    mode: Mode;
    overhead: number | null;
    experimentalTotalSimFrames: number;
    branchTrackTotalSimFrames?: number;
    suffixBudget?: number;
    suffixSimFrames?: number;
  };
  baseline: CheckpointSummary;
  branch: BranchCandidateSummary | null;
  deltaVsBaseline: number;
};

type ScenarioResult = {
  mode: Mode;
  overhead: number | null;
  checkpoints: ScenarioCheckpoint[];
};

type RowResult = {
  specName: GoldenSpecName;
  seed: number;
  selection: Selection;
  capture: CaptureSummary | null;
  baseline: CheckpointSummary[];
  scenarios: ScenarioResult[];
};

type OracleJson = {
  args?: {
    budgets?: number[];
    max_nodes?: number | null;
    polish?: boolean;
  };
  rows: Array<{
    spec: string;
    seed: number;
    captures?: Array<{ label: string; target_gap_index: number }>;
    budgets: Array<{
      budget: number;
      baseline: { score: number };
      oracle: {
        source: string;
        capture: string | null;
        lane: number | null;
        search_seed: number | null;
        score: number;
      };
    }>;
  }>;
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

function parseNumberList(raw: string | null, fallback: readonly number[], label: string): number[] {
  if (raw === null || raw.trim() === "") return [...fallback];
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`--${label} must be a comma-separated list of positive numbers`);
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseModes(raw: string | null): Mode[] {
  const source = raw === null || raw.trim() === "" ? "extra" : raw;
  const modes = source.split(",").map((part) => part.trim()).filter(Boolean);
  if (modes.some((mode) => mode !== "replace" && mode !== "extra")) {
    throw new Error("--mode must be replace, extra, or a comma-separated combination");
  }
  return [...new Set(modes)] as Mode[];
}

function parseSpecs(raw: string | null): GoldenSpecName[] | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  return raw.split(",").map((part) => part.trim()).filter(Boolean) as GoldenSpecName[];
}

function parseSeeds(rawSeed: string | null, rawSeeds: string | null): number[] | undefined {
  if (rawSeed !== null) {
    const value = Number(rawSeed);
    if (!Number.isSafeInteger(value)) throw new Error(`--seed must be a safe integer, got ${rawSeed}`);
    return [value];
  }
  if (rawSeeds === null || rawSeeds.trim() === "") return undefined;
  const values = rawSeeds.split(",").map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isSafeInteger(value))) {
    throw new Error("--seeds must be a comma-separated list of safe integers");
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseOptionalPositiveInt(raw: string | null, label: string): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${label} must be a positive integer, got ${raw}`);
  }
  return value;
}

function parseArgs(selection: OracleJson): Args {
  const selectionJson = arg("selection-json");
  if (selectionJson === null || selectionJson.trim() === "") {
    throw new Error("--selection-json is required");
  }
  const baselineMaxNodes =
    parseOptionalPositiveInt(arg("baseline-max-nodes"), "baseline-max-nodes") ??
    parseOptionalPositiveInt(arg("max-nodes"), "max-nodes") ??
    (selection.args?.max_nodes ?? undefined) ??
    undefined;
  const branchMaxNodes =
    parseOptionalPositiveInt(arg("branch-max-nodes"), "branch-max-nodes") ?? 30;
  const selectionBudgetRaw = arg("selection-budget");
  const selectionBudget = selectionBudgetRaw === null ? undefined : Number(selectionBudgetRaw);
  if (
    selectionBudget !== undefined &&
    (!Number.isSafeInteger(selectionBudget) || selectionBudget <= 0)
  ) {
    throw new Error(`--selection-budget must be a positive safe integer, got ${selectionBudgetRaw}`);
  }
  const polish = has("no-polish")
    ? false
    : has("polish")
    ? true
    : selection.args?.polish ?? true;
  const minSelectionDelta = Number(arg("min-selection-delta") ?? "1");
  if (!Number.isFinite(minSelectionDelta)) {
    throw new Error("--min-selection-delta must be finite");
  }
  return {
    selectionJson,
    specs: parseSpecs(arg("specs")),
    seeds: parseSeeds(arg("seed"), arg("seeds")),
    budgets: parsePositiveInts(arg("budgets"), DEFAULT_BUDGETS, "budgets"),
    modes: parseModes(arg("mode")),
    overheads: parseNumberList(arg("overheads"), [0.2, 0.4, 0.6], "overheads"),
    minSelectionDelta,
    selectionBudget,
    baselineMaxNodes,
    branchMaxNodes,
    polish,
    progress: !has("quiet"),
    jsonOut: arg("json-out") ?? undefined,
  };
}

function readSelectionJson(path: string): OracleJson {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as OracleJson;
}

function selectedBudget(selection: OracleJson, explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  const budgets = selection.args?.budgets;
  if (budgets !== undefined && budgets.length > 0) return Math.max(...budgets);
  return Math.max(...selection.rows.flatMap((row) => row.budgets.map((budget) => budget.budget)));
}

function selectRows(selection: OracleJson, args: Args): Selection[] {
  const budget = selectedBudget(selection, args.selectionBudget);
  const specFilter = args.specs === undefined ? null : new Set(args.specs);
  const seedFilter = args.seeds === undefined ? null : new Set(args.seeds);
  const selected: Selection[] = [];
  for (const row of selection.rows) {
    if (specFilter !== null && !specFilter.has(row.spec as GoldenSpecName)) continue;
    if (seedFilter !== null && !seedFilter.has(row.seed)) continue;
    const budgetRow = row.budgets.find((candidate) => candidate.budget === budget);
    if (budgetRow === undefined) continue;
    const delta = budgetRow.oracle.score - budgetRow.baseline.score;
    if (budgetRow.oracle.source !== "branch" || delta < args.minSelectionDelta) continue;
    if (
      budgetRow.oracle.capture === null ||
      budgetRow.oracle.lane === null ||
      budgetRow.oracle.search_seed === null
    ) {
      continue;
    }
    const capture = row.captures?.find((candidate) =>
      candidate.label === budgetRow.oracle.capture
    );
    if (capture === undefined) continue;
    selected.push({
      specName: row.spec as GoldenSpecName,
      seed: row.seed,
      capture: budgetRow.oracle.capture,
      targetGapIndex: capture.target_gap_index,
      lane: budgetRow.oracle.lane,
      searchSeed: budgetRow.oracle.search_seed,
      selectedBudget: budget,
      selectionBaselineScore: budgetRow.baseline.score,
      selectionBranchScore: budgetRow.oracle.score,
      selectionDelta: delta,
    });
  }
  return selected.sort((a, b) =>
    a.specName.localeCompare(b.specName) ||
    a.seed - b.seed ||
    a.capture.localeCompare(b.capture) ||
    a.lane - b.lane
  );
}

function checkpoint(result: CompileResult, budget: number): CompileCheckpoint {
  const found = result.checkpoints.find((candidate) => candidate.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint for budget ${budget}`);
  return found;
}

function trackHash(checkpoint: CompileCheckpoint): string {
  return createHash("sha256").update(JSON.stringify(checkpoint.track)).digest("hex");
}

function summarizeCheckpoint(checkpoint: CompileCheckpoint, totalFrames: number): CheckpointSummary {
  const scored = scoreDriftReport(checkpoint.report, { totalFrames });
  return {
    budget: checkpoint.budget,
    score: scored.score,
    pass: scored.contract_passed,
    axisQuality: scored.axis_quality,
    simFrames: checkpoint.stats.sim_frames,
    budgetExhausted: checkpoint.stats.budget_exhausted,
    trackHash: trackHash(checkpoint),
  };
}

function captureSummary(snapshot: HandoffNodeSnapshot, selection: Selection): CaptureSummary {
  return {
    label: selection.capture,
    target_gap_index: selection.targetGapIndex,
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

function branchCandidateSummary(
  mode: Mode,
  overhead: number | null,
  globalBudget: number,
  suffixBudget: number,
  checkpoint: CompileCheckpoint,
  totalFrames: number,
  baseline: CheckpointSummary,
  capture: CaptureSummary,
  selection: Selection,
): BranchCandidateSummary {
  const summary = summarizeCheckpoint(checkpoint, totalFrames);
  return {
    ...summary,
    budget: globalBudget,
    source: "branch",
    mode,
    overhead,
    capture: selection.capture,
    lane: selection.lane,
    searchSeed: selection.searchSeed,
    prefixSimFrames: capture.sim_frames,
    suffixBudget,
    suffixSimFrames: summary.simFrames,
    branchTrackTotalSimFrames: capture.sim_frames + summary.simFrames,
    experimentalTotalSimFrames: mode === "extra"
      ? baseline.simFrames + summary.simFrames
      : capture.sim_frames + summary.simFrames,
  };
}

function suffixBudgetFor(
  mode: Mode,
  overhead: number | null,
  budget: number,
  prefixSimFrames: number,
): number {
  if (mode === "replace") return budget - prefixSimFrames;
  return Math.floor(budget * (overhead ?? 0));
}

function scenarioSuffixBudgets(
  mode: Mode,
  overhead: number | null,
  budgets: number[],
  prefixSimFrames: number,
): { globalBudget: number; suffixBudget: number }[] {
  return budgets
    .map((budget) => ({
      globalBudget: budget,
      suffixBudget: suffixBudgetFor(mode, overhead, budget, prefixSimFrames),
    }))
    .filter((row) => row.suffixBudget > 0);
}

function uniqueBudgets(rows: { suffixBudget: number }[]): number[] {
  return [...new Set(rows.map((row) => row.suffixBudget))].sort((a, b) => a - b);
}

async function runRow(selection: Selection, args: Args): Promise<RowResult> {
  const rowStart = Date.now();
  if (args.progress) {
    console.error(
      `[scheduler-probe] start ${selection.specName} seed=${selection.seed} ` +
        `capture=${selection.capture} lane=${selection.lane}`,
    );
  }
  const spec = await loadGoldenSpec(selection.specName, "base");
  const totalFrames = secToFrame(spec.duration);
  let captured: HandoffNodeSnapshot | null = null;
  const baselineResult = compileHandoff(spec, selection.seed, {
    budgets: args.budgets,
    maxNodes: args.baselineMaxNodes,
    polish: args.polish,
    searchSeed: selection.seed,
    onNode: (node, key, event) => {
      if (captured !== null) return;
      if (event.phase !== "main") return;
      if (node.searchLane !== 0) return;
      if (!node.startExpanded || node.deferExpansion || node.skippedContacts !== 0) return;
      if (node.search.gapIndex < selection.targetGapIndex) return;
      if (node.search.gapIndex <= 0 || node.search.gapIndex >= spec.contacts.length) return;
      captured = snapshotHandoffNode(node, key, event);
    },
  });
  const baseline = args.budgets.map((budget) =>
    summarizeCheckpoint(checkpoint(baselineResult, budget), totalFrames)
  );
  if (captured === null) {
    if (args.progress) {
      console.error(`[scheduler-probe]   no capture found; baseline only`);
    }
    return {
      specName: selection.specName,
      seed: selection.seed,
      selection,
      capture: null,
      baseline,
      scenarios: args.modes.flatMap((mode) =>
        (mode === "extra" ? args.overheads : [null]).map((overhead) =>
          baselineOnlyScenario(mode, overhead, baseline)
        )
      ),
    };
  }
  const capture = captureSummary(captured, selection);
  const scenarios: ScenarioResult[] = [];
  for (const mode of args.modes) {
    const overheads = mode === "extra" ? args.overheads : [null];
    for (const overhead of overheads) {
      const requests = scenarioSuffixBudgets(mode, overhead, args.budgets, capture.sim_frames);
      const bySuffixBudget = new Map<number, BranchCandidateSummary>();
      if (requests.length > 0) {
        const branchResult = compileHandoffFromSnapshot(spec, selection.seed, captured, {
          budgets: uniqueBudgets(requests),
          searchSeed: selection.searchSeed,
          maxNodes: args.branchMaxNodes,
          polish: args.polish,
        });
        for (const request of requests) {
          const base = baselineForBudget(baseline, request.globalBudget);
          const branch = branchCandidateSummary(
            mode,
            overhead,
            request.globalBudget,
            request.suffixBudget,
            checkpoint(branchResult, request.suffixBudget),
            totalFrames,
            base,
            capture,
            selection,
          );
          bySuffixBudget.set(request.suffixBudget, branch);
        }
      }
      const checkpoints = args.budgets.map((budget) => {
        const base = baselineForBudget(baseline, budget);
        const suffixBudget = suffixBudgetFor(mode, overhead, budget, capture.sim_frames);
        const branch = suffixBudget > 0 ? bySuffixBudget.get(suffixBudget) ?? null : null;
        const selected = selectScenarioCheckpoint(mode, overhead, base, branch);
        return {
          budget,
          selected,
          baseline: base,
          branch,
          deltaVsBaseline: selected.score - base.score,
        };
      });
      scenarios.push({ mode, overhead, checkpoints });
      if (args.progress) {
        const last = checkpoints[checkpoints.length - 1];
        console.error(
          `[scheduler-probe]   done mode=${mode}` +
            `${overhead === null ? "" : ` overhead=${overhead}`} ` +
            `score=${fmt(last.selected.score)} delta=${fmt(last.deltaVsBaseline)}`,
        );
      }
    }
  }
  if (args.progress) {
    console.error(`[scheduler-probe] done ${selection.specName} seed=${selection.seed} t=${elapsed(rowStart)}`);
  }
  return {
    specName: selection.specName,
    seed: selection.seed,
    selection,
    capture,
    baseline,
    scenarios,
  };
}

function baselineOnlyScenario(
  mode: Mode,
  overhead: number | null,
  baseline: CheckpointSummary[],
): ScenarioResult {
  return {
    mode,
    overhead,
    checkpoints: baseline.map((base) => ({
      budget: base.budget,
      selected: {
        ...base,
        source: "baseline" as const,
        mode,
        overhead,
        experimentalTotalSimFrames: base.simFrames,
      },
      baseline: base,
      branch: null,
      deltaVsBaseline: 0,
    })),
  };
}

function baselineForBudget(baseline: CheckpointSummary[], budget: number): CheckpointSummary {
  const found = baseline.find((checkpoint) => checkpoint.budget === budget);
  if (found === undefined) throw new Error(`missing baseline checkpoint ${budget}`);
  return found;
}

function selectScenarioCheckpoint(
  mode: Mode,
  overhead: number | null,
  baseline: CheckpointSummary,
  branch: BranchCandidateSummary | null,
): ScenarioCheckpoint["selected"] {
  if (branch !== null && (mode === "replace" || branch.score > baseline.score)) {
    return {
      ...branch,
      source: "branch",
      mode,
      overhead,
      experimentalTotalSimFrames: branch.experimentalTotalSimFrames,
      branchTrackTotalSimFrames: branch.branchTrackTotalSimFrames,
      suffixBudget: branch.suffixBudget,
      suffixSimFrames: branch.suffixSimFrames,
    };
  }
  return {
    ...baseline,
    source: "baseline",
    mode,
    overhead,
    experimentalTotalSimFrames: mode === "extra" && branch !== null
      ? baseline.simFrames + branch.suffixSimFrames
      : baseline.simFrames,
  };
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

function shiftedScore(values: number[]): number {
  return shiftedGeometricMean(values);
}

function scenarioKey(mode: Mode, overhead: number | null): string {
  return overhead === null ? mode : `${mode}-${overhead}`;
}

function scenarioAt(row: RowResult, mode: Mode, overhead: number | null): ScenarioResult {
  const found = row.scenarios.find((scenario) =>
    scenario.mode === mode && scenario.overhead === overhead
  );
  if (found === undefined) throw new Error(`missing scenario ${scenarioKey(mode, overhead)}`);
  return found;
}

function checkpointAt(scenario: ScenarioResult, budget: number): ScenarioCheckpoint {
  const found = scenario.checkpoints.find((checkpoint) => checkpoint.budget === budget);
  if (found === undefined) throw new Error(`missing scenario checkpoint ${budget}`);
  return found;
}

function suiteScore(rows: RowResult[], mode: Mode, overhead: number | null, budget: number): number {
  const scores = rows.map((row) =>
    checkpointAt(scenarioAt(row, mode, overhead), budget).selected.score
  );
  return shiftedScore(scores);
}

function baselineSuiteScore(rows: RowResult[], budget: number): number {
  return shiftedScore(rows.map((row) => baselineForBudget(row.baseline, budget).score));
}

function workRatio(rows: RowResult[], mode: Mode, overhead: number | null, budget: number): number {
  let selectedFrames = 0;
  let baselineFrames = 0;
  for (const row of rows) {
    const selected = checkpointAt(scenarioAt(row, mode, overhead), budget).selected;
    selectedFrames += selected.experimentalTotalSimFrames;
    baselineFrames += baselineForBudget(row.baseline, budget).simFrames;
  }
  return baselineFrames === 0 ? 0 : selectedFrames / baselineFrames;
}

function printSummary(rows: RowResult[], args: Args): void {
  console.log(
    `prefix-branch scheduler probe · rows=${rows.length} modes=${args.modes.join(",")} ` +
      `budgets=${args.budgets.map(fmtBudget).join(",")} ` +
      `branchMaxNodes=${args.branchMaxNodes} polish=${args.polish}`,
  );
  console.log("");
  for (const mode of args.modes) {
    const overheads = mode === "extra" ? args.overheads : [null];
    for (const overhead of overheads) {
      const curve: number[] = [];
      const baselineCurve: number[] = [];
      for (const budget of args.budgets) {
        curve.push(suiteScore(rows, mode, overhead, budget));
        baselineCurve.push(baselineSuiteScore(rows, budget));
      }
      const score = shiftedScore(curve);
      const baseline = shiftedScore(baselineCurve);
      const lastBudget = args.budgets[args.budgets.length - 1];
      const lastWins = rows.filter((row) =>
        checkpointAt(scenarioAt(row, mode, overhead), lastBudget).deltaVsBaseline > 0
      ).length;
      console.log(
        `${scenarioKey(mode, overhead).padEnd(12)} curve=${fmt(score)} ` +
          `baseline=${fmt(baseline)} delta=${fmt(score - baseline)} ` +
          `wins@${fmtBudget(lastBudget)}=${lastWins}/${rows.length} ` +
          `work@${fmtBudget(lastBudget)}=${workRatio(rows, mode, overhead, lastBudget).toFixed(2)}x`,
      );
    }
  }
  const lastBudget = args.budgets[args.budgets.length - 1];
  console.log("");
  console.log(`largest selected gains at ${fmtBudget(lastBudget)}:`);
  const bestRows = rows.map((row) => {
    const best = row.scenarios
      .flatMap((scenario) => scenario.checkpoints)
      .filter((checkpoint) => checkpoint.budget === lastBudget)
      .sort((a, b) => b.deltaVsBaseline - a.deltaVsBaseline)[0];
    return { row, best };
  }).sort((a, b) => b.best.deltaVsBaseline - a.best.deltaVsBaseline);
  bestRows.slice(0, 10).forEach(({ row, best }) => {
    console.log(
      `  ${row.specName.padEnd(22)} ` +
        `${scenarioKey(best.selected.mode, best.selected.overhead).padEnd(10)} ` +
        `${fmt(best.deltaVsBaseline).padStart(8)} source=${best.selected.source}`,
    );
  });
}

function writeJson(rows: RowResult[], args: Args, selections: Selection[]): void {
  if (args.jsonOut === undefined) return;
  const outputPath = resolve(args.jsonOut);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({
    source: "scripts/v0/prefix_branch_scheduler_probe.ts",
    args: {
      selection_json: args.selectionJson,
      specs: args.specs ?? null,
      seeds: args.seeds ?? null,
      budgets: args.budgets,
      modes: args.modes,
      overheads: args.overheads,
      min_selection_delta: args.minSelectionDelta,
      selection_budget: args.selectionBudget ?? null,
      baseline_max_nodes: args.baselineMaxNodes ?? null,
      branch_max_nodes: args.branchMaxNodes,
      polish: args.polish,
    },
    selections,
    rows,
  }, null, 2));
  console.error(`[scheduler-probe] wrote ${outputPath}`);
}

async function main(): Promise<void> {
  const selectionPath = arg("selection-json");
  if (selectionPath === null || selectionPath.trim() === "") {
    throw new Error("--selection-json is required");
  }
  const selectionJson = readSelectionJson(selectionPath);
  const args = parseArgs(selectionJson);
  const selections = selectRows(selectionJson, args);
  if (selections.length === 0) {
    throw new Error("no selected branch rows matched the filters and threshold");
  }
  const rows: RowResult[] = [];
  for (const selection of selections) {
    rows.push(await runRow(selection, args));
  }
  printSummary(rows, args);
  writeJson(rows, args, selections);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
