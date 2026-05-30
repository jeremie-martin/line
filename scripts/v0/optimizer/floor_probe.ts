import { performance } from "node:perf_hooks";
import { detect, extractRawTrajectory } from "../../lib/detector.ts";
import { makeRng } from "../../lib/rng.ts";
import {
  buildDriftReport,
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../core/substrate.ts";
import { withOptimizedPrerollStart } from "../core/preroll.ts";
import {
  GOLDEN_SEEDS,
  GOLDEN_SPECS,
  headlineCases,
  loadGoldenSpec,
  type GoldenSpecName,
} from "../golden_suite.ts";
import { scoreDriftReport } from "../score.ts";
import { CALIB, secToFrame } from "../types.ts";
import {
  BASE_BACKTRACK_DEPTH,
  SKIP,
  buildBacktrackingLeaf,
  type SearchTelemetry,
} from "./lds.ts";
import {
  extendNode,
  getCandidatesSorted,
  isLeafNode,
  makeRootNode,
  type SearchNode,
} from "./node.ts";
import {
  PhysicsFrameLimitExceeded,
  getSimFrames,
  resetSimFrames,
  setSimFrameLimit,
} from "./sim_frames.ts";
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { GapFit } from "../core/substrate.ts";
import type { DriftReport, Gap, Spec } from "./types.ts";

type GuardMode = "hard" | "none";
type FloorContract = "completion" | "progressive";
type ContractArg = FloorContract | "both";

type Args = {
  specs: GoldenSpecName[];
  seeds: number[];
  budgetUnits: number | null;
  guard: GuardMode;
  contract: ContractArg;
  backtrackDepth: number;
  json: boolean;
};

type FloorProbeRow = {
  spec: GoldenSpecName;
  variant: "base";
  seed: number;
  floor_contract: FloorContract;
  guard: GuardMode;
  budget_units: number | null;
  hard_limit_units: number | null;
  status: "ok" | "physics_limit" | "error";
  error: string | null;
  wall_ms: number;
  floor_sim_frames: number;
  budget_multiple: number | null;
  floor_completed: boolean;
  processed_gaps: number;
  contact_gaps: number;
  processed_contacts: number;
  committed_contacts: number;
  skipped_contacts: number;
  first_skipped_gap: number | null;
  base_backtracks: number;
  candidate_cache_hits: number;
  candidate_cache_misses: number;
  contract_passed: boolean;
  score: number;
  axis_quality: number;
  hits: number;
  drift: number;
  missing: number;
  off_beat_landings: number;
  terminus: string | null;
  arc_placement: unknown;
};

const HARD_LIMIT_MULTIPLIER = 1.2;
const PARTIAL_FUTURE_CONTACT_WINDOW = 3;

function parseArgs(argv: string[]): Args {
  let specs: GoldenSpecName[] | null = null;
  let seeds: number[] | null = null;
  let budgetUnits: number | null = null;
  let guard: GuardMode = "hard";
  let contract: ContractArg = "completion";
  let backtrackDepth = BASE_BACKTRACK_DEPTH;
  let json = false;

  for (const raw of argv) {
    if (raw === "--json") {
      json = true;
      continue;
    }
    const [name, value] = raw.split("=", 2);
    if (name === "--specs") {
      if (!value) throw new Error("--specs requires a comma-separated value");
      specs = parseSpecs(value);
    } else if (name === "--seed") {
      if (!value) throw new Error("--seed requires a value");
      seeds = [parseSeed(value)];
    } else if (name === "--seeds") {
      if (!value) throw new Error("--seeds requires a comma-separated value");
      seeds = value.split(",").map(parseSeed);
    } else if (name === "--budget") {
      if (!value) throw new Error("--budget requires a value");
      budgetUnits = parseBudget(value);
    } else if (name === "--guard") {
      if (value !== "hard" && value !== "none") {
        throw new Error(`--guard must be "hard" or "none", got ${value}`);
      }
      guard = value;
    } else if (name === "--contract") {
      if (value !== "completion" && value !== "progressive" && value !== "both") {
        throw new Error(`--contract must be completion, progressive, or both; got ${value}`);
      }
      contract = value;
    } else if (name === "--backtrack-depth") {
      if (!value) throw new Error("--backtrack-depth requires a value");
      backtrackDepth = parseBacktrackDepth(value);
    } else {
      throw new Error(`unknown argument: ${raw}`);
    }
  }

  return {
    specs: specs ?? headlineCases().map((row) => row.specName),
    seeds: seeds ?? [...GOLDEN_SEEDS],
    budgetUnits,
    guard,
    contract,
    backtrackDepth,
    json,
  };
}

function parseSpecs(value: string): GoldenSpecName[] {
  const valid = new Set<string>(GOLDEN_SPECS);
  return value.split(",").map((spec) => {
    if (!valid.has(spec)) throw new Error(`unknown spec "${spec}"`);
    return spec as GoldenSpecName;
  });
}

function parseSeed(value: string): number {
  const seed = Number(value);
  if (!Number.isSafeInteger(seed)) throw new Error(`invalid seed ${value}`);
  return seed;
}

function parseBudget(value: string): number {
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error(`invalid budget ${value}`);
  return budget;
}

function parseBacktrackDepth(value: string): number {
  const depth = Number(value);
  if (!Number.isInteger(depth) || depth < 0) throw new Error(`invalid backtrack depth ${value}`);
  return depth;
}

async function probeRow(
  specName: GoldenSpecName,
  seed: number,
  args: Args,
  contract: FloorContract,
): Promise<FloorProbeRow> {
  resetSimFrames();
  resetArcPlacementStats();
  const hardLimit = args.guard === "hard" && args.budgetUnits !== null
    ? Math.ceil(args.budgetUnits * HARD_LIMIT_MULTIPLIER)
    : null;
  setSimFrameLimit(hardLimit);
  const started = performance.now();
  let contactGapCount = 0;
  const telemetry: SearchTelemetry = {
    repairRounds: 0,
    cacheHits: 0,
    cacheMisses: 0,
    baseBacktracks: 0,
  };

  try {
    const raw = await loadGoldenSpec(specName, "base");
    validateSpec(raw);
    const spec = withOptimizedPrerollStart(raw, seed);
    const startState = resolveStartState(spec);
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = [...spec.contacts]
      .map((contact) => secToFrame(contact.t))
      .sort((a, b) => a - b);
    const gaps = sliceTimeline(allContactFrames, durationFrames);
    contactGapCount = gaps.filter((gap) => gap.endsWithContact).length;
    const masterRng = makeRng(seed);
    for (const gap of gaps) {
      gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, masterRng);
    }

    const ctx: SpecContext = { allContactFrames, durationFrames };
    const root = makeRootNode(makeBaseEngine(startState), gaps.length);
    if (contract === "progressive") {
      const floor = buildProgressiveFloor(root, gaps, ctx, seed, args.budgetUnits, telemetry);
      if (floor.status === "physics_limit") {
        const skippedContacts = floor.commitPath.filter((choice) => choice === SKIP).length;
        const firstSkippedContact = floor.commitPath.findIndex((choice) => choice === SKIP);
        return {
          spec: specName,
          variant: "base",
          seed,
          floor_contract: "progressive",
          guard: args.guard,
          budget_units: args.budgetUnits,
          hard_limit_units: hardLimit,
          status: floor.status,
          error: floor.error,
          wall_ms: Math.round(performance.now() - started),
          floor_sim_frames: getSimFrames(),
          budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
          floor_completed: false,
          processed_gaps: floor.processedGaps,
          contact_gaps: contactGapCount,
          processed_contacts: floor.commitPath.length,
          committed_contacts: floor.node.prefixFits.filter((fit) => fit !== null).length,
          skipped_contacts: skippedContacts,
          first_skipped_gap: firstSkippedContact < 0 ? null : firstSkippedContact,
          base_backtracks: telemetry.baseBacktracks,
          candidate_cache_hits: telemetry.cacheHits,
          candidate_cache_misses: telemetry.cacheMisses,
          contract_passed: false,
          score: 0,
          axis_quality: 0,
          hits: 0,
          drift: 0,
          missing: 0,
          off_beat_landings: 0,
          terminus: null,
          arc_placement: snapshotArcPlacementStats(),
        };
      }
      const fullDuration = floor.completed;
      const partialHorizonFrame = fullDuration
        ? durationFrames
        : processedHorizonFrame(floor.node, gaps);
      const outputDurationFrames = fullDuration
        ? durationFrames + 20
        : partialOutputDurationFrames(partialHorizonFrame, durationFrames);
      const det = detect(extractRawTrajectory(floor.node.prefixEngine, outputDurationFrames));
      const fits = paddedFits(floor.node, gaps.length);
      const rawReport = buildDriftReport(det, spec, gaps, allContactFrames, durationFrames, [], fits);
      const report = fullDuration ? rawReport : asPartialReport(rawReport, spec, partialHorizonFrame);
      const score = scoreDriftReport(report, { totalFrames: durationFrames });
      const skippedContacts = floor.commitPath.filter((choice) => choice === SKIP).length;
      const firstSkippedContact = floor.commitPath.findIndex((choice) => choice === SKIP);
      return {
        spec: specName,
        variant: "base",
        seed,
        floor_contract: "progressive",
        guard: args.guard,
        budget_units: args.budgetUnits,
        hard_limit_units: hardLimit,
        status: floor.status,
        error: floor.error,
        wall_ms: Math.round(performance.now() - started),
        floor_sim_frames: getSimFrames(),
        budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
        floor_completed: floor.completed,
        processed_gaps: floor.processedGaps,
        contact_gaps: contactGapCount,
        processed_contacts: floor.commitPath.length,
        committed_contacts: fits.filter((fit) => fit !== null).length,
        skipped_contacts: skippedContacts,
        first_skipped_gap: firstSkippedContact < 0 ? null : firstSkippedContact,
        base_backtracks: telemetry.baseBacktracks,
        candidate_cache_hits: telemetry.cacheHits,
        candidate_cache_misses: telemetry.cacheMisses,
        contract_passed: floor.completed && score.contract_passed,
        score: score.score,
        axis_quality: score.axis_quality,
        hits: report.contacts.filter((contact) => contact.status === "hit").length,
        drift: report.contacts.filter((contact) => contact.status === "drift").length,
        missing: report.contacts.filter((contact) => contact.status === "missing").length,
        off_beat_landings: report.off_beat_landings.length,
        terminus: report.terminus.reason,
        arc_placement: snapshotArcPlacementStats(),
      };
    }

    const floor = buildBacktrackingLeaf(
      root,
      gaps,
      ctx,
      seed,
      args.backtrackDepth,
      new Map<string, Candidate[]>(),
      undefined,
      undefined,
      telemetry,
    );
    if (floor === null) {
      return errorRow(
        specName,
        seed,
        args,
        contract,
        hardLimit,
        contactGapCount,
        started,
        telemetry,
        "error",
        "no floor leaf",
      );
    }

    const det = detect(extractRawTrajectory(floor.leaf.engine, durationFrames + 20));
    const fits = floor.leaf.fits as (GapFit | null)[];
    const report = buildDriftReport(det, spec, gaps, allContactFrames, durationFrames, [], fits);
    const score = scoreDriftReport(report, { totalFrames: durationFrames });
    const skippedContacts = floor.baseCommitPath.filter((choice) => choice === SKIP).length;
    const firstSkippedContact = floor.baseCommitPath.findIndex((choice) => choice === SKIP);
    return {
      spec: specName,
      variant: "base",
      seed,
      floor_contract: contract,
      guard: args.guard,
      budget_units: args.budgetUnits,
      hard_limit_units: hardLimit,
      status: "ok",
      error: null,
      wall_ms: Math.round(performance.now() - started),
      floor_sim_frames: getSimFrames(),
      budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
      floor_completed: true,
      processed_gaps: gaps.length,
      contact_gaps: contactGapCount,
      processed_contacts: floor.baseCommitPath.length,
      committed_contacts: floor.baseCommitPath.length - skippedContacts,
      skipped_contacts: skippedContacts,
      first_skipped_gap: firstSkippedContact < 0 ? null : firstSkippedContact,
      base_backtracks: telemetry.baseBacktracks,
      candidate_cache_hits: telemetry.cacheHits,
      candidate_cache_misses: telemetry.cacheMisses,
      contract_passed: score.contract_passed,
      score: score.score,
      axis_quality: score.axis_quality,
      hits: report.contacts.filter((contact) => contact.status === "hit").length,
      drift: report.contacts.filter((contact) => contact.status === "drift").length,
      missing: report.contacts.filter((contact) => contact.status === "missing").length,
      off_beat_landings: report.off_beat_landings.length,
      terminus: report.terminus.reason,
      arc_placement: snapshotArcPlacementStats(),
    };
  } catch (error) {
    return errorRow(
      specName,
      seed,
      args,
      contract,
      hardLimit,
      contactGapCount,
      started,
      telemetry,
      error instanceof PhysicsFrameLimitExceeded ? "physics_limit" : "error",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    setSimFrameLimit(null);
  }
}

type ProgressiveFloor = {
  node: SearchNode;
  commitPath: number[];
  status: "ok" | "physics_limit";
  error: string | null;
  completed: boolean;
  processedGaps: number;
};

function buildProgressiveFloor(
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  budgetUnits: number | null,
  telemetry: SearchTelemetry,
): ProgressiveFloor {
  let node = root;
  const commitPath: number[] = [];
  while (!isLeafNode(node, gaps.length)) {
    if (budgetUnits !== null && getSimFrames() >= budgetUnits) break;
    const gap = gaps[node.gapIndex];
    if (!gap.endsWithContact) {
      node = extendNode(node, null);
      continue;
    }

    let candidates: Candidate[];
    try {
      telemetry.cacheMisses++;
      candidates = getCandidatesSorted(node, gaps, ctx, seed);
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      return {
        node,
        commitPath,
        status: "physics_limit",
        error: error.message,
        completed: false,
        processedGaps: node.gapIndex,
      };
    }

    const best = candidates[0] ?? null;
    commitPath.push(best === null ? SKIP : 0);
    node = extendNode(node, best);
  }
  return {
    node,
    commitPath,
    status: "ok",
    error: null,
    completed: isLeafNode(node, gaps.length),
    processedGaps: node.gapIndex,
  };
}

function paddedFits(node: SearchNode, gapCount: number): (GapFit | null)[] {
  const fits = node.prefixFits.slice();
  while (fits.length < gapCount) fits.push(null);
  return fits;
}

function processedHorizonFrame(node: SearchNode, gaps: Gap[]): number {
  for (let i = Math.min(node.gapIndex, gaps.length) - 1; i >= 0; i--) {
    if (gaps[i].endsWithContact) return gaps[i].endFrame;
  }
  return 0;
}

function partialOutputDurationFrames(horizonFrame: number, durationFrames: number): number {
  return Math.max(1, Math.min(durationFrames, horizonFrame + 20));
}

function asPartialReport(report: DriftReport, spec: Spec, horizonFrame: number): DriftReport {
  const reachedContacts = report.contacts
    .filter((contact) => secToFrame(contact.t_target) <= horizonFrame);
  const futureContacts = report.contacts
    .filter((contact) => secToFrame(contact.t_target) > horizonFrame)
    .slice(0, PARTIAL_FUTURE_CONTACT_WINDOW)
    .map((contact) => ({
      t_target: contact.t_target,
      t_actual: null,
      frame_error: null,
      status: "missing" as const,
    }));
  return {
    ...report,
    contacts: [...reachedContacts, ...futureContacts],
    sections: report.sections
      .filter((section) => secToFrame(spec.sections[section.section_index]?.t1 ?? 0) <= horizonFrame),
    off_beat_landings: report.off_beat_landings
      .filter((landing) => landing.frame <= horizonFrame),
    terminus: {
      frame: Math.min(report.terminus.frame, horizonFrame),
      reason: report.terminus.reason === "endOfSpec" ? "rideStalled" : report.terminus.reason,
    },
  };
}

function errorRow(
  specName: GoldenSpecName,
  seed: number,
  args: Args,
  contract: FloorContract,
  hardLimit: number | null,
  contactGapCount: number,
  started: number,
  telemetry: SearchTelemetry,
  status: "physics_limit" | "error",
  message: string,
): FloorProbeRow {
  return {
    spec: specName,
    variant: "base",
    seed,
    floor_contract: contract,
    guard: args.guard,
    budget_units: args.budgetUnits,
    hard_limit_units: hardLimit,
    status,
    error: message,
    wall_ms: Math.round(performance.now() - started),
    floor_sim_frames: getSimFrames(),
    budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
    floor_completed: false,
    processed_gaps: 0,
    contact_gaps: contactGapCount,
    processed_contacts: 0,
    committed_contacts: 0,
    skipped_contacts: 0,
    first_skipped_gap: null,
    base_backtracks: telemetry.baseBacktracks,
    candidate_cache_hits: telemetry.cacheHits,
    candidate_cache_misses: telemetry.cacheMisses,
    contract_passed: false,
    score: 0,
    axis_quality: 0,
    hits: 0,
    drift: 0,
    missing: 0,
    off_beat_landings: 0,
    terminus: null,
    arc_placement: snapshotArcPlacementStats(),
  };
}

function printText(rows: FloorProbeRow[]): void {
  for (const row of rows) {
    const budget = row.budget_units === null
      ? "budget=none"
      : `budget=${row.budget_units} x${row.budget_multiple?.toFixed(2)}`;
    const contract = row.contract_passed ? "PASS" : "FAIL";
    const done = row.floor_completed ? "done" : `prefix ${row.processed_contacts}/${row.contact_gaps}`;
    console.log(
      `${row.spec}@s${row.seed} ${row.floor_contract} ${row.status} ${contract} ${done} ` +
      `${row.committed_contacts}/${row.contact_gaps} committed ` +
      `${row.hits}hit/${row.missing}missing ` +
      `sim=${row.floor_sim_frames} ${budget} ` +
      `bt=${row.base_backtracks} cache=${row.candidate_cache_hits}/${row.candidate_cache_misses} ` +
      `wall=${row.wall_ms}ms`,
    );
    if (row.error !== null) console.log(`  error: ${row.error}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rows: FloorProbeRow[] = [];
  const contracts: FloorContract[] = args.contract === "both"
    ? ["completion", "progressive"]
    : [args.contract];
  for (const seed of args.seeds) {
    for (const spec of args.specs) {
      for (const contract of contracts) rows.push(await probeRow(spec, seed, args, contract));
    }
  }

  if (args.json) {
    console.log(JSON.stringify({
      floor_contract: args.contract,
      guard: args.guard,
      budget_units: args.budgetUnits,
      backtrack_depth: args.backtrackDepth,
      rows,
    }, null, 2));
  } else {
    printText(rows);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
