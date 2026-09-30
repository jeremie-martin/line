# Functional rails and faithful gallery playback

The default [motion gallery](http://localhost:8767/motion-gallery/) now compares
arcs with trimmed guides, **Paired rails** with full guides, improved scattered
segments, waves, facets, serpentine rails, terraces and ripples. The original
scattered controller remains a comparison. Ribbed ribbons, crystal teeth and
petal chains are archived, accessible through the gallery's historical links
and explicit study methods, but no longer part of the default selection.

## What the paired option changes

The ordinary arc search already evaluates opposing guides extending from near
the start of each support. After replay, it removes unused guide sections,
preserving a coherent curve around the sections actually contacted. The three
outlined experiments skipped that reduction to preserve their structures.

The paired option exposes this existing distinction directly with
`pruneGuidance: false`. It keeps the full physical guides without ribs, teeth,
lobes, or a separate compiler. It retains the same search and proposal settings
as ordinary arcs. It does not add rails across ballistic gaps or require the
rider to touch every guide section. This is a geometry presentation choice,
not evidence of a new control capability.

The new study has **216 rides**, all passing the timing and survival contract:
six passages × two seeds (201/202, 2% target jitter) × two allowances
(100,000/250,000 frames) × nine methods. For all **24 paired comparisons**, the
saved body trajectory, score and physical work exactly match ordinary arcs.
The paired tracks contain **11,017 additional normal guide segments** in total;
every retained ordinary-arc segment is unchanged. The other **192 tracks,
scores and physical-work counts** exactly match the preceding gallery.

At 100,000 frames, both arc variants average **860.3978**; at 250,000 they
average **847.3244**. These are matched research-passage means, not V4 headlines.
The higher allowance is not guaranteed to improve the score; this rendering
and presentation change does not resolve the existing search behavior.
See [complete measurements](evidence/motion-gallery-functional-20260930.json).

## Rendering and replay

The previous gallery drew a simplified skeleton and constant screen-width
lines. It now uses the local Line Rider v2153.0 **Canvas renderer and original
Bosh sprite artwork**, including the scarf, pose changes and blinking. Its
lines are black, two world units wide, with round ends on white, including
in the small palette previews. The old green contact-ring overlay is removed.
The follow/overview cameras, frame label and dashboard remain gallery controls;
this is not a production video with music, camera choreography or post-processing.

The integration bundles existing `unpacked/` modules unchanged. Module 505
provides the native engine, 502 creates lines, 823 generates rider entities,
206 maps the sprite, and 805/806 draw lines and sprites. The gallery loads the
same `mirror/_v2153.0/bosh-sprite.svg` used by the app. It does not mount the
editor, inspect React internals, or copy an old dashboard implementation.
The two generated browser bundles total about **385 KB**, before compression.
Source and output hashes are recorded by the build.

Each selected track is replayed once in a background worker. Every recorded
body-point coordinate must agree with the saved 40 Hz WASM trace within
1e-7 world units; disagreement prevents display. The native engine supplies
the cosmetic scarf and rider state. Scrubbing interpolates cached points and
state using the app's arithmetic and generates the native display entity.
No physics or compilation happens while dragging the slider. Replay caches
are bounded to 24 records; paused playback does not run an animation loop.
Normal-line checks and existing artifact checksum checks remain mandatory.

## Verification

All **744 native replays** (the new 216 rides and 528 archived rides) agree
exactly with the saved body-point traces: **zero maximum coordinate error**.
Every one of the 216 current comparisons was exercised through the browser.
Four tracks also match the full app at integer and fractional frames, including
all scarf points and rider-state counters. A separate dense comparison matched
38,760 coordinate values across four tracks and every integer frame.

Browser checks cover checksum refusal, deliberate physics-drift refusal,
acceleration-line refusal, style selection, preserved playhead, beat seeking,
slider scrubbing, quarter-speed playback, pause, overview/follow views, and
mobile layout at pixel ratios 1 and 2. Screenshots were inspected locally.
Drawing a 1,042-line paired track averaged 1.47 ms per frame; the largest
current track (4,365 scattered segments) averaged 3.20 ms. Those are measured
on this machine at 600×390 and pixel ratio 1 with forced Canvas readback, not
a device-independent frame-rate guarantee. The
[compact validation record](evidence/motion-gallery-functional-20260930-checks.json)
contains replay timings, source hashes and every checked record identifier.

## Reproduce

`npm run dash` automatically builds the native renderer before starting the
server. If starting `scripts/serve.ts` directly, first run
`npm run gallery:renderer`. Generated bundles, tracks, screenshots and replay
archives remain local.

The dataset used the unchanged, clean compiler worktree at `4236051f`; its
identity and the current harness hashes are included in the manifest. To
regenerate with the current compiler, choose a fresh output directory:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root="$PWD" --out=generated/motion-gallery/my-functional-study
npm run dash
```

Open `/motion-gallery/?data=/generated/motion-gallery/my-functional-study/manifest.json`.
The default allowances and seeds reproduce the comparison design. To check
native replay and the browser controls against a local dataset:

```sh
node scripts/gallery/check_renderer.mjs \
  generated/motion-gallery/20260930-functional-rails/manifest.json \
  generated/motion-gallery/20260930-ten-shapes/manifest.json \
  generated/motion-gallery/20260930-ten-shapes-seeds/manifest.json \
  --out=generated/gallery-native-20260930/checks.json
```

An optional `--mirror-origin=http://127.0.0.1:8765` checks integer and fractional
poses against the complete locally served app, including scarf and rider-state
counters. The first manifest supplies the functional UI comparison, including
arcs, paired rails, scattered segments and ripples.

No compiler implementation, production settings, physics, benchmark or scoring
code changed. The 12 focused geometry tests pass, and TypeScript still reports
its 251 inherited diagnostics with no additions.
