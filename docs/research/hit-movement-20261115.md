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

## Realized-strength response and rider-screen diagnostics

The owner feels little punch with the steady-rider version, suggests trying a
larger dose, and requires any future response to depend on realized strength,
not a top-percentile gate. Keep historical modes for comparison only. Rename
“slow zoom” to “song zoom keyframes”: these are the original spec's explicit zoom
values over song time, unrelated to fold geometry or the follower algorithm.

Tiki near 13.95 s: authored beat 13.91, requested strength 0.71768; old 70th-percentile
gate 0.73976, so no historical punch. The measured peak is frame 558, song time
13.9336233766 after the recorded timing offset, realized strength 0.7195592952.
Circus's nearby authored requests also fall below its explicit 0.8 gate.

The new **study** response uses the same matched measured events as the current
hit model. No punch up to 0.55; smoothstep to 13% at 0.85; linear growth beyond the
reference; 35% safety cap. Threshold and reference amplitude are adjustable in the
lab, including a 26% comparison. This gives Tiki's missed hit a 7.764% peak punch
at the initial settings. The response is absolute across songs; unrelated events
never change its amplitude. Max overlap prevents accumulation. It peaks at the
measured force peak with a 25 ms rise before it and 100 ms exponential recovery,
cut off after 500 ms, preserving the historical timing shape while replacing its
strength source. This offline anticipation is explicit; it is not a claim of
causal online feedback or a return to authored beat timing.

Three contexts share this exact dose: old follower responding to zoom, old follower
with the rider's no-punch screen path retained, and the current direction follower
with a rider-centred pulse. No slow song zoom is needed in any of these. No response
or threshold has been adopted in production.

Screen diagnostics project the same ten physical body points through the selected
camera, added translation, rotation and scale. Report the body centre, RMS radius
(rotation-invariant apparent size), total centre travel and peak centre speed at
60 fps. Added displacement/size are relative to that camera with its punch and
added hit motion removed; the historical combined mode retains the song keyframes
in its counterfactual. Actual screen speed includes normal following motion. The
same-passage table compares all camera choices with the selected hit effect.

These measurements are before colour split: a split creates multiple fringes and
a partial clean-rider overlay, so it has no single unambiguous raster centre. They
exclude artwork beyond the physical points (e.g. scarf). They describe geometry,
not perceived impact or aesthetic quality. A large size pulse with zero added
centre displacement is an expected, useful result for a rider-centred zoom.

Validation: absolute thresholds, monotonicity, caps, song independence, requested
versus realized strength, timing/overlap, frame interpolation, size/translation
separation, and speed/path metrics have unit coverage. Browser validation compares
180 frames across both songs, all ten cameras, and still/roll/lens effects against
the actual world matrix returned by `picture.draw`; maximum discrepancy is below
0.000001 design pixel (test tolerance 0.00001 for DOMMatrix trig arithmetic).
`tests/browser/hit-screen.mjs` also exercises both songs, the 26% setting, and the
all-camera table. Prepared-picture/observer caches are cleared on response changes
so interactive tuning does not retain unbounded camera paths. Production renderer,
compiler, physics and rulers are unchanged.


## Next study: camera, zoom and felt weight

The owner reports that the historical song zoom plus punch feels like the rider
falls into the geometry and bounces, especially on lower hits. Steady-rider punch
feels weaker, even though it enlarges the scene. This is a perceptual observation,
not evidence that a particular follower, amplitude or split direction is correct.
The goal is to improve the whole response, not to adopt the historical stack.

### Separate the layers before comparing combinations

| Layer | Current contract / available comparison | Next controlled comparison |
| --- | --- | --- |
| Follow and composition | Current direction follower uses the raw ten-point centre; historical six/ten-point followers are references | Same zoom and pulse, current vs historical follower; inspect descent, rebound and spins |
| Song-scale zoom | Current steady/quiet zoom; historical explicit song keyframes | Current follower × steady / keyframes / keyframes with bounded intensity modulation |
| Opening and ending | Production blends overview and ride framing; this study forces `ends: none` | Apply the same overview transitions to each candidate, including hits during transitions |
| Hit punch | Historical requested-strength gate only for reference; new absolute realized-strength curve | Same measured hits and pulse timing; vary amplitude, attack and release separately |
| Added movement | Translation, rotation and scale curves already isolated | Add one component at a time to a promising camera/punch combination |
| Colour split | Angled channel separation, edge-cover enlargement and half-clean rider overlay | Off / existing / surface-normal alignment; isolate enlargement from channel separation |

