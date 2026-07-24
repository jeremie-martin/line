# Ballistic projection and readiness contract

Status: **target design, not an as-is implementation guide**. This document
defines what the architecture should become before a production rewrite. Text
labelled **Current** records audited behavior or evidence from today's code;
text labelled **Target** defines the intended contract. Unlabelled interface
examples are target designs.

The direct predictor workflow remains in
[`../ballistic-goal.md`](../ballistic-goal.md). Compiler promotion remains in
[`../goal.md`](../goal.md). The older
[`READINESS_ROADMAP.md`](READINESS_ROADMAP.md) is evidence and design history,
not the authority for the contract below.

## 1. The central distinction

There are four different questions:

1. **Ballistic projection:** given a causally observed airborne state, what
   collision-free state and trajectory aggregates will exist at a later authored
   contact frame?
2. **Catchability:** given the predicted incoming boundary and the next gap's
   context, how likely is the current compiler policy to construct a valid
   catch there without actually running that search?
3. **Readiness:** how good is the complete forward setup, combining
   catchability, speed fit, air fit, impact feasibility, and elevation fit?
4. **Proposal utility:** given current-gap quality and readiness, which
   candidate or virtual knob setting is worth evaluating?

They are not different names for one operation. Ballistics is deterministic
physics. Catchability is a policy-conditional outcome model. Readiness is the
composite forward-looking score. Proposal utility is a search decision.

The intended pipeline is:

```text
causal engine read
  -> canonical launch observation
  -> ballistic projection
  -> next-gap aggregate composition
  -> catchability + target-fit/feasibility components
  -> readiness composite
  -> proposal utility
  -> exact candidate simulation and hard gates
  -> exact forward judge
```

The benchmark must import the same canonical implementations used by
production. It may supply recorded inputs and truth, but it must not contain a
parallel predictor.

### Current versus target at a glance

| Layer | Current implementation | Target described here |
|---|---|---|
| launch acquisition | Multiple paths and some duplicate reads | One causal, frame-explicit acquisition |
| ballistic dynamics | Exact ten-point constraint kernel is active | Retain it as the one canonical kernel |
| gap composition | Canonical reducers exist, but readiness uses endpoint speed and geometric-exit air approximations | Reuse exact prefix summaries and compose the ballistic suffix with scorer-identical intervals |
| catchability | Old speed/angle table fitted from twelve non-V2 tracks | Same narrow meaning, revalidated or refitted on representative current V2 outcomes |
| readiness | Already the five-factor composite | Retain that meaning; feed it correct projections and centralize it |
| proposal utility | Current quality multiplied by readiness, with policy powers | Keep it explicitly separate from readiness and validate its search effect |
| knob surrogate | Fits several dependent outputs independently | Predict coherent primitives/sufficient statistics and derive dependent values once |

Thus, the document does not say that the target architecture already exists.
Some pieces are current and worth preserving; others are diagnosed defects or
planned boundaries.

## 2. Time and ownership

Let `C_i` and `C_(i+1)` be consecutive authored contact frames.

```text
                    gap G_(i+1)
        [ C_i -------------------------------- C_(i+1) ]
             catch/arc i
                 \__ ride-out __ A_i .... free flight .... incoming boundary
                                                       catch/arc i+1 is not built yet
```

- `G_(i+1)` is the scorer gap from `C_i` to `C_(i+1)`.
- Catch/arc `i` is placed at `C_i`. Its post-contact ride-out influences
  `G_(i+1)`.
- `A_i` is the last causal launch anchor actually read after that ride-out. It
  is often the geometric exit plus zero to three readable airborne frames.
- The ballistic suffix is `A_i -> C_(i+1)`.
- The incoming boundary at `C_(i+1)` is the initial condition against which the
  compiler will try to construct catch/arc `i+1`.

Therefore, while choosing catch/arc `i`, readiness is **one contact ahead**:

> Does the predicted incoming boundary at `C_(i+1)` provide a good complete
> setup for catch/arc `i+1`, considering catchability and the authored
> speed/air/impact/elevation asks?

