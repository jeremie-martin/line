# Low-budget LDS campaign — investigation findings (2026-05-29)

Diagnosis of the floor-starvation problem (GOAL_LDS_LOW_BUDGET.md), with the
measurements that justify each conclusion. The campaign run of record is
`npm run golden -- --jobs=4 --budget=40000`.

## Baselines (pre-change)
- **40k campaign**: contract_pass_rate 23% (9/39); **30/39 rows ERROR** with
  `PhysicsFrameLimitExceeded` — the budget-exempt d=0 floor exceeds the hard
  limit (1.2×budget = 48k) and throws mid-descent before any leaf completes, so
  the register is empty → score 0. The 9 passers are the small specs whose floor
  is < 48k.
- **Canonical (default 200k budget)**: GOAL_SCORE 269.82, pass 34/39 — 5 dense
  rows still ERROR because their floor exceeds the 240k hard limit (e.g.
  drums_crescendo floor ≈ 457k).

## Floor cost is dominated by failed bisection
Per-phase sim-frame accounting on the hard specs (60k budget) showed **bisection
is 70–98% of floor cost**; the ride-out loop is ~0 on these specs (gaps are
short, not air≥60). Within bisection, **69–81% of candidate arcs are
"bisect-null"** — no anchor-Y in the search range lands the rider within ±1 of
the target frame (rhythm_ladder 69%, solo_run 81%, drums_crescendo 90%). These
doomed candidates each still run the full ~26-eval bisection+grid, so they
dominate both the miss rate and the cost.

## What does NOT work (measured, rejected)
- **Lower N_CAND**: catastrophic for completion — N_CAND=12 → 26 missing on
  solo_run, N_CAND=8 → 72 missing. Backtracking needs the full 32-candidate pool
  to find landable sequences; the pool is load-bearing, not wasteful.
- **Adaptive sampling (early-stop on K survivors)**: net loss — shrinking the
  pool explodes backtracking (solo_run 400k+, 92 backtracks, 14 missing).
- **Cheaper bisection (MAX_ITERS 18→10)**: a no-op — bisection converges/fails
  before iter 10; the grid fallback is the cost, not the binary iters.
- **Cheap-fail bail for doomed candidates**: catastrophic — the coarse grid is
  load-bearing for survival; bailing drops candidates it would have rescued, so
  backtracking explodes (drums_crescendo 457k→900k, 50 missing). Only ~6% saved
  on the cleanly-bailable subset; not worth the completion loss.
- **Bisection-radius widening (the bisect-null fix), uniform AND gap-conditioned
  — TESTED, REJECTED.** Widening the Y-search half-range (±14) does raise survival
  and fixes individual pathological floors (drums_crescendo 457k→109k, ERROR→PASS),
  but it is a **chaotic search-landscape perturbation, net-negative at the full
  suite**:
  - *Uniform ±24*: **hurts the 40k campaign (9→4 pass)** — wider grid = more
    evals/candidate = floor hits the 48k hard limit sooner, pushing small passers
    over.
  - *Gap-conditioned* (widen only short gaps; REF=14, GAIN=2.5, clamp[14,28]):
    holds 40k exactly (9 pass) but **regresses the canonical 269.82→197.43, pass
    34→31** — widening rows that *pass* at r14 perturbs their committed path into
    failure, losing more rows than the dense-floor fixes gain.
  - Root cause of the chaos: widening helps rows where r14 *fails* the contact but
    perturbs rows where r14 *succeeds*, and a static gap-duration threshold cannot
    separate the two (rhythm_ladder *passes* at r14 yet has 9–16-frame gaps that
    overlap solo_run's 10-frame gaps). Only an *outcome*-based widen-on-failure
    (adaptive) distinguishes them — and adaptive triples sim-frame cost (re-search),
    which errors at limited budgets. Property tests (determinism + monotonicity)
    stayed green throughout; the problem is quality, not the invariants.

## What this campaign still needs
The dense-spec floors are intrinsically 89k–457k. Getting them < 48k (so the 40k
campaign passes) requires a fundamentally cheaper *completion* path, not a
candidate-geometry tweak — the charter's invited **deferred / split-floor
architecture**: a cheap completion floor (e.g. lazy "first-viable in sample
order" with the full pool grown only on backtrack), with cost-optimization moved
to the budget-subject repair/deviation phase. The monotonicity tripwire is the
`enumerateDeviations` rotation assert (`lds.ts`): `baseCommitPath` must remain an
absolute sorted-index so the deviation phase rotates validly, and the floor leaf
must stay a budget-independent pure function of (spec,seed).

## Next mechanism (planned): deferred / split floor
`buildBacktrackingLeaf` (`lds.ts`) currently materializes all 32 candidates per
gap (`getCandidatesSorted`) and commits cost-rank-0. To get dense floors under
48k, make the d=0 descent commit the **first viable candidate in sample order**
(cheap — ~5 samples at ~20% survival vs 32), growing the pool to 32 only when a
gap must backtrack (so completion power is unchanged). Cost-optimization then
moves to the budget-subject repair/deviation phase. Determinism + monotonicity
constraints: the floor leaf must stay a budget-independent pure function of
(spec,seed), and `baseCommitPath` must remain an absolute sorted-index so the
`enumerateDeviations` rotation assert (`lds.ts`) stays valid — i.e. record the
committed candidate's sorted-index even though it was *found* in sample order
(the `solveOneGap` prefix property makes sample-order identity stable). Risk:
"first-viable" has worse axis quality than cost-best, recovered only if the
budget reaches the deviation phase — verify the 20k stress run actually does.

## Tooling
`scripts/v0/_probe.ts` (gitignored): in-process compileLDS harness over a
(spec×seed) matrix at a chosen budget/maxDiscrepancy — avoids golden's
worker-thread isolation and amortizes one tsx startup. `maxD=0` isolates pure
floor cost. Add per-phase/gate telemetry back to `core/candidate.ts` when probing
candidate internals.
