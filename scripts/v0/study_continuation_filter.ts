/**
 * L3 residue — the online-continuation filter's own numbers (metric M9).
 *
 * THE QUESTION
 *   Under full deadline pressure and before first completion, `rankedOptions`
 *   drops every ranked option whose charged rollout already proved it cannot
 *   place the next contact (`forwardContinuation === false`). That prune has
 *   never been measured: nobody knows how often it fires, how much it removes,
 *   or — the part that matters — whether the verdicts it acts on are TRUE.
 *   `docs/rollout-economics-study.md` §4.2 says 53.3% of hop-1 dead-end verdicts
 *   were false BEFORE redraw-on-empty shipped; this study asks the same question
 *   of the surviving verdicts, restricted to the ones the filter actually
 *   removes from the frontier.
 *
 * OBSERVATION ONLY
 *   One hook, `setHandoffDeadlineProbeHook`, already fires at the exact line the
 *   decision is made and now carries the pruned options and their verdict nodes.
 *   No default is touched and nothing is fed back into the search. With no hook
 *   installed the compiler builds none of it.
 *
 * TWO ARMS, because they answer differently-priced questions
 *   FIRING  (`--truth-rate=0`) is exact: the compile is bit-identical to an
 *           uninstrumented one, so the rates are the production rates.
 *   TRUTH   (`--truth-rate=1`) re-draws generation at each pruned verdict node,
 *           on a cache-isolated copy, charging then refunding every frame. That
 *           is Tier 3: track-identical but NOT frame-identical (the study
 *           measured median |dsim_frames| 0.034%, max 6.47%), so firing rates
 *           are reported from the FIRING arm and truth from the TRUTH arm, and
 *           the runner cross-checks that the two arms produced the same track.
 *
 * Usage:
 *   node --import tsx scripts/v0/study_continuation_filter.ts \
 *     --sources=a,b,c --seeds=0,1,2 --budgets=250000,750000 --jobs=12 \
 *     --truth-rate=1 --out=<path>.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../produce/seed.ts";
import { compileLegacyHandoff, setHandoffDeadlineProbeHook } from "./optimizer/legacy_handoff.ts";
import { getCandidatesSorted, type SearchNode } from "./optimizer/node.ts";
import { getSimFrames, refundSimFramesTo } from "./optimizer/sim_frames.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "./benchmark_v2/model.ts";

/** The widths the SEARCH itself uses, up to the two rescue tiers (32, 80) —
 *  the same ladder `study_rollout_economics.ts` audits verdicts on, so the two
 *  verified-true rates are directly comparable. */
const TRUTH_LADDER = [1, 2, 3, 5, 8, 12, 16, 24, 32, 48, 64, 80];

type Task = {
  sourceId: string;
  role: string;
  seed: number;
  budget: number;
  joltMs: number;
  manifestPath: string;
  /** Fraction of pruned verdicts to audit; 0 = the exact FIRING arm. */
  truthRate: number;
  truthMax: number;
};

type Result = {
  task: Task;
  status: "ok" | "error";
  elapsedMs: number;
  error?: string;
  trackHash?: string;
  fullScore?: number;
  simFrames?: number;
  firstCompletionFrame?: number | null;
  filter?: {
    /** Every `rankedOptions` call that read the margin. */
    poolBuilds: number;
    /** ...before first completion, the only phase the filter can fire in. */
    preBuilds: number;
    /** ...and at full deadline pressure, the filter's own anchor. */
    preFullPressure: number;
    /** Builds where the filter ENGAGED (all four conditions true). */
    firings: number;
    /** ...of which actually removed at least one option. */
    actingFirings: number;
    /** Options removed, summed over builds. */
    prunedOptions: number;
    /** Distinct verdict nodes behind them (a node can back several options). */
    prunedNodes: number;
  };
  truth?: {
    /** Verdicts offered to the audit (deduplicated by node identity). */
    seen: number;
    sampled: number;
    /** Nothing lives there at any ladder width up to 80 — the verdict was TRUE. */
    verifiedTrue: number;
    /** Smallest width at which generation found a catch; "none" = never. */
    aliveAtHistogram: Record<string, number>;
    /** Frames the audit charged (all refunded). */
    framesCharged: number;
    /** Sanity: the verdict reproduced empty at the rollout's own width. */
    reproduceFailures: number;
  };
};

