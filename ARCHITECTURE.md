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
   construction plan. Nothing else is supported.
2. **Plan.** `planIntentionalRepertoire` (`intentional_repertoire.ts`, built on
   `repertoire_policy.ts`) chooses a construction for each support section:
   open arc, guided shape (arcs, folds, ripples, serpentines, terraces), or
   scattered segments. It also chooses paired versus later-receiver rail
   layouts, grouped into short repeated phrases. It is seeded and reproducible,
   and it uses the requested impact and speed (for example, calm passages
   favour open arcs). An explicit plan bypasses this step (V6 fixed panel).
3. **Construct.** `compileProductionRepertoire` (`production_repertoire.ts`)
   gives one total physics allowance to `compileArcMotion` (`arc_motion.ts`).
   For each section that function:
   - proposes geometry from several sources: the parametric centre, learned
     retrieval (`arc_control_policy.ts` and the construction models), memory of
     earlier sections, response directions, and observed receivers;
   - refines it with coordinate and joint-response steps;
   - looks ahead to the next landing;
   - backtracks when a later section becomes infeasible;
   - finishes with terminal selection and ending refinement.

   Every evaluation is native physics, charged to the allowance.
4. **Validate.** The finished track is replayed on a separate engine instance.
   That replay produces:
   - layout fulfillment, i.e. whether each requested construction actually
     happened (`repertoire_layout.ts`);
   - motion summaries (`motion_quality.ts`);
   - in contact-impact mode, the shared impact account (`impact_search.ts`
     over `scripts/lib/contact_impact.ts`).
5. **Review.** `scripts/produce/automatic.ts` writes a manifest of track, report
   and evidence that `motion-gallery/production.html` plays with the real rider
   and the music. `render_repertoire.ts` renders vertical video when wanted.

## Measurement

Two impact rulers coexist on purpose until Phase 3 picks one:

| ruler | definition | used by |
|---|---|---|
| frozen landing impact | strength = turn of the rider's centre-of-mass velocity × speed, summed over the contacted frames from sled touchdown to 6 frames after (~150 ms); scored ÷ 7.55, clamped to [0, 1] (`docs/research/impact_definition.md`) | V6 judge, default compiler |
| `line.contact-impact.v1` | same strength formula; separate impacts start at a contact by any rider point, and a contact-free frame separates two impacts; timing is the onset; matched to beats with penalties for unmatched hits | `--impact-contract=` mode |

Known measurement issues (Phase 3):

- **Timing at onset.** v1 times a hit at its onset; the visible peak still
  lags about 54 ms.
- **Renewal blind spot.** A strike after a weak hit, while the rider stays in
  contact, is never counted. The compiler already exploits this.
- **Strength scale.** Neither ruler is validated beyond about 68
  discriminating felt labels, and v1's strength agrees slightly worse with
  those labels than the frozen ruler.
- **Clarity.** Neither ruler separates a clean landing from a head-first grind
  of equal strength.

## Evaluation

- **V6** (`benchmark/v6`, `npm run sentinel`) is a frozen regression sentinel.
  - It has 460 canonical runs: a fixed-construction panel and an automatic
    panel, with a 3M-frame budget.
  - It is frozen by outputs: `npm run parity:judge -- --all` must reproduce
    every stored score.
  - **It is not a target.** It is inversely related to measured hit clarity,
    its gains were mostly completions, and all of its inputs were used to
    train the learned models.
- **Phase 4** replaces chasing a single score with an evaluation built on
  songs as units, real perturbations and held-out music.

## Known structural problems (Phase 2)

- **`compileArcMotionOnce` is a single 1,242-line closure.**
  - `ArcMotionOptions` has 134 fields, 17 of which are never set.
  - Its memo key is a hand-maintained list of 38 options.
- **Budget rules are saturating caps tuned to V4.**
  - The caps are in `connected_arcs.ts` and `repertoire_search.ts`.
  - Lookahead uses about 74% of the physics frames.
  - Results are not monotone in budget.
- **Unused weight loaded on every compile.**
  - The 102 MB `arc_control_policy_model.json.gz` has no effect on this route,
    but it is loaded on every compile.
  - The `budget_telemetry.ts` / `budget_estimator.ts` shim re-expresses
    results in a retired schema.
- **Duplication.**
  - There are two physics engine copies: `engine-rs` (judge) and
    `scripts/lib/native_motion` (compiler facilities).
  - The validity predicate is copied 3×.
- **Judge and compiler share files.** These are `types.ts`, `repertoire_layout.ts`
  and `motion_quality.ts`, and line-to-section attribution relies on the line-ID
  numbering convention `floor((id − 1000) / 10000)`.
- **Geometry families are not modular.** A new profile touches about 10 files.
