# Music benchmark

Generated: 2026-05-24T13:25:45.929Z

Baseline strategy: `baseline_old` (current per-beat slide/catch + greedy).
This is the negative anchor — new strategies must beat it on coolScore.

## drums_0_30s_60_125

_63 onsets / 30s (the canonical evaluation file)_

### Cool-axis metrics

| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |
|---|---|---|---|---|---|---|---|---|---|
| compose_drop_iter_search | ✓ | 10987 | 10.9 | 0.76 | 32199 | 0 | 1.57 | 84% | 206862 |

### Music-sync metrics (landings + bounces, kicks excluded)

On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).

| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| compose_drop_iter_search | 76 | 60.3 | 65.1 | 65.1 | 65.1 | 1.0 | 4.7 | 18.0 | 20.0 |

### Landing-only sync (strict — the visual punctuation)

Same beats, but only matched against `landing` events (excludes bounces).
A landing is the distinct impact moment; bounces are incidental brief airbornes.

| strategy | landings/beats | L ±1f | L ±2f | L ±5f | L median | L mean |
|---|---|---|---|---|---|---|
| compose_drop_iter_search | 84% | 60.3 | 65.1 | 65.1 | 1.0 | 4.7 |
