# The impact contract

The single self-contained statement of what per-beat `impact` means at every
layer, why each piece is designed the way it is, and the evidence behind it.
Last validated 2026-07-25 against `scripts/v0/types.ts` and
`scripts/v0/core/substrate.ts`. The canonical reference is whatever
`benchmark/v2/baseline.json` currently says (498.91 at the time of writing) —
this document deliberately no longer pins a headline, because the ruler is
re-based and a stale number here reads as a current anchor.

**The code is the definition.** `IMPACT` in `types.ts` and
`impactFeasibilityBound` in `substrate.ts` are normative; if this file ever
disagrees with them, they win and this file is the bug.

## The promise (authoring semantics)

`Contact.impact ∈ [0, 1]` is the **desired felt hardness of that landing**, on
one absolute scale shared by every beat of every spec:

| authored | means | redirArc (px/frame) |
|---|---|---|
| 0.0 | soft (gentlest real landing) | ≈ 2.0 |
| ~0.45 | medium / a decent hit | ≈ 4.0 |
| ~0.7 | a strong slam | ≈ 5.2 |
| 1.0 | very strong | ≈ 6.5 (harder clamps to 1) |

(Felt-anchored, LOCKED 2026-06-14. The soft→medium low end is intentionally coarse —
`redirArc` can't separate soft from medium, both ~2–3 px/frame — so meaningful authoring
resolution lives from ~medium-strong up. End anchors are provisional, thin label data.)

The author needs no physics knowledge. The word *possible* is load-bearing:
1.0 asks for the hardest *physical* version of the hit at that beat (see
Feasibility). Below the per-beat bound, the scale is absolute everywhere;
above it, asks saturate at the bound (authoring 0.8 and 1.0 on a tight groove
beat request the same thing — deliberate: the alternative, scaling targets
relative to feasibility, would make 1.0 mean a different hardness on every
beat, which we rejected).

Authoring helpers: `beats([{t, impact?}])`, `withImpact(contacts, rule)`
(`scripts/v0/core/beats.ts`).

## Definition (what impact IS) — UPDATED 2026-06-14: `redirArc`

Impact = **velocity-redirection ARC**: `redirArc = v·Δθ`, the incoming CoM speed
(`v`, px/frame) times the net heading change (`Δθ`, radians) of the CoM velocity
over the `IMPACT_WINDOW = 6` frame (~0.15 s) episode after the landing, mapped to
a **felt [0,1]** by `normImpact` — `0 = soft` (`redirArc ≈ REDIRARC.SOFT`,
currently **0**), `1 = very strong` (`redirArc ≈ REDIRARC.VERY_STRONG`,
currently **7.29**); gentler clamps to 0, harder to 1. Both are env-overridable
(`LR_IMPACT_SOFT`, `LR_IMPACT_VSTRONG`) and were re-anchored when the metric
went linear — read them from `types.ts:1095,1101` rather than trusting a number
copied into prose.

Why this definition — `redirArc` replaced the perpendicular `redir = v·sinΔθ`
(label-driven, 4 tracks + an independent agent + a flat-slam generalization track;
full history in `docs/archive/impact_problem_statement.md`):

- **CoM-velocity-only** ⇒ immune to sled rotation and limb whip, which look
  violent but are not felt.
- **Redirection arc, not perpendicular** ⇒ `v·Δθ` keeps `redir`'s speed weighting
  but removes its `sin` *compression* of the biggest slams (`sin` can't tell a 60°
  bend from a 120° one). It beat `redir`/`turn` on the felt labels (mean Spearman
  0.81 vs 0.79/0.77) and — decisively — generalized to flat-drop slams where
  `turn` (speed-blind) fell. Force/onset/concentration metrics overfit one track
  and were rejected.
- **Windowed (~6 frames), not instantaneous** ⇒ the engine's soft collision
  smears the hit over frames; felt labels match best at W≈6.
- **Felt-anchored scale** ⇒ 0 = soft, 1 = very strong, matching how specs author
  (full [0.1,1.0] range, median 0.5) and how the user labels.

Production source: `redirArcPxAtLanding` (`scripts/v0/core/substrate.ts`) +
`normImpact` (`types.ts`) — the single definition shared by the scorer, the report,
the dashboard, and the study harnesses. (`redirImpactPxAtLanding` = the old `redir`,
kept only for the dashboard's comparison lane.)

## Measurement & calibration

- Measured per landing (`measureImpact`, `core/measure.ts`), gated on the beat
  having an authored impact (impact-free specs pay zero cost).
- An authored contact is matched to its beat within ±1 frame
  (`findAuthoredContactNearFrame`). Detector-limited intervals may use a
  persistent bounce because a distinct landing is not representable there.
- The scale `REDIRARC.SOFT` / `VERY_STRONG` (px/frame) is felt-anchored to the
  user's labels. It was re-fit when the metric became linear and now reads
  **0 / 7.29** (`types.ts:1095,1101`); the 2.0 / 6.5 pair below belongs to the
  superseded saturating metric and is retained only to explain the corpus
  percentiles that were measured under it. The achievable-envelope distribution (calibrate_corpus.ts: 11,607
  landings / ~400 perturbed variants; redirArc p50 1.44, p95 4.47, p99 6.63) confirms
  very-strong ≈ the top-1% landing, and gives a stable scale (p99 6.63, within 5% across
  very different corpora).
- Validated against the user's felt labels across 4 tracks (impact_lab_v2, climb_terrace,
  rolling_drop, the flat-slam staircase; `study_impact_labels.ts` / the `/impact/`
  dashboard). End anchors (soft/very-strong) are thin-data provisional.
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
- `bound = normImpact(v · min(θ_in + θ_out, asin(0.9)))` — see
  `substrate.ts:474-477`.

  **NOT** `v·sin(...) / 8.5`, which is what this line said until 2026-07-25.
  That is the retired saturating metric with the legacy `CALIB.REDIR_CAP`
  divisor, itself annotated `[LEGACY — NOT SCORED as of 2026-06-14]` at
  `types.ts:1149-1152`. Under the linear form there is no `sin` and no divisor:
  the turn is capped by catchability, then multiplied by speed and normalized.

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
