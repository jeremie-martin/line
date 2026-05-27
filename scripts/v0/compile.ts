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

import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  detect, extractRawTrajectory, extractRawTrajectoryWindow,
  K_BOUNCE_LANDING, PERSISTENCE_FRAMES,
  type Detection, type DetEvent, type RawTrajectory,
} from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { arcToLines, makeSolidLine } from "./arc.ts";
import type { TrackJson } from "../lib/primitive.ts";
import {
  type Spec, type Section, type SectionAxes,
  type Arc, type TrackLine, type DriftReport, type Gap,
  type ContactReport, type SectionReport,
  CALIB, FPS, secToFrame,
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const AIR_POLISH_PASSES = 3;
const AIR_POLISH_CONTINUATION_LENGTHS = [50, 300] as const;
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
const DENSE_CONTACT_CANDIDATE_BUDGET = 24;

export type CompileResult = {
  track: TrackJson;
  report: DriftReport;
};

export function compile(spec: Spec, seed = 0): CompileResult {
  validateSpec(spec);

  const rng = makeRng(seed);
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const denseContactSequence = isDenseContactSequence(contactFrames, durationFrames);
  const denseNeedsExtraBacktracking = denseContactSequence
    && spec.sections.some((sec) => sec.grain !== undefined);
  const denseSpeedOnly = denseContactSequence
    && spec.sections.some((sec) => sec.speed !== undefined)
    && spec.sections.every((sec) =>
      sec.air === undefined
      && sec.grain === undefined
      && sec.contact_style === undefined
    );

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
  const prefixEngines: any[] = [new LineRiderEngine()];
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
          gapCandidates[i] = generateRankedCandidates(
            eng, gap, perGapRng, lineIdStart, contactFrames, durationFrames,
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
        const committed = i;
        if (currentFailureGap !== -1 && i >= currentFailureGap) {
          currentFailureGap = -1;
          backtracksUsedForCurrentFailure = 0;
        }
        i++;
        const retryFrom = prefixValidationRetryFrom(committed);
        if (retryFrom !== null) {
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
  const finalValidationRetries = denseSpeedOnly ? 1 : CALIB.FINAL_VALIDATION_RETRIES;
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

  polishAirRideOut(fits, gaps, spec, contactFrames, durationFrames);
  polishAirContactEntry(fits, gaps, spec, contactFrames, durationFrames);
  polishAirBriefContacts(fits, gaps, spec, contactFrames, durationFrames);
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

  const track = buildTrackJson(allLines, durationFrames + 20);
  const report = buildDriftReport(
    finalDet, spec, gaps, contactFrames, durationFrames, gapFailures, fits,
  );

  return { track, report };
}

/** Locate the index of the gap whose fit's `lines` contains the given id. */
function findGapOwning(lineId: number, fits: (GapFit | null)[]): number {
  for (let i = 0; i < fits.length; i++) {
    const fit = fits[i];
    if (fit === null) continue;
    if (fit.lines.some((l) => l.id === lineId)) return i;
  }
  return -1;
}

type WindowDetection = Detection & { frameOffset?: number };

// deno-lint-ignore no-explicit-any
function detectWindow(engine: any, startFrame: number, endFrame: number): Detection {
  const start = Math.max(0, startFrame);
  const det = detect(extractRawTrajectoryWindow(engine, start, endFrame)) as WindowDetection;
  det.frameOffset = start;
  return det;
}

function frameOffset(det: Detection): number {
  return (det as WindowDetection).frameOffset ?? 0;
}

function measurementIndex(det: Detection, frame: number): number {
  return frame - frameOffset(det);
}

function measurementLastFrame(det: Detection): number {
  return frameOffset(det) + det.measurements.airborne.length - 1;
}

function contactLineIdsAt(det: Detection, frame: number): number[] {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.contactLineIds[index] ?? [] : [];
}

function airborneAt(det: Detection, frame: number): boolean | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.airborne[index] : undefined;
}

function speedAt(det: Detection, frame: number): number | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.speed[index] : undefined;
}

function velocityAt(det: Detection, frame: number): { x: number; y: number } | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.velocity[index] : undefined;
}

