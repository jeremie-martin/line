# Architecture

This describes the system as it is. Problems are flagged, with the rework
phase that addresses them; see [REWORK.md](REWORK.md).

## Pipeline

```
spec (beats, impacts, air/speed/amplitude targets)
  → plan:      seeded arrangement of construction requests per support section
  → construct: interval-by-interval geometry search with native physics
  → validate:  independent replay, layout fulfillment, motion summary
  → review:    native player with music; optional vertical video render
```

1. **Entry.** `compileHandoff` (`scripts/v0/optimizer/handoff.ts`) accepts a
   spec and either creative preferences (automatic arrangement) or an explicit
   intentional construction plan (`line.repertoire-policy.v2`, as in the V6
   fixed panel). Nothing else is supported.
2. **Plan.** `planIntentionalRepertoire` (`intentional_repertoire.ts`, built on
   `repertoire_policy.ts`) chooses a construction for each support section:
   open arc, guided shape (arcs, folds, ripples, serpentines, terraces), or
   scattered segments. It also chooses paired versus later-receiver rail
   layouts, grouped into short repeated phrases. It is seeded and reproducible,
   and it uses the requested impact and speed (for example, calm passages
   favour open arcs). An explicit plan bypasses this step (V6 fixed panel).
3. **Construct.** `compileProductionRepertoire` (`production_repertoire.ts`)
   gives one total physics allowance to `compileArcMotion` (`arc_motion.ts`),
   configured by `ArcMotionOptions` (`arc_options.ts`). The search runs section
   by section (`arc_sequence.ts`); for each section it:
   - proposes geometry (`arc_proposals.ts`) from several sources: the
     parametric centre, learned retrieval (`arc_control_policy.ts` and the
     construction models), memory of earlier sections, response directions,
     and observed receivers;
   - measures each proposal by native replay from the section's physical
     start (`arc_evaluate.ts`, state in `arc_interval_state.ts`);
   - refines the best with coordinate, guide and joint-response steps
     (`arc_local_search.ts`);
   - retains up to eight distinct, physically replayed prefixes, ranked by
     accumulated local loss, the existing arrival preference and predicted
     future cost; the remaining allowance can reduce that width;
   - keeps all distinct untried measured alternatives at four recent boundaries,
     reopening at most eight at a time after a physical dead end; recovery
     shares the allowance and preserves the longest prefix on interruption;
   - finishes with terminal selection and ending refinement
     (`arc_complete_refinement.ts`, `arc_refinement.ts`), then a cold replay
     checked against an independent engine (`arc_finalize.ts`).

   Every evaluation is native physics, charged to the allowance. Measurements
   are memoized per physical prefix; `EVALUATION_IDENTITY` (`arc_options.ts`)
   classifies every option by whether it can change a measurement.

   Scattered sections use resolved collision positions from the carrier's
   original simulation. Reading those cached records advances no physics;
   the resulting fragments then undergo ordinary physical evaluation. There
   is no second observer engine or contact-window replay.

   Native engine versions share a physical cache within a lineage. Live
   descendants and the current cache retain the ancestry they need; released
   branches are reclaimed immediately when neither needs them. Handle slots
   remain reserved until lineage death. The independent judge is unchanged.
   Native compiler engines have a synchronous ownership scope. Search pruning
   and final replay release only this compilation's handles; caller-owned replay
   engines survive both success and failure. Independent continuation-label
   collection uses the same boundary. The frozen judge uses its private
   replay instance.

4. **Validate.** The finished track is replayed on a separate engine instance.
   That replay produces:
   - layout fulfillment, i.e. whether each requested construction actually
     happened (`repertoire_layout.ts`);
   - motion summaries (`motion_quality.ts`);
   - the strike impact account, recomputed independently and required to
     equal the compiler's (`impact_accounts.ts` over
     `scripts/lib/strike_impact.ts`).
5. **Review.** `scripts/produce/automatic.ts` writes a manifest of track, report
   and evidence that `motion-gallery/production.html` plays with the real rider
   and the music. `render_repertoire.ts` renders vertical video when wanted.

## Measurement

**The product's impact objective is the strike account, `line.strike.v3`.**
It lives in `scripts/lib/strike_impact.ts`; the definition, its rationale and
the evidence are in `docs/research/strike-definition-20261004.md`.

- **Signal.** The rider's whole-body motion: the velocity of its 10-point
  centre of mass, exactly ballistic in free flight, and its angular momentum
  about that centre.
- **Identity.** Contact acceleration identifies events: every touchdown, plus
  any renewed strike within continuous contact. Steering is not an event.
