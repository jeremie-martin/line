# One-terminal adaptive repair: first results

> **Frozen evidence.** On 2026-08-11 the superseded multi-terminal controller,
> its study switch, and the dormant surgical-repair experiment were removed.
> This document describes the evidence that selected the clean-break starting
> point; it is not a current command reference.

## Status

The one-terminal adaptive repair allocator was implemented behind an explicit
study mode and selected by both the compact multi-budget campaign and the
governed 44-source canonical 750k comparison. One terminal with one try per
anchor became the production source default. `multi-terminal` no longer exists
as an executable reference mode; its immutable archives remain the reference.

This experiment is about a compiler that knows its hard budget before it
starts. It is not an anytime algorithm. The implementation and frozen protocol
are in `docs/one-terminal-adaptive-repair-experiment.md`.

## Retained evidence

The frozen multi-terminal reference contains 16 seed curves, eight sources, and eight hard
budgets (1,024 runs):

- manifest:
  `generated/benchmark-v2/scale/repair-adaptive-v3-reference-16.json`;
- archive:
  `generated/benchmark-v2/scale/repair-adaptive-v3-reference-16.archive.json`.

The selected one-try arm was extended without recompiling completed curves:

- 4 seeds: `generated/benchmark-v2/scale/repair-adaptive-1try-4.json`;
- 8 seeds: `generated/benchmark-v2/scale/repair-adaptive-1try-8.json`;
- 16 seeds: `generated/benchmark-v2/scale/repair-adaptive-1try-16.json`;
- final comparison:
  `generated/benchmark-v2/scale/repair-adaptive-1try-16-comparison.json`.

The two-tries-per-anchor contrast is retained at four seeds:

- archive: `generated/benchmark-v2/scale/repair-adaptive-2try-4.json`;
- comparison:
  `generated/benchmark-v2/scale/repair-adaptive-2try-4-comparison.json`.

The governed canonical evidence is retained twice:

- explicit study mode:
  `generated/benchmark-v2/eval/repair-adaptive-one-terminal-N48-comparison.json`;
- environment-free production default:
  `generated/benchmark-v2/eval/repair-adaptive-production-default-N48-comparison.json`;
- promoted immutable copy:
  `benchmark/v2/runs/one-terminal-adaptive-repair-750k-comparison.json`.

The two governed candidate archives are cell-for-cell identical across all 352
executed rows: track, score, report, statistics, and V3 telemetry. The promoted
compiler-bound source commit is `9616153`.

Every raw and compressed archive checksum passed. All 1,024 final candidate
payloads use `line.compile-budget-telemetry.v3`; hard-budget, execution-interval,
episode-work, candidate-mode, register-offer, terminal-node, terminal-geometry,
and evaluation-origin identities close. The final arm contains 4,186 frontier
repair episodes: 4,123 reached exactly one terminal and returned to the
allocator; 63 were correctly retained as censored observations. No episode
exceeded the one-terminal limit.

## Score observations

The predeclared sequential comparison preferred the candidate at eight seeds:

| quantity | result |
|---|---:|
| reference scale headline | 570.2114 |
| candidate scale headline | 570.6490 |
| paired delta | +0.4376 |
| directional probability | 99.43% |
| required boundary | 99.1667% |
| validity | 495 / 512 in both arms |
| 750k delta | +0.3609 |

Source: final comparison `result`, which stops at the first decisive declared
look. The later seeds do not rewrite that decision.

All 16 executed seed curves provide post-decision characterization:

| budget | paired scale delta |
|---:|---:|
| 150k | +0.0645 |
| 250k | +0.5764 |
| 500k | +0.4745 |
| 750k | +0.4443 |
| 1M | +0.4778 |
| 1.5M | +0.5960 |
| 2.5M | +0.1617 |
| 4M | +0.6478 |

The full descriptive scale delta is +0.4304 with a seed-curve jackknife 95%
interval of [+0.2850, +0.5758]. Validity is identical at 989/1,024. Every one
of the eight source aggregates is positive, from +0.0403 (`amplitude_tides`) to
+0.7788 (`offgrid_conversation`). Nine of 64 source-budget summaries are
negative; the largest is −0.4839 for `frontier_low_air_endurance` at 2.5M.
There are no source-budget validity changes. Source: final comparison
`requestedDepthCharacterization` and the two 16-seed run archives.

