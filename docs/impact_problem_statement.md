# `impact` — landing intensity semantics

Living doc. This is about the meaning and measurement of the author-facing
`Contact.impact` value, not about changing the compiler yet.

## Summary

`impact` should remain a **landing** metric:

> the landing absorption intensity of a beat: how much normal closing speed the
> contacted landing surface asks the rider to absorb during the first few frames
> of a real landing.

The current implementation measures one instant. The follow-up probes show that a
short post-landing window often contains extra perceived hardness, especially on
rounded, steep, or multi-segment catches. The clean next candidate is a
**landing-anchored, decayed peak normal-speed window**, with `bounce`, `kick`, and
`flyThrough` kept as diagnostics rather than as the semantic basis of `impact`.

## Current Metric

Today `impact` is authored per beat:

```ts
{ t: 1.75, impact: 0.85 }
```

It is resolved into the terminating gap's target bag and scored as an axis-like
per-gap scalar. The achieved value is:

```ts
pointImpact =
  min(1, abs(preImpactVelocity perpendicular to firedCatchTangent) / CALIB.IMPACT_CAP)
```

where `CALIB.IMPACT_CAP = 5 px/frame`.

The code intentionally reads `landingFrame - 1`, not the velocity delta at the
landing frame. The engine's collision response smears the stop over several
frames, so a direct `v[landing] - v[landing - 1]` is not a stable landing impulse.

Implementation references:

- `scripts/v0/core/measure.ts` (`measureImpact`)
- `scripts/v0/core/substrate.ts` (`normalImpactPxAtLanding`)
- `scripts/v0/types.ts` (`CALIB.IMPACT_CAP`, `impactCeiling`)
- `scripts/v0/score.ts` (`axis_quality`, where impact is currently scored)

## Problem

One frame is not always what a landing feels like.

A rider can touch down on a tangent-smooth part of an arc and then, within a few
frames, run into a steeper continuation, a rounded high-angle surface, or a bumpy
multi-segment catch. At high speed, those frames are a small fraction of a second;
at `FPS = 40`, five frames is `0.125s`. A human may perceive the whole short
absorption/redirection episode as the landing impact, even if the first contact
frame reads moderate.

So the central question is:

> should `impact` be an instantaneous contact-frame measure, or a short
> landing-window measure?

There is a separate timing question:

> should a beat accept an adjacent frame, for example one frame early?

Keep these separate. Magnitude changes what value we compute. Timing tolerance
changes which event counts as the beat. The recommendation here is to settle the
magnitude semantics first and leave beat tolerance as a later, explicit decision.

## Alternatives Tried

The exploratory harness is:

```bash
LR_ENGINE=wasm npx tsx scripts/v0/study_impact_window.ts probe_impact --budget=40000 --window=5 --detail=8
```

It now seeds rows from `landing`, `bounce`, and `flyThrough` events, so it can see
off-scale contacts instead of inheriting the old landing-only blind spot.

The candidate columns are:

- `point`: current one-frame normal-speed metric.
- `max`: maximum normal-speed value over `[eventFrame, eventFrame + window]`.
- `decay`: maximum normal-speed value with a temporal decay, `1.0` at `dt=0`
  down to `0.5` at `dt=window`.
- `rms`: RMS normal speed over contacted frames in the window.
- `dv`: peak one-frame velocity delta, normalized by `IMPACT_CAP`.
- `turn`: cumulative contacted-surface tangent turn, normalized by `45deg`.
- `kick`: detector kick angle, reported only as a diagnostic.

Why these alternatives:

- `point` is the current baseline.
- `max` tests whether felt impact is simply the hardest jolt in the short
  landing episode.
- `decay` keeps the metric musically anchored: later frames can matter, but not
  as much as the beat frame.
- `rms` tests sustained roughness rather than a spike.
- `turn` tests rounded high-angle redirection, which is not identical to a
  discrete shock.
- `dv`, `kick`, `bounce`, and `flyThrough` are useful warning signals, but they
  are detector/physics classifications rather than clean author-facing semantics.

## Results

### Dedicated probe: `probe_impact`, budget `40k`, window `5f`

