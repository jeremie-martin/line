# Timing: how a ride meets its song (design proposal, v3)

*8 November 2026. Agreed design; stages 1 and 2 are implemented, stage 3 is with the owner (round 23), stage 4 is not. It settles what the system is and why; details are settled
while coding, and the finished code is reviewed against it. Reviewed through three rounds (an independent analysis, adversarial
reviews and a from-scratch design study by Codex); the last round found the design sound, with one ordering fix, applied.
Measurements: `IMPACT-TIMING.md`.*

## Goal

The simplest system in which every timing relation is defined once, intentionally, and identical in every consumer by
construction. The spec is authoritative: an authored contact time marks the real musical moment. On average, an impact's
strongest frame meets that moment. Presentation owns the alignment; the compiler aims at what the spec says.

## Definitions

- **Song time `s`**: seconds from the recording's first decoded sample: the audio, the spectrum band, the sections, the drop.
- **Ride time `r`**: seconds of the compiled ride; physics frame `f` is `r = f / 40`.
- **Beats `b`**: each target's authored time in seconds, exactly as the spec gives it, before any shift, perturbation or
  rounding.
- **A hit's moments**: the saved impact account's events (`scripts/lib/strike_impact.ts`). `touch` is the event's
  `contactStart`: the frame its strike starts, which for a renewed strike inside continuous contact is not a new touchdown.
  `peak` is `peakFrame`, the frame of maximum contact acceleration. Both are physics frames.
- **The song span**: `[0, spec duration]`, the duration the spec authors (the record's `case.durationFrames / 40`). A compiled
  ride runs 20 physics frames (0.5 s) past it, so it covers the span for any offset in `[0, 0.5 s]`. A bare track (no spec) has
  the span `[0, track duration]`.

## The one relation

> **r = s + offset**

`offset` (seconds; positive: the ride is shown that much early) belongs to the scene. The relation and its inverse live in one
module shared by Node and the browser (`scripts/video/timing.js`); nothing else converts between the clocks.

## The offset

> offset = mean over the ride's matched hits of (peak / 40 − b)

Equal weight per hit (this is exactly "on average"); no audio analysis, weighting, outlier removal or rematching. Each ride's
average is known to about ±2 ms; rides differ by up to about 9 ms, hence per ride.

**One honest rule.** A ride is *aligned* when its record has beats, it has at least one matched hit, and the offset falls in
`[0, 0.5 s]`: its offset comes from its own hits, automatically, every time it is drawn. Incomplete rides align from what they
matched. Anything else is *as compiled*: offset 0, shown exactly as compiled, with the reason saved in the scene (no beats, no
matched hit, offset out of range). Nothing is ever tuned by hand.

## Who reads which clock

| Ride time (`r = s + offset`) | Song time (`s`) |
|---|---|
| rider pose, camera, line inking, contacts | audio, spectrum band, sections, the drop's cue, the title, the sun's position, the opening and the ending (they read the song span) |
| the intensity metric: built from the ride's speed and each matched hit's `touch` frame, read at `r` (so the paper's tint, the sun's size and the quiet zoom follow the ride); independent of any look | everything a hit triggers: shake, colour split, flash, the band's accent heat, the drop's snap to a hit, the opening's end, each from the hit's **effect time** |

**Effect time** = the look option `effectsAt`: `touch` or `peak` (mapped `f / 40 − offset`), or `beat` (`b`). One selector,
shared by every hit-triggered item. `beat` requires beats: on an as-compiled scene without them, choosing it is an error, never a
fallback. Effect times must be non-decreasing (asserted; the picture scans hits in order). The direction of a hit's effects stays
a property of the geometry. v1 keeps `touch`.

## The scene: the single source

Built once by `scene.ts` from a saved ride record (a bare track only when no record exists):

- `offset`, `aligned`, and the reason when not;
- the song span;
- the account projected, in physics frames: every target (with its beat when recorded), every event (`touch`, `onset`, `peak`,
  `strength`), and which event matched which target. Matched hits reference this projection; nothing is converted until the
  picture converts it, once.

## Consumers

| Consumer | Reads |
|---|---|
| Picture (lab, films, videos) | the scene; one conversion per frame |
| Review player and impact panel | the scene: seek bounds from the song span; inspection at `r`; beats at `b`, events mapped; the compiler's own residuals shown separately, labelled as compiler diagnostics |
| Study clips | each clip is centred on the judged moment's ride frame mapped to song time (so non-hit moments work too); simultaneous comparisons (compare's before/after) share common song-time bounds and one soundtrack, each side with its own offset; beat marks come from the scene's beats; a study declares one state and its builder refuses keys that mix aligned and as-compiled rides |
| Lab UI | the scene's song times |
| `npm run video`, study renders | records and sidecars carry the look, the offset and the alignment state; a saved video with another presentation is not reused: a fresh destination is required |
| Spec dashboard | unchanged: authored times on the audio (song time) |