function polishAirRideOut(
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

function makeAirPolishCandidates(
  lineId: number,
  source: TrackLine,
): { line: TrackLine; continuation: boolean }[] {
  const lines: { line: TrackLine; continuation: boolean }[] = [];
  const dx = source.x2 - source.x1;
  const dy = source.y2 - source.y1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    for (const length of AIR_POLISH_CONTINUATION_LENGTHS) {
      lines.push({
        line: makeSolidLine(
          lineId,
          source.x2,
          source.y2,
          source.x2 + (dx / len) * length,
          source.y2 + (dy / len) * length,
        ),
        continuation: true,
      });
    }
  }
  return lines;
}

function makeContinuationLines(lineId: number, source: TrackLine): TrackLine[] {
  return makeAirPolishCandidates(lineId, source)
    .filter((candidate) => candidate.continuation)
    .map((candidate) => candidate.line);
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

function offBeatLandingEvents(det: Detection, contactFrames: number[]): DetEvent[] {
  return det.events.filter((e) =>
    e.type === "landing" && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1)
  );
}

function addMissedContactRetryOwners(
  owners: Set<number>,
  det: Detection,
  gaps: Gap[],
  fits: (GapFit | null)[],
  contactFrames: number[],
): void {
  for (const frame of contactFrames) {
    const hasLanding = det.events.some((e) =>
      e.type === "landing" && Math.abs(e.frame - frame) <= 1
    );
    if (hasLanding) continue;

    const before = owners.size;
    addContactLineOwners(owners, det, fits, frame, 1);
    if (owners.size > before) continue;

    const nearest = nearestLanding(det, frame, 5);
    if (nearest !== null) {
      addContactLineOwners(owners, det, fits, nearest.frame, 0);
      if (owners.size > before) continue;
    }

    const gapIndex = gaps.findIndex((gap) => gap.endsWithContact && gap.endFrame === frame);
    if (gapIndex >= 0) owners.add(gapIndex);
  }
}

function addContactLineOwners(
  owners: Set<number>,
  det: Detection,
  fits: (GapFit | null)[],
  frame: number,
  radius: number,
): void {
  for (let f = frame - radius; f <= frame + radius; f++) {
    for (const lineId of contactLineIdsAt(det, f)) {
      const owner = findGapOwning(lineId, fits);
      if (owner >= 0) owners.add(owner);
    }
  }
}

