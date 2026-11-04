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

Authoring evidence is separate from compilation. `tools/music/vocal_evidence.py`
reads the separated vocal audio and existing detector outputs to write descriptive
`vocal-evidence.json` files (RMS, spectral changes, band changes and acoustic
landmarks). The spec dashboard verifies source hashes and exposes these values
without changing candidate times or producing contacts. Definitions, limitations
and validation are in [music authoring](docs/music-authoring.md).

1. **Entry.** `compileHandoff` (`scripts/v0/optimizer/handoff.ts`) accepts a
   spec and either creative preferences (automatic arrangement) or an explicit
   intentional construction plan (`line.repertoire-policy.v2`, as in the V6
   fixed panel). Nothing else is supported.
2. **Plan.** `planIntentionalRepertoire` (`intentional_repertoire.ts`, built on
   `repertoire_policy.ts`) chooses a construction for each support section
   from the geometry families (below): an open arc, a shape or arc offered a
   guide rail, or scattered segments, grouped into short repeated phrases.
   Since 2026-11-01 a guide is offered, never required: the search uses it
   where it helps the catch (78% of such sections on the bench) instead of
   buying a forced touch. Automatic plans use paired rails only; explicit
   plans (the V6 panel) may still require guides and later-receiver layouts. It is seeded and reproducible,
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
   `arc_candidates.ts` distinguishes owned measurements, accepted/rejected memo
   entries and evaluated candidates with a live engine. Stored measurements
   exclude engine handles; selecting one rebuilds its engine. Geometry used in
   cached prefix identities is read-only at the compiler boundary.
   Candidate scoring reuses the reported span axes for its residuals; only a
   targeted, capped amplitude needs a separate raw-peak read to preserve
   search pressure above the reporting cap. Reported axes remain capped.
   A candidate that leaves its interval's prefix unchanged reuses the prefix
   frames and resumes the prefix's detector state. One interval owns reusable
   detector columns and a scalar checkpoint; candidate evaluation consumes the
   borrowed detection synchronously and retains only owned measurements. Detection
   rescans the short persistence boundary and candidate suffix, with the same
   result as scanning the whole ride.
   Public detections are read-only, including their nested arrays. TypeScript
   does not enforce borrow lifetimes: observation callbacks must return owned
   results and must not capture borrowed storage for later use.
   A candidate whose rider or sled comes apart stops replaying at that frame,
   since an unbinding is permanent, and is charged only the frames simulated.
   Native replay performs that binding-stop loop; the shared meter still checks
   allowance and charges the actual cache extension. Prefix comparisons read
   native state directly, preserving the former serialized-number semantics.

   Construction memory retrieves exact stable nearest neighborhoods with a
   bounded heap, expanding when adaptation consumes a page. Immutable model rows
   permit conservative partial-distance bounds; local examples are read afresh.
   Ragged or nonfinite input retains stable full sorting. Proposal order, model
   weights, scoring and search allowances are unchanged.

   Scattered sections use resolved collision positions from the carrier's
   original simulation. Reading those cached records advances no physics;
   the resulting fragments then undergo ordinary physical evaluation. There
   is no second observer engine or contact-window replay.

   Native engine versions share a physical cache within a lineage. Live
   descendants and the current cache retain the ancestry they need; released
   branches are reclaimed immediately when neither needs them. Handle slots
   remain reserved until lineage death. Detached lineages share an immutable
   cache snapshot until either needs to write. Cached reads do not copy it;
   releasing the source before the next write transfers the storage without
   copying. Live lineages still isolate edits, frame extension and truncation.
   Saved states and collision snapshots use one immutable 64-entry prefix store
   across copies; an append copies only a shared partial tail. Registration batches
   own contiguous geometry and raster footprints, shared by indexed line references.
   Registration queries the
   earliest invalidation once per batch. History frames lazily cache conservative
   component bounds, with exact predicate scans for survivors and nonfinite data.
   The independent judge is unchanged and remains a separate implementation.
   One Rust arena owns version ancestry, lineage caches and reconciliation
   scratch. Each operation holds a checked mutable borrow. The frame-cache
   module privately owns geometry, computed frames and their derived indexes;
   collision history privately owns snapshots and rollback boundaries. Clones
   clear borrowed shortcuts, and reset/rollback invalidate them before release.

   JavaScript wrappers uniquely own native handles. Empty batches return the
   existing wrapper; disposed wrappers reject later reads even after slot reuse.
   Synchronous ownership scopes protect caller engines through nested success
   and failure, then release local handles. Traces belong to their requesting
   version and remain correct through sibling interleaving. Pending replay is
   visible before metering; history reconstruction cannot overwrite a trace.
   The typed WASM adapter manages borrowed views. Variable outputs grow as needed
   instead of silently capping events; state and trace buffers follow topology.
   Transport remains synchronous, and retained observations must be copied.
   `readCachedMotionWindow()` scopes its read-only view to a callback; another
   engine call during that callback fails before it can invalidate the view.
   Compilation is sequential inside each isolated worker. A session guard rejects
   reentrant compilation before accounting can reset, and restores the caller's
   limit on exit. Research observers have exception-safe installation scopes;
   counterfactual probes restore both frame counters and the limit. These scopes
   do not provide concurrent compiler sessions or automatic search-state rollback.
   Contact/body reads check cache availability and observe in one native call.
   Raw-frame payloads reuse cached contact summaries. Already simulated raw windows
   cross the ABI in one call and return owned frame objects. Impact observation reads packed
   cached motion/contact windows and computes strike frames without intermediate
   per-frame motion objects. Pure body-motion values are
   memoized lazily per frame; this memo can be shared across detached snapshots
   without copying their simulation data, and follows frame rollback and reset.
   Two-dimensional geometry and motion magnitudes share `lib/hypot2.ts`: a
   scalar normalized sum preserves the reference binary64 calculation without
   temporary argument storage. Zero and nonfinite behavior remain explicit;
   three-dimensional magnitudes retain `Math.hypot`.

   Solver rest lengths and endurance derive from the fixed rider topology;
   caches do not store duplicate constant arrays. One ordered point/friction
   table drives the collision loop, preserving the original point visits and
   zero-friction branch. Constraint equations and floating-point order stay fixed.

   The collision grid stores lines in their original raster cells. Nearby-line
   queries expand the 3×3 neighborhood only when read, with a shared query cache
   and a retained list per point. Each point filters the original direction
   predicate when a frame begins or its cell changes: velocity stays fixed
   through the six sweeps. Query order and cross-cell duplicates match the
   reference. Filtering compacts accepted pointers into already-reserved space,
   publishing only the initialized prefix. Grid edits invalidate both levels;
   copying a shared cache clears its borrowed queries, while ownership transfer
   preserves the owning grid.
   Each collision sweep keeps its original list even when the
   point moves into another cell. `npm run verify:engine` compares every frame state and
   ordered collision on the committed parity tracks with the independent
   reference. `npm run perf:engine` adapts the archived paired process workflow
   to isolated WASM comparisons on the current machine, with fixed screening
   and fresh confirmation. It can also compare frozen wrapper/consumer sources
   in the same execution directory, with fixed runner, fixtures and dependencies.
   Its compile mode uses the same worker and exact track/work references as parity.
   Protocol v2 captures compile CPU and wall time around `compileHandoff` only,
   excluding loading, hashing and output. Separate fresh processes per arm/cell
   report WASM linear-memory capacity, post-compile JS heap/RSS and process peak RSS.
   Historical v1 records retain their original measurement boundaries.
   Node and Rust versions are pinned; the packaged native manifest records the
   compiler versions, target, profile, toolchain hash and build environment overrides.
   `check:engine` combines the structural gates. Seeded native operation sequences
   also compare mixed cache/lifetime operations with cold independent JS replays.
   `bench:engine` provides workload diagnostics.

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
   and the music. The music plays through Web Audio and each frame draws the
   ride at the position heard when it reaches the screen
   (`shared/playback.js`, also used by the spec dashboard's cursor and
   landing clicks and by the grading page). The camera is the videos' own follower
   centred on the mean of the ten traced points
   (`scripts/gallery/native/camera.js`). Production viewports are responsive
   16:9 or 9:16 canvases, selected with Format (default horizontal, zoom 2.0).
   Portrait previews fit within 72% of viewport height. Native replay is prepared in a worker before playback;
   drawing interpolates the saved poses and uses the native renderer's cached
   sprite atlas rather than rasterizing SVG body parts on every refresh.
   Artifact bytes and checksums load together. Music downloads overlap native
   preparation, and optional video metadata loads independently of audio.
   Checksums and selection cancellation are checked before publishing results;
   failed audio still leaves the saved ride available for scrubbing.
   Pair studies play one combined video, so both sides share every frame and
   the browser's native audio/video clock. `scripts/gallery/pair_media.ts`
   caches derived wide/stacked previews with either original soundtrack;
   it requires ffmpeg/ffprobe. Sources and study manifests are unchanged.
   Soundtrack switches reload the shared picture at the current position;
   playback has no follower, drift corrections, or JS loop seeks.
   One-click native radio groups select speed and format. The watch area keeps
   musical impacts visible beside the rider on desktop and immediately below it
   on smaller screens: a whole-ride overview plus a fixed eight-second window
   around playback, both seeking on the same player. The detail window rebuilds
   only at window boundaries or resize; cursors update during playback. Existing
   target/response values are unchanged. Explanations and the event table stay
   in a separate collapsed measurements section.
   The review page preserves collection-authored titles and descriptions when
   opening rides, highlights the selected entry, and offers search and Previous/
   Next navigation. Generation controls are collapsed below the collection.
   Space toggles playback; arrows seek 5 s (Shift: 1 s), without intercepting
   editable fields or native controls. Scrubbing and musical-impact jumps retain
   the prior playback state; seeking to the end stops. Pending audio starts are
   cancellable so rapid input cannot override a newer pause.
   `render_repertoire.ts` renders vertical video when wanted.

