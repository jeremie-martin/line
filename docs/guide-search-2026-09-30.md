# Improving the accuracy–guidance tradeoff

The owner authorized improving both the search for arc alternatives and the
matched evaluation of those alternatives. This work keeps the frozen benchmark,
scorer, detector, normal-line physics, and geometry family unchanged. It adds no
artist-facing specification controls and does not treat fewer guides as a
universal aesthetic objective.

## Questions and evaluation plan

The existing exploration follows one complete track, choosing guide count before
accuracy at each fork. In its 204 recorded forks, that choice had worse RMS error
than the best available continuation 150 times; 102 choices worsened accuracy
relative to the source. All alternatives were retained for delivery, but only
one informed subsequent exploration. Of the 408 branch compilations, 82 reported
budget exhaustion. These observations motivate testing both better use of known
controls and a small frontier of different continuations.

Development uses the six existing gallery passages and previously exposed seeds
231/232. The first pilot compares the original traversal, source-control memory,
a two-path traversal retaining the most accurate and least-guided results, and
the combination. Every variant pays for its reference, both sides of every fork,
prefix checks and cold replays inside the same total physics allowance. Independent
fixed-judge observation is recorded separately; wall times on the shared host are
not controlled throughput measurements.

Before final evaluation, select and freeze promising implementations using only
development results. Evaluate on fresh search-jitter seeds 241–248, on all six
passages, at total allowances of 450,000 and 900,000 physics frames. These are
new random search perturbations on reused authored passages, not unseen musical
families. Preserve all attempts, including failures and regressions.

Compare the search portfolios in both directions:

- At a common absolute error ceiling (the baseline's best error plus the same
  fixed allowance), measure guide count, guide length and feasibility.
- At the same guide-count cap, measure best target error and feasibility.
- Separately report best accuracy, unchanged V4 adherence on these research
  passages, actual physics work and compile time.

Use fixed extra-error allowances 0, .005, .010, .020, .040 and .080, and guide-count
caps 0%, 25%, 50%, 75% and 100% of support sections (rounded down). Report missing
feasible choices explicitly; averages over mutually feasible comparisons include
their comparison counts. Comparing each method against its own best error plus
an allowance would change the absolute accuracy requirement and obscure losses.
No new aggregate benchmark score or categorical per-case gate is introduced.

The raw alternatives, unsuccessful experiments and validation artifacts remain
local under `generated/guide-search-20260930/`. The committed evidence contains
the [fresh-seed comparison](evidence/guide-search-20260930.json),
[development experiments](evidence/guide-search-20260930-development.json),
[canonical parity](evidence/guide-search-20260930-production.json), and
[validation](evidence/guide-search-20260930-checks.json), with SHA-256 sidecars.

## Frozen candidate for the fresh-seed comparison

Development comprised staged experiments on seeds 231/232, all at 900,000 frames.
The independently reconstructed baseline reproduced all 108 seed-231 alternatives
exactly, including geometry hashes, target error and physics work.

Keeping only the most accurate and least-guided paths exposed a coverage problem
between those extremes. Supplying source controls directly at each continuation
improved some accurate tracks but worsened intermediate guide-count choices.
General source-control memory was also mixed. These remain explicit research
ablations; they are not enabled in the recommended candidate.

The candidate instead:

1. Builds a guided reference and an independently optimized guide-forbidden
   reference, each with the same quarter-budget ceiling (capped at 250,000).
2. Keeps the most accurate complete track and a second path offering the smallest
   measured RMS-error increase per removed guided section. If no track removes a
   guide relative to the accuracy winner, it uses the least-guided alternative.
3. Reconsiders all already measured tracks when selecting those two paths, so an
   intermediate alternative can become useful after the accuracy winner changes.
4. Searches both guide permissions from each selected physical prefix, with equal
   branch ceilings and all work charged to the original total allowance.

The ratio in step 2 is an exploration heuristic. Delivery still applies the same
explicit error ceiling and guide preference; no new scoring function is used.
Independent unguided references expand the measured range to zero guides in all
12 development case/seed combinations, versus 5/12 for the old traversal. The
candidate's best-error mean is 0.032813 versus 0.034161, and corresponding research
adherence is 877.745 versus 873.319. At baseline-best +0.020, mean guide count is
3.00 versus 3.75. At +0.010 it is unchanged at 4.833; the half-guide-cap RMS mean
is slightly worse on mutually feasible comparisons. This is a mixed improvement,
not dominance at every point of the tradeoff.

