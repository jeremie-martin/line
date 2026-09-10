/**
 * Rollout economics — where the compiler's largest spend category goes, what it
 * buys, and whether its dead-end verdicts are true.
 *
 * Observation-only. The compiler edits this study relies on are three null-checked
 * hooks in `optimizer/legacy_handoff.ts` (`setHandoffRolloutProbeHook`,
 * `setHandoffExpansionProbeHook`, plus the existing ranked-options hook); with no
 * hook installed the compiler does one comparison per rollout and nothing else.
 * `--verify-identity` proves that on a real cell (score, trackHash, sim-frames).
 *
 * Four measurements, all from one instrumented compile:
 *
 *   SPEND      every charged rollout classified by outcome (no_hop / dead_hop1 /
 *              dead_hop1_refuted / dead_hop2 / end_hop2 / full / branched) and by
 *              context (pool rank, gap band, pre/post first completion, configured
 *              depth), with the frames each class charges split by hop.
 *   VERDICT    per pool: does the rollout's winner differ from the free pre-sort's
 *              #1, and when it does, was the disagreement DECIDED by a dead-end
 *              verdict or by a value difference between two live rides?
 *   TRUTH      at a deterministic sample of hop-1 dead-end verdicts, re-run
 *              generation at the same child with the SEARCH's breadth (a ladder up
 *              to the rescue tiers' width) and record whether anything lives there.
 *              Charged then refunded, on a cache-isolated copy of the node, so the
 *              compile it rides in is unchanged (`--verify-identity --truth-rate=1`).
 *   CONFUSION  the realized ruler: nodes a rollout judged, joined by node identity
 *              to the pool the search actually built when it arrived there.
 *
 * POST-L1 OUTCOME SEMANTICS (redraw-on-empty, shipped bb45125)
 *   The compiler now re-draws the first hop at width+1 when it comes back empty,
 *   so the single pre-L1 `dead_hop1` population splits in three and the study
 *   reports all three:
 *     trigger   = the first hop was empty at the shape's own width
 *               = `dead_hop1 + dead_hop1_refuted` (record field `hop1Redrawn`)
 *     refuted   = the extra draw found candidates; the verdict was overturned at
 *                 the source and the rollout carried on → `dead_hop1_refuted`
 *                 (sticky: it outranks whatever the deeper hops then did)
 *     residual  = the extra draw found nothing either; the SURVIVING verdict,
 *                 and the only thing `fwd_rollout_no_candidate` still counts
 *               → `dead_hop1`, the class the TRUTH check samples
 *   So `docs/rollout-economics-study.md` §1.2's pre-L1 `dead_hop1` column is
 *   comparable to `dead_hop1 + dead_hop1_refuted` here, and §4.2's verified-true
 *   rate is now measured on the residual population only (a strictly harder
 *   population: L1 has already removed the cheapest refutations).
 *   Branched shapes carry no hop trace and stay `branched`; their trigger and
 *   refutation counts are still exact, via `hop1Redrawn`/`hop1Refuted`.
 *
 * Usage:
 *   node --import tsx scripts/v0/study_rollout_economics.ts \
 *     --sources=a,b,c --seeds=0,1,2,3 --budgets=150000,750000 --jobs=6 \
 *     --truth-rate=0.02 --out=<path>.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../produce/seed.ts";
import {
  compileLegacyHandoff,
  setHandoffExpansionProbeHook,
  setHandoffRankedOptionsProbeHook,
  setHandoffRolloutProbeHook,
  type HandoffExpansionProbeRecord,
  type HandoffRankedOptionsProbeRecord,
  type HandoffRolloutOutcome,
  type HandoffRolloutProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import {
  getCandidatesSorted,
  setRolloutAimSuppressed,
  setRolloutContext,
  type SearchNode,
} from "./optimizer/node.ts";
import { getSimFrames, refundSimFramesTo } from "./optimizer/sim_frames.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";

/** Canonical outcome order, emitted with the grid so every downstream table
 *  prints the classes in the same sequence as the study's own §1.2. */
