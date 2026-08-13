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
| 2026-08-12 | Improvement-gated target search N=4/N=8 | continue to N=16 | N=4: +0.0407 scale, 85.78% directional probability. N=8: 571.1644→571.1826 (+0.0182, 81.86%), 750k +0.0078, unchanged 495/512 validity. Across 3,028 target pools the policy reordered 120 first branches. Terminal-offer target improvement rate rose 5.37 percentage points and repair-episode acceptance rose 0.29 points; 2.5M remained negative at -0.0964. `563cece` fixes a compact-projection omission that had made the first comparison's target-search counters appear as zero; N=8 directly verifies the corrected projection. The governed result remains `continue`, not promotion. |
| 2026-08-12 | Improvement-gated target search N=16 | inconclusive; retired | Scale 571.8682→571.8719 (+0.0037, 62.19% directional probability), 750k -0.0402, unchanged 989/1,024 validity. The arm reordered 244 of 5,904 target pools and materially improved local target-offer quality, but added only 5.48 aggregate internal-score points over 1,024 cells. It is approximately score-neutral and is not promoted. |
| 2026-08-12 | Explicit missing-target observation | complete | `5fd6df8`; Budget Telemetry V7 distinguishes a measured target from a terminal offer that lost the selected target contact. The N=16 V6 audit exposed 9 such terminals per arm, where null had incorrectly meant both “no terminal” and “target missing.” Behavior report V4 and scale mechanics V5 retain missing offers in rate denominators, report them separately, and reserve null for no terminal. Full suite: 183 files / 1,234 tests pass. |
| 2026-08-12 | Fresh V7 behavior validation | complete | Four-seed, eight-budget production reference: 981 repair episodes and 27,557 direct invariant checks with zero violations. V7 explicitly retained 8 terminal offers missing the selected target (none accepted), rather than folding them into “no terminal.” Of 963 terminal offers, 249 improved the selected target but were rejected globally. Evidence: `generated/benchmark-v2/scale/repair-policy-v7-reference-4-baseline{,.archive.json.checkpoint.jsonl}` and `repair-policy-v7-reference-4.behavior.{json,md}`. |
| 2026-08-12 | Working-track lineage and protected bridge | implementation complete; causal evaluation pending | Budget Telemetry V8 separates the true global incumbent, temporary working track, and terminal offer; records exact rejected-local follow-up disposition; and validates scheduled parent/child hashes, global target-state flow, and the one-step no-chain guard. `LR_REPAIR_REJECTED_LOCAL_BRIDGE=1` enables the diagnostic arm; the global register and final-output rule are unchanged. A deterministic 150k probe schedules and consumes rejected local improvements, then returns to the global incumbent. Full suite: 183 files / 1,236 tests pass. |
| 2026-08-12 | Open-repair hard-capture attribution | complete | The first fresh V8 scale attempt exposed a deterministic fail-closed edge case: a hard-budget snapshot can freeze an active repair before any terminal, before `endEpisode` finalizes its register/target state. The recorder now closes that censored snapshot explicitly as unchanged global state with no invented offer. The exact failing `frontier_pickup_progression` 500k/seed 14018 cell succeeds; full suite: 183 files / 1,237 tests pass. The partial scale artifact is not evidence. |
| 2026-08-12 | Protected rejected-track bridge | inconclusive; retired | Broad N=16: 571.8378 vs 571.8682 (-0.0304, 24.72% directional probability), 750k -0.0940. The V9 optimistic feasibility bound pruned rejected tracks that could not beat the incumbent even with a perfect mutable suffix; final N=16 was 571.8614 vs 571.8682 (-0.0068, 43.92%), 750k -0.0646, unchanged 989/1,024 validity. Across 3,821 candidate repairs, 0 invariant violations; 532 bridge episodes converted 134 global wins but displaced more-efficient ordinary work, reducing accepted repairs 1,719→1,623. Evidence: `repair-optimistic-bound-bridge-16.{comparison.json,behavior.md}`. No bridge policy is promoted. |
| 2026-08-12 | Current-controller repair breadth 3/4 | inconclusive; not promoted | The old repair-only narrowing result predates one-terminal independent repair. `repair-three-quarter` left initial/resumed production breadth and all anchor/scoring policy unchanged, then applied 0.75 after target-profile floors only while repair was active. N=16: scale 571.7370 vs 571.8682 (-0.1312, 21.99%), 750k +0.2817, unchanged 989/1,024 validity. The causal chain was strong and exact: first-terminal frames unchanged; samples -10.65%; mean episode cost -11.65%; episodes +11.53%; terminal evaluations +11.91%; accepted alternatives +2.09%; internal repair gain -2.85%. Throughput rose but marginal quality fell. |
| 2026-08-12 | Current-controller repair breadth 7/8 | inconclusive; not promoted; breadth bracket closed | N=16 scale 571.7461 vs 571.8682 (-0.1221, 19.48% directional probability), 750k +0.4713, unchanged 989/1,024 validity. All 121,625 repair audit checks passed. The arm reduced repair samples 5.17% and mean episode cost 6.37%, producing 5.28% more terminal alternatives, but accepted alternatives fell 0.47% and internal repair gain fell 2.25%. Together with the 3/4 arm, this closes global scalar repair breadth reduction: both interventions convert saved work into more, lower-yield attempts and regress the multi-budget objective despite positive 750k associations. Evidence: `generated/benchmark-v2/scale/repair-seven-eighth-16.{comparison.json,behavior.md}`. |
| 2026-08-12 | Reserve-next-repair anchor allocation | inconclusive; not promoted; scalar reserve family closed | Initial N=16 scale 571.8212 vs 571.8682 (-0.0470, 23.22% directional probability), 750k +0.2239. Correcting its last-repair rule improved the final scale estimate only to 571.8340 (-0.0342, 28.47%), with 750k +0.2275 and unchanged 989/1,024 validity. The corrected arm cut mean episode cost 8.90%, produced 11.36% more terminals and 9.25% more accepted alternatives, but internal repair gain fell 0.63%; 129,000+ replay/lineage checks passed with zero violations. Iterations 0–2 lost 51.79 aggregate internal-score points relative to production and later iterations recovered only 13.29: reserving future capacity displaced high-value early suffix scope to buy low-value late attempts. No iteration cutoff is inferred from this panel. Production keeps deepest-affordable allocation. Evidence: `repair-reserve-corrected-16.{comparison.json,behavior.md}`. |
| 2026-08-12 | Maximum parent depth eight | inconclusive; not promoted; fixed extension closed | N=16 scale 571.6816 vs 571.8682 (-0.1866, 15.37% directional probability), 750k -0.3384, unchanged 989/1,024 validity. The arm spent the same total repair work but completed 3.6% fewer terminals, accepted 4.7% fewer alternatives, and lost 2.9% aggregate internal repair gain. All replay and lineage invariants passed. Depth seven/eight value density was below depth six in the same arm. Evidence: `repair-max-parent-depth-8-16.{comparison.json,behavior.md}`. |
| 2026-08-12 | Density-guarded depth-eight boundary | inconclusive; retired and removed | N=16 scale 571.7776 vs 571.8682 (-0.0906, 15.98% directional probability), 750k -0.0449, unchanged 989/1,024 validity. Across 3,757 repairs, zero replay/lineage violations; total repair work stayed fixed, but terminals fell 2.4%, accepted alternatives 4.5%, and internal gain 1.5%. The higher measured selection density did not causally justify deeper work. The failed study-only compiler, telemetry, and scale-CLI surface was removed; production remains depth six. Evidence: `repair-density-guarded-depth-eight-16.{comparison.json,behavior.md}` and `benchmark/v2/studies/repair-depth-extension-study.json`. |
| 2026-08-12 | Distilled next-impact proposal controller | accepted and promoted | Same probe grid, proposal count, and ordinary admission set; the 32-tree distilled next-contact impact factor only reranks the fitted knob grid before exact evaluation. N=8 scale accepted at 579.5092 vs 571.1644 (+8.3448, 99.59% directional probability), with 7 validity gains and 5 losses across 512 cells. Canonical accepted at N=16: 605.8725 vs 602.5518 (+3.3207, 99.99%), 95% interval [+1.2940, +5.3474], unchanged 704/704 validity. Active baseline `distilled-aim-impact-feasibility`; record `benchmark/v2/studies/aim-impact-feasibility-promotion.json`. Candidate breadth is next; value-aware restart timing remains a separate later axis. |
| 2026-08-12 | Distilled aim-impact strength bracket | rejected | Global powers 0.75 and 1.25 changed only the accepted fitted-grid ranking factor. Both showed unstable low-budget rescue at N=4; power 1.25 reversed to -4.8420 scale points at N=8, lost one net validity cell, and was -1.0551 at 750k. Production power stays 1. Record `benchmark/v2/studies/aim-impact-strength-bracket.json`; next revisit the distinct mature aim-base breadth law under the promoted scorer. |
| 2026-08-12 | Repair breadth revisit after proposal promotion | inconclusive; not promoted | The conservative 7/8 repair-only arm again kept first-terminal work exactly unchanged. At N=16 it reduced requested proposals/call 5.01% and actual samples 2.22%, increasing repair terminals 3,802→4,009 and accepted alternatives 1,747→1,777. Yet aggregate internal repair gain fell 2.00% and multi-budget scale was 579.7672 vs 579.8494 (-0.0822, 24.91% directional probability), with unchanged 997/1,024 validity. Its isolated 750k delta was +0.2565, insufficient to override broad losses. All 3,839/4,045 repair episodes replayed with zero invariant violations. The promoted proposer did not reverse the marginal-quality failure; global scalar repair breadth reduction remains closed. |
| 2026-08-13 | Repeated-rejection step-later controller | inconclusive; not promoted; executable arm removed | N=16 scale 579.7958 vs 579.8500 (-0.0542, 7.43% directional probability), 750k +0.0680, unchanged 997/1,024 validity. All 209 activations reached distinct terminals and passed causal replay, but total repair work stayed flat while terminals rose only 14, acceptances fell 8, and aggregate internal repair gain fell 1.10%. Same target+anchor was not duplicate geometry; stepping later discarded useful mutable scope. The compiler/CLI intervention was removed while historical replay/report semantics remain. Evidence: `benchmark/v2/studies/repeated-rejection-step-later.json`. |
| 2026-08-13 | Fixed-cost aimed repair branch insurance | inconclusive; not promoted; executable arm removed | N=16 scale 579.8500→579.9288 (+0.0788, 95.02% directional probability), 750k +0.1457, unchanged 997/1,024 validity. At fixed first-terminal work and effectively fixed repair spend, terminals and acceptances rose 1.56% and internal repair gain 1.74%, but the score interval crossed zero and the gain was concentrated in `frontier_pickup_progression`. Evidence: `benchmark/v2/studies/repair-aim-branch-insurance.json`. Future work improves the promoted proposer on canonical V2 at 750k; no further scale sweep without explicit user request. |
