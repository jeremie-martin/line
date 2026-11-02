# Post-processing study — November 2, 2026

This is an artistic review, not a compiler experiment or a new production default.
The approved effects and static **Soft base A** vignette remain the reference.
No specifications, seeds, physics or music timing were changed.

## Review order

Start with the short collection in the single-player comparison page:
`/motion-gallery/video-compare.html?collection=/generated/style-lab/collection.json`.

1. **Looks:** approved reference and four complete directions. Start with Elastic
   print and Graphite, my provisional picks; then try the two other directions.
2. Change **passage** to test the same treatment on different musical material.
3. Use **Motion**, **Colour** or **Spectrum** to isolate an ingredient.
4. Follow the full-length link for two complete treatments beside their references.

Switching a style preserves the moment and playback state. Changing music retains
style and sound settings, but starts the new passage at its beginning. Only the
current passage's videos are loaded. The recipe is available in a collapsed detail.
The UI supports independent Remotion exports, not only live HTML overlays.

## Directions

| Direction | Character | Main ingredients |
|---|---|---|
| Approved | Familiar, lively | Existing shake, RGB split, flash, full-width rainbow spectrum; static soft base |
| Elastic print | Tactile and rhythmic | Contact-locked kick with one rebound; shorter colour accent; warm teal/amber/coral bars |
| Electric paper | Bright coloured ink | Short cyan/coral ink edges, luminous coordinated spectrum, transparent contact ripples |
| Suspension | Spacious and exploratory | Slow camera breath from requested airtime, light rounded frequency silhouette, small contact accents |
| Graphite | A distinct dark visual world | Fixed blue-black canvas, bright geometry, cyan/pink spectrum, compact kick and graphic ripples |

The focused variants each change one component of Approved: replace shake with
elastic motion; replace RGB split with ink edges; or replace bars with the ribbon.
There is no sweep through every numerical combination.

My provisional preference is Graphite for a clearly different identity and Elastic
print as the closest successor to the current energetic style. Electric paper has a
coherent palette worth considering independently. Suspension is more speculative:
its first filled polygon was too heavy; the revised contour is rounded and translucent.
These judgments come from visual inspection and playback checks, not an owner listening
review or a claim that the scores select the best artistic treatment.

## What drives the effects

- Fast physical accents use **saved measured contact strength and onset**. Missing
  measurements produce no accent. Strength is not normalized separately per song.
- The elastic kick is phase-locked to each contact rather than the global song clock.
  It has a brief kick and rebound, not continuous vibration. A softly bounded signed sum keeps overlapping kicks continuous. Positive colour
  accents use the dominant response; neither rule normalizes weak hits per song.
- Suspension's slow camera breath uses the **existing requested air lane**, averaged
  causally over 0.7 seconds. Requested speed gently affects its spectrum glow.
  These are artistic requests, not measurements of actual flight or instantaneous speed.
- Spectrum values remain the existing audio-frequency bands. The ribbon interpolates
  their graphic outline; it is not a time-domain waveform or a new musical detector.
- Ripples are decorative accents in the spectrum band, not simulated collisions or
  waves travelling through the track. Multiply/screen blending keeps geometry legible.
- Palette belongs to the look. Dashboard section colours are not reused as arbitrary
  cinematic decisions. The vignette stays static, including during impacts and entrance.

## Transfer passages and full videos

All eight variants use the same ride/audio within each passage, at 60 fps:

- **Petrunko 10–24 s:** upper figure, drum build, roll, brief suspension and return.
- **LUA NA PRAÇA 22–36 s:** quiet supported ride into the first drum return.
- **LOS VOLTAJE 14–28 s:** voice build, rapid pickup and full percussion return.

The short comparisons render at 540×960 for quick phone review. The full-length
showcases render at 1080×1920: Petrunko in Elastic print, LOS VOLTAJE in Graphite,
each with an approved reference. The same Remotion composition renders every version.
Effects do not duplicate video decoders or require another native ride export.

## Implementation and evidence

The opt-in `studyLook` prop selects recipes in `remotion/src/study/looks.ts`;
`signals.ts` defines the small deterministic modulation layer and `Layers.tsx`
contains ink/ripple compositing. The ordinary production call does not supply this
prop. There is no new authoring DSL, automatic style chooser or adoption mechanism.

Scratch preparation/render scripts, props, source hashes, output checks and browser
captures live under `generated/style-lab/`. The new review UI accepts grouped
collections as well as the previous flat list. Tests cover signal timing and bounds,
missing contacts, causal phrase smoothing, unchanged approved configuration, player
state preservation, group/passage changes, cancellation, short clips and load errors.
A reference still rendered before and after the opt-in integration is pixel-identical.
The independent implementation review caught and corrected three issues: a discontinuous
sign flip between overlapping kicks, ink masks inventing opacity in transparent pixels,
and focused motion/ink variants unintentionally changing spectrum blending. Regression
checks now cover continuity and alpha preservation. A synthetic line/spectrum overlap
render confirms that the new light and dark treatments preserve geometry visibility.

