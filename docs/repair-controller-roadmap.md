# Repair controller clean-break roadmap

## Objective

Replace the historical frontier-repair family with one production repair
controller whose unit of work is a self-contained iteration:

```text
current incumbent
→ remaining hard budget
→ current cost-to-end profile
→ affordable target/anchor under explicit headroom
→ one complete alternative suffix
→ register decision
→ recompute from scratch
```

The controller knows the compile's hard budget. It is not an anytime
algorithm. The authored specification and ordinary compiler register remain
the optimization contract; the completion estimator is diagnostic and sizes
work but never rewrites authored targets.

## Settled terminology and semantics

- **incumbent**: current best complete track under the compiler register;
- **repair iteration**: one anchor decision and at most one complete suffix;
- **target gap**: incumbent gap selected for improvement;
- **anchor gap**: prefix position from which the suffix is regenerated;
- **parent depth**: actual target-to-anchor distance for one iteration;
- **maximum parent depth**: declared cap on the anchors one decision prices;
- **repair headroom**: explicit multiplier applied to the estimator's upper
  completion-cost bound;
- **terminal reached**: a complete alternative was evaluated; this says
  nothing about validity or adoption;
- **accepted alternative**: the register replaced the incumbent.

Do not use `allocator`, `adaptive`, `repair completed`, `unique terminal`, or
`candidate count` without the population being named precisely.

## Non-negotiable invariants

1. Production has one repair architecture and no mode switch.
2. One repair iteration evaluates at most one terminal alternative.
3. Every iteration recomputes its target and anchor from the current incumbent,
   current remaining budget, and current cost profile.
4. No ancestor walk, failed-anchor fallback chain, or exhaustion state carries
   policy decisions between iterations.
5. The actual anchor—not merely the target gap—must pass affordability.
6. Censored iterations are never estimator-completion observations.
7. Every charged frame, candidate sample, node evaluation, register offer, and
   terminal evaluation belongs to an exact lane and iteration.
8. A fresh seed is not treated as evidence of geometric diversity. Diversity
   is measured from incumbent, offer, arc, and suffix identities.
9. V1–V3 telemetry artifacts remain immutable historical evidence. Semantic
   changes use V4; no compatibility aliases or fallback interpretations.
10. Cleanup and observability changes must preserve current production output
    exactly before the new anchor policy changes behavior.

## Milestone 1 — behavior-preserving architectural cleanup

- Extract the repair policy primitives from the large handoff implementation.
- Remove the `multi-terminal` production/study branch, frontier-mode parsing,
  adaptive-tries surface, and mode-dependent scale-runner scaffolding.
- Audit default-off surgical and legacy repair branches. Remove code that
  cannot participate in the new controller and retain historical conclusions
  in documentation rather than executable production code.
- Rename the surviving one-terminal path as ordinary repair.
- Temporarily isolate the four-ancestor strategy so it can be replaced in one
  subsequent behavioral commit.
- Prove byte-identical outputs for the production default and pass all focused
  and repository tests.

Exit gate: a single one-terminal code path, no live old-mode switch, current
baseline behavior unchanged.

## Milestone 2 — repair-native telemetry V4 and reporting

V4 records one exact repair-decision object and one exact execution episode per
iteration. It adds:

- incumbent track hash at start;
- remaining hard budget;
- estimator profile identity and headroom;
- considered target/anchor candidates with affordability and rejection reason;
- selected target gap, anchor gap, parent depth, weakness, point/upper cost;
- search seed and candidate-stream work by lane;
- terminal-offer track hash;
- equality with incumbent, first divergent gap, and changed suffix-arc count;
- terminal reached separately from accepted alternative;
- register keys before/after, work, censoring, and final-output lineage.

Metric audit:

| Historical term | Exact V4 term/handling |
|---|---|
| `policyCandidateCount` | `meanRequestedNormalProposalsPerRankedOptionCall`, reported by lane |
| `candidatesSampled` | `actualCandidateSamples`, split by stream and lane |
| `fullTerminalEvaluations` | `terminalNodeEvaluations` |
| `uniqueFullTerminalEvaluations` | `firstTimeTerminalNodeEvaluations`; never trajectory diversity |
| `duplicateFullTerminalEvaluations` | `revisitedTerminalNodeEvaluations` |
| `repair completed` | `terminalReached`; never implies valid or accepted |
| `accepted_improvement` | `acceptedAlternative`, defined by register adoption |

Reporting adds a reproducible source×budget matrix and plots for score effect,
repair work, path divergence, duplicates, and estimator calibration.

Exit gate: schema/accounting identities close on golden fixtures and a compact
multi-budget diagnostic; every important report claim is reproducible from a
named V4 field.

