# Archived Benchmark V2 Era Operating Points

> Historical reference only. This document describes the retired declaration,
> certification, attempt-ledger, and era-budget workflow. See
> `docs/HOW_TO_WORK.md` for the current cached-comparison workflow.

For the operator deciding how much risk to accept. The live authority is
`npm run benchmark -- status`: it reports the registered point, its retained
certification artifacts, and its current era charge. The depth-48 figures below
are explanatory reference values from its retained certification pair, not a
substitute for that status output. Fixed-N points have their own independently
registered menu and holdout artifacts.

## Fixed-N promotion

The normal promotion path is `eval --to-verdict --seeds=N`. N must already be
registered by `calibrate-point`, and its immutable baseline-cache prefix must
be complete before the candidate runs. The attempt compiles only the candidate
and makes one final paired decision; it never pools prior candidate evidence or
stops early because an intermediate result looks favorable. Legacy `--depth`
rows are distinct fresh-epoch procedures.

## The three verdicts

A confirmation attempt asks one question — "is this candidate really better
than the baseline?" (or, for an ablation, "really not worse than −m?") —
and ends one of three ways:

- **accept** — the evidence is strong enough that, under the certified
  error rates, we book the improvement and move the baseline.
- **reject** — the evidence is strong enough the other way: the candidate
  is really worse (or worse than −m).
- **inconclusive** — the evidence resolved neither. Nothing is booked,
  nothing is burned except the attempt's compute and its budget spend. Most
  attempts on small true effects end here, by design.

## What "99% sure" actually means (α = 0.01)

An accept fires only when the one-sided 99% lower confidence bound on the
delta clears the threshold. Plainly: **if the candidate were truly worth
nothing, an attempt would still accept it about 1 time in 100** — that's
the false-accept rate α. It is the knob that protects the headline from
accumulating noise wins.

Measured at depth 48 (1000 simulated attempts per scenario on real compile
data): a truly-zero candidate accepts 0.8% of the time through the full
chain with futility looks. Era spend is not based only on that selected menu
cell: the guard takes the largest Wilson upper bound across the menu and
independent holdout null/stress cells. The resulting charge is point-specific
and is printed by `status`; it must not be inferred from this depth-48 example.
Stress scenarios (validity flips, catalog-wide zero inflation) stay within the
same 5% bar; this is why the 99% level is load-bearing — at 95% the stress
scenarios breached it.

## Power and MDE: what "certified to detect +5" means

Power is the flip side: **if the candidate is truly better by X, how often
does the attempt actually say accept?** At depth 48:

| true effect | chance of accept |
|---:|---:|
| +5 | 92.8% (91.5% net of futility) |
| +3 | 50.5% |
| +2 | 22.3% |

The **MDE (minimum detectable effect) at 80%** is the smallest true effect
the row detects at least 80% of the time — the certified menu row is built
so that +5 clears it. A true +3 is a coin flip; a true +2 usually ends
inconclusive. That is not a defect: it is what the compute budget buys at
depth 48. Chasing +2 effects reliably needs the deeper rows (v2 work).

**One important nuance the live validation surfaced**: those numbers are
the *worst-case envelope* for candidates that perturb most compiles
(seed-block SE ≈ 1.28). A candidate that changes few compiles (97%+ of
paired scores identical) has a far smaller paired SE, and much smaller
effects become resolvable — the stage-0 advice line computes this per
candidate. Conversely, stage 0's three fixed seeds can show a phantom
+0.5 that a separately declared formal confirmation then flattens to zero; the
confirmation exists precisely to catch that.

## The interval in the report

The verdict report prints a delta with a confidence interval: the range of
true effects consistent with the evidence. If it says `+1.2 [-0.3, +2.7]`,
the honest reading is "probably around +1, could plausibly be anything from
slightly negative to nearly +3" — and because the lower bound is below the
threshold, that attempt ends inconclusive.

## Futility stops (exit 4)

At looks after 2, 3, 4, 8, and 16 seed blocks, the chain checks whether the
95% upper bound is already below the threshold — i.e. whether an accept has
become practically impossible. A truly-regressing candidate stops early
74.7% of the time by look 16 (the live drill stopped a broken candidate at
look 2, saving ~96% of the attempt's compute); a truly-good +5 candidate is
wrongly stopped only 2% of the time, already accounted for in the 91.5% net
power. A stop is durable and charges its spend.

## The era budget

Each attempt charges its certified cross-artifact worst-case false-accept
bound for its selected point against an era cap of 0.05. Plainly: **between
rebaselines, the expected number of noise wins
booked into the baseline is kept below 0.05** — the era is expected to stay
clean. Two standard attempts fit an era without an override. The budget
resets only when an accept genuinely ends
the era (or a suite rollover); overrides are possible but permanent ledger
records, and the cumulative expected-false-accept sum across all eras is
printed in every report and never resets.

## The dial you can turn

If verdicts feel too conservative, these are the honest options, in
increasing order of risk:

1. **Spend more compute, same risk**: independently calibrate and register a
   deeper fixed-N point — MDE can drop toward +3/+2 with α unchanged. Cost:
   a one-time certification run plus the explicit baseline-cache extension.
2. **Act on inconclusive-positive at your own risk**: the report's interval
   tells you exactly what is plausible; nothing stops you shipping a change
   the benchmark scored `+1.2 [-0.3, +2.7]` — the discipline is only that
   the *baseline of record* doesn't move and no headline claim is made.
3. **Raise α (e.g. 0.05)**: accepts fire ~5× more easily on noise. The
   stress evidence says the false-accept bar breaches under zero-inflation
   at this level, and every accept's era spend roughly triples. This is a
   recalibration-and-re-certification decision (inference-scope migration),
   not a flag.

The instrument's recommendation is 1 for standard work and 2 for low-stakes
exploration; 3 trades away exactly the guarantee that makes an accept mean
something.

## Preliminary 98% counterfactual

The reproducible diagnostic command below asks what changing only the final
one-sided critical from 99% (`alpha=0.01`) to 98% (`alpha=0.02`) might buy:

```bash
node --import tsx scripts/benchmark/analyze_alpha_counterfactual.ts
```

It is intentionally **not certification**. It anchors a local Gaussian-shift
projection to the retained depth-48 empirical powers. At 47 degrees of freedom,
the critical falls from about 2.408 to 2.112. The projection is:

| true effect | retained power at 99% | projected power at 98% |
|---:|---:|---:|
| +2 | 22.3% | 32.1% |
| +3 | 50.5% | 62.1% |
| +5 | 92.8% | 96.1% |

That is a moderate iteration-speed gain, especially around +2/+3, but not a
change that makes sub-point effects routinely resolvable. More importantly,
no retained trial has been re-judged at 98%: the null/validity/hard-zero stress
rates, futility interaction, independent-holdout behavior, and resulting era
charge are unknown. The artifact therefore recommends retaining 99%. A 98%
menu row would require the ordinary inference migration plus full calibration
and independent-holdout certification; it cannot be enabled as a runtime flag.
