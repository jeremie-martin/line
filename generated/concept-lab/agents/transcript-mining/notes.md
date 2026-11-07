# Transcript mining: what the owner wants from post-processing (2026-11-03)

Source: `2026-11-02-style-post-processing-context.md`, from line 393 onward (the post-processing turns). Quotes are the owner's own words.

## 1. The intent behind the feedback

**1. Rest clean, hit bold, recover fast.** This is the main value, and most of the rejections follow from it. "For the most of the time, we have a clean, clear view, and this is very important to me." He accepts the approved look's "crazy RGB shift" *because* it only happens at impacts. "Clear" and "Responsive" lost because they made the energy smaller ("I kind of prefer the current … more visually engaging, with the split"). So he does not want restraint for its own sake. He wants contrast *in time*: a sharp resting state, accents that are allowed to be loud, and a full return to rest afterwards.

**2. Anything persistent that softens the geometry is a defect, even when it is called a style.** He rejected shadows, offset ink, haloes, "weird blur", the "green, bluish, super blurry spot", semi-transparent spectrum edges and banded vignettes, and described them all as "a bit blurry" or "not perfectly transparent". He tends to read a style choice as a rendering fault ("maybe it's just some encoding issue"). The lesson: if a style can be mistaken for a bug, it fails, however pretty the still looks.

**3. Contrast and near-black ink.** He asked for lines "ever so slightly blacker", said "if we could have it slightly more black and white", and liked that Arc light's lines are "a very clean white". Graphite won on "super clean, super sharp, super readable" even though he prefers light themes. He does not prefer dark themes. He prefers *contrast*, and the light themes so far lost contrast through tinted paper and coloured ink.

**4. Light, but not yellow.** "Light … more natural", "not necessarily white … brighter colors", "yellow/orange is not the only way". Tinted paper over the whole frame was "a bit too much" four times in a row. Colour works better as a *thing in the frame* than as the paper itself.

**5. Nothing should look like a line the rider could ride.** "The line rider rides lines." A continuous spectrum curve, connected polylines and dotted debris all compete with the track. The wider rule is that the track's visual language (thin dark strokes) belongs to the track alone. Music graphics have to differ from it in *kind*: masses, blocks, stems, mirrored fields. A different colour is not enough.

**6. Music graphics go behind and sit below.** "Use transparent stuff … put it behind and not above." He liked the full-width spectrum and did not want it shrunk to protect the edges, so the safe-zone caution is about what gets hidden, not about leaving space empty.

**7. Cheapness detector.** He called beat-pulsing ellipses "very cheap", the falling peak caps "messy", and bursts and stamps "cartoonish". He rejected the two-frame inversion. What these have in common is a generic, template effect with no tie to *this* ride's geometry or *this* song's choices. What survived (pencil→ink, the whole-course bookends, Iris history, the mirrored Graphite spectrum) is built from the ride's own data.

**8. Effects he cannot see are not restraint, they are waste.** "I'm not really seeing the kick and gentle roll", "I'm not really seeing this" (Suspension), and Catch was invisible to him. A subtle effect has to be legible in motion on a phone, or it should be removed.

**9. Honesty of motion.** This comes from round 1 more than the transcript, but it matches it: the camera must never make the rider appear to move in a way it does not. He also wants camera work done *natively* for quality ("this could be done directly in the video generation itself … let's not throw away the idea").

**10. Coherence with the native artwork.** The suspension spectrum's colours did not fit "a muted black and white … the scarf of the rider". The rider sprite sets the palette, and the overlays have to match it.

**11. Causes, not patches.** "It's not just technically add a layer of post-processing to technically address some feedback. It's to understand why we have this feedback."

**12. Several presets, and his feedback is a starting point, not a spec.** "We will probably have like different preset." "I would hate for you to kill your creativity just to technically satisfy my feedback."

### Tensions and how to reconcile them
- **Energy vs. clarity.** Separate them in time (point 1). An effect gets a budget of attack and decay, never a constant level.
- **Prefers light vs. finds dark cleanest.** Make light themes with dark-theme contrast: bright paper, true near-black ink, and colour kept to bounded shapes (point 3). Don't settle it by choosing between light and dark.
- **Hates blur vs. "if there's one that could actually convince me, [Aurora] could be it".** Softness is acceptable when it is *far behind and below*, never adjacent to geometry, and never over the rider's region. A soft field confined to the lower band with a hard top edge is worth one more try.
- **Wants many ideas vs. "we don't want to just try random stuff".** Each idea needs a reason drawn from the ride or the song (point 7), so the number of ideas is limited by meaning, not by effort.
- **Automatic vs. authored.** He praised hand-authored specs above everything else. Yet every post-processing round has been purely automatic (see section 2, items 1 and 2).

