# Forward-eval lookahead — attempt log

Terse. One entry per attempt: hypothesis · change · result (headline Δ + per-budget) · verdict.

---

## CANONICAL PHASE (full golden suite, modify-production workflow) — see docs/lookahead-prompt.md

Measure: full canonical `npm run golden` (40 specs × 12 seeds × **100k/200k/300k** — 50k dropped
2026-06-13, completion-knee noise / lowest weight / not optimized for), `decide` vs the committed
baseline. Modify production directly; keep only wins. North star: headline 700.

**BASELINE (HEAD b36f98c, 3-budget grid): headline 622.16** — 100k 612.3 / 200k 624.3 / 300k 629.3;
excl-impact 679.1 (impact ≈ −57, still the dominant gap to 700). (Historical 4-budget baseline, HEAD
97c7248, was 614.29; C1–C3 below were measured on the OLD 4-budget grid and are kept as-is.)

Old 4-budget baseline detail — per-budget 50k 564.4 / 100k 612.3 / 200k 624.3 / 300k
629.3. Excl-impact headline 672.5 ⇒ **impact ≈ −58, the dominant drag.** Weakest spec drums_pendulum
470 (air-axis 0.21). Systemic weakest axis = impact (mean |err| 0.149; dominant in most low specs);
funnel study (memory): ~56% of impact gaps never generate a deep-enough scoop (template caps turn
~22°), ~32% admitted but correctly ranked-bottom ⇒ impact is largely GENERATION-bound, not ranking.

### C1. Default rollout depth 2→1 (flat greedy:1) — REJECT
The probe-board greedy:1 win (§10) was at 500k / 11 specs; test it on the canonical. Change:
`matureForwardEvalConfig` defaults non-upgraded path to depth 1 (mature-avg preserved). Result:
**609.3, Δ −5.0**, negative every budget (50k −3.4 / 100k −8.3 / 200k −4.4 / 300k −3.5). greedy:2's
depth is better at canonical budgets (biggest gap @100k). Reverted.

### C2. Impact funnel (study, read-only) — impact is GENERATION-bound, not a lookahead lever
`study_impact_funnel.ts` (6 impact specs × 3 seeds @200k, 477 impact gaps): A_not_generated **53%**
(needed turn 26.7°, selected 6.3°), B_gates 3%, C_ranking_loses **36%**, D_works 7%. In the C bucket
the deepest *admitted* scoop reaches only impact 0.27 vs 0.36 target (still undershoots) and is
correctly ranked near-bottom (0.69 pct) — flat-entry deep scoops cost speed, so the ranker is right
to skip them. ⇒ the 58-pt impact lever needs DEEPER / STEEP-ENTRY scoop geometry that is never
generated (template turn cap); the lookahead ranker is near-optimal on what it's handed. The path to
700 runs through candidate GENERATION (arc template), which is outside the forward-eval lookahead.

### C3. Default rollout depth 2→3 (greedy:3) — REJECT
Depth helps (greedy:2≫greedy:1, C1); test more depth. Result: **611.29, Δ −3.0**; craters 50k
(518.8 vs 564.4, −45, 7 invalid) — depth-3 rollouts starve the cost-sensitive low budgets. Depth
curve peaks at greedy:2 (g1 −5.0 / **g2 optimum** / g3 −3.0). Reverted. Lesson: added rollout cost
is punished hardest at low budgets ⇒ cost-REDUCING levers, not cost-adding.

### C5. Greedy downstream = quality-best-of-3 instead of first-viable — REJECT
Rolled gaps sample 3 quality-ranked candidates (rollout aim suppressed) and roll the quality-best,
vs 1 first-viable. Result (vs 622.16): **618.14, Δ −4.0**; negative every budget (100k 601.8 −10.5 /
200k 618.2 −6.1 / 300k 623.6 −5.7), worst at 100k. The extra sampling cost dominated. Reverted.

### C6. Forward-eval pool 8→5 — REJECT
Cost-reducing: forward-eval the top-5 decision candidates instead of 8 (winner mean q-rank 2.6).
Result (vs 622.16): **617.52, Δ −4.6** — quality loss (good rank 6–8 candidates dropped) outweighs
the cost saving. pool=8 is tuned-optimal. Reverted.

