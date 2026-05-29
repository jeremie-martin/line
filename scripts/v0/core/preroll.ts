/**
 * v0 preroll-start optimization — chooses an initial rider velocity (and, by
 * extension, the track's opening conditions) before the main compile so the
 * first catch and the opening section's axes land well.
 *
 * This module is a pure MOVE of the preroll cluster that previously lived in
 * `../compile.ts`. The dependency direction is one-way: `compile.ts` and the
 * optimizer (`../optimizer/*`) import from here, never the reverse. These
 * functions depend only on `../../lib/*`, `../types.ts`, `./substrate.ts`, and
 * `./candidate.ts` (for `generateRankedCandidates`), so they carry no
 * compiler-only state.
 */

import {
  detect, extractRawTrajectory, getRiderMetered,
  type Detection,
} from "../../lib/detector.ts";
import { makeRng } from "../../lib/rng.ts";
import {
  type Spec, type SectionAxes, type Gap,
  CALIB, FPS, START_DEFAULTS, secToFrame,
} from "../types.ts";
import {
  type GapFit,
  clamp,
  sliceTimeline,
  effectiveAxes,
  sampleGapTargets,
  resolveStartState,
  makeBaseEngine,
  measureAxisOverRange,
  engineLineFromTrackLine,
} from "./substrate.ts";
import {
  generateRankedCandidates,
  countOffBeatLandings,
  axisCost,
} from "./candidate.ts";

const PREROLL_PREFIX_STARTS = 6;
const PREROLL_PREFIX_MAX_GAPS = 4;
const PREROLL_PREFIX_EXTRA_FRAMES = FPS;
const PREROLL_PREFIX_ROBUSTNESS_WEIGHT = 0.03;

export function withOptimizedPrerollStart(spec: Spec, seed: number): Spec {
  if ((spec.preroll ?? 0) <= 0) return spec;

  // A manual `start` is already an explicit initial condition. Consume
  // `preroll` so this proof-of-concept never shifts the authored timeline.
  if (spec.start !== undefined) return { ...spec, preroll: undefined };

  return {
    ...spec,
    start: choosePrerollStart(spec, seed),
    preroll: undefined,
  };
}

function choosePrerollStart(spec: Spec, seed: number): NonNullable<Spec["start"]> {
  const fallback: NonNullable<Spec["start"]> = {
    vx: START_DEFAULTS.VELOCITY.x,
    vy: START_DEFAULTS.VELOCITY.y,
  };
  const contactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const firstContactFrame = contactFrames[0];
  if (firstContactFrame === undefined) return fallback;

  const durationFrames = secToFrame(spec.duration);
  const firstAxes = firstSectionAxes(spec);
  if ((firstAxes.speed ?? 0.45) <= 0.45 && (firstAxes.air ?? 0.5) <= 0.35) {
    return fallback;
  }

  const sampledGaps = sliceTimeline(contactFrames, durationFrames);
  const targetRng = makeRng(seed);
  for (const gap of sampledGaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, targetRng);
  }
  const firstGap = sampledGaps[0];
  if (firstGap === undefined || !firstGap.endsWithContact) return fallback;
  const prefixGapCount = prerollPrefixGapCount(spec, sampledGaps);
  const prefixWeight = prerollPrefixWeight(firstAxes, sampledGaps, prefixGapCount);

  let best = fallback;
  let bestCost = Infinity;
  let bestSurvivors = 0;
  const debugPrefixScores: {
    vx: number;
    vy: number;
    firstCost: number;
    prefixCost: number;
    robustnessCost: number;
    cost: number;
    survivors: number;
  }[] = [];
  const scoredStarts: {
    start: NonNullable<Spec["start"]>;
    firstCost: number;
    survivors: number;
  }[] = [];

  for (const start of prerollStartCandidates(firstAxes)) {
    const startState = resolveStartState({ ...spec, start });
    const baseEngine = makeBaseEngine(startState);
    const candidates = generateRankedCandidates(
      baseEngine,
      firstGap,
      makeRng((seed | 0) * 1000003 + 1),
      1,
      contactFrames,
      durationFrames,
    );
    const firstCost = prerollStartCost(baseEngine, firstGap, candidates, start);
    scoredStarts.push({ start, firstCost, survivors: candidates.length });
  }

  scoredStarts.sort((a, b) => a.firstCost - b.firstCost);

  if (prefixWeight > 0) {
    const prefixStarts = scoredStarts.slice(0, PREROLL_PREFIX_STARTS);
    const maxSurvivors = Math.max(1, ...prefixStarts.map((scored) => scored.survivors));
    for (const scored of prefixStarts) {
      const prefixCost = prerollPrefixStartCost(
        spec, seed, scored.start, sampledGaps, contactFrames, durationFrames, prefixGapCount,
      );
      const robustnessCost = PREROLL_PREFIX_ROBUSTNESS_WEIGHT
        * (1 - scored.survivors / maxSurvivors);
      const cost = scored.firstCost + prefixWeight * (prefixCost + robustnessCost);
      if (process.env.V0_DEBUG_PREROLL === "1") {
        debugPrefixScores.push({
          vx: Number(scored.start.vx.toFixed(3)),
          vy: Number(scored.start.vy.toFixed(3)),
          firstCost: Number(scored.firstCost.toFixed(4)),
          prefixCost: Number(prefixCost.toFixed(4)),
          robustnessCost: Number(robustnessCost.toFixed(4)),
          cost: Number(cost.toFixed(4)),
          survivors: scored.survivors,
        });
      }
      if (cost + 1e-9 < bestCost) {
        best = scored.start;
        bestCost = cost;
        bestSurvivors = scored.survivors;
      }
    }
  } else {
    const scored = scoredStarts[0];
    if (scored !== undefined) {
      best = scored.start;
      bestCost = scored.firstCost;
      bestSurvivors = scored.survivors;
    }
  }

  if (process.env.V0_DEBUG_PREROLL === "1") {
    console.error("preroll-start", {
      firstContactFrame,
      prefixGapCount: prefixWeight > 0 ? prefixGapCount : 0,
      prefixWeight: Number(prefixWeight.toFixed(3)),
      vx: Number(best.vx.toFixed(3)),
      vy: Number(best.vy.toFixed(3)),
      cost: Number(bestCost.toFixed(4)),
      survivors: bestSurvivors,
      prefixScores: debugPrefixScores,
    });
  }

  return best;
}