## Completed validation

- 385 tests pass, with root and Remotion typechecks passing and no unreachable code.
- All 28 delivered videos decode completely, have the expected frame counts and
  dimensions at 60 fps, and explicitly use BT.709 limited-range encoding.
- Decoded PCM audio is identical within every comparison group, including full tracks.
- Browser checks exercised 33 grouped switches across all three short passages,
  plus both full-length pairs, with paused/playing state preserved and no page errors
  or phone-width overflow.
- The fixed approved reference still is pixel-identical. Compiler and specification
  paths are unchanged. The active defaults do not select any experimental recipe.

## Ideas deliberately left for later

- Move a chosen camera response into the native camera for sharper spatial rendering,
  after its artistic form is settled. Post-processing makes comparison much cheaper now.
- Use properly sampled realized velocity/airborne state if those effects prove useful.
  The current per-contact air/speed summaries are not suitable continuous telemetry.
- Handcrafted effect cues could complement the music specification eventually. First
  settle the visual vocabulary; do not add a second specification system prematurely.
- Delayed video echoes, particles and blur stacks were not necessary for this study.
  They add visual/decode cost and can make the real track harder to read.

## Second study: paper, light and musical space

The owner's phone review exposed a player failure despite the earlier headless
checks, and requested much broader artistic exploration. The second study lives
in `generated/style-lab-v2/`; the first collection remains intact.

### Comparison reliability

The old player preloaded every style and required a compositor callback from a
hidden incoming video. A decoded hidden video can lack that callback. The player
now loads only the requested source (at most two during transition), uses decoded
media readiness as a bounded fallback, and starts playback within the click
handler. A browser playback refusal leaves a prepared picture and a usable Play
button. It never requires changing songs to recover.

A fault-injection test reproduces the old callback failure and passes with the
fix. Eleven player tests include delayed loading, rapid changes, playback
refusal and preload restricted until a user gesture. Play remains available even
before the first frame; a failed preload keeps the chosen style for retry.
Native-video fullscreen is used when element fullscreen is unavailable. Full
movies keep all available treatments for a song together at the same playhead. Actual videos passed 24 delayed playing switches across desktop/phone
viewports. Five playing switches in the existing Brave session took 0.30–0.50s,
with no pause, error or extra retained source. This is **not physical-phone
verification**. Evidence: `generated/player-reliability/`.

### New visual vocabulary

Eleven new experiments and one energetic combination join the four earlier complete directions:

| Treatment | Leading idea | Review position |
| --- | --- | --- |
| Cut paper | Constant soft directional shadow, warm paper, richer print blocks | Full-film candidate |
| Two-colour print | Crisp offset coral ink under blue geometry | Print alternative |
| Impact stamps | Contact-driven opacity of a fixed small ink expansion; stable camera | Focused ingredient |
| Contour atlas | Open nested frequency contours | Quiet alternative |
| Spectral memory | Current frequency contour plus three actual past spectra | Full-film candidate |
| Light filament | Crisp bright geometry with a restrained same-frame halo | Full-film candidate |
| Tuning forks | Fine frequency stems and contact-responsive caps | Focused ingredient |
| Aurora | Slow requested-air colour field behind geometry and a frequency ribbon | Full-film candidate |
| Phosphor | Dot-grid frequencies with continuous boundary opacity | Full-film candidate |
| Resonance fan | Broad elliptical frequency stems | Exploratory; weak in quiet passages |
| Edge currents | Narrow mirrored frequency side rails, open lower centre | Composition alternative |
| Arc light | Contact light edge, confident kick and fuller bars | Energetic combination |

The monochrome surface treatments intentionally recolour the rider and scarf
along with the track. Their masks preserve the source's alpha; shadows and halos
use the same frame, not a second video or delayed geometry. Contours and ribbons
are frequency displays, not waveforms. Memory uses actual spectra at 0.12, 0.24
and 0.40 seconds in the past. Side rails mirror the same bands decoratively;
they do not claim stereo information. Print-block height is deliberately stepped.
Dot intensity is continuous across grid boundaries, avoiding an accidental
quantization flicker. None of these effects changes the ride or music.

Independent criticism materially changed the prototypes: stronger contours and
stems at phone scale, richer print colour, a wider fan, a softer constant paper
shadow, no Aurora reflection, continuous dot transitions, and a fixed morphology
radius crossfaded by contact strength instead of a potentially quantized radius.
Temporal-frame reviews covered strong, dense and quiet Petrunko passages. They
are visual frame-sequence reviews with sound muted, not listening judgments.

