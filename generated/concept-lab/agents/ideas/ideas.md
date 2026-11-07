# Ideas: visual concepts for the finished vertical videos

Written before opening `lab.js` or `shots/`. Grounding I looked at: the Approved film (frames at 8/20/33 s of
Petrunko), the v5 catalogue stills, the owner feedback (transcript 906–1012), and the numbers in
`concept-lab/data/*.json`:

| song | length | hits | min gap between hits | sources | course extent (units) |
|---|---|---|---|---|---|
| petrunko | 60.5 s | 79 | 0.30 s | 67 drums, 12 other | 22.8k right × 8.2k down |
| lua | 52.5 s | 90 | 0.225 s | 80 drums, 8 vocals, bass, other | 17.7k × 8.7k |
| los | 57.9 s | 108 | 0.125 s | 82 drums, 26 vocals | 20.7k × 9.2k |

Median rider speed is about 410 units/s (max about 660). There are 1.5–2 hits per second. **Any hit accent must be
fully gone within about 120 ms**, or it will run into the next one. That fact constrains everything below more than
taste does.

What the frames actually show: about 60% of the frame is dead white, the rider is a small black figure in the middle
band, and the lower 40% is a big rainbow bar chart. Today the chart is the main visual event. **The ride, which is the
point, is the supporting act.** Most of what follows tries to reverse that.

Safe area used throughout (1080×1920): keep anything meaningful inside x ∈ [40, 940] and y ∈ [140, 1620]. Bottom about
290 px and right about 130 px are under Shorts UI. The top about 120 px is also under the search/back bar.

---

## 1. Concepts