```text
events=21 (landing 17, bounce 4, fly 0)
point impact    p50 0.28  p90 0.70  max 0.96  mean 0.37
max impact      p50 0.51  p90 0.78  max 1.00  mean 0.47
decayed impact  p50 0.33  p90 0.70  max 1.00  mean 0.41
rms impact      p50 0.35  p90 0.60  max 1.00  mean 0.37
extra max       p50 0.06  p90 0.30  max 0.47  mean 0.11  n>=0.10 6/21
dv score        p50 0.14  p90 0.31  max 0.94  mean 0.21
turn score      p50 0.05  p90 0.29  max 0.65  mean 0.12
off-scale       4/21  near beat 1  hard-hidden 0
```

Takeaways:

- The window effect is real. Six of twenty-one events gained at least `0.10`
  normalized units under plain max.
- Plain max is aggressive. It moves the median from `0.28` to `0.51`.
- Decayed peak is more conservative and keeps p90 equal to the point p90 here,
  while still exposing hard delayed cases.
- Bounce rows exist, but in this run they were not the hard-hidden failure mode.

### Small mixed sample: default four specs, budget `40k`, window `5f`

Command:

```bash
LR_ENGINE=wasm npx tsx scripts/v0/study_impact_window.ts --budget=40000 --window=5 --detail=0
```

Aggregate:

```text
events=60
point impact    p50 0.30  p90 0.70  max 0.96  mean 0.33
max impact      p50 0.45  p90 0.85  max 1.00  mean 0.46
decayed impact  p50 0.33  p90 0.76  max 1.00  mean 0.39
rms impact      p50 0.34  p90 0.65  max 1.00  mean 0.37
extra max       p50 0.07  p90 0.36  max 0.53  mean 0.13  n>=0.10 25/60
off-scale       10/60  near beat 1  hard-hidden 0
```

Takeaways:

- The windowed max frequently raises the readout.
- Decayed peak and RMS are much less jumpy than plain max.
- Off-scale events are visible now, but this sample does not show hard off-scale
  beat contacts.

### Golden smoke: all golden specs, budget `5k`, window `5f`

Command:

```bash
LR_ENGINE=wasm npx tsx scripts/v0/study_impact_window.ts --golden --budget=5000 --window=5 --detail=0
```

Aggregate:

```text
events=697
point impact    p50 0.19  p90 0.48  max 1.00  mean 0.23
max impact      p50 0.30  p90 0.66  max 1.00  mean 0.35
decayed impact  p50 0.23  p90 0.54  max 1.00  mean 0.28
rms impact      p50 0.22  p90 0.49  max 1.00  mean 0.26
extra max       p50 0.06  p90 0.29  max 0.99  mean 0.12  n>=0.10 245/697
off-scale       98/697  near beat 12  hard-hidden 0
```

Caveat: `5k` is deliberately cheap and many runs score poorly, so this is a
harness smoke test, not quality evidence. It confirms that the fan-out works and
that off-scale events are visible across the suite.

## Discussion

### Why Not Use `bounce` As Impact?

`bounce` can be a useful hint that something harsh happened, but it is not a clean
author-facing definition of landing intensity. It is a detector classification:
short airborne run plus persistent contact. Some bounces are meaningful, some are
not, and the signal is not calibrated to "the landing felt hard."

Using bounce directly would blur several concepts:

- a hard catchable landing,
- a brief rhythm bounce,
- a missed/unstable contact,
- a detector classification artifact.

So `bounce` should remain diagnostic. It can help identify failure modes, but it
should not define `impact`.

### Why Not Use `kick`?

Same reason. A kick can correlate with perceived violence, but it is a velocity
angle-change event. It may be caused by geometry, rotation, collision response, or
post-landing steering. It is useful to inspect, not clean enough to be the metric.

### What About `flyThrough`?

`flyThrough` is more important than bounce as a failure diagnostic because it can
mean the rider made a brief high-speed contact attempt that did not persist. But
it still should not silently become "impact." It is better reported as a failed
contact mode:

```ts
impactStatus: "measured" | "missing" | "flyThrough"
```

This keeps the meaning of `impact` clean while preserving the information that a
near-beat contact attempt occurred.

### Bumpy vs Rounded Geometry

These are related but not identical:

- Bumpy / multi-segment catches produce discrete shocks. A peak normal-speed
  metric captures this well.
