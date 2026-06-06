# Goal & Method — make the WASM engine faster, bit-identically

> **Read this first.**
>
> - **What we optimize:** `ns / physics-frame` from `LR_ENGINE=wasm npm run perf` —
>   wall-clock ÷ physics frames the compiler actually simulated. Work-normalized,
>   lower is better. **Standing ≈ 5,950 ns/frame; goal < 3,000.**
> - **Correctness gate (non-negotiable, binary):** `LR_ENGINE=wasm npm run verify`
>   must stay **byte-identical** (engine trace hashes + optimizer output/stat
>   hashes). Speed is only considered *after* a change is bit-identical.
> - **Speed decision (statistical, not a flat threshold):** build the candidate
>   kernel, then `tsx scripts/v0/bench/perf_ab.ts --rounds=100`. Two-stage:
>   **discovery — keep iff `P(candidate faster) ≥ 0.95` at R=100** (R=100 → CI
>   half-width ≈ ±0.26%, so the verdict rests on a tight effect estimate and has
>   power on ~0.3–0.5% wins); **confirmation — periodically re-A/B the accumulated
>   HEAD vs an old baseline at R≥100, demanding `P ≥ 0.9987` (3σ),** which removes
>   the ~5% per-probe false positives. (Thresholds calibrated empirically — see
>   *Decision rule*.)
> - **Engine:** every physics/perf/verify command runs under `LR_ENGINE=wasm`.
> - **Record:** every attempt — kept or rejected — gets one entry in
>   [`../OPTIMIZATION_LOG.md`](../OPTIMIZATION_LOG.md).

This document is the canonical method. It exists because the engine is already
deeply optimized (170+ logged sessions, ≈56× faster than the pristine JS engine),
so the *remaining* wins are small and the hard part is no longer finding ideas —
it is **deciding, honestly and cheaply, whether a small change is genuinely faster
or just noise.** That decision is a statistics problem, and we treat it as one.

## Objective

Make `compileHandoff` faster by speeding the Rust→WASM physics engine (`engine-rs`)
and the JS hot paths that drive it, **while keeping the compiled output and the
search byte-identical**. Behavior parity is the whole point: the engine is a
bit-faithful port of lr-core, the compiler's budget is path-dependent on engine
reads, and the optimizer baselines pin parity-with-official. A change that is even
one ULP off is a *different compiler*, not a faster one.

## Two independent gates

A change must pass **both**, in order:

1. **Correctness — binary, no statistics.** `LR_ENGINE=wasm npm run verify`:
   - `verify:engine` — per-frame oracle, byte-identical body state + collision
     records over 5 fixtures (`--diff` proves every point position bit-identical,
     `max err 0`).
   - `verify:optimizer` — real `compileHandoff` on 4 golden cases, hashing
     `{track, stats}` (incl. `sim_frames`) against the recorded baseline.
   - For Rust changes also `cargo test --manifest-path engine-rs/Cargo.toml`.

   If correctness is not byte-identical, the change is rejected outright,
   regardless of speed.

2. **Speed — statistical decision (below).** Only run this once gate 1 is green.

## Why the metric needs a statistical decision rule

`perf` reports `ns/frame` as a mean ± σ over N timed runs. Two measured properties
of that number dictate the method:

- **Per-run noise is large and transient.** Run-to-run σ ≈ **320 ns (~5.3%)**,
  dominated by GC pauses / scheduling, heavy-tailed toward slow runs. A single run
  tells you almost nothing.
- **The N-run *mean* is stable; slow drift is small.** Across independent
  invocations the 20-run mean has σ ≈ **34 ns (~0.56%)**. So the noise largely
  *averages out*, and machine drift over minutes is minor.

Consequences:
- The old flat **">1.5%"** accept rule is roughly the resolution limit of a single
  comparison — it discards every real win in the **0.3–1.5%** band, of which there
  are many across the large non-physics surface (see *Where the time goes*).
- More specs / higher budget do **not** shrink the ~5% per-run σ (it is per-run
  transient, amortized over frames that are already millions). They only marginally
  steady the mean. So the lever is **pairing + repetition**, not bigger runs.

**Reps vs. fresh invocations — measured, ICC ≈ 0.** A variance-components run (24
fresh processes × 6 reps each) decomposes the noise into a within-process per-rep
part and a between-process part:

