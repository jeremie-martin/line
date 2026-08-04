/**
 * fwd_metrics — the Tier-1 forward-eval readout.
 *
 * WHAT THIS IS
 *   `docs/forward-eval-metrics.md` defines a standing metric set (M0-M10) for
 *   forward evaluation. M1-M8 are TIER 1: every input they need is already a
 *   compiler counter that ships in `CompileStats.fwd_eval` / `.deadline`, so any
 *   archive the compiler has ever written can be read without recompiling
 *   anything. This command is that reader.
 *
 *   It exists because the counters were shipping and nobody was reading them.
 *   In particular `fwd_rollout_redraw_refuted / fwd_rollout_redraws` (M3) is a
 *   free, always-on, per-compile estimate of how often a hop-1 dead-end verdict
 *   is FALSE — the 771-frames-per-verdict ground-truth audit of
 *   `docs/rollout-economics-study.md` §4.2, reduced to two integers that every
 *   compile already carries. That ratio is the campaign's standing thermometer.
 *
 * WHAT IT IS NOT
 *   Not a gate, not a headline, not part of the eval chain. **The headline is
 *   the only promotion metric.** Everything printed here is diagnosis. Several
 *   of these numbers move without the headline moving and must never be
 *   optimized directly — the footer names which and why.
 *
 * INPUTS (auto-detected)
 *   <prefix>.stats.json      one compile, written by `scripts/v0/run.ts`
 *   golden.json              `rows[].checkpoints[].compile_stats`
 *   <run>.json[.gz]          a benchmark v2 run archive (`runs[].stats`)
 *
 * USAGE
 *   npm run benchmark:v2:fwd-metrics -- --in=<path>
 *   npm run benchmark:v2:fwd-metrics -- --in=<path> --pooled-only
 *   npm run benchmark:v2:fwd-metrics -- --in=<path> --out=<record.json> --no-index
 *
 * AGGREGATION
 *   Every rate is a RATIO OF SUMS over the cells in its group (sum of
 *   numerators / sum of denominators), never a mean of per-cell ratios: these
 *   are frame- and call-accounting questions, and a mean of ratios would weight
 *   a 40-frame compile like a 750k one. The two exceptions are stated in the
 *   table notes (`M8 nCand` is a mean of per-compile means, because the counter
 *   is itself already a mean; `M8 fc/B` sums only over cells that completed).
 */

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FWD_METRICS_SCHEMA = "line.benchmark-v2.fwd-metrics.v1" as const;
/** Bumped whenever a metric definition, a column, or the record shape changes. */
export const FWD_METRICS_VERSION = "1.0.0" as const;
export const FWD_METRICS_DIRECTORY = "generated/benchmark-v2/fwd-metrics";
export const FWD_METRICS_INDEX = "index.jsonl";

// ---------------------------------------------------------------------------
// Defensive readers — archives are a moving target; never throw on a field.
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Rec) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Finite number or null. Every counter read goes through this, so a missing
 *  field and a `null` field are the same thing downstream: "not observed". */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// The per-compile cell
// ---------------------------------------------------------------------------

/** One compile's Tier-1 inputs. `null` means the archive did not carry it. */
export type FwdCell = {
  sourceId: string;
  budget: number | null;
  seed: number | null;
  simFrames: number | null;
  nodesExpanded: number | null;
  firstCompletionFrame: number | null;
  nCandMean: number | null;
  /** null when the compile carried no `fwd_eval` block at all. */
  fwd: {
    framesCharged: number;
    calls: number;
    startFramesCharged: number;
    noCandidate: number;
    redraws: number;
    redrawRefuted: number;
    pools: number;
    top1Agree: number;
    qualityRankOfWinnerSum: number;
    rankOfQualityTop1Sum: number;
    disagreeValueGapSum: number;
    disagreeCount: number;
  } | null;
  deadline: {
    poolBuilds: number;
    preBuilds: number;
    prePressured: number;
    preFullPressure: number;
    preMarginSum: number;
    postBuilds: number;
    postPressured: number;
    postFullPressure: number;
    postMarginSum: number;
    terminalConsiders: number;
    terminalWithoutImprovement: number;
  } | null;
};

