/**
 * HISTORICAL V3 REPRODUCTION ONLY. This preserves the old archive analysis;
 * it does not describe the singular deepest-affordable V4 controller.
 *
 * Offline replay of repair-anchor SELECTION policies (Phase 2 of
 * `docs/budget-unification-plan.md`).
 *
 * Measurement only. Nothing here writes a runtime artifact, changes policy, or
 * touches `handoff.ts`. `pickFeasibleWeakGap` (`handoff.ts:4725`) ranks candidate
 * repair anchors by raw axis-SSE with an affordability cap and calls itself
 * "v1, a proxy for true upstream blame"; `docs/repair-roi-study.md` measured the
 * consequence — 18.6% of 750k compiles spend their whole repair allocation for
 * exactly zero gain. This study replays alternative rankings against archived
 * incumbents and prices the difference from the archives' own acceptance and
 * gain distributions.
 *
 *   extract  compress archives into per-compile selection records
 *   report   fit the cost/outcome models, replay every policy, render the study
 *
 *   npx tsx scripts/v0/study_repair_selection.ts extract \
 *     --archive=150k:generated/budget-telemetry/law/panel-150k.json.checkpoint.jsonl \
 *     --out=generated/budget-telemetry/repair-selection/records.json
 *
 *   npx tsx scripts/v0/study_repair_selection.ts report \
 *     --records=generated/budget-telemetry/repair-selection/records.json \
 *     --out=docs/repair-selection-study.md \
 *     --json=generated/budget-telemetry/repair-selection/report.json
 *
 * Archive inputs: either the run archive (`.json` / `.json.gz`, whole-file) or
 * its streaming checkpoint (`.checkpoint.jsonl`, one `{type:"result"}` line per
 * run). The checkpoint carries the identical run objects and is the memory-cheap
 * path; the whole-file path needs `NODE_OPTIONS=--max-old-space-size=8192`.
 *
 * Determinism: the cluster bootstrap runs off a seeded xorshift and every policy
 * sees the same resampled compiles and the same per-compile random stream, so a
 * re-run of the same records reproduces the same tables bit-for-bit and the
 * policy-vs-current column is paired.
 */

import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { BUDGET_TELEMETRY_SCHEMA } from "./optimizer/budget_telemetry.ts";

const RECORDS_SCHEMA = "line.repair-selection-records.v1" as const;
const REPORT_SCHEMA = "line.repair-selection-report.v1" as const;

/** Benchmark suite component weights (`benchmark/v2/compat/suite-manifest.json`). */
const COMPONENT_WEIGHTS: Record<string, number> = {
  air: 0.3,
  speed: 0.3,
  impact: 0.3,
  amplitude: 0.1,
};

/** `handoff.ts` repair defaults, mirrored (read-only) for the replay's arithmetic.
 *
 * ERA PIN: the four margin constants reproduce the compiler that PRODUCED the
 * archived corpus this study was run on. That mechanism no longer exists at
 * HEAD — the feasibility margin and its ramp were deleted (commit chain
 * f96dc03/ccfd58d) in favour of `estCostUpperOf`'s calibrated start/withPath
 * upper quantile (~1.15x measured cost, vs 1.05 -> 1.0 here). Replaying THIS
 * rule against archives recorded at or after that change prices anchors the
 * shipped compiler would size differently; either re-derive the replay from
 * `ceiling_source`/`ceiling_total_spent_frames` in the newer telemetry or keep
 * the inputs to pre-deletion archives. */
const REPAIR_MAX_UPSTREAM = 4;
const REPAIR_MAX_ATTEMPTS = 64;
const REPAIR_FEAS_MARGIN_SCARCE = 1.05;
const REPAIR_FEAS_MARGIN_MATURE = 1.0;
const REPAIR_MARGIN_RAMP_START_FRAMES = 100_000;
const REPAIR_MARGIN_RAMP_SPAN_FRAMES = 100_000;

/**
 * Attempt-ordinal buckets of the outcome model; the last is open-ended.
 *
 * The bucket is the ATTEMPT ordinal within the compile (`restart` in the ROI
 * study's tables), not the pick round. The two differ: one round of
 * `runRepairPhase` can emit up to `maxUpstream + 1` attempts as it walks the
 * anchor upstream, and the CORPUS THIS STUDY RAN ON records no round field
 * (ROI study H6). The ordinal is what that archive measures, so it is what the
 * replay prices by — pricing an up-walk attempt at its round's rate would
 * silently hand every extra attempt the first attempt's acceptance.
 *
 * Since ccfd58d the recorder DOES emit `repair_round_index` (with
 * `anchor_upstream_offset` and `incumbent_weak_gap_sse`) precisely to retire
 * this workaround; a rerun over post-ccfd58d archives should bucket on that
 * field instead of the ordinal.
 */
const ROUND_BUCKETS = 6;
/** Local-budget bins of the outcome model. */
const COST_BINS = 5;

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** The DELETED `defaultRepairFeasMargin` (pre-f96dc03 handoff.ts), reproduced
 *  for the replay of that era's archives — see the ERA PIN note above. */
function feasMarginFor(targetBudget: number): number {
  const pressure = smoothstep(
    (targetBudget - REPAIR_MARGIN_RAMP_START_FRAMES) / REPAIR_MARGIN_RAMP_SPAN_FRAMES,
  );
  return REPAIR_FEAS_MARGIN_SCARCE +
    (REPAIR_FEAS_MARGIN_MATURE - REPAIR_FEAS_MARGIN_SCARCE) * pressure;
}

// ------------------------------------------------------------------ types ---

type GapRecord = {
  /** `report.gaps[].gap_index` — already only contact gaps with a fit. */
  k: number;
  /** Σ axis-error², the live ranking key of `pickFeasibleWeakGap`. */
  sseRaw: number;
  /** Σ (w_axis / Σw_active) · axis-error², the benchmark scorer's weighting. */
  sseBench: number;
  /** Largest-error axis and its error (the `weakAxis` of the repair log). */
  weakAxis: string;
  weakError: number;
  /** Σ max(0, target − ceiling)² over axes carrying a ceiling: the irreducible part. */
  sseFloorRaw: number;
  sseFloorBench: number;
  /** The weak axis's own ask exceeds its reported physical ceiling. */
  weakAtCeiling: boolean;
};

type AttemptRecord = {
  restart: number;
  anchorGap: number;
  start: number;
  ceiling: number;
  localBudget: number;
  ceilingSource: string;
  spent: number;
  accepted: boolean | null;
  delta: number | null;
  firstAcceptedOffset: number | null;
  /** Deepest gap this attempt's high water reached. */
  endGap: number;
};

type CompileRecord = {
  archive: string;
  budget: number;
  sourceId: string;
  seed: number;
  status: string;
  policyBudget: number;
  hardBudget: number;
  totalSpent: number;
  /** Total gaps including any trailing non-contact gap (`anchor.remaining_gaps` + index). */
  totalGaps: number;
  firstCompletionFrame: number;
  deepestSeenGap: number;
  /** Charged frames at the first repair attempt's start; the repair phase's origin. */
  repairStart: number | null;
  terminus: string | null;
  /** Scored axes present in this compile's report. */
  axes: string[];
  gaps: GapRecord[];
  attempts: AttemptRecord[];
  /** Observed `costToEnd[k]` points: [gapIndex, frames], ascending, deduped. */
  costPoints: [number, number][];
  /** Same, restricted to what a `summary`-level archive would expose. */
  costPointsSparse: [number, number][];
};

type ArchiveRecord = {
  label: string;
  path: string;
  budget: number;
  compiles: number;
  repairAttempts: number;
  telemetryLevels: Record<string, number>;
  outcomeFields: "fresh" | "stale" | "none";
};

// ------------------------------------------------------------------- args ---

const argv = process.argv.slice(2);
const verb = argv[0];
const values = (name: string): string[] => {
  const prefix = `--${name}=`;
  return argv.filter((value) => value.startsWith(prefix)).map((value) => value.slice(prefix.length));
};
const value = (name: string): string | undefined => values(name)[0];

// ---------------------------------------------------------------- extract ---

async function extract(): Promise<void> {
  const specs = values("archive");
  const outPath = value("out");
  if (specs.length === 0 || outPath === undefined) {
    throw new Error("extract requires --archive=<label>:<path> ... and --out=<records.json>");
  }
  const archives: ArchiveRecord[] = [];
  const compiles: CompileRecord[] = [];
  for (const spec of specs) {
    const split = spec.indexOf(":");
    if (split <= 0) throw new Error(`--archive must be <label>:<path>, got ${spec}`);
    const label = spec.slice(0, split);
    const path = resolve(spec.slice(split + 1));
    const levels: Record<string, number> = {};
    let repairAttempts = 0;
    let withDelta = 0;
    let count = 0;
    let budget = 0;
    for await (const run of readRuns(path)) {
      const telemetry = run.budgetTelemetry;
      if (telemetry === null || telemetry === undefined) continue;
      if (telemetry.schema !== BUDGET_TELEMETRY_SCHEMA) {
        throw new Error(`${path}: expected ${BUDGET_TELEMETRY_SCHEMA}; got ${String(telemetry.schema)}`);
      }
      if (telemetry.episodes.some(
        (episode: any) => episode.lane === "repair" && episode.mechanism !== "frontier",
      )) {
        throw new Error(
          `${path}: repair-selection replay supports frontier repair episodes only; ` +
            `surgical repair is a different mechanism`,
        );
      }
      levels[telemetry.level] = (levels[telemetry.level] ?? 0) + 1;
      const record = compileRecord(label, run, telemetry);
      if (record === null) continue;
      budget = record.budget;
      for (const attempt of record.attempts) {
        repairAttempts++;
        if (attempt.delta !== null) withDelta++;
      }
      compiles.push(record);
      count++;
    }
    archives.push({
      label,
      path,
      budget,
      compiles: count,
      repairAttempts,
      telemetryLevels: levels,
      outcomeFields: repairAttempts === 0
        ? "none"
        : withDelta === repairAttempts
          ? "fresh"
          : "stale",
    });
    process.stderr.write(`${label}: ${count} compiles, ${repairAttempts} repair attempts\n`);
  }
  writeJson(outPath, { schema: RECORDS_SCHEMA, archives, compiles });
  process.stderr.write(`wrote ${outPath}: ${compiles.length} compiles\n`);
}

