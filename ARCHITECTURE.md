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
   intentional construction plan (`line.repertoire-policy.v2`). Nothing else is
   supported.
2. **Plan.** `planIntentionalRepertoire` (`intentional_repertoire.ts`, built on
   `repertoire_policy.ts`) chooses a construction for each support section
   from the geometry families (below): an open arc, a shape or arc offered a
   guide rail, or scattered segments, grouped into short repeated phrases.
   Since 2026-11-01 a guide is offered, never required: the search uses it
   where it helps the catch (78% of such sections on the bench) instead of
   buying a forced touch. Automatic plans use paired rails only; explicit
   plans may still require guides and later-receiver layouts. It is seeded and reproducible,
   and it uses the requested impact and speed (for example, calm passages
   favour open arcs). An explicit plan bypasses this step.
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
   `arc_candidates.ts` shares one owned, read-only fact record between the
   candidate list and memo. A live evaluation pairs that record with its engine;
   selecting saved facts rebuilds the engine. One residual vector retains its
   local partition count. Report rows add geometry-only grain when selected,
   using the same reduction as full gap reports. Geometry used in cached prefix
   identities is read-only at the compiler boundary.
   Each interval prepares the fixed authored-future features once; candidates
   append these to their physical-arrival features. Preparing them per search
   respects construction fallback changes between searches.
   Candidate scoring reuses its measured trajectory axes for residuals; only a
   targeted, capped amplitude needs a separate raw-peak read to preserve
   search pressure above the reporting cap. Reported axes remain capped.
   Candidates reuse every prefix frame preserved by native invalidation and
   read only the changed suffix. Receiver placement preserves the earliest
   boundary across both geometry edits. Each interval owns reusable detector
   columns and a checkpoint, moved earlier when necessary so contact lookahead
   is recomputed from unchanged input. Candidate evaluation consumes the
   borrowed detection synchronously and retains only owned measurements. Detection
   rescans the short persistence boundary and candidate suffix, with the same
   result as scanning the whole ride.
   Terminal scoring keeps completed span reductions, support motion costs and
   closed contact-engagement measurements in that interval workspace. It observes
   unfinished windows and uses the already-continued strike events. These are
   owned values; score terms retain their original accumulation order. A changed
   prefix uses the complete calculation, and no scoring workspace enters a memo.
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
   The learned future value flattens its forest into one typed array per field,
   once per model. Candidates borrow one reusable frame array per search, valid
   until the next replay, like the detection they are read with. Registration
   skips neighborhood cells outside the extent of recorded rider history; rollback
   keeps that extent, which only has to contain the retained cells. A memoized
   candidate still adds its lines: that add truncates the shared cache, so later
   replays, and charged work, depend on it.
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
   point moves into another cell. `npm run check:physics` compares exact saved
   state/event fingerprints without a local judge build. Encoding and case/input
   identities define compatibility; generating source/binary hashes are historical
   provenance. `npm run verify:engine` compares live independent
   physics and derived observations. Both cover saved rides and seeded stress
   cases. Separate generated-operation tests exercise cache and lifetime changes.
   `npm run parity` checks exact compiler output **and charged work**.
   `npm run check` combines all structural gates. Node and Rust are pinned;
   the native package manifest records source and toolchain provenance.
   [Validation and measurement](docs/engine-validation.md) documents these layers
   and paired performance protocol v3. A timing verdict is separate from
   correctness, design quality and a declared resource tradeoff.

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
   landing clicks and by the grading page). The ride is drawn by the video picture
   (`scripts/video/picture.js`, below) from the scene the review server builds for
   it (`/api/scene`, `scripts/video/scene_api.ts`), in a chosen look: plain by
   default, or any theme, so the review shows what a video of the ride would.
   Seeking covers the scene's song span; inspection and the impact panel convert
   physics frames through `timing.js`.
   "Inspect contacts" overlays the guiding lines and the lines touched at each
   frame with the picture's own camera (`scripts/gallery/inspect.js`). The canvas is
   9:16 and fits within 72% of viewport height (`motion-gallery/ride.js`). Native
   replay is prepared in a worker before playback; drawing interpolates the replayed
   poses and uses the native renderer's cached sprite atlas.
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
   **Videos** have one renderer, `scripts/video/`, and the concept lab draws
   through the same one, so what the owner approves there is what ships.
   - **Two clocks, one relation** (`timing.js`, design in
     `generated/concept-lab/docs/TIMING-DESIGN.md`): song time s (the recording,
     spectrum, sections, drop, authored beats) and ride time r (physics frame f is
     r = f / 40), with r = s + offset. Nothing else converts between them. A ride's
     offset is the mean over its matched hits of (strongest frame − authored beat);
     a ride is *aligned* when its record has beats, a matched hit and an offset in
     [0, 0.5 s], otherwise shown *as compiled* (offset 0, the reason saved). The
     beats are the spec's contact times as authored (`authoredBeats` in
     `scripts/produce/music_artifacts.ts`, which rejects contacts that are not
     strictly increasing or come before the earliest catchable 0.125 s; contacts
     are compiled at exactly these times). A song is its directory
     `productions/<song>/`: `spec.ts` (or `variants/<name>.ts`), `audio.mp3` and
     its analysis `audio.json`, nothing else. A ride records them beside its impact account, outside
     every identity. Rides saved before 8 November have none and stay as compiled.
   - `scene.ts` builds what every consumer reads: the ride (its track, and for a
     compiled production its trace), its impact account projected as recorded, in
     physics frames (targets with their beats when recorded; events with onset,
     strongest frame and strength; matches), the timing, the song span
     (`[0, spec duration]`, a bare track's own duration), and the song: a saved
     ride's own recording and sections (its compiled case), the spectrum
     (`make_spectrum.py`, cached by the recording's bytes in `generated/spectrum/`)
     and hand-placed drop (`drops.ts`). It reads no spec and no current authoring,
     so a saved ride renders the same whatever they say today. It refuses a record
     of another song, hits whose strongest frames are out of order, and a ride
     that ends before the span it is shown with.
   - `picture.js` composes the frame at song time t. It samples the ride at r,
     resolves one framing and one set of colours, then draws top, music, track
     and rider. It owns the colour-boost order (paper and pencil excluded) and
     applies the hit split last. Frames and colour queries are independent of
     previous draws or seeks.
   - `camera.js` computes shared ride velocity/speed, the fixed follow camera and
     steady/quiet zoom, then samples framing and the whole-course bookends.
     Every view uses the same representation: rider world position, rider screen
     position and zoom. No airborne zoom branch or separate bookend transform.
     `intensity.js` samples measured speed and hit peaks on its 10 Hz grid and
     applies the calibrated absolute metric; its study helpers remain in use by
     the lab's diagnostic sweeps. Camera zoom uses nearest intensity samples,
     colour and sun interpolate them, preserving their approved responses.
   - `track.js` prepares connected rails, first contact and ink frames, and the
     visibility index once. Drawing reads those frames; it never updates inking
     during playback. `music.js` interpolates the spectrum on song time and
     draws bars, fork or Iris. Bars and fork share accent selection, fed recent
     heat on the ride clock (or the loudest three bands).
   - `theme.js` snaps the authored drop cues to nearby hits on song time and
     resolves the drop partner, then the intensity grade, in that order. Effective
     paper, ink, pencil, band, accent and sun colours are passed to drawing
     explicitly. `grade.js` defines the colour response (vibrance on the soft-start
     curve, the paper half; `plain` draws the scheme as it is) with its curve and
     label; `colour.js` owns sRGB/OKLCH arithmetic.
     `look.js` holds every option with the values production uses (`OPTIONS`), the
     settled defaults (V1), the themes and the plain review look; the themes are the
     collection (`collection.js`): each judged theme's frozen specification and hash
     id, copied from the judging registry, so a test proves production draws exactly
     what was judged. Every frozen specification spells out every option, so the
     option keys never change; values no production look uses are removed (those of
     rounds 3–44 are in git history before 11 November). `palettes.js` names each
     collection scheme by its theme's id, each drop pairing `<light id>+<dark id>`,
     and keeps `graphite`, the default look's. The saved `paper` option reads
     “Colour response” in the lab. `choose.js` picks each video's theme and drop
     partner from its ride's id.
   - **A hit happens at its strongest frame** (round 23), sized by measured
     strength and directed along the line struck at onset. `hits.js` prepares
     these hits and samples the single winning hit's shake, split and colour
     boost; band heat accumulates separately. `split.js` owns channel separation,
     the clean rider overlay and the title's smaller split, with explicit inputs
     for this frame.
   - `write.ts` draws each frame in a headless page, sends it once, losslessly, to
     one FFmpeg, and encodes the song's own audio in the same FFmpeg: frame 0 and
     the first audio sample are song time `from` (the recording is decoded from
     0.5 s earlier and trimmed, since an MP3 decodes wrong for its first frame
     after a seek). It refuses a passage outside the song span. Every video follows one
     standard (`encoding.ts`: H.264 yuv420p, BT.709 limited range, all four colour
     tags) and is checked after writing: frame count, size, rate and tags, and the
     audio within 1 ms of the song by cross-correlation on a second with sound.
   - `native.js`, `worker.js` and `sprites.js` are the vendored rider artwork and
     native replay, bundled with the review player's contact inspection into
     `generated/renderer/` by `scripts/gallery/build_renderer.mjs`, which the review
     server runs when it starts. The replay checks a saved trace against the engine
     within 1e-7 on every frame it recorded; a trace stops where its ride ended (a
     crash or an ejection), and the engine draws on from there.

   `npm run video` (`scripts/video.ts`) makes a video from a fresh compile, a
   saved study or a bare track, in any look, whole or a span of the song.
   `scripts/produce/render_repertoire.ts` renders a study's valid rides with their
   excerpts and publication bundles (`upload.json`); a ride with a saved record is
   done, and its record must name this ride's inputs. Renders are outputs of their
   inputs and look; the renderer's commit is recorded, never checked. Review clips
   for blind studies and compare's before/after (`tools/measure/clip_render.ts`)
   judge motion, not sync: bare tracks in the plain look, 540 × 960, shown as
   compiled, so a judged moment is where its physics frame says; their beat marks
   are the authored beats of the spec the rides were compiled from. A clip is
   reused only for identical inputs and bytes. FFmpeg compositions of written
   videos (`pair_media.ts`, compare's side by side) keep the encoding standard.

   **Style reviews:** prefer one player with instant variant switching that keeps
   the same time and playing/paused state: the concept lab
   (`generated/concept-lab/`) is that player for looks, and its films are written
   by the same writer.
   `motion-gallery/video-compare.html?collection=/path/to/comparison.json` compares
   independently rendered videos in one player. The JSON has a `title` and
   `videos: [{label, src, description?}]`; video paths resolve relative to the JSON.
   Use a common time origin across exports. The outgoing video remains visible
   until the selected one has a decoded frame at the matching time. Only the active
   and incoming sources load; hidden compositor callbacks are not a prerequisite
   for a decoded-frame handoff. Playback refusals leave a usable Play control. Shorter
   versions stop at their end; failed loads leave the current version in place.
   Grouped studies add `groups: [{id, label, variants: [styleId]}]` and
   `passages: [{id, label, videos: [{id: styleId, label, src}]}]`. A passage change
   keeps the selected style when available and resets playback time. Group changes
   preserve time. Optional `recipe` details stay collapsed; `links` connect related
   review collections.

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
and each physical-support motion/engagement cost are included exactly once.
Scoring consumes the event/account/validity assessment; complete review evaluations
also compute speed-gain diagnostics. Its search profile is in
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
  `tools/research`).

Measured limits (docs/research/producing-impact-brief-20261004.md):

- **Achievable strength.** About 0.06 at the bottom (the gentlest
  touchdown) and 1.0 at the top for an isolated near-vertical drop onto flat
  ground. At 45° the rider crashes above about 0.9
  (`tools/measure/survival_envelope.ts --fine`). In dense passages, time and
  energy cap strength near 0.6–0.7.
- **The frontier past the adopted changes.** A slam at an angle costs speed,
  which the spec's speed target charges for, and sharper turns crash.

Line.strike.v3 is the only ruler the compiler optimizes (`impactRuler`,
`impact_accounts.ts`). `strike_impact.ts` keeps the v1 and v2 definitions as report
rows, so a change is visible under every ruler, and `line.contact-impact.v1`
remains a research diagnostic in `tools/measure`.

Known limits of the strike account:

- **Strength scale.** The pair judgments validate ordering, not the absolute
  scale. The owner has never called a compiled hit harder than "medium".
- **Quiet requests.** Requests below about 0.05 sit near the floor of any
  gentle touchdown; quiet beats read about 0.03–0.05 strong.

## Evaluation

- **`npm run compare`** is the everyday evaluation; `npm run eval` compiles one
  panel with this checkout. A panel is a fixed list of rides: specifications × seeds.
  - Panels (`docs/research/benchmark-audit-20261031.md`). A bench
    spec is a variant `productions/<song>/variants/bench-<pattern>.ts`; a
    sealed sibling is `sealed-<pattern>.ts`. Each exports
    `bench = {stratum, pattern, windows}`: stratum `G` or `P1`–`P6`, and the
    `[t0, t1]` windows (authored seconds) where its pattern happens.
    `inputs.ts` discovers them by globbing, so adding a spec needs no code.
    - `v7` and `v7-confirm`: the frozen V7.0 suite (`docs/benchmark.md`).
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
    A review clip is reused only for identical inputs (ride, recording, span, look) and bytes.
  - Held-out new music: Trouble, Valhalla and Circus Minimus (`--panel=heldout`).
- **`npm run compare`** (`tools/eval/compare.ts`, `arms.ts`, `compile.ts`)
  compares a candidate compiler with a named reference on a panel, V7 by
  default in practice (`--panel=v7`). It is bookkeeping and evidence, with no
  verdict. Usage, how to read a report, and what makes rides comparable are in
  `docs/benchmark.md`; the V7 suite is in `docs/research/v7-design-20261101.md`.
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
  numbering convention `floor((id − 1000) / 10000)`. Their realization checks (with `repertoire_realization.ts`) are
  the one per-family rule outside the geometry-family table.

Production collections declare their timing offset and resolved song identities.
Every saved member must agree with the collection's compiler, request and input
identity before it can be indexed or reused. Render and index phases use saved
inputs; compilation also checks them against current inputs. Failed jobs remain
visible and the batch exits unsuccessfully.
Concurrent jobs settle before the batch releases its directory lock, including
when a worker fails. Every renderer closes its own browser, server and encoder.
A video is written in one pass by one browser and one encoder, which every writer
closes, also on failure; its output appears only once complete and verified.

Future-model collection uses frozen physical prefixes and an independent native
probe allowance. Its declared plan binds compiler, collector, inputs, work and
search settings. Resume and training reject missing, stale or undeclared records;
a complete compile with no observations is an error. Budget interruptions are
not labelled as physical dead ends. Raw collections remain local.
