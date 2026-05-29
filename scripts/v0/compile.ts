/**
 * v0 compiler — per-gap budget compilation.
 *
 * See ../../DESIGN.md § Per-gap budget compilation for the algorithm.
 * See ../../DECISIONS.md for the reasoning.
 *
 * Pipeline per call:
 *   1. Slice timeline into gaps at hard Contacts.
 *   2. Compute per-gap targets (cross-gap target sampling around section means).
 *   3. For each gap (head → tail), generate K candidate Arc placements via
 *      wide random parameter sampling; bisect anchor Y for Contact precision;
 *      filter by hard gate (survival, Contact ±1f, no off-beat landings in
 *      this gap's frame range); rank survivors by aggregate axis cost; commit
 *      the best. On exhaustion, bounded cross-gap backtrack (CALIB.BACKTRACK_DEPTH
 *      levels) or hard failure.
 *   4. Final-track validation. The per-gap hard gate only sees its own gap;
 *      a later gap's Arc can intercept the rider's path before its own target
 *      frame, or a previous Arc can keep the rider in contact through a target
 *      frame. After the main loop, simulate the full assembled track; any
 *      assembled-track sync failure identifies the owning gap (via line-id),
 *      which is re-entered with its next candidate. Bounded by
 *      CALIB.FINAL_VALIDATION_RETRIES.
 *   5. Assemble Track + DriftReport.
 *
 * v0 simplification (flagged in code, deferred per DECISIONS.md D30):
 *   - At most one catch Arc per gap, optionally followed by a short
 *     validated ride-out line for air-only targets. Multi-Arc gap sequences
 *     (energy-bleeding bouncers before the catch) deferred.
 */

import {
  detect, extractRawTrajectory,
  PERSISTENCE_FRAMES,
  type Detection, type DetEvent, type RawTrajectory,
} from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import type { TrackJson } from "../lib/primitive.ts";
import {
  type Spec, type Section, type SectionAxes,
  type TrackLine, type DriftReport, type Gap,
  type CompileStats,
  CALIB, FPS, START_DEFAULTS, PREROLL, secToFrame,
} from "./types.ts";
// Substrate: pure building blocks relocated to core/substrate.ts. compile.ts
// imports the full moved set back so its internal references resolve; the
// dependency direction is one-way (compile.ts → core/substrate.ts).
import {
  type ResolvedStart,
  type GapFit,
  validateSpec,
  validateStartSpec,
  validatePreroll,
  sliceTimeline,
  effectiveAxes,
  axesAtFrame,
  sampleGapTargets,
  gauss,
  clamp,
  median,
  makeBaseEngine,
  resolveStartState,
  buildTrackJson,
  buildDriftReport,
  measureAxisOverRange,
  measureFitGrain,
  engineLineFromTrackLine,
  engineLineSignature,
  engineLineCache,
  contactLineIdsAt,
  findGapOwning,
  offBeatLandingEvents,
  addMissedContactRetryOwners,
  addContactLineOwners,
  nearestLanding,
  frameOffset,
  measurementIndex,
  measurementLastFrame,
  airborneAt,
  speedAt,
  velocityAt,
} from "./core/substrate.ts";
// Candidate generation: the per-gap sampler / bisection / hard-gate cluster
// relocated to core/candidate.ts. compile.ts imports the full moved set back so
// its internal references (generateRankedCandidates, residual targeting, air
// polish) resolve; the dependency direction is one-way (compile.ts →
// core/candidate.ts).
import {
  detectWindow,
  makeAirPolishCandidates,
  generateRankedCandidates,
} from "./core/candidate.ts";
// Preroll-start optimization: relocated to core/preroll.ts. compile()'s entry
// loop calls `withOptimizedPrerollStart`; the dependency direction is one-way
// (compile.ts → core/preroll.ts).
import {
  withOptimizedPrerollStart,
} from "./core/preroll.ts";
// Polish subsystem + engine rebuild + the module-scoped start state relocated
// to core/polish.ts. compile() invokes the four polish entry helpers and the
// final-report `rebuildEngine`, primes the start state via
// `setRebuildStartState`, and folds the relocated engine-rebuild counter into
// `stats.engine_rebuilds`. The dependency direction is one-way (compile.ts →
// core/polish.ts); the optimizer imports these same symbols from core.
import {
  polishAirRideOut,
  polishAirContactEntry,
  polishAirBriefContacts,
  polishExcessContact,
  rebuildEngine,
  setRebuildStartState,
  getEngineRebuildCount,
  resetEngineRebuildCount,
} from "./core/polish.ts";

