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
   - looks ahead to the next landing (`arc_lookahead.ts`) and may revisit the
     previous or next section (`arc_neighbor_revision.ts`);
   - backtracks when a later section becomes infeasible;
   - finishes with terminal selection and ending refinement
     (`arc_complete_refinement.ts`, `arc_refinement.ts`), then a cold replay
     checked against an independent engine (`arc_finalize.ts`).

   Every evaluation is native physics, charged to the allowance. Measurements
   are memoized per physical prefix; `EVALUATION_IDENTITY` (`arc_options.ts`)
   classifies every option by whether it can change a measurement.
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

**The product's impact objective is the strike account, `line.strike.v1`.**
It lives in `scripts/lib/strike_impact.ts`; the definition, its rationale and
the evidence are in `docs/research/strike-definition-20261004.md`.

- **Signal.** Everything derives from the velocity of the rider's 10-point
  centre of mass, which is exactly ballistic in free flight.
- **Identity.** Contact acceleration identifies events: every touchdown, plus
  any renewed strike within continuous contact. Steering is not an event.
- **Timing.** Events are timed at their half-rise.
- **Strength.** Centre-of-mass redirection on the established 0–1 scale.
- **Matching.** Events are matched one-to-one to beats; unmatched strikes cost
  their strength squared.

The compiler uses accounts only through `impact_accounts.ts`. Search,
refinement, terminal selection, the final replay, production and the review
all observe and account through one interface. Its search profile is in
`contact_impact_profile.ts` (preparation 2, chosen on the song-level
evaluation).

Two other rulers remain on purpose:

- **Frozen V6 landing impact** (`docs/research/impact_definition.md`).
  - It is used only by the V6 judge (`benchmark/v6`).
  - It is also used by the `landing` compile mode, which is the previous
    objective, kept temporarily so the owner can compare.
- **`line.contact-impact.v1`**, the strike account's predecessor. It is a
  research diagnostic in `tools/measure` only.

Known limits of the strike account:

- **Strength scale.** It is validated perceptually only on lower landings,
  using the June/July felt labels.
- **Head-on stops.** They are detected as events but under-read in strength
  (a stop is not a redirection).
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
  - It compiles the production songs × 4 arrangement seeds, plus perturbed
    authorings, and pairs runs by case.
  - Intervals come from resampling songs, and completion is reported
    separately from quality.
  - It reports every ruler, including measures the compiler does not
    optimize: the renewal-fixed strength, peak timing and contested beats
    from the 10-point external impulse.
  - Held-out new music is still missing; it needs new songs.
- **`tools/measure`** holds the per-beat measures across rulers (`measures.ts`)
  and the motion check of a review library (`motion_check.ts`).
- **`labels/studies`** holds the blind owner labels.

## Known structural problems (next)

- **Compiler leftovers after the split.**
  - Options that were constant in every production plan are gone (branch
    `rework/constant-options`). What remains varies with the allowance, the
    section or the interval: `guidance`, `budgetAdaptiveLocal`,
    `completeBoundary`, `futureValueModel`, `lookaheadWidth`,
    `initialRecoverySamples` and the sample counts.
  - Numeric settings that production never varies (weights, `channel`,
    `radius`, `qualityRetries`, the refinement and memory allowances) are
    still options, because tests set other values.
  - `arc_geometry.ts` still accepts the `flow` and `wave` arguments and rail
    contours, which no production caller uses; the gallery catalog lists the
    wave and contour recipes (contours archived). Faceted arcs (`subdivisions`)
    are live.
- **Budget rules are saturating caps tuned to V4.**
  - The caps are in `connected_arcs.ts` and `repertoire_search.ts`. Every
    width saturates by about 0.52M frames on 45 s songs, and the default
    allowance (`production_budget.ts`, 1,700 frames per ride frame) runs them
    saturated.
  - Lookahead uses about 74% of the physics frames.
  - Results are not monotone in budget.
- **Duplication.**
  - There are two physics engine copies: `engine-rs` (judge) and
    `scripts/lib/native_motion` (compiler facilities).
- **Judge and compiler share files.** These are `types.ts`, `repertoire_layout.ts`
  and `motion_quality.ts`, and line-to-section attribution relies on the line-ID
  numbering convention `floor((id − 1000) / 10000)`. Since V6 is frozen by its
  outputs, these files can now be cleaned safely, provided `npm run parity:judge`
  stays green.
- **Two impact objectives during review.** The `landing` compile mode stays
  only until the owner has compared it with strike. Then it, and the
  landing-specific validity rules in `arc_evaluate.ts`, go.
- **Geometry families are not modular.** A new profile touches about 10 files.
