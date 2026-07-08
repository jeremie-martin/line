# Problem & Scope — the optimization metric and its statistical validation

> **REFERENCE / rationale.** This is the problem statement that *led to* the current
> metric + decision rule; it reasons from the then-current **3-seed** benchmark and
> concludes 3 is under-powered. The resolved outcome is now canonical —
> paired-bootstrap `decide` and **12 seed slots with disjoint per-budget actual
> seeds** — and lives in
> [`compiler_goals.md`](compiler_goals.md) / [`HOW_TO_WORK.md`](HOW_TO_WORK.md). Read
> the "3 seeds" below as the historical premise, not the current setup.
>
> **Superseded since (2026-06):** the direction moved past this brief. The compiler is
> no longer an anytime algorithm — each budget is an **independent full run** and the
> search may **read the budget** (so this doc's "may not read its own budget" constraint
> and its "out of scope: budget-aware search" bracket no longer hold). The HEADLINE is
> now the **budget-value-weighted average** of the per-budget suite scores over
> `{75,150,225,350,475,550}k` (not `α·ceiling + (1−α)·logAUC`), and validity is reported but
> **does not gate**. The variance/noise analysis below remains the rationale for paired
> comparison and the 12-seed population. Current truth: `compiler_goals.md`.

This is a deliberately solution-free statement of the problem. It gives the full
context and constraints but none of our own conclusions, so that a fresh
statistician / engineer / agent can reason from it independently.

## System

A compiler turns a musical *Spec* into a Line Rider track via a search that spends
a compute budget (counted in simulated rider frames); more budget = more search.
The compiler is improved over time by an LLM agent that proposes code changes and
keeps each one only if it raises a scalar quality metric (and passes a set of
property tests). The metric is computed on a fixed benchmark: 20 specs × 3 seeds =
60 runs, each yielding a per-run quality score in [0, 1000]. The *same* specs and
seeds are used on every evaluation, so any baseline-vs-candidate comparison is
naturally paired. Compilation is deterministic given `(spec, seed, budget)`.

## What we want from the compiler

It should convert compute into quality across a wide range of operating budgets —
in practice we run it anywhere from very cheap (many quick tracks) to very
expensive (when quality matters most) — monotonically and with diminishing
returns: more budget should keep buying real improvement toward the best
achievable track, rather than hitting an early structural plateau. We are never
forced to stop early and will happily pay more, within reason. What we ultimately
care about is the achievable quality (the ceiling), not how good a cheap run looks
in isolation.

## The question

What single scalar should the improvement loop maximize so that maximizing it
genuinely makes the compiler better *in the sense above* — and how do we know,
statistically, that a measured improvement is real and not noise?

## Constraints and history any answer must respect

- **Cheap iteration is mandatory.** One full benchmark already costs meaningful
  wall-clock; we cannot re-run the whole suite many times per proposed change.
  Anything that requires measuring behavior across the budget range must stay
  affordable.
- **Two documented failure modes the metric must avoid:**
  - A past metric that aggregated quality uniformly across a low-budget window
    ranked an early-plateauing approach *above* a slower-starting approach that
    reached a much higher ceiling — penalizing exactly the progress we want, and
    nearly causing us to discard our best change.
  - A past compiler version was tuned to one budget; it hardcoded effort-allocation
    constants and failed to generalize (more budget bought nothing; less budget
    never finished). The metric must not reward this single-budget overfitting.
- **The search currently may not read its own budget** (a deliberate rule, with its
  own rationale and tension). Whether to keep this is a separate question; assume
  it holds for now.
- **Statistical trust is currently weak.** The rule "a change counts if the mean
  improves by ≥5" is an unjustified fixed threshold. We do not actually know the
  seed-to-seed noise, whether 3 seeds is enough, or whether the held-out-seed check
  is adequate. We want the methodology itself measured and characterized, not
  guessed.

## In scope

- the choice of optimization metric;
- the statistical methodology for deciding whether a change is a real improvement
  (noise floor, seed count, holdout);
- the tooling/tests supporting both.

## Out of scope (separate, later project)

