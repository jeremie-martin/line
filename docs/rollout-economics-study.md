# Rollout Economics Study

Measured answer to three questions about forward evaluation — the compiler's
largest single spend category — and to the one the owner added on top of them
([`budget-dividends-plan.md`](budget-dividends-plan.md) Phase 4): **are the
rollouts' dead-end verdicts true?**

Every number below comes from `scripts/v0/study_rollout_economics.ts` over
compiles run in this repo; nothing is refitted and nothing is simulated outside
the compiler. The study changes no policy.

**Headline.** Forward evaluation charges **20–29% of every compile's frames**
(29.1% at 150k, 27.7% at 250k, 20.5% at 750k) — the largest identifiable
category, but not the "half of all frames" the forward-eval campaign recorded;
that number predates the closed-form ballistic cutover, which removed a shadow
simulation worth 31.5% of frames. Of that spend, the part everyone pictures —
a greedy:2 rollout — is a **minority at the production budget**: at 750k
**73.9% of all rollout frames go through shapes other than plain greedy:2**,
and 62.8% through a single one of them — `impactBestForwardEvalConfig`'s
first-level widening on impact-authored gaps, at 167 frames a call against
greedy's 47.

**And the verdicts are not true.** Auditing **every one** of 31,494 hop-1
dead-end verdicts across 198 compiles — re-running generation at the very same
child with the widths the search itself uses — **53.3% are FALSE** (46.7%
verified true; a transposed table cell originally reported the inverse — see
the correction note at §4.2). One extra
sample refutes 14.5% of them; five samples refute 28.5%. The rate is **flat
across pool rank** (46–48% at every rank 0–4), so this is not the pool's tail
feeding junk to the rollouts; it is the rollout's own one-sample view of the
world. It splits hard by spec family: on the capability frontier 58.9% of
verdicts are true, on the representative stratum only 30.3% are — on
`high_air_drive`, 5.3%.

That places us, in the owner's terms, **between the two branches and closer to
artifact**: real signal where the terrain is genuinely sharp, machinery error
everywhere else.

**And the direction of the fix is settled by one more number.** Refunding
*every* rollout frame — making the entire 20.5% free — is worth **+1.78 ± 1.31**
per cell at 750k. That is the ceiling on the whole "cheaper rollouts" family.
Meanwhile the conditional re-draw that would correct one dead-end verdict in
seven costs about **0.6% of the frames at 750k** with the aim lane suppressed.
Frames spent making the verdicts right are nearly free; frames saved by making
the rollouts cheaper are capped at +1.78. **Correctness, not cost, is where
forward evaluation's remaining value is.**

## Protocol

| | |
|---|---|
| base | `cbf7321` (`study: the 1M operating point has evidence`) |
| grid | 11 sources × 6 seeds (0–5) × {150k, 250k, 750k} = 198 compiles per arm |
| sources | `river_reentry`, `dense_dialogue`, `high_air_drive`, `sparse_lowline`, `amplitude_tides`, `offgrid_conversation` (representative); `frontier_pickup_progression`, `frontier_dense_recovery`, `frontier_low_air_endurance` (capability); `regression_transition_mosaic` (legacy_regression); `believer_impact_56s` (development_music) |
| transform | the production felt jolt, −15 ms, as the benchmark applies it |
| engine | `LR_ENGINE=wasm` |
| free evidence | 3,648 archived compiles under `benchmark/v2/runs/` already carry `stats.fwd_eval`; used for the population-level spend share and the per-source dead-end rate |

Four arms, all from the same script:

```text
# spend / verdict / confusion — bit-identical to an uninstrumented compile
node --import tsx scripts/v0/study_rollout_economics.ts \
  --sources=… --seeds=0,1,2,3,4,5 --budgets=150000,250000,750000 --jobs=6 \
  --truth-rate=0 --out=grid-spend.json

# verdict truth — audits every dead-end verdict
… --truth-rate=1.0 --truth-max=1000000 --out=grid-truth.json

# the same audit with the aim lane suppressed inside the probe (§4.5)
… --truth-rate=1.0 --truth-aim=off --out=grid-truth-noaim2.json

# identity proof (runs each cell twice, hooked and bare)
… --verify-identity
```

Evidence artifacts for every table below live in the run scratchpad
(`grid-spend.json`, `grid-truth.json`, `grid-truth-noaim2.json`,
`grid-shapes.json`, `identity.json`, `arm-*.json`) with `analyze.py` /
`arms.py` as the readers.

### Instrumentation and its identity claim

Three null-checked observation hooks in `optimizer/handoff.ts`:
`setHandoffRolloutProbeHook` (one record per charged rollout: outcome class,
frames split by hop, pool rank, source, configured shape, phase, and the live
node/gaps/ctx for a truth probe), `setHandoffExpansionProbeHook` (the search
genuinely arrived at a node and built its real pool — the join key for the
confusion matrix), and the pre-existing `setHandoffRankedOptionsProbeHook`.
Production installs none of them; an uninstrumented compile pays one null
comparison per rollout.

**Proven, not asserted.** `--verify-identity` compiles every cell twice, once
with the hooks installed and once bare, and compares `trackHash`, `full_score`
and `sim_frames`. With `--truth-rate=0`, on the **full 198-cell grid — all
three budgets, all 11 sources, all 6 seeds — 198 of 198 cells are identical on
all three fields** (396 compiles). Nothing in the tables of §1, §2 and §4.4 is
measured on a perturbed compile.

The truth probe is the one arm that is *not* frame-identical, and the study
says so plainly. It builds candidates at the audited child, and although every
frame it charges is refunded (`refundSimFramesTo`) and the build lands on a
cache-cleared *copy* of the node so the real node keeps exactly the empty
1-wide pool the rollout gave it, the engine's own frame cache is warmed by the
work and cannot be un-warmed. Measured at the maximum possible perturbation
(`--truth-rate=1.0`, every verdict audited):

| cells | identical `trackHash` | identical `full_score` | median &#124;Δ sim_frames&#124; | max |
|---:|---:|---:|---:|---:|
| 12 | 12 | 12 | 0.034% | 6.47% |

So the audited compiles produce the same track as the unaudited ones; only the
frame ledger drifts. A determinism self-check inside the probe re-runs the
rollout's own width first and confirms it reproduces empty: **0 failures in
31,494**.

## 1 — Where the spend goes