- Rounded high-angle arcs can feel hard because the surface continuously redirects
  the rider over several frames. A pure peak may under-read this; `turnSum` or a
  velocity-redirection term may eventually be useful.

For the first metric change, keep the primary value simple and landing-like:
decayed peak normal speed. Keep `turn` as a diagnostic column until we have human
labels or stronger evidence that it belongs inside `impact`.

## Proposed Semantics

Recommended definition:

> `impact` is the decayed peak normal closing speed into the contacted landing
> surface during the first short, continuous grounded episode of a real landing.

Sketch:

```ts
for k in landingFrame..landingFrame + 5:
  if rider is no longer in the same grounded landing episode:
    stop
  tangent = average unit tangent of contacted landing line(s) at k
  normalPx = abs(velocity[k - 1] perpendicular to tangent)
  weight = lerp(1.0, 0.5, (k - landingFrame) / 5)
  candidate = weight * normalPx

impact = min(1, max(candidate) / CALIB.IMPACT_CAP)
```

For final compiler integration, the scored measurement should resolve tangents
only against the gap's owned catch lines, matching today's ownership rule. Full
track inspection tools can continue resolving against all lines.

This keeps the metric:

- anchored to an actual landing,
- compatible with the existing normal-speed semantics,
- sensitive to immediate post-contact geometry,
- resistant to a single late frame fully overriding the beat,
- independent of detector labels like `bounce` and `kick`.

---

## Empirical Verdict (2026-06-09): the windowed proposal does NOT capture felt impact

The "Proposed Semantics" above (decayed-peak normal speed over a window) was tested
directly and **does not do what we want**. This section supersedes it. Three new
harnesses drove the conclusion (all under `scripts/v0/`, all analysis-only):

- `study_impact_window.ts` — adds a TRUE velocity-redirection column (`redir`) and a
  driver-correlation block to the existing point/max/decay study.
- `study_impact_body.ts` — re-sims real tracks and measures the body/sled-point jolt,
  strike, and body fold per landing.
- `study_impact_jolt.ts` — records the full per-point dynamics of every rider entity
  through a landing (detail dump for one beat, aggregate scan across many).

All runs: `LR_ENGINE=wasm`, seed 0, budget 80k, window 5f, `IMPACT_CAP=5px/f`, over a
representative set (`big_air_ramp pop_train float_bounds rolling_drop skyline_push
swoop_dive rolling_hills probe_impact shelter_amp shelter_curves`).

### 1. The windowed metric measures surface curvature, not the rider

The windowed metric's *extra* over the point metric (329 landings):

```text
corr(extra, surface-turn)        0.77   <- what it actually tracks
corr(extra, true vel-redirection) -0.00  <- what we wanted it to track
corr(extra, real velocity jolt dv) 0.06
corr(extra, catch hardness point) -0.30  <- it inflates MOST where the catch was softest
```

Of the 148 landings where windowed-max lifts ≥0.15 over point, **103 (70%) are false
positives**: the catch surface (a faceted arc) curves *away* from a rider that keeps
gliding straight, so `|v ⊥ tangent|` grows with no real impulse. 85% of all events are
continuous-glide (no air gap → no re-impact), and the genuine re-impacts are not harder.

Mechanism, seen frame-by-frame (`study_impact_glide_case.ts`):
- `shelter_curves @1406`: velocity heading is flat (13.5°→12.2°), speed flat ~10.7 px/f,
  yet `normalPx` climbs to 3.24 (0.65 norm) purely because the tangent swings 12.7°→−4.1°.
  **The rider is never redirected.** A clean false positive.
- `float_bounds @576`: velocity heading genuinely turns 51°→23° at ~9.5 px/f — a *real*
  redirection — but the windowed-max over-reads it (1.00 vs a true redirection of ~0.49).

### 2. True velocity redirection is a clean signal — and `point` already tracks it

`redir` = peak lateral speed the CoM acquires ⊥ its incoming heading over the window
(= speed·sin(turn)), same px/frame units, **independent of surface faceting/grain**. It
is high only when the rider's own motion actually bends — exactly the "velocity
redirected at speed feels like an impact" intuition.

