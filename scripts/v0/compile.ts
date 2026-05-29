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
  detect, extractRawTrajectory, getRiderMetered,
  K_BOUNCE_LANDING, PERSISTENCE_FRAMES,
  type Detection, type DetEvent, type RawTrajectory,
} from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { makeSolidLine } from "./arc.ts";
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

// Re-export the substrate types so existing importers of compile.ts that pull
// these (e.g. optimizer/polish.ts, optimizer/sample.ts) keep resolving.
export type { ResolvedStart, GapFit };

const AIR_POLISH_PASSES = 3;
const DENSE_AIR_POLISH_PASSES = 2;
const DENSE_AIR_POLISH_SOURCE_LIMIT = 8;
const AIR_CONTACT_EXTENSION_LENGTHS = [25] as const;
const AIR_BRIEF_CONTACT_PASSES = 3;
const AIR_BRIEF_CONTACT_LENGTH = 8;
const AIR_BRIEF_CONTACT_FRAME_OFFSET = K_BOUNCE_LANDING + PERSISTENCE_FRAMES - 1;
const AIR_BRIEF_CONTACT_LANDING_MARGIN = PERSISTENCE_FRAMES + 1;
const CONTACT_TRIM_PASSES = 2;
const CONTACT_TRIM_FRACTIONS = [0.25, 0.8] as const;
const CONTACT_EDGE_TRIM_PASSES = 2;
const CONTACT_EDGE_TRIMS = [
  { edge: "start", side: "start", fraction: 0.85 },
  { edge: "start", side: "end", fraction: 0.9 },
] as const;
const GRAIN_LENGTH_PASSES = 1;
const GRAIN_LENGTH_EXTRAS = [1, 2] as const;
const ENTRY_LENGTH_PASSES = 3;
const SPEED_POLISH_Y_SHIFTS = [-1] as const;
const SPEED_POLISH_X_SHIFT_PASSES = [[4], [1], [0.5]] as const;
const SPEED_POLISH_BOUNDARY_PASSES = 2;
const SPEED_POLISH_ROTATIONS = [-4] as const;
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
  return { ...stats, committed_costs_per_gap: [...stats.committed_costs_per_gap] };
}

export function compile(userSpec: Spec, seed = 0): CompileResult {
  validateSpec(userSpec);
  resetStats();

  const spec = withOptimizedPrerollStart(userSpec, seed);
  const startState = resolveStartState(spec);
  currentStartState = startState;
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

export function polishAirRideOut(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!hasOnlyAirSectionTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  const baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + 20));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= 0) return;

  const dense = isDenseContactSequence(contactFrames, durationFrames);
  const sources = dense
    ? denseAirPolishSources(baseDet, fits, DENSE_AIR_POLISH_SOURCE_LIMIT)
    : airPolishSources(fits);
  if (sources.length === 0) return;

  const usedSources = new Set<number>();
  let chainSource: AirPolishSource | null = null;
  const passes = dense ? DENSE_AIR_POLISH_PASSES : AIR_POLISH_PASSES;

  for (let pass = 0; pass < passes; pass++) {
    if (bestErr <= airResolution) break;
    const lineId = nextLineIdAt(fits, gaps.length);
    let best = chainSource === null
      ? null
      : bestAirPolishCandidate(
        baseEngine,
        [chainSource],
        usedSources,
        lineId,
        spec,
        durationFrames,
        contactFrames,
        bestErr,
        true,
      );

    if (best === null) {
      chainSource = null;
      best = bestAirPolishCandidate(
        baseEngine,
        sources,
        usedSources,
        lineId,
        spec,
        durationFrames,
        contactFrames,
        bestErr,
        false,
      );
    }

    if (best === null) break;
    fits[best.owner]!.lines.push(best.line);
    usedSources.add(best.sourceId);
    chainSource = { owner: best.owner, line: best.line };
    sources.push(chainSource);
    baseEngine = baseEngine.addLine(engineLineFromTrackLine(best.line));
    bestErr = best.err;
  }
}

type AirPolishSource = { owner: number; line: TrackLine };

type AirPolishCandidate = {
  owner: number;
  sourceId: number;
  line: TrackLine;
  err: number;
};

function bestAirPolishCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  sources: AirPolishSource[],
  usedSources: Set<number>,
  lineId: number,
  spec: Spec,
  durationFrames: number,
  contactFrames: number[],
  bestErr: number,
  continuationOnly: boolean,
): AirPolishCandidate | null {
  let best: AirPolishCandidate | null = null;
  for (const source of sources) {
    if (usedSources.has(source.line.id)) continue;
    for (const cand of makeAirPolishCandidates(lineId, source.line)) {
      if (continuationOnly && !cand.continuation) continue;
      const eng = baseEngine.addLine(engineLineFromTrackLine(cand.line));
      const det = detect(extractRawTrajectory(eng, durationFrames + 20));
      if (!passesFinalHardGates(det, contactFrames)) continue;
      const err = meanAirError(det, spec);
      if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
        best = { owner: source.owner, sourceId: source.line.id, line: cand.line, err };
      }
    }
  }
  return best;
}

function airPolishSources(fits: (GapFit | null)[]): AirPolishSource[] {
  const sources: AirPolishSource[] = [];
  for (let owner = 0; owner < fits.length; owner++) {
    const fit = fits[owner];
    if (fit === null) continue;
    const lines = [
      ...fit.lines.slice(0, 1),
      ...fit.lines.slice(Math.max(0, fit.lines.length - 3)),
    ];
    const seen = new Set<number>();
    for (const line of lines) {
      if (seen.has(line.id)) continue;
      seen.add(line.id);
      sources.push({ owner, line });
    }
  }
  return sources;
}

function denseAirPolishSources(
  det: Detection,
  fits: (GapFit | null)[],
  limit: number,
): AirPolishSource[] {
  const candidates: { lineId: number; airFrames: number }[] = [];
  let contactIds = new Set<number>();
  let pendingExitIds: Set<number> | null = null;
  let airStart: number | null = null;

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (airStart !== null && pendingExitIds !== null) {
        const lineId = [...pendingExitIds].sort((a, b) => a - b).at(-1);
        if (lineId !== undefined) {
          candidates.push({ lineId, airFrames: frame - airStart });
        }
      }
      airStart = null;
      pendingExitIds = null;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        contactIds.add(id);
      }
      continue;
    }

    if (airStart === null && contactIds.size > 0) {
      pendingExitIds = contactIds;
      contactIds = new Set<number>();
      airStart = frame;
    }
  }

  if (airStart !== null && pendingExitIds !== null) {
    const lineId = [...pendingExitIds].sort((a, b) => a - b).at(-1);
    if (lineId !== undefined) {
      candidates.push({ lineId, airFrames: det.measurements.airborne.length - airStart });
    }
  }

  const sources: AirPolishSource[] = [];
  const seen = new Set<number>();
  for (const candidate of candidates.sort((a, b) => b.airFrames - a.airFrames)) {
    if (seen.has(candidate.lineId)) continue;
    const owner = findGapOwning(candidate.lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === candidate.lineId);
    if (line === undefined) continue;
    sources.push({ owner, line });
    seen.add(candidate.lineId);
    if (sources.length >= limit) break;
  }
  return sources;
}

function hasOnlyAirSectionTargets(spec: Spec): boolean {
  let hasAir = false;
  for (const sec of spec.sections) {
    if (
      sec.speed !== undefined
      || sec.grain !== undefined
      || sec.contact_style !== undefined
    ) {
      return false;
    }
    if (sec.air !== undefined) hasAir = true;
  }
  return hasAir;
}

function passesFinalHardGates(det: Detection, contactFrames: number[]): boolean {
  if (det.terminus.reason !== "endOfSpec") return false;
  for (const cf of contactFrames) {
    const hit = det.events.some(
      (e) => e.type === "landing" && Math.abs(e.frame - cf) <= 1,
    );
    if (!hit) return false;
  }
  return !det.events.some((e) =>
    e.type === "landing" && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1)
  );
}

function meanAirError(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "air",
    );
    if (achieved === null) continue;
    total += Math.abs(sec.air - achieved);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "air",
    );
    if (achieved === null) continue;
    total += achieved - sec.air;
    n++;
  }
  return n > 0 ? total / n : 0;
}

function meanSpeedDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.speed === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "speed",
    );
    if (achieved === null) continue;
    total += achieved - sec.speed;
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirFrameResolution(spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const frames = secToFrame(sec.t1) - secToFrame(sec.t0) + 1;
    if (frames <= 0) continue;
    total += 1 / frames;
    n++;
  }
  return n > 0 ? total / n : 0;
}

export function polishAirContactEntry(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasOnlyAirSectionTargets(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= airResolution) return;

  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    let best:
      | {
        x1: number;
        y1: number;
        err: number;
      }
      | null = null;

    for (const extra of AIR_CONTACT_EXTENSION_LENGTHS) {
      line.x1 = originalX1 - (dx / len) * extra;
      line.y1 = originalY1 - (dy / len) * extra;
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanAirError(det, spec);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { x1: line.x1, y1: line.y1, err };
        }
      }
      line.x1 = originalX1;
      line.y1 = originalY1;
    }

    if (best !== null) {
      line.x1 = best.x1;
      line.y1 = best.y1;
      return;
    }
  }
}

export function polishAirBriefContacts(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasOnlyAirSectionTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  let baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + 20));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= airResolution) return;

  for (let pass = 0; pass < AIR_BRIEF_CONTACT_PASSES; pass++) {
    if (bestErr <= airResolution) break;

    let accepted = false;
    for (const frame of airBriefContactFrames(baseDet, contactFrames, durationFrames)) {
      const rider = getRiderMetered(baseEngine, frame);
      const point = rider.get("PEG")?.pos;
      const velocity = rider.velocity ?? velocityAt(baseDet, frame);
      if (point === undefined || velocity === undefined) continue;

      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed <= 0) continue;

      const owner = findGapForFrame(frame, gaps, fits);
      if (owner < 0) continue;

      const angle = Math.atan2(velocity.y, velocity.x);
      const dx = Math.cos(angle) * AIR_BRIEF_CONTACT_LENGTH / 2;
      const dy = Math.sin(angle) * AIR_BRIEF_CONTACT_LENGTH / 2;
      const line = makeSolidLine(
        nextLineIdAt(fits, gaps.length),
        point.x - dx,
        point.y - dy,
        point.x + dx,
        point.y + dy,
      );

      const candidateEngine = baseEngine.addLine(engineLineFromTrackLine(line));
      const det = detect(extractRawTrajectory(candidateEngine, durationFrames + 20));
      if (!passesFinalHardGates(det, contactFrames)) continue;

      const err = meanAirError(det, spec);
      if (err + 1e-6 >= bestErr) continue;

      fits[owner]!.lines.push(line);
      baseEngine = candidateEngine;
      baseDet = det;
      bestErr = err;
      accepted = true;
      break;
    }

    if (!accepted) break;
  }
}

function airBriefContactFrames(
  det: Detection,
  contactFrames: number[],
  durationFrames: number,
): number[] {
  const frames: number[] = [];
  const firstContact = contactFrames[0] ?? 0;
  let start: number | null = null;

  for (let frame = 0; frame <= durationFrames && frame < det.measurements.airborne.length; frame++) {
    if (det.measurements.airborne[frame]) {
      if (start === null) start = frame;
      continue;
    }

    if (start !== null) {
      addBriefContactFrame(frames, start, frame - 1, firstContact);
      start = null;
    }
  }

  if (start !== null) {
    addBriefContactFrame(frames, start, durationFrames, firstContact);
  }

  return frames;
}

function addBriefContactFrame(
  out: number[],
  start: number,
  end: number,
  firstContact: number,
): void {
  if (start < firstContact) return;
  const frame = start + AIR_BRIEF_CONTACT_FRAME_OFFSET;
  if (frame <= end - AIR_BRIEF_CONTACT_LANDING_MARGIN) out.push(frame);
}

function findGapForFrame(
  frame: number,
  gaps: Gap[],
  fits: (GapFit | null)[],
): number {
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (frame >= gap.startFrame && frame <= gap.endFrame && fits[i] !== null) return i;
  }
  for (let i = fits.length - 1; i >= 0; i--) {
    if (fits[i] !== null) return i;
  }
  return -1;
}

