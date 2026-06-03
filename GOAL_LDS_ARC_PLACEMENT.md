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

### Primary metric: last-budget mean score

The campaign optimizes the **arithmetic mean per-row score at the LAST budget** —
`150k` for the normal diagnostic, `100k` for the fast loop. This deliberately
replaces `CURVE_SCORE` as the headline.

Why: `CURVE_SCORE` integrates across all budgets, so it heavily weights the low
budgets where a slow-converging placement has not finished, and it hides the
ceiling. The 2026-06-03 full sweep showed the default `impact_anchor` placement is
hard-plateaued — pinned near a `~428` mean / `59-of-60` valid from ~60k onward, no
matter how much budget — while the decoupled `continuous` placement keeps climbing
to a `~508` mean and `60/60` valid by `110k`. `CURVE_SCORE` ranked the plateaued
default far ABOVE the higher-ceiling approach, purely because of slow warm-up. The
last-budget mean is the metric that actually distinguishes a broken plateau from a
real one.

`CURVE_SCORE` and the budget curve remain useful SECONDARY diagnostics: they show
HOW EARLY a given final quality is reached (convergence speed). A change that lifts
the last-budget mean AND pulls the curve left (reaches that quality sooner) is
strictly better; convergence speed is the standing secondary objective.

Spirit of the metric (read this before optimizing to the number): the last-budget
mean is a proxy. What we actually want is placement with a genuinely HIGH CEILING —
one that keeps converting more budget into better, more reliable tracks, instead of
plateauing early at a low cap (which is exactly the trap the default `impact_anchor`
fell into: flat from ~60k, unable to land the last contacts at any budget). So
favour approaches that raise the achievable ceiling and keep improving with budget,
even if they start slower, over approaches that top out early. A curve that is still
climbing is a sign of headroom worth chasing, not a defect — the numeric metric just
happens to measure that ceiling at a fixed cutoff. Do not sacrifice ceiling for a
prettier early curve.

Use small probes to reject ideas quickly, but do not optimize directly to them.
The fast command is the default iteration loop. The normal command is for broader
checks after a fast win.

Fast focused loop (optimize mean score at `100k`):

```bash
env LR_ARC_PLACEMENT=continuous GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npx tsx scripts/v0/golden.ts --details \
  --specs=solo_run,dense_sprint,opening_burst \
  --budgets=50000,60000,70000,80000,90000,100000 \
  --jobs=32 \
  --archive-dir=/tmp/line-contact-PROBE-fast
```

Normal diagnostic (optimize mean score at `150k`):

```bash
env LR_ARC_PLACEMENT=continuous GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npx tsx scripts/v0/golden.ts --details \
  --specs=solo_run,dense_sprint,opening_burst,tiny_dance,drums_pendulum,drums_crescendo,rhythm_ladder,syncopated_switchback,drums_tide,drums_dropout \
  --budgets=50000,60000,70000,80000,90000,100000,110000,120000,130000,140000,150000 \
  --jobs=32 \
  --archive-dir=/tmp/line-contact-PROBE-normal
```

Set `LR_ARC_PLACEMENT` to whichever placement you are probing (`continuous` is the
current lead). Full golden remains the promotion check for default compiler policy.

Always compare with:

```bash
npx tsx scripts/v0/analyze_golden_curve.ts CURRENT.json BASELINE.json
```

Read the **last-budget row of the `common-row budget deltas`** table — its
`base_mean -> cur_mean` arithmetic means at `150k` (or `100k` fast) are the primary
number. The `CURVE_SCORE delta` line is secondary (convergence), not the target.
Avoid optimizing to a single fixed seed/spec set: confirm a win on a held-out seed
triple (e.g. `20,21,22`) and the full 20-spec suite before trusting it.

Primary score lens:

- **last-budget arithmetic mean score** (150k normal / 100k fast) and last-budget
  valid count — the headline;
- the budget at which the approach overtakes the prior best (convergence cost);
- `CURVE_SCORE` and per-budget valid counts (secondary, convergence speed);
- row-level regressions and validity flips;
- candidate work and viable-candidate yield;
- placement failure split.