These are planned comparisons, not implemented controls or validated combinations.
In particular, current follower plus song keyframes is not yet available. The
`measured-current` study mode multiplies the current framing's zoom with a pulse;
it does not implement a composed song-zoom or transition policy.

### Preserve the reasons for the current camera

`scripts/video/camera.js` documents the current direction follower. It pivots on
the raw body centre to avoid introducing artificial motion through smoothing.
Its target follows smoothed travel direction, with offsets fading at low speed.
It moves readily with travel and limits motion against it; while descending,
upward screen movement is limited to 45 design px/s. These are deliberate
readability choices, not incidental constants to discard for more bounce.
The earlier ten-point-centre repair and spin measurements are recorded in
[camera-20261031.md](camera-20261031.md); that older follower study is not the
specification of today's direction follower.

Production bookends use one camera representation, blending zoom logarithmically
between an overview and the ride camera while blending rider screen placement.
A candidate song zoom should feed the ride zoom before this blend. Decide
explicitly whether a hit pulse fades with the ride blend, rather than accidentally
magnifying the overview. Check the first/last hits and transition continuity.

### Direction is more than a screen arrow

`prepareHits` in `scripts/video/hits.js` estimates a surface normal toward the
rider from contacts around onset, while the response fires at the measured peak.
This is a geometric estimate, not a measured impulse vector. Missing geometry
falls back to upward. `scripts/video/split.js` deliberately combines that normal
with a horizontal direction before separating red and blue. For an exactly
vertical normal this produces a diagonal split. The operation also enlarges the
image to hide edges and overlays half of the clean rider. Thus changing split
angle alone cannot isolate all of its effect on perceived weight.

Before changing direction, inspect contact selection and normal orientation on
lower, upper and side hits. Compare the normal, incoming velocity and camera
screen axes explicitly. Keep the existing split as a reference; no direction
bug has yet been established by the owner's observation.

### Order and evidence

1. Keep the same Tiki/Circus rides, audio clock, theme and resolution. Compare
   follow × song zoom first, with shake and split off and the same realized pulse.
   Include pulse-off versions to isolate following from punch. Hold the pulse
   curve fixed while comparing cameras, then tune it on the preferred context.
2. Review isolated strong lower hits, weak hits, upper/side hits, dense sequences,
   spins and quiet travel. Identify actual matching passages before calling this
   scenario coverage; do not assume both songs contain every case.
3. Verify opening and ending transitions, then add shake/rotation and split one
   at a time. Repeat promising combinations with production colour and layout.

Report rider displacement/size, peak speed, recovery and framing/clipping beside
moving video with music. Existing screen metrics stop before split and do not
measure track clearance or perceptual weight. Add those diagnostics where needed;
do not collapse them into a quality score. The owner judges whether the added
weight preserves readability. Historical controls remain references, and no
candidate becomes a production default through this housekeeping step.

Checkpoint: full repository checks passed at the realized-punch implementation
(682 JS tests, 32 Rust tests, physics/engine/compile/judge parity and smoke).
The subsequent all-camera browser check covers 180 frames across both songs.
This section records the next experiment and limitations; it changes no runtime
behaviour.


## Scene size and vertical movement trials

Hypothesis from the owner: a percentage zoom pulse may feel better when the rider
starts smaller, because its absolute enlargement is smaller. The new scene
magnification slider (0.5–1.5×) scales the final camera zoom around the rider while
preserving the exact follower screen path, historical keyframe lane and percentage
pulse. At half magnification, the rider's pixel-size increase is also halved.
This is an isolation experiment, not a full historical-camera retuning: changing
the historical follower's internal zoom would also change its dead zone and path.
The setting is shared by both comparison arms and saved in comparison links.