### 1.1 The share

Sums over the 198-cell arm (`--truth-rate=0`, bit-identical):

| budget | cells | sim frames | rollout + start frames | share | rollout calls | frames/call |
|---:|---:|---:|---:|---:|---:|---:|
| 150k | 66 | 10,242,377 | 2,979,427 | **29.1%** | 62,511 | 38.1 |
| 250k | 66 | 16,721,946 | 4,626,355 | **27.7%** | 101,666 | 39.1 |
| 750k | 66 | 50,510,256 | 10,340,526 | **20.5%** | 117,643 | 82.4 |

The 3,648 archived compiles agree and extend the range: 34.7% at 250k, 32.4%
at 500k, 29.4% at 750k over the full 44-source suite (the archives predate this
head, so the levels differ slightly; the shape does not).

Those archives also give the dead-end rate its full population, free — every
one carries `stats.fwd_eval`, whose `fwd_rollout_no_candidate / fwd_eval_calls`
is the per-rollout dead-end rate at any hop. Across all 44 sources it spans
**10.3% to 78.1%**, and the ordering is a spec-family ordering:

| high | | low | |
|---|---:|---|---:|
| `frontier_low_air_endurance` | 78.1% | `wide_breaths` | 10.3% |
| `frontier_pickup_progression_shifted` | 74.2% | `countercurrent` | 11.4% |
| `frontier_low_air_endurance_4s` | 70.2% | `rising_switch` | 13.1% |
| `frontier_dense_recovery` | 69.0% | `offgrid_conversation` | 14.8% |
| `frontier_dense_recovery_240ms_figures` | 64.9% | `wide_breaths_air_plus_5` | 15.0% |
| `frontier_pickup_progression` | 63.5% | `river_reentry` | 16.7% |
| `dense_dialogue` | 54.5% | `meter_exchange` | 18.2% |

The six sources above 60% are all capability-frontier members. **The rate is a
property of the source mix, not of the compiler** — which is the first reason
to be careful with any single headline percentage for it, including the one
Phase 4 is named after.

### 1.2 The outcome classes

Every charged rollout falls into exactly one class. `no_hop` = the prefix had
no further contact to place; `dead_hop1` = the first rolled contact produced no
candidate (**the verdict this study audits**); `dead_hop2` = hop 1 placed, hop 2
produced none; `end_hop2` = hop 1 placed and the track reached its last
contact; `full` = the configured depth rolled out; `branched` = a non-greedy
shape (`avg`, `best`, `firstBranch>1`, and start selection), which gets no hop
trace because "the" hop is not defined for it.

