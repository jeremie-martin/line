# POC B: families as candidates, not orders (2026-10-31)

A rough proof of concept of approach B in compiler-framing-20261031.md, on
branch `poc-b-families-as-candidates` (from rework/foundations 7d39b2c5). A
learning experiment, not a production change.

## Stated before running

**Design.**
- The plan is drawn as today, but the 9-frame rule (`fitShapesToSections`)
  is off.
- In every section the beam search also searches, from the same parent:
  plain arcs with the planned guidance and rail layout (if that differs from
  the plan), and unguided plain arcs (if that differs). So a planned shaped
  guided section searches 3 families, guided plain arcs 2, unguided arcs 1
  (unchanged), scattered 3.
- Each family is searched with its own section style and checked against its
  own request (the existing fulfilment check, unchanged).
- Same allowance. The family options of a section split its sampling equally:
  samples, guidance and response samples and the initial-recovery samples are
  divided by the number of families. The existing adaptive local scale and
  beam width then react to the observed cost as before.
- One cost: the existing local cost and rank, plus λ for a candidate whose
  family is not the planned one.
- After the search, refinement, guide pruning and the layout check use the
  family each section was actually built with. Rows and the eval geometry
  facts record the planned family where it differs.

**λ, in local-cost units.** λ = impactWeight × δ², the cost of missing the
section's hit strength by δ. Values fixed in advance:
- 0.02 (δ = 0.1, a strength difference the owner mostly does not see between
  strong hits): the primary run;
- 0.08 (δ = 0.2) and 0.32 (δ = 0.4, close to "plan unless it cannot"), run if
  λ turns out to matter.

**Hypothesis.** Completion recovers to about the `minFrames` level without a
rule (short sections pick plain arcs because the shaped family has no viable
candidate there). Quality on cells complete in both arms is about equal or
slightly better (more candidates per decision), but the split sampling may
cost something in long shaped sections. Variety (distinct families per ride,
shaped share) drops, more so at small λ, because plain arcs are usually
cheaper under the local cost.

## Results

Runs in this worktree's `generated/eval/` (not committed): `pocB-bench`,
`pocB-pairs8` (λ 0.02), `pocB-l008-*`, `pocB-l032-*`. Baselines remeasured
under this branch's evaluator (the geometry-facts change alters its identity):
`rm-bench-minframes`, `rm-pairs8-minframes` (HEAD, with the rule) and
`rm-bench-base-rm`, `rm-pairs8-base-rm` (before the rule). Differences are
B − baseline, strata means from `npm run eval:report`.

### Completion

Every arm completes every cell: bench 41/41 and pairs8 32/32 for all three λ.
- Against `minframes`: same (41/41, 32/32), nothing lost.
- Against `base-rm`: bench 38/41 → 41/41, pairs8 27/32 → 32/32.

So B recovers completion without the rule, at every λ tried.

### Quality (cells complete in both arms; against `minframes`)

| ruler (lower is better) | bench λ .02 | λ .08 | λ .32 | pairs8 λ .02 | λ .08 | λ .32 |
|---|---|---|---|---|---|---|
| impact loss (v3, the optimized ruler) | −0.003 | +0.003 | +0.006 | −0.004 | +0.001 | +0.004 |
| strike loss | −0.004 | +0.001 | +0.005 | −0.004 | 0.000 | +0.004 |
| contact-impact loss | −0.010 | −0.004 | +0.002 | −0.013 | −0.005 | +0.003 |
| strong extra strikes / beat | −0.019 | −0.003 | +0.010 | −0.017 | −0.004 | +0.009 |
| air rms | −0.005 | −0.001 | +0.007 | −0.009 | +0.001 | +0.007 |
| speed rms | −0.002 | +0.002 | +0.006 | −0.004 | +0.001 | +0.005 |
| body drag s/min | **+0.284** | +0.113 | +0.299 | **+0.233** | −0.030 | +0.040 |
| hidden contacted bend / beat | **+0.062** | +0.011 | −0.004 | **+0.073** | +0.012 | −0.011 |

- **Seed signs on v3 loss.** λ 0.02: lower on 9 of 13 bench specs (3 higher,
  1 split), and on 29 of 32 pairs8 cells. λ 0.32: higher on 12 of 13 bench
  specs. λ 0.08: mostly slightly higher.
- **Rulers λ 0.02 makes worse:** body drag (worse in most specs) and hidden
  contacted bend, i.e. more body contact. Plain arcs, especially unguided
  ones, seem to buy impact accuracy with more body-on-line time. Not checked
  by eye.
- **Against `base-rm`** the λ 0.02 picture is the same: v3 −0.003 (bench) and
  −0.005 (pairs8), body drag +0.28 / +0.13.

### Geometry (share of ride time, stratum-weighted)

