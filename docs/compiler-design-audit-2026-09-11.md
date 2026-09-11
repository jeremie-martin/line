# Compiler design and behavior audit — 2026-09-11

This audit turns the recent arc compiler into a more consistent foundation for
further geometry and search work. It introduces a shared control contract,
transfers preliminary trajectories through existing physical-state memory,
separates attempt orchestration and diagnostics, and removes contradictory
current-workflow instructions. It preserves the frozen V4 benchmark, scorer,
detector, physics and substantial normal type-0 arc constraint.

The selected compiler is `e374c022`. Its public canonical result is **952.5191**
versus **952.4115**, with **352/352 valid runs** over all 176 specifications and
seeds 16/17. Every canonical track, score and physics-frame count matches the
complete research panel from before the control-registry refactor. Maximum
work is **749,995 frames**, within the unchanged 750,000-frame allowance. The
V3 subset scores **958.0530**; the V4 extension scores **947.0434**.

The owner's decision criterion includes maintainability and extensibility.
Small score losses deserve investigation; they are not automatic vetoes on a
material simplification. The selected design has a small diagnostic tradeoff,
disclosed below. This is a foundations change, not a new headline-score goal.

## Scope and evidence

The review followed the September 7–11 changes through the public dispatcher,
production budget/options adapter, measured interval search, planning and
backtracking, complete-trajectory selection, geometry, learned proposal/value
models, local control/response memory, completed-track repair, and relevant
research and production-review entry points. Earlier engine-ownership and
review-cache corrections remain documented in the [preceding review](compiler-review-fixes-2026-09-11.md).

Code inspection was paired with the complete last 176-case research archive,
new mechanism pilots, full research panels, two-seed public V4 runs, four-seed
search-target jitter studies, a controlled validity-failure probe, and one Node
CPU profile. The audit does not claim every retained legacy path was exhaustively
requalified or that exposed development cases establish unseen-input performance.

Compact evidence:

- [Final canonical validation](../benchmark/v4/studies/compiler-design-audit-20260911-validation.json), [final jitter validation](../benchmark/v4/studies/compiler-design-audit-20260911-jitter.json), and [paired jitter/registry-parity comparison](../benchmark/v4/studies/compiler-design-audit-20260911-jitter-comparison.json).
- [Test, TypeScript and independent Newton-parity records](../benchmark/v4/studies/compiler-design-audit-20260911-checks.json).

- [Behavior and work comparison](../benchmark/v4/studies/compiler-design-memory-20260911-research.json), with all per-specification changes.
- [Earlier direct-transfer canonical result](../benchmark/v4/studies/compiler-design-direct-20260911-validation.json) and [adverse jitter panel](../benchmark/v4/studies/compiler-design-direct-20260911-jitter.json).
- [Controlled transfer-failure probe](../benchmark/v4/studies/compiler-design-audit-20260911-transfer-probe.json).
- [State-memory jitter result](../benchmark/v4/studies/compiler-design-memory-20260911-jitter.json).
- [Pilot results and exact source patches](../benchmark/v4/studies/compiler-design-audit-20260911-prototypes.json).
- [Model inventory](../benchmark/v4/studies/compiler-design-audit-20260911-policy.json) and [sampled process profile](../benchmark/v4/studies/compiler-design-audit-20260911-profile.json).

Large tracks, datasets, unselected models, raw profiles and detailed worker
outputs remain local under `generated/compiler-design-audit-20260911/`.

## Findings and changes

### 1. The expensive search was starting over after a strong preliminary track

The prior compiler physically completed 171 of 176 preliminary trajectories.
It selected 170 of them; general search selected the five recovered failures
and one tie. General search improved **none** of the successful preliminary
tracks, despite consuming **129,374,203 of 130,674,351** total physics frames.
The preliminary attempt used only **1,300,148 frames**.

The first prototype handed each preliminary control directly to the matching
interval in general search. It produced a slight canonical gain, but target
jitter exposed a failure where changing earlier choices made later interval
controls poorly matched to the physical state. An ablation removing this direct
transfer restored completion; so did restoring the earlier proposal filtering.
That interaction argues against treating the authored interval index as a
sufficient transfer contract.

