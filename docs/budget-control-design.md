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
6. **Paired evaluation.** Any production policy change goes through a canonical
   `eval --seeds=N` comparison against the matching cached baseline prefix.

Failure at any gate means the policy should stay a study result, not become
default compiler behavior.

## Current Implementation

> **2026-08-03 status.** The controller this section once described as future
> work is shipped. `optimizer/deadline.ts` is the one live deadline signal, the
> estimator artifact's budget law is its scale, and the artifact's interval band
> sizes every repair restart ceiling. The *Validation Gates*, *Non-Circularity*,
> *Layers* and *Working Rule* sections below are current and remain the design
> rules; this section is the inventory, and it now names what actually runs.

The current codebase has six pieces:

- `scripts/v0/optimizer/budget_model.ts` stores `TRAVERSAL_BUDGET_MODEL_V1` and
  exposes the legacy structural first-completion predictor and policy-facing
  slack helper. It is the DIFFICULTY coordinate: `budgetSlack = B / D(spec)`,
  static per compile, chooses the shape of spend. It is never derived from the
  estimator and the estimator is never derived from it.
- `scripts/v0/optimizer/deadline.ts` is the DEADLINE coordinate and the only
  live controller: one `CompileDeadline` per compile, read once per expanded
  node, producing `margin = remaining policy budget / estimated remaining work`
  and one ramp over it (`DEADLINE_MARGIN_FULL_PRESSURE` 1.25,
  `DEADLINE_MARGIN_NO_PRESSURE` 2.0). Three consumers read that one signal —
  the forward-eval head ramp, the aim-lane throttle and the
  online-continuation dominance filter — and the three pace signals it replaced
  (`observedTraversalBudgetSlack`, the online lane's spend-vs-progress
  comparator, the aim lane's copy of the first) are deleted from the code. The
  margin's structural base is the estimator artifact's coefficients and its
  budget law, passed explicitly; the module's own header carries the
  measurements that chose that shape.
- `scripts/v0/optimizer/budget_telemetry.ts` records compile accounting,
  execution segments, attempt lifecycles, structural/path/pace estimates,
  uncertainty, and completion margins. It is observation-only; see
  [`compile-budget-telemetry.md`](compile-budget-telemetry.md). Two per-attempt
  outcome fields now carry the quantity layer 4 is missing for the
  post-completion knobs: `accepted_score_delta` is the incumbent score a repair
  restart bought, and `first_accepted_improvement_offset_frames` is the charged
  work it took to buy it — together a directly measured repair ROI per frame,
  which is the mapping "where extra spend improves score" needs and which
  completion rate cannot supply, since repairs complete at nearly 100%. The
  surface also attributes the resumed-search phase, so the
  repair-vs-resumed-frontier split is now measurable on both sides rather than
  only on the repair side.
- `scripts/v0/optimizer/budget_estimator_model.json` is the frozen telemetry
  estimator artifact. Its applicability is explicit: structural estimates are
  calibrated over the policy budgets its corpus covered and, since the
  2026-08-01 recalibration, only for `initial` attempts — full incumbent-path
  coverage means no repair observation is path-free any more, and `resumed`
  attempts are continuation-approximate and never fitted. Available
  incumbent-path estimates are separately identified but, since the 2026-08-01
  budget-law refit, only inside that same domain — `[250k, 1.5M]` since the
  2026-08-03 revalidation: they are unbiased inside it and 19% biased at 150k.
  Extrapolated observations do not expose
  calibrated completion margins. The schema-v2 structural block also carries
  `budgetExponent: 0.825` and `referenceBudgetFrames: 750000`, scaling remaining
  work by `(B / refB)^alpha` so one fit answers across a band of budgets instead
  of at one point; an absent or zero exponent is exactly the v1 model.
  **The artifact is LIVE POLICY on both layers, not telemetry.** Its
  coefficients, base mode, correction factors and that exponent are the deadline
  margin's base and scale (`deadline.ts`), and its `interval` band is the repair
  restart ceiling (`handoff.ts` `repairRestartCeilingFrames`, feeding
  `pickFeasibleWeakGap`). Only `applicability` and `metrics` are inert for
  policy. Editing `budget_estimator_model.json` therefore changes what the
  compiler searches, and correctly changes `compilerSourceFingerprint` — the
  artifact is inside `COMPILER_SOURCE_PATHS`.
  What *Non-Circularity* below still forbids is substituting this spend model
  for the layer-1 difficulty predictor: the two coordinates stay separate
  models, computed and passed separately (see `budget-law-study.md`).
  It is also a stale-sweep quantity: any change to a breadth ramp, the
  forward-eval gate, or the branch limit owes it a re-fit — and because the fit
  moves live policy, re-fitting it is a promotion-class change that takes the
  48-seed benchmark. `calibrate_budget_estimator.ts --freeze-point-model`
  freezes the bands with the point model for exactly that reason;
  `--refit-intervals` is the explicit, loudly-warned opt-out.
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

The production controller is installed. It is not slack-based: `budgetSlack`
stayed the difficulty coordinate and the controller reads the deadline margin
instead, which is why the two are separate models above. The remaining gap is
visibility — the margin is computed on every expanded node and appears in no
eval archive, so the filed `1.25 / 2.0` re-bracket and the pace-term re-price
have no data to run on.

### Measured repair cost everywhere (first telemetry-informed policy change)

The repair phase's `costToEnd` profile now accepts a node's reach timestamp
from either producer of incumbent nodes — the frontier and the near-tail
completion pass — instead of the frontier alone. Policy and telemetry read one
array again. This is the first change where the telemetry surface altered
compiler behaviour rather than only describing it.

The evidence is the coverage measurement that motivated it: first completion
routinely arrives through the tail pass, so 161 of 307 panel repair attempts
anchored at a gap the frontier never processed and were sized by `perGap`, the
average-over-the-whole-search estimate the code itself calls dead-end-biased.
At exactly those anchors the measured profile predicts actual repair completion
cost to 3.0% median APE. Sizing a restart from a 3%-accurate measurement rather
than from that average is the whole mechanism; `feasMargin` and every other knob
are unchanged.

A 24-cell sanity probe (6 golden specs × 2 seeds × {150k, 750k}) shows the
mechanism moving as intended — `per_gap_fallback` ceilings 58.9% → 0%, repair
rounds 314 → 361, accepted repairs 86 → 90, contract still passing everywhere —
with a score effect well inside probe noise (mean `+0.30`, median `0.00`, 10
wins / 10 losses / 4 ties). The probe was a mechanism check, not a verdict.

**Evaluation status: evaluated and promoted.** `05cc801` made `firstReachOf`
min-merge the two maps — take the EARLIEST stamp when both producers stamped the
same memoized node, because the frontier can re-stamp a tail-created node later
and shrink `costToEnd` at exactly the anchors the tail map was added for — and
`69d71a8` promoted it at **exact parity**, +0.00 on every stratum and source at
N=48, validity 2112/2112. `05cc801` also added the zero-ceiling guard that keeps a
`structural`-base-mode artifact from sizing every restart at zero frames.

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