const OUTCOMES: HandoffRolloutOutcome[] = [
  "no_hop",
  "dead_hop1",
  "dead_hop1_refuted",
  "dead_hop2",
  "end_hop2",
  "full",
  "branched",
];

/** Generation breadth ladder for the truth check: the rollout's own width (1),
 *  the pool widths the search uses at ordinary budgets, and the two rescue tiers
 *  (`HANDOFF_RESCUE_BASE_N_CAND` 32, `HANDOFF_SHORT_RESCUE_N_CAND` 80). */
const TRUTH_LADDER = [1, 2, 3, 5, 8, 12, 16, 24, 32, 48, 64, 80];

type Task = {
  sourceId: string;
  seed: number;
  budget: number;
  joltMs: number;
  manifestPath: string;
  truthRate: number;
  truthMax: number;
  /** false = suppress the aim lane inside the truth probe, isolating pure sampling breadth. */
  truthAim: boolean;
  identity: boolean;
};

type Bucket = { n: number; frames: number; hop1: number; hop2: number; leaf: number };

type TruthSample = {
  rank: number;
  gapBand: number;
  gapIndex: number;
  hasCompletion: boolean;
  outcome: HandoffRolloutOutcome;
  /** Smallest ladder width at which generation found a viable catch; null = none by 80. */
  aliveAt: number | null;
  /** Candidates found at that width. */
  found: number;
  /** Frames the probe charged (refunded immediately). */
  frames: number;
  /** Sanity: the rollout's own width reproduced empty. */
  reproducedEmpty: boolean;
};

type Result = {
  task: Task;
  status: "ok" | "error";
  elapsedMs: number;
  error?: string;
  score?: {
    contactsAuthored: number;
    contactsHit: number;
    contactsMissing: number;
    terminusReason: string;
    fullScore: number;
    trackHash: string;
  };
  stats?: {
    simFrames: number;
    firstCompletionFrame: number | null;
    fwdEvalFramesCharged: number;
    fwdEvalCalls: number;
    startEvalFramesCharged: number;
    fwdRolloutNoCandidate: number;
    /** The compiler's own L1 counters — the free thermometer (M3/M4). The hook's
     *  `redraw.triggers`/`redraw.refuted` must agree with these; the study prints
     *  the mismatch if they ever don't. */
    fwdRolloutRedraws: number;
    fwdRolloutRedrawRefuted: number;
    nodesExpanded: number;
    policyNCandMean: number | null;
  };
  rollouts?: {
    total: number;
    frames: number;
    byOutcome: Record<string, Bucket>;
    byOutcomeRank: Record<string, Bucket>;
    byOutcomeGapBand: Record<string, Bucket>;
    byOutcomePhase: Record<string, Bucket>;
    byOutcomeDepth: Record<string, Bucket>;
    frameHistogram: Record<string, number[]>;
    /** Residual (post-redraw) dead_hop1 rate per pool rank band, plus the refuted
     *  column; the pre-L1-comparable trigger count is `dead1 + refuted`. */
    rankRate: Record<string, { rollouts: number; dead1: number; refuted: number }>;
    /** Per gap decile: [rollouts, residual dead_hop1, refuted]. */
    gapRate: number[][];
    /** Calls and frames by the rollout SHAPE the adaptive config resolved to. */
    byShape: Record<string, Bucket>;
    byShapeOutcome: Record<string, Bucket>;
    /** THE POST-L1 SPLIT (see the header). `triggers` counts every rollout whose
     *  first hop was empty at its own width — including branched shapes, whose
     *  outcome class cannot name it. */
    redraw: {
      triggers: number;
      refuted: number;
      residual: number;
      /** triggers/refuted split by shape and by pre/post first completion. */
      byShape: Record<string, [number, number]>;
      byPhase: Record<string, [number, number]>;
    };
  };
  pools?: {
    n: number;
    scoredByRollout: number;
    agree: number;
    disagree: number;
    disagreeDeadDecided: number;
    disagreeBothDead: number;
    disagreeLiveValue: number;
    valueGapSum: number;
    valueGapSumDeadDecided: number;
    valueGapSumLiveValue: number;
    poolsWithAnyDead: number;
    poolsAllDead: number;
    noDeadPools: number;
    noDeadAgree: number;
    selectedSetChanged: number;
    orderOnlyChanged: number;
    winnerQualityRank: number[];
  };
  truth?: {
    deadHop1Seen: number;
    sampled: number;
    verifiedTrue: number;
    aliveAtHistogram: Record<string, number>;
    byRank: Record<string, { sampled: number; verifiedTrue: number }>;
    byGapBand: Record<string, { sampled: number; verifiedTrue: number }>;
    byPhase: Record<string, { sampled: number; verifiedTrue: number }>;
    framesCharged: number;
    reproduceFailures: number;
    samples: TruthSample[];
  };
  confusion?: {
    deadVerdictSearchAlive: number;
    deadVerdictSearchDead: number;
    aliveVerdictSearchAlive: number;
    aliveVerdictSearchDead: number;
    judgedNodesExpanded: number;
  };
};