// Re-export the substrate types so existing importers of compile.ts that pull
// these (e.g. optimizer/polish.ts, optimizer/sample.ts) keep resolving.
export type { ResolvedStart, GapFit };

const AIR_RESIDUAL_TARGET_GAIN = 0.35;
const GRAIN_RESIDUAL_TARGET_GAIN = 0.15;

export type CompileResult = {
  track: TrackJson;
  report: DriftReport;
  stats: CompileStats;
};

// Module-local work counters. Reset at the top of every `compile()` call.
// `compile()` is not reentrant (the engine pools aren't either) and each
// golden worker thread imports its own copy of this module, so a single
// mutable state object is safe here.
const stats: CompileStats = {
  candidates_sampled: 0,
  engine_rebuilds: 0,
  gap_commits: 0,
  gap_backtracks: 0,
  validation_retries: 0,
  polish_iterations: 0,
  total_committed_cost: 0,
  committed_costs_per_gap: [],
  sim_frames: 0, // not tracked by the legacy compiler; lds compiler populates it
  budget_exhausted: false, // legacy compiler has no budget concept
};

function resetStats(): void {
  stats.candidates_sampled = 0;
  // `rebuildEngine` now lives in core/polish.ts and bumps a counter there;
  // reset it here and fold it back into stats at snapshot time.
  resetEngineRebuildCount();
  stats.engine_rebuilds = 0;
  stats.gap_commits = 0;
  stats.gap_backtracks = 0;
  stats.validation_retries = 0;
  stats.polish_iterations = 0;
  stats.total_committed_cost = 0;
  stats.committed_costs_per_gap = [];
  stats.sim_frames = 0;
  stats.budget_exhausted = false;
}

function recordCommittedCosts(fits: (GapFit | null)[]): void {
  const per: (number | null)[] = [];
  let total = 0;
  for (const fit of fits) {
    if (fit === null) {
      per.push(null);
    } else {
      per.push(fit.cost);
      total += fit.cost;
    }
  }
  stats.committed_costs_per_gap = per;
  stats.total_committed_cost = total;
}

function snapshotStats(): CompileStats {
  stats.engine_rebuilds = getEngineRebuildCount();
  return { ...stats, committed_costs_per_gap: [...stats.committed_costs_per_gap] };
}

