# Ballistic projection, catchability, and readiness

Status: **current semantic contract and implementation map**.

This document defines the production architecture. It describes what the
current code means, the invariants future changes must preserve, and the
evidence required for empirical claims. It is not an experiment log.

Direct-predictor iteration is documented in
[`../ballistic-goal.md`](../ballistic-goal.md). Compiler comparisons and
promotion are documented in [`../goal.md`](../goal.md) and
[`HOW_TO_WORK.md`](HOW_TO_WORK.md).

## 1. The pipeline

The compiler answers five different questions:

1. **Ballistic projection:** from a causal airborne launch observation, where
   will the rider be and what trajectory aggregates will have accumulated at a
   later authored contact?
2. **Catchability:** from that incoming boundary and known next-gap context,
   how likely is one proposal from the current generator policy to pass the
   hard catch gates?
3. **Readiness:** how good is the complete forward setup?
4. **Proposal utility:** how should exact current-gap quality and readiness be
   combined to order work?
5. **Exact judgment:** after real simulation, which branch is actually best?

They are intentionally separate:

```text
causal simulated prefix
  -> launch observation
  -> collision-free ballistic projection
  -> complete next-gap aggregates
  -> catchability and target-fit factors
  -> readiness
  -> proposal utility / work ordering
  -> exact candidate simulation and hard gates
  -> exact forward judge
```

Ballistics is deterministic physics. Catchability is an empirical,
generator-policy-conditional model. Readiness is a five-factor score. Proposal
utility is search policy. The exact simulation and forward judge remain
authoritative.

## 2. Canonical terminology

| Term | Exact meaning |
|---|---|
| **scorer gap** | The inclusive authored interval whose axes and terminal contact are scored. |
| **catch/arc** | Geometry built at one contact to catch the incoming rider and guide the ride-out. |
| **geometric exit** | The first airborne frame past the constructed arc's end plane. |
| **launch anchor** | The last causal engine frame whose exact rider state initializes projection. It may be zero to three frames after geometric exit. |
| **observed prefix** | Exact simulated samples from scorer-gap start through launch anchor, inclusive. |
| **ballistic suffix** | Collision-free trajectory strictly after the launch anchor. |
| **incoming boundary** | Pre-contact configuration plus incoming target-frame velocity at the next authored contact. |
| **gap projection** | Prefix and suffix composed into scorer-compatible full-gap quantities. |
| **catchability** | Probability that one proposal from the named generator policy passes survival, landing, and off-beat gates. |
| **readiness** | `catchability × speedFit × airFit × impactFeasibility × elevationFit`. |
| **proposal utility** | Search-policy value combining exact current-gap quality with readiness. |
| **knob surrogate** | Local controls-to-projected-features model used to propose exact work. |
| **exact judge** | Real simulation, hard gates, and forward branch evaluation. |

“Arrival state” without a named frame or boundary is not a valid public
concept. “Readiness” never means catchability alone.

## 3. Time, gaps, and ownership

Let `C_i` and `C_(i+1)` be consecutive authored contact frames:

```text
              scorer gap G_(i+1)
       [ C_i ------------------------------- C_(i+1) ]
          catch/arc i
               \ exact ride-out / A_i ... ballistic ... incoming
```

While choosing catch/arc `i`:

- `G_(i+1)` starts at `C_i` and ends at `C_(i+1)`;
- the simulated ride-out after `C_i` is the observed prefix;
- `A_i` is its last usable causal launch anchor;
- only `A_i + 1 ... C_(i+1)` is predicted;
- readiness describes the setup at `C_(i+1)` for building catch/arc `i+1`.

It does not predict the ride-out after `C_(i+1)`. That becomes the next
application of the same pipeline.

Non-contact timeline slices are skipped deliberately. “Next gap” in this
pipeline means the next contact-terminating scorer gap.

## 4. Frame and interval contract

The scorer interval is `[startFrame, endFrame]`, inclusive. Therefore:

```text
frameCount = endFrame - startFrame + 1
elapsedFrames = endFrame - startFrame
```

These values are not interchangeable.

The engine has a contact-frame asymmetry: velocity at the authored contact is
the incoming velocity, while position may already reflect catch constraints
when catch geometry exists. The canonical boundary therefore names each
quantity:

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

Pre-contact position, incoming velocity, collision-free contact position, and
post-impact state must never be substituted for one another.

## 5. Canonical implementation boundaries

### 5.1 Launch acquisition

`core/ballistic_launch.ts` owns launch acquisition:

```ts
type BallisticLaunchObservation = {
  gapStartFrame: number;
  anchorFrame: number;
  state: BallisticState;
  prefix: BallisticObservedPrefix;
  sampleCount: number;
  groundedFrames: number;
  airborne: boolean;
};
```

The detector selects consecutive causal airborne samples. Production
reconstructs the exact ten-point rider state once, at `anchorFrame`.
`ballisticLaunchFirstSampleFrame()` recovers the geometric-read start when a
consumer needs it; `anchorFrame` and that first sample are not synonyms.

The packet owns the exact current and previous point positions, binding state,
and exact observed prefix. A target-frame or future read is forbidden.

### 5.2 Ballistic dynamics

`core/ballistic_micro_sim.ts` is the one collision-free constraint kernel.
`core/ballistic_projection.ts` exposes it through coherent primitive states:

- `x`, `y`, `vx`, and `vy` come from one propagated constraint state;
- speed and CoM direction are derived from that velocity;
- sled pose and binding integrity come from the same trajectory;
- propagation re-anchors the state, so chained and combined propagation agree.

The kernel owns physics and additive suffix summaries. It does not know
targets, candidate cost, readiness, or compiler ranking.

### 5.3 Gap composition

`projectBallisticGap()` is the one full-gap composer. It combines the exact
prefix with frames strictly after the anchor:

```text
meanSpeed =
  (prefixSpeedSum + suffixSpeedSum)
  / (prefixSpeedFrames + suffixSpeedFrames)

airFraction =
  (prefixAirFrames + suffixAirFrames)
  / inclusiveGapFrameCount
```

This is not an endpoint average or a 50/50 prefix/suffix blend.

Authored-contact projection uses `terminalContact: "grounded"`: the terminal
frame is removed from airborne occupancy while its incoming velocity remains
the collision-free incoming velocity. Tail projection uses
`terminalContact: "none"`.

Elevation is computed only when the readiness policy requests it. Amplitude is
available to explicit consumers but is not one of the five readiness factors.

### 5.4 Catchability

`optimizer/catchability.ts` owns one swappable model interface:

```ts
type CatchabilityContext = {
  nextGapTargets: AxisValues;
  nextGapFrameCount?: number;
  generatorPolicyId: string;
};

type CatchabilityEstimate = {
  pViableAttempt: number;
  modelId: string;
};
```

Its meaning is:

```text
P(one generated catch passes hard gates
  | incoming boundary, known next-gap context, generator policy)
```

Authored targets and duration are causal known context. Realized next geometry,
future engine state, or the outcome itself are forbidden inputs.

The current `speed-angle-table-r0` model is the active implementation, not a
compatibility branch. Its calibration came from an older twelve-track study.
It remains usable code, but it is **not yet validated as calibrated for the
current V2 distribution and generator policy**.

Committed best paths cannot supply catchability truth because their successful
catches are selected. Representative truth requires frozen counterfactual
incoming boundaries and fixed bundles of fresh production generation attempts.

### 5.5 Readiness

`optimizer/readiness.ts` owns exactly:

```text
readiness =
  catchability
  × speedFit
  × airFit
  × impactFeasibility
  × elevationFit
```

- `catchability` is the empirical model above;
- speed, air, and elevation fit compare the canonical gap projection with
  authored next-gap targets;
- impact feasibility is an explicit physics prior, not a calibrated
  probability;
- an unauthored or deliberately disabled component is exactly `1`;
- a targeted enabled component whose projection input is missing fails closed;
- readiness is in `[0,1]`, but is not itself a probability.

Elevation enablement is shared by production ranking and the aim probe. The
probe requests and fits elevation whenever the readiness policy enables it.

### 5.6 Proposal utility and consumers

`optimizer/objective.ts` owns:

```text
proposalUtility = currentGapQuality × readiness
```

with explicit configurable powers. Current-gap quality is measured exactly on
the current scorer interval. Readiness looks one contact ahead. The two are
not averaged or mislabeled as one model.

Readiness may:

- choose virtual knob proposals;
- order a candidate pool before exact branch evaluation;
- inform explicitly named compute-allocation heuristics;
- appear in diagnostics.

It may not:

- bypass exact candidate simulation;
- bypass survival, landing, or off-beat gates;
- replace the exact forward judge;
- silently become a hard acceptance criterion.

### 5.7 Knob surrogate

The aim lane observes a small set of exact knob rows and fits local response
surfaces. Probe rows and real candidates share launch acquisition, projection,
composition, readiness, and proposal utility.

The surrogate predicts primitive velocity and sufficient gap statistics.
Dependent speed and angle are derived once. Missing output coverage is
observable and fails to the explicit candidate-order fallback.