function nearestLanding(det: Detection, frame: number, radius: number): DetEvent | null {
  let best: DetEvent | null = null;
  let bestDistance = Infinity;
  for (const event of det.events) {
    if (event.type !== "landing") continue;
    const distance = Math.abs(event.frame - frame);
    if (distance > radius || distance >= bestDistance) continue;
    best = event;
    bestDistance = distance;
  }
  return best;
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

function polishAirContactEntry(
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

function polishAirBriefContacts(
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
      const rider = baseEngine.getRider(frame);
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

function polishExcessContact(
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

function measureFitGrain(fit: GapFit): number {
  const lineLens = fit.lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : 0;
}

// ─────────── Engine rebuild (for backtracking) ───────────

// lr-core Line objects snapshot TrackLine geometry at construction. The
// compiler rebuilds engines repeatedly from the same TrackLine objects; cache
// conversions by object plus geometry signature, while still invalidating
// whenever a polish mutates line endpoints.
// deno-lint-ignore no-explicit-any
const engineLineCache = new WeakMap<TrackLine, Map<string, any>>();

// deno-lint-ignore no-explicit-any
function engineLineFromTrackLine(line: TrackLine): any {
  const signature = engineLineSignature(line);
  let cachedBySignature = engineLineCache.get(line);
  if (cachedBySignature === undefined) {
    cachedBySignature = new Map();
    engineLineCache.set(line, cachedBySignature);
  }

  const cached = cachedBySignature.get(signature);
  if (cached !== undefined) return cached;

  const converted = createLineFromJson(line);
  cachedBySignature.set(signature, converted);
  return converted;
}

function engineLineSignature(line: TrackLine): string {
  return [
    line.id,
    line.type,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
    line.flipped ? 1 : 0,
    line.leftExtended ? 1 : 0,
    line.rightExtended ? 1 : 0,
  ].join("|");
}

/**
 * Reconstruct the engine state up to (but not including) gap index `upTo`,
 * by replaying all committed gap fits in time order. O(N) per call; fine for
 * v0 spec sizes. Cache if it becomes a bottleneck.
 */
function rebuildEngine(fits: (GapFit | null)[], upTo: number): any {
  // deno-lint-ignore no-explicit-any
  let eng: any = new LineRiderEngine();
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit === null) continue;
    for (const line of fit.lines) {
      eng = eng.addLine(engineLineFromTrackLine(line));
    }
  }
  return eng;
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

function sliceTimeline(contactFrames: number[], durationFrames: number): Gap[] {
  const gaps: Gap[] = [];
  let idx = 0;
  let cursor = 0;
  for (const cf of contactFrames) {
    gaps.push({
      index: idx++,
      startFrame: cursor,
      endFrame: cf,
      endsWithContact: true,
      targets: {},
    });
    cursor = cf;
  }
  // Tail gap
  if (cursor < durationFrames) {
    gaps.push({
      index: idx,
      startFrame: cursor,
      endFrame: durationFrames,
      endsWithContact: false,
      targets: {},
    });
  }
  return gaps;
}

// ─────────── Per-gap effective axes ───────────

/**
 * Walk the spec's sections in declaration order; last-defined wins per axis
 * for sections overlapping the gap's midpoint. Falls back to defaults.
 *
 * Using the gap's midpoint is a v0 simplification — sections that only
 * partially cover a gap will be evaluated by what's at the midpoint. v0.1
 * may refine to time-weighted averaging if real specs require it.
 */
function effectiveAxes(gap: Gap, spec: Spec): SectionAxes {
  const midSec = (gap.startFrame + gap.endFrame) / 2 / FPS;
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  for (const sec of spec.sections) {
    if (sec.t0 > midSec || sec.t1 < midSec) continue;
    if (sec.air !== undefined) axes.air = sec.air;
    if (sec.speed !== undefined) axes.speed = sec.speed;
    if (sec.contact_style !== undefined) axes.contact_style = sec.contact_style;
    if (sec.grain !== undefined) axes.grain = sec.grain;
  }
  return axes;
}

// ─────────── Cross-gap target sampling ───────────

function sampleGapTargets(
  section: SectionAxes,
  sigma: number,
  rng: () => number,
): SectionAxes {
  const out: SectionAxes = {};
  if (section.air !== undefined)           out.air = clamp(gauss(rng, section.air, sigma), 0, 0.99);
  if (section.speed !== undefined)         out.speed = clamp(gauss(rng, section.speed, sigma), 0, 1);
  if (section.contact_style !== undefined) out.contact_style = clamp(gauss(rng, section.contact_style, sigma), 0, 1);
  if (section.grain !== undefined)         out.grain = clamp(gauss(rng, section.grain, sigma), 0, 1);
  return out;
}

/** Box-Muller Gaussian; mean μ, stdev σ. */
function gauss(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + z * sigma;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ─────────── Per-gap compilation ───────────

type GapFit = {
  arc: Arc;
  lines: TrackLine[];
  /** Achieved axis values for this gap (for the DriftReport). */
  achieved: SectionAxes;
  /** Aggregate axis cost (lower = better fit). */
  cost: number;
};

/**
 * Generate K candidate Arc placements for a gap, simulate each, filter by
 * hard gate, and return all survivors ranked by aggregate axis cost
 * (lowest cost first). Used by the backtracking loop in `compile()`:
 * the best survivor is committed first; if downstream gaps can't make it
 * work, the loop falls back to the next-best.
 *
 * Deterministic for fixed (baseEngine state, rng state, gap).
 */
function generateRankedCandidates(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  rng: () => number,
  lineIdStart: number,
  allContactFrames: number[],
  durationFrames: number,
): GapFit[] {
  const riderAtTarget = baseEngine.getRider(gap.endFrame);
  const refX = riderAtTarget.position.x;
  const refY = riderAtTarget.position.y;
  const targetState = readTargetState(baseEngine, gap.endFrame, refX, refY);

  const survivors: GapFit[] = [];
  const candidateBudget = candidateBudgetForGap(gap, allContactFrames, durationFrames);
  for (let attempt = 0; attempt < candidateBudget; attempt++) {
    const cand = sampleArcParams(rng, refX, refY, gap.targets, targetState, attempt, gap);
    const fit = tryCandidate(baseEngine, gap, cand, lineIdStart, allContactFrames, true);
    if (fit !== null) survivors.push(fit);
  }

  survivors.sort((a, b) => a.cost - b.cost);
  return survivors;
}

function candidateBudgetForGap(
  gap: Gap,
  contactFrames: number[],
  durationFrames: number,
): number {
  if (!isDenseContactSequence(contactFrames, durationFrames)) return CALIB.K;
  return Math.min(CALIB.K, DENSE_CONTACT_CANDIDATE_BUDGET);
}

function isDenseContactSequence(contactFrames: number[], durationFrames: number): boolean {
  return contactFrames.length * FPS > durationFrames;
}

type TargetState = {
  sledX: number;
  sledY: number;
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

function readTargetState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
  fallbackX: number,
  fallbackY: number,
): TargetState {
  const rider = engine.getRider(frame);
  let sledX = fallbackX;
  let sledY = fallbackY;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > sledY) {
      sledY = p.pos.y;
      sledX = p.pos.x;
    }
  }
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const angleDeg = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
  return { sledX, sledY, velocity, speed, angleDeg };
}

const CATCH_TEMPLATES = [
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 13 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: 4 },
  { startDelta: -8,  end: 45, segments: 14, segmentLength: 34, lead: 9,  offset: -8 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: -6 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 7 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 4 },
  { startDelta: -3,  end: 47, segments: 15, segmentLength: 33, lead: 3,  offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 13 },
  { startDelta: -10, end: 2,  segments: 20, segmentLength: 30, lead: 17, offset: 4 },
  { startDelta: -10, end: 30, segments: 16, segmentLength: 35, lead: 1,  offset: 16 },
  { startDelta: -12, end: 3,  segments: 18, segmentLength: 26, lead: 12, offset: 10 },
  { startDelta: -7,  end: 14, segments: 18, segmentLength: 46, lead: 13, offset: 13 },
  { startDelta: -5,  end: 25, segments: 12, segmentLength: 35, lead: 8,  offset: 0 },
  { startDelta: -15, end: -5, segments: 22, segmentLength: 28, lead: 16, offset: 8 },
  { startDelta: -10, end: 45, segments: 12, segmentLength: 40, lead: 12, offset: -10 },
] as const;

function sampleArcParams(
  rng: () => number,
  refX: number,
  refY: number,
  targets: SectionAxes,
  targetState: TargetState,
  attempt: number,
  gap: Gap,
): Arc {
  if (shouldUseSteepCatch(targetState, gap) && attempt < CATCH_TEMPLATES.length) {
    return sampleSteepCatchArc(targetState, CATCH_TEMPLATES[attempt]);
  }

  const A = CALIB.ARC;
  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const lengthRange = A.LENGTH_MAX - A.LENGTH_MIN;
  const length = A.LENGTH_MIN + rng() * lengthRange;
  // Segments. When `grain` is targeted, derive segment count directly from
  // length / desired-median-line-length so the resulting arc is much more
  // likely to hit the grain target. Sprinkle some uniform sampling for variety.
  const segRoll = rng();
  let segments: number;
  if (targets.grain !== undefined && segRoll < 0.7) {
    // grain = median(line_length) / LINE_LENGTH_CAP. Solve for segment count.
    // Add a small ±1 jitter so we don't collapse to one shape.
    const targetSegLen = Math.max(3, targets.grain * CALIB.LINE_LENGTH_CAP);
    const jitter = Math.floor(segRoll * 3) - 1; // -1, 0, +1
    const ideal = Math.round(length / targetSegLen) + jitter;
    segments = Math.max(A.SEGMENTS_MIN, Math.min(A.SEGMENTS_MAX, ideal));
  } else {
    segments = A.SEGMENTS_MIN + Math.floor(segRoll * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));
  }

  const startAngleDeg = A.START_ANGLE_MIN_DEG
    + rng() * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = A.END_ANGLE_MIN_DEG
    + rng() * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const curveBias = -1 + 2 * rng();

  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + rng() * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + rng() * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN);

  return {
    anchor: { x: refX - length / 2 + anchorXOffset, y: refY + anchorYOffset },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
}

