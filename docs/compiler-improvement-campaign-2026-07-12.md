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
forward. The project owner reviewed and approved the corrected 4s and new 6s/7s
click tracks without consulting compiler or qualification outcomes. The tracked
review binds all 44 current source and audio hashes. Certified eval/family
promotion remains blocked until suite rebaseline is complete.

## Suite-rollover calibration

The 44-case rollover was recalibrated from fresh raw evidence rather than
restamping the former 42-case studies:

- 12-seed coverage reference: 1,584/1,584 tasks, 6m49s, 9.08 GiB peak RSS;
- 24-seed pooled reference: 1,584 restored plus 1,584 fresh tasks, 7m00s,
  9.50 GiB peak RSS;
- disjoint seeds 36-47 holdout: 1,584/1,584 tasks, 6m49s, 9.04 GiB peak RSS;
- menu certification: all nine predeclared bars passed in 9m19s;
- independent holdout: all seven predeclared bars passed in 8m52s.

The retained 1,000-trial coverage study reports false-accept rates of 0.5% for
empirical blocks, 0.9% for symmetric validity flips, and 2.0% for the
catalog-wide hard-zero null. The simplification boundary false-accept rate is
2.9%. Supported +12.8-point power is 92.3%; the paired inside-margin
simplification power is 100%. Hard-zero validity gains remain explicitly
documented low-power diagnostics rather than supported claims.

The live rollover also exposed and fixed a runner failure path: an absent raw
report on a worker error was hashed as `undefined`, so archive assembly crashed
instead of retaining the promised failed archive. Failed reports now bind the
deterministic JSON `null` representation and a regression test covers it.

The governed baseline freeze completed in 6m22s at 48 workers and 9.20 GiB peak
RSS. The new baseline is `v2.5-low-air-frontier-2026-07-12`: probe 446.06,
canonical 453.11, and indicative qualification 373.47. A suite-rollover
sequencing defect was also found: the newly published baseline was rejected by
the previous suite's migration ledger. Cross-suite baseline authority is now
recognized only until a migration anchors the new suite; same-suite divergence
still fails closed. The anchor migration re-recorded the three empirical
fixtures and left all three synthetic statistical fixtures bit-identical.

Finally, retained control summaries now distinguish intentionally pruned raw
working archives from their checksummed compressed retention copies. Status
reports no missing evidence and shows the current normative costs: 264 stage-0
compiles and 12,672 depth-48 development compiles.

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

The causal evidence supports duration-derived support extent, but the existing
`length` and `coordinated` modes remain prototypes rather than production family
members. Their activation pressure above the historical 360px cap was useful for
isolating causality, but it is still a regime switch. The production mechanism
must instead treat short, ordinary, and long support as one continuous kinematic
problem:

- derive supported distance from speed, gap duration, and requested airborne time;
- share that physical envelope between target-state and contact-centered samplers;
- express slack as deterministic search coverage around the target, not a special
  long-ride branch;
- derive launch timing from flight time remaining after the sampled support;
- separate total support extent from geometric resolution, using curvature and
  explicit grain rather than adding segments merely because duration is long;
- retain ordinary candidates inside the distribution so the mechanism can improve
  frontiers without making classical specifications brittle.

The suite was subsequently calibrated and frozen. Four governed family rounds
then compared universal and adaptive formulations on fresh shared seeds:

- Pure time normalization solved most frontier failures and gained roughly
  27-31 headline points across rounds, but changed about 97% of outputs and
  repeatedly lost 4-11 points on the representative stratum.
- Mean(entry, target) speed did not improve the universal model.
- Coordinating flight geometry raised one round's headline but was unstable
  across seed prefixes and enlarged coherent high-air and development losses.
- A fixed shape/time proposal mixture and a continuous interpolation both kept
  frontier feasibility, but displaced ordinary shape diversity and caused
  substantial case losses in focused controls.
- An air-coverage lane that preserves the normal pool and adds eight
  time-normalized proposals only when every admitted prediction over-air
  overshoots the next ask produced the cleanest full-suite profile: +17.69
  versus baseline, +2.40 representative, +2.75 development music, -0.64 legacy,
  and 60.2% track-hash-identical outputs. It still lost four previously valid
  runs in two short-gap capability cases. More importantly, it retains the
  incumbent generator as the common path and is therefore a useful control, not
  the completed continuous representation.

The operator explicitly rejected choosing by headline while zero-score frontier
rows dominate the gain. No family member has been promoted. The durable design
space, diagnostic contract, and acceptance criteria now live in
`docs/SUPPORT_GEOMETRY_DESIGN.md`.

Next steps:

1. Instrument desired versus actual grounded time, riding-speed integral,
   release state, shape, candidate coverage, and selection.
2. Separate coverage, centering, and ranking failures on short, ordinary, and
   frontier gaps.
3. Use that evidence to implement the smallest credible continuous formulation,
   starting with a dynamics-aware prior and dimensionless shape-time family.
4. Re-run focused controls, then a fresh governed family round.
5. Enter certified evaluation only after the frontier, stratum, case-loss, and
   blast-radius operator gates all pass.

## Continuous support response campaign

`scripts/v0/study_support_response.ts` was added to observe all gaps rather than
assuming a fixed frontier index. It records desired and observed grounded time,
entry speed, release displacement, support extent, segment resolution,
curvature, gate yield, predicted air coverage, quality and handoff winners, and
per-axis compile response. WASM handles are drained between rows and every row
is atomically checkpointed.

