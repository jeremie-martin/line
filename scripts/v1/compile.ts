import { BestArchive } from "./archive.ts";
import {
  defaultBudgetFor,
  minimumRecommendedBudgetFor,
  normalizeCompileOptions,
} from "./budget.ts";
import { evaluateTrackJson } from "./completion_oracle.ts";
import { addTrackLines, measuredGetRider, rebuildEngineFromLines } from "./engine_adapter.ts";
import type { WorkMeteredEngine } from "./engine_adapter.ts";
import { makeSolidLine } from "../v0/arc.ts";
import {
  contactLineIdsAt,
  detectFull,
  detectWindow,
  evaluateGapCandidate,
  compareGapFits,
  airborneAt,
  measureFitGrain,
} from "./gap_evaluator.ts";
import { normalizeSpec } from "./normalize.ts";
import { evaluatePolishCandidates } from "./polish.ts";
import { createDeterministicEpochScheduler } from "./scheduler.ts";
import type { GapFit } from "./search_state.ts";
import { CompileStatsBuilder } from "./stats.ts";
import { buildTrackJson } from "./track_builder.ts";
import type {
  Budget,
  CandidateKey,
  CandidateStreamName,
  CompleteCandidate,
  CompileOptions,
  CompileResult,
  NormalizedSpecContext,
  SectionAxes,
  Spec,
  TrackLine,
} from "./types.ts";
import { clamp, stableHash } from "./deterministic_math.ts";
import { BudgetExhaustedError, WorkMeter } from "./work_meter.ts";

export type { Budget, CompileOptions, CompileResult };
export { defaultBudgetFor, minimumRecommendedBudgetFor };

const DEFAULT_CANDIDATE_BATCH_SIZE = 16;
const LOW_ENERGY_CANDIDATE_BATCH_SIZE = 48;
const DENSE_CANDIDATE_BATCH_SIZE = 4;
const AIR_SWING_DENSE_CANDIDATE_BATCH_SIZE = 15;
const DENSE_INITIAL_MIN_ATTEMPTS = 15;
const DENSE_INITIAL_MIN_SURVIVORS = 2;
const DENSE_INITIAL_MAX_ATTEMPTS = 48;
const DENSE_COVERAGE_ATTEMPTS = 48;
const ORDINAL_PHASE_SIZE = 192;
const MAX_COVERAGE_ORDINALS_PER_PREFIX = 1024;
const DENSE_LOOKAHEAD_FIT_LIMIT = 0;
const DENSE_LOOKAHEAD_ATTEMPTS = 16;
const COVERAGE_EPOCH_WORK_UNITS = 50_000;
const RECOVERY_EPOCH_WORK_UNITS = 1_000;
const RECOVERY_FRONTIER_MAX_STATES = 24;
const RECOVERY_FRONTIER_CHILDREN_PER_PREFIX = 4;
const RECOVERY_FRONTIER_CANDIDATE_ATTEMPTS = 16;
const RECOVERY_FRONTIER_MAX_ORDINALS_PER_PREFIX = 192;
const ORDINARY_PREFIX_ENGINE_CACHE_LIMIT = 16;
const DENSE_PREFIX_ENGINE_CACHE_LIMIT = 2;
const PREFIX_VALIDATION_RETRIES_PER_GAP = 0;
const FINAL_VALIDATION_RETRIES_PER_GAP = 3;
const OWNER_RETRY_MAX_SYNC_FAILURES = 6;
const OWNER_RETRY_MIN_COMPLETED_CANDIDATES = 1;
const LOCALIZED_RETRY_MAX_MISSING = 0;
const LOCALIZED_RETRY_START_ATTEMPTS = 96;
const LOCALIZED_RETRY_START_ALTERNATIVES = 6;
const LOCALIZED_RETRY_ROLLOUT_ATTEMPTS = 48;
const LOCALIZED_RETRY_MAX_COMPLETIONS = 8;
const QUALITY_RETRY_MIN_AXIS_ERROR = 0.12;
const QUALITY_RETRY_MIN_COMPLETED_CANDIDATES = 128;
const QUALITY_RETRY_START_ATTEMPTS = 96;
const QUALITY_RETRY_START_ALTERNATIVES = 4;
const QUALITY_RETRY_MAX_COMPLETIONS = 4;
const AIR_RESIDUAL_TARGET_GAIN = 0.35;
const GRAIN_RESIDUAL_TARGET_GAIN = 0.15;

export function compile(spec: Spec, seed?: number): CompileResult;
export function compile(spec: Spec, opts?: CompileOptions): CompileResult;
export function compile(spec: Spec, optsOrSeed?: CompileOptions | number): CompileResult {
  return compileInternal(spec, optsOrSeed).result;
}

export function compileForDiagnostics(
  spec: Spec,
  optsOrSeed?: CompileOptions | number,
): CompileResult & { diagnostics: { bestRejected: CompleteCandidate | null } } {
  const internal = compileInternal(spec, optsOrSeed);
  return {
    ...internal.result,
    diagnostics: {
      bestRejected: internal.archive.bestRejected,
    },
  };
}

function compileInternal(
  spec: Spec,
  optsOrSeed?: CompileOptions | number,
): { result: CompileResult; archive: BestArchive } {
  const opts = normalizeCompileOptions(spec, optsOrSeed);
  const normalized = normalizeSpec(spec, opts.seed);
  const stats = new CompileStatsBuilder(opts.budget.kind === "work" ? opts.budget.units : null);
  const meter = new WorkMeter(opts.budget, stats);
  const archive = new BestArchive(stats);

  try {
    runSearchScheduler(normalized, meter, stats, archive);
  } catch (error) {
    if (!(error instanceof BudgetExhaustedError)) throw error;
  }
  if (opts.budget.kind === "work" && meter.unitsUsed >= Math.floor(opts.budget.units)) {
    stats.markBudgetExhausted();
  }

  const fallbackTrack = buildTrackJson([], normalized.durationFrames + 20, normalized.startState, "v1-fallback");
  const fallbackCandidateKey = {
    specHash: normalized.specHash,
    seed: normalized.seed,
    gapIndex: -1,
    prefixHash: "fallback",
    stream: "coverage" as const,
    ordinal: 0,
  };
  const fallbackCandidate = evaluateTrackJson(
    fallbackTrack,
    normalized,
    fallbackCandidateKey,
    meter,
    stats,
  );

  archive.consider(fallbackCandidate);

  const best = archive.best;
  if (best === null) {
    stats.markNoContractCandidateFound();
    return {
      result: {
        track: fallbackCandidate.track,
        report: fallbackCandidate.report,
        stats: stats.snapshot(),
      },
      archive,
    };
  }

  return {
    result: {
      track: best.track,
      report: best.report,
      stats: stats.snapshot(),
    },
    archive,
  };
}

type RecoveryPrefix = {
  fits: (GapFit | null)[];
  gapIndex: number;
  cumulativeCost: number;
  prefixHash: string;
  candidateCursorByGap: Map<number, number>;
};

type CoverageSearchState = {
  fits: (GapFit | null)[];
  candidateLists: (GapFit[] | null)[];
  generatedOrdinals: number[];
  cursors: number[];
  prefixEngineCache: Map<string, WorkMeteredEngine>;
  prefixValidationRetries: Map<number, number>;
  finalValidationRetries: Map<number, number>;
  gapIndex: number;
  ordinalLimit: number;
  finished: boolean;
};

type RecoveryFrontierState = {
  enabled: boolean;
  prefixEngineCache: Map<string, WorkMeteredEngine>;
  frontier: RecoveryPrefix[];
};