### C1. Pencil and Ink: the music inks the track
**What you see.** Every line of the track is drawn as a thin, light grey "pencil" line (about 1.2 px, #C9CED6). At the
instant the rider touches a segment, that segment becomes full native black ink and stays black. Untouched guide rails
and paired rails stay pencil forever. Behind the rider, the course is a crisp black-and-grey drawing. Each black stroke
is one musical contact.
**Why here.** The tracks are compiled from a score, so the contacts are the music. Today about half the 5,000 lines
are never touched and add visual noise that looks equal to the hit lines. Inking makes the hierarchy honest: grey is
scaffold, black is music. It is the crispest possible look (Graphite-level clarity on a light ground), with nothing
blurry or lingering.
**Data.** Per-frame contact sets from the trace. The ink time of a segment is its first contact frame.
**Risks.** If the rider skids along one long line, a long stroke goes black at once. Fix this by inking progressively
along the segment from the contact point (sweep at rider speed). On a phone, pencil grey has to stay visible:
#C9CED6 on white is borderline, so test #B8BEC8. Do not make the pencil dashed, because that is cheap.
**Prototype.** Draw the track twice in the canvas: all segments in grey, then only those whose
`firstContact ≤ frame`, in black, clipped by a sweep. Precompute `firstContact[segment]` from the trace's contact
lists.

### C2. Contact Stamp: a hit is a mark, not a shake
**What you see.** At each measured hit, a small, sharp graphic event happens at the contact point and is gone in
100 ms. It is a single short flat bar laid along the line's tangent, 1.5–3× the line weight, plus two tiny ticks that
spring outwards perpendicular to the line (like a stamped staple). The colour comes from the musical source: drums in
the ink colour, vocals in cobalt, bass in deep violet, other in vermilion. Strength sets the length (40–120 px) and
whether the ticks appear at all (s > 0.6). The strongest 5–8 hits of the song (s ≥ 0.75, ranked) get the Approved
"big" treatment (1-frame white flash, 2-frame RGB split), and only those.
**Why here.** Today every strong hit gets the same heavy shake, RGB split and flash. At 1.5–2 hits/s that is a lot
of noise, and the owner noted the split blurs the view. A stamp tied to the contact geometry shows *where* the music
touched, which a full-frame flash can't. Two levels of accent give the minute a dynamic range.
**Data.** `hits[].t, s, src` plus the contact segment at that frame (tangent, contact point = sled point closest to
the line).
**Risks.** Cartoon "impact star" cheapness if it uses more than about 3 strokes or radiates in a circle. Keep it
orthogonal and typographic. Colour coding is pointless if 85% of hits are drums, so make drums the default ink and
treat colour as a rare event. That rarity is actually a feature: vocals on LOS (26) would visibly "speak" in blue.
**Prototype.** A screen-space overlay, 6 frames long, positioned via the world→screen camera transform at hit time
and drawn with eased length/opacity. Trivial.

### C3. Score Rail: you can see the next hit coming
**What you see.** A horizontal band in the upper third (y about 260–420) holds a fixed vertical hairline playhead at
x = 300. Upcoming hits slide in from the right as small solid marks (short vertical bars, height ∝ strength, colour
∝ source) and reach the playhead exactly when the rider hits. Past hits continue left, shrink and vanish within
about 0.4 s. Between marks there is nothing: no baseline, no grid. The marks are spaced in true time, so a drum fill
arrives as a visible cluster and SUSPEND arrives as a visible empty gap. You *anticipate* the silence.
**Why here.** This is the only concept in my list that makes the synchronisation legible to a first-time viewer:
they see "tick, tick, tick… *hit*" and the rider lands on it. It turns a fact the viewer has to take on trust
("the rider lands on the beat") into something they predict and feel confirmed. It also uses the dead top space
with *ride-specific* information, where today's spectrum would look the same on any music video.
**Data.** `hits` (t, s, src), with a fixed look-ahead window of 1.6 s across about 640 px. Phases could set the mark
style (e.g. hollow marks in air-heavy sections).
**Risks.** A rhythm-game HUD (Guitar Hero) reads as "game UI" and could cheapen the whole thing. It also competes
with the rider for attention: two moving things. Mitigations: tiny marks (6 px wide), no lanes, no playhead glow,
and the playhead line only 30% grey. It must never be confused with track lines, so draw vertical marks only, never
horizontal strokes. In LOS, 0.125 s gaps mean 8 marks per second, about 50 px apart at this scale, which is fine.
**Prototype.** One draw function per frame: for each hit with |t − now| < window, x = playX + (t − now) × pxPerSec.

### C4. Sound Horizon: the spectrum becomes distant landscape
**What you see.** The spectrum stops being a chart and becomes a mountain range seen far behind the ride. In the
lower part (y about 1150–1600, above the UI), each spectrum frame is a filled silhouette, not a line. Successive
frames sit in 4–6 receding layers, each lighter and slightly higher, like Iris's flowing history. Its key property is
that **it scrolls horizontally with the rider at a parallax of about 0.06×**, so it moves like terrain at depth. The
nearest ridge is the current spectrum, and older ridges are further back. Palette: cool greys to a single pale cobalt,
with no rainbow.
**Why here.** It keeps what the owner liked (Iris's history, mirrored masses, Cobalt) but turns a static widget into
part of the world. Parallax gives the vertical frame depth and a sense of speed without anything anchored to the
foreground. Filled shapes with no stroke on top can't be confused with "lines the rider rides".
**Data.** `spectrum` frames (56 bands, 30 fps) and rider x-velocity for the scroll. Section air could lift or lower
the horizon.
**Risks.** It could drift into the "atmospheric colour field" the owner disliked if edges soften or alpha stacks
muddily. All edges must be crisp and the layers fully opaque, painter's order. A spectrum doesn't naturally tile
horizontally: lay out bands in screen x, then offset by scroll mod width with a mirrored seam, or build a
continuous ribbon from history (column per spectrum frame, i.e. a spectrogram skyline). The second option is
truer, so I'd test both.
**Prototype.** Offscreen canvas ring buffer. Each frame, push the current spectrum silhouette and draw layers with
fixed lightness steps.

### C5. Course Overture: open on the whole course, close on it too
**What you see.** Frame 0 is the entire course: all 20k × 9k units scaled to fit in about 900 px width (≈ 330 px tall),
pencil grey, centred, on white. The first about 0.6 s (before the first hit at 0.675 s on LOS) is a single fast
zoom/dolly into the rider, landing at ride framing exactly on hit 1. At the end (DECAY / ENDING / RELEASE, which
specify high air and low speed), the camera pulls back over the last about 2.5 s to the same whole-course view. Now
it is inked (C1), with each contact carrying a tiny source-coloured dot, so the final frame is the song drawn as a line.
That last frame is pixel-identical in framing to frame 0, so the Shorts auto-loop is seamless: pencil course, then
inked course, then pencil again.
**Why here.** It is the best thumbnail I can imagine for this project: a strange, beautiful continuous drawing that
makes people ask what it is. It gives the minute a beginning and end, which Shorts loop behaviour rewards. It also
shows the scale of the compiler's work, a minute of music as one object.
**Data.** Track bounds, `trace` for the dolly target, ink state, and the phase boundaries for the outro start.
**Risks.** At 900 px wide the course is a thin diagonal and might read as a squiggle. The aspect is roughly 2.3:1 and
the frame is 0.56:1, so most of the overview is white. Possible fix: a slight 15–20° rotation to put the descending
diagonal into the frame, but only on the overview, not during the ride. A 0.6 s zoom across about 100× scale is
violent, so it needs an exponential (log-scale) zoom curve to read as a smooth plunge. And the loop seam only works
if the platform loops cleanly (Shorts mostly does).
**Prototype.** The camera is a function of t: for t < t_hit1, interpolate log(scale) and centre from overview to ride
camera. The outro does the same in reverse.

### C6. Section Breath: the camera and the paper follow the spec's sections
**What you see.** Each spec section gets a *camera character*, not a colour scheme. ROLL / RAPID PICKUP (air about 0.25,
speed about 0.7) is close and low: rider at about 1/5 of width, framed in the lower-middle with a little headroom, so
you see the line it hugs. SUSPEND / QUIET / VOICE IN SPACE (air 0.7–0.85, speed 0.3–0.5) is wide: rider small (about
1/14 of width) with a huge white sky above. RETURN / FULL RETURN is mid. Transitions are 0.3–0.5 s eases timed to
start on the section's first hit. Optionally the background takes a barely-there cool cast per section (e.g. #FFFFFF,
#F6F8FC, #F2F5FB), switched as a hard cut on the downbeat and never a gradient.
**Why here.** The specs already author air and speed per section, so the camera can just *read the score*. The owner
said the music is structured; the visuals currently ignore that structure entirely. Silence feeling like space and
density feeling tight is the oldest trick in film editing, and here it's data-driven.
**Data.** `phases[].air, speed, t0` gives the target zoom = f(air, speed) and target vertical framing = f(air).
**Risks.** Zoom changes alter apparent speed (closer means faster screen motion, 3+ widths/s), so the tight shots
must still contain the next contact. Bound the zoom so look-ahead is at least 0.35 s of travel. Background tints are
risky given the owner's paper feedback, so default them OFF and offer them as a variant only.
**Prototype.** A smoothed target-scale function of the current phase, fed into the existing camera.

### C7. Two Shots: a split-screen "wide and close"
**What you see.** The frame is split by a single crisp hairline at y about 760. The top shot is a wide "map" camera:
about 8 s of course visible, rider a small black dot-and-sled, upcoming lines in pencil, already-ridden lines inked.
The bottom (y 760–1620) is the close camera on the rider at about 1/5 width. Both are the same ride at the same moment.
At big hits the hairline kicks by 4 px.
**Why here.** Vertical video is native to stacked framing, and this project has a unique problem: the close shot is too
fast to read (3 widths/s) and the wide shot is too small to feel. Stacking them solves both and fills the vertical
frame with *the ride itself*, not decoration. The top shot also does C3's job, showing what's coming, using the real
geometry instead of abstract marks.
**Data.** Trace (two cameras), track, contact ink.
**Risks.** It halves the "hero" area. Two moving images may tire viewers over 60 s. And split-screen can look like a
tutorial or a stream overlay. Kill it if the hairline layout reads as "UI". A borderless variant fades the top shot's
lines to pencil weight so it reads as a sky map rather than a second panel.
**Prototype.** Render the world twice with two transforms and clip rects. Probably the most work, because native
artwork has to be drawn twice.

### C8. Seismograph Ledger: the minute writes itself across the bottom
**What you see.** A single row just above the UI zone (y about 1560–1600): every hit drops in as a small solid
vertical tick at x = 40 + (t / duration) × 860, height ∝ strength, source colour for non-drums. There is no line, no
playhead and no number. By the end it's the full rhythmic fingerprint of the song, which matches the inked course in
C5's final frame.
**Why here.** It is a quiet, cumulative "progress" that shows structure: the dense ROLL, the empty SUSPEND gap and the
long RETURN become visible shapes. It also costs almost no attention.
**Data.** `hits`, `duration`.
**Risks.** It is close to the Shorts progress bar and could be read as one. It is close to the UI zone too. It
doubles with C3 if both are used. Honestly it's the weakest of the ones I'm keeping. Use it only as part of C5's
ending, or as a variant of C3.
**Prototype.** Ten lines of canvas.

### C9. Stroboscope Arc: show the air
**What you see.** While the rider is airborne for more than 0.25 s, its sled position is marked every 1/20 s with a
tiny hollow circle (3 px) along the flight arc. The marks vanish 0.35 s after landing, all at once with no fade-tail.
In long-air sections (SUSPEND, DECAY), the viewer sees the parabola, and its spacing shows the deceleration and drop.
**Why here.** The rider is airborne most of the time, and air is half of what the spec asks for. Today air is just the
rider floating in white. Making the trajectory visible shows that the airtime is *aimed*: it lands on a beat.
**Data.** Trace sled points, contact state (to detect airborne spans), and hit times.
**Risks.** Dots in a line read as a track (the owner's spectrum-line issue). Use hollow points, never connected, and
only in the past behind the rider. It's world-anchored, so at 3 widths/s it exits the frame fast. That limits it to
wide and slow sections, which is where it matters anyway. It could feel like a physics-class diagram, which I think is
charming but needs judging.
**Prototype.** Sample trace positions, draw circles via the world transform.

### C10. Mirrored Floor: the ride reflected (variant, not a lead)
**What you see.** A crisp horizontal "floor" line at y about 1180 (screen-fixed). Below it, the ride region is
mirrored vertically at 12% ink: rider and lines, sharp, no blur. When a line passes down through the floor it meets
its reflection. The spectrum, if kept, lives only in the reflection zone as mirrored pale bars.
**Why here.** The owner liked mirrored spectra and Graphite mirror. Mirroring the *ride* fills the lower half with the
actual subject.
**Risks.** The ride descends (9k units down), so the camera tracks downwards and the floor is meaningless physically.
Reflected lines are still lines, which is confusing. I rate it low. Listed as a variant because the owner's taste
suggests he might like it, but **I would not lead with it.**

### Rejected (and why)
- **Background colour per source or per section as the main idea.** It's another re-skin. The owner pushed back on
  every tinted paper.
- **Rotating the world so the descent runs down the vertical frame.** Gravity would look wrong and the rider would
  appear to slide sideways. Allowed only on the static overview (C5).
- **Trails or ghosts of the rider in the foreground.** At 3 widths/s they're off-screen instantly or smear into the
  persistent haze the owner disliked.
- **A spectrum drawn on the track (lines pulsing with music).** It directly conflicts with "the rider rides lines".
- **Particles or confetti at hits.** It's cheap, and dense at 2 hits/s.
- **Inset close-up of the next contact (picture-in-picture).** C7 does this better.

---

## 2. Top 3 and what I'd ship

1. **C1 Pencil and Ink.** It's the cleanest idea and the most specific to this project. It turns the clutter
   problem (half the lines are scaffolding) into the meaning (black = the music). It costs nothing between accents.
2. **C3 Score Rail.** It is the strongest answer to "make the sync legible to a first-time viewer". It uses the top
   space with ride-specific information.
3. **C5 Course Overture with loop.** It's the best thumbnail and the best first and last second. It gives a minute
   with shape and a seamless Shorts loop.

**The combination I'd ship:** C1 + C2 + C5 + C6 (camera only), with C4 as the bottom fill.
- **Look:** a white ground with pencil scaffold that inks black on contact. The bottom is a pale cobalt
  sound-horizon with parallax, kept low and quiet. No rainbow, no vignette, no persistent effects.
- **Hits:** contact stamps, with source colour only for non-drum sources. Approved's big flash and split are reserved
  for the 5–8 strongest hits.
- **Structure:** the camera breathes with the spec sections. It opens on the whole pencil course and dives to hit 1.
  It ends by pulling back to the inked course and loops.
- **Score Rail (C3)** is tested as a toggle on top of this. If it reads as a game HUD on a phone, drop it. If it
  reads as notation, keep it, because it's the biggest win for legibility. I'd rather know than guess.

## 3. Camera and cinematography

- **Frame the next contact, not the rider.** At about 410 u/s the composition should hold the rider *and* the
  segment it will hit next. Aim the camera at a point between the rider and its next contact, weighted by time to
  contact (e.g. 0.6 toward the contact when it's under 0.4 s away). In the vertical frame, place the rider in the
  upper-left third with lead room towards the lower right, because the course always descends to the right.
  Today's dead-centre framing wastes the down-right lead room and hides upcoming lines.
- **Shake is the wrong verb at 2 hits/s; use a "camera catch".** Instead of shaking the image at a strong hit, let the
  camera *lag* very slightly behind the rider (a critically damped follow with about 80 ms time constant). When the
  rider is jolted by a hit, the frame reacts a beat later with a small, settling overshoot, like a handheld operator
  catching the action. That is physical, never blurs, and is driven by the real trajectory change rather than an
  added effect. Keep the explicit shake for the top 5–8 hits only.
- **Zoom is the section's dynamics, scale is log-interpolated, and nothing else moves.** No rotation and no Dutch
  angles. Section-driven zoom (C6) should change slowly and settle before the section's dense part begins.
  Interpolating log(scale) is mandatory for any zoom over 2×, or it'll feel like it accelerates.

## 4. Presenting choices to a busy owner on a phone

- **One screen, one question, two options.** Show a full-height phone mock (with the Shorts UI overlay painted on, so
  safe zones are judged honestly) playing a 4-second synchronised loop of option A, and tap anywhere to flip to B at
  the same timestamp. Under it put three buttons: "A", "B", "neither". Then go to the next question. Ask questions,
  not catalogues: "Pencil-then-ink, or all black?", "Score rail on or off?", "Stamp or flash at hits?". Ten binary
  questions take two minutes, and the answers combine into a configuration, whereas 34 treatments take an evening.
- **Always show the same three moments:** a quiet airborne moment, a dense hit cluster and the final frame. Each
  question picks the one moment where the difference actually shows. Static stills only for the opening/ending
  frames.
- **Optional voice-note button** per question (the owner thinks out loud; his feedback was spoken). Even just "record
  a remark tied to this question and timestamp" would capture far more than a form.

---

## After seeing the lab

Having now read `lab.js` and the stills in `shots/`: the lab independently landed on four of my concepts. Its
Song score matches C3, Skyline matches C4, Inking matches C1 and "sections" framing matches C6, and it already has
the lead-room camera. That is reassuring: these are the natural moves for this data. Here is what I'd change:

1. **Score strip: remove the connector polyline and the y = strength scatter.** In `petrunko-together-26.5` the
   strip reads as a thin coloured *line* in the sky, which is exactly the "rider rides lines" confusion the owner
   flagged. Use vertical ticks on one baseline (height = strength), with no connector. The phase-boundary hairlines
   are also lines, so drop them too: the gap in the marks already shows the section.
2. **Hit colours: drums should be ink, not red.** 67–82 of each song's hits are drums, so today almost every mark
   and stamp is red, and the colour tells the viewer nothing. Use ink for drums and colour only for vocals, bass and
   other. That way, colour itself becomes an event (LOS's 26 vocals would "speak").
3. **Marks: the big filled red ellipses must go.** They persist in the world forever, sit under the rider at the
   moment of contact (see `together-26.5`), and are ellipses, which the owner called cheap. Replace them with C2's
   tangent-aligned stamp, gone in about 100 ms. On the inked track a hit can stay as a slightly *thicker ink
   segment*, not a blob. That's persistent memory without decoration.
4. **Skyline: opaque, crisp and parallax.** The current layers are translucent rgba fills stacked at the bottom of a
   static frame. That edges towards the "atmospheric field" the owner disliked, and it takes the full bottom 36%,
   including the UI zone. Use fully opaque layers with fixed tone steps, keep the top ridge above y ≈ 1620, and
   scroll them sideways at about 0.06× rider velocity so they read as distant terrain.
5. **Chapters: the palette drifts warm and pastel** (#f8edf1, #e7f3ee). The owner rejected warm and tinted papers.
   Keep chapter changes to the *camera* (sections framing) and, at most, a white ↔ cool-grey step. I would not make
   "Together" depend on chapter paper.
6. **Pencil is too faint.** In the Inking stills the untouched lines nearly disappear on a phone-sized view. Raise
   the pencil to about #B8BEC8 at 1.5 px. Also, the wide framing makes the rider tiny. Inking should be tested on the
   *lead* framing too, not only on wide.
7. **What's missing entirely:** the opening and ending (C5's whole-course overture and outro, plus the seamless
   loop); camera lag/catch at hits instead of the push; and a two-level accent (only the top 5–8 hits get the big
   flash). I'd add `frame: 'overture'` (a log-zoom from bbox to the ride camera before hit 1, and back during the
   final phase) and `punch: 'catch'` (critically damped follow). Both fit the existing `framing()` and `camera()`.
8. **Review UX:** the lab is a strong engine but a preset list. On the phone I'd wrap it in the A/B-question flow
   from §4, reusing the `?m=` overrides as the two options per question.
