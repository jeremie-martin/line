# Goal - improve arc placement

This document is a campaign brief for an agent working specifically on the arc
placement part of the compiler. The campaign goal is metric improvement: find a
better way to place required-contact catch geometry so the compiler produces
better tracks earlier and more reliably.

The fact that arc placement should be easy to swap is not the optimization
goal. It is engineering substrate: the code should make the placement boundary
clear enough that an agent can test different placement algorithms without
rewriting handoff search, validation, or scoring.

> **Workflow, metric, run tiers, and decision rule:** see [`docs/HOW_TO_WORK.md`](docs/HOW_TO_WORK.md)
> (the single source of truth). This brief covers only what's *specific to arc
> placement* — the boundary, the levers, and the scoreboard.
>
> **Status note:** live guidance = this header, **Objective → Other Approaches**,
> **Current state**, and the **Diagnostics / Working Rules / Open Questions** sections
> at the end. The **## Archive** section in between collects the historical session &
> rejected-probe log (pre-2026-06-04 metric; some conclusions retracted) — kept for the
> "don't-retry" record, not instructions.

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

## Current state

The current default is the **`continuous`** placement family plus two accepted
normal-stream placement refinements (accepted 2026-06-05):

- first required-contact gaps use the impact-anchored arc family only when the
  next authored contact is near (`<=20` frames), giving tight openings early
  ride-out structure without applying the arc family to sparse openings;
- dense-grain post-contact spacing uses the wider cap (`grain >= 0.50`,
  next-contact spacing `<=14` frames).

On the canonical `decide` (8 seeds × dense 5k–175k), the default now improves the
post-`continuous` baseline **HEADLINE 461.0 → 473.6** (ceiling 584.0 → 590.4,
logAUC 174.2 → 201.1; Δ +12.5, 95% CI [0.7, 24.7], VERDICT ACCEPT), with
160/160 validity at 175k. Archive:
`generated/golden-runs/arc-near20-spacing-default-canonical-wasm/golden.json`.
New canonical baseline: **HEADLINE 473.56**.

The older `continuous` promotion over `impact_anchor` remains important context:
it moved the default from **HEADLINE 282 → 461** and made `impact_anchor`
selectable rather than default. Workflow, metric, run tiers, and decision rule:
[`docs/HOW_TO_WORK.md`](docs/HOW_TO_WORK.md).

## Archive — historical session log & rejected probes (not live guidance)

Kept for the "don't-retry" record. Scores below predate the 2026-06-04 metric change
(old `CURVE_SCORE` / last-budget-mean framing, seeds 0/1/2) and some conclusions are
explicitly retracted (the "infeasibility" verdict). **Live guidance resumes at
"Diagnostics To Read First" further down.**

### Metrics And Workbench (historical)

> **⚠️ UPDATED 2026-06-04 — metric & decision rule replaced. Read this first; the
> subsections below predate it and are retained as historical rationale.**
>
> - **Headline metric:** `HEADLINE = α·q(b_max) + (1−α)·logAUC`, α=0.7 (ceiling-
>   weighted area under quality-vs-log(budget)), emitted in `golden.json`'s
>   `headline` block and printed by `npm run golden`. It supersedes both
>   `CURVE_SCORE` (now legacy) and the "last-budget mean" framing below. See
>   `scripts/v0/metric.ts` and `docs/metric_problem_statement.md`.
> - **Decision rule:** run `npm run decide -- <candidate>/golden.json
>   <baseline>/golden.json` → paired cluster-bootstrap VERDICT (accept iff the
>   headline-Δ 95% CI lower bound > 0 AND validity does not regress at the ceiling
>   budget). The fixed **"+5" commit threshold is RETIRED** — it is inside the
>   measured noise. Convergence speed stays a reported, non-gating secondary.
> - **Seeds:** the canonical decision uses the 8-seed default `{0..7}`;
>   `GOLDEN_SEEDS_OVERRIDE=0,1,2` is a cheap *smoke*, not a decision basis.
> - **Budgets:** canonical runs use the dense `DEFAULT_BUDGETS` (5k–175k);
>   `--score-budgets=50000,100000,150000` scores the canonical few (and enables
>   honest comparison against older archives).
> - **Jobs:** for full canonical runs (8 seeds × dense grid) pass
>   `--jobs=$(( $(nproc) / 2 ))`. A full `--jobs=$(nproc)` can OOM — each worker
>   holds ~1 GB, so 32 workers OOM'd a 62 GB box.