if (isMainThread) await main();
else await workerMain(workerData as Task);

// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic uniform in [0,1) — the sampler must not depend on wall clock
 *  or on how the shards happened to interleave. */
function unitHash(a: number, b: number, c: number): number {
  let h = 0x811c9dc5;
  for (const value of [a, b, c]) {
    h ^= value | 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 15;
  }
  return (h >>> 8) / 0x1000000;
}

async function workerMain(task: Task): Promise<void> {
  const started = performance.now();
  try {
    const sources = resolveSources(loadSourceManifest(task.manifestPath));
    const source = sources.find((entry) => entry.id === task.sourceId);
    if (source === undefined) throw new Error(`${task.sourceId}: source unavailable`);
    const spec = applyJolt(await loadSourceSpec(source), task.joltMs);

    const filter = {
      poolBuilds: 0,
      preBuilds: 0,
      preFullPressure: 0,
      firings: 0,
      actingFirings: 0,
      prunedOptions: 0,
      prunedNodes: 0,
    };
    const truth = {
      seen: 0,
      sampled: 0,
      verifiedTrue: 0,
      aliveAtHistogram: {} as Record<string, number>,
      framesCharged: 0,
      reproduceFailures: 0,
    };
    // A verdict node can back several ranked options in the same pool and can
    // be revisited across builds; audit each node once so the rate is over
    // VERDICTS, not over option slots.
    const audited = new WeakSet<SearchNode>();

    setHandoffDeadlineProbeHook((record) => {
      filter.poolBuilds += 1;
      if (!record.hasCompletion) {
        filter.preBuilds += 1;
        if (record.pressure >= 1) filter.preFullPressure += 1;
      }
      if (!record.onlineContinuationApplied) return;
      filter.firings += 1;
      if (record.onlineContinuationPruned > 0) filter.actingFirings += 1;
      filter.prunedOptions += record.onlineContinuationPruned;
      filter.prunedNodes += record.onlineContinuationPrunedNodes.length;
      if (task.truthRate <= 0) return;
      for (const node of record.onlineContinuationPrunedNodes) {
        if (audited.has(node)) continue;
        audited.add(node);
        truth.seen += 1;
        if (truth.sampled >= task.truthMax) continue;
        if (unitHash(task.seed, record.gapIndex, truth.seen) >= task.truthRate) continue;
        auditVerdict(node, record.gaps, record.ctx, record.seed, truth);
      }
    });

    const { track, report, stats } = compileLegacyHandoff(spec, task.seed, { budget: task.budget });
    setHandoffDeadlineProbeHook(null);

    const anyStats = stats as unknown as Record<string, unknown>;
    parentPort!.postMessage({
      task,
      status: "ok",
      elapsedMs: performance.now() - started,
      trackHash: createHash("sha256").update(JSON.stringify(track)).digest("hex"),
      fullScore: Number((report as unknown as { full_score?: number }).full_score ?? 0),
      simFrames: Number(anyStats.sim_frames ?? 0),
      firstCompletionFrame: anyStats.first_completion_frame === undefined
        ? null
        : Number(anyStats.first_completion_frame),
      filter,
      ...(task.truthRate > 0 ? { truth } : {}),
    } satisfies Result);
  } catch (error) {
    parentPort!.postMessage({
      task,
      status: "error",
      elapsedMs: performance.now() - started,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    } satisfies Result);
  }
}

/** Re-run generation at a node the filter just pruned, with the widths the
 *  SEARCH uses, on a cache-cleared copy so the real node keeps exactly the
 *  empty pool the verdict was read from; refund every frame. */
