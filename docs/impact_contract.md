# The impact contract

The single self-contained statement of what per-beat `impact` means at every
layer, why each piece is designed the way it is, and the evidence behind it.
Last validated 2026-06-09 (fingerprint `eede9661bba6`, canonical reference
570.25, archive `impact-ballistic-bound-canon-01`).

## The promise (authoring semantics)

`Contact.impact ∈ [0, 1]` is the **desired felt hardness of that landing**, on
one absolute scale shared by every beat of every spec:

| authored | means | felt-label anchor (validated) |
|---|---|---|
| 0.0–0.2 | light touch, tangent glide | "soft" ≈ 0.20 |
| ~0.5 | a decent, noticeable hit | "a bit less strong" ≈ 0.36 |
| ~0.7–0.85 | a strong slam | "pretty strong" 0.70 · "very strong" 0.84 |
| 1.0 | the hardest landing **possible** | hardest catchable ≈ 1.0 |

The author needs no physics knowledge. The word *possible* is load-bearing:
1.0 asks for the hardest *physical* version of the hit at that beat (see
Feasibility). Below the per-beat bound, the scale is absolute everywhere;
above it, asks saturate at the bound (authoring 0.8 and 1.0 on a tight groove
beat request the same thing — deliberate: the alternative, scaling targets
relative to feasibility, would make 1.0 mean a different hardness on every
beat, which we rejected).

Authoring helpers: `beats([{t, impact?}])`, `withImpact(contacts, rule)`
(`scripts/v0/core/beats.ts`).

## Definition (what impact IS)

Impact = **velocity redirection**: the peak magnitude of the perpendicular
component of the rider's centre-of-mass velocity change over the
`IMPACT_WINDOW = 6` frame (~0.15 s) episode after the landing, normalized by
`CALIB.REDIR_CAP = 8.5` px/frame.

Why this definition (each alternative was built, measured, and rejected —
history in the `landing-impact-lever` memory and
`COMPILER_OPTIMIZATION_LOG_NEW_IMPACT.md`):

- **CoM-velocity-only** ⇒ immune to sled rotation and limb whip, which look
  violent but are not felt (the user-labeled soft beat at shelter t=48.33
  ranks #1 under jolt/deformation metrics and 61/96 under redirection).
- **Perpendicular component only** ⇒ a slowdown along the path is not an
  impact (labeled beat t=49.55); a head-on slam IS a redirection
  (vertical→horizontal), so it is captured.
- **Windowed (~6 frames), not instantaneous** ⇒ the engine's soft collision
  smears the hit over frames; felt labels match best at W≈6 (Spearman 0.83–0.91
  vs ordinal felt labels; the 1-frame metric scores 0.31).
- **Speed-weighted** (redir = v·sin(turn)) ⇒ the same path bend at speed hits
  harder.

Production source: `redirImpactPxAtLanding` (`scripts/v0/core/substrate.ts`) —
the single definition shared by the scorer, the report, the dashboard, and the
study harnesses.

## Measurement & calibration

- Measured per landing (`measureImpact`, `core/measure.ts`), gated on the beat
  having an authored impact (impact-free specs pay zero cost).
- A landing is matched to its beat within ±1 frame (`findLandingNearFrame`).
- `REDIR_CAP = 8.5` comes from the achievable-envelope sweep (351 landings,
  16 varied tracks: p95 5.26, p99 6.50, max catchable ≈ 8.2–8.7 px/f — beyond
  that the rider ejects). So measured 1.0 ≈ the hardest catchable slam.
- Validated against the user's ordinal felt labels (8 labeled beats,
  `study_impact_labels.ts`); the table above is that mapping.
- Known open edge: a beyond-catchable hit ejects the rider and reads as a
  failed contact rather than impact 1.0 (ejection saturation — flagged, only
  relevant if steering ever pushes past the catchable bound).

## Feasibility (what physics permits at a beat)

`impactFeasibilityBound(speedTarget, prevGapSeconds, nextGapSeconds)`
(`core/substrate.ts`, inside the fingerprinted ruler slice). Pure ballistics,
no fitted constants:

- arrival crossing angle: falling at most the previous beat gap gives
  `vy_in ≤ g·N_prev/2` ⇒ `θ_in ≤ atan(g·N_prev/2 ÷ v)`;
- exit allowance: the redirected motion must fit before the next beat ⇒
  `θ_out ≤ atan(g·N_next/2 ÷ v)`;
- catchability: total turn ≤ `asin(CATCHABLE_REDIR_FRACTION = 0.9)`;
- `bound = v·sin(min(θ_in + θ_out, cap)) / 8.5`.

Dense-beat limit: `bound ≈ g·(N_prev+N_next)/2 ÷ 8.5` — the vertical-velocity
budget around the beat. This is why tight grooves cap near 0.45–0.5 regardless
of speed, and why big slams live on open beats.

Evidence: the compiler's demonstrated p95 frontier tracks the bound within a
few percent across density × speed strata (dense/fast 0.474 bound vs 0.480
p95; mixed 0.67 vs 0.66; sparse 0.85 vs 0.72 — headroom where the search has
room). Earlier, an empirical envelope using co-authored air/amplitude was
shipped and then replaced: controlled analysis showed those inputs were
selection proxies; the previous-gap ballistics carry the real signal.

## Scoring (the ruler)

`scored target = min(authored, bound)`, applied in `buildDriftReport`
(fingerprinted authority) and mirrored at the compiler's target resolution so
search and scorer chase one coherent target. The bound only ever lowers a
target. Impact then enters `axis_quality` like every other axis
(`exp(−rms/0.25)`), full weight.

Why the ruler (and not spec edits or generation-side clamps): one derived
function in one hashed place; specs keep expressing pure musical intent; no
future spec can silently reintroduce impossible asks; the fingerprint pins it.

History that motivated this: with raw asks, ~34% of impact targets were
physically impossible *given their beat context*; the optimizer correctly
refused the bad trades (every steering probe chasing them washed), and the
impossible residual poisoned the headline AND dragged other axes (~100 pts of
deliberate trade). With bounded asks the full↔excl-impact gap narrowed from
107 to 69 points and other-axis quality rose (592 → 639 excl-impact).

## Generation (how the compiler hits it)

- **Curve modulation** (`arc_placement.ts`): on pressured impact beats,
  flatten the contact angle into a scoop and front-load the contact→launch
  rotation into the redir window. The one repeatedly-validated lever
  (canonical +24.3 at introduction; +20.3 again when its ramp was re-aimed at
  the bounded ask band).
  Empirical basis: achieved impact ≈ net CoM turn (ρ 0.98), driven by
  *sustained* surface rotation through the window, not the contact instant.
- **Selection**: impact participates in local candidate cost
  (weight 0.5 + 0.25 mature; higher re-tested neutral) and fully in the true
  scorer that forward-eval ranks by.
- **Template lanes**: purpose-built slam-hop scoop candidates remain in the
  production geometry mix under their built-in budget/pressure gates. They are
  selection-protected pool injections, not forced replacements.

## Alignment invariant (every layer asks for the same thing)

authoring (absolute intent) → feasibility (derived bound) → scoring
(min, hashed) → search targets (same min, mirrored) → generation pressure
(reads the same resolved target). A change to any layer must keep the others'
reading intact; the evaluator fingerprint guards the ruler pieces, and
`verify:optimizer` pins the compiler's end-to-end behavior.

## Diagnostics & tests

- `LR_IMPACT_OFF=1` — impact vanishes end-to-end (the ~689 non-impact
  ceiling); golden prints `excl. impact` headline alongside the full one.
- `study_impact_anatomy.py` — error anatomy + counterfactual rulers from any
  archive. `study_landing_window.ts` — candidate-pool/selection tracing.
  `study_score_without_impact.ts` — with/without recompute.
- Tests: `tests/v0_impact.test.ts` (16) pin definition, window, ceiling,
  geometry-independence; suite 247/248 (1 pre-existing unrelated failure).