### Primary metric (HISTORICAL framing — superseded; see banner above): last-budget mean score

The campaign *previously* optimized the **arithmetic mean per-row score at the LAST
budget** — `150k` for the normal diagnostic, `100k` for the fast loop, which itself
had replaced `CURVE_SCORE`. The HEADLINE metric (banner) is now the headline; the
"last-budget mean" survives only as the ceiling term `q(b_max)` inside it.

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

> **`opening_burst` is excluded from the benchmark (2026-06-04, HUGE TODO).** It
> is the suite's lone catastrophically-fragile spec: its required-contact chain
> flips from fully valid to ~all-missing (560→0) under the tiniest placement
> perturbation, and the breaking seed moves randomly run to run. A valid run is
> luck, not placement quality, so it drowns real per-axis signal. It has been
> removed from `GOLDEN_SPECS` (`golden_suite.ts`) and these workbench `--specs`.
> RESTORE it once the compiler is hardened to fragile forward-dependency chains
> (chain-aware selection — search/scheduler territory, outside this brief). See
> `docs/archive/TODO.md`.

Fast focused loop (optimize mean score at `100k`):

```bash
env LR_ARC_PLACEMENT=continuous GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npm run golden -- --details \
  --specs=solo_run,dense_sprint,tiny_dance \
  --budgets=50000,60000,70000,80000,90000,100000 \
  --jobs=32 \
  --archive-dir=/tmp/line-contact-PROBE-fast
```

Normal diagnostic (optimize mean score at `150k`):

