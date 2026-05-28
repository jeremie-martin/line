# Future search architectures to explore

After Phase 4 confirmed that pure beam search has structural coverage
weaknesses vs greedy (sized-down adaptive DFS), the user noted that
option D — "reconsider beam search altogether" — should be revisited
once the hybrid (option A) lands.

This file catalogs the alternatives worth investigating later, with
just enough context to pick up cleanly when the moment comes.

## Why we'd come back to this

The hybrid beam + recovery backtracking (option A, in progress) preserves
the monotonicity-in-budget property and the simplicity of beam pruning.
But our problem has a specific shape that other algorithms might handle
more naturally:

- **Heterogeneous per-gap difficulty**: greedy's adaptive DFS spends
  compute proportional to where it's needed. Fixed-width beam doesn't.
- **Cascading-state divergence**: small differences at gap N propagate
  catastrophically by gap N+30 (dense_sprint seed=2 with K=48 vs K=96
  diverged on a 0.001-cost difference and ended up 2.4× worse).
- **Long-horizon viability is hard to predict from local cost**: per-gap
  cost is only a 0.7-0.8 predictor of section-level axis_quality
  (Phase 0 finding). The "right" alternative at gap 3 might be expensive
  locally but pay off 10 gaps later.

These properties point toward search algorithms with stronger
look-ahead or smarter compute allocation.

## Candidates

### Iterative-deepening DFS (the chess-engine analogy)

The user invoked chess engines as the model for "more compute → better
moves". Real engines use iterative deepening with alpha-beta pruning:
search depth 1 → keep best move m₁; search depth 2 → keep m₂ only if
strictly better than m₁; ..., return best move found at any depth.

For our problem: search depth 1 = "evaluate one candidate per gap and
commit"; depth 2 = "evaluate one, then evaluate the next gap's response,
keep best 2-gap pair"; etc. Monotonic by construction (deeper search
keeps prior best as fallback). Adaptive compute (more depth where
needed, e.g., at known-hard gaps).

Implementation cost: significant. Need a way to compose partial-track
evaluations across depths. Move-ordering from prior depths can speed
up alpha-beta dramatically.

### Monte Carlo Tree Search (MCTS)

Build a search tree where each node = partial track up to gap N,
children = candidate choices at gap N+1. Use UCB to balance
exploration (try less-visited branches) vs exploitation (extend
high-reward branches). Random rollouts (greedy expansion to end-of-spec)
estimate node value.

Strengths: adaptive depth based on visit counts; converges to optimal
given enough rollouts; handles uncertain horizons well. Anytime by
construction (return best leaf at any moment).

Weaknesses: random rollouts may be wasteful when greedy isn't a good
estimator; the UCB exploration constant is yet another knob; tree
storage is unbounded.

The Line Rider problem has a finite horizon (known gap count) and a
deterministic eval at each leaf — closer to chess than to Go. Pure
MCTS might be overkill, but UCB-style allocation of compute across
prior beam-search hypotheses could be a fruitful hybrid.

### Beam with explicit recovery (option A — currently being built)

Listed here for completeness. Beam pruning with `active` and `dormant`
slots; on beam death, promote dormants from an earlier gap. Combines
beam's quality + monotonicity with greedy's adaptive backtracking.

### A* with admissible heuristic

If we could define an admissible heuristic for "minimum remaining
axis_error from this gap to end-of-spec", A* would give us optimal
search with proven minimal exploration. The challenge is the heuristic
— per-gap cost is not admissible (it underestimates section-level
cost). Designing a real admissible heuristic for our objective is
nontrivial; might be a research project in itself.

### Lazy / restartable greedy with memory

A minimal twist on greedy: run greedy to completion; remember the
chosen candidate at each gap; run greedy AGAIN with a "force avoid
position N's choice" constraint and keep whichever track is better.
Repeat with budget. Essentially randomized restarts. Trivial to
implement; might match beam's quality wins for less effort.

## When to revisit

The user committed to building option A first. Revisit this file:
- After A ships and we have data on (coverage, quality, wall-clock).
- If A's hybrid still under-performs on some specs.
- If the optimizer's behavior under future spec types (different beat
  patterns, axis combinations) exposes new weaknesses.

The decision should be data-driven, like Phase 4 was. Each of the
above algorithms warrants its own investigation phase with explicit
exit gates.