function auditVerdict(
  node: SearchNode,
  gaps: Parameters<typeof getCandidatesSorted>[1],
  ctx: Parameters<typeof getCandidatesSorted>[2],
  seed: number,
  truth: NonNullable<Result["truth"]>,
): void {
  const saved = getSimFrames();
  const scratch: SearchNode = { ...node, _candidatesCache: null, _childrenCache: undefined };
  let aliveAt: number | null = null;
  let reproducedEmpty = true;
  try {
    for (const width of TRUTH_LADDER) {
      const candidates = getCandidatesSorted(scratch, gaps, ctx, seed, width);
      if (width === 1 && candidates.length > 0) reproducedEmpty = false;
      if (candidates.length > 0) {
        aliveAt = width;
        break;
      }
    }
  } finally {
    truth.framesCharged += Math.max(0, getSimFrames() - saved);
    refundSimFramesTo(saved);
    truth.sampled += 1;
    if (!reproducedEmpty) truth.reproduceFailures += 1;
    if (aliveAt === null) truth.verifiedTrue += 1;
    const key = aliveAt === null ? "none" : String(aliveAt);
    truth.aliveAtHistogram[key] = (truth.aliveAtHistogram[key] ?? 0) + 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
  const sources = resolveSources(loadSourceManifest(manifestPath));
  const sourceIds = (argument("sources") ?? sources.slice(0, 6).map((s) => s.id).join(","))
    .split(",").filter(Boolean);
  for (const id of sourceIds) {
    if (!sources.some((s) => s.id === id)) throw new Error(`unknown source "${id}"`);
  }
  const seeds = (argument("seeds") ?? "0,1,2").split(",").map(Number);
  const budgets = (argument("budgets") ?? "250000,750000").split(",").map(Number);
  const jobs = Number(argument("jobs") ?? "6");
  const truthRate = Number(argument("truth-rate") ?? "1");
  const truthMax = Number(argument("truth-max") ?? "400");
  const joltMs = Number(argument("jolt") ?? "-15");
  const outPath = resolve(argument("out") ?? "generated/studies/continuation-filter.json");
  for (const [label, value] of [["jobs", jobs], ["truth-max", truthMax]] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${label} must be a positive integer`);
  }

  const tasks: Task[] = budgets.flatMap((budget) =>
    seeds.flatMap((seed) =>
      sourceIds.map((sourceId) => ({
        sourceId,
        role: sources.find((s) => s.id === sourceId)!.role,
        seed,
        budget,
        joltMs,
        manifestPath,
        truthRate,
        truthMax,
      }))
    )
  );

  console.error(
    `continuation-filter: ${tasks.length} compiles ` +
      `(${sourceIds.length} sources x ${seeds.length} seeds x ${budgets.length} budgets), ` +
      `jobs=${jobs}, truth-rate=${truthRate}`,
  );

  const results: Result[] = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= tasks.length) return;
        const task = tasks[index];
        const result = await runTask(task);
        results.push(result);
        done += 1;
        console.error(
          `  [${done}/${tasks.length}] ${task.sourceId}/s${task.seed}/${task.budget} ` +
            `${result.status} ${(result.elapsedMs / 1000).toFixed(1)}s` +
            (result.filter
              ? ` fire=${result.filter.firings}/${result.filter.preBuilds} pruned=${result.filter.prunedOptions}`
              : "") +
            (result.truth && result.truth.sampled > 0
              ? ` true=${result.truth.verifiedTrue}/${result.truth.sampled}`
              : ""),
        );
      }
    }),
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        schema: "line.study.continuation-filter.v1",
        generatedAt: new Date().toISOString(),
        grid: { sourceIds, seeds, budgets, truthRate, truthMax, joltMs, manifestPath },
        results,
      },
      null,
      1,
    ),
  );
  console.error(`wrote ${outPath}`);
}

function runTask(task: Task): Promise<Result> {
  return new Promise((done) => {
    const started = performance.now();
    const worker = new Worker(new URL(import.meta.url), { workerData: task, argv: [] });
    let settled = false;
    const finish = (result: Result): void => {
      if (settled) return;
      settled = true;
      void worker.terminate().then(() => done(result), () => done(result));
    };
    worker.once("message", (result: Result) => finish(result));
    worker.once("error", (error: Error) =>
      finish({
        task,
        status: "error",
        elapsedMs: performance.now() - started,
        error: error.stack ?? error.message,
      })
    );
  });
}