These 16-seed statistics are characterization after the sequential boundary
was crossed. They are not a second independent promotion test.

## Direct mechanics observations

The mode is byte-identical through the first terminal. Mean charged work to the
first terminal is exactly 720,788.50 frames in both arms over the 989 completed
paired cells (`mechanics.overall.metrics.firstTerminalFrames`). Everything
below is therefore post-first-terminal behavior.

### Allocation and breadth of repair

Per compile means over the 1,024 paired cells:

| metric | multi-terminal reference | adaptive | change |
|---|---:|---:|---:|
| repair episodes | 2.521 | 4.088 | +62.1% |
| distinct repair anchor gaps | 2.454 | 3.895 | +58.7% |
| mean repair anchor gap | 72.09 | 80.33 | +8.24 gaps |
| mean upstream offset | 2.705 | 2.166 | −19.9% |
| mean first-terminal work per completed episode | 183,678 | 133,249 | −27.5% |
| mean spent work per repair episode | 230,383 | 135,592 | −41.1% |
| total repair work | 628,583 | 624,409 | −0.66% |
| repair share of compile work | 39.39% | 38.89% | −0.51 points |

Source: final comparison mechanics metrics `repairEpisodes`,
`repairDistinctAnchorGaps`, `repairMeanAnchorGap`,
`repairMeanAnchorUpstreamOffset`, `repairMeanFirstTerminalOffsetFrames`,
`repairMeanSpentFrames`, `repairTotalSpentFrames`, and
`repairSpentWorkShare`.

This directly confirms the proposed mechanism. The candidate does not gain by
removing repair work. It spends almost the same repair frames in more, shorter
episodes and returns to the allocator between terminals. The sum of episode
allocations rises 23.4% while actual repair work falls slightly: early return
hands unused local capacity back instead of consuming every local ceiling.

### Terminal work and improvement value

Across the complete compile, not just one episode:

| metric | multi-terminal reference | adaptive | change |
|---|---:|---:|---:|
| terminal evaluations | 59.65 | 10.94 | −81.7% |
| distinct terminal geometries | 35.19 | 6.32 | −82.0% |
| repeated terminal evaluations | 24.46 | 4.62 | −81.1% |
| repeated-terminal rate | 40.25% | 28.56% | −11.69 points |

Source: final comparison mechanics metrics `terminalNodeEvaluations`,
`distinctTerminalTracks`, `repeatedTerminalTrackEvaluations`, and
`repeatedTerminalTrackRate`. These are compile-global geometry identities and
therefore detect repeats across episode boundaries.

The adaptive arm evaluates far fewer complete alternatives, but the selected
improvements have more value:

| metric | multi-terminal reference | adaptive | change |
|---|---:|---:|---:|
| repair terminal register improvements | 1.927 | 1.798 | −6.7% |
| episode improvement rate | 46.13% | 44.36% | −1.77 points |
| internal full-score gain | 4.624 | 5.056 | +9.3% |
| selected weak-gap SSE gain | 0.0959 | 0.1075 | +12.1% |
| final output lineage is repair | 72.66% | 82.23% | +9.57 points |

Source: `repairTerminalRegisterImprovements`,
`repairEpisodeImprovementRate`, `repairInternalFullScoreDelta`,
`repairWeakGapSseImprovement`, and `finalOutputFromRepair`.

Repair terminal improvements per million charged repair frames improve 4.3%
overall, and internal full-score gain per million improves 7.9%. The terminal
improvement-rate change is not uniform by budget; it is negative at several
middle/high budgets even though authored score improves. The evidence supports
“fewer, larger or better-directed accepted improvements,” not “every repair
attempt becomes more likely to succeed.” Internal full score is diagnostic and
is not Benchmark V2 score.

Episode-level distinct/repeated geometry is deliberately not used to claim
cross-repair diversity. A one-terminal episode has no opportunity to repeat a
track inside itself. Only the compile-global identity figures above support the
duplicate-evaluation claim; V3 does not separately attribute compile-global
geometry repeats by lane.

### Candidate work

The adaptive arm makes 30.2% fewer ranked-option pool calls and requests 33.3%
fewer normal proposals, while requested proposals per call are nearly flat
(−0.28%). Nevertheless, exact actual normal samples rise 1.50%, viable samples
rise 3.27%, and viability rate rises from 60.10% to 61.03%. Source:
`rankedOptionPoolCalls`, `requestedNormalProposals`,
`requestedNormalProposalsPerRankedOptionCall`, `normalCandidateSamples`,
`viableCandidates`, and `viableCandidateRate`.