async function* readRuns(path: string): AsyncGenerator<any> {
  if (path.endsWith(".jsonl")) {
    const stream = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of stream) {
      if (line.trim().length === 0) continue;
      const parsed = JSON.parse(line);
      if (parsed.type !== "result") continue;
      yield parsed.result;
    }
    return;
  }
  const raw = path.endsWith(".gz")
    ? gunzipSync(readFileSync(path)).toString("utf8")
    : readFileSync(path, "utf8");
  const archive = JSON.parse(raw);
  for (const run of archive.runs ?? []) yield run;
}

function compileRecord(label: string, run: any, telemetry: any): CompileRecord | null {
  const reportGaps = run.report?.gaps;
  if (!Array.isArray(reportGaps) || reportGaps.length === 0) return null;

  // Per-spec axis weights. Every gap of a spec carries the same axis set (checked
  // on all 44 sources), so the benchmark's per-axis-RMS reweighting reduces to one
  // constant per axis per compile.
  const axisSet = new Set<string>();
  for (const gap of reportGaps) for (const axis of Object.keys(gap.axes ?? {})) axisSet.add(axis);
  const axes = [...axisSet].sort();
  const activeWeight = axes.reduce((sum, axis) => sum + (COMPONENT_WEIGHTS[axis] ?? 0), 0);
  const benchWeight = (axis: string): number =>
    activeWeight > 0 ? (COMPONENT_WEIGHTS[axis] ?? 0) / activeWeight : 0;

  const gaps: GapRecord[] = [];
  for (const gap of reportGaps) {
    let sseRaw = 0;
    let sseBench = 0;
    let sseFloorRaw = 0;
    let sseFloorBench = 0;
    let weakAxis = "";
    let weakError = -1;
    let weakAtCeiling = false;
    for (const [axis, entry] of Object.entries(gap.axes ?? {}) as [string, any][]) {
      const error = Number(entry.error);
      if (!Number.isFinite(error)) continue;
      const w = benchWeight(axis);
      sseRaw += error * error;
      sseBench += w * error * error;
      // A reported `ceiling` below the authored target makes part of the error
      // physics, not an optimizer miss (`types.ts:854`). That part cannot be
      // re-searched away, so it is the gap's irreducible floor.
      const ceiling = typeof entry.ceiling === "number" ? entry.ceiling : null;
      const floor = ceiling === null ? 0 : Math.max(0, Number(entry.target) - ceiling);
      sseFloorRaw += floor * floor;
      sseFloorBench += w * floor * floor;
      if (error > weakError) {
        weakError = error;
        weakAxis = axis;
        weakAtCeiling = ceiling !== null && floor > 0 && error <= floor * 1.05 + 1e-9;
      }
    }
    gaps.push({
      k: gap.gap_index,
      sseRaw: round9(sseRaw),
      sseBench: round9(sseBench),
      weakAxis,
      weakError: round9(weakError),
      sseFloorRaw: round9(sseFloorRaw),
      sseFloorBench: round9(sseFloorBench),
      weakAtCeiling,
    });
  }
  gaps.sort((a, b) => a.k - b.k);

  const attempts: AttemptRecord[] = [];
  const costPoints = new Map<number, number>();
  const costPointsSparse = new Map<number, number>();
  let totalGaps = 0;
  let restart = 0;
  let repairStart: number | null = null;
  for (const attempt of telemetry.episodes) {
    const anchor = attempt.anchor ?? {};
    totalGaps = Math.max(totalGaps, (anchor.gap_index ?? 0) + (anchor.remaining_gaps ?? 0));
    if (attempt.lane !== "repair" || attempt.mechanism !== "frontier") continue;
    const outcome = attempt.outcome ?? {};
    if (repairStart === null) repairStart = attempt.start_total_spent_frames;
    const observations: any[] = attempt.observations ?? [];
    const boundary = [attempt.start, attempt.end].filter((o) => o !== null && o !== undefined);
    for (const observation of [...observations, ...boundary]) {
      const frames = observation.incumbent_path_work_estimate_frames;
      const k = observation.high_water?.gap_index;
      if (typeof frames !== "number" || frames <= 0 || typeof k !== "number") continue;
      costPoints.set(k, frames);
    }
    for (const observation of boundary) {
      const frames = observation.incumbent_path_work_estimate_frames;
      const k = observation.high_water?.gap_index;
      if (typeof frames !== "number" || frames <= 0 || typeof k !== "number") continue;
      costPointsSparse.set(k, frames);
    }
    attempts.push({
      restart: restart++,
      anchorGap: anchor.gap_index ?? -1,
      start: attempt.start_total_spent_frames,
      ceiling: attempt.ceiling_total_spent_frames,
      localBudget: attempt.allocated_frames,
      ceilingSource: attempt.ceiling_source,
      spent: outcome.spent_frames ?? 0,
      accepted: outcome.register_improved,
      delta: numberOrNull(outcome.internal_full_score_delta),
      firstAcceptedOffset: numberOrNull(outcome.first_register_improvement_offset_frames),
      endGap: attempt.end?.high_water?.gap_index ?? -1,
    });
  }

  return {
    archive: label,
    budget: run.task?.budget ?? telemetry.compile?.policy_budget_frames ?? 0,
    sourceId: run.task?.sourceId ?? "unknown",
    seed: run.task?.actualSeed ?? -1,
    status: run.status ?? "unknown",
    policyBudget: telemetry.compile?.policy_budget_frames ?? 0,
    hardBudget: telemetry.compile?.hard_budget_frames ?? 0,
    totalSpent: telemetry.compile?.total_spent_frames ?? 0,
    totalGaps,
    firstCompletionFrame: telemetry.compile.first_terminal_total_spent_frames ?? -1,
    deepestSeenGap: run.stats?.handoff_deepest_seen_gap ?? -1,
    repairStart,
    terminus: run.report?.terminus?.reason ?? null,
    axes,
    gaps,
    attempts,
    costPoints: [...costPoints.entries()].sort((a, b) => a[0] - b[0]),
    costPointsSparse: [...costPointsSparse.entries()].sort((a, b) => a[0] - b[0]),
  };
}

// ------------------------------------------------------------ cost model ----

/**
 * `estCostOf(k)` as the compiler computes it (`handoff.ts:2019`), reconstructed
 * from what the archive exposes.
 *
 * The compiler's array is `costToEnd[k] = firstCompletionFrame − reach[node@k]`
 * over the ORIGINAL incumbent's own path. The archive never serialises the
 * array; it serialises the value the estimator read at each observation
 * (`incumbent_path_work_estimate_frames` at that observation's high-water gap),
 * so the array is known exactly at every gap a repair attempt's high water
 * crossed and must be interpolated elsewhere. `costToEnd` decreases in `k` by
 * construction (reach increases), which is what makes linear interpolation
 * between known points the right shape rather than an assumption.
 */
type CostModel = {
  at: (k: number) => number;
  known: Set<number>;
  perGap: number;
};

function buildCostModel(compile: CompileRecord, points: [number, number][]): CostModel {
  const perGap = compile.firstCompletionFrame > 0 && compile.deepestSeenGap >= 0
    ? compile.firstCompletionFrame / Math.max(1, compile.deepestSeenGap + 1)
    : 0;
  const known = new Set(points.map(([k]) => k));
  const xs = points.map(([k]) => k);
  const ys = points.map(([, v]) => v);
  const totalGaps = compile.totalGaps > 0 ? compile.totalGaps : (compile.gaps.at(-1)?.k ?? 0) + 1;
  const at = (k: number): number => {
    if (points.length === 0) return perGap * Math.max(1, totalGaps - k);
    if (k <= xs[0]) {
      // Head anchor: the incumbent's own root is reached at ~0 charged frames,
      // so costToEnd[0] is the first-completion cost itself.
      const y0 = compile.firstCompletionFrame > 0 ? compile.firstCompletionFrame : ys[0];
      if (xs[0] <= 0) return ys[0];
      return Math.max(0, y0 + (ys[0] - y0) * (k / xs[0]));
    }
    const last = xs.length - 1;
    if (k >= xs[last]) {
      if (totalGaps <= xs[last]) return ys[last];
      return Math.max(0, ys[last] * (1 - (k - xs[last]) / (totalGaps - xs[last])));
    }
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= k) lo = mid;
      else hi = mid;
    }
    const t = (k - xs[lo]) / (xs[hi] - xs[lo]);
    return Math.max(0, ys[lo] + (ys[hi] - ys[lo]) * t);
  };
  return { at, known, perGap };
}

// -------------------------------------------------------------- policies ----

