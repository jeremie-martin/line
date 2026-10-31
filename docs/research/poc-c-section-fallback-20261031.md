# POC C: a dead-ended section simplifies its own request (2026-10-31)

A rough proof of concept of approach C in compiler-framing-20261031.md, on
branch `poc-c-section-fallback` (from rework/foundations 7d39b2c5). A learning
experiment, not a candidate for adoption: no parity update, no sealed or
held-out run.

## Design

- **9-frame rule off.** `planIntentionalRepertoire` no longer calls
  `fitShapesToSections`. The plan is the plain lottery again.
- **Fallback at a dead end** (`arc_sequence.ts`). When no beam parent offers a
  candidate for section *i*, and the allowance is not exhausted, the search
  retries section *i* from the same beam with a simpler request:
  1. a shaped (or scattered) family becomes plain arcs with the same guidance
     and rail layout;
  2. guided plain arcs become plain arcs with no guide (`forbidden`, paired).

  If the simplest request still has nothing, it backtracks exactly as before.
- **No constants, no gates.** No threshold and no section-length rule. The
  retry is an ordinary section search: same local sampling formula, same
  meter, same allowance.
- **Recording.** The request is replaced in place in `constructionRequests` and
  `sectionStyles`, so later searches, refinement, guide pruning and the
  realization check all see what was asked of the ride. After the compile, the
  plan's requests are replaced with the realized ones and phrases are split
  where requests now differ (`splitPhrases`). Each fallback is recorded with the
  section, its length, from and to, the physics of the failed search, and
  whether the retry offered a candidate. Each section search is recorded with
  its physics and, per measured candidate, the physics by outcome (viable or
  rejection kind). These are in the cell's `geometry` (`fallbacks`,
  `attempts`, `candidatePhysics`).
- **Persistence.** A section's simplified request persists after a later
  backtrack. That never happened here: there were no backtracks at all.

## Runs

- `pocC-bench` (41 cells) and `pocC-pairs8` (32 cells), standard allowance.
- Baselines: remeasured under this branch's evaluator (`--jolt-ms=-15`):
  - `bench-minframes-20261031` and `pairs8-minframes-20261031` (HEAD, with the
    rule);
  - `bench-base-rm-20261031` and `pairs8-base-rm-20261031` (before the rule).
- The baselines have no geometry facts. I recompiled HEAD (7d39b2c5) on both
  panels in a scratch worktree to get them. Every track and frame count was
  identical to the minframes baselines (41/41, 32/32), so section 4 below is
  against that rerun.
- Adding the candidate-physics telemetry changed no track or frame count. I
  checked this by comparing a first run against the rerun (73/73 identical).

## Completion

| stratum | base-rm | minframes (HEAD) | POC C |
|---|---|---|---|
| bench G | 8/8 | 8/8 | 8/8 |
| bench P1 pairs | 5/6 | 6/6 | 6/6 |
| bench P2 words | 5/6 | 6/6 | 6/6 |
| bench P3 | 6/6 | 6/6 | 6/6 |
| bench P4 intense | 5/6 | 6/6 | 6/6 |
| bench P5 | 6/6 | 6/6 | 6/6 |
| bench P6 long | 3/3 | 3/3 | 3/3 |
| pairs8 P1 | 13/16 | 16/16 | 16/16 |
| pairs8 P2 | 14/16 | 16/16 | 16/16 |

C recovers all 8 rides that base-rm lost and loses none against HEAD. Every
cell is also fulfilled under the realized plan. C does not beat the rule on
completion; both are at the ceiling of these panels.

## Quality (cells complete in both arms)

- **Same tracks.** Where no fallback fires, C is the rule-free compiler, so its
  track is identical to base-rm. Against HEAD:
  - bench: 33 of 41 tracks identical. G, P3, P5 and P6 are unchanged.
  - pairs8: 12 of 32 identical.