```text
corr(point,        redir) 0.90   <- the CURRENT one-frame metric already tracks it
corr(windowed-max, redir) 0.89
corr(decayed,      redir) 0.94
corr(surface-turn, redir) 0.42   <- surface turn is NOT velocity redirection
```

The redirection happens *at the catch*, so the one-frame `point` already captures it
(0.90). The windowed *extra* adds noise (corr ≈ 0), not signal.

### 3. The jolt is the felt impact — "boom + wiggle" — and lives in the body, early

The engine simulates 12 entities (`engine-rs/src/lib.rs`): 4 sled points
(PEG/TAIL/NOSE/STRING) + 6 body points (BUTT/SHOULDER/RHAND/LHAND/LFOOT/RFOOT). SHOULDER
is the topmost body point (≈ head/torso); **there is no separate head, and the scarf is
cosmetic and not simulated** — so scarf-jolt is unavailable.

Per-frame dynamics confirm the "collision → boom → wiggle" model:
- **Hard landing** (`big_air_ramp @469`, 12 px/f in): baseline accel ~0.18 → **boom** at
  the catch, then a whole-body **ring** peaking SHOULDER 5.8 / hands 6.15 over 3 frames,
  decaying to baseline by +8 frames.
- **Soft glide** (`shelter_curves @1406`, 10.6 px/f in): accel *stays at baseline at the
  catch* (no boom), then a smaller, delayed ripple (~3 at +5 frames).

Aggregate (168 landings):
- The jolt is strongest at the **extremities (hands, shoulder, max 6.1–6.2) and sled
  corners**, weakest at the **body core BUTT (max 3.1)** — a faithful jolt watches the
  whole body, not the CoM.
- Best definition: `corr(ring-energy, fold) 0.64`, `corr(peak-accel, fold) 0.61`, but
  `corr(literal-wiggle/reversal-count, fold) 0.05` — **the felt signal is acceleration
  magnitude/energy, NOT the oscillation count.** Body deformation (SHOULDER–BUTT crush)
  is small in this regime (p50 0.50px, max 1.52px), so accel is the better read.
- **Timing matters and validates the whole story:** plain peak-accel tracks the CoM catch
  at 0.62, but an **early-weighted boom** (down-weighting the delayed ripple) tracks it at
  **0.77 (point) / 0.82 (redir)**. The felt jolt is the *immediate* boom at the catch; the
  delayed glide-ripple the windowed-max inflates on is *not* a felt boom.

## Recommendation (revised)

1. **Do not adopt the decayed/max windowed normal-speed metric.** Its added window tracks
   surface faceting, not felt impact, and produces ~70% false positives on the gentle,
   curved catches the current compiler favors.
2. **Keep the one-frame catch-anchored CoM measure as the core.** It already proxies the
   felt body boom at 0.77 and true velocity redirection at 0.90 — about as well as any
   windowed alternative, at zero extra cost.
3. **If/when we extend it, extend toward the rider, not the surface:**
   - cheap path — replace/augment `point` with **`redir`** (peak lateral speed ⊥ incoming
     heading over a short window): same units, faceting-independent, the best cheap proxy
     for the felt boom (0.82). Parameter-light.
   - faithful path — an **early-weighted peak body/extremity acceleration** ("the boom"):
     the most direct felt-impact ground truth (it *is* the force on the body). Heavier
     (needs body-point sim via the cold-path `getRider`), so use it as the validation /
     audit signal, and once v2 steering pushes landings into the violent, rotation-heavy
     regime (where CoM and body diverge — see [[landing-impact-lever]] divergence data),
     re-test whether the cheap CoM proxy still suffices or the body jolt must be used
     directly.
4. **Drop these from consideration:** plain windowed-max/decay (surface artifact), the
   literal "wiggle"/reversal count (noise, 0.05), and `dv`/`kick`/`bounce` as the metric
   basis (unchanged from the original doc — diagnostics only).

## Jolt campaign + adversarial review + rigor pass (2026-06-09)

We then tested the user's hypothesis that `impact` should BE the **jolt** (the rider's
body acceleration — "boom + wiggle") directly, not a correlate. A controlled
drop-grid (`scripts/v0/study_impact_dropgrid.ts`), a body-dynamics recorder
(`study_impact_jolt.ts`), a cost benchmark (`bench_jolt_access.ts`), a fresh-eyes
adversarial review, and a rigor pass (`study_impact_perturb.ts`, `study_impact_rigor.ts`)
produced a clear — and partly self-correcting — picture.

