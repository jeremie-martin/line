# The impact contract

The single self-contained statement of what per-beat `impact` means at every
layer, why each piece is designed the way it is, and the evidence behind it.
Last validated 2026-07-31 against `scripts/v0/types.ts` and
`scripts/v0/core/substrate.ts` (the cArc promotion — a deliberate ruler change,
evaluator fingerprint afbdb18787e6). The canonical reference is whatever
`benchmark/v2/baseline.json` currently says (498.91 at the time of writing) —
this document deliberately no longer pins a headline, because the ruler is
re-based and a stale number here reads as a current anchor.

**The code is the definition.** `IMPACT` in `types.ts` and
`impactFeasibilityBound` in `substrate.ts` are normative; if this file ever
disagrees with them, they win and this file is the bug.

## The promise (authoring semantics)

`Contact.impact ∈ [0, 1]` is the **desired felt hardness of that landing**, on
one absolute scale shared by every beat of every spec:

| authored | means | impulse cArc (px/frame) |
|---|---|---|
| 0.0 | perfectly smooth (tangential kiss, zero path bending) | 0 |
| ~0.43 | medium (felt-level-2 median) | ≈ 3.2 |
| ~0.68 | strong (felt-level-3 median) | ≈ 5.2 |
| 1.0 | very strong | ≥ 7.55 (harder saturates at 1) |

(Felt/compatibility-anchored, PROMOTED 2026-07-31. The scale top is deliberately
BELOW the physical ceiling (~11.3 at envelope speed): 1.0 means "very strong",
exactly what existing specs mean, not "physics maximum" — headroom saturates. An
incidental floor of ≈ 0.25–0.3 exists in practice: the compiler cannot land
*softer* than the redirection its geometry gives away for free.)

The author needs no physics knowledge. The word *possible* is load-bearing:
1.0 asks for the hardest *physical* version of the hit at that beat (see
Feasibility). Below the per-beat bound, the scale is absolute everywhere;
above it, asks saturate at the bound (authoring 0.8 and 1.0 on a tight groove
beat request the same thing — deliberate: the alternative, scaling targets
relative to feasibility, would make 1.0 mean a different hardness on every
beat, which we rejected).

Authoring helpers: `beats([{t, impact?}])`, `withImpact(contacts, rule)`
(`scripts/v0/core/beats.ts`).

## Definition (what impact IS) — PROMOTED 2026-07-31: the redirection impulse `cArc`

Impact = **redirection impulse**: `cArc = Σ v̄·|Δθ|` — per in-window frame, the
wrapped CoM heading change times the midpoint speed, ACCUMULATED over CONTACTED
frames of the `IMPACT_WINDOW = 6` frame (~0.15 s) episode after touchdown.
Airborne frames contribute zero (flight is not impact — gravity's ballistic
bending never enters); contacted frames use RAW velocities (during support the
ground cancels gravity, so the raw path bend is the real redirection). Mapped to
a **felt [0,1]** by `normImpact` — `0` = zero impulse (`REDIRARC.SOFT = 0`, the
physical floor), `1` = very strong (`REDIRARC.VERY_STRONG`, currently **7.55**);
harder saturates at 1. Both env-overridable (`LR_IMPACT_SOFT`,
`LR_IMPACT_VSTRONG`) — read them from `types.ts` rather than trusting prose.

Why this definition — `cArc` replaced the net-form `redirArc = v·Δθ` (which had
itself replaced `redir = v·sinΔθ`; full history
`docs/archive/impact_problem_statement.md` + `docs/impact_definition.md`):

- **Accumulated, contacted-only** ⇒ bend-then-unbend contacts cannot cancel to
  0 (the user felt one such beat as "definitely more than 0.00"); bounce
  reflections add; ride-out velocity reversals cannot fake Δθ≈π (midpoint
  speed ≈ 0 at the flip); windowed gravity bending is structurally excluded.