## 2. Buried or dropped ideas

1. **The specs' taste lessons were never applied to the visuals.** In this same session he praised the specs for their choices ("which instrument do we follow? … should we break some patterns?"), and Codex wrote that "consistency establishes a pattern; selectively breaking it creates a moment" and that "density and strength are separate choices". Every visual round since then has reacted *uniformly* to every hit. Nobody has asked which voice a section's visuals follow, where a visual pattern is set up, or where it is broken.
2. **Hand-authored effect cues.** "There's even an argument to be made that a part of the specification could be to play with some of these effects." It was deferred ("not already"), never returned to, and round 1 kept it open ("spec-authored camera hints not off the table").
3. **Modulation by realized telemetry.** "We can note down some ideas for later … the realized quantities of the actual track." Nothing was noted. Speed, airtime, height above the next line, g-load, rotation and contact duration are all available and unused.
4. **Doing camera work natively.** The point was quality for zoom and shake, not speed. It was shelved "for later" and only became real by accident in the canvas lab. It must survive the port back to production.
5. **Layout as a design variable.** "Maybe trying to play a little bit with the position of the different elements." Only the spectrum's height was ever varied.
6. **The bottom fade and framing trade-off.** Codex left it as "improving it properly means revisiting framing" and stopped there.
7. **A good vignette.** He asked for "a cool vignette … that looks cool in vertical", faint at the bottom and "ever so slightly super faint at the top", and static. The root cause of its banding (13 colour steps before encoding) was found but never fixed. It needs dithering or high-bit-depth gradients, not removal.
8. **Two-colour print, "a bit lighter and a bit more subtle".** He named a way to rescue it. It was dropped.
9. **"Light phenomenon … below and a bit longer."** He gave a concrete placement fix for a discreet spectrum. It was not tried.
10. **The "Premiere" prompt.** "What people use … when they want to do some cool effect." Editing grammar (cuts, framing changes, aspect changes, title design) was barely explored. Codex reskinned instead.
11. **Physical-phone verification.** It was flagged as "unverified" five times and never done.
12. **A probable cause of the "slightly blurry" feeling: 4:2:0 chroma.** H.264 and YouTube halve colour resolution, so thin *coloured* strokes (coloured ink, magenta lines, coloured spectrum hairlines) smear while black strokes stay sharp. This fits his "blurry" complaints landing on colour themes, and it fits his "blacker lines" request. **Design rule:** fine detail carries luminance, and colour sits only in shapes at least about 4 px wide. This is a cause in the sense of point 11. It would also explain why "approved" looks clearer.

## 3. New directions (none of these is in Codex's studies or the current lab)