**Cost / feasibility.** `point` reads pre-extracted velocity/contactLineIds and is
near-free (111 ns/frame). The 6 body points hit a cold path (`getStateMapAtFrame`
rebuilds the 12-entity map per frame) and are NOT in the extracted trajectory:
~8,900 ns/frame, **80× the point path**, ~36 µs per authored landing. ⇒ trivial at
report time (~3.6 ms/track), but prohibitive in the per-candidate optimizer loop
(impact IS measured per candidate, `core/candidate.ts`→`axisCost`). The 80× is not
fundamental — body points are slow only because they're off the Rust fast-frame;
adding them (like sled points, 223 ns) or an analytic `v=v_CoM+ω×r` from fast sled
data collapses it to ~2×.

**What the jolt IS.** Engine = 12 entities (4 sled + 6 body: BUTT/SHOULDER/RHAND/
LHAND/LFOOT/RFOOT; SHOULDER ≈ head; no head entity; scarf cosmetic/unsimulated).
Per-frame body acceleration through a hard landing is a real boom + decay: profile
`2.87, 4.38, 6.81(+2f), 1.52, 0.84, 0.53` — peaks ~2 frames after contact, decays by
+5. Extremities (hands/shoulder) and sled corners jolt hardest; the core (BUTT)
least. Hard head-on catches (normal closing ≳ 8 px/f) **eject** the rider (off-scale).

**The review corrected three of my evidence claims (kept honest here):**

1. *"Jolt is noisier under faceting (CV ~20%)"* — **confounded.** The dropgrid grain
   test changed `speedIn`/landing frame across facet counts and included an ejected
   row. The clean test (`study_impact_rigor.ts` T2: a straight catch subdivided
   colinearly, identical geometry/speed/landing frame) gives **CV 0.0% for every
   metric including the jolt.** Pure discretization adds NO jolt noise.
2. *"Jolt is monotonic with hardness at 0.996"* — **circular** (the x-axis was `point`
   itself). Against an **independent** knob (drop height, T3): `point` Spearman
   **1.000**, jolt flavors **0.83–0.93**. `point` tracks physical hardness *better*
   than the jolt — because the jolt carries real **body-pose jitter**: same hardness,
   different wobble-phase at contact → jolt swings ~17% (`study_impact_perturb.ts`),
   while `point` is ~2%. This is a real, legitimate caution for an author-facing knob.
3. *"early-weighted peak is the right flavor"* — **not won.** Against the independent
   knob, **peak (0.927) ≥ impulse=∫a dt (0.867) > earlyBoom (0.830)**; the earlyBoom
   preference was an artifact of the circular test. The literal "wiggle"/reversal-count
   remains noise (0.05). Determinism (T1): the jolt is **bit-identical across reruns**
   (within-engine; cross-engine wasm/rust parity still untested before any scoring use).

**Corrected recommendation.** Keep the one-frame CoM `point` as the core metric — it
is cheap, deterministic, stable under discretization, AND (now shown) a *cleaner*
monotonic hardness signal than the jolt, which is pose-jittery. The jolt is the most
physically faithful in principle, but on honest tests it is not a better hardness
measure; its only real edge is capturing rotation/extremity strikes the CoM
geometrically cannot — which only matters in the violent/rotation regime that v2
steering will create. So:

- Now: keep `point`; do NOT switch to a windowed normal-speed or a raw jolt.
- v2 (steering): produce the violent-regime tracks, then measure where `point` and the
  body jolt actually diverge (the one decision number nobody has yet); if the gap is
  real, add a body-jolt term computed cheaply (fast-path/`ω×r`), pose-averaged to tame
  the jitter, with **ejection surfaced as an `impactStatus` flag + a continuous
  saturating magnitude** (not a regex-triggered MAX clamp, which would be a scoring
  cliff), and a measured rotation-arrest candidate on the board (it was never tested).

Open from the review, before any scored jolt: cross-engine determinism; an `∫a dt`
vs `peak` decision with confidence intervals on a larger sample; and the violent-regime
`point`↔jolt divergence magnitude.