function readFwdBlock(stats: Rec): FwdCell["fwd"] {
  const fwd = asRecord(stats.fwd_eval);
  if (fwd === null) return null;
  const n = (key: string): number => num(fwd[key]) ?? 0;
  return {
    framesCharged: n("fwd_eval_frames_charged"),
    calls: n("fwd_eval_calls"),
    startFramesCharged: n("start_eval_frames_charged"),
    noCandidate: n("fwd_rollout_no_candidate"),
    redraws: n("fwd_rollout_redraws"),
    redrawRefuted: n("fwd_rollout_redraw_refuted"),
    pools: n("fwd_pools"),
    top1Agree: n("fwd_top1_agree"),
    qualityRankOfWinnerSum: n("fwd_quality_rank_of_winner_sum"),
    rankOfQualityTop1Sum: n("fwd_rank_of_quality_top1_sum"),
    disagreeValueGapSum: n("fwd_disagree_value_gap_sum"),
    disagreeCount: n("fwd_disagree_count"),
  };
}

function readDeadlineBlock(stats: Rec): FwdCell["deadline"] {
  const dl = asRecord(stats.deadline);
  if (dl === null) return null;
  const n = (key: string): number => num(dl[key]) ?? 0;
  return {
    poolBuilds: n("deadline_pool_builds"),
    preBuilds: n("deadline_pre_builds"),
    prePressured: n("deadline_pre_pressured"),
    preFullPressure: n("deadline_pre_full_pressure"),
    preMarginSum: n("deadline_pre_margin_sum"),
    postBuilds: n("deadline_post_builds"),
    postPressured: n("deadline_post_pressured"),
    postFullPressure: n("deadline_post_full_pressure"),
    postMarginSum: n("deadline_post_margin_sum"),
    terminalConsiders: n("deadline_terminal_considers"),
    terminalWithoutImprovement: n("deadline_terminal_without_improvement"),
  };
}

function cellFromStats(
  stats: Rec,
  identity: { sourceId: string; budget: number | null; seed: number | null },
): FwdCell {
  return {
    ...identity,
    simFrames: num(stats.sim_frames),
    nodesExpanded: num(stats.search_nodes_expanded),
    firstCompletionFrame: num(stats.first_completion_frame),
    nCandMean: num(stats.handoff_policy_candidate_count_mean),
    fwd: readFwdBlock(stats),
    deadline: readDeadlineBlock(stats),
  };
}

// ---------------------------------------------------------------------------
// Input detection and extraction
// ---------------------------------------------------------------------------

export type InputKind = "v2-run-archive" | "golden" | "stats-sidecar";

export type ExtractResult = {
  kind: InputKind;
  cells: FwdCell[];
  /** Rows present in the input that carried no usable compile stats. */
  skipped: number;
};

/** Strip a directory prefix and the `.ts` suffix from a spec path so a
 *  single-compile sidecar groups under the same kind of name as an archive. */
function specToSourceId(specPath: string): string {
  const base = specPath.split("/").pop() ?? specPath;
  return base.replace(/\.ts$/, "");
}

export function extractCells(payload: unknown): ExtractResult {
  const root = asRecord(payload);
  if (root === null) throw new Error("input is not a JSON object");

  // (a) benchmark v2 run archive: runs[].stats, identity in runs[].task.
  if (Array.isArray(root.runs)) {
    const cells: FwdCell[] = [];
    let skipped = 0;
    for (const entry of root.runs) {
      const run = asRecord(entry);
      const stats = run === null ? null : asRecord(run.stats);
      if (run === null || stats === null) {
        skipped += 1;
        continue;
      }
      const task = asRecord(run.task) ?? {};
      const source = asRecord(run.source) ?? {};
      cells.push(cellFromStats(stats, {
        sourceId: str(task.sourceId) ?? str(source.id) ?? "(unnamed)",
        budget: num(task.budget),
        seed: num(task.actualSeed) ?? num(task.seedSlot),
      }));
    }
    return { kind: "v2-run-archive", cells, skipped };
  }

  // (b) golden.json: rows[].checkpoints[].compile_stats.
  if (Array.isArray(root.rows)) {
    const cells: FwdCell[] = [];
    let skipped = 0;
    for (const entry of root.rows) {
      const row = asRecord(entry);
      if (row === null) {
        skipped += 1;
        continue;
      }
      const name = str(row.name) ?? "(unnamed)";
      const variant = str(row.variant);
      const rowSeed = num(row.seed);
      for (const rawCheckpoint of asArray(row.checkpoints)) {
        const checkpoint = asRecord(rawCheckpoint);
        const stats = checkpoint === null ? null : asRecord(checkpoint.compile_stats);
        if (checkpoint === null || stats === null) {
          skipped += 1;
          continue;
        }
        cells.push(cellFromStats(stats, {
          sourceId: variant === null ? name : `${name}/${variant}`,
          budget: num(checkpoint.budget),
          seed: num(checkpoint.seed) ?? rowSeed,
        }));
      }
    }
    return { kind: "golden", cells, skipped };
  }

  // (c) run.ts `<prefix>.stats.json`: one compile, stats under `stats`.
  const stats = asRecord(root.stats);
  if (stats !== null) {
    return {
      kind: "stats-sidecar",
      cells: [cellFromStats(stats, {
        sourceId: specToSourceId(str(root.spec) ?? "(unnamed)"),
        budget: num(root.budget),
        seed: num(root.seed),
      })],
      skipped: 0,
    };
  }

  throw new Error(
    "unrecognized input: expected a benchmark v2 run archive (`runs`), a golden " +
      "archive (`rows`), or a run.ts stats sidecar (`stats`)",
  );
}