## Baseline And Scoreboard

The local campaign baseline was measured on 2026-06-03 from clean commit
`f94b95589e89`, with evaluator fingerprint `ff8acb41f962` and
`LR_ARC_PLACEMENT` unset. That is the current default `impact_anchor` placement
path.

For compiler changes in this campaign, only commit changes that improve the
**normal diagnostic last-budget (`150k`) mean score** by at least 5 points over
the current score to beat. Documentation-only scoreboard updates are campaign
bookkeeping.

The campaign goal is a normal diagnostic `150k` mean score of `500`, robustly
across seeds and the full spec suite, while working solely on arc placement as
defined in this document. The 2026-06-03 full sweep showed `continuous` placement
already crosses this on a held-out seed triple (`150k` mean `~508`, 60/60 valid) —
so the live objectives are now: (a) keep pushing the `150k` mean higher and keep
the win robust; (b) the standing secondary objective — reduce the budget needed to
reach it (the convergence cost), which is what `continuous` currently pays. Read
this document carefully before changing code; do not pursue spec-name overfitting
or unrelated handoff/search/scoring changes to reach the number.

The last-budget mean alone is the working metric. One caveat to keep in mind: the
mean is only a fair ceiling estimate if the curve has actually flattened by the
last budget. The `headroom` column below (last-budget mean minus the previous
checkpoint's mean) is a cheap sanity read — if it is large, the cutoff is before
the knee and the mean understates the ceiling. A richer "reward still-climbing"
metric was considered and deliberately parked (it would perversely reward slow
convergence); see `TODO.md`.

### Current baselines (2026-06-03, seeds 0/1/2)

| Scope | Mode | Archive | Last-budget mean | Valid | Headroom |
| --- | --- | --- | ---: | --- | ---: |
| Fast (mean@`100k`) | `impact_anchor` (default) | `/tmp/wb-fast-default` | `384.9` | `8/9` | `+0.2` |
| Fast (mean@`100k`) | `continuous` (lead) | `/tmp/wb-fast-continuous` | `568.1` | `9/9` | `+129` |
| Normal (mean@`150k`) | `impact_anchor` (default) | `/tmp/wb-normal-default` | `408.2` | `29/30` | `+0.6` |
| Normal (mean@`150k`) | `continuous` (lead) | `/tmp/wb-normal-continuous` | `496.7` | `30/30` | `+2.2` |

Score to beat (normal, mean@`150k`): **`496.7`** (`continuous`). Commit threshold
for a new placement: **`501.7`** (+5). The default `impact_anchor` plateaus at
`408.2` and cannot be pushed past it at any budget — `continuous` is the line to
beat now.

Note the headroom column doing its job: the default is fully plateaued on both
tiers; `continuous` is converged on the normal tier (`+2.2`) but **still climbing
steeply on the fast tier at `100k` (`+129`)** — so `568.1` is a LOWER BOUND on the
fast ceiling, and the fast loop is a quick pre-knee proxy, not `continuous`'s
converged fast score. Use the normal tier for ceiling claims.

Normal mean-score curve (seeds 0/1/2, 10 specs):

| Budget | `impact_anchor` mean | valid | `continuous` mean | valid |
| ---: | ---: | --- | ---: | --- |
| `50k` | `370.1` | `29/30` | `267.8` | `17/30` |
| `60k` | `383.0` | `29/30` | `392.8` | `25/30` |
| `70k` | `383.5` | `29/30` | `395.3` | `25/30` |
| `80k` | `388.3` | `29/30` | `449.5` | `28/30` |
| `90k` | `403.0` | `29/30` | `471.8` | `29/30` |
| `100k` | `403.1` | `29/30` | `491.5` | `30/30` |
| `110k` | `406.3` | `29/30` | `492.0` | `30/30` |
| `120k` | `407.4` | `29/30` | `494.3` | `30/30` |
| `130k` | `407.6` | `29/30` | `494.4` | `30/30` |
| `140k` | `408.1` | `29/30` | `495.3` | `30/30` |
| `150k` | `408.2` | `29/30` | `496.7` | `30/30` |

`continuous` overtakes the default at ~`60k` and is strictly better above it. The
default never reaches 30/30; `continuous` does by `100k`. Held-out cross-check
(seeds `20,21,22`, all 20 specs): default `150k` mean `428.6` / `59-of-60` valid
vs `continuous` `507.6` / `60-of-60` — the win is not seed/spec-specific.

Keep this section current. After every serious fast or normal diagnostic run,
append or update the scoreboard with:

- archive path;
- tested placement mode or branch;
- exact command scope if it differs from the workbench command;
- last-budget mean score and validity (the headline), the overtake budget, and
  `CURVE_SCORE` as a secondary convergence number;
- delta versus the current last-budget-mean score to beat, when the normal
  diagnostic was run;
- decision: rejected, keep investigating, or new score to beat.

### Session probes 2026-06-03 (placement family/anchor experiments)

All probes below were reverted (clean tree). None beat the commit threshold; they
are recorded as evidence, not as score-chasing. The default `impact_anchor` path
was kept byte-identical throughout (fast re-baseline reproduced `355.82`).

| Probe | Mode/scope | Fast CURVE | Decision |
| --- | --- | ---: | --- |
| tangent-matched `impactT` (contact tangent ≈ incoming − flatten) | gated `impact_match`, fast | `64` (flatten 8) / `201` (flatten 28) | rejected |
| firm-earliest `impactT` band (earliest contact ≥ margin flatter than fall, capped at 0.6) | gated `impact_match`, fast | `324` | rejected |
| firmer contact tangent in contact-centered (baseline flatten 2 → 10/18) | `contact_centered`, fast | `5.0` / `0.4` | rejected |
| impact-anchor arc seeded into earliest contact-centered attempt(s) | `contact_centered`, fast | `3.1` | rejected |
| arc-seed + geometry-agnostic release-state cost | `contact_centered`, fast | `3.2` | rejected |
| coarse-to-fine jitter annealing within the line family | `contact_centered`, fast | `47` (≈ neutral) | rejected |

Quantitative findings (not constant-tuning conclusions — structural):

- **`impact_anchor` `impactT` has ~zero headroom on dense gaps.** Every variation
  that moves the contact off the proven flat-anchor region steepens the local
  contact relative to the fall and collapses the owned-landing rate (e.g.
  19% → 7–10%). On a single arc, `impactT` couples firm-landing (wants the flat
  end), pre-impact exposure (preclear, wants short), and post-support (survival).
  These cannot be separated on one arc, so the documented "per-gap geometry-derived
  impact band" is a dead end *for dense specs* — `0.6` is locally optimal there.
- **`contact_centered` is not candidate-starved.** At 100k normal it finds MORE
  viable catches than `impact_anchor` (34,241 vs 30,049; 23.9% vs 17.4% viable;
  21.2 vs 17.5 sim/cand) and reaches a much higher ceiling
  (100k common-row `484.5` vs `403.1`, 30/30 vs 29/30, fixes opening_burst s1
  fail→pass). Its whole weakness is **slow convergence** (50k `46`, crosses the
  baseline by ~70k): its viable catches hand off rider states the *next* gap finds
  harder — a forward-dependency / chaining cost, not a placement-yield cost.
- **The two families are geometrically incompatible in the dense regime.** Seeding
  an `impact_anchor` arc into a contact-centered (dense, next-contact ≤ 22f) gap
  derails the whole prefix: arc geometry (length ≤ 180px, no spacing cap) spans
  into the next contact → off-beat contamination. This explains the documented
  "always-on impact-anchored portfolio derails" negative result, and why making
  the cost comparison fair (geometry-agnostic release cost) does not rescue it.

First continuous-paradigm step (KEPT as a gated experimental mode). These rows
were recorded under the OLD `CURVE_SCORE` metric and a `50k–100k` budget window,
before the metric switched to last-budget mean; kept as the discovery record. The
current authoritative numbers are in "Current baselines" above.

| Mode | Scope | CURVE (old metric) | 100k score | Validity |
| --- | --- | ---: | ---: | --- |
| `LR_ARC_PLACEMENT=continuous` | normal diagnostic | `195.90` | `485.46` | `30/30` |
| `contact_centered` (prior best decoupled) | normal diagnostic | `183.68` | `476.63` | `30/30` |
| `impact_anchor` (default) | normal diagnostic | `369.27` | `388.26` | `29/30` |

`continuous` is the contact-centered line family run for ALL contact gaps with the
`nextGapFrames <= 22` density gate removed — one generator, no density threshold.
It edges out gated `contact_centered` (`195.9` vs `183.7`) and has the highest
ceiling measured in this campaign (`100k 485.5`, 30/30 valid, vs default's `388`).
It is NOT promotable as the default: its CURVE is far below `369` because of slow
EARLY-budget convergence (50k `32`, 60k `167`), not poor yield or ceiling. The
open sub-problem is forward-dependency: line catches chain slowly because the
ride-out is placed blind to cadence. A first cadence-coupled exit shaping (ease the
ride-out toward a clean ballistic launch as the next beat nears, continuous in
time-to-next-contact) was neutral on dense specs; the real fix likely needs
predicting the candidate's ballistic approach at the next beat and shaping/
preferring catches that arrive catchable.

Paradigm note (per maintainer steer, 2026-06-03): the smell is the **piecewise,
threshold-gated multi-family structure** itself — steep-template arcs (`gapFrames
≥ 60`), impact-anchored arcs (global `impactCenter 0.6`), and contact-centered
lines (`nextGapFrames ≤ 22`) selected by hard density/speed cutoffs. Micro-tuning
any one family's constants cannot cross between regimes. The direction worth
pursuing is a **single continuous catch generator** whose pre/post extent and
shape scale continuously with the locally-available space (≈ entry speed ×
time-to-neighbor) and predicted contact state — so "long smooth arc" (sparse) and
"short tight spacing-aware catch" (dense) emerge as one continuum with no mode
switch and no literal density threshold. Forward-dependency (release-state shaping)
is the core lever; the current placement is per-gap-blind.

### Session 2026-06-04: axis-quality wall toward the `800` mean target

Decomposing `continuous`'s `496.7` normal mean: for a valid+synced track
`score = 1000 · exp(−rms(axis_error)/0.25)`, so a `800` mean needs rms axis error
`≈ 0.056`; `continuous` sits at `≈ 0.175`. The residual is dominated by a
**systematic speed OVERSHOOT** (+0.13…+0.26 mean per spec; the rider runs at
~0.74–0.92 when targets want ~0.52–0.69) and air regressing to the middle. Speed
and air are coupled (a rider that flies more free-falls and gains speed).

Six placement probes aimed at lowering speed/air ALL failed (reverted): tangent-
matched contact, an air-driven grounded↔launch ride-out, and a grounded floor
(flatten-only, length-extended, and uphill-braking variants). Every change that
would actually slow or ground the rider broke the owned-landing / survival /
off-beat gates and dropped validity. This is structural, not a tuning miss:

- A valid track needs the rider moving fast enough to stay synced and survive;
  low-friction, descent-driven physics make it run fast by default.
- Slowing it requires uphill/braking geometry that ejects or stalls the rider →
  invalid. So per spec the achievable speed has a floor set by validity.
- That floor is spec-dependent: `tiny_dance` reaches its `0.50` target validly,
  but `rhythm_ladder` (`0.50→~1.0`) and `syncopated_switchback` (`0.45→~0.8`)
  cannot get slow while valid — their speed targets are physically out of reach
  for a valid track. Those rows cap the mean well below `800`.

Implication: a `800` mean is likely NOT reachable by local catch geometry alone.
Plausible paths, each beyond a single-catch geometry tweak: (a) closed-loop axis
refinement — measure achieved axes in-engine and refine the catch toward target
(two-stage placement; crosses the placement/validation seam); (b) global energy
management / start-state shaping to lower the whole-track speed baseline (largely
outside the placement boundary); (c) confirm whether some specs' speed targets are
feasible for any valid track at all. Do NOT chase the number with braking hacks
that trade validity for a lower mean — the campaign metric rewards valid quality.

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
