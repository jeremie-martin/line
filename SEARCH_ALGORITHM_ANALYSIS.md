# Search Algorithm Analysis — what fits THIS problem

Grounded in everything we now understand about the compiler search. Companion to
FORWARD_EVAL_EXPERIMENTS.md (which established: better *evaluation* is the lever; a naive
single-priority best-first traversal is dramatically worse than the current DFS).

## The problem's defining characteristics (the constraints any search must respect)

A. **Forward-dependent chain.** Each gap's catch sets the rider state the next gap inherits.
   Early choices dominate the whole tail. ⇒ a search must either keep multiple early options
   alive, or be able to revise early choices later.
B. **Fragile completion.** Most prefixes cannot complete (no valid catch exists given the
   inherited state); reaching a *valid terminal* is the hard part, especially at low budget.
   ⇒ a search must reliably PROGRESS to completion, not stall exploring shallow breadth.
C. **Expensive, sampled, deterministic children.** Each candidate = a physics sim (the budget
   unit). Per node the children are a *deterministic ordered sample* (seed,gapIndex); branching
   is a *choice* (how many to sample/expand). ⇒ the search controls breadth via K; cost = #sims.
D. **Geometric-mean objective.** Score ≈ geomean of per-gap quality × sync; ONE bad gap tanks
   the whole track. ⇒ uniform quality matters; a single weak gap is high-value to fix locally.
E. **Budget = sim frames; anytime; per-budget independent; VERY high budget in practice.**
   Must produce a good valid track early (anytime) AND convert lots of budget into quality.
   The high-budget regime (up to 1M for real tracks) is where we most want gains.
F. **Good evaluation now exists** (true partial-track `full_score`; forward-rollout candidate
   ranking) — but evaluation itself costs sim.
G. **Incremental engine reuse.** Extending a node sims only the new gap (cheap); re-searching a
   gap re-sims from that gap. ⇒ local re-optimization of a finished track is feasible.

## Lessons already banked
- **Evaluation is the lever** (forward-eval: honest +14.8, beats work-new 579; free ceiling 653).
- **The current frontier-DFS is well-engineered for B** (dive-to-complete + branch-3 + two-tier
  pass/fallback + far-back repair pulse + dead-end rescue cascade). Best-first threw that away.
- **Single-priority best-first FAILS** (quality-primary 273, depth-primary 69, both ≪ DFS 569.7,
  even with free eval): one scalar priority cannot serve *both* "progress to completion" and
  "quality" — quality-first → breadth-stall (never completes); depth-first → tunnel-vision +
  dead-end thrash. So the lesson isn't "best-first is bad," it's "the traversal must keep the
  completion machinery AND not collapse the progress/quality tradeoff into one number."

## Candidate algorithms, judged against A–G

### 1. Frontier-DFS (current) — the baseline / completion engine
Fits B, E(anytime), C/G(incremental). Weak on A (commits early; only the far-back pulse revises)
and on E-high-budget (it keeps expanding the frontier but doesn't *systematically* refine a good
track). Verdict: keep as the completion engine; the question is what to add/replace for quality.

### 2. Best-first, single priority — TRIED, DEAD END (see above). Do not pursue as a wholesale swap.

### 3. ★ Beam search (width W, depth-synchronized) — strongest traversal candidate
Advance ALL surviving prefixes one contact at a time; at each level expand each beam node's
top-K children, score the resulting partials by true `full_score`, keep the top-W (ideally
diversity-preserving), prune the rest.
- **Why it fits:** progresses level-by-level ⇒ always drives to the terminal (fixes B, unlike
  best-first); keeps W *diverse* early options alive ⇒ addresses A (forward-dependency) without
  having to revise; uses the good eval to prune (F); cost W·K·levels is predictable and
  budget-scalable (E). It is literally "the DFS's single dive replaced by W parallel dives with
  good pruning between levels."
- **Adapt to our code:** parameterize `expandNode`'s hard `slice(0, HANDOFF_BRANCHING)` so the
  search controls breadth; reuse `processNode` for per-node work; maintain a beam array; prune by
  the same `full_score`/register comparator we already have. Keep the best COMPLETE track in the
  register regardless of pruning (anytime safety).
- **Parameterize / play with:** W (beam width), K (children per node), budget-aware W (narrow at
  low budget for completion, wide at high budget for quality — exactly the regime split), and the
  prune rule (top-W by score vs diversity-preserving / keep-one-per-early-branch).
- **Risk:** pruning a temporarily-worse prefix that would have recovered (classic beam myopia) —
  mitigate with diversity-preserving keep + always retaining the current best complete track.