export function polishExcessContact(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!shouldPolishExcessContact(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);

  for (let pass = 0; pass < CONTACT_TRIM_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of contactExitLineIds(baseDet)) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      if (Math.hypot(dx, dy) <= 0) continue;

      for (const frac of CONTACT_TRIM_FRACTIONS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX1 + dx * frac;
            line.y2 = originalY1 + dy * frac;
          } else {
            line.x1 = originalX2 - dx * frac;
            line.y1 = originalY2 - dy * frac;
          }
          const eng = rebuildEngine(fits, gaps.length);
          const det = detect(extractRawTrajectory(eng, durationFrames + 20));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
              };
            }
          }
          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
  }

  polishContactEdges(fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr);
  polishGrainLength(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySlope(fits, gaps, spec, contactFrames, durationFrames);
  polishEntryLength(fits, gaps, spec, contactFrames, durationFrames);
  polishMedianGrainPlateau(fits, gaps, spec, contactFrames, durationFrames);
  polishMedianGrainResidual(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeedX(fits, gaps, spec, contactFrames, durationFrames);
}

function shouldPolishExcessContact(spec: Spec): boolean {
  let hasAir = false;
  let hasCompanionAxis = false;
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.air !== undefined) hasAir = true;
    if (sec.speed !== undefined || sec.grain !== undefined) hasCompanionAxis = true;
  }
  return hasAir && hasCompanionAxis;
}

function polishContactEdges(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
): void {
  let baseDet = initialDet;
  let bestErr = initialErr;

  for (let pass = 0; pass < CONTACT_EDGE_TRIM_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const candidate of contactEdgeTrimCandidates(baseDet)) {
      const owner = findGapOwning(candidate.lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === candidate.lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      if (Math.hypot(dx, dy) <= 0) continue;

      if (candidate.side === "end") {
        line.x2 = originalX1 + dx * candidate.fraction;
        line.y2 = originalY1 + dy * candidate.fraction;
      } else {
        line.x1 = originalX2 - dx * candidate.fraction;
        line.y1 = originalY2 - dy * candidate.fraction;
      }

      const eng = rebuildEngine(fits, gaps.length);
      const det = detect(extractRawTrajectory(eng, durationFrames + 20));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = {
            line,
            owner,
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            err,
            det,
          };
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
  }
}

function polishEntrySpeedXBoundary(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_X_SHIFT_PASSES.at(-1)?.[0] ?? 0.5);
  if (coarseShift <= 0) return;
  const refinementStep = coarseShift / 10;

  let baseDet = initialDet;
  let bestErr = initialErr;

  for (let pass = 0; pass < SPEED_POLISH_BOUNDARY_PASSES; pass++) {
    const speedDelta = meanSpeedDelta(baseDet, spec);
    if (!Number.isFinite(speedDelta) || Math.abs(speedDelta) <= 1e-9) break;
    const direction = speedDelta > 0 ? 1 : -1;
    let best:
      | {
        line: TrackLine;
        x1: number;
        x2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of briefSingleLineContactEntryIds(baseDet).reverse()) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalX2 = line.x2;

      const dx = direction * (coarseShift + refinementStep);
      line.x1 = originalX1 + dx;
      line.x2 = originalX2 + dx;
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { line, x1: line.x1, x2: line.x2, err, det };
        }
      }
      line.x1 = originalX1;
      line.x2 = originalX2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.x2 = best.x2;
    baseDet = best.det;
    bestErr = best.err;
  }
}

function polishEntrySpeedYBoundary(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_X_SHIFT_PASSES.at(-1)?.[0] ?? 0.5);
  if (coarseShift <= 0) return;

  let baseDet = initialDet;
  let bestErr = initialErr;
  let step = coarseShift / 2;

  for (let pass = 0; pass <= SPEED_POLISH_BOUNDARY_PASSES; pass++, step /= 2) {
    const speedDelta = meanSpeedDelta(baseDet, spec);
    if (!Number.isFinite(speedDelta) || Math.abs(speedDelta) <= 1e-9) break;
    const direction = speedDelta > 0 ? -1 : 1;
    let best:
      | {
        line: TrackLine;
        y1: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of briefSingleLineContactEntryIds(baseDet).reverse()) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalY1 = line.y1;
      const originalY2 = line.y2;

      const dy = direction * step;
      line.y1 = originalY1 + dy;
      line.y2 = originalY2 + dy;
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { line, y1: line.y1, y2: line.y2, err, det };
        }
      }
      line.y1 = originalY1;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.y1 = best.y1;
    best.line.y2 = best.y2;
    baseDet = best.det;
    bestErr = best.err;
  }
}

function contactExitLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  let inContact = false;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    const sorted = [...rangeIds].sort((a, b) => a - b);
    const id = sorted.at(-1);
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function contactEntryLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  let inContact = false;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    const sorted = [...rangeIds].sort((a, b) => a - b);
    const id = sorted[0];
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function briefSingleLineContactEntryIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  let inContact = false;
  let rangeStart = 0;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (!inContact) rangeStart = frame;
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    const id = [...rangeIds][0];
    if (
      rangeIds.size === 1
      && frame - rangeStart <= PERSISTENCE_FRAMES
      && id !== undefined
      && !seen.has(id)
    ) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function polishGrainLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let chainLineId: number | null = null;

  for (let pass = 0; pass < GRAIN_LENGTH_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    const lineIds = chainLineId === null ? contactEntryLineIds(baseDet) : [chainLineId];
    for (const lineId of lineIds) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      const len = Math.hypot(dx, dy);
      if (len <= 0) continue;

      for (const extra of GRAIN_LENGTH_EXTRAS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX2 + (dx / len) * extra;
            line.y2 = originalY2 + (dy / len) * extra;
          } else {
            line.x1 = originalX1 - (dx / len) * extra;
            line.y1 = originalY1 - (dy / len) * extra;
          }

          const det = detect(extractRawTrajectory(
            rebuildEngine(fits, gaps.length),
            durationFrames + 20,
          ));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
              };
            }
          }

          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
    chainLineId = best.line.id;
  }
}

function shouldPolishGrainLength(spec: Spec): boolean {
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.grain !== undefined) return true;
  }
  return false;
}

function polishEntrySpeed(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const originalX2 = line.x2;
    const originalY2 = line.y2;
    let best:
      | {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
      }
      | null = null;

    for (const dy of SPEED_POLISH_Y_SHIFTS) {
      line.y1 = originalY1 + dy;
      line.y2 = originalY2 + dy;

      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = {
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            err,
          };
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

    if (best !== null) {
      line.x1 = best.x1;
      line.y1 = best.y1;
      line.x2 = best.x2;
      line.y2 = best.y2;
      return;
    }
  }
}

function shouldPolishEntrySpeed(spec: Spec): boolean {
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.speed !== undefined) return true;
  }
  return false;
}

function polishEntrySpeedX(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let lastAcceptedLineId: number | null = null;
  for (const shifts of SPEED_POLISH_X_SHIFT_PASSES) {
    let best:
      | {
        line: TrackLine;
        lineId: number;
        x1: number;
        x2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    const lineIds = lastAcceptedLineId === null
      ? contactEntryLineIds(baseDet).reverse()
      : [lastAcceptedLineId];
    for (const lineId of lineIds) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalX2 = line.x2;

      for (const dx of shifts) {
        line.x1 = originalX1 + dx;
        line.x2 = originalX2 + dx;

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = { line, lineId, x1: line.x1, x2: line.x2, err, det };
          }
        }

        line.x1 = originalX1;
        line.x2 = originalX2;
      }
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.x2 = best.x2;
    lastAcceptedLineId = best.lineId;
    baseDet = best.det;
    bestErr = best.err;
  }

  polishEntrySpeedXBoundary(
    fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr,
  );

  const refinedDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(refinedDet, contactFrames)) return;
  polishEntrySpeedYBoundary(
    fits,
    gaps,
    spec,
    contactFrames,
    durationFrames,
    refinedDet,
    meanSectionAxisError(refinedDet, spec, gaps, fits),
  );
}

function polishEntrySlope(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const originalX2 = line.x2;
    const originalY2 = line.y2;
    const dx = originalX2 - originalX1;
    const dy = originalY2 - originalY1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;

    const cx = (originalX1 + originalX2) / 2;
    const cy = (originalY1 + originalY2) / 2;
    const angle = Math.atan2(dy, dx);

    for (const rotateDeg of SPEED_POLISH_ROTATIONS) {
      const rotated = angle + (rotateDeg * Math.PI) / 180;
      line.x1 = cx - (Math.cos(rotated) * len) / 2;
      line.y1 = cy - (Math.sin(rotated) * len) / 2;
      line.x2 = cx + (Math.cos(rotated) * len) / 2;
      line.y2 = cy + (Math.sin(rotated) * len) / 2;

      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr) return;
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }
  }
}

function polishEntryLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let afterLineId = 0;

  for (let pass = 0; pass < ENTRY_LENGTH_PASSES; pass++) {
    let accepted = false;
    for (const lineId of contactEntryLineIds(baseDet)) {
      if (lineId <= afterLineId) continue;
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      const len = Math.hypot(dx, dy);
      if (len <= 0) continue;

      let best:
        | {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          err: number;
          det: Detection;
        }
        | null = null;

      for (const extra of GRAIN_LENGTH_EXTRAS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX2 + (dx / len) * extra;
            line.y2 = originalY2 + (dy / len) * extra;
          } else {
            line.x1 = originalX1 - (dx / len) * extra;
            line.y1 = originalY1 - (dy / len) * extra;
          }

          const det = detect(extractRawTrajectory(
            rebuildEngine(fits, gaps.length),
            durationFrames + 20,
          ));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
              };
            }
          }

          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }

      if (best !== null) {
        line.x1 = best.x1;
        line.y1 = best.y1;
        line.x2 = best.x2;
        line.y2 = best.y2;
        updateGeometryAxes(fit);
        baseDet = best.det;
        bestErr = best.err;
        afterLineId = lineId;
        accepted = true;
        break;
      }
    }
    if (!accepted) break;
  }
}

function polishMedianGrainPlateau(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let best:
    | {
      owner: number;
      lines: {
        line: TrackLine;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[];
      err: number;
    }
    | null = null;

  for (let owner = 0; owner < fits.length; owner++) {
    const fit = fits[owner];
    if (fit === null || fit.lines.length < 2 || fit.lines.length % 2 !== 0) continue;

    const sorted = fit.lines
      .map((line) => ({ line, len: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) }))
      .sort((a, b) => a.len - b.len);
    const upperMedian = sorted[fit.lines.length / 2].len;
    const plateau = sorted
      .filter((entry) => Math.abs(entry.len - upperMedian) < 1e-6)
      .map((entry) => entry.line);
    if (plateau.length < 2) continue;

    for (const extra of GRAIN_LENGTH_EXTRAS) {
      for (const side of ["end", "start"] as const) {
        const originals = plateau.map((line) => ({
          line,
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
        }));

        for (const original of originals) {
          const dx = original.x2 - original.x1;
          const dy = original.y2 - original.y1;
          const len = Math.hypot(dx, dy);
          if (len <= 0) continue;
          if (side === "end") {
            original.line.x2 = original.x2 + (dx / len) * extra;
            original.line.y2 = original.y2 + (dy / len) * extra;
          } else {
            original.line.x1 = original.x1 - (dx / len) * extra;
            original.line.y1 = original.y1 - (dy / len) * extra;
          }
        }

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = {
              owner,
              lines: originals.map((original) => ({
                line: original.line,
                x1: original.line.x1,
                y1: original.line.y1,
                x2: original.line.x2,
                y2: original.line.y2,
              })),
              err,
            };
          }
        }

        for (const original of originals) {
          original.line.x1 = original.x1;
          original.line.y1 = original.y1;
          original.line.x2 = original.x2;
          original.line.y2 = original.y2;
        }
      }
    }
  }

  if (best === null) return;
  for (const line of best.lines) {
    line.line.x1 = line.x1;
    line.line.y1 = line.y1;
    line.line.x2 = line.x2;
    line.line.y2 = line.y2;
  }
  updateGeometryAxes(fits[best.owner]!);
}

function polishMedianGrainResidual(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let best:
    | {
      owner: number;
      lines: LineSnapshot[];
      err: number;
    }
    | null = null;

  for (const sec of spec.sections) {
    if (sec.grain === undefined) continue;
    const entries = sectionGrainFits(sec, gaps, fits);
    if (entries.length === 0) continue;

    const achieved = entries
      .map(({ fit }) => measureFitGrain(fit))
      .reduce((a, b) => a + b, 0) / entries.length;
    const residual = sec.grain - achieved;
    if (Math.abs(residual) <= 1e-9) continue;

    const neededMedianDelta = residual * CALIB.LINE_LENGTH_CAP * entries.length;

    for (const { owner, fit } of entries) {
      for (const plan of grainResidualPlans(fit, neededMedianDelta)) {
        const originals = snapshotLines(plan.lines);
        if (!applyLengthDelta(originals, plan.side, plan.extra)) {
          restoreLines(originals);
          continue;
        }

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = {
              owner,
              lines: snapshotLines(plan.lines),
              err,
            };
          }
        }

        restoreLines(originals);
      }
    }
  }

  if (best === null) return;
  restoreLines(best.lines);
  updateGeometryAxes(fits[best.owner]!);
}