## What the compiler records

In `loadMusicSpec`, and only there: the authored contacts must be strictly increasing (an unsorted spec is rejected, not
sorted), so index *i* is the same target before and after any shift. `beats = contacts.map(c => c.t)` before the jolt; asserted
`beats.length === targets.length`. Saved in the ride record beside `impactEvaluation`, never inside the impact ruler's objects
or any identity-bearing input (evaluation case identities are unchanged). A perturbed evaluation cell keeps the unperturbed
beats: perturbation tests robustness, the musical moment does not move. Records saved before have no beats: as compiled, until
recompiled.

## The jolt

It shifts every authored contact time before compiling: targets, scoring and the contacts' relation to the other authored curves
all move (per hit, 0 or +25 ms after rounding). With the offset derived from each ride, presentation no longer depends on it.

- **Jolt 0**, code kept: in the same change, the early-contact check moves to spec validation (a jolt of 0 already skips
  today's silent clamp), from the compiler's actual earliest catchable contact. A declared comparison: a named compare mode with
  two resolved input identities differing only in the jolt, the V7.1 panel, completion and every ruler reported, and acceptance
  bounds agreed beforehand.
- **Later:** remove the jolt, and the spec type's unused `music.offset` (read only by the spec dashboard, set by no spec).

## Stages and proofs

1. **Processing, offset 0** (`visual-lab`): `timing.js`; the scene's span, account projection and alignment fields; the
   picture on two clocks; every consumer through the scene; `effectsAt`.
   Proof: unit tests of the relation (inverse, sign); one cross-consumer test with a synthetic nonzero offset, both signs (the
   picture, inspection, seek bounds, clip bounds and export all show physics frame `f` at song time `f / 40 − offset`); the lab
   fingerprint byte-identical except around the few hits whose `touch` differs from the picture's old first-touch search (that
   also moves the intensity metric over a few seconds around them; each shown).
   **Done (8 November):** the cross-offset test writes the same frames for offsets 0, +0.1 and −0.1 s from the matching song
   times; the lab fingerprint is byte-identical on all 116 frames; `touch` differs from the old search on 2 of 876 hits (Batidão
   48.425 → 48.475 s, Coma 52.025 → 52.075 s: renewed strikes inside contact, whose effects now start 50 ms later).
2. **Beats recorded** (compiler only, on `visual-lab` like the rest; merged into foundations later): additive. Proof: parity unchanged; on
   saved rides, beats equal the spec at its recorded hash (a test oracle, not a runtime path). The lab's rides are left as they
   are, so none of them is aligned yet.
   **Done (8 November):** `authoredBeats` in `music_artifacts.ts`; `saveMusicCell` records `beats` beside `impactEvaluation` and
   checks one per target. Parity and judge parity unchanged. A test runs every spec and variant (85): beats are the spec's own
   times, the same at any jolt, and target i of the compiled case is contact i shifted. The smoke check's ride records them.
   All 8 lab rides, recompiled into scratch at the same jolt, have identical tracks and records but for `beats`, and are aligned:
   offsets 24.3 to 33.4 ms. Every ride compiled from now on records beats, so it is aligned wherever it is drawn (the review
   player, `npm run video`); saved rides and studies (bare tracks) are not.
3. **Alignment together with the effects round**: turning the offset on while effects stay at `touch` puts the flash and split
   31 to 41 ms ahead of the authored beat on the 8 lab rides (each ride's mean touch-to-peak gap), and about 20 ms ahead of the
   sound's attack (which sits 7.5 ms before the touch at offset 0; the offsets average 29 ms), so the offset and the effect
   anchor are decided in the same round, by eye, on whole films.
   The round begins by recompiling the lab's rides at the same jolt: identical tracks, now with beats, so aligned. The lab
   shows each ride both ways, the saved one (as compiled, as the owner knows it) and the recompiled one: the same ride, only the
   timing differs. (The no-mixing rule is for blind studies, not for this deliberate comparison.)
   **Begun (8 November):** the lab's rides are the recompiled ones (aligned, 24.3 to 33.4 ms); the as-compiled set is the same
   rides with their beats withheld, byte-identical to the lab before (all 8 scenes, all 116 fingerprint frames). A lab option can
   name its ride set, so the four timings switch in place: A as compiled at touch, then aligned at touch, at the strongest frame,
   on the beat. Round 23 asks it on whole films of three songs and in the lab. Relative to the beat, the effects sit at about
   −7 ms (A), −31 to −41 ms (B), 0 ± 16–26 ms per hit (C) and 0 (D). The owner's answer sets `effectsAt` in v1.
4. **Jolt 0** (compiler): the declared comparison; rides recompiled; offsets adapt by themselves (about 14 ms instead of 29).

## Out of scope

The distance between an authored time and the sound one hears (Circus Minimus's authored times sit about 49 ms after the sound's
rise): that belongs to authoring.