The curated full-film choices are Lua–Aurora, Petrunko–Cut paper,
LOS–Filament, LOS–Memory, Petrunko–Phosphor and LOS–Arc light. The existing approved treatment
remains the production default and the comparison reference. Arc light addresses the review finding that most new dark looks are quieter
than Approved; it combines existing primitives rather than inventing another
effect family. The fan and quieter line studies stay accessible without being promoted as recommendations.

### Compositing and playback evidence

All 12 new surfaces pass alpha/background and geometry-overlap checks, including
actual Remotion renders. At 540px, half-strength stamp expansion produces 50.24%
of the full added ink, with monotonic intermediate pixels; it is a visible,
continuous effect. Evidence: `generated/style-lab-v2/compositor-audit/`.

Four two-second playback samples in the existing Brave session displayed
120–121 frames each, with 0, 0, 0 and 1 dropped frame while two renders ran.
These short samples are a sanity check, not a claim of universal playback
smoothness. The computer and test-page audio were muted.

The second study adds no authoring language, automatic style decision or resume
protocol. Scratch scripts and render manifests remain in the generated directory.

### Delivered second study

- **51 short clips:** sixteen directions/combinations plus Approved, across all
  three passages, at 540×960 and 60 fps.
- **Nine full movies:** six selected treatments and three song references, at
  1080×1920 and 60 fps. Full-film switching keeps the same song/playhead while
  comparing its available treatments.
- All **60 files** decode completely with expected frame counts and BT.709
  limited range. Decoded PCM audio is identical within each comparison group.
- **90 short-film switches** and **nine paused plus nine playing full-film
  selections** pass across all three songs, with no page errors or phone-width
  overflow. Separate existing-Brave checks cover short and full-resolution files.
- **401 tests** passed in the full suite. Following the final grouping/fullscreen
  changes, all **11 player tests** pass. Both TypeScript projects, reachability
  (zero unreachable files), and judge parity (33 tracks) pass.
- The approved reference still is pixel-identical. No compiler/specification
  path changed; this study does not claim new compiler-performance evidence.

The selected films are accessible through `full-collection.json`; all directions
are in `collection.json`, both under `generated/style-lab-v2/`. Rendering,
verification, browser checks and provenance remain beside those local artifacts.
The full-quality experimental masks/halos can cost more to render than the
approved recipe; observed concurrent-job times are recorded, not presented as a
controlled speed comparison. The native ride export is reused throughout.

The physical phone still needs the owner's normal-use feedback. Visual critiques
used stills and temporal sequences; browser checks measured actual playback but
all local audio stayed muted. No listening review is claimed.

## Third study: brighter paper and contact gestures

Owner feedback favours several useful presets, with more bright backgrounds—not
necessarily white—and particularly the warm paper treatment. The third study
adds seven light candidates; earlier light/dark collections remain available.
It rebases the branch onto foundations `eeec89e2`. The construction-verifier
conflict keeps upstream's shared `catchReceivers`/`receiverPoints` implementation.
Saved rides remain fixed for fair style comparison; future compilations use the
rebased compiler.

| Candidate | Leading idea | Review position |
| --- | --- | --- |
| Daybreak | Mint/peach atmosphere on cream, requested-air framing, open contours | Lua full film |
| Press pop | A single contact zoom pulse with no oscillatory rebound; folded spectrum | Petrunko full film |
| Sunprint | Bold blue geometry on yellow paper, stronger light-theme dots | LOS full film |
| Living ink | The dark core warms from teal to burgundy on measured contacts | LOS full film |
| Registration lock | Two underprints gather into the core on contact, reversing the outward ink burst | Focused ingredient |
| Letterpress | Opposing same-frame highlight/shadow edges and folded frequencies | Material experiment |
| Side glide | A small horizontal contact kick and gentle roll, with overscan | Camera experiment |

New spectrum forms are folded faces with continuous band heights and peak caps.
Caps use each band's actual maximum over the preceding 0.4 seconds, including
the current frame. They are frequency peaks, not inferred beats or vocal events.
Camera direction is artistic, not inferred travel direction. The colour pulse
keeps both ink endpoints dark; it is not a quantitative force ruler. No new
handcrafted effect timeline or automatic style-selection workflow was introduced.

Independent critique promoted Daybreak/Press Pop/Sunprint and, after contact
sequences, Living Ink. Registration is legible but subtle. Letterpress does not
yet justify a full-film slot beside Press Pop. Side Glide retains rider detail
at full resolution but deserves real-time taste review; half-resolution
transform resampling looks softer. The dot and cap bodies were strengthened for
bright-background phone legibility. Geometry is never anisotropically distorted.

Artifacts and scratch scripts live under `generated/style-lab-v3/`. The main
collection includes Approved, Cut Paper, Elastic and Two-colour Print references.
The full-film view also retains Petrunko's earlier Cut Paper favourite. All local
review audio stayed muted; visual frame-sequence critique is not a listening review.