if (isMainThread) await main();
else await workerMain(workerData as Task);

// ─────────────────────────────────────────────────────────────────────────────

function emptyBucket(): Bucket {
  return { n: 0, frames: 0, hop1: 0, hop2: 0, leaf: 0 };
}

function bump(map: Record<string, Bucket>, key: string, record: HandoffRolloutProbeRecord): void {
  const bucket = map[key] ??= emptyBucket();
  const hop1 = record.hopFrames[0] ?? 0;
  const hop2 = record.hopFrames[1] ?? 0;
  bucket.n += 1;
  bucket.frames += record.frames;
  bucket.hop1 += hop1;
  bucket.hop2 += hop2;
  bucket.leaf += Math.max(0, record.frames - hop1 - hop2);
}

/** The rollout SHAPE the adaptive config resolved to. `greedy:2:1` keeps its
 *  pre-L1 spelling; the first-widened arm (`impactBestForwardEvalConfig`, same
 *  variant/depth/branch) is separated as `greedy:2:1+fb3`. */
function shapeKey(record: HandoffRolloutProbeRecord): string {
  if (record.source === "start") return "start";
  const base = `${record.variant}:${record.depth}:${record.branch}`;
  return record.firstBranch > 1 ? `${base}+fb${record.firstBranch}` : base;
}

function logBucket(frames: number): number {
  if (frames <= 0) return 0;
  return Math.min(15, 1 + Math.floor(Math.log2(frames)));
}

/** Deterministic uniform in [0,1) from four integers — the sampler must not depend
 *  on wall-clock or iteration order across shards. */