type PolicyContext = {
  compile: CompileRecord;
  /** `estCostOf(k)` for every reported gap, in gap order. */
  cost: number[];
  /**
   * Ranking denominator for the per-frame policies: `max(estCost, costFloor)`.
   *
   * The floor is not cosmetic. `costToEnd` goes to ~0 at the last gaps of the
   * incumbent path, so an unfloored `SSE / estCost` is unbounded there and the
   * ranking degenerates to "always restart from the final gap" — where the
   * compiler would size `ceiling = now`, run zero nodes and charge zero frames.
   * The floor is the archive's own smallest observed restart: no real restart is
   * ever sized below it.
   */
  costFloored: number[];
  suffixRaw: number[];
  suffixBench: number[];
};

type Policy = {
  id: string;
  label: string;
  /** Higher wins. Return null to exclude the gap from the candidate set. */
  key: (index: number, ctx: PolicyContext) => number | null;
};

const POLICIES: Policy[] = [
  {
    id: "current",
    label: "P1 current — raw axis-SSE",
    key: (i, ctx) => ctx.compile.gaps[i].sseRaw,
  },
  {
    id: "bench_weighted",
    label: "P2 scorer-weighted axis error",
    key: (i, ctx) => ctx.compile.gaps[i].sseBench,
  },
  {
    id: "sse_per_frame",
    label: "P3 SSE per estimated frame",
    key: (i, ctx) => ctx.compile.gaps[i].sseRaw / ctx.costFloored[i],
  },
  {
    id: "ceiling_excl",
    label: "P4 ceiling-exclusion",
    key: (i, ctx) => (ctx.compile.gaps[i].weakAtCeiling ? null : ctx.compile.gaps[i].sseRaw),
  },
  {
    id: "headroom",
    label: "P4b headroom SSE (raw SSE minus its ceiling floor)",
    key: (i, ctx) => Math.max(0, ctx.compile.gaps[i].sseRaw - ctx.compile.gaps[i].sseFloorRaw),
  },
  {
    id: "combined",
    label: "P5 = P2 + P3 + P4 combined",
    key: (i, ctx) =>
      ctx.compile.gaps[i].weakAtCeiling
        ? null
        : Math.max(0, ctx.compile.gaps[i].sseBench - ctx.compile.gaps[i].sseFloorBench) /
          ctx.costFloored[i],
  },
  {
    id: "suffix",
    label: "P6 suffix SSE (a restart rebuilds gaps k..end)",
    key: (i, ctx) => ctx.suffixRaw[i],
  },
  {
    id: "suffix_per_frame",
    label: "P7 suffix SSE per estimated frame",
    key: (i, ctx) => ctx.suffixRaw[i] / ctx.costFloored[i],
  },
];

function buildContext(compile: CompileRecord, costFloor: number): PolicyContext {
  const model = buildCostModel(compile, compile.costPoints);
  const cost = compile.gaps.map((gap) => model.at(gap.k));
  const costFloored = cost.map((c) => Math.max(costFloor, c));
  const suffixRaw: number[] = new Array(compile.gaps.length).fill(0);
  const suffixBench: number[] = new Array(compile.gaps.length).fill(0);
  let accRaw = 0;
  let accBench = 0;
  for (let i = compile.gaps.length - 1; i >= 0; i--) {
    accRaw += compile.gaps[i].sseRaw;
    accBench += compile.gaps[i].sseBench;
    suffixRaw[i] = accRaw;
    suffixBench[i] = accBench;
  }
  return { compile, cost, costFloored, suffixRaw, suffixBench };
}

/** Pre-sorted candidate order for one policy: the ranking key never changes. */
function rankOrder(ctx: PolicyContext, policy: Policy): number[] {
  const scored: { index: number; key: number }[] = [];
  for (let i = 0; i < ctx.compile.gaps.length; i++) {
    const key = policy.key(i, ctx);
    if (key === null) continue;
    scored.push({ index: i, key });
  }
  scored.sort((a, b) => b.key - a.key || ctx.compile.gaps[a.index].k - ctx.compile.gaps[b.index].k);
  return scored.map((entry) => entry.index);
}

/** `pickFeasibleWeakGap`: walk the ranking, return the first affordable gap. */
function pick(ctx: PolicyContext, order: number[], exhausted: Set<number>, budgetCap: number): number {
  for (const index of order) {
    const k = ctx.compile.gaps[index].k;
    if (exhausted.has(k)) continue;
    const cost = ctx.cost[index];
    if (cost <= 0 || cost <= budgetCap) return k;
  }
  return -1;
}

// -------------------------------------------------------- outcome sampler ---

/**
 * Empirical outcome model.
 *
 * A counterfactual attempt is priced only from observed attempts that share its
 * stratum. The stratum is the (round index x local-budget) CROSS, and both
 * coordinates are chosen deliberately:
 *
 * - `docs/repair-roi-study.md` warns that restart index, anchor depth and local
 *   budget are "one variable seen three ways" in the marginal tables. Only the
 *   cross separates them, and the study reports its off-diagonal mass.
 * - Local budget, not anchor depth, is the coordinate a selection policy
 *   actually moves and the one the replay can compute exactly for a
 *   counterfactual anchor (`ceil(estCost · feasMargin)`).
 *
 * Fallbacks are deliberately conservative and never cross a round boundary: a
 * thin cell falls back to the NEAREST populated local-budget bin **in its own
 * round**, so a cheap attempt is never credited with an expensive attempt's
 * gain. Rounds past the archive's deepest observed restart get no credit at all.
 */
type Outcome = { accepted: boolean; delta: number; spentRatio: number };

type OutcomeModel = {
  cells: Outcome[][][];
  /** Round bucket -> is there any observation at all. */
  roundPopulated: boolean[];
  /** Deepest restart index the archive ever observed. */
  maxRound: number;
  minCell: number;
};

type Bins = {
  /** Local-budget bin edges as a fraction of policy budget. */
  edges: number[];
  /** Smallest local budget any real restart was ever sized to, as a fraction. */
  minFrac: number;
  maxRound: number;
};

function roundBucket(round: number): number {
  return Math.min(ROUND_BUCKETS - 1, round);
}

function costBin(localBudgetFrac: number, bins: Bins): number {
  let bin = 0;
  while (bin < bins.edges.length && localBudgetFrac >= bins.edges[bin]) bin++;
  return Math.min(COST_BINS - 1, bin);
}

function buildBins(compiles: CompileRecord[]): Bins {
  const fracs: number[] = [];
  let maxRound = 0;
  for (const compile of compiles) {
    for (const attempt of compile.attempts) {
      if (compile.policyBudget <= 0 || attempt.localBudget <= 0) continue;
      fracs.push(attempt.localBudget / compile.policyBudget);
      maxRound = Math.max(maxRound, attempt.restart);
    }
  }
  fracs.sort((a, b) => a - b);
  const edges: number[] = [];
  for (let i = 1; i < COST_BINS; i++) edges.push(fracs[Math.floor((i * fracs.length) / COST_BINS)]);
  return { edges, minFrac: fracs[0] ?? 0, maxRound };
}

function buildOutcomeModel(compiles: CompileRecord[], bins: Bins, minCell: number): OutcomeModel {
  const cells: Outcome[][][] = [];
  const roundPopulated: boolean[] = [];
  for (let r = 0; r < ROUND_BUCKETS; r++) {
    cells.push(Array.from({ length: COST_BINS }, () => [] as Outcome[]));
    roundPopulated.push(false);
  }
  for (const compile of compiles) {
    for (const attempt of compile.attempts) {
      if (attempt.accepted === null || attempt.delta === null) continue;
      if (attempt.localBudget <= 0 || compile.policyBudget <= 0) continue;
      const r = roundBucket(attempt.restart);
      const c = costBin(attempt.localBudget / compile.policyBudget, bins);
      cells[r][c].push({
        accepted: attempt.accepted,
        delta: attempt.delta,
        spentRatio: attempt.spent / attempt.localBudget,
      });
      roundPopulated[r] = true;
    }
  }
  return { cells, roundPopulated, maxRound: bins.maxRound, minCell };
}

type Draw = { pool: Outcome[] | null; matched: boolean };

/**
 * Nearest-populated bin within the same round. Returns `pool: null` when the
 * round itself is unobserved — such an attempt spends frames and is credited
 * nothing, which is the only honest treatment of a sequence depth no archive
 * has ever reached.
 */
function drawPool(model: OutcomeModel, round: number, bin: number): Draw {
  if (round > model.maxRound) return { pool: null, matched: false };
  const r = roundBucket(round);
  const row = model.cells[r];
  if (row[bin].length >= model.minCell) return { pool: row[bin], matched: true };
  for (let step = 1; step < COST_BINS; step++) {
    for (const candidate of [bin - step, bin + step]) {
      if (candidate < 0 || candidate >= COST_BINS) continue;
      if (row[candidate].length >= model.minCell) return { pool: row[candidate], matched: false };
    }
  }
  const pooled = row.flat();
  if (pooled.length > 0) return { pool: pooled, matched: false };
  return { pool: null, matched: false };
}

// ----------------------------------------------------------------- replay ---

type ReplayResult = {
  gain: number;
  /** Gain from attempt 0 — the only decision the archive pins to a counterfactual. */
  gainRound0: number;
  /** Gain from attempts at or past the last ordinal bucket: the extrapolation-exposed part. */
  gainDeep: number;
  /** Gain credited from a cell that matched directly, no fallback. */
  gainMatched: number;
  attempts: number;
  uncredited: number;
  fallback: number;
  accepts: number;
  firstAnchor: number;
  spent: number;
};

type Rng = { next: () => number };

function makeRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9;
  return {
    next: () => {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0x1_0000_0000;
    },
  };
}