type LineSnapshot = {
  line: TrackLine;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function sectionGrainFits(
  sec: Section,
  gaps: Gap[],
  fits: (GapFit | null)[],
): { owner: number; fit: GapFit }[] {
  const f0 = secToFrame(sec.t0);
  const f1 = secToFrame(sec.t1);
  const entries: { owner: number; fit: GapFit }[] = [];
  for (let owner = 0; owner < gaps.length; owner++) {
    const gap = gaps[owner];
    const fit = fits[owner];
    if (!gap.endsWithContact || fit === null) continue;
    if (gap.endFrame >= f0 && gap.endFrame <= f1) entries.push({ owner, fit });
  }
  return entries;
}

function grainResidualPlans(
  fit: GapFit,
  neededMedianDelta: number,
): { lines: TrackLine[]; side: "start" | "end"; extra: number }[] {
  const direction = Math.sign(neededMedianDelta);
  if (direction === 0 || fit.lines.length === 0) return [];

  const sorted = fit.lines
    .map((line) => ({ line, len: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) }))
    .sort((a, b) => a.len - b.len);
  const rank = direction > 0
    ? Math.floor(fit.lines.length / 2)
    : Math.floor((fit.lines.length - 1) / 2);
  const targetLen = sorted[rank].len;
  const plateau = sorted
    .filter((entry) => Math.abs(entry.len - targetLen) < 1e-6)
    .map((entry) => entry.line);
  if (plateau.length === 0) return [];

  const plans: { lines: TrackLine[]; side: "start" | "end"; extra: number }[] = [];
  const before = medianLineLength(fit);
  for (const side of ["end", "start"] as const) {
    const originals = snapshotLines(plateau);
    const unitExtra = direction;
    if (!applyLengthDelta(originals, side, unitExtra)) {
      restoreLines(originals);
      continue;
    }
    const unitEffect = medianLineLength(fit) - before;
    restoreLines(originals);
    if (Math.abs(unitEffect) <= 1e-9 || Math.sign(unitEffect) !== direction) continue;

    const extra = neededMedianDelta / unitEffect;
    if (!Number.isFinite(extra) || Math.sign(extra) !== direction) continue;
    plans.push({ lines: plateau, side, extra });
  }

  return plans;
}

function medianLineLength(fit: GapFit): number {
  return median(fit.lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)));
}

function snapshotLines(lines: TrackLine[]): LineSnapshot[] {
  return lines.map((line) => ({
    line,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
  }));
}

function restoreLines(lines: LineSnapshot[]): void {
  for (const saved of lines) {
    saved.line.x1 = saved.x1;
    saved.line.y1 = saved.y1;
    saved.line.x2 = saved.x2;
    saved.line.y2 = saved.y2;
  }
}

function applyLengthDelta(
  lines: LineSnapshot[],
  side: "start" | "end",
  extra: number,
): boolean {
  for (const saved of lines) {
    const dx = saved.x2 - saved.x1;
    const dy = saved.y2 - saved.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0 || len + extra <= 0) return false;
  }

  for (const saved of lines) {
    const dx = saved.x2 - saved.x1;
    const dy = saved.y2 - saved.y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    if (side === "end") {
      saved.line.x2 = saved.x2 + ux * extra;
      saved.line.y2 = saved.y2 + uy * extra;
    } else {
      saved.line.x1 = saved.x1 - ux * extra;
      saved.line.y1 = saved.y1 - uy * extra;
    }
  }

  return true;
}

