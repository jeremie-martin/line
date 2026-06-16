# Forward-Looking Arc Evaluation — Experiments Log

## Why this file
Investigating the hypothesis (Jérémie's): the high-budget ceiling is limited not by the
arc *geometry* we generate but by how we *evaluate/rank* each candidate arc. The handoff
DFS ranks candidates by a **local axis-L2 proxy** (`candidate.cost` = Σ(target−achieved)²)
plus a shallow 1-contact preview; the final leaf is then picked by the **true** scorer
(`scoreDriftReport`). Theory: ranking each arc by the **true score of where it leads**
(a forward rollout scored with the real metric) lets the search dive into better basins →
higher quality at **all** budgets, including the converged high-budget plateau.

## Method (proof-of-concept, CHEATING by design)
To isolate *"does better evaluation help?"* from *"can we afford it?"*, the forward
rollouts are **budget-refunded**: `refundPhysicsFramesTo(saved)` resets the sim-frame
counter after each rollout, so lookahead does **not** count against the compile budget.
This is NOT a shippable result — it measures the **ceiling** of the idea. If a variant
helps a lot when free, we then work on making it affordable (caching/sharing forward sims,
budget-aware depth, etc.).

- Toggle: `LR_FWD_EVAL=<variant>[:depth[:branch]]` (handoff.ts). Default off → baseline.
- Ranking when on: `score = -value` (pure; replaces the local proxy entirely). Lower
  score = better, so higher true `value` ranks first. Pool=8, branch=3, register unchanged.
- `value` = `scoreDriftReport(...).full_score` of the forward partial track
  (`forwardNodeScore`, via the existing `evaluateNode`/`asPartialReport` machinery, truncated
  to the node's processed horizon). full_score = 1000·axis·drift·missing·off_beat·survival —
  the real metric (sync + axes + survival).
- Determinism preserved (per spec,seed,budget); fingerprint 816c00d44528 unchanged
  (no scorer/spec/grid edits).

### Variants (intentional, well-defined)
- **greedy:D** — single locally-cheapest rollout D contacts deep; value = true score of the
  resulting partial track. Cheap, directional ("if I take this arc then play greedily").
- **best:D:B** — branch the top-B candidates D deep; value = **MAX** true score over the
  B^D leaves. Optimistic ("the best this arc COULD lead to"). NOTE: the real DFS may not
  realize the best continuation, so this can be over-optimistic.
- **avg:1:M** — at the next contact, value = **MEAN** true score over the top-M
  alternatives (1 deep). Expected/robust ("typical quality this arc leads to"), accounts
  for the search not always taking the best next arc.

## Baselines (canonical, 20×12×{25,50,100,150,200}k, fingerprint 816c00d44528)
- `baseline-curve-569` = current committed HEAD (HEADLINE **569.7**). Per-budget:
  25k 127.6 · 50k 325.4 · 100k 580.5 · 150k 632.3 · 200k 633.7.
- work-new reference = **579.1**: 25k 10.9 · 50k 433.8 · 100k 624.5 · 150k 626.8 · 200k 627.9.

## Results (all FREE/budget-refunded; Δ vs baseline-curve-569; decide α=0.20)

| variant | 25k | 50k | 100k | 150k | 200k | HEADLINE | Δ | verdict |
|---|---|---|---|---|---|---|---|---|
| baseline | 127.6 | 325.4 | 580.5 | 632.3 | 633.7 | 569.7 | — | — |
| free-preview-2 (summed-L2 proxy, greedy) | 208.8 | 440.2 | 596.7 | 632.0 | 632.5 | 587.0 | +17.3 | ACCEPT; **flat at high budget** |
| greedy:1 (true-score) | | | | | | 607.6 | +37.9 | ACCEPT |
| **greedy:2** (true-score) | 272.4 | 530.6 | 651.1 | 652.2 | 669.8 | **629.1** | +59.4 | ACCEPT; **high budget UP** (+20/+36) |
| greedy:3 (true-score) | | | | | | 614.9 | +45.3 | ACCEPT (worse than :2) |
| avg:1:4 | | | | | | 623.8 | +54.1 | ACCEPT |
| **avg:1:6** (true-score) | 338.6 | 547.0 | 644.1 | 662.1 | 662.2 | **632.3** | +62.6 | ACCEPT |
| avg:1:10 | | | | | | 630.7 | +61.0 | ACCEPT |
| best:2:2 | | | | | | 639.1 | +69.4 | ACCEPT |
| **best:2:3** | | | | | | 645.5 | +75.8 | ACCEPT |
| best:2:4 | | | | | | 644.9 | +75.2 | ACCEPT |
| **best:2:5** | | | | | | **653.3** | **+83.6** | ACCEPT — best free ceiling |
| best:3:2 | | | | | | 630.0 | +60.3 | depth 3 < depth 2 (again) |

### Read so far
- **Key finding:** switching the rollout score from the summed-L2 proxy to the **true
  metric** flips it from flat-at-high-budget (587) to **pushing the ceiling** (629–645; 200k
  633.7→670). Confirms the hypothesis: it was the *evaluation function*, not lookahead per se.
- **Depth 2 is the sweet spot.** greedy:3 (615) < greedy:2 (629): a deeper *greedy* rollout
  diverges from the real search → worse predictor. Lookahead value is real but shallow.
- **Optimistic branching wins:** best:2:3 (645.5) > best:2:2 (639) > avg:1:6 (632) > greedy:2
  (629). The MAX-over-branch "what this arc could lead to" ranks arcs best; more branch helps.
- avg sweet spot at width 6 (632); 10 (631) and 4 (624) lower.
- All crush work-new (579) — **when free**. Affordability still untouched (next phase).

## Affordability reality-check (HONEST budget — `LR_FWD_EVAL_CHARGE=1`, rollouts billed)

| charged variant | 25k | 50k | 100k | 150k | 200k | HEADLINE | Δ | verdict |
|---|---|---|---|---|---|---|---|---|
| baseline | 127.6 | 325.4 | 580.5 | 632.3 | 633.7 | 569.7 | — | — |
| greedy:1 charged | 89.0 | 289.0 | 575.2 | 623.6 | 641.4 | 563.9 | −5.8 | INCONCLUSIVE |
| **greedy:2 charged** | 8.9 | 258.2 | **596.9** | **650.5** | **650.9** | 572.5 | +2.8 | INCONCLUSIVE |
| avg:1:6 charged | 4.3 | 16.7 | 346.9 | 623.2 | 659.0 | 497.0 | −72.7 | REJECT |

**Decisive conclusion:** charged honestly, forward-looking ranking is **net-positive at HIGH
budget and net-negative at LOW budget**. greedy:2 charged: 25k −118.7 / 50k −67.2 (rollouts burn
the scarce budget; 25k validity 76%→36%) but **100k +16.4, 150k +18.3, 200k +17.2** — it pays for
itself *and pushes the ceiling* where budget affords it. This confirms the theory honestly: the
high-budget ceiling WAS an evaluation limit, and better evaluation lifts it affordably at high budget.

**Shippable design → budget-aware forward eval:** use the (charged) forward-looking ranker only
where budget affords it (high budget), cheap local ranking at low budget.

### ★ HONEST WIN (no refund) — budget-gated greedy:2, `LR_FWD_EVAL_MIN_BUDGET=75000`
| | 25k | 50k | 100k | 150k | 200k | HEADLINE | Δ | verdict |
|---|---|---|---|---|---|---|---|---|
| baseline | 127.6 | 325.4 | 580.5 | 632.3 | 633.7 | 569.7 | — | — |
| **gated greedy:2 (charged)** | 127.6 | 325.4 | 596.9 | 650.4 | 650.7 | **584.5** | **+14.8** | **ACCEPT** |

First HONEST result beating work-new (579). ≤50k untouched (forward eval gated off); 100k/150k/200k
get the charged forward eval → +16.4/+18.1/+17.0, ceiling lifted, budget paid in full. P(Δ≤0)=17.3%.
(One marginal 200k/150k row dropped to 239/240 — the eval cost one completion; minor.)

**Open / next:** (a) the 75k gate is a hard threshold — smooth it (budget-ramped depth/branch, or
spend-a-fraction-of-budget-on-eval) per the "smooth budget scaling" rule; (b) drive rollout cost down
(cache/share the forward sims with the committed eval — the 24% duplicate sims) to widen the
affordable band toward the free ceiling (~650); (c) "more geometry" now that the high-budget ranker
is strong; (d) productionize as default (budget-gated, charged) and re-baseline.

## Geometry diversity × good ranking (does diversity pay now?) — YES

With the forward-eval ranker ON (greedy:2, free), re-enable the diversity knobs that
*hurt* under the old local ranker. Δ vs forward-eval-alone (fwd-greedy2 = 629.1):

| knob | HEADLINE | Δ | 100k | 150k | 200k | verdict |
|---|---|---|---|---|---|---|
| `LR_QUALITY_NCAND=24` | 630.7 | +1.6 | +1.6 | +1.6 | +1.7 | ACCEPT (P=0.1%) |
| `LR_CURVE_FADE_OFF=1` (curvature all budgets) | 637.0 | +7.9 | +15.7 | +17.2 | +0.1 | inconclusive (noisy) |
| both | 638.1 | +9.0 | +16.8 | +18.2 | +1.2 | inconclusive |

**The flips prove the thesis** (better ranking unlocks diversity):
- candidate count 16→24: **−0.8 under the old local ranker → +1.6 (clean ACCEPT) now**.
- unconditional curvature: **−17 at 100k under the old ranker → +15.7 at 100k now**.
Diversity was always available; the local ranker couldn't sort it. Forward-eval can.
Curvature helps mid-budget (100k/150k), flat at 200k, noisy overall. Knobs: handoff.ts
`handoffSampleCount` (LR_QUALITY_NCAND), arc_placement.ts curveFade (LR_CURVE_FADE_OFF).

## Big next frontier: smarter SEARCH (now that node evaluation is good)
The handoff is a frontier-DFS that commits into the locally-best-3 and rarely revisits
deferred older nodes — rational when node eval was noisy, limiting now that it's good.
Forward-eval gives a usable TRUE partial-track score (forwardNodeScore) = exactly the
priority signal a smarter traversal needs. Candidates (increasing ambition):
(1) best-first over a global frontier keyed by true partial-score (revisits promising
older nodes); (2) beam search (top-W partials/depth — pairs with diversity); (3)
anytime/A*-like re-expansion. The search only needs an evaluation; we now have one.

## Planned experiments (methodic)
1. Horizon sweep: greedy:1 / :2 / :3 / :4 — how deep does the lookahead need to be?
2. best:2:2 / best:2:3 / best:3:2 — does optimistic branching beat greedy/avg, or over-shoot?
3. avg depth/width: avg:1:4 / :1:6 / :1:10 — expected-value robustness vs width.
4. Score basis: full_score vs axis_quality (sync-inclusive vs pure-axis) for the value.
5. Hybrid: blend local cost + forward value (does a little local grounding help?).
6. **More geometry** once a good evaluator is fixed: now that ranking is strong, re-test
   candidate-count / curvature-span increases — diversity may finally pay.
7. Cost realism: re-run the best variant WITHOUT the refund (honest budget) to see how much
   survives; then design affordability (shared/cached forward sims, budget-aware depth).
</content>