Direct ballistic accuracy does not validate this surrogate. It requires its
own held-out prediction and proposal-regret evidence.

## 6. Fallbacks and efficiency

The normal hot path follows these rules:

- one rider reconstruction at the selected launch anchor;
- one exact prefix reduction;
- one suffix walk per unique launch/target/policy request;
- shared projection memoization for ranking consumers;
- no benchmark truth reads or trace serialization without an installed study
  sink;
- no study-only pool walks unless their study flag is enabled;
- telemetry performs no RNG draws, charged rides, or shared-cache mutation.

An unavailable projection never becomes a perfect score. The candidate remains
eligible only through the explicit deterministic fallback order already tested
by the pool ranker.

The frozen ballistic collector is independently sharded, bounded in memory,
resumable, and writes compressed shards. One failed shard does not erase
completed work.

## 7. What the current evidence establishes

Evidence must be stated per layer.

### Direct dynamics

The frozen corpus contains up to 202,752 real predictor calls from all 44
canonical V2 cases, the first three canonical seeds, both pool and aim-probe
populations, at 250k. Evaluation reuses the corpus and imports the production
kernel.

Current clean-flight coverage is 194,413 pre-contact position rows and 202,162
contact rows across all 132 case-seed groups. Mean absolute errors are:

| quantity | error |
|---|---:|
| pre-contact position | `0.0453 px` |
| contact velocity vector | `0.00185 px/frame` |
| contact speed | `0.000804 px/frame` |
| contact direction | `0.01146 deg` |

This validates collision-free dynamics at the direct-call boundary.

### Production selected transitions

The 2026-07-24 one-seed V2 diagnostic archived 11,627 eligible transitions.
11,620 projected successfully. Against the exact next committed scorer gap:

| projected quantity | MAE | signed bias |
|---|---:|---:|
| mean speed | `0.0000087` | `+0.0000068` |
| air fraction | `0.02487` | `-0.02332` |
| elevation | `0.000020` | `-0.000020` |
| catchability recomputed from exact incoming kinematics | `0.000463` | `+0.000185` |

The catchability row validates transport of the model's inputs, not empirical
catch-success calibration. The air residual is a real, consistent occupancy
boundary effect; it is mostly inside the readiness deadband but remains a
composition diagnostic.

Readiness and the exact next-gap quality are different quantities, so their
association—not equality—is the useful check. The within-run Pearson
association was positive in 131/132 runs, with run mean `0.622` and median
`0.681`.

### Aim surrogate and candidate ordering

The same diagnostic compared fitted aim predictions with the achieved
readiness obtained after exact candidate simulation:

```text
292,674 paired predictions / 292,864 emitted candidates (99.94%)
readiness MAE 0.05464
534,752 / 534,752 targeted current-axis terms modeled
671 / 170,538 sweeps model-unscoreable (0.39%)
```

This establishes high coverage and bounded surrogate error. It does not
establish that the proposal utility chooses the best future branch.

The study-only forward-agreement instrument then compared the pool's
proposal-utility top-1 with the winner of the exact forward rollouts that the
compiler had already charged:

```text
41,512 measured pools
top-1 agreement 29.25%
impact-targeted agreement 21.61%
non-impact agreement 46.19%
mean quality rank of the exact forward winner 2.56
```

Aimed candidates were exact-forward winners in 29,794 pools and were present
in 37,759, so the aim proposer itself is productive. The weak boundary is the
one-step readiness/proposal-utility ordering, especially under impact asks.
That is the clearest current explanation for why better physical prediction
has not translated into a better compiler.

The instrumented and uninstrumented diagnostics produced identical scores and
track hashes in all 132 paired runs, confirming that these study counters did
not perturb compiler behavior.

The corrected detector-runway gate suppressed 168/1,688 eligible duplicate
fallbacks. The remaining contact-phase lane made 1,520 exact attempts, rejected
1,509, and emitted 11. Its low yield is a separate efficiency/search-policy
question, not a ballistic correctness failure.

### Compiler outcome

The same N=1 diagnostic is descriptive only:

```text
baseline 516.66 -> candidate 489.71  (delta -26.95)
representative +9.75
legacy-regression +27.88
capability -239.29
valid runs 129/132 -> 121/132
```

The loss is concentrated in rapid-pickup and dense-recovery capability cases.
It does not refute the direct ballistic model; it shows that physics accuracy
alone does not establish catchability calibration, readiness ordering, search
allocation, or compiler value.

N=1 supplies no between-seed variance. The comparison layer therefore marks
seed-block inference unavailable, returns an inconclusive/non-promotable
result, and reports only descriptive deltas.

