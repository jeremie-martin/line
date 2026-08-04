# Forward-eval metrics — the M-set

Standing metric set for the compiler's forward-evaluation lane: what each number
means, where it comes from, what it costs to get, and — the part that is a
contract, not a footnote — how each one can be moved without making the compiler
any better.

Written for a maintainer who has not read the campaign documents. The measured
ground truth behind these metrics is `docs/rollout-economics-study.md` (198
compiles, 31,494 audited verdicts); this file does not restate it. The mechanism
itself is fenced in `scripts/v0/optimizer/handoff.ts` (see the subsystem banner
at `handoff.ts:5807`).

## The framing, which is not negotiable

**M0 — the 48-seed benchmark V2 headline — is the only promotion metric.**
Everything else on this page is diagnosis, experiment readout, or falsification
device. None of it is an acceptance gate, a target, or a tiebreak. Several of
these numbers move in the "good" direction without the headline moving at all,
and one of them (M5) has no good direction; the failure-mode notes travel with
the definitions so that nobody optimizes a proxy by accident.

If a candidate's story is "M*n* improved", the story is incomplete until M0 has
been run.

## Reading them

Every Tier-1 metric is one command away from any archive the compiler has ever
written:

```
npm run benchmark:v2:fwd-metrics -- --in=<path>
```

`--in=` accepts a `<prefix>.stats.json` sidecar (`scripts/v0/run.ts`), a
`golden.json` (`rows[].checkpoints[].compile_stats`), or a benchmark v2 run
archive, plain or gzipped (`runs[].stats`). It prints M1–M8 per (source, budget)
plus a pooled row, writes a machine-readable record next to the input, and
appends one line per reading to `generated/benchmark-v2/fwd-metrics/index.jsonl`
so a trend exists without anyone curating it. `--help` for the rest.

Aggregation is a **ratio of sums** — sum of numerators over sum of denominators
across the cells in a group, never a mean of per-cell ratios. These are frame-
and call-accounting questions and a mean of ratios would weight a 40-frame
compile like a 750k one. Two documented exceptions: `M8 nCand` is a mean over
per-compile means (the counter is already a mean), and `M8 fc/B` sums only over
cells that reached first completion, reporting the rest as a count.

A metric whose denominator is zero prints `n/a` **with the reason**, never `0`
and never `NaN`. "This never happened" and "this happened and measured zero" are
different facts and the reader must not have to guess which one it is looking at.

## Cost tiers

| tier | what it takes | which metrics |
|---|---|---|
| **1** | free — the counters already ship in `CompileStats.fwd_eval` / `.deadline` and are in every archive | M1, M2 (total), M3, M4, M5, M6, M7, M8 |
| **2** | the observation hooks in `handoff.ts` (`setHandoffRolloutProbeHook:706`, `setHandoffExpansionProbeHook:757`, `setHandoffDeadlineProbeHook:853`), driven by `scripts/v0/study_rollout_economics.ts` / `scripts/v0/study_continuation_filter.ts`. Hooks uninstalled ⇒ **bit-identical compiles**, re-verified with `--verify-identity` on trackHash + full_score + sim_frames | M2 by shape, outcome classes, M9 |
| **3** | ground-truth re-expansion at the search's own widths — ~771 frames per verdict, charged then refunded. Track-identical but **not** frame-identical (measured median \|Δsim_frames\| 0.034%, max 6.47%) | M10 |

M5 and M6 are Tier 1 only in the sense that the counters exist; the agreement
family is opt-in and reads zero unless the compile ran with
`LR_FWD_EVAL_AGREEMENT=1` (`handoff.ts:6133`). The reader reports `n/a` with that
reason rather than pretending the zeros are measurements.

---

## M0 — headline

**Definition.** The benchmark V2 48-seed headline
(`npm run benchmark -- eval --seeds=48 --jobs=32`).

**Question.** Should this change ship?

**Tier.** An eval slot.

**Failure modes.** None that matter here: it is the arbiter, so every other
metric on this page is defined relative to it. The only discipline it needs is
the standing one — the decide output (P(+), CI) is an input to the promotion
call, never a hard gate.

## M1 — rollout frame share