export function readInput(path: string): unknown {
  const raw = readFileSync(path);
  const text = path.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** A rate with an explicit reason when it cannot be formed. `value === null`
 *  ALWAYS carries a `note`; nothing in this tool ever renders NaN. */
export type Rate = { value: number | null; note: string | null; num: number; den: number };

export function rate(numerator: number, denominator: number, whyEmpty: string): Rate {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return { value: null, note: whyEmpty, num: numerator, den: denominator };
  }
  return { value: numerator / denominator, note: null, num: numerator, den: denominator };
}

export type Aggregate = {
  key: string;
  sourceId: string;
  /** The group's budget when it has exactly one; null when mixed or unrecorded. */
  budget: number | null;
  /** Distinct budgets seen, sorted; `[]` when none was recorded. */
  budgets: number[];
  cells: number;
  /** Cells whose stats carried no `fwd_eval` block (pre-instrument archives). */
  cellsWithoutFwd: number;
  cellsWithoutDeadline: number;
  cellsWithoutCompletion: number;
  /** M1 (fwd + start eval frames) / sim frames. */
  m1RolloutShare: Rate;
  /** M2 charged rollout frames per forward-eval call. */
  m2FramesPerRollout: Rate;
  /** M3 THE THERMOMETER: refuted / redraws. */
  m3RedrawRefutation: Rate;
  /** M4a redraws / calls, M4b residual dead-ends / calls. */
  m4RedrawTrigger: Rate;
  m4ResidualDeadEnd: Rate;
  /** M5 top-1 agreement and the winner's mean quality rank. */
  m5Top1Agreement: Rate;
  m5WinnerQualityRank: Rate;
  m5RankOfQualityTop1: Rate;
  /** M6 mean leaf-value gap on disagreeing pools. */
  m6DisagreementValueGap: Rate;
  /** M7 disagreements per 1000 simulated frames. */
  m7DecisionsPerKiloframe: Rate;
  /** M8 budget conversion. */
  m8NodesExpanded: Rate;
  m8FirstCompletionOverBudget: Rate;
  m8NCandMean: Rate;
  /** The deadline companion (Phase 1 telemetry). */
  deadlinePrePressuredShare: Rate;
  deadlinePreFullShare: Rate;
  deadlinePreMarginMean: Rate;
  /** The post-completion counterfactual twins: the ramp is switched OFF there by the
   *  phase gate, so these say how often it WOULD have engaged / saturated. */
  deadlinePostPressuredShare: Rate;
  deadlinePostFullShare: Rate;
  deadlinePostMarginMean: Rate;
  deadlineTerminalWithoutImprovement: Rate;
};

type Sums = {
  budgets: Set<number>;
  budgetless: boolean;
  cells: number;
  withoutFwd: number;
  withoutDeadline: number;
  withoutCompletion: number;
  simFrames: number;
  fwdFrames: number;
  startFrames: number;
  calls: number;
  noCandidate: number;
  redraws: number;
  redrawRefuted: number;
  pools: number;
  top1Agree: number;
  qualityRankOfWinnerSum: number;
  rankOfQualityTop1Sum: number;
  disagreeValueGapSum: number;
  disagreeCount: number;
  nodesExpanded: number;
  nodeCells: number;
  completionFrames: number;
  completionBudget: number;
  nCandSum: number;
  nCandCells: number;
  preBuilds: number;
  prePressured: number;
  preFullPressure: number;
  preMarginSum: number;
  postBuilds: number;
  postPressured: number;
  postFullPressure: number;
  postMarginSum: number;
  terminalConsiders: number;
  terminalWithoutImprovement: number;
};