export function compile(userSpec: Spec, seed = 0): CompileResult {
  validateSpec(userSpec);
  resetStats();

  const spec = withOptimizedPrerollStart(userSpec, seed);
  const startState = resolveStartState(spec);
  setRebuildStartState(startState);
  const rng = makeRng(seed);
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const denseContactSequence = isDenseContactSequence(contactFrames, durationFrames);
  const denseNeedsExtraBacktracking = denseContactSequence
    && spec.sections.some((sec) => sec.grain !== undefined);

  // 1 + 2. Slice and target-sample.
  const gaps = sliceTimeline(contactFrames, durationFrames);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, rng);
  }

  // Per-gap state, shared across the initial compile pass and any off-beat
  // retries (which re-enter the loop from an earlier index without
  // re-initialising from scratch).
  const fits: (GapFit | null)[] = new Array(gaps.length).fill(null);
  const gapCandidates: (GapFit[] | null)[] = new Array(gaps.length).fill(null);
  const gapTried: number[] = new Array(gaps.length).fill(0);
  const gapFailures: number[] = [];

  // Prefix engines avoid replaying every prior gap each time the main
  // compiler asks for the state at gap i. Backtracking mutates suffix fits,
  // so invalidation is by fit index: changing fits[i] invalidates engines
  // with upTo > i.
  // deno-lint-ignore no-explicit-any
  const prefixEngines: any[] = [makeBaseEngine(startState)];
  const prefixNextLineIds: number[] = [1];

  const invalidatePrefixFromFit = (fitIndex: number) => {
    const keepLength = fitIndex + 1;
    if (prefixEngines.length > keepLength) {
      prefixEngines.length = keepLength;
      prefixNextLineIds.length = keepLength;
    }
  };

  // deno-lint-ignore no-explicit-any
  const engineUpTo = (upTo: number): any => {
    for (let k = prefixEngines.length; k <= upTo; k++) {
      let eng = prefixEngines[k - 1];
      let nextLineId = prefixNextLineIds[k - 1];
      const fit = fits[k - 1];
      if (fit !== null) {
        for (const line of fit.lines) {
          eng = eng.addLine(engineLineFromTrackLine(line));
        }
        nextLineId += fit.lines.length;
      }
      prefixEngines[k] = eng;
      prefixNextLineIds[k] = nextLineId;
    }
    return prefixEngines[upTo];
  };

  const nextLineIdUpTo = (upTo: number): number => {
    engineUpTo(upTo);
    return prefixNextLineIds[upTo];
  };

  const setFit = (index: number, fit: GapFit | null) => {
    fits[index] = fit;
    invalidatePrefixFromFit(index);
  };

  const candidateCache = new Map<string, GapFit[]>();
  const prefixValidationRetries = new Map<number, number>();
  const fitIds = new WeakMap<GapFit, number>();
  let nextFitId = 1;

  const fitId = (fit: GapFit): number => {
    let id = fitIds.get(fit);
    if (id === undefined) {
      id = nextFitId++;
      fitIds.set(fit, id);
    }
    return id;
  };

  const candidateCacheKey = (gapIndex: number): string => {
    const parts = [String(gapIndex), String(nextLineIdUpTo(gapIndex))];
    for (let j = 0; j < gapIndex; j++) {
      const fit = fits[j];
      parts.push(fit === null ? "_" : String(fitId(fit)));
    }
    return parts.join("|");
  };

  // 3. Compile each gap, with bounded cross-gap backtracking. Walk gaps in
  // time order; when a gap exhausts its candidates, back up to the most
  // recent previous gap that still has unused candidates (up to
  // BACKTRACK_DEPTH levels), reset all gaps between, and resume. If
  // backtrack is exhausted too, mark the gap as a hard failure and continue.
  const runFrom = (startIdx: number) => {
    let i = startIdx;
    let backtracksUsedForCurrentFailure = 0;
    let currentFailureGap = -1;

    while (i < gaps.length) {
      const gap = gaps[i];
      if (!gap.endsWithContact) {
        setFit(i, null);
        i++;
        continue;
      }

      if (gapCandidates[i] === null) {
        const eng = engineUpTo(i);
        const lineIdStart = nextLineIdUpTo(i);
        const cacheKey = candidateCacheKey(i);
        // Per-gap RNG: deterministic given (seed, gap index), independent of
        // how many times we've revisited the gap via backtracking.
        const perGapRng = makeRng((seed | 0) * 1000003 + i + 1);
        const cached = candidateCache.get(cacheKey);
        if (cached !== undefined) {
          gapCandidates[i] = cached;
        } else {
          const searchTargets = residualSearchTargetsForGap(
            eng, gap, spec, i, gaps, fits,
          );
          gapCandidates[i] = generateRankedCandidates(
            eng, gap, perGapRng, lineIdStart, contactFrames, durationFrames,
            searchTargets,
            () => { stats.candidates_sampled++; },
          );
          candidateCache.set(cacheKey, gapCandidates[i]!);
        }
        // Note: gapTried[i] is NOT reset here — when final validation
        // invalidates this gap's cache, gapTried[i] is left advanced so the
        // loop picks the next-untried candidate from the freshly-regenerated
        // (deterministically-identical) list.
      }

      if (gapTried[i] < gapCandidates[i]!.length) {
        setFit(i, gapCandidates[i]![gapTried[i]++]);
        stats.gap_commits++;
        const committed = i;
        if (currentFailureGap !== -1 && i >= currentFailureGap) {
          currentFailureGap = -1;
          backtracksUsedForCurrentFailure = 0;
        }
        i++;
        const retryFrom = prefixValidationRetryFrom(committed);
        if (retryFrom !== null) {
          stats.validation_retries++;
          setFit(retryFrom, null);
          gapCandidates[retryFrom] = null;
          for (let j = retryFrom + 1; j < gaps.length; j++) {
            setFit(j, null);
            gapCandidates[j] = null;
            gapTried[j] = 0;
          }
          const kept = gapFailures.filter((g) => g < retryFrom);
          gapFailures.length = 0;
          gapFailures.push(...kept);
          i = retryFrom;
        }
        continue;
      }

      // Exhausted at gap i.
      if (currentFailureGap === -1) {
        currentFailureGap = i;
        backtracksUsedForCurrentFailure = 0;
      }

      const backtrackDepth = denseNeedsExtraBacktracking ? 3 : CALIB.BACKTRACK_DEPTH;
      if (backtracksUsedForCurrentFailure < backtrackDepth) {
        let prev = i - 1;
        while (
          prev >= 0 && (
            !gaps[prev].endsWithContact
            || gapCandidates[prev] === null
            || gapTried[prev] >= gapCandidates[prev]!.length
          )
        ) {
          prev--;
        }
        if (prev >= 0) {
          for (let j = prev + 1; j <= i; j++) {
            gapCandidates[j] = null;
            gapTried[j] = 0;
            setFit(j, null);
          }
          i = prev;
          backtracksUsedForCurrentFailure++;
          stats.gap_backtracks++;
          continue;
        }
      }

      gapFailures.push(i);
      setFit(i, null);
      gapCandidates[i] = null;
      gapTried[i] = 0;
      currentFailureGap = -1;
      backtracksUsedForCurrentFailure = 0;
      i++;
    }
  };

  const prefixValidationRetryFrom = (gapIndex: number): number | null => {
    if (!denseContactSequence) return null;
    const gap = gaps[gapIndex];
    if (!gap.endsWithContact) return null;

    const retries = prefixValidationRetries.get(gapIndex) ?? 0;
    if (retries >= CALIB.FINAL_VALIDATION_RETRIES) return null;

    const contactsToCheck = contactFrames.filter((cf) => cf <= gap.endFrame);
    if (contactsToCheck.length === 0) return null;

    const horizon = gap.endFrame + PERSISTENCE_FRAMES + 1;
    const det = detect(extractRawTrajectory(engineUpTo(gapIndex + 1), horizon));
    const ownersToRetry = new Set<number>();

    for (const e of offBeatLandingEvents(det, contactsToCheck)) {
      if (e.frame > gap.endFrame + 1) continue;
      const lids = contactLineIdsAt(det, e.frame);
      for (const lid of lids) {
        const owner = findGapOwning(lid, fits);
        if (owner >= 0 && owner <= gapIndex) ownersToRetry.add(owner);
      }
    }

    addMissedContactRetryOwners(
      ownersToRetry, det, gaps, fits, contactsToCheck,
    );
    for (const owner of [...ownersToRetry]) {
      if (owner > gapIndex) ownersToRetry.delete(owner);
    }
    if (ownersToRetry.size === 0) return null;

    prefixValidationRetries.set(gapIndex, retries + 1);
    return Math.min(...ownersToRetry);
  };

  runFrom(0);

  // 4. Final-track validation. Per-gap simulation only sees its own gap's
  // window, so it can miss assembled-track sync failures: a later gap can
  // create an off-beat landing, while an earlier gap can keep the rider in
  // contact through a target frame and suppress the target landing event.
  // Identify the owning gap (via line-id membership in committed fits),
  // advance that gap past its current candidate, and re-enter the compile
  // loop from there. Bounded by CALIB.FINAL_VALIDATION_RETRIES.
  const finalValidationRetries = CALIB.FINAL_VALIDATION_RETRIES;
  for (let retry = 0; retry < finalValidationRetries; retry++) {
    const eng = engineUpTo(gaps.length);
    const raw = extractRawTrajectory(eng, durationFrames + 20);
    const det = detect(raw);

    const ownersToRetry = new Set<number>();
    for (const e of offBeatLandingEvents(det, contactFrames)) {
      const lids = contactLineIdsAt(det, e.frame);
      for (const lid of lids) {
        const owner = findGapOwning(lid, fits);
        if (owner >= 0) ownersToRetry.add(owner);
      }
    }
    addMissedContactRetryOwners(ownersToRetry, det, gaps, fits, contactFrames);
    if (ownersToRetry.size === 0) break;

    const earliest = Math.min(...ownersToRetry);
    // Reset the offending gap and everything after it. gapTried[earliest]
    // already points past the committed (problematic) candidate, so the
    // re-run picks the next one. If that exhausts, normal backtracking
    // kicks in.
    setFit(earliest, null);
    gapCandidates[earliest] = null;
    for (let j = earliest + 1; j < gaps.length; j++) {
      setFit(j, null);
      gapCandidates[j] = null;
      gapTried[j] = 0;
    }
    // Drop hard-failure markers that fall in the retry region — they'll be
    // re-evaluated.
    const kept = gapFailures.filter((g) => g < earliest);
    gapFailures.length = 0;
    gapFailures.push(...kept);

    runFrom(earliest);
  }

  stats.polish_iterations++;
  polishAirRideOut(fits, gaps, spec, contactFrames, durationFrames);
  stats.polish_iterations++;
  polishAirContactEntry(fits, gaps, spec, contactFrames, durationFrames);
  stats.polish_iterations++;
  polishAirBriefContacts(fits, gaps, spec, contactFrames, durationFrames);
  stats.polish_iterations++;
  polishExcessContact(fits, gaps, spec, contactFrames, durationFrames);

  // Collect all chosen lines.
  const allLines: TrackLine[] = [];
  for (const fit of fits) {
    if (fit !== null) allLines.push(...fit.lines);
  }

  // 5. Final simulation for the DriftReport (post-retry).
  const finalEngine = rebuildEngine(fits, gaps.length);
  const finalRaw = extractRawTrajectory(finalEngine, durationFrames + 20);
  const finalDet = detect(finalRaw);

  const track = buildTrackJson(allLines, durationFrames + 20, startState);
  const report = buildDriftReport(
    finalDet, spec, gaps, contactFrames, durationFrames, gapFailures, fits,
  );

  recordCommittedCosts(fits);
  return { track, report, stats: snapshotStats() };
}

