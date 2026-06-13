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

**Verdict. REJECT — dead end.** Three points monotone toward 0 ⇒ the tilt only ever
*approaches* the baseline from below; no positive interior optimum exists in this knob.
Readiness does not help as a leaf *factor*.

**Why (working theory).** Readiness's job is RANKING the pool (relative, within-gap —
which it already does in `getCandidatesSorted`/`candidateQualityObjective`), not VALUING a
branch (absolute, in the leaf). The leaf-tilt (1) double-counts — the rollout already walks
the readiness-ranked pool; (2) is premature — it penalizes a branch for its frontier toward
the next-*next* gap that the search hasn't optimized yet; (3) uses a pool-tuned composite
(speedFit/impactFeasibility) that mispenalizes tightly-spaced dense beats (hence
air-neutral / dense-negative). Corollary: a per-gap-objective leaf likely inherits this —
within-branch catches already happened (readiness ≈ redundant there) and only the frontier
term is predictive, which is exactly what failed here.
