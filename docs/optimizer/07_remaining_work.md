# Remaining work — autonomous run charter

Written 2026-05-28 before an overnight autonomous session. Purpose: state, precisely
and honestly, what is left to reach the goal, and how to work. High-level but
non-ambiguous. The goal is unchanged (`docs/compiler_goals.md`): ONE LDS compiler that
is monotone-in-budget (P1), wall-clock-predictable (P2), cheat-resistant (P3),
deterministic (P4), and at least at parity with `greedy_v1` (goal_score 460.44, 65/65)
at its default budget — re-implementing `work`'s proven mechanisms cleanly into
`scripts/v0/optimizer/`, then deleting the duplicate.

## How to work (not negotiable)

- **Be honest.** Report what the data shows, including failures and "polish was a
  no-op." Never claim a win without a measured number behind it. If a property turns
  out unreachable, that finding is a deliverable — say so.
- **Decide, don't stall.** When the data points somewhere (e.g. "d=0 doesn't complete
  drums → backtracking is the real next step"), take that decision and act, recording why.
- **Diagnose every failure.** When something fails, find the cause before reacting — is
  it one off-beat frame? a dead gap? a budget below the floor? Fix the cause, not the symptom.
- **Fast first, big later.** Before any big sweep: a quick rough run (one spec / tiny
  budget / `polish:false`) to surface bugs cheaply. Fix, re-probe, then launch the real
  sweep. Never burn an hour to discover a typo.
- **Sweeps are for understanding the equation, not ritual.** The deliverable of a sweep
  is the *shape*: budget→quality and budget→wall_ms per spec, the floor (cost of the
  first complete track), the saturation knee, ms/physframe stability. If a curve looks
  wrong, explain why before moving on.
- **No bandaids, no overfitting.** No spec-name branching. Density/contact-spacing
  heuristics are OK (they generalize); re-baseline any constant kept. Prefer the simple
  change that's correct by construction.
- **Don't change everything at once.** One mechanism per step, validated (tests green +
  a measured improvement or a clean no-op) before the next.
- **Commit validated milestones** to `master` with clear messages (no push) so progress
  is reviewable on wake. Keep throwaway probes out of commits or clearly marked.
- **Don't spawn polling loops.** Long runs background and notify on completion; wait on
  the notification, don't spin `until ...; sleep` shells (that caused stray shells today).

## State right now (committed mentally, working tree not yet committed)

- **Honest physics-frame metering — DONE, validated.** `getSimFrames()` now counts
  `getLastFrameIndex` deltas (frames actually simulated), not cache re-reads. ~12–27×
  smaller, predicts wall-clock (~0.27–0.33 ms/physframe). Tests 11/11. (`06_consolidation.md`)
- **Polish as clone-and-test — IMPLEMENTED, safe, value not yet shown.** `polish.ts` +
  interleaved in `api.ts` (default on). Vitest green; clean zero-cost no-op on mixed
  speed/grain specs. The phase-1 helpers are air-only, so they only fire on the
  air-dominant drums specs — which master can't yet complete at the floor (see next).

## The work left, in priority order (each: do → validate → decide → commit)

1. **Backtracking + recovery (the real blocker).** Master's greedy floor (d=0) does NOT
   complete the drums specs: a dead gap kills the whole leaf (`compileLDS: no leaf
   reached end-of-spec`). `greedy_v1` and `work` complete them via bounded in-leaf
   backtracking + final-validation recovery leaves. Port these cleanly (work's
   `resetAfter`/`backtrackDepth` in leaf build; `finalValidationRetryOwners` +
   `buildLdsRecoveryLeaf` as new leaves). Decide incremental-graft vs adopt-work's
   rankVector leaf builder by reading the code — pick the simpler correct one.
   **Validate:** d=0 completes drums at a small budget; contract-pass climbs toward
   65/65 (esp. drums_*, dense_sprint, rhythm_ladder); P1/P4 tests still green.

2. **Re-measure polish + recovery together; decide on phase-2 polish.** With drums
   completing, confirm phase-1 polish now fires and helps (drums). The specs master
   *loses* on (dense_sprint −20%, rhythm_ladder −16% in the Stage-A study) are
   speed/grain — phase-1 air polish won't touch them. **Decide from data** whether to
   also port the phase-2 helpers (`polishEntrySpeed`, `polishGrainLength`,
   `polishEntrySlope`, …; uniform signature, same clone-and-test pattern). Port only what
   the curve shows helps; don't port all 14 reflexively.

3. **Understand the equation + calibrate budget.** Sweep budget→quality and
   budget→wall_ms per spec in the honest physics unit (fast specs first, then the slow
   drums/solo with a sane cap). Establish per spec: the floor (first complete track),
   the knee (where quality saturates), ms/physframe. Set `budgetFor(spec)` in physics
   units comfortably above the floor. This sweep is the "understand the curve" deliverable
   → write it up (extend `06`/`07` or a new `08_budget_curves.md`).

4. **Wire LDS into the golden suite + parity gate.** `golden.ts --compiler=lds` using
   `budgetFor(spec)`; score untimed; remove the `time_multiplier` machinery from
   `score.ts` carefully (keep pure quality). **Gate:** goal_score within 5% of greedy_v1
   AND contract-pass ≥ baseline on every spec. If a spec can't reach parity, diagnose and
   report honestly rather than tuning to the test.

5. **Acceptance sweep + cutover.** Full suite × 5 seeds × budget grid: P1 zero
   monotonicity violations; P2 per-spec ms/physframe cv < 0.25 (per-spec is the
   meaningful form — pooled conflates spec difficulty, per the Stage-2 study); P3 audit
   (physics frame = lr-core primitive, can't be inflated); P4 determinism. Then: default
   `golden.ts` to lds, delete the duplicate `work` compiler + dead master scaffolding +
   throwaway probes (`_probe_*`, `_study_budget` if superseded), update GOAL/DESIGN docs.
   One compiler remains.

## Honesty notes / known risks

- Big specs are genuinely slow (~140 s/compile for drums) — that's real wall-clock, not a
  metering artifact. The dial manages it (lower budget → faster, monotone best-so-far);
  if a default budget makes a spec take minutes, say so and pick the tradeoff explicitly.
- `work` itself is not a clean 65/65 (it failed drums_pendulum s3). Parity may require
  recovery tuning or accepting one hard seed — decide and document, don't hide it.
- If phase-2 polish or recovery introduces non-monotonicity (it shouldn't — additive
  leaves only), the P1 CI test will catch it; treat any such failure as a real bug to
  root-cause, not a test to relax.
- Budget *numbers* changed meaning ~17× with honest metering; all prior budget constants
  must be rescaled, not reused.

## Definition of done

`golden.ts --compiler=lds` at default budget: goal_score ≥ 460.44 × 0.95 and contract-pass
≥ greedy_v1 per spec; P1/P2/P3/P4 acceptance all pass; one compiler in the tree; curves
documented. If some part proves impossible, the tree contains a clear written account of
why and what was tried.