// ─────────── Timeline slicing ───────────

// ─────────── Per-gap compilation ───────────

function isDenseContactSequence(contactFrames: number[], durationFrames: number): boolean {
  return contactFrames.length * FPS > durationFrames;
}

function residualSearchTargetsForGap(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  spec: Spec,
  gapIndex: number,
  gaps: Gap[],
  fits: (GapFit | null)[],
): SectionAxes | undefined {
  const out: SectionAxes = {};
  const airTarget = residualAirTargetForGap(baseEngine, gap, spec);
  if (airTarget !== undefined) out.air = airTarget;
  const grainTarget = residualGrainTargetForGap(gap, spec, gapIndex, gaps, fits);
  if (grainTarget !== undefined) out.grain = grainTarget;
  return Object.keys(out).length === 0 ? undefined : { ...gap.targets, ...out };
}

function residualAirTargetForGap(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  spec: Spec,
): number | undefined {
  const sec = airSectionAtFrame(gap.endFrame, spec);
  if (sec === null || sec.air === undefined) return undefined;

  const sectionStart = secToFrame(sec.t0);
  const sectionEnd = secToFrame(sec.t1);
  if (gap.startFrame > sectionEnd) return undefined;

  const prefixEnd = Math.min(gap.startFrame - 1, sectionEnd);
  if (prefixEnd < sectionStart) return undefined;

  const det = detectWindow(baseEngine, sectionStart, prefixEnd);
  const prefix = countAirFrames(det, sectionStart, prefixEnd);
  if (prefix.total <= 0) return undefined;

  const totalFrames = sectionEnd - sectionStart + 1;
  const remainingFrames = Math.max(1, sectionEnd - gap.startFrame + 1);
  const neededAirFrames = sec.air * totalFrames - prefix.air;
  const neededMean = clamp(neededAirFrames / remainingFrames, 0, 0.99);
  const current = gap.targets.air ?? sec.air;
  const residualPressure = Math.min(1, Math.abs(sec.air - 0.5) * 2);
  const gain = AIR_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 0.99);
}

