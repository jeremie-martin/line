# Goal - improve arc placement

This document is a campaign brief for an agent working specifically on the arc
placement part of the compiler. The campaign goal is metric improvement: find a
better way to place required-contact catch geometry so the compiler produces
better tracks earlier and more reliably.

The fact that arc placement should be easy to swap is not the optimization
goal. It is engineering substrate: the code should make the placement boundary
clear enough that an agent can test different placement algorithms without
rewriting handoff search, validation, or scoring.

## Objective

Improve the compiler by improving local required-contact geometry placement.

The primary behavior to improve is:

```text
given a prefix engine state and a required-contact gap,
predict the rider/contact state at the target frame,
place candidate local track geometry,
validate it in the engine,
let handoff search/ranking decide whether to use it.
```

The common idea worth keeping is that placement should leverage predicted rider
state at the intended contact time. The method is open. It does not need to be
the old impact-anchored arc, the current contact-centered line probe, or even an
arc-shaped primitive. Completely different approaches are in scope if they obey
the compiler contract and are measured honestly.

Good results should improve the budget curve and row-level contract/quality
without overfitting to named specs or one exact target threshold.

## Current Code Boundary

The boundary has been made explicit enough for placement work:

- `scripts/v0/arc_placement.ts` owns placement state, placement geometry output,
  placement-family selection, and the existing placement samplers.
- `scripts/v0/core/candidate.ts` owns validation/evaluation of emitted geometry:
  pre-target proximity, owned landing, survival, off-beat rejection, axis
  measurement, and local candidate cost.
- `scripts/v0/optimizer/sample.ts` is the atomic bridge: read predicted state,
  call the placement sampler, validate the returned geometry, and attach
  candidate metadata.
- `scripts/v0/optimizer/handoff.ts` owns search, ranking, extra streams, reuse,
  frontier scheduling, and best-so-far selection.

That division is intentional. Placement work may change geometry proposal, but
should not silently change search policy or scoring.

The current placement output type is:

```ts
type ArcPlacementGeometry =
  | { kind: "arc"; arc: Arc }
  | { kind: "lines"; lines: TrackLine[] };
```

The current placement input is still passed as function parameters rather than
one object. Conceptually it is:

- deterministic RNG;
- `gap` and sample `attempt`;
- candidate sample mode: `normal`, `brake`, or `air_support`;
- next line id for emitted geometry;
- target axes for the gap;
- predicted target state at `gap.endFrame`:
  contact/sled point, velocity, speed, and velocity angle;
- contact timeline context, currently all authored contact frames.

If this grows, prefer one explicit input object. Do not create a framework; the
goal is a clear seam for experiments, not abstraction for its own sake.

## Responsibilities

Arc placement is responsible for proposing local geometry for a contact gap.

It may:

- use predicted rider state at the target contact frame;
- use authored axis targets as generative hints;
- use local cadence context such as next contact spacing;
- choose arc-backed or line-native geometry;
- expose placement diagnostics needed to compare methods;
- preserve deterministic RNG consumption or explicitly update tests when the
  deterministic sample prefix changes.

It should not:

- read requested budgets;
- inspect spec names;
- decide best-so-far outputs;
- schedule search frontier work;
- repair suffixes;
- run final-track scoring;
- silently change `brake` or `air_support` stream semantics while testing a
  normal-stream placement method.

Validation remains separate and engine-grounded:

- reject likely pre-target sled collisions;
- require an owned landing at `gap.endFrame +/- 1`;
- require survival through the local margin/measurement horizon;
- reject off-beat landings before the next measurement boundary;
- measure achieved axes and candidate cost.

## Existing Approaches

### Initial/default approach: `impact_anchor`

This is the old/default production family. It samples an arc shape, samples an
along-arc `impactT` around global `impactCenter = 0.6`, then translates the arc
so that the local point at `impactT` sits at the predicted sled/contact point.

This works, but it is fragile. `impactT` is overloaded: moving it changes local
contact tangent, curvature history, pre-contact geometry, post-contact support,
and collision exposure. The goal is not to discover whether `0.62` is better.
The goal is to find a placement method whose controls are less coupled and more
robust.

### Rejected bridge: `impact_frame`

Feature gate:

```bash
LR_ARC_PLACEMENT=impact_frame
```

