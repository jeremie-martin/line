# Forward-eval lookahead — attempt log

Terse. One entry per attempt: hypothesis · change · result (headline Δ + any
collapse) · verdict. Numbers from `eval_readiness_leaf.sh` (11 specs × {150k,300k}
× 8 seeds) vs the frozen no-readiness baseline. Probe tier; a canonical run promotes.

Baseline (frozen default leaf, no readiness): **headline 585.3** (150k 579.8 / 300k 588.0).

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
