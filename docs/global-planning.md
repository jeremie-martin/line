# Global resource planning — design note

**Status:** design / brainstorming. Measured against the geometry board
(`scripts/v0/eval_geometry.sh`), same as the geometry campaign. Speed is the first
instance; the idea generalizes.

## Thesis

The compiler today is **purely local**: each gap's geometry is chosen to match *that
gap's* axis targets, judged over a 1–2 gap horizon (pool quality sort = next-gap
readiness; forward-eval = a 2-gap charged rollout; DFS backtracks on death). It has no
**global view** of the spec. But the axes are not independent — **speed is the resource
that the other axes spend.** A catch can only redirect (impact) the velocity it carries;
a climb (elevation) can only be as steep as speed allows before it stalls; a high-air pop
needs speed to cover the gap. So the right question is not just "match each target," but
**"where in this spec will the rider *need* speed to satisfy the non-speed asks, and how
do we have it there in time?"** — then bias the local machinery to arrive with it.

## Why it should pay (grounded in measurement, not vibe)

- Impact targets are **authored-limited**, sitting below the speed-feasibility bound (0%
  bound-capped). The ask is fixed; `redir = speed·sin(turn)`, so **more speed hits the
  same impact with a smaller, safer turn** → higher achieved impact, target unchanged.
- Elevation pool-best (0.40) is the **steepest non-stalling climb**; climb `vy ≤
  0.5·speed`, so more speed moves the stall point and lets the pool offer steeper climbs.
- The candidate pool has **~zero speed diversity** (energy launch pins speed to target):
  plan-speed candidates aren't downranked, they're **never generated**.
- The forward-eval already self-regulates speed *within 2 gaps*; the plan's unique value
  is **demand further out than the rollout can see.**

The cost is a small **scored-speed** penalty (tolerance 0.25, symmetric) when the rider
carries more than the spec's speed target — paid only where a non-speed ask needs it, and
cheap relative to the impact/elevation gain. The discipline is **selectivity**: a global
speed bias (my earlier air-bias / aim-higher experiments) regresses specs with no
need — the plan must be **demand-driven**, not uniform.

## Architecture: DEMAND → PLAN → LEVERAGE

Three separable pieces; each can start as a simple heuristic and be refined by study.

1. **DEMAND** — per gap, the speed that makes its *non-speed* asks comfortable. Analytic
   from the known axis↔speed laws: impact ⇒ `speed ≳ impactₜ·REDIR_CAP / safe_sin`;
   elevation ⇒ the speed whose `elevationBand` reaches elevationₜ; high-air ⇒ the speed
   to cover the gap aloft. Output: `demandPx[i]` (a speed *floor*, not a target).
