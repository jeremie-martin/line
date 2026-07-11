# Benchmark V2 Baseline

Status: **provisional and not promotion-eligible**. The required human listening review
was not completed before this evidence was generated, and the current Benchmark V2 changes
the canonical seed allocation, paired-snapshot workflow, and execution protocol. These values are retained for audit
only. Complete the tracked listening review and run `benchmark -- baseline` to establish
the next compiler baseline.

Reusable probe screening remains available through `benchmark/v2/probe-baseline.json`
and its retained V2.4 raw archive. Screening cannot promote a compiler.

Label: `v2.2-decision-protocol`. Suite: `b118882720a96854`.

Probe headline: **443.00**. Canonical headline: **451.33**. Qualification monitor: **385.68** (indicative only).

Probe and canonical actual seeds are disjoint at every shared budget. Probe evidence screens candidates; only canonical evidence can promote one.

| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |
|---:|---:|---:|---:|---:|---:|---:|
| 250k | 418.51 | 107/126 | 420.80 | 142/168 | 389.12 | 20/20 |
| 500k | 452.79 | 113/126 | 452.20 | 152/168 | 385.37 | 20/20 |
| 750k | - | - | 470.23 | 156/168 | 383.90 | 20/20 |

Candidate: `dea2e1a77af547571849bf96ccc60264f04afd62a0407efe7e04f15e3ebd2e25`.
