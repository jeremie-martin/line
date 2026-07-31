# Impact — the definition

What the author-facing `Contact.impact` [0,1] means, why, and where the evidence
lives. Successor to `docs/archive/impact_problem_statement.md` (the full June-2026
campaign log); this doc stays short and current.

## The quantity

**Impact is the redirection impulse of a landing**: the perpendicular,
gravity-free part of the impulse the ground delivers while converting a
ballistic state into a riding state. In this engine the only forces are gravity
and line contact, so per unit mass the ground's impulse is exactly
`Δv − g·Δt`; the felt part of it is the component that *bends the path*
(user-labeled principle, 2026-06-09: slowdown along the path is not a hit).
It factors as **speed × misalignment** (`v·Δθ`), which is why both author
intuitions hold by construction:

- **perfectly tangential arrival ⇒ 0**, at any speed (the seamless kiss);
- **no speed ⇒ no impact**, at any angle (a slow flop can't slam) — and the
  speed-bounded ceiling (`impactCeiling`) is part of the semantics, not a caveat.

**[0,1] anchors:** 0 = no redirection (tangential, no bounce); 1 = the hardest
*catchable* hit (the ejection boundary — beyond it the contact fails). Linear in
px/frame between anchors (`normImpact`, SOFT=0 / VSTRONG=7.29).

**The window is a perceptual constant, not a physics parameter.** Human event
integration is ~150 ms = 6 frames; the felt match peaks at W=6–7 and degrades at
W≤5 and W≥8 (validated on 67 leveled beats, 2026-07-30 — June's n=8 result
reproduced). Metrics *should* change under W=3 vs 12; that is not a robustness
failure.

## The family tree (every metric ever tried is this quantity, approximated)

| metric | approximation | status |
|---|---|---|
| `point` (v·sinα vs surface) | instantaneous, single-plane | retired: under-reads multi-frame catches (ρ≈0.3–0.6) |
| windowed normal-speed | surface-anchored window | retired: tracks surface faceting, ~70% false positives |
| jolt / deform / strain | force on body points | retired ×2: rotation-confounded (ranked felt-soft beat #1) |
| `dv`/`netImpulse` (|Δv−gΔt|) | full impulse | retired: re-admits parallel slowdown the user excluded |
| comDecel / snap / onset-decay | force (dJ/dt), suddenness | retired ×3: overfits one track, collapses on rolling_drop |
| `redir` (peak v·sinΔθ) | ⊥ component, sin-compressed | superseded |
| **`redirArc` (v·Δθ_net, W=6)** | net form | **SCORED (locked 2026-06-14)** |
| **`cArc` (Σ v̄·|Δθ| contacted)** | accumulated, contacted-only | **standing challenger (2026-07-30)** |

`contactRedirArcPx` (impact_support.ts) is `cArc`: per-frame redirection summed
over CONTACTED in-window frames only, raw velocities. The contacted-only rule IS
the gravity treatment — airborne frames contribute zero (flight is not impact;
gravity's ballistic bending never enters), while on supported steps the ground
cancels gravity so the raw path bend is the real redirection. (Subtracting g·dt
per contacted step instead — the `stepGravity` variant — mis-attributes the
support force: ~0.175 px/f of phantom arc per supported frame.) Vs `redirArc`:
S-bends and bounce reflections accumulate instead of cancelling.

## Evidence (2026-07-30, `study_impact_impulse.ts`, 90 leveled beats / 6 sets)

Spearman vs felt, mean over the four discriminating sets (impact_lab_v2,
climb_terrace, rolling_drop, staircase):

```
cArcG 0.817 ≥ cArc 0.810 > redirArc 0.788 > redir 0.783 > turn 0.759 > cArcOn 0.713
```

- `cArc` ≥ production on every discriminating set (ties rolling_drop), never
  collapses. A small (+0.02) but direction-consistent improvement — NOT yet
  promotion-grade (a ruler change costs a golden re-baseline).
- `cArcOn` (τ=4 onset decay, the landing-vs-arc attribution arm) fails again —
  0.46 on rolling_drop, the third strike for the force/onset family. Retired.
- Soft end: with the fuller label set the June "soft≈medium≈2.9" coarseness
  largely dissolves (soft 2.14 < medium 2.96 for redirArc); the gravity-floor
  hypothesis is NOT confirmed — `cArc` does not widen the soft→medium gap.
- The shelter attribution pair (2894 felt-strong vs 2845 felt-smooth,
  near-identical CoM profiles) remains unseparated by every magnitude metric
  (6.11 vs 6.10). Known limit of a single scalar; style stays in dashboard tags
  (smooth/snappy/slam), not in the intensity formula.

**Divergence adjudication (2026-07-30 evening, user notes on all 9 unlabeled
shortlist beats):** CARC 3 · CURRENT 1 (marginal) · neutral 5. The wins: shelter
@1334 and @1453 judged "CARC better than CURRENT" outright, and shelter @12 is
the structural case — CURRENT's *net* Δθ cancels to exactly 0.00 on a
bend-then-unbend contact the user felt as "definitely more than 0.00"; the
accumulated form cannot cancel. The one CURRENT lean (@349) is tonal ("pretty
smooth" vs 0.43/0.52). No beat contradicts CARC outright. Combined with the
pooled Spearman edge (≥ on every set), the evidence now points one way.

Scope note: those 9 annotations are FREE-TEXT ONLY (no INTENSITY ordinal was
set), so they are qualitative evidence read by hand — they contributed zero new
leveled beats, and every Spearman figure in this doc still rests on the original
90. The shortlist's `leveled?` column distinguishes ✓ / "note only" / no for
exactly this reason.

## Calibration (2026-07-31, from-scratch — three independent studies)

Three evidence sources, one job each: **physics sets the endpoints, perception
sets the curve, the real catalog sets compatibility.** Tools:
`study_catchability_atlas.ts` · `study_impact_perceptual_curve.ts` ·
`study_impact_scale_audit.ts` (all analysis-only).

**Atlas** (1,295 controlled drops: speed × arrival angle × geometry × pose
phase): the flat-slam eject frontier sits at normal closing ≈ 6–7 px/f; the
scoop frontier at centripetal ≈ 3 px/f² (~17 g); the **max reliable in-window
turn is ≈ 1.0 rad at any speed**, so the empirical ceiling is
`ceilCArcPx(s) ≈ s × 1.0` (±6% over the SPEED_RULER envelope; replaces the
inherited `asin(0.9)` net-turn form). Reliable in-envelope physics top:
**cArc ≈ 11.2–12.6** — well above where felt/catalog live (see below). Rig
footnote: net-form redirArc shows reversal pathology on steep ride-outs
(velocity flips ⇒ Δθ≈π); cArc is immune (midpoint speed ≈ 0 at the flip).

**Perceptual curve** (90 leveled beats, per-track + pooled isotonic vs linear):
monotone confirmed; isotonic gains are within small-n flexibility; **linear
stands**. Felt "very strong" median 9.3 with 90% CI [6.4, 13.4] — the felt data
cannot arbitrate the anchor (relative-labels doctrine holds).

**Scale audit** (impact_calib_rich × 3 seeds @150k + 937 landings on 15 real
tracks): asked→achieved is near-diagonal from 0.35 up with an incidental floor
≈ 0.2–0.3 at the gentle end; **compatibility-optimal anchor V\* = 7.85**
(ask-corpus mean meaning-shift 0.046, p90 0.093; vs 0.109/0.224 at the physics
top 11.3, which would also make asks above ~0.6 undeliverable). Per-band shift
≤ 0.06 except [0.8,1) at 0.121 — precisely the beats where the divergence
adjudication favored CARC. Envelope seed-stable (~10%).

**Benchmark revalidation (2026-07-31, `study_impact_benchmark_validation.ts`):**
the canonical V2 development inventory (44 sources × 3 seeds @750k → 12,168
authored landings; ask distribution matches the catalog, mean 0.542) reproduces
every result: ceiling law **0 violations** (max in-window turn 0.76 rad, p99
0.55); meaning-shift valley flat over V ∈ [7.3, 7.9] (bench V* 7.45, production
V* 7.85, combined equal-weight **V* = 7.55**; physics-top 11.3 confirmed bad:
0.136/0.261); envelope seed-stable (<2%); redirArc reversal pathology present in
the atlas but fires **0×** on canonical content (robustness insurance, not a
live bug); visible divergence |Δnorm| > 0.1 on 6.6% of landings. The known
mid-band delivery shortfall (asks 0.25–0.5 achieving ~0.1–0.2) reproduces
identically under both metrics — a compiler-campaign issue, untouched by the
ruler choice.

**Resulting calibration (proposed):**

- `SOFT = 0` (physical floor, unchanged) · **`VSTRONG_CARC = 7.55`** (combined
  compatibility optimum; the valley is flat so any value in 7.3–7.9 is
  defensible) · linear.
- **[0,1] is the felt/compatibility scale, not the physics range**: authored 1
  = "very strong" exactly as today's specs mean it (no migration — all 4,484
  authored asks keep their meaning); the physics headroom above it saturates.
- **`impactCeiling` = clamp01(s × 1.0 / VSTRONG_CARC)** — the honesty report;
  it reaches 1.0 at s ≈ 7.6 px/f, truthfully leaving headroom above.

## Decision state — PROMOTED 2026-07-31 (explicit user go)

- **Scored metric = `contactRedirArcPxAtLanding`** (substrate.ts), anchors
  SOFT=0 / VSTRONG=7.55 linear (`normImpact`), ceiling and every
  aim/feasibility clamp on `IMPACT.MAX_RELIABLE_TURN_RAD = 1.0` (the fraction
  form is kept as `sin(1.0)` so sealed fixture conventions keep their shape).
  Evaluator fingerprint bumped 6f760d9c1cc9 → **afbdb18787e6** — pre-promotion
  scores are not comparable.
- **Promotion validation**: full test suite green (22 impact tests incl. new
  accumulated/airborne-zero semantics; the only failures are 18 pre-existing
  benchmark-v2 governance breaks, verified identical pre-swap); hot path
  362 ns/call (vs 221 legacy; gated to authored landings); post-swap
  asked→achieved response on impact_calib_rich is unchanged within noise and
  reaches ~0.94 at ask 0.95; golden 40-spec @50k ×12 seeds under the new
  ruler: **372.53** (405.45 excl-impact, pass 0.9458) — the new reference.
- **Benchmark V2 campaign**: the retained 750k/N=48 baseline was scored under
  the old ruler; comparisons across the promotion are ruler-mixed and need a
  deliberate baseline re-freeze (`npm run benchmark -- baseline`) — left as an
  explicit campaign decision, not done as part of the promotion.
- **Compiler-lever alignment** (aim/readiness exploiting the accumulated form
  and the ~13% frontier headroom) deliberately lags as the next campaign.
- The dashboard lanes are now CURRENT (scored impulse) vs LEGACY (net form).

## Ground truth & tools

- **`labels/impact/`** — the durable felt-label archive: six `<n>.labels.json`
  (dashboard annotations) + exact `<n>.track.json`, plus `<n>.levels.json`
  (numeric interpretations of the three note-only sets, basis quoted per beat).
  The June adjudication interpreted those notes without persisting them; the
  levels files close that hole.
- `scripts/v0/study_impact_impulse.ts` — the campaign study: per-set + pooled
  felt Spearman, W-sweep, felt-level medians, envelope, divergence shortlist,
  attribution pair. Run: `LR_ENGINE=wasm npx tsx scripts/v0/study_impact_impulse.ts`.
- `scripts/v0/study_impact_labels.ts --track=… --labels=<n>` — single-set deep dive.
- `/impact/` dashboard + `build_impact_study.ts` — clips, lanes, label capture.
