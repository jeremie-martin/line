# Music benchmark

Generated: 2026-05-24T13:48:00.863Z

Baseline strategy: `baseline_old` (current per-beat slide/catch + greedy).
This is the negative anchor — new strategies must beat it on coolScore.

## drums_0_30s_60_125

_63 onsets / 30s (the canonical evaluation file)_

### Cool-axis metrics

| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |
|---|---|---|---|---|---|---|---|---|---|
| compose_arc_descend_climb | ✓ | 2725 | 15.5 | 1.27 | 2821 | 16 | 2.23 | 56% | 20840 |

### Music-sync metrics (landings + bounces, kicks excluded)

On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).

| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| compose_arc_descend_climb | 110 | 34.9 | 52.4 | 65.1 | 66.7 | 2.0 | 6.6 | 18.0 | 20.0 |

### Landing-only sync (strict — the visual punctuation)

Same beats, but only matched against `landing` events (excludes bounces).
A landing is the distinct impact moment; bounces are incidental brief airbornes.

| strategy | landings/beats | L ±1f | L ±2f | L ±5f | L median | L mean |
|---|---|---|---|---|---|---|
| compose_arc_descend_climb | 92% | 31.7 | 49.2 | 60.3 | 2.0 | 6.7 |