The selected implementation passes measured examples through `ArcControlMemory`
instead. Each example carries relative rider/target features, incoming heading,
interval length and the complete control. Existing nearest-state retrieval and
existing proposal-budget allocation decide which examples to evaluate. This
removes the additional interval-indexed evaluation path. Useful partial prefixes
can contribute examples, while every proposal still receives physical validation.

On the complete research panel, general search now improves **three** successful
preliminary trajectories. Eight selected tracks change: six scores improve and
two regress. General search is still weak relative to the preliminary library;
this is an improved starting point for completed-track optimization, not a claim
that the remaining-work problem is solved.

### 2. Proposal filtering could discard different arc shapes

The learned example filter compared entry, turn, exit and support. Local memory
had a similar but separate rule. Two controls could therefore be treated as
interchangeable even when bend, turn timing, guide coverage/separation, easing
or contact offset differed substantially.

Production now uses the shared `geometry` comparison over all 13 controls.
Optional-field absence remains distinct, because it can change geometry and
its defaults depend on context. Historical `inherited` filtering remains an
explicit ablation/fixture option, not the production setting.

This makes existing shape alternatives available to physical search. It does
not impose a pattern quota or randomly replace a better trajectory to manufacture
visual variety. In the selected research output, 1,593 of 16,138 intervals have
no retained guide, 13,955 have shortened guides and 590 retain full guides.
These are post-pruning structural counts, not an aesthetic rating. No new owner
video approval is claimed.

### 3. Geometry controls had several independently maintained contracts

Adding a shape dimension previously required separate edits to normalization,
memo identity, diversity thresholds, coordinate steps, response steps and repair
steps. A forgotten cache field could reuse the wrong physical evaluation;
a forgotten search field could leave the new dimension inaccessible.

`arc_motion_control.ts` now defines every control's bounds, family, optional
search default, step sizes and similarity tolerance. The registry is typed
against `ArcMotionControl`; normalization, memo keys and solver key lists derive
from it. Construction and completed-track repair use the same helpers. The
pure geometry builder remains responsible for drawing the curve.

The refactor preserves existing operation order, omitted fields, signed zero,
context-dependent clearance, long-arc turn timing, solver ordering and probe
scales. The earlier six-dimensional Newton path now uses the shared damped
response solver and derives its dimensions and work estimate from the core
controls. Solver-specific damping remains explicit. New tests cover identity,
normalization, optional geometry and exact representation of an inherited long
arc. Model feature/output schemas remain separate contracts requiring export
and training work when changed.

Learned examples and local memory also share exact control adaptation. At the
same incoming heading and interval length, adaptation preserves the original
doubles rather than introducing arithmetic round-trip drift. Distinct arrival
selection in planning and backtracking now uses the same configured release
separation rule.

### 4. Attempt accounting mixed the winner's trajectory with another search

The old combined result could expose selected preliminary rows together with
general-search planning diagnostics. It also reported completion at the end of
the whole compile even when a complete preliminary trajectory existed earlier.
This obscured where work was spent and whether later work improved anything.

`arc_attempts.ts` now handles complete-trajectory competition around a simulation
callback. Each attempt records construction and replay boundaries, commits,
planning, samples, completion, loss and selection. Returned interval rows and
planning diagnostics belong to the selected trajectory; aggregate work includes
all attempts. Public budget telemetry records separate episodes and the first
physically validated completion. The running absolute frame limit is never
reset or refunded between attempts.

Tests exercise completed-incumbent retention, failed preliminary proposals,
continued metering and first-completion attribution. This separation
also provides a place to investigate future attempt scheduling without burying
that policy inside interval search.

### 5. Model loading is expensive, but most of the artifact is not duplicate data

The current policy is **102,442,793 compressed bytes** and **243,143,468 decoded
JSON bytes**. Its 13 model nodes include three forests, nested mixtures,
79,810- and 15,962-example libraries, and a 67-feature preliminary library with
15,962 catch examples plus 176 startup examples. Related libraries are not
necessarily duplicates: they carry distinct examples or fitted corrections.