One compiler coupling was also removed: an explicitly disabled guide's nominal
clearance no longer changes the unguided initialization. A physical regression
check confirms identical tracks and work for channels 0 and 24 when guides are
forbidden. Guided production initialization remains identical.

The candidate was frozen at **`0f0da680`** before inspecting seeds 241–248. Compare the original
compiler at `9b824676`, this candidate, and the same candidate with source-control
memory as a declared diagnostic ablation. The candidate without memory is the
preselected recommendation: development memory improved best accuracy but caused
large losses in part of the intermediate guide-count range. Fresh-seed findings
will determine the strength and limits of the recommendation; they will not be
used to tune this implementation. No compiler changes followed that freeze.

## Fresh-seed results

All 288 portfolios completed: six passages × eight seeds × two total-work
ceilings × three variants. They contain 8,442 attempts, including seven failed
continuations (three candidate, four memory ablation). Those failures remain in
the evidence and were excluded from delivery. Every portfolio contains a valid
complete ride. Every emitted line is normal; all actual construction work,
including unsuccessful attempts, fits the declared allowance.

The following compares the preselected candidate with the original compiler.
Each entry covers the same 48 passage/seed combinations. Adherence is the frozen
V4 score applied to these research passages, **not the canonical V4 headline**.

| Measurement | 450,000 frames: original → candidate | 900,000 frames: original → candidate |
| --- | ---: | ---: |
| Mean best target RMS | 0.035070 → 0.034138 | 0.032655 → 0.029850 |
| Corresponding mean adherence | 870.346 → 873.364 | 878.627 → 888.148 |
| Better / worse / tied best RMS | 22 / 14 / 12 | 30 / 13 / 5 |
| Mean guided sections at baseline-best RMS +0.020 | 3.854 → 2.583 | 3.479 → 2.229 |
| Valid zero-guide alternatives found | 8/48 → 48/48 | 13/48 → 48/48 |
| Mean actual construction frames | 442,462 → 444,527 | 852,217 → 886,487 |

At 900,000 frames, mean best RMS falls **8.59%**. The seed-block 95% bootstrap
interval for candidate minus baseline RMS is **[−0.004342, −0.001138]**.
At 450,000 it is **[−0.002509, +0.000532]**: a smaller observed gain whose
uncertainty includes no improvement. These are descriptive intervals over
eight search-jitter seeds on this fixed passage panel, not evidence about
unseen music or corrections for multiple exploratory comparisons.

Both methods face the **same absolute accuracy requirement** in the guide-count
comparison, rather than each receiving its own moving reference. At +0.020 all
48 comparisons are feasible at both budgets. The mean guide-count differences
are −1.271 (95% interval −1.792 to −0.875) and −1.250 (−1.750 to −0.813).
This preference deliberately permits some accuracy loss; it has not become a
production tolerance. At +0.010 and 900,000 frames all 48 are feasible and mean
guide count changes from 4.667 to 4.250. At that tighter ceiling and 450,000
frames, three candidate portfolios cannot match the requirement; they are
reported as infeasible rather than silently averaged away.

Fixing guide count instead exposes remaining weaknesses:

| Guide cap at 900,000 frames | Original feasible | Candidate feasible | Original → candidate RMS on mutually feasible pairs |
| --- | ---: | ---: | ---: |
| None | 13/48 | 48/48 | 0.062843 → 0.054333 (13 pairs) |
| 25% of support sections | 30/48 | 48/48 | 0.058825 → 0.047772 (30 pairs) |
| 50% of support sections | 47/48 | 48/48 | 0.048490 → 0.049429 (47 pairs) |
| 75% of support sections | 48/48 | 48/48 | 0.036590 → 0.033920 (48 pairs) |

Caps are rounded down. Different rows have different mutually feasible subsets,
so these means must not be read as one common curve. The half-guide cap is
**slightly worse**, with a delta interval spanning −0.004049 to +0.005659.
At the original best-error ceiling, the candidate cannot match 13 of 48 runs
at 900,000 frames. Keeping more search paths does not guarantee dominance.

The accuracy gains are concentrated: quiet-tail mean best RMS improves from
0.050588 to 0.035293 at 900,000 frames; the other five passages together improve
only about 0.000307 on average. Alternating-lift and slow-swell have small mean
losses. At 450,000, staccato-release worsens from 0.029165 to 0.034597. The
independent zero-guide search makes that option available, but it does not make
it equally accurate: quick-pickups' zero-guide RMS is about 0.1075 at 900,000,
versus 0.0299 for its best unrestricted result. No physical ceiling is inferred.