function emptySums(): Sums {
  return {
    budgets: new Set<number>(),
    budgetless: false,
    cells: 0,
    withoutFwd: 0,
    withoutDeadline: 0,
    withoutCompletion: 0,
    simFrames: 0,
    fwdFrames: 0,
    startFrames: 0,
    calls: 0,
    noCandidate: 0,
    redraws: 0,
    redrawRefuted: 0,
    pools: 0,
    top1Agree: 0,
    qualityRankOfWinnerSum: 0,
    rankOfQualityTop1Sum: 0,
    disagreeValueGapSum: 0,
    disagreeCount: 0,
    nodesExpanded: 0,
    nodeCells: 0,
    completionFrames: 0,
    completionBudget: 0,
    nCandSum: 0,
    nCandCells: 0,
    preBuilds: 0,
    prePressured: 0,
    preFullPressure: 0,
    preMarginSum: 0,
    postBuilds: 0,
    postPressured: 0,
    postFullPressure: 0,
    postMarginSum: 0,
    terminalConsiders: 0,
    terminalWithoutImprovement: 0,
  };
}

function accumulate(sums: Sums, cell: FwdCell): void {
  sums.cells += 1;
  if (cell.budget === null) sums.budgetless = true;
  else sums.budgets.add(cell.budget);
  sums.simFrames += cell.simFrames ?? 0;
  if (cell.nodesExpanded !== null) {
    sums.nodesExpanded += cell.nodesExpanded;
    sums.nodeCells += 1;
  }
  if (cell.firstCompletionFrame !== null && cell.budget !== null && cell.budget > 0) {
    sums.completionFrames += cell.firstCompletionFrame;
    sums.completionBudget += cell.budget;
  } else {
    sums.withoutCompletion += 1;
  }
  if (cell.nCandMean !== null) {
    sums.nCandSum += cell.nCandMean;
    sums.nCandCells += 1;
  }
  if (cell.fwd === null) {
    sums.withoutFwd += 1;
  } else {
    sums.fwdFrames += cell.fwd.framesCharged;
    sums.startFrames += cell.fwd.startFramesCharged;
    sums.calls += cell.fwd.calls;
    sums.noCandidate += cell.fwd.noCandidate;
    sums.redraws += cell.fwd.redraws;
    sums.redrawRefuted += cell.fwd.redrawRefuted;
    sums.pools += cell.fwd.pools;
    sums.top1Agree += cell.fwd.top1Agree;
    sums.qualityRankOfWinnerSum += cell.fwd.qualityRankOfWinnerSum;
    sums.rankOfQualityTop1Sum += cell.fwd.rankOfQualityTop1Sum;
    sums.disagreeValueGapSum += cell.fwd.disagreeValueGapSum;
    sums.disagreeCount += cell.fwd.disagreeCount;
  }
  if (cell.deadline === null) {
    sums.withoutDeadline += 1;
  } else {
    sums.preBuilds += cell.deadline.preBuilds;
    sums.prePressured += cell.deadline.prePressured;
    sums.preFullPressure += cell.deadline.preFullPressure;
    sums.preMarginSum += cell.deadline.preMarginSum;
    sums.postBuilds += cell.deadline.postBuilds;
    sums.postPressured += cell.deadline.postPressured;
    sums.postFullPressure += cell.deadline.postFullPressure;
    sums.postMarginSum += cell.deadline.postMarginSum;
    sums.terminalConsiders += cell.deadline.terminalConsiders;
    sums.terminalWithoutImprovement += cell.deadline.terminalWithoutImprovement;
  }
}

const NO_FWD = "no fwd_eval counters in these cells";
const NO_CALLS = "no forward-eval calls (below the 75k gate, or LR_FWD_EVAL=off)";
const NO_REDRAWS = "0/0 — no hop-1 pool was ever empty at its own width";
const NO_POOLS = "agreement instrument off (re-run with LR_FWD_EVAL_AGREEMENT=1)";
const NO_DISAGREE = "no disagreeing pools observed";
const NO_FRAMES = "no simulated frames recorded";
const NO_NODES = "no search_nodes_expanded recorded";
const NO_COMPLETION = "no cell reached first completion (or no budget recorded)";
const NO_NCAND = "no handoff_policy_candidate_count_mean recorded";
const NO_DEADLINE = "no deadline counters in these cells";
const NO_PRE = "no pre-completion pool build read a finite margin";
const NO_POST = "no post-completion pool build read a finite margin";
const NO_TERMINAL = "no structural terminal was offered to the register";

