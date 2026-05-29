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

## Deferred / lazy "first-viable" floor — TESTED, REJECTED
Made `buildBacktrackingLeaf` sample lazily and commit the first survivor in
sample order, growing the per-gap pool to 32 only on backtrack (best case: ~5
samples/gap at ~20% survival → ~6× cheaper floor). Measured (maxD=0 floor):
solo_run s0 95k/0miss → 64k/**1miss** (only ~32% cheaper — the 17 backtracks
grow the pool to 32 anyway, eating the savings); **solo_run s1 220k/5miss →
378k/17miss** (severe thrash); drums_crescendo improves. Net chaotic/negative.

**The unifying conclusion across every floor lever tried (radius, cheap-fail,
adaptive, N_CAND, lazy first-viable): committing anything other than cost-best-
of-32 thrashes on some (spec,seed).** Cost-best is a *gentle* candidate that
tends to leave the rider landable for the next gap; alternatives strand it,
exploding backtracking (which re-grows the pool to 32, erasing any per-gap
sampling saving). So the floor's per-gap cost is effectively irreducible without
losing completion, and dense-spec floors stay > 48k.

## Most promising UNEXPLORED lever: residual look-ahead targeting
The chaos in every commit-rule change above is because cost-best is ranked
against *local* `gap.targets` with no downstream model — so the only way to keep
backtracking low is to not touch which candidate wins. But `BASE_BACKTRACK_DEPTH`
(=24) exists precisely because "the optimizer's candidate generator samples from
`gap.targets` directly — it lacks legacy `compile()`'s residual look-ahead
targeting, so it relies on backtracking". Legacy `compile()` completes with
`CALIB.BACKTRACK_DEPTH=2` because residual targeting (`residualSearchTargetsForGap`
in `compile.ts`) steers each gap toward the *section-residual* air/grain, which
makes the cost-best candidate downstream-compatible by construction. Porting that
re-ranking into the optimizer should cut backtracking (the dominant dense-floor
cost) without a chaotic commit-rule change — it improves *which candidate is
cost-best*, principled rather than random. Blockers: `SpecContext` carries only
`allContactFrames`+`durationFrames`, not `spec`/prefix `fits` (must thread them
in), and `residualAirTargetForGap` runs a `detectWindow` (charges frames — prefer
the grain residual, or compute air from the already-extracted base trajectory).
This is the highest-leverage next experiment.

## Other architectural / contract-level options
With the floor's cost-best-of-32 descent essentially fixed, the remaining levers
for a 40k pass are architectural / contract-level, not candidate tweaks:
- A genuinely different completion strategy (not single-arc-per-gap), or
- Reconsidering the hard-limit-throws-on-exempt-floor design (currently a tested
  contract, `optimizer_anytime.test.ts:135`) so a completable-but-over-budget
  floor returns a best-effort leaf instead of erroring — a charter-level decision.
- Reducing *backtracking* cost without changing the committed leaf (e.g. no-good
  learning to prune provably-doomed re-descents) — byte-identical output, only
  faster; the one unexplored low-risk direction, though soundness of the pruning
  must be proven.

## Tooling
`scripts/v0/_probe.ts` (gitignored): in-process compileLDS harness over a
(spec×seed) matrix at a chosen budget/maxDiscrepancy — avoids golden's
worker-thread isolation and amortizes one tsx startup. `maxD=0` isolates pure
floor cost. Add per-phase/gate telemetry back to `core/candidate.ts` when probing
candidate internals.