function prerollStartCost(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  firstGap: Gap,
  candidates: GapFit[],
  start: NonNullable<Spec["start"]>,
): number {
  const speed = Math.hypot(start.vx, start.vy);
  const targetSpeedPx = firstGap.targets.speed === undefined
    ? null
    : firstGap.targets.speed * CALIB.SPEED_CAP;
  const speedShortfallPenalty =
    targetSpeedPx !== null
    && (firstGap.targets.air ?? 0.5) <= 0.35
    && targetSpeedPx >= 6
    && speed < targetSpeedPx * 0.45
      ? 0.75
      : 0;
  const speedPenalty = targetSpeedPx === null
    ? 0.0005 * Math.pow(speed / CALIB.SPEED_CAP, 2)
    : 0.01 * Math.pow((speed - targetSpeedPx) / CALIB.SPEED_CAP, 2)
      + speedShortfallPenalty;

  const best = candidates[0];
  if (best !== undefined) {
    const robustnessCredit = Math.min(0.03, candidates.length * 0.002);
    return best.cost + speedPenalty - robustnessCredit;
  }

  const rider = getRiderMetered(baseEngine, firstGap.endFrame);
  const v = rider.velocity ?? { x: start.vx, y: start.vy };
  const achievedSpeed = Math.hypot(v.x, v.y) / CALIB.SPEED_CAP;
  const speedCost = firstGap.targets.speed === undefined
    ? 0
    : Math.pow(firstGap.targets.speed - achievedSpeed, 2);
  const airCost = firstGap.targets.air === undefined
    ? 0
    : Math.pow(firstGap.targets.air - 1, 2);
  return 1000 + speedCost + airCost + speedPenalty;
}

function prerollPrefixGapCount(spec: Spec, gaps: Gap[]): number {
  const firstSectionEnd = firstSectionEndFrame(spec);
  const targetFrame = Math.min(
    secToFrame(spec.duration),
    firstSectionEnd + PREROLL_PREFIX_EXTRA_FRAMES,
  );
  let count = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact || gap.endFrame > targetFrame) break;
    count++;
    if (count >= PREROLL_PREFIX_MAX_GAPS) break;
  }
  return Math.max(1, count);
}