/**
 * Replay one compile's repair phase under one policy.
 *
 * The loop mirrors `runRepairPhase` (`handoff.ts:1975-2232`) wherever the
 * archive pins it down: the affordability cap `remaining / feasMargin`, the
 * `exhausted` set (a gap is exhausted only when NO attempt of its round
 * improved), the oldest-first upstream walk over `kWorst − up`, the
 * `min(repairBudget, now + ceil(estCost·feasMargin))` ceiling, and the loop
 * exits. What it cannot mirror is the incumbent's evolution: the archived report
 * is the FINAL one, so the replay holds the weakness map fixed. That is exact on
 * zero-accept compiles and an approximation elsewhere.
 */
function replay(
  ctx: PolicyContext,
  order: number[],
  model: OutcomeModel,
  bins: Bins,
  rng: Rng,
): ReplayResult {
  const compile = ctx.compile;
  const feasMargin = feasMarginFor(compile.budget);
  const repairBudget = compile.policyBudget;
  const minLocalBudget = Math.max(1, Math.round(bins.minFrac * repairBudget));
  const indexOfGap = new Map<number, number>();
  for (let i = 0; i < compile.gaps.length; i++) indexOfGap.set(compile.gaps[i].k, i);

  const exhausted = new Set<number>();
  const start = compile.repairStart ?? compile.firstCompletionFrame;
  let now = start;
  let attempts = 0;
  let round = 0;
  const result: ReplayResult = {
    gain: 0,
    gainRound0: 0,
    gainDeep: 0,
    gainMatched: 0,
    attempts: 0,
    uncredited: 0,
    fallback: 0,
    accepts: 0,
    firstAnchor: -1,
    spent: 0,
  };

  while (attempts < REPAIR_MAX_ATTEMPTS && now < repairBudget) {
    const kWorst = pick(ctx, order, exhausted, (repairBudget - now) / feasMargin);
    if (kWorst < 0) break;
    let improvedAny = false;
    for (let up = REPAIR_MAX_UPSTREAM; up >= 0; up--) {
      const k = kWorst - up;
      if (attempts >= REPAIR_MAX_ATTEMPTS || now >= repairBudget) break;
      const index = indexOfGap.get(k);
      if (index === undefined) continue;
      const estCost = ctx.cost[index];
      if (estCost > 0 && estCost * feasMargin > repairBudget - now) continue;
      // The attempt ordinal, not the pick round, is what the archive measures.
      const ordinal = attempts;
      attempts++;
      if (result.firstAnchor < 0) result.firstAnchor = k;
      const sized = now + Math.ceil(estCost * feasMargin);
      const localBudget = Math.max(minLocalBudget, Math.min(repairBudget, sized) - now);
      const bin = costBin(localBudget / repairBudget, bins);
      const draw = drawPool(model, ordinal, bin);
      if (draw.pool === null) {
        result.uncredited++;
        now += localBudget;
        continue;
      }
      if (!draw.matched) result.fallback++;
      const outcome = draw.pool[Math.floor(rng.next() * draw.pool.length) % draw.pool.length];
      now += Math.max(1, Math.round(localBudget * outcome.spentRatio));
      if (outcome.accepted) {
        result.gain += outcome.delta;
        if (ordinal === 0) result.gainRound0 += outcome.delta;
        if (ordinal >= ROUND_BUCKETS - 1) result.gainDeep += outcome.delta;
        if (draw.matched) result.gainMatched += outcome.delta;
        result.accepts++;
        improvedAny = true;
        break;
      }
    }
    if (!improvedAny) exhausted.add(kWorst);
    round++;
  }
  result.attempts = attempts;
  result.spent = now - start;
  return result;
}

/**
 * The first attempt only: the policy's opening anchor, everything downstream
 * ignored. This is the one decision LC-22 leaves comparable — after it, the
 * restart seed and the incumbent both diverge.
 */
function replayDecisionOne(
  ctx: PolicyContext,
  order: number[],
  model: OutcomeModel,
  bins: Bins,
  rng: Rng,
): number {
  const compile = ctx.compile;
  const feasMargin = feasMarginFor(compile.budget);
  const repairBudget = compile.policyBudget;
  const minLocalBudget = Math.max(1, Math.round(bins.minFrac * repairBudget));
  const indexOfGap = new Map<number, number>();
  for (let i = 0; i < compile.gaps.length; i++) indexOfGap.set(compile.gaps[i].k, i);
  let now = compile.repairStart ?? compile.firstCompletionFrame;
  const kWorst = pick(ctx, order, new Set(), (repairBudget - now) / feasMargin);
  if (kWorst < 0) return 0;
  for (let up = REPAIR_MAX_UPSTREAM; up >= 0; up--) {
    const k = kWorst - up;
    const index = indexOfGap.get(k);
    if (index === undefined) continue;
    const estCost = ctx.cost[index];
    if (estCost > 0 && estCost * feasMargin > repairBudget - now) continue;
    const sized = now + Math.ceil(estCost * feasMargin);
    const localBudget = Math.max(minLocalBudget, Math.min(repairBudget, sized) - now);
    const draw = drawPool(model, 0, costBin(localBudget / repairBudget, bins));
    if (draw.pool === null) return 0;
    const outcome = draw.pool[Math.floor(rng.next() * draw.pool.length) % draw.pool.length];
    return outcome.accepted ? outcome.delta : 0;
  }
  return 0;
}

// ----------------------------------------------------------------- report ---

type Group = { archive: ArchiveRecord; compiles: CompileRecord[]; bins: Bins };

function report(): void {
  const recordPaths = values("records");
  if (recordPaths.length === 0) throw new Error("report requires --records=<records.json>");
  const outPath = value("out");
  const jsonPath = value("json");
  const replicates = Number.parseInt(value("replicates") ?? "300", 10);
  const minCell = Number.parseInt(value("min-cell") ?? "30", 10);

  const archives: ArchiveRecord[] = [];
  const compiles: CompileRecord[] = [];
  for (const path of recordPaths) {
    const payload = readJson(resolve(path));
    if (payload.schema !== RECORDS_SCHEMA) throw new Error(`${path}: expected ${RECORDS_SCHEMA}`);
    archives.push(...payload.archives);
    compiles.push(...payload.compiles);
  }
  const usable = new Set(
    archives.filter((archive) => archive.outcomeFields === "fresh").map((archive) => archive.label),
  );
  const groups: Group[] = archives
    .filter((archive) => usable.has(archive.label))
    .sort((a, b) => a.budget - b.budget || a.label.localeCompare(b.label))
    .map((archive) => {
      const rows = compiles.filter(
        (compile) => compile.archive === archive.label && compile.attempts.length > 0,
      );
      return { archive, compiles: rows, bins: buildBins(rows) };
    });

  const out: string[] = [];
  const json: Record<string, unknown> = { schema: REPORT_SCHEMA, minCell, replicates };

  out.push("# Repair selection study", "");
  headlineSection(out);
  json.provenance = archives;
  json.protocol = protocolSection(out, groups);
  json.identity = identitySection(out, groups);
  json.ceilings = ceilingSection(out, groups);
  json.costModel = costModelSection(out, groups);
  json.fidelity = fidelitySection(out, groups);
  json.cross = crossSection(out, groups, minCell);
  json.attemptCount = attemptCountSection(out, groups);
  json.independence = independenceSection(out, groups);
  json.policies = policySection(out, groups, { replicates, minCell });
  verdictSection(out);
  limitsSection(out);

  const text = out.join("\n") + "\n";
  if (outPath !== undefined) {
    writeText(outPath, text);
    process.stderr.write(`wrote ${outPath}\n`);
  } else {
    process.stdout.write(text);
  }
  if (jsonPath !== undefined) writeJson(jsonPath, json);
}

function headlineSection(out: string[]): void {
  out.push(
    "Phase 2's offline replay study from [`budget-unification-plan.md`](budget-unification-plan.md).",
    "`pickFeasibleWeakGap` (`handoff.ts:4725`) ranks repair anchors by raw axis-SSE under",
    "an affordability cap and calls itself \"v1, a proxy for true upstream blame\"; the",
    "selection axis has never been evaluated, while",
    "[`repair-roi-study.md`](repair-roi-study.md) measured that 18.6% of 750k compiles",
    "spend their whole repair allocation for exactly zero gain. This study replays",
    "alternative rankings against 3,520 archived compiles (3,482 of them with a repair",
    "phase) and their 9,479 repair attempts, and prices the difference from those",
    "archives' own acceptance and gain distributions. Everything below is produced by",
    "`scripts/v0/study_repair_selection.ts`; nothing is compiled or refitted.",
    "",
    "**Headline: no ranking in the plan's list earns a Phase 2 candidate, and the",
    "zero-yield pool is not a target.** Four results, in descending order of how firmly",
    "the archives pin them down.",
    "",
    "1. **Ceiling-exclusion is a strict no-op.** Of 320,092 reported gaps across five",
    "   archives, **zero** have their weak axis sitting at its `weakAxisCeiling`, and 48",
    "   carry any irreducible `target − ceiling` residue at all. The replay is bit-exact",
    "   at `+0.000` because the candidate set never changes. This is not a small effect;",
    "   it is the absence of one.",
    "2. **Scorer-weighting is a near-no-op by construction.** The register's",
    "   `axis_quality` pools every axis error into ONE rms, so the marginal value of",
    "   fixing an error is the same constant at every gap and raw axis-SSE is *already*",
    "   the exact scorer-weighted ranking for the comparator that decides acceptance. The",
    "   only divergence from the benchmark's ruler is its weighted-rms-over-per-axis-rms",
    "   form, which on this suite reduces to the twelve sources that author `amplitude`",
    "   at weight 0.1 — measured, not argued: it moves the opening pick on 216 of the 576",
    "   amplitude compiles at N=48 and on **0** of the other 1,536. It prices at",
    "   **−0.001, 90% CI [−0.117, +0.112]** — an order of magnitude below the ROI study's",
    "   0.3-point measurability floor at 750k.",
    "3. **Error-per-estimated-frame is the only policy that moves anything at scale, and",
    "   it loses.** It changes the top-1 pick on 84.9% of compiles and triples the",
    "   attempt count, but where the archives can price it honestly it is negative:",
    "   **−0.913 on the opening decision at 750k** and **−1.436, CI [−2.701, −0.097] at",
    "   150k**, the budget where the ROI study says allocation actually binds. Two",
    "   mechanical facts sit underneath. The compiler's own `costToEnd` goes to ~0 at the",
    "   last gaps of the incumbent path, so an unfloored per-frame ranking is unbounded",
    "   there and degenerates into \"always restart from the final gap\" — a restart the",
    "   compiler would size `ceiling = now`, run for zero nodes and charge zero frames.",
    "   And the acceptance data says anchor size is the wrong thing to trade: across the",
    "   whole local-budget range at a fixed attempt ordinal, mean gain spans at most",
    "   1.5x, while one step in ordinal at a fixed local budget costs 3–10x.",
    "4. **The zero-yield pool is a coin flip, not a population.** An independent model",
    "   over the same (attempt ordinal, local budget) cells reproduces the observed",
    "   zero-gain share to within half a point at every budget (750k: 19.1% modelled vs",
    "   18.6% observed) at an overdispersion of 1.30. There is no separable unfixable",
    "   subpopulation for a ranking to route around — and the one policy that *does*",
    "   empty the pool (per-frame ranking takes it from 20.8% to 5.6%) extracts exactly",
    "   the same 5.54 points from it as the live policy does. It converts one zero into",
    "   several near-zeros.",
    "",
    "The recommendation and what it does license are in *Verdict* at the end.",
  );
  out.push("");
}