- **Strata means, A − B (lower is better for every loss):**

  | ruler | bench vs HEAD | pairs8 vs HEAD | pairs8 vs base-rm |
  |---|---|---|---|
  | impact v3 loss (the optimized one) | −0.000 | −0.001 | −0.002 |
  | strike loss | +0.001 | +0.002 | −0.001 |
  | contact-impact loss | +0.002 | +0.002 | +0.002 |
  | R1 strength rms | +0.003 | +0.004 | −0.001 |
  | strong extras / beat (v3) | +0.000 | −0.000 | −0.003 |
  | strong arrivals inverted | +0.013 | +0.026 | +0.006 |
  | body drag s/min | +0.048 | +0.044 | −0.200 |

- **Per-spec seed signs (pairs8 vs HEAD).** A "+" seed is one where C is higher.
  - Amour words, the clearest: R1 strength rms is higher in 7 seeds and lower
    in none; strike and contact loss +6/−1. Impact v3 is flat (+4/−3).
  - Tiki pairs goes the other way on R1 strength rms (+1/−5). Its inverted
    strong arrivals are higher in 6 seeds and lower in none.
  - Elsewhere the signs are mixed.
- **Reading.** Against HEAD, impact v3 does not move, while the other rulers
  are slightly worse, concentrated on Amour words. This is small and not
  significant at these counts, but it is not a win. Against base-rm, on the
  rides both complete, C is a little better on most rulers.
- **Compile seconds** were about 40 s higher, but they are not comparable: the
  runs shared the machine with a parallel HEAD rerun and the remeasurement.

## Geometry (section 4, A = C, B = HEAD rerun)

- **Family shares** of ride time and of sections are equal to within 0.1 point
  on both panels. Distinct families per ride: bench 5.93 in both; pairs8 5.97
  against 5.94.
- **Short sections** (under 9 plan frames) still carrying a shape: bench 0;
  pairs8 0.06 per ride (2 sections in 32 rides). Every other short shaped
  section dead-ended and fell back.
- **Short guided arcs per ride:** bench 0.14 against 0.19; pairs8 0.47 against
  0.69. C ends with fewer guided sections than the rule, because some
  guided-arc retries also failed and dropped the guide.
- **Realized facts:** 100% fulfilled, no untouched guides and 100% of turns
  realized, in both arms.

## Accounting

Physics frames per compile over the allowance (budget = 1,700 × (ride frames +
21)):

| run | mean | min | max |
|---|---|---|---|
| C bench | 0.920 | 0.856 | 0.997 |
| HEAD bench | 0.921 | 0.856 | 0.997 |
| C pairs8 | 0.933 | 0.872 | 0.997 |
| HEAD pairs8 | 0.935 | 0.877 | 0.997 |

- No C compile spends markedly less. The lowest cells are tracks identical to
  HEAD (the same compile).
- A base-rm failure that spent 18% (Amour words 101, a `no_arc` stop) completes
  under C at a normal spend.
- The retry adds no budget. Each failed search before a fallback cost 10–14k
  frames, about 0.4% of a ride's allowance.

## How often the fallback fired, and where

- **bench:** 14 fallbacks in 8 of 41 rides, all in the P1, P2 and P4 short-pair
  specs. Every one was at a 9-frame section (search frames).
  - Shaped to guided arcs: 11 (fold 3, serpentine 2, scallops 4, terraces 2).
    8 were realized.
  - Guided arcs to no guide: 3, all realized.
- **pairs8:** 27 fallbacks in 19 of 32 rides. 26 were at 9-frame sections and 1
  at an 11-frame section.
  - Shaped to guided arcs: 20 (fold 7, serpentine 6, scallops 5, terraces 2).
    16 were realized.
  - Guided arcs to no guide: 7, all realized. 6 of the 7 were transfer layouts.
- No ride needed a backtrack: the section-search count equals the section count
  plus the fallback retries in every cell.

## Allowance spent on failed attempts

This splits physics inside measured candidates, viable against rejected, by the
requested kind and the section's search length. The numbers are from bench;
pairs8 is within a point or two.