function unitHash(a: number, b: number, c: number, d: number): number {
  let h = 0x811c9dc5;
  for (const value of [a, b, c, d]) {
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

    const byOutcome: Record<string, Bucket> = {};
    const byOutcomeRank: Record<string, Bucket> = {};
    const byOutcomeGapBand: Record<string, Bucket> = {};
    const byOutcomePhase: Record<string, Bucket> = {};
    const byOutcomeDepth: Record<string, Bucket> = {};
    const frameHistogram: Record<string, number[]> = {};
    const byShape: Record<string, Bucket> = {};
    const byShapeOutcome: Record<string, Bucket> = {};
    const rankRate: Record<string, { rollouts: number; dead1: number; refuted: number }> = {};
    const gapRate: number[][] = Array.from({ length: 10 }, () => [0, 0, 0]);
    const redraw = {
      triggers: 0,
      refuted: 0,
      residual: 0,
      byShape: {} as Record<string, [number, number]>,
      byPhase: {} as Record<string, [number, number]>,
    };
    let rolloutTotal = 0;
    let rolloutFrames = 0;

    // Pool-level verdict accounting.
    const pending: HandoffRolloutProbeRecord[] = [];
    const pools = {
      n: 0,
      scoredByRollout: 0,
      agree: 0,
      disagree: 0,
      disagreeDeadDecided: 0,
      disagreeBothDead: 0,
      disagreeLiveValue: 0,
      valueGapSum: 0,
      valueGapSumDeadDecided: 0,
      valueGapSumLiveValue: 0,
      poolsWithAnyDead: 0,
      poolsAllDead: 0,
      noDeadPools: 0,
      noDeadAgree: 0,
      selectedSetChanged: 0,
      orderOnlyChanged: 0,
      winnerQualityRank: [0, 0, 0, 0, 0, 0, 0, 0],
    };

    // Truth check.
    const truth = {
      deadHop1Seen: 0,
      sampled: 0,
      verifiedTrue: 0,
      aliveAtHistogram: {} as Record<string, number>,
      byRank: {} as Record<string, { sampled: number; verifiedTrue: number }>,
      byGapBand: {} as Record<string, { sampled: number; verifiedTrue: number }>,
      byPhase: {} as Record<string, { sampled: number; verifiedTrue: number }>,
      framesCharged: 0,
      reproduceFailures: 0,
      samples: [] as TruthSample[],
    };

    // Confusion matrix against the realized search.
    const verdicts = new WeakMap<SearchNode, boolean>(); // true = rollout said ALIVE
    const confusion = {
      deadVerdictSearchAlive: 0,
      deadVerdictSearchDead: 0,
      aliveVerdictSearchAlive: 0,
      aliveVerdictSearchDead: 0,
      judgedNodesExpanded: 0,
    };
    let policyNCandSum = 0;
    let policyNCandCount = 0;

    const rankKey = (record: HandoffRolloutProbeRecord): string =>
      record.source === "pool"
        ? `p${Math.min(record.rank, 5)}`
        : record.source;

    const gapBandOf = (record: HandoffRolloutProbeRecord): number => {
      const total = record.gaps?.length ?? 0;
      if (total <= 0 || record.gapIndex < 0) return -1;
      return Math.min(9, Math.floor((record.gapIndex / total) * 10));
    };

    if (!task.identity) {
      setHandoffRolloutProbeHook((record) => {
        rolloutTotal += 1;
        rolloutFrames += record.frames;
        const outcome = record.outcome;
        bump(byOutcome, outcome, record);
        bump(byOutcomeRank, `${outcome}|${rankKey(record)}`, record);
        const band = gapBandOf(record);
        bump(byOutcomeGapBand, `${outcome}|${band}`, record);
        bump(byOutcomePhase, `${outcome}|${record.hasCompletion ? "post" : "pre"}`, record);
        bump(byOutcomeDepth, `${outcome}|d${record.depth}`, record);
        const hist = frameHistogram[outcome] ??= new Array(16).fill(0);
        hist[logBucket(record.frames)] += 1;
        // `+fbN` only when the first-widened arm is live, so the default key stays
        // `greedy:2:1` and remains comparable with §1.2 while the impact-widening
        // arm (same variant/depth/branch) gets its own row.
        const shape = shapeKey(record);
        bump(byShape, shape, record);
        bump(byShapeOutcome, `${shape}|${outcome}`, record);

        // THE POST-L1 SPLIT. Counted from the record's own trigger/refuted bits,
        // not from the outcome class, so branched shapes are included too.
        if (record.hop1Redrawn) {
          redraw.triggers += 1;
          if (record.hop1Refuted) redraw.refuted += 1;
          else redraw.residual += 1;
          const phase = record.hasCompletion ? "post" : "pre";
          const shapeCell = redraw.byShape[shape] ??= [0, 0];
          const phaseCell = redraw.byPhase[phase] ??= [0, 0];
          shapeCell[0] += 1;
          phaseCell[0] += 1;
          if (record.hop1Refuted) {
            shapeCell[1] += 1;
            phaseCell[1] += 1;
          }
        }

        if (record.source === "pool" || record.source === "reuse" || record.source === "brake") {
          const key = rankKey(record);
          const rate = rankRate[key] ??= { rollouts: 0, dead1: 0, refuted: 0 };
          rate.rollouts += 1;
          if (outcome === "dead_hop1") rate.dead1 += 1;
          if (outcome === "dead_hop1_refuted") rate.refuted += 1;
          if (band >= 0) {
            gapRate[band][0] += 1;
            if (outcome === "dead_hop1") gapRate[band][1] += 1;
            if (outcome === "dead_hop1_refuted") gapRate[band][2] += 1;
          }
        }

        if (record.gapIndex >= 0) pending.push(record);

        // Realized-search join: remember what this rollout decided about the node
        // it advanced to. `extendNodeCached` memoizes, so this IS the node object
        // the search expands later if the frontier arrives there.
        if (record.deadNode !== null) verdicts.set(record.deadNode, false);
        else if (record.hop1Node !== null) verdicts.set(record.hop1Node, true);

        // TRUTH is measured on the SURVIVING verdict only: a refuted rollout has
        // no dead node (L1 already found the catch), so `dead_hop1` here is the
        // residual population by construction.
        if (outcome !== "dead_hop1" || record.deadNode === null) return;
        truth.deadHop1Seen += 1;
        if (task.truthRate <= 0 || truth.sampled >= task.truthMax) return;
        const draw = unitHash(task.seed, record.gapIndex, record.rank, truth.deadHop1Seen);
        if (draw >= task.truthRate) return;
        runTruthCheck(record, truth, gapBandOf(record), task.truthAim);
      });

      setHandoffExpansionProbeHook((record: HandoffExpansionProbeRecord) => {
        policyNCandSum += record.nCand;
        policyNCandCount += 1;
        const verdict = verdicts.get(record.node);
        if (verdict === undefined) return;
        confusion.judgedNodesExpanded += 1;
        const alive = record.poolCandidates > 0;
        if (verdict) {
          if (alive) confusion.aliveVerdictSearchAlive += 1;
          else confusion.aliveVerdictSearchDead += 1;
        } else if (alive) confusion.deadVerdictSearchAlive += 1;
        else confusion.deadVerdictSearchDead += 1;
      });

      setHandoffRankedOptionsProbeHook((record: HandoffRankedOptionsProbeRecord) => {
        const batch = pending.splice(0, pending.length);
        summarizePool(record, batch, pools);
      });
    }

    let compiled:ReturnType<typeof compileLegacyHandoff>;
    try {
      compiled = compileLegacyHandoff(spec, task.seed, { budget: task.budget });
    } finally {
      setHandoffRolloutProbeHook(null);
      setHandoffExpansionProbeHook(null);
      setHandoffRankedOptionsProbeHook(null);
    }
    const { track, report, stats } = compiled;
    if (!task.identity && ((stats.search_nodes_expanded ?? 0) > 0 && policyNCandCount === 0 ||
        (stats.fwd_eval?.fwd_eval_calls ?? 0) > 0 && rolloutTotal === 0))
      throw new Error('legacy compilation performed work without the required hook observations');

    const trackHash = createHash("sha256").update(JSON.stringify(track)).digest("hex");
    const contacts = report.contacts ?? [];
    const anyStats = stats as unknown as Record<string, unknown>;
    const fwd = (anyStats.fwd_eval ?? {}) as Record<string, number>;
    const result: Result = {
      task,
      status: "ok",
      elapsedMs: performance.now() - started,
      score: {
        contactsAuthored: contacts.length,
        contactsHit: contacts.filter((c) => c.status === "hit").length,
        contactsMissing: contacts.filter((c) => c.status === "missing").length,
        terminusReason: String((report as unknown as { terminus?: { reason?: string } }).terminus?.reason ?? ""),
        fullScore: Number((report as unknown as { full_score?: number }).full_score ?? 0),
        trackHash,
      },
      stats: {
        simFrames: Number(anyStats.sim_frames ?? 0),
        firstCompletionFrame: anyStats.first_completion_frame === undefined
          ? null
          : Number(anyStats.first_completion_frame),
        fwdEvalFramesCharged: fwd.fwd_eval_frames_charged ?? 0,
        fwdEvalCalls: fwd.fwd_eval_calls ?? 0,
        startEvalFramesCharged: fwd.start_eval_frames_charged ?? 0,
        fwdRolloutNoCandidate: fwd.fwd_rollout_no_candidate ?? 0,
        fwdRolloutRedraws: fwd.fwd_rollout_redraws ?? 0,
        fwdRolloutRedrawRefuted: fwd.fwd_rollout_redraw_refuted ?? 0,
        nodesExpanded: Number(anyStats.search_nodes_expanded ?? 0),
        policyNCandMean: policyNCandCount === 0 ? null : policyNCandSum / policyNCandCount,
      },
    };
    if (!task.identity) {
      result.rollouts = {
        total: rolloutTotal,
        frames: rolloutFrames,
        byOutcome,
        byOutcomeRank,
        byOutcomeGapBand,
        byOutcomePhase,
        byOutcomeDepth,
        frameHistogram,
        rankRate,
        gapRate,
        byShape,
        byShapeOutcome,
        redraw,
      };
      result.pools = pools;
      result.truth = truth;
      result.confusion = confusion;
    }
    parentPort!.postMessage(result);
  } catch (error) {
    parentPort!.postMessage({
      task,
      status: "error",
      elapsedMs: performance.now() - started,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    } satisfies Result);
  }
}