This is a direct observation, not evidence of a cache regression. A
ranked-option call is not a normal-prefix cache miss. Actual samples also cover
internal rollout sampling, retry behavior, extra streams, and optional sibling
geometry. V3 does not count normal-prefix cache hits/misses, so the present data
cannot attribute the extra 1.5% to one of those causes. A cache-efficiency study
must instrument the cache boundary explicitly.

### Completion estimator and affordability

The repair-start estimator remains usable under the new anchor distribution:

| metric | production | adaptive | change |
|---|---:|---:|---:|
| signed error, actual − estimate | +882 | +872 | −10 frames |
| absolute error | 6,695 | 5,441 | −18.7% |
| absolute relative error | 5.66% | 6.44% | +0.78 points |
| empirical interval coverage | 92.69% | 92.24% | −0.45 points |
| completed inside allocation | 93.58% | 93.48% | −0.10 points |
| summed episode overrun | 13,265 | 1,649 | −87.6% |
| censored repair episodes | 0.0615 | 0.0615 | unchanged |

Source: final comparison mechanics estimator, allocation, overrun, and censor
metrics. Error is computed only for completed episodes. The shorter adaptive
suffixes reduce absolute error but make the same error a larger fraction of
completion work. Coverage and within-allocation completion are essentially
unchanged; the allocator sharply reduces atomic work beyond local ceilings.

## One versus two alternatives per anchor

At the shared four-seed look, one try per anchor scores +0.2447 against the
multi-terminal reference; two tries score +0.1887. The one-try arm is also better at 750k
(+0.2439 versus +0.0680) and 4M (+0.5283 versus −0.1933). Total repair work is
almost identical. One try visits 3.883 distinct anchor gaps per compile versus
3.617 for two tries, has slightly higher repair efficiency and internal gain,
and produces final repair lineage in 84.38% versus 83.59% of cells.

Source: the two four-seed comparison artifacts. This is a small declared
mechanism contrast, not a powered head-to-head preference test. It supports the
hypothesis that returning quickly and diversifying anchors is more useful than
immediately retrying the same anchor, but does not prove that one try is optimal
for every budget or incumbent state.

## Interpretation

Direct observations:

- first-terminal work is unchanged;
- the same post-terminal work is divided into more affordable suffixes;
- compile-global terminal churn and duplicate geometry evaluation fall sharply;
- fewer terminal improvements yield greater internal and authored score gains;
- score and validity improve broadly on the compact multi-budget surface.

Statistical association:

- the eight-seed paired scale comparison crosses its predeclared candidate
  boundary;
- the complete 16-seed characterization remains positive at every budget and
  for every source aggregate.

Working hypothesis:

- a long frontier episode spends heavily enumerating complete suffixes under a
  stale allocation decision;
- returning after one terminal lets current incumbent weakness, affordability,
  remaining budget, and a fresh deterministic seed select the next suffix;
- that selection produces fewer but better-directed accepted repairs.

Not established:

- which normal-prefix cache behavior causes the actual-sample increase;
- cross-repair geometry duplication by lane;
- that one alternative per anchor is globally optimal;
- the best next allocator policy beyond the promoted one-try rule.

## Disposition and next work

Retain `one-terminal-adaptive` with one try per anchor as the selected repair
candidate. Do not retain the two-try arm as the leading configuration.

Promotion evidence and closure:

1. The governed N=8 44-source comparison accepted at +0.44 headline, seed-block
   SE 0.09, P(+) 99.93% against a required 99.90%.
2. Validity remained 352/352 in both arms; representative, capability,
   legacy-regression, and development-music strata were all positive.
3. The source default was changed only after that decision. An environment-free
   confirmation, production determinism, and the full test gates close the
   promotion.

After that validation, the next repair experiments should change one allocator
decision at a time: anchor utility (weak-gap opportunity versus estimated
completion work), estimator calibration for short late anchors, and a
state-dependent rule for repeating an anchor only when its measured marginal
value justifies it. They should reuse the same strict V3 telemetry and compact
multi-budget pairing rather than tune on individual tracks.