function runSearchScheduler(
  context: NormalizedSpecContext,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  archive: BestArchive,
): void {
  const coverage = createCoverageSearchState(context);
  const recovery = createRecoveryFrontierState(context);
  const scheduler = createDeterministicEpochScheduler();

  while (meter.canSpendOne() && (!coverage.finished || recovery.frontier.length > 0)) {
    const before = meter.unitsUsed;
    const action = scheduler.nextAction({
      coverageActive: !coverage.finished,
      recoveryActive: recovery.frontier.length > 0,
    });
    if (action === null) break;

    if (action.kind === "RunCoverageEpoch") {
      runCoverageSearchEpoch(context, coverage, COVERAGE_EPOCH_WORK_UNITS, meter, stats, archive);
    } else {
      runRecoveryFrontierEpoch(context, recovery, RECOVERY_EPOCH_WORK_UNITS, meter, stats, archive);
    }
    if (meter.unitsUsed === before) break;
  }
}

function createCoverageSearchState(context: NormalizedSpecContext): CoverageSearchState {
  return {
    fits: new Array(context.gaps.length).fill(null),
    candidateLists: new Array(context.gaps.length).fill(null),
    generatedOrdinals: new Array(context.gaps.length).fill(0),
    cursors: new Array(context.gaps.length).fill(0),
    prefixEngineCache: new Map(),
    prefixValidationRetries: new Map(),
    finalValidationRetries: new Map(),
    gapIndex: 0,
    ordinalLimit: ORDINAL_PHASE_SIZE,
    finished: false,
  };
}

function createRecoveryFrontierState(context: NormalizedSpecContext): RecoveryFrontierState {
  if (!shouldRunRecoveryFrontier(context)) {
    return { enabled: false, prefixEngineCache: new Map(), frontier: [] };
  }
  return {
    enabled: true,
    prefixEngineCache: new Map(),
    frontier: [{
    fits: new Array(context.gaps.length).fill(null),
    gapIndex: 0,
    cumulativeCost: 0,
    prefixHash: "root",
    candidateCursorByGap: new Map(),
    }],
  };
}

function runRecoveryFrontierEpoch(
  context: NormalizedSpecContext,
  state: RecoveryFrontierState,
  maxWorkUnits: number,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  archive: BestArchive,
): void {
  if (!state.enabled || !meter.canSpendOne()) return;

  const startUnits = meter.unitsUsed;
  while (
    state.frontier.length > 0
    && meter.canSpendOne()
    && meter.unitsUsed - startUnits < maxWorkUnits
  ) {
    state.frontier.sort(compareRecoveryPrefixes);
    const prefix = state.frontier.shift()!;
    stats.recordRecoveryPromotion();

    const contactGapIndex = nextContactGapIndex(context, prefix.gapIndex);
    if (contactGapIndex === null) {
      considerCompleteFits(context, prefix.fits, meter, stats, archive);
      continue;
    }

    const batch = generateCandidateBatch(
      context,
      contactGapIndex,
      prefix.fits,
      recoveryCursorFor(prefix, contactGapIndex),
      Math.min(
        RECOVERY_FRONTIER_CANDIDATE_ATTEMPTS,
        RECOVERY_FRONTIER_MAX_ORDINALS_PER_PREFIX - recoveryCursorFor(prefix, contactGapIndex),
      ),
      state.prefixEngineCache,
      meter,
      stats,
    );
    requeueRecoveryPrefixWithAdvancedCursor(
      state.frontier,
      prefix,
      contactGapIndex,
      batch.attempted,
    );
    const accepted = batch.accepted.slice(0, RECOVERY_FRONTIER_CHILDREN_PER_PREFIX);
    for (const fit of accepted) {
      const childFits = prefix.fits.slice();
      childFits[contactGapIndex] = fit;
      const childCursors = new Map(prefix.candidateCursorByGap);
      childCursors.delete(contactGapIndex);
      const child: RecoveryPrefix = {
        fits: childFits,
        gapIndex: contactGapIndex + 1,
        cumulativeCost: prefix.cumulativeCost + fit.cost,
        prefixHash: prefixHashFor(childFits, contactGapIndex + 1),
        candidateCursorByGap: childCursors,
      };
      state.frontier.push(child);
    }
    state.frontier.sort(compareRecoveryPrefixes);
    if (state.frontier.length > RECOVERY_FRONTIER_MAX_STATES) {
      state.frontier.length = RECOVERY_FRONTIER_MAX_STATES;
    }
  }
}

function recoveryCursorFor(prefix: RecoveryPrefix, gapIndex: number): number {
  return prefix.candidateCursorByGap.get(gapIndex) ?? 0;
}

function requeueRecoveryPrefixWithAdvancedCursor(
  frontier: RecoveryPrefix[],
  prefix: RecoveryPrefix,
  gapIndex: number,
  attempted: number,
): void {
  if (attempted <= 0) return;
  const nextCursor = recoveryCursorFor(prefix, gapIndex) + attempted;
  if (nextCursor >= RECOVERY_FRONTIER_MAX_ORDINALS_PER_PREFIX) return;
  const candidateCursorByGap = new Map(prefix.candidateCursorByGap);
  candidateCursorByGap.set(gapIndex, nextCursor);
  frontier.push({
    ...prefix,
    fits: prefix.fits.slice(),
    candidateCursorByGap,
  });
}

function shouldRunRecoveryFrontier(context: NormalizedSpecContext): boolean {
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  if (!dense || context.contactFrames.length < 8) return false;
  const firstContactGap = context.gaps.find((gap) => gap.endsWithContact);
  const targets = firstContactGap?.targets ?? {};
  return (targets.air ?? 0) >= 0.65 || (targets.speed ?? 0) >= 0.7;
}

function compareRecoveryPrefixes(a: RecoveryPrefix, b: RecoveryPrefix): number {
  if (a.gapIndex !== b.gapIndex) return b.gapIndex - a.gapIndex;
  if (a.cumulativeCost !== b.cumulativeCost) return a.cumulativeCost - b.cumulativeCost;
  if (a.prefixHash !== b.prefixHash) return a.prefixHash < b.prefixHash ? -1 : 1;
  return compareRecoveryCursors(a.candidateCursorByGap, b.candidateCursorByGap);
}

function compareRecoveryCursors(a: ReadonlyMap<number, number>, b: ReadonlyMap<number, number>): number {
  const aEntries = [...a.entries()].sort((x, y) => x[0] - y[0]);
  const bEntries = [...b.entries()].sort((x, y) => x[0] - y[0]);
  const length = Math.min(aEntries.length, bEntries.length);
  for (let index = 0; index < length; index++) {
    const [aGap, aCursor] = aEntries[index];
    const [bGap, bCursor] = bEntries[index];
    if (aGap !== bGap) return aGap - bGap;
    if (aCursor !== bCursor) return aCursor - bCursor;
  }
  return aEntries.length - bEntries.length;
}