```
(fwd_eval_frames_charged + start_eval_frames_charged) / sim_frames
```

`fwd_eval_frames_charged` and `fwd_eval_calls` are accumulated in
`forwardArcValue`'s `finally` (`handoff.ts:6762-6763`);
`start_eval_frames_charged` in `startForwardScore`'s
(`handoff.ts:6332`); `sim_frames` is `CompileStats.sim_frames`
(`scripts/v0/types.ts:430`).

**Question.** Where did the budget go? Forward evaluation is the compiler's
largest single spend category and this is its size.

**Tier.** 1.

**⚠ Failure modes.** *Cost accounting, never a target.* Driving M1 down is the
"cheaper rollouts" family, and that family is capped: the free-judge arm
(`LR_FWD_EVAL_CHARGE=0`, which refunds every rollout frame and therefore buys the
same judgements for free) is worth **+1.78 ± 1.31** headline points. That is the
ceiling on everything a frames-saving story can pay. Reject the framing early.
Note also that the share is *not* a starvation index: it falls at high budget
because the breadth law grows `nCand` linearly, not because rollouts got cheaper
(see M8).

## M2 — frames per rollout, by shape

```
total:    fwd_eval_frames_charged / fwd_eval_calls
by shape: Tier 2 — the rollout probe's `variant:depth:branch[+fbN]` key
```

**Question.** Is the arm running the shape you think it is? The adaptive layer
(`adaptiveForwardEvalConfig`) can silently replace the configured shape, and the
three adaptive arms only engage when `LR_FWD_EVAL` is *unset*.

**Tier.** 1 for the total; **2** for the split, because `greedy:2:1` and the
impact first-widened arm differ only in `firstBranch`, which no counter carries.
The rollout probe record carries `firstBranch` for exactly this reason
(`HandoffRolloutProbeRecord`, `handoff.ts`), and the study keys shapes as
`greedy:2:1` vs `greedy:2:1+fb3` so the default arm's spelling stays comparable
with the study's own tables.

**Failure modes.** A per-shape mean over a mixed population is an average of two
different mechanisms; always read it beside the call counts.

## M3 — redraw refutation rate · **the thermometer**

```
fwd_rollout_redraw_refuted / fwd_rollout_redraws
```

Both are incremented inside `redrawFirstHopOnEmpty` (`handoff.ts:6532`, counters
at `:6540` and `:6555`), which runs whenever a rollout's first hop expands to an
empty pool: it re-requests the pool at width + 1, and counts a refutation when
the extra draw finds a candidate the single draw missed.

**Question.** Is the compiler still manufacturing false dead-end verdicts, and
where? This is the 771-frames-per-verdict ground-truth audit reduced to two
integers that **every compile already carries** — a free, always-on, per-compile
estimate of hop-1 verdict falsity at width + 1. It has shipped in every archive
since redraw-on-empty landed and was never read as a standing number; the first
reading is at the bottom of this file.

**Tier.** 1 (free).

**⚠ Failure modes.**
- **Not monotone across shape changes.** A wider base draw removes the empties
  *before* the re-draw ever sees them, so a change that genuinely reduces false
  verdicts can drive M3 down, up, or to 0/0. M3 is only interpretable together
  with **M4**, the traffic it is a rate over.
- **0/0 is a real answer.** A shape that never dead-ends has no redraws; the
  reader prints `n/a (0/0 — no hop-1 pool was ever empty at its own width)`, not
  0%.
- **It is a lower bound on falsity**, not the falsity rate: it only sees width
  + 1. The full refutation ladder (14.5% cumulative at width 2 rising to 53.3% at
  width 80) is in the study.

## M4 — redraw trigger rate and residual dead-end rate

```
trigger:  fwd_rollout_redraws      / fwd_eval_calls
residual: fwd_rollout_no_candidate / fwd_eval_calls
```

`fwd_rollout_no_candidate` is incremented at the three rollout shapes' empty-pool
branches (`handoff.ts:6606`, `:6674`, `:6705`). Post-redraw it counts a hop-1
empty only when the width+1 draw came back empty too — the **surviving** verdict.
Hop 2 and deeper get no re-draw, so those are counted exactly as they always were.