> **Post-L1 note (2026-08-04).** Every number in this section was measured
> BEFORE redraw-on-empty shipped (`bb45125`), when `dead_hop1` was the whole
> empty-at-base-width population. The instrument now splits that population in
> three, and the study script emits a fourth class: `dead_hop1_refuted` (empty
> at the shape's own width, then the width+1 re-draw found a candidate) versus
> `dead_hop1` (still empty — the surviving verdict, and the only one
> `fwd_rollout_no_candidate` counts). **The quantity comparable to the
> `dead_hop1` column below is `dead_hop1 + dead_hop1_refuted`**, and §4.2's
> verified-true rate is now measured on the residual population alone — a
> strictly harder one, since L1 has already removed the cheapest refutations.
> Definitions and the standing metric set: `docs/forward-eval-metrics.md`.

**150k** — 63,753 rollouts, 2,979,427 charged frames:

| outcome | calls | % calls | frames | % rollout frames | % of the compile | frames/call |
|---|---:|---:|---:|---:|---:|---:|
| `no_hop` | 2,161 | 3.4% | 0 | 0.0% | 0.0% | 0.0 |
| `dead_hop1` | 10,474 | 16.4% | 394,798 | 13.3% | 3.9% | 37.7 |
| `dead_hop2` | 762 | 1.2% | 45,001 | 1.5% | 0.4% | 59.1 |
| `end_hop2` | 1,192 | 1.9% | 28,562 | 1.0% | 0.3% | 24.0 |
| `full` | 37,227 | 58.4% | 1,626,188 | 54.6% | 15.9% | 43.7 |
| `branched` | 11,937 | 18.7% | 884,878 | 29.7% | 8.6% | 74.1 |

**250k** — 102,908 rollouts, 4,626,355 charged frames:

| outcome | calls | % calls | frames | % rollout frames | % of the compile | frames/call |
|---|---:|---:|---:|---:|---:|---:|
| `no_hop` | 8,460 | 8.2% | 0 | 0.0% | 0.0% | 0.0 |
| `dead_hop1` | 13,361 | 13.0% | 417,726 | 9.0% | 2.5% | 31.3 |
| `dead_hop2` | 6,623 | 6.4% | 466,856 | 10.1% | 2.8% | 70.5 |
| `end_hop2` | 4,817 | 4.7% | 82,017 | 1.8% | 0.5% | 17.0 |
| `full` | 52,172 | 50.7% | 2,637,242 | 57.0% | 15.8% | 50.5 |
| `branched` | 17,475 | 17.0% | 1,022,514 | 22.1% | 6.1% | 58.5 |

**750k** — 118,885 rollouts, 10,340,526 charged frames:

| outcome | calls | % calls | frames | % rollout frames | % of the compile | frames/call |
|---|---:|---:|---:|---:|---:|---:|
| `no_hop` | 5,106 | 4.3% | 0 | 0.0% | 0.0% | 0.0 |
| `dead_hop1` | 7,557 | 6.4% | 206,692 | 2.0% | 0.4% | 27.4 |
| `dead_hop2` | 6,706 | 5.6% | 423,677 | 4.1% | 0.8% | 63.2 |
| `end_hop2` | 3,573 | 3.0% | 113,502 | 1.1% | 0.2% | 31.8 |
| `full` | 32,801 | 27.6% | 1,950,766 | 18.9% | 3.9% | 59.5 |
| `branched` | 63,142 | 53.1% | 7,645,889 | 73.9% | 15.1% | 121.1 |

Three things this table says that the campaign's picture did not.

**(a) `no_hop` is free and it is not small.** 3–8% of every rollout population
charges literally zero frames: the candidate sits at or past the last contact,
`advanceToNextContact` returns null and the objective leaf costs nothing. There
is no work to reclaim there — but any "rollouts per compile" statistic that
includes them is inflated.

**(b) At the production budget, greedy:2 is a minority of the spend.**
`branched` — the shapes the adaptive resolver upgrades to — is 53.1% of calls
and **73.9% of rollout frames at 750k**, at 121 frames per call against
greedy's ~50. Splitting it by origin:

| budget | start-selection calls | start frames | candidate branched calls | candidate branched frames | as % of all rollout frames |
|---:|---:|---:|---:|---:|---:|
| 150k | 1,242 | 594,678 | 10,695 | 290,200 | 9.7% |
| 250k | 1,242 | 646,768 | 16,233 | 375,746 | 8.1% |
| 750k | 1,242 | 646,768 | 61,900 | 6,999,121 | **67.7%** |

Start selection is a fixed cost (1,242 calls whatever the budget — the start
pool is bounded). Resolving the rest by the shape the adaptive config actually
produced:

| budget | linear greedy | `firstBranch = 3` widened greedy | mature `avg:2:1` | start selection |
|---:|---|---|---|---|
| 150k | 51,816 calls / 2,094,549 f (**70.3%**) | — | 10,695 / 290,200 f | 1,242 / 594,678 f |
| 250k | 85,433 calls / 3,603,841 f (**77.9%**) | — | 16,233 / 375,746 f | 1,242 / 646,768 f |
| 750k | 55,743 calls / 2,694,637 f (**26.1%**) | 38,830 calls / 6,492,232 f (**62.8%**, 167 f/call) | 23,070 / 506,889 f | 1,242 / 646,768 f |

(Shape is read from the per-rollout probe's `variant:depth:branch`; the
`firstBranch` column is the exact residual of the `greedy:*` shape totals minus
the linear population the outcome table counts, and cross-checks to the frame
against the branched total.)

**The single largest line item in a 750k compile's rollout budget is
`impactBestForwardEvalConfig`** — the impact-gap first-level widening, 62.8% of
all rollout frames and 12.9% of the whole compile, at 167 frames per call
against the unwidened 47. Its budget ramp (`IMPACT_BEST_FWD_START_FRAMES`) is
zero at 250k by construction, which is why it is invisible below 750k and
dominant at it. `openingBestForwardEvalConfig` never fired on this grid at all
(its slack ramp starts at 2.75).

**Any statement about "the rollout" at the production operating point that
assumes greedy:2 is describing a quarter of the frames.**

**(c) The pace prune, not the terrain, is what ends most rollouts early at low
budget.** Restricting to the linear (unbranched greedy) population:

| budget | linear calls | `dead_hop1` | `dead_hop2` | `no_hop` | `end_hop2` | `full` | placed ≤ 1 hop |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 150k | 51,816 | 20.2% | 1.5% | 4.2% | 2.3% | 71.8% | **82.5%** |
| 250k | 85,433 | 15.6% | 7.8% | 9.9% | 5.6% | 61.1% | 39.5% |
| 750k | 55,743 | 13.6% | 12.0% | 9.2% | 6.4% | 58.8% | 30.1% |

At 150k, 61.9% of linear rollouts are *configured* at depth 1 by the
pre-completion low-slack shallowing (`HandoffSearchPolicy.forwardEval`); at 250k
that is 11.6% and at 750k 0.7%.

### Reconciling with Phase 1's "51%"

Phase 1 recorded "51% of rollout calls dead-end at hop 1 (where depth 1 ≡ depth
2)". This study cannot reproduce that as a *dead-end* rate: the literal
`dead_hop1` verdict is **13.6–20.2%** of linear calls (6.4–16.4% of all calls).
What it does reproduce, at the right magnitude, is the population for which
depth 1 and depth 2 are the same computation — rollouts that place at most one
hop — which is 82.5% / 39.5% / 30.1% by budget and **48.3% pooled** over this
grid (55.7% if `dead_hop2`, which attempts hop 2 and fails, is counted in).

The distinction is load-bearing for Phase 4, because **only the 13.6–20.2% are
verdicts**, and only verdicts can be true or false. The rest are terminal
prefixes, end-of-track rollouts and the pace prune doing exactly what it was
built to do. Sizing the truth question off the 51% overstates the population by
about 3×; sizing the *depth* question off the dead-end rate understates it by
the same factor. The full outcome tables above let the plan pick either
population deliberately.

## 2 — What the spend buys

The rollout's whole product is a re-ordering of a pool the free pre-sort
already ordered. Over 43,225 forward-scored pools:

| budget | pools | top-1 agreement | agreement given **no** dead-end in the pool | disagreements | dead-decided | live-value | mean gap, dead-decided | mean gap, live | child **set** changed |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 150k | 9,592 | 35.2% | 38.1% | 6,214 | 7.1% | 92.9% | 40.53 | 2.873 | 73.9% |
| 250k | 15,611 | 34.2% | 35.5% | 10,271 | 7.3% | 92.7% | 99.14 | 4.190 | 75.9% |
| 750k | 18,022 | 31.3% | 31.1% | 12,383 | 4.8% | 95.2% | 117.28 | 3.089 | 79.2% |

("Gap" is `value(rollout winner) − value(pre-sort #1)` in leaf-score units,
where the leaf is on a 1000 scale. "Dead-decided" = the pre-sort's #1 dead-ended
at hop 1 and the winner did not.)

**Top-1 agreement is 31–35%**, confirming the campaign's 25–29% on a different
grid. The winner's pre-sort rank is remarkably flat — 31–35% rank 0, then
~21%, ~17%, ~15%, ~14% — i.e. the rollout crowns rank 4 almost as often as
rank 1. And in **three pools out of four the rollout changes which three
children get expanded**, not merely their order.

**The disagreement is not driven by the dead-end bit.** Agreement conditioned
on pools where nothing dead-ended is 38.1% / 35.5% / 31.1% against 35.2% /
34.2% / 31.3% unconditionally — the same number. Dead-decided disagreements are
5–7% of all disagreements. This answers the brief's decomposition directly: the
25–29% agreement is a *value* phenomenon, not a *viability* phenomenon.

**But the value it moves is the other way round.** Weighting each disagreement
by the leaf-value gap it resolves:

| budget | dead-decided pools | value moved | live-value pools | value moved |
|---:|---:|---:|---:|---:|
| 150k | 440 | 17,834 (52%) | 5,774 | 16,586 (48%) |
| 250k | 754 | 74,748 (65%) | 9,517 | 39,872 (35%) |
| 750k | 594 | 69,663 (66%) | 11,789 | 36,420 (34%) |