#### Beam result — TRIED, DEAD END (2026-06-07)
Implemented depth-synchronized beam (env `LR_SEARCH=beam`, width `LR_BEAM_WIDTH`, branch
`LR_BEAM_BRANCH`), beam pruned by true `full_score` (`forwardNodeScore`), budget-gated so DFS
keeps low budget (`LR_BEAM_MIN_BUDGET`). Reused the shared `processNode`; parameterized
`expandNode`'s branch slice. **The fair A/B (hold the ranker fixed at `LR_FWD_EVAL=greedy:2`,
vary only traversal; 6 specs × 4 seeds):**

| traversal (both greedy:2) | 100k | 200k | HEADLINE | valid@200k |
|---|---|---|---|---|
| **DFS** (state of the art) | 654.6 | 656.6 | **656.0** | 24/24 |
| **beam** (W=4,K=3) | 127.1 | 176.8 | 160.3 | **13/24** |

Beam loses by ~500 headline and **fails to complete half the specs** (solo_run 2–13,
drums_signature 33–260) — and fails *with budget to spare* (beam emptied at 105–130k of 200k
sim; DFS used the full 200k to dive+rescue to 24/24). Root cause = characteristics A+B: the
highest-partial-score prefix *now* frequently dead-ends later (forward-dependency); once beam
prunes the alternatives it cannot recover (beam myopia on a fragile-completion problem). The
"always keep best complete track" mitigation doesn't help — on the failing specs beam never
finds ANY valid terminal. **Same lesson as best-first: a from-root traversal that discards
DFS's frontier+rescue completion machinery fails. Do not pursue from-root beam.** (Earlier
"beam wins at high budget 604 vs 588" was an artifact: it compared beam against the *weak
local-ranker* DFS on a lucky 2-spec subset, not against the real forward-eval DFS at 656.)
Conclusion redirects to #4: the only traversal that respects DFS-for-completion is one that
starts FROM a DFS-completed track.

### 4. ★ Iterated local refinement (on a COMPLETE track) — strongest high-budget quality lever
Once DFS yields a valid complete track, repeatedly pick the weakest gap (lowest per-gap score —
D gives us this directly) and re-search just that gap's catch (and a small downstream window,
since it's forward-dependent), using the forward-eval ranker; accept iff the whole-track true
score improves; repeat until budget runs out.
- **Why it fits:** sidesteps B entirely (starts valid); directly attacks D (fix the worst gap);
  converts high budget into quality (E-high-budget — our 1M use case); cheap via G (re-sim from
  the gap, not the start); uses F to accept/reject honestly. The existing polish/tail/suffix
  mechanisms are primitive, ad-hoc versions of this — a principled worst-gap hill-climb generalizes them.
- **Adapt:** after the search converges (or interleaved), loop over gaps by ascending per-gap
  score, re-run the per-gap candidate search with forward-eval, re-evaluate via the register.
- **Parameterize:** window size (just the gap vs gap+downstream), acceptance (greedy vs
  simulated-annealing), pass order (worst-first vs sweep), budget split (search vs refine).
- **Risk:** local optima; forward-dependency means re-searching one gap can require re-doing the
  tail (window must be big enough). Complementary to DFS/beam, not a replacement.

### 5. MCTS (UCB selection + rollout + backprop)
Fits A (principled revisit via UCB) and F (our forward-eval IS a rollout). But rollouts are
sim-expensive (E) and MCTS needs many; branching is sampled-continuous (awkward to back up
visit counts). Verdict: intellectually the best match for "revisit using a value estimate," but
likely too sim-hungry to beat beam/local-search at our budgets. Lower priority; revisit if beam
plateaus.

### 6. A* / heuristic best-first
Needs an admissible estimate of quality-achievable-to-go; we have no good one, and best-first
already degenerated without it. Verdict: not viable without a real to-go heuristic.

### 7. Branch-and-bound pruning (augmentation, not a primary)
Use the best complete-track score to prune partials that already can't beat it. A speedup that
*layers onto* DFS or beam; doesn't explore better by itself. Worth adding once a primary is chosen.

## Shortlist to try (both leverage the good eval; both avoid best-first's failure)
1. **Beam search** — the traversal change most likely to beat DFS: progresses (won't stall),
   keeps diverse early options (forward-dependency), prunes with the good eval, budget-aware W.
   First, the prerequisite: parameterize `expandNode`'s branch slice.
2. **Iterated worst-gap local refinement** — the high-budget quality lever, complementary to DFS;
   directly exploits the geometric-mean objective and our 1M-budget real use case.

Recommended order: beam first (it's a traversal A/B like best-first was, reusing the same
scaffolding), then local refinement (a separate post/interleaved phase). Both env-gated, matched-
budget A/B vs DFS, documented like the forward-eval work.
</content>
