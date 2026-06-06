/**
 * Type definitions for the handoff optimizer.
 *
 * These types compose the public surface. Behavior lives elsewhere:
 *   - sample.ts      — atomic per-candidate ops
 *   - solver.ts      — single-gap candidate solver
 *   - node.ts        — prefix-search state and candidate expansion
 *   - handoff.ts     — public compileHandoff entry point
 *   - sim_frames.ts  — work-unit instrumentation at the extraction boundary
 *   - register.ts    — best-so-far register with deterministic comparator
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

/** A compute checkpoint in simulated rider frames.
 *
 * Budgets are plain positive frame counts. They are stop/checkpoint thresholds
 * only: the search policy must never read the current budget. A compile with
 * multiple budgets walks one deterministic search sequence and snapshots the
 * best-so-far register at each threshold.
 */
export type CompileBudget = number;

/** Inputs to the compiler entry point. */
export type CompileInput = {
  spec: Spec;
  seed?: number;
  budgets: CompileBudget[];
};

/** Output for one budget checkpoint. */
export type CompileOutput = {
  track: TrackJson;
  report: DriftReport;
  stats: CompileStats;
};

/** A compiler entry point produces one checkpoint per (independent) budget run. */
export type CompileCheckpoint = CompileOutput & {
  budget: CompileBudget;
};

/** A scalar score used for "is track A better than track B" comparisons.
 *  The `axis_quality` field of `scoreDriftReport` (../score.ts) in [0, 1];
 *  bigger is better. Used by `register.ts`'s leaf comparator. */
export type Score = number;