This tried to choose the contact tangent in the predicted impact frame and solve
arc start/end angles around it. It kept an arc output and downstream validation.

Empirical result: much worse. It produced many candidates that cleared pretarget
checks but failed the owned-landing gate. The useful lesson is that local tangent
alone is not enough when pre-contact clearance and post-contact support remain
coupled through one arc.

### Current opt-in probe: `contact_centered`

Feature gate:

```bash
LR_ARC_PLACEMENT=contact_centered
```

This normal-stream probe emits line-native geometry around the predicted contact
point. It explicitly samples contact tangent, pre-contact length/tangent,
post-contact support length/tangent, grain-derived segment length, point jitter,
and soft speed-aware brake/accel pressure.

Steep templates and specialized `brake` / `air_support` streams remain
arc-backed. Loose next-contact spacing falls back to the initial/default
impact-anchored arc family.

The current evidence is mixed:

- focused dense rows improve strongly at high budgets;
- early budget curve is much worse than the default;
- some remaining failures are local placement/sample-efficiency problems;
- some failures are search/scheduler problems and should not be misattributed to
  placement.

Treat this as one candidate approach, not the destination.

## Other Approaches Are In Scope

Do not restrict the campaign to small edits of `contact_centered` or
`impact_anchor`.

Plausible families include, but are not limited to:

- line-native pre/contact/post fragments;
- arc primitives with explicit pre/post length controls and derived `impactT`;
- small libraries of local catch templates selected from predicted state;
- two-stage placement: cheap analytic proposal followed by local refinement;
- feasibility-band probes that estimate viable contact regions before sampling;
- explicit first-contact/start-transition placement;
- mode-specific contact-centered versions of `brake` and `air_support`;
- release-state-aware ranking terms, if they remain generic and not
  overdominant.

The common constraint is not "must be an arc." The common constraint is: use the
predicted rider/contact state to place local geometry, then let the engine gates
and handoff ranker judge it.

## Metrics And Workbench

Use small probes to reject ideas quickly, but do not optimize directly to them.
The fast command is the default iteration loop. The normal command is for
broader checks after a fast win.

Fast focused loop:

```bash
env LR_ARC_PLACEMENT=contact_centered GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npx tsx scripts/v0/golden.ts --details \
  --specs=solo_run,dense_sprint,opening_burst \
  --budgets=50000,60000,70000,80000 \
  --jobs=32 \
  --archive-dir=/tmp/line-contact-PROBE-fast
```

Normal diagnostic:

```bash
env LR_ARC_PLACEMENT=contact_centered GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npx tsx scripts/v0/golden.ts --details \
  --specs=solo_run,dense_sprint,opening_burst,tiny_dance,drums_pendulum,drums_crescendo,rhythm_ladder,syncopated_switchback,drums_tide,drums_dropout \
  --budgets=50000,60000,70000,80000,90000,100000 \
  --jobs=32 \
  --archive-dir=/tmp/line-contact-PROBE-normal
```

Full golden remains the promotion check for default compiler policy.

Always compare with:

```bash
npx tsx scripts/v0/analyze_golden_curve.ts CURRENT.json BASELINE.json
```

Primary score lens:

- `CURVE_SCORE` and per-budget valid counts;
- last-budget score/validity;
- row-level regressions and validity flips;
- candidate work and viable-candidate yield;
- placement failure split.

## Baseline And Scoreboard

The local campaign baseline was measured on 2026-06-03 from clean commit
`f94b95589e89`, with evaluator fingerprint `ff8acb41f962` and
`LR_ARC_PLACEMENT` unset. That is the current default `impact_anchor` placement
path.

For compiler changes in this campaign, only commit changes that improve the
normal diagnostic `CURVE_SCORE` by at least 5 points over the current normal
score to beat. The current normal score to beat is `369.27`, so the current
minimum compiler-change commit threshold is `374.27`. Documentation-only
scoreboard updates are campaign bookkeeping.

The campaign goal is to reach a normal diagnostic `CURVE_SCORE` of `500`, while
working solely on arc placement as defined in this document. Read this document
carefully before changing code; do not pursue spec-name overfitting or unrelated
handoff/search/scoring changes to reach the number.

Current baselines:

| Scope | Archive | CURVE_SCORE | Last Budget | Validity |
| --- | --- | ---: | ---: | --- |
| Fast focused loop | `/tmp/line-arc-baseline-fast/golden.json` | `355.82` | `80k: 358.13` | `8/9` |
| Normal diagnostic | `/tmp/line-arc-baseline-normal/golden.json` | `369.27` | `100k: 388.26` | `29/30` |

Fast focused budget scores:

| Budget | Score | Valid |
| ---: | ---: | --- |
| `50k` | `353.17` | `8/9` |
| `60k` | `354.07` | `8/9` |
| `70k` | `357.95` | `8/9` |
| `80k` | `358.13` | `8/9` |

Normal diagnostic budget scores:

| Budget | Score | Valid |
| ---: | ---: | --- |
| `50k` | `347.64` | `29/30` |
| `60k` | `361.78` | `29/30` |
| `70k` | `363.04` | `29/30` |
| `80k` | `368.47` | `29/30` |
| `90k` | `388.16` | `29/30` |
| `100k` | `388.26` | `29/30` |

Keep this section current. After every serious fast or normal diagnostic run,
append or update the scoreboard with:

- archive path;
- tested placement mode or branch;
- exact command scope if it differs from the workbench command;
- `CURVE_SCORE`, per-budget scores, and validity;
- delta versus the current normal score to beat, when the normal diagnostic was
  run;
- decision: rejected, keep investigating, or new score to beat.

## Diagnostics To Read First

Placement counters:

- `arc_placement.sampled`;
- `preclear_rejected`;
- `direct_attempted`;
- `direct_landed`;
- `direct_failed`;
- `direct_survival_failed`;
- `direct_landing_failed`;
- `direct_offbeat_failed`;
- per-sample-mode split: `normal`, `brake`, `air_support`.

Search counters that prevent false attribution:

- `candidates_sampled/candidates_viable`;
- `handoff_selected_candidate_by_source`;
- `handoff_selected_candidate_rank_*`;
- `handoff_preview_contacts/previews`;
- `handoff_full_evaluations`;
- `handoff_unique_full_evaluations`;
- `handoff_tail_completion_*`;
- `handoff_frontier_oldest_gap_lag`;
- `handoff_deepest_seen_gap`;
- `handoff_skips`.

Classify a row before changing placement:

- shallow prefix + low viable candidate rate: likely placement/start candidate
  problem;
- deep prefix + no full output: likely scheduler/tail completion problem;
- many full outputs but low axis quality: ranking or quality-primitive problem;
- high preclear rejects: geometry is too exposed before the beat;
- high landing failures: local contact tangent/support is wrong;
- high survival failures: contact lands but ride-out is unstable;
- offbeat failures: geometry contaminates adjacent contacts.

## Recent Negative Evidence

Do not repeat these without a new hypothesis:

- always-on impact-anchored portfolio beside contact-centered placement:
  selected very few anchored candidates and could derail a valid prefix;
- quality-only anchored portfolio:
  safe but essentially neutral;
- release-speed penalty weight `0.35 -> 1.0`:
  interpretable but too dominant;
- low-discrepancy/Halton-like contact-centered sampling:
  broader coverage hurt basin selection;
- monotonic high-target speed carry:
  physically tempting but harmed dense/high-speed quality;
- high-speed/high-air fallbacks shaped around the failing fixtures:
  rejected as overfitting.

These failures do not prove the ideas are impossible. They show that small
knobs and generic "more work" can easily damage the deterministic prefix path.

## Working Rules

1. Start from a failure-mode hypothesis, not from a constant to tune.
2. Make one placement change at a time.
3. Keep validation and search policy unchanged unless the experiment explicitly
   says it is not a placement-only change.
4. Preserve sample-mode semantics: normal, brake, and air-support streams should
   remain distinct.
5. Prefer interpretable physical controls over coupled parameters.
6. Revert clean but losing probes; record the evidence.
7. Promote only changes that survive focused probes and broader diagnostics.

## Open Questions

- What is the best primitive family for dense required-contact rhythm: lines,
  arcs with derived contact point, templates, or something else?
- Should `brake` and `air_support` get explicit contact-centered profiles?
- Which release-state signals are robust enough to keep beyond speed magnitude:
  angular velocity, body orientation, contact posture?
- How should first-contact/start-transition placement be handled without
  mixing placement with scheduler policy?
- What family-aware diagnostics are needed before multiple placement families
  can run in one mode without hiding their yield?
