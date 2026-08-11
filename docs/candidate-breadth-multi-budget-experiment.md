# Candidate breadth: first multi-budget experiment

## Why this is the first use

The Shelter sweep made the production breadth law's behavior unusually easy to
see. Per-gap candidate count grows linearly with the declared initial budget
and has no ceiling: over the compact scale profile it is

`16, 27, 54, 81, 108, 162, 270, 432`.

Candidate volume therefore grows rapidly at the largest budgets, but the
Shelter score did not improve monotonically. That is a reason to measure the
law across sources and seeds, not evidence that fewer candidates are better.
The earlier global exponent experiment demonstrated the danger: exponent 0.75
slightly improved the 1.5M development score, but it also raised breadth at
250K from 27 to 36 and lost completion reliability across additional seeds.
Shelter itself also preferred the linear arm at every checked high budget.

The new compact multi-budget profile is the right next instrument because it
provides paired source, budget, and seed coverage while allowing every run to
know its exact budget from the beginning.

## Scope and invariant

The production arm remains the existing uncapped linear law. Two study-only
candidate policies are predeclared. They change only the candidate breadth
returned above 750K. Scoring, authored targets, hard budget, branching, ranking,
forward evaluation, repair, and every policy at or below 750K remain unchanged.

| budget | production | high-budget-three-quarter | linear-cap-216 |
| ---: | ---: | ---: | ---: |
| 150K | 16 | 16 | 16 |
| 250K | 27 | 27 | 27 |
| 500K | 54 | 54 | 54 |
| 750K | 81 | 81 | 81 |
| 1M | 108 | 101 | 108 |
| 1.5M | 162 | 136 | 162 |
| 2.5M | 270 | 200 | 216 |
| 4M | 432 | 284 | 216 |

`high-budget-three-quarter` is continuous at 750K and uses exponent 0.75 only
above the hinge. It preserves the low-budget arm that the global exponent
damaged. `linear-cap-216` asks a narrower question: keep the measured linear
law until it reaches 216, then stop increasing per-gap breadth.

No additional shape will be invented after seeing these results. If neither
arm is useful, the production law remains. A later experiment may be justified
by a concrete mechanism visible in the retained telemetry, but it is a new
declaration rather than an unnoticed extension of this comparison.

## Evidence and decision

The production reference is frozen at 16 seeds. Each candidate begins at the
4-seed look, then extends to 8 and 16 only through the retained checkpoint.
The primary statistic is the paired scale-headline delta with one complete
source-by-budget seed curve as the uncertainty block.

The comparison must also report:

- per-budget score and validity, especially 1M through 4M where the policies
  differ;
- the unchanged 750K diagnostic, which should be byte-identical;
- per-source changes and gained/lost valid cells;
- changed-track breadth;
- V3 telemetry for ranked-option pool calls, requested normal proposals,
  actual samples by
  mode, viable candidates, nodes processed/expanded, children, terminal-node
  identity, exact terminal-track geometry, first-terminal work,
  post-first-terminal work, repair episodes, evaluation origin, and register
  gains.

A production change requires a favorable or convincingly robust scale result,
no systematic validity loss, and a high-budget mechanism consistent with the
telemetry. The scale benchmark cannot promote the canonical baseline. If an arm
is selected, it becomes an ordinary compiler change and still owes the
canonical 750K verification—even though exact policy parity should make that
check uneventful.

## Commands

Create the production reference:

```bash
npm run benchmark -- scale baseline --seeds=16 \
  --out=generated/benchmark-v2/scale/candidate-breadth-reference.json
```

Run the first four seed curves for either declared arm:

```bash
npm run benchmark -- scale eval \
  --baseline=generated/benchmark-v2/scale/candidate-breadth-reference.json \
  --seeds=4 \
  --breadth-policy=high-budget-three-quarter \
  --out=generated/benchmark-v2/scale/candidate-breadth-three-quarter-4.json
```

```bash
npm run benchmark -- scale eval \
  --baseline=generated/benchmark-v2/scale/candidate-breadth-reference.json \
  --seeds=4 \
  --breadth-policy=linear-cap-216 \
  --out=generated/benchmark-v2/scale/candidate-breadth-cap216-4.json
```

When another look is required, the comparison artifact prints the exact
`--extend-from` command so completed curves are not rerun.

## Phase 1 result

### Telemetry-audit correction (2026-08-11)

The score, validity, track-hash, and paired multi-budget decisions below remain
direct observations. Their original mechanism report predates the V3 telemetry
foundation and used three misleading labels:

- “candidate count” was the mean *requested normal proposals per pool build*,
  not actual candidate samples or configured lane breadth;
- “unique terminal” meant first evaluation of an in-memory `SearchNode`, not
  distinct track geometry;
- “accepted repair score delta” was optimizer-internal `full_score`, not
  Benchmark V2 headline score.

It also used the stale `compile_stats.repair` aggregate in some downstream
studies. Those old mechanism percentages are retained below as historical
experiment notes, not as V3-verified claims. Any follow-up decision must
recompute mechanics from `line.compile-budget-telemetry.v3`, which separates
requested proposals, actual samples, node identity, geometry identity,
evaluation origin, register keys, and final-output lineage.

The 16-seed production reference completed all 1,024 declared cells with no
worker failure. Its scale headline is 570.6504. The reference archive is
`generated/benchmark-v2/scale/candidate-breadth-reference.archive.json`.

Neither whole-run narrowing policy is a production candidate:

| arm | look | scale delta | P(candidate > reference) | validity | decision |
| --- | ---: | ---: | ---: | ---: | --- |
| high-budget-three-quarter | 16 | -0.7833 | 3.92% | 989 / 1,024 in both arms | inconclusive at maximum look |
| linear-cap-216 | 8 | -0.8192 | 0.78% | 495 / 512 in both arms | prefer reference |