The response study separated the problem:

- **Coverage:** normal 5s supports reached only 43-54 grounded frames against a
  195-frame target. Pure time reached 198 and completed.
- **Centering:** pure time's fixed 45% lower bound excluded useful 20-30-frame
  shapes on ordinary sparse gaps, reducing speed and impact quality even when
  air fit improved.
- **Coupling:** a logarithmic scale with endpoints bound to one launch coordinate
  generated sufficient length but failed gates. Crossing four support scales
  with the launch span restored 5s feasibility.
- **Selection:** tiny nonzero pressure on a random short member could redirect a
  healthy high-air chain. Family pressure now uses the deterministic center, not
  each random member. Zero-pressure endpoints return exact source values to
  avoid floating-point identity leakage.

The final model uses a continuous family-center extent pressure: neutral through
a 2x ratio, smooth in log space, and full at 5x. An initial panel crosses four
support scales with launch variation. Sequential refinement requires both a
positive physical extent deficit and measured normal-pool over-air deficit;
breadth rises smoothly from 8 to 32, and only exact air-coverage improvements
enter ranking.

Focused 500k evidence before family execution:

- 5s and 7s low-air: 3/3 valid each versus 0/3 shape controls;
- dense-240ms and pickup-shifted: validity and scores identical to shape;
- high-air, meter, and rising: all nine scores identical to shape;
- sparse: three valid, mean movement below one point.

Three fresh governed families then isolated the layers. The final family,
`continuous-support-geometry-v3`, compared the full physical+coverage gate with
a measured-coverage-only ablation over 528 paired compiles per member. The
physical gate was selected descriptively:

| Metric | Selected result |
|---|---:|
| Headline delta | +16.43 |
| Paired SE | 1.08 |
| Validity gained / lost | 44 / 0 |
| Representative | +0.49 |
| Capability | +107.24 |
| Legacy regression | 0.00 |
| Development music | 0.00 |
| Track-hash identical | 87.1% |

The selection was stable at every 2/4/6 seed prefix. The comparison remains
exploration-only; no qualification output was read and certified confirmation
is still required.

## Verification-order friction: WASM artifact identity

The first final stage-0 screen completed all 264 compiles successfully, then
correctly refused comparison because `npm run wasm:all` had rebuilt the ignored
WASM artifact. No Rust source had changed, but the in-place `wasm-opt` pass
changed its SHA-256 from the accepted baseline's `702922ac...` to
`12c25081...`. The compiler result was therefore not interpreted as evidence.

For a wrapper-only boundary change, the reliable order is:

1. run `npm run wasm:all` to verify the boundary;
2. restore the exact checksummed accepted artifact from the baseline compiler
   snapshot;
3. verify its SHA-256 against `baseline.json`;
4. run stage 0 and confirmation.

This is an operational sharp edge, not a reason to weaken engine-artifact
identity. The rejected comparison demonstrates that the identity gate works.

After restoring the accepted artifact, a second 264-compile stage-0 run exposed
another preflight gap: the protocol migration was current, but the retained
probe used the runner fingerprint from before the compiler-snapshot identity
fix and had no bit-identity compatibility approval. The comparison again
refused without issuing a screen. Stage 0 and `benchmark status` now check the
artifact and runner-compatibility bindings before compilation. A fresh replay
must prove every retained baseline row bit-identical before approval.

The compatibility replay subsequently matched all 264/264 rows on task, raw
report, score, track hash, authored contacts, and decision-index projection.
After the governed protocol migration, status reported the contract current,
the stage-0 reference comparable, and the certified improvement menu allowed.
The successful stage-0 screen took 1m08s at 48 jobs and reported +16.66, 22
validity gains, no losses, and 87.5% identical pairs.

## Certified result

Attempt `2026-07-12T20-14-09Z-c8f9c284` ran the predeclared depth-48
improvement rule on a fresh disjoint seed epoch. It completed 12,672 paired
development compiles plus the accept-only 120-compile qualification sidecar in
58m13s, with no worker failure.

| Metric | Certified result |
|---|---:|
| Headline | 450.03 -> 467.07 |
| Delta | +17.04 |
| 99%-critical one-sided lower bound | +16.13 |
| Formal paired SE | 0.38 |
| Validity gained / lost | 533 / 0 |
| Representative | +0.36 |
| Capability | +111.93 |
| Legacy regression | +0.01 |
| Development music | +0.00 |

Every budget improved: +12.10 at 250k, +18.05 at 500k, and +18.66 at
750k. The rapid-pickup and dense-recovery capability groups were exactly
neutral; the low-air frontier gained +447.72. The largest non-frontier gain was
`sparse_lowline` at +5.21. The largest reported case regression was numerical
`-0.00`, with no validity loss. The held-out qualification monitor was 383.97
with 120/120 valid, versus the prior baseline reference of 373.47; this sidecar
was not used in promotion. The formal outcome was ACCEPT.

The accepted source was committed as `188bcbd`, then the ledger-provided light
rebaseline completed its fresh 264-compile probe in 1m10s. It published
`accept-2026-07-12T20-14-09Z-c8f9c284` with probe 462.73, canonical 467.07,
qualification monitor 383.97, and a new era at 0/0.05. The rebaseline's first
banner still contained a stale hard-coded 252 count even though the runner's
authoritative plan correctly said 264; the banner was changed to omit derived
counts and the resource documentation now separates historical 42-case rows
from current 44-case measurements.