**Question.** How much verdict traffic is there at all? M3 is a rate; M4 is its
denominator's story.

**Tier.** 1.

**⚠ Failure modes.** *Terrain-dominated.* Per-source dead-end rates span
10.3%–78.1% and that spread is the specs, not the compiler. Compare M4 only
within a `(source, seed, budget)` cell across arms — never across sources, and
never as a quality ranking of sources.

**Post-redraw vocabulary.** A hop-1 empty pool now has three fates, and the
Tier-2 outcome classes name all three: `dead_hop1_refuted` (the extra draw found
candidates — the verdict was overturned at the source), `dead_hop1` (the extra
draw found nothing either — the surviving verdict, and the only thing
`fwd_rollout_no_candidate` counts), and the trigger population, which is the sum
of the two. The study's pre-redraw `dead_hop1` column is comparable to
`dead_hop1 + dead_hop1_refuted` here.

## M5 — top-1 agreement and winner quality-rank

```
agreement:            fwd_top1_agree                  / fwd_pools
winner quality-rank:  fwd_quality_rank_of_winner_sum  / fwd_pools
rank of quality #1:   fwd_rank_of_quality_top1_sum    / fwd_pools
```

Accumulated in `recordFwdEvalAgreement` (`handoff.ts:6055`), over pool-source
candidates only, and **only** when the compile ran with
`LR_FWD_EVAL_AGREEMENT=1` (`handoff.ts:6133`). The instrument is frame-identical.

**Question.** Are the two judges independent? The free quality pre-sort picks
which candidates are admitted; the charged rollout re-ranks the survivors.
Agreement says how much the second judge is changing.

**Tier.** 1, but the counters are zero unless the flag was set.

**⚠ Failure modes.** *No good direction.* Agreement near 1 means the rollout is
buying nothing and should be cheaper or gone; agreement near 0 means the two
judges disagree, which is not the same as the rollout being right. Neither end is
quality. **Never optimize this, in either direction, and never use it as a
tiebreak.** It is a description of the mechanism's independence and nothing else.

## M6 — disagreement value gap

```
fwd_disagree_value_gap_sum / fwd_disagree_count
```

Leaf value of the rollout's winner minus leaf value of the quality pre-sort's
#1, averaged over the pools where they disagree.

**Question.** When the rollout dissents, how confidently does it dissent?

**Tier.** 1 (same flag as M5).

**⚠ Failure modes.** *The currency does not convert.* The gap is denominated in
leaf points produced by the same objective the rollout is scored against — the
judge is also the scorekeeper — and **no measured exchange rate to headline
points exists**; the study explicitly refuses to construct one. M6 movement is
colour. It is never evidence for or against a candidate.

## M7 — decisions changed per kiloframe

```
1000 · fwd_disagree_count / sim_frames
```

**Question.** How much re-ordering is the rollout spend actually buying, per
frame?

**Tier.** 1 (same flag as M5).

**⚠ Failure modes.** More re-ordering is not better re-ordering — this measures
activity, not correctness. It pairs only with M0, and only as a cost-per-effect
denominator once M0 has already said the change was good.

## M8 — budget conversion

```
nodes expanded:   search_nodes_expanded                (types.ts:470)
first completion: first_completion_frame / budget      (types.ts:454)
per-gap breadth:  handoff_policy_candidate_count_mean  (types.ts:445)
```

`nCand` is the breadth law `27 · B/250k`, floor 8, **no ceiling**
(`qualityHandoffSampleCount`, `handoff.ts:5201`; anchor at `:1140`).

**Question.** Does extra budget reach the search, or does it all go to per-gap
sampling? Pure accounting, and the currently-measured answer is that it does not:
tripling the budget buys roughly 1.1× the tree and 3.3× the per-gap sampling,
while the rollout share falls.

**Tier.** 1.

**Failure modes.** None — it is an accounting identity. The one reading caution:
`first_completion_frame / budget` is only defined for cells that completed, so
the reader excludes the rest and reports how many it excluded.

## M9 — continuation-filter firing rate

