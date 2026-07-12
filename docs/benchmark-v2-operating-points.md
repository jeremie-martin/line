# Benchmark V2 — What the Numbers Mean (plain language)

For the operator deciding how much risk to accept. Every number below is
measured, lives in `benchmark/v2/studies/menu-certification.json` /
`holdout-validation.json`, and is re-verified by the guard each time an
attempt is declared. Nothing here is theoretical.

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
independent holdout null/stress cells. The current improvement charge is
**1.96%** per attempt. Stress scenarios (validity flips, catalog-wide zero
inflation) stay within the same 5% bar; this is why the 99% level is
load-bearing — at 95% the stress scenarios breached it.

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
+0.5 that two independent fresh epochs then flatten to zero; the
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
bound (currently 0.0196 for improve and ablation m=5) against an era cap of
0.05. Plainly: **between rebaselines, the expected number of noise wins
booked into the baseline is kept below 0.05** — the era is expected to stay
clean. Two standard attempts fit an era without an override. The budget
resets only when an accept genuinely ends
the era (or a suite rollover); overrides are possible but permanent ledger
records, and the cumulative expected-false-accept sum across all eras is
printed in every report and never resets.

## The dial you can turn

If verdicts feel too conservative, these are the honest options, in
increasing order of risk:

1. **Spend more compute, same risk**: certify deeper rows (64/128) — MDE
   drops toward +3/+2 with α unchanged. Cost: ~1–2 h per attempt and a
   one-time certification run.
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
