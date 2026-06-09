# Impact generation + landing-redefinition notes (2026-06-09)

Status: analysis/strategy notes. No code changed by this document. Companion to
`docs/impact_problem_statement.md` (the rejected windowed-normal proposal) and the
`landing-impact-lever` memory (the measurement history). Written after the `redir`
metric shipped into the compiler (commit `d3e4973`) and after ~30 steering probes
in `COMPILER_OPTIMIZATION_LOG_NEW_IMPACT.md` mostly washed.

## TL;DR

The measurement is now right (`redir` = peak ⊥ CoM-velocity redirection over a
6-frame window, label-validated ρ≈0.85). The remaining problem — the compiler
can't hit authored impact — is a **generation** problem that has been attacked as
a **selection/tuning** problem. The one accepted win (local impact cost, +9) is
selection; everything geometric (contact-angle ±4°, normal bias ±0.8px, pool
widening) squeezed to noise. The empirical data says why, and points at the lever.

## What actually produces achieved impact (empirical)

Source: `study_redir_fundamentals.ts` over `impact-redir-baseline-slice-details-01`
@300k, **7501 landing episodes**. Spearman ρ of features vs achieved redir, and
top-10%-achieved vs bottom-10%-achieved means:

| feature | ρ vs achieved | low-10% mean | high-10% mean |
|---|---|---|---|
| `turnNetDeg` (CoM heading change at catch) | **0.98** | 1.6° | 27.6° |
| `tangentChangeDeg` (surface curving thru window) | (via turn) | 3.2° | 17.5° |
| `tangentDeltaDeg` (incoming-vel → surface angle) | 0.74 | 2.0° | 13.0° |
| `incomingSpeed` | ~0.4 | 9.4 | 12.2 |
| `contactFrames` (catchability) | ~0 | 6.3 | 6.8 |

Reading:

1. **Achieved impact ≈ how much the catch turns the CoM velocity vector.**
   `turnNetDeg` ρ=0.98 (near-definitional: redir = speed·sin(turn)). To make
   impact you must *redirect the path at the catch*; a tangent-aligned glide
   produces ~zero regardless of speed.

2. **The two controllable geometric levers are `tangentDeltaDeg` and
   `tangentChangeDeg`** — the incoming-velocity-to-surface angle, and how much the
   surface *keeps curving through the 6-frame window*. High-impact catches have the
   surface ~13° off the incoming velocity AND curving ~17–25° more across the
   window. Low-impact catches are flat planes aligned with the incoming velocity.

3. **Catchability is NOT the limiter in this regime.** `contactFrames` is ~6.3 vs
   6.8 low-vs-high — turning the velocity up to ~36° does *not* break the catch.
   The earlier contact-angle steer that regressed −121 was at extreme settings;
   moderate redirecting catches stay catchable.

4. **Speed is a multiplier, not the driver.** redir = speed·sin(turn). High-impact
   lives at 12–16 px/f, but a fast tangent glide still reads ~0.

### The failure modes split cleanly (worst under-target examples)

- **Infeasible authored targets** (low speed + high target): `rhythm_ladder` 8 px/f,
  target 0.95, turn 1.2° → achieved 0.05. At 8 px/f the redir ceiling is ~0.85·8/8.5,
  so 0.95 is physically unreachable. **Some of the 472→ score loss is authored-target
  infeasibility, not compiler weakness.** Worth a pass: golden-spec impact targets vs
  `impactCeiling(speed)` at the achievable speed of that beat.
- **Addressable misses** (adequate speed + tangent glide): `opening_burst` 12 px/f,
  target 0.91, turn 0.5° → achieved 0.03. Speed is there; the compiler chose a flat
  glide instead of a redirecting catch. **These are the real wins.**

## Why the steering probes washed (the mechanism mismatch)

`redir` integrates the velocity turn over 6 frames. It responds to
**`tangentChangeDeg` — sustained surface curvature the rider hugs for ~6 frames** —
not to the instantaneous contact-point angle. Every washed probe perturbed an
*instant* (contact angle ±4°, contact-point normal ±0.8px, entry bevel): a few
degrees at one point barely moves a 6-frame path integral. The local-cost win
worked only because it re-ranks *already-generated* candidates toward higher turn —
it can't manufacture turn that wasn't sampled.

## The structural root: impact is a scored objective with no sampler

Every other scored axis (air/speed/elevation/amplitude) has an authored **curve**
that drives candidate *sampling*. Impact is a per-beat qualifier folded into the gap
target bag *after* `sampleGapTargets` (zero RNG, by design). So candidate geometry is
sampled to satisfy air/speed/elevation/amplitude, and impact is only *scored*
post-hoc on whatever those draws happened to produce. The generator never proposes a
shape *because* it would redirect. That asymmetry is the load-bearing reason impact is
hard to hit. Two ways out:

- **(a) Give impact a generative representation** — a dedicated "redirecting catch"
  arc family: a concave catch whose entry tangent is offset ~10–14° from the predicted
  incoming velocity and which sustains curvature (`postCurveBias`/through-window turn)
  to bend the path 25–40° while staying in contact ~6 frames, with the post-contact
  continuation re-planned to recover. This targets `tangentChangeDeg` directly — the
  lever the data says matters — instead of nudging an instant.
- **(b) Let impact enter sampling** — sample candidate geometry against the impact
  target the same way curve axes do, so the pool *contains* redirecting shapes for the
  forward-eval ranker and local cost to pick from.

The earlier-accepted `redir` contact-angle steer is the seed of (a) but operates on
the wrong quantity (instant angle, not sustained curvature). The unreferenced
`predictedImpactAtContactAngle` / `contactCentered*Impact*` helpers in
`arc_placement.ts` are the parked seed to build the family from.

### Direct confirmation (paired delta: steered `contact4` − baseline, 7501 episodes)

The accepted steer moved the wrong quantity and produced **no achieved impact**:

| delta | mean | in high-target band [.75,1] |
|---|---|---|
| `achieved` (the goal) | **+0.001** | +0.001 |
| `tangentDeltaDeg` (instant angle — what the steer touches) | +0.29 | **+0.80** |
| `tangentChangeDeg` (sustained curvature — what redir needs) | **−0.19** | **−0.49** |

So on exactly the hard beats we tried to fix, the steer tilted the contact instant up
(+0.8°) while *reducing* through-window curvature (−0.49°), and achieved impact stayed
flat. Its small canonical score win was basin re-selection, not harder landings. This
is the empirical proof that the lever is **sustained curvature, not instant angle.**

## Correctness flag before any hard-impact push: ejection saturation