function summarize(key: string, sourceId: string, sums: Sums): Aggregate {
  const fwdMissing = sums.cells > 0 && sums.withoutFwd === sums.cells;
  const dlMissing = sums.cells > 0 && sums.withoutDeadline === sums.cells;
  // The agreement family is opt-in (LR_FWD_EVAL_AGREEMENT=1). With it off every
  // counter reads 0, so a naive rate would print a confident "0.000 per kiloframe"
  // for a quantity that was never observed.
  const agreementOff = fwdMissing || sums.pools === 0;
  // When NO cell carried the counters the denominators are structurally absent,
  // not zero: force the explained-null form rather than reporting a confident 0%.
  const fwdDen = (denominator: number): number => fwdMissing ? 0 : denominator;
  const dlDen = (denominator: number): number => dlMissing ? 0 : denominator;
  const budgets = [...sums.budgets].sort((a, b) => a - b);
  return {
    key,
    sourceId,
    budget: budgets.length === 1 && !sums.budgetless ? budgets[0] : null,
    budgets,
    cells: sums.cells,
    cellsWithoutFwd: sums.withoutFwd,
    cellsWithoutDeadline: sums.withoutDeadline,
    cellsWithoutCompletion: sums.withoutCompletion,
    m1RolloutShare: rate(
      sums.fwdFrames + sums.startFrames,
      fwdDen(sums.simFrames),
      fwdMissing ? NO_FWD : NO_FRAMES,
    ),
    m2FramesPerRollout: rate(sums.fwdFrames, fwdDen(sums.calls), fwdMissing ? NO_FWD : NO_CALLS),
    m3RedrawRefutation: rate(
      sums.redrawRefuted,
      fwdDen(sums.redraws),
      fwdMissing ? NO_FWD : NO_REDRAWS,
    ),
    m4RedrawTrigger: rate(sums.redraws, fwdDen(sums.calls), fwdMissing ? NO_FWD : NO_CALLS),
    m4ResidualDeadEnd: rate(sums.noCandidate, fwdDen(sums.calls), fwdMissing ? NO_FWD : NO_CALLS),
    m5Top1Agreement: rate(sums.top1Agree, fwdDen(sums.pools), fwdMissing ? NO_FWD : NO_POOLS),
    m5WinnerQualityRank: rate(
      sums.qualityRankOfWinnerSum,
      fwdDen(sums.pools),
      fwdMissing ? NO_FWD : NO_POOLS,
    ),
    m5RankOfQualityTop1: rate(
      sums.rankOfQualityTop1Sum,
      fwdDen(sums.pools),
      fwdMissing ? NO_FWD : NO_POOLS,
    ),
    m6DisagreementValueGap: rate(
      sums.disagreeValueGapSum,
      fwdDen(sums.disagreeCount),
      fwdMissing ? NO_FWD : sums.pools === 0 ? NO_POOLS : NO_DISAGREE,
    ),
    m7DecisionsPerKiloframe: rate(
      sums.disagreeCount * 1000,
      agreementOff ? 0 : sums.simFrames,
      fwdMissing ? NO_FWD : sums.pools === 0 ? NO_POOLS : NO_FRAMES,
    ),
    m8NodesExpanded: rate(sums.nodesExpanded, sums.nodeCells, NO_NODES),
    m8FirstCompletionOverBudget: rate(
      sums.completionFrames,
      sums.completionBudget,
      NO_COMPLETION,
    ),
    m8NCandMean: rate(sums.nCandSum, sums.nCandCells, NO_NCAND),
    deadlinePrePressuredShare: rate(
      sums.prePressured,
      dlDen(sums.preBuilds),
      dlMissing ? NO_DEADLINE : NO_PRE,
    ),
    deadlinePreFullShare: rate(
      sums.preFullPressure,
      dlDen(sums.preBuilds),
      dlMissing ? NO_DEADLINE : NO_PRE,
    ),
    deadlinePreMarginMean: rate(
      sums.preMarginSum,
      dlDen(sums.preBuilds),
      dlMissing ? NO_DEADLINE : NO_PRE,
    ),
    deadlinePostPressuredShare: rate(
      sums.postPressured,
      dlDen(sums.postBuilds),
      dlMissing ? NO_DEADLINE : NO_POST,
    ),
    deadlinePostFullShare: rate(
      sums.postFullPressure,
      dlDen(sums.postBuilds),
      dlMissing ? NO_DEADLINE : NO_POST,
    ),
    deadlinePostMarginMean: rate(
      sums.postMarginSum,
      dlDen(sums.postBuilds),
      dlMissing ? NO_DEADLINE : NO_POST,
    ),
    deadlineTerminalWithoutImprovement: rate(
      sums.terminalWithoutImprovement,
      dlDen(sums.terminalConsiders),
      dlMissing ? NO_DEADLINE : NO_TERMINAL,
    ),
  };
}