function runCoverageSearchEpoch(
  context: NormalizedSpecContext,
  state: CoverageSearchState,
  maxWorkUnits: number,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  archive: BestArchive,
): void {
  if (!meter.canSpendOne() || state.finished) return;

  const startUnits = meter.unitsUsed;
  while (
    state.gapIndex >= 0
    && state.gapIndex <= context.gaps.length
    && meter.unitsUsed - startUnits < maxWorkUnits
  ) {
    if (!meter.canSpendOne()) return;

    if (state.gapIndex === context.gaps.length) {
      const retryFrom = considerCompleteFits(
        context,
        state.fits,
        meter,
        stats,
        archive,
        state.finalValidationRetries,
      );
      state.gapIndex = backtrackToNextAlternative(
        context,
        state.fits,
        state.candidateLists,
        state.cursors,
        retryFrom ?? state.gapIndex - 1,
        stats,
      );
      continue;
    }

    const gap = context.gaps[state.gapIndex];
    if (!gap.endsWithContact) {
      state.fits[state.gapIndex] = null;
      state.gapIndex++;
      continue;
    }

    ensureCandidateList(
      context,
      state.gapIndex,
      state.fits,
      state.candidateLists,
      state.generatedOrdinals,
      state.cursors,
      state.prefixEngineCache,
      state.ordinalLimit,
      meter,
      stats,
    );

    const list = state.candidateLists[state.gapIndex] ?? [];
    if (state.cursors[state.gapIndex] < list.length) {
      const fit = list[state.cursors[state.gapIndex]++];
      state.fits[state.gapIndex] = fit;
      stats.recordGapCommit(fit.cost, state.gapIndex);
      clearSuffix(
        state.gapIndex + 1,
        state.fits,
        state.candidateLists,
        state.generatedOrdinals,
        state.cursors,
      );
      const retryFrom = prefixValidationRetryFrom(
        context,
        state.fits,
        state.gapIndex,
        state.prefixEngineCache,
        state.prefixValidationRetries,
        meter,
        stats,
      );
      if (retryFrom !== null) {
        state.fits[retryFrom] = null;
        clearSuffix(
          retryFrom + 1,
          state.fits,
          state.candidateLists,
          state.generatedOrdinals,
          state.cursors,
        );
        stats.recordValidationRetry(retryFrom);
        state.gapIndex = retryFrom;
        continue;
      }
      state.gapIndex++;
      continue;
    }

    state.gapIndex = backtrackToNextAlternative(
      context,
      state.fits,
      state.candidateLists,
      state.cursors,
      state.gapIndex - 1,
      stats,
    );
    if (state.gapIndex < 0 && state.ordinalLimit < MAX_COVERAGE_ORDINALS_PER_PREFIX) {
      state.ordinalLimit = Math.min(MAX_COVERAGE_ORDINALS_PER_PREFIX, state.ordinalLimit + ORDINAL_PHASE_SIZE);
      state.gapIndex = 0;
      stats.recordRecoveryPromotion();
    }
  }
  if (state.gapIndex < 0 || state.gapIndex > context.gaps.length) {
    state.finished = true;
  }
}

function prefixValidationRetryFrom(
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  committedGapIndex: number,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  retries: Map<number, number>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): number | null {
  if (!shouldRunRecoveryFrontier(context)) return null;
  const gap = context.gaps[committedGapIndex];
  if (!gap.endsWithContact) return null;
  const retryCount = retries.get(committedGapIndex) ?? 0;
  if (retryCount >= PREFIX_VALIDATION_RETRIES_PER_GAP) return null;

  const contactsToCheck = context.contactFrames.filter((frame) => frame <= gap.endFrame);
  if (contactsToCheck.length === 0) return null;

  const prefixEnd = committedGapIndex + 1;
  const prefixLines = collectLines(fits, prefixEnd);
  const prefixHash = prefixHashFor(fits, prefixEnd);
  const engine = engineForPrefix(prefixHash, prefixLines, context, prefixEngineCache, meter, stats);
  const horizon = gap.endFrame + 6;
  const det = detectWindow(engine.raw(), 0, horizon, stats);
  const owners = new Set<number>();

  for (const event of det.events) {
    if (event.type !== "landing") continue;
    const nearAnyContact = contactsToCheck.some((frame) => Math.abs(frame - event.frame) <= 1);
    if (nearAnyContact) continue;
    for (const lineId of contactLineIdsAt(det, event.frame)) {
      const owner = findGapOwning(lineId, fits);
      if (owner >= 0 && owner <= committedGapIndex) owners.add(owner);
    }
  }

  addMissedContactRetryOwners(owners, det, context, fits, contactsToCheck, committedGapIndex);
  for (const owner of [...owners]) {
    if (owner > committedGapIndex) owners.delete(owner);
  }
  if (owners.size === 0) return null;

  retries.set(committedGapIndex, retryCount + 1);
  return Math.min(...owners);
}

function addMissedContactRetryOwners(
  owners: Set<number>,
  det: ReturnType<typeof detectWindow>,
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  contactFrames: readonly number[],
  committedGapIndex: number,
): void {
  for (const frame of contactFrames) {
    const hasLanding = det.events.some(
      (event) => event.type === "landing" && Math.abs(event.frame - frame) <= 1,
    );
    if (hasLanding) continue;

    const before = owners.size;
    addContactLineOwners(owners, det, fits, frame, 1, committedGapIndex);
    if (owners.size > before) continue;

    const nearest = nearestLanding(det, frame, 5);
    if (nearest !== null) {
        addContactLineOwners(owners, det, fits, nearest.frame, 0, committedGapIndex);
      if (owners.size > before) continue;
    }

    const gapIndex = context.gaps.findIndex((gap) => gap.contactFrame === frame);
    if (gapIndex >= 0 && gapIndex <= committedGapIndex) owners.add(gapIndex);
  }
}

function addContactLineOwners(
  owners: Set<number>,
  det: ReturnType<typeof detectWindow>,
  fits: readonly (GapFit | null)[],
  frame: number,
  radius: number,
  committedGapIndex: number,
): void {
  for (let current = frame - radius; current <= frame + radius; current++) {
    for (const lineId of contactLineIdsAt(det, current)) {
      const owner = findGapOwning(lineId, fits);
      if (owner >= 0 && owner <= committedGapIndex) owners.add(owner);
    }
  }
}

function nearestLanding(
  det: ReturnType<typeof detectWindow>,
  frame: number,
  radius: number,
): { frame: number } | null {
  let best: { frame: number } | null = null;
  let bestDistance = Infinity;
  for (const event of det.events) {
    if (event.type !== "landing") continue;
    const distance = Math.abs(event.frame - frame);
    if (distance > radius || distance >= bestDistance) continue;
    best = { frame: event.frame };
    bestDistance = distance;
  }
  return best;
}

function findGapOwning(lineId: number, fits: readonly (GapFit | null)[]): number {
  for (let index = 0; index < fits.length; index++) {
    const fit = fits[index];
    if (fit?.lines.some((line) => line.id === lineId)) return index;
  }
  return -1;
}

function ensureCandidateList(
  context: NormalizedSpecContext,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
  candidateLists: (GapFit[] | null)[],
  generatedOrdinals: number[],
  cursors: number[],
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  ordinalLimit: number,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): void {
  if (candidateLists[gapIndex] === null) {
    candidateLists[gapIndex] = [];
    generatedOrdinals[gapIndex] = 0;
    cursors[gapIndex] = 0;
  }

  preloadDenseCandidateList(
    context,
    gapIndex,
    fits,
    candidateLists,
    generatedOrdinals,
    prefixEngineCache,
    ordinalLimit,
    meter,
    stats,
  );

  while (
    (candidateLists[gapIndex]?.length ?? 0) <= cursors[gapIndex]
    && generatedOrdinals[gapIndex] < ordinalLimit
  ) {
    const batch = generateCandidateBatch(
      context,
      gapIndex,
      fits,
      generatedOrdinals[gapIndex],
      Math.min(
        candidateBatchSizeForGap(context, gapIndex),
        ordinalLimit - generatedOrdinals[gapIndex],
      ),
      prefixEngineCache,
      meter,
      stats,
    );
    generatedOrdinals[gapIndex] += batch.attempted;
    candidateLists[gapIndex]!.push(...batch.accepted);
    candidateLists[gapIndex]!.sort(compareDenseLookaheadFits);
  }
}

function preloadDenseCandidateList(
  context: NormalizedSpecContext,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
  candidateLists: (GapFit[] | null)[],
  generatedOrdinals: number[],
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  ordinalLimit: number,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): void {
  if (!shouldPreloadDenseGap(context, gapIndex)) return;
  const list = candidateLists[gapIndex];
  if (list === null) return;

  const cap = Math.min(DENSE_INITIAL_MAX_ATTEMPTS, ordinalLimit);
  while (
    generatedOrdinals[gapIndex] < cap
    && (
      generatedOrdinals[gapIndex] < DENSE_INITIAL_MIN_ATTEMPTS
      || list.length < DENSE_INITIAL_MIN_SURVIVORS
    )
  ) {
    const batch = generateCandidateBatch(
      context,
      gapIndex,
      fits,
      generatedOrdinals[gapIndex],
      Math.min(
        candidateBatchSizeForGap(context, gapIndex),
        cap - generatedOrdinals[gapIndex],
      ),
      prefixEngineCache,
      meter,
      stats,
    );
    generatedOrdinals[gapIndex] += batch.attempted;
    list.push(...batch.accepted);
    list.sort(compareDenseLookaheadFits);
  }
}

