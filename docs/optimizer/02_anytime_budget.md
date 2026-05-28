# Stage 2 — anytime budget + Property 1 verification

## What this stage delivered

- `Budget = { kind: "work"; units: number }` added to
  `CompileLDSOptions` (units = sim_frames).
- Op-boundary cutoff in `compileLDS`: after each leaf is scored,
  check `getSimFrames() >= budget.units`. On exceeded, set
  `budget_exhausted=true` and return the current best-so-far.
- The d=0 greedy leaf is **always evaluated first** regardless of
  budget — i.e., even `budget=1` returns the greedy track (with
  `budget_exhausted=true`). This is the "mandatory prelude":
  guarantees we always at least deliver the greedy baseline.
- `CompileStats.budget_exhausted: boolean` added across all
  CompileStats constructors. Legacy compile sets it to false.
- 6 new tests in `tests/optimizer_anytime.test.ts`, two of which
  are property tests intended to run in CI forever.

## Verification gates — all PASS

### ✅ Property 1 — comparator-key monotonicity (CI)

Per-leaf comparator key = `(contract_passed, axis_quality,
full_score)` with lex order: passing strictly dominates failing,
then axis_quality among passing, then full_score among failing.

The test asserts that for any `B' > B`, the key from `compile(B')`
is not strictly worse than the key from `compile(B)`. Verified on
tiny_dance seed=0 across budgets {50k, 250k, 2M}.

### ✅ Property 4 — budgeted determinism (CI)

Two `compile(spec, seed, budget)` calls with identical args produce
**hash-identical** Tracks and identical sim_frames. Verified on
tiny_dance budget=100k.

### ✅ Property 2 — wall-clock cv carryover

Stage 0b established `wall_ms / sim_frames` cv = 0.213 on greedy_v2
across the golden suite. Re-measured under Stage 2's compileLDS
across 24 successful (spec × seed × budget) cells:

| metric | value |
|---|---|
| min ms/frame | 0.0125 |
| max ms/frame | 0.0206 |
| mean ms/frame | 0.0163 |
| **cv** | **0.1171** |

Budgeted execution does NOT degrade Property 2; if anything cv
tightened (0.213 → 0.117) because the budget cap reduces tail-of-
distribution wall-clock spikes.

## Cross-spec empirical sweep (Stage 2 evidence)

`scripts/v0/optimizer/_verify_stage2.ts` runs 3 specs × 3 seeds × 3
budgets = 27 compiles. Findings:

- **Comparator-key monotonicity**: 0 violations / 16 evaluable
  transitions across the (spec, seed) cells.
- **Pure axis_quality monotonicity among passing rows**: 0 violations
  / 15 evaluable. So when the contract is satisfied at both ends of
  a budget transition, axis_quality is also monotonic.
- **cold_start seed=0 throws at all 3 budget levels** (d=0 can't
  complete — no viable candidate at some gap with N_CAND=32). Same
  failure mode as greedy_v2 on that (spec, seed); consistent.
- **`budget_exhausted` flag tracks correctly**: small budgets
  exhausted, largest budget on tiny_dance and cold_start seed=1
  ran to natural completion within 2M sim_frames.

## A consequential framing fix to `compiler_goals.md`

The initial Property 1 phrasing said:

> The compiler returns a track with quality (axis_quality) at least
> as high at B' as at B.

This was WRONG as stated: the comparator legitimately swaps a
high-axis_quality failing leaf for a lower-axis_quality passing leaf
as budget grows. The independent work-branch implementation surfaced
the right framing:

> **contract_gated_quality(track) = contract_passed ? axis_quality : 0**

Under this scalar, monotonicity-in-budget holds by construction (a
failing→passing transition is `0 → positive`, a passing→passing
transition has `axis_quality` monotonic by the register).

Updated `compiler_goals.md` Property 1 to use this framing. The
implementation never needed to change — the comparator was already
correct; only the goals doc's English needed clarifying.

## The mandatory prelude (why we get the greedy track even at budget=1)

By design, the op-boundary cutoff is checked **after** each leaf is
scored, not before. The d=0 leaf is always the first leaf yielded,
so it's always evaluated before any budget check. Concretely:

