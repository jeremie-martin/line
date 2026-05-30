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
import { makeRootNode } from "./node.ts";
import {
  PhysicsFrameLimitExceeded,
  getSimFrames,
  resetSimFrames,
  setSimFrameLimit,
} from "./sim_frames.ts";
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { GapFit } from "../core/substrate.ts";

type GuardMode = "hard" | "none";
type FloorContract = "completion";

type Args = {
  specs: GoldenSpecName[];
  seeds: number[];
  budgetUnits: number | null;
  guard: GuardMode;
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
  contact_gaps: number;
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

function parseArgs(argv: string[]): Args {
  let specs: GoldenSpecName[] | null = null;
  let seeds: number[] | null = null;
  let budgetUnits: number | null = null;
  let guard: GuardMode = "hard";
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
    } else {
      throw new Error(`unknown argument: ${raw}`);
    }
  }

  return {
    specs: specs ?? headlineCases().map((row) => row.specName),
    seeds: seeds ?? [...GOLDEN_SEEDS],
    budgetUnits,
    guard,
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

async function probeRow(
  specName: GoldenSpecName,
  seed: number,
  args: Args,
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
    const floor = buildBacktrackingLeaf(
      root,
      gaps,
      ctx,
      seed,
      BASE_BACKTRACK_DEPTH,
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
      floor_contract: "completion",
      guard: args.guard,
      budget_units: args.budgetUnits,
      hard_limit_units: hardLimit,
      status: "ok",
      error: null,
      wall_ms: Math.round(performance.now() - started),
      floor_sim_frames: getSimFrames(),
      budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
      contact_gaps: floor.baseCommitPath.length,
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

function errorRow(
  specName: GoldenSpecName,
  seed: number,
  args: Args,
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
    floor_contract: "completion",
    guard: args.guard,
    budget_units: args.budgetUnits,
    hard_limit_units: hardLimit,
    status,
    error: message,
    wall_ms: Math.round(performance.now() - started),
    floor_sim_frames: getSimFrames(),
    budget_multiple: args.budgetUnits === null ? null : getSimFrames() / args.budgetUnits,
    contact_gaps: contactGapCount,
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
    console.log(
      `${row.spec}@s${row.seed} ${row.status} ${contract} ` +
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
  for (const seed of args.seeds) {
    for (const spec of args.specs) rows.push(await probeRow(spec, seed, args));
  }

  if (args.json) {
    console.log(JSON.stringify({
      floor_contract: "completion",
      guard: args.guard,
      budget_units: args.budgetUnits,
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
