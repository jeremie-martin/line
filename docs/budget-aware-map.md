# The budget-aware map

Every place the compile budget enters compiler behaviour, what it controls, what
shape it has, what evidence stands behind it, and whether it does anything at the
budgets the system actually runs.

Surveyed at `c9058fa` (branch `codex/engine-improvement-research-handoff`),
2026-08-01, from five independent territory surveys, merged and re-verified
against the code. **117 entries.** Every load-bearing claim below was re-checked
by reading the source or measuring an archive; claims that survived their check
are marked VERIFIED, claims that were wrong are marked CORRECTED with the
correction, and claims that could not be checked are marked UNVERIFIED and are
never presented as fact.

**Reconciled at `884173f`, 2026-08-02, to the compiler the budget unification
program shipped** (`docs/budget-unification-plan.md`, now CLOSED). Fifteen
entries were deleted from the compiler and carry a RETIRED tombstone with the
deleting commit — their knowledge stays, because the reason a mechanism was
deleted is the reason not to rebuild it. One entry was added (SLK-05, the
margin). Where a mechanism survived with a different meaning the entry states
its current form and re-stamps the verdicts that no longer apply. §6 is what the
program measured and is new; everything before it is the survey with the
program's corrections folded in.

**Re-reconciled at `31c2beb`, 2026-08-03, to the budget dividends campaign**
(`docs/budget-dividends-plan.md`, now CLOSED). That campaign promoted three
candidates and the two that moved the compiler are folded in here: the deadline
margin's structural base is the calibrated artifact (Phase 3, `075e774`) and the
forward-eval rollout re-draws on an empty first hop before accepting a dead-end
verdict (Phase 4 L1, `bb45125`). One entry was added (SC-24, the re-draw —
budget-blind, listed because it changes what two live deadline consumers read).
§6.5 is the verdict-truth measurement and is new; §6.1's reopening conditions and
§6.2 carry the campaign's stamps.

**Re-stamped at `2ff1ecf`, 2026-08-03, by the forward-eval campaign's Phase 0
truth-in-labeling pass** (`docs/forward-eval-value-plan.md`). No mechanism
changed; six claims did. The headline correction is PLB-03: the estimator
artifact's `interval` layer is **policy-bound**, not claim-inert — it sizes every
repair restart ceiling. §2g is re-stamped RETIRED (its five identifiers are gone
from the code), four CONFIRMED bullets in §2's additional checks are corrected to
HEAD, PLB-04's "last binary budget thresholds" gains `aim.ts`'s two, LC-14 gains
the min-merge, and the same-share rule is recorded as machine-enforced.

**Re-reconciled at `fd734a5`, 2026-08-04, to the forward-eval value campaign**
(`docs/forward-eval-value-plan.md`; the in-scope vein map is empty at iteration
6, the mandate is open). Two promotions moved the compiler — the tail-lane slack
fix (`d84c71c` + `3674b2f`, 595.98) and the production rollout base
`greedy:2 → greedy:1` (`9f58697` + `1ecbc1b`, **596.41**, the baseline of record)
— and one filed offender was deleted (`7d7348b`, d3/c1). Three entries are added:
**SC-25** the base shape and its composable override, **SC-26** the twelve
study gates the campaign built and the verdicts they now carry, **LC-32** the
deadline telemetry block, which makes the one live signal visible in an archive
for the first time. The headline correction is a *comparability* one and it
re-stamps verdicts throughout: **`LR_FWD_EVAL` set to any value switches the
adaptive arms off**, so every historical shape verdict taken through that flag
was measured arms-off — the depth-family ceiling in §6.5 is the one that
inverted (−3.84 ± 3.35 arms-off, **+12.53 ± 4.14 composed**, and the composed
sign is what shipped). §6.6 is what the campaign measured and is new; §8 gains
one row.

This document maps and classifies. It does not decide. §7 groups the entries into
clusters a decision could be taken over; the decision is the owner's.

---

## 1. The state of budget-awareness, in one page

**There is exactly one budget scalar and in production there is exactly one of
it.** `compileHandoff(spec, seed, {budget})` takes one positive integer of
simulated rider frames, and one call is one independent full run from scratch.
The option contract carries a second budget (`policyBudget`, "the budget the
search policy believes in") but no live caller sets it, so on every headline,
production and benchmark compile `policyBudget === targetBudget`. Every policy
read is `policyBudget`; every stop test is `targetBudget`; the repair phase stops
at `repairBudget = policyBudget`, which is the whole budget, not a slice.

**On top of that scalar the compiler keeps exactly two coordinates, one signal
each.** *Difficulty* is `budgetSlack = policyBudget / D(spec)` — the
`TRAVERSAL_BUDGET_MODEL_V1` regression, frozen at frame 0, choosing the **shape**
of spend (SC-07, SC-10, SC-13, SC-14). *Deadline* is the margin —
`remaining policy budget / estimated remaining work`, recomputed per node in
`optimizer/deadline.ts` (SLK-05), choosing the **pressure** on spend. Its
structural base is the **calibrated estimator's** coefficients, passed
explicitly since `075e774` (2026-08-03): it used to take
`structuralRemainingWork`'s silent `TRAVERSAL_BUDGET_MODEL_V1` default, which
predicts 37% of the artifact's remaining work at a root node and left the live
signal ~1.9× loose, so the ramp barely engaged (§6.4). The anchors did not move
— the corpus asks 1.30 / 1.90 on the corrected shape against the shipped
1.25 / 2.0. Three consumers read the margin and all three read it at the same
two anchors:
`DEADLINE_MARGIN_FULL_PRESSURE = 1.25` (Youden-optimal completion gate, J = 0.815)
and `DEADLINE_MARGIN_NO_PRESSURE = 2.0` (the smallest round margin with a measured
false-positive rate of exactly 0.000) — SC-09's rolled-head ramp, GA-15's
two-level aim throttle, SC-16's dominance filter. The three competitors this
replaced are deleted: `observedTraversalBudgetSlack` (SLK-04) and its two
consumers in `4325370`, `isOnlineTraversalBehindSchedule` in the same commit, and
the rider's own short-lived third anchor `deadlineAtRisk` in `ccfd58d`. The
recorder's `hard_completion_margin` is still contractually observation-only;
policy and recorder share the estimator's pure functions and never share state.
**Since `d84c71c` (2026-08-04) the signal is also visible**: a fifteen-field
block in `CompileStats.deadline` (LC-32), accumulated at the one place the ramp
is read and split at the phase boundary. First standing reading, the N=48 baseline
archive (2,112 compiles): the ramp engages on **22.2%** of pre-completion pool
builds and saturates on **0.40%**. Both anchors were then re-bracketed on the
corrected signal and both survive — six alternative pairs, every one a measured
null, while engagement walked 15.3% → 60.1% across the arms (§6.6).

**The geometry half of the compiler no longer reads the budget at all.** All
eleven budget reads in `arc_placement.ts` were saturating ramps pinned at or below
250k — geometry from a 750k compile was bit-identical to geometry from a 250k
compile and from a 5M one — and `9a3dabd` deleted them with 21 constants,
`compileBudgetPressure`/`compileBudgetFade` and the `currentCompileBudgetFrames`
global; `d7c839f` finished the job with `setCompileBudgetFrames`. Evidence: 40/40
golden track hashes unchanged at 250k **and** 750k while 20/20 moved at 150k (so
the instrument was live), and 1,440 paired sub-250k compiles pooled −0.18,
95% CI [−2.11, +1.72]. GA-06 went with them as a *mechanism*, not just as a ramp.
`arc_placement.ts` is now budget-blind, and the file header says so.

**The fake-budget-aware class is empty, and half of it emptied by being
measured rather than deleted.** Deleted: the four benchmark-case-named
quality-breadth rules (`f7d054f`), SC-18's future-preview pressure and its whole
plumbing (`d7c839f`), OB-04 and OB-05, LC-11's `feasMargin` ramp and the four
helpers around it. Kept **with the measurement that says why**: LC-05's start
pressure and OB-03's objective-exponent ramps are byte-identical at every promoted
budget but shipping their mature branches unconditionally costs −13.0 / −7.6 / −2.2
mean score per run at 75k / 150k / 225k and turns 0 missing contacts into 236 —
scarce-budget *completion* behaviour, documented as pinned sub-250k insurance; and
SC-02's two remaining rules are not per-case relief at all but the breadth law's
scarce-budget floor below B = 291,667 (deleting the table is −7.70 at 75k). The
`maturityPressure` family (SC-17) was **misclassified by this map** and is not
saturated: see §7 Cluster C.

**Two mechanisms are genuine scale-free laws, and they are matched to each other
by construction.** `budgetAwareQualitySampleCount = round(27·B/250k)`, floor 8, no
ceiling; and `aimTopKBasesEffective`'s high-budget arm `round(6·B/250k)`. They
share the 250,000-frame anchor deliberately, so `K/nCand = 6/27 = 0.2222` exactly
at every budget. These two are still the only mechanisms in the compiler whose
output keeps changing as the budget grows past 750k.

**Live adaptation is one signal in the search and fourteen counters in repair,
and they still do not talk to each other.** The margin runs the whole compile, but
its two pool-affecting consumers are gated to the pre-completion phase (Phase 1a's
boundary, drawn from measurement: the post-completion arm read ≈ −0.5 per cell over
225 of its 245 changed tracks, and carried a new cross-state pool-cache exposure of
764 + 540 reads that 1a cut to 3 + 2). After first completion the only live signals
are the repair phase's — fourteen of the seventeen live-adaptive entries are repair
or stopping decisions, and the repair-ROI study has priced the sizing axis closed.
So **46.3% of a 750k budget is still charged after the handoff to repair** (45.3%
repair, 1.0% resumed; 53.0% at 1.5M, 54.6% at 2.25M —
`docs/repair-roi-study.md` §Phase allocation) with nothing pacing it but repair's
own affordability arithmetic — which is now the estimator's fitted upper interval
rather than a hand-swept multiplier (LC-19). Two attempts to close that gap have
been made and both are closed: uniform post-completion pressure (above) and
post-completion rollout-depth pressure (−0.018 over 194 changed tracks — repair
reinvests the freed frames at unchanged yield). See §6.
**The third attempt closed the vein itself, 2026-08-04** (§6.6): the Phase-1a
boundary was re-measured on the corrected margin at the historical grain (44
sources × 8 seeds × 750k, 352 paired cells per arm) and reproduced — ungating the
head ramp reads **−0.529 ± 0.188 (t = −2.82)** against the −0.51 the boundary was
drawn on, monotone in the dose with no positive anywhere on the curve. The
mechanism is now measured rather than diagnosed: **93.6% of post-completion pool
builds happen inside a repair restart, and 95.8% of post-completion full-pressure
builds sit in the last spend decile** — post-completion "pressure" is the compile
running OUT of budget, not running BEHIND, so acting on it narrows the rolled head
exactly where repair's ROI wants width. The `nonrepair` remainder is genuinely
positive (+0.048 ± 0.020, t = 2.37) on 25 of 352 cells, ~+0.05 headline, and would
ship as a lane mode: filed, not shipped, and the knob that measures it stays
default-off (SC-26). The unpaced share is therefore no longer an open lane; it is
a priced one.

**One of the two live pool-affecting consumers now reads a corrected bit.**
SC-16's dominance filter prunes the frontier on `forwardContinuation === false`
— a charged rollout's proof that a candidate cannot place its next contact — and
2026-08-03 measured that proof **53.3% wrong** on 31,494 audited verdicts, split
by terrain (58.9% hold on the capability frontier, 30.3% on representative
sources, 5.3% on `high_air_drive`). The cause is breadth, not disagreement about
viability: the rollout's hop-1 expansion draws **one** sample where the search
draws 23.5 / 30.3 / 80.9 at 150k / 250k / 750k through the same gates. `bb45125`
re-draws once on empty (SC-24) and leaves the corrected pool in the node's memo,
so the filter consumes the correction at its source. §6.5.
**And 2026-08-04 established that the correction is not where the value is**:
three independent arms — blanket rollout width, a dose-6 re-draw, and the impact
arm's ask re-gate — each drove the measured refutation rate up and the score
down, so correcting false hop-1 verdicts is real, cheap to measure and **does not
pay** at the promoting budget (§6.6). The filter itself was never this lane's
problem: its firing rate is ≈ 0 at 750k and 17.2% on capability@250k, where
37.8% of the verdicts it acts on are false (SC-16).

**Most of what remains still cannot bind.** Of **68** budget-touching mechanisms,
**14** cannot change behaviour at any budget the system runs: `SC-03` breadth floor
· `SC-07` low-slack branch limit · `SC-08` the 75k forward-eval gate · `SC-10`
pre-completion rollout shallowing · `SC-12` mature-avg budget term · `SC-23`
capacity-probe literal · `LC-02` policyBudget split · `LC-05` start pressure ·
`LC-12` the 100k repair gate · `LC-31` dead ceiling hooks · `GA-11` the 100k aim-K
maturity gate · `OB-15` the frame limit · `PLB-02` `MAX_NODES_FLOOR` · `PLB-07` the
worker-timeout ramp. That is down from 29, and eleven of the fifteen retired were
the geometry ramps.

**The instrument still cannot see most of this — but it is no longer blind at
either end.** The promotion gate is still a single budget (750k, N=48, 44 cases)
and `analyze_campaign_baseline.ts` still refuses any archive whose budgets are not
exactly `[750000]`, while the campaign's own scale contract requires mechanisms to
"remain continuous and meaningful beyond the measured budget, including 150k and
1M-3M". Production still runs at 1,000,000, sampling 108 candidates per gap on the
strength of an extrapolated law — but that operating point now has evidence:
2026-08-03's 1M validation panel (176 trace compiles plus a same-head 750k
companion, `docs/budget-law-study.md`) found zero accounting violations, the
estimator healthy from the interior (99.5% calibrated, 3.0% combined APE, coverage
94.6% against the artifact's held-out 94.2% at 1.5M) and the laws holding at a
budget they never saw — paired first-completion ratio 1.2549 against a predicted
1.2657, phase shares on the 750k/1.5M log interpolation to 0.1pp. Below the gate,
the golden v1 grid (75k/150k/225k, 1,440 paired compiles) remains the standing
evidence surface for everything the unification program deleted, and the dividends
campaign added a second: `npm run benchmark:v2:low-budget-reading`, a tracked
**non-promoting** paired reading at 250k on the promotion ladder's own seeds
(Phase 0b). Neither has promotion authority and that was a deliberate decision,
not an omission — §5.

---

## 2. Verification record

Ten claims were nominated as load-bearing before the merge. Each was re-checked
against source or archives.

| # | claim | outcome |
|---|---|---|
| a | the two counters; `bestCompleteNode` adopted without a contract check | **CONFIRMED + extended + prevalence measured**; **the divergence is FALSIFIED with a mechanism 2026-08-04** — 4,406/4,406 compiles, see §2a |
| b | geometry saturated ≤ 200k | **CORRECTED → ≤ 250k** (empirically ≤ 200k on one prefix) |
| c | `QUALITY_BREADTH_RULES` dead at B ≥ 291,667 | **CONFIRMED**; two of A1's neighbouring thresholds corrected |
| d | `OPENING_BEST_FWD_SLACK_BRANCH3_START = 10` unreachable | **CONFIRMED by measurement** (max slack 6.748 at 750k) |
| e | `setSimFrameLimit` / `setPhysicsFrameLimit` zero callers | **CONFIRMED** |
| f | dormant `policyBudget != budget` hook, no live caller | **CONFIRMED**; one attributed caller was wrong |
| g | `pacedSlack → Infinity` at first completion | **RETIRED** (`4325370`) — the mechanism and all five identifiers are deleted; the finding survives as history |
| h | July audit verdicts measured under a replaced ruler; pool=7 re-test | **CONFIRMED**; one identification left open |
| i | `IMPACT_BEST_FWD_START_FRAMES = 300_000`, byte-identical-at-250k by design | **RETIRED 2026-08-04** — the raw-budget factor (offender d3) and the double-counted budget coordinate (c1) are deleted; the gate is `askPressure × slackPressure` only. Byte-identical at 750k/500k/250k; standing 250k reading PARITY 0/528; the (300k,500k) sliver was the only binding region. |
| j | aim doc/code disagreement since `d5731e5` | **CONFIRMED** |

### (a) `firstTerminalFrame` vs `firstCompletionFrame` — CONFIRMED, and the divergence is not observed (and, since 2026-08-04, cannot be: falsified with its mechanism 4,406/4,406)

Set conditions (`handoff.ts:1573-1585`):

```
if (terminal)             { if (firstTerminalFrame   < 0) firstTerminalFrame   = getSimFrames(); … }
if (improved && terminal) { bestCompleteNode = node;
                            if (firstCompletionFrame < 0) firstCompletionFrame = getSimFrames();
                            telemetry.hasCompletion = true; }
```

`improved` is the return of `register.consider(...)` (`register.ts:100-108`): true
iff the leaf became the new best, which includes the case `bestKey === null`.
`isStrictlyBetter` (`register.ts:74-87`) puts `contract_passed` first, then
`axis_quality`, then `drift_quality`; **among two failing leaves it ranks by
`full_score`**. There is no contract requirement anywhere on this path.

Complete consumer sets, verified by grep:

- `firstTerminalFrame` → `:1626` (the recorder snapshot's
  `first_terminal_total_spent_frames`), `:1642` (**`stats.first_completion_frame`**),
  `:2318` (final snapshot).
- `firstCompletionFrame` → `:1727` (**`stats.repair.first_completion_frame`**),
  `:1780` (`pacedSlack = Infinity`), `:1787` (`hasCompletion`), `:1983-1984`
  (`perGap`), `:2007` (`costToEnd` anchor), `:2240-2241` (**the repair handoff
  trigger**).

So two archive fields named `first_completion_frame` hold two different
quantities, and the repair split is governed by one while the top-level stat
reports the other.

**The failing-incumbent path is reachable by construction.** If no passing leaf
has been registered yet — which is the normal state, because the register is fed
partial (non-terminal) leaves throughout the search — a failing terminal that
beats the failing incumbent sets `bestCompleteNode`, latches
`firstCompletionFrame`, and hands the rest of the budget to repair, which then
rebuilds suffixes of an invalid incumbent. "Repair ran" is not evidence that a
valid track exists. A second, undocumented write of `bestCompleteNode` exists at
`:1879` on the polish path, also with no contract check.

**Prevalence, measured (zero compiles).** Over the current 750k N=48 baseline
archive (`generated/benchmark-v2/eval/cached-N48-2026-08-01T11-14-33Z.N48.json`,
2,112 rows, 44 sources) and two three-budget probe archives
(`generated/benchmark-v2/runs/ballistic-readiness-contract{,-fixed}-n2.json`,
250k/500k/750k), **2,414 rows carry both counters and 0 diverge.** Every 750k
baseline compile is valid (2112/2112). 129 of 2,112 baseline rows carry no
`stats.repair` block at all despite having a terminal — either a zero-restart
repair phase or the known undercount (LC-28) — and cannot be compared. Conclusion:
the two counters are semantically distinct and structurally divergable, and at
every budget measured they are equal. The consequence for the discrepancy ledger
is in §8.

**UPGRADED 2026-08-04 from "not observed" to "falsified, with the mechanism"
(forward-eval campaign, mandate iterations 1–2).** The Phase-1 counters
(`deadline_first_terminal_frame`, `deadline_first_improving_terminal_frame`,
LC-32) were added precisely to size this window, and over **4,406 compiles** —
both N=48 archives plus every probe grid — the two frames are equal in 4,406,
and equal to `first_completion_frame`. The reason is the comparator:
`isStrictlyBetter` (`register.ts:74-87`) puts `contract_passed` first, and a
structural terminal passes the contract by construction (`score.ts:301-306`:
no drift, no missing, no off-beat, reached end of spec — the candidate gates
enforce the first three and a terminal reaches the last), while the incumbent at
that instant is a failing partial. So the FIRST terminal always improves, and the
estimator's fit target and the controller's phase flip are already the same event
— there is nothing to align, and the "align the phase flip" lever is dead. What
survives from the analysis above is narrower and still true: the *code path*
carries no contract test on `bestCompleteNode` (two write sites, neither
checking), so the property is a fact about the comparator and the gates, not an
enforced invariant. And the counter that was built for this keeps shipping with a
different meaning — `deadline_terminal_without_improvement` is **subsequent**-
terminal churn (95.6% of terminal considers at N=48 scale), i.e. a repair-ROI
number about how much post-completion budget re-derives a non-improvement.

### (b) Geometry saturation — CORRECTED from ≤ 200k to ≤ 250k

Complete inventory of the eleven budget reads in `arc_placement.ts`, read from
source. `compileBudgetPressure(start, span) = smoothstep((B − start)/span)` and
`smoothstep` clamps to [0,1] (`arc_placement.ts:2838`).

| site | start / span | pinned at |
|---|---|---|
| `:1556` arc-length room smoothing | 50k / 50k | 100k |
| `:1854` post-contact curve-bias fade | 50k / 50k | 100k |
| `:2033` impact-template lane rate | 50k / 50k | 100k |
| `:2046` template scoop 6f→5f | 100k / 100k | 200k |
| `:2072` template hold pressure | 125k / 125k | **250k** |
| `:2140` impact-arrival pop fade | 50k / 50k | 100k |
| `:2192` steep-arrival zero band | hard `< 200_000` | 200k (step) |
| `:2342` redir CONTACT shift | 125k / 75k | 200k |
| `:2342` redir ENTRY shift | 125k / 50k | 175k |
| `:2415` impact-curve elevation-room onset | 125k / 125k | **250k** |
| `:2493` impact post-turn extra | 100k / 100k | 200k |

Spot-checks: `compileBudgetPressure(125_000, 125_000)` at B = 250,000 is
`smoothstep(1.0) = 1` exactly, and 0.65 at 200,000;
`compileBudgetPressure(100_000, 100_000)` at B = 200,000 is `smoothstep(1.0) = 1`
exactly. So two of the eleven are still moving between 200k and 250k. The correct
statement is **budget-invariant at B ≥ 250,000**, i.e. from the suite's lowest
tier upward — not from 200k as the survey's headline said (the survey's own
per-entry text for those two ramps already said 250k).

Empirically, re-running the hash comparison on the frozen-prefix artifacts from
`scripts/v0/study_budget_geometry_basis.ts` (32 production candidates,
`frontier_dense_recovery`, seed 24, gap 18): **0 of 32 candidate geometry hashes
differ at 200k, 240k, 250,001 and 5,000,000**; 25 of 32 differ at 50k and 24 of 32
at 150k. On that prefix the two 125k/125k ramps' 0.65 → 1.0 travel changes nothing,
because their spec-profile co-factors are zero there. One prefix is not a proof for
all specs; the analytic bound (250k) is.

### (c) `QUALITY_BREADTH_RULES` dead at B ≥ 291,667 — CONFIRMED

`qualityBreadth` (`handoff.ts:4900-4928`) returns `base` unchanged at `:4912` when
`base >= HANDOFF_QUALITY_N_CAND` (`= 32`, `:932`). With the linear law
(`:4960-4967`, `AT_REF = 27`, `REF_FRAMES = 250_000`),
`round(27·B/250000) ≥ 32 ⟺ B ≥ 291,666.67`. The six-rule table and its four
benchmark-case-named min-budget gates (`M132/M144/M165 = 200_000`,
`M152_CANYON = 250_000`, verified at `:894-897`) are therefore unreachable at
500k, 750k, 1M and 3M, and live only at 150k and the deferred 250k.

Two corrections to the survey's neighbouring arithmetic:

- the floor of 8 binds below **B = 69,444** (`round(27B/250k) < 8 ⟺ B < 7.5·250k/27`),
  not 74,074;
- rule 0 (`sparse-amp Q48`, `:4906-4911`) runs *before* the early return and does
  `Math.max(base, 48)`, so it is inert at **B ≥ 439,815**, not 435,185.

### (d) `OPENING_BEST_FWD_SLACK_BRANCH3_START = 10` unreachable — CONFIRMED by measurement

Constant at `:1086`. Measured `stats.budget_slack` (which is exactly
`policyBudget / predictFirstCompletionFrames(spec)`, `:1348`, `:1639`):

| budget | n | min | median | max | < 1.5 | ≥ 2.5 | ≥ 2.75 | ≥ 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 250k | 88 | 1.405 | 1.674 | 2.249 | 9.1% | 0% | 0% | 0% |
| 500k | 88 | 2.809 | 3.349 | 4.499 | 0% | 100% | 100% | 0% |
| 750k | 2,112 | 4.214 | 5.023 | **6.748** | 0% | 100% | 100% | **0%** |

`budgetSlack` is exactly linear in B (`predictFirstCompletionFrames` has no budget
term), so the largest-slack development case first reaches slack 10 at
B ≈ 1,111,000 and the branch-3 ramp is full (slack 18) only above ≈ 2.0M. The
branch-3 pressure function, its two constants and the `branch = 3` arm of
`openingBestForwardEvalConfig` have never executed on a benchmark compile. The
branch-2 arm (2.75) fires on 100% of rows at 500k and 750k and 0% at 250k;
`HANDOFF_LOW_SLACK_BRANCH_THRESHOLD = 1.5` is crossed by 9.1% of 250k rows and by
nothing at 500k or 750k. These measurements reproduce the survey's independently
computed table to three decimals.

### (e) `setSimFrameLimit` — CONFIRMED zero callers

Defined once (`scripts/lib/detector.ts:530`), re-exported once
(`scripts/v0/optimizer/sim_frames.ts:45`). Full-tree grep over `scripts/` and
`tests/` returns no call site; the only other files containing the name are two
detached `.claude/worktrees/` checkouts. `_physicsFrameLimit` is therefore
permanently `null`, `PhysicsFrameLimitExceeded` is unreachable, the per-frame
incremental charging branch is dead, and **the compile budget is enforced entirely
by cooperative polling at node boundaries**. The budget is a checkpoint, not a cap.
Measured directly over the 750k N=48 baseline archive (2,112 rows):
**100% of compiles overrun**, median `sim_frames` 766,864 (+2.25%), p90 +5.22%,
max 872,254 (+16.3%).

### (f) The dormant `policyBudget` hook — CONFIRMED

`b549ddb "Add policy budget study hook"`, 2026-07-10, empty commit body, three
files (`handoff.ts` +57, `study_compile_panel.ts` +11, `tests/optimizer_handoff.test.ts`
+20). The only flag is `study_compile_panel.ts:22 --policy-budget`; the only other
assignments of `policyBudget:` in the tree are two unit tests
(`tests/optimizer_handoff.test.ts:361,369`, `tests/budget_telemetry.test.ts:694`).
**CORRECTION**: one survey attributed a second study caller
(`study_coupled_future_support.ts`); that file contains zero occurrences of
`policyBudget`.

### (g) `pacedSlack → Infinity` at first completion — **RETIRED `4325370`**

**The mechanism is gone.** `pacedSlack`, `observedTraversalBudgetSlack`,
`pacePressure`, `aimLanePaceSuppressed` and `isOnlineTraversalBehindSchedule`
have **zero code occurrences** repo-wide (verified 2026-08-03); the line anchors
below point at unrelated code. The one live deadline signal is the margin
(`optimizer/deadline.ts`, SLK-05), and it does **not** go to `Infinity` at first
completion — it keeps its definition, with the incumbent's measured cost-to-end
replacing the structural suffix. Which consumers act on it after first
completion is the Phase-1a boundary, a policy choice in `rankedOptions`, not a
property of the signal.

What the finding was, kept because it is the reason the replacement is shaped as
it is — `handoff.ts:1780-1786` at the time:
`pacedSlack: firstCompletionFrame >= 0 ? Infinity : observedTraversalBudgetSlack({…})`.
Complete consumer set: `:3828` (`aimLanePaceSuppressed`, `pacedSlack < 1.0`),
`:3863-3864` (`pacePressure` → `forwardEvalTop`), plus three pass-throughs that only
carry it (`:3306` `expandNode`, `:3423` `rescueOptions`, `:4696`
`completeNearTailSuffix`). `Infinity` gave `pacePressure = 0` (full-width head) and
failed the `< 1.0` test (aim lane on). **All pace adaptation in that compiler was
strictly pre-first-completion** — the gap the dividends campaign then named as
the post-completion unpaced share.

### (h) The July audit's staleness, and the pool=7 datum — CONFIRMED