A checksummed structural inventory finds one identical top-level array pair:
the catch/startup preliminary libraries repeat a 32-tree proximity index,
**2,303,078 canonical JSON bytes**. That is about 0.95% of decoded size, not a
measurement of gzip or runtime-heap savings. This audit leaves the trained asset
unchanged. Repacking a 102 MB artifact solely for that duplication would be a
small storage result with substantial evidence churn; reducing redundant
inference or distilling useful libraries is a more consequential experiment.

The runtime now rejects unsupported archived `proximityCorrection` behavior
rather than silently ignoring it, validates mixture weights, and handles a
one-tree forest without an empty odd-tree mean. Existing forest fixtures still
match. The startup exporter no longer hardcodes a 176-example catalog: it
accepts nonempty data with a consistent supported 57- or 67-feature schema.

One remaining feature-contract issue deserves a versioned experiment: the
startup contact frame is 1 while the opening authored span starts at 0, and
the existing upcoming-span lookup consequently does not encode the opening
span's targets as current targets. Changing runtime feature meaning underneath
the already-trained artifact would be unsafe. A corrected contract needs
retraining and matched replay/export checks; it was not silently changed here.

### 6. Experimental identity and current documentation were brittle

The V4 and jitter tools used fixed historical compiler-file lists. They now use
the existing shared source inventory so new compiler modules are automatically
included. Jitter identity compares source/build content; descriptive Git status
for unrelated documentation is excluded. One earlier full direct-transfer panel
finished all cells but tripped that status-only check. Its compact evidence
explicitly records the independent source/checksum review; it is not presented
as an originally successful command.

An old fixed-N planning test unnecessarily loaded a large local historical
archive. It now plans from the historical manifest without opening that archive,
while the separate active-baseline integrity assertions remain. This removes an accidental
build/test dependency on an ignored archive.

`HOW_TO_WORK.md` now describes current V4 work. Its previously interleaved V2
campaign instructions are preserved in [a historical reference](compiler-v2-workflow.md).
The compiler-goals document and documentation index no longer present the old
44-case sequential-promotion ladder as the current arc workflow.

## Results and tradeoffs

| Variant | Full V4 research | Public V4 canonical | 2% search-target jitter |
|---|---:|---:|---:|
| Prior compiler | 952.4115; 176/176 valid | 952.4115; 352/352 valid | 874.7027 mean; 176/176 valid |
| Direct interval transfer and expressive filtering, `3a640fe4` | 952.5059; 176/176 valid | 952.5059; 352/352 valid | 871.1062 mean; 175/176 valid |
| Physical-state memory with shared controls, `e374c022` | 952.5191; 176/176 valid | 952.5191; 352/352 valid | 874.0738 mean; 176/176 valid |

The selected memory version improves the V4 headline by **0.1076**. Its jitter
mean declines by **0.6290**. This is a disclosed development-panel tradeoff,
accepted for the simpler transfer mechanism and full completion. Of the 176
paired jitter scores, 61 improve, 72 regress and 43 are unchanged. This is not evidence
of statistical superiority or unseen-input robustness. The direct-transfer
failure probe influenced the selected design and is therefore development
evidence, not a holdout success.

The eight changed V4 research cases include a **+38.5037** improvement on the
4-second low-air endurance case and regressions of **−7.4006** on 240 ms dense
recovery and **−3.7513** on 6-second low-air endurance. All are valid. Full
per-case evidence is linked above; no case-specific production overrides were
added to suppress those regressions.

Total measured research work changes from **130,674,351 to 130,638,842** frames.
Planning changes from **43,585,831 to 43,630,441** frames; candidate requests
from **6,214,181 to 6,231,374**, and memo hits from **1,106,815 to 1,127,464**.
This is not a major physics-work saving. Cached requests do not imply repeated
physical work, and their hit count alone does not quantify saved frames.

One 37.69-second sampled process included model loading, compilation and cold
grading for `stretch_music_shelter_impact_sync_81s`. Selected self-sample shares
were 8.58% in learned proposal retrieval, 8.01% in detection and 7.59% in garbage
collection, alongside substantial WASM physics. The process ran alongside
other work. Neither these samples nor differently scheduled panel timings are
a controlled wall-clock speedup claim.

## Follow-up: the 99% finding is an immediate scheduling problem