- **Timing.** Events are timed at their half-rise.
- **Strength.** How much the hit changes the rider's whole-body motion, its
  travel (direction and speed) and its spin, within 50 ms, on the established
  0–1 scale (7.55 px/frame = 1).
  - A head-on stop counts as fully as a turn.
  - A long smooth bend counts little.
  - Chosen on the owner's blind pair judgments: 46 of 63 decisive pairs,
    against 31 of 63 for v1's redirection strength, on pairs chosen where the
    measures disagree (head to head, 22 : 7).
- **Opposite pushes (v3).** A push reversed by more than 120° from the
  current impact's peak push (a floor hit, then the upper rail) starts a new
  impact. An unrequested second hit therefore costs as an extra.
- **Matching.** Events are matched one-to-one to beats; unmatched strikes cost
  their strength squared.

`line.strike.v2` (without the opposite-push rule) and `line.strike.v1`
(strength = centre-of-mass redirection) stay as comparisons.

The compiler uses accounts only through `impact_accounts.ts`. Search,
refinement, terminal selection, the final replay, production and the review
all observe and account through one interface. Terminal selection, complete-track
refinement and final selection also share `arc_objective.ts`: the trajectory loss
and each physical-support motion/engagement cost are included exactly once. Its search profile is in
`contact_impact_profile.ts`, chosen on the song-level evaluation (REWORK.md
log):

- **Preparation:** 2 frames.
- **Steep arrival before strong asks (≥ 0.6):** the catch before a strong
  beat gets a steep, ask-driven arrival heading and speed.
- **Upright arrival:** steep and unguided passive catches share a soft
  preference against head-down or backward arrivals. This does not forbid
  inverted geometry or guided upper contacts.
- **Future ranking:** a single geometry-aware model predicts the next two
  intervals. It ranks alternatives; it does not supply local response gradients.
  Its training groups exclude the four production evaluation songs.
- **Construction policies:** v3's own, rebuilt under v3 on songs disjoint
  from the evaluation panel (`repertoire_policy_model_v3.json`; trainer in
  `tools/research`). v1/v2 and landing keep the V6-era policies.

Measured limits (docs/research/producing-impact-brief-20261004.md):

- **Achievable strength.** About 0.06 at the bottom (the gentlest
  touchdown) and 1.0 at the top for an isolated near-vertical drop onto flat
  ground. At 45° the rider crashes above about 0.9
  (`tools/measure/survival_envelope.ts --fine`). In dense passages, time and
  energy cap strength near 0.6–0.7.
- **The frontier past the adopted changes.** A slam at an angle costs speed,
  which the spec's speed target charges for, and sharper turns crash.

Two other rulers remain on purpose:

- **Frozen V6 landing impact** (`docs/research/impact_definition.md`).
  - It is used only by the V6 judge (`benchmark/v6`).
  - It is also used by the `landing` compile mode, which is the previous
    objective, kept temporarily so the owner can compare.
- **`line.contact-impact.v1`**, the strike account's predecessor. It is a
  research diagnostic in `tools/measure` only.

Known limits of the strike account:

- **Strength scale.** The pair judgments validate ordering, not the absolute
  scale. The owner has never called a compiled hit harder than "medium".
- **Quiet requests.** Requests below about 0.05 sit near the floor of any
  gentle touchdown; quiet beats read about 0.03–0.05 strong.

## Evaluation

- **V6** (`benchmark/v6`, `npm run sentinel`) is a frozen regression sentinel.
  - It has 460 canonical runs: a fixed-construction panel and an automatic
    panel, with a fixed 3M-frame budget.
  - It is frozen by outputs: `npm run parity:judge -- --all` must reproduce
    every stored score.
  - **It is not a target.** It is inversely related to measured hit clarity,
    its gains were mostly completions, and all of its inputs were used to
    train the learned models.
  - It compiles in `landing` mode. Its 460-run regression check passed at the
    end of Phase 2 (identical to the stored reference).
