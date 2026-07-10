# Benchmark V2 Seed Allocation Study

The reference contains 12 seeds at each of 3 budgets. Reference headline: **450.84**; valid 1358/1512.

Schedule trials allocate disjoint actual seeds to budgets, matching the canonical seed policy.

| Profile | Seeds / budget | Compiles | Headline abs. error p50 / p95 / max | Valid-rate abs. error p95 | Worst stratum p95 |
|---|---:|---:|---:|---:|---:|
| probe | 1 | 84 | 5.16 / 20.87 / 23.05 | 1.2pp | 102.25 |
| probe | 2 | 168 | 2.74 / 9.10 / 21.98 | 1.2pp | 17.52 |
| probe | 3 | 252 | 1.58 / 7.38 / 12.97 | 0.8pp | 14.74 |
| probe | 4 | 336 | 1.36 / 5.64 / 10.61 | 0.9pp | 16.74 |
| probe | 5 | 420 | 1.10 / 3.78 / 8.86 | 0.7pp | 10.53 |
| probe | 6 | 504 | 0.89 / 3.10 / 6.71 | 0.6pp | 9.77 |
| canonical | 1 | 126 | 6.51 / 17.85 / 27.44 | 1.7pp | 97.15 |
| canonical | 2 | 252 | 3.60 / 11.74 / 21.91 | 1.5pp | 67.11 |
| canonical | 3 | 378 | 2.13 / 7.88 / 16.79 | 0.9pp | 42.76 |
| canonical | 4 | 504 | 1.62 / 6.07 / 11.82 | 0.9pp | 33.57 |

## Per-budget subset error

| Budget | Seeds | Subsets | Score abs. error p50 / p95 / max |
|---:|---:|---:|---:|
| 250k | 1 | 12 | 17.02 / 23.84 / 24.19 |
| 250k | 2 | 66 | 4.54 / 22.45 / 23.79 |
| 250k | 3 | 220 | 3.69 / 21.09 / 23.09 |
| 250k | 4 | 495 | 3.95 / 19.86 / 22.54 |
| 250k | 6 | 924 | 2.57 / 9.29 / 21.11 |
| 250k | 8 | 495 | 1.73 / 5.81 / 12.55 |
| 500k | 1 | 12 | 3.38 / 21.21 / 22.60 |
| 500k | 2 | 66 | 2.17 / 6.26 / 21.25 |
| 500k | 3 | 220 | 1.47 / 5.22 / 9.47 |
| 500k | 4 | 495 | 1.12 / 3.42 / 6.02 |
| 500k | 6 | 924 | 0.82 / 2.31 / 3.33 |
| 500k | 8 | 495 | 0.56 / 1.55 / 1.99 |
| 750k | 1 | 12 | 14.66 / 36.21 / 37.68 |
| 750k | 2 | 66 | 6.43 / 24.33 / 36.04 |
| 750k | 3 | 220 | 4.64 / 21.09 / 35.00 |
| 750k | 4 | 495 | 4.07 / 15.00 / 26.54 |
| 750k | 6 | 924 | 2.74 / 8.97 / 20.87 |
| 750k | 8 | 495 | 1.84 / 5.85 / 10.07 |