export function aggregate(cells: readonly FwdCell[]): { groups: Aggregate[]; pooled: Aggregate } {
  const bySource = new Map<string, { sourceId: string; sums: Sums }>();
  const pooledSums = emptySums();
  for (const cell of cells) {
    const key = `${cell.sourceId}|${cell.budget ?? "?"}`;
    let group = bySource.get(key);
    if (group === undefined) {
      group = { sourceId: cell.sourceId, sums: emptySums() };
      bySource.set(key, group);
    }
    accumulate(group.sums, cell);
    accumulate(pooledSums, cell);
  }
  const groups = [...bySource.entries()]
    .map(([key, group]) => summarize(key, group.sourceId, group.sums))
    .sort((a, b) =>
      (a.budget ?? 0) - (b.budget ?? 0) || a.sourceId.localeCompare(b.sourceId)
    );
  return { groups, pooled: summarize("POOLED", "POOLED", pooledSums) };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const NA = "n/a";

function pct(value: Rate, digits = 1): string {
  return value.value === null ? NA : `${(value.value * 100).toFixed(digits)}%`;
}

function fixed(value: Rate, digits: number): string {
  return value.value === null ? NA : value.value.toFixed(digits);
}

function count(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function budgetLabel(budget: number | null): string {
  if (budget === null) return "?";
  if (budget >= 1000 && budget % 1000 === 0) return `${budget / 1000}k`;
  return count(budget);
}

/** A group spanning several budgets says so rather than printing one of them. */
function groupBudgetLabel(entry: Aggregate): string {
  if (entry.budget !== null) return budgetLabel(entry.budget);
  if (entry.budgets.length > 1) return `${entry.budgets.length} budgets`;
  return "?";
}

/** Right-align every column but the first; pad to the widest cell. */
function renderTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => (row[index] ?? "").length))
  );
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, index) => index === 0 ? cell.padEnd(widths[index]) : cell.padStart(widths[index]))
      .join("  ")
      .trimEnd();
  const rule = widths.map((width) => "-".repeat(width)).join("  ");
  return [line(header), rule, ...rows.map(line)].join("\n");
}

function spendRow(entry: Aggregate): string[] {
  return [
    entry.sourceId,
    groupBudgetLabel(entry),
    count(entry.cells),
    pct(entry.m1RolloutShare),
    fixed(entry.m2FramesPerRollout, 1),
    pct(entry.m3RedrawRefutation),
    `${count(entry.m3RedrawRefutation.num)}/${count(entry.m3RedrawRefutation.den)}`,
    pct(entry.m4RedrawTrigger, 2),
    pct(entry.m4ResidualDeadEnd, 2),
  ];
}

function judgeRow(entry: Aggregate): string[] {
  return [
    entry.sourceId,
    groupBudgetLabel(entry),
    pct(entry.m5Top1Agreement),
    fixed(entry.m5WinnerQualityRank, 2),
    fixed(entry.m6DisagreementValueGap, 2),
    fixed(entry.m7DecisionsPerKiloframe, 3),
    fixed(entry.m8NodesExpanded, 1),
    pct(entry.m8FirstCompletionOverBudget, 1),
    fixed(entry.m8NCandMean, 1),
  ];
}

function deadlineRow(entry: Aggregate): string[] {
  return [
    entry.sourceId,
    groupBudgetLabel(entry),
    pct(entry.deadlinePrePressuredShare),
    pct(entry.deadlinePreFullShare),
    fixed(entry.deadlinePreMarginMean, 2),
    pct(entry.deadlinePostPressuredShare),
    pct(entry.deadlinePostFullShare),
    fixed(entry.deadlinePostMarginMean, 2),
    pct(entry.deadlineTerminalWithoutImprovement),
  ];
}

/** Distinct `n/a` reasons actually hit, so the reader never has to guess why a
 *  column is empty. Ordered by first appearance for stable output. */
function collectNotes(entries: readonly Aggregate[]): string[] {
  const seen = new Map<string, string>();
  const add = (label: string, value: Rate): void => {
    if (value.note !== null && !seen.has(`${label}:${value.note}`)) {
      seen.set(`${label}:${value.note}`, `${label}: ${value.note}`);
    }
  };
  for (const entry of entries) {
    add("M1", entry.m1RolloutShare);
    add("M2", entry.m2FramesPerRollout);
    add("M3", entry.m3RedrawRefutation);
    add("M4", entry.m4RedrawTrigger);
    add("M5", entry.m5Top1Agreement);
    add("M6", entry.m6DisagreementValueGap);
    add("M7", entry.m7DecisionsPerKiloframe);
    add("M8", entry.m8FirstCompletionOverBudget);
    add("deadline", entry.deadlinePrePressuredShare);
    add("deadline", entry.deadlinePostMarginMean);
    add("deadline", entry.deadlineTerminalWithoutImprovement);
  }
  return [...seen.values()];
}