- **Label-adjudicated** ⇒ pooled felt Spearman 0.810 vs 0.788 (better or equal
  on every discriminating set), and the divergence shortlist — the only beats
  where the two metrics disagree — went 3-1-5 for cArc, including two explicit
  "CARC better than CURRENT" user judgments.

- **CoM-velocity-only** ⇒ immune to sled rotation and limb whip, which look
  violent but are not felt.
- **Speed-weighted, no sin-compression** ⇒ inherits everything that made the
  net form win over `redir`/`turn`/force-family (all retired ×2–3, do not
  revisit).
- **Windowed W=6, a PERCEPTUAL constant (~150 ms)** ⇒ felt match peaks at
  W=6–7 and degrades at ≤5 and ≥8 (validated on 67 leveled beats); W is pinned
  by perception, not tunable for robustness.
- **Felt/compatibility scale** ⇒ 0 = perfectly smooth, 1 = very strong;
  VSTRONG=7.55 is the combined-corpus compatibility optimum (flat valley
  7.3–7.9), so every existing authored ask keeps its meaning — no migration.

Production source: `contactRedirArcPxAtLanding` (`scripts/v0/core/substrate.ts`)
+ `normImpact` (`types.ts`) — the single definition shared by the scorer, the
trajectory-layer report (`scored_contact_impact.ts`), the dashboard, and the
study harnesses. (`redirArcPxAtLanding` = the pre-promotion net form, kept as
the dashboard's LEGACY comparison lane; `redirImpactPxAtLanding` = the older
`redir`.)

## Measurement & calibration

- Measured per landing (`measureImpact`, `core/measure.ts`), gated on the beat
  having an authored impact (impact-free specs pay zero cost).
- An authored contact is matched to its beat within ±1 frame
  (`findAuthoredContactNearFrame`). Detector-limited intervals may use a
  persistent bounce because a distinct landing is not representable there.
- The scale `REDIRARC.SOFT` / `VERY_STRONG` reads **0 / 7.55** and was
  calibrated from scratch by three independent studies (2026-07-31,
  `docs/impact_definition.md` Calibration): the catchability atlas (physics
  endpoints: reliable in-window turn ≈ 1.0 rad at any speed; in-envelope top
  ≈ 11.2–12.6), the perceptual-curve study (isotonic vs linear on 90 leveled
  beats: linear stands), and the scale audit (compatibility optimum V* = 7.55,
  flat valley 7.3–7.9; ask-weighted meaning shift ≈ 0.04 ⇒ no spec migration).
  Revalidated on the canonical V2 inventory (44 sources × 3 seeds @750k,
  12,168 landings): ceiling 0 violations, valley flat, envelope <2% seed
  drift, 6.6% visible divergence vs the legacy metric.
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
- catchability: total turn ≤ `IMPACT.MAX_RELIABLE_TURN_RAD = 1.0` — no longer
  the inherited `asin(0.9)` ≈ 1.12 guess but the atlas-MEASURED reliable bound
  (±6% across the speed envelope; 0 of ~13k real landings exceed it; the
  fraction form `CATCHABLE_REDIR_FRACTION = sin(1.0)` is kept so sealed
  fixture conventions keep their shape while clamping at exactly 1.0 rad);
- `bound = normImpact(v · min(θ_in + θ_out, 1.0))` (`substrate.ts
  impactFeasibilityBound`).

Dense-beat limit: `bound ≈ normImpact(g·(N_prev+N_next)/2)` — the vertical-velocity
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
- Tests: `tests/v0_impact.test.ts` (22) pin definition (accumulated,
  contacted-only, airborne-zero), window, ceiling, geometry-independence, and
  the candidate family; full suite green post-promotion except 18 pre-existing
  benchmark-v2 governance failures unrelated to impact (verified identical on
  the pre-promotion tree). Hot path: 362 ns/call (vs 221 legacy), gated to
  authored landings.