## Geometry families

A geometry family is one row of `GEOMETRY_FAMILIES`
(`scripts/v0/optimizer/geometry_families.ts`), the wardrobe of support shapes:

- **`label`**: its name on the review page, which receives the list from the
  catalog API.
- **`style`**: the profile settings its sections are built with
  (`constructionStyle`). The learned construction archives key on the
  resulting style, so changing a value leaves the family without its archived
  demonstrations.
- **`heading`**: for a shaped family, its tangent schedule. The family's id is
  then its motion profile (`motion_profiles.ts` dispatches on it).
- **Feasibility is discovered, not predicted.** A shaped section where no
  candidate is viable is asked for plain arcs, with the same guidance and rail
  layout, before the search reopens an earlier boundary (`arc_sequence.ts`).
  The plan is then rewritten to what the ride realized (`splitPhrases`), so
  the fulfilment checks and reports see the realized requests. This replaced a
  9-frame threshold on 2026-11-01 (docs/research/overnight-20261101.md).

Everything else is shared machinery. Plain `arcs` and `scattered` fragments
are rows without a heading, and the planner, search and layout checks treat
them by name. Row order is the default repertoire and the planner's draw
order, so adding or reordering a row changes seeded plans. Adding a family is
therefore a behavioural change, even though it touches only this module:

- The automatic parity cells pin the six-family repertoire explicitly, so
  parity does not detect it. `npm run eval` uses the default repertoire.
- `tests/benchmark_v6.test.ts` reproduces the frozen V6 automatic plans from
  the default preferences. It fails until it plans from their stored
  preferences, as the V6 runner does. That is the deliberate acknowledgement.
- The review page checks its default form against the saved collection
  (`check_production_ui.mjs`), so the collection needs regenerating.

What the table deliberately does not hold:

- The fold's own search controls (`foldBend`, `foldTiming`, `foldBias`), its
  compact proposals and its receiving-fold geometry (`arc_motion_control.ts`,
  `arc_proposals.ts`, `observed_receiver.ts`).
- The realization checks, shared with the frozen judge: a fold needs its
  corners, and every other shaped family needs two turn reversals
  (`repertoire_realization.ts`, `repertoire_layout.ts`).
- The future-value model's construction features: a one-hot over the six
  families it was trained on (`arc_compile_context.ts`). A new family encodes
  as none of them until the model is retrained.
- Numeric shape controls. `rippleCycles` and `foldAngle` are accepted only by
  ripples and folds (`validProfileControls`). A new control is a new
  section-style field: the style type, `SECTION_STYLE_KEYS`,
  `EVALUATION_IDENTITY` and the construction memory key.

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
- **Steep arrival before strong asks:** the catch before a strong beat gets a
  steep, ask-driven arrival heading and speed, phased in smoothly from ask 0.4
  (none) to 0.8 (all) rather than switched on at 0.6.
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
    an adopted change generalizes. Both are unchanged.
  - Stratified panels (`docs/research/benchmark-audit-20261031.md`). A bench
    spec is a variant `productions/<song>/variants/bench-<pattern>.ts`; a
    sealed sibling is `sealed-<pattern>.ts`. Each exports
    `bench = {stratum, pattern, windows}`: stratum `G` or `P1`–`P6`, and the
    `[t0, t1]` windows (authored seconds) where its pattern happens.
    `inputs.ts` discovers them by globbing, so adding a spec needs no code.
    - `bench`: the four `spec.ts` as stratum G (no windows: the whole ride)
      × 101, 202, plus every `bench-*` × 101, 202, 303. `bench-confirm`: the
      same at 505, 606 (G) and 505, 606, 707. `bench-pairs8`: the P1 and P2
      specs × 8 seeds, for completion claims.
    - `sealed` (every `sealed-*` × 3 seeds) runs only with `--sealed`, to
      confirm an adopted candidate.
    - `heldout`: the held-out songs' preferred specs (Trouble, Valhalla,
      Circus Minimus `spec.ts`) plus Circus `pairs4` and `voice-drums` (the
      voice-and-drums hook) as targets, × 4 seeds,
      stratum H. It runs only with `--heldout`, at decision points; these
      songs never inform compiler decisions.
    - Case ids are `song~variant~seed` (`spec` for `spec.ts`); each planned
      case records its stratum, pattern and windows.
    - Their report (`summary.ts` `stratify`) gives completion first, per
      stratum: complete/total per arm, recovered and lost cells, and for
      failed rides the failure time (crash or first missed beat) and the
      share of beats before it. Quality follows on cells complete in both
      arms only, under every ruler plus the v3 loss parts and the v3 account
      restricted to the windows. Per spec it gives seed sign counts, not a
      bootstrap. Specs weigh equally within a stratum and strata weigh
      equally across; there is no interval.
    - Section 0, the headline score, comes first. It is the production grade
      the ride page shows (`contact_impact_grade.ts`: 1000·exp(−rms/0.25) over
      air, speed and the v3 impact account), with an invalid or incomplete
      ride counting 0, as the headline always counted failures. It is given
      per stratum, as the mean of strata, and as the plain mean over cells.
      Every eval cell records it (`measureCell` → `score`); older runs get it
      through `tools/eval/remeasure.ts`. The legacy dev/confirm report shows
      it as the `score` row.
    - Section 4, Geometry (`geometryStrata`), is descriptive. Each cell keeps
      compact geometry facts from the compile (`geometryFacts`: per section
      the planned family, guidance, rail layout, length in frames, and the
      realization's fulfilled, reasons, guide contact frames and turn
      reversals). The plan holds only the fitted family, so whether
      short-shape fitting changed a section is not recorded; the report
      counts short sections by planned family instead. Remeasurement carries
      the facts over and cannot reconstruct them for older cells.
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
  - On dev and confirm, intervals come from resampling songs, and completion
    is reported separately from quality. With 4 songs such an interval
    excludes zero about 1 time in 5 under no change (the audit).
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
  - Held-out new music: Trouble, Valhalla and Circus Minimus (`--panel=heldout`).
