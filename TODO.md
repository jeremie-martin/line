# TODO — optimizer floor-removal follow-through

Context: removing the legacy floor from the v0 LDS optimizer (`scripts/v0/optimizer/`).
The backtracking base path (Items 1–2 + depth-8, committed) makes the search stand
alone on 11/13 golden specs. The remaining gap is the **committed-but-missing** class:
a candidate that lands its contact in the per-gap sim (we already bisect anchor-Y via
legacy `tryCandidate`) still **misses in the assembled track**, on 5 specs.

## RANK-AXIS PROBE FINDING (2026-05-29)
The rank probe REFUTED the "fixing candidate is high cost-rank" hypothesis. Winning leaves
use LOW-rank deviations: grain_staircase winner = discrepancy 1, gap 25 @ local-rank 1;
dense_sprint best = discrepancy 2, gaps 31 & 34 both @ rank 1. The within-gap candidate
order is already fine — the problem is **combinatorial breadth** (which gap to fix), and
the budget cost is scanning many d=1/d=2 leaves before reaching the right gap.
=> **Validation-retry is the correct + cheaper primary fix.** Residual ranking is demoted
to an optional quality tweak, not a contract-failure fix.

## PRIMARY — Validation-retry on the base path  (the contract fix; TODO-do-next)
- After the base path completes, detect assembled-track **missing / off-beat** contacts,
  map each to the **owning gap** (legacy helpers in `compile.ts`: `findGapOwning`,
  `offBeatLandingEvents`, `addMissedContactRetryOwners`), and re-search that gap's NEXT
  candidate directly. Bounded per-gap (legacy `FINAL_VALIDATION_RETRIES`=3).
- Cleanest integration: reuse `buildBacktrackingLeaf`'s stack — a validation failure at a
  gap behaves like a "dead-end" that forces advancing that gap's `tried` index, bounded by
  a per-gap validation-retry counter. Validation-retry then = backtracking triggered by a
  full-track check instead of a per-gap 0-candidate. Lives in the depth-bounded descent →
  deterministic + monotonicity-safe; budget-exempt (part of the floor's completion).
- Expectation: fixes grain (gap 25→rank 1), cold_start, drums_pendulum, dense_sprint
  (gaps 31+34), drums_crescendo (miss+drift+off-beat) — all at the floor, cheaply.

## SECONDARY / optional — Residual-target cost ranking  (quality only)
- Cost each gap against the **section-residual** target, not local `gap.targets`
  (reuse legacy `residualSearchTargetsForGap`, `scripts/v0/compile.ts`). Re-ranking only;
  preserves fixed enumeration + determinism. Addresses the r≈0.8 cost-vs-axis-quality
  finding — a QUALITY lift, NOT a contract fix (rank probe showed fixes are already
  low-rank). Do only if quality needs it after validation-retry lands all contacts.

## Comparator refinements  (register.ts — user-requested, do this session)
- Add `rmsContactDrift` tertiary tiebreak (favors tighter-on-beat landings) + epsilon-aware
  float comparison (cross-platform determinism). Deterministic, monotonicity-neutral.

## Then
- **`budgetFor` calibration** — flat 200k is slightly low for some specs; revisit per-spec
  (contact-count/density-based; generalizes) AFTER validation-retry, which should cut the
  budget each spec needs (fixes land at the floor, not via deep enumeration).
- **Remove the legacy floor** (`api.ts` floor:"legacy" + `legacyCompile` import) once the
  search passes the full suite standalone. Fix the stale `README.md` pipeline diagram
  (greedy.ts is a tests-only naive descent; d=0 is `buildBacktrackingLeaf`; budget unit is
  sim-frames). Then Item 5 (dense-spec monotonicity test) and Item 7 (phase-2 polish, gated).

## Surveyed from `wyss` and REJECTED (incompatible with our invariants)
- Recovery-frontier beam search: NOT budget-monotone (24-state truncation + budget-dependent
  epoch chopping; no prefix-superset). wyss gets "never worse" only from its archive
  register, the weaker guarantee. Do not graft.
- wyss budget unit `engine_addLine`: weaker cheat-resistance than our physics-frames. Keep ours.
- Anchor-Y bisection: we ALREADY have it (legacy `tryCandidate`/`bisectAnchorY`). Not a gap.
- wyss's dense-lookahead ranking + prefix-validation-retry: DISABLED by constants in wyss
  (dormant scaffolding) — not proven; don't treat as wins.
