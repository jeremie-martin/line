# Benchmark V3: conservative successor, evaluated

V3 is implemented as a separate, runnable benchmark with an initial baseline of
**853.9779** for the current arc compiler. Its purpose is broader, better-aligned
evaluation while staying close to V2. The original V2 definition and its
852.1248 baseline remain intact; the two score scales are not interchangeable.

The [standalone specification explorer](assets/benchmark-v3-explorer.html)
contains timing charts, target/measurement comparisons, family filtering, and
optional synthesized contact clicks. It works without videos or a server.

## What changed

| | V2 active campaign | V3 |
|---|---|---|
| Specifications | 44 | **88** |
| Canonical seeds per specification | 8 at the accepted look | **2**, both across the whole suite |
| Compilations per canonical panel | 352 | **176** |
| Music works represented in the headline | 1 | **6**, all previously exposed |
| Authored endings | No axis score after the final contact | **All targeted spans scored** |
| Span error weighting | Equal gaps | **Elapsed time** |
| Impact error weighting | Equal authored contacts | Unchanged |
| Airtime requests | Continuous fractions, sometimes incompatible with landing rules | **Frozen airborne-frame counts**, with every adjustment recorded |

The catalog comprises 44 V2 bridge cases, 39 new authored programs, and five
familiar production references. The bridge preserves V2's contact frames,
impacts, sampled speed/amplitude curves, duration and phase metadata. It changes
airtime authoring and applies the new evaluation contract.

The new programs extend V2's existing 13 non-music families: alternate phrase
forms, different recovery placements, cadence/energy combinations, supported
passages, amplitude contrasts, and controlled endings. The longest new supported
gap is 7.5 seconds, versus V2's seven. There are 65 aggregation parents, but the
39 new programs share 13 family grammars; these counts do not imply that many
independent musical works. [Catalog and authoring briefs](../benchmark/v3/catalog-summary.json)

The 70/15/10/5 stratum weights, non-music group weights, axis weights, exponential
tolerance, physics, detector, contact timing rules and impact ruler are retained.
Within the 5% music stratum, six works now receive equal work-level weight.
The five added production references are exposed development material, not fresh
holdouts. V2 qualification remains unchanged.

No aesthetic score was added. Normal type-0 material is checked, and substantial
coherent physical arcs remain the product requirement. The reference compilers
use the same approved geometry implementation. There is no new standing-time,
curve-count, variety or smoothness quota, and no new owner audiovisual approval
is claimed. [Full contract](../benchmark/v3/README.md)

## Initial empirical result

Both frozen compilers were evaluated on the complete 88-case suite, seeds 16 and
17, at 750k physical compiler frames. Every output was independently reconstructed
and measured by the cold judge, through the ending and existing survival grace.

| V3 result | Earlier arc compiler | Current arc compiler |
|---|---:|---:|
| Headline | 831.1509 | **853.9779** |
| Valid runs | 176/176 | **176/176** |
| Distinct tracks | 88 | **88** |
| Representative | 842.3080 | **866.9734** |
| Capability | 797.9498 | **815.7632** |
| Legacy regression | 809.0423 | **821.8037** |
| Development music | 818.7716 | **851.0329** |

The paired V3 gain is **22.8270 points**, with 80 cases improving and eight
regressing. The largest regression is the bridge low-air-endurance parent,
823.80 → 777.09. Its long-passage air/speed errors worsen even though its ending's
speed error improves. This is a useful compiler research lead, not a reason to
discard a predeclared case or impose a new per-case qualification gate.

The new authored programs also distinguish the compilers: their descriptive
arithmetic case mean improves from 822.46 to 843.93. That mean is not a canonical
headline. These programs were created after both reference models were frozen;
they become exposed development material with this publication.

Every specification produced the same geometry on both declared seeds, for both
compilers. Thus the choice to move compute toward more specifications is supported
for these implementations. Two seeds remain a finite panel, not a guarantee for
future stochastic compilers. The harness reports seed differences and supports
larger predeclared complete panels without making seed-only claims about
generalization or introducing an uncalibrated sequential promotion rule.

The current panel spent **130,601,650 compiler physics frames**, versus about
260 million for its original V2 N=8 panel. Cold judging adds 430,692 separately
reported frame samples. Both V3 panels respected every 750k per-compile limit.
Both used normal lines throughout, with no isolated single-segment components;
the current panel's shortest endpoint-connected component is 15.37 units. These
are geometry diagnostics, not an automatic certificate of visual appeal.