## Deformation ("body falls into the ski") + the rotation confound (2026-06-09)

The user's strong physical intuition: a hard impact is felt as the **body collapsing
into the ski/segment** — the ~90° rider–sled angle folding to 30°/20°/5°. In mechanics
this is **elastic deformation / strain** (peak force ∝ deflection, Hooke). We built it
properly on the engine's actual constraint sticks (`scripts/v0/study_impact_deformation.ts`,
`study_impact_strain.ts`): sled / body / rider↔sled-bind sticks, rest length from a clean
airborne frame, with variants peak strain, impact-induced Δstrain, strain-rate, and
rider↔sled bind compression. It's attractive in principle: position-based (low noise,
unlike the accel jolt) and rotation-*invariant* for rigid motion.

But the user labeled one beat decisively — the max-jolt Shelter beat **t=48.33** — as
NOT a hard landing ("just a rotation while landing on the arc"). That beat is the test:

- **`point` (closing speed) reads it soft** (rank 61/96) — matches the user.
- **Every body-configuration signal reads it hardest**: jolt #1, deform-peak #1,
  Δstrain #1, strain-rate #1, fold-angle largest (72°). They all contradict the user.
- **Per-group decomposition is the key**: the failure beat's deformation is concentrated
  in the **sled frame (1.70) and body (1.03)** — the sled *wrenching* to align with the
  steep arc — while genuinely high-closing beats have **low body deformation (~0.3)**: a
  clean slam comes in aligned and the rigid sled absorbs it without the body folding.
  On this track, **body deformation ANTI-correlates with closing-speed impact** — it is
  largest exactly when closing speed is lowest (a low-speed rotation onto a steep arc).

So "the body folds into the ski" is real but, on this beat, it's driven by **rotation**,
not by closing into the surface — and the user does not perceive that as a hard landing.
Every body-fold/jolt/strain variant inherits this rotation confound; only closing speed
(`point`) is consistent with the felt judgment.

Caveats kept honest: (1) this rests on **one** user-labeled beat — not enough to retire
the idea; more labels are needed, which is why the comparison video below exposes
POINT/DEFORM/JOLT/ROTATION per beat for the user to label. (2) A controlled drop-grid
contrast (`study_impact_rotcase.ts`) was **inconclusive** — rest-drops didn't reproduce
Shelter's flight-rotation-into-a-curved-arc, so `bodyDef` was flat there. (3) deform/jolt
still correlate ~0.6–0.7 with `point` overall; they only diverge on rotation beats.

**Working conclusion (pending more labels):** the felt "hard landing" tracks **closing
speed into the surface** (`point` / CoM normal). The body-fold/jolt/deformation family,
though visually compelling and mechanically elegant, measures rotation-wrench where it
diverges from closing — and on the one labeled beat that divergence is wrong. Next step
is to collect a handful more felt-hard / felt-soft labels and validate `point` vs the
body family against them, rather than against proxies.

## CoM velocity-change family — direction change = impact (2026-06-09)

Resolving the rotation confound pointed straight at the answer: the felt impact is **how
much the surface changes the CENTER-OF-MASS velocity**. At t=48.33 the CoM sails through
nearly straight (heading turns only ~8° over the window at 11.8 px/f) — which is exactly
why it feels soft — while the sled rotates and limbs flail. A CoM-velocity metric is
rotation-immune *by construction*, and is close to the original `point` idea (normal
closing speed *is* the velocity component the surface redirects).

`scripts/v0/study_impact_velchange.ts` measures the family per landing over a window:
`turnNet`/`turnPeak`/`turnCum` (heading change, deg), `redir` (speed × turn = lateral
speed acquired), `dvPeak`/`dvGrav` (total CoM velocity change; gravity-corrected = the
impulse per unit mass). On Shelter (96 beats):

- **Every member correctly demotes the failure beat** (ranks 26–61/96), unlike jolt/
  deform (#1). The whole family agrees on the genuinely hard beats (71.1, 51.9, 45.9,
  75.9) and correlates ~0.85 with `point`. The user's direction-change intuition is
  validated and is NOT rotation-confounded.