A dead-end verdict moves 40–117 leaf points when it fires; a live-value
disagreement moves 2.9–4.2. So the rare bit carries **half to two-thirds of all
the leaf value the rollout re-orders**, on 5–7% of the events — and that is
precisely the bit §4 shows is wrong 53.3% of the time. The mechanism's largest
lever is its least reliable one.

Two honest limits on this table. First, leaf-score units are the rollout's own
currency; a leaf point is not a benchmark point, and the mapping is not
measured here (the counterfactual-pricing instrument in
[`benchmark-v2-search-economics.md`](benchmark-v2-search-economics.md) is the
tool for that, and it was not run). Second, "the pre-sort order" is the pool's
quality-objective order, not the local axis-L2 proxy the `LR_FWD_EVAL=off`
escape hatch reverts to; this is a comparison of orderings inside one pool,
not an A/B of two compilers.

## 3 — The price of the dead-end bit

A dead-end verdict is cheap and a correct one is not.

| | frames/call |
|---|---:|
| `dead_hop1` (the verdict as shipped: one sample) | 27.4 – 37.7 |
| `full` (both hops placed) | 43.7 – 59.5 |
| `dead_hop2` | 59.1 – 70.5 |
| `no_hop` | 0 |

The median charged-frame bucket is 16–31 for `dead_hop1` and 32–63 for `full`,
so **discovering "dead" costs roughly 60% of a full ride** — it is one pool
build instead of two. Total `dead_hop1` spend is 3.9% / 2.5% / 0.4% of the
compile at 150k / 250k / 750k. There is no meaningful frame prize in making the
*wrong* verdict cheaper: a minimal viability probe cannot cost less than the one
sample the rollout already draws, because that sample **is** the probe.

The prize, if there is one, is on the other side. From the truth ladder, the
frames it takes to establish the *correct* bit at a child the rollout called
dead:

| width at which life first appears | audits | median frames | mean frames |
|---:|---:|---:|---:|
| 2 | 4,355 | 187 | 196 |
| 3 | 2,044 | 191 | 202 |
| 5 | 2,185 | 238 | 270 |
| 8 | 1,781 | 298 | 334 |
| 16 | 1,013 | 355 | 380 |
| 32 | 577 | 505 | 615 |
| 80 | 190 | 754 | 1,206 |
| none by 80 (verdict true) | 13,664 | 1,294 | 1,260 |

Exhaustively establishing the truth costs **771 frames per verdict on average**
— 25× the wrong bit, and 3.5× the whole `dead_hop1` budget if applied to every
verdict. Nobody should propose that.

But the curve is front-loaded, and the cheap end is where the volume is: **one
extra draw refutes 14.5% of all dead-end verdicts** and five refute 28.5%.

The marginal price of that draw depends on one thing, and §4.5 settles it. As
the ladder runs it (search-grade, aim lane on) a 2-wide rebuild costs 185
median frames, because `sortWithLaneExtras` runs the charged **aim lane** as
soon as `nCand > 1`. With the aim lane suppressed — as `forwardFirstWidenedScore`
already does for exactly this reason (`node.ts setRolloutAimSuppressed`) — the
same rebuild costs **40 median frames**, the same order as the single draw the
rollout already pays, and it refutes the same verdicts.

## 4 — Verdict truth

This is [`budget-dividends-plan.md`](budget-dividends-plan.md) Phase 4's
discriminating measurement. It audits **every** hop-1 dead-end verdict on the
198-cell grid, not a sample: 31,494 verdicts, 100% sampling rate.

### 4.1 The method

At the instant the rollout returns "no candidate", the probe takes the child
node it judged, makes a **shallow copy with the candidate caches cleared**, and
re-runs `getCandidatesSorted` on the copy at a widening ladder — 1, 2, 3, 5, 8,
12, 16, 24, 32, 48, 64, 80 — stopping at the first width that yields a viable
catch. Width 80 is `HANDOFF_SHORT_RESCUE_N_CAND`, the widest generation the
search ever runs at one gap. Every frame is refunded; the copy absorbs the
cache so the real node keeps the empty 1-wide pool the rollout gave it.
Width 1 is re-run first as a determinism check and reproduced empty **31,494
times out of 31,494**.

### 4.2 The number

| budget | verdicts audited | verified **TRUE** | **FALSE** |
|---:|---:|---:|---:|
| 150k | 10,479 | 4,824 (46.0%) | **54.0%** |
| 250k | 13,385 | 6,046 (45.2%) | **54.8%** |
| 750k | 7,630 | 3,833 (50.2%) | **49.8%** |
| **all** | **31,494** | **14,703 (46.7%)** | **53.3%** |