| component | σ | of mean |
| --- | ---: | ---: |
| σ_within (per rep, same process) | 210 ns | 3.5% |
| σ_between (observed, of 24 process means) | 45 ns | 0.74% |
| σ_proc (per-process systematic, derived) | **0 ns** | **0%** |

The process means vary *less* than within-process sampling predicts
(σ_within/√6 = 86 ns > observed 45 ns), so the per-process component (JIT layout,
ASLR, scheduling, warmup) is **zero — ICC ≈ 0**. The compile is long, hot, and
warmup-settled, so each rep is effectively an independent steady-state draw and
per-process state is negligible next to per-rep GC jitter. **Therefore reps and
fresh invocations are statistically interchangeable for precision, and reps are
cheaper** (no ~1.5 s startup). `perf_ab` spawns a fresh process per arm per round
**only because swapping the WASM requires a process boundary and to enable
interleaving** — not to capture per-process variance. (Re-measure ICC if we ever
time short/cold runs or change hardware.)

## The decision rule: interleaved, paired, probability-of-improvement

We do not ask "did the mean drop by X%". We ask the decision question directly:
**given the data, what is the probability this change is genuinely faster?** The
design that answers it cheaply and honestly:

- **Interleave** base and candidate runs close together, **alternating order**, so
  slow machine drift and any first/second-run bias cancel within each round.
- **Same directory, swap only the WASM bytes.** Running the two arms from two
  worktrees introduced a ~0.5% environment bias; swapping just the kernel at the
  load path removes it. (This scopes the gate to `engine-rs` changes — JS-only
  changes are identical in both arms here; A/B those separately.)
- **Use the paired differences, not just the mean.** Per round `r`,
  `Δ_r = (cand − base) / base`. Report two robust, interpretable summaries:
  - **Sign test** — how many of `R` rounds the candidate won (binomial p).
  - **`P(candidate faster)`** — fraction of a paired bootstrap over rounds whose
    mean `Δ < 0`. This is the Bayesian-flavored posterior the decision wants.
- **Accept threshold — calibrated, two-stage.** A Monte-Carlo over the real
  per-round noise confirms `P(faster)` is well-calibrated and, crucially, that the
  per-probe false-positive rate at a *fixed* threshold is **~constant in R**
  (`P≥0.95` fires ~4–5% under a true null across R=16/30/60). More rounds therefore
  buy **power and a tighter effect estimate, not a lower FPR**. We favor sensitivity
  at discovery — to catch the ~0.3–0.5% wins that make up the remaining surface —
  and pay for precision with rounds, then remove the residual false positives
  downstream:
  - **Discovery (per probe):** keep iff `P(faster) ≥ 0.95` at **R=100** (and median
    `Δ < 0`). R=100 gives a ±0.26% CI, so 0.95 is applied to a tight estimate and has
    high power even on sub-1% wins (a 0.5% win is caught ~95%+ of the time at R=100).
  - **Confirmation (the false-positive killer):** after banking several wins, re-A/B
    the accumulated HEAD vs the older baseline at **R≥100** demanding 3σ
    (`P ≥ 0.9987`). The per-probe ~5% false-accepts contribute ≈0 to the cumulative
    effect, so they are caught here. This downstream check is what makes the lenient
    0.95 discovery bar safe over a long campaign.

**Resolution scales as 1/√R — and this is measured, not assumed.** The per-round
`Δ` are ~independent (lag-1 autocorrelation ≈ 0.16, near 0), which is the
precondition for √-law averaging. So the 95% CI half-width ≈ `1.96·σ_Δ/√R`, and the
tool's paired bootstrap realizes it: at R=16 the formula predicts ±0.64% and the
null run's observed bootstrap CI was ±0.60%. Adding rounds buys finer detection,
predictably:

| rounds R | 95% half-width |
| ---: | ---: |
| 8 | ±0.90% |
| 16 | ±0.64% |
| 30 | ±0.47% |
| 60 | ±0.33% |
| 100 | ±0.26% |

This is **baked into the gate**: `perf_ab --rounds=N` (bootstrap does the
averaging) and `perf --reps=K` (shrinks the per-run σ feeding each round). More
compute ⇒ smaller detectable effect — until the floor below.

