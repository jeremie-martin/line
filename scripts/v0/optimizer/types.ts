/**
 * Type definitions for the rebuild optimizer.
 *
 * These types compose the public surface. Behavior lives elsewhere:
 *   - sample.ts    — atomic per-candidate ops
 *   - solver.ts    — single-gap K-candidate solver
 *   - greedy.ts    — multi-gap chainer
 *   - envelope.ts  — best-so-far wrapper
 *   - api.ts       — public compile() entry point
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
 *  allowed to do. Two kinds:
 *
 *  - `work` : abstract iteration units. Deterministic across machines.
 *             The unit is one `engine.addLine` call (the lr-core
 *             physics primitive). Cheat-resistant: a future optimizer
 *             change that does "more per candidate" gets charged
 *             proportionally because the inner work eventually hits
 *             the engine.
 *  - `wall_ms`: best-effort wall-clock budget. Same machine + same
 *               (spec, seed) ⇒ same Track, but may differ across
 *               machines. Use when you need a real-time deadline. */
export type Budget =
  | { kind: "work"; units: number }
  | { kind: "wall_ms"; ms: number };

/** Inputs to the public `compile()` entry point. */
export type CompileInput = {
  spec: Spec;
  seed?: number;
  /** If omitted, the optimizer runs all configured explorers to
   *  natural completion — no budget cap. */
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
 *  Mirrors the scorer's `axis_quality` in [0, 1]; bigger is better. */
export type Score = number;