function shouldUseSteepCatch(targetState: TargetState, gap: Gap): boolean {
  const gapFrames = gap.endFrame - gap.startFrame;
  return gapFrames >= 60 && (targetState.speed >= 10 || targetState.angleDeg >= 55);
}

function sampleSteepCatchArc(
  targetState: TargetState,
  template: typeof CATCH_TEMPLATES[number],
): Arc {
  const startAngleDeg = clamp(targetState.angleDeg + template.startDelta, 20, 88);
  const endAngleDeg = clamp(template.end, -15, 55);
  const a0 = (startAngleDeg * Math.PI) / 180;
  const dx0 = Math.cos(a0);
  const dy0 = Math.sin(a0);
  const perpX = -dy0;
  const perpY = dx0;
  return {
    anchor: {
      x: targetState.sledX - dx0 * template.lead + perpX * template.offset,
      y: targetState.sledY - dy0 * template.lead + perpY * template.offset,
    },
    length: template.segments * template.segmentLength,
    startAngleDeg,
    endAngleDeg,
    segments: template.segments,
    curveBias: 0,
  };
}

function tryCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  candArc: Arc,
  lineIdStart: number,
  allContactFrames: number[],
  useWindowDetection: boolean,
): GapFit | null {
  // Bisect anchor Y for Contact precision.
  const bisected = bisectAnchorY(
    baseEngine, candArc, gap.endFrame, lineIdStart, useWindowDetection,
  );
  if (bisected === null) return null;

  const axisMeasureEnd = axisLookaheadEndFrame(gap, allContactFrames);
  let best = evaluateGapFit(
    baseEngine, gap, bisected.lines, axisMeasureEnd, allContactFrames, useWindowDetection,
  );
  if (best === null) return null;

  if (shouldTryCandidateRideOut(gap, axisMeasureEnd)) {
    const rideOutId = lineIdStart + bisected.lines.length;
    for (const source of rideOutSources(bisected.lines)) {
      for (const rideOut of makeContinuationLines(rideOutId, source)) {
        const lines = [...bisected.lines, rideOut];
        const extended = evaluateGapFit(
          baseEngine, gap, lines, axisMeasureEnd, allContactFrames, useWindowDetection,
        );
        if (extended !== null && extended.cost + 1e-6 < best.cost) {
          best = extended;
        }
      }
    }
  }

  return { arc: bisected.arc, lines: best.lines, achieved: best.achieved, cost: best.cost };
}

