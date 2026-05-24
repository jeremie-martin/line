/**
 * Primitive-type search candidate registry.
 *
 * Phase 2 of the optimizer redesign: lift primitive-type into the search
 * space. Per beat, given incoming rider state, enumerate candidate
 * primitives matching the beat's intent and feasibility-filter by per-
 * primitive precondition.
 *
 * This module is the *registry* — pure data + tiny feasibility predicates.
 * The integration with `searchRideGreedy` (which actually iterates over
 * candidates) is in `search.ts` and depends on this module.
 *
 * Design notes
 * ────────────
 * The `Intent` axis lets a strategy author say "I want a landing here" or
 * "I want a kick here" without committing to a specific primitive. The
 * compiler enumerates feasible candidates and picks one per beat.
 *
 * `landing` is the dominant case for music sync — it's the visual
 * punctuation per PROBLEM.md §Event types. `bounce`, `kick`, `airtime`,
 * `shape` are minority cases enumerated for completeness but not the
 * normal use.
 *
 * Feasibility filters mirror the `insufficient*` flags that already exist
 * in `scripts/lib/adapt.ts` (e.g. `adaptRamp` flags `insufficientVx` at
 * vx < 1.5) plus the speed/angle gates in each move's `place()`. We
 * pre-filter here so the search doesn't burn tries on doomed candidates.
 *
 * Move types deliberately EXCLUDED from intent buckets:
 *   - `gap` — verification-only (no geometry produced)
 *   - `tune` — not a primitive, a wrapper that searches over another move
 *   - `curve` — alias for slide with the same shape; redundant in the
 *     candidate set, listed only as a debug shorthand
 *
 * `halfPipe` is in `shape` not `landing` because it's a long state-shaper
 * (~32 segments) that takes the rider through a basin — using it as a
 * beat-landing primitive would create huge geometry per beat. It's
 * useful as a between-beat shaper but not a per-beat choice.
 */

import {
  slide,
  drop,
  catch_,
  landAt,
  landUp,
  glide,
  jump,
  wave,
  sigmoid,
  kicker,
  ramp,
  loop,
  brake,
  bounceStrip,
  halfPipe,
  type Move,
} from "./moves.ts";
import type { IncomingState } from "./adapt.ts";

/** A primitive choice for the optimizer. The factory constructs a Move
 *  at the given target frame; `feasible` cheaply pre-checks rider state. */
export type CandidatePrimitive = {
  /** Move type string (matches the Move's `.type` field). */
  type: string;
  /** Build a Move at the target frame. The Move's adapter (in `adapt.ts`)
   *  fills in shape params from rider state at place() time. */
  factory: (atFrame: number) => Move;
  /** Pre-flight feasibility check. False = skip; true = let search try it.
   *  This is conservative — `feasible: true` doesn't promise the move will
   *  succeed, only that it's not categorically impossible. */
  feasible: (rider: IncomingState) => boolean;
};

/** Intent of a beat — what event-class the strategy wants. Drives which
 *  candidates are enumerated. */
export type Intent = "landing" | "bounce" | "kick" | "airtime" | "shape";

// ────────── Feasibility helpers ──────────

const always = (): boolean => true;
const speedAtLeast = (min: number) => (r: IncomingState): boolean => r.speed >= min;
const vxAtLeast = (min: number) => (r: IncomingState): boolean => r.velocity.x >= min;

// ────────── Registry ──────────

export const CANDIDATES_BY_INTENT: Record<Intent, CandidatePrimitive[]> = {
  // Landing intent — the primary music-sync case. PROBLEM.md calls
  // landings "the visual punctuation" — distinct impact moments.
  landing: [
    { type: "slide",   factory: (at) => slide({ at }),   feasible: speedAtLeast(0.7) },
    { type: "drop",    factory: (at) => drop({ at }),    feasible: speedAtLeast(0.7) },
    { type: "glide",   factory: (at) => glide({ at }),   feasible: speedAtLeast(0.7) },
    { type: "catch",   factory: (at) => catch_({ at }),  feasible: always },
    { type: "landAt",  factory: (at) => landAt({ at }),  feasible: always },
    { type: "landUp",  factory: (at) => landUp({ at }),  feasible: always },
    { type: "jump",    factory: (at) => jump({ at }),    feasible: vxAtLeast(1.5) },
  ],

  // Bounce intent — brief airborne (<5f) between contacts. Distinct from
  // landing only in airtime duration; catch/landAt can produce either
  // depending on incoming vy.
  bounce: [
    { type: "bounceStrip", factory: (at) => bounceStrip({ at }), feasible: speedAtLeast(2) },
    { type: "catch",       factory: (at) => catch_({ at }),       feasible: always },
    { type: "landAt",      factory: (at) => landAt({ at }),       feasible: always },
  ],

  // Kick intent — sudden direction change. Per Step 0 dashboard validation
  // (PROBLEM.md §Open questions), kicks rarely cleanly correspond to
  // beats; included for completeness.
  kick: [
    { type: "kicker", factory: (at) => kicker({ at }), feasible: always },
    { type: "ramp",   factory: (at) => ramp({ at }),   feasible: vxAtLeast(1.5) },
    { type: "loop",   factory: (at) => loop({ at }),   feasible: speedAtLeast(3) },
  ],

  // Airtime intent — primitives that produce a sustained airborne phase.
  // Sometimes used between beats to set up a clean landing.
  airtime: [
    { type: "drop", factory: (at) => drop({ at }), feasible: speedAtLeast(0.7) },
    { type: "ramp", factory: (at) => ramp({ at }), feasible: vxAtLeast(1.5) },
    { type: "jump", factory: (at) => jump({ at }), feasible: vxAtLeast(1.5) },
  ],

  // Shape intent — primitives that shape rider state without producing a
  // beat-aligned event. Used as connective tissue between beats.
  shape: [
    { type: "brake",    factory: (at) => brake({ at }),    feasible: speedAtLeast(0.5) },
    { type: "wave",     factory: (at) => wave({ at }),     feasible: speedAtLeast(0.7) },
    { type: "sigmoid",  factory: (at) => sigmoid({ at }),  feasible: speedAtLeast(0.7) },
    { type: "halfPipe", factory: (at) => halfPipe({ at }), feasible: speedAtLeast(1) },
  ],
};

/** Return the feasible candidate primitives for a given intent and rider state. */
export function candidatesForIntent(
  intent: Intent,
  rider: IncomingState,
): CandidatePrimitive[] {
  return CANDIDATES_BY_INTENT[intent].filter((c) => c.feasible(rider));
}

/** Convenience: the full set of candidate primitives for landing intent.
 *  Most music-sync use cases want this — beats are landings. */
export function landingCandidates(rider: IncomingState): CandidatePrimitive[] {
  return candidatesForIntent("landing", rider);
}