Both policies are exact at their declared lower budgets. The hinged arm's
shifted geometric deltas above 750K were +0.6062, -1.7625, -3.8145, and
-1.2955 at 1M, 1.5M, 2.5M, and 4M. The cap was exact through 1.5M, then lost
-4.7699 at 2.5M and -1.7836 at 4M. The isolated 1M gain is not enough evidence
for a budget-specific exception.

The retained budget telemetry explains the trade rather than merely rejecting
the arms. Narrowing moved first terminal earlier, left more post-terminal
budget, expanded more nodes, evaluated more unique terminals, and produced
more accepted repair work. It also increased duplicate terminal evaluations.
At 4M, for example, the hinged arm cut candidate count by 34.3%, moved first
terminal 14.2% earlier, expanded 28.9% more nodes, evaluated 48.3% more unique
terminals, and accepted 36.7% more repair attempts, but still lost 1.2955 on
the final shifted score. The cap made the same trade more strongly and lost.
The candidates omitted from the initial and resumed searches therefore carry
real value which the additional depth and repair did not recover.

Supporting paired artifacts are:

- `generated/benchmark-v2/scale/candidate-breadth-three-quarter-16.final-comparison.json`
- `generated/benchmark-v2/scale/candidate-breadth-three-quarter-16.mechanics.json`
- `generated/benchmark-v2/scale/candidate-breadth-cap216-8.final-comparison.json`
- `generated/benchmark-v2/scale/candidate-breadth-cap216-8.mechanics.json`

This first use also exposed one runner defect before any candidate compile: the
eval command parsed the breadth policy in the baseline path, so eval raised a
`ReferenceError`. The failed attempt produced no cells. The parse was moved to
the eval path and covered by a direct command regression test. Full reference
execution, checksummed archives, staged 4 -> 8 -> 16 checkpoint extension, and
paired mechanics analysis then completed successfully.

## Phase 2 declaration: repair-only narrowing

Phase 1 gives one focused follow-up mechanism. It changed initial search and
repair together, so it cannot tell whether the extra repair throughput would
be useful if the initial incumbent retained the production pool. The single
new study policy is `repair-high-budget-three-quarter`:

- initial search and the ordinary resumed frontier use the production linear
  breadth at every budget;
- only frontier builds inside an explicitly marked repair restart use the
  already-declared 750K-hinged exponent-0.75 law;
- scoring, targets, repair selection, repair ceilings, ranking, branching, and
  all other search behavior remain unchanged.

This is not a third general curve search. It reuses the Phase 1 shape to isolate
the phase boundary named by the telemetry. It should leave first-terminal work
and the initial incumbent unchanged, then ask whether cheaper repair episodes
buy useful additional attempts. The same 4 / 8 / 16 sequential decision and
validity rules apply. A favorable final score, preserved validity, unchanged
pre-repair telemetry, and increased useful repair throughput are all required
before considering production.

## Phase 2 result

The repair-only arm reached the maximum 16-seed look. Its scale headline was
570.4743 against 570.6504 for production: delta -0.1761, standard error 0.0800,
95% central interval [-0.3465, -0.0057], and 2.19% directional probability of
improvement. The formal sequential outcome is `inconclusive` because neither
one-sided early-stop boundary was crossed, but the estimate and central
interval do not support promotion. Validity was exactly preserved at 989 / 1,024
in both arms, with no gained or lost cells.

The staged looks behaved as intended: +0.0264 at 4 seeds, -0.1874 at 8, and
-0.1761 at 16. This is why the four-seed sign was not treated as a result.
Per-budget shifted geometric deltas were exactly zero through 750K, then
-0.0898, -0.1854, -0.8544, and -0.2791 at 1M, 1.5M, 2.5M, and 4M. All eight
sources retained identical validity. Three sources had small positive aggregate
deltas, but five were negative and the largest source losses were
`amplitude_tides` (-0.9662) and `frontier_low_air_endurance` (-0.5463).

The phase isolation worked exactly: mean first-terminal frames were identical
at every budget. Repair-only narrowing then bought more search inside the same
post-terminal allocation. At 4M it reduced mean candidates sampled by 8.76%,
expanded 11.52% more nodes, and evaluated 115.53% more unique terminals. But it
did not meaningfully increase the number of repair episodes (-0.24% attempts),
and the sum of accepted repair score deltas fell 5.84%. At 2.5M the arm
evaluated 72.42% more unique terminals while accepted repair attempts fell
7.61% and their score delta fell 16.91%. The extra within-restart depth therefore
has low marginal quality: full production breadth is valuable inside repair as
well as before it.

The complete comparison and standalone mechanics artifacts are:

- `generated/benchmark-v2/scale/candidate-breadth-repair-three-quarter-16.comparison.json`
- `generated/benchmark-v2/scale/candidate-breadth-repair-three-quarter-16.mechanics.json`

## Compiler decision

Keep the production uncapped linear breadth law unchanged. Across the three
declared alternatives, whole-run narrowing lost because reduced candidate
quality outweighed more downstream work; repair-only narrowing preserved the
initial incumbent and removed most of that loss, but still made repair less
effective. The data also argues against treating duplicate terminal evaluation
as the primary breadth problem: repair-only narrowing more than doubled unique
terminal evaluations at 4M, yet quality still fell.

The next candidate-efficiency investigation should target why additional
repair terminal evaluations fail to become accepted score gains—for example,
repair candidate ranking, restart diversity, and terminal deduplication—not
fit another budget-only breadth curve. That is a separate compiler mechanism
experiment. It is not silently added to this completed breadth comparison.