**ASSESSMENT (cost-quality optimum is GLOBAL — pivot to difficulty-relative).** All four global cost
levers REJECT: depth-down (C1 −5.0), depth-up (C3 −3.0), cost-adding downstream quality (C5 −4.0),
cost-reducing pool (C6 −4.6); impact (C2) is generation-bound. greedy:2 / first-viable / pool-8 /
short-leaf is a tight GLOBAL cost-quality optimum.

**But it's the right answer only ON AVERAGE.** Difficulty characterization (offline on the baseline):
budget/gap spans ~20× (tiny_dance 75k/gap @300k → solo_run 3.9k/gap), search nodes/gap 7–23 (rich) vs
~2.5 (dense). Budget-rich specs have SLACK. → difficulty-aware config experiment (below).

### D1. Difficulty-aware WIDTH (best:N where budget/gap high) — WASH on the canonical
`LR_FWD_EVAL_BPG` (budget/gap threshold → best:DEPTH:N), aim-suppressed. Probe (5 specs, 3 seeds)
suggested +5.7, but the FULL canonical (40 × 12):

```
  best:1:5 @15k   621.77  Δ −0.4   (width helps leap +4.0/big_air +3.3/canyon +3.0, but depth-1
                                    hurts float_bounds −19.6/summit −9.1; canyon's probe +30 = noise)
  best:2:2 @20k   621.71  Δ −0.5   (keep depth-2 + width; cost offsets the width gain)
```

Both INCONCLUSIVE/wash. ⇒ the marginal value of WIDTH ≈ the default allocation's, even in budget-rich
situations. Width is not where the slack pays. Reverted the flag. `eval_difficulty.sh` kept.

### D2. Budget-scaling curve (300k→600k→1M) — the ceiling is GENERATION, not budget (DECISIVE)
5 specs × 2 seeds at 300k/600k/1M. Mean 654.7 → 655.8 → 659.7 (**+5.0 for 3× budget** — steep
diminishing returns). Shape: easy specs already AT ~700 and flat (big_air 702→701.6, tiny_dance
698→698); low specs plateau BELOW 700 and barely move (solo_run 635→642, drums_tide 662→668,
dense_sprint noisy). The low specs are AXIS-bound (impact+air), not budget-bound — more frames don't
fix them. ⇒ the headline is capped by the low specs' axis quality, which is GENERATION-bound (C2
funnel: template can't make deep-enough scoops). Lookahead at optimum + repair tuned + budget
diminishing ⇒ **the path from 622 to ~700 is candidate GENERATION (arc scoop/flight geometry), not
the forward-eval lookahead.** Repair tuning note also documents 706 at 1M — but that needs the
generation headroom too; at the canonical budgets the system is near its config+axis ceiling.

### D3. The AIM and the READINESS are huge (ablations) — the readiness is the lever, and it WORKS
Two canonical ablations vs baseline 622.16:
```
  aim OFF (LR_AIM_ENUM=0)            614.38  Δ −7.8   REJECT  (the enumerative proposer is worth +7.8)
  readiness OFF (objective=cQ only) 584.92  Δ −37.2  REJECT  (the next-gap readiness term is worth +37)
```
The 5-spec probe board had said "aim ≈ neutral" — WRONG, small-board artifact. On the full canonical
the aim is +7.8 and the readiness (in the pool quality sort + aim proposer) is **+37** — one of the
most valuable components in the system. Reconciles the probe campaign: "readiness doesn't pay" was the
LEAF use; in per-gap RANKING it's enormous. Aim funnel facts: aimed candidate is pool rank-0 ~27% /
top-3 66%; ~18% of proposals fail the placement gate; model error ~0.1; sweep is pitch ±10° / top-2.
⇒ next: does a better-DEFINED readiness pay beyond +37 (component isolation: catchability/speedFit/
impactFeasibility; speedFit flagged as a poor proxy)? `LR_OBJECTIVE_READINESS` switch added (default on).

### D4. Readiness component isolation — all three contribute (it's well-built, not broken)
Drop each factor from the readiness product (vs 622.16): impactFeasibility −9.2 (biggest), speedFit
−4.9, catchability −1.3. All positive ⇒ no weak component to fix; the speedFit "poor proxy" critique
was the LEAF use, not ranking. The +37 is multiplicative (components co-operate).