Two movement variants retain the current realized-strength response, winning hit,
envelope, frequency and displacement magnitude. “More vertical” quarters the
horizontal direction component then normalizes; exactly sideways hits stay
sideways. “Downward hit” uses a downward initial displacement on every hit,
including upper hits, with the original oscillating rebound. It deliberately
ignores surface direction to test the falling impression. Neither changes split,
colour or camera punch. Disable split when isolating these movements.

Compare the same strong hit at 0.5×, 1× and 1.5× first with no shake and the
historical keyframes/punch, then compare current / more vertical / downward hit.
A song-wide change or a different hit cannot isolate scene-size preference.
Production defaults remain unchanged; the owner has not judged these trials yet.

Validation: all repository gates pass (683 JS tests, 32 Rust tests, compile/judge
parity, physics/engine and smoke). Browser checks cover 900 rendered frames across
both songs, ten cameras, three magnifications and five movement modes, with
projection discrepancy below 0.000001 design pixel. They also assert unchanged
follower placement at each magnification. Desktop/phone layout, playback
switching and production-reference equality pass. These establish implementation
correctness, not a perceptual verdict.

## Taken over on `visual-lab`: what differs on screen (measurement, 2026-11-15)

The study files were brought onto `visual-lab` alone (the branch's own compiler changes were not). The two rides were
recompiled here with the current compiler (Tiki original spec 788.4, Circus 749.4, seed 101), so hit times differ from
the first study's.

Measured for every camera version, on the strong lower hits (realized strength ≥ 0.7; 16 on Tiki, 6 on Circus; every
strong hit in both rides is a lower hit): the rider's vertical speed on screen and the speed of the ground under it,
0.1 s before and 0.1 s after the hit. Design pixels per second, positive down, medians, Tiki:

| Camera | Zoom | Rider before | Rider after | Ground before | Ground after | Rider's share of the change |
|---|---:|---:|---:|---:|---:|---:|
| Today's | 6.2 | −45 | −45 | −2279 | −748 | 1% |
| Old follower | 6.2 | +21 | −223 | −2245 | −990 | 17% |
| Old follower, song zoom | 3.7 | +28 | −211 | −1277 | −686 | 30% |
| Old follower, song zoom, punch (the one the owner feels) | 3.7 | +51 | −257 | −1199 | −714 | 42% |
| Old follower, punch, steady rider (the one he does not) | 6.2 | +21 | −223 | −2245 | −994 | 17% |

Circus gives the same order (1%, 11–14%, 23%, 33%). After a hit the rider rises about 50 px on screen within 0.3 s
under every old-follower version, 15 px under today's.

- Under today's camera the rider does not move on screen at a hit: the whole event is the ground, passing at more than
  a screen height per second, slowing down. This is by design (the rider is the pivot; it may rise at most 45 px/s
  while descending).
- Under the version the owner feels, the rider drifts down in the frame before the hit and moves up after it, in a
  scene that passes half as fast, and the punch adds to both.
- **Hypothesis, not yet judged:** the weight is read from the rider's own change of motion on screen (the camera
  carrying on a little when the rider is stopped), against a ground slow enough to read; the punch strengthens it and
  is not enough alone. Three separate causes are confounded in the liked version: the follower, the smaller scene and
  the punch.

## The pairs session (`hit-weight-2026-11`)

`/generated/concept-lab/hit-pairs.html`: one strong hit looping with the music in two versions, switched in place, sides
shuffled. Two answers per pair (which hit has more weight; which he prefers to watch), saved by the labels API to
`labels/studies/hit-weight-2026-11.jsonl`; the list of pairs and which side holds which version is
`labels/studies/hit-weight-2026-11.manifest.json`. 19 pairs (14 on Tiki, 5 repeated on Circus), each changing one thing:
the rider moving in the frame (old follower against today's), scene size (6.2 against 3.7), the punch (13% at realized
strength 0.85, at most 16%, centred on the rider or read by the old follower), today's shake, and **carry**
(`hit-pairs-camera.mjs`): today's camera, where at each hit the rider moves on screen by its own change of velocity
(0.033 s of it at the peak, out in about 0.1 s, back in about 0.5 s, from strength 0.3, full at 0.55). Carry is a first
guess at getting the old follower's rebound from the measured hit alone; it is in three pairs.

## Answers to the first pairs (19, 2026-11-15)