## Milestone 3 — independent budget-aware repair iterations

For every iteration:

1. Read the incumbent and remaining hard budget.
2. Rebuild/update cost-to-end measurements when the incumbent changed.
3. For every target `g`, price anchors `g - d` for `d = 0..maximumParentDepth`.
4. Require an anchor to satisfy
   `estimatedUpperCompletionCost(anchor) <= floor(remaining × (1 - repairHeadroomFraction))`.
5. Among targets with at least one eligible anchor, select the largest
   axis-error SSE, then choose that target's deepest eligible anchor.
6. Regenerate one suffix from that one anchor and return after one terminal.
7. Offer it to the register, record the result, discard iteration-local policy
   state, and return to step 1 whether accepted or rejected.

The initial production candidate used fixed parent depth 1. The governed
follow-up bracketed fixed depths 1–3 and headroom 0–20%; retained reference
evidence then motivated a single deepest-affordable policy capped at depth 4.
A bounded boundary extension subsequently accepted depth 6 at the N=8 scale
look. This is decision-time pricing, never an execution fallback walk.

Exit gate: no ancestor walk or cross-iteration failed-anchor state remains;
tests prove recomputation after accepted and rejected alternatives.

## Milestone 4 — diversity evidence and intervention

Measure same-anchor frequency, incumbent-identical offers, candidate-stream
overlap, first divergent gap, changed suffix arcs, repeated terminal geometry,
and accepted divergent alternatives across budgets.

If fresh deterministic sampling does not provide adequate diversity, compare
one explicit mechanism: a deterministic alternative cursor or exclusion of the
incumbent's first regenerated arc. Do not infer diversity from seeds alone.

Exit gate: direct empirical evidence supports the retained diversity mechanism.

## Milestone 5 — governed evaluation and follow-ups

1. Focused determinism, semantic, accounting, and estimator tests.
2. Four-seed multi-budget mechanism diagnostic.
3. Governed 4/8/16 scale comparison with paired seed curves.
4. Complete statistical report and plots.
5. Canonical 750k evaluation only for a broadly favorable scale candidate.

After this controller is stable, revisit suffix-DFS policy and candidate
breadth. Breadth evidence collected under the removed repair economy is not
authoritative for the new controller.

## Progress ledger