function evaluateGapFit(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
  axisMeasureEnd: number,
  allContactFrames: number[],
  useWindowDetection: boolean,
): Pick<GapFit, "lines" | "achieved" | "cost"> | null {
  // deno-lint-ignore no-explicit-any
  let eng: any = baseEngine;
  for (const line of lines) eng = eng.addLine(engineLineFromTrackLine(line));
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const det = useWindowDetection
    ? detectWindow(eng, gap.startFrame, horizon)
    : detect(extractRawTrajectory(eng, horizon));

  // Hard gate 1: rider survived to gap.endFrame + SURVIVAL_MARGIN.
  // Surviving exactly the landing frame isn't enough — many randomly-sampled
  // catch geometries eject the rider on the next frame. Require the rider to
  // remain alive long enough to plausibly bridge into the next gap.
  const SURVIVAL_MARGIN = 16;
  const minSurvival = Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") return null;

  // Hard gate 2: a landing event near gap.endFrame ±1.
  const owned = new Set(lines.map((l) => l.id));
  const landingNearTarget = det.events.some(
    (e) => e.type === "landing"
      && Math.abs(e.frame - gap.endFrame) <= 1
      && intersectsLineIds(e, det, owned),
  );
  if (!landingNearTarget) return null;

  // Hard gate 3: no off-beat landings before the next measurement boundary.
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, axisMeasureEnd, allContactFrames,
  );
  if (offBeat > 0) return null;

  const achieved = measureAxes(det, gap, lines, axisMeasureEnd);
  const cost = axisCost(gap.targets, achieved);
  return { lines, achieved, cost };
}

function shouldTryCandidateRideOut(
  gap: Gap,
  axisMeasureEnd: number,
): boolean {
  return gap.targets.air !== undefined
    && gap.targets.speed === undefined
    && gap.targets.grain === undefined
    && gap.targets.contact_style === undefined
    && axisMeasureEnd > gap.endFrame
    && (
      gap.endFrame - gap.startFrame >= 60
    );
}