## 8. Evidence still required

The architecture and review fixes are implemented. These empirical questions
remain open:

1. revalidate or replace catchability on current-V2 counterfactual attempts;
2. replay representative candidate pools to improve readiness/proposal-utility
   ordering, with special attention to impact-targeted gaps;
3. add frozen top-k regret to the existing surrogate coverage/error evidence;
4. characterize whether the air-occupancy bias warrants a more exact terminal
   correction;
5. determine whether current catchability inputs need duration, targets, pose,
   or constraint-state features;
6. decide whether the very low-yield contact-phase lane earns its charged
   attempts;
7. use a multi-seed canonical comparison before any promotion claim.

These are separate claims. “Better ballistics,” “better catchability,” “better
readiness,” and “better compiler” must never be reported as synonyms.

## 9. Working commands

Direct predictor iteration, with no compilation or truth resimulation:

```bash
npm run benchmark:ballistic
```

One-time corpus collection only when its population or protocol is genuinely
stale:

```bash
npm run benchmark:ballistic:collect
```

End-to-end descriptive compiler diagnostic:

```bash
LR_AIM_STUDY_STATS=1 LR_FWD_EVAL_AGREEMENT=1 \
  npm run benchmark -- eval --seeds=1 --jobs=48 \
  --out=generated/benchmark-v2/eval/DESCRIPTIVE-N1.json
```

Ordinary compiler comparison at any useful depth:

```bash
npm run benchmark -- eval --seeds=N --jobs=48
```

N=1 is diagnostic only. N≥2 can estimate seed uncertainty; the operator chooses
the depth appropriate to the decision. Cached baseline slots are reused.

## 10. Review checklist

Use this checklist for every change touching launch reads, projection,
catchability, readiness, aiming, ranking, or their benchmarks.

### Meaning and ownership

- [ ] Ballistics contains only deterministic collision-free physics and
  additive trajectory summaries.
- [ ] Catchability means one-policy-proposal hard-gate success probability.
- [ ] Readiness is exactly the named five-factor product.
- [ ] Proposal utility is the only layer combining current quality and
  readiness.
- [ ] Current-gap quality contains no future prediction.
- [ ] Every formula and policy has one production owner; benchmarks import it.
- [ ] Telemetry names the quantity it actually records.

### Gaps, frames, and causality

- [ ] A catch at `C_i` projects scorer gap `[C_i, C_(i+1)]`.
- [ ] `gapStartFrame`, geometric exit, first launch sample, anchor,
  pre-contact, target, and post-impact frames remain distinct.
- [ ] Scorer frame counts are inclusive; elapsed durations are not.
- [ ] Launch acquisition reads no target or future frame.
- [ ] Known authored targets/duration are allowed context; realized future
  geometry and outcomes are not.
- [ ] Contact projection requests `"grounded"` and final-tail projection
  requests `"none"`.

### State and composition

- [ ] Point state includes current/previous positions and bindings.
- [ ] Position and velocity come from one coherent primitive state.
- [ ] Speed, direction, pose, and integrity are derived from that state.
- [ ] Only frames after the anchor are predicted.
- [ ] Prefix and suffix neither omit nor double-count the anchor boundary.
- [ ] Speed, air, elevation, and amplitude use scorer-identical reducers and
  denominators.
- [ ] Missing or non-finite targeted inputs fail closed.
- [ ] Chained propagation matches combined propagation.

### Models and search

- [ ] Catchability truth uses counterfactual attempts from the stated current
  generator policy.
- [ ] Target-fit terms are not hidden inside catchability.
- [ ] Impact feasibility is not described as a calibrated probability.
- [ ] Readiness does not bypass exact simulation or hard gates.
- [ ] Probe and candidate paths share projection/readiness code.
- [ ] Surrogate outputs are coherent, and missing outputs are observable.
- [ ] Candidate cloning preserves or explicitly invalidates its launch packet.
- [ ] Pool ordering and exact forward judging remain separately measured.

### Efficiency and evidence

- [ ] One anchor rider read and at most one cached projection serve each unique
  request.
- [ ] Default telemetry performs no extra physics or pool traversal.
- [ ] Study telemetry is explicit and cannot affect output.
- [ ] Direct, composition, surrogate, catchability, readiness/ranking, and
  compiler evidence are reported separately.
- [ ] Empty coverage, NaN, incompatible corpus metadata, and absent truth fail
  loudly.
- [ ] Compiler results include budgets, validity, important regimes, runtime,
  and physical interpretation—not only a headline.