- The d=0 greedy descent takes ~1300-100k sim_frames depending on
  spec size (mini_burst ~770k, tiny_dance ~420k including all gap
  candidate generation).
- Even `budget = 1` consumes that floor's worth of sim_frames before
  the first budget check fires and exits the loop.
- The register's best is set to the d=0 leaf; we return it with
  `budget_exhausted=true`.

This makes a contract more honest: **the compiler never returns
worse than greedy** (assuming greedy itself completes). Setting a
silly-low budget doesn't give you garbage; it gives you greedy.

## Stage 2 deliverables (all met)

- ✅ `scripts/v0/optimizer/api.ts` extended with budget parameter.
- ✅ `scripts/v0/types.ts` CompileStats gains `budget_exhausted`.
- ✅ `tests/optimizer_anytime.test.ts` with 6 tests, 2 property-tests in CI.
- ✅ `scripts/v0/optimizer/_verify_stage2.ts` cross-spec sweep harness.
- ✅ `docs/compiler_goals.md` Property 1 phrasing fixed.
- ✅ All gates pass empirically.

## Files

NEW:
- `scripts/v0/optimizer/_verify_stage2.ts` (investigation, deleted in Stage 5)
- `tests/optimizer_anytime.test.ts` (CI permanent)
- `docs/optimizer/02_anytime_budget.md` (this file)

TOUCHED:
- `scripts/v0/optimizer/api.ts` — budget metering, mandatory prelude.
- `scripts/v0/optimizer/greedy.ts` — `budget_exhausted: false` in stats.
- `scripts/v0/types.ts` — `budget_exhausted` on CompileStats.
- `scripts/v0/compile.ts` — `budget_exhausted: false` in stats init.
- `docs/compiler_goals.md` — Property 1 phrasing clarified.

## Independent convergence — work branch

A separate implementation on the `work` branch (`origin/work`) arrived
at essentially the same design from the same evidence base:
LDS over cost-ranked candidates, sim_frames at the extraction
boundary, mandatory greedy prelude, same 4-rule comparator,
discrepancy-0 = greedy floor, "code constants, never budget-fed
knobs". This is good confirmation that the architecture is the
right one.

A few of their patterns are worth borrowing as we proceed (NOT via
git cherry-pick — by re-implementing with our own verification
gates):

- The **contract-gated quality** framing (already adopted above).
- **Polish via clone-and-test** (`polishLeafVariant`): clone the fits
  array, run existing mutating polish helpers on the clone, accept
  if fingerprint changed. Avoids my planned Stage 3b refactor of 14
  helpers. Significantly simpler. Will design Stage 3b around this.
- **`scored_leaf_fingerprints` in CompileStats**: lets tests verify
  the prefix-superset property directly rather than via comparator
  keys. Could add opportunistically.

What we won't borrow as-is:
- Their property tests use `TRIVIAL: Spec = { duration: 1,
  contacts: [], sections: [] }` — a no-op spec that barely
  exercises the search. Our tests use tiny_dance and golden specs;
  better signal.
- Their LDS lives inside `compile.ts` directly; ours lives in
  `optimizer/` as a separate module. Both valid; our organization
  is clearer for stage-by-stage shipping.

## What's intentionally NOT done yet (Stage 3+)

- Polish-as-leaf generation (Stage 3b).
- Default-budget calibration per spec (Stage 4).
- Wiring compileLDS into the golden suite (Stage 4).
- Removing `time_multiplier` machinery from score.ts (Stage 4).
- Full-suite acceptance sweep (Stage 5).

## Pause for deep empirical study before continuing

The Stage 2 gates pass, but Property 1's structural claim deserves
much more rigorous empirical evidence than what the current 3-spec
× 3-budget sanity check provides. Per the project's emphasis on
hard evidence, the next deliverable before Stage 3 is a deep study
of the budget→quality, budget→wall_ms, budget→sim_frames curves
across many specs, many seeds, many budget levels — not just
"property test passed" but "the curve shapes match what the LDS
architecture should produce".