Within readiness, catchability asks the narrower empirical question: under a
fixed generation policy, does one sampled proposal produce a valid catch/arc
`i+1`? Neither readiness nor catchability predicts the post-contact ride-out
after `C_(i+1)`. Once catch/arc `i+1` is built, that ride-out sets up `C_(i+2)`
and is handled by the next application of the same pipeline.

## 3. Terminology

| Term | Definition |
|---|---|
| **scorer gap** | The authored interval whose axes and terminal contact are scored. |
| **catch/arc** | Geometry constructed at a contact to catch the incoming rider and guide its ride-out. |
| **geometric exit** | The first frame at which the rider has passed the constructed arc. It is not necessarily the prediction anchor. |
| **launch anchor** | The last causal point-state observation used to initialize the ballistic kernel. |
| **observed prefix** | Exactly simulated frames from the scorer-gap start through the launch anchor. |
| **ballistic suffix** | Collision-free projection from the launch anchor to the target contact boundary. |
| **incoming boundary** | The pre-catch configuration and incoming velocity at the authored target contact. |
| **gap projection** | Correct composition of the observed prefix and ballistic suffix into predicted scorer quantities. |
| **catchability** | The empirical model component describing whether the generator can construct a hard-gate-valid catch from an incoming boundary. |
| **readiness** | The complete forward-looking composite: catchability × speed fit × air fit × impact feasibility × elevation fit. |
| **target fit** | How well a gap projection matches one authored next-gap target. Speed, air, and elevation fit are readiness components, not catchability. |
| **impact feasibility** | A physics prior for whether the incoming state can plausibly satisfy an impact ask. It is not an empirical success probability. |
| **proposal utility** | The search-policy score that combines current-gap quality with readiness. |
| **knob surrogate** | A cheap local approximation from virtual arc controls to projected features. It is not the ballistic kernel or catchability model. |
| **exact judge** | The real simulation, hard gates, and forward-evaluation logic that remains authoritative. |

## 4. Frame contract

Every field must state its frame. A generic object called “arrival state” is too
ambiguous.

The engine exposes a contact-frame asymmetry:

- velocity at the target contact is the incoming velocity set before contact
  constraints;
- position at that same engine frame may already include contact response when
  catch geometry exists.

The canonical incoming boundary must therefore carry explicit quantities rather
than pretending they form one ordinary frame state:

```ts
type IncomingContactBoundary = {
  targetFrame: number;
  preContactFrame: number;          // normally targetFrame - 1
  preContactPoints: PointState[];   // collision-free configuration
  incomingVelocityFrame: number;    // targetFrame
  incomingVx: number;
  incomingVy: number;
  incomingSpeed: number;
  incomingAngleDeg: number;
};
```

If a consumer needs collision-free point positions projected to
`targetFrame`, that must be a separately named field. It must never be confused
with engine positions after catch constraints.

The current code also contains a documentation mismatch: `Gap.endFrame` is
described as exclusive for sample counting, while the active reducers scan
`[startFrame, rangeEndFrame]` inclusively. The rewrite must preserve the actual
scorer until a deliberate metric change is authorized, and must make the chosen
interval explicit in types, tests, and documentation.

## 5. Canonical ballistic contract

### 5.1 Input

The launch observation is captured once from causal engine reads:

```ts
type BallisticRequest = {
  anchorFrame: number;
  targetFrame: number;
  points: ConstraintPointState[];   // current and previous positions
  bindings: ConstraintBindingState[];
};
```

Requirements:

- no read may use `targetFrame` or any later frame;
- the anchor is the actual last sample, not an inferred geometric-exit frame;
- point weighting, bindings, gravity, and Verlet frame convention have one
  source of truth;
- collection, production, and tests call the same state-acquisition helper.

### 5.2 Output

The kernel should return terminal physics and additive suffix summaries in one
pass:

```ts
type BallisticSuffix = {
  anchorFrame: number;
  targetFrame: number;
  incoming: IncomingContactBoundary;
  speedSumPx: number;
  speedFrameCount: number;
  airborneFrameCount: number;
  dyPx: number;
  amplitudeSummary?: BallisticAmplitudeSummary;
};
```

The exact fields may change after the reducer audit, but their ownership may
not:

- the kernel owns collision-free dynamics;
- it may expose additive trajectory summaries that it naturally computes;
- it does not own target scoring, catch success, candidate ranking, or search
  policy.

### 5.3 Current evidence

The collision-free ten-point constraint micro-simulation is causal and directly
accurate on the frozen representative corpus. Its normalized score is `0.0313`
against the former current model:

| direct error | mean absolute error |
|---|---:|
| pre-contact position | `0.0453 px` |
| contact velocity vector | `0.00185 px/frame` |
| contact speed | `0.000804 px/frame` |
| contact velocity angle | `0.01146 deg` |

That validates the kernel boundary only. It does not validate gap composition,
the knob surrogate, catchability, readiness, ranking, or compiler performance.

## 6. Gap projection contract

The observed prefix is exact and must not be replaced by an endpoint
approximation:

```ts
type ObservedPrefixSummary = {
  gapStartFrame: number;
  prefixEndFrame: number;
  speedSumPx: number;
  speedFrameCount: number;
  airborneFrameCount: number;
  frameCount: number;
  dyPx: number;
  initialSpeedPx: number;
  amplitudeSummary?: ObservedAmplitudeSummary;
};
```

The composer joins prefix and suffix using the scorer's exact interval and
denominators:

```ts
type GapProjection = {
  interval: { startFrame: number; endFrame: number; end: "inclusive" | "exclusive" };
  meanSpeedPx: number;
  airFraction: number;
  elevation?: number;
  amplitude?: number;
  incoming: IncomingContactBoundary;
};
```

For example:

```text
mean speed = (prefix speed sum + suffix speed sum)
             / (prefix speed count + suffix speed count)
```

It is not `(launch speed + terminal speed) / 2`, and it is not a 50/50 average
of prefix and suffix. The same principle applies to air occupancy and every
other span reduction.

A disposable four-case V2 assay over 377 real gap observations demonstrated the
size of this distinction while holding the exact ballistic state constant:

| prediction | current formula MAE | composed prefix + suffix MAE |
|---|---:|---:|
| mean speed | `0.140960 px/frame` | `0.000082 px/frame` |
| air fraction | `0.147852` | `0.025673` |

The residual air error is expected to include terminal catch timing and detector
occupancy semantics that collision-free ballistics cannot know. Those semantics
belong in the composer or an explicitly modeled terminal-contact correction,
not in the dynamics kernel.

Canonical V2 currently authors no elevation targets, so production should not
compute elevation speculatively on this hot path. Amplitude is authored on a
material subset and should be evaluated as a possible suffix aggregate.

## 7. Catchability contract

### 7.1 Definition

Catchability is the separate empirical predictive layer:

```ts
type CatchabilityContext = {
  nextGapTargets: AxisValues;
  nextGapFrames: number;
  generatorPolicyId: string;
};

type CatchabilityEstimate = {
  pViableAttempt: number;
};

function predictCatchability(
  incoming: IncomingContactBoundary,
  context: CatchabilityContext,
): CatchabilityEstimate;
```

Catchability has one narrow meaning: the probability that one
production-sampled catch passes the hard gates from this incoming boundary.
`pViableAttempt` must be calibrated against individual attempt outcomes or
their empirical viable fraction. It does not predict axis quality.

### 7.2 Catchability is policy-conditional

Catchability is not an intrinsic property of rider state alone. Its operational
meaning is:

```text
P(
  production generator constructs a hard-gate-valid catch
  | incoming boundary,
    next-gap targets and duration,
    generator policy
)
```

If the sampler, templates, hard gates, or attempt distribution change
materially, the catchability corpus may no longer be calibrated. This
dependency belongs in corpus metadata and model versioning.

### 7.3 Ground truth

