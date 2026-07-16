/**
 * Expansion-order regret study (study-only, OUTSIDE the compiler identity
 * boundary — it installs the observation-only hooks that production never
 * installs and never modifies compiler files).
 *
 * The campaign's open "structural judge" question: at each contact-gap node the
 * handoff DFS ranks pool candidates by a charged greedy rollout (forward-eval;
 * `scoreCandidateForHandoff`), then expands the top HANDOFF_BRANCHING branches.
 * How often is that rollout's branch ORDER wrong about the branches' realized
 * outcomes, and how much score does the disagreement cost?
 *
 * THE MEASUREMENT (zero compiler changes; three read-only hooks):
 *  - `opts.onNode`  -> identify the winning node (the last node the register
 *    accepted as a completed best). Its `rankTrace` is the FINAL COMMITTED PATH:
 *    per gap, the (source, poolRank) of the committed candidate.
 *  - `setHandoffFrontierNodeProbeHook` -> the node currently being popped/expanded
 *    (its startRank + rankTrace + gapIndex), so each ranked-options record can be
 *    keyed to the exact prefix that produced it.
 *  - `setHandoffRankedOptionsProbeHook` -> per expansion, the `eligible`/`selected`
 *    options in PRODUCTION RANK ORDER (forward-eval-sorted: index 0 = the rollout's
 *    top choice) with their forward-eval `score` (score = -value, lower is better).
 *
 * For each committed contact gap on the winning path we recover the committed
 * candidate's FORWARD-EVAL POSITION within the expanded branches (0 = rollout's
 * #1). Because the DFS only expands HANDOFF_BRANCHING branches, that position is
 * structurally in {0,1,2}: position 0 means the search kept the rollout's top
 * pick; position >0 means it backtracked away from the rollout's #1 and committed
 * a branch the rollout ranked worse. The distribution of committed positions IS
 * the realized expansion-order disagreement; the forward-value gap (committed
 * minus rank-0) sizes how confident-and-wrong the rollout was; the off-path frame
 * share (approximate, delta-attributed) sizes the exploration the misordering paid.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_expansion_regret.ts \
 *     [--cases=NAME,...] [--seeds=N,...] [--budget=N] [--out-dir=DIR]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import denseDialogue from "../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import riverReentry from "../../benchmark/v2/cases/normative/representative/river_reentry.ts";
import frontierLowAir from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { scoreDriftReport } from "./score.ts";
import {
  compileHandoff,
  setHandoffFrontierNodeProbeHook,
  setHandoffRankedOptionsProbeHook,
  type HandoffFrontierNodeProbeRecord,
  type HandoffNode,
  type HandoffNodeEvent,
  type HandoffRankedOptionsProbeRecord,
  type HandoffRankTraceEntry,
} from "./optimizer/handoff.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { FPS, type Spec } from "./types.ts";

const catalog: Record<string, Spec> = {
  believer_56_6s: believer,
  dense_dialogue: denseDialogue,
  river_reentry: riverReentry,
  frontier_low_air_endurance: frontierLowAir,
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const names = (arg("cases") ?? Object.keys(catalog).join(",")).split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "24,25").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const outDir = arg("out-dir") ?? "generated/studies/expansion-regret/v1";
for (const seed of seeds) if (!Number.isSafeInteger(seed)) throw new Error(`bad seed ${seed}`);
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`bad budget ${budget}`);

const SCHEMA = "line.study-expansion-regret.v1";

// ── Serialize a rankTrace prefix into a stable node identity. Two distinct
//    prefixes reaching the same gapIndex have distinct traces (children of a node
//    are distinguished by their (source, rank)), so (startRank, gapIndex, trace)
//    uniquely names a search node — for both the main frontier and repair/tail
//    restarts, whose traces are suffix-relative but self-consistent on both the
//    expansion side and the winner side.
function serializeTrace(trace: readonly HandoffRankTraceEntry[]): string {
  return trace.map((e) => `${e.source}:${e.rank}:${e.sourceAxis ?? ""}`).join("|");
}
function nodeKey(startRank: number, gapIndex: number, trace: readonly HandoffRankTraceEntry[]): string {
  return `${startRank}|${gapIndex}|${serializeTrace(trace)}`;
}

type SelectedEntry = { source: string; rank: number; score: number };
type StoredRecord = { gapIndex: number; simFrames: number; eligibleCount: number; selected: SelectedEntry[] };
type FrameRecord = { key: string | null; simFrames: number };
type Winner = {
  startRank: number;
  gapIndex: number;
  fullScore: number;
  phase: string;
  rankTrace: HandoffRankTraceEntry[];
};

type CommitRow = {
  gapIndex: number;
  committedPos: number | null; // forward-eval position among expanded branches (0 = rollout's #1)
  committedPoolRank: number; // pool-quality rank stamped at generation
  source: string;
  rank0Score: number | null;
  committedScore: number | null;
  forwardValueGap: number | null; // committed - rank0 (>=0); forward-value the rollout gave up
  branchesSeen: number | null; // size of the selected (expanded) branch set at this node
  eligibleCount: number | null; // full ranked-option pool at this node
  match: "matched" | "no_record" | "not_in_selected";
  targets: Record<string, number>;
  tEnd: number | null;
};

type RunResult = {
  source: string;
  seed: number;
  valid: boolean;
  score: number;
  winnerPhase: string;
  totalSimFrames: number;
  firstCompletionFrame: number | null;
  committedContactGaps: number;
  commits: CommitRow[];
  matched: number;
  unmatchedNoRecord: number;
  unmatchedNotInSelected: number;
  posBuckets: { rank0: number; rank1to2: number; rank3plus: number };
  meanForwardValueGapNonRank0: number | null;
  offPathFrameShareUpperBound: number;
  offPathExpansionShare: number;
  expansions: { total: number; onPath: number; offPath: number; unkeyed: number };
  elapsedMs: number;
};

function round(x: number, d = 4): number {
  return Number(x.toFixed(d));
}

// Run ONE compile with the three observation hooks installed; return the winner
// and the captured records. Purely observational — hooks only read + append.
function observedCompile(spec: Spec, seed: number): {
  checkpoint: ReturnType<typeof compileHandoff>;
  winner: Winner | null;
  records: Map<string, StoredRecord>;
  frameLog: FrameRecord[];
} {
  const records = new Map<string, StoredRecord>();
  const frameLog: FrameRecord[] = [];
  let current: { startRank: number; gapIndex: number; traceKey: string } | null = null;
  let winner: Winner | null = null;

  setHandoffFrontierNodeProbeHook((rec: HandoffFrontierNodeProbeRecord) => {
    const node = rec.selected;
    current = {
      startRank: node.startRank,
      gapIndex: node.search.gapIndex,
      traceKey: serializeTrace(node.rankTrace),
    };
  });

  setHandoffRankedOptionsProbeHook((rec: HandoffRankedOptionsProbeRecord) => {
    // Pair to the currently-popped node only when the expansion is for that node's
    // OWN gap (main expansion or same-gap rescue). Tail-completion fires this hook
    // for deeper suffix gaps whose trace we do not observe -> leave unkeyed.
    const keyed = current !== null && current.gapIndex === rec.gapIndex
      ? `${current.startRank}|${rec.gapIndex}|${current.traceKey}`
      : null;
    frameLog.push({ key: keyed, simFrames: rec.simFrames });
    if (keyed === null) return;
    // Rescue then expandNode can both fire for the same node; keep the LAST (the
    // one whose selected set actually seeds the committed children).
    records.set(keyed, {
      gapIndex: rec.gapIndex,
      simFrames: rec.simFrames,
      eligibleCount: rec.eligible.length,
      selected: rec.selected.map((o) => ({ source: o.source, rank: o.rank, score: o.score })),
    });
  });

  const onNode = (node: HandoffNode, key: LeafKey, event: HandoffNodeEvent): void => {
    // `consider` calls onNode right after `register.consider`; event.improved === true
    // means this node just became the register's best. The LAST such node is exactly
    // `register.getBest()` at snapshot time, i.e. the node whose report is scored as
    // `checkpoint.report`. Capture its committed path (rankTrace).
    if (!event.improved) return;
    winner = {
      startRank: node.startRank,
      gapIndex: node.search.gapIndex,
      fullScore: key.full_score,
      phase: `${event.phase}${event.fullDuration ? "" : "/partial"}`,
      rankTrace: node.rankTrace.map((e) => ({ ...e })),
    };
  };

  const checkpoint = compileHandoff(spec, seed, { budget, onNode });

  setHandoffFrontierNodeProbeHook(null);
  setHandoffRankedOptionsProbeHook(null);
  return { checkpoint, winner, records, frameLog };
}

function analyze(source: string, seed: number): RunResult {
  const spec = applyJolt(catalog[source], benchmarkPolicy.transform.joltMs);
  const started = performance.now();
  const { checkpoint, winner, records, frameLog } = observedCompile(spec, seed);
  const elapsedMs = Math.round(performance.now() - started);
  const score = scoreDriftReport(checkpoint.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  if (winner === null) {
    throw new Error(`${source} seed=${seed}: no completed-best winner captured`);
  }

  // Per-gap targets/timing from the winning track's report (gap_index === search gapIndex).
  const gapReport = new Map(checkpoint.report.gaps.map((g) => [g.gap_index, g] as const));

  // Winning-path node keys: the node expanded to CHOOSE rankTrace[j]. Repair/tail
  // restarts reset rankTrace to [], so recover the gap offset from the terminal node.
  const offset = winner.gapIndex - winner.rankTrace.length;
  const winnerPathKeys = new Set<string>();
  for (let j = 0; j < winner.rankTrace.length; j++) {
    winnerPathKeys.add(nodeKey(winner.startRank, offset + j, winner.rankTrace.slice(0, j)));
  }

  const commits: CommitRow[] = [];
  for (let j = 0; j < winner.rankTrace.length; j++) {
    const entry = winner.rankTrace[j];
    if (entry.rank < 0) continue; // skipped / non-contact gap: not a candidate commit
    const trueGapIndex = offset + j;
    const key = nodeKey(winner.startRank, trueGapIndex, winner.rankTrace.slice(0, j));
    const rec = records.get(key);
    const rep = gapReport.get(trueGapIndex);
    const targets: Record<string, number> = {};
    if (rep !== undefined) {
      for (const [axis, detail] of Object.entries(rep.axes)) {
        if (typeof detail.target === "number") targets[axis] = round(detail.target, 3);
      }
    }
    const base: Omit<CommitRow, "committedPos" | "rank0Score" | "committedScore" | "forwardValueGap" | "branchesSeen" | "eligibleCount" | "match"> = {
      gapIndex: trueGapIndex,
      committedPoolRank: entry.rank,
      source: entry.source,
      targets,
      tEnd: rep?.t_end ?? null,
    };
    if (rec === undefined) {
      commits.push({ ...base, committedPos: null, rank0Score: null, committedScore: null,
        forwardValueGap: null, branchesSeen: null, eligibleCount: null, match: "no_record" });
      continue;
    }
    const pos = rec.selected.findIndex((o) => o.source === entry.source && o.rank === entry.rank);
    if (pos < 0) {
      commits.push({ ...base, committedPos: null, rank0Score: rec.selected[0]?.score ?? null,
        committedScore: null, forwardValueGap: null, branchesSeen: rec.selected.length,
        eligibleCount: rec.eligibleCount, match: "not_in_selected" });
      continue;
    }
    const rank0Score = rec.selected[0].score;
    const committedScore = rec.selected[pos].score;
    commits.push({
      ...base,
      committedPos: pos,
      rank0Score: round(rank0Score),
      committedScore: round(committedScore),
      forwardValueGap: round(committedScore - rank0Score),
      branchesSeen: rec.selected.length,
      eligibleCount: rec.eligibleCount,
      match: "matched",
    });
  }

  // Buckets + mean forward-value gap over matched non-rank-0 commits.
  const matchedCommits = commits.filter((c) => c.match === "matched" && c.committedPos !== null);
  const posBuckets = { rank0: 0, rank1to2: 0, rank3plus: 0 };
  let gapSum = 0;
  let gapN = 0;
  for (const c of matchedCommits) {
    const pos = c.committedPos as number;
    if (pos === 0) posBuckets.rank0++;
    else if (pos <= 2) posBuckets.rank1to2++;
    else posBuckets.rank3plus++;
    if (pos > 0 && c.forwardValueGap !== null) {
      gapSum += c.forwardValueGap;
      gapN++;
    }
  }

  // Off-path frame share (approximate upper bound): delta-attribute cumulative sim
  // frames between consecutive expansions to on/off the winning path. Non-expansion
  // sim frames (full-duration evaluations, tail sims) lump into the following
  // expansion's delta -> upper bound. Also report the clean expansion-COUNT share.
  let onPathFrames = 0;
  let offPathFrames = 0;
  let prev = 0;
  let onPathExp = 0;
  let offPathExp = 0;
  let unkeyedExp = 0;
  for (const fr of frameLog) {
    const delta = Math.max(0, fr.simFrames - prev);
    prev = fr.simFrames;
    const onPath = fr.key !== null && winnerPathKeys.has(fr.key);
    if (onPath) {
      onPathFrames += delta;
      onPathExp++;
    } else {
      offPathFrames += delta;
      if (fr.key === null) unkeyedExp++;
      else offPathExp++;
    }
  }
  const totalFrames = onPathFrames + offPathFrames;
  const totalExp = frameLog.length;

  return {
    source,
    seed,
    valid: score.contract_passed,
    score: round(score.score),
    winnerPhase: winner.phase,
    totalSimFrames: checkpoint.stats.sim_frames,
    firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
    committedContactGaps: commits.length,
    commits,
    matched: matchedCommits.length,
    unmatchedNoRecord: commits.filter((c) => c.match === "no_record").length,
    unmatchedNotInSelected: commits.filter((c) => c.match === "not_in_selected").length,
    posBuckets,
    meanForwardValueGapNonRank0: gapN > 0 ? round(gapSum / gapN) : null,
    offPathFrameShareUpperBound: totalFrames > 0 ? round(offPathFrames / totalFrames) : 0,
    offPathExpansionShare: totalExp > 0 ? round((offPathExp + unkeyedExp) / totalExp) : 0,
    expansions: { total: totalExp, onPath: onPathExp, offPath: offPathExp, unkeyed: unkeyedExp },
    elapsedMs,
  };
}

// ── Observation byte-identity check: a hookless compile must score identically to
//    the hooked one for one (source, seed) pair (the observation is side-effect-free).
function byteIdentityCheck(source: string, seed: number): {
  pass: boolean; hooked: number; hookless: number;
} {
  const spec = applyJolt(catalog[source], benchmarkPolicy.transform.joltMs);
  const totalFrames = Math.round(spec.duration * FPS);
  const { checkpoint: hookedCp } = observedCompile(spec, seed);
  const hooked = scoreDriftReport(hookedCp.report, { totalFrames }).score;
  const hooklessCp = compileHandoff(spec, seed, { budget });
  const hookless = scoreDriftReport(hooklessCp.report, { totalFrames }).score;
  return { pass: hooked === hookless, hooked, hookless };
}

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });

const firstSource = names[0];
const firstSeed = seeds[0];
const identity = byteIdentityCheck(firstSource, firstSeed);
process.stderr.write(
  `byte-identity[${firstSource} seed=${firstSeed}]: ${identity.pass ? "PASS" : "FAIL"} ` +
    `hooked=${identity.hooked} hookless=${identity.hookless}\n`,
);

const results: RunResult[] = [];
for (const name of names) {
  if (catalog[name] === undefined) throw new Error(`unknown case ${name}`);
  for (const seed of seeds) {
    const result = analyze(name, seed);
    results.push(result);
    writeFileSync(
      `${outDir}/${name}.seed${seed}.json`,
      `${JSON.stringify({ schema: SCHEMA, joltMs: benchmarkPolicy.transform.joltMs, budget, ...result }, null, 2)}\n`,
    );
    process.stderr.write(
      `${name} seed=${seed}: score=${result.score} valid=${result.valid} ` +
        `phase=${result.winnerPhase} commits=${result.committedContactGaps} ` +
        `matched=${result.matched} pos{0=${result.posBuckets.rank0},1-2=${result.posBuckets.rank1to2},` +
        `3+=${result.posBuckets.rank3plus}} offPathFrames~${result.offPathFrameShareUpperBound} (${result.elapsedMs}ms)\n`,
    );
  }
}

// ── Per-source aggregate console table ───────────────────────────────────────
type Agg = {
  commits: number; matched: number; rank0: number; rank1to2: number; rank3plus: number;
  gapSum: number; gapN: number; offFrameSum: number; offFrameW: number;
  noRecord: number; notInSelected: number;
};
const bySource = new Map<string, Agg>();
for (const r of results) {
  const a = bySource.get(r.source) ?? {
    commits: 0, matched: 0, rank0: 0, rank1to2: 0, rank3plus: 0,
    gapSum: 0, gapN: 0, offFrameSum: 0, offFrameW: 0, noRecord: 0, notInSelected: 0,
  };
  a.commits += r.committedContactGaps;
  a.matched += r.matched;
  a.rank0 += r.posBuckets.rank0;
  a.rank1to2 += r.posBuckets.rank1to2;
  a.rank3plus += r.posBuckets.rank3plus;
  a.noRecord += r.unmatchedNoRecord;
  a.notInSelected += r.unmatchedNotInSelected;
  if (r.meanForwardValueGapNonRank0 !== null) {
    const n = r.posBuckets.rank1to2 + r.posBuckets.rank3plus;
    a.gapSum += r.meanForwardValueGapNonRank0 * n;
    a.gapN += n;
  }
  a.offFrameSum += r.offPathFrameShareUpperBound;
  a.offFrameW += 1;
  bySource.set(r.source, a);
}

const pct = (n: number, d: number): string => (d > 0 ? `${round((100 * n) / d, 1)}%` : "-");
const pad = (s: string, w: number): string => s.padEnd(w);
const padL = (s: string, w: number): string => s.padStart(w);

const header = [
  pad("source", 28), padL("commits", 8), padL("matched", 8),
  padL("rank0", 8), padL("rank1-2", 8), padL("rank3+", 7),
  padL("meanFVgap", 10), padL("offPathFr", 10),
].join(" ");
const lines: string[] = ["", header, "-".repeat(header.length)];
for (const name of names) {
  const a = bySource.get(name);
  if (a === undefined) continue;
  lines.push([
    pad(name, 28),
    padL(String(a.commits), 8),
    padL(String(a.matched), 8),
    padL(pct(a.rank0, a.matched), 8),
    padL(pct(a.rank1to2, a.matched), 8),
    padL(pct(a.rank3plus, a.matched), 7),
    padL(a.gapN > 0 ? round(a.gapSum / a.gapN).toFixed(4) : "-", 10),
    padL(a.offFrameW > 0 ? `${round((100 * a.offFrameSum) / a.offFrameW, 1)}%` : "-", 10),
  ].join(" "));
}
lines.push("");
lines.push(
  `rank0 = committed the rollout's #1 branch; rank1-2/3+ = committed a lower-ranked branch ` +
    `after exploring (expansion-order regret). meanFVgap = mean forward-value the rollout gave ` +
    `up (committed - rank0 score) on non-rank0 commits. offPathFr = off-path sim-frame share (approx upper bound).`,
);
process.stdout.write(`${lines.join("\n")}\n`);