One answer per pair, so each line is an indication, not a result. He judged the hit only; "prefer" equalled "weight" in
18 of 19 and is dropped.

- **The rider moving in the frame (old follower against today's): more weight, 3 of 3** (Tiki at both scene sizes,
  Circus). On Circus he prefers today's placement: the old follower puts the rider and track too low.
- **Scene size alone: no difference, 3 of 3** (6.2 against 3.7, both cameras, both songs).
- **Today's shake: more weight, 2 of 2** (on today's camera and on the old combination).
- **The punch: more weight in 3 of 5, same in 1, less in 1** (the less: today's camera at the large scene).
- **Carry: mixed.** Better than today's camera at the small scene with a punch; worse at the large scene; against the
  old follower, same on Circus ("a nice bounce") and worse on Tiki, an answer he doubted afterwards.
- The old combination against today's camera without shake: same on Tiki, better on Circus.

Measured afterwards: carry and the old follower move the rider almost alike after a strong hit (Tiki, large scene:
39 px up at 0.1 s for the old follower, 44 px for carry). They differ in two things: carry moves more sideways (26 px
against 16), and the old follower lets the rider drift 5–8 px down just before the hit.

The second round (`hit-weight-2026-11-b`, 18 pairs, `?study=hit-weight-2026-11-b`) repeats three pairs to see how
steady single answers are, builds on today's camera (carry on top of the shake, against the old follower with shake,
7% and 13% punch), varies carry (less sideways, one and a half times, a drift into the hit) and the shake's direction.
The second question is now whether the hit looks wrong in either version.

## Answers to the second pairs (18), and the dials

