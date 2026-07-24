# Ballistic projection and next-arc readiness

Status: **normative target architecture**.

This document defines the meaning, ownership, frame alignment, and interfaces
of ballistic projection, scorer-gap evaluation, next-arc readiness, and
proposal utility. It deliberately distinguishes the intended architecture from
the current implementation; the implementation status is recorded in
[§11](#11-current-implementation-status).

Direct ballistic-model iteration belongs in
[`../ballistic-goal.md`](../ballistic-goal.md). Readiness-model iteration
belongs in [`../readiness-goal.md`](../readiness-goal.md). Compiler comparison
and promotion belong in [`../goal.md`](../goal.md).

## 1. Contact-indexed ownership

Let:

- `C_i` be an authored contact frame;
- `A_i` be the catch/arc placed at `C_i`;
- `G_i = [C_i, C_(i+1)]` be the outgoing scorer gap produced by `A_i`;
- `E_i` be the geometric exit from `A_i`;
- `L_i` be the last causal launch anchor used by the ballistic predictor.

While evaluating one proposed `A_i`, the compiler has three distinct horizons:

```text
        exact incoming gap              outgoing gap of A_i
  [ C_(i-1) -------- C_i ] [ C_i ---------------- C_(i+1) ]
                         A_i \ exact prefix ... L_i ... ballistic ...
                                                            |
                                                            v
                                                  incoming boundary
                                                     for A_(i+1)
                                                            |
                                                            v
                                               next-arc readiness predicts
                                                 A_(i+1) and its outgoing
                                              [ C_(i+1) ----- C_(i+2) ]
```

The layers are:

1. **Incoming-gap evaluation:** exact simulation scores
   `[C_(i-1), C_i]`. The impact at `C_i` is delivered by `A_i`.
2. **Outgoing-gap projection:** exact simulation covers `C_i ... L_i`;
   collision-free ballistics predicts `L_i + 1 ... C_(i+1)`. Their sufficient
   statistics are composed to estimate `G_i`.
3. **Next-arc readiness:** from the predicted incoming boundary at `C_(i+1)`
   and causal authored context, cheaply estimate the quality of the unbuilt
   `A_(i+1)`.
4. **Proposal utility:** search policy combines the three distinct signals.
5. **Exact judgment:** real simulation, hard gates, and the forward judge remain
   authoritative.

The direct projection of `G_i` is not readiness. Readiness begins at
`C_(i+1)` and concerns `A_(i+1)`.

## 2. Why readiness is arc-owned

Scorer axes do not all have the same temporal owner:

- speed, air, elevation, and amplitude are reduced over a scorer gap;
- impact is measured at the gap's terminal contact and depends on the catch
  placed there;
- catchability is a property of attempting that catch under a named generator
  policy.

Consequently, readiness for `A_(i+1)` has:

- catchability at `C_(i+1)`;
- impact feasibility at `C_(i+1)`, for the impact target of the incoming gap
  `G_i`;
- speed, air, and elevation fit over the arc's outgoing gap
  `G_(i+1) = [C_(i+1), C_(i+2)]`.

Calling all five factors “the next gap” obscures this ownership. Moving impact
to `C_(i+2)` would predict the catch `A_(i+2)`, one arc farther ahead than the
other factors.

## 3. Canonical terminology

| Term | Exact meaning |
|---|---|
| **incoming scorer gap** | The scorer interval ending at the contact where the candidate arc is placed. |
| **outgoing scorer gap** | The scorer interval starting at that contact and shaped by the candidate arc's ride-out. |
| **geometric exit** | The first frame that is airborne, past the candidate arc's end plane, and still airborne one frame later. A function of the geometry and the trajectory alone. |
| **launch anchor** | The geometric exit. There is no separate anchor rule: the exit frame IS the frame whose exact rider state initializes ballistic projection. |
| **observed prefix** | Exact samples from the outgoing scorer-gap start through the launch anchor, inclusive. |
| **ballistic suffix** | Collision-free trajectory strictly after the launch anchor. |
| **incoming boundary** | Collision-free pre-contact configuration and target-frame incoming velocity at the next authored contact. It is not a post-impact state. |
| **outgoing-gap projection** | Observed prefix and ballistic suffix composed into scorer-compatible physical quantities for one outgoing scorer gap. |
| **catchability** | Probability that one proposal from a named generator policy passes its hard viability gates. |
| **next-arc readiness** | `catchability × speedFit × airFit × impactFeasibility × elevationFit` for one unbuilt arc. |
| **proposal utility** | Explicit search-policy value combining settled incoming quality, projected outgoing quality, and next-arc readiness. |
| **exact judge** | Real simulation, hard gates, and forward branch evaluation. |

Unqualified names such as `currentGap`, `nextGap`, `arrivalState`, or
`nextTargets` are forbidden at public layer boundaries. They are too dependent
on the caller's point of view.

## 4. Frame and interval contract

Scorer reductions use `[startFrame, endFrame]`, inclusive:

```text
frameCount    = endFrame - startFrame + 1
elapsedFrames = endFrame - startFrame
```

Consecutive scorer gaps share their contact frame. Frame counts and elapsed
durations are not interchangeable.

The engine has a contact-frame asymmetry: the authored contact's velocity is
the incoming velocity, while position may already reflect catch constraints
when catch geometry exists. The canonical collision-free boundary therefore
names every frame:

```ts
type IncomingContactBoundary = {
  targetFrame: number;
  preContactFrame: number;          // targetFrame - 1
  preContact: BallisticState;        // collision-free
  incomingVelocityFrame: number;    // targetFrame
  incoming: IncomingKinematics;
  projectedContactFrame: number;    // targetFrame
  projectedContact: BallisticState; // collision-free, not post-impact
};
```

Pre-contact position, incoming target-frame velocity, collision-free contact
position, and simulated post-impact state must never be substituted for one
another.

Only `L_i + 1 ... C_(i+1)` is predicted. The launch anchor is included once in
the exact prefix and never again in the suffix.

## 5. Ballistic projection

### 5.1 Input

Launch acquisition produces one causal packet:

```ts
type BallisticLaunchObservation = {
  gapStartFrame: number; // C_i
  anchorFrame: number;   // L_i, the geometric exit
  state: BallisticState;
  prefix: BallisticObservedPrefix;
  groundedFrames: number;
  airborne: boolean;
};
```

Production reconstructs the exact rider state exactly once, at `anchorFrame`.
No target-frame or future read is legal.

`anchorFrame` is the geometric exit, verbatim. Acquisition performs no forward
scan: the constraint kernel needs one state (ten points plus their previous
positions), and the measured boundary error at the next authored contact is
~1e-5 px, so later anchors bought nothing while making the anchor a function of
the caller's detection-window schedule.

Every acquisition targets the NEXT AUTHORED CONTACT. Measurement boundaries
such as an axis-lookahead frame are not legal target frames: using one made two
call sites disagree about which launches were admissible.

Growing the detection window to find the exit is a cost optimization and may
never influence a reported quantity. Two callers that grow on different
schedules must acquire the identical launch; `tests/exit_read.test.ts` and
`tests/ballistic_launch.test.ts` pin that.

Cost note: this kernel is a faithful reimplementation of the engine's airborne
solver, so its per-frame cost is comparable to the engine's rather than
negligible. What it buys is that engine frames are the search BUDGET and this
charges none of them, plus a counterfactual the engine cannot answer without a
fork. Whether it is cheaper in wall clock is an open, unmeasured question
tracked in [`../ballistic-goal.md`](../ballistic-goal.md); the volume is
reported per compile as `CompileStats.ballistic_micro_sim_frames`.

### 5.2 Output

The collision-free kernel owns:

- one coherent propagated primitive state;
- pre-contact and target-frame incoming kinematics;
- additive suffix summaries required by scorer reductions;
- constraint and binding state when available.

The outgoing-gap composer owns:

```text
meanSpeed =
  (prefixSpeedSum + suffixSpeedSum)
  / (prefixSpeedFrames + suffixSpeedFrames)

airFraction =
  (prefixAirFrames + suffixAirFrames)
  / inclusiveGapFrameCount
```

It also owns elevation and amplitude when requested. It does not own authored
targets, target compatibility, catchability, readiness, or ranking.

For an authored terminal contact, the target frame is grounded for air
occupancy while retaining its collision-free incoming velocity. An open tail
uses no such correction.

### 5.3 Two consumers

The same outgoing-gap projection has two legitimate consumers:

1. its physical aggregates complete the estimate of `G_i`;
2. its incoming boundary is the dynamic input to readiness for `A_(i+1)`.

The physical aggregates of `G_i` must not be passed off as predictions of
`G_(i+1)`.

## 6. Scorer-gap quality

### 6.1 Settled incoming quality

The candidate's exact simulation scores `[C_(i-1), C_i]`, including the impact
delivered by the proposed `A_i`. This is settled incoming-gap quality.

### 6.2 Projected outgoing quality

The ballistic projection scores the axes of `G_i` that do not require the
unbuilt terminal catch:

- speed;
- air;
- elevation when authored and enabled;
- amplitude when authored and requested.

Its target compatibility uses the scorer's canonical axis definitions. It does
not invent impact at `C_(i+1)`, because `A_(i+1)` has not been built.

Exact prefix and predicted suffix are combined with their real frame counts.
No endpoint average or 50/50 blend is valid.

## 7. Next-arc readiness

### 7.1 Causal input

The readiness model receives:

```ts
type NextArcReadinessInput = {
  incomingBoundary: IncomingContactBoundary; // at C_(i+1)

  // G_i: known context for catching at C_(i+1), including its impact ask.
  incomingGap: ScorerGapContext;

  // G_(i+1): known context for the ride-out after A_(i+1).
  // Null when there is no following scorer gap.
  outgoingGap: ScorerGapContext | null;

  generatorPolicyId: string;
};
```

Known authored targets, durations, contact geometry, and policy identity are
causal inputs. Realized proposal geometry, future engine state, selected-path
outcomes, and any simulation of `A_(i+1)` are forbidden production inputs.

The predicted boundary is the production input. An exact subsequently observed
boundary may be stored only as diagnostic truth for separating upstream
ballistic error from readiness-model error.

### 7.2 Factors

For one proposal `A_(i+1)` from the named policy:

| Factor | Meaning | Truth population |
|---|---|---|
| `catchability` | `P(proposal passes survival, landing, and off-beat gates | input)` | All attempts, including failures |
| `impactFeasibility` | Probability a viable proposal delivers the authored impact ask at `C_(i+1)` | Viable attempts with an incoming-gap impact ask |
| `speedFit` | Expected scorer-compatible speed fit over `G_(i+1)` | Viable attempts with an outgoing speed ask |
| `airFit` | Expected scorer-compatible air fit over `G_(i+1)` | Viable attempts with an outgoing air ask |
| `elevationFit` | Expected scorer-compatible elevation fit over `G_(i+1)` | Viable attempts with an outgoing elevation ask |

An unauthored component is exactly `1`.

Readiness retains the agreed definition:

```text
readiness =
  catchability
  × speedFit
  × airFit
  × impactFeasibility
  × elevationFit
```

This is a decomposed expected-utility surrogate, not automatically a calibrated
probability. Component predictions may be correlated, so the product must also
be validated directly against realized joint utility.

### 7.3 Speed, air, and elevation modeling

Applying the exact scorer transform to the outgoing-gap projection of `A_i`
does not predict the next arc; it only scores `G_i`.

The next-arc factors must predict outcomes caused by the unknown `A_(i+1)`.
Two model families are legitimate:

1. **Direct:** predict expected realized target fit from the readiness input.
2. **Structured:** predict the next arc's prefix/exit sufficient statistics,
   reuse the canonical ballistic kernel for its suffix, compose the complete
   outgoing gap, then integrate the scorer-compatible fit.

The final truth remains the complete outgoing scorer-gap outcome. Arc-prefix
speed, exit state, and suffix statistics are useful intermediate labels, not
substitutes for the final quantity.

Because target quality is nonlinear, generally:

```text
quality(E[achieved]) != E[quality(achieved)]
```

A model that predicts only a raw mean must either predict enough of the outcome
distribution to integrate expected quality or be evaluated against the bias
introduced by transforming the mean.

## 8. Proposal utility

Proposal utility is the only layer allowed to combine:

- settled incoming-gap quality;
- projected outgoing-gap quality;
- next-arc readiness.

Conceptually:

```text
proposalUtility = searchPolicy(
  settledIncomingQuality,
  projectedOutgoingQuality,
  nextArcReadiness,
)
```

The exact function and any powers are search policy, not physical semantics.
It must not relabel projected outgoing quality as readiness or count the same
axis twice.

Readiness may order work and propose candidates. It may not bypass exact
simulation, hard gates, or the forward judge.

### 8.1 When no launch can be acquired

A viable candidate may still have no ballistic launch: its geometric exit is
not confirmable inside the simulated window, the anchor would fall at or past
the next authored contact, or the launch state is unreadable. Such a candidate
has no projected outgoing quality and no readiness, so it has no proposal
utility at all.

**Current policy, stated so it is a decision rather than an accident:** a
candidate with no proposal utility sorts below *every* candidate that has one,
regardless of its exact incoming-gap cost, and is excluded from aim refinement.
It is not rejected — the exact judge may still select it if nothing better
exists.

Measured mass, so the policy can be priced: across 8 canonical V2 cases at
50k budget, 99.33% of acquisitions confirmed an exit, 0.06% were not
confirmable in the window, and 0.60% were unreadable or acausal.

Alternatives worth testing, none of which has been:

1. **Neutral utility** — score the candidate as if readiness were `1`, so it
   competes on its settled incoming quality alone. Treats "unknown future" as
   "average future" rather than "worst future".
2. **Cost-order interleave** — rank launch-less candidates among the scored
   ones by their exact cost rather than appending them below.
3. **Pay for the answer** — extend the detection window far enough to confirm
   the exit, trading simulated frames for coverage on the 0.06%.
4. **Explicit rejection** — refuse the candidate outright, making the absence of
   a ballistic hand-off a hard gate rather than a ranking penalty.

## 9. Frozen readiness corpus

One row group represents a real production decision boundary at `C_i`.

### 9.1 Frozen inputs

Store exactly what production could know before proposing `A_i`:

- the predecessor's predicted incoming boundary at `C_i`;
- incoming and outgoing scorer-gap targets and inclusive frame counts;
- named generator policy and any other explicit causal policy context.

Also store the exact incoming boundary when it becomes observable, but mark it
as diagnostic truth and never expose it to a production-equivalent model.

### 9.2 Attempt outcomes

For every retained proposal attempt:

- retain hard-gate failure as a catchability outcome;
- for a viable proposal, retain exact impact delivery at `C_i`;
- retain exact next-arc prefix, exit, and launch sufficient statistics;
- obtain benchmark-only truth through the outgoing gap to `C_(i+1)`;
- retain achieved speed, air, and elevation plus their target fits;
- retain failure or truncation explicitly rather than filtering it away.

The outgoing truth must not construct the catch at `C_(i+1)`. Its terminal air
occupancy is canonicalized as grounded conditional on a future successful
authored contact, matching the scorer convention, while incoming velocity
remains collision-free.

### 9.3 Representativeness and leakage

- Contexts and attempts come from the real production sampler.
- Failed attempts remain in the denominator.
- Retention is deterministic and bounded per case/seed.
- Attempts from one context never cross train/validation partitions.
- Collection may perform expensive future simulation; production models may
  use only the frozen causal input fields.
- Policy identity is part of the corpus and model interface.
- Empty coverage, NaN, missing shards, schema drift, or incompatible policy
  identity fail loudly.

Ordinary model iteration reuses the frozen corpus and performs no compilation
or simulation.

## 10. Evaluation

All reports macro-average case/seed groups so high-search-volume cases cannot
dominate.

Primary component losses:

- catchability: Brier score over all attempts;
- impact feasibility: Brier score over viable, impact-authored attempts;
- speed, air, and elevation fit: squared error against realized
  scorer-compatible fit on viable attempts.

Secondary evidence includes log loss and calibration for probabilities; MAE,
raw physical error, signed bias, target buckets, and regime coverage for
continuous outcomes.

For each context, empirical joint truth is the mean attempt utility:

```text
attemptUtility =
  0                                      if proposal is not viable
  impactPass × speedFit × airFit
    × elevationFit                       otherwise
```

where every unauthored factor is `1`. Composite readiness is evaluated against
the context mean using squared error, calibration, association, and pool
ranking/regret when exact pools are available.

Direct ballistic accuracy, outgoing-gap composition accuracy, readiness
component accuracy, proposal ordering, and compiler score are separate claims.

## 11. Current implementation status

The 2026-07-24 implementation now has:

| Layer | Status |
|---|---|
| Causal launch acquisition | Aligned; one causal launch packet owns the exact prefix and anchor state. |
| Collision-free ballistic kernel | Aligned and independently benchmarked. |
| Prefix/suffix outgoing-gap composition | Aligned, memoized, and scored separately from readiness. |
| Incoming boundary | Explicitly frame-aligned and collision-free. |
| Settled incoming-gap measurement | Owned by `settledIncomingAxes` and `scoreSettledIncomingQuality`. |
| Projected outgoing-gap target fit | Owned by `projectOutgoingScorerGap`; impact is absent by construction. |
| Catchability for the next arc | Refit on all retained attempts from the contact-indexed corpus. |
| Impact feasibility for the next arc | Refit on viable attempts with an incoming-gap impact ask. |
| Next-arc speed/air fit | Refit from the unbuilt arc's realized outgoing gap. |
| Next-arc elevation fit | Exactly neutral pending a relevant authored population. |
| Frozen readiness corpus | Schema v3: 44 V2 cases, three seeds, 132,493 contexts, 421,932 attempts. |
| Production inference | One stable exported artifact; dependency-free TypeScript inference has exact fixture parity with Python. |
| Proposal utility | Explicitly combines settled incoming quality, projected outgoing quality, and next-arc readiness once each. |
| Aim surrogate | Uses only settled and projected layers because its small local fit does not reconstruct the full articulated readiness boundary. Exact candidates use all three layers. |
| Compiler evidence | Unit/contract evidence is in place; hot-path telemetry and independent compiler promotion remain pending. |

The invalid earlier speed/air result remains withdrawn. It measured outgoing
ballistic composition, not next-arc readiness.

## 12. Implementation checklist

### Meaning and ownership

- [x] Every public scorer interval is owned relative to explicit contacts.
- [x] Every candidate arc is owned by its terminal contact.
- [x] Exact incoming, projected outgoing, and readiness signals have separate
      types and production owners.
- [x] Impact is owned by the catch at the terminal contact.
- [x] Projected outgoing axes never enter next-arc readiness as if they were
      future arc outcomes.
- [x] Proposal utility counts every quantity at most once.

### Frames and causality

- [x] Gap start, geometric exit, first launch sample, launch anchor,
      pre-contact, target-frame incoming, and post-impact frames remain
      separately named.
- [x] Scorer frame counts are inclusive.
- [x] Launch acquisition reads no target or future frame.
- [x] The readiness production input contains no realized next-arc geometry or
      outcome.
- [x] Predicted and exact incoming boundaries remain separate corpus fields.

### Physics and composition

- [x] Position and velocity come from one coherent primitive state.
- [x] Only frames after the launch anchor are predicted.
- [x] Prefix and suffix neither omit nor double-count the anchor.
- [x] Prefix/suffix composition uses additive sufficient statistics and exact
      frame counts.
- [x] Target-contact air occupancy and incoming velocity preserve the engine's
      asymmetric convention.
- [x] Chained propagation matches combined propagation.

### Readiness models

- [x] Catchability includes failed attempts and names its generator policy.
- [x] Impact truth is conditional on immediate next-arc viability.
- [x] Speed and air truth come from the outgoing gap of the
      unbuilt next arc, not the gap used to obtain its incoming state.
- [x] Elevation remains neutral until representative authored truth exists.
- [x] Structured data generation reuses the production ballistic kernel rather than
      copying physics.
- [x] Each active component and the final product are independently validated
      on a locked seed.
- [ ] Selected-path ordering is independently validated.
- [x] Missing targeted inputs fail explicitly; unauthored factors are `1`.

### Efficiency and evidence

- [x] One launch read and one memoized outgoing projection serve all production
      consumers.
- [x] Study hooks perform no work when disabled.
- [x] Corpus shards are bounded, resumable, and independently recoverable.
- [x] Export parity proves the evaluated and production inference formulas agree.
- [x] Empty coverage, NaN, incompatible metadata, and missing truth fail loudly.
- [ ] Hot-path inference cost and selected-transition telemetry are validated.
- [ ] Compiler promotion occurs only through `goal.md` after layer-specific
      validation.
