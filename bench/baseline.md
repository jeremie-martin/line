
# Benchmark report

Generated: 2026-05-23T20:18:54.956Z

## easy-single

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 38.7% | 43f | 2.74 | 0 | 1264 | 43ms | 1 |
| greedy | ✓ | ✓ | 37.8% | 42f | 2.59 | 0 | 1258 | 63ms | 1 |
| greedy-deep | ✓ | ✓ | 37.8% | 42f | 2.59 | 0 | 1258 | 66ms | 1 |
| mc-50 | ✓ | ✓ | 55.0% | 61f | 2.78 | 0 | 1299 | 1354ms | 50 |

## six-slides

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ |  | 41.8% | 43f | 6.80 | 1 | 1275 | 105ms | 1 |
| greedy | ✓ | ✓ | 44.0% | 42f | 6.98 | 0 | 1386 | 320ms | 12 |
| greedy-deep | ✓ | ✓ | 44.0% | 42f | 6.98 | 0 | 1386 | 354ms | 12 |
| mc-50 | ✓ | ✓ | 46.8% | 35f | 7.06 | 0 | 1382 | 4272ms | 50 |

## tight-chain

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 63.2% | 44f | 4.35 | 0 | 1338 | 73ms | 1 |
| greedy | ✓ | ✓ | 65.4% | 42f | 4.32 | 0 | 1337 | 285ms | 10 |
| greedy-deep | ✓ | ✓ | 65.4% | 42f | 4.32 | 0 | 1337 | 301ms | 10 |
| mc-50 | ✓ | ✓ | 65.4% | 43f | 4.38 | 0 | 1340 | 3932ms | 50 |

## showcase

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 44.4% | 43f | 3.73 | 0 | 1299 | 74ms | 1 |
| greedy | ✓ | ✓ | 40.7% | 42f | 3.49 | 0 | 1287 | 113ms | 3 |
| greedy-deep | ✓ | ✓ | 40.7% | 42f | 3.49 | 0 | 1287 | 117ms | 3 |
| mc-50 | ✓ | ✓ | 44.4% | 53f | 4.26 | 0 | 1325 | 2873ms | 50 |

## grand-tour

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✗ |  | 17.4% | 62f | 8.34 | 3 | 249 | 344ms | 1 |
| greedy | ✓ |  | 36.1% | 61f | 21.01 | 3 | 1267 | 3253ms | 153 |
| greedy-deep | ✓ |  | 37.4% | 60f | 17.75 | 4 | 1257 | 3845ms | 172 |
| mc-50 | ✗ |  | 18.8% | 76f | 7.98 | 3 | 265 | 16849ms | 50 |

## wide-gap

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✗ |  | 14.1% | 43f | 2.77 | 1 | 130 | 60ms | 1 |
| greedy | ✓ | ✓ | 23.2% | 43f | 8.46 | 0 | 1366 | 1368ms | 67 |
| greedy-deep | ✓ | ✓ | 23.2% | 43f | 8.46 | 0 | 1366 | 1351ms | 67 |
| mc-50 | ✗ |  | 19.9% | 61f | 2.79 | 1 | 155 | 3215ms | 50 |

## Strategy aggregates

| strategy | survived/n | all-passed/n | mean fitness | mean elapsed (ms) | mean sims |
|---|---|---|---|---|---|
| adaptive | 4/6 | 3/6 | 925.9 | 117 | 1 |
| greedy | 6/6 | 5/6 | 1316.9 | 900 | 41 |
| greedy-deep | 6/6 | 5/6 | 1315.3 | 1006 | 44 |
| mc-50 | 4/6 | 4/6 | 961.0 | 5416 | 50 |
