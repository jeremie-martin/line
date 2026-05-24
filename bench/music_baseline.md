# Music benchmark

Generated: 2026-05-24T11:53:06.829Z

Baseline strategy: `baseline_old` (current per-beat slide/catch + greedy).
This is the negative anchor — new strategies must beat it on coolScore.

## drums_0_30s_60_125

_63 onsets / 30s (the canonical evaluation file)_

### Cool-axis metrics

| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |
|---|---|---|---|---|---|---|---|---|---|
| baseline_frozen | ✓ | 885 | 5.5 | 0.10 | 1452 | 0 | 1.48 | 27% | 0 |
| baseline_old | ✓ | 2062 | 9.2 | 0.91 | 441 | 26 | 2.33 | 26% | 22397 |
| compose_swooping | ✓ | 1167 | 10.4 | 0.76 | 400 | 8 | 0.47 | 34% | 0 |
| compose_staccato | ✓ | 1148 | 9.8 | 0.31 | 413 | 10 | 1.03 | 23% | 0 |
| compose_aerial | ✓ | 0 | 26.9 | 1.40 | 431 | 12 | 1.30 | 2% | 0 |
| compose_swooping_fit | ✓ | 1672 | 10.3 | 0.76 | 400 | 18 | 1.47 | 51% | 277 |
| compose_staccato_fit | ✓ | 2083 | 9.7 | 0.35 | 413 | 28 | 1.33 | 26% | 443 |
| compose_aerial_fit | ✗ | 0 | 32.5 | 1.51 | 431 | 0 | 1.61 | 25% | 286 |
| compose_slide_chain | ✗ | 0 | 5.8 | 0.00 | 2375 | 0 | 1.82 | 55% | 8670 |
| compose_drop_search | ✓ | 12811 | 9.4 | 0.53 | 35917 | 0 | 1.76 | 82% | 20938 |
| compose_drop_brake_search | ✓ | 2169 | 9.7 | 0.43 | 4512 | 0 | 1.89 | 55% | 10247 |
| compose_drop_iter_search | ✓ | 11728 | 10.6 | 0.79 | 32440 | 0 | 1.64 | 83% | 76463 |
| compose_drop_brake_iter_search | ✓ | 2157 | 9.9 | 0.45 | 4465 | 0 | 2.02 | 57% | 29606 |
| compose_arc_descend_climb | ✓ | 2725 | 15.5 | 1.27 | 2821 | 16 | 2.23 | 56% | 19244 |
| compose_arc_dunes | ✓ | 2736 | 15.5 | 1.23 | 1925 | 22 | 2.64 | 53% | 7048 |
| compose_arc_swooping_peak | ✓ | 2770 | 15.3 | 1.15 | 4122 | 8 | 1.95 | 64% | 143174 |

### Music-sync metrics

On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).

| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| baseline_frozen | 75 | 6.3 | 33.3 | 47.6 | 65.1 | 6.0 | 7.3 | 17.0 | 19.0 |
| baseline_old | 117 | 9.5 | 23.8 | 50.8 | 77.8 | 5.0 | 6.2 | 12.0 | 19.0 |
| compose_swooping | 22 | 3.2 | 7.9 | 11.1 | 22.2 | 8.0 | 8.5 | 17.0 | 19.0 |
| compose_staccato | 49 | 11.1 | 14.3 | 27.0 | 46.0 | 7.0 | 7.2 | 13.0 | 19.0 |
| compose_aerial | 62 | 4.8 | 4.8 | 9.5 | 27.0 | 8.0 | 7.8 | 13.0 | 17.0 |
| compose_swooping_fit | 70 | 20.6 | 25.4 | 34.9 | 57.1 | 6.0 | 6.6 | 15.0 | 20.0 |
| compose_staccato_fit | 63 | 15.9 | 30.2 | 36.5 | 52.4 | 7.0 | 7.0 | 16.0 | 20.0 |
| compose_aerial_fit | 8 | 4.8 | 6.3 | 7.9 | 7.9 | 2.0 | 6.6 | 20.0 | 20.0 |
| compose_slide_chain | 71 | 11.1 | 20.6 | 34.9 | 65.1 | 6.0 | 6.5 | 12.0 | 19.0 |
| compose_drop_search | 89 | 79.4 | 79.4 | 79.4 | 79.4 | 1.0 | 3.7 | 14.0 | 20.0 |
| compose_drop_brake_search | 95 | 34.9 | 58.7 | 68.3 | 73.0 | 2.0 | 5.8 | 18.0 | 19.0 |
| compose_drop_iter_search | 83 | 68.3 | 73.0 | 73.0 | 73.0 | 1.0 | 4.2 | 18.0 | 20.0 |
| compose_drop_brake_iter_search | 102 | 54.0 | 60.3 | 74.6 | 76.2 | 1.0 | 4.6 | 18.0 | 19.0 |
| compose_arc_descend_climb | 113 | 41.3 | 60.3 | 73.0 | 76.2 | 2.0 | 5.1 | 16.0 | 19.0 |
| compose_arc_dunes | 133 | 34.9 | 60.3 | 76.2 | 76.2 | 2.0 | 5.1 | 17.0 | 19.0 |
| compose_arc_swooping_peak | 98 | 34.9 | 57.1 | 76.2 | 81.0 | 2.0 | 4.6 | 15.0 | 20.0 |