| Date | Milestone | Status | Evidence / commit |
|---|---|---|---|
| 2026-08-11 | Roadmap frozen | complete | `b3387db` |
| 2026-08-11 | Remove competing controller modes | complete | `7f1aaa7`; one-terminal production path hardwired; 75 focused tests pass |
| 2026-08-11 | Remove obsolete surgical repair | complete | `43d0b94`; executable branch, stats surface, and live guidance removed; 125 focused tests pass |
| 2026-08-11 | Telemetry V4/reporting | complete | `78cab6b`; clean-break schema and exact work/outcome/divergence semantics; 178 test files / 1,207 tests pass |
| 2026-08-11 | Independent repair loop | complete | `ec7632c`; fixed parent depth 1, explicit 20% headroom, per-incumbent cost profiles, no ancestor/exhaustion state; 95 focused tests pass; live 500k probe reached 4/4 divergent terminals and accepted 1 |
| 2026-08-11 | Diversity validation | complete | Four-seed depth-1 arm: 1,373 terminal alternatives, 1 geometry-identical, 496 accepted, 0 accepted-identical; mean 14.90 divergent suffix gaps. No exclusion/cursor intervention needed |
| 2026-08-11 | Governed evaluation | complete | Final deepest-affordable N=16 scale delta +0.0316 (62.94% directional probability), 750k +0.2904, no validity changes; governed outcome inconclusive. The policy is approximately score-neutral at this resolution |
| 2026-08-11 | Behavioral audit | complete on initial N=4 arms | Reproducible audit over 3,559 repair iterations: 68,619 direct invariant checks, zero violations. After rejection, affordable sets only shrank; all 660 still-affordable worst targets were retained. Depth 2 reached 1,126/1,138 terminals, produced no incumbent-identical terminal, and improved the selected gap on 391/451 accepted alternatives |
| 2026-08-11 | Decision/identity evidence closure | complete | V4 retains every target's weakness and every priced target×anchor option, point/upper cost, source, and affordability plus incumbent/terminal-offer hashes. Payload validation replays the target/anchor choice and cross-checks direct geometry identity. A depth-2 500k probe replayed 6/6 decisions and chained accepted incumbent hashes exactly |
| 2026-08-11 | Fixed-depth/headroom bracket | complete | N=8 deltas versus retained reference: depth-2 headroom 0% -0.5089, 10% -0.5972, 20% -0.8348. All controller audits pass; scalar headroom interpolation is exhausted |
| 2026-08-11 | Reference depth attribution | complete | In 2,123 paired N=8 reference episodes, depth 4 supplied 1,826/2,411 internal-score gain; mean depth fell 3.68→2.90→1.93→1.27 over iterations 0–3 as budget shrank. Follow-up retains one independent execution but selects the deepest affordable parent up to 4 |
| 2026-08-11 | Deepest-affordable N=4 diagnostic | complete | Scale delta +0.0664 (63.96% directional probability), 750k +0.3480. The 994-iteration audit replayed every decision and hash with zero invariant violations. Mean depth fell 3.67→3.19→2.06→1.38→0.87 over iterations 0–4; 519 decisions used depth 4 and 475 went shallower because deeper anchors exceeded remaining budget |
| 2026-08-11 | Behavioral decomposition V2 | complete | `a3f0d1e`; outcomes are reproducible by budget, source, parent depth, and iteration, with exact repeated-offer identity and affordability attribution. The first repair iteration matches the retained reference exactly. The candidate used nearly equal repair work, made 50 fewer attempts and 21 fewer acceptances, but gained 1,148.1 versus 1,129.9 internal-score points |
| 2026-08-11 | Deepest-affordable N=8 look | complete | Scale delta -0.0524 (36.35% directional probability), 750k +0.3428, no validity changes in 512 paired cells. Across 2,003 iterations, 49,380 invariant/attribution checks passed. The policy used 0.17% more repair work than reference, attempted 5.65% fewer repairs, selected 9.38% deeper parents, and produced 6.53% longer divergent suffixes; internal repair gain was 1.35% lower |
| 2026-08-11 | Deepest-affordable N=16 look | complete | 1,024 paired cells; scale 571.1404 vs 571.1088 (+0.0316), 750k +0.2904, 989/1,024 valid in both arms. Across 3,974 repairs, 97,976 replayed checks passed with zero violations; 3,881/3,919 offers were distinct, and identical-terminal work was 0.038% of repair frames |
| 2026-08-11 | Large scale evidence recovery | complete | All 1,024 cells recovered from the checkpoint after monolithic JSON exceeded V8's string limit. Checkpoint loading, archive/gzip output, and checksum verification are streaming; a checksummed compact projection supports bounded-memory comparisons |
| 2026-08-11 | Behavioral foundation promotion | complete | Promoted the independent controller as the production architecture and next scale reference, without relabeling its inconclusive score result as `ACCEPT`; machine-readable record in `benchmark/v2/studies/repair-controller-foundation.json` |
| 2026-08-11 | Three-iteration allocation bracket | rejected | N=4 scale -0.1986 (0.69% directional probability), 750k -0.0488, unchanged validity. It moved 15.81M repair frames into 13.00M additional resumed work, but the resume recovered only 1.93 of 51.51 removed internal-score points; no N=8 extension |
| 2026-08-11 | Maximum parent-depth bracket | accepted and promoted | Scale accepted at N=8: +0.5128, 99.54% directional probability above the 99.17% boundary, unchanged 495/512 validity. Canonical 750k accepted at N=32: 602.4958→602.9306 (+0.4348), 99.20% above the 98.88% boundary, lower bound +0.0164, unchanged 1,408/1,408 validity. Across 1,947 repairs, 47,944 replayed checks passed and 1,902/1,918 terminal offers were globally distinct. Active baseline `independent-repair-depth-six`; evidence record `benchmark/v2/studies/repair-depth-six-promotion.json` |
| 2026-08-12 | Target-aware suffix search bracket | ungated arms retired; gated follow-up ready | `b568859` added top-three and eligible-pool target ordering. Top-three N=8: scale 571.1644→570.9882 (-0.1762, 7.84% directional probability), 750k +0.1744, unchanged 495/512 validity; losses at six of eight budgets, so no N=16 extension. Eligible-pool N=4: -0.4944 and retired. `90f84fc` adds the parameter-free `target-improvement-first` follow-up, which intervenes only when ordinary branch zero fails to lower incumbent target SSE and another ordinary selected branch does; 91 focused tests pass. |
| 2026-08-12 | Terminal-offer target attribution | complete | `c470beb`; Budget Telemetry V6 cleanly separates `incumbent_target_gap_before`, `terminal_offer_target_gap`, and `incumbent_target_gap_after`. The prior 39.4% “all terminal alternatives” interpretation was invalid because V5 measured the post-register incumbent, making rejected offers appear unchanged. Behavior report V3 and scale mechanics V4 now measure offer quality directly, count rejected local improvements, and audit accepted/rejected target-state lineage; 116 focused tests pass. |
