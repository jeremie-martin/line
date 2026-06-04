/**
 * Margin-based backward reachability (search_rethink_state_handoff.md §5.B).
 *
 * The handoff search commits a catch per contact; its `exit_state` (rider
 * velocity just after the catch settles) is the `entry_state` of the next
 * contact. Not every exit state leaves the next contact catchable. This module
 * computes, per contact gap, an approximate set of catchable ENTRY states (a
 * "region") and a `reachabilityPenalty(exit, nextRegion)` measuring how far a
 * candidate's exit sits from the nearest catchable entry of the next contact.
 * That margin is a robustness signal: selecting catches whose exit lands deep in
 * the next region commits to hand-offs the forward-fragile search can't easily
 * flip (see PLATEAU_CAMPAIGN_LOG.md).
 *
 * Contract: this only ORDERS/scores; the engine stays the ground-truth gate
 * (real candidates still pass the hard gates in core/candidate.ts), so an
 * approximate region can mis-prioritise but never emit an infeasible track.
 *
 * Determinism: a region is a pure function of `(seed, gapIndex)` and the gap
 * geometry — it never reads the budget or the live search prefix. It is built
 * from an isolated-origin local sim (a velocity slice of the catchable set), so
 * it is prefix-independent and memoised per `(seed, gapIndex)`. The memo MUST be
 * reset per compile (resetReachabilityCache) so it cannot leak across compiles.
 * Region sims are charged in sim-frames automatically via the detector.
 */

import { makeRng } from "../../lib/rng.ts";
import { getRiderMetered, PERSISTENCE_FRAMES } from "../../lib/detector.ts";
import {
  engineLineFromTrackLine,
  makeBaseEngine,
  type GapFit,
} from "../core/substrate.ts";
import {
  axisLookaheadEndFrame,
  tryCandidate,
} from "../core/candidate.ts";
import {
  readTargetState,
  sampleArcParams,
} from "../arc_placement.ts";
import { SPEED_AXIS, authoredSpeedToPx, type Gap } from "../types.ts";

/** Settle window after the contact frame at which we read the exit state, so a
 *  brief post-catch bounce has resolved (matches the candidate detector's
 *  persistence horizon). */
export const HANDOFF_SETTLE_FRAMES = PERSISTENCE_FRAMES + 1;

/** Isolated-origin probe arcs per grid entry. Small: this is a feasibility
 *  slice, not a quality search. */
const PROBE_ATTEMPTS = 2;
/** A grid entry counts as catchable only if some probe catch exits within this
 *  reduced-state distance of the NEXT region (chained right-to-left). */
const NEXT_REGION_ACCEPT_DISTANCE = 1.35;

export type HandoffState = {
  frame: number;
  vx: number;
  vy: number;
  speed: number;
  angleDeg: number;
  stability: number;
};

export type ReachabilityRegion = {
  gapIndex: number;
  /** Catchable ENTRY states for this contact gap (= acceptable exit states of
   *  the previous contact). */
  samples: HandoffState[];
  center: HandoffState | null;
};

export type ReachabilityStats = {
  gaps_computed: number;
  grid_probes: number;
  samples_kept: number;
};

// ── Per-compile memo (reset at compile entry; keyed on seed+gapIndex) ──────────
let regionCache = new Map<string, ReachabilityRegion>();
let stats: ReachabilityStats = { gaps_computed: 0, grid_probes: 0, samples_kept: 0 };

export function resetReachabilityCache(): void {
  regionCache = new Map();
  stats = { gaps_computed: 0, grid_probes: 0, samples_kept: 0 };
}

export function snapshotReachabilityStats(): ReachabilityStats {
  return { ...stats };
}

// ── Reduced state + metrics ────────────────────────────────────────────────────

export function readHandoffState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
): HandoffState {
  const rider = getRiderMetered(engine, frame);
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const vx = finiteOrZero(velocity.x);
  const vy = finiteOrZero(velocity.y);
  const speed = Math.hypot(vx, vy);
  const angleDeg = speed > 0 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;
  return { frame, vx, vy, speed, angleDeg, stability: handoffStability({ vx, vy, speed, angleDeg }) };
}