function verdictSection(out: string[]): void {
  section(out, "Verdict", [
    "**No Phase 2 selection candidate.** Every ranking the plan named is either exactly",
    "inert (P4, P4b), statistically inert an order of magnitude below the measurability",
    "floor (P2), or negative on the one decision the archives can price (P3, P5, P7).",
    "The two rankings this study added on its own reading of the data — suffix-SSE and",
    "suffix-SSE-per-frame — are worse and no better respectively. The admission ticket",
    "Phase 2 asks the replay to issue has not been earned by any of them.",
    "",
    "**If the campaign spends an eval slot here anyway** — the posture is move-forward",
    "and an eval is 25 minutes — the only defensible passenger is P2, and it should ride",
    "as a *coherence* change, not a yield change: the anchor ranking would then agree",
    "with the ruler the headline is measured by. Expect `+0.0 ± 0.1`, and note the",
    "asymmetry it introduces — selection would follow the benchmark's weighting while",
    "acceptance keeps following the register's pooled rms, which map Cluster E4 puts out",
    "of bounds. A coherence argument that leaves half the loop incoherent is a weak one.",
    "The margin/interval-quantile affordability change the plan wants to bundle here",
    "does not need a ranking passenger and can ride alone.",
    "",
    "**What the study does license.**",
    "",
    "- *The blame proxy is not the bottleneck.* The plan's premise is that a better",
    "  ranking converts part of the zero-yield pool. The cross-tab says the anchor's",
    "  identity is a second-order variable: at a fixed attempt ordinal, acceptance and",
    "  gain barely move with local budget, while at a fixed local budget the first",
    "  attempt is worth several times the second and an order of magnitude more than the",
    "  fifth. Whatever governs a repair's value, it is not which weak gap was chosen.",
    "- *Plan item 4 is the real deliverable and it should grow.* The two additive fields",
    "  (`up`, round index) are necessary — this study had to price by attempt ordinal",
    "  because the round is unrecorded, and getting that wrong is worth a full point of",
    "  spurious yield (pricing an up-walk attempt at its round's rate rather than its own",
    "  ordinal's hands every extra attempt the FIRST attempt's acceptance, and turned",
    "  P3's 750k reading from about −0.2 into about +1.1). Add a third: **the",
    "  incumbent's axis-SSE at the pick**, or the drift report at first completion. Its",
    "  absence is the binding limitation here — the replay is exact on zero-accept",
    "  compiles (fidelity 96–100%) and drops to ~40% decision-1 agreement everywhere",
    "  else, purely because the archived report has already moved.",
    "- *Any future per-frame ranking needs a measured cost floor.* `costToEnd → 0` at",
    "  the tail is a real property of the compiler's estimate, not an artifact of this",
    "  reconstruction, and it makes `SSE / estCost` undefined exactly where it would be",
    "  most tempting.",
    "- *`maxAttempts` is not dead after all — for a per-frame ranking.* The ROI study",
    "  retired `LR_REPAIR_MAX_ATTEMPTS = 64` as never-binding, which is true of the live",
    "  policy (deepest observed restart: 16). Under P3 the replay runs 8.4 attempts at",
    "  750k and 11.2 at 1.5M, and 16% of them land past any restart index the archives",
    "  have ever observed. The cap becomes live the moment the ranking gets cheap.",
    "",
    "**What would reopen it.** Item 3 of the plan — an acceptance-prediction model — is",
    "unaffected by these results, because it targets `p`, and `p` is what the",
    "independence finding says the zero-yield pool is made of. This study only closes",
    "the *reranking* lane. It also says what such a model would have to beat: a",
    "compile-level signal, not a gap-level one, since the gap-level features here",
    "(SSE, its scorer weighting, its ceiling headroom, its cost) collectively move the",
    "predicted yield by less than the bootstrap's own noise.",
  ]);
}

function section(out: string[], title: string, lines: string[]): void {
  out.push(`## ${title}`, "");
  out.push(...lines);
  out.push("");
}

function protocolSection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | budget | compiles w/ repair | repair attempts | telemetry | feasMargin | deepest restart | cost floor (kf) | path |",
    "|---|---:|---:|---:|---|---:|---:|---:|---|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const attempts = group.compiles.reduce((sum, compile) => sum + compile.attempts.length, 0);
    const levels = Object.entries(group.archive.telemetryLevels)
      .map(([level, count]) => `${level}:${count}`)
      .join(" ");
    rows.push(
      `| ${group.archive.label} | ${kf(group.archive.budget)} | ${group.compiles.length} | ` +
        `${attempts} | ${levels} | ${feasMarginFor(group.archive.budget).toFixed(3)} | ` +
        `${group.bins.maxRound} | ` +
        `${((group.bins.minFrac * group.archive.budget) / 1000).toFixed(1)} | ` +
        `\`${group.archive.path.replace(/^.*\/line\//, "")}\` |`,
    );
    json.push({
      label: group.archive.label,
      budget: group.archive.budget,
      attempts,
      maxRound: group.bins.maxRound,
      costFloorFrames: group.bins.minFrac * group.archive.budget,
    });
  }
  section(out, "Protocol", [
    "```text",
    "npx tsx scripts/v0/study_repair_selection.ts extract --archive=<label>:<path> ... \\",
    "  --out=generated/budget-telemetry/repair-selection/records.json",
    "npx tsx scripts/v0/study_repair_selection.ts report \\",
    "  --records=generated/budget-telemetry/repair-selection/records.json \\",
    "  --replicates=1000 --out=docs/repair-selection-study.md \\",
    "  --json=generated/budget-telemetry/repair-selection/report.json",
    "```",
    "",
    "Every archive is read for its V3 `budgetTelemetry.episodes` and final drift",
    "report. The frontier-repair episode counts reproduce `docs/repair-roi-study.md` exactly, which is",
    "the reader's cross-check that the two studies see the same population. `cost floor`",
    "is the smallest local budget any restart in that archive was ever sized to — the",
    "empirical lower bound the per-frame policies need to be well defined (see",
    "*Policies*).",
    "",
    ...rows,
  ]);
  return json;
}

function identitySection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | " + POLICIES.slice(1).map((p) => p.id).join(" | ") + " |",
    "|---|" + POLICIES.slice(1).map(() => "---:").join("|") + "|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const costFloor = group.bins.minFrac * group.archive.budget;
    const cells: string[] = [];
    for (const policy of POLICIES.slice(1)) {
      let differ = 0;
      for (const compile of group.compiles) {
        const ctx = buildContext(compile, costFloor);
        const a = rankOrder(ctx, POLICIES[0])[0];
        const b = rankOrder(ctx, policy)[0];
        if (a !== b) differ++;
      }
      const share = differ / Math.max(1, group.compiles.length);
      cells.push(pct(share));
      json.push({ archive: group.archive.label, policy: policy.id, differ, share });
    }
    rows.push(`| ${group.archive.label} | ${cells.join(" | ")} |`);
  }
  // P2's entire mechanism, isolated: the compiler's own `axis_quality` pools every
  // axis error into ONE rms, so raw SSE is already its exact marginal ranking. The
  // benchmark instead takes a weighted rms over PER-AXIS rms values. With equal
  // observation counts per axis — true on all 44 sources — the two coincide unless
  // the spec authors a fourth axis at a different weight.
  const amplitudeRows = [
    "| archive | compiles | with a 4th scored axis | P2 moves the pick there | P2 moves the pick elsewhere |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const group of groups) {
    const costFloor = group.bins.minFrac * group.archive.budget;
    let four = 0;
    let movedFour = 0;
    let movedThree = 0;
    for (const compile of group.compiles) {
      const ctx = buildContext(compile, costFloor);
      const moved = rankOrder(ctx, POLICIES[0])[0] !== rankOrder(ctx, POLICIES[1])[0];
      if (compile.axes.length > 3) {
        four++;
        if (moved) movedFour++;
      } else if (moved) movedThree++;
    }
    amplitudeRows.push(
      `| ${group.archive.label} | ${group.compiles.length} | ${four} | ${movedFour} | ${movedThree} |`,
    );
  }

  section(out, "Does the ranking even change?", [
    "Share of compiles whose unconstrained top-1 anchor differs from the live pick, on",
    "the archived incumbent. A policy that never moves the pick cannot move the score,",
    "and this is the cheapest way to retire one.",
    "",
    ...rows,
    "",
    "**What P2 actually is.** The compiler's `axis_quality` pools every axis error into",
    "one RMS (`score.ts:155`), so `d(axis_quality)/d(error²)` is the SAME constant at",
    "every gap and raw axis-SSE is *already* the exact marginal-scorer ranking for the",
    "register's own comparator. The benchmark differs: it takes a weighted RMS over",
    "per-axis RMS values with `air/speed/impact = 0.3` and `amplitude = 0.1`",
    "(`benchmark/v2/compat/suite-manifest.json`), so the two rankings can only diverge",
    "where a spec's axes carry unequal weight-per-observation. Every source in the suite",
    "reports all its axes on all its gaps, which leaves exactly one mechanism: the twelve",
    "sources that author `amplitude`, whose weight is a third of the others'.",
    "",
    ...amplitudeRows,
  ]);
  return json;
}