Commit dates verified: `c7f1518` 2026-07-28 (law shipped at sqrt/24), `97ad150`
2026-07-29 ("Fit the two constants that were chosen rather than measured" —
linear/27), `48dbda1` + `c119497` 2026-07-31 (impact ruler promoted),
`03b0555` + `d4715fa` 2026-07-31 (readiness retrained and promoted), `5db6c79`
2026-07-31 ("admit seven ranked candidates") and `e5789ad` 2026-07-31 ("retire
seven-candidate pool").

The audit table is `docs/compiler-improvement-campaign.md:1152-1164` and its own
header states the arms were run **"N=8 against `breadth-law`"** — i.e. under
sqrt/24 breadth, one day before the linear refit, three days before the ruler
change, three days before the readiness promotion. The four verdicts (admitted
pool −1.75, tree width −1.73, tail-completion window −0.86, mature reuse −0.32)
are all from that table.

The pool=7 re-test record was found and read
(`generated/benchmark-v2/eval/handoff-pool-seven-750k.look-48.json`, written
2026-07-31 21:19):

```
estimate 0.4834   standardError 0.4142   df 47   t 1.16706905
directionalProbability 0.87546515   required 0.97226547   action "inconclusive"
base 595.8997 -> candidate 596.3831   validity 2112/2112 (gained 0, lost 0)
95% CI [-0.6286, +1.5954];  catalog-sensitivity bootstrap CI [+0.0461, +0.9132]
```

So the datum is exactly as claimed, and the catalog-sensitivity interval excludes
zero while the seed-block interval does not.

**Resolved (2026-08-01, Track R prep).** `docs/compiler-improvement-campaign.md`
reports **−1.73** twice for `HANDOFF_BRANCHING`, and they are two DIFFERENT arms
that coincidentally share a value: `:1161` is the *budget-law* arm from the July
audit (sqrt-era ruler — stale, and the law shape is refuted for tree width);
`:976` is the *flat 4* arm's "then" value under `span-handover`, whose "now"
re-measurement under the current ruler reads **+0.74, SE 1.81** (peak at 4; 5 is
−2.88), anti-composing with the arc-command efficiency law at −1.76 together —
and per `:984` *neither was promoted*, so no anti-composition partner sits in
the baseline. SC-06's live Track-R question is flat-4 alone, freshest datum
inconclusive-positive.

### (i) `IMPACT_BEST_FWD_START_FRAMES = 300_000` — CONFIRMED verbatim, then RETIRED 2026-08-04 (d3/c1 removal; gate is now `askPressure × slackPressure` — the section below is the historical record)

`handoff.ts:1075-1079`:

```
// budget ramp deliberately starts ABOVE 250k so the charge-bounded completion
// knee never pays the extra k+1 admissions (byte-identical there).
const IMPACT_BEST_FWD_START_FRAMES = 300_000;
const IMPACT_BEST_FWD_SPAN_FRAMES  = 200_000;
```

Restated in the function's own rationale at `:6432`: "the budget ramp is zero at
250k (the charge-bounded completion knee stays byte-identical by construction)".
This is a threshold positioned to preserve a benchmark operating point, documented
as such in the source. At 750k the term is `smoothstep(2.25) = 1`.

### (j) The aim doc/code disagreement — CONFIRMED

`aim.ts:742-745` documents the `airKnobBase` parameter as: "The caller enables it
on the FIRST (quality-best) refined base only — the variant is per-pool generation
insurance, and one per pool is enough (per-base emission at K=4–6 priced out mature
budgets in probe cycle 1)." `node.ts:272` passes the literal `true`, inside
`for (let b = 0; b < kEff; b++)`. `git show d5731e5` (2026-07-29, "Scale air-aware
aim refinement with budget") is the one-line change
`b === 0, // air-matched variant: first (quality-best) base only` → `true,`, in the
same commit that introduced the K law. The recorded measurement in the surviving
docstring now describes the opposite of the shipped behaviour at every benchmark
budget.

### Additional checks performed

Not on the mandatory list, but load-bearing in the merged map and therefore
verified:

- **The forward-eval early return.** `scoreCandidateForHandoff:5455` returns inside
  `if (fwdCfg !== null && usesForwardEvalAtBudget(targetBudget))`, before
  `previewNextContact`, `DEAD_END_PENALTY`, `SURVIVOR_SCARCITY_PENALTY`,
  `PREVIEW_COST_WEIGHT`, `handoffStatePenalty`, `candidateOvershootPenalty`,
  `candidateReleaseSetupPenalty` and `previewScorePressure` are read. CONFIRMED
  dead at every budget ≥ 75k unless `LR_FWD_EVAL=off`. `policy.preview` is
  hard-`false` at `:4774`.
- **CORRECTION to the pace prune's depth claim.** `:5464-5466` reads
  `const effective = allowForwardEval || resolved.variant !== "greedy" ? resolved : {…resolved, depth: 1}`.
  The shallowing applies **only to greedy rollouts**. A candidate whose config was
  upgraded to `avg` (SC-12) or `best` (SC-13/SC-14) keeps its full depth even in
  the pruned tail and even in the pre-completion low-slack phase. Two surveys
  stated the shallowing unconditionally.
- `maturityPressure`'s consumers — **CORRECTED at HEAD: THREE, not four.** The
  mature reuse extra, the shallow-tail throttle and the tail-completion window;
  the quality-breadth lean and the future-preview pressure are deleted (the
  constant's own docstring says so). `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES = 150_000`.
- `repairConfig(targetBudget, profile)` — `profile` is never referenced in the
  body. **CORRECTED at HEAD: `repairConfig()` takes NO arguments** (`d7c839f`);
  `targetBudget` went with `feasMargin` and `profile` with the main-margin
  carve-outs. See LC-11.
- `defaultRepairMainMargin()` / `defaultRepairFeasMargin` / `REPAIR_MAIN_MARGIN_MATURE`
  / `repairRampMargin` — **CORRECTED at HEAD: all four identifiers are DELETED.**
  The main margin is a flat 1.0 inside `repairConfig()` and the feasibility
  margin is gone entirely, replaced by the estimator's fitted `start`/`withPath`
  band (LC-19). The only surviving occurrence in the repo is
  `study_repair_selection.ts`, which reproduces the deleted function to re-derive
  historical numbers.
- `completeNearTailSuffix(…, maxNodes = Infinity, frameCeiling = Infinity, …)`:
  the sole caller (`:4612-4624`) passes `Infinity, Infinity`. CONFIRMED dead
  live-budget hooks.
- `objectiveElevationReadinessForSpec` (`:2781`) — repo-wide grep finds the
  definition and nothing else. `objectiveBlendReadinessPowerForSpec` (`:2716`) — one
  caller, the diagnostic `resolveProposalUtilityPowersForSpec` (`:2774`); three
  stale prose references at `objective.ts:76`, `objective.ts:617`,
  `objective_control.ts:19`. **CORRECTED at HEAD: both functions are DELETED
  (`d7c839f`)**, along with the stale prose; what remains is one tombstone
  comment in `handoff.ts` and one in `study_objective_powers.ts`.
- `repairEnabled = policyBudget >= repair.minBudget && startOptions.length > 0`
  (`:1476`) with `allStartOptions = initialSnapshot === null ? buildStartOptions(…) : []`
  (`:1352-1354`). CONFIRMED: a snapshot-resumed compile has no repair phase at any
  budget.
- Production budgets: all three live `productions/*/select.json` carry
  `budget: 1000000`. Worker timeout `clamp(round(B·0.35·3), 120s, 600s)`
  (`golden_suite.ts:213-231`); the 600 s cap binds above 571,429 frames.
- Campaign scope (`benchmark/v2/campaign-baseline.json`): budgets `[750000]`,
  48 seeds, deferred `[250000, 500000]`, and the scale contract verbatim.

---

## 3. Classification rollup

The census below is the **survey census at `c9058fa`** and is kept as the
historical baseline; the program's delta follows it, because a re-derived census
would hide what moved.

**117 entries** after dedupe (142 raw across five surveys; 25 cross-territory
duplicates merged). Of these:

- **82** budget-touching compiler mechanisms
- **16** verified-clean attestations (files or functions proven to have no budget
  dependence, by import graph plus grep plus read)
- **14** entry points and harnesses (how budgets are chosen outside the compiler)
- **5** observation-only (records budget facts, never read by any decision)

### By class

| class | n | meaning |
|---|---:|---|
| contract / plumbing | 31 | validation, propagation, drivers, determinism substrate, type contracts |
| **saturated** | **21** | a budget ramp pinned across the whole live range |
| **live-adaptive** | **17** | reads live spend and throttles a magnitude |
| budget-blind (attested) | 16 | verified to read no budget |
| study-hook | 8 | exists for studies; inert in production |
| **threshold / mode trigger** | **8** | a discontinuous budget or slack comparison |
| **dead** | **6** | unreachable branch or zero call sites |
| observation | 5 | recorded, never read |
| **flat-by-verdict** | **3** | budget-independent because a budget-law arm measured negative |
| **law** | **2** | scale-free `ref·(B/refB)^α`, no ceiling |

### Never-binding in the live operating range

**As surveyed, 29 entries could not change behaviour at any budget the system
runs** (plus 2 that bind only partially). The list was the map's most important
single statistic and it is why the program existed:

`SC-02` breadth-rule table · `SC-03` breadth floor · `SC-07` low-slack branch
limit · `SC-08` the 75k forward-eval gate (always true, so it never gates —
it only kills the local ranker) · `SC-10` pre-completion rollout shallowing ·
`SC-12` mature-avg budget term · `SC-18` future-preview pressure · `SC-23`
capacity-probe budget literal · `LC-02` policyBudget split · `LC-05`
start-budget pressure · `LC-12` the 100k repair gate · `LC-31` dead ceiling
hooks · **all eleven `arc_placement` geometry reads** (`GA-01`…`GA-10`, `GA-07`
included) · `GA-11` the 100k aim-K maturity gate · `OB-04`/`OB-05` the two dead
objective gates · `OB-15` the frame limit · `PLB-02` `MAX_NODES_FLOOR` ·
`PLB-07` the worker-timeout ramp. Partial: `SC-14` (branch-2 always fires,
branch-3 never) and `LC-11` (`repairConfig`: `maxAttempts` never reached,
`minBudget` never blocks; its `feasMargin` is gone — see LC-19).

**After the program, 14 remain**, listed in §1. Fifteen of the twenty-nine were
resolved: eleven geometry reads (ten entries), `SC-18`, `OB-04`, `OB-05` deleted,
and `SC-02` left the class in the other direction — its two surviving rules are
live below B = 291,667 and were shown to be load-bearing there.

### What the program changed (2026-08-02)

| | entries | which |
|---|---:|---|
| retired (deleted from the compiler) | **15** | `GA-01`…`GA-10` (ten entries, eleven reads, `9a3dabd`) · `PLB-19` `setCompileBudgetFrames` (`d7c839f`) · `SC-18` (`d7c839f`) · `OB-04`, `OB-05` (`d7c839f`) · `SLK-04` (`4325370`) |
| added | **1** | `SLK-05` `CompileDeadline` — the live deadline margin (`4325370`) |
| same mechanism, new meaning | **6** | `SC-09`, `GA-15`, `SC-16` (all three now read the margin at two shared anchors) · `SC-02` (four of six rules deleted, the other two re-read as the law's scarce floor) · `LC-11`/`LC-19` (hand-swept `feasMargin` → the estimator's fitted upper interval) · `SC-17` (reclassified: asymptotic, not saturated) |

Net: **103 entries, 68 of them budget-touching.** The class deltas that matter:
nine saturated ramps deleted with the geometry group and `SC-17` reclassified out
of that class; `SC-16` moved from **threshold** to **live-adaptive** consumer of a
shared signal; `SLK-04` out of **live-adaptive** and `SLK-05` in, so that count is
unchanged at 17; **dead** drops from 6 to 3 (`OB-04`, `OB-05`, `SC-18` deleted;
`LC-31`, `OB-15` and the vestigial repair predicates remain, each for a stated
reason). **law** stays at 2 — the program wrote no new law, it deleted the ramps
that were pretending to be ones.

### What the dividends campaign changed (2026-08-03)

| | entries | which |
|---|---:|---|
| added | **1** | `SC-24` `HANDOFF_ROLLOUT_REDRAW_ON_EMPTY` (`bb45125`) — **budget-blind**, and listed anyway because it changes the bit SC-16 prunes on. Its price is inverse to budget (0.45–0.75% of frames at 750k, 1.71% at 250k), which is a scaling fact about a constant, not a budget read. |
| retired | **0** | — |
| same mechanism, new evidence | **4** | `SLK-05` (structural base swapped to the artifact's coefficients, `075e774`) · `SC-16` (its dominance premise measured false 53.3% of the time; unchanged, and now fed a corrected bit) · `SC-13` (priced: 62.8% of rollout frames at 750k, +4.59 ± 2.20 per cell) · `SC-12` (priced cheap: 4.9%, 22 f/call) |

Net: **104 entries, 68 of them budget-touching, and the classes are unchanged.**
The campaign wrote no new budget dependence and deleted none: two of its three
promotions were a correction and an exact-parity review fix, and the third is a
constant with no budget term. What moved is *evidence* — which is what a dividends
campaign is supposed to move.

### What the forward-eval value campaign changed (2026-08-04)

| | entries | which |
|---|---:|---|
| added | **3** | `SC-25` the production base shape `DEFAULT_FWD_EVAL_BASE` and its composable override (`9f58697`, `916d5db`) — **budget-blind**, listed on SC-24's precedent because it changes what every budget-conditioned rollout consumer is priced against · `SC-26` the study-gate surface: twelve default-off knobs with their verdicts (`916d5db`, `bce18e9`, `468f54f`, `7d90184`, `fd734a5`) · `LC-32` the deadline telemetry block (`d84c71c`, post counters `bce18e9`) — observation |
| retired | **0**, but one budget READ is gone | `SC-13`'s raw-budget factor and the double-counted budget coordinate (`7d7348b`, offenders d3 + c1). The entry stays: the arm is live, on `budgetSlack` alone. |
| same mechanism, new evidence | **8** | `SC-01` breadth law re-confirmed at the promoting budget post-promotion · `SC-03` floor pinned as untestable above 69k · `SC-05` the pool-cliff probe · `SC-09` anchors re-bracketed and the post-completion phase weight measured · `SC-12` crowding measured · `SC-13` re-priced on the promoted tree (depth and width both closed) · `SC-16` firing rate and acted-on verdict truth · `SC-24` dose re-measured on the promoted tree · `SLK-05` the post-completion base is established at first adopted completion (`d84c71c`) |

Net: **107 entries, 68 of them budget-touching.** The three additions are one
budget-blind shape, one study-hook surface and one observation block, so the
budget-touching census does not move; what moves is that a campaign for the first
time re-priced the *rollout* layer with the adaptive arms live, and eight
verdicts changed underneath entries that were not themselves edited.

### By role

| role | n |
|---|---:|
| allocation | 15 |
| lookahead-spend | 14 |
| entry point | 14 |
| plumbing | 13 |
| generation | 12 |
| observation | 9 |
| objective-shape | 8 |
| stopping | 7 |
| geometry-shape | 7 |
| selection | 6 |
| deadline-pressure | 4 |
| readiness feature | 4 |
| feasibility | 3 |
| shared shape | 1 |

### By adaptivity

| adaptivity | n |
|---|---:|
| static snapshot (read once at compile entry) | 78 |
| live (re-read per node / per repair round) | 16 |
| partially live (static budget × a live progress counter) | 9 |
| n/a (entry points, observation) | 14 |

### What the numbers say

Three quarters of the compiler's budget dependence is a constant read once at
frame 0, and a quarter of *that* is pinned at a value the live range never leaves.
Only two mechanisms scale without a ceiling, and they were both written in the same
two-day window in July 2026 against the same anchor.

The seventeen live-adaptive entries split cleanly: **fourteen are repair-phase or
stopping decisions** — they read `getSimFrames()` against a ceiling and decide
whether one more restart is affordable — and **three were the pre-completion pace
family** (`SC-09` head width, `GA-15` aim-lane suppression, `SLK-04` the producer
they share), joined by `SC-16`, a fourth, independent pace estimator. *Post-program
that second group is `SC-09`, `GA-15` and `SC-16` reading one producer, `SLK-05`;
the count is unchanged and the number of definitions of "behind" went from four to
one.* There is still no live adaptation anywhere between "first completion" and
"repair starts", and none inside geometry, objective, readiness or the scorer —
all four of which are budget-blind or budget-frozen by explicit design, and
geometry now provably so.

The role distribution shows where budget is spent versus where it is decided:
`lookahead-spend` (14) and `generation` (12) are where budget buys work;
`selection` (6) is where it deliberately does not — and all three
`flat-by-verdict` entries are selection knobs, which is the campaign's
"generate wider, admit narrower" boundary showing up as a statistic.

---

## 4. Interaction graph

### Signal producers → consumers (edge list)

Line numbers are `handoff.ts` at `884173f`.

```
opts.budget
 └─validateBudget:2584──► targetBudget                          [hard ceiling]
     ├─► maxNodes = max(50_000, targetBudget)          :1291    PLB-02
     ├─► captureReachedBudget: getSimFrames() >= target :1783   LC-07
     ├─► initial attempt telemetry ceiling              :1420   LC-30
     ├─► resumed frontier stop                              …   LC-23
     └─► policyBudget = opts.policyBudget ?? targetBudget :1275 LC-02
          │   (production: always equal; only study_compile_panel differs)
          │   [PLB-19 setCompileBudgetFrames and the eleven geometry reads it fed
          │    were DELETED — arc_placement.ts reads no budget]
          ├─► setAimCompileBudgetFrames                 :1290   PLB-20
          │    └─► aimCompileBudgetFrames ──► aimTopKBasesEffective  GA-11/12/13
          │                                    └─► K ──► aim lane ──► GA-14 (per base)
          ├─► objectiveBlendCurrentPowerForSpec         :1330   OB-03
          │    └─► setProposalUtilityPowers ──► proposalUtility  OB-02
          │         └─► pool sort · aim base choice · fwd-eval objective leaf
          ├─► predictFirstCompletionFrames(spec)        :1359   SLK-02
          │    └─► budgetSlack = policyBudget / D(spec) :1368   SLK-03
          ├─► new CompileDeadline({gaps, duration, …})  :1413   SLK-05
          │    └─► law-scaled structural suffix table ──► marginAt :1827
          ├─► buildStartOptions(…, policyBudget)        :1373   LC-04
          │    └─► startBudgetPressure (50k/50k)                LC-05
          ├─► repairConfig()  — no arguments left       :1505   LC-11
          │    ├─► minBudget 100k ──► repairEnabled     :1506   LC-12
          │    └─► maxAttempts 64 ──► LC-17
          ├─► repairBudget = policyBudget               :2028   LC-13
          └─► resolveHandoffSearchPolicy targetBudget   :1810
               ├─► nCand law (SC-01) ─► qualityBreadth (SC-02, two rules, <292k)
               ├─► reuseLimit / matureReuseExtra (SC-19)
               ├─► tail window (SC-20) · shallow-tail throttle (SC-21)
               └─► adaptiveForwardEvalConfig (SC-12 budget × drama;
                    SC-13 slack-only since 7d7348b; SC-14 slack)
                    [all three gated on adaptiveArmsApply — SC-25]

budgetSlack  (static, frozen)                          DIFFICULTY — spend shape
 ├─► lowSlackTraversalBranchLimit         SC-07   [< 1.5 : 0% of live rows]
 ├─► policy.forwardEval                   SC-10   [< 1.5 : same]
 ├─► openingBest branch2/branch3          SC-14   [2.75: 100% | 10: never]
 ├─► impactBestForwardEvalConfig          SC-13   [2.5/2.0: ~full at 750k —
 │                                                the arm's ONLY budget read
 │                                                since 7d7348b]
 └─► stats.budget_slack                           observation

deadline margin  (live, per node, whole compile)       DEADLINE — spend pressure
 │   remaining policy budget / estimateRemainingBudgetWork(structural|path, pace)
 ├─► deadlinePressure(margin) ──► forwardEvalTop  SC-09   [ramp 2.0 → 1.25]
 ├─► underFullDeadlinePressure ──► aim throttle   GA-15   [K → max(1, 2K/5)]
 ├─► underFullDeadlinePressure ──► continuation   SC-16   [dominance filter]
 ├─► checkpoint telemetry                                 observation
 └─► recordDeadlinePoolBuild ──► stats.deadline   LC-32   observation
     [both phases; the post arm's pressure is a counterfactual re-read of the
      same ramp, because the phase gate zeroes the live one]
     (the two pool-affecting consumers gated pre-completion; the signal is not.
      The post-completion phase weight is a study knob at 0 — SC-26, §6.6)

getSimFrames()  (live)
 ├─► CompileDeadline.marginAt            :1827   SLK-05  ──► the margin
 ├─► captureReachedBudget                :1783   LC-07
 ├─► the entire repair phase       LC-14..LC-21, LC-23, LC-24
 └─► telemetry recorder                          LC-30   observation only

firstTerminalFrame   ──► stats.first_completion_frame · recorder · final snapshot
firstCompletionFrame ──► margin switches to the measured costToEnd profile :1827
                      ├─► deadlineConsumersActive = false (SC-09, GA-15)  :3796
                      ├─► repair handoff trigger              LC-09
                      ├─► costToEnd anchor / perGap           LC-14
                      └─► stats.repair.first_completion_frame

hasCompletion (latch) ──► branchLimit bypass (SC-07) · forwardEval bypass (SC-10)
                       ├─► forwardStageTop (SC-11)
                       └─► setAimBaseFitReuseAllowed (GA-16)

uniqueFullEvaluations (live progress counter)
 └─► maturityPressure × feedback/(feedback+scale) ──► SC-19 (48) · SC-21 (6)
     [the shared `fullFeedbackPressure` helper and SC-18's scale of 12 went
      with SC-18; the two survivors inline the same expression]
```

### The two answers to "am I behind?" — collapsed 2026-08-02 (Phase 1a, `deadline-margin-750k`)

```
                       reads              updated    used by
budgetSlack            B / D(spec)        never      SC-07, SC-10, SC-13, SC-14  (DIFFICULTY: spend shape)
deadline margin        remaining/estimate per node   SC-09 ramp, GA-15 throttle, SC-16 filter — ONE anchor  (DEADLINE: pressure)
```

The margin (`optimizer/deadline.ts`) is a law-scaled structural base with the
compile's own episode pace blended in geometrically by structural progress,
switching to the measured cost-to-end profile after first completion.
`pacedSlack` and the behind-schedule comparator were DELETED in `4325370`; the
rider's third anchor (`deadlineAtRisk`, `margin < 1`) in `ccfd58d`, so the ramp's
saturation point and the boolean verdict are now provably the same number. The
recorder's `hard_completion_margin` remains observation-only (policy reads the
same pure functions, never the recorder). Phase 1a scope: the two pool-affecting
consumers act pre-completion only.

Promotion record, Phase 1a: **−0.2778 at N=48 (SE 0.1098, P(+) 0.74%), negative
boundary crossed, 595.9097 → 595.6319, validity 2112/2112**, promoted deliberately
after the mandated investigation confirmed an inherent two-sided trade (all three
consumers load-bearing +5.3 … +17.5, every constant bracketed on the shipped signal
and none of them beating the shipped value, the two capability groups wanting
opposite pressure); the whole cost is the
capability stratum, **−1.85**, every other stratum exactly 0.00. Rider
(`deadline-two-anchor-750k`, `c26cfca`): **−0.097, P(+) 25.5%, capability +0.08,
validity unchanged**, promoted at parity. Ledger −0.37 against a −3.0 floor at the
unification program's close; **+0.04 at the dividends campaign's close**, after
Phase 3's −0.31 and Phase 4 L1's +0.72 (`docs/budget-dividends-plan.md`). The
capability stratum's own arithmetic across both: **−1.85 + 0.08 + 0.76 + 1.39 =
+0.38**, on point estimates whose intervals all cross zero.

**The base shape was a deviation; it is now a measured decision (Phase 3,
2026-08-03).** `CompileDeadline` used to build its structural suffix table by
calling `structuralRemainingWork(gaps, durationFrames, gap, includeStartup)`
**without a model argument**, so it took that function's default —
`TRAVERSAL_BUDGET_MODEL_V1` (intercept 5,848.25, contact 796.20, duration
29.59) — under `budgetEstimatorStructuralScale`, which *is* the artifact's law
scale `(B/750k)^0.825`. The recorder passes the artifact's own coefficients
(23,860.07 / 3,699.92 / 18.35). The shipped signal was therefore **V1 shape ×
the artifact's law scale** and not the artifact's estimate: V1 predicts 37% of
the artifact's remaining work at a root node, so the margin read ~1.9× loose and
the ramp barely engaged. The accidental reading was that this reconstructed
SLK-04's architecture — a stale structural prior corrected toward measured pace,
which Cluster E1(iii) says the correction needs. **Measured, it does not hold**:
the artifact model is now passed explicitly and the swap is worth +52.89 /
+26.85 on two canonical capability groups with zero completions lost. §6.4
carries the numbers.

### Shared constants and anchors

| value | shared by | relationship |
|---|---|---|
| **250,000** | `HANDOFF_QUALITY_N_CAND_REF_FRAMES` (SC-01) and `AIM_TOPK_BASES_REF_FRAMES` (GA-12) | **deliberate**: same anchor, same exponent 1, so `K/nCand = 6/27 = 0.2222` exactly at every budget. Documented in `aim.ts:290-294`. |
| **150,000** | `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES` (SC-17, four consumers) and `OBJECTIVE_CURRENT_MATURE_START_FRAMES` / `..._SCARCE_END_FRAMES` (OB-03) | **accidental duplication**: the shared constant exists precisely because sites used to each carry their own 150k; OB-03's four constants predate and duplicate it. |
| **1.5** | `HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` (SC-07, SC-10 — reads *frozen structural* slack) | **the trap is gone**: `HANDOFF_FORWARD_EVAL_PACE_START` used to share this literal on a different quantity, and both pace constants were deleted in `4325370`. 1.5 now means one thing. |
| **1.25 / 2.0** | `DEADLINE_MARGIN_FULL_PRESSURE` / `DEADLINE_MARGIN_NO_PRESSURE` (SC-09 ramp endpoints, GA-15 throttle, SC-16 filter) | **deliberate and singular**: one ramp, one saturation point, three consumers. The boolean face (`underFullDeadlinePressure`) is the ramp's own full-pressure anchor, not a second alarm. |
| **100,000** | `LR_REPAIR_MIN_BUDGET` default (LC-12), `AIM_TOPK_MATURE_BUDGET_FRAMES` (GA-11) | **coincidence of value, not of meaning**. The third occupant of this row, `REPAIR_MARGIN_RAMP_START_FRAMES`, is gone with its ramp (LC-19). |
| **200,000** | `AIM_TOPK_HIGH_BUDGET_FRAMES` (GA-12) | **was the compiler's most-repeated budget literal, with every use a different mechanism.** `OBJECTIVE_MATURE_MIN_BUDGET_FRAMES` went with OB-04/05, the three M-rule min-budgets with SC-02's case rules, `STEEP_ARRIVAL_SCARCE_BUDGET_MAX_FRAMES` and the four geometry ramp ends with the geometry group. One occupant left. |
| **50,000** | `MAX_NODES_FLOOR` (PLB-02), `START_BUDGET_PRESSURE_START/SPAN` (LC-05) | unrelated; the four geometry ramps that shared it are gone. |
| `TRAVERSAL_BUDGET_MODEL_V1` coefficients | `budgetSlack` (SLK-03), `budget_telemetry.structuralRemainingWork`'s default, `calibrate_budget_estimator`'s `budgetExponent: 0` fallback | one 250k-fitted regression underneath three consumers, one using it as a *coordinate* and two as a *shape*. **SLK-05 left this row on 2026-08-03**: the deadline margin took the default by accident and Phase 3 measured the accident out (§4, §6.4). What remains is the standing hazard that the default is silent — a new caller of `structuralRemainingWork` inherits a regression it did not choose. |

### Comparability and determinism hazard edges

Nine hazards, ordered by severity. **This is the list to consult before making
anything in the search live-adaptive.**

| # | quantity | what caches or compares it | what breaks if it varies mid-compile |
|---|---|---|---|
| H1 | the three `proposalUtility` exponents (OB-02, OB-03) | `node._candidatesCache`, forward-eval rollout values, retained `RankedOption` scores | pools sorted under an old objective are returned unchanged; rollout scalars from different epochs are compared; preference order becomes a function of node **visit order**. Highest severity. |
| H2 | `aimLaneDeadlineThrottled` (GA-15; the flag was named `aimLanePaceSuppressed` until `4325370`) | `node._candidatesCache`, keyed on `(seed, nCand)` only | **already shipped**: a node's pool *content* is frozen at first build and is a function of the compile's pace at that instant. Reproducible, not compositional. |
| H3 | `nCand` (OB-17) | the same pool memo | mitigated by construction — the memo handles a changing `nCand` because `solver.ts` guarantees the prefix property. Do not break the prefix property. |
| H4 | any budget/pace input to `projectBallisticGap` (OB-07) | `outgoingProjectionCache`, keyed on `endFrame:endsWithContact:includeElevation:includeAmplitude` | a "project further when we have margin" idea returns the first projection forever. Invariant: anything changing a projection must be in this key. |
| H5 | readiness artifact identity and feature subset (OB-11) | `validatedArtifacts` WeakSet, `featureProjections` WeakMap | safe today (per-process singleton); breaks the moment model selection becomes dynamic. Corollary: never make readiness model selection budget-dependent. |
| H6 | every `compileScopedEnv` flag (OB-09) | the epoch cache in `env_flags.ts` | sampled once per compile by design; a live-varying flag reads stale, and un-caching costs ~330× per read. |
| H7 | `resetPerCompileState()` coverage (OB-21) | every registered module accumulator | an unregistered global leaks across compiles in a long-lived worker: non-reproducible headline, no crash. `objective.ts`'s exponent globals are the current unregistered case. |
| H8 | `_physicsFrameLimit` null-vs-set (OB-15) | the recorder's between-extraction `getSimFrames()` snapshots | installing a limit changes charge *granularity*; totals unchanged, intermediate values change, so capture timing changes, so output changes. |
| H9 | float **association order** in `proposalUtility` (OB-02) | nothing caches it; the search *path* depends on it | an algebraically identical regrouping (≤ 3.6 ulp on 61% of inputs) moved N=48 by **14 points** through tie-breaking alone. |

**The explicit non-hazard, recorded because everyone expects it to be one:** the
best-so-far register (OB-18) is **not** objective-comparability-sensitive. It ranks
by `scoreDriftReport`, the fixed scorer, with no objective, readiness or budget
term in the key. An objective that drifted mid-compile would change which leaves are
*produced*, never which of the produced leaves is *returned*. H1's cost is search
efficiency and reproducibility, not output validity — which makes it a measurable
question rather than a correctness prohibition.

**H10 — the panel→headline convention (added 2026-08-04, forward-eval campaign
iteration 5).** The tenth hazard is not about a quantity varying inside a compile,
which is why it has no row in the table above; it is about a quantity varying
between the panel an arm is measured on and the surface that decides. Two rules,
both paid for:
*(i) nominations quote **suite-stratum-weighted** panel deltas, never flat panel
means* — the two diverge by up to **3×** on the same cells, because the suite
weights strata and a panel mean weights sources. The related 0.3× budget-deflation
adjustment an agent proposed was checked and **rejected**: the active promotion
surface is 750k-only (`campaign-baseline.json` `scope.budgets = [750000]`), and
the 0.2/0.5/0.3 budget weighting belongs to the frozen legacy evidence, not to
anything a candidate is scored on today.
*(ii) the 6-source screen is valid for KILLS ONLY, never for ranking* — **8 of 13
arms flipped sign** from screen to the 44-source confirm in one iteration. A screen
that says "negative everywhere" closes a lane cheaply; a screen that says "this one
is best" says nothing.
The precedent this generalises is §6.1's: power a preview against the candidate's
action set, not against the grid. H10 is the same error one level up — reading a
number off a population the decision is not taken over.

---

## 5. Provenance and the instrument

### The two settled design verdicts

**V1 — budget-dependent knobs must be scale-free laws, not saturating ramps.**
Established `c7f1518` (2026-07-28). The evidence that makes it a law rather than a
refit: anchored at 250k, calibrated at 750k, it **predicted an unfitted budget**
(500k wants 34, not the shipped 29) and the prediction verified (+0.97 N=8, +1.25
N=24). Seven constants collapsed to one anchor; N=24 **+1.24, SE 0.27, CI [+0.49,
+1.98]**. Three clauses that are easy to lose: *flat is a valid law* (the same law
applied to the admitted pool is −1.75 at sqrt and −1.94 at a quarter power, because
the pool is a selection device); *no ceilings fitted to the benchmark's operating
points*; and *the generalisation is explicitly open* — `maturityPressure` is named
by the accepting commit as the next law to write.

**V2 — spend model and difficulty model are different layers and must not be
merged.** `cost(spec, B) = D(spec)·(B/750k)^0.82`, exponent 0.82 ± 0.02, predicting
first completion to 3.6–12.2% median APE against V1's 19.9–79.7%. **And it must not
be substituted into `predictFirstCompletionFrames`**: doing so makes `budget_slack`
proportional to `B^0.18` instead of `B`, collapsing the live slack coordinate from a
30× span to a 1.9× span; at 300k, 112 of 352 compiles would newly fall below the 1.5
branch threshold that none of them cross today. "It is not a recalibration, it is the
removal of the signal." `budget-control-design.md`'s non-circularity requirement is
the reason: `α = 0.82` is a measurement of what *this controller chooses to spend*,
so a predictor carrying it is production spend by construction.

### The stale-sweep exposure

Five things changed underneath the 2026-07-28 audit within four days
(all commit dates verified in §2h): the breadth law itself was refitted sqrt/24 →
linear/27 (per-gap breadth at 750k went 42 → 81); the impact ruler was promoted;
the readiness model was retrained and promoted; unconditional aim center-row reuse
landed and was retired the same day; and repair restart sizing changed. The audit's
baseline no longer exists. One of its five arms has been re-run on the current
ruler and came back the other way (§2h).

### The instrument problem

- The live promotion gate is **one budget**, 750k, N=48, 44 cases;
  `analyze_campaign_baseline.ts` refuses any archive whose budgets are not exactly
  `[750000]`. The 250k/500k evidence in `benchmark/v2/baseline.json` is intact and
  deferred, not recomputed.
- The campaign contract nonetheless **requires** cross-budget behaviour. A
  cross-budget claim cannot be measured by the deciding instrument.
- The only multi-budget instrument with family-grouped trace archives is
  `scale_study.ts`, which has **no promotion authority**.
- **The dividends campaign answered the acceptance-surface question by choosing
  not to widen the gate** (Phase 0b, 2026-08-03): a second budget on the
  acceptance surface changes what the headline *means*, and every promotion and
  the drift ledger are denominated in the current one. What was built instead is
  `npm run benchmark:v2:low-budget-reading` — capability mini manifest (11
  sources) × 48 seeds × 250k, working tree against the promoted baseline's
  checksum-verified **compiler snapshot**, a fixed five-code verdict vocabulary,
  an always-printed action-set power footer and an append-only history under
  `generated/benchmark-v2/low-budget/`. It is tracked, never promoting: a loop
  step documented in `HOW_TO_WORK.md`, wired into nothing, writing to no
  governance state. It exists because of §6.2 — at 750k on the ladder's own seeds
  the capability sources are all valid, so a rescue-class mechanism has nothing to
  rescue and can only lose; at 250k **118 of 528 baseline cells are invalid**.
- **A third standing reader landed 2026-08-04** (`4ff32ae`):
  `npm run benchmark:v2:fwd-metrics`, the Tier-1 reader over
  `.stats.json` / `golden.json` / v2 archives, printing M1–M8 plus the deadline
  block per (source, budget, arm). It is free — every number it prints is already
  in the archives — and its M3 column (`fwd_rollout_redraw_refuted /
  fwd_rollout_redraws`) is a standing per-compile estimate of verdict falsity that
  reproduces the 198-cell study's terrain ordering at **zero probe cost**. Like
  the other two it has no promotion authority, and the M-set ships with
  anti-gaming annotations attached to the definitions (M1 down is capped at
  +1.78, M5 has no good direction, M6 has no exchange rate to headline points).
  Definitions: `docs/forward-eval-metrics.md`.
- Two smaller instruments landed with it (Track T): `npm run
  benchmark:v2:mover-grid`, mini manifests **derived** from the canonical ones by
  selector (a suite edit cannot orphan them) run as paired grids against any ref,
  and `npm run benchmark:v2:action-set-power`, which states how many cells a
  candidate can change and what failure rate an observed zero excludes. Both are
  evidence only — the aggregate is a renormalized subset score and is never a
  headline.
- **A latent defect in the promotion machinery surfaced the first time a
  candidate was accepted mid-ladder** (`ae55f13`, 2026-08-03). Every prior
  baseline had been promoted at full N=48 depth and published its cache straight
  from the eval archive, so the baseline-cache *extension* path had never run. An
  N=32 accept exercised it: the shard invocation ran `--profile=canonical` with no
  budget restriction, the runner resolved the catalog's full 250k/500k/750k ladder
  while the campaign schedule carries one budget, and the seed-schedule length
  check correctly threw. The fix makes `--comparison-budgets` legal in
  baseline-cache-shard mode — it *is* a canonical cache operation on the campaign
  scope — and passes the cache's own ladder budgets. **Read it as a property of
  the instrument, not an incident**: a governance path that only executes on an
  outcome that has never happened is untested by construction, and this campaign
  produced two of them (this, and `package.json` entering
  `COMPILER_SOURCE_PATHS` so that a tooling-only commit moves the candidate
  fingerprint).
- `docs/repair-roi-study.md` H5: **allocation binds at 150k–300k, not at 750k.**
  At 150k a repair frame is worth 0.126 pts/kf, 7.5× its 750k value, and every 10%
  shaved off first completion at 150k is worth +0.6 to +1.4 points — the largest
  data-supported effect in that study by a factor of three, and an *in-run
  spend-rate* question, not a post-completion one.
- H4: at 750k, **18.6% of compiles spend their entire repair allocation for exactly
  zero points** (17.6% of repair frames, 8.2% of the whole budget) — 6× every
  ceiling-and-cap effect combined.

---

## 6. What the programs measured (unification · dividends · forward-eval)

Findings not attached to any single catalog entry. They are here because each one
closed a lane, and a closed lane is worth more written down than re-opened by
accident. §6.1–6.4 are the unification program's, §6.5 the dividends campaign's,
§6.6 the forward-eval value campaign's.

### 6.1 The 1b lottery — graded rollout-depth pressure

Phase 1b option D was the capability-debt repayment lane: a share of nodes equal
to `deadlinePressure(margin)` gives up the greedy rollout's second hop
(deterministic per-node hash), pre-completion only. It is a **cost-side** lever,
the GA-16-safe shape, and its preview was clean: full 8-seed grid **+0.675**
headline, capability **+4.50** (dense_recovery +9.85, rapid_pickup +2.62, low_air
0.00), all 14 changed cells inside the three frontier movers, controls
bit-identical, zero validity loss, H2 cross-state reads *down*. At N=48 composed
with the rider it read **−5.4132, SE 2.7255, REJECT, capability −36.09, validity
2108/2112 (−4)**.

The mechanism is a **lottery**, and every number below is the same lottery seen
from a different side.

*It only touches compiles that are already late.* Over the 192 mover cells of the
48-seed grid, first-completion frame changes on 95 — and **0 of the 93 cells whose
baseline `first_completion_frame` is below 0.8·B**, against 95 of the 99 at or
above it. The action set is "the compile was going to finish in its last fifth of
budget", not "the suite".

*Where it acts it is strongly positive, and occasionally fatal.* Of the 90 cells
whose score moves: 60 up (+985.4, mean **+16.4**), 26 down (−315.4, mean −12.1),
**4 collapse** (lose completion entirely, −1,681.1 between them). Net excluding
collapses: **+670.0 over 86 cells = +7.79/cell**. In headline units on the
capability sources, the arm reads −184.02 raw and **+14.03 with the four lost
completions healed to their control value** — so one lost completion costs about
**50 headline points** and the entire upside is **+11 to +15**.

*Break-even is therefore a loss rate under about 0.3%* — 13/50 ≈ 0.26 tolerable
collapses per ~85–90 changed cells. Measured across three independent 48-seed
blocks and five shares, the rate runs **0.43% to 5.68%**:

| share | changed cells | lost | gained | capability sum | healed upside |
|---|---:|---:|---:|---:|---:|
| 1.0 | 180 | 7 | 1 | −260.51 | +14.03 (eval block) |
| 0.8 | 90 | 5 | 0 | −224.56 | +11.27 |
| 0.6 | 88 | 5 | 0 | −218.28 | +11.05 |
| 0.4 | 247 | 3 | 3 | +25.63 | +14.68 (eval block) |
| 0.2 | 232 | 1 | 3 | +108.05 | +5.53 (eval block) |

*Share → 1 degenerates into the forbidden shape.* At share 1.0 every node at full
deadline pressure gives up its second hop, so on the fully-pressed population the
graded rule **is** the binary rule — and the binary rule was measured separately in
the same session at **−6.22, capability −41.50, with a completion collapse**: a
single-variable controlled proof of "throttle a magnitude, never trigger a mode".
The dose–response above is the same statement continuously: the arm survives only
while the *rate* stays bounded.

*The preview was underpowered, and the arithmetic says so exactly.* The preview
changed **14 cells**. At the per-changed-cell collapse rate the eval later measured
(4/90 = 4.4%), **P(zero collapses in 14 cells) = 0.53–0.57**. A clean preview was a
coin flip, not evidence. This is now a standing rule in the plan: **power a preview
against the candidate's action set, not against the grid.**

*Reopening conditions*, one that bounds the rate and one that removes the tail:
(i) cap the share at 0.2 — the only arm with zero collapses on the promoting block
and a positive pooled capability sum, at the cost of most of the upside; or (ii)
make the depth decision **revisitable** — re-deepen the rollout when the shallow one
fails to place the contact, which converts a lottery ticket into a retry. The second
is a shape change and would need its own preview, powered against its action set.

**BOTH WERE RUN, 2026-08-03 (dividends Phase 1), and the premise underneath them
is falsified.** Eight arms on a collapse-enriched 7-source grid × 48 seeds × 750k
(336 cells, 0 invalid in control):

*(ii) revisitable depth works as designed and still loses by 16×.* `revisit1`
re-deepens on placement failure and **rescued 2 of the lottery's 4 known losses at
no upside cost** (healed +14.07 against L1's +14.03, 2 lost on 90 changed). But
pooled over all eight arms the loss rate is **35 lost / 702 changed = 4.99%
[3.47%, 6.93%]** against a break-even under **0.30%**. Making the lottery
reversible bounds the tail; it does not move the order of magnitude.

*The dividend it was spending is not there.* Mean sim frames over the 192
capability-mover cells: 765,198 → 764,319 — **−878 frames, 0.115% of the
compile** (−0.065% over all 336 cells; the 0.115% is the most favourable
denominator). The reason is structural and was later confirmed independently:
**51.0% of rollout calls dead-end at hop 1**, where depth 1 and depth 2 are the
*same computation*, so half the lever is a no-op by construction — and the whole
depth family is ceilinged at 2.5% / 9.0% / 2.5% of the compile at 150k / 250k /
750k, with removing hop 2 outright costing −3.84 ± 3.35 per cell (§6.5). *(That
last arm is RE-STAMPED 2026-08-04: it was taken through `LR_FWD_EVAL`, which
switches the adaptive arms off, and composed it inverts to +12.53 ± 4.14 —
depth 1 is now the shipped base. §6.6. The frame ceiling and the hop-1
no-op argument are unaffected; the sign of the depth verdict is not.)*

*And what 1b appeared to do was a width effect, not a depth one.* Splitting the
mechanism in two — `headdepth` (the shallow-rolled tail keeps its score instead of
being scored `Infinity`: **pure selectability, zero frames freed**) and
`shallowhead` (the head drops its second hop too: **pure cost, no width**):

| arm | capability sum | healed | changed | lost | up/down | Δ sim frames |
|---|---:|---:|---:|---:|---:|---:|
| lottery (both halves) | −184.02 | **+14.03** | 90 | 4 | 57/26 | −878 (−0.115%) |
| width only, 0 frames | −222.74 | **+13.00** | 83 | 5 | 52/22 | **+749 (+0.098%)** |
| cost only, no width | −16.24 | **−16.24** | 82 | **0** | 29/51 | +160 (+0.021%) |

The width half reproduces **93% of the healed upside while freeing zero frames**
and carries the collapse risk with it; the cost half — the actual depth dividend —
is strictly negative and collapses nothing. On the changed cells the score tracks
`deepest_seen_gap` at **r = +0.916** and frames freed at +0.295: the mechanism was
never about frames. **Capability debt is not repayable on the depth axis at 750k.**

*(i) share 0.2 is the survivor, and it is an operating-point result.* Zero losses
on 79 changed cells on the eval block; pooled over three seed blocks **232 changed
/ 1 lost = 0.43% against 1.407% tolerable** — clears break-even ~3×, but the raw
capability sum by block is **+103.06 / −0.34 / +6.61**, i.e. it pays only where
baseline failures exist to rescue (§6.2). Left as a reopener conditioned on the
operating point, not on the mechanism.

*The residue worth reopening* is the **width lever as its own family** (+13.00 for
zero frames, with the collapse tail still attached and no reversibility story yet)
and the **250k operating point**: the identical lottery arm reads capability
**−184.02 at 750k and +112.90 at 250k**. State that flip with its completion
ledger, which the dividends plan's Phase 0b quote omitted — at 250k the arm gains 11 and
**loses 18**, net −7 completions, and the +112.90 is a raw shifted-geometric score
sum. The sign flip is real and the mechanism is still a lottery.
One debit recorded against revisitability: `revisit1` raised cross-state pool reads
**6 → 38** on one pressed compile — no new memo key, but a changed visit order
re-enters pools built under a different aim-lane throttle state.

### 6.2 The seed-block two-sidedness

The three 48-seed blocks disagree about 1b's sign, and the disagreement is
structural rather than noise. On the **promotion ladder's own seeds** (16–23,
608–647) all four capability sources are valid in the control, so 1b has **nothing
to rescue and can only lose**: 0 baseline failures, 0 gained, up to 7 lost. On the
out-of-policy blocks it has both: seeds 700–747 carry 1 baseline mover failure and
1 is rescued; seeds 800–847 carry 2 and both are rescued, and that block reads
**+103.16** at share 0.2 and **+60.48** at 0.4. The promoting instrument is
therefore not a neutral referee for a mechanism whose value is *rescuing compiles
that fail*: on this suite, at these seeds, the failures it would rescue do not
exist. Recorded as a property of the instrument, not as a reason to discount the
verdict — the verdict is what governs.

**Measured at a second operating point, 2026-08-03, and the structure holds
exactly.** On the same 11-source capability manifest and the same seeds, at
**250k**, 118 of 528 baseline cells are invalid (`dense_recovery_frontier` valid
on 17 of 96, `rapid_pickup_frontier` on 57 of 96) where at 750k the number is
zero. That is the rescue headroom, measured. And it converts: the paired 250k
mover grid across the Phase 3 promotion (`b7de5c3` against `45707a7`) moved
validity **410 → 446 — 53 completions gained, 17 lost, net +36** — on a candidate
whose 750k eval read −0.31 with capability +0.76 and no completion movement at
all. The consequence for how this map is read: **a capability reading at 750k is a
quality reading; the completion half of a rescue mechanism's value is only visible
below it.** That is why Phase 0b built a standing 250k surface (§5) instead of
widening the gate.

### 6.3 The rider is exonerated — the four-arm decomposition

1b's preview ran on the pre-rider compiler (`f7d054f`) and its eval ran composed
with the rider (`ccfd58d`), so the obvious suspect for the sign flip was
composition. It is not. Four arms, each 48 seeds × 7 sources at 750k, each with
1b on and off:

| arm | rider members present | cells changed by 1b | completions lost | capability sum |
|---|---|---:|---:|---:|
| A | both (= shipped) | 90 | **4** | −184.02 |
| C | SC-16 anchor reverted | 90 | **7** | −307.03 |
| D | affordability reverted | 90 | **4** | −184.28 |
| E | both reverted (= the compiler the preview ran on) | 90 | **7** | −307.27 |

1b changes exactly the same 90 cells in all four arms. The rider does not cause the
collapses — it **halves** them, through its SC-16 anchor member, and the
affordability member is inert to the question. On the compiler the preview was
taken on, 1b would have been *worse*. The sign flip is the lottery in §6.1, not
composition. (Second lesson, now in the plan: a sequential candidate in a mechanism
family that has moved since its preview needs a composition re-probe *before* the
eval, not an autopsy after it.)

### 6.4 The deadline base and its anchors — **RESOLVED 2026-08-03 (Phase 3)**

`DEADLINE_MARGIN_FULL_PRESSURE = 1.25` and `DEADLINE_MARGIN_NO_PRESSURE = 2.0` were
re-derived from the 129,481-observation Phase 0 corpus, re-scored with the pace
blend switched on — Youden J = 0.815 at 1.25 (against 0.717 at 1.5, 0.541 at 1.0),
and 2.0 the smallest round threshold at FPR exactly 0.000. **That re-derivation
used the artifact's structural coefficients**, and the shipped base used V1's.
So the anchors were *derived* on a signal offset from the one they ran on, and
*validated* on the shipped one end-to-end. The Phase 1a investigation ran fifteen
arms on that code, 8 capability sources × the eval's own 48 seeds at 750k,
scored against the 1a arm:

| arm | Δ vs 1a | invalid cells |
|---|---:|---:|
| consumers off — SC-09 / GA-15 / SC-16 | **−17.50 / −5.29 / −12.25** | 18 / 4 / 10 |
| no-pressure endpoint 1.5 / 3 / 4 / 6 (shipped **2.0**) | −2.60 / −2.89 / −0.06 / −0.11 | 2 / 2 / 0 / 0 |
| aim base share 0.6 / 0.2 (shipped **0.4**) | −2.49 / −0.02 | 2 / 0 |
| rolled-head narrow end 3 (shipped **2**) | −10.22 | 8 |
| third anchor 0.8 / 1.25 (then 1.0) | −2.95 / **+0.06** | 2 / 0 |
| GA-15 triggering on the third anchor instead | −0.08 | 0 |

Nothing beat the shipped value on that signal; every consumer is load-bearing; and
the one positive reading — collapsing the third anchor onto 1.25 — is precisely
what the rider then shipped by deleting `deadlineAtRisk`. Note what is *not* in the
table: `DEADLINE_MARGIN_FULL_PRESSURE` itself was never swept as a policy constant,
only as a classifier threshold on the Phase 0 corpus.

**Phase 3 resolved the base shape by measuring it, and the deviation lost.**
`deadline.ts` now passes `BUDGET_ESTIMATOR_TRAVERSAL_MODEL` explicitly at both
`structuralRemainingWork` call sites. Three pieces of evidence, in the order they
were taken (worktree artifacts under `scratchpad/dividends-p3/`):

*1 — the corpus, re-derived from coefficients rather than from the recorder's
stored estimate*, so both shapes can be scored on the same 129k rows with
everything else held identical. The reconstruction reproduces the shipped anchors
on the artifact shape (150k: Youden-optimal **1.30**, smallest zero-FPR **1.90**),
stable under both the recorded `episode_pace` and the controller's own pace
formula — so the swap needed **no re-anchor**, and the plan's "swap + re-derive
the constants" arm collapses onto the plain swap. On the V1 shape the same corpus
asks for **3.00 / 3.40** at 150k and **4.00** at 750k. Both self-consistent
readings call for far more pressure than shipped; the shipped pair was uniquely
under-engaged. The engagement table quoted in `DEADLINE_MARGIN_NO_PRESSURE`'s
docstring (75 / 71 / 49 / 19 / 10 / 7 % at 75k…2.25M) is the artifact-shaped
signal's — the reconstruction returns 78 / 71 / 49 / 19 / 10 / 7, matching every
in-domain budget to the printed digit. The V1-shaped signal over the same panels
read **28 / 9 / 5 / 2 / 0.4 / 0.3 %**, so the docstring was describing a profile
the shipped code did not produce: at 750k it was 2%, the same order as the 2.3%
of the ramp it claimed to have flattened.

*2 — a paired signal comparison*, both shapes computed inside one
`CompileDeadline` over one set of compiles (8 capability sources × 2 seeds),
counted at pre-completion pool builds:

| budget | builds | median margin V1 → artifact | engaged `<2.0` | full pressure `≤1.25` |
|---|---:|---|---|---|
| 150k | 2,465 | 1.45 → **0.74** | 63.0% → **98.6%** | 44.4% → **75.1%** |
| 750k | 3,164 | 3.32 → **1.52** | 21.5% → **64.3%** | 4.5% → **32.6%** |

Post-completion builds are identical under either shape — there the base is the
incumbent's measured `costToEnd` and no model touches it.

*3 — a 48-seed capability mover grid at 750k*, paired against the V1-shaped tree:
243 of 528 cells change, **0 completions lost**, 3 gained, `rapid_pickup_frontier`
**+52.89** and `dense_recovery_frontier` **+26.85** (both canonical group scores),
`low_air_frontier` −0.34, the three back-filled controls 0.00 / −0.06 / 0.00.
Power footer: an observed zero on a 243-cell action set excludes loss rates above
1.23%. A full 44 × 8 grid at 750k followed.

The full 44 × 8 grid read **579.57 → 594.74, +15.17**, 0 completions lost and 2
gained — and the honest decomposition of that number is the finding, not the
number: of the +852.1 total, **+832.0 comes from two validity flips** and +20.1
from the other 78 changed cells (mean +0.26, **median −1.14**, 34 up / 44 down).
The same shape holds on the capability grid: +1,272.1 of +1,306.3 from three
flips, +34.3 over 240 same-validity cells. **The mechanism is healed completions,
not better tracks** — on cells both arms complete, it is a wash with a slightly
negative median, and first completion arrives a median 17,073 frames earlier on
the capability movers. That is exactly the shape the promoting instrument cannot
price: at N=48 it read **−0.31 [−0.91, +0.30], validity 2112/2112, capability
+0.76** and was promoted per posture (`b7de5c3`, headline 595.53 → 595.23, ledger
−0.68), because the ladder's own seeds have **zero** baseline capability failures
to heal. At 250k, across the same promotion, validity moved 410 → 446 (§6.2).

Three consequences to carry forward. The accuracy table in `deadline.ts`'s header
is now a measurement of the base it computes rather than an upper bound. The
Phase 1a anchor brackets above are **stale by the stale-sweep rule** — they were
taken on a signal ~1.9× looser — so re-bracketing `1.25 / 2.0` on the corrected
signal is filed work; the corpus derivation and the shipped pair agree to the
rounding, which is why it is not a blocker. And the **pace term's price is stale
in the same way**: the pace-free arm (capability −21.6, recovered to −0.8) was
measured on the V1-shaped base, which is ~2.7× larger at a root node, so the term
stays on an unrepriced number until someone re-runs it. The H2 exposure moved the
right way: 8 cross-state reads before, **1** after, over 176 compiles — the
throttle is engaged on more builds, so fewer cache lifetimes straddle a
transition.

### 6.5 The forward-eval dead-end verdict is mostly wrong — **MEASURED 2026-08-03 (dividends Phase 4)**

The owner's smell: half of forward evaluation ends in a hop-1 dead-end verdict,
on the mechanism that is a large share of every compile's charged frames, and
nothing in this repo had ever verified the verdicts. Audited at 100% sampling —
**31,494 verdicts over a 198-cell grid** (`docs/rollout-economics-study.md`).

**Three corrections came out before the finding did.**

*The 51% was the wrong population.* The literal `dead_hop1` verdict is
**13.6–20.2% of linear rollout calls** (6.4–16.4% of all calls). What reproduces
at 51% is a different quantity — rollouts that place at most one hop, 48.3%
pooled — and only verdicts can be true or false. Sizing the truth question off
the 51% overstates the population about 3×.

*Rollouts are not half the frames.* Rollout + start-eval frames are **29.1% /
27.7% / 20.5%** of charged sim frames at 150k / 250k / 750k on the instrumented
grid (34.7% / 32.4% / 29.4% at 250k / 500k / 750k over 3,648 archived compiles).
The "54%/46%" figure predates the closed-form ballistic cutover.

*The dead-end rate is a property of the source mix, not of the compiler.* Across
44 archived sources it spans **10.3% to 78.1%**, and the six sources above 60%
are all capability-frontier members.

**The finding.** The same generator, at the same node, through the same gates,
finds a viable catch for **16,791 of 31,494 audited verdicts — 53.3% are false**;
14,703 (46.7%) are verified true. Both are bounds in the same direction — 53.3% a
*lower* bound on the error rate, 46.7% an *upper* bound on correctness — because
the ladder reproduces only the ordinary sampling lane and never draws the reuse
lane, the brake lane, kinematic support or the startup rescue tier's distinct
catch stream, all of which the real search would offer and all of which can only
add candidates. "Verified true" means "still dead after everything the *ordinary*
generator can do". *(Read
the study's §4.2 pooled row with care: its `verified TRUE` and `FALSE` columns
are transposed — the per-budget rows sum to 14,703 true, the refutation ladder's
own "never (verdict true)" row says 14,703, and the stratum table reweights to
46.7% true. Discrepancy 17.)*

*The cause is breadth, and it is a factor of 24–81.* The rollout's hop-1
expansion is `solveOneGap(K = branch)` with `branch = 1` for the default greedy
shape — **one** `sampleOneCandidate` attempt at index 0 — where the search at the
same node draws `max(8, round(27·B/250k))` (measured 23.5 / 30.3 / 80.9 at 150k /
250k / 750k) and then adds the aim lane, the reuse and brake lanes, kinematic
support and three rescue tiers. The gates are the identical function. "The
dead-end verdict is not *no continuation exists here*; it is *draw number 0 of
the deterministic sample order at this gap did not catch*."

*The error splits by terrain, not by pool rank.* Verified-true by stratum:
**capability 58.9%** (n=17,181), legacy_regression 40.5% (2,367), **representative
30.3%** (11,942) — `frontier_dense_recovery` 64.4%, `high_air_drive` 5.3%. By pool
rank it is flat to two points (p0 47.2% → p4 47.3%), which **falsifies the
generation branch**: the pool's tail is not feeding dead candidates into rollouts,
and `HANDOFF_CANDIDATE_POOL = 5`'s "correctly flat" verdict is not explained that
way. The two extra lanes do differ — `reuse` verdicts are the most trustworthy
(60.3% true) and `brake` the least (30.0%). Pre-completion verdicts are 49.9%
true against 39.9% post-completion. Against the realized search (32,733 joined
nodes, an independent no-probe ruler) false-alive is **0.0%** and false-dead
**21.6%** — the errors are one-sided by construction, and both rulers agree there
is no reading in which the verdicts are trustworthy.

*So the apportionment the phase asked for is a boundary, not a blend*: on the
capability frontier the verdict is terrain information; on representative sources
it is a breadth artifact; the compiler applies it identically to both.

**What the phase shipped: L1, re-draw on empty** (`bb45125`, SC-24). One extra
draw refutes 14.5% of all verdicts and five refute 28.5%, and the curve is
front-loaded enough that the dose is arithmetic rather than taste: at ~40 frames
a draw the marginal cost per marginal correction is 261 / 628 / 845 frames for a
ladder to 2 / 3 / 5, so draw 2 buys a correction **2.4× cheaper than draw 3**.
Suppressing the aim lane inside the probe leaves the verified-true rate and the
refutation curve unchanged to a tenth of a point while making the 2-wide rebuild
**4.6× cheaper** (185 → 40 median frames) — the correction is plain sampling
breadth, not the aim lane. Accepted at the N=32 boundary: **+0.72 [−0.08, +1.53],
P(+) 99.02% against a required 98.88%, validity 1408/1408, every stratum
positive** (representative +0.39, capability +1.39, legacy +2.27, music +0.27).
Realized price 0.45–1.71% of frames; dead-end verdicts per compile fall
728.7 → 704.9 at 750k and 421.1 → 378.7 at 250k.

**What is capped, and what is left.** Refunding **every** rollout frame is worth
**+1.78 ± 1.31 per cell at 750k** — the hard ceiling on the entire "cheaper
rollouts" family, and the reason correctness rather than cost is where the value
is. Three lanes remain open with prices on them: the **impact widening** (SC-13)
is 62.8% of rollout frames at 750k and buys +4.59 ± 2.20 per cell, so the trade
the study predicted and nobody has run is narrowing it and spending the frames on
the re-draw, which buys ~20× the coverage per frame; the **online-continuation
filter** (SC-16) still prunes on a verdict that is ~70% wrong on representative
sources, and is now fed a corrected bit rather than fixed; and the **dose ladder**
beyond one draw is the same mechanism at 2.4×/3.2× the frames per correction.
Hop-2 verdicts (`dead_hop2`, 5.6% of rollout calls at 750k) were deliberately out
of scope. **The depth family has a ceiling**: hop-2 frames are 2.5% / 9.0% / 2.5%
of the compile at 150k / 250k / 750k, and removing hop 2 costs −3.84 ± 3.35 per
cell at 750k plus a completion at 250k.

**RE-STAMPED 2026-08-04 — three of these four lanes are now closed by
measurement, and the depth verdict inverted.** (1) The −3.84 / −11.36 depth arm
was `LR_FWD_EVAL=greedy:1`, and that flag switches every adaptive arm off, so it
priced "depth 1 *minus* the impact widening". Composed through the new base
override (arms live) the sign flips at every budget — +5.50 @250k, **+12.53 ±
4.14 (t = 3.02) @750k**, +3.59 @2.5M, on **fewer** rollout frames — and
`greedy:1` was promoted as the production base (SC-25, `9f58697` + `1ecbc1b`,
596.41). (2) The predicted trade — narrow the impact widening, spend the frames
on the re-draw — was run and **both halves lose on the promoted tree**: the ask
re-gate reads −11.53 ± 4.08 and the dose-6 re-draw −6.49 ± 2.90, exactly as the
non-additivity table predicted, because the depth-1 base already reaches the same
correction (SC-13, SC-24). (3) Width as a family is closed separately in §6.6.
What is left of this section is its diagnosis, which survives all of it: the
verdict is a one-sample artifact, and correcting it is measurable and does not
pay — three independent reproductions now say so.

**Honesty note on the instrument.** The spend/verdict/confusion arm is
bit-identical, proven on 198 of 198 cells. The truth-check arm is **not
frame-identical** — frames are refunded and the build lands on a cache-cleared
copy, but the engine's own frame cache is warmed by the work and cannot be
un-warmed. At maximum perturbation: 12/12 identical track hashes and full scores,
median |Δ sim_frames| 0.034%.

### 6.6 What the forward-eval value campaign measured — **2026-08-04**

Six findings that are not attached to one entry. The campaign's own record is
`docs/forward-eval-value-plan.md` (phases 0–5 plus six mandate iterations, every
arm's verdict including the negatives); this is what a reader of *this* map has
to know before re-opening any of it.

**(1) The confound: `LR_FWD_EVAL` disables the adaptive arms, so every shape
verdict ever taken through that flag was measured arms-off.** Any non-empty value sets
`defaultConfig = false`, and all three shape upgrades are gated on it
(`adaptiveArmsApply`, `handoff.ts:7411-7419`). The impact widening alone is 62.8%
of rollout frames at 750k, so "greedy:1" through that flag meant "greedy:1 with
the widening removed". `916d5db` added `LR_FWD_EVAL_BASE`, which moves the base
and *composes* with the arms; measured that way the depth verdict inverts
(§6.5) and the base was promoted. **The lesson generalises past this flag**: a
study override that silently removes a neighbouring mechanism does not measure the
thing it names, and every arm must state its regime. It is the H10 error in code
rather than in statistics.

**(2) Width is closed, and the reason is a reducer, not a cost.** The
pre-registered falsifier for the false-verdict story failed in the wrong
direction: representative sources LOSE on the clean width term (−49.6 / −23.0 /
−20.1 at 2.5M), the capability frontier is the biggest gainer (+32.5), and the
verdict-truth-vs-width-gain ordering is **inverted** (Spearman ρ = +0.90 where the
story needs it negative) — while the M3/M4 clause passed honestly (residual
dead-ends 34.6% → 9.1%). So correcting false hop-1 verdicts is *measurable* and
*does not pay* — now reproduced three times (this, the dose-6 redraw, the ask
re-gate). The dose walk then found a hard cliff at **W = 6** (W6 − W5 = −31.0,
t = −5.6, 17/18 cells at 750k), and the pool-cliff hypothesis was falsified:
the cliff is absolute in W across pools {5, 6, 7}. Diagnosed, it is **the
max-over-W reducer's optimism bias** — `avg` and the reducer-free redraw path show
no cliff at all. The clamp lift is retired for `best`; median / top-m-mean
reducers are the only licensed way back in.

**(3) The budget-conversion account, at grid scale.** Of the 750k → 2.5M
increment, **2.1% reaches rollouts**: nCand ×3.33, tree ×1.2, full deadline
pressure exactly **0** at ≥ 1.5M. The breadth law eats the dividend, exactly as
the law's own shape predicts, and the estimator's EXT domain is clean 21/21. The
1M non-monotonicity reproduces (9/21 cells). `openingBest` (SC-14) is dead by
STRUCTURE on canonical sources, not by slack: it needs ≲ 12 authored contacts and
the panel authors 82–130 — so offender d2's re-price has no surface to be measured
on. `impactBest` is **72% of rollout frames at 2.5M** (62.8% at 750k).

**(4) The capability debt, named and then accepted.** The base swap bought
representative +1.39 [+0.12, +2.67] and cost capability −2.37 [−4.79, +0.04].
Diagnosed causally: it is SPEED (pooled q_speed −0.00168 against q_air +0.00400),
localized to track deciles 1–3, concentrated in one family
(`rapid_pickup_frontier` = 110% of the recorded debt), and the second hop's value
there is **real composed-track information** — not the optimism artifact (a greedy
branch-1 rollout has no max to be optimistic over) and not an existence test (0.0%
of that family's top-1 flips are hop-count-decided). All three fix shapes are
closed: A-FIX-1 (de-dilute the leaf) failed its own falsifier in the wrong
direction at −17.24 ± 3.04 pooled, A-FIX-3 dies with it, and A-FIX-2's coordinate
was killed at pre-registered thresholds (Spearman +0.001 pool-weighted against a
needed |ρ| ≥ 0.6, with a power audit showing a true −0.6 would have read −0.35).
Reverting is measured worse at panel scale (−1.163 ± 0.713 over 44 × 8). Debt
ACCEPTED; re-open only from a genuinely new direction.

**(5) The equal-depth ordering bound — a general result about leaf scorers.**
`survival` and `missing_quality` are functions of `leaf.gapIndex` alone, so two
leaves at the same depth differ only in their axis factor; **both folds are
strictly increasing in the candidate-specific squared-error mass, so on an
equal-depth pool they induce the IDENTICAL order.** A sort does not read
magnitudes. The 35× within-pool contrast collapse along the track is real *and
cannot have decided an equal-depth pool* — the entire action of any such
reweighting is on mixed-depth pools (~7% of production pools), where it is an
exchange rate between "this arc's own gaps scored well" and "this arc's rollout
kept going". Moving that rate the obvious way made first completion arrive LATER
on all six panel sources: the depth premium is load-bearing. Anyone proposing to
re-shape a leaf value must first say which pools they expect to re-order.

**(6) The three in-scope re-brackets, all closed at the promoting budget.** The
deadline anchors: six alternative pairs, every one a measured null, while
engagement walked **15.3% → 60.1%** of pre-completion builds and full-pressure
saturation walked 0.01% → 1.96% — *the pre-completion consumers are insensitive to
a 2.5× ramp-engagement change at 750k*. Not directional; dormant. Reopen surface
is ≤ 250k. The pace term: weight 0 reads −0.016 ± 0.381, so the −21.6 that bought
it does not survive the base swap — **kept anyway** on an argument about ≤ 300k,
where `episode_pace` is the lowest-error component, and filed as a simplification
whose evidence surface is a 250k panel and the standing reading, never an eval
slot. The breadth law: 1.0× is the local optimum, narrowing is significantly worse
(0.7× = −2.28 ± 0.71, t = −3.21, every stratum negative) and widening costs
completions, so the stale-sweep licence the depth-1 promotion opened on that
constant is DISCHARGED with no cross-budget re-fit indicated.

---

## 7. Five clusters for future decisions

These are groupings, not recommendations. Each names what evidence exists, what is
missing, and which entries move together.

### Cluster A — dead code and stale comments — **EXECUTED 2026-08-02**

| entry | what | disposition |
|---|---|---|
| OB-05 | `objectiveElevationReadinessForSpec` — zero call sites, ever | **DELETED** `d7c839f` |
| OB-04 | `objectiveBlendReadinessPowerForSpec` — production call site deleted 2026-07-28 on a **+0.00 SE 0.19** null; retained as a `study_objective_powers` diagnostic | **DELETED** `d7c839f`, with `OBJECTIVE_MATURE_MIN_BUDGET_FRAMES`, four `LR_M*` env names, six profile predicates and thirty M-constants |
| LC-31 | `completeNearTailSuffix`'s `maxNodes`/`frameCeiling` (sole caller passes `Infinity, Infinity`); `repairConfig`'s unused `profile`; the vestigial `repair === null` / `repair!` | **PARTIAL**: `profile` gone with `repairConfig`'s whole argument list; the `Infinity` ceiling hooks KEPT on the caveat below |
| SC-02 | the six-rule `QUALITY_BREADTH_RULES` table plus four benchmark-case-named min-budget constants — unreachable at B ≥ 291,667 | **HALF DELETED, AND THE CLASSIFICATION WAS WRONG** — `f7d054f`; see below |
| SC-18 | `qualityFuturePreviewPressure` and the whole local-proxy scoring branch — unreachable at B ≥ 75k | **PRESSURE DELETED, BRANCH KEPT** — `d7c839f`; see below |
| SC-23 | `targetBudget >= 500000` probe-hook literal (written without the file's numeric separator) | separator fixed `d7c839f`; the hook stays |
| — | four stale comments: the aim air-matched docstring (§2j), the `mainMargin` "eases to 1.1 by 200k" comment, `LR_REPAIR_MAX_ATTEMPTS`'s "1M affords ~30-40 restarts", and three prose references to the retired `objectiveBlendReadinessPowerForSpec` | **comment ledger paid** `d7c839f`, plus the breadth-law docstring that still said `sqrt` |

**Two corrections this cluster earned by being executed.**

*SC-02 was not dead code.* Four of the six rules are benchmark-case signatures
behind min-budget gates named after those cases and they are gone. The other two
carry no min-budget gate and broad predicates (air range ≥ 0.50 or speed range ≥
0.40 → 32; ≤ 32 contacts with no amplitude → 34), so below B = 291,667 — where the
law returns under 32 and its floor of 8 starts binding — **they function as the
law's scarce-budget breadth floor across most of the suite**. Deleting the whole
table measured −7.70 mean score per run at 75k (suite −19.78, 24 new missing
contacts) and −1.53 at 150k. They stay, re-documented as what they are. The honest
follow-up the surviving docstring records: the real question is whether
`HANDOFF_QUALITY_N_CAND_FLOOR = 8` is too low — a bracket on the law's floor, not a
per-spec question.

*SC-18's branch was not dead below the gate.* The pressure and its plumbing are
deleted; the local-proxy scoring branch **survives as the `LR_FWD_EVAL=off` escape
hatch** and now says so, with an explicit do-not-tune. Below 75k the branch runs,
`policy.preview` is hard-false, and `qualityFuturePreviewPressure` was the only
thing making it take a preview at all — the one place in the tree that exercised
that is `tests/optimizer_handoff.test.ts` at 20,000 frames. Equivalence verified
directly: forcing the local ranker at 350k, the post-deletion tree is 12/12
byte-identical to a base tree with the pressure hard-wired to 0.

**One caveat, and it is why LC-31's ceiling hooks are still there**:
`completeNearTailSuffix`'s frame ceiling is the *only* place in the file where a
budget bound could apply **inside** a single node's work rather than between nodes
— the one existing answer to the soft-cap granularity limit (LC-06). Deleting it
would be a conscious choice and nobody has made it.

### Cluster B — stale-verdict re-tests — **TRACK R COMPLETE 2026-08-02**

Both live rows were re-measured under the deadline-margin ruler. **Both held, both
negatively, and both cost a valid run** — the staleness is cleared either way,
which was the point.

| entry | verdict as recorded | current-ruler re-stamp |
|---|---|---|
| SC-05 `HANDOFF_CANDIDATE_POOL = 5` | law arm −1.75 / −1.94, "correctly flat"; the 2026-07-31 pool=7 datum was **+0.4834, SE 0.4142, catalog-sensitivity CI [+0.046, +0.913]** — retired at the sequential boundary with a positive point estimate | **RE-TESTED 2026-08-02 against `deadline-two-anchor-750k` (`dad1e69`, reverted `9c3b03c`): −1.1017, SE 1.2977, P(+) 20.0%, inconclusive; capability −7.32, legacy_regression −4.85, representative +0.60, music +1.16; validity 2111/2112 (−1). The positive point estimate did not survive the new ruler. Flat 5 stands as a CURRENT verdict.** |
| SC-06 `HANDOFF_BRANCHING = 3` | law arm −1.73 "at its optimum"; the flat-4 arm went −1.73 → **+0.74, SE 1.81** after the breadth law (peak at 4, 5 is −2.88), anti-composing with the never-promoted arc-command efficiency law | **RE-TESTED 2026-08-02 (`9a80915`, reverted `884173f`): −1.5932, SE 1.6581, P(+) 17.1%, inconclusive; capability −10.52, legacy_regression +0.97, representative −0.14, music −0.32; validity 2111/2112 (−1). Flat 3 stands as a CURRENT verdict.** |
| SC-20 tail-completion window | law arm −0.86, 750k exactly +0.00 | still the 2026-07-28 session, but see Cluster C: the family's *shape* was re-measured in Phase 3 and the asymptote is correct, so this row is no longer the open question it looked like |
| SC-19 mature reuse extra | law arm −0.32, "correctly capped" | as SC-20 |
| SC-09 `HANDOFF_FORWARD_EVAL_TOP` / `PACE_FULL` brackets | `TOP = 1` +0.89 → −1.07; `PACE_FULL = 1.2` +1.30 → −2.32 | **`PACE_FULL` no longer exists** — the ramp's endpoints are the margin anchors, re-derived from 129,481 observations and bracketed in both directions during the Phase 1a investigation (both at local optima). `HANDOFF_FORWARD_EVAL_TOP = 2` survives as the ramp's narrow end and was re-checked at 3 in the same investigation. **STALE AGAIN as of 2026-08-03 by the rule's own logic**: Phase 3 changed what the margin *is* (the base is the artifact's shape, the live signal ~1.9× tighter), so those brackets were taken on a signal that no longer exists. Nothing is known to be wrong — the corpus derivation on the corrected shape returns 1.30 / 1.90 against the shipped 1.25 / 2.0 — but the brackets no longer support the constants. Re-bracketing is filed, not blocking (§6.4). **DISCHARGED 2026-08-04**: re-bracketed on the corrected signal at 44 × 8 × 750k through `LR_STUDY_DEADLINE_{NO,FULL}_PRESSURE` (SC-26), six pairs, every one a measured null (largest \|t\| = 1.20; best arm 2.5/1.5 = +0.245 ± 0.650; 3.0/1.25 = −0.876 ± 0.729) while engagement walked 15.3% → 60.1%. **The shipped pair stays on evidence, and the finding is that the pre-completion consumers are insensitive to the ramp's engagement rate at 750k** — dormant, not directional. Reopen only ≤ 250k (§6.6). |
| SC-21 shallow-tail throttle | never tested as a law | still untested as a law; the flat-constant arm for the whole family measured −14.6 (Cluster C), which is evidence about the shape, not about this consumer's exponent |

**Evidence**: the audit table (`docs/compiler-improvement-campaign.md:1152-1164`),
the ruler and readiness promotion commits, the 2026-07-31 pool=7 record (§2h) and
the two 2026-08-02 eval artifacts
(`generated/benchmark-v2/eval/cached-N48-2026-08-02T04-16-40Z.*`,
`…T07-45-15Z.*`). **What Track R actually taught**: the stale-sweep rule cuts both
ways. Two verdicts were re-opened because their ruler had moved, and both came back
*more* negative than the stale reading — a stale positive is as likely as a stale
negative, and the re-test is the only way to know. **Coupling**: SC-05 and SC-06
remain the tightest pair (the pool admits from the breadth and the tree expands
from the pool), and neither was re-tested against the other.

**Doc ambiguity, RESOLVED 2026-08-01**: the −1.73 identification (§2h,
discrepancy 12).

### Cluster C — law-ification candidates — **PHASE 3 EXECUTED 2026-08-02**

Twenty-one saturated ramps were, on the canonical grid, constants. Converting them
to scale-free laws is free at the headline **and unmeasurable by the instrument
that decides** — which was the whole tension: a change that is byte-identical at
750k cannot be promoted, and a change that is not byte-identical at 750k is not a
law-ification, it is a new mechanism. The program resolved it by moving the
evidence surface down: golden v1 at {75k, 150k, 225k}, 40 specs × 12 seeds = 1,440
paired compiles per arm, with hash proofs at 250k and 750k for the identity claims.

| group | entries | pinned at | disposition |
|---|---|---|---|
| geometry | GA-01…GA-10 (eleven reads, ~22 constants) | ≤ 250k | **DELETED** `9a3dabd`. 40/40 hashes identical at 250k and 750k, 20/20 changed at 150k; sub-250k pooled −0.18, CI [−2.11, +1.72], zero pass flips. |
| start phase | LC-05 | 100k | **KEPT AND PINNED** `d7c839f`. Deleting it (with OB-03) costs −13.0 / −7.6 / −2.2 at 75k / 150k / 225k and 0 → 236 missing contacts. Scarce-budget completion, not quality trim. |
| objective exponent | OB-03 (`mature` and `scarce` terms) | 250k / 225k | **KEPT AND PINNED** `d7c839f`, same measurement. Its two 150,000 literals were deliberately NOT folded onto `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES`: those are ramp *anchors* in `(B−start)/span`, the maturity constant is a *scale* in `B/(B+scale)`; the values coincide and the meanings never did. |
| maturity family | SC-17 and its consumers | **asymptotic, not saturated** | **MISCLASSIFIED BY THIS MAP — KEPT, with the measurement.** See below. |
| mature-avg / impact-best budget terms | SC-12, SC-13 | 100k / ~~500k~~ | SC-12 untouched (pinned at 100k, still a `smoothstep` computing a constant — filed offender d4). **SC-13's raw-budget term is DELETED `7d7348b`** (offenders d3 + c1): it was the benchmark-point-placed ramp *and* the double count, and the arm now reads the budget once, through slack. Byte-identical at 750k/500k/250k, standing 250k reading PARITY 0/528; the (300k, 500k) sliver was the only binding region. |
| worker timeout | PLB-07 | 571k frames | untouched; identical timeout for 750k…2.25M |

**The maturity family was in the wrong class, and the correction is the finding.**
`maturityPressure = smoothstep(B/(B+150k))` reads 0.684 / 0.865 / **0.926** / 0.953
at 250k / 500k / 750k / 1M — **+35% relative travel across the benchmark's own
grid**. It never pins, so it never belonged in the fake-budget-aware class at all;
listing it there was this map's error. Phase 3 measured what flattening it would
cost rather than assuming the ramp was inert: setting all three live consumers to
their mature value moves 3/20 golden hashes at 750k and 22/176 V2 track hashes, and
on 44 development sources × 4 seeds at 750k reads **596.187 → 581.602, delta
−14.585, validity 176/176 → 175/176**, with the loss concentrated as a **capability
collapse**: `rapid_pickup_frontier` **−55.93** on 8 cells against ±0.3 for thirteen
of the other fourteen families. Verdict: keep the asymptote. The only code change
was truth — the three live consumers were inlining the expression and now call the
helper (byte-identical), and the docstring records the values, the two law arms
that already lost (SC-20 −0.86 with 750k exactly +0.00; SC-19 −0.32) and that a
flat-constant arm would have to be one bundle because the three share the function.
Its fourth consumer was SC-18 and is deleted.

**Evidence**: every saturation point verified arithmetically in §2b, §2c and by
reading the constants; the sub-250k grid and hash proofs are Phase 3's. **Coupling**:
SC-17's consumers still move as one — changing the shared shape moves all three, so
a law replacement has to be per-consumer and a flattening arm has to be a bundle.

**On the geometry group, the three positions were real and the delete won on
evidence**, not on tidiness: byte-identical at every benchmark budget, parity below
it, and it removed the file's only hard threshold. GA-06 was deleted as a mechanism
in the same commit — it was fully off from 100k up and forcing it on measured
−10.59 — and the neighbouring current-era sweeps that made "convert them to live
signals" indefensible still stand (widening GA-10 is −21.93 with 20 lost valid
runs).

### Cluster D — live-adaptation candidates — **ALL FOUR RESOLVED 2026-08-02**

Four, each with the hazard constraints that bound it. The governing caveat across
all of them, recorded from the campaign's own falsifications: **throttle a
magnitude, never trigger a mode.** Feeding a live pace signal to a binary gate
measured −5.38 (capability −33.87) and −8.05 (capability −51.59); re-keying a
*per-decision quality* knob (sample count) on remaining budget measured −0.41,
half-strength −0.26, pre-completion-share 0.60 −4.47. The program added one more
instance of the same rule at the finest resolution it has been measured:
graded rollout-depth pressure at bounded rate is +0.675 in preview and its binary
twin is −6.22 with capability −41.50 (§6.1).

**D1 — the post-completion pacing gap. CLOSED AS A VEIN 2026-08-04** (forward-eval
campaign, mandate iterations 2–4; §6.6 and §1). The third attempt was the one this
entry asked for — a continuous phase weight on the head ramp's pressure, a
magnitude and not a mode (`LR_STUDY_POST_DEADLINE_W`, SC-26) — and it reproduced
the Phase-1a boundary on the corrected margin at the historical grain:
**−0.529 ± 0.188 (t = −2.82)** ungated against the −0.51 the boundary was drawn
on, monotone with no positive dose (w = 0.25 +0.004, w = 0.5 −0.201, w = 1.0
−0.529), validity 352/352 in every arm. **The diagnosis this entry recorded as
"on the table and untested" is now measured and it is the whole answer**: 93.6%
of post-completion pool builds happen inside a repair restart and 95.8% of
post-completion full-pressure builds sit in the last spend decile, so
post-completion "pressure" is the compile running out of budget rather than behind
schedule, and narrowing the rolled head there fights the ROI study's "bigger
ceilings buy acceptance" exactly as predicted. Scoped to `nonrepair` the sign
flips positive (+0.048 ± 0.020, t = 2.37) but moves 25 of 352 cells for ~+0.05
headline and would ship as a lane mode — filed, not shipped. The aim throttle and
the continuation filter stay pre-completion-only, each on its own argument (the
filter's: 37.8% of the verdicts it acts on are false, and post-completion there is
an incumbent to protect). *The pre-program statement of the gap follows, kept
because the arithmetic is still what makes the lane look attractive.* The
gap is unchanged: **46.3% of a 750k budget — and 54.6% of a 2.25M one — runs with
no consumer acting on the deadline signal**, and a large share of the forward-eval
rollouts runs inside it (post-completion verdicts are also the *less* reliable
ones: 39.9% verified-true against 49.9% pre-completion, §6.5). What changed is that a signal now *exists*
there (SLK-05 is live for the whole compile and observable), and that two attempts
to consume it have been made and both are closed: **uniform post-completion
pressure** measured ≈ −0.5 per cell over 225 of its 245 changed tracks and brought
a new cross-state pool-cache exposure class (764 reads at 150k, 540 at 750k) that
Phase 0a's zero could not have predicted; **post-completion rollout-depth
pressure** — the cost-side shape, no cache key needed — measured **−0.018 over 194
changed tracks**, i.e. repair reinvests the freed frames at exactly unchanged
yield. The diagnosis on the table is in the 1b design note and is untested: inside
a repair episode the margin's numerator is the *compile's* remaining budget while
its denominator is the *attempt's* work, so late episodes read full pressure by
arithmetic rather than by evidence, and narrowing a repair rollout fights the ROI
study's "bigger ceilings buy acceptance". *Evidence*: `docs/repair-roi-study.md`
§Phase allocation; the two arms above. **The often-quoted "rollouts are 54%/46% of
all sim frames" is now measured and it is wrong**: rollout + start-eval frames are
**29.1% / 27.7% / 20.5%** of charged sim frames at 150k / 250k / 750k on a
198-cell instrumented grid, and 34.7% / 32.4% / 29.4% at 250k / 500k / 750k across
3,648 archived compiles — the old figure predated the ballistic cutover
(`docs/rollout-economics-study.md` §1.1). *Constraint*: still a **new** mechanism,
not a migration, and the two obvious shapes are spent. *And the cost side of this
lane is now capped*: refunding **every** rollout frame at 750k is worth
**+1.78 ± 1.31 per cell**, so no speed-up of forward evaluation, however total,
can be worth more than that at the production budget (§6.5).

**D2 — replacing the pre-completion pace signal. EXECUTED as Phase 1a
(`4325370`), promoted at a documented cost of −0.28.** Everything below is the
pre-program statement of the question; the answers are §4 and §6.4. Two of its
three open items were answered as asked: the signal-vs-signal comparison was run
(Phase 0b — the margin false-alarms on 1.2% of healthy 150k compiles at 100%
recall where `pacedSlack < 1` false-alarms on 92.6%, and wins 3–25× on remaining
work at every budget), and the ramp constants were re-derived in margin units
rather than carried across. The third — that the consumers operate at budgets
where the estimator is `extrapolated_policy_budget` — was answered by *contract*:
policy consumes the raw point ratio at every budget and the applicability nulling
stays a statement about what the recorder may claim. The coupling warning held
exactly: SC-09, GA-15 and SC-16 moved in one candidate. One caveat the swap did
not honour at the time: "the ramp constants are not in the margin's units" was
answered by re-deriving them on the *artifact-shaped* margin while the shipped
base was V1-shaped. **Phase 3 closed that gap from the other side** — the base is
artifact-shaped now, so the anchors and the signal are one quantity (§6.4).

*Pre-program statement follows.* `pacedSlack` blends a
250k-fitted regression with a naive `spent·totalGaps/deepestGap` extrapolation;
`hard_completion_margin` is definitionally the same ratio, calibrated and
path-backed. SC-09 already has the accepted shape (a continuous ramp) and the
accepted role (deadline pressure), so this is a one-input swap. *A correction from
review*: the estimator's pre-first-completion accuracy is NOT the gap — after the
tail-reach coverage fix the path-free stratum is almost exclusively pre-terminal
initial-attempt observations, and the shipped artifact's held-out path-free error
is 7.4/5.5/4.2% at 300k/750k/1.5M with per-stratum interval coverage
(`docs/compile-budget-telemetry.md` §Validation Evidence). *Missing, and it is the
actual crux, twice over*: (i) SC-09/GA-15/SC-16 operate at **every** budget,
including 150k probes and low-budget studies where the estimator is
`extrapolated_policy_budget` — the swap would put an uncalibrated signal in charge
exactly where deadline pressure bites hardest; (ii) **no signal-vs-signal
comparison has ever been run** — an accurate estimate is not automatically the
better *decision* signal at the ramp's operating range, and margin-vs-`pacedSlack`
against realized outcomes on the same compiles is unmeasured. *Hazards*: the ramp
constants 1.5/1.0 are calibrated to `pacedSlack`'s scale
and are not in the margin's units (the 30× vs 1.9× span warning); wiring telemetry
into policy breaks `budget_telemetry.ts`'s stated non-policy invariant. *Coupling*:
SC-09, GA-15 and SC-16 must move together or not at all — they are three
definitions of "behind" on one compile, and SLK-04 is the producer of two of them.
*Also note*: `observedTraversalBudgetSlack` **needs V1 to be stale to work** — its
blend corrects a structural prior toward the compile's own measured pace, and a
law-based prior would already encode the controller's spend, leaving nothing
independent to correct toward.

**D3 — the mode-trigger → throttle upgrade. EXECUTED in the same candidate.**
GA-15 is now a two-level throttle: at full deadline pressure the lane keeps
`max(1, round(0.4·K))` bases — 2 of 5, the rolled head's own retention — instead of
being switched off. The hazard was handled by staying binary in *cache* terms
(exactly two lane states, the same exposure Phase 0a measured at zero cross-state
reads over 895,457 frozen-content reads); continuous gradation of `K` is still
deferred behind a pool-memo key fix, whose patch exists and is unshipped. Phase 1a
re-measured the exposure on the shipped scope: **3 reads at 150k and 2 at 750k**,
254–370× below the full bundle's. The pre-program statement of the question
follows.

*Pre-program statement.* GA-15 kills the *entire* aim lane at
`pacedSlack < 1.0`, where its sibling SC-09 uses a ramp over [1.0, 1.5]. The
magnitude form is already present and unused: throttle `K` (GA-12) toward 1 instead
of switching the lane off. *Hazard, and it is hard*: `K` feeds
`getCandidatesSorted` → the per-node `_candidatesCache`, which is keyed on
`(seed, nCand)` only. A graded `K` makes H2 strictly worse (more distinct pool
contents per node). *Prerequisite*: answer H2's open question first — **does any
node ever get re-read across a pace transition?** If the count is zero the hazard is
theoretical and closable with a test; if not, it is a measurable source of the
cumulative-drift signature. That measurement is the single best-value item this map
suggests. *The safe-pattern existence proof is GA-16*: a live signal that changes
only *cost*, never *what is produced*, needs no cache-key change. Hold every live
proposal here to that test.

**D4 — repair selection. CLOSED by measurement, `1e22721`.** The Phase 2 replay
study scored seven selection policies against 3,520 archived compiles with a paired
cluster bootstrap and issued no admission ticket. Ceiling-exclusion is dead by
measurement (**0 of 320,092 gaps sit at their `weakAxisCeiling`**);
scorer-weighted ranking is a near-tautology (pooled RMS `axis_quality` makes raw
SSE its exact marginal ranking, diverging only on the 12 amplitude sources);
SSE-per-frame is **harmful where allocation binds** (150k decision-1 −1.44, CI
excluding zero) and its 750k figure is a fallback-credit artifact. The decisive
finding: **the 18.6% zero-yield pool is not convertible by reranking** — an
independent-coin-flip model over (ordinal, local-budget) cells reproduces it
exactly (19.1% modelled against 18.6% observed, overdispersion 1.30). It is
acceptance variance, not selection error, so there is no population for a ranking
to route around. Anchor identity is second-order (≤1.5× gain span) against attempt
ordinal (3–10×). What shipped instead is the affordability change (LC-19) and the
three telemetry fields the study proved necessary (LC-30). The remaining lane was
acceptance *prediction*, which targets `p` — exactly what the independence finding
says the zero-yield pool is made of — and it needs a compile-level signal, so it is
its own proposal.

**That lane now has its second null, and this one closes on economics rather than
on fit (dividends Track P, 2026-08-03).** The obvious compile-level signal is the
deadline margin's own trajectory, and it does not predict acceptance: no covariate
clears both held-out lift and a Holm-corrected p; the five candidates are one
variable (|r| 0.93–0.98); the best trace-750k lifts (+0.0034 to +0.0045 nats, Holm
p 0.20–0.46) fail to replicate on the 5.4×-larger canonical corpus, where every
lift is *negative*; and the whole set is dwarfed by the attempt ordinal at
0.0148–0.0233 nats per attempt, the only validated acceptance variable. But the
statistics are not what closes it. **A perfect oracle** — flag every zero-yield
compile ex ante and redirect 100% of its repair frames at the observed ordinal≥2
marginal rate of 0.0077 pts/kf — **is worth +0.45 to +0.48 points per compile,
and that is the whole ceiling of the lane**; every reachable policy is negative
(skip the worst-predicted 5 / 10 / 20 / 30% → **−0.046 / −0.136 / −0.354 /
−0.616**), because the enrichment is real (1.7–2×) and useless: the flagged
compiles are already the ones spending the least. And **the stratification is the
null model's own mediator** — the 3× spread in zero-yield across
`firstCompletionFrac` quintiles (10.4% → 31.0%) is 80–85% reproduced by the
(ordinal × local-budget) coin-flip cell model already on record, with the residual
tracking attempt *count* (observed/model 1.22 at one attempt, 0.59–0.81 at three
or more). The margin trajectory tells you how many coin flips get tossed, not how
they land. Two by-products: local budget makes held-out loss *worse* once ordinal
is in, and the new round index is a worse partition than the ordinal (0.6758
against 0.6693). **Do not re-open this on a better feature** — the ceiling is the
problem. The pre-program statement follows.

The sizing axis is closed: candidate A measured **+0.01
at N=48/750k**, a perfect tighter ceiling is bounded at +0.26, and 12.2% of repair
spend is beyond-ceiling slop that no sizing formula can reclaim because the ceiling
is only tested at node boundaries. The **selection** axis had never been evaluated:
`pickFeasibleWeakGap` (LC-16) ranks by raw axis-SSE and calls itself "v1, a proxy
for true upstream blame", while 18.6% of 750k compiles spend their whole repair
allocation for exactly zero gain. *Concretely testable with no new telemetry*: rank
by scorer-weighted axis error rather than raw SSE (the register's comparator is
`axis_quality`); rank by SSE **per estimated frame** (tail anchors are 3× cheaper at
similar acceptance, so worst-first buys the expensive end first); exclude gaps whose
axis error is already at its `weakAxisCeiling`. *Hazards*: LC-22 — `restartCounter`
advances per attempt, so **any** change to the attempt sequence re-seeds every
downstream restart; repair A/Bs are never local perturbations. *Missing*: two
additive observation fields (`up` and the round index on `startAttempt`) would make
LC-18's `maxUpstream` and `upstreamOrder` priceable at all; and the resumed phase's
`endActive` is called without an outcome object, so the repair-vs-resumed split has
a numerator on one side only.

### Cluster E — do not touch

**E1 — `TRAVERSAL_BUDGET_MODEL_V1` (SLK-01), the difficulty yardstick.** Anyone
arriving with "V1 is 80% wrong at 2.25M, replace it with the budget law" is correct
about the error and wrong about the fix. The full argument: (i) the law is a *spend*
model and `budget_slack` needs a *difficulty* model — substituting collapses the
live coordinate from a 30× span to 1.9× and newly trips the 1.5 branch threshold on
112 of 352 compiles at 300k; (ii) `budget-control-design.md`'s non-circularity
requirement forbids `D(spec)` from being future production spend, and `α = 0.82`
*is* a measurement of what this controller chooses to spend; (iii) **the live pace
blend requires V1's staleness** — `observedTraversalBudgetSlack` corrected a
structural prior toward the compile's own measured pace, and a law-based prior would
have nothing independent to correct toward. *(iii) is now scoped: it holds for the
DIFFICULTY coordinate, which is what it was measured on. It does **not** transfer
to the deadline margin. That signal did inherit a V1-shaped prior by accident, and
Phase 3 measured the inheritance out on 2026-08-03 — the artifact-shaped base
gained +52.89 / +26.85 on two canonical capability groups with zero completions
lost (§4, §6.4). Staleness bought a wider margin there, not more information; the
independent correction the architecture wants is the pace term, which survives.*
The legitimate open work is a
reference-policy recalibration producing a versioned
`reference-policy/v1 + contacts+duration/v2`, which changes `D`'s shape without
making it budget-dependent — and that is a stale-sweep bomb, because it moves all
four slack thresholds (1.5, 2.5, 2.75, 10) at once. The correctly-layered pattern
already exists: **shape from V1, budget scaling from the law, slack from raw V1.**

**E2 — the comparability hazard set (H1–H9, §4).** Nine invariants that keep the
compiler deterministic in `(spec, seed, budget)`. H2 is already violated in spirit
and shipped; the rest are intact.

**E3 — `observedTraversalBudgetSlack` (SLK-04) as the reference implementation.**
**The code is deleted (`4325370`); the entry is why, and the architecture is still
shipped.** No fitted constants at all — the blend weight *is* the spend fraction.
Exactly the structural predictor when nothing has been observed, the compile's own
measured pace once there is evidence, no threshold anywhere. Accepted at **+10.66,
N=24, SE 1.98, CI [+5.13, +16.19]**, every stratum non-negative, monotone in budget
(250k −0.47, 500k +10.33, 750k +18.63); the aim-lane extension was +6.97. Its
replacement kept the architecture and changed the parts: an accurate base, a
work-weighted progress fraction instead of a gap-count one, and a geometric blend —
and the pace-**free** form of that replacement broke the capability stratum outright
(`frontier_dense_recovery` 0/4 valid at 750k, suite −21.6), which is this entry's
warning being paid, live, in the one experiment that removed it. Build new live
mechanisms by widening SLK-05's consumer set, not by adding a second live signal.

**E4 — the register (OB-18) and the reset registry (OB-21).** Monotonicity and tie
stability are what make an anytime compile's output well-defined at all. A
budget-aware selection rule ("prefer a safer leaf when margin is short") must not
be built here.

**E5 — `LC-07` capture placement and `LC-22` restart seeding.** Both are
byte-identity anchors with comments stating so.

---

## 8. Discrepancy ledger

Found by the survey, not fixed by it (row 17 is later — it was found by the
dividends campaign; row 18 later still — found by this document's 2026-08-04
reconciliation to the forward-eval campaign). Rows a program has since closed are
stamped **CLOSED** with the commit; the rest stand.

| # | discrepancy | evidence | consequence |
|---|---|---|---|
| 1 | `aim.ts:742-745` documents the air-matched variant as first-base-only and records that per-base emission at K=4–6 "priced out mature budgets"; `node.ts:272` emits per base | verified §2j; flipped in `d5731e5` | the doc describes the opposite of shipped behaviour at every benchmark budget. Either the finding was superseded by the K-law measurement and the docstring should say so, or the flip rode along uncontrolled inside a commit whose headline change was the exponent — which changes how GA-12's measured delta should be read. |
| 2 | `repairConfig`'s `mainMargin` comment says the default "eases from 1.0 at the 100k repair gate to 1.1 by 200k" | `defaultRepairMainMargin()` took no arguments and returned a flat `1.0` | **CLOSED `d7c839f`**: comment rewritten to say the value is flat and that no such ramp has existed since it went flat; `defaultRepairMainMargin` itself is gone with the constant renamed `REPAIR_MAIN_MARGIN`. |
| 3 | `LR_REPAIR_MAX_ATTEMPTS = 64`'s comment ("1M affords ~30-40 restarts; 16 plateaued at 698; 64 → 706.6") | max restarts observed anywhere is 17; 0 of 3,696 compiles reach the cap; `64 → 160` re-measured byte-identical | **CLOSED `d7c839f`**: re-documented as NEVER BINDING with those numbers and an explicit do-not-re-sweep — it is a runaway guard, not an allocation. |
| 4 | three prose references still describe `objectiveBlendReadinessPowerForSpec` as live | `objective.ts:76`, `objective.ts:617`, `objective_control.ts:19`; production call site deleted 2026-07-28 | **CLOSED `d7c839f`**: the function is deleted and all three references with it. |
| 5 | `docs/repair-roi-study.md` prices `mainMargin` with `first_terminal_total_spent_frames / policy_budget`, while the knob it prices multiplies `firstCompletionFrame` | verified §2a: two archive fields named `first_completion_frame` hold two different quantities | **the effect is currently null**: 2,414 archive rows across 250k/500k/750k carry both counters and **0 diverge**, so the study's phase split is not mis-computed at any measured budget. The correction note is about the *identity*, not the numbers: the study should say which counter it used, and re-price against `firstCompletionFrame` if it is ever run at a budget where the two can separate. ~~**UNVERIFIED below 250k.**~~ **STRENGTHENED 2026-08-04**: the two counters are now equal in **4,406 of 4,406** compiles across both N=48 archives and every probe grid, *and* the comparator says why (`contract_passed` ranks first and a structural terminal passes it by construction, so the first terminal always improves — §2a). The identity correction still stands as documentation hygiene; the numbers cannot separate while the comparator has that shape, so the "re-price at a budget where they diverge" clause is now hypothetical rather than pending. |
| 6 | scale-contract violation, by design and documented as such | `IMPACT_BEST_FWD_START_FRAMES = 300_000` exists so "the charge-bounded completion knee stays byte-identical by construction" at 250k (§2i) | **CLOSED 2026-08-04**: the offender is deleted (d3/c1 removal, forward-eval-value campaign). The knee is protected by the slack coordinate alone (max slack at 250k = 2.249 < 2.5 on all 44 sources); benchmark surface byte-identical, standing 250k reading PARITY. Off-surface (short specs with slack > 2.5 below 300k) the arm now opens on its own coordinate — the intended scale-contract behaviour. |
| 7 | further benchmark-identity literals | `M132/M144/M165 = 200_000` and `M152_CANYON = 250_000` (SC-02); `targetBudget >= 500000` (SC-23, probe-gated, written without the file's numeric separator) | **CLOSED `f7d054f` + `d7c839f`**: the four case-named min-budget constants are deleted with their rules; SC-23's literal now uses the file's separator and stays as a probe hook. `HANDOFF_QUALITY_N_CAND = 32` is the sole gate left on that path. |
| 8 | unpriced dormant hooks | `policyBudget` (LC-02): zero live callers, zero evaluations, empty commit body, and the phase it opens (the resumed frontier) has **no measured numerator** — `endActive` is called without an outcome object, so `accepted_score_delta`, `accepted_improvement` and `first_accepted_improvement_offset_frames` are `null` for every resumed attempt. `LC-31`: two live-budget parameters wired to `Infinity`. `SC-11` `forwardStageTop`: default 0, and turning it on measured **+0.10 SE 0.24**, the cleanest null in the campaign. | three mechanisms that look like control surfaces and are not |
| 9 | `compile_stats.repair.restarts` undercounts by one whenever capture fires inside the last restart | 168/352 compiles at 750k; `budgetTelemetry.attempts` is the complete record | do not use `stats.repair` as the repair ledger |
| 10 | `objectiveLayerSpreadStat()` is spread twice into the same stats object | `handoff.ts:1635-1636` | harmless; a visible copy-paste artifact |
| 11 | two surveys stated the pace prune shallows the tail unconditionally | `:5464-5466` shallows only when `resolved.variant === "greedy"` (§2, additional checks) | `avg` and `best` upgrades (SC-12/13/14) keep full depth in the pruned tail and in the pre-completion low-slack phase; the prune saves less than documented |
| 12 | the campaign doc reports **−1.73** for two different arms | `:1161` (budget-law arm on `HANDOFF_BRANCHING`) and `:976` ("then" value of the flat-4 arm under `span-handover`) | **RESOLVED 2026-08-01, then SETTLED by measurement 2026-08-02**: two distinct measurements sharing a value by coincidence. The law arm's −1.73 is the July audit (sqrt-era ruler); the flat-4 arm read **+0.74, SE 1.81** under the linear law. Track R re-ran flat-4 under the deadline-margin ruler: **−1.5932, SE 1.6581, inconclusive, capability −10.52, one validity loss** (`9a80915`, reverted `884173f`). Flat 3 is current, not stale. |
| 13 | snapshot-resume silently disables repair, nowhere stated | `:1352` gives `startOptions = []`, `:1476` requires `startOptions.length > 0` | the checkpoint/resume study arm and the production arm run structurally different compilers past first completion. Any study comparing a resumed suffix against a from-scratch run at the same budget is comparing two allocators. |
| 14 | production runs at an operating point no evidence covers | all three live `select.json` carry `budget: 1000000`; the promotion gate is 750k only; the breadth law gives 108 candidates/gap at 1M | **CLOSED as a coverage gap `cbf7321` 2026-08-03, and it left three smaller ones.** The 1M validation panel (176 trace compiles + a same-head 750k companion, 393M frames, exit 0) found **zero accounting violations**, the estimator healthy from the interior (99.5% calibrated, 3.0% combined APE, coverage 94.6%) and the laws holding at a budget they never saw (paired fc ratio 1.2549 vs 1.2657 predicted, implied exponent 0.789; phase shares on the log interpolation to 0.1pp; ROI spend side inside 0.4%). Score dividend **+2.94 ± 2.03 per cell**. What replaces it: **1M is not monotone per source** — 67 of 176 cells score *worse* than the same seed at 750k, p10 −8.8 — and production ships one seed of one spec; **music-backed sources take half the dividend** (+1.57); and **production's three specs are in no manifest at any budget**. See `docs/budget-law-study.md`. |
| 15 | the documented budget-overrun figure understates the measured one by ~2.4× | `docs/compile-budget-telemetry.md:44-46` reports "a 50-compile sample from the 2026-08-01 campaign, median overrun **0.93%** of the hard budget, p90 5.1%". Measured here over the full 750k N=48 baseline (2,112 rows): median **+2.25%**, p90 **+5.22%**, 100% overran, max +16.3%. | the p90s agree, the medians do not; the 50-compile sample is not representative of the median. The qualitative statement ("a positive `hard_overrun_frames` is the ordinary case") is right and the number should be restated from the full archive. |
| 16 | one survey figure that could not be sourced | two surveys state "61–71% of a mature budget is spent after first completion"; `docs/repair-roi-study.md` §Phase allocation measures post-completion at **46.0%/46.3% at 750k**, 53.0% at 1.5M, 54.6% at 2.25M | the qualitative point (the majority-adjacent share of a mature budget is unpaced) survives; the number does not. Corrected throughout this map. |
| 17 | `docs/rollout-economics-study.md` §4.2's pooled row transposes its two columns | the three per-budget `verified TRUE` counts sum to **14,703 = 46.7%**, the refutation ladder's own "never (verdict true)" row reads **14,703**, its refuted column sums to **16,791 = 53.3%**, and the stratum table reweights to 46.7% true — but the `all` row prints 16,791 (53.3%) under TRUE and 46.7% under FALSE, and the section heading, the lane table and two commit messages inherit it | **the verdicts are worse than the campaign claimed, not better**: 53.3% false on the study's grid, 51.3% on the post-Phase-3 re-probe, against a claimed 46.7%. No conclusion flips — every lane ranking and the L1 accept were argued on the terrain split and the refutation curve, both of which are unaffected — but the study's headline number should be restated and its footnote (which offers a bad explanation for the mismatch) deleted. **The shipped `HANDOFF_ROLLOUT_REDRAW_ON_EMPTY` docstring is correct**: it quotes the re-probe's 51.3% false / 54.4% / 47.3%, which are internally consistent. **DONE `016dfbe`**: the study carries the correction note at `docs/rollout-economics-study.md:396-405` and the headline is restated. Residue cleared 2026-08-03: two further "46.7% FALSE" occurrences at `:629` and `:724`. |
| 18 | two source docstrings still describe the two-counters window as a LIVE phase gap, after it was falsified | `types.ts:804-810` ("the two frames below bracket a window in which the estimator's target event has happened while the controller still presses as pre-completion") and `handoff.ts:1835-1847` ("in the window that opens the estimator's target event has already happened … while the controller is still pressing as pre-completion. This counter is how often that happens"). Measured 2026-08-04: the window is empty in **4,406 of 4,406** compiles and the comparator says it must be (§2a). `docs/forward-eval-metrics.md:339` carries the corrected wording — "a subsequent-terminal churn measure, NOT a phase-flip gap" — and the two source comments were not updated with it | **found by this reconciliation, 2026-08-04, and left honest rather than silently fixed** (this pass owns no source file). The counter is correct and useful; only its stated *meaning* is stale, and it is stale in the two places a reader most likely to act on it will look. Anyone editing `deadline_terminal_without_improvement` should re-stamp both docstrings to the metrics doc's wording. No number anywhere depends on the stale reading — the lever it described was never built. |

---

## 9. Catalog

Uniform schema per entry:

```
ID  name
    location · signal → role · class · adaptivity · binds-in-live-range
    body: shape, constants, provenance, interactions, verification status
```

`binds` means: can this mechanism change behaviour at a budget the system actually
runs (250k–1M)? Territory prefixes are preserved from the source surveys.

**Entries the unification program deleted are still listed, prefixed `RETIRED ·`
with the deleting commit.** The per-territory counts in the section headings count
listed entries, not live ones; §3 has the live census. A retired entry's body is
kept in its original tense where it is history and updated where the surrounding
mechanism is still live — the point of keeping it is that the reason a mechanism
was deleted is the reason not to rebuild it.

### SC — search core (`handoff.ts` generation, ranking, forward evaluation) · 26

**SC-01 `budgetAwareQualitySampleCount` — the per-gap breadth law**
`handoff.ts:4960-4967`, constants `:932-938`; entry points `:4831`, `:4846`; → `policy.nCand` → `expandNode:3301` → `getCandidatesSorted:3833` · `policyBudget`, per-compile → **generation** · **LAW** · static · **binds**
`max(8, round(27·B/250_000))`, no ceiling: 8/16/27/32/54/81/108/324 at 69k/150k/250k/300k/500k/750k/1M/3M. Floor binds below B = 69,444; base ≥ 32 at B ≥ 291,667, which is what killed SC-02. Shipped `c7f1518` 2026-07-28 at sqrt/24 (N=24 +1.24, SE 0.27, predicted the unfitted 500k rung); both parameters refitted `97ad150` 2026-07-29 (anchor bracketed 21 −8.0 / 24 0 / **27 +7.0** / 30 −8.5; exponent 0.70 +6.25 / 0.85 +6.84 / **1.00 +7.44** / 1.20 +6.81; combined N=24 +5.57, SE 1.45). Shares its 250k anchor and its exponent with GA-12 by design. Antagonises SC-05/SC-06: at 750k the search generates 81, admits 5, expands 3. VERIFIED (§2c, §2d).
**RE-CONFIRMED AT THE PROMOTING BUDGET, POST-PROMOTION, 2026-08-04** (`7d90184`): the depth-1 base swap (SC-25) changed what a rollout costs around this constant, which is a stale-sweep licence, so the law's *output* was walked at a fixed budget through `LR_STUDY_NCAND_SCALE` (SC-26; a multiplier, never a re-fit — a scale applied at one budget IS a per-budget constant and this repo does not ship those). 44 sources × 8 seeds × 750k, nCand 57/69/81/93/105: **0.70× −2.276 ± 0.708 (t = −3.21)**, 0.85× −3.130 ± 1.700, **1.0× shipped**, 1.15× −0.142 ± 0.739, 1.30× −1.169 ± 1.471. 1.0 is the local optimum and the curve is asymmetric — narrowing is the only \|t\| > 2 reading on the panel and every stratum is negative; both off-1.0 widenings also cost a completion the shipped law keeps (`frontier_pickup_progression_shifted`, base arm 352/352 valid). The mechanism is the trade this entry already names: extra per-gap breadth is paid for in tree depth (nodes expanded 209 → 163 across the walk) and the frontier sources need the tree. **Licence discharged; no cross-budget re-fit indicated.**

**SC-02 `qualityBreadth` + `QUALITY_BREADTH_RULES` — the law's scarce-budget breadth floor** *(HALF RETIRED, AND RE-CLASSIFIED, `f7d054f`)*
dispatcher + a **two**-rule table · `policyBudget` × authored target profile → **generation** · live below B = 291,667 · static · **never binds ≥ 292k**
Was six named spec signatures with flat overrides (28/32/34/34/40/48). **RETIRED**: the four benchmark-case rules (`M165_DRUM_GRAIN` 40, `M132_DENSE_LOW_AIR` 34, `M144_RESIDUAL` 28 behind 200_000; `M152_CANYON` 36 behind 250_000) with their four min-budget constants, four nCand constants, four matcher predicates and four env kill-switches. Their gates put them out of reach below 200,000, so the only tier in the grid where they could fire at all was 225k — and at 225k deleting the *entire* table (a strict superset) measured **+0.008 mean score per run, suite +2.84, 18 → 15 missing contacts**. They were buying nothing at the one budget they could reach.
**KEPT, and this map's DEAD classification of them was wrong**: the two surviving rules carry no min-budget gate and broad predicates (air range ≥ 0.50 or speed range ≥ 0.40 → 32; ≤ 32 contacts with no amplitude → 34). Below B = 291,667, where the law returns under 32 and its floor of 8 starts binding, they are the law's scarce-budget breadth FLOOR across most of the suite. Deleting the whole table measured **−7.70 mean score per run at 75k** (suite −19.78, 24 new missing contacts) and **−1.53 at 150k**. Unreachable at B ≥ 291,667 via the `base >= 32` early return either way. The follow-up the docstring records: the real question is whether `HANDOFF_QUALITY_N_CAND_FLOOR = 8` is too low — a bracket on the law's floor, not a per-spec question.

**SC-03 `HANDOFF_QUALITY_N_CAND_FLOOR` — the low-end saturation**
`:938`, applied `:4961-4966` · `policyBudget` → **generation** · **saturated (floor)** · static · never binds
`8`. Shipped with the law, never bracketed. Binds below B = 69,444, adjacent by coincidence to SC-08's 75k gate: below ~70k the compiler simultaneously floors breadth and (below 75k) switches off forward eval. At the floor the admission ratio inverts from 5-of-81 to 5-of-8, a qualitatively different search. **Still unmeasured at the promoting surface, and now provably unmeasurable there** — nominated as a probe by the unification follow-up register, the dividends Track P and the forward-eval campaign's own re-bracket list; the constant has not moved since `c7f1518`. `7d90184` closed it as *untestable above ~69k on arithmetic* rather than leaving it parked a fourth time: `round(27B/250k) < 8 ⟺ B < 69,444`, a factor of ten under the promoting budget and still a factor of seven under it at the widest study scale the breadth knob admits (0.5×), so no 750k panel can move it. Pinned by a test (`tests/handoff_policy.test.ts`, "the breadth floor cannot bind at any promoted budget": > 8 at 250k/500k/750k/1.5M with and without the 0.5× scale, exactly 8 at 69,444 and 69,445). A bracket on the floor is a low-budget-reading question, permanently. Its one new neighbour: SC-24's re-draw writes memo widths 2 and 4, which are below this floor **by construction**, which is what keeps the two from colliding at any budget. *(Anchor drift: the constant sits at `:1149` at HEAD, not `:938`; the floor is applied inside `handoffSampleCount:5415`.)*

**SC-04 `LR_QUALITY_NCAND` override**
`:4839-4844` · env → **generation** · study-hook · static · n/a
`Math.min(64, n)`; short-circuits both sample-count entry points, bypassing SC-01 and SC-02. The 64 cap would silently clip a legitimate 750k law value of 81 if a study ever set it. **That cap is why SC-26's `LR_STUDY_NCAND_SCALE` had to exist**: the law already returns 81 at 750k, so the whole neighbourhood of the promoting budget is out of this knob's reach and the breadth re-bracket could not have been run through it.

**SC-05 `HANDOFF_CANDIDATE_POOL` — the admitted pool**
`:826`; `handoffCandidatePool():4590`; `admittedHandoffPool:3789`; applied `:3844` · none (literal) → **selection** · **flat-by-verdict** · static · binds
`5`. Journey 8 → 5 (`e3fe45e`, N=24 +4.18/+3.32, every stratum and budget positive, capability +15.03) → 7 (`5db6c79`) → 5 (`e5789ad`, both 2026-07-31). Budget-law arms refuted: −1.75 sqrt, −1.94 quarter-power. 2026-07-31 re-test: **+0.4834, SE 0.4142, P 87.55% < required 97.23%**, catalog-sensitivity CI excluding zero (§2h). **Track R re-test under the deadline-margin ruler, 2026-08-02 (`dad1e69`, reverted `9c3b03c`): −1.1017, SE 1.2977, P(+) 20.0%, inconclusive; capability −7.32, legacy_regression −4.85, representative +0.60, development_music +1.16; validity 2111/2112. Flat 5 is now a CURRENT verdict, not a stale one — and the positive point estimate did not survive.** Caps SC-09's domain (the paced head can only travel 5 → 2), sets `extraRankBase`, bounds `stageTop`. Every admitted candidate pays a charged simulation, so pool size is a spend knob, not a free ordering signal. The single most re-measured constant on the path. **No longer a one-constant re-test since `05cc801`**: `handoff.ts` throws at module load unless `AIM_LANE_DEADLINE_BASE_SHARE === HANDOFF_FORWARD_EVAL_TOP / HANDOFF_CANDIDATE_POOL`, so any arm that moves this constant must move the aim lane's share with it (or deliberately re-derive both) — the same-share rule is machine-enforced, not a convention. **A study reader exists since `916d5db`** (`LR_STUDY_HANDOFF_POOL`, integer [3, 8], refuses rather than clamps, `handoff.ts:4923-4936`, SC-26) and it deliberately does NOT move the aim share, so an arm run through it splits the two same-share consumers for its duration — measured to be nearly nothing (full deadline pressure is 0.40% of pre-completion pool builds at 750k, exactly 0 at ≥ 1.5M) but a real divergence that every such arm states. **What it was built for and what it found**: the W = 6 rollout-width cliff is NOT the admitted pool showing through — moving the pool across {5, 6, 7} leaves the cliff absolutely in place (W6 − W5 ≈ −28 to −31, t ≈ −5, 35/36 cells), which falsified "width ≤ admitted pool is a structural law" and redirected the diagnosis onto the max-over-W reducer's optimism bias (§6.6).

**SC-06 `HANDOFF_BRANCHING` — tree width**
`:867`; terminal slice `:4220-4226`; policy-mediated slice `:3389`; gates `stagedForwardEval:3896` · none → **selection** · **flat-by-verdict** · static · binds
`3`. Bracketed 2 → −8.16 (validity 1042→1020), 4 → −4.32. Law arm −1.73. Then the flat-4 arm went −1.73 → **+0.74** after breadth doubled (SE 1.81, anti-composes with the efficiency law at −1.76, not promoted). **Track R re-test under the deadline-margin ruler, 2026-08-02 (`9a80915`, reverted `884173f`): −1.5932, SE 1.6581, P(+) 17.1%, inconclusive; capability −10.52, legacy_regression +0.97, representative −0.14, development_music −0.32; validity 2111/2112. Flat 3 is a CURRENT verdict.** The kinematic-support carve-out reserves the third slot, so effective non-kinematic width is 2 on those nodes. `rankedOptions` truncates to 3 *before* `policy.branchLimit` applies, so a `branchLimit` above 3 is unreachable. See discrepancy 12.

**SC-07 `lowSlackTraversalBranchLimit`**
`:4792-4797`, constant `:868`, wired `:4779` → `:3389` · `budgetSlack` (frozen) + `hasCompletion` (live) → **deadline-pressure** · **threshold** · partially-live · **never binds**
Width 3 → 2 when `budgetSlack < 1.5` and no completion. Measured: 0% of rows at 500k/750k, 9.1% at 250k, 100% at 150k (§2d). Its own budget-law arm measured **+0.00 — "the gate never binds"**. Shares the literal 1.5 with SC-10 (same signal); it used to share it numerically with SC-09's `PACE_START` on a different quantity, and that trap is gone with the pace constants (`4325370`).

**SC-08 `usesForwardEvalAtBudget` / `forwardEvalMinBudget` — the 75k gate**
`:6385`, `:5937-5945`, runtime `:5820`; consumed `:3899`, `:3924`, `:4105`, `:4348`, `:5455` · `targetBudget` → **lookahead-spend** · **threshold** · static · never binds (always true in range)
`75_000`, env-overridable. This is the largest structural fact on the path: when true, `scoreCandidateForHandoff` returns at `:5455-5483` before the local-proxy branch, so `previewNextContact`, `DEAD_END_PENALTY`, `SURVIVOR_SCARCITY_PENALTY`, `PREVIEW_COST_WEIGHT`, `handoffStatePenalty`, `candidateOvershootPenalty`, `candidateReleaseSetupPenalty` are all unreachable in production (SC-18, the sixth reader, is deleted). The branch itself SURVIVES as the `LR_FWD_EVAL=off` escape hatch and now carries an explicit do-not-tune-and-do-not-re-budget-shape. No bracket recorded for the threshold value; 75k–150k is an untested regime. VERIFIED.

**SC-09 `forwardEvalTop` — the deadline-paced rolled head** ★ the live mechanism
`forwardEvalTop:3839-3843`, applied in `rankedOptions`, ramp in `optimizer/deadline.ts` · **the deadline margin, live per node** → **deadline-pressure** · **LIVE-ADAPTIVE** · live · binds
`pressure = deadlinePressure(margin)` over [1.25, 2.0]; `forwardEvalTop = round(pool + (2 − pool)·pressure)`, so 5 → 2. The canonical "throttle magnitude, not trigger a mode" form. `TOP = 2` from `b1a488a` 2026-07-28: flat top-2 alone +9.86 but `representative` −10.31 / `legacy_regression` −19.12; pacing it removes the trade, **N=24 +10.66, SE 1.98, CI [+5.13, +16.19]**, monotone in budget (250k −0.47, 500k +10.33, 750k +18.63). **Signal swapped and re-anchored in `4325370`**: the input is the margin, `HANDOFF_FORWARD_EVAL_PACE_START/FULL` are deleted, and the ramp is far flatter in budget than the one it replaced — `P(margin < 2.0)` is 75% / 71% / 49% / 19% / 10% / 7% at 75k / 150k / 300k / 750k / 1.5M / 2.25M against the old 100% / 12.5% / 2.3% at 150k / 300k / 750k. **The mechanism is consequently LIVE at 750k, where it used to be effectively absent**, and that is where Phase 1a's −0.28 came from. Three facts the docstrings do not state: (1) the two pool-affecting consumers are gated to the pre-completion phase, so the prune is still strictly pre-first-completion even though the signal is not; (2) the "pruned" tail still pays a charged depth-1 rollout — and **only when the config is greedy** (§2, discrepancy 11) — which is load-bearing because it populates `_candidatesCache` for SC-16's dominance filter; (3) when SC-10 also fires the head is shallowed too, so the prune saves **zero frames** (100% of 150k specs). The extra lanes are scored with the policy's `allowForwardEval`, not `false`, so at full pressure a reuse or brake candidate pays a deeper rollout than pool ranks 2–4.
**MEASURED IN PRODUCTION ARCHIVES FOR THE FIRST TIME, 2026-08-04** (LC-32, `d84c71c`): over the N=48 baseline's 2,112 compiles the ramp engages on **22.2%** of pre-completion pool builds and saturates on **0.40%** of them. Two consequences the docstrings did not have before. (i) The anchors it rides on were re-bracketed on the corrected signal and every alternative pair is a null while engagement moves 2.5× — *this consumer is insensitive to its own ramp's engagement rate at 750k* (§6.6, Cluster B). (ii) Its phase gate was re-measured as a **magnitude** rather than assumed as a mode: a continuous post-completion phase weight (`LR_STUDY_POST_DEADLINE_W`, SC-26) is monotone-negative to −0.529 ± 0.188 at full dose, and the loss is entirely the repair lane — 93.6% of post-completion builds are inside a repair restart. The Phase-1a boundary is therefore not a deferral any more; it is the measured optimum, `w = 0` (§6.6, Cluster D1). What the ramp narrows is now depth-1 rollouts on both ends since SC-25, which is why the pruned tail's charged rollout is cheaper than this entry's third fact assumes.

**SC-10 `HandoffSearchPolicy.forwardEval` — slack-conditioned rollout depth**
type `:650-661`, resolved `:4786-4788`, applied `:3858`, `:5464-5466` · `budgetSlack` + `hasCompletion` → **lookahead-spend** · **threshold** · partially-live · **never binds**
`hasCompletion || !(budgetSlack < 1.5) || LR_PRECOMPLETION_FWD_EVAL`. Shallows greedy rollouts from depth 2 to depth 1. A 250k-completion-knee mechanism (docstring dated 2026-07-16); at 750k it never fires. Its docstring's claim that 500k slack is "~2" is wrong — measured 2.81–4.50, median 3.349 (§2d); the qualitative claim holds. Its live-signal cousin (rollout-depth gate on live pace) is the campaign's worst recorded number: **−8.05, capability −51.59**.

**SC-11 `forwardStageTop` — the staged two-pass rollout**
resolved `:4783-4785`, `stageTop:3884`, staged path `:3896-3921` · `hasCompletion` + env → **lookahead-spend** · study-hook · static · n/a
Default 0, so never active. Only 3 or 4 are expressible (`stageTop >= HANDOFF_BRANCHING` and `< pool.length`). Enabling it at 4 post-completion measured **+0.10, SE 0.24 — the cleanest null in the campaign.** It is the alternative implementation of SC-09 one layer down. **Deliberately not deleted in Phase 1.4 (`d84c71c`)**: its two-pass plumbing was reserved as the k-mechanism for the top-k × wide shape family — and the Phase-3 stop rule retired that family before it was built, so the plumbing is dormant again for a second stated reason rather than by neglect. A future k-mechanism generalises it (cheap pass over the admitted pool, promote top-k to the expensive shape) and must never edit `HANDOFF_FORWARD_EVAL_TOP` itself, which is load-time-asserted against the pool constant (SC-05).

**SC-12 `matureForwardEvalConfig` — the vertical-drama `avg` upgrade**
`:6389-6422`, pressure `:6481-6507`, constants `:1065-1073`, dispatched `:6317-6328` · `targetBudget` × authored axis targets × cadence, then a per-node hash draw → **lookahead-spend** · **saturated** · static · never binds (budget term)
Upgrades `greedy:2:1` → `avg:2:1`. Budget term `smoothstep((B − 35k)/65k)` = 1 at every B ≥ 100k, so only the target/cadence pressure varies. No bracket found for 35k/65k. Takes priority over SC-13 (early return). Its real signal is authored geometry, not budget. **Cheap, and measurably so** (§6.5): 22 frames/call and 4.9% of rollout frames at 750k, against SC-13's 167 and 62.8%. The two must never again be discussed as one "adaptive shape" family — and none of the three shape upgrades has ever been measured with the other two live. **Two facts added 2026-08-04.** It is FIRST in the dispatch chain and it takes an early return, so where it fires it *crowds out* SC-13 entirely — on `scripts/v0/specs` sources that is near-total (2,741 of 2,762 calls on `believer_impact@750k`), which is why every rollout-shape pricing in this campaign was run on canonical v2 sources and why a music-source panel cannot price the impact arm at all. The same crowding is why the four music sources were EXCLUDED from A-FIX-2's coordinate study: under a mature-`avg` arm a depth-1 leaf value does not exist there. Its budget term is filed offender d4 — `smoothstep((B − 35k)/65k)` pays a `smoothstep` per call to compute the constant 1 at every promoted budget; deleting it is byte-identical at ≥ 100k and so needs an argument, not an eval.

**SC-13 `impactBestForwardEvalConfig` — impact-pressured first-level width**
`impactBestForwardEvalConfig:7558-7594` + a 41-line rationale `:7517-7557`, constants `:1322-1327`, seed `:7688` · gap impact ask × `budgetSlack`, then a hash draw → **lookahead-spend** · **saturated (SLACK term; the BUDGET term was RETIRED `7d7348b`)** · static · binds
Widens the greedy rollout's FIRST rolled contact to best-of-3. **Product of TWO smoothsteps since `7d7348b` (2026-08-04)**: ask 0.25/0.2 × slack 2.5/2.0 — near-full at 750k's measured 4.21–6.75. It used to carry a third, `smoothstep((B − 300k)/200k)`, and that factor was BOTH filed offenders at once: **d3**, a raw-budget ramp positioned by its own docstring so that "the charge-bounded completion knee never pays" at the benchmark's 250k operating point (the named anti-pattern), and **c1**, the double count — `slack = B / D(spec)`, so B entered the gate twice, once absolute and once inside the difficulty coordinate, which is the DIFFICULTY/DEADLINE conflation the architecture forbids. Removing it is provably inert on the benchmark surface (the ramp is exactly 1 at ≥ 500k, and at ≤ 300k the slack gate is independently shut on all 44 canonical sources — max slack at 250k is 2.249 against a 2.5 start): 750k/500k/250k byte-identical on track + telemetry + stats, standing 250k reading **PARITY 0/528 cells**, and the deliberate 400k contrast cell differs, proving the (300k, 500k) sliver was the only binding region. **Off the benchmark surface it is a real and intended behaviour change**: a short spec carrying slack > 2.5 below 300k now opens the arm on its own coordinate instead of being held shut by a constant placed for an operating point — which is what `compiler_scale_contract` asks for. *Divergence recorded deliberately*: the Phase-0 filed fix shape said "fold the budget term into the shape family's affordability law", and the shape family was retired by the Phase-3 stop rule, so what shipped is the c1-only two-coordinate reading. Committed `c62cb3a`, +4.85. The rationale documents both falsified alternatives: unguarded width charged knife-edge completion hunts (8-wide stage-0 −21.9, `pickup_shifted` −276) and a post-completion-only gate (panel −7.9). Its widened pool build calls `setRolloutAimSuppressed(true)` because otherwise every prefix re-sort re-runs the charged aim lane (17/24 rideStalled).
**Now priced, and it is the single largest line item in a 750k compile's rollout budget** (2026-08-03, §6.5): the widened lane is **62.8% of all rollout frames at 750k — 12.9% of the whole compile** — at 167 frames/call against 47 unwidened, and dropping it measures **−4.59 ± 2.20 per cell** at 750k and **exactly +0.00 on all 48 cells at 250k** (byte-identical compiles, which is this entry's by-construction claim confirmed empirically rather than argued — measured while the budget ramp still existed, and after `7d7348b` the same zero is produced by the slack gate alone, which is exactly why the removal was parity). Two consequences. Its own docstring's diagnosis — "1-sample picks the two-gap optimum 8/24 vs best-of-8 24/24" — turns out to be a property of **every** gap and to be about *existence*, not only ranking, which is what SC-24 acts on. And the open lever is a **reallocation**, not a generalisation: widening to 3 everywhere would take the rollout share from 20.5% to ~35% of the compile, while narrowing this gate and spending the frames on SC-24's conditional re-draw buys ~20× the coverage per frame. Unmeasured. **RUN 2026-08-04, and the reallocation is CLOSED from three sides on the promoted tree** (`bce18e9`, `fd734a5`; all suite-stratum-weighted per H10). *Ask re-gate* `LR_STUDY_IMPACT_ASK_START=0.35` — priced at +6.53 ± 4.63 pre-promotion, it reads **−11.53 ± 4.08 (t = −2.83)** at 750k and −6.65 at 2.5M once the depth-1 base is under it: the base and the lane reach the same correction and stacking over-corrects. *Depth* `LR_STUDY_IMPACT_DEPTH=1` — **−0.364 ± 0.763, a wash**, and the load-bearing reading is the frame accounting: the arm's second hop is **41% of all rollout frames** yet dropping it moves total sim frames **0.14%**, because the charge is re-spent on search at exactly market price. Any future "narrow the arm, spend the frames elsewhere" story therefore starts from parity and inherits the free-judge ceiling (+1.78 ± 1.31). *Width* `LR_STUDY_IMPACT_BRANCH=2` — **−1.363 ± 0.713 (t = −1.91)**, so 3 is the arm's local optimum and the pre-promotion +1.23 was noise; the combined arm was not run because both factors are negative (composition rule). Validity 352/352 everywhere. **Register row**: depth 1 is the priced arm (−41% rollout frames at measured parity) if a simplification ever wants a cheaper impact arm for non-headline reasons. The arm's shape is now PINNED rather than inherited from the base (`variant/depth/branch/firstBranch` written out) — under a moved base the old `{...base, firstBranch}` spelling would have silently dropped the widening, since `forwardArcValue` dispatches `firstBranch` on `variant === "greedy"` alone (SC-25). It is also **72% of rollout frames at 2.5M**, so it remains the largest single line item wherever the budget goes.

**SC-14 `openingBestForwardEvalOpportunity` / `openingBestForwardEvalConfig`**
opportunity `:4339-4394`, config `:6330-6363`, slack pressures `:6365-6379`, constants `:1084-1093`, call `:3850` · `budgetSlack` + contact count + the pool's top-two quality objectives (zero sim frames) + a hash draw → **lookahead-spend** · **saturated** · static · **partial** (branch-2 always, branch-3 never)
On the FIRST contact gap only, replaces `greedy:2:1` with `best:1:2` or `best:1:3`. Four smoothstep pressures. Branch-2 needs slack ≥ 2.75: 0% at 250k, **100% at 500k and 750k**, with the 750k median 5.023 sitting at the ramp's full point. Branch-3 needs slack ≥ 10: **unreachable at every measured budget; max slack is 6.748 at 750k and 8.997 at 1M** (§2d). Accepted `1baee0b` in a commit whose measurable content was entirely the branch-2 arm. `openingBestStructuralPressure` further restricts it to specs of ≲ 7 contacts. Independent corroboration from the rollout-shape census (§6.5): on an 11-source × 3-seed × 3-budget grid this config **never fired at all**.

**SC-15 `startEvalConfig` — start selection by true forward score**
`:5998-6019` (+ the sanctioned-exception note `:6004-6012`), `startForwardScore:6022`, call `:6703` · none — **explicitly ungated** → **lookahead-spend** · budget-blind · static · n/a
`best:1:5`, +7.5 headline over `greedy:2`. A deliberate, documented exception to the minimal-simulation rule: full engine re-detection, on at every budget, with no `forwardEvalMinBudget` gate. Its total charge is budget-shaped only through the start pool size (LC-05). It runs before any margin exists.

**SC-16 the continuation dominance filter**
applied in `rankedOptions` · the shared deadline margin at `underFullDeadlinePressure` → **deadline-pressure** · **LIVE-ADAPTIVE** · live · binds
Under full deadline pressure and not yet complete, drops options whose charged rollout already proved they cannot place the next contact (`forwardContinuation === false`). Dominance, not extra work — which is why it survives while binary gates on live pace are falsified: no quality is lost by definition. **That last clause was measured on 2026-08-03 and it does not hold as written**: the "proof" is a single sample, and 53.3% of hop-1 dead-end verdicts are false — ~70% on the representative stratum and 70% on `brake`-lane candidates, which are the most likely to be the last option left (§6.5). The filter is a dominance rule over a bit that is usually wrong where dead-ends are rare. It was not changed; SC-24 corrects the bit at the producer, so this consumer reads a corrected `cachedForwardContinuation` without being touched. **COLLECTED 2026-08-04** (`4ff32ae`, metric M9 / residue L3 — the grid this entry asked for). The filter is a **250k-capability mechanism, not a 750k one**: it fires on **17.2%** of pre-completion pool builds on capability@250k (22.3% on `frontier_dense_recovery`) and ≈ **0%** everywhere at 750k, because full deadline pressure — its trigger — almost never saturates at the promoting budget (0.40% of pre-completion builds). Of the **460 acted-on verdicts** (all audited, no sampling) **37.8% were FALSE** (43.4% on capability@250k): where it fires, it prunes a frontier node on a refuted proof about three times in eight. That is a 250k-tier defect and the promoting instrument cannot see it, which is the §6.2 shape again. It stays pre-completion-only on an explicit argument now written in the code: post-completion there is an incumbent to protect and the verdicts are the *less* reliable ones (39.9% true against 49.9%). It used to be a **third, independent** pace estimator (`onlineTraversalBehindSchedule`: spend-fraction vs progress-fraction with an 8-contact grace, disagreeing with both `budgetSlack` and `pacedSlack` by construction); Phase 1a deleted the comparator and Phase 2's anchor unification deleted the private `margin < 1` threshold that briefly replaced it, so the lane now fires at the same anchor as SC-09 and GA-15. Depends on SC-09's depth-1 tail rollout to populate `forwardContinuation`.

**SC-17 `maturityPressure` — the shared maturity scale** *(RE-CLASSIFIED 2026-08-02: **asymptotic, not saturated** — this map had it in the wrong class)*
`maturityPressure(targetBudget, scale):4374`, constant `:875`; **three** live consumers, all of which now call the helper instead of inlining the expression (`d7c839f`, byte-identical) · `targetBudget` → **shared shape** · **asymptotic** · static · binds
`smoothstep(b/(b+150_000))`: 0.500 / 0.684 / 0.865 / **0.926** / 0.951 / 0.994 at 150k / 250k / 500k / 750k / 1M / 3M — **+35% relative travel across the benchmark's own grid**, so it never pins and never belonged in the fake-budget-aware class. Doubling 750k → 1.5M still only moves it 0.036. Named by the law-accepting commit as the explicit generalisation target — "a ceiling waiting to be replaced by a law". **Phase 3 measured the flat-constant arm instead of assuming**: setting all three live consumers to their mature value moves 3/20 golden hashes at 750k and 22/176 V2 track hashes, and on 44 development sources × 4 seeds at 750k reads **596.187 → 581.602, −14.585, validity 176/176 → 175/176**, the loss concentrated as a capability collapse (`rapid_pickup_frontier` −55.93 on 8 cells; thirteen of the other fourteen families within ±0.3). Together with the two law arms that already lost (SC-20 −0.86 with 750k exactly +0.00, SC-19 −0.32) that is three of three: **keep the asymptote.** A future arm has to be one bundle, because the three consumers share the function. Its fourth consumer was SC-18 and is deleted. The two survivors multiply it by an inlined `feedback/(feedback+scale)` progress term.

**RETIRED · SC-18 `qualityFuturePreviewPressure` — future-preview weight** *(deleted `d7c839f`, with `QUALITY_FUTURE_PREVIEW_MAX_PRESSURE`, its full-feedback scale, the shared `fullFeedbackPressure` helper and the whole `previewScorePressure` parameter)*
`targetBudget` × `uniqueFullEvaluations` (live) → **selection** · **DEAD** · partially-live · **never bound ≥ 75k**
Computed on every policy resolution and threaded through five call sites, but `scoreCandidateForHandoff` returned from the forward-eval branch before reading it (SC-08); `policy.preview` is hard-`false`. **A correction to this map, which listed it under "dead code, zero risk, no behaviour change"**: it was dead at every budget ≥ 75,000 and *not* below. At a sub-gate budget the local branch runs and this pressure was the only thing making it take a preview at all — charging a lookahead and then multiplying it by 0.03 at 20,000 frames. `tests/optimizer_handoff.test.ts` compiles at 20,000 and is the one place in the tree that exercised it; its three preview counters are now zero and the test says why. Equivalence verified rather than asserted: forcing the local ranker (`LR_FWD_EVAL_MIN_BUDGET=999999999`) at 350k, the post-deletion tree is **12/12 byte-identical** to a base tree with the pressure hard-wired to 0. Its diagnostic interest survives it: it is the record of what the ranker looked like before forward eval, and the `maturityPressure × full-feedback` idiom it introduced is the one SC-19/SC-21 still copy inline.

**SC-19 `matureReuseExtraPressure` / `reuseCandidateLimit`**
`:4445-4466`, seed `:4468`, constants `:976-982`, wired `:4780` → `:3308` → `:4172` · `targetBudget` × `uniqueFullEvaluations`, then an **unsalted** `nodeHashSeed(node)` draw → **generation** · **saturated** · partially-live · binds
1 reuse candidate, or 2 with probability `0.35 × maturityPressure` = 0.324 at 750k. Hard cap at +1 ever; the budget-law arm measured **−0.32 (750k −1.1) — "correctly capped"**. A side finding worth keeping (§6.5): reuse-lane candidates produce the *most* trustworthy dead-end verdicts of any lane (60.3% verified true against 30.0% for brake and ~47% for pool ranks 0–4) — an older translated catch that cannot continue usually really cannot. `HANDOFF_REUSE_K = 1`'s own docstring gives the reason: older translated catches over-lock dense forward-dependent chains. Reuse options are scored at full rollout depth even when SC-09 prunes the tail. The unsalted seed shares its random stream with any future unsalted consumer — a latent determinism hazard.

**SC-20 `tailCompletionContactWindow` — tail-completion breadth**
`:5406-5410`, gates `:5334-5364`, seed `:5402`, constants `:1108-1117`, caller `completeNearTail:4594` from `processNode:1791` · `policyBudget` + a per-node hash draw for the fractional boundary contact → **lookahead-spend** · **saturated (ceiling 12)** · static · binds
`window = 8 + 4·maturityPressure` = 11.70 at 750k (integer 11 plus a 0.784-probability twelfth), max 12 as B → ∞. The fractional part is realised as a stochastic gate, so the window is continuous even though contacts are integers. Budget-law arm **−0.86, 750k exactly +0.00 — "no headroom at the top"**, so the ceiling is measured-correct rather than merely unmeasured; the family's flat-constant arm (SC-17) is a third measurement pointing the same way, at −14.6. At 750k a wider window costs 81 candidates × 2 branches × 11 contacts per attempt, and `completeNearTail` runs on **every** processed node.

**SC-21 `shallowQualityTailThrottlePressure`**
`:5380-5396`, gate `:5366-5378`, seed `:5398`, constants `:1119-1120`, applied `:5343-5349` · `targetBudget` × `uniqueFullEvaluations`, then a `(node, remainingContacts)` hash draw → **lookahead-spend** · **saturated** · partially-live · binds
Suppresses tail completion for nodes with ≤ 2 remaining contacts once the compile is mature and has accumulated full evaluations. `FULL_FEEDBACK_SCALE = 6` is the smallest of the three feedback scales (6 / 12 / 48), so this is the fastest-ramping of the family: at 750k with ≳ 30 unique full evaluations ~93% of shallow-tail attempts are dropped. The closest thing on the path to a correctly-shaped adaptation already — its live term is a work-done counter and it throttles a rate. Never audited as a law; the last untested `maturityPressure` consumer, though the family's flat-constant arm (SC-17, −14.6) is now evidence about the shared shape it rides on. Since `d7c839f` it calls `maturityPressure` rather than inlining it, and its full-feedback term is inlined because the shared helper went with SC-18.

**SC-22 `TAIL_COMPLETION_FALLBACK_BRANCHING`**
`:1118`, `policy.tailBranching:4781`, applied `:4703` · none → **selection** · budget-blind · static · n/a
`2`, deliberately below `HANDOFF_BRANCHING` because the tail search is speculative. No bracket found. Also used by repair's bounded rebuild through the same function.

**SC-23 `handoffCapacityProbeHook` budget gate**
`:3944` — `if (handoffCapacityProbeHook !== null && targetBudget >= 500000)` · `targetBudget` → **observation** · study-hook · static · never binds
The hook is null in production. The clearest benchmark-identity literal in the file; it was written without the numeric separator used everywhere else — a tell that it was added ad hoc — and `d7c839f` fixed the separator and left the hook. Harmless; a mechanical scale-contract grep hits it.

**SC-24 `HANDOFF_ROLLOUT_REDRAW_ON_EMPTY` — the rollout's own rescue** *(ADDED `bb45125` 2026-08-03; budget-blind, listed because it changes what SC-16 reads)*
constant + `redrawFirstHopOnEmpty`, called from `forwardRolloutScore` (outermost hop only, via a `firstHop` flag), `forwardFirstWidenedScore`, `forwardAvgNextScore` and the support-delay robust score · **none — the node's own outcome** → **lookahead-spend** · budget-blind · live · n/a
`1`. When a charged rollout's FIRST rolled contact expands to an empty pool, re-run the ordinary generator at that node at `width + 1` before the dead-end verdict stands — the rule the search already applies to itself in three rescue tiers (32 / 80 / startup), one level up on the mechanism that never had it. Four properties are the whole design. **(1) The trigger is an outcome, not a signal** — no threshold, no mode, no per-spec or per-budget gate; the campaign's "throttle a magnitude, never trigger a mode" caveat does not apply because there is no signal to threshold. **(2) It is the ordinary generation path at a wider count**, so `getCandidatesSorted`'s prefix contract makes the extra draw the very sample the search would take next (`solveAdditionalCandidates` advances the per-gap RNG, keyed on `(seed, gapIndex)` alone) — determinism in `(spec, seed, budget)` is free and the probe cannot find a catch the search would not have. **(3) The aim lane is suppressed and the flag is saved/restored** rather than cleared, so a nested widened build cannot silently re-admit it; §6.5 measured that the lane contributes nothing to the refutation and 4.6× to the cost. **(4) The widened pool is left in the node's memo on purpose.** `_candidatesCache` is keyed on `(seed, nCand)`; a narrower later request is served as a prefix and a wider one extends the same sample order, and the re-draw only ever writes widths **2** and **4** while every other consumer asks for 1, 8, 16 or the search pool — whose breadth law floors at `HANDOFF_QUALITY_N_CAND_FLOOR = 8` — so the widths are **disjoint by construction at every budget**. That is what makes `cachedForwardContinuation` report the corrected bit to SC-16.
Realized price 0.45–1.71% of frames (under the ~0.6–3.2% prediction, because the memo makes a repeat dead-end at an already-re-drawn node free). **Two things stated rather than hidden.** The "can only add candidates" claim is a strong prior, not a proof: `kinematicEligible` requires `poolForwardContinuationAbsent`, so refuting one verdict can switch the kinematic-support rescue *off* at that pool. And the dose is the only knob — draws 3 and 5 are the same mechanism at 2.4× and 3.2× the frames per correction (§6.5), walkable on the same arithmetic and explicitly **not** something to tune per budget. Counters: `fwd_rollout_redraws` and `fwd_rollout_redraw_refuted`, which read directly against `fwd_rollout_no_candidate`.
**The dose is now walked, and it is CLOSED at 1** (`916d5db`, `bce18e9`; the walk runs through `LR_STUDY_ROLLOUT_REDRAW`, integer [0, 7], SC-26). Pre-promotion the ladder was monotone to **+9.66 (t = 2.23) at width 7 with no cliff** — the reducer-free path, which is the control that pins the W = 6 `best` cliff on the max reducer rather than on width itself (§6.6). Re-run on the promoted depth-1 tree, dose 6 reads **−6.49 ± 2.90 (t = −2.24)** at 750k while its refutation rate nearly triples (M3 11.5% → 30.1%): **the third independent reproduction that correcting false hop-1 verdicts is measurable and does not pay**, and the clean statement of why the dose is not a free parameter — the base and the dose reach the same correction, so stacking over-corrects. *Register row, off the promoting surface*: at 250k dose 6 rescues `frontier_dense_recovery` from 1/3 to 3/3 valid (+257 on that source; excluding it the arm is −11.5, the same sign as 750k). A low-budget completion-rescue class, invisible to the promoting instrument (§6.2); if it is ever productionized it must be a redraw-dose *law* and its evidence surface is the standing 250k reading. **Its counters are also the campaign's free thermometer** (M3, `4ff32ae`): `refuted/redraws` over the N=48 baseline archive is **14.3%** (70,328 / 491,324) with the study's terrain ordering reproduced at zero probe cost (capability 3–6%, representative 22–33%), trigger rate 9.96%, residual dead-end rate 24.4%.

**SC-25 `DEFAULT_FWD_EVAL_BASE` and the composable override — the production rollout shape** *(ADDED 2026-08-04, `9f58697` + `1ecbc1b`; the override `916d5db`; budget-blind, listed on SC-24's precedent because it re-prices every budget-conditioned rollout consumer)*
constant `:6678`, resolver `resolveForwardEvalConfig:6680-6710`, arm gate `adaptiveArmsApply:7411-7419` · **none — a constant shape** → **lookahead-spend** · budget-blind · static · n/a
`"greedy:1"`: one contact hop, single sample, objective leaf. The adaptive arms are untouched and keep running their own shapes on the gaps they own. **Why this entry exists is the confound, not the constant.** `greedy:2` was the base from the ranker's promotion until 2026-08-04, defended by a study arm `LR_FWD_EVAL=greedy:1` measured at −11.36 @250k / −3.84 @750k — and **any** non-empty `LR_FWD_EVAL` sets `defaultConfig = false`, which switches all three adaptive arms off, so that arm actually priced "depth 1 *minus* the impact widening", a mechanism worth 62.8% of rollout frames. Measured composed through `LR_FWD_EVAL_BASE` (arms live) the sign inverts and holds at every budget: **+5.50 ± 2.44 @250k, +12.53 ± 4.14 (t = 3.02, 15/18 cells, all strata positive) @750k, +3.59 ± 4.01 @2.5M — while spending 0.22M FEWER rollout frames at 750k.** Gold standard at N=48: **+0.43 [−0.62, +1.49], P(+) 86.05%, INCONCLUSIVE-positive**, validity 2112/2112, representative **+1.39 [+0.12, +2.67]** significant alone, capability **−2.37 [−4.79, +0.04] recorded as debt and then ACCEPTED** (all three fix shapes measured-closed; reverting is −1.163 ± 0.713 at panel scale; §6.6). Force-promoted per posture → baseline of record `base-depth1-750k` = **596.41**, ledger +0.37.
Three structural consequences. **(1) `LR_FWD_EVAL` is a full override and `LR_FWD_EVAL_BASE` is a composable one**, and only the second may ever be used to price a shape: the first pins one shape for the whole compile *by design* (an arm that silently replaced it would be unreadable), the second moves the base and leaves the adaptive layer alone. An unparsed `LR_FWD_EVAL_BASE` falls back to the default with a warning rather than disabling the ranker, unlike the `LR_FWD_EVAL` typo path (kept for compatibility). **(2) The arms are now explicit shape REPLACEMENTS scoped to the gaps they own**, not deltas: `impactBest` used to be spelled `{...base, firstBranch}`, which was only ever correct because the base could only be `greedy:2:1` — against a movable base that spelling silently drops the widening for any non-greedy base, because `forwardArcValue` honours `firstBranch` for `variant === "greedy"` alone. **(3) Every recorded rollout-shape verdict in this map predating 2026-08-04 must be read with its regime stated.** The depth-family ceiling in §6.5 is the one that inverted; the frame-share, charge and refutation numbers do not depend on the flag and stand.

**SC-26 the study-gate surface** *(ADDED 2026-08-04; twelve default-off gates across `916d5db`, `bce18e9`, `468f54f`, `7d90184`, `fd734a5`, listed with the composable base override they are usually run beside)*
inventory comment `handoff.ts:5972-5995`, two of them in `optimizer/deadline.ts` because that is where the constants they re-bracket are derived · env, `compileScopedEnv`-bound → study-hook · static · **n/a in production**
Every one defaults OFF, production is byte-identical with all of them unset, and **every one REFUSES an out-of-range value instead of clamping** — an arm that silently ran at the shipped value because its env said `two` is worse than no arm. They exist because the campaign's questions were all "is the shipped constant still the optimum now that a neighbour moved", which is a dose walk and not a code edit. Each carries its measured verdict in its own docstring as inoculation:

| gate | range | what it moves | verdict |
|---|---|---|---|
| *(`LR_FWD_EVAL_BASE`* | *shape* | *the compile's base rollout shape, composing with the arms — not a study gate but the enabler every one of the rows below was run through* | *`greedy:1` promoted; SC-25)* |
| `LR_STUDY_HANDOFF_POOL` | [3, 8] | `handoffCandidatePool` | pool-cliff hypothesis falsified (SC-05) |
| `LR_STUDY_ROLLOUT_REDRAW` | [0, 7] | `redrawFirstHopOnEmpty`'s dose | dose 6 = −6.49 ± 2.90 on the promoted tree (SC-24) |
| `LR_STUDY_IMPACT_ASK_START` | [0, 1] | the impact arm's gate | 0.35 = −11.53 ± 4.08 (SC-13) |
| `LR_STUDY_IMPACT_BRANCH` | [1, 8] | the impact arm's width | 2 = −1.363 ± 0.713; 3 confirmed (SC-13) |
| `LR_STUDY_IMPACT_DEPTH` | [1, 2] | the impact arm's own depth (2 = production) | 1 = −0.364 ± 0.763, a wash at −41% rollout frames (SC-13). Range stops at 2 deliberately: depth 3 is measured negative |
| `LR_LEAF_DEDILUTE` | {1} | `objectiveLeafValue`'s two-component fold | −17.24 ± 3.04 pooled; falsifier failed in the wrong direction (§6.6) |
| `LR_STUDY_POST_DEADLINE_W` | [0, 1] | the head ramp's post-completion phase weight | monotone-negative to −0.529 ± 0.188; the optimum is production's 0 (SC-09, D1) |
| `LR_STUDY_POST_DEADLINE_SCOPE` | all\|nonrepair | which post-completion lanes that weight reaches | `nonrepair` +0.048 ± 0.020 on 25/352 cells — filed, not shipped |
| `LR_STUDY_NCAND_SCALE` | [0.5, 2] | the breadth law's OUTPUT at a fixed budget | 1.0 re-confirmed; 0.7× = −2.28 ± 0.71 (SC-01) |
| `LR_STUDY_DEADLINE_NO_PRESSURE` / `_FULL_PRESSURE` | (0, 10] each | the two margin anchors; refuses a degenerate pair | six pairs, all null (SC-09, Cluster B) |
| `LR_STUDY_PACE_WEIGHT` | [0, 2] | the pace term's blend weight | 0 = −0.016 ± 0.381 at 750k; term kept on a ≤ 300k argument (SLK-05) |

Two supporting facts. `repairLaneActive` (declared `:6190` and reset-registered; set and cleared at `:2582-2587` around the one `runFrontierFrom` call a restart drives, so it marks exactly the repair-episode pool builds and nothing else) is what makes the repair/non-repair split measurable at all: production reads it only through `postCompletionPhaseWeight`, which returns on the first line unless a study weight is set, and it is reported on the observation-only deadline probe record (`repairLane`, `:4524`) so both scopings can be sized from one run. And the `LR_STUDY_HANDOFF_POOL` arm is the one gate with a stated side effect: it does not move the aim lane's base share, so it splits the two machine-enforced same-share consumers (SC-05, GA-15) for its duration — measured to be nearly nothing at the budgets it is used at, and stated by every arm that uses it.

### LC — budget lifecycle, stopping and repair (`handoff.ts`) · 32

**LC-01 budget entry validation** — `:2451-2459`, called `:1260` · `opts.budget` → plumbing · contract · static · binds. Throw unless `Number.isSafeInteger(raw) && raw > 0`. No default: a budget is mandatory.

**LC-02 `policyBudget` resolution — the episode mechanism nobody runs** — `:1261-1268`, option doc `:185-189` · `opts.policyBudget` → **allocation** · study-hook · static · **never binds**. `policyBudget = opts.policyBudget ?? targetBudget`, validated `<= targetBudget`. Every policy read uses `policyBudget`; every stop uses `targetBudget`; the repair loop stops at `repairBudget = policyBudget`. `b549ddb` 2026-07-10, empty body, zero live callers (§2f). Its shape is already an episode: `[0, policyBudget]` policy-sized search plus repair, then `[policyBudget, budget]` resumed frontier. The second act is **unpriced** (discrepancy 8). Deleting it would remove the cheapest available instrument for A/B-ing a deadline-pressure controller.

**LC-03 `budgetTelemetry` level** — `:1269-1274`, consumed `:1384`, `:1951` · `opts.budgetTelemetry` (`off|summary|trace`) → observation · contract · static · binds. Default `"summary"`; production passes it explicitly; `run.ts` is the only caller defaulting to `trace`. The one leak into control flow (`:1951`, `trackImprovementOffsets`) selects between two `runFrontierFrom` bodies differing by two counter reads per node — a cost switch, not a policy switch. `f96dc03`'s `stampTailReach` makes the same promise the other way: gated on `repairEnabled`, never on telemetry level.

**LC-04 `buildStartOptions` budget argument** — `:1352-1354`, `:6603-6723` · `policyBudget` + `initialSnapshot === null` → allocation · contract · static · binds. `START_OPTION_LIMIT = 10`, `START_SCORING_POOL = 16`, `START_BALLISTIC_SCORING_POOL = 4` — none budget-scaled. Budget enters only through LC-05. `startOptions.length` also gates repair (LC-12), which is what makes snapshot-resume a repair-free compiler.

**LC-05 `startBudgetPressure`** — *(KEPT AND PINNED, `d7c839f`)* constants `:997-998`; three consumers · `policyBudget` → allocation · **saturated** · static · **never binds**. `smoothstep((B − 50k)/50k)`, exactly 1.0 at every B ≥ 100k. Controls how many of 15 shareable scoring seeds go to ballistic first-contact starts (0–4), how many x-delay support variants are generated (1–3), and a robust-score blend weight. `7cf153f` 2026-07-02 was a consolidation of previously separate ramps, not a fresh fit. Two honest options were on the table — delete the budget dimension (byte-identical ≥ 100k) or anchor a law at a measured point — and **Phase 3 measured the delete and rejected it**: shipping the mature branch unconditionally (bundled with OB-03) costs −13.0 / −7.6 / −2.2 mean score per run at 75k / 150k / 225k and turns 0 missing contacts into 236 across 480 runs at 75k, with 17 contract-pass flips. That is scarce-budget COMPLETION behaviour, not quality trim, so the plan's second position — documented sub-250k insurance — is the honest disposition, and the docstring now carries the numbers and states what a law would have to be scale-free in before it could replace this. Still: do not re-sweep a ramp that never varies at a canonical budget.

**LC-06 `runFrontier` driver** — `:1904-1942` · frontier size, `nodesExpanded`, the caller's `keepGoing()` → stopping · contract · partially-live · binds. `while (frontierSize > 0 && nodesExpanded < maxNodes) { if (!keepGoing()) break; … }`, plus an early return when `processNode` reports `captured`. **This loop's granularity is why every budget in the system is a soft cap**: charged work is committed in whole node chunks, so 100% of 750k compiles overrun (median +2.25%, p90 +5.22%, measured over 2,112 baseline rows) and 99.0% of repair restarts overrun their ceiling. Any finer-grained budget test would have to interrupt a node mid-expansion, which breaks the determinism contract.

**LC-07 hard-budget capture** — `captureReachedBudget:1744-1748`, invoked `:1816` · live `getSimFrames()` vs `targetBudget` → stopping · **LIVE-ADAPTIVE** · live · binds. The one place a compile's output is frozen. Its comment records the invariant: the check sits "at the exact loop checkpoint the anytime path captured it — this verbatim timing is what keeps a scalar run byte-identical to the old anytime checkpoint". Placing it inside `processNode` rather than the driver is what makes one capture point serve main, repair and resumed uniformly. It can fire **inside** a repair restart, which is the direct cause of LC-28's undercount.

**LC-08 `stopAfterFirstCompletion`** — `:1749-1753`, invoked `:1769`, `:1811` · study flag + the terminal predicate → stopping · study-hook · live · n/a. Captures at the first terminal **considered**, not the first that improves — the opposite of the repair trigger. Only caller: `study_start_rank_oracle.ts`.

**LC-09 main-search handoff trigger (`mainMargin`)** — `:2238-2242` · `repairEnabled`, live `firstCompletionFrame`, live `getSimFrames()` → **allocation** · **LIVE-ADAPTIVE** · partially-live · binds. `keepGoing = !(repairEnabled && firstCompletionFrame >= 0 && getSimFrames() >= firstCompletionFrame · mainMargin)`. At `mainMargin = 1.0` this is "stop at the first node boundary after the first completion". Bracketed N=8: **1.0 +0.28 (SE 0.14)**, 1.1 shipped then flattened, 1.25 −0.52 (SE 0.15); independently corroborated by the ROI study's counterfactual (raising to 1.1 hands main search ~41 kf at 750k, priced at −0.35). `docs/repair-roi-study.md` H2 says explicitly: do not re-sweep. Five profile-band carve-outs became no-ops at 1.0 and were deleted with their predicates. It reads `firstCompletionFrame`; the study that priced it used `firstTerminalFrame` (discrepancy 5).

**LC-10 the two completion counters** — `:1483-1484` (declared), `:1573-1585` (both set) · `isTerminalNode` and `register.consider` → allocation latch · contract · live · binds. Full analysis in §2a. `firstTerminalFrame` on `terminal`; `firstCompletionFrame` on `improved && terminal`, with no contract requirement. Two archive fields share the name `first_completion_frame` and hold different quantities; measured divergence is zero across 2,414 rows at 250k/500k/750k.

**LC-11 `repairConfig()`** — *(no arguments left, `d7c839f`)* five env vars → allocation · **threshold** · static · **partial**. Budget-blind and spec-blind: the `profile` had been unused since the five main-margin carve-outs were deleted, and `policyBudget` went with `feasMargin`.
`minBudget` 100_000 (`4a60533` at 150k, lowered by `6e0eb26` 2026-06-08: +3.0 at 100k, +0.6 headline, ACCEPT, on the reasoning "all specs already complete at 100k") · `mainMargin` flat 1.0 (LC-09) · **no `feasMargin`** — the restart-sizing multiplier was flattened to 1.0 and then deleted outright, LC-19 · `maxAttempts` 64, **never reached** (max observed 17 across 3,696 compiles; `64 → 160` byte-identical) · `maxUpstream` 4 and `upstreamOrder` `oldest-first`, both unmeasurable from current telemetry · `log`. The `minBudget` literal is the one genuinely load-bearing budget number here and the one with a scale-contract smell: it is justified by a property of the then-current board, and the spec-relative statement is now available.

**LC-12 `repairEnabled` gate** — `:1476` · `policyBudget >= repair.minBudget && startOptions.length > 0` → feasibility · **threshold** · static · **never binds**. The only hard binary mode gate left in the compile lifecycle. Every live budget is ≥ 250k, so the budget clause never blocks; the undocumented `startOptions.length > 0` clause is false only on the snapshot path (LC-25, discrepancy 13). Also gates the two reach maps, the resumed phase, and the main-search handoff predicate. Good property: the reach-map writes are gated on `repairEnabled` and **not** on telemetry level, so off/summary/trace do identical charged work.

**LC-13 `repairBudget = policyBudget`** — `:1981` · → allocation · contract · static · binds. One line, no reservation, no share. Repair is not given a slice; it is given the whole budget and the compile ends when repair spends it. The ROI study is unambiguous: "Repair takes everything… both exits are the budget." Resumed headroom is p50 1.3 kf at 750k. Do not build a repair-vs-resumed dial on it — the resumed side has no measured numerator.

**LC-14 `costToEnd` profile** — `:1986-2011`; reach maps `:1489-1506`, written `:1766` (frontier) and `:1502-1506` (tail, via `stampTailReach`) · per-node charged-work timestamps + `firstCompletionFrame` → allocation · **LIVE-ADAPTIVE (measurement)** · partially-live · binds. `costToEnd[k] = max(0, firstCompletionFrame − reach(node@k))`, or −1 if the node is in neither map; computed once from the **original** incumbent and never refreshed. `f96dc03` 2026-08-01: 161 of 307 panel repair attempts anchored at a gap the frontier never processed (first completion routinely arrives through the near-tail pass), and at those anchors the measured profile predicts actual repair cost to **3.0% median APE**; `per_gap_fallback` ceilings went **58.9% → 0%**; canonical **+0.01 at N=48/750k**. Kept as a correctness win, not a score lever. **UPDATED at HEAD: the two reach maps are MIN-merged, not `??`-merged** (`firstReachOf`, `05cc801`; promoted at exact parity in `69d71a8` — +0.00 on every stratum and source at N=48, validity 2112/2112). A node can be stamped by both producers — the tail pass builds a suffix node and the frontier later pops the same memoized object at a strictly later frame count — so `firstReachOf` takes the EARLIEST stamp; a `??` preferring the frontier returned the later one and understated `costToEnd` at exactly the tail-created anchors the second map exists to serve. Open: after an accepted restart the rebuilt suffix has no reach timestamps, and `costToEnd` keeps the stale value rather than falling back.

**LC-15 `estCostOf` / `estCostUpperOf`** — `costToEnd[k]` where **positive**, else `firstCompletionFrame/(deepestSeenGap+1)` → allocation · live-adaptive · partially-live · binds. A non-positive `costToEnd` is not a measurement of "no work left" and now routes to the fallback, which is the cost floor `docs/repair-selection-study.md` demands and aligns this reader with the recorder's path selector and the deadline margin. The code's own characterisation of `perGap`: "an average over the whole search including its dead ends, so it over-sizes exactly the late, cheap anchors that tail completion produces". Post-`f96dc03` the fallback fires ~0% of the time. **Note the structural parallel**: `perGap`'s bias is *exactly* the bias in `observedTraversalBudgetSlack`'s `measured = spent·totalGaps/deepestGap`; `f96dc03` fixed it on the repair side only.

**LC-16 `pickFeasibleWeakGap`** — drift-report axis errors, `exhausted`, `estCostUpperOf`, and the **live** remaining repair budget → **feasibility / selection** · **LIVE-ADAPTIVE** · live · binds. Ranks non-exhausted contact gaps by Σ axis-error² descending, returns the first affordable one, −1 if none (the feasibility-bound exit, 34.7% of 750k compiles). The docstring calls axis-SSE "v1, a proxy for true upstream blame". **No longer the untested dimension: the Phase 2 replay study (`1e22721`) scored seven ranking policies against 3,520 archived compiles and none beats raw SSE** — ceiling-exclusion is bit-exactly inert (0 of 320,092 gaps at a `weakAxisCeiling`), scorer-weighting is a near-tautology at −0.001 [−0.117, +0.112], SSE-per-frame is −1.44 at 150k decision-1 with a CI excluding zero, and the 18.6% zero-yield pool is reproduced exactly by an independent-coin-flip model (19.1% modelled, overdispersion 1.30), so it is acceptance variance and not selection error. What changed here is the *affordability* side (LC-19), not the ranking. The `incumbent_weak_gap_sse` telemetry field now records the weakness key this pick was made on, sharing one `gapAxisSse` definition with the ranking itself. See Cluster D4.

**LC-17 repair loop conditions** — `:2026-2031`, inner break `:2124`, `kWorst < 0` break `:2043` · `attempts`, live `getSimFrames()`, `bestCompleteNode`, `isTerminalNode` → stopping · **LIVE-ADAPTIVE** · live · binds. Three real exits: budget-bound 65.3%, feasibility-bound 34.7%, `maxAttempts` 0.0% everywhere. Measured behaviour: 2.7 restarts/compile at 750k, 45% of all charged frames, 5.8 points/compile.

**LC-18 upstream walk affordability** — `estCostUpperOf(k)`, live remaining → feasibility · **LIVE-ADAPTIVE** · live · binds. Offsets `[maxUpstream … 0]` under `oldest-first`; skip when the upper-bound cost exceeds the remaining budget; `nearest-first` **breaks** on the first unaffordable while `oldest-first` **continues**. The `oldest-first` rationale is stated in code ("the older anchor can alter the weak gap's inherited arrival, while an expensive local restart cannot") and is **unmeasured** — `nearest-first` measured −3.28 with every stratum negative, but `maxUpstream` used to leave no distinguishable trace; the attempt record now carries `anchor_upstream_offset` and `repair_round_index` beside the anchor, so both are priceable from an archive.

**LC-19 per-restart ceiling** — live `getSimFrames()`, `estCostUpperOf`, `repairBudget` → allocation · **LIVE-ADAPTIVE** · live · binds. `ceiling = min(repairBudget, now + ceil(estCostUpper))`, where the upper bound is the estimator's own fitted `start`/`withPath` quantile over the measured cost-to-end — the hand-swept `feasMargin` multiplier and its `LR_REPAIR_FEAS_MARGIN` override are deleted, which retires the whole 1.5 → 1.1 → 1.05 → 1.0 sweep chain **and** the 2026-07-28 `1.0 → 1.20 = −0.63` reject as verdicts about a constant that no longer exists; `repair_budget_remaining` is chosen on 1 of 5,788 restarts at 750k, so the `min` essentially never binds. Tested only at node boundaries ⇒ 99% of restarts overrun; median spent/ceiling 1.100, p90 1.557, beyond-ceiling frames 12.2% of all repair spend. **This lane is closed and the reason is mechanical, not statistical**: sizing accuracy measured +0.01, a perfect stop-at-first-improvement ceiling is bounded at +0.26, and the 12.2% slop comes from LC-06's granularity. Bigger ceilings buy both acceptance (42.0% → 53.4% across quintiles) and gain (12×) at **flat ROI**. Restart index, anchor depth and local budget are one variable seen three ways — not three levers.

**LC-20 `runFrontierFrom`** — `:1952-1969`, called `:2175` · live `getSimFrames()` vs `ceiling` → stopping · live-adaptive · live · binds. Runs the **real** frontier DFS (rescue, far-back pulse, tail completion, register) from one anchor, so a restart is genuine re-exploration, not a greedy dive. Reusing the identical driver for main/repair/resumed is what makes phase comparison meaningful at all.

**LC-21 `exhausted` set** — `:2022`, `:2231`, read `:4734` · whether any restart in the round improved → allocation · live-adaptive · live · binds. `if (!improvedAny) exhausted.add(kWorst)`. The only *learning* in the repair phase, and cheap. One asymmetry: a gap is exhausted even when the round failed for a *budget* reason (every upstream offset skipped as unaffordable), conflating "cannot be improved" with "could not be afforded this round".

**LC-22 restart seed derivation** — `:2135` · `incumbent.searchSeed`, `restartCounter` → plumbing (determinism) · contract · static · binds. `restartSeed = (searchSeed ^ imul(restartCounter, 0x9e3779b1)) | 0`. The seed perturbation is the documented unlock: re-running from a gap with the same seed re-converges. **The coupling that constrains every repair proposal**: `restartCounter` advances per attempt, so any change to the attempt sequence re-seeds every subsequent restart. A selection change is never a local perturbation.

**LC-23 resumed search phase** — `:2269-2304` · `repairEnabled`, `captured === null`, live `getSimFrames()` vs `targetBudget` → allocation · live-adaptive · live · binds. Spends any residue on the **original** main frontier, against the **hard** budget — the one place the two budgets diverge in production-shaped code. Measured: ~1% of frames, p50 headroom 1.3–1.5 kf at 750k, 100% overrun — "not an allocation; it is the budget overshoot of one more node expansion". Accounting hole: `endActive` is called without an outcome object, so every resumed attempt has `null` for `accepted_score_delta`, `accepted_improvement` and `first_accepted_improvement_offset_frames`.

**LC-24 frontier-exhausted snapshot** — `:2306-2310` · `captured`, live frames vs `targetBudget` → stopping · live-adaptive · live · binds. `budget_exhausted` is computed, not assumed, so a converged compile is distinguishable from an exhausted one.

**LC-25 snapshot / resume entry** — `:1130-1137`, `:1352`, `:1370-1382`, `:2337-2363` · `initialSnapshot !== null` → plumbing · **threshold** · static · n/a. Replaces the start-option search with a cloned snapshot root and **transitively disables repair** (LC-12). `resetPerCompileState()` runs first, so the resumed compile's `budget` is a **fresh suffix budget, not a remaining budget**, and only the single prefix node survives — the frontier's queued alternatives are lost. Callers are all studies; **no harness anywhere calls `compileHandoffFromSnapshot`.** See discrepancy 13.

**LC-26 budget-curve helpers** — `:1139-1177` · a list of budgets → plumbing · contract · n/a. `budgets.map(b => runOne({...opts, budget: b}))`. The docstring is the load-bearing part: it forbids the anytime-checkpoint reading of a budget curve. `e0668e4` 2026-06-01 replaced the anytime checkpoint model with N independent runs, and LC-07 preserves the old capture timing verbatim to stay byte-identical. Any revival of shared episodes must argue against that decision explicitly.

**LC-27 `compile_stats` budget fields** — `:1598-1739`, budget fields `:1622`, `:1632-1642` → observation. `budget`, `sim_frames`, `budget_exhausted`, `ballistic_micro_sim_frames`, `traversal_budget_model`, `predicted_first_completion_frames`, `budget_slack`, `first_completion_frame` (= `firstTerminalFrame`), policy summaries. `objectiveLayerSpreadStat()` is spread twice (discrepancy 10).

**LC-28 repair stats block** — `:1720-1736` → observation. Present only when `repairRecords.length > 0`, so baseline archives are unchanged when repair never ran. **Undercounts `restarts` by one** whenever capture fires inside the last restart (168/352 at 750k; 1056/2112 at N=48). `budgetTelemetry.attempts` is the complete record.

**LC-29 per-output budget stats** — `:7392-7449`, fields `:7424-7427` → observation. Overwritten by `snapshot()`, so visible only via the `onNode` hook.

**LC-30 budget telemetry recorder** — `:1383-1409` plus thirteen more call sites → observation · **the design invariant**. All fourteen calls are write-only; `startAttempt` returns an opaque id consumed only by later record calls; `snapshot()` output lands in `checkpoint.budgetTelemetry` and in nothing the search reads. Attempts (`initial`/`snapshot`/`repair`/`resumed`) with anchors, ceilings and `ceilingSource`; contiguous segments with an `unattributed` filler emitted only when coverage is incomplete; compile-level identity `hard_budget + hard_overrun = total_spent + hard_remaining`. `docs/compile-budget-telemetry.md` §Non-Policy Status is the written invariant and the code honours it. One cheap, purely observational addition would still unblock a priced question elsewhere: pass an outcome object to the resumed `endActive` (LC-23). The repair-side pair — `up` and the round index — landed with Phase 2's coherence rider, together with `incumbent_weak_gap_sse`, the weakness key the pick was made on.

**LC-31 dead live-budget hooks** — `:4655-4659` + `:4676` (`completeNearTailSuffix`'s `maxNodes`/`frameCeiling`, sole caller passes `Infinity, Infinity` at `:4612-4624`); `:1980` (`if (repair === null) return;`); `:2241` (`repair!`); `:5891` (unused `profile`) → plumbing · **DEAD** · never binds. `if (nodes >= maxNodes || getSimFrames() >= frameCeiling) return null;` — a real live-budget bound wired to `Infinity`. Its docstring describes the *interleaved* repair design that `runFrontierFrom` replaced in `4a60533`. See the caveat in Cluster A. VERIFIED.

**LC-32 the deadline telemetry block** *(ADDED `d84c71c` 2026-08-04; post-pressure pair `bce18e9`)* — accumulator `:6224-6298`, JSON read `readDeadlinePoolCounters:6304`, snapshot `:2060-2073`, type `types.ts:769-815` · the margin and the pressure `rankedOptions` has already computed → **observation** · contract · live · binds (it is present on every handoff compile). **The one live signal ran for three campaigns with zero production telemetry — no archive could say how often the ramp engaged.** Counted at the ONE place the ramp is read, from two values the read already has, so it is a pure read: counters-only, byte-identical tracks, proven on four cells (750k/400k/250k/90k). Eleven pool-build fields, split at the Phase-1a consumer boundary, plus four terminal fields:
`deadline_pool_builds` (all callers) · `deadline_{pre,post}_builds` — builds whose caller passed no margin (the non-policy lanes read `Infinity`) are in neither, so `pool_builds − pre − post` is the unpaced remainder · `deadline_{pre,post}_pressured` / `_full_pressure` · `deadline_{pre,post}_margin_sum` / `_min` (means are `sum/builds`; the minima are JSON-`null` until a finite margin is seen, so an archive never carries an `Infinity` that `JSON.stringify` would silently turn into a null of unknown meaning).
**The post pair is a counterfactual and says so**: the phase gate forces the live pressure to 0 after first completion, so those two counters re-read the margin through the same `deadlinePressure` anchors — same question, both phases, comparable numbers — and they deliberately keep reading the UNWEIGHTED ramp even under SC-26's phase-weight arm, so arms stay comparable. First readings: at N=48 scale 22.2% of pre builds pressured and 0.40% at full pressure; on 48 canonical 750k compiles the phase split is pre 42.6% / post 57.4% with full pressure **pre 1.20% / post 22.70%** — a 19× ratio that is exactly why D1 looked open and, once the repair-lane split was measured, exactly why it is closed (§6.6).
**The terminal pair is the two-counters window, and its meaning is CORRECTED** (§2a): `deadline_terminal_considers` / `deadline_terminal_without_improvement` / `deadline_first_terminal_frame` / `deadline_first_improving_terminal_frame`. Built to size the estimator-target-vs-phase-flip gap, they measured it at **zero, 4,406 compiles of 4,406**, with the comparator as the mechanism. What the 95.6% non-improvement rate actually measures is **subsequent-terminal churn** — how much post-completion budget re-derives a track that does not beat the incumbent — which is a repair-ROI number and must never be read as a pacing gap. The counter keeps shipping under that reading; `docs/forward-eval-metrics.md` carries the canonical wording, and two source docstrings do not yet (discrepancy 18).

### GA — geometry and aiming (`arc_placement.ts`, `aim.ts`, `node.ts`) · 17

**RETIRED 2026-08-02 (`9a3dabd`) — GA-01 … GA-10, all ten entries, eleven reads.**
`arc_placement.ts` now reads no budget at all: the ten smoothstep ramps, the file's
only hard threshold (`STEEP_ARRIVAL_SCARCE_BUDGET_MAX_FRAMES`), 21 constants,
`compileBudgetPressure`/`compileBudgetFade` and the `currentCompileBudgetFrames`
global are deleted, and `setCompileBudgetFrames` (PLB-19) followed in `d7c839f`.
GA-06 is deleted as a *mechanism*, not just as a ramp. Byte-identity proven where
it decides — 40/40 golden track hashes unchanged at 250k **and** 750k, every score
identical to the digit, while 20/20 moved at 150k — and parity below it: 1,440
paired compiles at {75k, 150k, 225k} pooled −0.18, spec-clustered bootstrap SE 0.98,
95% CI [−2.11, +1.72], per tier −0.28 / +0.07 / −0.33, zero contract-pass flips,
identical validity and missing-contact counts.

The ten entries are kept below because the *reasons* are the reasons not to rebuild
them: each records what its ramp bought, what re-measurement said about the
mechanism underneath it, and — in GA-02's and GA-07's cases — a live non-budget
mechanism that shares its code path and did **not** go away.

All eleven reads shared one input, `currentCompileBudgetFrames`
(PLB-19), and all were pinned at or below 250k (§2b). They are listed compactly.

**RETIRED · GA-01 arc-length room smoothing** — `arc_placement.ts:1547-1572`, constants `:643-646` · `compileBudgetPressure(50k, 50k)` → generation · saturated · static · never binds. `lerp(linearRoom, smoothstep(linearRoom), pressure)` — a blend between two *shapes* of the same ramp, so a mature budget **polarizes** the mid-band while the endpoints are identical at every budget. Feeds both the arc-length attempt span and `denseSpacingPostLengthCap`. `e2cb116` 2026-06-09; the span endpoints were re-widened 1.45 → 1.85 on 2026-07-28 **without** revisiting the blend — the textbook stale-sweep signature, moot only because the blend is saturated.

**RETIRED · GA-02 post-contact ride-out curvature bias fade** — `:1854-1869`, constants `:588-597` · `compileBudgetFade(50k, 50k)` → generation · saturated · static · never binds. `±0.6 × fade` on the tangent-interpolation exponent, driven by a low-discrepancy roll. `30ddcd3` 2026-06-07; the docstring records "full curvature lifts scarce-budget COMPLETION a lot (25k +19, 50k +54) but DILUTES converged high-budget quality". **The one exception that keeps it alive**: line `:1861` forces `curveFade = 1` when `impactCurveP > 0`, and then the bias is lerped toward `−IMPACT_CURVE_FRONTLOAD = −1.6`. So at every benchmark budget the random exploration span is dead and the impact carrier's deterministic front-load is the only surviving curvature bias.

**RETIRED · GA-03 impact-template lane rate** — `:2032-2037`, consumed `:2298`, constants `:392-393` · `compileBudgetPressure(50k, 50k)` → generation · saturated · static · never binds. `eligibility = (1/3)·budgetP·firing·roomP` against a low-discrepancy roll: pool *injection*, not forcing. `573c11c` 2026-06-10; the non-budget gates were re-measured 2026-07-27 and found at or past optimum (lane rate 0.66 = −4.06, attempt ramp 2 = −6.63, all three together = −17.47), but the **budget** gate was not part of that re-measurement.

**RETIRED · GA-04 template scoop 6f → 5f** — `:2039-2051`, constants `:385-390` · `compileBudgetPressure(100k, 100k)` × a spec-level mean-impact gate ≥ 0.55 → geometry-shape · saturated · static · never binds. `lerp(6, 5, pressure)` — two hand-picked values, not a law. `a6164f5` 2026-06-10, absent from the 2026-07-27 template re-measurement. Composes with `IMPACT_SEGMENT_REFINE = 2` (accepted 2026-07-27) on the same physical quantity, tuned seven weeks apart.

**RETIRED · GA-05 template hold segment** — `:2053-2111`, constants `:395-405` · `compileBudgetPressure(125k, 125k)` × four non-budget pressures → geometry-shape · saturated · static · never binds. **Reaches exactly 1.000 at 250k** — the knee sits precisely on the suite's lowest tier. `f74e164` 2026-06-30, one day after GA-09's identical pair, when 250k had just become the scarce tier: the ramp was *designed* to be inert in the measured range. The stronger form of the same idea (`IMPACT_SUPPORT_WINDOW`, a hard support floor) is a measured null.

**RETIRED · GA-06 impact-arrival pop-arc blend** — `:2136-2158`, constants `:333-346` · `compileBudgetFade(50k, 50k)` → geometry-shape · saturated · static · never binds. Blends the post-contact launch toward the symmetric pop arc. **Fully off at every benchmark budget, and the code says so.** Uniquely in the file it was re-measured on Benchmark V2 (2026-07-26) and the verdict held: forcing full pressure at every budget is **−10.59 headline** and moves the impact bias not at all (−0.1713 → −0.1738). Superseded by the steep-arrival dive, which owns the same physical lever at every budget.

**RETIRED · GA-07 steep-arrival scarce zero band** — `:2186-2200`, constants `:544-554` · **raw** `currentCompileBudgetFrames < 200_000` — the only site in the file that does not go through the smoothstep helper → generation · **threshold** · static · **never binds**. Below 200k a quarter of the pool keeps a flat/rising launch as a completion reserve; at and above 200k every pool member carries at least `SPAN_FLOOR = 0.5` of the commanded dive. The comment is unusually candid: the mature band was zeroed because "the branch was unreachable — every one of the 44 development cases authors a max impact above the 0.68 threshold", and the scarce band was kept because "nothing in the canonical suite exercises [it]". **The repo explicitly documenting that it carries an unmeasurable branch on purpose.** Strongest cross-module coupling in the territory: `DELIVERY_EFFICIENCY = 1.10` alone *costs* 250k (−3.7) and the breadth law's anchor pays for exactly that (+7.0 there), so the dive's command size and SC-01 are complements at their peak — and since breadth is linear in B while the dive command is budget-flat, the ratio of command size to attempts-to-land-it is itself budget-dependent.

**RETIRED · GA-08a/GA-08b redirection CONTACT and ENTRY angle shifts** — `:2338-2391`, constants `:106-122` · `compileBudgetPressure(125k, 75k)` and `(125k, 50k)` → geometry-shape · saturated · static · never binds. ±4° of contact-surface rotation and up to 10° of final-approach bevel. Two arms of one function with different spans from the same start — a tell that both were fitted per-arm on the V1 grid rather than derived. Priced by their own ablation at **±2 headline** against the curvature carrier's +53, and the block comment gives the mechanism reason: the nudge "moves the contact INSTANT, not the through-window rotation, so it leaves achieved impact flat". Shares `ARC_LEN_ROOM_DENSE/SPARSE_FRAMES` with GA-01 — one spacing ruler, two unrelated mechanisms.

**RETIRED · GA-09 impact-curve elevation-room onset** — `:2414-2427`, constants `:152-158` · `compileBudgetPressure(125k, 125k)` × two spec-profile pressures → geometry-shape · saturated · static · never binds. Lowers the impact carrier's onset from 0.25 to 0.20 on specs with elevation range and cadence room — i.e. it moves the onset of the mechanism the file prices at **+69.5 headline**. The second of the two knees landing exactly on 250k. The *base* onset is the best-evidenced constant in the file (swept both directions twice, 2026-07-26 and 2026-07-27); the elevation-room variant was in neither sweep.

**RETIRED · GA-10 impact post-turn extra angle** — `:2484-2514`, constants `:298-319` · `compileBudgetPressure(100k, 100k)` → geometry-shape · saturated · static · never binds. Up to 28° of the ceiling-aware missing redirection, only for asks above 0.60. Comment states the design intent: "selection can keep normal launches, while 50k completion remains protected". Re-measured 2026-07-26: opening it to mid-band asks and removing its carrier factor moves impact bias by 0.004 and **costs 21.93 headline with 20 lost valid runs**, and the comment draws the physical conclusion — "after the catch the rider LEAVES the surface, so a wider post-contact angle just drops the line away beneath it".

**GA-11 aim top-K maturity gate** — `aim.ts:310-311`, constant `:287` · `aimCompileBudgetFrames < 100_000` → lookahead-spend · **threshold** · static · **never binds**. Below 100k the aim lane runs on `sorted[0]` only (K = 1), byte-identical to the pre-lane default. Introduced `b0ea7a8` at 150k, moved to 100k on 2026-06-23 (+2.9 headline, entirely at 100k). Docstring: extra bases cost ~2.5× more probe frames and "at small budgets that probe cost starves the compile". **GA-15 is the live version of exactly this mechanism**, protecting the same failure mode inside the range everybody runs; only one of the two can fire.

**GA-12 `aimTopKBasesEffective` high-budget arm — the second law** — `aim.ts:310-327`, constants `:264`, `:290-297` · `aimCompileBudgetFrames` → lookahead-spend · **LAW** · static · **binds**
`K = B < 100k ? 1 : (B >= 200k ? max(4, round(6·B/250k)) : 4)` → 6/12/18/48 at 250k/500k/750k/2M. Each base costs 5 metered probe rides plus up to 2 exact evaluations plus 1 air-matched variant. `d5731e5` 2026-07-29, the day after the breadth law, replacing a flat `HIGH = 6` whose history reads exactly like the defect the design rule names ("gained the mature budgets but cratered 125k, −18.9"). The anchor reuses a previously accepted measured value (6 bases at 250k, `cd3db1b`); **the exponent 1.0 was chosen by analogy with SC-01, not fitted**, and the out-of-sample check the breadth law passed has no recorded equivalent here. Matched by construction: `K/nCand = 6/27 = 0.2222` exactly at every budget, so the lane's *share* of the budget is conserved by design while its absolute cost triples from 250k to 750k. The lane is measured at 17% of a 250k `frontier_dense_recovery` compile. The open question is whether α = 1 is right for a *refinement* device when the same design rule says selection-side widening should be flat. UNVERIFIED: no benchmark attempt record for `d5731e5` was found.

**GA-13 `AIM_LOW_AIR_TOPK_MAX` — a flat ceiling a law grew out from under** — `aim.ts:323-325`, constants `:288-289` · `gap.targets.air <= 0.30`, **not** a budget signal, applied *after* the law → lookahead-spend · **flat-by-verdict** · static · binds. `min(baseK, 3)`. `103197e` 2026-06-23, fitted when `baseK` was 4 — a 25% trim. It survived `baseK → 6` (50%) and `baseK → 6/12/18` (50%/75%/**83% at 750k**, 94% at 2M) without being revisited. The stale-sweep rule firing exactly as described: the constant's meaning went from "trim one base on low-air gaps" to "low-air gaps get 17% of the aim lane at 750k". Low-air gaps are precisely the family the pacing note names as needing breadth. Three coherent options — keep flat (defensible if the cap encodes a real fact about grounded ride-outs), scale it with the same law, or express it as a ratio of `baseK` — all one-liners, all directly measurable.

**GA-14 air-matched variant, now emitted per base** — `node.ts:270-273` (caller), `aim.ts:742-746`, `:1042-1157` · none directly; its *count* is `K`, so it inherits GA-12's law → generation · budget-blind · static · binds. One deterministic closed-form ride-out-length edit per base, costing one exact `tryCandidateLines` evaluation. Emission went from 1 per pool build to **K** per pool build in `d5731e5`. At 750k the lane's exact-eval count per pool build is up to `18 × 3 = 54` candidates on top of 81 sampled ones — the lane can contribute 40% of the pool by count. See discrepancy 1.

**GA-15 aim-lane deadline throttle** ★ the live signal that reaches pool *content* — `node.ts` `AIM_LANE_DEADLINE_BASE_SHARE:128` / `aimLaneBases:130`, caller `handoff.ts:3805` · **`underFullDeadlinePressure(margin)`, live per pool build** → lookahead-spend · **LIVE-ADAPTIVE** · live · binds
**Was a lane KILL; is a two-level throttle since `4325370`.** At full deadline pressure the lane keeps `max(1, round(0.4·K))` bases — 2 of 5, deliberately the rolled head's own retention, and **machine-enforced since `05cc801`**: `handoff.ts` throws at module load unless `AIM_LANE_DEADLINE_BASE_SHARE === HANDOFF_FORWARD_EVAL_TOP / HANDOFF_CANDIDATE_POOL`, because `node.ts` cannot import those constants without a module cycle. It is a contract, not a convention, and re-tuning either pool constant now fails loudly instead of silently splitting the two consumers — instead of not running at all: K = 4 → 2 at 150k, 7 → 3 at 300k, 18 → 7 at 750k, floor 1, which is the lane's own accepted scarce-budget policy (`AIM_TOPK_MATURE_BUDGET_FRAMES`). The kill was the one shape the campaign's rule forbids, and it is gone with `AIM_LANE_PACE_SUPPRESS`. The kill's own accept still stands as the evidence that the *mechanism* pays: `2847922` 2026-07-28, N=8 **+6.97** (SE 4.90), validity 1020 → 1032, **three of four strata exactly 0.00** — it never fires on a compile that finishes, so 85% of headline weight was byte-identical. Motivating measurement: on `frontier_dense_recovery` @250k the lane charged 42,859 of 250,851 frames (17%) on a compile that never finished; suppression took that cell 78 → 108 of 123 committed contacts. Set and cleared around a single pool build in a `finally`, so it scopes exactly one `getCandidatesSorted`, including inside rescue lanes but not inside rollouts, and gated to the pre-completion phase. **This is still hazard H2**: it changes pool *content* under a key that does not mention it — but it stays **binary**, which is exactly the exposure Phase 0a measured at **0 cross-state re-reads over 895,457 frozen-content reads in 336 compiles**, and Phase 1a re-measured the shipped scope at **3 cross-state reads at 150k and 2 at 750k** against the full bundle's 764 + 540. Continuous gradation of K needs the pool-memo key fix first (patch drafted, unshipped) because under gradation the exposure becomes ~265 lane-sensitive frozen reads per compile. **Two 2026-08-04 additions.** Its trigger is now measured: full deadline pressure is **0.40%** of pre-completion pool builds at 750k and exactly 0 at ≥ 1.5M (LC-32), so at the promoting budget this lane is nearly dormant — the −5.29 consumer-off reading in §6.4 was taken on the V1-shaped signal and its engagement no longer holds. And it **stays pre-completion-only on an argument now written at the call site**, not by omission: when the post-completion phase gate was re-opened as a magnitude, only the head ramp was scoped in (SC-09, SC-26); the aim throttle was deliberately left out because its cost saving is exactly the "cheaper pre-completion loses capability" failure GA-16 already paid for.

**GA-16 aim base-fit reuse** — `aim.ts:246-258`, consumed `:988-1005`, caller `handoff.ts:3830`/`:3842` · `telemetry.hasCompletion` — a live *phase* bit, not budget → lookahead-spend · **LIVE-ADAPTIVE** · live · binds. When allowed, the zero-knob probe row is projected rather than simulated, saving 1 of 5 probe rides per base. `d5c9e1a` → `d70f245` (unconditional, 2026-07-31) → `0a6d592` (retired the same day): the governed 750k N=48 run of the unconditional arm was **−2.5760 with capability −19.27 and two validity losses**, so it was scoped back to post-completion only. **The existence proof of the safe pattern**: a live signal that changes only *cost*, never what is produced, needs no cache-key change. The freshest evidence in the territory that "cheaper pre-completion" loses capability.

### OB — objective, readiness, evaluation, accounting · 22

**OB-01 `objective_control.ts` exponent matrix** — whole file (219 lines) · none → objective-shape · budget-blind · n/a. Sweep infrastructure only. One documentation defect, **fixed `d7c839f`**: the header claimed unset readiness "preserves `objectiveBlendReadinessPowerForSpec`'s per-spec 0.75", describing a compiler that no longer existed (discrepancy 4). The minimal-emission rule is a **correctness** requirement, not tidiness: `handoff.ts` disables its per-spec exponent gates whenever `LR_OBJECTIVE_SETTLED_POWER` or `LR_OBJECTIVE_FUTURE_POWER` is *present at all*.

**OB-02 `proposalUtility` exponent globals** — `objective.ts:134-175`, `:593-631` · budget indirectly, via `setProposalUtilityPowers` at `handoff.ts:1275` (reset) and `:1316` (OB-03) → objective-shape · contract · static · binds. `settled^a · projected^b · recalibrate(readiness)^c`; `objectivePower(v, 1)` returns `v` unchanged, so the default tree is bit-identical. **Hazards H1 and H9 both live here.** The source comment forbids re-associating the three multiplications: the algebraically identical role-split regrouping differs on 61% of random inputs by ≤ 3.6 ulp and **cost 14 headline points at N=48** — and the corollary is worth as much as the warning, that a 14-point swing can be produced with zero semantic content. The globals are reset by an explicit `setProposalUtilityPowers()` call rather than by `core/compile_lifecycle.ts`'s registry (H7) — correct today, fragile tomorrow.

**OB-03 `objectiveBlendCurrentPowerForSpec` — the budget-shaped objective exponent** — gate `handoff.ts:2576-2589`, `continuousObjectiveCurrentPower:2611-2683`, `plateauPressure:2685-2694`, constants `:876-893`, call site `:1316-1319` · `policyBudget` **and** a static spec profile, **once**, before gaps are sliced → **objective-shape** · **saturated (both budget terms)** · static · binds
The only place in the compiler where budget changes *what is being maximised* rather than how much is spent finding it. `power = 1 + 0.5·(five pressure products)`, clamped to 2.5, returned as `undefined` when within 0.02 of 1 (so unselected specs are bit-identical). Budget enters through exactly two opposed smoothsteps: `mature = smoothstep((B−150k)/100k)` — **exactly 1.0 at every B ≥ 250k** — and `scarce = 1 − smoothstep((B−150k)/75k)` — **exactly 0.0 at every B ≥ 225k**. So at every canonical budget the exponent is a pure function of the spec profile. `932bbce` 2026-07-06 introduced all of it; the M87/M94 signature literals came from `6738a15`/`0fdf9d9` two days earlier. Not re-swept since, while the forward-eval head, breadth law and branch limit all moved. The call site's parameter is named `targetBudget` but is passed `policyBudget` — a naming trap. **Migration note of record**: making this live is not blocked by the scale-free rule but by H1 and H2 — a pool sorted under exponent 1.0 at frame 40k and re-read at frame 180k returns the frame-40k ordering, and forward-eval scalars from different objective epochs would be compared against each other. The ordered thing is to re-sweep the static ramps. **Folding the duplicated 150k constants onto `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES` was considered in Phase 3 and deliberately NOT done** — this map suggested it and was wrong: OB-03's two are ramp *anchors* in `(B−start)/span`, the maturity constant is a *scale* in `B/(B+scale)`; the values coincide, the meanings never did, and folding them would couple the objective's knee to the reuse and tail throttles. **KEPT AND PINNED** (`d7c839f`): shipping the mature branch unconditionally, together with LC-05, costs −13.0 / −7.6 / −2.2 mean score per run at 75k / 150k / 225k and turns 0 missing contacts into 236 across 480 runs at 75k with 17 contract-pass flips — scarce-budget completion behaviour, so the docstring now carries those numbers and states what a law would have to be scale-free in before it could replace them.

**RETIRED · OB-04 `objectiveBlendReadinessPowerForSpec` — budget-gated, retained, not applied** *(deleted `d7c839f`, with `OBJECTIVE_MATURE_MIN_BUDGET_FRAMES`, the `LR_M114/M75/M108/M115` env names, six profile predicates, `medianGapOrZero` and thirty M-constants; `resolveProposalUtilityPowersForSpec` keeps only the settled exponent and `study_objective_powers` reports one exponent and says what happened to the other)* — `targetBudget < 200_000 → undefined`, then a three-signature ladder → objective-shape · **DEAD** · never bound. Production call site deleted 2026-07-28; the source records the measurement: **+0.00 with SE 0.19, the tightest null the campaign has produced**, and re-pointing the softening at readiness alone was +0.17 with SE 0.20. Surface was 5 of 44 development cases. Worth keeping in the map because *it was misnamed and the mismatch was live*: M75 was accepted when the objective was `current^p × readiness^q` and 0.75 reached readiness alone; after `6d064b0` (2026-07-24) the same value was applied to the ballistic projected-quality term as well, unrevalidated, for four days. The archetype of the stale-sweep failure — **the constant did not change, the meaning of the term it multiplied did.** VERIFIED (one diagnostic caller).

**RETIRED · OB-05 `objectiveElevationReadinessForSpec` — zero call sites, ever** *(deleted `d7c839f`)* — `targetBudget >= 200_000` **and** a hard pressure threshold at 0.20 → **DEAD** · never bound. Discontinuous in both arguments. It kept `OBJECTIVE_MATURE_MIN_BUDGET_FRAMES` and the `LR_M114_*` env name alive, which made both look load-bearing to a reader and to grep; that was the whole cost of keeping it, and it was the cheapest true cleanup in the territory.

**OB-06 `recalibrateReadiness` / the readiness floor** — `objective.ts:88-145` · `LR_OBJECTIVE_READINESS_FLOOR`, module load; **no budget** → objective-shape · budget-blind · n/a. `readiness → floor + (1−floor)·readiness`; default 0 returns the input bit-identically. Motivation recorded from measurement: readiness's level asymmetry (0.06–0.33 vs settled/projected 0.46–0.72) is *structural* — it is a product of up to five factors while the others are single scores. A floor is a statement about the model's tail reliability, which does not get more or less reliable with compute.

**OB-07 `outgoingProjectionCache`** — `objective.ts:194-197`, used `:408-474` · none → plumbing · budget-blind · n/a. **Hazard H4.** `WeakMap<BallisticLaunchObservation, Map<string, projection>>` keyed on `endFrame:endsWithContact:includeElevation:includeAmplitude`. The key covers everything the projection depends on and nothing else — deliberately not the objective exponents (scoring happens after the lookup) and not the two `LR_PROJECTED_*` flags (both downstream of the cached object). Invariant to preserve: **any future budget- or pace-dependent input to `projectBallisticGap` must enter this key.**

**OB-08 projected-outgoing air deliverability ask** — `objective.ts:476-511`, `air_policy.ts` · the **gap's** `frameCount` and `K_BOUNCE_LANDING`; no compile budget → objective-shape · budget-blind · n/a. A *frames* dependence that is not a *budget* dependence — the distinction a keyword sweep gets wrong. `e142a44` 2026-07-25 under the exact-kernel default, marked in-source as an **UNREPRODUCED LEAD**: the saturation argument stands on its own, the measured deltas have not been re-taken since the closed form became the default.

**OB-09 recoverability weighting and the compile-scoped env read** — `objective.ts:218-290`, `env_flags.ts` · `LR_PROJECTED_RECOVERABILITY` via `compileScopedEnv`, sampled once per compile epoch → objective-shape · budget-blind · n/a. **Hazard H6, and the repo's codified statement of the compile-constant principle**: a compile is the coarsest scope that gives up nothing observable, because compilation is synchronous. A raw `process.env` read costs ~268 ns against ~0.8 ns cached, and this one flag was **4.4% of an entire compile** at one read per scored gap. `RECOVERABLE_SIDE_WEIGHT = 0.5` re-bracketed 2026-07-29 at a clean interior optimum (off −2.17, 0.25 −1.76, **0.5 shipped**, 0.75 −1.94). The pattern is not applied uniformly: `projectedAirDeliverableEnabled()` still does a raw `process.env` read on the same hot path.

**OB-10 `readiness.ts` model load and ablation** — whole file · env only, module load; no budget → readiness feature · budget-blind · n/a. Model retrained `03b0555` and promoted `d4715fa`, both 2026-07-31. **Diff inspected**: those commits touched `readiness.ts`, `readiness_scoring.ts`, the artifact, the trainer and the studies, and did **not** touch either feature module. No budget term entered the model.

**OB-11 `readiness_scoring.ts`** — whole file · `LR_READINESS_AIR_FIT` only → readiness feature · budget-blind · n/a. **Hazard H5** (`validatedArtifacts` WeakSet, `featureProjections` WeakMap, both keyed on a per-process singleton). `readiness = catchability · speedFit · airFit · impactFeasibility · elevationFit`, with `airFit` forced to 1 in production on measured grounds: a lookup on authored asks and two gap durations scores 0.01228 against the trained component's 0.01022, and a lookup on the predicted boundary scores 0.03843 against a global mean of 0.03925 — the boundary carries essentially no air signal. The extractor/model split (`READINESS_FEATURE_NAMES` = what the compiler can observe; the artifact's `featureNames` = what it uses; containment, not identity) is what made feature selection possible at all.

**OB-12 `readiness_features.ts` / `readiness_base_features.ts`** — 303 + 182 lines · none → readiness feature · budget-blind · n/a. The 88-column production vector. **Every "frames" term is a gap duration, not a budget**; the normalization anchor is 32 frames (~0.8 s), a spec-scale constant. `READINESS_FEATURE_TRANSFORM_ID` binds coefficient meaning to feature meaning and was correctly *not* moved by the 2026-07-31 retrain (which moved the target-semantics id instead).

**OB-13 `readiness_model_artifact.ts`** — 510 lines · **zero occurrences of `budget`, `env` or `process`** → readiness feature · budget-blind · n/a. The learned component's inference path is provably budget-blind.

**OB-14 `sim_frames.ts` — the charging contract** — 49 lines (37 of them the contract comment), implementation `scripts/lib/detector.ts:400-560` · this **is** the signal → plumbing · contract · binds. Charge is the **delta in `engine.getLastFrameIndex()`** across each detector extraction — frames the engine actually integrated; lr-core caches simulated frames so re-reading costs zero. In production only `handoff.ts` reads it (~40 sites); nothing in objective/readiness/sample/solver/node/register/polish does. No budget logic inside the API. `getFrameCount()` (read count) over-counts by 12–27× and is explicitly not the work unit. **Cheat-resistance**: you cannot establish a candidate's physical viability without simulating its frames, which is the property the minimal-simulation rule protects and the closed-form ballistic adoption restored. Non-reentrant; Web Workers get their own module instance.

**OB-15 the hard frame limit is a dead arm** — `detector.ts:502`, `:530`, throw sites `:442 :474 :556 :588 :605 :651`; re-export `sim_frames.ts:45` · **DEAD** · never binds. Zero callers repo-wide (§2e). Consequences: the budget is enforced entirely by cooperative polling and a single long extraction overshoots with nothing to stop it; `PhysicsFrameLimitExceeded` is unreachable and the `try/finally` in `forwardArcValue` guards a hypothetical; the per-frame incremental-charging branch — the *more* accurate accounting — is dead. **Do not delete casually** (it is the only available runaway guard for a future streaming mode) and **do not enable casually** (H8: it changes charge granularity, hence checkpoint timing, hence output).

**OB-16 `refundSimFramesTo`** — `detector.ts:547`, used `handoff.ts:6313` · `LR_FWD_EVAL_CHARGE` → observation · study-hook · n/a. Rollout frames are **charged by default (honest)**; `=0` refunds them, isolating forward-eval quality from cost. With charging on, rollout + start-eval frames are **20.5–29.1%** of all charged sim frames (measured 2026-08-03, §6.5 — the forward-eval campaign's 54%/46% predates the ballistic cutover), so this refund arm is the single largest possible distortion of the budget axis. It must never become a default — the same class of rule as the prohibition on full-path probe modes. **Used deliberately once, as an arm rather than a default**: it is the free-judge counterfactual that ceilings the whole "cheaper rollouts" family at **+1.78 ± 1.31 per cell at 750k**, and it is what prices a rollout frame (~0.087 points per 1% of the budget) so that a dose can be chosen by arithmetic (SC-24). This is the *only* legitimate un-charging mechanism in the compiler; anything else that simulates without charging is a bug.

**OB-17 `getCandidatesSorted` — the pool memo** — `node.ts:110-138`, `:162-219`, `:221-311`, `:400-419` · budget only through `nCand` → selection · contract · static · binds. **Hazards H2 and H3.** Memo keyed on `(seed, nCand)`. A larger cached prefix answers a smaller later request exactly; a smaller prefix is *extended* by replaying the RNG draws — both rest on `solver.ts`'s prefix property. **The key contains the seed and the count and nothing else, while the cached value is the fully sorted, lane-augmented pool**, so everything that influences that ordering is an implicit part of the key: the three objective exponents, `rankQualityEnabled()`, `aimEnumEnabled()`, `aimTopKBasesEffective`, and `aimLaneDeadlineThrottled` (named `aimLanePaceSuppressed` until `4325370`). Today all but the last are compile-constant, which is exactly why the memo is sound. The file header is itself a corrected provenance note: it used to claim the count was budget-independent, flagged as "a dangerous thing to believe while debugging reproducibility".

**OB-18 `register.ts` — scorer-based selection, immune to objective drift** — 121 lines · none → selection · budget-blind · n/a. Lexicographic: `contract_passed` dominates; among passing, `axis_quality` then `drift_quality`; among failing, `full_score`; ties keep the incumbent. `FLOAT_EPS = 1e-9` serves cross-platform determinism **and** "budget stability" — the only place in the codebase where "budget" denotes output stability rather than compute. **The load-bearing negative result for the whole hazard analysis**: the register does not read `proposalUtility`, readiness or any objective exponent, so an objective that drifted mid-compile could never make it return a worse leaf than one already seen; it could only change which leaves are offered. It is also the source of §2a's `improved`.

**OB-19 `sample.ts` / `solver.ts`** — 289 + 105 lines · none (verified by full read, import graph, and grep) → generation · budget-blind · n/a. `solver.ts`'s documented **prefix property** — `solveOneGap(K')` extends `solveOneGap(K)`, adding samples never reorders earlier ones — is what makes OB-17's budget-derived `nCand` safe.

**OB-20 `optimizer/polish.ts`** — 104 lines · none; gated at the call site → generation · budget-blind · n/a. Polish **adds** leaves and never reorders, and the original leaf is never touched, so it cannot break monotonicity or the prefix-superset invariant. Its physics cost is metered honestly.

**OB-21 `types.ts` + `core/compile_lifecycle.ts`** — 60 + 53 lines → plumbing · contract · binds. **Hazard H7.** `CompileBudget = number` ("plain positive frame counts"); each budget is an independent compile run. The reset registry replaced a hand-maintained list that "silently drifted the moment someone adds a global and forgets the call, and the failure is invisible". `sim_frames.ts` and `sample.ts` register; **`objective.ts`'s exponent globals do not.**

**OB-22 `score.ts` `RuntimeBudget` — a different budget entirely** — `score.ts:116-125`, `:223-236`, `:336-353` · wall-clock milliseconds → observation · budget-blind · n/a. Recorded so a keyword-driven map does not file it as a compile-budget mechanism. `scoreTimedDriftReport` has **no production or benchmark caller** — only `tests/v0_score.test.ts`; the register calls plain `scoreDriftReport`, which has no time term. `score.ts` imports exactly one module (`types.ts`), so its independence from the compiler is structural.

### SLK — slack and deadline production (`budget_model.ts`, `optimizer/deadline.ts`) · 4 live + 1 retired

**SLK-01 `TRAVERSAL_BUDGET_MODEL_V1` — the difficulty yardstick** ★ do not migrate — `budget_model.ts:20-26` · none (a frozen coefficient triple) → allocation · contract · static · binds. `D(spec) = 5848.254347 + 796.19669·feasibleContacts + 29.587736·durationFrames`, source recorded in the file as one 250k golden archive. The full argument for freezing it is Cluster E1. Correctly-layered use already exists: `budget_telemetry.ts`'s `structuralRemainingWork` uses the same coefficients **as pure shape**, deliberately free of the budget law, and the estimator artifact applies `(B/refB)^α` on top. The deadline margin (SLK-05) briefly took that function's V1 default, putting V1's coefficients under the live deadline signal as well as under the difficulty coordinate; **Phase 3 measured that fourth consumer out on 2026-08-03** and `deadline.ts` passes the artifact's coefficients explicitly (§4, §6.4). The silent default remains the hazard: a new caller inherits a regression it did not choose.

**SLK-02 `predictFirstCompletionFrames`** — `:28-40`, `feasibleContactFrames:80-85` · spec only → allocation · contract · static · binds. Denominator of `budgetSlack` and of `stats.predicted_first_completion_frames`; it was also the `predictedFrames` prior inside SLK-04, and that consumer is gone. Contacts are filtered by `secToFrame(t) >= K_BOUNCE_LANDING`, the same physical feasibility floor handoff applies, so predictor and search share one contact set. Known defect: the large fixed intercept (~5,848) dominates at small budgets, so slack ratios become meaningless far below the fitted grid.

**SLK-03 `traversalBudgetSlack` — the static slack coordinate** — `:42-48`, produced `handoff.ts:1348` · `policyBudget / D(spec)` → allocation · contract · static · binds. Complete consumer list: SC-07, SC-10, SC-13, SC-14 (both arms), SC-12's dispatcher, `rankedOptions.config.budgetSlack` threaded into every `scoreCandidateForHandoff` call and every extra lane, and `stats.budget_slack`. Outside production: `calibrate_budget_estimator.ts` (as the `budgetExponent: 0` fallback fit), `budget_telemetry.ts:684`, and three test files. Exactly linear in B by design. Measured distribution in §2d. **Its four thresholds (1.5, 2.5/2.0, 2.75, 10) are jointly calibrated against V1 and must move together with any recalibration of `D`.**

**RETIRED · SLK-04 `observedTraversalBudgetSlack` — the live pace coordinate** ★ the reference implementation *(deleted `4325370` with both consumers; the ARCHITECTURE is what SLK-05 kept, see Cluster E3)* — `policyBudget`, **live `getSimFrames()`**, `deepestSeenGap`, `gaps.length`, `predictedFrames` → **deadline-pressure** · **LIVE-ADAPTIVE** · live · bound
```
if (!(B > 0) || !(totalGaps > 0))      -> Infinity
if (!(deepestGap > 0) || !(spent > 0)) -> B / max(1, predicted)   # exactly the prior
evidence  = min(1, spent / B)
measured  = spent * totalGaps / deepestGap                        # the compile's own pace
return B / max(1, (1-evidence)*predicted + evidence*measured)
```
**No fitted constants at all** — the blend weight *is* the spend fraction. Its motivating example is recorded in source: on `frontier_pickup_progression_shifted` at 250k the structural model predicts 164,440 frames against a first complete traversal at 271,068, because a regression on contact count and duration cannot know that one spec is expensive per contact. Two consumers only (SC-09, GA-15), both spend throttles, never mode switches, never anything that changes what a value *means*. `Infinity` post-completion is the one binary edge in an otherwise continuous mechanism, and it fires exactly when repair takes over. `measured` charges *all* spend including dead-end branches to the gaps reached — the same bias `perGap` has in repair (LC-15), which `f96dc03` fixed only on the repair side. **Why it was replaced rather than extended**: its accuracy. Against realized remaining first-completion work over 129,481 archived pre-terminal observations its median APE is 262% / 53.8% / 22.5% / 82.4% / 108% / 118% at 75k…2.25M, and it goes *anti*-correlated with the realized margin above 300k; its median value runs 0.63 → 6.83 across the same range, so its constants 1.0 and 1.5 encoded "the budget is about 150k" at least as much as "this compile is behind". As a completion gate at 150k, `pacedSlack < 1` false-alarms on **92.6%** of healthy compiles and `< 1.5` on 100%.

**SLK-05 `CompileDeadline` — the live deadline margin** ★ the one answer to "am I behind?" — `optimizer/deadline.ts`, constructed `handoff.ts:1413`, read `:1827` · `policyBudget`, **live `getSimFrames()`**, the traversal's own gap position, the incumbent's measured `costToEnd`, and the estimator's pure functions → **deadline-pressure** · **LIVE-ADAPTIVE** · live · **binds**
`margin = max(0, policyBudget − spent) / estimateRemainingBudgetWork({structural, path, pace, progressFraction})`, `Infinity` where no work is left. The structural suffix is tabulated once per compile; the path term is the incumbent's measured cost-to-end profile once it exists (the same array repair sizes its ceilings from), and the pace term — `spent · structural / progressed`, the recorder's `episode_pace` computed from state the search already owns — is dropped once a path exists rather than double-counting repair's spend. Pace is blended geometrically at the structural progress fraction, so at the first node the margin *is* the static structural estimate. Deterministic in `(spec, seed, budget)`: every input is fixed at construction or a counter the search owns.
Three properties worth stating separately. **(1) The pace term is load-bearing, not decoration**: the pace-free arm broke the capability stratum outright — `frontier_dense_recovery` 0/4 valid at 750k, suite −21.6 — because the structural coefficients under-predict a spec that costs 2–3× the fitted rate per contact, and the pace-free margin then sits at median 2.78 (no pressure) on a compile that first completes at 88% of its budget. The blend recovers 3 of 4 cells; suite −21.6 → −0.8. It is a policy-side override of one artifact selector field (`paceSchedule: "linear_progress"` against the artifact's `"none"`), declared in the module where the reason lives; the artifact JSON, recorder, analyzer and fingerprint are untouched. **(2) The structural base is the ARTIFACT's shape** — `deadline.ts` passes `BUDGET_ESTIMATOR_TRAVERSAL_MODEL` explicitly, because `structuralRemainingWork`'s default is `TRAVERSAL_BUDGET_MODEL_V1` and taking it silently was the deviation Phase 3 closed (+52.89 / +26.85 on two canonical capability groups, 0 completions lost; §4 and §6.4). **(3) Accuracy, now a measurement of the base computed here**: median APE 30.5% / 10.2% / 6.9% / 5.3% / 4.4% / 6.9% at 75k / 150k / 300k / 750k / 1.5M / 2.25M, Spearman 0.80–0.97 against the realized margin, a 3–25× win over `pacedSlack` at every budget in and out of domain. Policy consumes the raw point ratio at every budget; the estimator's `applicability` nulling governs what the *recorder* may claim, not whether the predictor is usable.
**(4) The post-completion base is established at FIRST ADOPTED COMPLETION, not when repair starts** (`d84c71c`, `handoff.ts:1807-1830` + `:1922-1928`). `runRepairPhase` used to be the only writer of `incumbentCostToEnd`, so between first completion and the first restart — and over the *whole* of any compile below the 100k repair minimum — `marginAt` read a null profile as "still racing to the end" and applied the episode-pace term, which post-completion divides COMPILE-GLOBAL spend by the node's OWN depth and collapses the margin on healthy nodes. One walk per compile at adoption fixes it; the walk is free of charged work (every node on the incumbent's path was already built and `extendNodeCached` memoizes). Measured effect: post-completion mean margin **5.76 → 10.94** — the old reading was collapsing ~47%. Below the repair minimum both reach maps stay empty by design so every entry is −1 — no measured suffix, the structural tail correctly stands — and the pace term is still retired, which is the part that was wrong. **Latent when it landed and load-bearing now**: it is the reason the post-completion consumer question could be re-measured honestly at all, and the re-measurement is what closed it (§6.6).
**(5) The pace term was re-priced at the promoting budget and KEPT** (`7d90184`, through `LR_STUDY_PACE_WEIGHT`, SC-26): weight 0 — the term gone — reads **−0.016 ± 0.381** over 44 × 8 × 750k, biting at all on only 83 of 352 cells, so the −21.6 that bought it does not survive the base swap this entry already flagged as making that number stale. It stays on an argument about a regime the panel cannot see: `episode_pace` is the lowest-error component at 75k/150k/300k and the structural base's worst regime is exactly there. The measured null is "free to keep at 750k", not "free to delete"; deleting it is a simplification candidate whose evidence surface is a 250k panel plus the standing reading.

### PLB — plumbing, propagation and entry points · 20

**PLB-01 `CompileHandoffOptions` — the one contract** — `handoff.ts:170-201`, `:1122-1137`, `:1246-1282` → plumbing · contract · binds. One scalar budget per call = one independent full run from scratch. No anytime sharing, no remaining-budget carry; the budget is both the stop condition and the input to the spend-control policy. Only `budget` is required; every other option is documented as a diagnostic hook that production leaves unset. **The contract has no "remaining budget" input** — any episode accounting lives in the caller.

**PLB-02 `maxNodes` backstop** — `:1279-1282`, constant `:803-812`, enforced `:1908` · `opts.maxNodes ?? max(50_000, targetBudget)` → stopping · contract · static · **never binds**. **The model of how a budget-derived bound should be written**: scale-free by construction, no fitted operating point, and its comment states the measured headroom (worst canonical spec ≈ 672 nodes @200k ≈ 0.003 nodes/frame, ~300× headroom). It reads `targetBudget`, not `policyBudget` — the only place on the search path where the *hard* budget enters a search parameter. `nodesExpanded` is compile-global and accumulates across main + repair + resumed.

**PLB-03 the estimator artifact (budget law)** — `budget_estimator_model.json`, `budget_estimator.ts` → **policy** (see below). Intercept 23860.07, contact 3699.92, duration 18.35, refB 750_000, **α 0.825**; calibrated domain **[250k, 1.5M]**; kinds `["initial"]`. Point model fitted `c9058fa` 2026-08-01 (schema v2) on 135,796 samples, 14 family groups, 5 double-blocked folds. Domain extended to 250k 2026-08-03 with the point model and the bands frozen byte-identical, re-validated on a fresh 1.20B-frame six-budget corpus at `31c2beb`: coverage 96.1/97.1/95.5/93.3% at 250k/300k/750k/1.5M, APE 4.6/5.5/3.5/3.1%, 44/44 paired cells bit-identical. **150k was refused a third time** (87.3% coverage with the shipped bands, 92.4% refitted; the `high_water`/`withPath` cell reads 33.4% because the path component is 19% biased there); **1.5M at 93.3% is the artifact's binding weakness and is pre-existing**. Must be re-fit whenever a breadth ramp, the forward-eval gate or the branch limit changes. `budget_telemetry.ts` the RECORDER is still observation-only — no search, geometry, scoring, repair or RNG decision reads a payload — but **the ARTIFACT is not, on EITHER layer**: since dividends Phase 3, `deadline.ts` reads `structural.*`, `combination.baseMode` and both correction factors; and `handoff.ts` `repairRestartCeilingFrames` reads `interval.byEventAndPath.start.{withPath,withoutPath}.upperRatio` on every repair-bearing compile, where `pickFeasibleWeakGap` turns it into which gap a restart runs from (LC-16), whether an upstream anchor is skipped (LC-18) and the per-restart frame ceiling (LC-19). **CORRECTED 2026-08-03: `interval` is POLICY-BOUND, not claim-inert** — the effective multiplier `0.940948 × 1.223889 = 1.1514×` on the measured cost-to-end *is* the retired `feasMargin`, now sourced from a fitted band, exactly as LC-19 says. Moving `structural.*`, `combination.*` **or** `interval.*` is a compiler change needing a paired eval; only `applicability`, `metrics` and `modelId` are inert, and the applicability domain was the only field the 250k extension touched (the point model and the bands were frozen). The whole file is inside `COMPILER_SOURCE_PATHS`, so the benchmark's identity check already treats any edit as a compiler change; the fingerprint was right and the prose was wrong. `calibrate_budget_estimator.ts --freeze-point-model` therefore freezes the bands too, and `--refit-intervals` is the loudly-warned promotion-class opt-out.

**PLB-04 env overrides that touch budget** → plumbing · contract · binds. `LR_REPAIR_MIN_BUDGET` 100k (never blocks) · `LR_FWD_EVAL_MIN_BUDGET` 75k (never blocks) · `LR_REPAIR_MAX_ATTEMPTS` 64 (never reached) · `LR_REPAIR_MAX_UPSTREAM` 4 (unmeasurable) · `LR_REPAIR_MAIN_MARGIN` 1.0 (at optimum) · `LR_REPAIR_UPSTREAM_ORDER` · `LR_ONLINE_CONTINUATION` · `LR_PROBE_BUDGET`. **The two raw-budget gates (75k forward-eval, 100k repair) are the last binary budget thresholds in the *lifecycle*** — both inert at every live operating point, and both would switch on hard under a fine-grained episode schedule. **CORRECTED 2026-08-03: they are not the last in the search.** `aim.ts` carries two more, wrapped around an otherwise clean law (GA-12): `aimCompileBudgetFrames < AIM_TOPK_MATURE_BUDGET_FRAMES` (100k) collapses K to 1, and `>= AIM_TOPK_HIGH_BUDGET_FRAMES` (200k) switches the law on. Both are inert at ≥ 250k, like the two named here, but they are hard gates on a raw budget and belong on the same list. **2026-08-04**: `LR_FWD_EVAL_BASE` joins this surface as the composable shape override (SC-25), and the twelve default-off study gates are inventoried separately in SC-26 — of those only `LR_STUDY_NCAND_SCALE` touches a budget-derived quantity (the breadth law's output), and it refuses rather than clamps like the rest. The one raw-budget literal deleted this era is SC-13's, which was neither an env override nor a gate but a ramp (`7d7348b`).

**PLB-05 `run.ts` CLI** — `--budget` default **200_000**, telemetry **trace** (the only caller defaulting to trace) → entry.
**PLB-06 `golden.ts` v1** — `--full` 75k/150k/225k/350k/475k/550k, 12 slots, headline weight ∝ budget; `--probe` 75k/200k/500k. Superseded as the decision gate; still the only wide-ladder harness. Gotcha of record: `golden.ts` only parses `--flag=value`, so `--jobs 32` silently runs at the default → entry.
**PLB-07 worker timeout model** — `compilerWorkerTimeoutMs(B) = clamp(round(B·0.35·3), 120s, 600s)`, `golden_suite.ts:213-231` · **saturated**, never binds. The 600 s cap binds above **571,429 frames**, so 750k, 1M, 1.5M and 2.25M all get an identical timeout, and at 2.25M the model's own arithmetic (787 s) already exceeds it. Unreviewed since a 30.7% engine speedup → entry.
**PLB-08 Benchmark V2 runner** — canonical 250k/500k/750k, 8 seeds/budget; probe 250k/500k, 3 seeds, actual seeds asserted disjoint; `--comparison-budgets` must be an ordered subset, `--exploration-budgets` must equal the ladder → entry.
**PLB-09 campaign bootstrap — the live promotion gate** — **750_000 exactly** (`REQUIRED_BUDGET`, exact-match not default), 48 seeds, 44 cases; `analyze_campaign_baseline.ts` refuses any archive whose budgets are not `[750000]` → entry.
**PLB-10 `scale_study.ts`** — default 100k/200k/250k/500k/600k/1M, arbitrary via `--budgets`; the **only** trace-level producer the family analyzer can group; no promotion authority. The budget-law panels ran here (1.18 billion charged frames across six panels) → entry.
**PLB-11 `compiler_matrix.ts`** — a whitelist of exactly two ladders; anything else throws → entry.
**PLB-12 production pipeline** — `select.json .budget`; **all three live songs = 1_000_000**; `DEFAULT_BUDGET` from `93c5f97` 2026-06-17 with no recorded provenance. See discrepancy 14 → entry.
**PLB-13 production retry and park** — a failed compile is discarded whole and the lane draws `seed + 1` at the identical budget; after `MAX_ATTEMPTS_PER_BUNDLE` (500) the song is parked. **The only outcome-reactive retry loop in the tree, and it reacts in seed space, never in budget space.** `attempts`/`qualified` are printed at exit and never persisted, so production's true cost-per-bundle is unrecorded → entry.
**PLB-14 `produce/characterize.ts`** — `--budget` defaults to the same select.json value; writes the characterization the floors are read off → entry.
**PLB-15 `study_compile_panel.ts`** — `--budget` (200k) **plus `--policy-budget`**: the only policyBudget seam in the tree → entry · study-hook.
**PLB-16 `portfolio_oracle.ts`** — `EXPLORATORY_BUDGETS` 35k…75k step 5k; the only live `compileBudgetCurve` consumer; no recent archives observed → entry · study-hook.
**PLB-17 invariant and determinism gates** — `VERIFY_OPTIMIZER_BUDGET` 40k, `verify_determinism` 50k, `compile_hash` 20k, `compile_bench` 50k, `verify_compiler_behavior` [61k, 100k, 150k, 200k], `calibrate_corpus` 20k. **All sit below the repair gate and most below the forward-eval gate** — they exercise the scarce-budget path exclusively → entry.
**PLB-18 harness resume** — Benchmark V2 `--resume` and `scale_study --import-budgets` skip whole compiles that already succeeded, keyed by `sourceId\0budget\0seedSlot\0actualSeed` and guarded by a run-plan fingerprint; failures re-run **at the same budget**. `golden.ts`'s "checkpoint" is a naming collision. **No harness anywhere calls `compileHandoffFromSnapshot`** → entry.

**RETIRED · PLB-19 `setCompileBudgetFrames`** *(the geometry commit `9a3dabd` left it as a documented no-op because `handoff.ts` still called it; `d7c839f` deleted both, with the import, the call and four test references)* — setter in `arc_placement.ts` · `policyBudget`, exactly once, before any spec work → plumbing · contract · static · bound. `currentCompileBudgetFrames = max(0, frames | 0)` — a per-compile constant, never updated mid-compile, **not even for the repair phase**. This is the mechanism that makes "the budget-aware geometry sees the budget it was given, not the budget it has left". The determinism reason is stated in the comment and is not soft: `_candidatesCache` is keyed on `(seed, nCand)` and a node may be rebuilt at a larger `nCand`, so a consumed-frame signal would make the second build disagree with the first. **If a future controller wants geometry to see remaining budget it must add a second channel, not mutate this one.** The `| 0` truncation would wrap above 2^31 — irrelevant at ≤ 2.25M, a latent trap.

**PLB-20 `setAimCompileBudgetFrames`** — `handoff.ts:1278`, setter `aim.ts:302-304` · `policyBudget`, once → plumbing · contract · static · binds. Identical shape to PLB-19. This is the *static* budget channel while `setAimLanePaceSuppressed` is the *live* one — **the aim lane is the one subsystem that reads both.** Neither global is reset between the main search and the repair phase, so a repair attempt sized against a much smaller local ceiling still generates full-policy-budget geometry and full-K aim. Harmless today; it is the exact seam a live signal would have to be threaded through, and it is currently unguarded.

---

## 10. Sources

The five territory surveys this map merges are not in the repo. Everything
load-bearing from them has been re-verified here and is reproduced above; the
verification evidence is §2 and the archives and commits it names.

Repo documents this map depends on: `docs/forward-eval-metrics.md` (the M-set and
the deadline companion, 2026-08-04), `docs/compiler-improvement-campaign.md`
(the audit table at `:1152-1164` and the sign-flip table at `:960-995`),
`docs/budget-law-study.md`, `docs/budget-control-design.md`,
`docs/difficulty-model-study.md`, `docs/repair-roi-study.md`,
`docs/repair-selection-study.md`, `docs/compile-budget-telemetry.md`,
`docs/benchmark-v2-context.md` (budgets, weights and seed policy — this entry
used to name `docs/benchmark-v2-operating-points.md`, which has never existed in
the tree), `CLAUDE.md` (the minimal-simulation
rule), and `benchmark/v2/campaign-baseline.json` (the scale contract).

The program's own record: `docs/budget-unification-plan.md` (phases, success
criteria, standing regime), the commits `1e22721` `4325370` `9a3dabd` `a56b8ed`
`d7c839f` `f7d054f` `ccfd58d` `c26cfca` `05cc801` (the post-program review:
`firstReachOf` min-merge, the `estCostUpperOf` zero-ceiling guard, the load-time
same-share assert) and `69d71a8` (its promotion at exact parity), and the four
reverted probes `dad1e69`
`407dfb2` `9a80915` (each with its `Revert` commit), and the five N=48 eval
artifacts under `generated/benchmark-v2/eval/cached-N48-2026-08-0*`.

The forward-eval value campaign's record (`docs/forward-eval-value-plan.md`,
phases 0–5 plus six mandate iterations), commit by commit — the ledger this
reconciliation is against:

| commit | what it did to the compiler or to the evidence |
|---|---|
| `6ec8f3f` | Phase 0 — truth-in-labeling, calibrator freeze safety (`--freeze-point-model` implies frozen intervals), the `paceSchedule` load-time assert, `structuralRemainingWork`'s required model parameter, tests for the two untested promoted mechanisms. Byte-identical; this map's Phase-0 re-stamps. |
| `d84c71c` | Phase 1 — the deadline telemetry block (LC-32), the pre-repair margin fix (SLK-05 property 4), the tail-lane slack fix, hot-path env binding. Byte-identical on four cells except the one behaviour candidate. |
| `3674b2f` | promotion of `tail-lane-slack-750k` (595.98). c2 decided as an omission, not policy: **−0.0615 [−0.2219, +0.0989], INCONCLUSIVE**, validity 2112/2112, force-promoted as a correctness fix on a well-powered null. |
| `4ff32ae` | Phase 2 — the metrics layer (`docs/forward-eval-metrics.md`, M0–M10), the Tier-1 reader (`npm run benchmark:v2:fwd-metrics`), the study hooks recommitted with the `dead_hop1_refuted` class, M9/L3 filed (SC-16). |
| `916d5db` | Phase 4 — the composable base override and `adaptiveArmsApply` (SC-25), scoped aim suppression on wide bases, the first four study gates (SC-26); the pool-cliff hypothesis falsified and the W = 6 cliff diagnosed as the max-reducer's optimism bias. Byte-identity proven three ways. |
| `9f58697` + `1ecbc1b` | **promotion of `base-depth1-750k` (596.41)** — production base `greedy:2 → greedy:1`, arms untouched: **+0.43 [−0.62, +1.49], P(+) 86.05%**, representative +1.39 significant, capability −2.37 booked as debt. |
| `7d7348b` | offenders d3 + c1 deleted from the impact arm (SC-13); the two-counters lever falsified from the archives; RD6 and ASK035 killed on the promoted tree. Byte-identical at 750k/500k/250k, standing 250k reading PARITY 0/528. |
| `860d990` | the capability debt's mechanism named (speed, deciles 1–3, real composed-track information) and the two-counters falsification recorded with its mechanism. |
| `bce18e9` | A-FIX-1 falsified — the de-diluted leaf kept as a default-off study arm carrying its own verdict (§6.6 (5)) — plus the post-completion pressure counters (LC-32's post pair). |
| `468f54f` | the post-completion consumer vein CLOSED with its mechanism (Cluster D1), A-FIX-2's coordinate killed at pre-registered thresholds, the capability debt ACCEPTED. |
| `7d90184` | the deadline anchors, the pace term and the breadth law all closed at the promoting budget; `N_CAND_FLOOR` pinned as untestable there (SC-01, SC-03, SC-09, SLK-05). |
| `fd734a5` | the impact arm's own depth and width closed (SC-13); the in-scope record complete. |

Session
write-ups that are **not** in the repo and whose load-bearing numbers are
reproduced above: `phase0/signal-comparison.md`, `phase0/h2-cache-transitions.md`,
`phase0/signal-comparison-table.md`, `phase1/1b-design-note.md`,
`phase3-rest/EVIDENCE.md`, and the `p1a-reject` / `p1b-collapse` arm archives.
