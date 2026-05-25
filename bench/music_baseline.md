# Music benchmark

Generated: 2026-05-25T07:10:47.225Z

Baseline strategy: `baseline_old` (current per-beat slide/catch + greedy).
This is the negative anchor — new strategies must beat it on coolScore.

## drums_0_30s_60_125

_63 onsets / 30s (the canonical evaluation file)_

### Cool-axis metrics

| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |
|---|---|---|---|---|---|---|---|---|---|
| compose_precise_landings_variety | ✓ | 1682 | 6.7 | 0.15 | 2074 | 8 | 2.17 | 63% | 6278 |

### Music-sync metrics (landings + bounces, kicks excluded)

On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).

| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| compose_precise_landings_variety | 106 | 19.0 | 30.2 | 54.0 | 68.3 | 5.0 | 7.0 | 15.0 | 20.0 |

### Landing-only sync (strict — the visual punctuation)

Same beats, but only matched against `landing` events (excludes bounces).
A landing is the distinct impact moment; bounces are incidental brief airbornes.

| strategy | landings/beats | L ±1f | L ±2f | L ±5f | L median | L mean |
|---|---|---|---|---|---|---|
| compose_precise_landings_variety | 94% | 19.0 | 30.2 | 52.4 | 5.0 | 6.9 |
