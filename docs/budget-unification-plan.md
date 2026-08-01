# Budget unification plan

The plan of record for replacing the compiler's fragmented budget-awareness with
one coherent architecture, built on the 2026-07-30…08-01 scaffolding (calibrated
estimator, budget law, telemetry) and the survey in
[`budget-aware-map.md`](budget-aware-map.md). Written 2026-08-01 at `3f2462c`.

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
4. Two additive telemetry fields ride along (`up` offset, round index on repair
   attempts) so `maxUpstream`/`upstreamOrder` become priceable.

**Gates.** The replay study's prediction is the admission ticket; N=48 decides.
**Hazard:** LC-22 — any change to the attempt sequence reseeds every downstream
restart, so repair candidates are only ever evaluated whole, never as local
perturbations.

## Track R — stale-verdict re-tests (parallel, any time)

The nearest-term headline material in the map, independent of every phase: six
knobs whose "flat / at optimum" verdicts were all measured in one 2026-07-28
session against a breadth law and scorer ruler that have both since been
replaced (map Cluster B). The one re-test that already exists under the current
ruler — pool = 7 — reads **+0.48 with a catalog-sensitivity CI excluding zero**,
retired only because it missed a sequential boundary. Each re-test is one
cheap N=48 eval; they can run whenever an eval slot is free. Resolve the map's
−1.73 identification ambiguity (discrepancy 12) before reading the branching
row. Verdicts that flip get promoted like any accept; verdicts that hold get
their provenance re-stamped in the map so the staleness is cleared either way.

## Phase 3 — the ramp field

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
honest constants are the likely outcome); the singles (start pressure,
`feasMargin`, objective exponent) last. Cluster A dead-code deletions and the
comment ledger ride with whichever commits touch their files.

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
