# Planning campaign — global spec analysis → re-aim the local machinery

**Status: v1 SHIPPED (2026-06-14).** The first working implementation — an outcome-gated,
targeted impact re-aiming loop in the repair phase — is **canonical ACCEPT, Δheadline +1.1**
(40 specs × 12 seeds: 629.3 → 630.4, P(Δ≤0)=3.3%, positive at every budget, no regressions)
and is now the production default (escape hatch `LR_PLAN_LOOP=0`). This is *early* — a
deliberately simple first cut with clear room to grow (see "Where v1 can grow"). Board for
fast iteration = `scripts/v0/eval_planning.sh` (4-spec slice; supports `sweep`/`CAND_ENV`).

## What shipped (v1)

`optimizer/planning.ts`: `aimTargets(gap) = gap.plannedTargets ?? gap.targets` (the seam —
generation + ranking read it; the scorer and scorer-mirroring cost never do), and
`maybeReaimImpactGap`. In `handoff.ts`'s repair phase, each restart targets the weakest
affordable gap; if that gap is an impact gap that **undershot**, its impact aim is bumped up
(×1.2) so the fresh-seed re-search pursues a steeper catch — kept ONLY if the true score
improves (repair's accept/reject). Because impact is *chronically* undershot, aiming higher
pulls achieved toward the true target; because it's *targeted* to the weak gap, air-weak gaps
keep clean repair; because it's *outcome-gated*, it can't regress. Knobs: `LR_PLAN_LOOP_BUMP`
(0.2), `LR_PLAN_IMPACT_AIM_MIN` (0.3), `LR_PLAN_LOOP_DEADBAND` (0.03).

## Where v1 can grow (it's early)

- **Smarter correction than a fixed ×1.2 bump:** proportional to the measured undershoot, or
  a learned step that closes the gap (the "model" idea).
- **Re-aim beyond the single weakest gap:** the whole re-searched suffix, or a small window.
- **Other systematically-biased axes:** the method pays where an axis chronically misses in
  one direction AND the re-aim is true-score-gated. Impact qualifies; air does NOT (it's
  unbiased — re-aiming prev-gap *speed* for it was causally falsified, see log). A *different*
  upstream lever for air (launch vy/pose, not speed) is an untested hypothesis.
- **Steer *conducive state*, not just the axis target** — the original richer vision; needs a
  causal model of what actually moves the axis (the air study showed correlations mislead).

## Thesis

The compiler builds a track **mostly locally**: for each gap it places an arc to match
*that gap's* literal axis targets (impact, air/elevation/amplitude, landing time, speed),
with only a 1–2 gap lookahead. But a spec is ~30 s long, with **structure the lookahead
cannot see** — build-ups, runs of closely-spaced beats, impact-dense sections. Matching
the literal per-gap target can paint the rider into a corner where the rest of the spec is
hard or infeasible.

The idea: **analyze the whole spec up front (analytically, no simulator) to recognize that
structure, and from it derive a deliberately MODIFIED aim** — a per-gap/per-axis bias,
possibly aiming for something *other than* the literal target — and feed it into the
existing local generation + ranking machinery. The classic example: "this section is a run
of close, high-impact beats → we'll need speed banked *before* it → aim higher earlier."
But the lever is general (any carried state, any axis), not just speed.

**The final score is always computed against the true spec and the official rules — that
never changes. We only change what the search AIMS for.** This trades a slightly worse
local match for a better *overall* track score — "accept smaller gains here to unlock more
gains overall."

## Explicitly OUT OF SCOPE (confirmed with Jérémie)

- **The repair / restart post-pass.** It's just "retry the search from another branch if
  budget remains." We know what it buys; it is not the lever.
- **Budget / compute scaling.** Pushing budget ~10×, more candidates, deeper lookahead,
  bigger pools — all tried across many angles; they do not move the needle. The bottleneck
  is *not* compute and *not* "be smarter locally."
- **Better pools / better commits as such.** This is not about improving the local search's
  quality at matching the literal target — it's about changing the *target it aims at*.

## Why local-only is limited (the actual gap)

The lookahead sees 1–2 gaps; it can locally maximize the current gap (and check it leaves a
viable next state), but it has no bird's-eye view of a 30 s spec. So it cannot know that a
locally-optimal choice now forecloses a hard section later. A global pre-pass that reads the
spec's structure can supply that foresight as a bias on the aim.

## Prior art / lesson

`docs/global-planning.md` was a REJECTED first crack: it pre-committed *speed* as the scarce
resource (DEMAND→PLAN→LEVERAGE, biasing the energy-launch toward a planned speed). The board
rejected it because neither impact nor elevation turned out to be speed-limited. **Lesson:
don't pre-commit the resource — derive what to re-aim from the spec's structure, and keep
the lever general.** (That doc's *insertion points* — L1 generation aim, L2 ranking fit —
may still be the right plumbing; its *hypothesis* was too narrow.)

## What we now know (grounded, 2026-06-14, three read-only agents)

**The validated, lookahead-blind prize.** A preceding *run* of high-impact beats inflates
AIR error on the current gap and the next 1–3 gaps (r ≈ +0.52 at lag 0, still +0.42 at lag
3). Disentangled from the local impact confound: among *low*-impact gaps, being preceded by
a high-impact run nearly **doubles** air error (0.084 → 0.156). This is a genuine cross-gap
state legacy the 1–2 gap lookahead cannot see — the cleanest empirical instance of the
thesis. (drums_crescendo gap 20–21 whisper→drive step-up is the canonical example.)

**The mechanism.** Impact catches (deep scoops / sharp turns) cost speed/state, and the cost
is paid *downstream*, past the horizon. The local search handles this myopically-correctly
two ways: (a) ~32–36% of impact gaps are `C_ranking_loses` — the impact-hitting deep scoop
*is generated* then down-ranked because it costs speed locally (the objective is right
*locally*; only a global view knows when impact is worth the downstream cost); (b) the
air-legacy effect above. The unifying lever is **amortizing the impact/air/state balance
across an impact run**, not carrying a scalar resource.

**What is NOT the lever (settled).** Carrying speed (the original lead example). Speed is
abundant; impact is turn-limited with *no sampler* (53–56% of impact gaps never get a
candidate with enough turn = `A_not_generated`). `global-planning.md` failed because it
re-aimed speed. The paradigm is right; the resource was wrong.

**The seam (clean, greenfield).** `gap.targets` (search aim) is a separate object from
`gapAxisTargets` (scorer); changing the former never touches the official score
(`buildDriftReport`→`scoreDriftReport`). Plan: pre-pass at `handoff.ts:~684` (where
`nextImpact` is already derived) writes `gap.plannedTargets?: AxisValues`; a helper
`aimTargets(gap) = gap.plannedTargets ?? gap.targets` is read by generation
(`arc_placement.ts` energy-launch / elevation / air shaping) and the ranking objective
(`objective.ts` fit terms) — **never** `axisCost` (mirrors the scorer) nor the scorer. An
unused `geometryTargets` override already exists in `sampleOneCandidate` (`sample.ts:166`)
for exactly this. No spec-structure pre-pass exists today. CONSTRAINT: ±2° arrival
perturbation breaks the next on-beat landing at 79% of gaps → the re-aim must live in
*generation* (each candidate re-simulated under the new aim), never a post-hoc nudge.

## Scaffold (built 2026-06-14, lever-agnostic — chosen first step)

Implemented the seam so any bias plugs in cheaply, byte-identical until a bias is set:
- `optimizer/planning.ts` (new): `aimTargets(gap) = gap.plannedTargets ?? gap.targets`,
  and `planSpec(gaps)` — the up-front analytic pre-pass that computes per-gap features
  (`gapFrames`, `impactTarget`, `trailingHiImpactDensity` = the validated lookahead-blind
  predictor) and returns a `SpecPlan`. SCAFFOLD: it sets NO bias (`plannedTargets` unset).
- `types.ts`: `Gap.plannedTargets?: AxisValues`.
- `handoff.ts:~686`: calls `planSpec(gaps)` after target resolution, stashes on
  `ctx.specPlan`; `LR_PLAN_LOG=1` prints a one-line summary.
- `sample.ts`: generation default `geometryTargets = aimTargets(gap)`; `SpecContext.specPlan`.
- `objective.ts`: ranking reads `aimTargets()` at `scoreCurrentGapQuality`, `speedFitFactor`,
  `impactFeasibilityFactor`. NOT wired into `axisCost` (mirrors scorer) nor the scorer.

Frozen baseline = clean HEAD on the board (headline 571.33, all 9/9, evaluator fp
`7a02862e6ece`; same fp on the scaffold ⇒ A/B valid). **PARITY GATE PASSED (2026-06-14):**
Δheadline +0.00, 95% CI [0.0,0.0], every per-track×budget cell +0.00, 9/9 — byte-identical,
as designed. (Uncommitted.) A bias v0 (A or B below) sets `gap.plannedTargets` inside
`planSpec` from the features.

## Play log — does the scaffold carry signal? (2026-06-14)

Dummy probes via env-gated knobs in `planning.ts` (all default-off ⇒ committed scaffold
stays byte-identical), swept on the board with `eval_planning.sh sweep` (arm A = clean).

- **Knob A — speed-before-impact** (`LR_PLAN_SPEED_BUMP`, raise speed aim on gaps preceding
  a high-impact beat). Sweep {0.05,0.1,0.2} → Δheadline **−1.7 / −3.6 / −7.2** (monotonic,
  P(Δ≤0) 84→99.8%). Localized correctly (solo_run untouched; loss concentrates on the most-
  bumped high-impact spec drums_crescendo −21). Per-axis: **speed error ↑ ~1:1** (the
  "accept worse locally" cost, paid in full); **impact error ↓ but ~10× smaller** (real,
  right direction, far too small to cover the cost). Confirms speed is the wrong resource.
- **Lever insight:** re-aiming an axis *away* from its target costs that axis's score ~1:1.
  So a re-aim only wins if it goes *with* a systematic miss (reducing error) or unlocks a
  larger downstream gain. **Impact is universally UNDER-shot → aiming it higher should
  reduce error, not add it** (and may inject the never-sampled steep catches). → Step 1.
- Scaffold verdict: works end-to-end (re-aim moves the tracks exactly where/how expected),
  board is a sharp instrument (clean dose-response, tight CIs). Knobs B (`LR_PLAN_IMPACT_BUMP`,
  multiplicative impact-aim-up) added for the proper work.

## Proper-work plan (leveraging the scaffold)

1. **impact-aim-UP, swept** — aim impact higher where asked; read whether impact error
   actually drops and at what cost (air/speed/deaths). [Step 1 running: bump {0.1,0.2,0.4}]
2. **selective + calibrated** — bias only where it pays (tune `LR_PLAN_IMPACT_AIM_MIN`,
   magnitude); confirm net-positive.
3. **adaptive / closed-loop** — measure each gap's *actual* undershoot after a first pass,
   aim up proportionally, regenerate, keep only if the true score rises (rides accept/reject).
4. **promote** — confirm a winner in frozen-snapshot mode, commit.

## Step 1 result — impact-aim-UP (2026-06-14): the lever moves the binding axis

Sweep `LR_PLAN_IMPACT_BUMP` {0.1,0.2,0.4} vs frozen clean baseline → Δheadline
**−6.9 / −4.2 / −14.7** (0.2 best; CIs at 0.1–0.2 overlap 0, so net ≈ slightly-negative-noisy;
0.4 clearly bad). The ROBUST part: **impact error reliably DROPS** (−0.006…−0.015 every spec)
— first time the campaign has moved the binding axis; re-aiming *with* the systematic
undershoot reduces it, as predicted. The DIRECTIONAL part (bump 0.2, per-track):
- **drums_crescendo +7.8 / +0.5** (impact −0.008, air +0.004) — the high-impact spec WINS.
- dense_sprint **−15.7 / −16.5** (impact −0.011, **air +0.021**) — the whole headline loss.
- drums_pendulum −2.2/−3.1; solo_run ~0.

So impact-up TRADES AIR for IMPACT, and the net depends on the per-gap balance. The loss is
concentrated on the dense guard, where pushing impact wrecks air it needs.

**Selectivity must be OUTCOME-based, not feature-based.** Tried to find an up-front gate to
protect dense_sprint: its impact gaps look just like crescendo's on **air target** (median
0.75 vs 0.67) and **gap duration** (bulk 20f for both). They are indistinguishable up front
yet behave oppositely → no static spec feature separates the win from the loss. The only
reliable separator is the *realized* air-degradation / true-score, which you only see after
generating. ⇒ the indicated mechanism is the **outcome-gated closed loop** (Step 3), not
more up-front gating (Step 2 is effectively ruled out for this tradeoff).