Exact results, all regressions, resource measurements, and identities are in
the [initial validation evidence](../benchmark/v3/initial-validation.json).
Wall time and peak process memory were measured on a shared host with both
14-worker panels running concurrently; they are descriptive, not controlled
speedup claims.

## The changes address measured gaps

The air authoring audit covers all **8,069 intervals**. Every target passes the
necessary landing-count and sample-resolution constraints, and the adapter's
interval means agree with the frozen targets within 2.1e-15. This removes the
known contradictions; it does not prove joint feasibility of every combination
of speed, air, amplitude, impact and adjacent states.

V3 scores **262.4 seconds of authored endings** across the expanded suite. Long
supported passages receive substantially more appropriate span influence. For
the original low-air parent, its three long passages formerly represented 3.33%
of gap observations; their V3 span weight is 16.13% of the authored duration.
Impact still counts events, so a dense musical figure retains its contact-level
importance.

To isolate scoring changes from compilation, I re-evaluated the exact 44 original
V2 tracks under the original V2 hierarchy, changing one part at a time:

| Fixed-track diagnostic | Score |
|---|---:|
| Original targets and V2 weighting, reproduced exactly | 852.1248 |
| Freeze compatible discrete air requests | 876.8193 |
| Then weight span errors by time | 877.0993 |
| Then include authored endings | 856.8721 |

Only the first row is the original V2 headline. The remaining rows isolate changes
on the same tracks; none is the 88-case V3 headline. Correcting impossible requests
raises scores, while ending coverage introduces previously absent error. A lower
initial headline was never an authoring objective. [Fixed-track evidence](../benchmark/v3/fixed-track-bridge.json)

The new baseline also retains useful measured headroom. Analytically removing
ending errors would move the V3 headline to 888.61. Perfecting individual axes
would yield 873.77 for air, 882.65 for speed, 869.90 for impact, or 872.00 for
amplitude. These are report counterfactuals, not achievable-track predictions,
and their gains cannot be added. They show that the remaining pressure is spread
across relevant behaviors rather than dominated by the old landing/air conflict.

## Freeze, correction, and verification

The specifications and scoring policy were committed at `3831bae4` before the
first compiler execution. An initial adapter implementation encoded some air
means with samples of 1.0, exceeding the existing compiler API's 0.99 maximum.
Those incomplete attempts were aborted without a headline and retained locally.

The fix at `bf23e8ab` changed the encoding, preserving **every frozen case,
interval target, contact frame and policy weight**. Both complete evaluations
were then restarted. The audit now runs the actual compiler input validator on
every specification. This was an implementation correction, not score-driven
editing of benchmark content.

The judge measures geometry independently, rejects non-normal material, and
requires all expected span measurements. Physical failures score zero. Execution
or evidence-integrity failures prevent publication of a partial headline and
must be investigated. Archive hashes, exact case/seed membership and matching
suite identities are verified before comparisons.

The focused checks cover duration weighting, tail measurements, axis absence,
compiler input validity, missing/duplicate rows, compressed baseline reading,
and mismatched seed plans, alongside the existing V2/impact tests. The
[completion manifest](../benchmark/v3/completion.json) records their results and
artifact hashes. V2, the compiler source, and the original goal history are
unchanged.

## Use it

```sh
# Inspect the pilot and its baseline.
node --import tsx scripts/benchmark/v3.ts status

# Evaluate a clean candidate checkout on all 88 specifications and both seeds.
node --import tsx scripts/benchmark/v3.ts eval \
  --compiler-root=. --out=generated/benchmark-v3/my-candidate --jobs=16

# Compare against the published V3 baseline; compressed evidence is supported.
node --import tsx scripts/benchmark/v3.ts compare \
  --candidate=generated/benchmark-v3/my-candidate/run.json \
  --out=generated/benchmark-v3/my-candidate/comparison.json
```

The separate command keeps historical V2 workflows intact. The V3 baseline is
ready for compiler research; it does not promote a new compiler or claim visual
validation. More independent music and eventual paired video review remain
valuable future extensions, not prerequisites for using this conservative
version now. Code, frozen inputs and compressed evidence are in Git. Full tracks,
raw run directories, and the aborted attempts remain local under
`generated/benchmark-v3/`.