- **Single answers are not steady:** of three repeated pairs none came back identical (two moved to "same", the punch
  on today's camera reversed). Only directions that agree across pairs are used.
- **Across both rounds:** carry better in 4 pairs, same in 1, worse in 1 (better on top of the shake on both songs);
  the shake alone beats carry alone, and today's direction beats "always downward" and "more vertical"; today's camera
  with shake and carry equals the old follower with shake on both songs; the punch better in 5 of 8, and 7% beats 13%;
  carry one and a half times beats carry, with its sideways part beats without, the drift into the hit changes nothing.
  Nothing looked wrong in any pair.
- **The dials** (`/generated/concept-lab/hit-dial.html`, study `hit-dial-2026-11`): because two close versions are hard
  to tell apart, the owner sets the amounts himself. A passage loops; three dials (carry 0–3 times, punch 0–20% at
  strength 0.85, shake 0–2 times today's) start at random places; the chosen and the starting settings are saved. 12
  passages over the two songs: three strongest hits, two medium hits (0.55–0.7) and the densest 4 s of each. Today's
  picture can be held or shown beside. Every amount follows the measured strength of the hit.

## Carry is the mechanism (owner, 2026-11-15); what it follows today

On the dials the owner recognised carry at once as the bounce he was looking for ("here is my bounciness… falling
into… the track is pushing everything up"), too much at the dial's top. He wants the punch negligible or off (clutter),
the hit movement to be carry and perhaps the shake, and the layers taken one at a time. Open for him: how carry should
grow with the hit (where it starts, how far it goes), as for the shake.

Measured on every hit of the two rides (77 on Tiki, 199 on Circus):

- **The rider's change of velocity points along the surface normal** (cosine 0.99–1.00 from strength 0.3 up). So carry
  moves the picture out of the surface and the shake knocks it into the surface: the same axis, opposite senses, the
  shake first and fast, carry after and slower.
- **Carry as built barely follows strength.** It is sized by the change of velocity, which grows slowly with the
  measured strength: about 30 px at strength 0.5, 37 at 0.6, 43 at 0.8, 49 above 0.85 (Tiki, scene 6.2), where the
  shake gives 0, 6, 21 and 30. On Circus the two are loosely related (r = 0.47; hits of 0.55–0.7 range from 8 to 60
  px). A medium hit gets nearly a strong hit's carry.
- So carry can be defined like the other hit effects: along the hit's normal, sized by a curve of measured strength,
  with its own start, reference amount and timing. It then needs nothing the shake does not already have.

## The hit movement page (`/generated/concept-lab/hit-move.html`)

The owner asked to go on with carry as a curve of strength. `hit-move-model.mjs` (tested in
`tests/video_hit_move.test.ts`) defines the movement under study: today's shake times a multiple, plus carry along the
hit's surface normal, sized by a curve of measured strength (nothing up to `start`, an S-curve to `amount` px at 0.85,
then growing as the shake does, at most 1.7 × amount; several hits together are held to the same bound), out in `out`
seconds and back over `back`. Carry no longer reads the rider's change of velocity. The punch is dropped.

The page plays the whole song under today's camera with this movement, today's picture on hold or beside. One chart
shows the two curves by strength with every hit of the song as a dot that lights when it plays, and two handles (start,
amount); a second shows one hit over time. Settings live in the address and are saved per song by the labels API
(study `hit-curve-2026-11`). First values, unjudged: start 0.4, 60 px, out 70 ms, back 0.3 s, today's shake.

## The owner's settings, and carry in the renderer (under review)

On the hit movement page the owner chose: carry from strength 0.5, 100 px at a strong hit, out in 70 ms, back over 0.3 s,
and half today's shake. `scripts/video/hits.js` now holds carry (`carryAmount`, `carryShape`, `carryAt`) and a response
`hits: 'carry'` with these settings (`carryLit65` for dark themes whose band lights); the page's model uses the same
functions. `v1` stays the production response and draws as before (the renderer test). Whole rides in both versions
(Tiki, Circus, Petrunko `build`, Trouble `contrast-clusters-revisited`):
`/motion-gallery/video-compare.html?collection=/generated/watch/carry.json`. Not adopted until he has seen whole rides.

## Adopted (2026-11-15)

Whole rides held up ("they definitely hold up"). Carry with half the shake is the production response (`MOVEMENT` in
`scripts/video/hits.js`, `v1` and `lit65`); the trial responses `carry` and `carryLit65` are gone. The movement shrinks
with the picture in the opening and ending. The pages of this study call the earlier response explicitly, so they
still show what was judged; the hit movement page opens on the production settings and compares against production.
The carry of the pairs and dials (sized by the rider's change of velocity) is history. `REWORK.md` has the summary.

## Next layer started: the zoom (`/generated/concept-lab/zoom.html`)

A first page to look at a zoom that changes over the song, in the manner of the hit movement page. The camera takes an
optional zoom per frame from a study (`createFraming`'s `scale`; production passes none and is unchanged) and then sizes
the hit movement by it. `zoom-model.mjs` (tested) offers five things the zoom can follow: steady (today), the keyframes
written in the spec, one zoom per section, the ride's intensity, the rider's speed; with an overall closeness, how much
it changes (at most 2.5 times between closest and widest), how slowly, and which way. Nothing is judged or adopted.

## The split adopted; the zoom written for the song (owner, 2026-11-15)

- **Split:** on the split page the owner chose red into the surface at 1.05 times the size. `split.js` now moves red
  along the blow (before: halfway between sideways and the blow) and `hits.js` `split` is a twentieth bigger. The split
  page's "production" is this; the earlier direction is its option "half sideways, half into".
- **Zoom:** of the five sources he prefers a zoom written for the song, for its intention ("there's something to it
  that you cannot replicate"); following intensity or speed would have to be so subtle as to be pointless, since the
  picture should not always open or close with them. He asked for absolute values: a lane must not be stretched to its
  own range. So `zoom-model.mjs` is now keyframes `{t, wide}` on one scale for every song: 0 closest, 1 widest, 0.5
  today's zoom, the widest showing 1.4 times more than the closest (his figure; today's zoom in the middle is my
  choice). The other sources are gone from the page.
- **Drafts** (`zoom-lanes.mjs`, four per song, unjudged): the old spec's lane brought onto the scale by one fixed
  conversion (old zooms ran from 1.55 to 2.9 over all specs); opening with the song (close when calm, wide when full,
  changing at section starts); pushing in through each section; and the reverse reading. The page lets him drag, add
  and remove points and saves the keyframes.
- **What exists elsewhere:** the spec type has `camera.zoom` (keyframes in the first renderer's units) and
  `camera.beatPunch`; about twenty spec files still carry them; today's renderer reads neither. Three themes use the
  "out when quiet" zoom (12% at most).