### D5. Aim emit top-2 → top-4 — REJECT
`LR_AIM_TOPK_EMIT=4`: 618.75, Δ −3.4 — more proposals cost more sims than they win; aim tuned at
top-2. (Header notes: `LR_AIM_SPAN=14` already +0.3 INCONCLUSIVE — span saturated; the V4 deep-scoop
lane was deleted at −0.0 ablation, "can return if impact wants it.")

### FINAL ASSESSMENT — the forward-eval lookahead + aim + readiness are at a tight, confirmed optimum
Exhaustively tested on the canonical (622.16), every change REJECT or wash: config (C1 greedy:1 −5.0,
C3 greedy:3 −3.0, C5 downstream-quality −4.0, C6 pool-5 −4.6), difficulty-aware width (D1), aim top-k
(D5). Ablations prove the components are valuable AND tuned: aim +7.8 (D3), readiness +37 (D3) with
all three sub-terms positive (D4). Budget scaling is flat (D2: +5 for 3× budget). **No accepted change
moves the headline.** The cap is the low specs' IMPACT + AIR axis quality, which is GENERATION-bound
(C2 funnel; the deleted V4 deep-scoop lane was neutral — the ranker correctly skips flat-entry deep
scoops). **Path to ~700 = candidate generation (steep-entry deep-scoop geometry for impact), outside
the forward-eval lookahead.** The lookahead campaign is complete with a clean, evidence-backed verdict.

### G1. Generation probe — impact scoop turn cap 22°→27° — INCONCLUSIVE (impact error unchanged)
First step outside the lookahead, into the arc template (`arc_placement.ts IMPACT_TEMPLATE_MAX_TURN_DEG`).
Funnel C2 said deep impact asks need ~27° but were clamped to 22°. Raised the cap to 27°. Result:
621.88, Δ −0.3 INCONCLUSIVE; **mean|impact err| 0.1424→0.1429 (unchanged)**. The deeper scoops enter
the pool but don't reduce impact or move the headline — the ranker correctly skips them (flat-entry deep
scoops cost speed, C2/V4). So the cap was never the binding constraint; the binding constraint is the
STEEP-ENTRY deep-scoop geometry (lab: "steep entry + deep scoop gets impact AND speed"), a harder
template change the V4 lane already priced at neutral. Reverted.

### G2. Impact geometry is PHYSICS-bounded — definitive ceiling (end of the lever stack)
Read the impact template (SLAM-HOP, arc_placement.ts:1167). The lab's ideal "steep entry + deep scoop
+ return to normal launch" needs a CONVEX CREST, which physics forbids: "a big redirection cannot exit
at a descending launch without a convex crest (the rider flies off it early — the documented early-bend
failure; the two-phase return variant won local cost on 88% of pressured beats yet forward-eval rejected
every one)." SLAM-HOP is the physics-respecting compromise, already in production. So the ~57-pt impact
undershoot is a FUNDAMENTAL redirection-physics limit, not a tunable/generation gap, and the geometry is
already at its physics optimum. **Headline 622 (excl-impact 679) is a PHYSICS ceiling at 100k–300k.** No
tunable lever — lookahead, aim, readiness, budget, generation cap, or generation geometry — reaches 700
at these budgets. The only remaining moves are non-tunable real-world decisions: change the scorer's
impact weighting/targets, change the redirection physics (REDIR_CAP), or accept 622 as the ceiling.

### G3. Full canonical @1M = 637.33 — 700 is INFEASIBLE for this suite at any budget (measured)
Ran the full canonical (40×12) at a single 1M budget to settle the 5-spec (+5) vs repair-note (706)
conflict. Result: **1M headline 637.33** (mean 639.7), excl-impact 693.68. Budget→headline curve:
100k 612 / 200k 624 / 300k 629 / **1M 637** — diminishing, +8 for 3.3× budget. The repair note's
"706 @1M" was STALE (different baseline). Lowest specs @1M still physics-pinned: drums_pendulum 492
(air), terrace 556, dense_echo/skyline 574. **Even excl-impact @1M = 693.68 < 700.** ⇒ 700 is
empirically UNREACHABLE for this spec suite at ANY budget — bounded by impact+air physics on the low
specs plus diminishing budget returns. The north star is infeasible as framed; reaching it would need
a different spec suite or a scorer change (impact/air weighting or targets), not a compiler change.

