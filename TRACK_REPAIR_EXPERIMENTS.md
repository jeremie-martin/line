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

## Plan (methodical, one change per decide)
- Honesty axis (the big one): replace refunded forward-eval with the gated-charged HONEST ranker; re-confirm
  the climb survives. This is what makes 706 a real shippable number, not a ceiling.
- Full-suite headline: confirm low/mid budgets stay byte-identical (gated) and the weighted headline reflects
  the high-budget gains; promote via a full canonical sweep.
- Further tuning: does maxAttempts>64 / higher feasMargin keep climbing past 706 at 1M (diminishing?).