*Correction (2026-08-03, close-out review): the pooled row originally
transposed its TRUE and FALSE cells (printing 16,791/53.3% as verified-true),
and a footnote rationalized the swap. The per-budget TRUE counts sum to
14,703 — exactly the refutation ladder's "never (verdict true)" row — so the
pooled verified-true rate is 46.7% and the FALSE rate is 53.3%. Downstream
texts that quoted "46.7% false" (including two commit messages and the L1
docstring's slice-matched 51.3%) understated the error rate; direction
favourable, no conclusion flips.*

**53.3% of the hop-1 dead-end verdicts are false.** The width at which the very
same generator, at the very same node, with the very same gates, first finds a
viable catch:

| rollout hop-1 width | verdicts it would refute | cumulative refuted |
|---:|---:|---:|
| 2 | 4,581 | **14.5%** |
| 3 | 2,118 | 21.3% |
| 5 | 2,273 | 28.5% |
| 8 | 1,867 | 34.4% |
| 12 | 1,811 | 40.2% |
| 16 | 1,075 | 43.6% |
| 24 | 1,131 | 47.2% |
| 32 | 670 | 49.3% |
| 48 | 684 | 51.5% |
| 64 | 370 | 52.6% |
| 80 | 211 | 53.3% |
| never (verdict true) | 14,703 | — |

**One extra draw would refute one verdict in seven.** The distribution is
stable across budget (refuted at width 2: 13.3% / 15.1% / 15.3%; by width 16:
43.1% / 45.5% / 40.9%).

**53.3% is a lower bound on the error rate.** The ladder reproduces only the
*normal sampling* lane. The search at the same node would additionally offer
the reuse lane, the brake lane, kinematic support, and — precisely because its
normal pool came back empty — the startup rescue tier, which samples a
**distinct catch stream** the ladder never draws from (§5). Every one of those
can only add candidates. The "verified true" column is therefore "still dead
after everything the ordinary generator can do", not "provably dead".

### 4.3 Which of the plan's three explanations

**Not the generation problem (branch 3).** The plan's check is "dead-end rate by
pool rank — if ranks 4–5 carry the rate and the pre-sort already priced them
low, the rollout re-purchases known information". Both halves come back
negative. The dead-end *rate* is flat in rank:

| budget | p0 | p1 | p2 | p3 | p4 | reuse | brake |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 150k | 14.6% | 15.0% | 15.7% | 15.6% | 16.7% | 17.3% | 26.1% |
| 250k | 11.1% | 11.6% | 11.6% | 12.6% | 12.3% | 15.5% | 19.8% |
| 750k | 5.6% | 5.7% | 6.0% | 5.8% | 6.1% | 7.3% | 10.0% |

and so is the verified-**true** rate:

| rank | audits | verified true |
|---|---:|---:|
| p0 | 4,207 | 47.2% |
| p1 | 4,330 | 47.7% |
| p2 | 4,460 | 46.3% |
| p3 | 4,507 | 47.4% |
| p4 | 4,593 | 47.3% |
| reuse | 4,761 | 60.3% |
| brake | 4,478 | 30.0% |

A 2-point spread across the whole pool. The pool's tail is not buying verdicts
instead of candidates: rank 4 dead-ends at 16.7% and rank 0 at 14.6%, and when
they dead-end they are wrong at the same rate. This also settles the connection
the brief asked for — the `HANDOFF_CANDIDATE_POOL = 5` "correctly flat" verdict
is *not* explained by the tail feeding dead candidates into rollouts. (The two
extra lanes do differ: `brake` candidates are the least trustworthy verdicts —
70% of their dead-ends are false — and `reuse` the most trustworthy.)

**Mostly the rollout artifact (branch 2), and it splits by terrain.** The
verified-true rate by stratum and source:

| source | stratum | audits | verified true |
|---|---|---:|---:|
| `frontier_dense_recovery` | capability | 5,389 | **64.4%** |
| `frontier_low_air_endurance` | capability | 3,239 | 59.5% |
| `frontier_pickup_progression` | capability | 8,553 | 55.3% |
| `dense_dialogue` | representative | 5,547 | 45.5% |
| `regression_transition_mosaic` | legacy_regression | 2,367 | 40.5% |
| `river_reentry` | representative | 718 | 29.7% |
| `amplitude_tides` | representative | 541 | 20.7% |
| `offgrid_conversation` | representative | 654 | 19.6% |
| `sparse_lowline` | representative | 2,936 | 19.0% |
| `high_air_drive` | representative | 1,546 | **5.3%** |
| `believer_impact_56s` | development_music | 4 | 0.0% |

| stratum | audits | verified true |
|---|---:|---:|
| capability | 17,181 | **58.9%** |
| legacy_regression | 2,367 | 40.5% |
| representative | 11,942 | **30.3%** |

**Where dead-ends are common they are usually real; where they are rare they
are almost always fabricated.** On the capability frontier — sources whose
whole point is that the terrain is sharp — a majority of verdicts hold. On
`high_air_drive`, 94.7% of them are machinery error. That is the owner's
"probably between the two", resolved into a boundary rather than a blend: the
verdict is a *terrain* signal on the frontier and a *breadth* artifact
elsewhere, and the compiler applies it identically to both.

Two more cuts. By phase: 49.9% true pre-completion (n=21,352), 39.9% post
(n=10,142) — repair-phase verdicts are the less reliable ones. By gap decile
the rate wanders between 38% and 64% with no monotone shape, so within a track
this is diffuse, not localized at hard gaps.

### 4.4 The confusion matrix against the realized search

The independent, no-probe ruler: every node a rollout judged is remembered by
identity (`extendNodeCached` memoizes, so the node the rollout judged *is* the
node the search expands if the frontier arrives there), and joined to the pool
the search actually built when it got there.

| | search found candidates | search found none | |
|---|---:|---:|---|
| **verdict ALIVE** | 27,429 | 0 | false-alive **0.0%** |
| **verdict DEAD** | 1,146 | 4,158 | false-dead **21.6%** |

32,733 joined nodes. The alive row is exactly 0% wrong, as it must be — one
viable sample is a constructive proof of viability, so the mechanism's errors
are all one-sided. The dead row is 21.6% wrong on this population against 53.3%
on the full verdict population, and the difference is selection, not
contradiction: the search only *arrives* at 5,304 of the ~31k nodes it judged
dead, and the ones it arrives at are the ones on paths whose earlier verdicts
were favourable. The realized ruler is a lower bound on the error rate; the
truth check measures it on the whole population.

Both agree on the sign and both are far from zero. There is no reading of
either in which the verdicts are trustworthy.

### 4.5 Is the extra life the aim lane's, or genuine sampling breadth?

It matters for the price of any fix: the aim lane runs as soon as
`nCand > 1`, so a naive widening buys its proposals *and* its charge. The
audit was re-run over a matched 8-source × 3-seed × 3-budget subset (15,275
verdicts) with the lane suppressed inside the probe
(`setRolloutContext(true)` + `setRolloutAimSuppressed(true)` — both are
required; `node.ts` gates the suppression on the conjunction, and the rollout
context is already restored by the time the hook fires).

| probe | audits | verified true | refuted @2 | refuted ≤5 | refuted ≤16 | refuted ≤80 | frames/audit | median frames, 2-wide rebuild |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| search-grade (aim lane **on**) | 15,275 | 47.9% | 14.0% | 26.9% | 42.1% | 52.1% | 776 | **185** |
| sampling only (aim lane **off**) | 15,275 | 47.9% | 13.4% | 26.4% | 41.9% | 52.1% | 689 | **40** |

**The verdicts are refuted by plain extra samples, not by the aim lane.** The
verified-true rate is identical to the tenth of a point and the refutation
curve moves by less than a point at every rung — but the cost of the cheap end
falls **4.6×** when the lane is suppressed. A widened rollout hop can therefore
have the correction without the aim lane's bill, which is what makes L1 below
affordable.

## 5 — Breadth parity audit

A code reading, independent of every measurement above: **what generation does
the rollout run at the child, versus what the search runs when the frontier
genuinely arrives at that same child?** All anchors in
`scripts/v0/optimizer/handoff.ts` unless noted.

The rollout's hop-1 expansion is one line — `forwardRolloutScore`:

```ts
const cands = getCandidatesSorted(at, gaps, ctx, seed, branch);
if (cands.length === 0) { /* DEAD-END VERDICT */ }
```

`branch` is **1** for the default `greedy` shape (`forwardArcValue` passes
`cfg.variant === "best" ? cfg.branch : 1`). `getCandidatesSorted` with
`nCand = 1` calls `solveOneGap(K = 1)`, which is exactly **one**
`sampleOneCandidate` attempt at attempt index 0.

| | rollout at the child | search at the same node |
|---|---|---|
| generator | `solveOneGap(K = branch)` | `solveOneGap(K = policy.nCand)` |
| **samples drawn** | **1** (greedy); 2–3 (opening-`best`); 3 (impact `firstBranch`) | `qualityHandoffSampleCount` = `max(8, round(27 × B/250k))` plus the scarce-budget floor rules — **measured 23.5 / 30.3 / 80.9** at 150k / 250k / 750k |
| catch gates | `sampleOneCandidate` — catch within ±1 frame, on the gap's lines, alive, not off-beat | **identical** (same function, same gates) |
| cost sort | trivial (1 item) | `sortCandidatesByCost` |
| quality re-sort | **no-op** (1 item) | `sortCandidatesByQuality` (objective.ts) |
| aim lane | **never runs** — gated on `nCand > 1` in `node.ts sortWithLaneExtras` | runs, `LR_AIM_TOPK_BASES = 3` model-proposed arcs, merged and requalified |
| pool admitted | all (1) | `HANDOFF_CANDIDATE_POOL = 5` |
| reuse lane | **absent** | `extraCandidateLane("reuse")`, `HANDOFF_REUSE_K = 1` |
| brake lane | **absent** | `extraCandidateLane("brake")` |
| kinematic support | **absent** | admitted support options |
| rescue on empty | **absent — the empty pool IS the verdict** | three tiers in `expandNode`: base rescue `HANDOFF_RESCUE_BASE_N_CAND = 32` (+`STARTUP_EXTRA = 48`) pool 12; short-deadline rescue `HANDOFF_SHORT_RESCUE_N_CAND = 80` pool 16 for gaps ≤ 12 frames; startup rescue on a distinct catch stream |

**So the two never disagreed about what "viable" means — only about how hard
to look.** The gates are the same function; the breadth differs by a factor of
24–81 before the aim lane, the two extra lanes and the rescue cascade are
counted. The dead-end verdict is not "no continuation exists here"; it is
"draw number 0 of the deterministic sample order at this gap did not catch".

That the sample order is a deterministic prefix is what makes the truth check
exact rather than approximate: `getCandidatesSorted`'s own contract is that a
smaller `nCand` is a prefix of the larger one (`solveAdditionalCandidates`
advances the per-gap RNG to the right attempt index), so re-running at width
*n* at the same node re-draws the *same* samples 0…n−1 the search would have
drawn. The probe's determinism self-check confirms this empirically: rebuilding
at width 1 reproduced the empty pool in **31,494 of 31,494** audits.

### This asymmetry is already known — on one gap class

`impactBestForwardEvalConfig` sets `firstBranch = 3` on impact-authored gaps
under budget × slack pressure, and its docstring states the problem in the same
terms this study measures:

> the greedy rollout prices a candidate's continuation by ONE sampled attempt
> at the child's next-contact state (branch=1 ⇒ solveOneGap(K=1)), whose
> within-state spread exceeds the between-candidate differences selection must
> resolve on impact-authored gaps (frontier-continuation study, 2026-07-17:
> 1-sample picks the two-gap optimum 8/24 vs best-of-8 24/24).

The mechanism, the diagnosis and an accepted fix already exist. What was scoped
to impact-authored gaps at comfortable slack is, on this study's evidence, a
property of **every** gap: the one-sample view is wrong about *existence*, not
only about *ranking*.

## 6 — Ranked lever candidates

Ranked by expected value, each with the evidence behind it, a predicted
magnitude and the evidence that is **missing** — this study proposes nothing and
changes nothing. Phase 4's three lanes are settled first, because the ranking
depends on which one we are in.

### Which lane

| lane | verdict |
|---|---|
| **1 — true signal** | **Partly true, and localized.** On the capability frontier 58.9% of verdicts hold (64.4% on `frontier_dense_recovery`). There the verdicts are terrain information and belong on the map as such. |
| **2 — rollout artifact** | **The dominant explanation.** 53.3% of all verdicts are false (46.7% verified true — see the §4.2 correction note); the gates are identical to the search's, so the entire discrepancy is breadth (§5); one extra draw refutes 14.5%; the false-dead rate is 21.6% even on the biased realized-search sample; on the representative stratum only 30.3% of verdicts hold and on `high_air_drive` 5.3%. |
| **3 — generation problem** | **Falsified.** The dead-end rate is flat in pool rank (14.6%→16.7% from rank 0 to rank 4) and so is the verified-true rate (47.2%→47.3%). The pool's tail is not feeding dead candidates to the rollouts. |

So the apportionment the plan asks for: **roughly half the verdicts are the
machinery's error and half are the terrain's**, and the split is
*between sources*, not within them. A fix aimed at the artifact does not
threaten the frontier's real information — it only stops manufacturing the same
signal where none exists.

### L1 — Re-draw on empty (conditional hop-1 widening) — **highest value, lowest cost**

**What.** When the rollout's single hop-1 sample comes back empty, draw again
before returning the verdict, up to a small ladder. Nothing changes on the
success path.

**Evidence.** §4.2 (one extra draw refutes 14.5% of verdicts, five refute
28.5%, and the curve is stable across budget); §4.3 (rank-flat, so this is not
a pool problem); §5 (identical gates, 24–81× breadth gap); §2 (the dead-end bit
carries 52–66% of all the leaf value the rollout re-orders while being 5–7% of
its decisions).

**Predicted magnitude.** *Cost:* zero on the 84–94% of rollouts whose first
draw succeeds; **~40 frames** on each that does not, with the aim lane
suppressed (§4.5 — the whole 2-wide rebuild at the median, i.e. of the same
order as the one draw the rollout already pays). Applied to every dead-end
verdict on this grid that is:

| budget | dead-end calls | extra frames | per compile | as % of the budget |
|---:|---:|---:|---:|---:|
| 150k | 10,474 | ~419 k | ~6.3 kf | **~4.1%** |
| 250k | 13,361 | ~534 k | ~8.1 kf | **~3.2%** |
| 750k | 7,557 | ~302 k | ~4.6 kf | **~0.6%** |

*Benefit:* removes ~14% of the false verdicts (a ladder to 5 removes ~26% for
roughly 3–4× the frames). Because the correction only ever converts a
maximum-penalty leaf into a normal one, its effect on ordering is one-signed —
it can promote a candidate the verdict wrongly buried, never bury a live one.
Note the cost profile is *inverse* to the budget: it is cheapest exactly where
the campaign's ROI gradient says frames are worth least (750k) and dearest at
150k, so the low-budget arm needs its own decision.

**And the frames are nearly free in score terms.** §7's free-judge arm bounds
what the *whole* 20.5% rollout budget costs the compile at 750k: **+1.78 ±
1.31** if it were refunded entirely. On that scale L1's 0.6% is worth about
0.05 points of forgone work, against a bit that carries half to two-thirds of
all the leaf value the mechanism moves. The asymmetry is the argument.

**Design note.** The trigger is the node's own outcome ("the first draw failed"),
not a threshold on a signal — the exact shape Phase 1 committed to for
revisitable depth, one hop up. It also inherits Phase 1's constraint check: it
can only *add* candidates, so it cannot lose a completion the baseline keeps.

**Missing evidence.** (i) The score value of a corrected verdict — this study
prices the bit in leaf-score units, and the leaf-point→benchmark-point mapping
was not measured (the counterfactual pricing instrument in
[`benchmark-v2-search-economics.md`](benchmark-v2-search-economics.md) is the
tool). (ii) Cache interaction: `node._candidatesCache` is keyed on
`(seed, nCand)`, so a re-draw memoizes the rolled node at the wider width and a
later real expansion re-uses that pool instead of building its own — a
compile-identity check is mandatory before any A/B is believed. (iii) Whether
the re-draw should pay the aim lane — §4.5 says it should not (same refutations,
4.6× the cost), and `forwardFirstWidenedScore` already sets the precedent for
suppressing it inside a widened rollout build.

### L2 — Generalize (or re-scope) the impact widening

**What.** `impactBestForwardEvalConfig` already widens the first rolled contact
to `firstBranch = 3`, gated to impact-authored gaps × budget × slack, and its
docstring diagnoses exactly the failure this study measured. The evidence says
the failure is not impact-specific.

**Evidence.** §5's citation of the mechanism's own docstring
("1-sample picks the two-gap optimum 8/24 vs best-of-8 24/24"); §4.3's
rank-flat, source-split result; and §1.2 — the widening is already **62.8% of
all rollout frames at 750k**, so its cost curve is known: 167 f/call against 47.

**Predicted magnitude.** The existing widening is now priced (§7): **+4.59 ±
2.20 per cell at 750k for 7.2 points of the compile's frames**, and exactly
zero at 250k where its ramp has not opened. Unconditional widening to 3
*everywhere* would multiply the linear population's cost by ~3.5×, taking the
rollout share from 20.5% of the compile to roughly 35% — almost certainly
unaffordable, and the reason L1's conditional form is ranked first. The
interesting version is the reallocation: *narrow* the impact widening and spend
the frames on the conditional re-draw everywhere, which by the arithmetic above
buys ~20× the coverage per frame.

**Missing evidence.** An arm with the widening applied on non-impact gaps; and
whether the widening's value at impact gaps is the *verdict* correction this
study measures or the *ranking* refinement its own docstring claims (they are
separable: firstBranch=3 both fixes dead-ends and picks a better child).

### L3 — Do not let an unverified verdict prune the frontier

**What.** `rankedOptions`' online-continuation filter drops, under full deadline
pressure, "candidates whose charged rollout already proved they cannot place the
next contact". §4 shows the proof is wrong 53.3% of the time overall and ~70%
of the time on the representative stratum, and `brake`-lane verdicts — 30.0%
true — are the least reliable of all while being the most likely to be the last
option left.

**Evidence.** §4.2, §4.3, §4.4 (`false-dead 21.6%` even on the realized-search
sample); the filter's own comment claims dominance, which requires the verdict
to be sound.

**Predicted magnitude.** Unknown here — the filter's firing rate is reported by
`handoffDeadlineProbeHook.onlineContinuationApplied` and was not collected in
this study. It is a **correctness** review item rather than a tuning knob: if
the filter fires often on representative sources, it is discarding live
candidates at exactly the moment the compile can least afford to.

**Missing evidence.** Firing rate × stratum × budget, and the verified-true rate
restricted to the verdicts the filter actually acts on. One instrumented grid
(the hooks already exist).

### L4 — Price the 750k shape mix before optimizing "the rollout"

**What.** Not a change; a correction to the map. At 750k, 73.9% of rollout
frames are branched shapes and only 26.1% are the greedy:2 the design
conversation assumes. Every "cheaper rollouts" idea aimed at greedy:2 addresses
a quarter of the spend at the production operating point, and the three
upgrades all switch on together through independent budget ramps that were
each measured alone.

**Evidence.** §1.2's shape table.

**Predicted magnitude.** Diagnostic. The actionable corollary is that the
`avg:2:1` mature upgrade is *cheap* (22 f/call, 4.9% of rollout frames) while
`firstBranch = 3` is not (167 f/call, 62.8%), so they should never be discussed
as one "adaptive shape" family again.

**Missing evidence.** Whether the three ramps compose the way each was measured
alone — none of them was measured with the other two live at 750k.

### L5 — The depth lever has a small ceiling

**What.** Shallowing hop 2 (the Phase-1 revisitable-depth family) can free at
most the hop-2 frames.

**Evidence.** Hop-2 frames are 8.8% / 32.4% / 12.2% of rollout frames at
150k / 250k / 750k = **2.5% / 9.0% / 2.5% of the whole compile**. 250k is the
outlier because it is the one budget where the pace prune has mostly switched
off (11.6% of rollouts at depth 1) but the branched upgrades have not yet
switched on.

**Predicted magnitude.** A perfect depth policy that never rolls a second hop
it did not need is worth ≤2.5% of the frames at both 150k and 750k, and its
real prize is therefore whatever those frames buy elsewhere — not the frames
themselves. This is consistent with Phase 1's own "shallowing hop 2 frees only
0.115%" and puts a ceiling on the family. The other side is now measured too:
removing hop 2 entirely (§7) costs **−3.84 ± 3.35 per cell at 750k** and, at
250k, a completion. So hop 2 is worth roughly what the hop-1 widening is worth,
at 1.6× the frames — the depth family is not where the leverage is.

**Missing evidence.** None needed for the ceiling; the value side is Phase 1's.

### Explicitly not a lever

- **A cheaper dead-end probe.** The verdict already costs one sample, and the
  sample *is* the probe (§3). There is nothing to make cheaper — only something
  to make correct.
- **Trimming `no_hop` rollouts.** They charge zero frames (§1.2).
- **The pool's tail.** Falsified in §4.3; `HANDOFF_CANDIDATE_POOL = 5` is not
  buying verdicts instead of candidates.
- **"Cheaper rollouts" as a family.** Capped at **+1.78 at 750k** by the
  free-judge arm (§7) — that is what refunding *every* rollout frame is worth.
  The forward-eval campaign left "cheaper rollouts" as an open lever; this
  study prices its ceiling and it is small. Spend frames on correctness
  instead.

## 7 — Paired arms

Four arms over a mini manifest derived by the sanctioned instrument
(`scripts/benchmark/mini_manifest.ts`, all eight compile-identity checks
passing): 16 sources × 3 seeds × {250k, 750k}, scored by
`scripts/v0/benchmark_v2/scale_study.ts`. These are **evidence, not decisions**
— a renormalized subset score on 3 seeds, well under the eval-slot floor, run
only to put an order of magnitude on the levers above.

Paired per-cell deltas against the baseline arm (unweighted mean over the 48
cells at each budget, with its standard error), and the rollout share each arm
ends up charging:

| arm | budget | Δ per cell | SE | valid (base / arm) | rollout share, base → arm | subset score, base → arm |
|---|---:|---:|---:|---:|---:|---:|
| `LR_FWD_EVAL=greedy:1` (drop hop 2) | 250k | **−11.36** | 16.27 | 43 / 42 | 27.5% → 20.4% | 560.52 → 556.62 |
| | 750k | **−3.84** | 3.35 | 48 / 48 | 20.5% → 8.9% | 619.77 → 622.53 |
| `LR_IMPACT_BEST_FWD=0` (drop the hop-1 widening) | 250k | **+0.00** | 0.00 | 43 / 43 | 27.5% → 27.5% | 560.52 → 560.52 |
| | 750k | **−4.59** | 2.20 | 48 / 48 | 20.5% → 13.3% | 619.77 → 617.50 |
| `LR_FWD_EVAL_CHARGE=0` (make the judge free) | 250k | **+5.66** | 11.74 | 43 / 43 | 27.5% → 35.6% | 560.52 → 565.35 |
| | 750k | **+1.78** | 1.31 | 48 / 48 | 20.5% → 25.2% | 619.77 → 621.94 |

Four things worth carrying forward.

**The 250k `LR_IMPACT_BEST_FWD=0` row is exactly zero on all 48 cells** —
byte-identical compiles. That is not a null result, it is a confirmation: the
widening's budget ramp is zero at 250k by construction, and the instrument
reproduces that exactly. It also means §1.2's shape table is not an artifact of
how the probe classifies calls.

**The hop-1 widening buys +4.59 ± 2.20 per cell at 750k for 7.2 points of the
compile's frames** (20.5% → 13.3%, i.e. 12.9% of all frames as §1.2 says
independently). That is the only measured price for widening the first rolled
contact anywhere in the repo, and it is the yardstick L1 should be judged
against: L1's conditional form is predicted to cost **~0.6% of frames at 750k**,
roughly 20× less, while addressing the same failure on *every* gap rather than
on impact-authored ones.