| request | section length | rejected candidates | rejected share of candidate physics | main reasons |
|---|---|---|---|---|
| shaped | 9 | 93% | 91% | construction 52%, late release 20%, binding 12% |
| shaped | 10–13 | 65% | 55% | construction 26%, binding 14%, late release 12% |
| shaped | 14+ | 48% | 30% | construction 19%, binding 8% |
| guided arcs | 9 | 70% | 64% | construction 31%, late release 19% |
| guided arcs | 14+ | 37% | 23% | construction 16% |
| unguided arcs | 9 | 36% | 25% | late release 13%, binding 10% |
| unguided arcs | 14+ | 20% | 4% | binding 3% |

- **Short shaped sections.** About 91% of their candidate physics is wasted, but
  C caps it at one section search, so in total it is small: 9-frame shaped
  searches spent 0.34M of 130.8M frames on bench (0.26%).
- **The larger pool is long shaped and guided sections.** Rejected candidates
  are 17.6% of all ride physics (bench) and 17.3% (pairs8). Most of it is
  "construction" (binary fulfilment) rejections in shaped sections of 14 frames
  or more, about 13M frames on bench, roughly 10% of the allowance.
- **Feasibility is a curve.** It is visible here in every family: rejection
  falls with room. "Construction" is the largest reason at every length.

## What I learned

1. **C works for completion without any rule.** It matches the rule's
   completion on both panels and loses no ride, and the plan stays the plain
   lottery.
2. **A dead end does not say whether the request or the arrival is at fault.**
   In 7 sections C's guided-arc retry failed and it dropped the guide. HEAD
   realized guided arcs, mostly transfers, in those same sections. In two that I
   checked (Tiki words 707, Tiki pairs 707), the plan up to the section was
   identical and HEAD had dead-ended too. Its backtracking (1 and 12
   backtracks) found an earlier prefix whose arrival allowed the guided
   transfer. C gave up the guide instead of revising the arrival. So "simplify
   first" sometimes trades away a request that a cheap backtrack would have
   kept.
3. **Planning ahead has value the retry lacks.** With the rule, sections *i−1*
   and *i−2* are searched knowing section *i* will be guided arcs. Their
   future-value features include the next sections' families, and passive
   arrival keys on the next request. Under C they were searched expecting a
   fold. This may explain the slightly worse non-optimized rulers on Amour
   words, but I have not tested it.
4. **Short shapes almost never succeed** under this search: 2 of 22
   short shaped sections on pairs8 and 0 of 11 on bench. The rule's prediction is nearly always
   right on these panels. C's advantage is generality, not more shapes.
5. **The real waste is binary-fulfilment rejection in long shaped sections**
   (about 10% of the allowance), not short-section dead ends.

## What I would try next

- **Order the reactions by cost:** simplify the shape first, then try one
  shallow backtrack with the guide kept, and drop the guide last. A transfer
  that fails from one arrival often succeeds from another.
- **Let a fallback update the look-ahead:** after simplifying section *i*,
  re-search *i−1* once with the new request known, instead of only retrying
  *i*.
- **Graded fulfilment (A)** aims at the largest measured pool: 19–52% of
  shaped-section physics goes to construction rejections.

## What I could not verify

- Whether the owner sees any difference. The quality deltas are small, and no
  blind comparison was made.
- The cause of the worse Amour-words rulers. The look-ahead explanation is a
  hypothesis.
- How often HEAD backtracks per panel: cells do not record it. I checked only
  the two Tiki cases above, plus Amour words 707 (5 backtracks at HEAD).
- Held-out and sealed songs (not run, by instruction). The held-out failures
  (Circus, Trouble) are where C and the rule could differ most.
- `npm test`: `tests/benchmark_v6.test.ts` expects the planner to apply the
  rule and will fail on this branch. `npm run typecheck` is clean. Parity was
  not run; this is a behavioural change.

## Reproduce

Branch `poc-c-section-fallback`. Run directories `generated/eval/pocC-bench`,
`pocC-pairs8` and the remeasured `rm-*` baselines are in that worktree. Analysis
scripts were one-off and are not committed (WORKING.md).