/** The truth check. Re-run generation at the child the rollout declared dead, with
 *  the widths the SEARCH uses, on a cache-isolated copy of the node, and refund
 *  every frame so the compile it rides in is unperturbed. */
function runTruthCheck(
  record: HandoffRolloutProbeRecord,
  truth: Result["truth"] & object,
  gapBand: number,
  withAimLane: boolean,
): void {
  const dead = record.deadNode;
  const gaps = record.gaps;
  const ctx = record.ctx;
  if (dead === null || gaps === null || ctx === null) return;
  const saved = getSimFrames();
  // A shallow copy with the caches cleared: the deep build lands on the COPY, so
  // the real node keeps exactly the 1-wide empty pool the rollout gave it.
  const scratch: SearchNode = { ...dead, _candidatesCache: null, _childrenCache: undefined };
  let aliveAt: number | null = null;
  let found = 0;
  let reproducedEmpty = true;
  // node.ts gates the suppression on `inRolloutContext && rolloutAimSuppressed`,
  // and the rollout context is already restored by the time this hook fires — so
  // both flags have to be set to isolate pure sampling breadth from the aim lane's
  // proposals. With the lane ON the probe is search-grade (the search runs it too).
  if (!withAimLane) {
    setRolloutContext(true);
    setRolloutAimSuppressed(true);
  }
  try {
    for (const width of TRUTH_LADDER) {
      const candidates = getCandidatesSorted(scratch, gaps, ctx, record.seed, width);
      if (width === 1 && candidates.length > 0) reproducedEmpty = false;
      if (candidates.length > 0) {
        aliveAt = width;
        found = candidates.length;
        break;
      }
    }
  } finally {
    if (!withAimLane) {
      setRolloutAimSuppressed(false);
      setRolloutContext(false);
    }
    const spent = Math.max(0, getSimFrames() - saved);
    truth.framesCharged += spent;
    refundSimFramesTo(saved);
    truth.sampled += 1;
    if (!reproducedEmpty) truth.reproduceFailures += 1;
    const verified = aliveAt === null;
    if (verified) truth.verifiedTrue += 1;
    const key = aliveAt === null ? "none" : String(aliveAt);
    truth.aliveAtHistogram[key] = (truth.aliveAtHistogram[key] ?? 0) + 1;
    const rankKey = record.source === "pool" ? `p${Math.min(record.rank, 5)}` : record.source;
    for (
      const [map, mapKey] of [
        [truth.byRank, rankKey],
        [truth.byGapBand, String(gapBand)],
        [truth.byPhase, record.hasCompletion ? "post" : "pre"],
      ] as const
    ) {
      const cell = map[mapKey] ??= { sampled: 0, verifiedTrue: 0 };
      cell.sampled += 1;
      if (verified) cell.verifiedTrue += 1;
    }
    if (truth.samples.length < 400) {
      truth.samples.push({
        rank: record.rank,
        gapBand,
        gapIndex: record.gapIndex,
        hasCompletion: record.hasCompletion,
        outcome: record.outcome,
        aliveAt,
        found,
        frames: spent,
        reproducedEmpty,
      });
    }
  }
}