function ceilingSection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | reported gaps | weak axis at its ceiling | any ceiling floor > 0 | mean floor share of SSE |",
    "|---|---:|---:|---:|---:|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    let gaps = 0;
    let atCeiling = 0;
    let anyFloor = 0;
    let floorShare = 0;
    for (const compile of group.compiles) {
      for (const gap of compile.gaps) {
        gaps++;
        if (gap.weakAtCeiling) atCeiling++;
        if (gap.sseFloorRaw > 1e-12) anyFloor++;
        if (gap.sseRaw > 0) floorShare += gap.sseFloorRaw / gap.sseRaw;
      }
    }
    rows.push(
      `| ${group.archive.label} | ${gaps} | ${atCeiling} | ${anyFloor} | ` +
        `${(floorShare / Math.max(1, gaps)).toFixed(5)} |`,
    );
    json.push({ archive: group.archive.label, gaps, atCeiling, anyFloor });
  }
  section(out, "How much error is at a ceiling?", [
    "`weakAxisCeiling` exists on two axes only (`substrate.ts:697/713`: the elevation",
    "climb ceiling and the impact catchable-redirection ceiling). The exclusion policy",
    "needs gaps whose weak axis error is already the irreducible `target − ceiling`",
    "residue. This is how many there are.",
    "",
    ...rows,
  ]);
  return json;
}

function costModelSection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | known gaps / compile | coverage | LOO median APE | LOO p90 APE | sparse-vs-dense median APE |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const looErrors: number[] = [];
    const sparseErrors: number[] = [];
    let knownTotal = 0;
    let gapTotal = 0;
    for (const compile of group.compiles) {
      knownTotal += compile.costPoints.length;
      gapTotal += compile.gaps.length;
      const points = compile.costPoints;
      for (let i = 0; i < points.length; i++) {
        const held = points[i];
        const rest = points.filter((_, index) => index !== i);
        if (rest.length === 0) continue;
        const predicted = buildCostModel(compile, rest).at(held[0]);
        if (held[1] > 0) looErrors.push(Math.abs(predicted - held[1]) / held[1]);
      }
      if (compile.costPointsSparse.length > 0 &&
        compile.costPoints.length > compile.costPointsSparse.length) {
        const sparse = buildCostModel(compile, compile.costPointsSparse);
        for (const [k, truth] of compile.costPoints) {
          if (truth > 0) sparseErrors.push(Math.abs(sparse.at(k) - truth) / truth);
        }
      }
    }
    rows.push(
      `| ${group.archive.label} | ` +
        `${(knownTotal / Math.max(1, group.compiles.length)).toFixed(1)} | ` +
        `${pct(knownTotal / Math.max(1, gapTotal))} | ${pct(quantile(looErrors, 0.5))} | ` +
        `${pct(quantile(looErrors, 0.9))} | ` +
        `${sparseErrors.length > 0 ? pct(quantile(sparseErrors, 0.5)) : "n/a"} |`,
    );
    json.push({
      archive: group.archive.label,
      knownPerCompile: knownTotal / Math.max(1, group.compiles.length),
      looMedianApe: quantile(looErrors, 0.5),
      looP90Ape: quantile(looErrors, 0.9),
      sparseMedianApe: sparseErrors.length > 0 ? quantile(sparseErrors, 0.5) : null,
    });
  }
  section(out, "Cost model", [
    "`estCostOf(k)` is reconstructed from `incumbent_path_work_estimate_frames`, the",
    "value the estimator read off the compiler's own `costToEnd` array at every",
    "observation's high-water gap: exact there, linearly interpolated elsewhere,",
    "anchored at `costToEnd[0] = firstCompletionFrame`. `LOO` holds out one known point",
    "and predicts it from the rest. `sparse-vs-dense` is the accuracy of the",
    "two-points-per-attempt reconstruction a `summary`-level archive allows, scored",
    "against the dense `trace` truth — it is the error the N48 replay carries, and the",
    "N48's own LOO column is pessimistic because it holds a point out of an already",
    "two-or-three-point set.",
    "",
    ...rows,
  ]);
  return json;
}

function fidelitySection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | stratum | compiles | decision-1 anchor exact | within +/-1 | all-attempt anchor exact |",
    "|---|---|---:|---:|---:|---:|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const costFloor = group.bins.minFrac * group.archive.budget;
    for (const stratum of ["zero-accept", "accepting", "all"] as const) {
      const rows_ = group.compiles.filter((compile) => {
        const accepts = compile.attempts.filter((a) => a.accepted === true).length;
        if (stratum === "zero-accept") return accepts === 0;
        if (stratum === "accepting") return accepts > 0;
        return true;
      });
      let first = 0;
      let firstNear = 0;
      let allMatch = 0;
      let allTotal = 0;
      for (const compile of rows_) {
        const ctx = buildContext(compile, costFloor);
        const trace = traceReplay(ctx, rankOrder(ctx, POLICIES[0]));
        const observed = compile.attempts.map((a) => a.anchorGap);
        if (trace.length > 0 && observed.length > 0) {
          if (trace[0] === observed[0]) first++;
          if (Math.abs(trace[0] - observed[0]) <= 1) firstNear++;
        }
        for (let i = 0; i < observed.length; i++) {
          allTotal++;
          if (trace[i] === observed[i]) allMatch++;
        }
      }
      rows.push(
        `| ${group.archive.label} | ${stratum} | ${rows_.length} | ` +
          `${pct(first / Math.max(1, rows_.length))} | ${pct(firstNear / Math.max(1, rows_.length))} | ` +
          `${pct(allMatch / Math.max(1, allTotal))} |`,
      );
      json.push({
        archive: group.archive.label,
        stratum,
        compiles: rows_.length,
        decision1Exact: first / Math.max(1, rows_.length),
        allExact: allMatch / Math.max(1, allTotal),
      });
    }
  }
  section(out, "Replay fidelity", [
    "The live ranking replayed against the archive with the observed accept/reject",
    "sequence and the observed per-attempt spend substituted in, so the only thing under",
    "test is the SELECTION arithmetic: weakness map, cost model, affordability cap,",
    "`exhausted`, upstream walk. `zero-accept` compiles are the clean stratum — their",
    "archived report IS the incumbent report the live policy saw at every round, because",
    "nothing was ever adopted. Everywhere else the report has moved under the replay's",
    "feet, and the gap between the two strata is the size of that problem.",
    "",
    ...rows,
  ]);
  return json;
}

/** Replay the live ranking while following the observed outcome sequence. */
function traceReplay(ctx: PolicyContext, order: number[]): number[] {
  const compile = ctx.compile;
  const feasMargin = feasMarginFor(compile.budget);
  const repairBudget = compile.policyBudget;
  const indexOfGap = new Map<number, number>();
  for (let i = 0; i < compile.gaps.length; i++) indexOfGap.set(compile.gaps[i].k, i);
  const exhausted = new Set<number>();
  let now = compile.repairStart ?? compile.firstCompletionFrame;
  const anchors: number[] = [];
  let index = 0;
  while (index < compile.attempts.length && now < repairBudget) {
    const kWorst = pick(ctx, order, exhausted, (repairBudget - now) / feasMargin);
    if (kWorst < 0) break;
    let improvedAny = false;
    for (let up = REPAIR_MAX_UPSTREAM; up >= 0; up--) {
      const k = kWorst - up;
      if (index >= compile.attempts.length || now >= repairBudget) break;
      const i = indexOfGap.get(k);
      if (i === undefined) continue;
      const estCost = ctx.cost[i];
      if (estCost > 0 && estCost * feasMargin > repairBudget - now) continue;
      const observed = compile.attempts[index];
      anchors.push(k);
      now += observed.spent;
      index++;
      if (observed.accepted === true) {
        improvedAny = true;
        break;
      }
    }
    if (!improvedAny) exhausted.add(kWorst);
  }
  return anchors;
}

