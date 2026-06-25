# Budget Control Design

This note is the conceptual contract for using difficulty and budget information
inside the compiler. It is intentionally separate from
`difficulty-model-study.md`: the study records empirical fits; this document
defines what those quantities are allowed to mean and how they may safely drive
policy.

## Goal

The compiler should allocate compute intentionally across specs and budgets. A
raw budget such as `200k` is not comparable between a short 4-contact spec and a
long dense drum spec. The goal is to normalize budget by traversal difficulty,
then use that normalized signal to choose how much compute to spend on different
search mechanisms.

The target behavior is:

```text
same raw budget + easy traversal   -> more surplus compute for quality
same raw budget + hard traversal   -> protect completion and avoid starving the tail
higher raw budget for any spec     -> smoothly buy more useful search work
```

This is not a license to add narrow thresholds. Policies should be smooth,
monotone when possible, and meaningful outside the current golden grid, including
budgets such as 50k, 1M, or 2M.

## Definitions

Let:

```text
C(spec, seed, policy) = measured frames to first complete traversal
D(spec)               = expected C under a fixed reference policy
budget_slack          = requested_budget / D(spec)
```

`D(spec)` is a coordinate system for traversal difficulty. It is not a promise
that production will spend exactly that many frames.

The production compiler may use:

```text
policy = controller(budget_slack, other evidence)
```

and then spend:

```text
actual_spend = F(spec, seed, policy)
```

Keeping `D(spec)` separate from `actual_spend` avoids the circular failure mode:
the controller can change production spend without redefining the difficulty
yardstick during the same run.

## Non-Circularity

The circularity risk is real:

```text
model predicts frames -> policy changes candidate count -> frames change
```

The resolution is to make the model estimate a reference quantity:

```text
predicted_first_completion_frames = baseline traversal difficulty
```

not:

```text
predicted_first_completion_frames = future production spend under the new policy
```

If a policy change increases candidate count and first completion moves from 50k
to 65k, the model is not "wrong" in the operational sense. It still says the spec
has roughly 50k reference traversal difficulty; the extra 15k is chosen spend.

The model becomes stale only if the reference policy or core traversal mechanics
change enough that `D(spec)` no longer orders or scales specs well. Then the
model must be versioned and recalibrated.

## Reference Policy

A cleaner future calibration may define `D(spec)` by running a frozen reference
compiler mode. That mode should be representative enough to measure real
traversal difficulty, while removing the budget-adaptive loops whose purpose is
to spend surplus compute.

A candidate reference protocol:

- fixed candidate counts
- fixed branch widths
- no raw-budget ramps
- no repair or post-completion spending
- high enough budget to avoid censoring first completion
- fixed seed set
- record only first-completion cost and supporting diagnostics

Do not strip the reference compiler down to a toy. The reference should freeze
allocation policy, not remove the geometry/search mechanisms whose costs make
the real traversal hard.

This reference mode must be explicit and versioned, for example:

```text
reference-policy/v1
contacts+duration/v1
```

The current production model in `budget_model.ts` is not yet this frozen
protocol. It is a pragmatic first model fitted from production telemetry. It may
still be useful, but future policy work should decide whether to keep that
pragmatic basis or replace it with a reference protocol.

## Layers

Keep these layers separate:

```text
1. Structural traversal model
   spec -> D(spec)

2. Slack signal
   requested_budget / D(spec)

3. Spend-control model
   slack + knobs -> actual sim frames, first completion, repair share

4. Quality model
   slack + knobs + spec features -> score distribution

5. Production controller
   chooses candidate breadth, forward eval, repair allocation, etc.
```

A single scalar "difficulty" is not enough today. The traversal model explains
first-completion cost well, but static features do not explain final score well.
Score hardness needs separate evidence.

## Spend Knobs

There are two families of compute controls.

In-run spend rate controls how expensive a traversal attempt is:

- per-gap candidate count
- pool size
- branch width
- forward-eval depth and branch
- tail-completion breadth
- arc-placement sample richness

Post-completion allocation controls what happens after a complete incumbent
exists:

- main-search margin before repair
- repair restart count
- repair gap affordability
- per-restart ceiling
- repair-vs-resumed-frontier split

These should not be conflated. Candidate breadth changes the cost and shape of
normal traversal. Repair spends leftover budget after a complete track exists.
Both can use slack, but they answer different allocation questions.

## Validation Gates

Before any slack-based controller becomes production behavior, require evidence
at each gate:

1. **Reference validity.** The reference model predicts first-completion cost
   with seed, spec, and family holdout checks.
2. **Transfer validity.** The reference difficulty still orders/spec-scales
   production first-completion costs after normal compiler changes.
3. **Spend mapping.** A knob sweep shows how candidate count, forward eval, or
   repair settings change actual sim frames.
4. **Quality mapping.** The same sweep shows where extra spend improves score,
   and where it only burns budget.
5. **Smooth policy.** The proposed controller is continuous or probabilistically
   smooth, not a narrow budget-grid threshold.
6. **Paired evaluation.** Any production policy change goes through the normal
   probe/canonical decision path against the current baseline.

Failure at any gate means the policy should stay a study result, not become
default compiler behavior.

## Current Implementation

The current codebase has three pieces:

- `scripts/v0/optimizer/budget_model.ts` stores `TRAVERSAL_BUDGET_MODEL_V1` and
  exposes first-completion, suffix, and slack helpers.
- `compile_stats` now records `predicted_first_completion_frames` and
  `budget_slack` for every handoff compile, plus top-level
  `first_completion_frame` when the search reaches a complete traversal. It
  also records compact policy spend summaries, including the resolved candidate
  count and branch limit, so golden archives expose the spend surface used by
  each checkpoint.
- `scripts/v0/study_budget_spend.ts` sweeps one explicit breadth knob at one
  budget and reports paired compute/score deltas plus simple first-completion
  and candidate-sample response models. It supports deterministic row sharding
  with `--shard=i/n`, so larger characterization databases can be collected by
  many workers and analyzed offline from the combined JSON outputs.
  `quality_ncand` is the unified handoff breadth used from first completion
  through repair restarts.

The handoff compiler now has one traversal policy. The old contract-then-quality
split was removed after the forced-quality canonical showed that the large mode
collapse had only a small, statistically inconclusive headline movement
(`-0.8` versus the latest same-grid baseline). The remaining low-budget issue is
expected evidence that fixed high breadth can make first completion too
expensive, so future work should scale the unified knobs from a budget/difficulty
model rather than restore a separate contract mode.

The known low-budget guard row is `solo_run`, seed `7`, budget `125k`
(`16 missing`, `rideStalled@784` under fixed unified breadth). Treat it as a
targeted validation case for the future controller.

These are infrastructure and measurement steps. They do not yet install a
slack-based production controller.

## Open Questions

- Should `D(spec)` continue to be fitted from production telemetry, or should it
  move to a frozen reference policy?
- Which budget-aware ramps should be disabled or fixed in that reference policy?
- Is candidate count the best first in-run spend-rate control, or should forward
  eval be characterized first?
- How should suffix slack combine the static suffix model with measured
  `costToEnd` once real reach timestamps are available?
- What evidence would justify a separate quality-hardness model?

## Working Rule

Do not use slack as a magic score knob. Use it as a normalized coordinate system.
Every policy change must state:

```text
what difficulty quantity it uses
what spend knob it changes
why that knob should affect compute
how actual spend changed in data
how score changed in paired evaluation
```

If those answers are not available, the change belongs in a study script or
documentation, not in production compiler policy.