function contactEdgeTrimCandidates(
  det: Detection,
): { lineId: number; side: "start" | "end"; fraction: number }[] {
  const candidates: { lineId: number; side: "start" | "end"; fraction: number }[] = [];
  const seen = new Set<string>();
  let inContact = false;
  let rangeStart = 0;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (!inContact) rangeStart = frame;
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    if (frame - rangeStart < 5) {
      inContact = false;
      rangeIds = new Set<number>();
      continue;
    }
    const sorted = [...rangeIds].sort((a, b) => a - b);
    for (const trim of CONTACT_EDGE_TRIMS) {
      const lineId = trim.edge === "start" ? sorted[0] : sorted.at(-1);
      if (lineId === undefined) continue;
      const key = `${lineId}:${trim.side}:${trim.fraction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ lineId, side: trim.side, fraction: trim.fraction });
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return candidates;
}

function meanSectionAxisError(
  det: Detection,
  spec: Spec,
  gaps: Gap[],
  fits: (GapFit | null)[],
): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    const f0 = secToFrame(sec.t0);
    const f1 = secToFrame(sec.t1);
    if (sec.air !== undefined) {
      const v = measureAxisOverRange(det, f0, f1, "air");
      if (v !== null) {
        total += Math.abs(sec.air - v);
        n++;
      }
    }
    if (sec.speed !== undefined) {
      const v = measureAxisOverRange(det, f0, f1, "speed");
      if (v !== null) {
        total += Math.abs(sec.speed - v);
        n++;
      }
    }
    if (sec.grain !== undefined) {
      const vals: number[] = [];
      for (let j = 0; j < gaps.length; j++) {
        const gap = gaps[j];
        const fit = fits[j];
        if (!gap.endsWithContact || fit === null) continue;
        if (gap.endFrame >= f0 && gap.endFrame <= f1) vals.push(measureFitGrain(fit));
      }
      if (vals.length > 0) {
        const achieved = vals.reduce((a, b) => a + b, 0) / vals.length;
        total += Math.abs(sec.grain - achieved);
        n++;
      }
    }
  }
  return n > 0 ? total / n : Infinity;
}

function updateGeometryAxes(fit: GapFit): void {
  fit.achieved.grain = measureFitGrain(fit);
}

// ─────────── Engine rebuild (for backtracking) ───────────

/**
 * Reconstruct the engine state up to (but not including) gap index `upTo`,
 * by replaying all committed gap fits in time order. O(N) per call; fine for
 * v0 spec sizes. Cache if it becomes a bottleneck.
 *
 * Initial rider state comes from `currentStartState`, which `compile()` sets
 * for the duration of a single compile (see `resolveStartState`). Module-
 * scoped because the polish helpers that call `rebuildEngine` are top-level
 * and threading the state through every signature would be a large diff for
 * no behavioral benefit.
 */
export function rebuildEngine(fits: (GapFit | null)[], upTo: number): any {
  stats.engine_rebuilds++;
  const eng: any = makeBaseEngine(currentStartState);
  let chained = eng;
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit === null) continue;
    for (const line of fit.lines) {
      chained = chained.addLine(engineLineFromTrackLine(line));
    }
  }
  return chained;
}

// Set by `compile()` at the start of every call. Read by `rebuildEngine`.
// `compile()` is not reentrant (the engine instance pools already aren't),
// so a single module-scoped slot is safe.
let currentStartState: ResolvedStart = {
  position: { ...START_DEFAULTS.POSITION },
  velocity: { ...START_DEFAULTS.VELOCITY },
};

/** Prime the module-scoped start state that `rebuildEngine` (and the polish
 *  helpers that call it) read. `compile()` sets this internally; the standalone
 *  LDS optimizer (`compileLDS`), which no longer routes through `compile()`,
 *  must call this before its polish pass so polished variants rebuild engines
 *  from the spec's real start (start/preroll) rather than a stale default. */
export function setRebuildStartState(start: ResolvedStart): void {
  currentStartState = start;
}

/** Read the module-scoped start state `rebuildEngine` will use. Exposed so
 *  callers that temporarily override it (e.g. the LDS optimizer's polish pass)
 *  can save and restore it around their own rebuilds, keeping the override
 *  reentrancy-safe instead of leaving a stale value for the next compile. */
export function getRebuildStartState(): ResolvedStart {
  return currentStartState;
}

function nextLineIdAt(fits: (GapFit | null)[], upTo: number): number {
  let id = 1;
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit !== null) id += fit.lines.length;
  }
  return id;
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