function airSectionAtFrame(frame: number, spec: Spec): Section | null {
  const t = frame / FPS;
  let out: Section | null = null;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    if (sec.t0 <= t && sec.t1 >= t) out = sec;
  }
  return out;
}

function countAirFrames(
  det: Detection,
  f0: number,
  f1: number,
): { air: number; total: number } {
  const end = Math.min(f1, measurementLastFrame(det));
  let air = 0;
  let total = 0;
  for (let frame = f0; frame <= end; frame++) {
    if (airborneAt(det, frame)) air++;
    total++;
  }
  return { air, total };
}

function residualGrainTargetForGap(
  gap: Gap,
  spec: Spec,
  gapIndex: number,
  gaps: Gap[],
  fits: (GapFit | null)[],
): number | undefined {
  const sec = grainSectionAtFrame(gap.endFrame, spec);
  if (sec === null || sec.grain === undefined) return undefined;

  const sectionStart = secToFrame(sec.t0);
  const sectionEnd = secToFrame(sec.t1);
  let total = 0;
  let prefixCount = 0;
  let prefixSum = 0;
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    if (!g.endsWithContact) continue;
    if (g.endFrame < sectionStart || g.endFrame > sectionEnd) continue;
    total++;
    if (i >= gapIndex) continue;
    const fit = fits[i];
    if (fit === null) continue;
    prefixSum += measureFitGrain(fit);
    prefixCount++;
  }
  if (prefixCount <= 0 || total <= prefixCount) return undefined;

  const remaining = total - prefixCount;
  const neededMean = clamp((sec.grain * total - prefixSum) / remaining, 0, 1);
  const current = gap.targets.grain ?? sec.grain;
  const residualPressure = Math.min(1, Math.abs(neededMean - current) / 0.25);
  const gain = GRAIN_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 1);
}

function grainSectionAtFrame(frame: number, spec: Spec): Section | null {
  const t = frame / FPS;
  let out: Section | null = null;
  for (const sec of spec.sections) {
    if (sec.grain === undefined) continue;
    if (sec.t0 <= t && sec.t1 >= t) out = sec;
  }
  return out;
}
