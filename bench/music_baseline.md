# Music benchmark

Generated: 2026-05-24T13:01:57.614Z

Baseline strategy: `baseline_old` (current per-beat slide/catch + greedy).
This is the negative anchor — new strategies must beat it on coolScore.

## drums_0_30s_60_125

_63 onsets / 30s (the canonical evaluation file)_

### Cool-axis metrics

| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |
|---|---|---|---|---|---|---|---|---|---|
| baseline_frozen | ✓ | 885 | 5.5 | 0.10 | 1452 | 0 | 1.48 | 27% | 0 |
| baseline_old | ✓ | 2062 | 9.2 | 0.91 | 441 | 26 | 2.33 | 26% | 22392 |
| compose_swooping | ✓ | 1167 | 10.4 | 0.76 | 400 | 8 | 0.47 | 34% | 0 |
| compose_staccato | ✓ | 1148 | 9.8 | 0.31 | 413 | 10 | 1.03 | 23% | 0 |
| compose_aerial | ✓ | 0 | 26.9 | 1.40 | 431 | 12 | 1.30 | 2% | 0 |
| compose_swooping_fit | ✓ | 1672 | 10.3 | 0.76 | 400 | 18 | 1.47 | 51% | 290 |
| compose_staccato_fit | ✓ | 2083 | 9.7 | 0.35 | 413 | 28 | 1.33 | 26% | 284 |
| compose_aerial_fit | ✗ | 0 | 32.5 | 1.51 | 431 | 0 | 1.61 | 25% | 309 |
| compose_slide_chain | ✗ | 0 | 5.8 | 0.00 | 2375 | 0 | 1.82 | 55% | 8975 |
| compose_drop_search | ✓ | 12811 | 9.4 | 0.53 | 35917 | 0 | 1.76 | 82% | 21115 |
| compose_drop_brake_search | ✓ | 2169 | 9.7 | 0.43 | 4512 | 0 | 1.89 | 55% | 10279 |
| compose_drop_iter_search | ✓ | 10987 | 10.9 | 0.76 | 32199 | 0 | 1.57 | 84% | 181532 |
| compose_drop_brake_iter_search | ✓ | 2271 | 10.0 | 0.47 | 4794 | 0 | 1.86 | 59% | 23044 |
| compose_arc_descend_climb | ✓ | 2725 | 15.5 | 1.27 | 2821 | 16 | 2.23 | 56% | 18791 |
| compose_arc_dunes | ✓ | 2736 | 15.5 | 1.23 | 1925 | 22 | 2.64 | 53% | 6908 |
| compose_arc_swooping_peak | ✓ | 2770 | 15.3 | 1.15 | 4122 | 8 | 1.95 | 64% | 141841 |

### Music-sync metrics (landings + bounces, kicks excluded)

On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).

| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| baseline_frozen | 73 | 4.8 | 28.6 | 41.3 | 57.1 | 6.0 | 8.1 | 17.0 | 18.0 |
| baseline_old | 116 | 7.9 | 22.2 | 42.9 | 66.7 | 7.0 | 7.7 | 17.0 | 20.0 |
| compose_swooping | 21 | 1.6 | 6.3 | 9.5 | 20.6 | 8.0 | 9.0 | 17.0 | 19.0 |
| compose_staccato | 48 | 9.5 | 12.7 | 25.4 | 41.3 | 8.0 | 8.0 | 16.0 | 19.0 |
| compose_aerial | 10 | 1.6 | 1.6 | 4.8 | 9.5 | 9.0 | 8.8 | 15.0 | 15.0 |
| compose_swooping_fit | 68 | 14.3 | 14.3 | 20.6 | 42.9 | 9.0 | 9.5 | 19.0 | 20.0 |
| compose_staccato_fit | 56 | 12.7 | 22.2 | 30.2 | 47.6 | 8.0 | 8.1 | 18.0 | 20.0 |
| compose_aerial_fit | 6 | 1.6 | 3.2 | 4.8 | 4.8 | 15.0 | 11.0 | 20.0 | 20.0 |
| compose_slide_chain | 68 | 7.9 | 17.5 | 31.7 | 61.9 | 6.0 | 7.1 | 13.0 | 20.0 |
| compose_drop_search | 86 | 76.2 | 76.2 | 76.2 | 76.2 | 1.0 | 4.1 | 18.0 | 20.0 |
| compose_drop_brake_search | 92 | 31.7 | 54.0 | 60.3 | 63.5 | 2.0 | 7.2 | 18.0 | 20.0 |
| compose_drop_iter_search | 76 | 60.3 | 65.1 | 65.1 | 65.1 | 1.0 | 4.7 | 18.0 | 20.0 |
| compose_drop_brake_iter_search | 90 | 49.2 | 54.0 | 60.3 | 61.9 | 1.0 | 7.0 | 19.0 | 20.0 |
| compose_arc_descend_climb | 110 | 34.9 | 52.4 | 65.1 | 66.7 | 2.0 | 6.6 | 18.0 | 20.0 |
| compose_arc_dunes | 129 | 27.0 | 47.6 | 61.9 | 61.9 | 3.0 | 7.3 | 19.0 | 20.0 |
| compose_arc_swooping_peak | 95 | 28.6 | 47.6 | 65.1 | 66.7 | 3.0 | 6.4 | 17.0 | 20.0 |

### Landing-only sync (strict — the visual punctuation)

Same beats, but only matched against `landing` events (excludes bounces).
A landing is the distinct impact moment; bounces are incidental brief airbornes.

| strategy | landings/beats | L ±1f | L ±2f | L ±5f | L median | L mean |
|---|---|---|---|---|---|---|
| baseline_frozen | 56% | 4.8 | 19.0 | 22.2 | 6.0 | 8.5 |
| baseline_old | 40% | 1.6 | 12.7 | 19.0 | 10.0 | 9.2 |
| compose_swooping | 24% | 1.6 | 3.2 | 4.8 | 8.0 | 9.7 |
| compose_staccato | 60% | 4.8 | 7.9 | 20.6 | 8.0 | 8.4 |
| compose_aerial | 3% | 0.0 | 0.0 | 1.6 | 15.0 | 9.5 |
| compose_swooping_fit | 68% | 12.7 | 12.7 | 15.9 | 9.0 | 9.8 |
| compose_staccato_fit | 59% | 9.5 | 19.0 | 25.4 | 8.0 | 8.0 |
| compose_aerial_fit | 6% | 0.0 | 1.6 | 3.2 | 15.0 | 9.5 |
| compose_slide_chain | 79% | 7.9 | 17.5 | 31.7 | 6.0 | 7.0 |
| compose_drop_search | 95% | 76.2 | 76.2 | 76.2 | 1.0 | 4.1 |
| compose_drop_brake_search | 90% | 31.7 | 49.2 | 55.6 | 2.0 | 7.3 |
| compose_drop_iter_search | 84% | 60.3 | 65.1 | 65.1 | 1.0 | 4.7 |
| compose_drop_brake_iter_search | 97% | 49.2 | 54.0 | 60.3 | 1.0 | 7.0 |
| compose_arc_descend_climb | 92% | 31.7 | 49.2 | 60.3 | 2.0 | 6.7 |
| compose_arc_dunes | 86% | 25.4 | 41.3 | 50.8 | 3.0 | 7.8 |
| compose_arc_swooping_peak | 97% | 28.6 | 47.6 | 65.1 | 3.0 | 6.4 |
