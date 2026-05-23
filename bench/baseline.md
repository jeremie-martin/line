
# Benchmark report

Generated: 2026-05-23T20:09:35.256Z

## easy-single

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 38.7% | 43f | 2.74 | 0 | 1264 | 43ms | 1 |
| greedy | ✓ | ✓ | 37.8% | 42f | 2.59 | 0 | 1258 | 61ms | 1 |
| greedy-deep | ✓ | ✓ | 37.8% | 42f | 2.59 | 0 | 1258 | 63ms | 1 |
| mc-50 | ✓ | ✓ | 55.0% | 61f | 2.78 | 0 | 1299 | 1292ms | 50 |

## six-slides

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ |  | 41.8% | 43f | 6.80 | 1 | 1275 | 104ms | 1 |
| greedy | ✓ | ✓ | 44.0% | 42f | 6.98 | 0 | 1386 | 312ms | 12 |
| greedy-deep | ✓ | ✓ | 44.0% | 42f | 6.98 | 0 | 1386 | 359ms | 12 |
| mc-50 | ✓ | ✓ | 46.8% | 35f | 7.06 | 0 | 1382 | 4226ms | 50 |

## tight-chain

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 63.2% | 44f | 4.35 | 0 | 1338 | 73ms | 1 |
| greedy | ✓ | ✓ | 65.4% | 42f | 4.32 | 0 | 1337 | 276ms | 10 |
| greedy-deep | ✓ | ✓ | 65.4% | 42f | 4.32 | 0 | 1337 | 277ms | 10 |
| mc-50 | ✓ | ✓ | 65.4% | 43f | 4.38 | 0 | 1340 | 3938ms | 50 |

## showcase

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✓ | ✓ | 44.4% | 43f | 3.73 | 0 | 1299 | 49ms | 1 |
| greedy | ✓ | ✓ | 40.7% | 42f | 3.49 | 0 | 1287 | 111ms | 3 |
| greedy-deep | ✓ | ✓ | 40.7% | 42f | 3.49 | 0 | 1287 | 119ms | 3 |
| mc-50 | ✓ | ✓ | 44.4% | 53f | 4.26 | 0 | 1325 | 2845ms | 50 |

## grand-tour

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✗ |  | 17.4% | 62f | 8.34 | 3 | 249 | 327ms | 1 |
| greedy | ✓ |  | 33.7% | 63f | 15.05 | 4 | 1257 | 5369ms | 236 |
| greedy-deep | ✓ |  | 39.1% | 74f | 11.53 | 5 | 1263 | 25836ms | 1179 |
| mc-50 | ✗ |  | 18.8% | 76f | 7.98 | 3 | 265 | 16479ms | 50 |

## wide-gap

| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |
|---|---|---|---|---|---|---|---|---|---|
| adaptive | ✗ |  | 14.1% | 43f | 2.77 | 1 | 130 | 59ms | 1 |
| greedy | ✓ | ✓ | 23.2% | 43f | 9.05 | 0 | 1366 | 1109ms | 52 |
| greedy-deep | ✓ | ✓ | 23.2% | 43f | 9.05 | 0 | 1366 | 1136ms | 52 |
| mc-50 | ✗ |  | 19.9% | 61f | 2.79 | 1 | 155 | 3258ms | 50 |

## Strategy aggregates

| strategy | survived/n | all-passed/n | mean fitness | mean elapsed (ms) | mean sims |
|---|---|---|---|---|---|
| adaptive | 4/6 | 3/6 | 925.9 | 109 | 1 |
| greedy | 6/6 | 5/6 | 1315.2 | 1206 | 52 |
| greedy-deep | 6/6 | 5/6 | 1316.2 | 4632 | 210 |
| mc-50 | 4/6 | 4/6 | 961.0 | 5340 | 50 |
