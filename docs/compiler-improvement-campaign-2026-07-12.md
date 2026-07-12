# Compiler Improvement Campaign, 2026-07-12

## Purpose

This is the live record of exercising Benchmark V2 and the governed development
workflow against a real compiler problem. It records commands, elapsed time,
falsifiable hypotheses, evidence, decisions, and workflow friction. Compiler
outcomes from the five qualification references were not consulted.

Campaign start: commit `1624713` (`Add governed compiler family exploration`).
The pre-existing package/spec working-tree changes were not modified.

## Baseline localization

`benchmark explain` localized the 250k failures to all capability rows. At 500k,
the 5s low-air case remained 0/3 valid and all three runs stopped at gap 55, the
contact ending the 34.15s -> 39.15s interval. The initial traversal-slack theory
was rejected after the user identified the representational question.

The authored 5s interval is 200 frames at 40 Hz. Around 11.5 px/frame and
`air=0.02`, it asks for about 195 grounded frames, or roughly 2,240 px of
support after applying the detector's five-frame airborne floor. The normal
contact-centered generator capped post length at 360 px and 16 segments.

Workflow friction found before the geometry study:

- `benchmark explain` rejects CLI-wide `--json`; this is intentional but not
  discoverable from the command shape.
- `--out=...json` is treated as a base name and writes `.json.json` plus
  `.json.md`.
- A raw `tsc --noEmit` is not a valid repository check because the command lacks
  the project's TypeScript-extension import option; Vitest and real TSX/WASM
  execution are the supported checks.

## Benchmark coverage change

The capability ladder now includes 4s, 5s, 6s, and 7s frontier cases; the base
also contains earlier 2s and 3s phases. The 4s transform was corrected to shift
the suffix cadence rather than accidentally inserting another omission. The
same duration transform generates 4s, 6s, and 7s.

The catalog grew from 42 to 44 development cases. The `low_air_frontier` parent
weight remains fixed and is divided among its four members, so this does not
increase the capability family's headline influence. `benchmark prepare` took
3.87s and 224 MB peak RSS; the static audit passed.

The suite change correctly invalidated the old baseline, decision calibration,
and listening attestation. Forty-one byte-identical item judgments were carried
forward. The corrected 4s and new 6s/7s click tracks remain pending human review.
Certified eval/family promotion must remain blocked until review, recalibration,
and suite rebaseline are complete.

## Causal studies

### H1: traversal policy is the primary failure

Rejected before spending a family run. All failing 5s runs reached exactly the
same boundary, while the generator's physical capacity was far below demand.
An unfinished dynamic-slack experiment was removed before studying geometry.

### H2: duration-scaled length without coordinated segmentation is sufficient

Supported as one viable mechanism, not a complete solution. Length-only keeps
the historical 16-segment cap and launch model, but replaces the 360 px cap with
duration/speed/air demand and uses a deterministic low-discrepancy length
coordinate. It is particularly strong on 5s and 7s completion.

The funnel showed that the original grid and cap could not expose useful long
support. The length-only prototype generated more than 2,500 px at 5s and found
catchable releases once the repeated eight-coordinate length grid was replaced.

### H3: recognize a sustained airborne suffix

Partially supported. A fallback using already-simulated trajectory data makes
some naturally departing supported candidates rankable when the geometric
end-plane read fails. Corrected runs show that this helps coordinated search,
but length-only can also succeed without it; prediction is one bottleneck, not
the entire solution.

### H4: finer length coverage plus coordinated geometry is a second viable mechanism

Supported as a distinct, non-dominated mechanism. The old 16-step launch/length grid
repeated only eight length coordinates. Across a 2,500+ px range, adjacent
lengths were hundreds of pixels apart. Keeping the launch coordinate and using
a deterministic low-discrepancy length coordinate found a catchable release.

Coordinated mode additionally derives segment count, shapes launch from remaining
airborne frames, and recognizes a final sustained-air release only at a physical
support deficit. It generally produces higher valid-run scores and is stronger
on 6s at 500k, while length-only is more reliable on 5s/7s in this screen.

An isolated comparison against commit `1624713` found an early study-helper bug:
disabled mode returned raw sampled length instead of legacy air-targeted length.
All numerical results produced before that check were invalidated. After adding
an explicit `legacyPostLength`, default-off dense and sparse tracks match the
commit byte-for-byte. Only corrected reruns appear below.

Three-seed 250k ladder:

| Duration | Control full | Length full | Coordinated full |
|---:|---:|---:|---:|
| 4s | 0/3 | 3/3 | 3/3 |
| 5s | 0/3 | 3/3 | 2/3 |
| 6s | 0/3 | 2/3 | 2/3 |
| 7s | 0/3 | 1/3 | 0/3 |

Three-seed 500k ladder:

| Duration | Control full | Length full | Coordinated full |
|---:|---:|---:|---:|
| 4s | 1/3 | 3/3 | 3/3 |
| 5s | 0/3 | 3/3 | 3/3 |
| 6s | 0/3 | 2/3 | 3/3 |
| 7s | 0/3 | 3/3 | 1/3 |

At 750k, length-only completes 7s 3/3 while coordinated completes 1/3. Neither
prototype is declared the winner from these selected cases; the complete suite
family screen owns that comparison.

### H5: wider mature steep-arrival sampling rescues the remaining 7s seed

Rejected. Reusing the existing scarce-budget 75% steep-arrival span at supported
deficits did not change the seed-27 failure at 250k, 500k, or 750k. The change
was removed.

## Representative behavior

Static exposure analysis found meaningful activation outside the frontier only
in `sparse_lowline` and its lower-air variant. At 250k, three seeds remained 3/3
valid and improved:

| Case | Control mean | Length mean | Coordinated mean |
|---|---:|---:|---:|
| sparse_lowline | 538.09 | 545.22 | 542.37 |
| sparse_lowline_air_minus_4 | 505.79 | 523.05 | 516.24 |

After narrowing the release fallback and segmentation to the same physical
deficit predicate, `dense_dialogue` was score- and track-hash-identical for all
three seeds. A temporarily global fallback had changed that case; the leakage
was detected by the control and removed rather than counted as part of this
mechanism.

## Efficiency and workflow findings

- Focused compiles took about 1.6-3.0s at 250k, 3.1-4.7s at 500k, and 5.6-7.4s
  at 750k on this host.
- Instrumented multi-compile studies retained enough process state to peak near
  973 MB for 24 sequential compiles. Splitting matrices into separate processes
  reduced peaks to roughly 400-900 MB. A reusable study runner should isolate
  rows or explicitly release caches.
- The governance failures after adding cases were correct: stale suite baseline,
  stale calibration, and stale listening approval were rejected mechanically.
- The family tool was deliberately not used while mechanisms were still being
  invented or while the suite baseline was stale.

## Current conclusion and next steps

The evidence supports two non-dominated family members. Both use duration-derived
support length and low-discrepancy length coverage. Length-only retains historical
segmentation/launch; coordinated also derives segment count and remaining-flight
launch and recognizes sustained-air release at actual deficits. Both improve
frontier completion and ordinary sparse low-air score, while unaffected behavior
is exact by the zero-deficit contract.

Next steps:

1. Human-review the corrected 4s and new 6s/7s click tracks.
2. Recharacterize decision calibration and bootstrap the 44-case suite baseline.
3. Capture the source-default-off control, length-only member, and coordinated member.
4. Run the governed family screen across the complete suite.
5. If selected, enter a fresh certified eval. Treat 7s seed 27 as an explicit
   residual re-entry problem, not a reason to tune duration-specific constants.