const FOOTER = [
  "READING THE NUMBERS  (docs/forward-eval-metrics.md; measured ground truth in docs/rollout-economics-study.md)",
  "  M0 the 48-seed headline is the ONLY promotion metric. Nothing below is an acceptance gate.",
  "  M3 THE THERMOMETER — refuted/redraws, a free per-compile estimate of hop-1 verdict falsity at",
  "     width+1. It is NOT monotone across shape changes: a wider base draw removes the empties",
  "     before the re-draw ever sees them, so M3 falls while the mechanism improves. Always read it",
  "     with M4 (the traffic it is a rate over). 0/0 means the shape never dead-ended.",
  "  M4 is terrain-dominated. Compare only within (source, seed, budget) — never across sources.",
  "  M5 has NO good direction. Agreement near 1 means the rollout is buying nothing; near 0 means",
  "     the two judges disagree. Neither is quality. Never optimize it.",
  "  M6 is denominated in leaf points and there is NO measured exchange rate to headline points",
  "     (the study refuses one). Colour only.",
  "  M1 down is capped: the free-judge arm bounds the whole frames-saved family at +1.78 +/- 1.31.",
  "     Read M1 as cost accounting, never as a target.",
  "  M7 more re-ordering is not better re-ordering; it pairs only with M0.",
].join("\n");

