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
 * flip (see docs/archive/PLATEAU_CAMPAIGN_LOG.md).
 *
 * Contract: this only ORDERS/scores; the engine stays the ground-truth gate
 * (real candidates still pass the hard gates in core/candidate.ts), so an
 * approximate region can mis-prioritise but never emit an infeasible track.
 *
 * Determinism: a region is a pure function of `(seed, gapIndex)` and the gap
 * geometry — it never reads the budget or the live search prefix. It is built
 * from an isolated-origin local sim (a velocity slice of the catchable set), so
 * it is prefix-independent and memoised per `(seed, gapIndex)`. Within one
 * compile the gaps are fixed, so `(seed, gapIndex)` identifies a region uniquely;
 * the ONLY cross-compile hazard is the memo surviving into the next compile (a
 * different spec reusing this spec's regions under a colliding key). The memo
 * therefore MUST be reset per compile. This module is currently probe-only (not
 * imported by the handoff compile path), so `resetReachabilityCache` is called
 * directly by reach_probe.ts; it is ALSO registered with the per-compile
 * lifecycle (core/compile_lifecycle.ts), so the day reachability is wired into
 * the search its reset joins compileHandoffInternal automatically and the leak
 * cannot silently reappear. Region sims are charged in sim-frames via the detector.
 */

import { makeRng } from "../lib/rng.ts";
import { getRiderMetered, PERSISTENCE_FRAMES } from "../lib/detector.ts";
import {
  engineLineFromTrackLine,
  makeBaseEngine,
  type GapFit,
} from "./core/substrate.ts";
import {
  axisLookaheadEndFrame,
  tryCandidate,
} from "./core/candidate.ts";
import {
  readPreTargetSledTrace,
  readTargetStateFromRider,
  sampleArcParams,
  type PreTargetSledTrace,
} from "./arc_placement.ts";
import { SPEED_AXIS, authoredSpeedToPx, type Gap } from "./types.ts";
import { registerCompileReset } from "./core/compile_lifecycle.ts";

/** Settle window after the contact frame at which we read the exit state, so a
 *  brief post-catch bounce has resolved (matches the candidate detector's
 *  persistence horizon). */
export const HANDOFF_SETTLE_FRAMES = PERSISTENCE_FRAMES + 1;

/**
 * Unvalidated prototype tuning constants for this backward-reachability probe.
 *
 * Every number below is a provisional guess carried over from the module's
 * original prototype: absolute px/frame/degree thresholds and hand-picked
 * penalty weights that assume the current physics scaling. The module docstring's
 * "Phase A validates which dims carry signal" refers to a validation phase that
 * never ran — the module was never wired into the production compile path (see
 * simplification catalog #117) — so NONE of these values has been empirically
 * confirmed against the golden benchmark.
 *
 * They are gathered here, rather than scattered as bare literals through
 * handoffStability / stateDistance / velocityGrid / the probe loop, purely so a
 * future validation pass has a single place to inspect and revise them. This is
 * a naming/grouping reorganization ONLY: no value has changed.
 */
const REACHABILITY_PROTOTYPE_CONFIG = {
  /** Isolated-origin probe arcs per grid entry. Small: this is a feasibility
   *  slice, not a quality search. */
  probeAttempts: 2,
  /** A grid entry counts as catchable only if some probe catch exits within this
   *  reduced-state distance of the NEXT region (chained right-to-left). */
  nextRegionAcceptDistance: 1.35,
  /** Cap on reachabilityPenalty (reduced-state distance to nearest catchable
   *  entry of the next region). */
  penaltyCap: 3,
  /** handoffStability: per-dim smoothExcess thresholds + penalty weights.
   *  Higher penalty = more ejection-prone (over/under-speed, high vertical
   *  velocity, steep or backward velocity angle). lowSpeed reuses `threshold`
   *  as both the pivot and the smoothExcess span. */
  stability: {
    highSpeed: { start: 13, span: 8, weight: 0.38 },
    lowSpeed: { threshold: 1.25, weight: 0.22 },
    vertical: { start: 11, span: 9, weight: 0.24 },
    steepAngle: { start: 70, span: 45, weight: 0.12 },
    backwards: { divisor: 6, weight: 0.20 },
  },
  /** stateDistance: per-axis normalisers for the reduced-state metric
   *  (speed/8, angle/90, vy/10). */
  distanceNormalisers: { speed: 8, angle: 90, vy: 10 },
  /** velocityGrid: entry-velocity grid (3 speeds × 3 angles) around the gap's
   *  target speed, with steeper angles when the gap wants high air. */
  grid: {
    targetSpeedClamp: { min: 1.5, max: 14 },
    speedOffset: 3,
    gridSpeedClamp: { min: 1.5, max: 16 },
    highAirThreshold: 0.65,
    highAirAngles: [25, 50, 75],
    lowAirAngles: [0, 25, 50],
  },
} as const;

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
registerCompileReset(resetReachabilityCache);

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
  const cfg = REACHABILITY_PROTOTYPE_CONFIG.stability;
  const highSpeed = smoothExcess(state.speed, cfg.highSpeed.start, cfg.highSpeed.span);
  const lowSpeed = smoothExcess(cfg.lowSpeed.threshold - state.speed, 0, cfg.lowSpeed.threshold);
  const vertical = smoothExcess(Math.abs(state.vy), cfg.vertical.start, cfg.vertical.span);
  const steepAngle = smoothExcess(Math.abs(state.angleDeg), cfg.steepAngle.start, cfg.steepAngle.span);
  const backwards = state.vx < 0 ? Math.min(1, -state.vx / cfg.backwards.divisor) : 0;
  const penalty = cfg.highSpeed.weight * highSpeed
    + cfg.lowSpeed.weight * lowSpeed
    + cfg.vertical.weight * vertical
    + cfg.steepAngle.weight * steepAngle
    + cfg.backwards.weight * backwards;
  return clamp01(1 - penalty);
}

