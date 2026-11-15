# Hit movement: historical reconstruction and controlled alternatives

Branch `hit-effects`. This is a reviewable experiment, not an adopted change to
production hit response, themes, compiler objectives or impact measurement.

## Foundation

The completed geometry/memory branch was pushed at `0b8b26b8`. Before preparing
the study rides, merge released `visual-lab` at `5b94a34a` (merge `1bc083f8`).
It also brings the accepted arrival law and gentle exits. Retain accepted
support trimming and memory ownership fixes. Regenerated combined compile
references change only track hashes: all 25 reference scores, losses and charged
work remain identical to the release. Finalization independently verifies the
trimmed ride. Register the release's 33 body-motion research entry points, which
otherwise fail reachability. Integration passes full `npm run check`: 665 tests,
32 Rust tests, 65 exact physics cases / 68,827 states / 432,018 ordered collisions,
compile and judge parity, and smoke (2.4 min).

The renderer, theme collection and visual lab at the branch's initial foundation
already matched this release. The merge also brings playback and dashboard work.
The user's brief transcript is not committed.

## What was there before?

- `productions/tiki_tiki_48s/spec.ts` originates at `93c5f97d` (17 June). Its musical
  content and zoom keyframes remain unchanged: later edits remove an unused helper
  and `jitter: 0`. This is the original specification, not the newer voice-drums one.
- The June production post-processing arrived at `220ac5bf`; the shared locked
  recipe at `7934ef47` sets translation 10 px, rotation 0.4 degrees, constant scale
  1.04, frequencies 9 Hz / 12.33 Hz / 8.1 Hz. Impacts above 0.22 add
  `strength * 1.6 * exp(-7 * age)`; clamp the sum to 1, then raise to 1.5.
  Oscillator phases read absolute time, not age since the latest hit. This recipe
  remains in September commit `cbe45a57`.
- The exported ride beneath it used native follower module 560 and the six body
  points. Authored zoom was multiplied by 1.8 for vertical production; the top
  30% of authored impacts could add a 6.5–13% zoom punch, one-frame anticipation
  and four-frame exponential recovery. This depended on requested impacts and
  beats, not today's measured force peaks. Jolt authoring offsets also existed.
- October 31 changed the export follower to the ten-point centre to remove spin
  lurch (`1a05b1c2`; `docs/research/camera-20261031.md`). The old review player had
  separately followed PEG; that was not the six-point video camera.
- November 8 (`281f6390`) replaced native export + Remotion with the single canvas
  renderer. November 11 round 26 settled split + colour boost + strong-hit shake.
  November 14 round 50 moved shake onset from 0.6 to 0.55, reaching 28 px at 0.85.
- An actual September 7 Tiki production survives on `wyss@10.77.77.30` at
  `line/archives/native-motion-feedback-2026-09-07/production-videos/tiki_tiki_48s/`
  `tiki_tiki_48s-s260907010/`. Its `upload.json` records seed 260907010 and
  `cbe45a57422c748896067604e8132bad4c6f59cd`. The movie and metadata are copied to
  `generated/hit-effects/archive/` and shown as historical reference only.

No old renderer or Remotion dependency is restored. The old motion law and zoom
math are reconstructed in the lab; the exact vendored follower is repackaged as
a browser module by the preparer. All new pictures use `scripts/video/picture.js`.

## Why the current response may read differently

Today the ten-point body centre is the world anchor. The follower places that
anchor on screen according to travel direction; zoom is normally steady. A hit
translates rider, ink and pencil together, leaving sky and music band fixed.
Its direction is opposite the contact normal. One winning event drives the
colour response and shake, with a 6 Hz cosine times the response envelope.

At strength 0.85 the translation jumps to +28 px, and at 83.3 ms is -19.44 px:
a 47.44 px reversal. This can contribute to apparent reversal of the rider;
it is a mechanism, not a demonstrated explanation of the owner's judgments.