/** Higher is more robust. Penalizes ejection-prone states: over/under-speed,
 *  high vertical velocity, steep or backward velocity angle. Thresholds are the
 *  prototype's guesses; Phase A validates which dims carry signal. */
export function handoffStability(
  state: Pick<HandoffState, "vx" | "vy" | "speed" | "angleDeg">,
): number {
  const highSpeed = smoothExcess(state.speed, 13, 8);
  const lowSpeed = smoothExcess(1.25 - state.speed, 0, 1.25);
  const vertical = smoothExcess(Math.abs(state.vy), 11, 9);
  const steepAngle = smoothExcess(Math.abs(state.angleDeg), 70, 45);
  const backwards = state.vx < 0 ? Math.min(1, -state.vx / 6) : 0;
  const penalty = 0.38 * highSpeed
    + 0.22 * lowSpeed
    + 0.24 * vertical
    + 0.12 * steepAngle
    + 0.20 * backwards;
  return clamp01(1 - penalty);
}

/** Reduced-state distance. Per-axis normalisers (speed/8, angle/90, vy/10) are
 *  the prototype's guesses; Phase A reports per-dim signal so they can be
 *  revised before any selection wire-in. */
export function stateDistance(a: HandoffState, b: HandoffState): number {
  const speed = (a.speed - b.speed) / 8;
  const angle = angleDeltaDeg(a.angleDeg, b.angleDeg) / 90;
  const vy = (a.vy - b.vy) / 10;
  return Math.hypot(speed, angle, vy);
}

