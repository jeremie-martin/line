# Dead-end re-selection: backjump & best-jump

Experiment on the handoff compiler's frontier-DFS: when the search hits a dead end,
should the next node it tries be the immediate sibling (plain DFS), or should it jump
elsewhere? Three policies are implemented, all env-gated and **off by default** (a
default run is byte-identical to baseline). Companion to `SEARCH_ALGORITHM_ANALYSIS.md`.

## The idea

The handoff search is a forward-dependent chain: each gap's catch sets the rider state
the next gap inherits (characteristic A in `SEARCH_ALGORITHM_ANALYSIS.md`). Plain DFS,
on a dead end, exhausts the dead node's **siblings** — alternative arcs at the *same*
gap, from the *same* inherited state — before backtracking to the parent.

Intuition: a dead end usually indicts the **inherited state** (the parent's choice),
not the local arc, so the siblings are likely doomed too. Better to abandon the
subtree and revise an *earlier* choice. This is a known technique —
**backjumping / dependency-directed backtracking** from constraint-satisfaction search.
Two flavours were tried:

| policy | flag | on a dead end, the next pop … |
|---|---|---|
| `base` | (none) | the LIFO sibling — unmodified frontier-DFS |
| **backjump** | `LR_BACKJUMP=1` | jumps **positionally** to the nearest ancestor sibling (uncle) |
| **bestjump** | `LR_BESTJUMP=1` | jumps by **score** to the best of {siblings ∪ uncles}; depth window via `LR_BESTJUMP_WINDOW` (default 1; 2 adds great-uncles) |

`bestjump` generalizes both: plain LIFO always takes the best sibling, backjump always
takes an uncle, best-jump takes whichever of the two actually scores best.

## Implementation

All changes are in `scripts/v0/optimizer/handoff.ts`.

### What a "dead end" is here

It is **not** a childless node. When no catch exists for a required contact, the
search does not stop — `expandNode` exhausts its rescue cascade and emits a single
*skip* child (`deferExpansion: true`, `skippedContacts + 1`) that is routed to the
`fallbackStack` (the best-effort lane). The clean dive lives on the `passStack`.

So a dead end is detected in the main loop by the *shape of the expansion*: the node was
clean and produced exactly one skip child.

```ts
if (
  deadEndReselect &&
  node.skippedContacts === 0 &&                              // clean lane
  result.children.length === 1 &&
  result.children[0].deferExpansion &&                       // the skip branch
  result.children[0].skippedContacts > node.skippedContacts  // a contact was skipped
) {
  deadEndGap = node.search.gapIndex;   // arm a re-selection for the NEXT pop
  cleanDeadEnds++;
}
```

Completions (terminal node, 0 children) and ordinary multi-child expansions do **not**
arm it. Non-contact gaps (a forced single child with `deferExpansion: false`) do not
either.

### The pop, redirected

When armed, the next pop is redirected instead of taking the LIFO sibling:

```ts
let node: HandoffNode | null = null;
if (deadEndReselect && deadEndGap !== null) {
  node = bestjumpEnabled
    ? popBestDeadEndNode(passStack, deadEndGap, bestjumpWindow)
    : popBackjumpNode(passStack, fallbackStack, deadEndGap);
  if (node !== null) deadEndJumps++;
}
deadEndGap = null;
if (node === null) {                                         // fall back to normal DFS
  node = popNextFrontierNode(passStack, fallbackStack, telemetry, farBackFrontierPulseInterval(bestKey));
}
```

### backjump (`popBackjumpNode`)

After a dead end at gap `g`, the dead node's siblings (also at depth `g`) sit on top of
the pass stack; the parent's siblings (uncles, depth `g-1`) sit just below them. Scanning
from the top, the first node **shallower than `g`** is the nearest uncle. Splice it and
dive from there.

```ts
function popBackjumpNode(passStack, fallbackStack, belowGap): HandoffNode | null {
  if (passStack.length === 0) return null;
  for (let i = passStack.length - 1; i >= 0; i--) {
    if (passStack[i].search.gapIndex < belowGap) {
      return passStack.splice(i, 1)[0];
    }
  }
  return null;   // no shallower clean node (dead node near the root) -> normal pop
}
```

This is a **reorder, not a prune**: the skipped siblings stay buried in the stack and
are revisited only if the uncle's subtree also runs dry. A chain of dead ends therefore
escalates the jump upward **one level at a time, organically** (uncle → great-uncle → …).
Only the clean `passStack` is reordered; the `fallbackStack` keeps strict LIFO.

### bestjump (`popBestDeadEndNode`)

Same trigger, but it chooses by **score** rather than position. Each ranked catch child
carries the per-step feasibility score that already orders siblings (lower = better),
stored on the node at creation:

```ts
// HandoffNode gains an optional field:
optionScore?: number;   // ∞ for forced nodes (root, start, non-contact, skip)

// set only on real ranked catch children, in expandNode:
options.map((option) => ({ …, optionScore: option.score }))
```

On a dead end at gap `g`, gather the pending nodes in the depth window
`[g - window, g]` — siblings (`g`) plus uncles (`g-1`), and with `window ≥ 2`
great-uncles — and splice the single lowest-scored one:

```ts
function popBestDeadEndNode(passStack, deadGap, window): HandoffNode | null {
  const minGap = deadGap - window;
  let bestIndex = -1, bestScore = Infinity;
  for (let i = passStack.length - 1; i >= 0; i--) {       // top-down ⇒ LIFO tie-break
    const gap = passStack[i].search.gapIndex;
    if (gap < minGap || gap > deadGap) continue;
    const score = passStack[i].optionScore ?? Infinity;   // forced nodes never chosen
    if (score < bestScore) { bestScore = score; bestIndex = i; }
  }
  return bestIndex < 0 ? null : passStack.splice(bestIndex, 1)[0];
}
```

For siblings (shared prefix) this exactly reproduces the existing rank order; the
value-add is when an *uncle* scores below every remaining sibling.

### Scope caveat

The re-selection lives **only in the main search loop**, up to the first complete track.
Under `LR_REPAIR`, the repair phase re-searches suffixes through a separate loop
(`runFrontierFrom`) that still uses plain DFS pops in every variant. So with repair on,
the policy only shapes *how the first completion is reached* (which seeds the repair
incumbent); below the repair budget threshold it governs the whole search.

### Diagnostics

`LR_BACKJUMP_LOG=1` / `LR_BESTJUMP_LOG=1` print per-compile
`cleanDeadEnds`, `jumps`, `nodes` to stderr.

## Method

Each variant is a full golden run (`scripts/v0/golden.ts`), WASM engine, identical
specs/seeds/budgets — only the dead-end flag differs. Decisions use the paired-bootstrap
`decide` verdict (`npm run decide -- CAND BASE`), never an eyeballed scalar. Two compiler
configurations were tested:

- **plain** — no forward-eval, no repair.
- **honest-repair** — `LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_CHARGE=1 LR_FWD_EVAL_MIN_BUDGET=75000 LR_REPAIR=1 LR_REPAIR_MAX_UPSTREAM=3` (forward-eval ranking, charged, ≥75k; track-repair ≥150k).

## Results

### 1. Plain config — no effect

20 specs × 12 seeds × {25,50,100,150,200}k.

| policy | headline | Δ vs base | verdict |
|---|---|---|---|
| base | 569.7 | — | — |
| backjump | 568.2 | −1.5 | INCONCLUSIVE |
| bestjump w=1 | 569.5 | −0.2 | INCONCLUSIVE |
| bestjump w=2 | 569.9 | +0.2 | INCONCLUSIVE |

Backjump does nothing on its own — it abandons doomed prefixes faster, but with no
repair to spend the saved budget on, there is nothing to convert the saving into.

### 2. Honest-repair config, sparse grid — backjump looks strong (but noisy)

Same grid, honest-repair env.

| policy | headline | Δ vs base | verdict |
|---|---|---|---|
| base | 589.6 | — | — |
| **backjump** | **600.1** | **+10.4** · P(Δ>0)=76% | INCONCLUSIVE, trending ACCEPT |
| bestjump w=1 | 585.7 | −4.0 | REJECT |
| bestjump w=2 | 587.4 | −2.2 | INCONCLUSIVE |

Backjump's +10.4 concentrated at 100k (+17) and 200k (+19) — the regions where
forward-eval / repair are active. Mechanism: backjump reaches first completion *cheaper*
→ hands more leftover budget to the repair phase → repair converts it to quality. The
score-greedy bestjump keeps the search on the most *plausible* prefix (the opposite of
cheap bail-out) and does not help.

### 3. Honest-repair config, dense grid — the de-noised truth

20 budgets, 25k→500k in 25k steps (4 × 20 × 20 × 12 ≈ 19,200 compiles). This is the
authoritative result; it exposes the sparse grid's +10.4 as mostly noise.

| policy | headline | AUC vs base | pooled paired Δ (4,800 cells) |
|---|---|---|---|
| base | 671.9 | — | — |
| **backjump** | **672.8 (+0.9)** | −0.07% | **+0.28/cell, Wilcoxon p≈2e-5** |
| bestjump w=1 | 670.9 | −0.49% | −0.98/cell (n.s.) |
| bestjump w=2 | 671.7 | −0.10% | −0.34/cell (n.s.) |

The suite-score-vs-budget delta curve has two regimes:

- **Below ~200k:** large spikes (±15–50) in *every* variant, both directions. These are
  a few **fragile-completion specs flipping** (`drums_crescendo` +262 @200k for backjump,
  `drums_pendulum` −194 @75k), not a smooth budget effect. The sparse grid's +17/+19
  were exactly these flips leaking into a budget-weighted headline.
- **≥225k plateau:** the noise collapses and **backjump sits a consistent +0.4 to +0.9
  above baseline at every budget**, while bestjump w1/w2 sit slightly below.

Backjump wins the suite score at **all 17 budgets ≥100k**, and pooled over 4,800 paired
cells the win is highly significant (more cells better than worse), but the **effect is
small** (~+0.6 plateau, +0.9 headline). AUC over the whole curve is essentially tied
because the low-budget hits (25k −6.6, 75k −50) cancel the high-budget plateau gains.

## Conclusions

- **The positional backjump (idea #1) is the one with a real signal**: small but
  consistent, statistically robust, and specifically a *high-budget-under-repair*
  effect. It *hurts* at very low budget (fragile completion — DFS's dive-to-complete is
  load-bearing there).
- **Score-based bestjump does not help** in either config; staying on the most-plausible
  prefix is the wrong instinct for a chain whose hard part is *reaching completion*.
- **Dense budget sampling was essential.** At 5 budgets backjump looked like a +10 win;
  at 20 it is a well-characterized +0.6 plateau plus fragile-spec lumpiness.
- Not yet worth shipping as a default on the headline alone. Two open follow-ups:
  (a) wire backjump into the repair loop (`runFrontierFrom`) — it may amplify the plateau;
  (b) resolve the trend with more seeds (the paired test is significant but the per-budget
  effect is below the 12-seed noise floor).

## Reproduce

```bash
# one variant, honest-repair, dense grid (swap the flag for each policy)
BUDGETS=25000,50000,75000,100000,125000,150000,175000,200000,225000,250000,275000,300000,325000,350000,375000,400000,425000,450000,475000,500000
LR_ENGINE=wasm GOLDEN_NO_ARTIFACTS=1 \
  LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_CHARGE=1 LR_FWD_EVAL_MIN_BUDGET=75000 \
  LR_REPAIR=1 LR_REPAIR_MAX_UPSTREAM=3 \
  LR_BACKJUMP=1 \
  npx tsx scripts/v0/golden.ts --jobs=16 --budgets=$BUDGETS \
  --archive-dir=generated/golden-runs/curve-backjump

# dataset + plots + analysis
cd generated/golden-runs/curve-analysis
node extract.mjs        # golden.json ×4 -> long.csv, budget.csv, spec_budget.csv, summary.csv
Rscript analysis.R      # -> plots/*.png + plots/all.pdf + tables/*.csv
```

`GOLDEN_NO_ARTIFACTS=1` (added to `scripts/v0/golden.ts`) skips per-checkpoint
track/report files — a 20-budget × 4-variant sweep would otherwise write ~2 GB of
artifacts. The full curated dataset, R script, plots, and a per-file README live in
`generated/golden-runs/curve-analysis/`.