function shouldPreloadDenseGap(context: NormalizedSpecContext, gapIndex: number): boolean {
  const gap = context.gaps[gapIndex];
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  const short = gap.endFrame - gap.startFrame <= 12;
  const highPressure = (gap.targets.air ?? 0) >= 0.65 || (gap.targets.speed ?? 0) >= 0.7;
  return dense && short && highPressure;
}

function candidateBatchSizeForGap(context: NormalizedSpecContext, gapIndex: number): number {
  const targets = context.gaps[gapIndex].targets;
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  const highPressure = (targets.air ?? 0) >= 0.65 || (targets.speed ?? 0) >= 0.7;
  if (dense && highPressure && isDenseAirSwingSpec(context)) {
    return AIR_SWING_DENSE_CANDIDATE_BATCH_SIZE;
  }
  if (dense && highPressure) return DENSE_CANDIDATE_BATCH_SIZE;
  if ((targets.air ?? 0.5) <= 0.4 || (targets.speed ?? 0.5) <= 0.45) {
    return LOW_ENERGY_CANDIDATE_BATCH_SIZE;
  }
  return DEFAULT_CANDIDATE_BATCH_SIZE;
}

function isDenseAirSwingSpec(context: NormalizedSpecContext): boolean {
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  if (!dense || context.sectionWindows.length < 2) return false;
  const airValues = context.sectionWindows
    .map((section) => section.axes.air)
    .filter((value): value is number => value !== undefined);
  if (airValues.length < 2 || range(airValues) < 0.5) return false;

  for (const axis of ["speed", "grain", "contact_style"] as const) {
    const values = context.sectionWindows.map((section) => section.axes[axis]);
    const defined = values.filter((value): value is number => value !== undefined);
    if (defined.length === 0) continue;
    if (defined.length !== context.sectionWindows.length) return false;
    if (range(defined) > 0.05) return false;
  }
  return true;
}

function range(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function generateCandidateBatch(
  context: NormalizedSpecContext,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
  startOrdinal: number,
  count: number,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): { attempted: number; accepted: GapFit[] } {
  const prefixLines = collectLines(fits, gapIndex);
  const prefixHash = prefixHashFor(fits, gapIndex);
  const baseEngine = engineForPrefix(prefixHash, prefixLines, context, prefixEngineCache, meter, stats);
  const lineIdStart = nextLineIdFor(fits, gapIndex);
  const searchTargets = shouldUseResidualTargets(context)
    ? residualSearchTargetsForGap(context, baseEngine, gapIndex, fits, stats)
    : undefined;
  const accepted: GapFit[] = [];

  for (let offset = 0; offset < count; offset++) {
    const ordinal = startOrdinal + offset;
    const result = evaluateGapCandidate({
      context,
      baseEngine,
      gap: context.gaps[gapIndex],
      prefixHash,
      ...candidateStreamForAttempt(context, gapIndex, ordinal),
      lineIdStart,
      ...(searchTargets === undefined ? {} : { searchTargets }),
      stats,
    });
    if (result.kind === "accepted") accepted.push(result.fit);
  }

  accepted.sort(compareGapFits);
  applyDenseLookaheadRanking(
    context,
    gapIndex,
    fits,
    accepted,
    prefixEngineCache,
    meter,
    stats,
  );
  return { attempted: count, accepted };
}

function residualSearchTargetsForGap(
  context: NormalizedSpecContext,
  baseEngine: WorkMeteredEngine,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
  stats: CompileStatsBuilder,
): SectionAxes | undefined {
  const gap = context.gaps[gapIndex];
  const out: SectionAxes = {};
  const airTarget = residualAirTargetForGap(context, baseEngine, gap, stats);
  if (airTarget !== undefined) out.air = airTarget;
  const grainTarget = residualGrainTargetForGap(context, gapIndex, fits);
  if (grainTarget !== undefined) out.grain = grainTarget;
  return Object.keys(out).length === 0 ? undefined : { ...gap.targets, ...out };
}

function shouldUseResidualTargets(context: NormalizedSpecContext): boolean {
  return context.contactFrames.length * 40 <= context.durationFrames;
}

function residualAirTargetForGap(
  context: NormalizedSpecContext,
  baseEngine: WorkMeteredEngine,
  gap: NormalizedSpecContext["gaps"][number],
  stats: CompileStatsBuilder,
): number | undefined {
  const section = sectionWithAxisAtFrame(context, gap.endFrame, "air");
  if (section === null || section.axes.air === undefined) return undefined;
  if (gap.startFrame > section.endFrame) return undefined;

  const prefixEnd = Math.min(gap.startFrame - 1, section.endFrame);
  if (prefixEnd < section.startFrame) return undefined;

  const det = detectWindow(baseEngine.raw(), section.startFrame, prefixEnd, stats);
  let air = 0;
  let total = 0;
  for (let frame = section.startFrame; frame <= prefixEnd; frame++) {
    const airborne = airborneAt(det, frame);
    if (airborne === undefined) continue;
    if (airborne) air++;
    total++;
  }
  if (total <= 0) return undefined;

  const totalFrames = section.endFrame - section.startFrame + 1;
  const remainingFrames = Math.max(1, section.endFrame - gap.startFrame + 1);
  const neededAirFrames = section.axes.air * totalFrames - air;
  const neededMean = clamp(neededAirFrames / remainingFrames, 0, 0.99);
  const current = gap.targets.air ?? section.axes.air;
  const residualPressure = Math.min(1, Math.abs(section.axes.air - 0.5) * 2);
  const gain = AIR_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 0.99);
}

function residualGrainTargetForGap(
  context: NormalizedSpecContext,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
): number | undefined {
  const gap = context.gaps[gapIndex];
  const section = sectionWithAxisAtFrame(context, gap.endFrame, "grain");
  if (section === null || section.axes.grain === undefined) return undefined;

  let total = 0;
  let prefixCount = 0;
  let prefixSum = 0;
  for (let index = 0; index < context.gaps.length; index++) {
    const currentGap = context.gaps[index];
    if (!currentGap.endsWithContact) continue;
    if (currentGap.endFrame < section.startFrame || currentGap.endFrame > section.endFrame) continue;
    total++;
    if (index >= gapIndex) continue;
    const fit = fits[index];
    if (fit === null) continue;
    prefixSum += measureFitGrain(fit);
    prefixCount++;
  }
  if (prefixCount <= 0 || total <= prefixCount) return undefined;

  const remaining = total - prefixCount;
  const neededMean = clamp((section.axes.grain * total - prefixSum) / remaining, 0, 1);
  const current = gap.targets.grain ?? section.axes.grain;
  const residualPressure = Math.min(1, Math.abs(neededMean - current) / 0.25);
  const gain = GRAIN_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 1);
}

function sectionWithAxisAtFrame(
  context: NormalizedSpecContext,
  frame: number,
  axis: keyof SectionAxes,
): NormalizedSpecContext["sectionWindows"][number] | null {
  let out: NormalizedSpecContext["sectionWindows"][number] | null = null;
  for (const section of context.sectionWindows) {
    if (section.axes[axis] === undefined) continue;
    if (section.startFrame <= frame && section.endFrame >= frame) out = section;
  }
  return out;
}