**The one floor rounds do NOT cross.** `perf_ab` builds base and candidate *once*
and reuses those two binaries for all R rounds, so any fixed build-to-build offset
is **constant across rounds and does not average out** — rounds reduce per-run +
drift noise, not a fixed per-build bias. Good news from measurement: the build is
largely **reproducible** — a same-path rebuild, a worktree rebuild, and a
remap-path rebuild of identical source all produced byte-identical WASM (and the
binary embeds no absolute paths). So for a true null the two arms are usually
byte-identical and the floor is ≈0. But builds are not *guaranteed* deterministic
(one observed artifact differed), and any differing-bytes-same-source pair can carry
a small fixed code-layout offset (≲0.5%) that R cannot remove. Practical rule: the
**working minimum detectable effect is ~0.5%** (≈ the √R term at R≈30), already ~3×
finer than the old 1.5% rule. For a suspected sub-0.5% win, rebuild *both* arms a few
times and A/B across build-pairs so layout luck averages too; otherwise treat
sub-0.5% as inconclusive. `perf_ab` prints both binaries' hashes so a byte-identical
(zero-floor) comparison is visible.

**Guard against false positives (multiple comparisons).** Accepting at P≥0.95 means
~1 in 20 truly-null changes will look like a win. After banking several changes,
**re-A/B the accumulated HEAD against an older baseline** to confirm the kept wins
actually compound. If the cumulative gain is less than the sum of the parts, a false
positive crept in — bisect and drop it.

## Workflow

```bash
# 0. make the change in engine-rs/ (or the JS hot path)

# 1. correctness gate — must be byte-identical
npm run build:wasm
LR_ENGINE=wasm npm run verify
cargo test --manifest-path engine-rs/Cargo.toml      # for Rust changes

# 2. speed decision — keep iff P(candidate faster) ≥ 0.95 (discovery)
tsx scripts/v0/bench/perf_ab.ts --rounds=100         # base = HEAD, cand = working tree
#    --ref=<git ref>   compare against another base (use for cumulative confirmation)
#    --rounds=N        more rounds → finer resolution (~±0.26% at 100)
#    --reps=K          timed reps per pass within a round
#    --p=0.9987        confirmation threshold (3σ) for the cumulative re-A/B

# 3a. if KEPT: log it, then commit (commit only kept, holding changes)
# 3b. if REJECTED/INCONCLUSIVE: revert the source, rebuild the standard artifact

# periodic: confirm the wins compounded
tsx scripts/v0/bench/perf_ab.ts --ref=<older-baseline-ref> --rounds=30
```

Every run — accept or reject — is one entry in `OPTIMIZATION_LOG.md`: what was
tried, the verify result, the A/B verdict (`P(faster)`, win-count, Δ CI), and the
one-line *why*. Negative results are first-class: they stop us re-exploring dead
ends (most of the 170 sessions are exactly this).

## Where the time goes (target the right bucket)

CPU profile of one `mini_burst @ 50k` compile (share of compile time, harness
excluded):

| share | bucket | nature |
| ---: | --- | --- |
| ~41% | `step_state` forward sim (constraint solves + collision + per-iteration history) | bit-exact physics; squeezed |
| ~26% | other WASM: `update_computed`/`add_line`/`push_line`/`classic_cells`/invalidation | reconcile; **under-explored** |
| ~21% | JS detector: `getRawFrameAtFrame`, `detect`, `buildDriftReport`, `effectiveAxes` | boundary + scoring |
| ~5%  | GC | JS allocation (per-frame RawFrame) |

`step_state` is the irreducible physics; ~50% of compile time is *not* physics
(reconcile + detector + GC), which is where small bit-identical wins are most
plentiful. To reach <3,000 from ~5,950, the math requires real cuts to the physics
*and* the non-physics surface — banked steadily via the gate above.

## Rules that must not move

- **Bit-identity is sacred.** Never trade output parity for speed. Arithmetic-order
  changes that *preserve* IEEE-754 results are fine; comparison-semantics changes
  that merely "usually agree" are not.
- **Never edit a gate to make a change look better** — not `verify` baselines, not
  the specs/fixtures, not `perf`/`perf_ab` defaults, not the accept threshold. If
  the methodology changes deliberately, re-baseline and compare like with like.
- **Wall-clock is the metric; correctness is the constraint.** `perf` measures
  speed; only `verify` decides correctness.
- **Commit only kept, holding changes.** A perf-neutral or inconclusive change is
  reverted, even if it is "cleaner" — keep the tree honest and bisectable.
- **Re-validate cumulative gains** periodically; do not trust a stack of individually
  marginal accepts without confirming they compound.

## Tooling

