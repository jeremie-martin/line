# Intentional motion campaign

Approved in full on 2026-10-01. Scope: [roadmap](intentional-motion-roadmap.md).
Baseline documentation and production: `ca97d100`; compiler `0846b2e5`.
Existing qualified compiler checkout: `/tmp/line-v5-qualified`.
Raw studies and runs: `generated/intentional-motion/` (local).
Native physics, normal-line constraint and V5/V4 definitions remain unchanged.

| Stage | Status |
|---|---|
| Motion calibration and native observations | Implemented; frozen with V6 |
| Context policy and intentional rail-layout pilot | In progress |
| V6 freeze and baseline | Definition frozen; baseline next |
| Shared search and accuracy campaign | Pending |
| Qualification and integrated production review | Pending |

## Baseline preservation and implementation start

The delivered four-song, twelve-arrangement library remains under
`generated/production-repertoire/library-qualified`. Owner-reported passages,
all three Luna/Tiki opening seeds, and energetic controls form calibration anchors.
The full previous motion study is retained. Baseline TypeScript diagnostics are
captured before source changes; no claim of a clean repository typecheck is made.

## Native observations and first controlled studies

[Compact development evidence](evidence/intentional-motion-pilot-20261001.json)
contains the completed first two panels. Native velocity-derived observations
match the prior full-state measurements to <4e-15. All three reported bursts
exceed the pilot 100ms band. These bands remain provisional before the V6 freeze.

Pilot 1b tests baseline and two motion weights on four fixed V1 plans without
phase boundaries. All twelve runs remain physically valid and fully fulfilled.
Stronger motion weighting reduces bursts substantially, with mixed score changes:
Luna 303 751.72→828.16; Tiki 303 746.24→733.08. This is not the production plan
comparison; pilot 2 uses actual production phase boundaries and preserves its
baselines separately. A missing local audio link caused twelve orchestration
errors before pilot 1b; the failed launch remains local under `pilot-1`.

Pilot 2 adds independent guide rotation and contextual arrangements. The exact
saved production baselines reproduce. Musical effects are mixed: guide rotation
with moderate motion pressure gives Luna 303 830.60→809.74 and Amour 101
434.55→482.87, while both reduce burst severity. Stronger weights are not simply
better. Whole-track contextual rides complete, but final layout fulfillment
exposes a search/checker mismatch: search previously observed sled contacts;
independent checks include rider-body contacts. Exact replays of sections 18 and
37 in Luna confirm that a purported collision-free frame actually had a body
contact. `ae15701f` introduces a cached all-contact reader, aligns the new search,
and prevents guide pruning from invalidating a fulfilled requested construction.
The frozen V5 checker and original physics remain untouched.

The new layout checker distinguishes physical flight/receiver interaction from
line deletion and checks engagement with shaped portions. Its calibration and
fixed-window probes continue. V6 is not frozen; no numerical achievement or
motion-quality completion is claimed from these pilots.

## V6 contract freeze

The [V6 definition](../benchmark/v6/README.md) freezes 115 canonical cases × four
seeds and 74 confirmation cases × four disjoint seeds. It preserves the existing
music and musical judge, includes paired/transfer variants within family weights,
and reserves fourteen musical source selections outside the V5 repertoire catalog.
Those inputs were exposed in earlier ordinary benchmarks; they are not unseen music.
Motion qualification uses all twelve preserved valid production tracks and the
owner's named windows; broader V6 motion distributions remain mandatory diagnostics.
The headline never filters on motion. Physics allowance remains three million.

The corrected layout pilot completed contextual rides on all four songs. A stricter
rider-position check then identified one remaining unsupported-receiver-location
failure on each of three tracks; the compiler now checks that same actual position.
Fixed-window prototypes complete three transfers for arcs, S sweeps, ripple and
terraces across Luna and Amor. Folded transfer is physically demonstrated on Amor,
but both three-fold sequences exhaust the allowance after the first requested fold.
This is retained compiler work, not grounds to erase that family or weaken its check.
Raw pilot-3 includes ten invalid research-option launches (500 recovery samples,
above the existing 320 limit); corrected trials are under `layout-pilot-3b`.

Checks before freeze: new motion, contextual-plan, native all-contact, transfer
negative-control and frozen-V5 tests pass. The global typecheck retains the same
inherited diagnostics after normalizing changed source line numbers (576 output
lines); no additional diagnostic remains. Compiler changes and raw study records
are preserved separately from the frozen V6 contract.

## Post-freeze construction and continuation experiments

V6 was frozen at `7f8591c6`; its complete baseline is running from a detached
checkout. No canonical confirmation outcomes have been inspected. The following
are development probes, not V6 headline results.