Redesigning the search itself (e.g. making it budget-aware / iterative-deepening).
Here we are deciding how to *measure and decide*, not how the search internally
spends compute.

---

# Measured findings (2026-06-04)

The statement above is solution-free. This section records what we *measured* about
the noise, to ground the decision methodology in numbers rather than guesses. It is
appended after the fact and is not part of the solution-free brief.

**Setup.** Two golden sweeps, 19 specs × 18 seeds (a clean population `0–11` plus the
documented triples `{20,21,22}` and `{100,101,102}`), budgets `{50,75,100,125,150}k`.
Compilation is deterministic per `(spec, seed, budget)`,
so the only source of variability is the seed draw. Reproduce with
`scripts/v0/variance_report.py BASE.json CANDIDATE.json`.

### 1. The noise has two distinct components

The per-run score is **bimodal**: a failed compile collapses to ≈0, a valid one is
~300–650. So raw seed SD conflates *how often a spec fails* with *how much a valid
track's quality varies*. Decomposed (population seeds, pooled across specs):

| budget | valid rate | σ_seed (all) | σ_seed (valid-only) |
| ---: | ---: | ---: | ---: |
| 150k | 99% | 74 | 66 |
| 100k | 98% | 80 | 69 |
| 50k  | 96% | 97 | 72 |

- **Quality jitter among valid tracks (~66–72, budget-stable)** is the dominant,
  irreducible component — the stochastic search lands in different basins per seed.
  Even 100%-valid specs swing widely (`drums_swell` SD≈117, `drums_crosscut` ≈86).
- **Validity bistability** is budget-sensitive: negligible at 150k (16/19 specs are
  100% valid), but at 50k a few specs (`solo_run` 67% valid, `drums_breath`/
  `drums_signature` 83%) coin-flip on finding *any* valid track and inflate the raw SD.

Implication: validity and quality are different axes with different noise — an argument
for tracking **validity as a separate guardrail** rather than fusing it into one score.

### 2. The fixed "+5" threshold is noise

At 3 seeds the *absolute* suite metric `M` has a 95% half-width of **±12–19** (150k),
widening to ±24–46 at 50k. A +5 change is well inside that — indistinguishable from
zero. Confirmed dead.

### 3. Paired comparison collapses the noise ~10×

Because both configs use the *same* seeds, common-mode seed-luck cancels in the
difference (base and continuous are highly correlated across seeds). The **paired
delta** at 3 seeds has SD ≈ **7.1** (150k) / 10.6 (100k) — vs the ±70 absolute jitter.
The decision rule should therefore be a **paired bootstrap CI on the delta**, not a
fixed threshold and not a two-sample test.

Smallest reliably-positive change vs seed count (paired, scales ≈ 1/√n, at 150k):

| seeds | min detectable Δ |
| ---: | ---: |
| 3  | ~14 |
| 6  | ~10 |
| 8  | ~8.5 |
| 12 | ~7 |
| 24 | ~5 |

So **~8 seeds** reliably resolves ~10-point improvements; sub-~10-point changes sit
below the noise unless seeds are pushed to ~20+. 3 seeds is under-powered.

### 4. Holdout representativeness

On *absolute* M the canonical triple `{100,101,102}` sits at the ~0th percentile of
random 3-seed draws — but that is a **validity-failure artifact** (it trips ~2 extra
failures on bistable specs; its valid-only quality ≈368 matches the population). For
*paired deltas* the triples track the population fine (canonical +200.6, holdout +209.0,
population +207.9), so holdout is adequate for comparisons even though raw single-config
means on those seeds read pessimistically.

### 5. Worked example that exercised the metric

`continuous` @ HEAD `1865964` vs `base`: suite M **366 → 574 (+208)** at 150k,
broad-based (every one of 19 specs improves +50…+287, validity equal-or-better). A
large, unambiguous gain (0% of 3-seed draws show ≤0) — the kind the metric must reward,
and the case that motivated this whole analysis.

### Tooling

`scripts/v0/variance_report.py` — the `variance_report` tool: validity/quality variance
decomposition, SE(M) vs seed count, holdout location, and (with a second archive) the
paired-delta CI and seed-count→detectable-effect table.
