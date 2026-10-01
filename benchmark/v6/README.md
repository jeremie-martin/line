# V6: intentional motion and a contextual repertoire

This implements the approved [intentional-motion roadmap](../../docs/intentional-motion-roadmap.md).
**Frozen on 2026-10-01, before the canonical baseline and optimization.**
`frozen.json` records the contract hashes. V5 and V4 remain unchanged. V6 changes construction/layout requests
and automatic arrangement, while retaining the existing musical judge and physics.

## Coverage and sampling

Canonical: **115 cases × seeds 101/202/303/404 = 460 runs**. This comprises
96 fixed requests across eight existing musical contexts and seven construction
families, plus 19 complete automatic arrangements. Guided arc, fold, S sweep,
ripple and terraces each have paired and transfer layouts. Unguided ordinary arc
and scattered families retain their existing structural meaning.

Confirmation: **74 cases × seeds 503/607/709/811 = 296 runs**. It uses fourteen
source selections outside the V5 catalog, including five contexts for fixed
requests. There are 33 source specifications overall. These inputs were exposed
in prior ordinary benchmarks: this is reserved repertoire evaluation, not a claim
of unseen music. Source parents and duplicated trajectories remain reportable.

Musical programs and targets are copied without modification. Canonical source
selection preserves V5's automatic musical groups. Fixed requests place three
consecutive constructions in ordinary surroundings, using the same score-blind
early/middle/late/ending selection for both layouts. Automatic requests come from
the actual V2 production policy. Every plan and its musical identity is stored;
search cannot reroll difficult requests. Additional seeds are not added based on
whether the headline crosses the target.

## Musical headline and construction contract

Retain V5's raw musical score × fulfilled fraction of explicitly scored supports.
Invalid tracks score zero; a failed construction does not erase other fulfilled
requests on an otherwise valid ride. The raw score, fulfillment and failures are
reported separately. Motion results never filter rows out of the headline.

Aggregation retains the shifted geometric mean across seeds and equal musical
parents within each family. Layout variants share their family's weight.
Fixed and complete automatic panels each contribute half the headline, with
seven equally weighted fixed families and equally weighted automatic musical
groups. The evaluator reuses the frozen V5 aggregation because these semantics
and panel weights are identical.

Paired and ordinary constructions retain the V5 checks. A transfer additionally
requires main support contact, a truly collision-free interval, and at least two
later guide-contact frames with the actual rider center at least six engine units
beyond the support along the contacted receiver's forward tangent. All rider-body
contacts participate. A line extending beyond the support does not establish
that its rider has reached the unsupported portion.

Shaped transfers retain substantial visible geometry and actual engagement.
Folded transfers require two substantial physical corners whose adjacent faces
are contacted. Smooth transfers require visible reversals and meaningful reversal
in the ordered contacted directions. These are functional checks, not guarantees
of continuous sliding, exact artistic identity or beauty. All lines are type 0.
The physics, native gravity, musical impact and timing definitions are unchanged.

## Motion observations and qualification

Observe post-solve effective body velocity from the next stored velocity minus
native gravity. Decompose speed changes into gravity along the actual path and
the remaining solver contribution. This does not label useful gravity-assisted
steering as artificial acceleration. Observe all frames, including those outside
the landing-impact window, and retain direction and absolute-speed corrections.

Pilot calibration checked the preserved collection against full native states,
the reported acceleration examples, smooth openings and free-flight controls.
For each rolling window, define its speed-gain band as the larger of the absolute
and relative limits below; relative limits use speed before that window.

| Window | Absolute solver speed gain | Relative gain |
|---|---:|---:|
| 25 ms / 1 frame | 0.75 px/frame | 10% |
| 100 ms / 4 frames | 1.25 px/frame | 20% |
| 250 ms / 10 frames | 2.00 px/frame | 30% |

Report maximum gain, excess, exceedance episodes and integrated positive excess.
The integral sums each rolling-window excess divided by its window length, then
can be normalized by observed duration. This describes burst burden, not energy
or a universal aesthetic score. The bands are engineering criteria anchored in
the specified concerns; the campaign improvement requirements are explicit
ambitions, not estimates of human acceptance probability.

Qualification uses the complete, preserved four-song × three-seed production
collection, whose twelve baseline automatic tracks are valid. All twelve new
tracks must complete and fulfill their requests. Require at least 50% reduction
in duration-normalized integrated excess for each of the three bands across this
matched collection. The three owner-reported windows must each lie within the
100ms band. Whole-track summaries prevent fixing a window by merely moving its
burst elsewhere. The compiler receives no song-name or timestamp exceptions.

For Luna and Tiki's first three seconds, compare each song's three-seed mean with
its ordinary reference. Absolute solver-speed correction and speed-weighted
direction correction must each be at most 1.35× that reference. Mean landing-impact
RMS error must improve by at least 40% over the preceding automatic collection.
These conditions preserve the distinct roles of musical impact and later motion.

V6 additionally reports complete motion distributions, worst cases and matched
valid-run comparisons against its minimal integrated baseline, with denominators
and completion failures disclosed. Newly completed runs are reported separately
from paired valid runs. The known-song qualification and broader benchmark
diagnostics must not be described as universal artistic approval.

## Budget, freeze and operation

Primary allowance: **3,000,000 actual compiler physics frames** per run. Preparation,
failed proposals, continuation, reconstruction and compiler verification all count.
Independent benchmark judgment and rendering have separately reported costs.
The numerical ambition is **V6 ≥850**, together with motion qualification; the
campaign does not switch benchmarks according to which score is higher.

Freeze the catalog, checks, bands, weights, seeds and allowance before canonical
optimization. Bind runs to a committed compiler and frozen judge. Record the
minimal integrated implementation's baseline, including all new-layout failures;
retain the preceding compiler and V5 results for direct historical comparison.
Execution errors are zero outcomes and disqualify a supposedly successful run.

```sh
LR_ENGINE=wasm node --import tsx scripts/benchmark/v6.ts eval \
  --compiler-root=/absolute/frozen/checkout --out=generated/intentional-motion/RUN --jobs=8
```

Use `--split=confirmation` only after freezing a final candidate. A subset or
different allowance is a diagnostic run. Raw archives stay local; code, the
contract and compact evidence are committed. Routine artistic review uses native
playback with music. Finished vertical rendering remains optional.