- **`npm run eval`** (`tools/eval`) is the behavioural evaluation.
  - Panels: `--panel=dev`, the one decisions were made on, and
    `--panel=confirm`, with fresh seeds and perturbations, for checking that
    an adopted change generalizes.
  - Every run is scored under every account (v1, v2, v3).
  - Guard rows from the blind-spot audit: head-down/backward strong
    arrivals, body drag, off-beat kicks.
  - `tools/eval/inputs.ts` resolves authoring and timing before compilation.
    `records.ts` binds every result to that immutable plan and verifies the saved
    track hash. `loadRun` requires exactly the declared panel; only resume may
    inspect a partial run. Worker failure and an incomplete ride are distinct.
  - Measurement code has a separate fingerprint from the historical compiler.
    It follows imported dependencies and records both replay engine artifacts.
    Paired reports and studies require identical resolved inputs and measurement
    fingerprints. The report displays both compiler and evaluator provenance.
  - `measure.ts` is the one cold measurement path for compilation and explicit
    remeasurement. Old formats never enter the current cache implicitly.
  - Each cell keeps per-beat and per-gap data and the compiled track
    (`.track.json.gz`).
  - `tools/eval/summary.ts` holds the shared summaries.
  - It compiles the production songs × 4 arrangement seeds, plus perturbed
    authorings, and pairs runs by case.
  - Intervals come from resampling songs, and completion is reported
    separately from quality.
  - It reports every ruler, including measures the compiler does not
    optimize: the renewal-fixed strength, peak timing and contested beats
    from the 10-point external impulse. R1 bend peaks are labeled R1, not v3.
    V3 opposite-push boundaries come directly from the detector, with both
    adjacent strengths; no difference of thresholded event counts is used.
    These diagnostics do not change the optimized impact contract.
  - Every matched v3 hit records onset, force peak, first contact and its arrival
    posture. The blind selector consumes that same first-contact observation;
    clip centering remains at onset. Existing study IDs cannot be overwritten.
    Review render reuse checks track, authoring, rendering inputs and movie bytes.
  - Held-out new music is still missing; it needs new songs.
- **`tools/report`** builds the overnight results page
  (`motion-gallery/night.html`): `night.ts` writes the data, `clips.ts`
  cuts before/after clips, `scale_clips.ts` shows the strength scale
  physically, `morning_study.ts` builds blind pair keys.
- **`tools/measure`** holds the per-beat measures across rulers (`measures.ts`)
  and the motion check of a review library (`motion_check.ts`).
- **`labels/studies`** holds the blind owner labels.

## Known structural problems (next)

- **Compiler leftovers after the split.**
  - Options that were constant in every production plan are gone (branch
    `rework/constant-options`). What remains varies with the allowance, the
    section or the interval: `guidance`, `completeBoundary`, `futureValueModel`,
    `initialRecoverySamples` and the sample counts.
  - Numeric settings that production never varies (weights, `channel`,
    `radius`, the refinement and memory allowances) are
    still options, because tests set other values.
  - `arc_geometry.ts` still accepts the `flow` and `wave` arguments and rail
    contours, which no production caller uses; the gallery catalog lists the
    wave and contour recipes (contours archived). Faceted arcs (`subdivisions`)
    are live.
- **Budget rules are saturating caps tuned to V4.**
  - Local sample caps are in `connected_arcs.ts` and `repertoire_search.ts`.
    The default allowance (`production_budget.ts`, 1,700 frames per ride
    frame) saturates many of them. Prefix width and local sampling now adapt
    to observed physical work and the remaining timeline; a larger allowance
    does not automatically imply a better allocation.
  - Persistent-prefix expansion now shares the construction allowance. The
    previous two-interval lookahead and neighbor-response paths are removed.
  - Results are not monotone in budget.
  - The October 5 campaign improves impact loss, but does not eliminate allocation
    failures: the 336-case catalog exchanges one completion for another. A long
    supported 93-second case takes about twice the original CPU cost, while six
    production inputs cost 6.9% more. Physical frames alone are not a CPU model;
    see `docs/research/quality-20261005-decision.json`.
- **Duplication.**
  - There are two physics engine copies: `engine-rs` (judge) and
    `scripts/lib/native_motion` (compiler facilities).
- **Judge and compiler share files.** These are `types.ts`, `repertoire_layout.ts`
  and `motion_quality.ts`, and line-to-section attribution relies on the line-ID
  numbering convention `floor((id − 1000) / 10000)`. Since V6 is frozen by its
  outputs, these files can now be cleaned safely, provided `npm run parity:judge`
  stays green.
- **Comparison objectives.** Besides the product's v3, the `landing` compile
  mode (the V6 sentinel) and `line.strike.v1`/`v2` remain comparison measurement accounts. They share
  the current search; reproducing old compilers requires their recorded revisions. They go, with the landing-specific validity rules in
  `arc_evaluate.ts`, once the owner is satisfied.
- **Geometry families are not modular.** A new profile touches about 10 files.

Production collections declare their timing offset and resolved song identities.
Every saved member must agree with the collection's compiler, request and input
identity before it can be indexed or reused. Render and index phases use saved
inputs; compilation also checks them against current inputs. Failed jobs remain
visible and the batch exits unsuccessfully.
Concurrent jobs settle before the batch releases its directory lock or stops a
shared rendering server, including when a worker fails.

Future-model collection uses frozen physical prefixes and an independent native
probe allowance. Its declared plan binds compiler, collector, inputs, work and
search settings. Resume and training reject missing, stale or undeclared records;
a complete compile with no observations is an error. Budget interruptions are
not labelled as physical dead ends. Raw collections remain local.