```
firing rate:   builds where onlineContinuationApplied / pre-completion pool builds
acting rate:   ...of those, the ones that removed at least one option
pruned/firing: options dropped per firing
```

The filter lives at `handoff.ts:4468`: under **full deadline pressure**, **before
first completion**, near the frontier, and when at least one option is known to
continue, it drops every ranked option whose charged rollout already proved it
cannot place the next contact (`forwardContinuation === false`). It is the third
and least-visible consumer of the dead-end verdict bit, and it is the one that
removes nodes from the frontier outright.

**Source.** `setHandoffDeadlineProbeHook` (`handoff.ts:853`), which fires at the
exact line the decision is made and carries `onlineContinuationApplied`, the
count of options about to be dropped, and the verdict node behind each — all
built inside the hook guard, so an uninstrumented compile pays nothing. Driven by
`scripts/v0/study_continuation_filter.ts`.

**Tier.** 2 (observation hook; the firing arm is bit-identical).

**Failure modes.** Observation only. Two denominators matter and they differ: the
filter can *engage* and drop nothing (it requires at least one continuing option
but not that any option fails), so "firings" and "acting firings" are separate
numbers. Also note it is structurally dead wherever the deadline ramp never
saturates, which at 750k is nearly everywhere — see the reading below.

## M10 — verified-true rate at ladder widths

**Definition.** At a sampled dead-end verdict, re-run generation at the node the
rollout declared dead, at the widths the search itself uses
(1, 2, 3, 5, 8, 12, 16, 24, 32, 48, 64, 80 — the last two are the rescue tiers),
on a cache-isolated copy of the node, charging then refunding every frame.
"Verified true" = nothing lives there at any width.

**Question.** The ground truth M3 estimates. Is the verdict actually right?

**Tier.** 3 — ~771 frames per verdict, and the arm is track-identical but not
frame-identical.

**Failure modes.** Expensive; re-run it only when a change alters what a verdict
*means* (a different rollout shape, a different width, a different pool
construction). Otherwise cite the measured numbers in the study. Post-redraw it
measures a strictly harder population than the study's original: L1 has already
removed the cheapest refutations, so a *lower* false rate here is not progress
by itself.

---

## The deadline telemetry companion

The M-set describes what forward evaluation spends and buys. The deadline block
describes the coordinate it is throttled by, and the two are read together:
`forwardEvalTop` (how many of the admitted 5 get rolled) and the M9 filter are
both functions of the deadline margin. It ships in `CompileStats.deadline`
(`types.ts:775`), is accumulated at the one place the ramp is read
(`recordDeadlinePoolBuild`, `handoff.ts:5929`, called from `rankedOptions`), and
is snapshotted at `handoff.ts:2060`.

| field | meaning |
|---|---|
| `deadline_pool_builds` | every `rankedOptions` call that read the margin, all callers |
| `deadline_pre_builds` / `deadline_post_builds` | split at first completion, the Phase-1a consumer boundary. Builds whose caller passed no margin (the non-policy lanes read `Infinity`) are in neither, so `pool_builds − pre − post` is the unpaced remainder |
| `deadline_pre_pressured` / `deadline_pre_full_pressure` | pre-completion builds where the ramp engaged (`pressure > 0`) and where it saturated (`pressure ≥ 1`) |
| `deadline_{pre,post}_margin_sum` / `_min` | margin distribution per phase; mean is `sum / builds`, min is `null` until a finite margin is seen |
| `deadline_terminal_considers` / `deadline_terminal_without_improvement` | **a subsequent-terminal churn measure, NOT a phase-flip gap** (corrected 2026-08-04). It counts every complete track the search re-derives that fails to beat the incumbent's `axis_quality` — overwhelmingly repair restarts and tail-completion re-walks after the first completion. The *first* terminal is excluded by construction: `contract_passed` dominates `register.consider` and structural terminals pass the contract by construction, which is why `deadline_first_terminal_frame` and `deadline_first_improving_terminal_frame` coincide in 4,406 of 4,406 measured compiles (both N=48 archives + all probes). Read it as "how much of the post-completion budget re-derives a non-improvement" — a repair-ROI number — and never as evidence that the controller's phase flip lags the estimator's target event (that lever is falsified; see the plan's Mandate iteration 2). Incremented at `handoff.ts:1905-1906` |
| `deadline_first_terminal_frame` / `deadline_first_improving_terminal_frame` | the frames that bracket that window; `null` when the compile never reached the event |