**N1. A visual score: agent-authored cues per song.**
- *What.* A small `visual.ts` beside each spec: per section, choose the visual lead (which source's hits get accents; the rest get none), the accent family, band on or off, and a framing character. Breaks are marked explicitly ("from 31.2 s the pattern breaks: accents switch to voice for 4 bars").
- *Why.* It brings the one thing he has loved most, the authored choices, to the layer that currently has none. It also fixes "uniform reaction" at its cause.
- *How.* A JSON of section-keyed overrides that the lab's directors and accent bundles read. The spec already gives section times and hit sources. The vocabulary stays tiny, around 6 verbs.
- *Fails if* the choices can't be perceived in a 60 s Short, or if authoring it per song becomes a chore he has to review. Start with 3 songs and compare against the automatic version in the same player.

**N2. Subtractive arrangement: the band and the accents drop out.**
- *What.* In a sparse or suspended section, the lower band fades fully to nothing, accents stop, and only rider and ink remain. On the re-entry downbeat everything returns at once, so the return *is* the accent.
- *Why.* Arrangers make drops by removing parts first. Every current director adds; none takes away. It also gives "clean, clear view" a musical reason.
- *How.* A per-section gate (authored via N1, or a fallback when hit density is below a threshold) with a 0.4 s fade-out and a hard 1-frame return on the section's first hit.
- *Fails if* the frame looks broken or empty (the critic's empty-frame worry). Pair it with the closer framing so the rider fills the frame while the band is gone.

**N3. Locked-off shots: tripod grammar instead of a follow camera.**
- *What.* For chosen phrases, the camera stops following. A static frame is composed so that the whole phrase's path and every hit in it are in view, the rider crosses it, and there is a hard cut to the next locked frame just before the rider exits.
- *Why.* A static camera is the most honest camera there is: screen motion *is* rider motion, and speed reads truthfully. It is also the clearest way to show the geometry the music drew, which he loves in the bookends, and it is a real editing device rather than a filter.
- *How.* The future trace is known. For each phrase, fit a bounding box of the trace over the shot window (≥ 1.2 s), add margin and set zoom from it. Cut when the rider reaches 85 % of the frame, or on a downbeat. Use it only in 1–2 sections per song, as contrast with the follow camera.
- *Fails if* the rider is too small (at about 3 widths/s at close zoom, the frames must be wide), cuts come too often, or a cut lands off the beat. A cut must coincide with a hit or a section downbeat.

**N4. Landing shadow: the line under the rider knows it is coming.**
- *What.* While airborne, a short, crisp, flat sliver appears on the track segment directly beneath the rider, drawn *on the line* in luminance only and with no blur. It lengthens and darkens as the drop shortens, and it meets the sled at contact, exactly on the hit.
- *Why.* It makes anticipation and air readable and puts the synchronisation in the world, at the rider, instead of in a HUD. It is built from this ride's own geometry (point 7).
- *How.* Each frame, cast a ray from the sled straight down (or along the predicted trajectory, since the future trace is known and the real landing point is available) to the first segment. Draw a 2–3 px, darker-than-ink stroke along that segment, with length ∝ 1/height and opacity ramping over the last 0.4 s. Skip it when no line lies below.
- *Fails if* it reads as a second track line or a rendering glitch (point 2), or if it flickers over cluttered geometry. Test against pencil→ink, where it could read as "pre-ink".

**N5. A window that changes aspect: matte and letterbox as section dynamics.**
- *What.* The ride is shown through a crisp, slightly inset window: a page with a margin, with the music band living in the margin *outside* the window. Calm sections use a narrower window, like a letterbox. On the drop, the window snaps to full bleed.
- *Why.* Changing aspect is a classic editor's "this is the big part" move, and it does not move the rider (honest). It also solves "spectrum overlaps the track" structurally rather than by restyling, and it gives "positions of elements" (item 5) a real design.
- *How.* Clip the native render to a rect, with a rounded corner radius of about 0 or 12 px and a hairline edge. The band is drawn in the margin. The rect animates over about 6 frames on a downbeat, or cuts in 1.
- *Fails if* it looks like a template or a phone frame, shrinks the hero area, or makes the frame emptier. The margins must be filled by the music band, not left as dead paper.

**N6. Route-map bookends: the overview as an annotated map.**
- *What.* The whole-course opening and ending he loved, upgraded. The course is drawn as a route on a map, with section names set as small engraved labels along the line where each section begins, plus a title cartouche. At the end, the fully inked course with its labels holds for 1 s as the final frame, and it doubles as the Short's thumbnail.
- *Why.* It extends the two most-loved features, and it makes the song's structure, which the specs carefully author, visible once, at the two moments when there is time to read.
- *How.* Section start time → trace position → label anchor, with a tick perpendicular to the track. Labels sit on the side away from the curvature, with collision avoidance. Use one typeface and keep it small.
- *Fails if* the labels clutter a 330 px tall course, if text reads as cheap, or if it hurts the first second (keep the opening label-free and put the labels only in the ending).

**N7. One red: monochrome plus the rider's scarf.**
- *What.* Bright neutral paper, true near-black ink and a grey music band. The only colour in the frame is the scarf's red, used sparingly in bounded shapes: the band's lead mass, and accents on the strongest hits or the visual lead's hits from N1.
- *Why.* It matches the native artwork (point 10), gives light-theme contrast (point 3), avoids yellow, and avoids the chroma blur (item 12). One accent colour also makes "strong" legible without thresholds.
- *How.* Sample the sprite's scarf hue. Red appears only in shapes at least 4 px wide, and the paper uses dithered flat colour.
- *Fails if* 60 s of grey feels dull, or red reads as an error. Test it on the quiet Lua passage, not just the drop.

### Deliberately not proposed
- **Slow motion, stutter edits and freeze frames.** They break sync or misrepresent motion.
- **Depth of field, motion blur and glow.** All blur.
- **Animated vignettes.** He already said this ("a bit clunky").