/** Reduced-state distance. Per-axis normalisers (speed/8, angle/90, vy/10) are
 *  the prototype's guesses; Phase A reports per-dim signal so they can be
 *  revised before any selection wire-in. */
export function stateDistance(a: HandoffState, b: HandoffState): number {
  const norm = REACHABILITY_PROTOTYPE_CONFIG.distanceNormalisers;
  const speed = (a.speed - b.speed) / norm.speed;
  const angle = angleDeltaDeg(a.angleDeg, b.angleDeg) / norm.angle;
  const vy = (a.vy - b.vy) / norm.vy;
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
  return Math.min(REACHABILITY_PROTOTYPE_CONFIG.penaltyCap, best);
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

/** Probe up to `probeAttempts` isolated catches from this entry; return the exit
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
  const targetState = readTargetStateFromRider(rider, refX, refY);
  const allContactFrames = [gap.endFrame];
  const axisMeasureEnd = axisLookaheadEndFrame(gap, allContactFrames);
  const rng = makeRng((seed | 0) * 1_000_003 + gapIndex * 9_176 + sampleIndex + 1);
  let preTargetTrace: PreTargetSledTrace | undefined;
  const preTargetSledTrace = () => preTargetTrace ??= readPreTargetSledTrace(engine, gap);

  let best: HandoffState | null = null;
  let bestPenalty = Infinity;
  for (let attempt = 0; attempt < REACHABILITY_PROTOTYPE_CONFIG.probeAttempts; attempt++) {
    const arc = sampleArcParams(rng, refX, refY, gap.targets, targetState, attempt, gap);
    const fit = tryCandidate(
      engine, gap, arc, 1, allContactFrames, axisMeasureEnd, gap.targets, true,
      undefined, preTargetSledTrace,
    );
    if (fit === null) continue;
    const exit = exitAfterFit(engine, fit, gap.endFrame + HANDOFF_SETTLE_FRAMES);
    const penalty = reachabilityPenalty(exit, nextRegion);
    if (nextRegion !== null && nextRegion.samples.length > 0 && penalty > REACHABILITY_PROTOTYPE_CONFIG.nextRegionAcceptDistance) {
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
  const child = engine.addLine(fit.lines.map((line) => engineLineFromTrackLine(line)));
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
  const cfg = REACHABILITY_PROTOTYPE_CONFIG.grid;
  const rawTargetSpeed = gap.targets.speed === undefined
    ? SPEED_AXIS.UNTARGETED_REACHABILITY_PX_PER_FRAME
    : authoredSpeedToPx(gap.targets.speed);
  const targetSpeed = Math.max(cfg.targetSpeedClamp.min, Math.min(cfg.targetSpeedClamp.max, rawTargetSpeed));
  const speeds = uniqueSorted(
    [targetSpeed - cfg.speedOffset, targetSpeed, targetSpeed + cfg.speedOffset].map(
      (s) => Math.max(cfg.gridSpeedClamp.min, Math.min(cfg.gridSpeedClamp.max, s)),
    ),
  );
  const baseAngles = gap.targets.air !== undefined && gap.targets.air > cfg.highAirThreshold
    ? cfg.highAirAngles
    : cfg.lowAirAngles;
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
