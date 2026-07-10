# Benchmark V2 Prototype Cohort

Status: superseded prototype archive. These specifications are excluded from the
selected suite. They were written manually from
pooled reference principles; they do not copy a reference contact timeline or use
qualification compiler outcomes.

## Reference principles

- A local pulse is a backbone only while audible events support it.
- Voice or melodic onsets may carry quiet support before percussion enters.
- Measured or perceived attacks can replace nominal grid points.
- Omissions are intentional: breaths create room for a drop, re-entry, or arc.
- Subdivisions occur in bounded passages or short runs, not as indiscriminate
  density.
- Impact is authored per contact and can vary much faster than axis curves.
- Air and speed normally evolve smoothly over several seconds.
- Amplitude is reserved for real spacing; dense cadence keeps it low.
- Elevation and grain are absent from the production-distribution cohort.

## Initial matrix

| Candidate | Duration | Cadence construction | Distinct intent | Axes |
|---|---:|---|---|---|
| steady_reentry | 52s | ~560ms body, off-grid burst, 1.5s breath, omitted re-entry beat | dense groove with two meaningful landings | air, speed, impact |
| vocal_to_pulse | 50s | irregular 390-1280ms support, ~540ms body, off-grid breakdown | melodic lead-in becoming regular percussion | air, speed, impact |
| halfstep_hook | 54s | alternating ~880ms primary and ~440ms half-pulse passages | half/full-pulse density changes without extreme gaps | air, speed, amplitude, impact |
| syncopated_current | 56s | ~680ms backbone with isolated 280-340ms pickups and one bounded run | irregular salient attacks within a stable local pulse | air, speed, impact |
| breathing_grid | 66s | 600ms pulse, 1.2s omissions, five 1.8s breaths | long-form dense/sparse transitions with amplitude room | air, speed, amplitude, impact |
| sparse_arc | 58s | ~720ms pulse with 1.44s and 2.16s musical omissions | spacious production cadence and visible arcs | air, speed, amplitude, impact |
| microtimed_drive | 52s | ~520ms pulse with hand-authored +/-10-35ms timing and fills | played timing rather than a perfectly quantized grid | air, speed, impact |
| tempo_crossfade | 62s | 720ms -> 640ms -> 560ms -> 480ms -> 620ms local pulses | tempo-density change under continuous targets | air, speed, impact |
| low_air_runout | 58s | ~550ms groove with isolated 2.2s and 3.3s omissions | production-like low-air riding before the 5s capability boundary | air, speed, impact |
| amplitude_breaths | 64s | 500ms bed with selected 1.0-2.0s openings | amplitude intent tied to authored musical space | air, speed, amplitude, impact |

The matrix is a construction target, not automatic suite membership. Static
characterization and click-track review may collapse or revise candidates before
any compiler result is observed.

Render the authored rhythm and impact accents without compiling:

```bash
node --import tsx scripts/v0/benchmark_v2/render_clicks.ts
```

The WAV files are written to `generated/benchmark-v2/manual-clicks/`. Higher
impact contacts use a higher and louder click; the files contain no backing music.