function rideOutSources(lines: TrackLine[]): TrackLine[] {
  return lines.slice(Math.max(0, lines.length - 8));
}

function axisLookaheadEndFrame(gap: Gap, allContactFrames: number[]): number {
  // For long airborne gaps, the catch at gap.endFrame determines most of the
  // air/contact balance after the beat, not before it. Score those candidates
  // through the next beat so ranking can prefer a catch that keeps riding.
  if (gap.endFrame - gap.startFrame < 60) return gap.endFrame;
  return allContactFrames.find((cf) => cf > gap.endFrame) ?? gap.endFrame;
}

// ─────────── Bisection: adjust anchor Y so the landing fires AT gap.endFrame ───────────

/**
 * Bisect Arc.anchor.y so that, when the Arc is added to the engine, a landing
 * event attributable to the Arc's lines fires at gap.endFrame ±1.
 *
 * Direction: larger Y → line lower → rider hits LATER. (World Y increases
 * downward in the engine's coordinate frame.)
 *
 * Falls back to coarse grid search if bisection diverges (non-monotone region).
 * Returns null if neither converges.
 */
function bisectAnchorY(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  baseArc: Arc,
  targetFrame: number,
  lineIdStart: number,
  useWindowDetection: boolean,
): { arc: Arc; lines: TrackLine[] } | null {
  const SEARCH_RADIUS = 14;
  const MAX_ITERS = 18;
  const windowStart = Math.max(
    0,
    targetFrame - SEARCH_RADIUS - K_BOUNCE_LANDING - PERSISTENCE_FRAMES - 2,
  );
  const windowEnd = targetFrame + PERSISTENCE_FRAMES + 1;

  const evalAt = (y: number): { frame: number | null; arc: Arc; lines: TrackLine[] } => {
    const arc: Arc = { ...baseArc, anchor: { x: baseArc.anchor.x, y } };
    const lines = arcToLines(arc, lineIdStart);
    // deno-lint-ignore no-explicit-any
    let eng: any = baseEngine;
    for (const line of lines) eng = eng.addLine(engineLineFromTrackLine(line));
    const det = useWindowDetection
      ? detectWindow(eng, windowStart, windowEnd)
      : detect(extractRawTrajectory(eng, targetFrame + PERSISTENCE_FRAMES + 1));
    const owned = new Set(lines.map((l) => l.id));
    const landing = det.events.find(
      (e) => e.type === "landing"
        && Math.abs(e.frame - targetFrame) <= SEARCH_RADIUS
        && intersectsLineIds(e, det, owned),
    );
    return { frame: landing ? landing.frame : null, arc, lines };
  };

  let lo = baseArc.anchor.y - SEARCH_RADIUS;
  let hi = baseArc.anchor.y + SEARCH_RADIUS;
  let bestRes = evalAt(baseArc.anchor.y);
  let bestErr = bestRes.frame !== null ? Math.abs(bestRes.frame - targetFrame) : Infinity;
  if (bestErr <= 1) return { arc: bestRes.arc, lines: bestRes.lines };

  for (let i = 0; i < MAX_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const r = evalAt(mid);
    if (r.frame !== null) {
      const err = Math.abs(r.frame - targetFrame);
      if (err < bestErr) { bestErr = err; bestRes = r; }
      if (err <= 1) return { arc: r.arc, lines: r.lines };
      if (r.frame > targetFrame) hi = mid; else lo = mid;
    } else {
      // No landing detected at this Y — line too far away. Move toward "closer".
      lo = mid;
    }
    if (hi - lo < 0.05) break;
  }

  // Coarse grid fallback if bisection didn't converge to ±1.
  if (bestErr > 1) {
    const STEPS = 16;
    for (let i = 0; i <= STEPS; i++) {
      const y = baseArc.anchor.y - SEARCH_RADIUS + (2 * SEARCH_RADIUS * i) / STEPS;
      const r = evalAt(y);
      if (r.frame !== null) {
        const err = Math.abs(r.frame - targetFrame);
        if (err < bestErr) { bestErr = err; bestRes = r; }
        if (err <= 1) return { arc: r.arc, lines: r.lines };
      }
    }
  }

  return bestErr <= 1 ? { arc: bestRes.arc, lines: bestRes.lines } : null;
}