- **`npm run compare`** (`tools/eval/compare.ts`, `arms.ts`, `compile.ts`)
  compares a candidate compiler with a named reference on a panel, V7 by
  default in practice (`--panel=v7`). It is bookkeeping and evidence, with no
  verdict. Usage, how to read a report, and what makes rides comparable are in
  `docs/benchmark.md`; the V7 suite is in `docs/research/v7-design-20261101.md`.
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
    failures: the 336-case catalog exchanges one completion for another.
  - Physical frames alone are not a CPU model. Candidates in long supported
    sections carry up to about 2,000 main and 2,000 guide segments, so their
    construction inspection and the engine's line registration grow with the
    section. After the October 29 structural fixes (REWORK.md), CPU per physical
    frame no longer grows with ride length. After the October 30 geometry
    fixes, engine line registration and removal remain the largest part of a
    candidate: about 19% of a song compile's main thread and 31% of the
    93-second case's, against 14% and 19% for physics stepping. Construction
    inspection attributes only contacted guide lines.
- **Duplication.**
  - There are two physics engine copies: `engine-rs` (judge) and
    `scripts/lib/native_motion` (compiler facilities).
- **Judge and compiler share files.** These are `types.ts`, `repertoire_layout.ts`
  and `motion_quality.ts`, and line-to-section attribution relies on the line-ID
  numbering convention `floor((id − 1000) / 10000)`. Since V6 is frozen by its
  outputs, these files can now be cleaned safely, provided `npm run parity:judge`
  stays green. Their realization checks (with `repertoire_realization.ts`) are
  the one per-family rule outside the geometry-family table.
- **Comparison objectives.** Besides the product's v3, the `landing` compile
  mode (the V6 sentinel) and `line.strike.v1`/`v2` remain comparison measurement accounts. They share
  the current search; reproducing old compilers requires their recorded revisions. They go, with the landing-specific validity rules in
  `arc_evaluate.ts`, once the owner is satisfied.

Production collections declare their timing offset and resolved song identities.
Every saved member must agree with the collection's compiler, request and input
identity before it can be indexed or reused. Render and index phases use saved
inputs; compilation also checks them against current inputs. Failed jobs remain
visible and the batch exits unsuccessfully.
Concurrent jobs settle before the batch releases its directory lock or stops a
shared rendering server, including when a worker fails.
Within one render, overlay-data generation overlaps ride rendering and audio
muxing. Composition waits for both branches; failures also wait for both before
removing their temporary files. Worker and Remotion resource limits still apply.

Future-model collection uses frozen physical prefixes and an independent native
probe allowance. Its declared plan binds compiler, collector, inputs, work and
search settings. Resume and training reject missing, stale or undeclared records;
a complete compile with no observations is an error. Budget interruptions are
not labelled as physical dead ends. Raw collections remain local.