`1926e1f9` extends initial construction proposals to cover guide tilt, clearance,
fold face angle and transfer extent before the first feasible construction. The
previous implementation explored most guide coordinates only after finding a
valid candidate. The fold's two engaged corners remain mandatory. Matched
three-fold transfer passages on Luna 101 and Amor 101 changed from budget failures
to complete, fully fulfilled tracks scoring 898.7760 and 905.5950. Four complete
V2 arrangements also fulfilled every request, with mixed musical accuracy. Raw
outputs and failed outcomes are retained in `generated/intentional-motion/proposals-1`.

The ordinary future-value model assumes future guided ordinary constructions;
it does not know the requested mixed-plan construction. Matched ablations in
`arrival-1` test removing that prior, changing the incoming-angle prior, and deeper
native continuation. Amour 101 improves from 417.0092 to 594.1386 with the
incoming-angle prior and without the ordinary learned value. Tiki 303 improves
from 663.7291 to 758.7156 with deeper continuation, while that same change barely
helps Amour. These results justify testing mechanisms across contexts rather
than applying a song-specific recipe. `7f46bdd9` additionally tests passive-catch
speed headroom; `arrival-2` preserves its paired results and alternatives.

The independent production qualification tool at `5ec239d1` replays both complete
collections, verifies musical identities and saved native traces, and applies the
frozen criteria without dropping failed tracks. Its baseline-versus-itself control
correctly fails the required improvements and all three reported burst windows.
Tests cover omissions, duplicates, incomplete realization and an individual
window failure hidden by otherwise passing aggregate burst statistics.

The first complete replacement production collection (`library-candidate-1`,
compiler `c94f0a00`) is development evidence, not a qualified delivery. Eleven of
twelve tracks complete and fulfill; Amour 202 is incomplete. All three reported
windows pass the frozen 100 ms band. Aggregate burst excess falls substantially,
but Tiki's opening speed correction and the six-opening mean impact RMS still
fail. See the independent `qualification-candidate-1/qualification.json`. All
12 ordinary reference track hashes exactly match the preserved collection.
Native playback, rapid seed switching, synchronized audio, three-way comparison,
passage-link reload and mobile layout pass the updated browser checks. The
preserved review collection remains the dashboard default during development.

Repairing native-feasible construction near misses at `a5cc8708` completes the
previously failing Afterglow folded-transfer requests for seeds 101 and 202.
Using ordinary arrival/value guidance in ordinary surroundings scores 889.0502
and 895.0766; globally replacing those priors scores 807.4759 and 806.0904.
The canonical Accelerando ending remains unsuccessful. Its diagnostic rejects
show a different mechanism: a 226-frame final interval received enormous support
proposals, causing prefix collisions/binding before construction checking.
The next experiment restores short capture proposals within long intervals
rather than weakening the transfer definition or removing the ending request.

The first recovery harness launch imported the musical adapter from the wrong
module and exited before compilation. Those logs are retained in `recovery-1`;
the corrected scheduled runs are in `recovery-1b`. These are execution failures,
not evidence against a construction method.

## Motion context, long intervals and useful search work

The startup support had no preceding impact, so the first motion-aware search
silently treated it as non-calm. It now uses the upcoming authored impact when
there is no preceding one. This changes a genuine missing-context case, without
song or timestamp rules. In `startup-1`, Tiki 101's opening absolute correction
falls from 6.518 to 3.015 with the otherwise corresponding contextual search.
Increasing all calm-motion penalties was not reliably better; those unsuccessful
alternatives remain in `calm-1` and `startup-1`.

`664db8ea` offers both relative and demonstrated absolute support durations in
transfer memory, and scales construction repair to the actual short support.
The previously incomplete Accelerando folded ending then completes for seeds
101 and 404. Its score is only 205.9947: early release leaves a long inaccurate
flight. Completion is progress, not a musical-quality success. Further work
allows the three fold faces to distribute their duration more freely, retaining
their headings and the frozen native corner-engagement checks.

The shared whole-track refiner now supports mixed geometry with native
construction validation and correctly tracked engine prefixes, including
scattered continuations. Its first eight-run study (`refinement-1`) is negative
on efficiency: three complete music tracks spend roughly another million frames
for no meaningful gain (Tiki 101 gains 0.1152; Luna and Amour are unchanged).
The incomplete long ending remains incomplete. Refinement is therefore not
enabled in the production defaults. Subsequent work adapts warm continuations
to the newly reached incoming direction and preserves their updated state
metadata; this is a hypothesis to test, not a claimed improvement.