/** One pool's verdict accounting: the rollout order against the free pre-sort order. */
function summarizePool(
  record: HandoffRankedOptionsProbeRecord,
  batch: HandoffRolloutProbeRecord[],
  pools: NonNullable<Result["pools"]>,
): void {
  const poolEntries = record.eligible.filter((entry) =>
    entry.source === "pool" && Number.isFinite(entry.score)
  );
  if (poolEntries.length < 2) return;
  // Rollout records for this pool, keyed by (source, rank).
  const outcomes = new Map<string, HandoffRolloutOutcome>();
  for (const roll of batch) outcomes.set(`${roll.source}|${roll.rank}`, roll.outcome);
  if (outcomes.size === 0) return;
  pools.n += 1;
  pools.scoredByRollout += poolEntries.length;

  let winner = poolEntries[0];
  let qualityTop1 = poolEntries[0];
  for (const entry of poolEntries) {
    if (entry.score < winner.score) winner = entry;
    if (entry.rank < qualityTop1.rank) qualityTop1 = entry;
  }
  const outcomeOf = (entry: typeof winner): HandoffRolloutOutcome | undefined =>
    outcomes.get(`${entry.source}|${entry.rank}`);
  const deadCount = poolEntries.filter((entry) => outcomeOf(entry) === "dead_hop1").length;
  if (deadCount > 0) pools.poolsWithAnyDead += 1;
  if (deadCount === poolEntries.length) pools.poolsAllDead += 1;

  const agree = winner === qualityTop1;
  if (agree) pools.agree += 1;
  else {
    pools.disagree += 1;
    const gap = qualityTop1.score - winner.score; // value(winner) - value(quality #1)
    pools.valueGapSum += gap;
    const winnerDead = outcomeOf(winner) === "dead_hop1";
    const q1Dead = outcomeOf(qualityTop1) === "dead_hop1";
    if (q1Dead && winnerDead) pools.disagreeBothDead += 1;
    if (q1Dead && !winnerDead) {
      pools.disagreeDeadDecided += 1;
      pools.valueGapSumDeadDecided += gap;
    } else {
      pools.disagreeLiveValue += 1;
      pools.valueGapSumLiveValue += gap;
    }
  }
  if (deadCount === 0) {
    pools.noDeadPools += 1;
    if (agree) pools.noDeadAgree += 1;
  }
  pools.winnerQualityRank[Math.min(winner.rank, 7)] += 1;

  // Does the rollout order change the CHILDREN, or only their order? Compare the
  // production selection to what the free pre-sort would have selected.
  const branching = Math.min(3, poolEntries.length);
  const byScore = [...poolEntries].sort((a, b) => a.score - b.score || a.rank - b.rank)
    .slice(0, branching);
  const byRank = [...poolEntries].sort((a, b) => a.rank - b.rank).slice(0, branching);
  const scoreSet = new Set(byScore.map((entry) => entry.rank));
  const rankSet = new Set(byRank.map((entry) => entry.rank));
  const sameSet = scoreSet.size === rankSet.size &&
    [...scoreSet].every((rank) => rankSet.has(rank));
  if (!sameSet) pools.selectedSetChanged += 1;
  else if (byScore.some((entry, index) => entry.rank !== byRank[index].rank)) {
    pools.orderOnlyChanged += 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
  const sources = resolveSources(loadSourceManifest(manifestPath));
  const sourceIds = (argument("sources") ?? sources.slice(0, 10).map((s) => s.id).join(","))
    .split(",").filter(Boolean);
  for (const id of sourceIds) {
    if (!sources.some((s) => s.id === id)) throw new Error(`unknown source "${id}"`);
  }
  const seeds = (argument("seeds") ?? "0,1,2,3").split(",").map(Number);
  const budgets = (argument("budgets") ?? "150000,750000").split(",").map(Number);
  const jobs = Number(argument("jobs") ?? "6");
  const truthRate = Number(argument("truth-rate") ?? "0");
  const truthMax = Number(argument("truth-max") ?? "400");
  const joltMs = Number(argument("jolt") ?? "-15");
  const truthAim = argument("truth-aim") !== "off";
  const identity = hasFlag("verify-identity");
  const outPath = resolve(argument("out") ?? "generated/studies/rollout-economics.json");

  const tasks: Task[] = budgets.flatMap((budget) =>
    seeds.flatMap((seed) =>
      sourceIds.map((sourceId) => ({
        sourceId,
        seed,
        budget,
        joltMs,
        manifestPath,
        truthRate,
        truthMax,
        truthAim,
        identity: false,
      }))
    )
  );
  const allTasks = identity
    ? tasks.flatMap((task) => [task, { ...task, identity: true }])
    : tasks;

  console.error(
    `rollout-economics: ${allTasks.length} compiles ` +
      `(${sourceIds.length} sources x ${seeds.length} seeds x ${budgets.length} budgets` +
      `${identity ? " x2 identity arms" : ""}), jobs=${jobs}, truth-rate=${truthRate}`,
  );

  const results: Result[] = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(jobs, allTasks.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= allTasks.length) return;
        const task = allTasks[index];
        const result = await runTask(task);
        results.push(result);
        done += 1;
        console.error(
          `  [${done}/${allTasks.length}] ${task.sourceId}/s${task.seed}/${task.budget}` +
            `${task.identity ? " (bare)" : ""} ${result.status} ` +
            `${(result.elapsedMs / 1000).toFixed(1)}s` +
            (result.rollouts ? ` rollouts=${result.rollouts.total}` : "") +
            (result.rollouts
              ? ` redraw=${result.rollouts.redraw.refuted}/${result.rollouts.redraw.triggers}`
              : "") +
            (result.truth && result.truth.sampled > 0
              ? ` truth=${result.truth.verifiedTrue}/${result.truth.sampled}`
              : ""),
        );
        // Cross-check: the hook's trigger count must equal the compiler's own
        // `fwd_rollout_redraws`. A mismatch means a re-draw site the hook cannot
        // see — say so loudly rather than quietly under-reporting M3's numerator.
        if (
          result.rollouts !== undefined && result.stats !== undefined &&
          (result.rollouts.redraw.triggers !== result.stats.fwdRolloutRedraws ||
            result.rollouts.redraw.refuted !== result.stats.fwdRolloutRedrawRefuted)
        ) {
          console.error(
            `    REDRAW COUNTER MISMATCH ${task.sourceId}/s${task.seed}/${task.budget}: ` +
              `hook ${result.rollouts.redraw.refuted}/${result.rollouts.redraw.triggers} vs ` +
              `compiler ${result.stats.fwdRolloutRedrawRefuted}/${result.stats.fwdRolloutRedraws}`,
          );
        }
      }
    }),
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        schema: "line.study.rollout-economics.v1",
        generatedAt: new Date().toISOString(),
        grid: {
          sourceIds,
          seeds,
          budgets,
          truthRate,
          truthMax,
          truthAim,
          joltMs,
          identity,
          outcomeOrder: OUTCOMES,
        },
        results,
      },
      null,
      1,
    ),
  );
  console.error(`wrote ${outPath}`);

  if (identity) reportIdentity(results);
}

function reportIdentity(results: Result[]): void {
  const key = (r: Result): string => `${r.task.sourceId}|${r.task.seed}|${r.task.budget}`;
  const bare = new Map<string, Result>();
  const instrumented = new Map<string, Result>();
  for (const r of results) (r.task.identity ? bare : instrumented).set(key(r), r);
  let same = 0;
  let differ = 0;
  for (const [cell, a] of instrumented) {
    const b = bare.get(cell);
    if (b === undefined || a.score === undefined || b.score === undefined) continue;
    const identical = a.score.trackHash === b.score.trackHash &&
      a.stats!.simFrames === b.stats!.simFrames &&
      a.score.fullScore === b.score.fullScore;
    if (identical) same += 1;
    else {
      differ += 1;
      console.error(
        `  IDENTITY MISMATCH ${cell}: hash ${a.score.trackHash.slice(0, 12)} vs ` +
          `${b.score.trackHash.slice(0, 12)}, frames ${a.stats!.simFrames} vs ${b.stats!.simFrames}`,
      );
    }
  }
  console.error(`identity: ${same} identical, ${differ} different (of ${same + differ} cells)`);
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