function crossSection(out: string[], groups: Group[], minCell: number): unknown {
  const json: unknown[] = [];
  const lines: string[] = [];
  for (const group of groups) {
    const bins = group.bins;
    const header = ["Q1", "Q2", "Q3", "Q4", "Q5"];
    lines.push(
      `**${group.archive.label}** — local-budget bins as a share of policy budget: ` +
        `Q1 < ${pct(bins.edges[0])}, ` +
        bins.edges
          .map((edge, i) =>
            i + 1 < bins.edges.length
              ? `Q${i + 2} ${pct(edge)}–${pct(bins.edges[i + 1])}`
              : `Q${i + 2} > ${pct(edge)}`,
          )
          .join(", ") +
        ".",
    );
    lines.push("");
    lines.push(`| attempt | ${header.join(" | ")} |`);
    lines.push(`|---|${header.map(() => "---").join("|")}|`);
    for (let r = 0; r < ROUND_BUCKETS; r++) {
      const cells: string[] = [];
      for (let c = 0; c < COST_BINS; c++) {
        const pool: AttemptRecord[] = [];
        for (const compile of group.compiles) {
          for (const attempt of compile.attempts) {
            if (attempt.accepted === null || attempt.localBudget <= 0) continue;
            if (roundBucket(attempt.restart) !== r) continue;
            if (costBin(attempt.localBudget / compile.policyBudget, bins) !== c) continue;
            pool.push(attempt);
          }
        }
        if (pool.length === 0) {
          cells.push("—");
          continue;
        }
        const accept = pool.filter((a) => a.accepted).length / pool.length;
        const gain = pool.reduce((sum, a) => sum + (a.delta ?? 0), 0) / pool.length;
        cells.push(
          `n=${pool.length}${pool.length < minCell ? "\\*" : ""} ${pct(accept)} ${gain.toFixed(2)}`,
        );
        json.push({ archive: group.archive.label, round: r, bin: c, n: pool.length, accept, gain });
      }
      lines.push(`| ${r === ROUND_BUCKETS - 1 ? `${r}+` : r} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  section(out, "The identifying cross-tab", [
    "Each cell is `n / accept rate / mean gain (pts)` for observed repair attempts at",
    "that (attempt ordinal, local budget). The ROI study's marginal tables cannot",
    "separate these two — \"local budget, anchor depth and restart index are one variable",
    "seen three ways\" — and every question a selection policy raises is a question about",
    "the off-diagonal. Cells below the",
    `${minCell}-sample floor are marked \`*\` and are priced from the nearest populated`,
    "bin of the SAME ordinal, never from a different one.",
    "",
    ...lines,
  ]);
  return json;
}

function attemptCountSection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | 1 | 2 | 3 | 4 | 5 | 6+ | per-round mean gain |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const by = new Map<number, { n: number; gain: number }>();
    for (const compile of group.compiles) {
      const bucket = Math.min(6, compile.attempts.length);
      const entry = by.get(bucket) ?? { n: 0, gain: 0 };
      entry.n++;
      entry.gain += compile.attempts.reduce((sum, a) => sum + (a.delta ?? 0), 0);
      by.set(bucket, entry);
    }
    const cells = [1, 2, 3, 4, 5, 6].map((bucket) => {
      const entry = by.get(bucket);
      return entry === undefined ? "—" : `${(entry.gain / entry.n).toFixed(2)} (n=${entry.n})`;
    });
    const byRound = new Map<number, { n: number; gain: number }>();
    for (const compile of group.compiles) {
      for (const attempt of compile.attempts) {
        const entry = byRound.get(attempt.restart) ?? { n: 0, gain: 0 };
        entry.n++;
        entry.gain += attempt.delta ?? 0;
        byRound.set(attempt.restart, entry);
      }
    }
    const profile = [...byRound.keys()]
      .sort((a, b) => a - b)
      .filter((r) => r <= 8)
      .map((r) => (byRound.get(r)!.gain / byRound.get(r)!.n).toFixed(2))
      .join(" ");
    rows.push(`| ${group.archive.label} | ${cells.join(" | ")} | ${profile} |`);
    json.push({ archive: group.archive.label, profile });
  }
  section(out, "What another attempt is worth, observationally", [
    "Mean total repair gain per compile, by how many restarts that compile happened to",
    "run; and the per-round mean gain profile (rounds 0..8). Both are confounded — a",
    "compile runs more restarts when its restarts are cheap AND when a productive gap",
    "keeps getting re-picked — but they bound the direction: the per-round profile",
    "collapses by a factor of four after round 0 and by an order of magnitude by round",
    "3, and no archive has ever observed the many-cheap-restarts sequence that a",
    "per-frame ranking would produce.",
    "",
    ...rows,
  ]);
  return json;
}