2. **PLAN** — speed cannot teleport; it builds/bleeds gradually. A **backward pass**
   ramps the floor up *before* a demand so the rider arrives charged:
   `plan[i] = max(demand[i], plan[i+1] − maxBleedPerGap)`, then a forward feasibility clamp
   (can't exceed what the prior state + drops can build). Output: `plannedPx[i]` ≥ the
   spec speed target wherever downstream demands it, smooth and physically reachable.
3. **LEVERAGE** — feed `plannedPx` into the local machinery as the speed the generator
   *aims for* and the ranker *fits to*, while the **scorer stays unchanged** (it always
   measures against the spec target). The compiler thereby accepts a small scored-speed
   loss now to unlock downstream gains — the "slightly worse here to win big later" trade.

## Where it plugs in (insertion points, least→most invasive)

- **Pre-pass home:** a new `optimizer/planning.ts`, called once at `compileHandoff`
  entry over the resolved gaps (pure analytic, **no simulation** — trivially obeys the
  minimal-simulation rule). Stash `plannedPx[]` on the gaps / `SpecContext`.
- **L1 — generation aim** (`arc_placement.ts`, the energy launch): on spanned attempts,
  aim for `max(specTargetPx, plannedPx[i])` instead of the bare target. *Injects* the
  missing high-speed candidates into the pool. This is the necessary enabler — without
  it the pool has nothing to choose.
- **L2 — readiness / cost fit** (`objective.ts speedFitFactor`, candidate cost): fit
  against `plannedPx` (asymmetric: under-plan penalized, at-plan free). This is what makes
  the search *prefer* carrying speed toward demand the 2-gap rollout can't see.
- **L3 — forward-eval value** (`handoff.ts`): only if L1/L2 prove out — let rollouts
  credit reaching the plan.

## Sane first cut, and the honest catch

**v0 = L1 alone (inject), scorer-ranking unchanged.** Lowest risk: it only *adds*
candidates and the existing scorer/forward-eval keep them only where they pay
(self-regulating). It directly fixes the zero-speed-diversity hole. **But** pure
self-regulation only captures demand *inside* the rollout horizon — the forward-eval can
already "want" speed it can see, it just had no candidate to pick. So v0 tests "does
giving the pool speed options help at all?" cheaply.

**v1 = add L2 (plan-biased fit).** This is the real long-horizon lever: it makes the
ranker bank speed ahead of demand *beyond* the 2-gap rollout — the genuinely global
behaviour. Higher reward, higher risk (over-banking bleeds the speed axis; the plan must
be calibrated). Gate strength low first; let the board referee.

## Extensions (the paradigm, not just speed)

- Generalize DEMAND to other carried resources/state (vertical velocity into a pop,
  pose/heading into a redirect), not only scalar speed.
- "Accept-worse-now-for-later" as an explicit cross-gap value, not just a fit bias.
- Replace the hand-built backward pass with a learned/optimised speed trajectory — but
  only once the simple heuristic shows the lever is real.

## Validation findings (premise test, 2026-06-14) — REFINES the scope

Ran a crude single-gap speed carry (bump the launch's `vT` when the next beat demands
impact, `LR_SPEED_PLAN`) to test the premise *before* building DEMAND/PLAN. Results:

1. **Impact (the biggest prize) is NOT speed-limited — it is TURN/geometry-limited.**
   On drums_pendulum/crescendo/solo_run the rider needs only a **16–19° / 12°** velocity
   turn to hit the impact target; it achieves **10–12° / 6°**; and its speed supports a
   turn up to the **64°** eject limit. Speed is abundant (demand ≈6px ≪ ~9–11px target).
   The catch simply doesn't bend the path enough — and pushing curvature harder fails
   because the rider then **leaves the surface** (the contact/catchability limit). So the
   speed plan will NOT crack the impact undershoot. That is a geometry/turn problem.
2. **A single-gap speed bump saturates** — the energy-launch vy is clamped (must stay
   descending into the next contact), so achieved speed didn't move. Carrying speed
   genuinely requires the **multi-gap backward build** — confirms the PLAN architecture,
   and confirms there is no cheap single-gap shortcut.
3. **Selectivity is essential** — the crude carry lifted drums_crescendo +8–12 (via an
   air-trajectory side effect, not impact) but wrecked big_air_ramp −4…−46. A uniform or
   coarse-gated bump is net-negative.

**Revised scope:** speed is the binding resource for **elevation** (climb stalls — `vy ≤
0.5·speed`), not for impact. The plan's realistic prize is the 4 elevation specs +
incidental air effects — smaller than hoped, and a region where prior per-gap elevation
levers washed. The impact prize lives elsewhere: the catch's **redirection authority**
(how hard it can bend the path before the rider leaves the surface) — a pure geometry
problem, not a planning one.

## Measurement

Same board (`eval_geometry.sh`), 12 specs × {150k,300k} × 9 seeds, frozen baseline. The
drums + impact + elevation specs are the ones with demand; the dense guards must not
regress. Beware: drums specs are pathologically seed-variant — **decide on the 9-seed
board, never few-seed run.ts studies** (a 6-seed study reversed sign on the board this
session).
