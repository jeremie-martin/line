import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmarkSequentialEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  pairedV2CalibrationVerdict,
  v2HeadlineForDecisionRuns,
  type DecisionRun,
} from "./decision_model.ts";
import {
  referenceTDirectionalProbability,
  sequentialLookDecision,
  type SequentialLookDecision,
} from "./sequential_inference.ts";
import { canonicalMembers, type SuiteManifest } from "./suite_model.ts";

export const ROUND_PROGRESS_REFERENCE_SCHEMA =
  "line.benchmark-v2.round-progress-reference.v1" as const;
export const ROUND_PROGRESS_EVENT_SCHEMA =
  "line.benchmark-v2.round-progress-event.v1" as const;
export const ROUND_PROGRESS_LOG_SCHEMA =
  "line.benchmark-v2.round-progress-log.v1" as const;

export type RoundProgressReference = {
  schema: typeof ROUND_PROGRESS_REFERENCE_SCHEMA;
  authority: "diagnostic-only";
  baseline: {
    label: string;
    candidateFingerprint: string;
    cacheFingerprint: string;
  };
  candidateFingerprint: string;
  suiteFingerprint: string;
  seedScheduleFingerprint: string;
  maximumDepth: number;
  throughDepth: number;
  looks: number[];
  boundaryConstant: number;
  budgets: number[];
  sources: string[];
  runs: DecisionRun[];
};

export type RoundProgressEvent = {
  schema: typeof ROUND_PROGRESS_EVENT_SCHEMA;
  authority: "diagnostic-only";
  depth: number;
  actualSeeds: Array<{ budget: number; actualSeed: number }>;
  validity: {
    roundBase: number;
    roundCandidate: number;
    roundTotal: number;
    cumulativeBase: number;
    cumulativeCandidate: number;
    cumulativeTotal: number;
  };
  round: {
    baseHeadline: number;
    candidateHeadline: number;
    delta: number;
  };
  cumulative: {
    baseHeadline: number;
    candidateHeadline: number;
    delta: number;
    standardError: number | null;
    directionalProbability: number | null;
  };
  look: SequentialLookDecision | null;
};

export type RoundProgressReferenceExpectation = {
  candidateFingerprint: string;
  suiteFingerprint: string;
  seedScheduleFingerprint: string;
  maximumDepth: number;
  throughDepth: number;
  budgets: readonly number[];
  sources: readonly string[];
};