Third-study validation: 33 short clips (21 new plus 12 references) and eight full
movies (four candidates, three approved references and Petrunko Cut Paper) all
decode completely with expected frame counts, BT.709 limited range and identical
PCM audio within each comparison. Browser checks pass 51 grouped switches and
eight paused/eight playing full-film selections across the three songs, with no
page errors or phone-width overflow. All seven new surfaces pass alpha and
geometry-overlap audits. Side-glide overscan is checked by inverse-mapping frame
corners through its translation/rotation; dark ink contrast and contact settling
have regression tests. Approved and Cut Paper reference stills are pixel-identical.

The rebased full suite passed 407 tests; final focused checks passed 34 tests.
Both TypeScript projects, reachability and judge parity (33 tracks) pass. Physical
phone testing is not claimed. Full-film and short-passage links are in the two
collection JSON files under `generated/style-lab-v3/`.

## Cool light: identities rather than a warm-paper default

User feedback: Press Pop and Sunprint leaned too far into yellow/orange. Bright
work should include cool, neutral and coloured light backgrounds. The fourth
study keeps the existing studies intact and compares four complete treatments:

- **Mint relief:** plum geometry, cool mint paper and a lilac directional shadow
  shared by the spectrum. The relief gathers on measured contact; camera rests.
- **Iris weave:** navy geometry and a lavender field, with seven actual historical
  frequency contours at 60 ms intervals. Slow framing follows requested air.
- **Cobalt poster:** open blue frequency brackets, cyan contact underprint and a
  concise zoom pulse. Precise rather than exuberant; the name is an art direction.
- **Magenta signal:** one assertive magenta contour and matching contact edge,
  with a steady camera. Deliberately spare; not every song needs this restraint.

Separate Porcelain/Mint/Lilac Press controls change **only colours**. Their motion,
material weight, spectrum geometry and timing match Press Pop exactly. This lets
us discuss colour without confusing it with effect preferences.

Two independent agent critiques informed the selection and reviewed rendered
frames. Initial cobalt/magenta strokes were too delicate at phone width; they
were strengthened without glow or greater amplitude. Iris history was made more
visible while remaining less than half the current contour's opacity. Mint was
already coherent; more shadow would soften the rider unnecessarily. Empty upper
space is useful and was deliberately retained.

The new spectrum forms are open SVG marks. Weave linearly reconstructs adjacent
real spectrum rows for smooth history; it invents neither instrument labels nor
pre-roll. No new effect timeline, automatic style choice or orchestration layer.
The approved production recipe remains unchanged. The study is opt-in.

Artifacts: `generated/style-lab-v4/collection.json` groups complete identities,
colour-only controls and material comparisons. `full-collection.json` pairs Lua
with Iris, Petrunko with Mint (plus earlier Cut Paper), and LOS with Cobalt and
Magenta. Earlier collections remain available. Reviews were muted and visual;
they are not listening tests or claims of physical-phone validation.

Fourth-study checks: all 413 repository tests pass; final focused checks pass 38
style/player tests. Both TypeScript projects, reachability and 33-track judge
parity pass. All seven new treatments pass transparent-surface and full-compositor
geometry-overlap checks. The approved reference still is pixel-identical. The
short-passage player passes 39 grouped switches across all three songs, including
playing switches, without page errors or phone-width overflow.

Final delivery: 30 short clips and eight full films (including references) all
fully decode, have the expected frame counts/dimensions and BT.709 limited-range
encoding, and preserve identical PCM audio within each comparison. All eight
full-film selections pass paused and playing switches, with no page errors or
horizontal overflow. Source/props hashes and reviewed code identity are saved
in the local study's `provenance.json`; verification details and scratch review
scripts stay alongside the generated media. Computer output remained muted.

## Unified review

The review entry point is `/motion-gallery/style-review.html`. It links a small
shortlist, seven focused families, all short treatments, all full films, rendered
vignette controls, and explicitly labelled live vignette sketches. The original
four studies and early drafts remain in a collapsed archive; the known opaque-edge
first draft is marked historical rather than offered as a current candidate.

Collections live under `generated/style-review/`. The local `build.py` combines
the four studies by song/style, taking the latest available render for duplicate
entries and preserving absolute source links without copying videos. Every one of
34 distinct short treatments is covered by a family: 102 short videos across
three songs, plus 19 full-film versions. Earlier vignette windows stay separate.
The local inventory records all source entries; no experiment is silently removed.

Validation: all 127 short/full/vignette media references exist and match duration,
frame count, frame rate and decoded PCM audio within their comparison. Browser
checks pass all hub links, desktop and phone-width layout, and 172 focused/player
selections without page errors. No new player implementation or media render was
needed; the existing same-moment comparison player is reused.