Neither baseline run recorded geometry facts. The `minframes` baseline
fulfilled every requested construction (41/41), so its realized families are
its fitted plan, which differs from B's unfitted plan only at the few sections
under 9 frames (21 of 2,970 on bench, 8 of them shaped). So "planned" below is
about the baseline's realized geometry.

| bench | planned | λ .02 | λ .08 | λ .32 |
|---|---|---|---|---|
| shaped (fold+serpentine+scallops+terraces), % of time | 39.9 | 18.1 | 33.8 | 38.8 |
| fold | 7.7 | 2.3 | 5.4 | 6.9 |
| arcs unguided | 29.7 | 45.6 | 33.4 | 30.4 |
| arcs guided | 13.6 | 19.9 | 15.9 | 14.0 |
| sections departing from the plan | — | 27.3% | 6.2% | 0.9% |
| distinct families per ride (strata mean) | 5.95 | 5.45 | 5.90 | 5.93 |

pairs8: shaped 43.3% planned → 17.0 / 36.1 / 42.1%. Fold suffers most at every
λ (pairs8: 12.0 → 2.6 / 8.4 / 11.2).

**Where B departed, and why** (planned shaped sections that departed, bench;
pairs8 alike):

| section length (frames) | λ .02 | λ .08 | λ .32 |
|---|---|---|---|
| under 9 | 8/8 | 8/8 | 7/8 |
| 9–12 | 76% | 37% | 15% |
| 13–19 | 63% | 15% | 0.4% |
| 20–39 | 44% | 6.5% | 0% |
| 40+ | 65% | ~22% | ~3% |

- **Short sections are feasibility.** Under 9 frames the shaped family
  departs at λ 0.32 too: nothing of it survives. 9–12 frames still departs
  15% at λ 0.32. That is the feasibility curve of the step-back, now handled
  with no rule.
- **Sections with room depart because plain arcs are cheaper.** At λ 0.32
  no 20–39-frame shaped section departs, so the planned family is viable
  there. At λ 0.02 44% of them depart anyway, so their cost advantage is
  under 0.08 and often under 0.02. Variety dropped in sections that had
  room: at λ 0.02, by half.
- **Long sections (40+, about 1 s and more) depart more than medium ones**
  at λ 0.02 and 0.08 (not the final section: 0 of 14 departed). A guess, not
  measured: a shape held over a long span pays more motion and residual
  cost. Dead ends played no visible part: no ride failed, and departures
  track cost, not boundaries.

### Accounting

Physics frames per compile, over the production allowance (1,700 × ride
frames): B median 0.975 (bench, λ 0.02), 0.974 and 0.977 (λ 0.08 and 0.32),
0.99 on pairs8; max 0.999; min 0.918. The `minframes` baseline: median 0.923,
min 0.856. No compile exceeded the allowance. None stopped early or failed:
every cell completed, and the lowest spenders are complete rides on the same
specs where the baseline also spends least.

**B spends about 5% more of the same allowance.** It searches more interval
searches per section, so the adaptive scale reaches the cap later. The λ 0.02
quality gain may partly come from that, not only from the choice. Compile
seconds are not comparable: several runs shared the machine.

## What it means

- **"Candidates, not orders" removes the short-section failure without a
  rule, at any λ.** Completion is as with `minFrames`.
- **λ trades variety against accuracy almost linearly, and the split costs
  something.** At λ 0.32 the plan is kept (99%), but every shaped section
  searched its family with a third of the samples, and every ruler got
  slightly worse (v3 +0.006, 12 of 13 specs). That is the price of the
  alternatives when they are not used. At λ 0.02 the alternatives are used
  and accuracy improves (v3 −0.003), but half the shapes disappear, and body
  drag and hidden contacts rise. λ 0.08 sits between: about 85% of shapes
  kept, quality about neutral.
- **The local cost prefers plain arcs.** With a small prior B converges
  toward the boring compiler the framing warns about. Variety then rests on
  λ, a knob in cost units with no validated meaning: the risk the framing
  named.

## What I would try next

- **Spend on alternatives only when the planned family struggles.** For
  example, search the planned family first with the full share, and the
  alternatives only with what its own viability leaves. This would remove
  the λ 0.32 tax while keeping the short-section rescue. It is close to
  approach C ("retry its own section"), so C is the natural contrast to run
  next.
- **Instrument the cost gap** between planned and chosen families per
  section, to test the long-section guess and to set λ from data.
- **Look at the body-drag rise by eye** before trusting the λ 0.02 accuracy
  gain.

## Not verified

- Nobody looked at the rides.
- bench-confirm, sealed and held-out panels were not run (as instructed).
- `npm test` and parity were not run: this is a behavioural branch. The V6
  plan test is expected to fail, since the plan is no longer fitted.
- The "fulfilled" ruler is checked against each section's realized family,
  so it is 100% by construction and says nothing about the plan.
- The future-value model and passive-arrival logic still read the *planned*
  family of the next sections.
- The long-section explanation is a guess.
- The quality gain at λ 0.02 is confounded with about 5% more physics spent.