export function render(
  input: string,
  kind: InputKind,
  cells: number,
  skipped: number,
  groups: readonly Aggregate[],
  pooled: Aggregate,
  pooledOnly: boolean,
): string {
  const shown = pooledOnly ? [] : groups;
  const sections: string[] = [];
  sections.push(
    [
      `fwd-metrics v${FWD_METRICS_VERSION} — forward-eval Tier-1 readout`,
      `  input    ${input}`,
      `  kind     ${kind}`,
      `  cells    ${count(cells)} compiles in ${count(groups.length)} (source, budget) groups` +
      (skipped > 0 ? `, ${count(skipped)} rows skipped (no compile stats)` : ""),
    ].join("\n"),
  );
  sections.push(
    "SPEND AND VERDICT TRAFFIC   M1 rollout frame share - M2 frames/rollout - M3 refutation - M4 traffic\n" +
      renderTable(
        ["source", "budget", "n", "M1 share", "M2 f/call", "M3 refut", "M3 n/N", "M4 trigger", "M4 resid"],
        [...shown.map(spendRow), spendRow(pooled)],
      ),
  );
  sections.push(
    "JUDGE AND BUDGET CONVERSION   M5 agreement - M6 value gap - M7 yield - M8 does budget reach the search\n" +
      renderTable(
        [
          "source",
          "budget",
          "M5 agree",
          "M5 winQR",
          "M6 gap",
          "M7 /kframe",
          "M8 nodes",
          "M8 fc/B",
          "M8 nCand",
        ],
        [...shown.map(judgeRow), judgeRow(pooled)],
      ),
  );
  if (pooled.cellsWithoutDeadline < pooled.cells) {
    sections.push(
      "DEADLINE COMPANION   the budget-side signal the M-set is read against (Phase 1 telemetry)\n" +
        renderTable(
          [
            "source",
            "budget",
            "pre pressured",
            "pre full",
            "pre margin",
            "post pressured",
            "post full",
            "post margin",
            "terminal no-improve",
          ],
          [...shown.map(deadlineRow), deadlineRow(pooled)],
        ),
    );
  }
  const notes = collectNotes([...groups, pooled]);
  if (pooled.cellsWithoutFwd > 0 && pooled.cellsWithoutFwd < pooled.cells) {
    notes.push(
      `coverage: ${count(pooled.cellsWithoutFwd)} of ${count(pooled.cells)} cells carry no ` +
        "fwd_eval block (pre-instrument archive) — M1's denominator still counts their frames",
    );
  }
  if (pooled.cellsWithoutDeadline > 0 && pooled.cellsWithoutDeadline < pooled.cells) {
    notes.push(
      `coverage: ${count(pooled.cellsWithoutDeadline)} of ${count(pooled.cells)} cells carry no ` +
        "deadline block (pre-Phase-1 archive)",
    );
  }
  if (notes.length > 0) {
    sections.push(`WHY A COLUMN IS "${NA}"\n` + notes.map((note) => `  ${note}`).join("\n"));
  }
  sections.push(FOOTER);
  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

export type FwdMetricsRecord = {
  schema: typeof FWD_METRICS_SCHEMA;
  instrumentVersion: typeof FWD_METRICS_VERSION;
  generatedAt: string;
  input: string;
  inputSha256: string;
  inputKind: InputKind;
  cells: number;
  skippedRows: number;
  groups: Aggregate[];
  pooled: Aggregate;
};

export function buildRecord(
  input: string,
  inputSha256: string,
  kind: InputKind,
  cells: number,
  skipped: number,
  groups: Aggregate[],
  pooled: Aggregate,
  generatedAt: string,
): FwdMetricsRecord {
  return {
    schema: FWD_METRICS_SCHEMA,
    instrumentVersion: FWD_METRICS_VERSION,
    generatedAt,
    input,
    inputSha256,
    inputKind: kind,
    cells,
    skippedRows: skipped,
    groups,
    pooled,
  };
}

/** The standing history: one line per reading, so a thermometer trend exists
 *  without anyone having to keep the records. */
export function appendIndex(directory: string, record: FwdMetricsRecord, recordPath: string): void {
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    resolve(directory, FWD_METRICS_INDEX),
    `${
      JSON.stringify({
        generatedAt: record.generatedAt,
        input: record.input,
        inputSha256: record.inputSha256,
        inputKind: record.inputKind,
        cells: record.cells,
        record: recordPath,
        m1: record.pooled.m1RolloutShare.value,
        m3: record.pooled.m3RedrawRefutation.value,
        m3_num: record.pooled.m3RedrawRefutation.num,
        m3_den: record.pooled.m3RedrawRefutation.den,
        m4_trigger: record.pooled.m4RedrawTrigger.value,
        m4_residual: record.pooled.m4ResidualDeadEnd.value,
      })
    }\n`,
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `fwd-metrics — the Tier-1 forward-eval readout (M1-M8 + the deadline companion).

  npm run benchmark:v2:fwd-metrics -- --in=<path>

  --in=<path>       REQUIRED. One of:
                      <prefix>.stats.json        one compile (scripts/v0/run.ts)
                      golden.json                rows[].checkpoints[].compile_stats
                      <run>.json[.gz]            benchmark v2 run archive (runs[].stats)
  --out=<path>      where to write the JSON record (default: <in>.fwd-metrics.json)
  --pooled-only     print only the pooled line (the record still carries every group)
  --no-index        do not append to ${FWD_METRICS_DIRECTORY}/${FWD_METRICS_INDEX}
  --index-dir=<d>   append the history line somewhere else
  --help

The headline is the only promotion metric; everything this prints is diagnosis.
Definitions, cost tiers and anti-gaming contracts: docs/forward-eval-metrics.md.`;

/** `file://${argv[1]}` string-compares an unresolved, unescaped path (see
 *  describe_budget_telemetry.ts); `pathToFileURL(resolve(...))` is the same
 *  normalization `import.meta.url` already carries. */
function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
}

function main(): void {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const flag = (name: string): boolean => args.includes(`--${name}`);

  if (flag("help") || flag("h") || args.length === 0) {
    console.log(USAGE);
    return;
  }
  const bare = args.find((arg) => !arg.startsWith("--"));
  if (bare !== undefined) {
    throw new Error(`positional argument "${bare}" — this CLI takes equals-form flags only (--in=…)`);
  }
  const inRaw = argument("in");
  if (inRaw === undefined || inRaw.length === 0) throw new Error("--in=<path> is required (--help)");
  const input = resolve(inRaw);
  if (!existsSync(input)) throw new Error(`--in=${input} does not exist`);

  const payload = readInput(input);
  const { kind, cells, skipped } = extractCells(payload);
  if (cells.length === 0) {
    throw new Error(`${input}: recognized as ${kind} but carried no compile stats`);
  }
  const { groups, pooled } = aggregate(cells);

  const inputSha256 = createHash("sha256").update(readFileSync(input)).digest("hex");
  const generatedAt = new Date().toISOString();
  const record = buildRecord(
    input,
    inputSha256,
    kind,
    cells.length,
    skipped,
    groups,
    pooled,
    generatedAt,
  );
  const outPath = resolve(argument("out") ?? `${input.replace(/\.gz$/, "")}.fwd-metrics.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(record, null, 1)}\n`);

  console.log(render(input, kind, cells.length, skipped, groups, pooled, flag("pooled-only")));
  console.log(`\nrecord → ${outPath}`);
  if (!flag("no-index")) {
    const directory = resolve(argument("index-dir") ?? FWD_METRICS_DIRECTORY);
    appendIndex(directory, record, outPath);
    console.log(`history → ${resolve(directory, FWD_METRICS_INDEX)}`);
  }
}

if (isCliEntry()) {
  // A bad path or an unrecognized payload is a usage error, not a crash: print
  // the one line that says what to do and exit, the way the other readers do.
  try {
    main();
  } catch (error) {
    console.error(`fwd-metrics: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