The `fwd-metrics` reader prints the derived shares (pre-pressured, pre-full, mean
pre/post margin, terminal-without-improvement) as its third table whenever the
input carries the block.

---

## The first standing reading (2026-08-04)

Baseline of record `tail-lane-slack-750k` (595.98), read straight off the
promotion archive — no compiles were run for this.

```
npm run benchmark:v2:fwd-metrics -- \
  --in=generated/benchmark-v2/eval/cached-N48-2026-08-04T00-16-50Z.N48.json.gz
```

2,112 compiles · 44 sources · 750k · sha256
`84154bab8eb229cb4ebbce254826f748f55423f7d638a7d62ce75a08c191dc3e`.

| metric | pooled | numerator / denominator |
|---|---|---|
| **M1** rollout frame share | **20.6%** | 330,042,601 / 1,598,759,417 frames |
| **M2** frames per rollout | **62.7** | 309,283,059 / 4,930,682 calls |
| **M3** redraw refutation · *thermometer* | **14.3%** | 70,328 / 491,324 |
| **M4** redraw trigger rate | **9.96%** | 491,324 / 4,930,682 calls |
| **M4** residual dead-end rate | **24.4%** | 1,204,973 / 4,930,682 calls |
| **M8** nodes expanded (mean) | 179.8 | |
| **M8** first completion / budget | 55.2% | |
| **M8** nCand (mean of means) | 81.0 | the breadth law at 750k, exactly |
| deadline: pre-completion pressured | 22.2% | 50,296 / 226,188 builds |
| deadline: pre-completion at FULL pressure | 0.40% | 900 / 226,188 builds |
| deadline: mean pre / post margin | 3.29 / 10.02 | |
| deadline: terminal without improvement | 95.6% | 145,641 / 152,336 |

M5/M6/M7 are `n/a` on this archive: promotion evals do not set
`LR_FWD_EVAL_AGREEMENT=1`, and the reader says so rather than reporting the
zeros.

**The terrain ordering reproduces itself, for free.** M3 per source runs from
3.4% (`frontier_pickup_progression_shifted`) and 5.3–5.7% on the other
capability frontier sources up to 22–33% on `offgrid_conversation`,
`loose_pocket` and `open_hook` — capability lowest, representative highest,
which is the ordering the 31,494-verdict audit found (study §4.3) at 771 frames
per verdict. Two shipping integers reproduce it at zero cost. Read against M4:
the capability sources are also where the traffic is (27–38% of calls trigger a
redraw on the frontier sources vs 2–5% on the easy ones), so the low refutation
rate there is a rate over a very large denominator, not an absence of dead ends.

## M9's first reading — the L3 residue (2026-08-04)

The continuation filter's own numbers, collected as Phase 2.4 of
`docs/forward-eval-value-plan.md`. Observation only: no default was touched and
nothing was fed back into the search.

**Grid provenance.** `scripts/v0/study_continuation_filter.ts`, the six-source
PoC panel (`frontier_dense_recovery`, `frontier_low_air_endurance`,
`high_air_drive`, `sparse_lowline`, `dense_dialogue`,
`regression_transition_mosaic`) × seeds 0,1,2 × {250k, 750k} = 36 cells per arm,
source manifest `benchmark/v2/compat/source-manifest.json`, jolt −15 ms, engine
wasm, baseline of record `tail-lane-slack-750k`.

**Two arms, because they are priced differently.** The FIRING arm
(`--truth-rate=0`) is exact: all 36 cells reproduced the uninstrumented compile
on **trackHash 36/36 and sim_frames 36/36**, so the rates below are the
production rates. The TRUTH arm (`--truth-rate=1`) adds the Tier-3 re-expansion:
trackHash 36/36, sim_frames 33/36, median \|Δsim_frames\| 0.000%, max 0.040% —
the documented Tier-3 property, which is why the two arms are reported separately
rather than merged.