Physical distinctions among the members (the choice hinges on beats where they diverge,
which need user labels — Shelter has them agreeing at 0.85):
- **angle-only** (`turnNet`): flags a *slow* gentle curve as hard and misses a head-on
  dead-stop (no angle change). Needs speed-weighting.
- **redir** (speed × turn): fixes the slow-curve issue, but a pure head-on deceleration
  has no perpendicular component → reads ~0 (a real miss).
- **dvGrav** (total gravity-corrected |Δv| = impulse): most complete — folds direction
  change AND speed loss into one physical quantity; catches head-on stops and
  redirections alike. **Lead candidate.** It generalizes `point` (a one-frame normal
  projection) to the full velocity change over the contact, stays CoM-based (cheap,
  deterministic, rotation-immune), and matches the user's labeled soft beat.

**Δv decomposition — the principle (user-confirmed, `study_impact_velchange.ts --show`).**
Split the CoM velocity change into PERPENDICULAR (redirection = `redir`) and PARALLEL
(slowdown along the path). The user labeled t=49.55 as "a weird slowdown, not a strong
impact": its change is parallel-dominated (slowdown 3.51 > redir 2.81), so **Δv over-reads
it (4.50) but `redir` correctly discounts it (0.56)**. Genuinely hard beats (71.1/51.9)
are perpendicular-dominated (redir ≈7.4 ≫ slowdown ≈3.3). So the felt principle is:

> **impact = the surface REDIRECTING the path (perpendicular velocity change); decelerating
> ALONG the path (parallel slowdown) is NOT impact.**

`redir` IS the perpendicular component → this is why it beats Δv. A real head-on slam is a
redirection (vertical→horizontal), so redir catches it; only a pure glide-slowdown is
parallel, which redir correctly discounts.