Proposal accounting exposed another limitation: learned ordinary-arc proposals
plus the two memories could consume every initial slot. `coverage-2` compares
zero versus 25% reserved fresh proposals on five identical requests/seeds, with
a third calm-impact-weight variant. The musical results are mixed, so the next
implementation reserves fresh slots specifically for profiles and transfer
layouts absent from the inherited model's constructor. The named studies save
their exact schedules, all completed outcomes, per-stream actual physics work
and failures. `continuation-1` separately tests fewer, more thoroughly refined
continuations and time-weighted musical loss; neither is assumed superior.

Construction-specific demonstration reuse is also being tested through the
existing scoped memory, rather than a separate optimizer. The first corpus has
3,415 locally fulfilled examples in 11 physical constructor groups; lookup uses
incoming state and musical targets, never song/seed/section identity. All Amour
sources are excluded from this corpus for the development comparison, and the
reserved V6 confirmation remains untouched. The compressed corpus and complete
source hashes are local under `construction-examples-1.json.gz*`. Its efficacy
and deployment status remain open pending `examples-1`.

## Complete V6 development comparison

Both complete canonical panels have finished, using the same frozen V6 contract,
115 cases × seeds 101/202/303/404 and a three-million-frame allowance:

| Compiler | Headline | Fixed | Automatic | Valid and fully realized | Distinct tracks |
|---|---:|---:|---:|---:|---:|
| Minimal integration `7f8591c6` | 536.3321 | 851.8838 | 220.7804 | 406/460 | 315 |
| Candidate 2 `664db8ea` | 661.4244 | 889.7542 | 433.0945 | 445/460 | 316 |

Neither panel has an execution error. There are 404 matched-valid runs, 41 newly
completed runs, two validity regressions and thirteen failures shared by both.
The new task's headline is not directly comparable to V5. The 850 ambition remains
unfinished; the complete automatic arrangements remain the main weakness.
The [compact 920-cell record](evidence/intentional-motion-v6-development-20261001.json.gz)
preserves every result, plan, compiler identity and raw-run checksum. The
[motion comparison](evidence/intentional-motion-v6-motion-20261001.json) reports
all observed tracks, matched-valid tracks, new completions, regressions, worst
cases and musical-parent bootstrap intervals separately. Matched-valid excess
burden decreases in each of the three frozen bands. This does not replace the
separate twelve-track production qualification.

`local-2` tests translated and reflowed suffixes with twenty repair attempts on
three complete songs. Translation accepts no improvement; reflow makes six small
whole-objective improvements on Tiki but changes its musical score by −0.0813.
Most attempts fail continuation or functional construction checks. This remains
disabled, and the recorded failures explain why spending the remaining budget
on this mechanism is not currently useful.

`examples-1` has twelve scheduled, completed outcomes. Reusing construction
examples and time weighting improves Tiki 101 from 775.4690 to 818.5625 while
using 1.65m rather than 1.91m frames; the difficult fixed folded ending completes
at 548.8672 rather than failing. Amour 303, excluded from the demonstration
corpus, improves modestly with examples alone but loses with time weighting.
These mixed results do not justify a universal time-objective switch.

`examples-2` compares original-target and achieved-target demonstration features,
then bounded exploration of physically valid construction near misses. Relabeling
alone is not reliably better. The near-miss exploration improves dense-dialogue
303 from 311.7189 to 672.2646 under the same relabeled corpus and completes
Afterglow 202 at 521.0168. Coordinate-only exploration is nevertheless ineffective
on the difficult ending from an identical captured state (`tail-frontier-1`).
The next implementation measures coupled responses while retaining exactly the
same native construction acceptance conditions.

`budget-1` uses four unchanged requests/seeds at 750k, 1.5m, 3m and 5m; the four
3m cells are reused, without recompilation or result selection, from `aligned-1`'s
declared base configuration. Additional allowance can recover completion, but
does not guarantee better accuracy. Amour 303 scores 506.4656/540.8214/588.6822/
564.2269. Afterglow 202 fails at 750k and 3m but completes at 1.5m and 5m.
Search-path changes and feasibility need attention; more budget alone is not a
validated solution.

The twelve-run `aligned-1` experiment anchors a fold on its actual first face
rather than its inherited approach tangent. This removes an extra approach
corner, but reduces feasibility on the selected canonical cases. It is not a
production default. No failed example was erased or relabeled as a success.

Future V6 runs now preserve the already computed construction controls and
incoming-state features alongside tracks and scores. Earlier runs did not save
those fields, forcing avoidable recompilation for some diagnoses. This adds
research evidence only; frozen judging, plans and aggregation are unchanged.
