/**
 * Type definitions for the rebuild optimizer.
 *
 * These types compose the public surface. Behavior lives elsewhere:
 *   - sample.ts      — atomic per-candidate ops
 *   - solver.ts      — single-gap K-candidate solver
 *   - greedy.ts      — multi-gap chainer (= LDS discrepancy-0 walk)
 *   - sim_frames.ts  — work-unit instrumentation at the extraction boundary
 *   - lds.ts         — limited-discrepancy leaf enumeration
 *   - register.ts    — best-so-far register with deterministic comparator
 *   - api.ts         — public compile() entry point
 *
 * We deliberately re-export the relevant existing types from
 * `../types.ts` rather than redefining them — Spec, Gap, DriftReport,
 * CompileStats are the same data we've been working with all along.
 */

import type { TrackJson } from "../../lib/primitive.ts";
import type {
  CompileStats,
  DriftReport,
  Gap,
  Spec,
} from "../types.ts";

// ─────────── Re-exports of existing types ───────────

export type { CompileStats, DriftReport, Gap, Spec };

// ─────────── New types for the rebuild ───────────

/** The compute budget controlling how much work the optimizer is
 *  allowed to do.
 *
 *  - `work` : abstract iteration units measured in **simulated rider
 *             frames** (one frame = one engine integration step,
 *             charged at the trajectory-extraction boundary). Same
 *             (spec, seed, units) → byte-identical Track on any
 *             machine. Cheat-resistant: you cannot establish a
 *             candidate's physical viability without simulating its
 *             frames, so any genuine extra search work eventually
 *             shows up as more sim_frames and is charged
 *             proportionally.
 *
 *  Why simulated frames over `engine.addLine`: addLine registers
 *  geometry, but wall-clock cost is dominated by per-frame stepping
 *  (lr-core uses spatial-grid collision; per-frame cost is O(local
 *  density), not O(total lines) — verified in Stage 0b). Sim-frames
 *  is therefore the unit that satisfies Property 2 by construction.
 *
 *  A `wall_ms` mode is intentionally NOT part of the core contract.
 *  Wall-clock cannot be deterministic across machines. If a use case
 *  needs a real-time deadline later, it can be added as an explicitly-
 *  non-deterministic convenience wrapper. */
export type Budget = { kind: "work"; units: number };

/** Inputs to the public `compile()` entry point. */
export type CompileInput = {
  spec: Spec;
  seed?: number;
  /** If omitted, the optimizer runs to natural completion (no budget cap). */
  budget?: Budget;
};

/** Outputs from the public `compile()` entry point. Mirrors the
 *  shape returned by the legacy `compile.ts` so consumers don't have
 *  to special-case which compiler produced the result. */
export type CompileOutput = {
  track: TrackJson;
  report: DriftReport;
  stats: CompileStats;
};

/** A scalar score used for "is track A better than track B" comparisons.
 *  The `axis_quality` field of `scoreDriftReport` (../score.ts) in [0, 1];
 *  bigger is better. Used by `register.ts`'s leaf comparator. */
export type Score = number;
