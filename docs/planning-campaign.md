# Planning campaign — global spec analysis → re-aim the local machinery

**Status:** understanding-first (read pass in progress). Board =
`scripts/v0/eval_planning.sh` (dense_sprint, drums_crescendo, drums_pendulum,
solo_run × {150k,300k} × 9 seeds, frozen-baseline harness).

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