There is another source of movement: colour split enlarges its composited image
to hide edge gaps. `split.js` uses `m = ceil(0.61 * split * canvasScale) + 2`.
At strength 0.85 this is 18 px on a 1080-wide frame, about 3.33% enlargement;
at the initial study's 360-wide preview it was 8 px, about 4.44%. The revised preview uses the production 1080-wide canvas. The clean rider is
partially overlaid afterwards. Thus no-shake still has a small image pulse and
its edge padding is resolution-dependent. This is unchanged here to preserve
released output. The study has separate colour and split switches to isolate it.

A translation in the world-to-screen matrix and a translation of an already
rendered ride layer are geometrically equivalent when applied to the same
content and pivot. They are not necessarily pixel-identical (sampling, crop,
rotation pivot and layer scope differ). The older vibration also rotated the
ride and used constant overscan. Its whole original effect cannot be inferred
from just today's shake amplitude.

## Study and candidates

`/generated/concept-lab/hit-motion.html` on the review server. Two fresh seed-101
rides, compiled after integration, with exact recorded trace checks:

| Song | Specification | Recorded hits | Timing offset |
|---|---|---:|---:|
| Tiki Tiki | original `spec.ts` | 77 | 0.0163766234 s |
| Circus Minimus | current `spec.ts` → voice-full | 199 | 0.0130100503 s |

Production record SHA-256, compiler identity and timing are visible on the page.
The resulting ride scores (801.4345 / 762.0033) describe the inputs, not an effect
improvement: every effect uses identical physics and timing.

Compare current shake, no shake, recovered old vibration, and six new families:

- Single recoil: one 18 px kick at reference strength, monotonic return, 180 ms.
- Press and release: continuous onset, 16 px peak at 45 ms, settles at 220 ms.
- Soft spring: continuous attack and one small rebound, settles at 240 ms.
- Fine vibration: brief 10 Hz tremor, 8 px at reference, settles at 140 ms.
- Rotational knock: up to 0.55 degrees plus 5 px recoil at reference, 200 ms.
- Lens pulse: 3.5% zoom around the rider at reference, no translation, 200 ms.

New families use the existing strength curve, sum finite hit responses and cap
translation, rotation and log zoom. They do not switch motion when the winning
colour event changes. They are intentionally different in size as well as shape;
this is an exploration, not a matched-amplitude preference experiment. Current
split/boost remain identical across arms unless disabled for inspection.

The camera selector changes both arms: current placement, old follower on six
points, that follower on ten, and old follower with recovered authored zoom/punch.
Fixed-camera comparisons share zoom 6.2. The recovered authored mode uses the
original production defaults, any authored punch overrides, and the scene's contacts, without old jolt
shifts; it falls back to 6.2 if no authored lane exists. Rotation pivots around the
rider here, and constant old overscan is omitted. The reconstructed old law uses
today's measured strengths/peaks and absolute song-time phase. These limitations
are deliberate and explicit; it is not a claim of reproducing archive pixels.

Playback uses the shared Web Audio output clock. The same pure movement functions
produce playback, 240 Hz curves and passage metrics. Strong-hit shortcuts and the
densest strong-hit passage are selected algorithmically for each song. Frame
stepping, slow playback, passage loops, shareable controls, and a single large
picture switcher on phones support close comparison. Nothing is auto-adopted.

## Implementation and verification

The renderer accepts optional study callbacks for effects and framing. Production
callers omit them. It supports optional scale and rotation, with a correctly
transformed clean-rider layer for the colour split. Default arithmetic and draws
remain unchanged. Rotated study frames conservatively draw all track lines;
this study makes no throughput claim for large rotated scenes.

Browser evidence in `generated/hit-effects/browser-results.log`:
90 frames across both songs and three themes are byte-identical to released
`5b94a34a` when no study callback is supplied. All 9 movement modes × 4 cameras ×
2 songs are seek-order independent; selecting current on both sides gives
identical images. Rapid song switches and audio play/pause pass with no page
errors. Desktop and phone layouts inspected. Unit tests cover response causality,
dense opposing hits, caps, colour isolation, recovered formula and authored zoom.

