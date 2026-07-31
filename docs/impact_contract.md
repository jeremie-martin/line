# The impact contract

The single self-contained statement of what per-beat `impact` means at every
layer, why each piece is designed the way it is, and the evidence behind it.
Last validated 2026-07-31 against `scripts/v0/types.ts` and
`scripts/v0/core/substrate.ts` (the cArc promotion — a deliberate ruler change).
The committed evaluator fingerprint and benchmark baseline are the operational
references; this document deliberately does not copy their values.

**The code is the definition.** `contactRedirArcPxAtLanding` in `substrate.ts`,
plus `IMPACT_RULER`, `normImpact`, and `IMPACT` in `types.ts`, are normative; if
this file ever disagrees with them, this file is the bug.

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

The author needs no physics knowledge. The scale is absolute everywhere:
1.0 means "very strong", not "the hardest thing this particular beat can do".
The authored/scored target is never clamped to a feasibility model. If a beat
cannot deliver the ask, the residual remains visible and the report's
`feasibility_bound` / `ceiling` diagnostics explain the likely physical limit.

Authoring helpers: `beats([{t, impact?}])`, `withImpact(contacts, rule)`
(`scripts/v0/core/beats.ts`).

The 2026-07-31 raw-metric promotion does not transform current-convention
authored targets. Existing normalized asks retain their values and felt
meaning. `withImpactLegacy` is a separate explicit opt-in for source numbers
from an older authoring convention; it resolves those numbers once while the
spec module constructs its contacts. No scorer, optimizer, report, or preview
path remaps a resolved `Contact.impact`.

## Definition (what impact IS) — PROMOTED 2026-07-31: the redirection impulse `cArc`

Impact = **redirection impulse**: `cArc = Σ v̄·|Δθ|` — per in-window frame, the
wrapped CoM heading change times the midpoint speed, ACCUMULATED over CONTACTED
frames of the `IMPACT_WINDOW = 6` frame (~0.15 s) episode after touchdown.
Airborne frames contribute zero (flight is not impact — gravity's ballistic
bending never enters); contacted frames use RAW velocities (during support the
ground cancels gravity, so the raw path bend is the real redirection). Mapped to
a **felt [0,1]** by `normImpact` — `0` = zero impulse (`IMPACT_RULER.SOFT = 0`, the
physical floor), `1` = very strong (`IMPACT_RULER.VERY_STRONG`, currently **7.55**);
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
trajectory-layer report (`scored_contact_impact.ts`), and production preview.
Retired formulas exist only as explicitly `legacy...` analysis functions in
`impact_support.ts`; they are not exported from the scorer substrate and are
never a production fallback.

## Measurement & calibration

- Measured per landing (`measureImpact`, `core/measure.ts`), gated on the beat
  having an authored impact (impact-free specs pay zero cost).
- An authored contact is matched to its beat within ±1 frame
  (`findAuthoredContactNearFrame`). Detector-limited intervals may use a
  persistent bounce because a distinct landing is not representable there.
- The scale `IMPACT_RULER.SOFT` / `VERY_STRONG` reads **0 / 7.55** and was
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

**The `speedTarget` argument is nearly vestigial, and this surprises people.**
Since `v·atan(k/v) → k`, the speed cancels out of `v·(θ_in+θ_out)`: sweeping the
authored speed across its whole range moves the bound by 0.003 at 0.3 s beat
spacing and 0.012 at 0.5 s. Speed only matters once the gaps are long enough
for the 1.0-rad clamp to be the binding term. So the bound is really a statement
about BEAT SPACING — how much vertical velocity gravity can build in the gaps
around this beat — wearing a speed costume. It is also a-priori by construction:
it reads the AUTHORED speed target and the authored gap timings, because its
question is "was this ask self-consistent to author?", not "what happened?".

**Two different max-impact numbers ride in the report, and they answer different
questions.** Do not conflate them:

| field | input | question |
|---|---|---|
| `feasibility_bound` | authored speed + gap timings | was this ask self-consistent to AUTHOR? |
| `ceiling` | ACTUAL CoM speed at the contact frame | given how fast the rider really arrived, what was the hardest catchable hit? |

They routinely disagree — at 0.5 s spacing with authored speed 0.5, the bound
reads 0.458 while a rider that actually arrives at 9 px/f has a ceiling of 1.00.
Neither is wrong. If the rider shows up faster or steeper than authored, the
`ceiling` says the hit was available; the `bound` says the SPEC did not plan for
it. The turn budget still has to come from somewhere: a bigger turn needs more
vertical velocity in and out, and that is bought with fall time in the
surrounding gaps — which is exactly what the bound measures, using the gaps as
they actually are.

Evidence caveat: the "p95 frontier tracks the bound within a few percent"
result below was measured under the PRE-2026-07-31 ruler (net-form metric,
VSTRONG 7.29, `asin(0.9)` clamp) AND under the retired clamped-target
convention. The reasoning still holds; the numbers are stale and have not been
re-measured. Historic figures: dense/fast 0.474 bound vs 0.480 p95; mixed 0.67
vs 0.66; sparse 0.85 vs 0.72. Earlier, an empirical envelope using co-authored
air/amplitude was shipped and then replaced: controlled analysis showed those
inputs were selection proxies; the previous-gap ballistics carry the real signal.