The owner challenged the work-share interpretation. Rechecking both the shared
frame counter and every attempt's start/end confirms that general search uses
**99.005%** of measured simulated physics work on the prior full V4 research
panel, and **99.0048%** after this audit. These are simulation-work shares, not
elapsed-time shares or an assertion that every one of those frames is useless.

The stronger finding is the counterfactual below. Keep the existing preliminary
attempt, return it when physically complete, and run the current general search
only when it fails. On the recorded complete 176-specification, seed-16 panel:

| Policy | Frozen V4 score | Valid | Simulated physics frames |
|---|---:|---:|---:|
| Current unconditional second attempt | 952.5191 | 176/176 | 130,638,842 |
| Accept complete preliminary tracks; retain failure fallback | 952.4696 | 176/176 | 4,995,415 |

That is **96.1762% less simulated work for a 0.0495-point score reduction**.
The three preliminary tracks displaced by general search were regenerated and
cold-graded with the unchanged judge; their exact hashes, losses and physical
work match the original attempt records. The other results reuse the already
verified selected preliminary tracks and unchanged five failure recoveries.
This is a checked retrospective counterfactual, not a deployed compiler change,
a new 352-run canonical qualification, or a measured 26.15-fold wall-clock gain.
See [the complete counterfactual and verification script](../benchmark/v4/studies/compiler-design-work-counterfactual-20260911.json).

The cheap pass uses learned demonstrations from exposed development inputs,
including these benchmark specifications. It can reproduce strong demonstrated
trajectories cheaply. This explains why a full general search has little marginal
value on that panel; it does not establish that general search is dispensable.
On the separate 44-case target-jitter panel, only **43/176** runs complete in the
preliminary attempt; the other **133/176** complete through general search.
These are different inputs, so this comparison is not a controlled estimate of
the effect of adding jitter to the full V4 suite.

The initial audit underemphasized the scheduling consequence. State-memory
transfer is a useful simplification, but it leaves the unconditional second
attempt in place and barely changes its total cost. The immediate architectural
priority is an explicit policy for accepting or improving a completed incumbent,
while preserving general search for failed proposals. Optional further work
should be justified by measured improvement, rather than performed merely
because unused budget remains. The production policy is unchanged by this
read-only follow-up.

## Further work supported by the evidence

1. **Improve a complete incumbent deliberately.** Most search budget still fails
   to beat the preliminary trajectory. Use the new attempt records to compare
   selected local repair, suffix rebuilding and continuing general search,
   charging replay and reconstruction costs. A per-interval demonstration alone
   does not guarantee a compatible continuation.
2. **Version physical/target feature contracts.** Correct startup target context
   with retraining, then test unfamiliar rhythms and changed target combinations.
   More deterministic zero-jitter seeds cannot answer that question.
3. **Extend geometry through the shared contract.** New tangent schedules,
   independent late easing or guide shapes can reuse construction and repair.
   Diversity should preserve useful alternatives; video review should decide
   whether resulting patterns remain attractive.
4. **Measure inference and memory costs before redesigning the model.** The
   profile supports studying retrieval, loading and allocation, but simple exact
   duplicate removal alone has limited measured headroom. Test flattened or
   distilled models against exact proposals and complete physical outcomes.

The retained legacy backend still serves reference engines, unsupported axes,
snapshots, hook diagnostics and small-budget requests. Completed-track repair
and historical control proofs remain explicit research mechanisms. Their
presence is not evidence they are dead; their [roles are documented](../scripts/v0/optimizer/README.md).

## Validation and reproduction

The selected source passes **165 tests in 42 files**, including physical replay,
control/memo semantics, memory, refinement, telemetry and build-free reference
imports. The global TypeScript command retains exactly **251 pre-existing
diagnostics**; its complete output is byte-identical to the preceding audit
revision. It is not a clean repository-wide typecheck.

Use `audit_arc_design.py` to regenerate the behavioral comparison from checked
raw research directories, and `audit_arc_policy.py` to regenerate the model
inventory. Pilot evidence includes exact source patches. Final canonical
preservation verifies all 352 research track, score and physics-frame matches,
plus normal connected geometry, against the public dispatcher. All 176 final
jitter tracks, scores and deterministic stats also match the pre-registry
`489e2550` panel exactly. The independent Newton-path before/after check matches
track, report and work byte for byte.