Committed tracks cannot provide catchability truth by themselves: selection
makes their catch success nearly constant.

Representative truth requires counterfactual arrival boundaries and fresh
next-catch generation:

1. collect representative V2 incoming boundaries produced by real candidate
   and probe paths;
2. preserve the next gap's targets, duration, case, seed, and source pool;
3. for each boundary, run a fixed bundle of deterministic fresh generation
   attempts for catch/arc `i+1`;
4. record viable count and failure reason for catchability truth; also retain
   exact quality, impact, and cost as separate readiness/decision evidence;
5. freeze compact shards and reuse them for model iteration.

The existing `study_catchability.ts` Tier-B procedure has the right causal
shape: it conditions fresh production catch attempts on a perturbed arrival.
Its old twelve-track corpus and fitted table are not automatically
representative of current V2 and must not be treated as current validation.

### 7.4 Inputs

The smallest defensible initial input is the incoming speed and direction,
because those are current measured signals. The state-shaped boundary may admit
position, pose, angular rate, or constraint configuration only when held-out V2
evidence shows additional predictive value.

Next-gap targets and duration are context, not future leakage: they are authored
and known before generation. Realized next-catch geometry, future engine reads,
and outcomes are forbidden inputs.

The correctly composed gap projection supplies the speed, air, and elevation
fit components of readiness. Those components must not be smuggled into
catchability under an ambiguous name.

## 8. Readiness and proposal utility contract

The preferred term **readiness** means:

```text
readiness =
  catchability
  * speed fit
  * air fit
  * impact feasibility
  * elevation fit
```

An absent or disabled target component is `1`, including elevation fit on the
current canonical V2 suite. This matches the current production decomposition
and is the target terminology.

The terms retain their individual meanings:

- `catchability` is the empirical valid-catch model;
- `speedFit`, `airFit`, and `elevationFit` compare the canonical gap projection
  with authored targets;
- `impactFeasibility` is an explicit physics prior;
- `readiness` is their complete forward-looking product;
- `proposalUtility` combines current-gap quality with readiness.

**Current:** `scoreNextTargetReadiness` already computes this five-factor
readiness product. Its speed and air inputs are presently composed incorrectly,
and its optional elevation work is irrelevant to canonical V2.

**Target:**

```ts
type ReadinessComponents = {
  catchability: number;
  speedFit: number;
  airFit: number;
  impactFeasibility: number;
  elevationFit: number;
};

type ReadinessScore = ReadinessComponents & {
  value: number;
};

function scoreReadiness(
  catchability: CatchabilityEstimate,
  projection: GapProjection,
  nextTargets: AxisValues,
): ReadinessScore;

function proposalUtility(
  currentGapQuality: number,
  readiness: ReadinessScore,
): number;
```

Catchability calibration remains separate from readiness-component shaping and
proposal-utility weighting. Readiness is a score in `[0,1]`, not a calibrated
probability.

## 9. Production consumers

The active code currently lets the composite score influence more than one
site. Each use must become explicit during the rewrite:

| Consumer | Intended role |
|---|---|
| virtual knob enumeration | proposer: choose a few variations worth exact simulation |
| candidate-pool ordering | cheap ordering before the exact branch judge |
| transition-motion candidate choice | proposer/ordering policy |
| opening forward-evaluation opportunity pressure | compute-allocation heuristic, separately named and validated |
| telemetry and studies | diagnostics only |
| forward-evaluation branch value | **not a readiness consumer**; the current production judge intentionally excludes it |

Readiness may propose and order work. It may not bypass exact candidate
simulation, hard gates, or the forward judge. Any future use in a judge is a
separate compiler experiment, not a consequence of improving the model.

## 10. Knob surrogate boundary

The direct ballistic kernel may be exact while a virtual knob score is wrong.
The proposer observes only a few simulated knob rows and fits a local response
surface. That surrogate must predict a coherent set of canonical features:

```text
knob values
  -> observed-prefix summary
  -> launch observation
  -> ballistic request/suffix
  -> gap projection
  -> catchability and readiness inputs
```