// ─────────── Hard-gate helpers ───────────

function intersectsLineIds(
  event: DetEvent, det: Detection, owned: Set<number>,
): boolean {
  const lids = contactLineIdsAt(det, event.frame);
  return lids.some((id) => owned.has(id));
}

function countOffBeatLandings(
  events: DetEvent[], startFrame: number, endFrame: number,
  contactFrames: number[],
): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (e.frame < startFrame || e.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1);
    if (!nearAnyContact) n++;
  }
  return n;
}

// ─────────── Axis measurement ───────────

function measureAxes(
  det: Detection, gap: Gap, gapLines: TrackLine[],
  rangeEndFrame = gap.endFrame,
): SectionAxes {
  const out: SectionAxes = {};
  const a = gap.startFrame;
  const b = Math.min(rangeEndFrame, measurementLastFrame(det));

  // air
  let airFrames = 0, total = 0;
  for (let f = a; f <= b; f++) {
    if (airborneAt(det, f)) airFrames++;
    total++;
  }
  if (total > 0) out.air = airFrames / total;

  // speed
  let speedSum = 0, speedCount = 0;
  for (let f = a; f <= b; f++) {
    const s = speedAt(det, f);
    if (s !== undefined) { speedSum += s; speedCount++; }
  }
  if (speedCount > 0) out.speed = speedSum / speedCount / CALIB.SPEED_CAP;

  // contact_style — per-contact traversed / segment length, averaged.
  // For v0's single-Arc-per-gap, this reduces to: how many frames did the
  // rider stay in contact with this Arc, scaled by the per-line traversal
  // implied by velocity × frames vs line length. Approximation: count the
  // contiguous in-contact frames immediately following gap.endFrame and
  // divide by the median line length / mean speed (rough).
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  const medianLen = median(lineLens);
  if (medianLen > 0) {
    let contactFramesAtArc = 0;
    for (let f = gap.endFrame; f <= measurementLastFrame(det); f++) {
      if (airborneAt(det, f) === false) contactFramesAtArc++;
      else break;
    }
    const meanSpeed = (out.speed ?? 0) * CALIB.SPEED_CAP || 1;
    const traversed = meanSpeed * contactFramesAtArc;
    out.contact_style = Math.min(1, traversed / medianLen);
  }

  // grain
  if (lineLens.length > 0) {
    out.grain = Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP);
  }

  return out;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function axisCost(target: SectionAxes, achieved: SectionAxes): number {
  // Weighted L2 cost. For single-axis targets the weight does not change
  // ordering. For multi-axis targets, air needs extra pull because a good
  // speed/grain fit can otherwise win while spending too much time sliding.
  let cost = 0;
  for (const key of ["air", "speed", "contact_style", "grain"] as const) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) {
      const d = t - a;
      const weight = key === "air" ? 4 : 1;
      cost += weight * d * d;
    }
  }
  return cost;
}

// ─────────── Spec validation ───────────

function validateSpec(spec: Spec): void {
  if (spec.duration <= 0) throw new Error("Spec.duration must be > 0");
  for (const c of spec.contacts) {
    if (c.t < 0 || c.t > spec.duration) {
      throw new Error(`Contact.t (${c.t}) out of [0, ${spec.duration}]`);
    }
  }
  for (const s of spec.sections) {
    if (s.t0 < 0 || s.t1 > spec.duration || s.t0 >= s.t1) {
      throw new Error(`Section [${s.t0}, ${s.t1}] invalid for duration ${spec.duration}`);
    }
    if (s.air !== undefined && (s.air < 0 || s.air > 0.99)) {
      throw new Error(`Section.air (${s.air}) out of [0, 0.99]`);
    }
    for (const k of ["speed", "contact_style", "grain"] as const) {
      const v = s[k];
      if (v !== undefined && (v < 0 || v > 1)) {
        throw new Error(`Section.${k} (${v}) out of [0, 1]`);
      }
    }
  }
}

// ─────────── Track JSON assembly ───────────

