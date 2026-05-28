# Step 0 — Foundations

This step sets up the substrate for the rebuild. It is deliberately
thin on code: types, a one-function scorer wrapper, a frozen baseline.
Everything else is just rationale, written down so we can refer to it
when surprises hit later steps.

The overarching goals and acceptance criteria (the WHAT and WHY) live
in `docs/compiler_goals.md`. This file is about what Step 0 itself
ships.

## Architecture overview (updated after senior-colleague review)

The original Step 5 envelope-of-explorers design was superseded by a
structurally tighter design built around **limited-discrepancy search
(LDS) over cost-ranked candidates with a best-so-far register**. The
envelope code has been deleted; the new design lives in `lds.ts`,
`register.ts`, `polish.ts`, and `api.ts` (Stages 1-3b).

```
   sample.ts        atomic ops: sample one candidate, evaluate it
        ↓
   solver.ts        single-gap K-candidate solver (sample order)
        ↓
   greedy.ts        multi-gap chainer = LDS discrepancy-0 walk
        ↓
   sim_frames.ts    work-unit counter at extraction boundary  (Stage 0b)
        ↓
   lds.ts           limited-discrepancy leaf enumeration       (Stage 1)
        ↓
   register.ts      best-so-far with deterministic comparator  (Stage 1)
        ↓
   polish.ts        polish ops as generate-and-test leaves     (Stage 3b)
        ↓
   api.ts           compile(spec, {seed, budget}) public        (Stage 1)
```

Property 1 (monotonicity-in-budget) holds **by construction**: the
leaf enumeration `E` is determined by `(spec, seed)`, the cutoff
index is a pure function of budget, so `prefix(B') ⊇ prefix(B)`,
and the best over a superset never decreases. The register
guarantees strict-improvement updates.

The work unit is **simulated rider frames** (one frame = one
integration step), not `engine.addLine`. The colleague's argument:
addLine registers geometry, but wall-clock is dominated by per-frame
stepping. lr-core's spatial-grid collision (verified) keeps per-frame
cost stable in line count, so sim_frames satisfies Property 2 by
construction. addLine doesn't.

Budget buys **cascade diversity (discrepancy depth)**, not per-gap
candidate count. The Phase 0/4 K-sweep data showed K > 32 is
flat-to-worse; the headroom is in which cascade gets picked, not how
many candidates are evaluated per gap. So `N_CAND` is a fixed code
constant (re-baselined when changed), never a budget-fed knob.

## Step 0 deliverables

- `scripts/v0/optimizer/README.md` — the architecture map.
- `scripts/v0/optimizer/types.ts` — `CompileInput`, `CompileOutput`,
  `Budget`, `Score`. Types only.
- `scripts/v0/optimizer/scorer.ts` — `scoreTrack(out)`,
  `scoreReport(report)`, `isStrictlyBetter(a, b)`. Single source of
  truth for "is A better than B".
- `scripts/v0/optimizer/_freeze_baseline.ts` — one-off harness that
  runs the legacy compiler and writes `baselines/greedy_v1.json`.
- `baselines/greedy_v1.json` — per-(spec, seed) frozen quality and
  contract-pass record from the existing compiler. The historical
  anchor for all later quality non-regression checks. Initial value:
  `goal_score = 460.44`, 65/65 contract_passed.
- `tests/optimizer_scorer.test.ts` — wrapper unit tests; verifies the
  wrapper does not deviate from `scoreDriftReport`'s `axis_quality`.
- `tests/optimizer_baseline.test.ts` — baseline file integrity test;
  verifies per-spec scores and goal_score reproduce the shifted
  geomean of the per-row data.

## How the verification gates were met

- **Scorer correctness**: `tests/optimizer_scorer.test.ts` asserts
  `scoreReport(report)` equals `scoreDriftReport(report).axis_quality`.
- **Baseline integrity**: `tests/optimizer_baseline.test.ts` asserts
  the file's `per_spec` scores and `goal_score` are exactly the
  shifted geomean of `(axis_quality × 1000)` per row (matching
  `golden.ts`'s aggregation), and that `goal_score` lies in a sanity
  band of `[400, 550]` — catches accidental scoring-formula drift
  between the freeze script and the running scorer.

## What Step 0 does NOT do

- Does not implement any new compiler logic. The substrate enables
  the rebuild but doesn't drive it.
- Does not modify `compile.ts`, `score.ts`, `types.ts`, or any
  golden suite file.
- Does not touch lr-core, the detector, or the spec types.
- Does not call the new compiler from `golden.ts` (that's Step 8+).

## How to use the frozen baseline

```ts
import baseline from "../baselines/greedy_v1.json";
const target = baseline.per_spec.find((s) => s.name === "drums_signature")?.score;
// target is the per-spec score we must match or beat in later steps.
```

When the rebuild ships in Step 8, the gate is:
`new_compiler_goal_score ≥ baseline.goal_score × 0.95` AND
`new_compiler_contract_pass_rate ≥ baseline_contract_pass_rate`.

If we ever need to refresh the baseline (e.g. after a deliberate
scoring change), regenerate via:

```
npx tsx scripts/v0/optimizer/_freeze_baseline.ts
```

…and commit with a clear message about why the refresh is intentional.