function firstSectionEndFrame(spec: Spec): number {
  const activeAtZero = spec.sections
    .filter((sec) => sec.t0 <= 0 && sec.t1 > 0)
    .sort((a, b) => a.t1 - b.t1)[0];
  if (activeAtZero !== undefined) return secToFrame(activeAtZero.t1);
  const first = [...spec.sections].sort((a, b) => a.t0 - b.t0)[0];
  return first !== undefined ? secToFrame(first.t1) : secToFrame(spec.duration);
}

function prerollPrefixWeight(
  firstAxes: SectionAxes,
  gaps: Gap[],
  prefixGapCount: number,
): number {
  if (prefixGapCount <= 1) return 0;
  const openingSpeed = firstAxes.speed ?? 0;
  const openingAir = firstAxes.air ?? 0.5;
  const openingContact = firstAxes.contact_style ?? 0.5;
  const firstGap = gaps[0];
  const secondGap = gaps[1];
  if (firstGap === undefined || secondGap === undefined) return 0;

  const firstDelayS = firstGap.endFrame / FPS;
  const secondIntervalS = (secondGap.endFrame - firstGap.endFrame) / FPS;
  const speedPressure = smoothstep(0.55, 0.95, openingSpeed);
  const airPressure = smoothstep(0.45, 0.85, openingAir);
  const shortContactPressure = 1 - smoothstep(0.25, 0.7, openingContact);
  const earlyBeatPressure = 1 - smoothstep(0.75, 2, firstDelayS);
  const denseBeatPressure = 1 - smoothstep(0.25, 0.75, secondIntervalS);

  // The first catch remains the anchor of the initial-condition search; the
  // prefix only adds influence when the opening asks for fast airy skips on a
  // dense beat pattern, where first-contact feasibility underconstrains the
  // desired state at t=0.
  return 0.65
    * speedPressure
    * airPressure
    * shortContactPressure
    * earlyBeatPressure
    * denseBeatPressure;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function prerollPrefixStartCost(
  spec: Spec,
  seed: number,
  start: NonNullable<Spec["start"]>,
  gaps: Gap[],
  contactFrames: number[],
  durationFrames: number,
  prefixGapCount: number,
): number {
  const startState = resolveStartState({ ...spec, start });
  let engine = makeBaseEngine(startState);
  let nextLineId = 1;
  const rng = makeRng((seed | 0) * 1000003 + 1);
  const prefixFits: GapFit[] = [];
  let totalGapCost = 0;

  for (let i = 0; i < prefixGapCount; i++) {
    const gap = gaps[i];
    if (gap === undefined || !gap.endsWithContact) break;
    const candidates = generateRankedCandidates(
      engine, gap, rng, nextLineId, contactFrames, durationFrames,
    );
    const fit = candidates[0];
    if (fit === undefined) {
      break;
    }
    prefixFits.push(fit);
    totalGapCost += fit.cost;
    for (const line of fit.lines) engine = engine.addLine(engineLineFromTrackLine(line));
    nextLineId += fit.lines.length;
  }

  if (prefixFits.length === 0) return 2;
  const prefixEndFrame = gaps[prefixFits.length - 1].endFrame;
  const det = detect(extractRawTrajectory(engine, prefixEndFrame + 20));
  const prefixContacts = contactFrames.filter((frame) => frame <= prefixEndFrame);
  let syncPenalty = 0;
  for (const frame of prefixContacts) {
    const hit = det.events.some(
      (event) => event.type === "landing" && Math.abs(event.frame - frame) <= 1,
    );
    if (!hit) syncPenalty += 1;
  }
  syncPenalty += countOffBeatLandings(det.events, 0, prefixEndFrame, prefixContacts);
  if (det.terminus.frame < prefixEndFrame && det.terminus.reason !== "endOfSpec") {
    syncPenalty += 1;
  }
  const completion = prefixFits.length / prefixGapCount;
  const completionPenalty = 1 - completion;
  const normalizedSyncPenalty = syncPenalty / Math.max(1, prefixGapCount);

  return totalGapCost / prefixFits.length
    + prerollPrefixAxisCost(det, spec, gaps, prefixFits, prefixEndFrame)
    + completionPenalty
    + normalizedSyncPenalty;
}

function prerollPrefixAxisCost(
  det: Detection,
  spec: Spec,
  gaps: Gap[],
  fits: GapFit[],
  prefixEndFrame: number,
): number {
  let weightedCost = 0;
  let totalFrames = 0;
  for (const sec of spec.sections) {
    const f0 = Math.max(0, secToFrame(sec.t0));
    const f1 = Math.min(prefixEndFrame, secToFrame(sec.t1));
    if (f1 <= f0) continue;

    const achieved: SectionAxes = {};
    if (sec.air !== undefined) {
      const air = measureAxisOverRange(det, f0, f1, "air");
      if (air !== null) achieved.air = air;
    }
    if (sec.speed !== undefined) {
      const speed = measureAxisOverRange(det, f0, f1, "speed");
      if (speed !== null) achieved.speed = speed;
    }
    for (const key of ["grain", "contact_style"] as const) {
      if (sec[key] === undefined) continue;
      const vals: number[] = [];
      for (let i = 0; i < fits.length; i++) {
        const gap = gaps[i];
        const fit = fits[i];
        if (gap === undefined || fit === undefined) continue;
        if (gap.endFrame >= f0 && gap.endFrame <= f1 && fit.achieved[key] !== undefined) {
          vals.push(fit.achieved[key]);
        }
      }
      if (vals.length > 0) {
        achieved[key] = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      }
    }

    const frames = f1 - f0 + 1;
    weightedCost += frames * axisCost(sec, achieved);
    totalFrames += frames;
  }
  return totalFrames > 0 ? weightedCost / totalFrames : 0;
}

function prerollStartCandidates(firstAxes: SectionAxes): NonNullable<Spec["start"]>[] {
  const targetSpeed = (firstAxes.speed ?? 0.45) * CALIB.SPEED_CAP;
  const slowModerateAirOpening = (firstAxes.speed ?? 0.45) <= 0.45
    && (firstAxes.air ?? 0.5) >= 0.35
    && (firstAxes.air ?? 0.5) < 0.6;
  const speedAnchors = targetSpeed >= 9
    ? [6, 8.5, 11, 13.5]
    : targetSpeed >= 6
    ? [3, 5.5, 8, 10.5]
    : [0.4, 2, 4, 6];
  const speeds = uniqueRounded([
    START_DEFAULTS.VELOCITY.x,
    ...(slowModerateAirOpening ? [] : speedAnchors),
    targetSpeed * 0.75,
    targetSpeed,
    targetSpeed * (slowModerateAirOpening ? 1.1 : 1.2),
  ])
    .filter((speed) => speed > 0 && speed <= START_DEFAULTS.VELOCITY_SANITY_CAP)
    .sort((a, b) => a - b);
  const angles = slowModerateAirOpening
    ? [-8, 5, 18]
    : prerollStartAngles(firstAxes);
  const out: NonNullable<Spec["start"]>[] = [
    { vx: START_DEFAULTS.VELOCITY.x, vy: START_DEFAULTS.VELOCITY.y },
  ];
  const seen = new Set(out.map(startKey));

  for (const speed of speeds) {
    for (const angleDeg of angles) {
      const angle = angleDeg * Math.PI / 180;
      const start = {
        vx: round3(Math.cos(angle) * speed),
        vy: round3(Math.sin(angle) * speed),
      };
      const key = startKey(start);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(start);
    }
  }

  return out;
}

function prerollStartAngles(firstAxes: SectionAxes): number[] {
  const air = firstAxes.air ?? 0.5;
  if (air >= 0.7) return [-35, -18, -5, 10, 25];
  if (air <= 0.3) return [-5, 8, 20, 35, 50];
  return [-20, -8, 5, 18, 32];
}

function uniqueRounded(xs: number[]): number[] {
  const out: number[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const rounded = round3(x);
    const key = rounded.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rounded);
  }
  return out;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function startKey(start: NonNullable<Spec["start"]>): string {
  return `${start.vx.toFixed(3)},${start.vy.toFixed(3)}`;
}

function firstSectionAxes(spec: Spec): SectionAxes {
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  const activeAtZero = spec.sections.filter((sec) => sec.t0 <= 0 && sec.t1 >= 0);
  const sections = activeAtZero.length > 0
    ? activeAtZero
    : [...spec.sections].sort((a, b) => a.t0 - b.t0).slice(0, 1);
  for (const sec of sections) {
    if (sec.air !== undefined) axes.air = sec.air;
    if (sec.speed !== undefined) axes.speed = sec.speed;
    if (sec.contact_style !== undefined) axes.contact_style = sec.contact_style;
    if (sec.grain !== undefined) axes.grain = sec.grain;
  }
  return axes;
}