Reproduction: compile `npm run produce -- --song=<song> --seed=101
--out=generated/hit-effects/rides/<tiki|circus>` on a stable checkout, then run
`node generated/concept-lab/hit-motion-prepare.mjs`. The preparer uses the existing
scene builder and bundles only the vendored follower, not a second renderer.
Raw scenes, movies, screenshots and ad hoc browser checks remain ignored under
`generated/hit-effects/`. The lab source and regression tests live on this branch.

Final study check: full `npm run check` passes (672 tests, Rust, physics, engine,
compile/judge parity and smoke, 2.4 min). The subsequent authored-punch override
regression brings the focused video suite to 30 passing tests; typecheck and
the complete browser comparison pass again. Phone startup, large-picture A/B
switching and split-off links also pass on the WireGuard address.

## Review layout correction

The owner found the separate dark dashboard, low-resolution preview, distant
switches and stacked curves difficult to use. The page now imports the visual
lab's component stylesheet, uses light review chrome, and places effect controls
beside a sticky large picture. On phones an effect selector stays with the picture.
The full current theme registry supplies the looks. All previews draw at 1080 ×
1920, matching production output dimensions, instead of enlarging 360 × 640.

Single-picture mode renders only the visible arm. Effect switches reuse prepared
pictures and scratch canvases, and keep the audio clock running. A switches the
reference/candidate picture; paired viewing remains available. Charts overlay
current (grey dashed) and candidate (blue) in four charts shown together: vertical,
horizontal, rotation and zoom. Each has shared axes, explicit units and direction
explanations; all four share the playback cursor. Clicking the chart seeks the
picture. Detailed measurements and historical notes are collapsed.

`node tests/browser/hit-motion.mjs` checks both songs, desktop and phone controls,
light chrome even with a dark OS setting, 1080 canvas dimensions, switching during
playback, paired identity, chart series, and a full-resolution study frame against
the production picture. It requires prepared study data and the review server;
`HIT_STUDY_URL` overrides the address. Screenshots and results stay in
`generated/hit-effects/`. Effect laws and production rendering code are unchanged.

## The owner finds the weight in the punch

The owner reports a strong, satisfying impact on most strong hits in both songs
with “No shake” and “Old follower + authored zoom / punch”. Other followers and
current shake do not recover that feeling. The owner is not deciding on the slow
authored zoom yet. This feedback isolates shake as unnecessary, but does not yet
separate the slow lane, short pulse, and follower response. Review uses moving
video with music; asking for words such as “thump” was not helpful.

The recovered pulse reaches 13% extra zoom in both songs. Its default attack is
one physics frame (25 ms), beginning before the authored beat. Its exponential
recovery has time constant four frames (100 ms), with a finite 500 ms tail. It
uses authored contact requests: Tiki's gate is the 70th percentile; Circus has an
explicit 0.8 gate. Larger requests above the gate scale the pulse from 6.5% to 13%.
Overlapping pulses take the maximum, not the sum. These are presentation settings,
not new physics or impact measurements. Normal production does not use this lane
or pulse.

New one-click, no-added-shake comparisons: no zoom/punch, slow lane only, lane plus
pulse, pulse at fixed base zoom, and the identical pulse with the rider's screen
position following the no-pulse path. The last pair isolates the follower/position
interaction. At every half frame, its two zoom paths are identical and its held
position exactly matches the fixed-zoom follower. Over the whole rides, the coupled
rider position differs vertically from the held position by −3.33…+13.57 design px
on Tiki and −3.84…+13.90 px on Circus (positive down). This supports testing the
owner's “falling camera” intuition; it does not establish a perceptual explanation.

Camera graphs now show the pulse separately and the overall camera zoom, including
the slow lane. They use actual interpolated camera samples and include every
physics-frame vertex so a plot sampling grid cannot miss the peak. The previous
four graphs still describe only added hit motion, with this exclusion explicit.

The extraction preserves the old combined zoom exactly at every physics frame of
both saved rides. Unit tests cover decomposition, gating, decay, and interpolation.
`tests/browser/hit-punch.mjs` verifies the five controls on both songs and the exact
same-zoom/fixed-position contracts at every half frame, without browser errors.
No production effect or slow authored zoom has been adopted.
