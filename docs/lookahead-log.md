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