The declared source-memory ablation remains mixed. Its mean best adherence is
873.598 / 887.241 at the two ceilings, versus the candidate's 873.364 / 888.148.
Its half-guide-cap RMS at 900,000 is 0.050326 on the same 47 pairs, a larger
loss than the candidate. It remains available explicitly for research and is
not enabled in the recommended gallery configuration. Source-continuation and
extreme-only exploration experiments are preserved in the development record.

These are matched **ceilings**, not identical realized work: the candidate uses
4.02% more frames at 900,000 and 0.47% more at 450,000. Its benefit includes
using otherwise unspent work. Neither an equal-actual-work efficiency gain nor
a speedup is claimed. Observed mean compilation times were about 10 seconds and
18 seconds per candidate portfolio on the shared host; concurrent execution
makes those unsuitable for a controlled throughput comparison. Moving gallery
preferences reuses the results and incurs no additional compilation.

## Gallery and validation

Open [Improved guide search](http://localhost:8767/motion-gallery/?data=/generated/motion-gallery/20260930-guide-search/manifest.json).
It contains all six passages at seed 241 and the 900,000-frame ceiling: 210
valid recorded alternatives from 99 same-state forks, including both starting
tracks. The comparison menu exposes the independent unguided reference and
both exploration paths at each beat. The original study remains linked for
comparison. The slider and delivery preference keep their previous semantics.

Every saved track passed independent timing/survival, budget, checksum and
normal-line checks: **180,748 normal segments, zero acceleration segments**.
All 21,012 prefix-frame comparisons matched exactly. Independently reconstructed
target RMS differed by at most 2.78e-16. All 210 native browser replays had zero
body-position error; collision IDs matched the fixed-engine oracle. Browser
checks exercised 36 preference selections, 99 fork comparisons, six independent
references, playback/contact controls and mobile layout. Seed-switching,
cancellation, cache deduplication and injected-failure recovery checks also pass.

The broad regression run passed 165 tests across 42 files. After the final
traversal changes, both directly affected suites passed all 10 tests; these
counts overlap. TypeScript reports the same 251 inherited diagnostics, with no
added or removed diagnostics. The full frozen V4 replay matches all **352
canonical outputs** exactly: geometry hashes, scores, observations, compiler
statistics and physical work. Headline remains **952.4726**, with **46,454,822**
total construction frames. Production does not invoke this research traversal.

## Reproduction and next questions

Use the clean candidate at `0f0da680` and baseline at `9b824676`, with dependencies
and the frozen WASM build available in each checkout. Run the candidate harness
against each compiler checkout so authored cases and evaluation code are shared:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/study_guide_search.ts \
  --compiler-root=/path/to/baseline --variants=baseline \
  --seeds=241,242,243,244,245,246,247,248 --budgets=450000,900000 \
  --out=generated/guide-search-reproduction/baseline
LR_ENGINE=wasm node --import tsx scripts/gallery/study_guide_search.ts \
  --compiler-root=/path/to/candidate --variants=candidate,candidate-memory \
  --seeds=241,242,243,244,245,246,247,248 --budgets=450000,900000 \
  --out=generated/guide-search-reproduction/candidate
node --import tsx scripts/gallery/analyze_guide_search.ts \
  generated/guide-search-reproduction/baseline \
  generated/guide-search-reproduction/candidate \
  --out=generated/guide-search-reproduction/comparison.json
LR_ENGINE=wasm node --import tsx scripts/gallery/build_guide_choices.ts \
  --compiler-root=/path/to/candidate --exploration=balanced --unguided-reference \
  --seeds=241 --budgets=900000 --out=generated/motion-gallery/guide-search-reproduction
```

Compact evidence retains each portfolio's selected alternatives at every declared
ceiling/cap, their geometry hashes, all failed attempts, source fingerprints and
complete aggregate comparisons. Full observations and playback assets stay
local. Earlier development snapshots were recorded with fingerprints but were
not all saved as clean historical commits; those pilot variant names alone do
not reconstruct their intermediate implementations.

The next useful experiment is to address intermediate-guide coverage and the
small-budget allocation loss without adding geometry yet. The current two-path
rule can preserve an accurate and a much simpler track while missing a good
middle continuation. That is a testable search-allocation question, not grounds
for assuming more guides are inherently necessary. This implementation is
frozen; any follow-up should use a new confirmation panel rather than tune
against seeds 241–248 and call them fresh again.
