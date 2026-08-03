# Budget unification plan — **CLOSED 2026-08-02 at `884173f`**

The plan of record for replacing the compiler's fragmented budget-awareness with
one coherent architecture, built on the 2026-07-30…08-01 scaffolding (calibrated
estimator, budget law, telemetry) and the survey in
[`budget-aware-map.md`](budget-aware-map.md). Written 2026-08-01 at `3f2462c`.

**Outcome in one paragraph.** Two promotions — `deadline-margin-750k` (Phase 1a,
one live deadline signal replacing three, promoted at a documented −0.28 after the
mandated investigation) and `deadline-two-anchor-750k` (the coherence rider,
−0.10 at parity) — for a drift ledger of **−0.37 against a −3.0 floor**. Three
candidates were measured and not promoted: Track R's pool = 7 and tree width = 4
re-tests (both inconclusive-negative with a validity loss, both reverted, both
verdicts re-stamped as current) and Phase 1b option D (rejected, then closed as
measured rather than parked as untried). Phase 2's reranking lane was closed by a
decisive offline null; Phase 3 deleted the geometry ramp field and the dead
objective and preview machinery, and kept three families with the measurement that
says why. **Three of four success criteria are met; the fourth — no capability
regression — is not, and is the program's outstanding debt.** Scoring and the
follow-up register are at the end of this document. The map is reconciled to the
shipped compiler and is the place to read what the compiler now does; this file is
the record of how it got there.

## The target architecture

Two coordinates, one signal each, nothing else:

- **Difficulty** (static, per compile): `TRAVERSAL_BUDGET_MODEL_V1` slack.
  Chooses the *shape* of spend — breadth law, aim-K, geometry. Static by reason,
  not legacy: it is the yardstick controller behaviour is measured against
  (`budget-law-study.md`: the spend law B^0.82 must not occupy this slot).
- **Deadline** (live, per node): one margin signal,
  `remaining policy budget / estimated remaining work`, from the calibrated
  estimator's pure functions. At t=0 it *is* the static estimate; it updates per
  node; it survives first completion; it scales with budget through the law.

Program success criteria, checkable at the end:

1. The map's §4 signal table collapses from four rows to two.
2. Zero mechanisms remain in the map's "fake budget-aware" class (saturated ramp
   presented as adaptive): each becomes a law, an honest constant, or is deleted.
3. Cumulative headline drift of all coherence promotions stays above the floor.
4. No capability-stratum regression across the program.

*(Scored in "Closing the program" at the end of this file: **1 MET, 2 MET, 3 MET,
4 NOT MET**.)*

## Standing regime (all phases)