function independenceSection(out: string[], groups: Group[]): unknown {
  const rows = [
    "| archive | compiles | attempts/compile | accept rate | observed zero-gain | independent-model zero | observed var / model var |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  const json: unknown[] = [];
  for (const group of groups) {
    const bins = group.bins;
    const rates = new Map<string, { n: number; accepted: number }>();
    for (const compile of group.compiles) {
      for (const attempt of compile.attempts) {
        if (attempt.accepted === null || attempt.localBudget <= 0) continue;
        const key = `${roundBucket(attempt.restart)}|${costBin(attempt.localBudget / compile.policyBudget, bins)}`;
        const entry = rates.get(key) ?? { n: 0, accepted: 0 };
        entry.n++;
        if (attempt.accepted) entry.accepted++;
        rates.set(key, entry);
      }
    }
    const totals = [...rates.values()];
    const globalRate = totals.reduce((sum, e) => sum + e.accepted, 0) /
      Math.max(1, totals.reduce((sum, e) => sum + e.n, 0));
    let observedZero = 0;
    let modelZero = 0;
    let modelVar = 0;
    let attempts = 0;
    const counts: number[] = [];
    for (const compile of group.compiles) {
      let pNone = 1;
      let variance = 0;
      let accepts = 0;
      for (const attempt of compile.attempts) {
        if (attempt.accepted === null || attempt.localBudget <= 0) continue;
        attempts++;
        const key = `${roundBucket(attempt.restart)}|${costBin(attempt.localBudget / compile.policyBudget, bins)}`;
        const entry = rates.get(key);
        const p = entry !== undefined && entry.n >= 20 ? entry.accepted / entry.n : globalRate;
        pNone *= 1 - p;
        variance += p * (1 - p);
        if (attempt.accepted) accepts++;
      }
      counts.push(accepts);
      modelZero += pNone;
      modelVar += variance;
      if (accepts === 0) observedZero++;
    }
    const n = Math.max(1, group.compiles.length);
    const meanCount = counts.reduce((sum, c) => sum + c, 0) / n;
    const observedVar = counts.reduce((sum, c) => sum + (c - meanCount) ** 2, 0) / Math.max(1, n - 1);
    rows.push(
      `| ${group.archive.label} | ${group.compiles.length} | ${(attempts / n).toFixed(2)} | ` +
        `${pct(globalRate)} | ${pct(observedZero / n)} | ${pct(modelZero / n)} | ` +
        `${(observedVar / Math.max(1e-9, modelVar / n)).toFixed(2)} |`,
    );
    json.push({
      archive: group.archive.label,
      observedZero: observedZero / n,
      modelZero: modelZero / n,
      overdispersion: observedVar / Math.max(1e-9, modelVar / n),
    });
  }
  section(out, "Is the zero-yield pool a population or a coin flip?", [
    "The conversion question has a prior. If per-attempt acceptance were independent",
    "given (round, local budget), the zero-gain share would already be the tail of that",
    "product — nothing to detect, nothing to avoid. `independent-model zero` is",
    "`prod(1 − p_i)` per compile, averaged over the archive, with `p_i` the compile's own",
    "cross-cell rate; `observed var / model var` is the accepts-per-compile",
    "overdispersion against the same model. A ratio near 1 with a matching zero share",
    "says there is no separable unfixable subpopulation for a ranking to route around.",
    "",
    ...rows,
  ]);
  return json;
}

function policySection(
  out: string[],
  groups: Group[],
  opts: { replicates: number; minCell: number },
): unknown {
  const json: unknown[] = [];
  for (const group of groups) {
    const costFloor = group.bins.minFrac * group.archive.budget;
    const contexts = new Map<CompileRecord, PolicyContext>();
    const orders = new Map<CompileRecord, Map<string, number[]>>();
    for (const compile of group.compiles) {
      const ctx = buildContext(compile, costFloor);
      contexts.set(compile, ctx);
      const perPolicy = new Map<string, number[]>();
      for (const policy of POLICIES) perPolicy.set(policy.id, rankOrder(ctx, policy));
      orders.set(compile, perPolicy);
    }
    const observedGain = group.compiles.reduce(
      (sum, compile) => sum + compile.attempts.reduce((inner, a) => inner + (a.delta ?? 0), 0),
      0,
    ) / Math.max(1, group.compiles.length);
    const observedZero = group.compiles.filter(
      (compile) => compile.attempts.every((a) => a.accepted !== true),
    );
    const zeroSet = new Set(observedZero);

    type Acc = {
      total: number[];
      matched: number[];
      deep: number[];
      zero: number[];
      attempts: number[];
      fallback: number[];
      uncredited: number[];
      decisionOne: number[];
      zeroPoolGain: number[];
      zeroPoolConverted: number[];
      paired: number[];
      pairedMatched: number[];
      pairedDecisionOne: number[];
    };
    const acc = new Map<string, Acc>();
    for (const policy of POLICIES) {
      acc.set(policy.id, {
        total: [], matched: [], deep: [], zero: [], attempts: [], fallback: [],
        uncredited: [], decisionOne: [], zeroPoolGain: [], zeroPoolConverted: [],
        paired: [], pairedMatched: [], pairedDecisionOne: [],
      });
    }

    const rng = makeRng(0x5eed_1234);
    for (let rep = 0; rep < opts.replicates; rep++) {
      const sample: CompileRecord[] = [];
      for (let i = 0; i < group.compiles.length; i++) {
        sample.push(group.compiles[Math.floor(rng.next() * group.compiles.length) % group.compiles.length]);
      }
      const model = buildOutcomeModel(sample, group.bins, opts.minCell);
      const totals = new Map<string, {
        total: number; matched: number; deep: number; zero: number; attempts: number;
        fallback: number; uncredited: number; decisionOne: number;
        zeroPoolGain: number; zeroPoolConverted: number; zeroPoolN: number;
      }>();
      for (const policy of POLICIES) {
        totals.set(policy.id, {
          total: 0, matched: 0, deep: 0, zero: 0, attempts: 0, fallback: 0,
          uncredited: 0, decisionOne: 0, zeroPoolGain: 0, zeroPoolConverted: 0, zeroPoolN: 0,
        });
      }
      for (let index = 0; index < sample.length; index++) {
        const compile = sample[index];
        const ctx = contexts.get(compile)!;
        const perPolicy = orders.get(compile)!;
        // One seed per (replicate, compile) shared by every policy: the outcome
        // draws line up wherever two policies make the same decision, which is
        // what makes the paired difference tight.
        const seed = (rep * 0x9e3779b1 + index * 0x85ebca6b + 1) >>> 0;
        const inZeroPool = zeroSet.has(compile);
        for (const policy of POLICIES) {
          const order = perPolicy.get(policy.id)!;
          const result = replay(ctx, order, model, group.bins, makeRng(seed));
          const one = replayDecisionOne(ctx, order, model, group.bins, makeRng(seed ^ 0x1234_5678));
          const entry = totals.get(policy.id)!;
          entry.total += result.gain;
          entry.matched += result.gainMatched;
          entry.deep += result.gainDeep;
          entry.zero += result.accepts === 0 ? 1 : 0;
          entry.attempts += result.attempts;
          entry.fallback += result.fallback;
          entry.uncredited += result.uncredited;
          entry.decisionOne += one;
          if (inZeroPool) {
            entry.zeroPoolN++;
            entry.zeroPoolGain += result.gain;
            entry.zeroPoolConverted += result.accepts > 0 ? 1 : 0;
          }
        }
      }
      const n = Math.max(1, sample.length);
      const base = totals.get("current")!;
      for (const policy of POLICIES) {
        const entry = totals.get(policy.id)!;
        const store = acc.get(policy.id)!;
        store.total.push(entry.total / n);
        store.matched.push(entry.matched / n);
        store.deep.push(entry.deep / n);
        store.zero.push(entry.zero / n);
        store.attempts.push(entry.attempts / n);
        store.fallback.push(entry.fallback / Math.max(1, entry.attempts));
        store.uncredited.push(entry.uncredited / Math.max(1, entry.attempts));
        store.decisionOne.push(entry.decisionOne / n);
        store.zeroPoolGain.push(entry.zeroPoolGain / Math.max(1, entry.zeroPoolN));
        store.zeroPoolConverted.push(entry.zeroPoolConverted / Math.max(1, entry.zeroPoolN));
        store.paired.push((entry.total - base.total) / n);
        store.pairedMatched.push((entry.matched - base.matched) / n);
        store.pairedDecisionOne.push((entry.decisionOne - base.decisionOne) / n);
      }
    }

    const rows = [
      "| policy | delta vs current | 90% CI | no-fallback delta | decision-1 delta | 90% CI | attempts | gain past attempt 5 | fallback-priced | uncredited |",
      "|---|---:|---|---:|---:|---|---:|---:|---:|---:|",
    ];
    for (const policy of POLICIES) {
      const store = acc.get(policy.id)!;
      rows.push(
        `| ${policy.label} | ${signed(mean(store.paired))} | ` +
          `[${signed(quantile(store.paired, 0.05))}, ${signed(quantile(store.paired, 0.95))}] | ` +
          `${signed(mean(store.pairedMatched))} | ` +
          `${signed(mean(store.pairedDecisionOne))} | ` +
          `[${signed(quantile(store.pairedDecisionOne, 0.05))}, ${signed(quantile(store.pairedDecisionOne, 0.95))}] | ` +
          `${mean(store.attempts).toFixed(2)} | ${mean(store.deep).toFixed(3)} | ` +
          `${pct(mean(store.fallback))} | ${pct(mean(store.uncredited))} |`,
      );
      json.push({
        archive: group.archive.label,
        policy: policy.id,
        gain: mean(store.total),
        delta: mean(store.paired),
        ci90: [quantile(store.paired, 0.05), quantile(store.paired, 0.95)],
        deltaSupportOnly: mean(store.pairedMatched),
        decisionOneDelta: mean(store.pairedDecisionOne),
        decisionOneCi90: [
          quantile(store.pairedDecisionOne, 0.05),
          quantile(store.pairedDecisionOne, 0.95),
        ],
        attempts: mean(store.attempts),
        gainPastRound5: mean(store.deep),
        uncreditedShare: mean(store.uncredited),
        fallbackShare: mean(store.fallback),
        zeroShare: mean(store.zero),
        zeroPoolGain: mean(store.zeroPoolGain),
        zeroPoolConverted: mean(store.zeroPoolConverted),
      });
    }

    const zeroRows = [
      "| policy | replayed zero-yield share | on the observed zero-yield pool: gain | converted |",
      "|---|---:|---:|---:|",
    ];
    for (const policy of POLICIES) {
      const store = acc.get(policy.id)!;
      zeroRows.push(
        `| ${policy.label} | ${pct(mean(store.zero))} | ${mean(store.zeroPoolGain).toFixed(3)} | ` +
          `${pct(mean(store.zeroPoolConverted))} |`,
      );
    }

    section(out, `Predicted yield — ${group.archive.label} (${kf(group.archive.budget)})`, [
      `Observed mean repair gain: **${observedGain.toFixed(3)} pts/compile**; the replay's own`,
      `current-policy figure is ${mean(acc.get("current")!.total).toFixed(3)}, which is the`,
      "calibration check. Cluster bootstrap over compiles,",
      `${opts.replicates} replicates, outcome model refit inside each replicate. Every`,
      "policy sees the same resampled compiles and the same per-compile random stream, so",
      "the delta columns are PAIRED and their CIs are CIs of the difference.",
      "",
      "`no-fallback delta` re-runs the same arithmetic crediting ONLY attempts whose",
      `(ordinal, local-budget) cell was directly populated at n >= ${opts.minCell}; the gap`,
      "between it and the headline delta is how much of the claim rests on the",
      "nearest-bin fallback, and the fallback's bias has a known sign — the nearest",
      "populated bin of a thin cheap cell is a MORE expensive bin with a HIGHER mean gain,",
      "so the fallback flatters whichever policy shops in the cheap bins.",
      "`decision-1 delta` is the opening attempt alone, everything downstream ignored —",
      "the only number LC-22 lets us read as a real counterfactual.",
      "",
      ...rows,
      "",
      "Zero-yield conversion. The last two columns restrict to the compiles that actually",
      `ended with zero gain in this archive (n=${observedZero.length}) — the stratum where`,
      "the replay is exact because the archived report never moved.",
      "",
      ...zeroRows,
    ]);
  }
  return json;
}

function limitsSection(out: string[]): void {
  section(out, "Limits", [
    "1. **The incumbent report is the final one.** The archive records the drift report",
    "   after the whole repair phase, not at each pick. On zero-accept compiles the two",
    "   are the same object and the replay is exact (fidelity 96–100%); elsewhere the",
    "   weakness map is stale in one direction — accepted repairs already lowered the",
    "   suffix error at their own anchor — and decision-1 fidelity falls to ~40%.",
    "2. **LC-22.** `restartCounter` advances per attempt, so the first different choice",
    "   reseeds every downstream restart. Round 0 is the only decision the archive pins",
    "   to a real counterfactual; every later round is a distributional statement, and",
    "   the study reports the two separately for that reason.",
    "3. **The outcome model is a resampler, not a mechanism.** It knows (round, local",
    "   budget) and nothing about whether THIS anchor can be fixed. Its acceptance rates",
    "   come from attempts the LIVE policy chose, so a counterfactual anchor is priced by",
    "   analogy: same round, same size, different gap.",
    "4. **Deep sequences are unobserved.** Rounds past the archive's deepest restart are",
    "   credited zero, and the `gain past round 5` column exposes how much of a policy's",
    "   claim sits in the thinnest rounds it does get credit for.",
    "5. **`up` is not recorded.** The upstream walk is reconstructed from the loop, not",
    "   observed; the archived anchor is `kWorst − up` with `up` unknown (ROI study H6).",
    "6. **The resumed frontier is unpriced.** Frames a policy declines to spend are",
    "   credited at zero, not at the resumed frontier's unmeasured rate.",
  ]);
}

// ------------------------------------------------------------------ utils ---

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round9(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index];
}

function pct(value: number): string {
  return `${(100 * value).toFixed(1)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function kf(frames: number): string {
  return frames >= 1_000_000 ? `${(frames / 1_000_000).toFixed(2)}M` : `${Math.round(frames / 1000)}k`;
}

function readJson(path: string): any {
  const raw = path.endsWith(".gz")
    ? gunzipSync(readFileSync(path)).toString("utf8")
    : readFileSync(path, "utf8");
  return JSON.parse(raw);
}

function writeJson(path: string, payload: unknown): void {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, JSON.stringify(payload));
}

function writeText(path: string, text: string): void {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text);
}

// --------------------------------------------------------------- dispatch ---

if (verb === "extract") await extract();
else if (verb === "report") report();
else throw new Error("usage: study_repair_selection.ts <extract|report> ...");