## Scoring (the ruler)

**`scored target = the authored value, unmodified.`** `buildDriftReport` records
`{ target: authored, achieved: measured, error: |authored − achieved| }` and
`score.ts` aggregates that raw error into `axis_quality`
(`exp(−rms/0.25)`), full weight, like every other axis. `feasibility_bound` and
`ceiling` are attached ALONGSIDE as diagnostics and are read by NOTHING in the
scoring or search path — grep them: the only consumers are report readers and
`study_repair_anchor_causality.ts`.

So an ask the physics cannot deliver stays in the score as permanent error. Ask
0.8 where the beat allows 0.45 and you carry 0.35 forever; the bound sits next
to it telling you why, but it does not forgive it.

**This is a deliberate reversal, and the reasoning on both sides is worth
keeping.** Until `0a461809` (the Benchmark V2 build) the line
`t = Math.min(t, impactFeasibilityBound(...))` clamped the target here, and this
section documented that convention. Arguments for clamping, from the era when it
was live: with raw asks ~34% of impact targets were physically impossible *given
their beat context*; the optimizer correctly refused the bad trades (every
steering probe chasing them washed), and the impossible residual poisoned the
headline AND dragged other axes (~100 pts of deliberate trade). With bounded
asks the full↔excl-impact gap narrowed from 107 to 69 points and other-axis
quality rose (592 → 639 excl-impact).

Arguments for the current un-clamped ruler: the score then depends on MEASUREMENT
rather than on a model of feasibility — a model that is approximate (pure
ballistics, geometry-blind) and that, when wrong, silently forgives real misses.
Clamping also hides authoring mistakes: over-ask a dense groove and the score
looks clean, so you never learn the spec is demanding something that beat
forbids. Un-clamped, the mistake surfaces as error and `feasibility_bound`
explains it.

**MEASURED 2026-07-31 (`study_impact_error_split.ts`, canonical V2 inventory,
44 sources × 3 seeds @750k, 12,168 authored contacts) — the answer is: do NOT
restore the clamp.** The decisive number is not the error split, it is the
model's falsification rate:

- **28.9% of landings achieved MORE impact than their feasibility bound said was
  possible.** The bound is not an upper bound; it is a soft, frequently-exceeded
  frontier. (Its sibling, the actual-speed `ceiling`, was violated 0/12,168 times
  — that one is sound.)
- Clamping would therefore forgive error on beats where the compiler
  demonstrably CAN deliver more. The apparent headline win — mean |err| 0.162 →
  0.119, rms 0.207 → 0.146 — is mostly that forgiveness, not a truer ruler.
- It follows that the "irreducible" share of error (0.104 mean, 64% of the total)
  is NOT trustworthy as a physics floor, because it rests on a model that is
  wrong about a third of the time. Treat it as a difficulty hint, never as a
  scoring input.

The same run located where the real headroom is, and it is not physics: in the
**0.125–0.5 ask band (43% of all authored contacts)** the bound says 0.53–0.57
is available and the compiler delivers **0.14–0.24** against asks of 0.21–0.42.
That shortfall sits entirely INSIDE the bound, so it is compiler headroom, not
an over-ask. (Note `IMPACT_TARGETED_ASK = 0.3` in `optimizer/impact_policy.ts`:
much of that band is not even treated as materially targeted for search
allocation.) At high asks the picture inverts — the 0.875–1.0 band asks 0.91,
the bound says 0.60, and delivery lands at 0.62, i.e. right at the frontier.

Note for anyone reading old harnesses: `eval_leaf_factors.ts`,
`eval_arc_apples.ts` and `eval_pergap_vs_composed.ts` still apply
`min(authored, bound)` themselves. They reproduce the RETIRED convention and do
not match production scoring.

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

authoring (absolute intent) → scoring (the same unmodified target) → search and
generation pressure (the same resolved target), with feasibility and actual
ceiling attached as diagnostics. A change to any layer must keep the others'
reading intact; the evaluator fingerprint guards the ruler pieces, and
`verify:optimizer` pins the compiler's end-to-end behavior.

## Diagnostics & tests

- `LR_IMPACT_OFF=1` — impact vanishes end-to-end (the ~689 non-impact
  ceiling); golden prints `excl. impact` headline alongside the full one.
- `study_impact_anatomy.py` — error anatomy + counterfactual rulers from any
  archive. `study_landing_window.ts` — candidate-pool/selection tracing.
  `study_score_without_impact.ts` — with/without recompute.
- Tests: `tests/v0_impact.test.ts` pins the exact scored loop (midpoint speed,
  inclusive right boundary, contacted-only accumulation, airborne advancement,
  missing samples, truncation and frame offsets), ruler, ceiling, and
  geometry-independence. `tests/overlay_impact.test.ts` pins the current-only
  effects contract. Historical suite counts and benchmark results belong in
  run artifacts, not in this contract.