- **The gold standard, as evidence — the campaign owns the decision.** Every
  candidate goes through the 48-seed sequential V2 eval. Its output — boundary
  verdict, P(+), CI, point estimate, validity, strata — is **input**, recorded
  in full, never a hard gate. The promotion rule: **promote unless the negative
  boundary was crossed or something looks wrong.** Boundary accept → promote.
  Inconclusive — positive, parity, or mildly negative — → promote deliberately
  (`rebaseline --force`, reason + the eval's numbers recorded); a positive
  point estimate at an insufficient P(+) is still a positive point estimate.
  Negative boundary or any anomaly (validity loss, stratum collapse, weird
  telemetry) → **investigate before judging**: a result is rejected only when
  investigation confirms real harm or a real defect, and a defect means
  fix-and-rerun, not abandon. The sequential calibration itself is deliberately
  NOT loosened: strict boundaries keep "accept" meaningful as evidence, and the
  `--force` path is the campaign's flexibility, by design.
- **Drift budget (the backstop).** A running signed ledger of coherence
  promotions' headline deltas starts at 0; floor **−3.0 points**. The
  default-promote posture operates freely above the floor; at the floor,
  promotions wait until a win repays the ledger. This is the guard against
  bleeding to death in −1s, nothing more.
- **One deadline signal.** No new mechanism may compute its own "am I behind?".
  New consumers read the margin module.
- **Bundles are candidates.** Mechanisms that share meaning move in one
  candidate; if a bundle wins where members were neutral, the synergy is thereby
  measured. Decomposition is the response to a negative, not the default.
- **Stale-sweep ledger.** Every phase names the constants whose meaning it
  changes; the map is amended so no superseded sweep survives as a live verdict.
- **Comment hygiene.** Comments die or update in the same commit as their code.
- **Instruments.** Promotion: the 750k N=48 gate. Evidence below 250k: golden v1
  grid (75k–550k) and scale_study — non-promoting, but not blind. The v1
  harness is used opportunistically: its low-budget baseline reading gets
  refreshed the first time a phase needs a before/after there (Phase 1's
  evidence gate), not as a standing maintenance duty. Making low budgets a
  promoting surface again is a separate decision, parked until the adaptive
  machinery has produced something worth promoting there.
- **Observation invariant.** The telemetry *recorder* never drives. Policy and
  recorder may share the estimator's pure functions; they never share state.
- **Preview power is computed against the ACTION SET, not the grid.** *(Added
  2026-08-02 from Phase 1b.)* A preview that changes 14 cells cannot see a failure
  mode that fires on 4% of changed cells — P(zero collapses) = 0.55, so a clean
  preview was a coin flip and was read as evidence. Before a preview is allowed to
  license an eval, state how many cells the candidate can change and what failure
  rate the preview could detect on that many. If the answer is "not the one that
  would kill it", the preview is a smoke test, not evidence.
- **A sequential candidate re-probes its composition.** *(Added 2026-08-02 from
  Phase 1b.)* When a second candidate in the same mechanism family is evaluated
  after its own preview, and the tree has moved in between, run a composition probe
  against the CURRENT tree before spending the eval slot. Phase 1b's preview ran on
  the pre-rider compiler and its eval on the post-rider one; the four-arm autopsy
  afterwards showed the rider was innocent (and in fact halved the damage), but that
  is a fact the probe would have supplied for a fraction of the cost, before the
  ledger entry.

## Phase 0 — prerequisites (DONE 2026-08-01)

Two measurements, no compiler changes. Full write-ups in the session archive
(`phase0/h2-cache-transitions.md`, `phase0/signal-comparison.md`); decisive
numbers and their design consequences here.

**0a — H2 cache transitions: exactly zero, with a boundary.** 895,457
frozen-content cache reads across 336 compiles (with real suppression exposure:
82/88 v2 compiles at 150k entered suppression; 4,845 pace flips) → **0
cross-state re-reads**. The zero is partly empirical, not structural — the
frozen path is taken by the flag's writer, it just never coincided — so it is
closed by two unit tests plus the transition counter kept as a debug assertion.
**It does not license a continuously graded K**: under gradation, exposure
becomes ~265 lane-sensitive frozen reads per compile. Consequence: Phase 1 may
swap the signal and soften the kill to a two-level throttle (same binary cache
exposure as today), but continuous gradation of pool-affecting knobs waits for
a cache-key fix. Side finding: golden v1 cannot measure this mechanism
(2 suppressed calls in 160 compiles).

**0b — signal vs outcome: the margin dominates everywhere it is defined, and
the one exception is contractual, not informational.** As a completion-risk
gate at 150k: margin false-alarms on **1.2%** of healthy compiles at 100%
recall; `pacedSlack < 1` on 92.6%; the behind-boolean's 331 firings are all
doomed compiles but late (already inside `margin < 1`), and at 750k all its 72
firings are false alarms. On remaining work the estimator wins 3–25× at every
budget, and `pacedSlack` is *anti-correlated* with the realized margin above
300k. Three consequences: (i) `hard_completion_margin`'s **nulling at 150k is
the applicability contract, not the predictor** (10.2% median APE there) — the
policy module therefore consumes the raw point ratio directly, with measured
per-budget accuracy documented, while the recorder keeps nulling calibrated
*claims*; (ii) ramp re-anchoring: Youden-optimal margin threshold ≈ **1.25**
replaces `pacedSlack`'s 1.0 — bracketed, not assumed; (iii) SC-09/GA-15 are
effectively a ≤150k mechanism today (ramp engaged on 100% of 150k observations,
2.3% at 750k), and completion risk is degenerate above 150k on this suite — so
the bundle's 750k value rides on post-completion quality allocation, not on
rescue. Noted for later: the artifact's weight-zero `episode_pace` component is
the *most accurate* remaining-work estimator exactly at 75k–300k — a candidate
input for the margin's low-budget estimate in a future revision.

## Phase 1 — the unification bundle

**STATUS: 1a PROMOTED, RIDER PROMOTED, 1b CLOSED AS MEASURED. Phase complete.**

**1a — PROMOTED** (`4325370` + `a56b8ed`, baseline `deadline-margin-750k` at
595.63). One deadline signal; three competitors deleted; consumers
pre-completion-scoped. The official eval read **−0.2778, SE 0.1098, P(+) 0.74%**
with the negative boundary crossed — promoted deliberately after the mandated
investigation confirmed the cost inherent, fully localized (three frontier
sources; every other stratum exactly 0.00; validity 2112/2112 unchanged), and the
pressure axis exhausted two-sidedly (all three consumers load-bearing at −17.50 /
−5.29 / −12.25 when switched off; every constant bracketed on the shipped signal
with no direction beating it; the two capability groups want opposite pressure and
separating them needs a forbidden per-family gate). Ledger: −0.28 booked.
**Capability debt −1.85 recorded against success criterion 4**, repayment lane =
Phase 1b option D (rollout-depth pressure — cost-side, the GA-16-safe shape). The
discovered-and-refuted subtlety worth keeping: the old paced blend's 750k value was
NOT lane-kill pessimism (it never fired there); softer-but-broader partial pressure
completed frontier specs earlier. Evidence: scratchpad p1a-reject (15 arm
archives), reproduced as a table in map §6.4.

**The rider — PROMOTED at parity** (`ccfd58d` + `c26cfca`, baseline
`deadline-two-anchor-750k` at 595.53). Three coherence changes measured together:
SC-16's verdict moves onto the full-pressure anchor and `deadlineAtRisk` is deleted
(two live anchors instead of three, and the verdict and the ramp's saturation are
now provably the same number); repair affordability and ceiling sizing replace the
flattened `feasMargin` fudge with the estimator's own fitted upper interval
(start/withPath, upper 1.2239, effective 1.1516 on raw measured cost); and the
three repair-context telemetry fields the selection study proved necessary. N=48
**−0.097, P(+) 25.5%, capability +0.08, validity unchanged**; ledger −0.10, sum
−0.37.

**1b — CLOSED AS MEASURED, not parked** (`407dfb2`, reverted `f6ba630`). Option D
shipped as a graded per-node depth lottery and read **−5.4132, SE 2.7255, REJECT,
capability −36.09, validity 2108/2112** against a preview of +0.675 headline /
+4.50 capability / zero validity loss. The investigation is in map §6.1–§6.3 and
the short version is that the mechanism is a lottery with a good expectation and a
fat tail: it touches only cells whose baseline first completion lands past 0.8·B
(0 of 93 earlier cells changed, 95 of 99 later ones), where it is worth +16.4 per
improved cell and −50 headline points per lost completion; the whole upside is +11
to +15, so it breaks even below a 0.3% loss rate and the measured rate is 0.43% to
5.68% depending on share. The preview could not have seen it: 14 changed cells give
P(zero collapses) = 0.55. The rider is exonerated by a four-arm decomposition — on
the pre-rider compiler the same candidate loses 7 completions instead of 4.
**Reopening conditions**, one bounding the rate and one removing the tail: (i) cap
the graded share at 0.2, the only arm with zero collapses on the promotion block
(pooled +108.05 across three blocks) at the cost of most of the upside; or (ii)
make the depth decision revisitable — re-deepen when the shallow rollout fails to
place the contact — which converts the lottery ticket into a retry.
Post-completion depth pressure was measured in the same session and is **null**
(−0.018 over 194 changed tracks: repair reinvests the freed frames at unchanged
yield), so the 46.3% unpaced tail stays open with its two obvious shapes spent.

**Goal.** One live deadline signal; the three competitors deleted; deadline
pressure extended past first completion (46.3% of a 750k budget currently
unpaced).

**Changes (one candidate):**

1. New `optimizer/deadline.ts` (name indicative): margin from search-owned
   counters + estimator pure functions. Pre-completion: law-scaled structural.
   Post-completion: the measured cost-to-end profile. Recorder untouched.
2. Forward-eval head narrowing (SC-09) reads margin; ramp endpoints re-anchored
   in margin units from 0b's mapping, then bracketed.
3. Aim-lane control (GA-15) softens from lane-kill to a **two-level throttle**
   (full K vs reduced K) on the margin — same binary cache exposure 0a measured
   at zero, closed by 0a's guard tests; continuous gradation is explicitly
   deferred behind a pool-cache key fix.
4. The online-continuation lane (SC-16) reads the margin verdict; its private
   spend-vs-progress comparator is deleted.
5. Post-completion: the same narrowing law extends into the repair/resumed
   phases as deadline pressure (magnitude only — re-keying per-decision quality
   on remaining budget measured −0.41 to −4.47 and is out of scope).
   **NOT SHIPPED.** Measured at ≈ −0.5 per cell over 225 of the bundle's 245
   changed tracks, with a new cross-state pool-cache exposure class (764 reads at
   150k, 540 at 750k) that Phase 0a could not see; the shipped 1a scope carries a
   residual of 3 + 2. The signal is live for the whole compile and observable;
   only the consumers are gated. 1b tried the cost-side form of the same idea and
   it is null. Item 5 is the open half of this phase and it is documented as such
   in the follow-up register.
6. Deletions in the same candidate: `pacedSlack` production and consumers,
   `isOnlineTraversalBehindSchedule`, their comments. `budgetSlack` consumers
   are split by role: difficulty-shape uses stay on V1 (documented as such);
   deadline uses move to the margin.

**Gates.** Pre: 0a satisfied (test or cache key), 0b non-inferiority. During:
determinism suite (telemetry-level byte identity; (spec,seed,budget)
reproducibility), full vitest, analyzer clean on fresh traces. Decision: N=48
sequential eval; accept on boundary; parity → drift-budget promotion; golden v1
{150k, 300k} evidence reported alongside.

**On an unexpected result.** Investigate with the scaffolding until understood
— the telemetry, the archives, and per-member decomposition (the natural cut is
pace-signal swap / throttle upgrade / post-completion extension) are the tools,
not a script. What we want from this phase is one signal and a paced tail; how
many iterations that takes is whatever the evidence demands.

**Hazards addressed:** H2 per 0a; H1 untouched (no objective change); no new
mode triggers; register and reset registry untouched.

## Phase 2 — repair selection

**STATUS 2026-08-02: COMPLETE — the reranking lane is CLOSED by a decisive
offline null (`1e22721`) and the residual landed in the coherence rider
(`ccfd58d`), promoted at parity as `deadline-two-anchor-750k` (`c26cfca`). No
compile was spent on a selection candidate, which was the study's purpose.** [`repair-selection-study.md`](repair-selection-study.md)
replayed every ranking in item 1 against 3,520 archived compiles and issued no
admission ticket: ceiling-exclusion is bit-exactly inert (0 of 320,092 gaps sit
at a `weakAxisCeiling`), scorer-weighting prices at −0.001 [−0.117, +0.112],
and error-per-estimated-frame — the only policy that moves anything — reads
−0.913 on the one decision the archives can price. The zero-yield pool is a
coin flip, not a population (observed 18.6% against 19.1% modelled), so there
is nothing for a ranking to route around. What survives is item 2's
affordability change, which needs no ranking passenger, and item 4's telemetry,
which the study upgraded from a ride-along to *the real deliverable* and grew
to three fields. Both ride in the **coherence rider** candidate together with
the SC-16 anchor unification left over from Phase 1a. Item 3 — the
acceptance-prediction model — is untouched by the study and remains the follow-
up, because it targets `p`, which is what the independence finding says the
zero-yield pool is made of.

**Goal.** Spend the repair phase's 45% of budget on anchors that can pay.
Sizing is closed (candidate A: +0.01; ceilings advisory); *selection* has never
been evaluated, and 18.6% of 750k repair spend buys zero.

**Changes, cheapest evidence first:**

1. Offline replay study (no compiles): re-run anchor selection policies against
   archived incumbents — scorer-weighted axis error instead of raw SSE;
   error-per-estimated-frame; exclusion of axes already at `weakAxisCeiling` —
   and score expected yield from the measured acceptance/gain distributions.
2. The replay prediction informs the design and sets expectations; it is not a
   gate — an eval costs ~25 minutes and the promotion posture is
   move-forward. (Context for calibrating expectations: candidate A's null
   showed ceiling-accuracy effects at 750k sit near +0.0.)
   Margin/interval-quantile affordability (attempt iff upper-bound cost fits)
   rides in the same candidate as whichever ranking wins the replay.
3. If the zero-yield pool survives (1)–(2), the acceptance-prediction model
   (readiness-style features, trained offline from archives) is the follow-up —
   it is a model, not a knob, and gets its own proposal.
4. Three additive telemetry fields ride along (`up` offset and round index on
   repair attempts, so `maxUpstream`/`upstreamOrder` become priceable, plus the
   incumbent's weakness key at the pick, whose absence is the binding limit on
   every offline replay of the selection).

**Gates.** The replay study's prediction is the admission ticket; N=48 decides.
**Hazard:** LC-22 — any change to the attempt sequence reseeds every downstream
restart, so repair candidates are only ever evaluated whole, never as local
perturbations.

## Track R — stale-verdict re-tests — **COMPLETE 2026-08-02, both rows held**

The nearest-term headline material in the map, independent of every phase: six
knobs whose "flat / at optimum" verdicts were all measured in one 2026-07-28
session against a breadth law and scorer ruler that have both since been
replaced (map Cluster B). Two of the six were live questions with a fresh
positive datum behind them; both were re-tested under the deadline-margin ruler
and **both verdicts held, negatively, each at the cost of one valid run**:

| row | re-test | result |
|---|---|---|
| SC-05 pool = 7 | `dad1e69`, reverted `9c3b03c` | **−1.1017, SE 1.2977, P(+) 20.0%, inconclusive**; capability −7.32, legacy_regression −4.85, representative +0.60, music +1.16; validity 2111/2112 |
| SC-06 tree width = 4 | `9a80915`, reverted `884173f` | **−1.5932, SE 1.6581, P(+) 17.1%, inconclusive**; capability −10.52, legacy_regression +0.97, representative −0.14, music −0.32; validity 2111/2112 |

Flat 5 and flat 3 are now CURRENT verdicts, re-stamped in map Cluster B and in the
SC-05/SC-06 catalog entries. The −1.73 identification ambiguity (discrepancy 12)
was resolved before the branching row was read, as planned.

**What the track taught, and it is worth more than the two rows.** The stale-sweep
rule cuts both ways. Both re-tests were opened *because* a stale reading was
positive (pool = 7 at +0.48 with a catalog-sensitivity CI excluding zero; flat-4 at
+0.74), and both came back more negative than the stale number. A verdict measured
under a replaced ruler is not biased in a known direction — it is simply unknown,
and the only way to know is to re-run it. The remaining four rows (SC-19, SC-20,
SC-21, and SC-09's superseded bracket) were not re-run as sweeps: SC-09's constants
no longer exist in that form, and the maturity trio got a family-level measurement
in Phase 3 instead (flattening the shared shape is −14.6), which is evidence about
the shape they ride on rather than about their individual exponents.

## Phase 3 — the ramp field — **COMPLETE 2026-08-02**

**STATUS.** Three commits, no promotion needed and none taken: `9a3dabd`
(geometry group deleted), `d7c839f` (the singles, the maturity family, the dead
objective and preview machinery, the comment ledger), `f7d054f` (the four
benchmark-case breadth rules). All three are byte-identical at 750k and were
validated below 250k on golden v1 at 1,440 paired compiles per arm. The
fake-budget-aware class is empty — **and it emptied by three routes, not one**:
deletion where the ramp bought nothing (geometry, the four case rules, SC-18,
OB-04/05, `feasMargin`), *documented pinning* where the mature branch was measured
to cost real completions below 250k (LC-05, OB-03, SC-02's two broad rules), and
**reclassification where this map had simply got it wrong** — `maturityPressure`
is asymptotic, not saturated, with +35% travel across the benchmark's own grid,
and flattening it measures **−14.585 with a capability collapse**
(`rapid_pickup_frontier` −55.93, validity 176/176 → 175/176). Two of the three
routes end in "keep it", which is why the phase's bar was truth rather than
scale-freedom.

**Instrument hazard hit once and worth keeping**: golden's workers import the
compiler *per task*, so editing the tree during a run silently mixes compilers —
785 of 1,440 rows in the first sub-250k baseline came back as a `ReferenceError`
for a constant the run was in the middle of deleting. Never edit the tree during a
golden run.

**Goal.** End the fake-budget-aware class: every saturated ramp becomes a
scale-free law, an honest constant, or is deleted — and its comments tell the
truth. "Way better than inert" is the bar; perfect scale-freedom is the
ceiling, not the entry requirement.

**Method per group** (seven groups in map Cluster C): decide by two questions —
does the mature branch dominate at every budget actually run (then delete the
ramp and ship it unconditionally, byte-identity proven at 250k–1M by hash
checks)? Is there real sub-250k value to preserve for the creative/production
pipelines (then write the law and validate on golden v1 75k–225k evidence)?

**Order:** geometry group first (largest, cleanest decision, three defensible
positions already written in the map); the `maturityPressure` family second
(per-consumer — two of its four consumers already measured as losing laws, so
honest constants are the likely outcome); the singles (start pressure, the
objective exponent) last. `feasMargin` is off this list: Phase 2's coherence
rider deleted it rather than shaping it, replacing the hand-swept multiplier
with the estimator's own fitted upper quantile — the third of the two
questions, "is there a calibrated quantity that already answers this?".
Cluster A dead-code deletions and the comment ledger ride with whichever
commits touch their files.

**Gates.** Byte-identity at benchmark budgets where claimed (hash proof);
golden v1 evidence where behaviour changes below 250k; parity promotions under
the drift budget.

## Explicitly out of scope

- Replacing V1's difficulty slack with the spend law (measured harmful).
- Budget-adaptive objective, register, or readiness-model selection (H1, E4,
  H5).
- Re-keying per-decision quality knobs on remaining budget (measured harmful).
- The 150k-regime estimator treatment and any acceptance-surface change —
  separate decisions, tracked in `compile-budget-telemetry.md` and the map.

## Closing the program

**Success criteria, scored.**

1. **MET.** The map's signal table is two rows: `budgetSlack` (difficulty, static,
   spend shape) and the deadline margin (deadline, live, spend pressure). Three
   competing "am I behind?" definitions were deleted — `observedTraversalBudget-
   Slack`, `isOnlineTraversalBehindSchedule`, and the rider's own third anchor
   `deadlineAtRisk`, which was created and removed inside the program. The
   recorder's fourth estimate is still contractually observation-only.
2. **MET.** The fake-budget-aware class is empty, by three routes: **deleted**
   (the eleven geometry reads with GA-06 as a mechanism, the four case-named
   breadth rules, SC-18, OB-04, OB-05, `feasMargin`, `setCompileBudgetFrames`);
   **kept and made truthful** with the measurement that justifies the pin (LC-05,
   OB-03, SC-02's two broad rules — deleting them costs −13.0 / −7.6 / −2.2 per run
   at 75k / 150k / 225k and 236 missing contacts); and **reclassified** — the
   `maturityPressure` family was never saturated (+35% travel across the grid) and
   flattening it measures −14.585 with a capability collapse. The comment ledger is
   paid in the same commits as the code.
3. **MET.** Ledger **−0.37** against a **−3.0** floor: −0.28 (Phase 1a, promoted at
   documented cost) and −0.10 (the rider, parity). Nothing else was promoted.
4. **NOT MET.** The capability stratum is **−1.85** below where the program found
   it, entirely from Phase 1a, and the repayment attempt made it worse before being
   reverted. This is the program's outstanding debt and it is stated as such rather
   than netted away: the deadline signal is live at 750k where its predecessor was
   effectively absent, and the frontier sources pay for that. **Two named
   reopening lanes**, both from map §6.1: rate-bounded graded depth pressure at
   share 0.2 (zero collapses on the promotion block, pooled +108.05 across three
   seed blocks, but most of the upside gone), and revisitable depth — re-deepen the
   rollout when the shallow one fails to place the contact, which removes the tail
   instead of paying for it. Neither is implemented and neither is free.

**Follow-up register.** Everything below is parked with its evidence pointer, not
forgotten and not scheduled.

| item | why it is parked | evidence |
|---|---|---|
| **Revisitable rollout depth** — **OVERTAKEN** | the only 1b shape that removes the collapse tail rather than bounding its rate; unimplemented. **CLOSED as measured in the dividends campaign's Phase 1**: the premise is falsified, and the width residue that survives it is filed in that campaign's own register. | map §6.1; `docs/budget-dividends-plan.md` Phase 1 |
| **Margin base-shape swap + re-anchor** — **OVERTAKEN: DONE AND PROMOTED** | the shipped structural base was V1-shaped under the artifact's law scale; the stale-prior argument was measured and did not survive. Swapped to the artifact's coefficients in the dividends campaign's Phase 3 (`075e774` + `b7de5c3`), and the re-anchor turned out to be unnecessary — re-deriving the anchors on the corrected shape returns 1.30 / 1.90 against the shipped 1.25 / 2.0. Do not read this row as open work. | `deadline.ts` header, "The base shape was a decision"; map §6.4 |
| **The 46.3% post-completion gap** | both attempts closed: uniform pressure ≈ −0.5/cell over 225 changed tracks with a new cache-exposure class; depth pressure null at −0.018 over 194. The untested diagnosis is that a repair episode's margin should be read against the *attempt's* ceiling, and the telemetry says that quantity is constant at attempt start — a mode trigger unless re-anchored on repair observations | map D1, `phase1/1b-design-note.md` §C |
| **Acceptance prediction for repair** | needs a compile-level signal; targets `p`, which the independence finding says the 18.6% zero-yield pool is made of. A model, not a knob — its own proposal | `docs/repair-selection-study.md`, `1e22721` |
| **`HANDOFF_QUALITY_N_CAND_FLOOR = 8` bracket** | SC-02's two surviving rules are functioning as the breadth law's scarce floor; the honest question is whether the law's own floor is too low, which is one bracket rather than a per-spec table | `f7d054f` docstring |
| **Low-budget acceptance surface** — **OVERTAKEN: DECIDED** | golden v1 carried every sub-250k decision in this program and has no promotion authority. Decided as option (ii) — a standing non-promoting reading rather than a restored gate — and the instrument ships: `scripts/benchmark/low_budget_reading.ts` (`45707a7`), with an append-only history at `generated/benchmark-v2/low-budget/index.jsonl`. | standing regime, "Instruments"; `45707a7` |

**What is closed and should not be re-opened without new evidence**: repair anchor
*selection* by reranking (decisive offline null over 3,520 compiles); the pool and
tree-width verdicts (re-measured under the current ruler, both held); the maturity
family's shape (three measurements, all negative); the geometry ramp field (deleted
at byte-identity and sub-250k parity); post-completion pressure and post-completion
depth (both measured, one harmful and one null).