The metric INVERTS at the violent extreme: a head-on catch with normal closing ≳8 px/f
EJECTS the rider → reclassified as bounce/flyThrough → `findLandingNearFrame` returns
undefined → impact reads *undefined/off-scale* instead of pegging to MAX. Today the
compiler self-limits to the gentle regime so this is rare. But the moment steering
deliberately pushes into hard catches (the whole point of v2), the optimizer gets a
**perverse gradient**: the hardest catches score lowest. Before scored hard-steering,
add an `impactStatus`/ejection flag with **continuous saturation to MAX** (not a regex
clamp — that's a scoring cliff). This is a prerequisite, not a nicety.

---

# Redefining "the landing" (idea capture — user's big-project direction)

The user's intuition: the precise contact frame isn't the most representative moment
of the felt impact, and rejecting arcs that don't land on an exact frame throws away
too much usable material. Distinguish three separate "landing" notions currently
fused:

- **Detection**: discrete event, airborne > `K_BOUNCE_LANDING`(=5) frames → landing.
- **Beat matching (the rigidity)**: a detected landing is matched to a `Contact` beat
  within ±1 frame = *hit*, ±5 = *drift*, else missing / off-beat hard-violation (C3).
- **Impact measurement**: ALREADY a window — peak `redir` over 6 frames after the
  landing frame.

Key realization: **the impact measurement is already windowed; the rigidity that
rejects arcs is the beat-TIME matching (±1 frame), not the impact measure.** So the
"redefine the landing" project is mostly about the beat-matching / acceptance layer.

### Ideas (ordered low→high risk)

A. **Most-impactful-frame alignment (low risk, partly done).** redir already takes the
   peak over the window. Go further: define the impact moment as `argmax redir` within
   the window and consider aligning the *felt beat* to that peak, not to first-contact.
   `study_redir_fundamentals` already emits `peakOffset` — if peaks land systematically
   +N frames after contact, the felt beat is +N late vs the detector. Cheap to measure;
   informs whether B/C are even needed.

B. **Soft-attractor beat window (medium risk — the minimal version of the big idea).**
   Keep exact-beat *preferred*, but let the search treat *any* in-window catch as a
   valid leaf carrying a closeness penalty (sharp falloff, non-zero tail). Turns today's
   hard rejects into ranked candidates → expands the acceptable-arc space *without*
   abandoning rhythmic alignment. The geometry that can't land exactly on the beat but
   redirects beautifully becomes usable. This is the highest-leverage / lowest-regret
   version of the redefinition.

C. **Scored acceptance band (high risk — "the huge project").** Replace binary
   hit/drift/miss with a continuous time-tolerance score: accept any landing within a
   window and score by closeness (triangular/Gaussian). Dramatically expands valid arcs.
   RISK: beat timing is the rhythmic *core* — loosen too far and tracks desync from the
   music. Touches contract/validity (C3 off-beat), scorer, and search completion. This
   is the everything-changes refactor; do it deliberately, gated behind data from A/B,
   not as a bolt-on.

D. **Catchability-as-acceptance (orthogonal reframe).** Define a "landing" for
   acceptance as "sustained contact established somewhere in the window"
   (`contactFrames ≥ τ`) rather than "first-contact at frame X" — decouples the rhythm
   constraint from the physical-catch constraint. Mostly subsumed by B/C.

### Empirical verdict on the ladder (2026-06-09, post-curve-modulation)

Measured before building anything, via two read-only probes:

- **Landing-window prize** (`study_landing_window.ts` + the flag-gated probe in
  `core/candidate.ts`): for every survival-passing candidate geometry, the minimal
  lockstep half-width W∈[1,5] that would admit it (landing on owned line within ±W
  AND zero off-beat at tolerance W; W=1 ≡ today's gates). 219,179 geometries, all
  40 golden specs × seeds 0-2 @ 100k.
- **Felt-moment localization** (`study_redir_fundamentals.ts` peakOffset/
  ratePeakOffset): 7,501 landing episodes from the detailed baseline archive.

**Findings:**

1. **Window-widening (B/C) prize is small and impact-POOR.** ±1→±5 grows the pool
   only +13.6%, and the admitted material has HALF the achieved impact (mean 0.229
   at W=1 vs ~0.12 in every W≥2 tier; on high-target beats 0.283 vs ~0.13). The
   near-window rejects are slow late glides (speed 9.4-9.7 vs 10.4; offsets skew
   +2..+5, 93%). Per-gap: ~16% of impact-targeted gaps would gain a slightly better
   impact option (mean closeness gain 0.06); only ~5% of high-target gaps.
2. **Zero rescues.** No beat in the whole suite has an empty ±1 pool that a wider
   window would fill — the search never fails a beat for timing reasons. The
   "rejected arcs are usable material" intuition is falsified *for the current
   sampler's proposal distribution*: the binding constraint is what the sampler
   proposes, not what the window accepts. (Caveat: a window-aware sampler that
   deliberately aims off-beat could in principle exploit width better — but the
   physics says late-landing arcs arrive slower, so the ceiling is lower there.)
3. **The cumulative redirection peak saturates at the window edge** (+6 in 74% of
   all episodes, 92% of high-achieved ones) — there is no interior "most-impactful
   frame" to align to; the catch is an extended ~150ms+ episode whose redirection
   is still growing when the measurement window ends. Two consequences:
   - Ladder A in its original form ("align beat to argmax redir") is ill-posed.
   - The scored metric likely UNDERCOUNTS sustained turns (window truncation). A
     longer `IMPACT_WINDOW` is a v3 metric question (fingerprint bump + REDIR_CAP
     recalibration) — flagged, not urgent.
4. **The felt jolt (peak per-frame redirection RATE) trails first contact by a
   systematic ~3 frames / 75ms** (p50 +3, mean 3.5, only 7% at +1; stable across
   target bands). If beats should coincide with the felt slam, the compiler
   currently places the slam ~75ms late. The cheap experiment is a constant −3
   frame alignment offset (land at beat−3 so the jolt hits the beat) — an
   authoring/feel call that golden scores cannot adjudicate (the score measures
   first-contact alignment by definition); it needs human eyes/ears on real tracks.

**Verdict: B and C are demoted** (small, impact-poor prize; real contract risk).
**A is reframed** from "peak alignment" to "constant felt-lag offset" and parked as
a feel experiment. The landing-redefinition budget is better spent on the
generation lever (redirecting-catch sampling targeting `tangentChangeDeg`) and the
ejection-saturation prerequisite.

### Recommended sequencing

1. **(free, today)** Run the empirical study on the steered (`contact4`) archive too,
   and read `peakOffset` — confirm whether our accepted steer actually moved
   `tangentChangeDeg`/`turnNetDeg` (the levers) or just re-selected, and whether peaks
   trail contact.
2. **(generation, the real lever)** Prototype the redirecting-catch family (a) /
   impact-in-sampling (b), aimed at `tangentChangeDeg`, NOT another instant-angle knob.
   Validate on the addressable failures (adequate-speed tangent glides), leave the
   infeasible low-speed/high-target beats alone.
3. **(hygiene, prerequisite to hard steering)** ejection saturation flag.
4. **(separate big project)** landing redefinition — start with A→B, gate C on data.
5. **(authoring sanity)** audit golden impact targets vs `impactCeiling(speed)`; some
   are physically unreachable and just inject unrecoverable error into the headline.