export function angleDeltaDeg(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

/** Distance from an exit state to the nearest catchable entry of `region`,
 *  capped. 0 when there is no next region (nothing to reach). */
export function reachabilityPenalty(
  exit: HandoffState | null,
  region: ReachabilityRegion | null | undefined,
): number {
  if (exit === null || region === null || region === undefined || region.samples.length === 0) {
    return 0;
  }
  let best = Infinity;
  for (const sample of region.samples) best = Math.min(best, stateDistance(exit, sample));
  return Math.min(3, best);
}

// ── Region computation (lazy, memoised, chained right-to-left) ──────────────────

/** Region of catchable entry states for the contact gap at `gapIndex`.
 *  Recursively requires the next contact's region (chained), memoised. */
export function getRegion(gaps: Gap[], seed: number, gapIndex: number): ReachabilityRegion {
  const key = `${seed | 0}:${gapIndex}`;
  const cached = regionCache.get(key);
  if (cached !== undefined) return cached;

  const gap = gaps[gapIndex];
  const nextRegion = nextContactRegion(gaps, seed, gapIndex);
  const local = localGap(gap);
  const samples: HandoffState[] = [];

  for (const [sampleIndex, entry] of velocityGrid(gap).entries()) {
    stats.grid_probes++;
    const engine = makeBaseEngine({
      position: { x: 0, y: 0 },
      velocity: { x: entry.vx, y: entry.vy },
    });
    const exit = bestLocalExit(engine, local, seed, gapIndex, sampleIndex, nextRegion);
    if (exit === null) continue;
    samples.push(entry);
    stats.samples_kept++;
  }

  const region: ReachabilityRegion = { gapIndex, samples, center: centerOf(samples) };
  regionCache.set(key, region);
  stats.gaps_computed++;
  return region;
}

/** The region of the next contact gap after `gapIndex`, or null at the tail. */
export function nextContactRegion(
  gaps: Gap[],
  seed: number,
  gapIndex: number,
): ReachabilityRegion | null {
  for (let i = gapIndex + 1; i < gaps.length; i++) {
    if (!gaps[i].endsWithContact) continue;
    return getRegion(gaps, seed, i);
  }
  return null;
}

/** Probe up to PROBE_ATTEMPTS isolated catches from this entry; return the exit
 *  state whose reach into the next region is smallest (and accepted), else null
 *  (this entry can't cleanly bridge to the next contact). */
function bestLocalExit(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  seed: number,
  gapIndex: number,
  sampleIndex: number,
  nextRegion: ReachabilityRegion | null,
): HandoffState | null {
  const rider = getRiderMetered(engine, gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetState(engine, gap.endFrame, refX, refY);
  const allContactFrames = [gap.endFrame];
  const axisMeasureEnd = axisLookaheadEndFrame(gap, allContactFrames);
  const rng = makeRng((seed | 0) * 1_000_003 + gapIndex * 9_176 + sampleIndex + 1);

  let best: HandoffState | null = null;
  let bestPenalty = Infinity;
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
    const arc = sampleArcParams(rng, refX, refY, gap.targets, targetState, attempt, gap);
    const fit = tryCandidate(engine, gap, arc, 1, allContactFrames, axisMeasureEnd, gap.targets, true);
    if (fit === null) continue;
    const exit = exitAfterFit(engine, fit, gap.endFrame + HANDOFF_SETTLE_FRAMES);
    const penalty = reachabilityPenalty(exit, nextRegion);
    if (nextRegion !== null && nextRegion.samples.length > 0 && penalty > NEXT_REGION_ACCEPT_DISTANCE) {
      continue;
    }
    if (penalty < bestPenalty) {
      best = exit;
      bestPenalty = penalty;
    }
  }
  return best;
}

function exitAfterFit(
  // deno-lint-ignore no-explicit-any
  engine: any,
  fit: GapFit,
  frame: number,
): HandoffState {
  let child = engine;
  for (const line of fit.lines) child = child.addLine(engineLineFromTrackLine(line));
  return readHandoffState(child, frame);
}

/** A gap re-based to an isolated origin (startFrame 0), so the region is a pure
 *  function of the entry velocity + gap geometry, independent of the prefix. */
function localGap(gap: Gap): Gap {
  const duration = Math.max(1, gap.endFrame - gap.startFrame);
  return {
    index: gap.index,
    startFrame: 0,
    endFrame: duration,
    endsWithContact: true,
    targets: { ...gap.targets },
  };
}

/** A small fixed grid of entry velocities (3 speeds × 3 angles) around the gap's
 *  target speed, with steeper angles when the gap wants high air. */
function velocityGrid(gap: Gap): HandoffState[] {
  const rawTargetSpeed = gap.targets.speed === undefined
    ? SPEED_AXIS.UNTARGETED_REACHABILITY_PX_PER_FRAME
    : authoredSpeedToPx(gap.targets.speed);
  const targetSpeed = Math.max(1.5, Math.min(14, rawTargetSpeed));
  const speeds = uniqueSorted(
    [targetSpeed - 3, targetSpeed, targetSpeed + 3].map((s) => Math.max(1.5, Math.min(16, s))),
  );
  const baseAngles = gap.targets.air !== undefined && gap.targets.air > 0.65
    ? [25, 50, 75]
    : [0, 25, 50];
  const out: HandoffState[] = [];
  for (const speed of speeds) {
    for (const angleDeg of baseAngles) {
      const rad = (angleDeg * Math.PI) / 180;
      const vx = speed * Math.cos(rad);
      const vy = speed * Math.sin(rad);
      out.push({
        frame: gap.startFrame,
        vx,
        vy,
        speed,
        angleDeg,
        stability: handoffStability({ vx, vy, speed, angleDeg }),
      });
    }
  }
  return out;
}

function centerOf(samples: HandoffState[]): HandoffState | null {
  if (samples.length === 0) return null;
  const mean = (key: keyof Pick<HandoffState, "vx" | "vy" | "speed" | "angleDeg" | "stability">) =>
    samples.reduce((sum, s) => sum + s[key], 0) / samples.length;
  return {
    frame: samples[0].frame,
    vx: mean("vx"),
    vy: mean("vy"),
    speed: mean("speed"),
    angleDeg: mean("angleDeg"),
    stability: mean("stability"),
  };
}

function uniqueSorted(values: number[]): number[] {
  const rounded = values.map((v) => Number(v.toFixed(3)));
  return [...new Set(rounded)].sort((a, b) => a - b);
}

function smoothExcess(value: number, start: number, span: number): number {
  if (span <= 0) return value > start ? 1 : 0;
  return clamp01((value - start) / span);
}

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
