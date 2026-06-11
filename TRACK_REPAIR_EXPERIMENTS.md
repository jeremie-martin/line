# Track-Repair Experiments Log

## Goal
Make higher budget finally pay off. The frontier-DFS + forward-eval plateaus at high budget
(it spends post-completion budget on BLIND frontier exploration that finds little). Track-repair
spends that budget AIMED at the weakest part of a complete track: re-decide a weak gap and rebuild
the suffix to a complete track, accept iff the true score improves. Companion to
FORWARD_EVAL_EXPERIMENTS.md and SEARCH_ALGORITHM_ANALYSIS.md.

## Hard-won design principles (the difference from the REMOVED interleaved suffix-repair, commit 017dd2e)
- **Contained, not enqueued.** The old repair fed rebuilt prefixes into the shared quality frontier;
  suffixes competed with main search for evaluation budget and rarely completed. Repair is a SEPARATE
  post-pass with its OWN reserved budget.
- **Complete-or-discard.** A repair either reaches a complete track within its budget slice (→ true-score
  it, register accepts iff it beats the incumbent) or it dies and the incumbent stands. No partial accept.
- **Honest + gated + deterministic.** Repair sims are charged; the phase is budget-gated (completion is
  DFS's job at low budget); repair order/slicing is deterministic per (spec,seed,budget).
- **Reuse the proven search, don't reinvent it** (R2+): restart the real frontier-DFS from gap k — it
  branches into the OTHER arcs at k and re-searches the suffix with all its machinery (rescue, far-back,
  tail). A greedy dive was a v0 shortcut.
- **Determinism note (why a naive re-decode reproduced the SAME arc):** candidate generation is seeded by
  (seed, gapIndex), so re-searching a gap with the same prefix yields the SAME pool → same top pick →
  identical arc. Other arcs exist (rest of the pool); changing the anchor arc makes the suffix diverge
  (chaotic forward-dependency). So divergence = try the OTHER ranked arcs / restart the real search.

## Picker (which gap to re-decide)
- For a VALID track, drift/missing are 0 by construction (hard-failures), so axis_quality is the ONLY
  quality lever → v1 picks the contact gap with the largest Σ axis-error² (its share of axis_error_rms).
- v1 is a PROXY. The worst-axis gap is often a SYMPTOM of a bad inherited state set 1-2 gaps UPSTREAM
  (forward-dependency). v2 = walk the anchor upstream (release-state instrumented: relSpeed/relVy/
  relGrounded logged per repair). v2+ = feasibility-aware (don't restart from a gap too early to finish
  within remaining budget; prefer the worst AFFORDABLE gap, falling back to later/cheaper gaps).

## Results (canonical 20×12, fingerprint 816c00d44528; "Δ" vs the matched no-repair arm)

### R0 — repair on the COMMITTED ranker (local axis-L2), full suite {25..200k}, fixed 30% carve, gate 100k
| | 25k | 50k | 100k | 150k | 200k | HEADLINE |
|---|---|---|---|---|---|---|
| baseline (committed) | 127.6 | 325.4 | 580.5 | 632.3 | 633.7 | 569.7 |
| +repair | 127.6 | 325.4 | 419.96 | 570.1 | 634.9 | 521.8 |

**REJECT, decisive.** −48 headline. Two causes: (a) the 30% carve breaks completion at 100k (validity
237→225 — reserving frames starves the dive near the completion regime); (b) the LOCAL ranker can't find
better arcs (it WAS the high-budget bottleneck), so spending budget on repair doesn't convert to quality.
⇒ Repair must be HIGH-budget-gated AND paired with forward-eval.

### R1 — repair on forward-eval (greedy:2, refunded), high budgets, fixed 30% carve, gate 150k, greedy dive M=1
| | 200k | 350k | 500k |
|---|---|---|---|
| baseline (fwd greedy:2) | 669.8 | 670.6 | 670.9 |
| +repair | 660.5 | 680.1 | 680.6 |
| Δ | −9.3 | **+9.5** | **+9.6** |

**FIRST budget payoff.** Baseline is flat (200k→500k = +1.1; the ceiling). Repair CLIMBS: within-arm
200k→350k = +19.6; new peak 680.6 (+9.7 over the baseline ceiling). Caveats: (a) 200k REGRESSES −9.3 —
the fixed 30% carve is too aggressive at the low end (reserved 60k > recovered); (b) re-plateaus by 500k
(680.1→680.6) — repair runs out of USEFUL gaps with worst-gap + M=1 greedy. Ranker still refunded (cheat);
this isolates the repair MECHANISM (both arms same ranker, repair sims charged).

### R2 — completion-triggered budget + restart the REAL frontier-DFS, feasibility picker (350k)
Drop the fixed carve: main runs to firstCompletion*mainMargin (default 1.0 = first completion), then repair
spends the rest. Each repair RESTARTS the real frontier-DFS from the worst AFFORDABLE gap (estCost = perGap*
(gaps-k) ≤ remaining/feasMargin), with ceiling = now + estCost*feasMargin. Branches into the OTHER arcs, no
greedy dive. Env: LR_REPAIR_MIN_BUDGET (150k), LR_REPAIR_MAIN_MARGIN (1.0), LR_REPAIR_FEAS_MARGIN (1.5),
LR_REPAIR_MAX_ATTEMPTS (16). Both arms fwd greedy:2 (refunded).

| | 350k | HEADLINE |
|---|---|---|
| baseline (fwd greedy:2) | 670.6 | 670.59 |
| +repair R2 | 682.1 | **682.05** |

**ACCEPT.** Δ=+11.5 · 95% CI [6.7,16.5] · P(Δ≤0)=0.0% · effect=4.59 · validity 100%→100%. Beats R1 (+9.5)
AND the completion-trigger removes the carve so there's no fixed-reservation regression. Restart-the-real-
search finds DEEPER improvements than the rushed first-completion incumbent (per-spec: solo_run s1 ~670→699,
verse_chorus s0 749→761, cumulative +14/+20/+42 on solo_run s0). Caveat: many restarts spend 30–55k frames
and re-converge to the SAME incumbent (dScore=0.00) — the full search from a gap often re-finds the same
optimum. That wasted budget is the main R3/R4 target. Ranker still refunded (isolates the repair mechanism).

### R3 — upstream blame (walk the restart anchor to the parent on re-convergence), 350k — REJECTED
LR_REPAIR_MAX_UPSTREAM>0: if a restart re-converges, restart from the parent/grandparent.
| | 350k |
|---|---|
| R2 | 682.05 |
| R3 (maxUpstream=3) | 680.43 |
**REJECT −1.6 vs R2 (P=96%).** Root cause: re-running the SAME deterministic search from the parent ALSO
re-converges to the same incumbent (the search re-finds the same path), at 35–55k frames each — wasted vs
spending that budget on more distinct worst gaps. The real "fix the cause" needs DIVERGENCE, not a re-run
from upstream. ⇒ kept as a tunable (default OFF); superseded by R4.

### R4 — ★ seed-perturbed restarts, 350k — BIG WIN
Each restart uses a FRESH derived seed (mix of searchSeed + restart counter), so it samples genuinely
different arc geometry instead of re-converging. "Exhaust on failure only": a gap that improves is re-picked
(next fresh seed) so budget concentrates where it pays. Both arms fwd greedy:2 (refunded).
| | 350k | HEADLINE |
|---|---|---|
| no-repair baseline | 670.6 | 670.59 |
| R2 (same-seed restart) | 682.1 | 682.05 |
| **R4 (seed-perturbed)** | 692.8 | **692.75** |
**ACCEPT.** +10.7 vs R2 (P=0%, effect 5.66); **+22.2 vs no-repair baseline** (P=0%, effect 7.50) — ~doubles
the repair gain. The seed change is THE unlock: dScore=0.00 re-convergences became +33/+75 wins (solo_run s0
722→750, s1 670→702). Confirms the determinism diagnosis: re-convergence was purely same-seed re-sampling.

### R3' — seed-perturbed upstream (LR_REPAIR_MAX_UPSTREAM=3 ON TOP of R4), 350k — small ACCEPT
With fresh seeds, escalating to the parent is no longer a re-run (different inherited state). 694.58 vs R4
692.75 = +1.8 (P=8.5%, ACCEPT at α=0.20). Reverses R3's same-seed rejection. Modest; best config = R4 + upstream.

### Climb test — best config (seed-perturbed + upstream), refunded fwd greedy:2
| budget | no-repair baseline | repair | Δ |
|---|---|---|---|
| 200k | 669.8 | 687.5 | +17.7 |
| 500k | 670.9 | 697.4 | +26.5 |
| 1M | ~671 | 698.3 | ~+27 |
Baseline is FLAT (670 across all budgets — the ceiling). Repair CLIMBS 200k→500k (+10) and 200k is now
POSITIVE (completion-trigger removed the carve regression). RE-PLATEAUS 500k→1M (+0.9): at 1M only 69/240
rows change — maxAttempts=16 binds (~850k repair budget ÷ ~25k/restart ≈ 30+ possible). Peak 698.3, near 700.

### maxAttempts — the 1M plateau was the CAP, not the budget. ★ 700 BROKEN
1M, best config (seed-perturbed + upstream), refunded fwd greedy:2:
| maxAttempts | 1M HEADLINE |
|---|---|
| 16 | 698.29 |
| 64 | **706.56** |
The 500k→1M plateau was maxAttempts=16 binding (1M affords ~30-40 restarts). At 64 → **706.56, over the 700
target.** Default raised to 64 (low/mid budgets exhaust budget before the cap, so it's a no-op there).
Session arc: baseline FLAT ~670 across all budgets → seed-perturbed repair CLIMBS to 706.6 @1M. Higher budget
finally pays off. (Single-budget 1M headline; refunded ranker — honesty axis still pending.)

### ★ HONEST + FULL CANONICAL SUITE — the promotable number
Charged forward-eval (LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_CHARGE=1 LR_FWD_EVAL_MIN_BUDGET=75000), repair gate
150k + upstream=3, vs the SAME honest ranker WITHOUT repair. Full canonical 20×12×{25,50,100,150,200}k.
Includes the obs-B comparator fix (repair "improved" = register's best CHANGED, not full_score delta).
| budget | honest base | + repair | Δ |
|---|---|---|---|
| 25k/50k/100k | 127.6/325.4/596.9 | identical | 0.0 (gated, byte-identical) |
| 150k | 650.4 | 655.7 | +5.3 (P=0%) |
| 200k | 650.7 | 660.2 | +9.5 (P=0%) |
| **HEADLINE** | **584.5** | **589.6** | **+5.1 ACCEPT (P=0%, effect 4.99)** |
Validity 100%→100% at 150k/200k (no completion breakage). Full honest branch progress: committed **569.7 →
589.6 = +19.9** (forward-eval +14.8, repair +5.1). The 706@1M is the off-suite high-budget CEILING (the real
1M use case); the suite headline only samples 150k/200k so repair's *suite* contribution is +5.1.

### Fresh-view agent's key findings (folded in)
- **Headline blindness (confirmed):** canonical weights 200k≈38%/150k≈29%, never samples 350k-1M; repair gate
  150k → repair only moves 150k/200k rows on the suite. 706@1M is off-suite. ⇒ consider adding a 500k rung to
  the estimator (golden_suite.ts calls the grid "a fixed ESTIMATOR for a wider budget distribution").
- **Comparator mismatch (obs B, FIXED):** repair improved-flag used full_score; register adopts passing leaves
  by axis_quality. Now decided by register-best-changed identity.
- **Cost model coarse (obs C):** perGap = firstCompletionFrame/(deepestSeenGap+1); deepestSeenGap counts
  dead-end branches → biased feasibility gate. Replace with MEASURED per-gap cost (now instrumented).
- Ranked next levers: measured-cost budget allocation (value/frame), repair the START/early gaps with fresh
  seeds, portfolio of top-K incumbents, compose with geometry diversity (LR_QUALITY_NCAND=24).

### Instrumentation scaffold (compile_stats.repair) — observe-only, baseline byte-identical
framesAtReach (budget timestamp per node) + per-restart records {worst,anchor,up,framesAtAnchor,framesSpent,
estCost,before/afterScore,accepted,inherited release state}; aggregates restarts/accepts/frames_spent/
gaps_touched/reconverged. In the golden archive (golden.ts compactStats); only present when repair ran.

## Research agenda — budget-aware allocation (Jérémie's vision; study later, not now)
The deep game underneath all of this is **how to spend a frame budget**, and it's the same question in
several places — repair is just the newest instance:
- **Spend-per-branch vs number-of-branches.** Is it better to complete a branch FASTER (cheaper per branch →
  try more branches, each likely lower quality, bet on volume) or to complete FEWER branches at HIGHER quality
  (more compute per branch)? This is a real dial in *node evaluation depth* (how deep we evaluate / how much
  lookahead per node = compute-per-branch) and in repair (restart ceiling / breadth). There is no global
  answer — it depends on budget and on where we are in the search. The goal is to CHARACTERIZE: in which
  circumstances does each win, especially at LOWER budget where the choice bites hardest.
- **The compiler already has several budget-aware mechanisms OUTSIDE repair** (budgetAwareContractSampleCount,
  the curvature fade, forward-eval budget gating). How these interact with repair — and whether they should be
  unified under one budget-allocation policy — is open. Jérémie is confident the high-budget repair learnings
  can be made to pay at 100k/150k/200k too, by getting this allocation right.
- **Adaptive restart placement by remaining budget (NOT yet implemented).** Where to start the new search
  should depend on how much budget remains: lots left → restart early (high blast radius); little left →
  restart near the end (cheap, guaranteed to finish). The feasibility filter is a crude first step; the real
  version uses the MEASURED per-node cost (now instrumented) to place restarts optimally.
- Per-node budget/state metadata (framesAtReach, cost-to-end, inherited release state) is the scaffolding that
  makes all of the above data-driven rather than guessed.

## Decisions
- **500k rung in the canonical suite: NOT now.** Repair works best at high budget (the real 1M use case) and
  the headline can't see >200k — but adding rungs redefines the metric (re-baseline everything) and ~doubles
  runtime per rung. For now: keep the canonical suite for comparable promotion, use 350k/500k as OFF-SUITE
  tuning/diagnostic. Revisit adding 350k+500k once the budget-aware allocation work matures and we want the
  headline to reward it.

### Measured-cost allocation (honest full canonical, vs prior repair 589.6)
Per-gap MEASURED cost-to-end (costToEnd[k] = firstCompletionFrame − framesAtReach[node@k], from the first
incumbent's own path) replaces the dead-end-biased perGap for feasibility + restart ceiling.
| variant | HEADLINE | Δ vs prior repair | verdict |
|---|---|---|---|
| measured-cost feasibility (default) | 590.54 | +0.9 (P=1.8%) | ACCEPT — kept |
| + value-density picking (SSE/cost) | 588.23 | −1.4 (P=97.7%) | REJECT — tunable, default off |
**Measured > estimated** (small clean +0.9). **Value-density REJECTED** — useful negative: with a GEOMETRIC-
MEAN objective, fixing the single WORST gap beats spreading budget by value-per-frame (one bad gap tanks the
whole track, so skipping it for "efficiency" backfires). Worst-gap-first is correct for this objective.
Honest branch total: committed **569.7 → 590.5 = +20.8** (fwd-eval +14.8, repair +5.1, measured-cost +0.9).

### ★ Feasibility margin sweep (instrumented) — the margin, not the filter, was the bug
The "feasibility filter is a wash" result was a SMELL. Instrumenting WHERE restarts start (compile_stats.repair
records: anchor/totalGaps, predictedFeasible, completed, accepted) showed: with the loose default margin (1.5 =
50% headroom) the median restart anchored at **0.70 of the track — the cheap TAIL** — because the worst/highest-
value gaps are EARLY (expensive) and got banished as "unaffordable." And ~50% of restarts the filter would have
BANNED actually complete (the cost estimate is pessimistic: a focused fresh-seed restart often finishes faster
than the main race-to-first-completion it's based on). So the filter was diverting budget from high-value early
gaps to low-value late gaps. Fix = TIGHT margin (skip only the genuinely doomed). Honest full canonical:
| margin | HEADLINE | vs no-repair base 584.5 |
|---|---|---|
| 1.5 (old default) | 590.5 | +6.0 |
| OFF (no filter) | 591.1 | +6.6 |
| **1.1 (new default)** | **592.0** | **+7.5 ACCEPT (P=0%)** |
m1.1 > off > m1.5: +1.5 vs m1.5 (P=0.4%), +0.9 vs off (P=2.2%). Default feasMargin 1.5→1.1. Honest branch
total: committed **569.7 → 592.0 = +22.3** (fwd-eval +14.8, repair +7.5).

### Retry-the-worst-gap-with-fresh-seeds — TRIED, REVERTED (budget-dependent, marginal)
Give the worst gap up to N fresh-seed restarts before giving up (instead of one-and-done). Honest suite:
retries=3 = 591.0 < retries=1 592.0 (−1.0) — at tight suite budgets, breadth (more distinct gaps) beats depth
(more tries per gap). At 1M (subset) retries=3 helped (719.6 vs 717.4) but retries=8 hurt (709, over-
concentration). A budget-aware ramp (1 at ≤200k → 3 at 500k+) kept the suite flat AND helped 1M, but the gain
was tiny/off-suite and it's exactly the "spend-per-branch vs more-branches" budget-allocation game we agreed to
STUDY DELIBERATELY LATER. Reverted as premature complexity for a marginal, off-suite gain. (Knob lives only in
the research agenda now.)

### Top-K incumbent portfolio — TRIED, REVERTED (wash; refine-best already covers basins)
Refine the K best DISTINCT complete tracks (round-robin, deduped by early-choice signature) instead of the
single best. Honest suite K=3 591.9 vs K=1 592.0 (−0.1, P=65% INCONCLUSIVE); 1M subset 717.1 vs 717.4. NO
benefit anywhere. Root cause: seed-perturbed restarts ALREADY branch into different early-choice basins, and
the register already keeps the global best across all of them — so refine-best isn't basin-stuck. A portfolio
just dilutes budget across basins. Reverted.

### Pattern (banked): the conceptually-clean CORE ideas won (track-repair, seed-perturbation, tight margin);
the "smarter allocation" embellishments on top (value-density, budget-aware retries, top-K portfolio) all
washed or rejected. The objective (geomean) + the existing seed-diversity make worst-gap-first + measured-cost-
ceiling the right, simple policy. STOP adding allocation cleverness; the budget-allocation game is a deliberate
future study, not incremental bolt-ons.

## ★ PROMOTED TO DEFAULT (the wins now ship without flags)
The honest 592.0 config is now the DEFAULT compile path (no env vars needed). `npm run golden` (no flags)
reproduces 592.02 exactly. Tests 230/230; verify:optimizer re-baselined under wasm (its 40k probe is below
both gates, so the only change there is the engine).
- **Engine:** default = Rust→WASM (was vendored JS). `LR_ENGINE=js` selects the JS parity reference.
- **Forward-eval ranker:** default = `greedy:2`, CHARGED honestly, gated ≥75k (`forwardEvalConfig`/
  `forwardEvalMinBudget`/`forwardArcValue`). `LR_FWD_EVAL=off` reverts to the local proxy; `LR_FWD_EVAL_CHARGE=0`
  refunds (the ceiling experiment).
- **Repair:** default ON and no longer has a kill switch. Sub-knobs remain
  env-overridable for tuning: min budget, main margin, feasibility margin,
  max attempts, max upstream walk, and repair logging.
- **Removed dead/rejected knobs:** `LR_FREE_PREVIEW` (superseded by forward-eval), `LR_REPAIR_VALUE_DENSITY`
  (rejected), `LR_REPAIR_NO_FEAS` (study done — feasibility-on won).
- **Net default:** 569.7 → **592.0** honest full canonical (25k/50k byte-identical; 100k +16 fwd-eval; 150k/200k
  +fwd-eval+repair). The 706@1M ceiling is reachable with `LR_FWD_EVAL_CHARGE=0` (refunded).

## Plan (genuinely open)
- (Deferred, deliberate study) the budget-aware research agenda above: spend-per-branch vs more-branches,
  adaptive restart placement by remaining budget, unifying the compiler's budget-aware mechanisms with repair.
- Compose repair with geometry diversity (LR_QUALITY_NCAND=24) — untested, cheap rider.
- Inventory of REMAINING tunables (kept, env-overridable): LR_REPAIR_{FEAS_MARGIN,MIN_BUDGET,MAIN_MARGIN,
  MAX_ATTEMPTS,MAX_UPSTREAM,LOG}, LR_FWD_EVAL[_CHARGE,_MIN_BUDGET], LR_QUALITY_NCAND,
  LR_BUDGET_AWARE_CONTRACT, LR_ENGINE.
