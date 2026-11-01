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