**Hop 2 buys +3.84 ± 3.35 per cell at 750k for 11.6 points of frames** —
the same order of value as the widening at 1.6× the frames, and the paired
interval crosses zero. At 250k the arm is noisy and loses a completion
(43 → 42 valid), which is the shape Phase 1 already knows: depth withdrawal
risks completions where completion is the binding constraint. Note the
subset score moves the *other* way at 750k (+2.76) while the paired per-cell
mean is negative — the two disagree because the subset score is stratum-weighted
and the capability stratum is over-represented in this mini manifest. **Neither
is a decision**; both are three-seed evidence far below the eval-slot floor.

**The free-judge ceiling is +1.78 at 750k.** Refunding every rollout frame —
handing the compile back the entire 20.5% and letting it do 25.2% worth of
rollout work for nothing — is worth **+1.78 ± 1.31 per cell**. That is the
hard ceiling on the whole "cheaper rollouts" family: *no* speed-up of forward
evaluation, however total, can be worth more than that at the production
budget, because making it completely free is worth that much. (At 250k the
figure is +5.66 ± 11.74 — the interval is too wide to say anything except that
the low-budget answer is different, which is the ROI gradient again.)

This inverts the cost/benefit for L1. Its ~0.6%-of-frames price at 750k costs,
in this currency, on the order of **0.05 points** — while the bit it corrects
carries half to two-thirds of all the leaf value the mechanism moves. Spending
frames to make the verdicts right is cheap; saving frames by making the
rollouts cheaper is capped at +1.78.

## What this study does not claim

- **No leaf-point → benchmark-point mapping.** §2 prices the rollout's
  decisions in the leaf scorer's own units. That the dead-end bit carries
  52–66% of the leaf value it moves does *not* mean it carries that share of
  the headline.
- **No causal value for the verdicts.** The truth check says the verdicts are
  wrong; it does not say what correcting them is worth. Only an A/B does, and
  this study runs none that implement a correction.
- **No claim about the aim lane, repair, or the deadline consumers**, beyond
  what §4.5 measures about the probe's own cost.
- **The truth-check arm is not frame-identical** to production, and says so in
  the protocol. The spend/verdict/confusion arm is, proven on 198 of 198 cells.
- **The grid is 11 sources, not 44.** The strata are represented but the
  weights are not the suite's; every per-source number is given so the plan can
  reweight.