function applyDenseLookaheadRanking(
  context: NormalizedSpecContext,
  gapIndex: number,
  fits: readonly (GapFit | null)[],
  accepted: GapFit[],
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): void {
  if (!shouldUseDenseLookahead(context, gapIndex) || accepted.length <= 1) return;
  if (DENSE_LOOKAHEAD_FIT_LIMIT <= 0) return;
  const nextGapIndex = nextContactGapIndex(context, gapIndex + 1);
  if (nextGapIndex === null) return;

  const limit = Math.min(DENSE_LOOKAHEAD_FIT_LIMIT, accepted.length);
  for (let index = 0; index < limit; index++) {
    const candidate = accepted[index];
    const lookaheadFits = fits.slice();
    lookaheadFits[gapIndex] = candidate;
    const prefixLines = collectLines(lookaheadFits, nextGapIndex);
    const prefixHash = prefixHashFor(lookaheadFits, nextGapIndex);
    const baseEngine = engineForPrefix(prefixHash, prefixLines, context, prefixEngineCache, meter, stats);
    const lineIdStart = nextLineIdFor(lookaheadFits, nextGapIndex);
    let survivors = 0;
    let bestCost = Infinity;
    for (let attempt = 0; attempt < DENSE_LOOKAHEAD_ATTEMPTS; attempt++) {
      const result = evaluateGapCandidate({
        context,
        baseEngine,
        gap: context.gaps[nextGapIndex],
        prefixHash,
        ...candidateStreamForAttempt(context, nextGapIndex, attempt),
        lineIdStart,
        stats,
      });
      if (result.kind !== "accepted") continue;
      survivors++;
      bestCost = Math.min(bestCost, result.fit.cost);
    }
    candidate.lookaheadSurvivors = survivors;
    candidate.lookaheadBestCost = bestCost;
  }

  accepted.sort(compareDenseLookaheadFits);
}

function compareDenseLookaheadFits(a: GapFit, b: GapFit): number {
  const aSurvivors = a.lookaheadSurvivors ?? -1;
  const bSurvivors = b.lookaheadSurvivors ?? -1;
  const aHas = aSurvivors > 0 ? 1 : 0;
  const bHas = bSurvivors > 0 ? 1 : 0;
  if (aHas !== bHas) return bHas - aHas;
  if (aHas > 0 && aSurvivors !== bSurvivors) return bSurvivors - aSurvivors;
  if (aHas > 0 && (a.lookaheadBestCost ?? Infinity) !== (b.lookaheadBestCost ?? Infinity)) {
    return (a.lookaheadBestCost ?? Infinity) - (b.lookaheadBestCost ?? Infinity);
  }
  return compareGapFits(a, b);
}

function shouldUseDenseLookahead(context: NormalizedSpecContext, gapIndex: number): boolean {
  const gap = context.gaps[gapIndex];
  const nextIndex = nextContactGapIndex(context, gapIndex + 1);
  if (nextIndex === null) return false;
  const nextGap = context.gaps[nextIndex];
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  const shortNext = nextGap.endFrame - gap.endFrame <= 16;
  const highPressure = (gap.targets.air ?? 0) >= 0.65 || (gap.targets.speed ?? 0) >= 0.7;
  return dense && shortNext && highPressure;
}

function nextContactGapIndex(context: NormalizedSpecContext, startIndex: number): number | null {
  for (let index = startIndex; index < context.gaps.length; index++) {
    if (context.gaps[index].endsWithContact) return index;
  }
  return null;
}

function engineForPrefix(
  prefixHash: string,
  prefixLines: readonly TrackLine[],
  context: NormalizedSpecContext,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): WorkMeteredEngine {
  const cached = prefixEngineCache.get(prefixHash);
  if (cached !== undefined) return cached;
  const engine = rebuildEngineFromLines(prefixLines, context.startState, meter, stats);
  rememberPrefixEngine(
    prefixEngineCache,
    prefixHash,
    engine,
    prefixEngineCacheLimitFor(context),
  );
  return engine;
}

function rememberPrefixEngine(
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  prefixHash: string,
  engine: WorkMeteredEngine,
  limit: number,
): void {
  if (limit <= 0) return;
  if (!prefixEngineCache.has(prefixHash) && prefixEngineCache.size >= limit) {
    const oldest = prefixEngineCache.keys().next().value as string | undefined;
    if (oldest !== undefined) prefixEngineCache.delete(oldest);
  }
  prefixEngineCache.set(prefixHash, engine);
}

function prefixEngineCacheLimitFor(context: NormalizedSpecContext): number {
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  return dense || context.contactFrames.length >= 40
    ? DENSE_PREFIX_ENGINE_CACHE_LIMIT
    : ORDINARY_PREFIX_ENGINE_CACHE_LIMIT;
}

function candidateStreamForAttempt(
  context: NormalizedSpecContext,
  gapIndex: number,
  attempt: number,
): { stream: CandidateStreamName; ordinal: number } {
  const gap = context.gaps[gapIndex];
  const dense = context.contactFrames.length * 40 > context.durationFrames;
  const highEnergy = (gap.targets.air ?? 0) >= 0.7 || (gap.targets.speed ?? 0) >= 0.75;
  if (!dense || !highEnergy) return { stream: "coverage", ordinal: attempt };
  if (attempt < DENSE_COVERAGE_ATTEMPTS) return { stream: "coverage", ordinal: attempt };

  const streams: CandidateStreamName[] = ["coverage", "recovery", "quality"];
  const shiftedAttempt = attempt - DENSE_COVERAGE_ATTEMPTS;
  return {
    stream: streams[shiftedAttempt % streams.length],
    ordinal: DENSE_COVERAGE_ATTEMPTS + Math.floor(shiftedAttempt / streams.length),
  };
}

function considerCompleteFits(
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  archive: BestArchive,
  finalValidationRetries?: Map<number, number>,
): number | null {
  const lines = collectLines(fits, fits.length);
  const track = buildTrackJson(lines, context.durationFrames + 20, context.startState);
  const candidateKey: CandidateKey = {
    specHash: context.specHash,
    seed: context.seed,
    gapIndex: context.gaps.length,
    prefixHash: prefixHashFor(fits, fits.length),
    stream: "coverage",
    ordinal: 0,
  };
  const candidate = evaluateTrackJson(track, context, candidateKey, meter, stats, fits);
  const archiveUpdated = archive.consider(candidate);
  const retryFrom = validationRetryGapIndex(
    candidate,
    context,
    fits,
    lines,
    meter,
    stats,
    finalValidationRetries,
  );
  if (retryFrom !== null) {
    stats.recordValidationRetry(retryFrom);
    return retryFrom;
  }

  for (const repairCandidate of evaluateSyncRepairCandidates(candidate, context, meter, stats)) {
    archive.consider(repairCandidate);
  }
  for (const retryCandidate of evaluateLocalizedRetryCandidates(candidate, context, meter, stats)) {
    archive.consider(retryCandidate);
  }
  if (archiveUpdated) {
    for (const retryCandidate of evaluateQualityRetryCandidates(candidate, context, meter, stats)) {
      archive.consider(retryCandidate);
    }
    for (const polishCandidate of evaluatePolishCandidates(candidate, context, meter, stats)) {
      archive.consider(polishCandidate);
    }
  }
  return null;
}

function evaluateQualityRetryCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): CompleteCandidate[] {
  if (!base.score.contract_passed || base.fits === undefined) return [];
  if (stats.snapshot().completed_candidates < QUALITY_RETRY_MIN_COMPLETED_CANDIDATES) return [];
  const worst = worstSectionAxisError(base);
  if (worst === null || worst.error < QUALITY_RETRY_MIN_AXIS_ERROR) return [];
  if (!meter.canSpendOne()) return [];

  const section = context.sectionWindows[worst.sectionIndex];
  if (section === undefined) return [];
  const startIndices = qualityRetryStartIndices(context, base.fits, section.startFrame, section.endFrame);
  if (startIndices.length === 0) return [];

  const out: CompleteCandidate[] = [];
  const prefixEngineCache = new Map<string, WorkMeteredEngine>();
  const seenTracks = new Set<string>();

  for (const startIndex of startIndices) {
    if (out.length >= QUALITY_RETRY_MAX_COMPLETIONS || !meter.canSpendOne()) break;
    const alternatives = qualityAlternativesForGap(
      context,
      base.fits,
      startIndex,
      prefixEngineCache,
      meter,
      stats,
    );
    const baseFit = base.fits[startIndex];
    const filtered = alternatives
      .filter((fit) => fit.geometryHash !== baseFit?.geometryHash)
      .slice(0, QUALITY_RETRY_START_ALTERNATIVES);

    for (let altIndex = 0; altIndex < filtered.length; altIndex++) {
      if (out.length >= QUALITY_RETRY_MAX_COMPLETIONS || !meter.canSpendOne()) break;
      const fits = base.fits.map((fit, index) => index < startIndex ? cloneGapFitOrNull(fit) : null);
      fits[startIndex] = cloneGapFitOrNull(filtered[altIndex]);
      const completed = greedyCompleteFrom(context, fits, startIndex + 1, prefixEngineCache, meter, stats);
      if (completed === null) continue;

      const track = buildTrackJson(collectLines(completed, completed.length), context.durationFrames + 20, context.startState);
      const trackKey = stableHash(track.lines);
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const candidateKey: CandidateKey = {
        specHash: context.specHash,
        seed: context.seed,
        gapIndex: context.gaps.length,
        prefixHash: stableHash(["quality-retry", base.trackHash, worst, startIndex, filtered[altIndex].candidateKey]),
        stream: "quality",
        ordinal: out.length,
      };
      out.push(evaluateTrackJson(track, context, candidateKey, meter, stats, completed));
    }
  }

  return out;
}

function worstSectionAxisError(candidate: CompleteCandidate): {
  sectionIndex: number;
  axis: string;
  error: number;
} | null {
  let worst: { sectionIndex: number; axis: string; error: number } | null = null;
  for (const section of candidate.report.sections) {
    for (const [axis, value] of Object.entries(section.axes)) {
      const error = Math.abs(value.error);
      if (
        worst === null
        || error > worst.error
        || (error === worst.error && section.section_index < worst.sectionIndex)
        || (error === worst.error && section.section_index === worst.sectionIndex && axis < worst.axis)
      ) {
        worst = { sectionIndex: section.section_index, axis, error };
      }
    }
  }
  return worst;
}

function qualityRetryStartIndices(
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  sectionStartFrame: number,
  sectionEndFrame: number,
): number[] {
  const entries: { index: number; cost: number }[] = [];
  for (let index = 0; index < context.gaps.length; index++) {
    const gap = context.gaps[index];
    const fit = fits[index];
    if (!gap.endsWithContact || fit === null) continue;
    if (gap.endFrame < sectionStartFrame || gap.endFrame > sectionEndFrame) continue;
    entries.push({ index, cost: fit.cost });
  }
  entries.sort((a, b) => {
    if (b.cost !== a.cost) return b.cost - a.cost;
    return a.index - b.index;
  });

  const starts = new Set<number>();
  for (const entry of entries.slice(0, 3)) {
    starts.add(Math.max(0, entry.index - 1));
    starts.add(entry.index);
  }
  return [...starts].sort((a, b) => a - b).slice(0, 4);
}

function qualityAlternativesForGap(
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  gapIndex: number,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): GapFit[] {
  if (!context.gaps[gapIndex]?.endsWithContact) return [];
  const retryFits = fits.slice(0, gapIndex);
  const batch = generateCandidateBatch(
    context,
    gapIndex,
    retryFits,
    0,
    QUALITY_RETRY_START_ATTEMPTS,
    prefixEngineCache,
    meter,
    stats,
  );
  return batch.accepted;
}

function evaluateSyncRepairCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): CompleteCandidate[] {
  if (base.score.contract_passed || base.track.lines.length === 0) return [];
  if (base.score.died > 0) return [];
  const syncFailures = base.score.missing + base.score.off_beat_landings;
  if (base.score.missing <= 0 || syncFailures > 6) return [];
  if (!meter.canSpendOne()) return [];

  const engine = rebuildEngineFromLines(base.track.lines, context.startState, meter, stats);
  const det = detectFull(engine.raw(), context.durationFrames + 20, stats);
  const proposals: { lineIds: number[]; mode: "forward" | "both" | "long" }[] = [];
  const implicated = new Set<number>();
  const seen = new Set<string>();
  const out: CompleteCandidate[] = [];
  const missingFrames = base.report.contacts
    .filter((contact) => contact.status === "missing")
    .map((contact) => Math.round(contact.t_target * 40));

  for (const insertion of trackWithInsertedLandingLines(base.track, context, missingFrames, meter, stats)) {
    const ordinal = out.length;
    const candidateKey: CandidateKey = {
      specHash: context.specHash,
      seed: context.seed,
      gapIndex: context.gaps.length,
      prefixHash: stableHash(["sync-insert", base.trackHash, insertion.variant]),
      stream: "recovery",
      ordinal,
    };
    out.push(evaluateTrackJson(insertion.track, context, candidateKey, meter, stats, base.fits));
  }

  for (const contact of base.report.contacts) {
    if (contact.status === "hit") continue;
    const frame = Math.round(contact.t_target * 40);
    const contactIds = new Set<number>();
    for (let current = frame - 1; current <= frame + 1; current++) {
      for (const lineId of contactLineIdsAt(det, current)) {
        contactIds.add(lineId);
      }
    }
    if (contactIds.size === 0) {
      const nearest = nearestLanding(det, frame, 12);
      if (nearest !== null) {
        for (const lineId of contactLineIdsAt(det, nearest.frame)) contactIds.add(lineId);
      }
    }
    for (const lineId of contactIds) {
      implicated.add(lineId);
      for (const mode of ["forward", "both", "long"] as const) {
        const key = `${lineId}:${mode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        proposals.push({ lineIds: [lineId], mode });
      }
    }
  }

  const allLineIds = [...implicated].sort((a, b) => a - b);
  const transformOrdinals = out.length;
  let transformCount = 0;
  for (const transformed of syncTrimAndRemovalCandidates(base.track, allLineIds)) {
    if (!meter.canSpendOne()) break;
    const candidateKey: CandidateKey = {
      specHash: context.specHash,
      seed: context.seed,
      gapIndex: context.gaps.length,
      prefixHash: stableHash(["sync-transform", base.trackHash, transformed.variant]),
      stream: "recovery",
      ordinal: transformOrdinals + transformCount,
    };
    out.push(evaluateTrackJson(transformed.track, context, candidateKey, meter, stats, base.fits));
    transformCount++;
    if (transformCount >= 24) break;
  }

  if (allLineIds.length > 1) {
    proposals.unshift({ lineIds: allLineIds, mode: "long" });
    proposals.unshift({ lineIds: allLineIds, mode: "both" });
  }

  const insertionOrdinals = out.length;
  for (let ordinal = 0; ordinal < proposals.length && ordinal < 18; ordinal++) {
    if (!meter.canSpendOne()) break;
    const proposal = proposals[ordinal];
    const repaired = trackWithExtendedLines(base.track, proposal.lineIds, proposal.mode);
    if (repaired === null) continue;
    const candidateKey: CandidateKey = {
      specHash: context.specHash,
      seed: context.seed,
      gapIndex: context.gaps.length,
      prefixHash: stableHash(["sync-repair", base.trackHash, proposal.lineIds, proposal.mode]),
      stream: "recovery",
      ordinal: insertionOrdinals + ordinal,
    };
    out.push(evaluateTrackJson(repaired, context, candidateKey, meter, stats, base.fits));
  }
  return out;
}

function evaluateLocalizedRetryCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): CompleteCandidate[] {
  if (base.score.contract_passed || base.fits === undefined) return [];
  if (base.score.died > 0 || base.score.off_beat_landings > 0) return [];
  if (base.score.missing <= 0 || base.score.missing > LOCALIZED_RETRY_MAX_MISSING) return [];
  if (!meter.canSpendOne()) return [];

  const firstMissingFrame = firstMissingContactFrame(base);
  if (firstMissingFrame === null) return [];
  const missedGapIndex = context.gaps.findIndex((gap) => gap.contactFrame === firstMissingFrame);
  if (missedGapIndex < 0) return [];

  const startIndices = uniqueNumbers([
    Math.max(0, missedGapIndex - 1),
    missedGapIndex,
  ]);
  const out: CompleteCandidate[] = [];
  const prefixEngineCache = new Map<string, WorkMeteredEngine>();
  const seenTracks = new Set<string>();

  for (const startIndex of startIndices) {
    if (out.length >= LOCALIZED_RETRY_MAX_COMPLETIONS || !meter.canSpendOne()) break;
    const alternatives = localizedAlternativesForGap(
      context,
      base.fits,
      startIndex,
      prefixEngineCache,
      meter,
      stats,
    );
    const baseFit = base.fits[startIndex];
    const filtered = alternatives.filter((fit) => fit.geometryHash !== baseFit?.geometryHash)
      .slice(0, LOCALIZED_RETRY_START_ALTERNATIVES);

    for (let altIndex = 0; altIndex < filtered.length; altIndex++) {
      if (out.length >= LOCALIZED_RETRY_MAX_COMPLETIONS || !meter.canSpendOne()) break;
      const fits = base.fits.map((fit, index) => index < startIndex ? cloneGapFitOrNull(fit) : null);
      fits[startIndex] = cloneGapFitOrNull(filtered[altIndex]);
      const completed = greedyCompleteFrom(context, fits, startIndex + 1, prefixEngineCache, meter, stats);
      if (completed === null) continue;

      const track = buildTrackJson(collectLines(completed, completed.length), context.durationFrames + 20, context.startState);
      const trackKey = stableHash(track.lines);
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const candidateKey: CandidateKey = {
        specHash: context.specHash,
        seed: context.seed,
        gapIndex: context.gaps.length,
        prefixHash: stableHash(["localized-retry", base.trackHash, startIndex, filtered[altIndex].candidateKey]),
        stream: "recovery",
        ordinal: out.length,
      };
      out.push(evaluateTrackJson(track, context, candidateKey, meter, stats, completed));
    }
  }

  return out;
}

function localizedAlternativesForGap(
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  gapIndex: number,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): GapFit[] {
  if (!context.gaps[gapIndex]?.endsWithContact) return [];
  const retryFits = fits.slice(0, gapIndex);
  const batch = generateCandidateBatch(
    context,
    gapIndex,
    retryFits,
    0,
    LOCALIZED_RETRY_START_ATTEMPTS,
    prefixEngineCache,
    meter,
    stats,
  );
  return batch.accepted;
}

function greedyCompleteFrom(
  context: NormalizedSpecContext,
  fits: (GapFit | null)[],
  startIndex: number,
  prefixEngineCache: Map<string, WorkMeteredEngine>,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): (GapFit | null)[] | null {
  for (let gapIndex = startIndex; gapIndex < context.gaps.length; gapIndex++) {
    if (!meter.canSpendOne()) return null;
    const gap = context.gaps[gapIndex];
    if (!gap.endsWithContact) {
      fits[gapIndex] = null;
      continue;
    }
    const batch = generateCandidateBatch(
      context,
      gapIndex,
      fits,
      0,
      LOCALIZED_RETRY_ROLLOUT_ATTEMPTS,
      prefixEngineCache,
      meter,
      stats,
    );
    const fit = batch.accepted[0];
    if (fit === undefined) return null;
    fits[gapIndex] = cloneGapFitOrNull(fit);
  }
  return fits;
}

function firstMissingContactFrame(candidate: CompleteCandidate): number | null {
  for (const contact of candidate.report.contacts) {
    if (contact.status === "hit") continue;
    return Math.round(contact.t_target * 40);
  }
  return null;
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function cloneGapFitOrNull(fit: GapFit | null): GapFit | null {
  if (fit === null) return null;
  return {
    ...fit,
    candidateKey: { ...fit.candidateKey },
    lines: fit.lines.map((line) => ({ ...line })),
    achieved: { ...fit.achieved },
  };
}

function trackWithInsertedLandingLines(
  track: CompileResult["track"],
  context: NormalizedSpecContext,
  frames: readonly number[],
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): { track: CompileResult["track"]; variant: unknown }[] {
  if (frames.length === 0 || frames.length > 6 || !meter.canSpendOne()) return [];
  const variants = [
    { halfWidth: 8, yOffset: 0 },
    { halfWidth: 12, yOffset: 0 },
    { halfWidth: 8, yOffset: -1 },
    { halfWidth: 12, yOffset: -1 },
    { halfWidth: 8, yOffset: 1 },
    { halfWidth: 16, yOffset: 0 },
  ] as const;
  const out: { track: CompileResult["track"]; variant: unknown }[] = [];

  for (const variant of variants) {
    if (!meter.canSpendOne()) break;
    const lines = track.lines.map((line) => ({ ...line }));
    let engine = rebuildEngineFromLines(lines, context.startState, meter, stats);
    let nextId = lines.reduce((max, line) => Math.max(max, line.id), 0) + 1;
    for (const frame of frames) {
      const anchor = lowestSledPoint(engine.raw(), frame, stats);
      if (anchor === null) continue;
      const y = anchor.y + variant.yOffset;
      const line = makeSolidLine(
        nextId++,
        anchor.x - variant.halfWidth,
        y,
        anchor.x + variant.halfWidth,
        y,
      );
      lines.push(line);
      engine = addTrackLines(engine, [line]);
    }
    if (lines.length === track.lines.length) continue;
    out.push({
      variant: { frames: [...frames], ...variant },
      track: cloneTrackWithLines(track, "v1-sync-insert", lines),
    });
  }

  return out;
}

function lowestSledPoint(
  engine: any,
  frame: number,
  stats: CompileStatsBuilder,
): { x: number; y: number } | null {
  const rider = measuredGetRider(engine, frame, stats);
  let out: { x: number; y: number } | null = null;
  for (const name of ["PEG", "TAIL", "NOSE", "STRING"] as const) {
    const point = rider.get(name);
    const pos = point?.pos;
    if (pos === undefined) continue;
    if (out === null || pos.y > out.y) out = { x: pos.x, y: pos.y };
  }
  return out;
}

function cloneTrackWithLines(
  track: CompileResult["track"],
  label: string,
  lines: TrackLine[],
): CompileResult["track"] {
  return {
    ...track,
    label,
    riders: track.riders.map((rider) => ({
      ...rider,
      startPosition: { ...rider.startPosition },
      startVelocity: { ...rider.startVelocity },
    })),
    layers: track.layers.map((layer) => ({ ...layer })),
    lines,
  };
}

function trackWithExtendedLines(
  track: CompileResult["track"],
  lineIds: readonly number[],
  mode: "forward" | "both" | "long",
): CompileResult["track"] | null {
  const ids = new Set(lineIds);
  let changed = false;
  const lines = track.lines.map((line) => {
    if (!ids.has(line.id)) return { ...line };
    const extended = extendedLine(line, mode);
    if (extended === null) return { ...line };
    changed = true;
    return extended;
  });
  if (!changed) return null;
  return cloneTrackWithLines(track, "v1-sync-repair", lines);
}

function syncTrimAndRemovalCandidates(
  track: CompileResult["track"],
  lineIds: readonly number[],
): { track: CompileResult["track"]; variant: unknown }[] {
  const uniqueIds = [...new Set(lineIds)].sort((a, b) => a - b);
  const out: { track: CompileResult["track"]; variant: unknown }[] = [];
  const trimFractions = [0.15, 0.35, 0.55, 0.75] as const;

  for (const lineId of uniqueIds) {
    for (const fraction of trimFractions) {
      const trimmed = trackWithTrimmedLineStart(track, [lineId], fraction);
      if (trimmed !== null) {
        out.push({
          track: trimmed,
          variant: { kind: "trim_start", lineIds: [lineId], fraction },
        });
      }
    }
    const removed = trackWithoutLineIds(track, [lineId]);
    if (removed !== null) {
      out.push({
        track: removed,
        variant: { kind: "remove", lineIds: [lineId] },
      });
    }
  }

  if (uniqueIds.length > 1) {
    for (const fraction of [0.15, 0.35] as const) {
      const trimmed = trackWithTrimmedLineStart(track, uniqueIds, fraction);
      if (trimmed !== null) {
        out.push({
          track: trimmed,
          variant: { kind: "trim_start", lineIds: uniqueIds, fraction },
        });
      }
    }
  }

  return out;
}

function trackWithTrimmedLineStart(
  track: CompileResult["track"],
  lineIds: readonly number[],
  fraction: number,
): CompileResult["track"] | null {
  const ids = new Set(lineIds);
  let changed = false;
  const lines = track.lines.map((line) => {
    if (!ids.has(line.id)) return { ...line };
    const trimmed = trimLineStart(line, fraction);
    if (trimmed === null) return { ...line };
    changed = true;
    return trimmed;
  });
  return changed ? cloneTrackWithLines(track, "v1-sync-trim", lines) : null;
}

function trimLineStart(line: TrackLine, fraction: number): TrackLine | null {
  if (fraction <= 0 || fraction >= 1) return null;
  const x1 = line.x1 + (line.x2 - line.x1) * fraction;
  const y1 = line.y1 + (line.y2 - line.y1) * fraction;
  if (Math.hypot(line.x2 - x1, line.y2 - y1) < 1) return null;
  return { ...line, x1, y1 };
}

function trackWithoutLineIds(
  track: CompileResult["track"],
  lineIds: readonly number[],
): CompileResult["track"] | null {
  const ids = new Set(lineIds);
  const lines = track.lines.filter((line) => !ids.has(line.id)).map((line) => ({ ...line }));
  if (lines.length === track.lines.length) return null;
  return cloneTrackWithLines(track, "v1-sync-remove", lines);
}

function extendedLine(
  line: TrackLine,
  mode: "forward" | "both" | "long",
): TrackLine | null {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-9) return null;
  const ux = dx / len;
  const uy = dy / len;
  const forward = mode === "long" ? 36 : 18;
  const backward = mode === "forward" ? 0 : mode === "long" ? 18 : 10;
  return {
    ...line,
    x1: line.x1 - ux * backward,
    y1: line.y1 - uy * backward,
    x2: line.x2 + ux * forward,
    y2: line.y2 + uy * forward,
  };
}

function validationRetryGapIndex(
  candidate: ReturnType<typeof evaluateTrackJson>,
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[],
  lines: readonly TrackLine[],
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  retries = new Map<number, number>(),
): number | null {
  if (candidate.score.contract_passed) return null;
  if (candidate.score.died > 0) return null;
  if (stats.snapshot().completed_candidates < OWNER_RETRY_MIN_COMPLETED_CANDIDATES) return null;
  if (candidate.score.missing + candidate.score.off_beat_landings > OWNER_RETRY_MAX_SYNC_FAILURES) {
    return null;
  }

  const engine = rebuildEngineFromLines(lines, context.startState, meter, stats);
  const det = detectFull(engine.raw(), context.durationFrames + 20, stats);
  const owners = new Set<number>();

  for (const event of det.events) {
    if (event.type !== "landing") continue;
    const nearAnyContact = context.contactFrames.some((frame) => Math.abs(frame - event.frame) <= 1);
    if (nearAnyContact) continue;
    for (const lineId of contactLineIdsAt(det, event.frame)) {
      const owner = findGapOwning(lineId, fits);
      if (owner >= 0) owners.add(owner);
    }
  }

  addMissedContactRetryOwners(owners, det, context, fits, context.contactFrames, context.gaps.length - 1);
  const retryOwner = firstRetryableOwner(owners, retries);
  if (retryOwner !== null) return retryOwner;

  const firstOffBeat = candidate.report.off_beat_landings[0];
  if (firstOffBeat !== undefined) {
    const gapIndex = context.gaps.findIndex((gap) => gap.endFrame >= firstOffBeat.frame);
    const owner = gapIndex >= 0 ? gapIndex : context.gaps.length - 1;
    return markRetryableOwner(owner, retries);
  }

  if (candidate.report.terminus.reason !== "endOfSpec") {
    const gapIndex = context.gaps.findIndex((gap) => gap.endFrame >= candidate.report.terminus.frame);
    const owner = gapIndex >= 0 ? gapIndex : context.gaps.length - 1;
    return markRetryableOwner(owner, retries);
  }

  return markRetryableOwner(context.gaps.length - 1, retries);
}

function firstRetryableOwner(owners: ReadonlySet<number>, retries: Map<number, number>): number | null {
  const ordered = [...owners].sort((a, b) => a - b);
  for (const owner of ordered) {
    const marked = markRetryableOwner(owner, retries);
    if (marked !== null) return marked;
  }
  return null;
}

function markRetryableOwner(owner: number, retries: Map<number, number>): number | null {
  const count = retries.get(owner) ?? 0;
  if (count >= FINAL_VALIDATION_RETRIES_PER_GAP) return null;
  retries.set(owner, count + 1);
  return owner;
}

function backtrackToNextAlternative(
  context: NormalizedSpecContext,
  fits: (GapFit | null)[],
  candidateLists: (GapFit[] | null)[],
  cursors: readonly number[],
  fromGapIndex: number,
  stats: CompileStatsBuilder,
): number {
  for (let index = Math.min(fromGapIndex, context.gaps.length - 1); index >= 0; index--) {
    if (!context.gaps[index].endsWithContact) {
      fits[index] = null;
      continue;
    }
    fits[index] = null;
    const list = candidateLists[index];
    if (list !== null && cursors[index] < list.length) {
      clearSuffix(index + 1, fits, candidateLists, undefined, undefined);
      stats.recordGapBacktrack();
      return index;
    }
  }
  return -1;
}

function clearSuffix(
  startIndex: number,
  fits: (GapFit | null)[],
  candidateLists: (GapFit[] | null)[],
  generatedOrdinals?: number[],
  cursors?: number[],
): void {
  for (let index = startIndex; index < fits.length; index++) {
    fits[index] = null;
    candidateLists[index] = null;
    if (generatedOrdinals !== undefined) generatedOrdinals[index] = 0;
    if (cursors !== undefined) cursors[index] = 0;
  }
}

function collectLines(fits: readonly (GapFit | null)[], upTo: number): TrackLine[] {
  const lines: TrackLine[] = [];
  for (let index = 0; index < upTo; index++) {
    const fit = fits[index];
    if (fit !== null) lines.push(...fit.lines);
  }
  return lines;
}

function nextLineIdFor(fits: readonly (GapFit | null)[], upTo: number): number {
  let id = 1;
  for (let index = 0; index < upTo; index++) {
    id += fits[index]?.lines.length ?? 0;
  }
  return id;
}

function prefixHashFor(fits: readonly (GapFit | null)[], upTo: number): string {
  if (upTo <= 0) return "root";
  return stableHash(
    fits.slice(0, upTo).map((fit, index) => fit === null
      ? { index, empty: true }
      : {
        index,
        key: fit.candidateKey,
        geometryHash: fit.geometryHash,
      }),
  );
}