It must not independently regress mutually dependent fields such as
`x`, `y`, `vx`, `vy`, speed, and angle and then combine inconsistent fitted
values. Prefer fitting primitive state or sufficient statistics and deriving
dependent values once.

The surrogate needs its own held-out error and top-k regret diagnostics. Direct
ballistic accuracy cannot stand in for surrogate validation.

## 11. Validation layers

One headline cannot validate the full chain. The lean validation stack is:

1. **Dynamics parity:** frozen ballistic corpus; terminal state and suffix
   aggregate error.
2. **Composition parity:** frozen real V2 gaps; projected axes versus exact
   reducer outputs using identical interval semantics.
3. **Surrogate parity:** held-out knob rows; primitive feature error and top-k
   proposal regret.
4. **Catchability parity:** frozen V2 counterfactual catch bundles; proper
   probability loss and calibration.
5. **Readiness/decision parity:** replay real candidate pools; component
   correctness, chosen-candidate regret, and coverage.
6. **Compiler value:** cached canonical comparison under `goal.md`.

The first five should reuse frozen data and run quickly. Only collection and the
final compiler comparison require expensive simulation.

A catchability primary score should use a proper scoring rule such as Brier or
log loss, macro-averaged by V2 case and canonical seed. Calibration and regime
slices remain mandatory diagnostics. Readiness itself should be evaluated as a
forward-ranking score against realized outcome and selection regret, not
misreported as a probability.

## 12. Implementation invariants

The rewrite must satisfy all of the following:

- one canonical state-acquisition path;
- one canonical ballistic kernel imported by production and benchmark;
- one canonical gap composer imported by production and benchmark;
- one swappable catchability model interface imported by production and
  benchmark;
- one canonical readiness composition imported by production and benchmark;
- one explicitly named proposal-utility policy;
- no target-frame or future reads in predictor inputs;
- every frame and interval encoded in names or types;
- all derived values computed from one coherent primitive state;
- exact prefix measurements reused, never approximated from endpoints;
- no duplicate engine reads for the same launch samples;
- no unused axis work on the compiler hot path;
- no readiness term in exact gates or forward judging unless independently
  authorized;
- frozen corpora versioned against the implementation and policy that generated
  their truth;
- collection failures isolated per shard and resumable;
- evaluation must fail loudly on empty strata, NaN scores, incompatible corpus
  metadata, or missing truth.

## 13. Planned implementation sequence

No production behavior should change until the contracts above are accepted.
Then:

1. introduce explicit frame- and interval-bearing types with parity tests;
2. centralize launch acquisition and reuse its samples;
3. make the exact kernel return terminal physics plus suffix summaries;
4. implement one prefix/suffix composer and prove it against exact reducers;
5. route the direct benchmark through the canonical kernel;
6. validate and then simplify the knob surrogate around canonical primitives;
7. collect the representative V2 catchability-outcome corpus;
8. fit and validate a swappable catchability model;
9. centralize the readiness composition and separate it from proposal utility;
10. run the normal canonical compiler comparison.

Each phase should leave the code simpler than it found it. Rejected alternative
models are logged once and removed; no permanent model matrix, era mechanism, or
experiment scaffold is required.

## 14. Open decisions

These require evidence rather than assumption:

- the exact scorer interval convention to encode while preserving current
  behavior;
- the terminal-contact correction needed for air occupancy;
- whether amplitude should be part of the suffix summary;
- the catchability attempt bundle used to estimate its truth;
- which incoming-boundary fields add held-out value beyond speed and direction;
- whether catchability needs target/duration conditioning beyond generator-policy
  metadata;
- the primary catchability score and minimum model-improvement threshold;
- the readiness component shapes and clamps;
- the proposal-utility blend, evaluated separately from model calibration;
- the cheapest coherent representation for the local knob surrogate.

Until those decisions are made, “better ballistic model,” “better
catchability,” “better readiness,” and “better compiler” remain separate claims
and must be reported separately.