### H1. Asymmetric speedFit (readiness reshape, NOT ablation) — ACCEPT +4.0 → NEW BASELINE 626.2
**Hypothesis.** `speedFit` compares the catch-INSTANT arrival speed to the next gap's MEAN-of-flight
speed target; the catch instant overestimates the flight mean, so a symmetric `exp(-|Δ|/scale)`
over-penalizes the (apparent) overshoot. (This is the long-standing §Open-questions item.)
**Change** (objective.ts `speedFitFactor`, production default, no flag): penalty `= d>0 ? d*0.5 : -d`
— too-fast half-penalized, too-slow unchanged.
**Result.** headline **622.2 → 626.2, Δ=+4.0** CI[1.2, 6.8] P(Δ≤0)=0.4%; per-budget all positive
(100k +2.2 / 200k +4.9 / 300k +4.1); pass-rate 100%→100% every budget.
**Verdict. ACCEPT** — committed + promoted to baseline. First accepted change; overturns the prior
"no compiler win exists" assessment — that rested on only ever ABLATING readiness components (all
positive when dropped) and never RESHAPING one. The shape, not the presence, had headroom.

### FRAMING — budget allocation is a marginal-value / opportunity-cost problem (the real program)
A fixed budget can be spent on several levers (more candidates / wider rollout / deeper rollout / more
aim probes / more retries). Each has a DIMINISHING-RETURNS curve (marginal score per marginal budget),
budget is CONSERVED (opportunity cost), and the curves are DIFFICULTY-dependent. Optimum = spend each
marginal unit where its marginal value is highest until they EQUALIZE across levers — difficulty tells
you which curve you're on. D1 is one measured point (width's marginal value ≈ default's). NOT
decisive: the work is measuring each lever's curve × difficulty (studies), then allocating to equalize
marginal value. Levers already mapped at the global operating point: depth peaks at 2 (C1/C3), pool at
8 (C6), width ≈ default (D1). UNEXPLORED & promising: the RETRY/repair budget share.

---

## PROBE PHASE (11 specs × {150k,300k,500k} × 8 seeds, eval_*.sh) — superseded by the canonical phase

---

## 0. Harness validated + blunt readiness multiply is survival-unbounded — REJECT

**Why.** Smoke-test the harness and confirm a code change is captured.

**Change.** `objectiveLeafValue *= forwardTerminalReadiness(leaf, gaps)` — multiply
the whole-branch leaf by the frontier readiness ∈ [0,1] (reusing the single readiness
surface, no parallel impl). Reverted after measuring.

**Result.** Identical-code run = **Δ +0.00, 100% valid** (harness is deterministic /
correctly wired). Readiness-multiply run = **headline 585.3 → 332.4, Δ −252.9, REJECT**;
every spec drops; `drums_crescendo` collapses to **0/8 valid @150k** (13 deaths, 261
missing). A multiplicative ∈[0,1] prior on the whole-branch score is unbounded against
survival — the search trades catches away for a "more catchable" frontier.

**Verdict. REJECT** (throwaway draft; its only job was to prove the harness). **Takeaway:**
readiness must inform ranking *without* being able to override survival/missing — a
bounded reweight, a tie-break among already-valid continuations, or a per-frontier-gap
term rather than scaling the whole prefix score.

---

## 1. Bounded frontier-readiness tilt in the leaf — REJECT (dead end)

