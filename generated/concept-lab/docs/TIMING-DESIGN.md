# Timing: how a ride meets its song

*8 November 2026. The agreed design, as implemented: stages 1 to 3 are done (round 23 chose how hits are timed), stage 4 is
not. Reviewed as a proposal through three rounds (an independent analysis, adversarial reviews, a from-scratch design study by
Codex), and as code by a step-back review (Codex and an independent agent), whose findings are applied. Measurements:
`IMPACT-TIMING.md`.*

## Goal

The simplest system in which every timing relation is defined once, intentionally, and identical in every consumer by
construction. The spec is authoritative: an authored contact time marks the real musical moment. On average, an impact's
strongest frame meets that moment. Presentation owns the alignment; the compiler aims at what the spec says.

## Definitions

- **Song time `s`**: seconds from the recording's first decoded sample: the audio, the spectrum band, the sections, the drop.
- **Ride time `r`**: seconds of the compiled ride; physics frame `f` is `r = f / 40`.
- **Beats `b`**: each target's authored time in seconds, exactly as the spec gives it, before any shift, perturbation or
  rounding.
- **A hit**: a measured event of the saved impact account (`scripts/lib/strike_impact.ts`) that answered a target. It
  **happens at its strongest frame** (`peak`, the event's `peakFrame`: maximum contact acceleration; round 23); its direction is
  the line struck at its `onset` (half-rise), where the strike begins; its size is its measured strength. Physics frames.
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
| every hit and what it triggers: colour split, colour boost, shake (strong hits), the band's accent heat, each from the hit's strongest frame | the drop's ends snap to the strongest hit near each cue, and the opening ends on the first hit after 1.3 s: these convert each hit's strongest frame once, to `peak / 40 − offset` |
| the intensity metric: the ride's speed and each hit's strength at its strongest frame, read at `r` (so the paper's tint, the sun's size and the quiet zoom follow the ride) | |

**A hit happens at its strongest frame, everywhere** (owner, round 23: of today's timing, effects at the first touch, at the
strongest frame and on the beat, on aligned rides, "C is the best… clearly"). On an aligned ride that is on its beat on
average, within about a frame. There is no option: one rule for every ride, aligned or as compiled. `scene.ts` checks, once,
that matched hits' strongest frames follow their targets' order (the picture scans them so).

## The scene: the single source

Built once by `scene.ts` from a saved ride record (a bare track only when no record exists):

- `offset`, `aligned`, and the reason when not;
- the song span, and the song: a saved ride's own (its case's song, recording, duration and sections), a bare track's named;
- the account projected, in physics frames: every target (with its beat when recorded), every event (`onset`, `peak`,
  `strength`), and which event matched which target. Matched hits reference this projection; nothing is converted until the
  picture converts it, once.

It refuses, once, where it is built: a record of another song, hits out of order, and a ride that ends before the span it is shown
with (`rideTime(span end) ≤ track duration`). All 194 saved records on the owner's machine pass.

## Consumers

| Consumer | Reads |
|---|---|
| Picture (lab, films, videos) | the scene; one conversion per frame |
| Review player and impact panel | the scene: seek bounds from the song span; inspection at `r`; the ride's timing in words ("aligned, 29.7 ms"); beats at `b`, each realized hit at its strongest frame, mapped; the compiler's own measures (onset and strongest-frame offsets from the target frame, its error sums) from the saved record, labelled as the compiler's |
| Study clips | judge motion, not sync: bare tracks shown as compiled, on the compile timeline (frame `f` at `f / 40` s), so a judged moment is where its frame says; compare's before/after shares the passage's bounds and one soundtrack; beat marks are the song's authored beats from the spec the rides were compiled from (an eval cell's own spec, checked against its hash; the visibility study's spec.ts, which its observe step requires; otherwise the song's spec.ts) |
| Lab UI | the scene's song times |
| `npm run video`, study renders | records and sidecars carry the look, the offset and the alignment state; a saved video with another presentation is not reused: a fresh destination is required. The writer refuses a passage outside the song span |
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
   −7 ms (A), −31 to −41 ms (B), 0 ± 16–26 ms per hit (C) and 0 (D).
   **Done (8 November): C**, effects at the strongest frame. The option `effectsAt` and the comparison's as-compiled ride set
   are deleted: a hit happens at its strongest frame, for every ride (above). With that, everything a hit triggers moved onto
   the ride clock, the intensity metric reads the same moment, and the impact panel plots it. A step-back review then found
   and fixed: study clips had lost their beat marks (now the spec's authored beats again, an eval cell's own variant included), a crashed ride could
   not be opened (the replay required a trace past its end), sections came from the song's current authoring (now the record's
   own), the span was enforced by some callers only (now by the writer), a compare export of a perturbed cell failed (now
   through the evaluation's own case), and two compatibility paths. The cross-offset test now covers hit effects.
4. **Jolt 0** (compiler): the declared comparison; rides recompiled; offsets adapt by themselves (about 14 ms instead of 29).

## Out of scope

The distance between an authored time and the sound one hears (Circus Minimus's authored times sit about 49 ms after the sound's
rise): that belongs to authoring.