```bash
env LR_ARC_PLACEMENT=continuous GOLDEN_SEEDS_OVERRIDE=0,1,2 \
  npm run golden -- --details \
  --specs=solo_run,dense_sprint,tiny_dance,drums_pendulum,drums_crescendo,rhythm_ladder,syncopated_switchback,drums_tide,drums_dropout \
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

### Baseline And Scoreboard (historical)

The local campaign baseline was measured on 2026-06-03 from clean commit
`f94b95589e89`, with evaluator fingerprint `ff8acb41f962` and
`LR_ARC_PLACEMENT` unset. That is the current default `impact_anchor` placement
path.

For compiler changes in this campaign, commit a change only when
`npm run decide -- <candidate>/golden.json <baseline>/golden.json` returns
**VERDICT: accept** (headline-Δ CI lower bound > 0 and no ceiling-budget validity
regression). The former "improve the last-budget mean by ≥5 points" rule is RETIRED
(+5 is inside the measured noise; see the banner and `docs/metric_problem_statement.md`).
Documentation-only scoreboard updates are campaign bookkeeping.

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
convergence); see `docs/archive/TODO.md`.

### Session 2026-06-05 (ACCEPTED): cadence-aware first contact + dense spacing cap — HEADLINE 461 → 474

**Accepted change.** Within the `continuous` normal stream, keep contact-centered
lines as the default geometry, but use the impact-anchored arc family for the
first required-contact gap when the next contact is within 20 frames. This is a
generic cadence signal, not spec-name logic: sparse openings stay on lines, tight
openings get earlier ride-out structure. The same change promotes the wider
dense-grain post-length cap (`grain >= 0.50`, next contact `<=14` frames), which
keeps closely spaced dense contacts from overextending downstream support.

| Default (`decide`, canonical 8 seeds × dense 5k–175k) | HEADLINE | ceiling | logAUC | validity@175k |
| --- | ---: | ---: | ---: | ---: |
| baseline `continuous` (`arc-baseline-canonical-wasm`) | 461.0 | 584.0 | 174.2 | 160/160 |
| default with near-first arc + wide spacing (`arc-near20-spacing-default-canonical-wasm`) | **473.6** | **590.4** | **201.1** | **160/160** |

Decision output:
`Δheadline = +12.5 · 95% CI [0.7, 24.7] · P(Δ≤0)=1.9% · effect=2.06 · VERDICT: ACCEPT`.

Verification:

- `LR_ENGINE=wasm npx vitest run tests/handoff_policy.test.ts` — 31/31 pass.
- `LR_ENGINE=wasm npm run golden -- --details --jobs=8 --archive-dir=generated/golden-runs/arc-near20-spacing-default-canonical-wasm`
- `npm run decide -- generated/golden-runs/arc-near20-spacing-default-canonical-wasm/golden.json generated/golden-runs/arc-baseline-canonical-wasm/golden.json`

### Session 2026-06-05 (COMMITTED): promote `continuous` to the default placement — HEADLINE 282 → 461

**The accepted change.** The shipped compiler default was `impact_anchor`
(`LR_ARC_PLACEMENT` unset) — the campaign's true baseline. `continuous` had been the
gated lead for weeks but was never promoted because the OLD `CURVE_SCORE` metric
over-rewarded `impact_anchor`'s fast-but-low plateau. The NEW ceiling-weighted
HEADLINE metric (designed for exactly this) flips the verdict decisively:

| Default (`decide`, canonical 8 seeds × dense 5k–175k) | HEADLINE | ceiling | logAUC |
| --- | ---: | ---: | ---: |
| `impact_anchor` (old default, `/tmp/base-impact`) | 282.4 | 342.0 | 143.1 |
| `continuous` (new default, `/tmp/base-cc-0`) | **460.6** | **583.9** | 172.9 |

`npm run decide -- /tmp/base-cc-0/golden.json /tmp/base-impact/golden.json`:
**Δheadline +178.2 · 95% CI [140.1, 231.7] · P(Δ≤0)=0.0% · effect 7.73 → VERDICT:
ACCEPT** (ceiling validity also improves: continuous is 160/160 by 115k; impact_anchor
never reaches it). The change is one line in `arcPlacementMode()` (default → continuous,
impact_anchor kept selectable); pure placement-family selection, no spec-identifying
logic, budget-oblivious. New canonical baseline: **HEADLINE 460.55** (`/tmp/base-cc-0`).

Everything below this entry studied improvements *within* `continuous` (now the default)
and found none that clear the bar — but the family promotion itself is the session's win.

### Session 2026-06-05: HEADLINE baseline + four placement probes (all reverted)

First session under the new `HEADLINE = 0.7·q(b_max) + 0.3·logAUC` metric + `npm run
decide` rule, on the canonical 8-seed × dense-5k–175k grid (`continuous`).

**Canonical baseline (`/tmp/base-cc-0`, `LR_ARC_PLACEMENT=continuous`, commit
`3df5ef4`, fingerprint `9b9776df145f`):**

```
HEADLINE 460.55 · ceiling=583.85 · logAUC=172.85 (alpha=0.7) · 160/160 valid @175k
```

The ceiling is CONVERGED (582→584 from 115k→175k); logAUC is the large gap.

**Diagnosis (the two walls, quantified):**

1. *Ceiling is axis-quality-bound, dominated by AIR, which COMPRESSES to the middle.*
   Aggregate signed air error at 175k (achieved−target): target `<0.25` n=216
   `+0.311` (**100% over**); `0.25–0.5` `+0.080`; `0.5–0.75` `−0.039`; `>=0.75`
   n=1296 `−0.139` (**90% under**). Speed is centered (signed ≈0, abs ≈0.10); grain
   is excellent (abs ≈0.05). For a valid track the score reduces to
   `1000·exp(−rms_axis/0.25)` (drift/missing/survival gates already force ≤±1), so
   the ONLY ceiling lever is axis-error, and that is air. The worst rows
   (drums_pendulum/crescendo, ~444–475) are air-walled on alternating-air gaps and
   on the first contact (g0 air ≈0.90 vs target 0.15–0.35).
2. *logAUC is gated by long-dense-spec CHAIN COMPLETION, not placement yield.* Fast
   specs validate at 30–40k; the slow ones come online 50–65k; `solo_run` (25 s,
   ~78 contacts) is `0/8` even at 65k. That is search-depth/scheduler, outside the
   placement boundary.

**Why AIR is structurally walled within placement (first-principles, verified):**
air over a gap = airborne-frame fraction over `[prevContact, thisContact]`. The
rider is airborne the whole flight unless GROUNDED on a ride surface; grounded
frames come from (a) the previous ride-out and (b) catch-crossings — but the
ride-out is an UP launch (energy-speed-shaped) that EJECTS the rider rather than
grounding it, so ride-out length barely moves air. Low air needs a long continuous
ground, which a per-gap catch cannot supply, and any landing onto such a surface in
`[start, contact]` trips the off-beat gate. g0 low-air is doubly blocked: grounding
the first free-flight needs either a start-ramp landing (off-beat reject) or a
start-VELOCITY change (start policy) — both outside placement.

**Four placement-only probes, all REVERTED (cheap-probe evidence; none merited a
canonical decide):**

| Probe | Mechanism | Result |
| --- | --- | --- |
| forward-air ride-out (`LR_NEXTAIR`) | size grounded ride-out by the NEXT gap's air (the flight it actually grounds), fixing an off-by-one on alternating-air specs | air bands unchanged (ride-out is an up-launch ⇒ doesn't ground); per-row **net-negative** on the alternating specs it targeted (drums_pendulum −10) |
| pre-air shorten, always (`LR_PREAIR`) | shorten high-air pre-contact approach (drop in more airborne) | improved yield (preclear −32%, landing 34→39%) + logAUC, but **cost ceiling** (516→505 probe) — same knob, net wash |
| pre-air shorten, odd-attempt diversity | keep full ramp in pool, add short variant | **worse on both** ceiling (537→525) and logAUC (167→148) |
| energy-launch dive clamp (`LR_DIVE_CLAMP` 0.45→0.70) | allow steeper accelerating dive for high-speed targets | ceiling ≈flat, **logAUC 304→250** (steeper dives break low-budget validity); aggregate speed is already slightly OVER, so the stalls are localized chain effects, not a dive-clamp limit |
| contact-Y landing span (`LR_CYSPAN`) | deterministic per-attempt vertical contact-point offset = a compute-free landing-frame search to raise the 32% landing yield | **catastrophic** (HEADLINE 445→74, landing 29%→7%, survival fails 1.9k→13k). The predicted-sled contact placement is already well-calibrated; offsetting it just misses/ejects. Landing failures come from the APPROACH geometry, and grounding the approach to aid landing fights low-air via the >=6-airborne-frame rule — coupled, not separable |

**Two CANONICAL pre-air candidates (8 seeds × 20 specs, decided by `npm run decide`):**

One probe above (pre-air shorten) had a REAL general mechanism — a shorter
high-air pre-contact ramp is less exposed pre-beat, so preclear rejects fall and
the rider drops in more airborne → more valid catches/gap. The 4-spec smoke's
ceiling dip was noise; the full canonical disagreed. So it was promoted to a
canonical decide:

| Candidate | mechanism | canonical `decide` vs baseline |
| --- | --- | --- |
| `pre-air K=0.5/T=0.5` (mild, high-air only) | shorten high-air pre-contact ≤50% | **Δheadline +5.7**, ceiling 583.85→**591.41**, logAUC +1.4, preclear −25%, landing 31.6→35.2%, validity held. CI **[−3.1, 16.6]**, P(Δ≤0)=10.9%, effect 1.18 → **INCONCLUSIVE** (real gain, but at/below the metric's ~10-pt 8-seed noise floor — exactly the regime the retired "+5" rule was retired for) |
| `pre-air K=0.6/T=0.35` (broadened) | also shorten moderate-air gaps | **Δheadline −10.8**, ceiling 571.3, CI [−86.9, 17.3], ceiling validity 100→99% → **REJECT-grade**. The big negative tail = broadening to T=0.35 shortened moderate-air gaps and broke a fragile chain on a spec/seed |

**Probe-overfit caution (important):** a 6-spec × 3-seed probe ranked `0.6/0.35`
**+20 over** `0.5/0.5`; the full 8-seed canonical **inverted** it to **−16**. Cheap
smokes are unreliable for choosing a continuous control's setpoint — confirming the
brief's "smokes are not a decision basis." Only the mild high-air-only version is
positive, and it caps at ~+5.7 (the preLength is already small, so amplifying within
the safe region adds little; broadening regresses).

**16-seed held-out cross-validation kills the +5.7 (decisive).** Because the 8-seed
CI lower bound was only −3.1, I ran the held-out seeds `{8..15}` for both baseline
and `pre-air K=0.5/T=0.5`, merged to a 16-seed cube, and re-ran `decide`:
**Δheadline +0.1 · CI [−15.1, 10.2] · P(Δ≤0)=42.3% · effect 0.02.** The gain
**vanishes** — `{0..7}` is +5.7, so `{8..15}` is ≈−5.5: the change helps some seeds
and hurts others, netting ~zero. The +5.7 was **seed luck**, exactly as the metric's
~10-pt 8-seed noise floor flagged. So `pre-air` is NOT a real improvement and was
correctly NOT committed. (This also validates the strict rule over the maintainer's
older cross-validated-commit practice: here the single-set positive was a fluke.)

**Conclusion (matches and sharpens the brief's own "reachable bottleneck has moved
off placement"):** at `continuous`'s converged ceiling (584, already well past the
campaign's original 500 goal), the best in-boundary placement lever found (high-air
pre-contact shortening) looked like +5.7 on the 8-seed canonical but a **16-seed
held-out cross-validation collapsed it to +0.1 (seed luck)**; every other lever was
≤0. No placement change tested achieves a real, robust HEADLINE gain — the
achievable gains are at/below the metric's noise floor, so there is currently
nothing to commit under the `decide`-accept rule. The remaining real headroom
requires off-placement work: (a) chain-aware / multi-gap-rollout selection in the
handoff to complete long chains earlier — the logAUC limiter (`solo_run` 0/8 even
@65k) and the source of the broadening regression; (b) a continuous-surface /
start-ground primitive + start-energy planning to reach extreme (esp. low) air
targets and fix the systematic g0 air. No code change kept this session; baseline
preserved at HEADLINE 460.55 (`/tmp/base-cc-0`), validated against a held-out
16-seed set.

### Session 2026-06-04 (PM): height-shaping paradigm — robust mean ~497 → ~557

Worked the `continuous` normal stream on the **9-spec** suite (opening_burst now
excluded from the benchmark — see above). Metric discipline this session:
**every constant/structural choice was decided on 10 seeds AND cross-validated on
a disjoint 10 seeds (0–9 vs 10–19)**, because the per-row mean has a ~±10–15
validity-flip noise floor on a single 10-seed set. Committed wins (all on
`work-new`):

| Change | seeds 0–9 | seeds 10–19 | note |
| --- | ---: | ---: | --- |
| baseline (`continuous`, level launch) | `516.4` | `516.9` | 88/90, 89/90 |
| + horizontal-pace-gated level span | — | — | folded into baseline |
| + energy-targeted launch + grain round | `531.9` | `526.4` | speed rms `0.184→0.155` |
| + air-targeted grounded ride-out length | **`561.3`** | **`552.1`** | 90/90, 89/90 |

**New robust score to beat (9-spec mean@`150k`): ~`557`** (avg of `561.3`/`552.1`).

Paradigm: the rider's measured pace is governed by the track's **height
trajectory**, not local geometry. Two continuous, general controls (no per-spec
branch), both derived from the gap's own targets:
- **exit/launch angle ← speed target** (energy: `dh=(v_t²−v_in²)/2g` fixes the
  launch `vy`; climb to brake, dive to accel; clamped to stay descending at the
  next contact). Cut speed rms `0.184→0.150`.
- **ride-out length ← air target** (`groundedFrames≈(1−air)·N`, capped below the
  next-contact distance). Also stabilises the forward chain (recovered solo_run
  multi-gap breaks: validity `87→90`).

Rejected this session (clean, recorded as evidence):
- `LR_LEVEL_SCALE` over-return tuning: `+10` on 0–9 but `−11` on 10–19 → overfit.
- Aggressive grounded ride-out (length sized to full `(1−air)·N` with the old
  level launch): catastrophic validity collapse (`~296`/`~243`).
- Curvature-bounded ride-out (length OR segment smoothing of the exit turn): the
  length variant regressed (`−22`); the segment variant was neutral. The
  remaining solo_run-class breaks are multi-gap chain effects, not local bounces.
- Air-length strength `0.9` vs `0.6`: a wash on mean (better air rms, noisier
  validity) → kept `0.6`.

Remaining wall (honest): speed is largely matched on most specs; the residual
error is dominated by **air on DENSE gaps**, which is set by the *approach* flight
(previous launch) and is coupled to speed through the single launch — the
ride-out length only moves air on sparse gaps. Pushing past ~`557`→`700` likely
needs grounded-uphill braking (bleed speed while staying grounded/low-air — the
ejection-prone primitive) or trajectory/chain-aware planning (out of the
placement boundary).

### Current baselines (2026-06-03, seeds 0/1/2) — HISTORICAL (pre-2026-06-04 metric; numbers are last-budget mean / CURVE_SCORE, seeds 0/1/2, not the HEADLINE)

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

A seventh probe isolates WHERE the remaining bottleneck lives. Instead of forcing
one slower catch, it gave the handoff a validity-preserving feasibility-band SWEEP
across the speed-control dimension, so the cost-sorted selector could KEEP the
slowest catch that still passes the gates. It regressed (459 → 376 on a speed
subset, validity 18→15): the selector kept catches that pass their OWN gap's gates
but hand off a state the NEXT gap cannot catch. So the placement is already
offering candidates at the chain-feasible frontier; the limit is the handoff's
greedy local-axis-cost selection, which does not weigh multi-gap consequences.
That is a search/scoring concern, which this brief deliberately keeps OUTSIDE the
placement boundary.

### Descend↔level ride-out span (committed, ON by default in `continuous`)

After retracting the infeasibility claim (speed IS reducible — see below), the
descend↔level span lifts the normal mean@`150k`:

| Scope | base `continuous` | + level-span | delta |
| --- | ---: | ---: | --- |
| seeds 0/1/2, mean@150k | `496.7` (30/30) | `512.4` (29/30) | **+15.8** |
| held-out 20/21/22, mean@150k | `503.1` (30/30) | `514.4` (29/30) | **+11.3** |

The catch's ride-out is spanned across a gap's candidate batch from descending
(fast, reliably on-beat) toward a per-gap level launch (vy = -½·g·N, which holds
speed instead of building it); the handoff keeps the slowest catch that still
lands on-beat. Big per-row gains land exactly on the overspeed specs
(`syncopated_switchback` +118, `drums_pendulum` +86). Known regression: it breaks
`rhythm_ladder` s0 (441→0) — a level catch there leads to an uncatchable later
contact (a chain-break the handoff preview misses), so recovering that last
validity flip needs chain-aware selection (search), not placement. Net mean still
clears the +5 commit threshold robustly on both seed sets. New score to beat:
`~512` (seeds 0/1/2 mean@150k).

RETRACTION (2026-06-04): the "infeasibility" conclusion below was WRONG. A
slow-start + level-ride-out test brings `rhythm_ladder` to achieved speed 0.63 vs
0.62 target (and `syncopated` to 0.63 vs 0.63) — the speed is NOT structurally
floored. The forced-start test misled because it used DESCENDING continuous
catches that re-accelerate; level catches reach the speed target. What collapses
instead is VALIDITY (the slow-level rider misses the beats — 19 missing contacts on
`rhythm_ladder`). So the real open problem is landing precisely ON-BEAT while slow,
which is a PLACEMENT problem (joint speed + on-beat landing), not a physical
impossibility. The analysis below is kept for the record but its infeasibility
verdict is retracted.

EMPIRICAL (now superseded) forced-start test (`rhythm_ladder`, continuous,
150k): compiling with the start velocity FORCED slow does not produce a slow
track — achieved speed stays ~0.89 for forced starts of vx = 5, 6, 7 and the
searched ~8.5 (target 0.69), and the forced-slow runs go INVALID (missing
contacts). The rider accelerates to ~0.89 regardless of start, because the
descending track + landing-requires-descent forces it; you cannot start it slow
(it accelerates anyway) and trying breaks contacts. So the speed target is
structurally unreachable for this spec by ANY valid track the compiler produces —
its row is floored near ~450 even with perfect air/grain. Tight-cadence specs like
it cap the mean. This is measured, not argued: `800` mean is infeasible for the
suite without changing the contact definition, the scoring, or the specs' speed
targets — none of which is arc placement.

Architectural root (verified by the level-track probe): the systematic speed
overshoot is the track DESCENDING — each catch is anchored at the falling sled, so
every contact sits lower than the last and the rider accelerates. The physics fix
is a LEVEL track: launch the rider just enough to return to the same height next
beat (release vy = -½·g·N). Implemented as a per-gap ride-out launch, it scored
4.9 / 0-of-12 valid — because a contact-centered catch is a LANDING (rider
descending onto it), and immediately relaunching it upward ejects it. You cannot
land-and-relaunch at one point. A level track requires the rider to FLOW over a
gently-undulating continuous surface without discrete land→catch events — a
different compiler primitive (continuous surface), not per-gap catches. So the
speed ceiling is a structural property of the per-gap-catch model itself.

Quantified ceiling (per-track upper bound, seeds 0/1/2, `continuous`, 150k): if
air AND grain errors were driven to ZERO and only the speed error the optimizer
converges to remained, the mean caps at **~627** — still far below `800`. So the
air/grain levers (the ones placement can move somewhat) cannot reach `800` on
their own; `800` strictly requires cutting the SPEED error itself (roughly halving
per-axis speed error, on top of perfect air/grain). That is the validity-floored
fall-to-land speed cycle below, which breaks validity when fought with local
geometry. Net: the honest placement ceiling here is ~`500` actual / ~`627` with
perfect air+grain; `800` needs the speed cycle broken, which is search/energy
territory the brief excludes.

Mechanism (verified against `detector.ts`): a `landing` is only emitted when
`airborneRun > K_BOUNCE_LANDING` (K=5) — every contact needs ≥6 airborne frames
of descent before it. So each beat structurally injects a fall (→ speed gain), and
shedding that speed needs a climb, which stops the descent so the NEXT contact
bounces instead of landing. That fall-to-land↔speed cycle is the precise reason
the speed-span catches broke the chain. It is spec-dependent: loose-cadence specs
(e.g. `tiny_dance`) DO reach low speed targets; tight-cadence specs
(`rhythm_ladder`, `syncopated_switchback`) cannot, and cap the mean. (Note: the
per-gap air floor `6/gapFrames` is only `0.19–0.46` vs mean air targets
`0.33–0.69`, so targets are mostly ABOVE the floor — the cap is the speed cycle,
not a blanket air-floor infeasibility. An earlier "infeasible for the whole suite"
framing was an overstatement and is retracted.)

Implication: a `800` mean is not reachable by the placement levers tried, and is
structurally very hard (not cleanly proven impossible) because of that cycle; the
reachable bottleneck has largely moved off placement. What this compiler "ought to
be" for tight speed/air targets is **trajectory-aware**: speed and air are
whole-path properties
(energy and airtime accumulate across gaps), so they cannot be controlled by a
per-gap greedy catch search. The architecture that could reach `800` plans the
rider's energy/airtime profile across the track and then realises it with geometry
— spanning start-state/energy planning, chain-aware selection (score candidates by
multi-gap rollout, not one-gap axis cost), and placement together. Plausible
concrete paths, each beyond a single-catch geometry tweak: (a) chain-aware
selection in the handoff; (b) global energy / start-state shaping to lower the
whole-track speed baseline; (c) confirm whether some specs' low speed targets are
feasible for ANY valid track. Do NOT chase the number with braking hacks that
trade validity for a lower mean — the metric rewards valid quality, and such hacks
both fail and overfit.

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