export function loadRoundProgressReference(
  path: string,
  suite: SuiteManifest,
  expected: RoundProgressReferenceExpectation,
): RoundProgressReference {
  const absolute = resolve(path);
  const bytes = readFileSync(absolute);
  const sidecar = readFileSync(`${absolute}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (sha256(bytes) !== sidecar) throw new Error(`round-progress reference checksum mismatch`);
  const reference = JSON.parse(bytes.toString("utf8")) as RoundProgressReference;
  validateRoundProgressReference(reference, suite, expected);
  return reference;
}

export function validateRoundProgressReference(
  reference: RoundProgressReference,
  suite: SuiteManifest,
  expected: RoundProgressReferenceExpectation,
): void {
  const sourceSet = [...expected.sources].sort();
  const referenceSources = Array.isArray(reference.sources) ? [...reference.sources].sort() : [];
  if (
    reference.schema !== ROUND_PROGRESS_REFERENCE_SCHEMA ||
    reference.authority !== "diagnostic-only" ||
    reference.candidateFingerprint !== expected.candidateFingerprint ||
    reference.suiteFingerprint !== expected.suiteFingerprint ||
    reference.seedScheduleFingerprint !== expected.seedScheduleFingerprint ||
    reference.maximumDepth !== expected.maximumDepth ||
    reference.throughDepth !== expected.throughDepth ||
    JSON.stringify(reference.budgets) !== JSON.stringify(expected.budgets) ||
    JSON.stringify(referenceSources) !== JSON.stringify(sourceSet) ||
    JSON.stringify(reference.looks) !== JSON.stringify(benchmarkSequentialEvalPolicy.looks) ||
    reference.maximumDepth !== benchmarkSequentialEvalPolicy.maximumDepth ||
    !Number.isFinite(reference.boundaryConstant) || reference.boundaryConstant <= 0 ||
    typeof reference.baseline?.label !== "string" || reference.baseline.label === "" ||
    !fingerprint(reference.baseline?.candidateFingerprint) ||
    !fingerprint(reference.baseline?.cacheFingerprint) ||
    !Array.isArray(reference.runs)
  ) throw new Error(`round-progress reference does not match the governed comparison`);

  const suiteSources = [...canonicalMembers(suite)].sort();
  if (JSON.stringify(suiteSources) !== JSON.stringify(sourceSet)) {
    throw new Error(`round-progress source scope does not match the canonical suite`);
  }
  const expectedKeys = new Set<string>();
  for (let seedSlot = 0; seedSlot < reference.throughDepth; seedSlot++) {
    for (const budget of reference.budgets) {
      for (const sourceId of reference.sources) expectedKeys.add(cellKey(sourceId, budget, seedSlot));
    }
  }
  const actualSeeds = new Map<string, number>();
  for (const run of reference.runs) {
    const key = cellKey(run.sourceId, run.budget, run.seedSlot);
    const block = `${run.budget}\0${run.seedSlot}`;
    if (
      !expectedKeys.delete(key) || !Number.isSafeInteger(run.actualSeed) || run.actualSeed < 0 ||
      typeof run.score?.valid !== "boolean" || !Number.isFinite(run.score?.score)
    ) throw new Error(`round-progress reference has an unexpected, duplicate, or malformed row`);
    const priorSeed = actualSeeds.get(block);
    if (priorSeed !== undefined && priorSeed !== run.actualSeed) {
      throw new Error(`round-progress reference remaps an actual seed within one block`);
    }
    actualSeeds.set(block, run.actualSeed);
  }
  if (expectedKeys.size > 0) {
    throw new Error(`round-progress reference is missing ${expectedKeys.size} baseline rows`);
  }
}

/**
 * Collects compact scored rows until a genuinely complete seed prefix exists.
 * Worker completion order is deliberately irrelevant: depth N is emitted only
 * after all canonical sources and budgets for slots [0,N) are present.
 */
export class RoundProgressAccumulator {
  readonly reference: RoundProgressReference;
  readonly suite: SuiteManifest;
  readonly restoredEvents: RoundProgressEvent[];
  private readonly baselineByKey: Map<string, DecisionRun>;
  private readonly candidateByKey = new Map<string, DecisionRun>();
  private readonly countsBySlot = new Map<number, number>();
  private readonly cellsPerRound: number;
  private nextDepth = 1;

  /**
   * Fields are declared and assigned explicitly rather than as constructor
   * parameter properties: the runner's worker threads load this module without
   * the tsx loader, under Node's strip-only type stripping, which rejects any
   * TypeScript syntax that requires transformation.
   */
  constructor(
    reference: RoundProgressReference,
    suite: SuiteManifest,
    restored: DecisionRun[] = [],
  ) {
    this.reference = reference;
    this.suite = suite;
    this.baselineByKey = new Map(reference.runs.map((run) => [
      cellKey(run.sourceId, run.budget, run.seedSlot),
      run,
    ]));
    this.cellsPerRound = reference.sources.length * reference.budgets.length;
    for (const run of restored) this.add(run);
    this.restoredEvents = this.drain();
  }

  get completedDepth(): number {
    return this.nextDepth - 1;
  }

  record(run: DecisionRun): RoundProgressEvent[] {
    this.add(run);
    return this.drain();
  }

  allEvents(): RoundProgressEvent[] {
    const events: RoundProgressEvent[] = [];
    for (let depth = 1; depth < this.nextDepth; depth++) events.push(this.eventAt(depth));
    return events;
  }

  private add(run: DecisionRun): void {
    const key = cellKey(run.sourceId, run.budget, run.seedSlot);
    const baseline = this.baselineByKey.get(key);
    if (
      baseline === undefined || baseline.actualSeed !== run.actualSeed ||
      typeof run.score?.valid !== "boolean" || !Number.isFinite(run.score?.score)
    ) throw new Error(`candidate round-progress row does not match the verified baseline schedule`);
    const prior = this.candidateByKey.get(key);
    if (prior !== undefined) {
      if (JSON.stringify(prior) !== JSON.stringify(run)) {
        throw new Error(`candidate round-progress row changed after it was recorded`);
      }
      return;
    }
    this.candidateByKey.set(key, run);
    this.countsBySlot.set(run.seedSlot, (this.countsBySlot.get(run.seedSlot) ?? 0) + 1);
  }

  private drain(): RoundProgressEvent[] {
    const events: RoundProgressEvent[] = [];
    while (
      this.nextDepth <= this.reference.throughDepth &&
      this.countsBySlot.get(this.nextDepth - 1) === this.cellsPerRound
    ) {
      events.push(this.eventAt(this.nextDepth));
      this.nextDepth++;
    }
    return events;
  }

  private eventAt(depth: number): RoundProgressEvent {
    const basePrefix = this.reference.runs.filter((run) => run.seedSlot < depth);
    const candidatePrefix = [...this.candidateByKey.values()].filter((run) => run.seedSlot < depth);
    const suiteAtDepth = suiteForDepth(this.suite, this.reference.budgets, depth);
    const verdict = pairedV2CalibrationVerdict(basePrefix, candidatePrefix, suiteAtDepth, {
      profile: "canonical",
      mode: "improvement",
    });
    const roundBase = basePrefix.filter((run) => run.seedSlot === depth - 1)
      .map((run) => ({ ...run, seedSlot: 0 }));
    const roundCandidate = candidatePrefix.filter((run) => run.seedSlot === depth - 1)
      .map((run) => ({ ...run, seedSlot: 0 }));
    const roundSuite = suiteForDepth(this.suite, this.reference.budgets, 1);
    const baseRoundHeadline = v2HeadlineForDecisionRuns(roundBase, roundSuite, "canonical");
    const candidateRoundHeadline = v2HeadlineForDecisionRuns(roundCandidate, roundSuite, "canonical");
    const baseHeadline = v2HeadlineForDecisionRuns(basePrefix, suiteAtDepth, "canonical");
    const candidateHeadline = v2HeadlineForDecisionRuns(candidatePrefix, suiteAtDepth, "canonical");
    const confidence = verdict.confidence;
    const look = this.reference.looks.includes(depth)
      ? sequentialLookDecision(confidence, depth, this.reference.boundaryConstant)
      : null;
    return {
      schema: ROUND_PROGRESS_EVENT_SCHEMA,
      authority: "diagnostic-only",
      depth,
      actualSeeds: this.reference.budgets.map((budget) => ({
        budget,
        actualSeed: roundBase.find((run) => run.budget === budget)!.actualSeed,
      })),
      validity: {
        roundBase: roundBase.filter((run) => run.score.valid).length,
        roundCandidate: roundCandidate.filter((run) => run.score.valid).length,
        roundTotal: roundBase.length,
        cumulativeBase: basePrefix.filter((run) => run.score.valid).length,
        cumulativeCandidate: candidatePrefix.filter((run) => run.score.valid).length,
        cumulativeTotal: basePrefix.length,
      },
      round: {
        baseHeadline: round(baseRoundHeadline),
        candidateHeadline: round(candidateRoundHeadline),
        delta: round(candidateRoundHeadline - baseRoundHeadline),
      },
      cumulative: {
        baseHeadline: round(baseHeadline),
        candidateHeadline: round(candidateHeadline),
        delta: verdict.delta,
        standardError: confidence.available ? confidence.standardError : null,
        directionalProbability: confidence.available
          ? round(referenceTDirectionalProbability(confidence), 8)
          : null,
      },
      look,
    };
  }
}

export function roundProgressLog(
  reference: RoundProgressReference,
  events: readonly RoundProgressEvent[],
): string {
  return [
    JSON.stringify({
      schema: ROUND_PROGRESS_LOG_SCHEMA,
      authority: "diagnostic-only",
      note: "Reconstructable progress summaries; promotion authority remains the strict look artifacts.",
      baseline: reference.baseline,
      candidateFingerprint: reference.candidateFingerprint,
      suiteFingerprint: reference.suiteFingerprint,
      seedScheduleFingerprint: reference.seedScheduleFingerprint,
      maximumDepth: reference.maximumDepth,
      throughDepth: reference.throughDepth,
      looks: reference.looks,
    }),
    ...events.map((event) => JSON.stringify(event)),
    "",
  ].join("\n");
}

export function renderRoundProgress(
  event: RoundProgressEvent,
  runtime: {
    waveDepth: number;
    workerFailures: number;
    rate: number;
    etaSeconds: number;
  },
): string {
  const seeds = event.actualSeeds.length === 1
    ? `seed ${event.actualSeeds[0].actualSeed}`
    : `seeds ${event.actualSeeds.map((entry) => `${entry.budget / 1000}k:${entry.actualSeed}`).join(",")}`;
  const inference = event.cumulative.standardError === null ||
      event.cumulative.directionalProbability === null
    ? `cumulative ${event.cumulative.candidateHeadline.toFixed(2)} ` +
      `(Δ ${signed(event.cumulative.delta)}; SE/P+ available from N=2)`
    : `cumulative ${event.cumulative.candidateHeadline.toFixed(2)} ` +
      `(Δ ${signed(event.cumulative.delta)}, SE ${event.cumulative.standardError.toFixed(2)}, ` +
      `P+ ${(100 * event.cumulative.directionalProbability).toFixed(2)}%)`;
  const look = event.look === null
    ? ""
    : `; LOOK ${event.look.action}, need ${(100 * event.look.requiredDirectionalProbability).toFixed(2)}%`;
  return `  round ${event.depth}/${runtime.waveDepth} ${seeds}: ` +
    `valid ${event.validity.roundCandidate}/${event.validity.roundTotal}, failures ${runtime.workerFailures}; ` +
    `round Δ ${signed(event.round.delta)}; ${inference}${look}; ` +
    `${runtime.rate.toFixed(2)} runs/s, ETA ${formatDuration(runtime.etaSeconds)}`;
}

function suiteForDepth(suite: SuiteManifest, budgets: number[], depth: number): SuiteManifest {
  const copy = structuredClone(suite);
  copy.profiles.canonical.budgets = [...budgets];
  copy.profiles.canonical.seeds_per_budget = depth;
  return copy;
}

function cellKey(sourceId: string, budget: number, seedSlot: number): string {
  return `${sourceId}\0${budget}\0${seedSlot}`;
}

function fingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.ceil(seconds - minutes * 60);
  return `${minutes}m${remainder.toString().padStart(2, "0")}s`;
}