### Firing rate × stratum × budget (FIRING arm)

| stratum | budget | cells | pool builds | pre-completion | at full pressure | firings | firings / pre | acting | options pruned | pruned / firing |
|---|---|---|---|---|---|---|---|---|---|---|
| capability | 250k | 6 | 1,545 | 1,176 | 745 | 202 | **17.2%** | 129 | 332 | 1.64 |
| representative | 250k | 9 | 2,517 | 1,011 | 53 | 44 | 4.4% | 36 | 90 | 2.05 |
| regression | 250k | 3 | 753 | 359 | 0 | 0 | 0.0% | 0 | 0 | n/a |
| capability | 750k | 6 | 2,592 | 1,258 | 16 | 9 | 0.7% | 9 | 38 | 4.22 |
| representative | 750k | 9 | 3,083 | 955 | 0 | 0 | 0.0% | 0 | 0 | n/a |
| regression | 750k | 3 | 775 | 323 | 0 | 0 | 0.0% | 0 | 0 | n/a |
| **POOLED** | | 36 | 11,265 | 5,082 | 814 | 255 | **5.0%** | 174 | 460 | 1.80 |

Per source (both budgets pooled), the firing is almost entirely one cell:
`frontier_dense_recovery` 22.3% at 250k and 0.9% at 750k, `dense_dialogue` 9.1%
at 250k, **every other source 0.0% at both budgets**.

**Reading.** The filter is a 250k-capability mechanism. Its gate is full deadline
pressure, and full pressure is itself rare at 750k (16 of 1,258 capability
pre-completion builds; 0 elsewhere), so at the promoting budget the lane is
structurally dormant — 9 firings and 38 pruned options across 36 compiles. The
`acting` column is the second thing to notice: only 174 of 255 firings dropped
anything at all, because the gate requires that *some* option continues, not that
any option fails. "Engaged" and "acted" are different denominators and the
register row needs both.

### Verified-true rate on the verdicts the filter acts on (TRUTH arm)

Method: every option the filter dropped is a verdict read at a specific
next-contact node. Each such node is audited once (deduplicated by node identity,
so the rate is over verdicts and not over option slots) by re-running generation
on a cache-cleared copy at the M10 ladder widths and refunding every frame. All
460 acted-on verdicts on the grid were audited — no sampling. "Reproduced empty
at width 1" held 460/460, so the audit is looking at the same pool the verdict
was read from.

| stratum | budget | verdicts audited | verified TRUE | true | **FALSE** |
|---|---|---|---|---|---|
| capability | 250k | 332 | 188 | 56.6% | **43.4%** |
| representative | 250k | 90 | 69 | 76.7% | 23.3% |
| capability | 750k | 38 | 29 | 76.3% | 23.7% |
| **POOLED** | | **460** | **286** | **62.2%** | **37.8%** |

Refutation ladder on the acted-on population — the first width at which a catch
appears:

| width | 1 | 2 | 3 | 5 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 80 | none |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| verdicts | 0 | 0 | 36 | 36 | 21 | 15 | 17 | 17 | 9 | 14 | 5 | 4 | 286 |
| cumulative refuted | 0.0% | 0.0% | 7.8% | 15.7% | 20.2% | 23.5% | 27.2% | 30.9% | 32.8% | 35.9% | 37.0% | 37.8% | — |

**Reading.** Widths 1 and 2 refute nothing, which is exactly what shipped
redraw-on-empty already took: this is the *residual* population, and it is still
**37.8% false**. So the filter removes a frontier node on a refuted proof in
roughly three cases in eight, worst on the capability frontier at 250k (43.4%).
That is the L3 register row, and it is now a number rather than an open question.

**What this does not license.** The filter's total footprint on the promoting
surface is 38 pruned options across 18 cells at 750k, so no headline-sized
candidate lives here at the promoting budget: the finding is about the 250k
capability regime, where the low-budget standing reading lives. And a false
verdict is not automatically a lost completion — the study's realized-search
confusion matrix (false-dead 21.6%, false-alive 0.0%) is the honest bound on what
correcting one buys. Treat this as evidence about where the dead-end verdict
mechanism is weakest, priced against M0 like everything else.
