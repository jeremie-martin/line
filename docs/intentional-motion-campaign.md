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