## Study #1 (2026-06-14) — gate is impossible; the loop is the only selector

Mined the bump=0.2 sweep archives vs the clean baseline, per gap (1854 bumped gap-instances):
- **No up-front feature predicts the outcome.** Pearson r(Δ|air_err|) vs air_target/impact_target/
  gap_dur = −0.13 / −0.02 / +0.02; r(Δ|total|) ≈ 0.00. No air-target/duration bin separates
  net-improved from net-worse (43–64% everywhere). A static gate cannot select where the bump pays.
- **No hard failures** (drift/off-beat/missing/deaths all 0/0). The board loss is pure axis-RMS
  rebalancing, not breakage. On matched surviving gaps the bump is ~break-even (Δ|total| −0.008),
  yet the board loses −16 on dense_sprint — a subtle whole-track RMS effect no per-gap feature exposes.

⇒ **Build the closed loop.** It needs no per-gap prediction: re-aim → re-search → keep iff the true
whole-track score rises. That keeps crescendo (↑) and rejects dense_sprint (↓) automatically — the
only reliable selector, since Study #1 proves a static gate can't exist. Must be budget-neutral
(ride repair's post-completion budget + its accept/reject), not an outer 2-pass.

## v0 candidates (pick one to build first — board referees)

- **A — Air-legacy state setup** (cleanest signal, lowest regression risk): pre-pass detects
  high-impact runs; re-aims the run's tail / following transition gaps to recover air-capable
  state. Needs a quick state study first (what exactly the run leaves: residual speed? pose?
  grounded?) to set the bias direction.
- **B — Impact amortization / re-weight** (biggest drag −57 pt impact, higher risk): global
  impact-demand profile re-weights impact vs speed-fit so the `C_ranking_loses` deep scoop
  survives where impact is worth its downstream cost. Fights a *locally-correct* down-rank.
- **C — Lever-agnostic scaffold first**: build the pre-pass + `gap.plannedTargets`/`aimTargets`
  seam + telemetry (byte-identical when planned==literal), then plug A or B in cheaply.

## Guards / discipline (from the rejected prior attempt)
- Demand-driven SELECTIVITY is essential — a uniform/global bias regresses headroom-free
  specs. Bias only where the spec structure demands it.
- Decide on the full 9-seed board — drums specs are pathologically seed-variant.

## Guards
- Drums specs are pathologically seed-variant — decide on the full 9-seed board, never a
  few-seed run.ts study.
