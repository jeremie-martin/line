# Impact timing: what should land on the beat?

*Opened 8 November 2026, after the move to one renderer put picture and sound in sync for the first time. A note to explore
before deciding, not a plan to build. The owner's preference: "a simple, clean solution that's reasonable and gives good enough
results in the vast majority of cases, as opposed to a complete work stream", unless the measurements argue otherwise.*

## The question

The project began by making the rider land on the beat: a spec says when an impact should happen, and how strong. Since then
an impact stopped being one frame. Its strength is measured over several frames, so a hit has several candidate moments:

- **first touch:** the first frame the rider meets the line (`contactStart`);
- **onset:** where the strike's force first reaches half of its peak (`onset`). This is what the compiler aims at the requested
  frame, and what the hits' times are today;
- **peak:** the most forceful frame (`peakFrame`), arguably the most "impactful" moment.

Which of these should coincide with the sound? And with the picture's effects? The owner (8 Nov): "Do we want the rider to be
synchronized when technically there is the first frame where the rider touches the line, or the most impactful frame?" The −15 ms
jolt (`scripts/produce/jolt.ts`) was, in part, a way to play with this by ear. Until 8 November every finished video's sound was
42.7 ms late and its picture 16.7 ms late, so that choice was heard through a delay.

## What the rides do (measured 8 November)

Every answered hit of the saved rides; a physics frame is 25 ms.

| | 0 frames | 1 | 2 | 3 | 4+ |
|---|---|---|---|---|---|
| Onset after first touch (lab rides, current compiler, 876 hits) | 18 % | 74 % | 7 % | 1 % | – |
| Peak after first touch (same) | 10 % | 51 % | 27 % | 8 % | 4 % |
| Peak after first touch, strong hits (strength ≥ 0.6) | 7 % | 49 % | 34 % | 8 % | 2 % |
| Onset on the requested frame | | 92 % (± 1 frame: 8 %) | | | |

All 194 saved records (19,968 hits) give the same shape. So the peak is typically 25–50 ms after first touch and varies hit by
hit, while the onset is nearly always one frame after it.

With today's jolt, the authored times sit about 10 ms after the sound's audible rise. The compiler aims the onset at authored
time + 15 ms, so **first touch lands on the sound's rise, and the peak typically comes 25–50 ms later.** The picture's
effects (shake, split, flash) start at first touch.

## Where the sound's attack sits (measured 8 November)

Time-locked averages of the sound around every answered hit of strength ≥ 0.4 on the current rides (`timing/attack.py`,
8 songs, 756 hits): where the beat's audible attack (half-rise of the 1 ms envelope) sits relative to each moment of the impact.

| Song | first touch | onset | strongest frame |
|---|---|---|---|
| Mean of 8 songs | −7.5 ms | −32 ms | −44 ms |
| Range | −40 to +7 | −64 to −19 | −65 to −30 |
| Circus Minimus | −40 ms | −64 ms | −65 ms |

**What the jolt has been doing.** Its +15 ms combines two unrelated facts: the onset comes about 25 ms (one physics frame) after
the touch, and the authored beat times sit about 10–17 ms after the sound's attack. 25 − 10 ≈ 15, so it puts the first touch on
the attack, but only where authored times run about 10 ms late. Circus Minimus breaks the assumption: its authored times (the
voice-drums spec) sit about 49 ms after the attack, so its touches land about 40 ms late today. **For the strongest frame on the
attack**, impacts would land about 44 ms earlier on average than today, and about 76 ms earlier on Circus Minimus.

## Three independent knobs

Since every frame is drawn at a song time, these no longer have to move together:

1. **The compiler's aim:** which moment of an impact it places on the beat, and the jolt. Changing it means recompiling, and it
   touches the search.
2. **The picture's anchor:** which moment the effects start from (first touch, onset or peak). Presentation only: no
   recompiling.
3. **The audio offset:** shifting the whole recording against the picture by a fixed amount. The music's speed is untouchable,
   but a constant offset is free, also with no recompiling.

Knobs 2 and 3 can be explored by ear on the rides we already have, in an afternoon. Only if a clear winner emerges does the question
move to knob 1, to put the chosen alignment where it belongs, by design rather than as an offset added downstream.

## Options, simplest first

- **Disable the jolt.** The compiler aims the onset at the authored time; nothing else moves.
- **One fixed offset that minimises the error on average.** For example, put the typical peak on the beat instead of the touch:
  about +1 to +1.5 physics frames, 25–40 ms.
- **Effects at the peak.** The rider's touch stays where the compiler put it; the flash and split start at each hit's own measured
  peak. Each hit adapts, with no compiler change.
- **The compiler aims the peak.** The search would prefer impacts whose measured peak, not their onset, falls on the beat. This
  is the principled version, and the heaviest: it changes what the search optimises, needs the usual paired comparisons, and the
  peak is less predictable than the onset.

## Direction (owner, 8 November)

Decide analytically, not by a sweep: shift the music (and with it the rider's aim) so that, on average, the beat falls on the most
forceful frame, with the offset derived from the measured distribution above, possibly per song or per ride. Everything defined,
and the reason known. Still open: whether the effects follow each hit's own peak or the beat.

## Earlier proposal (kept for reference): exploration by ear

Same rides, same songs, picture and sound now in sync. Vary one knob at a time:

- **audio offset:** −25, 0, +25, +50 ms against today;
- **effects anchor:** first touch, then peak.

Ask: which feels like the hit *is* the beat? Then decide between "disable", "one offset" and "effects at the peak", and only then
whether the compiler's aim should change. Whatever wins is defined once, in one place, and saved with the ride: never an
offset patched in downstream.