- `scripts/v0/bench/perf.ts` — the single-config metric (`mean ± σ`, median, range,
  `PERF {…}` json). `--specs --budget --reps --warmup`.
- `scripts/v0/bench/perf_ab.ts` — the interleaved paired A/B decision gate. Builds
  the base kernel from a git ref in a throwaway worktree, runs both arms in the
  repo dir swapping only the WASM, reports win-count + `P(faster)` + Δ CI + verdict.
- `LR_ENGINE=wasm npm run verify` (`verify:engine` + `verify:optimizer`) — the
  correctness gate.
- `OPTIMIZATION_LOG.md` — the running, chronological record of every attempt.

## Appendix — how we measured this (for reference)

Every number in this doc is empirical, measured on this machine at steady state.
The principle: **don't guess the noise — characterize it, then design the gate to
match it.** Reproduce by re-running the steps below; re-measure if hardware, load,
or the warmup/steady-state regime changes.

1. **Between-invocation drift (is slow drift a problem?).** Ran `perf --reps=20`
   six times; the 20-run *means* spanned 5984–6080, σ ≈ 34 ns (~0.56%), while the
   per-run σ within each was ~320 ns (~5.3%). ⇒ noise is mostly per-run transient
   and averages out; drift is small. *Why it matters:* justifies averaging + light
   interleaving rather than elaborate drift control.

2. **More specs / budget don't cut per-run σ.** `perf --specs=4 …` gave the same
   ~5.5% per-run σ as one spec (the transient is amortized over frames already in
   the millions). ⇒ the lever is repetition/pairing, not bigger runs.

3. **Variance components — reps vs fresh invocations (ICC).** 24 fresh processes ×
   6 reps; decomposed σ_within (per-rep) vs σ_between (of the 24 means). The means
   varied *less* than within-process sampling predicts (45 ns vs 86 ns), so the
   per-process component is 0 ⇒ **ICC ≈ 0**. *Why:* the compile is long, hot, and
   warmup-settled, so per-process state (JIT layout, ASLR) is negligible vs per-rep
   GC jitter. ⇒ reps and invocations are interchangeable for precision; `perf_ab`
   uses per-round processes only to swap the WASM and interleave.

4. **1/√R power scaling (is the gate's CI honest?).** From a 16-round null:
   lag-1 autocorrelation of per-round Δ ≈ 0.16 (≈independent), and the √-law CI
   half-width prediction (±0.64% at R=16) matched the tool's bootstrap CI (±0.60%).
   ⇒ adding rounds tightens detection predictably; baked into `--rounds`/`--reps`.

5. **Build reproducibility / the floor.** A same-path rebuild, a worktree rebuild,
   and a `--remap-path-prefix` rebuild of identical source all produced
   byte-identical WASM (the binary embeds no absolute paths). ⇒ for a true null the
   two arms are usually byte-identical (floor ≈ 0); residual is occasional build
   nondeterminism. `perf_ab` prints both kernel hashes so a zero-floor comparison
   is visible.

6. **Threshold calibration + power (Monte-Carlo over the real noise).** Centered the
   16-round null to mean 0 (true-null shape, σ_Δ ≈ 1.3%), injected a known effect μ,
   and simulated 40k experiments per cell. Measured **false-positive rate** under H0
   (P≥0.95 → 4.2%, P≥0.99 → 0.5%, 3σ → 0.06% — well-calibrated) and **power** vs
   effect/rounds (0.5% win: 24% at 3σ/R=30 vs 72% at P≥0.95; 1% win: 91% at 3σ/R=30).
   ⇒ the two-stage discovery(P≥0.99)/confirmation(3σ) policy in *Decision rule*.

7. **End-to-end confirmation (does the whole gate detect a real effect?).** Injected
   a `black_box`-guarded dummy loop into `step_state` — extra compute, no state
   change, so `verify` stayed byte-identical — sized to ~4.6%. `perf_ab --rounds=20`
   reported Δ +4.62% (CI [4.22%, 5.03%]), candidate won 0/20 rounds, P(faster)=0.0%
   → correctly REJECTED. Confirms calibration + power on a real change, then reverted.

**Tooling for reproduction:** the steps use `perf.ts` (raw `PERF {…}` json),
`perf_ab.ts` (the gate), and short throwaway analysis scripts (variance components,
autocorrelation, the Monte-Carlo). The decision-relevant ones are committed; the
ad-hoc analyses are documented here by method so they can be re-derived.