**Hypothesis.** Fold the COMPOSITE frontier readiness (catchability × speedFit ×
impactFeasibility — the rollout's headed-for catchability, `forwardTerminalReadiness`)
into the leaf as a BOUNDED tilt `value *= (1−λ + λ·readiness)`, so readiness reweights
the branch without being able to zero survival/missing (the λ=1 failure mode). Sweep λ.

**Change.** `objectiveLeafValue *= (1−λ + λ·forwardTerminalReadiness(leaf,gaps))`, λ from
env `LR_LEAF_RDY_LAMBDA`. Reverted after the sweep.

**Result.** Monotone-negative, tightly significant, → 0 as λ↓:

```
  λ=1.0   585.3 -> 332.4   Δ -252.9   (drums_crescendo 0/8 @150k, deaths)
  λ=0.2   585.3 -> 539.5   Δ  -45.8   CI[-112,-13]   (drums_crescendo 6/8 @150k)
  λ=0.1   585.3 -> 573.1   Δ  -12.2   CI[-18.6,-5.6]  effect -3.63  (100% valid)
```

Structure at λ=0.2: **air-heavy specs ~neutral/positive** (big_air_ramp +0.4, leap_cadence
+0.5/+2.7), **dense/rhythmic all negative** (dense_sprint −35, drums_pendulum −41,
syncopated_lift −28, skyline_push −28, rhythm_ladder −18; drums_crescendo −176 @150k).

**Verdict. REJECT** — for THIS form (the shared composite metric, multiplied over the whole
branch). Three points monotone toward 0 ⇒ this tilt only approaches the baseline from below; no
positive interior optimum in this knob. Says nothing about other metrics (tested below).

**[PRELIMINARY — directional, probe tier; a result about this form, not the readiness idea.]**

---

## 2. Leaf readiness = SPEED-ONLY — REJECT (worst tested)

**Definition.** Structure held fixed (whole-branch bounded tilt `value *= (1−λ + λ·r)`); r set to a
LEAF-SPECIFIC speed-only term (`leafFrontierReadiness`, kind=speed, distinct from the shared
objective.ts readiness): `r = exp(−|arrival.speed − authoredSpeedToPx(nextGap.targets.speed)| /
0.75)`. `arrival.speed` = ballistic predicted speed at `nextGap.endFrame` (the catch); same form and
scale as the shared `speedFit`. Implementation note (fact): `arrival.speed` is the single
catch-frame value, whereas the speed AXIS target is the MEAN |v| over the whole next flight
(`core/measure.ts measureSpeed`) — different statistics. (Whether that matters: untested.)

**Result (vs §1 composite, same λ):**

```
            λ=0.2     λ=0.1
  composite  -45.8     -12.2
  speed-only -112.1    -56.1
```

drums_crescendo collapses harder (−256 @150k, 5/8 valid); big_air/leap_cadence ~neutral/+.

**Verdict. REJECT** — worst variant tested. This speed-match-to-target definition does not help in
the leaf. (No mechanism claimed; see Open questions.)

---

## 3. Leaf readiness = CATCH-ONLY — best tested (parity + upside at λ=0.1)

**Definition.** Same structure; r = `readinessCatch(arrival.speed, arrival.comAngleDeg)` — the R0
catchability surface, a 2-input fit over arrival SPEED and CoM-velocity ANGLE (note: it DOES use
speed, just not as a target-match). `LR_LEAF_RDY_KIND=catch`.

**Result (same-λ alternatives):**

```
            λ=0.2     λ=0.1
  speed-only -112.1    -56.1
  composite   -45.8    -12.2
  catch-only  -12.2     -3.7   CI[-8.8,+0.8]  P(Δ≤0)=94.5%
```

Per-spec @λ=0.1: POSITIVES on air/rhythmic — big_air +5.8, leap_cadence +3.2/+3.2, syncopated_lift
+4.9, rhythm_ladder +2.6, skyline +1.4; headline dragged by a few dense specs — drums_pendulum
−21.7/−15.1 (dominant), drums_crescendo −8.6/−11.6, dense_sprint −10.6. (drums_crescendo does NOT
collapse here: −9, vs composite −175 / speed −256.)

**Verdict. Best variant tested** — statistical parity at λ=0.1 (CI crosses 0) with per-spec upside.
The residual loss is concentrated on a few dense specs (drums_pendulum). No explanation established.
(Re-run after the §4 graceful-ignore fix: identical −12.2 / −3.7 — speed targets are universal in
these specs, so the fix does not move catch.)

---

## 4. Leaf readiness = IMPACT-ONLY — REJECT; + graceful-ignore fix

**Definition.** Same structure; r = leaf-local impact-feasibility, mirroring objective.ts:
`min(1, arrival.speed·sin(max(0,comAngle)) / (impactAsk·REDIR_CAP))`, no-op (1) when the next gap's
impact target is undefined / below the 0.3 min ask / no arrival angle. `LR_LEAF_RDY_KIND=impact`.
Fix shipped here: `leafReadinessFromArrival` now no-ops each component on ITS OWN missing target
(was early-returning on a missing SPEED target, which wrongly ignored catch/impact too).

**Result:**

```
            λ=0.2     λ=0.1
  impact     -23.3    -13.3   (REJECT)
```

Damage concentrated on dense specs (dense_sprint −67.7 @150k, drums_crescendo −93, drums_pendulum
−56); air specs ~neutral (big_air +0.5/0, leap +0/+3.1, summit ~−1).

**Verdict. REJECT.** Worse than catch, better than speed.

### Single-component ranking (λ=0.1, leaf headline Δ; baseline 585.3)

```
  catch   -3.7   (CI crosses 0; air specs positive)     ← best
  composite -12.2
  impact -13.3
  speed  -56.1                                          ← worst
```

Catch is the only near-parity component; the composite is worse than catch alone (it multiplies in
the weaker speed/impact terms).

---

## 5. Rollout SHAPE (depth/width) — greedy:1 parity+cheaper; wider REJECT

**Definition.** A/B on `LR_FWD_EVAL` only, leaf pristine (λ=0, readiness off);
`eval_rollout_shape.sh`. Baseline greedy:2 (decision arc + 2 rolled, single first-viable
chain). Candidates: greedy:1 (decision + 1 rolled); best:1:3 (depth 1, 3 quality-ranked
candidates at the rolled gap, MAX leaf); avg:3 (depth 1, MEAN over top-3). (greedy:2
baseline reproduces 585.28 — consistency check vs the readiness baseline.)

**Result (vs greedy:2):**

```
  greedy:1   +0.3   CI[-5.4,+5.3]  INCONCLUSIVE (tie) — and cheaper (1 rolled gap)
  best:1:3  -122.2  REJECT
  avg:3     -140.6  REJECT
```

Per-spec, greedy:1: air specs prefer shallow (big_air +6.1/+15.9, leap +1.5/+11.2, skyline
+5.6/+5.3, summit +4.4/+5.1); a few dense prefer deep (syncopated −15.2, canyon −12.1,
rhythm −10.2). Net wash. best:1:3 is budget-starved at low budget: drums_pendulum −474.8
@150k but +1.6 @300k; dense_sprint −60.8 @150k → −14.9 @300k (air specs +; charged 3× fan-out
of rolled-arc sims starves dense specs at 150k).

**Verdict.** greedy:1 = parity (cheaper); best/avg = REJECT. "Wide doesn't pay charged" holds
even with the cheap leaf, because the binding charged cost is the rollout ARC-SIMULATIONS, not
the leaf — the short leaf made the leaf cheap, not width affordable. The deep 2nd gap adds
nothing on net (greedy:1 tie).

**Cross-experiment note (factual):** air-heavy specs benefit from BOTH shallower rollouts (§5)
and frontier catchability (§3); dense specs resist both. A consistent state-dependent split,
seen twice; cause unstudied.

---

## 6. best:1:2 and greedy:1 × catch readiness — one spec blocks the headline

**Definition.** vs greedy:2 / pristine leaf. best:1:2 (depth 1, branch 2, MAX leaf); greedy:1 +
catch readiness at λ ∈ {0.1, 0.2}. `eval_rollout_shape.sh` (candidate now carries shape + readiness).

**Result:**

```
  best:1:2            -20.9  REJECT   (vs best:1:3 -122 — halving fan-out helps; charged cost still drags)
  greedy:1+catch@0.1   -1.2  TIE      CI[-10.6,+6.6]
  greedy:1+catch@0.2  -14.3  REJECT   (λ too strong)
```

Per-spec, greedy:1+catch@0.1 — nearly everything POSITIVE: big_air +7.7/+16.8, skyline +12.6/+10.4,
leap +12.7@300k, summit +6.5/+4.2, dense_sprint +4.2/+2.7, canyon +6.1@300k. Held to parity almost
entirely by **drums_pendulum −24.3/−32.1**, plus small cold_start −8/−4.6, syncopated −5.8/−4.0.

Sharpest fact: greedy:1 ALONE is +6.5/−2.8 on drums_pendulum; adding catch readiness tanks it to
−24/−32. So catch readiness is **actively wrong on drums_pendulum specifically**, while it helps
nearly everywhere else (incl. the other dense specs, now ~neutral/positive).

**Verdict.** `best` doesn't pay even at branch 2 (charged cost). greedy:1+catch ties greedy:2;
catch readiness does not add to greedy:1 on net (greedy:1 alone +0.3 → +catch −1.2). The diffuse
air-up/dense-down has collapsed to **one blocker: catch readiness misfiring on drums_pendulum.**
Everything else already wins. Open: why drums_pendulum.

---

## 7. best:1:N at 3 budgets (incl. 500k) — recovers with budget to a ~−5 plateau

**Definition.** vs greedy:2 / pristine leaf, budgets 150k/300k/**500k**. best:1:5, best:1:8 (λ=0),
best:1:8 + catch@0.1. Confirmed: best:1:N (N>1) builds the rolled-level pool the SAME way as the
top-level pool — quality-ranked (sortCandidatesByQuality) AND aim-lane-refined (node.ts:173/183).
Branch caps at 8 (handoff.ts:3587), so "best of 14" = best:1:8. (greedy:2 3-budget baseline = 589.2.)

**Result (per-budget Δ, mean over specs):**

```
                   150k     300k    500k
  best:1:5        -116.7    -5.6    -4.8
  best:1:8        -107.6    -5.1    -4.7
  best:1:8+catch  -108.8   -13.7    -6.5
```

**Findings.** (1) best:N is budget-STARVED at 150k (−108) but recovers sharply with budget (−5 by
300k) — "wide needs budget to afford" confirmed directionally. (2) It PLATEAUS at ~−5 (300k→500k
flat), just UNDER parity — a flat residual that looks like fixed COST overhead (aim probes +
branching), not a quality deficit; the branching's value ≈ greedy:2's depth value, but best:N can't
shed the overhead. (3) catch readiness does NOT help even with 8 branches (−6.5 vs −4.7 @500k) —
likely because the 8 branches are already pool-ranked using that same readiness, so the leaf multiply
double-counts. (4) Per-spec @500k mixed/noisy (big_air +8.9, drums_pendulum +5.1 now positive;
syncopated −22.9, rhythm −13.9 negative) — no clean pattern.

**Verdict.** Wide-shallow asymptotes to ~parity−5, cost-bound, not a win. Motivates the aim-disable
test: drop the rollout's charged aim probes (keep the quality-rank) and see if best:N sheds the ~−5.

---

## 8. Disabling the rollout AIM PROBES unlocks wide-shallow — best:1:5+noaim broadly POSITIVE

**Definition.** `LR_ROLLOUT_AIM=0` drops the aim-lane probes INSIDE the rollout (keeps the
quality-rank) — node.ts `setRolloutContext` + gate, set around the rollout in `forwardArcValue`;
default (unset) byte-identical, so the frozen baseline stays valid. best:1:8+noaim, best:1:5+noaim
vs greedy:2, budgets 150k/300k/500k.

**Result (per-budget Δ):**

```
                   150k     300k    500k    headline
  best:1:8 (aim)  -107.6    -5.1    -4.7     -67.2
  best:1:8+noaim    -2.0    -1.9    -0.1      -1.3   (tie)
  best:1:5+noaim    -1.1    +1.8    +4.9      +2.7
```

**Findings.** (1) The aim PROBES were the ENTIRE wide-rollout overhead: best:1:8 −67 → −1.3 headline;
@150k −107.6 → −2.0. The long-standing "best/avg/wide doesn't pay charged" verdict was the rollout
aim-probe cost (the "branch-widening failure"), NOT the branching. (2) **best:1:5+noaim is net-positive,
growing with budget** (+1.8 @300k, +4.9 @500k); @500k **9/11 specs positive** — big_air +17.3,
drums_pendulum +10.4 (the persistent villain everywhere else!), leap +8.1, canyon +5.6, syncopated
+4.7, rhythm +4.3, skyline +3.3 — only dense_sprint −3.3, summit −0.5. BROAD, not air-vs-dense. (3)
best:1:5 > best:1:8 ⇒ ~5 branches is the sweet spot, diminishing past it.

**Caveat.** Headline +2.7 is PROMISING, not yet significant (CI [−2.4, +7.7], P(Δ≤0)=14%, probe
tier); +4.9 @500k is the strongest point. Needs more seeds / a canonical run to confirm.

**Verdict.** First broad net-positive of the campaign. Shallow-but-wide (5 quality-ranked branches,
1-deep, max, no aim tax) beats deep-but-narrow greedy:2 at high budget. Promising new-default
candidate. Next: width sweep (best:1:3/4/6 +noaim) to pin the sweet spot + more seeds to confirm.

---

## 9. Removing the aim ENTIRELY (top-level too) — don't; only the rollout aim is dead weight

**Definition.** `LR_AIM_ENUM=0` on the candidate (aim lane off everywhere — top-level pool AND
rollout), vs greedy:2 / aim-on baseline. best:1:5, greedy:1; budgets 150k/300k/500k.

**Result (per-budget Δ; reference: best:1:5+noaim rollout-only = +2.7):**

```
                          150k    300k    500k    headline
  best:1:5 aim-OFF-all    -4.9    -0.7    +3.3     -0.6
  greedy:1 aim-OFF-all    -3.2    +1.5    +3.8     +0.8
```

**Findings.** Removing the TOP-LEVEL aim too costs best:1:5 ~3.3 headline (+2.7 rollout-only →
−0.6 all-off): the top-level aim lane genuinely proposes good decision-gap candidates, worth
+3.8 @150k but only +1.6 @500k (wide branching compensates as budget grows). Only the ROLLOUT
aim probes are dead weight. greedy:1 barely notices (its rollout is branch=1, never ran
rollout-aim). Both climb monotonically with budget — wide-shallow advantage still growing at 500k.

**Verdict.** Keep the aim at the decision gap, drop it inside the rollout — i.e. the
rollout-context suppression (best:1:5+noaim) is the right design; removing it globally throws away
the valuable top-level contribution. Leader remains **best:1:5 + noaim (rollout-only)**.

---

## 10. greedy:1 alone ≈ best:1:5+noaim — the lever is DEPTH, not width (simplification)

**Definition.** greedy:1 WITH aim (the production default's only change: depth 2→1), 3-budget board,
vs greedy:2. The apples-to-apples number that was missing from §7–8.

**Result (headlines per budget, baseline greedy:2 = 589.2; absolute candidate score per budget):**

```
  config                  headline  vs g:2     150k     300k     500k
  greedy:2 (baseline)     589.2     —          582.4    590.5    595.3
  greedy:1 (with aim)     591.6     +2.4       579.9    592.7    599.7    CI[-2.0,+6.5]
  best:1:5 + noaim        591.9     +2.7       581.2    592.3    600.2    CI[-2.4,+7.7]
  greedy:1 (aim off all)  590.0     +0.8       579.1    592.0    599.1
```

**Finding (corrects §8's framing).** greedy:1 alone is +2.4 — STATISTICALLY IDENTICAL to
best:1:5+noaim (+2.7); CIs overlap almost entirely, the 0.3 gap is noise. So the headline lever is
rollout DEPTH (greedy:1 vs greedy:2), not wide branching. The best:N + aim-suppression machinery was
needed only to stop best:N from tanking, and even un-tanked it merely MATCHES plain greedy:1 — width
adds nothing measurable. The "wide-branching breakthrough" (§8) was really "go shallow." greedy:1 with
aim (+2.4) > aim-off (+0.8), so keep the aim (consistent with §9).

**BUDGET CROSSOVER (~300k).** Every shallow variant follows the same per-budget profile: BEHIND
greedy:2 at 150k (579–581 vs 582.4 — depth-2's deeper lookahead wins when budget is tight), ~tied at
300k (592.0–592.7 vs 590.5), then clearly AHEAD at 500k (599.1–600.2 vs 595.3) with the gap widening.
So the +2.4 headline is a HIGH-BUDGET effect; a flat greedy:1 genuinely COSTS at low budget. This is
the key open question for promotion: flat greedy:1 vs budget-adaptive depth (greedy:2 below ~300k,
greedy:1 above). The canonical golden runs lower budgets too, so a flat switch could lose there.

**Verdict.** The simplest possible change — `LR_FWD_EVAL=greedy:1`, one parameter, no new code/flags —
captures the whole high-budget gain (+4.4 @500k). It is the candidate to firm up (more seeds + a
budget crossover sweep), NOT the complex best:1:5+noaim. Still probe-tier (CI crosses 0). Promotion
hinges on the budget profile — likely budget-adaptive depth, not a flat switch.

---

## Open questions (no conclusions yet)

- Catch-only helps air/rhythmic specs but hurts a few dense ones (drums_pendulum). Why — unstudied.
- The speed-match definition compares catch-instant speed to mean-of-flight target (§2 note). Is
  that discrepancy actually causal for its poor result? Untested — would need a like-for-like
  (predicted-mean) variant to check.
- Impact-only: not yet measured (next probe).
- `readinessCatch` is a limited 2-input fit (speed, CoM angle) — could be improved; current data
  is just on the surface as-is.
- Readiness is also used per-gap in pool ranking (`candidateQualityObjective`). Whether the leaf
  use double-counts, and whether per-gap vs whole-branch structure matters, is unstudied.