**CONVERGED metric (user remarks 2026-06-09):** `redir` — peak perpendicular (redirection)
component of the CoM velocity change over the landing window = the redirection impulse.
Rotation-immune, speed-weighted ("at speed hits harder"), excludes slowdown; generalizes
the one-frame `point` (which under-reads windowed redirections). `turn` is the
un-speed-weighted cousin (very close; redir's slight edge = the speed weighting). `Δv` is
out (includes slowdown). Jolt/deformation are out as the *impact* metric (rotation-
confounded — ranked the user's soft beat #1); they measure rotation/tumble, a separate
phenomenon the user sees but does not feel as a hit.

**Label-validated (2026-06-09, `study_impact_labels.ts`).** The user gave rough felt
ordinal labels on the divergent beats (72.33 very strong, 41.13 pretty strong, 49.53/
63.93/74.13 a bit less, 48.33 soft; 71.13/51.93 hard anchors). Spearman vs felt:
`redir`/`turn` 0.83, `redirRate` 0.79, `dv` 0.74, **`point` 0.31** (fails — confirms the
one-frame metric under-reads windowed redirections). Window sweep: the felt match peaks
at **W≈6** (redir 0.86, turn 0.91; degrades past W=8), and W=6 is where the
41.13>63.93 ("pretty strong > a bit less") call flips correct. So the felt "claquage" is
a sustained ~6-frame (~0.15s) redirection episode — not an instant (W=2–3 ≈ 0) nor a long
drift. The onset-decay and pure-suddenness variants do NOT beat plain windowed redir.
`turn` edges `redir` slightly on these n=8 rough labels, but `redir` is chosen for being
speed-weighted (claquage requires speed), in `point`'s px/frame units (a clean
generalization), and window-robust.

**LOCKED DIRECTION: impact = `redir`, peak ⊥ (redirection) component of the CoM velocity
change over a `W=6`-frame window, normalized by `REDIR_CAP=8.5`.**

Calibration (`study_impact_calibrate.ts`, 351 landings / 16 varied golden tracks, W=6):
redir envelope p50 1.83 / p90 4.33 / p95 5.26 / p99 6.50 / max 8.23 px/frame. The hardest
*catchable* landings top out ~8.2–8.7 (beyond that the catch ejects), so `REDIR_CAP=8.5`
is the natural absolute ceiling. The felt labels map cleanly onto it: soft→0.20,
a-bit-less→0.36, pretty-strong→0.70, very-strong→0.84, hardest→1.0 (only 63.93 sits high
at 0.60 — the known gradual-redirection imperfection). `W=6` and `REDIR_CAP=8.5` live in
`study_support.ts` as the single source (`point`'s cap stays `IMPACT_CAP=5`).

Remaining: promote into the compiler measure (`core/measure.ts measureImpact`, today the
one-frame `point`) — a scoring-definition change requiring a golden re-baseline; gate on
explicit go. More felt labels on a second track would harden W/cap beyond Shelter's n=8.

### Visual companions

- `remotion/out/shelter_impact_deform.mp4` (1080p) — current artifact: big top-center
  panel, lanes **POINT / DEFORM / JOLT / ROTATION**. At t=48.33 DEFORM+JOLT+ROTATION
  spike while POINT stays dark — the rotation confound made visible; for collecting more
  felt-hard/soft labels.
- `remotion/out/shelter_impact_compare.mp4` — earlier version, lanes POINT / JOLT /
  REDIRECT / WINDOWED. Both built by `CurveOverlay.tsx` `BigImpactPanel` +
  `scripts/make_overlay_data.ts` (emits impactWindow/Redir/Jolt/Whip/ComDecel/Deform/Rot).
- The many one-off investigation harnesses that produced the findings above
  (`study_impact_window/body/jolt/dropgrid/perturb/rigor/velchange/deformation/
  candidates/failcase/rotcase/strain.ts`, `bench_jolt_access.ts`, `plot_impact_jolt.py`)
  were REMOVED once the metric shipped (the conclusions are captured in this doc).
  They are recoverable from git commit `55b1bee` if a future effort (e.g. redir-aware
  steering) needs the controlled-physics rig or the body-jolt probes.
- Retained tools (`scripts/v0/`, analysis-only): `study_impact_calibrate.ts`
  (recalibrate `REDIR_CAP` against the golden envelope; `--track=<labeled.track.json>`
  optionally adds the Shelter label percentile block) and `study_impact_labels.ts
  --track=<labeled.track.json>` (validate the metric against felt-intensity labels).
- **`scripts/v0/study_support.ts` — the SINGLE SOURCE** (now a production dependency of
  `make_overlay_data.ts`) for rider topology, caps, the canonical `IMPACT_WINDOW`,
  load/simulate, geometry, point access, landing/rest detection, stats, and the windowed
  metric helpers. `redirPx` DELEGATES to the production `core/substrate.ts
  redirImpactPxAtLanding`, and `point` reuses `normalImpactPxAtLanding` (the legacy
  baseline) — so studies and the scorer can never diverge.

## Open Questions

- Exact window length: `5f` is plausible (`0.125s`) and matches the current probe,
  but should be validated against clips.
- Decay shape: linear `1.0 -> 0.5` is simple. Exponential or sharper decay may be
  better if the metric feels too post-beat.
- Stop condition: likely stop at first airborne frame, no contacted owned line, or
  next contact beat.
- Whether a small redirection term belongs in the final metric, or stays as a
  separate diagnostic.
- Whether timing tolerance should accept a neighboring landing frame. This is
  separate from magnitude and should stay parked until the magnitude metric is
  settled.
- Whether `impactCeiling` needs recalibration after switching from point to
  windowed measurement.

## Next Steps

1. Run the updated probe at a meaningful budget over a representative subset:

   ```bash
   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_window.ts \
     probe_impact big_air_ramp rolling_drop pop_train float_bounds skyline_push \
     --budget=120000 --window=5 --detail=8
   ```

2. Generate or inspect a small set of flagged cases where `point` is soft but
   `decay` or `max` is hard. Human labels are the missing ground truth.
3. If the labels agree, implement the decayed-window metric in the shared
   measurement helper, but keep `bounce`/`kick`/`flyThrough` as diagnostics.
4. Rebaseline after the metric changes; this is a scoring-definition change.

## Where It Lives

- Current measurement: `scripts/v0/core/measure.ts` and
  `scripts/v0/core/substrate.ts`.
- Constants and semantics: `scripts/v0/types.ts`.
- Scoring: `scripts/v0/score.ts`.
- Exploratory probe: `scripts/v0/study_impact_window.ts`.
- Related probes: `scripts/v0/study_landing_intensity.ts`,
  `scripts/v0/study_impact_signals.ts`, `scripts/v0/calibrate_impact.ts`.