function buildTrackJson(lines: TrackLine[], durationFrames: number): TrackJson {
  return {
    label: "v0",
    creator: "line/v0",
    description: "v0 compiler output",
    duration: durationFrames,
    version: "6.2",
    audio: null,
    startPosition: { x: 0, y: 0 },
    riders: [
      { startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines,
  };
}

// ─────────── DriftReport assembly ───────────

function buildDriftReport(
  det: Detection, spec: Spec, gaps: Gap[],
  contactFrames: number[], durationFrames: number,
  gapFailures: number[],
  fits: (GapFit | null)[],
): DriftReport {
  const contacts: ContactReport[] = spec.contacts.map((c) => {
    const target = secToFrame(c.t);
    const matched = det.events.find(
      (e) => e.type === "landing" && Math.abs(e.frame - target) <= 1,
    );
    if (matched) {
      return { t_target: c.t, t_actual: matched.frame / FPS, frame_error: matched.frame - target, status: "hit" };
    }
    // No tight match — find nearest landing within 5 frames (drift) or report missing.
    const near = det.events
      .filter((e) => e.type === "landing")
      .map((e) => ({ e, d: Math.abs(e.frame - target) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= 5) {
      return { t_target: c.t, t_actual: near.e.frame / FPS, frame_error: near.e.frame - target, status: "drift" };
    }
    return { t_target: c.t, t_actual: null, frame_error: null, status: "missing" };
  });

  const sections: SectionReport[] = spec.sections.map((sec, i) => {
    const f0 = secToFrame(sec.t0);
    const f1 = secToFrame(sec.t1);
    const survived = det.terminus.frame >= f1
      || det.terminus.reason === "endOfSpec";

    // Per-gap fits whose end-Contact falls in this section's frame range.
    // Used for axes that are most cleanly measured per-gap and then
    // aggregated (grain, contact_style).
    const fitsInSection: GapFit[] = [];
    for (let j = 0; j < gaps.length; j++) {
      const g = gaps[j];
      const f = fits[j];
      if (!g.endsWithContact || f === null) continue;
      if (g.endFrame >= f0 && g.endFrame <= f1) fitsInSection.push(f);
    }

    const achieved: SectionReport["axes"] = {};

    // air, speed: measured directly from the final-track simulation over the
    // section's frame range (rider-state axes).
    for (const k of ["air", "speed"] as const) {
      const t = sec[k];
      if (t === undefined) continue;
      const av = measureAxisOverRange(det, f0, f1, k);
      if (av !== null) achieved[k] = { target: t, achieved: av, error: Math.abs(t - av) };
    }

    // grain, contact_style: aggregate the per-gap achieved values across
    // gaps in this section. Per-gap measurement is more reliable than a
    // pure final-sim pass for these — grain is a property of the placed
    // geometry, and contact_style is naturally per-contact.
    for (const k of ["grain", "contact_style"] as const) {
      const t = sec[k];
      if (t === undefined) continue;
      const vals: number[] = [];
      for (const f of fitsInSection) {
        const v = f.achieved[k];
        if (v !== undefined) vals.push(v);
      }
      if (vals.length > 0) {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        achieved[k] = { target: t, achieved: m, error: Math.abs(t - m) };
      }
    }

    return { section_index: i, survived, axes: achieved };
  });

  const off_beat_landings = det.events
    .filter((e) => e.type === "landing"
      && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1))
    .map((e) => ({ frame: e.frame }));

  return {
    contacts,
    sections,
    off_beat_landings,
    terminus: { frame: det.terminus.frame, reason: det.terminus.reason },
  };
}

function measureAxisOverRange(
  det: Detection, f0: number, f1: number,
  axis: "air" | "speed",
): number | null {
  const b = Math.min(f1, measurementLastFrame(det));
  if (axis === "air") {
    let air = 0, total = 0;
    for (let f = f0; f <= b; f++) {
      if (airborneAt(det, f)) air++;
      total++;
    }
    return total > 0 ? air / total : null;
  }
  // axis === "speed"
  let sum = 0, n = 0;
  for (let f = f0; f <= b; f++) {
    const s = speedAt(det, f);
    if (s !== undefined) { sum += s; n++; }
  }
  return n > 0 ? sum / n / CALIB.SPEED_CAP : null;
}
